const prisma = require('../prisma');
const analysisService = require('../services/analysisService');
const workflow = require('../workflowContract');
const validationController = require('./validationController');
const { calculateUsdaTexture } = require('../utils/soilCalculations');
const { broadcastToLab } = require('../wsServer');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/workbench/queue
// Returns work items assigned to the current technician, grouped by analysis.
// Now includes: eligible equipment (with calibration status), gate statuses,
// and version for optimistic locking.
// ─────────────────────────────────────────────────────────────────────────────
exports.getQueue = async (req, res) => {
    const user = req.user;

    try {
        // Fetch all work items assigned to this technician that are actionable
        const actionableStatuses = ['ASSIGNED', 'IN_PROGRESS', 'REANALYSIS_REQUIRED'];
        const items = await prisma.workItem.findMany({
            where: {
                assignedTo: user.username,
                status: { in: actionableStatuses },
                NOT: { analysis: { in: ['SPEC_VIS_NIR', 'SPEC_MIR'] } }
            },
            include: {
                sample: {
                    select: {
                        id: true,
                        originalId: true,
                        labId: true,
                        projectCode: true,
                        status: true,
                        dryingStatus: true,
                        preparationStatus: true,
                        assignedLab: true
                    }
                }
            },
            orderBy: [
                { priority: 'desc' },
                { createdAt: 'asc' }
            ]
        });

        // Fetch all analysis definitions for enrichment
        const analysisCodes = [...new Set(items.map(i => i.analysis))];
        const analyses = await prisma.analysis.findMany({
            where: { code: { in: analysisCodes } },
            select: { code: true, name: true, units: true, validation: true, categoryId: true }
        });
        const analysisMap = {};
        analyses.forEach(a => {
            let validationRules = null;
            if (a.validation) {
                try { validationRules = JSON.parse(a.validation); } catch (e) { /* ignore */ }
            }
            analysisMap[a.code] = { name: a.name, unit: a.units, validation: validationRules, categoryId: a.categoryId };
        });

        // Fetch categories
        const categoryIds = [...new Set(analyses.map(a => a.categoryId).filter(Boolean))];
        const categories = await prisma.analysisCategory.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, name: true }
        });
        const categoryMap = {};
        categories.forEach(c => categoryMap[c.id] = c.name);

        // Fetch existing results for these samples/analyses
        const sampleIds = [...new Set(items.map(i => i.sampleId))];
        const existingResults = await prisma.result.findMany({
            where: {
                sampleId: { in: sampleIds },
                param: { in: analysisCodes }
            }
        });
        const resultMap = {};
        existingResults.forEach(r => {
            resultMap[`${r.sampleId}::${r.param}`] = { value: r.value, unit: r.unit };
        });

        // ─── Fix 2: Prefetch equipment eligibility per analysis/lab ───
        const labIds = [...new Set(items.map(i => i.sample?.assignedLab || i.labId).filter(Boolean))];
        const equipReqs = await prisma.equipmentMethodEligibility.findMany({
            where: {
                labId: { in: labIds },
                analysisCode: { in: analysisCodes }
            }
        });
        const equipReqMap = {};
        equipReqs.forEach(e => {
            equipReqMap[`${e.labId}::${e.analysisCode}`] = {
                isRequired: e.isRequired,
                eligibleIds: e.eligibleEquipmentIds ? JSON.parse(e.eligibleEquipmentIds) : []
            };
        });

        // ─── Fix 2: Resolve eligible equipment IDs → actual assets with calibration ───
        const allEligibleIds = [...new Set(
            Object.values(equipReqMap).flatMap(e => e.eligibleIds)
        )].filter(Boolean);

        let assetMap = {};
        if (allEligibleIds.length > 0) {
            const assets = await prisma.equipmentAsset.findMany({
                where: { id: { in: allEligibleIds }, status: 'IN_SERVICE' },
                select: {
                    id: true, name: true, assetType: true, status: true,
                    qualification: {
                        select: { calibrationStatus: true, nextCalibrationDueDate: true }
                    }
                }
            });
            assets.forEach(a => {
                assetMap[a.id] = {
                    id: a.id,
                    name: a.name,
                    assetType: a.assetType,
                    calibrationStatus: a.qualification?.calibrationStatus || 'NOT_CONFIGURED',
                    nextCalibrationDue: a.qualification?.nextCalibrationDueDate || null
                };
            });
        }

        // Group by analysis
        const groupsMap = {};
        for (const item of items) {
            const code = item.analysis;
            const labId = item.sample?.assignedLab || item.labId;
            const equipKey = `${labId}::${code}`;

            if (!groupsMap[code]) {
                const meta = analysisMap[code] || {};
                const categoryName = meta.categoryId ? (categoryMap[meta.categoryId] || 'Uncategorized') : 'Uncategorized';

                // Build eligible equipment list for this group
                const eligibleIds = equipReqMap[equipKey]?.eligibleIds || [];
                const eligibleEquipment = eligibleIds
                    .map(id => assetMap[id])
                    .filter(Boolean);

                groupsMap[code] = {
                    analysis: code,
                    analysisName: meta.name || code,
                    category: categoryName,
                    unit: meta.unit || null,
                    validation: meta.validation || null,
                    equipmentRequired: equipReqMap[equipKey]?.isRequired || false,
                    eligibleEquipment,
                    items: []
                };
            }

            const resultKey = `${item.sampleId}::${code}`;

            groupsMap[code].items.push({
                workItemId: item.id,
                sampleId: item.sampleId,
                labId: item.sample?.labId || item.labId,
                originalId: item.sample?.originalId || null,
                projectCode: item.sample?.projectCode || null,
                status: item.status,
                priority: item.priority,
                currentResult: resultMap[resultKey]?.value || item.result || null,
                currentUnit: resultMap[resultKey]?.unit || null,
                equipmentId: item.equipmentId || null,
                equipmentRequired: equipReqMap[equipKey]?.isRequired || false,
                dryingStatus: item.sample?.dryingStatus || 'PENDING',
                preparationStatus: item.sample?.preparationStatus || 'PENDING',
                sampleStatus: item.sample?.status || null,
                version: item.version,
                category: groupsMap[code].category
            });
        }

        // Sort groups: Operational Gates first, then alphabetically
        const groups = Object.values(groupsMap).sort((a, b) => {
            if (a.category === 'Operational Gates' && b.category !== 'Operational Gates') return -1;
            if (b.category === 'Operational Gates' && a.category !== 'Operational Gates') return 1;
            return a.analysisName.localeCompare(b.analysisName);
        });

        // Stats
        const stats = {
            totalPending: items.filter(i => i.status === 'ASSIGNED').length,
            totalInProgress: items.filter(i => i.status === 'IN_PROGRESS').length,
            totalReanalysis: items.filter(i => i.status === 'REANALYSIS_REQUIRED').length,
            totalGroups: groups.length,
            totalItems: items.length
        };

        res.json({ groups, stats });
    } catch (error) {
        console.error('[workbench.getQueue] Error:', error);
        res.status(500).json({ error: 'Failed to fetch workbench queue' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/workbench/batch-save
// Body: { entries: [{ workItemId, value, equipmentId?, version, overrideReason? }], draft: bool }
//
// Fixes applied:
//   Fix 3 – Workflow transition enforcement via isValidWorkItemTransition
//   Fix 3 – Optimistic version lock (where: { id, version })
//   Fix 4 – Out-of-range values block completion unless manager + overrideReason
//   Fix 2b – Equipment eligibility prefetched before the loop
// ─────────────────────────────────────────────────────────────────────────────
exports.batchSave = async (req, res) => {
    const { entries, draft = true } = req.body;
    const user = req.user;

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ error: 'entries array is required and must not be empty' });
    }

    try {
        const now = new Date();
        const workItemIds = entries.map(e => e.workItemId);

        // Fetch all work items
        const workItems = await prisma.workItem.findMany({
            where: { id: { in: workItemIds } },
            include: {
                sample: {
                    select: {
                        id: true, status: true, labId: true, assignedLab: true,
                        dryingStatus: true, preparationStatus: true
                    }
                }
            }
        });

        const itemMap = {};
        workItems.forEach(wi => itemMap[wi.id] = wi);

        // Load analysis definitions for validation
        const methods = await analysisService.loadAnalyses();
        const methodMap = {};
        methods.forEach(m => methodMap[m.code] = m);

        // ─── Fix 2b: Prefetch equipment eligibility + assets before the loop ───
        const labCodes = [...new Set(workItems.map(wi => wi.sample?.assignedLab || wi.sample?.labId).filter(Boolean))];
        const analysisCodes = [...new Set(workItems.map(wi => wi.analysis))];

        const equipMappings = await prisma.equipmentMethodEligibility.findMany({
            where: { labId: { in: labCodes }, analysisCode: { in: analysisCodes } }
        });
        const equipReqMap = {};
        equipMappings.forEach(e => {
            equipReqMap[`${e.labId}::${e.analysisCode}`] = {
                isRequired: e.isRequired,
                eligibleIds: e.eligibleEquipmentIds ? JSON.parse(e.eligibleEquipmentIds) : []
            };
        });

        // Prefetch all referenced equipment assets
        const allEquipIds = [
            ...new Set([
                ...Object.values(equipReqMap).flatMap(e => e.eligibleIds),
                ...entries.map(e => e.equipmentId).filter(Boolean)
            ])
        ];
        let assetMap = {};
        if (allEquipIds.length > 0) {
            const assets = await prisma.equipmentAsset.findMany({
                where: { id: { in: allEquipIds } },
                select: { id: true, status: true }
            });
            assets.forEach(a => assetMap[a.id] = a);
        }

        const results = [];
        const errors = [];
        // Collect operations per work‐item keyed by workItemId for sequential $transaction
        const operationBundles = [];

        // Build an entry map for version lookup
        const entryMap = {};
        entries.forEach(e => entryMap[e.workItemId] = e);

        for (const entry of entries) {
            const item = itemMap[entry.workItemId];
            if (!item) {
                errors.push({ workItemId: entry.workItemId, error: 'Work item not found' });
                continue;
            }

            // Permission check
            if (user.role === 'LAB_TECHNICIAN' && item.assignedTo !== user.username) {
                errors.push({ workItemId: entry.workItemId, error: 'Not assigned to you' });
                continue;
            }

            // Sealed check
            const sealedStates = ['SUBMITTED', 'ACCEPTED', 'WAIVED'];
            if (sealedStates.includes(item.status)) {
                errors.push({ workItemId: entry.workItemId, error: `Item is sealed (${item.status})` });
                continue;
            }

            const sample = item.sample;
            if (!sample) {
                errors.push({ workItemId: entry.workItemId, error: 'Sample not found' });
                continue;
            }

            // Skip empty values for draft mode
            if (draft && (entry.value === null || entry.value === undefined || entry.value === '')) {
                results.push({ workItemId: entry.workItemId, status: 'skipped', validation: { valid: true, flags: [] } });
                continue;
            }

            // Validation
            let validation = { valid: true, flags: [] };
            const value = entry.value;

            if (value !== null && value !== undefined && value !== '') {
                const method = methodMap[item.analysis];
                if (method && method.validation) {
                    const rules = method.validation;
                    if (rules.type === 'numeric') {
                        const numVal = Number(value);
                        if (isNaN(numVal)) {
                            validation = { valid: false, flags: ['INVALID_FORMAT'] };
                        } else {
                            if (rules.min !== undefined && numVal < rules.min) validation.flags.push('BELOW_MIN');
                            if (rules.max !== undefined && numVal > rules.max) validation.flags.push('ABOVE_MAX');
                            if (validation.flags.length > 0) validation.valid = false;
                        }
                    }
                }
            }

            // ─── Fix 3: Compute target status and enforce workflow transitions ───
            // When completing, allow ASSIGNED→COMPLETED by chaining through IN_PROGRESS
            const targetStatus = draft
                ? (item.status === 'ASSIGNED' ? workflow.WORK_ITEM_STATES.IN_PROGRESS : item.status)
                : workflow.WORK_ITEM_STATES.COMPLETED;

            // For completion from ASSIGNED, we allow the jump (implicit IN_PROGRESS step)
            const isCompletionFromAssigned = !draft && item.status === 'ASSIGNED';

            if (!isCompletionFromAssigned && !workflow.isValidWorkItemTransition(item.status, targetStatus)) {
                errors.push({
                    workItemId: entry.workItemId,
                    error: `Cannot transition from ${item.status} to ${targetStatus}. ` +
                        (item.status === 'REANALYSIS_REQUIRED'
                            ? 'This item must be reassigned before results can be entered.'
                            : `Allowed transitions: ${(workflow.WORK_ITEM_TRANSITIONS[item.status] || []).join(', ')}`)
                });
                continue;
            }

            // For non-draft mode, run gate checks
            if (!draft) {
                if (sample.status === 'ON_HOLD') {
                    errors.push({ workItemId: entry.workItemId, error: 'Sample is ON_HOLD — contact your lab manager' });
                    continue;
                }

                if (item.category !== 'Post-Analytical') {
                    if (sample.dryingStatus === 'FAILED') {
                        errors.push({ workItemId: entry.workItemId, error: 'Drying FAILED — sample cannot be processed' });
                        continue;
                    }
                    if (item.analysis === 'DRYING') {
                        const allowedStates = ['ACCEPTED', 'PROCESSING', 'SUBMITTED_PARTIAL'];
                        if (!allowedStates.includes(sample.status)) {
                            errors.push({ workItemId: entry.workItemId, error: `Cannot complete DRYING — sample status is ${sample.status} (needs ACCEPTED or PROCESSING)` });
                            continue;
                        }
                    } else if (item.analysis === 'PREPARATION') {
                        if (sample.dryingStatus !== 'DONE') {
                            errors.push({ workItemId: entry.workItemId, error: 'Drying must be completed before Preparation' });
                            continue;
                        }
                    } else if (item.category !== 'Operational Gates') {
                        if (sample.dryingStatus !== 'DONE' || sample.preparationStatus !== 'DONE') {
                            const missing = [];
                            if (sample.dryingStatus !== 'DONE') missing.push(`Drying (${sample.dryingStatus})`);
                            if (sample.preparationStatus !== 'DONE') missing.push(`Preparation (${sample.preparationStatus})`);
                            errors.push({ workItemId: entry.workItemId, error: `Prerequisites not met: ${missing.join(', ')}` });
                            continue;
                        }
                    }
                }

                // ─── Fix 2b: Equipment validation (prefetched) ───
                const equipLabId = sample.assignedLab || sample.labId;
                const equipKey = `${equipLabId}::${item.analysis}`;
                const equipReq = equipReqMap[equipKey];

                if (entry.equipmentId) {
                    const asset = assetMap[entry.equipmentId];
                    if (!asset || asset.status !== 'IN_SERVICE') {
                        errors.push({ workItemId: entry.workItemId, error: 'Selected equipment is not available (out of service or not found)' });
                        continue;
                    }
                    // Verify it's in the eligible set
                    if (equipReq && equipReq.eligibleIds.length > 0 && !equipReq.eligibleIds.includes(entry.equipmentId)) {
                        errors.push({ workItemId: entry.workItemId, error: 'Selected equipment is not eligible for this analysis method' });
                        continue;
                    }
                } else {
                    if (equipReq?.isRequired && item.category !== 'Operational Gates' && item.category !== 'Post-Analytical') {
                        errors.push({ workItemId: entry.workItemId, error: `Equipment required for ${item.analysis} — select an instrument before completing` });
                        continue;
                    }
                }

                // Block completion if value is empty
                if (value === null || value === undefined || value === '') {
                    errors.push({ workItemId: entry.workItemId, error: 'Result value is required to complete' });
                    continue;
                }

                // ─── Fix 4: Block out-of-range unless manager override ───
                if (!validation.valid) {
                    if (validation.flags.includes('INVALID_FORMAT')) {
                        errors.push({ workItemId: entry.workItemId, error: 'Invalid result format — value must be numeric' });
                        continue;
                    }
                    // Out-of-range (BELOW_MIN / ABOVE_MAX): require override
                    if (!entry.overrideReason || entry.overrideReason.trim() === '') {
                        errors.push({
                            workItemId: entry.workItemId,
                            error: `Result out of range (${validation.flags.join(', ')}). Provide an override reason to complete.`,
                            code: 'OUT_OF_RANGE',
                            flags: validation.flags
                        });
                        continue;
                    }
                    if (user.role === 'LAB_TECHNICIAN') {
                        errors.push({
                            workItemId: entry.workItemId,
                            error: 'Out-of-range results require manager approval. Save as draft and notify your supervisor.',
                            code: 'MANAGER_OVERRIDE_REQUIRED',
                            flags: validation.flags
                        });
                        continue;
                    }
                    // Manager/admin with override reason: allow through, log override
                    validation.overrideReason = entry.overrideReason.trim();
                    validation.overriddenBy = user.username;
                }
            }

            // Build work item update
            const history = typeof item.history === 'string' ? JSON.parse(item.history) : (item.history || []);

            history.push({
                status: targetStatus,
                result: value !== undefined ? 'Result Updated' : null,
                changedBy: user.username,
                timestamp: now,
                action: draft ? 'DRAFT_SAVE' : 'BATCH_COMPLETE',
                ...(validation.overrideReason ? { overrideReason: validation.overrideReason } : {})
            });

            const updateData = {
                status: targetStatus,
                result: value !== undefined && value !== null && value !== '' ? String(value) : item.result,
                equipmentId: entry.equipmentId || item.equipmentId,
                version: { increment: 1 },
                history: JSON.stringify(history),
                updatedAt: now
            };

            if (!draft && targetStatus === 'COMPLETED') {
                updateData.completedAt = now;
            }

            // ─── Fix 3: Optimistic version lock ───
            const expectedVersion = entry.version !== undefined ? entry.version : item.version;
            const ops = [];

            ops.push(prisma.workItem.update({
                where: { id: item.id, version: expectedVersion },
                data: updateData
            }));

            // Create/update Result record (Append-Only with Replicate & History)
            if (value !== undefined && value !== null && value !== '') {
                const method = methodMap[item.analysis];
                const flagsData = validation.flags || [];
                if (validation.overrideReason) {
                    flagsData.push('MANAGER_OVERRIDE');
                }

                const strVal = String(value).trim();
                const isCensored = validation.isCensored || /^[<>]/.test(strVal);
                const censoringType = isCensored ? (strVal.startsWith('<') ? 'BELOW_LOQ' : 'ABOVE_RANGE') : 'NONE';
                let numericVal = null;
                if (isCensored) {
                    const cleanNum = strVal.replace(/^[<>=\s]+/, '').replace(',', '.');
                    numericVal = isNaN(Number(cleanNum)) ? null : Number(cleanNum);
                } else {
                    numericVal = validation.normalizedValue !== undefined ? validation.normalizedValue : (isNaN(Number(strVal.replace(',', '.'))) ? null : Number(strVal.replace(',', '.')));
                }

                const newResultId = `res-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

                // Supersede prior active result for this sample & parameter
                ops.push(prisma.result.updateMany({
                    where: {
                        sampleId: item.sampleId,
                        param: item.analysis,
                        isCurrent: true
                    },
                    data: {
                        isCurrent: false,
                        supersededBy: newResultId
                    }
                }));

                // Append new defensible Result row
                ops.push(prisma.result.create({
                    data: {
                        id: newResultId,
                        sampleId: item.sampleId,
                        param: item.analysis,
                        value: strVal,
                        numericValue: numericVal,
                        unit: method?.unit || null,
                        flags: JSON.stringify(flagsData),
                        isValid: validation.valid,
                        censoring: censoringType,
                        basis: entry.basis || 'AIR_DRY',
                        provenance: entry.provenance || 'MEASURED',
                        methodologyId: method?.id || null,
                        replicateNo: entry.replicateNo || 1,
                        isCurrent: true,
                        enteredBy: user.username,
                        analysedAt: now,
                        equipmentId: entry.equipmentId || item.equipmentId || null,
                        batchId: item.batchId || null,
                        createdAt: now,
                        updatedAt: now
                    }
                }));
            }

            // Handle operational gate side-effects (non-draft only)
            if (!draft && targetStatus === 'COMPLETED') {
                if (item.analysis === 'DRYING') {
                    ops.push(prisma.sample.update({
                        where: { id: String(item.sampleId) },
                        data: { dryingStatus: 'DONE' }
                    }));
                } else if (item.analysis === 'PREPARATION') {
                    ops.push(prisma.sample.update({
                        where: { id: String(item.sampleId) },
                        data: { preparationStatus: 'DONE' }
                    }));
                }

                // Equipment usage log
                if (entry.equipmentId) {
                    ops.push(prisma.workItemEquipmentUse.create({
                        data: {
                            id: `use-${item.id}-${Date.now()}`,
                            labId: item.labId || item.assignedLab,
                            workItemId: item.id,
                            sampleId: item.sampleId,
                            equipmentId: entry.equipmentId,
                            usedAt: now,
                            notes: `Used during ${item.analysis} (batch entry)`
                        }
                    }));
                }
            }

            // Audit log
            ops.push(prisma.auditLog.create({
                data: {
                    id: `audit-wb-${item.id}-${Date.now()}-${Math.random().toString(36).substr(2, 3)}`,
                    entity: 'WORKITEM',
                    entityId: item.id,
                    action: draft ? 'WORKBENCH_DRAFT' : 'WORKBENCH_COMPLETE',
                    details: `${user.username} ${draft ? 'drafted' : 'completed'} ${item.analysis} = ${value}` +
                        (validation.overrideReason ? ` [OVERRIDE: ${validation.overrideReason}]` : ''),
                    performedBy: user.username,
                    timestamp: now,
                    sampleId: String(item.sampleId),
                    analysisCode: item.analysis
                }
            }));

            operationBundles.push({ workItemId: entry.workItemId, ops, validation, draft });

            results.push({
                workItemId: entry.workItemId,
                status: draft ? 'drafted' : 'completed',
                validation,
                newVersion: expectedVersion + 1
            });
        }

        // Execute all operations in a transaction, handling version conflicts
        if (operationBundles.length > 0) {
            const allOps = operationBundles.flatMap(b => b.ops);
            try {
                await prisma.$transaction(allOps);
            } catch (txError) {
                // ─── Fix 3: Handle version conflict (P2025 = record not found) ───
                if (txError.code === 'P2025') {
                    // Determine which items had version conflicts
                    // Re-run individually to identify conflicts
                    const verifiedResults = [];
                    const verifiedErrors = [...errors];

                    for (const bundle of operationBundles) {
                        try {
                            await prisma.$transaction(bundle.ops);
                            verifiedResults.push({
                                workItemId: bundle.workItemId,
                                status: bundle.draft ? 'drafted' : 'completed',
                                validation: bundle.validation
                            });
                        } catch (itemErr) {
                            if (itemErr.code === 'P2025') {
                                verifiedErrors.push({
                                    workItemId: bundle.workItemId,
                                    error: 'Version conflict — this item was modified by another user. Refresh the page to get the latest data.',
                                    code: 'VERSION_CONFLICT'
                                });
                            } else {
                                verifiedErrors.push({
                                    workItemId: bundle.workItemId,
                                    error: `Save failed: ${itemErr.message}`
                                });
                            }
                        }
                    }

                    return res.json({
                        success: verifiedResults.length > 0,
                        draft,
                        saved: verifiedResults.length,
                        errors: verifiedErrors.length > 0 ? verifiedErrors : undefined,
                        results: verifiedResults
                    });
                }
                throw txError;
            }
        }

        // ─── Real-time push: broadcast WORKITEM_CHANGED for drafts AND completions ───
        if (results.length > 0) {
            const affectedSampleIds = [...new Set(
                operationBundles.map(b => {
                    const item = itemMap[b.workItemId];
                    return item?.sampleId;
                }).filter(Boolean)
            )];

            // Auto-derive USDA Texture Class if all 3 fractions (SAND, SILT, CLAY) are present
            if (!draft && affectedSampleIds.length > 0) {
                for (const sampleId of affectedSampleIds) {
                    try {
                        const curResults = await prisma.result.findMany({
                            where: { sampleId, isCurrent: true, param: { in: ['SAND', 'SILT', 'CLAY'] } }
                        });
                        const sandR = curResults.find(r => r.param === 'SAND');
                        const siltR = curResults.find(r => r.param === 'SILT');
                        const clayR = curResults.find(r => r.param === 'CLAY');
                        if (sandR && siltR && clayR) {
                            const tex = calculateUsdaTexture(sandR.numericValue ?? sandR.value, siltR.numericValue ?? siltR.value, clayR.numericValue ?? clayR.value);
                            if (tex.isValid) {
                                const texResultId = `res-tex-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
                                await prisma.result.updateMany({
                                    where: { sampleId, param: 'TEXTURE', isCurrent: true },
                                    data: { isCurrent: false, supersededBy: texResultId }
                                });
                                await prisma.result.create({
                                    data: {
                                        id: texResultId,
                                        sampleId,
                                        param: 'TEXTURE',
                                        value: tex.className,
                                        numericValue: null,
                                        unit: '',
                                        isValid: true,
                                        censoring: 'NONE',
                                        basis: 'AIR_DRY',
                                        replicateNo: 1,
                                        isCurrent: true,
                                        provenance: 'DERIVED',
                                        enteredBy: 'SYSTEM_CALC',
                                        analysedAt: now,
                                        createdAt: now,
                                        updatedAt: now
                                    }
                                });
                            }
                        }
                    } catch (texErr) {
                        console.error('[TEXTURE_CALC_ERR]', texErr.message);
                    }
                }
            }

            if (affectedSampleIds.length > 0) {
                try {
                    // Build per-item update details for real-time patching
                    const updates = operationBundles.map(b => {
                        const item = itemMap[b.workItemId];
                        const entry = entryMap[b.workItemId];
                        return {
                            workItemId: b.workItemId,
                            sampleId: item?.sampleId,
                            analysis: item?.analysis,
                            status: draft ? (item?.status === 'ASSIGNED' ? 'IN_PROGRESS' : item?.status) : 'COMPLETED',
                            result: entry?.value ?? null,
                            isDraft: draft,
                            version: (entry?.version ?? item?.version ?? 0) + 1
                        };
                    });

                    broadcastToLab(user.labId, 'WORKITEM_CHANGED', {
                        sampleIds: affectedSampleIds,
                        updates,
                        updatedBy: user.username,
                        updatedAt: now.toISOString(),
                        action: draft ? 'DRAFT_SAVE' : 'BATCH_COMPLETE',
                        count: results.length
                    });
                } catch (wsErr) {
                    console.error('[WS] Failed to broadcast WORKITEM_CHANGED:', wsErr);
                }
            }
        }

        res.json({
            success: true,
            draft,
            saved: results.length,
            errors: errors.length > 0 ? errors : undefined,
            results
        });
    } catch (error) {
        console.error('[workbench.batchSave] Error:', error);
        res.status(500).json({ error: 'Failed to save batch results' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/workbench/drafts
// Returns work items that are IN_PROGRESS with results (server-side drafts)
// ─────────────────────────────────────────────────────────────────────────────
exports.getDrafts = async (req, res) => {
    const user = req.user;

    try {
        const items = await prisma.workItem.findMany({
            where: {
                assignedTo: user.username,
                status: 'IN_PROGRESS',
                result: { not: null }
            },
            select: {
                id: true,
                analysis: true,
                sampleId: true,
                result: true,
                equipmentId: true
            }
        });

        // Group by analysis
        const drafts = {};
        items.forEach(item => {
            if (!drafts[item.analysis]) drafts[item.analysis] = [];
            drafts[item.analysis].push({
                workItemId: item.id,
                sampleId: item.sampleId,
                value: item.result,
                equipmentId: item.equipmentId
            });
        });

        res.json({ drafts });
    } catch (error) {
        console.error('[workbench.getDrafts] Error:', error);
        res.status(500).json({ error: 'Failed to fetch drafts' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/workbench/drafts/:analysis
// Clears draft values for a specific analysis group
// ─────────────────────────────────────────────────────────────────────────────
exports.clearDrafts = async (req, res) => {
    const { analysis } = req.params;
    const user = req.user;

    try {
        await prisma.workItem.updateMany({
            where: {
                assignedTo: user.username,
                analysis: analysis,
                status: 'IN_PROGRESS'
            },
            data: {
                result: null,
                status: 'ASSIGNED'
            }
        });

        res.json({ success: true, message: `Drafts cleared for ${analysis}` });
    } catch (error) {
        console.error('[workbench.clearDrafts] Error:', error);
        res.status(500).json({ error: 'Failed to clear drafts' });
    }
};

module.exports = exports;
