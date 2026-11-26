const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const React = require('../../../client/node_modules/react');
const esbuild = require('../../../client/node_modules/esbuild');
const { JSDOM } = require('jsdom');
const { localeTranslator } = require('../helpers/clientTranslation');
const intakeRules = require('../helpers/intakeRulesFixture')(true);
const sourceRoot = path.resolve(__dirname, '../../../client/src');
let mounted, errors;
const flush = callback => React.act(async () => { await callback?.(); for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve)); });
const noop = () => null;
async function mount(file, { sample, workspace, search = '' } = {}) {
    const dom = new JSDOM('<html><body><div id="root"></div></body></html>', { url: 'http://localhost/' + search });
    global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator; global.IS_REACT_ACT_ENVIRONMENT = true;
    dom.window.HTMLElement.prototype.scrollIntoView = () => {};
    const navigate = jest.fn(), cache = {}, t = localeTranslator('en');
    const user = { id: 'fixture-user', username: 'fixture-reception', role: 'LAB_MANAGER', labId: 'fixture-lab', lab: { id: 'fixture-lab', country: 'GTM', name: 'Practice lab' } };
    const axios = { get: jest.fn(async url => {
        if (url.endsWith('/workspace')) return { data: workspace };
        if (url.endsWith('/detail')) return { data: { sample, workItems: [], auditLog: [] } };
        if (url === '/api/reception/sample-context') return { data: { success: true, sample } };
        if (url === '/api/reception/check-duplicate') return { data: { isPriorReceipt: false } };
        if (url === '/api/reports/sample/' + sample?.id) return { data: [] };
        if (/branding|config|policy/.test(url)) return { data: {} };
        return { data: [] };
    }), post: jest.fn(async () => ({ data: { id: 'fixture-report', version: 1 } })) };
    let showDialog = jest.fn();
    const forwardDialog = options => showDialog(options);
    const subscribeToEvent = () => () => {};
    const harmlessModule = () => Object.assign(function ChildBoundary() { return null; }, { ProfileReferenceSummary: noop });
    function load(filename) {
        if (cache[filename]) return cache[filename];
        const module = { exports: {} };
        const pageOverride = process.env.LIMS_438_PAGE_SOURCE_DIR && filename.startsWith(path.join(sourceRoot, 'pages') + path.sep);
        const readPath = pageOverride ? path.join(process.env.LIMS_438_PAGE_SOURCE_DIR, path.basename(filename)) : filename;
        vm.runInNewContext(esbuild.transformSync(fs.readFileSync(readPath, 'utf8'), { loader: filename.endsWith('.jsx') ? 'jsx' : 'js', format: 'cjs', jsx: 'automatic' }).code, {
            module, exports: module.exports, console, URL, URLSearchParams, Date, setTimeout, clearTimeout, setInterval, clearInterval, localStorage: dom.window.localStorage,
            window: dom.window, document: dom.window.document, requestAnimationFrame: callback => callback(),
            require(name) {
                if (name === 'react') return React;
                if (name === 'react/jsx-runtime') return require('../../../client/node_modules/react/jsx-runtime');
                if (name === 'axios') return axios;
                if (name === 'lucide-react') return new Proxy({}, { get: () => noop });
                if (name === 'qrcode') return { toDataURL: async () => '' };
                if (name.includes('AuthContext')) return { useAuth: () => ({ user, token: 'synthetic-session', hasPermission: () => true }) };
                if (name.includes('LanguageContext')) return { useLanguage: () => ({ t, language: 'en' }) };
                if (name.includes('DialogContext')) return { useDialog: () => ({ showDialog: forwardDialog }) };
                if (name.includes('NotificationContext')) return { useNotifications: () => ({ subscribeToEvent }) };
                if (name.includes('AnalysisCatalogueContext')) return { useAnalysisNames: () => code => code };
                if (name === 'react-router-dom') return { useParams: () => ({ id: sample?.id }), useNavigate: () => navigate,
                    useLocation: () => ({ pathname: '/test', search }) };
                if (name.includes('useIntakeRules')) return { __esModule: true, default: () => ({ rules: intakeRules, loading: false, error: null }), intakeRulesErrorText: () => '' };
                if (name.includes('useUploadMediaUrls')) return () => () => undefined;
                if (name.includes('audioCues')) return { playSuccessChime() {}, playErrorBuzz() {}, playNoticeChime() {}, isAudioEnabled: () => false, setAudioEnabled() {} };
                if (name.includes('mapConfig')) return { parseCoordinates: () => null };
                if (name.includes('syncEngine')) return { recordSyncOperation: jest.fn() };
                if (name.includes('workItemEvidence')) return { workItemEvidenceText: () => '' };
                if (/coordinateResolver|i18nHelper/.test(name)) return load(path.resolve(path.dirname(filename), name + '.js'));
                if (/WalkInForm|ComplianceChecklist|IntakeContextFields/.test(name)) return load(path.resolve(path.dirname(filename), name + '.jsx'));
                return harmlessModule();
            }
        });
        return cache[filename] = module.exports;
    }
    const Component = load(path.join(sourceRoot, 'pages', file)).default;
    function Host() {
        const [dialog, setDialog] = React.useState(null); showDialog = setDialog;
        return React.createElement(React.Fragment, null,
            React.createElement(Component, { initialSample: sample, initialWorkspace: workspace }),
            dialog?.onConfirm && React.createElement('button', { 'data-testid': 'confirm-resume', onClick: dialog.onConfirm }, 'Open saved draft'));
    }
    const root = require('../../../client/node_modules/react-dom/client').createRoot(document.getElementById('root'));
    mounted = { root, dom, navigate, axios, click: element => flush(() => { expect(element).toBeDefined(); element.click(); }),
        button: text => [...document.querySelectorAll('button')].find(node => node.textContent.trim() === text) };
    await flush(() => root.render(React.createElement(Host)));
    return mounted;
}
beforeEach(() => { errors = jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(async () => { if (mounted) { await flush(() => mounted.root.unmount()); mounted.dom.window.close(); mounted = null; }
    errors.mockRestore(); delete global.window; delete global.document; delete global.navigator; delete global.IS_REACT_ACT_ENVIRONMENT; });
test.each(['RECEIVE', 'ACCEPT_INTAKE', 'RELEASE_REPORT'])('rendered sample primary action %s reaches its existing target without a console error', async action => {
    const sample = { id: 'sample /1', originalId: 'DEMO-001', status: 'RECEIVED', requiredAnalyses: '[]' };
    const workspace = { workItems: [], nextAction: { action, label: 'Primary fixture action' } };
    const view = await mount('SampleDetail.jsx', { sample, workspace, search: '?tab=work' });
    view.navigate.mockClear(); errors.mockClear();
    await view.click(view.button('Primary fixture action'));
    if (['RECEIVE', 'ACCEPT_INTAKE'].includes(action)) expect(view.navigate).toHaveBeenCalledWith('/reception?sampleId=sample%20%2F1');
    else { expect(document.body.textContent).toContain('Generate & Release Report'); expect(view.axios.post).not.toHaveBeenCalled(); }
    expect(errors).not.toHaveBeenCalled();
});
test.each([
    [{ receiptId: 'REC-OPS-preparation', schemaVersion: 'prep-test-v1' }, 'Completed'],
    [null, 'Evidence needs verification']
])('the preparation prerequisite with receipt %p displays %s', async (receipt, expected) => {
    const sample = { id: 'sample-preparation', originalId: 'PREP-001', status: 'PROCESSING', preparationStatus: 'DONE' };
    const workspace = { workItems: [], operationalGates: { preparation: { isDone: true, receipt } } };
    await mount('SampleDetail.jsx', { sample, workspace, search: '?tab=work' });
    const heading = [...document.querySelectorAll('h3')].find(node => node.textContent === 'Preparation Prerequisites');
    const card = heading.parentElement.parentElement;
    const statuses = [...card.querySelectorAll('span')].map(node => node.textContent);
    expect(statuses.filter(status => ['Completed', 'Evidence needs verification'].includes(status))).toEqual([expected]);
});
test.each(['DRAFT', 'RECEIVED'])('rendered Reception resumes %s with saved sampling fields, checklist and notes', async status => {
    const sample = { id: 'draft-1', originalId: 'DEMO-DRAFT', status, isWalkIn: true, depthTopCm: 0, depthBottomCm: 20,
        fieldMetadata: JSON.stringify({ collectionDate: { value: '2026-11-14T12:00:00Z' }, landUse: { value: 'CROPLAND' }, isComposite: { value: false } }),
        receptionData: { isWalkIn: true, samplingDetails: { date: '2000-01-01', depthTopCm: 99, depthBottomCm: 99 },
            checklist: { items: { container: { status: 'PASS', note: 'Saved container check' } }, nonConformance: false, reason: '' }, notes: 'Saved intake note' } };
    const view = await mount('Reception.jsx', { sample, search: '?code=DEMO-DRAFT' });
    const confirm = document.querySelector('[data-testid=confirm-resume]'); expect(confirm).not.toBeNull(); errors.mockClear();
    await view.click(confirm);
    expect(document.querySelector('input[type=date]').value).toBe('2026-11-14');
    expect([...document.querySelectorAll('input')].some(node => node.value === '0')).toBe(true);
    expect([...document.querySelectorAll('input')].some(node => node.value === '20')).toBe(true);
    expect([...document.querySelectorAll('textarea,input')].some(node => node.value === 'Saved intake note')).toBe(true);
    const container = [...document.querySelectorAll('span')].find(node => node.textContent.startsWith('Container Intact / Sealed'));
    expect(container).toBeDefined();
    expect(container.parentElement.parentElement.querySelector('.bg-emerald-500')).not.toBeNull();
    expect(document.body.textContent).toContain('4 pending');
    expect(errors).not.toHaveBeenCalled();
});
test('JSX defined-name scan catches missing t and permits the declared build/browser globals', async () => {
    const { lintSource } = require('../../../client/scripts/check_defined_names.cjs');
    const bad = await lintSource('export const Example = () => <span>{t("status.CLOSED")}</span>;');
    expect(bad[0].messages.some(row => row.ruleId === 'no-undef' && row.message.includes("'t'"))).toBe(true);
    const good = await lintSource('export const Example = () => <span>{window.location.pathname}{__APP_VERSION__}{__BUILD_DATE__}</span>;');
    expect(good[0].errorCount).toBe(0);
});
