const { createResultFixture } = require('../../services/resultWriteService');
const { randomUUID } = require('node:crypto');
const prisma = require('../../prisma');
const samples = require('../../services/sampleStateService');
const work = require('../../services/workItemStateService');
const drafts = require('../../services/draftService');
const evidence = require('../../services/resultEvidenceService');
const policies = require('../../services/policyService');
const workbench = require('../../controllers/workbenchController');
const submissions = require('../../controllers/submissionController');
const operations = require('../../services/operationalConfirmationService');
const workController = require('../../controllers/workItemController');
const sampleController = require('../../controllers/sampleController');
const { deriveSubmissionLifecycle } = require('../../services/submissionLifecycleService');
const workflow = require('../../workflowContract');
const { commitReview } = require('../../services/reviewCommitService');
const { requestClosure } = require('../../services/closureTaskService');
const labId = randomUUID();
const technician = { username: `state-tech-${randomUUID()}`, role: 'LAB_TECHNICIAN', labId };
const manager = { username: `state-manager-${randomUUID()}`, role: 'LAB_MANAGER', labId };

beforeAll(async () => {
    await prisma.lab.create({ data: { id: labId, code: labId, name: 'Workbench state laboratory', country: 'TEST' } });
    for (const actor of [technician, manager]) await prisma.user.create({ data: { id: actor.username, username: actor.username,
        email: `${actor.username}@example.test`, role: actor.role, labId, password: 'isolated-fixture' } });
    await prisma.analysis.upsert({ where: { code: 'PREPARATION' }, update: {}, create: { code: 'PREPARATION', name: 'Preparation' } });
});
afterEach(() => jest.restoreAllMocks());

test('final approval returns the preparation-reversion 409 and preserves every row', async () => {
    const row = await fixture('SUBMITTED_FULL', 'ACCEPTED');
    await prisma.sample.update({ where: { id: row.sample.id }, data: { receptionDate: new Date() } });
    const result = await createResultFixture(prisma, { data: { id: randomUUID(), sampleId: row.sample.id, param: row.item.analysis,
        value: '6.25', numericValue: 6.25, unit: 'pH_units', isCurrent: true } });
    await prisma.resultEvidenceEvent.create({ data: { id: randomUUID(), sampleId: row.sample.id, resultId: result.id,
        gate: 'PREPARATION', eventType: 'PREP_REVERTED', reason: 'Preparation recheck required', actor: manager.username } });
    const before = await snapshot([row.sample.id]);
    expect(await call(sampleController.approveSample, {}, { id: row.sample.id }, manager))
        .toMatchObject({ statusCode: 409, body: { code: 'PREP_REVERTED_RESULTS', details: { resultIds: [result.id] } } });
    expect(await snapshot([row.sample.id])).toEqual(before);
});

test('undo intake preserves every task when the transition is refused by a database guard', async () => {
    const row = await fixture('ACCEPTED', 'NOT_ASSIGNED');
    // This probes the later Sample guard, so start with truly unrecorded work.
    await prisma.$transaction(tx => require('../../services/resultWriteService').writeFixtureCache(tx, row.item, null, 'system:fixture'));
    await work.createWorkItem({ id: randomUUID(), sampleId: row.sample.id, analysis: 'PREPARATION', assignedLab: labId }, manager);
    const before = await snapshot([row.sample.id]), transaction = prisma.$transaction.bind(prisma);
    jest.spyOn(prisma, '$transaction').mockImplementationOnce(execute => transaction(tx => execute({ ...tx,
        sample: { ...tx.sample, updateMany: async () => { throw new Error('INVALID_SAMPLE_STATUS'); } }
    })));
    expect(await call(sampleController.undoIntake, {}, { id: row.sample.id }, manager))
        .toMatchObject({ statusCode: 409, body: { code: 'INVALID_SAMPLE_STATUS' } });
    expect(await snapshot([row.sample.id])).toEqual(before);
});

