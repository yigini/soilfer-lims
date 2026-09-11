'use strict';

const { ALL_ROLES, ALLOWED_SUB_ROLES, hasPermission } = require('../config/roles');
const scopeGuard = require('../utils/scopeGuard');

const POLICY_CODES = {
    ALLOWED: 'ALLOWED',
    UNAUTHORIZED: 'UNAUTHORIZED',
    ACTOR_INACTIVE: 'ACTOR_INACTIVE',
    INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
    TARGET_OUTSIDE_SCOPE: 'TARGET_OUTSIDE_SCOPE',
    TARGET_ROLE_NOT_MANAGEABLE: 'TARGET_ROLE_NOT_MANAGEABLE',
    SELF_MANAGEMENT_FORBIDDEN: 'SELF_MANAGEMENT_FORBIDDEN',
    LAST_ADMIN_PROTECTED: 'LAST_ADMIN_PROTECTED',
    LAB_PAUSED: 'LAB_PAUSED',
    ASSIGNEE_INACTIVE: 'ASSIGNEE_INACTIVE',
    PROJECT_OWNER_REQUIRED: 'PROJECT_OWNER_REQUIRED'
};

/**
 * Evaluates whether an actor can manage a given target user.
 */
function canManageUser(actor, target, requestedChanges = {}) {
    if (!actor || !target) {
        return { allowed: false, code: POLICY_CODES.UNAUTHORIZED, message: 'Actor and target are required' };
    }

    if (actor.isActive === false) {
        return { allowed: false, code: POLICY_CODES.ACTOR_INACTIVE, message: 'Actor account is deactivated' };
    }

    const isSelf = actor.id === target.id;
    const isSuperAdmin = actor.role === 'SUPER_ADMIN';

    // Self-mutation checks
    if (isSelf) {
        if (!isSuperAdmin) {
            if (requestedChanges.role && requestedChanges.role !== target.role) {
                return { allowed: false, code: POLICY_CODES.SELF_MANAGEMENT_FORBIDDEN, message: 'Cannot modify your own role' };
            }
            if (requestedChanges.labId && requestedChanges.labId !== target.labId) {
                return { allowed: false, code: POLICY_CODES.SELF_MANAGEMENT_FORBIDDEN, message: 'Cannot modify your own lab assignment' };
            }
            if (requestedChanges.countries) {
                return { allowed: false, code: POLICY_CODES.SELF_MANAGEMENT_FORBIDDEN, message: 'Cannot modify your own country assignments' };
            }
            if (requestedChanges.projects) {
                return { allowed: false, code: POLICY_CODES.SELF_MANAGEMENT_FORBIDDEN, message: 'Cannot modify your own project assignments' };
            }
            return { allowed: false, code: POLICY_CODES.SELF_MANAGEMENT_FORBIDDEN, message: 'Administrative self-mutation is forbidden' };
        }
    }

    if (isSuperAdmin) {
        return { allowed: true, code: POLICY_CODES.ALLOWED, message: 'Super Administrator access granted' };
    }

    // Lab Manager role hierarchy and scope
    if (actor.role === 'LAB_MANAGER') {
        if (!actor.labId) {
            return { allowed: false, code: POLICY_CODES.TARGET_OUTSIDE_SCOPE, message: 'Lab Manager has no assigned laboratory' };
        }
        if (target.labId !== actor.labId) {
            return { allowed: false, code: POLICY_CODES.TARGET_OUTSIDE_SCOPE, message: 'Cannot manage staff in another laboratory' };
        }
        if (!ALLOWED_SUB_ROLES.includes(target.role)) {
            return { allowed: false, code: POLICY_CODES.TARGET_ROLE_NOT_MANAGEABLE, message: `Lab Managers cannot manage role '${target.role}'` };
        }
        if (requestedChanges.role && !ALLOWED_SUB_ROLES.includes(requestedChanges.role)) {
            return { allowed: false, code: POLICY_CODES.TARGET_ROLE_NOT_MANAGEABLE, message: `Lab Managers cannot assign role '${requestedChanges.role}'` };
        }
        if (requestedChanges.labId && requestedChanges.labId !== actor.labId) {
            return { allowed: false, code: POLICY_CODES.TARGET_OUTSIDE_SCOPE, message: 'Cannot transfer staff to another laboratory' };
        }
        return { allowed: true, code: POLICY_CODES.ALLOWED, message: 'Lab Manager authorized' };
    }

    // National oversight roles (MASTER_USER, COUNTRY_ADMIN)
    if (['MASTER_USER', 'COUNTRY_ADMIN'].includes(actor.role)) {
        if (target.role === 'SUPER_ADMIN') {
            return { allowed: false, code: POLICY_CODES.TARGET_ROLE_NOT_MANAGEABLE, message: 'National users cannot manage Super Administrators' };
        }
        if (requestedChanges.role === 'SUPER_ADMIN') {
            return { allowed: false, code: POLICY_CODES.TARGET_ROLE_NOT_MANAGEABLE, message: 'National users cannot appoint Super Administrators' };
        }

        const actorCountries = Array.isArray(actor.countries)
            ? actor.countries
            : (typeof actor.countries === 'string' ? JSON.parse(actor.countries || '[]') : []);

        if (actorCountries.length === 0) {
            return { allowed: false, code: POLICY_CODES.TARGET_OUTSIDE_SCOPE, message: 'National user has no authorized countries' };
        }

        // Scope check target country - must resolve and be within authorized scope
        const targetCountry = target.labCountry || target.country;
        if (!targetCountry) {
            // Unresolved target country fails closed
            return { allowed: false, code: POLICY_CODES.TARGET_OUTSIDE_SCOPE, message: 'Target laboratory or country scope could not be resolved' };
        }
        if (!actorCountries.includes(targetCountry)) {
            return { allowed: false, code: POLICY_CODES.TARGET_OUTSIDE_SCOPE, message: `Target country '${targetCountry}' outside authorized national scope` };
        }

        // Scope check proposed lab country only when a lab/scope change is requested
        const isLabScopeChangeRequested = requestedChanges.labId !== undefined || requestedChanges.proposedLabCountry !== undefined || requestedChanges.countries !== undefined;
        if (isLabScopeChangeRequested) {
            const proposedCountry = requestedChanges.proposedLabCountry || requestedChanges.labCountry || requestedChanges.country;
            if (!proposedCountry) {
                return { allowed: false, code: POLICY_CODES.TARGET_OUTSIDE_SCOPE, message: 'Proposed laboratory country scope could not be resolved' };
            }
            if (!actorCountries.includes(proposedCountry)) {
                return { allowed: false, code: POLICY_CODES.TARGET_OUTSIDE_SCOPE, message: `Proposed laboratory country '${proposedCountry}' outside authorized national scope` };
            }
        }

        return { allowed: true, code: POLICY_CODES.ALLOWED, message: 'National user authorized' };
    }

    return { allowed: false, code: POLICY_CODES.INSUFFICIENT_PERMISSIONS, message: 'Actor lacks management role' };
}

