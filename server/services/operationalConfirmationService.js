'use strict';
const { randomUUID } = require('node:crypto');
const workflow = require('../workflowContract');
const checklists = require('../data/operationalChecklists.json');
const { hasPermission } = require('../config/roles');
const scopeGuard = require('../utils/scopeGuard');
const rules = require('./workflowStateRules');
const { transitionWorkItem } = require('./workItemStateService');
const { transitionSample } = require('./sampleStateService');
const evidence = require('./resultEvidenceService');
const policyService = require('./policyService');
const CommandReceiptService = require('./commandReceiptService');
const { broadcastToLab } = require('../wsServer');
const preparation = require('./preparationRecordService');
const { TransitionError } = rules;

function historyOf(item) {
    try {
        const history = typeof item.history === 'string' ? JSON.parse(item.history) : item.history || [];
        if (Array.isArray(history)) return history;
    } catch (_) { /* Refuse corrupt history without overwriting it. */ }
    throw new TransitionError('Stored operational history must be reviewed before changing it.', 409, 'WORKITEM_HISTORY_INVALID');
}

async function loadOperation(tx, actor, workItemId, verification = false) {
    const item = await tx.workItem.findUnique({ where: { id: workItemId }, include: { sample: true } });
    if (!item) throw new TransitionError('Work item not found.', 404, 'WORK_ITEM_NOT_FOUND');
    const sample = item.sample;
    if (!sample) throw new TransitionError('Sample not found.', 404, 'SAMPLE_NOT_FOUND');
    const analysis = (item.analysis || '').toUpperCase();
    if (!['DRYING', 'PREPARATION'].includes(analysis)) throw new TransitionError('This work item is not an operational gate.', 400, 'NOT_OPERATIONAL_GATE');
    if (!hasPermission(actor, verification ? 'APPROVE_RESULTS' : 'ENTER_RESULTS')) {
        throw new TransitionError('Operational confirmation/verification permission required.', 403, 'OPERATIONAL_PERMISSION_DENIED');
    }
    scopeGuard.ensureScope(actor, sample, { altLabField: 'assignedLab' });
    if (!verification && !hasPermission(actor, 'ASSIGN_WORK') && item.assignedTo && item.assignedTo !== actor.username) {
        throw new TransitionError('This work item is assigned to another technician.', 403, 'NOT_ASSIGNED_TO_ACTOR');
    }
    const sampleStatus = workflow.normalizeSampleState(sample.status);
    if (['EXPECTED', 'DRAFT'].includes(sampleStatus) || (!sample.receptionDate && !['ACCEPTED', 'PROCESSING', 'RECEIVED'].includes(sampleStatus))) {
        throw new TransitionError('Sample has not been physically received.', 409, 'SAMPLE_NOT_RECEIVED');
    }
    if (sampleStatus === 'RECEIVED_REJECTED') throw new TransitionError('Sample intake was rejected.', 409, 'SAMPLE_REJECTED');
    // #205 A21: preparation starts only after the sample is accepted.
    if (!verification && sampleStatus === 'RECEIVED') throw new TransitionError('Accept the sample before recording its preparation.', 409, 'SAMPLE_NOT_ACCEPTED');
    evidence.assertAmendable(sample);
    const gates = require('./gateEvidenceService');
    const gateEvidence = await gates.assertGateEvidence(tx, sample, analysis === 'PREPARATION' ? ['DRYING'] : [],
        { DRYING: 'DRYING_PREREQUISITE_FAILED' });
    return { item, sample, analysis, gateEvidence: gates.auditEvidence(gateEvidence) };
}

async function setGate(tx, sample, analysis, status, actor, reason) {
    const updates = { [evidence.GATE_FIELDS[analysis]]: status };
    const drying = updates.dryingStatus || sample.dryingStatus;
    const preparation = updates.preparationStatus || sample.preparationStatus;
    const current = workflow.normalizeSampleState(sample.status);
    const next = current === 'ACCEPTED' && drying === 'DONE' && preparation === 'DONE' ? 'PROCESSING' : current;
    return transitionSample(sample.id, next, actor, reason, updates, tx);
}