test('undo intake rolls back task deletion and the transition when its final audit fails', async () => {
    const row = await fixture('ACCEPTED', 'NOT_ASSIGNED');
    await prisma.$transaction(tx => require('../../services/resultWriteService').writeFixtureCache(tx, row.item, null, 'system:fixture'));
    const before = await snapshot([row.sample.id]);
    failAudit('UNDO_INTAKE');
    expect((await call(sampleController.undoIntake, {}, { id: row.sample.id }, manager)).statusCode).toBe(500);
    expect(await snapshot([row.sample.id])).toEqual(before);
});

test('fixture cleanup refuses a database outside the owned test directory before deletion', async () => {
    const { cleanupWorkflowFixtures } = require('../helpers/workflowFixtures');
    const delegated = { $queryRawUnsafe: async () => [{ name: 'main', file: require.resolve('../../package.json') }],
        sample: { deleteMany: jest.fn() }, workItem: { deleteMany: jest.fn() } };
    await expect(cleanupWorkflowFixtures(delegated, 'sample', ['owned-test-id'])).rejects.toThrow('non-test-owned');
    expect(delegated.sample.deleteMany).not.toHaveBeenCalled();
    expect(delegated.workItem.deleteMany).not.toHaveBeenCalled();
});

test.each(['removePreAnalyticSample', 'removeUnstartedWorkItems'])('%s refuses a full client outside a transaction', async name => {
    const removal = name === 'removePreAnalyticSample' ? samples[name] : work[name];
    await expect(removal(prisma, name === 'removePreAnalyticSample' ? ['owned-test-id'] : {}, { actor: manager, reason: 'Refusal proof' }))
        .rejects.toMatchObject({ statusCode: 400, code: 'WORKFLOW_TRANSACTION_REQUIRED' });
});

test.each(['COMPLETED', 'IN_PROGRESS', 'ASSIGNED'])('undo intake preserves %s work and its recorded evidence on refusal', async status => {
    const row = await fixture('ACCEPTED', status), before = await snapshot([row.sample.id]);
    expect(await call(sampleController.undoIntake, {}, { id: row.sample.id }, manager))
        .toMatchObject({ statusCode: 409, body: { code: 'INTAKE_UNDO_HAS_WORK', details: { blockingItemIds: [row.item.id] } } });
    expect(await snapshot([row.sample.id])).toEqual(before);
});

async function fixture(sampleStatus = 'PROCESSING', itemStatus = 'COMPLETED', analysis = 'PH') {
    const sample = await samples.createSample({ id: randomUUID(), originalId: randomUUID(), assignedLab: labId, status: sampleStatus,
        dryingStatus: 'DONE', preparationStatus: 'DONE' }, 'system:fixture', { context: 'fixture' });
    const item = await work.createWorkItem({ id: randomUUID(), sampleId: sample.id, assignedLab: labId, labId,
        analysis, status: itemStatus, assignedTo: technician.username, result: '6.25', version: 1, history: '[{"note":"retained"}]' },
    'system:fixture', { context: 'fixture' });
    return { sample, item };
}
async function snapshot(sampleIds) {
    const sampleWhere = { sampleId: { in: sampleIds } };
    return {
        samples: await prisma.sample.findMany({ where: { id: { in: sampleIds } }, orderBy: { id: 'asc' } }),
        items: await prisma.workItem.findMany({ where: sampleWhere, orderBy: { id: 'asc' } }),
        drafts: await prisma.workItemDraft.findMany({ where: sampleWhere, orderBy: { id: 'asc' } }),
        results: await prisma.result.findMany({ where: sampleWhere, orderBy: { id: 'asc' } }),
        submissions: await prisma.submission.findMany({ where: sampleWhere, orderBy: { id: 'asc' } }),
        audits: await prisma.auditLog.findMany({ where: sampleWhere, orderBy: { id: 'asc' } }),
        events: await prisma.resultEvidenceEvent.findMany({ where: sampleWhere, orderBy: { id: 'asc' } }),
        decisions: await prisma.reviewDecision.findMany({ where: sampleWhere, orderBy: { id: 'asc' } })
    };
}
async function call(handler, body, params = {}, user = technician) {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
    await handler({ user, body, params }, res);
    return res;
}
function failAudit(action, aggregateOnly = false) {
    const transaction = prisma.$transaction.bind(prisma);
    jest.spyOn(prisma, '$transaction').mockImplementation((execute, options) => transaction(tx => execute(new Proxy(tx, {
        get(target, key) {
            if (key === 'auditLog') return new Proxy(target.auditLog, { get(delegate, operation) {
                if (operation === 'create') return args => {
                    if ((!action || args.data.action === action) && (!aggregateOnly || args.data.details?.startsWith('Cleared '))) {
                        if (aggregateOnly) expect(args.data.entityId).toBe('PH');
                        throw new Error('Injected workflow audit failure');
                    }
                    return delegate.create(args);
                };
                return delegate[operation];
            } });
            return target[key];
        }
    })), options));
}

