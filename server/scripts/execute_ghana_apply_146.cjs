#!/usr/bin/env node
'use strict';

/**
 * Ghana Kobo Enablement & Bounded Ingestion Runner (Issue #146, PR #147)
 * 
 * Usage:
 *   node server/scripts/execute_ghana_apply_146.cjs --dry-run [--snapshot <path>] [--manifest <path>]
 *   node server/scripts/execute_ghana_apply_146.cjs --apply   [--snapshot <path>] [--manifest <path>]
 */

const fs = require('fs');
const path = require('path');
const { createHash, randomBytes, randomUUID } = require('crypto');

let Database;
try {
    Database = require('better-sqlite3');
} catch (e) {
    Database = require(path.join(__dirname, '../node_modules/better-sqlite3'));
}

const CONFIG_ID = '25731264-f02a-4172-8ef1-75512b7607a5';
const EXPECTED_LAB = 'GHA-LAB1';
const EXPECTED_PROJECT = 'SOILFER-US';
const EXPECTED_FORM = 'aQtvKZHiZmtqVCkQsGw2X4';
const EXPECTED_SERVER = 'https://kf.soilfer-data.fao.org';
const PINNED_HIGH_WATER_ID = 40747;
const EXPECTED_SNAPSHOT_SHA256 = '33db90cdcab60ccf4801a7754d8444893c0b6ee25f269a65366d6fed5046292f';
const EXPECTED_MANIFEST_SHA256 = 'e43d490366eda0e325b1f1639c743b57105a6256e0f406df6f7e1d87514adaed';

// Generate a unique operation-scoped identifier for this run
const OPERATION_ID = 'GHANA_APPLY_' + new Date().toISOString().replace(/[:.]/g, '') + '_' + randomBytes(4).toString('hex');

const isDryRun = process.argv.includes('--dry-run');
const isApply = process.argv.includes('--apply');

if (!isDryRun && !isApply) {
    console.error('ERROR: Must specify either --dry-run or --apply');
    console.error('Usage: node execute_ghana_apply_146.cjs [--dry-run | --apply] [--snapshot <path>] [--manifest <path>]');
    process.exit(1);
}

// Locate server directory and data directory
const serverDir = path.resolve(__dirname, '..');
const dataDir = path.join(serverDir, 'data');

function getArgValue(flag) {
    const idx = process.argv.indexOf(flag);
    if (idx !== -1 && idx + 1 < process.argv.length) {
        return process.argv[idx + 1];
    }
    return null;
}

// Resolve private snapshot and manifest paths
const snapshotCandidates = [
    getArgValue('--snapshot'),
    process.env.GHANA_SNAPSHOT_PATH,
    '/private/ghana_kobo_snapshot_40747.json',
    'C:/Users/yigin/Documents/Codex/2026-09-21/se/work/private_kobo/ghana_kobo_snapshot_40747.json',
    path.join(dataDir, 'ghana_kobo_snapshot_40747.json')
].filter(Boolean);

const manifestCandidates = [
    getArgValue('--manifest'),
    process.env.GHANA_MANIFEST_PATH,
    '/private/ghana_kobo_manifest_40747.json',
    'C:/Users/yigin/Documents/Codex/2026-09-21/se/work/private_kobo/ghana_kobo_manifest_40747.json',
    path.join(dataDir, 'ghana_kobo_manifest_40747.json')
].filter(Boolean);

const snapshotPath = snapshotCandidates.find(p => fs.existsSync(p));
const manifestPath = manifestCandidates.find(p => fs.existsSync(p));

if (!snapshotPath) {
    console.error('ERROR: Private snapshot file missing. Mount file and provide --snapshot <path> or set GHANA_SNAPSHOT_PATH.');
    process.exit(1);
}
if (!manifestPath) {
    console.error('ERROR: Private manifest file missing. Mount file and provide --manifest <path> or set GHANA_MANIFEST_PATH.');
    process.exit(1);
}

// Resolve SQLite DB path
const dbPath = process.env.DATABASE_PATH || 
    (process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/^file:/, '') : null) ||
    (fs.existsSync(path.join(serverDir, 'prisma/dev.db')) ? path.join(serverDir, 'prisma/dev.db') : '/app/server/prisma/dev.db');

