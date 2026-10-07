const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const React = require('../../../client/node_modules/react');
const esbuild = require('../../../client/node_modules/esbuild');
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : !node || typeof node !== 'object' ? [] : [node, ...nodes(node.props?.children)];
function mount(batch) {
    const hooks = [], effects = []; let cursor = 0, tree;
    const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => value === b[index]);
    const react = { ...React, useState(initial) { const index = cursor++; if (!(index in hooks)) hooks[index] = { value: initial };
        return [hooks[index].value, value => { hooks[index].value = typeof value === 'function' ? value(hooks[index].value) : value; }]; },
    useEffect(effect, deps) { const index = cursor++; if (!same(hooks[index]?.deps, deps)) effects.push(effect); hooks[index] = { deps }; } };
    const axios = { put: jest.fn(async () => ({ data: { batch: { result: 'PASS' } } })), post: jest.fn(async () => ({ data: { batch: { result: batch.result } } })) };
    const props = { batch, referenceMaterials: [], loading: false, onChanged: jest.fn(), setError: jest.fn(), setLoading: jest.fn(), setSuccessMsg: jest.fn() };
    const module = { exports: {} };
    vm.runInNewContext(esbuild.transformSync(fs.readFileSync(path.resolve(__dirname, '../../../client/src/components/workbench/NativeRunPanel.jsx'), 'utf8'), { loader: 'jsx', format: 'cjs' }).code,
        { module, exports: module.exports, require(name) { if (name === 'react') return react; if (name === 'axios') return axios;
            if (name.includes('LanguageContext')) return { useLanguage: () => ({ t: key => key }) };
            if (name === '@lims/number-parse') return require('../../../shared/numberParse'); if (name === './NumberPreview') return () => null;
            throw Error(`Unexpected Native component import ${name}`); } });
    return { axios, props, async render(patch = {}) { Object.assign(props, patch); for (let index = 0; index < 3; index++) { cursor = 0;
        tree = module.exports.default(props); effects.splice(0).forEach(effect => effect()); await new Promise(resolve => setImmediate(resolve)); } },
    find: id => nodes(tree).find(node => node.props?.['data-testid'] === id), all: () => nodes(tree) };
}
function fixture({ started = true, mode = 'REQUIRED_BLOCKING', measured = false } = {}) {
    const sample = { id: 'sample', position: 3, kind: 'SAMPLE', sampleId: 's' }, duplicate = { id: 'duplicate', position: 4, kind: 'DUPLICATE', sampleId: 's', duplicateOfPositionId: 'sample' };
    const positions = mode === 'OFF' ? [sample] : [{ id: 'blank', position: 1, kind: 'BLANK' }, { id: 'lrm', position: 2, kind: 'LRM', references: [] }, sample, duplicate];
    return { id: 'native-run', analysis: 'A', status: 'OPEN', startedAt: started ? '2026-10-07T00:00:00Z' : null, positions,
        analytes: [{ id: 'a', analysisCode: 'A', status: 'QC_PENDING', provenance: 'NATIVE', qcMode: mode,
            numberFormat: { decimal: '.', thousands: null }, positions,
            measurements: measured ? [{ id: 'old-blank', positionId: 'blank', replicateNo: 1, value: 0.0123456789, rawInput: '0.0123456789' }] : [] }] };
}

test('Native form starts with empty observations, requires start, and drags actual complete position ids', async () => {
    const view = mount(fixture({ started: false })); await view.render();
    for (const id of ['blank', 'lrm', 'sample', 'duplicate']) {
        const input = view.find(`native-value-${id}`); expect(input.props.value).toBe(''); expect(input.props.disabled).toBeTruthy();
    }
    await view.find('native-run-start').props.onClick(); expect(view.axios.post).toHaveBeenCalledWith('/api/qc/batches/native-run/start', {});
    view.find('native-position-duplicate').props.onDragStart(); await view.render();
    view.find('native-position-lrm').props.onDrop({ preventDefault: jest.fn() }); await view.render();
    expect(view.axios.post).toHaveBeenCalledWith('/api/qc/batches/native-run/reorder', { positionIds: ['blank', 'duplicate', 'lrm', 'sample'] });
    // The server owns structural refusal; the UI submits real ids unchanged.
});

test('partial entry sends only the actual position and exact raw observation; malformed numbers cannot be saved', async () => {
    const view = mount(fixture()); await view.render();
    view.find('native-value-blank').props.onChange({ target: { value: 'bad number' } }); await view.render();
    expect(view.find('native-qc-save').props.disabled).toBe(true);
    view.find('native-value-blank').props.onChange({ target: { value: '0.0123456789' } }); await view.render();
    expect(view.find('native-qc-save').props.disabled).toBeFalsy(); await view.find('native-qc-save').props.onClick();
    expect(view.axios.put).toHaveBeenCalledWith('/api/qc/batches/native-run', { analysisCode: 'A', measurements: [{ positionId: 'blank', replicateNo: 1, rawInput: '0.0123456789' }], references: [] });
    expect(view.props.onChanged).toHaveBeenCalled();
});

test('recorded observations stay read-only until a reasoned correction is selected', async () => {
    const view = mount(fixture({ measured: true })); await view.render();
    expect(view.find('native-value-blank')).toBeUndefined();
    const check = view.all().find(node => node.type === 'input' && node.props.type === 'checkbox');
    check.props.onChange({ target: { checked: true } }); await view.render();
    expect(view.find('native-value-blank').props.value).toBe('');
    view.find('native-value-blank').props.onChange({ target: { value: '0.0223456789' } }); await view.render();
    expect(view.find('native-qc-save').props.disabled).toBeTruthy();
    view.find('native-correction-reason').props.onChange({ target: { value: 'Verified worksheet transcription' } }); await view.render();
    await view.find('native-qc-save').props.onClick();
    expect(view.axios.post).toHaveBeenCalledWith('/api/qc/batches/native-run/corrections', { analysisCode: 'A', corrections: [{ positionId: 'blank', replicateNo: 1, rawInput: '0.0223456789' }], references: [], reason: 'Verified worksheet transcription' });
});

test('accepted QC requires reasoned reopen and OFF evaluation sends zero invented readings', async () => {
    const batch = fixture({ measured: true }); batch.status = 'QC_PASS'; batch.analytes[0].status = 'QC_PASS';
    const accepted = mount(batch); await accepted.render();
    expect(accepted.find('native-run-reopen').props.disabled).toBe(true);
    accepted.find('native-correction-reason').props.onChange({ target: { value: 'Review correction before re-entry' } }); await accepted.render();
    await accepted.find('native-run-reopen').props.onClick();
    expect(accepted.axios.put).toHaveBeenCalledWith('/api/qc/batches/native-run', { status: 'OPEN', reason: 'Review correction before re-entry' });
    const off = mount(fixture({ mode: 'OFF' })); await off.render();
    expect(off.find('native-qc-not-required')).toBeDefined(); expect(off.all().filter(node => node.type === 'input')).toHaveLength(0);
    await off.find('native-qc-evaluate').props.onClick();
    expect(off.axios.post).toHaveBeenCalledWith('/api/qc/batches/native-run/evaluate', { analysisCode: 'A', measurements: [], references: [] });
    expect(off.props.setSuccessMsg).toHaveBeenCalledWith('qcRuns.notRequired');
});
