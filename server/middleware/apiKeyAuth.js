const crypto = require('crypto');
const prisma = require('../prisma');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/auth');

function parseScopeArray(val, isLab = false) {
    if (val === null || val === undefined) return isLab ? [] : ['*'];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
        try {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) return parsed;
            return [parsed];
        } catch (e) {
            return [val];
        }
    }
    return [];
}

function intersectScopeArrays(keyScope, connScope, isLab = false) {
    const keyArr = parseScopeArray(keyScope, isLab);
    const connArr = parseScopeArray(connScope, isLab);

    if (isLab) {
        if (keyArr.length === 0 || connArr.length === 0) {
            return [];
        }
    }

    const keyHasWildcard = keyArr.includes('*');
    const connHasWildcard = connArr.includes('*');

    if (keyHasWildcard && connHasWildcard) {
        return ['*'];
    }
    if (keyHasWildcard) {
        return connArr.filter(x => x !== '*');
    }
    if (connHasWildcard) {
        return keyArr.filter(x => x !== '*');
    }
    const connSet = new Set(connArr);
    return keyArr.filter(x => connSet.has(x) && x !== '*');
}

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

            if (!apiKey) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    code: 'UNAUTHORIZED',
                    message: 'Invalid or revoked API Key.'
                });
            }

            if (!apiKey.isActive) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    code: 'KEY_RETIRED',
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

            const effectiveConnectionId = apiKey.connectionId;
            let conn = null;
            let keyLink = null;

            if (db) {
                try {
                    if (effectiveConnectionId) {
                        conn = db.prepare('SELECT * FROM _exchange_connections WHERE id = ?').get(effectiveConnectionId);
                    }
                    if (!conn) {
                        keyLink = db.prepare('SELECT id, connection_id, key_status, rotated_at FROM _exchange_connection_keys WHERE api_key_id = ?').get(apiKey.id);
                        if (keyLink && keyLink.connection_id) {
                            conn = db.prepare('SELECT * FROM _exchange_connections WHERE id = ?').get(keyLink.connection_id);
                        }
                    } else {
                        keyLink = db.prepare('SELECT id, connection_id, key_status, rotated_at FROM _exchange_connection_keys WHERE connection_id = ? AND api_key_id = ?').get(conn.id, apiKey.id);
                    }
                } catch (e) {
                    console.warn('[API_KEY_AUTH] Failed to query connection state:', e.message);
                }
            }

            // Managed connection/key relation must be authoritative and fail closed when absent, malformed or unavailable.
            // Do NOT auto-recreate missing or deleted connections on GET/auth requests.
            if (!conn) {
                if (effectiveConnectionId || (req.baseUrl && req.baseUrl.startsWith('/api/v2'))) {
                    return res.status(403).json({
                        error: 'Forbidden',
                        code: 'CONNECTION_NOT_FOUND',
                        message: `Exchange connection '${effectiveConnectionId || `conn_${apiKey.id}`}' not found or unavailable.`
                    });
                }
            } else if (db) {
                // When managed connection exists, require a valid, unambiguous ACTIVE key-to-current-connection link (R3, R4)
                const hasKeysTable = Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_exchange_connection_keys'").get());
                if (hasKeysTable) {
                    if (!keyLink) {
                        return res.status(403).json({
                            error: 'Forbidden',
                            code: 'CONNECTION_LINK_MISSING',
                            message: `API Key '${apiKey.id}' lacks an active authoritative connection linkage.`
                        });
                    }
                    if (keyLink.key_status === 'ACTIVE') {
                        // Replacement verification: when active replacement key authenticates, retire ONLY its bound prior rotating key
                        try {
                            const hasOpsTable = Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_exchange_rotation_operations'").get());
                            if (hasOpsTable) {
                                const pendingOp = db.prepare("SELECT idempotency_key, old_key_id FROM _exchange_rotation_operations WHERE replacement_key_id = ? AND status = 'COMMITTED'").get(apiKey.id);
                                if (pendingOp && pendingOp.old_key_id) {
                                    const retireTx = db.transaction(() => {
                                        db.prepare("UPDATE _exchange_rotation_operations SET status = 'CONFIRMED' WHERE idempotency_key = ?").run(pendingOp.idempotency_key);
                                        db.prepare("UPDATE _exchange_connection_keys SET key_status = 'RETIRED' WHERE api_key_id = ? AND key_status = 'ROTATING'").run(pendingOp.old_key_id);
                                        db.prepare("UPDATE ApiKey SET isActive = 0 WHERE id = ?").run(pendingOp.old_key_id);
                                    });
                                    retireTx();
                                }
                            }
                        } catch (e) {
                            console.error('[API_KEY_AUTH_ROTATION_ERR]', e);
                        }
                    } else if (keyLink.key_status === 'ROTATING') {
                        // Bounded overlap grace window (nominal 24 hours)
                        const rotatedAt = keyLink.rotated_at ? new Date(keyLink.rotated_at).getTime() : 0;
                        const age = Date.now() - rotatedAt;
                        if (age > 24 * 3600 * 1000) {
                            try {
                                db.prepare("UPDATE _exchange_connection_keys SET key_status = 'RETIRED' WHERE id = ?").run(keyLink.id);
                                db.prepare("UPDATE ApiKey SET isActive = 0 WHERE id = ?").run(apiKey.id);
                            } catch (e) {}
                            return res.status(401).json({
                                error: 'Unauthorized',
                                code: 'KEY_RETIRED',
                                message: `API Key '${apiKey.id}' rotation overlap window has expired.`
                            });
                        }
                        // Within bounded overlap: allow authentication
                    } else {
                        return res.status(401).json({
                            error: 'Unauthorized',
                            code: 'KEY_RETIRED',
                            message: `API Key '${apiKey.id}' has been retired or revoked.`
                        });
                    }
                }
            }

            // Authoritative connection status check: disabled connection halts all consumer requests
            if (conn && conn.status && conn.status !== 'ACTIVE') {
                return res.status(403).json({
                    error: 'Forbidden',
                    code: 'CONNECTION_DISABLED',
                    message: `Exchange connection '${conn.id}' is ${conn.status}.`
                });
            }

            // Optional rate limit per minute enforcement
            if (conn && conn.rate_limit_per_min && Number(conn.rate_limit_per_min) > 0) {
                const limit = Number(conn.rate_limit_per_min);
                const now = Date.now();
                if (!apiKeyAuth.rateLimitMap) {
                    apiKeyAuth.rateLimitMap = new Map();
                }
                let tracker = apiKeyAuth.rateLimitMap.get(conn.id);
                if (!tracker || now - tracker.windowStart > 60000) {
                    tracker = { count: 1, windowStart: now };
                    apiKeyAuth.rateLimitMap.set(conn.id, tracker);
                } else {
                    tracker.count++;
                    if (tracker.count > limit) {
                        return res.status(429).json({
                            error: 'Too Many Requests',
                            code: 'RATE_LIMIT_EXCEEDED',
                            message: `Rate limit of ${limit} requests/min exceeded for connection '${conn.id}'.`
                        });
                    }
                }
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

                let connCaps = [];
                if (conn && conn.capabilities !== undefined && conn.capabilities !== null) {
                    try {
                        connCaps = typeof conn.capabilities === 'string' ? JSON.parse(conn.capabilities) : conn.capabilities;
                        if (!Array.isArray(connCaps)) connCaps = [];
                    } catch (e) {
                        connCaps = [];
                    }
                } else {
                    connCaps = ['*'];
                }

                if (connCaps.includes('*') && keyCaps.includes('*')) {
                    effectiveCapabilities = ['*'];
                } else if (connCaps.includes('*')) {
                    effectiveCapabilities = keyCaps.filter(c => c !== '*');
                } else if (keyCaps.includes('*')) {
                    effectiveCapabilities = connCaps.filter(c => c !== '*');
                } else {
                    effectiveCapabilities = keyCaps.filter(c => connCaps.includes(c) && c !== '*');
                }
            }

            // Scopes intersection: Total shared set operation
            // When connection exists, intersect key and connection scopes (disjoint -> [], wildcard -> finite)
            // When legacy unmanaged key (V1), use key scopes directly with default-deny on absent labs
            let effectiveCountries;
            let effectiveProjects;
            let effectiveLabs;

            if (conn) {
                effectiveCountries = intersectScopeArrays(apiKey.countries, conn.countries, false);
                effectiveProjects = intersectScopeArrays(apiKey.projects, conn.projects, false);
                effectiveLabs = intersectScopeArrays(apiKey.labs, conn.labs, true);
            } else {
                effectiveCountries = parseScopeArray(apiKey.countries, false);
                effectiveProjects = parseScopeArray(apiKey.projects, false);
                effectiveLabs = parseScopeArray(apiKey.labs, true);
            }

            req.sisAuth = {
                type: 'API_KEY',
                id: apiKey.id,
                keyId: apiKey.id,
                connectionId: conn ? conn.id : (apiKey.connectionId || `conn_${apiKey.id}`),
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
                countries: user.role === 'SUPER_ADMIN' ? ['*'] : (user.countries ? (typeof user.countries === 'string' ? JSON.parse(user.countries) : user.countries) : []),
                projects: user.role === 'SUPER_ADMIN' ? ['*'] : (user.projects ? (typeof user.projects === 'string' ? JSON.parse(user.projects) : user.projects) : []),
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


