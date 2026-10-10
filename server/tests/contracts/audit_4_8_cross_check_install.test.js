const fs = require('node:fs'), path = require('node:path'), { randomUUID, createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('../../prisma_client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { createPre201CrossCheckFixture } = require('../helpers/crossCheckHistoricalFixture');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const { createExecutionResultFixture } = require('../helpers/workAttemptFixtures');
const { loadCrossCheckMigrationSource } = require('../../services/crossCheckMigrationSource');
const { installCrossCheckEvaluations: install, assertCrossCheckStartupReady: ready, parseArguments } = require('../../scripts/install_cross_check_evaluations');
const { scanSource } = require('../helpers/workflowWriteScanner');
const root = path.resolve(__dirname, '../..'), marker = '201_cross_check_evaluations';
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const retainedFiles = [];
async function fixture() {
    const { file } = createPre201CrossCheckFixture(); retainedFiles.push(file);
    const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:' + file }) });
    const labId = 'cross-lab-' + randomUUID();
    let sample;
    try {
        await db.lab.create({ data: { id: labId, code: labId, name: 'Owned cross-check laboratory', country: 'GTM' } });
        sample = await createSampleFixture(db, { data: { id: randomUUID(), originalId: 'CROSS-' + randomUUID(),
            assignedLab: labId, country: 'GTM', projectCode: 'OWNED-CROSS', status: 'PROCESSING',
            metadata: '{"preserve":"é精确"}', history: '[{"old":"retained"}]' } });
        await createWorkItemFixture(db, { data: { id: randomUUID(), sampleId: sample.id, assignedLab: labId, analysis: 'SOC', status: 'IN_PROGRESS' } });
        await createExecutionResultFixture(db, { data: { id: randomUUID(), sampleId: sample.id, param: 'SOC',
            value: '6.7500', rawInput: '6.7500', numericValue: 6.75, unit: 'g/kg', basis: 'AIR_DRY',
            flags: '["RETAINED_QC_FLAG"]', censoring: 'NONE', isCurrent: true, provenance: 'MEASURED' } });
    } finally { await db.$disconnect(); }
    return { file, labId, sampleId: sample.id };
}
function state(file) {
    const db = new Database(file, { readonly: true, fileMustExist: true });
    try {
        const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.name);
        return { objects: db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all(),
            rows: Object.fromEntries(names.map(name => [name, db.prepare('SELECT * FROM "' + name + '" ORDER BY rowid').all()])),
            shapes: Object.fromEntries(names.map(name => [name, { columns: db.prepare('PRAGMA table_xinfo("' + name + '")').all(),
                foreignKeys: db.prepare('PRAGMA foreign_key_list("' + name + '")').all() }])),
            integrity: db.pragma('integrity_check', { simple: true }), foreignKeys: db.pragma('foreign_key_check') };
    } finally { db.close(); }
}
const rowData = f => ({ id: 'cross-evaluation-' + randomUUID(), sampleId: f.sampleId, labId: f.labId,
    trigger: 'SUBMISSION', ruleCode: 'BASES_CEC', outcome: 'FLAGGED', reasonCode: null,
    inputs: '{"values":[{"value":13,"unit":"cmol(+)/kg","basis":"AIR_DRY","censoring":"NONE"}]}',
    thresholds: '{"policyVersion":1,"crossCheck.basesCecFactor":1.1}', evaluatedBy: 'owned-reviewer', evaluatedAt: 123 });
function append(db, f) {
    const data = rowData(f);
    db.prepare('INSERT INTO CrossCheckEvaluation(id,sampleId,labId,"trigger",ruleCode,outcome,reasonCode,inputs,thresholds,evaluatedBy,evaluatedAt) VALUES(@id,@sampleId,@labId,@trigger,@ruleCode,@outcome,@reasonCode,@inputs,@thresholds,@evaluatedBy,@evaluatedAt)').run(data);
    return data;
}

test('PRE_201 upgrades additively with every original analytical/QC/audit field, object, FK and receipt retained', async () => {
    const f = await fixture(), before = state(f.file), originalHash = hash(f.file);
    expect(before.rows.Result).toHaveLength(1);
    expect(before.rows.Result[0]).toMatchObject({ rawInput: '6.7500', numericValue: 6.75, flags: '["RETAINED_QC_FLAG"]' });
    expect(before.rows.AuditLog.length).toBeGreaterThan(0);
    expect(install({ dbPath: f.file })).toMatchObject({ classification: 'PRE_201', mode: 'DRY_RUN', totalChanges: 0, newEvaluationCount: 0, backfilledCount: 0 });
    expect(state(f.file)).toEqual(before); expect(hash(f.file)).toBe(originalHash);
    const applied = install({ dbPath: f.file, apply: true });
    expect(applied).toMatchObject({ classification: 'COMPLETE_201', previousClassification: 'PRE_201', mode: 'APPLIED',
        newEvaluationCount: 0, backfilledCount: 0, receipt: { originalRowsPreserved: true } });
    const after = state(f.file);
    for (const [name, rows] of Object.entries(before.rows)) {
        expect(after.rows[name].filter(row => name !== '_schema_migrations' || row.id !== marker)).toEqual(rows);
        expect(after.shapes[name]).toEqual(before.shapes[name]);
    }
    expect(after.objects.filter(row => row.tbl_name !== 'CrossCheckEvaluation')).toEqual(before.objects);
    expect(after.rows.CrossCheckEvaluation).toEqual([]);
    expect(after.rows._schema_migrations).toHaveLength(before.rows._schema_migrations.length + 1);
    expect(after.shapes.CrossCheckEvaluation.foreignKeys.map(row => [row.table, row.on_delete]).sort())
        .toEqual([['Lab', 'RESTRICT'], ['Sample', 'RESTRICT']]);
    expect(ready(f.file).classification).toBe('COMPLETE_201');
    const installedHash = hash(f.file);
    expect(install({ dbPath: f.file, apply: true })).toMatchObject({ mode: 'NO_OP', totalChanges: 0, backfilledCount: 0 });
    expect(hash(f.file)).toBe(installedHash); expect(state(f.file)).toEqual(after);
});
test('real direct startup refuses missing cross-check installation before app startup and preserves the owned file', async () => {
    const f = await fixture();
    require('../../scripts/bootstrap_pt_nonconformity').bootstrapPtNonconformity({ dbPath: f.file, apply: true });
    // #199 is merged and now precedes the #201 startup gate. Install its real
    // additive owner on this owned historical file; retain honest catalogue
    // deferrals, with no fabricated catalogue or expanded fixture authority.
    const calculations=require('../../scripts/install_calculation_templates').installCalculationTemplates({dbPath:f.file,apply:true});
    expect(calculations.classification).toBe('COMPLETE');expect(calculations.plannedUnitInsertCount).toBe(0);
    expect(calculations.backfillCount).toBe(0);
    const before = state(f.file), bytes = hash(f.file);
    const child = spawnSync(process.execPath, [path.join(root, 'index.js')], { cwd: root,
        env: { ...process.env, NODE_ENV: 'test', DATABASE_PATH: f.file, DATABASE_URL: 'file:' + f.file, PORT: '0' },
        encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024 });
    expect(child.error).toBeUndefined(); expect(child.status).toBe(1);
    expect(child.stdout).toContain('RESULT_OVERRIDE_STARTUP_READY');
    expect(child.stdout).toContain('CALCULATION_STARTUP_READY');
    expect(child.stdout).not.toContain('CROSS_CHECK_STARTUP_READY');
    expect(child.stderr).toContain('CROSS_CHECK_NOT_INSTALLED');
    expect(child.stderr).toContain('docs/audit/201-cross-parameter-checks.md');
    expect(state(f.file)).toEqual(before); expect(hash(f.file)).toBe(bytes);
});
test('the exact fresh Prisma table is classified separately and receives only guards/receipt with0 backfill', async () => {
    const f = await fixture(), db = new Database(f.file);
    try { const ddl = loadCrossCheckMigrationSource(); db.exec(ddl.schemaSql); } finally { db.close(); }
    const before = state(f.file), bytes = hash(f.file);
    expect(install({ dbPath: f.file })).toMatchObject({ classification: 'FRESH_PRISMA', totalChanges: 0 });
    expect(hash(f.file)).toBe(bytes);
    expect(install({ dbPath: f.file, apply: true })).toMatchObject({ previousClassification: 'FRESH_PRISMA', classification: 'COMPLETE_201', backfilledCount: 0 });
    const after = state(f.file);
    for (const [name, rows] of Object.entries(before.rows)) expect(after.rows[name].filter(row => name !== '_schema_migrations' || row.id !== marker)).toEqual(rows);
    expect(after.shapes).toEqual(before.shapes);
});
test.each(['foreign-table', 'extra-index', 'wrong-guard', 'partial-guard', 'populated-fresh', 'unmarked-complete', 'forged-complete-receipt'])
('foreign/partial/unmarked state %s refuses dry-run and apply with exactly0 writes', async kind => {
    const f = await fixture(), db = new Database(f.file);
    try {
        if (kind === 'foreign-table') db.exec('CREATE TABLE CrossCheckEvaluation (id TEXT PRIMARY KEY, sampleId TEXT)');
        else { const ddl = loadCrossCheckMigrationSource(); db.exec(ddl.schemaSql); }
        if (kind === 'extra-index') db.exec('CREATE INDEX CrossCheckEvaluation_foreign_idx ON CrossCheckEvaluation(ruleCode)');
        if (kind === 'wrong-guard') db.exec('CREATE TRIGGER CrossCheckEvaluation_update_immutable BEFORE UPDATE ON CrossCheckEvaluation BEGIN SELECT 1; END;');
        if (kind === 'partial-guard') db.exec("CREATE TRIGGER CrossCheckEvaluation_update_immutable BEFORE UPDATE ON CrossCheckEvaluation BEGIN SELECT RAISE(ABORT,'CROSS_CHECK_EVALUATION_IMMUTABLE'); END;");
        if (kind === 'populated-fresh') append(db, f);
        if (['unmarked-complete', 'forged-complete-receipt'].includes(kind)) {
            const ddl = loadCrossCheckMigrationSource(); db.exec(ddl.guardsSql);
            if (kind === 'forged-complete-receipt') db.prepare('INSERT INTO _schema_migrations(id,details) VALUES(?,?)').run(marker, '{}');
        }
    } finally { db.close(); }
    const before = state(f.file), bytes = hash(f.file);
    for (const apply of [false, true]) {
        expect(() => install({ dbPath: f.file, apply })).toThrow(expect.objectContaining({ code: 'CROSS_CHECK_SCHEMA_MISMATCH', statusCode: 409, totalChanges: 0 }));
        expect(state(f.file)).toEqual(before); expect(hash(f.file)).toBe(bytes);
    }
});
test('a late receipt refusal rolls back table, indexes and guards and retains all original evidence', async () => {
    const f = await fixture(), db = new Database(f.file);
    try { db.exec("CREATE TRIGGER Cross_owned_receipt_refusal BEFORE INSERT ON _schema_migrations WHEN NEW.id='201_cross_check_evaluations' BEGIN SELECT RAISE(ABORT,'OWNED_RECEIPT_REFUSAL'); END;"); }
    finally { db.close(); }
    const before = state(f.file);
    expect(() => install({ dbPath: f.file, apply: true })).toThrow(expect.objectContaining({ code: 'CROSS_CHECK_INSTALL_REFUSED', statusCode: 409, totalChanges: 0 }));
    expect(state(f.file)).toEqual(before);
});
test('every evidence column and deletion is immutable; sample/lab FKs retain the parent rows', async () => {
    const f = await fixture(); install({ dbPath: f.file, apply: true });
    const db = new Database(f.file); db.pragma('foreign_keys=ON');
    try {
        const row = append(db, f), before = state(f.file);
        for (const field of Object.keys(row)) {
            expect(() => db.prepare('UPDATE CrossCheckEvaluation SET "' + field + '"=? WHERE id=?').run(field === 'evaluatedAt' ? 456 : 'changed', row.id))
                .toThrow('CROSS_CHECK_EVALUATION_IMMUTABLE');
            expect(state(f.file)).toEqual(before);
        }
        expect(() => db.prepare('DELETE FROM CrossCheckEvaluation WHERE id=?').run(row.id)).toThrow('CROSS_CHECK_EVALUATION_IMMUTABLE');
        expect(() => db.prepare('DELETE FROM Lab WHERE id=?').run(f.labId)).toThrow(/FOREIGN KEY/);
        expect(state(f.file)).toEqual(before);
        expect(ready(f.file).evaluationCount).toBe(1);
    } finally { db.close(); }
});
test.each(['prisma/migrations/20261010000100_cross_check_evaluation/migration.sql', 'prisma/migrations/20261010000100_cross_check_evaluation/fresh-prisma-tables.json'])
('tampered %s is refused by both loader and scanner rather than trusted as SQL', file => {
    const target = path.join(root, file), original = fs.readFileSync.bind(fs);
    const spy = jest.spyOn(fs, 'readFileSync').mockImplementation((name, ...args) => {
        const data = original(name, ...args);
        if (path.resolve(String(name)) !== target) return data;
        return Buffer.isBuffer(data) ? Buffer.concat([data, Buffer.from('\n changed bytes\n')]) : data + '\n changed bytes\n';
    });
    try {
        expect(() => loadCrossCheckMigrationSource()).toThrow(expect.objectContaining({ code: 'CROSS_CHECK_SOURCE_MISMATCH' }));
        const code = "const {loadCrossCheckMigrationSource}=require('../services/crossCheckMigrationSource'); const ddl=loadCrossCheckMigrationSource(); db.exec(ddl.schemaSql);";
        expect(scanSource(code, 'scripts/probe.js')).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'UNRESOLVED_WORKFLOW_SQL' })]));
    } finally { spy.mockRestore(); }
});
test('closed historical factory stays byte-bound, takes no arguments, and refuses unlisted/runtime callers', () => {
    expect(() => createPre201CrossCheckFixture({})).toThrow('accepts no arguments');
    const file = 'tests/helpers/crossCheckHistoricalFixture.js', source = fs.readFileSync(path.join(root, file), 'utf8');
    expect(scanSource(source, file)).toEqual([]);
    expect(scanSource(source + '\n// changed factory bytes\n', file)).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'HISTORICAL_FIXTURE_SOURCE_MISMATCH' })]));
    const caller = "const {createPre201CrossCheckFixture}=require('../helpers/crossCheckHistoricalFixture'); createPre201CrossCheckFixture();";
    expect(scanSource(caller, 'tests/contracts/unlisted.test.js')).toEqual([expect.objectContaining({ code: 'HISTORICAL_FIXTURE_CALLER_NOT_ALLOWED' })]);
    expect(scanSource("require('../tests/helpers/crossCheckHistoricalFixture')", 'services/canary.js'))
        .toEqual([expect.objectContaining({ code: 'TEST_HELPER_IMPORTED_BY_RUNTIME' })]);
});
test('a changed loader body or mutable/aliased/parameterized import never grants a SQL authority', () => {
    const code = "const {loadCrossCheckMigrationSource}=require('../services/crossCheckMigrationSource'); const ddl=loadCrossCheckMigrationSource(); db.exec(ddl.schemaSql);";
    expect(scanSource(code, 'scripts/probe.js')).toEqual([]);
    for (const changed of [code.replace('const ddl=', 'let ddl='), code.replace('loadCrossCheckMigrationSource();', "loadCrossCheckMigrationSource('other');"),
        code.replace('ddl.schemaSql', "ddl['schemaSql']"), code.replace('db.exec', 'ddl={}; db.exec')])
        expect(scanSource(changed, 'scripts/probe.js')).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'UNRESOLVED_WORKFLOW_SQL' })]));
    const target = path.join(root, 'services/crossCheckMigrationSource.js'), original = fs.readFileSync.bind(fs);
    const spy = jest.spyOn(fs, 'readFileSync').mockImplementation((name, ...args) => {
        const data = original(name, ...args);
        if (path.resolve(String(name)) !== target) return data;
        return Buffer.isBuffer(data) ? Buffer.concat([data, Buffer.from('\n// changed loader\n')]) : data + '\n// changed loader\n';
    });
    try { expect(scanSource(code, 'scripts/probe.js')).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'UNRESOLVED_WORKFLOW_SQL' })])); }
    finally { spy.mockRestore(); }
});
test('CLI requires an explicit database and one unambiguous execution mode', () => {
    expect(parseArguments(['--db', '/owned/test.db'])).toEqual({ dbPath: '/owned/test.db' });
    expect(parseArguments(['--db', '/owned/test.db', '--apply'])).toEqual({ dbPath: '/owned/test.db', apply: true });
    for (const args of [[], ['--apply'], ['--db'], ['--db', '/owned/test.db', '--apply', '--dry-run'], ['--db', 'a', '--db', 'b'], ['--other']])
        expect(() => parseArguments(args)).toThrow(expect.objectContaining({ code: 'CROSS_CHECK_ARGUMENT_INVALID' }));
});
// The owned files are deliberately retained as migration/guard evidence.
