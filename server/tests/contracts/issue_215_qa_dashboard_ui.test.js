const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const React = require('../../../client/node_modules/react');
const esbuild = require('../../../client/node_modules/esbuild');
const en = require('../../../client/src/translations/en.json');
const text = node => Array.isArray(node) ? node.map(text).join('') : !node || typeof node !== 'object' ? String(node ?? '') : text(node.props?.children);
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : !node || typeof node !== 'object' ? [] : [node, ...nodes(node.props?.children)];
function host() {
    const hooks = [], effects = [], requests = []; let cursor = 0, tree, props = {};
    const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => value === b[index]);
    const react = { ...React,
        useState(initial) { const index = cursor++; if (!(index in hooks)) hooks[index] = initial;
            return [hooks[index], value => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value; }]; },
        useEffect(callback, deps) { const index = cursor++; if (!same(hooks[index]?.deps, deps)) {
            hooks[index]?.cleanup?.(); hooks[index] = { deps }; effects.push(() => { hooks[index].cleanup = callback(); });
        } }
    };
    const axios = { get: jest.fn((url, options) => new Promise((resolve, reject) => requests.push({ url, options, resolve, reject }))) };
    const module = { exports: {} }, source = fs.readFileSync(path.resolve(__dirname, '../../../client/src/components/qc/QaOverview.jsx'), 'utf8');
    vm.runInNewContext(esbuild.transformSync(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' }).code, {
        module, exports: module.exports, AbortController, console, Intl, Date,
        require(name) {
            if (name === 'react') return react;
            if (name === 'react/jsx-runtime') return require('../../../client/node_modules/react/jsx-runtime');
            if (name === 'axios') return axios;
            if (name.includes('AuthContext')) return { useAuth: () => ({ token: 'owned-ui-token' }) };
            if (name.includes('LanguageContext')) return { useLanguage: () => ({ locale: 'en', t: (key, fallback) =>
                key.split('.').reduce((value, part) => value?.[part], en) ?? fallback ?? key }) };
            throw Error('Unexpected import ' + name);
        }
    });
    const expand = node => Array.isArray(node) ? node.map(expand) : !node || typeof node !== 'object' ? node
        : typeof node.type === 'function' ? expand(node.type(node.props)) : React.cloneElement(node, {}, expand(node.props?.children));
    return { requests, axios,
        async render(next = {}) { props = { ...props, ...next }; cursor = 0; tree = expand(module.exports.default(props));
            effects.splice(0).forEach(effect => effect()); await new Promise(resolve => setImmediate(resolve)); return tree; },
        async respond(index, data) { requests[index].resolve({ data }); await new Promise(resolve => setImmediate(resolve)); },
        find: id => nodes(tree).find(node => node.props?.['data-testid'] === id),
        all: () => nodes(tree), text: () => text(tree)
    };
}
const snapshot = (labId = 'a') => ({ lab: { id: labId }, laboratories: [{ id: 'a', name: 'Lab A' }, { id: 'b', name: 'Lab B' }],
    asOf: '2031-01-01T12:00:00Z', awaitingDisposition: 7, openNcrs: 2, expiringMaterials: [], calibrationDue: [],
    qcFailures: [{ analysisCode: 'PH', evaluated: 4, failed: 1, notEvaluable: 2, rate: 0.25 }],
    ptResults: [{ id: 'pt1', analysisCode: 'PH', date: '2030-12-01', zScore: 1.23456789, labResult: 12,
        provider: 'Provider', roundRef: 'Round', outcome: 'SATISFACTORY' },
    { id: 'pt2', analysisCode: 'PH', date: '2030-12-02', zScore: null, labResult: 10, provider: 'Provider', roundRef: 'Historical', outcome: 'SATISFACTORY' }],
    repeats: { byReason: [{ reason: 'PREP_ERROR', repeated: 1, executions: 4, rate: 0.25 }],
        byAnalystMethod: [{ analyst: null, methodologyId: null, methodRevision: null, repeated: 1, executions: 4, rate: 0.25 }] } });

test('overview renders the scoped rates, exclusions, unknown attribution and retained PT score without mutation calls', async () => {
    const view = host(); await view.render();
    expect(view.requests[0]).toMatchObject({ url: '/api/dashboard/qa', options: { params: { days: '30' } } });
    expect(view.all().some(node => node.props?.role === 'status')).toBe(true);
    await view.respond(0, snapshot()); await view.render();
    expect(view.text()).toContain('25%'); expect(view.text()).toContain('Not evaluable');
    expect(view.text()).toContain('Preparation error'); expect(view.text()).toContain('Unknown');
    expect(view.text()).toContain('1 / 4 (25%)');
    expect(view.all().filter(node => node.type === 'circle')).toHaveLength(1);
    expect(view.all().filter(node => node.type === 'title').map(text).join(' ')).toContain('1.23456789');
    expect(Object.keys(view.axios)).toEqual(['get']);
});

test('lab/window changes cancel stale responses, clear earlier lab values, and refresh a single selected scope', async () => {
    const view = host(); await view.render(); await view.respond(0, snapshot()); await view.render();
    view.find('qa-lab').props.onChange({ target: { value: 'b' } }); await view.render(); await view.render();
    expect(view.text()).not.toContain('25%');
    expect(view.requests[0].options.signal.aborted).toBe(true);
    expect(view.requests[1].options.params).toEqual({ labId: 'b', days: '30' });
    view.find('qa-window').props.onChange({ target: { value: '90' } }); await view.render();
    expect(view.requests[1].options.signal.aborted).toBe(true);
    await view.respond(1, snapshot('b')); await view.render(); expect(view.text()).not.toContain('25%');
    await view.respond(2, snapshot('b')); await view.render(); expect(view.text()).toContain('25%');
    await view.render({ refreshKey: 1 });
    expect(view.requests[3].options.params).toEqual({ labId: 'b', days: '90' });
});

test('a failed read is visible and cannot turn into healthy zero counts or retain another laboratory snapshot', async () => {
    const view = host(); await view.render(); await view.respond(0, snapshot()); await view.render();
    await view.render({ refreshKey: 1 }); view.requests[1].reject(Error('Synthetic unavailable read'));
    await new Promise(resolve => setImmediate(resolve)); await view.render();
    expect(view.all().some(node => node.props?.role === 'alert')).toBe(true);
    expect(view.text()).not.toContain('25%'); expect(view.text()).not.toContain('Batches awaiting disposition');
});

test('the overview is wired into the authorized QA page and all five locales contain every new key', () => {
    const root = path.resolve(__dirname, '../../../client/src');
    const page = fs.readFileSync(path.join(root, 'pages/QADashboard.jsx'), 'utf8');
    expect(page).toContain("import QaOverview from '../components/qc/QaOverview'");
    expect(page).toContain('<QaOverview refreshKey={ncrRefreshKey} />');
    expect(fs.readFileSync(path.join(root, 'App.jsx'), 'utf8')).toContain('permission="VIEW_AUDIT"><QADashboard');
    const flatten = (object, prefix = '') => Object.entries(object).flatMap(([key, value]) => typeof value === 'object'
        ? flatten(value, prefix + key + '.') : [[prefix + key, value]]);
    const keys = flatten(en.qaOverview).map(([key]) => key).sort();
    for (const locale of ['en', 'es', 'es-419', 'fr', 'pt']) {
        const entries = flatten(require(path.join(root, 'translations', locale + '.json')).qaOverview);
        expect(entries.map(([key]) => key).sort()).toEqual(keys);
        expect(entries.every(([, value]) => typeof value === 'string' && value.trim())).toBe(true);
    }
});
