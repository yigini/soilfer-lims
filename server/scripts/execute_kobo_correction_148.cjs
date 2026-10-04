/**
 * Canonical Bounded Correction Runner for Issue #148
 * 
 * Five Kobo Project Mappings & Bounded Submission Ingestion
 * Target Image: soilfer-lims:v3.5.29-e5d5ebd
 * 
 * Invariants:
 *  - Fail-closed validation before any CAS write
 *  - Manifest & snapshot dual SHA-256 validation
 *  - Real candidate cohort transformation & ownership inspection against Sample table
 *  - Server-bound CAS updates (labId, formId, koboServerUrl, projectCode IS NULL, cursor)
 *  - Atomic AuditLog creation
 *  - Ingestion via canonical koboController
 *  - Scoped postflight assertions (634 newly admitted IDs, 3 specific held specimens)
 *  - Unified DATABASE_PATH before requiring either writer
 */

const fs = require('fs');
const path = require('path');
const { createHash, randomBytes, randomUUID } = require('crypto');
const Database = require('better-sqlite3');

const isDryRun = process.argv.includes('--dry-run');
const isApply = process.argv.includes('--apply');

if (!isDryRun && !isApply) {
    console.error('ERROR: Must specify either --dry-run or --apply');
    process.exit(1);
}

// 1. Unified DATABASE_PATH Resolution
const serverDir = fs.existsSync('/app/server') ? '/app/server' : path.resolve(__dirname, '..');
const defaultDbPath = path.join(serverDir, 'prisma/dev.db');
const rawDbUrl = process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/^file:/, '') : null;
const rawDbPath = process.env.DATABASE_PATH || rawDbUrl || defaultDbPath;

if (process.env.DATABASE_URL && process.env.DATABASE_PATH) {
    const urlResolved = path.resolve(process.env.DATABASE_URL.replace(/^file:/, ''));
    const pathResolved = path.resolve(process.env.DATABASE_PATH);
    if (urlResolved !== pathResolved) {
        console.error(`FATAL: Conflicting database paths! DATABASE_URL (${urlResolved}) != DATABASE_PATH (${pathResolved})`);
        process.exit(1);
    }
}
const dbPath = path.resolve(rawDbPath);
if (!fs.existsSync(dbPath)) {
    console.error(`FATAL: SQLite database file not found at ${dbPath}`);
    process.exit(1);
}
// Export canonical DATABASE_PATH before requiring prisma or any controller
process.env.DATABASE_PATH = dbPath;

const EXPECTED_SNAPSHOT_SHA256 = '8e2d50f0ee3f5b0f7e5b474921d18c54e44c2180675e0a7944c2b01e6379f809';
const EXPECTED_MANIFEST_SHA256 = 'f42ed9b3cc2e7fe8e27ef3b99cdba01dc280dae8687d2021651555abd7763da6';

const snapshotCandidates = [
    process.env.KOBO_148_SNAPSHOT_PATH,
    '/opt/lims/private_kobo/issue148_kobo_snapshot_bounded.json',
    'C:/Users/yigin/Documents/Codex/2026-09-21/se/work/private_kobo/issue148_kobo_snapshot_bounded.json'
].filter(Boolean);

const manifestCandidates = [
    process.env.KOBO_148_MANIFEST_PATH,
    '/opt/lims/private_kobo/issue148_kobo_manifest_bounded.json',
    'C:/Users/yigin/Documents/Codex/2026-09-21/se/work/private_kobo/issue148_kobo_manifest_bounded.json'
].filter(Boolean);

const snapshotPath = snapshotCandidates.find(p => fs.existsSync(p));
const manifestPath = manifestCandidates.find(p => fs.existsSync(p));

if (!snapshotPath) {
    console.error('FATAL: Private snapshot file missing. Mount file or set KOBO_148_SNAPSHOT_PATH.');
    process.exit(1);
}
if (!manifestPath) {
    console.error('FATAL: Private manifest file missing. Mount file or set KOBO_148_MANIFEST_PATH.');
    process.exit(1);
}

