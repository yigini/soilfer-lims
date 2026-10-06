const crypto = require('crypto');
const prisma = require('../prisma');
const { evaluateBatchQc, checkBatchDisposition, flagBatchResults, getMissingQcValueTypes } = require('../services/qcService');
const scopeGuard = require('../utils/scopeGuard');
const { hasPermission } = require('../config/roles');
const { getNumberFormat } = require('../services/numberFormatService');
const { normalizeQcNumbers, retainQcRawInput } = require('../services/qcNumberInputService');
const { resolveQcPolicy } = require('../services/qcPolicyService');
const policyService = require('../services/policyService');
const { linkReferences, retainReferences } = require('../services/referencePlacementService');
const { countRequirements } = require('../services/qcRequirementService');

const BATCH_STATES = {
    OPEN: 'OPEN',
    RUNNING: 'RUNNING',
    QC_PASS: 'QC_PASS',
    QC_FAIL: 'QC_FAIL',
    CLOSED: 'CLOSED'
};

/**
 * Persists evaluated QC results into typed BatchQcResult rows
 */
async function syncTypedQcItems(tx, batchId, evaluated) {
    // The caller has already saved a durable snapshot in this transaction.
    await tx.batchQcResult.deleteMany({ where: { batchId } });
    if (!evaluated) return;

    const items = [];
    (evaluated.blanks || []).forEach(b => {
        items.push({
            id: crypto.randomUUID(),
            batchId,
            type: 'BLANK',
            label: b.label || 'Method Blank',
            expected: 0,
            measured: b.value !== null && b.value !== undefined ? Number(b.value) : null,
            value1: null,
            value2: null,
            recoveryPct: null,
            rpd: null,
            status: b.status || 'PASS',
            details: JSON.stringify({ evaluation: b.details || null, rawInput: b.rawInput || {}, policyVersion: evaluated.policyVersion,
                qcRule: evaluated.qcRule, criterion: b.criterion || 'ABSOLUTE', loq: b.loq ?? null, loqSource: b.loqSource || null,
                notes: b.notes || [], failAction: b.failAction, maxAllowed: b.maxAllowed })
        });
    });

    (evaluated.duplicates || []).forEach(d => {
        items.push({
            id: crypto.randomUUID(),
            batchId,
            type: 'DUPLICATE',
            label: d.label || 'Analytical Duplicate',
            expected: null,
            measured: null,
            value1: d.value1 !== null && d.value1 !== undefined ? Number(d.value1) : null,
            value2: d.value2 !== null && d.value2 !== undefined ? Number(d.value2) : null,
            recoveryPct: null,
            rpd: d.rpd !== null && d.rpd !== undefined ? Number(d.rpd) : null,
            status: d.status || 'PASS',
            details: JSON.stringify({ evaluation: d.details || null, rawInput: d.rawInput || {}, policyVersion: evaluated.policyVersion,
                qcRule: evaluated.qcRule, failAction: d.failAction, absMax: d.absMax ?? null,
                loq: d.loq, loqSource: d.loqSource, methodologyId: d.methodologyId, notes: d.notes,
                criterion: d.criterion, censoringLimits: d.censoringLimits || null, absoluteDifference: d.absoluteDifference ?? null })
        });
    });

    (evaluated.controls || []).forEach(c => {
        items.push({
            id: crypto.randomUUID(),
            batchId,
            type: 'CONTROL',
            referenceMaterialId: c.referenceMaterialId || null,
            referenceValueId: c.referenceValueId || null,
            label: c.label || 'Certified Reference Material',
            expected: c.expected !== null && c.expected !== undefined ? Number(c.expected) : null,
            measured: c.measured !== null && c.measured !== undefined ? Number(c.measured) : null,
            value1: null,
            value2: null,
            recoveryPct: c.recoveryPct !== null && c.recoveryPct !== undefined ? Number(c.recoveryPct) : null,
            rpd: null,
            status: c.status || 'PASS',
            details: JSON.stringify({ evaluation: c.details || null, rawInput: c.rawInput || {},
                policyVersion: evaluated.policyVersion, qcRule: evaluated.qcRule, criterion: c.criterion, notes: c.notes || [], failAction: c.failAction,
                crmAbsWindow: c.crmAbsWindow, lrmWindowPct: c.lrmWindowPct,
                referenceUse: c.referenceUse || null, referenceSnapshot: c.referenceSnapshot || null })
        });
    });

    if (items.length > 0) {
        await tx.batchQcResult.createMany({ data: items });
    }
}

