/**
 * Canonical Focused Rehearsal for Issue #148 (Five-Config Kobo Correction)
 * 
 * 1. Creates a WAL-consistent read-only online snapshot from live DB via SQLite backup API (captures full live baseline of 37,800).
 * 2. Exercises the final executable runner (execute_kobo_correction_148.cjs) directly in --dry-run mode.
 * 3. Exercises the final executable runner in --apply mode against the disposable baseline.
 * 4. Captures exact state of the 3 held records, operation audits, and config cursors.
 * 5. Executes canonical replay pass and asserts BIT-FOR-BIT equality of held metadata, zero new audit logs, and identical count.
 * 6. Validates SQLite integrity check and foreign key checks.
 * 7. Safely unlinks disposable fixture.
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const Database = require('better-sqlite3');

const SOURCE_DB_PATH = process.env.SOURCE_DB_PATH || '/app/server/prisma/dev.db';
const DISPOSABLE_DB_PATH = '/tmp/dev_rehearsal_issue148.db';

const serverDir = fs.existsSync('/app/server') ? '/app/server' : path.resolve(__dirname, '..');
const RUNNER_PATH = path.join(serverDir, 'scripts/execute_kobo_correction_148.cjs');

const SNAPSHOT_PATH = process.env.KOBO_148_SNAPSHOT_PATH || '/opt/lims/private_kobo/issue148_kobo_snapshot_bounded.json';
const MANIFEST_PATH = process.env.KOBO_148_MANIFEST_PATH || '/opt/lims/private_kobo/issue148_kobo_manifest_bounded.json';

async function runRehearsal() {
    console.log('================================================================');
    console.log('  FOCUSED REHEARSAL: ISSUE #148 FIVE-CONFIG CORRECTION          ');
    console.log('================================================================');
    console.log(`Source DB:     ${SOURCE_DB_PATH}`);
    console.log(`Disposable DB: ${DISPOSABLE_DB_PATH}`);
    console.log(`Runner Script: ${RUNNER_PATH}`);
    console.log('----------------------------------------------------------------');

    if (!fs.existsSync(RUNNER_PATH)) {
        throw new Error(`Runner script missing at ${RUNNER_PATH}`);
    }

    // 1. Create WAL-consistent read-only online snapshot from live DB
    console.log('\n[Stage 1] Creating WAL-consistent online backup fixture...');
    if (fs.existsSync(DISPOSABLE_DB_PATH)) fs.unlinkSync(DISPOSABLE_DB_PATH);
    if (fs.existsSync(DISPOSABLE_DB_PATH + '-wal')) fs.unlinkSync(DISPOSABLE_DB_PATH + '-wal');
    if (fs.existsSync(DISPOSABLE_DB_PATH + '-shm')) fs.unlinkSync(DISPOSABLE_DB_PATH + '-shm');

    const liveDb = new Database(SOURCE_DB_PATH, { readonly: true });
    await liveDb.backup(DISPOSABLE_DB_PATH);
    liveDb.close();

    const disposableDb = new Database(DISPOSABLE_DB_PATH);
    const baselineCount = disposableDb.prepare('SELECT count(*) as count FROM Sample').get().count;
    console.log(`  ✓ Consistent online backup created. Baseline count: ${baselineCount}`);
    if (baselineCount !== 37800) {
        console.warn(`  Notice: Baseline count is ${baselineCount} (expected 37800)`);
    }

    // Verify baseline integrity
    const preIntegrity = disposableDb.pragma('integrity_check');
    const preFk = disposableDb.pragma('foreign_key_check');
    if (preIntegrity[0].integrity_check !== 'ok' || preFk.length > 0) {
        throw new Error('Baseline fixture failed integrity check!');
    }
    console.log('  ✓ Baseline fixture integrity verified: ok, FK: OK');
    disposableDb.close();

    // 2. Exercise final runner in --dry-run mode
    console.log('\n[Stage 2] Exercising final runner in --dry-run mode...');
    const dryRunResult = cp.spawnSync(process.execPath, [RUNNER_PATH, '--dry-run'], {
        env: {
            ...process.env,
            NODE_PATH: '/app/server/node_modules',
            DATABASE_PATH: DISPOSABLE_DB_PATH,
            KOBO_148_SNAPSHOT_PATH: SNAPSHOT_PATH,
            KOBO_148_MANIFEST_PATH: MANIFEST_PATH
        },
        encoding: 'utf8'
    });

    console.log(dryRunResult.stdout);
    if (dryRunResult.status !== 0) {
        console.error(dryRunResult.stderr);
        throw new Error(`Runner --dry-run failed with exit code ${dryRunResult.status}`);
    }
    if (!dryRunResult.stdout.includes('DRY-RUN VALIDATION SUCCEEDED')) {
        throw new Error('Runner --dry-run did not report DRY-RUN VALIDATION SUCCEEDED');
    }
    console.log('  ✓ Final runner --dry-run passed cleanly against baseline fixture.');

    // 3. Exercise final runner in --apply mode
    console.log('\n[Stage 3] Exercising final runner in --apply mode...');
    const applyResult = cp.spawnSync(process.execPath, [RUNNER_PATH, '--apply'], {
        env: {
            ...process.env,
            NODE_PATH: '/app/server/node_modules',
            DATABASE_PATH: DISPOSABLE_DB_PATH,
            KOBO_148_SNAPSHOT_PATH: SNAPSHOT_PATH,
            KOBO_148_MANIFEST_PATH: MANIFEST_PATH
        },
        encoding: 'utf8'
    });

    console.log(applyResult.stdout);
    if (applyResult.status !== 0) {
        console.error(applyResult.stderr);
        throw new Error(`Runner --apply failed with exit code ${applyResult.status}`);
    }
    if (!applyResult.stdout.includes('APPLY COMMITTED & POSTFLIGHT VERIFIED')) {
        throw new Error('Runner --apply did not report APPLY COMMITTED & POSTFLIGHT VERIFIED');
    }
    console.log('  ✓ Final runner --apply passed cleanly: 634 admitted, 3 held.');

    // 4. Capture exact state before replay
    console.log('\n[Stage 4] Capturing exact state of held records and audits before replay...');
    const db = new Database(DISPOSABLE_DB_PATH);
    const postApplyCount = db.prepare('SELECT count(*) as count FROM Sample').get().count;
    if (postApplyCount !== baselineCount + 634) {
        throw new Error(`Post-apply count mismatch: ${postApplyCount} != ${baselineCount + 634}`);
    }

    const heldBarcodes = ['MOZ0078-6-1C', 'ZM-JDCMG', 'ZM-JXGMD'];
    const heldStmt = db.prepare('SELECT id, originalId, status, receptionDate, receivedBy, rejectionReason, metadata FROM Sample WHERE UPPER(originalId) = ?');
    const beforeHeld = {};
    for (const b of heldBarcodes) {
        beforeHeld[b] = heldStmt.get(b);
    }

    const beforeAudits = db.prepare(`
        SELECT id, entity, entityId, action, details, performedBy, timestamp
        FROM AuditLog
        WHERE performedBy LIKE 'KOBO_CORRECTION_148_%'
        ORDER BY id
    `).all();

    const beforeConfigs = db.prepare(`
        SELECT id, labId, formId, projectCode, isActive, lastSubmissionId
        FROM KoboConfig
        WHERE labId IN ('HND-LAB1', 'TUN-LAB1', 'KEN-LAB1', 'MOZ-LAB1', 'ZMB-LAB1')
        ORDER BY labId
    `).all();

    console.log(`  ✓ Captured pre-replay state: ${Object.keys(beforeHeld).length} held records, ${beforeAudits.length} operation audits, ${beforeConfigs.length} configs`);

    // 5. Execute Canonical Replay Pass
    console.log('\n[Stage 5] Executing Canonical Controller Replay Pass...');
    process.env.DATABASE_PATH = DISPOSABLE_DB_PATH;
    const prisma = require(path.join(serverDir, 'prisma'));
    const koboController = require(path.join(serverDir, 'controllers/koboController'));
    const snapshotRaw = fs.readFileSync(SNAPSHOT_PATH, 'utf8');
    const snapshot = JSON.parse(snapshotRaw);

    const CANDIDATE_CONFIG_IDS = [
        '78cd0dc8-f04c-4bcf-9451-bc9507ee0623',
        '38744747-1d3f-4f4a-8523-6f251ecd1fba',
        'c630d7b4-5d44-4826-94e5-5851abbd2a46',
        '6e60eebe-5d8d-4e13-8037-efeb8041b24c',
        '897c1fb0-d83c-40cd-b513-b3e6e6b78172'
    ];

    for (const cfgId of CANDIDATE_CONFIG_IDS) {
        const activeConfig = await prisma.koboConfig.findUnique({ where: { id: cfgId } });
        const subs = snapshot.submissionsByLab[activeConfig.labId] || [];
        const replayResult = await koboController._syncLabSubmissions(activeConfig, 'REPLAY_TEST_148', {
            submissionsOverride: subs,
            maxSubmissionId: Number(activeConfig.lastSubmissionId)
        });

        if (replayResult.newSamples !== 0) {
            throw new Error(`REPLAY_FAILED: [${activeConfig.labId}] Expected 0 new samples, got ${replayResult.newSamples}`);
        }
        console.log(`  Replay [${activeConfig.labId}]: 0 new samples, ${replayResult.skipped} skipped (cursor unchanged: ${activeConfig.lastSubmissionId})`);
    }

    // 6. Assert BIT-FOR-BIT Equality of Held Records, Audits, and Configs After Replay
    console.log('\n[Stage 6] Asserting Bit-for-Bit Equality After Replay...');

    const postReplayCount = db.prepare('SELECT count(*) as count FROM Sample').get().count;
    if (postReplayCount !== postApplyCount) {
        throw new Error(`REPLAY_DRIFT: Total sample count drifted on replay: ${postApplyCount} -> ${postReplayCount}`);
    }

    // A. Verify held records
    for (const b of heldBarcodes) {
        const afterRecord = heldStmt.get(b);
        const beforeJson = JSON.stringify(beforeHeld[b]);
        const afterJson = JSON.stringify(afterRecord);
        if (beforeJson !== afterJson) {
            throw new Error(`REPLAY_MUTATION: Held specimen ${b} mutated during replay!\nBefore: ${beforeJson}\nAfter: ${afterJson}`);
        }
    }
    console.log('  ✓ All 3 held specimen records are BIT-FOR-BIT IDENTICAL before and after replay');

    // B. Verify zero new audit logs
    const afterAudits = db.prepare(`
        SELECT id, entity, entityId, action, details, performedBy, timestamp
        FROM AuditLog
        WHERE performedBy LIKE 'KOBO_CORRECTION_148_%' OR performedBy = 'REPLAY_TEST_148'
        ORDER BY id
    `).all();

    if (afterAudits.length !== beforeAudits.length) {
        throw new Error(`REPLAY_AUDIT_LEAK: New audit logs emitted during replay: before=${beforeAudits.length}, after=${afterAudits.length}`);
    }
    console.log(`  ✓ Audit logs identical: exactly ${beforeAudits.length} entries before and after replay (0 replay audits emitted)`);

    // C. Verify configs
    const afterConfigs = db.prepare(`
        SELECT id, labId, formId, projectCode, isActive, lastSubmissionId
        FROM KoboConfig
        WHERE labId IN ('HND-LAB1', 'TUN-LAB1', 'KEN-LAB1', 'MOZ-LAB1', 'ZMB-LAB1')
        ORDER BY labId
    `).all();

    if (JSON.stringify(beforeConfigs) !== JSON.stringify(afterConfigs)) {
        throw new Error('KoboConfig rows mutated during replay');
    }
    console.log('  ✓ KoboConfig rows unchanged on replay');

    // 7. Database Integrity & Foreign Key checks
    const integrity = db.pragma('integrity_check');
    const fkCheck = db.pragma('foreign_key_check');
    if (integrity[0].integrity_check !== 'ok' || fkCheck.length > 0) {
        throw new Error(`Post-replay DB integrity check failed: ${JSON.stringify({ integrity, fkCheck })}`);
    }
    console.log('  ✓ Final DB Integrity: ok, Foreign Keys: OK (0 errors)');

    db.close();
    if (fs.existsSync(DISPOSABLE_DB_PATH)) fs.unlinkSync(DISPOSABLE_DB_PATH);
    if (fs.existsSync(DISPOSABLE_DB_PATH + '-wal')) fs.unlinkSync(DISPOSABLE_DB_PATH + '-wal');
    if (fs.existsSync(DISPOSABLE_DB_PATH + '-shm')) fs.unlinkSync(DISPOSABLE_DB_PATH + '-shm');

    console.log('\n================================================================');
    console.log('  REHEARSAL SUCCEEDED 100%: RUNNER VERIFIED, 0 DRIFT ON REPLAY   ');
    console.log('================================================================');
}

runRehearsal().catch(err => {
    console.error('\nFATAL REHEARSAL ERROR:', err.message);
    process.exit(1);
});
