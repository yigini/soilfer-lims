'use strict';

const net = require('node:net');

const loopback = new net.BlockList();
loopback.addSubnet('127.0.0.0', 8, 'ipv4');
loopback.addAddress('::1', 'ipv6');

function isLoopback(address) {
    const family = net.isIP(address || '');
    return family !== 0 && loopback.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

function readHttpSecurityConfig(env = process.env) {
    const production = env.NODE_ENV === 'production';
    const allowedOrigins = new Set();
    if (production) {
        for (const entry of (env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean)) {
            let url;
            try { url = new URL(entry); } catch { /* Refuse without echoing configuration input. */ }
            if (!url || url.protocol !== 'https:' || url.username || url.password ||
                url.pathname !== '/' || url.search || url.hash) {
                throw new Error('ALLOWED_ORIGINS must contain only HTTPS origins, without credentials, paths, queries or fragments.');
            }
            allowedOrigins.add(url.origin);
        }
    }
    const proxy = (env.TRUST_PROXY || '').trim() || 'loopback';
    const trustProxy = proxy === 'false' ? false : proxy === 'true' ? true :
        /^\d+$/.test(proxy) ? Number(proxy) : proxy.split(',').map(value => value.trim());
    return { production, allowedOrigins, trustProxy,
        showHealthVersion: env.HEALTH_SHOW_VERSION === 'true' };
}

function corsOptions(req, config) {
    if (!config.production) return { origin: '*', credentials: true };
    const origin = req.get('Origin');
    // Browsers do not need a CORS grant for same-origin requests. Explicitly
    // recognize one when Origin is present; a missing header grants no origin.
    let sameOrigin = false;
    try { sameOrigin = origin === new URL(`${req.protocol}://${req.get('host')}`).origin; } catch { /* Invalid Host. */ }
    return { origin: origin?.startsWith('https://') && (sameOrigin || config.allowedOrigins.has(origin)) ? origin : false,
        credentials: true };
}

function healthResponse(req, res, config, version, includeName = false) {
    const body = { status: 'ok' };
    // req.ip uses Express's configured proxy trust chain, not a caller-supplied
    // X-Forwarded-For value or the proxy socket alone.
    if (config.showHealthVersion || isLoopback(req.ip)) {
        if (includeName) body.name = 'soilfer-lims';
        body.version = version;
        body.uptime = process.uptime();
    }
    res.set('Cache-Control', 'no-store');
    return res.json(body);
}

module.exports = { readHttpSecurityConfig, corsOptions, healthResponse, isLoopback };
