const fs = require('fs');
const path = require('path');
const vm = require('vm');
const esbuild = require('../../../client/node_modules/esbuild');
const React = require('../../../client/node_modules/react');
const ReactDOMServer = require('../../../client/node_modules/react-dom/server');

// Execute the real component callbacks with persistent hook state. Child views
// are boundaries; the editors and receipt are separately exercised below.
function harness(name, { groups, width = 1200, axios, offline } = {}) {
    const states = [], refs = [], cache = {}, children = {};
    let stateCursor = 0, refCursor = 0, seeded = false;
    const hooks = { ...React,
        useState(initial) {
            const index = stateCursor++;
            if (!(index in states)) {
                states[index] = typeof initial === 'function' ? initial() : initial;
                if (groups && Array.isArray(states[index]) && !seeded) { states[index] = groups; seeded = true; }
            }
            return [states[index], update => { states[index] = typeof update === 'function' ? update(states[index]) : update; }];
        },
        useRef(initial) { const index = refCursor++; return refs[index] || (refs[index] = { current: initial }); },
        useMemo: fn => fn(), useCallback: fn => fn, useEffect: () => {}
    };
    function load(filename) {
        if (cache[filename]) return cache[filename];
        const module = { exports: {} };
        const source = esbuild.transformSync(fs.readFileSync(filename, 'utf8'), { loader: filename.endsWith('.jsx') ? 'jsx' : 'js', format: 'cjs' }).code;
        vm.runInNewContext(source, { module, exports: module.exports, console, setTimeout, clearTimeout,
            window: { innerWidth: width }, navigator: { onLine: true },
            require: mod => {
                if (mod === 'react') return hooks;
                if (mod === 'axios') return axios;
                if (mod === '@lims/number-parse') return require('../../../shared/numberParse');
                if (mod === 'lucide-react') return new Proxy({}, { get: () => () => null });
                if (mod === 'clsx') return (...values) => values.filter(Boolean).join(' ');
                if (mod.includes('LanguageContext')) return { useLanguage: () => ({ t: (_, fallback) => fallback }) };
                if (mod.includes('AnalysisCatalogueContext')) return { useAnalysisNames: () => (code, label) => label || code };
                if (mod.includes('AuthContext')) return { useAuth: () => ({ user: { id: 'tech', username: 'tech', role: 'LAB_TECHNICIAN', labId: 'lab' } }) };
                if (mod.includes('HelpContext')) return { useHelp: () => ({ clearBlockers() {}, registerBlockers() {} }) };
                if (mod.includes('NotificationContext')) return { useNotifications: () => ({}) };
                if (mod.includes('/offline/')) return offline || {};
                if (['./entryReadiness', './qcWorksheetNavigation', './worksheetReady', '../../utils/soilCalculations', './useRunBarcodeScan', './BarcodeSafeInput', '../../utils/audioCues'].includes(mod))
                    return load(path.resolve(path.dirname(filename), mod + (mod === './BarcodeSafeInput' ? '.jsx' : '.js')));
                if (mod.endsWith('.json')) return require(path.resolve(path.dirname(filename), mod));
                const childName = path.basename(mod);
                return children[childName] || (children[childName] = () => null);
            }
        });
        cache[filename] = module.exports;
        return module.exports;
    }
    const component = load(path.resolve(__dirname, `../../../client/src/components/workbench/${name}.jsx`)).default;
    return { children, render(props) { stateCursor = refCursor = 0; return component(props); } };
}
test('Audit4.1: the default workbench opens My runs while explicit sample navigation keeps its worksheet', () => {
    const defaultView = harness('WorkbenchShell', { groups: [{ analysis: 'PH_H2O', items: [] }] });
    expect(child(defaultView, defaultView.render({}), 'MyRunsPanel')).toBeDefined();
    const linkedView = harness('WorkbenchShell', { groups: [{ analysis: 'PH_H2O', items: [] }] });
    expect(child(linkedView, linkedView.render({ initialAnalysis: 'PH_H2O' }), 'WorksheetArea')).toBeDefined();
});
function elements(tree, predicate) {
    if (Array.isArray(tree)) return tree.flatMap(node => elements(node, predicate));
    if (!tree || typeof tree !== 'object') return [];
    return [...(predicate(tree) ? [tree] : []), ...elements(tree.props?.children, predicate)];
}
const child = (h, tree, name) => elements(tree, node => node.type === h.children[name])[0];
const item = (id, extra = {}) => ({ workItemId: id, sampleId: `database-${id}`, sampleDisplayId: `display-${id}`, analysis: 'PH_H2O',
    status: 'IN_PROGRESS', readiness: { isReady: true, blockers: [] }, ...extra });

