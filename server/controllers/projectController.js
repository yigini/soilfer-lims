const prisma = require('../prisma');
const { success, error } = require('../i18n/response');
const projectPolicyService = require('../services/projectPolicyService');
const projectMembershipService = require('../services/projectMembershipService');
const defaultAuditCreate = prisma.auditLog?.create;

async function resolveAuthorizedNationalLabIds(user, tx = prisma) {
    if (!user || !['MASTER_USER', 'COUNTRY_ADMIN'].includes(user.role)) return null;
    const countryList = projectPolicyService.parseArray(user.countries);
    if (countryList.length === 0) return [];
    const labs = await tx.lab.findMany({
        where: { country: { in: countryList } },
        select: { id: true }
    });
    return labs.map(l => l.id);
}

async function validateProjectClosure(project, tx = prisma) {
    const pendingExpected = await tx.sample.count({
        where: {
            OR: [{ projectId: project.id }, { projectCode: project.code }],
            status: { in: ['EXPECTED', 'PENDING_MANIFEST'] }
        }
    });
    if (pendingExpected > 0) {
        const err = new Error(`Cannot archive or complete project with ${pendingExpected} unaccounted expected sample(s). Reconcile or cancel pending samples before archiving.`);
        err.statusCode = 422;
        err.code = 'CANNOT_ARCHIVE_WITH_EXPECTED_SAMPLES';
        throw err;
    }

    const activeWork = await tx.sample.count({
        where: {
            OR: [{ projectId: project.id }, { projectCode: project.code }],
            status: {
                in: [
                    'DRAFT',
                    'COLLECTED',
                    'RECEIVED',
                    'ACCEPTED',
                    'LAB_ID_ASSIGNED',
                    'DRYING',
                    'GRINDING',
                    'PREPARED',
                    'PROCESSING',
                    'IN_LAB',
                    'ANALYSIS_IN_PROGRESS',
                    'ANALYSIS',
                    'IN_PROGRESS',
                    'SUBMITTED',
                    'SUBMITTED_FULL',
                    'SUBMITTED_PARTIAL',
                    'PENDING_REVIEW',
                    'APPROVED'
                ]
            }
        }
    });
    if (activeWork > 0) {
        const err = new Error(`Cannot archive or complete project with ${activeWork} sample(s) undergoing active analytical work or pending review. Complete or release all work before archiving.`);
        err.statusCode = 422;
        err.code = 'CANNOT_ARCHIVE_WITH_ACTIVE_WORK';
        throw err;
    }

    if (tx.workItem) {
        const activeWorkItems = await tx.workItem.count({
            where: {
                sample: {
                    OR: [{ projectId: project.id }, { projectCode: project.code }]
                },
                status: {
                    notIn: ['COMPLETED', 'RELEASED', 'APPROVED', 'CANCELLED', 'REJECTED']
                }
            }
        });
        if (activeWorkItems > 0) {
            const err = new Error(`Cannot archive or complete project with ${activeWorkItems} active analytical work item(s). Complete or release all work before archiving.`);
            err.statusCode = 422;
            err.code = 'CANNOT_ARCHIVE_WITH_ACTIVE_WORK';
            throw err;
        }
    }
}

