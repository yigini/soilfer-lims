const crypto = require('crypto');
const { prepareIntake } = require('./intakePreparationService');
const { LOCKED_INTAKE_STATUSES } = require('./intakeValidationService');
const sampleCodes = require('./sampleCodeService');
const workItems = require('./intakeWorkItemService');
const { transitionSample, createSample } = require('./sampleStateService');
const { IntakeError } = require('./intakeErrors');
const profileIdentity = require('./profileIdentityService');
const scopeGuard = require('../utils/scopeGuard');

function requireTransaction(tx) {
    if (!tx || typeof tx.$transaction === 'function') throw new IntakeError(409, { code: 'INTAKE_TRANSACTION_REQUIRED', message: 'Intake requires the caller transaction.' });
}
async function commitPrepared(tx, plan, { consumeApproval = true } = {}) {
    requireTransaction(tx);
    const { user, body, now, updateData, nextStatus } = plan;
    let sample = plan.sample;
    if (plan.createData) sample = await createSample({ ...plan.createData,
        status: plan.responseKind === 'draft' ? 'DRAFT' : 'EXPECTED' }, user, { tx });
    const current = await tx.sample.findUnique({ where: { id: sample.id } });
    if (plan.responseKind === 'accepted' && current) await require('./sampleHoldService').assertNotHeld(tx, current);
    if (!current || current.updatedAt.getTime() !== sample.updatedAt.getTime()) throw new profileIdentity.ProfileReferenceConflictError('SOURCE_CHANGED');
    scopeGuard.ensureScope(user, current, { altLabField: 'assignedLab' });
    if (current.approvedAt || LOCKED_INTAKE_STATUSES.includes(current.status) && !(current.status === 'RECEIVED_REJECTED' && body.isResubmission === true && plan.responseKind !== 'draft')) throw new profileIdentity.ProfileReferenceConflictError('SAMPLE_LOCKED');
    if (current.status === 'RECEIVED' && plan.responseKind !== 'draft') {
        for (const field of ['receptionDate', 'receivedBy', 'receivingOfficerId', 'receivingOfficerName']) if (current[field] != null) updateData[field] = current[field];
        const reception = JSON.parse(updateData.receptionData || '{}');
        updateData.receptionData = JSON.stringify({ ...reception, receivedBy: updateData.receivedBy, receivedAt: updateData.receptionDate?.toISOString() });
    }
    let updated;
    if (plan.responseKind === 'draft') {
        updated = await transitionSample(current.id, nextStatus, user, 'Intake draft saved', updateData, tx, { action: 'INTAKE_DRAFT_SAVED' });
    } else {
        if (plan.responseKind === 'accepted') {
            const code = await sampleCodes.issuedCode(current, tx) || await sampleCodes.allocateSampleCode(tx, { labReference: user.labId, projectCode: updateData.projectCode || current.projectCode, issuedAt: now });
            updateData.labSampleCode = code;
            updateData.labId = code;
            const history = JSON.parse(updateData.history || '[]');
            history.push({ status: 'RECEIVED', changedBy: user.username, timestamp: now, note: `Intake process completed. Assigned Lab ID: ${code}` });
            history.push({ status: 'ACCEPTED', changedBy: user.username, timestamp: now, note: `Intake completed. Assigned Lab ID: ${code}` });
            updateData.history = JSON.stringify(history);
        }
        if (plan.responseKind === 'rejected') await require('./workItemStateService').cancelForIntakeRejection(tx,
            { sampleId: current.id, actor: user, reason: updateData.rejectionReason });
        updated = await transitionSample(current.id, nextStatus, user, plan.responseKind === 'rejected' ? `Sample rejected during intake: ${updateData.rejectionReason || ''}` : 'Intake completed at reception', updateData, tx);
        if (plan.responseKind === 'accepted') await workItems.generate(tx, updated, plan.workPlan, user);
        await tx.auditLog.create({ data: { id: crypto.randomUUID(), entity: 'SAMPLE', entityId: updated.id,
            action: plan.responseKind === 'rejected' ? 'SAMPLE_REJECTED' : 'SAMPLE_RECEIVED',
            details: plan.responseKind === 'rejected' ? `Sample intake rejected and non-conformance recorded: ${updated.rejectionReason || ''}` : 'Intake completed at reception',
            performedBy: user.username, timestamp: now, sampleId: updated.id, labId: updated.assignedLab } });
        if (consumeApproval) await consumeStoredApproval(tx, plan.approval);
    }
    return { sample: updated, response: responseFor(updated, plan) };
}
async function consumeStoredApproval(tx, approval) {
    if (!approval?.isStoredApprovalVerified || approval.mode !== 'STORED_APPROVAL') return;
    const approvalId = approval.approvalId || approval.amendmentId;
    const consumed = await tx.sampleAmendment.updateMany({ where: { id: String(approvalId), status: 'APPROVED', OR: [{ resolution: null }, { resolution: { not: 'CONSUMED' } }] }, data: { resolution: 'CONSUMED' } });
    if (consumed.count !== 1) throw new IntakeError(409, { code: 'APPROVAL_ALREADY_CONSUMED', message: 'The manager approval was consumed concurrently.' });
}
function responseFor(sample, plan) {
    if (plan.responseKind === 'draft') return { success: true, id: sample.id, originalId: sample.originalId, status: sample.status, message: 'Draft saved.' };
    if (plan.responseKind === 'rejected') return { success: true, rejected: true, id: sample.id, originalId: sample.originalId, status: sample.status, rejectionReason: sample.rejectionReason,
        assignedLab: sample.assignedLab || null, projectCode: sample.projectCode || null, projectId: sample.projectId || null,
        receptionDate: sample.receptionDate?.toISOString() || null, fieldMetadata: sample.fieldMetadata || null, receptionData: sample.receptionData || null,
        custodyHandoverAt: sample.custodyHandoverAt, custodyCarrierName: sample.custodyCarrierName, custodyTrackingNumber: sample.custodyTrackingNumber, receivingOfficerName: sample.receivingOfficerName,
        message: 'Sample intake non-conformance recorded. Status: RECEIVED_REJECTED.', sample };
    const fm = require('./intakeProfileService').parseFieldMetadata(sample.fieldMetadata);
    return { success: true, id: sample.id, originalId: sample.originalId, labId: sample.labId, labSampleCode: sample.labSampleCode, status: sample.status,
        receptionDate: sample.receptionDate?.toISOString() || null, custodyHandoverAt: sample.custodyHandoverAt?.toISOString() || null,
        collectionDate: fm.collectionDate || fm.samplingDate || fm.collection_date || fm.date || null,
        assignedLab: sample.assignedLab || plan.user.labId || null, projectCode: sample.projectCode || null, projectId: sample.projectId || null,
        fieldMetadata: sample.fieldMetadata || null, receptionData: sample.receptionData || null, message: 'Intake recorded.' };
}
async function acceptSample(tx, input, preparedPlan, options) {
    requireTransaction(tx);
    const plan = preparedPlan || await prepareIntake(tx, { ...input, body: { ...input.body, decision: 'ACCEPTED', isDraft: false } });
    if (plan.responseKind !== 'accepted') throw new IntakeError(409, { code: 'INTAKE_DECISION_INVALID', message: 'Acceptance requires an accepted intake plan.' });
    return commitPrepared(tx, plan, options);
}
async function rejectSample(tx, input, preparedPlan, options) {
    requireTransaction(tx);
    const plan = preparedPlan || await prepareIntake(tx, { ...input, body: { ...input.body, decision: 'REJECTED', isDraft: false } });
    if (plan.responseKind !== 'rejected') throw new IntakeError(409, { code: 'INTAKE_DECISION_INVALID', message: 'Rejection requires a rejected intake plan.' });
    return commitPrepared(tx, plan, options);
}
async function intake(tx, input) {
    requireTransaction(tx);
    if (input.body.isDraft) return commitPrepared(tx, await prepareIntake(tx, input));
    return ['REJECT', 'REJECTED'].includes(input.body.decision) ? rejectSample(tx, input) : acceptSample(tx, input);
}
async function receiveSample(tx, input) {
    requireTransaction(tx);
    return require('./intakeReceiptService').receiveSample(tx, input);
}
// Capture only the version before waiting for the write transaction. All
// validation still runs inside it; an intervening committed edit is refused.
async function snapshot(db, body = {}) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
    return db.sample.findFirst({ where: { OR: [{ id: String(body.sampleId || body.id || body.originalId || '') }, { originalId: String(body.originalId || '') }] }, select: { id: true, updatedAt: true } });
}
module.exports = { intake, receiveSample, acceptSample, rejectSample, prepareIntake, commitPrepared, responseFor, requireTransaction, consumeStoredApproval, snapshot };
