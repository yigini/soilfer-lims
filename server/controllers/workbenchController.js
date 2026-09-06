const operationalChecklists = require('../data/operationalChecklists.json');
const prisma = require('../prisma');
const analysisService = require('../services/analysisService');
const workflow = require('../workflowContract');
const validationController = require('./validationController');
const draftService = require('../services/draftService');
const validationService = require('../services/workbenchValidationService');
const readinessService = require('../services/workbenchReadinessService');
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
        // Fetch all work items assigned to this technician that are actionable (including spectroscopy)
        const actionableStatuses = ['ASSIGNED', 'IN_PROGRESS', 'REANALYSIS_REQUIRED'];
        const items = await prisma.workItem.findMany({
            where: {
                assignedTo: user.username,
                status: { in: actionableStatuses }
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

        // Fetch user's active drafts
        const userDrafts = await prisma.workItemDraft.findMany({
            where: { userId: user.username }
        });
        const draftMap = {};
        userDrafts.forEach(d => {
            draftMap[d.workItemId] = {
                id: d.id,
                value: d.value,
                values: d.values ? JSON.parse(d.values) : null,
                checks: d.checks ? JSON.parse(d.checks) : null,
                basis: d.basis,
                replicateNo: d.replicateNo,
                instrumentId: d.instrumentId,
                baseVersion: d.baseVersion,
                draftVersion: d.draftVersion,
                conflictValue: d.conflictValue,
                updatedAt: d.updatedAt
            };
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

        // Prefetch active spectral scans for spectral analyses
        const spectralScansList = await prisma.spectralData.findMany({
            where: {
                sampleId: { in: sampleIds },
                isCurrent: true,
                status: { not: 'DELETED' }
            },
            select: {
                id: true,
                sampleId: true,
                labId: true,
                modality: true,
                replicateNo: true,
                status: true,
                qcStatus: true,
                qcFlags: true,
                sourceFormat: true,
                filename: true,
                equipmentId: true,
                timestamp: true
            }
        });
        const spectralMap = {};
        spectralScansList.forEach(s => {
            const key = `${s.sampleId}::${s.modality}`;
            if (!spectralMap[key]) spectralMap[key] = [];
            spectralMap[key].push(s);
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
                const categoryName = operationalChecklists[code] ? 'Operational Gates' : meta.categoryId ? (categoryMap[meta.categoryId] || 'Uncategorized') : 'Uncategorized';

                // Build eligible equipment list for this group
                const eligibleIds = equipReqMap[equipKey]?.eligibleIds || [];
                const eligibleEquipment = eligibleIds
                    .map(id => assetMap[id])
                    .filter(Boolean);

                groupsMap[code] = {
                    analysis: code,
                    analysisName: operationalChecklists[code]?.name || meta.name || await analysisService.getAnalysisName(code),
                    category: categoryName,
                    unit: operationalChecklists[code] ? null : meta.unit || null,
                    validation: meta.validation || null,
                    equipmentRequired: equipReqMap[equipKey]?.isRequired || false,
                    eligibleEquipment,
                    items: []
                };
            }

            const resultKey = `${item.sampleId}::${code}`;
            const itemDraft = draftMap[item.id] || null;
            const selectedEquipId = item.equipmentId || itemDraft?.instrumentId || null;
            const readiness = readinessService.evaluateItemReadiness(item, user, {
                equipReq: equipReqMap[equipKey],
                asset: assetMap[selectedEquipId],
                selectedEquipmentId: selectedEquipId
            });

            const isSpectral = ['SPEC_MIR', 'SPEC_VIS_NIR', 'SPEC_NIR', 'SPEC_FTIR'].includes(code);
            const modality = (code === 'SPEC_MIR' || code === 'SPEC_FTIR') ? 'MIR' : 'NIR';
            const scans = isSpectral ? (spectralMap[`${item.sampleId}::${modality}`] || []) : [];
            const latestScan = scans.length > 0 ? scans[0] : null;

            groupsMap[code].items.push({
                workItemId: item.id,
                sampleId: item.sampleId,
                sampleDisplayId: item.sample?.labId || item.labId || item.sampleId,
                labId: item.sample?.labId || item.labId,
                originalId: item.sample?.originalId || null,
                laboratoryId: item.sample?.assignedLab || item.assignedLab || item.labId || null,
                projectCode: item.sample?.projectCode || null,
                analysis: code,
                analysisCode: code,
                editorKind: isSpectral
                    ? 'SPECTRAL'
                    : (['TEXTURE', 'SOIL_PSD_TEXTURE', 'SOIL_TEXTURE', 'PSA', 'pSA', 'Particle Size Analysis'].includes(code) ? 'TEXTURE' : (groupsMap[code].category === 'Operational Gates' ? 'OPERATIONAL' : 'NUMERIC')),
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
                category: groupsMap[code].category,
                readiness,
                draft: itemDraft,
                spectralScans: isSpectral ? scans : undefined,
                hasSpectrum: scans.length > 0,
                latestSpectralScan: latestScan
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
            totalDrafts: userDrafts.length,
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

            if (!require('../utils/scopeGuard').canAccessEntity(user, sample, { labField: 'assignedLab', altLabField: 'labId' })) {
                errors.push({ workItemId: entry.workItemId, error: 'Work is outside your laboratory scope.', code: 'OUT_OF_SCOPE' });
                continue;
            }

            const checklist = operationalChecklists[item.analysis];
            const isOperationalTask = !!checklist;
            const executionReadiness = readinessService.evaluateItemReadiness(item, user);
            if (!executionReadiness.isReady) {
                errors.push({ workItemId: entry.workItemId, error: executionReadiness.reasons.join('; '), code: 'EXECUTION_BLOCKED' });
                continue;
            }
            if (isOperationalTask && entry.value != null && entry.value !== '') {
                errors.push({ workItemId: entry.workItemId, error: 'Preparation work requires checklist evidence, not a numerical result.', code: 'OPERATIONAL_SCALAR_FORBIDDEN' });
                continue;
            }
            if (isOperationalTask && (!Array.isArray(entry.checks) || entry.checks.length !== checklist.steps.length || entry.checks.some(c => typeof c !== 'boolean'))) {
                errors.push({ workItemId: entry.workItemId, error: 'Supply the complete operational checklist with explicit confirmations.' });
                continue;
            }
            if (isOperationalTask && !draft && !entry.checks.every(c => c === true)) {
                errors.push({ workItemId: entry.workItemId, error: 'Confirm every operational checklist step before completing this work.' });
                continue;
            }

            // HARD BLOCK: Spectral acquisition tasks require spectrometer scans, never scalar values
            const isSpectralAnalysis = ['SPEC_MIR', 'SPEC_VIS_NIR', 'SPEC_NIR', 'SPEC_FTIR'].includes(item.analysis);
            if (isSpectralAnalysis) {
                if (!draft) {
                    errors.push({
                        workItemId: entry.workItemId,
                        error: 'Spectral acquisition tasks require spectrometer scan upload or linked library spectrum. Scalar determinations are forbidden.',
                        code: 'SPECTRAL_SCALAR_FORBIDDEN'
                    });
                    continue;
                } else if (entry.value !== null && entry.value !== undefined && entry.value !== '') {
                    errors.push({
                        workItemId: entry.workItemId,
                        error: 'Scalar numeric values cannot be saved for spectral acquisition tasks.',
                        code: 'SPECTRAL_SCALAR_FORBIDDEN'
                    });
                    continue;
                }
            }

            const isTextureTask = ['TEXTURE', 'SOIL_PSD_TEXTURE', 'SOIL_TEXTURE', 'PSA', 'pSA', 'Particle Size Analysis'].includes(item.analysis);

            let textureFractions = null;
            if (isTextureTask) {
                if (Array.isArray(entry.values)) {
                    textureFractions = { sand: entry.values[0], silt: entry.values[1], clay: entry.values[2] };
                } else if (entry.values && typeof entry.values === 'object') {
                    textureFractions = {
                        sand: entry.values.sand ?? entry.values.SAND ?? entry.values.Sand ?? null,
                        silt: entry.values.silt ?? entry.values.SILT ?? entry.values.Silt ?? null,
                        clay: entry.values.clay ?? entry.values.CLAY ?? entry.values.Clay ?? null
                    };
                }
            }

            const hasTextureDraft = isTextureTask && textureFractions && (
                (textureFractions.sand !== null && textureFractions.sand !== undefined && String(textureFractions.sand).trim() !== '') ||
                (textureFractions.silt !== null && textureFractions.silt !== undefined && String(textureFractions.silt).trim() !== '') ||
                (textureFractions.clay !== null && textureFractions.clay !== undefined && String(textureFractions.clay).trim() !== '')
            );
            const hasScalarDraft = !isOperationalTask && !isTextureTask && (entry.value !== null && entry.value !== undefined && String(entry.value).trim() !== '');
            const hasChecksDraft = isOperationalTask && Array.isArray(entry.checks);

            // Skip empty values for draft mode
            if (draft && !hasChecksDraft && !hasTextureDraft && !hasScalarDraft) {
                results.push({ workItemId: entry.workItemId, status: 'skipped', validation: { valid: true, flags: [] } });
                continue;
            }

            // Validation
            let validation = { valid: true, flags: [] };
            let value = entry.value;
            let textureClassification = null;

            if (isOperationalTask) {
                value = !draft ? JSON.stringify({ revision: checklist.revision, steps: checklist.steps, checks: entry.checks, recordedBy: user.username, recordedAt: now.toISOString() }) : null;
            } else if (isTextureTask) {
                const method = methodMap[item.analysis];
                const methodTolerance = method?.validation?.tolerance ?? 1.0;
                if (!draft) {
                    if (!textureFractions ||
                        textureFractions.sand === null || textureFractions.sand === undefined || String(textureFractions.sand).trim() === '' ||
                        textureFractions.silt === null || textureFractions.silt === undefined || String(textureFractions.silt).trim() === '' ||
                        textureFractions.clay === null || textureFractions.clay === undefined || String(textureFractions.clay).trim() === '') {
                        errors.push({
                            workItemId: entry.workItemId,
                            error: 'All three fractions (Sand, Silt, Clay) are required to complete texture determination.',
                            code: 'INCOMPLETE_FRACTIONS'
                        });
                        continue;
                    }
                    const textVal = validationService.validateTextureFractions(textureFractions, methodTolerance);
                    if (!textVal.isValid) {
                        if (textVal.flags?.includes('INVALID_FORMAT') || textVal.flags?.includes('BELOW_MIN')) {
                            errors.push({
                                workItemId: entry.workItemId,
                                error: 'Invalid fraction format: fractions must be numbers between 0 and 100%',
                                code: 'INVALID_FORMAT'
                            });
                            continue;
                        }
                        if (!entry.overrideReason || entry.overrideReason.trim() === '') {
                            errors.push({
                                workItemId: entry.workItemId,
                                error: textVal.error || `Texture closure check failed. Override reason required.`,
                                code: 'TEXTURE_CLOSURE_FAILED',
                                closureError: textVal.closureError
                            });
                            continue;
                        }
                        if (user.role === 'LAB_TECHNICIAN') {
                            errors.push({
                                workItemId: entry.workItemId,
                                error: 'Texture closure failure requires manager approval. Save as draft and notify your supervisor.',
                                code: 'MANAGER_OVERRIDE_REQUIRED'
                            });
                            continue;
                        }
                        validation.overrideReason = entry.overrideReason.trim();
                        validation.overriddenBy = user.username;
                        validation.flags = ['TEXTURE_CLOSURE_OVERRIDE', 'MANAGER_OVERRIDE'];
                    }
                    textureClassification = textVal;
                    value = textVal.className || 'Loam';
                    validation = { ...validation, valid: textVal.isValid || !!validation.overrideReason, className: textVal.className, code: textVal.code, closureError: textVal.closureError };
                } else if (hasTextureDraft) {
                    const textVal = validationService.validateTextureFractions(textureFractions, methodTolerance);
                    validation = { valid: textVal.isValid, flags: textVal.flags || [], className: textVal.className, code: textVal.code, closureError: textVal.closureError };
                }
            } else if (!isOperationalTask && value !== null && value !== undefined && value !== '') {
                const checked = validationService.validateNumericMethod(value, methodMap[item.analysis]?.validation);
                validation = { ...checked, valid: checked.isValid };
            }

            // ─── Fix 3: Compute target status and enforce workflow transitions ───
            // When completing, allow ASSIGNED→COMPLETED by chaining through IN_PROGRESS
            const targetStatus = draft
                ? (item.status === 'ASSIGNED' ? workflow.WORK_ITEM_STATES.IN_PROGRESS : item.status)
                : workflow.WORK_ITEM_STATES.COMPLETED;

            // For completion from ASSIGNED, we allow the jump (implicit IN_PROGRESS step)
            const isCompletionFromAssigned = !draft && item.status === 'ASSIGNED';

            if (!draft) {
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
            } else if (item.status !== targetStatus) {
                if (!workflow.isValidWorkItemTransition(item.status, targetStatus)) {
                    errors.push({
                        workItemId: entry.workItemId,
                        error: `Cannot transition from ${item.status} to ${targetStatus}. ` +
                            (item.status === 'REANALYSIS_REQUIRED'
                                ? 'This item must be reassigned before results can be entered.'
                                : `Allowed transitions: ${(workflow.WORK_ITEM_TRANSITIONS[item.status] || []).join(', ')}`)
                    });
                    continue;
                }
            }

            // Dedicated draft branch: save strictly to WorkItemDraft without creating Result or completing WorkItem
            if (draft) {
                try {
                    const savedDraft = await draftService.saveDraft(user, {
                        workItemId: item.id,
                        sampleId: item.sampleId,
                        analysis: item.analysis,
                        value: value !== undefined && value !== null ? String(value) : null,
                        values: entry.values || null,
                        checks: entry.checks || null,
                        basis: entry.basis || 'AIR_DRY',
                        replicateNo: entry.replicateNo || 1,
                        instrumentId: entry.equipmentId || item.equipmentId || null,
                        methodologyId: item.methodologyId || null,
                        notes: entry.notes || null,
                        baseVersion: entry.version !== undefined ? entry.version : item.version
                    });
                    results.push({
                        workItemId: entry.workItemId,
                        status: 'drafted',
                        validation,
                        draftId: savedDraft.id,
                        newVersion: item.version
                    });
                } catch (draftErr) {
                    errors.push({ workItemId: entry.workItemId, error: draftErr.message });
                }
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

            if (isOperationalTask) {
                ops.push(prisma.sample.update({
                    where: { id: sample.id, status: sample.status, dryingStatus: sample.dryingStatus, preparationStatus: sample.preparationStatus },
                    data: item.analysis === 'DRYING' ? { dryingStatus: 'DONE' } : { preparationStatus: 'DONE' }
                }));
            }

            // Create/update Result record (Append-Only with Replicate & History)
            if (!isOperationalTask && value !== undefined && value !== null && value !== '') {
                const repNo = (entry.replicateNo !== undefined && entry.replicateNo !== null) ? Number(entry.replicateNo) : 1;
                const validBasis = ['AIR_DRY', 'OVEN_DRY', 'FIELD_MOIST'].includes(entry.basis) ? entry.basis : 'AIR_DRY';

                if (isTextureTask && textureClassification && !draft) {
                    const sandNum = Number(String(textureFractions.sand).replace(',', '.'));
                    const siltNum = Number(String(textureFractions.silt).replace(',', '.'));
                    const clayNum = Number(String(textureFractions.clay).replace(',', '.'));

                    const sandResId = `res-${Date.now()}-sand-${Math.random().toString(36).substr(2, 5)}`;
                    const siltResId = `res-${Date.now()}-silt-${Math.random().toString(36).substr(2, 5)}`;
                    const clayResId = `res-${Date.now()}-clay-${Math.random().toString(36).substr(2, 5)}`;
                    const textResId = `res-${Date.now()}-text-${Math.random().toString(36).substr(2, 5)}`;

                    // Supersede prior active result for SAND, SILT, CLAY, and TEXTURE
                    ops.push(prisma.result.updateMany({
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
                    }));

                    const flagsData = [...(validation.flags || [])];
                    if (validation.overrideReason) flagsData.push('MANAGER_OVERRIDE');

                    // Sand
                    ops.push(prisma.result.create({
                        data: {
                            id: sandResId,
                            sampleId: item.sampleId,
                            param: 'SAND',
                            value: String(sandNum),
                            numericValue: sandNum,
                            unit: '%',
                            flags: JSON.stringify(flagsData),
                            isValid: true,
                            censoring: 'NONE',
                            basis: validBasis,
                            provenance: 'MEASURED',
                            methodologyId: item.methodologyId || null,
                            replicateNo: repNo,
                            isCurrent: true,
                            enteredBy: user.username,
                            analysedAt: now,
                            equipmentId: entry.equipmentId || item.equipmentId || null,
                            batchId: item.batchId || null,
                            createdAt: now,
                            updatedAt: now
                        }
                    }));

                    // Silt
                    ops.push(prisma.result.create({
                        data: {
                            id: siltResId,
                            sampleId: item.sampleId,
                            param: 'SILT',
                            value: String(siltNum),
                            numericValue: siltNum,
                            unit: '%',
                            flags: JSON.stringify(flagsData),
                            isValid: true,
                            censoring: 'NONE',
                            basis: validBasis,
                            provenance: 'MEASURED',
                            methodologyId: item.methodologyId || null,
                            replicateNo: repNo,
                            isCurrent: true,
                            enteredBy: user.username,
                            analysedAt: now,
                            equipmentId: entry.equipmentId || item.equipmentId || null,
                            batchId: item.batchId || null,
                            createdAt: now,
                            updatedAt: now
                        }
                    }));

                    // Clay
                    ops.push(prisma.result.create({
                        data: {
                            id: clayResId,
                            sampleId: item.sampleId,
                            param: 'CLAY',
                            value: String(clayNum),
                            numericValue: clayNum,
                            unit: '%',
                            flags: JSON.stringify(flagsData),
                            isValid: true,
                            censoring: 'NONE',
                            basis: validBasis,
                            provenance: 'MEASURED',
                            methodologyId: item.methodologyId || null,
                            replicateNo: repNo,
                            isCurrent: true,
                            enteredBy: user.username,
                            analysedAt: now,
                            equipmentId: entry.equipmentId || item.equipmentId || null,
                            batchId: item.batchId || null,
                            createdAt: now,
                            updatedAt: now
                        }
                    }));

                    // Derived Texture Class
                    const textFlags = [
                        'DERIVED_USDA_12_CLASS',
                        `SOURCE_SAND_${sandResId}`,
                        `SOURCE_SILT_${siltResId}`,
                        `SOURCE_CLAY_${clayResId}`,
                        `CLOSURE_ERROR_${textureClassification.closureError ?? 0}`,
                        ...flagsData
                    ];
                    ops.push(prisma.result.create({
                        data: {
                            id: textResId,
                            sampleId: item.sampleId,
                            param: 'TEXTURE',
                            value: textureClassification.className,
                            numericValue: null,
                            unit: 'USDA_12_CLASS',
                            flags: JSON.stringify(textFlags),
                            isValid: textureClassification.isValid || !!validation.overrideReason,
                            censoring: 'NONE',
                            basis: validBasis,
                            provenance: 'DERIVED',
                            methodologyId: item.methodologyId || null,
                            replicateNo: repNo,
                            isCurrent: true,
                            enteredBy: user.username,
                            analysedAt: now,
                            equipmentId: entry.equipmentId || item.equipmentId || null,
                            batchId: item.batchId || null,
                            createdAt: now,
                            updatedAt: now
                        }
                    }));

                    // WorkAttempt for defensible metrology
                    ops.push(prisma.workAttempt.create({
                        data: {
                            id: `att-${item.id}-${Date.now()}`,
                            workItemId: item.id,
                            attemptNo: 1,
                            author: user.username,
                            authorName: user.name || user.username,
                            materialAliquot: 'FINE_EARTH_2MM',
                            instrumentId: entry.equipmentId || item.equipmentId || null,
                            qcBatchId: item.batchId || null,
                            version: expectedVersion + 1,
                            status: 'RECORDED',
                            evidenceData: JSON.stringify({
                                fractions: { sand: sandNum, silt: siltNum, clay: clayNum },
                                className: textureClassification.className,
                                closureError: textureClassification.closureError,
                                sourceResultIds: [sandResId, siltResId, clayResId, textResId]
                            }),
                            createdAt: now,
                            updatedAt: now
                        }
                    }));
                } else {
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

                    // Supersede prior active result for this sample & parameter ONLY for the same replicateNo
                    ops.push(prisma.result.updateMany({
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
                            basis: validBasis,
                            provenance: entry.provenance || 'MEASURED',
                            methodologyId: item.methodologyId || null,
                            replicateNo: repNo,
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
            }

            // Both analytical results and operational evidence replace their working draft.
            ops.push(prisma.workItemDraft.deleteMany({ where: { workItemId: item.id } }));

            // Handle operational gate side-effects (non-draft only)
            if (!draft && targetStatus === 'COMPLETED') {
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

        const receipt = !draft && results.length > 0 ? {
            receiptId: `REC-REC-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
            type: 'RECORD',
            action: 'RECORD_RESULTS',
            count: results.length,
            recordedAt: now.toISOString(),
            recordedBy: user.username,
            items: results
        } : null;

        res.json({
            success: true,
            draft,
            saved: results.length,
            receipt,
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
// Returns dedicated drafts from WorkItemDraft
// ─────────────────────────────────────────────────────────────────────────────
exports.getDrafts = async (req, res) => {
    const user = req.user;

    try {
        const drafts = await draftService.getDrafts(user);

        // Group by analysis for client convenience
        const grouped = {};
        drafts.forEach(d => {
            if (!grouped[d.analysis]) grouped[d.analysis] = [];
            grouped[d.analysis].push({
                workItemId: d.workItemId,
                sampleId: d.sampleId,
                value: d.value,
                values: d.values,
                checks: d.checks,
                basis: d.basis,
                replicateNo: d.replicateNo,
                instrumentId: d.instrumentId,
                baseVersion: d.baseVersion,
                draftVersion: d.draftVersion,
                conflictValue: d.conflictValue
            });
        });

        res.json({ drafts: grouped, items: drafts });
    } catch (error) {
        console.error('[workbench.getDrafts] Error:', error);
        res.status(500).json({ error: 'Failed to fetch drafts' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/workbench/drafts/:analysis
// Clears draft values for a specific analysis group without leaving zombie Results
// ─────────────────────────────────────────────────────────────────────────────
exports.clearDrafts = async (req, res) => {
    const { analysis } = req.params;
    const user = req.user;

    try {
        const userDrafts = await prisma.workItemDraft.findMany({
            where: {
                userId: user.username,
                ...(analysis && analysis !== 'all' ? { analysis } : {})
            }
        });

        const workItemIds = userDrafts.map(d => d.workItemId);

        // Delete from WorkItemDraft
        await prisma.workItemDraft.deleteMany({
            where: {
                id: { in: userDrafts.map(d => d.id) }
            }
        });

        // Revert work items if in progress and uncompleted
        if (workItemIds.length > 0) {
            await prisma.workItem.updateMany({
                where: {
                    id: { in: workItemIds },
                    status: 'IN_PROGRESS',
                    completedAt: null
                },
                data: {
                    status: 'ASSIGNED'
                }
            });
        }

        // Log audit event
        await prisma.auditLog.create({
            data: {
                id: `audit-clear-drafts-${user.username}-${Date.now()}`,
                entity: 'WorkItemDraft',
                action: 'DRAFT_DISCARDED',
                performedBy: user.username,
                details: `Cleared ${userDrafts.length} drafts for ${analysis}`,
                timestamp: new Date()
            }
        }).catch(() => {});

        res.json({ success: true, message: `Drafts cleared for ${analysis}`, count: userDrafts.length });
    } catch (error) {
        console.error('[workbench.clearDrafts] Error:', error);
        res.status(500).json({ error: 'Failed to clear drafts' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/workbench/drafts/item/:workItemId
// Discard a single draft determination with receipt
// ─────────────────────────────────────────────────────────────────────────────
exports.discardDraft = async (req, res) => {
    const { workItemId } = req.params;
    const user = req.user;

    try {
        const result = await draftService.discardDraft(user, workItemId);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/workbench/drafts/item/:workItemId/resolve-conflict
// Resolve a concurrency conflict on a draft
// ─────────────────────────────────────────────────────────────────────────────
exports.resolveConflict = async (req, res) => {
    const { workItemId } = req.params;
    const { resolution, reason } = req.body;
    const user = req.user;

    try {
        const result = await draftService.resolveConflict(user, workItemId, { resolution, reason });
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/workbench/v2/completion/preview
// Preflight check of items to record: separates into included vs excluded with reasons
// ─────────────────────────────────────────────────────────────────────────────
exports.previewCompletion = async (req, res) => {
    const { entries } = req.body;
    const user = req.user;

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ error: 'entries array is required and must not be empty' });
    }

    try {
        const workItemIds = entries.map(e => e.workItemId);
        const workItems = await prisma.workItem.findMany({
            where: { id: { in: workItemIds } },
            include: { sample: true }
        });
        const itemMap = {};
        workItems.forEach(wi => itemMap[wi.id] = wi);

        const methods = await analysisService.loadAnalyses();
        const methodMap = {};
        methods.forEach(m => methodMap[m.code] = m);

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
                select: {
                    id: true, name: true, status: true,
                    qualification: { select: { calibrationStatus: true } }
                }
            });
            assets.forEach(a => assetMap[a.id] = {
                id: a.id,
                name: a.name,
                status: a.status,
                calibrationStatus: a.qualification?.calibrationStatus || 'NOT_CONFIGURED'
            });
        }

        const included = [];
        const excluded = [];

        for (const entry of entries) {
            const item = itemMap[entry.workItemId];
            if (!item) {
                excluded.push({
                    workItemId: entry.workItemId,
                    reasons: ['Work item not found'],
                    blockers: ['NOT_FOUND']
                });
                continue;
            }

            const scopeGuard = require('../utils/scopeGuard');
            if (item.sample && !scopeGuard.canAccessEntity(user, item.sample, { labField: 'assignedLab', altLabField: 'labId' })) {
                excluded.push({
                    workItemId: item.id,
                    sampleId: item.sampleId,
                    blockers: ['OUT_OF_SCOPE'],
                    reasons: ['Work is outside your laboratory scope']
                });
                continue;
            }

            const labId = item.sample?.assignedLab || item.sample?.labId || item.labId;
            const equipKey = `${labId}::${item.analysis}`;
            const equipReq = equipReqMap[equipKey];
            const asset = assetMap[entry.equipmentId || item.equipmentId];

            // 1. Readiness check
            const readiness = readinessService.evaluateItemReadiness(item, user, {
                equipReq,
                asset,
                selectedEquipmentId: entry.equipmentId || item.equipmentId
            });

            // 2. Validation check
            let validation = { isValid: true, flags: [] };
            const isSpectralAnalysis = ['SPEC_MIR', 'SPEC_VIS_NIR', 'SPEC_NIR', 'SPEC_FTIR'].includes(item.analysis);
            const isTextureAnalysis = ['TEXTURE', 'SOIL_PSD_TEXTURE', 'SOIL_TEXTURE', 'PSA', 'pSA', 'Particle Size Analysis'].includes(item.analysis) || (entry.values != null);
            if (isSpectralAnalysis) {
                validation = { isValid: false, flags: ['SPECTRAL_SCAN_REQUIRED'] };
            } else if (isTextureAnalysis) {
                const method = methodMap[item.analysis];
                const tolerance = method?.validation?.tolerance ?? 1.0;
                validation = validationService.validateTextureFractions(entry.values, tolerance);
            } else if (item.category === 'Operational Gates') {
                validation = validationService.validateOperationalTask(entry.checks, operationalChecklists[item.analysis]?.steps.length || 3);
            } else {
                const method = methodMap[item.analysis];
                validation = validationService.validateNumericMethod(entry.value, method?.validation);
            }

            // Version check
            let versionMismatch = false;
            if (entry.version !== undefined && entry.version !== item.version) {
                versionMismatch = true;
            }

            const blockers = [...readiness.blockers];
            const reasons = [...readiness.reasons];

            if (isSpectralAnalysis) {
                blockers.push('SPECTRAL_SCAN_REQUIRED');
                reasons.push('Spectral acquisition tasks cannot be completed with scalar values. Use spectrum intake or library link.');
            }

            if (versionMismatch) {
                blockers.push('VERSION_CONFLICT');
                reasons.push('Item was updated on server. Refresh before recording.');
            }

            if (!validation.isValid) {
                if (validation.flags?.includes('INVALID_FORMAT')) {
                    blockers.push('INVALID_FORMAT');
                    reasons.push('Value format is invalid');
                }
                if (validation.flags?.includes('BELOW_MIN') || validation.flags?.includes('ABOVE_MAX')) {
                    if (!entry.overrideReason) {
                        blockers.push('OUT_OF_RANGE');
                        reasons.push(`Value out of range (${validation.flags.join(', ')}). Override reason required.`);
                    }
                }
                if (validation.flags?.includes('INCOMPLETE_FRACTIONS')) {
                    blockers.push('INCOMPLETE_FRACTIONS');
                    reasons.push(validation.error || 'All three fractions (Sand, Silt, Clay) are required');
                }
                if (validation.flags?.includes('TEXTURE_CLOSURE_FAILED')) {
                    if (!entry.overrideReason) {
                        blockers.push('TEXTURE_CLOSURE_FAILED');
                        reasons.push(validation.error || 'Texture closure failed');
                    }
                }
                if (validation.flags?.includes('SOP_STEPS_INCOMPLETE')) {
                    blockers.push('SOP_STEPS_INCOMPLETE');
                    reasons.push('All SOP checklist steps must be verified');
                }
                if (validation.flags?.includes('VALUE_REQUIRED')) {
                    blockers.push('VALUE_REQUIRED');
                    reasons.push('Result value is required');
                }
            }

            const sampleDisplayId = item.sample?.labId || item.labId || item.sampleId;
            const originalId = item.sample?.originalId || null;

            if (blockers.length > 0) {
                excluded.push({
                    workItemId: item.id,
                    sampleId: item.sampleId,
                    sampleDisplayId,
                    labId: item.sample?.labId || item.labId,
                    originalId,
                    analysis: item.analysis,
                    value: entry.value,
                    blockers,
                    reasons,
                    warnings: readiness.warnings
                });
            } else {
                included.push({
                    workItemId: item.id,
                    sampleId: item.sampleId,
                    sampleDisplayId,
                    labId: item.sample?.labId || item.labId,
                    originalId,
                    analysis: item.analysis,
                    value: entry.value,
                    values: entry.values,
                    checks: entry.checks,
                    basis: entry.basis || 'AIR_DRY',
                    replicateNo: entry.replicateNo || 1,
                    equipmentId: entry.equipmentId || item.equipmentId,
                    version: item.version,
                    validation,
                    warnings: readiness.warnings
                });
            }
        }

        res.json({
            eligibleCount: included.length,
            blockedCount: excluded.length,
            included,
            excluded
        });
    } catch (err) {
        console.error('[workbench.previewCompletion] Error:', err);
        res.status(500).json({ error: 'Failed to generate completion preview' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/workbench/v2/completion/commit
// Atomically records valid determinations and completes work items with receipt
// ─────────────────────────────────────────────────────────────────────────────
exports.commitCompletion = async (req, res) => {
    req.body.draft = false;
    return exports.batchSave(req, res);
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/workbench/v2/submissions/preview
// Previews completed items ready to be bundled into sample submissions for review
// ─────────────────────────────────────────────────────────────────────────────
exports.previewSubmissions = async (req, res) => {
    const { sampleIds, workItemIds } = req.body;
    const user = req.user;

    try {
        const whereClause = {
            status: 'COMPLETED',
            submissionId: null
        };
        if (user.role === 'LAB_TECHNICIAN') {
            whereClause.assignedTo = user.username;
        }
        if (sampleIds && Array.isArray(sampleIds) && sampleIds.length > 0) {
            whereClause.sampleId = { in: sampleIds };
        }
        if (workItemIds && Array.isArray(workItemIds) && workItemIds.length > 0) {
            whereClause.id = { in: workItemIds };
        }

        const completedItems = await prisma.workItem.findMany({
            where: whereClause,
            include: {
                sample: {
                    select: {
                        id: true,
                        originalId: true,
                        labId: true,
                        assignedLab: true,
                        projectCode: true,
                        status: true
                    }
                }
            }
        });

        // Group by sample
        const sampleGroupMap = {};
        for (const item of completedItems) {
            const sId = item.sampleId;
            if (!sampleGroupMap[sId]) {
                sampleGroupMap[sId] = {
                    sampleId: sId,
                    sample: item.sample,
                    completedItems: []
                };
            }
            sampleGroupMap[sId].completedItems.push({
                workItemId: item.id,
                analysis: item.analysis,
                result: item.result,
                completedAt: item.completedAt
            });
        }

        const targetSampleIds = Object.keys(sampleGroupMap);
        let allItemsBySample = {};
        if (targetSampleIds.length > 0) {
            const allSampleItems = await prisma.workItem.findMany({
                where: { sampleId: { in: targetSampleIds } },
                select: { id: true, sampleId: true, status: true, analysis: true }
            });
            allSampleItems.forEach(wi => {
                if (!allItemsBySample[wi.sampleId]) allItemsBySample[wi.sampleId] = [];
                allItemsBySample[wi.sampleId].push(wi);
            });
        }

        const eligibleSamples = [];
        for (const sId of targetSampleIds) {
            const group = sampleGroupMap[sId];
            const allItems = allItemsBySample[sId] || [];
            const completedCount = group.completedItems.length;
            const totalCount = allItems.length;
            const isFull = allItems.every(i => i.status === 'COMPLETED' || group.completedItems.some(ci => ci.workItemId === i.id));

            eligibleSamples.push({
                sampleId: sId,
                originalId: group.sample?.originalId || null,
                projectCode: group.sample?.projectCode || null,
                submissionType: isFull ? 'FULL' : 'PARTIAL',
                completedCount,
                totalCount,
                items: group.completedItems
            });
        }

        res.json({
            eligibleSamples,
            totalEligibleSamples: eligibleSamples.length,
            totalCompletedItems: completedItems.length
        });
    } catch (err) {
        console.error('[workbench.previewSubmissions] Error:', err);
        res.status(500).json({ error: 'Failed to preview submissions' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/workbench/v2/submissions/commit
// Creates sample-scoped Submission records and transitions items to SUBMITTED
// ─────────────────────────────────────────────────────────────────────────────
exports.commitSubmissions = async (req, res) => {
    const { sampleIds, note } = req.body;
    const user = req.user;

    if (!sampleIds || !Array.isArray(sampleIds) || sampleIds.length === 0) {
        return res.status(400).json({ error: 'sampleIds array is required and must not be empty' });
    }

    try {
        const now = new Date();
        const createdSubmissions = [];
        const scopeGuard = require('../utils/scopeGuard');

        // S19: Verify lab scope for all requested samples upfront
        for (const sampleId of sampleIds) {
            const sample = await prisma.sample.findUnique({ where: { id: sampleId } });
            if (!sample) continue;
            if (!scopeGuard.canAccessEntity(user, sample, { labField: 'labId', altLabField: 'assignedLab' })) {
                return res.status(403).json({ error: `Access denied: Sample ${sampleId} is outside your lab scope.` });
            }
        }

        for (const sampleId of sampleIds) {
            const items = await prisma.workItem.findMany({
                where: {
                    sampleId,
                    status: 'COMPLETED',
                    submissionId: null,
                    ...(user.role === 'LAB_TECHNICIAN' ? { assignedTo: user.username } : {})
                },
                include: { sample: true }
            });

            if (items.length === 0) continue;

            const sample = items[0].sample;
            const allSampleItems = await prisma.workItem.findMany({
                where: { sampleId }
            });
            const itemIds = items.map(i => i.id);
            const isFull = allSampleItems.every(i => itemIds.includes(i.id) || i.status === 'COMPLETED' || i.status === 'SUBMITTED');

            const subId = `SUB-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
            // S19: Canonical status must be SUBMITTED_FULL (never legacy SUBMITTED)
            const targetSampleStatus = isFull ? 'SUBMITTED_FULL' : 'SUBMITTED_PARTIAL';

            // Atomic transaction for submission, work items, sample status, and audit
            await prisma.$transaction([
                prisma.submission.create({
                    data: {
                        id: subId,
                        sampleId,
                        labId: user.labId || sample?.labId || sample?.assignedLab,
                        assignedLab: sample?.assignedLab || sample?.labId,
                        type: isFull ? 'FULL' : 'PARTIAL',
                        status: 'PENDING_REVIEW',
                        note: note || null,
                        submittedBy: user.username,
                        submittedAt: now,
                        workItemIds: JSON.stringify(itemIds),
                        workItemCount: itemIds.length
                    }
                }),
                prisma.workItem.updateMany({
                    where: { id: { in: itemIds } },
                    data: {
                        status: 'SUBMITTED',
                        submissionId: subId,
                        submittedAt: now
                    }
                }),
                prisma.sample.update({
                    where: { id: sampleId },
                    data: { status: targetSampleStatus }
                }),
                prisma.auditLog.create({
                    data: {
                        id: `audit-sub-${subId}-${Date.now()}`,
                        entity: 'Submission',
                        entityId: subId,
                        sampleId,
                        action: 'WORKBENCH_SUBMIT',
                        performedBy: user.username,
                        details: `Submitted ${itemIds.length} item(s) for sample ${sampleId} (${isFull ? 'FULL' : 'PARTIAL'})`,
                        timestamp: now
                    }
                })
            ]);

            createdSubmissions.push({
                submissionId: subId,
                sampleId,
                type: isFull ? 'FULL' : 'PARTIAL',
                itemCount: itemIds.length
            });
        }

        // Broadcast to lab
        if (createdSubmissions.length > 0) {
            try {
                broadcastToLab(user.labId, 'SUBMISSION_CREATED', {
                    sampleIds,
                    submissions: createdSubmissions,
                    submittedBy: user.username,
                    submittedAt: now.toISOString()
                });
            } catch (wsErr) {
                console.error('[WS] Failed to broadcast SUBMISSION_CREATED:', wsErr);
            }
        }

        res.json({
            success: true,
            receipt: {
                receiptId: `REC-SUB-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
                type: 'SUBMISSION',
                action: 'SUBMIT_FOR_REVIEW',
                submittedAt: now.toISOString(),
                submittedBy: user.username,
                sampleCount: createdSubmissions.length,
                submissions: createdSubmissions
            }
        });
    } catch (err) {
        console.error('[workbench.commitSubmissions] Error:', err);
        res.status(500).json({ error: 'Failed to commit submissions' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/workbench/v2/receipts
// Returns durable activity receipts for the current user
// ─────────────────────────────────────────────────────────────────────────────
exports.getReceipts = async (req, res) => {
    const user = req.user;

    try {
        const logs = await prisma.auditLog.findMany({
            where: {
                performedBy: user.username,
                action: { in: ['WORKBENCH_COMPLETE', 'WORKBENCH_SUBMIT', 'DRAFT_DISCARDED', 'DRAFT_CONFLICT_RESOLVED', 'SPECTRAL_IMPORT'] }
            },
            orderBy: { timestamp: 'desc' },
            take: 50
        });

        const receipts = logs.map(l => ({
            id: l.id,
            action: l.action,
            entity: l.entity,
            entityId: l.entityId,
            sampleId: l.sampleId,
            details: l.details,
            timestamp: l.timestamp
        }));

        res.json({ receipts });
    } catch (err) {
        console.error('[workbench.getReceipts] Error:', err);
        res.status(500).json({ error: 'Failed to fetch receipts' });
    }
};

module.exports = exports;