if (!fs.existsSync(dbPath)) {
    console.error(`ERROR: Database file not found at ${dbPath}`);
    process.exit(1);
}

console.log('================================================================');
console.log('  GHANA KOBO ENABLEMENT & BOUNDED INGESTION (ISSUE #146)       ');
console.log('================================================================');
console.log(`Database:     ${dbPath}`);
console.log(`Mode:         ${isDryRun ? 'DRY-RUN (Read-Only Validation)' : 'APPLY (Atomic Guarded Execution)'}`);
console.log(`Operation ID: ${OPERATION_ID}`);
console.log(`High-Water:   ${PINNED_HIGH_WATER_ID}`);
console.log(`Target Config: ${CONFIG_ID}`);
console.log(`Target Lab:   ${EXPECTED_LAB}`);
console.log(`Target Proj:  ${EXPECTED_PROJECT}`);
console.log(`Snapshot:     ${snapshotPath}`);
console.log(`Manifest:     ${manifestPath}`);
console.log('----------------------------------------------------------------');

// Verify snapshot SHA-256
const snapshotRaw = fs.readFileSync(snapshotPath, 'utf8');
const actualSnapshotHash = createHash('sha256').update(snapshotRaw).digest('hex');
if (actualSnapshotHash !== EXPECTED_SNAPSHOT_SHA256) {
    console.error(`FATAL: Snapshot SHA-256 mismatch! Expected ${EXPECTED_SNAPSHOT_SHA256}, got ${actualSnapshotHash}`);
    process.exit(1);
}
console.log(`  ✓ Immutable snapshot verified (SHA-256: ${actualSnapshotHash})`);

// Verify manifest SHA-256
const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
const actualManifestHash = createHash('sha256').update(manifestRaw).digest('hex');
if (actualManifestHash !== EXPECTED_MANIFEST_SHA256) {
    console.error(`FATAL: Manifest SHA-256 mismatch! Expected ${EXPECTED_MANIFEST_SHA256}, got ${actualManifestHash}`);
    process.exit(1);
}
console.log(`  ✓ Immutable manifest verified (SHA-256: ${actualManifestHash})`);

const snapshotSubmissions = JSON.parse(snapshotRaw);
const manifest = JSON.parse(manifestRaw);

const db = new Database(dbPath, { readonly: isDryRun });