test('a failed draft-start audit rolls back the draft, status and history together', async () => {
    const { sample, item } = await fixture('PROCESSING', 'ASSIGNED');
    const before = await snapshot([sample.id]);
    failAudit('DRAFT_STARTED');
    await expect(drafts.saveDraft(technician, { workItemId: item.id, value: '6.1' })).rejects.toThrow('Injected workflow audit failure');
    expect(await snapshot([sample.id])).toEqual(before);
});
test('a failed discard audit restores the original draft and in-progress work item', async () => {
    const { sample, item } = await fixture('PROCESSING', 'ASSIGNED');
    await drafts.saveDraft(technician, { workItemId: item.id, value: '6.1' });
    const before = await snapshot([sample.id]);
    failAudit('DRAFT_DISCARDED');
    await expect(drafts.discardDraft(technician, item.id)).rejects.toThrow('Injected workflow audit failure');
    expect(await snapshot([sample.id])).toEqual(before);
    jest.restoreAllMocks();
    await drafts.discardDraft(technician, item.id);
});
test('bulk draft clear rolls back every discard when its final audit fails', async () => {
    const first = await fixture('PROCESSING', 'ASSIGNED'), second = await fixture('PROCESSING', 'ASSIGNED');
    for (const row of [first, second]) await drafts.saveDraft(technician, { workItemId: row.item.id, value: '6.1' });
    const ids = [first.sample.id, second.sample.id], before = await snapshot(ids);
    failAudit('DRAFT_DISCARDED', true);
    expect((await call(workbench.clearDrafts, {}, { analysis: 'PH' })).statusCode).toBe(500);
    expect(await snapshot(ids)).toEqual(before);
});
test('workbench operational completion respects lab verification policy and reports the actual state', async () => {
    await prisma.$transaction(tx => policies.mutateInTransaction(manager, labId, {
        changes: [{ key: 'gate.verificationRequired', analysisCode: 'PREPARATION', value: true }], reason: 'Preparation verification SOP'
    }, tx));
    const { sample, item } = await fixture('ACCEPTED', 'ASSIGNED', 'PREPARATION');
    await samples.transitionSample(sample.id, 'ACCEPTED', manager, null, { preparationStatus: 'PENDING' });
    const response = await call(workbench.batchSave, { draft: false, entries: [{ workItemId: item.id, version: item.version,
        checks: [true, true, true], verificationRequired: false }] });
    expect(response).toMatchObject({ statusCode: 200, body: { saved: 1, results: [{ status: 'awaiting_verification', newVersion: 2 }] } });
    expect(await prisma.workItem.findUnique({ where: { id: item.id } })).toMatchObject({ status: 'AWAITING_VERIFICATION' });
    expect(await prisma.sample.findUnique({ where: { id: sample.id } })).toMatchObject({ status: 'ACCEPTED', preparationStatus: 'PENDING' });
    expect(await prisma.result.count({ where: { sampleId: sample.id } })).toBe(0);
    await operations.verifyOperation({ actor: manager, workItemId: item.id, decision: 'ACCEPT' });
    expect(await prisma.sample.findUnique({ where: { id: sample.id } })).toMatchObject({ status: 'PROCESSING', preparationStatus: 'DONE' });
});

