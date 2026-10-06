const fs = require('node:fs');
const { randomUUID, createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { installReferenceMaterials, assertReferenceStartupReady, parseArguments } = require('../../scripts/install_reference_materials');
const { loadReferenceMaterialMigrationSource } = require('../../services/referenceMaterialMigrationSource');
const { scanSource } = require('../helpers/workflowWriteScanner');
const files = [], hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function fixture(schemaVariant = 'PRE_1_3_SAMPLE_CODES') {
    const sampleId = randomUUID(), batchId = randomUUID();
    const { file } = beforeGuards({ actor: 'system:fixture', schemaVariant,
        samples: [{ id: sampleId, originalId: sampleId, status: 'PROCESSING', assignedLab: 'REFERENCE-INSTALL', createdAt: new Date(), updatedAt: new Date() }],
        batches: [{ id: batchId, analysis: 'HISTORICAL_PARAM', status: 'OPEN', createdBy: 'system:fixture' }],
        relatedRows: { Result: [{ id: randomUUID(), sampleId, param: 'HISTORICAL_PARAM', value: '6.75', numericValue: 6.75,
            rawInput: '6,75', provenance: 'IMPORTED', flags: '["HISTORICAL_QC_FLAG"]', updatedAt: new Date().toISOString() }] } });
    files.push(file);
    const db = new Database(file);
    try {
        db.exec('CREATE TABLE IF NOT EXISTS "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL, "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "details" TEXT)');
        db.prepare('INSERT INTO "_schema_migrations" (id,details) VALUES (?,?)').run('prior_release_fixture', '{"preserve":"exact"}');
        db.prepare('INSERT INTO "BatchQcResult" (id,batchId,type,expected,measured,status,details) VALUES (?,?,?,?,?,?,?)')
            .run(randomUUID(), batchId, 'CONTROL', 7.12345, 7.12346, 'PASS', '{"original":"verbatim"}');
    } finally { db.close(); }
    return file;
}
function state(file) {
    const db = new Database(file, { readonly: true, fileMustExist: true });
    try { return { objects: db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all(),
        tables: db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({ name }) => ({ name,
            columns: db.prepare(`PRAGMA table_xinfo("${name}")`).all(), fks: db.prepare(`PRAGMA foreign_key_list("${name}")`).all(),
            rows: db.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all() })) }; }
    finally { db.close(); }
}
afterAll(() => { for (const file of files) if (fs.existsSync(file)) fs.unlinkSync(file); });

