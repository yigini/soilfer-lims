const fs = require('fs');
const path = require('path');
const vm = require('vm');
const esbuild = require('../../../client/node_modules/esbuild');
const React = require('../../../client/node_modules/react');

function elements(node, predicate) {
    if (Array.isArray(node)) return node.flatMap(child => elements(child, predicate));
    if (!node || typeof node !== 'object') return [];
    return [...(predicate(node) ? [node] : []), ...elements(node.props?.children, predicate)];
}
function text(node) {
    if (Array.isArray(node)) return node.map(text).join(' ');
    return node && typeof node === 'object' ? text(node.props?.children) : String(node ?? '');
}
function harness(name) {
    const states = [], effects = [], cleanups = [], children = {};
    let stateIndex = 0, effectIndex = 0;
    const axios = { get: jest.fn().mockResolvedValue({ data: [] }), post: jest.fn().mockImplementation(async url =>
        ({ data: url.endsWith('mass-check') ? { totalRequiredMass: 150 } : { success: false } })) };
    const hooks = { ...React, useState(initial) {
        const index = stateIndex++;
        if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
        return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    }, useRef: () => ({ current: null }), useEffect(fn, deps) {
        const index = effectIndex++;
        if (JSON.stringify(effects[index]) !== JSON.stringify(deps)) {
            cleanups[index]?.(); effects[index] = deps; cleanups[index] = fn();
        }
    } };
    const module = { exports: {} };
    const source = fs.readFileSync(path.resolve(__dirname, `../../../client/src/components/reception/${name}.jsx`), 'utf8');
    const code = esbuild.transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
    vm.runInNewContext(code, { module, exports: module.exports, console, alert: jest.fn(), confirm: () => true,
        localStorage: { getItem: () => null }, window: { addEventListener() {}, removeEventListener() {} },
        require: dependency => {
            if (dependency === 'react') return hooks;
            if (dependency === 'axios') return axios;
            if (dependency === 'lucide-react') return new Proxy({}, { get: () => () => null });
            if (dependency.includes('LanguageContext')) return { useLanguage: () => ({ t: key => key }) };
            if (dependency.includes('audioCues')) return { playSuccessChime() {}, playErrorBuzz() {} };
            if (dependency.includes('coordParser')) return { parseCoordinates: () => ({ lat: 14.5, lng: -89.4, uncertaintyM: 10 }) };
            if (dependency.includes('spreadsheetImport')) return { MAX_FILE_SIZE: 5242880 };
            if (dependency === 'xlsx') return {};
            const child = path.basename(dependency);
            return children[child] || (children[child] = () => null);
        }
    });
    return { states, children, axios, render(props = {}) { stateIndex = 0; effectIndex = 0; return module.exports.default(props); } };
}
const button = (tree, label) => elements(tree, node => node.type === 'button').find(node => text(node).includes(label));
const field = (tree, label) => elements(tree, node => node.props?.['aria-label'] === label)[0];
const settle = () => new Promise(setImmediate);