function validateInvariantsAndProjectCandidates(snapshotSubmissions, manifest) {
    console.log('\n[1/4] Validating Ingestion Snapshot & Manifest Invariants...');
    const koboService = require(path.join(serverDir, 'services/koboService'));

    if (snapshotSubmissions.length !== 459) {
        throw new Error(`INVARIANT_VIOLATION: Expected 459 bounded submissions, got ${snapshotSubmissions.length}`);
    }

    let totalOccurrences = 0;
    const uniqueIds = new Set();
    const intraSubDups = [];
    const crossSubDups = [];
    const seenGlobal = new Map();

    for (const sub of snapshotSubmissions) {
        const samples = koboService.transformSubmission(sub);
        const seenInSub = new Map();
        for (const s of samples) {
            totalOccurrences++;
            const norm = s.original_id?.trim().toUpperCase();
            if (norm) {
                if (seenInSub.has(norm)) {
                    intraSubDups.push({ subId: sub._id, id: norm, depth: s.depth });
                } else {
                    seenInSub.set(norm, s);
                }
                if (seenGlobal.has(norm)) {
                    if (seenGlobal.get(norm).subId !== sub._id) {
                        crossSubDups.push({ subId: sub._id, id: norm, depth: s.depth, firstSubId: seenGlobal.get(norm).subId });
                    }
                } else {
                    seenGlobal.set(norm, { subId: sub._id, depth: s.depth });
                    uniqueIds.add(norm);
                }
            }
        }
    }

    console.log(`  Total sample occurrences:    ${totalOccurrences} (Expected: 868)`);
    console.log(`  Distinct normalized IDs:     ${uniqueIds.size} (Expected: 864)`);
    console.log(`  Intra-sub duplicate depths:  ${intraSubDups.length} (Expected: 2)`);
    console.log(`  Cross-sub duplicate events:  ${crossSubDups.length} (Expected: 2)`);

    if (totalOccurrences !== 868) {
        throw new Error(`INVARIANT_VIOLATION: Expected 868 total occurrences, got ${totalOccurrences}`);
    }
    if (uniqueIds.size !== 864) {
        throw new Error(`INVARIANT_VIOLATION: Expected 864 distinct IDs, got ${uniqueIds.size}`);
    }
    if (intraSubDups.length !== 2) {
        throw new Error(`INVARIANT_VIOLATION: Expected 2 intra-sub duplicates, got ${intraSubDups.length}`);
    }
    if (crossSubDups.length !== 2) {
        throw new Error(`INVARIANT_VIOLATION: Expected 2 cross-sub duplicates, got ${crossSubDups.length}`);
    }

    // Verify exact candidate IDs match manifest
    const manifestNormCandidates = new Set(manifest.candidateIds.map(id => id.trim().toUpperCase()));
    if (manifestNormCandidates.size !== uniqueIds.size) {
        throw new Error(`INVARIANT_VIOLATION: Manifest candidate count (${manifestNormCandidates.size}) does not match projected unique count (${uniqueIds.size})`);
    }
    for (const id of uniqueIds) {
        if (!manifestNormCandidates.has(id)) {
            throw new Error(`INVARIANT_VIOLATION: Projected candidate ID '${id}' missing from manifest`);
        }
    }

    // Verify exact expected hold IDs match manifest
    const expectedHeldIds = manifest.heldSpecimens.map(h => h.id.trim().toUpperCase()).sort();
    const actualHeldIds = [...intraSubDups.map(d => d.id), ...crossSubDups.map(d => d.id)].sort();
    if (JSON.stringify(expectedHeldIds) !== JSON.stringify(actualHeldIds)) {
        throw new Error(`INVARIANT_VIOLATION: Held IDs mismatch! Expected ${expectedHeldIds}, got ${actualHeldIds}`);
    }
    console.log(`  ✓ Full 4-hold ledger verified: ${actualHeldIds.join(', ')}`);

    return uniqueIds;
}

function runPreflightChecks(candidateNormalizedIds) {
    console.log('\n[2/4] Executing Precondition Assertions & Collision Projection...');

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

    // 5. Candidate collision projection: verify none of candidate IDs exist in database (normalized Set lookup)
    const existingSamples = db.prepare('SELECT originalId FROM Sample').all();
    const existingNormSet = new Set(existingSamples.map(s => s.originalId?.trim().toUpperCase()).filter(Boolean));
    const collisions = [];
    for (const candId of candidateNormalizedIds) {
        if (existingNormSet.has(candId)) {
            collisions.push(candId);
        }
    }
    if (collisions.length > 0) {
        throw new Error(`PRECONDITION_FAILED: Candidate ID collision with existing records: ${collisions.join(', ')}`);
    }
    console.log(`  ✓ Candidate ID projection clean: 0 collisions across ${candidateNormalizedIds.size} candidate IDs (verified against ${existingNormSet.size} database specimens)`);

    return configRow;
}

async function runDryRun(candidateNormalizedIds, configRow) {
    console.log('\n[3/4] Dry-Run Validation Summary...');
    console.log(`  Projected Candidates: 864 specimens`);
    console.log(`  Projected Holds:      4 specimens (AMBIGUOUS_PROVENANCE_HOLD)`);
    console.log(`  Projected Clean:      860 specimens (EXPECTED status)`);
    console.log(`  CAS Mutation:         Simulated OK (0 rows modified in DB)`);

    console.log('\n================================================================');
    console.log('  DRY-RUN VALIDATION SUCCEEDED: All invariants verified (864/4)  ');
    console.log('  Ready for guarded apply clearance. Zero database rows modified. ');
    console.log('================================================================');
}

