const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const React = require('../../../client/node_modules/react'), esbuild = require('../../../client/node_modules/esbuild');
const { nodes, content } = require('../helpers/qcWorksheetUi');
const english = require('../../../client/src/translations/en.json');
const t = (key, params = {}) => {
    const value = key.split('.').reduce((v, part) => v?.[part], english);
    return (value || (typeof params === 'string' ? params : key)).replace(/\{(\w+)\}/g, (_, name) => params[name]);
};
const series = { labId: 'lab', analysisCode: 'A', methodologyId: 'method', methodRevision: 1, analysisUnit: 'frozen-unit' };
const view = patch => ({ series, fingerprint: 'current-window', windowSize: 20, minimumPoints: 10, lodMultiplier: 3, loqMultiplier: 10,
    canPropose: true, excludedCounts: { UNIT_UNKNOWN: 2 }, proposals: [],
    points: Array.from({ length: 14 }, (_, i) => ({ measurementId: `m${i}`, evaluationId: 'evaluation', value: i + 1,
        executionTime: '2031-01-01T12:00:00Z', sequenceIndex: i + 1, analysisUnit: series.analysisUnit, blankStatus: 'FAIL', verdict: 'FAIL' })), ...patch });
function host(data = view(), { allowed = true, hold = false } = {}) {
    const hooks = [], effects = [], requests = []; let cursor = 0, tree, props = { labId: 'lab' };
    const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => value === b[i]);
    const react = { ...React,
        useState(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = { value: initial }; return [hooks[i].value, next => { hooks[i].value = typeof next === 'function' ? next(hooks[i].value) : next; }]; },
        useRef(value) { const i = cursor++; return hooks[i] || (hooks[i] = { current: value }); },
        useEffect(fn, deps) { const i = cursor++; if (!same(hooks[i]?.deps, deps)) { const old = hooks[i]; hooks[i] = { deps }; effects.push(() => { old?.cleanup?.(); hooks[i].cleanup = fn(); }); } },
        useCallback(fn, deps) { const i = cursor++; if (!same(hooks[i]?.deps, deps)) hooks[i] = { deps, value: fn }; return hooks[i].value; }
    };
    const axios = { get: jest.fn((url, options) => hold ? new Promise((resolve, reject) => requests.push({ url, options, resolve, reject }))
        : Promise.resolve({ data: url.endsWith('/series') ? { series: [{ ...series, methodName: 'Frozen method' }], excludedCounts: {} } : data })),
    post: jest.fn().mockResolvedValue({ data: { proposal: {} } }) };
    const module = { exports: {} }, root = path.resolve(__dirname, '../../../client/src');
    vm.runInNewContext(esbuild.transformSync(fs.readFileSync(path.join(root, 'components/qc/BlankHistory.jsx'), 'utf8'), { loader: 'jsx', format: 'cjs' }).code,
        { module, exports: module.exports, AbortController, crypto: { randomUUID }, require(name) {
            if (name === 'react') return react; if (name === 'axios') return axios;
            if (name.includes('AuthContext')) return { useAuth: () => ({ hasPermission: () => allowed }) };
            if (name.includes('LanguageContext')) return { useLanguage: () => ({ t }) };
            if (name === './ControlCharts') return { trialStatistics(points) {
                if (points.length < 2) return null;
                const mean = points.reduce((sum, row) => sum + row.value, 0) / points.length;
                return { mean, sd: Math.sqrt(points.reduce((sum, row) => sum + (row.value - mean) ** 2, 0) / (points.length - 1)) };
            } };
            throw Error('Unexpected blank-history import: ' + name);
        } });
    return { axios, requests,
        async render(patch = {}) { props = { ...props, ...patch }; for (let round = 0; round < 6; round++) { cursor = 0; tree = module.exports.default(props); effects.splice(0).forEach(fn => fn()); await new Promise(resolve => setImmediate(resolve)); } return tree; },
        all: () => nodes(tree), text: () => content(tree),
        field: label => nodes(tree).find(node => node.props?.['aria-label'] === label),
        async choose() { await this.render(); this.field('Blank-history series').props.onChange({ target: { value: '0' } }); await this.render(); },
        async reason(value) { nodes(tree).find(node => node.type === 'textarea').props.onChange({ target: { value } }); await this.render(); },
        async submit() { await nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); await this.render(); }
    };
}

test('all failed blank observations start selected; partial n, exclusions, frozen unit and deferred apply are visible without approval actions', async () => {
    const h = host(); await h.choose();
    expect(h.text()).toContain('n = 14 of 20'); expect(h.text()).toContain('Unknown frozen unit: 2');
    expect(h.text()).toContain('frozen-unit'); expect(h.text()).toContain('Proposal only.');
    expect(h.all().filter(node => node.props?.type === 'checkbox' && node.props.checked)).toHaveLength(14);
    expect(h.all().filter(node => node.type === 'button').map(content)).toEqual(['Record proposal']);
    const noWrite = host(view({ canPropose: false })); await noWrite.choose(); expect(noWrite.all().filter(node => node.type === 'button')).toHaveLength(0);
    const denied = host(view(), { allowed: false }); expect(await denied.render()).toBeNull(); expect(denied.axios.get).not.toHaveBeenCalled();
});

