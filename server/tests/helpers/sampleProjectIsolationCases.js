// Explicit requests, reviewed against the sample/project controllers. The
// inventory test rejects a new route in either family until a case is added.
const sample = '/api/samples/{sampleA}';
const project = '/api/projects/{projectA}';
const cases = [];
function add(key, path, body, query) { cases.push({ key, path, ...(body && { body }), ...(query && { query }) }); }

add('GET /api/samples', '/api/samples', null, { projectId: '{projectA}', labId: '{labA}', search: '{sampleA}' });
add('GET /api/samples/expected', '/api/samples/expected', null, { q: '{expectedA}', projectId: '{projectA}' });
add('GET /api/samples/locations', '/api/samples/locations', null, { projectId: '{projectA}', labId: '{labA}' });
add('GET /api/samples/lookup', '/api/samples/lookup', null, { code: '{sampleA}', scanLabId: '{labA}' });
add('GET /api/samples/disposal-queue', '/api/samples/disposal-queue', null, { labId: '{labA}' });
for (const suffix of ['detail', 'workspace', 'map-state', 'holds', 'containers', 'custody', 'storage-locations', 'amendments']) {
    add(`GET /api/samples/:id/${suffix}`, `${sample}/${suffix}`);
}
add('GET /api/samples/:id/orders/preview', `${sample}/orders/preview`, null, { analyses: ['PH_H2O'], reason: 'Synthetic revision' });
add('DELETE /api/samples/:id', '/api/samples/{draftA}');
add('POST /api/samples/batch-delete', '/api/samples/batch-delete', { ids: ['{draftA}'], reason: 'Synthetic deletion' });
// Also exercise the lifecycle path: an error must not disclose foreign IDs.
cases.push({ key: 'POST /api/samples/batch-delete', path: '/api/samples/batch-delete',
    variant: 'processing material', body: { ids: ['{sampleA}'], reason: 'Synthetic deletion' } });
for (const suffix of ['receive', 'accept', 'undo-intake', 'repair-work-items', 'approve', 'archive', 'dispose']) {
    add(`POST /api/samples/:id/${suffix}`, `${sample}/${suffix}`, { reason: 'Synthetic controlled request', sampleId: '{sampleA}' });
}
cases.push({ key: 'POST /api/samples/:id/undo-approve', path: `${sample}/undo-approve`, body: { reason: 'Synthetic reopening' },
    globalReason: 'The retired generic reopen shortcut always refuses with a constant amendment-workflow response; it does not read the supplied entity.',
    staticRefusal: { status: 409, body: { code: 'AMENDMENT_WORKFLOW_REQUIRED', error: 'Reopening an approved sample requires the manager amendment workflow.' } } });
add('PUT /api/samples/:id/status', `${sample}/status`, { status: 'PROCESSING', reason: 'Synthetic transition' });
add('PUT /api/samples/:id/phase', `${sample}/phase`, { phase: 'DRYING', status: 'DONE', checklist: [], reason: 'Synthetic operation' });
add('PUT /api/samples/:id/metadata', `${sample}/metadata`, { metadata: { description: 'Synthetic update' } });
add('PUT /api/samples/:id/project', `${sample}/project`, { projectId: '{projectA}', projectCode: '{projectA}' });
add('PUT /api/samples/:id/analyses', `${sample}/analyses`, { analyses: ['PH_H2O'], reason: 'Synthetic revision' });
for (const suffix of ['orders', 'orders/preview']) add(`POST /api/samples/:id/${suffix}`, `${sample}/${suffix}`,
    { analyses: ['PH_H2O'], reason: 'Synthetic revision' });
