const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { assertOwnedTestDatabase } = require('../helpers/testOwnedDatabase');
const { installQcRuns, assertQcRunStartupReady } = require('../../scripts/install_qc_runs');
const { installQcGateScope, assertQcGateScopeStartupReady, parseArguments } = require('../../scripts/install_qc_gate_scope');
const { inspectScopeExtension } = require('../../services/qcDispositionScopeSchemaService');
const { scanSource } = require('../helpers/workflowWriteScanner');
const files = [];
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function fixture(fresh) {
    let file, batchId = randomUUID();
    if (fresh) {
        file = assertOwnedTestDatabase(path.resolve(__dirname, '../.tmp', `audit_scope_${randomUUID()}.db`), 'system:fixture');
        beforeGuards({ actor: 'system:fixture', file, qcBootstrap: 'CREATE_PRISMA' });
    } else {
        ({ file } = beforeGuards({ actor: 'system:fixture', schemaVariant: 'PRE_1_3_SAMPLE_CODES',
            batches: [{ id: batchId, analysis: 'SCOPE-FIXTURE', status: 'QC_FAIL', createdBy: 'system:fixture',
                disposition: JSON.stringify({ decision: 'REANALYZE_BATCH', reason: 'Retained original evidence',
                    by: 'retired actor', at: '2026-09-20T09:15:00Z' }) }] }));
    }
    files.push(file);
    const connection = new Database(file);
    try { connection.exec('CREATE TABLE "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL,"appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"details" TEXT)'); }
    finally { connection.close(); }
    require('../../scripts/install_reference_materials').installReferenceMaterials({ dbPath: file, apply: true });
    require('../../scripts/install_qc_rules').installQcRules({ dbPath: file, apply: true });
    const plan = installQcRuns({ dbPath: file });
    installQcRuns({ dbPath: file, apply: true, planSha256: plan.backfillFingerprint });
    const db = new Database(file);
    try {
        if (fresh) {
            db.prepare('INSERT INTO "Batch" (id,analysis,status,createdBy) VALUES (?,?,?,?)').run(batchId, 'SCOPE-FIXTURE', 'OPEN', 'system:fixture');
            db.prepare('INSERT INTO "BatchDisposition" (id,batchId,decision,reason,decidedBy,decidedAt) VALUES (?,?,?,?,?,?)')
                .run(randomUUID(), batchId, 'REPEAT_BATCH', 'Existing NULL scope', 'system:fixture', Date.now());
        }
        return { file, batchId, old: db.prepare('SELECT * FROM "BatchDisposition" ORDER BY id').all(),
            priorReceipt: db.prepare('SELECT * FROM "_schema_migrations" WHERE id=?').get('186_normalized_qc_runs'),
            oldTable: db.prepare("SELECT sql FROM sqlite_master WHERE name='BatchDisposition'").get().sql };
    } finally { db.close(); }
}

afterAll(() => {
    for (const file of files) for (const suffix of ['', '-wal', '-shm']) {
        const target = `${file}${suffix}`;
        if (fs.existsSync(target)) { fs.chmodSync(target, 0o600); fs.unlinkSync(target); }
    }
});

test.each([false, true])('scope installation preserves existing evidence without rebuilding (fresh Prisma=%s)', fresh => {
    const f = fixture(fresh), before = hash(f.file);
    expect(installQcGateScope({ dbPath: f.file })).toMatchObject({ classification: fresh ? 'FRESH_PRISMA' : 'PRE_187',
        mode: 'DRY_RUN', existingDispositionRows: 1, backfillCount: 0, bootstrapRebuild: [], totalChanges: 0 });
    expect(hash(f.file)).toBe(before);
    expect(() => assertQcGateScopeStartupReady(f.file)).toThrow(expect.objectContaining({ code: 'QC_GATE_SCOPE_NOT_INSTALLED' }));
    expect(hash(f.file)).toBe(before);
    const installed = installQcGateScope({ dbPath: f.file, apply: true });
    expect(installed).toMatchObject({ mode: 'APPLIED', classification: 'COMPLETE', totalChanges: 1, bootstrapRebuild: [], backfillCount: 0 });
    const reader = new Database(f.file);
    try {
        expect(reader.prepare('SELECT * FROM "BatchDisposition" ORDER BY id').all()).toEqual(f.old.map(row => ({ ...row, scope: null })));
        expect(reader.prepare('SELECT * FROM "_schema_migrations" WHERE id=?').get('186_normalized_qc_runs')).toEqual(f.priorReceipt);
        expect(inspectScopeExtension(reader).baseSql).toBe(fresh ? f.oldTable.replace(/,\s*"scope"\s+TEXT(?=\s*[,)])/, '') : f.oldTable);
        expect(reader.pragma('integrity_check', { simple: true })).toBe('ok');
        expect(reader.pragma('foreign_key_check')).toEqual([]);
        const insert = scope => reader.prepare('INSERT INTO "BatchDisposition" (id,batchId,decision,reason,decidedBy,decidedAt,scope) VALUES (?,?,?,?,?,?,?)')
            .run(randomUUID(), f.batchId, 'REPEAT_BRACKET', 'Reviewed bracket scope', 'system:fixture', Date.now(), scope);
        for (const scope of ['bad-json', '[]', '"string"', 'null', '7']) expect(() => insert(scope)).toThrow('BATCH_DISPOSITION_SCOPE_INVALID');
        insert('{"affectedPositionIds":[]}');
        expect(reader.prepare('SELECT COUNT(*) n FROM "BatchDisposition"').get().n).toBe(2);
        expect(() => reader.prepare('UPDATE "BatchDisposition" SET scope=? WHERE scope IS NOT NULL').run('{}')).toThrow();
        expect(() => reader.prepare('UPDATE "BatchDisposition" SET scope=? WHERE scope IS NULL').run('{}')).toThrow();
    } finally { reader.close(); }
    const completeHash = hash(f.file);
    expect(installQcGateScope({ dbPath: f.file, apply: true })).toMatchObject({ mode: 'NO_OP', totalChanges: 0 });
    expect(assertQcGateScopeStartupReady(f.file)).toMatchObject({ classification: 'COMPLETE', totalChanges: 0 });
    expect(assertQcRunStartupReady(f.file)).toMatchObject({ classification: 'COMPLETE', totalChanges: 0 });
    expect(hash(f.file)).toBe(completeHash);
});

