const cataloguePolicy = require('../services/cataloguePolicy');
const prisma = require('../prisma');
const workflow = require('../workflowContract');
const idGenerator = require('../services/idGenerator');
const { parseCoordinates } = require('../utils/coordParser');
const adminBoundaries = require('../data/adminBoundaries.json');
const crypto = require('crypto');
const sampleOriginService = require('../services/sampleOriginService');
const sampleStateService = require('../services/sampleStateService');
const projectPolicyService = require('../services/projectPolicyService');

// In-memory cache for reverse geocoding (24hr TTL)
const geocodeCache = new Map();

// Immutable locked lifecycle statuses that must never regress via intake or draft save
const LOCKED_INTAKE_STATUSES = [
    'ACCEPTED', 'LAB_ID_ASSIGNED', 'PROCESSING', 'COMPLETED',
    'APPROVED', 'ARCHIVED', 'DISPOSED', 'SUBMITTED_PARTIAL',
    'SUBMITTED_FULL', 'IN_PROGRESS', 'RECEIVED_REJECTED'
];
exports.LOCKED_INTAKE_STATUSES = LOCKED_INTAKE_STATUSES;

/**
 * RC-07 & RC-20: Derive confidence from evidence
 * Resists an unevidenced HIGH (e.g. manual desk pin or paste without device/field GPS)
 */
function deriveLocationConfidence(source, uncertaintyM) {
    if (!source || source === 'TEXT_ONLY') return 'LOW';
    if (source === 'FIELD_GPS' || source === 'DEVICE_GPS') {
        return (uncertaintyM && uncertaintyM <= 20) ? 'HIGH' : 'MEDIUM';
    }
    if (source === 'DESK_PASTE' || source === 'MAP_PIN') {
        if (uncertaintyM && uncertaintyM <= 50) return 'MEDIUM';
        return 'LOW';
    }
    if (source === 'ADMIN_UNIT') return 'LOW';
    return 'MEDIUM';
}
exports.deriveLocationConfidence = deriveLocationConfidence;

/**
 * Resolves requested package/group ID against available laboratory analysis groups.
 * Multi-tier exact-first resolution strategy:
 * 1. Validates requestedId is a non-empty string.
 * 2. Checks exact case-sensitive ID match.
 * 3. Checks exact case-insensitive match (rejects if multiple candidates exist).
 * 4. Checks normalized punctuation-stripped match (rejects if ambiguous).
 * Returns { group, canonicalId } or { error, code, message }.
 */
function resolveAnalysisGroup(requestedId, analysisGroups) {
    if (typeof requestedId !== 'string' || !requestedId.trim()) {
        return {
            error: 'INVALID_PACKAGE_ID',
            code: 'INVALID_PACKAGE_ID',
            message: 'Package ID must be a non-empty string.'
        };
    }
    const cleanId = requestedId.trim();

    // 1. Exact case-sensitive match
    const exactMatch = analysisGroups.find(g => g.id === cleanId);
    if (exactMatch) {
        return { group: exactMatch, canonicalId: exactMatch.id };
    }

    // 2. Exact case-insensitive match
    const lower = cleanId.toLowerCase();
    const caseInsensitiveMatches = analysisGroups.filter(g => g.id.toLowerCase() === lower);
    if (caseInsensitiveMatches.length === 1) {
        return { group: caseInsensitiveMatches[0], canonicalId: caseInsensitiveMatches[0].id };
    } else if (caseInsensitiveMatches.length > 1) {
        return {
            error: 'AMBIGUOUS_PACKAGE_ID',
            code: 'AMBIGUOUS_PACKAGE_ID',
            message: `Ambiguous package ID '${cleanId}': multiple packages match case-insensitively.`
        };
    }

    // 3. Punctuation-stripped normalized match (e.g. routine-soil vs ROUTINE_SOIL)
    const normalize = s => s.toLowerCase().replace(/[-_\s]/g, '');
    const norm = normalize(cleanId);
    const normMatches = analysisGroups.filter(g => normalize(g.id) === norm);
    if (normMatches.length === 1) {
        return { group: normMatches[0], canonicalId: normMatches[0].id };
    } else if (normMatches.length > 1) {
        return {
            error: 'AMBIGUOUS_PACKAGE_ID',
            code: 'AMBIGUOUS_PACKAGE_ID',
            message: `Ambiguous package ID '${cleanId}': matches multiple distinct packages.`
        };
    }

    return {
        error: 'PACKAGE_NOT_FOUND',
        code: 'PACKAGE_NOT_FOUND',
        message: `An analysis package is unavailable to this laboratory: '${cleanId}'.`
    };
}
exports.resolveAnalysisGroup = resolveAnalysisGroup;

