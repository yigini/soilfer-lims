const fs = require('node:fs'), path = require('node:path');
const { mountUi } = require('../helpers/qcWorksheetUi');
const batch = { id: 'owned-import-run', labId: 'owned-lab', instrumentId: 'owned-instrument', startedAt: '2026-10-10T00:00:00Z', status: 'OPEN' };
const mapping = { version: 1, delimiter: 'COMMA', hasHeader: true, idColumn: 0, idType: 'LAB_SAMPLE_CODE',
    analytes: [{ analysisCode: 'DIRECT', valueColumn: 1, unit: 'catalogue-unit' },
        { analysisCode: 'ACTIVATED', inputs: [{ variable: 'response', column: 2, unit: 'SOP-response-unit' }] }] };
const context = { labId: batch.labId, instrumentId: batch.instrumentId, analyses: [
    { analysisCode: 'DIRECT', name: 'Direct analysis', reportingUnits: ['catalogue-unit', 'catalogue-alternative'], inputs: null },
    { analysisCode: 'ACTIVATED', name: 'Activated analysis', reportingUnits: ['output-unit'],
        inputs: [{ key: 'response', label: 'SOP response', unit: 'SOP-response-unit' }] }
], templates: [{ id: 'mapping-v1', name: 'Existing instrument mapping', version: 1, mapping }] };
const row = (rowNumber, kind, cells, errors = []) => ({ rowNumber, match: { kind, sourceId: cells[0] }, cells, errors,
    status: kind === 'UNMATCHED' ? 'SKIPPED_UNMATCHED' : kind, plans: [] });
const preview = { previewToken: 'actual-server-seal', canCommit: true, refusals: [], rows: [
    row(2, 'SAMPLE', ['LABEL-1', ' 1,500 ', '2.000']), row(3, 'QC', ['BLK-1', '0', '']), row(4, 'UNMATCHED', ['unknown-id', '7', ''])
] };
function mount(options = {}) {
    const axios = options.axios || { get: jest.fn(async () => ({ data: structuredClone(context) })), post: jest.fn(async url => {
        if (url.endsWith('/preview')) return { data: structuredClone(preview) };
        if (url.endsWith('/commit')) return { data: { draftCount: 2, qcCount: 1 } };
        if (url.endsWith('/import-templates')) return { data: { id: 'mapping-v2', name: 'Saved mapping', version: 2, mapping: structuredClone(mapping) } };
        throw Error('Unexpected import request: ' + url);
    }) };
    return mountUi('components/workbench/InstrumentImportPanel.jsx', { batch: structuredClone(batch), canEdit: true,
        onChanged: jest.fn(), setSuccessMsg: jest.fn(), ...options.props }, { axios, canEdit: options.canManage ?? true });
}
async function change(view, id, target) { view.find(id).props.onChange({ target }); await view.render(); }
async function selectFile(view, filename = 'instrument.xlsx') {
    await change(view, 'import-template', { value: 'mapping-v1' });
    const file = new File(['id,value\nLABEL-1,1.500\n'], filename, { type: 'application/octet-stream' });
    await change(view, 'import-file', { files: [file] }); return file;
}
async function showPreview(view) { await view.find('import-preview').props.onClick(); await view.render(); }

test('new mappings use only the scoped catalogue units and exact activated SOP inputs; a manager explicitly saves them', async () => {
    const view = mount(); await view.render();
    expect(view.axios.get).toHaveBeenCalledWith('/api/workbench/runs/owned-import-run/imports/context');
    expect(view.find('import-preview').props.disabled).toBe(true);
    expect(view.find('import-input-response').props.value).toBe(3);
    expect(view.find('import-input-response-unit').props.value).toBe('SOP-response-unit');
    expect(view.find('import-unit-DIRECT-unit').props.value).toBe('catalogue-unit');
    expect(view.find('import-value-ACTIVATED')).toBeUndefined();
    await change(view, 'import-mapping-name', { value: 'New mapping for this instrument' });
    await view.find('import-save-template').props.onClick(); await view.render();
    expect(view.axios.post).toHaveBeenCalledWith('/api/workbench/instruments/owned-instrument/import-templates', {
        labId: 'owned-lab', name: 'New mapping for this instrument', mapping, supersedesId: null, expectedVersion: 0
    });
    expect(view.find('import-template').props.value).toBe('mapping-v2');
});

