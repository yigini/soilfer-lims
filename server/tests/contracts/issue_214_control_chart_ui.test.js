const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const React = require('../../../client/node_modules/react'), esbuild = require('../../../client/node_modules/esbuild');
const { nodes, content } = require('../helpers/qcWorksheetUi');
const root = path.resolve(__dirname, '../../../client/src');
const english = JSON.parse(fs.readFileSync(path.join(root, 'translations/en.json'), 'utf8'));
const t = key => key.split('.').reduce((v, part) => v?.[part], english) || key;
const series = { labId: 'lab', analysisCode: 'A', methodologyId: 'method', referenceMaterialId: 'lot', referenceName: 'Control', lotNumber: 'LOT-1' };
const basis = { mode: 'PROVISIONAL', key: 'provisional', fixedWindow: { expected: 100, lower: 90, upper: 110 } };
function chart(patch = {}) { return { series, minimumPoints: 2, provisional: true, current: null, sets: [], proposals: [], canPropose: true, canApprove: true,
    points: [99, 101, 102].map((value, index) => ({ measurementId: `m${index}`, value, executionTime: '2026-10-13T12:00:00Z', sequenceIndex: index + 1,
        basis, basisKey: basis.key, inControl: true, verdict: 'PASS' })), ...patch }; }
function host(data = chart(), { username = 'proposer', canRead = true, obligations = [] } = {}) {
    const hooks = [], effects = [], same = (a, b) => a && b && a.length === b.length && a.every((v, i) => v === b[i]);
    let cursor = 0, tree, props = { labId: 'lab' };
    const react = { ...React,
        useState(value) { const i = cursor++; if (!hooks[i]) hooks[i] = { value }; return [hooks[i].value, next => { hooks[i].value = typeof next === 'function' ? next(hooks[i].value) : next; }]; },
        useRef(value) { const i = cursor++; return hooks[i] || (hooks[i] = { current: value }); },
        useEffect(fn, deps) { const i = cursor++; if (!same(hooks[i]?.deps, deps)) { const old = hooks[i]; hooks[i] = { deps }; effects.push(() => { old?.cleanup?.(); hooks[i].cleanup = fn(); }); } },
        useCallback(fn, deps) { const i = cursor++; if (!same(hooks[i]?.deps, deps)) hooks[i] = { deps, value: fn }; return hooks[i].value; },
        useMemo(fn, deps) { const i = cursor++; if (!same(hooks[i]?.deps, deps)) hooks[i] = { deps, value: fn() }; return hooks[i].value; }
    };
    const axios = { get: jest.fn(async url => ({ data: url === '/api/qc/control-charts/series' ? { series: [series] } : url === '/api/qc/control-reviews' ? { obligations, canResolve: true } : data })), post: jest.fn().mockResolvedValue({ data: {} }) };
    const module = { exports: {} };
    vm.runInNewContext(esbuild.transformSync(fs.readFileSync(path.join(root, 'components/qc/ControlCharts.jsx'), 'utf8'), { loader: 'jsx', format: 'cjs' }).code,
        { module, exports: module.exports, require(name) {
            if (name === 'react') return react; if (name === 'axios') return axios;
            if (name.includes('AuthContext')) return { useAuth: () => ({ user: { username }, hasPermission: () => canRead }) };
            if (name.includes('LanguageContext')) return { useLanguage: () => ({ t }) };
            throw Error('Unexpected chart dependency ' + name);
        } });
    return { axios, exports: module.exports,
        async render(patch = {}) { props = { ...props, ...patch }; for (let round = 0; round < 6; round++) { cursor = 0; tree = module.exports.default(props); effects.splice(0).forEach(fn => fn()); await new Promise(resolve => setImmediate(resolve)); } return tree; },
        all: () => nodes(tree), text: () => content(tree),
        field(label) { return nodes(tree).find(node => node.props?.['aria-label'] === label); },
        button(label) { return nodes(tree).find(node => node.type === 'button' && content(node) === label); },
        async choose() { await this.render(); nodes(tree).find(node => node.type === 'select').props.onChange({ target: { value: '0' } }); await this.render(); }
    };
}

