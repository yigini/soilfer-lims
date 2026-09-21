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

/**
 * Sweeps any orphaned runner directories from past runs if unlocked.
 */
function sweepStaleRunnerDirs() {
    try {
        const serverDir = path.resolve(__dirname, '..');
        const entries = fs.readdirSync(serverDir);
        for (const entry of entries) {
            if (entry.startsWith('.tmp_journey_runner_') && !entry.includes('refusal_test')) {
                const target = path.join(serverDir, entry);
                try {
                    fs.rmSync(target, { recursive: true, force: true });
                } catch (_) {}
            }
        }
    } catch (_) {}
}

/**
 * Creates a dedicated disposable database by copying schema/template from dev.db
 * into a unique runner-owned temporary directory.
 * 
 * @returns {{ runnerDir: string, dbPath: string }}
 */
function createDisposableDatabase() {
    sweepStaleRunnerDirs();

    const timestamp = Date.now();
    const nonce = Math.random().toString(36).slice(2, 8);
    const runnerDirName = `.tmp_journey_runner_${timestamp}_${nonce}`;
    const runnerDir = path.resolve(__dirname, '..', runnerDirName);

    fs.mkdirSync(runnerDir, { recursive: true });

    const disposableDbPath = path.join(runnerDir, `disposable_journey_${nonce}.db`);

    // Copy template schema if dev.db exists, otherwise initialize empty
    if (fs.existsSync(WORKING_DEV_DB)) {
        fs.copyFileSync(WORKING_DEV_DB, disposableDbPath);
    } else {
        throw new Error(`[DB_ISOLATION_REFUSAL] Source database template '${WORKING_DEV_DB}' not found`);
    }

    const validatedPath = validateDisposableDbPath(disposableDbPath, runnerDir);

    return {
        runnerDir,
        dbPath: validatedPath
    };
}

/**
 * Safely cleans up the runner-owned temporary directory.
 * Refuses to delete anything outside the designated temporary prefix.
 * 
 * @param {string} runnerDir - Runner directory to delete
 */
function cleanupDisposableDatabase(runnerDir) {
    if (!runnerDir || typeof runnerDir !== 'string') return;
    const resolved = path.resolve(runnerDir);
    const base = path.basename(resolved);

    // Refuse cleanup if not matching the dedicated disposable runner prefix
    if (!base.startsWith('.tmp_journey_runner_')) {
        console.warn(`[DB_ISOLATION] Refusing to clean up directory without expected prefix: ${resolved}`);
        return;
    }

    try {
        if (fs.existsSync(resolved)) {
            fs.rmSync(resolved, { recursive: true, force: true });
        }
    } catch (err) {
        // On Windows, active SQLite driver locks may delay release until process termination.
        // Spawn a detached cleanup helper to remove the directory as soon as this process exits.
        try {
            const cleaner = child_process.spawn(
                process.execPath,
                ['-e', `setTimeout(() => { try { require('fs').rmSync(process.argv[1], { recursive: true, force: true }); } catch (_) {} }, 400);`, resolved],
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