exports.processIntake = async (req, res) => {
    const {
        originalId,
        decision,
        checklist,
        notes,
        ncReason,
        receivedBy: clientReceivedBy,
        labId,
        analysisGroupIds,
        analysisAdditions,
        analysisRemovals,
        justification,
        isWalkIn,
        submitterDetails,
        samplingDetails,
        projectId,
        // Stage A: Desk-Only Facts
        receivedMass,
        massWarningAcknowledged,
        moistureOnArrival,
        foreignMaterial,
        intakePhotos,
        isResubmission
    } = req.body;

    const user = req.user;
    // Trust authenticated identity over client-supplied actor (Finding #6)
    const receivedBy = user.username || clientReceivedBy || 'Unknown';
    console.log(`[INTAKE] Processing intake for ${originalId} by ${receivedBy}`);

    try {
        let sample = await prisma.sample.findFirst({
            where: { originalId: String(originalId) }
        });

        let isNewlyCreatedDeskSample = false;

        if (sample) {
            // Authoritative: Existing sample's persisted project governs admission policy
            const persistedProjectId = sample.projectId || sample.projectCode;
            if (persistedProjectId) {
                const existingResolved = await projectPolicyService.resolveProject(persistedProjectId, prisma);
                const existingProject = existingResolved?.project;
                if (existingProject) {
                    const admission = projectPolicyService.canAdmitSample({
                        project: existingProject,
                        channel: 'DESK',
                        actor: user,
                        labId: user.labId,
                        hasException: true // sample is already registered; this is physical reception
                    });
                    if (!admission.allowed) {
                        return res.status(422).json({
                            error: admission.code || 'PROJECT_ADMISSIONS_BLOCKED',
                            message: admission.reason
                        });
                    }
                }

                // Check for contradictory request projectId override
                if (projectId) {
                    const reqResolved = await projectPolicyService.resolveProject(projectId, prisma);
                    const reqCode = reqResolved?.code || String(projectId);
                    const reqId = reqResolved?.id || String(projectId);
                    if (reqCode !== sample.projectCode && reqId !== sample.projectId) {
                        return res.status(400).json({
                            error: 'CROSS_PROJECT_CONFLICT',
                            message: `Sample ${originalId} is already registered to project ${sample.projectCode || sample.projectId}. Direct project reassignment via intake is not permitted.`
                        });
                    }
                }
            }
        } else {
            // Brand new sample registration at reception desk
            isNewlyCreatedDeskSample = true;
            const candidateProjectId = projectId || (isWalkIn ? null : (user.projects && user.projects.length > 0 ? (typeof user.projects === 'string' ? JSON.parse(user.projects)[0] : user.projects[0]) : null));

            let resolvedTargetProject = null;
            if (candidateProjectId) {
                resolvedTargetProject = await projectPolicyService.resolveProject(candidateProjectId, prisma);
            }

            const targetProjectObj = resolvedTargetProject ? resolvedTargetProject.project : null;
            const { hasException, exceptionRecord } = await projectPolicyService.resolveAndVerifyExceptionRecord({
                rawExceptionRecord: req.body.exceptionRecord,
                rawExceptionReason: req.body.exceptionReason,
                authorizer: req.body.authorizer,
                approvalId: req.body.approvalId || req.body.approvalToken,
                actor: user,
                project: targetProjectObj,
                labId: user.labId,
                prismaClient: prisma
            });

            const admission = projectPolicyService.canAdmitSample({
                project: targetProjectObj,
                channel: isWalkIn ? 'WALK_IN' : 'DESK',
                actor: user,
                labId: user.labId,
                hasException,
                exceptionRecord
            });

            if (!admission.allowed) {
                return res.status(422).json({
                    error: admission.code || 'PROJECT_ADMISSIONS_BLOCKED',
                    message: admission.reason,
                    exceptionRequired: Boolean(admission.exceptionRequired)
                });
            }
        }

        if (!sample) {
            const candidateProjectId = projectId || (isWalkIn ? null : (user.projects && user.projects.length > 0 ? (typeof user.projects === 'string' ? JSON.parse(user.projects)[0] : user.projects[0]) : null));
            const resolvedTargetProject = candidateProjectId ? await projectPolicyService.resolveProject(candidateProjectId, prisma) : null;

            let idPrefix = 'W';
            if (resolvedTargetProject) {
                idPrefix = resolvedTargetProject.code.charAt(0).toUpperCase();
            } else if (isWalkIn && submitterDetails && submitterDetails.name) {
                const initials = submitterDetails.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 3);
                if (initials) idPrefix = initials;
            }

            // Generate a professional Original ID if the current one is temporary
            let finalOriginalId = String(originalId);
            if (finalOriginalId.startsWith('EXT-') || finalOriginalId.startsWith('S-') || !finalOriginalId) {
                const prefix = samplingDetails?.sampleType === 'PT' ? 'P' : 'W'; // Default W, unless PT
                finalOriginalId = await idGenerator.generateWalkInOriginalId(resolvedTargetProject ? idPrefix : prefix);
            }

            const sampleId = finalOriginalId;
            console.log(`[INTAKE] Creating new sample: ${sampleId} linked to Project: ${resolvedTargetProject?.code || 'WALK-IN'}`);

            const hasException = Boolean(req.body.hasException || req.body.exceptionRecord || req.body.exceptionReason);
            const exceptionRecord = req.body.exceptionRecord || (req.body.exceptionReason ? { reason: req.body.exceptionReason, authorizer: user.username, authorizedAt: new Date().toISOString() } : null);

            const isWalkInDeskSample = !resolvedTargetProject && isWalkIn;
            const initialMetadata = isWalkInDeskSample
                ? { origin: sampleOriginService.ORIGIN_TYPES.DESK_WALKIN }
                : (hasException ? { exceptionRecord, origin: 'DESK_EXCEPTION' } : {});

            sample = await prisma.sample.create({
                data: {
                    id: sampleId,
                    originalId: finalOriginalId,
                    status: 'EXPECTED',
                    projectCode: resolvedTargetProject ? resolvedTargetProject.code : null,
                    projectId: resolvedTargetProject ? resolvedTargetProject.id : null,
                    assignedLab: user.labId,
                    metadata: JSON.stringify(initialMetadata),
                    history: JSON.stringify([])
                }
            });
            // Update the local variable so the rest of the function uses the new ID
            req.body.originalId = finalOriginalId;
        }

        if (sample) {
            // SECURITY: Enforce Lab Scope
            const scopeGuard = require('../utils/scopeGuard');
            try {
                scopeGuard.ensureScope(user, sample, { altLabField: 'assignedLab' });
            } catch (e) {
                console.warn(`[INTAKE] Security Block: User ${user.username} tried to intake sample ${originalId} belonging to another lab.`);
                return res.status(403).json({ success: false, message: 'Access Denied: This sample belongs to another lab.' });
            }

            if (LOCKED_INTAKE_STATUSES.includes(sample.status)) {
                console.warn(`[INTAKE] Blocked attempt to modify locked sample ${originalId} (Status: ${sample.status}, isDraft: ${!!req.body.isDraft})`);
                return res.status(403).json({
                    success: false,
                    error: 'SAMPLE_LOCKED',
                    message: `Sample intake is already locked in status '${sample.status}'. Changes are not permitted.`
                });
            }
        }

        const now = new Date();
        const history = typeof sample.history === 'string' ? JSON.parse(sample.history) : (sample.history || []);

        if (decision === 'REJECTED' || decision === 'REJECT') {
            history.push({
                status: 'RECEIVED_REJECTED',
                changedBy: receivedBy,
                timestamp: now,
                reason: ncReason
            });

            const photosList = Array.isArray(intakePhotos)
                ? intakePhotos
                : (Array.isArray(req.body.photos) ? req.body.photos : []);

            // Chain of Custody extraction (Stage E: RC-19)
            const coc = req.body.coc || {};
            const custodyHandoverAt = req.body.custodyHandoverAt
                ? new Date(req.body.custodyHandoverAt)
                : (coc.handoverAt || coc.date ? new Date(coc.handoverAt || coc.date) : now);
            const custodyCarrierName = req.body.custodyCarrierName || coc.deliveredBy || coc.carrierName || null;
            const custodyTrackingNumber = req.body.custodyTrackingNumber || coc.trackingNumber || coc.waybillRef || null;
            const custodySenderSignature = req.body.custodySenderSignature || coc.senderSignature || null;
            const receivingOfficerId = user.id ? String(user.id) : null;
            const receivingOfficerName = user.name || user.username || receivedBy;
            const receivingOfficerSignature = req.body.receivingOfficerSignature || coc.officerSignature || `CONFIRMED:${receivedBy}:${now.toISOString()}`;

            const { transitionSample } = require('../services/sampleStateService');
            const updated = await transitionSample(sample.id, workflow.SAMPLE_STATES.RECEIVED_REJECTED, user, `Sample rejected during intake: ${ncReason}`, {
                rejectionReason: ncReason,
                intakePhotos: photosList.length > 0 ? JSON.stringify(photosList) : null,
                receptionDate: now,
                receivedBy: receivedBy,
                custodyHandoverAt,
                custodyCarrierName,
                custodyTrackingNumber,
                custodySenderSignature,
                receivingOfficerId,
                receivingOfficerName,
                receivingOfficerSignature,
                metadata: JSON.stringify({
                    nonConformance: {
                        reason: ncReason,
                        checklist,
                        notes,
                        photos: photosList,
                        rejectedBy: receivedBy,
                        at: now
                    }
                }),
                history: JSON.stringify(history)
            });

            await prisma.auditLog.create({
                data: {
                    id: `audit-reject-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    entity: 'SAMPLE',
                    entityId: String(sample.id),
                    action: 'SAMPLE_REJECTED',
                    details: `Sample intake rejected and non-conformance recorded: ${ncReason}`,
                    performedBy: String(user.username),
                    timestamp: now,
                    sampleId: String(sample.id)
                }
            });

            return res.json({
                success: true,
                rejected: true,
                id: updated.id,
                originalId: updated.originalId,
                status: 'RECEIVED_REJECTED',
                rejectionReason: ncReason,
                custodyHandoverAt,
                custodyCarrierName,
                custodyTrackingNumber,
                receivingOfficerName,
                message: 'Sample intake non-conformance recorded. Status: RECEIVED_REJECTED.',
                sample: updated
            });
        }

        if (req.body.isDraft) {
            // Never regress an already received record to DRAFT
            const targetDraftStatus = sample.status === 'RECEIVED' ? 'RECEIVED' : 'DRAFT';

            history.push({
                status: targetDraftStatus,
                changedBy: receivedBy,
                timestamp: now,
                note: sample.status === 'RECEIVED' ? 'Intake draft updated (status retained as RECEIVED)' : 'Saved as Draft'
            });

            const currentFieldMeta = typeof sample.fieldMetadata === 'string' ? JSON.parse(sample.fieldMetadata) : (sample.fieldMetadata || {});
            const mergeField = (key, value) => {
                if (value !== undefined && value !== null && value !== '') {
                    currentFieldMeta[key] = { value: value, source: 'DRAFT', lastUpdatedAt: now, lastUpdatedBy: receivedBy };
                }
            };

            if (submitterDetails) {
                mergeField('submitterName', submitterDetails.name);
                mergeField('submitterPhone', submitterDetails.phone);
            }
            if (samplingDetails) {
                mergeField('collectionDate', samplingDetails.date);
            }

            const photosList = Array.isArray(intakePhotos)
                ? intakePhotos
                : (Array.isArray(req.body.photos) ? req.body.photos : []);

            const parsedMass = (receivedMass !== undefined && receivedMass !== null && receivedMass !== '')
                ? parseFloat(receivedMass)
                : null;

            // Authoritative origin resolution:
            // Prevents client flags from downgrading project samples to walk-in,
            // while preserving legitimate desk walk-in origin across repeated saves (I02, I03).
            const originInfo = sampleOriginService.resolveOriginForSave(sample, isNewlyCreatedDeskSample, { isWalkIn, projectId });

            const updateData = {
                status: targetDraftStatus,
                history: JSON.stringify(history),
                fieldMetadata: JSON.stringify(currentFieldMeta),
                analysisGroupIds: JSON.stringify(analysisGroupIds || []),
                requiredAnalyses: req.body.requiredAnalyses ? JSON.stringify(req.body.requiredAnalyses) : undefined,
                receivedMass: parsedMass !== null && !isNaN(parsedMass) ? parsedMass : undefined,
                massWarningAcknowledged: !!massWarningAcknowledged,
                moistureOnArrival: moistureOnArrival || undefined,
                foreignMaterial: foreignMaterial ? (typeof foreignMaterial === 'string' ? foreignMaterial : JSON.stringify(foreignMaterial)) : undefined,
                intakePhotos: photosList.length > 0 ? JSON.stringify(photosList) : undefined,
                isResubmission: isResubmission !== undefined ? !!isResubmission : undefined,
                receptionData: JSON.stringify({
                    checklist, notes, receivedBy, labLocation: labId, at: now,
                    coc: req.body.coc, photos: photosList,
                    analysisJustification: justification || null,
                    submitterDetails: submitterDetails || null,
                    samplingDetails: samplingDetails || null,
                    isWalkIn: originInfo.isWalkIn,
                    origin: originInfo.origin,
                    receivedMass: parsedMass,
                    moistureOnArrival,
                    foreignMaterial,
                    analysisAdditions: analysisAdditions || [],
                    analysisRemovals: analysisRemovals || [],
                    analysisGroupIds: analysisGroupIds || [],
                    requiredAnalyses: req.body.requiredAnalyses || []
                })
            };

            // Preserve project origin: client mode flag must not convert an existing project sample into a walk-in or clear its project
            const existingProjectId = sample.projectId || sample.projectCode;
            if (existingProjectId) {
                updateData.projectId = sample.projectId || undefined;
                updateData.projectCode = sample.projectCode || undefined;
            } else if (originInfo.isWalkIn) {
                updateData.projectCode = null;
                updateData.projectId = null;
            } else if (projectId) {
                const projExists = await prisma.project.findFirst({ where: { id: projectId } });
                if (projExists) {
                    updateData.projectId = projectId;
                    updateData.projectCode = projExists.code || projectId;
                } else {
                    console.warn(`[INTAKE] Draft: projectId '${projectId}' not found in Project table, skipping FK.`);
                }
            }

            // Ensure assignedLab is set so discard permission check works
            if (!sample.assignedLab) {
                updateData.assignedLab = user.labId;
            }

            // Atomic conditional update: guarantee state was not concurrently locked by another actor
            const updateRes = await prisma.sample.updateMany({
                where: {
                    id: sample.id,
                    status: { notIn: LOCKED_INTAKE_STATUSES }
                },
                data: updateData
            });

            if (updateRes.count === 0) {
                console.warn(`[INTAKE] Atomic conflict: sample ${sample.id} was concurrently modified or locked.`);
                return res.status(409).json({
                    success: false,
                    error: 'CONCURRENT_MODIFICATION',
                    message: 'Sample state was updated concurrently or locked by another user. Intake changes rejected.'
                });
            }

            return res.json({ success: true, id: sample.id, originalId: sample.originalId, status: targetDraftStatus, message: 'Draft saved.' });
        }

        // Final Acceptance Processing
        if (analysisRemovals && analysisRemovals.length > 0 && !justification) {
            return res.status(400).json({ success: false, message: 'Justification is mandatory when removing analyses.' });
        }

        // Finding #7: Start from existing analyses to avoid overwriting on partial payloads
        const existingAnalyses = sample.requiredAnalyses
            ? (typeof sample.requiredAnalyses === 'string' ? JSON.parse(sample.requiredAnalyses) : sample.requiredAnalyses)
            : [];
        let requiredAnalyses = new Set(existingAnalyses);

        // Load analysis groups from database
        const analysisGroupsRaw = await prisma.analysisGroup.findMany({ where: { OR: [{ labId: sample.assignedLab || user.labId }, { labId: null }] } });
        const analysisGroups = analysisGroupsRaw.map(g => ({
            id: g.id,
            name: g.name,
            analyses: g.analyses ? JSON.parse(g.analyses) : []
        }));

        const canonicalGroupIds = [];
        if (analysisGroupIds !== undefined && analysisGroupIds !== null) {
            if (!Array.isArray(analysisGroupIds)) {
                return res.status(400).json({
                    success: false,
                    code: 'INVALID_PACKAGE_ID',
                    message: 'analysisGroupIds must be an array of package ID strings.'
                });
            }
            for (const gid of analysisGroupIds) {
                const resolved = resolveAnalysisGroup(gid, analysisGroups);
                if (resolved.error) {
                    return res.status(400).json({
                        success: false,
                        code: resolved.code,
                        message: resolved.message
                    });
                }
                canonicalGroupIds.push(resolved.canonicalId);
                resolved.group.analyses.forEach(code => requiredAnalyses.add(code));
            }
        }

        if (Array.isArray(req.body.requiredAnalyses)) {
            req.body.requiredAnalyses.forEach(code => requiredAnalyses.add(code));
        }

        if (Array.isArray(analysisAdditions)) {
            analysisAdditions.forEach(code => requiredAnalyses.add(code));
        }

        if (Array.isArray(analysisRemovals)) {
            analysisRemovals.forEach(code => requiredAnalyses.delete(code));
        }

        const selected = await cataloguePolicy.validateSelection(Array.from(requiredAnalyses), { labId: sample.assignedLab || user.labId, existing: existingAnalyses });
        if (!selected.valid) return res.status(400).json({ success: false, message: selected.error, error: selected.error, issues: selected.issues });

        // RC-01: Analytical Mass Sufficiency Check
        const parsedMass = (receivedMass !== undefined && receivedMass !== null && receivedMass !== '')
            ? parseFloat(receivedMass)
            : null;

        let massDeficitInfo = null;
        if (parsedMass !== null && !isNaN(parsedMass)) {
            const requiredCodes = Array.from(requiredAnalyses);
            const analysesFromDb = await prisma.analysis.findMany({
                where: { code: { in: requiredCodes } },
                select: { code: true, name: true, sampleMassRequired: true }
            });

            const totalAnalyticalMass = analysesFromDb.reduce((sum, a) => sum + (a.sampleMassRequired || 10.0), 0);
            const retentionBuffer = 100.0; // 100g standard retention
            const totalRequiredMass = totalAnalyticalMass + retentionBuffer;

            if (parsedMass < totalRequiredMass) {
                const deficit = Math.round((totalRequiredMass - parsedMass) * 10) / 10;
                massDeficitInfo = {
                    receivedMass: parsedMass,
                    totalRequiredMass,
                    totalAnalyticalMass,
                    retentionBuffer,
                    deficit,
                    analysesAtRisk: analysesFromDb.map(a => ({
                        code: a.code,
                        name: a.name,
                        massRequired: a.sampleMassRequired || 10.0
                    }))
                };

                if (!massWarningAcknowledged && !req.body.isDraft) {
                    return res.status(400).json({
                        success: false,
                        error: 'MASS_DEFICIT',
                        message: `Received mass (${parsedMass}g) is insufficient for the ordered tests (${totalAnalyticalMass}g) plus archive retention (${retentionBuffer}g). Deficit: ${deficit}g.`,
                        massDeficitInfo
                    });
                }
            }
        }

        const currentFieldMeta = typeof sample.fieldMetadata === 'string' ? JSON.parse(sample.fieldMetadata) : (sample.fieldMetadata || {});
        const mergeField = (key, value) => {
            if (value !== undefined && value !== null && value !== '') {
                currentFieldMeta[key] = { value, source: 'WALK_IN_INTAKE', lastUpdatedAt: now, lastUpdatedBy: receivedBy };
            }
        };

        if (submitterDetails) {
            Object.entries(submitterDetails).forEach(([k, v]) => mergeField(`submitter${k.charAt(0).toUpperCase() + k.slice(1)}`, v));
        }

        // Stage B: Location, Provenance & Depth Extraction
        let lat = null, lng = null, elev = null;
        if (req.body.latitude !== undefined && req.body.latitude !== null && req.body.latitude !== '') {
            lat = parseFloat(req.body.latitude);
            lng = req.body.longitude !== undefined && req.body.longitude !== null ? parseFloat(req.body.longitude) : null;
            elev = req.body.elevation !== undefined && req.body.elevation !== null ? parseFloat(req.body.elevation) : null;
        } else if (samplingDetails?.coordinates) {
            lat = parseFloat(samplingDetails.coordinates.lat);
            lng = parseFloat(samplingDetails.coordinates.lng);
            elev = parseFloat(samplingDetails.coordinates.elevation);
        } else if (req.body.coordinates) {
            lat = parseFloat(req.body.coordinates.lat);
            lng = parseFloat(req.body.coordinates.lng);
            elev = parseFloat(req.body.coordinates.elevation);
        }

        // Numeric depths
        let depthTop = null, depthBottom = null;
        if (req.body.depthTopCm !== undefined && req.body.depthTopCm !== null && req.body.depthTopCm !== '') {
            depthTop = parseFloat(req.body.depthTopCm);
        } else if (samplingDetails?.depthTopCm !== undefined && samplingDetails?.depthTopCm !== null && samplingDetails?.depthTopCm !== '') {
            depthTop = parseFloat(samplingDetails.depthTopCm);
        } else if (samplingDetails?.depthMin !== undefined && samplingDetails?.depthMin !== null && samplingDetails?.depthMin !== '') {
            depthTop = parseFloat(samplingDetails.depthMin);
        } else if (samplingDetails?.depthType && /^\d+-\d+$/.test(samplingDetails.depthType)) {
            const [t, b] = samplingDetails.depthType.split('-').map(Number);
            depthTop = t;
            depthBottom = b;
        }

        if (req.body.depthBottomCm !== undefined && req.body.depthBottomCm !== null && req.body.depthBottomCm !== '') {
            depthBottom = parseFloat(req.body.depthBottomCm);
        } else if (samplingDetails?.depthBottomCm !== undefined && samplingDetails?.depthBottomCm !== null && samplingDetails?.depthBottomCm !== '') {
            depthBottom = parseFloat(samplingDetails.depthBottomCm);
        } else if (samplingDetails?.depthMax !== undefined && samplingDetails?.depthMax !== null && samplingDetails?.depthMax !== '') {
            depthBottom = parseFloat(samplingDetails.depthMax);
        }

        const rawUncertainty = req.body.positionalUncertaintyM !== undefined && req.body.positionalUncertaintyM !== null && req.body.positionalUncertaintyM !== ''
            ? req.body.positionalUncertaintyM
            : samplingDetails?.positionalUncertaintyM;
        const uncertaintyM = rawUncertainty !== undefined && rawUncertainty !== null && rawUncertainty !== ''
            ? parseFloat(rawUncertainty)
            : undefined;

        const rawCompRadius = req.body.compositeRadiusM !== undefined && req.body.compositeRadiusM !== null && req.body.compositeRadiusM !== ''
            ? req.body.compositeRadiusM
            : samplingDetails?.compositeRadiusM;
        const compRadius = rawCompRadius !== undefined && rawCompRadius !== null && rawCompRadius !== ''
            ? parseFloat(rawCompRadius)
            : undefined;

        const locationSource = req.body.locationSource || samplingDetails?.locationSource || samplingDetails?.captureMethod || (lat && lng ? 'DESK_PIN' : 'TEXT_ONLY');
        const admin1 = req.body.admin1 || samplingDetails?.district || undefined;
        const admin2 = req.body.admin2 || samplingDetails?.areaVillage || undefined;
        const village = req.body.village || samplingDetails?.areaVillage || undefined;
        const siteName = req.body.siteName || samplingDetails?.siteName || undefined;

        if (samplingDetails) {
            // RC-07 & RC-20: Derive confidence from evidence and resist unevidenced HIGH
            const captureMethod = samplingDetails.captureMethod || locationSource;
            const maxConfidence = deriveLocationConfidence(captureMethod, uncertaintyM);
            let finalConfidence = samplingDetails.locationConfidence || maxConfidence;
            if (finalConfidence === 'HIGH' && maxConfidence !== 'HIGH') {
                console.warn(`[INTAKE] Resisting unevidenced HIGH confidence for method ${captureMethod} (downgraded to ${maxConfidence})`);
                finalConfidence = maxConfidence;
            }

            // Build canonical location object for structured access
            const locationCanonical = {
                siteName: samplingDetails.siteName || null,
                locationDescription: samplingDetails.location || null,
                admin1: samplingDetails.district || null,
                admin2: samplingDetails.areaVillage || null,
                landmark: samplingDetails.landmark || null,
                latitude: samplingDetails.coordinates?.lat || null,
                longitude: samplingDetails.coordinates?.lng || null,
                gpsAccuracy: samplingDetails.coordinates?.accuracy || null,
                locationCaptureMethod: captureMethod || null,
                locationConfidence: finalConfidence,
                locationUncertaintyReason: samplingDetails.locationUncertaintyReason || null
            };
            mergeField('locationCanonical', locationCanonical);

            // Legacy key mapping (preserves backward compat)
            Object.entries(samplingDetails).forEach(([k, v]) => {
                if (k === 'coordinates' && v) {
                    mergeField('latitude', v.lat);
                    mergeField('longitude', v.lng);
                    mergeField('gpsAccuracy', v.accuracy);
                } else {
                    mergeField(k, v);
                }
            });

            // Also write new canonical keys individually for downstream queries
            mergeField('siteName', samplingDetails.siteName);
            mergeField('locationCaptureMethod', captureMethod);
            mergeField('locationConfidence', finalConfidence);
            mergeField('landmark', samplingDetails.landmark);
            mergeField('admin1', samplingDetails.district);
            mergeField('admin2', samplingDetails.areaVillage);
        }

        // NEW: Assign Lab ID immediately during intake
        let assignedLabId;
        const finalLabRef = user.labId || 'GEN';

        if (isWalkIn && !projectId) {
            // Generic Walk-ins keep their generated short ID as Lab ID
            assignedLabId = sample.originalId;
        } else {
            // Project samples (Scheduled or Manual Type B) get a short sequential Lab ID
            assignedLabId = await idGenerator.generateLabId(finalLabRef, 'S');
        }

        history.push({
            status: 'RECEIVED',
            changedBy: receivedBy,
            timestamp: now,
            note: `Intake process completed. Assigned Lab ID: ${assignedLabId}`
        });

        if (massDeficitInfo && massWarningAcknowledged) {
            history.push({
                status: 'MASS_DEFICIT_OVERRIDE',
                changedBy: receivedBy,
                timestamp: now,
                note: `Accepted with mass deficit: received ${parsedMass}g vs required ${massDeficitInfo.totalRequiredMass}g (deficit: ${massDeficitInfo.deficit}g).`
            });
        }

        const photosList = Array.isArray(intakePhotos)
            ? intakePhotos
            : (Array.isArray(req.body.photos) ? req.body.photos : []);

        const updateData = {
            status: assignedLabId ? workflow.SAMPLE_STATES.ACCEPTED : workflow.SAMPLE_STATES.RECEIVED,
            labId: assignedLabId,
            receptionDate: now,       // Finding #3: canonical column
            receivedBy: receivedBy,   // Finding #3: canonical column
            acceptedBy: assignedLabId ? receivedBy : null,
            acceptedAt: assignedLabId ? now : null,
            dryingStatus: assignedLabId ? 'PENDING' : null,
            preparationStatus: assignedLabId ? 'PENDING' : null,
            requiredAnalyses: JSON.stringify(Array.from(requiredAnalyses)),
            analysisGroupIds: JSON.stringify([...new Set(canonicalGroupIds)]),
            fieldMetadata: JSON.stringify(currentFieldMeta),
            history: JSON.stringify(history),
            assignedLab: user.labId,
            receivedMass: parsedMass !== null && !isNaN(parsedMass) ? parsedMass : undefined,
            massWarningAcknowledged: !!massWarningAcknowledged,
            moistureOnArrival: moistureOnArrival || undefined,
            foreignMaterial: foreignMaterial ? (typeof foreignMaterial === 'string' ? foreignMaterial : JSON.stringify(foreignMaterial)) : undefined,
            intakePhotos: photosList.length > 0 ? JSON.stringify(photosList) : undefined,
            isResubmission: isResubmission !== undefined ? !!isResubmission : undefined,

            // Stage B fields
            latitude: !isNaN(lat) && lat !== null ? lat : undefined,
            longitude: !isNaN(lng) && lng !== null ? lng : undefined,
            elevation: !isNaN(elev) && elev !== null ? elev : undefined,
            positionalUncertaintyM: !isNaN(uncertaintyM) && uncertaintyM !== undefined ? uncertaintyM : undefined,
            locationSource: locationSource,
            locationCapturedAt: (lat && lng) ? now : undefined,
            locationCapturedBy: (lat && lng) ? receivedBy : undefined,
            compositeRadiusM: !isNaN(compRadius) && compRadius !== undefined ? compRadius : undefined,
            depthTopCm: !isNaN(depthTop) && depthTop !== null ? depthTop : undefined,
            depthBottomCm: !isNaN(depthBottom) && depthBottom !== null ? depthBottom : undefined,
            admin1,
            admin2,
            village,
            siteName,

            // Stage E: Chain of Custody & Handover (RC-19)
            custodyHandoverAt: req.body.custodyHandoverAt
                ? new Date(req.body.custodyHandoverAt)
                : (req.body.coc?.handoverAt || req.body.coc?.date ? new Date(req.body.coc.handoverAt || req.body.coc.date) : now),
            custodyCarrierName: req.body.custodyCarrierName || req.body.coc?.deliveredBy || req.body.coc?.carrierName || null,
            custodyTrackingNumber: req.body.custodyTrackingNumber || req.body.coc?.trackingNumber || req.body.coc?.waybillRef || null,
            custodySenderSignature: req.body.custodySenderSignature || req.body.coc?.senderSignature || null,
            receivingOfficerId: user.id ? String(user.id) : null,
            receivingOfficerName: user.name || user.username || receivedBy,
            receivingOfficerSignature: req.body.receivingOfficerSignature || req.body.coc?.officerSignature || `CONFIRMED:${receivedBy}:${now.toISOString()}`,

            receptionData: JSON.stringify({
                checklist, notes, receivedBy, labLocation: labId, at: now,
                coc: req.body.coc, photos: photosList,
                analysisJustification: justification || null,
                submitterDetails: submitterDetails || null,
                samplingDetails: samplingDetails || null,
                isWalkIn: isWalkIn || false,
                receivedMass: parsedMass,
                moistureOnArrival,
                foreignMaterial,
                massDeficitInfo,
                positionalUncertaintyM: uncertaintyM,
                locationSource: samplingDetails?.locationSource || samplingDetails?.captureMethod,
                compositeRadiusM: compRadius,
                depthTopCm: depthTop,
                depthBottomCm: depthBottom
            })
        };

        // Preserve project origin: client mode flag must not convert an existing project sample into a walk-in or clear its project
        const existingProjectId = sample.projectId || sample.projectCode;
        if (existingProjectId) {
            updateData.projectId = sample.projectId || undefined;
            updateData.projectCode = sample.projectCode || undefined;
        } else if (isWalkIn) {
            updateData.projectCode = null;
            updateData.projectId = null;
        } else if (projectId) {
            const projExists = await prisma.project.findFirst({ where: { id: projectId } });
            if (projExists) {
                updateData.projectId = projectId;
                updateData.projectCode = projExists.code || projectId;
            } else {
                console.warn(`[INTAKE] Intake: projectId '${projectId}' not found in Project table, skipping FK.`);
            }
        }

        console.log(`[INTAKE] Updating sample ${sample.id} with status RECEIVED`);
        const { transitionSample } = require('../services/sampleStateService');
        const nextStatus = updateData.status || (updateData.labId ? 'ACCEPTED' : 'RECEIVED');
        delete updateData.status;
        const updated = await transitionSample(sample.id, nextStatus, user, 'Intake completed at reception', updateData);

        // Automatically generate work items for specified analyses
        try {
            const workItemController = require('./workItemController');
            await workItemController.generateWorkItemsForSample(updated);
        } catch (wiErr) {
            console.warn('[INTAKE] Warning: Failed to generate work items during intake:', wiErr.message);
        }

        await prisma.auditLog.create({
            data: {
                id: `audit-intake-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                entity: 'SAMPLE',
                entityId: String(sample.id),
                action: 'SAMPLE_RECEIVED',
                details: 'Intake completed at reception',
                performedBy: String(user.username),
                timestamp: now,
                sampleId: String(sample.id)
            }
        });

        console.log(`[INTAKE] Successfully processed ${sample.id}`);
        res.json({
            success: true,
            id: updated.id,
            originalId: updated.originalId,
            labId: updated.labId,
            message: 'Intake recorded.'
        });

    } catch (error) {
        console.error('[processIntake] CRITICAL FAILURE:', error);
        console.error('Request Body:', JSON.stringify(req.body, null, 2));
        if (error.code) console.error('Prisma Error Code:', error.code);
        if (error.meta) console.error('Prisma Meta:', error.meta);
        res.status(500).json({ success: false, message: 'Internal server error: ' + error.message });
    }
};