add('POST /api/samples/:id/amendments', `${sample}/amendments`, { type: 'CLERICAL', reason: 'Synthetic correction', changes: { description: 'Corrected' } });
add('POST /api/samples/:id/amendments/:amendmentId/authorise', `${sample}/amendments/{amendmentA}/authorise`, { expectedVersion: 1 });
add('POST /api/samples/:id/holds/:holdId/resolve', '/api/samples/{expectedA}/holds/{holdA}/resolve', { reason: 'Synthetic hold review' });
add('POST /api/samples/:id/preparation-evidence/:resultId/clear', `${sample}/preparation-evidence/{resultA}/clear`, { gate: 'DRYING', reason: 'Synthetic evidence review' });
add('POST /api/samples/:id/containers', `${sample}/containers`, { kind: 'ALIQUOT', parentId: '{containerA}', massG: 25 });
for (const suffix of ['custody', 'custody/move']) add(`POST /api/samples/:id/${suffix}`, `${sample}/${suffix}`,
    { type: 'MOVED', containerId: '{containerA}', toLocationId: '{locationA}', reason: 'Synthetic storage movement' });
for (const suffix of ['preview', 'print']) add(`POST /api/samples/labels/${suffix}`, `/api/samples/labels/${suffix}`,
    { items: [{ entity: 'SAMPLE', entityId: '{sampleA}', count: 1 }], format: 'STANDARD', reason: 'Synthetic reprint' });
add('POST /api/samples/walkin', '/api/samples/walkin', { submitter: 'Synthetic submitter', assignedLab: '{labA}', analyses: ['PH_H2O'] });

add('GET /api/projects', '/api/projects', null, { labId: '{labA}', search: '{projectA}' });
add('GET /api/projects/:id', project);
for (const suffix of ['activity', 'stats', 'samples', 'lab-access', 'kobo-config', 'kobo/config', 'kobo-connections', 'kobo/connections']) {
    add(`GET /api/projects/:id/${suffix}`, `${project}/${suffix}`, null, { labId: '{labA}' });
}
add('GET /api/projects/:id/operations/:key', `${project}/operations/{projectA}`, null, { targetLabId: '{labA}' });
add('POST /api/projects', '/api/projects', { code: 'R2-CROSS-LAB-CREATE', name: 'Synthetic project', projectType: 'OPEN_INTAKE',
    labId: '{labA}', assignedLabIds: '["{labB}"]', sampleIds: ['{sampleA}'] });
// Owner-controlled servicing memberships are shared project metadata by design.
// The foreign object for creation is an existing lab-A manifest sample, whose
// identifiers and owning project must not appear in a duplicate-ID response.
cases.push({ key: 'POST /api/projects', path: '/api/projects', variant: 'foreign original manifest identifier',
    body: { code: 'R2-ORIGINAL-CREATE', name: 'Synthetic project', projectType: 'OPEN_INTAKE',
        labId: '{labA}', assignedLabIds: '["{labB}"]', sampleIds: ['R2-ORIGINAL-sample-A'] } });
add('PUT /api/projects/:id', project, { name: 'Synthetic change', labId: '{labA}' });
add('DELETE /api/projects/:id', project);
for (const suffix of ['archive', 'restore']) add(`POST /api/projects/:id/${suffix}`, `${project}/${suffix}`, { reason: 'Synthetic lifecycle request' });
add('PATCH /api/projects/:id/lab-access', `${project}/lab-access`, { labIds: ['{labA}'], reason: 'Synthetic membership change' });
add('POST /api/projects/:id/imports/preview', `${project}/imports/preview`, { sampleIds: ['{expectedA}'], targetLabId: '{labA}' });
add('POST /api/projects/:id/manifest', `${project}/manifest`, { sampleIds: ['{expectedA}'], targetLabId: '{labA}' });
add('POST /api/projects/:id/kobo-connections', `${project}/kobo-connections`, { destinationLabId: '{labA}', formId: 'synthetic-form-A', apiToken: 'synthetic-test-only', koboServerUrl: 'https://example.invalid' });
add('PUT /api/projects/:id/kobo-connections/:configId', `${project}/kobo-connections/{koboA}`, { formId: 'synthetic-form-A', isActive: false });
for (const suffix of ['sync', 'toggle']) add(`POST /api/projects/:id/kobo-connections/:configId/${suffix}`, `${project}/kobo-connections/{koboA}/${suffix}`, { isActive: false });

module.exports = cases;