function broadcast(sample, actor, analysis, status, action) {
    try {
        broadcastToLab(sample.assignedLab || actor.labId, 'WORKITEM_UPDATE', {
            sampleIds: [sample.id], updatedBy: actor.username, analysis, status, action, count: 1
        });
    } catch (error) { console.error('[WS] Operational update broadcast failed:', error.message); }
}

class OperationalConfirmationService {
    static async confirmOperation({ actor, workItemId, checklist, observations, records, idempotencyKey, verificationRequired = false,
        expected, db = require('../prisma') }) {
        if (!actor) throw new TransitionError('Authentication required.', 401, 'UNAUTHORIZED');
        if (!workItemId) throw new TransitionError('workItemId is required.', 400, 'MISSING_WORK_ITEM_ID');
        if (typeof verificationRequired !== 'boolean') throw new TransitionError('Verification request must be a boolean.', 400, 'INVALID_VERIFICATION_REQUEST');
        if (idempotencyKey) {
            const existing = await CommandReceiptService.checkReceipt(idempotencyKey, 'CONFIRM_OPERATION', actor.username, workItemId);
            if (existing.isExisting && !existing.conflict) return { success: true, isDuplicate: true, ...existing.receipt.parsedOutcome };
            if (existing.conflict) throw new TransitionError('The receipt belongs to a different command.', 409, 'COMMAND_RECEIPT_CONFLICT');
        }
        const outcome = await rules.inTransaction(db, async tx => {
            const { item, sample, analysis, gateEvidence } = await loadOperation(tx, actor, workItemId);
            const definition = checklists[analysis];
            if (!definition) throw new TransitionError('Operational checklist definition missing.', 409, 'CHECKLIST_DEF_MISSING');
            if (!Array.isArray(checklist) || checklist.length !== definition.steps.length) {
                throw new TransitionError(`Checklist requires ${definition.steps.length} verified steps.`, 422, 'INVALID_CHECKLIST_LENGTH');
            }
            if (!checklist.every(value => value === true)) throw new TransitionError('All procedural checklist steps must be verified.', 422, 'CHECKLIST_INCOMPLETE');
            const policy = await policyService.resolve(sample.assignedLab || actor.labId, 'gate.verificationRequired', { analysisCode: analysis, db: tx });
            const requiresVerification = policy.value || verificationRequired === true;
            const status = requiresVerification ? 'AWAITING_VERIFICATION' : 'COMPLETED';
            if (requiresVerification && sample[evidence.GATE_FIELDS[analysis]] === 'DONE') {
                throw new TransitionError('Revert the completed gate with a reason before a new verification attempt.', 409, 'GATE_ALREADY_DONE');
            }
            const now = new Date(), receiptId = `REC-OPS-${randomUUID()}`;
            const prepared = await preparation.validateRecords(tx, { gate: analysis, sample, records, now });
            const history = historyOf(item);
            history.push({ status, action: 'OPERATION_CONFIRMED', checklistRevision: definition.revision,
                confirmedBy: actor.username, timestamp: now.toISOString(), receiptId, policyVersion: policy.version,
                verificationPolicy: policy.value, verificationRequested: verificationRequired, verificationRequired: requiresVerification });
            const updates = { completedAt: now, history: JSON.stringify(history) };
            if (!item.assignedTo && !hasPermission(actor, 'ASSIGN_WORK')) updates.assignedTo = actor.username;
            await transitionWorkItem(item.id, status, actor, 'Operational checklist confirmed', updates, tx, {
                action: 'OPERATION_CONFIRMED', verificationRequired: requiresVerification, expected, conflictCode: 'VERSION_CONFLICT',
                audit: { details: JSON.stringify({ analysis, receiptId, checklistRevision: definition.revision,
                    policyVersion: policy.version, verificationPolicy: policy.value, verificationRequired: requiresVerification, ...gateEvidence }) }
            });
            const written = await preparation.write(tx, prepared, { sampleId: sample.id, workItemId: item.id, receiptId, actor });
            const payload = { kind: 'operational-checklist-v1', analysis, checklist, checks: checklist, steps: definition.steps,
                observations: observations || null, recordedBy: actor.username, recordedAt: now.toISOString(), receiptId,
                schemaVersion: definition.revision || 'operational-checklist-v1',
                preparationRecords: written.map(preparation.summary), requiredSteps: prepared.required };
            const updatedItem = await require('./resultWriteService').writeNonMeasurementSummary(tx, item,
                { kind: payload.kind, text: JSON.stringify(payload), actor });
            await tx.workItemDraft.deleteMany({ where: { workItemId: item.id } });
            const updatedSample = requiresVerification ? sample : await setGate(tx, sample, analysis, 'DONE', actor, 'Drying and preparation completed');
            const receipt = { receiptId, commandType: 'CONFIRM_OPERATION', analysis, workItemId: item.id, sampleId: sample.id,
                sampleLabId: sample.labId, confirmedBy: actor.username, confirmedAt: now.toISOString(), revision: definition.revision,
                status, gatePassed: !requiresVerification, policyVersion: policy.version };
            if (idempotencyKey) await CommandReceiptService.recordReceipt(tx, { idempotencyKey, commandType: 'CONFIRM_OPERATION',
                targetResource: item.id, actor: actor.username, status: 'SUCCESS', outcome: { receipt, workItem: updatedItem, sample: updatedSample } });
            return { success: true, receipt, workItem: updatedItem, sample: updatedSample };
        });
        if (typeof db.$transaction === 'function') broadcast(outcome.sample, actor, outcome.receipt.analysis, outcome.workItem.status, 'OPERATION_CONFIRMED');
        return outcome;
    }

