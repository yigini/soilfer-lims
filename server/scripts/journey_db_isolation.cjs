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
 * Creates a dedicated disposable database by copying schema/template from dev.db
 * into a unique runner-owned temporary directory, and wiping all copied records
 * to guarantee a clean schema-only synthetic fixture environment.
 * 
 * @returns {{ runnerDir: string, dbPath: string }}
 */
function createDisposableDatabase() {
    const timestamp = Date.now();
    const nonce = Math.random().toString(36).slice(2, 8);
    const runnerDirName = `.tmp_journey_runner_${timestamp}_${nonce}`;
    const runnerDir = path.resolve(__dirname, '..', runnerDirName);

    fs.mkdirSync(runnerDir, { recursive: true });

    const disposableDbPath = path.join(runnerDir, `disposable_journey_${nonce}.db`);

    // Copy template schema if dev.db exists
    if (fs.existsSync(WORKING_DEV_DB)) {
        fs.copyFileSync(WORKING_DEV_DB, disposableDbPath);
    } else {
        throw new Error(`[DB_ISOLATION_REFUSAL] Source database template '${WORKING_DEV_DB}' not found`);
    }

    // Wipe all copied data rows to guarantee a schema-only synthetic database.
    // This strictly prevents executing copied Kobo/integration configs or using real credentials.
    const tempDb = new Database(disposableDbPath);
    try {
        tempDb.pragma('foreign_keys = OFF');
        const userTables = tempDb.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'"
        ).all();
        for (const { name } of userTables) {
            tempDb.prepare(`DELETE FROM "${name}"`).run();
        }
        tempDb.pragma('foreign_keys = ON');
    } finally {
        tempDb.close();
    }

    const validatedPath = validateDisposableDbPath(disposableDbPath, runnerDir);

    return {
        runnerDir,
        dbPath: validatedPath
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
                const target = process.argv[1];
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
