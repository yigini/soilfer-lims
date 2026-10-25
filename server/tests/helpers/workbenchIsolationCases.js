const cases = [];
const entry = { workItemId: '{workItemA}', sampleId: '{sampleA}', analysis: 'PH_H2O', value: '7.1',
    methodologyId: '{methodA}', replicateNo: 1, basis: 'AIR_DRY', baseVersion: 0 };
function add(key, path, body, query) { cases.push({ key, path, ...(body && { body }), ...(query && { query }) }); }
add('GET /api/workbench/queue', '/api/workbench/queue', null, { sampleId: '{sampleA}', workItemId: '{workItemA}' });
add('GET /api/workbench/runs/:batchId/worksheet.pdf', '/api/workbench/runs/{batchA}/worksheet.pdf');
add('POST /api/workbench/batch-save', '/api/workbench/batch-save', { entries: [entry], draft: true });
add('POST /api/workbench/calculation-preview', '/api/workbench/calculation-preview', { sampleId: '{sampleA}', workItemId: '{workItemA}', inputs: {} });
add('GET /api/workbench/instruments/:instrumentId/import-templates', '/api/workbench/instruments/{equipmentA}/import-templates');
add('POST /api/workbench/instruments/:instrumentId/import-templates', '/api/workbench/instruments/{equipmentA}/import-templates', {
    labId: '{labA}', name: 'Synthetic import mapping', expectedVersion: 0, supersedesId: null,
    mapping: { version: 1, delimiter: 'COMMA', hasHeader: true, idColumn: 0, idType: 'LAB_SAMPLE_CODE',
        analytes: [{ analysisCode: 'PH_H2O', valueColumn: 1, unit: 'pH units' }] } });
add('GET /api/workbench/runs/:batchId/imports/context', '/api/workbench/runs/{importBatchA}/imports/context');
for (const action of ['preview', 'commit']) cases.push({ key: `POST /api/workbench/runs/:batchId/imports/${action}`,
    path: `/api/workbench/runs/{importBatchA}/imports/${action}`, multipart: {
        fields: { templateId: '{importTemplateA}', ...(action === 'commit' && { previewToken: '{importPreviewA}' }) },
        fileField: 'file', filename: 'synthetic-source.csv', contentType: 'text/csv',
        base64: Buffer.from('Sample,pH\nUNMATCHED-SYNTHETIC,7.1\n').toString('base64') },
    ...(action === 'commit' && { protocolRefusal: { status: 400, code: 'IMPORT_PREVIEW_INVALID' },
        globalReason: 'A genuine signed lab-A preview is bound to its original actor. A lab-B actor cannot redeem that capability; the real protocol returns generic400 before any write.' }) });
add('GET /api/workbench/drafts', '/api/workbench/drafts', null, { analysis: 'PH_H2O', sampleId: '{sampleA}' });
add('DELETE /api/workbench/drafts/:analysis', '/api/workbench/drafts/PH_H2O', {});
add('DELETE /api/workbench/drafts/item/:workItemId', '/api/workbench/drafts/item/{workItemA}', {});
add('POST /api/workbench/drafts/item/:workItemId/resolve-conflict', '/api/workbench/drafts/item/{workItemA}/resolve-conflict', { resolution: 'KEEP_LOCAL', reason: 'Synthetic conflict resolution' });
add('POST /api/workbench/operations/confirm', '/api/workbench/operations/confirm', { workItemId: '{dryingWorkA}', checklist: [true, true, true], version: 0 });
add('POST /api/workbench/operations/verify', '/api/workbench/operations/verify', { workItemId: '{dryingWorkA}', decision: 'ACCEPT', note: 'Synthetic verification' });
for (const action of ['preview', 'commit']) {
    add(`POST /api/workbench/v2/completion/${action}`, `/api/workbench/v2/completion/${action}`, { entries: [entry] });
    add(`POST /api/workbench/v2/submissions/${action}`, `/api/workbench/v2/submissions/${action}`, { sampleIds: ['{sampleA}'], workItemIds: ['{workItemA}'] });
    cases.push({ key: `POST /api/workbench/v2/submissions/${action}`, path: `/api/workbench/v2/submissions/${action}`, variant: 'completed foreign work',
        body: { sampleIds: ['{completedSampleA}'], workItemIds: ['{completedWorkA}'] } });
}
cases.push({ key: 'POST /api/workbench/v2/submissions/preview', path: '/api/workbench/v2/submissions/preview', variant: 'unfiltered ready-work list', body: {} });
cases.push({ key: 'GET /api/workbench/v2/receipts', path: '/api/workbench/v2/receipts',
    globalReason: 'Personal command receipt list is selected by the authenticated username, independently of caller sample/lab filters.' });
module.exports = cases;
