'use strict';

/**
 * Synthetic Disposable Database Isolation & Refusal Guard
 * 
 * Ensures the browser journey runner:
 * 1. Strictly executes against an isolated, disposable SQLite database in a runner-owned temporary directory.
 * 2. Never inherits or mutates working development or production database files (prisma/dev.db).
 * 3. Fails closed with an explicit [DB_ISOLATION_REFUSAL] error if an inherited or non-isolated path is detected.
 */

const fs = require('fs');
const path = require('path');

const WORKING_DEV_DB = path.resolve(__dirname, '..', 'prisma', 'dev.db');

/**
 * Validates that a database path is strictly inside the dedicated runner directory
 * and does not point to or reference a working or production database.
 * 
 * @param {string} candidatePath - Absolute or relative path to target DB
 * @param {string} runnerDir - Absolute path to runner-owned temporary directory
 * @returns {string} Validated absolute path
 * @throws {Error} If path is invalid, outside runnerDir, or references working DB
 */
function validateDisposableDbPath(candidatePath, runnerDir) {
    if (!candidatePath || typeof candidatePath !== 'string' || candidatePath.trim() === '') {
        throw new Error('[DB_ISOLATION_REFUSAL] Candidate DATABASE_PATH is null or empty');
    }

    if (!runnerDir || typeof runnerDir !== 'string' || runnerDir.trim() === '') {
        throw new Error('[DB_ISOLATION_REFUSAL] Runner directory is null or empty');
    }

    const resolvedCandidate = path.resolve(candidatePath);
    const resolvedRunnerDir = path.resolve(runnerDir);

    // Refusal 1: Candidate cannot equal or resolve to the working dev.db
    if (resolvedCandidate.toLowerCase() === WORKING_DEV_DB.toLowerCase()) {
        throw new Error(
            `[DB_ISOLATION_REFUSAL] Refusing to touch working development database: '${resolvedCandidate}'`
        );
    }

    // Refusal 2: Candidate cannot end with 'dev.db'
    const baseName = path.basename(resolvedCandidate).toLowerCase();
    if (baseName === 'dev.db') {
        throw new Error(
            `[DB_ISOLATION_REFUSAL] Refusing database with reserved working name '${baseName}': '${resolvedCandidate}'`
        );
    }

    // Refusal 3: Path must be strictly within the runner-owned temporary directory
    const relative = path.relative(resolvedRunnerDir, resolvedCandidate);
    const isInside = !relative.startsWith('..') && !path.isAbsolute(relative);
    if (!isInside) {
        throw new Error(
            `[DB_ISOLATION_REFUSAL] Refusing non-isolated DATABASE_PATH: '${resolvedCandidate}' is not inside runner directory '${resolvedRunnerDir}'`
        );
    }

    return resolvedCandidate;
}

const child_process = require('child_process');
const Database = require('better-sqlite3');

/**
 * Creates a new schema-only database from checked-in release DDL. No working
 * database, analytical rows, credentials or installed guards are copied or wiped.
 * 
 * @returns {{ runnerDir: string, dbPath: string }}
 */
function createDisposableDatabase() {
    const runnerDir = fs.mkdtempSync(path.resolve(__dirname, '..', '.tmp_journey_runner_'));
    const disposableDbPath = validateDisposableDbPath(path.join(runnerDir, 'disposable_journey.db'), runnerDir);
    fs.closeSync(fs.openSync(disposableDbPath, 'wx'));
    const tempDb = new Database(disposableDbPath, { fileMustExist: true });
    try {
        tempDb.pragma('foreign_keys = ON');
        tempDb.transaction(() => {
            tempDb.exec(fs.readFileSync(path.resolve(__dirname, '../scripts/schema/full_application_schema.sql'), 'utf8'));
            // The full-schema snapshot already includes 1.1. Replay the actual
            // subsequent additive DDL, including the theme snapshot omission.
            for (const migration of [
                '20260930140000_add_sitewide_theme_appearance',
                '20261004033000_add_report_number_lineage',
                '20261005000000_workflow_state_evidence',
                '20261005000100_workflow_state_guards'
            ]) tempDb.exec(fs.readFileSync(path.resolve(__dirname, '../prisma/migrations', migration, 'migration.sql'), 'utf8'));
        })();
        const guardSql = fs.readFileSync(path.resolve(__dirname, '../prisma/migrations/20261005000100_workflow_state_guards/migration.sql'), 'utf8');
        const installed = tempDb.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger'").all();
        for (const match of guardSql.matchAll(/CREATE TRIGGER "([^"]+)"/g)) {
            if (!installed.some(row => row.name === match[1])) throw new Error(`[DB_ISOLATION_REFUSAL] Missing release guard ${match[1]}`);
        }
        if (tempDb.pragma('foreign_keys', { simple: true }) !== 1 || tempDb.pragma('foreign_key_check').length) {
            throw new Error('[DB_ISOLATION_REFUSAL] Fresh release schema failed foreign-key verification');
        }
    } catch (error) {
        tempDb.close();
        cleanupDisposableDatabase(runnerDir);
        throw error;
    } finally {
        if (tempDb.open) tempDb.close();
    }
    return {
        runnerDir,
        dbPath: disposableDbPath
    };
}

/**
 * Safely cleans up the runner-owned temporary directory.
 * Strictly restricted to the exact recorded owned root; preserves other active runs.
 * 
 * @param {string} runnerDir - Exact runner directory to delete
 */
function cleanupDisposableDatabase(runnerDir) {
    if (!runnerDir || typeof runnerDir !== 'string') return;
    const resolved = path.resolve(runnerDir);
    const serverDir = path.resolve(__dirname, '..');
    const relative = path.relative(serverDir, resolved);

    // Must be strictly a direct child directory of server/ with the dedicated runner prefix
    const isOwnedRunnerDir = !relative.startsWith('..') &&
                             !path.isAbsolute(relative) &&
                             !relative.includes(path.sep) &&
                             relative.startsWith('.tmp_journey_runner_');

    if (!isOwnedRunnerDir) {
        console.warn(`[DB_ISOLATION] Refusing to clean up directory outside owned runner pattern: ${resolved}`);
        return;
    }

    try {
        if (fs.existsSync(resolved)) {
            fs.rmSync(resolved, { recursive: true, force: true });
        }
    } catch (err) {
        // On Windows, active SQLite driver locks may delay release until process termination.
        // Spawn a detached cleanup helper targeting ONLY this exact resolved root with retry loop.
        try {
            const cleanerScript = `
                let attempts = 0;
                const target = process.argv[2] || process.argv[1];
                const interval = setInterval(() => {
                    try {
                        if (!require('fs').existsSync(target)) {
                            clearInterval(interval);
                            process.exit(0);
                        }
                        require('fs').rmSync(target, { recursive: true, force: true });
                        clearInterval(interval);
                        process.exit(0);
                    } catch (_) {
                        if (++attempts > 15) {
                            clearInterval(interval);
                            process.exit(1);
                        }
                    }
                }, 300);
            `;
            const cleaner = child_process.spawn(
                process.execPath,
                ['-e', cleanerScript, resolved],
                { detached: true, stdio: 'ignore' }
            );
            cleaner.unref();
        } catch (_) {
            console.warn(`[DB_ISOLATION] Warning cleaning up runner directory ${resolved}:`, err.message);
        }
    }
}

module.exports = {
    WORKING_DEV_DB,
    validateDisposableDbPath,
    createDisposableDatabase,
    cleanupDisposableDatabase
};
