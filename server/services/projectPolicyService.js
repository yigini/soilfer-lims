'use strict';

function parseArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
        try {
            const parsed = JSON.parse(val);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }
    return [];
}

/**
 * Checks whether an actor can view/read a project.
 *
 * Rules:
 * - Inactive actors are denied.
 * - SUPER_ADMIN and ADMIN have global read access.
 * - MASTER_USER / COUNTRY_ADMIN can read if project is in their authorized countries or explicitly granted.
 * - PROJECT_MANAGER can read if project code or ID is in their projects list.
 * - Lab roles (LAB_MANAGER, SAMPLE_RECEPTION, LAB_TECHNICIAN, SURVEYOR) can read if their lab is the owner or a servicing member.
 * - VIEWER / EXTERNAL_VIEWER / AUDIT_USER can read within assigned lab or explicit project grant.
 */
function canReadProject(actor, project, { memberLabIds = null, labCountries = {} } = {}) {
    if (!actor || actor.isActive === false) return false;
    if (!project) return false;

    const role = actor.role ? actor.role.trim() : '';

    if (role === 'SUPER_ADMIN' || role === 'ADMIN') return true;

    if (role === 'MASTER_USER' || role === 'COUNTRY_ADMIN') {
        const actorCountries = parseArray(actor.countries);
        if (actorCountries.length === 0) return false;

        // Check explicit user projects
        const userProjects = parseArray(actor.projects);
        if (userProjects.includes(project.code) || userProjects.includes(project.id)) {
            return true;
        }

        // Check project countries
        const projectCountries = parseArray(project.countries);
        if (projectCountries.some(c => actorCountries.includes(c))) {
            return true;
        }

        // Check owner lab country
        if (project.labId && labCountries[project.labId] && actorCountries.includes(labCountries[project.labId])) {
            return true;
        }

        // Check member lab countries
        if (Array.isArray(memberLabIds) && memberLabIds.some(lid => labCountries[lid] && actorCountries.includes(labCountries[lid]))) {
            return true;
        }

        return false;
    }

    if (role === 'PROJECT_MANAGER') {
        const userProjects = parseArray(actor.projects);
        return userProjects.includes(project.code) || userProjects.includes(project.id);
    }

    if (['LAB_MANAGER', 'SAMPLE_RECEPTION', 'LAB_TECHNICIAN', 'SURVEYOR'].includes(role)) {
        if (!actor.labId) return false;

        if (project.labId && project.labId === actor.labId) return true;

        if (Array.isArray(memberLabIds) && memberLabIds.includes(actor.labId)) return true;

        // Check assignedLabIds JSON field
        const assigned = parseArray(project.assignedLabIds);
        if (assigned.includes(actor.labId)) return true;

        return false;
    }

    if (['AUDIT_USER', 'EXTERNAL_VIEWER', 'VIEWER'].includes(role)) {
        const userProjects = parseArray(actor.projects);
        if (userProjects.includes(project.code) || userProjects.includes(project.id)) return true;

        if (actor.labId) {
            if (project.labId && project.labId === actor.labId) return true;
            if (Array.isArray(memberLabIds) && memberLabIds.includes(actor.labId)) return true;
            const assigned = parseArray(project.assignedLabIds);
            if (assigned.includes(actor.labId)) return true;
        }
        return false;
    }

    return false;
}

/**
 * Checks whether an actor can edit project plan and metadata.
 */
function canEditProjectPlan(actor, project) {
    if (!actor || actor.isActive === false || !project) return false;
    const role = actor.role ? actor.role.trim() : '';

    if (role === 'SUPER_ADMIN' || role === 'ADMIN') return true;

    if (role === 'LAB_MANAGER') {
        return Boolean(actor.labId && project.labId === actor.labId);
    }

    if (role === 'PROJECT_MANAGER') {
        const userProjects = parseArray(actor.projects);
        return userProjects.includes(project.code) || userProjects.includes(project.id);
    }

    return false;
}

