const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { JSDOM } = require('jsdom');
const React = require('../../../client/node_modules/react');
const esbuild = require('../../../client/node_modules/esbuild');

describe('Audit 4.3: controlled decimal input acknowledgements', () => {
    let dom, root, input, draft, parent, rejected, writes;
    const loadInput = () => {
        const module = { exports: {} };
        vm.runInNewContext(esbuild.transformSync(fs.readFileSync(path.resolve(__dirname,
            '../../../client/src/components/workbench/BarcodeSafeInput.jsx'), 'utf8'), { loader: 'jsx', format: 'cjs' }).code,
        { module, exports: module.exports, console, Date, setTimeout, clearTimeout, require: name => {
            if (name === 'react') return React;
            throw Error('Unexpected controlled-input dependency: ' + name);
        } });
        return module.exports.default;
    };
    beforeEach(async () => {
        jest.useFakeTimers();
        dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
        global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator;
        global.IS_REACT_ACT_ENVIRONMENT = true;
        root = require('../../../client/node_modules/react-dom/client').createRoot(document.getElementById('root'));
        draft = ''; rejected = jest.fn(); writes = jest.fn();
        const Input = loadInput();
        function Parent() {
            const [value, setValue] = React.useState(''); parent = { setValue };
            return React.createElement(Input, { value, onBarcodeRejected: rejected, onChange: event => {
                draft = event.target.value; writes(draft);
                // The previous flush is acknowledged after the next 45ms key
                // has begun, while the new input still owns a pending timer.
                setTimeout(() => setValue(draft), 25);
            } });
        }
        await React.act(async () => root.render(React.createElement(Parent)));
        input = document.querySelector('input');
    });
    afterEach(async () => {
        await React.act(async () => root.unmount()); jest.clearAllTimers(); jest.useRealTimers(); dom.window.close();
        delete global.window; delete global.document; delete global.navigator; delete global.IS_REACT_ACT_ENVIRONMENT;
    });
    const advance = async milliseconds => {
        // Flush React between timer deadlines, as the browser event loop does.
        for (let elapsed = 0; elapsed < milliseconds; elapsed += 5)
            await React.act(async () => { jest.advanceTimersByTime(Math.min(5, milliseconds - elapsed)); });
    };
    const typeKey = async character => React.act(async () => {
        input.dispatchEvent(new window.KeyboardEvent('keydown', { key: character, bubbles: true, cancelable: true }));
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, input.value + character);
        input.dispatchEvent(new window.Event('input', { bubbles: true }));
    });

    test.each([45, 120].flatMap(gap => ['6.01', '0.125', '12.5'].map(text => [text, gap])))('%s survives a slow parent acknowledgement at %sms/key', async (text, gap) => {
        for (const character of text) { await typeKey(character); await advance(gap); }
        await advance(60);
        expect(input.value).toBe(text); expect(draft).toBe(text); expect(writes).toHaveBeenLastCalledWith(text);
        expect(rejected).not.toHaveBeenCalled();
    });

    test('a genuinely external mid-edit value cancels pending input and resets the field', async () => {
        await typeKey('1'); await advance(10);
        await React.act(async () => parent.setValue('9.9')); await advance(80);
        expect(input.value).toBe('9.9'); expect(writes).not.toHaveBeenCalled(); expect(draft).toBe('');
    });

    test('the strict wedge burst still restores its original value with zero draft writes', async () => {
        for (const character of 'GHA1-26-000123N') { await typeKey(character); await advance(10); }
        await React.act(async () => input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));
        await advance(80);
        expect(input.value).toBe(''); expect(writes).not.toHaveBeenCalled(); expect(rejected).toHaveBeenCalledTimes(1);
    });
});
