const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const React = require('../../../client/node_modules/react');
const esbuild = require('../../../client/node_modules/esbuild');
const root = path.resolve(__dirname, '../../../client/src');
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : !node || typeof node !== 'object' ? [] : [node, ...nodes(node.props?.children)];
const content = node => Array.isArray(node) ? node.map(content).join('') : !node || typeof node !== 'object' ? String(node ?? '') : content(node.props?.children);
const translate = key => key;

// Execute real JSX callbacks and effect cleanup. Child Result editors remain
// boundaries so the tests can inspect and exercise their existing draft props.
function mountUi(filename, props = {}, { canEdit = true, user = null, responses = {}, axios: suppliedAxios, routeParams = {} } = {}) {
    const hooks = [], effects = [], children = {}, cache = {}; let cursor = 0, tree;
    const equal = (a, b) => a && b && a.length === b.length && a.every((value, index) => value === b[index]);
    const react = { ...React,
        useState(initial) { const index = cursor++; if (!(index in hooks)) hooks[index] = { value: typeof initial === 'function' ? initial() : initial };
            return [hooks[index].value, value => { hooks[index].value = typeof value === 'function' ? value(hooks[index].value) : value; }]; },
        useEffect(effect, deps) { const index = cursor++; if (!equal(hooks[index]?.deps, deps)) {
            const previous = hooks[index]; hooks[index] = { deps };
            effects.push(() => { previous?.cleanup?.(); hooks[index].cleanup = effect(); });
        } },
        useRef(initial) { const index = cursor++; return hooks[index] || (hooks[index] = { current: initial }); },
        useMemo: callback => callback(), useCallback: callback => callback
    };
    const axios = suppliedAxios || { get: jest.fn(async url => ({ data: { data: responses[url] || [] } })),
        post: jest.fn(async () => ({ data: { batch: { result: 'PASS' } } })), put: jest.fn(async () => ({ data: { batch: { result: 'PASS' } } })) };
    function load(file) {
        if (cache[file]) return cache[file];
        const module = { exports: {} };
        vm.runInNewContext(esbuild.transformSync(fs.readFileSync(file, 'utf8'), { loader: file.endsWith('.jsx') ? 'jsx' : 'js', format: 'cjs' }).code,
            { module, exports: module.exports, console, setTimeout, clearTimeout, Date, crypto: require('node:crypto').webcrypto, AbortController, window: { innerWidth: 1200 }, require(name) {
                if (name === 'react') return react;
                if (name === 'axios') return axios;
                if (name === 'react-router-dom') return { useParams: () => routeParams };
                if (name === 'lucide-react') return new Proxy({}, { get: () => () => null });
                if (name.includes('LanguageContext')) return { useLanguage: () => ({ t: translate }) };
                if (name.includes('AuthContext')) return { useAuth: () => ({ user, hasPermission: () => canEdit }) };
                if (name.includes('useFocusTrap')) return { useFocusTrap: () => react.useRef(null) };
                if (name.includes('AnalysisCatalogueContext')) return { useAnalysisNames: () => code => code };
                if (name.includes('HelpContext')) return { useHelp: () => ({ registerBlockers() {}, clearBlockers() {} }) };
                if (name === '@lims/number-parse') return require('../../../shared/numberParse');
                if (name === '@lims/delimited-text') return require('../../../shared/delimitedText');
                if (name === '@lims/result-value-validation') return require('../../../shared/resultValueValidation');
                if (name === '@lims/soil-calculation') return require('../../../shared/soilCalculation');
                if (['./entryReadiness', './qcWorksheetNavigation', './worksheetReady', '../../utils/soilCalculations', './useRunBarcodeScan', './BarcodeSafeInput',
                    './QcRunHistory', '../qc/BatchInspectionModal', '../../utils/audioCues'].includes(name))
                    return load(path.resolve(path.dirname(file), name +
                        (/Navigation$|Readiness$|worksheetReady$|soilCalculations$|useRunBarcodeScan$|audioCues$/.test(name) ? '.js' : '.jsx')));
                return children[name] || (children[name] = () => null);
            } });
        return cache[file] = module.exports;
    }
    const component = load(path.resolve(root, filename)).default;
    const expand = node => {
        if (Array.isArray(node)) return node.map(expand);
        if (!node || typeof node !== 'object') return node;
        if (typeof node.type === 'function' && node.type.name === 'StoredQcEvidence') return expand(node.type(node.props));
        return { ...node, props: { ...node.props, children: expand(node.props?.children) } };
    };
    return { axios, props, responses, children,
        async render(patch = {}) { Object.assign(props, patch); for (let index = 0; index < 5; index++) {
            cursor = 0; tree = expand(component(props)); effects.splice(0).forEach(effect => effect()); await new Promise(resolve => setImmediate(resolve));
        } return tree; },
        unmount() { hooks.forEach(hook => hook?.cleanup?.()); hooks.length = 0; },
        find: id => nodes(tree).find(node => node.props?.['data-testid'] === id),
        all: () => nodes(tree), text: () => content(tree)
    };
}
function nativeFixture({ mode = 'REQUIRED_BLOCKING', started = true, duplicates = 1, controls = 1, blank = true } = {}) {
    const positions = [];
    const add = (id, kind, fields = {}) => { const row = { id, kind, position: positions.length + 1, references: [], ...fields }; positions.push(row); return row; };
    if (blank) add('blank', 'BLANK');
    for (let index = 0; index < controls; index++) add(`control-${index}`, 'LRM');
    for (let index = 0; index < duplicates; index++) {
        add(`parent-${index}`, 'SAMPLE', { sampleId: `sample-${index}`, workItems: [{ analysisCode: 'A', workItemId: `wi-${index}` }] });
        add(`duplicate-${index}`, 'DUPLICATE', { sampleId: `sample-${index}`, duplicateOfPositionId: `parent-${index}` });
    }
    return { id: 'worksheet-run', analysis: 'A', labId: 'worksheet-lab', status: 'OPEN', startedAt: started ? '2026-10-08T00:00:00Z' : null,
        positions, workItems: Array.from({ length: duplicates }, (_, index) => ({ id: `wi-${index}`, sampleId: `sample-${index}`, sample: { originalId: `CODE-${index}` } })),
        analytes: [{ id: 'analyte-a', analysisCode: 'A', provenance: 'NATIVE', status: 'QC_PENDING', qcMode: mode,
            positions, measurements: [], numberFormat: { decimal: '.', thousands: null }, criteriaSnapshot: JSON.stringify({
                requiredPositions: mode === 'REQUIRED_BLOCKING' ? Object.fromEntries(['BLANK', 'LRM', 'DUPLICATE'].map(kind =>
                    [kind, positions.filter(row => row.kind === kind).map(row => row.id)])) : {} }) }] };
}
const nativeHost = (batch = nativeFixture(), patch = {}) => mountUi('components/workbench/NativeRunPanel.jsx', {
    batch, referenceMaterials: [], loading: false, onChanged: jest.fn(), setError: jest.fn(), setLoading: jest.fn(), setSuccessMsg: jest.fn(), ...patch
});
async function enter(view, entries) {
    for (const [id, value] of Object.entries(entries)) { view.find(`native-value-${id}`).props.onChange({ target: { value } }); await view.render(); }
}
module.exports = { mountUi, nativeHost, nativeFixture, enter, nodes, content };
