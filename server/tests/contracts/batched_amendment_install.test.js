const fs = require('node:fs');
const { createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { installBatchedAmendmentMembership, assertBatchedAmendmentStartupReady, parseArguments } =
    require('../../scripts/install_batched_amendment_membership');
const { MARKER, GUARD } = require('../../services/batchedAmendmentInstallationEvidence');
const { normalize } = require('../../services/workRepeatInstallationEvidence');
const { loadBatchedAmendmentMigrationSource } = require('../../services/batchedAmendmentMigrationSource');
const owned = [];
afterEach(async () => { for (const f of owned.splice(0)) await f.close(); });
async function fixture() {
    const f = await qcGateFixture({ installBatchedAmendments: false });
    owned.push(f);
    await f.result(f.items[0]);
    return f;
}
const bytes = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function inspect(file) {
    const db = new Database(file, { readonly: true });
    try {
        return { schema: db.prepare("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all(),
            rows: require('../../services/retainedRowsFingerprint').fingerprintRetainedTables(db) };
    } finally { db.close(); }
}

test('the new source retains every prior predicate byte for byte and has one additive alternative', () => {
    const old = require('../../services/closedQcRepeatMigrationSource').loadClosedQcRepeatMigrationSource().guardSql;
    const source = loadBatchedAmendmentMigrationSource();
    const at = old.indexOf('\nBEGIN\n');
    expect(source.guardSql.startsWith(old.slice(0, at))).toBe(true);
    expect(source.guardSql.endsWith(old.slice(at))).toBe(true);
    const added = source.guardSql.slice(at, -old.slice(at).length);
    expect(added.startsWith('\n AND NOT (NEW.batchId IS NULL AND NEW.rackPosition IS NULL')).toBe(true);
    expect(added).toContain("amendment.type='SCIENTIFIC' AND amendment.status='APPROVED'");
    expect(added).toContain("OLD.status='ACCEPTED' AND NEW.status='REPEAT_REQUIRED'");
    expect(source.sql.slice(0, source.sql.indexOf('CREATE TRIGGER'))).toContain('DROP TRIGGER "' + GUARD + '";');
    expect(bytes(require.resolve('../../prisma/migrations/20261008000200_repeat_correction_contract/migration.sql')))
        .toBe('600a4d92ef55c91ffcf6f308a14e2591f929ac6299dc0818961a20225771c7dd');
});

test('owned-copy rehearsal preserves all rows, installs atomically and is idempotent through the predecessor chain', async () => {
    const f = await fixture(), before = inspect(f.file), originalBytes = bytes(f.file);
    const plan = installBatchedAmendmentMembership({ dbPath: f.file });
    expect(plan).toMatchObject({ classification: 'PRE_413', mode: 'DRY_RUN', totalChanges: 0 });
    expect(bytes(f.file)).toBe(originalBytes);
    expect(() => assertBatchedAmendmentStartupReady(f.file)).toThrow('before startup');
    const result = installBatchedAmendmentMembership({ dbPath: f.file, apply: true });
    expect(result).toMatchObject({ classification: 'COMPLETE', mode: 'APPLIED', totalChanges: 1,
        receipt: { retainedRowsPreserved: true, rowsSha256: plan.rowsSha256, migrationsSha256: plan.migrationsSha256 } });
    const after = inspect(f.file);
    expect(after.schema.filter(row => row.name !== GUARD)).toEqual(before.schema.filter(row => row.name !== GUARD));
    expect(after.schema.find(row => row.name === GUARD).sql).toContain("analyte.status='CLOSED'");
    const db = new Database(f.file, { readonly: true });
    try {
        expect(require('../../services/retainedRowsFingerprint').fingerprintRetainedTables(db,
            { excludeTables: ['_schema_migrations'] })).toBe(plan.rowsSha256);
        expect(require('../../services/workRepeatInstallationEvidence').assertRepeatInstallationEvidence(db).receipt).toBeDefined();
        expect(require('../../services/qcRunSchemaService').classifyQcRunSchema(db,
            require('../../services/qcRunMigrationSource').loadQcRunMigrationSource()).classification).toBe('COMPLETE');
        expect(require('../../services/qcDispositionScopeSchemaService').inspectScopeExtension(db).classification).toBe('COMPLETE');
    } finally { db.close(); }
    const installedBytes = bytes(f.file);
    expect(installBatchedAmendmentMembership({ dbPath: f.file, apply: true }).mode).toBe('NO_OP');
    expect(assertBatchedAmendmentStartupReady(f.file).classification).toBe('COMPLETE');
    expect(bytes(f.file)).toBe(installedBytes);
});

test('a receipt insertion failure rolls back DROP and CREATE with every retained row', async () => {
    const f = await fixture(), db = new Database(f.file);
    db.exec('CREATE TRIGGER owned_receipt_fault BEFORE INSERT ON "_schema_migrations" WHEN NEW.id=' +
        "'" + MARKER + "' BEGIN SELECT RAISE(ABORT,'OWNED_RECEIPT_FAULT'); END;");
    db.close();
    const before = inspect(f.file);
    expect(() => installBatchedAmendmentMembership({ dbPath: f.file, apply: true })).toThrow('OWNED_RECEIPT_FAULT');
    expect(inspect(f.file)).toEqual(before);
    const reader = new Database(f.file, { readonly: true });
    try {
        expect(normalize(reader.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(GUARD).sql))
            .toBe(normalize(require('../../services/closedQcRepeatMigrationSource').loadClosedQcRepeatMigrationSource().guardSql));
    } finally { reader.close(); }
});

test.each(['receipt', 'guard', 'prior receipt', 'authorization receipt', 'authorization guard'])('tampered %s is refused with zero further writes', async kind => {
    const f = await fixture();
    installBatchedAmendmentMembership({ dbPath: f.file, apply: true });
    const db = new Database(f.file);
    try {
        if (kind === 'guard') db.exec('DROP TRIGGER "' + GUARD + '"; CREATE TRIGGER "' + GUARD +
            '" BEFORE UPDATE ON "WorkItem" BEGIN SELECT 1; END;');
        else if (kind === 'authorization guard') db.exec('DROP TRIGGER "SampleAmendmentAttempt_context_guard"');
        else db.prepare('UPDATE "_schema_migrations" SET details=? WHERE id=?').run('{}',
            kind === 'receipt' ? MARKER : kind === 'authorization receipt' ? '210_sample_amendment_authorisation' : '412_closed_qc_repeat_membership');
    } finally { db.close(); }
    const before = inspect(f.file);
    expect(() => installBatchedAmendmentMembership({ dbPath: f.file, apply: true })).toThrow();
    expect(() => assertBatchedAmendmentStartupReady(f.file)).toThrow();
    expect(inspect(f.file)).toEqual(before);
});

test.each([[], ['--apply'], ['--db'], ['--db', 'owned.db', '--apply', '--dry-run'],
    ['--db', 'owned.db', '--db', 'other.db']].map(args => ({ args })))('the CLI requires one explicit target and mode (%j)', ({ args }) => {
    expect(() => parseArguments(args)).toThrow();
});
