const fs = require('node:fs'), path = require('node:path');
const { randomUUID } = require('node:crypto');
const Database = require('better-sqlite3');
const { PrismaClient } = require('../../prisma_client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { assertOwnedTestDatabase } = require('../helpers/testOwnedDatabase');
const { UNITS } = require('../../seeds/units');
const catalogue = require('../../seeds/data/catalogue.json');
const { referenceRows } = require('../../services/calculationReferenceLibrary');
const { installCalculationReferences } = require('../../services/calculationReferenceInstall');
const templates = require('../../services/calculationTemplateService');
const activations = require('../../services/calculationActivationService');
const policy = require('../../services/policyService');
const { PRESETS } = require('../../config/policyRegistry');
const { calculate } = require('../../../shared/soilCalculation');
const files = [];
let context;
async function fixture() {
    const directory = path.resolve(__dirname, '../.tmp'); fs.mkdirSync(directory, { recursive: true });
    const file = assertOwnedTestDatabase(path.join(directory, `audit_legacy_calc_activation_${randomUUID()}.db`), 'system:fixture'); files.push(file);
    beforeGuards({ actor: 'system:fixture', file, qcBootstrap: 'CREATE_PRISMA' });
    const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${file}` }) });
    for (const row of UNITS) await db.unit.create({ data: row });
    const codes = new Set(referenceRows().map(row => row.analysisCode));
    for (const row of catalogue.analyses.filter(value => codes.has(value.code))) await db.analysis.create({ data: {
        code: row.code, name: row.name, unitCode: row.unitCode, units: row.units, isGlobal: true } });
    const labA = await db.lab.create({ data: { id: randomUUID(), code: `CALC_A_${randomUUID()}`, name: 'Synthetic lab A', country: 'ZZ' } });
    const labB = await db.lab.create({ data: { id: randomUUID(), code: `CALC_B_${randomUUID()}`, name: 'Synthetic lab B', country: 'ZZ' } });
    const actor = async (lab, role) => db.user.create({ data: { id: randomUUID(), username: `calc_${randomUUID()}`,
        email: `${randomUUID()}@example.invalid`, password: 'synthetic-unusable-password', role, labId: lab.id } });
    const managerA = await actor(labA, 'LAB_MANAGER'), managerB = await actor(labB, 'LAB_MANAGER'), technician = await actor(labA, 'LAB_TECHNICIAN');
    const method = await db.methodology.create({ data: { id: randomUUID(), analysisCode: 'SOC', name: 'Synthetic WB method', version: 1 } });
    const alternateMethod = await db.methodology.create({ data: { id: randomUUID(), analysisCode: 'SOC', name: 'Synthetic second method', version: 1 } });
    const nitrogenMethod = await db.methodology.create({ data: { id: randomUUID(), analysisCode: 'TN', name: 'Synthetic Kjeldahl method', version: 1 } });
    const sqlite = new Database(file); try { sqlite.pragma('foreign_keys = ON'); installCalculationReferences(sqlite, { apply: true }); } finally { sqlite.close(); }
    return { file, db, labA, labB, managerA, managerB, technician, method, alternateMethod, nitrogenMethod };
}
const row = key => referenceRows().find(value => value.templateKey === key);
const cloneBody = (source, lab, method, overrides = {}) => ({ labId: lab.id, expectedVersion: source.version,
    methodologyId: method?.id || null, outputDecimals: 2, reason: 'Verify the calculation against this synthetic local SOP',
    sopCitation: 'Synthetic SOP-CALC v1 §9, fixed reporting precision', ...overrides });
const activationBody = (template, overrides = {}) => ({ labId: template.labId, analysisCode: template.analysisCode,
    methodologyId: template.methodologyId, expectedVersion: template.version, expectedActivationId: null,
    action: 'ACTIVATE', verifiedAgainstSop: true, reason: 'Manager verified the method and reporting precision against the local SOP', ...overrides });
const evidence = async db => ({ templates: await db.calcTemplate.findMany({ orderBy: { id: 'asc' } }),
    activations: await db.calcTemplateActivation.findMany({ orderBy: { id: 'asc' } }),
    audits: await db.auditLog.findMany({ orderBy: { id: 'asc' } }) });
beforeEach(async () => { context = await fixture(); });
afterEach(async () => { await context?.db.$disconnect(); context = null; });
afterAll(() => { for (const file of files) fs.rmSync(assertOwnedTestDatabase(file, 'system:fixture'), { force: true }); });

test('all lab profiles and the inactive library resolve no implicit template or method fallback', async () => {
    const { db, labA, labB, method } = context;
    for (const lab of [labA, labB]) for (const preset of PRESETS) {
        expect(await policy.calcTemplate(lab.id, { analysisCode: 'SOC', methodologyId: method.id }, { db, profile: { preset } })).toBeNull();
        expect(await policy.calcTemplate(lab.code, { analysisCode: 'SOC', methodologyId: null }, { db, profile: { preset } })).toBeNull();
    }
    expect(await db.calcTemplateActivation.count()).toBe(0);
});

test('cloning and editing insert new versions, retain original definitions and source rules, and audit the reason/SOP', async () => {
    const { db, labA, managerA, method } = context, source = row('walkley-black-130');
    const original = await db.calcTemplate.findUnique({ where: { id: source.id } });
    const first = await templates.clone(db, managerA, source.id, cloneBody(source, labA, method));
    const changedParameters = first.parameters.map(value => ({ key: value.key, value: value.key === 'recoveryFactor' ? 1.33 : value.value }));
    const second = await templates.revise(db, managerA, first.id, { ...cloneBody(first, labA, method), parameters: changedParameters,
        variant: 'Synthetic locally verified recovery 1.33', reason: 'A new local SOP specifies this recovery variant' });
    expect(second).toMatchObject({ version: 2, templateKey: first.templateKey, parentTemplateId: first.id, labId: labA.id });
    expect(await db.calcTemplate.findUnique({ where: { id: source.id } })).toEqual(original);
    expect(templates.decode(await db.calcTemplate.findUnique({ where: { id: first.id } }))).toEqual(first);
    expect(second.parameters.find(value => value.key === 'recoveryFactor')).toMatchObject({ value: 1.33,
        citation: { kind: 'LOCAL_SOP', originalValue: 1.30, parentPublishedSource: expect.objectContaining({ document: 'GLOSOLAN-SOP-02' }) } });
    expect(second.sourceCitation.sources).toEqual(first.sourceCitation.sources);
    expect(await db.auditLog.count({ where: { entity: 'CALC_TEMPLATE' } })).toBe(2);
    const audit = await db.auditLog.findFirst({ where: { entityId: second.id } });
    expect(JSON.parse(audit.details)).toMatchObject({ reason: second.reason, parentTemplateId: first.id, sopCitation: second.precisionSource.citation });
    const before = await evidence(db);
    await expect(templates.revise(db, managerA, first.id, cloneBody(first, labA, method))).rejects.toMatchObject({ code: 'CALC_TEMPLATE_VERSION_CHANGED', statusCode: 409 });
    expect(await evidence(db)).toEqual(before);
});

test('Kjeldahl activation refuses missing precision, then a SOP-cited local clone supplies fixed reporting precision', async () => {
    const { db, labA, managerA, nitrogenMethod } = context, source = row('kjeldahl-nitrogen');
    const before = await evidence(db);
    await expect(activations.change(db, managerA, source.id, activationBody(source, { labId: labA.id, methodologyId: nitrogenMethod.id })))
        .rejects.toMatchObject({ statusCode: 422, code: 'CALC_TEMPLATE_PRECISION_REQUIRED' });
    expect(await evidence(db)).toEqual(before);
    const local = await templates.clone(db, managerA, source.id, cloneBody(source, labA, nitrogenMethod, { outputDecimals: 3 }));
    expect(local.sourceCitation.sourceRule).toEqual(JSON.parse(source.sourceCitation).sourceRule);
    const activated = await activations.change(db, managerA, local.id, activationBody(local));
    expect(await policy.calcTemplate(labA.code, { analysisCode: 'TN', methodologyId: nitrogenMethod.id }, { db }))
        .toEqual({ activationId: activated.id, templateId: local.id, templateVersion: 1 });
    const units = await activations.compatibleUnits(db, local, await db.analysis.findUnique({ where: { code: 'TN' } }));
    expect(calculate(local, { sampleTitre: '10.5', blankTitre: '0.5', sampleMass: '1' },
        { numberFormat: { decimal: '.', thousands: ',' }, units }).output).toBe(2.801);
});

test('two labs use independently verified WB variants; changing lab policy never changes the selected immutable activation', async () => {
    const { db, labA, labB, managerA, managerB, method, alternateMethod } = context;
    const sourceA = row('walkley-black-130'), sourceB = row('walkley-black-133');
    const a = await templates.clone(db, { ...managerA, labId: labA.code }, sourceA.id, cloneBody(sourceA, labA, method));
    const b = await templates.clone(db, managerB, sourceB.id, cloneBody(sourceB, labB, method));
    const aa = await activations.change(db, managerA, a.id, activationBody(a));
    const ab = await activations.change(db, managerB, b.id, activationBody(b));
    for (const [lab, activation, template, expected] of [[labA, aa, a, 15.6], [labB, ab, b, 15.96]]) {
        expect(await policy.calcTemplate(lab.id, { analysisCode: 'SOC', methodologyId: method.id }, { db }))
            .toEqual({ activationId: activation.id, templateId: template.id, templateVersion: 1 });
        for (const methodId of [null, alternateMethod.id]) expect(await policy.calcTemplate(lab.id, { analysisCode: 'SOC', methodologyId: methodId }, { db })).toBeNull();
        const units = await activations.compatibleUnits(db, template, await db.analysis.findUnique({ where: { code: 'SOC' } }));
        expect(calculate(template, { sampleMass: '1', blankTitre: '20', sampleTitre: '12', moistureCorrectionFactor: '1' },
            { numberFormat: { decimal: '.', thousands: ',' }, units }).output).toBe(expected);
    }
    await policy.change(managerA, labA.id, { presetCode: 'ISO17025_STRICT', reason: 'Synthetic policy change independent of scientific variants' }, { db });
    expect(await policy.calcTemplate(labA.id, { analysisCode: 'SOC', methodologyId: method.id }, { db }))
        .toEqual({ activationId: aa.id, templateId: a.id, templateVersion: 1 });
    expect(await db.calcTemplateActivation.count()).toBe(2);
});

test('deactivation and reactivation append one exact-scope chain; stale heads refuse409 without changing evidence', async () => {
    const { db, labA, managerA, method } = context, source = row('walkley-black-130');
    const local = await templates.clone(db, managerA, source.id, cloneBody(source, labA, method));
    const first = await activations.change(db, managerA, local.id, activationBody(local));
    const second = await activations.change(db, managerA, local.id, activationBody(local, { action: 'DEACTIVATE', expectedActivationId: first.id }));
    expect(second.supersedesId).toBe(first.id);
    expect(await policy.calcTemplate(labA.id, { analysisCode: 'SOC', methodologyId: method.id }, { db })).toBeNull();
    expect(await activations.getState(db, managerA, { labId: labA.id, analysisCode: 'SOC', methodologyId: method.id }))
        .toEqual({ activationHeadId: second.id, active: null });
    const before = await evidence(db);
    await expect(activations.change(db, managerA, local.id, activationBody(local, { expectedActivationId: first.id })))
        .rejects.toMatchObject({ statusCode: 409, code: 'CALC_TEMPLATE_VERSION_CHANGED' });
    expect(await evidence(db)).toEqual(before);
    const third = await activations.change(db, managerA, local.id, activationBody(local, { expectedActivationId: second.id }));
    expect(third.supersedesId).toBe(second.id);
    expect(await db.calcTemplateActivation.findUnique({ where: { id: first.id } })).toEqual(first);
    expect(await db.calcTemplateActivation.findUnique({ where: { id: second.id } })).toEqual(second);
});

test('permissions, cross-lab clones/activations and missing verification refuse before all writes', async () => {
    const { db, labA, labB, managerA, managerB, technician, method } = context, source = row('walkley-black-130');
    const local = await templates.clone(db, managerB, source.id, cloneBody(source, labB, method)), before = await evidence(db);
    await expect(templates.clone(db, technician, source.id, cloneBody(source, labA, method))).rejects.toMatchObject({ statusCode: 403, code: 'CALC_TEMPLATE_PERMISSION_DENIED' });
    await expect(templates.clone(db, managerA, local.id, cloneBody(local, labA, method))).rejects.toMatchObject({ statusCode: 403, code: 'CALC_TEMPLATE_SCOPE_DENIED' });
    await expect(activations.change(db, managerA, local.id, activationBody(local))).rejects.toMatchObject({ statusCode: 403, code: 'CALC_TEMPLATE_SCOPE_DENIED' });
    for (const verifiedAgainstSop of [false, 'true', 1]) await expect(activations.change(db, managerB, local.id, activationBody(local, { verifiedAgainstSop })))
        .rejects.toMatchObject({ statusCode: 422, code: 'CALC_SOP_VERIFICATION_REQUIRED' });
    expect(await evidence(db)).toEqual(before);
});

test('a RATIO percent native unit cannot activate for SOC mass-fraction reporting', async () => {
    const { db, labA, managerA, method } = context, source = row('walkley-black-130');
    const ratio = { ...source, id: randomUUID(), templateKey: randomUUID(), outputUnit: '%',
        sourceCitation: JSON.stringify({ syntheticProbe: 'An independently inserted, incompatible controlled-unit definition' }), createdAt: new Date() };
    await db.calcTemplate.create({ data: ratio });
    const before = await evidence(db);
    await expect(activations.change(db, managerA, ratio.id, activationBody(ratio, { labId: labA.id, methodologyId: method.id })))
        .rejects.toMatchObject({ statusCode: 422, code: 'CALC_TEMPLATE_UNIT_MISMATCH' });
    expect(await evidence(db)).toEqual(before);
});

test('parameter edits retain dimensional units and bounds, and require positive method constants and a SOP citation', async () => {
    const { db, labA, managerA, method } = context, source = row('walkley-black-130'), params = JSON.parse(source.parameters);
    const before = await evidence(db);
    await expect(templates.clone(db, managerA, source.id, cloneBody(source, labA, method, { sopCitation: '' })))
        .rejects.toMatchObject({ code: 'CALC_TEMPLATE_SOP_REQUIRED', statusCode: 422 });
    await expect(templates.clone(db, managerA, source.id, cloneBody(source, labA, method, { parameters: params.map(value => ({ ...value, unit: 'wrong-unit' })) })))
        .rejects.toMatchObject({ code: 'CALC_TEMPLATE_PARAMETER_INVALID', statusCode: 422 });
    await expect(templates.clone(db, managerA, source.id, cloneBody(source, labA, method, { parameters: params.map(value => ({ key: value.key, value: 0 })) })))
        .rejects.toMatchObject({ code: 'CALC_TEMPLATE_INVALID', statusCode: 422 });
    expect(await evidence(db)).toEqual(before);
});