function batchError(statusCode, body) {
    return Object.assign(new Error(body.error), { statusCode, body: { code: 'QC_RULE_VIOLATION', ...body } });
}

function parsedEvidence(value, fallback = null) {
    if (typeof value !== 'string') return value ?? fallback;
    try { return JSON.parse(value); } catch (_) { return { unparseableRawValue: value }; }
}

function requireReopenAuthority(user, reason) {
    if (!hasPermission(user, 'APPROVE_RESULTS')) {
        throw batchError(403, { code: 'QC_REOPEN_PERMISSION_REQUIRED', error: 'Reopening accepted QC requires APPROVE_RESULTS.' });
    }
    if (typeof reason !== 'string' || !reason.trim()) {
        throw batchError(400, { code: 'REASON_REQUIRED', error: 'A reason is required to reopen accepted QC.' });
    }
}

async function persistBatchMutation(tx, batch, data, evaluated, user, reason) {
    let history = parsedEvidence(batch.history, []);
    if (!Array.isArray(history)) {
        throw batchError(409, { code: 'BATCH_HISTORY_INVALID', error: 'Batch history needs repair before modification.' });
    }
    if (Object.prototype.hasOwnProperty.call(data, 'qcResults')) {
        const previousSnapshots = await tx.auditLog.findMany({
            where: { entity: 'BATCH', entityId: batch.id, action: 'QC_EVIDENCE_SNAPSHOT' }, select: { details: true }
        });
        const lastSeq = Math.max(0, ...history.map(event => Number(event.seq) || 0),
            ...previousSnapshots.map(row => Number(parsedEvidence(row.details)?.seq) || 0));
        const timestamp = new Date();
        const snapshot = {
            qcResults: parsedEvidence(batch.qcResults),
            qcItems: await tx.batchQcResult.findMany({ where: { batchId: batch.id }, orderBy: { id: 'asc' } }),
            status: batch.status,
            disposition: parsedEvidence(batch.disposition),
            workItemIds: parsedEvidence(batch.workItemIds, []),
            actor: { id: user.id || null, username: user.username }, timestamp, reason
        };
        const event = { action: 'QC_EVIDENCE_SNAPSHOT', seq: lastSeq + 1, reason, snapshot };
        await tx.auditLog.create({ data: {
            id: crypto.randomUUID(), entity: 'BATCH', entityId: batch.id, action: event.action,
            details: JSON.stringify(event), performedBy: user.username, timestamp
        } });
        history.push(event);
        await syncTypedQcItems(tx, batch.id, evaluated);
    }
    if (data.status && data.status !== batch.status) {
        history.push({ status: data.status, changedBy: user.username, timestamp: new Date() });
    }
    const updated = await tx.batch.update({
        where: { id: batch.id }, data: { ...data, history: JSON.stringify(history) }, include: { qcItems: true }
    });
    if (data.status) await flagBatchResults(tx, batch.id, updated.status, updated.disposition);
    return updated;
}

function resolveRunProfile(analysis, instrument, requestedCapacity, requestedProfile, profiles = policyService.getStrict('qc.runProfiles')) {
    const keys = Object.keys(profiles);
    const fallback = profiles.RACK_40 ? 'RACK_40' : keys[0];
    let selected = requestedProfile && Object.hasOwn(profiles, requestedProfile) ? requestedProfile : null;
    const inst = (instrument || '').toLowerCase();
    if (!selected && (inst.includes('microplate') || inst.includes('elisa') || inst.includes('96') || requestedCapacity === 96)) {
        selected = profiles.MICROPLATE_96 ? 'MICROPLATE_96' : keys.find(k => profiles[k].capacity === requestedCapacity);
    }
    if (!selected && (inst.includes('centrifuge') || inst.includes('digest') || inst.includes('block') || inst.includes('24') || requestedCapacity === 24)) {
        selected = profiles.CENTRIFUGE_24 ? 'CENTRIFUGE_24' : keys.find(k => profiles[k].capacity === requestedCapacity);
    }
    const result = { ...require('../config/policyRegistry').clone(profiles[selected || fallback]), profileKey: selected || fallback };
    if (!selected && typeof requestedCapacity === 'number' && requestedCapacity > 0) result.capacity = requestedCapacity;
    return result;
}

async function resolveBatchRunProfile(batch, db = prisma) {
    const profiles = await policyService.get(batch.labId, 'qc.runProfiles', { db, analysisCode: batch.analysis });
    return resolveRunProfile(batch.analysis, batch.instrument, batch.maxCapacity, batch.profile, profiles);
}