describe('Audit 0.11: workbench component behavior', () => {
    afterEach(() => jest.useRealTimers());
    test('picker uses the selected row method list and displays its projected OVERDUE state', () => {
        const row = item('method-row', { readiness: { isReady: false, blockers: ['INSTRUMENT_REQUIRED'] },
            eligibleEquipment: [{ id: 'specific', name: 'Specific asset', calibrationStatus: 'OVERDUE', readinessState: 'OVERDUE', readiness: 'BLOCKED', status: 'IN_SERVICE' }] });
        const html = ReactDOMServer.renderToStaticMarkup(harness('WorkbenchInspector').render({ selectedItem: row,
            eligibleEquipment: [{ id: 'fallback', name: 'Other method asset', calibrationStatus: 'OK', status: 'IN_SERVICE' }] }));
        expect(html).toContain('Specific asset (OVERDUE)'); expect(html).not.toContain('Other method asset');
        row.draft = { instrumentId: 'specific' };
        const props = { activeGroup: { analysis: row.analysis }, items: [row] };
        const card = harness('SingleSampleEditor');
        expect(child(card, card.render(props), 'NumericEditor').props.disabled).toBe(true);
        row.eligibleEquipment[0] = { ...row.eligibleEquipment[0], calibrationStatus: 'NOT_CONFIGURED', readinessState: 'NOT_CONFIGURED', readiness: 'WARNING' };
        expect(child(card, card.render(props), 'NumericEditor').props.disabled).toBe(false);
        row.eligibleEquipment[0].readiness = 'BLOCKED';
        expect(child(card, card.render(props), 'NumericEditor').props.disabled).toBe(true);
    });
    test('card numeric typing creates the same draft and records this sample through review', () => {
        const h = harness('SingleSampleEditor'), onDraftChange = jest.fn(), onReviewRecord = jest.fn();
        const row = item('card', { currentResult: '9', previousResult: { value: '9', isValid: false } });
        const props = { activeGroup: { analysis: 'PH_H2O' }, items: [row], onDraftChange, onReviewRecord };
        let tree = h.render(props);
        const editor = child(h, tree, 'NumericEditor');
        expect(editor.props.value).toBe('');
        const numeric = harness('NumericEditor').render(editor.props);
        elements(numeric, node => node.type === 'input')[0].props.onChange({ target: { value: '6,2' } });
        expect(onDraftChange).toHaveBeenCalledWith('card', '6,2');
        row.draft = { value: '6,2' };
        tree = h.render(props);
        expect(child(h, tree, 'NumericEditor').props.value).toBe('6,2');
        elements(tree, node => node.type === 'button' && node.props.children === 'Record this sample')[0].props.onClick();
        expect(onReviewRecord).toHaveBeenCalledWith(['card']);
    });
    test('card texture and operational editors pass controlled values, checks and confirmations', () => {
        const h = harness('SingleSampleEditor'), change = jest.fn(), confirm = jest.fn();
        let tree = h.render({ activeGroup: { analysis: 'TEXTURE' }, items: [item('texture', { draft: { values: { sand: '40', silt: '40', clay: '20' } } })], onDraftChange: change });
        const texture = child(h, tree, 'TextureEditor');
        expect(texture.props.values.sand).toBe('40');
        texture.props.onChange({ sand: '50', silt: '30', clay: '20' });
        expect(change).toHaveBeenCalledWith('texture', null, { values: { sand: '50', silt: '30', clay: '20' } });
        tree = h.render({ activeGroup: { analysis: 'DRYING', category: 'Operational Gates' },
            items: [item('dry', { analysis: 'DRYING', draft: { checks: [true, true, true] } })], onDraftChange: change, onConfirmOperation: confirm });
        const operational = child(h, tree, 'OperationalTaskEditor');
        expect(operational.props.checks).toEqual([true, true, true]);
        operational.props.onChange([true, false, true]);
        expect(change).toHaveBeenCalledWith('dry', null, { checks: [true, false, true] });
        operational.props.onConfirm();
        expect(confirm).toHaveBeenCalledWith('dry', [true, true, true]);
    });
    test.each([['INSTRUMENT_REQUIRED', false], ['SAMPLE_ON_HOLD', true], ['ITEM_SEALED', true]])('instrument selector handles %s without bypassing other blockers', (blocker, disabled) => {
        const h = harness('WorkbenchInspector');
        const tree = h.render({ selectedItem: item('eq', { readiness: { isReady: false, blockers: [blocker] } }),
            eligibleEquipment: [{ id: 'meter', name: 'Meter' }] });
        const select = elements(tree, node => node.type === 'select').find(node => node.props.children[0]?.props?.children === '-- Select Instrument --');
        expect(select.props.disabled).toBe(disabled);
    });
    test('card instrument selection enables entry only for an eligible in-service instrument', () => {
        const h = harness('SingleSampleEditor'), meta = jest.fn();
        const row = item('eq', { readiness: { isReady: false, blockers: ['INSTRUMENT_REQUIRED'] } });
        const props = { activeGroup: { analysis: 'PH_H2O', eligibleEquipment: [{ id: 'meter', name: 'Meter', status: 'IN_SERVICE', calibrationStatus: 'OK' }] }, items: [row], onUpdateItemMeta: meta };
        let tree = h.render(props);
        expect(child(h, tree, 'NumericEditor').props.disabled).toBe(true);
        const select = elements(tree, node => node.type === 'select')[0];
        expect(select.props.disabled).toBe(false);
        select.props.onChange({ target: { value: 'meter' } });
        expect(meta).toHaveBeenCalledWith('eq', 'instrumentId', 'meter');
        row.draft = { instrumentId: 'meter' };
        expect(child(h, h.render(props), 'NumericEditor').props.disabled).toBe(false);
        props.activeGroup.eligibleEquipment[0].calibrationStatus = 'OVERDUE';
        expect(child(h, h.render(props), 'NumericEditor').props.disabled).toBe(true);
    });
    test('grid Enter uses work-item refs, skips blocked/sealed rows and focuses review on the last row', () => {
        const h = harness('WorksheetArea');
        const rows = [item('one'), item('blocked', { readiness: { isReady: false, blockers: ['SAMPLE_ON_HOLD'] } }),
            item('sealed', { status: 'ACCEPTED' }), item('last')];
        const tree = h.render({ activeGroup: { analysis: 'PH_H2O', items: rows } });
        const editors = elements(tree, node => node.type === h.children.NumericEditor);
        const inputs = editors.map(editor => ({ disabled: editor.props.disabled, focus: jest.fn() }));
        editors.forEach((editor, index) => editor.props.inputRef(inputs[index]));
        const review = elements(tree, node => node.type === 'button' && node.ref)[0];
        const reviewFocus = jest.fn(); review.ref.current = { focus: reviewFocus };
        editors[0].props.onEnterNext();
        expect(inputs[3].focus).toHaveBeenCalledTimes(1);
        expect(inputs[1].focus).not.toHaveBeenCalled();
        expect(inputs[2].focus).not.toHaveBeenCalled();
        editors[3].props.onEnterNext(); expect(reviewFocus).toHaveBeenCalledTimes(1);
        expect(elements(tree, node => node.type === 'input' && String(node.props['aria-label']).startsWith('Select display')).every(node => node.props.tabIndex === -1)).toBe(true);
        expect(elements(tree, node => node.type === 'button' && node.props.children === 'Inspect →').every(node => node.props.tabIndex === -1)).toBe(true);
    });
    test('reanalysis starts empty in grid; historical value appears only as a muted hint', () => {
        const h = harness('WorksheetArea');
        const tree = h.render({ activeGroup: { analysis: 'PH_H2O', items: [item('repeat', { status: 'REANALYSIS_REQUIRED', currentResult: '8', previousResult: { value: '8', isValid: false } })] } });
        expect(child(h, tree, 'NumericEditor').props.value).toBe('');
        const hintProps = child(h, tree, 'PreviousResultHint').props;
        const html = ReactDOMServer.renderToStaticMarkup(harness('PreviousResultHint').render(hintProps));
        expect(html).toContain('Previous'); expect(html).toContain('8'); expect(html).toContain('rejected'); expect(html).toContain('text-sf-muted');
    });
    test('card draft callback persists through IndexedDB and the shared debounced batch-save', async () => {
        jest.useFakeTimers();
        const groups = [{ analysis: 'PH_H2O', items: [item('card')] }];
        const axios = { post: jest.fn().mockResolvedValue({ data: { saved: 1 } }) };
        const offline = { saveLocalDraft: jest.fn().mockResolvedValue(), recordSyncOperation: jest.fn() };
        const h = harness('WorkbenchShell', { groups, axios, offline });
        const tree = h.render({ initialAnalysis: 'PH_H2O' });
        child(h, tree, 'WorksheetArea').props.onDraftChange('card', '6.2');
        expect(offline.saveLocalDraft).toHaveBeenCalledWith('draft:tech:card', expect.objectContaining({ value: '6.2' }));
        await jest.advanceTimersByTimeAsync(800);
        expect(axios.post).toHaveBeenCalledWith('/api/workbench/batch-save', expect.objectContaining({ draft: true, entries: [expect.objectContaining({ workItemId: 'card', value: '6.2' })] }));
    });
    test.each(['partial', 'all failed'])('%s commit displays failed rows, prevents submission and retries only failures', async kind => {
        jest.useFakeTimers();
        const groups = [{ analysis: 'PH_H2O', items: [item('one', { draft: { value: '6' } }), item('two', { draft: { value: '7' } })] }];
        const errors = [{ workItemId: 'two', error: 'Instrument became unavailable', code: 'EXECUTION_BLOCKED' }];
        const response = { saved: kind === 'partial' ? 1 : 0, partial: kind === 'partial', success: false, errors, results: kind === 'partial' ? [{ workItemId: 'one' }] : [] };
        const axios = { get: jest.fn().mockResolvedValue({ data: { groups, receipts: [] } }), post: jest.fn(async url => {
            if (url.endsWith('/commit')) {
                if (kind === 'all failed') throw { response: { status: 422, data: response } };
                return { data: response };
            }
            return { data: { included: [{ workItemId: 'two' }], excluded: [] } };
        }) };
        const offline = { getLocalDraft: jest.fn().mockResolvedValue(null) };
        const h = harness('WorkbenchShell', { groups, axios, offline });
        let tree = h.render({ initialAnalysis: 'PH_H2O' });
        await child(h, tree, 'WorksheetArea').props.onReviewRecord(['one', 'two']);
        tree = h.render({ initialAnalysis: 'PH_H2O' });
        await child(h, tree, 'ReviewCompletionView').props.onCommit([{ workItemId: 'one', value: '6' }, { workItemId: 'two', value: '7' }]);
        tree = h.render({ initialAnalysis: 'PH_H2O' });
        const receipt = child(h, tree, 'CompletionReceipt');
        expect(receipt.props.receipt.errors).toEqual([expect.objectContaining({ workItemId: 'two', sampleDisplayId: 'display-two' })]);
        const html = ReactDOMServer.renderToStaticMarkup(harness('CompletionReceipt').render(receipt.props));
        expect(html).toContain('display-two'); expect(html).toContain('Instrument became unavailable'); expect(html).toContain('Retry failed');
        expect(child(h, tree, 'ReviewCompletionView').props.previewData.included).toEqual([]);
        expect(axios.post.mock.calls.some(([url]) => url.includes('/submissions/'))).toBe(false);
        axios.post.mockClear();
        await receipt.props.onRetry();
        expect(axios.post).toHaveBeenCalledWith('/api/workbench/v2/completion/preview', { entries: [expect.objectContaining({ workItemId: 'two', value: '7' })] });
    });
    test('Escape restoration cancels a pending server/outbox save and changes only the local draft', async () => {
        jest.useFakeTimers();
        const groups = [{ analysis: 'PH_H2O', items: [item('escape', { draft: { value: '6.2' } })] }];
        const axios = { post: jest.fn().mockResolvedValue({ data: {} }) };
        const offline = { saveLocalDraft: jest.fn().mockResolvedValue(), removePendingDraftOperations: jest.fn().mockResolvedValue(), recordSyncOperation: jest.fn() };
        const h = harness('WorkbenchShell', { groups, axios, offline });
        let tree = h.render({ initialAnalysis: 'PH_H2O' });
        child(h, tree, 'WorksheetArea').props.onDraftChange('escape', '7'); tree = h.render({ initialAnalysis: 'PH_H2O' });
        child(h, tree, 'WorksheetArea').props.onRevertDraft('escape', '6.2'); tree = h.render({ initialAnalysis: 'PH_H2O' });
        await jest.advanceTimersByTimeAsync(1000);
        expect(axios.post).not.toHaveBeenCalled(); expect(offline.recordSyncOperation).not.toHaveBeenCalled();
        expect(offline.removePendingDraftOperations).toHaveBeenCalledWith('escape', 'tech');
        expect(child(h, tree, 'WorksheetArea').props.activeGroup.items[0].draft.value).toBe('6.2');
    });
    test('completion preview never substitutes a previous result for a missing draft', async () => {
        const groups = [{ analysis: 'PH_H2O', items: [item('repeat', { currentResult: '99' })] }];
        const axios = { post: jest.fn().mockResolvedValue({ data: {} }) };
        const h = harness('WorkbenchShell', { groups, axios });
        await child(h, h.render({ initialAnalysis: 'PH_H2O' }), 'WorksheetArea').props.onReviewRecord(['repeat']);
        expect(axios.post.mock.calls[0][1].entries[0].value).toBeUndefined();
    });
    test('Audit4.1: completion uses the server RUN instrument even when a retained draft names another instrument', async () => {
        const groups = [{ analysis: 'PH_H2O', items: [item('run-row', { equipmentId: 'run-A', instrumentSource: 'RUN',
            draft: { value: '7', instrumentId: 'old-B' } })] }];
        const axios = { post: jest.fn().mockResolvedValue({ data: { included: [], excluded: [] } }) };
        const h = harness('WorkbenchShell', { groups, axios });
        await child(h, h.render({ initialAnalysis: 'PH_H2O' }), 'WorksheetArea').props.onReviewRecord(['run-row']);
        expect(axios.post).toHaveBeenCalledWith('/api/workbench/v2/completion/preview', { entries: [expect.objectContaining({
            workItemId: 'run-row', value: '7', equipmentId: 'run-A'
        })] });
    });
});
