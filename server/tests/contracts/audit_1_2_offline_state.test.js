const { createExecutionResultFixture } = require('../helpers/workAttemptFixtures');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const prisma = require('../../prisma');
const SyncService = require('../../services/syncService');
const { transitionWorkItem } = require('../../services/workItemStateService');
const { getAuthToken } = require('../setup');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const labId = 'LAB-OFFLINE-STATE-179', analysis = 'OFFLINE_STATE_179';
let actor, manager;
beforeAll(async () => {
    actor = jwt.decode(await getAuthToken('LAB_TECHNICIAN', labId));
    manager = jwt.decode(await getAuthToken('LAB_MANAGER', labId));
    await prisma.analysis.create({ data: { code: analysis, name: 'Offline state numeric method', units: 'mg/kg', prerequisites: '[]' } });
});
afterEach(() => jest.restoreAllMocks());
async function fixture(status = 'PROCESSING') {
    const sample = await createSampleFixture(prisma, { data: { id: randomUUID(), originalId: randomUUID(), assignedLab: labId,
        status, receptionDate: new Date(), dryingStatus: 'DONE', preparationStatus: 'DONE' } });
    const item = await createWorkItemFixture(prisma, { data: { id: randomUUID(), sampleId: sample.id, analysis,
        assignedLab: labId, assignedTo: actor.username, status: 'ASSIGNED', version: 0 } });
    const result = await createExecutionResultFixture(prisma, { data: { id: randomUUID(), sampleId: sample.id, param: analysis,
        value: '6.2', numericValue: 6.2, flags: '["ORIGINAL_NOTE"]', isCurrent: true } });
    return { sample, item, result };
}
async function snapshot(row) {
    return { sample: await prisma.sample.findUnique({ where: { id: row.sample.id } }),
        item: await prisma.workItem.findUnique({ where: { id: row.item.id } }),
        results: await prisma.result.findMany({ where: { sampleId: row.sample.id }, orderBy: { id: 'asc' } }),
        draft: await prisma.workItemDraft.findUnique({ where: { workItemId: row.item.id } }),
        attempts: await prisma.workAttempt.findMany({ where: { workItemId: row.item.id }, orderBy: { id: 'asc' } }),
        audits: await prisma.auditLog.findMany({ where: { sampleId: row.sample.id }, orderBy: { id: 'asc' } }),
        receipts: await prisma.commandReceipt.findMany({ where: { targetResource: row.item.id }, orderBy: { id: 'asc' } }) };
}
async function perform(row, type = 'COMPLETE_WORK') {
    const operationId = randomUUID();
    const response = await SyncService.applySyncOperations(actor, [{ operationId, type,
        target: { workItemId: row.item.id }, baseVersion: row.item.version, capturedAtLocal: new Date().toISOString(), payload: { value: '7.2' } }]);
    return response.receipts[0];
}

test('offline draft start preserves analytical base version and commits its central audit with the draft and receipt', async () => {
    const row = await fixture(), before = await snapshot(row), receipt = await perform(row, 'SAVE_WORK_DRAFT');
    expect(receipt.status).toBe('APPLIED');
    const after = await snapshot(row);
    expect(after.sample).toEqual(before.sample); expect(after.results).toEqual(before.results);
    expect(after.item).toMatchObject({ status: 'IN_PROGRESS', version: before.item.version, result: before.item.result });
    expect(after.draft).toMatchObject({ value: '7.2', baseVersion: before.item.version });
    expect(after.audits).toEqual(expect.arrayContaining(before.audits));
    expect(after.audits).toHaveLength(before.audits.length + 1);
    expect(after.audits.find(audit => audit.action === 'DRAFT_STARTED').performedBy).toBe(actor.username);
    expect(after.receipts).toHaveLength(1);
});

