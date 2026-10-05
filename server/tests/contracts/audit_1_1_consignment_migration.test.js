const Database = require('better-sqlite3');
const { PrismaClient } = require('../../prisma_client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { createSampleFixture } = require('../helpers/workflowFixtures');
const { inspect } = require('../../scripts/consignment_schema');
const backfill = require('../../scripts/backfill_consignment_counts');
describe.each([['Prisma-generated', 'CONSIGNMENT_PRE_1_1_A'], ['deployed legacy defaults/order', 'CONSIGNMENT_PRE_1_1_B']])('Audit 1.1 additive declared counts: %s', (_name, schemaVariant) => {
    let db, client, rehearsal, child;
    beforeEach(async () => {
        rehearsal = beforeGuards({ actor: 'system:fixture', schemaVariant, relatedRows: { Consignment: [
            { id: 'old-zero', code: 'CSG-old-0', labId: 'lab', receivedBy: 'reception', expectedCount: 0, notes: 'é / exact bytes', metadata: '{"source":"old"}', updatedAt: '2026-10-01T08:00:00Z' },
            { id: 'old-declared', code: 'CSG-old-40', labId: 'lab', receivedBy: 'reception', expectedCount: 40, notes: 'keep', metadata: '{}', updatedAt: '2026-10-01T09:00:00Z' },
            { id: 'old-negative', code: 'CSG-old-negative', labId: 'lab', receivedBy: 'reception', expectedCount: -3, notes: 'historical observation', metadata: '{}', updatedAt: '2026-10-01T10:00:00Z' }
        ] } });
        db = new Database(rehearsal.file); db.pragma('foreign_keys = ON');
        client = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${rehearsal.file}` }) });
        await createSampleFixture(client, { data: { id: 'child', originalId: 'child', consignmentId: 'old-zero', status: 'RECEIVED' } });
        child = db.prepare('SELECT * FROM Sample').all();
    });
    afterEach(async () => { if (db?.inTransaction) db.exec('ROLLBACK'); db?.close(); await client?.$disconnect(); rehearsal?.close(); });
    const apply = () => rehearsal.applyPendingMigration({ connection: db });
    test('only adds a nullable checked column; all old columns/defaults/order/indexes/FKs/values stay identical', () => {
        const before = inspect(db), names = before.columns.map(row => '"' + row.name + '"').join(','), old = db.prepare('SELECT * FROM Consignment ORDER BY id').all();
        apply(); const after = inspect(db);
        expect(after.rowCount).toBe(before.rowCount); expect(after.fingerprint).toBe(before.fingerprint);
        expect(after.columns.slice(0, -1)).toEqual(before.columns);
        expect(db.prepare('SELECT ' + names + ' FROM Consignment ORDER BY id').all()).toEqual(old);
        expect(after.indexes).toEqual(before.indexes); expect(after.foreignKeys).toEqual(before.foreignKeys); expect(after.foreignKeyErrors).toEqual([]);
        expect(db.prepare('SELECT id, consignmentId FROM Sample').all()).toEqual([{ id: 'child', consignmentId: 'old-zero' }]);
        expect(db.prepare('SELECT * FROM Sample').all()).toEqual(child);
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
        apply(); const applied = backfill.applyPlan(db, plan);
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
        const plan = backfill.planLegacyRows(db); apply(); backfill.applyPlan(db, plan);
        db.exec("INSERT INTO Consignment (id, code, labId, receivedBy, expectedCount, updatedAt) VALUES ('new-unknown','new','lab','receiver',7,'now');");
        expect(backfill.applyPlan(db, plan).changedCount).toBe(0);
        expect(db.prepare("SELECT declaredExpectedCount FROM Consignment WHERE id='new-unknown'").get().declaredExpectedCount).toBeNull();
        expect(() => backfill.planLegacyRows(db)).toThrow(/saved plan/);
    });
    test('schema and back-fill share a release transaction and roll back together on later failure', () => {
        const before = db.serialize(), plan = backfill.planLegacyRows(db);
        db.exec('BEGIN IMMEDIATE'); apply();
        expect(backfill.applyPlan(db, plan, { inTransaction: true }).changedCount).toBe(1);
        db.exec('ROLLBACK'); expect(db.serialize()).toEqual(before);
    });
    test('refuses stale source and conflicting declarations without overwriting evidence', () => {
        const plan = backfill.planLegacyRows(db); apply();
        db.exec("UPDATE Consignment SET expectedCount=41 WHERE id='old-declared'");
        expect(() => backfill.applyPlan(db, plan)).toThrow(/changed/);
        db.exec("UPDATE Consignment SET expectedCount=40, declaredExpectedCount=42 WHERE id='old-declared'");
        expect(() => backfill.applyPlan(db, plan)).toThrow(/never overwrite/);
        expect(db.prepare("SELECT declaredExpectedCount FROM Consignment WHERE id='old-declared'").get().declaredExpectedCount).toBe(42);
    });
    test('preserves custom columns, generated columns, indexes and triggers without a rebuild', () => {
        db.exec('ALTER TABLE Consignment ADD COLUMN customNote TEXT; ALTER TABLE Consignment ADD COLUMN computedNote TEXT GENERATED ALWAYS AS (notes) VIRTUAL; CREATE INDEX custom_consignment_note ON Consignment(notes); CREATE TRIGGER custom_note_guard BEFORE UPDATE OF notes ON Consignment BEGIN SELECT 1; END;');
        const before = inspect(db), xinfo = db.prepare('PRAGMA table_xinfo(Consignment)').all();
        const triggers = db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name").all(); apply();
        expect(inspect(db).indexes).toEqual(before.indexes); expect(inspect(db).fingerprint).toBe(before.fingerprint);
        expect(db.prepare('PRAGMA table_xinfo(Consignment)').all().slice(0, -1)).toEqual(xinfo);
        expect(triggers).toEqual(expect.arrayContaining([{ name: 'custom_note_guard' }, { name: 'Sample_status_insert_guard' }, { name: 'WorkItem_status_update_guard' }]));
        expect(db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name").all()).toEqual(triggers);
    });
});
