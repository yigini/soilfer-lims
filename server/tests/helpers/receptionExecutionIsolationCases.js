const cases = [];
function add(key, path, body, query) { cases.push({ key, path, ...(body && { body }), ...(query && { query }) }); }
add('GET /api/reception/intake-rules', '/api/reception/intake-rules', null, { sampleId: '{sampleA}' });
add('GET /api/reception/check-duplicate', '/api/reception/check-duplicate', null, { sampleId: '{sampleA}' });
add('GET /api/reception/sample-context', '/api/reception/sample-context', null, { id: '{sampleA}' });
add('GET /api/reception/sample-context/:id', '/api/reception/sample-context/{sampleA}');
add('POST /api/reception/intake', '/api/reception/intake', { id: '{draftA}', originalId: 'R2-ORIGINAL-draft-A', isDraft: true });
add('POST /api/reception/discard', '/api/reception/discard', { id: '{draftA}' });
add('GET /api/reception/consignments', '/api/reception/consignments', null, { projectCode: '{projectA}' });
add('GET /api/reception/consignments/:id', '/api/reception/consignments/{consignmentA}');
add('POST /api/reception/consignments', '/api/reception/consignments', { consignment: { projectCode: '{projectA}', declaredExpectedCount: 1,
    deliveredBy: 'Synthetic carrier' }, samples: [{ id: '{draftA}', originalId: 'R2-ORIGINAL-draft-A', receivedMass: 250,
    checklist: { container: true, label: true, quantity: true, condition: true, coc: true } }] });
cases.push({ key: 'GET /api/reception/batch-geometry-check', path: '/api/reception/batch-geometry-check',
    query: { projectId: '{projectA}', lat: 14.5, lng: -90.5 }, expectedEmptyGeometry: true });
cases.push({ key: 'POST /api/reception/upload-photo', path: '/api/reception/upload-photo', multipart: {
    fields: { labId: '{labA}' }, fileField: 'photos', filename: 'synthetic.png', contentType: 'image/png',
    base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=' } });
for (const entry of [
    { key: 'POST /api/reception/mass-check', path: '/api/reception/mass-check', body: { analysisCodes: ['PH_H2O'] }, globalReason: 'Public analysis-catalogue mass calculator, using only the current actor laboratory policy.' },
    { key: 'GET /api/reception/admin-units', path: '/api/reception/admin-units', query: { country: 'GTM' }, globalReason: 'Public geographical administrative-unit catalogue, not laboratory records.' },
    { key: 'POST /api/reception/parse-coordinates', path: '/api/reception/parse-coordinates', body: { coordinates: '14.5, -90.5' }, globalReason: 'Pure caller-supplied coordinate parser, with no sample lookup.' },
    { key: 'GET /api/reception/reverse-geocode', path: '/api/reception/reverse-geocode', query: { lat: 14.5, lng: -90.5 }, globalReason: 'Public geographical lookup from supplied coordinates; outbound HTTP is stubbed.' },
    { key: 'POST /api/reception/parse-manifest', path: '/api/reception/parse-manifest', body: { rows: [{ sample_id: 'SYNTHETIC-PREVIEW-ONLY', latitude: 14.5, longitude: -90.5 }] }, globalReason: 'Caller-supplied manifest parsing preview; no stored sample is requested or imported.' },
]) cases.push(entry);

add('GET /api/submissions', '/api/submissions', null, { sampleId: '{sampleA}', labId: '{labA}' });
add('GET /api/submissions/:id', '/api/submissions/{submissionA}');
add('GET /api/submissions/reanalysis', '/api/submissions/reanalysis', null, { sampleId: '{sampleA}' });
add('POST /api/submissions', '/api/submissions', { sampleId: '{sampleA}', type: 'FULL', workItemIds: ['{workItemA}'], note: 'Synthetic submission' });
add('POST /api/submissions/:id/review', '/api/submissions/{submissionA}/review', { decisions: [{ workItemId: '{workItemA}', decision: 'ACCEPT' }] });
add('GET /api/result-overrides', '/api/result-overrides', null, { workItemId: '{workItemA}' });
add('POST /api/result-overrides/work-items/:workItemId', '/api/result-overrides/work-items/{workItemA}', { value: '99', reason: 'Synthetic out-of-range request', methodologyId: '{methodA}' });
add('POST /api/result-overrides/:id/decision', '/api/result-overrides/{overrideA}/decision', { status: 'APPROVED', reason: 'Synthetic decision' });
add('POST /api/result-overrides/:id/cancel', '/api/result-overrides/{overrideA}/cancel', { reason: 'Synthetic cancellation' });
cases.push({ key: 'GET /api/labs/:id/policies', path: '/api/labs/{labB}/policies', variant: 'own policy must not reveal foreign private methods' });
module.exports = cases;
