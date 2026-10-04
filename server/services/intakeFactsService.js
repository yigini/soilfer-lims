'use strict';
const cataloguePolicy = require('./cataloguePolicy');
const workflow = require('../workflowContract');
const idGenerator = require('./idGenerator');
const sampleOriginService = require('./sampleOriginService');
const sampleStateService = require('./sampleStateService');
const projectPolicyService = require('./projectPolicyService');
const profileIdentity = require('./profileIdentityService');
const intakeProfile = require('./intakeProfileService');
const {deriveLocationConfidence,resolveAnalysisGroup}=require('./receptionRules');
const LOCKED_INTAKE_STATUSES=['ACCEPTED','LAB_ID_ASSIGNED','PROCESSING','COMPLETED','APPROVED','ARCHIVED','DISPOSED','SUBMITTED_PARTIAL','SUBMITTED_FULL','IN_PROGRESS','RECEIVED_REJECTED'];
function httpFailure(status,details) {return Object.assign(new Error(details.message||details.error||'Intake validation failed'),{status,code:details.code||details.error||'INTAKE_VALIDATION_FAILED',details});}
async function executeFacts(payload,user,db) {
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
    } = payload;

    // Trust authenticated identity over client-supplied actor (Finding #6)
    const receivedBy = user.username || clientReceivedBy || 'Unknown';
    console.log(`[INTAKE] Processing intake for ${originalId} by ${receivedBy}`);

        let sample = await db.sample.findFirst({
            where: { originalId: String(originalId) }
        });

        let isNewlyCreatedDeskSample = false;

        if (sample) {
            // Check for active provenance hold (Finding 4: Ambiguous specimen identity must remain visibly unresolved)
            let sampleMeta = {};
            try {
                sampleMeta = typeof sample.metadata === 'string' ? JSON.parse(sample.metadata) : (sample.metadata || {});
            } catch (e) {}
            if (sampleMeta.provenanceHold && sampleMeta.provenanceHold.status === 'AMBIGUOUS_PROVENANCE_HOLD') {
                throw httpFailure(409, {
                    error: 'PROVENANCE_HOLD',
                    code: 'AMBIGUOUS_PROVENANCE_HOLD',
                    message: `Cannot process intake for sample '${sample.originalId}': Ambiguous field specimen identity. Reconciliation required before physical intake. Reason: ${sampleMeta.provenanceHold.reason}`
                });
            }

            // Authoritative: Existing sample's persisted project governs admission policy
            const persistedProjectId = sample.projectId || sample.projectCode;
            if (persistedProjectId) {
                const existingResolved = await projectPolicyService.resolveProject(persistedProjectId, db);
                const existingProject = existingResolved?.project;
                if (existingProject) {
                    const admission = projectPolicyService.canAdmitSample({
                        project: existingProject,
                        channel: 'PHYSICAL_RECEIPT',
                        actor: user,
                        labId: user.labId
                    });
                    if (!admission.allowed) {
                        throw httpFailure(422, {
                            error: (admission.code === 'PROJECT_CLOSED' || admission.code === 'PROJECT_PAUSED') ? 'PROJECT_ADMISSIONS_PAUSED' : (admission.code || 'PROJECT_ADMISSIONS_BLOCKED'),
                            message: admission.reason
                        });
                    }
                }

                // Check for contradictory request projectId override
                if (projectId) {
                    const reqResolved = await projectPolicyService.resolveProject(projectId, db);
                    const reqCode = reqResolved?.code || String(projectId);
                    const reqId = reqResolved?.id || String(projectId);
                    if (reqCode !== sample.projectCode && reqId !== sample.projectId) {
                        throw httpFailure(400, {
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
                resolvedTargetProject = await projectPolicyService.resolveProject(candidateProjectId, db);
            }

            const targetProjectObj = resolvedTargetProject ? resolvedTargetProject.project : null;
            const targetSampleId = payload.id || payload.sampleId || payload.originalId || null;
            const intakeChannel = payload._channel || (isWalkIn ? 'WALK_IN' : 'DESK');
            const { hasException, exceptionRecord } = await projectPolicyService.resolveAndVerifyExceptionRecord({
                rawExceptionRecord: payload.exceptionRecord,
                rawExceptionReason: payload.exceptionReason,
                authorizer: payload.authorizer,
                approvalId: payload.approvalId || payload.approvalToken,
                actor: user,
                project: targetProjectObj,
                labId: user.labId,
                sampleId: targetSampleId,
                channel: intakeChannel,
                prismaClient: db
            });

            const admission = projectPolicyService.canAdmitSample({
                project: targetProjectObj,
                channel: intakeChannel,
                actor: user,
                labId: user.labId,
                hasException,
                exceptionRecord
            });

            if (!admission.allowed) {
                throw httpFailure(422, {
                    error: (admission.code === 'PROJECT_CLOSED' || admission.code === 'PROJECT_PAUSED') ? 'PROJECT_ADMISSIONS_PAUSED' : (admission.code || 'PROJECT_ADMISSIONS_BLOCKED'),
                    message: admission.reason,
                    exceptionRequired: Boolean(admission.exceptionRequired)
                });
            }
        }

        const isReject = decision === 'REJECTED' || decision === 'REJECT';
        const isDraft = Boolean(payload.isDraft);
        const isFinalAcceptance = !isReject && !isDraft;

        let compliance = null;
        let complianceExceptionRecord = null;

        if (isFinalAcceptance) {
            compliance = payload._evaluation;

            if (compliance.invalidNAItems.length > 0) {
                throw httpFailure(400, {
                    success: false,
                    error: 'INVALID_CHECKLIST_NA',
                    code: 'INVALID_CHECKLIST_NA',
                    message: `Not Applicable (N/A) is not permitted for criteria: ${compliance.invalidNAItems.join(', ')}.`,
                    invalidItems: compliance.invalidNAItems
                });
            }

            if (!compliance.isComplete) {
                throw httpFailure(400, {
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
                const targetProjectObj = sample ? (sample.project || (sample.projectId ? (await projectPolicyService.resolveProject(sample.projectId, db))?.project : null)) : (candidateProjectId ? (await projectPolicyService.resolveProject(candidateProjectId, db))?.project : null);

                const { hasException, exceptionRecord } = await projectPolicyService.resolveAndVerifyExceptionRecord({
                    rawExceptionRecord: payload.exceptionRecord,
                    rawExceptionReason: payload.exceptionReason || (checklist && checklist.reason),
                    authorizer: payload.authorizer,
                    approvalId: payload.approvalId || payload.approvalToken,
                    actor: user,
                    project: targetProjectObj,
                    labId: user.labId,
                    sampleId: sample ? sample.id : (originalId || null),
                    channel: sample ? 'PHYSICAL_RECEIPT' : payload._channel || (isWalkIn ? 'WALK_IN' : 'DESK'),
                    prismaClient: db
                });

                if (!hasException || !exceptionRecord?.isStoredApprovalVerified) {
                    throw httpFailure(403, {
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
            const resolvedTargetProject = candidateProjectId ? await projectPolicyService.resolveProject(candidateProjectId, db) : null;

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
                finalOriginalId = await idGenerator.generateWalkInOriginalId(resolvedTargetProject ? idPrefix : prefix, db);
            }

            const sampleId = finalOriginalId;
            if(samplingDetails?.sampleType==='PT') finalOriginalId=`PT-${payload.ptRound}-${sampleId}`;
            console.log(`[INTAKE] Creating new sample: ${sampleId} linked to Project: ${resolvedTargetProject?.code || 'WALK-IN'}`);

            const hasException = Boolean(payload.hasException || payload.exceptionRecord || payload.exceptionReason);
            const exceptionRecord = payload.exceptionRecord || (payload.exceptionReason ? { reason: payload.exceptionReason, authorizer: user.username, authorizedAt: new Date().toISOString() } : null);

            const isWalkInDeskSample = !resolvedTargetProject && isWalkIn;
            const receivingLab = user.labId && await db.lab.findUnique({where: {id: user.labId}});
            if (!receivingLab?.isActive) throw httpFailure(403, {code: 'MISSING_LAB_SCOPE', message: 'Select an active receiving laboratory before creating an intake.'});
            const initialMetadata = isWalkInDeskSample
                ? { origin: sampleOriginService.ORIGIN_TYPES.DESK_WALKIN }
                : (hasException ? { exceptionRecord, origin: 'DESK_EXCEPTION' } : {});

            sample = await db.sample.create({
                data: {
                    id: sampleId,
                    originalId: finalOriginalId,
                    status: 'EXPECTED',
                    projectCode: resolvedTargetProject ? resolvedTargetProject.code : null,
                    projectId: resolvedTargetProject ? resolvedTargetProject.id : null,
                    assignedLab: user.labId,
                    metadata: JSON.stringify(initialMetadata),
                    country: receivingLab.country,
                    countryName: receivingLab.country,
                    fieldMetadata: JSON.stringify(await intakeProfile.captureConfigured({projectCode: resolvedTargetProject?.code || null, assignedLab: user.labId, country: receivingLab.country}, {}, payload, {actor: user.id || receivedBy, isNew: true}, db)),
                    history: JSON.stringify([])
                }
            });
            // Update the local variable so the rest of the function uses the new ID
            // Target identity remains stable in the command envelope.
        }

        if (sample) {
            // SECURITY: Enforce Lab Scope
            const scopeGuard = require('../utils/scopeGuard');
            try {
                scopeGuard.ensureScope(user, sample, { altLabField: 'assignedLab' });
            } catch (e) {
                console.warn(`[INTAKE] Security Block: User ${user.username} tried to intake sample ${originalId} belonging to another lab.`);
                throw httpFailure(403, { success: false, message: 'Access Denied: This sample belongs to another lab.' });
            }

            if (LOCKED_INTAKE_STATUSES.includes(sample.status)) {
                console.warn(`[INTAKE] Blocked attempt to modify locked sample ${originalId} (Status: ${sample.status}, isDraft: ${!!payload.isDraft})`);
                throw httpFailure(403, {
                    success: false,
                    error: 'SAMPLE_LOCKED',
                    message: `Sample intake is already locked in status '${sample.status}'. Changes are not permitted.`
                });
            }
        }

        const now = new Date();
        const physicalReceipt = sample.status === 'RECEIVED' && sample.receptionDate ? Object.fromEntries(['receptionDate','receivedBy','custodyHandoverAt','custodyCarrierName','custodyTrackingNumber','custodySenderSignature','receivingOfficerId','receivingOfficerName','receivingOfficerSignature'].filter(key => sample[key] !== null && sample[key] !== undefined).map(key => [key,sample[key]])) : {};
        const intakeFieldMetadata = await intakeProfile.captureConfigured(sample, sample.fieldMetadata, payload, {actor: user.id || receivedBy, recordedAt: now.toISOString()}, db);
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
                : (Array.isArray(payload.photos) ? payload.photos : []);

            // Chain of Custody extraction (Stage E: RC-19)
            const coc = payload.coc || {};
            const custodyHandoverAt = payload.custodyHandoverAt
                ? new Date(payload.custodyHandoverAt)
                : (coc.handoverAt || coc.date ? new Date(coc.handoverAt || coc.date) : now);
            const custodyCarrierName = payload.custodyCarrierName || coc.deliveredBy || coc.carrierName || null;
            const custodyTrackingNumber = payload.custodyTrackingNumber || coc.trackingNumber || coc.waybillRef || null;
            const custodySenderSignature = payload.custodySenderSignature || coc.senderSignature || null;
            const receivingOfficerId = user.id ? String(user.id) : null;
            const receivingOfficerName = user.name || user.username || receivedBy;
            const receivingOfficerSignature = payload.receivingOfficerSignature || coc.officerSignature || `CONFIRMED:${receivedBy}:${now.toISOString()}`;

            const { transitionSample } = require('../services/sampleStateService');
            const rejectionData = {
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
                    coc: payload.coc,
                    photos: photosList,
                    isWalkIn: sampleOriginService.detectSampleOrigin(sample) === sampleOriginService.ORIGIN_TYPES.DESK_WALKIN
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
            const updated = await (async tx => {
                const current = await tx.sample.findUnique({where: {id: sample.id}});
                if (!current || current.updatedAt.getTime() !== sample.updatedAt.getTime()) throw new profileIdentity.ProfileReferenceConflictError('SOURCE_CHANGED');
                require('../utils/scopeGuard').ensureScope(user, current, {altLabField: 'assignedLab'});
                return transitionSample(sample.id, workflow.SAMPLE_STATES.RECEIVED_REJECTED, user, `Sample rejected during intake: ${ncReason}`, {...rejectionData,...physicalReceipt}, tx);
            })(db);

            await db.auditLog.create({
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

            return ({
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

        if (payload.isDraft) {
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
                : (Array.isArray(payload.photos) ? payload.photos : []);

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
                requiredAnalyses: payload.requiredAnalyses ? JSON.stringify(payload.requiredAnalyses) : undefined,
                receivedMass: parsedMass !== null && !isNaN(parsedMass) ? parsedMass : undefined,
                massWarningAcknowledged: !!massWarningAcknowledged,
                moistureOnArrival: moistureOnArrival || undefined,
                foreignMaterial: foreignMaterial ? (typeof foreignMaterial === 'string' ? foreignMaterial : JSON.stringify(foreignMaterial)) : undefined,
                intakePhotos: photosList.length > 0 ? JSON.stringify(photosList) : undefined,
                isResubmission: isResubmission !== undefined ? !!isResubmission : undefined,
                receptionData: JSON.stringify({
                    checklist, notes, receivedBy, labLocation: labId, at: now,
                    coc: payload.coc, photos: photosList,
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
                    requiredAnalyses: payload.requiredAnalyses || []
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
                const projExists = await db.project.findFirst({ where: { id: projectId } });
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
            updateData.fieldMetadata = JSON.stringify(intakeProfile.preserveForContextChange(sample, currentFieldMeta, updateData, user.id || receivedBy));
            const updateRes = await db.sample.updateMany({
                where: {
                    id: sample.id,
                    updatedAt: sample.updatedAt,
                    status: { notIn: LOCKED_INTAKE_STATUSES }
                },
                data: updateData
            });

            if (updateRes.count === 0) {
                console.warn(`[INTAKE] Atomic conflict: sample ${sample.id} was concurrently modified or locked.`);
                throw httpFailure(409, {
                    success: false,
                    error: 'CONCURRENT_MODIFICATION',
                    message: 'Sample state was updated concurrently or locked by another user. Intake changes rejected.'
                });
            }

            return ({ success: true, id: sample.id, originalId: sample.originalId, status: targetDraftStatus, message: 'Draft saved.' });
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
            throw httpFailure(400, { success: false, message: 'Justification is mandatory when removing analyses.' });
        }

        // Finding #7: Start from existing analyses to avoid overwriting on partial payloads
        const existingAnalyses = sample.requiredAnalyses
            ? (typeof sample.requiredAnalyses === 'string' ? JSON.parse(sample.requiredAnalyses) : sample.requiredAnalyses)
            : [];
        let requiredAnalyses = new Set(existingAnalyses);

        // Load analysis groups from database
        const analysisGroupsRaw = await db.analysisGroup.findMany({ where: { OR: [{ labId: sample.assignedLab || user.labId }, { labId: null }] } });
        const analysisGroups = analysisGroupsRaw.map(g => ({
            id: g.id,
            name: g.name,
            analyses: g.analyses ? JSON.parse(g.analyses) : []
        }));

        const canonicalGroupIds = [];
        if (analysisGroupIds !== undefined && analysisGroupIds !== null) {
            if (!Array.isArray(analysisGroupIds)) {
                throw httpFailure(400, {
                    success: false,
                    code: 'INVALID_PACKAGE_ID',
                    message: 'analysisGroupIds must be an array of package ID strings.'
                });
            }
            for (const gid of analysisGroupIds) {
                const resolved = resolveAnalysisGroup(gid, analysisGroups);
                if (resolved.error) {
                    throw httpFailure(400, {
                        success: false,
                        code: resolved.code,
                        message: resolved.message
                    });
                }
                canonicalGroupIds.push(resolved.canonicalId);
                resolved.group.analyses.forEach(code => requiredAnalyses.add(code));
            }
        }

        if (Array.isArray(payload.requiredAnalyses)) {
            payload.requiredAnalyses.forEach(code => requiredAnalyses.add(code));
        }

        if (Array.isArray(analysisAdditions)) {
            analysisAdditions.forEach(code => requiredAnalyses.add(code));
        }

        if (Array.isArray(analysisRemovals)) {
            analysisRemovals.forEach(code => requiredAnalyses.delete(code));
        }

        const selected = await cataloguePolicy.validateSelection(Array.from(requiredAnalyses), { labId: sample.assignedLab || user.labId, existing: existingAnalyses, db });
        if (!selected.valid) throw httpFailure(400, { success: false, message: selected.error, error: selected.error, issues: selected.issues });

        // RC-01: Analytical Mass Sufficiency Check
        const parsedMass = (receivedMass !== undefined && receivedMass !== null && receivedMass !== '')
            ? parseFloat(receivedMass)
            : null;

        let massDeficitInfo = null;
        if (parsedMass !== null && !isNaN(parsedMass)) {
            const requiredCodes = Array.from(requiredAnalyses);
            const analysesFromDb = await db.analysis.findMany({
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

                if (!massWarningAcknowledged && !payload.isDraft) {
                    throw httpFailure(400, {
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
        if (payload.latitude !== undefined && payload.latitude !== null && payload.latitude !== '') {
            lat = parseFloat(payload.latitude);
            lng = payload.longitude !== undefined && payload.longitude !== null ? parseFloat(payload.longitude) : null;
            elev = payload.elevation !== undefined && payload.elevation !== null ? parseFloat(payload.elevation) : null;
        } else if (samplingDetails?.coordinates) {
            lat = parseFloat(samplingDetails.coordinates.lat);
            lng = parseFloat(samplingDetails.coordinates.lng);
            elev = parseFloat(samplingDetails.coordinates.elevation);
        } else if (payload.coordinates) {
            lat = parseFloat(payload.coordinates.lat);
            lng = parseFloat(payload.coordinates.lng);
            elev = parseFloat(payload.coordinates.elevation);
        }

        // Numeric depths
        let depthTop = null, depthBottom = null;
        if (payload.depthTopCm !== undefined && payload.depthTopCm !== null && payload.depthTopCm !== '') {
            depthTop = parseFloat(payload.depthTopCm);
        } else if (samplingDetails?.depthTopCm !== undefined && samplingDetails?.depthTopCm !== null && samplingDetails?.depthTopCm !== '') {
            depthTop = parseFloat(samplingDetails.depthTopCm);
        } else if (samplingDetails?.depthMin !== undefined && samplingDetails?.depthMin !== null && samplingDetails?.depthMin !== '') {
            depthTop = parseFloat(samplingDetails.depthMin);
        } else if (samplingDetails?.depthType && /^\d+-\d+$/.test(samplingDetails.depthType)) {
            const [t, b] = samplingDetails.depthType.split('-').map(Number);
            depthTop = t;
            depthBottom = b;
        }

        if (payload.depthBottomCm !== undefined && payload.depthBottomCm !== null && payload.depthBottomCm !== '') {
            depthBottom = parseFloat(payload.depthBottomCm);
        } else if (samplingDetails?.depthBottomCm !== undefined && samplingDetails?.depthBottomCm !== null && samplingDetails?.depthBottomCm !== '') {
            depthBottom = parseFloat(samplingDetails.depthBottomCm);
        } else if (samplingDetails?.depthMax !== undefined && samplingDetails?.depthMax !== null && samplingDetails?.depthMax !== '') {
            depthBottom = parseFloat(samplingDetails.depthMax);
        }

        const rawUncertainty = payload.positionalUncertaintyM !== undefined && payload.positionalUncertaintyM !== null && payload.positionalUncertaintyM !== ''
            ? payload.positionalUncertaintyM
            : samplingDetails?.positionalUncertaintyM;
        const uncertaintyM = rawUncertainty !== undefined && rawUncertainty !== null && rawUncertainty !== ''
            ? parseFloat(rawUncertainty)
            : undefined;

        const rawCompRadius = payload.compositeRadiusM !== undefined && payload.compositeRadiusM !== null && payload.compositeRadiusM !== ''
            ? payload.compositeRadiusM
            : samplingDetails?.compositeRadiusM;
        const compRadius = rawCompRadius !== undefined && rawCompRadius !== null && rawCompRadius !== ''
            ? parseFloat(rawCompRadius)
            : undefined;

        const hasObservedLocation = ['siteName','location','district','areaVillage','landmark'].some(key => samplingDetails?.[key] !== undefined && samplingDetails[key] !== null && samplingDetails[key] !== '') ||
            ['lat','lng'].some(key => samplingDetails?.coordinates?.[key] !== undefined && samplingDetails.coordinates[key] !== null && samplingDetails.coordinates[key] !== '');
        const locationSource = payload.locationSource || (hasObservedLocation && (samplingDetails?.locationSource || samplingDetails?.captureMethod)) || sample.locationSource || (lat !== null && lng !== null ? 'DESK_PIN' : 'TEXT_ONLY');
        const admin1 = payload.admin1 || samplingDetails?.district || undefined;
        const admin2 = payload.admin2 || samplingDetails?.areaVillage || undefined;
        const village = payload.village || samplingDetails?.areaVillage || undefined;
        const siteName = payload.siteName || samplingDetails?.siteName || undefined;

        if (samplingDetails && hasObservedLocation) {
            // RC-07 & RC-20: Derive confidence from evidence and resist unevidenced HIGH
            const captureMethod = samplingDetails.captureMethod || locationSource;
            const maxConfidence = deriveLocationConfidence(captureMethod, uncertaintyM);
            let finalConfidence = samplingDetails.locationConfidence || maxConfidence;
            if (finalConfidence === 'HIGH' && maxConfidence !== 'HIGH') {
                console.warn(`[INTAKE] Resisting unevidenced HIGH confidence for method ${captureMethod} (downgraded to ${maxConfidence})`);
                finalConfidence = maxConfidence;
            }

            // Build canonical location object for structured access
            const previousLocation = currentFieldMeta.locationCanonical?.value || {};
            const observedLocation = {
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
            const locationCanonical = {...previousLocation, ...Object.fromEntries(Object.entries(observedLocation).filter(([,value]) => value !== null && value !== undefined && value !== ''))};
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

        // NEW: Assign Lab ID immediately during intake
        let assignedLabId;
        const finalLabRef = user.labId || 'GEN';

        if (sample.labId) {
            assignedLabId = sample.labId;
        } else if (sampleOriginService.detectSampleOrigin(sample) === sampleOriginService.ORIGIN_TYPES.DESK_WALKIN) {
            // Generic Walk-ins keep their generated short ID as Lab ID
            assignedLabId = payload.sampleType === 'PT' ? sample.id : sample.originalId;
        } else {
            // Project samples (Scheduled or Manual Type B) get a short sequential Lab ID
            assignedLabId = await idGenerator.generateLabId(finalLabRef, 'S', db);
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
            : (Array.isArray(payload.photos) ? payload.photos : []);

        const existingMetadata = typeof sample.metadata === 'string' ? JSON.parse(sample.metadata) : (sample.metadata || {});
        const updatedMetadata = {
            ...existingMetadata,
            ...(complianceExceptionRecord ? { complianceException: complianceExceptionRecord } : {})
        };

        const updateData = {
            status: assignedLabId ? workflow.SAMPLE_STATES.ACCEPTED : workflow.SAMPLE_STATES.RECEIVED,
            labId: assignedLabId,
            receptionDate: now,       // Finding #3: canonical column
            receivedBy: receivedBy,   // Finding #3: canonical column
            acceptedBy: assignedLabId ? receivedBy : null,
            acceptedAt: assignedLabId ? now : null,
            dryingStatus: assignedLabId ? 'PENDING' : null,
            preparationStatus: assignedLabId ? 'PENDING' : null,
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
            locationCapturedAt: hasObservedLocation && (lat !== null && lng !== null) ? now : undefined,
            locationCapturedBy: hasObservedLocation && (lat !== null && lng !== null) ? receivedBy : undefined,
            compositeRadiusM: !isNaN(compRadius) && compRadius !== undefined ? compRadius : undefined,
            depthTopCm: !isNaN(depthTop) && depthTop !== null ? depthTop : undefined,
            depthBottomCm: !isNaN(depthBottom) && depthBottom !== null ? depthBottom : undefined,
            admin1,
            admin2,
            village,
            siteName,

            // Stage E: Chain of Custody & Handover (RC-19)
            custodyHandoverAt: payload.custodyHandoverAt
                ? new Date(payload.custodyHandoverAt)
                : (payload.coc?.handoverAt || payload.coc?.date ? new Date(payload.coc.handoverAt || payload.coc.date) : now),
            custodyCarrierName: payload.custodyCarrierName || payload.coc?.deliveredBy || payload.coc?.carrierName || null,
            custodyTrackingNumber: payload.custodyTrackingNumber || payload.coc?.trackingNumber || payload.coc?.waybillRef || null,
            custodySenderSignature: payload.custodySenderSignature || payload.coc?.senderSignature || null,
            receivingOfficerId: user.id ? String(user.id) : null,
            receivingOfficerName: user.name || user.username || receivedBy,
            receivingOfficerSignature: payload.receivingOfficerSignature || payload.coc?.officerSignature || `CONFIRMED:${receivedBy}:${now.toISOString()}`,

            receptionData: JSON.stringify({
                checklist, notes, receivedBy, labLocation: labId, at: now,
                coc: payload.coc, photos: photosList,
                analysisJustification: justification || null,
                submitterDetails: submitterDetails || null,
                samplingDetails: samplingDetails || null,
                isWalkIn: isWalkIn || false,
                receivedMass: parsedMass,
                moistureOnArrival,
                foreignMaterial,
                massDeficitInfo,
                complianceException: complianceExceptionRecord || null,
                positionalUncertaintyM: uncertaintyM,
                locationSource: samplingDetails?.locationSource || samplingDetails?.captureMethod,
                compositeRadiusM: compRadius,
                depthTopCm: depthTop,
                depthBottomCm: depthBottom
            })
        };

        Object.assign(updateData,physicalReceipt);
        // Preserve project origin: client mode flag must not convert an existing project sample into a walk-in or clear its project
        const existingProjectId = sample.projectId || sample.projectCode;
        if (existingProjectId) {
            updateData.projectId = sample.projectId || undefined;
            updateData.projectCode = sample.projectCode || undefined;
        } else if (isWalkIn) {
            updateData.projectCode = null;
            updateData.projectId = null;
        } else if (projectId) {
            const projExists = await db.project.findFirst({ where: { id: projectId } });
            if (projExists) {
                updateData.projectId = projectId;
                updateData.projectCode = projExists.code || projectId;
            } else {
                console.warn(`[INTAKE] Intake: projectId '${projectId}' not found in Project table, skipping FK.`);
            }
        }

        console.log(`[INTAKE] Updating sample ${sample.id} with status RECEIVED`);
        updateData.fieldMetadata = JSON.stringify(intakeProfile.preserveForContextChange(sample, currentFieldMeta, updateData, user.id || receivedBy));
        const { transitionSample } = require('../services/sampleStateService');
        const nextStatus = updateData.status || (updateData.labId ? 'ACCEPTED' : 'RECEIVED');
        delete updateData.status;
        const updated = await (async tx => {
            const current = await tx.sample.findUnique({where: {id: sample.id}});
            if (!current || current.updatedAt.getTime() !== sample.updatedAt.getTime()) throw new profileIdentity.ProfileReferenceConflictError('SOURCE_CHANGED');
            require('../utils/scopeGuard').ensureScope(user, current, {altLabField: 'assignedLab'});
            if (current.approvedAt || ['APPROVED', 'RELEASED', 'ARCHIVED', 'DISPOSED'].includes(current.status)) throw new profileIdentity.ProfileReferenceConflictError('RELEASED_REFERENCE');
            return transitionSample(sample.id, nextStatus, user, 'Intake completed at reception', updateData, tx);
        })(db);

        // Generation is part of the same atomic intake, including order revisions.
        await require('./workGenerationService').generateWorkItemsForSample(updated, db, {strict:true});

        await db.auditLog.create({
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

        // Mark stored exception approval as CONSUMED to enforce single-use consumption semantics
        const effectiveApprovalId = (payload.exceptionRecord && (payload.exceptionRecord.approvalId || payload.exceptionRecord.amendmentId)) || payload.approvalId || payload.approvalToken;
        if (effectiveApprovalId) {
            {
                await db.sampleAmendment.update({
                    where: { id: String(effectiveApprovalId) },
                    data: { resolution: 'CONSUMED' }
                });
            }
        }

        const resolvedCollectionDate = (function() {
            try {
                const fm = updated.fieldMetadata ? (typeof updated.fieldMetadata === 'string' ? JSON.parse(updated.fieldMetadata) : updated.fieldMetadata) : null;
                return fm?.collectionDate || fm?.samplingDate || fm?.collection_date || fm?.date || null;
            } catch {
                return null;
            }
        })();

        console.log(`[INTAKE] Successfully processed ${sample.id}`);
        return ({
            success: true,
            id: updated.id,
            originalId: updated.originalId,
            labId: updated.labId,
            status: updated.status,
            receptionDate: updated.receptionDate ? (updated.receptionDate instanceof Date ? updated.receptionDate.toISOString() : updated.receptionDate) : null,
            custodyHandoverAt: updated.custodyHandoverAt ? (updated.custodyHandoverAt instanceof Date ? updated.custodyHandoverAt.toISOString() : updated.custodyHandoverAt) : null,
            collectionDate: resolvedCollectionDate,
            assignedLab: updated.assignedLab || user.labId || null,
            projectCode: updated.projectCode || null,
            projectId: updated.projectId || null,
            fieldMetadata: updated.fieldMetadata || null,
            receptionData: updated.receptionData || null,
            message: 'Intake recorded.'
        });

}
module.exports={executeFacts,LOCKED_INTAKE_STATUSES};