exports.createBatch = async (req, res) => {
    const { id, analysis, instrument, notes, profile: reqProfile, capacity: reqCapacity, maxCapacity: reqMaxCap } = req.body;
    const user = req.user;

    try {
        if (!analysis) return res.status(400).json({ error: 'Analysis type required' });

        const batchId = (typeof id === 'string' && id.trim()) ? id.trim() : `BATCH-${Date.now()}`;
        const now = new Date();

        const runProfile = await resolveBatchRunProfile({ labId: user.labId, analysis, instrument, maxCapacity: reqMaxCap || reqCapacity, profile: reqProfile });

        const newBatch = await prisma.batch.create({
            data: {
                id: batchId,
                labId: user.labId,
                analysis,
                instrument: instrument || 'Manual',
                maxCapacity: runProfile.capacity,
                profile: runProfile.profileKey,
                status: BATCH_STATES.OPEN,
                createdBy: user.username,
                createdAt: now,
                notes: notes || '',
                qcResults: JSON.stringify({ blanks: [], controls: [], duplicates: [] }),
                workItemIds: JSON.stringify([]),
                history: JSON.stringify([{
                    status: BATCH_STATES.OPEN,
                    changedBy: user.username,
                    timestamp: now
                }])
            }
        });

        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                entity: 'QC_BATCH',
                entityId: batchId,
                action: 'CREATE',
                details: `Batch created for ${analysis} (${runProfile.name}, max ${runProfile.capacity})`,
                performedBy: user.username,
                timestamp: now
            }
        });

        res.status(201).json({ ...newBatch, runProfile });
    } catch (error) {
        console.error('[createBatch] Error:', error);
        res.status(500).json({ error: 'Failed to create batch' });
    }
};