const paths = [
    ['legacy', submissions.createSubmission, row => ({ sampleId: row.sample.id, workItemIds: [row.item.id], type: 'PARTIAL' })],
    ['workbench', workbench.commitSubmissions, row => ({ sampleIds: [row.sample.id], workItemIds: [row.item.id] })]
];
test.each(paths)('%s submission refuses current preparation-revert evidence before writes', async (_, handler, body) => {
    const row = await fixture();
    await createResultFixture(prisma, { data: { id: randomUUID(), sampleId: row.sample.id, param: 'PH', value: '6.25', isCurrent: true } });
    await prisma.$transaction(tx => evidence.recordPreparationRevert(tx, row.sample, 'PREPARATION', 'Reprepare specimen', manager));
    const before = await snapshot([row.sample.id]);
    expect(await call(handler, body(row))).toMatchObject({ statusCode: 409, body: { code: 'PREP_REVERTED_RESULTS' } });
    expect(await snapshot([row.sample.id])).toEqual(before);
});
test.each(paths.flatMap(([name, handler, body]) => ['APPROVED', 'ARCHIVED', 'DISPOSED'].map(status => [name, status, handler, body])))
    ('%s submission refuses a final %s sample without an amendment', async (_, status, handler, body) => {
        const row = await fixture(status), before = await snapshot([row.sample.id]);
        expect(await call(handler, body(row))).toMatchObject({ statusCode: 409, body: { code: 'AMENDMENT_WORKFLOW_REQUIRED' } });
        expect(await snapshot([row.sample.id])).toEqual(before);
    });
test.each(paths)('%s submission rolls back sample/work/submit/audit after a later audit failure', async (name, handler, body) => {
    const row = await fixture(), before = await snapshot([row.sample.id]);
    failAudit(name === 'legacy' ? 'SUBMISSION_CREATED' : 'WORKBENCH_SUBMIT');
    expect((await call(handler, body(row))).statusCode).toBe(500);
    expect(await snapshot([row.sample.id])).toEqual(before);
});
test('one preparation-blocked sample rolls back the whole workbench submission batch', async () => {
    const first = await fixture(), second = await fixture(), ids = [first.sample.id, second.sample.id];
    await createResultFixture(prisma, { data: { id: randomUUID(), sampleId: second.sample.id, param: 'PH', value: '6.25', isCurrent: true } });
    await prisma.$transaction(tx => evidence.recordPreparationRevert(tx, second.sample, 'PREPARATION', 'Reprepare specimen', manager));
    const before = await snapshot(ids);
    expect(await call(workbench.commitSubmissions, { sampleIds: ids })).toMatchObject({ statusCode: 409, body: { code: 'PREP_REVERTED_RESULTS' } });
    expect(await snapshot(ids)).toEqual(before);
});

test('generic work status audit failure rolls back the state, version and history', async () => {
    const row = await fixture('PROCESSING', 'ASSIGNED'), before = await snapshot([row.sample.id]);
    failAudit('STATUS_CHANGE');
    expect((await call(workController.updateWorkItemStatus, { status: 'IN_PROGRESS', version: row.item.version }, { id: row.item.id })).statusCode).toBe(500);
    expect(await snapshot([row.sample.id])).toEqual(before);
});
test('completed work requires a real reason before the generic reopen edge', async () => {
    const row = await fixture(), before = await snapshot([row.sample.id]);
    expect(await call(workController.updateWorkItemStatus, { status: 'IN_PROGRESS', version: row.item.version }, { id: row.item.id }))
        .toMatchObject({ statusCode: 400, body: { code: 'TRANSITION_REASON_REQUIRED' } });
    expect(await snapshot([row.sample.id])).toEqual(before);
    expect((await call(workController.updateWorkItemStatus, { status: 'IN_PROGRESS', reason: 'Repeat the preparation check',
        version: row.item.version }, { id: row.item.id })).statusCode).toBe(200);
    expect(await prisma.workItem.findUnique({ where: { id: row.item.id } })).toMatchObject({ status: 'IN_PROGRESS', result: row.item.result });
});

