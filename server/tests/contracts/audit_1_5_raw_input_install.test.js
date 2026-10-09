const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const Database = require('better-sqlite3');
const { createRawInputSupportedBaselineFixture } = require('../helpers/rawInputHistoricalFixture');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { assertOwnedTestDatabase } = require('../helpers/testOwnedDatabase');
const { installResultRawInput, parseArguments } = require('../../scripts/install_result_raw_input');
const { loadResultRawInputMigrationSource } = require('../../services/resultRawInputMigrationSource');
const { scanSource } = require('../helpers/workflowWriteScanner');
const files = [];
const serverRoot = path.resolve(__dirname, '../..');
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function baseline() {
    const { file } = createRawInputSupportedBaselineFixture(); files.push(file); return file;
}
function emptyProbe(kind) {
    const directory = path.resolve(__dirname, '../.tmp'); fs.mkdirSync(directory, { recursive: true });
    const file = assertOwnedTestDatabase(path.join(directory, `audit_legacy_raw_probe_${randomUUID()}.db`), 'system:fixture');
    files.push(file);
    const db = new Database(file);
    try {
        switch (kind) {
        case 'type': db.exec('CREATE TABLE "Result" ("id" TEXT PRIMARY KEY NOT NULL, "rawInput" REAL)'); break;
        case 'nullability': db.exec('CREATE TABLE "Result" ("id" TEXT PRIMARY KEY NOT NULL, "rawInput" TEXT NOT NULL)'); break;
        case 'default': db.exec('CREATE TABLE "Result" ("id" TEXT PRIMARY KEY NOT NULL, "rawInput" TEXT DEFAULT NULL)'); break;
        case 'non-null-default': db.exec('CREATE TABLE "Result" ("id" TEXT PRIMARY KEY NOT NULL, "rawInput" TEXT DEFAULT \'forged\')'); break;
        case 'generated': db.exec('CREATE TABLE "Result" ("id" TEXT PRIMARY KEY NOT NULL, "rawInput" TEXT GENERATED ALWAYS AS (id) VIRTUAL)'); break;
        case 'primary': db.exec('CREATE TABLE "Result" ("id" TEXT NOT NULL, "rawInput" TEXT PRIMARY KEY)'); break;
        case 'view': db.exec('CREATE VIEW "Result" AS SELECT 1 AS id'); break;
        case 'absent-table': break;
        default: throw Error('Unknown owned probe.');
        }
    } finally { db.close(); }
    return file;
}
function state(file) {
    const db = new Database(file, { readonly: true, fileMustExist: true });
    try {
        return { objects: db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all(),
            tables: db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({ name }) => ({ name,
                columns: db.prepare(`PRAGMA table_xinfo("${name}")`).all(), fks: db.prepare(`PRAGMA foreign_key_list("${name}")`).all(),
                rows: db.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all() })) };
    } finally { db.close(); }
}

afterAll(() => { for (const file of files) fs.rmSync(assertOwnedTestDatabase(file, 'system:fixture'), { force: true }); });

