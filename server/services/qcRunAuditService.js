const { randomUUID } = require('node:crypto');
const { Prisma } = require('../prisma_client');
const { actorName, inTransaction } = require('./workflowStateRules');
const { QC_RUN_INCLUDE, batchApiView } = require('./qcRunViewService');
const { requireBatchHistory } = require('./qcHistoryService');

// Nested commands receive the same transaction client. Its private collector
// flushes only after the outer command succeeds, before that transaction commits.
const collectors = new WeakMap();
const plain = value => JSON.parse(JSON.stringify(value));
const scalar = (row, relations = []) => Object.fromEntries(Object.entries(row).filter(([key]) => !relations.includes(key)));
// QC cannot alter these immutable fields, which are absent in old QC fixtures.
const resultSelect = Object.fromEntries(Object.keys(Prisma.ResultScalarFieldEnum)
    .filter(key => !['attemptId', 'equipmentReadiness'].includes(key)).map(key => [key, true]));

async function evidence(tx, batchId, extraIds = []) {
    const batch = await tx.batch.findUnique({ where: { id: batchId }, include: QC_RUN_INCLUDE });
    const positions = batch?.positions || [], linkedIds = positions.flatMap(row => row.workItems.map(link => link.workItemId));
    const workItems = await tx.workItem.findMany({ where: { OR: [{ batchId }, { id: { in: [...new Set([...extraIds, ...linkedIds])] } }] } });
    const results = await tx.result.findMany({ where: { batchId }, select: resultSelect });
    const qcItems = await tx.batchQcResult.findMany({ where: { batchId } });
    const rows = new Map();
    function add(entity, values, relations = []) {
        for (const value of values) rows.set(`${entity}:${value.id}`, { entity, id: value.id,
            analysisCode: value.analysisCode ?? value.analysis ?? value.param ?? null, value: plain(scalar(value, relations)) });
    }
    if (batch) add('Batch', [batch], Object.keys(QC_RUN_INCLUDE));
    add('BatchAnalyte', batch?.analytes || []);
    add('BatchPosition', positions, ['workItems', 'references']);
    add('BatchPositionWorkItem', positions.flatMap(row => row.workItems), ['workItem']);
    add('BatchPositionReference', positions.flatMap(row => row.references));
    add('QcMeasurement', batch?.measurements || []);
    add('QcEvaluation', batch?.evaluations || []);
    add('BatchDisposition', batch?.dispositions || []);
    add('BatchEvent', batch?.events || []);
    add('BatchQcResult', qcItems);
    add('WorkItem', workItems);
    add('Result', results);
    return { batch, rows, workItemIds: workItems.map(row => row.id) };
}

async function touch(collector, batchId, extraIds = []) {
    if (!batchId || collector.batches.has(batchId)) return;
    collector.batches.set(batchId, { before: await evidence(collector.tx, batchId, extraIds), metadata: {} });
}

async function recordBatchAudit(tx, batchId, metadata) {
    const collector = collectors.get(tx);
    if (!collector) throw new Error('QC audit metadata requires the outer command transaction.');
    await touch(collector, batchId);
    Object.assign(collector.batches.get(batchId).metadata, metadata);
}

async function snapshotEvidence(tx, batch, actor, reason, now) {
    await recordBatchAudit(tx, batch.id, { reason, now });
}

