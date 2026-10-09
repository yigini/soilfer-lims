const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const React = require('../../../client/node_modules/react');
const esbuild = require('../../../client/node_modules/esbuild');
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : !node || typeof node !== 'object' ? [] : [node, ...nodes(node.props?.children)];
function mount(batch) {
    const hooks = [], effects = []; let cursor = 0, tree;
    const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => value === b[index]);
    const react = { ...React, useState(initial) { const index = cursor++; if (!(index in hooks)) hooks[index] = { value: initial };
        return [hooks[index].value, value => { hooks[index].value = typeof value === 'function' ? value(hooks[index].value) : value; }]; },
    useEffect(effect, deps) { const index = cursor++; if (!same(hooks[index]?.deps, deps)) effects.push(effect); hooks[index] = { deps }; },
    useRef(initial) { const index = cursor++; if (!(index in hooks)) hooks[index] = { current: initial }; return hooks[index]; } };
    const axios = { put: jest.fn(async () => ({ data: { batch: { result: 'PASS' } } })), post: jest.fn(async () => ({ data: { batch: { result: batch.result } } })) };
    const props = { batch, referenceMaterials: [], loading: false, onChanged: jest.fn(), setError: jest.fn(), setLoading: jest.fn(), setSuccessMsg: jest.fn() };
    const module = { exports: {} };
    vm.runInNewContext(esbuild.transformSync(fs.readFileSync(path.resolve(__dirname, '../../../client/src/components/workbench/NativeRunPanel.jsx'), 'utf8'), { loader: 'jsx', format: 'cjs' }).code,
        { module, exports: module.exports, require(name) { if (name === 'react') return react; if (name === 'axios') return axios;
            if (name.includes('LanguageContext')) return { useLanguage: () => ({ t: key => key }) };
            if (name === '@lims/number-parse') return require('../../../shared/numberParse'); if (name === './NumberPreview') return () => null;
            if (name === './qcWorksheetNavigation') {
                const navigation = { exports: {} };
                const source = fs.readFileSync(path.resolve(__dirname, '../../../client/src/components/workbench/qcWorksheetNavigation.js'), 'utf8');
                vm.runInNewContext(esbuild.transformSync(source, { loader: 'js', format: 'cjs' }).code,
                    { module: navigation, exports: navigation.exports });
                return navigation.exports;
            }
            if (name === './BarcodeSafeInput') {
                const child = { exports: {} };
                const source = fs.readFileSync(path.resolve(__dirname, '../../../client/src/components/workbench/BarcodeSafeInput.jsx'), 'utf8');
                vm.runInNewContext(esbuild.transformSync(source, { loader: 'jsx', format: 'cjs' }).code,
                    { module: child, exports: child.exports, Date, setTimeout, clearTimeout,
                        require(dependency) { if (dependency === 'react') return react; throw Error(`Unexpected barcode input import ${dependency}`); } });
                return child.exports;
            }
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
    expect(accepted.axios.put).toHaveBeenCalledWith('/api/qc/batches/native-run', { analysisCode: 'A', status: 'OPEN', reason: 'Review correction before re-entry' });
    const off = mount(fixture({ mode: 'OFF' })); await off.render();
    expect(off.find('native-qc-not-required')).toBeDefined(); expect(off.all().filter(node => node.type === 'input')).toHaveLength(0);
    await off.find('native-qc-evaluate').props.onClick();
    expect(off.axios.post).toHaveBeenCalledWith('/api/qc/batches/native-run/evaluate', { analysisCode: 'A', measurements: [], references: [] });
    expect(off.props.setSuccessMsg).toHaveBeenCalledWith('qcRuns.notRequired');
});

test('a failed sibling does not lock the selected analyte’s entry, reopen or close handlers', async () => {
    const batch = fixture(); batch.status = 'QC_FAIL'; batch.analytes[0].status = 'QC_FAIL';
    batch.analytes[0].disposition = { decision: 'REANALYZE_BATCH' };
    batch.analytes.push({ ...batch.analytes[0], id: 'b', analysisCode: 'B', status: 'QC_PENDING', disposition: null });
    const view = mount(batch); await view.render();
    expect(view.find('native-value-blank').props.disabled).toBe(true);
    view.find('native-analysis-select').props.onChange({ target: { value: 'B' } }); await view.render();
    view.find('native-value-blank').props.onChange({ target: { value: '0.0123456789' } }); await view.render();
    expect(view.find('native-qc-save').props.disabled).toBeFalsy(); await view.find('native-qc-save').props.onClick();
    expect(view.axios.put).toHaveBeenCalledWith('/api/qc/batches/native-run', { analysisCode: 'B', measurements: [{ positionId: 'blank', replicateNo: 1, rawInput: '0.0123456789' }], references: [] });
    batch.analytes[1].status = 'QC_PASS'; await view.render();
    view.find('native-correction-reason').props.onChange({ target: { value: 'Recheck B evidence' } }); await view.render();
    await view.find('native-run-reopen').props.onClick();
    expect(view.axios.put).toHaveBeenCalledWith('/api/qc/batches/native-run', { analysisCode: 'B', status: 'OPEN', reason: 'Recheck B evidence' });
    await view.find('native-analyte-close').props.onClick();
    expect(view.axios.put).toHaveBeenCalledWith('/api/qc/batches/native-run', { analysisCode: 'B', status: 'CLOSED' });
    expect(batch.analytes[0]).toMatchObject({ status: 'QC_FAIL', disposition: { decision: 'REANALYZE_BATCH' } });
});

const contents = node => Array.isArray(node) ? node.map(contents).join('') : !node || typeof node !== 'object'
    ? String(node ?? '') : contents(node.props?.children);
const previewReply = (status = 'FAIL') => ({ data: { preview: true, analytes: [{ analysisCode: 'A', verdict: status,
    positions: [{ positionId: 'blank', expected: 0, limits: { maxAllowed: 0.037123456789 }, status,
        criterion: 'LOQ_FROZEN', failAction: 'FAIL' }] }] } });

test('QC preview runs on cell commit only and sends exact raw observations without client limits', async () => {
    const view = mount(fixture()); await view.render();
    view.axios.post.mockResolvedValue(previewReply());
    view.find('native-value-blank').props.onChange({ target: { value: '0.04123456789' } }); await view.render();
    expect(view.axios.post).not.toHaveBeenCalled();
    await view.find('native-value-blank').props.onBlur(); await view.render();
    expect(view.axios.post).toHaveBeenCalledTimes(1);
    expect(view.axios.post).toHaveBeenCalledWith('/api/qc/batches/native-run/preview',
        [{ analysisCode: 'A', positionId: 'blank', rawInput: '0.04123456789' }]);
    expect(view.axios.put).not.toHaveBeenCalled();
    expect(contents(view.find('native-qc-preview-verdict'))).toBe('qcWorksheet.preview: FAIL');
    const evidence = view.find('native-evidence-blank');
    expect(contents(evidence)).toContain('0.037123456789');
    expect(contents(evidence)).toContain('LOQ_FROZEN');
    expect(contents(evidence)).toContain('qcWorksheet.preview: FAIL');
    expect(nodes(evidence).some(node => ['input', 'select', 'textarea'].includes(node.type))).toBe(false);
    expect(nodes(evidence).some(node => node.props?.className?.includes('text-red-700'))).toBe(true);
});

test('typing another value discards the old preview and a late response cannot recolour the cell', async () => {
    const view = mount(fixture()); await view.render();
    let completeOld;
    view.axios.post.mockImplementationOnce(() => new Promise(resolve => { completeOld = resolve; }));
    view.find('native-value-blank').props.onChange({ target: { value: '0.02' } }); await view.render();
    const oldRequest = view.find('native-value-blank').props.onBlur();
    view.find('native-value-blank').props.onChange({ target: { value: '0.09' } }); await view.render();
    completeOld(previewReply('PASS')); await oldRequest; await view.render();
    expect(view.find('native-qc-preview-verdict')).toBeUndefined();
    view.axios.post.mockResolvedValueOnce(previewReply('FAIL'));
    await view.find('native-value-blank').props.onBlur(); await view.render();
    expect(contents(view.find('native-qc-preview-verdict'))).toContain('FAIL');
    expect(view.axios.post.mock.calls[1][1][0].rawInput).toBe('0.09');
});

test('real submission discards preview and renders only the refetched stored verdict and limits', async () => {
    const batch = fixture(), view = mount(batch); await view.render();
    view.axios.post.mockResolvedValue(previewReply('PASS'));
    view.find('native-value-blank').props.onChange({ target: { value: '0.02' } }); await view.render();
    await view.find('native-value-blank').props.onBlur(); await view.render();
    expect(contents(view.find('native-qc-preview-verdict'))).toContain('PASS');
    await view.find('native-qc-save').props.onClick(); await view.render();
    expect(view.find('native-qc-preview-verdict')).toBeUndefined();
    batch.analytes[0].evaluation = { id: 'stored-after-submit', details: JSON.stringify({ evaluation: {
        blanks: [{ positionId: 'blank', value: 0.02, status: 'FAIL', maxAllowed: '0.011234567890', criterion: 'STORED_ONLY' }] } }) };
    await view.render();
    const evidence = view.find('native-evidence-blank');
    expect(contents(evidence)).toContain('qcWorksheet.verdict: FAIL');
    expect(contents(evidence)).toContain('0.011234567890');
    expect(contents(evidence)).toContain('STORED_ONLY');
    expect(contents(evidence)).not.toContain('qcWorksheet.preview');
    expect(view.props.onChanged).toHaveBeenCalled();
});

test('switching runs invalidates the previous in-flight preview', async () => {
    const view = mount(fixture()); await view.render();
    let completeOld;
    view.axios.post.mockImplementationOnce(() => new Promise(resolve => { completeOld = resolve; }));
    view.find('native-value-blank').props.onChange({ target: { value: '0.02' } }); await view.render();
    const request = view.find('native-value-blank').props.onBlur();
    await view.render({ batch: { ...fixture(), id: 'another-run' } });
    completeOld(previewReply('PASS')); await request; await view.render();
    expect(view.find('native-qc-preview-verdict')).toBeUndefined();
    expect(view.find('native-value-blank').props.value).toBe('');
});

test('preview errors retain the entered observation and cannot submit or colour it as a pass', async () => {
    const view = mount(fixture()); await view.render();
    view.axios.post.mockRejectedValue({ response: { data: { code: 'QC_PREVIEW_UNAVAILABLE', error: 'Frozen criteria unavailable' } } });
    view.find('native-value-blank').props.onChange({ target: { value: '0.02' } }); await view.render();
    await view.find('native-value-blank').props.onBlur(); await view.render();
    expect(contents(view.find('native-qc-preview-error'))).toContain('qcRuns.errors.QC_PREVIEW_UNAVAILABLE');
    expect(view.find('native-value-blank').props.value).toBe('0.02');
    expect(view.find('native-qc-preview-verdict')).toBeUndefined();
    expect(view.axios.put).not.toHaveBeenCalled();
    expect(view.axios.post.mock.calls.every(([url]) => url.endsWith('/preview'))).toBe(true);
});

test('a stored evaluation without a limit never invents a policy or recomputes its status', async () => {
    const batch = fixture();
    batch.analytes[0].evaluation = { id: 'missing-limit', details: JSON.stringify({ evaluation: {
        blanks: [{ positionId: 'blank', value: 0, status: 'FAIL' }] } }) };
    const view = mount(batch); await view.render();
    const evidence = view.find('native-evidence-blank');
    expect(contents(evidence)).toContain('qcWorksheet.limits: qcWorksheet.notStored');
    expect(contents(evidence)).toContain('qcWorksheet.verdict: FAIL');
    expect(nodes(evidence).some(node => node.type === 'input')).toBe(false);
    expect(view.axios.post).not.toHaveBeenCalled();
});

test('the native grid opens with one row per real position, empty QC parent observation and no automatic requests', async () => {
    const batch = fixture(); batch.workItems = [{ sampleId: 's', sample: { originalId: 'SERVER-SAMPLE' }, draft: { value: '91' } }];
    const view = mount(batch); await view.render();
    expect(view.all().filter(node => node.type === 'table')).toHaveLength(1);
    expect(view.all().filter(node => String(node.props?.['data-testid'] || '').startsWith('native-position-'))).toHaveLength(batch.positions.length);
    expect(view.find('native-value-sample').props.value).toBe('');
    expect(view.find('native-value-sample').props['aria-label']).toContain('qcWorksheet.parentObservation');
    expect(view.find('native-qc-evaluate').props.disabled).toBe(true);
    await view.find('native-qc-evaluate').props.onClick();
    expect(view.axios.post).not.toHaveBeenCalled(); expect(view.axios.put).not.toHaveBeenCalled();
    expect(view.all().some(node => node.type === 'select' && String(node.props?.['data-testid'] || '').includes('parent'))).toBe(false);
});

test('every required cell is needed for evaluate and the zero/comma payload contains only raw measurements', async () => {
    const batch = fixture(); batch.analytes[0].numberFormat = { decimal: ',', thousands: null };
    const view = mount(batch); await view.render();
    for (const [id, raw] of [['blank', '0'], ['lrm', '7,03'], ['sample', '7,03']]) {
        view.find(`native-value-${id}`).props.onChange({ target: { value: raw } }); await view.render();
    }
    expect(view.find('native-qc-evaluate').props.disabled).toBe(true);
    await view.find('native-qc-evaluate').props.onClick(); expect(view.axios.post).not.toHaveBeenCalled();
    view.find('native-value-duplicate').props.onChange({ target: { value: '7,03' } }); await view.render();
    expect(view.find('native-qc-evaluate').props.disabled).toBe(false);
    await view.find('native-qc-evaluate').props.onClick();
    expect(view.axios.post).toHaveBeenCalledWith('/api/qc/batches/native-run/evaluate', { analysisCode: 'A', references: [], measurements: [
        { positionId: 'blank', replicateNo: 1, rawInput: '0' }, { positionId: 'lrm', replicateNo: 1, rawInput: '7,03' },
        { positionId: 'sample', replicateNo: 1, rawInput: '7,03' }, { positionId: 'duplicate', replicateNo: 1, rawInput: '7,03' }
    ] });
    expect(JSON.stringify(view.axios.post.mock.calls[0][1])).not.toMatch(/referenceUse|expected|methodologyId|referenceMaterialId|referenceValueId|duplicateOfPositionId/);
});

test('reference correction stays in setup and the grid refetches the new server-bound certificate without editable reference fields', async () => {
    const batch = fixture(), lrm = batch.positions.find(row => row.id === 'lrm');
    lrm.references = [{ id: 'binding', analysisCode: 'A', referenceMaterialId: 'old-lot', referenceSnapshot: JSON.stringify({ code: 'OLD', lotNumber: '7', expected: 7.123456 }) }];
    const view = mount(batch); await view.render({ referenceMaterials: [
        { id: 'new-lot', kind: 'LRM', code: 'NEW', lotNumber: '8', eligible: true },
        { id: 'ineligible', kind: 'LRM', code: 'INELIGIBLE', lotNumber: '9', eligible: false }
    ] });
    expect(nodes(view.find('native-lot-lrm')).find(node => node.type === 'option' && node.props.value === 'ineligible').props.disabled).toBe(true);
    expect(contents(view.find('native-reference-lrm'))).toContain('OLD');
    view.find('native-lot-lrm').props.onChange({ target: { value: 'new-lot' } }); await view.render();
    expect(view.find('native-bindings-save').props.disabled).toBe(true);
    view.find('native-correction-reason').props.onChange({ target: { value: 'Reviewed certificate correction' } }); await view.render();
    view.props.onChanged.mockImplementation(async () => {
        lrm.references = [{ id: 'corrected-binding', analysisCode: 'A', referenceMaterialId: 'new-lot', referenceSnapshot: JSON.stringify({ code: 'NEW-SERVER', lotNumber: '8', expected: 8.7654321 }) }];
        batch.analytes[0].evaluation = { id: 'corrected-evaluation', details: JSON.stringify({ evaluation: {
            controls: [{ positionId: 'lrm', expected: 8.7654321, minRecovery: 83.2345, maxRecovery: 117.8765, status: 'INCOMPLETE' }] } }) };
    });
    await view.find('native-bindings-save').props.onClick(); await view.render();
    expect(view.axios.post).toHaveBeenCalledWith('/api/qc/batches/native-run/corrections', { analysisCode: 'A', corrections: [],
        references: [{ positionId: 'lrm', referenceMaterialId: 'new-lot' }], reason: 'Reviewed certificate correction' });
    expect(contents(view.find('native-reference-lrm'))).toContain('NEW-SERVER');
    const evidence = view.find('native-evidence-lrm');
    expect(contents(evidence)).toContain('8.7654321'); expect(contents(evidence)).toContain('83.2345'); expect(contents(evidence)).toContain('117.8765');
    for (const cell of [view.find('native-reference-lrm'), evidence]) expect(nodes(cell).some(node => ['input', 'select', 'textarea'].includes(node.type))).toBe(false);
    expect(view.find('native-qc-preview-verdict')).toBeUndefined();
});
