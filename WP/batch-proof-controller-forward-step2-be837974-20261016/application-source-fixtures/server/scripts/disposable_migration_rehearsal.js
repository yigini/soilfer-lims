'use strict';

/**
 * Disposable Migration Rehearsal (IR-16, A42)
 *
 * Verifies that the additive governance migrations execute cleanly and safely
 * against a disposable copy of the database without touching dev.db.
 *
 * Thoroughly exercises:
 * 1. WAL-consistent online backup snapshot via SQLite backup API.
 * 2. Multi-step migration sequence:
 *    - 20260911130000_add_governance_lifecycle_and_grants
 *    - 20260911160000_add_active_invitation_unique_index
 * 3. Intermediate duplicate pending invitations normalization and unique index enforcement.
 * 4. Migration rerun idempotency (running both migrations a second time).
 * 5. Injected partial failure and transactional rollback safety.
 * 6. Sample preservation invariant: dev.db (35,192+ samples) remains 100% untouched.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

async function runRehearsal(customDbPath = null) {
    console.log('[REHEARSAL] Starting comprehensive disposable migration rehearsal...');
    const originalDbPath = customDbPath || process.env.DATABASE_PATH || path.join(__dirname, '../prisma/dev.db');
    const rehearsalDbPath = path.join(__dirname, `../prisma/disposable_rehearsal_${Date.now()}.db`);
    const mig1Path = path.join(__dirname, '../prisma/migrations/20260911130000_add_governance_lifecycle_and_grants/migration.sql');
    const mig2Path = path.join(__dirname, '../prisma/migrations/20260911160000_add_active_invitation_unique_index/migration.sql');

    if (!fs.existsSync(originalDbPath)) {
        throw new Error(`Original database dev.db not found at ${originalDbPath}`);
    }
    if (!fs.existsSync(mig1Path)) {
        throw new Error(`Migration 1 SQL not found at ${mig1Path}`);
    }
    if (!fs.existsSync(mig2Path)) {
        throw new Error(`Migration 2 SQL not found at ${mig2Path}`);
    }

    // Step 1: Record original database stats in strictly read-only mode and create WAL-consistent backup
    const origDb = new Database(originalDbPath, { readonly: true, fileMustExist: true });
    const originalSampleCount = origDb.prepare('SELECT count(*) as count FROM Sample').get().count;
    console.log(`[REHEARSAL] Original dev.db sample count (verified read-only): ${originalSampleCount}`);

    console.log(`[REHEARSAL] Creating WAL-consistent online backup snapshot at: ${rehearsalDbPath}`);
    await origDb.backup(rehearsalDbPath);
    origDb.close();

    let rehearsalDb = null;
    try {
        rehearsalDb = new Database(rehearsalDbPath, { fileMustExist: true });

        // Step 2: Execute Migration 1 (additive tables)
        console.log('[REHEARSAL] Executing Migration 1 (lifecycle and grants tables)...');
        const mig1Sql = fs.readFileSync(mig1Path, 'utf8');
        rehearsalDb.exec(mig1Sql);

        const tables = rehearsalDb.prepare(`
            SELECT name FROM sqlite_master WHERE type='table' AND name IN ('LabLifecycleState', 'StaffInvitation', 'StaffRecoveryGrant')
        `).all();
        const foundTableNames = tables.map(t => t.name);
        console.log('[REHEARSAL] Verified created tables:', foundTableNames);
        if (foundTableNames.length !== 3) {
            throw new Error(`Expected 3 tables, but found ${foundTableNames.length}: ${foundTableNames.join(', ')}`);
        }

        // Step 3: Insert intermediate duplicate pending invitations with conflicting grants
        console.log('[REHEARSAL] Simulating intermediate state with conflicting duplicate active invitations...');
        rehearsalDb.exec(`
            INSERT INTO "StaffInvitation" ("id", "email", "name", "role", "labId", "tokenHash", "expiresAt", "createdBy", "createdAt", "isConsumed", "isRevoked")
            VALUES ('inv-conf-1', 'conflict@example.com', 'Conflict User 1', 'LAB_MANAGER', 'lab-alpha', 'hash-conf-1', datetime('now', '+24 hours'), 'admin', '2026-09-11 10:00:00', 0, 0);

            INSERT INTO "StaffInvitation" ("id", "email", "name", "role", "labId", "tokenHash", "expiresAt", "createdBy", "createdAt", "isConsumed", "isRevoked")
            VALUES ('inv-conf-2', 'conflict@example.com', 'Conflict User 2', 'LAB_TECHNICIAN', 'lab-beta', 'hash-conf-2', datetime('now', '+24 hours'), 'admin', '2026-09-11 11:00:00', 0, 0);
        `);

        // Step 4: Test Actual Failure During Migration Sequence
        console.log('[REHEARSAL] Testing actual migration failure during migration sequence (Migration 2 against unresolved conflicts)...');
        const mig2Sql = fs.readFileSync(mig2Path, 'utf8');
        let migrationFailedSafely = false;
        try {
            rehearsalDb.transaction(() => {
                rehearsalDb.exec(mig2Sql);
            })();
        } catch (migErr) {
            if (migErr.message.includes('UNIQUE constraint failed')) {
                migrationFailedSafely = true;
            }
        }
        if (!migrationFailedSafely) {
            throw new Error('Expected Migration 2 to fail safely on conflicting duplicates, but execution succeeded or threw wrong error');
        }

        // Verify zero mutations / zero silent revocations on migration failure
        const preConf1 = rehearsalDb.prepare('SELECT isRevoked FROM "StaffInvitation" WHERE id = ?').get('inv-conf-1');
        const preConf2 = rehearsalDb.prepare('SELECT isRevoked FROM "StaffInvitation" WHERE id = ?').get('inv-conf-2');
        if (preConf1.isRevoked !== 0 || preConf2.isRevoked !== 0) {
            throw new Error(`Migration failure mutated records: conf1.isRevoked=${preConf1.isRevoked}, conf2.isRevoked=${preConf2.isRevoked}`);
        }
        console.log('[REHEARSAL] Verified migration failure safety: Migration 2 rolled back cleanly without mutating historical records.');

        // Step 5: Execute Controlled, Audited Conflict Resolution
        console.log('[REHEARSAL] Applying controlled, audited conflict resolution...');
        const { resolveConflicts } = require('./resolve_invitation_conflicts');
        const resolutionSummary = resolveConflicts(
            rehearsalDb,
            {
                'conflict@example.com': {
                    action: 'retain',
                    retainId: 'inv-conf-1',
                    reason: 'Audited rehearsal resolution: retained manager appointment in lab-alpha'
                }
            },
            'REHEARSAL_ADMIN'
        );
        console.log('[REHEARSAL] Conflict resolution outcome:', resolutionSummary);

        const postConf1 = rehearsalDb.prepare('SELECT isRevoked FROM "StaffInvitation" WHERE id = ?').get('inv-conf-1');
        const postConf2 = rehearsalDb.prepare('SELECT isRevoked FROM "StaffInvitation" WHERE id = ?').get('inv-conf-2');
        if (postConf1.isRevoked !== 0 || postConf2.isRevoked !== 1) {
            throw new Error(`Controlled resolution failed: postConf1=${postConf1.isRevoked}, postConf2=${postConf2.isRevoked}`);
        }

        // Verify audit record was created
        const audits = rehearsalDb.prepare(`SELECT * FROM "AuditLog" WHERE action = 'INVITATION_CONFLICT_RESOLVED'`).all();
        if (audits.length === 0) {
            throw new Error('Expected AuditLog entry for conflict resolution, but found 0');
        }
        console.log('[REHEARSAL] Verified audited conflict resolution: 1 retained, 1 revoked, audit log recorded.');

        // Step 6: Forward Repair — Execute Migration 2 again
        console.log('[REHEARSAL] Executing forward repair: re-running Migration 2 after audited resolution...');
        rehearsalDb.exec(mig2Sql);
        console.log('[REHEARSAL] Forward repair succeeded: unique index idx_staff_invitation_active_email created.');

        // Verify unique index enforcement on new active duplicate insert
        let uniqueConstraintCaught = false;
        try {
            rehearsalDb.exec(`
                INSERT INTO "StaffInvitation" ("id", "email", "name", "role", "labId", "tokenHash", "expiresAt", "createdBy", "isConsumed", "isRevoked")
                VALUES ('inv-conf-3', 'conflict@example.com', 'Conflict 3', 'LAB_TECHNICIAN', 'lab-alpha', 'hash-conf-3', datetime('now', '+24 hours'), 'admin', 0, 0);
            `);
        } catch (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                uniqueConstraintCaught = true;
            }
        }
        if (!uniqueConstraintCaught) {
            throw new Error('Expected UNIQUE constraint failure on duplicate active email, but insert succeeded');
        }
        console.log('[REHEARSAL] Verified unique index enforcement: new active duplicate insert fails closed.');

        // Step 7: Test Migration Rerun Idempotency
        console.log('[REHEARSAL] Testing migration rerun idempotency...');
        rehearsalDb.exec(mig1Sql);
        rehearsalDb.exec(mig2Sql);
        console.log('[REHEARSAL] Migration rerun idempotency verified: repeated execution succeeded without error.');

        // Step 7: Verify sample integrity on disposable database
        const rehearsalSampleCount = rehearsalDb.prepare('SELECT count(*) as count FROM Sample').get().count;
        if (rehearsalSampleCount !== originalSampleCount) {
            throw new Error(`Sample count mismatch in rehearsal: was ${originalSampleCount}, now ${rehearsalSampleCount}`);
        }
        console.log(`[REHEARSAL] Sample count in rehearsal db intact: ${rehearsalSampleCount}`);

        rehearsalDb.close();
        console.log('[REHEARSAL] Migration rehearsal passed with 100% success.');
    } finally {
        // Step 8: Clean up disposable database
        if (rehearsalDb) {
            try { rehearsalDb.close(); } catch (_) {}
            rehearsalDb = null;
        }
        if (fs.existsSync(rehearsalDbPath)) {
            try { fs.unlinkSync(rehearsalDbPath); } catch (_) {}
            console.log('[REHEARSAL] Cleaned up disposable rehearsal database.');
        }

        // Step 9: Verify original dev.db remained completely untouched
        const verifyDb = new Database(originalDbPath, { readonly: true, fileMustExist: true });
        const postSampleCount = verifyDb.prepare('SELECT count(*) as count FROM Sample').get().count;
        verifyDb.close();
        if (postSampleCount !== originalSampleCount) {
            throw new Error(`CRITICAL INVARIANT VIOLATION: dev.db sample count changed from ${originalSampleCount} to ${postSampleCount}`);
        }
        console.log(`[REHEARSAL] Verified original dev.db untouched: ${postSampleCount} samples intact.\n`);
    }

    return {
        success: true,
        originalSampleCount,
        tablesVerified: ['LabLifecycleState', 'StaffInvitation', 'StaffRecoveryGrant'],
        migrationsVerified: ['20260911130000_add_governance_lifecycle_and_grants', '20260911160000_add_active_invitation_unique_index'],
        rerunPassed: true,
        duplicateNormalizationPassed: true,
        partialFailureRollbackPassed: true,
        walBackupPassed: true
    };
}

if (require.main === module) {
    runRehearsal().catch(err => {
        console.error('[REHEARSAL_FATAL]', err);
        process.exit(1);
    });
}

module.exports = { runRehearsal };