async function appendPair(collector, batchId, record) {
    const { tx, actor, operation } = collector, { before, metadata } = record;
    const after = await evidence(tx, batchId, before.workItemIds);
    const changes = [];
    for (const key of [...new Set([...before.rows.keys(), ...after.rows.keys()])].sort()) {
        const old = before.rows.get(key), next = after.rows.get(key);
        if (JSON.stringify(old?.value ?? null) === JSON.stringify(next?.value ?? null)) continue;
        const row = next || old;
        changes.push({ entity: row.entity, id: row.id, analysisCode: row.analysisCode,
            before: old?.value ?? null, after: next?.value ?? null });
    }
    if (!changes.length) return;
    if (!after.batch) throw new Error('QC commands cannot remove their batch.');
    const view = before.batch ? batchApiView(before.batch) : null;
    const previous = await tx.auditLog.findMany({ where: { entityId: batchId, entity: { in: ['BATCH', 'QC_BATCH'] } }, select: { action: true, details: true } });
    const sequences = previous.map(row => {
        let details;
        try { details = JSON.parse(row.details); }
        catch {
            if (row.action === 'QC_EVIDENCE_SNAPSHOT') requireBatchHistory(row.details);
            return 0; // Retain historical human-readable CREATE/disposition rows.
        }
        return details?.kind === 'QC_EVIDENCE_SNAPSHOT' || row.action === 'QC_EVIDENCE_SNAPSHOT' ? Number(details?.seq) || 0 : 0;
    });
    const seq = Math.max(0, ...(view?.history || []).map(event => Number(event.seq) || 0), ...sequences) + 1;
    const now = metadata.now || new Date(), reason = metadata.reason ?? collector.reason ?? null;
    const action = metadata.action || 'QC_EVIDENCE_SNAPSHOT';
    const event = { ...(metadata.details || {}), kind: 'QC_EVIDENCE_SNAPSHOT', operation, action, seq, reason, changes,
        snapshot: { qcResults: view?.qcResults ?? null, qcItems: view?.qcItems || [], status: view?.status ?? null,
            disposition: view?.disposition ?? null, workItemIds: view?.workItemIds || [],
            actor: { id: actor.id || null, username: actor.username }, timestamp: now, reason } };
    await tx.auditLog.create({ data: { id: randomUUID(), entity: metadata.entity || 'BATCH', entityId: batchId,
        action, details: JSON.stringify(event), performedBy: actorName(actor), timestamp: now } });
    await tx.batchEvent.create({ data: { id: randomUUID(), batchId, type: 'QC_EVIDENCE_SNAPSHOT',
        payload: JSON.stringify({ historyEntry: event }), by: actorName(actor), at: now } });
}

async function withQcAudit(db, { actor, batchId, input = {}, operation, reason }, execute) {
    return inTransaction(db, async tx => {
        let collector = collectors.get(tx);
        const outer = !collector;
        if (outer) { collector = { tx, actor, operation, reason: reason ?? input?.reason, batches: new Map() }; collectors.set(tx, collector); }
        try {
            const ids = Array.isArray(input?.workItemIds) ? input.workItemIds.filter(id => typeof id === 'string') : [];
            await touch(collector, batchId, ids);
            const selected = ids.length ? await tx.workItem.findMany({ where: { id: { in: ids } } }) : [];
            for (const sourceId of new Set(selected.map(item => item.batchId).filter(id => id && id !== batchId))) await touch(collector, sourceId);
            const result = await execute(tx);
            const targetId = batchId || result?.batch?.id || result?.id;
            if (targetId && !collector.batches.has(targetId)) {
                // New batches have no prior evidence. Selected members do exist
                // and retain their genuine before values, including old pointers.
                const rows = new Map(selected.map(row => [`WorkItem:${row.id}`, { entity: 'WorkItem', id: row.id, analysisCode: row.analysis, value: plain(row) }]));
                collector.batches.set(targetId, { before: { batch: null, rows, workItemIds: ids }, metadata: {} });
            }
            if (outer) {
                for (const [id, record] of collector.batches) await appendPair(collector, id, record);
                const view = result?.batch || (result?.id && result?.analytes ? result : null);
                if (view) view.history = batchApiView(await tx.batch.findUnique({ where: { id: view.id }, include: QC_RUN_INCLUDE })).history;
            }
            return result;
        } finally { if (outer) collectors.delete(tx); }
    });
}

function auditRunCommand(command, operation) {
    return (db, batchId, actor, input, ...options) => withQcAudit(db,
        { batchId, actor, input, operation: typeof operation === 'function' ? operation(input, ...options) : operation,
            reason: typeof input === 'string' ? input : input?.reason }, tx => command(tx, batchId, actor, input, ...options));
}

module.exports = { withQcAudit, auditRunCommand, recordBatchAudit, snapshotEvidence };
