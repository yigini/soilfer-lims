const fs = require('fs');
const path = require('path');
const vm = require('vm');
const esbuild = require('../../../client/node_modules/esbuild');
const React = require('../../../client/node_modules/react');

function mountThemeToggle(theme) {
    const states = [], refs = [];
    let stateCursor = 0, refCursor = 0;
    const hooks = {
        ...React,
        useState(initial) {
            const index = stateCursor++;
            if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
            return [states[index], update => {
                states[index] = typeof update === 'function' ? update(states[index]) : update;
            }];
        },
        useRef(initial) {
            const index = refCursor++;
            return refs[index] || (refs[index] = { current: initial });
        },
        useCallback: callback => callback,
        useEffect: () => {}
    };
    const filename = path.resolve(__dirname, '../../../client/src/components/ThemeToggle.jsx');
    const source = esbuild.transformSync(fs.readFileSync(filename, 'utf8'), { loader: 'jsx', format: 'cjs' }).code;
    const module = { exports: {} };
    vm.runInNewContext(source, {
        module, exports: module.exports,
        require: name => {
            if (name === 'react') return hooks;
            if (name === 'react-router-dom') return { useNavigate: () => () => {} };
            if (name === 'lucide-react') return new Proxy({}, { get: () => () => null });
            if (name === '../context/ThemeContext') return { useTheme: () => theme };
            if (name === '../context/AuthContext') return { useAuth: () => ({ user: null }) };
            if (name === '../context/LanguageContext') return { useLanguage: () => ({ t: key => key }) };
            throw new Error(`Unexpected component dependency: ${name}`);
        }
    }, { filename });
    return () => {
        stateCursor = refCursor = 0;
        return module.exports.ThemeToggle();
    };
}

function elements(tree, predicate) {
    if (Array.isArray(tree)) return tree.flatMap(node => elements(node, predicate));
    if (!tree || typeof tree !== 'object') return [];
    return [...(predicate(tree) ? [tree] : []), ...elements(tree.props?.children, predicate)];
}

function text(tree) {
    if (Array.isArray(tree)) return tree.map(text).join('');
    if (tree == null || typeof tree === 'boolean') return '';
    return typeof tree === 'object' ? text(tree.props?.children) : String(tree);
}

test('header appearance choices pass mode objects and preserve clearing the session override', () => {
    const setSessionAppearance = jest.fn(), clearSessionAppearance = jest.fn();
    const render = mountThemeToggle({
        appearance: 'light', appearanceSource: 'session', activeTheme: { name: 'Default' },
        setSessionAppearance, clearSessionAppearance
    });
    const choose = key => {
        const trigger = elements(render(), node => node.type === 'button' && node.props['aria-haspopup'])[0];
        trigger.props.onClick();
        const button = elements(render(), node => node.type === 'button' && text(node) === key)[0];
        expect(button).toBeDefined();
        button.props.onClick();
        expect(elements(render(), node => node.props?.role === 'dialog')).toHaveLength(0);
    };

    choose('appearance.dark');
    expect(setSessionAppearance).toHaveBeenNthCalledWith(1, { mode: 'dark' });
    choose('appearance.light');
    expect(setSessionAppearance).toHaveBeenNthCalledWith(2, { mode: 'light' });
    choose('appearance.useSavedDefault');
    expect(clearSessionAppearance).toHaveBeenCalledTimes(1);
    expect(setSessionAppearance).toHaveBeenCalledTimes(2);
});
