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
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        console.log(`[AUTH] Verifying token for ID: ${decoded.id} (Type: ${typeof decoded.id})`);

        const user = await prisma.user.findUnique({
            where: { id: String(decoded.id) }
        });

        if (!user) {
            console.error(`[AUTH] User NOT FOUND for ID: ${decoded.id}`);
            return res.status(401).json({ error: 'User invalid' });
        }

        if (user.isActive === false) {
            console.warn(`[AUTH] Access denied for deactivated user ID: ${user.id} (${user.username})`);
            return res.status(401).json({ error: 'Account has been deactivated' });
        }

        // Check session tokenVersion invalidation
        const dbTokenVersion = user.tokenVersion || 0;
        const jwtTokenVersion = decoded.tokenVersion !== undefined ? decoded.tokenVersion : 0;
        if (jwtTokenVersion < dbTokenVersion) {
            console.warn(`[AUTH] Token invalidated by password change for user ID: ${user.id}`);
            return res.status(401).json({ error: 'SESSION_INVALIDATED', message: 'Token has been invalidated. Please log in again.' });
        }

        // Sanitize and Parse JSON fields for SQLite
        const { password: _, ...safeUser } = user;
        req.user = {
            ...safeUser,
            countries: typeof user.countries === 'string' ? JSON.parse(user.countries) : (user.countries || []),
            projects: typeof user.projects === 'string' ? JSON.parse(user.projects) : (user.projects || []),
            permissions: getPermissionsForRole(user.role)
        };

        // Enforce mustChangePassword gate on all non-whitelisted endpoints
        if (user.mustChangePassword) {
            const allowedPaths = ['/api/auth/me', '/api/auth/change-password', '/api/auth/logout'];
            const currentPath = (req.baseUrl || '') + (req.path || '');
            if (!allowedPaths.some(p => currentPath.includes(p))) {
                return res.status(403).json({
                    error: 'PASSWORD_CHANGE_REQUIRED',
                    message: 'You must change your password before proceeding to other features.'
                });
            }
        }

        // Sync locale with user preference
        if (req.user.language) {
            req.locale = req.user.language;
        }

        next();
    } catch (e) {
        console.warn(`[AUTH] Invalid token from ${req.ip}: ${e.message}`);
        return res.status(403).json({ error: 'Invalid token' });
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
