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
 * 6. createDisposableDatabase builds the guarded release schema without reading a working database.
 * 7. cleanupDisposableDatabase removes the temporary runner directory and refuses to delete non-runner paths.
 * 8. Inherited working database path cannot be executed by the runner (fails closed).
 */

const fs = require('fs');
const path = require('path');
const {
    WORKING_DEV_DB,
    validateDisposableDbPath,
    createDisposableDatabase,
    configureDisposableWorkflowFixtures,
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

    test('6. createDisposableDatabase builds an isolated guarded release schema without accessing working data', () => {
        const actualRead = fs.readFileSync;
        const read = jest.spyOn(fs, 'readFileSync').mockImplementation((file, ...args) => {
            if (path.resolve(String(file)) === WORKING_DEV_DB) throw new Error('Working database must never be read');
            return actualRead(file, ...args);
        });
        const copy = jest.spyOn(fs, 'copyFileSync').mockImplementation(() => { throw new Error('No database may be copied'); });
        let runnerDir;
        try {
            const created = createDisposableDatabase();
            runnerDir = created.runnerDir;
            const { dbPath } = created;
            expect(fs.existsSync(runnerDir)).toBe(true);
            expect(fs.existsSync(dbPath)).toBe(true);
            expect(dbPath.startsWith(runnerDir)).toBe(true);
            expect(path.basename(dbPath)).not.toBe('dev.db');

            // The release schema starts empty; it never contains copied rows.
            const Database = require('better-sqlite3');
            const testDb = new Database(dbPath, { readonly: true, fileMustExist: true });
            try {
                expect(testDb.prepare('SELECT COUNT(*) as c FROM KoboConfig').get().c).toBe(0);
                expect(testDb.prepare('SELECT COUNT(*) as c FROM User').get().c).toBe(0);
                expect(testDb.prepare('SELECT COUNT(*) as c FROM Sample').get().c).toBe(0);
                expect(testDb.prepare('SELECT COUNT(*) as c FROM WorkItem').get().c).toBe(0);
                expect(testDb.prepare('SELECT COUNT(*) as c FROM ReportSequence').get().c).toBe(0);
                const sql = actualRead(require.resolve('../../prisma/migrations/20261005000100_workflow_state_guards/migration.sql'), 'utf8');
                const names = [...sql.matchAll(/CREATE TRIGGER "([^"]+)"/g)].map(match => match[1]);
                expect(names).toHaveLength(11);
                const holdSql = require('../../services/sampleHoldMigrationSource').loadSampleHoldMigrationSource().guardsSql;
                const holdNames = [...holdSql.matchAll(/CREATE TRIGGER "([^"]+)"/g)].map(match => match[1]);
                expect(holdNames).toHaveLength(4);
                expect(testDb.prepare("SELECT name FROM sqlite_master WHERE type='trigger'").all().map(row => row.name).sort()).toEqual([...names, ...holdNames].sort());
                for (const table of ['Sample', 'WorkItem']) {
                    expect(testDb.prepare(`PRAGMA table_info("${table}")`).all().map(row => row.name)).toEqual(expect.arrayContaining(['holdPriorStatus', 'legacyStatus']));
                }
                expect(testDb.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
            } finally { testDb.close(); }
            expect(copy).not.toHaveBeenCalled();
            expect(read.mock.calls.some(([file]) => path.resolve(String(file)) === WORKING_DEV_DB)).toBe(false);
        } finally {
            read.mockRestore(); copy.mockRestore();
            cleanupDisposableDatabase(runnerDir);
            if (runnerDir) expect(fs.existsSync(runnerDir)).toBe(false);
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
        const stat = jest.spyOn(fs, 'statSync');
        const read = jest.spyOn(fs, 'readFileSync');
        const copy = jest.spyOn(fs, 'copyFileSync');
        try {
            expect(() => validateDisposableDbPath(WORKING_DEV_DB, tempTestDir)).toThrow('[DB_ISOLATION_REFUSAL]');
            // Refusal happens before even inspecting the protected file.
            expect(stat).not.toHaveBeenCalled();
            expect(read).not.toHaveBeenCalled();
            expect(copy).not.toHaveBeenCalled();
        } finally { stat.mockRestore(); read.mockRestore(); copy.mockRestore(); }
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

    test('10. Production-mode browser fixtures require fresh ownership and use both real creation authorities', async () => {
        const { runnerDir, dbPath } = createDisposableDatabase();
        const names = ['NODE_ENV', 'DATABASE_PATH', 'DATABASE_URL', 'PRODUCTION_DATABASE_PATH', 'ALLOW_WORKFLOW_FIXTURES'];
        const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
        const { PrismaClient } = require('../../prisma_client');
        const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
        const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
        const fixtureDb = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${dbPath}` }) });
        try {
            process.env.NODE_ENV = 'production';
            process.env.DATABASE_PATH = dbPath; process.env.DATABASE_URL = `file:${dbPath}`;
            delete process.env.ALLOW_WORKFLOW_FIXTURES; delete process.env.PRODUCTION_DATABASE_PATH;
            await expect(createSampleFixture(fixtureDb, { data: { id: 'browser-sample', originalId: 'browser-sample', status: 'PROCESSING' } }))
                .rejects.toMatchObject({ code: 'WORKFLOW_FIXTURE_REFUSED' });
            expect(() => configureDisposableWorkflowFixtures(path.join(tempTestDir, 'arbitrary.db'), tempTestDir)).toThrow('[DB_ISOLATION_REFUSAL]');
            configureDisposableWorkflowFixtures(dbPath, runnerDir);
            await createSampleFixture(fixtureDb, { data: { id: 'browser-sample', originalId: 'browser-sample', status: 'PROCESSING' } });
            await createWorkItemFixture(fixtureDb, { data: { id: 'browser-work', sampleId: 'browser-sample', analysis: 'PH_H2O', status: 'NOT_ASSIGNED' } });
            expect((await fixtureDb.sample.findUnique({ where: { id: 'browser-sample' } })).status).toBe('PROCESSING');
            expect((await fixtureDb.workItem.findUnique({ where: { id: 'browser-work' } })).status).toBe('NOT_ASSIGNED');
            expect(await fixtureDb.auditLog.count({ where: { performedBy: 'system:fixture' } })).toBe(2);
            await expect(createSampleFixture(fixtureDb, { data: { id: 'legacy-forbidden', originalId: 'legacy-forbidden', status: 'COLLECTED' } }))
                .rejects.toMatchObject({ code: 'WORKFLOW_FIXTURE_REFUSED' });
            process.env.DATABASE_PATH = previous.DATABASE_PATH;
            expect(() => configureDisposableWorkflowFixtures(dbPath, runnerDir)).toThrow('[DB_ISOLATION_REFUSAL]');
        } finally {
            await fixtureDb.$disconnect();
            for (const name of names) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name]; }
            cleanupDisposableDatabase(runnerDir);
        }
    });
});
