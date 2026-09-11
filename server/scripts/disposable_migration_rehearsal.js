'use strict';

/**
 * Disposable Migration Rehearsal (IR-16)
 *
 * Verifies that the additive governance migration executes cleanly and safely
 * against a disposable copy of the database without touching dev.db.
 *
 * Invariants:
 * 1. Zero sample loss: server/prisma/dev.db (35,192+ samples) remains 100% untouched.
 * 2. Additive tables LabLifecycleState, StaffInvitation, and StaffRecoveryGrant created cleanly.
 * 3. Disposable rehearsal database is cleaned up upon completion.
 */

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

async function runRehearsal() {
    console.log('[REHEARSAL] Starting disposable migration rehearsal...');
    const originalDbPath = path.join(__dirname, '../prisma/dev.db');
    const rehearsalDbPath = path.join(__dirname, `../prisma/disposable_rehearsal_${Date.now()}.db`);
    const migrationSqlPath = path.join(__dirname, '../prisma/migrations/20260911130000_add_governance_lifecycle_and_grants/migration.sql');

    if (!fs.existsSync(originalDbPath)) {
        throw new Error(`Original database dev.db not found at ${originalDbPath}`);
    }

    if (!fs.existsSync(migrationSqlPath)) {
        throw new Error(`Migration SQL not found at ${migrationSqlPath}`);
    }

    // Step 1: Record original database stats in strictly read-only mode
    const origDb = new DatabaseSync(originalDbPath, { readOnly: true });
    const originalSampleCount = origDb.prepare('SELECT count(*) as count FROM Sample').get().count;
    origDb.close();
    console.log(`[REHEARSAL] Original dev.db sample count (verified read-only): ${originalSampleCount}`);

    try {
        // Step 2: Create disposable copy
        console.log(`[REHEARSAL] Creating disposable rehearsal database at: ${rehearsalDbPath}`);
        fs.copyFileSync(originalDbPath, rehearsalDbPath);

        // Step 3: Run migration on disposable copy
        console.log('[REHEARSAL] Executing additive migration on disposable database...');
        const migrationSql = fs.readFileSync(migrationSqlPath, 'utf8');
        const rehearsalDb = new DatabaseSync(rehearsalDbPath);
        
        rehearsalDb.exec(migrationSql);
        console.log('[REHEARSAL] Migration SQL executed successfully.');

        // Step 4: Verify new tables exist and are functional
        const tables = rehearsalDb.prepare(`
            SELECT name FROM sqlite_master WHERE type='table' AND name IN ('LabLifecycleState', 'StaffInvitation', 'StaffRecoveryGrant')
        `).all();
        const foundTableNames = tables.map(t => t.name);
        console.log('[REHEARSAL] Verified created tables:', foundTableNames);
        if (foundTableNames.length !== 3) {
            throw new Error(`Expected 3 tables, but found ${foundTableNames.length}: ${foundTableNames.join(', ')}`);
        }

        // Step 5: Test insert and query on each new table
        rehearsalDb.exec(`
            INSERT INTO "LabLifecycleState" ("labId", "operationalStatus", "revision", "updatedAt")
            VALUES ('rehearsal-lab-1', 'SETUP', 1, CURRENT_TIMESTAMP);

            INSERT INTO "StaffInvitation" ("id", "email", "name", "role", "labId", "tokenHash", "expiresAt", "createdBy")
            VALUES ('inv-rehearsal-1', 'test@example.com', 'Test User', 'LAB_TECHNICIAN', 'rehearsal-lab-1', 'hash-12345', datetime('now', '+24 hours'), 'admin');

            INSERT INTO "StaffRecoveryGrant" ("id", "userId", "tokenHash", "expiresAt", "createdBy")
            VALUES ('rec-rehearsal-1', 'user-1', 'rec-hash-12345', datetime('now', '+1 hour'), 'admin');
        `);

        const insertedState = rehearsalDb.prepare('SELECT * FROM "LabLifecycleState" WHERE "labId" = ?').get('rehearsal-lab-1');
        if (!insertedState || insertedState.operationalStatus !== 'SETUP') {
            throw new Error('Failed to verify LabLifecycleState record');
        }

        const insertedInv = rehearsalDb.prepare('SELECT * FROM "StaffInvitation" WHERE "id" = ?').get('inv-rehearsal-1');
        if (!insertedInv || insertedInv.email !== 'test@example.com') {
            throw new Error('Failed to verify StaffInvitation record');
        }

        const insertedRec = rehearsalDb.prepare('SELECT * FROM "StaffRecoveryGrant" WHERE "id" = ?').get('rec-rehearsal-1');
        if (!insertedRec || insertedRec.userId !== 'user-1') {
            throw new Error('Failed to verify StaffRecoveryGrant record');
        }

        // Step 6: Verify sample integrity on disposable database
        const rehearsalSampleCount = rehearsalDb.prepare('SELECT count(*) as count FROM Sample').get().count;
        if (rehearsalSampleCount !== originalSampleCount) {
            throw new Error(`Sample count mismatch in rehearsal: was ${originalSampleCount}, now ${rehearsalSampleCount}`);
        }
        console.log(`[REHEARSAL] Sample count in rehearsal db intact: ${rehearsalSampleCount}`);

        rehearsalDb.close();
        console.log('[REHEARSAL] Migration rehearsal passed with 100% success.');
    } finally {
        // Step 7: Clean up disposable database
        if (fs.existsSync(rehearsalDbPath)) {
            fs.unlinkSync(rehearsalDbPath);
            console.log('[REHEARSAL] Cleaned up disposable rehearsal database.');
        }

        // Step 8: Verify original dev.db remained completely untouched
        const verifyDb = new DatabaseSync(originalDbPath, { readOnly: true });
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
        tablesVerified: ['LabLifecycleState', 'StaffInvitation', 'StaffRecoveryGrant']
    };
}

if (require.main === module) {
    runRehearsal().catch(err => {
        console.error('[REHEARSAL_FATAL]', err);
        process.exit(1);
    });
}

module.exports = { runRehearsal };