const OPERATION_ID = 'KOBO_CORRECTION_148_' + new Date().toISOString().replace(/[:.]/g, '') + '_' + randomBytes(4).toString('hex');

// Five candidate configs with exact measured identifiers
const CANDIDATE_CONFIGS = [
    {
        id: '78cd0dc8-f04c-4bcf-9451-bc9507ee0623',
        labId: 'HND-LAB1',
        targetProject: 'SOILFER-US',
        formId: 'akt25hEErmCj2G9LBhs4sS',
        serverUrl: 'https://kf.soilfer-data.fao.org',
        currentCursor: '11035',
        pinnedUpperBound: 11035,
        expectedSubmissions: 0,
        expectedNewSamples: 0,
        expectedHolds: 0
    },
    {
        id: '38744747-1d3f-4f4a-8523-6f251ecd1fba',
        labId: 'TUN-LAB1',
        targetProject: 'SOILFER-JPN',
        formId: 'aLALh2Lp2HwbC2tTejyAzR',
        serverUrl: 'https://kf.soilfer-data.fao.org',
        currentCursor: '10135',
        pinnedUpperBound: 10135,
        expectedSubmissions: 0,
        expectedNewSamples: 0,
        expectedHolds: 0
    },
    {
        id: 'c630d7b4-5d44-4826-94e5-5851abbd2a46',
        labId: 'KEN-LAB1',
        targetProject: 'SOILFER-US',
        formId: 'aPV3Fta6MPNt7ZQmcJqw9s',
        serverUrl: 'https://kf.soilfer-data.fao.org',
        currentCursor: '37032',
        pinnedUpperBound: 39774,
        expectedSubmissions: 4,
        expectedNewSamples: 8,
        expectedHolds: 0
    },
    {
        id: '6e60eebe-5d8d-4e13-8037-efeb8041b24c',
        labId: 'MOZ-LAB1',
        targetProject: 'SOILFER-JPN',
        formId: 'aKDDwLku3FEU3hHyC8sHUt',
        serverUrl: 'https://kf.soilfer-data.fao.org',
        currentCursor: '9591',
        pinnedUpperBound: 40410,
        expectedSubmissions: 119,
        expectedNewSamples: 204,
        expectedHolds: 1
    },
    {
        id: '897c1fb0-d83c-40cd-b513-b3e6e6b78172',
        labId: 'ZMB-LAB1',
        targetProject: 'SOILFER-US',
        formId: 'aXhpApWo6jKUHmJ43PJMpj',
        serverUrl: 'https://kf.soilfer-data.fao.org',
        currentCursor: '39350',
        pinnedUpperBound: 40750,
        expectedSubmissions: 262,
        expectedNewSamples: 422,
        expectedHolds: 2
    }
];

// Open direct SQLite DB
const db = new Database(dbPath, { readonly: isDryRun });

