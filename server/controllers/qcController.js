const crypto = require('crypto');
const prisma = require('../prisma');
const { evaluateBatchQc, checkBatchDisposition, flagBatchResults } = require('../services/qcService');
const scopeGuard = require('../utils/scopeGuard');

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
async function syncTypedQcItems(batchId, evaluated) {
    if (!evaluated) return;
    try {
        await prisma.batchQcResult.deleteMany({ where: { batchId } });

        const items = [];
        (evaluated.blanks || []).forEach((b, idx) => {
            items.push({
                id: b.id || `BLK-${batchId}-${idx}-${Date.now()}`,
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
                details: b.details || null
            });
        });

        (evaluated.duplicates || []).forEach((d, idx) => {
            items.push({
                id: d.id || `DUP-${batchId}-${idx}-${Date.now()}`,
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
                details: d.details || null
            });
        });

        (evaluated.controls || []).forEach((c, idx) => {
            items.push({
                id: c.id || `CRM-${batchId}-${idx}-${Date.now()}`,
                batchId,
                type: 'CONTROL',
                label: c.label || 'Certified Reference Material',
                expected: c.expected !== null && c.expected !== undefined ? Number(c.expected) : null,
                measured: c.measured !== null && c.measured !== undefined ? Number(c.measured) : null,
                value1: null,
                value2: null,
                recoveryPct: c.recoveryPct !== null && c.recoveryPct !== undefined ? Number(c.recoveryPct) : null,
                rpd: null,
                status: c.status || 'PASS',
                details: c.details || null
            });
        });

        if (items.length > 0) {
            await prisma.batchQcResult.createMany({ data: items });
        }
    } catch (e) {
        console.error('[syncTypedQcItems] Error syncing typed QC rows:', e);
    }
}

const RUN_PROFILES = {
    // 96-well microplate methods (e.g. spectrophotometric microplate assays)
    MICROPLATE_96: {
        profileKey: 'MICROPLATE_96',
        capacity: 96,
        name: '96-Well Microplate',
        qcSlots: [
            { position: 1, type: 'BLANK', label: 'Reagent Blank' },
            { position: 2, type: 'CONTROL', label: 'Standard Soil CRM' },
            { position: 48, type: 'DUPLICATE', label: 'Mid-plate Duplicate' },
            { position: 96, type: 'DUPLICATE', label: 'End-plate Duplicate' }
        ]
    },
    // 24-place centrifuge or digestion block
    CENTRIFUGE_24: {
        profileKey: 'CENTRIFUGE_24',
        capacity: 24,
        name: '24-Place Tube Rack / Digestion Block',
        qcSlots: [
            { position: 1, type: 'BLANK', label: 'Method Blank' },
            { position: 2, type: 'CONTROL', label: 'Reference Soil CRM' },
            { position: 12, type: 'DUPLICATE', label: 'Mid-run Duplicate' }
        ]
    },
    // 40-place standard sedimentation / pipette / hydrometer rack / carousel (Standard practical UAT profile)
    RACK_40: {
        profileKey: 'RACK_40',
        capacity: 40,
        name: '40-Place Sedimentation / Carousel Rack',
        qcSlots: [
            { position: 1, type: 'BLANK', label: 'Reagent / Hydrometer Blank' },
            { position: 2, type: 'CONTROL', label: 'Standard Soil CRM' },
            { position: 20, type: 'DUPLICATE', label: 'Mid-rack Duplicate' },
            { position: 40, type: 'DUPLICATE', label: 'End-rack Duplicate' }
        ]
    }
};

function resolveRunProfile(analysis, instrument, requestedCapacity, requestedProfile) {
    if (requestedProfile && RUN_PROFILES[requestedProfile]) {
        return { ...RUN_PROFILES[requestedProfile] };
    }
    const inst = (instrument || '').toLowerCase();
    if (inst.includes('microplate') || inst.includes('elisa') || inst.includes('96') || requestedCapacity === 96) {
        return { ...RUN_PROFILES.MICROPLATE_96 };
    }
    if (inst.includes('centrifuge') || inst.includes('digest') || inst.includes('block') || inst.includes('24') || requestedCapacity === 24) {
        return { ...RUN_PROFILES.CENTRIFUGE_24 };
    }
    const base = { ...RUN_PROFILES.RACK_40 };
    if (typeof requestedCapacity === 'number' && requestedCapacity > 0) {
        base.capacity = requestedCapacity;
    }
    return base;
}

