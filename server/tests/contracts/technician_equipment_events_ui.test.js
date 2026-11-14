const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { JSDOM } = require('jsdom');
const React = require('../../../client/node_modules/react');
const esbuild = require('../../../client/node_modules/esbuild');
const { localeTranslator } = require('../helpers/clientTranslation');
const { registry } = require('../../config/policyRegistry');
const eventTypes = require('../../../shared/technicianEquipmentEventTypes.json');
const locales = ['en', 'fr', 'pt', 'es', 'es-419'];
const actor = { username: 'tech-a', role: 'LAB_TECHNICIAN', labId: 'lab-a' };
const meter = { id: 'meter', name: 'Practice meter', assetType: 'PH_METER', status: 'IN_SERVICE', criticality: 'CRITICAL',
    labId: 'lab-a', readiness: 'READY', qualification: {}, createdAt: '2026-01-01T00:00:00Z', scheduleRules: [], events: [] };
const pending = { id: 'event', userId: actor.username, requiresManagerSignoff: true, eventType: 'CALIBRATION_PERFORMED',
    outcome: 'PASS', summary: 'Practice calibration', ts: '2026-01-02T00:00:00Z' };
let dom, root, axios, t, currentProps, Component;
const flush = async callback => React.act(async () => { await callback?.(); await new Promise(resolve => setImmediate(resolve)); });
const buttons = () => [...document.querySelectorAll('button')];
const button = label => { const node = buttons().find(value => value.textContent.trim() === label); expect(node).toBeDefined(); return node; };
const click = async node => { expect(node).toBeDefined(); await flush(() => node.click()); };
const change = async (node, value) => {
    expect(node).toBeDefined();
    await flush(() => {
        const prototype = node.tagName === 'SELECT' ? window.HTMLSelectElement.prototype :
            node.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, 'value').set.call(node, value);
        node.dispatchEvent(new window.Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    });
};
const submit = async () => flush(() => document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
async function mount(file, props = {}, { locale = 'en', selected = 'default', asset = meter } = {}) {
    t = localeTranslator(locale); currentProps = props;
    dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' });
    global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator;
    global.IS_REACT_ACT_ENVIRONMENT = true;
    axios = { get: jest.fn(async () => ({ data: asset })), post: jest.fn(async () => ({ data: {} })), patch: jest.fn(async () => ({ data: {} })) };
    const cache = new Map(), directory = path.resolve(__dirname, '../../../client/src/components/equipment');
    function load(relative, selectedName = 'default') {
        const key = relative + ':' + selectedName; if (cache.has(key)) return cache.get(key);
        const absolute = path.join(directory, relative); let source = fs.readFileSync(absolute, 'utf8');
        if (selectedName !== 'default') source += `\nexport { ${selectedName} as SelectedComponent };`;
        const code = esbuild.transformSync(source, { loader: 'jsx', format: 'cjs' }).code, module = { exports: {} };
        vm.runInNewContext(code, { module, exports: module.exports, console, Date, require: name => {
            if (name === 'react') return React;
            if (name === 'axios') return axios;
            if (name === 'lucide-react') return new Proxy({}, { get: () => () => null });
            if (name.includes('LanguageContext')) return { useLanguage: () => ({ t, language: locale }) };
            if (name.includes('AnalysisCatalogueContext')) return { useAnalysisNames: () => (code, label) => label || code };
            if (name === './LogEventModal') return load('LogEventModal.jsx');
            if (name === './RegisterAssetModal') return () => null;
            if (name.endsWith('.json')) return require(path.resolve(path.dirname(absolute), name));
            throw Error('Unexpected equipment UI dependency: ' + name);
        } });
        cache.set(key, module.exports); return module.exports;
    }
    const exported = load(file, selected); Component = selected === 'default' ? exported.default : exported.SelectedComponent;
    root = require('../../../client/node_modules/react-dom/client').createRoot(document.getElementById('root'));
    await flush(() => root.render(React.createElement(Component, currentProps)));
}
const render = async patch => { currentProps = { ...currentProps, ...patch }; await flush(() => root.render(React.createElement(Component, currentProps))); };
afterEach(async () => {
    if (root) await flush(() => root.unmount());
    dom?.window.close(); root = null; dom = null;
    delete global.window; delete global.document; delete global.navigator; delete global.IS_REACT_ACT_ENVIRONMENT;
});

test.each(locales)('%s: real technician form offers six translated types and sends matching outcomes', async locale => {
    const onSuccess = jest.fn(), onClose = jest.fn();
    await mount('LogEventModal.jsx', { show: true, asset: meter, canManage: false, canLog: true, onSuccess, onClose }, { locale });
    const select = document.querySelector('select');
    expect([...select.options].map(node => node.value)).toEqual(eventTypes);
    expect([...select.options].map(node => node.textContent)).toEqual(eventTypes.map(type => t('equipment.technicianEvents.' + type)));
    expect(document.body.textContent).toContain(t('equipment.technicianEventHelp'));
    for (const type of eventTypes) {
        await change(select, type);
        await change(document.querySelector('input[required]:not([type="date"])'), 'Practice ' + type);
        const outcome = type.endsWith('_FAILED') ? 'FAIL' : 'PASS';
        expect(document.body.textContent).toContain(t('equipment.eventOutcomes.' + outcome));
        expect(document.body.textContent).not.toContain('equipment.eventOutcomes.');
        const dates = document.querySelectorAll('input[type="date"]');
        expect(dates.length).toBe(type.startsWith('MAINTENANCE') ? 1 : 2);
        if (dates.length === 2) await change(dates[1], '2099-01-01');
        await submit();
        expect(axios.post).toHaveBeenLastCalledWith('/api/equipment/events', expect.objectContaining({ equipmentId: meter.id,
            eventType: type, summary: 'Practice ' + type, outcome }));
    }
    expect(onSuccess).toHaveBeenCalledTimes(6); expect(onClose).toHaveBeenCalledTimes(6);
});

test('without management or logging permission the event form is absent', async () => {
    await mount('LogEventModal.jsx', { show: true, asset: meter, canManage: false, canLog: false });
    expect(document.querySelector('form')).toBeNull();
});

test('manager calibration keeps its legacy fields, type and payload', async () => {
    await mount('LogEventModal.jsx', { show: true, asset: meter, eventType: 'CALIBRATION', canManage: true, onSuccess: jest.fn(), onClose: jest.fn() });
    expect(document.querySelector('select')).toBeNull();
    for (const label of ['equipment.typeCalibration', 'equipment.typeVerification', 'equipment.typeMaintenance']) expect(button(t(label))).toBeDefined();
    await change(document.querySelector('input[required]:not([type="date"])'), 'Practice calibration');
    await change(document.querySelector('textarea'), 'Practice evidence');
    await change(document.querySelectorAll('input[type="date"]')[1], '2099-01-01'); await submit();
    expect(axios.post).toHaveBeenCalledWith('/api/equipment/events', { equipmentId: meter.id, eventType: 'CALIBRATION',
        summary: 'Practice calibration', performedDate: new Date().toISOString().slice(0, 10), details: 'Practice evidence', outcome: 'PASS', nextDueDate: '2099-01-01' });
});

test.each(locales)('%s: technician drawer opens the real log form without asset-management actions', async locale => {
    await mount('EquipmentDetailDrawer.jsx', { show: true, assetId: meter.id, canManage: false, canLog: true, actor }, { locale });
    const labels = buttons().map(node => node.textContent.trim()); expect(labels).toContain(t('equipment.logEvent'));
    for (const forbidden of ['Edit', 'Decommission', 'Log Maintenance', 'Calibration Task', 'Register Asset']) expect(labels).not.toContain(forbidden);
    await click(button(t('equipment.logEvent')));
    expect([...document.querySelector('form select').options].map(node => node.value)).toEqual(eventTypes);
});

test('maintenance warning renders in the selected language on an unconfigured instrument', async () => {
    await mount('EquipmentDetailDrawer.jsx', { show: true, assetId: meter.id, canManage: false, canLog: true, actor },
        { locale: 'fr', asset: { ...meter, readiness: 'WARNING', readinessWarnings: ['EQUIPMENT_NOT_CONFIGURED_WARNING'] } });
    await click(button('MAINTENANCE'));
    expect(document.body.textContent).toContain(t('equipment.unconfiguredWarning'));
});

test('technicians see a pending sign-off without decision controls', async () => {
    await mount('EquipmentDetailDrawer.jsx', { events: [pending], actor, canManage: false }, { selected: 'HistoryTab', locale: 'pt' });
    expect(document.querySelector('[role="status"]').textContent).toBe(t('equipment.pendingSignoff'));
    expect(buttons()).toHaveLength(0);
});

test('a manager cannot approve their own event, and a rejected event is no longer labelled pending', async () => {
    const manager = { username: 'manager-a', role: 'LAB_MANAGER' }, event = { ...pending, userId: 'manager-a' };
    await mount('EquipmentDetailDrawer.jsx', { events: [event], actor: manager, canManage: true }, { selected: 'HistoryTab' });
    expect(document.body.textContent).toContain(t('equipment.ownSignoffHelp'));
    expect(buttons()).toHaveLength(2); expect(buttons().every(node => node.disabled)).toBe(true);
    await render({ events: [{ ...event, managerDecision: 'REJECTED', managerReason: 'Repeat this calibration' }] });
    expect(document.querySelector('[role="status"]')).toBeNull(); expect(buttons()).toHaveLength(0);
    expect(document.body.textContent).toContain(t('equipment.signoffDecisions.REJECTED'));
});

test.each(['APPROVED', 'REJECTED'])('another manager sends %s with the trimmed existing disposition payload', async decision => {
    const onUpdate = jest.fn();
    await mount('EquipmentDetailDrawer.jsx', { events: [pending], actor: { username: 'reviewer', role: 'LAB_MANAGER' }, canManage: true, onUpdate }, { selected: 'HistoryTab' });
    await click(button(t('equipment.signoffActions.' + decision)));
    expect(button(t('equipment.saveSignoff')).disabled).toBe(true);
    await change(document.querySelector('form input'), '  Checked certificate  '); await submit();
    expect(axios.patch).toHaveBeenCalledWith('/api/equipment/events/event/disposition', { decision, reason: 'Checked certificate' });
    expect(onUpdate).toHaveBeenCalled();
});

test('a server sign-off refusal is shown with its translated message', async () => {
    await mount('EquipmentDetailDrawer.jsx', { events: [pending], actor: { username: 'reviewer', role: 'LAB_MANAGER' }, canManage: true }, { selected: 'HistoryTab', locale: 'es-419' });
    await click(button(t('equipment.signoffActions.APPROVED'))); await change(document.querySelector('form input'), 'Checked certificate');
    axios.patch.mockRejectedValueOnce({ response: { data: { code: 'EQUIPMENT_SIGNOFF_SELF', error: 'EQUIPMENT_SIGNOFF_SELF' } } });
    await submit(); expect(document.querySelector('[role="alert"]').textContent).toBe(t('equipment.eventErrors.EQUIPMENT_SIGNOFF_SELF'));
});

test('all new equipment labels and the lab-only policy resolve in five languages', () => {
    const added = ['eventHistory', 'noEvents', 'recordedOutcome', 'technicianEventHelp', 'ownSignoffHelp', 'pendingSignoff',
        'saveSignoff', 'signoffFailed', 'signoffReason', 'technicianEvents', 'signoffActions', 'signoffDecisions', 'eventErrors', 'eventOutcomes'];
    const leaves = (value, prefix = '') => value && typeof value === 'object' ? Object.entries(value).flatMap(([key, child]) => leaves(child, prefix + key + '.')) : [[prefix.slice(0, -1), value]];
    const english = require('../../../client/src/translations/en.json').equipment;
    const entries = added.flatMap(key => leaves(english[key], key + '.'));
    const parameters = value => [...value.matchAll(/{{(\w+)}}/g)].map(match => match[1]).sort();
    for (const locale of locales) {
        const translate = localeTranslator(locale);
        for (const [key, value] of entries) { const actual = translate('equipment.' + key); expect(actual).not.toBe('equipment.' + key); expect(actual.trim()).not.toBe(''); expect(parameters(actual)).toEqual(parameters(value)); }
        const policy = registry['equipment.technicianEventsRequireSignoff'];
        expect(policy).toMatchObject({ scope: 'LAB', presets: { ISO17025_STRICT: true, BASIC: false, ADVISORY: false } });
        expect(translate(policy.description)).not.toBe(policy.description); expect(translate(policy.help)).not.toBe(policy.help);
    }
});


test.each(['CALIBRATION', 'VERIFICATION'])('%s waiting for sign-off is explained without an overdue label or altered accepted dates', async kind => {
    const label = kind === 'CALIBRATION' ? 'Calibration' : 'Verification';
    const event = { ...pending, eventType: kind + '_PERFORMED', details: JSON.stringify({ performedDate: '2026-01-02', nextDueDate: '2028-01-01' }) };
    const asset = { ...meter, readiness: 'BLOCKED', qualification: { calibrationStatus: 'OK', verificationStatus: 'OK',
        [kind.toLowerCase() + 'Status']: 'OVERDUE', [`last${label}Date`]: '2026-01-01T00:00:00Z', [`next${label}DueDate`]: '2027-01-01T00:00:00Z' }, events: [event] };
    await mount('EquipmentDetailDrawer.jsx', { show: true, assetId: meter.id, canManage: false, canLog: true, actor }, { locale: 'fr', asset });
    expect(document.querySelector('[data-testid="equipment-awaiting-signoff"]').textContent).toBe(t('equipment.pendingSignoff'));
    await click(button('MAINTENANCE'));
    expect(document.querySelector('[data-testid="equipment-maintenance-awaiting-signoff"]').textContent).toBe(t('equipment.pendingSignoff'));
    expect(document.body.textContent).not.toContain('OVERDUE'); expect(document.body.textContent).not.toContain('overdue calibration');
    expect(document.body.textContent).toContain(new Date('2026-01-01T00:00:00Z').toLocaleDateString());
    expect(document.body.textContent).toContain(new Date('2027-01-01T00:00:00Z').toLocaleDateString());
    expect(document.body.textContent).not.toContain(new Date('2028-01-01T00:00:00Z').toLocaleDateString());
    expect(asset.qualification[kind.toLowerCase() + 'Status']).toBe('OVERDUE');
});

test.each(['CALIBRATION', 'VERIFICATION'])('%s older pending evidence recorded later does not mask a newer accepted pass in the drawer', async kind => {
    const older = { ...pending, eventType: kind + '_PERFORMED', ts: '2026-03-01T00:00:00Z', details: JSON.stringify({ performedDate: '2026-01-01' }) };
    const newer = { ...pending, id: 'newer', eventType: kind, userId: 'manager', requiresManagerSignoff: false, managerDecision: 'APPROVED',
        ts: '2026-02-01T00:00:00Z', details: JSON.stringify({ performedDate: '2026-02-01' }) };
    const asset = { ...meter, events: [older, newer], qualification: { calibrationStatus: 'OK', verificationStatus: 'OK' } };
    await mount('EquipmentDetailDrawer.jsx', { show: true, assetId: meter.id, canManage: false, canLog: true, actor }, { asset });
    expect(document.querySelector('[data-testid="equipment-awaiting-signoff"]')).toBeNull();
    await click(button('MAINTENANCE'));
    expect(document.querySelector('[data-testid="equipment-maintenance-awaiting-signoff"]')).toBeNull();
    expect(asset.events[0]).toBe(older);
});

test('matching performed dates retain the existing recorded-time tie breaker for the display reason', async () => {
    const details = JSON.stringify({ performedDate: '2026-01-01' });
    const events = [{ ...pending, ts: '2026-01-02T00:00:00Z', details },
        { ...pending, id: 'accepted', requiresManagerSignoff: false, managerDecision: 'APPROVED', ts: '2026-01-03T00:00:00Z', details }];
    await mount('EquipmentDetailDrawer.jsx', { show: true, assetId: meter.id, canManage: false, canLog: true, actor }, { asset: { ...meter, events } });
    expect(document.querySelector('[data-testid="equipment-awaiting-signoff"]')).toBeNull();
});

test.each([{ label: 'failed', event: { ...pending, outcome: 'FAIL' } }, { label: 'rejected', event: { ...pending, requiresManagerSignoff: false, managerDecision: 'REJECTED' } }])('$label evidence is not described as merely waiting for a signature', async ({ event }) => {
    await mount('EquipmentDetailDrawer.jsx', { show: true, assetId: meter.id, canManage: false, canLog: true, actor },
        { asset: { ...meter, status: 'OUT_OF_SERVICE', readiness: 'BLOCKED', events: [event] } });
    expect(document.querySelector('[data-testid="equipment-awaiting-signoff"]')).toBeNull();
});

test('the technician outcome refusal is rendered in the selected language', async () => {
    await mount('LogEventModal.jsx', { show: true, asset: meter, canManage: false, canLog: true, onSuccess: jest.fn(), onClose: jest.fn() }, { locale: 'es' });
    await change(document.querySelector('input[required]:not([type="date"])'), 'Practice calibration');
    await change(document.querySelectorAll('input[type="date"]')[1], '2099-01-01');
    axios.post.mockRejectedValueOnce({ response: { data: { code: 'EQUIPMENT_EVENT_OUTCOME_INVALID', error: 'EQUIPMENT_EVENT_OUTCOME_INVALID' } } });
    await submit(); expect(document.body.textContent).toContain(t('equipment.eventErrors.EQUIPMENT_EVENT_OUTCOME_INVALID'));
    expect(document.body.textContent).not.toContain('EQUIPMENT_EVENT_OUTCOME_INVALID');
});
