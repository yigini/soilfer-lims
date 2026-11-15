const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const React = require('../../../client/node_modules/react');
const esbuild = require('../../../client/node_modules/esbuild');
const { JSDOM } = require('jsdom');
const { localeTranslator } = require('../helpers/clientTranslation');
const { nodes, content } = require('../helpers/qcWorksheetUi');
const rootPath = path.resolve(__dirname, '../../../client/src');
const locales = ['en', 'fr', 'pt', 'es', 'es-419'];
const packs = Object.fromEntries(locales.map(locale => [locale, require(`../../../client/src/translations/${locale}.json`)]));
let mounted;
const flush = callback => React.act(async () => { await callback?.(); await new Promise(resolve => setImmediate(resolve)); });
async function mount(file, props, locale, named = null, axios = { get: jest.fn(async () => ({ data: [] })), post: jest.fn() }) {
    const dom = new JSDOM('<html><body><div id="root"></div></body></html>', { url: 'http://localhost/' });
    global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator;
    global.IS_REACT_ACT_ENVIRONMENT = true;
    const t = localeTranslator(locale), cache = {};
    function load(filename, exportName) {
        const key = filename + (exportName || '');
        if (cache[key]) return cache[key];
        if (filename.endsWith('.json')) return JSON.parse(fs.readFileSync(filename, 'utf8'));
        const module = { exports: {} };
        const source = fs.readFileSync(filename, 'utf8') + (exportName ? `\nexport { ${exportName} as Tested };` : '');
        vm.runInNewContext(esbuild.transformSync(source, { loader: filename.endsWith('.jsx') ? 'jsx' : 'js', format: 'cjs' }).code, {
            module, exports: module.exports, React, console, Date, setTimeout, clearTimeout,
            FormData: dom.window.FormData, FileReader: dom.window.FileReader, window: dom.window, document: dom.window.document,
            require(name) {
                if (name === 'react') return React;
                if (name === 'axios') return axios;
                if (name === 'lucide-react') return new Proxy({}, { get: () => () => null });
                if (name.includes('LanguageContext')) return { useLanguage: () => ({ t, language: locale }) };
                if (name.includes('DialogContext')) return { useDialog: () => ({ showDialog: jest.fn() }) };
                if (name.includes('AuthContext')) return { useAuth: () => ({ user: { username: 'fixture-tech' }, hasPermission: () => true }) };
                if (name === '@lims/number-parse') return require('../../../shared/numberParse');
                if (name === '@lims/soil-calculation') return require('../../../shared/soilCalculation');
                if (name === '@lims/delimited-text') return require('../../../shared/delimitedText');
                if (name.endsWith('.json')) return load(path.resolve(path.dirname(filename), name));
                if (/soilCalculations|qcWorksheetNavigation|useRealtimeData|spectralWorkflowRequest/.test(name))
                    return load(path.resolve(path.dirname(filename), name + '.js'));
                if (name === './PreparationRecordFields') return load(path.resolve(path.dirname(filename), name + '.jsx'));
                return () => null;
            }
        });
        return cache[key] = module.exports;
    }
    const component = load(path.resolve(rootPath, file), named)[named ? 'Tested' : 'default'];
    const root = require('../../../client/node_modules/react-dom/client').createRoot(document.getElementById('root'));
    mounted = { root, dom, t, axios, text: () => document.body.textContent,
        change: async (element, value) => flush(() => {
            const proto = element.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : element.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
            Object.getOwnPropertyDescriptor(proto, 'value').set.call(element, value);
            element.dispatchEvent(new dom.window.Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
        }), click: async element => { expect(element).toBeDefined(); await flush(() => element.click()); },
        button: label => [...document.querySelectorAll('button')].find(node => node.textContent.trim() === label)
    };
    await flush(() => root.render(React.createElement(component, props)));
    return mounted;
}
afterEach(async () => { if (mounted) { await flush(() => mounted.root.unmount()); mounted.dom.window.close(); mounted = null; }
    delete global.window; delete global.document; delete global.navigator; delete global.IS_REACT_ACT_ENVIRONMENT; });
const flatten = (value, prefix = '') => Object.fromEntries(Object.entries(value).flatMap(([key, item]) =>
    typeof item === 'string' ? [[prefix + key, item]] : Object.entries(flatten(item, prefix + key + '.'))));
test('new five-locale dictionaries have complete keys and matching interpolation parameters', () => {
    for (const namespace of ['workbenchRare', 'spectralUi', 'equipment.qualificationLabels', 'inventory.lotStatuses']) {
        const lookup = pack => namespace.split('.').reduce((value, key) => value[key], pack);
        const base = flatten(lookup(packs.en));
        for (const locale of locales) {
            const rows = flatten(lookup(packs[locale])); expect(Object.keys(rows).sort()).toEqual(Object.keys(base).sort());
            for (const key of Object.keys(base)) { expect(rows[key].trim()).not.toBe('');
                const params = text => [...text.matchAll(/{{(\w+)}}/g)].map(match => match[1]).sort();
                expect(params(rows[key])).toEqual(params(base[key])); }
        }
    }
});
test.each(locales)('%s texture labels, tolerance and fraction edits preserve numeric text', async locale => {
    const onChange = jest.fn(), t = localeTranslator(locale);
    const view = await mount('components/workbench/TextureEditor.jsx', { values: ['40', '40', '30'], tolerance: 2, sampleId: 'TEST-1', numberFormat: { decimal: '.', thousands: null }, onChange }, locale);
    expect(view.text()).toContain(t('workbenchRare.sand')); expect(view.text()).toContain(t('workbenchRare.sum', { total: 110 }));
    expect(document.querySelector('[title]').title).toBe(t('workbenchRare.closureTolerance', { total: 110, tolerance: 2 }));
    await view.change(document.querySelector('input[aria-label]'), '35,50');
    expect(onChange).toHaveBeenCalledWith({ sand: '35,50', silt: '40', clay: '30' });
});
test.each(locales)('%s concurrency resolution still requires a reason and preserves both values', async locale => {
    const onUseServer = jest.fn(), onKeepLocal = jest.fn();
    const view = await mount('components/workbench/ConflictComparePanel.jsx', { localValue: '6,2', serverValue: '6.4', onUseServer, onKeepLocal }, locale);
    const { t } = view;
    expect(view.text()).toContain('6,2'); expect(view.text()).toContain('6.4');
    await view.click(view.button(t('workbenchRare.keepLocal')));
    expect(view.text()).toContain(t('workbenchRare.reasonMandatory')); expect(onKeepLocal).not.toHaveBeenCalled();
    await view.change(document.querySelector('textarea'), '  checked the notebook  ');
    await view.click(view.button(t('workbenchRare.keepLocal'))); expect(onKeepLocal).toHaveBeenCalledWith('checked the notebook');
    await view.click(view.button(t('workbenchRare.adoptServer', { value: '6.4' }))); expect(onUseServer).toHaveBeenCalledTimes(1);
});
test.each(locales)('%s preparation labels retain gate/method/equipment codes in the callback', async locale => {
    const onChange = jest.fn();
    const view = await mount('components/workbench/PreparationRecordFields.jsx', { steps: ['DRYING'], records: [{ gateCode: 'DRYING', massBeforeG: '9.00' }], onChange, equipment: [{ id: 'oven-1', name: 'Oven fixture' }] }, locale);
    const { t } = view;
    expect(view.text()).toContain(t('workbench.preparationRecord.steps.DRYING'));
    await view.change(document.querySelector('select'), 'OVEN_40');
    expect(onChange).toHaveBeenLastCalledWith([{ gateCode: 'DRYING', massBeforeG: '9.00', method: 'OVEN_40' }]);
    expect([...document.querySelectorAll('option')].map(node => node.value)).toContain('oven-1');
});
test.each(locales)('%s operational checklist translates shared steps and retains boolean evidence', async locale => {
    const onChange = jest.fn();
    const view = await mount('components/workbench/OperationalTaskEditor.jsx', { analysis: 'DRYING', onChange, checks: [false, false, false] }, locale);
    const { t } = view;
    for (let index = 0; index < 3; index++) expect(view.text()).toContain(t(`workbenchRare.checklist.DRYING${index}`));
    await view.click([...document.querySelectorAll('button')][1]); expect(onChange).toHaveBeenCalledWith([false, true, false]);
    const canonical = require('../../data/operationalChecklists.json');
    expect(packs.en.workbenchRare.checklist.DRYING0).toBe(canonical.DRYING.steps[0]);
    expect(packs.en.workbenchRare.checklist.PREPARATION2).toBe(canonical.PREPARATION.steps[2]);
});
test.each(locales)('%s spectral wizard preserves stage decisions, confirmation and commit payload', async locale => {
    const item = { id: 'scan-1', filename: 'demo.opus', modality: 'MIR', axisUnit: 'WAVENUMBER_CM1', wavelengths: [4000, 3999], values: [1, 2], qcStatus: 'WARN', qcFlags: ['FIXTURE_WARNING'], duplicate: true, suggestedAction: 'ADD_REPLICATE', matchedSample: { id: 'sample-1', sampleDisplayId: 'DEMO-001' }, matchedWorkItem: { id: 'work-1' } };
    const axios = { get: jest.fn(), post: jest.fn(async url => ({ data: url.endsWith('/preview') ? { manifestId: 'manifest-1', items: [item] } : { complete: true, success: 1, failed: 0, manifestId: 'manifest-1' } })) };
    const view = await mount('components/workbench/SpectralIntakeModal.jsx', { isOpen: true, modality: 'SPEC_MIR', eligibleEquipment: [{ id: 'meter-1', name: 'FTIR fixture', status: 'OPERATIONAL' }] }, locale, null, axios);
    const { t } = view;
    expect(view.text()).toContain(t('spectralUi.engine'));
    const input = document.querySelector('input[type=file]');
    Object.defineProperty(input, 'files', { value: [new window.File(['fixture'], 'demo.opus')] });
    await flush(() => input.dispatchEvent(new window.Event('change', { bubbles: true })));
    await view.click(view.button(t('spectralUi.stageInspect')));
    expect(axios.post).toHaveBeenCalledTimes(1); expect(view.text()).toContain(t('spectralUi.qcWarning'));
    const decisions = document.querySelector('select');
    expect([...decisions.options].map(node => node.value)).toEqual(['REPLACE', 'ADD_REPLICATE', 'SKIP']);
    await view.change(decisions, 'REPLACE');
    await view.click(view.button(t('spectralUi.reviewImport', { count: 1 })));
    const commit = view.button(t('spectralUi.commitScans', { count: 1 }));
    expect(commit.disabled).toBe(true);
    const checks = [...document.querySelectorAll('input[type=checkbox]')];
    await view.click(checks[0]); expect(commit.disabled).toBe(true); await view.click(checks[1]);
    expect(commit.disabled).toBe(false); await view.click(commit);
    const payload = axios.post.mock.calls.find(([url]) => url.endsWith('/commit'))[1];
    expect(payload.manifestId).toBe('manifest-1'); expect(payload.equipmentId).toBe('meter-1');
    expect(payload.decisions['scan-1']).toMatchObject({ decision: 'REPLACE', sampleId: 'sample-1', targetWorkItemId: 'work-1' });
    expect(view.text()).toContain(t('spectralWorkflow.receiptTitle'));
});
test.each(locales)('%s maintenance labels do not change readiness or pending-signoff interpretation', async locale => {
    const view = await mount('components/equipment/EquipmentDetailDrawer.jsx', { asset: { readiness: 'READY', status: 'OPERATIONAL', qualification: { calibrationStatus: 'DUE_SOON', verificationStatus: 'NOT_CONFIGURED' } }, pendingKinds: [], canManage: false }, locale, 'MaintenanceTab');
    const { t } = view;
    expect(view.text()).toContain(t('equipment.systemCheck', { status: t('equipment.qualificationLabels.OPERATIONAL'), calibration: t('equipment.qualificationLabels.DUE_SOON') }));
    expect(view.text()).toContain(t('equipment.unscheduled'));
    expect(view.text()).toContain(t('equipment.qualificationLabels.NOT_CONFIGURED'));
    expect(document.querySelector('[data-testid=equipment-maintenance-awaiting-signoff]')).toBeNull();
});
test.each(locales)('%s parent-lot selection offers only usable states in the selected laboratory', async locale => {
    const lots = ['AVAILABLE', 'QUARANTINED', 'EXPIRED', 'DEPLETED', 'DISPOSED'].map(status => ({ id: status, lotNumber: status + '-lot', labId: 'lab-1', status, item: { name: 'Parent' } }));
    lots.push({ id: 'other', lotNumber: 'other-lab', labId: 'lab-2', status: 'AVAILABLE' });
    const axios = { get: jest.fn(async () => ({ data: lots })), post: jest.fn() };
    const view = await mount('pages/Inventory.jsx', { show: true, initialItemId: 'item-1', items: [{ id: 'item-1', labId: 'lab-1', isActive: true, itemType: 'REAGENT', name: 'Test reagent' }], locations: [], actor: { username: 'fixture-tech' } }, locale, 'ReceiveStockModal', axios);
    const ids = [...document.querySelectorAll('input[data-testid^=prepared-lot-parent-]')].map(node => node.dataset.testid);
    expect(ids).toEqual(['prepared-lot-parent-AVAILABLE', 'prepared-lot-parent-QUARANTINED']);
    expect(view.text()).toContain(view.t('inventory.lotStatuses.QUARANTINED'));
});
test.each(['Manager', 'Technician', 'Reception', 'Oversight'])('%s dashboard passes the active translator to elapsed time', async dashboard => {
    const view = await mount(`components/dashboard/${dashboard}Dashboard.jsx`, { isLive: true, isStale: false, lastUpdated: new Date(Date.now() - 5000) }, 'fr', 'LiveBadge');
    expect(view.text()).toContain(view.t('workbenchUi.secondsAgo', { count: 5 }));
});
test('manager queue passes its translator to elapsed time', async () => {
    const t = localeTranslator('pt');
    const view = await mount('pages/ManagerQueue.jsx', { isLive: true, lastUpdated: new Date(Date.now() - 5000), t }, 'pt', 'LiveBadge');
    expect(view.text()).toContain(t('workbenchUi.secondsAgo', { count: 5 }));
});