test('a saved mapping revision retains the original, invalidates its preview and sends the precise predecessor version', async () => {
    const view = mount(); await view.render(); await selectFile(view); await showPreview(view);
    await change(view, 'import-value-DIRECT', { value: '5' });
    expect(view.find('import-preview-results')).toBeUndefined(); expect(view.find('import-preview').props.disabled).toBe(true);
    await view.find('import-preview').props.onClick(); expect(view.axios.post).toHaveBeenCalledTimes(1);
    await view.find('import-save-template').props.onClick(); await view.render();
    expect(view.axios.post).toHaveBeenLastCalledWith('/api/workbench/instruments/owned-instrument/import-templates', {
        labId: 'owned-lab', name: 'Existing instrument mapping', mapping: { ...mapping, analytes: [{ ...mapping.analytes[0], valueColumn: 4 }, mapping.analytes[1]] },
        supersedesId: 'mapping-v1', expectedVersion: 1
    });
    expect(context.templates[0].mapping.analytes[0].valueColumn).toBe(1);
});

test('real multipart preview and commit retain the exact file, mapping, explicit worksheet and sealed token; no receipt field is supplied', async () => {
    const view = mount(); await view.render(); const file = await selectFile(view); await change(view, 'import-sheet', { value: 'Results 2026' });
    await showPreview(view);
    const previewBody = view.axios.post.mock.calls[0][1]; expect(previewBody).toBeInstanceOf(FormData);
    expect([...previewBody.keys()]).toEqual(['file', 'templateId', 'sheetName']);
    expect(previewBody.get('file')).toBe(file); expect(previewBody.get('templateId')).toBe('mapping-v1');
    expect(previewBody.get('sheetName')).toBe('Results 2026');
    expect(view.text()).toContain('unknown-id'); expect(view.text()).toContain(' 1,500 '); expect(view.text()).toContain('BLK-1');
    expect(view.find('import-commit').props.disabled).toBe(false);
    await view.find('import-commit').props.onClick(); await view.render();
    expect(view.axios.post.mock.calls[1][0]).toBe('/api/workbench/runs/owned-import-run/imports/commit');
    const commitBody = view.axios.post.mock.calls[1][1]; expect([...commitBody.keys()]).toEqual(['file', 'templateId', 'sheetName', 'previewToken']);
    expect(commitBody.get('file')).toBe(file); expect(commitBody.get('previewToken')).toBe('actual-server-seal');
    expect(view.props.onChanged).toHaveBeenCalledTimes(1); expect(view.find('import-preview-results')).toBeUndefined();
    expect(view.props.setSuccessMsg).toHaveBeenCalledWith('instrumentImport.imported: 2 / 1');
});

test.each(['import-sheet', 'import-template', 'import-file'])('changing %s clears the previous authorization and requires a new preview', async id => {
    const view = mount(); await view.render(); await selectFile(view); await showPreview(view);
    await change(view, id, id === 'import-file' ? { files: [new File(['changed'], 'second.csv')] } : { value: id === 'import-template' ? '' : 'Another sheet' });
    expect(view.find('import-preview-results')).toBeUndefined(); expect(view.find('import-commit')).toBeUndefined();
    expect(view.axios.post).toHaveBeenCalledTimes(1);
    if (id === 'import-file') expect(view.find('import-sheet').props.value).toBe('');
});