async function additionalItem(row, status, analysis = 'EC', extra = {}) {
    return work.createWorkItem({ id: randomUUID(), sampleId: row.sample.id, assignedLab: labId, labId,
        analysis, status, assignedTo: technician.username, result: '2.0', ...extra },
    'system:fixture', { context: 'fixture' });
}

const submissionMatrix = [
    ['SUBMITTED', 'FULL'], ['ACCEPTED', 'FULL'], ['WAIVED', 'FULL'], ['CANCELLED', 'FULL'],
    ['COMPLETED', 'PARTIAL'], ['ON_HOLD', 'PARTIAL'], ['REPEAT_REQUIRED', 'PARTIAL'],
    ['AWAITING_VERIFICATION', 'PARTIAL'], ['NOT_ASSIGNED', 'PARTIAL'], ['ASSIGNED', 'PARTIAL'], ['IN_PROGRESS', 'PARTIAL']
];
test.each(paths.flatMap(([name, handler, body]) => submissionMatrix.map(([status, type]) => [name, status, type, handler, body])))
    ('%s submission derives %s companion work as %s after selected work is submitted', async (_, status, type, handler, body) => {
        const row = await fixture();
        await additionalItem(row, status);
        const response = await call(handler, body(row));
        expect(response.statusCode).toBeLessThan(300);
        expect(await prisma.sample.findUnique({ where: { id: row.sample.id } })).toMatchObject({
            status: `SUBMITTED_${type}`, lastSubmissionType: type, approvedAt: null, approvedBy: null
        });
        expect(await prisma.submission.findFirst({ where: { sampleId: row.sample.id } })).toMatchObject({ type });
        expect(await prisma.workItem.findUnique({ where: { id: row.item.id } })).toMatchObject({ status: 'SUBMITTED' });
        const companion = await prisma.workItem.findFirst({ where: { sampleId: row.sample.id, analysis: 'EC' } });
        expect(companion.status).toBe(status);
    });

test('FULL derivation excludes duplicates, gates and every closure alias', async () => {
    const row = await fixture();
    await additionalItem(row, 'ON_HOLD', 'PH', { duplicateOf: row.item.id });
    for (const analysis of ['DRYING', 'PREPARATION', ...workflow.CLOSURE_TASK_ANALYSES]) {
        await additionalItem(row, 'NOT_ASSIGNED', analysis);
    }
    // The unfinished gates still prevent execution. This test isolates the
    // counted set by exercising the read-only derivation after projected submit.
    expect(await deriveSubmissionLifecycle(prisma, row.sample.id, { previewSelection: [row.item.id] }))
        .toMatchObject({ type: 'FULL', counted: 1, blocking: [] });
    expect(await deriveSubmissionLifecycle(prisma, row.sample.id)).toMatchObject({ type: 'PARTIAL' });
});

test.each(['COMPLETED', 'ON_HOLD', 'REPEAT_REQUIRED', 'AWAITING_VERIFICATION', 'NOT_ASSIGNED', 'ASSIGNED', 'IN_PROGRESS'])
    ('an explicit FULL request lists its %s blocker and rolls back every write', async status => {
        const row = await fixture(), other = await additionalItem(row, status), before = await snapshot([row.sample.id]);
        expect(await call(submissions.createSubmission, { sampleId: row.sample.id, workItemIds: [row.item.id], type: 'FULL' }))
            .toMatchObject({ statusCode: 409, body: { code: 'SUBMISSION_NOT_FULL', details: {
                blocking: [{ workItemId: other.id, analysis: other.analysis, status }]
            } } });
        expect(await snapshot([row.sample.id])).toEqual(before);
    });

test('requested PARTIAL is preserved in the audit when the derived lifecycle becomes FULL', async () => {
    const row = await fixture();
    expect((await call(submissions.createSubmission, { sampleId: row.sample.id, workItemIds: [row.item.id], type: 'PARTIAL' })).statusCode).toBe(201);
    const audit = await prisma.auditLog.findFirst({ where: { sampleId: row.sample.id, action: 'SUBMISSION_CREATED' } });
    expect(JSON.parse(audit.after)).toMatchObject({ requestedType: 'PARTIAL', derivedType: 'FULL', sampleStatus: 'SUBMITTED_FULL' });
});

