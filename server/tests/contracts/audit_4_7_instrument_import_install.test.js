const fs = require('node:fs'), path = require('node:path');
const { createPre200ImportSchemaFixture } = require('../helpers/instrumentImportHistoricalFixture');
const { createPre200After210SchemaFixture } = require('../helpers/instrumentImportMainHistoricalFixture');
const { loadInstrumentImportMigrationSource } = require('../../services/instrumentImportMigrationSource');
const { scanSource } = require('../helpers/workflowWriteScanner');
const { classifyInstrumentImportSchema, MARKER } = require('../../services/instrumentImportSchemaService');
const { parseArguments, assertInstrumentImportStartupReady } = require('../../scripts/install_instrument_imports');
let db;
const source = loadInstrumentImportMigrationSource();
const template = { id: 'mapping-v1', labId: 'import-lab', instrumentId: 'import-instrument', name: 'Owned ICP mapping', version: 1,
    mapping: '{"rawColumns":[" 1,0 ","é"]}', createdBy: 'import-analyst', supersedesId: null };
const receipt = { id: 'source-receipt', labId: template.labId, instrumentId: template.instrumentId, templateId: template.id, templateVersion: 1,
    sourceSha256: 'a'.repeat(64), sourceName: 'owned.csv', mappingSnapshot: '{"rawRows":[[" 1,0 ","é"]]}', importedBy: template.createdBy };
