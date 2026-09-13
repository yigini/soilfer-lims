'use strict';

const prisma = require('../prisma');
const projectPolicyService = require('./projectPolicyService');
const defaultAuditCreate = prisma.auditLog?.create;

/**
 * Project-to-Lab Canonical Membership Resolver
 *
 * Reconciles the four historical representations of project-to-lab membership:
 * 1. Project.labId (Primary / Owner laboratory)
 * 2. ProjectLab junction table (Many-to-many service relations)
 * 3. Project.assignedLabIds (Legacy JSON array of lab IDs)
 * 4. Project.countries (Legacy JSON array of country names)
 */

/**
 * Resolves all participating laboratories for a project.
 *
 * @param {object} project - The project record (with code, id, labId, assignedLabIds, countries)
 * @param {object} [tx=prisma] - Optional Prisma client or transaction
 * @returns {Promise<{ ownerLabId: string|null, servicingLabIds: string[], allMemberLabIds: string[], isOwner: Function, isServicing: Function, isMember: Function }>}
 */
async function resolveProjectLabs(project, tx = prisma) {
    if (!project) {
        return {
            ownerLabId: null,
            servicingLabIds: [],
            allMemberLabIds: [],
            isOwner: () => false,
            isServicing: () => false,
            isMember: () => false
        };
    }

    const ownerLabId = project.labId || null;
    const servicingSet = new Set();

    // 1. Primary resolution: ProjectLab junction table
    const projectCode = project.code;
    if (projectCode) {
        const junctions = await tx.projectLab.findMany({
            where: { projectCode },
            select: { labId: true, role: true }
        });
        for (const j of junctions) {
            if (j.labId) servicingSet.add(j.labId);
        }
    }

    // 2. Secondary resolution: assignedLabIds JSON array
    if (servicingSet.size === 0 && project.assignedLabIds !== null && project.assignedLabIds !== undefined) {
        try {
            const parsed = typeof project.assignedLabIds === 'string'
                ? JSON.parse(project.assignedLabIds)
                : project.assignedLabIds;
            if (Array.isArray(parsed)) {
                for (const lid of parsed) {
                    if (lid && typeof lid === 'string') servicingSet.add(lid);
                }
            }
        } catch (e) {}
    }

    const servicingLabIds = Array.from(servicingSet);
    const allMemberSet = new Set(servicingLabIds);
    if (ownerLabId) allMemberSet.add(ownerLabId);
    const allMemberLabIds = Array.from(allMemberSet);

    return {
        ownerLabId,
        servicingLabIds,
        allMemberLabIds,
        isOwner: (labId) => Boolean(ownerLabId && ownerLabId === labId),
        isServicing: (labId) => servicingSet.has(labId),
        isMember: (labId) => Boolean(ownerLabId === labId || servicingSet.has(labId))
    };
}

/**
 * Builds a read-only discrepancy report across all projects in the database.
 * Identifies projects where ProjectLab, assignedLabIds, and labId are out of sync.
 *
 * @param {object} [tx=prisma]
 * @returns {Promise<{ scannedProjects: number, discrepancyCount: number, discrepancies: Array }>}
 */
