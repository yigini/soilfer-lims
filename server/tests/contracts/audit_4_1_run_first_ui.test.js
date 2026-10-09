const fs = require('node:fs'), path = require('node:path');
const { mountUi, nodes } = require('../helpers/qcWorksheetUi');
const group = count => ({ analysis: 'A', analysisName: 'Owned analysis', items: Array.from({ length: count }, (_, index) => ({
    workItemId: `item-${index}`, sampleId: `sample-${index}`, sampleDisplayId: `CODE-${index}`, originalId: `ORIGINAL-${index}`,
    laboratoryId: 'owned-lab', methodologyId: 'method', status: 'ASSIGNED', readiness: { isReady: false, blockers: ['INSTRUMENT_REQUIRED'] }
})) });
const options = { labId: 'owned-lab', defaultMethodologyId: 'method', methodologyId: 'method', maxBatchSize: 40, equipmentRequired: true,
    methods: [{ id: 'method', analysisCode: 'A', name: 'Owned method' }], eligibleEquipment: [{ id: 'instrument', name: 'Qualified instrument' }] };
function api(data = options) { return { get: jest.fn(async () => ({ data })), post: jest.fn(async () => ({ data: { batch: { id: 'started-run' } } })) }; }
async function form(count = 40, data = options) {
    const axios = api(data), onStarted = jest.fn(), groups = [group(count)];
    const view = mountUi('components/workbench/StartRunForm.jsx', { groups, onStarted, onCancel: jest.fn() }, { axios });
    await view.render();
    view.find('start-run-analysis').props.onChange({ target: { value: JSON.stringify(['A', 'owned-lab']) } }); await view.render();
    return { view, axios, onStarted };
}
test('My runs is the default server filter; All runs is available to every existing reader', async () => {
    const axios = api({ data: [] });
    const view = mountUi('components/workbench/MyRunsPanel.jsx', { groups: [], onOpenRun: jest.fn() }, { canEdit: false, axios });
    await view.render();
    expect(axios.get).toHaveBeenLastCalledWith('/api/qc/batches', { params: { view: 'my_runs' } });
    expect(view.find('my-runs-start')).toBeUndefined();
    view.find('my-runs-filter').props.onChange({ target: { value: 'all_runs' } }); await view.render();
    expect(axios.get).toHaveBeenLastCalledWith('/api/qc/batches', { params: { view: 'all_runs' } });
});
test('a 40-sample run reaches one atomic confirmation in six interactions, with the real form callbacks and policy/default/eligible data', async () => {
    const list = mountUi('components/workbench/MyRunsPanel.jsx', { groups: [group(40)] }, { axios: api({ data: [] }) });
    await list.render(); let interactions = 0;
    list.find('my-runs-start').props.onClick(); interactions++; await list.render();
    const start = list.all().find(node => node.type === list.children['./StartRunForm']); expect(start).toBeDefined();
    const { view, axios, onStarted } = await form(); interactions++; // Analysis selection in form().
    expect(view.find('start-run-method').props.value).toBe('method');
    view.find('start-run-method').props.onChange({ target: { value: 'method' } }); interactions++; await view.render();
    expect(view.find('start-run-confirm').props.disabled).toBeTruthy();
    view.find('start-run-instrument').props.onChange({ target: { value: 'instrument' } }); interactions++; await view.render();
    view.find('start-run-select-all').props.onClick(); interactions++; await view.render();
    expect(view.find('start-run-confirm').props.disabled).toBeFalsy();
    await view.find('start-run-form').props.onSubmit({ preventDefault: jest.fn() }); interactions++;
    expect(interactions).toBe(6);
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith('/api/qc/runs/start', { analysisCode: 'A', labId: 'owned-lab', methodologyId: 'method',
        instrumentId: 'instrument', workItemIds: Array.from({ length: 40 }, (_, index) => `item-${index}`) });
    expect(onStarted).toHaveBeenCalledWith({ id: 'started-run' });
});
test('capacity comes from the response; scanning selects a sample and never submits the form', async () => {
    const { view, axios } = await form(2, { ...options, maxBatchSize: 1 });
    view.find('start-run-instrument').props.onChange({ target: { value: 'instrument' } }); await view.render();
    expect(view.find('start-run-select-all').props.disabled).toBeTruthy();
    view.find('start-run-scan').props.onChange({ target: { value: 'CODE-0' } }); await view.render();
    const event = { key: 'Enter', preventDefault: jest.fn(), stopPropagation: jest.fn() };
    view.find('start-run-scan').props.onKeyDown(event); await view.render();
    expect(event.preventDefault).toHaveBeenCalled(); expect(axios.post).not.toHaveBeenCalled();
    const checkboxes = view.all().filter(node => node.type === 'input' && node.props.type === 'checkbox');
    expect(checkboxes[0].props.checked).toBe(true); expect(checkboxes[1].props.disabled).toBe(true);
    view.find('start-run-scan').props.onChange({ target: { value: 'CODE-1' } }); await view.render();
    view.find('start-run-scan').props.onKeyDown(event); await view.render();
    expect(view.text()).toContain('runFirst.capacityReached');
});
test('method changes discard prior sample/instrument selections, and only the new method gets offered', async () => {
    const { view, axios } = await form(1);
    view.find('start-run-instrument').props.onChange({ target: { value: 'instrument' } }); await view.render();
    view.find('start-run-select-all').props.onClick(); await view.render();
    axios.get.mockResolvedValue({ data: { ...options, methodologyId: 'other', methods: [...options.methods, { id: 'other', analysisCode: 'A', name: 'Other method' }] } });
    view.find('start-run-method').props.onChange({ target: { value: 'other' } }); await view.render();
    expect(view.find('start-run-instrument').props.value).toBe('');
    expect(view.all().filter(node => node.type === 'input' && node.props.type === 'checkbox')).toHaveLength(0);
    expect(view.find('start-run-confirm').props.disabled).toBeTruthy();
});
test('unknown historical method revision is explicit, context has no row override, and post-start withdrawal is absent', async () => {
    const batch = { id: 'run', analysis: 'A', status: 'RUNNING', startedAt: '2026-10-09T00:00:00Z', analystUsername: 'recorded-analyst', instrument: 'Recorded instrument',
        reagentLots: [{ id: 'link', inventoryLotId: 'lot', inventoryLot: { lotNumber: 'retained-lot' }, role: 'extractant' }],
        analytes: [{ analysisCode: 'A', status: 'IN_RUN', methodRevision: null, methodRevisionSource: 'UNKNOWN' }] };
    const view = mountUi('components/workbench/RunHeader.jsx', { batch, canEdit: true }, { axios: api({ data: [] }) }); await view.render();
    expect(view.find('run-method-revision').props.children[0]).toBe('runFirst.methodUnknown');
    expect(view.text()).toContain('Recorded instrument'); expect(view.text()).toContain('recorded-analyst');
    expect(view.all().some(node => node.type === 'button' && node.props.children === 'runFirst.withdraw')).toBe(false);
    expect(view.all().some(node => node.type === 'input' && ['instrument', 'method', 'analyst', 'startedAt'].includes(node.props.name))).toBe(false);
    const revision = { methodologyId: 'method', name: 'Retained method', standard: 'Retained standard', version: 7 };
    await view.render({ batch: { ...batch, analytes: [{ ...batch.analytes[0], methodRevision: revision, methodRevisionSource: 'FROZEN' }] } });
    expect(view.text()).toContain('Retained method'); expect(view.text()).toContain('runFirst.frozen');
});
test('all run-first labels and stable rule messages exist in all five client and server locales', () => {
    const root = path.resolve(__dirname, '../../..');
    const baseline = require('../../../client/src/translations/en.json').runFirst;
    for (const directory of ['client/src/translations', 'server/locales']) for (const locale of ['en', 'es', 'es-419', 'fr', 'pt']) {
        const values = JSON.parse(fs.readFileSync(path.join(root, directory, locale + '.json'), 'utf8')).runFirst;
        expect(Object.keys(values).sort()).toEqual(Object.keys(baseline).sort());
        expect(Object.keys(values.errors).sort()).toEqual(Object.keys(baseline.errors).sort());
        for (const value of [...Object.values(values).filter(value => typeof value === 'string'), ...Object.values(values.errors)]) expect(value.trim()).not.toBe('');
    }
});