/**
 * Evaluates whether an actor can manage a laboratory.
 */
function canManageLab(actor, targetLabId, labCountry = null) {
    if (!actor || !targetLabId) {
        return { allowed: false, code: POLICY_CODES.UNAUTHORIZED, message: 'Actor and lab ID required' };
    }
    if (actor.isActive === false) {
        return { allowed: false, code: POLICY_CODES.ACTOR_INACTIVE, message: 'Actor account is deactivated' };
    }

    if (actor.role === 'SUPER_ADMIN') {
        return { allowed: true, code: POLICY_CODES.ALLOWED, message: 'Super Administrator access' };
    }

    if (actor.role === 'LAB_MANAGER') {
        if (actor.labId && actor.labId === targetLabId) {
            return { allowed: true, code: POLICY_CODES.ALLOWED, message: 'Lab Manager authorized for own lab' };
        }
        return { allowed: false, code: POLICY_CODES.TARGET_OUTSIDE_SCOPE, message: 'Lab Manager cannot manage another laboratory' };
    }

    if (['MASTER_USER', 'COUNTRY_ADMIN'].includes(actor.role)) {
        const actorCountries = Array.isArray(actor.countries)
            ? actor.countries
            : (typeof actor.countries === 'string' ? JSON.parse(actor.countries || '[]') : []);
        if (labCountry && actorCountries.includes(labCountry)) {
            return { allowed: true, code: POLICY_CODES.ALLOWED, message: 'National user authorized for country' };
        }
        return { allowed: false, code: POLICY_CODES.TARGET_OUTSIDE_SCOPE, message: 'Laboratory outside authorized country scope' };
    }

    return { allowed: false, code: POLICY_CODES.INSUFFICIENT_PERMISSIONS, message: 'Insufficient permissions to manage laboratory' };
}

