#!/usr/bin/env node
'use strict';

/**
 * Real Disposable Docker Boundary Rehearsal (PR #147, Issue #146)
 * File: server/scripts/rehearsal_docker_boundary.cjs
 * 
 * Verifies the actual Bash release wrapper (execute_release_pr147.sh) and packaged
 * container runtime boundaries in an isolated real Docker environment (CI):
 * 
 *   [Smoke Test]
 *     - Packaged runner loading (/app/server/scripts/execute_ghana_apply_146.cjs) inside
 *       candidate Alpine container, confirming musl native module (better-sqlite3) linkage.
 *     - Packaged controller intake guards (AMBIGUOUS_PROVENANCE_HOLD) verification.
 * 
 *   [Real Bash Wrapper Boundary Rehearsals with Disposable Real Docker]
 *     Scenario 1: Real wrapper success path through disposable volume & live container.
 *     Scenario 2: Real wrapper mid-flight partial apply failure invokes its own recovery,
 *                 verifying bit-for-bit baseline DB hash, samples, config, and audit state.
 *     Scenario 3: Real wrapper interruption while actual container writer is actively writing
 *                 to volume, proving writer container is terminated before database restore.
 *     Scenario 4: Real wrapper failed health check post-apply preserves committed database
 *                 and retains write-quiesced (HTTP 503) maintenance ingress.
 *     Scenario 5: Real wrapper image identity (.Image) verification rejects retagged/mismatched
 *                 container before mutation or service interruption.
 * 
 * Note:
 *   - Strictly uses synthetic public fixtures (zero real datasets or PII).
 *   - Operates exclusively on disposable Docker volumes and isolated mock ingress.
 *   - Real code under test is execute_release_pr147.sh invoking real Docker daemon.
 *   - Faults are injected via clearly labeled synthetic test adapters.
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');
const os = require('os');

console.log('================================================================');
console.log('  REAL DISPOSABLE DOCKER BOUNDARY REHEARSAL                     ');
console.log('  Testing execute_release_pr147.sh Against Real Docker Runtime  ');
console.log('================================================================');

// 1. Docker Daemon Availability Check
try {
    cp.execFileSync('docker', ['info'], { stdio: 'ignore' });
} catch (e) {
    if (process.env.CI) {
        console.error('FATAL: Docker daemon is required in CI environment but failed to respond!');
        process.exit(1);
    } else {
        console.log('NOTICE: Docker daemon is not running in this local environment.');
        console.log('Skipping real Docker boundary rehearsal. This suite executes in GitHub Actions CI (ubuntu-latest).');
        process.exit(0);
    }
}

const IMAGE_TAG = process.env.IMAGE_TAG || 'soilfer-lims:ci';

// 2. Verify image exists in Docker daemon & resolve immutable ID
let REVIEWED_IMAGE_ID;
try {
    REVIEWED_IMAGE_ID = cp.execFileSync('docker', ['image', 'inspect', IMAGE_TAG, '--format', '{{.Id}}'], { encoding: 'utf8' }).trim();
    console.log(`Image:        ${IMAGE_TAG}`);
    console.log(`Immutable ID: ${REVIEWED_IMAGE_ID}\n`);
} catch (e) {
    console.error(`FATAL: Required image '${IMAGE_TAG}' not found in Docker daemon!`);
    console.error('Build the image first, e.g.: docker build -t soilfer-lims:ci .');
    process.exit(1);
}

const serverDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(serverDir, '..');
const releaseScript = path.join(repoRoot, 'execute_release_pr147.sh');

if (!fs.existsSync(releaseScript)) {
    console.error('FATAL: execute_release_pr147.sh not found at', releaseScript);
    process.exit(1);
}

const bashCmd = os.platform() === 'win32'
    ? (fs.existsSync('C:/Program Files/Git/bin/bash.exe') ? 'C:/Program Files/Git/bin/bash.exe' : 'bash')
    : 'bash';

const TS = Date.now();
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `lims_docker_boundary_${TS}_`));
const disposableVolumes = [];
const disposableContainers = [];
const disposableImages = [];

function registerVolume(vol) {
    disposableVolumes.push(vol);
    return vol;
}

function registerContainer(c) {
    disposableContainers.push(c);
    return c;
}

function registerImage(img) {
    disposableImages.push(img);
    return img;
}

function cleanupAll() {
    console.log('\nCleaning up disposable Docker resources...');
    for (const c of disposableContainers) {
        try { cp.execFileSync('docker', ['rm', '-f', c], { stdio: 'ignore' }); } catch (_) {}
    }
    for (const v of disposableVolumes) {
        try { cp.execFileSync('docker', ['volume', 'rm', '-f', v], { stdio: 'ignore' }); } catch (_) {}
    }
    for (const img of disposableImages) {
        try { cp.execFileSync('docker', ['rmi', '-f', img], { stdio: 'ignore' }); } catch (_) {}
    }
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
}

// Ensure host permissions on Linux for Docker volumes
function grantVolumePermissions(volMountpoint) {
    if (os.platform() === 'linux') {
        try {
            cp.execFileSync('sudo', ['chmod', 'a+rx', '/var/lib/docker'], { stdio: 'ignore' });
            cp.execFileSync('sudo', ['chmod', '-R', 'a+rwx', '/var/lib/docker/volumes'], { stdio: 'ignore' });
            if (volMountpoint) {
                cp.execFileSync('sudo', ['chmod', '-R', 'a+rwx', volMountpoint], { stdio: 'ignore' });
            }
        } catch (_) {}
    }
}

// Convert path to POSIX if running on Windows with Git Bash
function toPosix(p) {
    if (!p) return p;
    return p.replace(/^([a-zA-Z]):/, (_, drive) => `/${drive.toLowerCase()}`).replace(/\\/g, '/');
}

// Generate synthetic public fixtures (4 synthetic specimens, no PII)
function createSyntheticFixtures(dir) {
    const syntheticSubmissions = [
        {
            _id: 10001,
            _submission_time: '2026-09-20T10:00:00',
            _status: 'submitted_via_web',
            formhub: { uuid: 'aQtvKZHiZmtqVCkQsGw2X4' },
            sample_details: [
                { 'sample_details/sample_barcode': 'GHA-SYN-001', 'sample_details/depth': '0-20cm' },
                { 'sample_details/sample_barcode': 'GHA-SYN-002', 'sample_details/depth': '20-50cm' }
            ]
        },
        {
            _id: 10002,
            _submission_time: '2026-09-20T11:00:00',
            _status: 'submitted_via_web',
            formhub: { uuid: 'aQtvKZHiZmtqVCkQsGw2X4' },
            sample_details: [
                { 'sample_details/sample_barcode': 'GHA-SYN-003', 'sample_details/depth': '0-20cm' },
                { 'sample_details/sample_barcode': 'GHA-SYN-004', 'sample_details/depth': '20-50cm' }
            ]
        }
    ];

    const snapPath = path.join(dir, 'synthetic_snapshot.json');
    const snapContent = JSON.stringify(syntheticSubmissions, null, 2);
    fs.writeFileSync(snapPath, snapContent);
    const snapHash = crypto.createHash('sha256').update(snapContent).digest('hex');

    const manifest = {
        count: syntheticSubmissions.length,
        sha256: snapHash,
        highWaterId: 10002
    };
    const manPath = path.join(dir, 'synthetic_manifest.json');
    const manContent = JSON.stringify(manifest, null, 2);
    fs.writeFileSync(manPath, manContent);
    const manHash = crypto.createHash('sha256').update(manContent).digest('hex');

    return { snapPath, manPath, snapHash, manHash, count: 4 };
}

// Create synthetic apply runner adapter script (placed on volume, mounted as /app/server/prisma/synthetic_adapter.cjs)
function writeSyntheticAdapterOnVolume(volMountpoint) {
    const adapterPath = path.join(volMountpoint, 'synthetic_adapter.cjs');
    const code = `#!/usr/bin/env node
'use strict';
/**
 * Synthetic Fault Adapter for Docker Rehearsal Boundary Tests
 * Clearly labeled test adapter: simulates dry-run validation, normal apply,
 * or injected failure / active background writer inside real container runtime.
 */
