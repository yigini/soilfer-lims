const cases = [];
function add(key, path, body, query) { cases.push({ key, path, ...(body && { body }), ...(query && { query }) }); }
const stock = '/api/inventory', lot = `${stock}/lots/{inventoryLotA}`, asset = '/api/equipment/{equipmentA}';
add('GET /api/inventory/items', `${stock}/items`, null, { labId: '{labA}', search: 'R2-REAGENT-A' });
add('GET /api/inventory/items/:id', `${stock}/items/{inventoryItemA}`);
add('POST /api/inventory/items', `${stock}/items`, { labId: '{labA}', name: 'Synthetic new reagent', itemType: 'REAGENT',
    unitOfMeasure: 'g', defaultLocationId: '{reagentLocationA}' });
add('PUT /api/inventory/items/:id', `${stock}/items/{inventoryItemA}`, { name: 'Synthetic changed reagent' });
cases.push({ key: 'PUT /api/inventory/items/:id', path: `${stock}/items/{inventoryItemB}`, variant: 'foreign default location',
    body: { defaultLocationId: '{reagentLocationA}' } });
add('GET /api/inventory/lots', `${stock}/lots`, null, { itemId: '{inventoryItemA}', labId: '{labA}' });
add('POST /api/inventory/lots', `${stock}/lots`, { inventoryItemId: '{inventoryItemA}', lotNumber: 'Synthetic new lot', quantity: 10, locationId: '{reagentLocationA}' });
add('POST /api/inventory/lots/:id/consume', `${lot}/consume`, { quantity: 1, sampleId: '{sampleA}', workItemId: '{workItemA}', analysisCode: 'PH_H2O', reason: 'Synthetic consumption' });
add('POST /api/inventory/lots/:id/adjust', `${lot}/adjust`, { delta: 1, reason: 'Synthetic stock adjustment' });
for (const action of ['quarantine', 'release', 'dispose']) add(`POST /api/inventory/lots/:id/${action}`, `${lot}/${action}`, { reason: 'Synthetic stock disposition' });
add('POST /api/inventory/lots/:id/transfer', `${lot}/transfer`, { locationId: '{reagentLocationA}' });
add('GET /api/inventory/locations', `${stock}/locations`, null, { purpose: 'SAMPLE', labId: '{labA}' });
add('POST /api/inventory/locations', `${stock}/locations`, { name: 'Synthetic new child location', purpose: 'SAMPLE', labId: '{labA}', parentLocationId: '{locationA}' });
add('GET /api/inventory/transactions', `${stock}/transactions`, null, { lotId: '{inventoryLotA}', labId: '{labA}' });
add('GET /api/inventory/alerts', `${stock}/alerts`, null, { labId: '{labA}' });
add('GET /api/inventory/fefo/:itemId', `${stock}/fefo/{inventoryItemA}`);
for (const type of ['stock', 'expiry', 'transactions']) cases.push({ key: 'GET /api/inventory/export/:type',
    path: `${stock}/export/${type}`, variant: type, query: { labId: '{labA}' } });
add('GET /api/inventory/method-requirements', `${stock}/method-requirements`, null, { analysisCode: 'PH_H2O', labId: '{labA}' });
add('POST /api/inventory/method-requirements', `${stock}/method-requirements`, { analysisCode: 'PH_H2O', inventoryItemId: '{inventoryItemA}',
    methodId: '{methodA}', defaultConsumption: 1, unit: 'g', isRequired: true });
cases.push({ key: 'POST /api/inventory/method-requirements', path: `${stock}/method-requirements`, variant: 'own item with foreign method',
    body: { analysisCode: 'PH_H2O', inventoryItemId: '{inventoryItemB}', methodId: '{methodA}' } });
add('DELETE /api/inventory/method-requirements/:id', `${stock}/method-requirements/{methodRequirementA}`);

add('GET /api/equipment', '/api/equipment', null, { labId: '{labA}', type: 'OTHER' });
add('GET /api/equipment/:id', asset);
add('POST /api/equipment', '/api/equipment', { labId: '{labA}', name: 'Synthetic new instrument', assetType: 'OTHER', criticality: 'NON_CRITICAL' });
add('PUT /api/equipment/:id', asset, { name: 'Synthetic changed instrument' });
add('PATCH /api/equipment/:id/status', `${asset}/status`, { status: 'OUT_OF_SERVICE', reason: 'Synthetic status change' });
add('GET /api/equipment/:equipmentId/events', `${asset}/events`);
add('POST /api/equipment/events', '/api/equipment/events', { equipmentId: '{equipmentA}', eventType: 'VERIFICATION_PERFORMED',
    summary: 'Synthetic equipment verification', outcome: 'PASS' });
add('PATCH /api/equipment/events/:eventId/disposition', '/api/equipment/events/{equipmentEventA}/disposition', { decision: 'APPROVED', reason: 'Synthetic manager review' });
add('GET /api/equipment/eligibility', '/api/equipment/eligibility', null, { labId: '{labA}' });
add('POST /api/equipment/eligibility', '/api/equipment/eligibility', { analysisCode: 'PH_H2O', methodId: '{methodA}', eligibleEquipmentIds: ['{equipmentA}'], isRequired: true });
cases.push({ key: 'POST /api/equipment/eligibility', path: '/api/equipment/eligibility', variant: 'own method with foreign equipment',
    body: { analysisCode: 'PH_H2O', methodId: '{methodB}', eligibleEquipmentIds: ['{equipmentA}'], isRequired: true } });
add('GET /api/equipment/eligibility/:analysisCode', '/api/equipment/eligibility/PH_H2O', null, { labId: '{labA}' });
add('GET /api/equipment/audit/mismatches', '/api/equipment/audit/mismatches', null, { labId: '{labA}' });

add('GET /api/reference-materials', '/api/reference-materials', null, { labId: '{labA}' });
add('POST /api/reference-materials', '/api/reference-materials', { labId: '{labA}', code: 'R2-NEW-REFERENCE', name: 'Synthetic new reference',
    kind: 'LRM', matrix: 'SOIL', lotNumber: 'Synthetic reference lot', inventoryLotId: '{inventoryLotA}' });
add('PATCH /api/reference-materials/:id/status', '/api/reference-materials/{referenceA}/status', { status: 'RETIRED', reason: 'Synthetic retirement' });
add('POST /api/reference-materials/:id/values', '/api/reference-materials/{referenceA}/values', { analysisCode: 'PH_H2O', methodologyId: '{methodA}',
    assignedValue: 7.1, unit: '{referenceUnitA}', valueType: 'LAB_ASSIGNED' });
add('POST /api/reference-materials/:id/values/:valueId/correct', '/api/reference-materials/{referenceA}/values/{referenceValueA}/correct',
    { assignedValue: 7.1, reason: 'Synthetic reference correction' });

module.exports = cases;
