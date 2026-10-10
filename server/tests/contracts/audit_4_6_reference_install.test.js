const fs = require('node:fs'), path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { PrismaClient } = require('../../prisma_client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { assertOwnedTestDatabase } = require('../helpers/testOwnedDatabase');
const { UNITS } = require('../../seeds/units');
const catalogue = require('../../seeds/data/catalogue.json');
const { referenceRows } = require('../../services/calculationReferenceLibrary');
const { installCalculationReferences, referenceReceiptId, referenceReceipt } = require('../../services/calculationReferenceInstall');
const { loadCalculationTemplateMigrationSource } = require('../../services/calculationTemplateMigrationSource');
const files = [];
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

async function fixture({ omittedAnalysis = null, conflict = null } = {}) {
    const directory = path.resolve(__dirname, '../.tmp'); fs.mkdirSync(directory, { recursive: true });
    const file = assertOwnedTestDatabase(path.join(directory, `audit_legacy_calc_refs_${randomUUID()}.db`), 'system:fixture'); files.push(file);
    beforeGuards({ actor: 'system:fixture', file, qcBootstrap: 'CREATE_PRISMA' });
    require('../../scripts/install_workflow_state_guards').installWorkflowStateGuards({ dbPath: file, apply: true });
    const client = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${file}` }) });
    try {
        // All fixture rows are inserted on a newly owned real Prisma schema.
        // Existing catalogue rows are never updated to prepare a test condition.
        for (const row of UNITS) await client.unit.create({ data: { ...row,
            createdAt: new Date('2026-09-01T00:00:00.123Z'), updatedAt: new Date('2026-09-02T00:00:00.456Z') } });
        const codes = new Set(referenceRows().map(row => row.analysisCode));
        for (const row of catalogue.analyses.filter(value => codes.has(value.code) && value.code !== omittedAnalysis)) {
            await client.analysis.create({ data: { code: row.code, name: `Retained local name: ${row.name}`,
                unitCode: row.unitCode, units: row.units, version: 17, decimalPlaces: 5,
                validation: '{"retainedLocalRule":true}', status: 'active', isGlobal: false, description: 'Historical local catalogue metadata' } });
        }
    } finally { await client.$disconnect(); }
    if (conflict) {
        const db = new Database(file), row = { ...referenceRows()[0], ...conflict };
        try { db.pragma('foreign_keys = ON');
            const keys = Object.keys(row);
            db.prepare(`INSERT INTO "CalcTemplate" (${keys.map(key => `"${key}"`).join(',')}) VALUES (${keys.map(() => '?').join(',')})`)
                .run(...keys.map(key => row[key]));
        } finally { db.close(); }
    }
    return file;
}
function snapshot(db) {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
    return { objects: db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all(),
        rows: Object.fromEntries(tables.map(({ name }) => [name, db.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all()])) };
}
afterAll(() => { for (const file of files) fs.rmSync(assertOwnedTestDatabase(file, 'system:fixture'), { force: true }); });

test('the real fresh Prisma schema gets exactly eleven inactive references with every other row/object retained, zero activations and zero backfill', async () => {
    const file = await fixture(), db = new Database(file); db.pragma('foreign_keys = ON');
    try {
        const before = snapshot(db), beforeHash = hash(file);
        expect(installCalculationReferences(db)).toMatchObject({ mode: 'DRY_RUN', classification: 'INCOMPLETE', referenceCount: 11,
            referenceInsertCount: 0, activationInsertCount: 0, backfillCount: 0 });
        expect(snapshot(db)).toEqual(before); expect(hash(file)).toBe(beforeHash);
        expect(installCalculationReferences(db, { apply: true })).toMatchObject({ mode: 'APPLIED', classification: 'COMPLETE',
            referenceInsertCount: 11, activationInsertCount: 0, backfillCount: 0 });
        const after = snapshot(db);
        expect(after.objects).toEqual(before.objects);
        for (const [table, rows] of Object.entries(before.rows)) if (table !== 'CalcTemplate') expect(table === '_schema_migrations' ?
            after.rows[table].filter(row => !row.id.startsWith('199_calculation_reference:')) : after.rows[table]).toEqual(rows);
        const markers = after.rows._schema_migrations.filter(row => row.id.startsWith('199_calculation_reference:'));
        expect(markers).toHaveLength(11);
        for (const row of referenceRows()) expect(markers.find(marker => marker.id === referenceReceiptId(row.id))).toMatchObject({
            details: JSON.stringify(referenceReceipt(row, loadCalculationTemplateMigrationSource().referenceSha256)) });
        expect(after.rows.CalcTemplate).toEqual(referenceRows());
        expect(after.rows.CalcTemplateActivation).toEqual([]);
        expect(db.pragma('integrity_check', { simple: true })).toBe('ok'); expect(db.pragma('foreign_key_check')).toEqual([]);
        const installedHash = hash(file);
        expect(installCalculationReferences(db, { apply: true })).toMatchObject({ mode: 'NO_OP', referenceInsertCount: 0 });
        expect(snapshot(db)).toEqual(after); expect(hash(file)).toBe(installedHash);
    } finally { db.close(); }
});

test.each([{ variant: 'differing variant' }, { createdAt: '2026-09-01T00:00:00.000Z' }, { outputDecimals: 3 },
    { id: 'conflicting-global-reference-id' }, {}])('a differing or unreceipted existing reference is refused409 before any other reference is inserted: %j', async conflict => {
    const file = await fixture({ conflict }), db = new Database(file); db.pragma('foreign_keys = ON');
    try {
        const before = snapshot(db), beforeHash = hash(file);
        for (const apply of [false, true]) expect(() => installCalculationReferences(db, { apply }))
            .toThrow(expect.objectContaining({ code: 'CALC_REFERENCE_CONFLICT', statusCode: 409 }));
        expect(snapshot(db)).toEqual(before); expect(hash(file)).toBe(beforeHash);
    } finally { db.close(); }
});

test('a missing catalogue analysis defers its reference without creating or altering analyses', async () => {
    const file = await fixture({ omittedAnalysis: 'TN' }), db = new Database(file); db.pragma('foreign_keys = ON');
    try {
        const before = snapshot(db), beforeHash = hash(file);
        const plan = installCalculationReferences(db);
        expect(plan).toMatchObject({ deferredReferenceCount: 1, deferredReferences: [{ id: 'calc-ref-kjeldahl-nitrogen-v1',
            code: 'DEFERRED_PREREQUISITE_ABSENT', missingAnalysisCodes: ['TN'], missingUnitCodes: [] }] });
        expect(snapshot(db)).toEqual(before); expect(hash(file)).toBe(beforeHash);
        expect(installCalculationReferences(db, { apply: true })).toMatchObject({ referenceInsertCount: 10, referenceReceiptInsertCount: 10, deferredReferenceCount: 1 });
        const after = snapshot(db);
        expect(after.objects).toEqual(before.objects);
        for (const [table, rows] of Object.entries(before.rows)) if (!['CalcTemplate', '_schema_migrations'].includes(table)) expect(after.rows[table]).toEqual(rows);
        for (const marker of before.rows._schema_migrations) expect(after.rows._schema_migrations).toContainEqual(marker);
        expect(after.rows.CalcTemplate).toEqual(referenceRows().filter(row => row.analysisCode !== 'TN'));
        expect(db.prepare('SELECT 1 FROM _schema_migrations WHERE id=?').get(referenceReceiptId('calc-ref-kjeldahl-nitrogen-v1'))).toBeUndefined();
    } finally { db.close(); }
});

test('an enclosing migration failure rolls all eleven reference inserts back without changing catalogue metadata', async () => {
    const file = await fixture(), db = new Database(file); db.pragma('foreign_keys = ON');
    try {
        const before = snapshot(db), beforeHash = hash(file);
        expect(() => db.transaction(() => { installCalculationReferences(db, { apply: true }); throw Error('later owned install failure'); })())
            .toThrow('later owned install failure');
        expect(snapshot(db)).toEqual(before); expect(hash(file)).toBe(beforeHash);
    } finally { db.close(); }
});

test.each(['different-source', 'orphan-receipt'])('a pre-existing %s reference receipt is never adopted or rewritten', async variant => {
    const file = await fixture(), db = new Database(file); db.pragma('foreign_keys = ON');
    try {
        const reference = referenceRows()[0], sourceSha256 = loadCalculationTemplateMigrationSource().referenceSha256;
        db.prepare('INSERT INTO _schema_migrations(id,details) VALUES(?,?)').run(referenceReceiptId(reference.id),
            JSON.stringify(referenceReceipt(reference, variant === 'different-source' ? '0'.repeat(64) : sourceSha256)));
        const before = snapshot(db), digest = hash(file);
        for (const apply of [false, true]) expect(() => installCalculationReferences(db, { apply }))
            .toThrow(expect.objectContaining({ code: 'CALC_REFERENCE_CONFLICT', statusCode: 409 }));
        expect(snapshot(db)).toEqual(before); expect(hash(file)).toBe(digest);
    } finally { db.close(); }
});
