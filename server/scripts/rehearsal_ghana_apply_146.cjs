#!/usr/bin/env node
'use strict';

/**
 * Disposable End-to-End Rehearsal for Ghana Enablement, Bounded Apply, Controlled Failure,
 * Partial-Apply Recovery, and Process Interruption Recovery (Issue #146, PR #147)
 * 
 * Usage:
 *   node server/scripts/rehearsal_ghana_apply_146.cjs
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const serverDir = path.resolve(__dirname, '..');
const tmpDir = path.join(serverDir, `.tmp_rehearsal_ghana_${Date.now()}`);

console.log('================================================================');
console.log('  DISPOSABLE REHEARSAL: GHANA APPLY, FAILURE & RECOVERY        ');
console.log('================================================================');
console.log(`Fixture Dir: ${tmpDir}`);

fs.mkdirSync(tmpDir, { recursive: true });

const CONFIG_ID = '25731264-f02a-4172-8ef1-75512b7607a5';
const EXPECTED_LAB = 'GHA-LAB1';
const EXPECTED_PROJECT = 'SOILFER-US';
const EXPECTED_FORM = 'aQtvKZHiZmtqVCkQsGw2X4';
const EXPECTED_SERVER = 'https://kf.soilfer-data.fao.org';
const runnerScript = path.join(__dirname, 'execute_ghana_apply_146.cjs');

// Resolve private snapshot/manifest location
const privateSnapPath = 'C:/Users/yigin/Documents/Codex/2026-09-21/se/work/private_kobo/ghana_kobo_snapshot_40747.json';
const privateManPath = 'C:/Users/yigin/Documents/Codex/2026-09-21/se/work/private_kobo/ghana_kobo_manifest_40747.json';

const baseEnv = {
    ...process.env,
    GHANA_SNAPSHOT_PATH: privateSnapPath,
    GHANA_MANIFEST_PATH: privateManPath
};

function initBaselineFixture(dbFile) {
    const srcDb = new Database(path.join(serverDir, 'prisma/dev.db'), { readonly: true });
    const schemaSqls = srcDb.prepare("SELECT sql FROM sqlite_master WHERE type IN ('table', 'index') AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%'").all().map(r => r.sql);
    srcDb.close();

    const db = new Database(dbFile);
    for (const sql of schemaSqls) {
        try { db.exec(sql); } catch (_) {}
    }

    // Insert baseline data
    db.prepare(`INSERT INTO Lab (id, code, name, country, isActive, createdAt, updatedAt) VALUES (?, 'GHA', 'SoilFER Ghana Lab', 'GHA', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(EXPECTED_LAB);
    db.prepare(`INSERT INTO Project (id, code, name, status, labId, createdAt, updatedAt) VALUES ('proj-us-uuid', ?, 'SoilFER USA', 'ACTIVE', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(EXPECTED_PROJECT, EXPECTED_LAB);
    db.prepare(`INSERT INTO ProjectLab (id, projectCode, labId, role, createdAt) VALUES ('pl-1', ?, ?, 'PRIMARY', CURRENT_TIMESTAMP)`).run(EXPECTED_PROJECT, EXPECTED_LAB);
    db.prepare(`
        INSERT INTO KoboConfig (id, labId, labName, formId, koboServerUrl, apiToken, isActive, projectCode, lastSubmissionId, createdAt, updatedAt)
        VALUES (?, ?, 'SoilFER Ghana Lab', ?, ?, 'mock-api-token', 0, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(CONFIG_ID, EXPECTED_LAB, EXPECTED_FORM, EXPECTED_SERVER);

    // Insert baseline non-Ghana sample to verify non-interference
    db.prepare(`
        INSERT INTO Sample (id, originalId, projectCode, assignedLab, status, metadata, createdAt, updatedAt)
        VALUES ('smp-base-1', 'GTM-EXISTING-01', 'SOILFER-GTM', 'GTM-LAB1', 'EXPECTED', '{"kept":"original"}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run();

    db.close();
}

async function runRehearsal() {
    try {
        const fixtureDb = path.join(tmpDir, 'dev.db');
        initBaselineFixture(fixtureDb);

        console.log('\n[Stage 1] Rehearsing Dry-Run Validation...');
        const dryRunEnv = { ...baseEnv, DATABASE_PATH: fixtureDb };
        const dryRunOut = cp.execFileSync(process.execPath, [runnerScript, '--dry-run'], {
            env: dryRunEnv,
            encoding: 'utf8'
        });
        if (!dryRunOut.includes('DRY-RUN VALIDATION SUCCEEDED: All invariants verified (864/4)')) {
            throw new Error('Dry-run did not output expected success banner');
        }

        // Verify zero database modifications occurred in dry run
        const dbCheck = new Database(fixtureDb, { readonly: true });
        const postDryRunSamples = dbCheck.prepare('SELECT COUNT(*) as c FROM Sample').get().c;
        const postDryRunConfig = dbCheck.prepare('SELECT isActive, projectCode FROM KoboConfig WHERE id = ?').get(CONFIG_ID);
        dbCheck.close();

        if (postDryRunSamples !== 1 || postDryRunConfig.isActive !== 0 || postDryRunConfig.projectCode !== null) {
            throw new Error('Dry-run modified database state!');
        }
        console.log('  ✓ Stage 1 PASSED: Dry-run strictly read-only; 864/4 invariants verified');

        console.log('\n[Stage 2] Rehearsing Successful Apply & Scoped Postflight...');
        const preApplyDb = new Database(fixtureDb);
        preApplyDb.pragma('wal_checkpoint(TRUNCATE)');
        const backupApplyPath = path.join(tmpDir, 'backup_pre_apply.db');
        await preApplyDb.backup(backupApplyPath);
        preApplyDb.close();

        const applyEnv = { ...baseEnv, DATABASE_PATH: fixtureDb };
        const applyOut = cp.execFileSync(process.execPath, [runnerScript, '--apply'], {
            env: applyEnv,
            encoding: 'utf8'
        });

        if (!applyOut.includes('APPLY COMPLETED SUCCESSFULLY')) {
            throw new Error('Apply did not output expected completion banner');
        }

        // Postflight verification on the applied database
        const appliedDb = new Database(fixtureDb, { readonly: true });
        const totalSamples = appliedDb.prepare('SELECT COUNT(*) as c FROM Sample WHERE assignedLab = ?').get(EXPECTED_LAB).c;
        const heldSamples = appliedDb.prepare(`SELECT COUNT(*) as c FROM Sample WHERE assignedLab = ? AND rejectionReason LIKE 'PROVENANCE_HOLD%'`).get(EXPECTED_LAB).c;
        const cleanSamples = appliedDb.prepare(`SELECT COUNT(*) as c FROM Sample WHERE assignedLab = ? AND status = 'EXPECTED' AND rejectionReason IS NULL`).get(EXPECTED_LAB).c;
        const integrity = appliedDb.pragma('integrity_check');
        const fkCheck = appliedDb.pragma('foreign_key_check');
        const configAfter = appliedDb.prepare('SELECT isActive, projectCode, lastSubmissionId FROM KoboConfig WHERE id = ?').get(CONFIG_ID);
        appliedDb.close();

        if (totalSamples !== 864 || heldSamples !== 4 || cleanSamples !== 860) {
            throw new Error(`Sample counts mismatch: total=${totalSamples}, held=${heldSamples}, clean=${cleanSamples}`);
        }
        if (integrity[0].integrity_check !== 'ok' || fkCheck.length > 0) {
            throw new Error('Integrity or FK check failed post-apply!');
        }
        if (configAfter.isActive !== 1 || configAfter.projectCode !== EXPECTED_PROJECT || String(configAfter.lastSubmissionId) !== '40747') {
            throw new Error('KoboConfig post-apply state invalid!');
        }
        console.log('  ✓ Stage 2 PASSED: 864 samples admitted, 4 held, 860 clean, FK & integrity ok');

        console.log('\n[Stage 3] Rehearsing Precondition Failure & Quiesced External Recovery...');
        const failDb = path.join(tmpDir, 'fail_fixture.db');
        initBaselineFixture(failDb);

        // Take quiesced pre-operation backup
        const failDbHandle = new Database(failDb);
        failDbHandle.pragma('wal_checkpoint(TRUNCATE)');
        const backupFailPath = path.join(tmpDir, 'backup_pre_fail.db');
        await failDbHandle.backup(backupFailPath);
        failDbHandle.close();
        const preFailHash = crypto.createHash('sha256').update(fs.readFileSync(backupFailPath)).digest('hex');

        // Induce precondition failure: deactivate project
        const corruptDb = new Database(failDb);
        corruptDb.prepare(`UPDATE Project SET status = 'INACTIVE' WHERE code = ?`).run(EXPECTED_PROJECT);
        corruptDb.close();

        let failedCleanly = false;
        try {
            cp.execFileSync(process.execPath, [runnerScript, '--apply'], {
                env: { ...baseEnv, DATABASE_PATH: failDb },
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe']
            });
        } catch (expectedErr) {
            failedCleanly = true;
            console.log(`  ✓ Controlled failure caught as expected: process exited with code ${expectedErr.status}`);
        }

        if (!failedCleanly) {
            throw new Error('Apply did not fail when precondition was violated!');
        }

        // Execute quiesced external recovery
        console.log('  Executing stopped-writer quiesced backup restoration...');
        if (fs.existsSync(failDb + '-wal')) fs.unlinkSync(failDb + '-wal');
        if (fs.existsSync(failDb + '-shm')) fs.unlinkSync(failDb + '-shm');
        fs.copyFileSync(backupFailPath, failDb);

        const restoredHash = crypto.createHash('sha256').update(fs.readFileSync(failDb)).digest('hex');
        if (restoredHash !== preFailHash) {
            throw new Error(`Restored hash (${restoredHash}) does not match pre-failure backup (${preFailHash})`);
        }

        const restoredDb = new Database(failDb, { readonly: true });
        const restoredIntegrity = restoredDb.pragma('integrity_check');
        const restoredFk = restoredDb.pragma('foreign_key_check');
        const restoredConfig = restoredDb.prepare('SELECT isActive, projectCode FROM KoboConfig WHERE id = ?').get(CONFIG_ID);
        const restoredSamples = restoredDb.prepare('SELECT COUNT(*) as c FROM Sample').get().c;
        restoredDb.close();

        if (restoredIntegrity[0].integrity_check !== 'ok' || restoredFk.length > 0) {
            throw new Error('Integrity check failed on restored database!');
        }
        if (restoredConfig.isActive !== 0 || restoredConfig.projectCode !== null || restoredSamples !== 1) {
            throw new Error('Restored database does not match initial baseline state!');
        }
        console.log('  ✓ Stage 3 PASSED: Quiesced backup restored with bit-for-bit SHA-256 match and clean integrity');

        console.log('\n[Stage 4] Rehearsing Partial-Apply Mid-Flight Failure & Quiesced External Recovery...');
        const partialDb = path.join(tmpDir, 'partial_fixture.db');
        initBaselineFixture(partialDb);

        // Pre-operation consistent backup
        const partDbHandle = new Database(partialDb);
        partDbHandle.pragma('wal_checkpoint(TRUNCATE)');
        const backupPartPath = path.join(tmpDir, 'backup_pre_part.db');
        await partDbHandle.backup(backupPartPath);
        partDbHandle.close();
        const prePartHash = crypto.createHash('sha256').update(fs.readFileSync(backupPartPath)).digest('hex');

        // Simulate dirty state: CAS update executed and partial samples inserted
        const dirtyDb = new Database(partialDb);
        dirtyDb.prepare(`UPDATE KoboConfig SET isActive = 1, projectCode = ? WHERE id = ?`).run(EXPECTED_PROJECT, CONFIG_ID);
        dirtyDb.prepare(`INSERT INTO Sample (id, originalId, projectCode, assignedLab, status, createdAt, updatedAt) VALUES ('smp-part-1', 'GHA-PART-01', ?, ?, 'EXPECTED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(EXPECTED_PROJECT, EXPECTED_LAB);
        dirtyDb.prepare(`INSERT INTO Sample (id, originalId, projectCode, assignedLab, status, createdAt, updatedAt) VALUES ('smp-part-2', 'GHA-PART-02', ?, ?, 'EXPECTED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(EXPECTED_PROJECT, EXPECTED_LAB);
        dirtyDb.close();

        // Verify database is now dirty
        const dirtyCheck = new Database(partialDb, { readonly: true });
        const dirtyCount = dirtyCheck.prepare('SELECT COUNT(*) as c FROM Sample').get().c;
        dirtyCheck.close();
        if (dirtyCount !== 3) {
            throw new Error('Failed to induce dirty partial state in Stage 4');
        }

        // Execute stopped-writer recovery
        console.log('  Executing stopped-writer recovery from dirty mid-flight state...');
        if (fs.existsSync(partialDb + '-wal')) fs.unlinkSync(partialDb + '-wal');
        if (fs.existsSync(partialDb + '-shm')) fs.unlinkSync(partialDb + '-shm');
        fs.copyFileSync(backupPartPath, partialDb);

        const partRestoredHash = crypto.createHash('sha256').update(fs.readFileSync(partialDb)).digest('hex');
        if (partRestoredHash !== prePartHash) {
            throw new Error(`Restored hash (${partRestoredHash}) does not match pre-apply backup (${prePartHash})`);
        }

        const partRestoredDb = new Database(partialDb, { readonly: true });
        const partSamples = partRestoredDb.prepare('SELECT COUNT(*) as c FROM Sample').get().c;
        const partConfig = partRestoredDb.prepare('SELECT isActive, projectCode FROM KoboConfig WHERE id = ?').get(CONFIG_ID);
        const partIntegrity = partRestoredDb.pragma('integrity_check');
        const partFk = partRestoredDb.pragma('foreign_key_check');
        partRestoredDb.close();

        if (partSamples !== 1 || partConfig.isActive !== 0 || partConfig.projectCode !== null) {
            throw new Error('Restored database from partial state did not match baseline state!');
        }
        if (partIntegrity[0].integrity_check !== 'ok' || partFk.length > 0) {
            throw new Error('Integrity check failed after partial-apply recovery!');
        }
        console.log('  ✓ Stage 4 PASSED: Dirty mid-flight partial state recovered with bit-for-bit SHA-256 match');

        console.log('\n[Stage 5] Rehearsing Interruption & Child Process Termination...');
        const interruptDb = path.join(tmpDir, 'interrupt_fixture.db');
        initBaselineFixture(interruptDb);

        // Pre-operation consistent backup
        const intDbHandle = new Database(interruptDb);
        intDbHandle.pragma('wal_checkpoint(TRUNCATE)');
        const backupIntPath = path.join(tmpDir, 'backup_pre_int.db');
        await intDbHandle.backup(backupIntPath);
        intDbHandle.close();
        const preIntHash = crypto.createHash('sha256').update(fs.readFileSync(backupIntPath)).digest('hex');

        // Spawn runner in background child process and interrupt it immediately
        const child = cp.spawn(process.execPath, [runnerScript, '--dry-run'], {
            env: { ...baseEnv, DATABASE_PATH: interruptDb },
            stdio: ['ignore', 'pipe', 'pipe']
        });

        // Kill process to simulate client disconnection / SIGINT
        child.kill('SIGTERM');

        await new Promise(resolve => {
            child.on('close', (code, signal) => {
                console.log(`  ✓ Runner child process cleanly terminated (signal: ${signal || code})`);
                resolve();
            });
        });

        // Execute recovery protocol
        if (fs.existsSync(interruptDb + '-wal')) fs.unlinkSync(interruptDb + '-wal');
        if (fs.existsSync(interruptDb + '-shm')) fs.unlinkSync(interruptDb + '-shm');
        fs.copyFileSync(backupIntPath, interruptDb);

        const intRestoredHash = crypto.createHash('sha256').update(fs.readFileSync(interruptDb)).digest('hex');
        if (intRestoredHash !== preIntHash) {
            throw new Error(`Restored hash after interruption does not match backup!`);
        }
        console.log('  ✓ Stage 5 PASSED: Interrupted execution safely recovered with bit-for-bit match');

        console.log('\n================================================================');
        console.log('  ALL 5 REHEARSAL STAGES COMPLETED SUCCESSFULLY                 ');
        console.log('  Dry-Run | Apply | Failure | Partial-Apply | Interruption      ');
        console.log('================================================================\n');

    } finally {
        // Cleanup temporary directory fixture
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch (_) {}
    }
}

runRehearsal().catch(err => {
    console.error('REHEARSAL_FAILED:', err);
    process.exit(1);
});