/**
 * POST /api/reception/discard
 * Discard a DRAFT or RECEIVED sample from the reception console.
 * - Project samples (pre-registered) → revert to EXPECTED
 * - Walk-in / open samples → hard delete
 */
exports.discardDraft = async (req, res) => {
    const { id } = req.body;
    const user = req.user;

    if (!id) {
        return res.status(400).json({ error: 'Sample ID is required.' });
    }

    try {
        const sample = await prisma.sample.findFirst({
            where: { id: String(id) }
        });

        if (!sample) {
            return res.status(404).json({ error: 'Sample not found.' });
        }

        // Only initial intake stages can be discarded
        const discardableStatuses = ['DRAFT', 'RECEIVED', 'COLLECTED', 'EXPECTED'];
        if (!discardableStatuses.includes(sample.status)) {
            return res.status(409).json({
                error: 'ILLEGAL_STATUS_TRANSITION',
                message: `Cannot discard sample in status '${sample.status}'. Only draft or unreceived samples can be discarded.`
            });
        }

        // Lab scope check
        if (sample.assignedLab && sample.assignedLab !== user.labId) {
            return res.status(403).json({ error: 'You can only discard samples from your own lab.' });
        }

        // Determine if this is a disposable desk walk-in draft vs pre-registered/project sample
        const isDeskWalkIn = sampleOriginService.isDisposableDeskDraft(sample);

        if (!isDeskWalkIn) {
            // REVERT to EXPECTED — fully atomic transaction with canonical workflow validation (I04)
            await prisma.$transaction(async (tx) => {
                const current = await tx.sample.findUnique({ where: { id: String(sample.id) } });
                if (!current) throw new sampleStateService.TransitionError('Sample not found', 404, 'SAMPLE_NOT_FOUND');

                if (!discardableStatuses.includes(current.status)) {
                    throw new sampleStateService.TransitionError(
                        `Cannot discard sample in status '${current.status}'. Samples in progress or completed cannot be reset.`,
                        409,
                        'ILLEGAL_STATUS_TRANSITION'
                    );
                }

                // Check for results or completed work
                const resultCount = await tx.result.count({ where: { sampleId: String(sample.id) } });
                if (resultCount > 0) {
                    throw new sampleStateService.TransitionError('Cannot discard sample with existing analytical results.', 409, 'CANNOT_DELETE_SAMPLE_WITH_RESULTS');
                }
                const activeWork = await tx.workItem.findMany({
                    where: {
                        sampleId: String(sample.id),
                        status: { in: ['COMPLETED', 'SUBMITTED', 'ACCEPTED'] }
                    }
                });
                if (activeWork.length > 0) {
                    throw new sampleStateService.TransitionError('Cannot discard sample with analytical work completed or submitted.', 409, 'ACTIVE_WORK_IN_PROGRESS');
                }

                await tx.workItem.deleteMany({ where: { sampleId: String(sample.id) } });
                await tx.result.deleteMany({ where: { sampleId: String(sample.id) } });
                await tx.submission.deleteMany({ where: { sampleId: String(sample.id) } });
                await tx.spectralData.deleteMany({ where: { sampleId: String(sample.id) } });

                const sampleHistory = typeof current.history === 'string'
                    ? JSON.parse(current.history)
                    : (current.history || []);
                sampleHistory.push({
                    status: 'EXPECTED',
                    action: 'REVERT_TO_EXPECTED',
                    changedBy: user.username,
                    timestamp: new Date(),
                    note: 'Draft/intake discarded by reception. Sample reverted to EXPECTED.'
                });

                // Canonical transition inside transaction (enforces workflowContract graph and logs transition audit)
                await sampleStateService.transitionSample(
                    current.id,
                    'EXPECTED',
                    user,
                    'Draft/intake discarded by reception. Sample reverted to EXPECTED.',
                    {
                        labId: null,
                        receptionData: null,
                        receptionDate: null,
                        receivedBy: null,
                        requiredAnalyses: null,
                        analysisGroupIds: null,
                        dryingStatus: null,
                        preparationStatus: null,
                        acceptedBy: null,
                        acceptedAt: null,
                        approvedBy: null,
                        approvedAt: null,
                        lastSubmissionId: null,
                        lastSubmissionType: null,
                        lastSubmissionAt: null,
                        assignedLab: current.assignedLab,
                        history: JSON.stringify(sampleHistory)
                    },
                    tx
                );

                await tx.auditLog.create({
                    data: {
                        id: `audit-discard-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                        entity: 'SAMPLE',
                        entityId: String(sample.id),
                        action: 'DRAFT_DISCARDED',
                        details: `Project sample ${sample.originalId} reverted to EXPECTED by reception.`,
                        performedBy: user.username,
                        timestamp: new Date(),
                        sampleId: String(sample.id)
                    }
                });
            });

            console.log(`[DISCARD] Reverted project sample ${sample.id} to EXPECTED`);
            return res.json({ success: true, message: `Sample ${sample.originalId} reverted to EXPECTED.` });
        } else {
            // HARD DELETE walk-in — fully atomic transaction with safety validation
            await prisma.$transaction(async (tx) => {
                const current = await tx.sample.findUnique({ where: { id: String(sample.id) } });
                if (!current) throw new sampleStateService.TransitionError('Sample not found', 404, 'SAMPLE_NOT_FOUND');

                if (!discardableStatuses.includes(current.status)) {
                    throw new sampleStateService.TransitionError(
                        `Cannot delete walk-in sample in status '${current.status}'.`,
                        409,
                        'ILLEGAL_STATUS_TRANSITION'
                    );
                }

                const resultCount = await tx.result.count({ where: { sampleId: String(sample.id) } });
                if (resultCount > 0) {
                    throw new sampleStateService.TransitionError('Cannot delete sample with existing analytical results.', 409, 'CANNOT_DELETE_SAMPLE_WITH_RESULTS');
                }

                await tx.workItem.deleteMany({ where: { sampleId: String(sample.id) } });
                await tx.result.deleteMany({ where: { sampleId: String(sample.id) } });
                await tx.submission.deleteMany({ where: { sampleId: String(sample.id) } });
                await tx.spectralData.deleteMany({ where: { sampleId: String(sample.id) } });

                await tx.auditLog.create({
                    data: {
                        id: `audit-discard-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                        entity: 'SAMPLE',
                        entityId: String(sample.id),
                        action: 'SAMPLE_DELETED',
                        details: `Walk-in sample ${sample.originalId} hard deleted by reception.`,
                        performedBy: user.username,
                        timestamp: new Date()
                    }
                });

                await tx.sample.delete({ where: { id: String(sample.id) } });
            });

            console.log(`[DISCARD] Hard deleted walk-in sample ${sample.id}`);
            return res.json({ success: true, message: `Sample ${sample.originalId} deleted.` });
        }
    } catch (error) {
        if (error.name === 'TransitionError' || error.code === 'ILLEGAL_STATUS_TRANSITION' || error.statusCode) {
            return res.status(error.statusCode || 409).json({
                error: error.code || 'ILLEGAL_STATUS_TRANSITION',
                message: error.message
            });
        }
        console.error('[discardDraft] ERROR:', error);
        res.status(500).json({ error: 'Failed to discard: ' + error.message });
    }
};

