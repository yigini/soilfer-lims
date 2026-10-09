const fs = require('node:fs'), path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { PrismaClient } = require('../../prisma_client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { assertOwnedTestDatabase } = require('../helpers/testOwnedDatabase');
const { installWorkflowStateGuards } = require('../../scripts/install_workflow_state_guards');
const { installCalculationTemplates, assertCalculationStartupReady, parseArguments } = require('../../scripts/install_calculation_templates');
const { loadCalculationTemplateMigrationSource } = require('../../services/calculationTemplateMigrationSource');
const { installCalculationUnit } = require('../../services/calculationReferenceUnit');
const { installCalculationReferences } = require('../../services/calculationReferenceInstall');
const { referenceRows } = require('../../services/calculationReferenceLibrary');
const { UNITS } = require('../../seeds/units');
const catalogue = require('../../seeds/data/catalogue.json');
const { createPre199CalculationFixture } = require('../helpers/calculationHistoricalFixture');
const { scanSource } = require('../helpers/workflowWriteScanner');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const { createExecutionResultFixture } = require('../helpers/workAttemptFixtures');
const { createResultFixture } = require('../../services/resultWriteService');
const templates = require('../../services/calculationTemplateService');
const activations = require('../../services/calculationActivationService');
const { calculate } = require('../../../shared/soilCalculation');
const files = [];
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function raw(file, execute) {
    const db = new Database(assertOwnedTestDatabase(file, 'system:fixture'));
    try { db.pragma('foreign_keys=ON'); return execute(db); } finally { db.close(); }
}
function snapshot(file) {
    return raw(file, db => ({ objects: db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all(),
        rows: Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
            .map(({ name }) => [name, db.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all()])) }));
}
async function freshFixture() {
    const directory = path.resolve(__dirname, '../.tmp'); fs.mkdirSync(directory, { recursive: true });
    const file = assertOwnedTestDatabase(path.join(directory, `audit_legacy_calc_install_${randomUUID()}.db`), 'system:fixture'); files.push(file);
    // The existing owned CREATE_PRISMA authority executes the real current schema.
    beforeGuards({ actor: 'system:fixture', file, qcBootstrap: 'CREATE_PRISMA' });
    const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${file}` }) });
    try {
        for (const row of UNITS.filter(unit => unit.code !== 'pct_mass')) await db.unit.create({ data: { ...row,
            createdAt: new Date('2026-09-01T00:00:00.123Z'), updatedAt: new Date('2026-09-02T00:00:00.456Z') } });
        const codes = new Set(referenceRows().map(row => row.analysisCode));
        for (const row of catalogue.analyses.filter(value => codes.has(value.code))) await db.analysis.create({ data: {
            code: row.code, name: `Retained local ${row.name}`, unitCode: row.unitCode, units: row.units,
            version: 17, decimalPlaces: 5, description: 'Historical local metadata', validation: '{"local":true}' } });
    } finally { await db.$disconnect(); }
    // A real prior installer creates its own verified ledger; no synthetic receipt.
    installWorkflowStateGuards({ dbPath: file, apply: true });
    return file;
}
async function curveContext(file) {
    const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${file}` }) });
    try {
        const lab = await db.lab.create({ data: { id: randomUUID(), code: randomUUID(), name: 'Owned curve lab', country: 'ZZ' } });
        const user = await db.user.create({ data: { id: randomUUID(), username: randomUUID(), email: `${randomUUID()}@example.invalid`,
            password: 'synthetic-unusable', role: 'LAB_MANAGER', labId: lab.id } });
        const method = await db.methodology.create({ data: { id: randomUUID(), analysisCode: 'P_OLSEN', name: 'Owned Olsen', version: 1 } });
        const batch = await db.batch.create({ data: { id: randomUUID(), labId: lab.id, analysis: 'P_OLSEN', status: 'RUNNING',
            startedAt: new Date(), createdBy: user.username, analystUsername: user.username } });
        const methodRevision = JSON.stringify({ methodologyId: method.id, name: method.name, standard: method.standard, version: method.version });
        const analyte = await db.batchAnalyte.create({ data: { id: randomUUID(), batchId: batch.id, labId: lab.id,
            analysisCode: 'P_OLSEN', methodologyId: method.id, criteriaSnapshot: JSON.stringify({ methodRevision: JSON.parse(methodRevision) }),
            status: 'RUNNING', provenance: 'NATIVE' } });
        const template = referenceRows().find(row => row.analysisCode === 'P_OLSEN');
        return { id: randomUUID(), labId: lab.id, batchId: batch.id, batchAnalyteId: analyte.id, methodologyId: method.id,
            executedMethodRevision: methodRevision, templateId: template.id, templateVersion: 1, revision: 1, supersedesId: null,
            slope: 2, intercept: 0, r: 1, rSquared: 1, pointCount: 2, levelCount: 2, minPointsApplied: 2, minRApplied: 0.9,
            thresholdSource: '{"fixture":"explicit synthetic criterion"}', status: 'PASS', failReason: null, recordedBy: user.username, reason: null };
    } finally { await db.$disconnect(); }
}
function insertCurve(db, row) {
    const keys = Object.keys(row);
    return db.prepare(`INSERT INTO "CalibrationCurve" (${keys.map(key => `"${key}"`).join(',')}) VALUES (${keys.map(() => '?').join(',')})`)
        .run(...keys.map(key => row[key]));
}

