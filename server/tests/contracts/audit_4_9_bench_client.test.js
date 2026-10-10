const fs = require('node:fs'), path = require('node:path');
const { JSDOM } = require('jsdom');
const esbuild = require('../../../client/node_modules/esbuild');

// #202 acceptance runs the real components in a real DOM with the client's
// own React; only axios, auth and translation are supplied by the test.
const dom = new JSDOM('<!doctype html><body><input id="cell"><div id="root"></div></body>', { url: 'http://localhost/', pretendToBeVisual: true });
Object.assign(global, { window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
const clientModules = path.resolve(__dirname, '../../../client/node_modules');
const React = require(path.join(clientModules, 'react'));
const { createRoot } = require(path.join(clientModules, 'react-dom/client'));
const { act } = React;
const src = path.resolve(__dirname, '../../../client/src');

function load(relative, mocks = {}) {
    const file = path.join(src, relative), module = { exports: {} };
    const { code } = esbuild.transformSync(fs.readFileSync(file, 'utf8'), { loader: file.endsWith('.jsx') ? 'jsx' : 'js', format: 'cjs' });
    new Function('module', 'exports', 'require', code)(module, module.exports, name => {
        const mock = Object.keys(mocks).find(key => name === key || name.endsWith(key));
        if (mock) return mocks[mock];
        return name === 'react' ? React : require(name);
    });
    return module.exports;
}
const t = (key, options) => typeof options === 'object' && options?.name ? `${key}:${options.name}` : key;
const flush = () => act(async () => { for (let index = 0; index < 5; index++) await Promise.resolve(); });
const byTestId = id => document.querySelector(`[data-testid="${id}"]`);
const type = async (input, value) => act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
});
const submit = async form => act(async () => { form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); });
const key = target => { const event = new window.KeyboardEvent('keydown', { key: '5', bubbles: true, cancelable: true }); target.dispatchEvent(event); return event; };
const rejection = code => Object.assign(new Error(code), { response: { data: { code } } });

// Minimal in-memory IndexedDB with the request/transaction ordering the
// offline store relies on: request callbacks run before the transaction ends.
function fakeIndexedDb() {
    const stores = new Map();
    const database = { objectStoreNames: { contains: name => stores.has(name) },
        createObjectStore(name, { keyPath }) { const store = { keyPath, rows: new Map() }; stores.set(name, store); return { createIndex() {} }; },
        transaction(name) {
            const tx = {}, store = stores.get(name); let pending = 0;
            const settle = () => setImmediate(() => { if (!pending) tx.oncomplete?.(); });
            const request = run => { const req = {}; pending++; setImmediate(() => { req.result = run(); pending--; req.onsuccess?.({ target: req }); settle(); }); return req; };
            tx.objectStore = () => ({ get: id => request(() => store.rows.get(id)), getAll: () => request(() => [...store.rows.values()]),
                put: row => { store.rows.set(row[store.keyPath], structuredClone(row)); },
                delete: id => { store.rows.delete(id); }, index: () => ({ getAll: () => request(() => [...store.rows.values()]) }) });
            settle();
            return tx;
        } };
    return { stores, open() { const req = {}; setImmediate(() => { req.result = database; req.onupgradeneeded?.({ target: req }); req.onsuccess?.({ target: req }); }); return req; } };
}

