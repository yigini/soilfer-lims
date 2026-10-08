const fs = require('node:fs');
const path = require('node:path');
const rules = require('../../services/workflowStateRules');
const { canonicalWorkItemWhere } = require('../../services/workAttemptContract');
const { allocateExecution, insertExecution } = require('../../services/workAttemptWriteService');
const { createResultFixture } = require('../../services/resultWriteService');

// #190 pin6056586906: positive fixtures explicitly request a complete recorded
// execution. Missing canonical work is refused, never manufactured here.
async function createExecutionResultFixture(db, args) {
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
        await insertExecution(tx, ctx, allocation, { source: 'fixture', sourceResultIds: [data.id],
            measurements: [{ resultId: data.id, param: data.param, replicateNo: data.replicateNo ?? 1,
                value: data.value, rawInput: data.rawInput ?? null, numericValue: data.numericValue ?? null }] }, new Date());
        return createResultFixture(tx, { ...args, data: { ...data, attemptId: allocation.id } });
    });
}

module.exports = { createExecutionResultFixture };
