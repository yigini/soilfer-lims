'use strict';

const prisma = require('../prisma');

/**
 * Validates the security state of a user-JWT principal across HTTP, SIS, and WebSockets.
 * Checks:
 * 1. Target user exists in DB and isActive !== false
 * 2. Target user tokenVersion matches or exceeds token claim
 * 3. Target user mustChangePassword status
 * 4. If impersonated session (decoded.act):
 *    a. Actor exists in DB and isActive !== false
 *    b. Actor possesses SUPER_ADMIN role authority
 *    c. Actor tokenVersion matches or exceeds token claim
 *    d. Actor mustChangePassword status
 *
 * @param {object} decoded - Decoded JWT payload
 * @param {object} options - Optional context { allowPasswordChangePaths, currentPath }
 * @returns {Promise<object>} Validation decision
 */
async function validateUserPrincipal(decoded, options = {}) {
    if (!decoded || !decoded.id) {
        return {
            valid: false,
            statusCode: 401,
            error: 'INVALID_TOKEN',
            message: 'Token payload missing user identity'
        };
    }

    const userId = String(decoded.id);
    const user = await prisma.user.findUnique({
        where: { id: userId }
    });

    if (!user) {
        return {
            valid: false,
            statusCode: 401,
            error: 'USER_NOT_FOUND',
            message: 'User invalid'
        };
    }

    if (user.isActive === false) {
        return {
            valid: false,
            statusCode: 401,
            error: 'ACCOUNT_DEACTIVATED',
            message: 'Account has been deactivated'
        };
    }

    // Token version check (session revocation across all channels)
    const dbTokenVersion = user.tokenVersion || 0;
    const jwtTokenVersion = decoded.tokenVersion !== undefined ? decoded.tokenVersion : 0;
    if (jwtTokenVersion < dbTokenVersion) {
        return {
            valid: false,
            statusCode: 401,
            error: 'SESSION_INVALIDATED',
            code: 'SESSION_INVALIDATED',
            message: 'Session has been revoked or invalidated. Please log in again.'
        };
    }

    // Impersonation actor validation (S02, S03)
    let actorUser = null;
    if (decoded.act && decoded.act.id) {
        const actorId = String(decoded.act.id);
        actorUser = await prisma.user.findUnique({
            where: { id: actorId }
        });

        if (!actorUser) {
            return {
                valid: false,
                statusCode: 401,
                error: 'ACTOR_NOT_FOUND',
                message: 'Impersonating administrator not found'
            };
        }

        if (actorUser.isActive === false) {
            return {
                valid: false,
                statusCode: 401,
                error: 'ACTOR_DEACTIVATED',
                message: 'Impersonating administrator account is no longer active.'
            };
        }

        if (actorUser.role !== 'SUPER_ADMIN') {
            return {
                valid: false,
                statusCode: 403,
                error: 'ACTOR_UNAUTHORIZED',
                message: 'Impersonating user lacks administrator authority.'
            };
        }

        const actorDbVersion = actorUser.tokenVersion || 0;
        const actorJwtVersion = decoded.act.tokenVersion !== undefined ? decoded.act.tokenVersion : 0;
        if (actorJwtVersion < actorDbVersion) {
            return {
                valid: false,
                statusCode: 401,
                error: 'ACTOR_SESSION_INVALIDATED',
                message: 'Impersonating administrator session has been invalidated.'
            };
        }

        if (actorUser.mustChangePassword) {
            return {
                valid: false,
                statusCode: 403,
                error: 'PASSWORD_CHANGE_REQUIRED',
                message: 'Impersonating administrator must change password.'
            };
        }
    }

    // Pending password change check (S01)
    if (user.mustChangePassword) {
        const allowedPaths = ['/api/auth/me', '/api/auth/change-password', '/api/auth/logout'];
        const currentPath = options.currentPath || '';
        const isPathAllowed = allowedPaths.some(p => currentPath.includes(p));

        if (!isPathAllowed) {
            return {
                valid: false,
                isPasswordChangeRequired: true,
                statusCode: 403,
                error: 'PASSWORD_CHANGE_REQUIRED',
                code: 'PASSWORD_CHANGE_REQUIRED',
                message: 'You must change your password before proceeding to other features.',
                user,
                actor: actorUser
            };
        }
    }

    return {
        valid: true,
        user,
        actor: actorUser
    };
}

module.exports = {
    validateUserPrincipal
};
