const fs = require('node:fs');
const { createHash, randomUUID } = require('node:crypto');
const Database = require('better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { installProficiencyEvidence, assertProficiencyStartupReady, parseArguments } = require('../../scripts/install_proficiency_evidence');
const { loadProficiencyMigrationSource } = require('../../services/proficiencyMigrationSource');
const owned = [];
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function fixture() {
    const labId = randomUUID();
    const f = beforeGuards({ actor: 'system:fixture', schemaVariant: 'PRE_1_3_SAMPLE_CODES', relatedRows: {
        Lab: [{ id: labId, code: labId, name: 'Owned PT migration fixture', country: 'TEST', updatedAt: Date.now() }] } });
    owned.push(f);
    const db = new Database(f.file);
    try {
        db.exec('CREATE TABLE "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL,"appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"details" TEXT)');
        for (const sigma of [null, 1]) db.prepare(`INSERT INTO "ProficiencyRound"
            (id,provider,roundRef,labId,analysisCode,assignedValue,uncertainty,labResult,zScore,outcome,date,updatedAt)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(randomUUID(), 'fixture', 'old', labId, 'mixedCase', 1, sigma, 4, 3, 'QUESTIONABLE', Date.now(), Date.now());
    } finally { db.close(); }
    return f;
}
afterAll(() => { for (const f of owned) for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(f.file + suffix)) fs.unlinkSync(f.file + suffix); });

test('legacy dry-run is byte-identical; additive install preserves scores, outcomes and every old PT field; repeat is zero-write', () => {
    const f = fixture(), beforeHash = hash(f.file), db = new Database(f.file);
    const before = db.prepare('SELECT * FROM "ProficiencyRound" ORDER BY id').all(); db.close();
    expect(installProficiencyEvidence({ dbPath: f.file })).toMatchObject({ classification: 'PRE_189', mode: 'DRY_RUN', totalChanges: 0, backfillCount: 0 });
    expect(hash(f.file)).toBe(beforeHash);
    const applied = installProficiencyEvidence({ dbPath: f.file, apply: true });
    expect(applied).toMatchObject({ classification: 'COMPLETE', previousClassification: 'PRE_189', totalChanges: 1, bootstrapRebuild: [] });
    const check = new Database(f.file);
    try {
        for (const row of before) expect(check.prepare('SELECT * FROM "ProficiencyRound" WHERE id=?').get(row.id)).toMatchObject({ ...row,
            ncrStatus: null, classificationLimits: null, legacyScoreFlag: null, deletedAt: null });
        expect(check.pragma('foreign_key_check')).toEqual([]);
        expect(() => check.prepare('UPDATE "ProficiencyRound" SET ncrStatus=? WHERE id=?').run('OPEN', before[0].id)).toThrow('PT_NCR_STATUS_INVALID');
    } finally { check.close(); }
    const installedHash = hash(f.file);
    expect(installProficiencyEvidence({ dbPath: f.file, apply: true })).toMatchObject({ mode: 'NO_OP', totalChanges: 0,
        scoreOutcomeSha256: applied.scoreOutcomeSha256 });
    expect(hash(f.file)).toBe(installedHash);
    expect(assertProficiencyStartupReady(f.file).classification).toBe('COMPLETE');
});

test('the fresh-column path adds only guards and receipt, without rebuilding the table', () => {
    const f = fixture(), source = loadProficiencyMigrationSource(), db = new Database(f.file);
    db.exec(source.sql.slice(0, source.sql.indexOf('CREATE TRIGGER'))); db.close();
    expect(installProficiencyEvidence({ dbPath: f.file }).classification).toBe('FRESH_PRISMA');
    expect(installProficiencyEvidence({ dbPath: f.file, apply: true })).toMatchObject({ previousClassification: 'FRESH_PRISMA',
        classification: 'COMPLETE', bootstrapRebuild: [], totalChanges: 1 });
});

test('a receipt-write fault rolls all additive DDL back byte-for-byte', () => {
    const f = fixture(), db = new Database(f.file);
    db.exec(`CREATE TRIGGER owned_pt_receipt_fault BEFORE INSERT ON "_schema_migrations"
        BEGIN SELECT RAISE(ABORT,'OWNED_PT_RECEIPT_FAULT'); END;`); db.close();
    const before = hash(f.file);
    expect(() => installProficiencyEvidence({ dbPath: f.file, apply: true })).toThrow('OWNED_PT_RECEIPT_FAULT');
    expect(hash(f.file)).toBe(before);
    expect(installProficiencyEvidence({ dbPath: f.file }).classification).toBe('PRE_189');
});

test('a partial column installation refuses without writes', () => {
    const f = fixture(), db = new Database(f.file); db.exec('ALTER TABLE "ProficiencyRound" ADD COLUMN ncrStatus TEXT'); db.close();
    const before = hash(f.file);
    expect(() => installProficiencyEvidence({ dbPath: f.file, apply: true })).toThrow(expect.objectContaining({ code: 'PT_SCHEMA_MISMATCH' }));
    expect(hash(f.file)).toBe(before);
});

test('an altered receipt refuses startup and apply without writes', () => {
    const f = fixture(); installProficiencyEvidence({ dbPath: f.file, apply: true });
    const db = new Database(f.file); db.prepare('UPDATE "_schema_migrations" SET details=? WHERE id=?').run('{}', '189_proficiency_evidence'); db.close();
    const before = hash(f.file);
    expect(() => assertProficiencyStartupReady(f.file)).toThrow(expect.objectContaining({ code: 'PT_SCHEMA_MISMATCH' }));
    expect(() => installProficiencyEvidence({ dbPath: f.file, apply: true })).toThrow(expect.objectContaining({ code: 'PT_SCHEMA_MISMATCH' }));
    expect(hash(f.file)).toBe(before);
});

test('uninstalled startup refuses and explicit database / non-conflicting CLI arguments are required', () => {
    const f = fixture();
    expect(() => assertProficiencyStartupReady(f.file)).toThrow(expect.objectContaining({ code: 'PT_NOT_INSTALLED' }));
    expect(() => installProficiencyEvidence()).toThrow(expect.objectContaining({ code: 'PT_DATABASE_REQUIRED' }));
    expect(() => parseArguments(['--apply', '--dry-run'])).toThrow(expect.objectContaining({ code: 'PT_ARGUMENT_INVALID' }));
    expect(() => parseArguments(['--db'])).toThrow(expect.objectContaining({ code: 'PT_ARGUMENT_INVALID' }));
});
