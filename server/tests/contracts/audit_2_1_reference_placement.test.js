const { randomUUID, createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const prisma = require('../../prisma');
const app = require('../../app');
const service = require('../../services/referenceMaterialService');
const { linkReferences } = require('../../services/referencePlacementService');
const { getAuthToken } = require('../setup');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const { installReferenceMaterials } = require('../../scripts/install_reference_materials');
const labId = `RM-LAB-${randomUUID()}`, otherLab = `RM-OTHER-${randomUUID()}`, analysisCode = `RM_${randomUUID().replaceAll('-', '')}`;
const unit = `RM-UNIT-${randomUUID()}`, smallerUnit = `RM-SMALL-${randomUUID()}`, incompatibleUnit = `RM-OTHER-UNIT-${randomUUID()}`;
const methodA = randomUUID(), methodB = randomUUID();
let token, otherToken, actor, techToken;
const wire = value => JSON.parse(JSON.stringify(value));
const call = (verb, url, data, auth = token) => request(app)[verb](url).set('Authorization', `Bearer ${auth}`).send(data);
function snapshot() {
    const db = new Database(process.env.DATABASE_PATH, { readonly: true, fileMustExist: true });
    try { return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({ name }) => {
        const rows = db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}"`).all().map(row => JSON.stringify(row)).sort();
        return { name, count: rows.length, digest: createHash('sha256').update(JSON.stringify(rows)).digest('hex') };
    }); } finally { db.close(); }
}
beforeAll(async () => {
    for (const id of [labId, otherLab]) await prisma.lab.create({ data: { id, code: id, name: 'Owned reference laboratory', country: 'GTM' } });
    for (const [code, quantityKind, factorToBase] of [[unit, 'MASS_FRACTION', 1], [smallerUnit, 'MASS_FRACTION', 0.001], [incompatibleUnit, 'CEC', 1]]) {
        await prisma.unit.create({ data: { code, display: code, quantityKind, factorToBase } });
    }
    await prisma.analysis.create({ data: { code: analysisCode, name: 'Reference analysis', unitCode: unit, units: unit } });
    for (const id of [methodA, methodB]) await prisma.methodology.create({ data: { id, analysisCode, name: `Reference method ${id}` } });
    token = await getAuthToken('LAB_MANAGER', labId); actor = jwt.decode(token);
    otherToken = await getAuthToken('LAB_MANAGER', otherLab);
    techToken = await getAuthToken('LAB_TECHNICIAN', labId);
});
afterEach(() => jest.restoreAllMocks());
async function material(options = {}) {
    const response = await call('post', '/api/reference-materials', { code: randomUUID(), name: 'Owned soil reference', kind: 'CRM',
        matrix: 'SOIL', lotNumber: randomUUID(), ...options });
    expect(response.status).toBe(201); return response.body.data;
}
async function value(rm, options = {}) {
    const response = await call('post', `/api/reference-materials/${rm.id}/values`, { analysisCode, assignedValue: 7.123456,
        unit, valueType: 'CERTIFIED', ...options });
    expect(response.status).toBe(201); return response.body.data;
}
async function batch(methods = []) {
    const id = randomUUID();
    await prisma.batch.create({ data: { id, labId, analysis: analysisCode, profile: 'RACK_40', status: 'OPEN', createdBy: actor.username, history: '[]' } });
    for (const methodologyId of methods) {
        const sampleId = randomUUID();
        await createSampleFixture(prisma, { data: { id: sampleId, originalId: sampleId, assignedLab: labId, status: 'PROCESSING',
            receptionDate: new Date(), requiredAnalyses: JSON.stringify([analysisCode]) } });
        await createWorkItemFixture(prisma, { data: { id: randomUUID(), sampleId, analysis: analysisCode, methodologyId,
            labId, assignedLab: labId, assignedTo: actor.username, batchId: id, status: 'IN_PROGRESS' } });
    }
    return id;
}
const payload = controls => ({ blanks: [{ value: 0.001 }], duplicates: [{ value1: 7, value2: 7 }], controls });
const path = (id, endpoint) => `/api/qc/batches/${id}${endpoint === 'evaluate' ? '/evaluate' : ''}`;
const place = (id, endpoint, controls, auth = token) => call(endpoint === 'evaluate' ? 'post' : 'put', path(id, endpoint), payload(controls), auth);

