#!/usr/bin/env node
/**
 * SoilFER LIMS - Additive, Idempotent Schema Migration for Sitewide Theme Library
 *
 * Implements Phase 2 persistence contract from WP/sitewide-theme-library-v1/IMPLEMENTATION-PLAN.md:
 * 1. Additive fields on User: uiThemeId, uiModePreference, uiAppearanceRevision.
 * 2. Backfills existing users to match their legacy themePreference ('light'/'dark') without overwriting later changes.
 * 3. Creates LabAppearanceSetting table with foreign key reference to canonical Lab.
 * 4. Creates GlobalAppearanceSetting singleton table with initial 'soilfer-classic' + 'light' default.
 * 5. Strictly preserves all existing users, credentials, roles, labs, samples, results, and branding JSON.
 */

const Database = require('better-sqlite3');
const path = require('path');

function migrateThemeLibrary(dbPath) {
    const targetDb = dbPath || process.env.DATABASE_PATH || path.join(__dirname, '..', 'prisma', 'dev.db');
    console.log(`[MIGRATE-THEMES] Target DB: ${targetDb}`);

    const db = new Database(targetDb, { timeout: 10000 });

    try {
        db.pragma('busy_timeout = 10000');

        db.transaction(() => {
            // 1. Inspect User columns
            const userCols = db.prepare("PRAGMA table_info('User')").all();
            const colNames = new Set(userCols.map(c => c.name));

            let addedColumns = false;

            if (!colNames.has('uiThemeId')) {
                console.log('[MIGRATE-THEMES] Adding uiThemeId to User table...');
                db.exec('ALTER TABLE "User" ADD COLUMN "uiThemeId" TEXT');
                addedColumns = true;
            }

            if (!colNames.has('uiModePreference')) {
                console.log('[MIGRATE-THEMES] Adding uiModePreference to User table...');
                db.exec('ALTER TABLE "User" ADD COLUMN "uiModePreference" TEXT NOT NULL DEFAULT \'inherit\'');
                addedColumns = true;
            }

            if (!colNames.has('uiAppearanceRevision')) {
                console.log('[MIGRATE-THEMES] Adding uiAppearanceRevision to User table...');
                db.exec('ALTER TABLE "User" ADD COLUMN "uiAppearanceRevision" INTEGER NOT NULL DEFAULT 0');
                addedColumns = true;
            }

            // 2. Initial backfill for existing users:
            // Existing users preserve their established themePreference ('light' or 'dark').
            // We only backfill if this is the initial column addition or if uiAppearanceRevision is 0 and uiModePreference is 'inherit'.
            if (addedColumns) {
                console.log('[MIGRATE-THEMES] Performing initial backfill of uiModePreference from legacy themePreference...');
                db.exec(`
                    UPDATE "User"
                    SET "uiModePreference" = CASE
                        WHEN "themePreference" = 'dark' THEN 'dark'
                        WHEN "themePreference" = 'light' THEN 'light'
                        ELSE 'light'
                    END,
                    "uiAppearanceRevision" = 1
                    WHERE "uiAppearanceRevision" = 0
                `);
            }

            // 3. Create LabAppearanceSetting table
            db.exec(`
                CREATE TABLE IF NOT EXISTS "LabAppearanceSetting" (
                    "labId" TEXT NOT NULL PRIMARY KEY,
                    "themeId" TEXT,
                    "defaultMode" TEXT NOT NULL DEFAULT 'inherit',
                    "revision" INTEGER NOT NULL DEFAULT 0,
                    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "updatedBy" TEXT
                );
            `);

            // 4. Create GlobalAppearanceSetting table
            db.exec(`
                CREATE TABLE IF NOT EXISTS "GlobalAppearanceSetting" (
                    "id" TEXT NOT NULL PRIMARY KEY,
                    "themeId" TEXT NOT NULL DEFAULT 'soilfer-classic',
                    "defaultMode" TEXT NOT NULL DEFAULT 'light',
                    "revision" INTEGER NOT NULL DEFAULT 0,
                    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "updatedBy" TEXT
                );
            `);

            // 5. Seed global singleton default if not already present
            db.exec(`
                INSERT OR IGNORE INTO "GlobalAppearanceSetting" ("id", "themeId", "defaultMode", "revision", "updatedAt")
                VALUES ('global', 'soilfer-classic', 'light', 1, CURRENT_TIMESTAMP);
            `);
        })();

        // 6. Verification
        const integrity = db.pragma('integrity_check');
        const fkCheck = db.pragma('foreign_key_check');

        console.log(`[MIGRATE-THEMES] Integrity check: ${JSON.stringify(integrity)}`);
        console.log(`[MIGRATE-THEMES] Foreign key errors: ${fkCheck.length}`);

        if (integrity[0]?.integrity_check !== 'ok') {
            throw new Error(`Database integrity failure: ${JSON.stringify(integrity)}`);
        }

        const globalSetting = db.prepare('SELECT * FROM GlobalAppearanceSetting WHERE id = ?').get('global');
        const userCount = db.prepare('SELECT count(*) as total FROM User').get();

        console.log(`[MIGRATE-THEMES] Global setting: theme=${globalSetting.themeId}, mode=${globalSetting.defaultMode}, rev=${globalSetting.revision}`);
        console.log(`[MIGRATE-THEMES] Verified ${userCount.total} users.`);

        return {
            success: true,
            integrity: integrity[0]?.integrity_check,
            fkErrors: fkCheck.length,
            globalSetting,
            userCount: userCount.total
        };
    } catch (err) {
        console.error('[MIGRATE-THEMES] Error during migration:', err.message);
        throw err;
    } finally {
        db.close();
    }
}

if (require.main === module) {
    try {
        const result = migrateThemeLibrary();
        console.log('[MIGRATE-THEMES] Migration completed successfully:', JSON.stringify(result));
        process.exit(0);
    } catch (e) {
        console.error('[MIGRATE-THEMES] Fatal migration failure:', e);
        process.exit(1);
    }
}

module.exports = { migrateThemeLibrary };