test('chart requests use the chosen lab and exact series; reading permission hides all requests and actions', async () => {
    const denied = host(chart(), { canRead: false }); expect(await denied.render()).toBeNull(); expect(denied.axios.get).not.toHaveBeenCalled();
    const h = host(); await h.choose();
    expect(h.axios.get).toHaveBeenCalledWith('/api/qc/control-charts/series', { params: { labId: 'lab' } });
    expect(h.axios.get).toHaveBeenCalledWith('/api/qc/control-charts', { params: series });
    expect(h.text()).toContain('Provisional'); expect(h.text()).toContain('99'); expect(h.text()).toContain('m0');
});
test('baseline exclusions require a reason and submit selected identities without changing values', async () => {
    const h = host(); await h.choose(); h.field('Selected m0').props.onChange({ target: { checked: false } }); await h.render();
    const reason = h.field('Exclusion reason m0'); expect(reason.props.required).toBe(true); reason.props.onChange({ target: { value: 'Reviewed transcription' } }); await h.render();
    const note = h.all().find(node => node.type === 'textarea'); note.props.onChange({ target: { value: 'Trial baseline' } }); await h.render();
    await h.all().find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
    expect(h.axios.post).toHaveBeenCalledWith('/api/qc/control-limit-proposals', { ...series, reason: 'Trial baseline', selectedMeasurementIds: ['m1', 'm2'], exclusions: [{ measurementId: 'm0', reason: 'Reviewed transcription' }] });
});
test('a trial outlier stays selected until the proposer explicitly excludes it', async () => {
    const points = Array.from({ length: 12 }, (_, i) => ({ ...chart().points[0], measurementId: `trial${i}`, value: i === 11 ? 100 : 0 }));
    const h = host(chart({ points })); await h.choose();
    expect(h.text()).toContain('Trial outlier: review this point'); expect(h.field('Selected trial11').props.checked).toBe(true);
    expect(h.all().filter(row => row.type === 'input' && row.props.type === 'checkbox' && row.props.checked)).toHaveLength(12);
});
test('proposal approval is hidden from its own proposer and visible to a different named approver', async () => {
    const proposal = { id: 'proposal', proposedBy: 'proposer', proposedAt: 'retained-time', mean: 100, sd: 1, n: 2, selectionSnapshot: [{ measurementId: 'm0', selected: false, value: 99, exclusionReason: 'Retained reason' }] };
    const own = host(chart({ proposals: [proposal] })); await own.choose(); expect(own.button('Approve limits')).toBeUndefined(); expect(own.text()).toContain('Retained reason');
    const other = host(chart({ proposals: [proposal] }), { username: 'manager' }); await other.choose(); await other.button('Approve limits').props.onClick();
    expect(other.axios.post).toHaveBeenCalledWith('/api/qc/control-limit-proposals/proposal/approve', {});
});
test('review resolution requires a note and posts the explicit outcome without touching a run verdict', async () => {
    const row = { id: 'review', rule: '4-1s', evaluationId: 'evaluation', evaluation: { analysisCode: 'A' }, status: 'OPEN', resolutions: [], evidenceSnapshot: [] };
    const h = host(chart(), { obligations: [row] }); await h.render();
    const input = h.all().find(node => node.type === 'input'); expect(input.props.required).toBe(true); input.props.onChange({ target: { value: 'Investigate retained baseline' } }); await h.render();
    const form = h.all().find(node => node.type === 'form'); nodes(form).find(node => node.type === 'select').props.onChange({ target: { value: 'INVESTIGATE_NEW_LIMITS' } }); await h.render();
    await h.all().find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
    expect(h.axios.post).toHaveBeenCalledWith('/api/qc/control-reviews/review/resolve', { outcome: 'INVESTIGATE_NEW_LIMITS', note: 'Investigate retained baseline' });
    expect(h.axios.post).toHaveBeenCalledTimes(1);
});
test('plot draws mean, ±2s and ±3s from the selected stored set and labels every observation', () => {
    const h = host(), tree = h.exports.ControlChartPlot({ t, basis: { mode: 'CONTROL_CHART', mean: 100, sd: 1 }, points: chart().points });
    expect(nodes(tree).filter(row => row.type === 'line')).toHaveLength(5);
    expect(nodes(tree).filter(row => row.type === 'circle')).toHaveLength(3);
    for (const text of ['Mean', '+2s', '+3s', '−2s', '−3s', 'm0: 99']) expect(content(tree)).toContain(text);
});
test.each(['en', 'es', 'es-419', 'fr', 'pt'])('chart actions, statuses and policy keys exist in both %s catalogues', locale => {
    for (const directory of [path.join(root, 'translations'), path.resolve(__dirname, '../../locales')]) {
        const catalogue = JSON.parse(fs.readFileSync(path.join(directory, locale + '.json'), 'utf8'));
        for (const key of Object.keys(english.controlCharts).filter(key => key !== 'ruleStatus')) expect(catalogue.controlCharts[key]?.trim()).toBeTruthy();
        for (const key of Object.keys(english.controlCharts.ruleStatus)) expect(catalogue.controlCharts.ruleStatus[key]?.trim()).toBeTruthy();
        expect(catalogue.policies.review.trim()).toBeTruthy(); expect(catalogue.policies.keys.qc_controlChartMinPoints.trim()).toBeTruthy();
    }
});