function insertCalculation(db, row) {
    const keys = Object.keys(row);
    return db.prepare(`INSERT INTO "ResultCalculation" (${keys.map(key => `"${key}"`).join(',')}) VALUES (${keys.map(() => '?').join(',')})`)
        .run(...keys.map(key => row[key]));
}

// Pin6089971610: exercise the actual new trigger on an owned, generated Prisma
// database. Only the real #179/#199 installers run here; no installed guard is
// dropped or disabled. Existing execution/Result fixture authorities supply the
// explicit rows. The full #191 service cases separately exercise every prior guard.
async function correctionSqlFixture({ resultField, calculationField, noWitness = false, revisedCurve = false } = {}) {
    const file = await freshFixture(); installCalculationTemplates({ dbPath: file, apply: true });
    const curve = await curveContext(file);
    const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${file}` }) });
    try {
        const manager = await db.user.findUnique({ where: { username: curve.recordedBy } });
        const source = referenceRows().find(row => row.analysisCode === 'P_OLSEN');
        const template = await templates.clone(db, manager, source.id, { labId: curve.labId, methodologyId: curve.methodologyId,
            expectedVersion: source.version, outputDecimals: 2, reason: 'Owned correction SQL contract', sopCitation: 'Synthetic SQL SOP, two decimals' });
        const activation = await activations.change(db, manager, template.id, { labId: curve.labId, analysisCode: 'P_OLSEN',
            methodologyId: curve.methodologyId, expectedVersion: template.version, expectedActivationId: null,
            action: 'ACTIVATE', verifiedAgainstSop: true, reason: 'Explicit synthetic SQL fixture' });
        Object.assign(curve, { templateId: template.id, templateVersion: template.version });
        raw(file, sqlite => {
            insertCurve(sqlite, curve);
            for (const point of [[1, 0, 0], [2, 1, 2]]) sqlite.prepare('INSERT INTO CalibrationPoint(curveId,ordinal,standardConcentration,response) VALUES(?,?,?,?)').run(curve.id, ...point);
        });
        const sample = await createSampleFixture(db, { data: { id: randomUUID(), originalId: randomUUID(), status: 'PROCESSING', assignedLab: curve.labId,
            dryingStatus: 'DONE', preparationStatus: 'DONE', receptionDate: new Date() } });
        const item = await createWorkItemFixture(db, { data: { id: randomUUID(), sampleId: sample.id, labId: curve.labId, analysis: 'P_OLSEN',
            methodologyId: curve.methodologyId, assignedTo: manager.username, status: 'IN_PROGRESS', history: '[]' } });
        const reporting = await db.unit.findUnique({ where: { code: 'mg/kg' } });
        const inputs = { absorbance: 1, blankConcentration: 0, extractVolume: 20, dilutionFactor: 1, sampleMass: 1, moistureCorrectionFactor: 1 };
        const computed = calculate(template, inputs, { numberFormat: { decimal: '.', thousands: ',' },
            curve: { ...curve, calibrationMax: 1 }, units: { native: reporting, reporting } });
        const targetId = randomUUID();
        const original = await createExecutionResultFixture(db, { data: { id: randomUUID(), sampleId: sample.id, param: 'P_OLSEN',
            value: String(computed.output), numericValue: computed.output, unit: computed.outputUnit, enteredBy: manager.username,
            batchId: curve.batchId, methodologyId: curve.methodologyId, isCurrent: false, supersededBy: noWitness ? null : targetId,
            equipmentId: 'owned-sql-equipment', equipmentReadiness: '{"equipmentId":"owned-sql-equipment","fixture":true}',
            basis: 'AIR_DRY', provenance: 'MEASURED' } });
        const originalCalculation = { id: randomUUID(), resultId: original.id, templateId: template.id, templateVersion: template.version,
            activationId: activation.id, inputs: JSON.stringify(computed.inputs), parameters: JSON.stringify(template.parameters),
            intermediate: JSON.stringify(computed.intermediate), nativeValue: computed.nativeValue, nativeUnit: computed.nativeUnit,
            conversionFactor: computed.conversionFactor, unitConversion: JSON.stringify(computed.unitConversion),
            unroundedOutput: computed.unroundedOutput, output: computed.output, outputUnit: computed.outputUnit,
            curveId: curve.id, engineVersion: computed.engineVersion, computedBy: manager.username, computedAt: '2026-10-09T00:00:00.123Z' };
        raw(file, sqlite => insertCalculation(sqlite, originalCalculation));
        const target = { id: targetId, sampleId: original.sampleId, param: original.param, value: original.value, numericValue: original.numericValue,
            unit: original.unit, enteredBy: original.enteredBy, attemptId: original.attemptId, replicateNo: original.replicateNo,
            methodologyId: original.methodologyId, batchId: original.batchId, equipmentId: original.equipmentId,
            equipmentReadiness: original.equipmentReadiness, basis: original.basis, provenance: original.provenance };
        if (resultField === 'sampleId') target.sampleId = (await createSampleFixture(db, { data: { id: randomUUID(), originalId: randomUUID(),
            status: 'PROCESSING', assignedLab: curve.labId, receptionDate: new Date() } })).id;
        else if (resultField === 'attemptId') {
            const otherSample = await createSampleFixture(db, { data: { id: randomUUID(), originalId: randomUUID(), status: 'PROCESSING',
                assignedLab: curve.labId, receptionDate: new Date() } });
            await createWorkItemFixture(db, { data: { id: randomUUID(), sampleId: otherSample.id, labId: curve.labId, analysis: 'P_OLSEN',
                assignedTo: manager.username, status: 'IN_PROGRESS', history: '[]' } });
            target.attemptId = (await createExecutionResultFixture(db, { data: { id: randomUUID(), sampleId: otherSample.id,
                param: 'P_OLSEN', value: original.value, numericValue: original.numericValue, unit: original.unit } })).attemptId;
        } else if (resultField === 'methodologyId') target.methodologyId = (await db.methodology.create({ data: { id: randomUUID(),
            analysisCode: 'P_OLSEN', name: 'Other owned SQL method' } })).id;
        else if (resultField === 'batchId') target.batchId = (await db.batch.create({ data: { id: randomUUID(), labId: curve.labId,
            analysis: 'P_OLSEN', status: 'RUNNING', startedAt: new Date(), createdBy: manager.username } })).id;
        else if (resultField) target[resultField] = { param: 'P_BRAY', replicateNo: 2, equipmentId: 'different-owned-equipment',
            equipmentReadiness: '{"equipmentId":"owned-sql-equipment","fixture":"different"}', basis: 'OVEN_DRY', provenance: 'IMPORTED' }[resultField];
        const appended = await createResultFixture(db, { data: target });
        const resultFields = ['sampleId', 'param', 'attemptId', 'replicateNo', 'methodologyId', 'batchId', 'equipmentId', 'equipmentReadiness', 'basis', 'provenance'];
        expect(resultFields.filter(key => original[key] !== appended[key])).toEqual(resultField ? [resultField] : []);
        const deactivation = await activations.change(db, manager, template.id, { labId: curve.labId, analysisCode: 'P_OLSEN',
            methodologyId: curve.methodologyId, expectedVersion: template.version, expectedActivationId: activation.id,
            action: 'DEACTIVATE', verifiedAgainstSop: true, reason: 'Later SOP decision retains the original evidence' });
        const pending = { ...originalCalculation, id: randomUUID(), resultId: appended.id };
        if (calculationField) pending[calculationField] = { templateId: source.id, templateVersion: 2, activationId: deactivation.id,
            curveId: null, parameters: '[{"key":"changed-owned-parameter","value":1}]', conversionFactor: 2,
            unitConversion: JSON.stringify({ ...computed.unitConversion, extra: 'changed frozen evidence' }) }[calculationField];
        const calculationFields = ['templateId', 'templateVersion', 'activationId', 'curveId', 'parameters', 'conversionFactor', 'unitConversion'];
        expect(calculationFields.filter(key => originalCalculation[key] !== pending[key])).toEqual(calculationField ? [calculationField] : []);
        if (revisedCurve) raw(file, sqlite => {
            const revised = { ...curve, id: randomUUID(), revision: 2, supersedesId: curve.id, reason: 'Explicit retained curve revision' };
            insertCurve(sqlite, revised);
            for (const point of [[1, 0, 0], [2, 1, 2]]) sqlite.prepare('INSERT INTO CalibrationPoint(curveId,ordinal,standardConcentration,response) VALUES(?,?,?,?)').run(revised.id, ...point);
        });
        expect(item.sampleId).toBe(original.sampleId);
        return { file, original, originalCalculation, pending };
    } finally { await db.$disconnect(); }
}
afterAll(() => { for (const file of files) fs.rmSync(assertOwnedTestDatabase(file, 'system:fixture'), { force: true }); });

test('SQL permits a deactivated original basis only through the complete existing correction witness', async () => {
    const f = await correctionSqlFixture(), before = snapshot(f.file);
    raw(f.file, db => {
        insertCalculation(db, f.pending);
        expect(db.prepare('SELECT * FROM ResultCalculation WHERE resultId=?').get(f.original.id)).toEqual(before.rows.ResultCalculation[0]);
        expect(db.prepare('SELECT * FROM Result ORDER BY rowid').all()).toEqual(before.rows.Result);
        expect(db.pragma('foreign_key_check')).toEqual([]); expect(db.pragma('integrity_check', { simple: true })).toBe('ok');
    });
    expect(snapshot(f.file).rows.ResultCalculation).toHaveLength(2);
});

test.each([
    ['no witness', { noWitness: true }],
    ...['sampleId', 'param', 'attemptId', 'replicateNo', 'methodologyId', 'batchId', 'equipmentId', 'equipmentReadiness', 'basis', 'provenance']
        .map(resultField => [`Result.${resultField}`, { resultField }]),
    ...['templateId', 'templateVersion', 'activationId', 'curveId', 'parameters', 'conversionFactor', 'unitConversion']
        .map(calculationField => [`ResultCalculation.${calculationField}`, { calculationField }]),
    ['revised curve', { revisedCurve: true }]
])('SQL refuses a historical activation with %s, preserving all owned rows and objects byte for byte', async (_label, options) => {
    const f = await correctionSqlFixture(options), before = snapshot(f.file), digest = hash(f.file);
    expect(() => raw(f.file, db => insertCalculation(db, f.pending))).toThrow('RESULT_CALCULATION_CONTEXT_MISMATCH');
    expect(snapshot(f.file)).toEqual(before); expect(hash(f.file)).toBe(digest);
});

test('PRE_199 actual populated baseline retains every old row, column, foreign key, index, trigger and receipt', () => {
    const { file } = createPre199CalculationFixture(); files.push(file);
    const before = snapshot(file), digest = hash(file);
    const shapes = () => raw(file, db => Object.fromEntries(Object.keys(before.rows).map(table => [table, {
        columns: db.prepare(`PRAGMA table_xinfo("${table}")`).all(), foreignKeys: db.prepare(`PRAGMA foreign_key_list("${table}")`).all(),
        indexes: db.prepare(`PRAGMA index_list("${table}")`).all().map(row => ({ ...row, columns: db.prepare(`PRAGMA index_xinfo("${row.name}")`).all() }))
    }])));
    const originalShapes = shapes();
    expect(before.rows.Result).toHaveLength(2); expect(before.rows.AuditLog).toHaveLength(1);
    expect(before.rows._schema_migrations.map(row => row.id)).toEqual(['179_workflow_state_guards', '182_result_attempt_links']);
    for (const column of originalShapes.Result.columns) expect(before.rows.Result.some(row => row[column.name] != null &&
        String(row[column.name]) !== column.dflt_value?.replace(/^'|'$/g, '') && !(column.name === 'isCurrent' && row[column.name] === 1))).toBe(true);
    expect(installCalculationTemplates({ dbPath: file })).toMatchObject({ classification: 'PRE_199', mode: 'DRY_RUN',
        plannedUnitInsertCount: 1, plannedReferenceInsertCount: 11, totalChanges: 0, backfillCount: 0 });
    expect(snapshot(file)).toEqual(before); expect(hash(file)).toBe(digest);
    expect(installCalculationTemplates({ dbPath: file, apply: true })).toMatchObject({ previousClassification: 'PRE_199', classification: 'COMPLETE',
        mode: 'APPLIED', unitInsertCount: 1, referenceInsertCount: 11, activationInsertCount: 0, backfillCount: 0 });
    const after = snapshot(file);
    for (const object of before.objects) expect(after.objects).toContainEqual(object);
    expect(shapes()).toEqual(originalShapes);
    for (const [table, rows] of Object.entries(before.rows)) expect(table === 'Unit' ? after.rows[table].filter(row => row.code !== 'pct_mass') :
        table === '_schema_migrations' ? after.rows[table].filter(row => row.id !== '199_calculation_templates') : after.rows[table]).toEqual(rows);
    expect(after.rows.CalcTemplate).toEqual(referenceRows());
    for (const table of ['CalcTemplateActivation', 'CalibrationCurve', 'CalibrationPoint', 'ResultCalculation']) expect(after.rows[table]).toEqual([]);
    const installedHash = hash(file);
    expect(installCalculationTemplates({ dbPath: file, apply: true })).toMatchObject({ mode: 'NO_OP', totalChanges: 0 });
    expect(snapshot(file)).toEqual(after); expect(hash(file)).toBe(installedHash);
});

test('managed creation installs the same PASS guard and preserves historical results after all refused inserts', async () => {
    const { file } = createPre199CalculationFixture(); files.push(file);
    const historical = raw(file, db => db.prepare('SELECT * FROM Result ORDER BY id').all());
    installCalculationTemplates({ dbPath: file, apply: true });
    const row = await curveContext(file);
    raw(file, db => {
        for (const change of [{ slope: null }, { intercept: null }, { r: null }, { rSquared: null }, { slope: 0 }, { slope: Infinity },
            { intercept: -Infinity }, { r: Infinity }, { rSquared: Infinity }])
            expect(() => insertCurve(db, { ...row, ...change })).toThrow('CALIBRATION_CURVE_PASS_COEFFICIENTS');
        insertCurve(db, { ...row, status: 'FAIL', failReason: 'DEGENERATE_FIT', slope: null, intercept: null, r: null, rSquared: null });
        expect(db.prepare('SELECT * FROM Result ORDER BY id').all()).toEqual(historical);
        expect(db.pragma('foreign_key_check')).toEqual([]);
    });
});

test('managed receipt failure rolls the five new tables, unit and references back while retaining every old object and row', () => {
    const { file } = createPre199CalculationFixture(); files.push(file);
    raw(file, db => db.exec("CREATE TRIGGER owned_calc_receipt_failure BEFORE INSERT ON _schema_migrations WHEN NEW.id='199_calculation_templates' BEGIN SELECT RAISE(ABORT,'OWNED_CALC_RECEIPT_FAILURE'); END;"));
    const before = snapshot(file), digest = hash(file);
    expect(() => installCalculationTemplates({ dbPath: file, apply: true })).toThrow('OWNED_CALC_RECEIPT_FAILURE');
    expect(snapshot(file)).toEqual(before); expect(hash(file)).toBe(digest);
});

test('the closed factory binds its bytes and sole caller; changed helper and second callers remain violations', () => {
    const filename = 'tests/helpers/calculationHistoricalFixture.js', source = fs.readFileSync(path.resolve(__dirname, '../helpers/calculationHistoricalFixture.js'), 'utf8');
    expect(() => createPre199CalculationFixture({})).toThrow('accepts no arguments');
    expect(scanSource(source, filename)).toEqual([]);
    expect(scanSource(`${source}\n// changed bytes`, filename).map(row => row.code)).toContain('HISTORICAL_FIXTURE_SOURCE_MISMATCH');
    const code = "const { createPre199CalculationFixture } = require('../helpers/calculationHistoricalFixture'); createPre199CalculationFixture();";
    expect(scanSource(code, 'tests/contracts/unlisted_calculation_caller.test.js').map(row => row.code)).toContain('HISTORICAL_FIXTURE_CALLER_NOT_ALLOWED');
    expect(scanSource(code.replace('../helpers/', '../tests/helpers/'), 'services/unlisted_calculation_caller.js').map(row => row.code)).toContain('TEST_HELPER_IMPORTED_BY_RUNTIME');
    expect(scanSource(fs.readFileSync(path.resolve(__dirname, '../../scripts/install_calculation_templates.js'), 'utf8'), 'scripts/install_calculation_templates.js')).toEqual([]);
});

