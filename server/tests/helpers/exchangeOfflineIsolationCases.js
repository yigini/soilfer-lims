const cases = [];
function add(key, path, body, query, globalReason) {
    cases.push({ key, path, ...(body && { body }), ...(query && { query }), ...(globalReason && { globalReason }) });
}
const selector = { labId: '{labA}', assignedLab: '{labA}', project: '{projectA}', limit: 10 };
for (const alias of ['data-exchange', 'sis']) {
    const v1 = `/api/v1/${alias}`, v2 = `/api/v2/${alias}`;
    for (const kind of ['samples', 'geojson', 'results', 'spectra', 'spectra/export', 'stats']) {
        add(`GET ${v1}/${kind}`, `${v1}/${kind}`, null, selector);
    }
    add(`GET ${v1}/samples/:id`, `${v1}/samples/{exportSampleA}`);
    add(`GET ${v1}/sync`, `${v1}/sync`, null, { ...selector, updatedSince: '2020-01-01T00:00:00Z' });
    for (const kind of ['keys', 'connections']) add(`GET ${v1}/${kind}`, `${v1}/${kind}`, null, { labId: '{labA}' });
    add(`POST ${v1}/keys`, `${v1}/keys`, { name: 'Synthetic requested A key', labs: ['{labA}'], countries: ['GTM'],
        projects: ['{projectA}'], role: 'NSIS_CONSUMER', capabilities: ['SNAPSHOT'], connectionId: '{connectionA}' });
    add(`DELETE ${v1}/keys/:id`, `${v1}/keys/{apiKeyA}`, {});
    for (const action of ['rotate', 'confirm-rotation', 'abort-rotation']) {
        add(`POST ${v1}/keys/:id/${action}`, `${v1}/keys/{apiKeyA}/${action}`, { idempotencyKey: 'public-synthetic-denial-check' });
    }
    add(`POST ${v1}/connections`, `${v1}/connections`, { name: 'Synthetic requested A connection', labs: ['{labA}'],
        countries: ['GTM'], projects: ['{projectA}'], capabilities: ['SNAPSHOT'] });
    add(`PUT ${v1}/connections/:id`, `${v1}/connections/{connectionA}`, { name: 'Synthetic changed A connection', labs: ['{labA}'] });
    add(`GET ${v2}/capabilities`, `${v2}/capabilities`, null, null,
        'Public exchange protocol discovery advertises schemas and routes, not private laboratory datasets.');
    for (const kind of ['samples', 'observations', 'geojson', 'stats', 'spectra', 'changes']) {
        add(`GET ${v2}/${kind}`, `${v2}/${kind}`, null, selector);
    }
    add(`GET ${v2}/samples/:specimenId`, `${v2}/samples/{exportSampleA}`);
    add(`POST ${v2}/snapshots`, `${v2}/snapshots`, { profile: 'core-lossless-v2', filter: { labId: '{labA}' }, ttlHours: 1 });
    add(`GET ${v2}/snapshots/:snapshotId/pages`, `${v2}/snapshots/{snapshotA}/pages`, null, { limit: 10 });
    add(`POST ${v2}/receipts`, `${v2}/receipts`, { receiptId: 'synthetic-receiver-336', snapshotId: '{snapshotA}',
        importedCount: 0, quarantinedCount: 0 });
}
add('POST /api/offline/devices/enroll', '/api/offline/devices/enroll', { deviceId: 'synthetic-device-336', platform: 'test', appVersion: 'synthetic' }, null,
    'Current-principal device lease handshake with caller-supplied metadata; no stored foreign entity is read.');
add('POST /api/offline/packs/prepare', '/api/offline/packs/prepare', { deviceId: 'synthetic-device-336', labId: '{labA}', sampleIds: ['{sampleA}'], methodCodes: ['PH_H2O'] });
add('GET /api/offline/packs/:id', '/api/offline/packs/{offlinePackA}');
add('GET /api/sync/status', '/api/sync/status', null, null, 'Public protocol health and current server time.');
for (const type of ['SAVE_WORK_DRAFT', 'COMPLETE_WORK']) cases.push({ key: 'POST /api/sync/operations', path: '/api/sync/operations', variant: type,
    body: { protocolVersion: 1, deviceId: 'synthetic-device-336', operations: [{ operationId: `synthetic-${type}-336`, type,
        target: { workItemId: '{workItemA}' }, payload: { value: '7.2', unit: 'pH_units', methodologyId: '{methodA}' } }] },
    rejectedSync: true });
add('POST /api/import/preview', '/api/import/preview', { csvText: 'Synthetic private parameter A\n7.1' });
add('POST /api/import/execute', '/api/import/execute', { sampleIdColumn: 'sample', labId: '{labA}',
    columnMappings: [{ column: 'pH', analysisCode: 'PH_H2O', methodologyId: '{methodA}', unitCode: '{referenceUnitA}' }],
    rows: [{ sample: '{sampleA}', pH: '7.1' }] });
for (const type of ['LIST', 'REGISTER', 'WET_CHEM', 'SPECTRAL']) cases.push({ key: 'POST /api/exports/data', path: '/api/exports/data', variant: type,
    body: { type, lab: '{labA}', project: '{projectA}', includeUnapproved: false, signOffName: 'Synthetic B actor', signOffReason: 'Synthetic isolation check' } });
cases.push({ key: 'POST /api/exports/data', path: '/api/exports/data', variant: 'project-only selector',
    body: { type: 'LIST', project: '{projectA}', signOffName: 'Synthetic B actor', signOffReason: 'Synthetic isolation check' } });
add('GET /api/exports/history', '/api/exports/history');
add('GET /api/data-results', '/api/data-results', null, { project: '{projectA}', analysisType: 'ALL' });
add('GET /api/calculation-templates', '/api/calculation-templates', null, { labId: '{labA}', analysisCode: 'EXCH_CA' });
add('GET /api/calculation-templates/activation', '/api/calculation-templates/activation', null, { labId: '{labA}', analysisCode: 'EXCH_CA', methodologyId: 'null' });
for (const action of ['clone', 'versions']) add(`POST /api/calculation-templates/:id/${action}`, `/api/calculation-templates/{calcA}/${action}`,
    { labId: '{labA}', expectedVersion: 1, reason: 'Synthetic requested template change', sopCitation: 'Synthetic SOP, two decimals', methodologyId: null, outputDecimals: 2 });
add('POST /api/calculation-templates/:id/activation', '/api/calculation-templates/{calcA}/activation', {
    labId: '{labA}', analysisCode: 'EXCH_CA', methodologyId: null, expectedVersion: 1, expectedActivationId: null,
    action: 'ACTIVATE', reason: 'Synthetic requested activation', verifiedAgainstSop: true });
module.exports = cases;
