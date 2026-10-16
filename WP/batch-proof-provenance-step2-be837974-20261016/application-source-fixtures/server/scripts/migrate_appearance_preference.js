#!/usr/bin/env node
/**
 * Additive, Idempotent Database Migration Script for User Theme Preference
 *
 * Adds themePreference TEXT NOT NULL DEFAULT 'light' to the User table.
 * Preserves all existing user records, roles, passwords, and laboratory data.
 * Safe to run multiple times (idempotent).
 */

const Database = require('better-sqlite3');
const path = require('path');

function migrateAppearancePreference(dbPath) {
    const targetDb = dbPath || process.env.DATABASE_PATH || path.join(__dirname, '..', 'prisma', 'dev.db');
    console.log(`[MIGRATE-APPEARANCE] Target DB: ${targetDb}`);

    const db = new Database(targetDb, { timeout: 5000 });

    try {
        db.pragma('busy_timeout = 5000');
        const columns = db.prepare("PRAGMA table_info('User')").all();
        const hasThemePreference = columns.some(c => c.name === 'themePreference');

        if (!hasThemePreference) {
            console.log('[MIGRATE-APPEARANCE] Adding themePreference column to User table...');
            db.exec('ALTER TABLE "User" ADD COLUMN "themePreference" TEXT NOT NULL DEFAULT \'light\'');
            console.log('[MIGRATE-APPEARANCE] Column themePreference added successfully with default "light".');
        } else {
            console.log('[MIGRATE-APPEARANCE] Column themePreference already exists on User table. Skipping ALTER.');
        }

        // Verify count of existing users and ensure default value is set
        const count = db.prepare("SELECT count(*) as total FROM User WHERE themePreference IS NOT NULL").get();
        console.log(`[MIGRATE-APPEARANCE] Verification: ${count.total} users have valid themePreference.`);

        return { success: true, count: count.total };
    } catch (err) {
        console.error('[MIGRATE-APPEARANCE] Error during migration:', err.message);
        throw err;
    } finally {
        db.close();
    }
}

if (require.main === module) {
    try {
        migrateAppearancePreference();
        console.log('[MIGRATE-APPEARANCE] Migration completed successfully.');
        process.exit(0);
    } catch (e) {
        console.error('[MIGRATE-APPEARANCE] Fatal migration failure:', e);
        process.exit(1);
    }
}

module.exports = { migrateAppearancePreference };
