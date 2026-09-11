'use strict';

const prisma = require('../prisma');
const CommandReceiptService = require('./commandReceiptService');
const OperationalConfirmationService = require('./operationalConfirmationService');
const { parseDeterminationValue, validateValue, validateTexture } = require('./workbenchValidationService');
const { canRecord } = require('./workEligibility');
const { hasPermission } = require('../config/roles');
const { randomUUID } = require('crypto');

/**
 * SoilFER LIMS - Server-side Synchronization Service
 * Atomic, idempotent domain command processing boundary for offline-capable clients.
 */
class SyncService {
    /**
     * Process a batch of sync operations in causal sequence
     * @param {object} user - Authenticated user session
     * @param {object} batch - { protocolVersion, deviceId, operations }
     * @returns {Promise<{ protocolVersion: number, serverTimestamp: string, receipts: Array }>}
     */
    static async processSyncBatch(user, { protocolVersion = 1, deviceId, operations = [] }) {
        if (!user) {
            throw { status: 401, message: 'Authentication required for synchronization', code: 'UNAUTHORIZED' };
        }
        if (!deviceId) {
            throw { status: 400, message: 'deviceId is required for synchronization', code: 'MISSING_DEVICE_ID' };
        }

        const receipts = [];
        const serverTimestamp = new Date().toISOString();

        for (const op of operations) {
            const opId = op.operationId || op.id;
            const workItemId = op.target?.workItemId || op.workItemId;
            const targetResource = workItemId || op.target?.sampleId || opId;

            try {
                // 1. Idempotency & Deduplication Check
                if (opId) {
                    const check = await CommandReceiptService.checkReceipt(
                        opId,
                        op.type,
                        user.username,
                        targetResource
                    );

                    if (check.isExisting) {
                        if (check.conflict) {
                            receipts.push({
                                operationId: opId,
                                status: 'CONFLICT',
                                reason: 'Idempotency key reused for different command parameters or target.',
                                receiptId: check.receipt?.id,
                                serverTimestamp
                            });
                            continue;
                        }

                        // Duplicate already applied successfully
                        receipts.push({
                            operationId: opId,
                            status: 'DUPLICATE_APPLIED',
                            receiptId: check.receipt?.id,
                            serverTimestamp,
                            outcome: check.receipt?.parsedOutcome
                        });
                        continue;
                    }
                }

                // 2. Dispatch Typed Command
                let outcome = null;
                let savedReceiptId = null;

                if (op.type === 'CONFIRM_OPERATION') {
                    // Operational Checklist Task (Drying / Preparation)
                    const confirmRes = await OperationalConfirmationService.confirmOperation({
                        actor: user,
                        workItemId: workItemId,
                        checklist: op.payload?.checklist,
                        observations: op.payload?.observations,
                        idempotencyKey: opId
                    });
                    outcome = confirmRes;
                    if (opId) {
                        const r = await prisma.commandReceipt.findUnique({ where: { idempotencyKey: opId } });
                        savedReceiptId = r?.id;
                    }
                    if (!savedReceiptId && confirmRes?.receipt?.receiptId) {
                        savedReceiptId = confirmRes.receipt.receiptId;
                    }
                } else if (op.type === 'SAVE_WORK_DRAFT') {
                    // Technician draft save
                    if (!hasPermission(user, 'ENTER_RESULTS')) {
                        receipts.push({
                            operationId: opId,
                            status: 'REJECTED',
                            code: 'PERMISSION_DENIED',
                            reason: 'User lacks ENTER_RESULTS permission for work draft'
                        });
                        continue;
                    }

                    if (!workItemId) throw new Error('Target workItemId is required');

                    const item = await prisma.workItem.findUnique({
                        where: { id: workItemId },
                        include: { sample: true }
                    });
                    if (!item) throw new Error(`Work item '${workItemId}' not found`);

                    // Check work item lab scope
                    const workLab = item.assignedLab || item.labId || item.sample?.assignedLab || item.sample?.labId;
                    if (user.role !== 'SUPER_ADMIN' && (!user.labId || !workLab || user.labId !== workLab)) {
                        receipts.push({
                            operationId: opId,
                            status: 'REJECTED',
                            code: 'WORK_ITEM_OUTSIDE_LAB_SCOPE',
                            reason: 'Cross-lab or unassigned lab draft save forbidden'
                        });
                        continue;
                    }

                    // Technician assignment check
                    if (user.role === 'LAB_TECHNICIAN' && item.assignedTo && item.assignedTo !== user.username) {
                        receipts.push({
                            operationId: opId,
                            status: 'REJECTED',
                            code: 'NOT_ASSIGNED_TECHNICIAN',
                            reason: 'Cannot save draft on work assigned to another technician'
                        });
                        continue;
                    }

                    // Store draft in database atomically with CommandReceipt (LG-14, P26)
                    let draftRecord = null;
                    let savedReceipt = null;
                    const draftVal = op.payload?.value !== undefined ? String(op.payload.value) : (op.payload?.result !== undefined ? String(op.payload.result) : (op.payload?.draftValue !== undefined ? String(op.payload.draftValue) : null));

                    await prisma.$transaction(async (tx) => {
                        if (tx.workItemDraft) {
                            draftRecord = await tx.workItemDraft.upsert({
                                where: { workItemId },
                                create: {
                                    workItemId,
                                    sampleId: item.sampleId,
                                    userId: user.username,
                                    labId: workLab || user.labId,
                                    analysis: item.analysis,
                                    value: draftVal,
                                    values: op.payload?.values ? JSON.stringify(op.payload.values) : null,
                                    checks: op.payload?.checks ? JSON.stringify(op.payload.checks) : null,
                                    baseVersion: op.baseVersion || item.version || 0,
                                    notes: op.payload?.notes || null
                                },
                                update: {
                                    value: draftVal !== null ? draftVal : undefined,
                                    values: op.payload?.values ? JSON.stringify(op.payload.values) : undefined,
                                    checks: op.payload?.checks ? JSON.stringify(op.payload.checks) : undefined,
                                    notes: op.payload?.notes !== undefined ? op.payload.notes : undefined,
                                    draftVersion: { increment: 1 },
                                    updatedAt: new Date()
                                }
                            });
                        } else {
                            draftRecord = await tx.workItem.update({
                                where: { id: workItemId },
                                data: { updatedAt: new Date() }
                            });
                        }

                        savedReceipt = await CommandReceiptService.recordReceipt(tx, {
                            idempotencyKey: opId,
                            commandType: op.type,
                            targetResource: workItemId,
                            actor: user.username,
                            status: 'SUCCESS',
                            outcome: { saved: true, workItemId, draftId: draftRecord?.id }
                        });
                    });

                    outcome = { saved: true, workItemId, draftId: draftRecord?.id };
                    savedReceiptId = savedReceipt?.id;
                } else if (op.type === 'COMPLETE_WORK') {
                    // Scientific determination completion
                    if (!workItemId) throw new Error('Target workItemId is required');

                    // Check user permissions (LG-14, P25)
                    if (!hasPermission(user, 'ENTER_RESULTS')) {
                        receipts.push({
                            operationId: opId,
                            status: 'REJECTED',
                            code: 'PERMISSION_DENIED',
                            reason: 'User lacks ENTER_RESULTS permission for work completion'
                        });
                        continue;
                    }

                    const item = await prisma.workItem.findUnique({
                        where: { id: workItemId },
                        include: { sample: true }
                    });
                    if (!item) throw new Error(`Work item '${workItemId}' not found`);

                    // Lab isolation check (LG-14, P25)
                    const workLab = item.assignedLab || item.labId || item.sample?.assignedLab || item.sample?.labId;
                    if (user.role !== 'SUPER_ADMIN' && (!user.labId || !workLab || user.labId !== workLab)) {
                        receipts.push({
                            operationId: opId,
                            status: 'REJECTED',
                            code: 'WORK_ITEM_OUTSIDE_LAB_SCOPE',
                            reason: 'Cross-lab work completion forbidden'
                        });
                        continue;
                    }

                    // Method kinds:
                    // 1. Operational gates (DRYING / PREPARATION) require checklist confirmation via CONFIRM_OPERATION
                    const isOperational = ['DRYING', 'PREPARATION'].includes(item.analysis);
                    if (isOperational) {
                        receipts.push({
                            operationId: opId,
                            status: 'REJECTED',
                            code: 'OPERATIONAL_GATE_REJECTED',
                            reason: 'Preparation and drying gates require checklist confirmation via CONFIRM_OPERATION, not scalar result entry'
                        });
                        continue;
                    }

                    // 2. Reject scalar values for spectral analyses
                    const isSpectral = ['SPEC_MIR', 'SPEC_VIS_NIR', 'SPEC_NIR', 'SPEC_FTIR'].includes(item.analysis) ||
                        (item.analysis && item.analysis.startsWith('SPEC_')) ||
                        item.category === 'Spectroscopy';
                    if (isSpectral) {
                        receipts.push({
                            operationId: opId,
                            status: 'REJECTED',
                            code: 'SPECTRAL_SCALAR_REJECTED',
                            reason: 'Mid-Infrared and NIR spectroscopy require spectrum upload or scan linkage; scalar value entry is not permitted'
                        });
                        continue;
                    }

                    // Parity with canonical workEligibility.canRecord service
                    const eligibility = canRecord(item, item.sample, user);
                    if (!eligibility.allowed) {
                        let code = 'WORK_NOT_ELIGIBLE';
                        const firstBlocker = eligibility.reason || (eligibility.blockers && eligibility.blockers[0]) || '';
                        if (firstBlocker.includes('NOT_ASSIGNED_TO_ACTOR')) {
                            code = 'NOT_ASSIGNED_TECHNICIAN';
                        } else if (firstBlocker.includes('DRYING_PENDING') || firstBlocker.includes('PREPARATION_PENDING') || firstBlocker.includes('NOT_RECEIVED')) {
                            code = 'PREREQUISITE_INCOMPLETE';
                        } else if (firstBlocker.includes('ALREADY_RECORDED') || firstBlocker.includes('SUBMITTED') || firstBlocker.includes('ACCEPTED') || firstBlocker.includes('OMITTED')) {
                            code = 'TERMINAL_STATE_REJECTED';
                        } else if (firstBlocker.includes('SAMPLE_REJECTED') || firstBlocker.includes('SAMPLE_CLOSED')) {
                            code = 'SAMPLE_STATE_INVALID';
                        }
                        receipts.push({
                            operationId: opId,
                            status: 'REJECTED',
                            code,
                            reason: firstBlocker
                        });
                        continue;
                    }

                    // Work item state check (LG-14, P25)
                    if (['ACCEPTED', 'APPROVED'].includes(item.status) || (item.sample && ['APPROVED', 'RELEASED'].includes(item.sample.status))) {
                        receipts.push({
                            operationId: opId,
                            status: 'REJECTED',
                            code: 'TERMINAL_STATE_REJECTED',
                            reason: `Cannot complete work item in terminal/approved state '${item.status}'. Use canonical amendment process.`
                        });
                        continue;
                    }

                    // Check for version conflict if baseVersion supplied
                    if (op.baseVersion !== undefined && item.version !== undefined && item.version > op.baseVersion) {
                        receipts.push({
                            operationId: opId,
                            status: 'CONFLICT',
                            reason: `Work item was modified on server (server version ${item.version}, client base version ${op.baseVersion}).`,
                            serverVersion: item.version,
                            serverState: { status: item.status, currentResult: item.result }
                        });
                        continue;
                    }

                    // Validate result value
                    const rawVal = op.payload?.value !== undefined ? op.payload.value : op.payload?.result;
                    if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
                        receipts.push({
                            operationId: opId,
                            status: 'REJECTED',
                            code: 'EMPTY_VALUE',
                            reason: 'Result value is required'
                        });
                        continue;
                    }

                    const parsed = parseDeterminationValue(rawVal);
                    if (!parsed.isValid && !parsed.isCensored) {
                        throw new Error(`Invalid determination value: ${rawVal}`);
                    }

                    let savedReceipt = null;
                    const newResultId = `res-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
                    const repNo = (op.payload?.replicateNo !== undefined && op.payload?.replicateNo !== null) ? Number(op.payload.replicateNo) : 1;
                    const validBasis = ['AIR_DRY', 'OVEN_DRY', 'FIELD_MOIST'].includes(op.payload?.basis) ? op.payload.basis : 'AIR_DRY';
                    const now = new Date();

                    // Execute atomic record transaction
                    await prisma.$transaction(async (tx) => {
                        // Supersede prior active result for this sample & parameter for this replicateNo
                        await tx.result.updateMany({
                            where: {
                                sampleId: item.sampleId,
                                param: item.analysis,
                                replicateNo: repNo,
                                isCurrent: true
                            },
                            data: {
                                isCurrent: false,
                                supersededBy: newResultId
                            }
                        });

                        // Create canonical Result record
                        await tx.result.create({
                            data: {
                                id: newResultId,
                                sampleId: item.sampleId,
                                param: item.analysis,
                                value: String(rawVal),
                                numericValue: parsed.normalizedValue !== undefined ? parsed.normalizedValue : null,
                                unit: op.payload?.unit || null,
                                flags: JSON.stringify(op.payload?.flags || []),
                                isValid: parsed.isValid,
                                censoring: parsed.censoring || 'NONE',
                                basis: validBasis,
                                provenance: op.payload?.provenance || 'MEASURED',
                                methodologyId: item.methodologyId || null,
                                replicateNo: repNo,
                                isCurrent: true,
                                enteredBy: user.username,
                                analysedAt: now,
                                equipmentId: op.payload?.equipmentId || item.equipmentId || null,
                                batchId: item.batchId || null,
                                createdAt: now,
                                updatedAt: now
                            }
                        });

                        // Create WorkAttempt record
                        const attemptId = `att-${item.id}-${Date.now()}`;
                        await tx.workAttempt.create({
                            data: {
                                id: attemptId,
                                workItemId,
                                attemptNo: 1,
                                author: user.username,
                                authorName: user.name || user.username,
                                materialAliquot: op.payload?.aliquot || 'FINE_EARTH_2MM',
                                instrumentId: op.payload?.equipmentId || item.equipmentId || null,
                                qcBatchId: item.batchId || null,
                                version: (item.version || 0) + 1,
                                status: 'RECORDED',
                                evidenceData: JSON.stringify({
                                    rawValue: String(rawVal),
                                    normalizedValue: parsed.normalizedValue,
                                    qualifier: parsed.censoring !== 'NONE' ? parsed.censoring : null,
                                    recordedAt: now.toISOString(),
                                    resultId: newResultId
                                }),
                                createdAt: now,
                                updatedAt: now
                            }
                        });

                        // Clean up working draft if present
                        if (tx.workItemDraft) {
                            await tx.workItemDraft.deleteMany({ where: { workItemId } });
                        }

                        // Update WorkItem
                        await tx.workItem.update({
                            where: { id: workItemId },
                            data: {
                                status: 'COMPLETED',
                                result: String(rawVal),
                                version: { increment: 1 },
                                completedAt: now,
                                updatedAt: now
                            }
                        });

                        // Record Command Receipt
                        savedReceipt = await CommandReceiptService.recordReceipt(tx, {
                            idempotencyKey: opId,
                            commandType: op.type,
                            targetResource: workItemId,
                            actor: user.username,
                            status: 'SUCCESS',
                            outcome: { workItemId, result: rawVal, status: 'COMPLETED', resultId: newResultId, attemptId }
                        });
                    });

                    outcome = { workItemId, status: 'COMPLETED', result: rawVal, resultId: newResultId };
                    savedReceiptId = savedReceipt?.id;
                } else if (op.type === 'RECORD_INTAKE') {
                    // Sample intake
                    if (!hasPermission(user, 'REGISTER_SAMPLES') && !hasPermission(user, 'RECEIVE_SAMPLE') && !hasPermission(user, 'RECEIVE_SAMPLES') && !['LAB_MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
                        receipts.push({
                            operationId: opId,
                            status: 'REJECTED',
                            code: 'PERMISSION_DENIED',
                            reason: 'User lacks sample intake permissions'
                        });
                        continue;
                    }

                    const originalId = op.payload?.originalId || op.payload?.sampleId;
                    if (!originalId) throw new Error('Sample identifier is required');

                    const sampleLab = user.labId || op.payload?.labId;
                    if (!sampleLab && user.role !== 'SUPER_ADMIN') {
                        receipts.push({
                            operationId: opId,
                            status: 'REJECTED',
                            code: 'MISSING_LAB_SCOPE',
                            reason: 'Laboratory assignment is required for sample intake'
                        });
                        continue;
                    }

                    // Check if sample already exists
                    const existing = await prisma.sample.findFirst({
                        where: { originalId }
                    });

                    if (existing) {
                        receipts.push({
                            operationId: opId,
                            status: 'CONFLICT',
                            reason: `Sample with ID '${originalId}' already exists in laboratory database.`,
                            serverState: { id: existing.id, status: existing.status }
                        });
                        continue;
                    }

                    let savedReceipt = null;
                    const sampleId = 'SMP-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
                    await prisma.$transaction(async (tx) => {
                        const receptionData = JSON.stringify({
                            notes: op.payload?.notes || null,
                            capturedAtLocal: op.capturedAtLocal || null
                        });

                        const newSample = await tx.sample.create({
                            data: {
                                id: sampleId,
                                originalId,
                                labId: sampleLab,
                                assignedLab: sampleLab,
                                status: 'RECEIVED',
                                receptionDate: new Date(op.capturedAtLocal || Date.now()),
                                receivedBy: user.username,
                                receptionData
                            }
                        });

                        savedReceipt = await CommandReceiptService.recordReceipt(tx, {
                            idempotencyKey: opId,
                            commandType: op.type,
                            targetResource: targetResource,
                            actor: user.username,
                            status: 'SUCCESS',
                            outcome: { sampleId, originalId, status: 'RECEIVED' }
                        });

                        outcome = { sampleId, originalId, status: 'RECEIVED' };
                    });
                    savedReceiptId = savedReceipt?.id;
                } else {
                    // Unsupported command
                    receipts.push({
                        operationId: opId,
                        status: 'REJECTED',
                        reason: `Unsupported domain command type: '${op.type}'.`,
                        serverTimestamp
                    });
                    continue;
                }

                // Successful outcome
                receipts.push({
                    operationId: opId,
                    status: 'APPLIED',
                    receiptId: savedReceiptId || ('rcpt_' + Date.now()),
                    serverTimestamp,
                    outcome
                });

            } catch (err) {
                console.error(`[SYNC_OP_ERROR] Failed to process ${op.type} (${opId}):`, err);
                receipts.push({
                    operationId: opId,
                    status: 'REJECTED',
                    reason: err.message || 'Operation failed server validation',
                    serverTimestamp
                });
            }
        }

        return {
            protocolVersion,
            serverTimestamp,
            receipts
        };
    }
}

module.exports = SyncService;