function runPreflightAssertions() {
    console.log('================================================================');
    console.log('  FIVE-CONFIGURATION KOBO PROJECT MAPPING & CORRECTION (ISSUE #148)');
    console.log('================================================================');
    console.log(`Database:     ${dbPath}`);
    console.log(`Mode:         ${isDryRun ? 'DRY-RUN (Read-Only Validation)' : 'APPLY (Guarded Atomic Execution)'}`);
    console.log(`Operation ID: ${OPERATION_ID}`);
    console.log(`Snapshot:     ${snapshotPath}`);
    console.log(`Manifest:     ${manifestPath}`);
    console.log('----------------------------------------------------------------');

    // 1. Verify snapshot and manifest SHA-256
    const snapshotRaw = fs.readFileSync(snapshotPath, 'utf8');
    const actualSnapshotHash = createHash('sha256').update(snapshotRaw).digest('hex');
    if (actualSnapshotHash !== EXPECTED_SNAPSHOT_SHA256) {
        throw new Error(`FATAL: Snapshot SHA-256 mismatch! Expected ${EXPECTED_SNAPSHOT_SHA256}, got ${actualSnapshotHash}`);
    }
    console.log(`  ✓ Immutable snapshot verified (SHA-256: ${actualSnapshotHash})`);

    const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
    const actualManifestHash = createHash('sha256').update(manifestRaw).digest('hex');
    if (actualManifestHash !== EXPECTED_MANIFEST_SHA256) {
        throw new Error(`FATAL: Manifest SHA-256 mismatch! Expected ${EXPECTED_MANIFEST_SHA256}, got ${actualManifestHash}`);
    }
    console.log(`  ✓ Immutable manifest verified (SHA-256: ${actualManifestHash})`);

    const snapshot = JSON.parse(snapshotRaw);
    const manifest = JSON.parse(manifestRaw);

    if (manifest.snapshotSha256 !== actualSnapshotHash) {
        throw new Error(`FATAL: Manifest references snapshot SHA ${manifest.snapshotSha256}, but actual snapshot is ${actualSnapshotHash}`);
    }
    if (manifest.totalSubmissions !== 385) {
        throw new Error(`FATAL: Manifest totalSubmissions expected 385, found ${manifest.totalSubmissions}`);
    }

    console.log('\n[1/3] Asserting Database Preconditions & Manifest Bindings...');

    // Dynamic pre-operation baseline count
    const baselineCount = db.prepare('SELECT count(*) as count FROM Sample').get().count;
    console.log(`  Dynamic pre-operation sample count: ${baselineCount}`);

    // Verify each configuration in manifest and in DB
    for (const c of CANDIDATE_CONFIGS) {
        const m = manifest.summaryByLab[c.labId];
        if (!m) throw new Error(`MANIFEST_ERROR: Manifest missing summary for lab ${c.labId}`);
        if (m.configId !== c.id) throw new Error(`MANIFEST_ERROR: [${c.labId}] configId mismatch: ${m.configId} vs ${c.id}`);
        if (m.formId !== c.formId) throw new Error(`MANIFEST_ERROR: [${c.labId}] formId mismatch: ${m.formId} vs ${c.formId}`);
        if (Number(m.currentCursor) !== Number(c.currentCursor)) throw new Error(`MANIFEST_ERROR: [${c.labId}] cursor mismatch`);
        if (Number(m.pinnedUpperBound) !== Number(c.pinnedUpperBound)) throw new Error(`MANIFEST_ERROR: [${c.labId}] upper bound mismatch`);
        if (Number(m.submissionCount) !== c.expectedSubmissions) throw new Error(`MANIFEST_ERROR: [${c.labId}] submissionCount mismatch`);

        const subs = snapshot.submissionsByLab[c.labId] || [];
        if (subs.length !== c.expectedSubmissions) {
            throw new Error(`SNAPSHOT_ERROR: [${c.labId}] Submissions count in snapshot (${subs.length}) != expected (${c.expectedSubmissions})`);
        }

        // DB pre-state checks
        const row = db.prepare('SELECT id, labId, formId, koboServerUrl, projectCode, isActive, lastSubmissionId FROM KoboConfig WHERE id = ?').get(c.id);
        if (!row) throw new Error(`PRECONDITION_FAILED: KoboConfig ${c.id} not found in DB`);
        if (row.labId !== c.labId) throw new Error(`PRECONDITION_FAILED: [${c.id}] labId mismatch: ${row.labId} vs ${c.labId}`);
        if (row.formId !== c.formId) throw new Error(`PRECONDITION_FAILED: [${c.id}] formId mismatch: ${row.formId} vs ${c.formId}`);
        if (row.koboServerUrl !== c.serverUrl) throw new Error(`PRECONDITION_FAILED: [${c.id}] serverUrl mismatch: ${row.koboServerUrl} vs ${c.serverUrl}`);
        if (row.projectCode !== null) throw new Error(`PRECONDITION_FAILED: [${c.id}] projectCode must be NULL, found: ${row.projectCode}`);
        if (Number(row.isActive) !== 1) throw new Error(`PRECONDITION_FAILED: [${c.id}] isActive must be 1, found: ${row.isActive}`);
        if (String(row.lastSubmissionId) !== String(c.currentCursor)) throw new Error(`PRECONDITION_FAILED: [${c.id}] cursor mismatch: ${row.lastSubmissionId} vs ${c.currentCursor}`);

        // Lab active
        const lab = db.prepare('SELECT id, isActive FROM Lab WHERE id = ?').get(c.labId);
        if (!lab || Number(lab.isActive) !== 1) throw new Error(`PRECONDITION_FAILED: Lab ${c.labId} is inactive`);

        // Project active
        const proj = db.prepare('SELECT id, code, status FROM Project WHERE code = ?').get(c.targetProject);
        if (!proj || proj.status !== 'ACTIVE') throw new Error(`PRECONDITION_FAILED: Target project ${c.targetProject} is not ACTIVE`);

        // ProjectLab PRIMARY
        const pl = db.prepare('SELECT role FROM ProjectLab WHERE projectCode = ? AND labId = ?').get(c.targetProject, c.labId);
        if (!pl || pl.role !== 'PRIMARY') throw new Error(`PRECONDITION_FAILED: ProjectLab linkage for ${c.targetProject} / ${c.labId} must be PRIMARY`);
    }
    console.log('  ✓ All 5 candidate configurations verified active, unmapped, and matching pinned cursors');
    console.log('  ✓ Target projects and PRIMARY ProjectLab linkages verified');

    // MOZL and TUR preserved untouched on hold
    const mozlRow = db.prepare("SELECT id, projectCode, isActive FROM KoboConfig WHERE projectCode = 'MOZL'").get();
    if (!mozlRow || Number(mozlRow.isActive) !== 1) throw new Error('PRECONDITION_FAILED: MOZL config missing or not active');
    const turLab = db.prepare("SELECT id, isActive FROM Lab WHERE id = 'TUR'").get();
    if (!turLab || Number(turLab.isActive) !== 0) throw new Error('PRECONDITION_FAILED: TUR lab must remain inactive');
    console.log('  ✓ MOZL and TUR configurations verified preserved on hold (untouched)');

    // 2. Candidate Cohort Transformation & Collision / Positive Ownership Assertions BEFORE CAS
    console.log('\n[2/3] Analyzing Candidate Cohort & Specimen Ownership Against Database...');
    const koboService = require(path.join(serverDir, 'services/koboService'));

    const sampleLookupStmt = db.prepare(`
        SELECT id, originalId, assignedLab, projectCode, status, receptionDate, receivedBy, rejectionReason, metadata
        FROM Sample
        WHERE UPPER(originalId) = ?
    `);

    let totalProjectedNew = 0;
    let totalProjectedHolds = 0;
    const projectedNewByLab = {};
    const projectedHoldsByLab = {};
    const candidateSampleDetails = [];

    const EXPECTED_HOLD_BARCODES = new Set(['MOZ0078-6-1C', 'ZM-JDCMG', 'ZM-JXGMD']);

    for (const c of CANDIDATE_CONFIGS) {
        const subs = snapshot.submissionsByLab[c.labId] || [];
        let labNewCount = 0;
        let labHoldCount = 0;

        for (const sub of subs) {
            const rawSamples = koboService.transformSubmission(sub, null, c.labId);
            const samples = Array.isArray(rawSamples) ? rawSamples : (rawSamples ? [rawSamples] : []);

            for (const sampleData of samples) {
                const normId = sampleData.original_id?.trim().toUpperCase();
                if (!normId) continue;

                const existing = sampleLookupStmt.get(normId);

                if (!existing) {
                    // New sample admission candidate
                    labNewCount++;
                    candidateSampleDetails.push({
                        type: 'NEW',
                        labId: c.labId,
                        targetProject: c.targetProject,
                        normId,
                        subId: sub._id
                    });
                } else {
                    // Existing sample collision
                    labHoldCount++;
                    // Assert positive agreement and expected state
                    if (existing.assignedLab !== c.labId) {
                        throw new Error(`COLLISION_ERROR: Specimen ${normId} assigned to lab ${existing.assignedLab}, expected ${c.labId}`);
                    }
                    if (existing.projectCode !== c.targetProject) {
                        throw new Error(`COLLISION_ERROR: Specimen ${normId} project is ${existing.projectCode}, expected ${c.targetProject}`);
                    }
                    if (existing.status !== 'EXPECTED') {
                        throw new Error(`COLLISION_ERROR: Specimen ${normId} status is ${existing.status}, expected EXPECTED`);
                    }
                    if (existing.receptionDate !== null || existing.receivedBy !== null) {
                        throw new Error(`COLLISION_ERROR: Specimen ${normId} has physical receipt; mutation disallowed`);
                    }
                    if (!EXPECTED_HOLD_BARCODES.has(normId)) {
                        throw new Error(`UNEXPECTED_COLLISION: Specimen ${normId} collided unexpectedly in database!`);
                    }
                    candidateSampleDetails.push({
                        type: 'HOLD',
                        labId: c.labId,
                        targetProject: c.targetProject,
                        normId,
                        subId: sub._id,
                        existingId: existing.id
                    });
                }
            }
        }

        if (labNewCount !== c.expectedNewSamples) {
            throw new Error(`COHORT_MISMATCH: [${c.labId}] Projected new samples (${labNewCount}) != expected (${c.expectedNewSamples})`);
        }
        if (labHoldCount !== c.expectedHolds) {
            throw new Error(`COHORT_MISMATCH: [${c.labId}] Projected holds (${labHoldCount}) != expected (${c.expectedHolds})`);
        }

        projectedNewByLab[c.labId] = labNewCount;
        projectedHoldsByLab[c.labId] = labHoldCount;
        totalProjectedNew += labNewCount;
        totalProjectedHolds += labHoldCount;
    }

    if (totalProjectedNew !== 634) {
        throw new Error(`COHORT_MISMATCH: Total projected new admissions (${totalProjectedNew}) != 634`);
    }
    if (totalProjectedHolds !== 3) {
        throw new Error(`COHORT_MISMATCH: Total projected holds (${totalProjectedHolds}) != 3`);
    }

    console.log(`  ✓ Cohort candidate analysis complete: exactly 634 new EXPECTED, exactly 3 provenance holds`);
    console.log(`    - HND-LAB1: 0 new, 0 holds`);
    console.log(`    - TUN-LAB1: 0 new, 0 holds`);
    console.log(`    - KEN-LAB1: 8 new, 0 holds`);
    console.log(`    - MOZ-LAB1: 204 new, 1 hold (MOZ0078-6-1C)`);
    console.log(`    - ZMB-LAB1: 422 new, 2 holds (ZM-jDCMg, ZM-jxGMd)`);

    return {
        baselineCount,
        snapshot,
        manifest,
        candidateSampleDetails,
        totalProjectedNew,
        totalProjectedHolds
    };
}