/**
 * GET /api/reception/check-duplicate?originalId=...&sampleId=...
 * RC-04: Duplicate and Re-submission Detection
 */
exports.checkDuplicate = async (req, res) => {
    const { originalId, sampleId } = req.query;
    if (!originalId && !sampleId) {
        return res.status(400).json({ error: 'Missing originalId or sampleId parameter' });
    }

    try {
        const queryTerm = String(originalId || sampleId).trim();
        const sample = await prisma.sample.findFirst({
            where: {
                OR: [
                    { originalId: queryTerm },
                    { id: queryTerm }
                ]
            },
            select: {
                id: true,
                originalId: true,
                labId: true,
                status: true,
                receptionDate: true,
                receivedBy: true,
                assignedLab: true,
                projectCode: true,
                receivedMass: true,
                moistureOnArrival: true
            }
        });

        if (!sample) {
            return res.json({ exists: false });
        }

        const priorReceiptStatuses = [
            'RECEIVED', 'ACCEPTED', 'PROCESSING', 'COMPLETED',
            'APPROVED', 'SUBMITTED_PARTIAL', 'SUBMITTED_FULL', 'IN_PROGRESS'
        ];
        const isPriorReceipt = priorReceiptStatuses.includes(sample.status);

        return res.json({
            exists: true,
            isPriorReceipt,
            sample
        });
    } catch (err) {
        console.error('[checkDuplicate] ERROR:', err);
        return res.status(500).json({ error: 'Failed to check duplicate: ' + err.message });
    }
};

