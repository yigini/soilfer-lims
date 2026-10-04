const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { inspect } = require('../../scripts/consignment_schema');
const migration = fs.readFileSync(path.join(__dirname, '../../prisma/migrations/20261004190200_nullable_consignment_count/migration.sql'), 'utf8');
const baseline = fs.readFileSync(path.join(__dirname, '../../scripts/schema/full_application_schema.sql'), 'utf8');
const create = baseline.match(/CREATE TABLE "Consignment" \([\s\S]*?\n\);/)[0];

describe('Audit 1.1: nullable consignment counts preserve historical deliveries', () => {
    let db;
    beforeEach(() => {
        db = new Database(':memory:');
        db.exec(create);
        db.exec(`CREATE UNIQUE INDEX "Consignment_code_key" ON "Consignment"("code");
            CREATE INDEX "Consignment_labId_idx" ON "Consignment"("labId");
            CREATE INDEX "Consignment_projectCode_idx" ON "Consignment"("projectCode");
            CREATE TABLE Sample (id TEXT PRIMARY KEY, consignmentId TEXT REFERENCES Consignment(id) ON DELETE SET NULL ON UPDATE CASCADE);`);
        db.pragma('foreign_keys = ON');
        db.prepare('INSERT INTO Consignment (id, code, labId, receivedBy, expectedCount, notes, metadata, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('old-zero', 'CSG-20261001-001', 'lab', 'reception', 0, 'é / exact bytes', '{"source":"old"}', '2026-10-01T08:00:00Z');
        db.prepare('INSERT INTO Consignment (id, code, labId, receivedBy, expectedCount, updatedAt) VALUES (?, ?, ?, ?, ?, ?)').run('old-declared', 'CSG-20261001-002', 'lab', 'reception', 40, '2026-10-01T09:00:00Z');
        db.exec("INSERT INTO Sample VALUES ('child', 'old-zero');");
    });
    afterEach(() => { if (db.inTransaction) db.exec('ROLLBACK'); db.close(); });
    test('copies every column exactly, keeps old 0 and declared counts, all indexes and child FK links', () => {
        const before = inspect(db), old = db.prepare('SELECT * FROM Consignment ORDER BY id').all();
        db.exec(migration);
        const after = inspect(db);
        expect(after.rowCount).toBe(before.rowCount);
        expect(after.fingerprint).toBe(before.fingerprint);
        expect(db.prepare('SELECT * FROM Consignment ORDER BY id').all()).toEqual(old);
        expect(after.indexes).toEqual(before.indexes);
        expect(after.foreignKeys).toEqual(before.foreignKeys);
        expect(after.foreignKeyErrors).toEqual([]);
        expect(db.prepare('SELECT * FROM Sample').all()).toEqual([{ id: 'child', consignmentId: 'old-zero' }]);
        expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
        expect(after.columns.find(column => column.name === 'expectedCount')).toMatchObject({ notnull: 0, dflt_value: null });
        db.exec("INSERT INTO Consignment (id, code, labId, receivedBy, updatedAt) VALUES ('new', 'new-code', 'lab', 'reception', 'now');");
        expect(db.prepare("SELECT expectedCount FROM Consignment WHERE id = 'new'").get().expectedCount).toBeNull();
    });
    test('refuses unrecognized custom schema instead of losing an index, and rolls back unchanged', () => {
        db.exec('CREATE INDEX custom_consignment_note ON Consignment(notes);');
        const before = inspect(db);
        expect(() => db.exec(migration)).toThrow(/CHECK constraint/);
        db.exec('ROLLBACK'); db.pragma('foreign_keys = ON');
        expect(inspect(db)).toEqual(before);
        expect(db.prepare('SELECT * FROM Sample').get().consignmentId).toBe('old-zero');
    });
    test('the migration refuses an existing FK violation atomically', () => {
        db.pragma('foreign_keys = OFF');
        db.exec("INSERT INTO Sample VALUES ('bad-child', 'missing');");
        db.pragma('foreign_keys = ON');
        const old = db.prepare('SELECT * FROM Consignment ORDER BY id').all();
        expect(() => db.exec(migration)).toThrow(/CHECK constraint/);
        db.exec('ROLLBACK'); db.pragma('foreign_keys = ON');
        expect(db.prepare('SELECT * FROM Consignment ORDER BY id').all()).toEqual(old);
        expect(inspect(db).columns.find(column => column.name === 'expectedCount')).toMatchObject({ notnull: 1 });
    });
    test.each([
        'DROP INDEX Consignment_labId_idx; CREATE UNIQUE INDEX Consignment_labId_idx ON Consignment(labId);',
        'DROP INDEX Consignment_labId_idx; CREATE INDEX Consignment_labId_idx ON Consignment(labId) WHERE labId IS NOT NULL;',
        'ALTER TABLE Consignment ADD COLUMN computedNote TEXT GENERATED ALWAYS AS (notes) VIRTUAL;'
    ])('refuses changed index semantics or hidden columns without losing them: %s', sql => {
        db.exec(sql); const before = db.serialize();
        expect(() => db.exec(migration)).toThrow(/CHECK constraint/);
        db.exec('ROLLBACK'); db.pragma('foreign_keys = ON');
        expect(db.serialize()).toEqual(before);
        expect(db.prepare('SELECT * FROM Sample').get().consignmentId).toBe('old-zero');
    });
});
