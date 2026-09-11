'use strict';

const prisma = require('../prisma');
const CommandReceiptService = require('./commandReceiptService');
const OperationalConfirmationService = require('./operationalConfirmationService');
const { parseDeterminationValue, validateValue, validateTexture, validateTextureFractions, validateNumericMethod } = require('./workbenchValidationService');
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
            const workItemId = (typeof op.target === 'string' ? op.target : op.target?.workItemId) || op.workItemId;
            const targetResource = workItemId || (typeof op.target === 'object' ? op.target?.sampleId : null) || opId;

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

                    // Check eligibility using canonical workEligibility.canRecord
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

                    // Store draft in database atomically with CommandReceipt (LG-14, P26)
                    let draftRecord = null;
                    let savedReceipt = null;
                    const draftVal = op.payload?.value !== undefined ? String(op.payload.value) : (op.payload?.result !== undefined ? String(op.payload.result) : (op.payload?.draftValue !== undefined ? String(op.payload.draftValue) : null));

                    await prisma.$transaction(async (tx) => {
                        if (tx.workItemDraft) {
                            const existingDraft = await tx.workItemDraft.findUnique({
                                where: { workItemId }
                            });

                            const opCapturedAt = op.capturedAtLocal || op.payload?.capturedAtLocal || op.payload?.capturedAt;
                            const opTime = opCapturedAt ? new Date(opCapturedAt).getTime() : 0;
                            const serverDraftTime = existingDraft?.updatedAt ? new Date(existingDraft.updatedAt).getTime() : 0;
                            const opDraftVersion = Number(op.payload?.draftVersion || op.payload?.clientDraftVersion || op.draftSeq || 0);
                            const serverDraftVersion = Number(existingDraft?.draftVersion || 0);

                            // 1. Check if draft was explicitly discarded on server after this operation was captured
                            let wasDiscardedAfterOp = false;
                            if (item.history) {
                                const history = typeof item.history === 'string' ? JSON.parse(item.history) : (item.history || []);
                                const discardEvent = Array.isArray(history) && history.slice().reverse().find(h => h.action === 'DRAFT_DISCARDED');
                                if (discardEvent && discardEvent.timestamp) {
                                    const discardTime = new Date(discardEvent.timestamp).getTime();
                                    if (discardTime > opTime) {
                                        wasDiscardedAfterOp = true;
                                    }
                                }
                            }

                            if (wasDiscardedAfterOp) {
                                savedReceipt = await CommandReceiptService.recordReceipt(tx, {
                                    idempotencyKey: opId,
                                    commandType: op.type,
                                    targetResource: workItemId,
                                    actor: user.username,
                                    status: 'REJECTED',
                                    outcome: {
                                        saved: false,
                                        discarded: true,
                                        message: 'Draft was discarded on server prior to sync replay',
                                        workItemId
                                    }
                                });
                                outcome = { saved: false, discarded: true, workItemId, reason: 'Draft was discarded on server prior to sync replay' };
                                return;
                            }

                            // 2. Check if existingDraft was written by an earlier offline replay or by an online save
                            let lastAppliedOpTime = 0;
                            let isOfflineOrigin = false;
                            if (existingDraft?.notes && existingDraft.notes.includes('[SYNC_OP:')) {
                                const match = existingDraft.notes.match(/\[SYNC_OP:(\d+)\]/);
                                if (match) {
                                    lastAppliedOpTime = Number(match[1]);
                                    isOfflineOrigin = true;
                                }
                            }

                            // Concurrency evaluation:
                            let isServerDraftNewer = false;
                            if (existingDraft) {
                                if (isOfflineOrigin) {
                                    // Both were offline operations replaying sequentially on server
                                    if (opDraftVersion > 0 && serverDraftVersion > 0) {
                                        isServerDraftNewer = serverDraftVersion > opDraftVersion;
                                    } else if (lastAppliedOpTime > 0 && opTime > 0) {
                                        isServerDraftNewer = lastAppliedOpTime > opTime;
                                    }
                                } else {
                                    // Existing draft was saved online via batch-save
                                    // Server draft is newer if saved online after this op was captured, or has higher revision
                                    if (opDraftVersion > 0 && serverDraftVersion > opDraftVersion) {
                                        isServerDraftNewer = true;
                                    } else if (serverDraftTime > opTime) {
                                        isServerDraftNewer = true;
                                    }
                                }
                            }

                            if (isServerDraftNewer && existingDraft.value !== draftVal) {
                                // Server draft was saved more recently than this offline operation.
                                // Preserve the newer server draft without overwriting it with older data.
                                const conflictPayload = {
                                    attemptedValue: draftVal,
                                    attemptedValues: op.payload?.values || null,
                                    attemptedChecks: op.payload?.checks || null,
                                    attemptedBasis: op.payload?.basis || null,
                                    attemptedEquipmentId: op.payload?.equipmentId || null,
                                    attemptedAt: opCapturedAt || new Date().toISOString(),
                                    actor: user.username
                                };

                                const conflictUpdate = {
                                    conflictValue: draftVal !== null ? draftVal : (op.payload?.values ? JSON.stringify(op.payload.values) : null)
                                };

                                // Preserve unapplied structured payload in notes
                                let currentNotes = existingDraft.notes || '';
                                try {
                                    const parsed = currentNotes ? JSON.parse(currentNotes) : {};
                                    parsed._conflictPayload = conflictPayload;
                                    conflictUpdate.notes = JSON.stringify(parsed);
                                } catch (_) {
                                    conflictUpdate.notes = JSON.stringify({ _rawNotes: currentNotes, _conflictPayload: conflictPayload });
                                }

                                draftRecord = await tx.workItemDraft.update({
                                    where: { workItemId },
                                    data: conflictUpdate
                                });

                                savedReceipt = await CommandReceiptService.recordReceipt(tx, {
                                    idempotencyKey: opId,
                                    commandType: op.type,
                                    targetResource: workItemId,
                                    actor: user.username,
                                    status: 'CONFLICT',
                                    outcome: {
                                        saved: false,
                                        conflict: true,
                                        superseded: true,
                                        newerPreserved: true,
                                        currentValue: existingDraft.value,
                                        attemptedValue: draftVal,
                                        attemptedPayload: conflictPayload,
                                        workItemId,
                                        draftId: existingDraft.id,
                                        reason: 'Draft was superseded by newer work on server'
                                    }
                                });
                                outcome = {
                                    saved: false,
                                    conflict: true,
                                    status: 'CONFLICT',
                                    superseded: true,
                                    newerPreserved: true,
                                    currentValue: existingDraft.value,
                                    attemptedValue: draftVal,
                                    attemptedPayload: conflictPayload,
                                    workItemId,
                                    draftId: existingDraft.id,
                                    reason: 'Draft was superseded by newer work on server'
                                };
                                return;
                            }

                            // 3. Normal path: op is newer or equal (sequential offline edit or first save)
                            const cleanNotes = (op.payload?.notes || existingDraft?.notes || '')
                                .replace(/\[SYNC_OP:\d+\]/g, '')
                                .trim();
                            const syncNotes = cleanNotes ? `${cleanNotes} [SYNC_OP:${opTime || Date.now()}]` : `[SYNC_OP:${opTime || Date.now()}]`;
                            const resolvedDraftVersion = opDraftVersion > 0
                                ? Math.max(opDraftVersion, (existingDraft?.draftVersion || 0) + 1)
                                : ((existingDraft?.draftVersion || 0) + 1);

                            draftRecord = await tx.workItemDraft.upsert({
                                where: { workItemId },
                                create: {
                                    workItemId,
                                    sampleId: item.sampleId,
                                    userId: user.username,
                                    labId: workLab || user.labId,
                                    analysis: item.analysis,
                                    value: draftVal,
                                    values: op.payload?.values ? (typeof op.payload.values === 'string' ? op.payload.values : JSON.stringify(op.payload.values)) : null,
                                    checks: op.payload?.checks ? (typeof op.payload.checks === 'string' ? op.payload.checks : JSON.stringify(op.payload.checks)) : null,
                                    basis: op.payload?.basis || 'AIR_DRY',
                                    replicateNo: Number(op.payload?.replicateNo) || 1,
                                    instrumentId: op.payload?.equipmentId || null,
                                    baseVersion: op.baseVersion || item.version || 0,
                                    draftVersion: resolvedDraftVersion,
                                    notes: syncNotes
                                },
                                update: {
                                    value: draftVal !== null ? draftVal : undefined,
                                    values: op.payload?.values ? (typeof op.payload.values === 'string' ? op.payload.values : JSON.stringify(op.payload.values)) : undefined,
                                    checks: op.payload?.checks ? (typeof op.payload.checks === 'string' ? op.payload.checks : JSON.stringify(op.payload.checks)) : undefined,
                                    notes: syncNotes,
                                    draftVersion: resolvedDraftVersion,
                                    updatedAt: new Date()
                                }
                            });
                        } else {
                            draftRecord = await tx.workItem.update({
                                where: { id: workItemId },
                                data: { updatedAt: new Date() }
                            });
                        }

                        // Advance work item status from ASSIGNED to IN_PROGRESS on first draft save
                        if (item.status === 'ASSIGNED') {
                            await tx.workItem.update({
                                where: { id: workItemId },
                                data: { status: 'IN_PROGRESS', updatedAt: new Date() }
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

                    if (!outcome) {
                        outcome = { saved: true, workItemId, draftId: draftRecord?.id };
                    }
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

                    // 2. Reject scalar values for spectral analyses (standard and custom methods)
                    const isSpectral = ['SPEC_MIR', 'SPEC_VIS_NIR', 'SPEC_NIR', 'SPEC_FTIR'].includes(item.analysis) ||
                        (item.analysis && item.analysis.startsWith('SPEC_')) ||
                        item.category === 'Spectroscopy';
                    let isCustomSpectral = false;
                    if (item.methodologyId) {
                        const method = await prisma.methodology.findUnique({ where: { id: item.methodologyId } });
                        if (method && (
                            method.analysisCode?.startsWith('SPEC_') ||
                            method.name?.toLowerCase().includes('spectr') ||
                            method.standard?.toLowerCase().includes('spectr') ||
                            method.standard?.toLowerCase().includes('mir')
                        )) {
                            isCustomSpectral = true;
                        }
                    }
                    if (isSpectral || isCustomSpectral) {
                        receipts.push({
                            operationId: opId,
                            status: 'REJECTED',
                            code: 'SPECTRAL_SCALAR_REJECTED',
                            reason: 'Mid-Infrared and NIR spectroscopy require spectrum upload or scan linkage; scalar value entry is not permitted'
                        });
                        continue;
                    }

                    // 3. Grouped soil texture validation
                    const isTextureTask = item.analysis === 'TEXTURE' || ['SAND', 'SILT', 'CLAY', 'pSA', 'PSA', 'textureSum'].includes(item.analysis);
                    const textureFractions = op.payload?.values || (op.payload?.sand !== undefined ? { sand: op.payload.sand, silt: op.payload.silt, clay: op.payload.clay } : null);
                    let textVal = null;
                    if (isTextureTask && textureFractions) {
                        textVal = validateTextureFractions(textureFractions);
                        if (!textVal.isValid) {
                            if (textVal.flags?.includes('INVALID_FORMAT') || textVal.flags?.includes('INCOMPLETE_FRACTIONS')) {
                                receipts.push({
                                    operationId: opId,
                                    status: 'REJECTED',
                                    code: textVal.flags?.includes('INVALID_FORMAT') ? 'INVALID_FORMAT' : 'INCOMPLETE_FRACTIONS',
                                    reason: textVal.error || 'All three fractions (Sand, Silt, Clay) are required as valid percentages.'
                                });
                                continue;
                            }
                            if (!op.payload?.overrideReason || user.role === 'LAB_TECHNICIAN') {
                                receipts.push({
                                    operationId: opId,
                                    status: 'REJECTED',
                                    code: 'TEXTURE_CLOSURE_FAILED',
                                    reason: textVal.error || 'Texture closure check failed. All three fractions required and must sum to 100% within tolerance.'
                                });
                                continue;
                            }
                        }
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
                    const rawVal = isTextureTask && textVal ? (textVal.className || 'Loam') : (op.payload?.value !== undefined ? op.payload.value : op.payload?.result);
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
                    if (!isTextureTask && !parsed.isValid && !parsed.isCensored) {
                        receipts.push({
                            operationId: opId,
                            status: 'REJECTED',
                            code: 'INVALID_FORMAT',
                            reason: `Invalid determination value: ${rawVal}`
                        });
                        continue;
                    }

                    let savedReceipt = null;
                    const newResultId = `res-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
                    const repNo = (op.payload?.replicateNo !== undefined && op.payload?.replicateNo !== null) ? Number(op.payload.replicateNo) : 1;
                    const validBasis = ['AIR_DRY', 'OVEN_DRY', 'FIELD_MOIST'].includes(op.payload?.basis) ? op.payload.basis : 'AIR_DRY';
                    const now = new Date();

                    // Execute atomic record transaction
                    await prisma.$transaction(async (tx) => {
                        if (isTextureTask && textVal && textVal.isValid && textureFractions) {
                            const sandNum = Number(String(textureFractions.sand).replace(',', '.'));
                            const siltNum = Number(String(textureFractions.silt).replace(',', '.'));
                            const clayNum = Number(String(textureFractions.clay).replace(',', '.'));
                            const textClassName = textVal.className || 'Loam';

                            const textResId = `res-${Date.now()}-text-${Math.random().toString(36).substr(2, 5)}`;
                            const sandResId = `res-${Date.now()}-sand-${Math.random().toString(36).substr(2, 5)}`;
                            const siltResId = `res-${Date.now()}-silt-${Math.random().toString(36).substr(2, 5)}`;
                            const clayResId = `res-${Date.now()}-clay-${Math.random().toString(36).substr(2, 5)}`;

                            await tx.result.updateMany({
                                where: {
                                    sampleId: item.sampleId,
                                    param: { in: ['SAND', 'SILT', 'CLAY', 'TEXTURE', item.analysis] },
                                    replicateNo: repNo,
                                    isCurrent: true
                                },
                                data: {
                                    isCurrent: false,
                                    supersededBy: textResId
                                }
                            });

                            const fractions = [
                                { id: sandResId, param: 'SAND', valStr: String(sandNum), num: sandNum, unit: '%' },
                                { id: siltResId, param: 'SILT', valStr: String(siltNum), num: siltNum, unit: '%' },
                                { id: clayResId, param: 'CLAY', valStr: String(clayNum), num: clayNum, unit: '%' },
                                { id: textResId, param: item.analysis, valStr: textClassName, num: null, unit: null }
                            ];

                            for (const f of fractions) {
                                await tx.result.create({
                                    data: {
                                        id: f.id,
                                        sampleId: item.sampleId,
                                        param: f.param,
                                        value: f.valStr,
                                        numericValue: f.num,
                                        unit: f.unit,
                                        flags: JSON.stringify(op.payload?.flags || []),
                                        isValid: true,
                                        censoring: 'NONE',
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
                            }
                        } else {
                            // Single parameter determination
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
                        }

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

                // Check if outcome was a conflict or discarded
                if (outcome?.conflict || outcome?.status === 'CONFLICT') {
                    receipts.push({
                        operationId: opId,
                        status: 'CONFLICT',
                        receiptId: savedReceiptId || ('rcpt_' + Date.now()),
                        serverTimestamp,
                        outcome,
                        reason: outcome.reason || 'Draft was superseded by newer work on server'
                    });
                    continue;
                }

                if (outcome?.discarded) {
                    receipts.push({
                        operationId: opId,
                        status: 'REJECTED',
                        receiptId: savedReceiptId || ('rcpt_' + Date.now()),
                        serverTimestamp,
                        outcome,
                        reason: outcome.reason || 'Draft was discarded on server prior to sync replay'
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

    /**
     * Helper to process an array of operations directly
     */
    static async applySyncOperations(user, operations, deviceId = 'test-device') {
        return this.processSyncBatch(user, { protocolVersion: 1, deviceId, operations });
    }
}

module.exports = SyncService;