test.each(['foreign-object', 'partial-guards', 'bad-receipt'])('unexpected scope installation refuses without writes: %s', fault => {
    const f = fixture(false);
    if (fault === 'bad-receipt') installQcGateScope({ dbPath: f.file, apply: true });
    const db = new Database(f.file);
    try {
        if (fault === 'foreign-object') db.exec('CREATE INDEX "unexpected_scope_index" ON "BatchDisposition"("reason")');
        if (fault === 'partial-guards') db.exec('ALTER TABLE "BatchDisposition" ADD COLUMN "scope" TEXT');
        if (fault === 'partial-guards') db.exec(`CREATE TRIGGER "BatchDisposition_scope_json_insert_guard"
            BEFORE INSERT ON "BatchDisposition"
            WHEN NEW."scope" IS NOT NULL AND (NOT json_valid(NEW."scope") OR json_type(NEW."scope") <> 'object')
            BEGIN SELECT RAISE(ABORT, 'BATCH_DISPOSITION_SCOPE_INVALID'); END;`);
        if (fault === 'bad-receipt') db.prepare('UPDATE "_schema_migrations" SET details=? WHERE id=?').run('{}', '187_qc_gate_scope');
    } finally { db.close(); }
    const before = hash(f.file);
    for (const apply of [false, true]) expect(() => installQcGateScope({ dbPath: f.file, apply })).toThrow();
    expect(hash(f.file)).toBe(before);
});

test('scope installer requires an explicit target and rejects unknown arguments', () => {
    expect(() => installQcGateScope()).toThrow(expect.objectContaining({ code: 'QC_GATE_SCOPE_DATABASE_REQUIRED' }));
    expect(parseArguments(['--db', 'owned.db', '--apply'])).toEqual({ dbPath: 'owned.db', apply: true });
    expect(() => parseArguments(['--repair'])).toThrow(expect.objectContaining({ code: 'QC_GATE_SCOPE_ARGUMENT_INVALID' }));
});

test('a failure inside the scope transaction rolls back all DDL and the retained verifier still passes', () => {
    const f = fixture(false), db = new Database(f.file);
    try { db.exec(`CREATE TRIGGER fixture_scope_receipt_refusal BEFORE INSERT ON "_schema_migrations"
        WHEN NEW.id='187_qc_gate_scope' BEGIN SELECT RAISE(ABORT,'FIXTURE_SCOPE_FAILURE'); END;`); }
    finally { db.close(); }
    const before = hash(f.file);
    expect(() => installQcGateScope({ dbPath: f.file, apply: true })).toThrow('FIXTURE_SCOPE_FAILURE');
    expect(hash(f.file)).toBe(before);
    expect(assertQcRunStartupReady(f.file)).toMatchObject({ classification: 'COMPLETE', totalChanges: 0 });
    const reader = new Database(f.file, { readonly: true });
    try {
        expect(inspectScopeExtension(reader).classification).toBe('PRE_187');
        expect(reader.prepare('SELECT * FROM "BatchDisposition" ORDER BY id').all()).toEqual(f.old);
    } finally { reader.close(); }
});

test('the scope loader is closed to the reviewed source and cannot authorize shadowed or changed SQL', () => {
    const imported = "const {loadScopeMigrationSource}=require('../services/qcDispositionScopeMigrationSource');";
    expect(scanSource(`${imported} const source=loadScopeMigrationSource(); db.exec(source.sql); db.exec(source.guardsSql);`,
        'scripts/scope_fixture.js')).toEqual([]);
    for (const body of [
        "const source=loadScopeMigrationSource('different.sql'); db.exec(source.sql);",
        "let source=loadScopeMigrationSource(); db.exec(source.sql);",
        "const source=loadScopeMigrationSource(); source.sql='UPDATE WorkItem SET status=\"DONE\"'; db.exec(source.sql);",
        "const source=loadScopeMigrationSource(); const alias=source; db.exec(alias.sql);"
    ]) expect(scanSource(imported + body, 'scripts/scope_fixture.js').length).toBeGreaterThan(0);
});
