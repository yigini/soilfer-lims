const fs = require('node:fs'), path = require('node:path');
const { mountUi, nativeHost, nativeFixture, nodes, content } = require('../helpers/qcWorksheetUi');

test('the real worksheet table combines linked Result editors and all QC positions while keeping their writes separate', async () => {
    const batch = nativeFixture();
    const items = [{ workItemId: 'wi-0', sampleId: 'sample-0', sampleDisplayId: 'CODE-0', status: 'IN_PROGRESS', readiness: { isReady: true }, draft: { value: '99.123456789' } },
        { workItemId: 'outside-run', sampleId: 'outside', status: 'IN_PROGRESS', readiness: { isReady: true }, draft: { value: '42' } }];
    const onDraftChange = jest.fn(), onReviewRecord = jest.fn();
    const view = mountUi('components/workbench/WorksheetArea.jsx', { activeGroup: { analysis: 'A', items }, allGroups: [{ analysis: 'A', items }],
        onDraftChange, onReviewRecord, onSelectGroup: jest.fn() }, { responses: { '/api/qc/batches': [batch], '/api/qc/batches/worksheet-run': batch } });
    await view.render(); view.find('worksheet-run-select').props.onChange({ target: { value: batch.id } }); await view.render();
    const controller = view.all().find(node => node.type === view.children['./NativeRunPanel']); expect(controller).toBeDefined();
    const native = nativeHost(batch, controller.props); await native.render();
    const table = native.find('worksheet-grid');
    expect(nodes(table).filter(node => node.type === 'table')).toHaveLength(1);
    expect(nodes(table).filter(node => node.type === 'tr' && node.props['data-testid']?.startsWith('native-position-')).map(node => node.props['data-testid']))
        .toEqual(batch.positions.map(row => `native-position-${row.id}`));
    const editor = nodes(table).find(node => node.type === view.children['./NumericEditor']); expect(editor.props.value).toBe('99.123456789');
    expect(native.find('native-value-parent-0').props.value).toBe('');
    editor.props.onChange('6,82'); expect(onDraftChange).toHaveBeenCalledWith('wi-0', '6,82');
    native.find('native-value-parent-0').props.onChange({ target: { value: '7,01' } }); await native.render();
    expect(onDraftChange).toHaveBeenCalledTimes(1); expect(native.find('native-value-parent-0').props.value).toBe('7,01');
    expect(typeof table.props.onKeyDownCapture).toBe('function');
    const enter = { key: 'Enter', target: {}, currentTarget: { querySelectorAll: () => [] }, preventDefault: jest.fn(), stopPropagation: jest.fn() };
    table.props.onKeyDownCapture(enter); expect(enter.preventDefault).not.toHaveBeenCalled();
    nodes(table).find(node => node.type === 'input' && node.props['aria-label'] === 'Select all rows').props.onChange(); await view.render();
    const refreshed = view.all().find(node => node.type === view.children['./NativeRunPanel']); await native.render(refreshed.props);
    native.all().find(node => node.type === 'button' && content(node).startsWith('Review Completion')).props.onClick();
    expect(onReviewRecord).toHaveBeenCalledWith(['wi-0']);
    expect(native.axios.post).not.toHaveBeenCalled(); expect(native.axios.put).not.toHaveBeenCalled();
});

test('selecting another analyte preserves the run and selects its ordinary Result method through the existing group callback', async () => {
    const batch = nativeFixture(); batch.analytes.push({ ...batch.analytes[0], id: 'analyte-b', analysisCode: 'B' });
    const onSelectGroup = jest.fn();
    const view = mountUi('components/workbench/WorksheetArea.jsx', { activeGroup: { analysis: 'A', items: [] }, allGroups: [], onSelectGroup },
        { responses: { '/api/qc/batches': [batch], '/api/qc/batches/worksheet-run': batch } });
    await view.render(); view.find('worksheet-run-select').props.onChange({ target: { value: batch.id } }); await view.render();
    const controller = view.all().find(node => node.type === view.children['./NativeRunPanel']);
    const native = nativeHost(batch, controller.props); await native.render();
    native.find('native-analysis-select').props.onChange({ target: { value: 'B' } }); expect(onSelectGroup).toHaveBeenCalledWith('B');
    await view.render({ activeGroup: { analysis: 'B', items: [] } });
    expect(view.find('worksheet-run-select').props.value).toBe(batch.id);
    const changed = view.all().find(node => node.type === view.children['./NativeRunPanel']); await native.render(changed.props);
    expect(native.find('native-analysis-select').props.value).toBe('B');
    expect(native.find('native-value-parent-0').props.value).toBe('');
});

test('a finished operation from the previous run cannot refetch it over the newly selected worksheet', async () => {
    const first = nativeFixture(), second = { ...nativeFixture(), id: 'second-run' };
    const view = mountUi('components/workbench/WorksheetArea.jsx', { activeGroup: { analysis: 'A', items: [] }, allGroups: [] },
        { responses: { '/api/qc/batches': [first, second], '/api/qc/batches/worksheet-run': first, '/api/qc/batches/second-run': second } });
    await view.render(); view.find('worksheet-run-select').props.onChange({ target: { value: first.id } }); await view.render();
    const previous = view.all().find(node => node.type === view.children['./NativeRunPanel']).props;
    view.find('worksheet-run-select').props.onChange({ target: { value: second.id } }); await view.render();
    view.axios.get.mockClear(); await previous.onChanged();
    previous.setLoading(true); previous.setError('prior failure'); previous.setSuccessMsg('prior saved'); await view.render();
    expect(view.axios.get).not.toHaveBeenCalled();
    expect(view.find('worksheet-run-select').props.value).toBe(second.id);
    expect(view.all().find(node => node.type === view.children['./NativeRunPanel']).props.batch.id).toBe(second.id);
    expect(view.all().find(node => node.type === view.children['./NativeRunPanel']).props.loading).toBe(false);
    expect(view.find('worksheet-run-error')).toBeUndefined(); expect(view.text()).not.toContain('prior saved');
});

