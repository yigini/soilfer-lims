const fs = require('fs'), path = require('path'), vm = require('vm');
const esbuild = require('../../../client/node_modules/esbuild');
const React = require('../../../client/node_modules/react');
const { registry } = require('../../config/policyRegistry');
const { snapshot } = require('../../services/policyService');
const locale = require('../../../client/src/translations/en.json');
const t = (key, fallback) => key.split('.').reduce((value, part) => value?.[part], locale) ?? fallback ?? key;
const elements = tree => Array.isArray(tree) ? tree.flatMap(elements) : tree && typeof tree === 'object' ? [tree, ...elements(tree.props?.children)] : [];
const find = (tree, type, text) => elements(tree).find(node => node.type === type && node.props.children === text);
function harness(data) {
    const states = [], effects = []; let cursor = 0, effectCursor = 0;
    const axios = { get: jest.fn().mockResolvedValue({ data }), patch: jest.fn().mockResolvedValue({}) };
    const hooks = { ...React, useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial;
        return [states[i], change => { states[i] = typeof change === 'function' ? change(states[i]) : change; }]; },
    useEffect(fn, deps) { const i = effectCursor++; if (!effects[i] || deps.some((dep, k) => dep !== effects[i][k])) { effects[i] = deps; fn(); } } };
    const module = { exports: {} }, filename = path.resolve(__dirname, '../../../client/src/components/lab/LabPolicies.jsx');
    vm.runInNewContext(esbuild.transformSync(fs.readFileSync(filename, 'utf8'), { loader: 'jsx', format: 'cjs' }).code,
        { module, exports: module.exports, require: name => name === 'react' ? hooks : name === 'axios' ? axios : { useLanguage: () => ({ t }) } });
    return { axios, editor: module.exports.PolicyValueEditor, render() { cursor = effectCursor = 0; return module.exports.default({ labId: 'lab' }); } };
}
async function fixture(canEdit = true, extra = {}) {
    const state = await snapshot(null);
    const h = harness({ ...state, registry, presets: ['ISO17025_STRICT', 'BASIC', 'ADVISORY'], canEdit,
        analyses: [{ code: 'PH', name: 'pH' }], methodologies: [{ id: 'method', name: 'Water pH', analysisCode: 'PH' }], overrides: [], history: [], ...extra });
    h.render(); await new Promise(resolve => setImmediate(resolve)); return h;
}
describe('Audit 1.0: real policy page controls', () => {
    test('technician sees effective policies and scope selectors but has no save, edit or clear controls', async () => {
        const h = await fixture(false), tree = h.render();
        expect(find(tree, 'h2', 'Policies')).toBeDefined();
        expect(elements(tree).filter(node => node.type === 'tr')).toHaveLength(Object.keys(registry).length + 2);
        for (const text of ['Edit', 'Clear override', 'Save preset', 'Save change']) expect(find(tree, 'button', text)).toBeUndefined();
        expect(elements(tree).filter(node => node.type === 'input')).toHaveLength(0);
        expect(h.axios.patch).not.toHaveBeenCalled();
    });
    test('manager changes preset with mandatory reason and current version', async () => {
        const h = await fixture(true, { version: 7 }); let tree = h.render();
        expect(find(tree, 'button', 'Save preset').props.disabled).toBe(true);
        elements(tree).find(node => node.type === 'select' && node.props.value === '').props.onChange({ target: { value: 'BASIC' } });
        elements(tree).find(node => node.type === 'input').props.onChange({ target: { value: 'Approved by laboratory' } }); tree = h.render();
        expect(find(tree, 'button', 'Save preset').props.disabled).toBe(false);
        elements(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); await new Promise(resolve => setImmediate(resolve));
        expect(h.axios.patch).toHaveBeenCalledWith('/api/labs/lab/policies', { presetCode: 'BASIC', reason: 'Approved by laboratory', expectedVersion: 7 });
    });
    test('manager edits selected method scope, includes reason and version, and cannot edit lab-only keys there', async () => {
        const h = await fixture(); let tree = h.render();
        elements(tree).find(node => node.type === 'select' && elements(node).some(option => option.props?.value === 'PH')).props.onChange({ target: { value: 'PH' } });
        tree = h.render(); await new Promise(resolve => setImmediate(resolve)); tree = h.render();
        elements(tree).find(node => node.type === 'select' && elements(node).some(option => option.props?.value === 'method')).props.onChange({ target: { value: 'method' } });
        h.render(); await new Promise(resolve => setImmediate(resolve)); tree = h.render();
        const row = elements(tree).find(node => node.type === 'tr' && elements(node).some(child => child.props?.children === 'Decimal separator'));
        expect(find(row, 'button', 'Edit')).toBeUndefined();
        find(tree, 'button', 'Edit').props.onClick(); tree = h.render();
        expect(find(tree, 'button', 'Save change').props.disabled).toBe(true);
        elements(tree).filter(node => node.type === 'input').at(-1).props.onChange({ target: { value: 'Method approved' } }); tree = h.render();
        elements(tree).filter(node => node.type === 'form').at(-1).props.onSubmit({ preventDefault() {} }); await new Promise(resolve => setImmediate(resolve));
        expect(h.axios.patch).toHaveBeenCalledWith('/api/labs/lab/policies', expect.objectContaining({ reason: 'Method approved', expectedVersion: 0,
            changes: [{ key: 'qc.mode', value: 'REQUIRED_BLOCKING', analysisCode: 'PH', methodologyId: 'method' }] }));
    });
    test('profile defaults cannot be cleared as laboratory overrides', async () => {
        const state = await snapshot(null, { profile: { overrides: { 'qc.mode': 'ADVISORY' } } });
        const h = await fixture(true, state); expect(find(h.render(), 'button', 'Clear override')).toBeUndefined();
    });
    test('Westgard editor keeps reject and warning lists exclusive', async () => {
        const h = await fixture(), change = jest.fn();
        const tree = h.editor({ definition: registry['qc.westgardRules'], value: { reject: [], warn: ['1-2s'] }, t, onChange: change });
        elements(tree).find(node => node.type === 'input').props.onChange({ target: { checked: true } });
        expect(change).toHaveBeenCalledWith({ reject: ['1-2s'], warn: [] });
    });
    test('all registry descriptions, UI labels and error keys exist in all five locales', () => {
        const flatten = object => Object.entries(object).flatMap(([key, value]) => value && typeof value === 'object' ? flatten(value).map(child => `${key}.${child}`) : [key]);
        for (const base of ['client/src/translations', 'server/locales']) for (const lang of ['en','es','es-419','fr','pt']) {
            const policies = require(path.resolve(__dirname, '../../..', base, `${lang}.json`)).policies;
            expect(flatten(policies).sort()).toEqual(flatten(locale.policies).sort());
            for (const definition of Object.values(registry)) expect(policies.keys[definition.description.split('.').at(-1)]).toBeTruthy();
        }
    });
});