exports.getBatches = async (req, res) => {
    const { status, analysis } = req.query;
    try {
        let where = scopeGuard.buildScopedWhere(req.user, {}, { entityType: 'Generic', labField: 'labId', altLabField: null });

        if (status) where.status = status;
        if (analysis) where.analysis = analysis;

        const batches = await prisma.batch.findMany({
            where,
            include: {
                qcItems: true,
                workItems: {
                    select: {
                        id: true,
                        sampleId: true,
                        analysis: true,
                        status: true,
                        rackPosition: true,
                        sample: { select: { id: true, originalId: true, labId: true, assignedLab: true } }
                    },
                    orderBy: { rackPosition: 'asc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const dataWithProfiles = await Promise.all(batches.map(async b => prisma.$transaction(async tx => {
            const numberFormat = await getNumberFormat(b.labId, { db: tx });
            const runProfile = await resolveBatchRunProfile(b, tx);
            const policy = await resolveQcPolicy(b, tx, numberFormat);
            return { ...b, numberFormat, runProfile, qcRule: policy.qcRule, qcMode: policy.qcMode,
                qcRequirements: countRequirements(policy.qcRule, policy.sampleCount, runProfile, {}, policy.qcMode) };
        })));

        res.json({ data: dataWithProfiles });
    } catch (error) {
        console.error('[getBatches] Error:', error);
        if (error.statusCode) return res.status(error.statusCode).json({ code: error.code, error: error.message });
        res.status(500).json({ error: 'Failed to get batches' });
    }
};

exports.getBatchById = async (req, res) => {
    const { id } = req.params;
    const user = req.user;
    try {
        const batch = await prisma.batch.findUnique({
            where: { id },
            include: {
                qcItems: true,
                workItems: {
                    select: {
                        id: true,
                        sampleId: true,
                        analysis: true,
                        status: true,
                        rackPosition: true,
                        sample: { select: { id: true, originalId: true, labId: true, assignedLab: true } }
                    },
                    orderBy: { rackPosition: 'asc' }
                }
            }
        });

        if (!batch) return res.status(404).json({ error: 'Batch not found' });

        if (!scopeGuard.canAccessEntity(user, batch, { labField: 'labId' })) {
            return res.status(403).json({ error: 'Access denied: Batch outside your laboratory scope' });
        }

        const runProfile = await resolveBatchRunProfile(batch);
        const currentPolicy = await prisma.$transaction(tx => resolveQcPolicy(batch, tx));

        let qcResults = null;
        try {
            qcResults = batch.qcResults ? (typeof batch.qcResults === 'string' ? JSON.parse(batch.qcResults) : batch.qcResults) : null;
        } catch (e) {}

        let disposition = null;
        try {
            disposition = batch.disposition ? (typeof batch.disposition === 'string' ? JSON.parse(batch.disposition) : batch.disposition) : null;
        } catch (e) {}

        let history = [];
        try {
            history = batch.history ? (typeof batch.history === 'string' ? JSON.parse(batch.history) : batch.history) : [];
        } catch (e) {}

        res.json({
            data: {
                ...batch,
                qcRule: currentPolicy.qcRule, qcMode: currentPolicy.qcMode,
                qcRequirements: countRequirements(currentPolicy.qcRule, currentPolicy.sampleCount, runProfile, {}, currentPolicy.qcMode),
                qcResults,
                disposition,
                history
            },
            runProfile
        });
    } catch (error) {
        console.error('[getBatchById] Error:', error);
        res.status(500).json({ error: 'Failed to get batch' });
    }
};

exports.updateBatch = async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const user = req.user;

    try {
        const response = await prisma.$transaction(async tx => {
            const batch = await tx.batch.findUnique({ where: { id } });
            if (!batch) throw batchError(404, { error: 'Batch not found' });

            if (!scopeGuard.canAccessEntity(user, batch, { labField: 'labId' })) {
                throw batchError(403, { error: 'Access denied: Batch outside your laboratory scope' });
            }

            if (batch.status === BATCH_STATES.CLOSED) {
                throw batchError(400, { error: 'Batch is CLOSED and cannot be modified.' });
            }

            const runProfile = await resolveBatchRunProfile(batch, tx);

            // Restrict updates to explicitly allowed fields; membership & disposition are managed via dedicated routes
            const data = {};
            if (updates.notes !== undefined) data.notes = updates.notes;
            if (updates.instrument !== undefined) data.instrument = updates.instrument;

            let evaluated = null;

            // Auto-evaluate QC data if provided
            const hasQcPayload = !!(updates.qcResults || updates.blanks || updates.duplicates || updates.controls);
            if (batch.status === BATCH_STATES.QC_FAIL &&
                (hasQcPayload || (updates.status !== undefined && updates.status !== batch.status))) {
                throw batchError(409, { code: 'QC_BATCH_LOCKED', error: 'QC_FAIL evidence and status are locked; use batch disposition.' });
            }
            if (hasQcPayload && batch.disposition) {
                throw batchError(409, { code: 'QC_BATCH_LOCKED', error: 'A dispositioned batch cannot be re-evaluated.' });
            }
            let reopened = batch.status === BATCH_STATES.QC_PASS && ['OPEN', 'RUNNING'].includes(updates.status);
            if (reopened && hasQcPayload) {
                throw batchError(409, { code: 'QC_REOPEN_SEPARATE_EVALUATION', error: 'Reopen the batch before submitting new QC measurements.' });
            }
            if (hasQcPayload) {
                const sourcePayload = updates.qcResults || {
                    blanks: updates.blanks,
                    duplicates: updates.duplicates,
                    controls: updates.controls
                };
                const numberFormat = await getNumberFormat(batch.labId, { db: tx });
                const qcPayload = await linkReferences(tx, batch, user, normalizeQcNumbers(sourcePayload, numberFormat));
                const policy = await resolveQcPolicy(batch, tx, numberFormat);
                evaluated = retainReferences(retainQcRawInput(evaluateBatchQc(qcPayload, { runProfile, policy }), qcPayload), qcPayload);
                evaluated.policyVersion = policy.policyVersion;
                evaluated.policyValues = policy.policyValues;
                data.qcResults = JSON.stringify(evaluated);
                if (batch.status === BATCH_STATES.QC_PASS && evaluated.overallStatus === BATCH_STATES.OPEN) reopened = true;
                if (evaluated.overallStatus === 'OPEN') {
                    // QC evidence was cleared or empty: safely invalidate acceptance and stale dispositions
                    data.status = BATCH_STATES.OPEN;
                    data.disposition = null;
                } else if (!updates.status) {
                    data.status = evaluated.overallStatus;
                    data.disposition = null; // Clear stale disposition on new measurement evaluation
                }
            }

            // Validate status transition
            if (updates.status !== undefined) {
                const requestedStatus = updates.status;
                if (!Object.values(BATCH_STATES).includes(requestedStatus)) {
                    throw batchError(400, { error: `Invalid batch status: '${requestedStatus}'. Allowed: ${Object.values(BATCH_STATES).join(', ')}` });
                }

                // Status transitions to QC_PASS or QC_FAIL require evaluated QC evidence or authorized disposition
                if (requestedStatus === BATCH_STATES.QC_PASS || requestedStatus === BATCH_STATES.QC_FAIL) {
                    if (evaluated) {
                        if (requestedStatus === BATCH_STATES.QC_PASS && evaluated.overallStatus === BATCH_STATES.QC_FAIL) {
                            throw batchError(400, {
                                error: 'Cannot set status to QC_PASS: evaluated QC data failed acceptance criteria.'
                            });
                        }
                        data.status = evaluated.overallStatus;
                    } else {
                        // No QC payload in this request; check existing batch QC results
                        let existingQc = null;
                        try {
                            existingQc = typeof batch.qcResults === 'string' ? JSON.parse(batch.qcResults) : batch.qcResults;
                        } catch (e) {}

                        const hasEvaluatedEvidence = existingQc && (
                            (Array.isArray(existingQc.blanks) && existingQc.blanks.length > 0) ||
                            (Array.isArray(existingQc.controls) && existingQc.controls.length > 0) ||
                            (Array.isArray(existingQc.duplicates) && existingQc.duplicates.length > 0)
                        );

                        if (!hasEvaluatedEvidence) {
                            throw batchError(400, {
                                error: `Cannot set status to '${requestedStatus}' without evaluated QC evidence or authorized disposition.`
                            });
                        }

                        if (requestedStatus === BATCH_STATES.QC_PASS && existingQc.overallStatus === BATCH_STATES.QC_FAIL) {
                            throw batchError(409, { code: 'QC_BATCH_LOCKED', error: 'Failed QC cannot become QC_PASS through a status update.' });
                        }
                        data.status = requestedStatus;
                    }
                } else if (requestedStatus === BATCH_STATES.CLOSED) {
                    if (!hasPermission(user, 'APPROVE_RESULTS')) {
                        throw batchError(403, { error: 'Only lab managers can close batches.' });
                    }
                    if (evaluated && evaluated.overallStatus !== BATCH_STATES.QC_PASS) {
                        throw batchError(409, { code: 'QC_BATCH_FAILED', error: 'Cannot close a batch with newly failed or incomplete QC.' });
                    }
                    const canClose = checkBatchDisposition(batch).allowed;
                    if (!canClose) {
                        throw batchError(400, {
                            error: 'Cannot close batch: QC must be passed or approved with manager disposition before closing.'
                        });
                    }
                    data.status = BATCH_STATES.CLOSED;
                } else if (requestedStatus === BATCH_STATES.OPEN || requestedStatus === BATCH_STATES.RUNNING) {
                    // A requested operational status must not mask newly evaluated failure.
                    data.status = evaluated ? evaluated.overallStatus : requestedStatus;
                }
            }

            if (reopened) {
                requireReopenAuthority(user, updates.reason);
                data.status = BATCH_STATES.OPEN;
                data.qcResults = null;
                data.disposition = null;
                evaluated = null;
            }
            const updatedBatch = await persistBatchMutation(tx, batch, data, evaluated, user,
                typeof updates.reason === 'string' && updates.reason.trim() ? updates.reason.trim() : 'QC evaluation');

            return {
                success: true,
                id: updatedBatch.id,
                status: updatedBatch.status,
                batch: updatedBatch
            };
        });
        res.json(response);
    } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json(error.body || { code: error.code, error: error.message, ...(error.details && { details: error.details }) });
        console.error('[updateBatch] Error:', error);
        res.status(500).json({ error: 'Failed to update batch' });
    }
};

