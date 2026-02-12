const prisma = require('../prisma');

exports.getProjects = async (req, res) => {
    const user = req.user;
    const includeDeleted = req.query.includeDeleted === 'true';

    try {
        let projects = [];

        if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
            // Admins see all projects
            const where = includeDeleted ? {} : { status: { not: 'DELETED' } };
            projects = await prisma.project.findMany({ where });
        } else if (user.role === 'PROJECT_MANAGER') {
            if (user.projects && user.projects.length > 0) {
                const where = { code: { in: user.projects } };
                if (!includeDeleted) where.status = { not: 'DELETED' };
                projects = await prisma.project.findMany({ where });
            }
        } else if (user.role === 'LAB_MANAGER' || user.role === 'SAMPLE_RECEPTION' || user.role === 'LAB_TECHNICIAN') {
            const userLabId = user.labId;
            if (!userLabId) return res.json([]);

            // Get projects assigned to this lab via ProjectLab junction table
            let labProjects;
            if (includeDeleted) {
                labProjects = await prisma.$queryRaw`
                    SELECT DISTINCT p.* FROM Project p
                    LEFT JOIN ProjectLab pl ON p.code = pl.projectCode
                    WHERE (
                        p.labId = ${userLabId}
                        OR pl.labId = ${userLabId}
                        OR p.assignedLabIds LIKE ${'%"' + userLabId + '"%'}
                    )
                `;
            } else {
                labProjects = await prisma.$queryRaw`
                    SELECT DISTINCT p.* FROM Project p
                    LEFT JOIN ProjectLab pl ON p.code = pl.projectCode
                    WHERE p.status != 'DELETED'
                    AND (
                        p.labId = ${userLabId}
                        OR pl.labId = ${userLabId}
                        OR p.assignedLabIds LIKE ${'%"' + userLabId + '"%'}
                    )
                `;
            }
            projects = labProjects;
        }

        // Enrich with sample counts (lab-scoped for non-admins)
        const enrichedProjects = await Promise.all(projects.map(async (p) => {
            // Build sample query - for lab users, scope to their lab's samples
            const sampleWhere = {
                OR: [
                    { projectId: p.id },
                    { projectCode: p.code }
                ]
            };

            // Lab users see only their lab's samples from global projects
            if (user.labId && (user.role === 'LAB_MANAGER' || user.role === 'SAMPLE_RECEPTION' || user.role === 'LAB_TECHNICIAN')) {
                sampleWhere.AND = [
                    { OR: [{ projectId: p.id }, { projectCode: p.code }] },
                    { OR: [{ assignedLab: user.labId }, { labId: user.labId }] }
                ];
                delete sampleWhere.OR;
            }

            const [totalCount, receivedCount] = await Promise.all([
                prisma.sample.count({ where: sampleWhere }),
                prisma.sample.count({
                    where: { ...sampleWhere, status: { not: 'EXPECTED' } }
                })
            ]);

            // Get labs assigned to this project via ProjectLab
            const assignedLabs = await prisma.$queryRaw`
                SELECT labId FROM ProjectLab WHERE projectCode = ${p.code}
            `;

            return {
                ...p,
                receivedCount,
                totalCount,
                assignedLabs: assignedLabs.map(l => l.labId),
                isGlobal: !p.labId,
                isLocked: user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN' && !p.labId
            };
        }));

        res.json(enrichedProjects);
    } catch (error) {
        console.error('[getProjects] Error:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
};

exports.getProject = async (req, res) => {
    const { id } = req.params;
    try {
        const project = await prisma.project.findUnique({ where: { id: String(id) } });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        // Lab Isolation Check (Phase 1 - Scope Guard)
        const scopeGuard = require('../utils/scopeGuard');
        if (!scopeGuard.canAccessEntity(req.user, project, { labField: 'labId' })) {
            return res.status(403).json({ error: 'Access denied: Project belongs to another lab' });
        }

        res.json(project);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch project' });
    }
};

exports.createProject = async (req, res) => {
    const {
        code, name, description,
        projectType, expectedSampleCount, deliveryDeadline,
        priority, defaultAnalysisBundle, notes
    } = req.body;

    // VALIDATION
    if (!code || !name || !projectType) {
        return res.status(400).json({ error: 'Code, Name, and Project Type are required' });
    }

    // KOBO_LINKED validation: require Kobo credentials
    if (projectType === 'KOBO_LINKED') {
        if (!req.body.koboFormId || !req.body.koboApiToken) {
            return res.status(400).json({ error: 'Kobo Form ID and API Token are required for Kobo-linked projects' });
        }
    }

    const uppercaseCode = code.toUpperCase().replace(/\s+/g, '-');

    try {
        const existing = await prisma.project.findUnique({ where: { code: uppercaseCode } });
        if (existing) return res.status(400).json({ error: 'Project code already exists' });

        let labId = null;
        const userRole = req.user.role ? req.user.role.trim() : '';

        if (userRole === 'LAB_MANAGER') {
            labId = req.user.labId;
        } else if (req.body.labId) {
            labId = req.body.labId;
        }

        // If sampleIds are provided with the creation request, skip PENDING_MANIFEST
        const hasSampleIds = Array.isArray(req.body.sampleIds) && req.body.sampleIds.length > 0;
        const initialStatus = (projectType === 'TEMPLATE_PREDEFINED_IDS' && !hasSampleIds) ? 'PENDING_MANIFEST' : 'ACTIVE';

        const newProject = await prisma.project.create({
            data: {
                id: uppercaseCode,
                code: uppercaseCode,
                name,
                description,
                notes,
                projectType,
                expectedSampleCount: parseInt(expectedSampleCount) || 0,
                deliveryDeadline: deliveryDeadline ? new Date(deliveryDeadline) : null,
                priority: priority || 'NORMAL',
                defaultAnalysisBundle,
                labId,
                assignedLabIds: req.body.assignedLabIds || null,
                status: initialStatus
            }
        });

        // Create manifest samples inline if provided
        if (hasSampleIds) {
            const uniqueSampleIds = [...new Set(req.body.sampleIds)];
            try {
                await prisma.sample.createMany({
                    data: uniqueSampleIds.map(sid => ({
                        id: sid,
                        originalId: sid,
                        projectId: newProject.id,
                        projectCode: uppercaseCode,
                        status: 'EXPECTED',
                        labId: labId || req.user.labId,
                        receptionDate: null,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }))
                });
                console.log(`[createProject] Created ${uniqueSampleIds.length} manifest samples for ${uppercaseCode}`);
            } catch (sampleErr) {
                console.error(`[createProject] Failed to create manifest samples:`, sampleErr.message);
                // Don't fail project creation if sample creation fails
            }
        }

        // KOBO_LINKED: Create KoboConfig entry linked to this project
        if (projectType === 'KOBO_LINKED' && labId) {
            try {
                const koboServerUrl = req.body.koboServerUrl || 'https://kf.kobotoolbox.org';
                const koboService = require('../services/koboService');

                // Validate credentials with a test call
                const testResult = await koboService.testConnection(koboServerUrl, req.body.koboFormId, req.body.koboApiToken);

                if (!testResult.success) {
                    console.warn(`[KOBO] Test connection failed for project ${uppercaseCode}: ${testResult.error}`);
                    // Still create KoboConfig but mark as inactive
                }

                const newConfig = await prisma.koboConfig.create({
                    data: {
                        labId,
                        labName: newProject.name,
                        projectCode: uppercaseCode,
                        koboServerUrl,
                        formId: req.body.koboFormId,
                        apiToken: req.body.koboApiToken,
                        isActive: testResult.success !== false
                    }
                });
                console.log(`[KOBO] Created KoboConfig for project ${uppercaseCode} (lab: ${labId})`);

                // AUTO-SYNC: Trigger initial sync in the background (non-blocking)
                // The user gets the project creation response immediately while samples load
                if (testResult.success !== false) {
                    const koboController = require('./koboController');
                    // Fire-and-forget: don't await, don't block project creation
                    Promise.resolve().then(async () => {
                        try {
                            const freshConfig = await prisma.koboConfig.findUnique({ where: { id: newConfig.id } });
                            if (!freshConfig) return;

                            // Use the internal sync function
                            const result = await koboController._syncLabSubmissions(freshConfig, req.user?.username || 'AUTO_SYNC');
                            console.log(`[KOBO] Auto-sync for ${uppercaseCode}: ${result.newSamples} samples imported, ${result.skipped} skipped`);
                        } catch (syncErr) {
                            console.error(`[KOBO] Auto-sync failed for ${uppercaseCode}:`, syncErr.message);
                        }
                    });
                }
            } catch (koboErr) {
                console.error(`[KOBO] Failed to create KoboConfig for ${uppercaseCode}:`, koboErr.message);
                // Don't fail project creation if KoboConfig fails
            }
        }

        await prisma.auditLog.create({
            data: {
                id: `audit-proj-create-${Date.now()}`,
                entity: 'PROJECT',
                entityId: uppercaseCode,
                action: 'PROJECT_CREATED',
                details: `Created ${projectType} project ${uppercaseCode} (Lab: ${labId || 'Global'})`,
                performedBy: req.user.username,
                timestamp: new Date()
            }
        });

        // NOTIFICATION: Notify assigned labs
        if (newProject.assignedLabIds) {
            try {
                const labIds = JSON.parse(newProject.assignedLabIds);
                if (Array.isArray(labIds) && labIds.length > 0) {
                    const managers = await prisma.user.findMany({
                        where: { labId: { in: labIds }, role: 'LAB_MANAGER' }
                    });
                    if (managers.length > 0) {
                        const notifications = managers.map(m => ({
                            id: `notif-proj-assign-${Date.now()}-${m.id}`,
                            userId: m.id,
                            title: 'New Project Assignment',
                            message: `A new global project has been assigned to your lab: ${newProject.name}`,
                            type: 'INFO',
                            link: `/projects?code=${newProject.code}`,
                            createdAt: new Date()
                        }));
                        await prisma.notification.createMany({ data: notifications });
                    }
                }
            } catch (e) { console.error('Create Notification Error:', e); }
        }

        res.json(newProject);
    } catch (error) {
        console.error('[createProject] Error:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Project code already exists' });
        }
        res.status(500).json({ error: 'Failed to create project' });
    }
};