/**
 * POST /api/reception/mass-check
 * RC-01: Analytical Mass Sufficiency Calculation
 */
exports.calculateMassRequirement = async (req, res) => {
    const { analysisCodes = [], analysisGroupIds = [], retentionMass = 100 } = req.body;

    try {
        const codes = new Set(Array.isArray(analysisCodes) ? analysisCodes : []);

        if (Array.isArray(analysisGroupIds) && analysisGroupIds.length > 0) {
            const groups = await prisma.analysisGroup.findMany({
                where: { id: { in: analysisGroupIds } }
            });
            groups.forEach(g => {
                const arr = g.analyses ? JSON.parse(g.analyses) : [];
                arr.forEach(c => codes.add(c));
            });
        }

        const analysisList = await prisma.analysis.findMany({
            where: { code: { in: Array.from(codes) } },
            select: { code: true, name: true, sampleMassRequired: true }
        });

        const breakdown = analysisList.map(a => ({
            code: a.code,
            name: a.name,
            massRequired: a.sampleMassRequired || 10.0
        }));

        const totalAnalyticalMass = breakdown.reduce((sum, item) => sum + item.massRequired, 0);
        const retention = typeof retentionMass === 'number' ? retentionMass : 100.0;
        const totalRequiredMass = totalAnalyticalMass + retention;

        return res.json({
            success: true,
            totalRequiredMass,
            totalAnalyticalMass,
            retentionMass: retention,
            breakdown
        });
    } catch (err) {
        console.error('[calculateMassRequirement] ERROR:', err);
        return res.status(500).json({ error: 'Failed to calculate mass requirement: ' + err.message });
    }
};

/**
 * POST /api/reception/upload-photo
 * RC-03: Upload Intake or Non-Conformance Photographs
 */
exports.uploadIntakePhoto = (req, res) => {
    try {
        const files = req.files || (req.file ? [req.file] : []);
        if (files.length === 0) {
            return res.status(400).json({ success: false, error: 'No image file uploaded' });
        }

        const urls = files.map(f => `/uploads/intake/${f.filename}`);
        return res.json({
            success: true,
            urls,
            url: urls[0]
        });
    } catch (err) {
        console.error('[uploadIntakePhoto] ERROR:', err);
        return res.status(500).json({ error: 'Photo upload failed: ' + err.message });
    }
};

/**
 * GET /api/reception/admin-units
 * RC-05 & RC-08: Administrative hierarchy picker
 */
exports.getAdminUnits = (req, res) => {
    try {
        const { country } = req.query;
        if (country) {
            const data = adminBoundaries[country.toUpperCase()];
            if (!data) return res.status(404).json({ error: `No administrative data for country: ${country}` });
            return res.json({ success: true, country: country.toUpperCase(), ...data });
        }
        return res.json({ success: true, countries: adminBoundaries });
    } catch (err) {
        console.error('[getAdminUnits] ERROR:', err);
        return res.status(500).json({ error: 'Failed to fetch admin units: ' + err.message });
    }
};

/**
 * POST /api/reception/parse-coordinates
 * RC-05: Parse any coordinate string (DD, DMS, UTM)
 */
exports.parseCoordinatesEndpoint = (req, res) => {
    try {
        const { coordinates } = req.body;
        if (!coordinates) {
            return res.status(400).json({ error: 'Coordinates string is required' });
        }
        const parsed = parseCoordinates(coordinates);
        if (!parsed) {
            return res.status(400).json({ error: 'Could not parse coordinates. Accepted formats: DD, DMS, UTM with Zone.' });
        }
        return res.json({ success: true, ...parsed });
    } catch (err) {
        console.error('[parseCoordinatesEndpoint] ERROR:', err);
        return res.status(500).json({ error: 'Failed to parse coordinates: ' + err.message });
    }
};

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function findNearestOfflineAdmin(lat, lng) {
    let nearest = null;
    let minDistance = Infinity;

    for (const [countryCode, cData] of Object.entries(adminBoundaries)) {
        for (const dept of cData.departments || []) {
            for (const mun of dept.municipalities || []) {
                const [cLat, cLng] = mun.center;
                const d = haversineDistanceKm(lat, lng, cLat, cLng);
                if (d < minDistance) {
                    minDistance = d;
                    nearest = {
                        village: mun.name,
                        municipality: mun.name,
                        district: dept.name,
                        country: cData.name,
                        countryCode,
                        displayName: `${mun.name}, ${dept.name}, ${cData.name}`,
                        distanceKm: parseFloat(d.toFixed(1))
                    };
                }
            }
        }
    }
    return { nearest, minDistance };
}

/**
 * GET /api/reception/reverse-geocode
 * RC-08: Server-side geocoding proxy with caching & offline fallback
 */
