const prisma = require('../prisma');
const workflow = require('../workflowContract');
const idGenerator = require('../services/idGenerator');

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
        projectId
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
                    status: 'COLLECTED',
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

            const { transitionSample } = require('../services/sampleStateService');
            const updated = await transitionSample(sample.id, 'EXPECTED', user, `Sample rejected during intake: ${ncReason}`, {
                rejectionReason: ncReason,
                metadata: JSON.stringify({
                    nonConformance: {
                        reason: ncReason,
                        checklist,
                        notes,
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

            const updateData = {
                status: 'DRAFT',
                history: JSON.stringify(history),
                fieldMetadata: JSON.stringify(currentFieldMeta),
                analysisGroupIds: JSON.stringify(analysisGroupIds || []),
                receptionData: JSON.stringify({
                    checklist, notes, receivedBy, labLocation: labId, at: now,
                    coc: req.body.coc, photos: req.body.photos,
                    analysisJustification: justification || null,
                    submitterDetails: submitterDetails || null,
                    samplingDetails: samplingDetails || null,
                    isWalkIn: isWalkIn || false
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

        const updateData = {
            status: workflow.SAMPLE_STATES.RECEIVED,
            labId: assignedLabId,
            receptionDate: now,       // Finding #3: canonical column
            receivedBy: receivedBy,   // Finding #3: canonical column
            requiredAnalyses: JSON.stringify(Array.from(requiredAnalyses)),
            analysisGroupIds: JSON.stringify(analysisGroupIds || []),
            fieldMetadata: JSON.stringify(currentFieldMeta),
            history: JSON.stringify(history),
            assignedLab: user.labId,
            receptionData: JSON.stringify({
                checklist, notes, receivedBy, labLocation: labId, at: now,
                coc: req.body.coc, photos: req.body.photos,
                analysisJustification: justification || null,
                submitterDetails: submitterDetails || null,
                samplingDetails: samplingDetails || null,
                isWalkIn: isWalkIn || false
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
        const nextStatus = updateData.status || 'RECEIVED';
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
                })
            ]);
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
