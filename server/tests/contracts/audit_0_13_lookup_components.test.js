const fs = require('fs');
const path = require('path');
const vm = require('vm');
const esbuild = require('../../../client/node_modules/esbuild');
const React = require('../../../client/node_modules/react');

function elements(tree, predicate) {
    if (Array.isArray(tree)) return tree.flatMap(node => elements(node, predicate));
    if (!tree || typeof tree !== 'object') return [];
    return [...(predicate(tree) ? [tree] : []), ...elements(tree.props?.children, predicate)];
}
function harness(page, { offline, axios = {}, search = '' } = {}) {
    const states = [], effects = [], navigate = jest.fn(), showDialog = jest.fn();
    let cursor = 0;
    const hooks = { ...React, useEffect: (fn, deps) => effects.push({ fn, deps }), useMemo: fn => fn(),
        useRef: initial => ({ current: initial }), useState(initial) {
            const index = cursor++;
            if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
            return [states[index], update => { states[index] = typeof update === 'function' ? update(states[index]) : update; }];
        } };
    const module = { exports: {} }, filename = path.resolve(__dirname, `../../../client/src/pages/${page}.jsx`);
    vm.runInNewContext(esbuild.transformSync(fs.readFileSync(filename, 'utf8'), { loader: 'jsx', format: 'cjs' }).code, {
        module, exports: module.exports, console, navigator: {}, URLSearchParams, setTimeout, clearTimeout,
        window: { addEventListener() {}, removeEventListener() {} }, document: {}, localStorage: { getItem: () => null },
        require: name => {
            if (name === 'react') return hooks;
            if (name === 'axios') return axios;
            if (name === 'react-router-dom') return { useNavigate: () => navigate, useLocation: () => ({ search }) };
            if (name === 'lucide-react') return new Proxy({}, { get: () => () => null });
            if (name === 'clsx') return (...classes) => classes.filter(Boolean).join(' ');
            if (name.includes('LanguageContext')) return { useLanguage: () => ({ t: (_, fallback) => typeof fallback === 'string' ? fallback : '' }) };
            if (name.includes('AuthContext')) return { useAuth: () => ({ user: { role: 'SAMPLE_RECEPTION' }, token: 'auth-013' }) };
            if (name.includes('DialogContext')) return { useDialog: () => ({ showDialog }) };
            if (name.includes('AnalysisCatalogueContext')) return { useAnalysisNames: () => code => code };
            if (name.includes('offlineDb')) return { getOfflineSample: offline };
            if (name.includes('coordinateResolver')) return { resolveCoordinates: () => ({ isRecorded: false }) };
            if (name.includes('mapConfig')) return { parseCoordinates: () => null };
            if (name.includes('audioCues')) return new Proxy({}, { get: () => () => {} });
            return () => null;
        }
    });
    return { effects, navigate, showDialog, render() { cursor = 0; effects.length = 0; return module.exports.default(); } };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
async function scan(h, code) {
    const input = elements(h.render(), node => node.type === 'input' && node.props.type === 'text')[0];
    input.props.onChange({ target: { value: code } });
    elements(h.render(), node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
    await settle();
    return h.render();
}

describe('Audit 0.13: scan and reception callers', () => {
    test('offline resolution remains first and navigates with the cached immutable id without a server call', async () => {
        const offline = jest.fn().mockResolvedValue({ id: 'database-013', originalId: 'barcode-013' });
        const axios = { get: jest.fn() }, h = harness('ScanPage', { offline, axios });
        const tree = await scan(h, 'barcode-013');
        expect(offline).toHaveBeenCalledWith('barcode-013'); expect(axios.get).not.toHaveBeenCalled();
        const details = elements(tree, node => node.type === 'button' && elements(node, el => el.props?.children === 'Sample Details').length)[0];
        expect(details.props.disabled).toBe(false); details.props.onClick();
        expect(h.navigate).toHaveBeenCalledWith('/samples/database-013');
    });
    test('an offline miss calls authenticated axios lookup and sample/workbench actions use the resolved id', async () => {
        const offline = jest.fn().mockResolvedValue(null);
        const axios = { get: jest.fn().mockResolvedValue({ data: { id: 'database-013', labId: 'LABEL-013' } }) };
        const h = harness('ScanPage', { offline, axios });
        const tree = await scan(h, 'https://lims.yigini.net/samples/LABEL-013?print=1');
        expect(offline).toHaveBeenCalledWith('LABEL-013');
        expect(axios.get).toHaveBeenCalledWith('/api/samples/lookup', { params: { code: 'LABEL-013' }, headers: { Authorization: 'Bearer auth-013' } });
        expect(offline.mock.invocationCallOrder[0]).toBeLessThan(axios.get.mock.invocationCallOrder[0]);
        const workbench = elements(tree, node => node.type === 'button' && elements(node, el => el.props?.children === 'Workbench').length)[0];
        workbench.props.onClick(); expect(h.navigate).toHaveBeenCalledWith('/workbench?sampleId=database-013');
    });
    test('ambiguous scans display both candidates and disable sample/workbench actions', async () => {
        const offline = jest.fn().mockResolvedValue(null);
        const axios = { get: jest.fn().mockRejectedValue({ response: { status: 409, data: { code: 'SAMPLE_LOOKUP_AMBIGUOUS', candidates: [{ displayId: 'FIELD-A' }, { displayId: 'FIELD-B' }] } } }) };
        const tree = await scan(harness('ScanPage', { offline, axios }), 'duplicate-013');
        const alert = elements(tree, node => node.props?.role === 'alert')[0];
        expect(alert.props.children).toContain('FIELD-A, FIELD-B');
        const actions = elements(tree, node => node.type === 'button' && elements(node, el => ['Sample Details', 'Workbench'].includes(el.props?.children)).length);
        expect(actions).toHaveLength(2); expect(actions.every(button => button.props.disabled)).toBe(true);
    });
    test('reception dashboard deep links use the authenticated lookup route', async () => {
        const axios = { get: jest.fn().mockResolvedValue({ data: { id: 'database-013', originalId: 'FIELD-013', status: 'EXPECTED' } }) };
        const search = '?sampleId=database-013', h = harness('Reception', { axios, search });
        h.render();
        const effect = h.effects.find(entry => entry.deps?.includes(search) && entry.deps.includes('auth-013'));
        expect(effect).toBeDefined(); effect.fn(); await settle();
        expect(axios.get).toHaveBeenCalledWith('/api/samples/lookup', { params: { code: 'database-013' }, headers: { Authorization: 'Bearer auth-013' } });
        expect(h.showDialog).not.toHaveBeenCalled();
    });
    test('lookup messages exist in every shipped client locale', () => {
        for (const locale of ['en', 'es', 'es-419', 'fr', 'pt']) {
            const messages = require(`../../../client/src/translations/${locale}.json`).sampleLookup;
            for (const key of ['title', 'ambiguous', 'failed']) expect(messages[key]).toEqual(expect.any(String));
        }
    });
});
