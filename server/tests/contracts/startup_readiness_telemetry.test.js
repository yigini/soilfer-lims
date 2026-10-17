const fs = require('fs');
const path = require('path');
const vm = require('vm');

const entryPath = path.resolve(__dirname, '../../index.js');
const telemetryPath = path.resolve(__dirname, '../../utils/startupReadinessTelemetry.js');
const expectedEvents = [
    'WORKFLOW', 'RESULT_ATTEMPT', 'SAMPLE_HOLD', 'REFERENCE', 'QC_RULE', 'QC_RUN',
    'QC_GATE_SCOPE', 'PT', 'NCR', 'RESULT_EQUIPMENT', 'WORK_ATTEMPT', 'WORK_REPEAT',
    'REPORTED_VALUE', 'REAGENT_LOT', 'RESULT_OVERRIDE', 'CALCULATION', 'CROSS_CHECK',
    'AMENDMENT', 'REPORT_REVISION', 'BENCH_CREDENTIAL', 'PREPARATION_RECORD',
    'INSTRUMENT_IMPORT', 'SAMPLE_CONTAINER', 'LAB_POLICY', 'CONTROL_CHART', 'LABEL_PRINT', 'ORDER_REVISION', 'SAMPLE_CUSTODY'
].map(name => `${name}_STARTUP_READY`);

// Run the real entrypoint and telemetry sources with synthetic prerequisites.
// Stop before app, adapters, schedulers or HTTP are loaded; no database exists.
function startup({ refuseAt = null } = {}) {
    let now = 1000;
    let calls = 0;
    let contextClosed = false;
    const loaded = [];
    const events = [];
    const failures = [];
    const afterReadiness = new Error('AFTER_READINESS_TEST_BOUNDARY');
    const exitBoundary = new Error('PROCESS_EXIT_TEST_BOUNDARY');
    const processFixture = {
        env: {},
        memoryUsage: () => ({ rss: 64 * 1024 * 1024 + calls * 4096 }),
        exit: code => { expect(code).toBe(1); expect(contextClosed).toBe(true); throw exitBoundary; }
    };
    const telemetryModule = { exports: {} };
    vm.runInNewContext(fs.readFileSync(telemetryPath, 'utf8'), {
        module: telemetryModule,
        process: processFixture,
        require: name => {
            expect(name).toBe('node:perf_hooks');
            return { performance: { now: () => now } };
        }
    }, { filename: telemetryPath });
    const requireFixture = name => {
        loaded.push(name);
        if (name === 'path') return path;
        if (name === 'fs') return { existsSync: () => false };
        if (name === 'dotenv') return { config: () => {} };
        if (name === './utils/startupReadinessTelemetry') return telemetryModule.exports;
        if (name === './utils/startupReadinessContext') return { createStartupReadinessContext: () => ({ close: () => { contextClosed = true; } }) };
        if (name.startsWith('./scripts/install_')) return new Proxy({}, {
            get: () => () => {
                calls++;
                now += calls * 7;
                if (calls === refuseAt) {
                    const error = new Error('synthetic schema refusal');
                    error.code = 'ORDER_REVISION_STARTUP_REQUIRED';
                    throw error;
                }
                return { classification: 'SYNTHETIC_READY', totalChanges: 0, retained: `stage-${calls}` };
            }
        });
        throw afterReadiness;
    };
    let stopped;
    try {
        vm.runInNewContext(fs.readFileSync(entryPath, 'utf8'), {
            __dirname: path.dirname(entryPath),
            require: requireFixture,
            process: processFixture,
            console: {
                log: value => events.push(JSON.parse(value)),
                error: value => failures.push(JSON.parse(value))
            }
        }, { filename: entryPath });
    } catch (error) { stopped = error; }
    expect(stopped).toBe(refuseAt === null ? afterReadiness : exitBoundary);
    expect(contextClosed).toBe(true);
    return { calls, events, failures, loaded };
}

test('all declared real READY call sites retain their order and results, with per-stage timing and RSS', () => {
    const result = startup();
    expect(result.calls).toBe(expectedEvents.length);
    expect(result.events.map(row => row.event)).toEqual(expectedEvents);
    result.events.forEach((row, index) => {
        expect(row).toMatchObject({ totalChanges: 0, elapsed_ms: (index + 1) * 7,
            rss_bytes: 64 * 1024 * 1024 + (index + 1) * 4096 });
    });
    expect(result.events.at(-1).retained).toBe(`stage-${expectedEvents.length}`);
    expect(result.failures).toEqual([]);
    expect(result.loaded).not.toContain('./app');
});

test.each([1, 24, 26, 27, expectedEvents.length])('stage %i refusal emits no READY for that stage or any successor, and cannot load the server', refuseAt => {
    const result = startup({ refuseAt });
    expect(result.calls).toBe(refuseAt);
    expect(result.events.map(row => row.event)).toEqual(expectedEvents.slice(0, refuseAt - 1));
    expect(result.failures).toEqual([expect.objectContaining({ error: 'ORDER_REVISION_STARTUP_REQUIRED',
        message: 'synthetic schema refusal' })]);
    expect(result.loaded).not.toContain('http');
    expect(result.loaded).not.toContain('./app');
});
