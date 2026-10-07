const { randomUUID } = require('node:crypto');
const { actorName } = require('./workflowStateRules');
const { batchApiView } = require('./qcRunViewService');

async function snapshotEvidence(tx, batch, actor, reason, now) {
    const view = batchApiView(batch), previous = await tx.auditLog.findMany({
        where: { entity: 'BATCH', entityId: batch.id, action: 'QC_EVIDENCE_SNAPSHOT' }, select: { details: true }
    });
    const seq = Math.max(0, ...view.history.map(event => Number(event.seq) || 0),
        ...previous.map(row => Number(JSON.parse(row.details)?.seq) || 0)) + 1;
    const event = { action: 'QC_EVIDENCE_SNAPSHOT', seq, reason, snapshot: {
        qcResults: view.qcResults, qcItems: view.qcItems, status: view.status,
        disposition: view.disposition, workItemIds: view.workItemIds,
        actor: { id: actor.id || null, username: actor.username }, timestamp: now, reason
    } };
    await tx.auditLog.create({ data: { id: randomUUID(), entity: 'BATCH', entityId: batch.id,
        action: event.action, details: JSON.stringify(event), performedBy: actorName(actor), timestamp: now } });
    await tx.batchEvent.create({ data: { id: randomUUID(), batchId: batch.id, type: event.action,
        payload: JSON.stringify({ historyEntry: event }), by: actorName(actor), at: now } });
}
module.exports = { snapshotEvidence };