test('a counted set containing only waived/cancelled work does not create a full submission', async () => {
    const row = await fixture('PROCESSING', 'WAIVED');
    await additionalItem(row, 'CANCELLED');
    expect(await deriveSubmissionLifecycle(prisma, row.sample.id)).toMatchObject({ type: 'PARTIAL', hasSubmission: false });
});

test('submission preview projects only selected items and reads leave every fixture row unchanged', async () => {
    const row = await fixture(), other = await additionalItem(row, 'COMPLETED'), before = await snapshot([row.sample.id]);
    const preview = await call(workbench.previewSubmissions, { sampleIds: [row.sample.id], workItemIds: [row.item.id] });
    expect(preview).toMatchObject({ statusCode: 200, body: { eligibleSamples: [{ submissionType: 'PARTIAL', totalCount: 2, completedCount: 1 }] } });
    expect(await snapshot([row.sample.id])).toEqual(before);
    await call(submissions.createSubmission, { sampleId: row.sample.id, workItemIds: [row.item.id, other.id], type: 'FULL' });
    const submission = await prisma.submission.findFirst({ where: { sampleId: row.sample.id } });
    const submitted = await snapshot([row.sample.id]);
    expect((await call(submissions.getSubmission, {}, { id: submission.id })).statusCode).toBe(200);
    expect(await snapshot([row.sample.id])).toEqual(submitted);
});

test.each(paths)('%s empty submission selection is refused without writes', async (name, handler) => {
    const row = await fixture('PROCESSING', 'ASSIGNED'), before = await snapshot([row.sample.id]);
    const body = name === 'legacy' ? { sampleId: row.sample.id, workItemIds: [], type: 'PARTIAL' } : { sampleIds: [row.sample.id] };
    expect((await call(handler, body)).statusCode).toBe(400);
    expect(await snapshot([row.sample.id])).toEqual(before);
});

const reviewPaths = [
    ['single', workController.reviewWorkItem, (row, status) => [{ status, reason: 'Repeat review reason' }, { id: row.item.id }]],
    ['bulk', workController.reviewWorkItemsBulk, (row, status) => [{ status, reason: 'Repeat review reason', workItemIds: [row.item.id] }, {}]],
    ['submission', submissions.reviewSubmission, (row, status) => [{ decisions: [{ workItemId: row.item.id,
        decision: status === 'REPEAT_REQUIRED' ? 'RETURN' : status === 'WAIVED' ? 'OMIT' : 'ACCEPT', reason: 'Repeat review reason' }] },
    { id: row.item.submissionId }]]
];
async function submittedFixture(sampleStatus = 'SUBMITTED_FULL') {
    const row = await fixture(sampleStatus, 'SUBMITTED');
    const sub = await prisma.submission.create({ data: { id: randomUUID(), sampleId: row.sample.id, assignedLab: labId, labId,
        submittedBy: technician.username, type: sampleStatus === 'SUBMITTED_FULL' ? 'FULL' : 'PARTIAL', status: 'PENDING_REVIEW',
        workItemIds: JSON.stringify([row.item.id]), workItemCount: 1 } });
    row.item = await prisma.workItem.update({ where: { id: row.item.id }, data: { submissionId: sub.id } });
    return row;
}
test.each(reviewPaths)('%s review RETURN reopens FULL atomically and records its decision in Sample history/audit', async (_, handler, payload) => {
    const row = await submittedFixture(), [body, params] = payload(row, 'REPEAT_REQUIRED');
    expect((await call(handler, body, params, manager)).statusCode).toBe(200);
    const decision = await prisma.reviewDecision.findFirst({ where: { workItemId: row.item.id, decision: 'RETURN' } });
    const sample = await prisma.sample.findUnique({ where: { id: row.sample.id } });
    expect(sample).toMatchObject({ status: 'PROCESSING', approvedAt: row.sample.approvedAt, approvedBy: row.sample.approvedBy });
    expect(JSON.parse(sample.history).at(-1)).toMatchObject({ action: 'REVIEW_RETURNED', reviewDecisionId: decision.id, reason: decision.reason });
    const audit = await prisma.auditLog.findFirst({ where: { sampleId: row.sample.id, action: 'REVIEW_RETURNED' } });
    expect(JSON.parse(audit.after)).toMatchObject({ status: 'PROCESSING', reviewDecisionId: decision.id, reason: decision.reason });
    expect(await prisma.workItem.findUnique({ where: { id: row.item.id } })).toMatchObject({ status: 'REPEAT_REQUIRED', result: row.item.result });
});
test.each(reviewPaths)('%s review RETURN retains a partial lifecycle', async (_, handler, payload) => {
    const row = await submittedFixture('SUBMITTED_PARTIAL'), [body, params] = payload(row, 'REPEAT_REQUIRED');
    expect((await call(handler, body, params, manager)).statusCode).toBe(200);
    expect(await prisma.sample.findUnique({ where: { id: row.sample.id } })).toMatchObject({ status: 'SUBMITTED_PARTIAL' });
    expect(await prisma.auditLog.count({ where: { sampleId: row.sample.id, action: 'REVIEW_RETURNED' } })).toBe(0);
});
test.each(reviewPaths.flatMap(([name, handler, payload]) => ['ACCEPTED', 'WAIVED'].map(status => [name, status, handler, payload])))
    ('%s review %s leaves FULL lifecycle unchanged', async (_, status, handler, payload) => {
        const row = await submittedFixture(), [body, params] = payload(row, status);
        expect((await call(handler, body, params, manager)).statusCode).toBe(200);
        expect(await prisma.sample.findUnique({ where: { id: row.sample.id } })).toMatchObject({ status: 'SUBMITTED_FULL' });
    });
