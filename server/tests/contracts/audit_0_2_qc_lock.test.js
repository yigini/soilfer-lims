const crypto = require('crypto');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');
const { canPublish } = require('../../services/workEligibility');
const qcController = require('../../controllers/qcController');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const { createLegacyClosureDatabase, useLegacyRouteDatabase } = require('../helpers/legacyWorkflowDatabase');

const labId = 'LAB-AUDIT-02';
const readings = {
    blanks: [{ value: 0.01 }],
    controls: [{ expected: 7, measured: 7 }],
    duplicates: [{ value1: 7, value2: 7.01 }]
};
const id = prefix => `${prefix}-${crypto.randomUUID()}`;
const wire = value => JSON.parse(JSON.stringify(value));

describe('Audit 0.2: batch QC lock and durable evidence', () => {
    let tokens;
    const legacyDatabases = [];
    afterEach(() => jest.restoreAllMocks());
    afterAll(async () => { for (const database of legacyDatabases) await database.close(); });
    beforeAll(async () => {
        tokens = Object.fromEntries(await Promise.all(['LAB_TECHNICIAN', 'LAB_MANAGER', 'SUPER_ADMIN']
            .map(async role => [role, await getAuthToken(role, labId)])));
    });
    const call = (method, path, body, role = 'LAB_TECHNICIAN') => request(app)[method](path)
        .set('Authorization', `Bearer ${tokens[role]}`).send(body);
    async function batch(status = 'OPEN', disposition = null) {
        const res = await call('post', '/api/qc/batches', { id: id('AUDIT-02'), analysis: 'PH_H2O', profile: 'RACK_40' });
        expect(res.status).toBe(201);
        if (status !== 'OPEN' || disposition) await prisma.batch.update({ where: { id: res.body.id }, data: {
            status, disposition: disposition ? JSON.stringify(disposition) : null
        } });
        return res.body.id;
    }
    async function evidence(batchId) {
        return wire({
            batch: await prisma.batch.findUnique({ where: { id: batchId } }),
            rows: await prisma.batchQcResult.findMany({ where: { batchId }, orderBy: { id: 'asc' } }),
            audit: await prisma.auditLog.findMany({ where: { entity: 'BATCH', entityId: batchId }, orderBy: { timestamp: 'asc' } })
        });
    }
    async function pass(batchId) {
        const res = await call('post', `/api/qc/batches/${batchId}/evaluate`, readings);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('QC_PASS');
    }
    async function reviewFixture(status, disposition) {
        let batchId;
        if (status === 'UNKNOWN') {
            batchId = id('BATCH-UNKNOWN-LEGACY');
            const database = await createLegacyClosureDatabase({ analysis: 'ARCHIVING', labId,
                batches: [{ id: batchId, labId, analysis: 'PH_H2O', status, createdBy: 'system:fixture', createdAt: Date.now() }] });
            legacyDatabases.push(database);
            useLegacyRouteDatabase(prisma, database.client);
            for (const role of ['LAB_TECHNICIAN', 'LAB_MANAGER']) {
                const actor = jwt.decode(tokens[role]);
                await database.client.user.create({ data: { id: actor.id, username: actor.username, email: `${actor.username}@example.test`,
                    password: 'isolated-fixture', role, labId } });
            }
        } else batchId = await batch(status, disposition);
        const sampleId = id('SMP');
        const workItemId = id('WI');
        const submissionId = id('SUB');
        await createSampleFixture(prisma, { data: { id: sampleId, originalId: sampleId, labId: sampleId, assignedLab: labId,
            status: 'PROCESSING', dryingStatus: 'DONE', preparationStatus: 'DONE' } });
        await prisma.submission.create({ data: {
            id: submissionId, sampleId, assignedLab: labId, type: 'PARTIAL', status: 'PENDING_REVIEW',
            submittedBy: jwt.decode(tokens.LAB_TECHNICIAN).username,
            workItemIds: JSON.stringify([workItemId]), workItemCount: 1
        } });
        await createWorkItemFixture(prisma, { data: {
            id: workItemId, sampleId, batchId, submissionId, analysis: 'PH_H2O',
            status: 'SUBMITTED', result: '7', assignedLab: labId
        } });
        return { batchId, workItemId, submissionId };
    }
    const review = (path, fixture) => {
        if (path === 'individual') return call('post', `/api/work/${fixture.workItemId}/review`, { status: 'ACCEPTED' }, 'LAB_MANAGER');
        if (path === 'bulk') return call('post', '/api/work/review/bulk', { workItemIds: [fixture.workItemId], status: 'ACCEPTED' }, 'LAB_MANAGER');
        return call('post', `/api/submissions/${fixture.submissionId}/review`, {
            decisions: [{ workItemId: fixture.workItemId, decision: 'ACCEPT' }]
        }, 'LAB_MANAGER');
    };

    test.each(['LAB_TECHNICIAN', 'LAB_MANAGER', 'SUPER_ADMIN'].flatMap(role =>
        ['OPEN', 'RUNNING', 'QC_PASS', 'CLOSED'].map(status => [role, status])))('%s cannot move QC_FAIL to %s', async (role, status) => {
        const batchId = await batch('QC_FAIL');
        const before = await evidence(batchId);
        const res = await call('put', `/api/qc/batches/${batchId}`, { status }, role);
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('QC_BATCH_LOCKED');
        expect(await evidence(batchId)).toEqual(before);
    });

    test.each([
        ['QC_FAIL', null, 409], ['QC_FAIL', { decision: 'PROCEED_WITH_WARNING' }, 409],
        ['OPEN', { decision: 'REANALYZE_BATCH' }, 409], ['CLOSED', null, 400]
    ])('evaluate rejects %s with disposition %j', async (status, disposition, expectedStatus) => {
        const batchId = await batch(status, disposition);
        const before = await evidence(batchId);
        const res = await call('post', `/api/qc/batches/${batchId}/evaluate`, readings);
        expect(res.status).toBe(expectedStatus);
        expect(res.body.code).toBe('QC_BATCH_LOCKED');
        expect(await evidence(batchId)).toEqual(before);
        if (status === 'QC_FAIL') {
            const update = await call('put', `/api/qc/batches/${batchId}`, readings);
            expect(update.status).toBe(409);
            expect(await evidence(batchId)).toEqual(before);
        }
    });

    test.each(['RUNNING', 'QC_PASS', 'QC_FAIL', 'CLOSED'].flatMap(status =>
        ['post', 'delete'].map(method => [status, method])))('%s membership cannot change via %s', async (status, method) => {
        const batchId = await batch(status);
        const before = await evidence(batchId);
        const res = await call(method, `/api/qc/batches/${batchId}/items`, { workItemIds: ['unlinked-item'] });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('QC_BATCH_MEMBERSHIP_LOCKED');
        expect(await evidence(batchId)).toEqual(before);
    });

    test('an operational status cannot hide new failing QC', async () => {
        const batchId = await batch();
        const res = await call('put', `/api/qc/batches/${batchId}`, { ...readings, blanks: [{ value: 100 }], status: 'RUNNING' });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('QC_FAIL');
        expect((await evidence(batchId)).batch.status).toBe('QC_FAIL');
    });

    test('manager reopen preserves exactly one full snapshot in history and AuditLog', async () => {
        const batchId = await batch();
        await pass(batchId);
        const before = await evidence(batchId);
        const res = await call('put', `/api/qc/batches/${batchId}`, { status: 'RUNNING', reason: 'New run after instrument service' }, 'LAB_MANAGER');
        expect(res.status).toBe(200);
        const after = await evidence(batchId);
        expect(after.batch.status).toBe('OPEN');
        expect(after.batch.qcResults).toBeNull();
        expect(after.rows).toEqual([]);
        const history = JSON.parse(after.batch.history);
        const snapshots = history.filter(event => event.action === 'QC_EVIDENCE_SNAPSHOT');
        const oldCount = JSON.parse(before.batch.history).filter(event => event.action === 'QC_EVIDENCE_SNAPSHOT').length;
        expect(snapshots).toHaveLength(oldCount + 1);
        const event = snapshots.at(-1);
        expect(event.snapshot).toEqual({
            qcResults: JSON.parse(before.batch.qcResults), qcItems: before.rows,
            status: 'QC_PASS', disposition: null, workItemIds: JSON.parse(before.batch.workItemIds),
            actor: { id: jwt.decode(tokens.LAB_MANAGER).id, username: jwt.decode(tokens.LAB_MANAGER).username },
            timestamp: expect.any(String), reason: 'New run after instrument service'
        });
        expect(JSON.parse(after.audit.at(-1).details)).toEqual(event);
        expect(after.audit).toHaveLength(before.audit.length + 1);
        expect(canPublish({ status: 'APPROVED' }, null, { role: 'LAB_MANAGER' }, { qcBatches: [after.batch] }).allowed).toBe(false);
    });

    test.each([['LAB_MANAGER', {}, 400, 'REASON_REQUIRED'], ['LAB_TECHNICIAN', { reason: 'Repeat run' }, 403, 'QC_REOPEN_PERMISSION_REQUIRED']])(
        '%s cannot reopen without required authority and reason', async (role, extra, status, code) => {
            const batchId = await batch();
            await pass(batchId);
            const before = await evidence(batchId);
            const res = await call('put', `/api/qc/batches/${batchId}`, { status: 'OPEN', ...extra }, role);
            expect(res.status).toBe(status);
            expect(res.body.code).toBe(code);
            expect(await evidence(batchId)).toEqual(before);
        });

    test('two reopen cycles preserve increasing sequence numbers and all prior events', async () => {
        const batchId = await batch();
        const reopenEvents = [];
        for (let cycle = 0; cycle < 2; cycle++) {
            await pass(batchId);
            const before = await evidence(batchId);
            const res = await call('put', `/api/qc/batches/${batchId}`, { status: 'OPEN', reason: `Cycle ${cycle + 1}` }, 'LAB_MANAGER');
            expect(res.status).toBe(200);
            const after = await evidence(batchId);
            const events = JSON.parse(after.batch.history).filter(event => event.action === 'QC_EVIDENCE_SNAPSHOT');
            reopenEvents.push(events.at(-1));
            expect(events.at(-1).snapshot.qcItems).toEqual(before.rows);
            expect(after.audit.map(row => JSON.parse(row.details))).toEqual(events);
        }
        expect(reopenEvents[1].seq).toBeGreaterThan(reopenEvents[0].seq);
        expect(JSON.parse((await evidence(batchId)).batch.history)).toEqual(expect.arrayContaining(reopenEvents));
    });

    test.each(['BatchQcResult', 'AuditLog'])('%s write failure rolls back rows, batch and both snapshot copies', async table => {
        const batchId = await batch();
        await pass(batchId);
        // Put the fixture in an editable state while retaining its old evidence.
        await prisma.batch.update({ where: { id: batchId }, data: { status: 'OPEN' } });
        const before = await evidence(batchId);
        const trigger = `fail_audit_02_${table}`;
        const key = table === 'AuditLog' ? 'entityId' : 'batchId';
        await prisma.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE INSERT ON "${table}" WHEN NEW."${key}" = '${batchId}' BEGIN SELECT RAISE(ABORT, 'simulated evidence write failure'); END`);
        try {
            const res = await call('post', `/api/qc/batches/${batchId}/evaluate`, readings);
            expect(res.status).toBe(500);
            expect(await evidence(batchId)).toEqual(before);
        } finally {
            await prisma.$executeRawUnsafe(`DROP TRIGGER "${trigger}"`);
        }
    });

    test.each(['individual', 'bulk', 'submission'].flatMap(path =>
        ['QC_FAIL', 'OPEN', 'RUNNING', 'UNKNOWN'].map(status => [path, status])))('%s review blocks %s batch through the shared gate', async (path, status) => {
        const fixture = await reviewFixture(status);
        const res = await review(path, fixture);
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('QC_FAIL_BLOCKER');
        expect((await prisma.workItem.findUnique({ where: { id: fixture.workItemId } })).status).toBe('SUBMITTED');
        expect(await prisma.reviewDecision.count({ where: { workItemId: fixture.workItemId } })).toBe(0);
    });

    test.each(['individual', 'bulk', 'submission'])('%s review accepts PROCEED_WITH_WARNING but keeps failed evidence locked', async path => {
        const fixture = await reviewFixture('QC_FAIL', { decision: 'PROCEED_WITH_WARNING', reason: 'Manager accepted documented warning' });
        const res = await review(path, fixture);
        expect(res.status).toBe(200);
        expect((await prisma.workItem.findUnique({ where: { id: fixture.workItemId } })).status).toBe('ACCEPTED');
        const evaluation = await call('post', `/api/qc/batches/${fixture.batchId}/evaluate`, readings);
        expect(evaluation.status).toBe(409);
    });

    test.each([
        ['QC_FAIL', null, false], ['QC_FAIL', { decision: 'PROCEED_WITH_WARNING' }, true],
        ['QC_FAIL', { decision: 'REANALYZE_BATCH' }, false], ['QC_FAIL', '{invalid', false],
        ['OPEN', null, false], ['RUNNING', null, false], ['ERROR', null, false],
        ['UNKNOWN', null, false], ['QC_PASS', null, true], ['CLOSED', null, true]
    ])('publication uses the shared gate for %s / %j', (status, disposition, allowed) => {
        expect(canPublish({ status: 'APPROVED' }, null, { role: 'LAB_MANAGER' }, { qcBatches: [{ id: 'qc', status, disposition }] }).allowed).toBe(allowed);
    });

    test('batch lookup error fails closed', async () => {
        const lookup = jest.spyOn(prisma.workItem, 'findUnique').mockRejectedValueOnce(new Error('database unavailable'));
        try {
            expect(await qcController.checkItemBatchStatus('unavailable')).toMatchObject({ allowed: false, status: 'ERROR' });
        } finally { lookup.mockRestore(); }
    });
});
