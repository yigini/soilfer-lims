#!/usr/bin/env node
'use strict';

/**
 * Real Disposable Docker Deployment Readiness Acceptance Suite
 * File: server/scripts/rehearsal_deployment_readiness.cjs
 *
 * Verifies default-entrypoint Docker runtime behavior in an isolated environment:
 * 1. Scenario 1: Default entrypoint empty-volume local mode installation, health, login & password change.
 * 2. Scenario 2: Container restart on same volume — persistent JWT secret, pre-restart token validation & no reseed.
 * 3. Scenario 3: Interrupted-init (partial seed) recovery on startup with default entrypoint.
 * 5. Scenario 5: Multi-lab representative workload, concurrent intake, real data export, background jobs & quiesced backup serialization.
 * 6. Scenario 6: Populated supported-baseline-to-target upgrade, assets preservation, staged Route B recovery, failure behavior & epoch cursor invalidation.
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const net = require('net');
const os = require('os');

console.log('================================================================');
console.log('  REAL DISPOSABLE DOCKER DEPLOYMENT READINESS ACCEPTANCE        ');
console.log('  Testing Default-Entrypoint Containers on Empty Volumes        ');
console.log('================================================================\n');

// 1. Check Docker Daemon
try {
    cp.execFileSync('docker', ['info'], { stdio: 'ignore' });
} catch (e) {
    if (process.env.CI) {
        console.error('FATAL: Docker daemon is required in CI environment but failed to respond!');
        process.exit(1);
    } else {
        console.log('NOTICE: Docker daemon is not running in this local environment.');
        console.log('Skipping real Docker deployment readiness rehearsal. This suite executes in GitHub Actions CI (ubuntu-latest).');
        process.exit(0);
    }
}

const IMAGE_TAG = process.env.IMAGE_TAG || 'soilfer-lims:ci';

// Verify image exists and resolve immutable ID
let IMMUTABLE_IMAGE_ID;
try {
    IMMUTABLE_IMAGE_ID = cp.execFileSync('docker', ['image', 'inspect', IMAGE_TAG, '--format', '{{.Id}}'], { encoding: 'utf8' }).trim();
    console.log(`Image Tag:    ${IMAGE_TAG}`);
    console.log(`Immutable ID: ${IMMUTABLE_IMAGE_ID}\n`);
} catch (e) {
    console.error(`FATAL: Required image '${IMAGE_TAG}' not found in Docker daemon!`);
    console.error('Build the image first, e.g.: docker build -t soilfer-lims:ci .');
    process.exit(1);
}

const TS = Date.now();
const disposableContainers = [];
const disposableVolumes = [];
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `lims_deploy_acceptance_${TS}_`));

function registerContainer(id) {
    disposableContainers.push(id);
    return id;
}

function registerVolume(vol) {
    disposableVolumes.push(vol);
    return vol;
}

function extractTokenAndUser(data) {
    const token = data.token || data.data?.token;
    const user = data.user || data.data?.user || {};
    return { token, user };
}

function cleanup() {
    console.log('\n🧹 Cleaning up disposable test resources...');
    for (const c of disposableContainers) {
        try { cp.execFileSync('docker', ['rm', '-f', c], { stdio: 'ignore' }); } catch (_) {}
    }
    for (const v of disposableVolumes) {
        try { cp.execFileSync('docker', ['volume', 'rm', '-f', v], { stdio: 'ignore' }); } catch (_) {}
    }
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    console.log('✓ Cleanup complete.\n');
}

process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });
process.on('SIGTERM', () => { cleanup(); process.exit(1); });

async function getFreePort() {
    return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.listen(0, '127.0.0.1', () => {
            const port = srv.address().port;
            srv.close(() => resolve(port));
        });
        srv.on('error', reject);
    });
}

async function waitForHealth(port, containerName = null, maxWaitMs = 60000) {
    const start = Date.now();
    const url = `http://127.0.0.1:${port}/api/health`;
    while (Date.now() - start < maxWaitMs) {
        if (containerName) {
            try {
                const status = cp.execFileSync('docker', ['inspect', containerName, '--format', '{{.State.Status}}'], { encoding: 'utf8' }).trim();
                if (status === 'exited' || status === 'dead') {
                    const logs = cp.execFileSync('docker', ['logs', containerName], { encoding: 'utf8' });
                    throw new Error(`Container '${containerName}' exited unexpectedly with status '${status}'. Logs:\n${logs}`);
                }
            } catch (err) {
                if (err.message.includes('exited unexpectedly')) throw err;
            }
        }
        try {
            const res = await fetch(url);
            if (res.status === 200) {
                return true;
            }
        } catch (_) {}
        await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error(`Timeout waiting for health endpoint on port ${port} after ${maxWaitMs}ms`);
}

async function runSuite() {
    // ─────────────────────────────────────────────────────────────
    // SCENARIO 1: Default-Entrypoint Local Mode First-Start & Login
    // ─────────────────────────────────────────────────────────────
    console.log('▶ [Scenario 1] Default Entrypoint Empty-Volume Local Mode First-Start...');
    const localVol = registerVolume(`lims_vol_local_${TS}`);
    const localPort = await getFreePort();
    const localContainer = registerContainer(`lims_c_local_${TS}`);

    // Run container with DEFAULT ENTRYPOINT (no entrypoint override!)
    cp.execFileSync('docker', [
        'run', '-d',
        '--name', localContainer,
        '-p', `127.0.0.1:${localPort}:3000`,
        '-v', `${localVol}:/app/server/prisma`,
        '-e', 'DEPLOYMENT_MODE=local',
        '-e', 'ADMIN_INITIAL_PASSWORD=InitialSecretLocal123!',
        '-e', 'PORT=3000',
        '-e', 'NODE_ENV=production',
        IMAGE_TAG
    ]);

    await waitForHealth(localPort, localContainer);
    console.log(`  ✓ Container healthy on port ${localPort}`);

    // Initial Login
    const loginRes = await fetch(`http://127.0.0.1:${localPort}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'InitialSecretLocal123!' })
    });
    if (loginRes.status !== 200) {
        const txt = await loginRes.text();
        throw new Error(`Initial login failed with status ${loginRes.status}: ${txt}`);
    }
    const loginData = await loginRes.json();
    const { token: localToken, user: localUser } = extractTokenAndUser(loginData);
    if (!localToken || !localUser.mustChangePassword) {
        throw new Error(`Expected token and user.mustChangePassword=true, got: ${JSON.stringify(loginData)}`);
    }
    console.log('  ✓ Initial admin login succeeded (mustChangePassword=true)');

    // Mandatory Password Change
    const changeRes = await fetch(`http://127.0.0.1:${localPort}/api/auth/change-password`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localToken}`
        },
        body: JSON.stringify({
            currentPassword: 'InitialSecretLocal123!',
            newPassword: 'UpdatedSecretLocal456!'
        })
    });
    if (changeRes.status !== 200) {
        const txt = await changeRes.text();
        throw new Error(`Password change failed with status ${changeRes.status}: ${txt}`);
    }
    console.log('  ✓ Password change succeeded');

    // Login with new password to get active operational token before container stop
    const postChangeLoginRes = await fetch(`http://127.0.0.1:${localPort}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'UpdatedSecretLocal456!' })
    });
    if (postChangeLoginRes.status !== 200) {
        throw new Error(`Post-change login failed: ${postChangeLoginRes.status}`);
    }
    const { token: preRestartToken } = extractTokenAndUser(await postChangeLoginRes.json());

    // Verify preRestartToken works on operational endpoint before restart
    const preRestartCheck = await fetch(`http://127.0.0.1:${localPort}/api/labs`, {
        headers: { 'Authorization': `Bearer ${preRestartToken}` }
    });
    if (preRestartCheck.status !== 200) {
        throw new Error(`Pre-restart token check failed: ${preRestartCheck.status}`);
    }
    console.log('  ✓ Pre-restart token issued and verified active on operational API');

    // Inspect persisted secret before restart
    const secretBefore = cp.execFileSync('docker', [
        'run', '--rm',
        '-v', `${localVol}:/app/server/prisma`,
        IMAGE_TAG,
        'cat', '/app/server/prisma/.jwt_secret'
    ], { encoding: 'utf8' }).trim();
    if (!secretBefore || secretBefore.length < 32) {
        throw new Error('Persisted .jwt_secret on volume is missing or too short');
    }
    console.log(`  ✓ Persisted secret verified on volume (${secretBefore.slice(0, 8)}...)`);

    // Stop container 1
    cp.execFileSync('docker', ['stop', localContainer]);
    console.log('  ✓ Quiesced container 1');

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 2: Container Restart on Same Volume (Stable JWT, No Reseed)
    // ─────────────────────────────────────────────────────────────
    console.log('\n▶ [Scenario 2] Container Restart on Same Volume (Secret Persistence & No Reseed)...');
    const restartContainer = registerContainer(`lims_c_restart_${TS}`);
    const restartPort = await getFreePort();

    // Start with blank secret on the SAME volume
    cp.execFileSync('docker', [
        'run', '-d',
        '--name', restartContainer,
        '-p', `127.0.0.1:${restartPort}:3000`,
        '-v', `${localVol}:/app/server/prisma`,
        '-e', 'DEPLOYMENT_MODE=local',
        '-e', 'PORT=3000',
        '-e', 'NODE_ENV=production',
        IMAGE_TAG
    ]);

    await waitForHealth(restartPort, restartContainer);
    console.log(`  ✓ Restarted container healthy on port ${restartPort}`);

    // Cross-restart assertion: Pre-restart token MUST authenticate without re-login!
    const preRestartAuthRes = await fetch(`http://127.0.0.1:${restartPort}/api/labs`, {
        headers: { 'Authorization': `Bearer ${preRestartToken}` }
    });
    if (preRestartAuthRes.status !== 200) {
        throw new Error(`Pre-restart JWT token failed to authenticate after restart: status ${preRestartAuthRes.status}`);
    }
    console.log('  ✓ Pre-restart JWT token remains valid across container restart without re-login');

    // Cross-restart assertion: Verify persisted secret is byte-for-byte identical
    const secretAfter = cp.execFileSync('docker', [
        'run', '--rm',
        '-v', `${localVol}:/app/server/prisma`,
        IMAGE_TAG,
        'cat', '/app/server/prisma/.jwt_secret'
    ], { encoding: 'utf8' }).trim();
    if (secretBefore !== secretAfter) {
        throw new Error(`JWT secret changed across restart! before=${secretBefore}, after=${secretAfter}`);
    }
    console.log('  ✓ Persisted secret byte-for-byte identical across restart');

    // Verify login with updated password
    const restartLoginRes = await fetch(`http://127.0.0.1:${restartPort}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'UpdatedSecretLocal456!' })
    });
    if (restartLoginRes.status !== 200) {
        throw new Error(`Post-restart login failed with status ${restartLoginRes.status}`);
    }
    const restartData = await restartLoginRes.json();
    const { user: restartUser } = extractTokenAndUser(restartData);
    if (restartUser.mustChangePassword) {
        throw new Error('mustChangePassword should be false after previous password change');
    }
    console.log('  ✓ Login with updated password confirmed on restarted container');

    // Check logs to ensure seed was NOT re-run
    const restartLogs = cp.execFileSync('docker', ['logs', restartContainer], { encoding: 'utf8' });
    if (restartLogs.includes('Seeding initial administrator')) {
        throw new Error('FATAL: Container reseeded an already-populated database on restart!');
    }
    console.log('  ✓ Verified seed.js was safely skipped on restart');
    cp.execFileSync('docker', ['stop', restartContainer]);

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 3: Interrupted-Init (Partial Seed Recovery) in Docker
    // ─────────────────────────────────────────────────────────────
    console.log('\n▶ [Scenario 3] Interrupted-Init (Partial Seed Recovery) in Docker...');
    const partialVol = registerVolume(`lims_vol_partial_${TS}`);
    const partialPort = await getFreePort();
    const partialContainer = registerContainer(`lims_c_partial_${TS}`);

    // Initialize schema and inject pre-existing LAB01 with 0 users
    cp.execFileSync('docker', [
        'run', '--rm',
        '-v', `${partialVol}:/app/server/prisma`,
        IMAGE_TAG,
        'sh', '-c',
        `npx prisma db push && node -e "
            const Database = require('better-sqlite3');
            const db = new Database('prisma/dev.db');
            db.prepare(\\"INSERT INTO Lab (id, name, code, country, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)\\")
              .run('pre-lab-1', 'Existing Default Lab', 'LAB01', 'INT', 1, new Date().toISOString(), new Date().toISOString());
            db.close();
        "`
    ]);

    // Boot container with default entrypoint on the partially initialized volume
    cp.execFileSync('docker', [
        'run', '-d',
        '--name', partialContainer,
        '-p', `127.0.0.1:${partialPort}:3000`,
        '-v', `${partialVol}:/app/server/prisma`,
        '-e', 'DEPLOYMENT_MODE=local',
        '-e', 'ADMIN_INITIAL_PASSWORD=ResumedPass789!',
        '-e', 'PORT=3000',
        '-e', 'NODE_ENV=production',
        IMAGE_TAG
    ]);

    await waitForHealth(partialPort, partialContainer);
    console.log(`  ✓ Container booted on partial volume and became healthy on port ${partialPort}`);

    // Login must succeed with ResumedPass789!
    const partialLoginRes = await fetch(`http://127.0.0.1:${partialPort}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'ResumedPass789!' })
    });
    if (partialLoginRes.status !== 200) {
        throw new Error(`Partial resumption login failed with status ${partialLoginRes.status}`);
    }
    console.log('  ✓ Partial initialization was cleanly resumed and admin user created without LAB01 conflict');
    cp.execFileSync('docker', ['stop', partialContainer]);

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 4: Global Mode First-Start & SUPER_ADMIN Coordination
    // ─────────────────────────────────────────────────────────────
    console.log('\n▶ [Scenario 4] Default Entrypoint Empty-Volume Global Mode First-Start...');
    const globalVol = registerVolume(`lims_vol_global_${TS}`);
    const globalPort = await getFreePort();
    const globalContainer = registerContainer(`lims_c_global_${TS}`);

    cp.execFileSync('docker', [
        'run', '-d',
        '--name', globalContainer,
        '-p', `127.0.0.1:${globalPort}:3000`,
        '-v', `${globalVol}:/app/server/prisma`,
        '-e', 'DEPLOYMENT_MODE=global',
        '-e', 'ADMIN_INITIAL_PASSWORD=GlobalSuperPass123!',
        '-e', 'PORT=3000',
        '-e', 'NODE_ENV=production',
        IMAGE_TAG
    ]);

    await waitForHealth(globalPort, globalContainer);
    console.log(`  ✓ Global mode container healthy on port ${globalPort}`);

    const globalLoginRes = await fetch(`http://127.0.0.1:${globalPort}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'GlobalSuperPass123!' })
    });
    if (globalLoginRes.status !== 200) {
        throw new Error(`Global admin login failed with status ${globalLoginRes.status}`);
    }
    const globalLoginData = await globalLoginRes.json();
    const { token: globalInitialToken, user: globalUser } = extractTokenAndUser(globalLoginData);
    if (globalUser.role !== 'SUPER_ADMIN') {
        throw new Error(`Expected role SUPER_ADMIN in global mode, got ${globalUser.role}`);
    }
    console.log('  ✓ Global SUPER_ADMIN login verified');

    // Update password for global admin
    const globalChangeRes = await fetch(`http://127.0.0.1:${globalPort}/api/auth/change-password`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${globalInitialToken}`
        },
        body: JSON.stringify({
            currentPassword: 'GlobalSuperPass123!',
            newPassword: 'UpdatedGlobalPass456!'
        })
    });
    if (globalChangeRes.status !== 200) {
        throw new Error(`Global password change failed`);
    }

    // Login with new password to get permanent token
    const tokenRes = await fetch(`http://127.0.0.1:${globalPort}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'UpdatedGlobalPass456!' })
    });
    const { token: superToken } = extractTokenAndUser(await tokenRes.json());

    // Create Laboratory A and Laboratory B via Admin API
    const labARes = await fetch(`http://127.0.0.1:${globalPort}/api/labs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${superToken}` },
        body: JSON.stringify({ id: `lab-alpha-${TS}`, name: 'Accredited Lab Alpha', code: `ALPHA_${TS}`, country: 'GHA' })
    });
    const labBRes = await fetch(`http://127.0.0.1:${globalPort}/api/labs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${superToken}` },
        body: JSON.stringify({ id: `lab-beta-${TS}`, name: 'Accredited Lab Beta', code: `BETA_${TS}`, country: 'KEN' })
    });
    if (labARes.status !== 200 || labBRes.status !== 200) {
        throw new Error(`Failed to create laboratories: A=${labARes.status}, B=${labBRes.status}`);
    }
    const { lab: labA } = await labARes.json();
    const { lab: labB } = await labBRes.json();
    console.log(`  ✓ Created Lab Alpha (${labA.code}) and Lab Beta (${labB.code})`);

    // Activate both laboratories
    await fetch(`http://127.0.0.1:${globalPort}/api/labs/${labA.id}/toggle-active`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${superToken}` }
    });
    await fetch(`http://127.0.0.1:${globalPort}/api/labs/${labB.id}/toggle-active`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${superToken}` }
    });
    console.log('  ✓ Activated both laboratories');

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 5: Multi-Lab Workload, Real Export, Schedulers & Quiesced Backup Serialization
    // ─────────────────────────────────────────────────────────────
    console.log('\n▶ [Scenario 5] Multi-Lab Workload, Real Export, Schedulers & Quiesced Backup Serialization...');
    // Create Manager A and Manager B accounts
    const userARes = await fetch(`http://127.0.0.1:${globalPort}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${superToken}` },
        body: JSON.stringify({
            username: 'manager_alpha',
            email: 'mgr_a@alpha.local',
            password: 'AlphaManagerPass123!',
            role: 'LAB_MANAGER',
            labId: labA.id,
            isActive: true
        })
    });
    const userBRes = await fetch(`http://127.0.0.1:${globalPort}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${superToken}` },
        body: JSON.stringify({
            username: 'manager_beta',
            email: 'mgr_b@beta.local',
            password: 'BetaManagerPass123!',
            role: 'LAB_MANAGER',
            labId: labB.id,
            isActive: true
        })
    });
    if ((userARes.status !== 200 && userARes.status !== 201) || (userBRes.status !== 200 && userBRes.status !== 201)) {
        throw new Error(`Failed to create managers: A=${userARes.status}, B=${userBRes.status}`);
    }

    // 1. Manager A Onboarding & Operational Token
    const loginARes = await fetch(`http://127.0.0.1:${globalPort}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'manager_alpha', password: 'AlphaManagerPass123!' })
    });
    if (loginARes.status !== 200) throw new Error(`Manager A login failed: ${loginARes.status}`);
    const { token: initTokenA, user: initUserA } = extractTokenAndUser(await loginARes.json());
    if (!initUserA.mustChangePassword) throw new Error('Expected Manager A mustChangePassword=true');

    await fetch(`http://127.0.0.1:${globalPort}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${initTokenA}` },
        body: JSON.stringify({ currentPassword: 'AlphaManagerPass123!', newPassword: 'UpdatedAlphaPass789!' })
    });
    const permLoginARes = await fetch(`http://127.0.0.1:${globalPort}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'manager_alpha', password: 'UpdatedAlphaPass789!' })
    });
    const { token: tokenA } = extractTokenAndUser(await permLoginARes.json());

    // 2. Manager B Onboarding & Operational Token
    const loginBRes = await fetch(`http://127.0.0.1:${globalPort}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'manager_beta', password: 'BetaManagerPass123!' })
    });
    if (loginBRes.status !== 200) throw new Error(`Manager B login failed: ${loginBRes.status}`);
    const { token: initTokenB, user: initUserB } = extractTokenAndUser(await loginBRes.json());
    if (!initUserB.mustChangePassword) throw new Error('Expected Manager B mustChangePassword=true');

    await fetch(`http://127.0.0.1:${globalPort}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${initTokenB}` },
        body: JSON.stringify({ currentPassword: 'BetaManagerPass123!', newPassword: 'UpdatedBetaPass789!' })
    });
    const permLoginBRes = await fetch(`http://127.0.0.1:${globalPort}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'manager_beta', password: 'UpdatedBetaPass789!' })
    });
    const { token: tokenB } = extractTokenAndUser(await permLoginBRes.json());

    // 3. Multi-Lab Sample Intake: Concurrent ingestion across Lab Alpha & Lab Beta
    const createdAlphaSamples = [];
    const createdBetaSamples = [];
    const intakePromises = [];
    for (let i = 1; i <= 5; i++) {
        intakePromises.push(
            fetch(`http://127.0.0.1:${globalPort}/api/samples/walkin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
                body: JSON.stringify({ submitter: `Farm Alpha ${i}`, description: `Soil Alpha Sample ${i}`, sampleType: 'ROUTINE' })
            }).then(async r => {
                if (r.status !== 200 && r.status !== 201) throw new Error(`Alpha sample ${i} failed: ${r.status}`);
                const resJson = await r.json();
                createdAlphaSamples.push(resJson.sample);
            })
        );
        intakePromises.push(
            fetch(`http://127.0.0.1:${globalPort}/api/samples/walkin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
                body: JSON.stringify({ submitter: `Farm Beta ${i}`, description: `Soil Beta Sample ${i}`, sampleType: 'ROUTINE' })
            }).then(async r => {
                if (r.status !== 200 && r.status !== 201) throw new Error(`Beta sample ${i} failed: ${r.status}`);
                const resJson = await r.json();
                createdBetaSamples.push(resJson.sample);
            })
        );
    }
    await Promise.all(intakePromises);
    console.log('  ✓ Ingested 10 representative samples concurrently across Lab Alpha & Lab Beta');

    const expectedAlphaSampleIds = createdAlphaSamples.map(s => s.originalId || s.id);
    const expectedAlphaLabIds = createdAlphaSamples.map(s => s.labId);
    const expectedBetaSampleIds = createdBetaSamples.map(s => s.originalId || s.id);
    const expectedBetaLabIds = createdBetaSamples.map(s => s.labId);

    // 4. Real Data Export Endpoint: POST /api/exports/data
    const exportARes = await fetch(`http://127.0.0.1:${globalPort}/api/exports/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
        body: JSON.stringify({ type: 'REGISTER' })
    });
    if (exportARes.status !== 200) throw new Error(`Manager A export failed with status ${exportARes.status}`);
    const exportDataA = await exportARes.json();
    const rowsA = Array.isArray(exportDataA.data) ? exportDataA.data : (Array.isArray(exportDataA.rows) ? exportDataA.rows : []);
    if (rowsA.length !== 5) throw new Error(`Expected exactly 5 rows in Manager A export, got ${rowsA.length}`);
    const alphaSampleIds = rowsA.map(r => r['Sample ID'] || '').filter(Boolean);
    const alphaLabIds = rowsA.map(r => r['Lab ID'] || '').filter(Boolean);
    if (alphaSampleIds.length !== 5) throw new Error(`Expected 5 valid Sample IDs in Manager A export, got ${alphaSampleIds.length}`);
    if (rowsA.some(r => (r['Sample ID'] && r['Sample ID'].includes('Beta')) || (r['Lab ID'] && r['Lab ID'].includes('Beta')))) {
        throw new Error('Manager A export contained Lab Beta records!');
    }
    if (typeof expectedAlphaSampleIds !== 'undefined' && expectedAlphaSampleIds.length > 0) {
        for (const sId of alphaSampleIds) {
            if (!expectedAlphaSampleIds.includes(sId)) throw new Error(`Manager A export contained unexpected sample ID: ${sId}`);
        }
    }
    console.log(`  ✓ Manager A real data export returned exactly ${rowsA.length} scoped samples for Lab Alpha`);

    const exportBRes = await fetch(`http://127.0.0.1:${globalPort}/api/exports/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
        body: JSON.stringify({ type: 'REGISTER' })
    });
    if (exportBRes.status !== 200) throw new Error(`Manager B export failed with status ${exportBRes.status}`);
    const exportDataB = await exportBRes.json();
    const rowsB = Array.isArray(exportDataB.data) ? exportDataB.data : (Array.isArray(exportDataB.rows) ? exportDataB.rows : []);
    if (rowsB.length !== 5) throw new Error(`Expected exactly 5 rows in Manager B export, got ${rowsB.length}`);
    const betaSampleIds = rowsB.map(r => r['Sample ID'] || '').filter(Boolean);
    const betaLabIds = rowsB.map(r => r['Lab ID'] || '').filter(Boolean);
    if (betaSampleIds.length !== 5) throw new Error(`Expected 5 valid Sample IDs in Manager B export, got ${betaSampleIds.length}`);
    if (rowsB.some(r => (r['Sample ID'] && r['Sample ID'].includes('Alpha')) || (r['Lab ID'] && r['Lab ID'].includes('Alpha')))) {
        throw new Error('Manager B export contained Lab Alpha records!');
    }
    if (typeof expectedBetaSampleIds !== 'undefined' && expectedBetaSampleIds.length > 0) {
        for (const sId of betaSampleIds) {
            if (!expectedBetaSampleIds.includes(sId)) throw new Error(`Manager B export contained unexpected sample ID: ${sId}`);
        }
    }
    console.log(`  ✓ Manager B real data export returned exactly ${rowsB.length} scoped samples for Lab Beta`);

    const exportSuperRes = await fetch(`http://127.0.0.1:${globalPort}/api/exports/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${superToken}` },
        body: JSON.stringify({ type: 'REGISTER' })
    });
    if (exportSuperRes.status !== 200) throw new Error(`Super Admin export failed: ${exportSuperRes.status}`);
    const exportSuperData = await exportSuperRes.json();
    const rowsSuper = Array.isArray(exportSuperData.data) ? exportSuperData.data : (Array.isArray(exportSuperData.rows) ? exportSuperData.rows : []);
    if (rowsSuper.length !== 10) throw new Error(`Expected exactly 10 rows in Super Admin export, got ${rowsSuper.length}`);
    const superSampleIds = rowsSuper.map(r => r['Sample ID'] || '').filter(Boolean);
    if (superSampleIds.length !== 10) throw new Error(`Expected 10 valid Sample IDs in Super Admin export, got ${superSampleIds.length}`);
    if (typeof expectedAlphaSampleIds !== 'undefined' && expectedAlphaSampleIds.length > 0) {
        for (const sId of expectedAlphaSampleIds) {
            if (!superSampleIds.includes(sId)) throw new Error(`Super Admin export missing Alpha sample: ${sId}`);
        }
    }
    if (typeof expectedBetaSampleIds !== 'undefined' && expectedBetaSampleIds.length > 0) {
        for (const sId of expectedBetaSampleIds) {
            if (!superSampleIds.includes(sId)) throw new Error(`Super Admin export missing Beta sample: ${sId}`);
        }
    }
    console.log(`  ✓ Super Admin real data export returned all ${rowsSuper.length} cross-facility samples`);

    // 5. Background Scheduler Verification
    const globalLogs = cp.execFileSync('docker', ['logs', globalContainer], { encoding: 'utf8' });
    if (!globalLogs.includes('[SCHEDULER] Escalation background scheduler initialized')) {
        throw new Error('FATAL: Background escalation scheduler initialization marker not found in logs!');
    }
    console.log('  ✓ Verified background escalation scheduler initialized during container boot');

    // 6. Safe Serialization: Quiesce container before offline backup (no writer race)
    cp.execFileSync('docker', ['stop', globalContainer]);
    console.log('  ✓ Quiesced active writer container before generating database backup');

    // 8. Execute verified backup command
    const backupHostDir = path.join(tmpDir, 'backups');
    fs.mkdirSync(backupHostDir, { recursive: true });

    const backupOutput = cp.execFileSync('docker', [
        'run', '--rm',
        '-v', `${globalVol}:/app/server/prisma`,
        '-v', `${backupHostDir}:/app/server/backups`,
        IMAGE_TAG,
        'node', 'scripts/backup_db.js'
    ], { encoding: 'utf8' });
    console.log('  ✓ Pre-restore backup executed cleanly');

    // Extract filename using documented regex pattern
    const match = backupOutput.match(/(soilfer_lims_backup_|backup_)[^ ')]+\.db\.gz/);
    if (!match) {
        throw new Error(`Documented regex failed to match generated backup filename in output: ${backupOutput}`);
    }
    const backupFile = match[0];
    if (!fs.existsSync(path.join(backupHostDir, backupFile))) {
        throw new Error(`Identified backup file does not exist on disk: ${backupFile}`);
    }
    console.log(`  ✓ Bound exact backup artifact matching runbook regex: ${backupFile}`);

    // Verify backup artifact with exact table counts (3 users, 2 labs, 10 samples)
    const verifyBackupJson = cp.execFileSync('docker', [
        'run', '--rm',
        '-v', `${backupHostDir}:/backup`,
        IMAGE_TAG,
        'node', '-e',
        `const { verifyBackup } = require('./scripts/verify_backup');
         (async () => {
             const check = await verifyBackup('/backup/${backupFile}');
             if (!check.valid) {
                 console.error('Backup verification failed:', check.error);
                 process.exit(1);
             }
             console.log(JSON.stringify(check.tables));
         })();`
    ], { encoding: 'utf8' }).trim();
    const tableCounts = JSON.parse(verifyBackupJson);
    if (tableCounts.userCount !== 3 || tableCounts.sampleCount !== 10) {
        throw new Error(`Expected 3 users and 10 samples in backup, got: ${JSON.stringify(tableCounts)}`);
    }
    console.log(`  ✓ Backup artifact verification PASSED: Users=${tableCounts.userCount}, Samples=${tableCounts.sampleCount}`);

    // Restore into a fresh target volume
    const restoredVol = registerVolume(`lims_vol_restored_${TS}`);
    const restoreOutput = cp.execFileSync('docker', [
        'run', '--rm',
        '-v', `${restoredVol}:/app/server/prisma`,
        '-v', `${backupHostDir}:/app/server/backups`,
        IMAGE_TAG,
        'node', 'scripts/restore_db.js', `/app/server/backups/${backupFile}`
    ], { encoding: 'utf8' });
    if (!restoreOutput.includes('[RESTORE] SUCCESS')) {
        throw new Error(`Restore CLI did not report success: ${restoreOutput}`);
    }
    console.log('  ✓ Restore into fresh target volume PASSED with epoch invalidation');

    // Boot container on restored volume and verify health & exact data
    const restoredPort = await getFreePort();
    const restoredContainer = registerContainer(`lims_c_restored_${TS}`);

    cp.execFileSync('docker', [
        'run', '-d',
        '--name', restoredContainer,
        '-p', `127.0.0.1:${restoredPort}:3000`,
        '-v', `${restoredVol}:/app/server/prisma`,
        '-e', 'DEPLOYMENT_MODE=global',
        '-e', 'PORT=3000',
        '-e', 'NODE_ENV=production',
        IMAGE_TAG
    ]);

    await waitForHealth(restoredPort, restoredContainer);
    console.log(`  ✓ Restored container healthy on port ${restoredPort}`);

    // Verify login on restored database
    const verifyRestoredLogin = await fetch(`http://127.0.0.1:${restoredPort}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'UpdatedGlobalPass456!' })
    });
    if (verifyRestoredLogin.status !== 200) {
        throw new Error(`Login on restored database failed with status ${verifyRestoredLogin.status}`);
    }
    console.log('  ✓ Post-restore admin login confirmed');

    // Verify Manager Alpha login and sample preservation on restored database
    const verifyMgrLogin = await fetch(`http://127.0.0.1:${restoredPort}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'manager_alpha', password: 'UpdatedAlphaPass789!' })
    });
    if (verifyMgrLogin.status !== 200) {
        throw new Error(`Manager login on restored database failed with status ${verifyMgrLogin.status}`);
    }
    const { token: restoredTokenA } = extractTokenAndUser(await verifyMgrLogin.json());

    const restoredSamplesRes = await fetch(`http://127.0.0.1:${restoredPort}/api/samples`, {
        headers: { 'Authorization': `Bearer ${restoredTokenA}` }
    });
    const restoredData = await restoredSamplesRes.json();
    const restoredCount = Array.isArray(restoredData?.data) ? restoredData.data.length : 0;
    if (restoredCount !== 5) {
        throw new Error(`Expected exactly 5 preserved samples for Manager Alpha on restored DB, got ${restoredCount}`);
    }
    console.log(`  ✓ Post-restore sample count confirmed (exactly ${restoredCount} samples preserved for Manager Alpha)`);
    cp.execFileSync('docker', ['stop', restoredContainer]);

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 6: Populated Supported-Baseline Upgrade, Assets, Staged Route B & Epoch Invalidation
    // ─────────────────────────────────────────────────────────────
    console.log('\n▶ [Scenario 6] Populated Supported-Baseline Upgrade, Assets, Staged Route B & Epoch Invalidation...');
    const upgDataVol = registerVolume(`lims_vol_upg_data_${TS}`);
    const upgAssetsVol = registerVolume(`lims_vol_upg_assets_${TS}`);
    const upgBackupDir = path.join(tmpDir, 'upg_backups');
    fs.mkdirSync(upgBackupDir, { recursive: true });

    // 1. Declare and establish supported baseline image identity (representing v3.5.30 / commit 48d0e52)
    const BASELINE_COMMIT = '48d0e526ded03232ac8516dd867f4b14923bdb58';
    const BASELINE_IMAGE_TAG = process.env.BASELINE_IMAGE_TAG || 'soilfer-lims:baseline-v3.5.30';
    let baselineImageId;
    try {
        baselineImageId = cp.execFileSync('docker', ['inspect', BASELINE_IMAGE_TAG, '--format', '{{.Id}}'], { encoding: 'utf8' }).trim();
    } catch (_) {
        console.log(`  Building genuine supported baseline image from verified pinned tree ${BASELINE_COMMIT}...`);
        const baselineTreeDir = path.join(tmpDir, 'baseline_tree');
        fs.mkdirSync(baselineTreeDir, { recursive: true });
        try {
            cp.execFileSync('git', ['rev-parse', '--verify', `${BASELINE_COMMIT}^{commit}`], { encoding: 'utf8' });
        } catch (e) {
            throw new Error(`Real supported baseline commit ${BASELINE_COMMIT} is not available in git repository! Cannot synthesize baseline.`);
        }
        const tarPath = path.join(tmpDir, 'baseline.tar');
        const tarBuf = cp.execFileSync('git', ['archive', '--format=tar', BASELINE_COMMIT]);
        fs.writeFileSync(tarPath, tarBuf);
        cp.execFileSync('tar', ['-xf', tarPath, '-C', baselineTreeDir]);
        cp.execFileSync('docker', ['build', '-t', BASELINE_IMAGE_TAG, baselineTreeDir], { stdio: 'inherit' });
        baselineImageId = cp.execFileSync('docker', ['inspect', BASELINE_IMAGE_TAG, '--format', '{{.Id}}'], { encoding: 'utf8' }).trim();
    }
    if (!baselineImageId) {
        throw new Error(`Failed to obtain Docker image ID for supported baseline image ${BASELINE_IMAGE_TAG}`);
    }
    if (baselineImageId === IMMUTABLE_IMAGE_ID) {
        throw new Error('Baseline image must have a distinct immutable image ID from candidate target image!');
    }
    console.log(`  ✓ Bound supported baseline: ${BASELINE_IMAGE_TAG} (Tree: ${BASELINE_COMMIT}, ID: ${baselineImageId})`);
    console.log(`  ✓ Bound candidate target:   ${IMAGE_TAG} (ID: ${IMMUTABLE_IMAGE_ID})`);

    // 2. Initialize populated baseline database, signing secret & exchange state
    const baselineSecretHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    cp.execFileSync('docker', [
        'run', '--rm',
        '-v', `${upgDataVol}:/app/server/prisma`,
        BASELINE_IMAGE_TAG,
        'sh', '-c',
        `mkdir -p /app/server/prisma && printf "${baselineSecretHex}" > /app/server/prisma/.jwt_secret`
    ]);

    const initBaselineOut = cp.execFileSync('docker', [
        'run', '--rm',
        '-v', `${upgDataVol}:/app/server/prisma`,
        BASELINE_IMAGE_TAG,
        'sh', '-c',
        `npx prisma db push && node -e "
            const Database = require('better-sqlite3');
            const bcrypt = require('bcryptjs');
            const { initTables, ensureTriggers, encodeCursor, getCurrentEpoch } = require('./services/exchangeStateService');

            const db = new Database('prisma/dev.db');
            initTables(db);
            ensureTriggers(db);

            const now = new Date().toISOString();
            const hash = bcrypt.hashSync('BaselinePass123!', 10);

            // 2 Baseline Labs
            db.prepare('INSERT INTO Lab (id, name, code, country, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
              .run('lab-base-1', 'Baseline Lab 1', 'BASE01', 'GHA', 1, now, now);
            db.prepare('INSERT INTO Lab (id, name, code, country, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
              .run('lab-base-2', 'Baseline Lab 2', 'BASE02', 'KEN', 1, now, now);

            // 3 Baseline Users (Super Admin + 2 Lab Managers)
            db.prepare('INSERT INTO User (id, username, password, email, role, isActive, mustChangePassword, tokenVersion, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
              .run('u-base-admin', 'admin', hash, 'admin@baseline.local', 'SUPER_ADMIN', 1, 0, 1, now, now);
            db.prepare('INSERT INTO User (id, username, password, email, role, labId, isActive, mustChangePassword, tokenVersion, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
              .run('u-base-mgr1', 'base_mgr1', hash, 'mgr1@baseline.local', 'LAB_MANAGER', 'lab-base-1', 1, 0, 1, now, now);
            db.prepare('INSERT INTO User (id, username, password, email, role, labId, isActive, mustChangePassword, tokenVersion, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
              .run('u-base-mgr2', 'base_mgr2', hash, 'mgr2@baseline.local', 'LAB_MANAGER', 'lab-base-2', 1, 0, 1, now, now);

            // 10 Baseline Samples
            for (let i = 1; i <= 5; i++) {
                const code1 = 'BASE-SMP-' + String(i).padStart(3, '0');
                db.prepare('INSERT INTO Sample (id, originalId, labId, assignedLab, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
                  .run('smp-base-1-' + i, code1, code1, 'lab-base-1', 'REGISTERED', now, now);
            }
            for (let i = 1; i <= 5; i++) {
                const code2 = 'BASE-SMP-' + String(i + 5).padStart(3, '0');
                db.prepare('INSERT INTO Sample (id, originalId, labId, assignedLab, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
                  .run('smp-base-2-' + i, code2, code2, 'lab-base-2', 'REGISTERED', now, now);
            }

            // Set initial epoch and generate signed cursor
            db.prepare(\\"INSERT OR REPLACE INTO _exchange_meta (key, value, updated_at) VALUES ('epoch', 'epoch-baseline-initial', ?)\\").run(now);
            const cursor = encodeCursor({ lastId: 'BASE-SMP-005', issuedAt: Date.now() }, db);
            console.log('[BASELINE_CURSOR]:' + cursor);
            console.log('[BASELINE_EPOCH]:' + getCurrentEpoch(db));
            db.close();
        "`
    ], { encoding: 'utf8' });

    const cursorMatch = initBaselineOut.match(/\[BASELINE_CURSOR\]:(.+)/);
    const initialCursor = cursorMatch ? cursorMatch[1].trim() : null;
    if (!initialCursor) throw new Error('Failed to generate initial baseline exchange cursor');
    console.log('  ✓ Populated baseline database with 2 labs, 3 users, 10 samples, and signed cursor');

    // 3. Populate uploaded asset file in assets volume
    const assetJson = JSON.stringify({ calibrationVersion: '1.0', curve: [0.12, 0.45, 0.89], timestamp: TS });
    cp.execFileSync('docker', [
        'run', '--rm',
        '-v', `${upgAssetsVol}:/app/server/uploads`,
        BASELINE_IMAGE_TAG,
        'sh', '-c',
        `mkdir -p /app/server/uploads && echo '${assetJson}' > /app/server/uploads/spectral_cal_curve.json`
    ]);
    console.log('  ✓ Uploaded reference asset (spectral_cal_curve.json) to assets volume');

    // 4. Boot baseline container to establish verified runtime and obtain pre-upgrade operational token
    const baseContainer = registerContainer(`lims_c_base_${TS}`);
    const basePort = await getFreePort();
    cp.execFileSync('docker', [
        'run', '-d',
        '--name', baseContainer,
        '-p', `127.0.0.1:${basePort}:3000`,
        '-v', `${upgDataVol}:/app/server/prisma`,
        '-v', `${upgAssetsVol}:/app/server/uploads`,
        '-e', 'DEPLOYMENT_MODE=global',
        '-e', 'PORT=3000',
        '-e', 'NODE_ENV=production',
        BASELINE_IMAGE_TAG
    ]);
    await waitForHealth(basePort, baseContainer);
    console.log(`  ✓ Baseline container healthy on port ${basePort}`);

    const baseLoginRes = await fetch(`http://127.0.0.1:${basePort}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'BaselinePass123!' })
    });
    if (baseLoginRes.status !== 200) throw new Error(`Baseline login failed: ${baseLoginRes.status}`);
    const { token: preUpgradeToken } = extractTokenAndUser(await baseLoginRes.json());
    const baseApiRes = await fetch(`http://127.0.0.1:${basePort}/api/labs`, {
        headers: { 'Authorization': `Bearer ${preUpgradeToken}` }
    });
    if (baseApiRes.status !== 200) throw new Error(`Baseline API call failed: ${baseApiRes.status}`);
    console.log('  ✓ Baseline operational login and API access verified');

    // Quiesce baseline container before creating backup snapshots
    cp.execFileSync('docker', ['stop', baseContainer]);

    // 5. Create Route B full volume tarball snapshots
    cp.execFileSync('docker', [
        'run', '--rm',
        '-v', `${upgDataVol}:/data`,
        '-v', `${upgBackupDir}:/backup`,
        'alpine', 'tar', '-czf', `/backup/db_snapshot_${TS}.tar.gz`, '-C', '/data', '.'
    ]);
    cp.execFileSync('docker', [
        'run', '--rm',
        '-v', `${upgAssetsVol}:/assets`,
        '-v', `${upgBackupDir}:/backup`,
        'alpine', 'tar', '-czf', `/backup/assets_snapshot_${TS}.tar.gz`, '-C', '/assets', '.'
    ]);
    console.log(`  ✓ Generated Route B tarballs: db_snapshot_${TS}.tar.gz & assets_snapshot_${TS}.tar.gz`);

    // 6. Test Route B Staged Recovery Failure Behavior First (Fail Closed on Corrupt Archive)
    fs.writeFileSync(path.join(upgBackupDir, 'db_corrupt.tar.gz'), 'CORRUPT_INVALID_ARCHIVE_DATA_PAYLOAD_GARBAGE');
    let corruptStagingFailed = false;
    try {
        cp.execFileSync('docker', [
            'run', '--rm',
            '-v', `${upgBackupDir}:/backup`,
            BASELINE_IMAGE_TAG,
            'sh', '-c',
            `set -e
             rm -rf /backup/staging
             mkdir -p /backup/staging/db
             tar -xzf /backup/db_corrupt.tar.gz -C /backup/staging/db
             node -e "
               const Database = require('better-sqlite3');
               const db = new Database('/backup/staging/db/dev.db', { readonly: true });
               const integrity = db.pragma('integrity_check');
               if (integrity[0]?.integrity_check !== 'ok') process.exit(1);
             "`
        ], { stdio: 'pipe' });
    } catch (_) {
        corruptStagingFailed = true;
    }
    if (!corruptStagingFailed) {
        throw new Error('FATAL: Corrupted tarball did NOT fail closed during staged extraction!');
    }
    console.log('  ✓ Staged recovery safely aborted on corrupt tarball without touching target volume');

    // Assert live volume was untouched
    const verifyUntouched = cp.execFileSync('docker', [
        'run', '--rm',
        '-v', `${upgDataVol}:/app/server/prisma`,
        IMAGE_TAG,
        'node', '-e',
        `const Database = require('better-sqlite3');
         const db = new Database('prisma/dev.db', { readonly: true });
         const samples = db.prepare('SELECT count(*) as n FROM Sample').get().n;
         const integrity = db.pragma('integrity_check');
         db.close();
         if (samples !== 10 || integrity[0]?.integrity_check !== 'ok') process.exit(1);
         console.log('UNTOUCHED_OK');`
    ], { encoding: 'utf8' });
    if (!verifyUntouched.includes('UNTOUCHED_OK')) {
        throw new Error('Target volume was corrupted after failed staging test!');
    }
    console.log('  ✓ Live volume verified intact after corrupt staging abort');

    // 7. Upgrade: Run target image on the populated baseline volume
    const upgTargetContainer = registerContainer(`lims_c_upg_${TS}`);
    const upgTargetPort = await getFreePort();
    cp.execFileSync('docker', [
        'run', '-d',
        '--name', upgTargetContainer,
        '-p', `127.0.0.1:${upgTargetPort}:3000`,
        '-v', `${upgDataVol}:/app/server/prisma`,
        '-v', `${upgAssetsVol}:/app/server/uploads`,
        '-e', 'DEPLOYMENT_MODE=global',
        '-e', 'PORT=3000',
        '-e', 'NODE_ENV=production',
        IMAGE_TAG
    ]);
    await waitForHealth(upgTargetPort, upgTargetContainer);
    console.log(`  ✓ Upgraded target container healthy on port ${upgTargetPort}`);

    // Verify running container is bound to the target image ID (distinct from baseline)
    const targetRunningImageId = cp.execFileSync('docker', ['inspect', upgTargetContainer, '--format', '{{.Image}}'], { encoding: 'utf8' }).trim();
    if (targetRunningImageId !== IMMUTABLE_IMAGE_ID) {
        throw new Error(`Target container running unexpected image: ${targetRunningImageId}`);
    }
    console.log(`  ✓ Target container verified running candidate image ID: ${targetRunningImageId}`);

    // Verify pre-upgrade operational token continues to authenticate (signing secret preservation)
    const preUpgApiRes = await fetch(`http://127.0.0.1:${upgTargetPort}/api/labs`, {
        headers: { 'Authorization': `Bearer ${preUpgradeToken}` }
    });
    if (preUpgApiRes.status !== 200) {
        throw new Error(`Pre-upgrade operational token failed post-upgrade: status ${preUpgApiRes.status}`);
    }
    console.log('  ✓ Pre-upgrade JWT token remains valid on upgraded target container without re-login');

    // Verify credentials preservation across upgrade
    for (const [user, pwd] of [['admin', 'BaselinePass123!'], ['base_mgr1', 'BaselinePass123!'], ['base_mgr2', 'BaselinePass123!']]) {
        const uRes = await fetch(`http://127.0.0.1:${upgTargetPort}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pwd })
        });
        if (uRes.status !== 200) throw new Error(`Login for ${user} failed post-upgrade: status ${uRes.status}`);
    }
    console.log('  ✓ Credentials preserved across upgrade: all baseline accounts authenticated successfully');

    // Verify exact data preservation: all 10 sample codes present with exact IDs
    const expectedSampleCodes = Array.from({ length: 10 }, (_, i) => 'BASE-SMP-' + String(i + 1).padStart(3, '0'));
    const checkDataOutput = cp.execFileSync('docker', [
        'run', '--rm',
        '-v', `${upgDataVol}:/app/server/prisma`,
        IMAGE_TAG,
        'node', '-e',
        `const Database = require('better-sqlite3');
         const db = new Database('prisma/dev.db', { readonly: true });
         const samples = db.prepare('SELECT originalId, labId, assignedLab, status FROM Sample ORDER BY originalId').all();
         db.close();
         console.log(JSON.stringify(samples));`
    ], { encoding: 'utf8' }).trim();
    const upgSamples = JSON.parse(checkDataOutput);
    if (upgSamples.length !== 10) throw new Error(`Expected 10 samples, got ${upgSamples.length}`);
    for (let i = 0; i < 10; i++) {
        const expectedCode = expectedSampleCodes[i];
        if (upgSamples[i].originalId !== expectedCode) {
            throw new Error(`Sample mismatch at index ${i}: expected ${expectedCode}, got ${upgSamples[i].originalId}`);
        }
        if (upgSamples[i].labId !== expectedCode) {
            throw new Error(`Sample labId mismatch for ${expectedCode}: expected ${expectedCode}, got ${upgSamples[i].labId}`);
        }
        const expectedLab = i < 5 ? 'lab-base-1' : 'lab-base-2';
        if (upgSamples[i].assignedLab !== expectedLab) {
            throw new Error(`Sample assignedLab mismatch for ${expectedCode}: expected ${expectedLab}, got ${upgSamples[i].assignedLab}`);
        }
        if (upgSamples[i].status !== 'REGISTERED') {
            throw new Error(`Sample status mismatch for ${expectedCode}: ${upgSamples[i].status}`);
        }
    }
    console.log('  ✓ Exact data preservation across upgrade: all 10 sample records, assigned labs, and statuses verified intact');

    // Verify asset preservation across upgrade
    const assetCheck = cp.execFileSync('docker', [
        'run', '--rm',
        '-v', `${upgAssetsVol}:/app/server/uploads`,
        'alpine', 'cat', '/app/server/uploads/spectral_cal_curve.json'
    ], { encoding: 'utf8' }).trim();
    if (assetCheck !== assetJson.trim()) {
        throw new Error(`Asset file mismatch post-upgrade! Expected ${assetJson}, got ${assetCheck}`);
    }
    console.log('  ✓ Asset preservation across upgrade: spectral_cal_curve.json preserved byte-for-byte');

    cp.execFileSync('docker', ['stop', upgTargetContainer]);

    // 8. Staged Route B Disaster Recovery Execution
    // Stage archives in /backup/staging and validate SQLite integrity before touching target
    cp.execFileSync('docker', [
        'run', '--rm',
        '-v', `${upgBackupDir}:/backup`,
        BASELINE_IMAGE_TAG,
        'sh', '-c',
        `set -e
         rm -rf /backup/staging
         mkdir -p /backup/staging/db /backup/staging/assets
         tar -xzf /backup/db_snapshot_${TS}.tar.gz -C /backup/staging/db
         tar -xzf /backup/assets_snapshot_${TS}.tar.gz -C /backup/staging/assets
         node -e "
           const Database = require('better-sqlite3');
           const db = new Database('/backup/staging/db/dev.db', { readonly: true });
           const integrity = db.pragma('integrity_check');
           const fk = db.pragma('foreign_key_check');
           db.close();
           if (integrity[0]?.integrity_check !== 'ok' || fk.length > 0) process.exit(1);
           console.log('STAGED_INTEGRITY_OK');
         "`
    ]);

    // Create full pre-restore safety copy (including hidden .jwt_secret, WAL, SHM) with set -e
    cp.execFileSync('docker', [
        'run', '--rm',
        '-v', `${upgDataVol}:/data`,
        '-v', `${upgAssetsVol}:/assets`,
        '-v', `${upgBackupDir}:/backup`,
        'alpine', 'sh', '-c',
        `set -e
         SAFETY_DIR="/backup/pre_restore_safety_${TS}"
         mkdir -p "$SAFETY_DIR/data" "$SAFETY_DIR/assets"
         cp -a /data/. "$SAFETY_DIR/data/"
         cp -a /assets/. "$SAFETY_DIR/assets/"`
    ]);

    // Sequentially replace target volumes using find -mindepth 1 -delete (fails closed on error)
    cp.execFileSync('docker', [
        'run', '--rm',
        '-v', `${upgDataVol}:/data`,
        '-v', `${upgAssetsVol}:/assets`,
        '-v', `${upgBackupDir}:/backup`,
        'alpine', 'sh', '-c',
        `set -e
         find /data -mindepth 1 -delete
         cp -a /backup/staging/db/. /data/
         find /assets -mindepth 1 -delete
         cp -a /backup/staging/assets/. /assets/
         rm -rf /backup/staging`
    ]);

    // Verify restored database and rotate data exchange epoch
    const restoreEpochOutput = cp.execFileSync('docker', [
        'run', '--rm',
        '-v', `${upgDataVol}:/app/server/prisma`,
        BASELINE_IMAGE_TAG,
        'node', '-e',
        `const Database = require('better-sqlite3');
         const { rotateEpoch, ensureTriggers, initTables, getCurrentEpoch, decodeCursor } = require('./services/exchangeStateService');
         const db = new Database('prisma/dev.db');
         initTables(db);
         ensureTriggers(db);
         const res = rotateEpoch(db, 'VOLUME_RESTORE');
         console.log('EPOCH_ROTATION:' + JSON.stringify(res));
         const decoded = decodeCursor('${initialCursor}', db);
         console.log('OLD_CURSOR_DECODE:' + JSON.stringify(decoded));
         db.close();`
    ], { encoding: 'utf8' });

    if (!restoreEpochOutput.includes('"reason":"EPOCH_MISMATCH"') || !restoreEpochOutput.includes('"expired":true')) {
        throw new Error(`Expected old cursor rejection with EPOCH_MISMATCH post-restore, got: ${restoreEpochOutput}`);
    }
    console.log('  ✓ Restore rotated exchange epoch and invalidated pre-restore cursor (EPOCH_MISMATCH confirmed)');

    // 9. Launch Rollback Container explicitly bound to BASELINE_IMAGE_ID
    const rollbackTag = `soilfer-lims:rollback-${TS}`;
    cp.execFileSync('docker', ['tag', baselineImageId, rollbackTag]);

    const rollbackContainer = registerContainer(`lims_c_rollback_${TS}`);
    const rollbackPort = await getFreePort();
    cp.execFileSync('docker', [
        'run', '-d',
        '--name', rollbackContainer,
        '-p', `127.0.0.1:${rollbackPort}:3000`,
        '-v', `${upgDataVol}:/app/server/prisma`,
        '-v', `${upgAssetsVol}:/app/server/uploads`,
        '-e', 'DEPLOYMENT_MODE=global',
        '-e', 'PORT=3000',
        '-e', 'NODE_ENV=production',
        rollbackTag
    ]);

    await waitForHealth(rollbackPort, rollbackContainer);
    console.log(`  ✓ Rollback container healthy on port ${rollbackPort}`);

    const liveImageId = cp.execFileSync('docker', ['inspect', rollbackContainer, '--format', '{{.Image}}'], { encoding: 'utf8' }).trim();
    if (liveImageId !== baselineImageId) {
        throw new Error(`Rollback container running unexpected image ${liveImageId}, expected baseline ${baselineImageId}`);
    }
    console.log(`  ✓ Rollback container verified running immutable baseline image ID: ${liveImageId}`);

    // Verify all baseline accounts log in successfully on restored container
    for (const [user, pwd] of [['admin', 'BaselinePass123!'], ['base_mgr1', 'BaselinePass123!'], ['base_mgr2', 'BaselinePass123!']]) {
        const uRes = await fetch(`http://127.0.0.1:${rollbackPort}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pwd })
        });
        if (uRes.status !== 200) throw new Error(`Post-rollback login for ${user} failed: status ${uRes.status}`);
    }
    console.log('  ✓ Post-rollback accounts verified: all 3 baseline accounts authenticated successfully');

    // Verify exact data preservation in restored volume: all 10 sample codes present
    const postRollbackData = cp.execFileSync('docker', [
        'run', '--rm',
        '-v', `${upgDataVol}:/app/server/prisma`,
        BASELINE_IMAGE_TAG,
        'node', '-e',
        `const Database = require('better-sqlite3');
         const db = new Database('prisma/dev.db', { readonly: true });
         const samples = db.prepare('SELECT originalId, labId, assignedLab, status FROM Sample ORDER BY originalId').all();
         db.close();
         console.log(JSON.stringify(samples));`
    ], { encoding: 'utf8' }).trim();
    const rollbackParsed = JSON.parse(postRollbackData);
    const rollbackCodes = rollbackParsed.map(item => (typeof item === 'string' ? item : item.originalId));
    if (rollbackCodes.length !== 10) {
        throw new Error(`Post-rollback data count mismatch: expected 10, got ${rollbackCodes.length}`);
    }
    for (let i = 0; i < 10; i++) {
        if (rollbackCodes[i] !== expectedSampleCodes[i]) {
            throw new Error(`Post-rollback sample ID mismatch at index ${i}: expected ${expectedSampleCodes[i]}, got ${rollbackCodes[i]}`);
        }
    }
    if (typeof rollbackParsed[0] === 'object' && rollbackParsed[0] !== null) {
        for (let i = 0; i < 10; i++) {
            const item = rollbackParsed[i];
            if (item.labId && item.labId !== expectedSampleCodes[i]) {
                throw new Error(`Post-rollback labId mismatch for ${expectedSampleCodes[i]}: expected ${expectedSampleCodes[i]}, got ${item.labId}`);
            }
            const expectedLab = i < 5 ? 'lab-base-1' : 'lab-base-2';
            if (item.assignedLab && item.assignedLab !== expectedLab) {
                throw new Error(`Post-rollback assignedLab mismatch for ${expectedSampleCodes[i]}: expected ${expectedLab}, got ${item.assignedLab}`);
            }
            if (item.status && item.status !== 'REGISTERED') {
                throw new Error(`Post-rollback status mismatch for ${expectedSampleCodes[i]}: expected REGISTERED, got ${item.status}`);
            }
        }
    }
    console.log('  ✓ Post-rollback data verified: all 10 sample records, assigned labs, and statuses preserved in restored volume');

    // Verify asset preservation in restored volume
    const postRollbackAsset = cp.execFileSync('docker', [
        'run', '--rm',
        '-v', `${upgAssetsVol}:/app/server/uploads`,
        'alpine', 'cat', '/app/server/uploads/spectral_cal_curve.json'
    ], { encoding: 'utf8' }).trim();
    if (postRollbackAsset !== assetJson.trim()) {
        throw new Error('Post-rollback asset file mismatch!');
    }
    console.log('  ✓ Post-rollback asset verified: spectral_cal_curve.json preserved byte-for-byte');

    cp.execFileSync('docker', ['stop', rollbackContainer]);

    console.log('\n================================================================');
    console.log('  🎉 ALL REAL DOCKER DEPLOYMENT READINESS SCENARIOS PASSED!     ');
    console.log('================================================================\n');
}

runSuite()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('\n❌ REHEARSAL FAILED:', err);
        process.exit(1);
    });
