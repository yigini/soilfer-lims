const jwt = require('jsonwebtoken');
const prisma = require('../prisma');

const { JWT_SECRET: SECRET_KEY } = require('../config/auth');
if (!SECRET_KEY) {
    throw new Error('JWT_SECRET is not defined in config/auth (checking .env)');
}

const { PERMISSIONS, getPermissionsForRole } = require('../config/roles');

/**
 * Middleware to verify JWT and attach user to request
 */
const verifyToken = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        console.warn(`[AUTH] Missing token at ${new Date().toISOString()} from ${req.ip}`);
        return res.status(401).json({ error: 'No token provided', code: 'NO_TOKEN' });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, SECRET_KEY);
    } catch (e) {
        if (e.name === 'TokenExpiredError') {
            console.warn(`[AUTH] Expired token from ${req.ip}: ${e.message}`);
            return res.status(401).json({
                error: 'Token expired',
                code: 'TOKEN_EXPIRED',
                message: 'Your session has expired. Please log in again.'
            });
        }
        console.warn(`[AUTH] Invalid token from ${req.ip}: ${e.message}`);
        return res.status(401).json({
            error: 'Invalid token',
            code: 'INVALID_TOKEN',
            message: 'Authentication token is invalid.'
        });
    }

    try {
        console.log(`[AUTH] Verifying token for ID: ${decoded.id} (Type: ${typeof decoded.id})`);

        const { validateUserPrincipal } = require('../services/sessionValidationService');
        const currentPath = (req.baseUrl || '') + (req.path || '');
        const decision = await validateUserPrincipal(decoded, { currentPath });

        if (!decision.valid) {
            if (decision.isPasswordChangeRequired) {
                return res.status(403).json({
                    error: 'PASSWORD_CHANGE_REQUIRED',
                    code: 'PASSWORD_CHANGE_REQUIRED',
                    message: decision.message
                });
            }
            return res.status(decision.statusCode || 401).json({
                error: decision.error,
                code: decision.code || decision.error,
                message: decision.message
            });
        }

        const user = decision.user;

        // Resolve lab operational status without blocking basic authentication (IR-10)
        if (user.labId && user.role !== 'SUPER_ADMIN') {
            try {
                const lab = await prisma.lab.findUnique({
                    where: { id: user.labId },
                    select: { isActive: true }
                });
                user.labIsActive = lab ? lab.isActive : true;
            } catch (labErr) {
                console.warn(`[AUTH] Could not resolve lab status for ${user.labId}: ${labErr.message}`);
                user.labIsActive = true;
            }
        }

        const safeJsonParse = (val, fallback = []) => {
            if (!val) return fallback;
            if (Array.isArray(val)) return val;
            if (typeof val !== 'string') return fallback;
            try {
                return JSON.parse(val);
            } catch {
                return fallback;
            }
        };

        // Sanitize and Parse JSON fields for SQLite
        const { password: _, ...safeUser } = user;
        req.isImpersonating = !!decoded.act;
        req.actor = decoded.act || null;
        req.user = {
            ...safeUser,
            themePreference: user.themePreference || 'light',
            isImpersonated: !!decoded.act,
            countries: safeJsonParse(user.countries),
            projects: safeJsonParse(user.projects),
            permissions: getPermissionsForRole(user.role)
        };

        // Sync locale with user preference
        if (req.user.language) {
            req.locale = req.user.language;
        }

        next();
    } catch (dbErr) {
        console.error(`[AUTH] Internal error verifying token from ${req.ip}:`, dbErr);
        return res.status(500).json({
            error: 'Internal authentication service error',
            code: 'AUTH_INTERNAL_ERROR',
            message: 'A system error occurred while verifying credentials.'
        });
    }
};

/**
 * Factory to check strictly defined permissions from the Matrix
 * @param {string} permissionKey Key from PERMISSIONS object (e.g. 'CREATE_SAMPLE')
 */
const checkPermission = (permissionKey) => {
    return (req, res, next) => {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'User not authenticated' });

        const currentRole = user.role ? user.role.trim() : '';
        const currentKey = permissionKey ? permissionKey.trim() : '';
        const allowedRoles = PERMISSIONS[currentKey];

        if (!allowedRoles) {
            console.error(`Permission key '${currentKey}' not found in matrix.`);
            return res.status(500).json({ error: 'System configuration error' });
        }

        if (!allowedRoles.includes(currentRole)) {
            console.warn(`[AUTH] RBAC Denied: User ${user.username} (${currentRole}) attempted ${currentKey}. Allowed roles: ${JSON.stringify(allowedRoles)}`);
            return res.status(403).json({ error: `Access denied. Role '${currentRole}' lacks permission '${currentKey}'.` });
        }

        next();
    };
};

module.exports = {
    verifyToken,
    checkPermission,
    PERMISSIONS
};
