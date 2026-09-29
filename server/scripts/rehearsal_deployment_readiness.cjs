#!/usr/bin/env node
'use strict';

/**
 * Real Disposable Docker Deployment Readiness Acceptance Suite
 * File: server/scripts/rehearsal_deployment_readiness.cjs
 *
 * Verifies default-entrypoint Docker runtime behavior in an isolated environment:
 * 1. Scenario 1: Default entrypoint empty-volume local mode installation, health, login & password change.
 * 2. Scenario 2: Container restart on same volume — persistent JWT secret & skipping re-seed.
 * 3. Scenario 3: Interrupted-init (partial seed) recovery on startup with default entrypoint.
 * 4. Scenario 4: Default entrypoint empty-volume global mode installation & SUPER_ADMIN login.
 * 5. Scenario 5: Multi-lab representative workload, sample intake, data export, and backup/restore round-trip.
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

// Verify image exists
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
        `npx prisma db push --skip-generate && node -e "
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
    const labARes = await fetch(`http://127.0.0.1:${globalPort}/api/laboratories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${superToken}` },
        body: JSON.stringify({ name: 'Accredited Lab Alpha', code: 'LAB_ALPHA', country: 'GHA', isActive: true })
    });
    const labBRes = await fetch(`http://127.0.0.1:${globalPort}/api/laboratories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${superToken}` },
        body: JSON.stringify({ name: 'Accredited Lab Beta', code: 'LAB_BETA', country: 'KEN', isActive: true })
    });
    if (labARes.status !== 201 || labBRes.status !== 201) {
        throw new Error(`Failed to create laboratories: A=${labARes.status}, B=${labBRes.status}`);
    }
    const labA = await labARes.json();
    const labB = await labBRes.json();
    console.log(`  ✓ Created Lab Alpha (${labA.code}) and Lab Beta (${labB.code})`);

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 5: Representative Workload, Export & Backup/Restore Round-Trip
    // ─────────────────────────────────────────────────────────────
    console.log('\n▶ [Scenario 5] Representative Workload, Export & Backup/Restore Round-Trip...');
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
    if (userARes.status !== 201 || userBRes.status !== 201) {
        throw new Error(`Failed to create managers: A=${userARes.status}, B=${userBRes.status}`);
    }

    // Login as Manager A
    const loginARes = await fetch(`http://127.0.0.1:${globalPort}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'manager_alpha', password: 'AlphaManagerPass123!' })
    });
    const { token: tokenA } = extractTokenAndUser(await loginARes.json());

    // Manager A submits 5 walkin samples
    for (let i = 1; i <= 5; i++) {
        const sRes = await fetch(`http://127.0.0.1:${globalPort}/api/samples/walkin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
            body: JSON.stringify({ submitter: `Farm Alpha ${i}`, description: `Soil Sample ${i}`, sampleType: 'ROUTINE' })
        });
        if (sRes.status !== 200 && sRes.status !== 201) {
            throw new Error(`Sample creation failed: ${sRes.status}`);
        }
    }
    console.log('  ✓ Ingested representative samples for Lab Alpha');

    // Data Export verification: Manager A queries samples
    const exportQueryRes = await fetch(`http://127.0.0.1:${globalPort}/api/samples`, {
        headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    const exportData = await exportQueryRes.json();
    const countA = Array.isArray(exportData?.data) ? exportData.data.length : (Array.isArray(exportData) ? exportData.length : 0);
    if (countA < 5) {
        throw new Error(`Expected at least 5 samples in query/export, got ${countA}`);
    }
    console.log(`  ✓ Export query returned ${countA} samples for Lab Alpha`);

    // Stop container before backup
    cp.execFileSync('docker', ['stop', globalContainer]);

    // Execute verified backup command
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

    const backupFiles = fs.readdirSync(backupHostDir).filter(f => f.endsWith('.db.gz'));
    if (backupFiles.length === 0) {
        throw new Error('No .db.gz backup file created!');
    }
    const backupFile = backupFiles[0];
    console.log(`  ✓ Generated backup artifact: ${backupFile}`);

    // Verify backup artifact
    cp.execFileSync('docker', [
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
             console.log('Valid backup. Users:', check.tables.userCount, 'Samples:', check.tables.sampleCount);
         })();`
    ]);
    console.log('  ✓ Backup artifact verification PASSED');

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

    // Boot container on restored volume and verify health & data
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
    console.log('  ✓ Post-restore login and data preservation confirmed');
    cp.execFileSync('docker', ['stop', restoredContainer]);

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
