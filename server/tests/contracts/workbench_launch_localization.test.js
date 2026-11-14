const fs = require('node:fs');
const path = require('node:path');
const { mountUi, content } = require('../helpers/qcWorksheetUi');
const { localeTranslator } = require('../helpers/clientTranslation');
const locales = ['en', 'fr', 'pt', 'es', 'es-419'];
const packs = Object.fromEntries(locales.map(locale => [locale, require(`../../../client/src/translations/${locale}.json`)]));
const row = { workItemId: 'work-one', sampleId: 'sample-one', sampleDisplayId: 'DEMO-26-001',
    labSampleCode: 'DEMO-26-001', rackPosition: 1, analysis: 'PH_H2O', analysisName: 'Soil pH',
    status: 'IN_PROGRESS', readiness: { isReady: true, reasons: [] }, dryingStatus: 'DONE', preparationStatus: 'DONE',
    draft: { value: '6,42', basis: 'AIR_DRY', replicateNo: 1 }, valueRules: { min: 0, max: 14, unit: 'pH' } };
const buttons = view => view.all().filter(node => node.type === 'button');

test('the five launch packs have complete keys and matching interpolation parameters', () => {
    const english = packs.en.workbenchUi;
    const parameters = value => [...value.matchAll(/{{(\w+)}}/g)].map(match => match[1]).sort();
    for (const locale of locales) {
        expect(Object.keys(packs[locale].workbenchUi).sort()).toEqual(Object.keys(english).sort());
        for (const [key, value] of Object.entries(english)) {
            expect(packs[locale].workbenchUi[key].trim()).not.toBe('');
            expect(parameters(packs[locale].workbenchUi[key])).toEqual(parameters(value));
        }
    }
});

test.each(locales)('%s: shell renders counted tabs and saved-draft status in the selected language', async locale => {
    const t = localeTranslator(locale);
    const view = mountUi('components/workbench/WorkbenchShell.jsx', {}, {
        user: { id: 'tech', username: 'tech1', role: 'LAB_TECHNICIAN', labId: 'DEMO-LAB' },
        translate: t, runEffects: false
    });
    await view.render();
    expect(view.text()).toContain(t('workbenchUi.technicianWorkbench'));
    expect(view.text()).toContain(t('workbenchUi.draftsSaved'));
    for (const key of ['myWorkCount', 'worksheetCount', 'readyToSubmitCount', 'sentCompletedCount'])
        expect(view.text()).toContain(t('workbenchUi.' + key, { count: 0 }));
    expect(view.text()).toContain('LAB_TECHNICIAN');
    expect(view.text()).toContain('DEMO-LAB');
    if (locale !== 'en') expect(view.text()).not.toMatch(/Technician Workbench|Ready to Submit|Sent & Completed|Drafts saved/);
});

test.each(locales)('%s: the queue translates filters without changing identifiers or method data', async locale => {
    const t = localeTranslator(locale);
    const view = mountUi('components/workbench/WorkbenchQueue.jsx', {
        groups: [{ analysis: row.analysis, items: [row] }], onOpenWorksheet: jest.fn(), searchQuery: '', onSearchChange: jest.fn()
    }, { user: { username: 'tech1' }, translate: t });
    await view.render();
    expect(view.text()).toContain(t('workbenchUi.allWorkCount', { count: 1 }));
    expect(view.text()).toContain(row.sampleDisplayId);
    const ready = buttons(view).find(node => content(node).includes(t('workbenchUi.readyToRecordCount', { count: 1 })));
    ready.props.onClick(); await view.render();
    expect(view.text()).toContain(row.sampleDisplayId);
    expect(view.all().find(node => node.type === 'input').props.placeholder).toBe(t('workbenchUi.searchBySampleIDOrMethod'));
});

test.each(locales)('%s: normal numeric input retains exact edits and validation behavior', async locale => {
    const t = localeTranslator(locale), onChange = jest.fn();
    const view = mountUi('components/workbench/NumericEditor.jsx', {
        value: '6,42', onChange, validation: row.valueRules, numberFormat: { decimal: ',', thousands: null },
        ariaLabel: t('workbenchUi.sampleDetermination', { sampleId: row.sampleDisplayId })
    }, { translate: t });
    await view.render();
    const input = view.all().find(node => node.type === 'input');
    expect(input.props.value).toBe('6,42');
    input.props.onChange({ target: { value: '0' } });
    expect(onChange).toHaveBeenLastCalledWith('0');
    expect(view.text()).not.toMatch(/valueValidation\./);
    expect(view.all().find(node => node.props['data-value-severity']).props.title).toContain(t('valueValidation.hardMin'));
});

