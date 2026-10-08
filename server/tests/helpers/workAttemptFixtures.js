const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const rules = require('../../services/workflowStateRules');
const { canonicalWorkItemWhere } = require('../../services/workAttemptContract');
const { allocateExecution, insertExecution } = require('../../services/workAttemptWriteService');
const { createResultFixture } = require('../../services/resultWriteService');

// #190 pin6056586906: positive fixtures explicitly request a complete recorded
// execution. Missing canonical work is refused, never manufactured here.
async function createExecutionResultFixture(db, args) {
    const { attemptStatus, ...resultArgs } = args;
    rules.assertFixtureContext();
    const databases = await db.$queryRawUnsafe('PRAGMA database_list');
    const file = databases.find(row => row.name === 'main')?.file;
    if (!file || !fs.existsSync(file)) throw Error('Execution fixture requires an owned database file.');
    const resolved = fs.realpathSync(file);
    const relative = path.relative(path.resolve(__dirname, '../..'), resolved).replace(/\\/g, '/');
    if (!/^tests\/\.tmp\/[^/]+\.db$/.test(relative)) throw Error('Execution fixture refuses a non-test-owned file.');
    if (process.env.PRODUCTION_DATABASE_PATH && resolved.toLowerCase() ===
        path.resolve(process.env.PRODUCTION_DATABASE_PATH).toLowerCase()) throw Error('Execution fixture refuses production.');
    return rules.inTransaction(db, async tx => {
        const data = args.data;
        if (!data?.id || data.attemptId != null) throw Error('Execution fixture requires a new Result id without a supplied attempt.');
        const items = await tx.workItem.findMany({ where: canonicalWorkItemWhere(data.sampleId, data.param) });
        if (items.length !== 1) throw Error('Execution fixture requires exactly one existing canonical WorkItem.');
        const item = items[0];
        const equipmentReadiness = data.equipmentReadiness ? JSON.parse(data.equipmentReadiness) : null;
        const ctx = { item, performedBy: 'system:fixture', batchId: data.batchId ?? null,
            method: null, equipmentReadiness, equipmentReadinessText: data.equipmentReadiness ?? null };
        const allocation = await allocateExecution(tx, ctx);
        const evidence = { source: 'fixture', sourceResultIds: [data.id],
            measurements: [{ resultId: data.id, param: data.param, replicateNo: data.replicateNo ?? 1,
                value: data.value, rawInput: data.rawInput ?? null, numericValue: data.numericValue ?? null }] };
        if (attemptStatus === 'ACCEPTED') {
            // #190 pin6057445449: the explicit accepted spectral bystander is
            // inserted in its final state before its unchanged measured Result.
            if (item.status !== 'ACCEPTED') throw Error('Accepted fixture evidence requires accepted canonical work.');
            const evidenceData = JSON.stringify({ ...evidence, equipmentReadiness }), now = new Date();
            await tx.workAttempt.create({ data: { id: allocation.id, workItemId: item.id, attemptNo: allocation.attemptNo,
                status: 'ACCEPTED', reason: allocation.reason, author: ctx.performedBy, authorName: ctx.performedBy,
                batchId: ctx.batchId, qcBatchId: ctx.batchId, instrumentId: equipmentReadiness?.equipmentId || null,
                executedMethodRevision: null, version: (item.version || 0) + 1, evidenceData,
                evidenceHash: createHash('sha256').update(evidenceData).digest('hex'), createdAt: now, updatedAt: now } });
        } else {
            if (attemptStatus != null && attemptStatus !== 'RECORDED') throw Error('Unknown positive fixture attempt status.');
            await insertExecution(tx, ctx, allocation, evidence, new Date());
        }
        return createResultFixture(tx, { ...resultArgs, data: { ...data, attemptId: allocation.id } });
    });
}

module.exports = { createExecutionResultFixture };