describe('Audit 0.12: batch observation entry and explicit actions', () => {
    test('bulk inputs do not apply to scanned rows until clicked; audit payload freezes the actual applied values', async () => {
        const h = harness('BatchIntake'), props = { analysisGroups: [{ id: 'group', analyses: ['PH_H2O'] }] };
        let tree = h.render(props);
        expect(field(tree, 'batchIntake.massToApply').props.value).toBe('');
        expect(field(tree, 'batchIntake.moistureToApply').props.value).toBe('');
        field(tree, 'batchIntake.massToApply').props.onChange({ target: { value: '550' } });
        field(tree, 'batchIntake.moistureToApply').props.onChange({ target: { value: 'MOIST' } });
        tree = h.render(props);
        const scan = elements(tree, node => node.type === 'input' && node.props.placeholder?.startsWith('Scan or type'))[0];
        scan.props.onChange({ target: { value: 'bag-1' } });
        tree = h.render(props); await button(tree, 'Add Sample').props.onClick(); tree = h.render(props); await settle();
        expect(text(tree)).toContain('batchIntake.massNotRecorded');
        const submit = async () => { tree = h.render(props); await button(tree, 'Submit Consignment').props.onClick();
            return h.axios.post.mock.calls.filter(([url]) => url === '/api/reception/consignments').at(-1)[1]; };
        let payload = await submit();
        expect(payload.samples[0]).toMatchObject({ receivedMass: null, moistureOnArrival: null, massWarningAcknowledged: false, positionalUncertaintyM: null });
        expect(payload.bulkApplications).toEqual([]);
        button(h.render(props), 'batchIntake.applyToAll').props.onClick();
        tree = h.render(props);
        field(tree, 'batchIntake.massToApply').props.onChange({ target: { value: '650' } });
        payload = await submit();
        expect(payload.samples[0]).toMatchObject({ receivedMass: 550, moistureOnArrival: 'MOIST', massWarningAcknowledged: false });
        expect(payload.defaults).not.toHaveProperty('receivedMass');
        expect(payload.bulkApplications).toEqual([{ fields: { receivedMass: 550, moistureOnArrival: 'MOIST' }, sampleIds: ['bag-1'] }]);
    });
    test('a low-mass row is visibly warned, acknowledgement is explicit, and editing its mass resets it', async () => {
        const h = harness('BatchIntake'), props = { analysisGroups: [{ id: 'group', analyses: ['PH_H2O'] }] };
        let tree = h.render(props);
        elements(tree, node => node.type === h.children.ManifestImportModal)[0].props.onImport([{ originalId: 'low', status: 'ACCEPTED', receivedMass: 60 }]);
        h.render(props); await settle(); tree = h.render(props);
        expect(text(tree)).toContain('batchIntake.massDeficit');
        let checkbox = elements(tree, node => node.type === 'input' && node.props.type === 'checkbox')[0];
        expect(checkbox.props.checked).toBe(false);
        checkbox.props.onChange({ target: { checked: true } });
        tree = h.render(props); await button(tree, 'Submit Consignment').props.onClick();
        expect(h.axios.post.mock.calls.filter(([url]) => url === '/api/reception/consignments').at(-1)[1].samples[0].massWarningAcknowledged).toBe(true);
        tree = h.render(props); elements(tree, node => node.props?.title === 'Edit / Record Exception')[0].props.onClick();
        tree = h.render(props); elements(tree, node => node.type === h.children.BatchExceptionModal)[0].props.onSave({ originalId: 'low', status: 'ACCEPTED', receivedMass: 70 });
        checkbox = elements(h.render(props), node => node.type === 'input' && node.props.type === 'checkbox')[0];
        expect(checkbox.props.checked).toBe(false);
    });
    test('opening and saving the row editor never invents moisture', () => {
        const h = harness('BatchExceptionModal'), save = jest.fn();
        const tree = h.render({ isOpen: true, sample: { originalId: 'blank', receivedMass: null, moistureOnArrival: null }, onSave: save, onClose() {} });
        expect(elements(tree, node => node.type === 'select').some(node => node.props.value === '')).toBe(true);
        elements(tree, node => node.type === 'button' && node.props.onClick?.name === 'handleApply')[0].props.onClick();
        expect(save).toHaveBeenCalledWith(expect.objectContaining({ receivedMass: null, moistureOnArrival: null }));
    });
    test.each([false, true])('manifest preview ignores coordinate-derived accuracy and retains an explicitly mapped value (%s)', supplied => {
        const h = harness('ManifestImportModal');
        h.states[0] = 2; h.states[4] = [{ id: 'bag', coordinates: '14.5, -89.4', accuracy: 8.4 }];
        h.states[5] = ['id', 'coordinates', 'accuracy'];
        h.states[6] = { sampleId: 'id', coordinates: 'coordinates', ...(supplied ? { positionalUncertaintyM: 'accuracy' } : {}) };
        const tree = h.render({ isOpen: true, onClose() {}, onImport() {} });
        button(tree, 'Preview & Validate').props.onClick();
        expect(h.states[7][0].positionalUncertaintyM).toBe(supplied ? 8.4 : null);
    });
    test('all five locales provide the observation and warning labels', () => {
        const keys = Object.keys(require('../../../client/src/translations/en.json').batchIntake);
        for (const locale of ['en', 'es', 'es-419', 'fr', 'pt']) {
            const labels = require(`../../../client/src/translations/${locale}.json`).batchIntake;
            expect(Object.keys(labels)).toEqual(keys);
            expect(Object.values(labels).every(value => typeof value === 'string' && value.length)).toBe(true);
        }
    });
});
