/**
 * Scope Guard - Centralized Lab Isolation Utility
 * 
 * This module provides a single source of truth for lab-scoped queries.
 * ALL database access must use these utilities to ensure data isolation.
 * 
 * Philosophy:
 * - "Deny by Default": If no scope can be determined, access is denied.
 * - "Central, Not Scattered": One place to audit, one place to fix.
 * - "Explicit Exceptions": SUPER_ADMIN bypass is explicit and logged.
 */

const ROLES = {
    SUPER_ADMIN: 'SUPER_ADMIN',
    LAB_MANAGER: 'LAB_MANAGER',
    LAB_TECHNICIAN: 'LAB_TECHNICIAN',
    SAMPLE_RECEPTION: 'SAMPLE_RECEPTION'  // Corrected from INTAKE_OFFICER
};

/**
 * Determines if a user has global access (no lab scoping).
 * Only SUPER_ADMIN has this privilege.
 * @param {Object} user - The authenticated user object from req.user.
 * @returns {boolean} - True if user bypasses lab isolation.
 */
function hasGlobalAccess(user) {
    return user && user.role === ROLES.SUPER_ADMIN;
}

/**
 * Determines the lab scope for a given user.
 * Returns null if user has global access.
 * Throws an error if user cannot be scoped (no labId and not SUPER_ADMIN).
 * 
 * @param {Object} user - The authenticated user object from req.user.
 * @returns {string|null} - The labId to scope queries to, or null for global.
 * @throws {Error} - If user has no labId and is not SUPER_ADMIN.
 */
function getLabScope(user) {
    if (!user) {
        throw new Error('SCOPE_GUARD: User object is required.');
    }

    if (hasGlobalAccess(user)) {
        // SUPER_ADMIN - no lab restriction
        return null;
    }

    if (!user.labId) {
        // This is a critical misconfiguration - a non-SUPER_ADMIN user without a lab.
        console.error(`[SCOPE_GUARD] CRITICAL: User ${user.username} (${user.role}) has no labId.`);
        throw new Error('SCOPE_GUARD: User is not assigned to a lab. Access denied.');
    }

    return user.labId;
}

/**
 * Builds a Prisma WHERE clause that enforces lab isolation.
 * This is the PRIMARY function to use in all controllers.
 * 
 * @param {Object} user - The authenticated user object from req.user.
 * @param {Object} existingWhere - Any existing where conditions to merge.
 * @param {Object} options - Options for scoping.
 * @param {string} options.labField - The field name to filter on (default: 'labId').
 * @param {string} options.altLabField - An alternative lab field (e.g., 'assignedLab').
 * @returns {Object} - The Prisma WHERE clause with lab scoping applied.
 * 
 * @example
 * // In sampleController.js:
 * const where = scopeGuard.buildScopedWhere(req.user, { status: 'PENDING' });
 * const samples = await prisma.sample.findMany({ where });
 * 
 * @example
 * // For entities with dual lab fields (labId and assignedLab):
 * const where = scopeGuard.buildScopedWhere(req.user, {}, { labField: 'labId', altLabField: 'assignedLab' });
 */
function buildScopedWhere(user, existingWhere = {}, options = {}) {
    if (hasGlobalAccess(user)) {
        return existingWhere;
    }

    const labScope = user.labId || null;
    const entityType = options.entityType || 'Sample';
    const { labField = 'labId', altLabField = 'assignedLab' } = options;

    let orClauses = [];

    if (entityType === 'WorkItem') {
        // WorkItem fields: labId, assignedLab, assignedTo, sample: { country }
        if (user.role === 'LAB_TECHNICIAN') {
            if (user.username) {
                orClauses.push({ assignedTo: user.username });
            }
            if (labScope) {
                orClauses.push({ [labField]: labScope });
                if (altLabField) orClauses.push({ [altLabField]: labScope });
            }
        } else {
            // Managers and others
            if (labScope) {
                orClauses.push({ [labField]: labScope });
                if (altLabField) orClauses.push({ [altLabField]: labScope });
            }
            if (user.countries) {
                try {
                    const countries = typeof user.countries === 'string' ? JSON.parse(user.countries) : user.countries;
                    if (Array.isArray(countries) && countries.length > 0) {
                        orClauses.push({ sample: { country: { in: countries } } });
                    }
                } catch (e) {}
            }
        }
    } else if (entityType === 'Sample') {
        // Sample fields: labId, assignedLab, country, workItems: { some: { assignedTo } }
        if (labScope) {
            orClauses.push({ [labField]: labScope });
            if (altLabField) orClauses.push({ [altLabField]: labScope });
        }
        if (user.role === 'LAB_TECHNICIAN' && user.username) {
            orClauses.push({ workItems: { some: { assignedTo: user.username } } });
        }
        if (user.countries) {
            try {
                const countries = typeof user.countries === 'string' ? JSON.parse(user.countries) : user.countries;
                if (Array.isArray(countries) && countries.length > 0) {
                    orClauses.push({ country: { in: countries } });
                }
            } catch (e) {}
        }
    } else if (entityType === 'Spectral') {
        // Spectral fields: labId
        if (labScope) {
            orClauses.push({ labId: labScope });
        }
    } else {
        // Generic (Equipment, Project, Inventory, etc.)
        if (labScope) {
            orClauses.push({ [labField]: labScope });
            if (altLabField && altLabField !== labField) orClauses.push({ [altLabField]: labScope });
        }
    }

    // Fail-Closed: If user is not SUPER_ADMIN and no scope could be determined, DENY by default
    const labFilter = orClauses.length > 0 ? { OR: orClauses } : { id: { in: [] } };

    if (existingWhere.AND) {
        return {
            ...existingWhere,
            AND: [...existingWhere.AND, labFilter]
        };
    } else if (Object.keys(existingWhere).length > 0) {
        return {
            ...existingWhere,
            AND: [labFilter]
        };
    } else {
        return labFilter;
    }
}

