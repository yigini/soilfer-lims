const { randomUUID } = require('node:crypto');
const { auditRunCommand } = require('./qcRunAuditService');
const { hasPermission } = require('../config/roles');
const { actorName, inTransaction } = require('./workflowStateRules');
const { readQcRun, QC_RUN_INCLUDE, batchApiView } = require('./qcRunViewService');
const { nextOrdinal } = require('./qcNativeRunService');
const { resolveSequenceCriteria } = require('./batchSequenceService');
const { validateRunSequence } = require('./qcRunSequenceValidation');
const failure = (statusCode, code, message) => Object.assign(new Error(message), { statusCode, code });

async function reorderNativeRun(db, batchId, actor, input = {}) {
    if (!hasPermission(actor, 'CHANGE_STATUS')) throw failure(403, 'QC_RUN_PERMISSION_REQUIRED', 'QC run permission is required.');
    const performedBy = actorName(actor);
    return inTransaction(db, async tx => {
        const batch = await readQcRun(tx, batchId, actor);
        if (batch.startedAt || batch.measurements.length || batch.analytes.some(row => row.legacyMembershipFrozen)) {
            throw failure(409, 'BATCH_MEMBERSHIP_FROZEN', 'Started or measured membership cannot be reordered.');
        }
        if (batch.status !== 'OPEN') throw failure(409, 'QC_BATCH_LOCKED', 'Only an OPEN run can be reordered.');
        if (!batch.analytes.length || batch.analytes.some(row => row.provenance !== 'NATIVE')) {
            throw failure(409, 'QC_NATIVE_RUN_REQUIRED', 'Only a native run has a reorderable sequence.');
        }
        const ids = input.positionIds;
        if (!Array.isArray(ids) || ids.length !== batch.positions.length || new Set(ids).size !== ids.length ||
            ids.some(id => typeof id !== 'string' || !batch.positions.some(row => row.id === id))) {
            throw failure(400, 'QC_SEQUENCE_ORDER_INVALID', 'Include each current position exactly once.');
        }
        const positions = ids.map((id, index) => ({ ...batch.positions.find(row => row.id === id), position: index + 1 })), analyses = [];
        for (const row of batch.analytes) analyses.push({ ...await resolveSequenceCriteria(batch.labId, row.analysisCode, row.methodologyId, tx),
            crmOrdinal: await nextOrdinal(tx, batch.labId, row.analysisCode, row.methodologyId) });
        // Validate the complete candidate before moving any position. This also
        // checks duplicate parents and each analyte's calibration boundaries.
        const validated = validateRunSequence({ positions, analyses });
        const offset = Math.max(...batch.positions.map(row => row.position)) + positions.length;
        await tx.batchPosition.updateMany({ where: { batchId }, data: { position: { increment: offset } } });
        for (const row of positions) {
            await tx.batchPosition.update({ where: { id: row.id }, data: { position: row.position } });
            if (row.kind === 'SAMPLE') for (const link of row.workItems) {
                await tx.workItem.update({ where: { id: link.workItemId }, data: { rackPosition: row.position } });
            }
        }
        const built = batch.events.filter(row => row.type === 'RUN_BUILT').sort((a, b) => new Date(b.at) - new Date(a.at))[0];
        await tx.batchEvent.create({ data: { id: randomUUID(), batchId, type: 'RUN_REORDERED', by: performedBy, at: new Date(),
            payload: JSON.stringify({ positions: validated.positions, forecasts: validated.forecasts,
                duplicateSelection: built && JSON.parse(built.payload).duplicateSelection }) } });
        return batchApiView(await tx.batch.findUnique({ where: { id: batchId }, include: QC_RUN_INCLUDE }));
    });
}
module.exports = { reorderNativeRun: auditRunCommand(reorderNativeRun, 'REORDER') };
