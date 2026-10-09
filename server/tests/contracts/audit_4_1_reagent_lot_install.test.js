const fs = require('node:fs');
const { createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { proficiencyEvidenceFixture } = require('../helpers/proficiencyEvidenceFixture');
const { assertOwnedTestDatabase } = require('../helpers/testOwnedDatabase');
const { loadBatchReagentLotMigrationSource } = require('../../services/batchReagentLotMigrationSource');
const { installBatchReagentLots, assertBatchReagentLotsStartupReady, parseArguments } = require('../../scripts/install_batch_reagent_lots');
const owned = [], hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const source = loadBatchReagentLotMigrationSource();
function fixture() {
    const f = proficiencyEvidenceFixture([{ sigma: 1, zScore: 3, outcome: 'UNSATISFACTORY' },
        { sigma: 0, zScore: 12, outcome: 'SATISFACTORY' }]); owned.push(f); return f;
}
function raw(f, execute) {
    const db = new Database(assertOwnedTestDatabase(f.file, 'system:fixture'));
    try { db.pragma('foreign_keys=ON'); return execute(db); } finally { db.close(); }
}
afterEach(() => { for (const f of owned.splice(0)) f.close(); });
test('PRE_194 dry default and atomic install retain actual historical PT evidence; COMPLETE repeats are byte-identical', () => {
    const f = fixture(), before = hash(f.file), rounds = raw(f, db => db.prepare('SELECT * FROM ProficiencyRound ORDER BY id').all());
    expect(installBatchReagentLots({ dbPath: f.file })).toMatchObject({ classification: 'PRE_194', mode: 'DRY_RUN', totalChanges: 0, backfilledCount: 0 });
    expect(hash(f.file)).toBe(before);
    expect(() => assertBatchReagentLotsStartupReady(f.file)).toThrow(expect.objectContaining({ code: 'REAGENT_LOT_NOT_INSTALLED' }));
    expect(hash(f.file)).toBe(before);
    const applied = installBatchReagentLots({ dbPath: f.file, apply: true });
    expect(applied).toMatchObject({ classification: 'COMPLETE_194', previousClassification: 'PRE_194', mode: 'APPLIED', newLinkCount: 0, backfilledCount: 0,
        receipt: { originalRowsPreserved: true, newLinkCount: 0 } });
    expect(raw(f, db => db.prepare('SELECT * FROM ProficiencyRound ORDER BY id').all())).toEqual(rounds);
    const completed = hash(f.file);
    expect(assertBatchReagentLotsStartupReady(f.file).classification).toBe('COMPLETE_194');
    expect(installBatchReagentLots({ dbPath: f.file, apply: true })).toMatchObject({ mode: 'NO_OP', totalChanges: 0, linkCount: 0 });
    expect(hash(f.file)).toBe(completed);
});
test('exact empty fresh schema installs only guards/receipt without rewriting historical rows', () => {
    const f = fixture(); raw(f, db => db.exec(source.schemaSql)); const before = hash(f.file);
    expect(installBatchReagentLots({ dbPath: f.file })).toMatchObject({ classification: 'FRESH_PRISMA_194', mode: 'DRY_RUN', totalChanges: 0 });
    expect(hash(f.file)).toBe(before);
    expect(installBatchReagentLots({ dbPath: f.file, apply: true })).toMatchObject({ previousClassification: 'FRESH_PRISMA_194', classification: 'COMPLETE_194', newLinkCount: 0 });
});
test.each(['partial-guard', 'changed-column', 'changed-receipt', 'stray-index'])('strict installer refuses %s with byte-identical zero-write evidence', variant => {
    const f = fixture();
    if (variant === 'stray-index') raw(f, db => db.exec('CREATE INDEX BatchReagentLot_labId_batchId_idx ON Batch(labId)'));
    else if (variant === 'partial-guard') raw(f, db => { db.exec(source.schemaSql); db.exec(source.guardsSql.slice(0, source.guardsSql.indexOf('CREATE TRIGGER "BatchReagentLot_delete_refused"'))); });
    else {
        installBatchReagentLots({ dbPath: f.file, apply: true });
        raw(f, db => variant === 'changed-column' ? db.exec('ALTER TABLE BatchReagentLot ADD COLUMN unexpected TEXT') :
            db.prepare('UPDATE _schema_migrations SET details=? WHERE id=?').run('{}', '194_batch_reagent_lots'));
    }
    const before = hash(f.file);
    expect(() => installBatchReagentLots({ dbPath: f.file, apply: true })).toThrow(expect.objectContaining({ code: 'REAGENT_LOT_SCHEMA_MISMATCH', totalChanges: 0 }));
    expect(hash(f.file)).toBe(before);
});
test('fresh unmarked links refuse with their ids and zero writes; no retained link is silently adopted', () => {
    const f = fixture(); raw(f, db => {
        db.exec(source.schemaSql);
        const labId = db.prepare('SELECT id FROM Lab ORDER BY id').get().id;
        db.prepare('INSERT INTO Batch(id,labId,analysis,status,createdBy) VALUES(?,?,?,?,?)').run('owned-run', labId, 'MiXeD', 'OPEN', f.by);
        db.prepare('INSERT INTO InventoryItem(id,labId,itemType,name,unitOfMeasure,updatedAt) VALUES(?,?,?,?,?,?)').run('owned-item', labId, 'REAGENT', 'Owned reagent', 'mL', Date.now());
        db.prepare('INSERT INTO InventoryLot(id,inventoryItemId,labId,lotNumber,initialQuantity,currentQuantity,unitOfMeasure,updatedAt) VALUES(?,?,?,?,?,?,?,?)')
            .run('owned-lot', 'owned-item', labId, 'owned-lot-number', 10, 10, 'mL', Date.now());
        db.prepare('INSERT INTO BatchReagentLot(id,batchId,labId,inventoryLotId,linkedBy) VALUES(?,?,?,?,?)').run('owned-unmarked-link', 'owned-run', labId, 'owned-lot', f.by);
    });
    const before = hash(f.file);
    expect(() => installBatchReagentLots({ dbPath: f.file, apply: true })).toThrow(expect.objectContaining({ code: 'REAGENT_LOT_BOOTSTRAP_DATA_REFUSED', differences: ['owned-unmarked-link'], totalChanges: 0 }));
    expect(hash(f.file)).toBe(before);
});
test('receipt failure rolls the whole additive schema/guard install back', () => {
    const f = fixture(); raw(f, db => db.exec("CREATE TRIGGER owned_reagent_receipt_failure BEFORE INSERT ON _schema_migrations WHEN NEW.id='194_batch_reagent_lots' BEGIN SELECT RAISE(ABORT,'OWNED_REAGENT_RECEIPT_FAILURE'); END;"));
    const before = hash(f.file);
    expect(() => installBatchReagentLots({ dbPath: f.file, apply: true })).toThrow('OWNED_REAGENT_RECEIPT_FAILURE');
    expect(hash(f.file)).toBe(before);
    expect(raw(f, db => db.prepare("SELECT count(*) n FROM sqlite_master WHERE name LIKE 'BatchReagentLot%'").get().n)).toBe(0);
});
test('CLI requires an explicit database and unambiguous execution mode', () => {
    expect(parseArguments(['--db', 'owned.db'])).toEqual({ dbPath: 'owned.db', apply: false });
    for (const args of [[], ['--db'], ['--db', 'owned.db', '--apply', '--dry-run'], ['--db', 'owned.db', '--apply', '--apply']]) {
        expect(() => parseArguments(args)).toThrow(expect.objectContaining({ code: 'REAGENT_LOT_ARGUMENT_INVALID' }));
    }
});
