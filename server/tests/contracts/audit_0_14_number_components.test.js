const fs = require('fs');
const path = require('path');
const vm = require('vm');
const esbuild = require('../../../client/node_modules/esbuild');
const React = require('../../../client/node_modules/react');
const ReactDOMServer = require('../../../client/node_modules/react-dom/server');
const numberParse = require('../../../shared/numberParse');
const { getStrictNumberFormat } = require('../../services/policyService');
const root = path.resolve(__dirname, '../../../client/src/components/workbench');
const cache = {};
function load(name) {
    if (cache[name]) return cache[name];
    const module = { exports: {} };
    const file = path.join(root, `${name}.jsx`);
    const code = esbuild.transformSync(fs.readFileSync(file, 'utf8'), { loader: 'jsx', format: 'cjs' }).code;
    vm.runInNewContext(code, { module, exports: module.exports, require: dependency => {
        if (dependency === 'react') return { ...React, useRef: value => ({ current: value }), useMemo: fn => fn() };
        if (dependency.includes('shared/numberParse')) return numberParse;
        if (dependency.includes('LanguageContext')) return { useLanguage: () => ({ t: (_, fallback) => fallback }) };
        if (dependency === './NumberPreview') return load('NumberPreview');
        if (dependency.includes('soilCalculations')) {
            const calculation = { exports: {} };
            const utility = fs.readFileSync(path.resolve(root, '../../utils/soilCalculations.js'), 'utf8');
            vm.runInNewContext(esbuild.transformSync(utility, { loader: 'js', format: 'cjs' }).code,
                { module: calculation, exports: calculation.exports });
            return calculation.exports;
        }
        throw new Error(`Unexpected dependency ${dependency}`);
    } });
    cache[name] = module.exports;
    return cache[name];
}
function nodes(node) {
    if (Array.isArray(node)) return node.flatMap(nodes);
    if (!node || typeof node !== 'object') return [];
    return [node, ...nodes(node.props?.children)];
}
describe('Audit 0.14: actual numeric editor previews', () => {
    const format = getStrictNumberFormat();
    const preview = (value, numberFormat = format) => load('NumberPreview').default({ value, numberFormat });
    test.each([['6,85', '→ 6.85'], ['0,125', '→ 0.125'], ['< 0.5', '→ <0.5'], ['1e-3', '→ 0.001']])('preview %s uses the canonical shared parse', (input, text) => {
        const tree = preview(input);
        expect(tree.props.children).toBe(text);
        expect(tree.props['data-number-code']).toBe('');
    });
    test.each([['1,234', 'AMBIGUOUS_NUMBER'], ['1.234', 'AMBIGUOUS_NUMBER'], ['6 ,42', 'INVALID_NUMBER']])('preview %s displays the same refusal as the server', (input, code) => {
        expect(preview(input).props['data-number-code']).toBe(code);
    });
    test('explicit grouping changes the preview and invalid configuration fails closed', () => {
        expect(preview('1,234', { decimal: '.', thousands: ',' }).props.children).toBe('→ 1234');
        expect(preview('6,85', { decimal: ',', thousands: ',' }).props['data-number-code']).toBe('NUMBER_FORMAT_POLICY_INVALID');
        expect(preview('')).toBeNull();
    });
    test('texture comma fractions close at 100 and callbacks keep the original entered string', () => {
        const change = jest.fn();
        const tree = load('TextureEditor').default({ values: { sand: '6,85', silt: '43,15', clay: '50' }, numberFormat: format, onChange: change });
        expect(ReactDOMServer.renderToStaticMarkup(tree)).toContain('✓ 100%');
        const input = nodes(tree).find(node => node.type === 'input');
        input.props.onChange({ target: { value: '6,86' } });
        expect(change).toHaveBeenCalledWith({ sand: '6,86', silt: '43,15', clay: '50' });
    });
    test('ambiguous or internally spaced texture values cannot show a passing closure', () => {
        for (const sand of ['1,234', '6 ,85']) {
            const tree = load('TextureEditor').default({ values: { sand, silt: '43,15', clay: '50' }, numberFormat: format });
            const html = ReactDOMServer.renderToStaticMarkup(tree);
            expect(html).not.toContain('✓');
            expect(html).toContain(sand === '1,234' ? 'AMBIGUOUS_NUMBER' : 'INVALID_NUMBER');
        }
    });
});