async function getDiscrepancyReport(tx = prisma) {
    const projects = await tx.project.findMany({
        select: {
            id: true,
            code: true,
            name: true,
            labId: true,
            assignedLabIds: true,
            countries: true
        }
    });

    const discrepancies = [];

    for (const p of projects) {
        const issues = [];

        const junctions = await tx.projectLab.findMany({
            where: { projectCode: p.code },
            select: { labId: true, role: true }
        });
        const junctionLabIds = junctions.map(j => j.labId);

        let assignedLabs = [];
        if (p.assignedLabIds) {
            try {
                assignedLabs = typeof p.assignedLabIds === 'string' ? JSON.parse(p.assignedLabIds) : p.assignedLabIds;
            } catch (e) {
                issues.push({ type: 'MALFORMED_ASSIGNED_LABS_JSON', detail: 'Invalid JSON in assignedLabIds' });
            }
        }

        // Check if assignedLabIds has entries not in ProjectLab
        if (Array.isArray(assignedLabs)) {
            const missingInJunction = assignedLabs.filter(l => !junctionLabIds.includes(l));
            if (missingInJunction.length > 0) {
                issues.push({
                    type: 'LEGACY_ASSIGNED_NOT_IN_JUNCTION',
                    labs: missingInJunction,
                    detail: `Labs ${missingInJunction.join(', ')} present in assignedLabIds but missing from ProjectLab table`
                });
            }
        }

        // Check if owner labId is missing from ProjectLab
        if (p.labId && junctionLabIds.length > 0 && !junctionLabIds.includes(p.labId)) {
            issues.push({
                type: 'OWNER_LAB_NOT_IN_JUNCTION',
                ownerLabId: p.labId,
                detail: `Primary owner lab '${p.labId}' is not registered in ProjectLab junction`
            });
        }

        if (issues.length > 0) {
            discrepancies.push({
                projectId: p.id,
                projectCode: p.code,
                name: p.name,
                ownerLabId: p.labId,
                junctionLabIds,
                assignedLabIds: assignedLabs,
                issues
            });
        }
    }

    return {
        scannedProjects: projects.length,
        discrepancyCount: discrepancies.length,
        discrepancies
    };
}

/**
 * Checks whether an actor can manage a given project.
 *
 * Rules:
 * - SUPER_ADMIN can manage any project.
 * - LAB_MANAGER can only manage if their lab is the primary owner (project.labId === actor.labId).
 * - Servicing/assigned labs cannot manage global project metadata, archive or delete.
 *
 * @param {object} actor - Authenticated user
 * @param {object} project - Project entity
 * @returns {boolean}
 */
function canManageProject(actor, project) {
    if (!actor || actor.isActive === false || !project) return false;
    if (actor.role === 'SUPER_ADMIN' || actor.role === 'ADMIN') return true;

    if (actor.role === 'LAB_MANAGER') {
        if (!actor.labId) return false;
        return project.labId === actor.labId;
    }

    if (actor.role === 'PROJECT_MANAGER') {
        const userProjects = projectPolicyService.parseArray(actor.projects);
        return userProjects.includes(project.code) || userProjects.includes(project.id);
    }

    return false;
}


/**
 * Reads canonical project lab membership and servicing relationships.
 */
async function getProjectLabAccess(actor, projectId, tx = prisma) {
    const project = await tx.project.findUnique({
        where: { id: projectId }
    });
    if (!project) {
        const err = new Error('Project not found');
        err.statusCode = 404;
        err.code = 'PROJECT_NOT_FOUND';
        throw err;
    }

    const { ownerLabId, servicingLabIds, allMemberLabIds } = await resolveProjectLabs(project, tx);

    // Fetch details for member labs
    const memberLabs = await tx.lab.findMany({
        where: { id: { in: allMemberLabIds } },
        select: { id: true, code: true, name: true, country: true, isActive: true }
    });

    const labCountries = {};
    for (const ml of memberLabs) {
        labCountries[ml.id] = ml.country;
    }

    if (!projectPolicyService.canReadProject(actor, project, { memberLabIds: allMemberLabIds, labCountries })) {
        const err = new Error('Access denied: You do not have permission to view this project.');
        err.statusCode = 403;
        err.code = 'PROJECT_ACCESS_DENIED';
        throw err;
    }

    return {
        projectId: project.id,
        projectCode: project.code,
        name: project.name,
        ownerLabId,
        servicingLabIds,
        memberLabs,
        canManage: canManageProject(actor, project)
    };
}

/**
 * Updates project servicing laboratories with safety and discrepancy repair.
 */
async function updateProjectLabAccess(actor, projectId, { servicingLabIds, reason }, tx = prisma) {
    if (tx === prisma) {
        return await prisma.$transaction(async (innerTx) => {
            return await _executeUpdateProjectLabAccess(actor, projectId, { servicingLabIds, reason }, innerTx);
        });
    }
    return await _executeUpdateProjectLabAccess(actor, projectId, { servicingLabIds, reason }, tx);
}

