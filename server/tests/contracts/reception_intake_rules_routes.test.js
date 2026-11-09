'use strict';
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');
const { createSampleFixture, cleanupWorkflowFixtures } = require('../helpers/workflowFixtures');
const { strict } = require('../../config/policyRegistry');

describe('#156 server-resolved reception rules across intake paths', () => {
    const prefix = 'IR156-' + Date.now();
    const labId = prefix + '-LAB';
    let reception, manager, sequence = 0;
    const next = () => prefix + '-' + (++sequence);
    const checklist = () => ({ items: Object.fromEntries(Object.keys(strict('reception.intakeRules').project.criteria).map(key => [key, { status: 'PASS' }])) });
    const payload = originalId => ({ originalId, isWalkIn: true, decision: 'ACCEPTED', receivedMass: 300, checklist: checklist() });
    const post = (url, body, auth = reception) => request(app).post(url).set('Authorization', auth).send(body);
    async function edit(value) {
        const current = await request(app).get(`/api/labs/${labId}/policies`).set('Authorization', manager);
        expect(current.status).toBe(200);
        const response = await request(app).patch(`/api/labs/${labId}/policies`).set('Authorization', manager)
            .send({ expectedVersion: current.body.version, reason: 'Review reception requirements', changes: [{ key: 'reception.intakeRules', value }] });
        expect(response.status).toBe(200);
    }
    async function arrival() {
        const originalId = next();
        const sample = await createSampleFixture(prisma, { data: { id: originalId, originalId, assignedLab: labId,
            status: 'EXPECTED', metadata: JSON.stringify({ origin: 'DESK_WALKIN' }) } });
        const response = await post(`/api/samples/${sample.id}/receive`, { checklist: { items: {} } });
        expect(response.status).toBe(200);
        return sample;
    }
    async function offline(body) {
        const operationId = next();
        const response = await post('/api/sync/operations', { protocolVersion: 1, deviceId: prefix, operations: [{
            operationId, type: 'RECORD_INTAKE', target: { originalId: body.originalId }, capturedAtLocal: new Date().toISOString(), payload: body
        }] });
        expect(response.status).toBe(200);
        return response.body.receipts[0];
    }
    beforeAll(async () => {
        await prisma.lab.create({ data: { id: labId, code: 'R' + String(Date.now()).slice(-5), name: 'Reception rules test lab', country: 'Guatemala', isActive: true } });
        reception = 'Bearer ' + await getAuthToken('SAMPLE_RECEPTION', labId, ['GTM']);
        manager = 'Bearer ' + await getAuthToken('LAB_MANAGER', labId, ['GTM']);
        await prisma.user.updateMany({ where: { labId }, data: { mustChangePassword: false } });
    });
    beforeEach(async () => { await edit(strict('reception.intakeRules')); });
    afterAll(async () => {
        const samples = await prisma.sample.findMany({ where: { originalId: { startsWith: prefix } }, select: { id: true } });
        const ids = samples.map(sample => sample.id);
        const work = await prisma.workItem.findMany({ where: { sampleId: { in: ids } }, select: { id: true } });
        await cleanupWorkflowFixtures(prisma, 'workItem', work.map(item => item.id), { single: false });
        await cleanupWorkflowFixtures(prisma, 'sample', ids, { single: false });
        // Custody evidence retains samples and their consignments until the
        // disposable suite database is removed; do not delete those parents.
        await prisma.labPolicyOverride.deleteMany({ where: { labId } });
        await prisma.labPolicy.deleteMany({ where: { labId } });
        await prisma.commandReceipt.deleteMany({ where: { idempotencyKey: { startsWith: prefix } } });
    });
    test('empty arrival remains RECEIVED pending; that same sample cannot be accepted until answered', async () => {
        const sample = await arrival();
        let saved = await prisma.sample.findUnique({ where: { id: sample.id } });
        expect(saved.status).toBe('RECEIVED');
        expect(saved.acceptedAt).toBeNull();
        expect(JSON.parse(saved.receptionData).checklistDraft).toBe(true);
        const refused = await post(`/api/samples/${sample.id}/accept`, { receivedMass: 300, checklist: { items: {} } }, manager);
        expect(refused.status).toBe(400);
        expect(refused.body.code).toBe('INCOMPLETE_COMPLIANCE_CHECKLIST');
        expect((await prisma.sample.findUnique({ where: { id: sample.id } })).status).toBe('RECEIVED');
        const accepted = await post(`/api/samples/${sample.id}/accept`, { receivedMass: 300, checklist: checklist() }, manager);
        expect(accepted.status).toBe(200);
        saved = await prisma.sample.findUnique({ where: { id: sample.id } });
        expect(saved.status).toBe('ACCEPTED');
        const auditBefore = await prisma.auditLog.findMany({ where: { entityId: sample.id }, orderBy: { id: 'asc' } });
        const value = strict('reception.intakeRules'); value.walkIn.context.landUse.required = true;
        await edit(value);
        const after = await prisma.sample.findUnique({ where: { id: sample.id } });
        expect(after.receptionData).toBe(saved.receptionData);
        expect(after.history).toBe(saved.history);
        expect(await prisma.auditLog.findMany({ where: { entityId: sample.id }, orderBy: { id: 'asc' } })).toEqual(auditBefore);
    });
    test('a disabled criterion is optional in single, batch, legacy accept and offline final intake', async () => {
        const value = strict('reception.intakeRules');
        for (const profile of Object.values(value)) profile.criteria.container.enabled = false;
        await edit(value);
        const withoutContainer = originalId => { const body = payload(originalId); delete body.checklist.items.container; return body; };
        expect((await post('/api/reception/intake', withoutContainer(next()))).status).toBe(200);
        const batchBody = withoutContainer(next());
        const batch = await post('/api/reception/consignments', { samples: [batchBody] });
        expect(batch.status).toBe(201);
        const sample = await arrival();
        expect((await post(`/api/samples/${sample.id}/accept`, withoutContainer(sample.originalId), manager)).status).toBe(200);
        const operation = await offline(withoutContainer(next()));
        expect(operation.status).toBe('APPLIED');
        expect(operation.outcome.status).toBe('ACCEPTED');
    });
    test('required context refuses final acceptance in all four paths despite caller-supplied easier rules', async () => {
        const value = strict('reception.intakeRules');
        for (const profile of Object.values(value)) profile.context.landUse.required = true;
        await edit(value);
        const easier = originalId => ({ ...payload(originalId), profile: 'walkIn', intakeRules: strict('reception.intakeRules'), samplingDetails: { landUse: '' } });
        const singleId = next(), single = await post('/api/reception/intake', easier(singleId));
        expect(single.status).toBe(400); expect(single.body.code).toBe('INCOMPLETE_INTAKE_CONTEXT');
        expect(await prisma.sample.findFirst({ where: { originalId: singleId } })).toBeNull();
        const batchId = next(), batch = await post('/api/reception/consignments', { samples: [easier(batchId)] });
        expect(batch.status).toBe(422); expect(batch.body.errors[0].code).toBe('INCOMPLETE_INTAKE_CONTEXT');
        expect(await prisma.sample.findFirst({ where: { originalId: batchId } })).toBeNull();
        const sample = await arrival();
        const legacy = await post(`/api/samples/${sample.id}/accept`, easier(sample.originalId), manager);
        expect(legacy.status).toBe(400); expect(legacy.body.code).toBe('INCOMPLETE_INTAKE_CONTEXT');
        expect((await prisma.sample.findUnique({ where: { id: sample.id } })).status).toBe('RECEIVED');
        const offlineId = next(), receipt = await offline(easier(offlineId));
        expect(receipt.status).toBe('REJECTED'); expect(receipt.code).toBe('INCOMPLETE_INTAKE_CONTEXT');
        expect(await prisma.sample.findFirst({ where: { originalId: offlineId } })).toBeNull();
    });
    test('batch final acceptance with no answers is refused atomically', async () => {
        const originalId = next();
        const response = await post('/api/reception/consignments', { samples: [{ originalId, receivedMass: 300 }] });
        expect(response.status).toBe(422);
        expect(response.body.errors[0].code).toBe('INCOMPLETE_COMPLIANCE_CHECKLIST');
        expect(await prisma.sample.findFirst({ where: { originalId } })).toBeNull();
    });
    test('offline arrival remains pending, while a prior successful command receipt stays immutable after a policy edit', async () => {
        const originalId = next();
        const received = await offline({ originalId, isWalkIn: true, checklist: { items: {} } });
        expect(received.status).toBe('APPLIED');
        expect(received.outcome.status).toBe('RECEIVED');
        const sample = await prisma.sample.findFirst({ where: { originalId } });
        expect(JSON.parse(sample.receptionData).checklistDraft).toBe(true);
        const oldReceipt = await prisma.commandReceipt.findUnique({ where: { idempotencyKey: received.operationId } });
        const value = strict('reception.intakeRules'); value.walkIn.context.landUse.required = true;
        await edit(value);
        const replay = await post('/api/sync/operations', { protocolVersion: 1, deviceId: prefix, operations: [{ operationId: received.operationId,
            type: 'RECORD_INTAKE', target: { originalId }, payload: { originalId, isWalkIn: true, checklist: { items: {} } } }] });
        expect(replay.body.receipts[0].status).toBe('DUPLICATE_APPLIED');
        expect(await prisma.commandReceipt.findUnique({ where: { idempotencyKey: received.operationId } })).toEqual(oldReceipt);
        const accept = await post(`/api/samples/${sample.id}/accept`, { receivedMass: 300, checklist: checklist() }, manager);
        expect(accept.status).toBe(400); expect(accept.body.code).toBe('INCOMPLETE_INTAKE_CONTEXT');
    });
    test('persisted external provenance cannot be downgraded to a caller-selected walk-in profile', async () => {
        const value = strict('reception.intakeRules');
        for (const rule of Object.values(value.walkIn.criteria)) rule.required = false;
        await edit(value);
        const originalId = next();
        const sample = await createSampleFixture(prisma, { data: { id: originalId, originalId, assignedLab: labId, status: 'EXPECTED', fieldMetadata: '{"source":"KOBO"}' } });
        const rules = await request(app).get(`/api/reception/intake-rules?sampleId=${sample.id}&isWalkIn=true&profile=walkIn`).set('Authorization', reception);
        expect(rules.status).toBe(200); expect(rules.body.rules.profile).toBe('project');
        const response = await post('/api/reception/intake', { ...payload(originalId), checklist: { items: {} }, profile: 'walkIn', intakeRules: value.walkIn });
        expect(response.status).toBe(400); expect(response.body.code).toBe('INCOMPLETE_COMPLIANCE_CHECKLIST');
        expect((await prisma.sample.findUnique({ where: { id: sample.id } })).status).toBe('EXPECTED');
    });
    test('a new lab uses shipped intake rules immediately after normal lifecycle activation', async () => {
        const freshLabId = next();
        const admin = 'Bearer ' + await getAuthToken('SUPER_ADMIN', null);
        await prisma.user.updateMany({ where: { username: 'test_super_admin_global' }, data: { mustChangePassword: false } });
        const created = await post('/api/labs', {
            id: freshLabId, code: 'R381' + freshLabId.slice(-9), name: 'New rules laboratory',
            country: 'ESP', timezone: 'Europe/Madrid'
        }, admin);
        expect(created.status).toBe(200);
        expect(created.body.lab.isActive).toBe(false);
        const freshManager = 'Bearer ' + await getAuthToken('LAB_MANAGER', freshLabId, ['ESP']);
        await prisma.user.updateMany({ where: { labId: freshLabId }, data: { mustChangePassword: false } });
        const rules = () => request(app).get('/api/reception/intake-rules?isWalkIn=true').set('Authorization', freshManager);
        const setup = await rules();
        expect(setup.status).toBe(403);
        expect(setup.body).toEqual({ code: 'MISSING_LAB_SCOPE', message: 'Select an active receiving laboratory.' });

        const preview = await post('/api/labs/' + freshLabId + '/lifecycle-preview', { targetState: 'ACTIVE' }, admin);
        expect(preview.status).toBe(200);
        const activated = await post('/api/labs/' + freshLabId + '/lifecycle',
            { targetState: 'ACTIVE', reason: 'Enable new laboratory reception', reviewToken: preview.body.reviewToken }, admin);
        expect(activated.status).toBe(200);
        expect(await prisma.labPolicy.findUnique({ where: { labId: freshLabId } })).toBeNull();
        const ready = await rules();
        expect(ready.status).toBe(200);
        expect(ready.body.rules).toMatchObject({ profile: 'walkIn', version: 0, context: {
            landUse: expect.any(Object), samplingDate: expect.any(Object),
            samplingDepth: expect.any(Object), composite: expect.any(Object)
        } });
        const selected = await request(app).get('/api/reception/intake-rules')
            .query({ isWalkIn: true, assignedLab: freshLabId }).set('Authorization', admin);
        expect(selected.status).toBe(200);
        expect(selected.body.rules).toEqual(ready.body.rules);
    });

    test('reception can read applicable rules but cannot change the laboratory policy', async () => {
        const response = await request(app).get('/api/reception/intake-rules?isWalkIn=true').set('Authorization', reception);
        expect(response.status).toBe(200);
        expect(response.body.rules.profile).toBe('walkIn');
        expect(response.body.rules.context.samplingDepth).toMatchObject({ enabled: true, required: false });
        const denied = await request(app).patch(`/api/labs/${labId}/policies`).set('Authorization', reception)
            .send({ reason: 'Cannot edit', changes: [{ key: 'reception.intakeRules', value: strict('reception.intakeRules') }] });
        expect(denied.status).toBe(403);
    });
});
