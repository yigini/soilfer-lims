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
        receivedBy,
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
    console.log(`[INTAKE] Processing intake for ${originalId} by ${user?.username}`);

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

            sample = await prisma.sample.create({
                data: {
                    id: sampleId,
                    originalId: finalOriginalId,
                    status: 'COLLECTED',
                    projectCode: finalProjectId || null,
                    projectId: finalProjectId,
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

            const lockedStatuses = ['ACCEPTED', 'LAB_ID_ASSIGNED', 'PROCESSING', 'COMPLETED', 'APPROVED', 'ARCHIVED', 'DISPOSED'];
            if (lockedStatuses.includes(sample.status) && !req.body.isDraft) {
                console.warn(`[INTAKE] Blocked attempt to re-intake locked sample ${originalId} (Status: ${sample.status})`);
                return res.status(403).json({ success: false, message: `Sample intake is already approved and locked (Status: ${sample.status}). Changes are not permitted.` });
            }
        }

        const now = new Date();
        const history = typeof sample.history === 'string' ? JSON.parse(sample.history) : (sample.history || []);

        if (decision === 'REJECTED') {
            history.push({
                status: 'NON_CONFORMING',
                changedBy: receivedBy,
                timestamp: now,
                reason: ncReason
            });
            await prisma.sample.update({
                where: { id: sample.id },
                data: {
                    status: 'NON_CONFORMING',
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
                }
            });

            await prisma.auditLog.create({
                data: {
                    id: `audit-rej-${Date.now()}`,
                    entity: 'SAMPLE',
                    entityId: sample.id,
                    action: 'NON_CONFORMANCE',
                    details: `Sample rejected: ${ncReason}`,
                    performedBy: user.username,
                    timestamp: now,
                    sampleId: sample.id
                }
            });

            return res.json({ success: false, message: 'Sample marked as Non-Conforming.' });
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

            if (projectId && !isWalkIn) updateData.projectId = projectId;
            if (isWalkIn) updateData.projectCode = null;

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

        let requiredAnalyses = new Set();

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
            Object.entries(samplingDetails).forEach(([k, v]) => {
                if (k === 'coordinates' && v) {
                    mergeField('latitude', v.lat);
                    mergeField('longitude', v.lng);
                    mergeField('gpsAccuracy', v.accuracy);
                } else {
                    mergeField(k, v);
                }
            });
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

        if (projectId && !isWalkIn) updateData.projectId = projectId;
        if (isWalkIn) updateData.projectCode = null;

        console.log(`[INTAKE] Updating sample ${sample.id} with status RECEIVED`);
        const updated = await prisma.sample.update({
            where: { id: String(sample.id) },
            data: updateData
        });

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