exports.reverseGeocode = async (req, res) => {
    try {
        const lat = parseFloat(req.query.lat);
        const lng = parseFloat(req.query.lng);

        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return res.status(400).json({ error: 'Valid lat and lng query parameters are required' });
        }

        const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
        if (geocodeCache.has(cacheKey)) {
            const cached = geocodeCache.get(cacheKey);
            return res.json({ success: true, ...cached, source: 'CACHE' });
        }

        const { nearest, minDistance } = findNearestOfflineAdmin(lat, lng);

        let onlineResult = null;
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`;
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'SoilFER-LIMS/1.0 (+https://soilfer.org; FAO Technical Cooperation Program)'
                },
                signal: AbortSignal.timeout(3500)
            });

            if (response.ok) {
                const data = await response.json();
                if (data && data.address) {
                    const addr = data.address;
                    const town = addr.village || addr.town || addr.city || addr.suburb || addr.municipality || nearest?.municipality || '';
                    const district = addr.county || addr.state_district || addr.state || nearest?.district || '';
                    const country = addr.country || nearest?.country || '';
                    const countryCode = (addr.country_code || nearest?.countryCode || '').toUpperCase();

                    onlineResult = {
                        village: town,
                        municipality: town,
                        district,
                        country,
                        countryCode,
                        displayName: data.display_name || `${town}, ${district}, ${country}`
                    };
                }
            }
        } catch (osmErr) {
            console.warn('[reverseGeocode] OSM Nominatim unavailable, falling back to catalog:', osmErr.message);
        }

        if (onlineResult) {
            geocodeCache.set(cacheKey, onlineResult);
            return res.json({ success: true, ...onlineResult, source: 'ONLINE' });
        }

        if (nearest && minDistance <= 80) {
            geocodeCache.set(cacheKey, nearest);
            return res.json({ success: true, ...nearest, source: 'OFFLINE_BOUNDARY' });
        }

        return res.json({
            success: true,
            village: '',
            municipality: '',
            district: '',
            country: nearest?.country || '',
            countryCode: nearest?.countryCode || '',
            displayName: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
            source: 'FALLBACK'
        });
    } catch (err) {
        console.error('[reverseGeocode] ERROR:', err);
        return res.status(500).json({ error: 'Reverse geocode failed: ' + err.message });
    }
};

/**
 * GET /api/reception/batch-geometry-check
 * RC-10: Batch geometry outlier check
 */
exports.batchGeometryCheck = async (req, res) => {
    try {
        const { projectId, lat: latStr, lng: lngStr, sampleId } = req.query;
        const candLat = parseFloat(latStr);
        const candLng = parseFloat(lngStr);

        if (isNaN(candLat) || isNaN(candLng)) {
            return res.status(400).json({ error: 'Valid candidate lat and lng are required' });
        }

        if (!projectId) {
            return res.json({ isOutlier: false, reason: 'No project specified' });
        }

        const projectSamples = await prisma.sample.findMany({
            where: {
                OR: [
                    { projectId },
                    { projectCode: projectId }
                ],
                latitude: { not: null },
                longitude: { not: null },
                ...(sampleId ? { id: { not: sampleId } } : {})
            },
            select: { id: true, originalId: true, latitude: true, longitude: true }
        });

        if (projectSamples.length < 2) {
            return res.json({
                isOutlier: false,
                sampleCount: projectSamples.length,
                reason: 'Insufficient existing sample points for cluster outlier calculation'
            });
        }

        const count = projectSamples.length;
        const avgLat = projectSamples.reduce((sum, s) => sum + s.latitude, 0) / count;
        const avgLng = projectSamples.reduce((sum, s) => sum + s.longitude, 0) / count;

        const distances = projectSamples.map(s => haversineDistanceKm(avgLat, avgLng, s.latitude, s.longitude));
        distances.sort((a, b) => a - b);
        const medianClusterRadiusKm = distances[Math.floor(distances.length / 2)];

        const candDistToCentroid = haversineDistanceKm(avgLat, avgLng, candLat, candLng);
        const isOutlier = candDistToCentroid > 40.0 || (candDistToCentroid > 20.0 && candDistToCentroid > 3 * medianClusterRadiusKm);

        return res.json({
            success: true,
            isOutlier,
            distanceKm: parseFloat(candDistToCentroid.toFixed(1)),
            clusterMedianRadiusKm: parseFloat(medianClusterRadiusKm.toFixed(1)),
            clusterCentroid: { lat: parseFloat(avgLat.toFixed(5)), lng: parseFloat(avgLng.toFixed(5)) },
            sampleCount: count,
            warning: isOutlier
                ? `Spatial Outlier Warning: Coordinate is ${candDistToCentroid.toFixed(1)} km from project cluster centroid (median radius: ${medianClusterRadiusKm.toFixed(1)} km across ${count} samples). Verify against label transposition.`
                : null
        });
    } catch (err) {
        console.error('[batchGeometryCheck] ERROR:', err);
        return res.status(500).json({ error: 'Batch geometry check failed: ' + err.message });
    }
};

/**
 * POST /api/reception/consignments
 * RC-12: Consignment Record
 * RC-13: High-Throughput Batch Receive
 * RC-14: Per-Sample Exception Handling in Batch Intake
 */
exports.processBatchConsignmentIntake = async (req, res) => {
    try {
        const user = req.user;
        const { consignment: csgInput = {}, defaults = {}, samples = [] } = req.body;

        if (!Array.isArray(samples) || samples.length === 0) {
            return res.status(400).json({ error: 'At least one sample is required for batch intake' });
        }

        const userLab = user?.labId || 'GEN';
        const receivedBy = user?.username || 'reception_staff';
        const now = new Date();

        // Validate project admission policy for consignment and batch samples (PM-14)
        const projectRefs = new Set();
        if (csgInput.projectCode) projectRefs.add(String(csgInput.projectCode));
        if (csgInput.projectId) projectRefs.add(String(csgInput.projectId));
        for (const s of samples) {
            if (s.projectCode) projectRefs.add(String(s.projectCode));
            if (s.projectId) projectRefs.add(String(s.projectId));
        }

        const sampleOriginalIds = samples.map(s => String(s.originalId || s.id || '')).filter(Boolean);
        if (sampleOriginalIds.length > 0) {
            const existingSamplesWithProj = await prisma.sample.findMany({
                where: {
                    OR: [
                        { originalId: { in: sampleOriginalIds } },
                        { id: { in: sampleOriginalIds } }
                    ]
                },
                select: { id: true, originalId: true, projectId: true, projectCode: true }
            });
            for (const es of existingSamplesWithProj) {
                if (es.projectId) projectRefs.add(String(es.projectId));
                if (es.projectCode) projectRefs.add(String(es.projectCode));

                const csgProj = csgInput.projectId || csgInput.projectCode;
                const sampleProj = es.projectId || es.projectCode;
                if (csgProj && sampleProj && String(csgProj) !== String(es.projectId) && String(csgProj) !== String(es.projectCode)) {
                    return res.status(400).json({
                        error: 'CROSS_PROJECT_CONFLICT',
                        message: `Sample ${es.originalId || es.id} is already registered to project ${sampleProj}. Direct project reassignment via consignment intake is not permitted.`
                    });
                }
            }
        }

        if (projectRefs.size > 0) {
            const allReferencedProjects = await prisma.project.findMany({
                where: {
                    OR: [
                        { id: { in: Array.from(projectRefs) } },
                        { code: { in: Array.from(projectRefs) } }
                    ]
                }
            });

            for (const proj of allReferencedProjects) {
                const { hasException, exceptionRecord } = await projectPolicyService.resolveAndVerifyExceptionRecord({
                    rawExceptionRecord: req.body.exceptionRecord,
                    rawExceptionReason: req.body.exceptionReason,
                    authorizer: req.body.authorizer,
                    approvalId: req.body.approvalId || req.body.approvalToken,
                    actor: user,
                    project: proj,
                    labId: userLab,
                    prismaClient: prisma
                });

                const admission = projectPolicyService.canAdmitSample({
                    project: proj,
                    channel: 'MANIFEST',
                    actor: user,
                    labId: userLab,
                    hasException,
                    exceptionRecord
                });
                if (!admission.allowed) {
                    return res.status(422).json({
                        error: admission.code || 'PROJECT_ADMISSIONS_BLOCKED',
                        message: `Cannot receive consignment: ${admission.reason}`,
                        exceptionRequired: Boolean(admission.exceptionRequired)
                    });
                }
            }
        }

        // 1. Generate unique sequential consignment code CSG-YYYYMMDD-XXX
        const todayStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const csgPrefix = `CSG-${todayStr}-`;
        const countToday = await prisma.consignment.count({
            where: { code: { startsWith: csgPrefix } }
        });
        const consignmentCode = `${csgPrefix}${String(countToday + 1).padStart(3, '0')}`;

        // 2. Count statuses
        let acceptedCount = 0;
        let rejectedCount = 0;
        samples.forEach(s => {
            if (s.status === 'REJECTED') rejectedCount++;
            else acceptedCount++;
        });

        const consignmentStatus = rejectedCount === samples.length ? 'REJECTED' : (rejectedCount > 0 ? 'PARTIAL' : 'RECEIVED');

        // 3. Preload all analyses for mass requirement calculation
        const allAnalysesDb = await prisma.analysis.findMany({
            select: { code: true, name: true, sampleMassRequired: true, category: true }
        });
        const analysisMap = new Map(allAnalysesDb.map(a => [a.code, a]));

        // Validate every sample before creating the consignment or any sample records.
        for (const [index, sample] of samples.entries()) {
            if (sample.status === 'REJECTED') continue;
            const selected = await cataloguePolicy.validateSelection(sample.requiredAnalyses ?? defaults.requiredAnalyses ?? [], { labId: userLab });
            if (!selected.valid) return res.status(400).json({ error: selected.error, message: selected.error, row: index + 1, issues: selected.issues });
        }

        // Canonical project resolution (F11)
        const candidateConsignmentProject = csgInput.projectCode || csgInput.projectId;
        const resolvedConsignmentProject = candidateConsignmentProject
            ? await projectPolicyService.resolveProject(candidateConsignmentProject, prisma)
            : null;

        // Gate consignment intake through centralized admission policy
        if (resolvedConsignmentProject) {
            const { hasException, exceptionRecord } = await projectPolicyService.resolveAndVerifyExceptionRecord({
                rawExceptionRecord: req.body.exceptionRecord,
                rawExceptionReason: req.body.exceptionReason,
                authorizer: req.body.authorizer,
                approvalId: req.body.approvalId || req.body.approvalToken,
                actor: user,
                project: resolvedConsignmentProject.project,
                labId: userLab,
                prismaClient: prisma
            });

            const admission = projectPolicyService.canAdmitSample({
                project: resolvedConsignmentProject.project,
                channel: 'MANIFEST',
                actor: user,
                labId: userLab,
                hasException,
                exceptionRecord
            });

            if (!admission.allowed) {
                return res.status(422).json({
                    error: admission.code || 'PROJECT_ADMISSIONS_BLOCKED',
                    message: admission.reason,
                    exceptionRequired: Boolean(admission.exceptionRequired)
                });
            }
        }

        // 4. Atomic transaction across consignment and all samples
        const result = await prisma.$transaction(async (tx) => {
            // A. Create Consignment Record (RC-12)
            const consignment = await tx.consignment.create({
                data: {
                    id: crypto.randomUUID(),
                    code: consignmentCode,
                    labId: userLab,
                    projectCode: resolvedConsignmentProject ? resolvedConsignmentProject.code : (csgInput.projectCode || null),
                    submitterName: csgInput.submitterName || csgInput.submitter?.name || null,
                    submitterOrg: csgInput.submitterOrg || csgInput.submitter?.organization || null,
                    submitterPhone: csgInput.submitterPhone || csgInput.submitter?.phone || null,
                    submitterEmail: csgInput.submitterEmail || csgInput.submitter?.email || null,
                    deliveredBy: csgInput.deliveredBy || null,
                    deliveredAt: csgInput.deliveredAt ? new Date(csgInput.deliveredAt) : null,
                    receivedBy,
                    receivedAt: now,
                    deliveryNoteRef: csgInput.deliveryNoteRef || null,
                    expectedCount: parseInt(csgInput.expectedCount) || samples.length,
                    sampleCount: samples.length,
                    acceptedCount,
                    rejectedCount,
                    status: consignmentStatus,

                    // Stage E: Chain of Custody & Handover (RC-19)
                    custodyHandoverAt: csgInput.custodyHandoverAt ? new Date(csgInput.custodyHandoverAt) : (csgInput.deliveredAt ? new Date(csgInput.deliveredAt) : now),
                    custodyCarrierName: csgInput.custodyCarrierName || csgInput.deliveredBy || null,
                    custodyTrackingNumber: csgInput.custodyTrackingNumber || csgInput.deliveryNoteRef || null,
                    custodySenderSignature: csgInput.custodySenderSignature || null,
                    receivingOfficerId: user?.id ? String(user.id) : null,
                    receivingOfficerName: user?.name || user?.username || receivedBy,
                    receivingOfficerSignature: csgInput.receivingOfficerSignature || `CONFIRMED:${receivedBy}:${now.toISOString()}`,

                    notes: csgInput.notes || null,
                    metadata: csgInput.metadata ? JSON.stringify(csgInput.metadata) : null
                }
            });

            // B. Process each sample
            const processedSamples = [];

            for (let i = 0; i < samples.length; i++) {
                const s = samples[i];
                const originalId = String(s.originalId || s.id || `SMP-${i + 1}`).trim();
                const isRejected = s.status === 'REJECTED';
                const status = isRejected ? 'RECEIVED_REJECTED' : workflow.SAMPLE_STATES.ACCEPTED;
                const rejectionReason = isRejected ? (s.rejectionReason || 'Sample non-conformance recorded during batch reception') : null;

                // Merge values with defaults
                const rawMass = s.receivedMass !== undefined && s.receivedMass !== null && s.receivedMass !== '' ? s.receivedMass : defaults.receivedMass;
                const parsedMass = rawMass !== undefined && rawMass !== null && rawMass !== '' ? parseFloat(rawMass) : null;
                const moisture = s.moistureOnArrival || defaults.moistureOnArrival || 'MOIST';
                const foreignMat = s.foreignMaterial || defaults.foreignMaterial || [];
                const photos = s.intakePhotos || [];
                const reqAnalyses = s.requiredAnalyses ?? defaults.requiredAnalyses ?? [];

                // Geodesy / Location
                let lat = null, lng = null, elev = null;
                if (s.latitude !== undefined && s.latitude !== null && s.latitude !== '') {
                    lat = parseFloat(s.latitude);
                    lng = s.longitude !== undefined && s.longitude !== null ? parseFloat(s.longitude) : null;
                    elev = s.elevation !== undefined && s.elevation !== null ? parseFloat(s.elevation) : null;
                } else if (s.coordinates) {
                    lat = parseFloat(s.coordinates.lat);
                    lng = parseFloat(s.coordinates.lng);
                    elev = parseFloat(s.coordinates.elevation);
                }

                const uncertaintyM = s.positionalUncertaintyM !== undefined && s.positionalUncertaintyM !== null && s.positionalUncertaintyM !== ''
                    ? parseFloat(s.positionalUncertaintyM)
                    : (lat && lng ? 10.0 : null);

                const compRadius = s.compositeRadiusM !== undefined && s.compositeRadiusM !== null && s.compositeRadiusM !== ''
                    ? parseFloat(s.compositeRadiusM)
                    : (defaults.compositeRadiusM ? parseFloat(defaults.compositeRadiusM) : null);

                const depthTop = s.depthTopCm !== undefined && s.depthTopCm !== null && s.depthTopCm !== ''
                    ? parseFloat(s.depthTopCm)
                    : (defaults.depthTopCm !== undefined && defaults.depthTopCm !== null ? parseFloat(defaults.depthTopCm) : null);

                const depthBottom = s.depthBottomCm !== undefined && s.depthBottomCm !== null && s.depthBottomCm !== ''
                    ? parseFloat(s.depthBottomCm)
                    : (defaults.depthBottomCm !== undefined && defaults.depthBottomCm !== null ? parseFloat(defaults.depthBottomCm) : null);

                const locSource = s.locationSource || (lat && lng ? 'DESK_PASTE' : 'TEXT_ONLY');

                // Generate short sequential Lab ID (RC-13)
                const labId = await idGenerator.generateLabId(userLab, 'S');

                // Check if sample already exists (e.g. EXPECTED sample in Project)
                const existing = await tx.sample.findFirst({
                    where: {
                        OR: [
                            { originalId },
                            { id: originalId }
                        ]
                    }
                });

                const historyNote = isRejected
                    ? `Rejected during batch reception under Consignment ${consignment.code}. Reason: ${rejectionReason}`
                    : `Batch accepted under Consignment ${consignment.code} (${consignment.deliveryNoteRef || 'no ref'}). Lab ID assigned: ${labId}`;

                let sampleRecord;

                const sampleDataCommon = {
                    labId,
                    status,
                    assignedLab: userLab,
                    projectCode: resolvedConsignmentProject ? resolvedConsignmentProject.code : (consignment.projectCode || (existing?.projectCode || null)),
                    projectId: resolvedConsignmentProject ? resolvedConsignmentProject.id : (existing?.projectId || null),
                    receptionDate: now,
                    receivedBy,
                    acceptedBy: isRejected ? null : receivedBy,
                    acceptedAt: isRejected ? null : now,
                    dryingStatus: isRejected ? null : 'PENDING',
                    preparationStatus: isRejected ? null : 'PENDING',
                    receivedMass: parsedMass,
                    massWarningAcknowledged: true,
                    moistureOnArrival: moisture,
                    foreignMaterial: typeof foreignMat === 'string' ? foreignMat : JSON.stringify(foreignMat),
                    intakePhotos: JSON.stringify(photos),
                    rejectionReason,
                    latitude: lat,
                    longitude: lng,
                    elevation: elev,
                    positionalUncertaintyM: uncertaintyM,
                    locationSource: locSource,
                    locationCapturedAt: (lat && lng) ? now : null,
                    locationCapturedBy: (lat && lng) ? receivedBy : null,
                    compositeRadiusM: compRadius,
                    depthTopCm: depthTop,
                    depthBottomCm: depthBottom,
                    admin1: s.admin1 || defaults.admin1 || null,
                    admin2: s.admin2 || defaults.admin2 || null,
                    village: s.village || defaults.village || null,
                    siteName: s.siteName || defaults.siteName || null,

                    // Stage E: Chain of Custody & Handover (RC-19)
                    custodyHandoverAt: s.custodyHandoverAt ? new Date(s.custodyHandoverAt) : (csgInput.custodyHandoverAt ? new Date(csgInput.custodyHandoverAt) : (csgInput.deliveredAt ? new Date(csgInput.deliveredAt) : now)),
                    custodyCarrierName: s.custodyCarrierName || csgInput.custodyCarrierName || csgInput.deliveredBy || null,
                    custodyTrackingNumber: s.custodyTrackingNumber || csgInput.custodyTrackingNumber || csgInput.deliveryNoteRef || null,
                    custodySenderSignature: s.custodySenderSignature || csgInput.custodySenderSignature || null,
                    receivingOfficerId: user?.id ? String(user.id) : null,
                    receivingOfficerName: user?.name || user?.username || receivedBy,
                    receivingOfficerSignature: s.receivingOfficerSignature || csgInput.receivingOfficerSignature || `CONFIRMED:${receivedBy}:${now.toISOString()}`,

                    requiredAnalyses: JSON.stringify(reqAnalyses),
                    consignmentId: consignment.id,
                    receptionData: JSON.stringify({
                        consignmentCode: consignment.code,
                        deliveryNoteRef: consignment.deliveryNoteRef,
                        deliveredBy: consignment.deliveredBy,
                        batchIndex: i + 1,
                        notes: s.notes || null,
                        checklist: s.checklist || defaults.checklist || {}
                    })
                };

                if (existing) {
                    const existingHist = typeof existing.history === 'string' ? JSON.parse(existing.history) : (existing.history || []);
                    existingHist.push({ status: isRejected ? 'RECEIVED_REJECTED' : 'ACCEPTED', changedBy: receivedBy, timestamp: now, note: historyNote });

                    sampleRecord = await tx.sample.update({
                        where: { id: existing.id },
                        data: {
                            ...sampleDataCommon,
                            history: JSON.stringify(existingHist)
                        }
                    });
                } else {
                    const newHist = [{ status: isRejected ? 'RECEIVED_REJECTED' : 'ACCEPTED', changedBy: receivedBy, timestamp: now, note: historyNote }];
                    sampleRecord = await tx.sample.create({
                        data: {
                            id: crypto.randomUUID(),
                            originalId,
                            ...sampleDataCommon,
                            history: JSON.stringify(newHist)
                        }
                    });
                }

                // If sample accepted, create WorkItems for drying, preparation, and analyses
                if (!isRejected) {
                    const workItemsToCreate = [];
                    workItemsToCreate.push({
                        id: crypto.randomUUID(),
                        sampleId: sampleRecord.id,
                        labId: sampleRecord.labId,
                        assignedLab: userLab,
                        analysis: 'DRYING',
                        category: 'Operational Gates',
                        status: 'NOT_ASSIGNED'
                    });
                    workItemsToCreate.push({
                        id: crypto.randomUUID(),
                        sampleId: sampleRecord.id,
                        labId: sampleRecord.labId,
                        assignedLab: userLab,
                        analysis: 'PREPARATION',
                        category: 'Operational Gates',
                        status: 'NOT_ASSIGNED'
                    });

                    for (const code of reqAnalyses) {
                        const meta = analysisMap.get(code);
                        const cat = typeof meta?.category === 'object'
                            ? (meta?.category?.name || meta?.category?.id || 'General Chemistry')
                            : (meta?.category || 'General Chemistry');
                        workItemsToCreate.push({
                            id: crypto.randomUUID(),
                            sampleId: sampleRecord.id,
                            labId: sampleRecord.labId,
                            assignedLab: userLab,
                            analysis: code,
                            category: String(cat),
                            status: 'NOT_ASSIGNED'
                        });
                    }

                    await tx.workItem.createMany({
                        data: workItemsToCreate
                    });
                }

                processedSamples.push({
                    id: sampleRecord.id,
                    originalId: sampleRecord.originalId,
                    labId: sampleRecord.labId,
                    status: sampleRecord.status,
                    rejectionReason: sampleRecord.rejectionReason,
                    receivedMass: sampleRecord.receivedMass
                });
            }

            // C. Audit log (RC-12, RC-13)
            await tx.auditLog.create({
                data: {
                    id: `audit-csg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    entity: 'CONSIGNMENT',
                    entityId: consignment.id,
                    action: 'CONSIGNMENT_BATCH_RECEIVED',
                    details: `Consignment ${consignment.code} received with ${samples.length} samples (${acceptedCount} accepted, ${rejectedCount} rejected). Delivery Note: ${consignment.deliveryNoteRef || 'None'}.`,
                    performedBy: receivedBy,
                    timestamp: now
                }
            });

            return { consignment, samples: processedSamples };
        });

        return res.status(201).json({
            success: true,
            consignment: result.consignment,
            samples: result.samples,
            message: `Batch received ${samples.length} samples under Consignment ${result.consignment.code}.`
        });
    } catch (err) {
        console.error('[processBatchConsignmentIntake] ERROR:', err);
        return res.status(500).json({ error: 'Batch consignment intake failed: ' + err.message });
    }
};

