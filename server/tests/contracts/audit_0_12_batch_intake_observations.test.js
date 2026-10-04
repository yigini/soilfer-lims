const crypto = require('crypto');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const policy = require('../../services/policyService');
const { getAuthToken, ensureTestLab } = require('../setup');
const id = prefix => `${prefix}-${crypto.randomUUID()}`;
const labId = 'LAB-AUDIT-012';
const analysis = 'AUDIT_MASS_012';

describe('Audit 0.12: observed batch intake values', () => {
    let token;
    beforeAll(async () => {
        await ensureTestLab(labId, 'GTM');
        token = await getAuthToken('SAMPLE_RECEPTION', labId);
        await prisma.analysis.create({ data: { code: analysis, name: 'Audit mass method', matrix: 'SOIL', sampleMassRequired: 50, status: 'active' } });
    });
    afterEach(() => jest.restoreAllMocks());
    const post = (path, body) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body);
    const row = data => ({ originalId: id('SMP-012'), status: 'ACCEPTED', ...data });
    const receive = (samples, rest = {}) => post('/api/reception/consignments', { samples, ...rest, defaults: {
        requiredAnalyses: [analysis], checklist: { items: Object.fromEntries(['container', 'label', 'quantity', 'condition', 'coc'].map(key => [key, { status: 'PASS' }])) }, ...rest.defaults
    } });
    const stored = originalId => prisma.sample.findFirst({ where: { originalId } });
    async function counts() {
        return Promise.all([prisma.sample.count(), prisma.consignment.count(), prisma.workItem.count(), prisma.auditLog.count()]);
    }
    test('absent observations remain null and mass is flagged, even if legacy defaults are present', async () => {
        const s = row({ latitude: 14.5, longitude: -89.4 });
        const response = await receive([s], { defaults: { requiredAnalyses: [analysis], receivedMass: 500, moistureOnArrival: 'MOIST' } });
        expect(response.status).toBe(201);
        const sample = await stored(s.originalId);
        expect(sample).toMatchObject({ receivedMass: null, moistureOnArrival: null, positionalUncertaintyM: null, massWarningAcknowledged: false });
        expect(JSON.parse(sample.receptionData)).toMatchObject({ massNotRecorded: true, massStatus: 'MASS_NOT_RECORDED', massDeficitInfo: null });
    });
    test('explicit bulk application records fields, values and affected rows while retaining row exceptions', async () => {
        const a = row(), b = row({ receivedMass: 620 });
        const action = { fields: { receivedMass: 550, moistureOnArrival: 'MOIST' }, sampleIds: [a.originalId, b.originalId] };
        const response = await receive([a, b], { bulkApplications: [action] });
        expect(response.status).toBe(201);
        expect(await stored(a.originalId)).toMatchObject({ receivedMass: 550, moistureOnArrival: 'MOIST', massWarningAcknowledged: false });
        expect(await stored(b.originalId)).toMatchObject({ receivedMass: 620, moistureOnArrival: 'MOIST' });
        const audit = await prisma.auditLog.findFirst({ where: { entityId: response.body.consignment.id, action: 'CONSIGNMENT_BATCH_RECEIVED' } });
        expect(JSON.parse(audit.details).bulkApplications).toEqual([action]);
        expect(audit.performedBy).toBeTruthy();
    });
    test('clearing a row after bulk application stores null rather than inheriting that action again', async () => {
        const s = row({ receivedMass: null, moistureOnArrival: '' });
        expect((await receive([s], { bulkApplications: [{ fields: { receivedMass: 550, moistureOnArrival: 'WET' }, sampleIds: [s.originalId] }] })).status).toBe(201);
        expect(await stored(s.originalId)).toMatchObject({ receivedMass: null, moistureOnArrival: null });
    });
    test('below-required mass uses the same calculation and refuses the entire batch before any writes', async () => {
        const requirement = await post('/api/reception/mass-check', { analysisCodes: [analysis] });
        expect(requirement.status).toBe(200); expect(requirement.body.totalRequiredMass).toBe(150);
        const good = row({ receivedMass: 550 }), low = row({ receivedMass: 60 }), before = await counts();
        const response = await receive([good, low]);
        expect(response.status).toBe(422); expect(response.body.code).toBe('MASS_DEFICIT');
        expect(response.body.warnings).toEqual([{ row: 2, originalId: low.originalId, code: 'MASS_DEFICIT', massDeficitInfo: {
            receivedMass: 60, totalRequiredMass: 150, totalAnalyticalMass: 50, retentionBuffer: 100, deficit: 90,
            analysesAtRisk: [{ code: analysis, name: 'Audit mass method', massRequired: 50 }]
        } }]);
        expect(await counts()).toEqual(before);
    });
    test('only an explicit per-row acknowledgement allows a mass deficit and records its audit evidence', async () => {
        const s = row({ receivedMass: 60 });
        expect((await receive([s], { defaults: { requiredAnalyses: [analysis], massWarningAcknowledged: true } })).status).toBe(422);
        expect((await receive([{ ...s, massWarningAcknowledged: 'true' }])).status).toBe(422);
        const response = await receive([{ ...s, massWarningAcknowledged: true }]);
        expect(response.status).toBe(201);
        const sample = await stored(s.originalId);
        expect(sample).toMatchObject({ receivedMass: 60, massWarningAcknowledged: true });
        expect(JSON.parse(sample.receptionData)).toMatchObject({ massStatus: 'MASS_DEFICIT', massDeficitInfo: { deficit: 90 } });
        const audit = await prisma.auditLog.findFirst({ where: { entityId: response.body.consignment.id, action: 'CONSIGNMENT_BATCH_RECEIVED' } });
        expect(JSON.parse(audit.details).massDeficitAcknowledgements).toEqual([s.originalId]);
    });
    test('zero mass is an observation requiring acknowledgement, not a missing value or 500g fallback', async () => {
        const s = row({ receivedMass: 0, massWarningAcknowledged: true, moistureOnArrival: 'DRY', positionalUncertaintyM: 0 });
        expect((await receive([s])).status).toBe(201);
        expect(await stored(s.originalId)).toMatchObject({ receivedMass: 0, positionalUncertaintyM: 0, moistureOnArrival: 'DRY', massWarningAcknowledged: true });
    });
    test('rejected rows preserve observed low mass without requiring an acceptance override', async () => {
        const s = row({ status: 'REJECTED', rejectionReason: 'Damaged bag', receivedMass: 5 });
        expect((await receive([s])).status).toBe(201);
        expect(await stored(s.originalId)).toMatchObject({ status: 'RECEIVED_REJECTED', receivedMass: 5, massWarningAcknowledged: false });
    });
    test.each([{ receivedMass: -1 }, { receivedMass: '500g' }, { receivedMass: false }, { moistureOnArrival: 'unknown' }, { positionalUncertaintyM: -2 }])('invalid observation is a stable 422 before writes: %s', async observation => {
        const before = await counts(), response = await receive([row(observation)]);
        expect(response.status).toBe(422); expect(response.body.code).toBe('INVALID_INTAKE_OBSERVATION');
        expect(response.body.errors).toHaveLength(1);
        expect(await counts()).toEqual(before);
    });
    test('bulk actions cannot name unrelated rows or implicit warning acknowledgement fields', async () => {
        const s = row(), before = await counts();
        for (const action of [{ fields: { receivedMass: 550 }, sampleIds: ['unrelated'] }, { fields: { massWarningAcknowledged: true }, sampleIds: [s.originalId] }]) {
            const response = await receive([s], { bulkApplications: [action] });
            expect(response.status).toBe(400); expect(response.body.code).toBe('BULK_APPLICATION_INVALID');
            expect(await counts()).toEqual(before);
        }
    });
    test('mass checks read lab policy and method context while preserving the existing Strict defaults', async () => {
        const original = policy.get;
        const lookup = jest.spyOn(policy, 'get').mockImplementation((lab, key, context) => key === 'intake.retentionMassG' ? 25 : original(lab, key, context));
        const s = row({ receivedMass: 80 });
        expect((await receive([s])).status).toBe(201);
        expect(lookup).toHaveBeenCalledWith(labId, 'intake.retentionMassG', expect.objectContaining({ db: expect.objectContaining({ sample: expect.any(Object) }) }));
        expect((await post('/api/reception/mass-check', { analysisCodes: [analysis] })).body.totalRequiredMass).toBe(75);
    });
    test.each([false, true])('manifest coordinates never imply uncertainty, and a supplied accuracy is retained (combined=%s)', async combined => {
        const input = { sample_id: id('manifest'), ...(combined ? { coordinates: '14.5, -89.4' } : { latitude: '14.5', longitude: '-89.4' }) };
        const absent = await post('/api/reception/parse-manifest', { rows: [input] });
        expect(absent.status).toBe(200); expect(absent.body.parsedRows[0].positionalUncertaintyM).toBeNull();
        const supplied = await post('/api/reception/parse-manifest', { rows: [{ ...input, uncertainty: 8.4 }], mapping: { positionalUncertaintyM: 'uncertainty' } });
        expect(supplied.status).toBe(200); expect(supplied.body.parsedRows[0].positionalUncertaintyM).toBe(8.4);
    });
});
