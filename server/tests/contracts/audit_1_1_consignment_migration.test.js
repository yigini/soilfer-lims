const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { inspect } = require('../../scripts/consignment_schema');
const backfill = require('../../scripts/backfill_consignment_counts');
const migration = fs.readFileSync(path.join(__dirname, '../../prisma/migrations/20261004190200_add_declared_consignment_count/migration.sql'), 'utf8');
const baseline = fs.readFileSync(path.join(__dirname, '../../scripts/schema/full_application_schema.sql'), 'utf8');
const create = baseline.match(/CREATE TABLE "Consignment" \([\s\S]*?\n\);/)[0];
const definitions = create.split('\n').slice(1, -1).map(line => line.trim().replace(/,$/, ''));
const custody = definitions.filter(line => /^"(?:custody|receivingOfficer)/.test(line));
const legacy = 'CREATE TABLE "Consignment" (\n' + [...definitions.filter(line => !custody.includes(line)).map(line => line.startsWith('"updatedAt"') ? line + ' DEFAULT CURRENT_TIMESTAMP' : line), ...custody].join(',\n') + '\n);';

describe.each([['Prisma-generated', create], ['deployed legacy defaults/order', legacy]])('Audit 1.1 additive declared counts: %s', (_name, ddl) => {
    let db;
    beforeEach(() => {
        db = new Database(':memory:'); db.exec(ddl);
        db.exec(`CREATE UNIQUE INDEX "Consignment_code_key" ON "Consignment"("code");
            CREATE INDEX "Consignment_labId_idx" ON "Consignment"("labId");
            CREATE INDEX "Consignment_projectCode_idx" ON "Consignment"("projectCode");
            CREATE TABLE Sample (id TEXT PRIMARY KEY, consignmentId TEXT REFERENCES Consignment(id) ON DELETE SET NULL ON UPDATE CASCADE);`);
        db.pragma('foreign_keys = ON');
        const insert = db.prepare('INSERT INTO Consignment (id, code, labId, receivedBy, expectedCount, notes, metadata, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        insert.run('old-zero', 'CSG-old-0', 'lab', 'reception', 0, 'é / exact bytes', '{"source":"old"}', '2026-10-01T08:00:00Z');
        insert.run('old-declared', 'CSG-old-40', 'lab', 'reception', 40, 'keep', '{}', '2026-10-01T09:00:00Z');
        insert.run('old-negative', 'CSG-old-negative', 'lab', 'reception', -3, 'historical observation', '{}', '2026-10-01T10:00:00Z');
        db.exec("INSERT INTO Sample VALUES ('child', 'old-zero');");
    });
    afterEach(() => { if (db.inTransaction) db.exec('ROLLBACK'); db.close(); });
    test('only adds a nullable checked column; all old columns/defaults/order/indexes/FKs/values stay identical', () => {
        const before = inspect(db), names = before.columns.map(row => '"' + row.name + '"').join(','), old = db.prepare('SELECT * FROM Consignment ORDER BY id').all();
        db.exec(migration); const after = inspect(db);
        expect(after.rowCount).toBe(before.rowCount); expect(after.fingerprint).toBe(before.fingerprint);
        expect(after.columns.slice(0, -1)).toEqual(before.columns);
        expect(db.prepare('SELECT ' + names + ' FROM Consignment ORDER BY id').all()).toEqual(old);
        expect(after.indexes).toEqual(before.indexes); expect(after.foreignKeys).toEqual(before.foreignKeys); expect(after.foreignKeyErrors).toEqual([]);
        expect(db.prepare('SELECT * FROM Sample').all()).toEqual([{ id: 'child', consignmentId: 'old-zero' }]);
        expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
        expect(after.columns.at(-1)).toMatchObject({ name: 'declaredExpectedCount', notnull: 0, dflt_value: null });
        expect(after.columns.find(row => row.name === 'expectedCount')).toMatchObject({ notnull: 1, dflt_value: '0' });
        expect(() => db.exec('UPDATE Consignment SET declaredExpectedCount = 0')).toThrow(/CHECK constraint/);
        expect(() => db.exec('UPDATE Consignment SET declaredExpectedCount = -1')).toThrow(/CHECK constraint/);
    });
    test('saved dry-run copies positive counts, leaves zero/negative NULL, preserves tuples and repeats with zero changes', () => {
        const old = db.prepare('SELECT * FROM Consignment ORDER BY id').all(), plan = backfill.planLegacyRows(db);
        expect(plan).toMatchObject({ mode: 'dry-run', rowCount: 3, copiedCount: 1, nullCount: 2 });
        expect(db.prepare('SELECT * FROM Consignment ORDER BY id').all()).toEqual(old);
        db.exec(migration); const applied = backfill.applyPlan(db, plan);
        expect(applied).toMatchObject({ rowCount: 3, copiedCount: 1, nullCount: 2, changedCount: 1, remainingCount: 0 });
        expect(applied.beforeFingerprint).toBe(plan.fingerprint); expect(applied.afterFingerprint).toBe(plan.fingerprint);
        expect(db.prepare('SELECT id, declaredExpectedCount FROM Consignment ORDER BY id').all()).toEqual([
            { id: 'old-declared', declaredExpectedCount: 40 }, { id: 'old-negative', declaredExpectedCount: null }, { id: 'old-zero', declaredExpectedCount: null }
        ]);
        expect(backfill.applyPlan(db, plan).changedCount).toBe(0);
        const names = Object.keys(old[0]).map(name => '"' + name + '"').join(',');
        expect(db.prepare('SELECT ' + names + ' FROM Consignment ORDER BY id').all()).toEqual(old);
    });
    test('repeat never invents a declaration for a later unknown consignment', () => {
        const plan = backfill.planLegacyRows(db); db.exec(migration); backfill.applyPlan(db, plan);
        db.exec("INSERT INTO Consignment (id, code, labId, receivedBy, expectedCount, updatedAt) VALUES ('new-unknown','new','lab','receiver',7,'now');");
        expect(backfill.applyPlan(db, plan).changedCount).toBe(0);
        expect(db.prepare("SELECT declaredExpectedCount FROM Consignment WHERE id='new-unknown'").get().declaredExpectedCount).toBeNull();
        expect(() => backfill.planLegacyRows(db)).toThrow(/saved plan/);
    });
    test('schema and back-fill share a release transaction and roll back together on later failure', () => {
        const before = db.serialize(), plan = backfill.planLegacyRows(db);
        db.exec('BEGIN IMMEDIATE'); db.exec(migration);
        expect(backfill.applyPlan(db, plan, { inTransaction: true }).changedCount).toBe(1);
        db.exec('ROLLBACK'); expect(db.serialize()).toEqual(before);
    });
    test('refuses stale source and conflicting declarations without overwriting evidence', () => {
        const plan = backfill.planLegacyRows(db); db.exec(migration);
        db.exec("UPDATE Consignment SET expectedCount=41 WHERE id='old-declared'");
        expect(() => backfill.applyPlan(db, plan)).toThrow(/changed/);
        db.exec("UPDATE Consignment SET expectedCount=40, declaredExpectedCount=42 WHERE id='old-declared'");
        expect(() => backfill.applyPlan(db, plan)).toThrow(/never overwrite/);
        expect(db.prepare("SELECT declaredExpectedCount FROM Consignment WHERE id='old-declared'").get().declaredExpectedCount).toBe(42);
    });
    test('preserves custom columns, generated columns, indexes and triggers without a rebuild', () => {
        db.exec('ALTER TABLE Consignment ADD COLUMN customNote TEXT; ALTER TABLE Consignment ADD COLUMN computedNote TEXT GENERATED ALWAYS AS (notes) VIRTUAL; CREATE INDEX custom_consignment_note ON Consignment(notes); CREATE TRIGGER custom_note_guard BEFORE UPDATE OF notes ON Consignment BEGIN SELECT 1; END;');
        const before = inspect(db), xinfo = db.prepare('PRAGMA table_xinfo(Consignment)').all(); db.exec(migration);
        expect(inspect(db).indexes).toEqual(before.indexes); expect(inspect(db).fingerprint).toBe(before.fingerprint);
        expect(db.prepare('PRAGMA table_xinfo(Consignment)').all().slice(0, -1)).toEqual(xinfo);
        expect(db.prepare("SELECT name FROM sqlite_master WHERE type='trigger'").all()).toEqual([{ name: 'custom_note_guard' }]);
    });
});