test('real fresh schema dry-run, additive install and repeated no-op preserve all original rows and schema objects', async () => {
    const file = await freshFixture(), before = snapshot(file), digest = hash(file);
    expect(installCalculationTemplates({ dbPath: file })).toMatchObject({ classification: 'FRESH_PRISMA', mode: 'DRY_RUN',
        plannedUnitInsertCount: 1, plannedReferenceInsertCount: 11, totalChanges: 0, backfillCount: 0, activationInsertCount: 0 });
    expect(() => assertCalculationStartupReady(file)).toThrow(expect.objectContaining({ code: 'CALC_NOT_INSTALLED' }));
    expect(hash(file)).toBe(digest); expect(snapshot(file)).toEqual(before);
    expect(installCalculationTemplates({ dbPath: file, apply: true })).toMatchObject({ previousClassification: 'FRESH_PRISMA',
        classification: 'COMPLETE', mode: 'APPLIED', unitInsertCount: 1, referenceInsertCount: 11, activationInsertCount: 0, backfillCount: 0 });
    const after = snapshot(file);
    for (const object of before.objects) expect(after.objects).toContainEqual(object);
    for (const [table, rows] of Object.entries(before.rows)) {
        if (table === 'CalcTemplate') expect(after.rows[table]).toEqual(referenceRows());
        else if (table === 'Unit') expect(after.rows[table].filter(row => row.code !== 'pct_mass')).toEqual(rows);
        else if (table === '_schema_migrations') expect(after.rows[table].filter(row => row.id !== '199_calculation_templates')).toEqual(rows);
        else expect(after.rows[table]).toEqual(rows);
    }
    expect(after.rows.CalcTemplateActivation).toEqual([]);
    const installed = hash(file);
    expect(assertCalculationStartupReady(file).classification).toBe('COMPLETE');
    expect(installCalculationTemplates({ dbPath: file, apply: true })).toMatchObject({ mode: 'NO_OP', totalChanges: 0 });
    expect(snapshot(file)).toEqual(after); expect(hash(file)).toBe(installed);
});