test.each(['update', 'evaluate'].flatMap(endpoint => ['EXPIRED_RM', 'QUARANTINED_RM', 'QUARANTINED_LOT', 'EXPIRED_LOT', 'DISPOSED_LOT', 'LOT_EXPIRY'].map(kind => [endpoint, kind])))('%s refuses %s and writes no table', async (endpoint, kind) => {
    let inventoryLotId;
    if (kind.includes('LOT')) {
        const itemId = randomUUID(); inventoryLotId = randomUUID();
        await prisma.inventoryItem.create({ data: { id: itemId, labId, itemType: 'CRM', name: 'Owned reference stock', unitOfMeasure: 'g' } });
        await prisma.inventoryLot.create({ data: { id: inventoryLotId, labId, inventoryItemId: itemId, lotNumber: randomUUID(),
            status: kind === 'LOT_EXPIRY' ? 'AVAILABLE' : kind.split('_')[0], expiryDate: kind === 'LOT_EXPIRY' ? new Date(Date.now() - 1) : null,
            initialQuantity: 10, currentQuantity: 10, unitOfMeasure: 'g' } });
    }
    const rm = await material({ inventoryLotId, status: kind === 'QUARANTINED_RM' ? 'QUARANTINED' : 'ACTIVE',
        expiryDate: kind === 'EXPIRED_RM' ? new Date(Date.now() - 1).toISOString() : null });
    await value(rm); const id = await batch(), before = snapshot();
    const response = await place(id, endpoint, [{ referenceMaterialId: rm.id, referenceUse: 'CRM', measured: 7.123456 }]);
    expect(response).toMatchObject({ status: 409, body: { code: 'REFERENCE_MATERIAL_INELIGIBLE' } });
    expect(response.body.details.reason).toBeTruthy(); expect(snapshot()).toEqual(before);
});

test.each(['update', 'evaluate'])('%s derives expected, stores typed and JSON links, and retains the placement after expiry and correction', async endpoint => {
    const expires = new Date(Date.now() + 10000), rm = await material({ expiryDate: expires.toISOString() });
    const original = await value(rm, { assignedValue: 7123.456, unit: smallerUnit }), id = await batch([methodA]);
    const response = await place(id, endpoint, [{ referenceMaterialId: rm.id, referenceUse: 'CRM', measured: 7.123456 }]);
    expect(response.status).toBe(200); expect(response.body.status).toBe('QC_PASS');
    const saved = JSON.parse(response.body.batch.qcResults).controls[0], row = response.body.batch.qcItems.find(row => row.type === 'CONTROL');
    expect(saved).toMatchObject({ referenceMaterialId: rm.id, referenceValueId: original.id, referenceUse: 'CRM', expected: 7.123456,
        referenceSnapshot: { methodologyId: methodA, materialStatus: 'ACTIVE', materialExpiry: expires.toISOString(), valueType: 'CERTIFIED', coverageFactor: null } });
    expect(row).toMatchObject({ referenceMaterialId: rm.id, referenceValueId: original.id, expected: 7.123456 });
    expect(JSON.parse(row.details).referenceSnapshot).toEqual(saved.referenceSnapshot);
    const correction = await call('post', `/api/reference-materials/${rm.id}/values/${original.id}/correct`, { assignedValue: 8000, reason: 'Certificate transcription correction' });
    expect(correction.status).toBe(201);
    await call('patch', `/api/reference-materials/${rm.id}/status`, { status: 'QUARANTINED', reason: 'Lot investigation' });
    const later = await prisma.$transaction(tx => linkReferences(tx, response.body.batch, actor, { controls: [{ ...saved, measured: 7.12 }] }, new Date(expires.getTime() + 1)));
    expect(later.controls[0].referenceSnapshot).toEqual(saved.referenceSnapshot); expect(later.controls[0].referenceValueId).toBe(original.id);
    const reevaluated = await place(id, endpoint, [{ ...saved, measured: 7.12, rawInput: { expected: '7.123456', measured: '7.12' } }]);
    expect(reevaluated.status).toBe(200);
    expect(JSON.parse(reevaluated.body.batch.qcResults).controls[0]).toMatchObject({ referenceValueId: original.id, expected: 7.123456, referenceSnapshot: saved.referenceSnapshot });
    const before = snapshot();
    expect(await place(id, endpoint, [{ ...saved, id: randomUUID(), measured: 7.12 }])).toMatchObject({ status: 409, body: { code: 'REFERENCE_MATERIAL_INELIGIBLE' } });
    expect(snapshot()).toEqual(before);
});

