const { createExecutionResultFixture } = require('../helpers/workAttemptFixtures');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const crypto = require('crypto');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken, ensureTestLab } = require('../setup');
const { setFixtureQcRequirement } = require('../helpers/qcPolicyFixture');
const { normalizeLegacyQcFixture } = require('../helpers/normalizedQcFixture');
const labId = 'LAB-AUDIT-05';
const id = prefix => `${prefix}-${crypto.randomUUID()}`;

describe('Audit 0.5: legacy review delegates to the guarded authority', () => {
    let manager, technician;
    beforeAll(async () => {
        await ensureTestLab(labId, 'TEST');
        manager = await getAuthToken('LAB_MANAGER', labId);
        technician = await getAuthToken('LAB_TECHNICIAN', labId);
        await setFixtureQcRequirement(prisma, manager, labId);
    });
    async function fixture({ status = 'SUBMITTED', evidence = true, batchStatus, assignedLab = labId } = {}) {
        const sampleId = id('SMP-05');
        await createSampleFixture(prisma, { data: { id: sampleId, originalId: sampleId, labId: sampleId, assignedLab, status: 'PROCESSING',
            dryingStatus: 'DONE', preparationStatus: 'DONE' } });
        const batch = batchStatus ? await prisma.batch.create({ data: { id: id('B-05'), analysis: 'PH_H2O', status: batchStatus, labId: assignedLab, createdBy: 'test',
            qcResults: batchStatus === 'QC_FAIL' ? JSON.stringify({ blanks: [{ value: 2, maxAllowed: 1, status: 'FAIL' }], duplicates: [], controls: [] }) : null } }) : null;
        const item = await createWorkItemFixture(prisma, { data: { id: id('WI-05'), sampleId, analysis: 'PH_H2O', assignedLab, status,
            result: evidence ? '6.2' : null, batchId: batch?.id } });
        const result = evidence ? await createExecutionResultFixture(prisma, { ...(status === 'ACCEPTED' && { attemptStatus: 'ACCEPTED' }),
            data: { id: id('R-05'), sampleId, param: 'PH_H2O', value: '6.2', numericValue: 6.2,
            isCurrent: true, isValid: true, flags: JSON.stringify(['METHOD_NOTE']), batchId: batch?.id } }) : null;
        if (batch) {
            await setFixtureQcRequirement(prisma, manager, labId, 'REQUIRED');
            await normalizeLegacyQcFixture(prisma, batch.id);
        } else if (assignedLab === labId) await setFixtureQcRequirement(prisma, manager, labId);
        return { sampleId, item, result };
    }
    const review = (f, body, token = manager) => request(app).post(`/api/reviews/${f.item.id}`).set('Authorization', `Bearer ${token}`).send(body);
    async function state(f) {
        return { item: await prisma.workItem.findUnique({ where: { id: f.item.id } }),
            results: await prisma.result.findMany({ where: { sampleId: f.sampleId } }),
            decisions: await prisma.reviewDecision.findMany({ where: { workItemId: f.item.id } }),
            audit: await prisma.auditLog.findMany({ where: { sampleId: f.sampleId } }) };
    }
    test.each(['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'ACCEPTED'])('legacy ACCEPT cannot bypass the %s state guard or mutate evidence', async status => {
        const f = await fixture({ status }), before = await state(f);
        const response = await review(f, { decision: 'ACCEPT', status: 'WAIVED' });
        expect(response.status).toBe(409); expect(response.body.code).toBe('ITEM_NOT_SUBMITTED');
        expect(await state(f)).toEqual(before);
    });
    test('legacy ACCEPT enforces laboratory scope using the linked sample', async () => {
        const f = await fixture({ assignedLab: 'LAB-OTHER-05' }), before = await state(f);
        const response = await review(f, { decision: 'ACCEPT' });
        expect(response.status).toBe(403); expect(response.body.code).toBe('ACCESS_DENIED_LAB');
        expect(await state(f)).toEqual(before);
    });
    test.each(['QC_FAIL', 'RUNNING'])('legacy ACCEPT enforces the %s batch verdict', async batchStatus => {
        const f = await fixture({ batchStatus }), before = await state(f);
        const response = await review(f, { decision: 'ACCEPT' });
        expect(response.status).toBe(409); expect(response.body.code).toBe(batchStatus === 'QC_FAIL' ? 'QC_GATE_FAILED' : 'QC_GATE_NOT_EVALUATED');
        expect(await state(f)).toEqual(before);
    });
    test('legacy ACCEPT requires actual evidence', async () => {
        const f = await fixture({ evidence: false }), before = await state(f);
        const response = await review(f, { decision: 'ACCEPT' });
        expect(response.status).toBe(422); expect(response.body.code).toBe('MISSING_EVIDENCE');
        expect(await state(f)).toEqual(before);
    });
    test('legacy ACCEPT uses the canonical response and writes its decision/audit once', async () => {
        const f = await fixture(), canonicalFixture = await fixture();
        const canonical = await request(app).post(`/api/work/${canonicalFixture.item.id}/review`).set('Authorization', `Bearer ${manager}`).send({ status: 'ACCEPTED' });
        const response = await review(f, { decision: 'ACCEPT' });
        expect(response.status).toBe(canonical.status); expect(response.status).toBe(200);
        expect(Object.keys(response.body).sort()).toEqual(Object.keys(canonical.body).sort());
        expect(response.body.success).toBe(true); expect(response.body.item.id).toBe(f.item.id); expect(response.body.item.status).toBe('ACCEPTED');
        const after = await state(f);
        expect(after.decisions).toHaveLength(1); expect(after.decisions[0].decision).toBe('ACCEPT');
        expect(after.audit.filter(row => row.action === 'REVIEW')).toHaveLength(1);
        expect(after.results[0]).toEqual(f.result);
    });
    test('legacy REJECT preserves scalar values and invokes canonical RETURN invalidation', async () => {
        const f = await fixture();
        const response = await review(f, { decision: 'REJECT', reason: 'Check drift' });
        expect(response.status).toBe(200); expect(response.body.item.status).toBe('REPEAT_REQUIRED');
        const after = await state(f);
        expect(after.results[0].value).toBe('6.2'); expect(after.results[0].numericValue).toBe(6.2);
        expect(after.results[0].isValid).toBe(false);
        expect(JSON.parse(after.results[0].flags)).toEqual(['METHOD_NOTE', 'REVIEW_RETURNED']);
        expect(after.decisions).toHaveLength(1); expect(after.decisions[0].decision).toBe('RETURN');
        expect(after.audit.filter(row => row.action === 'REVIEW_RETURNED')).toHaveLength(1);
    });
    test('legacy WAIVE maps to the canonical WAIVED state with a durable reason', async () => {
        const f = await fixture(), before = f.result;
        const response = await review(f, { decision: 'WAIVE', reason: 'Insufficient material' });
        expect(response.status).toBe(200); expect(response.body.item.status).toBe('WAIVED');
        const after = await state(f);
        expect(after.decisions).toHaveLength(1); expect(after.decisions[0].decision).toBe('OMIT');
        expect(after.decisions[0].reason).toBe('Insufficient material'); expect(after.results[0]).toEqual(before);
    });
    test.each([
        [{ decision: 'UNKNOWN' }, 'INVALID_REVIEW_DECISION'],
        [{ decision: 'WAIVE', reason: ' ' }, 'REVIEW_REASON_REQUIRED'],
        [{ decision: 'REJECT' }, 'REVIEW_REASON_REQUIRED'],
        [{ decision: 'ACCEPT', reason: {} }, 'INVALID_REVIEW_REASON']
    ])('malformed legacy request %j fails with a stable code before writes', async (body, code) => {
        const f = await fixture(), before = await state(f);
        const response = await review(f, body);
        expect(response.status).toBe(400); expect(response.body.code).toBe(code);
        expect(await state(f)).toEqual(before);
    });
    test('legacy review keeps the permission middleware', async () => {
        const f = await fixture(), before = await state(f);
        expect((await review(f, { decision: 'ACCEPT' }, technician)).status).toBe(403);
        expect((await request(app).post(`/api/reviews/${f.item.id}`).send({ decision: 'ACCEPT' })).status).toBe(401);
        expect(await state(f)).toEqual(before);
    });
});