test.each(['PROFILE_ONLY', 'LEGACY_MIGRATED', 'NATIVE_CLOSED'])('%s renders stored evidence verbatim without inputs or preview/evaluation requests', async provenance => {
    const batch = nativeFixture();
    batch.analytes[0].provenance = provenance === 'NATIVE_CLOSED' ? 'NATIVE' : provenance;
    if (provenance === 'NATIVE_CLOSED') { batch.status = 'CLOSED'; batch.analytes[0].status = 'CLOSED'; }
    const details = { evaluation: { controls: [{ id: 'legacy-control', expected: 7.123456789, measured: '7,000000001', status: 'WARN', minRecovery: 92.123456789 }],
        blanks: [{ id: 'legacy-blank', value: 0.0123456789, status: 'FAIL' }], opaqueAuditField: { preserved: true } } };
    batch.analytes[0].evaluation = { details: JSON.stringify(details), verdict: 'WARN', ruleVersion: 17, policyVersion: 23 };
    const view = mountUi('components/workbench/QcRunHistory.jsx', { batch, loading: false, onChanged: jest.fn(), setLoading: jest.fn(), setError: jest.fn() }, { canEdit: false });
    await view.render(); expect(view.find('stored-qc-evidence')).toBeDefined();
    expect(view.text()).toContain('7.123456789'); expect(view.text()).toContain('7,000000001'); expect(view.text()).toContain('92.123456789');
    expect(view.text()).toContain('WARN'); expect(view.text()).toContain('FAIL'); expect(view.text()).toContain('17'); expect(view.text()).toContain('23');
    expect(view.text()).toContain('qcWorksheet.notStored');
    expect(view.all().find(node => node.type === 'pre').props.children).toBe(JSON.stringify(details, null, 2));
    expect(view.all().filter(node => ['input', 'textarea', 'select'].includes(node.type))).toHaveLength(0);
    expect(view.find('rebuild-qc-run')).toBeUndefined(); expect(view.find('native-qc-evaluate')).toBeUndefined();
    expect(view.axios.post).not.toHaveBeenCalled(); expect(view.axios.put).not.toHaveBeenCalled();
});

test('an open compatibility run offers only the permission-gated existing rebuild action using actual work-item ids', async () => {
    const batch = nativeFixture(); batch.analytes[0].provenance = 'PROFILE_ONLY';
    const props = { batch, loading: false, onChanged: jest.fn(), setLoading: jest.fn(), setError: jest.fn() };
    const view = mountUi('components/workbench/QcRunHistory.jsx', props); await view.render();
    expect(view.find('qc-legacy-readonly')).toBeDefined(); await view.find('rebuild-qc-run').props.onClick();
    expect(view.axios.post).toHaveBeenCalledWith('/api/qc/batches/worksheet-run/rebuild', { workItemIds: ['wi-0'] });
    expect(props.onChanged).toHaveBeenCalledTimes(1);
    await view.render({ batch: { ...batch, status: 'CLOSED' } }); expect(view.find('rebuild-qc-run')).toBeUndefined();
});

test('BatchModal exposes the worksheet action and retains the actual server profile and positions without typed QC inputs', async () => {
    const batch = { ...nativeFixture(), profile: 'CENTRIFUGE_24', maxCapacity: 24, runProfile: { name: 'Configured centrifuge', capacity: 24 } };
    const view = mountUi('components/workbench/BatchModal.jsx', { isOpen: true, analysisCode: 'A', onOpenWorksheet: jest.fn() }, { responses: { '/api/qc/batches': [batch] } });
    await view.render(); view.find('batch-tab-allocate').props.onClick(); await view.render();
    expect(view.text()).toContain('Configured centrifuge'); expect(view.text()).toContain('Max 24');
    expect(view.text()).toContain('1 (BLANK), 2 (LRM), 4 (DUPLICATE)'); expect(view.text()).not.toContain('#40 (DUPLICATE)');
    view.find('batch-tab-qc').props.onClick(); await view.render();
    for (const id of ['qc-blank-input', 'qc-ctrl-exp-input', 'qc-ctrl-meas-input', 'qc-dup1-input', 'qc-dup2-input', 'evaluate-qc-btn']) expect(view.find(id)).toBeUndefined();
    const history = view.all().find(node => typeof node.type === 'function' && node.type.name === 'QcRunHistory'); expect(history.props.onOpenWorksheet).toBe(view.props.onOpenWorksheet);
});

test.each(['en', 'es', 'es-419', 'fr', 'pt'])('worksheet messages are complete in %s and client QC limits contain no fixed recovery or RPD strings', locale => {
    const english = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../client/src/translations/en.json'))).qcWorksheet;
    for (const folder of ['../../../client/src/translations', '../../locales']) {
        const labels = JSON.parse(fs.readFileSync(path.resolve(__dirname, folder, `${locale}.json`))).qcWorksheet;
        expect(Object.keys(labels).sort()).toEqual(Object.keys(english).sort());
        for (const value of Object.values(labels)) expect(typeof value === 'string' && value.trim().length > 0).toBe(true);
    }
    for (const file of ['workbench/BatchModal.jsx', 'workbench/NativeRunPanel.jsx', 'qc/BatchInspectionModal.jsx']) {
        const source = fs.readFileSync(path.resolve(__dirname, '../../../client/src/components', file), 'utf8');
        expect(source).not.toMatch(/90\s*[–-]\s*110|RPD\s*(?:≤|<|<=)\s*10/);
    }
});
