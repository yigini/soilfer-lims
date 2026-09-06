'use strict';

const prisma = require('../prisma');
const workflow = require('../workflowContract');
const operationalChecklists = require('../data/operationalChecklists.json');
const CommandReceiptService = require('./commandReceiptService');
const scopeGuard = require('../utils/scopeGuard');
const { broadcastToLab } = require('../wsServer');

/**
 * Operational Confirmation Service
 * Handles routine operational confirmation for DRYING and PREPARATION gates
 * per Section 2 of implementation-plan.md and Acceptance criteria A01-A08.
 */
class OperationalConfirmationService {
    /**
     * Confirms an operational checklist task (DRYING / PREPARATION).
     * Routine policy: Confirmed by technician -> immutable operational receipt -> sample gate flag DONE.
     * Optional SOP policy: verificationRequired -> AWAITING_VERIFICATION -> manager verification required.
     */
    static async confirmOperation({ actor, workItemId, checklist, observations, idempotencyKey, runId, verificationRequired = false }) {
        if (!workItemId) {
            throw { status: 400, message: 'workItemId is required', code: 'MISSING_WORK_ITEM_ID' };
        }
        if (!actor) {
            throw { status: 401, message: 'Authentication required', code: 'UNAUTHORIZED' };
        }

        // 1. Idempotency Check
        if (idempotencyKey) {
            const receiptCheck = await CommandReceiptService.checkReceipt(
                idempotencyKey,
                'CONFIRM_OPERATION',
                actor.username,
                workItemId
            );
            if (receiptCheck.isExisting && !receiptCheck.conflict) {
                return {
                    success: true,
                    isDuplicate: true,
                    receipt: receiptCheck.receipt?.parsedOutcome?.receipt,
                    workItem: receiptCheck.receipt?.parsedOutcome?.workItem,
                    sample: receiptCheck.receipt?.parsedOutcome?.sample
                };
            }
        }

        // 2. Fetch WorkItem and Sample
        const item = await prisma.workItem.findUnique({
            where: { id: workItemId },
            include: { sample: true }
        });

        if (!item) {
            throw { status: 404, message: `Work item '${workItemId}' not found`, code: 'WORK_ITEM_NOT_FOUND' };
        }

        const sample = item.sample;
        if (!sample) {
            throw { status: 404, message: `Sample not found for work item '${workItemId}'`, code: 'SAMPLE_NOT_FOUND' };
        }

        const analysisUpper = (item.analysis || '').toUpperCase();
        if (!['DRYING', 'PREPARATION'].includes(analysisUpper)) {
            throw {
                status: 400,
                message: `Work item '${workItemId}' is '${item.analysis}', not an operational gate (DRYING/PREPARATION)`,
                code: 'NOT_OPERATIONAL_GATE'
            };
        }

        // 3. Authorization & Scope Check
        try {
            scopeGuard.ensureScope(actor, sample, { labField: 'labId', altLabField: 'assignedLab' });
        } catch (e) {
            throw { status: 403, message: 'Access denied: Sample outside your laboratory scope', code: 'ACCESS_DENIED_LAB' };
        }

        if (actor.role === 'LAB_TECHNICIAN' && item.assignedTo && item.assignedTo !== actor.username) {
            throw {
                status: 403,
                message: `Work item is assigned to ${item.assignedTo}, not ${actor.username}`,
                code: 'NOT_ASSIGNED_TO_ACTOR'
            };
        }

        // 4. Sample lifecycle state check
        if (['EXPECTED', 'DRAFT'].includes(sample.status) || (!sample.receptionDate && !['ACCEPTED', 'PROCESSING', 'RECEIVED'].includes(sample.status))) {
            throw { status: 409, message: 'Sample has not been physically received', code: 'SAMPLE_NOT_RECEIVED' };
        }
        if (['RECEIVED_REJECTED', 'REJECTED'].includes(sample.status)) {
            throw { status: 409, message: 'Sample intake was rejected', code: 'SAMPLE_REJECTED' };
        }
        if (['DISPOSED', 'ARCHIVED'].includes(sample.status)) {
            throw { status: 409, message: 'Sample is archived or disposed', code: 'SAMPLE_CLOSED' };
        }

        // 5. Gate Prerequisites
        if (analysisUpper === 'PREPARATION') {
            if (sample.dryingStatus !== 'DONE') {
                throw {
                    status: 409,
                    message: 'Air drying must be completed before sample preparation',
                    code: 'DRYING_PREREQUISITE_FAILED'
                };
            }
        }

        // 6. Validate Checklist Payload
        const checklistDef = operationalChecklists[analysisUpper];
        if (!checklistDef) {
            throw { status: 500, message: `Checklist definition for ${analysisUpper} not found`, code: 'CHECKLIST_DEF_MISSING' };
        }

        if (!Array.isArray(checklist) || checklist.length !== checklistDef.steps.length) {
            throw {
                status: 422,
                message: `Checklist requires exactly ${checklistDef.steps.length} verified steps`,
                code: 'INVALID_CHECKLIST_LENGTH'
            };
        }

        const allChecked = checklist.every(v => v === true);
        if (!allChecked) {
            throw {
                status: 422,
                message: 'All procedural checklist steps must be verified before confirmation',
                code: 'CHECKLIST_INCOMPLETE'
            };
        }

        // 7. Prepare Evidence Record & Durable Receipt
        const now = new Date();
        const receiptId = `REC-OPS-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

        const evidencePayload = {
            kind: 'operational-checklist-v1',
            analysis: analysisUpper,
            checklist: checklist,
            steps: checklistDef.steps,
            observations: observations || null,
            recordedBy: actor.username,
            recordedAt: now.toISOString(),
            receiptId,
            schemaVersion: checklistDef.revision || 'operational-checklist-v1'
        };

        const existingHistory = typeof item.history === 'string'
            ? JSON.parse(item.history)
            : (item.history || []);

        const targetStatus = verificationRequired
            ? 'AWAITING_VERIFICATION'
            : workflow.WORK_ITEM_STATES.COMPLETED;

        existingHistory.push({
            status: targetStatus,
            action: 'OPERATION_CONFIRMED',
            checklistRevision: checklistDef.revision,
            confirmedBy: actor.username,
            timestamp: now.toISOString(),
            receiptId
        });

        const workItemUpdate = {
            status: targetStatus,
            result: JSON.stringify(evidencePayload),
            completedAt: now,
            version: { increment: 1 },
            history: JSON.stringify(existingHistory)
        };

        // If unassigned technician confirms, self-assign
        if (!item.assignedTo && actor.role === 'LAB_TECHNICIAN') {
            workItemUpdate.assignedTo = actor.username;
        }

        const sampleGateUpdate = {};
        if (!verificationRequired) {
            if (analysisUpper === 'DRYING') {
                sampleGateUpdate.dryingStatus = 'DONE';
            } else if (analysisUpper === 'PREPARATION') {
                sampleGateUpdate.preparationStatus = 'DONE';
            }
        }

        // Clean up any stale draft for this item
        const operations = [
            prisma.workItem.update({
                where: { id: workItemId },
                data: workItemUpdate
            }),
            prisma.workItemDraft.deleteMany({
                where: { workItemId }
            }),
            prisma.auditLog.create({
                data: {
                    id: `audit-ops-${workItemId}-${Date.now()}`,
                    entity: 'WORKITEM',
                    entityId: workItemId,
                    action: 'OPERATION_CONFIRMED',
                    details: `${actor.username} confirmed ${analysisUpper} (${checklistDef.revision}) with receipt ${receiptId}`,
                    performedBy: actor.username,
                    timestamp: now,
                    sampleId: String(item.sampleId),
                    analysisCode: analysisUpper
                }
            })
        ];

        if (Object.keys(sampleGateUpdate).length > 0) {
            operations.push(
                prisma.sample.update({
                    where: { id: String(item.sampleId) },
                    data: sampleGateUpdate
                })
            );
        }

        // 8. Atomic Execution
        const [updatedItem] = await prisma.$transaction(operations);

        const updatedSample = Object.keys(sampleGateUpdate).length > 0
            ? await prisma.sample.findUnique({ where: { id: String(item.sampleId) } })
            : sample;

        const receipt = {
            receiptId,
            commandType: 'CONFIRM_OPERATION',
            analysis: analysisUpper,
            workItemId,
            sampleId: sample.id,
            sampleLabId: sample.labId,
            confirmedBy: actor.username,
            confirmedAt: now.toISOString(),
            revision: checklistDef.revision,
            status: targetStatus,
            gatePassed: !verificationRequired
        };

        // Record command receipt for idempotency
        if (idempotencyKey) {
            await CommandReceiptService.recordReceipt(null, {
                idempotencyKey,
                commandType: 'CONFIRM_OPERATION',
                targetResource: workItemId,
                actor: actor.username,
                status: 'SUCCESS',
                outcome: { receipt, workItem: updatedItem, sample: updatedSample }
            }).catch(e => console.warn('[OPS_RECEIPT_WARN]', e.message));
        }

        // Broadcast real-time event
        try {
            const targetLab = actor.labId || sample.assignedLab || sample.labId;
            broadcastToLab(targetLab, 'WORKITEM_UPDATE', {
                sampleIds: [String(sample.id)],
                updatedBy: actor.username,
                action: 'OPERATION_CONFIRMED',
                analysis: analysisUpper,
                status: targetStatus,
                count: 1
            });
        } catch (wsErr) {
            console.error('[WS] Failed to broadcast WORKITEM_UPDATE (ops):', wsErr);
        }

        return {
            success: true,
            receipt,
            workItem: updatedItem,
            sample: updatedSample
        };
    }

    /**
     * Manager verification of operational gate (when verificationRequired was configured or for retrospective verification).
     */
    static async verifyOperation({ actor, workItemId, decision, note, idempotencyKey }) {
        if (!workItemId) throw { status: 400, message: 'workItemId is required' };
        if (!actor) throw { status: 401, message: 'Authentication required' };
        if (!['LAB_MANAGER', 'SUPER_ADMIN', 'MASTER_USER'].includes(actor.role)) {
            throw { status: 403, message: 'Only laboratory managers can verify operational procedures' };
        }

        if (!['ACCEPT', 'REJECT'].includes(decision)) {
            throw { status: 400, message: "decision must be 'ACCEPT' or 'REJECT'" };
        }

        const item = await prisma.workItem.findUnique({
            where: { id: workItemId },
            include: { sample: true }
        });

        if (!item) throw { status: 404, message: 'Work item not found' };
        const sample = item.sample;

        const analysisUpper = (item.analysis || '').toUpperCase();
        if (!['DRYING', 'PREPARATION'].includes(analysisUpper)) {
            throw { status: 400, message: 'Only operational gates can be verified through this endpoint' };
        }

        scopeGuard.ensureScope(actor, sample, { labField: 'labId', altLabField: 'assignedLab' });

        const now = new Date();
        const existingHistory = typeof item.history === 'string' ? JSON.parse(item.history) : (item.history || []);

        const targetWiStatus = decision === 'ACCEPT' ? 'COMPLETED' : 'REANALYSIS_REQUIRED';
        existingHistory.push({
            status: targetWiStatus,
            action: 'OPERATION_VERIFIED',
            decision,
            verifiedBy: actor.username,
            timestamp: now.toISOString(),
            note: note || null
        });

        const sampleUpdates = {};
        if (decision === 'ACCEPT') {
            if (analysisUpper === 'DRYING') sampleUpdates.dryingStatus = 'DONE';
            if (analysisUpper === 'PREPARATION') sampleUpdates.preparationStatus = 'DONE';
        } else {
            if (analysisUpper === 'DRYING') sampleUpdates.dryingStatus = 'PENDING';
            if (analysisUpper === 'PREPARATION') sampleUpdates.preparationStatus = 'PENDING';
        }

        const reviewDecisionId = `RD-OPS-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

        const operations = [
            prisma.workItem.update({
                where: { id: workItemId },
                data: {
                    status: targetWiStatus,
                    reviewedBy: actor.username,
                    reviewedAt: now,
                    history: JSON.stringify(existingHistory),
                    version: { increment: 1 }
                }
            }),
            prisma.reviewDecision.create({
                data: {
                    id: reviewDecisionId,
                    sampleId: String(sample.id),
                    workItemId: item.id,
                    decision: decision === 'ACCEPT' ? 'ACCEPT' : 'RETURN',
                    reason: note || 'Operational procedure verification',
                    reviewerId: actor.id || actor.username,
                    reviewerName: actor.username,
                    authorization: actor.role,
                    policyVersion: 'operational-v1',
                    createdAt: now
                }
            }),
            prisma.auditLog.create({
                data: {
                    id: `audit-op-ver-${workItemId}-${Date.now()}`,
                    entity: 'WORKITEM',
                    entityId: workItemId,
                    action: decision === 'ACCEPT' ? 'OPERATION_VERIFIED' : 'OPERATION_REJECTED',
                    details: `${actor.username} verified ${analysisUpper} with decision ${decision}${note ? `: ${note}` : ''}`,
                    performedBy: actor.username,
                    timestamp: now,
                    sampleId: String(sample.id),
                    analysisCode: analysisUpper
                }
            })
        ];

        if (Object.keys(sampleUpdates).length > 0) {
            operations.push(prisma.sample.update({
                where: { id: String(sample.id) },
                data: sampleUpdates
            }));
        }

        await prisma.$transaction(operations);

        const targetLab = actor.labId || sample.assignedLab || sample.labId;
        try {
            broadcastToLab(targetLab, 'WORKITEM_UPDATE', {
                sampleIds: [String(sample.id)],
                updatedBy: actor.username,
                action: 'OPERATION_VERIFIED',
                analysis: analysisUpper,
                status: targetWiStatus,
                count: 1
            });
        } catch (wsErr) {
            console.error('[WS] Failed to broadcast WORKITEM_UPDATE (verify):', wsErr);
        }

        return {
            success: true,
            decision,
            workItemId,
            sampleId: sample.id,
            status: targetWiStatus
        };
    }
}

module.exports = OperationalConfirmationService;
