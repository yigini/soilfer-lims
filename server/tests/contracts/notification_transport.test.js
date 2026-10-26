const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const esbuild = require('../../../client/node_modules/esbuild');
const React = require('../../../client/node_modules/react');

let driver;
async function mount(get = jest.fn().mockResolvedValue({ data: [] })) {
    const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.invalid/' });
    const previous = {};
    for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
        navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true })) {
        previous[key] = Object.getOwnPropertyDescriptor(global, key);
        Object.defineProperty(global, key, { value, configurable: true, writable: true });
    }
    let visibility = 'visible', online = true;
    Object.defineProperty(document, 'visibilityState', { get: () => visibility });
    Object.defineProperty(navigator, 'onLine', { get: () => online });
    let auth = { user: { id: 'one' }, token: 'synthetic-session-one' }, value;
    const sockets = [];
    class Socket {
        static CONNECTING = 0;
        static OPEN = 1;
        constructor(url, protocols) { this.url = url; this.protocols = protocols; this.readyState = 0; sockets.push(this); }
        open() { this.readyState = 1; this.onopen?.(); }
        close(code = 1000) { this.readyState = 3; this.onclose?.({ code }); }
        message(data) { this.onmessage?.({ data: JSON.stringify(data) }); }
    }
    const source = fs.readFileSync(path.resolve(__dirname, '../../../client/src/context/NotificationContext.jsx'), 'utf8');
    const module = { exports: {} };
    const code = esbuild.transformSync(source, { loader: 'jsx', format: 'cjs',
        define: { 'import.meta.env.DEV': 'false' } }).code;
    vm.runInNewContext(code, { module, exports: module.exports, window, document, navigator,
        console, Date, setInterval, clearInterval, setTimeout, clearTimeout, WebSocket: Socket,
        require: name => {
            if (name === 'react') return React;
            if (name === 'axios') return { get };
            if (name === './AuthContext') return { useAuth: () => auth };
            if (name === '../utils/audioCues') return { playNoticeChime() {} };
            throw Error('Unexpected boundary ' + name);
        } });
    const { NotificationProvider, NotificationContext } = module.exports;
    function Consumer() { value = React.useContext(NotificationContext); return null; }
    const root = require('../../../client/node_modules/react-dom/client').createRoot(document.getElementById('root'));
    const render = async next => {
        if (next) auth = next;
        await React.act(async () => { root.render(React.createElement(NotificationProvider, null, React.createElement(Consumer))); });
    };
    driver = { get, sockets, render, get value() { return value; },
        async advance(ms) { await React.act(async () => { await jest.advanceTimersByTimeAsync(ms); }); },
        async visible(next) { visibility = next; await React.act(async () => document.dispatchEvent(new window.Event('visibilitychange'))); },
        async online(next) { online = next; await React.act(async () => window.dispatchEvent(new window.Event('online'))); },
        async dispose() {
            await React.act(async () => root.unmount()); dom.window.close();
            for (const key of Object.keys(previous)) {
                if (previous[key]) Object.defineProperty(global, key, previous[key]); else delete global[key];
            }
        } };
    await render();
    return driver;
}

beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(async () => {
    if (driver) await driver.dispose();
    driver = null; jest.useRealTimers(); jest.restoreAllMocks();
});

test('same-user preference rerenders do not reconnect or refetch; fallback polls every30seconds', async () => {
    const h = await mount();
    expect(h.get).toHaveBeenCalledTimes(2); expect(h.sockets).toHaveLength(1);
    await h.render({ user: { id: 'one', language: 'fr' }, token: 'synthetic-session-one' });
    expect(h.get).toHaveBeenCalledTimes(2); expect(h.sockets).toHaveLength(1);
    await h.advance(8000); expect(h.get).toHaveBeenCalledTimes(2);
    await h.advance(22000); expect(h.get).toHaveBeenCalledTimes(4);
    await h.visible('hidden'); await h.advance(180000); expect(h.get).toHaveBeenCalledTimes(4);
    await h.visible('visible'); expect(h.get).toHaveBeenCalledTimes(6);
    await h.online(false); await h.advance(30000); expect(h.get).toHaveBeenCalledTimes(6);
    await h.online(true); expect(h.get).toHaveBeenCalledTimes(8);
});
test('open WebSocket suppresses fallback polling', async () => {
    const h = await mount();
    await React.act(async () => { h.sockets[0].open(); h.sockets[0].message({ type: 'CONNECTED', onlineUsers: [] }); });
    await h.advance(180000); expect(h.get).toHaveBeenCalledTimes(2);
});
test('one in-flight request per endpoint and late responses cannot cross a session change', async () => {
    const pending = [];
    const h = await mount(jest.fn(() => new Promise(resolve => pending.push(resolve))));
    await React.act(async () => { h.value.refresh(); h.value.refresh(); h.value.fetchConversations(); });
    expect(h.get).toHaveBeenCalledTimes(2);
    await h.render({ user: { id: 'two' }, token: 'synthetic-session-two' });
    expect(h.get).toHaveBeenCalledTimes(4);
    await React.act(async () => { pending[0]({ data: [{ id: 'previous-session' }] }); pending[1]({ data: [] }); });
    expect(h.value.notifications).toEqual([]);
    await React.act(async () => { pending[2]({ data: [{ id: 'current-session' }] }); pending[3]({ data: [] }); });
    expect(h.value.notifications).toEqual([{ id: 'current-session' }]);
});
test('429Retry-After pauses both background endpoints', async () => {
    const h = await mount(jest.fn().mockRejectedValue({ response: { status: 429, headers: { 'retry-after': '120' } } }));
    expect(h.get).toHaveBeenCalledTimes(2);
    await h.advance(90000); expect(h.get).toHaveBeenCalledTimes(2);
    await h.advance(30000); expect(h.get).toHaveBeenCalledTimes(4);
});
test.each([401, 403])('authentication refusal%s stops polling until a new token', async status => {
    const h = await mount(jest.fn().mockRejectedValue({ response: { status } }));
    await h.advance(180000); expect(h.get).toHaveBeenCalledTimes(2);
    await h.render({ user: { id: 'one' }, token: 'synthetic-renewed-session' });
    expect(h.get).toHaveBeenCalledTimes(4);
});
test.each([4001, 4002, 4003, 4004, 4005])('WebSocket auth refusal%s does not create an upgrade loop', async code => {
    const h = await mount(); h.sockets[0].close(code);
    await h.advance(180000); expect(h.sockets).toHaveLength(1);
});
test('transient reconnects back off and authenticated CONNECTED resets the delay', async () => {
    const h = await mount(); h.sockets[0].close(1006);
    await h.advance(2999); expect(h.sockets).toHaveLength(1);
    await h.advance(1); expect(h.sockets).toHaveLength(2); h.sockets[1].close(1006);
    await h.advance(5999); expect(h.sockets).toHaveLength(2);
    await h.advance(1); expect(h.sockets).toHaveLength(3);
    await React.act(async () => { h.sockets[2].open(); h.sockets[2].message({ type: 'CONNECTED', onlineUsers: [] }); });
    h.sockets[2].close(1006); await h.advance(3000); expect(h.sockets).toHaveLength(4);
});
