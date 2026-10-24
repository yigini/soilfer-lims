const cases = [];
function add(key, path, body, query) { cases.push({ key, path, ...(body && { body }), ...(query && { query }) }); }
const source = { labId: 'R2-SAMPLE-CODE-A', filename: 'synthetic-spectrum.csv', modality: 'MIR', quantity: 'ABSORBANCE',
    wavelengths: [4000, 3000, 2000, 1000, 500], values: [0.2, 0.25, 0.3, 0.22, 0.2] };
add('GET /api/spectral', '/api/spectral', null, { sampleId: '{sampleA}' });
add('GET /api/spectral/:id', '/api/spectral/{scanA}');
add('GET /api/spectral/:id/raw', '/api/spectral/{scanA}/raw');
add('GET /api/spectral/stats', '/api/spectral/stats', null, { labId: '{labA}' });
add('GET /api/spectral/control-drifts', '/api/spectral/control-drifts', null, { equipmentId: '{equipmentA}' });
add('POST /api/spectral/check-matches', '/api/spectral/check-matches', { labIds: ['{sampleA}'] });
add('POST /api/spectral/preview', '/api/spectral/preview', { scans: [source], contextSampleId: '{sampleA}', modality: 'MIR' });
add('POST /api/spectral/batch/commit', '/api/spectral/batch/commit', { manifestId: '{spectralManifestA}', equipmentId: '{equipmentA}', idempotencyKey: 'synthetic-foreign-commit' });
for (const equipment of ['{equipmentA}', '{equipmentB}']) cases.push({ key: 'POST /api/spectral/batch/commit', path: '/api/spectral/batch/commit',
    variant: 'legacy foreign manifest with ' + equipment, mustDeny: true,
    body: { manifestId: '{legacySpectralManifestA}', equipmentId: equipment } });
for (const action of ['batch', 'upload-raw']) add(`POST /api/spectral/${action}`, `/api/spectral/${action}`, { scans: [source], contextSampleId: '{sampleA}' });
add('POST /api/spectral/link-task', '/api/spectral/link-task', { scanId: '{scanA}', workItemId: '{workItemA}' });
add('POST /api/spectral/batch-review', '/api/spectral/batch-review', { ids: ['{scanA}'], action: 'APPROVE' });
add('POST /api/spectral/batch-delete', '/api/spectral/batch-delete', { ids: ['{scanA}'], reason: 'Synthetic disposal' });
add('POST /api/spectral/:id/review', '/api/spectral/{scanA}/review', { action: 'APPROVE' });
add('POST /api/spectral/:id/restore', '/api/spectral/{deletedScanA}/restore', {});
add('DELETE /api/spectral/:id', '/api/spectral/{scanA}', { reason: 'Synthetic disposal' });
add('DELETE /api/spectral/:id/permanent', '/api/spectral/{purgedScanA}/permanent', { reason: 'Synthetic permanent disposal' });
add('GET /api/pt/rounds', '/api/pt/rounds', null, { labId: '{labA}', analysisCode: 'PH_H2O' });
add('GET /api/pt/summary', '/api/pt/summary', null, { labId: '{labA}' });
add('POST /api/pt/rounds', '/api/pt/rounds', { labId: '{labA}', analysisCode: 'PH_H2O', provider: 'Synthetic provider',
    roundRef: 'Synthetic round', assignedValue: 7, labResult: 7.01, uncertainty: 0.1, date: '2026-01-01' });
add('PATCH /api/pt/rounds/:id', '/api/pt/rounds/{ptRoundA}', { notes: 'Synthetic changed PT notes', reason: 'Synthetic correction' });
add('DELETE /api/pt/rounds/:id', '/api/pt/rounds/{ptRoundA}', { reason: 'Synthetic PT deletion' });
module.exports = cases;
