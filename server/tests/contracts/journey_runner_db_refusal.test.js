'use strict';

/**
 * Contract Test: Browser Journey Runner Database Isolation & Refusal Guard
 *
 * Verifies:
 * 1. validateDisposableDbPath rejects empty or null paths.
 * 2. validateDisposableDbPath rejects direct references to server/prisma/dev.db.
 * 3. validateDisposableDbPath rejects any database ending with dev.db.
 * 4. validateDisposableDbPath rejects database paths outside the designated disposable runner directory.
 * 5. validateDisposableDbPath accepts a properly isolated candidate inside runnerDir.
 * 6. createDisposableDatabase copies schema safely and returns a validated disposable path.
 * 7. cleanupDisposableDatabase removes the temporary runner directory and refuses to delete non-runner paths.
 * 8. Inherited working database path cannot be executed by the runner (fails closed).
 */

const fs = require('fs');
const path = require('path');
const {
    WORKING_DEV_DB,
    validateDisposableDbPath,
    createDisposableDatabase,
    cleanupDisposableDatabase
} = require('../../scripts/journey_db_isolation.cjs');

describe('Browser Journey Database Isolation & Refusal Contract', () => {
    const tempTestDir = path.resolve(__dirname, '../..', '.tmp_journey_runner_test_' + Date.now());

    beforeAll(() => {
        fs.mkdirSync(tempTestDir, { recursive: true });
    });

    afterAll(() => {
        if (fs.existsSync(tempTestDir)) {
            fs.rmSync(tempTestDir, { recursive: true, force: true });
        }
    });

    test('1. Rejects null, undefined, or whitespace candidate paths', () => {
        expect(() => validateDisposableDbPath(null, tempTestDir)).toThrow('[DB_ISOLATION_REFUSAL]');
        expect(() => validateDisposableDbPath('', tempTestDir)).toThrow('[DB_ISOLATION_REFUSAL]');
        expect(() => validateDisposableDbPath('   ', tempTestDir)).toThrow('[DB_ISOLATION_REFUSAL]');
    });

    test('2. Refuses direct reference to working development database (dev.db)', () => {
        expect(() => validateDisposableDbPath(WORKING_DEV_DB, tempTestDir)).toThrow('[DB_ISOLATION_REFUSAL]');
        expect(() => validateDisposableDbPath(WORKING_DEV_DB, tempTestDir)).toThrow(/working development database/i);
    });

    test('3. Refuses any database path ending with reserved "dev.db" name', () => {
        const fakeDevDbInside = path.join(tempTestDir, 'dev.db');
        expect(() => validateDisposableDbPath(fakeDevDbInside, tempTestDir)).toThrow('[DB_ISOLATION_REFUSAL]');
        expect(() => validateDisposableDbPath(fakeDevDbInside, tempTestDir)).toThrow(/reserved working name/i);
    });

    test('4. Refuses candidate database located outside runner temporary directory', () => {
        const outsideDb = path.resolve(__dirname, '..', 'fixtures', 'outside.db');
        expect(() => validateDisposableDbPath(outsideDb, tempTestDir)).toThrow('[DB_ISOLATION_REFUSAL]');
        expect(() => validateDisposableDbPath(outsideDb, tempTestDir)).toThrow(/not inside runner directory/i);
    });

    test('5. Accepts valid isolated database strictly inside runner temporary directory', () => {
        const validDb = path.join(tempTestDir, 'disposable_journey_sample.db');
        const result = validateDisposableDbPath(validDb, tempTestDir);
        expect(result).toBe(validDb);
    });

    test('6. createDisposableDatabase safely creates isolated DB, validates path, and ensures schema-only fixtures', () => {
        const { runnerDir, dbPath } = createDisposableDatabase();
        try {
            expect(fs.existsSync(runnerDir)).toBe(true);
            expect(fs.existsSync(dbPath)).toBe(true);
            expect(dbPath.startsWith(runnerDir)).toBe(true);
            expect(path.basename(dbPath)).not.toBe('dev.db');

            // Verify that all copied data rows were wiped for a schema-only synthetic database
            const Database = require('better-sqlite3');
            const testDb = new Database(dbPath);
            const koboCount = testDb.prepare("SELECT COUNT(*) as c FROM KoboConfig").get().c;
            const userCount = testDb.prepare("SELECT COUNT(*) as c FROM User").get().c;
            testDb.close();

            expect(koboCount).toBe(0);
            expect(userCount).toBe(0);
        } finally {
            cleanupDisposableDatabase(runnerDir);
            expect(fs.existsSync(runnerDir)).toBe(false);
        }
    });

    test('7. cleanupDisposableDatabase refuses to delete directories without runner prefix or outside pattern', () => {
        const sensitiveDir = path.resolve(__dirname, '../../controllers');
        expect(fs.existsSync(sensitiveDir)).toBe(true);
        // Attempting to pass sensitive directory to cleanup must be safely ignored
        cleanupDisposableDatabase(sensitiveDir);
        expect(fs.existsSync(sensitiveDir)).toBe(true);
    });

    test('8. Refusal guard enforces working dev.db immutability when inherited', () => {
        // Record size and mtime of working dev.db before test
        const devDbStatsBefore = fs.statSync(WORKING_DEV_DB);

        // Simulate an inherited DATABASE_PATH pointing to working dev.db
        const inheritedPath = WORKING_DEV_DB;
        expect(() => {
            validateDisposableDbPath(inheritedPath, tempTestDir);
        }).toThrow('[DB_ISOLATION_REFUSAL]');

        // Verify dev.db was untouched (no modifications)
        const devDbStatsAfter = fs.statSync(WORKING_DEV_DB);
        expect(devDbStatsAfter.size).toBe(devDbStatsBefore.size);
        expect(devDbStatsAfter.mtimeMs).toBe(devDbStatsBefore.mtimeMs);
    });

    test('9. cleanupDisposableDatabase strictly confines cleanup to exact owned root and preserves other active runs', () => {
        const otherRunnerDir = path.resolve(__dirname, '../..', '.tmp_journey_runner_other_active_' + Date.now());
        fs.mkdirSync(otherRunnerDir, { recursive: true });

        const myRunnerDir = path.resolve(__dirname, '../..', '.tmp_journey_runner_my_active_' + Date.now());
        fs.mkdirSync(myRunnerDir, { recursive: true });

        try {
            expect(fs.existsSync(otherRunnerDir)).toBe(true);
            expect(fs.existsSync(myRunnerDir)).toBe(true);

            // Clean up myRunnerDir only
            cleanupDisposableDatabase(myRunnerDir);
            expect(fs.existsSync(myRunnerDir)).toBe(false);

            // otherRunnerDir must be strictly preserved
            expect(fs.existsSync(otherRunnerDir)).toBe(true);
        } finally {
            if (fs.existsSync(otherRunnerDir)) {
                fs.rmSync(otherRunnerDir, { recursive: true, force: true });
            }
        }
    });
});
