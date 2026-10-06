const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { installSampleHolds, assertSampleHoldStartupReady, parseArguments } = require('../../scripts/install_sample_holds');
const { loadSampleHoldMigrationSource } = require('../../services/sampleHoldMigrationSource');
const { scanSource } = require('../helpers/workflowWriteScanner');
const files = [];
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function fixture(schemaVariant = 'PRE_1_3_SAMPLE_CODES') {
    const sampleId = randomUUID();
    const { file } = beforeGuards({ actor: 'system:fixture', schemaVariant, migrationOrder: 'REAL',
        samples: [{ id: sampleId, originalId: sampleId, status: 'PROCESSING', assignedLab: 'HOLD-MIGRATION-TEST', createdAt: new Date(), updatedAt: new Date() }],
        workItems: [{ id: randomUUID(), sampleId, analysis: 'HISTORICAL_PARAM', status: 'IN_PROGRESS', result: '6.75', createdAt: new Date(), updatedAt: new Date() }],
        relatedRows: { Result: [{ id: randomUUID(), sampleId, param: 'HISTORICAL_PARAM', value: '6.75', numericValue: 6.75,
            provenance: 'IMPORTED', flags: '["HISTORICAL_QC_FLAG"]', updatedAt: new Date().toISOString() }] } });
    files.push(file);
    const db = new Database(file);
    try {
        db.exec('CREATE TABLE IF NOT EXISTS "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL, "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "details" TEXT)');
        db.prepare('INSERT INTO "_schema_migrations" (id,details) VALUES (?,?)').run('older_release_fixture', '{"preserve":"exact"}');
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

test('real additive hold install preserves all old science, QC, audit, schema and foreign keys; repeat/startup are zero-write', () => {
    const file = fixture(), before = state(file), initialHash = hash(file);
    expect(installSampleHolds({ dbPath: file })).toMatchObject({ classification: 'PRE_183', mode: 'DRY_RUN', totalChanges: 0, backfillCount: 0 });
    expect(hash(file)).toBe(initialHash);
    expect(installSampleHolds({ dbPath: file, apply: true })).toMatchObject({ classification: 'COMPLETE', previousClassification: 'PRE_183', mode: 'APPLIED', totalChanges: 1, backfillCount: 0, counts: { workItems: 1, holds: 0 } });
    const db = new Database(file, { readonly: true, fileMustExist: true });
    try {
        for (const table of before.tables) {
            const fields = table.columns.map(column => `"${column.name}"`).join(',');
            expect(db.prepare(`SELECT ${fields} FROM "${table.name}" ${table.name === '_schema_migrations' ? "WHERE id <> '183_sample_holds_cancellation'" : ''} ORDER BY rowid`).all()).toEqual(table.rows);
            expect(db.prepare(`PRAGMA table_xinfo("${table.name}")`).all().slice(0, table.columns.length)).toEqual(table.columns);
            expect(db.prepare(`PRAGMA foreign_key_list("${table.name}")`).all()).toEqual(table.fks);
        }
        for (const object of before.objects) {
            const actual = db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type=? AND name=?').get(object.type, object.name);
            if (object.type === 'table' && object.name === 'WorkItem') {
                const oldSql = actual.sql.replace(/, "(?:cancellationCode|cancellationReason|cancelledBy|cancelledAt)" (?:TEXT|DATETIME)(?:\s+CHECK \("cancellationCode" IS NULL OR "cancellationCode" IN \('INTAKE_UNDONE','INTAKE_REJECTED'\)\))?/g, '');
                expect({ ...actual, sql: oldSql }).toEqual(object);
            } else expect(actual).toEqual(object);
        }
        expect(db.prepare('SELECT count(*) n FROM WorkItem WHERE cancellationCode IS NOT NULL OR cancellationReason IS NOT NULL OR cancelledBy IS NOT NULL OR cancelledAt IS NOT NULL').get().n).toBe(0);
        expect(db.pragma('integrity_check', { simple: true })).toBe('ok'); expect(db.pragma('foreign_key_check')).toEqual([]);
    } finally { db.close(); }
    const installedHash = hash(file);
    expect(installSampleHolds({ dbPath: file, apply: true })).toMatchObject({ mode: 'NO_OP', totalChanges: 0 });
    expect(assertSampleHoldStartupReady(file)).toMatchObject({ classification: 'COMPLETE', totalChanges: 0 });
    expect(hash(file)).toBe(installedHash);
});

test('fresh Prisma schemas get the exact partial index, seven guards and marker without rebuilding tables', () => {
    const file = fixture(null), before = state(file);
    expect(installSampleHolds({ dbPath: file })).toMatchObject({ classification: 'FRESH_PRISMA' });
    expect(installSampleHolds({ dbPath: file, apply: true })).toMatchObject({ previousClassification: 'FRESH_PRISMA', totalChanges: 1, guards: expect.any(Array) });
    expect(assertSampleHoldStartupReady(file).guards).toHaveLength(7);
    const after = state(file);
    for (const object of before.objects) expect(after.objects.find(row => row.type === object.type && row.name === object.name)).toEqual(object);
    for (const table of before.tables) {
        const actual = after.tables.find(row => row.name === table.name);
        expect({ ...actual, rows: table.name === '_schema_migrations' ? actual.rows.filter(row => row.id !== '183_sample_holds_cancellation') : actual.rows }).toEqual(table);
    }
    expect(installSampleHolds({ dbPath: file, apply: true })).toMatchObject({ mode: 'NO_OP', totalChanges: 0 });
});

test.each(['partial', 'marker'])('%s hold installation refuses with byte-identical database and zero table changes', variant => {
    const file = fixture(), db = new Database(file);
    try {
        if (variant === 'partial') db.exec('ALTER TABLE "WorkItem" ADD COLUMN "cancellationCode" TEXT');
        else db.prepare('INSERT INTO "_schema_migrations" (id,details) VALUES (?,?)').run('183_sample_holds_cancellation', '{"migrationSha256":"forged"}');
    } finally { db.close(); }
    const before = state(file), digest = hash(file);
    expect(() => installSampleHolds({ dbPath: file, apply: true })).toThrow(expect.objectContaining({ code: 'SAMPLE_HOLD_SCHEMA_MISMATCH' }));
    expect(state(file)).toEqual(before); expect(hash(file)).toBe(digest);
});

test('startup requires an exact complete installation and conflicting CLI modes refuse', () => {
    const file = fixture(), before = hash(file);
    expect(() => assertSampleHoldStartupReady(file)).toThrow(expect.objectContaining({ code: 'SAMPLE_HOLD_NOT_INSTALLED' }));
    expect(hash(file)).toBe(before);
    expect(() => parseArguments(['--apply', '--dry-run'])).toThrow(expect.objectContaining({ code: 'SAMPLE_HOLD_ARGUMENT_INVALID' }));
});

test('the hold loader is digest-bound and aliases/shadow functions cannot obtain SQL authority', () => {
    expect(loadSampleHoldMigrationSource().sha256).toBe('5fce16e8bc148e07880fe6afcc7f5aec1c94c319a5c98ddaeaf47450906b06a8');
    const header = "const {loadSampleHoldMigrationSource}=require('../services/sampleHoldMigrationSource');const source=loadSampleHoldMigrationSource();";
    expect(scanSource(header + 'db.exec(source.sql); db.exec(source.guardsSql); db.exec(source.indexSql)', 'scripts/hold-probe.js')).toEqual([]);
    expect(scanSource(header + 'const alias=source; db.exec(alias.sql)', 'scripts/hold-probe.js')).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'UNRESOLVED_WORKFLOW_SQL' })]));
    expect(scanSource('function loadSampleHoldMigrationSource(){return {sql:input}};const source=loadSampleHoldMigrationSource();db.exec(source.sql)', 'scripts/hold-probe.js'))
        .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'UNRESOLVED_WORKFLOW_SQL' })]));
});

