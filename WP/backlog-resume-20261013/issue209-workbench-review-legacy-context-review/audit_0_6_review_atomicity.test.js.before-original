const { createExecutionResultFixture } = require('../helpers/workAttemptFixtures');
const { installWorkAttemptContract } = require('../../scripts/install_work_attempt_contract');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const workflow = require('../../workflowContract');
const qcGate = require('../../services/qcGateService');
const { setFixtureQcRequirement } = require('../helpers/qcPolicyFixture');
const { getAuthToken, ensureTestLab } = require('../setup');
const { createLegacyClosureDatabase, useLegacyRouteDatabase } = require('../helpers/legacyWorkflowDatabase');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const labId = 'LAB-AUDIT-06';
const id = prefix => `${prefix}-${crypto.randomUUID()}`;

describe('Audit 0.6: review state and atomic status/version compare-and-set', () => {
    let manager, technician;
    const legacyDatabases = [];
    beforeAll(async () => { await ensureTestLab(labId, 'TEST'); manager = await getAuthToken('LAB_MANAGER', labId); technician = await getAuthToken('LAB_TECHNICIAN', labId);
        await setFixtureQcRequirement(prisma, manager, labId); });
    afterEach(() => jest.restoreAllMocks());
    afterAll(async () => { for (const database of legacyDatabases) await database.close(); });
    const post = (path, body) => request(app).post(path).set('Authorization', `Bearer ${manager}`).send(body);
    async function fixture({ status = 'SUBMITTED', analysis = 'PH_H2O', sampleStatus = 'PROCESSING', batchStatus } = {}) {
        if (status === 'PENDING') {
            const database = await createLegacyClosureDatabase({ analysis, labId });
            legacyDatabases.push(database);
            useLegacyRouteDatabase(prisma, database.client);
            expect(installWorkAttemptContract({ dbPath: database.file, apply: true }).classification).toBe('COMPLETE');
            const submitter = jwt.decode(technician);
            await database.client.user.create({ data: { id: submitter.id, username: submitter.username,
                email: `${submitter.username}@example.test`, password: 'isolated-fixture', role: 'LAB_TECHNICIAN', labId } });
            const item = await prisma.workItem.findUnique({ where: { id: database.workItemId } });
            const result = await createExecutionResultFixture(prisma, { data: { id: id('R-06-LEGACY'), sampleId: database.sampleId, param: analysis,
                value: '6.2', numericValue: 6.2, isCurrent: true, isValid: true, flags: '[]' } });
            return { sampleId: database.sampleId, item, result, batch: null };
        }
        const sampleId = id('S-06');
        await createSampleFixture(prisma, { data: { id: sampleId, originalId: sampleId, labId: sampleId, assignedLab: labId,
            status: sampleStatus, dryingStatus: 'DONE', preparationStatus: 'DONE' } });
        const batch = batchStatus ? await prisma.batch.create({ data: { id: id('B-06'), analysis, labId, status: batchStatus, createdBy: 'test',
            qcResults: batchStatus === 'QC_FAIL' ? JSON.stringify({ blanks: [{ value: 2, maxAllowed: 1, status: 'FAIL' }], duplicates: [], controls: [] }) : null } }) : null;
        const item = await createWorkItemFixture(prisma, { data: { id: id('WI-06'), sampleId, analysis, assignedLab: labId,
            status, result: '6.2', history: '[]', batchId: batch?.id } });
        const result = await createExecutionResultFixture(prisma, { ...(['ACCEPTED','SUBMITTED'].includes(status) && { attemptStatus: status }),
            data: { id: id('R-06'), sampleId, param: analysis, value: '6.2',
            numericValue: 6.2, isCurrent: true, isValid: true, flags: '[]', batchId: batch?.id } });
        if (batch) await require('../helpers/normalizedQcFixture').normalizeLegacyQcFixture(prisma, batch.id);
        return { sampleId, item, result, batch };
    }
    async function snapshot(f) {
        return { item: await prisma.workItem.findUnique({ where: { id: f.item.id } }),
            sample: await prisma.sample.findUnique({ where: { id: f.sampleId } }),
            result: await prisma.result.findUnique({ where: { id: f.result.id } }),
            reviews: await prisma.reviewDecision.findMany({ where: { workItemId: f.item.id } }),
            audits: await prisma.auditLog.findMany({ where: { OR: [{ entityId: f.item.id }, { entityId: f.sampleId }] } }) };
    }
    async function packageFixture(states, { seedCachedEvidence = false } = {}) {
        const f = await fixture({ status: states[0] });
        const items = [f.item];
        for (const status of states.slice(1)) items.push(await createWorkItemFixture(prisma, { data: {
            id: id('WI-06-PACKAGE'), sampleId: f.sampleId, assignedLab: labId, analysis: 'EC', status, result: '5.4', history: '[]', duplicateOf: items.find(item => item.analysis === 'EC')?.id || null
        } }));
        // Pin6059085200: opt-in evidence for an existing canonical cached member.
        if (seedCachedEvidence) for (const item of items.slice(1).filter(row => row.duplicateOf == null && row.result != null)) {
            const attemptStatus = {
                SUBMITTED: 'SUBMITTED', ACCEPTED: 'ACCEPTED', COMPLETED: 'RECORDED', AWAITING_VERIFICATION: 'RECORDED'
            }[item.status];
            if (!attemptStatus) throw Error('Cached package evidence requires a pinned final work state.');
            await createExecutionResultFixture(prisma, { attemptStatus, data: { id: id('R-06-CACHED'), sampleId: f.sampleId, param: item.analysis,
                value: item.result, numericValue: Number(item.result), provenance: 'MEASURED', isCurrent: true } });
        }
        const submission = await prisma.submission.create({ data: { id: id('SUB-06'), sampleId: f.sampleId, assignedLab: labId,
            status: 'PENDING_REVIEW', type: 'PARTIAL', submittedBy: jwt.decode(technician).username, workItemCount: items.length,
            workItemIds: JSON.stringify(items.map(item => item.id)) } });
        await prisma.workItem.updateMany({ where: { id: { in: items.map(item => item.id) } }, data: { submissionId: submission.id } });
        return { ...f, items, submission };
    }
    test.each(['ACCEPTED', 'WAIVED', 'COMPLETED', 'IN_PROGRESS'])('RETURN and WAIVE cannot alter analytical %s work or its approved sample', async status => {
        const f = await fixture({ status, sampleStatus: 'APPROVED' }), before = await snapshot(f);
        for (const verdict of ['REANALYSIS_REQUIRED', 'WAIVED']) {
            const res = await post(`/api/work/${f.item.id}/review`, { status: verdict, reasonCode:'REVIEW_OUTLIER', reason: 'Review reason' });
            expect(res.status).toBe(409);
            expect(res.body.code).toBe(verdict === 'REANALYSIS_REQUIRED' ? 'AMENDMENT_WORKFLOW_REQUIRED' : 'ITEM_NOT_SUBMITTED');
            expect(await snapshot(f)).toEqual(before);
        }
    });
    test('two concurrent ACCEPTs create exactly one decision, one audit and one version increment', async () => {
        const f = await fixture();
        const responses = await Promise.all([1, 2].map(() => post(`/api/work/${f.item.id}/review`, { status: 'ACCEPTED' })));
        expect(responses.map(res => res.status).sort()).toEqual([200, 409]);
        expect(responses.find(res => res.status === 409).body.code).toBe('ITEM_NOT_SUBMITTED');
        expect(await prisma.reviewDecision.count({ where: { workItemId: f.item.id } })).toBe(1);
        expect(await prisma.auditLog.count({ where: { entityId: f.item.id, action: 'REVIEW' } })).toBe(1);
        const after = await prisma.workItem.findUnique({ where: { id: f.item.id } });
        expect(after).toMatchObject({ status: 'ACCEPTED', version: f.item.version + 1, reviewedBy: expect.any(String), reviewedAt: expect.any(Date) });
    });
    test('a changed version with the same submitted status loses the CAS with no review writes', async () => {
        const f = await fixture();
        const beforeAudits = await prisma.auditLog.findMany({ where: { entityId: f.item.id }, orderBy: { id: 'asc' } });
        const requireAcceptance = qcGate.requireAcceptance;
        jest.spyOn(qcGate, 'requireAcceptance').mockImplementationOnce(async (...args) => {
            await prisma.workItem.update({ where: { id: f.item.id }, data: { version: { increment: 1 } } });
            return requireAcceptance(...args);
        });
        const res = await post(`/api/work/${f.item.id}/review`, { status: 'ACCEPTED' });
        expect(res.status).toBe(409); expect(res.body.code).toBe('ITEM_NOT_SUBMITTED');
        expect(await prisma.reviewDecision.count({ where: { workItemId: f.item.id } })).toBe(0);
        expect(await prisma.auditLog.findMany({ where: { entityId: f.item.id }, orderBy: { id: 'asc' } })).toEqual(beforeAudits);
        expect((await prisma.workItem.findUnique({ where: { id: f.item.id } })).status).toBe('SUBMITTED');
    });
    test.each(['ACCEPTED', 'REANALYSIS_REQUIRED', 'WAIVED'])('bulk %s commits eligible rows and refuses already accepted rows', async status => {
        const valid = await fixture(), refused = await fixture({ status: 'ACCEPTED' }), before = await snapshot(refused);
        const response = await post('/api/work/review/bulk', { workItemIds: [valid.item.id, refused.item.id], status, reasonCode:'REVIEW_OUTLIER', reason: 'Bulk reason' });
        expect(response.status).toBe(200); expect(response.body.count).toBe(1);
        expect(response.body.results).toEqual([expect.objectContaining({ workItemId: valid.item.id, status: workflow.normalizeWorkItemState(status) })]);
        expect(response.body.errors).toEqual([{ workItemId: refused.item.id, code: 'ITEM_NOT_SUBMITTED' }]);
        expect(await snapshot(refused)).toEqual(before);
        expect(await prisma.reviewDecision.count({ where: { workItemId: valid.item.id } })).toBe(1);
        const after = await prisma.workItem.findUnique({ where: { id: valid.item.id } });
        expect(after.reviewedBy).toBeTruthy(); expect(after.reviewedAt).toBeInstanceOf(Date);
    });
    test('bulk with no eligible rows returns 409 and leaves every record unchanged', async () => {
        const f = await fixture({ status: 'ACCEPTED' }), before = await snapshot(f);
        const res = await post('/api/work/review/bulk', { workItemIds: [f.item.id], status: 'WAIVED', reason: 'Waive' });
        expect(res.status).toBe(409); expect(res.body.code).toBe('ITEM_NOT_SUBMITTED');
        expect(res.body.errors).toEqual([{ workItemId: f.item.id, code: 'ITEM_NOT_SUBMITTED' }]);
        expect(await snapshot(f)).toEqual(before);
    });
    test.each(['array', 'shorthand'])('%s submission review refuses accepted rows and derives status and note from committed rows', async form => {
        const f = await packageFixture(['SUBMITTED', 'ACCEPTED']);
        const acceptedBefore = await prisma.workItem.findUnique({ where: { id: f.items[1].id } });
        const body = form === 'shorthand' ? { status: 'ACCEPTED' } : {
            decisions: f.items.map(item => ({ workItemId: item.id, decision: 'ACCEPT' }))
        };
        const res = await post(`/api/submissions/${f.submission.id}/review`, body);
        expect(res.status).toBe(200); expect(res.body.results).toHaveLength(1);
        expect(res.body.errors).toEqual([{ workItemId: f.items[1].id, code: 'ITEM_NOT_SUBMITTED' }]);
        expect(await prisma.workItem.findUnique({ where: { id: f.items[1].id } })).toEqual(acceptedBefore);
        expect(await prisma.reviewDecision.count({ where: { submissionItemId: f.submission.id } })).toBe(1);
        const submission = await prisma.submission.findUnique({ where: { id: f.submission.id } });
        expect(submission.status).toBe('REVIEWED'); expect(submission.reviewNote).toContain(f.items[0].id);
        expect(submission.reviewNote).not.toContain(f.items[1].id);
        const summary = await prisma.auditLog.findFirst({ where: { entityId: f.submission.id, action: 'SUBMISSION_REVIEWED' } });
        expect(JSON.parse(summary.details)).toMatchObject({ committedCount: 1, refusedCount: 1 });
    });
    test('no successful submission rows leave the package and every item unchanged', async () => {
        const f = await packageFixture(['ACCEPTED']), before = await snapshot(f);
        const packageBefore = await prisma.submission.findUnique({ where: { id: f.submission.id } });
        const res = await post(`/api/submissions/${f.submission.id}/review`, { decision: 'WAIVE', reason: 'Waive' });
        expect(res.status).toBe(409); expect(res.body.code).toBe('ITEM_NOT_SUBMITTED');
        expect(await snapshot(f)).toEqual(before);
        expect(await prisma.submission.findUnique({ where: { id: f.submission.id } })).toEqual(packageBefore);
    });
    test.each(['bulk', 'submission'])('concurrent %s review has one successful row and exactly one decision', async route => {
        const f = await packageFixture(['SUBMITTED']);
        const beforeAudits = await prisma.auditLog.findMany({ where: { entityId: f.item.id }, orderBy: { id: 'asc' } });
        const body = route === 'bulk' ? { workItemIds: [f.item.id], status: 'ACCEPTED' }
            : { decisions: [{ workItemId: f.item.id, decision: 'ACCEPT' }] };
        const path = route === 'bulk' ? '/api/work/review/bulk' : `/api/submissions/${f.submission.id}/review`;
        const responses = await Promise.all([1, 2].map(() => post(path, body)));
        expect(responses.map(res => res.status).sort()).toEqual([200, 409]);
        const refused = responses.find(res => res.status === 409);
        if (refused.body.code === 'SUBMISSION_NOT_REVIEWABLE') expect(refused.body.status).toBe('REVIEWED');
        else expect(refused.body.errors).toEqual([{ workItemId: f.item.id, code: 'ITEM_NOT_SUBMITTED' }]);
        expect(await prisma.reviewDecision.count({ where: { workItemId: f.item.id } })).toBe(1);
        const afterAudits = await prisma.auditLog.findMany({ where: { entityId: f.item.id }, orderBy: { id: 'asc' } });
        expect(afterAudits).toHaveLength(beforeAudits.length + 1);
        expect(afterAudits.filter(row => !beforeAudits.some(previous => previous.id === row.id))).toEqual([
            expect.objectContaining({ action: route === 'submission' ? 'REVIEW_DECISION_MADE' : 'REVIEW' })]);
        for (const previous of beforeAudits) expect(afterAudits.find(row => row.id === previous.id)).toEqual(previous);
        expect(await prisma.auditLog.count({ where: { entityId: f.submission.id, action: 'SUBMISSION_REVIEWED' } })).toBe(1);
    });
    test('partial submission summary uses committed state and RETURN keeps the scientific value', async () => {
        const f = await packageFixture(['SUBMITTED', 'SUBMITTED', 'ACCEPTED']);
        const accepted = await prisma.workItem.findUnique({ where: { id: f.items[2].id } });
        const response = await post(`/api/submissions/${f.submission.id}/review`, { decisions: [
            { workItemId: f.item.id, decision: 'REJECT_REANALYSIS', reasonCode:'REVIEW_OUTLIER', reason: 'Repeat required' },
            { workItemId: f.items[2].id, decision: 'WAIVE', reason: 'Already decided' }
        ] });
        expect(response.status).toBe(200); expect(response.body.results).toHaveLength(1); expect(response.body.errors).toHaveLength(1);
        expect((await prisma.submission.findUnique({ where: { id: f.submission.id } })).status).toBe('PARTIALLY_REVIEWED');
        expect(await prisma.workItem.findUnique({ where: { id: f.items[2].id } })).toEqual(accepted);
        const result = await prisma.result.findUnique({ where: { id: f.result.id } });
        expect(result.numericValue).toBe(6.2); expect(result.value).toBe('6.2');
        expect(JSON.parse(result.flags)).toContain('REVIEW_RETURNED');
    });
    test('a submitted closure WAIVE follows the shared contract and leaves sample custody unchanged', async () => {
        const f = await fixture({ analysis: 'ARCH', sampleStatus: 'APPROVED' });
        const sample = await prisma.sample.findUnique({ where: { id: f.sampleId } });
        const response = await post(`/api/work/${f.item.id}/review`, { status: 'WAIVED', reason: 'Custody closure cancelled' });
        expect(response.status).toBe(200); expect(response.body.item.status).toBe('WAIVED');
        expect(await prisma.sample.findUnique({ where: { id: f.sampleId } })).toEqual(sample);
    });
    test.each([
        [{ decision: 'INVALID' }, 'INVALID_REVIEW_DECISION'],
        [{ decision: 'WAIVE' }, 'REVIEW_REASON_REQUIRED'],
        [{ decision: 'REJECT_REANALYSIS', reason: ' ' }, 'REVIEW_REASON_REQUIRED'],
        [{ decision: 'WAIVE', reason: 123 }, 'INVALID_REVIEW_REASON']
    ])('invalid second decision refuses the whole request before writes (%s)', async (bad, code) => {
        const f = await packageFixture(['SUBMITTED', 'SUBMITTED']), before = await snapshot(f);
        const res = await post(`/api/submissions/${f.submission.id}/review`, { decisions: [
            { workItemId: f.items[0].id, decision: 'ACCEPT' }, { workItemId: f.items[1].id, ...bad }
        ] });
        expect(res.status).toBe(400); expect(res.body.code).toBe(code); expect(await snapshot(f)).toEqual(before);
        expect(await prisma.reviewDecision.count({ where: { submissionItemId: f.submission.id } })).toBe(0);
    });
    test('QC refusal remains request-wide and prevents an otherwise eligible bulk row', async () => {
        const good = await fixture(), failed = await fixture({ batchStatus: 'QC_FAIL' });
        const goodBefore = await snapshot(good), failedBefore = await snapshot(failed);
        const res = await post('/api/work/review/bulk', { workItemIds: [good.item.id, failed.item.id], status: 'ACCEPTED' });
        expect(res.status).toBe(409); expect(res.body.code).toBe('QC_GATE_FAILED');
        expect(await snapshot(good)).toEqual(goodBefore); expect(await snapshot(failed)).toEqual(failedBefore);
    });
    test.each(workflow.CLOSURE_TASK_ANALYSES)('%s can be accepted once from COMPLETED and a second decision cannot change custody or audit', async analysis => {
        const f = await fixture({ analysis, status: 'COMPLETED', sampleStatus: 'APPROVED' });
        expect((await post(`/api/work/${f.item.id}/review`, { status: 'ACCEPTED' })).status).toBe(200);
        expect((await prisma.sample.findUnique({ where: { id: f.sampleId } })).status).toBe(workflow.CLOSURE_TASK_SAMPLE_STATES[analysis]);
        const before = await snapshot(f);
        const res = await post(`/api/work/${f.item.id}/review`, { status: 'ACCEPTED' });
        expect(res.status).toBe(409); expect(res.body.code).toBe('ITEM_NOT_SUBMITTED'); expect(await snapshot(f)).toEqual(before);
    });
    test('the shared SUBMITTED -> WAIVED contract keeps the technician status endpoint sealed', async () => {
        const f = await fixture(), before = await snapshot(f);
        expect(workflow.isValidWorkItemTransition('SUBMITTED', 'WAIVED')).toBe(true);
        const res = await request(app).put(`/api/work/${f.item.id}/status`).set('Authorization', `Bearer ${technician}`).send({ status: 'WAIVED' });
        expect(res.status).toBe(403); expect(await snapshot(f)).toEqual(before);
    });
    test('legacy PENDING closure accepts once and terminal decisions cannot change any records', async () => {
        const f = await fixture({ analysis: 'ARCHIVING', status: 'PENDING', sampleStatus: 'APPROVED' });
        expect((await post(`/api/work/${f.item.id}/review`, { status: 'ACCEPTED' })).status).toBe(200);
        expect((await prisma.sample.findUnique({ where: { id: f.sampleId } })).status).toBe('ARCHIVED');
        const before = await snapshot(f);
        for (const status of ['ACCEPTED', 'REANALYSIS_REQUIRED', 'WAIVED']) {
            const response = await post(`/api/work/${f.item.id}/review`, { status, reasonCode:'REVIEW_OUTLIER', reason: 'Review again' });
            expect(response.status).toBe(409); expect(response.body.code).toBe('ITEM_NOT_SUBMITTED');
            expect(await snapshot(f)).toEqual(before);
        }
    });
    test('submission closure commits custody after the CAS and refuses a second package review', async () => {
        const f = await fixture({ analysis: 'DISPOSAL', status: 'PENDING', sampleStatus: 'APPROVED' });
        const submission = await prisma.submission.create({ data: { id: id('SUB-06-CLOSURE'), sampleId: f.sampleId,
            assignedLab: labId, status: 'PENDING_REVIEW', type: 'PARTIAL', submittedBy: jwt.decode(technician).username,
            workItemCount: 1, workItemIds: JSON.stringify([f.item.id]) } });
        await prisma.workItem.update({ where: { id: f.item.id }, data: { submissionId: submission.id } });
        expect((await post(`/api/submissions/${submission.id}/review`, { decision: 'ACCEPT' })).status).toBe(200);
        expect((await prisma.sample.findUnique({ where: { id: f.sampleId } })).status).toBe('DISPOSED');
        const before = await snapshot(f);
        const response = await post(`/api/submissions/${submission.id}/review`, { decision: 'ACCEPT' });
        expect(response.status).toBe(409); expect(response.body.code).toBe('SUBMISSION_NOT_REVIEWABLE');
        expect(await snapshot(f)).toEqual(before);
    });
    test('a moved item is a per-row refusal while current members commit and determine the old package status', async () => {
        const f = await packageFixture(['SUBMITTED', 'SUBMITTED'], { seedCachedEvidence: true });
        const newer = await prisma.submission.create({ data: { id: id('SUB-06-NEWER'), sampleId: f.sampleId,
            assignedLab: labId, status: 'PENDING_REVIEW', type: 'PARTIAL', submittedBy: jwt.decode(technician).username,
            workItemCount: 1, workItemIds: JSON.stringify([f.item.id]) } });
        await prisma.workItem.update({ where: { id: f.item.id }, data: { submissionId: newer.id } });
        const before = await snapshot(f);
        const response = await post(`/api/submissions/${f.submission.id}/review`, { decisions: f.items.map(item => ({ workItemId: item.id, decision: 'ACCEPT' })) });
        expect(response.status).toBe(200);
        expect(response.body.errors).toEqual([{ workItemId: f.item.id, code: 'ITEM_NOT_IN_SUBMISSION' }]);
        expect(response.body.results).toEqual([{ workItemId: f.items[1].id, status: 'ACCEPTED', decision: 'ACCEPT' }]);
        expect(await snapshot(f)).toEqual(before);
        expect((await prisma.submission.findUnique({ where: { id: f.submission.id } })).status).toBe('REVIEWED');
        expect(await prisma.submission.findUnique({ where: { id: newer.id } })).toEqual(newer);
    });
    test('a failed decision insert rolls back the item CAS and audit together', async () => {
        const f = await fixture(), before = await snapshot(f), original = prisma.$transaction.bind(prisma);
        jest.spyOn(prisma, '$transaction').mockImplementation(callback => original(async tx => {
            jest.spyOn(tx.reviewDecision, 'create').mockRejectedValueOnce(new Error('Injected decision storage failure'));
            return callback(tx);
        }));
        const res = await post(`/api/work/${f.item.id}/review`, { status: 'ACCEPTED' });
        expect(res.status).toBe(500); expect(await snapshot(f)).toEqual(before);
    });
});
