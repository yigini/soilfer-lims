const cases = [];
function add(key, path, body, query) { cases.push({ key, path, ...(body && { body }), ...(query && { query }) }); }
const work = '/api/work/{workItemA}', result = '/api/results/{sampleA}';
add('GET /api/work', '/api/work', null, { sampleId: '{sampleA}', labId: '{labA}', analysis: 'PH_H2O' });
add('GET /api/work/eligible-assignees', '/api/work/eligible-assignees', null, { labId: '{labA}', analysis: 'PH_H2O' });
add('POST /api/work/assign', '/api/work/assign', { workItemIds: ['{workItemA}'], assignee: '{technicianBUsername}', reason: 'Synthetic assignment' });
for (const action of ['assign', 'reassign']) add(`POST /api/work/:id/${action}`, `${work}/${action}`,
    { technicianUserId: '{technicianBUsername}', reason: 'Synthetic assignment' });
add('PUT /api/work/:id/status', `${work}/status`, { status: 'IN_PROGRESS', version: 0, reason: 'Synthetic status request' });
add('POST /api/work/:id/start', `${work}/start`, { version: 0 });
add('POST /api/work/:id/review', `${work}/review`, { decision: 'ACCEPT', reason: 'Synthetic review', attemptId: '{attemptA}' });
add('POST /api/work/review/bulk', '/api/work/review/bulk', { workItemIds: ['{workItemA}'], status: 'ACCEPTED', reason: 'Synthetic review' });
add('GET /api/work/:id/reported-value', `${work}/reported-value`);
add('POST /api/work/:id/reported-value/preview', `${work}/reported-value/preview`, { attemptIds: ['{attemptA}'], reason: 'Synthetic reported value' });
add('POST /api/work/:id/reported-value', `${work}/reported-value`, { expectedGroupId: null,
    selection: { attemptIds: ['{attemptA}'], reason: 'Synthetic reported value' } });
add('POST /api/work/:id/repeats', `${work}/repeats`, { reason: 'INSTRUMENT_FAULT', note: 'Synthetic repeat' });
add('POST /api/work-items/:id/repeats', '/api/work-items/{workItemA}/repeats', { reason: 'INSTRUMENT_FAULT', note: 'Synthetic repeat' });
add('POST /api/work-items/:id/repeats/limit-override', '/api/work-items/{workItemA}/repeats/limit-override',
    { reason: 'INSTRUMENT_FAULT', note: 'Synthetic repeat', description: 'Synthetic limit assessment', impactAssessment: 'Synthetic impact assessment' });
for (const override of [false, true]) {
    const suffix = 'repeats/replace-partial' + (override ? '/limit-override' : '');
    add(`POST /api/work-items/:id/${suffix}`, `/api/work-items/{workItemA}/${suffix}`, { attemptId: '{attemptA}', expectedVersion: 0,
        reason: 'INSTRUMENT_FAULT', note: 'Synthetic instrument failure', ...(override && { description: 'Synthetic limit assessment', impactAssessment: 'Synthetic impact assessment' }) });
}
add('POST /api/attempts/:id/corrections', '/api/attempts/{attemptA}/corrections',
    { reason: 'TRANSCRIPTION_ERROR', note: 'Synthetic correction', resultId: '{resultA}', value: '7.1' });
add('GET /api/results/:sampleId', result);
add('GET /api/results/:sampleId/cross-checks', `${result}/cross-checks`);
add('GET /api/results/:sampleId/history', `${result}/history`);
add('GET /api/results/:sampleId/history/:param', `${result}/history/PH_H2O`);
add('POST /api/results/:sampleId', result, { measurements: [{ param: 'PH_H2O', value: '7.1', batchId: '{batchA}' }] });
add('POST /api/results/:sampleId/submit', `${result}/submit`, { workItemIds: ['{workItemA}'], reason: 'Synthetic submission' });
add('GET /api/reviews', '/api/reviews', null, { sampleId: '{sampleA}', workItemId: '{workItemA}' });
cases.push({ key: 'GET /api/reviews', path: '/api/reviews', variant: 'unfiltered history' });
add('POST /api/reviews/:workItemId', '/api/reviews/{workItemA}', { decision: 'ACCEPT', reason: 'Synthetic review' });

module.exports = cases;
