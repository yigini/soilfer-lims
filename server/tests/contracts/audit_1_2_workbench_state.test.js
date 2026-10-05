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
        events: await prisma.resultEvidenceEvent.findMany({ where: sampleWhere, orderBy: { id: 'asc' } })
    };
}
async function call(handler, body, params = {}) {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
    await handler({ user: technician, body, params }, res);
    return res;
}
function failAudit(action, aggregateOnly = false) {
    const transaction = prisma.$transaction.bind(prisma);
    jest.spyOn(prisma, '$transaction').mockImplementation((execute, options) => transaction(tx => execute(new Proxy(tx, {
        get(target, key) {
            if (key === 'auditLog') return new Proxy(target.auditLog, { get(delegate, operation) {
                if (operation === 'create') return args => {
                    if ((!action || args.data.action === action) && (!aggregateOnly || args.data.entityId == null)) throw new Error('Injected workflow audit failure');
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
    await prisma.result.create({ data: { id: randomUUID(), sampleId: row.sample.id, param: 'PH', value: '6.25', isCurrent: true } });
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
    await prisma.result.create({ data: { id: randomUUID(), sampleId: second.sample.id, param: 'PH', value: '6.25', isCurrent: true } });
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
