const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const Database = require('better-sqlite3');
const script = require('../../scripts/fix_424_step_d_catalogue');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { createRootClient } = require('../../utils/prismaClientIdentity');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const { createRawResultFixture } = require('../../services/resultWriteService');
const cataloguePolicy = require('../../services/cataloguePolicy');
const methodResolution = require('../../services/methodResolution');

const directory = path.resolve(__dirname, '../.tmp'), files = [];
let baseline;
// Literal after-step-C lists and expected pin-6 lists, independent of the script.
const beforePackages = {
    BASIC_FERTILITY: ['PH_H2O', 'SOC', 'TN', 'extractableElements', 'EXCH_CA', 'EXCH_MG', 'EXCH_K', 'EXCH_NA', 'EC', 'SAND', 'SILT', 'CLAY'],
    CATION_EXCHANGE_SUITE: ['EXCH_CA', 'EXCH_MG', 'EXCH_K', 'EXCH_NA', 'CEC', 'ECEC', 'EXCH_ACID', 'baseSaturation'],
    FULL_CHARACTERIZATION: ['PH_H2O', 'SOC', 'TN', 'extractableElements', 'EXCH_CA', 'EXCH_MG', 'EXCH_K', 'EXCH_NA', 'CEC', 'ECEC', 'EXCH_ACID', 'EC', 'SAND', 'SILT', 'CLAY', 'BD_WHOLE', 'CACO3', 'VOL_MOISTURE'],
    PHYSICAL_PROPERTIES: ['SAND', 'SILT', 'CLAY', 'BD_WHOLE', 'BD_FINE', 'VOL_MOISTURE', 'AWC', 'porosity'],
    SALINITY_SODICITY: ['EC', 'solubleSalts', 'EXCH_CA', 'EXCH_MG', 'EXCH_K', 'EXCH_NA', 'PH_H2O', 'gypsum']
};
const afterPackages = {
    BASIC_FERTILITY: ['PH_H2O', 'SOC', 'TN', 'P_OLSEN', 'EXCH_CA', 'EXCH_MG', 'EXCH_K', 'EXCH_NA', 'EC', 'SAND', 'SILT', 'CLAY'],
    CATION_EXCHANGE_SUITE: beforePackages.CATION_EXCHANGE_SUITE,
    FULL_CHARACTERIZATION: ['PH_H2O', 'SOC', 'TN', 'P_OLSEN', 'EXT_ZN', 'EXT_FE', 'EXT_MN', 'EXT_CU', 'EXT_B', 'EXCH_CA', 'EXCH_MG', 'EXCH_K', 'EXCH_NA', 'CEC', 'ECEC', 'EXCH_ACID', 'EC', 'SAND', 'SILT', 'CLAY', 'BD_WHOLE', 'CACO3'],
    PHYSICAL_PROPERTIES: ['SAND', 'SILT', 'CLAY', 'BD_WHOLE', 'BD_FINE', 'VOL_MOISTURE', 'SOIL_MOISTURE', 'AWC', 'POROSITY'],
    SALINITY_SODICITY: ['EC', 'SAR', 'EXCH_CA', 'EXCH_MG', 'EXCH_K', 'EXCH_NA', 'PH_H2O', 'GYPSUM']
};
const canonical = { POROSITY: 'POROSITY_CALC', GYPSUM: 'USDA_HB60_GYPSUM', SAR: 'SAR_CALC', SOIL_MOISTURE: 'ISO_11465_GRAV', baseSaturation: 'BS_CALCULATION' };
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function ownedFile() { const file = path.join(directory, 'issue424d_' + randomUUID() + '.db'); files.push(file); return file; }
function fixture() { const file = ownedFile(); fs.copyFileSync(baseline, file); return file; }
function edit(file, callback) { const db = new Database(file); db.pragma('foreign_keys=ON'); try { return callback(db); } finally { db.close(); } }
function inspect(file, callback) { const db = new Database(file, { readonly: true }); try { return callback(db); } finally { db.close(); } }
function snapshot(file) { return inspect(file, db => Object.fromEntries(['Analysis', 'AnalysisGroup', 'Methodology', 'LabMethodDefault', 'AuditLog', 'OrderLine', 'WorkItem', 'Result'].map(table => [table, db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]))); }
function apply(file) {
    const dry = script.runStepDCatalogue({ dbPath: file });
    return script.runStepDCatalogue({ dbPath: file, apply: true, expectedPlanSha256: dry.planSha256 || '0'.repeat(64) });
}
function refusal(file, code) {
    const before = snapshot(file), hash = digest(file), result = apply(file);
    expect(result.ok).toBe(false);
    expect(result.error?.code === code || result.failures?.some(row => row.code === code)).toBe(true);
    expect(result).toMatchObject({ totalChanges: 0, auditRowsCreated: 0, sqliteTotalChanges: 0 });
    expect(snapshot(file)).toEqual(before); expect(digest(file)).toBe(hash);
    return result;
}
async function withClient(file, callback) {
    const client = createRootClient({ adapter: new PrismaBetterSqlite3({ url: 'file:' + file }) });
    try { return await callback(client); } finally { await client.$disconnect(); }
}
async function sample(file) { await withClient(file, client => createSampleFixture(client, { data: { id: 'sample-ref', originalId: 'FICT-424-D', assignedLab: 'lab-0' } })); }
beforeAll(() => {
    fs.mkdirSync(directory, { recursive: true }); baseline = ownedFile();
    beforeGuards({ actor: 'system:fixture', file: baseline, qcBootstrap: 'CREATE_PRISMA' });
    edit(baseline, db => {
        for (let i = 0; i < 10; i++) db.prepare('INSERT INTO Lab(id,code,name,country,updatedAt) VALUES(?,?,?,?,?)').run('lab-' + i, 'LAB-' + i, 'Fictional lab ' + i, 'TEST', '2026-01-01');
        for (const unit of ['%', 'g/kg', '(mmol/L)⁰˙⁵', 'dimensionless']) db.prepare('INSERT INTO Unit(code,display,quantityKind,updatedAt) VALUES(?,?,?,?)').run(unit, unit, 'FIXTURE', '2026-01-01');
        const codes = new Set([...Object.values(beforePackages).flat(), ...Object.values(afterPackages).flat(), 'UNTOUCHED', 'MUNSELL_COLOR']);
        for (const code of codes) {
            const unit = code === 'GYPSUM' ? 'g/kg' : code === 'SAR' ? '(mmol/L)⁰˙⁵' : code === 'MUNSELL_COLOR' ? 'dimensionless' : '%';
            db.prepare("INSERT INTO Analysis(code,name,units,unitCode,status,isGlobal,labId,validation,decimalPlaces) VALUES(?,?,?,?,'active',1,NULL,?,?)")
                .run(code, 'Fixture measurement ' + code, unit, unit, code === 'GYPSUM' ? '{"min":0.1,"max":800,"decimalPlaces":1}' : null, code === 'GYPSUM' ? 1 : 2);
            db.prepare('INSERT INTO Methodology(id,analysisCode,name,standard,isDefault,labId,updatedAt) VALUES(?,?,?,?,1,NULL,?)')
                .run(canonical[code] || 'method-' + code, code, code === 'GYPSUM' ? 'USDA Handbook 60 Acetone Precipitation' : 'Fixture method ' + code,
                    code === 'POROSITY' ? 'FAO Guidelines; retained fixture citation' : 'Fixture reference', '2026-01-01');
        }
        for (const [id, codes] of Object.entries(beforePackages)) db.prepare('INSERT INTO AnalysisGroup(id,name,analyses,labId) VALUES(?,?,?,NULL)').run(id, id + ' package', JSON.stringify(codes));
        db.prepare("INSERT INTO AnalysisGroup(id,name,analyses,labId) VALUES('unrelated','Untouched','[\"UNTOUCHED\"]',NULL)").run();
    });
}, 60000);
afterAll(() => {
    for (const file of files) {
        if (path.dirname(file) !== directory || !path.basename(file).startsWith('issue424d_')) throw Error('Unexpected owned fixture path');
        for (const suffix of ['', '-wal', '-shm', '-journal']) fs.rmSync(file + suffix, { force: true });
    }
});