/**
 * Returns allowed and unallowed roles for an actor in a given lab context.
 */
function getAssignableRolesCatalogue(actor, targetLabId = null) {
    if (!actor || !actor.role) return { assignableRoles: [], unmanageableRoles: [] };

    const roleDefinitions = [
        { key: 'SUPER_ADMIN', role: 'SUPER_ADMIN', displayName: 'Super Administrator', description: 'Global cross-lab administration' },
        { key: 'MASTER_USER', role: 'MASTER_USER', displayName: 'National Master User', description: 'National multi-lab program lead' },
        { key: 'PROJECT_MANAGER', role: 'PROJECT_MANAGER', displayName: 'Project Manager', description: 'Project tracking and coordination' },
        { key: 'LAB_MANAGER', role: 'LAB_MANAGER', displayName: 'Laboratory Manager', description: 'Laboratory operations and approval' },
        { key: 'LAB_TECHNICIAN', role: 'LAB_TECHNICIAN', displayName: 'Laboratory Technician', description: 'Analytical bench measurements and queue execution' },
        { key: 'SAMPLE_RECEPTION', role: 'SAMPLE_RECEPTION', displayName: 'Sample Reception', description: 'Physical intake, labeling, and batch registration' },
        { key: 'SURVEYOR', role: 'SURVEYOR', displayName: 'Field Surveyor', description: 'Field sampling intake and provenance' },
        { key: 'AUDIT_USER', role: 'AUDIT_USER', displayName: 'Quality & Audit Officer', description: 'Compliance auditing and read-only QA' },
        { key: 'EXTERNAL_VIEWER', role: 'EXTERNAL_VIEWER', displayName: 'External Partner', description: 'Read-only result inspection' },
        { key: 'VIEWER', role: 'VIEWER', displayName: 'General Viewer', description: 'Read-only platform viewer' }
    ];

    if (actor.role === 'SUPER_ADMIN') {
        return {
            assignableRoles: roleDefinitions.map(r => ({ ...r, isManageable: true, scopeRequirements: ['labId'] })),
            unmanageableRoles: []
        };
    }

    if (actor.role === 'LAB_MANAGER') {
        const assignable = [];
        const unmanageable = [];

        roleDefinitions.forEach(r => {
            if (ALLOWED_SUB_ROLES.includes(r.key)) {
                assignable.push({ ...r, isManageable: true, scopeRequirements: ['labId'] });
            } else {
                let reason = 'Lab Managers cannot assign administrative or peer roles.';
                if (r.key === 'LAB_MANAGER') reason = 'Lab Managers cannot appoint peer managers. Contact a system administrator.';
                if (r.key === 'SUPER_ADMIN') reason = 'Super Administrator can only be assigned by platform administrators.';
                if (r.key === 'MASTER_USER') reason = 'National roles require central program authorization.';
                if (r.key === 'PROJECT_MANAGER') reason = 'Project Managers are appointed at project/program level.';
                unmanageable.push({ ...r, isManageable: false, reason });
            }
        });

        return { assignableRoles: assignable, unmanageableRoles: unmanageable };
    }

    if (['MASTER_USER', 'COUNTRY_ADMIN'].includes(actor.role)) {
        const assignable = [];
        const unmanageable = [];

        roleDefinitions.forEach(r => {
            if (r.key === 'SUPER_ADMIN') {
                unmanageable.push({ ...r, isManageable: false, reason: 'Super Administrator role is global.' });
            } else {
                assignable.push({ ...r, isManageable: true, scopeRequirements: ['labId'] });
            }
        });

        return { assignableRoles: assignable, unmanageableRoles: unmanageable };
    }

    return {
        assignableRoles: [],
        unmanageableRoles: roleDefinitions.map(r => ({ ...r, isManageable: false, reason: 'Role lacks staff management authority.' }))
    };
}

module.exports = {
    POLICY_CODES,
    canManageUser,
    canManageLab,
    getAssignableRolesCatalogue
};
