'use strict';

const { performance } = require('node:perf_hooks');

function beginReadinessStage() {
    return performance.now();
}

function readinessTelemetry(began) {
    return { elapsed_ms: performance.now() - began, rss_bytes: process.memoryUsage().rss };
}

module.exports = { beginReadinessStage, readinessTelemetry };
