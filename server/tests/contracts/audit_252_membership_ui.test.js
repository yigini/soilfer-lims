const fs = require('node:fs'), path = require('node:path');
const { mountUi, nativeFixture } = require('../helpers/qcWorksheetUi');
const props = (items = [{ workItemId: 'wi-1', methodologyId: null }]) => ({ isOpen: true, analysisCode: 'A',
    selectedWorkItemIds: items.map(item => item.workItemId), selectedWorkItems: items, onOpenWorksheet: jest.fn() });
function client(methods = [{ id: 'method-a', name: 'Offered method A', analysisCode: 'A' }]) {
    return { get: jest.fn(async url => ({ data: url === '/api/config/methodologies' ? methods : { data: [] } })),
        post: jest.fn(async () => ({ data: { id: 'new-native-run' } })), put: jest.fn() };
}
const submit = view => view.all().find(node => node.type === 'form').props.onSubmit({ preventDefault: jest.fn() });

test('new run creation refuses empty selection in the actual UI callback without an HTTP write', async () => {
    const axios = client(), view = mountUi('components/workbench/BatchModal.jsx', props([]), { axios });
    await view.render(); expect(view.find('create-batch-btn').props.disabled).toBe(true);
    expect(view.find('batch-membership-required')).toBeDefined();
    await submit(view); expect(axios.post).not.toHaveBeenCalled();
});

test('method selector uses only offered analysis methods; creation posts membership and the explicit run method and opens its worksheet', async () => {
    const axios = client([{ id: 'method-a', name: 'Offered method A', analysisCode: 'A' },
        { id: 'method-b', name: 'Other analysis', analysisCode: 'B' }]);
    const view = mountUi('components/workbench/BatchModal.jsx', props(), { axios }); await view.render();
    expect(view.text()).toContain('Offered method A'); expect(view.text()).not.toContain('Other analysis');
    expect(view.find('create-batch-btn').props.disabled).toBe(true);
    view.find('batch-method-select').props.onChange({ target: { value: 'method-a' } }); await view.render();
    expect(view.find('create-batch-btn').props.disabled).toBe(false); await submit(view);
    expect(axios.post).toHaveBeenCalledWith('/api/qc/batches', { analysis: 'A', workItemIds: ['wi-1'],
        analyses: [{ analysisCode: 'A', methodologyId: 'method-a' }], instrument: '', notes: '' });
    expect(axios.post).toHaveBeenCalledTimes(1); expect(axios.put).not.toHaveBeenCalled();
    expect(view.props.onOpenWorksheet).toHaveBeenCalledWith('new-native-run');
    expect(view.props.selectedWorkItems[0].methodologyId).toBeNull();
});

test.each([false, true])('recorded method stays authoritative without an override selector (unrecorded companion=%s)', async companion => {
    const items = [{ workItemId: 'wi-1', methodologyId: 'recorded-method' },
        ...(companion ? [{ workItemId: 'wi-2', methodologyId: null }] : [])];
    const axios = client(), view = mountUi('components/workbench/BatchModal.jsx', props(items), { axios }); await view.render();
    expect(view.find('batch-method-select')).toBeUndefined(); expect(view.find('batch-recorded-method')).toBeDefined();
    expect(view.find('create-batch-btn').props.disabled).toBe(false); await submit(view);
    expect(axios.post.mock.calls[0][1].analyses).toEqual([{ analysisCode: 'A', ...(companion && { methodologyId: 'recorded-method' }) }]);
    expect(axios.put).not.toHaveBeenCalled(); expect(items.map(item=>item.methodologyId)).toEqual(companion ? ['recorded-method', null] : ['recorded-method']);
});

test('conflicting recorded methods block creation without changing either work item', async () => {
    const items = [{ workItemId: 'wi-1', methodologyId: 'one' }, { workItemId: 'wi-2', methodologyId: 'two' }];
    const axios = client(), view = mountUi('components/workbench/BatchModal.jsx', props(items), { axios }); await view.render();
    expect(view.find('batch-method-conflict')).toBeDefined(); expect(view.find('batch-method-select')).toBeUndefined();
    expect(view.find('create-batch-btn').props.disabled).toBe(true); await submit(view); expect(axios.post).not.toHaveBeenCalled();
});

test.each(['empty', 'failed'])('unavailable method catalogue (%s) cannot fall back to a default method', async state => {
    const axios = client([]); if (state === 'failed') axios.get.mockImplementation(async url => {
        if (url === '/api/config/methodologies') throw Error('Unavailable'); return { data: { data: [] } };
    });
    const view = mountUi('components/workbench/BatchModal.jsx', props(), { axios }); await view.render();
    expect(view.find(state === 'empty' ? 'batch-method-none' : 'batch-method-unavailable')).toBeDefined();
    expect(view.find('create-batch-btn').props.disabled).toBe(true); await submit(view); expect(axios.post).not.toHaveBeenCalled();
});

test('missing worksheet metadata and missing edit permission both prevent creation', async () => {
    for (const canEdit of [false, true]) {
        const axios = client(), input = props([{ workItemId: 'wi-1', methodologyId: 'recorded' }]);
        if (canEdit) input.selectedWorkItems = [];
        const view = mountUi('components/workbench/BatchModal.jsx', input, { axios, canEdit }); await view.render();
        expect(view.find('create-batch-btn').props.disabled).toBe(true); await submit(view); expect(axios.post).not.toHaveBeenCalled();
    }
});

test('PROFILE_ONLY history retains its evidence and translated reason without a conversion action', async () => {
    const batch = nativeFixture(); batch.analytes[0].provenance = 'PROFILE_ONLY';
    const view = mountUi('components/workbench/QcRunHistory.jsx', { batch, loading: false, onChanged: jest.fn(),
        setLoading: jest.fn(), setError: jest.fn() }); await view.render();
    expect(view.find('stored-qc-evidence')).toBeDefined(); expect(view.find('qc-profile-only-retained')).toBeDefined();
    expect(view.text()).toContain('qcMembership.storedRun'); expect(view.find('rebuild-qc-run')).toBeUndefined();
    expect(view.axios.post).not.toHaveBeenCalled();
});

test.each(['en', 'es', 'es-419', 'fr', 'pt'])('membership messages and stable refusal codes are translated in %s', locale => {
    const english = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../client/src/translations/en.json'))).qcMembership;
    for (const folder of ['../../../client/src/translations', '../../locales']) {
        const labels = JSON.parse(fs.readFileSync(path.resolve(__dirname, folder, `${locale}.json`))).qcMembership;
        expect(Object.keys(labels).sort()).toEqual(Object.keys(english).sort());
        for (const value of Object.values(labels).filter(value => typeof value === 'string')) expect(value.trim().length).toBeGreaterThan(0);
        for (const key of ['QC_WORK_ITEMS_REQUIRED','QC_RUN_PROFILE_ONLY_STORED']) expect(labels.errors[key].trim().length).toBeGreaterThan(0);
    }
});