    static async verifyOperation({ actor, workItemId, decision, note, db = require('../prisma') }) {
        if (!actor) throw new TransitionError('Authentication required.', 401, 'UNAUTHORIZED');
        if (!workItemId) throw new TransitionError('workItemId is required.', 400, 'MISSING_WORK_ITEM_ID');
        if (!workflow.REVIEW_DECISION_LIST.includes(decision)) throw new TransitionError('Unknown operational review decision.', 400, 'INVALID_REVIEW_DECISION');
        const outcome = await rules.inTransaction(db, async tx => {
            const { item, sample, analysis } = await loadOperation(tx, actor, workItemId, true);
            if (item.status !== 'AWAITING_VERIFICATION') throw new TransitionError('Only work awaiting verification can be verified.', 409, 'WORKITEM_NOT_AWAITING_VERIFICATION');
            if (decision !== 'ACCEPT' && sample[evidence.GATE_FIELDS[analysis]] === 'DONE') {
                throw new TransitionError('A completed gate requires the reasoned revert workflow.', 409, 'GATE_ALREADY_DONE');
            }
            const now = new Date(), status = decision === 'ACCEPT' ? 'COMPLETED' : 'REPEAT_REQUIRED';
            const history = historyOf(item);
            history.push({ status, action: 'OPERATION_VERIFIED', decision, verifiedBy: actor.username, timestamp: now.toISOString(), note: note || null });
            await transitionWorkItem(item.id, status, actor, note || 'Operational procedure verification', {
                reviewedBy: actor.username, reviewedAt: now, history: JSON.stringify(history)
            }, tx, { action: 'OPERATION_VERIFIED', decision });
            await tx.reviewDecision.create({ data: {
                id: randomUUID(), sampleId: sample.id, workItemId: item.id, decision: decision === 'ACCEPT' ? 'ACCEPT' : 'RETURN',
                reason: note || 'Operational procedure verification', reviewerId: actor.id || actor.username,
                reviewerName: actor.username, authorization: actor.role, policyVersion: 'operational-v1', createdAt: now
            } });
            const updatedSample = await setGate(tx, sample, analysis, decision === 'ACCEPT' ? 'DONE' : 'PENDING', actor, note || 'Operational gate verified');
            return { success: true, decision, workItemId: item.id, sampleId: sample.id, analysis, status, sample: updatedSample };
        });
        if (typeof db.$transaction === 'function') broadcast(outcome.sample, actor, outcome.analysis, outcome.status, 'OPERATION_VERIFIED');
        return outcome;
    }
}

module.exports = OperationalConfirmationService;
