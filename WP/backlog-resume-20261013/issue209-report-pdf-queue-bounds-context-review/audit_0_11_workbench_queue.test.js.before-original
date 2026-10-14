const { createExecutionResultsFixture } = require('../helpers/workAttemptFixtures');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');
const id = prefix => `${prefix}-${crypto.randomUUID()}`;
const labId = 'LAB-AUDIT-11';

describe('Audit 0.11: queue evidence and instrument readiness', () => {
    let token;
    beforeAll(async () => { await require('../setup').ensureTestLab(labId, 'TEST'); token = await getAuthToken('LAB_TECHNICIAN', labId); });
    async function fixture() {
        const analysis = id('AUDIT11'), sampleId = id('SMP11'), workItemId = id('WI11'), equipmentId = id('EQ11');
        await prisma.analysis.create({ data: { code: analysis, name: 'Audit fixture numeric method', units: 'mg/kg', status: 'active' } });
        await createSampleFixture(prisma, { data: { id: sampleId, originalId: sampleId, labId: sampleId, assignedLab: labId, status: 'PROCESSING',
            receptionDate: new Date(), dryingStatus: 'DONE', preparationStatus: 'DONE' } });
        await createWorkItemFixture(prisma, { data: { id: workItemId, sampleId, analysis, assignedLab: labId, assignedTo: jwt.decode(token).username,
            status: 'ASSIGNED', version: 0, result: '88' } });
        await prisma.equipmentAsset.create({ data: { id: equipmentId, labId, name: 'Qualified meter', assetType: 'OTHER', status: 'IN_SERVICE', criticality: 'IMPORTANT',
            qualification: { create: { id: id('QUAL11'), labId, calibrationStatus: 'OK', verificationStatus: 'OK' } } } });
        await prisma.equipmentMethodEligibility.create({ data: { id: id('EL11'), labId, analysisCode: analysis,
            isRequired: true, eligibleEquipmentIds: JSON.stringify([equipmentId]) } });
        return { analysis, sampleId, workItemId, equipmentId };
    }
    const queue = f => request(app).get('/api/workbench/queue').query({ workItemId: f.workItemId }).set('Authorization', `Bearer ${token}`);
    const save = (f, body) => request(app).post('/api/workbench/batch-save').set('Authorization', `Bearer ${token}`).send({
        ...body, entries: [{ workItemId: f.workItemId, value: '6.2', equipmentId: f.equipmentId }]
    });
    test('missing-instrument blocker clears after selection, and the required-instrument method can complete', async () => {
        const f = await fixture();
        let res = await queue(f);
        expect(res.status).toBe(200);
        expect(res.body.groups[0].items[0].readiness.blockers).toEqual(['INSTRUMENT_REQUIRED']);
        expect(res.body.groups[0].eligibleEquipment[0].status).toBe('IN_SERVICE');
        expect((await save(f, { draft: true })).status).toBe(200);
        res = await queue(f);
        expect(res.body.groups[0].items[0].readiness.isReady).toBe(true);
        expect(res.body.groups[0].items[0].draft.instrumentId).toBe(f.equipmentId);
        expect((await save(f, { draft: false })).status).toBe(200);
        expect((await prisma.result.findFirst({ where: { sampleId: f.sampleId, isCurrent: true } })).numericValue).toBe(6.2);
    });
    test('current invalid measurement is a hint; superseded rows and WorkItem.result cannot supply the input', async () => {
        const f = await fixture();
        const [prior] = await createExecutionResultsFixture(prisma, { data: [
            { id: id('RES11'), sampleId: f.sampleId, param: f.analysis, value: '0',
                isCurrent: true, isValid: false, flags: '["REVIEW_RETURNED"]', createdAt: new Date('2026-01-01') },
            { id: id('RES11-OLD'), sampleId: f.sampleId, param: f.analysis, value: '99',
                isCurrent: false, isValid: true, createdAt: new Date('2026-02-01') }
        ] });
        let res = await queue(f);
        expect(res.body.groups[0].items[0].previousResult).toEqual({ value: '0', unit: null, isValid: false });
        expect(res.body.groups[0].items[0].draft).toBeNull();
        await prisma.result.update({ where: { id: prior.id }, data: { isCurrent: false } });
        res = await queue(f);
        expect(res.body.groups[0].items[0].previousResult).toBeNull();
        expect(res.body.groups[0].items[0].currentResult).toBeNull();
        expect((await prisma.workItem.findUnique({ where: { id: f.workItemId } })).result).toBe('88');
    });
});