test.each([
    ['missing use', {}, 'REFERENCE_USE_REQUIRED', 400],
    ['client method', { referenceUse: 'CRM', methodologyId: methodA }, 'REFERENCE_METHOD_SERVER_MANAGED', 400],
    ['wrong expected', { referenceUse: 'CRM', expected: 999 }, 'REFERENCE_VALUE_MISMATCH', 409],
    ['wrong value id', { referenceUse: 'CRM', referenceValueId: 'wrong' }, 'REFERENCE_VALUE_MISMATCH', 409]
])('%s refuses atomically in both entry points', async (_name, input, code, status) => {
    const rm = await material(); await value(rm);
    for (const endpoint of ['update', 'evaluate']) {
        const id = await batch(), before = snapshot();
        expect(await place(id, endpoint, [{ referenceMaterialId: rm.id, measured: 7.123456, ...input }])).toMatchObject({ status, body: { code } });
        expect(snapshot()).toEqual(before);
    }
});

test('CRM needs certified kind and value; LRM allows uncertified CRM, LRM and check soils, excluding calibration and blank materials', async () => {
    for (const kind of ['CRM', 'LRM', 'CHECK_STANDARD', 'CALIBRATION_STANDARD', 'BLANK_MATRIX']) {
        const rm = await material({ kind }); await value(rm, { valueType: 'LAB_ASSIGNED' });
        for (const referenceUse of ['CRM', 'LRM']) {
            const id = await batch(), before = snapshot(), response = await place(id, 'update', [{ referenceMaterialId: rm.id, referenceUse, measured: 7.123456 }]);
            if (referenceUse === 'LRM' && ['CRM', 'LRM', 'CHECK_STANDARD'].includes(kind)) expect(response.status).toBe(200);
            else { expect(response).toMatchObject({ status: 409, body: { code: ['CALIBRATION_STANDARD', 'BLANK_MATRIX'].includes(kind) ? 'REFERENCE_USE_INCOMPATIBLE' : 'REFERENCE_VALUE_NOT_CERTIFIED' } }); expect(snapshot()).toEqual(before); }
        }
    }
});

test.each([[methodA], [], [methodA, methodB], [methodA, null]])('recorded batch methods %j choose exact then generic; clients cannot force a specific value', async methods => {
    const rm = await material(), generic = await value(rm), specific = await value(rm, { methodologyId: methodA, assignedValue: 8 });
    const id = await batch(methods), resolved = methods.length === 1 ? specific : generic;
    const response = await place(id, 'evaluate', [{ referenceMaterialId: rm.id, referenceUse: 'CRM', measured: resolved.assignedValue }]);
    expect(response.status).toBe(200); expect(JSON.parse(response.body.batch.qcResults).controls[0].referenceValueId).toBe(resolved.id);
    const next = await batch(methods), before = snapshot();
    expect(await place(next, 'update', [{ referenceMaterialId: rm.id, referenceUse: 'CRM', referenceValueId: resolved.id === generic.id ? specific.id : generic.id, measured: 7 }]))
        .toMatchObject({ status: 409, body: { code: 'REFERENCE_VALUE_MISMATCH' } });
    expect(snapshot()).toEqual(before);
});