exports.updateProject = async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    try {
        const project = await prisma.project.findUnique({ where: { id: String(id) } });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        // Lab Isolation Check
        const scopeGuard = require('../utils/scopeGuard');
        if (!scopeGuard.canAccessEntity(req.user, project, { labField: 'labId' })) {
            return res.status(403).json({ error: 'Cannot modify projects from another lab. Access denied.' });
        }

        // Managers cannot modify global projects UNLESS they are assigned to them
        if (req.user.role === 'LAB_MANAGER' && !project.labId) {
            // Re-verify assignment specifically for this check
            let isAssigned = false;
            if (project.assignedLabIds) {
                try {
                    const ids = JSON.parse(project.assignedLabIds);
                    isAssigned = Array.isArray(ids) && ids.includes(req.user.labId);
                } catch (e) {
                    isAssigned = project.assignedLabIds.includes(`"${req.user.labId}"`);
                }
            }

            if (!isAssigned) {
                return res.status(403).json({ error: 'Cannot modify Global/SoilFER projects that are not assigned to your lab.' });
            }
        }

        if (updates.code && updates.code !== project.code) {
            return res.status(400).json({ error: 'Cannot change Project Code' });
        }

        const validFields = [
            'name', 'description', 'notes', 'client',
            'startDate', 'deliveryDeadline', 'status',
            'projectType', 'expectedSampleCount', 'priority',
            'defaultAnalysisBundle', 'labId', 'assignedLabIds'
        ];

        const data = {};
        validFields.forEach(field => {
            if (updates[field] !== undefined) {
                data[field] = updates[field];
            }
        });

        // Remove fields Managers shouldn't touch
        if (req.user.role === 'LAB_MANAGER') delete data.labId;

        // Data Transformation
        if (data.expectedSampleCount !== undefined) data.expectedSampleCount = parseInt(data.expectedSampleCount) || 0;

        if (data.deliveryDeadline) {
            const d = new Date(data.deliveryDeadline);
            data.deliveryDeadline = isNaN(d.getTime()) ? null : d;
        } else if (data.deliveryDeadline === '') {
            data.deliveryDeadline = null;
        }

        if (data.startDate) {
            const d = new Date(data.startDate);
            data.startDate = isNaN(d.getTime()) ? null : d;
        } else if (data.startDate === '') {
            data.startDate = null;
        }

        // Enforce PENDING_MANIFEST if project is switched to Template type
        if (data.projectType === 'TEMPLATE_PREDEFINED_IDS' && project.projectType !== 'TEMPLATE_PREDEFINED_IDS') {
            data.status = 'PENDING_MANIFEST';
        }

        // Activate if switched to Open Intake and was pending manifest
        if (data.projectType === 'OPEN_INTAKE' && project.projectType === 'TEMPLATE_PREDEFINED_IDS') {
            if (project.status === 'PENDING_MANIFEST') {
                data.status = 'ACTIVE';
            }
        }

        console.log(`[DEBUG] Final Data for Project Update (${new Date().toISOString()}):`, JSON.stringify(data));

        const updated = await prisma.project.update({
            where: { id: String(id) },
            data
        });

        // KOBO CONFIG UPDATE: Admins and Lab Managers can manage Kobo credentials
        const effectiveProjectType = updates.projectType || project.projectType;
        if (['SUPER_ADMIN', 'MASTER_USER', 'ADMIN', 'LAB_MANAGER'].includes(req.user.role) && effectiveProjectType === 'KOBO_LINKED') {
            const { koboServerUrl, koboFormId, koboApiToken } = updates;
            if (koboServerUrl || koboFormId || koboApiToken) {
                try {
                    // Find existing KoboConfig for this project
                    const existingConfig = await prisma.koboConfig.findFirst({
                        where: { projectCode: project.code }
                    });

                    if (existingConfig) {
                        const koboData = {};
                        if (koboServerUrl) koboData.koboServerUrl = koboServerUrl;
                        if (koboFormId) koboData.formId = koboFormId;
                        if (koboApiToken) koboData.apiToken = koboApiToken;

                        await prisma.koboConfig.update({
                            where: { id: existingConfig.id },
                            data: koboData
                        });
                        console.log(`[KOBO] Updated KoboConfig for project ${project.code}`);
                    } else if (koboFormId && koboApiToken) {
                        // Create new config if credentials provided and none exists
                        const labId = project.labId || req.user.labId;
                        if (labId) {
                            await prisma.koboConfig.create({
                                data: {
                                    labId,
                                    labName: project.name,
                                    projectCode: project.code,
                                    koboServerUrl: koboServerUrl || 'https://kf.kobotoolbox.org',
                                    formId: koboFormId,
                                    apiToken: koboApiToken
                                }
                            });
                            console.log(`[KOBO] Created KoboConfig for project ${project.code}`);
                        }
                    }
                } catch (koboErr) {
                    console.error(`[KOBO] Failed to update KoboConfig for ${project.code}:`, koboErr.message);
                }
            }
        }

        // NOTIFICATION LOGIC: Notify Lab Managers if assignedLabIds changed
        if (data.assignedLabIds && data.assignedLabIds !== project.assignedLabIds) {
            try {
                const newIds = JSON.parse(data.assignedLabIds);
                const oldIds = project.assignedLabIds ? JSON.parse(project.assignedLabIds) : [];

                // Labs that were just added
                const addedLabs = newIds.filter(lid => !oldIds.includes(lid));

                if (addedLabs.length > 0) {
                    const managers = await prisma.user.findMany({
                        where: {
                            labId: { in: addedLabs },
                            role: 'LAB_MANAGER'
                        }
                    });

                    if (managers.length > 0) {
                        const notifications = managers.map(m => ({
                            id: `notif-proj-assign-${Date.now()}-${m.id}`,
                            userId: m.id,
                            title: 'New Global Project Assigned',
                            message: `Your lab has been assigned to global project: ${updated.name} (${updated.code})`,
                            type: 'INFO',
                            link: `/projects?code=${updated.code}`,
                            createdAt: new Date()
                        }));

                        await prisma.notification.createMany({
                            data: notifications
                        });
                    }
                }
            } catch (e) {
                console.error('[updateProject] Notification Error:', e);
            }
        }

        await prisma.auditLog.create({
            data: {
                id: `audit-proj-update-${Date.now()}`,
                entity: 'PROJECT',
                entityId: id,
                action: 'PROJECT_UPDATED',
                details: `Updated fields: ${Object.keys(data).join(', ')}`,
                performedBy: req.user.username,
                timestamp: new Date()
            }
        });

        res.json(updated);
    } catch (error) {
        console.error('[updateProject] Error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.uploadManifest = async (req, res) => {
    const { id } = req.params;
    const { sampleIds } = req.body;

    if (!Array.isArray(sampleIds) || sampleIds.length === 0) {
        return res.status(400).json({ error: 'Valid sample ID list required' });
    }

    try {
        const project = await prisma.project.findUnique({ where: { id: String(id) } });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        // SECURITY: Enforce Access - Managers must be assigned to the project
        const scopeGuard = require('../utils/scopeGuard');
        try {
            scopeGuard.ensureScope(req.user, project, { labField: 'labId' });
        } catch (e) {
            return res.status(403).json({ error: 'Access Denied: You are not assigned to this project.' });
        }

        // Check for duplicates within this batch and against existing db
        const uniqueSampleIds = [...new Set(sampleIds)];
        const existing = await prisma.sample.findMany({
            where: {
                OR: [
                    { id: { in: uniqueSampleIds } },
                    { originalId: { in: uniqueSampleIds } }
                ]
            },
            select: { id: true, originalId: true, projectId: true, projectCode: true }
        });

        // CROSS-PROJECT VALIDATION:
        // Identify samples that exist in OTHER projects
        const crossProjectConflicts = existing.filter(e => e.projectId && e.projectId !== id);

        if (crossProjectConflicts.length > 0) {
            const conflictDetails = crossProjectConflicts.map(c => `${c.id} (Project: ${c.projectCode || c.projectId})`).join(', ');
            return res.status(400).json({
                error: 'Cross-project Sample ID conflict detected.',
                details: `The following IDs are already registered to other projects: ${conflictDetails}. Samples cannot be shared across projects.`
            });
        }

        const existingIds = new Set(existing.map(e => e.id));
        const existingOriginalIds = new Set(existing.map(e => e.originalId));

        const newIds = uniqueSampleIds.filter(sid => !existingIds.has(sid) && !existingOriginalIds.has(sid));
        const skippedCount = uniqueSampleIds.length - newIds.length;

        if (newIds.length > 0) {
            await prisma.sample.createMany({
                data: newIds.map(sid => ({
                    id: sid,
                    originalId: sid,
                    projectId: id,
                    projectCode: project.code,
                    status: 'EXPECTED',
                    labId: project.labId || req.user.labId,
                    assignedLab: project.labId || req.user.labId,
                    receptionDate: null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }))
            });

            // Transition project status if it was pending manifest
            if (project.status === 'PENDING_MANIFEST') {
                await prisma.project.update({
                    where: { id: String(id) },
                    data: { status: 'ACTIVE' }
                });
            }

            // Audit Log
            await prisma.auditLog.create({
                data: {
                    id: `audit-man-${Date.now()}`,
                    entity: 'PROJECT',
                    entityId: id,
                    action: 'MANIFEST_UPLOAD',
                    details: `Uploaded ${newIds.length} new samples. ${skippedCount} items already in project were skipped.`,
                    performedBy: req.user.username,
                    timestamp: new Date()
                }
            });
        }

        res.json({
            message: `Successfully processed ${uniqueSampleIds.length} IDs.`,
            count: newIds.length,
            duplicatesSkipped: skippedCount
        });
    } catch (error) {
        console.error('[uploadManifest] Error:', error);
        res.status(500).json({ error: 'Failed to process manifest' });
    }
};

exports.archiveProject = async (req, res) => {
    const { id } = req.params;
    try {
        const project = await prisma.project.findUnique({ where: { id: String(id) } });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        // Lab Isolation Check
        const scopeGuard = require('../utils/scopeGuard');
        if (!scopeGuard.canAccessEntity(req.user, project, { labField: 'labId' })) {
            return res.status(403).json({ error: 'Cannot archive projects from another lab. Access denied.' });
        }

        const updated = await prisma.project.update({
            where: { id: String(id) },
            data: { status: 'COMPLETED' }
        });

        await prisma.auditLog.create({
            data: {
                id: `audit-proj-arch-${id}-${Date.now()}`,
                entity: 'PROJECT',
                entityId: id,
                action: 'ARCHIVE',
                details: `Archived project ${project.code}. Marked as COMPLETED from ${project.status}.`,
                performedBy: req.user.username,
                timestamp: new Date()
            }
        });

        res.json({ message: 'Project archived', project: updated });
    } catch (error) {
        console.error('[archiveProject] Error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.deleteProject = async (req, res) => {
    const { id } = req.params;

    try {
        const project = await prisma.project.findUnique({ where: { id: String(id) } });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        // Lab Isolation Check
        const scopeGuard = require('../utils/scopeGuard');
        if (!scopeGuard.canAccessEntity(req.user, project, { labField: 'labId' })) {
            return res.status(403).json({ error: 'Cannot delete projects from another lab. Access denied.' });
        }

        // Additional check: Managers cannot delete global projects UNLESS assigned
        if (req.user.role === 'LAB_MANAGER' && !project.labId) {
            let isAssigned = false;
            if (project.assignedLabIds) {
                try {
                    const ids = JSON.parse(project.assignedLabIds);
                    isAssigned = Array.isArray(ids) && ids.includes(req.user.labId);
                } catch (e) {
                    isAssigned = project.assignedLabIds.includes(`"${req.user.labId}"`);
                }
            }
            if (!isAssigned) {
                return res.status(403).json({ error: 'Cannot delete Global/SoilFER projects that are not assigned to your lab.' });
            }
        }

        const projectCode = project.code;

        // Soft delete: Change status and unassign samples but track them
        const [updateResult, deletedProject] = await prisma.$transaction([
            prisma.sample.updateMany({
                where: { OR: [{ projectCode: projectCode }, { projectId: id }] },
                data: {
                    projectCode: `RESTORE:${id}`, // Tag for restoration
                    projectId: null
                }
            }),
            prisma.project.update({
                where: { id: String(id) },
                data: { status: 'DELETED' }
            })
        ]);

        await prisma.auditLog.create({
            data: {
                id: `audit-proj-soft-del-${Date.now()}`,
                entity: 'PROJECT',
                entityId: id,
                action: 'DELETE_SOFT',
                details: `Soft deleted project ${projectCode}. Moved ${updateResult.count} samples to RESTORE pool.`,
                performedBy: req.user.username,
                timestamp: new Date()
            }
        });

        res.json({ message: 'Project moved to trash', reassignedCount: updateResult.count });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.restoreProject = async (req, res) => {
    const { id } = req.params;
    try {
        const project = await prisma.project.findUnique({ where: { id: String(id) } });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        // Lab Isolation Check
        const scopeGuard = require('../utils/scopeGuard');
        if (!scopeGuard.canAccessEntity(req.user, project, { labField: 'labId' })) {
            return res.status(403).json({ error: 'Cannot restore projects from another lab' });
        }

        const [updateResult, restoredProject] = await prisma.$transaction([
            prisma.sample.updateMany({
                where: { projectCode: `RESTORE:${id}` },
                data: {
                    projectCode: project.code,
                    projectId: project.id
                }
            }),
            prisma.project.update({
                where: { id: String(id) },
                data: { status: 'ACTIVE' }
            })
        ]);

        await prisma.auditLog.create({
            data: {
                id: `audit-proj-restore-${id}-${Date.now()}`,
                entity: 'PROJECT',
                entityId: id,
                action: 'RESTORE',
                details: `Restored project ${project.code}. Re-linked ${updateResult.count} samples.`,
                performedBy: req.user.username,
                timestamp: new Date()
            }
        });

        res.json({ message: 'Project restored', restoredCount: updateResult.count });
    } catch (error) {
        console.error('[restoreProject] Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Hardcoded Targets from Dashboard Logic
const TARGETS = {
    'SoilFER-USA': { sites: 16836, samples: 33672 }, // Aggregate of ZMB, GTM, HND, GHA, KEN
    'SoilFER-JPN': { sites: 3429, samples: 6858 },    // Aggregate of MOZ, TUN
    'SoilFER-ZMB': { sites: 5404, samples: 10808 },
    'SoilFER-GTM': { sites: 4204, samples: 8408 },
    'SoilFER-HND': { sites: 3500, samples: 7000 },
    'SoilFER-GHA': { sites: 1892, samples: 3784 },
    'SoilFER-KEN': { sites: 1836, samples: 3672 },
    'SoilFER-MOZ': { sites: 1873, samples: 3746 },
    'SoilFER-TUN': { sites: 1556, samples: 3112 }
};

exports.getProjectStats = async (req, res) => {
    const { id } = req.params;
    try {
        const project = await prisma.project.findUnique({ where: { id: String(id) } });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        // RBAC Check & Filtering Setup
        // SECURITY: Enforce Lab Scope using central guard
        // This ensures Managers/Techs only see samples for their lab
        const scopeGuard = require('../utils/scopeGuard');
        const baseQuery = {
            OR: [
                { projectCode: project.code },
                { projectId: project.id }
            ]
        };

        const query = scopeGuard.buildScopedWhere(req.user, baseQuery, {
            labField: 'labId',
            altLabField: 'assignedLab'
        });

        // Retain specific Logic for target display if needed...
        // For stats, we just want to count samples visible to the user.
        // User's lab target is calculated below based on TARGETS constant.

        let projectTargets = TARGETS[project.code] || { sites: 0, samples: 0 };
        if (req.user.labId && req.user.role === 'LAB_MANAGER') {
            // Try to refine target to specific country if applicable
            const userLab = await prisma.lab.findUnique({ where: { id: req.user.labId } });
            if (userLab && (project.code === 'SoilFER-USA' || project.code === 'SoilFER-JPN')) {
                const countryTargetKey = `SoilFER-${userLab.country}`;
                if (TARGETS[countryTargetKey]) projectTargets = TARGETS[countryTargetKey];
            }
        }

        // Fetch samples to calculate status counts
        const samples = await prisma.sample.findMany({
            where: query,
            select: { status: true }
        });

        // Format Result
        const breakdown = {
            expected: 0,
            received: 0,
            processing: 0,
            completed: 0,
            rejected: 0
        };

        samples.forEach(s => {
            const status = s.status ? s.status.toUpperCase() : '';
            if (status === 'EXPECTED') breakdown.expected++;
            else if (status === 'RECEIVED' || status === 'ACCEPTED') breakdown.received++;
            else if (status === 'PROCESSING' || status === 'IN_LAB' || status === 'DRYING' || status === 'GRINDING') breakdown.processing++;
            else if (status === 'COMPLETED' || status === 'APPROVED') breakdown.completed++;
            else if (status === 'REJECTED' || status === 'FAILED') breakdown.rejected++;
        });

        res.json({
            total: samples.length,
            target: projectTargets.samples,
            ...breakdown
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch project stats' });
    }
};

exports.getProjectSamples = async (req, res) => {
    const { id } = req.params;
    try {
        const project = await prisma.project.findUnique({ where: { id: String(id) } });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        // Lab Isolation Check
        const scopeGuard = require('../utils/scopeGuard');
        if (!scopeGuard.canAccessEntity(req.user, project, { labField: 'labId' })) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const samples = await prisma.sample.findMany({
            where: {
                OR: [
                    { projectCode: project.code },
                    { projectId: project.id }
                ]
            },
            select: {
                id: true,
                originalId: true,
                status: true,
                labId: true,
                createdAt: true
            },
            orderBy: { id: 'asc' }
        });

        res.json(samples);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch project samples' });
    }
};

// --- KOBO CONFIG ENDPOINT ---
exports.getProjectKoboConfig = async (req, res) => {
    const { id } = req.params;
    try {
        const project = await prisma.project.findUnique({ where: { id: String(id) } });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        if (project.projectType !== 'KOBO_LINKED') {
            return res.json({ configured: false });
        }

        // Find all KoboConfigs for this project (there may be multiple for global projects with multiple labs)
        const configs = await prisma.koboConfig.findMany({
            where: { projectCode: project.code }
        });

        if (configs.length === 0) {
            return res.json({ configured: false });
        }

        const isAdmin = ['SUPER_ADMIN', 'MASTER_USER', 'ADMIN'].includes(req.user.role);

        // Return the first config (primary), masking sensitive data for non-admins
        const config = configs[0];
        res.json({
            configured: true,
            koboServerUrl: config.koboServerUrl,
            koboFormId: config.formId,
            koboApiToken: isAdmin ? config.apiToken : ('••••••••' + config.apiToken.slice(-4)),
            isActive: config.isActive,
            lastSyncAt: config.lastSyncAt,
            canEdit: isAdmin
        });
    } catch (error) {
        console.error('[getProjectKoboConfig] Error:', error);
        res.status(500).json({ error: 'Failed to fetch Kobo config' });
    }
};
