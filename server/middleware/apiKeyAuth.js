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
                name: apiKey.name,
                role: apiKey.role,
                countries: apiKey.countries ? JSON.parse(apiKey.countries) : null,
                projects: apiKey.projects ? JSON.parse(apiKey.projects) : null,
                labs: apiKey.labs ? JSON.parse(apiKey.labs) : [] // SL-22: absent scope defaults to empty array (deny)
            };

            return next();
        }

        // 2. Otherwise verify as User JWT Token
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            const user = await prisma.user.findUnique({
                where: { id: String(decoded.id) }
            });

            if (!user || !user.isActive) {
                return res.status(401).json({ error: 'Unauthorized', message: 'User invalid or inactive.' });
            }

            req.sisAuth = {
                type: 'JWT_USER',
                name: user.name || user.username,
                role: user.role,
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

module.exports = apiKeyAuth;
