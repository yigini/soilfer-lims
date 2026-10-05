const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const samples = require('../../services/sampleStateService');
const intake = require('../../services/intakeService');
const workflow = require('../../workflowContract');
const { getAuthToken } = require('../setup');

describe('Audit 1.2: the action-bound intake draft edge', () => {
    let lab, project, consignment, actor, token;
    const hold = { status: 'AMBIGUOUS_PROVENANCE_HOLD', reason: 'Source specimen review' };
    beforeAll(async () => {
        lab = await prisma.lab.create({ data: { id: randomUUID(), code: randomUUID(), name: 'Draft state laboratory', country: 'GTM' } });
        project = await prisma.project.create({ data: { id: randomUUID(), code: randomUUID(), name: 'Draft state project', labId: lab.id, status: 'ACTIVE' } });
        token = await getAuthToken('LAB_MANAGER', lab.id);
        actor = jwt.decode(token);
        await prisma.user.update({ where: { id: actor.id }, data: { mustChangePassword: false } });
        consignment = await prisma.consignment.create({ data: { id: randomUUID(), code: randomUUID(), labId: lab.id, receivedBy: actor.username } });
    });
    const create = (status = 'EXPECTED', extra = {}) => samples.createSample({ id: randomUUID(), originalId: randomUUID(), status,
        assignedLab: lab.id, projectId: project.id, projectCode: project.code, consignmentId: consignment.id,
        fieldMetadata: JSON.stringify({ site_id: 'source-site', profileReference: { code: 'source-profile', namespace: project.code,
            relation: 'SITE_POINT', source: 'FIELD', revision: 1, recordedBy: 'source-observer' } }),
        metadata: JSON.stringify({ provenanceHold: hold, sourceEvidence: 'unchanged' }), history: '[]', ...extra },
    'system:fixture', { context: 'fixture' });
    const draftBody = sample => ({ sampleId: sample.id, originalId: sample.originalId, isDraft: true, decision: 'DRAFT' });
    const post = (route, body) => request(app).post(route).set('Authorization', `Bearer ${token}`).send(body);
    async function snapshot(sampleId) {
        return { sample: await prisma.sample.findUnique({ where: { id: sampleId } }),
            audits: await prisma.auditLog.findMany({ where: { sampleId }, orderBy: { id: 'asc' } }),
            counts: await Promise.all([prisma.workItem.count(), prisma.sampleOrderRevision.count(), prisma.result.count(), prisma.labSequence.count()]) };
    }
    test('draft save preserves specimen identity, field provenance and its open hold, with one transition audit', async () => {
        const sample = await create(), before = await snapshot(sample.id);
        const response = await post('/api/reception/intake', draftBody(sample));
        expect(response.status).toBe(200);
        const after = await snapshot(sample.id);
        expect(after.sample).toMatchObject({ id: sample.id, originalId: sample.originalId, status: 'DRAFT',
            assignedLab: sample.assignedLab, projectId: sample.projectId, projectCode: sample.projectCode,
            consignmentId: sample.consignmentId, metadata: sample.metadata });
        expect(JSON.parse(after.sample.fieldMetadata)).toEqual(JSON.parse(sample.fieldMetadata));
        expect(JSON.parse(after.sample.history)).toContainEqual(expect.objectContaining({ status: 'DRAFT', changedBy: actor.username }));
        expect(after.audits).toHaveLength(before.audits.length + 1);
        expect(after.audits.filter(row => row.action === 'INTAKE_DRAFT_SAVED')).toHaveLength(1);
        expect(after.counts).toEqual(before.counts);
        const denied = await post('/api/reception/intake', { ...draftBody(sample), isDraft: false, decision: 'ACCEPTED' });
        expect(denied.status).toBe(409);
        expect(denied.body.code).toBe('AMBIGUOUS_PROVENANCE_HOLD');
        expect(await snapshot(sample.id)).toEqual(after);
    });
    test('the generic status API cannot take the expected-to-draft edge', async () => {
        const sample = await create(), before = await snapshot(sample.id);
        const response = await request(app).put(`/api/samples/${sample.id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'DRAFT' });
        expect(response.status).toBe(409);
        expect(response.body.code).toBe('ILLEGAL_STATUS_TRANSITION');
        expect(await snapshot(sample.id)).toEqual(before);
    });
    test('received draft saves and draft resaves retain their current state and custody', async () => {
        for (const status of ['RECEIVED', 'DRAFT']) {
            const sample = await create(status, { receptionDate: new Date('2026-10-01T10:00:00Z'), receivedBy: actor.username });
            const before = await snapshot(sample.id);
            expect((await post('/api/reception/intake', draftBody(sample))).status).toBe(200);
            const after = await snapshot(sample.id);
            expect(after.sample).toMatchObject({ status, receptionDate: sample.receptionDate, receivedBy: sample.receivedBy, metadata: sample.metadata });
            expect(after.audits).toEqual(before.audits);
        }
    });
    test('discard returns a registered draft to expected through the central edge', async () => {
        const sample = await create();
        expect((await post('/api/reception/intake', draftBody(sample))).status).toBe(200);
        expect((await post('/api/reception/discard', { id: sample.id })).status).toBe(200);
        expect(await prisma.sample.findUnique({ where: { id: sample.id } })).toMatchObject({ status: 'EXPECTED',
            originalId: sample.originalId, projectId: sample.projectId, consignmentId: sample.consignmentId, metadata: sample.metadata });
    });
    test('a failed conditional state update rolls back the draft and audit together', async () => {
        const sample = await create(), before = await snapshot(sample.id);
        await expect(prisma.$transaction(async tx => {
            const plan = await intake.prepareIntake(tx, { body: draftBody(sample), user: actor });
            const compare = jest.fn(async args => {
                expect(args.where).toMatchObject({ id: sample.id, status: 'EXPECTED' });
                return { count: 0 };
            });
            const faulty = new Proxy(tx, { get(target, property) {
                if (property === 'sample') return new Proxy(target.sample, { get(delegate, operation) {
                    return operation === 'updateMany' ? compare : delegate[operation];
                } });
                return target[property];
            } });
            return intake.commitPrepared(faulty, plan);
        })).rejects.toMatchObject({ statusCode: 409, code: 'SAMPLE_STATE_CHANGED' });
        expect(await snapshot(sample.id)).toEqual(before);
    });
    test.each(workflow.SAMPLE_STATE_LIST.filter(status => !['EXPECTED', 'DRAFT'].includes(status)))
        ('the draft action refuses a return from %s with zero writes', async status => {
            const sample = await create(status), before = await snapshot(sample.id);
            await expect(samples.transitionSample(sample.id, 'DRAFT', actor, 'Draft requested', {}, prisma,
                { action: 'INTAKE_DRAFT_SAVED' })).rejects.toMatchObject({ statusCode: 409, code: 'ILLEGAL_STATUS_TRANSITION' });
            expect(await snapshot(sample.id)).toEqual(before);
        });
});
