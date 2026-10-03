/**
 * National Data Exchange Request Correlation & Phase Timing Middleware
 * 
 * Implements Issue #140 Work Package A0:
 * - Generates bounded, unforgeable server-side correlation IDs (e.g. xchg_a1b2c3d4e5f60718).
 * - Never trusts or reflects arbitrary/unbounded client correlation headers.
 * - Always emits 'X-Request-Id' response header.
 * - Records minimal phase timings (auth, eligibility, count, list, mapping) for latency measurement.
 * - Emits no sensitive payloads, credentials, coordinates, or analytical results in logs.
 */

const crypto = require('crypto');

function exchangeCorrelationMiddleware(req, res, next) {
    // 1. Generate bounded, unforgeable server correlation ID
    const requestId = `xchg_${crypto.randomBytes(8).toString('hex')}`;
    req.exchangeRequestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    // 2. Initialize phase timing tracker
    const startWallTime = Date.now();
    const startHrTime = process.hrtime.bigint();
    const activePhases = new Map();

    req.exchangeTiming = {
        requestId,
        startTime: startWallTime,
        phases: {}
    };

    req.startPhase = function(phaseName) {
        if (!phaseName || typeof phaseName !== 'string') return;
        activePhases.set(phaseName, process.hrtime.bigint());
    };

    req.endPhase = function(phaseName) {
        if (!phaseName || typeof phaseName !== 'string') return null;
        const start = activePhases.get(phaseName);
        if (start) {
            activePhases.delete(phaseName);
            const diffNs = Number(process.hrtime.bigint() - start);
            const diffMs = Math.round((diffNs / 1000000) * 100) / 100; // ms with 2 decimals
            req.exchangeTiming.phases[phaseName] = Math.round(((req.exchangeTiming.phases[phaseName] || 0) + diffMs) * 100) / 100;
            return diffMs;
        }
        return null;
    };

    req.recordPhase = function(phaseName, durationMs) {
        if (phaseName && typeof durationMs === 'number' && !isNaN(durationMs)) {
            const rounded = Math.round(durationMs * 100) / 100;
            req.exchangeTiming.phases[phaseName] = Math.round(((req.exchangeTiming.phases[phaseName] || 0) + rounded) * 100) / 100;
        }
    };

    // 3. Operational telemetry on finish without leaking payloads
    res.on('finish', () => {
        // Clean up any unended phases
        for (const [phase, start] of activePhases.entries()) {
            const diffNs = Number(process.hrtime.bigint() - start);
            const diffMs = Math.round((diffNs / 1000000) * 100) / 100;
            req.exchangeTiming.phases[phase] = Math.round(((req.exchangeTiming.phases[phase] || 0) + diffMs) * 100) / 100;
        }
        activePhases.clear();

        const totalNs = Number(process.hrtime.bigint() - startHrTime);
        const totalMs = Math.round((totalNs / 1000000) * 100) / 100;
        req.exchangeTiming.totalDurationMs = totalMs;

        if (process.env.NODE_ENV !== 'test') {
            const phaseParts = Object.entries(req.exchangeTiming.phases)
                .map(([p, ms]) => `${p}=${ms}ms`)
                .join(' ');
            console.log(`[EXCHANGE_OP] id=${requestId} method=${req.method} url=${req.baseUrl || ''}${req.path} status=${res.statusCode} total=${totalMs}ms ${phaseParts}`.trim());
        }
    });

    next();
}

module.exports = exchangeCorrelationMiddleware;
