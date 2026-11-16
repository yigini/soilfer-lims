const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const Database = require('better-sqlite3');
const script = require('../../scripts/fix_424_step_c_packages');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { createRootClient } = require('../../utils/prismaClientIdentity');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const { createRawResultFixture } = require('../../services/resultWriteService');
const actualResolver = require('../../services/methodResolution');
const actualCatalogue = require('../../services/cataloguePolicy');

const directory = path.resolve(__dirname, '../.tmp');
const files = [];
let baseline;
const packages = {
    BASIC_FERTILITY: ['pH', 'carbonOrganic', 'nitrogenTotal', 'extractableElements', 'exchangeableBases', 'electricalConductivity', 'pSA'],
    CATION_EXCHANGE_SUITE: ['exchangeableBases', 'cationExchangeCapacitySoil', 'effectiveCec', 'acidityExchangeable', 'baseSaturation'],
    FULL_CHARACTERIZATION: ['pH', 'carbonOrganic', 'nitrogenTotal', 'extractableElements', 'exchangeableBases', 'cationExchangeCapacitySoil', 'effectiveCec', 'acidityExchangeable', 'electricalConductivity', 'pSA', 'bulkDensityWholeSoil', 'totalCarbonateEquivalent', 'moistureContent'],
    PHYSICAL_PROPERTIES: ['pSA', 'bulkDensityWholeSoil', 'bulkDensityFineEarth', 'moistureContent', 'availableWaterHoldingCapacity', 'porosity'],
    SALINITY_SODICITY: ['electricalConductivity', 'solubleSalts', 'exchangeableBases', 'pH', 'gypsum']
};
const expectedBasic = ['PH_H2O', 'SOC', 'TN', 'extractableElements', 'EXCH_CA', 'EXCH_MG', 'EXCH_K', 'EXCH_NA', 'EC', 'SAND', 'SILT', 'CLAY'];
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function ownedFile() { const file = path.join(directory, 'issue424c_' + randomUUID() + '.db'); files.push(file); return file; }
function fixture() { const file = ownedFile(); fs.copyFileSync(baseline, file); return file; }
function edit(file, callback) { const db = new Database(file); db.pragma('foreign_keys=ON'); try { return callback(db); } finally { db.close(); } }
function inspect(file, callback) { const db = new Database(file, { readonly: true }); try { return callback(db); } finally { db.close(); } }
function snapshot(file) {
    return inspect(file, db => Object.fromEntries(['AnalysisGroup', 'Analysis', 'Methodology', 'LabMethodDefault', 'AuditLog', 'OrderLine']
        .map(table => [table, db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()])));
}
function apply(file) { return script.runStepCPackages({ dbPath: file, apply: true }); }
function refusal(file, code) {
    const before = digest(file), data = snapshot(file);
    const value = apply(file);
    expect(value.ok).toBe(false);
    expect(value.error.code === code || value.failures?.some(row => row.code === code)).toBe(true);
    expect(value.totalChanges).toBe(0); expect(value.auditRowsCreated).toBe(0);
    expect(digest(file)).toBe(before); expect(snapshot(file)).toEqual(data);
    return value;
}
async function withClient(file, callback) {
    const client = createRootClient({ adapter: new PrismaBetterSqlite3({ url: 'file:' + file }) });
    try { return await callback(client); } finally { await client.$disconnect(); }
}
async function sample(file) {
    return withClient(file, client => createSampleFixture(client, { data: { id: 'sample-ref', originalId: 'FICT-424-C', assignedLab: 'lab-0' } }));
}
async function order(file, code, status = 'ACTIVE', count = 1) {
    await sample(file);
    await withClient(file, async client => {
        for (let i = 0; i < count; i++) await client.sampleOrderRevision.create({ data: {
            id: 'revision-' + i, sampleId: 'sample-ref', version: i + 1,
            lines: { create: { id: 'line-' + i, analysis: code, status } }
        } });
    });
}
beforeAll(() => {
    fs.mkdirSync(directory, { recursive: true }); baseline = ownedFile();
    // The existing fixture authority emits the actual current Prisma schema.
    beforeGuards({ actor: 'system:fixture', file: baseline, qcBootstrap: 'CREATE_PRISMA' });
    edit(baseline, db => {
        for (let i = 0; i < 10; i++) db.prepare('INSERT INTO Lab(id,code,name,country,updatedAt) VALUES(?,?,?,?,?)')
            .run('lab-' + i, 'LAB-' + i, 'Fictional lab ' + i, 'TEST', '2026-01-01T00:00:00.000Z');
        const codes = new Set([...Object.keys(script.REPLACEMENTS), ...script.PARTNERS, ...script.DEFERRED_CODES, 'porosity', 'gypsum', 'UNTOUCHED']);
        for (const code of codes) {
            db.prepare('INSERT INTO Analysis(code,name,units,status,isGlobal,labId) VALUES(?,?,?,\'active\',1,NULL)').run(code, 'Fixture measurement ' + code, '%');
            db.prepare('INSERT INTO Methodology(id,analysisCode,name,isDefault,labId,updatedAt) VALUES(?,?,?,1,NULL,?)')
                .run('method-' + code, code, 'Fixture method ' + code, '2026-01-01T00:00:00.000Z');
        }
        for (const [id, codes] of Object.entries(packages)) db.prepare('INSERT INTO AnalysisGroup(id,name,analyses,labId) VALUES(?,?,?,NULL)').run(id, id + ' package', JSON.stringify(codes));
        db.prepare('INSERT INTO AnalysisGroup(id,name,analyses,labId) VALUES(\'untouched\',\'Untouched package\',\'["UNTOUCHED"]\',NULL)').run();
    });
}, 60000);
afterAll(() => {
    for (const file of files) {
        if (path.dirname(file) !== directory || !path.basename(file).startsWith('issue424c_')) throw Error('Unexpected fixture cleanup path');
        for (const suffix of ['', '-wal', '-shm', '-journal']) fs.rmSync(file + suffix, { force: true });
    }
});

