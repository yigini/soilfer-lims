#!/usr/bin/env node
'use strict';

/**
 * Ghana Kobo Enablement & Bounded Ingestion Runner (Issue #146, PR #147)
 * 
 * Usage:
 *   node execute_ghana_apply_146.cjs --dry-run
 *   node execute_ghana_apply_146.cjs --apply
 */

const fs = require('fs');
const path = require('path');
const { createHash, randomUUID } = require('crypto');

let Database;
try {
    Database = require('better-sqlite3');
} catch (e) {
    Database = require(path.join(__dirname, 'server/node_modules/better-sqlite3'));
}

const CONFIG_ID = '25731264-f02a-4172-8ef1-75512b7607a5';
const EXPECTED_LAB = 'GHA-LAB1';
const EXPECTED_PROJECT = 'SOILFER-US';
const EXPECTED_FORM = 'aQtvKZHiZmtqVCkQsGw2X4';
const EXPECTED_SERVER = 'https://kf.soilfer-data.fao.org';
const PINNED_HIGH_WATER_ID = 40747;
const ACTOR = 'ANTIGRAVITY_DEPLOYER';

const isDryRun = process.argv.includes('--dry-run');
const isApply = process.argv.includes('--apply');

if (!isDryRun && !isApply) {
    console.error('ERROR: Must specify either --dry-run or --apply');
    console.error('Usage: node execute_ghana_apply_146.cjs [--dry-run | --apply]');
    process.exit(1);
}

// Resolve SQLite DB path
const dbPath = process.env.DATABASE_PATH || 
    (process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/^file:/, '') : null) ||
    (fs.existsSync(path.join(__dirname, 'prisma/dev.db')) ? path.join(__dirname, 'prisma/dev.db') : path.join(__dirname, 'server/prisma/dev.db'));

if (!fs.existsSync(dbPath)) {
    console.error(`ERROR: Database file not found at ${dbPath}`);
    process.exit(1);
}

// Base directory for server modules
const serverDir = fs.existsSync(path.join(__dirname, 'controllers')) ? __dirname : path.join(__dirname, 'server');

console.log('================================================================');
console.log('  GHANA KOBO ENABLEMENT & BOUNDED INGESTION (ISSUE #146)       ');
console.log('================================================================');
console.log(`Database:     ${dbPath}`);
console.log(`Mode:         ${isDryRun ? 'DRY-RUN (Read-Only Validation)' : 'APPLY (Atomic Guarded Execution)'}`);
console.log(`High-Water:   ${PINNED_HIGH_WATER_ID}`);
console.log(`Target Config: ${CONFIG_ID}`);
console.log(`Target Lab:   ${EXPECTED_LAB}`);
console.log(`Target Proj:  ${EXPECTED_PROJECT}`);
console.log('----------------------------------------------------------------');

const db = new Database(dbPath, { readonly: isDryRun });