test('populated genuine supported-baseline shape is upgraded once, preserving every old field, object, FK and receipt', () => {
    const file = baseline(), before = state(file), beforeHash = digest(file);
    const originalResults = before.tables.find(table => table.name === 'Result');
    expect(originalResults.rows).toHaveLength(3);
    expect(originalResults.columns.some(column => column.name === 'rawInput')).toBe(false);
    expect(installResultRawInput({ dbPath: file })).toMatchObject({ mode: 'DRY_RUN', classification: 'ABSENT', counts: { results: 3 }, backfillCount: 0, totalChanges: 0 });
    expect(digest(file)).toBe(beforeHash); expect(state(file)).toEqual(before);
    expect(installResultRawInput({ dbPath: file, apply: true })).toMatchObject({ mode: 'APPLIED', previousClassification: 'ABSENT',
        classification: 'ALREADY_PRESENT', counts: { results: 3, recordedRawInputs: 0 }, backfillCount: 0, totalChanges: 0 });
    const db = new Database(file, { readonly: true, fileMustExist: true });
    try {
        for (const table of before.tables) {
            expect(db.prepare(`SELECT ${table.columns.map(column => `"${column.name}"`).join(',')} FROM "${table.name}" ORDER BY rowid`).all()).toEqual(table.rows);
            expect(db.prepare(`PRAGMA table_xinfo("${table.name}")`).all().slice(0, table.columns.length)).toEqual(table.columns);
            expect(db.prepare(`PRAGMA foreign_key_list("${table.name}")`).all()).toEqual(table.fks);
        }
        for (const object of before.objects) {
            const actual = db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type=? AND name=?').get(object.type, object.name);
            if (object.type === 'table' && object.name === 'Result') expect(actual.sql.replace(', "rawInput" TEXT', '')).toBe(object.sql);
            else expect(actual).toEqual(object);
        }
        expect(db.prepare('SELECT rawInput FROM "Result" ORDER BY id').all()).toEqual([{ rawInput: null }, { rawInput: null }, { rawInput: null }]);
        expect(db.pragma('integrity_check', { simple: true })).toBe('ok'); expect(db.pragma('foreign_key_check')).toEqual([]);
    } finally { db.close(); }
    const installedState = state(file), installedHash = digest(file);
    expect(installResultRawInput({ dbPath: file, apply: true })).toMatchObject({ mode: 'NO_OP', totalChanges: 0, backfillCount: 0 });
    expect(state(file)).toEqual(installedState); expect(digest(file)).toBe(installedHash);
});

test('an existing nullable TEXT column is a byte-identical no-op, including exact recorded rawInput values', () => {
    const sampleId = randomUUID();
    const { file } = beforeGuards({ actor: 'system:fixture', samples: [{ id: sampleId, originalId: sampleId, status: 'PROCESSING', updatedAt: new Date() }],
        relatedRows: { Result: [{ id: randomUUID(), sampleId, param: 'SOC', value: '6.75', numericValue: 6.75,
            rawInput: ' 6,7500 é精确 ', provenance: 'IMPORTED', flags: '["KEEP_QC"]', updatedAt: '2026-09-01T00:00:00Z' }] } });
    files.push(file);
    const before = state(file), hash = digest(file);
    expect(installResultRawInput({ dbPath: file })).toMatchObject({ classification: 'ALREADY_PRESENT', mode: 'DRY_RUN', counts: { results: 1, recordedRawInputs: 1 } });
    expect(installResultRawInput({ dbPath: file, apply: true })).toMatchObject({ classification: 'ALREADY_PRESENT', mode: 'NO_OP', totalChanges: 0 });
    expect(state(file)).toEqual(before); expect(digest(file)).toBe(hash);
});

test.each(['type', 'nullability', 'default', 'non-null-default', 'generated', 'primary', 'view', 'absent-table'])(
    'unexpected %s shape is refused before any write on a separate empty owned probe', kind => {
        const file = emptyProbe(kind), before = state(file), hash = digest(file);
        for (const apply of [false, true]) expect(() => installResultRawInput({ dbPath: file, apply })).toThrow(expect.objectContaining({ code: 'RESULT_RAW_INPUT_SCHEMA_MISMATCH' }));
        expect(state(file)).toEqual(before); expect(digest(file)).toBe(hash);
    });

test.each(['changed SQL', 'CRLF'])('%s source is refused with zero database writes', kind => {
    const file = baseline(), before = state(file), hash = digest(file);
    const sourceFile = path.resolve(serverRoot, 'prisma/migrations/20261004064500_add_result_raw_input/migration.sql');
    const read = fs.readFileSync;
    const spy = jest.spyOn(fs, 'readFileSync').mockImplementation((target, ...args) => {
        const bytes = read(target, ...args);
        if (path.resolve(String(target)) !== sourceFile) return bytes;
        return Buffer.from(kind === 'CRLF' ? String(bytes).replace(/\n/g, '\r\n') : String(bytes).replace('TEXT', 'REAL'));
    });
    try { expect(() => installResultRawInput({ dbPath: file, apply: true })).toThrow(expect.objectContaining({ code: 'RESULT_RAW_INPUT_SOURCE_MISMATCH' })); }
    finally { spy.mockRestore(); }
    expect(state(file)).toEqual(before); expect(digest(file)).toBe(hash);
});

