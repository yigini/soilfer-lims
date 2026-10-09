const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { JSDOM } = require('jsdom');
const React = require('../../../client/node_modules/react');
const esbuild = require('../../../client/node_modules/esbuild');
const { nativeFixture } = require('../helpers/qcWorksheetUi');
const root = path.resolve(__dirname, '../../../client/src');
const strings = require('../../../client/src/translations/en.json').barcodeScan;
const positive = 'GHA1-26-000123N', wrong = 'GHA1-26-000123K';
const t = key => key.startsWith('barcodeScan.') ? strings[key.slice(12)] : key;

describe('Audit 4.2: real DOM barcode wedge and value-cell boundaries', () => {
    let dom, host, reactRoot, createRoot, axios, audio, scroll, props;
    const cache = {};
    function load(file) {
        if (cache[file]) return cache[file];
        const module = { exports: {} };
        vm.runInNewContext(esbuild.transformSync(fs.readFileSync(file, 'utf8'), {
            loader: file.endsWith('.jsx') ? 'jsx' : 'js', format: 'cjs'
        }).code, { module, exports: module.exports, window, document, console, Date, setTimeout, clearTimeout,
            require(name) {
                if (name === 'react') return React;
                if (name === 'axios') return axios;
                if (name === 'lucide-react') return new Proxy({}, { get: () => () => null });
                if (name === 'clsx') return require('../../../client/node_modules/clsx');
                if (name === '@lims/number-parse') return require('../../../shared/numberParse');
                if (name === '@lims/soil-calculation') return require('../../../shared/soilCalculation');
                if (name.includes('LanguageContext')) return { useLanguage: () => ({ t }) };
                if (name.includes('AuthContext')) return { useAuth: () => ({ hasPermission: () => true }) };
                if (name.includes('AnalysisCatalogueContext')) return { useAnalysisNames: () => code => code };
                if (name.includes('HelpContext')) return { useHelp: () => ({ registerBlockers() {}, clearBlockers() {} }) };
                if (name.includes('audioCues')) return audio;
                // Unrelated dialogs/inspection are boundaries; worksheet,
                // navigation, scanner and all value editors execute real code.
                if (['./WorkbenchInspector', './PastePreviewModal', './BatchModal', './OperationalTaskEditor', './PreviousResultHint'].includes(name))
                    return { __esModule: true, default: () => null };
                const base = path.resolve(path.dirname(file), name);
                const source = [base, base + '.jsx', base + '.js'].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
                if (!source) throw Error('Unexpected UI dependency: ' + name);
                return load(source);
            }
        });
        return cache[file] = module.exports;
    }
    const query = id => host.querySelector(`[data-testid="${id}"]`);
    const key = (node, value) => node.dispatchEvent(new window.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
    const input = (node, value) => {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(node, value);
        node.dispatchEvent(new window.Event('input', { bubbles: true }));
    };
    const tick = async (milliseconds = 0) => React.act(async () => { jest.advanceTimersByTime(milliseconds); await Promise.resolve(); });
    async function wedge(text, startingNode = document.body) {
        await React.act(async () => { startingNode.focus(); });
        for (const character of text) {
            await React.act(async () => {
                const node = document.activeElement || document.body;
                if (key(node, character) && node.tagName === 'INPUT') input(node, node.value + character);
                jest.advanceTimersByTime(10);
            });
        }
        await React.act(async () => { key(document.activeElement || document.body, 'Enter'); await Promise.resolve(); });
        await tick(2);
    }
    async function render(component, componentProps) {
        await React.act(async () => { reactRoot.render(React.createElement(load(path.resolve(root, component)).default, componentProps)); });
    }
    async function worksheet({ match = { id: 'sample-123', labSampleCode: positive }, failure = null, width = 1200 } = {}) {
        window.innerWidth = width;
        const batch = nativeFixture({ mode: 'OFF', controls: 0, blank: false });
        batch.positions[0].sampleId = 'sample-123'; batch.positions[0].workItems[0].workItemId = 'wi-123';
        const item = { workItemId: 'wi-123', sampleId: 'sample-123', sampleDisplayId: positive,
            analysis: 'A', status: 'PENDING', readiness: { isReady: true, blockers: [] }, draft: { value: '6.42' },
            numberFormat: { decimal: '.', thousands: null } };
        const group = { analysis: 'A', items: [item], eligibleEquipment: [] };
        axios.get.mockImplementation(async (url) => {
            if (url === '/api/samples/lookup') {
                if (failure) throw { response: { status: failure === 'SAMPLE_LOOKUP_AMBIGUOUS' ? 409 : 404, data: { code: failure } } };
                return { data: match };
            }
            if (url === '/api/qc/batches') return { data: { data: [batch] } };
            if (url.includes('/api/qc/batches/')) return { data: { data: batch } };
            return { data: { data: [] } };
        });
        props = { activeGroup: group, allGroups: [group], onSelectGroup: jest.fn(), onDraftChange: jest.fn(),
            onUpdateItemMeta: jest.fn(), onReviewRecord: jest.fn(), onDiscardDraft: jest.fn(), onBatchUpdated: jest.fn() };
        await render('components/workbench/WorksheetArea.jsx', props);
        await React.act(async () => {
            const selector = query('worksheet-run-select'); selector.value = batch.id;
            selector.dispatchEvent(new window.Event('change', { bubbles: true }));
        });
        return { batch, item };
    }
    beforeEach(() => {
        jest.useFakeTimers();
        dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost' });
        global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator;
        global.IS_REACT_ACT_ENVIRONMENT = true;
        window.requestAnimationFrame = callback => setTimeout(callback, 1); window.cancelAnimationFrame = clearTimeout;
        scroll = jest.fn(); window.HTMLElement.prototype.scrollIntoView = scroll;
        host = document.getElementById('root');
        createRoot = require('../../../client/node_modules/react-dom/client').createRoot; reactRoot = createRoot(host);
        axios = { get: jest.fn(async () => ({ data: { data: { active: null, rows: [] } } })), post: jest.fn(async () => ({ data: { data: {} } })) };
        audio = { playSuccessChime: jest.fn(), playErrorBuzz: jest.fn() };
        for (const file of Object.keys(cache)) delete cache[file];
    });
    afterEach(async () => {
        await React.act(async () => reactRoot.unmount());
        jest.clearAllTimers(); jest.useRealTimers(); dom.window.close();
        delete global.window; delete global.document; delete global.navigator; delete global.IS_REACT_ACT_ENVIRONMENT;
    });
    test.each(['F2', 'unfocused burst'])('%s routes GHA1-26-000123N to row 123, without filling it', async activation => {
        await worksheet();
        if (activation === 'F2') await React.act(async () => { key(document.body, 'F2'); });
        await wedge(positive, activation === 'F2' ? query('worksheet-scan') : document.body);
        expect(axios.get).toHaveBeenCalledWith('/api/samples/lookup', { params: { code: positive, scanLabId: 'worksheet-lab' } });
        expect(document.activeElement.getAttribute('aria-label')).toBe(positive + ' determination');
        expect(document.activeElement.value).toBe('6.42'); expect(scroll).toHaveBeenCalledWith({ block: 'center' });
        expect(audio.playSuccessChime).toHaveBeenCalledTimes(1); expect(audio.playErrorBuzz).not.toHaveBeenCalled();
        expect(props.onDraftChange).not.toHaveBeenCalled(); expect(query('worksheet-scan-error')).toBeNull();
    });
    test.each(['SCAN_CHECK_CHARACTER_INVALID', 'SAMPLE_NOT_FOUND', 'SAMPLE_LOOKUP_AMBIGUOUS'])('%s keeps focus out of the row and gives the red banner/error cue', async failure => {
        await worksheet({ failure }); await wedge(wrong, query('worksheet-scan'));
        expect(query('worksheet-scan-error').dataset.scanCode).toBe(failure);
        expect(query('worksheet-scan-error').className).toContain('text-red-800');
        expect(document.activeElement).toBe(query('worksheet-scan')); expect(scroll).not.toHaveBeenCalled();
        expect(audio.playErrorBuzz).toHaveBeenCalledTimes(1); expect(audio.playSuccessChime).not.toHaveBeenCalled();
        expect(props.onDraftChange).not.toHaveBeenCalled();
    });
    test.each([wrong, 'HISTORICAL-N-000123', 'LABEL-WITHOUT-CHECK'])('exact stored original/issued label %s remains authoritative', async code => {
        const match = code === wrong ? { id: 'sample-123', originalId: code } : { id: 'sample-123', labSampleCode: code };
        await worksheet({ match }); await wedge(code, query('worksheet-scan'));
        expect(document.activeElement.value).toBe('6.42'); expect(audio.playSuccessChime).toHaveBeenCalledTimes(1);
        expect(props.onDraftChange).not.toHaveBeenCalled();
    });
    test('an exact sample outside the run has its own stable refusal and never focuses or fills a row', async () => {
        await worksheet({ match: { id: 'other-sample', labSampleCode: positive } }); await wedge(positive, query('worksheet-scan'));
        expect(query('worksheet-scan-error').dataset.scanCode).toBe('SCAN_SAMPLE_NOT_IN_RUN');
        expect(scroll).not.toHaveBeenCalled(); expect(props.onDraftChange).not.toHaveBeenCalled(); expect(audio.playErrorBuzz).toHaveBeenCalledTimes(1);
    });
    test('lookup IDs and lab identifiers cannot substitute for an exact issued label or original ID', async () => {
        await worksheet({ match: { id: positive, labSampleCode: 'OTHER-LABEL', originalId: 'OTHER-FIELD-ID' } });
        await wedge(positive, query('worksheet-scan'));
        expect(query('worksheet-scan-error').dataset.scanCode).toBe('SAMPLE_NOT_FOUND');
        expect(scroll).not.toHaveBeenCalled(); expect(props.onDraftChange).not.toHaveBeenCalled();
    });
    test('a disabled result cell refuses focus even for an exact in-run sample', async () => {
        const { item } = await worksheet(); item.status = 'COMPLETED';
        await render('components/workbench/WorksheetArea.jsx', props); await wedge(positive, query('worksheet-scan'));
        expect(query('worksheet-scan-error').dataset.scanCode).toBe('SCAN_ROW_UNAVAILABLE');
        expect(audio.playErrorBuzz).toHaveBeenCalledTimes(1); expect(audio.playSuccessChime).not.toHaveBeenCalled();
        expect(props.onDraftChange).not.toHaveBeenCalled(); expect(scroll).not.toHaveBeenCalled();
    });
    test('the same barcode in a real grid value cell is rejected before draft writes or Enter navigation', async () => {
        await worksheet(); const cell = host.querySelector(`input[aria-label="${positive} determination"]`);
        await wedge(wrong, cell); await tick(100);
        expect(cell.value).toBe('6.42'); expect(document.activeElement).toBe(cell);
        expect(query('worksheet-scan-error').textContent).toBe(strings.valueCell);
        expect(props.onDraftChange).not.toHaveBeenCalled(); expect(audio.playErrorBuzz).toHaveBeenCalledTimes(1);
        expect(axios.get.mock.calls.filter(([url]) => url === '/api/samples/lookup')).toHaveLength(0);
    });
    test.each([0, 1, 2])('texture fraction %s refuses a wedge without altering any fraction', async fraction => {
        const onChange = jest.fn(), onBarcodeRejected = jest.fn();
        await render('components/workbench/TextureEditor.jsx', { values: ['40', '40', '20'], onChange, onBarcodeRejected,
            numberFormat: { decimal: '.', thousands: null }, tolerance: 2 });
        const cells = host.querySelectorAll('input'); await wedge(wrong, cells[fraction]); await tick(100);
        expect([...cells].map(cell => cell.value)).toEqual(['40', '40', '20']);
        expect(onChange).not.toHaveBeenCalled(); expect(onBarcodeRejected).toHaveBeenCalledTimes(1);
    });
    test('QC observations refuse a wedge before preview or observation persistence', async () => {
        const reject = jest.fn();
        await render('components/workbench/NativeRunPanel.jsx', { batch: nativeFixture(), referenceMaterials: [],
            onChanged: jest.fn(), loading: false, setLoading: jest.fn(), setError: jest.fn(), setSuccessMsg: jest.fn(), onBarcodeRejected: reject });
        axios.post.mockClear(); const cell = query('native-value-blank'); await wedge(wrong, cell); await tick(100);
        expect(cell.value).toBe(''); expect(reject).toHaveBeenCalledTimes(1); expect(axios.post).not.toHaveBeenCalled();
    });
    test('the single-sample editor forwards the same zero-draft wedge refusal', async () => {
        const onDraftChange = jest.fn(), reject = jest.fn();
        const item = { workItemId: 'wi-123', sampleId: 'sample-123', sampleDisplayId: positive,
            status: 'PENDING', readiness: { isReady: true }, draft: { value: '6.42' }, numberFormat: { decimal: '.', thousands: null } };
        await render('components/workbench/SingleSampleEditor.jsx', { items: [item], activeGroup: { analysis: 'A', items: [item] },
            onDraftChange, onUpdateItemMeta: jest.fn(), onBarcodeRejected: reject });
        const cell = host.querySelector('input[inputmode="decimal"]'); await wedge(wrong, cell); await tick(100);
        expect(cell.value).toBe('6.42'); expect(onDraftChange).not.toHaveBeenCalled(); expect(reject).toHaveBeenCalledTimes(1);
    });
    test.each([29, 30])('the strict inter-key boundary at %sms preserves ordinary typing and rejects only the fast burst', async gap => {
        const onChange = jest.fn(), reject = jest.fn();
        await render('components/workbench/NumericEditor.jsx', { value: '', onChange, onBarcodeRejected: reject,
            numberFormat: { decimal: '.', thousands: null } });
        const cell = host.querySelector('input'); await React.act(async () => cell.focus());
        for (const character of '1234567') {
            await React.act(async () => { key(cell, character); input(cell, cell.value + character); }); await tick(gap);
        }
        await React.act(async () => key(cell, 'Enter')); await tick(100);
        if (gap === 29) { expect(onChange).not.toHaveBeenCalled(); expect(reject).toHaveBeenCalledTimes(1); expect(cell.value).toBe(''); }
        else { expect(onChange).toHaveBeenLastCalledWith('1234567'); expect(reject).not.toHaveBeenCalled(); }
    });
    test('unmounting a buffered value editor cancels its pending draft write', async () => {
        const onChange = jest.fn();
        await render('components/workbench/NumericEditor.jsx', { value: '', onChange, onBarcodeRejected: jest.fn(), numberFormat: { decimal: '.', thousands: null } });
        const cell = host.querySelector('input'); await React.act(async () => cell.focus());
        for (const character of '1234567') {
            await React.act(async () => { key(cell, character); input(cell, cell.value + character); }); await tick(10);
        }
        await React.act(async () => reactRoot.render(null)); await tick(100); expect(onChange).not.toHaveBeenCalled();
    });
    test('ordinary slow locale typing and short Enter input still reach the draft callback', async () => {
        const onChange = jest.fn();
        await render('components/workbench/NumericEditor.jsx', { value: '', onChange, onBarcodeRejected: jest.fn(), numberFormat: { decimal: '.', thousands: null } });
        const cell = host.querySelector('input'); await React.act(async () => cell.focus());
        for (const character of '6,42') {
            await React.act(async () => { key(cell, character); input(cell, cell.value + character); }); await tick(40);
        }
        expect(onChange).toHaveBeenLastCalledWith('6,42');
        onChange.mockClear(); await React.act(async () => input(cell, '')); await wedge('12.34', cell);
        expect(onChange).toHaveBeenLastCalledWith('12.34');
    });
    test('changing the run discards a late lookup response without success, focus or draft writes', async () => {
        await worksheet(); let resolveLookup;
        axios.get.mockImplementationOnce(() => new Promise(resolve => { resolveLookup = resolve; }));
        await wedge(positive, query('worksheet-scan'));
        await React.act(async () => { const selector = query('worksheet-run-select'); selector.value = ''; selector.dispatchEvent(new window.Event('change', { bubbles: true })); });
        await React.act(async () => { resolveLookup({ data: { id: 'sample-123', labSampleCode: positive } }); }); await tick(100);
        expect(scroll).not.toHaveBeenCalled(); expect(audio.playSuccessChime).not.toHaveBeenCalled(); expect(props.onDraftChange).not.toHaveBeenCalled();
    });
    test('all scan messages exist in every shipped locale', () => {
        for (const locale of ['en', 'es', 'es-419', 'fr', 'pt']) {
            const translated = require(`../../../client/src/translations/${locale}.json`).barcodeScan;
            expect(Object.keys(translated).sort()).toEqual(Object.keys(strings).sort());
            for (const value of Object.values(translated)) expect(value.trim().length).toBeGreaterThan(0);
        }
    });
});
