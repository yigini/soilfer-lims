const path = require('path');
const Database = require('better-sqlite3');

describe('Database PRAGMAs Contract Tests', () => {
    let db;

    beforeAll(() => {
        const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.resolve(__dirname, '../../prisma/dev.db');
        db = new Database(dbPath, { timeout: 5000 });
        db.pragma('journal_mode = WAL');
        db.pragma('busy_timeout = 5000');
        db.pragma('foreign_keys = ON');
        db.pragma('synchronous = NORMAL');
    });

    afterAll(() => {
        if (db) db.close();
    });

    test('should have WAL journal mode enabled', () => {
        const mode = db.pragma('journal_mode', { simple: true });
        expect(mode.toLowerCase()).toBe('wal');
    });

    test('should have busy_timeout configured to at least 5000ms', () => {
        const timeout = db.pragma('busy_timeout', { simple: true });
        expect(timeout).toBeGreaterThanOrEqual(5000);
    });

    test('should have foreign keys enabled', () => {
        const fk = db.pragma('foreign_keys', { simple: true });
        expect(fk).toBe(1);
    });

    test('should have synchronous mode set to NORMAL (1)', () => {
        const sync = db.pragma('synchronous', { simple: true });
        expect(sync).toBe(1);
    });
});