exports.evaluateBatch = async (req, res) => {
    const { id } = req.params;
    const { blanks, duplicates, controls } = req.body;
    const user = req.user;

    try {
        const response = await prisma.$transaction(async tx => {
            const batch = await tx.batch.findUnique({ where: { id } });
            if (!batch) throw batchError(404, { error: 'Batch not found' });
            if (!scopeGuard.canAccessEntity(user, batch, { labField: 'labId' })) {
                throw batchError(403, { error: 'Access denied: Batch outside your laboratory scope' });
            }
            if (batch.status === BATCH_STATES.CLOSED) {
                throw batchError(400, { code: 'QC_BATCH_LOCKED', error: 'Batch is CLOSED and cannot be evaluated or modified.' });
            }
            if (batch.status === BATCH_STATES.QC_FAIL || batch.disposition) {
                throw batchError(409, { code: 'QC_BATCH_LOCKED', error: 'Failed or dispositioned QC evidence cannot be re-evaluated.' });
            }
            const runProfile = await resolveBatchRunProfile(batch, tx);
            const numberFormat = await getNumberFormat(batch.labId, { db: tx });
            const qcPayload = await linkReferences(tx, batch, user, normalizeQcNumbers({ blanks, duplicates, controls }, numberFormat));
            const policy = await resolveQcPolicy(batch, tx, numberFormat);
            const requirements = countRequirements(policy.qcRule, policy.sampleCount, runProfile, qcPayload, policy.qcMode);
            // #185 pin 6016488612 retains #163's input guard for an entirely
            // missing enabled type in blocking mode. Nonempty insufficient counts
            // become verdicts. Submitted partial values are invalid in every mode.
            const suppliedProfile = { qcSlots: ['BLANK', 'DUPLICATE', 'CONTROL'].filter((type, index) =>
                (policy.qcMode === 'REQUIRED_BLOCKING' && (requirements[type].required > 0 || (type === 'CONTROL' && requirements.LRM.required > 0))) ||
                (Array.isArray(qcPayload[['blanks', 'duplicates', 'controls'][index]]) && qcPayload[['blanks', 'duplicates', 'controls'][index]].length > 0)).map(type => ({ type })) };
            const missingTypes = getMissingQcValueTypes(qcPayload, suppliedProfile, numberFormat);
            if (missingTypes.length) {
                throw batchError(400, { code: 'QC_VALUES_MISSING', error: 'Required QC values are missing or non-numeric.', missingTypes });
            }
            const evaluated = retainReferences(retainQcRawInput(evaluateBatchQc(qcPayload, { runProfile, policy }), qcPayload), qcPayload);
            evaluated.policyVersion = policy.policyVersion;
            evaluated.policyValues = policy.policyValues;
            const reopened = batch.status === BATCH_STATES.QC_PASS && evaluated.overallStatus === BATCH_STATES.OPEN;
            if (reopened) requireReopenAuthority(user, req.body.reason);
            const data = {
                qcResults: reopened ? null : JSON.stringify(evaluated),
                status: evaluated.overallStatus, disposition: null
            };
            const updated = await persistBatchMutation(tx, batch, data, reopened ? null : evaluated, user,
                typeof req.body.reason === 'string' && req.body.reason.trim() ? req.body.reason.trim() : 'QC evaluation');
            return { success: true, status: updated.status, evaluation: evaluated, batch: updated };
        });
        res.json(response);
    } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json(error.body || { code: error.code, error: error.message, ...(error.details && { details: error.details }) });
        console.error('[evaluateBatch] Error:', error);
        res.status(500).json({ error: 'Failed to evaluate batch' });
    }
};