test('unparseable source stays a closed scanner finding with its original line', () => {
    expect(scanSource('const okay = 1;\nconst broken = ;', 'scripts/hold-invalid-canary.js'))
        .toEqual([expect.objectContaining({ code: 'SOURCE_PARSE_FAILED', line: 2 })]);
});

test.each(['PRE_1_3_SAMPLE_CODES', null])('hold history is immutable on %s installs, including raw SQL writes', variant => {
    const file = fixture(variant); installSampleHolds({ dbPath: file, apply: true });
    const db = new Database(file);
    try {
        db.pragma('foreign_keys=ON');
        const sampleId = db.prepare('SELECT id FROM Sample LIMIT 1').get().id, id = randomUUID();
        db.prepare('INSERT INTO SampleHold (id,sampleId,type,reason,raisedBy,raisedAt,attributionSource) VALUES (?,?,?,?,?,?,?)')
            .run(id, sampleId, 'CUSTODY', 'Original evidence', 'original-manager', '2026-10-01T10:00:00Z', 'LIVE');
        const original = state(file);
        for (const [key, value] of Object.entries({ id: randomUUID(), sampleId: 'another-sample', type: 'OTHER', reason: 'Replacement',
            raisedBy: 'forged-manager', raisedAt: '2026-10-02T10:00:00Z', attributionSource: 'KOBO_CONFLICT_AUDIT', compatMarker: 'KOBO_PROVENANCE' })) {
            expect(() => db.prepare(`UPDATE SampleHold SET "${key}"=? WHERE id=?`).run(value, id)).toThrow('SAMPLE_HOLD_RAISE_IMMUTABLE');
            expect(state(file)).toEqual(original);
        }
        expect(() => db.prepare('DELETE FROM SampleHold WHERE id=?').run(id)).toThrow('SAMPLE_HOLD_DELETE_REFUSED');
        expect(state(file)).toEqual(original);
        db.prepare('UPDATE SampleHold SET resolvedAt=?,resolvedBy=?,resolution=? WHERE id=?')
            .run('2026-10-03T10:00:00Z', 'reviewing-manager', 'Evidence reconciled', id);
        const resolved = state(file);
        for (const [key, value] of [['resolvedAt', null], ['resolvedBy', 'replacement-manager'], ['resolution', 'Replacement reason']]) {
            expect(() => db.prepare(`UPDATE SampleHold SET "${key}"=? WHERE id=?`).run(value, id)).toThrow('SAMPLE_HOLD_RESOLUTION_IMMUTABLE');
            expect(state(file)).toEqual(resolved);
        }
        expect(() => db.prepare('DELETE FROM SampleHold WHERE id=?').run(id)).toThrow('SAMPLE_HOLD_DELETE_REFUSED');
        expect(state(file)).toEqual(resolved);
    } finally { db.close(); }
});

test.each(['SampleHold_raise_immutable', 'SampleHold_resolution_final', 'SampleHold_delete_refusal'])('startup refuses a missing %s history guard with zero writes', guard => {
    const file = fixture(); installSampleHolds({ dbPath: file, apply: true });
    const db = new Database(file); try { db.exec(`DROP TRIGGER "${guard}"`); } finally { db.close(); }
    const before = state(file), bytes = hash(file);
    expect(() => assertSampleHoldStartupReady(file)).toThrow(expect.objectContaining({ code: 'SAMPLE_HOLD_SCHEMA_MISMATCH' }));
    expect(state(file)).toEqual(before); expect(hash(file)).toBe(bytes);
});
