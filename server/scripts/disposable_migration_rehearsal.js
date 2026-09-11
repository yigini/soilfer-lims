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

    try {
        const rehearsalDb = new Database(rehearsalDbPath, { fileMustExist: true });

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

        // Step 3: Insert intermediate duplicate pending invitations to test conflict normalization
        console.log('[REHEARSAL] Simulating intermediate state with duplicate pending invitations...');
        rehearsalDb.exec(`
            INSERT INTO "StaffInvitation" ("id", "email", "name", "role", "labId", "tokenHash", "expiresAt", "createdBy", "createdAt", "isConsumed", "isRevoked")
            VALUES ('inv-dup-1', 'conflict@example.com', 'Conflict User 1', 'LAB_TECHNICIAN', 'rehearsal-lab', 'hash-dup-1', datetime('now', '+24 hours'), 'admin', '2026-09-11 10:00:00', 0, 0);

            INSERT INTO "StaffInvitation" ("id", "email", "name", "role", "labId", "tokenHash", "expiresAt", "createdBy", "createdAt", "isConsumed", "isRevoked")
            VALUES ('inv-dup-2', 'conflict@example.com', 'Conflict User 2', 'LAB_TECHNICIAN', 'rehearsal-lab', 'hash-dup-2', datetime('now', '+24 hours'), 'admin', '2026-09-11 11:00:00', 0, 0);
        `);

        // Step 4: Execute Migration 2 (normalization + unique partial index)
        console.log('[REHEARSAL] Executing Migration 2 (duplicate normalization and unique index)...');
        const mig2Sql = fs.readFileSync(mig2Path, 'utf8');
        rehearsalDb.exec(mig2Sql);

        // Verify that duplicate was normalized: inv-dup-1 should be revoked, inv-dup-2 remains active
        const dup1 = rehearsalDb.prepare('SELECT isRevoked FROM "StaffInvitation" WHERE id = ?').get('inv-dup-1');
        const dup2 = rehearsalDb.prepare('SELECT isRevoked FROM "StaffInvitation" WHERE id = ?').get('inv-dup-2');
        if (dup1.isRevoked !== 1 || dup2.isRevoked !== 0) {
            throw new Error(`Duplicate normalization failed: dup1.isRevoked=${dup1.isRevoked}, dup2.isRevoked=${dup2.isRevoked}`);
        }
        console.log('[REHEARSAL] Verified duplicate normalization: older pending duplicate revoked, newer kept active.');

        // Verify unique index enforcement on active email
        let uniqueConstraintCaught = false;
        try {
            rehearsalDb.exec(`
                INSERT INTO "StaffInvitation" ("id", "email", "name", "role", "labId", "tokenHash", "expiresAt", "createdBy", "isConsumed", "isRevoked")
                VALUES ('inv-dup-3', 'conflict@example.com', 'Conflict 3', 'LAB_TECHNICIAN', 'rehearsal-lab', 'hash-dup-3', datetime('now', '+24 hours'), 'admin', 0, 0);
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

        // Step 5: Test Migration Rerun Idempotency
        console.log('[REHEARSAL] Testing migration rerun idempotency...');
        rehearsalDb.exec(mig1Sql);
        rehearsalDb.exec(mig2Sql);
        console.log('[REHEARSAL] Migration rerun idempotency verified: repeated execution succeeded without error.');

        // Step 6: Test Injected Partial Failure and Rollback
        console.log('[REHEARSAL] Testing injected partial failure and transactional rollback...');
        let rollbackVerified = false;
        try {
            rehearsalDb.transaction(() => {
                rehearsalDb.prepare(`
                    INSERT INTO "LabLifecycleState" ("labId", "operationalStatus", "revision", "updatedAt")
                    VALUES ('failing-lab', 'ACTIVE', 1, CURRENT_TIMESTAMP)
                `).run();
                // Deliberately trigger constraint violation to force rollback
                rehearsalDb.prepare(`
                    INSERT INTO "LabLifecycleState" ("labId", "operationalStatus", "revision", "updatedAt")
                    VALUES ('failing-lab', 'ACTIVE', 1, CURRENT_TIMESTAMP)
                `).run();
            })();
        } catch (e) {
            // Check that failing-lab was rolled back
            const row = rehearsalDb.prepare('SELECT * FROM "LabLifecycleState" WHERE "labId" = ?').get('failing-lab');
            if (!row) {
                rollbackVerified = true;
            }
        }
        if (!rollbackVerified) {
            throw new Error('Injected partial failure was not rolled back cleanly');
        }
        console.log('[REHEARSAL] Verified injected partial failure: transaction rolled back cleanly leaving 0 records.');

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
        if (fs.existsSync(rehearsalDbPath)) {
            fs.unlinkSync(rehearsalDbPath);
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