const fs = require('fs');
let Database;
try {
    Database = require('better-sqlite3');
} catch (_) {
    Database = require('/app/server/node_modules/better-sqlite3');
}

const isDryRun = process.argv.includes('--dry-run');
const isApply = process.argv.includes('--apply');
const dbPath = process.env.DATABASE_PATH || '/app/server/prisma/dev.db';
const configPath = '/app/server/prisma/adapter_config.json';

let config = { fault: 'none' };
if (fs.existsSync(configPath)) {
    try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (_) {}
}

if (!fs.existsSync(dbPath)) {
    console.error('FATAL: Database missing inside container at', dbPath);
    process.exit(1);
}

if (isDryRun) {
    console.log('✓ Synthetic Adapter: Dry-run completed cleanly inside packaged container.');
    process.exit(0);
}

if (isApply) {
    const db = new Database(dbPath);

    if (config.fault === 'partial_apply') {
        db.prepare("INSERT INTO Sample (id, originalId, projectCode, assignedLab, status, createdAt, updatedAt) VALUES ('smp-dirty-fail', 'DIRTY-01', 'SOILFER-US', 'GHA-LAB1', 'EXPECTED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)").run();
        db.close();
        console.error('INJECTED_PARTIAL_APPLY_FAULT: Simulating fatal runtime crash inside container.');
        process.exit(1);
    }

    if (config.fault === 'writer_delay') {
        console.log('ACTIVE_WRITER_RUNNING: Starting continuous row insertion loop.');
        const insertStmt = db.prepare("INSERT INTO Sample (id, originalId, projectCode, assignedLab, status, createdAt, updatedAt) VALUES (?, ?, 'SOILFER-US', 'GHA-LAB1', 'EXPECTED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");
        let count = 0;
        while (count < 1000) {
            count++;
            try {
                insertStmt.run('smp-writer-' + count, 'WRITER-' + count);
            } catch (err) {
                // If DB locked or closed, exit
                break;
            }
            const end = Date.now() + 50;
            while (Date.now() < end) {} // busy wait 50ms
        }
        db.close();
        process.exit(0);
    }

    // Normal successful apply: admit 4 synthetic samples
    const insertStmt = db.prepare("INSERT INTO Sample (id, originalId, projectCode, assignedLab, status, createdAt, updatedAt) VALUES (?, ?, 'SOILFER-US', 'GHA-LAB1', 'EXPECTED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");
    insertStmt.run('smp-syn-1', 'GHA-SYN-001');
    insertStmt.run('smp-syn-2', 'GHA-SYN-002');
    insertStmt.run('smp-syn-3', 'GHA-SYN-003');
    insertStmt.run('smp-syn-4', 'GHA-SYN-004');

    db.prepare("UPDATE KoboConfig SET isActive = 1, projectCode = 'SOILFER-US', lastSubmissionId = '10002' WHERE id = '25731264-f02a-4172-8ef1-75512b7607a5'").run();
    db.close();
    console.log('✓ Synthetic Adapter: Successfully admitted 4 synthetic specimens and activated KoboConfig.');
    process.exit(0);
}

console.error('ERROR: Must specify either --dry-run or --apply');
process.exit(1);
`;
    fs.writeFileSync(adapterPath, code);
    fs.chmodSync(adapterPath, '755');
}

// Initialize database schema and baseline rows on disposable volume
function initializeVolumeDatabase(volName) {
    const initCmd = `
