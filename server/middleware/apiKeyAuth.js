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

            const { getDb } = require('../services/exchangeStateService');
            let db = null;
            try {
                db = getDb();
            } catch (e) {
                db = null;
            }

            const effectiveConnectionId = apiKey.connectionId || `conn_${apiKey.id}`;
            let conn = null;
            let keyLink = null;

            if (db) {
                try {
                    conn = db.prepare('SELECT * FROM _exchange_connections WHERE id = ?').get(effectiveConnectionId);
                    if (!conn) {
                        keyLink = db.prepare('SELECT connection_id, key_status FROM _exchange_connection_keys WHERE api_key_id = ?').get(apiKey.id);
                        if (keyLink && keyLink.connection_id) {
                            conn = db.prepare('SELECT * FROM _exchange_connections WHERE id = ?').get(keyLink.connection_id);
                        }
                    } else {
                        keyLink = db.prepare('SELECT key_status FROM _exchange_connection_keys WHERE connection_id = ? AND api_key_id = ?').get(conn.id, apiKey.id);
                    }
                } catch (e) {
                    console.warn('[API_KEY_AUTH] Failed to query connection state:', e.message);
                }
            }

            // Explicit legacy migration policy: auto-provision active connection record for legacy keys
            if (!conn && db) {
                try {
                    const now = new Date().toISOString();
                    db.prepare(`
                        INSERT OR IGNORE INTO _exchange_connections (id, name, status, capabilities, countries, projects, labs, auth_version, created_at, updated_at)
                        VALUES (?, ?, 'ACTIVE', ?, ?, ?, ?, 1, ?, ?)
                    `).run(
                        effectiveConnectionId,
                        apiKey.name,
                        apiKey.capabilities || '[]',
                        apiKey.countries || null,
                        apiKey.projects || null,
                        apiKey.labs || '[]',
                        now,
                        now
                    );
                    db.prepare(`
                        INSERT OR IGNORE INTO _exchange_connection_keys (id, connection_id, api_key_id, key_status, created_at)
                        VALUES (?, ?, ?, 'ACTIVE', ?)
                    `).run(`conn_key_${apiKey.id}`, effectiveConnectionId, apiKey.id, now);
                    conn = db.prepare('SELECT * FROM _exchange_connections WHERE id = ?').get(effectiveConnectionId);
                } catch (e) {}
            }

            // Key retirement check
            if (keyLink && keyLink.key_status && keyLink.key_status !== 'ACTIVE') {
                return res.status(401).json({
                    error: 'Unauthorized',
                    code: 'KEY_RETIRED',
                    message: `API Key '${apiKey.id}' has been retired or revoked.`
                });
            }

            // Authoritative connection status check: disabled connection halts all consumer requests
            if (conn && conn.status && conn.status !== 'ACTIVE') {
                return res.status(403).json({
                    error: 'Forbidden',
                    code: 'CONNECTION_DISABLED',
                    message: `Exchange connection '${conn.id}' is ${conn.status}.`
                });
            }

            // Fail-closed capability resolution:
            // If apiKey.capabilities is null/undefined, key has no capability grants (fails closed).
            // If present, intersect with authoritative connection capabilities.
            let effectiveCapabilities = null;
            if (apiKey.capabilities !== null && apiKey.capabilities !== undefined) {
                let keyCaps = [];
                try {
                    keyCaps = typeof apiKey.capabilities === 'string' ? JSON.parse(apiKey.capabilities) : apiKey.capabilities;
                    if (!Array.isArray(keyCaps)) keyCaps = [];
                } catch (e) {
                    keyCaps = [];
                }

                if (conn && conn.capabilities !== undefined && conn.capabilities !== null) {
                    let connCaps = [];
                    try {
                        connCaps = typeof conn.capabilities === 'string' ? JSON.parse(conn.capabilities) : conn.capabilities;
                        if (!Array.isArray(connCaps)) connCaps = [];
                    } catch (e) {
                        connCaps = [];
                    }

                    if (connCaps.includes('*')) {
                        effectiveCapabilities = keyCaps;
                    } else if (keyCaps.includes('*')) {
                        effectiveCapabilities = connCaps;
                    } else {
                        effectiveCapabilities = keyCaps.filter(c => connCaps.includes(c));
                    }
                } else {
                    effectiveCapabilities = keyCaps;
                }
            }

            // Scopes intersection
            let effectiveCountries = apiKey.countries ? JSON.parse(apiKey.countries) : null;
            let effectiveProjects = apiKey.projects ? JSON.parse(apiKey.projects) : null;
            let effectiveLabs = apiKey.labs ? JSON.parse(apiKey.labs) : [];

            if (conn) {
                if (conn.countries) {
                    try {
                        const connCountries = JSON.parse(conn.countries);
                        if (Array.isArray(connCountries) && !connCountries.includes('*')) {
                            effectiveCountries = effectiveCountries ? effectiveCountries.filter(c => connCountries.includes(c) || c === '*') : connCountries;
                        }
                    } catch (e) {}
                }
                if (conn.projects) {
                    try {
                        const connProjects = JSON.parse(conn.projects);
                        if (Array.isArray(connProjects) && !connProjects.includes('*')) {
                            effectiveProjects = effectiveProjects ? effectiveProjects.filter(p => connProjects.includes(p) || p === '*') : connProjects;
                        }
                    } catch (e) {}
                }
                if (conn.labs) {
                    try {
                        const connLabs = JSON.parse(conn.labs);
                        if (Array.isArray(connLabs) && !connLabs.includes('*')) {
                            effectiveLabs = effectiveLabs.filter(l => connLabs.includes(l));
                        }
                    } catch (e) {}
                }
            }

            req.sisAuth = {
                type: 'API_KEY',
                id: apiKey.id,
                keyId: apiKey.id,
                connectionId: conn ? conn.id : effectiveConnectionId,
                authVersion: conn ? (conn.auth_version || 1) : 1,
                connectionStatus: conn ? (conn.status || 'ACTIVE') : 'ACTIVE',
                keyPrefix: apiKey.keyPrefix,
                name: apiKey.name,
                role: apiKey.role,
                capabilities: effectiveCapabilities,
                countries: effectiveCountries,
                projects: effectiveProjects,
                labs: effectiveLabs
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
    if (req.sisAuth.connectionStatus && req.sisAuth.connectionStatus !== 'ACTIVE') {
        return res.status(403).json({
            error: 'FORBIDDEN',
            code: 'CONNECTION_DISABLED',
            message: `Exchange connection '${req.sisAuth.connectionId}' is ${req.sisAuth.connectionStatus}.`
        });
    }
    const role = req.sisAuth.role;
    if (req.sisAuth.type !== 'API_KEY' && role === 'SUPER_ADMIN') {
        return next();
    }
    const caps = req.sisAuth.capabilities;
    if (!Array.isArray(caps) || (!caps.includes(capability) && !caps.includes('*'))) {
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


