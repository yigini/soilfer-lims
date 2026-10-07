const fs = require('node:fs'), Database = require('better-sqlite3');
const { createHash } = require('node:crypto');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { assertOwnedTestDatabase } = require('../helpers/testOwnedDatabase');
const { installResultEquipmentEvidence, assertResultEquipmentStartupReady } = require('../../scripts/install_result_equipment_evidence');
const { loadResultEquipmentMigrationSource } = require('../../services/resultEquipmentMigrationSource');
const { createRawResultFixture } = require('../../services/resultWriteService');
const owned = [], hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function fixture() {
    const f = beforeGuards({ actor: 'system:fixture', schemaVariant: 'PRE_1_3_SAMPLE_CODES', samples: [
        { id: 'owned-result', originalId: 'owned-result', status: 'PROCESSING', updatedAt: Date.now() } ], relatedRows: { Result: [
        { id: 'historical-result', sampleId: 'owned-result', param: 'fixture', value: '12', numericValue: 12, updatedAt: Date.now() } ] } });
    owned.push(f.file);
    const db = new Database(f.file);
    db.exec('CREATE TABLE "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL,"appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"details" TEXT)'); db.close();
    return f.file;
}
afterAll(() => { for (const file of owned) for (const suffix of ['', '-wal', '-shm']) fs.rmSync(assertOwnedTestDatabase(file,'system:fixture') + suffix, { force: true }); });
test('additive equipment evidence install preserves every old Result field, leaves historical evidence NULL, and repeats without writes', () => {
    const file = fixture(), before = hash(file);
    const dry = installResultEquipmentEvidence({ dbPath: file });
    expect(dry).toMatchObject({ classification: 'PRE_189', mode: 'DRY_RUN', backfillCount: 0 });
    expect(hash(file)).toBe(before);
    const applied = installResultEquipmentEvidence({ dbPath: file, apply: true });
    expect(applied).toMatchObject({ classification: 'COMPLETE', previousClassification: 'PRE_189', bootstrapRebuild: [], totalChanges: 1,
        originalResultSha256: dry.originalResultSha256 });
    const db = new Database(file); expect(db.prepare('SELECT equipmentReadiness FROM Result WHERE id=?').get('historical-result').equipmentReadiness).toBeNull(); db.close();
    const installed = hash(file);
    expect(installResultEquipmentEvidence({ dbPath: file, apply: true })).toMatchObject({ mode: 'NO_OP', totalChanges: 0 });
    expect(assertResultEquipmentStartupReady(file).classification).toBe('COMPLETE'); expect(hash(file)).toBe(installed);
});
test('fresh Prisma column gets guards and a receipt without rebuilding; invalid inserts and changing NULL or recorded evidence refuse exactly', () => {
    const file = fixture(), source = loadResultEquipmentMigrationSource(), db = new Database(file);
    db.exec(source.sql.slice(0, source.sql.indexOf('CREATE TRIGGER'))); db.close();
    expect(installResultEquipmentEvidence({ dbPath: file, apply: true })).toMatchObject({ previousClassification: 'FRESH_PRISMA', bootstrapRebuild: [] });
    const check = new Database(file);
    try {
        for (const evidence of ['bad JSON', '[]', 'null', '"text"', '3']) expect(() => createRawResultFixture(check,
            { id: 'invalid-result', sampleId: 'owned-result', param: 'fixture', value: '12', updatedAt: Date.now(), equipmentReadiness: evidence }))
            .toThrow('RESULT_EQUIPMENT_READINESS_INVALID');
        createRawResultFixture(check, { id: 'new-result', sampleId: 'owned-result', param: 'fixture', value: '12', updatedAt: Date.now(), equipmentReadiness: '{}' });
        for (const id of ['historical-result','new-result']) expect(() => check.prepare('UPDATE Result SET equipmentReadiness=? WHERE id=?').run('{"edited":true}',id))
            .toThrow('RESULT_EQUIPMENT_READINESS_IMMUTABLE');
        expect(check.prepare('UPDATE Result SET isCurrent=0,flags=? WHERE id=?').run('["FIXTURE_REVIEW"]','new-result').changes).toBe(1);
        expect(check.pragma('foreign_key_check')).toEqual([]);
    } finally { check.close(); }
});
test('receipt failure rolls back the column and both guards byte-identically', () => {
    const file = fixture(), db = new Database(file);
    db.exec(`CREATE TRIGGER owned_result_receipt_fault BEFORE INSERT ON "_schema_migrations" BEGIN SELECT RAISE(ABORT,'OWNED_RESULT_RECEIPT_FAULT'); END;`); db.close();
    const before = hash(file);
    expect(() => installResultEquipmentEvidence({ dbPath: file, apply: true })).toThrow('OWNED_RESULT_RECEIPT_FAULT');
    expect(hash(file)).toBe(before);
    expect(installResultEquipmentEvidence({ dbPath: file }).classification).toBe('PRE_189');
});
test('partial/tampered evidence cannot start or auto-repair', () => {
    const file = fixture(); installResultEquipmentEvidence({ dbPath: file, apply: true });
    const db = new Database(file); db.prepare('UPDATE _schema_migrations SET details=? WHERE id=?').run('{}','189_result_equipment_readiness'); db.close();
    const before = hash(file);
    expect(() => assertResultEquipmentStartupReady(file)).toThrow(expect.objectContaining({ code: 'RESULT_EQUIPMENT_SCHEMA_MISMATCH' }));
    expect(() => installResultEquipmentEvidence({ dbPath: file, apply: true })).toThrow(expect.objectContaining({ code: 'RESULT_EQUIPMENT_SCHEMA_MISMATCH' }));
    expect(hash(file)).toBe(before);
});