/**
 * GET /api/reception/consignments
 * RC-12: List Consignment records
 */
exports.getConsignments = async (req, res) => {
    try {
        const { search, projectCode, status, page = 1, limit = 50 } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        const where = {};
        if (projectCode) where.projectCode = projectCode;
        if (status) where.status = status;
        if (search) {
            where.OR = [
                { code: { contains: search } },
                { deliveryNoteRef: { contains: search } },
                { submitterName: { contains: search } },
                { submitterOrg: { contains: search } },
                { deliveredBy: { contains: search } }
            ];
        }

        const [total, consignments] = await Promise.all([
            prisma.consignment.count({ where }),
            prisma.consignment.findMany({
                where,
                orderBy: { receivedAt: 'desc' },
                skip,
                take: limitNum,
                include: {
                    _count: {
                        select: { samples: true }
                    }
                }
            })
        ]);

        return res.json({
            success: true,
            data: consignments,
            total,
            page: pageNum,
            limit: limitNum
        });
    } catch (err) {
        console.error('[getConsignments] ERROR:', err);
        return res.status(500).json({ error: 'Failed to fetch consignments: ' + err.message });
    }
};

/**
 * GET /api/reception/consignments/:id
 * RC-12: Consignment Detail
 */
exports.getConsignmentDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const consignment = await prisma.consignment.findFirst({
            where: {
                OR: [
                    { id },
                    { code: id }
                ]
            },
            include: {
                samples: {
                    select: {
                        id: true,
                        originalId: true,
                        labId: true,
                        status: true,
                        rejectionReason: true,
                        receivedMass: true,
                        moistureOnArrival: true,
                        latitude: true,
                        longitude: true,
                        positionalUncertaintyM: true,
                        depthTopCm: true,
                        depthBottomCm: true,
                        siteName: true,
                        village: true,
                        admin1: true,
                        createdAt: true
                    }
                }
            }
        });

        if (!consignment) {
            return res.status(404).json({ error: 'Consignment not found' });
        }

        return res.json({ success: true, consignment });
    } catch (err) {
        console.error('[getConsignmentDetail] ERROR:', err);
        return res.status(500).json({ error: 'Failed to fetch consignment detail: ' + err.message });
    }
};