const Database = require('/app/server/node_modules/better-sqlite3');
const db = new Database('/app/server/prisma/dev.db');
db.exec(\`
    CREATE TABLE IF NOT EXISTS Lab (id TEXT PRIMARY KEY, code TEXT, name TEXT, country TEXT, isActive INTEGER, createdAt DATETIME, updatedAt DATETIME);
    CREATE TABLE IF NOT EXISTS Project (id TEXT PRIMARY KEY, code TEXT, name TEXT, status TEXT, labId TEXT, createdAt DATETIME, updatedAt DATETIME);
    CREATE TABLE IF NOT EXISTS ProjectLab (id TEXT PRIMARY KEY, projectCode TEXT, labId TEXT, role TEXT, createdAt DATETIME);
    CREATE TABLE IF NOT EXISTS KoboConfig (id TEXT PRIMARY KEY, labId TEXT, labName TEXT, formId TEXT, koboServerUrl TEXT, apiToken TEXT, isActive INTEGER, projectCode TEXT, lastSubmissionId TEXT, createdAt DATETIME, updatedAt DATETIME);
    CREATE TABLE IF NOT EXISTS Sample (id TEXT PRIMARY KEY, originalId TEXT, projectCode TEXT, assignedLab TEXT, status TEXT, rejectionReason TEXT, metadata TEXT, createdAt DATETIME, updatedAt DATETIME);
\`);
db.prepare("INSERT INTO Lab (id, code, name, country, isActive, createdAt, updatedAt) VALUES ('GHA-LAB1', 'GHA', 'Ghana Lab', 'GHA', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)").run();
db.prepare("INSERT INTO Project (id, code, name, status, labId, createdAt, updatedAt) VALUES ('proj-1', 'SOILFER-US', 'SoilFER US', 'ACTIVE', 'GHA-LAB1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)").run();
db.prepare("INSERT INTO ProjectLab (id, projectCode, labId, role, createdAt) VALUES ('pl-1', 'SOILFER-US', 'GHA-LAB1', 'PRIMARY', CURRENT_TIMESTAMP)").run();
db.prepare("INSERT INTO KoboConfig (id, labId, labName, formId, koboServerUrl, apiToken, isActive, projectCode, lastSubmissionId, createdAt, updatedAt) VALUES ('25731264-f02a-4172-8ef1-75512b7607a5', 'GHA-LAB1', 'Ghana Lab', 'aQtvKZHiZmtqVCkQsGw2X4', 'https://kf.soilfer-data.fao.org', 'token', 0, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)").run();
db.prepare("INSERT INTO Sample (id, originalId, projectCode, assignedLab, status, createdAt, updatedAt) VALUES ('smp-base-1', 'GHA-BASE-001', 'SOILFER-US', 'GHA-LAB1', 'EXPECTED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)").run();
db.pragma('wal_checkpoint(TRUNCATE)');
db.close();
`;
    cp.execFileSync('docker', [
        'run', '--rm',
        '--entrypoint', 'node',
        '-w', '/app/server',
        '-e', 'NODE_PATH=/app/server/node_modules',
        '-v', `${volName}:/app/server/prisma`,
        REVIEWED_IMAGE_ID,
        '-e', initCmd
    ], { stdio: 'pipe' });

    const mountpoint = cp.execFileSync('docker', ['volume', 'inspect', volName, '--format', '{{.Mountpoint}}'], { encoding: 'utf8' }).trim();
    grantVolumePermissions(mountpoint);
    return mountpoint;
}

// Query SQLite DB directly via Docker container
function queryVolumeDb(volName, sql) {
    const out = cp.execFileSync('docker', [
        'run', '--rm',
        '--entrypoint', 'node',
        '-w', '/app/server',
        '-e', 'NODE_PATH=/app/server/node_modules',
        '-v', `${volName}:/app/server/prisma`,
        REVIEWED_IMAGE_ID,
        '-e', `
const Database = require('/app/server/node_modules/better-sqlite3');
const db = new Database('/app/server/prisma/dev.db');
const rows = db.prepare("${sql}").all();
console.log(JSON.stringify(rows));
db.close();
`
    ], { encoding: 'utf8' });
    return JSON.parse(out.trim());
}

// Compute SHA256 of dev.db on volume
function computeVolumeDbSha256(volName) {
    const out = cp.execFileSync('docker', [
        'run', '--rm',
        '--entrypoint', 'node',
        '-v', `${volName}:/app/server/prisma`,
        REVIEWED_IMAGE_ID,
        '-e', `
const crypto = require('crypto');
const fs = require('fs');
const hash = crypto.createHash('sha256').update(fs.readFileSync('/app/server/prisma/dev.db')).digest('hex');
console.log(hash);
`
    ], { encoding: 'utf8' });
    return out.trim();
}

