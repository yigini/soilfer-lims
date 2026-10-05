const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { installResultAttemptLinks, assertResultAttemptStartupReady, parseArguments } = require('../../scripts/install_result_attempt_links');
const { loadResultAttemptMigrationSource } = require('../../services/resultAttemptMigrationSource');
const { scanSource } = require('../helpers/workflowWriteScanner');
const files = [];
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function fixture(schemaVariant = 'PRE_1_3_SAMPLE_CODES') {
    const sampleId = randomUUID();
    const { file } = beforeGuards({ actor: 'system:fixture', schemaVariant,
        samples: [{ id: sampleId, originalId: sampleId, status: 'PROCESSING', assignedLab: 'RESULT-MIGRATION-TEST', createdAt: new Date(), updatedAt: new Date() }],
        relatedRows: { Result: [{ id: randomUUID(), sampleId, param: 'HISTORICAL_PARAM', value: '6.75', numericValue: 6.75,
            rawInput: '6,75', provenance: 'IMPORTED', flags: '["HISTORICAL_QC_FLAG"]', updatedAt: new Date().toISOString() }] } });
    files.push(file);
    const db = new Database(file);
    try {
        db.exec('CREATE TABLE IF NOT EXISTS "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL, "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "details" TEXT)');
        db.prepare('INSERT INTO "_schema_migrations" (id,details) VALUES (?,?)').run('prior_release_fixture', '{"preserve":"exact"}');
    } finally { db.close(); }
    return file;
}

function originalState(file) {
    const db = new Database(file, { readonly: true, fileMustExist: true });
    try {
        return { objects: db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all(),
            tables: db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({ name }) => ({ name,
                columns: db.prepare(`PRAGMA table_xinfo("${name}")`).all(), fks: db.prepare(`PRAGMA foreign_key_list("${name}")`).all(),
                rows: db.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all() })) };
    } finally { db.close(); }
}

afterAll(() => { for (const file of files) if (fs.existsSync(file)) fs.unlinkSync(file); });

test('real additive install preserves every old row, field, object and FK, has no backfill, then is a zero-change no-op', () => {
    const file = fixture(), before = originalState(file), beforeHash = hash(file);
    expect(installResultAttemptLinks({ dbPath: file })).toMatchObject({ mode: 'DRY_RUN', classification: 'PRE_182', totalChanges: 0, backfillCount: 0 });
    expect(hash(file)).toBe(beforeHash);
    expect(installResultAttemptLinks({ dbPath: file, apply: true })).toMatchObject({ mode: 'APPLIED', classification: 'COMPLETE', previousClassification: 'PRE_182', totalChanges: 1, backfillCount: 0,
        counts: { results: 1, linked: 0 } });
    const db = new Database(file, { readonly: true, fileMustExist: true });
    try {
        for (const table of before.tables) {
            const fields = table.columns.map(column => `"${column.name}"`).join(',');
            const rows = db.prepare(`SELECT ${fields} FROM "${table.name}" ${table.name === '_schema_migrations' ? "WHERE id <> '182_result_attempt_links'" : ''} ORDER BY rowid`).all();
            expect(rows).toEqual(table.rows);
            expect(db.prepare(`PRAGMA table_xinfo("${table.name}")`).all().slice(0, table.columns.length)).toEqual(table.columns);
            expect(db.prepare(`PRAGMA foreign_key_list("${table.name}")`).all()).toEqual(table.fks);
        }
        for (const object of before.objects) {
            const actual = db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type=? AND name=?').get(object.type, object.name);
            if (object.type === 'table' && object.name === 'Result') {
                expect(actual.sql.replace(', "attemptId" TEXT', '')).toBe(object.sql);
            } else expect(actual).toEqual(object);
        }
        expect(db.pragma('integrity_check', { simple: true })).toBe('ok'); expect(db.pragma('foreign_key_check')).toEqual([]);
    } finally { db.close(); }
    const afterHash = hash(file);
    expect(installResultAttemptLinks({ dbPath: file, apply: true })).toMatchObject({ mode: 'NO_OP', totalChanges: 0 });
    expect(assertResultAttemptStartupReady(file)).toMatchObject({ classification: 'COMPLETE', totalChanges: 0 });
    expect(hash(file)).toBe(afterHash);
});

test('fresh Prisma column/index get only the three guards and marker, preserving all analytical rows', () => {
    const file = fixture(null);
    expect(installResultAttemptLinks({ dbPath: file })).toMatchObject({ classification: 'FRESH_PRISMA', totalChanges: 0 });
    const result = installResultAttemptLinks({ dbPath: file, apply: true });
    expect(result).toMatchObject({ previousClassification: 'FRESH_PRISMA', counts: { results: 1, linked: 0 }, totalChanges: 1 });
    expect(result.guards).toHaveLength(3);
});

test('partial schema and forged marker refuse with byte-identical databases and all-table zero changes', () => {
    for (const variant of ['partial', 'marker']) {
        const file = fixture(), db = new Database(file);
        try {
            if (variant === 'partial') db.exec('ALTER TABLE "Result" ADD COLUMN "attemptId" TEXT');
            else db.prepare('INSERT INTO "_schema_migrations" (id,details) VALUES (?,?)').run('182_result_attempt_links', '{"migrationSha256":"wrong"}');
        } finally { db.close(); }
        const before = originalState(file), digest = hash(file);
        expect(() => installResultAttemptLinks({ dbPath: file, apply: true })).toThrow(expect.objectContaining({ code: 'RESULT_ATTEMPT_SCHEMA_MISMATCH' }));
        expect(originalState(file)).toEqual(before); expect(hash(file)).toBe(digest);
    }
});

test('startup refuses a pending additive install and CLI rejects conflicting modes', () => {
    const file = fixture(), before = hash(file);
    expect(() => assertResultAttemptStartupReady(file)).toThrow(expect.objectContaining({ code: 'RESULT_ATTEMPT_NOT_INSTALLED' }));
    expect(hash(file)).toBe(before);
    expect(() => parseArguments(['--apply', '--dry-run'])).toThrow(expect.objectContaining({ code: 'RESULT_ATTEMPT_ARGUMENT_INVALID' }));
});

test('closed migration loader is hash-bound, cannot be aliased or shadowed into SQL authority', () => {
    expect(loadResultAttemptMigrationSource().sha256).toBe('aac7a1fc8e7a19ea993f6995032812e43ee4887bf0683da446438659061b235d');
    const header = "const {loadResultAttemptMigrationSource}=require('../services/resultAttemptMigrationSource');const source=loadResultAttemptMigrationSource();";
    expect(scanSource(header + 'db.exec(source.sql)', 'scripts/result-attempt-probe.js')).toEqual([]);
    expect(scanSource(header + 'const alias=source; db.exec(alias.sql)', 'scripts/result-attempt-probe.js')).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'UNRESOLVED_WORKFLOW_SQL' })]));
    expect(scanSource('function loadResultAttemptMigrationSource(){return {sql:input}}; const source=loadResultAttemptMigrationSource(); db.exec(source.sql)',
        'scripts/result-attempt-probe.js')).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'UNRESOLVED_WORKFLOW_SQL' })]));
});