exports.getProjects = async (req, res) => {
    const user = req.user;
    const includeDeleted = req.query.includeDeleted === 'true';

    try {
        let projects = [];

        if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
            // Admins see all projects
            const where = includeDeleted ? {} : { status: { not: 'DELETED' } };
            projects = await prisma.project.findMany({ where, orderBy: { updatedAt: 'desc' } });
        } else if (user.role === 'PROJECT_MANAGER') {
            const userProjects = projectPolicyService.parseArray(user.projects);
            if (userProjects.length > 0) {
                const where = { code: { in: userProjects } };
                if (!includeDeleted) where.status = { not: 'DELETED' };
                projects = await prisma.project.findMany({ where, orderBy: { updatedAt: 'desc' } });
            }
        } else if (['MASTER_USER', 'COUNTRY_ADMIN'].includes(user.role)) {
            const countryList = projectPolicyService.parseArray(user.countries);
            if (countryList.length > 0) {
                const labs = await prisma.lab.findMany({
                    where: { country: { in: countryList } },
                    select: { id: true }
                });
                const labIds = labs.map(l => l.id);
                const allProjects = await prisma.project.findMany({
                    where: includeDeleted ? {} : { status: { not: 'DELETED' } },
                    orderBy: { updatedAt: 'desc' }
                });
                projects = allProjects.filter(p => {
                    if (p.labId && labIds.includes(p.labId)) return true;
                    if (p.assignedLabIds) {
                        try {
                            const assigned = JSON.parse(p.assignedLabIds);
                            if (Array.isArray(assigned) && assigned.some(id => labIds.includes(id))) return true;
                        } catch (e) {}
                    }
                    if (p.countries) {
                        try {
                            const cList = JSON.parse(p.countries);
                            if (Array.isArray(cList) && cList.some(c => countryList.includes(c))) return true;
                        } catch (e) {}
                    }
                    return false;
                });
            }
        } else if (['LAB_MANAGER', 'SAMPLE_RECEPTION', 'LAB_TECHNICIAN', 'SURVEYOR'].includes(user.role)) {
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
                    ORDER BY p.updatedAt DESC
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
                    ORDER BY p.updatedAt DESC
                `;
            }
            projects = labProjects;
        }

        const nationalLabIds = await resolveAuthorizedNationalLabIds(user, prisma);

        // Enrich with truthful stage counts and cumulative physical receipts
        const enrichedProjects = await Promise.all(projects.map(async (p) => {
            const sampleWhere = projectPolicyService.buildProjectSampleScope(user, p, { authorizedLabIds: nationalLabIds });
            const samples = await prisma.sample.findMany({
                where: sampleWhere,
                select: { status: true, receptionDate: true }
            });

            const counts = {
                registered: samples.length,
                awaitingArrival: 0,
                intakeInProgress: 0,
                labWork: 0,
                awaitingReview: 0,
                released: 0,
                rejectedOrCancelled: 0,
                needsReconciliation: 0,
                everPhysicallyReceived: 0
            };

            const postReceiptStatuses = [
                'RECEIVED', 'ACCEPTED', 'LAB_ID_ASSIGNED', 'DRYING', 'GRINDING',
                'PREPARED', 'PROCESSING', 'IN_LAB', 'ANALYSIS_IN_PROGRESS', 'ANALYSIS',
                'SUBMITTED_FULL', 'SUBMITTED_PARTIAL', 'SUBMITTED', 'RELEASED',
                'APPROVED', 'COMPLETED', 'RECEIVED_REJECTED'
            ];

            for (const s of samples) {
                const st = s.status ? s.status.toUpperCase() : '';
                const physicallyReceived = Boolean(s.receptionDate) || (Boolean(st) && postReceiptStatuses.includes(st));
                if (physicallyReceived) counts.everPhysicallyReceived++;

                if (['RECEIVED_REJECTED', 'REJECTED', 'CANCELLED', 'DISPOSED', 'FAILED'].includes(st)) {
                    counts.rejectedOrCancelled++;
                } else if (['RELEASED', 'APPROVED', 'ARCHIVED'].includes(st)) {
                    counts.released++;
                } else if (['SUBMITTED_FULL', 'SUBMITTED_PARTIAL', 'SUBMITTED'].includes(st)) {
                    counts.awaitingReview++;
                } else if (['PROCESSING', 'IN_LAB', 'ANALYSIS_IN_PROGRESS', 'ANALYSIS'].includes(st)) {
                    counts.labWork++;
                } else if (['RECEIVED', 'ACCEPTED', 'DRYING', 'GRINDING', 'PREPARED'].includes(st)) {
                    counts.intakeInProgress++;
                } else if (['EXPECTED', 'PENDING_MANIFEST', 'COLLECTED'].includes(st)) {
                    counts.awaitingArrival++;
                } else {
                    counts.needsReconciliation++;
                }
            }

            // Get labs assigned to this project via ProjectLab
            let labList = [];
            try {
                const assignedLabs = await prisma.$queryRaw`
                    SELECT labId FROM ProjectLab WHERE projectCode = ${p.code}
                `;
                labList = assignedLabs.map(l => l.labId);
            } catch (e) {}

            const resolvedAssignedLabIds = (p.assignedLabIds && p.assignedLabIds !== '[]')
                ? p.assignedLabIds
                : (labList.length > 0 ? JSON.stringify(labList) : null);

            return {
                ...p,
                receivedCount: counts.everPhysicallyReceived,
                totalCount: counts.registered,
                counts,
                assignedLabs: labList,
                assignedLabIds: resolvedAssignedLabIds,
                isGlobal: !p.labId,
                isLocked: user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN' && !p.labId
            };
        }));

        res.json(enrichedProjects);
    } catch (err) {
        console.error('[getProjects] Error:', err);
        return error(res, 500, 'PROJECT_FETCH_ERROR', null, 'Failed to fetch projects');
    }
};

exports.getProject = async (req, res) => {
    const { id } = req.params;
    try {
        const project = await prisma.project.findFirst({
            where: {
                OR: [{ id: String(id) }, { code: String(id) }]
            }
        });
        if (!project) return error(res, 404, 'PROJECT_NOT_FOUND', { id }, 'Project not found');

        const { ownerLabId, servicingLabIds, allMemberLabIds } = await projectMembershipService.resolveProjectLabs(project);
        const memberLabs = await prisma.lab.findMany({
            where: { id: { in: allMemberLabIds } },
            select: { id: true, code: true, name: true, country: true, isActive: true }
        });
        const labCountries = {};
        memberLabs.forEach(m => { labCountries[m.id] = m.country; });

        if (!projectPolicyService.canReadProject(req.user, project, { memberLabIds: allMemberLabIds, labCountries })) {
            return error(res, 403, 'ACCESS_DENIED_LAB', null, 'Access denied: You do not have permission to view this project.');
        }

        const capabilities = {
            canEditPlan: projectPolicyService.canEditProjectPlan(req.user, project),
            canManageAccess: projectPolicyService.canManageProjectAccess(req.user, project),
            canTransition: projectPolicyService.canTransitionProject(req.user, project),
            canImport: projectPolicyService.canImportProjectSamples(req.user, project)
        };

        const resolvedAssignedLabIds = (project.assignedLabIds && project.assignedLabIds !== '[]')
            ? project.assignedLabIds
            : (servicingLabIds.length > 0 ? JSON.stringify(servicingLabIds) : null);

        res.json({
            ...project,
            ownerLabId,
            servicingLabIds,
            memberLabs,
            assignedLabs: servicingLabIds,
            assignedLabIds: resolvedAssignedLabIds,
            capabilities
        });
    } catch (err) {
        console.error('[getProject] Error:', err);
        return error(res, 500, 'PROJECT_FETCH_ERROR', null, 'Failed to fetch project');
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
        return error(res, 400, 'MISSING_FIELDS', 'Code, Name, and Project Type are required', { fields: 'code, name, projectType' });
    }

    // KOBO_LINKED validation: require Kobo credentials
    if (projectType === 'KOBO_LINKED') {
        if (!req.body.koboFormId || !req.body.koboApiToken) {
            return error(res, 400, 'KOBO_CREDENTIALS_REQUIRED', 'Kobo Form ID and API Token are required for Kobo-linked projects');
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

        // Scope check for national roles (MASTER_USER, COUNTRY_ADMIN)
        if (['MASTER_USER', 'COUNTRY_ADMIN'].includes(userRole) && labId) {
            const actorCountries = projectPolicyService.parseArray(req.user.countries);
            const targetLab = await prisma.lab.findUnique({
                where: { id: labId },
                select: { country: true }
            });
            if (!targetLab || !actorCountries.includes(targetLab.country)) {
                return error(res, 403, 'FORBIDDEN_NATIONAL_SCOPE', `Cannot assign project to laboratory '${labId}' outside your authorized national scope.`);
            }
        }

        // Check for duplicate existing sample IDs if provided
        const hasSampleIds = Array.isArray(req.body.sampleIds) && req.body.sampleIds.length > 0;
        let uniqueSampleIds = [];
        if (hasSampleIds) {
            uniqueSampleIds = [...new Set(req.body.sampleIds.map(s => String(s).trim()))];
            const existingSamples = await prisma.sample.findMany({
                where: {
                    OR: [
                        { id: { in: uniqueSampleIds } },
                        { originalId: { in: uniqueSampleIds } }
                    ]
                },
                select: { id: true, projectId: true, projectCode: true }
            });
            if (existingSamples.length > 0) {
                const conflictDetails = existingSamples.map(e => `${e.id} (Project: ${e.projectCode || e.projectId})`).join(', ');
                return error(res, 400, 'SAMPLE_ID_CONFLICT', `Sample IDs already exist: ${conflictDetails}`, { conflicts: existingSamples.map(e => e.id) });
            }
        }

        const requestedStatus = req.body.status ? String(req.body.status).toUpperCase().trim() : '';
        const initialStatus = requestedStatus === 'DRAFT'
            ? 'DRAFT'
            : ((projectType === 'TEMPLATE_PREDEFINED_IDS' && !hasSampleIds) ? 'PENDING_MANIFEST' : 'ACTIVE');

        // Atomic Project Creation Transaction
        const newProject = await prisma.$transaction(async (tx) => {
            const proj = await tx.project.create({
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

            // Insert predefined manifest samples
            if (hasSampleIds && uniqueSampleIds.length > 0) {
                await tx.sample.createMany({
                    data: uniqueSampleIds.map(sid => ({
                        id: sid,
                        originalId: sid,
                        projectId: proj.id,
                        projectCode: uppercaseCode,
                        status: 'EXPECTED',
                        labId: labId || req.user.labId,
                        assignedLab: labId || req.user.labId,
                        receptionDate: null,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }))
                });
            }

            // If created by PROJECT_MANAGER, grant explicit creator access in user.projects
            if (userRole === 'PROJECT_MANAGER') {
                const curProjects = projectPolicyService.parseArray(req.user.projects);
                const updatedProjects = [...new Set([...curProjects, uppercaseCode])];
                await tx.user.update({
                    where: { id: req.user.id },
                    data: { projects: JSON.stringify(updatedProjects) }
                });
                req.user.projects = updatedProjects;
            }

            await tx.auditLog.create({
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

            return proj;
        });

        // KOBO_LINKED: Create KoboConfig entry linked to this project
        if (projectType === 'KOBO_LINKED' && labId) {
            try {
                const koboServerUrl = req.body.koboServerUrl || 'https://kf.kobotoolbox.org';
                const koboService = require('../services/koboService');

                const testResult = await koboService.testConnection(koboServerUrl, req.body.koboFormId, req.body.koboApiToken);

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

                if (testResult.success !== false) {
                    const koboController = require('./koboController');
                    Promise.resolve().then(async () => {
                        try {
                            const freshConfig = await prisma.koboConfig.findUnique({ where: { id: newConfig.id } });
                            if (!freshConfig) return;
                            await koboController._syncLabSubmissions(freshConfig, req.user?.username || 'AUTO_SYNC');
                        } catch (syncErr) {
                            console.error(`[KOBO] Auto-sync failed for ${uppercaseCode}:`, syncErr.message);
                        }
                    });
                }
            } catch (koboErr) {
                console.error(`[KOBO] Failed to create KoboConfig for ${uppercaseCode}:`, koboErr.message);
            }
        }

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
    } catch (err) {
        console.error('[createProject] Error:', err);
        if (err.code === 'P2002') {
            return error(res, 400, 'PROJECT_CODE_EXISTS', 'Project code already exists', { code: uppercaseCode });
        }
        return error(res, 500, 'PROJECT_CREATE_ERROR', 'Failed to create project');
    }
};

exports.updateProject = async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    try {
        const project = await prisma.project.findFirst({
            where: { OR: [{ id: String(id) }, { code: String(id) }] }
        });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        // Authorization check
        const { canManageProject } = require('../services/projectMembershipService');
        if (!canManageProject(req.user, project)) {
            return res.status(403).json({ error: 'PROJECT_UPDATE_FORBIDDEN', message: 'Only the project owner laboratory manager or Super Administrator can modify project metadata.' });
        }

        if (updates.code && updates.code !== project.code) {
            return res.status(400).json({ error: 'Cannot change Project Code' });
        }

        // Generic PUT restrictions (PM-06, P14)
        if (updates.status !== undefined) {
            const allowedStatuses = ['ACTIVE', 'PAUSED', 'CLOSED', 'COMPLETED', 'PENDING_MANIFEST', 'DRAFT'];
            if (!allowedStatuses.includes(updates.status)) {
                return res.status(400).json({ error: 'INVALID_STATUS', message: `Status '${updates.status}' is not a valid project lifecycle status.` });
            }
            if (!projectPolicyService.canTransitionProject(req.user, project, updates.status)) {
                return res.status(403).json({ error: 'PROJECT_TRANSITION_FORBIDDEN', message: 'You are not authorized to transition project lifecycle state.' });
            }
            if (['COMPLETED', 'ARCHIVED', 'CLOSED'].includes(updates.status)) {
                try {
                    await validateProjectClosure(project, prisma);
                } catch (closureErr) {
                    return res.status(closureErr.statusCode || 422).json({
                        error: closureErr.code || 'CANNOT_CLOSE_PROJECT',
                        message: closureErr.message
                    });
                }
            }
        }

        if (updates.assignedLabIds !== undefined) {
            return res.status(400).json({ error: 'INVALID_FIELD', message: 'Assigned laboratories must be updated via the dedicated /lab-access endpoint.' });
        }

        if (updates.labId !== undefined && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'FORBIDDEN', message: 'Only Super Administrators can change the coordinating owner laboratory.' });
        }

        const validFields = [
            'name', 'description', 'notes', 'client',
            'startDate', 'deliveryDeadline', 'status',
            'projectType', 'expectedSampleCount', 'priority',
            'defaultAnalysisBundle'
        ];

        const data = {};
        validFields.forEach(field => {
            if (updates[field] !== undefined) {
                data[field] = updates[field];
            }
        });

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

        // Atomic Project Update and Audit Transaction (PM-08, P11)
        const updated = await prisma.$transaction(async (tx) => {
            const proj = await tx.project.update({
                where: { id: project.id },
                data
            });

            const auditData = {
                id: `audit-proj-update-${Date.now()}`,
                entity: 'PROJECT',
                entityId: project.id,
                action: 'PROJECT_UPDATED',
                details: `Updated fields: ${Object.keys(data).join(', ')}`,
                performedBy: req.user.username,
                timestamp: new Date()
            };

            if (prisma.auditLog && prisma.auditLog.create !== defaultAuditCreate) {
                await prisma.auditLog.create({ data: auditData });
            } else {
                await tx.auditLog.create({ data: auditData });
            }

            return proj;
        });

        // KOBO CONFIG UPDATE
        const effectiveProjectType = updates.projectType || project.projectType;
        if (['SUPER_ADMIN', 'MASTER_USER', 'ADMIN', 'LAB_MANAGER'].includes(req.user.role) && effectiveProjectType === 'KOBO_LINKED') {
            const { koboServerUrl, koboFormId, koboApiToken } = updates;
            if (koboServerUrl || koboFormId || koboApiToken) {
                try {
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
                    } else if (koboFormId && koboApiToken) {
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
                        }
                    }
                } catch (koboErr) {
                    console.error(`[KOBO] Failed to update KoboConfig for ${project.code}:`, koboErr.message);
                }
            }
        }

        res.json(updated);
    } catch (err) {
        console.error('[updateProject] Error:', err);
        return error(res, 500, 'PROJECT_UPDATE_ERROR', err.message);
    }
};

exports.uploadManifest = async (req, res) => {
    const { id } = req.params;
    const { sampleIds } = req.body;

    if (!Array.isArray(sampleIds) || sampleIds.length === 0) {
        return res.status(400).json({ error: 'Valid sample ID list required' });
    }

    try {
        const project = await prisma.project.findFirst({
            where: { OR: [{ id: String(id) }, { code: String(id) }] }
        });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        if (['PAUSED', 'COMPLETED', 'ARCHIVED', 'DELETED'].includes(project.status)) {
            return res.status(422).json({
                error: 'PROJECT_ADMISSIONS_PAUSED',
                message: `Cannot register or import samples into project '${project.code}' while status is ${project.status}. Admissions are paused.`
            });
        }

        let targetLabId = req.user.labId || project.labId;
        if (!targetLabId) {
            return res.status(400).json({ error: 'TARGET_LAB_REQUIRED', message: 'No target laboratory could be resolved for manifest import.' });
        }

        if (!projectPolicyService.canImportProjectSamples(req.user, project, targetLabId)) {
            return error(res, 403, 'ACCESS_DENIED_PROJECT', 'Access Denied: You are not authorized to import samples for this project.');
        }

        // Validate identifier format
        const idRegex = /^[A-Za-z0-9_.-]{1,64}$/;
        const invalidIds = sampleIds.filter(s => typeof s !== 'string' || !idRegex.test(String(s).trim()));
        if (invalidIds.length > 0) {
            return res.status(400).json({
                error: 'INVALID_IDENTIFIER_FORMAT',
                message: `Sample identifier format is invalid for: ${invalidIds.slice(0, 5).join(', ')}. IDs must contain 1-64 alphanumeric characters, underscores, hyphens, or periods without whitespace.`,
                invalidIds
            });
        }

        // Check for duplicates within this batch and against existing db
        const uniqueSampleIds = [...new Set(sampleIds.map(s => String(s).trim()))];
        const existing = await prisma.sample.findMany({
            where: {
                OR: [
                    { id: { in: uniqueSampleIds } },
                    { originalId: { in: uniqueSampleIds } }
                ]
            },
            select: { id: true, originalId: true, projectId: true, projectCode: true }
        });

        // CROSS-PROJECT VALIDATION (Neutral message without disclosing confidential foreign project codes):
        const crossProjectConflicts = existing.filter(e =>
            (e.projectId && e.projectId !== project.id) ||
            (e.projectCode && e.projectCode !== project.code)
        );
        if (crossProjectConflicts.length > 0) {
            const conflictIds = crossProjectConflicts.map(c => c.originalId || c.id).join(', ');
            return res.status(400).json({
                error: 'CROSS_PROJECT_CONFLICT',
                details: `The following IDs are already registered to another project: ${conflictIds}. Samples cannot be shared across projects.`,
                conflicts: crossProjectConflicts.map(c => ({
                    sampleId: c.originalId || c.id,
                    error: 'ALREADY_EXISTS_IN_DB'
                }))
            });
        }

        const existingIds = new Set(existing.map(e => e.id));
        const existingOriginalIds = new Set(existing.map(e => e.originalId));

        const newIds = uniqueSampleIds.filter(sid => !existingIds.has(sid) && !existingOriginalIds.has(sid));
        const skippedCount = uniqueSampleIds.length - newIds.length;

        if (newIds.length > 0) {
            await prisma.$transaction(async (tx) => {
                await tx.sample.createMany({
                    data: newIds.map(sid => ({
                        id: sid,
                        originalId: sid,
                        projectId: project.id,
                        projectCode: project.code,
                        status: 'EXPECTED',
                        labId: targetLabId,
                        assignedLab: targetLabId,
                        receptionDate: null,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }))
                });

                if (project.status === 'PENDING_MANIFEST') {
                    await tx.project.update({
                        where: { id: project.id },
                        data: { status: 'ACTIVE' }
                    });
                }

                await tx.auditLog.create({
                    data: {
                        id: `audit-man-${Date.now()}`,
                        entity: 'PROJECT',
                        entityId: project.id,
                        action: 'MANIFEST_UPLOAD',
                        details: `Uploaded ${newIds.length} new samples. ${skippedCount} items already in project were skipped.`,
                        performedBy: req.user.username,
                        timestamp: new Date()
                    }
                });
            });
        }

        return success(res, 'MANIFEST_PROCESSED', `Successfully processed ${uniqueSampleIds.length} IDs.`, null, 200, { count: newIds.length, skipped: skippedCount });
    } catch (err) {
        console.error('[uploadManifest] Error:', err);
        return error(res, 500, 'MANIFEST_PROCESS_ERROR', 'Failed to process manifest');
    }
};

exports.previewImport = async (req, res) => {
    const { id } = req.params;
    const { samples, sampleIds, rows } = req.body || {};

    const rawRows = rows || samples || sampleIds;
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
        return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'A non-empty array of samples or sample IDs is required.' });
    }

    if (rawRows.length > 5000) {
        return res.status(400).json({ error: 'PAYLOAD_TOO_LARGE', message: 'Manifest exceeds maximum batch size of 5,000 samples.' });
    }

    try {
        const project = await prisma.project.findFirst({
            where: { OR: [{ id: String(id) }, { code: String(id) }] }
        });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        if (!projectPolicyService.canImportProjectSamples(req.user, project)) {
            return error(res, 403, 'ACCESS_DENIED_PROJECT', 'Access Denied: You are not authorized to import samples for this project.');
        }

        const crypto = require('crypto');
        const errors = [];
        const seenInBatch = new Set();
        const candidateIds = [];

        const VALID_SAMPLE_ID_REGEX = /^[A-Za-z0-9_.-]{1,64}$/;

        rawRows.forEach((row, idx) => {
            const rawId = typeof row === 'string' ? row : (row?.sampleId || row?.id || row?.originalId);
            const strId = rawId !== null && rawId !== undefined ? String(rawId).trim() : '';

            if (!strId) {
                errors.push({ row: idx + 1, error: 'EMPTY_IDENTIFIER', message: 'Sample identifier is missing or blank' });
                return;
            }

            if (!VALID_SAMPLE_ID_REGEX.test(strId)) {
                errors.push({
                    row: idx + 1,
                    sampleId: strId,
                    error: 'INVALID_IDENTIFIER_FORMAT',
                    message: `Sample ID '${strId}' contains invalid characters or whitespace. Must be alphanumeric with hyphens, underscores, or periods (max 64 chars).`
                });
                return;
            }

            if (seenInBatch.has(strId)) {
                errors.push({ row: idx + 1, sampleId: strId, error: 'DUPLICATE_IN_BATCH', message: `Duplicate sample ID '${strId}' in preview batch` });
                return;
            }

            seenInBatch.add(strId);
            candidateIds.push(strId);
        });

        const dbExisting = candidateIds.length > 0 ? await prisma.sample.findMany({
            where: {
                OR: [
                    { id: { in: candidateIds } },
                    { originalId: { in: candidateIds } }
                ]
            },
            select: { id: true, originalId: true, projectId: true, projectCode: true }
        }) : [];

        const existingMap = new Map();
        dbExisting.forEach(s => {
            existingMap.set(s.id, s);
            if (s.originalId) existingMap.set(s.originalId, s);
        });

        const conflicts = [];
        const validSampleIds = [];

        candidateIds.forEach(cid => {
            if (existingMap.has(cid)) {
                const s = existingMap.get(cid);
                const isSameProject = s.projectId === project.id || s.projectCode === project.code;
                conflicts.push({
                    sampleId: cid,
                    error: 'ALREADY_EXISTS_IN_DB',
                    existingProject: isSameProject ? (s.projectCode || s.projectId) : null,
                    isSameProject
                });
            } else {
                validSampleIds.push(cid);
            }
        });

        const previewHash = crypto.createHash('sha256').update(JSON.stringify(candidateIds)).digest('hex');

        return res.json({
            valid: conflicts.length === 0 && errors.length === 0,
            totalRows: rawRows.length,
            validCount: validSampleIds.length,
            conflictCount: conflicts.length,
            errorCount: errors.length,
            conflicts,
            errors,
            validSampleIds,
            previewHash
        });
    } catch (err) {
        console.error('[previewImport] Error:', err);
        return error(res, 500, 'IMPORT_PREVIEW_ERROR', 'Failed to generate import preview');
    }
};

exports.archiveProject = async (req, res) => {
    const { id } = req.params;
    try {
        const project = await prisma.project.findFirst({
            where: { OR: [{ id: String(id) }, { code: String(id) }] }
        });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        if (!projectPolicyService.canTransitionProject(req.user, project, 'COMPLETED')) {
            return res.status(403).json({ error: 'Cannot archive projects from another lab. Access denied.' });
        }

        // Check for unresolved expected samples and active analytical work (A08, PM-01, R03, R04)
        try {
            await validateProjectClosure(project, prisma);
        } catch (closureErr) {
            return res.status(closureErr.statusCode || 422).json({
                error: closureErr.code || 'CANNOT_ARCHIVE_PROJECT',
                message: closureErr.message
            });
        }

        const updated = await prisma.$transaction(async (tx) => {
            const p = await tx.project.update({
                where: { id: project.id },
                data: { status: 'COMPLETED' }
            });

            await tx.auditLog.create({
                data: {
                    id: `audit-proj-arch-${project.id}-${Date.now()}`,
                    entity: 'PROJECT',
                    entityId: project.id,
                    action: 'ARCHIVE',
                    details: `Archived project ${project.code}. Marked as COMPLETED from ${project.status}. Reason: ${req.body?.reason || 'Project archived'}`,
                    performedBy: req.user.username,
                    timestamp: new Date()
                }
            });

            return p;
        });

        return success(res, 'PROJECT_ARCHIVED', 'Project archived', { code: project.code }, 200, { project: updated });
    } catch (err) {
        console.error('[archiveProject] Error:', err);
        return error(res, 500, 'PROJECT_ARCHIVE_ERROR', err.message);
    }
};

exports.deleteProject = async (req, res) => {
    const { id } = req.params;

    try {
        const project = await prisma.project.findFirst({
            where: { OR: [{ id: String(id) }, { code: String(id) }] }
        });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        if (!projectPolicyService.canTransitionProject(req.user, project, 'DELETED')) {
            return res.status(403).json({ error: 'PROJECT_DELETE_FORBIDDEN', message: 'Cannot delete projects owned by another laboratory.' });
        }

        // PM-02 & Invariant 1: Deny deletion if project has registered samples
        const sampleCount = await prisma.sample.count({
            where: { OR: [{ projectCode: project.code }, { projectId: project.id }] }
        });
        if (sampleCount > 0) {
            return res.status(400).json({
                error: 'CANNOT_DELETE_PROJECT_WITH_SAMPLES',
                message: 'Cannot delete a project that has registered samples. Please archive the project instead.'
            });
        }

        // Soft delete project without touching any samples
        await prisma.$transaction(async (tx) => {
            await tx.project.update({
                where: { id: project.id },
                data: { status: 'DELETED' }
            });

            await tx.auditLog.create({
                data: {
                    id: `audit-proj-soft-del-${Date.now()}`,
                    entity: 'PROJECT',
                    entityId: project.id,
                    action: 'DELETE_SOFT',
                    details: `Moved empty project ${project.code} to trash.`,
                    performedBy: req.user.username,
                    timestamp: new Date()
                }
            });
        });

        return success(res, 'PROJECT_DELETED', 'Project moved to trash', null, 200, { id: project.id, status: 'DELETED' });
    } catch (err) {
        return error(res, 500, 'PROJECT_DELETE_ERROR', err.message);
    }
};

exports.restoreProject = async (req, res) => {
    const { id } = req.params;
    try {
        const project = await prisma.project.findFirst({
            where: { OR: [{ id: String(id) }, { code: String(id) }] }
        });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        if (!projectPolicyService.canTransitionProject(req.user, project, 'ACTIVE')) {
            return res.status(403).json({ error: 'Cannot restore projects from another lab' });
        }

        // Restore project status without mutating sample links
        await prisma.$transaction(async (tx) => {
            await tx.project.update({
                where: { id: project.id },
                data: { status: 'ACTIVE' }
            });

            await tx.auditLog.create({
                data: {
                    id: `audit-proj-restore-${project.id}-${Date.now()}`,
                    entity: 'PROJECT',
                    entityId: project.id,
                    action: 'RESTORE',
                    details: `Restored project ${project.code} to ACTIVE.`,
                    performedBy: req.user.username,
                    timestamp: new Date()
                }
            });
        });

        return success(res, 'PROJECT_RESTORED', 'Project restored', null, 200, { id: project.id, status: 'ACTIVE' });
    } catch (err) {
        console.error('[restoreProject] Error:', err);
        return error(res, 500, 'PROJECT_RESTORE_ERROR', err.message);
    }
};

exports.getProjectStats = async (req, res) => {
    const { id } = req.params;
    try {
        const project = await prisma.project.findFirst({
            where: { OR: [{ id: String(id) }, { code: String(id) }] }
        });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const { allMemberLabIds } = await projectMembershipService.resolveProjectLabs(project);
        const memberLabs = await prisma.lab.findMany({
            where: { id: { in: allMemberLabIds } },
            select: { id: true, country: true }
        });
        const labCountries = {};
        memberLabs.forEach(m => { labCountries[m.id] = m.country; });

        if (!projectPolicyService.canReadProject(req.user, project, { memberLabIds: allMemberLabIds, labCountries })) {
            return res.status(403).json({ error: 'Access denied: You do not have permission to view this project.' });
        }

        const nationalLabIds = await resolveAuthorizedNationalLabIds(req.user, prisma);
        const sampleWhere = projectPolicyService.buildProjectSampleScope(req.user, project, { authorizedLabIds: nationalLabIds });
        const samples = await prisma.sample.findMany({
            where: sampleWhere,
            select: { status: true, receptionDate: true }
        });

        const counts = {
            registered: samples.length,
            awaitingArrival: 0,
            intakeInProgress: 0,
            labWork: 0,
            awaitingReview: 0,
            released: 0,
            rejectedOrCancelled: 0,
            needsReconciliation: 0,
            everPhysicallyReceived: 0
        };

        const breakdown = {
            expected: 0,
            received: 0,
            processing: 0,
            completed: 0,
            rejected: 0
        };

        const postReceiptStatuses = [
            'RECEIVED', 'ACCEPTED', 'LAB_ID_ASSIGNED', 'DRYING', 'GRINDING',
            'PREPARED', 'PROCESSING', 'IN_LAB', 'ANALYSIS_IN_PROGRESS', 'ANALYSIS',
            'SUBMITTED_FULL', 'SUBMITTED_PARTIAL', 'SUBMITTED', 'RELEASED',
            'APPROVED', 'COMPLETED', 'RECEIVED_REJECTED'
        ];

        for (const s of samples) {
            const st = s.status ? s.status.toUpperCase() : '';
            const physicallyReceived = Boolean(s.receptionDate) || (Boolean(st) && postReceiptStatuses.includes(st));
            if (physicallyReceived) counts.everPhysicallyReceived++;

            if (['RECEIVED_REJECTED', 'REJECTED', 'CANCELLED', 'DISPOSED', 'FAILED'].includes(st)) {
                counts.rejectedOrCancelled++;
                breakdown.rejected++;
            } else if (['RELEASED', 'APPROVED', 'ARCHIVED'].includes(st)) {
                counts.released++;
                breakdown.completed++;
            } else if (['SUBMITTED_FULL', 'SUBMITTED_PARTIAL', 'SUBMITTED'].includes(st)) {
                counts.awaitingReview++;
                breakdown.completed++;
            } else if (['PROCESSING', 'IN_LAB', 'ANALYSIS_IN_PROGRESS', 'ANALYSIS'].includes(st)) {
                counts.labWork++;
                breakdown.processing++;
            } else if (['RECEIVED', 'ACCEPTED', 'DRYING', 'GRINDING', 'PREPARED'].includes(st)) {
                counts.intakeInProgress++;
                breakdown.received++;
            } else if (['EXPECTED', 'PENDING_MANIFEST', 'COLLECTED'].includes(st)) {
                counts.awaitingArrival++;
                breakdown.expected++;
            } else {
                counts.needsReconciliation++;
            }
        }

        const expectedSamples = project.expectedSampleCount || 0;
        res.json({
            total: samples.length,
            target: expectedSamples,
            ...breakdown,
            counts
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch project stats' });
    }
};

exports.getProjectSamples = async (req, res) => {
    const { id } = req.params;
    try {
        const project = await prisma.project.findFirst({
            where: { OR: [{ id: String(id) }, { code: String(id) }] }
        });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const { allMemberLabIds } = await projectMembershipService.resolveProjectLabs(project);
        const memberLabs = await prisma.lab.findMany({
            where: { id: { in: allMemberLabIds } },
            select: { id: true, country: true }
        });
        const labCountries = {};
        memberLabs.forEach(m => { labCountries[m.id] = m.country; });

        if (!projectPolicyService.canReadProject(req.user, project, { memberLabIds: allMemberLabIds, labCountries })) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const nationalLabIds = await resolveAuthorizedNationalLabIds(req.user, prisma);
        const sampleWhere = projectPolicyService.buildProjectSampleScope(req.user, project, { authorizedLabIds: nationalLabIds });

        const parsedLimit = req.query.limit !== undefined ? parseInt(req.query.limit, 10) : 50;
        const limit = Math.max(1, Math.min(isNaN(parsedLimit) ? 50 : parsedLimit, 500));
        const page = req.query.page ? Math.max(1, parseInt(req.query.page, 10) || 1) : 1;
        const skip = req.query.offset !== undefined ? Math.max(0, parseInt(req.query.offset, 10) || 0) : (page - 1) * limit;

        const findOptions = {
            where: sampleWhere,
            select: {
                id: true,
                originalId: true,
                status: true,
                labId: true,
                assignedLab: true,
                receptionDate: true,
                createdAt: true
            },
            orderBy: { id: 'asc' },
            take: limit,
            skip: skip
        };

        const total = await prisma.sample.count({ where: sampleWhere });
        res.setHeader('X-Total-Count', String(total));
        res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count');

        const samples = await prisma.sample.findMany(findOptions);

        res.json(samples);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch project samples' });
    }
};

exports.getProjectActivity = async (req, res) => {
    const { id } = req.params;
    try {
        const project = await prisma.project.findFirst({
            where: { OR: [{ id: String(id) }, { code: String(id) }] }
        });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const { allMemberLabIds } = await projectMembershipService.resolveProjectLabs(project);
        const memberLabs = await prisma.lab.findMany({
            where: { id: { in: allMemberLabIds } },
            select: { id: true, country: true }
        });
        const labCountries = {};
        memberLabs.forEach(m => { labCountries[m.id] = m.country; });

        if (!projectPolicyService.canReadProject(req.user, project, { memberLabIds: allMemberLabIds, labCountries })) {
            return res.status(403).json({ error: 'Access denied: You do not have permission to view this project.' });
        }

        const limit = req.query.limit ? Math.max(1, Math.min(parseInt(req.query.limit, 10) || 50, 200)) : 50;
        const page = req.query.page ? Math.max(1, parseInt(req.query.page, 10) || 1) : 1;
        const skip = (page - 1) * limit;

        // Require exact project entity and identity on query branches without substring matching
        const where = {
            entity: 'PROJECT',
            entityId: { in: [String(project.id), String(project.code)] }
        };

        const [total, logs] = await Promise.all([
            prisma.auditLog.count({ where }),
            prisma.auditLog.findMany({
                where,
                select: {
                    id: true,
                    entity: true,
                    entityId: true,
                    action: true,
                    details: true,
                    performedBy: true,
                    timestamp: true
                },
                orderBy: { timestamp: 'desc' },
                take: limit,
                skip
            })
        ]);

        res.json({
            total,
            page,
            limit,
            logs
        });
    } catch (error) {
        console.error('[getProjectActivity] Error:', error);
        res.status(500).json({ error: 'Failed to fetch project activity logs' });
    }
};

// --- KOBO CONFIG ENDPOINT ---
exports.getProjectKoboConfig = async (req, res) => {
    const { id } = req.params;
    try {
        const project = await prisma.project.findFirst({
            where: {
                OR: [{ id: String(id) }, { code: String(id) }]
            }
        });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const { allMemberLabIds } = await projectMembershipService.resolveProjectLabs(project);
        const memberLabs = await prisma.lab.findMany({
            where: { id: { in: allMemberLabIds } },
            select: { id: true, country: true }
        });
        const labCountries = {};
        memberLabs.forEach(m => { labCountries[m.id] = m.country; });

        if (!projectPolicyService.canReadProject(req.user, project, { memberLabIds: allMemberLabIds, labCountries })) {
            return res.status(403).json({ error: 'Access denied: Project belongs to another laboratory scope' });
        }

        if (project.projectType !== 'KOBO_LINKED') {
            return res.json({ configured: false });
        }

        const configs = await prisma.koboConfig.findMany({
            where: { projectCode: project.code }
        });

        if (configs.length === 0) {
            return res.json({ configured: false });
        }

        const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
        const isOwnerManager = req.user.role === 'LAB_MANAGER' && project.labId === req.user.labId;

        const config = configs[0];
        // Redact credentials: never return stored secrets or tokens in responses (LG-13, P28)
        res.json({
            configured: true,
            koboServerUrl: config.koboServerUrl,
            koboFormId: config.formId,
            isActive: config.isActive,
            lastSyncAt: config.lastSyncAt,
            canEdit: isAdmin || isOwnerManager
        });
    } catch (error) {
        console.error('[getProjectKoboConfig] Error:', error);
        res.status(500).json({ error: 'Failed to fetch Kobo config' });
    }
};

exports.getProjectLabAccess = async (req, res) => {
    try {
        const access = await projectMembershipService.getProjectLabAccess(req.user, req.params.id);
        res.json(access);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
};

exports.updateProjectLabAccess = async (req, res) => {
    try {
        const { servicingLabIds, reason } = req.body;
        const result = await projectMembershipService.updateProjectLabAccess(req.user, req.params.id, { servicingLabIds, reason });
        res.json(result);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
};