test('exclusion reasons and the proposal reason are mandatory; submit freezes the exact window and identities', async () => {
    const h = host(); await h.choose(); h.field('Selected m0').props.onChange({ target: { checked: false } }); await h.render();
    expect(h.field('Exclusion reason m0').props.required).toBe(true);
    await h.reason('Reviewed blank evidence'); expect(h.all().find(node => node.type === 'button').props.disabled).toBe(true);
    h.field('Exclusion reason m0').props.onChange({ target: { value: 'Documented contamination' } }); await h.render();
    expect(h.all().find(node => node.type === 'button').props.disabled).toBe(false); await h.submit();
    expect(h.axios.post).toHaveBeenCalledWith('/api/qc/lod-loq-proposals', expect.objectContaining({ ...series,
        reason: 'Reviewed blank evidence', fingerprint: 'current-window', requestId: expect.any(String),
        selectedMeasurementIds: view().points.slice(1).map(row => row.measurementId), exclusions: [{ measurementId: 'm0', reason: 'Documented contamination' }] }));
});

test('a failed POST keeps its reviewed window and uses the same request id on retry', async () => {
    const h = host(); await h.choose(); await h.reason('Reviewed blank evidence');
    h.axios.post.mockRejectedValue({ response: { data: { code: 'LOD_LOQ_HISTORY_CHANGED' } } });
    await h.submit(); await h.submit();
    expect(h.axios.post.mock.calls[0][1].requestId).toBe(h.axios.post.mock.calls[1][1].requestId);
    expect(h.text()).toContain('History or policy changed. Refresh and review again.');
    expect(h.text()).toContain('n = 14 of 20');
});

test('lab changes cancel GETs and prevent stale rows from becoming the next laboratory view', async () => {
    const h = host(view(), { hold: true }); await h.render();
    await h.render({ labId: 'other-lab' }); expect(h.requests[0].options.signal.aborted).toBe(true);
    h.requests[0].resolve({ data: { series: [{ ...series, methodName: 'STALE LAB' }], excludedCounts: {} } }); await h.render();
    expect(h.text()).not.toContain('STALE LAB');
    h.requests[1].resolve({ data: { series: [], excludedCounts: { UNIT_UNKNOWN: 3 } } }); await h.render();
    expect(h.text()).toContain('Unknown frozen unit: 3'); expect(h.axios.post).not.toHaveBeenCalled();
});

test('clearing a selected series ends history loading; failed reads stay errors and refresh performs a scoped read only', async () => {
    const h = host(); await h.choose();
    h.field('Blank-history series').props.onChange({ target: { value: '' } }); await h.render();
    expect(h.all().some(node => node.props?.role === 'status')).toBe(false);
    expect(h.text()).not.toContain('m0');
    const failed = host(view(), { hold: true }); await failed.render();
    failed.requests[0].reject(Error('Synthetic unavailable history')); await failed.render();
    expect(failed.all().some(node => node.props?.role === 'alert')).toBe(true);
    expect(failed.text()).not.toContain('No eligible blank series'); expect(failed.text()).not.toContain('No history exclusions.');
    failed.all().find(node => node.type === 'button' && content(node) === 'Refresh').props.onClick(); await failed.render();
    expect(failed.requests[1].options.params).toEqual({ labId: 'lab' }); expect(failed.axios.post).not.toHaveBeenCalled();
});

test('retained proposals display their original selection and reasons without an apply button', async () => {
    const h = host(view({ proposals: [{ id: 'p', series, n: 10, windowSize: 20, mean: 1, sd: 2, lod: 6, loq: 20,
        reason: 'Retained rationale', proposedBy: 'manager', proposedAt: 'retained-time',
        observations: [{ measurementId: 'old-m', evaluationId: 'old-e', value: 42, selected: false, exclusionReason: 'Retained exclusion' }] }] }));
    await h.choose(); expect(h.text()).toContain('Retained exclusion'); expect(h.text()).toContain('old-e'); expect(h.text()).toContain('n = 10 of 20');
    expect(h.all().filter(node => node.type === 'button').map(content)).toEqual(['Record proposal']);
});

test('the workflow is reachable and every string, exclusion and policy label exists in all five client/server catalogues', () => {
    const root = path.resolve(__dirname, '../../../client/src');
    expect(fs.readFileSync(path.join(root, 'components/admin/ReferenceMaterials.jsx'), 'utf8')).toContain('<BlankHistory labId={activeLabId} />');
    const flatten = object => Object.values(object).flatMap(value => typeof value === 'object' ? flatten(value) : [value]);
    for (const directory of [path.join(root, 'translations'), path.resolve(__dirname, '../../locales')]) for (const locale of ['en', 'es', 'es-419', 'fr', 'pt']) {
        const catalogue = JSON.parse(fs.readFileSync(path.join(directory, locale + '.json'), 'utf8'));
        expect(flatten(catalogue.blankHistory).every(value => typeof value === 'string' && value.trim())).toBe(true);
        expect(Object.keys(catalogue.blankHistory.exclusions)).toEqual(Object.keys(english.blankHistory.exclusions));
        for (const key of ['qc_blankHistoryWindow', 'qc_blankHistoryMinPoints', 'qc_blankLodMultiplier', 'qc_blankLoqMultiplier']) expect(catalogue.policies.keys[key]?.trim()).toBeTruthy();
    }
});
