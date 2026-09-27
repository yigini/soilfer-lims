const crypto = require('crypto');
const prisma = require('../prisma');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/auth');

/**
 * Authentication Middleware for Soil Information System (SIS) Integration
 * Supports both:
 * 1. M2M API Keys via 'X-API-KEY' header or 'Authorization: Bearer slims_live_...'
 * 2. User JWT tokens for authenticated platform users (SUPER_ADMIN, LAB_MANAGER, etc.)
 */
const apiKeyAuth = async (req, res, next) => {
    try {
        const apiKeyHeader = req.headers['x-api-key'];
        const authHeader = req.headers['authorization'];
        
        let token = apiKeyHeader;
        if (!token && authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Missing API authentication. Provide an X-API-KEY header or Bearer token.'
            });
        }

        // 1. Check if token is an API Key (starts with 'slims_')
        if (token.startsWith('slims_')) {
            const keyHash = crypto.createHash('sha256').update(token).digest('hex');
            
            const apiKey = await prisma.apiKey.findUnique({
                where: { keyHash }
            });

            if (!apiKey || !apiKey.isActive) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Invalid or revoked API Key.'
                });
            }

            if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'API Key has expired.'
                });
            }

            // Update lastUsedAt asynchronously
            prisma.apiKey.update({
                where: { id: apiKey.id },
                data: { lastUsedAt: new Date() }
            }).catch(e => console.warn('[API_KEY] Failed to update lastUsedAt:', e.message));

            req.sisAuth = {
                type: 'API_KEY',
                id: apiKey.id,
                keyId: apiKey.id,
                connectionId: apiKey.name ? `conn_${crypto.createHash('sha256').update(String(apiKey.name)).digest('hex').substring(0, 16)}` : `conn_${apiKey.id}`,
                keyPrefix: apiKey.keyPrefix,
                name: apiKey.name,
                role: apiKey.role,
                capabilities: apiKey.capabilities ? (typeof apiKey.capabilities === 'string' ? JSON.parse(apiKey.capabilities) : apiKey.capabilities) : null,
                countries: apiKey.countries ? JSON.parse(apiKey.countries) : null,
                projects: apiKey.projects ? JSON.parse(apiKey.projects) : null,
                labs: apiKey.labs ? JSON.parse(apiKey.labs) : [] // SL-22: absent scope defaults to empty array (deny)
            };

            return next();
        }

        // 2. Otherwise verify as User JWT Token
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            const { validateUserPrincipal } = require('../services/sessionValidationService');
            const decision = await validateUserPrincipal(decoded, { currentPath: req.originalUrl || req.url });
            if (!decision.valid) {
                return res.status(decision.statusCode || 401).json({
                    error: decision.error,
                    code: decision.code || decision.error,
                    message: decision.message
                });
            }

            const user = decision.user;
            req.sisAuth = {
                type: 'JWT_USER',
                id: user.id,
                userId: user.id,
                connectionId: `conn_user_${user.id}`,
                name: user.name || user.username,
                role: user.role,
                capabilities: user.role === 'SUPER_ADMIN' ? ['*'] : null,
                countries: user.countries ? JSON.parse(user.countries) : null,
                projects: user.projects ? JSON.parse(user.projects) : null,
                labId: user.labId,
                labs: user.role === 'SUPER_ADMIN' ? ['*'] : (user.labId ? [user.labId] : [])
            };

            return next();
        } catch (jwtErr) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Invalid authentication credentials.'
            });
        }
    } catch (err) {
        console.error('[SIS_AUTH_ERROR]', err);
        return res.status(500).json({ error: 'Internal Server Error during authentication.' });
    }
};

const optionalApiKeyAuth = async (req, res, next) => {
    const apiKeyHeader = req.headers['x-api-key'];
    const authHeader = req.headers['authorization'];
    if (!apiKeyHeader && (!authHeader || !authHeader.startsWith('Bearer '))) {
        return next();
    }
    return apiKeyAuth(req, res, next);
};

apiKeyAuth.optional = optionalApiKeyAuth;

const requireRole = (allowedRoles = []) => (req, res, next) => {
    if (!req.sisAuth) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' });
    }
    const role = req.sisAuth.role;
    if (allowedRoles.length > 0 && !allowedRoles.includes(role) && role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'FORBIDDEN', message: `Role '${role}' is not authorized for this operation.` });
    }
    return next();
};

const requireCapability = (capability) => (req, res, next) => {
    if (!req.sisAuth) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' });
    }
    const role = req.sisAuth.role;
    if (role === 'SUPER_ADMIN') {
        return next();
    }
    const caps = req.sisAuth.capabilities;
    if (Array.isArray(caps) && !caps.includes(capability) && !caps.includes('*')) {
        return res.status(403).json({
            error: 'FORBIDDEN',
            code: 'INSUFFICIENT_CAPABILITY',
            message: `Connection lacks required capability '${capability}'.`
        });
    }
    return next();
};

apiKeyAuth.requireRole = requireRole;
apiKeyAuth.requireCapability = requireCapability;

module.exports = apiKeyAuth;
module.exports.optional = optionalApiKeyAuth;
module.exports.requireRole = requireRole;
module.exports.requireCapability = requireCapability;