describe('idle lock (#202 B12)', () => {
    let root, axios, guard;
    beforeEach(async () => {
        jest.useFakeTimers({ doNotFake: ['setImmediate', 'queueMicrotask', 'nextTick'] });
        localStorage.setItem('soilfer.benchMode', 'on');
        axios = { get: jest.fn(async () => ({ data: { idleLockMinutes: 1, pinAtRecord: true, pinSet: true } })),
            post: jest.fn(async (url, body) => { if (body.pin !== '2468') throw rejection('BENCH_PIN_INVALID'); return { data: { verified: true } }; }),
            put: jest.fn() };
        const BenchMode = load('components/workbench/BenchMode.jsx', { axios }).default;
        root = createRoot(document.getElementById('root'));
        await act(async () => root.render(React.createElement(BenchMode, { user: { id: 'u1', username: 'ana' }, t, canManage: true,
            onSwitchAnalyst: jest.fn(), registerRecordGuard: fn => { guard = fn; } })));
        await flush();
    });
    afterEach(async () => { await act(async () => root.unmount()); jest.useRealTimers(); localStorage.clear(); });

    test('after the idle timeout, input is blocked until the PIN is entered', async () => {
        const cell = document.getElementById('cell');
        expect(axios.get).toHaveBeenCalledWith('/api/auth/bench');
        expect(byTestId('bench-analyst').textContent).toBe('bench.analyst:ana');
        cell.focus();
        await act(async () => { jest.advanceTimersByTime(40 * 1000); });
        key(cell); // activity resets the clock
        await act(async () => { jest.advanceTimersByTime(40 * 1000); });
        expect(byTestId('bench-lock')).toBeNull();
        expect(key(cell).defaultPrevented).toBe(false);

        await act(async () => { jest.advanceTimersByTime(65 * 1000); });
        expect(byTestId('bench-lock')).not.toBeNull();
        expect(document.activeElement).not.toBe(cell);
        expect(key(cell).defaultPrevented).toBe(true);
        const beforeInput = new window.InputEvent('beforeinput', { bubbles: true, cancelable: true, data: '5' });
        cell.dispatchEvent(beforeInput); expect(beforeInput.defaultPrevented).toBe(true);
        await act(async () => { cell.focus(); });
        expect(document.activeElement).not.toBe(cell);

        const pin = byTestId('bench-lock').querySelector('input');
        expect(key(pin).defaultPrevented).toBe(false);
        await type(pin, '1111'); await submit(byTestId('bench-pin-form')); await flush();
        expect(byTestId('bench-lock')).not.toBeNull();
        expect(byTestId('bench-lock').querySelector('[role="alert"]').textContent).toBe('bench.errors.BENCH_PIN_INVALID');

        await type(pin, '2468'); await submit(byTestId('bench-pin-form')); await flush();
        expect(axios.post).toHaveBeenLastCalledWith('/api/auth/bench/pin/verify', { pin: '2468' });
        expect(byTestId('bench-lock')).toBeNull();
        expect(key(cell).defaultPrevented).toBe(false);
    });

    test('Record asks for the same analyst PIN when lab policy requires it', async () => {
        let confirmed; await act(async () => { confirmed = guard(); });
        expect(byTestId('bench-record-pin')).not.toBeNull();
        await type(byTestId('bench-record-pin').querySelector('input'), '2468');
        await submit(byTestId('bench-pin-form')); await flush();
        await expect(confirmed).resolves.toBe(true);
        expect(byTestId('bench-record-pin')).toBeNull();
    });
});

describe('local drafts on a shared terminal (#202 B13/B15)', () => {
    let offline;
    beforeEach(() => {
        window.indexedDB = fakeIndexedDb();
        offline = load('services/offline/offlineDb.js');
        offline.resetOfflineDbConnection();
    });

    test('after a switch, the new analyst cannot see the previous analyst local drafts or queued work', async () => {
        await offline.saveLocalDraft('draft:ana:wi-1', { value: '6.25' });
        await offline.saveLocalDraft('draft:ana:wi-2', { value: '7.10' });
        await offline.saveLocalDraft('draft:ben:wi-1', { value: '5.00' });
        await offline.withStore('outbox', 'readwrite', store => {
            store.put({ operationId: 'op-ana', userId: 'ana', status: 'PENDING' });
            store.put({ operationId: 'op-ben', userId: 'ben', status: 'PENDING' });
        });
        expect(await offline.purgeUserOfflineState('ana')).toEqual({ drafts: 2, operations: 1 });
        expect(await offline.getLocalDraft('draft:ana:wi-1')).toBeNull();
        expect(await offline.getLocalDraft('draft:ana:wi-2')).toBeNull();
        expect(await offline.getLocalDraft('draft:ben:wi-1')).toEqual({ value: '5.00' });
        const outbox = await offline.withStore('outbox', 'readonly', store => new Promise(resolve => { const req = store.getAll(); req.onsuccess = () => resolve(req.result); }));
        expect(outbox.map(row => row.operationId)).toEqual(['op-ben']);
        expect(await offline.purgeUserOfflineState('')).toEqual({ drafts: 0, operations: 0 });
    });

    test('changing the instrument keeps the typed value and every other draft field', async () => {
        await offline.mergeLocalDraft('draft:ana:wi-1', { workItemId: 'wi-1', value: '6.25', extra: { basis: 'OVEN_DRY', replicateNo: 2 } });
        await offline.mergeLocalDraft('draft:ana:wi-1', { workItemId: 'wi-1', value: null, extra: { instrumentId: 'meter-2' } });
        expect(await offline.getLocalDraft('draft:ana:wi-1')).toEqual({ workItemId: 'wi-1', value: '6.25',
            extra: { basis: 'OVEN_DRY', replicateNo: 2, instrumentId: 'meter-2' } });
        // Two quick changes issued together both survive.
        await Promise.all([offline.mergeLocalDraft('draft:ana:wi-1', { value: undefined, extra: { instrumentId: 'meter-3' } }),
            offline.mergeLocalDraft('draft:ana:wi-1', { value: '6.30', extra: {} })]);
        expect(await offline.getLocalDraft('draft:ana:wi-1')).toMatchObject({ value: '6.30', extra: { basis: 'OVEN_DRY', instrumentId: 'meter-3' } });
    });
});