exports.createBatch = async (req, res) => {
    const { id, analysis, instrument, notes, profile: reqProfile, capacity: reqCapacity, maxCapacity: reqMaxCap } = req.body;
    const user = req.user;

    try {
        if (!analysis) return res.status(400).json({ error: 'Analysis type required' });

        const batchId = (typeof id === 'string' && id.trim()) ? id.trim() : `BATCH-${Date.now()}`;
        const now = new Date();

        const runProfile = resolveRunProfile(analysis, instrument, reqMaxCap || reqCapacity, reqProfile);

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
                id: `audit-batch-cr-${Date.now()}`,
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

        const dataWithProfiles = batches.map(b => ({
            ...b,
            runProfile: resolveRunProfile(b.analysis, b.instrument, b.maxCapacity, b.profile)
        }));

        res.json({ data: dataWithProfiles });
    } catch (error) {
        console.error('[getBatches] Error:', error);
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

        const runProfile = resolveRunProfile(batch.analysis, batch.instrument, batch.maxCapacity, batch.profile);

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
        const batch = await prisma.batch.findUnique({ where: { id } });
        if (!batch) return res.status(404).json({ error: 'Batch not found' });

        if (!scopeGuard.canAccessEntity(user, batch, { labField: 'labId' })) {
            return res.status(403).json({ error: 'Access denied: Batch outside your laboratory scope' });
        }

        if (batch.status === BATCH_STATES.CLOSED) {
            return res.status(400).json({ error: 'Batch is CLOSED and cannot be modified.' });
        }

        const runProfile = resolveRunProfile(batch.analysis, batch.instrument, batch.maxCapacity, batch.profile);

        // Restrict updates to explicitly allowed fields; membership & disposition are managed via dedicated routes
        const data = {};
        if (updates.notes !== undefined) data.notes = updates.notes;
        if (updates.instrument !== undefined) data.instrument = updates.instrument;

        let evaluated = null;

        // Auto-evaluate QC data if provided
        const hasQcPayload = !!(updates.qcResults || updates.blanks || updates.duplicates || updates.controls);
        if (hasQcPayload) {
            const qcPayload = updates.qcResults || {
                blanks: updates.blanks,
                duplicates: updates.duplicates,
                controls: updates.controls
            };
            evaluated = evaluateBatchQc(qcPayload, { runProfile });
            data.qcResults = JSON.stringify(evaluated);
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
                return res.status(400).json({ error: `Invalid batch status: '${requestedStatus}'. Allowed: ${Object.values(BATCH_STATES).join(', ')}` });
            }

            // Status transitions to QC_PASS or QC_FAIL require evaluated QC evidence or authorized disposition
            if (requestedStatus === BATCH_STATES.QC_PASS || requestedStatus === BATCH_STATES.QC_FAIL) {
                if (evaluated) {
                    if (requestedStatus === BATCH_STATES.QC_PASS && evaluated.overallStatus === BATCH_STATES.QC_FAIL) {
                        return res.status(400).json({
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
                        return res.status(400).json({
                            error: `Cannot set status to '${requestedStatus}' without evaluated QC evidence or authorized disposition.`
                        });
                    }

                    if (requestedStatus === BATCH_STATES.QC_PASS && existingQc.overallStatus === BATCH_STATES.QC_FAIL) {
                        // Only allowed if manager disposition exists with PROCEED_WITH_WARNING
                        let disposition = null;
                        try {
                            disposition = typeof batch.disposition === 'string' ? JSON.parse(batch.disposition) : batch.disposition;
                        } catch (e) {}

                        if (!disposition || disposition.decision !== 'PROCEED_WITH_WARNING' || !['LAB_MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
                            return res.status(400).json({
                                error: 'Cannot set status to QC_PASS: existing QC results are failed and no manager disposition override exists.'
                            });
                        }
                    }
                    data.status = requestedStatus;
                }
            } else if (requestedStatus === BATCH_STATES.CLOSED) {
                if (!['LAB_MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
                    return res.status(403).json({ error: 'Only lab managers can close batches.' });
                }
                let disposition = null;
                try {
                    disposition = typeof batch.disposition === 'string' ? JSON.parse(batch.disposition) : batch.disposition;
                } catch (e) {}
                const canClose = batch.status === BATCH_STATES.QC_PASS ||
                    (batch.status === BATCH_STATES.QC_FAIL && disposition?.decision === 'PROCEED_WITH_WARNING');
                if (!canClose) {
                    return res.status(400).json({
                        error: 'Cannot close batch: QC must be passed or approved with manager disposition before closing.'
                    });
                }
                data.status = BATCH_STATES.CLOSED;
            } else if (requestedStatus === BATCH_STATES.OPEN || requestedStatus === BATCH_STATES.RUNNING) {
                // Technician or manager can move between OPEN and RUNNING
                data.status = requestedStatus;
            }
        }

        if (data.status && data.status !== batch.status) {
            const history = typeof batch.history === 'string' ? JSON.parse(batch.history) : (batch.history || []);
            history.push({
                status: data.status,
                changedBy: user.username,
                timestamp: new Date()
            });
            data.history = JSON.stringify(history);
        }

        const updatedBatch = await prisma.batch.update({
            where: { id },
            data,
            include: { qcItems: true }
        });

        // WP-29: Sync typed BatchQcResult rows and flag results carrying batchId
        if (evaluated) {
            await syncTypedQcItems(id, evaluated);
        }
        if (data.status) {
            await flagBatchResults(prisma, id, updatedBatch.status, updatedBatch.disposition);
        }

        res.json({
            success: true,
            id: updatedBatch.id,
            status: updatedBatch.status,
            batch: updatedBatch
        });
    } catch (error) {
        console.error('[updateBatch] Error:', error);
        res.status(500).json({ error: 'Failed to update batch' });
    }
};

exports.evaluateBatch = async (req, res) => {
    const { id } = req.params;
    const { blanks, duplicates, controls } = req.body;
    const user = req.user;

    try {
        const batch = await prisma.batch.findUnique({ where: { id } });
        if (!batch) return res.status(404).json({ error: 'Batch not found' });

        if (!scopeGuard.canAccessEntity(user, batch, { labField: 'labId' })) {
            return res.status(403).json({ error: 'Access denied: Batch outside your laboratory scope' });
        }

        if (batch.status === BATCH_STATES.CLOSED) {
            return res.status(400).json({ error: 'Batch is CLOSED and cannot be evaluated or modified.' });
        }

        const runProfile = resolveRunProfile(batch.analysis, batch.instrument, batch.maxCapacity, batch.profile);
        const evaluated = evaluateBatchQc({ blanks, duplicates, controls }, { runProfile });
        const newStatus = evaluated.overallStatus; // 'QC_PASS', 'QC_FAIL', or 'OPEN' (when empty, invalidates QC_PASS)

        const history = typeof batch.history === 'string' ? JSON.parse(batch.history) : (batch.history || []);
        if (newStatus !== batch.status) {
            history.push({
                status: newStatus,
                changedBy: user.username,
                timestamp: new Date()
            });
        }

        const updatedBatch = await prisma.batch.update({
            where: { id },
            data: {
                qcResults: JSON.stringify(evaluated),
                status: newStatus,
                history: JSON.stringify(history),
                disposition: null // Clear stale disposition on new evaluation
            },
            include: { qcItems: true }
        });

        // WP-29: Sync typed rows and flag results
        await syncTypedQcItems(id, evaluated);
        await flagBatchResults(prisma, id, newStatus, null);

        res.json({
            success: true,
            status: newStatus,
            evaluation: evaluated,
            batch: updatedBatch
        });
    } catch (error) {
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

        if (batch.status !== 'OPEN') {
            return res.status(400).json({ error: 'Batch is not OPEN' });
        }

        if (!scopeGuard.canAccessEntity(user, batch, { labField: 'labId' })) {
            return res.status(403).json({ error: 'Access denied: Batch outside your laboratory scope' });
        }

        const currentIdsArray = typeof batch.workItemIds === 'string' ? JSON.parse(batch.workItemIds) : (batch.workItemIds || []);
        const currentIds = new Set(currentIdsArray);

        // Resolve method/instrument profile capacity and reserved QC slots
        const runProfile = resolveRunProfile(batch.analysis, batch.instrument, batch.maxCapacity, batch.profile);
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

        const workItemUpdates = [];
        for (const wid of workItemIds) {
            currentIds.add(wid);
            workItemUpdates.push(
                prisma.workItem.update({
                    where: { id: wid },
                    data: {
                        batchId: id,
                        rackPosition: finalPositions[wid]
                    }
                })
            );
        }

        await prisma.$transaction([
            prisma.batch.update({
                where: { id },
                data: { workItemIds: JSON.stringify(Array.from(currentIds)) }
            }),
            ...workItemUpdates
        ]);

        res.json({
            success: true,
            count: workItemIds.length,
            capacity,
            runProfile: runProfile.profileKey,
            positions: finalPositions
        });
    } catch (error) {
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
            return res.status(400).json({ error: 'Batch is not OPEN' });
        }

        const currentIdsArray = typeof batch.workItemIds === 'string' ? JSON.parse(batch.workItemIds) : (batch.workItemIds || []);
        const toRemove = new Set(workItemIds);
        const remainingIds = currentIdsArray.filter(wid => !toRemove.has(wid));

        await prisma.$transaction([
            prisma.batch.update({
                where: { id },
                data: { workItemIds: JSON.stringify(remainingIds) }
            }),
            prisma.workItem.updateMany({
                where: { id: { in: workItemIds }, batchId: id },
                data: { batchId: null, rackPosition: null }
            })
        ]);

        res.json({ success: true, removed: workItemIds.length, remaining: remainingIds.length });
    } catch (error) {
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

        if (!item || !item.batchId || !item.batch) {
            return { batchId: null, status: 'N/A' };
        }

        const batch = item.batch;
        let disposition = null;
        if (batch.disposition) {
            try {
                disposition = typeof batch.disposition === 'string' ? JSON.parse(batch.disposition) : batch.disposition;
            } catch (e) { }
        }

        // If batch failed but has PROCEED_WITH_WARNING disposition from manager, allow downstream acceptance!
        if (batch.status === 'QC_FAIL' && disposition && disposition.decision === 'PROCEED_WITH_WARNING') {
            return { batchId: item.batchId, status: 'QC_PASS_WITH_WARNING', disposition };
        }

        return { batchId: item.batchId, status: item.batch.status, disposition };
    } catch (error) {
        console.error('[checkItemBatchStatus] Error:', error);
        return { batchId: null, status: 'ERROR' };
    }
};

const PERMITTED_DISPOSITIONS = ['PROCEED_WITH_WARNING', 'REANALYZE_BATCH', 'REJECT_BATCH'];

exports.dispositionBatch = async (req, res) => {
    const { id } = req.params;
    const { decision, reason } = req.body;
    const user = req.user;

    try {
        if (!decision || !reason || !String(reason).trim()) {
            return res.status(400).json({ error: 'Decision and non-empty reason are required' });
        }

        if (!PERMITTED_DISPOSITIONS.includes(decision)) {
            return res.status(400).json({
                error: 'INVALID_DISPOSITION_DECISION',
                message: `Decision must be one of: ${PERMITTED_DISPOSITIONS.join(', ')}`
            });
        }

        const trimmedReason = String(reason).trim();
        if (trimmedReason.length < 5) {
            return res.status(400).json({ error: 'A meaningful reason (minimum 5 characters) is required' });
        }

        if (!['LAB_MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
            return res.status(403).json({ error: 'Manager only' });
        }

        // Transactional read, CAS conflict check, and atomic write
        const txResult = await prisma.$transaction(async (tx) => {
            const batch = await tx.batch.findUnique({ where: { id } });
            if (!batch) {
                const err = new Error('Batch not found');
                err.statusCode = 404;
                throw err;
            }

            if (!scopeGuard.canAccessEntity(user, batch, { labField: 'labId' })) {
                const err = new Error('Access denied: Batch outside your laboratory scope');
                err.statusCode = 403;
                throw err;
            }

            if (batch.status !== 'QC_FAIL') {
                const err = new Error('Batch is not in QC_FAIL state');
                err.statusCode = 400;
                throw err;
            }

            // Idempotency vs Conflicting Decision Check inside transaction
            let existingDisp = null;
            if (batch.disposition) {
                try {
                    existingDisp = typeof batch.disposition === 'string' ? JSON.parse(batch.disposition) : batch.disposition;
                } catch (e) {}
            }

            if (existingDisp && existingDisp.decision) {
                if (existingDisp.decision === decision && existingDisp.reason === trimmedReason) {
                    return { success: true, disposition: existingDisp, idempotent: true };
                }
                // Conflicting disposition detected!
                const conflictErr = new Error(`Batch '${id}' has already been dispositioned with decision '${existingDisp.decision}'. Conflicting disposition rejected.`);
                conflictErr.statusCode = 409;
                conflictErr.code = 'DISPOSITION_CONFLICT';
                throw conflictErr;
            }

            const now = new Date();
            const disposition = {
                decision,
                reason: trimmedReason,
                by: user.username,
                at: now
            };

            const history = typeof batch.history === 'string' ? JSON.parse(batch.history) : (batch.history || []);
            history.push({
                status: batch.status,
                disposition: decision,
                reason: trimmedReason,
                changedBy: user.username,
                timestamp: now
            });

            // 1. Update Batch disposition and history
            await tx.batch.update({
                where: { id },
                data: {
                    disposition: JSON.stringify(disposition),
                    history: JSON.stringify(history)
                }
            });

            // 2. Link reanalysis/rejection task workflow to associated active WorkItems (protecting historical accepted work and released sample histories)
            const allBatchWorkItems = await tx.workItem.findMany({
                where: { batchId: id },
                include: { sample: { select: { id: true, status: true } } }
            });

            // Distinguish recorded completion from immutable accepted/released scientific history (R3):
            // Work items that are ACCEPTED or RELEASED, or belong to RELEASED/ARCHIVED/DISPOSED samples,
            // are immutable scientific history and MUST be preserved.
            // Work items in COMPLETED, SUBMITTED, IN_PROGRESS, or ASSIGNED in the failed batch
            // MUST transition to REANALYSIS_REQUIRED (or REJECTED).
            const eligibleWorkItems = allBatchWorkItems.filter(wi => {
                const isWiImmutable = ['ACCEPTED', 'RELEASED'].includes(wi.status);
                const isSampleImmutable = wi.sample && ['RELEASED', 'ARCHIVED', 'DISPOSED'].includes(wi.sample.status);
                return !isWiImmutable && !isSampleImmutable;
            });

            if (eligibleWorkItems.length > 0) {
                for (const wi of eligibleWorkItems) {
                    const history = typeof wi.history === 'string'
                        ? JSON.parse(wi.history)
                        : (Array.isArray(wi.history) ? wi.history : []);

                    if (decision === 'REANALYZE_BATCH') {
                        history.push({
                            status: 'REANALYSIS_REQUIRED',
                            previousStatus: wi.status,
                            changedBy: user.username,
                            timestamp: now.toISOString(),
                            action: 'REANALYZE_BATCH',
                            reason: trimmedReason
                        });

                        await tx.workItem.update({
                            where: { id: wi.id },
                            data: {
                                status: 'REANALYSIS_REQUIRED',
                                reanalysisReason: trimmedReason,
                                reanalysisRequestedBy: user.username,
                                history: JSON.stringify(history),
                                updatedAt: now
                            }
                        });
                    } else if (decision === 'REJECT_BATCH') {
                        history.push({
                            status: 'REJECTED',
                            previousStatus: wi.status,
                            changedBy: user.username,
                            timestamp: now.toISOString(),
                            action: 'REJECT_BATCH',
                            reason: trimmedReason
                        });

                        await tx.workItem.update({
                            where: { id: wi.id },
                            data: {
                                status: 'REJECTED',
                                history: JSON.stringify(history),
                                updatedAt: now
                            }
                        });
                    }
                }
            }

            // 3. Audit log with unique UUID
            const auditId = `audit-batch-disp-${crypto.randomUUID ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(36).substring(2, 9))}`;
            await tx.auditLog.create({
                data: {
                    id: auditId,
                    entity: 'QC_BATCH',
                    entityId: id,
                    action: 'QC_DISPOSITION',
                    details: `QC batch disposition recorded: ${decision}. Reason: ${trimmedReason}`,
                    performedBy: user.username,
                    timestamp: now
                }
            });

            // 4. Update Result flags atomically inside the same transaction
            await flagBatchResults(tx, id, 'QC_FAIL', disposition);

            return { success: true, disposition };
        });

        res.json(txResult);
    } catch (error) {
        console.error('[dispositionBatch] Error:', error);
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                error: error.code || error.message,
                message: error.message
            });
        }
        res.status(500).json({ error: 'Failed to disposition batch' });
    }
};

exports.RUN_PROFILES = RUN_PROFILES;
exports.resolveRunProfile = resolveRunProfile;
