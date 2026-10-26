'use strict';

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const jwt = require('jsonwebtoken');

function readApiRateLimitConfig(env = process.env) {
    function positiveInteger(name, fallback) {
        const value = env[name] ?? String(fallback);
        if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
            throw new Error(`${name} must be a positive safe integer.`);
        }
        return Number(value);
    }
    return {
        userMax: positiveInteger('API_RATE_LIMIT_USER_MAX', 3000),
        anonymousMax: positiveInteger('API_RATE_LIMIT_ANON_MAX', 300),
        windowMs: 15 * 60 * 1000
    };
}

function createApiRateLimiter({ env = process.env, jwtSecret = env.JWT_SECRET, store } = {}) {
    const config = readApiRateLimitConfig(env);
    if (!jwtSecret) throw new Error('JWT_SECRET is required for API rate limiting.');
    const selectedBudget = Symbol('apiRateBudget');

    function budget(req) {
        if (req[selectedBudget]) return req[selectedBudget];
        const authorization = req.headers.authorization;
        const bearer = typeof authorization === 'string' && /^Bearer (\S+)$/i.exec(authorization);
        if (bearer) {
            try {
                // Verify signature and expiry; untrusted claims never select a user bucket.
                // Route authentication still checks active sessions, permissions and lab scope.
                const principal = jwt.verify(bearer[1], jwtSecret);
                if (typeof principal.id === 'string' && principal.id.trim() && principal.id.length <= 200) {
                    return (req[selectedBudget] = { key: `user:${principal.id}`, limit: config.userMax });
                }
            } catch { /* Invalid/expired JWTs share the anonymous IP budget. */ }
        }
        return (req[selectedBudget] = {
            key: `ip:${ipKeyGenerator(req.ip)}`,
            limit: config.anonymousMax
        });
    }

    return rateLimit({
        windowMs: config.windowMs,
        keyGenerator: req => budget(req).key,
        limit: req => budget(req).limit,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many API requests, please try again later.' },
        ...(store ? { store } : {})
    });
}

module.exports = { createApiRateLimiter, readApiRateLimitConfig };