describe('token expiry mid-entry (#202 B14)', () => {
    let bridge;
    beforeEach(() => { bridge = load('lib/sessionBridge.js'); });
    const expired = (extra = {}) => ({ response: { status: 401, data: { code: 'TOKEN_EXPIRED' } }, config: { method: 'post', url: '/api/workbench/batch-save',
        data: JSON.stringify({ draft: true, entries: [{ workItemId: 'wi-1', value: '6.25' }] }), headers: { Authorization: 'Bearer old' }, ...extra } });

    test('the typed values are re-sent with the fresh token after re-login, once, and concurrent expiries share one prompt', async () => {
        const handler = jest.fn(async () => 'fresh'); bridge.registerReloginHandler(handler);
        const send = jest.fn(async config => ({ status: 200, config }));
        const [first, second] = await Promise.all([bridge.retryAfterRelogin(expired(), send), bridge.retryAfterRelogin(expired(), send)]);
        expect(handler).toHaveBeenCalledTimes(1);
        for (const response of [first, second]) {
            expect(response.config.headers.Authorization).toBe('Bearer fresh');
            expect(JSON.parse(response.config.data).entries).toEqual([{ workItemId: 'wi-1', value: '6.25' }]);
        }
        expect(bridge.retryAfterRelogin(expired({ _sfRelogin: true }), send)).toBeNull();
        expect(bridge.retryAfterRelogin({ ...expired(), response: { status: 401, data: { code: 'TOKEN_INVALID' } } }, send)).toBeNull();
    });

    test('without a mounted re-login prompt the existing sign-in handling applies; a cancelled prompt rejects the original error', async () => {
        const send = jest.fn();
        expect(bridge.retryAfterRelogin(expired(), send)).toBeNull();
        bridge.registerReloginHandler(async () => { throw new Error('signed out'); });
        const error = expired();
        await expect(bridge.retryAfterRelogin(error, send)).rejects.toBe(error);
        expect(send).not.toHaveBeenCalled();
    });

    test('the re-login prompt accepts only the same analyst and keeps the session in place', async () => {
        const resumeSession = jest.fn(), logout = jest.fn();
        const axios = { post: jest.fn(async (url, body) => body.password === 'right'
            ? { data: { token: 'fresh', user: { username: 'ana' } } } : { data: { token: 'other', user: { username: 'ben' } } }) };
        const auth = { useAuth: () => ({ user: { id: 'u1', username: 'ana' }, token: null, logout, resumeSession }) };
        const SessionKeeper = load('components/auth/SessionKeeper.jsx', { axios, '/AuthContext': auth,
            '/LanguageContext': { useLanguage: () => ({ t }) }, '/sessionBridge': bridge }).default;
        const root = createRoot(document.getElementById('root'));
        await act(async () => root.render(React.createElement(SessionKeeper)));
        let token; await act(async () => { bridge.requestRelogin().then(value => { token = value; }); });
        await flush();
        const dialog = byTestId('session-relogin');
        expect(dialog).not.toBeNull();
        await type(dialog.querySelector('input'), 'wrong'); await submit(dialog.querySelector('form')); await flush();
        expect(dialog.querySelector('[role="alert"]').textContent).toBe('session.reloginFailed');
        expect(resumeSession).not.toHaveBeenCalled(); expect(token).toBeUndefined();
        await type(dialog.querySelector('input'), 'right'); await submit(dialog.querySelector('form')); await flush();
        expect(axios.post).toHaveBeenLastCalledWith('/api/auth/login', { username: 'ana', password: 'right' });
        expect(resumeSession).toHaveBeenCalledWith('fresh', { username: 'ana' });
        expect(token).toBe('fresh'); expect(logout).not.toHaveBeenCalled();
        expect(byTestId('session-relogin')).toBeNull();
        await act(async () => root.unmount());
    });
});