test('receipt refusal rolls every new guard, unit and reference back atomically', async () => {
    const file = await freshFixture();
    raw(file, db => db.exec("CREATE TRIGGER owned_calc_receipt_failure BEFORE INSERT ON _schema_migrations WHEN NEW.id='199_calculation_templates' BEGIN SELECT RAISE(ABORT,'OWNED_CALC_RECEIPT_FAILURE'); END;"));
    const before = snapshot(file), digest = hash(file);
    expect(() => installCalculationTemplates({ dbPath: file, apply: true })).toThrow('OWNED_CALC_RECEIPT_FAILURE');
    expect(snapshot(file)).toEqual(before); expect(hash(file)).toBe(digest);
});

test.each(['partial-guard', 'changed-column', 'wrong-unit', 'wrong-reference'])('refuses %s with unchanged bytes before any installation writes', async variant => {
    const file = await freshFixture();
    raw(file, db => {
        if (variant === 'partial-guard') db.exec(loadCalculationTemplateMigrationSource().guardsSql.match(/^CREATE TRIGGER[\s\S]*?^END;/m)[0]);
        else if (variant === 'changed-column') db.exec('ALTER TABLE "CalibrationPoint" ADD COLUMN unexpected TEXT');
        else if (variant === 'wrong-unit') db.prepare('INSERT INTO Unit(code,display,quantityKind,factorToBase,synonyms,updatedAt) VALUES(?,?,?,?,?,?)')
            .run('pct_mass', '%', 'RATIO', 1, '[]', Date.now());
        else {
            installCalculationUnit(db, { apply: true });
            const row = { ...referenceRows()[0], variant: 'Different existing reference' }, keys = Object.keys(row);
            db.prepare(`INSERT INTO CalcTemplate (${keys.map(key => `"${key}"`).join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map(key => row[key]));
        }
    });
    const before = snapshot(file), digest = hash(file);
    for (const apply of [false, true]) expect(() => installCalculationTemplates({ dbPath: file, apply }))
        .toThrow(expect.objectContaining({ statusCode: 409, code: variant === 'wrong-unit' ? 'UNIT_CATALOGUE_CONFLICT' : variant === 'wrong-reference' ? 'CALC_REFERENCE_CONFLICT' : 'CALC_SCHEMA_MISMATCH' }));
    expect(snapshot(file)).toEqual(before); expect(hash(file)).toBe(digest);
});

test.each([{ slope: null }, { intercept: null }, { r: null }, { rSquared: null }, { slope: 0 },
    { slope: Infinity }, { intercept: -Infinity }, { r: Infinity }, { rSquared: Infinity }])(
    'the actual fresh schema refuses pre-existing bad PASS coefficients before any guard or receipt: %j', async change => {
        const file = await freshFixture();
        raw(file, db => { installCalculationUnit(db, { apply: true }); installCalculationReferences(db, { apply: true }); });
        const row = { ...await curveContext(file), ...change };
        raw(file, db => insertCurve(db, row)); // Populate before guards; never disable an installed guard.
        const before = snapshot(file), digest = hash(file);
        expect(() => installCalculationTemplates({ dbPath: file, apply: true }))
            .toThrow(expect.objectContaining({ code: 'CALIBRATION_CURVE_PASS_COEFFICIENTS', differences: [row.id] }));
        expect(snapshot(file)).toEqual(before); expect(hash(file)).toBe(digest);
    });

test('the installed fresh PASS guard rejects null, nonfinite and zero slope, while a degenerate FAIL stores all-null coefficients', async () => {
    const file = await freshFixture(); installCalculationTemplates({ dbPath: file, apply: true });
    const row = await curveContext(file);
    raw(file, db => {
        for (const change of [{ slope: null }, { intercept: null }, { r: null }, { rSquared: null }, { slope: 0 },
            { slope: Infinity }, { intercept: -Infinity }, { r: Infinity }, { rSquared: Infinity }]) {
            expect(() => insertCurve(db, { ...row, ...change })).toThrow('CALIBRATION_CURVE_PASS_COEFFICIENTS');
            expect(db.prepare('SELECT count(*) n FROM CalibrationCurve').get().n).toBe(0);
        }
        insertCurve(db, { ...row, status: 'FAIL', failReason: 'DEGENERATE_FIT', slope: null, intercept: null, r: null, rSquared: null });
        expect(db.prepare('SELECT status,slope,intercept,r,rSquared FROM CalibrationCurve WHERE id=?').get(row.id))
            .toEqual({ status: 'FAIL', slope: null, intercept: null, r: null, rSquared: null });
        expect(() => db.prepare('UPDATE CalibrationCurve SET slope=2 WHERE id=?').run(row.id)).toThrow('CALIBRATION_CURVE_IMMUTABLE');
        expect(() => db.prepare('DELETE FROM CalibrationCurve WHERE id=?').run(row.id)).toThrow('CALIBRATION_CURVE_IMMUTABLE');
        expect(db.pragma('integrity_check', { simple: true })).toBe('ok'); expect(db.pragma('foreign_key_check')).toEqual([]);
    });
});

test('every managed table is byte-identical to its independently emitted fresh Prisma oracle, with guards separate', () => {
    const source = loadCalculationTemplateMigrationSource();
    for (const [table, sql] of Object.entries(source.freshTables)) expect(source.schemaSql.match(new RegExp(`CREATE TABLE "${table}" \\([\\s\\S]*?\\n\\);`))[0]).toBe(sql);
    expect(source.schemaSql).not.toMatch(/CHECK|TRIGGER|DROP|ALTER/);
    expect(source.guardsSql.match(/CREATE TRIGGER/g)).toHaveLength(16);
});

test('CLI requires an explicit existing database and an unambiguous mode', () => {
    expect(parseArguments(['--db', 'owned.db'])).toEqual({ dbPath: 'owned.db', apply: false });
    for (const args of [[], ['--db'], ['--db', 'owned.db', '--unknown'], ['--db', 'owned.db', '--apply', '--dry-run'], ['--db', 'owned.db', '--apply', '--apply']])
        expect(() => parseArguments(args)).toThrow(expect.objectContaining({ code: 'CALC_ARGUMENT_INVALID' }));
    expect(() => installCalculationTemplates()).toThrow(expect.objectContaining({ code: 'CALC_DATABASE_REQUIRED' }));
});