exports.addItemsToBatch = async (req, res) => {
    const { id } = req.params;
    const { workItemIds, rackPositions } = req.body;
    const user = req.user;

    try {
        if (!workItemIds || !Array.isArray(workItemIds) || workItemIds.length === 0) {
            return res.status(400).json({ error: 'workItemIds must be a non-empty array' });
        }

        const batch = await prisma.batch.findUnique({ where: { id } });
        if (!batch) return res.status(404).json({ error: 'Batch not found' });

        if (!scopeGuard.canAccessEntity(user, batch, { labField: 'labId' })) {
            return res.status(403).json({ error: 'Access denied: Batch outside your laboratory scope' });
        }

        if (batch.status !== 'OPEN') {
            return res.status(409).json({ code: 'QC_BATCH_MEMBERSHIP_LOCKED', error: 'Batch is not OPEN' });
        }

        const currentIdsArray = typeof batch.workItemIds === 'string' ? JSON.parse(batch.workItemIds) : (batch.workItemIds || []);
        const currentIds = new Set(currentIdsArray);

        // Resolve method/instrument profile capacity and reserved QC slots
        const runProfile = await resolveBatchRunProfile(batch);
        const capacity = batch.maxCapacity || runProfile.capacity;

        const qcSlotMap = new Map();
        (runProfile.qcSlots || []).forEach(slot => {
            qcSlotMap.set(slot.position, slot);
        });

        // Enforce total capacity
        const newIdsToAdd = workItemIds.filter(wid => !currentIds.has(wid));
        if (currentIds.size + newIdsToAdd.length > capacity) {
            return res.status(400).json({
                error: `Adding ${newIdsToAdd.length} items exceeds maximum batch capacity of ${capacity} (current: ${currentIds.size})`,
                capacity,
                currentSize: currentIds.size,
                profile: runProfile.profileKey
            });
        }

        // Validate work items exist and match batch scope & analysis
        const items = await prisma.workItem.findMany({
            where: { id: { in: workItemIds } },
            include: { sample: true }
        });

        if (items.length !== workItemIds.length) {
            return res.status(404).json({ error: 'One or more work items not found' });
        }

        const TEXTURE_ALIASES = ['TEXTURE', 'SOIL_PSD_TEXTURE', 'SOIL_TEXTURE', 'PSA', 'pSA', 'Particle Size Analysis'];
        const isTextureBatch = TEXTURE_ALIASES.includes(batch.analysis);

        for (const item of items) {
            if (item.sample && user && !scopeGuard.canAccessEntity(user, item.sample, { labField: 'assignedLab', altLabField: 'labId' })) {
                return res.status(403).json({ error: `Item ${item.id} is outside your laboratory scope.` });
            }
            const isMatch = isTextureBatch
                ? TEXTURE_ALIASES.includes(item.analysis)
                : item.analysis === batch.analysis;
            if (!isMatch) {
                return res.status(400).json({ error: `Item ${item.id} analysis (${item.analysis}) does not match batch analysis (${batch.analysis})` });
            }
            if (['SUBMITTED', 'ACCEPTED', 'WAIVED'].includes(item.status)) {
                return res.status(400).json({ error: `Item ${item.id} is already sealed (${item.status})` });
            }
        }

        // Query existing batch item positions
        const existingBatchItems = await prisma.workItem.findMany({
            where: { batchId: id },
            select: { id: true, rackPosition: true }
        });
        const occupiedPositions = new Map();
        for (const ex of existingBatchItems) {
            if (ex.rackPosition != null) {
                occupiedPositions.set(ex.rackPosition, ex.id);
            }
        }

        const explicitPositions = (rackPositions && typeof rackPositions === 'object') ? rackPositions : {};
        const seenInPayload = new Map();

        // 1. Strict validation of all explicit rack positions
        for (const wid of workItemIds) {
            if (explicitPositions[wid] !== undefined) {
                const rawPos = explicitPositions[wid];
                const pos = Number(rawPos);
                if (!Number.isInteger(pos) || isNaN(pos)) {
                    return res.status(400).json({ error: `Rack position for ${wid} must be an integer (got: ${rawPos})` });
                }
                if (pos < 1 || pos > capacity) {
                    return res.status(400).json({ error: `Rack position ${pos} for ${wid} is out of bounds (1..${capacity})` });
                }
                if (qcSlotMap.has(pos)) {
                    const qcSlot = qcSlotMap.get(pos);
                    return res.status(400).json({
                        error: `Rack position ${pos} is reserved for QC slot (${qcSlot.type}: ${qcSlot.label || qcSlot.type})`,
                        reservedSlot: qcSlot
                    });
                }
                if (seenInPayload.has(pos)) {
                    return res.status(400).json({
                        error: `Duplicate rack position ${pos} requested for ${wid} and ${seenInPayload.get(pos)}`
                    });
                }
                if (occupiedPositions.has(pos) && occupiedPositions.get(pos) !== wid) {
                    return res.status(400).json({
                        error: `Rack position ${pos} is already occupied in this batch by item ${occupiedPositions.get(pos)}`
                    });
                }
                seenInPayload.set(pos, wid);
            }
        }

        // 2. Assign positions: honor explicit or auto-assign lowest available non-QC position
        const finalPositions = {};
        let candidatePos = 1;
        for (const wid of workItemIds) {
            if (explicitPositions[wid] !== undefined) {
                finalPositions[wid] = Number(explicitPositions[wid]);
            } else {
                while (candidatePos <= capacity && (qcSlotMap.has(candidatePos) || occupiedPositions.has(candidatePos) || seenInPayload.has(candidatePos))) {
                    candidatePos++;
                }
                if (candidatePos > capacity) {
                    return res.status(400).json({
                        error: `Cannot add item ${wid}: No available non-QC rack positions remaining in profile ${runProfile.profileKey} (capacity: ${capacity})`
                    });
                }
                finalPositions[wid] = candidatePos;
                seenInPayload.set(candidatePos, wid);
                candidatePos++;
            }
        }

        // Recheck the status in the same transaction as membership changes.
        await prisma.$transaction(async tx => {
            const currentBatch = await tx.batch.findUnique({ where: { id } });
            if (!currentBatch || currentBatch.status !== BATCH_STATES.OPEN || currentBatch.workItemIds !== batch.workItemIds) {
                throw batchError(409, { code: 'QC_BATCH_MEMBERSHIP_LOCKED', error: 'Batch changed while adding items; reload the OPEN batch.' });
            }
            for (const wid of workItemIds) {
                currentIds.add(wid);
                await tx.workItem.update({
                    where: { id: wid },
                    data: { batchId: id, rackPosition: finalPositions[wid] }
                });
            }
            await tx.batch.update({
                where: { id }, data: { workItemIds: JSON.stringify(Array.from(currentIds)) }
            });
        });

        res.json({
            success: true,
            count: workItemIds.length,
            capacity,
            runProfile: runProfile.profileKey,
            positions: finalPositions
        });
    } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json(error.body);
        console.error('[addItemsToBatch] Error:', error);
        res.status(500).json({ error: 'Failed to add items to batch' });
    }
};