/**
 * Checks whether an actor can manage lab access and servicing memberships for a project.
 */
function canManageProjectAccess(actor, project) {
    if (!actor || actor.isActive === false || !project) return false;
    const role = actor.role ? actor.role.trim() : '';

    if (role === 'SUPER_ADMIN' || role === 'ADMIN') return true;

    if (role === 'LAB_MANAGER') {
        return Boolean(actor.labId && project.labId === actor.labId);
    }

    return false;
}

/**
 * Checks whether an actor can transition project lifecycle status (PAUSE, CLOSE, ARCHIVE, RESTORE).
 */
function canTransitionProject(actor, project, targetStatus) {
    if (!actor || actor.isActive === false || !project) return false;
    const role = actor.role ? actor.role.trim() : '';

    if (role === 'SUPER_ADMIN' || role === 'ADMIN') return true;

    if (role === 'LAB_MANAGER') {
        return Boolean(actor.labId && project.labId === actor.labId);
    }

    return false;
}

/**
 * Checks whether an actor can import samples into a project.
 */
function canImportProjectSamples(actor, project, targetLabId = null) {
    if (!actor || actor.isActive === false || !project) return false;
    const role = actor.role ? actor.role.trim() : '';

    if (role === 'SUPER_ADMIN' || role === 'ADMIN') return true;

    if (role === 'LAB_MANAGER' || role === 'SAMPLE_RECEPTION') {
        if (!actor.labId) return false;
        if (targetLabId && targetLabId !== actor.labId) return false;

        if (project.labId === actor.labId) return true;

        const assigned = parseArray(project.assignedLabIds);
        return assigned.includes(actor.labId);
    }

    if (role === 'PROJECT_MANAGER') {
        const userProjects = parseArray(actor.projects);
        return userProjects.includes(project.code) || userProjects.includes(project.id);
    }

    return false;
}

/**
 * Builds the scoped sample query predicate for a project and actor.
 * Guarantees that servicing lab staff only see their own lab's sample slice.
 */
function buildProjectSampleScope(actor, project, { authorizedLabIds = null } = {}) {
    const baseQuery = {
        OR: [
            { projectId: project.id },
            { projectCode: project.code }
        ]
    };

    if (!actor) return { id: '__DENIED__' };
    const role = actor.role ? actor.role.trim() : '';

    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
        return baseQuery;
    }

    if (role === 'PROJECT_MANAGER') {
        const userProjects = parseArray(actor.projects);
        if (userProjects.includes(project.code) || userProjects.includes(project.id)) {
            return baseQuery;
        }
        return { id: '__DENIED__' };
    }

    if (['MASTER_USER', 'COUNTRY_ADMIN'].includes(role)) {
        if (Array.isArray(authorizedLabIds) && authorizedLabIds.length > 0) {
            return {
                AND: [
                    baseQuery,
                    {
                        OR: [
                            { assignedLab: { in: authorizedLabIds } },
                            { labId: { in: authorizedLabIds } }
                        ]
                    }
                ]
            };
        }
        return { id: '__DENIED__' };
    }

    if (['LAB_MANAGER', 'SAMPLE_RECEPTION', 'LAB_TECHNICIAN', 'SURVEYOR', 'AUDIT_USER', 'EXTERNAL_VIEWER', 'VIEWER'].includes(role)) {
        if (!actor.labId) return { id: '__DENIED__' };

        // Both owner and servicing labs see only their own lab's samples unless super-admin
        return {
            AND: [
                baseQuery,
                {
                    OR: [
                        { assignedLab: actor.labId },
                        { labId: actor.labId }
                    ]
                }
            ]
        };
    }

    return { id: '__DENIED__' };
}

module.exports = {
    parseArray,
    canReadProject,
    canAccessProject: canReadProject,
    canEditProjectPlan,
    canManageProjectAccess,
    canTransitionProject,
    canImportProjectSamples,
    buildProjectSampleScope
};
