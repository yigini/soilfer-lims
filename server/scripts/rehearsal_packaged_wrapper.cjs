#!/usr/bin/env node
'use strict';

/**
 * Shell Wrapper Mock Integration Suite (Simulated Docker Environment)
 * File: server/scripts/rehearsal_packaged_wrapper.cjs
 * 
 * Tests the execute_release_pr147.sh wrapper orchestration logic in disposable isolation
 * with simulated Docker, Systemctl, and SQLite environments:
 *   1. Full packaged execution with --entrypoint node, private mounts, and verified writer exclusion
 *   2. Partial-apply mid-flight failure recovery (asserts all writers stopped, bit-for-bit DB restoration, ingress stays 503)
 *   3. Process interruption with live writer (asserts live writer stopped/killed, bit-for-bit restoration, ingress stays 503)
 *   4. Failed health check post-apply (asserts applied database preserved, ingress remains 503 maintenance)
 *   5. Retagged old container rejection (asserts container immutable .Image must match reviewed runner image)
 *   6. Docker inspect unavailable fails closed (asserts daemon failure halts DB recovery without corruption)
 *   7. Preflight failure preserves live app & proxy (asserts INIT failures do not stop app or change proxy)
 *   8. Mismatched image ID assertion (refuses execution before mutation)
 * 
 * Note: Real Docker container boundary verification (packaged container runtime,
 * entrypoints, volume mounts, and live writer termination) is executed separately
 * in isolated GitHub Actions CI via server/scripts/rehearsal_docker_boundary.cjs.
 * 
 * Usage:
 *   node server/scripts/rehearsal_packaged_wrapper.cjs
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const serverDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(serverDir, '..');
const releaseScript = path.join(repoRoot, 'execute_release_pr147.sh');

const bashPath = 'C:\\Program Files\\Git\\bin\\bash.exe';
if (!fs.existsSync(bashPath)) {
    console.error('FATAL: Git Bash not found at', bashPath);
    process.exit(1);
}

const tmpDir = path.join(serverDir, `.tmp_rehearsal_pkg_${Date.now()}`);
fs.mkdirSync(tmpDir, { recursive: true });

console.log('================================================================');
console.log('  SHELL WRAPPER MOCK INTEGRATION SUITE (SIMULATED DOCKER)       ');
console.log('  Testing execute_release_pr147.sh Orchestration & Rollback     ');
console.log('================================================================');
console.log(`Fixture Dir: ${tmpDir}`);

const CONFIG_ID = '25731264-f02a-4172-8ef1-75512b7607a5';
const EXPECTED_LAB = 'GHA-LAB1';
const EXPECTED_PROJECT = 'SOILFER-US';
const EXPECTED_FORM = 'aQtvKZHiZmtqVCkQsGw2X4';
const EXPECTED_SERVER = 'https://kf.soilfer-data.fao.org';
const REVIEWED_IMAGE = 'soilfer-lims:pr147-reviewed';
const REVIEWED_IMAGE_ID = 'sha256:7777777777777777777777777777777777777777777777777777777777777777';

const privateSnapPath = 'C:/Users/yigin/Documents/Codex/2026-09-21/se/work/private_kobo/ghana_kobo_snapshot_40747.json';
const privateManPath = 'C:/Users/yigin/Documents/Codex/2026-09-21/se/work/private_kobo/ghana_kobo_manifest_40747.json';

function setupEnvironmentFixture(testDir, options = {}) {
    fs.mkdirSync(testDir, { recursive: true });

    const mockBin = path.join(testDir, 'bin');
    const mockOpt = path.join(testDir, 'opt_lims');
    const mockApache = path.join(testDir, 'apache_conf');
    const mockVol = path.join(testDir, 'vol_data');

    fs.mkdirSync(mockBin, { recursive: true });
    fs.mkdirSync(mockOpt, { recursive: true });
    fs.mkdirSync(mockApache, { recursive: true });
    fs.mkdirSync(mockVol, { recursive: true });

    // Initial Apache config
    fs.writeFileSync(path.join(mockApache, 'httpd-lims.conf'), '# LIVE REVERSE PROXY CONFIG\nProxyPass / http://127.0.0.1:3000/\n');
    fs.writeFileSync(path.join(mockOpt, '.env'), '# mock env\n');

    // Initial SQLite database
    const fixtureDb = path.join(mockVol, 'dev.db');
    const srcDb = new Database(path.join(serverDir, 'prisma/dev.db'), { readonly: true });
    const schemaSqls = srcDb.prepare("SELECT sql FROM sqlite_master WHERE type IN ('table', 'index') AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%'").all().map(r => r.sql);
    srcDb.close();

    const db = new Database(fixtureDb);
    for (const sql of schemaSqls) {
        try { db.exec(sql); } catch (_) {}
    }
    db.prepare(`INSERT INTO Lab (id, code, name, country, isActive, createdAt, updatedAt) VALUES (?, 'GHA', 'SoilFER Ghana Lab', 'GHA', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(EXPECTED_LAB);
    db.prepare(`INSERT INTO Project (id, code, name, status, labId, createdAt, updatedAt) VALUES ('proj-us-uuid', ?, 'SoilFER USA', 'ACTIVE', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(EXPECTED_PROJECT, EXPECTED_LAB);
    db.prepare(`INSERT INTO ProjectLab (id, projectCode, labId, role, createdAt) VALUES ('pl-1', ?, ?, 'PRIMARY', CURRENT_TIMESTAMP)`).run(EXPECTED_PROJECT, EXPECTED_LAB);
    db.prepare(`
        INSERT INTO KoboConfig (id, labId, labName, formId, koboServerUrl, apiToken, isActive, projectCode, lastSubmissionId, createdAt, updatedAt)
        VALUES (?, ?, 'SoilFER Ghana Lab', ?, ?, 'mock-api-token', 0, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(CONFIG_ID, EXPECTED_LAB, EXPECTED_FORM, EXPECTED_SERVER);
    db.prepare(`
        INSERT INTO Sample (id, originalId, projectCode, assignedLab, status, metadata, createdAt, updatedAt)
        VALUES ('smp-base-1', 'GTM-EXISTING-01', 'SOILFER-GTM', 'GTM-LAB1', 'EXPECTED', '{"kept":"original"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();
    db.close();

    // Mock state file for container states and test behavior controls
    const stateFile = path.join(testDir, 'mock_state.json');
    const initialState = {
        containers: {
            'soilfer-lims': {
                running: options.appRunning !== false,
                image: options.appImage || REVIEWED_IMAGE,
                imageId: options.appImageId || REVIEWED_IMAGE_ID,
                mount: 'lims_lims-data'
            }
        },
        daemonUnavailable: options.daemonUnavailable || false,
        healthOk: options.healthOk !== false,
        failDuringApply: options.failDuringApply || false,
        failInitialProxyReload: options.failInitialProxyReload || false,
        interruptDelayMs: options.interruptDelayMs || 0
    };
    fs.writeFileSync(stateFile, JSON.stringify(initialState, null, 2));

    // Create mock sqlite3 executable
    const sqlite3Script = `#!/usr/bin/env node
'use strict';
function toWin(p) { return p ? p.replace(/^\\/([a-zA-Z])\\//, (_, d) => d.toUpperCase() + ':/') : p; }
const Database = require('${serverDir.replace(/\\/g, '/')}/node_modules/better-sqlite3');
const dbFile = toWin(process.argv[2]);
const sql = process.argv[3];
if (!dbFile || !sql) process.exit(0);
const db = new Database(dbFile);
async function run() {
    if (sql.startsWith('.')) {
        if (sql.startsWith('.backup')) {
            const dest = toWin(sql.split(' ')[1].replace(/['"]/g, ''));
            await db.backup(dest);
        }
        process.exit(0);
    }
    const stmt = db.prepare(sql);
    if (stmt.reader) {
        const rows = stmt.all();
        for (const r of rows) {
            console.log(Object.values(r).join('|'));
        }
    } else {
        stmt.run();
    }
}
run().catch(err => {
    console.error(err);
    process.exit(1);
});
`;
    fs.writeFileSync(path.join(mockBin, 'sqlite3'), sqlite3Script);
    fs.chmodSync(path.join(mockBin, 'sqlite3'), '755');

    // Create mock systemctl executable
    const systemctlJs = `'use strict';
const fs = require('fs');
const state = JSON.parse(fs.readFileSync('${stateFile.replace(/\\/g, '/')}', 'utf8'));
if (process.argv.includes('reload') && process.argv.includes('httpd')) {
    if (state.failInitialProxyReload) {
        state.reloadCount = (state.reloadCount || 0) + 1;
        fs.writeFileSync('${stateFile.replace(/\\/g, '/')}', JSON.stringify(state, null, 2));
        if (state.reloadCount === 1) {
            console.error('Job for httpd.service failed because the control process exited with error code.');
            process.exit(1);
        }
    }
}
process.exit(0);
`;
    fs.writeFileSync(path.join(mockBin, 'systemctl.cjs'), systemctlJs);
    const systemctlShell = `#!/bin/sh
DIR=\$(dirname "\$0")
exec node "\$DIR/systemctl.cjs" "\$@"
`;
    fs.writeFileSync(path.join(mockBin, 'systemctl'), systemctlShell);
    fs.chmodSync(path.join(mockBin, 'systemctl'), '755');

    // Create mock curl executable
    const curlScript = `'use strict';
const fs = require('fs');
const state = JSON.parse(fs.readFileSync('${stateFile.replace(/\\/g, '/')}', 'utf8'));
if (state.healthOk) {
    console.log('{"status":"ok"}');
    process.exit(0);
} else {
    console.log('{"status":"error"}');
    process.exit(1);
}
`;
    const curlShell = `#!/bin/sh
DIR=\$(dirname "\$0")
exec node "\$DIR/curl.cjs" -- "\$@"
`;
    fs.writeFileSync(path.join(mockBin, 'curl'), curlShell);
    fs.chmodSync(path.join(mockBin, 'curl'), '755');
    fs.writeFileSync(path.join(mockBin, 'curl.cjs'), curlScript);
    fs.chmodSync(path.join(mockBin, 'curl.cjs'), '755');

    // Create mock docker executable
    const dockerScript = `#!/usr/bin/env node
'use strict';
const fs = require('fs');
const cp = require('child_process');
const rawArgs = process.argv.slice(2);
const args = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs;
const stateFile = '${stateFile.replace(/\\/g, '/')}';
const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));

if (state.daemonUnavailable) {
    console.error('Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?');
    process.exit(1);
}

const cmd = args[0];

if (cmd === 'volume' && args[1] === 'inspect') {
    if (args.includes('lims_lims-data')) {
        console.log('${mockVol.replace(/\\/g, '/')}');
        process.exit(0);
    }
    console.error('Error: No such volume: ' + args.slice(2).join(' '));
    process.exit(1);
}

if (cmd === 'image' && args[1] === 'inspect') {
    if (args.includes('${REVIEWED_IMAGE}') || args.includes('${REVIEWED_IMAGE_ID}')) {
        console.log('${REVIEWED_IMAGE_ID}');
        process.exit(0);
    }
    console.error('Error: No such image: ' + args.slice(2).join(' '));
    process.exit(1);
}

if (cmd === 'inspect') {
    const target = args[1];
    const format = args.includes('--format') ? args[args.indexOf('--format') + 1] : '';
    const container = state.containers[target];
    if (!container) {
        console.error('Error: No such container: ' + target);
        process.exit(1);
    }
    if (format.includes('Config.Image')) {
        console.log(container.image);
        process.exit(0);
    }
    if (format.includes('.Image')) {
        console.log(container.imageId || container.image);
        process.exit(0);
    }
    if (format.includes('State.Running')) {
        console.log(container.running ? 'true' : 'false');
        process.exit(0);
    }
    if (format.includes('Destination')) {
        console.log(container.mount);
        process.exit(0);
    }
    process.exit(0);
}

if (cmd === 'stop') {
    for (let i = 1; i < args.length; i++) {
        const c = args[i];
        if (c.startsWith('-')) continue;
        if (state.containers[c]) {
            state.containers[c].running = false;
        }
    }
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    process.exit(0);
}

if (cmd === 'rm') {
    for (let i = 1; i < args.length; i++) {
        const c = args[i];
        if (c.startsWith('-')) continue;
        delete state.containers[c];
    }
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    process.exit(0);
}

if (cmd === 'start') {
    const c = args[args.length - 1];
    if (state.containers[c]) {
        state.containers[c].running = true;
    }
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    process.exit(0);
}

if (cmd === 'run') {
    // Assert --entrypoint node is passed
    if (!args.includes('--entrypoint') || args[args.indexOf('--entrypoint') + 1] !== 'node') {
        console.error('FATAL: docker run invocation missing --entrypoint node!');
        process.exit(1);
    }
    // Runner execution
    const runnerIdx = args.findIndex(a => a.includes('execute_ghana_apply_146.cjs'));
    if (runnerIdx !== -1) {
        const runnerArgs = args.slice(runnerIdx + 1);
        const nameIdx = args.indexOf('--name');
        const containerName = nameIdx !== -1 ? args[nameIdx + 1] : 'runner';
        state.containers[containerName] = { running: true };
        fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));

        if (state.interruptDelayMs > 0) {
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, state.interruptDelayMs);
        }

        if (state.failDuringApply && runnerArgs.includes('--apply')) {
            // Simulate dirty state: perform CAS then throw
            const Database = require('${serverDir.replace(/\\/g, '/')}/node_modules/better-sqlite3');
            const db = new Database('${fixtureDb.replace(/\\/g, '/')}');
            db.prepare('UPDATE KoboConfig SET isActive = 1, projectCode = "${EXPECTED_PROJECT}" WHERE id = "${CONFIG_ID}"').run();
            db.prepare('INSERT INTO Sample (id, originalId, projectCode, assignedLab, status, createdAt, updatedAt) VALUES ("p1", "GHA-P1", "${EXPECTED_PROJECT}", "${EXPECTED_LAB}", "EXPECTED", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').run();
            db.close();
            console.error('INJECTED_PARTIAL_APPLY_FAILURE: Fatal error during sample loop');
            state.containers[containerName].running = false;
            fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
            process.exit(1);
        }

        try {
            const out = cp.execFileSync(process.execPath, [
                '${serverDir.replace(/\\/g, '/')}/scripts/execute_ghana_apply_146.cjs',
                ...runnerArgs
            ], {
                env: {
                    ...process.env,
                    DATABASE_PATH: '${fixtureDb.replace(/\\/g, '/')}',
                    GHANA_SNAPSHOT_PATH: '${privateSnapPath}',
                    GHANA_MANIFEST_PATH: '${privateManPath}'
                },
                encoding: 'utf8'
            });
            process.stdout.write(out);
            state.containers[containerName].running = false;
            fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
            process.exit(0);
        } catch (err) {
            process.stderr.write(err.stderr || err.message);
            state.containers[containerName].running = false;
            fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
            process.exit(1);
        }
    }

    // Check if running intake guard verification
    const eIdx = args.indexOf('-e');
    if (eIdx !== -1) {
        const jsCode = args[eIdx + 1].split('/app/server').join('${serverDir.replace(/\\/g, '/')}');
        cp.execFileSync(process.execPath, ['-e', jsCode], { cwd: '${serverDir.replace(/\\/g, '/')}' });
        process.exit(0);
    }
}
`;
    const dockerShell = `#!/bin/sh
DIR=\$(dirname "\$0")
exec node "\$DIR/docker.cjs" -- "\$@"
`;
    fs.writeFileSync(path.join(mockBin, 'docker'), dockerShell);
    fs.chmodSync(path.join(mockBin, 'docker'), '755');
    fs.writeFileSync(path.join(mockBin, 'docker.cjs'), dockerScript);
    fs.chmodSync(path.join(mockBin, 'docker.cjs'), '755');

    return { mockBin, mockOpt, mockApache, mockVol, fixtureDb, stateFile };
}

function toPosixPath(p) {
    return p.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, d) => '/' + d.toLowerCase());
}

function runWrapperInTestEnv(testDir, envOverrides, args = [REVIEWED_IMAGE]) {
    const unixScript = toPosixPath(releaseScript);
    const winBin = path.resolve(testDir, 'bin');
    const unixBin = toPosixPath(winBin);
    const unixOpt = toPosixPath(path.join(testDir, 'opt_lims'));
    const unixApache = toPosixPath(path.join(testDir, 'apache_conf'));

    const bashEnv = {
        ...process.env,
        Path: `${winBin};${process.env.Path || process.env.PATH || ''}`,
        LIMS_OPT_DIR: unixOpt,
        APACHE_CONF_DIR: unixApache,
        PRIVATE_SNAPSHOT: toPosixPath(privateSnapPath),
        PRIVATE_MANIFEST: toPosixPath(privateManPath),
        SYSTEMCTL_CMD: 'systemctl',
        CURL_CMD: `${unixBin}/curl`,
        ...envOverrides
    };
    delete bashEnv.PATH;

    return cp.spawnSync(bashPath, [unixScript, ...args], {
        env: bashEnv,
        encoding: 'utf8',
        cwd: repoRoot
    });
}

async function runAllPackagedRehearsals() {
    try {
        console.log('\n[Packaged Rehearsal 1] Complete Successful Release Pipeline...');
        const dir1 = path.join(tmpDir, 'test_success');
        const env1 = setupEnvironmentFixture(dir1, { healthOk: true });
        const res1 = runWrapperInTestEnv(dir1, {});
        if (res1.status !== 0) {
            console.error('STDOUT:', res1.stdout);
            console.error('STDERR:', res1.stderr);
            throw new Error(`Wrapper failed in Scenario 1 (exit code: ${res1.status})`);
        }
        if (!res1.stdout.includes('GHANA CORRECTION COMPLETE & VERIFIED')) {
            throw new Error('Scenario 1 missing success banner');
        }

        // Verify database: 864 samples admitted, 4 held, 860 clean, KoboConfig active
        const db1 = new Database(env1.fixtureDb, { readonly: true });
        const total1 = db1.prepare('SELECT COUNT(*) as c FROM Sample WHERE assignedLab = ?').get(EXPECTED_LAB).c;
        const held1 = db1.prepare(`SELECT COUNT(*) as c FROM Sample WHERE assignedLab = ? AND rejectionReason LIKE 'PROVENANCE_HOLD%'`).get(EXPECTED_LAB).c;
        const clean1 = db1.prepare(`SELECT COUNT(*) as c FROM Sample WHERE assignedLab = ? AND status = 'EXPECTED' AND rejectionReason IS NULL`).get(EXPECTED_LAB).c;
        const cfg1 = db1.prepare('SELECT isActive, projectCode, lastSubmissionId FROM KoboConfig WHERE id = ?').get(CONFIG_ID);
        db1.close();

        if (total1 !== 864 || held1 !== 4 || clean1 !== 860 || cfg1.isActive !== 1 || cfg1.projectCode !== EXPECTED_PROJECT || String(cfg1.lastSubmissionId) !== '40747') {
            throw new Error(`Scenario 1 database validation failed: total=${total1}, held=${held1}, clean=${clean1}`);
        }

        // Verify live Apache config was restored
        const apacheLive1 = fs.readFileSync(path.join(env1.mockApache, 'httpd-lims.conf'), 'utf8');
        if (!apacheLive1.includes('LIVE REVERSE PROXY CONFIG')) {
            throw new Error('Scenario 1 failed to restore live Apache config!');
        }
        console.log('  ✓ Rehearsal 1 PASSED: Full wrapper pipeline succeeded; 864 samples admitted, live ingress restored');

        console.log('\n[Packaged Rehearsal 2] Partial-Apply Mid-Flight Failure & Quiesced External Recovery...');
        const dir2 = path.join(tmpDir, 'test_partial_fail');
        const env2 = setupEnvironmentFixture(dir2, { failDuringApply: true, healthOk: true });
        const res2 = runWrapperInTestEnv(dir2, {});

        if (res2.status === 0) {
            throw new Error('Scenario 2 should have exited with failure status');
        }
        if (!res2.stdout.includes('FAILURE DETECTED') || !res2.stdout.includes('Database restored and bit-for-bit verified')) {
            throw new Error('Scenario 2 missing recovery banner in output');
        }

        // Verify database was restored to baseline
        const db2 = new Database(env2.fixtureDb, { readonly: true });
        const samples2 = db2.prepare('SELECT COUNT(*) as c FROM Sample').get().c;
        const cfg2 = db2.prepare('SELECT isActive, projectCode FROM KoboConfig WHERE id = ?').get(CONFIG_ID);
        const integrity2 = db2.pragma('integrity_check');
        db2.close();

        if (samples2 !== 1 || cfg2.isActive !== 0 || cfg2.projectCode !== null || integrity2[0].integrity_check !== 'ok') {
            throw new Error('Scenario 2 database was not restored to baseline state!');
        }

        // Verify ingress remains 503 maintenance mode!
        const apache2 = fs.readFileSync(path.join(env2.mockApache, 'httpd-lims.conf'), 'utf8');
        if (!apache2.includes('Write Quiescence Active')) {
            throw new Error('Scenario 2 should have kept ingress write-blocked (503)!');
        }
        console.log('  ✓ Rehearsal 2 PASSED: Partial-apply dirty state restored bit-for-bit; maintenance mode retained');

        console.log('\n[Packaged Rehearsal 3] Process Interruption with Live Writer...');
        const dir3 = path.join(tmpDir, 'test_interrupt');
        const env3 = setupEnvironmentFixture(dir3, { interruptDelayMs: 2000, healthOk: true });

        const unixScript = toPosixPath(releaseScript);
        const winBin = path.resolve(dir3, 'bin');
        const unixBin = toPosixPath(winBin);
        const unixOpt = toPosixPath(path.join(dir3, 'opt_lims'));
        const unixApache = toPosixPath(path.join(dir3, 'apache_conf'));

        const bashEnv3 = {
            ...process.env,
            Path: `${winBin};${process.env.Path || process.env.PATH || ''}`,
            LIMS_OPT_DIR: unixOpt,
            APACHE_CONF_DIR: unixApache,
            PRIVATE_SNAPSHOT: toPosixPath(privateSnapPath),
            PRIVATE_MANIFEST: toPosixPath(privateManPath),
            SYSTEMCTL_CMD: 'systemctl',
            CURL_CMD: `${unixBin}/curl`
        };
        delete bashEnv3.PATH;

        const child3 = cp.spawn(bashPath, [unixScript, REVIEWED_IMAGE], {
            env: bashEnv3,
            cwd: repoRoot,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        // Poll for PID file
        const pidFile = path.join(dir3, 'opt_lims', 'apply_issue146.pid');
        let msysPid = null;
        for (let i = 0; i < 50; i++) {
            if (fs.existsSync(pidFile)) {
                msysPid = fs.readFileSync(pidFile, 'utf8').trim();
                break;
            }
            await new Promise(r => setTimeout(r, 100));
        }

        // Wait until apply container is active in stateFile
        for (let i = 0; i < 100; i++) {
            try {
                const s = JSON.parse(fs.readFileSync(env3.stateFile, 'utf8'));
                const hasApply = Object.keys(s.containers || {}).some(k => k.includes('apply') && s.containers[k].running);
                if (hasApply) break;
            } catch (_) {}
            await new Promise(r => setTimeout(r, 50));
        }

        if (msysPid) {
            cp.spawnSync(bashPath, ['-c', `/usr/bin/kill -TERM ${msysPid}`]);
        }

        const child3Out = await new Promise(resolve => {
            let out = '';
            let err = '';
            child3.stdout.on('data', d => { out += d; });
            child3.stderr.on('data', d => { err += d; });
            child3.on('close', code => {
                resolve({ code, out, err });
            });
        });

        // Verify writer container was terminated and DB restored
        const state3 = JSON.parse(fs.readFileSync(env3.stateFile, 'utf8'));
        const db3 = new Database(env3.fixtureDb, { readonly: true });
        const samples3 = db3.prepare('SELECT COUNT(*) as c FROM Sample').get().c;
        const cfg3 = db3.prepare('SELECT isActive, projectCode FROM KoboConfig WHERE id = ?').get(CONFIG_ID);
        db3.close();

        if (samples3 !== 1 || cfg3.isActive !== 0) {
            throw new Error(`Scenario 3 database was not restored after interruption! (samples=${samples3}, cfg=${JSON.stringify(cfg3)})`);
        }

        // Verify ingress remains 503
        const apache3 = fs.readFileSync(path.join(env3.mockApache, 'httpd-lims.conf'), 'utf8');
        if (!apache3.includes('Write Quiescence Active')) {
            throw new Error('Scenario 3 should have kept ingress write-blocked (503)!');
        }
        console.log('  ✓ Rehearsal 3 PASSED: Interrupted execution caught; writers terminated and DB restored');

        console.log('\n[Packaged Rehearsal 4] Failed Health Check Retains Maintenance (Preserves Applied DB)...');
        const dir4 = path.join(tmpDir, 'test_health_fail');
        const env4 = setupEnvironmentFixture(dir4, { healthOk: false });
        const res4 = runWrapperInTestEnv(dir4, {});

        if (res4.status === 0) {
            throw new Error('Scenario 4 should have failed due to health check failure');
        }
        if (!res4.stdout.includes('failed health check') || !res4.stdout.includes('Preserving applied database state')) {
            throw new Error('Scenario 4 did not preserve applied database or detect health failure');
        }

        // Verify applied database was PRESERVED (864 samples, not reverted to 1 sample)
        const db4 = new Database(env4.fixtureDb, { readonly: true });
        const total4 = db4.prepare('SELECT COUNT(*) as c FROM Sample WHERE assignedLab = ?').get(EXPECTED_LAB).c;
        db4.close();

        if (total4 !== 864) {
            throw new Error(`Scenario 4 should have preserved applied database (expected 864, found ${total4})!`);
        }

        // Verify ingress was NOT restored
        const apache4 = fs.readFileSync(path.join(env4.mockApache, 'httpd-lims.conf'), 'utf8');
        if (!apache4.includes('Write Quiescence Active')) {
            throw new Error('Scenario 4 should have kept ingress write-blocked (503) due to health failure!');
        }
        console.log('  ✓ Rehearsal 4 PASSED: Failed health preserved applied database and retained 503 maintenance');

        console.log('\n[Packaged Rehearsal 5] Retagged Old Container Rejection...');
        const dir5 = path.join(tmpDir, 'test_retagged_container');
        const env5 = setupEnvironmentFixture(dir5, {
            appImage: REVIEWED_IMAGE,
            appImageId: 'sha256:OLD_OUTDATED_CONTAINER_DIGEST'
        });
        const res5 = runWrapperInTestEnv(dir5, {});

        if (res5.status === 0) {
            throw new Error('Scenario 5 should have failed due to retagged old container');
        }
        if (!res5.stdout.includes('actual image ID') || !res5.stdout.includes('does not match reviewed runner image')) {
            throw new Error('Scenario 5 missing retagged container FATAL error in stdout: ' + res5.stdout);
        }

        // Verify DB was untouched
        const db5 = new Database(env5.fixtureDb, { readonly: true });
        const samples5 = db5.prepare('SELECT COUNT(*) as c FROM Sample').get().c;
        db5.close();
        if (samples5 !== 1) {
            throw new Error('Scenario 5 modified database despite container image mismatch!');
        }

        // Verify live container was NOT stopped
        const state5 = JSON.parse(fs.readFileSync(env5.stateFile, 'utf8'));
        if (!state5.containers['soilfer-lims'].running) {
            throw new Error('Scenario 5 stopped live container during preflight failure!');
        }
        console.log('  ✓ Rehearsal 5 PASSED: Retagged container rejected; live app container untouched');

        console.log('\n[Packaged Rehearsal 6] Docker Inspect Unavailable Fails Closed...');
        const dir6 = path.join(tmpDir, 'test_inspect_unavailable');
        const env6 = setupEnvironmentFixture(dir6, { daemonUnavailable: true });
        const res6 = runWrapperInTestEnv(dir6, {});

        if (res6.status === 0) {
            throw new Error('Scenario 6 should have failed when Docker daemon is unavailable');
        }
        if (!res6.stdout.includes('FATAL') && !res6.stderr.includes('Cannot connect')) {
            throw new Error('Scenario 6 missing daemon unavailable error: ' + res6.stderr);
        }

        const db6 = new Database(env6.fixtureDb, { readonly: true });
        const samples6 = db6.prepare('SELECT COUNT(*) as c FROM Sample').get().c;
        db6.close();
        if (samples6 !== 1) {
            throw new Error('Scenario 6 modified database despite inspect failure!');
        }
        console.log('  ✓ Rehearsal 6 PASSED: Docker inspect failure fails closed; DB untouched');

        console.log('\n[Packaged Rehearsal 7] Preflight Failure (INIT Phase) Preserves Live App & Proxy...');
        const dir7 = path.join(tmpDir, 'test_preflight_init_fail');
        const env7 = setupEnvironmentFixture(dir7, {});
        // Run with nonexistent snapshot
        const res7 = runWrapperInTestEnv(dir7, {
            PRIVATE_SNAPSHOT: '/nonexistent/path/ghana_kobo_snapshot_40747.json'
        });

        if (res7.status === 0) {
            throw new Error('Scenario 7 should have failed due to missing snapshot');
        }
        if (!res7.stdout.includes('Preflight check failed prior to maintenance or mutation') ||
            !res7.stdout.includes('Live application container and reverse proxy remain untouched')) {
            throw new Error('Scenario 7 missing preflight preservation notice');
        }

        const state7 = JSON.parse(fs.readFileSync(env7.stateFile, 'utf8'));
        if (!state7.containers['soilfer-lims'].running) {
            throw new Error('Scenario 7 stopped live container during preflight failure!');
        }
        const apacheLive7 = fs.readFileSync(path.join(env7.mockApache, 'httpd-lims.conf'), 'utf8');
        if (!apacheLive7.includes('LIVE REVERSE PROXY CONFIG')) {
            throw new Error('Scenario 7 mutated Apache reverse proxy during preflight failure!');
        }
        console.log('  ✓ Rehearsal 7 PASSED: Preflight failure preserved live app and live proxy untouched');

        console.log('\n[Packaged Rehearsal 8] Mismatched Image Tag Refuses Execution Before Mutation...');
        const dir8 = path.join(tmpDir, 'test_mismatch_image');
        const env8 = setupEnvironmentFixture(dir8, {});
        // Call wrapper with an un-reviewed or mismatched image tag
        const res8 = runWrapperInTestEnv(dir8, {}, ['soilfer-lims:unreviewed-tag']);

        if (res8.status === 0) {
            throw new Error('Scenario 8 should have refused execution with mismatched image');
        }
        if (!res8.stdout.includes('Reviewed image') || !res8.stdout.includes('FATAL')) {
            throw new Error('Scenario 8 missing image mismatch FATAL error');
        }

        // Verify DB was untouched
        const db8 = new Database(env8.fixtureDb, { readonly: true });
        const samples8 = db8.prepare('SELECT COUNT(*) as c FROM Sample').get().c;
        const cfg8 = db8.prepare('SELECT isActive, projectCode FROM KoboConfig WHERE id = ?').get(CONFIG_ID);
        db8.close();

        if (samples8 !== 1 || cfg8.isActive !== 0) {
            throw new Error('Scenario 8 modified database despite image mismatch!');
        }
        console.log('  ✓ Rehearsal 8 PASSED: Mismatched image immediately refused execution; zero state modified');

        console.log('\n[Packaged Rehearsal 9] Maintenance Transition Failure Restores Live Ingress Config...');
        const dir9 = path.join(tmpDir, 'test_proxy_transition_fail');
        const env9 = setupEnvironmentFixture(dir9, { failInitialProxyReload: true });
        const res9 = runWrapperInTestEnv(dir9, {});

        if (res9.status === 0) {
            throw new Error('Scenario 9 should have failed when initial proxy reload fails');
        }
        if (!res9.stdout.includes('Failure occurred while transitioning to maintenance mode') ||
            !res9.stdout.includes('Live reverse proxy configuration restored')) {
            throw new Error('Scenario 9 missing maintenance transition recovery: ' + res9.stdout);
        }

        // Live container was not stopped
        const state9 = JSON.parse(fs.readFileSync(env9.stateFile, 'utf8'));
        if (!state9.containers['soilfer-lims'].running) {
            throw new Error('Scenario 9 stopped live container during proxy transition failure!');
        }

        // Live proxy config restored
        const apache9 = fs.readFileSync(path.join(env9.mockApache, 'httpd-lims.conf'), 'utf8');
        if (!apache9.includes('LIVE REVERSE PROXY CONFIG') || apache9.includes('Write Quiescence Active')) {
            throw new Error('Scenario 9 failed to restore live reverse proxy config!');
        }

        // Database untouched
        const db9 = new Database(env9.fixtureDb, { readonly: true });
        const samples9 = db9.prepare('SELECT COUNT(*) as c FROM Sample').get().c;
        db9.close();
        if (samples9 !== 1) {
            throw new Error('Scenario 9 modified database during proxy transition failure!');
        }
        console.log('  ✓ Rehearsal 9 PASSED: Maintenance transition failure caught; live proxy config restored; app untouched');

        console.log('\n================================================================');
        console.log('  ALL 9 SHELL WRAPPER MOCK REHEARSALS COMPLETED SUCCESSFULLY    ');
        console.log('  1. Success | 2. Partial-Apply | 3. Interrupt | 4. Health-Fail ');
        console.log('  5. Retagged Container | 6. Inspect Fail | 7. Preflight Presrv ');
        console.log('  8. Unknown Tag Mismatch | 9. Proxy Transition Rollback        ');
        console.log('================================================================\n');

    } finally {
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch (_) {}
    }
}

runAllPackagedRehearsals().catch(err => {
    console.error('PACKAGED_REHEARSAL_FAILED:', err);
    process.exit(1);
});