exports.removeItemsFromBatch = async (req, res) => {
    const { id } = req.params;
    const { workItemIds } = req.body;
    const user = req.user;

    try {
        if (!workItemIds || !Array.isArray(workItemIds) || workItemIds.length === 0) {
            return res.status(400).json({ error: 'workItemIds must be a non-empty array' });
        }

        const batch = await prisma.batch.findUnique({ where: { id } });
        if (!batch) return res.status(404).json({ error: 'Batch not found' });

        if (!scopeGuard.canAccessEntity(user, batch, { labField: 'labId' })) {
            return res.status(403).json({ error: 'Access denied: Batch outside your laboratory scope' });
        }

        if (batch.status !== 'OPEN') {
            return res.status(409).json({ code: 'QC_BATCH_MEMBERSHIP_LOCKED', error: 'Batch is not OPEN' });
        }

        const currentIdsArray = typeof batch.workItemIds === 'string' ? JSON.parse(batch.workItemIds) : (batch.workItemIds || []);
        const toRemove = new Set(workItemIds);
        const remainingIds = currentIdsArray.filter(wid => !toRemove.has(wid));

        await prisma.$transaction(async tx => {
            const currentBatch = await tx.batch.findUnique({ where: { id } });
            if (!currentBatch || currentBatch.status !== BATCH_STATES.OPEN || currentBatch.workItemIds !== batch.workItemIds) {
                throw batchError(409, { code: 'QC_BATCH_MEMBERSHIP_LOCKED', error: 'Batch changed while removing items; reload the OPEN batch.' });
            }
            await tx.batch.update({
                where: { id },
                data: { workItemIds: JSON.stringify(remainingIds) }
            });
            await tx.workItem.updateMany({
                where: { id: { in: workItemIds }, batchId: id },
                data: { batchId: null, rackPosition: null }
            });
        });

        res.json({ success: true, removed: workItemIds.length, remaining: remainingIds.length });
    } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json(error.body);
        console.error('[removeItemsFromBatch] Error:', error);
        res.status(500).json({ error: 'Failed to remove items from batch' });
    }
};

