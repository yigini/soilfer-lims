const cases = [];
function add(key, path, body, query) { cases.push({ key, path, ...(body && { body }), ...(query && { query }) }); }
add('GET /api/labs', '/api/labs');
for (const [key, path] of [['GET /api/labs/directory', '/api/labs/directory'], ['GET /api/labs/:id', '/api/labs/{labA}']]) {
    cases.push({ key, path, publicDirectory: true, allowedMarkers: ['labA'],
        globalReason: 'Documented authenticated laboratory directory exposes only public profile fields; it grants no operational authority.' });
}
add('GET /api/labs/:id/staff', '/api/labs/{labA}/staff');
add('GET /api/labs/:id/workspace', '/api/labs/{labA}/workspace');
add('GET /api/labs/:id/policies', '/api/labs/{labA}/policies');
add('PATCH /api/labs/:id/policies', '/api/labs/{labA}/policies', { expectedVersion: 1, changes: { 'workflow.requireQcForApproval': true }, reason: 'Synthetic policy change' });
add('GET /api/labs/:labId/appearance', '/api/labs/{labA}/appearance');
add('PATCH /api/labs/:labId/appearance', '/api/labs/{labA}/appearance', { themeId: 'soilfer', defaultMode: 'light', expectedRevision: 0 });
add('PATCH /api/labs/:id/profile', '/api/labs/{labA}/profile', { name: 'Synthetic changed laboratory' });
add('PATCH /api/labs/:id/toggle-active', '/api/labs/{labA}/toggle-active', { isActive: false });
add('PATCH /api/labs/:id/staff/:userId/toggle', '/api/labs/{labA}/staff/{managerIdA}/toggle', { isActive: false });
add('PATCH /api/labs/:id/staff/:userId/reset-password', '/api/labs/{labA}/staff/{managerIdA}/reset-password', {});
add('POST /api/labs', '/api/labs', { code: '{labA}', name: 'Synthetic duplicate laboratory', country: 'GTM' });
add('PUT /api/labs/:id', '/api/labs/{labA}', { name: 'Synthetic changed laboratory' });
add('POST /api/labs/:id/lifecycle-preview', '/api/labs/{labA}/lifecycle-preview', { targetState: 'PAUSED' });
add('POST /api/labs/:id/lifecycle', '/api/labs/{labA}/lifecycle', { targetState: 'PAUSED', reason: 'Synthetic lifecycle change' });

add('GET /api/kobo/configs', '/api/kobo/configs', null, { labId: '{labA}' });
add('GET /api/kobo/config/:labId', '/api/kobo/config/{labA}');
add('PUT /api/kobo/config/:labId', '/api/kobo/config/{labA}', { projectCode: '{projectA}', formId: 'synthetic-form', koboServerUrl: 'https://example.invalid', apiToken: 'synthetic-test-only' });
add('GET /api/kobo/form-fields/:labId', '/api/kobo/form-fields/{labA}');
add('POST /api/kobo/sync/:labId', '/api/kobo/sync/{labA}', {});
add('POST /api/kobo/sync-sample/:sampleId', '/api/kobo/sync-sample/{sampleA}', {});
add('POST /api/kobo/sync-all', '/api/kobo/sync-all', {});
add('GET /api/kobo/media/samples/:sampleId', '/api/kobo/media/samples/{sampleA}');
cases.push({ key: 'GET /api/kobo/media', path: '/api/kobo/media', query: { token: '{sampleA}' }, expectedStatus: 401,
    globalReason: 'Public sealed-media capability route; a private sample ID cannot substitute for its signed access capability.' });
cases.push({ key: 'POST /api/kobo/test', path: '/api/kobo/test', body: {
    koboServerUrl: 'https://example.invalid', formId: 'synthetic-standalone-form', apiToken: 'synthetic-test-only' },
    globalReason: 'Tests caller-supplied connection details; reads no stored laboratory configuration. Public-target validation is real; outbound DNS/HTTP transport is stubbed.' });

add('GET /api/nonconformities', '/api/nonconformities', null, { source: 'OTHER', status: 'OPEN' });
add('POST /api/nonconformities/:id/transitions', '/api/nonconformities/{ncrA}/transitions', { status: 'ACTION', impactAssessment: 'Synthetic impact assessment' });
add('POST /api/uploads/access', '/api/uploads/access', { paths: ['{uploadA}'] });
add('GET /uploads/intake/:filename', '{uploadA}');
module.exports = cases;