test.each(locales)('%s: review keeps the two handoff steps and passes original data unchanged', async locale => {
    const t = localeTranslator(locale), onCommit = jest.fn(), onSubmit = jest.fn();
    const included = { ...row, value: 0, basis: 'AIR_DRY', replicateNo: 1, displayUnit: 'pH' };
    const completion = mountUi('components/workbench/ReviewCompletionView.jsx', {
        previewData: { included: [included], excluded: [] }, onCommit, onBack: jest.fn()
    }, { translate: t });
    await completion.render();
    expect(completion.text()).toContain(t('workbenchUi.recordOne', { count: 1 }));
    expect(completion.text()).toContain('AIR_DRY');
    expect(completion.text()).toContain('DEMO-26-001');
    completion.all().find(node => node.type === 'input').props.onChange({ target: { checked: true } });
    await completion.render();
    buttons(completion).find(node => content(node) === t('workbenchUi.recordOne', { count: 1 })).props.onClick();
    expect(onCommit).toHaveBeenCalledWith([included]);
    const samples = [{ sampleId: 'sample-one', items: [row], completedCount: 1, totalCount: 2, submissionType: 'PARTIAL' }];
    const submission = mountUi('components/workbench/ReviewSubmissionView.jsx', { eligibleSamples: samples, onSubmit }, { translate: t });
    await submission.render();
    expect(submission.text()).toContain(t('workbenchUi.submitReviewOne', { count: 1 }));
    expect(submission.text()).toContain('PARTIAL');
    submission.all().find(node => node.type === 'input' && node.props.value === '').props.onChange({ target: { value: 'Bench note' } });
    submission.all().filter(node => node.type === 'input' && node.props.type === 'checkbox').at(-1).props.onChange({ target: { checked: true } });
    await submission.render();
    submission.find('submit-for-review-btn').props.onClick();
    expect(onSubmit).toHaveBeenCalledWith(['sample-one'], 'Bench note');
});

test.each(locales)('%s: the inspector translates option labels while preserving wire values', async locale => {
    const t = localeTranslator(locale), onUpdateMeta = jest.fn();
    const view = mountUi('components/workbench/WorkbenchInspector.jsx', {
        selectedItem: row, onUpdateMeta, eligibleEquipment: [], onDiscardDraft: jest.fn()
    }, { translate: t });
    await view.render();
    expect(view.text()).toContain(t('workbenchUi.resultBasis'));
    const basis = view.all().find(node => node.type === 'select' && node.props.value === 'AIR_DRY');
    expect(basis.props.children.map(option => option.props.value)).toEqual(['AIR_DRY', 'OVEN_DRY', 'FIELD_MOIST']);
    basis.props.onChange({ target: { value: 'FIELD_MOIST' } });
    expect(onUpdateMeta).toHaveBeenCalledWith('work-one', 'basis', 'FIELD_MOIST');
});

test.each(locales)('%s: activity translates known action badges and leaves durable receipt data untouched', async locale => {
    const t = localeTranslator(locale);
    const receipt = { id: 'receipt-one', action: 'WORKBENCH_COMPLETE', details: 'Stored receipt text', sampleId: 'DEMO-26-001' };
    const view = mountUi('components/workbench/ActivityReceiptsView.jsx', { receipts: [receipt] }, { translate: t });
    await view.render();
    expect(view.text()).toContain(t('workbenchUi.determinationsRecorded'));
    expect(view.text()).toContain(receipt.id);
    expect(view.text()).toContain(receipt.details);
    expect(receipt.action).toBe('WORKBENCH_COMPLETE');
});

test('shared review-card changes are confined to presentation and both deep-link tooltips use translation keys', () => {
    const read = file => fs.readFileSync(path.resolve(__dirname, '../../../client/src', file), 'utf8');
    const sample = read('pages/SampleDetail.jsx'), work = read('components/sample/WorkItemsTable.jsx');
    for (const key of ['assignedLabel', 'methodLabel', 'qcLabel', 'openSampleTasks']) expect(sample).toContain('workbenchUi.' + key);
    expect(work).toContain('workbenchUi.openTask');
    expect(sample).toContain('item.assigneeName || item.assignedTo');
    expect(sample).toContain('item.methodology?.name');
    expect(work).toContain('/workbench?workItemId=${item.id}&sampleId=${item.sampleId}');
});

test.each(locales)('%s: a sample work-item row renders its translated Workbench action and keeps its destination', async locale => {
    const t = localeTranslator(locale);
    const item = { id: 'work-one', sampleId: 'sample-one', analysis: 'PH_H2O',
        status: 'IN_PROGRESS', assignedTo: 'tech1', category: 'Analysis' };
    const view = mountUi('components/sample/WorkItemsTable.jsx', {
        workItems: [item], sampleId: item.sampleId, isGateOpen: true, loading: false
    }, { user: { username: 'tech1', role: 'LAB_TECHNICIAN' }, translate: t });
    await view.render();
    const open = buttons(view).find(node => content(node) === t('workbenchUi.openWorkbench'));
    expect(open).toBeDefined();
    expect(open.props.title).toBe(t('workbenchUi.openTask'));
    open.props.onClick();
    expect(view.navigate).toHaveBeenCalledWith('/workbench?workItemId=work-one&sampleId=sample-one');
    expect(view.axios.post).not.toHaveBeenCalled();
    view.unmount();
});