exports.checkItemBatchStatus = async (workItemId) => {
    try {
        const item = await prisma.workItem.findUnique({
            where: { id: workItemId },
            include: { batch: true }
        });

        if (!item || !item.batchId) {
            // Legacy no-batch methods remain supported until the method-level policy in #187.
            return { batchId: null, status: 'N/A', allowed: true };
        }

        if (!item.batch) return { batchId: item.batchId, status: 'ERROR', allowed: false };

        const batch = item.batch;
        let disposition = null;
        if (batch.disposition) {
            try {
                disposition = typeof batch.disposition === 'string' ? JSON.parse(batch.disposition) : batch.disposition;
            } catch (e) { }
        }

        return { ...checkBatchDisposition(batch), batchId: item.batchId, disposition };
    } catch (error) {
        console.error('[checkItemBatchStatus] Error:', error);
        return { batchId: null, status: 'ERROR', allowed: false };
    }
};

exports.dispositionBatch = async (req, res) => {
    try {
        const { decision, reason } = req.body;
        const outcome = await require('../services/qcDispositionStateService').dispositionBatch(req.params.id, decision, reason, req.user);
        return res.json(outcome);
    } catch (err) {
        if (!err.statusCode) console.error('[dispositionBatch] Error:', err);
        return res.status(err.statusCode || 500).json({ error: err.code || err.message, message: err.message,
            ...(err.code && { code: err.code }), ...(err.details || {}) });
    }
};

exports.RUN_PROFILES = policyService.getStrict('qc.runProfiles');
exports.resolveRunProfile = resolveRunProfile;
