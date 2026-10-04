const cataloguePolicy = require('../services/cataloguePolicy');
const workflow = require('../workflowContract');
const idGenerator = require('../services/idGenerator');
const sampleCodes = require('../services/sampleCodeService');
const { parseCoordinates } = require('../utils/coordParser');
const adminBoundaries = require('../data/adminBoundaries.json');
const crypto = require('crypto');
const sampleOriginService = require('../services/sampleOriginService');
const sampleStateService = require('../services/sampleStateService');
const projectPolicyService = require('../services/projectPolicyService');
const profileIdentity = require('../services/profileIdentityService');
const intakeProfile = require('../services/intakeProfileService');
const { massRequirement, massDeficit } = require('../services/intakeMassService');
const batchObservations = require('../services/batchIntakeObservationsService');

const { LOCKED_INTAKE_STATUSES, deriveLocationConfidence, resolveAnalysisGroup, evaluateChecklistCompliance } = require('./intakeValidationService');
const workItems = require('./intakeWorkItemService');
const { IntakeError } = require('./intakeErrors');

async function prepareIntake(prisma, { body: rawBody, user, newSampleId, initialFieldMetadata = {} }) {
    const body = { ...rawBody };
    let createData = null;
    let admissionExceptionRecord = null;
    validateObservations(body);
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
    } = body;

    // Trust authenticated identity over client-supplied actor (Finding #6)
    const receivedBy = user.username || clientReceivedBy || 'Unknown';
    console.log(`[INTAKE] Processing intake for ${originalId} by ${receivedBy}`);

    let sample = await prisma.sample.findFirst({
            where: { OR: [{ id: String(body.sampleId || body.id || originalId || '') }, { originalId: String(originalId || '') }] }
        });

        if (!user.labId && require('../utils/scopeGuard').hasGlobalAccess(user)) user = { ...user, labId: sample?.assignedLab || body.assignedLab || null };
        if (!user.labId) throw new IntakeError(403, { code: 'MISSING_LAB_SCOPE', message: 'Select a receiving laboratory.' });

        // Recheck saved custody facts and keep arrival evidence when acceptance omits those fields.
        for (const field of ['custodyHandoverAt', 'custodyCarrierName', 'custodyTrackingNumber', 'custodySenderSignature', 'receivingOfficerSignature']) {
            if (body[field] === undefined && sample?.[field] != null) body[field] = sample[field];
        }
        let isNewlyCreatedDeskSample = false;

        if (sample) {
            // Check for active provenance hold (Finding 4: Ambiguous specimen identity must remain visibly unresolved)
            let sampleMeta = {};
            try {
                sampleMeta = typeof sample.metadata === 'string' ? JSON.parse(sample.metadata) : (sample.metadata || {});
            } catch (e) {}
            if (sampleMeta.provenanceHold && sampleMeta.provenanceHold.status === 'AMBIGUOUS_PROVENANCE_HOLD') {
                throw new IntakeError(409, {
                    error: 'PROVENANCE_HOLD',
                    code: 'AMBIGUOUS_PROVENANCE_HOLD',
                    message: `Cannot process intake for sample '${sample.originalId}': Ambiguous field specimen identity. Reconciliation required before physical intake. Reason: ${sampleMeta.provenanceHold.reason}`
                });
            }

            // Authoritative: Existing sample's persisted project governs admission policy
            const persistedProjectId = sample.projectId || sample.projectCode;
            if (persistedProjectId) {
                const existingResolved = await projectPolicyService.resolveProject(persistedProjectId, prisma);
                const existingProject = existingResolved?.project;
                if (existingProject) {
                    const admission = projectPolicyService.canAdmitSample({
                        project: existingProject,
                        channel: 'PHYSICAL_RECEIPT',
                        actor: user,
                        labId: user.labId
                    });
                    if (!admission.allowed) {
                        throw new IntakeError(422, {
                            error: (admission.code === 'PROJECT_CLOSED' || admission.code === 'PROJECT_PAUSED') ? 'PROJECT_ADMISSIONS_PAUSED' : (admission.code || 'PROJECT_ADMISSIONS_BLOCKED'),
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
                        throw new IntakeError(400, {
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
            const targetSampleId = body.id || body.sampleId || body.originalId || null;
            const intakeChannel = isWalkIn ? 'WALK_IN' : 'DESK';
            const { hasException, exceptionRecord } = await projectPolicyService.resolveAndVerifyExceptionRecord({
                rawExceptionRecord: body.exceptionRecord,
                rawExceptionReason: body.exceptionReason,
                authorizer: body.authorizer,
                approvalId: body.approvalId || body.approvalToken,
                actor: user,
                project: targetProjectObj,
                labId: user.labId,
                sampleId: targetSampleId,
                channel: body.intakeChannel || intakeChannel,
                prismaClient: prisma
            });

            admissionExceptionRecord = hasException ? exceptionRecord : null;
            const admission = projectPolicyService.canAdmitSample({
                project: targetProjectObj,
                channel: body.intakeChannel || (isWalkIn ? 'WALK_IN' : 'DESK'),
                actor: user,
                labId: user.labId,
                hasException,
                exceptionRecord
            });

            if (!admission.allowed) {
                throw new IntakeError(422, {
                    error: (admission.code === 'PROJECT_CLOSED' || admission.code === 'PROJECT_PAUSED') ? 'PROJECT_ADMISSIONS_PAUSED' : (admission.code || 'PROJECT_ADMISSIONS_BLOCKED'),
                    message: admission.reason,
                    exceptionRequired: Boolean(admission.exceptionRequired)
                });
            }
        }

        const isReject = decision === 'REJECTED' || decision === 'REJECT';
        const isDraft = Boolean(body.isDraft);
        const isFinalAcceptance = !isReject && !isDraft;

        if (isFinalAcceptance) {
            const projects = typeof user.projects === 'string' ? JSON.parse(user.projects) : user.projects;
            const candidate = sample?.projectCode || sample?.projectId || projectId || (isWalkIn ? null : projects?.[0]);
            const project = candidate ? await projectPolicyService.resolveProject(candidate, prisma) : null;
            if (!sample || !await sampleCodes.issuedCode(sample, prisma)) await sampleCodes.codePolicy(user.labId, sample?.projectCode || project?.code, prisma);
        }

        let compliance = null;
        let complianceExceptionRecord = null;

        if (isFinalAcceptance) {
            compliance = evaluateChecklistCompliance(checklist, { isWalkIn: Boolean(isWalkIn) });

            if (compliance.invalidNAItems.length > 0) {
                throw new IntakeError(400, {
                    success: false,
                    error: 'INVALID_CHECKLIST_NA',
                    code: 'INVALID_CHECKLIST_NA',
                    message: `Not Applicable (N/A) is not permitted for criteria: ${compliance.invalidNAItems.join(', ')}.`,
                    invalidItems: compliance.invalidNAItems
                });
            }

            if (!compliance.isComplete) {
                throw new IntakeError(400, {
                    success: false,
                    error: 'INCOMPLETE_COMPLIANCE_CHECKLIST',
                    code: 'INCOMPLETE_COMPLIANCE_CHECKLIST',
                    message: `Unanswered compliance checklist items: ${compliance.unansweredItems.join(', ')}. All items must be assessed before final acceptance.`,
                    unansweredItems: compliance.unansweredItems
                });
            }

            if (!compliance.isPassed) {
                // Checklist has failed criteria: routine acceptance is strictly blocked.
                // An authorized manager exception is mandatory.
                const candidateProjectId = projectId || (isWalkIn ? null : (user.projects && user.projects.length > 0 ? (typeof user.projects === 'string' ? JSON.parse(user.projects)[0] : user.projects[0]) : null));
                const targetProjectObj = sample ? (sample.project || (sample.projectId ? (await projectPolicyService.resolveProject(sample.projectId, prisma))?.project : null)) : (candidateProjectId ? (await projectPolicyService.resolveProject(candidateProjectId, prisma))?.project : null);

                const { hasException, exceptionRecord } = await projectPolicyService.resolveAndVerifyExceptionRecord({
                    rawExceptionRecord: body.exceptionRecord,
                    rawExceptionReason: body.exceptionReason || (checklist && checklist.reason),
                    authorizer: body.authorizer,
                    approvalId: body.approvalId || body.approvalToken,
                    actor: user,
                    project: targetProjectObj,
                    labId: user.labId,
                    sampleId: sample ? sample.id : (originalId || null),
                    channel: isWalkIn ? 'WALK_IN' : 'PHYSICAL_RECEIPT',
                    prismaClient: prisma
                });

                if (!hasException || !exceptionRecord?.isStoredApprovalVerified) {
                    throw new IntakeError(403, {
                        success: false,
                        error: 'COMPLIANCE_FAILURE_EXCEPTION_REQUIRED',
                        code: 'COMPLIANCE_FAILURE_EXCEPTION_REQUIRED',
                        message: 'Sample has failed compliance checks. Acceptance requires laboratory manager authorization.',
                        failedChecks: compliance.failedItems,
                        exceptionRequired: true
                    });
                }

                complianceExceptionRecord = exceptionRecord;
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
            let finalOriginalId = originalId == null ? '' : String(originalId).trim();
            if (finalOriginalId.startsWith('EXT-') || finalOriginalId.startsWith('S-') || !finalOriginalId) {
                const prefix = samplingDetails?.sampleType === 'PT' ? 'P' : 'W'; // Default W, unless PT
                finalOriginalId = await idGenerator.generateWalkInOriginalId(resolvedTargetProject ? idPrefix : prefix, prisma);
            }

            const sampleId = newSampleId || finalOriginalId;
            console.log(`[INTAKE] Creating new sample: ${sampleId} linked to Project: ${resolvedTargetProject?.code || 'WALK-IN'}`);

            const hasException = Boolean(body.hasException || body.exceptionRecord || body.exceptionReason);
            const exceptionRecord = body.exceptionRecord || (body.exceptionReason ? { reason: body.exceptionReason, authorizer: user.username, authorizedAt: new Date().toISOString() } : null);

            const isWalkInDeskSample = !resolvedTargetProject && isWalkIn;
            const receivingLab = user.labId && await prisma.lab.findUnique({where: {id: user.labId}});
            if (!receivingLab?.isActive) throw new IntakeError(403, {code: 'MISSING_LAB_SCOPE', message: 'Select an active receiving laboratory before creating an intake.'});
            const initialMetadata = isWalkInDeskSample
                ? { origin: sampleOriginService.ORIGIN_TYPES.DESK_WALKIN }
                : (hasException ? { exceptionRecord, origin: 'DESK_EXCEPTION' } : {});

            createData = {
                    id: sampleId,
                    originalId: finalOriginalId,
                    status: 'EXPECTED',
                    projectCode: resolvedTargetProject ? resolvedTargetProject.code : null,
                    projectId: resolvedTargetProject ? resolvedTargetProject.id : null,
                    assignedLab: user.labId,
                    metadata: JSON.stringify(initialMetadata),
                    country: receivingLab.country,
                    countryName: receivingLab.country,
                    fieldMetadata: JSON.stringify(await intakeProfile.captureConfigured({projectCode: resolvedTargetProject?.code || null, assignedLab: user.labId, country: receivingLab.country}, initialFieldMetadata, body, {actor: user.id || receivedBy, isNew: true}, prisma)),
                    history: JSON.stringify([])
            };
            sample = { ...createData, updatedAt: new Date() };
            // Update the local variable so the rest of the function uses the new ID
            body.originalId = finalOriginalId;
        }

        if (sample) {
            // SECURITY: Enforce Lab Scope
            const scopeGuard = require('../utils/scopeGuard');
            try {
                scopeGuard.ensureScope(user, sample, { altLabField: 'assignedLab' });
            } catch (e) {
                console.warn(`[INTAKE] Security Block: User ${user.username} tried to intake sample ${originalId} belonging to another lab.`);
                throw new IntakeError(403, { success: false, message: 'Access Denied: This sample belongs to another lab.' });
            }

            if (LOCKED_INTAKE_STATUSES.includes(sample.status) && !(sample.status === 'RECEIVED_REJECTED' && isResubmission === true && !isDraft)) {
                console.warn(`[INTAKE] Blocked attempt to modify locked sample ${originalId} (Status: ${sample.status}, isDraft: ${!!body.isDraft})`);
                throw new IntakeError(403, {
                    success: false,
                    error: 'SAMPLE_LOCKED',
                    message: `Sample intake is already locked in status '${sample.status}'. Changes are not permitted.`
                });
            }
        }

        const now = new Date();
        const intakeFieldMetadata = await intakeProfile.captureConfigured(sample, sample.fieldMetadata, body, {actor: user.id || receivedBy, recordedAt: now.toISOString()}, prisma);
        const preservedCompactMetadata = intakeProfile.parseFieldMetadata(sample.metadata);
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
                : (Array.isArray(body.photos) ? body.photos : []);

            // Chain of Custody extraction (Stage E: RC-19)
            const coc = body.coc || {};
            const custodyHandoverAt = body.custodyHandoverAt
                ? new Date(body.custodyHandoverAt)
                : (coc.handoverAt || coc.date ? new Date(coc.handoverAt || coc.date) : now);
            const custodyCarrierName = body.custodyCarrierName || coc.deliveredBy || coc.carrierName || null;
            const custodyTrackingNumber = body.custodyTrackingNumber || coc.trackingNumber || coc.waybillRef || null;
            const custodySenderSignature = body.custodySenderSignature || coc.senderSignature || null;
            const receivingOfficerId = user.id ? String(user.id) : null;
            const receivingOfficerName = user.name || user.username || receivedBy;
            const receivingOfficerSignature = body.receivingOfficerSignature || coc.officerSignature || `CONFIRMED:${receivedBy}:${now.toISOString()}`;

            const { transitionSample } = require('../services/sampleStateService');
            const rejectedOrder = await orderedAnalyses(prisma, sample, body, user);
            const rejectionData = {
                requiredAnalyses: JSON.stringify(Array.from(rejectedOrder.requiredAnalyses)),
                analysisGroupIds: JSON.stringify(rejectedOrder.canonicalGroupIds),
                receivedMass: receivedMass === undefined ? undefined : receivedMass === null || receivedMass === '' ? null : Number(receivedMass),
                moistureOnArrival: moistureOnArrival === undefined ? undefined : moistureOnArrival || null,
                positionalUncertaintyM: body.positionalUncertaintyM === undefined ? undefined : batchObservations.nullableNumber(body.positionalUncertaintyM, 'positionalUncertaintyM'),
                foreignMaterial: foreignMaterial === undefined ? undefined : typeof foreignMaterial === 'string' ? foreignMaterial : JSON.stringify(foreignMaterial),
                massWarningAcknowledged: false,
                rejectionReason: ncReason,
                fieldMetadata: JSON.stringify(intakeFieldMetadata),
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
                receptionData: JSON.stringify({
                    checklist,
                    notes,
                    ncReason: ncReason || null,
                    rejectionReason: ncReason || null,
                    receivedBy,
                    labLocation: labId,
                    at: now,
                    coc: body.coc,
                    photos: photosList,
                    isWalkIn: isWalkIn || false
                }),
                metadata: JSON.stringify({
                    ...preservedCompactMetadata,
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
            };
            return { sample, createData, updateData: rejectionData, nextStatus: workflow.SAMPLE_STATES.RECEIVED_REJECTED, body, user, now, responseKind: 'rejected' };
        }

        if (body.isDraft) {
            // Never regress an already received record to DRAFT
            const targetDraftStatus = sample.status === 'RECEIVED' ? 'RECEIVED' : 'DRAFT';

            history.push({
                status: targetDraftStatus,
                changedBy: receivedBy,
                timestamp: now,
                note: sample.status === 'RECEIVED' ? 'Intake draft updated (status retained as RECEIVED)' : 'Saved as Draft'
            });

            const currentFieldMeta = {...intakeFieldMetadata};
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
                : (Array.isArray(body.photos) ? body.photos : []);

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
                requiredAnalyses: body.requiredAnalyses ? JSON.stringify(body.requiredAnalyses) : undefined,
                receivedMass: parsedMass !== null && !isNaN(parsedMass) ? parsedMass : undefined,
                massWarningAcknowledged: !!massWarningAcknowledged,
                moistureOnArrival: moistureOnArrival || undefined,
                foreignMaterial: foreignMaterial ? (typeof foreignMaterial === 'string' ? foreignMaterial : JSON.stringify(foreignMaterial)) : undefined,
                intakePhotos: photosList.length > 0 ? JSON.stringify(photosList) : undefined,
                isResubmission: isResubmission !== undefined ? !!isResubmission : undefined,
                receptionData: JSON.stringify({
                    checklist, notes, receivedBy, labLocation: labId, at: now,
                    coc: body.coc, photos: photosList,
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
                    requiredAnalyses: body.requiredAnalyses || []
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

            updateData.fieldMetadata = JSON.stringify(intakeProfile.preserveForContextChange(sample, currentFieldMeta, updateData, user.id || receivedBy));
            return { sample, createData, updateData, nextStatus: targetDraftStatus, body, user, now, responseKind: 'draft' };
        }

        // Final Acceptance Processing
        if (complianceExceptionRecord) {
            history.push({
                status: 'ADMITTED_WITH_EXCEPTION',
                changedBy: receivedBy,
                timestamp: now,
                note: `Admitted under manager exception: ${complianceExceptionRecord.reason || 'Manager authorized compliance exception'} (Authorized by: ${complianceExceptionRecord.verifiedAuthorizer})`
            });
        }

        if (analysisRemovals && analysisRemovals.length > 0 && !justification) {
            throw new IntakeError(400, { success: false, message: 'Justification is mandatory when removing analyses.' });
        }

        const { requiredAnalyses, canonicalGroupIds } = await orderedAnalyses(prisma, sample, body, user);

        // RC-01: Recheck the current observation, rather than trusting an earlier arrival validation.
        const currentMass = receivedMass === undefined ? sample.receivedMass : receivedMass;
        const parsedMass = currentMass !== undefined && currentMass !== null && currentMass !== '' ? Number(currentMass) : null;

        let massDeficitInfo = null;
        if (parsedMass !== null && !isNaN(parsedMass)) {
            const requiredCodes = Array.from(requiredAnalyses);
            const analysesFromDb = await prisma.analysis.findMany({
                where: { code: { in: requiredCodes } },
                select: { code: true, name: true, sampleMassRequired: true }
            });

            massDeficitInfo = massDeficit(parsedMass, await massRequirement(sample.assignedLab || user.labId, analysesFromDb, undefined, prisma));
            if (massDeficitInfo) {
                const { totalAnalyticalMass, retentionBuffer, deficit } = massDeficitInfo;

                if (!massWarningAcknowledged && !body.isDraft) {
                    throw new IntakeError(400, {
                        success: false,
                        error: 'MASS_DEFICIT',
                        message: `Received mass (${parsedMass}g) is insufficient for the ordered tests (${totalAnalyticalMass}g) plus archive retention (${retentionBuffer}g). Deficit: ${deficit}g.`,
                        massDeficitInfo
                    });
                }
            }
        }

        const currentFieldMeta = {...intakeFieldMetadata};
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
        if (body.latitude !== undefined && body.latitude !== null && body.latitude !== '') {
            lat = parseFloat(body.latitude);
            lng = body.longitude !== undefined && body.longitude !== null ? parseFloat(body.longitude) : null;
            elev = body.elevation !== undefined && body.elevation !== null ? parseFloat(body.elevation) : null;
        } else if (samplingDetails?.coordinates) {
            lat = parseFloat(samplingDetails.coordinates.lat);
            lng = parseFloat(samplingDetails.coordinates.lng);
            elev = parseFloat(samplingDetails.coordinates.elevation);
        } else if (body.coordinates) {
            lat = parseFloat(body.coordinates.lat);
            lng = parseFloat(body.coordinates.lng);
            elev = parseFloat(body.coordinates.elevation);
        }

        // Numeric depths
        let depthTop = null, depthBottom = null;
        if (body.depthTopCm !== undefined && body.depthTopCm !== null && body.depthTopCm !== '') {
            depthTop = parseFloat(body.depthTopCm);
        } else if (samplingDetails?.depthTopCm !== undefined && samplingDetails?.depthTopCm !== null && samplingDetails?.depthTopCm !== '') {
            depthTop = parseFloat(samplingDetails.depthTopCm);
        } else if (samplingDetails?.depthMin !== undefined && samplingDetails?.depthMin !== null && samplingDetails?.depthMin !== '') {
            depthTop = parseFloat(samplingDetails.depthMin);
        } else if (samplingDetails?.depthType && /^\d+-\d+$/.test(samplingDetails.depthType)) {
            const [t, b] = samplingDetails.depthType.split('-').map(Number);
            depthTop = t;
            depthBottom = b;
        }

        if (body.depthBottomCm !== undefined && body.depthBottomCm !== null && body.depthBottomCm !== '') {
            depthBottom = parseFloat(body.depthBottomCm);
        } else if (samplingDetails?.depthBottomCm !== undefined && samplingDetails?.depthBottomCm !== null && samplingDetails?.depthBottomCm !== '') {
            depthBottom = parseFloat(samplingDetails.depthBottomCm);
        } else if (samplingDetails?.depthMax !== undefined && samplingDetails?.depthMax !== null && samplingDetails?.depthMax !== '') {
            depthBottom = parseFloat(samplingDetails.depthMax);
        }

        const rawUncertainty = body.positionalUncertaintyM !== undefined && body.positionalUncertaintyM !== null && body.positionalUncertaintyM !== ''
            ? body.positionalUncertaintyM
            : samplingDetails?.positionalUncertaintyM;
        const uncertaintyM = rawUncertainty !== undefined && rawUncertainty !== null && rawUncertainty !== ''
            ? parseFloat(rawUncertainty)
            : undefined;

        const rawCompRadius = body.compositeRadiusM !== undefined && body.compositeRadiusM !== null && body.compositeRadiusM !== ''
            ? body.compositeRadiusM
            : samplingDetails?.compositeRadiusM;
        const compRadius = rawCompRadius !== undefined && rawCompRadius !== null && rawCompRadius !== ''
            ? parseFloat(rawCompRadius)
            : undefined;

        const locationSource = body.locationSource || samplingDetails?.locationSource || samplingDetails?.captureMethod || (lat && lng ? 'DESK_PIN' : 'TEXT_ONLY');
        const admin1 = body.admin1 || samplingDetails?.district || undefined;
        const admin2 = body.admin2 || samplingDetails?.areaVillage || undefined;
        const village = body.village || samplingDetails?.areaVillage || undefined;
        const siteName = body.siteName || samplingDetails?.siteName || undefined;

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
                latitude: samplingDetails.coordinates?.lat ?? null,
                longitude: samplingDetails.coordinates?.lng ?? null,
                gpsAccuracy: samplingDetails.coordinates?.accuracy ?? null,
                locationCaptureMethod: captureMethod || null,
                locationConfidence: finalConfidence,
                locationUncertaintyReason: samplingDetails.locationUncertaintyReason || null
            };
            mergeField('locationCanonical', locationCanonical);

            // Legacy key mapping (preserves backward compat)
            Object.entries(samplingDetails).forEach(([k, v]) => {
                if (profileIdentity.IDENTITY_KEYS.has(k)) return;
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
            : (Array.isArray(body.photos) ? body.photos : []);

        const existingMetadata = typeof sample.metadata === 'string' ? JSON.parse(sample.metadata) : (sample.metadata || {});
        const updatedMetadata = {
            ...existingMetadata,
            ...(complianceExceptionRecord ? { complianceException: complianceExceptionRecord } : {})
        };

        const updateData = {
            status: workflow.SAMPLE_STATES.ACCEPTED,
            receptionDate: now,       // Finding #3: canonical column
            receivedBy: receivedBy,   // Finding #3: canonical column
            acceptedBy: receivedBy,
            acceptedAt: now,
            dryingStatus: 'PENDING',
            preparationStatus: 'PENDING',
            metadata: JSON.stringify(updatedMetadata),
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
            custodyHandoverAt: body.custodyHandoverAt
                ? new Date(body.custodyHandoverAt)
                : (body.coc?.handoverAt || body.coc?.date ? new Date(body.coc.handoverAt || body.coc.date) : now),
            custodyCarrierName: body.custodyCarrierName || body.coc?.deliveredBy || body.coc?.carrierName || null,
            custodyTrackingNumber: body.custodyTrackingNumber || body.coc?.trackingNumber || body.coc?.waybillRef || null,
            custodySenderSignature: body.custodySenderSignature || body.coc?.senderSignature || null,
            receivingOfficerId: user.id ? String(user.id) : null,
            receivingOfficerName: user.name || user.username || receivedBy,
            receivingOfficerSignature: body.receivingOfficerSignature || body.coc?.officerSignature || `CONFIRMED:${receivedBy}:${now.toISOString()}`,

            receptionData: JSON.stringify({
                checklist, notes, receivedBy, labLocation: labId, at: now,
                coc: body.coc, photos: photosList,
                analysisJustification: justification || null,
                submitterDetails: submitterDetails || null,
                samplingDetails: samplingDetails || null,
                isWalkIn: isWalkIn || false,
                receivedMass: parsedMass,
                moistureOnArrival,
                foreignMaterial,
                massDeficitInfo,
                massNotRecorded: parsedMass === null,
                massStatus: parsedMass === null ? 'MASS_NOT_RECORDED' : massDeficitInfo ? 'MASS_DEFICIT' : 'SUFFICIENT',
                complianceException: complianceExceptionRecord || null,
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
        updateData.fieldMetadata = JSON.stringify(intakeProfile.preserveForContextChange(sample, currentFieldMeta, updateData, user.id || receivedBy));
        delete updateData.status;
        if (sample.status === 'RECEIVED_REJECTED') updateData.rejectionReason = null;
        const workPlan = await workItems.prepare(prisma, { ...sample, ...updateData });
        return { sample, createData, updateData, nextStatus: workflow.SAMPLE_STATES.ACCEPTED, body, user, now, responseKind: 'accepted', workPlan, approval: complianceExceptionRecord || admissionExceptionRecord };
}

function validateObservations(body) {
    if (!body.isWalkIn && !String(body.originalId || body.sampleId || body.id || '').trim()) throw new IntakeError(422, { code: 'INTAKE_IDENTIFIER_REQUIRED', message: 'A specimen identifier is required.' });
    if (!body.isDraft) {
        require('./intakeReceiptService').validateMass(body);
        const observed = batchObservations.observations(body, []);
        if (Object.hasOwn(body, 'receivedMass')) body.receivedMass = observed.receivedMass;
        if (Object.hasOwn(body, 'moistureOnArrival')) body.moistureOnArrival = observed.moistureOnArrival;
    }
    for (const value of [body.custodyHandoverAt, body.coc?.handoverAt, body.coc?.date]) {
        if (value != null && value !== '' && !Number.isFinite(new Date(value).getTime())) throw new IntakeError(422, { code: 'INTAKE_CUSTODY_INVALID', message: 'The custody handover date must be valid.' });
    }
}

async function orderedAnalyses(prisma, sample, body, user) {
    const { analysisGroupIds, analysisAdditions, analysisRemovals } = body;
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
                throw new IntakeError(400, {
                    success: false,
                    code: 'INVALID_PACKAGE_ID',
                    message: 'analysisGroupIds must be an array of package ID strings.'
                });
            }
            for (const gid of analysisGroupIds) {
                const resolved = resolveAnalysisGroup(gid, analysisGroups);
                if (resolved.error) {
                    throw new IntakeError(400, {
                        success: false,
                        code: resolved.code,
                        message: resolved.message
                    });
                }
                canonicalGroupIds.push(resolved.canonicalId);
                resolved.group.analyses.forEach(code => requiredAnalyses.add(code));
            }
        }

        if (Array.isArray(body.requiredAnalyses)) {
            body.requiredAnalyses.forEach(code => requiredAnalyses.add(code));
        }

        if (Array.isArray(analysisAdditions)) {
            analysisAdditions.forEach(code => requiredAnalyses.add(code));
        }

        if (Array.isArray(analysisRemovals)) {
            analysisRemovals.forEach(code => requiredAnalyses.delete(code));
        }

        requiredAnalyses = new Set(workItems.normalizeAnalysisCodes(Array.from(requiredAnalyses)));
        const selected = await cataloguePolicy.validateSelection(Array.from(requiredAnalyses), { labId: sample.assignedLab || user.labId, existing: workItems.normalizeAnalysisCodes(existingAnalyses), db: prisma });
        if (!selected.valid) throw new IntakeError(400, { success: false, code: 'INTAKE_CATALOGUE_INVALID', message: selected.error, error: selected.error, issues: selected.issues });

    return { requiredAnalyses, canonicalGroupIds };
}

module.exports = { prepareIntake };
