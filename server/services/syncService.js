'use strict';

const prisma = require('../prisma');
const CommandReceiptService = require('./commandReceiptService');
const OperationalConfirmationService = require('./operationalConfirmationService');
const { parseDeterminationValue, validateValue, validateTexture } = require('./workbenchValidationService');
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
            const targetResource = op.target?.workItemId || op.target?.sampleId || opId;

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

                if (op.type === 'CONFIRM_OPERATION') {
                    // Operational Checklist Task (Drying / Preparation)
                    const confirmRes = await OperationalConfirmationService.confirmOperation({
                        actor: user,
                        workItemId: op.target?.workItemId,
                        checklist: op.payload?.checklist,
                        observations: op.payload?.observations,
                        idempotencyKey: opId
                    });
                    outcome = confirmRes;
                } else if (op.type === 'SAVE_WORK_DRAFT') {
                    // Technician draft save
                    const workItemId = op.target?.workItemId;
                    if (!workItemId) throw new Error('Target workItemId is required');

                    const item = await prisma.workItem.findUnique({
                        where: { id: workItemId },
                        include: { sample: true }
                    });
                    if (!item) throw new Error(`Work item '${workItemId}' not found`);

                    // Check work item lab scope
                    const workLab = item.assignedLab || item.labId || item.sample?.assignedLab || item.sample?.labId;
                    if (user.role !== 'SUPER_ADMIN' && user.labId && workLab && user.labId !== workLab) {
                        receipts.push({
                            operationId: opId,
                            status: 'REJECTED',
                            code: 'WORK_ITEM_OUTSIDE_LAB_SCOPE',
                            reason: 'Cross-lab draft save forbidden'
                        });
                        continue;
                    }

                    // Store draft in database atomically (LG-14, P26)
                    let draftRecord = null;
                    const draftVal = op.payload?.value !== undefined ? String(op.payload.value) : (op.payload?.result !== undefined ? String(op.payload.result) : (op.payload?.draftValue !== undefined ? String(op.payload.draftValue) : null));
                    if (prisma.workItemDraft) {
                        draftRecord = await prisma.workItemDraft.upsert({
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
                        draftRecord = await prisma.workItem.update({
                            where: { id: workItemId },
                            data: { updatedAt: new Date() }
                        });
                    }

                    outcome = { saved: true, workItemId, draftId: draftRecord?.id };
                } else if (op.type === 'COMPLETE_WORK') {
                    // Scientific determination completion
                    const workItemId = op.target?.workItemId;
                    if (!workItemId) throw new Error('Target workItemId is required');

                    // Check user permissions (LG-14, P25)
                    const { hasPermission } = require('../config/roles');
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

                    // Lab isolation & assignment check (LG-14, P25)
                    const workLab = item.assignedLab || item.labId || item.sample?.assignedLab || item.sample?.labId;
                    if (user.role !== 'SUPER_ADMIN' && user.labId && workLab && user.labId !== workLab) {
                        receipts.push({
                            operationId: opId,
                            status: 'REJECTED',
                            code: 'WORK_ITEM_OUTSIDE_LAB_SCOPE',
                            reason: 'Cross-lab work completion forbidden'
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
                    if (op.baseVersion && item.version && item.version > op.baseVersion) {
                        receipts.push({
                            operationId: opId,
                            status: 'CONFLICT',
                            reason: `Work item was modified on server (server version ${item.version}, client base version ${op.baseVersion}).`,
                            serverVersion: item.version,
                            serverState: { status: item.status, currentResult: item.currentResult }
                        });
                        continue;
                    }

                    // Validate result value
                    const rawVal = op.payload?.value !== undefined ? op.payload.value : op.payload?.result;
                    const parsed = parseDeterminationValue(rawVal);
                    if (!parsed.isValid && !parsed.isCensored) {
                        throw new Error(`Invalid determination value: ${rawVal}`);
                    }

                    // Execute atomic record transaction
                    await prisma.$transaction(async (tx) => {
                        // Create work attempt record
                        await tx.workAttempt.create({
                            data: {
                                id: 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
                                workItemId,
                                author: user.username,
                                authorName: user.name || user.username,
                                status: 'VALID',
                                evidenceData: JSON.stringify({
                                    rawValue: String(rawVal),
                                    normalizedValue: parsed.normalizedValue,
                                    qualifier: parsed.censoring !== 'NONE' ? parsed.censoring : null,
                                    recordedAt: new Date().toISOString()
                                })
                            }
                        });

                        // Update WorkItem
                        const updated = await tx.workItem.update({
                            where: { id: workItemId },
                            data: {
                                status: 'COMPLETED',
                                result: String(rawVal),
                                version: { increment: 1 }
                            }
                        });

                        // Record Command Receipt
                        await CommandReceiptService.recordReceipt(tx, {
                            idempotencyKey: opId,
                            commandType: op.type,
                            targetResource,
                            actor: user.username,
                            status: 'SUCCESS',
                            outcome: { workItemId, result: rawVal, status: 'COMPLETED' }
                        });

                        outcome = { workItemId, status: 'COMPLETED', result: rawVal };
                    });
                } else if (op.type === 'RECORD_INTAKE') {
                    // Sample intake
                    const originalId = op.payload?.originalId || op.payload?.sampleId;
                    if (!originalId) throw new Error('Sample identifier is required');

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

                    const sampleId = 'SMP-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
                    await prisma.$transaction(async (tx) => {
                        const newSample = await tx.sample.create({
                            data: {
                                id: sampleId,
                                originalId,
                                labId: user.labId,
                                assignedLab: user.labId,
                                status: 'RECEIVED',
                                receptionDate: new Date(op.capturedAtLocal || Date.now()),
                                receivedBy: user.username,
                                notes: op.payload?.notes || null
                            }
                        });

                        await CommandReceiptService.recordReceipt(tx, {
                            idempotencyKey: opId,
                            commandType: op.type,
                            targetResource: `Sample:${sampleId}`,
                            actor: user.username,
                            status: 'SUCCESS',
                            outcome: { sampleId, originalId, status: 'RECEIVED' }
                        });

                        outcome = { sampleId, originalId, status: 'RECEIVED' };
                    });
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
                    receiptId: 'rcpt_' + Date.now(),
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
