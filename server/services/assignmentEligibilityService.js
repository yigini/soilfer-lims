'use strict';

const prisma = require('../prisma');
const { hasPermission } = require('../config/roles');

/**
 * Service for resolving eligible work assignment candidates and validating assignments.
 * Enforces:
 * - Active account requirement (LG-17, A23)
 * - Active laboratory requirement (A23, A33)
 * - Strict laboratory isolation (SD-02)
 * - National scope boundaries (LG-08, LG-17)
 */

/**
 * Resolves eligible staff for work assignment in a laboratory.
 *
 * @param {object} actor - Authenticated user making the request
 * @param {object} params - { labId, analysis }
 * @param {object} [tx=prisma]
 * @returns {Promise<{ labId: string, assignees: Array }>}
 */
async function getEligibleAssignees(actor, { labId, analysis } = {}, tx = prisma) {
    if (!actor) {
        const err = new Error('Authentication required');
        err.statusCode = 401;
        err.code = 'UNAUTHORIZED';
        throw err;
    }

    if (!hasPermission(actor, 'ASSIGN_WORK')) {
        const err = new Error('Insufficient permissions to view eligible assignees');
        err.statusCode = 403;
        err.code = 'INSUFFICIENT_PERMISSIONS';
        throw err;
    }

    let targetLabId = labId || actor.labId;

    if (actor.role === 'LAB_MANAGER') {
        if (!actor.labId) {
            const err = new Error('Lab Manager has no assigned laboratory');
            err.statusCode = 403;
            err.code = 'MANAGER_LACKS_LAB';
            throw err;
        }
        if (labId && labId !== actor.labId) {
            const err = new Error('Cannot query assignees for another laboratory');
            err.statusCode = 403;
            err.code = 'LAB_OUTSIDE_SCOPE';
            throw err;
        }
        targetLabId = actor.labId;
    } else if (actor.role === 'MASTER_USER' || actor.role === 'COUNTRY_ADMIN') {
        if (!targetLabId) {
            const err = new Error('labId query parameter is required for national users');
            err.statusCode = 400;
            err.code = 'MISSING_LAB_ID';
            throw err;
        }
        const countryList = actor.countries ? (typeof actor.countries === 'string' ? JSON.parse(actor.countries) : actor.countries) : [];
        const lab = await tx.lab.findUnique({ where: { id: targetLabId } });
        if (!lab || !countryList.includes(lab.country)) {
            const err = new Error(`Laboratory '${targetLabId}' is outside national scope`);
            err.statusCode = 403;
            err.code = 'LAB_OUTSIDE_SCOPE';
            throw err;
        }
    }

    if (!targetLabId) {
        const err = new Error('targetLabId could not be determined');
        err.statusCode = 400;
        err.code = 'MISSING_LAB_ID';
        throw err;
    }

    // Verify laboratory is not paused / inactive
    const lab = await tx.lab.findUnique({ where: { id: targetLabId } });
    if (!lab) {
        const err = new Error(`Laboratory '${targetLabId}' not found`);
        err.statusCode = 404;
        err.code = 'LAB_NOT_FOUND';
        throw err;
    }
    if (lab.isActive === false) {
        const err = new Error('Laboratory is currently inactive or paused.');
        err.statusCode = 400;
        err.code = 'LAB_PAUSED';
        throw err;
    }

    // Query active technicians and managers
    const assignees = await tx.user.findMany({
        where: {
            labId: targetLabId,
            isActive: true,
            role: { in: ['LAB_TECHNICIAN', 'LAB_MANAGER'] }
        },
        select: {
            id: true,
            username: true,
            name: true,
            role: true,
            labId: true,
            isActive: true
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }]
    });

    return { labId: targetLabId, assignees };
}

/**
 * Validates assignment target technician against all domain invariants.
 *
 * @param {object} params - { actor, assigneeUsername, owningLab }
 * @param {object} [tx=prisma]
 * @returns {Promise<{ valid: boolean, statusCode?: number, code?: string, error?: string, assignee?: object }>}
 */
async function validateAssignmentTarget({ actor, assigneeUsername, owningLab }, tx = prisma) {
    if (!assigneeUsername) {
        return { valid: false, statusCode: 400, code: 'MISSING_ASSIGNEE', error: 'assignee username is required' };
    }

    const techUser = await tx.user.findUnique({
        where: { username: assigneeUsername }
    });

    if (!techUser) {
        return { valid: false, statusCode: 404, code: 'ASSIGNEE_NOT_FOUND', error: `Technician '${assigneeUsername}' not found` };
    }

    if (techUser.isActive === false) {
        return { valid: false, statusCode: 400, code: 'ASSIGNEE_INACTIVE', error: `Cannot assign work to deactivated technician '${assigneeUsername}'` };
    }

    if (techUser.role !== 'LAB_TECHNICIAN') {
        return { valid: false, statusCode: 400, code: 'INVALID_ASSIGNEE_ROLE', error: `User '${assigneeUsername}' is not a LAB_TECHNICIAN` };
    }

    if (!owningLab || techUser.labId !== owningLab) {
        return {
            valid: false,
            statusCode: 403,
            code: 'CROSS_LAB_ASSIGNMENT_DENIED',
            error: `Cannot assign to technician in different lab. Technician ${techUser.username} (${techUser.labId}) is not in ${owningLab}`
        };
    }

    // Verify owning lab is not paused
    const lab = await tx.lab.findUnique({ where: { id: owningLab } });
    if (lab && lab.isActive === false) {
        return { valid: false, statusCode: 400, code: 'LAB_PAUSED', error: 'Laboratory is currently inactive or paused.' };
    }

    // Verify national actor scope
    if (actor && actor.role === 'MASTER_USER') {
        const countryList = actor.countries ? (typeof actor.countries === 'string' ? JSON.parse(actor.countries) : actor.countries) : [];
        if (!lab || !countryList.includes(lab.country)) {
            return { valid: false, statusCode: 403, code: 'LAB_OUTSIDE_SCOPE', error: `Laboratory '${owningLab}' is outside national scope.` };
        }
    }

    return { valid: true, assignee: techUser };
}

module.exports = {
    getEligibleAssignees,
    validateAssignmentTarget
};