test.each([[], [methodA, methodB], [methodA, null]])('ambiguous batch %j refuses a catalogue with only method-specific values', async methods => {
    const rm = await material(); await value(rm, { methodologyId: methodA });
    for (const endpoint of ['update', 'evaluate']) {
        const id = await batch(methods), before = snapshot();
        expect(await place(id, endpoint, [{ referenceMaterialId: rm.id, referenceUse: 'CRM', measured: 7 }]))
            .toMatchObject({ status: 409, body: { code: 'REFERENCE_VALUE_METHOD_AMBIGUOUS' } });
        expect(snapshot()).toEqual(before);
    }
});

test('legacy unlinked controls still work and catalogue reads enforce laboratory scope', async () => {
    const rm = await material(); await value(rm); const id = await batch();
    expect(await place(id, 'evaluate', [{ expected: 7, measured: 7 }])).toMatchObject({ status: 200, body: { status: 'QC_PASS' } });
    const otherList = await call('get', '/api/reference-materials', undefined, otherToken);
    expect(otherList.status).toBe(200); expect(otherList.body.data.some(row => row.id === rm.id)).toBe(false);
    const before = snapshot();
    expect(await call('patch', `/api/reference-materials/${rm.id}/status`, { status: 'RETIRED', reason: 'Outside scope' }, otherToken)).toMatchObject({ status: 403 });
    expect(await call('post', '/api/reference-materials', { name: 'Unauthorized' }, techToken)).toMatchObject({ status: 403 });
    expect(snapshot()).toEqual(before);
});

test('certificate coverage factor is required only with uncertainty; duplicate current generic and exact values refuse without writes', async () => {
    const rm = await material(), before = snapshot();
    expect(await call('post', `/api/reference-materials/${rm.id}/values`, { analysisCode, unit, assignedValue: 7, expandedUncertainty: 0.1, valueType: 'CERTIFIED' }))
        .toMatchObject({ status: 400, body: { code: 'REFERENCE_COVERAGE_FACTOR_REQUIRED' } });
    expect(snapshot()).toEqual(before);
    for (const methodologyId of [null, methodA]) {
        const first = await value(rm, { methodologyId, expandedUncertainty: 0.25, coverageFactor: 1.96 });
        expect(first.coverageFactor).toBe(1.96);
        const prior = snapshot();
        expect(await call('post', `/api/reference-materials/${rm.id}/values`, { methodologyId, analysisCode, unit, assignedValue: 7, valueType: 'CERTIFIED' }))
            .toMatchObject({ status: 409, body: { code: 'REFERENCE_VALUE_CURRENT_EXISTS' } });
        expect(snapshot()).toEqual(prior);
    }
});

test.each(['insert', 'audit'])('failed correction %s rolls the old row and every table back', async fault => {
    const rm = await material(), old = await value(rm), before = snapshot(), transaction = prisma.$transaction.bind(prisma);
    jest.spyOn(prisma, '$transaction').mockImplementationOnce(callback => transaction(tx => callback({ ...tx,
        ...(fault === 'insert' ? { referenceValue: { ...tx.referenceValue, create: async () => { throw new Error('OWNED_CORRECTION_INSERT_FAULT'); } } } :
            { auditLog: { ...tx.auditLog, create: async () => { throw new Error('OWNED_CORRECTION_AUDIT_FAULT'); } } }) })));
    expect(await call('post', `/api/reference-materials/${rm.id}/values/${old.id}/correct`, { assignedValue: 8, reason: 'Owned fault test' })).toMatchObject({ status: 500 });
    expect(snapshot()).toEqual(before); expect((await prisma.referenceValue.findUnique({ where: { id: old.id } })).supersededById).toBeNull();
});