function runPreflightChecks() {
    console.log('\n[1/5] Executing Precondition Assertions...');

    // 1. Verify KoboConfig
    const configRow = db.prepare(`
        SELECT id, labId, formId, koboServerUrl, isActive, projectCode, lastSubmissionId, apiToken
        FROM KoboConfig
        WHERE id = ?
    `).get(CONFIG_ID);

    if (!configRow) {
        throw new Error(`PRECONDITION_FAILED: Configuration '${CONFIG_ID}' not found in database.`);
    }
    if (configRow.labId !== EXPECTED_LAB) {
        throw new Error(`PRECONDITION_FAILED: Expected lab '${EXPECTED_LAB}', found '${configRow.labId}'.`);
    }
    if (configRow.formId !== EXPECTED_FORM) {
        throw new Error(`PRECONDITION_FAILED: Expected form '${EXPECTED_FORM}', found '${configRow.formId}'.`);
    }
    if (configRow.koboServerUrl !== EXPECTED_SERVER) {
        throw new Error(`PRECONDITION_FAILED: Expected server '${EXPECTED_SERVER}', found '${configRow.koboServerUrl}'.`);
    }
    if (Number(configRow.isActive) !== 0) {
        throw new Error(`PRECONDITION_FAILED: Expected isActive == 0 (disabled), found ${configRow.isActive}.`);
    }
    if (configRow.projectCode !== null) {
        throw new Error(`PRECONDITION_FAILED: Expected projectCode == null, found '${configRow.projectCode}'.`);
    }
    if (configRow.lastSubmissionId !== null) {
        throw new Error(`PRECONDITION_FAILED: Expected lastSubmissionId == null, found '${configRow.lastSubmissionId}'.`);
    }
    console.log('  ✓ KoboConfig preconditions verified (disabled, unmapped, un-synced)');

    // 2. Verify Lab
    const labRow = db.prepare('SELECT id, code, name, isActive FROM Lab WHERE id = ?').get(EXPECTED_LAB);
    if (!labRow || Number(labRow.isActive) !== 1) {
        throw new Error(`PRECONDITION_FAILED: Lab '${EXPECTED_LAB}' does not exist or is inactive.`);
    }
    console.log(`  ✓ Lab '${EXPECTED_LAB}' verified active (${labRow.name})`);

    // 3. Verify Project & ProjectLab
    const projRow = db.prepare('SELECT id, code, status FROM Project WHERE code = ?').get(EXPECTED_PROJECT);
    if (!projRow || projRow.status !== 'ACTIVE') {
        throw new Error(`PRECONDITION_FAILED: Project '${EXPECTED_PROJECT}' does not exist or is not ACTIVE.`);
    }
    const plRow = db.prepare('SELECT role FROM ProjectLab WHERE projectCode = ? AND labId = ?').get(EXPECTED_PROJECT, EXPECTED_LAB);
    if (!plRow || plRow.role !== 'PRIMARY') {
        throw new Error(`PRECONDITION_FAILED: ProjectLab linkage for '${EXPECTED_PROJECT}' and '${EXPECTED_LAB}' must be PRIMARY.`);
    }
    console.log(`  ✓ Project '${EXPECTED_PROJECT}' and PRIMARY ProjectLab verified`);

    // 4. Verify existing samples count for Ghana is 0
    const existingCount = db.prepare('SELECT COUNT(*) as count FROM Sample WHERE assignedLab = ? AND projectCode = ?').get(EXPECTED_LAB, EXPECTED_PROJECT).count;
    if (existingCount !== 0) {
        throw new Error(`PRECONDITION_FAILED: Expected 0 existing samples for '${EXPECTED_LAB}' / '${EXPECTED_PROJECT}', found ${existingCount}.`);
    }
    console.log('  ✓ Clean baseline: 0 existing samples for Ghana in target project');

    return configRow;
}

async function runDryRun(configRow) {
    runPreflightChecks();

    console.log('\n[2/5] Simulating Upstream Ingestion Boundary (Read-Only)...');
    const koboService = require(path.join(serverDir, 'services/koboService'));
    const submissions = await koboService.fetchSubmissions(
        configRow.koboServerUrl,
        configRow.formId,
        configRow.apiToken,
        null
    );

    const bounded = submissions.filter(s => Number(s._id) <= PINNED_HIGH_WATER_ID);
    console.log(`  Fetched total submissions:   ${submissions.length}`);
    console.log(`  Bounded to high-water 40747: ${bounded.length}`);

    if (bounded.length !== 459) {
        throw new Error(`INVARIANT_VIOLATION: Expected 459 bounded submissions up to ${PINNED_HIGH_WATER_ID}, got ${bounded.length}`);
    }

    let totalOccurrences = 0;
    const uniqueIds = new Set();
    const intraSubDups = [];

    for (const sub of bounded) {
        const samples = koboService.transformSubmission(sub);
        const seenInSub = new Set();
        for (const s of samples) {
            totalOccurrences++;
            const norm = s.original_id?.trim().toUpperCase();
            if (norm) {
                if (seenInSub.has(norm)) {
                    intraSubDups.push({ subId: sub._id, id: norm, depth: s.depth });
                } else {
                    seenInSub.add(norm);
                    uniqueIds.add(norm);
                }
            }
        }
    }

    console.log(`  Total sample occurrences:    ${totalOccurrences}`);
    console.log(`  Distinct normalized IDs:     ${uniqueIds.size}`);
    console.log(`  Intra-sub duplicate depths:  ${intraSubDups.length}`);

    if (totalOccurrences !== 868) {
        throw new Error(`INVARIANT_VIOLATION: Expected 868 total occurrences, got ${totalOccurrences}`);
    }
    if (uniqueIds.size !== 864) {
        throw new Error(`INVARIANT_VIOLATION: Expected 864 distinct IDs, got ${uniqueIds.size}`);
    }
    if (intraSubDups.length !== 2) {
        throw new Error(`INVARIANT_VIOLATION: Expected 2 intra-sub duplicates, got ${intraSubDups.length}`);
    }

    console.log('\n================================================================');
    console.log('  DRY-RUN VALIDATION SUCCEEDED: All invariants verified (864/4)  ');
    console.log('  Ready for guarded apply clearance. Zero database rows modified. ');
    console.log('================================================================');
}

