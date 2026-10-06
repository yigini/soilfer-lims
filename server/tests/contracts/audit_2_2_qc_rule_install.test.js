const fs = require('node:fs');
const { randomUUID, createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { installReferenceMaterials } = require('../../scripts/install_reference_materials');
const { installQcRules, assertQcRuleStartupReady, parseArguments } = require('../../scripts/install_qc_rules');
const { loadQcRuleMigrationSource } = require('../../services/qcRuleMigrationSource');
const { scanSource } = require('../helpers/workflowWriteScanner');
const files = [], hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function fixture(schemaVariant = 'PRE_1_3_SAMPLE_CODES') {
    const { file } = beforeGuards({ actor: 'system:fixture', schemaVariant });
    files.push(file);
    const db = new Database(file);
    try { db.exec('CREATE TABLE IF NOT EXISTS "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL, "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "details" TEXT)'); }
    finally { db.close(); }
    installReferenceMaterials({ dbPath: file, apply: true });
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

test.each(['PRE_1_3_SAMPLE_CODES', null])('real additive install on %s preserves every existing row, field and schema object; repeat/startup write nothing', variant => {
    const file = fixture(variant), before = state(file), digest = hash(file);
    expect(installQcRules({ dbPath: file })).toMatchObject({ mode: 'DRY_RUN', totalChanges: 0, backfillCount: 0,
        classification: variant ? 'PRE_185' : 'FRESH_PRISMA', counts: { rules: 0 } });
    expect(hash(file)).toBe(digest);
    expect(() => assertQcRuleStartupReady(file)).toThrow(expect.objectContaining({ code: 'QC_RULE_NOT_INSTALLED' }));
    expect(hash(file)).toBe(digest);
    expect(installQcRules({ dbPath: file, apply: true })).toMatchObject({ mode: 'APPLIED', classification: 'COMPLETE', totalChanges: 1, backfillCount: 0 });
    const db = new Database(file, { readonly: true, fileMustExist: true });
    try {
        for (const table of before.tables) {
            const rows = db.prepare(`SELECT * FROM "${table.name}" ${table.name === '_schema_migrations' ? "WHERE id<>'185_qc_rules'" : ''} ORDER BY rowid`).all();
            expect(rows).toEqual(table.rows);
            expect(db.prepare(`PRAGMA table_xinfo("${table.name}")`).all()).toEqual(table.columns);
            expect(db.prepare(`PRAGMA foreign_key_list("${table.name}")`).all()).toEqual(table.fks);
        }
        for (const object of before.objects) expect(db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type=? AND name=?').get(object.type, object.name)).toEqual(object);
        expect(db.pragma('integrity_check', { simple: true })).toBe('ok'); expect(db.pragma('foreign_key_check')).toEqual([]);
    } finally { db.close(); }
    const installed = state(file), installedDigest = hash(file);
    expect(installQcRules({ dbPath: file, apply: true })).toMatchObject({ mode: 'NO_OP', totalChanges: 0 });
    expect(assertQcRuleStartupReady(file)).toMatchObject({ classification: 'COMPLETE', totalChanges: 0 });
    expect(state(file)).toEqual(installed); expect(hash(file)).toBe(installedDigest);
});

test.each(['partial', 'marker', 'tampered'])('%s schema or receipt refuses apply and startup with unchanged bytes', variant => {
    const file = fixture();
    if (variant === 'tampered') installQcRules({ dbPath: file, apply: true });
    const db = new Database(file);
    try {
        if (variant === 'partial') db.exec('CREATE TABLE "QcRule" ("id" TEXT PRIMARY KEY)');
        if (variant === 'marker') db.prepare('INSERT INTO "_schema_migrations" (id,details) VALUES (?,?)').run('185_qc_rules', '{}');
        if (variant === 'tampered') db.prepare('UPDATE "_schema_migrations" SET details=? WHERE id=?').run('{}', '185_qc_rules');
    } finally { db.close(); }
    const before = state(file), digest = hash(file);
    expect(() => installQcRules({ dbPath: file, apply: true })).toThrow(expect.objectContaining({ code: 'QC_RULE_SCHEMA_MISMATCH' }));
    expect(() => assertQcRuleStartupReady(file)).toThrow(expect.objectContaining({ code: 'QC_RULE_SCHEMA_MISMATCH' }));
    expect(state(file)).toEqual(before); expect(hash(file)).toBe(digest);
});

test('receipt failure rolls back new table, indexes and guards together', () => {
    const file = fixture(), db = new Database(file);
    try { db.exec(`CREATE TRIGGER "QcRule_receipt_fault" BEFORE INSERT ON "_schema_migrations"
        WHEN NEW.id='185_qc_rules' BEGIN SELECT RAISE(ABORT,'OWNED_QC_RULE_RECEIPT_FAULT'); END;`); }
    finally { db.close(); }
    const before = state(file), digest = hash(file);
    expect(() => installQcRules({ dbPath: file, apply: true })).toThrow('OWNED_QC_RULE_RECEIPT_FAULT');
    expect(state(file)).toEqual(before); expect(hash(file)).toBe(digest);
});

test('database enforces immutable rows, consecutive generic/method versions, bounds, modes and fail-action JSON', () => {
    const file = fixture(); installQcRules({ dbPath: file, apply: true });
    const db = new Database(file);
    try {
        db.pragma('foreign_keys = ON');
        db.prepare('INSERT INTO Lab(id,code,name,country,updatedAt) VALUES (?,?,?,?,?)').run('RULE-DB', 'RULE-DB', 'Rule fixture', 'GTM', Date.now());
        db.prepare('INSERT INTO Analysis(code,name) VALUES (?,?)').run('RULE-DB', 'Rule analysis');
        const now = new Date().toISOString();
        const insert = (version, extra = {}) => {
            const row = { id: randomUUID(), labId: 'RULE-DB', analysisCode: 'RULE-DB', version, effectiveFrom: now, approvedBy: 'fixture', reason: 'Approved', createdAt: now, ...extra };
            return db.prepare(`INSERT INTO QcRule (${Object.keys(row).map(key => `"${key}"`).join(',')}) VALUES (${Object.keys(row).map(() => '?').join(',')})`).run(...Object.values(row));
        };
        insert(1);
        expect(() => insert(1)).toThrow('QC_RULE_VERSION_CONFLICT');
        expect(() => insert(3)).toThrow('QC_RULE_VERSION_CONFLICT');
        expect(() => db.prepare('UPDATE QcRule SET reason=? WHERE labId=?').run('changed', 'RULE-DB')).toThrow('QC_RULE_IMMUTABLE');
        expect(() => db.prepare('DELETE FROM QcRule WHERE labId=?').run('RULE-DB')).toThrow('QC_RULE_IMMUTABLE');
        for (const criteria of [{ duplicateEvery: -1 }, { duplicateEvery: 1.5 }, { curveMinR: 1.1 }, { crmRecoveryMin: 120, crmRecoveryMax: 110 },
            { failAction: '{"BLANK":"WARN","DUPLICATE":"WARN","LRM":"WARN","LRM":"WARN"}' }, { failAction: '{}' }]) expect(() => insert(2, criteria)).toThrow('QC_RULE_VALUE_INVALID');
        expect(() => insert(2, { crmMode: 'EN_SCORE' })).toThrow('QC_RULE_MODE_UNSUPPORTED');
        expect(() => insert(2, { blankCorrection: 'SUBTRACT_MEAN_BLANK' })).toThrow('QC_RULE_MODE_UNSUPPORTED');
        expect(() => insert(2, { effectiveFrom: new Date(Date.now() - 60000).toISOString() })).toThrow('QC_RULE_EFFECTIVE_FROM_INVALID');
        expect(db.prepare('SELECT COUNT(*) n FROM QcRule').get().n).toBe(1);
    } finally { db.close(); }
});

test('closed QC migration loader grants only exact digest-bound SQL and refuses aliases, mutation and shadowing', () => {
    expect(loadQcRuleMigrationSource().sql).toContain('CREATE TABLE "QcRule"');
    const header = "const {loadQcRuleMigrationSource}=require('../services/qcRuleMigrationSource');const source=loadQcRuleMigrationSource();";
    expect(scanSource(header + 'db.exec(source.sql)', 'scripts/qc-rule-probe.js')).toEqual([]);
    for (const code of ['const alias=source;db.exec(alias.sql)', 'source.sql=input;db.exec(source.sql)', 'delete source.sql;db.exec(source.sql)']) {
        expect(scanSource(header + code, 'scripts/qc-rule-probe.js')).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'UNRESOLVED_WORKFLOW_SQL' })]));
    }
    expect(scanSource('function loadQcRuleMigrationSource(){return {sql:input}};const source=loadQcRuleMigrationSource();db.exec(source.sql)', 'scripts/qc-rule-probe.js')).toHaveLength(1);
});

test('CLI defaults to dry run and refuses contradictory or repeated arguments', () => {
    expect(parseArguments(['--db', 'owned.db']).apply).toBe(false);
    expect(parseArguments(['--db', 'owned.db', '--apply']).apply).toBe(true);
    for (const args of [['--apply', '--dry-run'], ['--db'], ['--apply', '--apply'], ['--unknown']]) expect(() => parseArguments(args)).toThrow(expect.objectContaining({ code: 'QC_RULE_ARGUMENT_INVALID' }));
});
