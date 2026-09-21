#!/usr/bin/env node
/**
 * Fail-Closed, Idempotent Additive Database Migration Script for Project Templates and Policy
 *
 * Adds the following additive columns to the Project table if they are missing:
 *   - templateId TEXT DEFAULT 'GENERIC_OPEN_INTAKE'
 *   - templateVersion TEXT DEFAULT '1.0.0'
 *   - policyConfig TEXT
 *   - programmeCode TEXT
 *   - parentProjectId TEXT REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE
 *
 * Also ensures index Project_parentProjectId_idx exists.
 *
 * Preserves all existing project records, sample associations, reports, and lab data.
 * Does NOT alter or drop any existing columns.
 * Safe to run multiple times (strictly idempotent).
 */

const Database = require('better-sqlite3');
const path = require('path');

function migrateProjectTemplatesAndPolicy(dbPath, options = {}) {
    const targetDb = dbPath || process.env.DATABASE_PATH || path.join(__dirname, '..', 'prisma', 'dev.db');
    const isDryRun = options.dryRun || process.argv.includes('--dry-run');

    console.log(`[MIGRATE-PROJECT-POLICY] Target DB: ${targetDb}`);
    if (isDryRun) {
        console.log('[MIGRATE-PROJECT-POLICY] DRY RUN MODE: No schema modifications will be committed.');
    }

    const db = new Database(targetDb, { timeout: 10000 });

    try {
        db.pragma('busy_timeout = 10000');
        db.pragma('foreign_keys = ON');

        // Verify Project table exists
        const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Project'").get();
        if (!tableCheck) {
            console.log('[MIGRATE-PROJECT-POLICY] Table "Project" does not exist in target database. Skipping.');
            return { success: true, skipped: true, reason: 'Table Project does not exist' };
        }

        const existingColumns = db.prepare("PRAGMA table_info('Project')").all();
        const existingColNames = new Set(existingColumns.map(c => c.name));

        const requiredColumns = [
            {
                name: 'templateId',
                definition: 'TEXT DEFAULT \'GENERIC_OPEN_INTAKE\'',
                defaultValue: 'GENERIC_OPEN_INTAKE'
            },
            {
                name: 'templateVersion',
                definition: 'TEXT DEFAULT \'1.0.0\'',
                defaultValue: '1.0.0'
            },
            {
                name: 'policyConfig',
                definition: 'TEXT',
                defaultValue: null
            },
            {
                name: 'programmeCode',
                definition: 'TEXT',
                defaultValue: null
            },
            {
                name: 'parentProjectId',
                definition: 'TEXT REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE',
                defaultValue: null
            }
        ];

        const missingColumns = requiredColumns.filter(c => !existingColNames.has(c.name));

        if (missingColumns.length === 0) {
            console.log('[MIGRATE-PROJECT-POLICY] All project template & policy columns already exist. Verification successful (no-op).');
            const totalCount = db.prepare('SELECT count(*) as total FROM "Project"').get()?.total || 0;
            return { success: true, applied: false, missingColumns: [], totalProjects: totalCount };
        }

        console.log(`[MIGRATE-PROJECT-POLICY] Found ${missingColumns.length} missing column(s): ${missingColumns.map(c => c.name).join(', ')}`);

        if (isDryRun) {
            return { success: true, dryRun: true, missingColumns: missingColumns.map(c => c.name) };
        }

        const beforeCount = db.prepare('SELECT count(*) as total FROM "Project"').get()?.total || 0;

        // Apply additive ALTER TABLE statements inside transaction
        const migrationTx = db.transaction(() => {
            for (const col of missingColumns) {
                console.log(`[MIGRATE-PROJECT-POLICY] Adding column "${col.name}" (${col.definition}) to Project table...`);
                db.exec(`ALTER TABLE "Project" ADD COLUMN "${col.name}" ${col.definition}`);
            }

            // Create index on parentProjectId if not already present
            db.exec('CREATE INDEX IF NOT EXISTS "Project_parentProjectId_idx" ON "Project"("parentProjectId")');
        });

        migrationTx();
        console.log('[MIGRATE-PROJECT-POLICY] All missing columns and indexes successfully added.');

        // Post-migration integrity verification
        const postColumns = db.prepare("PRAGMA table_info('Project')").all();
        const postColNames = new Set(postColumns.map(c => c.name));
        for (const col of requiredColumns) {
            if (!postColNames.has(col.name)) {
                throw new Error(`[MIGRATE-PROJECT-POLICY] Post-migration check failed: column "${col.name}" is still missing.`);
            }
        }

        const afterCount = db.prepare('SELECT count(*) as total FROM "Project"').get()?.total || 0;
        if (beforeCount !== afterCount) {
            throw new Error(`[MIGRATE-PROJECT-POLICY] Row count mismatch: before=${beforeCount}, after=${afterCount}`);
        }

        // Verify foreign key integrity
        const fkIssues = db.prepare('PRAGMA foreign_key_check("Project")').all();
        if (fkIssues.length > 0) {
            throw new Error(`[MIGRATE-PROJECT-POLICY] Foreign key check failed: ${JSON.stringify(fkIssues)}`);
        }

        console.log(`[MIGRATE-PROJECT-POLICY] Migration verified successfully. ${afterCount} Project records preserved.`);
        return {
            success: true,
            applied: true,
            addedColumns: missingColumns.map(c => c.name),
            totalProjects: afterCount
        };
    } catch (err) {
        console.error('[MIGRATE-PROJECT-POLICY] Migration error:', err.message);
        throw err;
    } finally {
        db.close();
    }
}

if (require.main === module) {
    try {
        migrateProjectTemplatesAndPolicy();
        console.log('[MIGRATE-PROJECT-POLICY] Process exited normally.');
        process.exit(0);
    } catch (e) {
        console.error('[MIGRATE-PROJECT-POLICY] Fatal migration failure:', e);
        process.exit(1);
    }
}

module.exports = { migrateProjectTemplatesAndPolicy };