test.each(reviewPaths)('%s review RETURN refuses an approved Sample with zero writes', async (_, handler, payload) => {
    const row = await submittedFixture('APPROVED'), [body, params] = payload(row, 'REPEAT_REQUIRED'), before = await snapshot([row.sample.id]);
    expect(await call(handler, body, params, manager)).toMatchObject({ statusCode: 409, body: { code: 'AMENDMENT_WORKFLOW_REQUIRED' } });
    expect(await snapshot([row.sample.id])).toEqual(before);
});
test('a Sample status change during FULL review rolls back its decision and WorkItem', async () => {
    const row = await submittedFixture(), before = await snapshot([row.sample.id]);
    await expect(commitReview(prisma, row.item, 'REPEAT_REQUIRED', manager, { reanalysisReason: 'Repeat review reason' }, async tx => {
        const decision = await tx.reviewDecision.create({ data: { id: randomUUID(), sampleId: row.sample.id, workItemId: row.item.id,
            decision: 'RETURN', reviewerId: manager.username, reviewerName: manager.username, reason: 'Repeat review reason' } });
        await samples.transitionSample(row.sample.id, 'ON_HOLD', manager, 'Concurrent manager hold', {}, tx);
        return [decision];
    })).rejects.toMatchObject({ statusCode: 409, code: 'SAMPLE_STATE_CHANGED' });
    expect(await snapshot([row.sample.id])).toEqual(before);
});
test('a failed FULL review lifecycle audit rolls back its decision, history and WorkItem', async () => {
    const row = await submittedFixture(), before = await snapshot([row.sample.id]);
    failAudit('REVIEW_RETURNED');
    expect((await call(workController.reviewWorkItem, { status: 'REPEAT_REQUIRED', reason: 'Repeat review reason' }, { id: row.item.id }, manager)).statusCode).toBe(500);
    expect(await snapshot([row.sample.id])).toEqual(before);
});

