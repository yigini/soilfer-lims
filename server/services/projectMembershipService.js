'use strict';

const prisma = require('../prisma');

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
    if (servicingSet.size === 0 && project.assignedLabIds) {
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

    // 3. Fallback resolution: countries matching labs
    if (servicingSet.size === 0 && project.countries) {
        try {
            const countryList = typeof project.countries === 'string'
                ? JSON.parse(project.countries)
                : project.countries;
            if (Array.isArray(countryList) && countryList.length > 0) {
                const labsInCountries = await tx.lab.findMany({
                    where: { country: { in: countryList } },
                    select: { id: true }
                });
                for (const l of labsInCountries) {
                    servicingSet.add(l.id);
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
    if (!actor || !project) return false;
    if (actor.role === 'SUPER_ADMIN') return true;

    if (actor.role === 'LAB_MANAGER') {
        if (!actor.labId) return false;
        return project.labId === actor.labId;
    }

    return false;
}

module.exports = {
    resolveProjectLabs,
    getDiscrepancyReport,
    canManageProject
};