test('correction appends immutable facts and supersession is final; raw value mutation and referenced delete fail without writes', async () => {
    const rm = await material(), old = await value(rm), id = await batch();
    expect((await place(id, 'update', [{ referenceMaterialId: rm.id, referenceUse: 'CRM', measured: 7.123456 }])).status).toBe(200);
    const corrected = await call('post', `/api/reference-materials/${rm.id}/values/${old.id}/correct`, { assignedValue: 8, reason: 'Certificate transcription' });
    expect(corrected.status).toBe(201);
    const oldAfter = await prisma.referenceValue.findUnique({ where: { id: old.id } });
    expect(wire(oldAfter)).toMatchObject({ ...old, supersededById: corrected.body.data.id, correctionReason: 'Certificate transcription' });
    const before = snapshot();
    expect(await call('post', `/api/reference-materials/${rm.id}/values/${old.id}/correct`, { assignedValue: 9, reason: 'Second correction' }))
        .toMatchObject({ status: 409, body: { code: 'REFERENCE_VALUE_SUPERSEDED' } });
    for (const [field, next] of [['assignedValue', 9], ['unit', smallerUnit], ['expandedUncertainty', 0.1], ['coverageFactor', 2], ['valueType', 'INDICATIVE'],
        ['methodologyId', methodA], ['supersededById', null], ['correctionReason', 'Changed reason'], ['createdBy', 'changed']]) {
        await expect(prisma.$executeRawUnsafe(`UPDATE "ReferenceValue" SET "${field}"=? WHERE id=?`, next, old.id)).rejects.toThrow('REFERENCE_VALUE_IMMUTABLE');
        expect(snapshot()).toEqual(before);
    }
    await expect(prisma.$executeRawUnsafe('DELETE FROM "ReferenceValue" WHERE id=?', old.id)).rejects.toThrow('REFERENCE_VALUE_REFERENCED');
    expect(snapshot()).toEqual(before);
    // Replacing typed QC keeps the original link in the durable batch audit.
    expect((await place(id, 'update', [{ expected: 8, measured: 8 }])).status).toBe(200);
    const historical = snapshot();
    await expect(prisma.$executeRawUnsafe('DELETE FROM "ReferenceValue" WHERE id=?', old.id)).rejects.toThrow('REFERENCE_VALUE_REFERENCED');
    expect(snapshot()).toEqual(historical);
});

test('read-only catalogue warnings use per-lab policy and report days without changing expired status', async () => {
    const rm = await material({ expiryDate: new Date(Date.now() + 5 * 86400000).toISOString() }), expired = await material({ expiryDate: new Date(Date.now() - 86400000).toISOString() });
    await prisma.labPolicyOverride.create({ data: { id: randomUUID(), labId, key: 'referenceMaterials.expiryWarningDays', value: '2', reason: 'Owned warning policy', setBy: actor.username } });
    const before = snapshot(), listed = await call('get', '/api/reference-materials');
    expect(listed.status).toBe(200);
    expect(listed.body.data.find(row => row.id === rm.id)).toMatchObject({ expiryWarningDays: 2, daysToExpiry: 5, expiryWarning: false, eligible: true });
    expect(listed.body.data.find(row => row.id === expired.id)).toMatchObject({ status: 'ACTIVE', reason: 'EXPIRED', eligible: false });
    expect(snapshot()).toEqual(before);
});

test('startup integrity rejects missing supersession targets without writing', async () => {
    const rm = await material(), old = await value(rm);
    await prisma.referenceValue.update({ where: { id: old.id }, data: { supersededById: randomUUID(), supersededAt: new Date(), supersededBy: actor.username, correctionReason: 'Owned malformed pointer probe' } });
    const before = snapshot();
    expect(() => installReferenceMaterials({ dbPath: process.env.DATABASE_PATH })).toThrow(expect.objectContaining({ code: 'REFERENCE_INTEGRITY_REFUSED',
        differences: expect.arrayContaining([expect.objectContaining({ type: 'SUPERSESSION', id: old.id })]) }));
    expect(snapshot()).toEqual(before);
});