async function runDryRun(preflightData) {
    const { baselineCount, totalProjectedNew, totalProjectedHolds } = preflightData;
    console.log('\n[3/3] Dry-Run Validation Summary...');
    console.log(`  Candidate Configurations: 5 (HND, TUN, KEN, MOZ, ZMB)`);
    console.log(`  Preserved Configurations: MOZL, TUR (unchanged on hold)`);
    console.log(`  Submissions in Snapshot:  385 submissions verified`);
    console.log(`  Projected New Expected:   ${totalProjectedNew} specimens (receptionDate=null, receivedBy=null)`);
    console.log(`  Projected Holds:          ${totalProjectedHolds} specimens (AMBIGUOUS_PROVENANCE_HOLD)`);
    console.log(`  Projected Post Count:     ${baselineCount + totalProjectedNew}`);
    console.log(`  Database Mutations:       0 rows modified in DB (read-only assertion mode)`);

    console.log('\n================================================================');
    console.log('  DRY-RUN VALIDATION SUCCEEDED: All invariants & cohorts verified ');
    console.log('  Ready for guarded apply clearance. Zero database rows modified. ');
    console.log('================================================================');
}

async function runApply(preflightData) {
    const { baselineCount, snapshot, candidateSampleDetails } = preflightData;
    const targetPostCount = baselineCount + 634;

    console.log('\n[3/3] Executing Guarded Atomic Apply...');

    // 1. Atomic CAS with Server Binding & AuditLog
    console.log('  Executing Atomic Compare-And-Swap (CAS) Configuration Updates...');
    const casTx = db.transaction(() => {
        for (const c of CANDIDATE_CONFIGS) {
            const updateStmt = db.prepare(`
                UPDATE KoboConfig
                SET projectCode = ?, updatedAt = CURRENT_TIMESTAMP
                WHERE id = ?
                  AND labId = ?
                  AND formId = ?
                  AND koboServerUrl = ?
                  AND projectCode IS NULL
                  AND isActive = 1
                  AND lastSubmissionId = ?
            `);
            const info = updateStmt.run(c.targetProject, c.id, c.labId, c.formId, c.serverUrl, c.currentCursor);
            if (info.changes !== 1) {
                throw new Error(`CAS_FAILED: Expected 1 row updated for ${c.labId} (${c.id}), got ${info.changes}`);
            }

            const auditStmt = db.prepare(`
                INSERT INTO AuditLog (id, entity, entityId, action, details, performedBy, timestamp)
                VALUES (?, 'KOBO_CONFIG', ?, 'ENABLE_KOBO_PROJECT_MAPPING', ?, ?, CURRENT_TIMESTAMP)
            `);
            auditStmt.run(
                randomUUID(),
                c.id,
                `Enabled explicit project mapping for ${c.labId} to ${c.targetProject} (Issue #148). Form: ${c.formId}, server: ${c.serverUrl}, cursor: ${c.currentCursor}, pinned boundary: ${c.pinnedUpperBound}. Operation: ${OPERATION_ID}`,
                OPERATION_ID
            );
        }
    });

    casTx();
    console.log('  ✓ Atomic CAS succeeded: 5 configs updated, 5 audit entries recorded');

    // 2. Canonical Controller Ingestion
    console.log('  Ingesting Bounded Submissions via Canonical Controller...');
    const prisma = require(path.join(serverDir, 'prisma'));
    const koboController = require(path.join(serverDir, 'controllers/koboController'));

    let totalAdmitted = 0;
    for (const c of CANDIDATE_CONFIGS) {
        const subs = snapshot.submissionsByLab[c.labId] || [];
        const activeConfig = await prisma.koboConfig.findUnique({ where: { id: c.id } });
        if (!activeConfig || activeConfig.projectCode !== c.targetProject) {
            throw new Error(`APPLY_ERROR: Config ${c.id} not properly configured with project ${c.targetProject}`);
        }

        const syncResult = await koboController._syncLabSubmissions(activeConfig, OPERATION_ID, {
            submissionsOverride: subs,
            maxSubmissionId: c.pinnedUpperBound
        });

        if (syncResult.newSamples !== c.expectedNewSamples) {
            throw new Error(`SYNC_MISMATCH: [${c.labId}] Expected ${c.expectedNewSamples} new samples, got ${syncResult.newSamples}`);
        }
        totalAdmitted += syncResult.newSamples;
        console.log(`    - ${c.labId}: ${syncResult.newSamples} new samples, ${syncResult.skipped} skipped, cursor=${c.pinnedUpperBound}`);
    }

    if (totalAdmitted !== 634) {
        throw new Error(`TOTAL_MISMATCH: Expected 634 total admitted samples, got ${totalAdmitted}`);
    }
    console.log('  ✓ Ingestion complete: exactly 634 new samples admitted');

    // 3. Scoped Postflight Invariant Assertions
    console.log('\n  Asserting Scoped Postflight Invariants...');

    // A. Total sample count
    const postCount = db.prepare('SELECT count(*) as count FROM Sample').get().count;
    if (postCount !== targetPostCount) {
        throw new Error(`POSTFLIGHT_FAILED: Total sample count (${postCount}) != target (${targetPostCount})`);
    }
    console.log(`  ✓ Total sample count verified: ${postCount} (Baseline ${baselineCount} + 634)`);

    // B. Newly admitted 634 specimens verified individually
    const newCandidates = candidateSampleDetails.filter(d => d.type === 'NEW');
    const sampleCheckStmt = db.prepare(`
        SELECT id, originalId, assignedLab, projectCode, status, receptionDate, receivedBy, rejectionReason
        FROM Sample
        WHERE UPPER(originalId) = ?
    `);

    for (const cand of newCandidates) {
        const row = sampleCheckStmt.get(cand.normId);
        if (!row) throw new Error(`POSTFLIGHT_FAILED: Admitted specimen ${cand.normId} missing from database!`);
        if (row.status !== 'EXPECTED') throw new Error(`POSTFLIGHT_FAILED: Specimen ${cand.normId} status is ${row.status}, expected EXPECTED`);
        if (row.receptionDate !== null || row.receivedBy !== null) {
            throw new Error(`POSTFLIGHT_FAILED: Specimen ${cand.normId} has non-null physical receipt`);
        }
        if (row.assignedLab !== cand.labId) throw new Error(`POSTFLIGHT_FAILED: Specimen ${cand.normId} assignedLab is ${row.assignedLab}, expected ${cand.labId}`);
        if (row.projectCode !== cand.targetProject) throw new Error(`POSTFLIGHT_FAILED: Specimen ${cand.normId} projectCode is ${row.projectCode}, expected ${cand.targetProject}`);
    }
    console.log('  ✓ All 634 newly admitted specimens verified: status=EXPECTED, receptionDate=null, receivedBy=null, correct scope');

    // C. Three held specimens verified individually
    const heldBarcodes = ['MOZ0078-6-1C', 'ZM-JDCMG', 'ZM-JXGMD'];
    for (const barcode of heldBarcodes) {
        const row = db.prepare(`
            SELECT id, originalId, status, receptionDate, receivedBy, rejectionReason, metadata
            FROM Sample
            WHERE UPPER(originalId) = ?
        `).get(barcode);

        if (!row) throw new Error(`POSTFLIGHT_FAILED: Held specimen ${barcode} not found`);
        if (row.status !== 'EXPECTED') throw new Error(`POSTFLIGHT_FAILED: Held specimen ${barcode} status changed to ${row.status}`);
        if (row.receptionDate !== null || row.receivedBy !== null) {
            throw new Error(`POSTFLIGHT_FAILED: Held specimen ${barcode} has non-null reception fields`);
        }
        if (!row.rejectionReason || !row.rejectionReason.includes('PROVENANCE_HOLD: Conflicting field submissions')) {
            throw new Error(`POSTFLIGHT_FAILED: Held specimen ${barcode} rejectionReason mismatch: ${row.rejectionReason}`);
        }

        const meta = JSON.parse(row.metadata || '{}');
        if (!meta.provenanceHold || meta.provenanceHold.status !== 'AMBIGUOUS_PROVENANCE_HOLD') {
            throw new Error(`POSTFLIGHT_FAILED: Held specimen ${barcode} provenanceHold missing or invalid`);
        }
        if (!Array.isArray(meta.conflictingSubmissions) || meta.conflictingSubmissions.length < 1) {
            throw new Error(`POSTFLIGHT_FAILED: Held specimen ${barcode} conflictingSubmissions missing`);
        }
    }
    console.log('  ✓ Exactly 3 held specimens verified: metadata.conflictingSubmissions preserved, provenance hold active, null receipts');

    // D. Audit log entries verified
    const mappingAudits = db.prepare(`
        SELECT count(*) as count FROM AuditLog
        WHERE performedBy = ? AND action = 'ENABLE_KOBO_PROJECT_MAPPING'
    `).get(OPERATION_ID).count;
    if (mappingAudits !== 5) {
        throw new Error(`POSTFLIGHT_FAILED: Expected 5 mapping audit entries, found ${mappingAudits}`);
    }

    const conflictAudits = db.prepare(`
        SELECT count(*) as count FROM AuditLog
        WHERE performedBy = ? AND action = 'KOBO_CONFLICTING_PROVENANCE'
    `).get(OPERATION_ID).count;
    if (conflictAudits !== 3) {
        throw new Error(`POSTFLIGHT_FAILED: Expected 3 conflict audit entries, found ${conflictAudits}`);
    }
    console.log('  ✓ Audit entries verified: 5 ENABLE_KOBO_PROJECT_MAPPING, 3 KOBO_CONFLICTING_PROVENANCE');

    // E. Cursors updated to pinned bounds
    for (const c of CANDIDATE_CONFIGS) {
        const cfg = db.prepare('SELECT lastSubmissionId, projectCode FROM KoboConfig WHERE id = ?').get(c.id);
        if (Number(cfg.lastSubmissionId) !== c.pinnedUpperBound) {
            throw new Error(`POSTFLIGHT_FAILED: [${c.labId}] Cursor (${cfg.lastSubmissionId}) != pinned upper bound (${c.pinnedUpperBound})`);
        }
        if (cfg.projectCode !== c.targetProject) {
            throw new Error(`POSTFLIGHT_FAILED: [${c.labId}] projectCode (${cfg.projectCode}) != target (${c.targetProject})`);
        }
    }
    console.log('  ✓ Cursors confirmed updated to pinned bounds for all 5 configurations');

    // F. Untouched configurations preserved
    const mozlPost = db.prepare("SELECT id, projectCode, isActive FROM KoboConfig WHERE projectCode = 'MOZL'").get();
    if (!mozlPost || Number(mozlPost.isActive) !== 1) throw new Error('POSTFLIGHT_FAILED: MOZL config modified');
    const turPost = db.prepare("SELECT id, isActive FROM Lab WHERE id = 'TUR'").get();
    if (!turPost || Number(turPost.isActive) !== 0) throw new Error('POSTFLIGHT_FAILED: TUR lab status modified');
    console.log('  ✓ MOZL and TUR configurations confirmed preserved on hold (untouched)');

    // G. DB integrity & foreign keys
    const integrity = db.pragma('integrity_check');
    const fkCheck = db.pragma('foreign_key_check');
    if (integrity[0].integrity_check !== 'ok' || fkCheck.length > 0) {
        throw new Error(`POSTFLIGHT_FAILED: DB integrity check failed: ${JSON.stringify({ integrity, fkCheck })}`);
    }
    console.log('  ✓ Database integrity ok, foreign keys OK (0 errors)');

    console.log('\n================================================================');
    console.log(`  APPLY COMMITTED & POSTFLIGHT VERIFIED: 634 ADMITTED, 3 HELD    `);
    console.log('================================================================');
}

async function main() {
    const preflightData = runPreflightAssertions();

    if (isDryRun) {
        await runDryRun(preflightData);
    } else if (isApply) {
        await runApply(preflightData);
    }
}

main().catch(err => {
    console.error('\nFATAL EXECUTION ERROR:', err.message);
    process.exit(1);
}).finally(() => {
    try { db.close(); } catch (_) {}
});
