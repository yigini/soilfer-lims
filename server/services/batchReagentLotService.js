const { randomUUID } = require('node:crypto');
const { hasPermission } = require('../config/roles');
const policyService = require('./policyService');
const { actorName } = require('./workflowStateRules');
const { auditRunCommand } = require('./qcRunAuditService');
const { readQcRun, currentAnalyteEvidence } = require('./qcRunViewService');
const failure = (statusCode, code, message, details) => Object.assign(new Error(message), { statusCode, code, details });

function permission(actor) {
    if (!hasPermission(actor, 'CHANGE_STATUS')) throw failure(403, 'QC_RUN_PERMISSION_REQUIRED', 'QC run permission is required.');
    return actorName(actor);
}
function assertLinkState(batch) {
    if (!batch.startedAt) {
        if (batch.status === 'OPEN') return;
    } else if (batch.status !== 'CLOSED' && batch.analytes.length &&
        !batch.analytes.some(row => ['QC_FAIL', 'REJECTED', 'REPEAT_ORDERED', 'CLOSED'].includes(row.status) ||
            currentAnalyteEvidence(batch, row.analysisCode).disposition) &&
        batch.analytes.some(row => ['IN_RUN', 'QC_PENDING'].includes(row.status))) return;
    throw failure(409, 'QC_BATCH_LOCKED', 'Reagent lots may be linked only while this run can still execute.');
}
function withdrawnEvent(batch, inventoryLotId) {
    return batch.events.find(event => {
        if (event.type !== 'REAGENT_LOT_WITHDRAWN') return false;
        try { return JSON.parse(event.payload).inventoryLotId === inventoryLotId; } catch { return false; }
    });
}
function existingOutcome(batch, existing, role) {
    if (!existing) return null;
    if (withdrawnEvent(batch, existing.inventoryLotId)) throw failure(409, 'REAGENT_LOT_WITHDRAWN', 'This lot was withdrawn from this run and cannot be relinked.');
    if (existing.role !== role) throw failure(409, 'REAGENT_LOT_LINK_CONFLICT', 'The retained reagent-lot role cannot be changed.', { existingRole: existing.role });
    return { link: existing, created: false };
}
async function linkReagentLot(tx, batchId, actor, input = {}) {
    const performedBy = permission(actor), batch = await readQcRun(tx, batchId, actor);
    // #194 pin6077632542: state has precedence even for an identical retry.
    assertLinkState(batch);
    if (Object.keys(input).some(key => !['inventoryLotId', 'role'].includes(key)) ||
        typeof input.inventoryLotId !== 'string' || !input.inventoryLotId.trim() ||
        input.role != null && (typeof input.role !== 'string' || input.role.length > 120)) {
        throw failure(422, 'REAGENT_LOT_INPUT_INVALID', 'Select a lot and an optional short role.');
    }
    const inventoryLotId = input.inventoryLotId, role = input.role == null || input.role.trim() === '' ? null : input.role.trim();
    const where = { batchId_inventoryLotId: { batchId, inventoryLotId } };
    const retry = existingOutcome(batch, await tx.batchReagentLot.findUnique({ where }), role);
    if (retry) return retry;
    const lot = await tx.inventoryLot.findUnique({ where: { id: inventoryLotId } }), now = new Date();
    const [lab, lotLab] = await Promise.all([policyService.resolveLab(batch.labId, tx), lot && policyService.resolveLab(lot.labId, tx)]);
    if (!lot || !lab || lotLab?.id !== lab.id || lot.status !== 'AVAILABLE' || lot.expiryDate && new Date(lot.expiryDate) <= now) {
        throw failure(422, 'REAGENT_LOT_UNAVAILABLE', 'Select an available, unexpired lot in the run laboratory.');
    }
    let link;
    try {
        link = await tx.batchReagentLot.create({ data: { id: randomUUID(), batchId, labId: lab.id,
            inventoryLotId, role, linkedBy: performedBy, linkedAt: now } });
    } catch (error) {
        if (error.code !== 'P2002') throw error;
        const duplicate = existingOutcome(await readQcRun(tx, batchId, actor), await tx.batchReagentLot.findUnique({ where }), role);
        if (duplicate) return duplicate;
        throw failure(409, 'REAGENT_LOT_LINK_CONFLICT', 'The reagent link changed; reload before retrying.');
    }
    await tx.batchEvent.create({ data: { id: randomUUID(), batchId, type: 'REAGENT_LOT_LINKED', by: performedBy, at: now,
        payload: JSON.stringify({ linkId: link.id, inventoryLotId, role, linkedAt: now }) } });
    return { link, created: true };
}
async function withdrawReagentLot(tx, batchId, actor, input = {}) {
    const performedBy = permission(actor), batch = await readQcRun(tx, batchId, actor);
    if (batch.startedAt || batch.status !== 'OPEN') throw failure(409, 'QC_BATCH_LOCKED', 'Reagent lots cannot be withdrawn after first start.');
    if (Object.keys(input).some(key => !['inventoryLotId', 'reason'].includes(key)) || typeof input.inventoryLotId !== 'string' || !input.inventoryLotId.trim()) {
        throw failure(422, 'REAGENT_LOT_INPUT_INVALID', 'Select the retained reagent lot.');
    }
    const link = await tx.batchReagentLot.findUnique({ where: { batchId_inventoryLotId: { batchId, inventoryLotId: input.inventoryLotId } } });
    if (!link) throw failure(404, 'REAGENT_LOT_LINK_NOT_FOUND', 'The reagent lot is not linked to this run.');
    const existing = withdrawnEvent(batch, link.inventoryLotId);
    if (existing) return { event: existing, created: false };
    if (typeof input.reason !== 'string' || !input.reason.trim()) throw failure(400, 'REASON_REQUIRED', 'A reason is required to withdraw a reagent lot.');
    const now = new Date();
    const event = await tx.batchEvent.create({ data: { id: randomUUID(), batchId, type: 'REAGENT_LOT_WITHDRAWN', by: performedBy, at: now,
        payload: JSON.stringify({ linkId: link.id, inventoryLotId: link.inventoryLotId, reason: input.reason.trim(), withdrawnAt: now }) } });
    return { event, created: true };
}
module.exports = { linkReagentLot: auditRunCommand(linkReagentLot, 'REAGENT_LOT_LINK'),
    withdrawReagentLot: auditRunCommand(withdrawReagentLot, 'REAGENT_LOT_WITHDRAW') };