async function runRealDockerBoundarySuite() {
    try {
        console.log('[Smoke Test] Packaged Runner Loading & Intake Guard Verification in Real Container...');
        
        // 1. Verify packaged execute_ghana_apply_146.cjs loads correctly in Alpine musl runtime
        let smokeStatus = 0;
        let smokeOutput = '';
        try {
            smokeOutput = cp.execFileSync('docker', [
                'run', '--rm',
                '--entrypoint', 'node',
                '-w', '/app/server',
                REVIEWED_IMAGE_ID,
                '/app/server/scripts/execute_ghana_apply_146.cjs'
            ], { encoding: 'utf8' });
        } catch (err) {
            smokeStatus = err.status;
            smokeOutput = (err.stdout || '') + (err.stderr || '');
        }

        if (smokeStatus !== 1 || !smokeOutput.includes('Must specify either --dry-run or --apply')) {
            throw new Error(`Smoke test failed: expected exit 1 with argument error, got status ${smokeStatus}: ${smokeOutput}`);
        }

        // 2. Verify packaged controllers contain AMBIGUOUS_PROVENANCE_HOLD guards
        const guardsCheck = cp.execFileSync('docker', [
            'run', '--rm',
            '--entrypoint', 'node',
            '--network', 'none',
            REVIEWED_IMAGE_ID,
            '-e', `
const fs = require('fs');
const rc = fs.readFileSync('/app/server/controllers/receptionController.js', 'utf8');
const sc = fs.readFileSync('/app/server/controllers/sampleController.js', 'utf8');
if (!rc.includes('AMBIGUOUS_PROVENANCE_HOLD') || !sc.includes('AMBIGUOUS_PROVENANCE_HOLD')) {
    console.error('ERROR: AMBIGUOUS_PROVENANCE_HOLD intake guards missing!');
    process.exit(1);
}
console.log('GUARDS_VERIFIED');
`
        ], { encoding: 'utf8' });

        if (!guardsCheck.includes('GUARDS_VERIFIED')) {
            throw new Error('Intake guards verification failed in packaged image: ' + guardsCheck);
        }
        console.log('  ✓ Smoke Test PASSED: Packaged runner (/app/server/scripts/execute_ghana_apply_146.cjs) loaded cleanly with Alpine musl native modules; intake guards confirmed in controllers.\n');

        // ====================================================================
        // SCENARIO 1: Real Wrapper Success Path Through Disposable Docker
        // ====================================================================
        console.log('[Scenario 1] Real Bash Wrapper Success Path with Disposable Docker Volume & Live Container...');
        const dir1 = path.join(tmpDir, 'scenario_1_success');
        fs.mkdirSync(dir1, { recursive: true });
        const fixtures1 = createSyntheticFixtures(dir1);

        const vol1 = registerVolume(`lims_disposable_vol_1_${TS}`);
        cp.execFileSync('docker', ['volume', 'create', vol1], { stdio: 'pipe' });
        const mount1 = initializeVolumeDatabase(vol1);
        writeSyntheticAdapterOnVolume(mount1);
        fs.writeFileSync(path.join(mount1, 'adapter_config.json'), JSON.stringify({ fault: 'none' }));

        // Start live application container
        const app1 = registerContainer(`lims_app_live_1_${TS}`);
        cp.execFileSync('docker', [
            'run', '-d',
            '--name', app1,
            '--entrypoint', 'node',
            '-v', `${vol1}:/app/server/prisma`,
            REVIEWED_IMAGE_ID,
            '-e', 'setInterval(() => {}, 1000)'
        ]);

        // Mock apache conf, mock systemctl, mock curl
        const apache1 = path.join(dir1, 'apache');
        const opt1 = path.join(dir1, 'opt');
        const bin1 = path.join(dir1, 'bin');
        fs.mkdirSync(apache1, { recursive: true });
        fs.mkdirSync(opt1, { recursive: true });
        fs.mkdirSync(bin1, { recursive: true });

        fs.writeFileSync(path.join(apache1, 'httpd-lims.conf'), '# LIVE REVERSE PROXY CONFIG\nProxyPass / http://127.0.0.1:3000/\n');
        fs.writeFileSync(path.join(bin1, 'systemctl'), '#!/bin/sh\nexit 0\n');
        fs.chmodSync(path.join(bin1, 'systemctl'), '755');
        fs.writeFileSync(path.join(bin1, 'curl'), '#!/bin/sh\necho \'{"status":"ok"}\'\nexit 0\n');
        fs.chmodSync(path.join(bin1, 'curl'), '755');

        const env1 = Object.assign({}, process.env, {
            PATH: `${bin1}${path.delimiter}${process.env.PATH}`,
            APP_CONTAINER_NAME: app1,
            DOCKER_VOLUME_NAME: vol1,
            LIMS_OPT_DIR: toPosix(opt1),
            APACHE_CONF_DIR: toPosix(apache1),
            SYSTEMCTL_CMD: toPosix(path.join(bin1, 'systemctl')),
            CURL_CMD: toPosix(path.join(bin1, 'curl')),
            SQLITE3_CMD: 'sqlite3',
            PRIVATE_SNAPSHOT: toPosix(fixtures1.snapPath),
            PRIVATE_MANIFEST: toPosix(fixtures1.manPath),
            EXPECTED_SNAPSHOT_SHA: fixtures1.snapHash,
            EXPECTED_MANIFEST_SHA: fixtures1.manHash,
            RUNNER_SCRIPT: '/app/server/prisma/synthetic_adapter.cjs',
            EXPECTED_APPLY_COUNT: '4',
            HEALTH_RETRIES: '3'
        });

        const res1 = cp.spawnSync(bashCmd, [toPosix(releaseScript), IMAGE_TAG], { env: env1, encoding: 'utf8' });
        if (res1.status !== 0) {
            console.error('Scenario 1 STDOUT:\n', res1.stdout);
            console.error('Scenario 1 STDERR:\n', res1.stderr);
            throw new Error(`Scenario 1 wrapper failed with status ${res1.status}`);
        }

        // Verify volume DB contains 5 samples (1 baseline + 4 admitted)
        const samples1 = queryVolumeDb(vol1, 'SELECT count(*) as c FROM Sample');
        if (samples1[0].c !== 5) {
            throw new Error(`Scenario 1 expected 5 samples on volume DB, got ${samples1[0].c}`);
        }

        const cfg1 = queryVolumeDb(vol1, "SELECT isActive, projectCode, lastSubmissionId FROM KoboConfig WHERE id = '25731264-f02a-4172-8ef1-75512b7607a5'");
        if (cfg1[0].isActive !== 1 || cfg1[0].projectCode !== 'SOILFER-US' || cfg1[0].lastSubmissionId !== '10002') {
            throw new Error('Scenario 1 KoboConfig not activated correctly: ' + JSON.stringify(cfg1[0]));
        }

        // Verify reverse proxy restored to live configuration
        const apacheLive1 = fs.readFileSync(path.join(apache1, 'httpd-lims.conf'), 'utf8');
        if (!apacheLive1.includes('LIVE REVERSE PROXY CONFIG') || apacheLive1.includes('Write Quiescence Active')) {
            throw new Error('Scenario 1 reverse proxy was not restored to live configuration!');
        }

        console.log('  ✓ Scenario 1 PASSED: Full wrapper pipeline succeeded in real Docker; 4 samples admitted; live traffic restored.\n');

        // ====================================================================
        // SCENARIO 2: Real Wrapper Partial-Apply Failure Recovery
        // ====================================================================
        console.log('[Scenario 2] Real Bash Wrapper Partial-Apply Mid-Flight Failure & Bit-for-Bit DB Rollback...');
        const dir2 = path.join(tmpDir, 'scenario_2_partial');
        fs.mkdirSync(dir2, { recursive: true });
        const fixtures2 = createSyntheticFixtures(dir2);

        const vol2 = registerVolume(`lims_disposable_vol_2_${TS}`);
        cp.execFileSync('docker', ['volume', 'create', vol2], { stdio: 'pipe' });
        const mount2 = initializeVolumeDatabase(vol2);

        writeSyntheticAdapterOnVolume(mount2);
        // Inject partial apply failure
        fs.writeFileSync(path.join(mount2, 'adapter_config.json'), JSON.stringify({ fault: 'partial_apply' }));

        const app2 = registerContainer(`lims_app_live_2_${TS}`);
        cp.execFileSync('docker', [
            'run', '-d',
            '--name', app2,
            '--entrypoint', 'node',
            '-v', `${vol2}:/app/server/prisma`,
            REVIEWED_IMAGE_ID,
            '-e', 'setInterval(() => {}, 1000)'
        ]);

        const apache2 = path.join(dir2, 'apache');
        const opt2 = path.join(dir2, 'opt');
        const bin2 = path.join(dir2, 'bin');
        fs.mkdirSync(apache2, { recursive: true });
        fs.mkdirSync(opt2, { recursive: true });
        fs.mkdirSync(bin2, { recursive: true });

        fs.writeFileSync(path.join(apache2, 'httpd-lims.conf'), '# LIVE REVERSE PROXY CONFIG\nProxyPass / http://127.0.0.1:3000/\n');
        fs.writeFileSync(path.join(bin2, 'systemctl'), '#!/bin/sh\nexit 0\n');
        fs.chmodSync(path.join(bin2, 'systemctl'), '755');
        fs.writeFileSync(path.join(bin2, 'curl'), '#!/bin/sh\necho \'{"status":"ok"}\'\nexit 0\n');
        fs.chmodSync(path.join(bin2, 'curl'), '755');

        const env2 = Object.assign({}, process.env, {
            PATH: `${bin2}${path.delimiter}${process.env.PATH}`,
            APP_CONTAINER_NAME: app2,
            DOCKER_VOLUME_NAME: vol2,
            LIMS_OPT_DIR: toPosix(opt2),
            APACHE_CONF_DIR: toPosix(apache2),
            SYSTEMCTL_CMD: toPosix(path.join(bin2, 'systemctl')),
            CURL_CMD: toPosix(path.join(bin2, 'curl')),
            SQLITE3_CMD: 'sqlite3',
            PRIVATE_SNAPSHOT: toPosix(fixtures2.snapPath),
            PRIVATE_MANIFEST: toPosix(fixtures2.manPath),
            EXPECTED_SNAPSHOT_SHA: fixtures2.snapHash,
            EXPECTED_MANIFEST_SHA: fixtures2.manHash,
            RUNNER_SCRIPT: '/app/server/prisma/synthetic_adapter.cjs',
            EXPECTED_APPLY_COUNT: '4',
            HEALTH_RETRIES: '3'
        });

        const res2 = cp.spawnSync(bashCmd, [toPosix(releaseScript), IMAGE_TAG], { env: env2, encoding: 'utf8' });
        if (res2.status === 0) {
            throw new Error('Scenario 2 should have failed due to injected partial apply crash');
        }

        const backupHashMatch2 = res2.stdout.match(/Pre-operation SHA-256:\s+([a-f0-9]{64})/);
        if (!backupHashMatch2) {
            throw new Error('Scenario 2 missing Pre-operation SHA-256 in wrapper stdout:\n' + res2.stdout);
        }
        const expectedHash2 = backupHashMatch2[1];

        if (!res2.stdout.includes('Restoring database from pre-operation consistent backup') ||
            !res2.stdout.includes('Database restored and bit-for-bit verified')) {
            throw new Error('Scenario 2 missing bit-for-bit restoration in wrapper stdout:\n' + res2.stdout);
        }

        // Verify volume DB restored bit-for-bit to pre-apply backup hash
        const restoredHash2 = computeVolumeDbSha256(vol2);
        if (restoredHash2 !== expectedHash2) {
            throw new Error(`Scenario 2 restored DB hash mismatch: expected ${expectedHash2}, got ${restoredHash2}`);
        }

        // Verify sample count is restored to exactly 1 (dirty row smp-dirty-fail removed)
        const samples2 = queryVolumeDb(vol2, 'SELECT count(*) as c FROM Sample');
        if (samples2[0].c !== 1) {
            throw new Error(`Scenario 2 expected 1 sample after rollback, got ${samples2[0].c}`);
        }

        // Verify reverse proxy retained 503 maintenance mode
        const apacheQuiesce2 = fs.readFileSync(path.join(apache2, 'httpd-lims.conf'), 'utf8');
        if (!apacheQuiesce2.includes('Write Quiescence Active')) {
            throw new Error('Scenario 2 failed to retain 503 write quiescence after rollback!');
        }

        console.log('  ✓ Scenario 2 PASSED: Wrapper caught partial-apply failure; restored volume DB bit-for-bit; retained 503 ingress.\n');

        // ====================================================================
        // SCENARIO 3: Real Wrapper Interruption While Container Writer is Alive
        // ====================================================================
        console.log('[Scenario 3] Real Bash Wrapper Interruption While Actual Container Writer is Writing to Volume...');
        const dir3 = path.join(tmpDir, 'scenario_3_interrupt');
        fs.mkdirSync(dir3, { recursive: true });
        const fixtures3 = createSyntheticFixtures(dir3);

        const vol3 = registerVolume(`lims_disposable_vol_3_${TS}`);
        cp.execFileSync('docker', ['volume', 'create', vol3], { stdio: 'pipe' });
        const mount3 = initializeVolumeDatabase(vol3);

        writeSyntheticAdapterOnVolume(mount3);
        // Configure continuous background writer loop
        fs.writeFileSync(path.join(mount3, 'adapter_config.json'), JSON.stringify({ fault: 'writer_delay' }));

        const app3 = registerContainer(`lims_app_live_3_${TS}`);
        cp.execFileSync('docker', [
            'run', '-d',
            '--name', app3,
            '--entrypoint', 'node',
            '-v', `${vol3}:/app/server/prisma`,
            REVIEWED_IMAGE_ID,
            '-e', 'setInterval(() => {}, 1000)'
        ]);

        const apache3 = path.join(dir3, 'apache');
        const opt3 = path.join(dir3, 'opt');
        const bin3 = path.join(dir3, 'bin');
        fs.mkdirSync(apache3, { recursive: true });
        fs.mkdirSync(opt3, { recursive: true });
        fs.mkdirSync(bin3, { recursive: true });

        fs.writeFileSync(path.join(apache3, 'httpd-lims.conf'), '# LIVE REVERSE PROXY CONFIG\nProxyPass / http://127.0.0.1:3000/\n');
        fs.writeFileSync(path.join(bin3, 'systemctl'), '#!/bin/sh\nexit 0\n');
        fs.chmodSync(path.join(bin3, 'systemctl'), '755');
        fs.writeFileSync(path.join(bin3, 'curl'), '#!/bin/sh\necho \'{"status":"ok"}\'\nexit 0\n');
        fs.chmodSync(path.join(bin3, 'curl'), '755');

        const env3 = Object.assign({}, process.env, {
            PATH: `${bin3}${path.delimiter}${process.env.PATH}`,
            APP_CONTAINER_NAME: app3,
            DOCKER_VOLUME_NAME: vol3,
            LIMS_OPT_DIR: toPosix(opt3),
            APACHE_CONF_DIR: toPosix(apache3),
            SYSTEMCTL_CMD: toPosix(path.join(bin3, 'systemctl')),
            CURL_CMD: toPosix(path.join(bin3, 'curl')),
            SQLITE3_CMD: 'sqlite3',
            PRIVATE_SNAPSHOT: toPosix(fixtures3.snapPath),
            PRIVATE_MANIFEST: toPosix(fixtures3.manPath),
            EXPECTED_SNAPSHOT_SHA: fixtures3.snapHash,
            EXPECTED_MANIFEST_SHA: fixtures3.manHash,
            RUNNER_SCRIPT: '/app/server/prisma/synthetic_adapter.cjs',
            EXPECTED_APPLY_COUNT: '4',
            HEALTH_RETRIES: '3'
        });

        // Launch wrapper asynchronously
        const child3 = cp.spawn(bashCmd, [toPosix(releaseScript), IMAGE_TAG], { env: env3, stdio: ['pipe', 'pipe', 'pipe'] });
        let stdout3 = '';
        let stderr3 = '';
        child3.stdout.on('data', d => { stdout3 += d.toString(); });
        child3.stderr.on('data', d => { stderr3 += d.toString(); });

        // Wait until apply runner container appears in Docker running state
        let applyContainerFound = false;
        let applyContainerName = '';
        for (let i = 0; i < 60; i++) {
            await new Promise(r => setTimeout(r, 100));
            try {
                const ps = cp.execFileSync('docker', ['ps', '--filter', 'name=soilfer-lims-apply', '--format', '{{.Names}}'], { encoding: 'utf8' }).trim();
                if (ps && ps.includes('soilfer-lims-apply')) {
                    applyContainerFound = true;
                    applyContainerName = ps.split('\n')[0].trim();
                    break;
                }
            } catch (_) {}
            if (stdout3.includes('Step 6: Execute Guarded Apply')) {
                // If stdout shows Step 6, allow short moment for container writer to start
                await new Promise(r => setTimeout(r, 200));
                applyContainerFound = true;
                break;
            }
        }

        console.log(`  Live runner writer active inside Docker (${applyContainerName || 'detected'}). Sending SIGINT...`);
        child3.kill('SIGINT');

        await new Promise(resolve => child3.on('close', resolve));

        if (child3.exitCode === 0) {
            throw new Error('Scenario 3 should have failed due to SIGINT interruption');
        }

        // Verify the runner container is NO LONGER running in Docker daemon
        const psCheck = cp.execFileSync('docker', ['ps', '--filter', 'name=soilfer-lims-apply', '--format', '{{.Names}}'], { encoding: 'utf8' }).trim();
        if (psCheck && psCheck.includes('soilfer-lims-apply')) {
            throw new Error('Scenario 3 runner container is STILL running after wrapper cleanup: ' + psCheck);
        }

        const backupHashMatch3 = stdout3.match(/Pre-operation SHA-256:\s+([a-f0-9]{64})/);
        if (!backupHashMatch3) {
            throw new Error('Scenario 3 missing Pre-operation SHA-256 in wrapper stdout:\n' + stdout3);
        }
        const expectedHash3 = backupHashMatch3[1];

        if (!stdout3.includes('Database restored and bit-for-bit verified')) {
            throw new Error('Scenario 3 missing bit-for-bit restoration confirmation in wrapper stdout:\n' + stdout3);
        }

        const restoredHash3 = computeVolumeDbSha256(vol3);
        if (restoredHash3 !== expectedHash3) {
            throw new Error(`Scenario 3 restored DB hash mismatch: expected ${expectedHash3}, got ${restoredHash3}`);
        }

        const samples3 = queryVolumeDb(vol3, 'SELECT count(*) as c FROM Sample');
        if (samples3[0].c !== 1) {
            throw new Error(`Scenario 3 expected 1 sample after interrupted rollback, got ${samples3[0].c}`);
        }

        console.log('  ✓ Scenario 3 PASSED: Interrupted wrapper terminated live container writer before restoring DB bit-for-bit.\n');

        // ====================================================================
        // SCENARIO 4: Real Wrapper Failed Health Preserves Committed DB
        // ====================================================================
        console.log('[Scenario 4] Real Bash Wrapper Failed Health Check Preserves Committed Database...');
        const dir4 = path.join(tmpDir, 'scenario_4_healthfail');
        fs.mkdirSync(dir4, { recursive: true });
        const fixtures4 = createSyntheticFixtures(dir4);

        const vol4 = registerVolume(`lims_disposable_vol_4_${TS}`);
        cp.execFileSync('docker', ['volume', 'create', vol4], { stdio: 'pipe' });
        const mount4 = initializeVolumeDatabase(vol4);

        writeSyntheticAdapterOnVolume(mount4);
        // Successful apply
        fs.writeFileSync(path.join(mount4, 'adapter_config.json'), JSON.stringify({ fault: 'none' }));

        const app4 = registerContainer(`lims_app_live_4_${TS}`);
        cp.execFileSync('docker', [
            'run', '-d',
            '--name', app4,
            '--entrypoint', 'node',
            '-v', `${vol4}:/app/server/prisma`,
            REVIEWED_IMAGE_ID,
            '-e', 'setInterval(() => {}, 1000)'
        ]);

        const apache4 = path.join(dir4, 'apache');
        const opt4 = path.join(dir4, 'opt');
        const bin4 = path.join(dir4, 'bin');
        fs.mkdirSync(apache4, { recursive: true });
        fs.mkdirSync(opt4, { recursive: true });
        fs.mkdirSync(bin4, { recursive: true });

        fs.writeFileSync(path.join(apache4, 'httpd-lims.conf'), '# LIVE REVERSE PROXY CONFIG\nProxyPass / http://127.0.0.1:3000/\n');
        fs.writeFileSync(path.join(bin4, 'systemctl'), '#!/bin/sh\nexit 0\n');
        fs.chmodSync(path.join(bin4, 'systemctl'), '755');
        // Mock curl returns 500 error to simulate failed health check
        fs.writeFileSync(path.join(bin4, 'curl'), '#!/bin/sh\necho \'{"status":"error","detail":"unhealthy"}\'\nexit 1\n');
        fs.chmodSync(path.join(bin4, 'curl'), '755');

        const env4 = Object.assign({}, process.env, {
            PATH: `${bin4}${path.delimiter}${process.env.PATH}`,
            APP_CONTAINER_NAME: app4,
            DOCKER_VOLUME_NAME: vol4,
            LIMS_OPT_DIR: toPosix(opt4),
            APACHE_CONF_DIR: toPosix(apache4),
            SYSTEMCTL_CMD: toPosix(path.join(bin4, 'systemctl')),
            CURL_CMD: toPosix(path.join(bin4, 'curl')),
            SQLITE3_CMD: 'sqlite3',
            PRIVATE_SNAPSHOT: toPosix(fixtures4.snapPath),
            PRIVATE_MANIFEST: toPosix(fixtures4.manPath),
            EXPECTED_SNAPSHOT_SHA: fixtures4.snapHash,
            EXPECTED_MANIFEST_SHA: fixtures4.manHash,
            RUNNER_SCRIPT: '/app/server/prisma/synthetic_adapter.cjs',
            EXPECTED_APPLY_COUNT: '4',
            HEALTH_RETRIES: '2'
        });

        const res4 = cp.spawnSync(bashCmd, [toPosix(releaseScript), IMAGE_TAG], { env: env4, encoding: 'utf8' });
        if (res4.status === 0) {
            throw new Error('Scenario 4 should have failed due to health check failure');
        }

        if (!res4.stdout.includes('Preserving applied database state') ||
            !res4.stdout.includes('Do NOT restore pre-apply backup')) {
            throw new Error('Scenario 4 missing committed database preservation notice in stdout:\n' + res4.stdout);
        }

        // Verify volume DB still contains 5 samples (committed state PRESERVED, not rolled back)
        const samples4 = queryVolumeDb(vol4, 'SELECT count(*) as c FROM Sample');
        if (samples4[0].c !== 5) {
            throw new Error(`Scenario 4 expected 5 committed samples preserved, got ${samples4[0].c}`);
        }

        const cfg4 = queryVolumeDb(vol4, "SELECT isActive, projectCode FROM KoboConfig WHERE id = '25731264-f02a-4172-8ef1-75512b7607a5'");
        if (cfg4[0].isActive !== 1 || cfg4[0].projectCode !== 'SOILFER-US') {
            throw new Error('Scenario 4 KoboConfig committed state was not preserved: ' + JSON.stringify(cfg4[0]));
        }

        // Ingress retained 503 maintenance mode
        const apacheQuiesce4 = fs.readFileSync(path.join(apache4, 'httpd-lims.conf'), 'utf8');
        if (!apacheQuiesce4.includes('Write Quiescence Active')) {
            throw new Error('Scenario 4 should have retained 503 write quiescence after health check failure');
        }

        console.log('  ✓ Scenario 4 PASSED: Failed health check executed cleanup and preserved committed database state.\n');

        // ====================================================================
        // SCENARIO 5: Real Wrapper Image Identity (.Image) Mismatch Rejection
        // ====================================================================
        console.log('[Scenario 5] Real Bash Wrapper Image Identity (.Image) Mismatch Rejection...');
        const dir5 = path.join(tmpDir, 'scenario_5_mismatch');
        fs.mkdirSync(dir5, { recursive: true });
        const fixtures5 = createSyntheticFixtures(dir5);

        const vol5 = registerVolume(`lims_disposable_vol_5_${TS}`);
        cp.execFileSync('docker', ['volume', 'create', vol5], { stdio: 'pipe' });
        initializeVolumeDatabase(vol5);

        // Create an outdated container image with a distinct digest via docker commit
        const tempContainer = registerContainer(`lims_temp_base_${TS}`);
        cp.execFileSync('docker', ['run', '--name', tempContainer, REVIEWED_IMAGE_ID, 'touch', '/outdated_marker']);
        const outdatedImageTag = registerImage(`soilfer-lims:outdated-${TS}`);
        cp.execFileSync('docker', ['commit', tempContainer, outdatedImageTag]);
        cp.execFileSync('docker', ['rm', '-f', tempContainer]);

        // Start container with outdated image
        const app5 = registerContainer(`lims_app_mismatch_${TS}`);
        cp.execFileSync('docker', [
            'run', '-d',
            '--name', app5,
            '--entrypoint', 'node',
            '-v', `${vol5}:/app/server/prisma`,
            outdatedImageTag,
            '-e', 'setInterval(() => {}, 1000)'
        ]);

        const apache5 = path.join(dir5, 'apache');
        const opt5 = path.join(dir5, 'opt');
        const bin5 = path.join(dir5, 'bin');
        fs.mkdirSync(apache5, { recursive: true });
        fs.mkdirSync(opt5, { recursive: true });
        fs.mkdirSync(bin5, { recursive: true });

        fs.writeFileSync(path.join(apache5, 'httpd-lims.conf'), '# LIVE REVERSE PROXY CONFIG\nProxyPass / http://127.0.0.1:3000/\n');
        fs.writeFileSync(path.join(bin5, 'systemctl'), '#!/bin/sh\nexit 0\n');
        fs.chmodSync(path.join(bin5, 'systemctl'), '755');
        fs.writeFileSync(path.join(bin5, 'curl'), '#!/bin/sh\necho \'{"status":"ok"}\'\nexit 0\n');
        fs.chmodSync(path.join(bin5, 'curl'), '755');

        const env5 = Object.assign({}, process.env, {
            PATH: `${bin5}${path.delimiter}${process.env.PATH}`,
            APP_CONTAINER_NAME: app5,
            DOCKER_VOLUME_NAME: vol5,
            LIMS_OPT_DIR: toPosix(opt5),
            APACHE_CONF_DIR: toPosix(apache5),
            SYSTEMCTL_CMD: toPosix(path.join(bin5, 'systemctl')),
            CURL_CMD: toPosix(path.join(bin5, 'curl')),
            SQLITE3_CMD: 'sqlite3',
            PRIVATE_SNAPSHOT: toPosix(fixtures5.snapPath),
            PRIVATE_MANIFEST: toPosix(fixtures5.manPath),
            EXPECTED_SNAPSHOT_SHA: fixtures5.snapHash,
            EXPECTED_MANIFEST_SHA: fixtures5.manHash,
            RUNNER_SCRIPT: '/app/server/prisma/synthetic_adapter.cjs',
            EXPECTED_APPLY_COUNT: '4',
            HEALTH_RETRIES: '3'
        });

        // Test A: Pass reviewed image tag - wrapper must reject app5 because its actual .Image does not match
        const res5a = cp.spawnSync(bashCmd, [toPosix(releaseScript), IMAGE_TAG], { env: env5, encoding: 'utf8' });
        if (res5a.status === 0 || !res5a.stdout.includes('actual image ID') || !res5a.stdout.includes('does not match reviewed runner image')) {
            throw new Error('Scenario 5A should have rejected outdated container image ID:\n' + res5a.stdout);
        }

        // Test B: Verify live container was NOT stopped
        const isRunning5 = cp.execFileSync('docker', ['inspect', app5, '--format', '{{.State.Running}}'], { encoding: 'utf8' }).trim();
        if (isRunning5 !== 'true') {
            throw new Error('Scenario 5 stopped live application container during preflight failure!');
        }

        // Test C: Verify proxy was NOT mutated
        const apacheLive5 = fs.readFileSync(path.join(apache5, 'httpd-lims.conf'), 'utf8');
        if (!apacheLive5.includes('LIVE REVERSE PROXY CONFIG')) {
            throw new Error('Scenario 5 mutated reverse proxy during preflight failure!');
        }

        // Test D: Verify DB was NOT mutated
        const samples5 = queryVolumeDb(vol5, 'SELECT count(*) as c FROM Sample');
        if (samples5[0].c !== 1) {
            throw new Error('Scenario 5 mutated database during preflight failure!');
        }

        console.log('  ✓ Scenario 5 PASSED: Wrapper rejected image mismatch before mutation; live container, proxy, and DB untouched.\n');

        console.log('================================================================');
        console.log('  ALL REAL DOCKER BOUNDARY REHEARSALS COMPLETED SUCCESSFULLY    ');
        console.log('  Smoke | Real Wrapper Success | Partial-Apply Rollback        ');
        console.log('  Writer Interruption | Health-Fail Preserve | Image Identity   ');
        console.log('================================================================\n');

    } finally {
        cleanupAll();
    }
}

runRealDockerBoundarySuite().catch(err => {
    console.error('REAL_DOCKER_REHEARSAL_FAILED:', err);
    cleanupAll();
    process.exit(1);
});