test('default dry-run projects the pinned lists, writes nothing and retains every byte', () => {
    const file = fixture(), before = digest(file), data = snapshot(file);
    const result = script.runStepCPackages({ dbPath: file });
    expect(result).toMatchObject({ ok: true, mode: 'DRY_RUN', totalChanges: 0, auditRowsCreated: 0, sqliteTotalChanges: 0, labContexts: 10, partnerCount: 19, plannedChanges: 19 });
    expect(result.packages.find(row => row.id === 'BASIC_FERTILITY').afterCodes).toEqual(expectedBasic);
    expect(result.databaseBeforeSha256).toBe(result.databaseAfterSha256);
    expect(digest(file)).toBe(before); expect(snapshot(file)).toEqual(data);
});
test('all fourteen free codes and five package rows give nineteen exact before/after audits', () => {
    const file = fixture(), before = snapshot(file), result = apply(file);
    expect(result).toMatchObject({ ok: true, totalChanges: 19, auditRowsCreated: 19, sqliteTotalChanges: 38, auditActor: 'system:issue-424', integrityCheck: 'ok', foreignKeyCheckRows: 0 });
    const after = snapshot(file);
    expect(after.Methodology).toEqual(before.Methodology); expect(after.LabMethodDefault).toEqual(before.LabMethodDefault);
    expect(after.AnalysisGroup.find(row => row.id === 'untouched')).toEqual(before.AnalysisGroup.find(row => row.id === 'untouched'));
    for (const audit of after.AuditLog) {
        const record = result.records.find(row => row.target === audit.entityId);
        expect(audit.performedBy).toBe('system:issue-424');
        expect(JSON.parse(audit.details)).toEqual({ issue: 424, step: 'C', kind: record.kind });
        expect(JSON.parse(audit.before)).toEqual(record.before); expect(JSON.parse(audit.after)).toEqual(record.after);
    }
    for (const code of script.DEFERRED_CODES) expect(after.Analysis.find(row => row.code === code)).toEqual(before.Analysis.find(row => row.code === code));
});
test('the pinned two active pSA lines stay untouched and pSA stays active: eighteen changes', async () => {
    const file = fixture(); await order(file, 'pSA', 'ACTIVE', 2);
    const lines = inspect(file, db => db.prepare('SELECT * FROM OrderLine ORDER BY id').all());
    const result = apply(file);
    expect(result).toMatchObject({ ok: true, totalChanges: 18, auditRowsCreated: 18, sqliteTotalChanges: 36 });
    expect(result.retirements.find(row => row.code === 'pSA')).toMatchObject({ state: 'kept_active', reasons: ['order lines'], activeOrderLines: 2 });
    expect(inspect(file, db => db.prepare("SELECT status FROM Analysis WHERE code='pSA'").get().status)).toBe('active');
    expect(inspect(file, db => db.prepare('SELECT * FROM OrderLine ORDER BY id').all())).toEqual(lines);
    expect(result.packages.every(row => !row.afterCodes.includes('pSA'))).toBe(true);
});
test('second apply is a byte-identical zero-write operation', () => {
    const file = fixture(); expect(apply(file).ok).toBe(true);
    const before = digest(file), data = snapshot(file), result = apply(file);
    expect(result).toMatchObject({ ok: true, plannedChanges: 0, totalChanges: 0, auditRowsCreated: 0, sqliteTotalChanges: 0 });
    expect(digest(file)).toBe(before); expect(snapshot(file)).toEqual(data);
});
test('expansion keeps first-occurrence order when old and current codes overlap', () => {
    expect(script.replaceCodes(['EXCH_CA', 'exchangeableBases', 'pH', 'PH_H2O', 'exchangeableBases', 'pSA', 'SILT']))
        .toEqual(['EXCH_CA', 'EXCH_MG', 'EXCH_K', 'EXCH_NA', 'PH_H2O', 'SAND', 'SILT', 'CLAY']);
    const file = fixture(); edit(file, db => db.prepare("UPDATE AnalysisGroup SET analyses=? WHERE id='BASIC_FERTILITY'").run('["EXCH_CA","exchangeableBases","pH","PH_H2O","pSA","SILT"]'));
    expect(apply(file).ok).toBe(true);
    const codes = inspect(file, db => JSON.parse(db.prepare("SELECT analyses FROM AnalysisGroup WHERE id='BASIC_FERTILITY'").get().analyses));
    expect(codes).toEqual(['EXCH_CA', 'EXCH_MG', 'EXCH_K', 'EXCH_NA', 'PH_H2O', 'SAND', 'SILT', 'CLAY']);
});
test('pin 4 keeps existing porosity, gypsum and deferred gaps with no new missing default', () => {
    const file = fixture(); edit(file, db => {
        for (const code of script.RETAINED_WITHOUT_DEFAULT) db.prepare('UPDATE Methodology SET isDefault=0 WHERE analysisCode=?').run(code);
    });
    const before = snapshot(file), result = apply(file);
    expect(result.ok).toBe(true);
    expect(result.availabilityBefore.length).toBeGreaterThan(0);
    expect(new Set(result.availabilityBefore.map(row => row.code))).toEqual(new Set(script.RETAINED_WITHOUT_DEFAULT));
    expect(result.availabilityAfter).toEqual(result.availabilityBefore);
    expect(result.availabilityAfter.every(row => row.labId === null || /^lab-\d$/.test(row.labId))).toBe(true);
    const after = snapshot(file);
    expect(after.Methodology).toEqual(before.Methodology);
    for (const code of script.RETAINED_WITHOUT_DEFAULT) expect(after.Analysis.find(row => row.code === code)).toEqual(before.Analysis.find(row => row.code === code));
    expect(apply(file)).toMatchObject({ ok: true, totalChanges: 0, availabilityBefore: result.availabilityAfter, availabilityAfter: result.availabilityAfter });
});
test('unrelated package gaps are reported per lab and preserved without widening the target exception', () => {
    const file = fixture(); edit(file, db => db.prepare("UPDATE Methodology SET isDefault=0 WHERE analysisCode='UNTOUCHED'").run());
    const result = apply(file); expect(result.ok).toBe(true);
    expect(result.availabilityBefore).toHaveLength(11);
    expect(result.availabilityAfter).toEqual(result.availabilityBefore);
    expect(result.availabilityBefore.every(row => row.packageId === 'untouched' && row.code === 'UNTOUCHED')).toBe(true);
});
test('an unapproved pre-existing target gap blocks instead of choosing a method', () => {
    const file = fixture(); edit(file, db => {
        db.prepare("UPDATE AnalysisGroup SET analyses='[\"pH\",\"UNTOUCHED\"]' WHERE id='BASIC_FERTILITY'").run();
        db.prepare("UPDATE Methodology SET isDefault=0 WHERE analysisCode='UNTOUCHED'").run();
    });
    refusal(file, 'UNAPPROVED_PACKAGE_DEFAULT_GAP');
});
test.each(['BASIC_FERTILITY package', '  basic_fertility PACKAGE  ', 'BASIC_FERTILITY'])('a lab-owned row named %s blocks the whole run', name => {
    const file = fixture(); edit(file, db => db.prepare("INSERT INTO AnalysisGroup(id,name,analyses,labId) VALUES('surprise-copy',?,'[\"pH\"]','lab-0')").run(name));
    refusal(file, 'LAB_OWNED_TARGET_PACKAGE_COPY');
});
test('a newly missing partner default blocks with both before/after gap lists', () => {
    const file = fixture(); edit(file, db => db.prepare("UPDATE Methodology SET isDefault=0 WHERE analysisCode='EC'").run());
    const result = refusal(file, 'NEW_MISSING_DEFAULT');
    expect(result.availabilityAfter.some(row => row.code === 'EC')).toBe(true);
    expect(result.availabilityBefore.some(row => row.code === 'EC')).toBe(false);
});
test.each([
    ['partner absent', db => { db.prepare("DELETE FROM Methodology WHERE analysisCode='EC'").run(); db.prepare("DELETE FROM Analysis WHERE code='EC'").run(); }, 'PARAMETER_MISSING'],
    ['partner inactive', db => db.prepare("UPDATE Analysis SET status='inactive' WHERE code='EC'").run(), 'PARAMETER_NOT_ACTIVE_GLOBAL'],
    ['partner lab-owned', db => db.prepare("UPDATE Analysis SET labId='lab-0' WHERE code='EC'").run(), 'PARAMETER_NOT_ACTIVE_GLOBAL'],
    ['partner not global', db => db.prepare("UPDATE Analysis SET isGlobal=0 WHERE code='EC'").run(), 'PARAMETER_NOT_ACTIVE_GLOBAL'],
    ['partner needs curation', db => db.prepare("UPDATE Analysis SET name=code WHERE code='EC'").run(), 'PARAMETER_CONFIGURATION_INVALID'],
    ['wrong pH unit', db => db.prepare("UPDATE Analysis SET units='mg/kg' WHERE code='PH_H2O'").run(), 'PARAMETER_CONFIGURATION_INVALID'],
    ['invalid validation', db => db.prepare("UPDATE Analysis SET validation='bad-json' WHERE code='EC'").run(), 'PARAMETER_CONFIGURATION_INVALID'],
    ['no default', db => db.prepare("UPDATE Methodology SET isDefault=0 WHERE analysisCode='EC'").run(), 'DEFAULT_METHOD_MISSING'],
    ['two defaults', db => db.prepare("INSERT INTO Methodology(id,analysisCode,name,isDefault,updatedAt) VALUES('second-EC','EC','Second method',1,'2026-01-01')").run(), 'DEFAULT_CONFLICT'],
    ['invalid lab override', db => db.prepare("INSERT INTO LabMethodDefault(id,labId,analysisCode,methodologyId,updatedAt) VALUES('override','lab-0','EC','method-TN','2026-01-01')").run(), 'INVALID_LAB_OVERRIDE'],
    ['deferred inactive', db => db.prepare("UPDATE Analysis SET status='inactive' WHERE code='solubleSalts'").run(), 'DEFERRED_CODE_NOT_ACTIVE_GLOBAL'],
    ['package not global', db => db.prepare("UPDATE AnalysisGroup SET labId='lab-0' WHERE id='BASIC_FERTILITY'").run(), 'PACKAGE_NOT_GLOBAL'],
    ['missing package', db => db.prepare("DELETE FROM AnalysisGroup WHERE id='BASIC_FERTILITY'").run(), 'PACKAGE_MISSING'],
    ['empty target package', db => db.prepare("UPDATE AnalysisGroup SET analyses='[]' WHERE id='BASIC_FERTILITY'").run(), 'INVALID_PACKAGE_LIST'],
    ['unreadable other package', db => db.prepare("UPDATE AnalysisGroup SET analyses='broken' WHERE id='untouched'").run(), 'INVALID_PACKAGE_LIST'],
    ['legacy scope differs', db => db.prepare("UPDATE Analysis SET labId='lab-0' WHERE code='pH'").run(), 'LEGACY_PARAMETER_SCOPE_OR_STATUS']
])('%s aborts before any target/audit write and leaves identical bytes', (_label, change, code) => {
    const file = fixture(); edit(file, change); refusal(file, code);
});
test('a local duplicate default blocks even though the global default is unique', () => {
    const file = fixture(); edit(file, db => {
        for (const id of ['local-one', 'local-two']) db.prepare('INSERT INTO Methodology(id,analysisCode,name,isDefault,labId,updatedAt) VALUES(?,\'EC\',?,1,\'lab-0\',\'2026-01-01\')').run(id, id);
    });
    refusal(file, 'DEFAULT_CONFLICT');
});
test('a lab-owned package keeps its referenced legacy code active without changing that package', () => {
    const file = fixture(); edit(file, db => db.prepare("INSERT INTO AnalysisGroup(id,name,analyses,labId) VALUES('lab-copy','Local copy','[\"pH\"]','lab-0')").run());
    const before = inspect(file, db => db.prepare("SELECT * FROM AnalysisGroup WHERE id='lab-copy'").get());
    const result = apply(file); expect(result.ok).toBe(true);
    expect(result.retirements.find(row => row.code === 'pH')).toMatchObject({ state: 'kept_active', reasons: ['packages'], remainingPackages: ['lab-copy'] });
    expect(inspect(file, db => db.prepare("SELECT * FROM AnalysisGroup WHERE id='lab-copy'").get())).toEqual(before);
});
test('even a retained non-current Result prevents retirement', async () => {
    const file = fixture(); await sample(file);
    edit(file, db => createRawResultFixture(db, { id: 'old-result', sampleId: 'sample-ref', param: 'pH', value: '5', isCurrent: 0, updatedAt: '2026-01-01T00:00:00.000Z' }));
    const result = apply(file); expect(result.ok).toBe(true);
    expect(result.retirements.find(row => row.code === 'pH')).toMatchObject({ state: 'kept_active', reasons: ['results'], results: 1 });
});
test('a WorkItem prevents retirement irrespective of package replacement', async () => {
    const file = fixture(); await sample(file);
    await withClient(file, client => createWorkItemFixture(client, { data: { id: 'work-ref', sampleId: 'sample-ref', analysis: 'pH', assignedLab: 'lab-0' } }));
    const result = apply(file); expect(result.ok).toBe(true);
    expect(result.retirements.find(row => row.code === 'pH')).toMatchObject({ state: 'kept_active', reasons: ['work items'], workItems: 1 });
});
test('cancelled order lines are retained without blocking a free code', async () => {
    const file = fixture(); await order(file, 'pH', 'CANCELLED');
    const result = apply(file); expect(result.ok).toBe(true);
    expect(result.retirements.find(row => row.code === 'pH')).toMatchObject({ state: 'planned', activeOrderLines: 0 });
    expect(inspect(file, db => db.prepare("SELECT status FROM OrderLine WHERE id='line-0'").get().status)).toBe('CANCELLED');
});
test('an empty unrelated package is preserved and means no code references', () => {
    const file = fixture(); edit(file, db => db.prepare("UPDATE AnalysisGroup SET analyses='[]' WHERE id='untouched'").run());
    expect(apply(file).ok).toBe(true);
    expect(inspect(file, db => db.prepare("SELECT analyses FROM AnalysisGroup WHERE id='untouched'").get().analyses)).toBe('[]');
});
test('a mid-transaction audit failure rolls every package and retirement back', () => {
    const file = fixture(); edit(file, db => db.exec("CREATE TRIGGER stop_audit BEFORE INSERT ON AuditLog WHEN NEW.entityId='pH' BEGIN SELECT RAISE(ABORT,'fixture stop'); END"));
    refusal(file, 'SQLITE_CONSTRAINT_TRIGGER');
});
test('a trigger changing an extra target field rolls the entire transaction back', () => {
    const file = fixture(); edit(file, db => db.exec("CREATE TRIGGER extra_field AFTER UPDATE OF status ON Analysis WHEN NEW.code='pH' BEGIN UPDATE Analysis SET version=version+1 WHERE code=NEW.code; END"));
    refusal(file, 'UNEXPECTED_TARGET_CHANGE');
});
test('a default lost during apply rolls every package, method and audit change back', () => {
    const file = fixture(); edit(file, db => db.exec("CREATE TRIGGER lose_default AFTER UPDATE OF analyses ON AnalysisGroup WHEN NEW.id='BASIC_FERTILITY' BEGIN UPDATE Methodology SET isDefault=0 WHERE analysisCode='EC'; END"));
    refusal(file, 'POSTCONDITION_FAILED');
});
test('the actual application resolver and catalogue agree after apply in every lab', async () => {
    const file = fixture(); expect(apply(file).ok).toBe(true);
    await withClient(file, async client => {
        const all = await client.analysisGroup.findMany({ where: { id: { in: script.PACKAGE_IDS } } });
        for (const labId of [null, ...Array.from({ length: 10 }, (_, i) => 'lab-' + i)]) for (const group of all) {
            const codes = JSON.parse(group.analyses);
            expect((await actualCatalogue.validateSelection(codes, { labId, db: client })).valid).toBe(true);
            const selected = await actualResolver.resolveDefaultSelections(codes, labId, client);
            expect([...selected.values()].every(row => row.method && !row.error)).toBe(true);
        }
    });
});
test.each([
    { code: 'EC', name: 'EC', status: 'active', units: '%', validation: null },
    { code: 'EC', name: 'Electrical conductivity', status: 'active', units: '%', validation: '{"min":5,"max":1}' },
    { code: 'PH_H2O', name: 'pH in water', status: 'active', units: 'mg/kg', validation: null },
    { code: 'EC', name: 'Electrical conductivity', status: 'active', units: '%', validation: '{"decimalPlaces":2}' }
])('definition validation agrees with the running application contract: $code $name', row => {
    expect(script.configurationIssues(row)).toEqual(actualCatalogue.configurationIssues(row));
});
test('CLI needs an explicit existing database and never creates a missing one', () => {
    const missing = ownedFile(), q = spawnSync(process.execPath, [path.resolve(__dirname, '../../scripts/fix_424_step_c_packages.js'), '--db', missing], { encoding: 'utf8' });
    expect(q.status).toBe(1); expect(JSON.parse(q.stdout).ok).toBe(false); expect(fs.existsSync(missing)).toBe(false);
    expect(script.cli([])).toMatchObject({ ok: false, error: { code: 'DATABASE_PATH_REQUIRED' } });
    expect(script.cli(['--db', fixture(), '--apply', '--apply'])).toMatchObject({ ok: false, error: { code: 'INVALID_ARGUMENTS' } });
});
test('the wrapper failure boundaries pass without contacting Docker', () => {
    const python = process.platform === 'win32' ? 'python' : 'python3';
    const wrapper = path.resolve(__dirname, '../../scripts/run_424_step_c.py');
    const result = spawnSync(python, ['-B', path.join(__dirname, 'step_c_wrapper_checks.py'), wrapper], { encoding: 'utf8' });
    expect({ status: result.status, output: result.stderr }).toEqual({ status: 0, output: expect.stringContaining('OK') });
});
test('the actual wrapper verifier accepts full database/audit rows using the JavaScript numeric representation', () => {
    const file = fixture(), applied = apply(file); expect(applied.ok).toBe(true);
    const python = process.platform === 'win32' ? 'python' : 'python3';
    const wrapper = path.resolve(__dirname, '../../scripts/run_424_step_c.py');
    const producer = spawnSync(python, ['-B', '-c', "import importlib.util,sys; s=importlib.util.spec_from_file_location('w',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);sys.stdout.write(m.VERIFY_JS)", wrapper], { encoding: 'utf8' });
    expect(producer.status).toBe(0);
    const verification = producer.stdout.replace('/app/server/scripts/fix_424_step_c_packages.js', path.resolve(__dirname, '../../scripts/fix_424_step_c_packages.js').replaceAll('\\', '/'))
        .replace('/app/server/prisma/dev.db', file.replaceAll('\\', '/'));
    const sourceFile = path.resolve(__dirname, '../../scripts/fix_424_step_c_packages.js');
    const payload = { receipt: applied, scriptSource: fs.readFileSync(sourceFile, 'utf8'), scriptSha256: digest(sourceFile) };
    const verified = spawnSync(process.execPath, ['-e', verification], { input: JSON.stringify(payload), encoding: 'utf8' });
    expect({ status: verified.status, output: verified.stderr }).toEqual({ status: 0, output: '' });
    expect(JSON.parse(verified.stdout)).toMatchObject({ allTargetRowsAndAuditBeforeAfterVerified: true, auditRows: 19, canonicalJsonFromSameJavaScriptImplementation: true });
    const bad = JSON.parse(JSON.stringify(applied)); bad.records.find(row => row.state === 'changed').afterRowSha256 = 'incorrect';
    expect(spawnSync(process.execPath, ['-e', verification], { input: JSON.stringify({ ...payload, receipt: bad }), encoding: 'utf8' }).status).not.toBe(0);
    expect(spawnSync(process.execPath, ['-e', verification], { input: JSON.stringify({ ...payload, scriptSha256: 'wrong' }), encoding: 'utf8' }).status).not.toBe(0);
});