test.each(['ARCHIVING', 'DISPOSAL'])('%s request creates NOT_ASSIGNED through the authority and preserves Sample approval', async analysis => {
    const row = await fixture('APPROVED', 'ACCEPTED');
    const result = await requestClosure(row.sample.id, analysis, { archiveLocation: 'Shelf 4', disposalMethod: 'Laboratory procedure' }, manager);
    expect(result).toMatchObject({ status: 'APPROVED', workItem: { status: 'NOT_ASSIGNED', analysis } });
    expect(await prisma.sample.findUnique({ where: { id: row.sample.id } })).toMatchObject({ status: 'APPROVED',
        approvedAt: row.sample.approvedAt, approvedBy: row.sample.approvedBy });
    expect(await prisma.auditLog.findFirst({ where: { entityId: row.sample.id,
        action: analysis === 'ARCHIVING' ? 'ARCHIVE_TASK_CREATED' : 'DISPOSAL_TASK_CREATED' } })).toMatchObject({ performedBy: manager.username });
    const retry = await requestClosure(row.sample.id, analysis, { notes: 'Retain existing closure task' }, manager);
    expect(retry.workItem.id).toBe(result.workItem.id);
    expect(await prisma.workItem.count({ where: { sampleId: row.sample.id, analysis } })).toBe(1);
});
test.each(['ARCHIVING', 'DISPOSAL'])('%s request rolls back creation and metadata if its audit fails', async analysis => {
    const row = await fixture('APPROVED', 'ACCEPTED'), before = await snapshot([row.sample.id]);
    failAudit(analysis === 'ARCHIVING' ? 'ARCHIVE_TASK_CREATED' : 'DISPOSAL_TASK_CREATED');
    await expect(requestClosure(row.sample.id, analysis, { notes: 'Closure note' }, manager)).rejects.toThrow('Injected workflow audit failure');
    expect(await snapshot([row.sample.id])).toEqual(before);
});
test('closure state/scope refusals happen before creation or metadata writes', async () => {
    const row = await fixture('PROCESSING', 'ACCEPTED'), before = await snapshot([row.sample.id]);
    await expect(requestClosure(row.sample.id, 'ARCHIVING', { notes: 'Closure note' }, manager))
        .rejects.toMatchObject({ statusCode: 409, code: 'SAMPLE_NOT_APPROVED' });
    await expect(requestClosure(row.sample.id, 'DISPOSAL', { notes: 'Closure note' }, { ...manager, labId: randomUUID() }))
        .rejects.toMatchObject({ statusCode: 403 });
    expect(await snapshot([row.sample.id])).toEqual(before);
});

test('generic Sample status audit failure rolls back the hold and provenance together', async () => {
    const row = await fixture(), before = await snapshot([row.sample.id]);
    failAudit('STATUS_CHANGE');
    expect((await call(sampleController.updateStatus, { status: 'ON_HOLD', reason: 'Check specimen custody' }, { id: row.sample.id }, manager)).statusCode).toBe(500);
    expect(await snapshot([row.sample.id])).toEqual(before);
});
test('generic Sample cancellation needs the supplied reason and retains all WorkItems', async () => {
    const row = await fixture('EXPECTED', 'NOT_ASSIGNED'), before = await snapshot([row.sample.id]);
    expect(await call(sampleController.updateStatus, { status: 'CANCELLED' }, { id: row.sample.id }, manager))
        .toMatchObject({ statusCode: 400, body: { code: 'TRANSITION_REASON_REQUIRED' } });
    expect(await snapshot([row.sample.id])).toEqual(before);
    expect((await call(sampleController.updateStatus, { status: 'CANCELLED', reason: 'Field specimen withdrawn' }, { id: row.sample.id }, manager)).statusCode).toBe(200);
    expect(await prisma.sample.findUnique({ where: { id: row.sample.id } })).toMatchObject({ status: 'CANCELLED' });
    expect((await snapshot([row.sample.id])).items).toEqual(before.items);
});
test('generic Sample status cannot reopen an approved sample and writes no audit', async () => {
    const row = await fixture('APPROVED'), before = await snapshot([row.sample.id]);
    expect(await call(sampleController.updateStatus, { status: 'PROCESSING' }, { id: row.sample.id }, manager))
        .toMatchObject({ statusCode: 409, body: { code: 'ILLEGAL_STATUS_TRANSITION' } });
    expect(await snapshot([row.sample.id])).toEqual(before);
});
