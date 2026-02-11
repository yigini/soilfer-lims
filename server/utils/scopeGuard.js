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
    const labScope = getLabScope(user);

    // If null, user has global access - return existing where unchanged.
    if (labScope === null) {
        return existingWhere;
    }

    const { labField = 'labId', altLabField = null } = options;

    // Build the lab filter
    let labFilter;
    if (altLabField) {
        // OR condition: matches either labId or assignedLab
        labFilter = {
            OR: [
                { [labField]: labScope },
                { [altLabField]: labScope }
            ]
        };
    } else {
        labFilter = { [labField]: labScope };
    }

    // Merge with existing where
    // If existingWhere already has an AND, append to it.
    // Otherwise, create a new AND array.
    if (existingWhere.AND) {
        return {
            ...existingWhere,
            AND: [...existingWhere.AND, labFilter]
        };
    } else {
        return {
            ...existingWhere,
            ...labFilter
        };
    }
}

/**
 * Validates that a fetched entity belongs to the user's lab scope.
 * Use this for POST-FETCH validation (e.g., after findUnique by ID).
 * 
 * @param {Object} user - The authenticated user object from req.user.
 * @param {Object} entity - The fetched entity (must have labId or assignedLab).
 * @param {Object} options - Options for validation.
 * @param {string} options.labField - The field name to check (default: 'labId').
 * @param {string} options.altLabField - An alternative lab field (e.g., 'assignedLab').
 * @returns {boolean} - True if user has access to this entity.
 * 
 * @example
 * const sample = await prisma.sample.findUnique({ where: { id } });
 * if (!scopeGuard.canAccessEntity(req.user, sample, { altLabField: 'assignedLab' })) {
 *     return res.status(403).json({ error: 'Access denied to this sample.' });
 * }
 */
function canAccessEntity(user, entity, options = {}) {
    if (!entity) return false;

    const labScope = getLabScope(user);

    // Global access - can see everything
    if (labScope === null) {
        return true;
    }

    const { labField = 'labId', altLabField = null } = options;

    // 1. Check primary field (Owner Lab)
    if (entity[labField] === labScope) {
        return true;
    }

    // 2. Check alternative field (e.g. assignedLab)
    if (altLabField && entity[altLabField] === labScope) {
        return true;
    }

    // 3. Check Multi-Lab assignment field (assignedLabIds)
    // This field usually stores a JSON array string like '["LAB1", "LAB2"]'
    if (entity.assignedLabIds) {
        try {
            const assigned = typeof entity.assignedLabIds === 'string'
                ? JSON.parse(entity.assignedLabIds)
                : entity.assignedLabIds;

            if (Array.isArray(assigned) && assigned.includes(labScope)) {
                return true;
            }
        } catch (e) {
            // If it contains the lab ID as a substring (safety fallback for partial matches)
            if (typeof entity.assignedLabIds === 'string' && entity.assignedLabIds.includes(`"${labScope}"`)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Express Middleware to enforce lab scope on route level.
 * Useful for routes that should ONLY be accessible by users with a lab.
 * 
 * @param {Object} options - Options for the middleware.
 * @param {boolean} options.allowGlobal - If true, SUPER_ADMIN is allowed through.
 * @returns {Function} - Express middleware function.
 */
function requireLabScope(options = { allowGlobal: true }) {
    return (req, res, next) => {
        try {
            const labScope = getLabScope(req.user);

            if (labScope === null && !options.allowGlobal) {
                return res.status(403).json({ error: 'This action requires a lab assignment.' });
            }

            // Attach to request for easy access in controller
            req.labScope = labScope;
            next();
        } catch (error) {
            return res.status(403).json({ error: error.message });
        }
    };
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
    requireLabScope,
    canManageLab,
    ensureScope
};