async function runApply(configRow) {
    runPreflightChecks();

    console.log('\n[2/5] Creating Quiesced Pre-Operation Backup...');
    db.pragma('wal_checkpoint(TRUNCATE)');
    const backupDir = path.join(path.dirname(dbPath), 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `dev_pre_issue146_${timestamp}.db`);
    await db.backup(backupPath);

    const backupHash = createHash('sha256').update(fs.readFileSync(backupPath)).digest('hex');
    console.log(`  ✓ Quiesced backup created: ${backupPath}`);
    console.log(`  ✓ Pre-apply SHA-256:       ${backupHash}`);

    let applySucceeded = false;
    try {
        console.log('\n[3/5] Executing Compare-and-Set Configuration Activation...');
        const casTx = db.transaction(() => {
            const updateStmt = db.prepare(`
                UPDATE KoboConfig
                SET projectCode = ?,
                    isActive = 1,
                    updatedAt = CURRENT_TIMESTAMP
                WHERE id = ?
                  AND labId = ?
                  AND formId = ?
                  AND isActive = 0
                  AND projectCode IS NULL
                  AND lastSubmissionId IS NULL
            `);
            const info = updateStmt.run(EXPECTED_PROJECT, CONFIG_ID, EXPECTED_LAB, EXPECTED_FORM);
            if (info.changes !== 1) {
                throw new Error(`CAS_FAILED: Expected exactly 1 row updated, got ${info.changes}`);
            }

            const auditStmt = db.prepare(`
                INSERT INTO AuditLog (id, entity, entityId, action, details, performedBy, timestamp)
                VALUES (?, 'KOBO_CONFIG', ?, 'ENABLE_GHANA_KOBO_MAPPING', ?, ?, CURRENT_TIMESTAMP)
            `);
            auditStmt.run(
                randomUUID(),
                CONFIG_ID,
                `Enabled Ghana Kobo configuration for ${EXPECTED_LAB} mapped to project ${EXPECTED_PROJECT} (Issue #146, PR #147). Pinned high-water ${PINNED_HIGH_WATER_ID}.`,
                ACTOR
            );
        });

        casTx();
        console.log('  ✓ Atomic CAS succeeded: KoboConfig activated and bound to SOILFER-US');

        console.log('\n[4/5] Executing Single-Writer Bounded Ingestion...');
        const prisma = require(path.join(serverDir, 'prisma'));
        const koboController = require(path.join(serverDir, 'controllers/koboController'));

        const activeConfig = await prisma.koboConfig.findUnique({ where: { id: CONFIG_ID } });
        const syncResult = await koboController._syncLabSubmissions(activeConfig, ACTOR, {
            maxSubmissionId: PINNED_HIGH_WATER_ID
        });

        console.log('  Ingestion result:', JSON.stringify(syncResult));
        if (syncResult.newSamples !== 864) {
            throw new Error(`INGESTION_FAILED: Expected 864 new samples, got ${syncResult.newSamples}`);
        }
        if (syncResult.skipped !== 4) {
            throw new Error(`INGESTION_FAILED: Expected 4 skipped duplicate occurrences, got ${syncResult.skipped}`);
        }
        if (String(syncResult.lastSubmissionId) !== String(PINNED_HIGH_WATER_ID)) {
            throw new Error(`INGESTION_FAILED: Expected cursor ${PINNED_HIGH_WATER_ID}, got ${syncResult.lastSubmissionId}`);
        }
        console.log('  ✓ Single-writer bounded ingestion succeeded');

        console.log('\n[5/5] Executing Scoped Read-Only Postflight Assertions...');
        const totalAdmitted = db.prepare(`
            SELECT COUNT(*) as count FROM Sample 
            WHERE assignedLab = ? AND projectCode = ?
        `).get(EXPECTED_LAB, EXPECTED_PROJECT).count;

        const expectedStatus = db.prepare(`
            SELECT COUNT(*) as count FROM Sample 
            WHERE assignedLab = ? AND projectCode = ? AND status = 'EXPECTED' AND receptionDate IS NULL
        `).get(EXPECTED_LAB, EXPECTED_PROJECT).count;

        const heldSamples = db.prepare(`
            SELECT COUNT(*) as count FROM Sample 
            WHERE assignedLab = ? AND projectCode = ? AND rejectionReason LIKE 'PROVENANCE_HOLD%'
        `).get(EXPECTED_LAB, EXPECTED_PROJECT).count;

        const cleanExpected = db.prepare(`
            SELECT COUNT(*) as count FROM Sample 
            WHERE assignedLab = ? AND projectCode = ? AND status = 'EXPECTED' AND rejectionReason IS NULL
        `).get(EXPECTED_LAB, EXPECTED_PROJECT).count;

        const createAudits = db.prepare(`
            SELECT COUNT(*) as count FROM AuditLog 
            WHERE performedBy = ? AND action = 'CREATE_KOBO_SYNC'
        `).get(ACTOR).count;

        const intraAudits = db.prepare(`
            SELECT COUNT(*) as count FROM AuditLog 
            WHERE performedBy = ? AND action = 'KOBO_INTRA_SUBMISSION_DUPLICATE'
        `).get(ACTOR).count;

        const crossAudits = db.prepare(`
            SELECT COUNT(*) as count FROM AuditLog 
            WHERE performedBy = ? AND action = 'KOBO_CONFLICTING_PROVENANCE'
        `).get(ACTOR).count;

        console.log(`  Total Admitted Samples:      ${totalAdmitted} (Expected: 864)`);
        console.log(`  Samples in EXPECTED Status:  ${expectedStatus} (Expected: 864)`);
        console.log(`  Samples on Provenance Hold:  ${heldSamples} (Expected: 4)`);
        console.log(`  Clean Unambiguous Samples:   ${cleanExpected} (Expected: 860)`);
        console.log(`  CREATE_KOBO_SYNC Audits:     ${createAudits} (Expected: 864)`);
        console.log(`  INTRA_SUBMISSION Audits:     ${intraAudits} (Expected: 2)`);
        console.log(`  CONFLICTING_PROV Audits:     ${crossAudits} (Expected: 2)`);

        if (totalAdmitted !== 864 || expectedStatus !== 864 || heldSamples !== 4 || cleanExpected !== 860) {
            throw new Error('POSTFLIGHT_FAILED: Sample ledger invariants violated');
        }
        if (createAudits !== 864 || intraAudits !== 2 || crossAudits !== 2) {
            throw new Error('POSTFLIGHT_FAILED: AuditLog ledger invariants violated');
        }

        console.log('  ✓ All scoped read-only postflight assertions passed');
        applySucceeded = true;

        console.log('\n================================================================');
        console.log('  APPLY COMPLETED SUCCESSFULLY: 864 samples admitted to EXPECTED');
        console.log('  Durable provenance hold active on 4 ambiguous specimens.       ');
        console.log('================================================================');

    } catch (err) {
        console.error('\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        console.error('  APPLY FAILED: ' + err.message);
        console.error('  Initiating automatic restoration from pre-apply backup...     ');
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');

        db.close();
        fs.copyFileSync(backupPath, dbPath);
        const restoredHash = createHash('sha256').update(fs.readFileSync(dbPath)).digest('hex');
        if (restoredHash !== backupHash) {
            console.error(`FATAL: Restored DB hash ${restoredHash} does not match backup hash ${backupHash}`);
        } else {
            console.log(`✓ Restoration successful. Clean state verified (SHA-256: ${restoredHash})`);
        }
        process.exit(1);
    }
}

async function main() {
    try {
        const configRow = runPreflightChecks();
        if (isDryRun) {
            await runDryRun(configRow);
        } else if (isApply) {
            await runApply(configRow);
        }
    } catch (err) {
        console.error(`\nFAILED: ${err.message}`);
        process.exit(1);
    } finally {
        try { db.close(); } catch (_) {}
    }
}

main();