/**
 * POST /api/reception/parse-manifest
 * RC-15: Validate & Parse Client Manifest rows
 */
exports.parseManifestEndpoint = async (req, res) => {
    try {
        const { rows, mapping } = req.body;
        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({ error: 'Array of manifest rows is required' });
        }

        const idCol = mapping?.sampleId || 'sample_id';
        const latCol = mapping?.latitude || 'latitude';
        const lngCol = mapping?.longitude || 'longitude';
        const coordCol = mapping?.coordinates || 'coordinates';
        const depthTopCol = mapping?.depthTop || 'depth_top';
        const depthBottomCol = mapping?.depthBottom || 'depth_bottom';
        const massCol = mapping?.receivedMass || 'mass';
        const siteCol = mapping?.siteName || 'site';
        const villageCol = mapping?.village || 'village';
        const admin1Col = mapping?.admin1 || 'admin1';

        const parsedRows = [];
        const errors = [];

        for (let i = 0; i < rows.length; i++) {
            const raw = rows[i];
            const sampleId = String(raw[idCol] || raw['id'] || raw['ID'] || raw['Sample ID'] || '').trim();
            if (!sampleId) {
                errors.push({ row: i + 1, error: 'Missing sample identifier' });
                continue;
            }

            let lat = null, lng = null, uncertaintyM = null, format = null;

            // Direct lat/lng
            if (raw[latCol] !== undefined && raw[lngCol] !== undefined) {
                const parsedLat = parseFloat(raw[latCol]);
                const parsedLng = parseFloat(raw[lngCol]);
                if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
                    lat = parsedLat;
                    lng = parsedLng;
                    uncertaintyM = 10;
                    format = 'DD';
                }
            }

            // Or unified coordinates string
            if ((!lat || !lng) && (raw[coordCol] || raw['coords'] || raw['Coordinates'])) {
                const cStr = String(raw[coordCol] || raw['coords'] || raw['Coordinates']);
                const parsed = parseCoordinates(cStr);
                if (parsed) {
                    lat = parsed.lat;
                    lng = parsed.lng;
                    uncertaintyM = parsed.uncertaintyM;
                    format = parsed.format;
                }
            }

            parsedRows.push({
                rowIndex: i + 1,
                originalId: sampleId,
                status: 'ACCEPTED',
                latitude: lat,
                longitude: lng,
                positionalUncertaintyM: uncertaintyM,
                coordFormat: format,
                depthTopCm: raw[depthTopCol] !== undefined ? parseFloat(raw[depthTopCol]) : null,
                depthBottomCm: raw[depthBottomCol] !== undefined ? parseFloat(raw[depthBottomCol]) : null,
                receivedMass: raw[massCol] !== undefined ? parseFloat(raw[massCol]) : null,
                siteName: raw[siteCol] || null,
                village: raw[villageCol] || null,
                admin1: raw[admin1Col] || null,
                raw
            });
        }

        return res.json({
            success: true,
            total: rows.length,
            validCount: parsedRows.length,
            errorCount: errors.length,
            errors,
            parsedRows
        });
    } catch (err) {
        console.error('[parseManifestEndpoint] ERROR:', err);
        return res.status(500).json({ error: 'Failed to parse manifest: ' + err.message });
    }
};

/**
 * GET /api/reception/sample-context/:id or ?originalId=...
 * Scoped, pure read-only intake detail resolver.
 * Loads complete intake context (fieldMetadata, receptionData, project,
 * resolved coordinates) without side effects or mutating self-healing writes.
 */
exports.getSampleIntakeContext = async (req, res) => {
    const identifier = req.params.id || req.query.id || req.query.originalId || req.query.identifier || req.query.code;
    if (!identifier || !String(identifier).trim()) {
        return res.status(400).json({
            success: false,
            error: 'MISSING_IDENTIFIER',
            message: 'Sample identifier is required.'
        });
    }
    const cleanId = String(identifier).trim();
    const user = req.user;

    try {
        const sample = await prisma.sample.findFirst({
            where: {
                OR: [
                    { id: cleanId },
                    { originalId: cleanId },
                    { labId: cleanId }
                ]
            },
            include: {
                project: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        projectType: true,
                        status: true,
                        defaultAnalysisBundle: true
                    }
                }
            }
        });

        if (!sample) {
            return res.status(404).json({
                success: false,
                error: 'SAMPLE_NOT_FOUND',
                message: `Sample '${cleanId}' not found.`
            });
        }

        // Scope check
        const scopeGuard = require('../utils/scopeGuard');
        try {
            scopeGuard.ensureScope(user, sample, { altLabField: 'assignedLab' });
        } catch (scopeErr) {
            return res.status(403).json({
                success: false,
                error: 'ACCESS_DENIED',
                message: 'Access denied: sample belongs to another laboratory.'
            });
        }

        const parseJson = (val) => {
            if (!val) return null;
            if (typeof val === 'object') return val;
            try { return JSON.parse(val); } catch { return null; }
        };

        const fieldMetadata = parseJson(sample.fieldMetadata) || {};
        const receptionData = parseJson(sample.receptionData) || {};
        const requiredAnalyses = parseJson(sample.requiredAnalyses) || [];
        const analysisGroupIds = parseJson(sample.analysisGroupIds) || [];
        const intakePhotos = parseJson(sample.intakePhotos) || [];
        const foreignMaterial = parseJson(sample.foreignMaterial) || [];
        const history = parseJson(sample.history) || [];

        // Coordinate resolution
        const { resolveCoordinates } = require('../utils/coordinateResolver');
        const coordinates = resolveCoordinates({
            ...sample,
            fieldMetadata,
            receptionData
        });

        return res.json({
            success: true,
            sample: {
                ...sample,
                fieldMetadata,
                receptionData,
                requiredAnalyses,
                analysisGroupIds,
                intakePhotos,
                foreignMaterial,
                history
            },
            coordinates,
            project: sample.project || null
        });
    } catch (err) {
        console.error('[getSampleIntakeContext] Error:', err);
        return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
};