test('dry-run plans the exact twelve changes without touching any bytes', () => {
    const file = fixture(), hash = digest(file), before = snapshot(file);
    const result = script.runStepDCatalogue({ dbPath: file });
    expect(result).toMatchObject({ ok: true, plannedChanges: 12, totalChanges: 0, auditRowsCreated: 0, resultCounts: { SAR: 0, GYPSUM: 0 }, labContexts: 10 });
    for (const group of result.packages) expect(group.afterCodes).toEqual(afterPackages[group.id]);
    expect(result.databaseBeforeSha256).toBe(result.databaseAfterSha256);
    expect(digest(file)).toBe(hash); expect(snapshot(file)).toEqual(before);
});
test('apply gives full before/after audits, keeps identities and all unrelated fields, and is idempotent', () => {
    const file = fixture(), before = snapshot(file), result = apply(file);
    expect(result).toMatchObject({ ok: true, totalChanges: 12, auditRowsCreated: 12, sqliteTotalChanges: 24, auditActor: 'system:issue-424', integrityCheck: 'ok', foreignKeyCheckRows: 0 });
    const after = snapshot(file);
    for (const group of after.AnalysisGroup.filter(row => afterPackages[row.id])) expect(JSON.parse(group.analyses)).toEqual(afterPackages[group.id]);
    for (const audit of after.AuditLog) {
        const record = result.records.find(row => row.target === audit.entityId);
        expect(audit.performedBy).toBe('system:issue-424');
        expect(JSON.parse(audit.before)).toEqual(record.before); expect(JSON.parse(audit.after)).toEqual(record.after);
        expect(JSON.parse(audit.details)).toEqual({ issue: 424, step: 'D', kind: record.kind });
    }
    for (const code of ['baseSaturation', 'VOL_MOISTURE', 'SOIL_MOISTURE', 'POROSITY']) expect(after.Analysis.find(row => row.code === code)).toEqual(before.Analysis.find(row => row.code === code));
    for (const code of ['extractableElements', 'solubleSalts', 'porosity', 'gypsum']) expect(after.Analysis.find(row => row.code === code)).toEqual({ ...before.Analysis.find(row => row.code === code), status: 'inactive' });
    expect(after.Analysis.find(row => row.code === 'GYPSUM')).toEqual({ ...before.Analysis.find(row => row.code === 'GYPSUM'), units: '%', unitCode: '%', decimalPlaces: 2, validation: '{"min":0.01,"max":80,"decimalPlaces":2}' });
    expect(after.Analysis.find(row => row.code === 'SAR')).toEqual({ ...before.Analysis.find(row => row.code === 'SAR'), units: 'dimensionless', unitCode: 'dimensionless' });
    expect(after.Methodology.find(row => row.id === 'USDA_HB60_GYPSUM')).toEqual({ ...before.Methodology.find(row => row.id === 'USDA_HB60_GYPSUM'), name: 'Acetone precipitation + electrical conductivity' });
    const references = after.Methodology.find(row => row.id === 'POROSITY_CALC').standard;
    expect(references).toBe('FAO Guidelines; retained fixture citation; ISO 11272:2017; ISO 11508:2017');
    expect(after.LabMethodDefault).toEqual(before.LabMethodDefault);
    expect(after.AnalysisGroup.find(row => row.id === 'unrelated')).toEqual(before.AnalysisGroup.find(row => row.id === 'unrelated'));
    const hash = digest(file), second = script.runStepDCatalogue({ dbPath: file });
    expect(second).toMatchObject({ ok: true, plannedChanges: 0, totalChanges: 0, auditRowsCreated: 0 });
    expect(apply(file)).toMatchObject({ ok: true, totalChanges: 0, auditRowsCreated: 0, sqliteTotalChanges: 0 });
    expect(digest(file)).toBe(hash); expect(snapshot(file)).toEqual(after);
});
test('all changed package selections work through the actual application resolver in every lab', async () => {
    const file = fixture(); expect(apply(file).ok).toBe(true);
    await withClient(file, async db => {
        for (const labId of [null, ...Array.from({ length: 10 }, (_, i) => 'lab-' + i)]) for (const codes of Object.values(afterPackages)) {
            expect((await cataloguePolicy.validateSelection(codes, { labId, db })).valid).toBe(true);
            expect([...(await methodResolution.resolveDefaultSelections(codes, labId, db)).values()].every(row => row.method && !row.error)).toBe(true);
        }
    });
});
test.each(['extractableElements', 'solubleSalts', 'porosity', 'gypsum'])('even cancelled order history blocks retirement of %s and the whole plan', async code => {
    const file = fixture(); await sample(file);
    await withClient(file, db => db.sampleOrderRevision.create({ data: { id: 'revision-ref', sampleId: 'sample-ref', version: 1, lines: { create: { id: 'line-ref', analysis: code, status: 'CANCELLED' } } } }));
    refusal(file, 'LEGACY_HAS_USAGE');
});
test('a work item on a legacy code blocks the whole plan', async () => {
    const file = fixture(); await sample(file);
    await withClient(file, db => createWorkItemFixture(db, { data: { id: 'work-ref', sampleId: 'sample-ref', analysis: 'porosity', assignedLab: 'lab-0' } }));
    refusal(file, 'LEGACY_HAS_USAGE');
});
test.each(['gypsum', 'GYPSUM'])('a retained non-current result for %s prevents all writes', async param => {
    const file = fixture(); await sample(file);
    edit(file, db => createRawResultFixture(db, { id: 'old-result', sampleId: 'sample-ref', param, value: '5', isCurrent: 0, updatedAt: '2026-01-01' }));
    refusal(file, param === 'GYPSUM' ? 'GYPSUM_HAS_RESULTS' : 'LEGACY_HAS_USAGE');
});
test('a retained SAR result is counted and blocks the unit change and every other write', async () => {
    const file = fixture(); await sample(file);
    edit(file, db => createRawResultFixture(db, { id: 'sar-result', sampleId: 'sample-ref', param: 'SAR', value: '5', isCurrent: 0, updatedAt: '2026-01-01' }));
    const result = refusal(file, 'SAR_HAS_RESULTS');
    expect(result.resultCounts.SAR).toBe(1);
});
test('canonical codes already present keep their place and do not create duplicates', () => {
    const file = fixture(); edit(file, db => {
        db.prepare("UPDATE AnalysisGroup SET analyses=? WHERE id='SALINITY_SODICITY'").run('["EC","solubleSalts","PH_H2O","SAR","gypsum","EXCH_CA","GYPSUM"]');
        db.prepare("UPDATE AnalysisGroup SET analyses=? WHERE id='PHYSICAL_PROPERTIES'").run('["porosity","VOL_MOISTURE","POROSITY","SOIL_MOISTURE"]');
    });
    expect(apply(file).ok).toBe(true);
    const after = snapshot(file);
    expect(JSON.parse(after.AnalysisGroup.find(row => row.id === 'SALINITY_SODICITY').analyses)).toEqual(['EC', 'PH_H2O', 'SAR', 'EXCH_CA', 'GYPSUM']);
    expect(JSON.parse(after.AnalysisGroup.find(row => row.id === 'PHYSICAL_PROPERTIES').analyses)).toEqual(['VOL_MOISTURE', 'SOIL_MOISTURE', 'POROSITY']);
});
test('lab-owned copies and valid method overrides remain byte-for-byte rows and are reported', () => {
    const file = fixture(); edit(file, db => {
        db.prepare("INSERT INTO AnalysisGroup(id,name,analyses,labId) VALUES('lab-copy','BASIC_FERTILITY package','[\"POROSITY\"]','lab-0')").run();
        db.prepare("INSERT INTO Methodology(id,analysisCode,name,isDefault,labId,updatedAt) VALUES('local-porosity','POROSITY','Local calculation',0,'lab-0','2026-01-01')").run();
        db.prepare("INSERT INTO LabMethodDefault(id,labId,analysisCode,methodologyId,updatedAt) VALUES('local-default','lab-0','POROSITY','local-porosity','2026-01-01')").run();
    });
    const before = snapshot(file), result = apply(file), after = snapshot(file);
    expect(result.ok).toBe(true); expect(result.labOwnedPackages.map(row => row.id)).toEqual(['lab-copy']); expect(result.labOverrideCount).toBe(1);
    expect(after.AnalysisGroup.find(row => row.id === 'lab-copy')).toEqual(before.AnalysisGroup.find(row => row.id === 'lab-copy'));
    expect(after.LabMethodDefault).toEqual(before.LabMethodDefault);
    expect(after.Methodology.find(row => row.id === 'local-porosity')).toEqual(before.Methodology.find(row => row.id === 'local-porosity'));
});
test('a legacy reference in an untouched lab copy blocks retirement instead of rewriting the copy', () => {
    const file = fixture(); edit(file, db => db.prepare("INSERT INTO AnalysisGroup(id,name,analyses,labId) VALUES('lab-copy','Local','[\"porosity\"]','lab-0')").run());
    refusal(file, 'LEGACY_STILL_IN_PACKAGE');
});
test('legacy duplicates in other global packages are replaced too', () => {
    const file = fixture(); edit(file, db => db.prepare("UPDATE AnalysisGroup SET analyses='[\"porosity\",\"gypsum\"]' WHERE id='unrelated'").run());
    expect(apply(file)).toMatchObject({ ok: true, totalChanges: 13 });
    expect(inspect(file, db => db.prepare("SELECT analyses FROM AnalysisGroup WHERE id='unrelated'").get().analyses)).toBe('["POROSITY","GYPSUM"]');
});
test.each([
    ['missing package', db => db.prepare("DELETE FROM AnalysisGroup WHERE id='BASIC_FERTILITY'").run(), 'PACKAGE_MISSING'],
    ['lab-owned target', db => db.prepare("UPDATE AnalysisGroup SET labId='lab-0' WHERE id='BASIC_FERTILITY'").run(), 'PACKAGE_NOT_GLOBAL'],
    ['inactive partner', db => db.prepare("UPDATE Analysis SET status='inactive' WHERE code='P_OLSEN'").run(), 'PARAMETER_NOT_ACTIVE_GLOBAL'],
    ['unconfigured partner', db => db.prepare("UPDATE Analysis SET validation='broken' WHERE code='P_OLSEN'").run(), 'PARAMETER_CONFIGURATION_INVALID'],
    ['missing method', db => db.prepare("UPDATE Methodology SET isDefault=0 WHERE id='ISO_11465_GRAV'").run(), 'DEFAULT_METHOD_MISSING'],
    ['conflicting method', db => db.prepare("INSERT INTO Methodology(id,analysisCode,name,isDefault,updatedAt) VALUES('other-sar','SAR','Other SAR',1,'2026-01-01')").run(), 'DEFAULT_CONFLICT'],
    ['invalid last-lab override', db => db.prepare("INSERT INTO LabMethodDefault(id,labId,analysisCode,methodologyId,updatedAt) VALUES('bad','lab-9','POROSITY','method-TN','2026-01-01')").run(), 'INVALID_LAB_OVERRIDE'],
    ['unexpected gypsum unit', db => db.prepare("UPDATE Analysis SET units='mg/kg' WHERE code='GYPSUM'").run(), 'GYPSUM_UNIT_OR_VALIDATION_UNEXPECTED'],
    ['curated gypsum limits', db => db.prepare("UPDATE Analysis SET validation='{\"min\":1,\"max\":50,\"decimalPlaces\":1}' WHERE code='GYPSUM'").run(), 'GYPSUM_UNIT_OR_VALIDATION_UNEXPECTED'],
    ['unexpected SAR unit', db => db.prepare("UPDATE Analysis SET units='other' WHERE code='SAR'").run(), 'SAR_UNIT_UNEXPECTED'],
    ['missing dimensionless unit mapping', db => db.prepare("UPDATE Analysis SET unitCode=NULL WHERE code='MUNSELL_COLOR'").run(), 'DIMENSIONLESS_UNIT_MISSING_OR_CHANGED']
])('refuses %s without partial changes', (_name, change, code) => { const file = fixture(); edit(file, change); refusal(file, code); });
test.each([
    ["CREATE TRIGGER stop_audit BEFORE INSERT ON AuditLog WHEN NEW.entityId='GYPSUM' BEGIN SELECT RAISE(ABORT,'fixture stop'); END", 'SQLITE_CONSTRAINT_TRIGGER'],
    ["CREATE TRIGGER extra_field AFTER UPDATE OF units ON Analysis WHEN NEW.code='GYPSUM' BEGIN UPDATE Analysis SET version=version+1 WHERE code=NEW.code; END", 'UNEXPECTED_TARGET_CHANGE'],
    ["CREATE TRIGGER lose_default AFTER UPDATE OF analyses ON AnalysisGroup WHEN NEW.id='BASIC_FERTILITY' BEGIN UPDATE Methodology SET isDefault=0 WHERE analysisCode='EC'; END", 'POSTCONDITION_FAILED']
])('rolls all package, metadata, retirement and audit writes back on a trigger failure', (sql, code) => { const file = fixture(); edit(file, db => db.exec(sql)); refusal(file, code); });
test('apply requires the exact reviewed plan hash and refuses a stale plan', () => {
    const file = fixture(), hash = digest(file);
    expect(script.runStepDCatalogue({ dbPath: file, apply: true }).error.code).toBe('EXPECTED_PLAN_SHA256_REQUIRED');
    const dry = script.runStepDCatalogue({ dbPath: file });
    edit(file, db => db.prepare("UPDATE AnalysisGroup SET name='Changed while reviewing' WHERE id='BASIC_FERTILITY'").run());
    const changedHash = digest(file);
    expect(changedHash).not.toBe(hash);
    expect(script.runStepDCatalogue({ dbPath: file, apply: true, expectedPlanSha256: dry.planSha256 }).error.code).toBe('EXPECTED_PLAN_DIFFERS');
    expect(digest(file)).toBe(changedHash);
});
test('CLI needs an explicit existing database, rejects unknown flags, and does not create files', () => {
    const missing = ownedFile(), cli = path.resolve(__dirname, '../../scripts/fix_424_step_d_catalogue.js');
    for (const args of [[], ['--db', missing], ['--unknown'], ['--db', fixture(), '--apply']]) {
        const child = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
        expect(child.status).toBe(1); expect(JSON.parse(child.stdout).ok).toBe(false);
    }
    expect(fs.existsSync(missing)).toBe(false);
});