test('offline completion centrally records provenance and preserves superseded analytical values', async () => {
    const row = await fixture(), before = await snapshot(row), receipt = await perform(row);
    expect(receipt.status).toBe('APPLIED');
    const after = await snapshot(row);
    expect(after.sample).toEqual(before.sample);
    expect(after.item).toMatchObject({ status: 'COMPLETED', version: before.item.version + 1, result: '7.2' });
    expect(JSON.parse(after.item.history).at(-1)).toMatchObject({ action: 'OFFLINE_WORK_COMPLETED', resultId: receipt.outcome.resultId });
    expect(after.results.find(result => result.id === row.result.id)).toMatchObject({ value: '6.2', numericValue: 6.2,
        flags: '["ORIGINAL_NOTE"]', isCurrent: false });
    expect(after.results.find(result => result.isCurrent)).toMatchObject({ value: '7.2', enteredBy: actor.username });
    // Pin6060005962: a re-record binds a new attempt and preserves the first.
    expect(before.attempts).toHaveLength(1);
    const priorAttempt = before.attempts.find(attempt => attempt.id === row.result.attemptId);
    expect(priorAttempt).toMatchObject({ workItemId: row.item.id, attemptNo: 1, status: 'RECORDED' });
    expect(after.attempts).toHaveLength(2);
    expect(after.attempts.find(attempt => attempt.id === priorAttempt.id)).toEqual(priorAttempt);
    const currentResult = after.results.find(result => result.id === receipt.outcome.resultId);
    expect(currentResult).toMatchObject({ id: receipt.outcome.resultId, isCurrent: true });
    expect(JSON.parse(after.receipts[0].outcome)).toMatchObject({ resultId: currentResult.id, attemptId: currentResult.attemptId });
    expect(currentResult.attemptId).not.toBe(priorAttempt.id);
    expect(after.attempts.find(attempt => attempt.id === currentResult.attemptId))
        .toMatchObject({ workItemId: row.item.id, attemptNo: 2 });
    expect(after.results.find(result => result.id === row.result.id)).toMatchObject({ attemptId: priorAttempt.id, isCurrent: false });
    expect(after.receipts).toHaveLength(1);
    expect(after.audits.filter(audit => audit.action !== 'RESULT_RECORDED')).toHaveLength(before.audits.length + 1);
    const resultAudits = after.audits.filter(audit => audit.action === 'RESULT_RECORDED');
    expect(resultAudits).toHaveLength(1);
    expect(resultAudits[0]).toMatchObject({ entityId: receipt.outcome.resultId, performedBy: actor.username });
    expect(after.audits.find(audit => audit.action === 'OFFLINE_WORK_COMPLETED').performedBy).toBe(actor.username);
});

test.each(['SAVE_WORK_DRAFT', 'COMPLETE_WORK'])('fresh scope refusal rolls back all %s changes inside its transaction', async type => {
    const row = await fixture(), before = await snapshot(row), transaction = prisma.$transaction.bind(prisma);
    jest.spyOn(prisma, '$transaction').mockImplementationOnce(callback => transaction(async tx => {
        await tx.sample.update({ where: { id: row.sample.id }, data: { assignedLab: 'OTHER-LAB' } });
        return callback(tx);
    }));
    const receipt = await perform(row, type);
    expect(receipt.status).toBe('REJECTED'); expect(receipt.code).toBe('ACCESS_DENIED_LAB');
    expect(await snapshot(row)).toEqual(before);
});

test.each(['SAVE_WORK_DRAFT', 'COMPLETE_WORK'])('a failed central audit rolls back %s, evidence and receipt together', async type => {
    const row = await fixture(), before = await snapshot(row), transaction = prisma.$transaction.bind(prisma);
    jest.spyOn(prisma, '$transaction').mockImplementationOnce(callback => transaction(tx => callback({ ...tx,
        auditLog: { ...tx.auditLog, create: async () => { throw new Error('Injected offline state audit failure'); } } })));
    expect((await perform(row, type)).status).toBe('REJECTED');
    expect(await snapshot(row)).toEqual(before);
});

test('a stale item refuses completion and rolls back the transaction without partial evidence', async () => {
    const row = await fixture(), before = await snapshot(row), transaction = prisma.$transaction.bind(prisma);
    jest.spyOn(prisma, '$transaction').mockImplementationOnce(callback => transaction(async tx => {
        await transitionWorkItem(row.item.id, 'IN_PROGRESS', actor, 'Concurrent start', {}, tx);
        return callback(tx);
    }));
    const receipt = await perform(row);
    expect(receipt).toMatchObject({ status: 'REJECTED', code: 'WORKITEM_STATE_CHANGED' });
    expect(await snapshot(row)).toEqual(before);
});

test.each(['APPROVED', 'ARCHIVED', 'DISPOSED'])('offline completion leaves final %s work and all evidence unchanged', async status => {
    const row = await fixture(status), before = await snapshot(row);
    expect((await perform(row)).status).toBe('REJECTED');
    expect(await snapshot(row)).toEqual(before);
});

test('offline intake creates EXPECTED then records RECEIVED centrally with custody and receipt in one transaction', async () => {
    const originalId = randomUUID(), operationId = randomUUID();
    const response = await SyncService.applySyncOperations(manager, [{ operationId, type: 'RECORD_INTAKE',
        target: { originalId }, payload: { originalId, labId } }]);
    expect(response.receipts[0].status).toBe('APPLIED');
    const sample = await prisma.sample.findUnique({ where: { originalId } });
    expect(sample).toMatchObject({ status: 'RECEIVED', assignedLab: labId, receivedBy: manager.username, receptionDate: expect.any(Date) });
    expect(await prisma.workItem.count({ where: { sampleId: sample.id } })).toBe(0);
    const audits = await prisma.auditLog.findMany({ where: { sampleId: sample.id } });
    expect(audits.map(audit => audit.action).sort()).toEqual(['SAMPLE_CREATED', 'SAMPLE_RECEIVED']);
    expect(audits.every(audit => audit.performedBy === manager.username)).toBe(true);
    expect(await prisma.commandReceipt.count({ where: { idempotencyKey: operationId } })).toBe(1);
});
