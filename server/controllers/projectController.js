const prisma = require('../prisma');
const { success, error } = require('../i18n/response');
const projectPolicyService = require('../services/projectPolicyService');
const projectMembershipService = require('../services/projectMembershipService');
const commandReceiptService = require('../services/commandReceiptService');
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

    const terminalStatuses = ['RELEASED', 'ARCHIVED', 'RECEIVED_REJECTED', 'REJECTED', 'CANCELLED', 'DISPOSED', 'FAILED'];
    const activeWork = await tx.sample.count({
        where: {
            OR: [{ projectId: project.id }, { projectCode: project.code }],
            status: {
                notIn: [...terminalStatuses, 'EXPECTED', 'PENDING_MANIFEST']
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
                    notIn: ['COMPLETED', 'RELEASED', 'APPROVED', 'ACCEPTED', 'CANCELLED', 'REJECTED']
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

            const allMemberLabs = Array.from(new Set([p.labId, ...labList].filter(Boolean)));
            const capabilities = projectPolicyService.getProjectCapabilities(user, p, { memberLabIds: allMemberLabs });

            return {
                ...p,
                receivedCount: counts.everPhysicallyReceived,
                totalCount: counts.registered,
                counts,
                assignedLabs: labList,
                assignedLabIds: resolvedAssignedLabIds,
                isGlobal: !p.labId,
                isLocked: user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN' && !p.labId,
                capabilities
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

        const capabilities = projectPolicyService.getProjectCapabilities(req.user, project, {
            memberLabIds: allMemberLabIds,
            labCountries
        });

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

    // KOBO_LINKED and Kobo connection validation
    let validatedTargetKoboLab = null;
    const isKoboRequested = projectType === 'KOBO_LINKED' || Boolean(req.body.koboFormId && req.body.koboApiToken);
    if (isKoboRequested) {
        if (projectType === 'KOBO_LINKED' && (!req.body.koboFormId || !req.body.koboApiToken)) {
            return error(res, 400, 'KOBO_CREDENTIALS_REQUIRED', 'Kobo Form ID and API Token are required for Kobo-linked projects');
        }
        const candidateLabId = req.body.destinationLabId || req.body.koboLabId || (req.user.role === 'LAB_MANAGER' ? req.user.labId : req.body.labId);
        if (projectType === 'KOBO_LINKED' && !candidateLabId) {
            return error(res, 400, 'DESTINATION_LAB_REQUIRED', 'Destination laboratory is required for Kobo data connection');
        }
        if (candidateLabId) {
            validatedTargetKoboLab = await prisma.lab.findFirst({
                where: { OR: [{ id: candidateLabId }, { code: candidateLabId }] }
            });
            if (!validatedTargetKoboLab || !validatedTargetKoboLab.isActive) {
                return error(res, 400, 'INVALID_DESTINATION_LAB', `Destination laboratory '${candidateLabId}' does not exist or is inactive.`);
            }
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

        const clientOrganization = req.body.client ? String(req.body.client).trim() : null;

        // Pre-test remote Kobo connection if credentials provided
        let isConnectionVerified = true;
        let connectionErrorMsg = null;
        const koboServerUrl = req.body.koboServerUrl || 'https://kf.kobotoolbox.org';
        if (validatedTargetKoboLab && req.body.koboFormId && req.body.koboApiToken) {
            const koboService = require('../services/koboService');
            try {
                const testResult = await koboService.testConnection(koboServerUrl, req.body.koboFormId, req.body.koboApiToken);
                if (testResult && testResult.success === false) {
                    isConnectionVerified = false;
                    connectionErrorMsg = testResult.message || testResult.error || 'Failed remote form verification';
                }
            } catch (testErr) {
                isConnectionVerified = false;
                connectionErrorMsg = testErr.message;
            }
        }

        // Atomic Project and Kobo Connection Creation Transaction
        const { proj: newProject, newConfig } = await prisma.$transaction(async (tx) => {
            const proj = await tx.project.create({
                data: {
                    id: uppercaseCode,
                    code: uppercaseCode,
                    name,
                    description,
                    notes,
                    client: clientOrganization,
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

            // Create KoboConfig entry atomically inside transaction
            let createdConfig = null;
            if (validatedTargetKoboLab && req.body.koboFormId && req.body.koboApiToken) {
                createdConfig = await tx.koboConfig.create({
                    data: {
                        labId: validatedTargetKoboLab.id,
                        labName: validatedTargetKoboLab.name || name,
                        projectCode: uppercaseCode,
                        koboServerUrl,
                        formId: req.body.koboFormId,
                        apiToken: req.body.koboApiToken,
                        isActive: isConnectionVerified
                    }
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

            return { proj, newConfig: createdConfig };
        });

        let koboConnectionOutcome = null;
        if (newConfig) {
            koboConnectionOutcome = {
                configured: true,
                configId: newConfig.id,
                formId: req.body.koboFormId,
                destinationLabId: validatedTargetKoboLab.id,
                isActive: isConnectionVerified,
                warning: isConnectionVerified ? null : `Kobo connection saved as unverified: ${connectionErrorMsg}`
            };

            if (isConnectionVerified) {
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

        const payloadHash = commandReceiptService.computePayloadHash(updates);
        const idempotencyKey = updates.idempotencyKey || req.headers['x-idempotency-key'];
        if (idempotencyKey) {
            const check = await commandReceiptService.checkReceipt(idempotencyKey, 'PROJECT_UPDATE', req.user.username, `Project:${project.id}`, payloadHash);
            if (check.isExisting) {
                if (check.conflict) {
                    return res.status(409).json({ error: 'Idempotency key collision with differing command parameters' });
                }
                // Re-verify authorization before replay
                if (!projectPolicyService.canEditProject(req.user, project)) {
                    return error(res, 403, 'ACCESS_DENIED_PROJECT', 'Access Denied: You are not authorized to edit this project.');
                }
                return res.json(check.receipt.parsedOutcome);
            }
        }

        const expectedRevision = req.headers['if-match'] || req.headers['x-expected-revision'] || updates.expectedRevision || updates.expectedUpdatedAt;

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

        // Atomic Project Update, Closure Validation, Audit and Command Receipt Transaction (PM-08, P11, C01)
        const updated = await prisma.$transaction(async (tx) => {
            const currentProject = await tx.project.findUnique({
                where: { id: project.id }
            });
            if (!currentProject) {
                const notFound = new Error('Project not found');
                notFound.statusCode = 404;
                throw notFound;
            }

            // Validate expected revision inside transaction to prevent stale race conditions
            if (expectedRevision) {
                const projUpdatedIso = currentProject.updatedAt ? new Date(currentProject.updatedAt).toISOString() : null;
                const projUpdatedMs = currentProject.updatedAt ? new Date(currentProject.updatedAt).getTime().toString() : null;
                const matches = expectedRevision === projUpdatedIso || expectedRevision === projUpdatedMs || expectedRevision === `"${projUpdatedIso}"`;
                if (!matches) {
                    const staleErr = new Error('Project has been modified by another concurrent operation. Please refresh before saving.');
                    staleErr.statusCode = 409;
                    staleErr.code = 'STALE_REVISION';
                    throw staleErr;
                }
            }

            if (updates.status !== undefined && ['COMPLETED', 'ARCHIVED', 'CLOSED'].includes(updates.status)) {
                await validateProjectClosure(currentProject, tx);
            }

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

            if (idempotencyKey) {
                await commandReceiptService.recordReceipt(tx, {
                    idempotencyKey,
                    commandType: 'PROJECT_UPDATE',
                    targetResource: `Project:${project.id}`,
                    actor: req.user.username,
                    status: 'SUCCESS',
                    outcome: { ...proj, payloadHash }
                });
            }

            return proj;
        });

        // KOBO CONFIG UPDATE
        const effectiveProjectType = updates.projectType || project.projectType;
        if (['SUPER_ADMIN', 'MASTER_USER', 'ADMIN', 'LAB_MANAGER'].includes(req.user.role) && effectiveProjectType === 'KOBO_LINKED') {
            const { koboServerUrl, koboFormId, koboApiToken, koboConfigId, destinationLabId, koboLabId } = updates;
            if (koboServerUrl || koboFormId || koboApiToken) {
                try {
                    let existingConfig = null;
                    if (koboConfigId) {
                        existingConfig = await prisma.koboConfig.findUnique({ where: { id: koboConfigId } });
                    }
                    if (!existingConfig) {
                        const targetLab = destinationLabId || koboLabId || (req.user.role === 'LAB_MANAGER' ? req.user.labId : project.labId);
                        if (targetLab) {
                            existingConfig = await prisma.koboConfig.findFirst({
                                where: { projectCode: project.code, labId: targetLab }
                            });
                        }
                    }

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
                        const targetLabId = destinationLabId || koboLabId || project.labId || req.user.labId;
                        if (targetLabId) {
                            await prisma.koboConfig.create({
                                data: {
                                    id: `kobo-cfg-${Date.now()}`,
                                    labId: targetLabId,
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
        if (err.statusCode === 409 || err.code === 'STALE_REVISION') {
            return res.status(409).json({
                error: 'STALE_REVISION',
                code: 'STALE_REVISION',
                message: err.message
            });
        }
        if (err.statusCode === 422 || err.code === 'CANNOT_CLOSE_PROJECT' || err.code === 'CANNOT_ARCHIVE_WITH_EXPECTED_SAMPLES' || err.code === 'CANNOT_ARCHIVE_WITH_ACTIVE_WORK') {
            return res.status(err.statusCode || 422).json({
                error: err.code || 'CANNOT_CLOSE_PROJECT',
                message: err.message
            });
        }
        console.error('[updateProject] Error:', err);
        return error(res, 500, 'PROJECT_UPDATE_ERROR', err.message);
    }
};

exports.uploadManifest = async (req, res) => {
    const { id } = req.params;
    const { sampleIds, previewHash, previewToken, targetLabId: requestedLabId, idempotencyKey: bodyIdempKey } = req.body || {};

    if (!Array.isArray(sampleIds) || sampleIds.length === 0) {
        return res.status(400).json({ error: 'Valid sample ID list required' });
    }

    try {
        const project = await prisma.project.findFirst({
            where: { OR: [{ id: String(id) }, { code: String(id) }] }
        });
        if (!project) return res.status(404).json({ error: 'Project not found' });
        const uniqueSampleIds = [...new Set(sampleIds.map(s => String(s).trim()))];
        const targetLabId = requestedLabId || req.user.labId || project.labId;

        // User authorization for project
        if (!projectPolicyService.canImportProjectSamples(req.user, project)) {
            return error(res, 403, 'ACCESS_DENIED_PROJECT', 'Access Denied: You are not authorized to import samples for this project.');
        }

        // Preview token / hash validation (C02)
        const crypto = require('crypto');
        const tokenInput = previewToken || req.headers['x-preview-token'];
        const hashInput = previewHash || req.headers['x-preview-hash'];
        let tokenData = null;

        if (tokenInput) {
            try {
                tokenData = JSON.parse(Buffer.from(tokenInput, 'base64').toString('utf8'));
            } catch {
                return res.status(409).json({ error: 'PREVIEW_TOKEN_INVALID', message: 'Invalid preview token format.' });
            }
            const secret = process.env.JWT_SECRET || 'soilfer-secret-key';
            const { signature, ...payloadToSign } = tokenData;
            const expectedSig = crypto.createHmac('sha256', secret).update(JSON.stringify(payloadToSign)).digest('hex');
            if (signature !== expectedSig) {
                return res.status(409).json({ error: 'PREVIEW_TOKEN_TAMPERED', message: 'Preview token signature mismatch.' });
            }
            if (Date.now() > tokenData.expiresAt) {
                return res.status(409).json({ error: 'PREVIEW_EXPIRED', message: 'Preview token has expired. Please regenerate preview.' });
            }
            if (tokenData.projectId && tokenData.projectId !== project.id) {
                return res.status(409).json({ error: 'PREVIEW_PROJECT_MISMATCH', message: 'Preview token belongs to a different project.' });
            }
            if (tokenData.destinationLabId && tokenData.destinationLabId !== targetLabId) {
                return res.status(409).json({ error: 'PREVIEW_DESTINATION_MISMATCH', message: 'Target laboratory does not match preview destination.' });
            }
            if (tokenData.actor && tokenData.actor !== req.user.username) {
                return res.status(403).json({ error: 'PREVIEW_ACTOR_MISMATCH', message: 'Preview token was created by a different actor.' });
            }
            const computedIdsHash = crypto.createHash('sha256').update(JSON.stringify(uniqueSampleIds)).digest('hex');
            if (tokenData.sampleIdsHash !== computedIdsHash) {
                return res.status(409).json({ error: 'PREVIEW_HASH_MISMATCH', message: 'Manifest sample IDs do not match the preview token.' });
            }
        } else if (hashInput) {
            const computedHash = crypto.createHash('sha256').update(JSON.stringify(uniqueSampleIds)).digest('hex');
            const rawHash = crypto.createHash('sha256').update(JSON.stringify(sampleIds.map(s => String(s).trim()))).digest('hex');
            if (hashInput !== computedHash && hashInput !== rawHash) {
                return res.status(409).json({
                    error: 'PREVIEW_HASH_MISMATCH',
                    message: 'Manifest sample IDs do not match the preview hash. Preview may be expired, modified, or out of sequence.'
                });
            }
        }

        // Validate destination laboratory
        if (!targetLabId) {
            return res.status(400).json({ error: 'TARGET_LAB_REQUIRED', message: 'No target laboratory could be resolved for manifest import.' });
        }

        const destLab = await prisma.lab.findUnique({ where: { id: targetLabId } });
        if (!destLab || !destLab.isActive) {
            return res.status(400).json({ error: 'INVALID_DESTINATION_LAB', message: `Destination laboratory '${targetLabId}' does not exist or is inactive.` });
        }

        if (!projectPolicyService.canImportProjectSamples(req.user, project, targetLabId)) {
            return error(res, 403, 'ACCESS_DENIED_PROJECT', 'Access Denied: You are not authorized to import samples for this project.');
        }

        // Admissions status check (F08: Centralized lifecycle admission check)
        const hasException = Boolean(req.body.hasException || req.body.exceptionRecord || req.body.exceptionReason);
        const exceptionRecord = req.body.exceptionRecord || (req.body.exceptionReason ? {
            reason: req.body.exceptionReason,
            approvalToken: req.body.approvalToken || null
        } : null);

        const admission = projectPolicyService.canAdmitSample({
            project,
            channel: 'MANIFEST',
            actor: req.user,
            labId: targetLabId,
            hasException,
            exceptionRecord
        });
        if (!admission.allowed) {
            return res.status(422).json({
                error: admission.code || 'PROJECT_ADMISSIONS_PAUSED',
                message: admission.reason || `Cannot register or import samples into project '${project.code}'. Admissions are paused.`,
                exceptionRequired: Boolean(admission.exceptionRequired)
            });
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

        // Idempotency check
        const idempotencyKey = bodyIdempKey || req.headers['x-idempotency-key'];
        const payloadHash = commandReceiptService.computePayloadHash({ sampleIds: uniqueSampleIds, targetLabId });
        if (idempotencyKey) {
            const check = await commandReceiptService.checkReceipt(idempotencyKey, 'PROJECT_MANIFEST_UPLOAD', req.user.username, `Project:${project.id}`, payloadHash);
            if (check.isExisting) {
                if (check.conflict) {
                    return res.status(409).json({ error: 'Idempotency key collision with differing command parameters' });
                }
                return res.json(check.receipt.parsedOutcome);
            }
        }

        const expectedRevision = req.headers['if-match'] || req.headers['x-expected-revision'] || req.body?.expectedRevision;

        // Check for duplicates within this batch and against existing db
        const existing = await prisma.sample.findMany({
            where: {
                OR: [
                    { id: { in: uniqueSampleIds } },
                    { originalId: { in: uniqueSampleIds } }
                ]
            },
            select: { id: true, originalId: true, projectId: true, projectCode: true }
        });

        // CROSS-PROJECT VALIDATION
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

        const outcome = {
            messageCode: 'MANIFEST_PROCESSED',
            messageParams: null,
            message: `Successfully processed ${uniqueSampleIds.length} IDs.`,
            data: { count: newIds.length, skipped: skippedCount },
            requestSampleIds: uniqueSampleIds,
            payloadHash
        };

        await prisma.$transaction(async (tx) => {
            const currentProj = await tx.project.findUnique({ where: { id: project.id } });
            if (expectedRevision) {
                const projUpdatedIso = currentProj.updatedAt ? new Date(currentProj.updatedAt).toISOString() : null;
                const projUpdatedMs = currentProj.updatedAt ? new Date(currentProj.updatedAt).getTime().toString() : null;
                const matches = expectedRevision === projUpdatedIso || expectedRevision === projUpdatedMs || expectedRevision === `"${projUpdatedIso}"`;
                if (!matches) {
                    const staleErr = new Error('Project has been modified by another concurrent operation. Please refresh before saving.');
                    staleErr.statusCode = 409;
                    staleErr.code = 'STALE_REVISION';
                    throw staleErr;
                }
            }

            // Signed preview token revision check (C02): tokenData.projectRevision must match current revision
            if (tokenData && tokenData.projectRevision) {
                const projUpdatedIso = currentProj.updatedAt ? new Date(currentProj.updatedAt).toISOString() : null;
                const projUpdatedMs = currentProj.updatedAt ? new Date(currentProj.updatedAt).getTime().toString() : null;
                const tokenMatches = tokenData.projectRevision === projUpdatedIso || tokenData.projectRevision === projUpdatedMs || tokenData.projectRevision === `"${projUpdatedIso}"`;
                if (!tokenMatches) {
                    const staleErr = new Error('Preview token is based on an obsolete project revision. Please regenerate preview.');
                    staleErr.statusCode = 409;
                    staleErr.code = 'PREVIEW_STALE_REVISION';
                    throw staleErr;
                }
            }

            if (newIds.length > 0) {
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
            }

            if (project.status === 'PENDING_MANIFEST') {
                await tx.project.update({
                    where: { id: project.id },
                    data: { status: 'ACTIVE' }
                });
            }

            const auditData = {
                id: `audit-man-${Date.now()}`,
                entity: 'PROJECT',
                entityId: project.id,
                action: 'MANIFEST_UPLOAD',
                details: `Uploaded ${newIds.length} new samples. ${skippedCount} items already in project were skipped.`,
                performedBy: req.user.username,
                timestamp: new Date()
            };

            if (prisma.auditLog && prisma.auditLog.create !== defaultAuditCreate) {
                await prisma.auditLog.create({ data: auditData });
            } else {
                await tx.auditLog.create({ data: auditData });
            }

            if (idempotencyKey) {
                await commandReceiptService.recordReceipt(tx, {
                    idempotencyKey,
                    commandType: 'PROJECT_MANIFEST_UPLOAD',
                    targetResource: `Project:${project.id}`,
                    actor: req.user.username,
                    status: 'SUCCESS',
                    outcome
                });
            }
        });

        return res.status(200).json(outcome);
    } catch (err) {
        if (err.statusCode === 409 || err.code === 'STALE_REVISION' || err.code === 'PREVIEW_STALE_REVISION') {
            return res.status(409).json({ error: err.code || 'STALE_REVISION', code: err.code || 'STALE_REVISION', message: err.message });
        }
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

        const destinationLabId = req.body?.targetLabId || req.body?.destinationLabId || req.user.labId || project.labId;
        if (destinationLabId) {
            const destLab = await prisma.lab.findUnique({ where: { id: destinationLabId } });
            if (!destLab || !destLab.isActive) {
                return res.status(400).json({ error: 'INVALID_DESTINATION_LAB', message: `Destination laboratory '${destinationLabId}' is invalid or inactive.` });
            }
        }

        if (!projectPolicyService.canImportProjectSamples(req.user, project, destinationLabId)) {
            return error(res, 403, 'ACCESS_DENIED_PROJECT', 'Access Denied: You are not authorized to import samples for this project.');
        }

        const admission = projectPolicyService.canAdmitSample({
            project,
            channel: 'MANIFEST',
            actor: req.user,
            labId: destinationLabId
        });
        if (!admission.allowed) {
            return res.status(422).json({
                error: admission.code || 'PROJECT_ADMISSIONS_PAUSED',
                message: admission.reason || `Cannot import samples into project '${project.code}'. Admissions are paused.`
            });
        }

        const crypto = require('crypto');
        const errors = [];
        const seenInBatch = new Set();
        const candidateIds = [];

        const VALID_SAMPLE_ID_REGEX = /^[A-Za-z0-9_.-]{1,64}$/;

        rawRows.forEach((row, idx) => {
            const rawId = typeof row === 'string'
                ? row
                : (row?.sampleId || row?.id || row?.originalId || row?.codigo_muestra || row?.muestra || row?.identificador || row?.echantillon || row?.amostra);
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

        const previewHash = validSampleIds.length > 0
            ? crypto.createHash('sha256').update(JSON.stringify(validSampleIds)).digest('hex')
            : null;
        const expiresAt = Date.now() + 15 * 60 * 1000;
        const secret = process.env.JWT_SECRET || 'soilfer-secret-key';
        let previewToken = null;
        if (validSampleIds.length > 0) {
            const tokenPayload = {
                projectId: project.id,
                destinationLabId,
                actor: req.user.username,
                projectRevision: String(project.updatedAt.getTime()),
                sampleIdsHash: previewHash,
                expiresAt
            };
            const signature = crypto.createHmac('sha256', secret).update(JSON.stringify(tokenPayload)).digest('hex');
            previewToken = Buffer.from(JSON.stringify({ ...tokenPayload, signature })).toString('base64');
        }

        return res.json({
            valid: conflicts.length === 0 && errors.length === 0 && validSampleIds.length > 0,
            totalRows: rawRows.length,
            validCount: validSampleIds.length,
            conflictCount: conflicts.length,
            errorCount: errors.length,
            conflicts,
            errors,
            validSampleIds,
            previewHash,
            previewToken,
            destinationLabId,
            expiresAt
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

        const idempotencyKey = req.body?.idempotencyKey || req.headers['x-idempotency-key'];
        const expectedRevision = req.headers['if-match'] || req.headers['x-expected-revision'] || req.body?.expectedRevision;
        const payloadHash = commandReceiptService.computePayloadHash({ reason: req.body?.reason || '' });

        if (idempotencyKey) {
            const check = await commandReceiptService.checkReceipt(idempotencyKey, 'PROJECT_ARCHIVE', req.user.username, `Project:${project.id}`, payloadHash);
            if (check.isExisting) {
                if (check.conflict) {
                    return res.status(409).json({ error: 'Idempotency key collision with differing command parameters' });
                }
                return res.json(check.receipt.parsedOutcome);
            }
        }

        const updated = await prisma.$transaction(async (tx) => {
            const currentProj = await tx.project.findUnique({ where: { id: project.id } });
            if (!currentProj) {
                const notFound = new Error('Project not found');
                notFound.statusCode = 404;
                throw notFound;
            }

            if (expectedRevision) {
                const projUpdatedIso = currentProj.updatedAt ? new Date(currentProj.updatedAt).toISOString() : null;
                const projUpdatedMs = currentProj.updatedAt ? new Date(currentProj.updatedAt).getTime().toString() : null;
                const matches = expectedRevision === projUpdatedIso || expectedRevision === projUpdatedMs || expectedRevision === `"${projUpdatedIso}"`;
                if (!matches) {
                    const staleErr = new Error('Project has been modified by another concurrent operation. Please refresh before saving.');
                    staleErr.statusCode = 409;
                    staleErr.code = 'STALE_REVISION';
                    throw staleErr;
                }
            }

            // Check for unresolved expected samples and active analytical work atomically within transaction
            await validateProjectClosure(currentProj, tx);

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

            const outcomePayload = {
                status: 'success',
                messageCode: 'PROJECT_ARCHIVED',
                message: 'Project archived',
                data: { code: project.code, project: p },
                payloadHash
            };

            if (idempotencyKey) {
                await commandReceiptService.recordReceipt(tx, {
                    idempotencyKey,
                    commandType: 'PROJECT_ARCHIVE',
                    targetResource: `Project:${project.id}`,
                    actor: req.user.username,
                    status: 'SUCCESS',
                    payloadHash,
                    outcome: outcomePayload
                });
            }

            return outcomePayload;
        });

        return res.json(updated);
    } catch (err) {
        if (err.statusCode === 409 || err.code === 'STALE_REVISION') {
            return res.status(409).json({ error: err.code || 'STALE_REVISION', code: 'STALE_REVISION', message: err.message });
        }
        if (err.statusCode === 422 || err.code === 'CANNOT_ARCHIVE_WITH_EXPECTED_SAMPLES' || err.code === 'CANNOT_ARCHIVE_WITH_ACTIVE_WORK') {
            return res.status(err.statusCode || 422).json({
                error: err.code || 'CANNOT_ARCHIVE_PROJECT',
                message: err.message
            });
        }
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

        const stageStatusMap = {
            '0': ['EXPECTED', 'PENDING_MANIFEST', 'COLLECTED'],
            'awaitingArrival': ['EXPECTED', 'PENDING_MANIFEST', 'COLLECTED'],
            '1': ['RECEIVED', 'ACCEPTED', 'DRYING', 'GRINDING', 'PREPARED'],
            'intakeInProgress': ['RECEIVED', 'ACCEPTED', 'DRYING', 'GRINDING', 'PREPARED'],
            '2': ['PROCESSING', 'IN_LAB', 'ANALYSIS_IN_PROGRESS', 'ANALYSIS'],
            'labWork': ['PROCESSING', 'IN_LAB', 'ANALYSIS_IN_PROGRESS', 'ANALYSIS'],
            '3': ['SUBMITTED_FULL', 'SUBMITTED_PARTIAL', 'SUBMITTED'],
            'awaitingReview': ['SUBMITTED_FULL', 'SUBMITTED_PARTIAL', 'SUBMITTED'],
            '4': ['RELEASED', 'APPROVED', 'ARCHIVED'],
            'released': ['RELEASED', 'APPROVED', 'ARCHIVED'],
            '5': ['RECEIVED_REJECTED', 'REJECTED', 'CANCELLED', 'DISPOSED', 'FAILED'],
            'rejectedOrCancelled': ['RECEIVED_REJECTED', 'REJECTED', 'CANCELLED', 'DISPOSED', 'FAILED']
        };

        const extraConditions = [];

        // Search filter across sample ID, originalId, or labId
        if (req.query.q) {
            const q = String(req.query.q).trim();
            if (q) {
                extraConditions.push({
                    OR: [
                        { id: { contains: q } },
                        { originalId: { contains: q } },
                        { labId: { contains: q } }
                    ]
                });
            }
        }

        // Stage filter: supports numeric index ('0'-'5'), named stage key, or direct status
        if (req.query.stage !== undefined && req.query.stage !== '' && req.query.stage !== 'all') {
            const stageKey = String(req.query.stage).trim();
            if (stageStatusMap[stageKey]) {
                extraConditions.push({
                    status: { in: stageStatusMap[stageKey] }
                });
            } else {
                extraConditions.push({
                    status: stageKey
                });
            }
        }

        const effectiveWhere = extraConditions.length > 0
            ? { AND: [sampleWhere, ...extraConditions] }
            : sampleWhere;

        const findOptions = {
            where: effectiveWhere,
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

        const total = await prisma.sample.count({ where: effectiveWhere });
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

        // F02 FIX: Query configurations by projectCode or projectId directly
        const configs = await prisma.koboConfig.findMany({
            where: {
                OR: [
                    { projectCode: project.code },
                    { projectCode: project.id }
                ]
            }
        });

        if (configs.length === 0) {
            return res.json({ configured: false });
        }

        const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(req.user?.role);
        const isOwnerManager = req.user?.role === 'LAB_MANAGER' && project.labId === req.user?.labId;
        const isProjectManager = req.user?.role === 'PROJECT_MANAGER';
        const isNationalAdmin = ['MASTER_USER', 'COUNTRY_ADMIN'].includes(req.user?.role);

        let eligibleConfigs = [];
        if (isAdmin || isOwnerManager) {
            // Admins and Coordinating/Owner Lab Managers have project-wide configuration oversight
            eligibleConfigs = configs;
        } else if (isProjectManager) {
            const userProjects = projectPolicyService.parseArray(req.user?.projects);
            if (userProjects.includes(project.code) || userProjects.includes(project.id)) {
                eligibleConfigs = configs;
            }
        } else if (isNationalAdmin) {
            const actorCountries = projectPolicyService.parseArray(req.user?.countries);
            if (actorCountries.length > 0) {
                const configLabIds = Array.from(new Set(configs.map(c => c.labId).filter(Boolean)));
                const unknownLabIds = configLabIds.filter(lid => !labCountries[lid]);
                if (unknownLabIds.length > 0) {
                    const extraLabs = await prisma.lab.findMany({
                        where: { id: { in: unknownLabIds } },
                        select: { id: true, country: true }
                    });
                    extraLabs.forEach(l => { labCountries[l.id] = l.country; });
                }
                eligibleConfigs = configs.filter(c => labCountries[c.labId] && actorCountries.includes(labCountries[c.labId]));
            }
        } else if (req.user?.labId) {
            // Participating / Servicing laboratory roles are strictly bounded to their own laboratory's configs
            eligibleConfigs = configs.filter(c => c.labId === req.user.labId);
        }

        let config = null;
        const requestedConfigId = req.query?.configId;
        const requestedLabId = req.query?.labId;

        if (requestedConfigId) {
            // An explicit identifier narrows scope, never widens it
            const targetConfig = configs.find(c => c.id === requestedConfigId);
            if (!targetConfig) {
                return res.status(404).json({ error: 'NOT_FOUND', message: 'Specified Kobo configuration not found for this project.' });
            }
            if (!eligibleConfigs.some(c => c.id === requestedConfigId)) {
                return res.status(403).json({ error: 'FORBIDDEN_CONFIG_SCOPE', message: 'Requested Kobo configuration is outside your authorized laboratory scope.' });
            }
            config = targetConfig;
        } else if (requestedLabId) {
            const labExistsInProject = configs.some(c => c.labId === requestedLabId);
            if (!labExistsInProject) {
                return res.status(404).json({ error: 'NOT_FOUND', message: 'No configuration found for the specified laboratory.' });
            }
            const matchingLabConfigs = eligibleConfigs.filter(c => c.labId === requestedLabId);
            if (matchingLabConfigs.length === 0) {
                return res.status(403).json({ error: 'FORBIDDEN_LAB_SCOPE', message: 'Specified laboratory is outside your authorized scope.' });
            }
            if (matchingLabConfigs.length === 1) {
                config = matchingLabConfigs[0];
            } else {
                return res.json({
                    configured: false,
                    ambiguous: true,
                    configs: matchingLabConfigs.map(c => ({
                        configId: c.id,
                        labId: c.labId,
                        labName: c.labName,
                        formId: c.formId,
                        koboFormId: c.formId,
                        isActive: c.isActive,
                        status: c.isActive ? 'ACTIVE' : 'DISABLED',
                        lastSyncAt: c.lastSyncAt
                    })),
                    message: 'Multiple configurations exist for the specified laboratory. Explicit configId required.'
                });
            }
        } else {
            // No explicit identifier provided: resolve based on actor's scope
            if (eligibleConfigs.length === 0) {
                return res.json({ configured: false, message: 'No Kobo configuration found for your laboratory scope.' });
            }

            if (req.user?.labId) {
                const ownConfigs = eligibleConfigs.filter(c => c.labId === req.user.labId);
                if (ownConfigs.length === 1) {
                    config = ownConfigs[0];
                } else if (ownConfigs.length > 1) {
                    return res.json({
                        configured: false,
                        ambiguous: true,
                        configs: ownConfigs.map(c => ({
                            configId: c.id,
                            labId: c.labId,
                            labName: c.labName,
                            formId: c.formId,
                            koboFormId: c.formId,
                            isActive: c.isActive,
                            status: c.isActive ? 'ACTIVE' : 'DISABLED',
                            lastSyncAt: c.lastSyncAt
                        })),
                        message: 'Multiple active Kobo configurations exist for your laboratory in this project. Explicit configId required.'
                    });
                } else if (isOwnerManager || isAdmin) {
                    const ownerConfigs = eligibleConfigs.filter(c => c.labId === project.labId);
                    if (ownerConfigs.length === 1) {
                        config = ownerConfigs[0];
                    } else if (ownerConfigs.length > 1) {
                        return res.json({
                            configured: false,
                            ambiguous: true,
                            configs: ownerConfigs.map(c => ({
                                configId: c.id,
                                labId: c.labId,
                                labName: c.labName,
                                formId: c.formId,
                                koboFormId: c.formId,
                                isActive: c.isActive,
                                status: c.isActive ? 'ACTIVE' : 'DISABLED',
                                lastSyncAt: c.lastSyncAt
                            })),
                            message: 'Multiple configurations exist for the coordinating laboratory. Explicit configId required.'
                        });
                    } else {
                        return res.json({ configured: false, message: 'No Kobo configuration found for your laboratory scope.' });
                    }
                } else {
                    return res.json({ configured: false, message: 'No Kobo configuration found for your laboratory scope.' });
                }
            } else {
                // Actor without specific labId (e.g. global admin or country admin)
                if (eligibleConfigs.length === 1) {
                    config = eligibleConfigs[0];
                } else {
                    return res.json({
                        configured: false,
                        ambiguous: true,
                        configs: eligibleConfigs.map(c => ({
                            configId: c.id,
                            labId: c.labId,
                            labName: c.labName,
                            formId: c.formId,
                            koboFormId: c.formId,
                            isActive: c.isActive,
                            status: c.isActive ? 'ACTIVE' : 'DISABLED',
                            lastSyncAt: c.lastSyncAt
                        })),
                        message: 'Multiple Kobo configurations exist for this project across participating laboratories. Explicit labId or configId required.'
                    });
                }
            }
        }

        if (!config) {
            return res.json({ configured: false });
        }

        // Redact credentials: never return stored secrets or tokens in responses (LG-13, P28)
        // F06 FIX: Return both formId and koboFormId, destination labId and labName, configId and status
        res.json({
            configured: true,
            koboServerUrl: config.koboServerUrl,
            koboFormId: config.formId,
            formId: config.formId,
            labId: config.labId,
            labName: config.labName,
            configId: config.id,
            isActive: config.isActive,
            status: config.isActive ? 'ACTIVE' : 'DISABLED',
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
        const { servicingLabIds, reason, idempotencyKey: bodyKey, expectedRevision: bodyRev } = req.body || {};
        const idempotencyKey = bodyKey || req.headers['x-idempotency-key'];
        const expectedRevision = req.headers['if-match'] || req.headers['x-expected-revision'] || bodyRev;
        const result = await projectMembershipService.updateProjectLabAccess(req.user, req.params.id, {
            servicingLabIds,
            reason,
            idempotencyKey,
            expectedRevision
        });
        res.json(result);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message, message: err.message, code: err.code, details: err.details });
    }
};

exports.getProjectOperationReceipt = async (req, res) => {
    const { id, key } = req.params;
    try {
        const project = await prisma.project.findFirst({
            where: { OR: [{ id: String(id) }, { code: String(id) }] }
        });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        if (!projectPolicyService.canReadProject(req.user, project)) {
            return error(res, 403, 'ACCESS_DENIED_PROJECT', 'Access Denied: You are not authorized to view this project.');
        }

        const receipt = await prisma.commandReceipt.findUnique({
            where: { idempotencyKey: String(key) }
        });

        if (!receipt || (receipt.targetResource !== `Project:${project.id}` && receipt.targetResource !== `Project:${project.code}`)) {
            return res.status(404).json({
                error: 'RECEIPT_NOT_FOUND',
                message: `No operation receipt found for key '${key}' on project '${project.code}'.`
            });
        }

        const isPrivileged = ['SUPER_ADMIN', 'MASTER_USER', 'ADMIN', 'LAB_MANAGER', 'COUNTRY_ADMIN'].includes(req.user.role);
        if (receipt.actor !== req.user.username && !isPrivileged) {
            return res.status(403).json({ error: 'FORBIDDEN', message: 'You are not authorized to view this operation receipt.' });
        }

        return res.json({
            status: 'success',
            receipt: {
                idempotencyKey: receipt.idempotencyKey,
                commandType: receipt.commandType,
                targetResource: receipt.targetResource,
                actor: receipt.actor,
                status: receipt.status,
                createdAt: receipt.createdAt,
                outcome: receipt.outcome ? JSON.parse(receipt.outcome) : null
            }
        });
    } catch (err) {
        console.error('[getProjectOperationReceipt] Error:', err);
        return error(res, 500, 'RECEIPT_FETCH_ERROR', 'Failed to retrieve operation receipt');
    }
};

exports.listProjectKoboConnections = async (req, res) => {
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
            return res.status(403).json({ error: 'Access denied: Project belongs to another laboratory scope' });
        }

        const configs = await prisma.koboConfig.findMany({
            where: {
                OR: [
                    { projectCode: project.code },
                    { projectCode: project.id }
                ]
            }
        });

        const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(req.user?.role);
        const isOwnerManager = req.user?.role === 'LAB_MANAGER' && project.labId === req.user?.labId;
        const isProjectManager = req.user?.role === 'PROJECT_MANAGER';
        const isNationalAdmin = ['MASTER_USER', 'COUNTRY_ADMIN'].includes(req.user?.role);

        let eligibleConfigs = [];
        if (isAdmin || isOwnerManager) {
            eligibleConfigs = configs;
        } else if (isProjectManager) {
            const userProjects = projectPolicyService.parseArray(req.user?.projects);
            if (userProjects.includes(project.code) || userProjects.includes(project.id)) {
                eligibleConfigs = configs;
            }
        } else if (isNationalAdmin) {
            const actorCountries = projectPolicyService.parseArray(req.user?.countries);
            eligibleConfigs = configs.filter(c => labCountries[c.labId] && actorCountries.includes(labCountries[c.labId]));
        } else if (req.user?.labId) {
            eligibleConfigs = configs.filter(c => c.labId === req.user.labId);
        }

        return res.json({
            projectCode: project.code,
            connections: eligibleConfigs.map(c => ({
                id: c.id,
                configId: c.id,
                labId: c.labId,
                labName: c.labName,
                formId: c.formId,
                koboFormId: c.formId,
                koboServerUrl: c.koboServerUrl,
                isActive: c.isActive,
                status: c.isActive ? 'ACTIVE' : 'DISABLED',
                lastSyncAt: c.lastSyncAt
            }))
        });
    } catch (err) {
        console.error('[listProjectKoboConnections] Error:', err);
        res.status(500).json({ error: 'Failed to list project Kobo connections' });
    }
};

exports.createProjectKoboConnection = async (req, res) => {
    const { id } = req.params;
    const { destinationLabId, labId: reqLabId, formId, apiToken, koboServerUrl = 'https://kf.kobotoolbox.org' } = req.body;

    try {
        const project = await prisma.project.findFirst({
            where: { OR: [{ id: String(id) }, { code: String(id) }] }
        });
        if (!project) return res.status(404).json({ error: 'PROJECT_NOT_FOUND', message: 'Project not found' });

        const targetLabId = destinationLabId || reqLabId || (req.user.role === 'LAB_MANAGER' ? req.user.labId : project.labId);
        if (!targetLabId) {
            return res.status(400).json({ error: 'DESTINATION_LAB_REQUIRED', message: 'Destination laboratory is required.' });
        }

        if (!formId || !apiToken) {
            return res.status(400).json({ error: 'FORM_AND_TOKEN_REQUIRED', message: 'Form ID and API Token are required.' });
        }

        const { allMemberLabIds } = await projectMembershipService.resolveProjectLabs(project);
        if (!allMemberLabIds.includes(targetLabId)) {
            return res.status(400).json({
                error: 'LAB_NOT_PROJECT_MEMBER',
                message: `Laboratory '${targetLabId}' is not an authorized servicing laboratory for project '${project.code}'.`
            });
        }

        // Scope check: SUPER_ADMIN, ADMIN, or owner LAB_MANAGER can manage all; servicing LAB_MANAGER only within their own lab
        const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
        const isOwnerManager = req.user.role === 'LAB_MANAGER' && project.labId === req.user.labId;
        const isTargetLabManager = req.user.role === 'LAB_MANAGER' && req.user.labId === targetLabId;
        if (!isAdmin && !isOwnerManager && !isTargetLabManager) {
            return res.status(403).json({
                error: 'FORBIDDEN_CONNECTION_SCOPE',
                message: 'You can only manage Kobo connections for your own laboratory.'
            });
        }

        const destLab = await prisma.lab.findFirst({
            where: { OR: [{ id: targetLabId }, { code: targetLabId }] }
        });
        if (!destLab || !destLab.isActive) {
            return res.status(400).json({ error: 'INVALID_DESTINATION_LAB', message: `Destination laboratory '${targetLabId}' is inactive or does not exist.` });
        }

        const koboService = require('../services/koboService');
        let isConnectionVerified = true;
        let warning = null;
        try {
            const testResult = await koboService.testConnection(koboServerUrl, formId, apiToken);
            if (testResult && testResult.success === false) {
                isConnectionVerified = false;
                warning = `Kobo connection saved as unverified: ${testResult.message || testResult.error || 'Failed remote form verification'}`;
            }
        } catch (testErr) {
            isConnectionVerified = false;
            warning = `Kobo connection saved as unverified: ${testErr.message}`;
        }

        const config = await prisma.koboConfig.create({
            data: {
                id: `kobo-cfg-${Date.now()}`,
                labId: targetLabId,
                labName: destLab.name || project.name,
                projectCode: project.code,
                koboServerUrl,
                formId,
                apiToken,
                isActive: isConnectionVerified
            }
        });

        await prisma.auditLog.create({
            data: {
                id: `audit-kobo-create-${Date.now()}`,
                entity: 'KOBO_CONFIG',
                entityId: config.id,
                action: 'KOBO_CONNECTION_CREATED',
                details: `Created Kobo connection for project ${project.code} to lab ${targetLabId} (form: ${formId})`,
                performedBy: req.user.username,
                timestamp: new Date()
            }
        });

        return res.status(201).json({
            id: config.id,
            configId: config.id,
            labId: config.labId,
            projectCode: config.projectCode,
            formId: config.formId,
            koboServerUrl: config.koboServerUrl,
            isActive: config.isActive,
            warning
        });
    } catch (err) {
        console.error('[createProjectKoboConnection] Error:', err);
        return res.status(500).json({ error: 'Failed to create Kobo connection: ' + err.message });
    }
};

exports.updateProjectKoboConnection = async (req, res) => {
    const { id, configId } = req.params;
    const { formId, apiToken, koboServerUrl, isActive } = req.body;

    try {
        const project = await prisma.project.findFirst({
            where: { OR: [{ id: String(id) }, { code: String(id) }] }
        });
        if (!project) return res.status(404).json({ error: 'PROJECT_NOT_FOUND', message: 'Project not found' });

        const config = await prisma.koboConfig.findUnique({ where: { id: configId } });
        if (!config || (config.projectCode !== project.code && config.projectCode !== project.id)) {
            return res.status(404).json({ error: 'CONFIG_NOT_FOUND', message: 'Kobo configuration not found for this project.' });
        }

        const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
        const isOwnerManager = req.user.role === 'LAB_MANAGER' && project.labId === req.user.labId;
        const isTargetLabManager = req.user.role === 'LAB_MANAGER' && req.user.labId === config.labId;
        if (!isAdmin && !isOwnerManager && !isTargetLabManager) {
            return res.status(403).json({
                error: 'FORBIDDEN_CONNECTION_SCOPE',
                message: 'You can only update Kobo connections for your own laboratory.'
            });
        }

        const data = {};
        if (formId) data.formId = formId;
        if (apiToken) data.apiToken = apiToken;
        if (koboServerUrl) data.koboServerUrl = koboServerUrl;
        if (isActive !== undefined) data.isActive = Boolean(isActive);

        const updated = await prisma.koboConfig.update({
            where: { id: configId },
            data
        });

        await prisma.auditLog.create({
            data: {
                id: `audit-kobo-update-${Date.now()}`,
                entity: 'KOBO_CONFIG',
                entityId: config.id,
                action: 'KOBO_CONNECTION_UPDATED',
                details: `Updated Kobo connection ${configId} for project ${project.code}`,
                performedBy: req.user.username,
                timestamp: new Date()
            }
        });

        return res.json({
            id: updated.id,
            configId: updated.id,
            labId: updated.labId,
            projectCode: updated.projectCode,
            formId: updated.formId,
            koboServerUrl: updated.koboServerUrl,
            isActive: updated.isActive
        });
    } catch (err) {
        console.error('[updateProjectKoboConnection] Error:', err);
        return res.status(500).json({ error: 'Failed to update Kobo connection: ' + err.message });
    }
};

exports.toggleProjectKoboConnection = async (req, res) => {
    const { id, configId } = req.params;

    try {
        const project = await prisma.project.findFirst({
            where: { OR: [{ id: String(id) }, { code: String(id) }] }
        });
        if (!project) return res.status(404).json({ error: 'PROJECT_NOT_FOUND', message: 'Project not found' });

        const config = await prisma.koboConfig.findUnique({ where: { id: configId } });
        if (!config || (config.projectCode !== project.code && config.projectCode !== project.id)) {
            return res.status(404).json({ error: 'CONFIG_NOT_FOUND', message: 'Kobo configuration not found for this project.' });
        }

        const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
        const isOwnerManager = req.user.role === 'LAB_MANAGER' && project.labId === req.user.labId;
        const isTargetLabManager = req.user.role === 'LAB_MANAGER' && req.user.labId === config.labId;
        if (!isAdmin && !isOwnerManager && !isTargetLabManager) {
            return res.status(403).json({
                error: 'FORBIDDEN_CONNECTION_SCOPE',
                message: 'You can only toggle Kobo connections for your own laboratory.'
            });
        }

        const updated = await prisma.koboConfig.update({
            where: { id: configId },
            data: { isActive: !config.isActive }
        });

        await prisma.auditLog.create({
            data: {
                id: `audit-kobo-toggle-${Date.now()}`,
                entity: 'KOBO_CONFIG',
                entityId: config.id,
                action: 'KOBO_CONNECTION_TOGGLED',
                details: `Toggled Kobo connection ${configId} for project ${project.code} to ${updated.isActive ? 'ACTIVE' : 'DISABLED'}`,
                performedBy: req.user.username,
                timestamp: new Date()
            }
        });

        return res.json({
            id: updated.id,
            configId: updated.id,
            labId: updated.labId,
            projectCode: updated.projectCode,
            formId: updated.formId,
            isActive: updated.isActive
        });
    } catch (err) {
        console.error('[toggleProjectKoboConnection] Error:', err);
        return res.status(500).json({ error: 'Failed to toggle Kobo connection: ' + err.message });
    }
};

exports.syncProjectKoboConnection = async (req, res) => {
    const { id, configId } = req.params;

    try {
        const project = await prisma.project.findFirst({
            where: { OR: [{ id: String(id) }, { code: String(id) }] }
        });
        if (!project) return res.status(404).json({ error: 'PROJECT_NOT_FOUND', message: 'Project not found' });

        const config = await prisma.koboConfig.findUnique({ where: { id: configId } });
        if (!config || (config.projectCode !== project.code && config.projectCode !== project.id)) {
            return res.status(404).json({ error: 'CONFIG_NOT_FOUND', message: 'Kobo configuration not found for this project.' });
        }

        const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
        const isOwnerManager = req.user.role === 'LAB_MANAGER' && project.labId === req.user.labId;
        const isTargetLabManager = req.user.role === 'LAB_MANAGER' && req.user.labId === config.labId;
        if (!isAdmin && !isOwnerManager && !isTargetLabManager) {
            return res.status(403).json({
                error: 'FORBIDDEN_CONNECTION_SCOPE',
                message: 'You can only trigger sync for your own laboratory connection.'
            });
        }

        const koboController = require('./koboController');
        const syncResult = await koboController._syncLabSubmissions(config, req.user.username);

        return res.json({
            success: true,
            configId: config.id,
            ...syncResult
        });
    } catch (err) {
        console.error('[syncProjectKoboConnection] Error:', err);
        return res.status(500).json({ error: 'Failed to sync Kobo connection: ' + err.message });
    }
};