test('CLI defaults to read-only dry-run and requires an explicit database and unambiguous mode', () => {
    const file = baseline(), hash = digest(file);
    const result = JSON.parse(execFileSync(process.execPath, [path.resolve(serverRoot, 'scripts/install_result_raw_input.js'), '--db', file], { encoding: 'utf8' }));
    expect(result).toMatchObject({ classification: 'ABSENT', mode: 'DRY_RUN', totalChanges: 0 }); expect(digest(file)).toBe(hash);
    for (const args of [[], ['--apply'], ['--db'], ['--db', file, '--apply', '--dry-run'], ['--db', file, '--apply', '--apply'], ['--db', file, '--unknown']]) {
        expect(() => parseArguments(args)).toThrow(expect.objectContaining({ code: 'RESULT_RAW_INPUT_ARGUMENT_INVALID' }));
    }
    expect(() => installResultRawInput()).toThrow(expect.objectContaining({ code: 'RESULT_RAW_INPUT_DATABASE_REQUIRED' }));
});

test('only the exact source is inspected; an aliased or changed loader grants no SQL authority', () => {
    expect(loadResultRawInputMigrationSource().sha256).toBe('850a47806543f1e6587641daa918fe586b6cbb4bfece5a6920132e4b74c593cc');
    const probe = "const {loadResultRawInputMigrationSource}=require('../services/resultRawInputMigrationSource'); const source=loadResultRawInputMigrationSource();";
    expect(scanSource(probe + 'db.exec(source.sql)', 'scripts/raw-input-probe.js')).toEqual([]);
    expect(scanSource(probe + 'const alias=source; db.exec(alias.sql)', 'scripts/raw-input-probe.js')).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'UNRESOLVED_WORKFLOW_SQL' })]));
    const loader = path.join(serverRoot, 'services/resultRawInputMigrationSource.js'), read = fs.readFileSync;
    const spy = jest.spyOn(fs, 'readFileSync').mockImplementation((target, ...args) => {
        const bytes = read(target, ...args); return path.resolve(String(target)) === loader ? Buffer.from(String(bytes) + '\n// changed\n') : bytes;
    });
    try { expect(scanSource(probe + 'db.exec(source.sql)', 'scripts/raw-input-probe.js')).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'UNRESOLVED_WORKFLOW_SQL' })])); }
    finally { spy.mockRestore(); }
});

test('the supported-baseline factory is exact, accepts no arguments, and has only one allowed caller', () => {
    expect(() => createRawInputSupportedBaselineFixture({ file: 'arbitrary' })).toThrow('accepts no arguments');
    const factory = 'tests/helpers/rawInputHistoricalFixture.js', source = fs.readFileSync(path.join(serverRoot, factory), 'utf8');
    expect(scanSource(source, factory)).toEqual([]);
    expect(scanSource(source + '\n// changed\n', factory)).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'HISTORICAL_FIXTURE_SOURCE_MISMATCH' })]));
    const importSource = "require('../helpers/rawInputHistoricalFixture')";
    expect(scanSource(importSource, 'tests/contracts/audit_1_5_raw_input_install.test.js')).toEqual([]);
    expect(scanSource(importSource, 'tests/contracts/second_caller.test.js')).toEqual([expect.objectContaining({ code: 'HISTORICAL_FIXTURE_CALLER_NOT_ALLOWED' })]);
    expect(scanSource("require('../tests/helpers/rawInputHistoricalFixture')", 'services/probe.js')).toEqual([expect.objectContaining({ code: 'TEST_HELPER_IMPORTED_BY_RUNTIME' })]);
});

test('Docker retains the exact DDL outside the volume and installs it before dependent NCR guards', () => {
    const root = path.resolve(serverRoot, '..'), entrypoint = fs.readFileSync(path.join(root, 'docker-entrypoint.sh'), 'utf8');
    const rawInstall = entrypoint.indexOf('node scripts/install_result_raw_input.js --db "${DATABASE_PATH:-$DB_FILE}" --apply');
    expect(rawInstall).toBeGreaterThan(entrypoint.indexOf('node scripts/install_qc_gate_scope.js'));
    expect(rawInstall).toBeLessThan(entrypoint.indexOf('node scripts/bootstrap_pt_nonconformity.js'));
    expect(fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8')).toContain('COPY server/prisma/migrations/20261004064500_add_result_raw_input/migration.sql /app/server/.migrations-backup/272/20261004064500_add_result_raw_input/migration.sql');
});