/**
 * Validates that a fetched entity belongs to the user's lab scope.
 * Use this for POST-FETCH validation (e.g., after findUnique by ID).
 */
function canAccessEntity(user, entity, options = {}) {
    if (!entity) return false;

    // 0. SUPER_ADMIN - global access
    if (hasGlobalAccess(user)) {
        return true;
    }

    const labScope = user.labId || null;
    const { labField = 'labId', altLabField = 'assignedLab' } = options;

    // 1. Direct assignedTo check on entity or workItems
    if (entity.assignedTo && (entity.assignedTo === user.username || entity.assignedTo === user.id)) {
        return true;
    }

    if (Array.isArray(entity.workItems) && entity.workItems.some(wi => wi.assignedTo === user.username || wi.assignedTo === user.id)) {
        return true;
    }

    // 2. Primary and alternative lab match
    if (labScope) {
        if (entity[labField] === labScope) return true;
        if (altLabField && entity[altLabField] === labScope) return true;
        if (entity.labLocation === labScope) return true;
    }

    // 3. Multi-Lab assignment field (assignedLabIds)
    if (entity.assignedLabIds) {
        try {
            const assigned = typeof entity.assignedLabIds === 'string'
                ? JSON.parse(entity.assignedLabIds)
                : entity.assignedLabIds;

            if (Array.isArray(assigned) && assigned.includes(labScope)) {
                return true;
            }
        } catch (e) {
            if (typeof entity.assignedLabIds === 'string' && entity.assignedLabIds.includes(`"${labScope}"`)) {
                return true;
            }
        }
    }

    // 4. Country matching (if user has country scope e.g. ["GTM"] and entity is from GTM)
    if (user.countries) {
        try {
            const countries = typeof user.countries === 'string' ? JSON.parse(user.countries) : user.countries;
            if (Array.isArray(countries)) {
                if (entity.country && countries.includes(entity.country)) return true;
                if (entity.countryName && countries.includes(entity.countryName)) return true;
            }
        } catch (e) {}
    }

    return false;
}

/**
 * Helper to check if user can manage a specific lab.
 * Managers can only manage their own lab. SUPER_ADMIN can manage any.
 * 
 * @param {Object} user - The authenticated user.
 * @param {string} targetLabId - The lab ID being managed.
 * @returns {boolean}
 */
function canManageLab(user, targetLabId) {
    if (hasGlobalAccess(user)) return true;
    return user.labId === targetLabId;
}

/**
 * STRICTLY enforces scope. Throws 403 if access is denied.
 * Use this in controllers to fail fast.
 * 
 * @param {Object} user - The authenticated user.
 * @param {Object} entity - The entity to check.
 * @param {Object} options - Options for validation.
 * @throws {Error} - 403 Error if access denied.
 */
function ensureScope(user, entity, options = {}) {
    if (!canAccessEntity(user, entity, options)) {
        // Log the security event (could be enhanced to write to audit log)
        console.warn(`[SCOPE_GUARD] ACCESS DENIED: User ${user.username} (Lab: ${user.labId}) attempted to access entity outside scope.`);

        const error = new Error('Access Denied: You do not have permission to access this resource.');
        error.statusCode = 403;
        throw error;
    }
}

module.exports = {
    ROLES,
    hasGlobalAccess,
    getLabScope,
    buildScopedWhere,
    canAccessEntity,
    canManageLab,
    ensureScope
};