async function runApply(candidateNormalizedIds, configRow) {
    console.log('\n[3/4] Executing Atomic Compare-and-Set Configuration Activation...');
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
            `Enabled Ghana Kobo configuration for ${EXPECTED_LAB} mapped to project ${EXPECTED_PROJECT} (Issue #146, PR #147). Pinned snapshot SHA ${EXPECTED_SNAPSHOT_SHA256}. Operation: ${OPERATION_ID}`,
            OPERATION_ID
        );
    });

    casTx();
    console.log('  ✓ Atomic CAS succeeded: KoboConfig activated and bound to SOILFER-US');

    console.log('\n[4/4] Executing Single-Writer Bounded Ingestion from Verified Snapshot...');
    const prisma = require(path.join(serverDir, 'prisma'));
    const koboController = require(path.join(serverDir, 'controllers/koboController'));

    const activeConfig = await prisma.koboConfig.findUnique({ where: { id: CONFIG_ID } });
    const syncResult = await koboController._syncLabSubmissions(activeConfig, OPERATION_ID, {
        submissionsOverride: snapshotSubmissions,
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

    console.log('\n[*] Executing Scoped Read-Only Postflight Assertions...');
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

    const mappingAudits = db.prepare(`
        SELECT COUNT(*) as count FROM AuditLog 
        WHERE performedBy = ? AND action = 'ENABLE_GHANA_KOBO_MAPPING'
    `).get(OPERATION_ID).count;

    const createAudits = db.prepare(`
        SELECT COUNT(*) as count FROM AuditLog 
        WHERE performedBy = ? AND action = 'CREATE_KOBO_SYNC'
    `).get(OPERATION_ID).count;

    const intraAudits = db.prepare(`
        SELECT COUNT(*) as count FROM AuditLog 
        WHERE performedBy = ? AND action = 'KOBO_INTRA_SUBMISSION_DUPLICATE'
    `).get(OPERATION_ID).count;

    const crossAudits = db.prepare(`
        SELECT COUNT(*) as count FROM AuditLog 
        WHERE performedBy = ? AND action = 'KOBO_CONFLICTING_PROVENANCE'
    `).get(OPERATION_ID).count;

    console.log(`  Total Admitted Samples:      ${totalAdmitted} (Expected: 864)`);
    console.log(`  Samples in EXPECTED Status:  ${expectedStatus} (Expected: 864)`);
    console.log(`  Samples on Provenance Hold:  ${heldSamples} (Expected: 4)`);
    console.log(`  Clean Unambiguous Samples:   ${cleanExpected} (Expected: 860)`);
    console.log(`  MAPPING Audits:              ${mappingAudits} (Expected: 1)`);
    console.log(`  CREATE_KOBO_SYNC Audits:     ${createAudits} (Expected: 864)`);
    console.log(`  INTRA_SUBMISSION Audits:     ${intraAudits} (Expected: 2)`);
    console.log(`  CONFLICTING_PROV Audits:     ${crossAudits} (Expected: 2)`);

    if (totalAdmitted !== 864 || expectedStatus !== 864 || heldSamples !== 4 || cleanExpected !== 860) {
        throw new Error('POSTFLIGHT_FAILED: Sample ledger invariants violated');
    }
    if (mappingAudits !== 1 || createAudits !== 864 || intraAudits !== 2 || crossAudits !== 2) {
        throw new Error('POSTFLIGHT_FAILED: AuditLog ledger invariants violated');
    }

    console.log('  ✓ All scoped read-only postflight assertions passed');

    console.log('\n================================================================');
    console.log(`  APPLY COMPLETED SUCCESSFULLY (Operation: ${OPERATION_ID})      `);
    console.log('  864 samples admitted to EXPECTED; 4 on durable provenance hold.');
    console.log('================================================================');
}

async function main() {
    try {
        const candidateNormalizedIds = validateInvariantsAndProjectCandidates(snapshotSubmissions, manifest);
        const configRow = runPreflightChecks(candidateNormalizedIds);
        if (isDryRun) {
            await runDryRun(candidateNormalizedIds, configRow);
        } else if (isApply) {
            await runApply(candidateNormalizedIds, configRow);
        }
    } catch (err) {
        console.error(`\nFAILED: ${err.message}`);
        process.exit(1);
    } finally {
        try { db.close(); } catch (_) {}
    }
}

main();