function insert(table, row) {
    if (table === 'ImportTemplate') return db.prepare('INSERT INTO ImportTemplate(id,labId,instrumentId,name,version,mapping,createdBy,supersedesId) VALUES(?,?,?,?,?,?,?,?)')
        .run(row.id,row.labId,row.instrumentId,row.name,row.version,row.mapping,row.createdBy,row.supersedesId);
    if (table === 'InstrumentImportReceipt') return db.prepare('INSERT INTO InstrumentImportReceipt(id,labId,instrumentId,templateId,templateVersion,sourceSha256,sourceName,mappingSnapshot,importedBy) VALUES(?,?,?,?,?,?,?,?,?)')
        .run(row.id,row.labId,row.instrumentId,row.templateId,row.templateVersion,row.sourceSha256,row.sourceName,row.mappingSnapshot,row.importedBy);
    throw Error('Only synthetic import templates and receipts may be inserted.');
}
describe.each([['retained historical89-model main', createPre200ImportSchemaFixture], ['actual current92-model main after210', createPre200After210SchemaFixture]])('%s', (_name, createSchema) => {
beforeEach(() => {
    db = createSchema();
    for (const [id, code] of [['import-lab', 'IMPORT_LAB'], ['other-lab', 'OTHER_LAB']])
        db.prepare('INSERT INTO Lab(id,code,name,country,updatedAt) VALUES(?,?,?,?,?)').run(id, code, 'Synthetic lab', 'ZZ', '2026-10-10T00:00:00.000Z');
    for (const [id, labId] of [['import-instrument', 'IMPORT_LAB'], ['other-instrument', 'other-lab']])
        db.prepare('INSERT INTO EquipmentAsset(id,labId,assetType,name,status,criticality,updatedAt) VALUES(?,?,?,?,?,?,?)').run(id, labId, 'ICP', 'Synthetic instrument', 'IN_SERVICE', 'IMPORTANT', '2026-10-10T00:00:00.000Z');
    const releaseSource = loadInstrumentImportMigrationSource();
    db.transaction(() => db.exec(releaseSource.sql))();
    insert('ImportTemplate', template); insert('InstrumentImportReceipt', receipt);
});
afterEach(() => db?.close());

test.each(['id', 'labId', 'instrumentId', 'name', 'version', 'mapping', 'createdBy', 'createdAt', 'supersedesId'])('every template column is immutable: %s', column => {
    const before = db.prepare('SELECT * FROM ImportTemplate').all();
    expect(() => db.prepare('UPDATE ImportTemplate SET "' + column + '"="' + column + '"').run()).toThrow('IMPORT_TEMPLATE_IMMUTABLE');
    expect(db.prepare('SELECT * FROM ImportTemplate').all()).toEqual(before);
});
test.each(['id', 'labId', 'instrumentId', 'templateId', 'templateVersion', 'sourceSha256', 'sourceName', 'mappingSnapshot', 'importedBy', 'importedAt'])('every receipt column is immutable: %s', column => {
    const before = db.prepare('SELECT * FROM InstrumentImportReceipt').all();
    expect(() => db.prepare('UPDATE InstrumentImportReceipt SET "' + column + '"="' + column + '"').run()).toThrow('IMPORT_RECEIPT_IMMUTABLE');
    expect(db.prepare('SELECT * FROM InstrumentImportReceipt').all()).toEqual(before);
});
test.each(['ImportTemplate', 'InstrumentImportReceipt'])('deletion of %s is refused with its retained rows unchanged', table => {
    const before = db.prepare('SELECT * FROM "' + table + '"').all();
    expect(() => db.prepare('DELETE FROM "' + table + '"').run()).toThrow('IMMUTABLE');
    expect(db.prepare('SELECT * FROM "' + table + '"').all()).toEqual(before);
});
test('append-only revisions advance exactly once and preserve the original raw mapping', () => {
    insert('ImportTemplate', { ...template, id: 'mapping-v2', version: 2, supersedesId: template.id });
    expect(db.prepare('SELECT mapping FROM ImportTemplate WHERE id=?').get(template.id).mapping).toBe(template.mapping);
    expect(() => insert('ImportTemplate', { ...template, id: 'fork', version: 2, supersedesId: template.id })).toThrow('UNIQUE');
    expect(() => insert('ImportTemplate', { ...template, id: 'jump', version: 4, supersedesId: 'mapping-v2' })).toThrow('IMPORT_TEMPLATE_REVISION_INVALID');
});
test.each([{ version: 2 }, { instrumentId: 'other-instrument' }, { mapping: 'not JSON' }, { labId: 'other-lab', supersedesId: template.id, version: 2 }])('invalid template binding or revision refuses without a row: %j', changes => {
    expect(() => insert('ImportTemplate', { ...template, id: 'refused-template', ...changes })).toThrow();
    expect(db.prepare('SELECT count(*) n FROM ImportTemplate').get().n).toBe(1);
});
test.each([{ templateVersion: 2 }, { instrumentId: 'other-instrument' }, { sourceSha256: 'x'.repeat(64) }, { mappingSnapshot: 'not JSON' }])('invalid source receipt refuses without a row: %j', changes => {
    expect(() => insert('InstrumentImportReceipt', { ...receipt, id: 'refused-receipt', ...changes })).toThrow();
    expect(db.prepare('SELECT count(*) n FROM InstrumentImportReceipt').get().n).toBe(1);
});
test('the new draft pointer is nullable and restrictive, with no historical backfill or analytical writes', () => {
    expect(db.prepare('PRAGMA table_info(WorkItemDraft)').all().find(row => row.name === 'importReceiptId')).toMatchObject({ notnull: 0, dflt_value: null });
    expect(db.prepare('PRAGMA foreign_key_list(WorkItemDraft)').all().find(row => row.from === 'importReceiptId')).toMatchObject({ table: 'InstrumentImportReceipt', to: 'id', on_update: 'RESTRICT', on_delete: 'RESTRICT' });
    for (const table of ['WorkItemDraft', 'Sample', 'WorkItem', 'Result', 'AuditLog', 'QcMeasurement']) expect(db.prepare('SELECT count(*) n FROM "' + table + '"').get().n).toBe(0);
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok'); expect(db.pragma('foreign_key_check')).toEqual([]);
});
test('the schema-only factory is source-bound and unavailable to runtime or another caller', () => {
    const file = 'tests/helpers/instrumentImportHistoricalFixture.js', bytes = fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8');
    expect(scanSource(bytes, file)).toEqual([]);
    expect(scanSource(bytes + '\n// changed\n', file).map(row => row.code)).toContain('HISTORICAL_FIXTURE_SOURCE_MISMATCH');
    expect(scanSource("require('../tests/helpers/instrumentImportHistoricalFixture')", 'services/unlisted.js').map(row => row.code)).toContain('TEST_HELPER_IMPORTED_BY_RUNTIME');
    expect(scanSource("require('../helpers/instrumentImportHistoricalFixture')", 'tests/contracts/unlisted.test.js').map(row => row.code)).toContain('HISTORICAL_FIXTURE_CALLER_NOT_ALLOWED');
    expect(() => createPre200ImportSchemaFixture('not permitted')).toThrow('accepts no arguments');
});

test('literal pre-200 classification is read-only and does not invent a receipt', () => {
    db.close(); db = createSchema();
    const before = db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY name').all(), changes = db.prepare('SELECT total_changes() n').get().n;
    expect(classifyInstrumentImportSchema(db, source)).toMatchObject({ classification: 'PRE_200', counts: { templates: 0, receipts: 0, draftLinks: 0 } });
    expect(db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY name').all()).toEqual(before);
    expect(db.prepare('SELECT total_changes() n').get().n).toBe(changes);
});
test('an unmarked upgraded schema is refused without adopting its rows', () => {
    const before = db.prepare('SELECT * FROM InstrumentImportReceipt').all(), changes = db.prepare('SELECT total_changes() n').get().n;
    expect(() => classifyInstrumentImportSchema(db, source)).toThrow('partial, foreign, unmarked or populated');
    expect(db.prepare('SELECT * FROM InstrumentImportReceipt').all()).toEqual(before);
    expect(db.prepare('SELECT total_changes() n').get().n).toBe(changes);
});
test('a foreign object in the managed import namespace is refused', () => {
    db.exec('CREATE INDEX "foreign_import_index" ON "ImportTemplate"("name")');
    try { classifyInstrumentImportSchema(db, source); throw Error('Expected schema refusal'); }
    catch (error) { expect(error.code).toBe('IMPORT_SCHEMA_MISMATCH'); expect(error.differences).toContain('foreign_import_index is not a release object'); }
});
test('a forged receipt refuses without changing any imported evidence', () => {
    db.exec('CREATE TABLE "_schema_migrations" ("id" TEXT PRIMARY KEY,"appliedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,"details" TEXT)');
    db.prepare('INSERT INTO _schema_migrations(id,details) VALUES (?,?)').run(MARKER, '{}');
    const before = db.prepare('SELECT * FROM InstrumentImportReceipt').all();
    expect(() => classifyInstrumentImportSchema(db, source)).toThrow('installation receipt differs');
    expect(db.prepare('SELECT * FROM InstrumentImportReceipt').all()).toEqual(before);
});

test.each([[], ['--apply'], ['--db'], ['--db','owned.db','--apply','--dry-run'], ['--db','owned.db','--apply','--apply'], ['--db','owned.db','--unknown']].map(args => [args]))('installer CLI refuses malformed arguments: %j', args => {
    expect(() => parseArguments(args)).toThrow();
});
test('installer CLI accepts an explicit existing-path argument and one mode', () => {
    expect(parseArguments(['--db','owned.db','--dry-run'])).toEqual({ dbPath: 'owned.db', apply: false });
    expect(parseArguments(['--db','owned.db','--apply'])).toEqual({ dbPath: 'owned.db', apply: true });
});
test('startup refuses a missing database without creating it', () => {
    const missing = path.resolve(__dirname, '../.tmp', 'audit_owned_missing_import_' + require('node:crypto').randomUUID() + '.db');
    expect(fs.existsSync(missing)).toBe(false);
    try { assertInstrumentImportStartupReady(missing); throw Error('Expected missing-database refusal'); }
    catch (error) { expect(error.code).toBe('IMPORT_DATABASE_REQUIRED'); }
    expect(fs.existsSync(missing)).toBe(false);
});
});

test('the additional current-main schema-only factory is closed and digest-bound without changing the old fixture', () => {
    const file = 'tests/helpers/instrumentImportMainHistoricalFixture.js', bytes = fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8');
    expect(scanSource(bytes, file)).toEqual([]);
    expect(scanSource(bytes + '\n// changed\n', file).map(row => row.code)).toContain('HISTORICAL_FIXTURE_SOURCE_MISMATCH');
    expect(scanSource("require('../tests/helpers/instrumentImportMainHistoricalFixture')", 'services/unlisted.js').map(row => row.code)).toContain('TEST_HELPER_IMPORTED_BY_RUNTIME');
    expect(scanSource("require('../helpers/instrumentImportMainHistoricalFixture')", 'tests/contracts/unlisted.test.js').map(row => row.code)).toContain('HISTORICAL_FIXTURE_CALLER_NOT_ALLOWED');
    expect(() => createPre200After210SchemaFixture('not permitted')).toThrow('accepts no arguments');
    const current = createPre200After210SchemaFixture();
    try {
        expect(current.prepare('PRAGMA table_info(SampleAmendmentAuthorisation)').all()).toHaveLength(7);
        expect(current.prepare('PRAGMA table_info(ReportWithdrawal)').all()).toHaveLength(4);
        expect(current.prepare('SELECT count(*) n FROM Result').get().n).toBe(0);
        expect(current.prepare('SELECT count(*) n FROM AuditLog').get().n).toBe(0);
    } finally { current.close(); }
});
