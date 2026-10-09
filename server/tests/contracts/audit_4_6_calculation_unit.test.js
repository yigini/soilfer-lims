const fs = require('node:fs'), path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { PrismaClient } = require('../../prisma_client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { assertOwnedTestDatabase } = require('../helpers/testOwnedDatabase');
const { MASS_FRACTION_PERCENT, classifyCalculationUnit, installCalculationUnit } = require('../../services/calculationReferenceUnit');
const { seedUnits, UNITS } = require('../../seeds/units');
const files = [];
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function fixture({ historical = true, conflict = null } = {}) {
    const directory = path.resolve(__dirname, '../.tmp'); fs.mkdirSync(directory, { recursive: true });
    const file = assertOwnedTestDatabase(path.join(directory, `audit_legacy_calc_unit_${randomUUID()}.db`), 'system:fixture'); files.push(file);
    const db = new Database(file);
    db.exec(`CREATE TABLE "Unit" ("code" TEXT NOT NULL PRIMARY KEY, "display" TEXT NOT NULL, "quantityKind" TEXT NOT NULL,
      "factorToBase" REAL NOT NULL DEFAULT 1.0, "synonyms" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL)`);
    if (historical) for (const unit of UNITS.filter(row => row.code !== 'pct_mass')) {
        db.prepare('INSERT INTO "Unit" (code,display,quantityKind,factorToBase,synonyms,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)')
            .run(unit.code, unit.display, unit.quantityKind, unit.factorToBase, unit.synonyms, '2026-09-01T00:00:00.123Z', '2026-09-02T00:00:00.456Z');
    }
    if (conflict) {
        const row = { ...MASS_FRACTION_PERCENT, ...conflict };
        db.prepare('INSERT INTO "Unit" (code,display,quantityKind,factorToBase,synonyms,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)')
            .run(row.code, row.display, row.quantityKind, row.factorToBase, row.synonyms, '2026-09-01T00:00:00.123Z', '2026-09-02T00:00:00.456Z');
    }
    db.close(); return file;
}
const rows = db => db.prepare('SELECT * FROM "Unit" ORDER BY code').all();
afterAll(() => { for (const file of files) fs.rmSync(assertOwnedTestDatabase(file, 'system:fixture'), { force: true }); });

test('dry-run has zero writes; one additive unit insert preserves all historical catalogue fields and second apply is a byte-identical no-op', () => {
    const file = fixture(), beforeHash = digest(file), db = new Database(file);
    try {
        const before = rows(db);
        expect(installCalculationUnit(db)).toMatchObject({ mode: 'DRY_RUN', classification: 'ABSENT', unitInsertCount: 0, backfillCount: 0 });
        expect(rows(db)).toEqual(before); expect(digest(file)).toBe(beforeHash);
        expect(installCalculationUnit(db, { apply: true })).toMatchObject({ mode: 'APPLIED', classification: 'ALREADY_PRESENT', unitInsertCount: 1, backfillCount: 0 });
        expect(rows(db).filter(row => row.code !== 'pct_mass')).toEqual(before);
        const after = rows(db), afterHash = digest(file);
        expect(installCalculationUnit(db, { apply: true })).toMatchObject({ mode: 'NO_OP', unitInsertCount: 0 });
        expect(rows(db)).toEqual(after); expect(digest(file)).toBe(afterHash);
        expect(classifyCalculationUnit(db)).toMatchObject({ classification: 'ALREADY_PRESENT' });
    } finally { db.close(); }
});

test.each([{ display: '%' }, { quantityKind: 'RATIO' }, { factorToBase: 1 }, { synonyms: '["%"]' }, { synonyms: '[] ' }])(
    'a conflicting controlled definition refuses409 before any write: %j', conflict => {
        const file = fixture({ conflict }), hash = digest(file), db = new Database(file);
        try {
            const before = rows(db);
            for (const apply of [false, true]) expect(() => installCalculationUnit(db, { apply })).toThrow(expect.objectContaining({ code: 'UNIT_CATALOGUE_CONFLICT', statusCode: 409 }));
            expect(rows(db)).toEqual(before); expect(digest(file)).toBe(hash);
        } finally { db.close(); }
    });

test('an outer schema-installation failure rolls the new unit back atomically', () => {
    const file = fixture(), db = new Database(file), hash = digest(file);
    try {
        const before = rows(db);
        expect(() => db.transaction(() => { installCalculationUnit(db, { apply: true }); throw Error('owned later-stage refusal'); })())
            .toThrow('owned later-stage refusal');
        expect(rows(db)).toEqual(before); expect(digest(file)).toBe(hash);
    } finally { db.close(); }
});

test('the actual fresh Prisma-backed seed adds pct_mass and leaves existing percent free-text resolution distinct', async () => {
    const file = fixture({ historical: false });
    const client = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${file}` }) });
    try {
        expect(await seedUnits(client)).toBe(UNITS.length);
        expect(await client.unit.findUnique({ where: { code: 'pct_mass' } })).toMatchObject(MASS_FRACTION_PERCENT);
        const definitions = await client.unit.findMany();
        for (const spelling of ['%', 'g/100g', 'wt%', 'mass%']) {
            expect(definitions.filter(row => row.code === spelling || JSON.parse(row.synonyms || '[]').includes(spelling))
                .map(row => ({ code: row.code, quantityKind: row.quantityKind }))).toEqual([{ code: '%', quantityKind: 'RATIO' }]);
        }
    } finally { await client.$disconnect(); }
});