async function _executeUpdateProjectLabAccess(actor, projectId, { servicingLabIds, reason }, tx) {
    const project = await tx.project.findUnique({
        where: { id: projectId }
    });
    if (!project) {
        const err = new Error('Project not found');
        err.statusCode = 404;
        err.code = 'PROJECT_NOT_FOUND';
        throw err;
    }

    if (!projectPolicyService.canManageProjectAccess(actor, project)) {
        const err = new Error('Only the project owner laboratory manager or Super Administrator may manage servicing laboratories');
        err.statusCode = 403;
        err.code = 'PROJECT_OWNER_REQUIRED';
        throw err;
    }

    if (!Array.isArray(servicingLabIds)) {
        const err = new Error('servicingLabIds must be an array of laboratory IDs');
        err.statusCode = 400;
        err.code = 'VALIDATION_ERROR';
        throw err;
    }

    // Verify all target labs exist and are active
    if (servicingLabIds.length > 0) {
        const existingLabs = await tx.lab.findMany({
            where: { id: { in: servicingLabIds } },
            select: { id: true, isActive: true }
        });
        const existingIds = existingLabs.map(l => l.id);
        const missing = servicingLabIds.filter(id => !existingIds.includes(id));
        if (missing.length > 0) {
            const err = new Error(`Laboratories not found: ${missing.join(', ')}`);
            err.statusCode = 404;
            err.code = 'LAB_NOT_FOUND';
            throw err;
        }
        const inactiveLabs = existingLabs.filter(l => !l.isActive).map(l => l.id);
        if (inactiveLabs.length > 0) {
            const err = new Error(`Cannot assign inactive laboratories to servicing membership: ${inactiveLabs.join(', ')}`);
            err.statusCode = 400;
            err.code = 'INACTIVE_LAB_NOT_ALLOWED';
            throw err;
        }
    }

    const currentRelations = await resolveProjectLabs(project, tx);
    const removedLabs = currentRelations.servicingLabIds.filter(id => !servicingLabIds.includes(id));
    const addedLabs = servicingLabIds.filter(id => !currentRelations.servicingLabIds.includes(id));

    // Synchronize ProjectLab junction table
    if (removedLabs.length > 0) {
        await tx.projectLab.deleteMany({
            where: {
                projectCode: project.code,
                labId: { in: removedLabs }
            }
        });
    }

    for (const addId of addedLabs) {
        await tx.projectLab.create({
            data: {
                id: 'pl-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
                projectCode: project.code,
                labId: addId,
                role: 'SERVICING'
            }
        });
    }

    // Synchronize legacy assignedLabIds JSON array
    const updated = await tx.project.update({
        where: { id: projectId },
        data: {
            assignedLabIds: JSON.stringify(servicingLabIds)
        }
    });

    const auditData = {
        id: 'audit-proj-labs-' + Date.now(),
        entity: 'PROJECT',
        entityId: projectId,
        action: 'LAB_ACCESS_UPDATED',
        details: `Updated servicing labs by ${actor.username}. Added: [${addedLabs.join(', ')}], Removed: [${removedLabs.join(', ')}]. Reason: ${reason || 'Access update'}`,
        performedBy: actor.username,
        timestamp: new Date()
    };

    if (prisma.auditLog && prisma.auditLog.create !== defaultAuditCreate) {
        await prisma.auditLog.create({ data: auditData });
    } else {
        await tx.auditLog.create({ data: auditData });
    }

    return {
        status: 'APPLIED',
        projectId: project.id,
        projectCode: project.code,
        ownerLabId: project.labId,
        servicingLabIds,
        addedLabs,
        removedLabs
    };
}

module.exports = {
    resolveProjectLabs,
    getDiscrepancyReport,
    canManageProject,
    getProjectLabAccess,
    updateProjectLabAccess
};