test('all refused rows and their cell references are visible; the commit callback cannot send a refused preview', async () => {
    const view = mount(); await view.render(); await selectFile(view);
    const errors = [{ analysisCode: 'DIRECT', code: 'IMPORT_XLSX_NUMBER_POLICY_CONFLICT', details: { cellRef: 'B2' } }];
    view.axios.post.mockResolvedValueOnce({ data: { ...preview, canCommit: false, refusals: errors, rows: [row(2, 'SAMPLE', ['LABEL-1', '1.234'], errors)] } });
    await showPreview(view); expect(view.text()).toContain('B2'); expect(view.text()).toContain('instrumentImport.errors.IMPORT_XLSX_NUMBER_POLICY_CONFLICT');
    expect(view.find('import-commit').props.disabled).toBe(true); await view.find('import-commit').props.onClick();
    expect(view.axios.post).toHaveBeenCalledTimes(1); expect(view.props.onChanged).not.toHaveBeenCalled();
});

test('a later commit conflict lists the precise refused rows and never reports success', async () => {
    const view = mount(); await view.render(); await selectFile(view); await showPreview(view);
    view.axios.post.mockRejectedValueOnce({ response: { data: { code: 'IMPORT_DRAFT_EXISTS', details: {
        refusedRows: [{ rowNumber: 4, analysisCode: 'DIRECT', code: 'IMPORT_DRAFT_EXISTS' }] } } } });
    await view.find('import-commit').props.onClick(); await view.render();
    expect(view.text()).toContain('instrumentImport.row 4'); expect(view.text()).toContain('DIRECT');
    expect(view.text()).toContain('instrumentImport.errors.IMPORT_DRAFT_EXISTS'); expect(view.props.setSuccessMsg).not.toHaveBeenCalled();
    expect(view.props.onChanged).not.toHaveBeenCalled();
});

test('a preview response for the previous run is ignored after the operator changes runs', async () => {
    const view = mount(); await view.render(); await selectFile(view);
    let resolve; view.axios.post.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const pending = view.find('import-preview').props.onClick();
    await view.render({ batch: { ...batch, id: 'another-run' } }); resolve({ data: preview }); await pending; await view.render();
    expect(view.find('import-preview-results')).toBeUndefined(); expect(view.find('import-template').props.value).toBe('');
    expect(view.axios.get).toHaveBeenLastCalledWith('/api/workbench/runs/another-run/imports/context');
});

test('entry permission can use a saved mapping without exposing equipment-manager revision controls', async () => {
    const view = mount({ canManage: false }); await view.render(); await selectFile(view); await showPreview(view);
    expect(view.find('import-mapping-editor')).toBeUndefined(); expect(view.find('import-save-template')).toBeUndefined();
    expect(view.find('import-commit').props.disabled).toBe(false);
});

test.each([{ canEdit: false }, { batch: { ...batch, startedAt: null } }, { batch: { ...batch, instrumentId: null } },
    { batch: { ...batch, status: 'CLOSED' } }])('an unavailable native run exposes no import actions or context request: %j', async props => {
    const view = mount({ props }); await view.render(); expect(view.find('instrument-import-panel')).toBeUndefined();
    expect(view.axios.get).not.toHaveBeenCalled(); expect(view.axios.post).not.toHaveBeenCalled();
});

test('the complete import screen and stable refusal codes exist in all five translations', () => {
    const load = locale => JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../client/src/translations', locale + '.json'), 'utf8')).instrumentImport;
    const flatten = (value, prefix = '') => Object.entries(value).flatMap(([key, text]) => typeof text === 'object'
        ? flatten(text, prefix + key + '.') : [[prefix + key, text]]);
    const english = flatten(load('en'));
    for (const locale of ['en', 'es', 'es-419', 'fr', 'pt']) {
        const entries = flatten(load(locale)); expect(entries.map(([key]) => key)).toEqual(english.map(([key]) => key));
        for (const [, value] of entries) expect(typeof value === 'string' && value.trim().length > 0).toBe(true);
    }
});
