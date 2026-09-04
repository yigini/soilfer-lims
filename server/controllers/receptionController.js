const prisma = require('../prisma');
const workflow = require('../workflowContract');
const idGenerator = require('../services/idGenerator');
const { parseCoordinates } = require('../utils/coordParser');
const adminBoundaries = require('../data/adminBoundaries.json');

// In-memory cache for reverse geocoding (24hr TTL)
const geocodeCache = new Map();

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

        if (!sample) {
            let finalProjectId = null;
            let idPrefix = 'W';

            if (projectId) {
                finalProjectId = projectId;
                // Use first letter of project ID/code
                idPrefix = String(projectId).charAt(0).toUpperCase();
            } else if (isWalkIn) {
                finalProjectId = null;
                // Use submitter initials as prefix if available
                if (submitterDetails && submitterDetails.name) {
                    const initials = submitterDetails.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 3);
                    if (initials) idPrefix = initials;
                }
            } else if (user.projects && user.projects.length > 0) {
                const userProjects = typeof user.projects === 'string' ? JSON.parse(user.projects) : user.projects;
                finalProjectId = userProjects[0];
                idPrefix = String(finalProjectId).charAt(0).toUpperCase();
            }

            // Generate a professional Original ID if the current one is temporary
            let finalOriginalId = String(originalId);
            if (finalOriginalId.startsWith('EXT-') || finalOriginalId.startsWith('S-') || !finalOriginalId) {
                const prefix = samplingDetails?.sampleType === 'PT' ? 'P' : 'W'; // Default W, unless PT
                finalOriginalId = await idGenerator.generateWalkInOriginalId(projectId ? idPrefix : prefix);
            }

            // For Manual Entry (Walk-in or New Project Sample), we use the short ID as the primary DB ID too
            const sampleId = finalOriginalId;
            console.log(`[INTAKE] Creating new sample: ${sampleId} linked to Project: ${finalProjectId}`);

            // Validate projectId FK before create
            if (finalProjectId) {
                const projExists = await prisma.project.findFirst({ where: { id: finalProjectId } });
                if (!projExists) {
                    console.warn(`[INTAKE] projectId '${finalProjectId}' not found in Project table, clearing FK.`);
                    finalProjectId = null;
                }
            }

            sample = await prisma.sample.create({
                data: {
                    id: sampleId,
                    originalId: finalOriginalId,
                    status: 'EXPECTED',
                    projectCode: finalProjectId || null,
                    projectId: finalProjectId || null,
                    assignedLab: user.labId,
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

            const lockedStatuses = ['ACCEPTED', 'LAB_ID_ASSIGNED', 'PROCESSING', 'COMPLETED', 'APPROVED', 'ARCHIVED', 'DISPOSED', 'SUBMITTED_PARTIAL', 'SUBMITTED_FULL', 'IN_PROGRESS'];
            if (lockedStatuses.includes(sample.status) && !req.body.isDraft) {
                console.warn(`[INTAKE] Blocked attempt to re-intake locked sample ${originalId} (Status: ${sample.status})`);
                return res.status(403).json({ success: false, message: `Sample intake is already approved and locked (Status: ${sample.status}). Changes are not permitted.` });
            }
        }

        const now = new Date();
        const history = typeof sample.history === 'string' ? JSON.parse(sample.history) : (sample.history || []);

        if (decision === 'REJECTED') {
            history.push({
                status: 'REJECTED',
                changedBy: receivedBy,
                timestamp: now,
                reason: ncReason
            });

            const photosList = Array.isArray(intakePhotos)
                ? intakePhotos
                : (Array.isArray(req.body.photos) ? req.body.photos : []);

            const { transitionSample } = require('../services/sampleStateService');
            const updated = await transitionSample(sample.id, 'EXPECTED', user, `Sample rejected during intake: ${ncReason}`, {
                rejectionReason: ncReason,
                intakePhotos: photosList.length > 0 ? JSON.stringify(photosList) : null,
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

            return res.json({
                success: true,
                message: 'Sample rejected and reverted to EXPECTED with non-conformance recorded.',
                sample: updated
            });
        }

        if (req.body.isDraft) {
            history.push({
                status: 'DRAFT',
                changedBy: receivedBy,
                timestamp: now,
                note: 'Saved as Draft'
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

            const updateData = {
                status: 'DRAFT',
                history: JSON.stringify(history),
                fieldMetadata: JSON.stringify(currentFieldMeta),
                analysisGroupIds: JSON.stringify(analysisGroupIds || []),
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
                    isWalkIn: isWalkIn || false,
                    receivedMass: parsedMass,
                    moistureOnArrival,
                    foreignMaterial
                })
            };

            // Validate FK before write
            if (projectId && !isWalkIn) {
                const projExists = await prisma.project.findFirst({ where: { id: projectId } });
                if (projExists) {
                    updateData.projectId = projectId;
                } else {
                    console.warn(`[INTAKE] Draft: projectId '${projectId}' not found in Project table, skipping FK.`);
                }
            }
            if (isWalkIn) {
                updateData.projectCode = null;
                updateData.projectId = null;
            }
            // Ensure assignedLab is set so discard permission check works
            if (!sample.assignedLab) {
                updateData.assignedLab = user.labId;
            }

            const updated = await prisma.sample.update({
                where: { id: sample.id },
                data: updateData
            });

            return res.json({ success: true, id: updated.id, message: 'Draft saved.' });
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
        const analysisGroupsRaw = await prisma.analysisGroup.findMany();
        const analysisGroups = analysisGroupsRaw.map(g => ({
            id: g.id,
            name: g.name,
            analyses: g.analyses ? JSON.parse(g.analyses) : []
        }));

        if (Array.isArray(analysisGroupIds)) {
            analysisGroupIds.forEach(gid => {
                const group = analysisGroups.find(g => g.id === gid);
                if (group) {
                    group.analyses.forEach(code => requiredAnalyses.add(code));
                }
            });
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
        if (samplingDetails) {
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
                locationCaptureMethod: samplingDetails.captureMethod || null,
                locationConfidence: samplingDetails.locationConfidence || null,
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
            mergeField('locationCaptureMethod', samplingDetails.captureMethod);
            mergeField('locationConfidence', samplingDetails.locationConfidence);
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
            analysisGroupIds: JSON.stringify(analysisGroupIds || []),
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

        // Validate FK before write
        if (projectId && !isWalkIn) {
            const projExists = await prisma.project.findFirst({ where: { id: projectId } });
            if (projExists) {
                updateData.projectId = projectId;
            } else {
                console.warn(`[INTAKE] Intake: projectId '${projectId}' not found in Project table, skipping FK.`);
            }
        }
        if (isWalkIn) {
            updateData.projectCode = null;
            updateData.projectId = null;
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

        // Only DRAFT and RECEIVED can be discarded
        if (!['DRAFT', 'RECEIVED', 'COLLECTED'].includes(sample.status)) {
            return res.status(403).json({ error: `Cannot discard sample in status '${sample.status}'. Only DRAFT/RECEIVED samples can be discarded.` });
        }

        // Lab scope check
        if (sample.assignedLab && sample.assignedLab !== user.labId) {
            return res.status(403).json({ error: 'You can only discard samples from your own lab.' });
        }

        // Determine if this is a pre-registered project sample
        let isPreRegistered = false;
        if (sample.projectId || sample.projectCode) {
            const project = await prisma.project.findFirst({
                where: sample.projectId
                    ? { id: sample.projectId }
                    : { code: sample.projectCode }
            });
            if (project && (project.projectType === 'KOBO_LINKED' || project.projectType === 'TEMPLATE_PREDEFINED_IDS')) {
                isPreRegistered = true;
            }
        }

        if (isPreRegistered) {
            // REVERT to EXPECTED — transactional (Finding #8)
            await prisma.workItem.deleteMany({ where: { sampleId: String(sample.id) } });
            await prisma.result.deleteMany({ where: { sampleId: String(sample.id) } });

            const { transitionSample } = require('../services/sampleStateService');
            await transitionSample(sample.id, 'EXPECTED', user, 'Draft/intake discarded by reception. Sample reverted to EXPECTED.', {
                labId: null,
                receptionData: null,
                receptionDate: null,
                receivedBy: null,
                requiredAnalyses: null,
                analysisGroupIds: null,
                assignedLab: sample.assignedLab,
                history: JSON.stringify([{
                    status: 'EXPECTED',
                    action: 'REVERT_TO_EXPECTED',
                    changedBy: user.username,
                    timestamp: new Date(),
                    note: 'Draft/intake discarded by reception. Sample reverted to EXPECTED.'
                }])
            });

            await prisma.auditLog.create({
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
            console.log(`[DISCARD] Reverted project sample ${sample.id} to EXPECTED`);
            return res.json({ success: true, message: `Sample ${sample.originalId} reverted to EXPECTED.` });
        } else {
            // HARD DELETE walk-in — transactional (Finding #8)
            // Archive audit evidence before deleting sample
            await prisma.$transaction([
                prisma.workItem.deleteMany({ where: { sampleId: String(sample.id) } }),
                prisma.result.deleteMany({ where: { sampleId: String(sample.id) } }),
                prisma.submission.deleteMany({ where: { sampleId: String(sample.id) } }),
                prisma.spectralData.deleteMany({ where: { sampleId: String(sample.id) } }),
                // Log the discard BEFORE deleting the sample (audit trail preserved)
                prisma.auditLog.create({
                    data: {
                        id: `audit-discard-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                        entity: 'SAMPLE',
                        entityId: String(sample.id),
                        action: 'SAMPLE_DELETED',
                        details: `Walk-in sample ${sample.originalId} hard deleted by reception.`,
                        performedBy: user.username,
                        timestamp: new Date()
                    }
                }),
                prisma.sample.delete({ where: { id: String(sample.id) } })
            ]);
            console.log(`[DISCARD] Hard deleted walk-in sample ${sample.id}`);
            return res.json({ success: true, message: `Sample ${sample.originalId} deleted.` });
        }
    } catch (error) {
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