test.each(['PRE_1_3_SAMPLE_CODES', null])('real reference install on %s preserves every original field and has no QC backfill', variant => {
    const file = fixture(variant), before = state(file), digest = hash(file);
    expect(installReferenceMaterials({ dbPath: file })).toMatchObject({ mode: 'DRY_RUN', totalChanges: 0, backfillCount: 0,
        classification: variant ? 'PRE_184' : 'FRESH_PRISMA', counts: { materials: 0, values: 0, qcRows: 1, linked: 0 } });
    expect(hash(file)).toBe(digest);
    expect(() => assertReferenceStartupReady(file)).toThrow(expect.objectContaining({ code: 'REFERENCE_NOT_INSTALLED' }));
    expect(hash(file)).toBe(digest);
    const outcome = installReferenceMaterials({ dbPath: file, apply: true });
    expect(outcome).toMatchObject({ mode: 'APPLIED', classification: 'COMPLETE', totalChanges: 1, backfillCount: 0 });
    expect(outcome.guards).toHaveLength(7); expect(outcome.indexes).toHaveLength(4);
    const db = new Database(file, { readonly: true, fileMustExist: true });
    try {
        for (const table of before.tables) {
            const fields = table.columns.map(row => `"${row.name}"`).join(',');
            const rows = db.prepare(`SELECT ${fields} FROM "${table.name}" ${table.name === '_schema_migrations' ? "WHERE id<>'184_reference_material_catalogue'" : ''} ORDER BY rowid`).all();
            expect(rows).toEqual(table.rows);
            expect(db.prepare(`PRAGMA table_xinfo("${table.name}")`).all().slice(0, table.columns.length)).toEqual(table.columns);
            const fks = db.prepare(`PRAGMA foreign_key_list("${table.name}")`).all().filter(row => table.fks.some(old => old.from === row.from));
            expect(fks.map(({ id, ...row }) => row)).toEqual(table.fks.map(({ id, ...row }) => row));
        }
        for (const object of before.objects.filter(row => !(variant && row.name === 'BatchQcResult'))) {
            expect(db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type=? AND name=?').get(object.type, object.name)).toEqual(object);
        }
        expect(db.pragma('integrity_check', { simple: true })).toBe('ok'); expect(db.pragma('foreign_key_check')).toEqual([]);
    } finally { db.close(); }
    const after = state(file), afterDigest = hash(file);
    expect(installReferenceMaterials({ dbPath: file, apply: true })).toMatchObject({ mode: 'NO_OP', totalChanges: 0 });
    expect(assertReferenceStartupReady(file)).toMatchObject({ classification: 'COMPLETE', totalChanges: 0 });
    expect(state(file)).toEqual(after); expect(hash(file)).toBe(afterDigest);
});

test.each(['partial', 'marker', 'tampered'])('%s installation refuses with all tables and bytes unchanged', variant => {
    const file = fixture();
    if (variant === 'tampered') installReferenceMaterials({ dbPath: file, apply: true });
    const db = new Database(file);
    try {
        if (variant === 'partial') db.exec('ALTER TABLE "BatchQcResult" ADD COLUMN "referenceMaterialId" TEXT');
        if (variant === 'marker') db.prepare('INSERT INTO "_schema_migrations" (id,details) VALUES (?,?)').run('184_reference_material_catalogue', '{}');
        // Corrupt only this owned receipt; installed guards remain enabled.
        if (variant === 'tampered') db.prepare('UPDATE "_schema_migrations" SET details=? WHERE id=?').run('{}', '184_reference_material_catalogue');
    } finally { db.close(); }
    const before = state(file), digest = hash(file);
    expect(() => installReferenceMaterials({ dbPath: file, apply: true })).toThrow(expect.objectContaining({ code: 'REFERENCE_SCHEMA_MISMATCH' }));
    expect(() => assertReferenceStartupReady(file)).toThrow(expect.objectContaining({ code: 'REFERENCE_SCHEMA_MISMATCH' }));
    expect(state(file)).toEqual(before); expect(hash(file)).toBe(digest);
});

test('receipt write failure rolls back tables, columns, indexes and guards together', () => {
    const file = fixture(), db = new Database(file);
    try { db.exec(`CREATE TRIGGER "Reference_receipt_fault" BEFORE INSERT ON "_schema_migrations"
        WHEN NEW.id='184_reference_material_catalogue' BEGIN SELECT RAISE(ABORT,'OWNED_REFERENCE_RECEIPT_FAULT'); END;`); }
    finally { db.close(); }
    const before = state(file), digest = hash(file);
    expect(() => installReferenceMaterials({ dbPath: file, apply: true })).toThrow('OWNED_REFERENCE_RECEIPT_FAULT');
    expect(state(file)).toEqual(before); expect(hash(file)).toBe(digest);
});

test('closed reference loader never accepts alias, mutation or shadowed SQL authority', () => {
    expect(loadReferenceMaterialMigrationSource().sha256).toBe('5cf133efab664cf72a6817c808c13f6028141baba9705b30fe0817f31b3f596f');
    const header = "const {loadReferenceMaterialMigrationSource}=require('../services/referenceMaterialMigrationSource');const source=loadReferenceMaterialMigrationSource();";
    expect(scanSource(header + 'db.exec(source.sql)', 'scripts/reference-probe.js')).toEqual([]);
    for (const code of ['const alias=source;db.exec(alias.sql)', 'source.sql=input;db.exec(source.sql)', 'delete source.sql;db.exec(source.sql)']) {
        expect(scanSource(header + code, 'scripts/reference-probe.js')).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'UNRESOLVED_WORKFLOW_SQL' })]));
    }
    expect(scanSource('function loadReferenceMaterialMigrationSource(){return {sql:input}};const source=loadReferenceMaterialMigrationSource();db.exec(source.sql)',
        'scripts/reference-probe.js')).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'UNRESOLVED_WORKFLOW_SQL' })]));
    expect(() => parseArguments(['--apply', '--dry-run'])).toThrow(expect.objectContaining({ code: 'REFERENCE_ARGUMENT_INVALID' }));
});
