const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash, randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const Database = require('better-sqlite3');
const script = require('../../scripts/fix_424_legacy_catalogue');
const { resolveDefaultSelections } = require('../../services/methodResolution');
const { createRootClient } = require('../../utils/prismaClientIdentity');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { createRawResultFixture } = require('../../services/resultWriteService');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const workflowTables = new Set(['Sample', 'WorkItem']);
// Literal fresh table definitions emitted by the current pinned Prisma schema.
// Actual positive workflow rows use the existing state/audit fixture authorities.


const sha = filename => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const roots = [];
const sqlName = name => '"' + name.replace(/"/g, '""') + '"';
function fixture({ wal = false } = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'issue424-owned-fictional-'));
    roots.push(root);
    const filename = path.resolve(__dirname, '../.tmp', 'issue424-owned-fictional-' + randomUUID() + '.db');
    const db = new Database(filename);
    const fields = new Map();
    const add = (t, c) => { if (!fields.has(t)) fields.set(t, new Set(['id'])); fields.get(t).add(c); };
    for (const [t, c] of [...script.CODE_HOLDERS, ...script.METHOD_HOLDERS, ...script.JSON_HOLDERS]) add(t, c);
    for (const [t, cols] of Object.entries({
        Analysis: ['code', 'name', 'units', 'status', 'labId', 'prerequisites'],
        Methodology: ['id', 'analysisCode', 'name', 'standard', 'referenceId', 'labId', 'isDefault', 'createdAt', 'updatedAt'],
        AuditLog: ['entity', 'entityId', 'action', 'details', 'performedBy', 'timestamp', 'analysisCode', 'before', 'after'],
        ExternalMapping: ['entityType', 'entityKey'], Lab: ['name'],
        AnalysisGroup: ['name', 'labId'], LabMethodDefault: ['labId'],
        OrderLine: ['status', 'revisionId'], SampleOrderRevision: ['sampleId'], Sample: ['labId', 'assignedLab']
    })) for (const c of cols) add(t, c);
    for (const [t, cols] of fields) {
        if (t === 'Sample') db.exec("CREATE TABLE \"Sample\" (\n    \"id\" TEXT NOT NULL PRIMARY KEY,\n    \"originalId\" TEXT NOT NULL,\n    \"projectCode\" TEXT,\n    \"projectId\" TEXT,\n    \"countryName\" TEXT,\n    \"country\" TEXT,\n    \"assignedLab\" TEXT,\n    \"labId\" TEXT,\n    \"labSampleCode\" TEXT,\n    \"status\" TEXT NOT NULL,\n    \"holdPriorStatus\" TEXT,\n    \"legacyStatus\" TEXT,\n    \"dryingStatus\" TEXT,\n    \"preparationStatus\" TEXT,\n    \"receptionDate\" DATETIME,\n    \"receivedBy\" TEXT,\n    \"retainUntil\" DATETIME,\n    \"depthTop\" REAL,\n    \"depthBottom\" REAL,\n    \"horizon\" TEXT,\n    \"clientName\" TEXT,\n    \"metadata\" TEXT,\n    \"fieldMetadata\" TEXT,\n    \"receptionData\" TEXT,\n    \"requiredAnalyses\" TEXT,\n    \"analysisGroupIds\" TEXT,\n    \"history\" TEXT,\n    \"rejectionReason\" TEXT,\n    \"receivedMass\" REAL,\n    \"massWarningAcknowledged\" BOOLEAN DEFAULT false,\n    \"moistureOnArrival\" TEXT,\n    \"foreignMaterial\" TEXT,\n    \"intakePhotos\" TEXT,\n    \"isResubmission\" BOOLEAN DEFAULT false,\n    \"latitude\" REAL,\n    \"longitude\" REAL,\n    \"elevation\" REAL,\n    \"positionalUncertaintyM\" REAL,\n    \"locationSource\" TEXT,\n    \"locationCapturedAt\" DATETIME,\n    \"locationCapturedBy\" TEXT,\n    \"compositeRadiusM\" REAL,\n    \"depthTopCm\" REAL,\n    \"depthBottomCm\" REAL,\n    \"admin1\" TEXT,\n    \"admin2\" TEXT,\n    \"village\" TEXT,\n    \"siteName\" TEXT,\n    \"custodyHandoverAt\" DATETIME,\n    \"custodyCarrierName\" TEXT,\n    \"custodyTrackingNumber\" TEXT,\n    \"custodySenderSignature\" TEXT,\n    \"receivingOfficerId\" TEXT,\n    \"receivingOfficerName\" TEXT,\n    \"receivingOfficerSignature\" TEXT,\n    \"matrix\" TEXT NOT NULL DEFAULT 'SOIL',\n    \"plantPart\" TEXT,\n    \"growthStage\" TEXT,\n    \"acceptedBy\" TEXT,\n    \"acceptedAt\" DATETIME,\n    \"approvedBy\" TEXT,\n    \"approvedAt\" DATETIME,\n    \"lastSubmissionId\" TEXT,\n    \"lastSubmissionType\" TEXT,\n    \"lastSubmissionAt\" DATETIME,\n    \"createdAt\" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    \"updatedAt\" DATETIME NOT NULL,\n    \"consignmentId\" TEXT,\n    CONSTRAINT \"Sample_projectId_fkey\" FOREIGN KEY (\"projectId\") REFERENCES \"Project\" (\"id\") ON DELETE SET NULL ON UPDATE CASCADE,\n    CONSTRAINT \"Sample_consignmentId_fkey\" FOREIGN KEY (\"consignmentId\") REFERENCES \"Consignment\" (\"id\") ON DELETE SET NULL ON UPDATE CASCADE\n);");
        else if (t === 'WorkItem') db.exec("CREATE TABLE \"WorkItem\" (\n    \"id\" TEXT NOT NULL PRIMARY KEY,\n    \"sampleId\" TEXT NOT NULL,\n    \"labId\" TEXT,\n    \"legacyLabId\" TEXT,\n    \"assignedLab\" TEXT,\n    \"analysis\" TEXT NOT NULL,\n    \"duplicateOf\" TEXT,\n    \"category\" TEXT,\n    \"status\" TEXT NOT NULL,\n    \"holdPriorStatus\" TEXT,\n    \"legacyStatus\" TEXT,\n    \"cancellationCode\" TEXT,\n    \"cancellationReason\" TEXT,\n    \"cancelledBy\" TEXT,\n    \"cancelledAt\" DATETIME,\n    \"assignedTo\" TEXT,\n    \"assignedBy\" TEXT,\n    \"assignedAt\" DATETIME,\n    \"priority\" TEXT NOT NULL DEFAULT 'NORMAL',\n    \"dueDate\" DATETIME,\n    \"result\" TEXT,\n    \"methodologyId\" TEXT,\n    \"equipmentId\" TEXT,\n    \"completedAt\" DATETIME,\n    \"version\" INTEGER NOT NULL DEFAULT 0,\n    \"submissionId\" TEXT,\n    \"submittedAt\" DATETIME,\n    \"batchId\" TEXT,\n    \"rackPosition\" INTEGER,\n    \"reanalysisReason\" TEXT,\n    \"reanalysisRequestedBy\" TEXT,\n    \"reviewedBy\" TEXT,\n    \"reviewedAt\" DATETIME,\n    \"reviewDecision\" TEXT,\n    \"waiveReason\" TEXT,\n    \"history\" TEXT,\n    \"createdAt\" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    \"updatedAt\" DATETIME NOT NULL,\n    CONSTRAINT \"WorkItem_sampleId_fkey\" FOREIGN KEY (\"sampleId\") REFERENCES \"Sample\" (\"id\") ON DELETE RESTRICT ON UPDATE CASCADE,\n    CONSTRAINT \"WorkItem_duplicateOf_fkey\" FOREIGN KEY (\"duplicateOf\") REFERENCES \"WorkItem\" (\"id\") ON DELETE RESTRICT ON UPDATE CASCADE,\n    CONSTRAINT \"WorkItem_assignedTo_fkey\" FOREIGN KEY (\"assignedTo\") REFERENCES \"User\" (\"username\") ON DELETE SET NULL ON UPDATE CASCADE,\n    CONSTRAINT \"WorkItem_assignedBy_fkey\" FOREIGN KEY (\"assignedBy\") REFERENCES \"User\" (\"username\") ON DELETE SET NULL ON UPDATE CASCADE,\n    CONSTRAINT \"WorkItem_methodologyId_fkey\" FOREIGN KEY (\"methodologyId\") REFERENCES \"Methodology\" (\"id\") ON DELETE SET NULL ON UPDATE CASCADE,\n    CONSTRAINT \"WorkItem_submissionId_fkey\" FOREIGN KEY (\"submissionId\") REFERENCES \"Submission\" (\"id\") ON DELETE SET NULL ON UPDATE CASCADE,\n    CONSTRAINT \"WorkItem_batchId_fkey\" FOREIGN KEY (\"batchId\") REFERENCES \"Batch\" (\"id\") ON DELETE SET NULL ON UPDATE CASCADE\n);");
        else if (t === 'AuditLog') db.exec("CREATE TABLE \"AuditLog\" (\n    \"id\" TEXT NOT NULL PRIMARY KEY,\n    \"entity\" TEXT NOT NULL,\n    \"entityId\" TEXT NOT NULL,\n    \"action\" TEXT NOT NULL,\n    \"details\" TEXT,\n    \"performedBy\" TEXT NOT NULL,\n    \"performedByName\" TEXT,\n    \"timestamp\" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    \"sampleId\" TEXT,\n    \"labId\" TEXT,\n    \"analysisCode\" TEXT,\n    \"before\" TEXT,\n    \"after\" TEXT\n);");
        else if (t === 'Analysis') db.exec('CREATE TABLE Analysis(id TEXT,code TEXT PRIMARY KEY,name TEXT,units TEXT,status TEXT,labId TEXT,prerequisites TEXT)');
        else if (t === 'Methodology') db.exec('CREATE TABLE Methodology(id TEXT PRIMARY KEY,analysisCode TEXT REFERENCES Analysis(code),name TEXT,standard TEXT,referenceId TEXT,labId TEXT,isDefault INTEGER,createdAt TEXT,updatedAt TEXT)');
        else db.exec(`CREATE TABLE ${sqlName(t)} (${[...cols].map(c => sqlName(c) + (c === 'id' ? ' TEXT PRIMARY KEY' : ' TEXT')).join(',')})`);
    }
    db.exec('CREATE TABLE IF NOT EXISTS Project(id TEXT PRIMARY KEY); CREATE TABLE IF NOT EXISTS Consignment(id TEXT PRIMARY KEY); CREATE TABLE IF NOT EXISTS User(username TEXT PRIMARY KEY); CREATE TABLE IF NOT EXISTS Submission(id TEXT PRIMARY KEY)');
    db.pragma('foreign_keys=ON');
    for (let i = 0; i < 10; i++) db.prepare('INSERT INTO Lab(id,name) VALUES(?,?)').run('lab-' + i, 'Fictional lab ' + i);
    for (const code of new Set([...Object.values(script.EXTRA_DEFAULTS), ...script.RETIRE_CODES, 'HOLDER_REFERENCE', 'PH_H2O'])) {
        db.prepare('INSERT INTO Analysis(code,name,units,status,labId,prerequisites) VALUES(?,?,?,\'active\',NULL,\'[]\')').run(code, 'Fictional ' + code, '%');
    }
    for (const [id, code] of Object.entries(script.EXTRA_DEFAULTS)) {
        db.prepare('INSERT INTO Methodology VALUES(?,?,?,?,?,NULL,1,?,?)').run(id, code, 'Extra ' + code, 'fixture reference', null, '2026-01-01', '2026-01-01');
        db.prepare('INSERT INTO Methodology VALUES(?,?,?,?,?,NULL,1,?,?)').run('retained-' + code, code, 'Retained ' + code, 'fixture reference', null, '2026-01-01', '2026-01-01');
    }
    for (const code of script.RETIRE_CODES) db.prepare('INSERT INTO Methodology VALUES(?,?,?,?,?,NULL,1,?,?)').run('definition-' + code, code, 'Definition ' + code, null, null, '2026-01-01', '2026-01-01');
    if (wal) { db.pragma('journal_mode=WAL'); db.pragma('wal_autocheckpoint=0'); db.exec("INSERT INTO Lab(id,name) VALUES('wal-marker','Fictional WAL marker')"); }
    db.close();
    return { root, filename };
}
function edit(filename, callback) { const db = new Database(filename); try { callback(db); } finally { db.close(); } }
function read(filename, callback) { const db = new Database(filename, { readonly: true }); try { return callback(db); } finally { db.close(); } }
function expectRefusal(filename, code) {
    const before = sha(filename);
    const result = script.runCatalogueCorrection({ dbPath: filename, apply: true });
    expect(result.ok).toBe(false);
    expect([result.error?.code, ...(result.failures || []).map(f => f.code), ...(result.error?.failures || []).map(f => f.code)]).toContain(code);
    expect(result.totalChanges).toBe(0);
    expect(result.auditRowsCreated).toBe(0);
    expect(sha(filename)).toBe(before);
    expect(read(filename, db => db.prepare('SELECT COUNT(*) AS n FROM AuditLog WHERE performedBy=?').get('system:issue-424').n)).toBe(0);
    return result;
}
function addUse(db, table, column, target) {
    if (workflowTables.has(table)) throw new Error('Workflow rows require the central fixture authority.');
    if (table === 'Result') return createRawResultFixture(db, { [column]: target });
    if (table === 'Analysis') return db.prepare(`UPDATE Analysis SET ${sqlName(column)}=? WHERE code='HOLDER_REFERENCE'`).run(target);
    if (table === 'AuditLog') return db.prepare(`INSERT INTO AuditLog(id,entityId,entity,action,performedBy,${sqlName(column)}) VALUES('use','use','ANALYSIS','FIXTURE_REFERENCE','system:fixture',?)`).run(target);
    const commands = {
        "AnalysisGroup.analyses": () => db.prepare("INSERT INTO \"AnalysisGroup\" (\"analyses\") VALUES(?)").run(target),
        "Batch.analysis": () => db.prepare("INSERT INTO \"Batch\" (\"analysis\") VALUES(?)").run(target),
        "Batch.history": () => db.prepare("INSERT INTO \"Batch\" (\"history\") VALUES(?)").run(target),
        "BatchAnalyte.analysisCode": () => db.prepare("INSERT INTO \"BatchAnalyte\" (\"analysisCode\") VALUES(?)").run(target),
        "BatchAnalyte.criteriaSnapshot": () => db.prepare("INSERT INTO \"BatchAnalyte\" (\"criteriaSnapshot\") VALUES(?)").run(target),
        "BatchAnalyte.methodologyId": () => db.prepare("INSERT INTO \"BatchAnalyte\" (\"methodologyId\") VALUES(?)").run(target),
        "BatchDisposition.analysisCode": () => db.prepare("INSERT INTO \"BatchDisposition\" (\"analysisCode\") VALUES(?)").run(target),
        "BatchPositionReference.analysisCode": () => db.prepare("INSERT INTO \"BatchPositionReference\" (\"analysisCode\") VALUES(?)").run(target),
        "BatchPositionReference.referenceSnapshot": () => db.prepare("INSERT INTO \"BatchPositionReference\" (\"referenceSnapshot\") VALUES(?)").run(target),
        "BatchPositionWorkItem.analysisCode": () => db.prepare("INSERT INTO \"BatchPositionWorkItem\" (\"analysisCode\") VALUES(?)").run(target),
        "CalcTemplate.analysisCode": () => db.prepare("INSERT INTO \"CalcTemplate\" (\"analysisCode\") VALUES(?)").run(target),
        "CalcTemplate.inputs": () => db.prepare("INSERT INTO \"CalcTemplate\" (\"inputs\") VALUES(?)").run(target),
        "CalcTemplate.methodologyId": () => db.prepare("INSERT INTO \"CalcTemplate\" (\"methodologyId\") VALUES(?)").run(target),
        "CalcTemplate.parameters": () => db.prepare("INSERT INTO \"CalcTemplate\" (\"parameters\") VALUES(?)").run(target),
        "CalcTemplateActivation.analysisCode": () => db.prepare("INSERT INTO \"CalcTemplateActivation\" (\"analysisCode\") VALUES(?)").run(target),
        "CalcTemplateActivation.methodologyId": () => db.prepare("INSERT INTO \"CalcTemplateActivation\" (\"methodologyId\") VALUES(?)").run(target),
        "CalibrationCurve.methodologyId": () => db.prepare("INSERT INTO \"CalibrationCurve\" (\"methodologyId\") VALUES(?)").run(target),
        "ControlLimitProposal.analysisCode": () => db.prepare("INSERT INTO \"ControlLimitProposal\" (\"analysisCode\") VALUES(?)").run(target),
        "ControlLimitProposal.methodologyId": () => db.prepare("INSERT INTO \"ControlLimitProposal\" (\"methodologyId\") VALUES(?)").run(target),
        "ControlLimitProposal.policySnapshot": () => db.prepare("INSERT INTO \"ControlLimitProposal\" (\"policySnapshot\") VALUES(?)").run(target),
        "ControlLimitProposal.selectionSnapshot": () => db.prepare("INSERT INTO \"ControlLimitProposal\" (\"selectionSnapshot\") VALUES(?)").run(target),
        "ControlLimitSet.analysisCode": () => db.prepare("INSERT INTO \"ControlLimitSet\" (\"analysisCode\") VALUES(?)").run(target),
        "ControlLimitSet.methodologyId": () => db.prepare("INSERT INTO \"ControlLimitSet\" (\"methodologyId\") VALUES(?)").run(target),
        "EquipmentMethodEligibility.analysisCode": () => db.prepare("INSERT INTO \"EquipmentMethodEligibility\" (\"analysisCode\") VALUES(?)").run(target),
        "EquipmentMethodEligibility.methodId": () => db.prepare("INSERT INTO \"EquipmentMethodEligibility\" (\"methodId\") VALUES(?)").run(target),
        "InventoryTransaction.analysisCode": () => db.prepare("INSERT INTO \"InventoryTransaction\" (\"analysisCode\") VALUES(?)").run(target),
        "LabMethodDefault.analysisCode": () => db.prepare("INSERT INTO \"LabMethodDefault\" (\"analysisCode\") VALUES(?)").run(target),
        "LabMethodDefault.methodologyId": () => db.prepare("INSERT INTO \"LabMethodDefault\" (\"methodologyId\") VALUES(?)").run(target),
        "LabPolicyOverride.analysisCode": () => db.prepare("INSERT INTO \"LabPolicyOverride\" (\"analysisCode\") VALUES(?)").run(target),
        "LabPolicyOverride.methodologyId": () => db.prepare("INSERT INTO \"LabPolicyOverride\" (\"methodologyId\") VALUES(?)").run(target),
        "MethodRequirement.analysisCode": () => db.prepare("INSERT INTO \"MethodRequirement\" (\"analysisCode\") VALUES(?)").run(target),
        "MethodRequirement.methodId": () => db.prepare("INSERT INTO \"MethodRequirement\" (\"methodId\") VALUES(?)").run(target),
        "Methodology.analysisCode": () => db.prepare("INSERT INTO \"Methodology\" (\"analysisCode\") VALUES(?)").run(target),
        "OrderLine.analysis": () => db.prepare("INSERT INTO \"OrderLine\" (\"analysis\") VALUES(?)").run(target),
        "OrderLine.methodologyId": () => db.prepare("INSERT INTO \"OrderLine\" (\"methodologyId\") VALUES(?)").run(target),
        "ProficiencyRound.analysisCode": () => db.prepare("INSERT INTO \"ProficiencyRound\" (\"analysisCode\") VALUES(?)").run(target),
        "QcEvaluation.analysisCode": () => db.prepare("INSERT INTO \"QcEvaluation\" (\"analysisCode\") VALUES(?)").run(target),
        "QcEvaluation.details": () => db.prepare("INSERT INTO \"QcEvaluation\" (\"details\") VALUES(?)").run(target),
        "QcMeasurement.analysisCode": () => db.prepare("INSERT INTO \"QcMeasurement\" (\"analysisCode\") VALUES(?)").run(target),
        "QcRule.analysisCode": () => db.prepare("INSERT INTO \"QcRule\" (\"analysisCode\") VALUES(?)").run(target),
        "QcRule.methodologyId": () => db.prepare("INSERT INTO \"QcRule\" (\"methodologyId\") VALUES(?)").run(target),
        "ReferenceValue.analysisCode": () => db.prepare("INSERT INTO \"ReferenceValue\" (\"analysisCode\") VALUES(?)").run(target),
        "ReferenceValue.methodologyId": () => db.prepare("INSERT INTO \"ReferenceValue\" (\"methodologyId\") VALUES(?)").run(target),
        "Report.content": () => db.prepare("INSERT INTO \"Report\" (\"content\") VALUES(?)").run(target),
        "ReportedValueSelection.analysisCode": () => db.prepare("INSERT INTO \"ReportedValueSelection\" (\"analysisCode\") VALUES(?)").run(target),
        "ReportedValueSelection.derivation": () => db.prepare("INSERT INTO \"ReportedValueSelection\" (\"derivation\") VALUES(?)").run(target),
        "ReportedValueSelection.evidenceSnapshot": () => db.prepare("INSERT INTO \"ReportedValueSelection\" (\"evidenceSnapshot\") VALUES(?)").run(target),
        "ReportedValueSelection.lineageSnapshot": () => db.prepare("INSERT INTO \"ReportedValueSelection\" (\"lineageSnapshot\") VALUES(?)").run(target),
        "ReportedValueSelection.methodologyId": () => db.prepare("INSERT INTO \"ReportedValueSelection\" (\"methodologyId\") VALUES(?)").run(target),
        "ReportedValueSelection.outputParams": () => db.prepare("INSERT INTO \"ReportedValueSelection\" (\"outputParams\") VALUES(?)").run(target),
        "ReportedValueSelection.qcRuleSnapshot": () => db.prepare("INSERT INTO \"ReportedValueSelection\" (\"qcRuleSnapshot\") VALUES(?)").run(target),
        "ResultCalculation.inputs": () => db.prepare("INSERT INTO \"ResultCalculation\" (\"inputs\") VALUES(?)").run(target),
        "ResultCalculation.intermediate": () => db.prepare("INSERT INTO \"ResultCalculation\" (\"intermediate\") VALUES(?)").run(target),
        "ResultCalculation.parameters": () => db.prepare("INSERT INTO \"ResultCalculation\" (\"parameters\") VALUES(?)").run(target),
        "ResultOverrideRequest.analysisCode": () => db.prepare("INSERT INTO \"ResultOverrideRequest\" (\"analysisCode\") VALUES(?)").run(target),
        "ResultOverrideRequest.methodologyId": () => db.prepare("INSERT INTO \"ResultOverrideRequest\" (\"methodologyId\") VALUES(?)").run(target),
        "SampleAmendment.impactAssessment": () => db.prepare("INSERT INTO \"SampleAmendment\" (\"impactAssessment\") VALUES(?)").run(target),
        "SampleAmendment.requestPayload": () => db.prepare("INSERT INTO \"SampleAmendment\" (\"requestPayload\") VALUES(?)").run(target),
        "WorkAttempt.evidenceData": () => db.prepare("INSERT INTO \"WorkAttempt\" (\"evidenceData\") VALUES(?)").run(target),
        "WorkAttempt.rawData": () => db.prepare("INSERT INTO \"WorkAttempt\" (\"rawData\") VALUES(?)").run(target),
        "WorkItemDraft.analysis": () => db.prepare("INSERT INTO \"WorkItemDraft\" (\"analysis\") VALUES(?)").run(target),
        "WorkItemDraft.methodologyId": () => db.prepare("INSERT INTO \"WorkItemDraft\" (\"methodologyId\") VALUES(?)").run(target)
    };
    if (!commands[table + '.' + column]) throw new Error('Unknown fixture holder');
    return commands[table + '.' + column]();
}
function clientFor(filename) { return createRootClient({ adapter: new PrismaBetterSqlite3({ url: 'file:' + filename }) }); }
async function addWorkflowUse(filename, table, column, target) {
    const client = clientFor(filename);
    try {
        const data = { id: 'sample-one', originalId: 'FICT-001', labId: 'FICT-001', assignedLab: 'lab-0', ...(table === 'Sample' ? { [column]: target } : {}) };
        await createSampleFixture(client, { data });
        if (table === 'WorkItem') await createWorkItemFixture(client, { data: { id: 'work-one', sampleId: data.id, analysis: 'HOLDER_REFERENCE', [column]: target } });
    } finally { await client.$disconnect(); }
}

// No production data, existing database path or seed is opened by these tests.
describe('issue424 reviewed manual catalogue script', () => {
    test('holder coverage follows the actual schema plus legacy aliases', () => {
        const text = fs.readFileSync(path.resolve(__dirname, '../../prisma/schema.prisma'), 'utf8');
        const expectedCodes = [], expectedMethods = [];
        for (const [, model, body] of text.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
            for (const [, field] of body.matchAll(/^\s*(\w+)\s+String\??\b/gm)) {
                if (field === 'analysisCode') expectedCodes.push([model, field]);
                if (['methodologyId', 'methodId'].includes(field)) expectedMethods.push([model, field]);
            }
        }
        for (const holder of [...expectedCodes, ['WorkItem', 'analysis'], ['WorkItemDraft', 'analysis'], ['Batch', 'analysis'], ['OrderLine', 'analysis'], ['Result', 'param']]) expect(script.CODE_HOLDERS).toContainEqual(holder);
        for (const holder of expectedMethods) expect(script.METHOD_HOLDERS).toContainEqual(holder);
        for (const holder of [['Analysis', 'prerequisites'], ['AnalysisGroup', 'analyses'], ['Sample', 'requiredAnalyses'], ['Report', 'content'], ['WorkAttempt', 'evidenceData'], ['ReportedValueSelection', 'outputParams']]) expect(script.JSON_HOLDERS).toContainEqual(holder);
    });
    test('default dry-run changes no bytes and plans exactly 13 records, retaining definitions', () => {
        const { filename } = fixture(), before = sha(filename);
        const result = script.runCatalogueCorrection({ dbPath: filename });
        expect(result).toMatchObject({ ok: true, mode: 'DRY_RUN', plannedChanges: 13, totalChanges: 0, auditRowsCreated: 0, sqliteTotalChanges: 0 });
        expect(result.records).toHaveLength(13);
        expect(result.records.every(r => r.state === 'planned')).toBe(true);
        expect(result.retainedMethodDefinitions.rows).toBe(8);
        expect(sha(filename)).toBe(before);
    });
    test('apply changes only 13 target fields, creates exactly 13 before/after audits, preserves methods and resolves ten labs', async () => {
        const { filename } = fixture();
        const methodsBefore = read(filename, db => db.prepare('SELECT * FROM Methodology ORDER BY id').all());
        const result = script.runCatalogueCorrection({ dbPath: filename, apply: true });
        expect(result).toMatchObject({ ok: true, mode: 'APPLY', totalChanges: 13, auditRowsCreated: 13, sqliteTotalChanges: 26, integrityCheck: 'ok', foreignKeyCheckRows: 0 });
        read(filename, db => {
            const methods = db.prepare('SELECT * FROM Methodology ORDER BY id').all();
            expect(methods).toEqual(methodsBefore.map(m => Object.hasOwn(script.EXTRA_DEFAULTS, m.id) ? { ...m, isDefault: 0 } : m));
            for (const code of script.RETIRE_CODES) expect(db.prepare('SELECT status FROM Analysis WHERE code=?').get(code).status).toBe('inactive');
            const audits = db.prepare('SELECT * FROM AuditLog').all();
            expect(audits).toHaveLength(13);
            for (const row of audits) {
                expect(row.performedBy).toBe('system:issue-424');
                expect(JSON.parse(row.details).issue).toBe(424);
                const before = JSON.parse(row.before), after = JSON.parse(row.after);
                expect(after).toEqual({ ...before, ...(row.entity === 'METHODOLOGY' ? { isDefault: 0 } : { status: 'inactive' }) });
            }
        });
        const methods = read(filename, db => db.prepare('SELECT * FROM Methodology').all());
        const codes = Object.values(script.EXTRA_DEFAULTS);
        for (let i = 0; i < 10; i++) {
            const labId = 'lab-' + i;
            const adapter = { methodology: { findMany: async ({ where }) => methods.filter(m => where.analysisCode.in.includes(m.analysisCode) && (!m.labId || m.labId === labId)) }, labMethodDefault: { findMany: async () => [] } };
            const selections = await resolveDefaultSelections(codes, labId, adapter);
            for (const code of codes) expect(selections.get(code)).toMatchObject({ error: null, method: { id: 'retained-' + code } });
        }
    });
    test('second apply is byte-identical, already_done for every row and creates no audits', () => {
        const { filename } = fixture();
        expect(script.runCatalogueCorrection({ dbPath: filename, apply: true }).ok).toBe(true);
        const before = sha(filename), result = script.runCatalogueCorrection({ dbPath: filename, apply: true });
        expect(result).toMatchObject({ ok: true, totalChanges: 0, auditRowsCreated: 0, sqliteTotalChanges: 0, plannedChanges: 0 });
        expect(result.records.every(r => r.state === 'already_done')).toBe(true);
        expect(sha(filename)).toBe(before);
        expect(read(filename, db => db.prepare('SELECT COUNT(*) AS n FROM AuditLog').get().n)).toBe(13);
    });
    test.each([
        ['missing method', db => db.prepare("DELETE FROM Methodology WHERE id='meth-std-4'").run(), 'METHOD_MISSING'],
        ['wrong analysis', db => db.prepare("UPDATE Methodology SET analysisCode='HOLDER_REFERENCE' WHERE id='meth-std-4'").run(), 'METHOD_ANALYSIS_MISMATCH'],
        ['local method', db => db.prepare("UPDATE Methodology SET labId='lab-0' WHERE id='meth-std-4'").run(), 'METHOD_NOT_GLOBAL'],
        ['invalid default flag', db => db.prepare("UPDATE Methodology SET isDefault=2 WHERE id='meth-std-4'").run(), 'INVALID_DEFAULT_FLAG'],
        ['one global default', db => db.prepare("UPDATE Methodology SET isDefault=0 WHERE id='retained-pH'").run(), 'UNEXPECTED_GLOBAL_DEFAULT_COUNT'],
        ['third global default', db => db.prepare("INSERT INTO Methodology(id,analysisCode,isDefault,labId) VALUES('third','pH',1,NULL)").run(), 'UNEXPECTED_GLOBAL_DEFAULT_COUNT'],
        ['missing analysis', db => { db.prepare("DELETE FROM Methodology WHERE analysisCode='carbonTotal'").run(); db.prepare("DELETE FROM Analysis WHERE code='carbonTotal'").run(); }, 'ANALYSIS_MISSING'],
        ['local analysis', db => db.prepare("UPDATE Analysis SET labId='lab-0' WHERE code='carbonTotal'").run(), 'ANALYSIS_NOT_GLOBAL'],
        ['unknown status', db => db.prepare("UPDATE Analysis SET status='unexpected' WHERE code='carbonTotal'").run(), 'UNEXPECTED_ANALYSIS_STATUS']
    ])('%s refuses before writes and preserves exact bytes', (label, mutation, code) => {
        const { filename } = fixture(); edit(filename, mutation); expectRefusal(filename, code);
    });
    test.each(script.METHOD_HOLDERS.filter(([table]) => !workflowTables.has(table)))('%s.%s method reference blocks A without partial B changes', (table, column) => {
        const { filename } = fixture(); edit(filename, db => addUse(db, table, column, 'meth-std-4')); expectRefusal(filename, 'METHOD_IN_USE');
    });
    test.each(script.CODE_HOLDERS.filter(([t, c]) => !workflowTables.has(t) && !(t === 'Methodology' && c === 'analysisCode')))('%s.%s code reference blocks B without partial A changes', (table, column) => {
        const { filename } = fixture(); edit(filename, db => addUse(db, table, column, 'carbonTotal')); expectRefusal(filename, 'ANALYSIS_IN_USE');
    });
    test.each(script.JSON_HOLDERS.filter(([table]) => !workflowTables.has(table)))('%s.%s nested code reference blocks B', (table, column) => {
        const { filename } = fixture(); edit(filename, db => addUse(db, table, column, JSON.stringify({ nested: [{ carbonTotal: 'retained reference' }] }))); expectRefusal(filename, 'ANALYSIS_IN_USE');
    });
    test.each(['ANALYSIS', 'METHODOLOGY'])('typed ExternalMapping %s references refuse', entityType => {
        const { filename } = fixture(); edit(filename, db => db.prepare('INSERT INTO ExternalMapping(entityType,entityKey) VALUES(?,?)').run(entityType, entityType === 'ANALYSIS' ? 'carbonTotal' : 'meth-std-4'));
        expectRefusal(filename, entityType === 'ANALYSIS' ? 'ANALYSIS_IN_USE' : 'METHOD_IN_USE');
    });
    test('new installed method/code holders are discovered; missing known holder refuses', () => {
        for (const [column, target, error] of [['methodologyId', 'meth-std-4', 'METHOD_IN_USE'], ['analysisCode', 'carbonTotal', 'ANALYSIS_IN_USE']]) {
            const { filename } = fixture(); edit(filename, db => { db.exec(`CREATE TABLE NewUsage(${column} TEXT)`); db.prepare(`INSERT INTO NewUsage VALUES(?)`).run(target); }); expectRefusal(filename, error);
        }
        const { filename } = fixture(); edit(filename, db => db.exec('DROP TABLE WorkItemDraft')); expectRefusal(filename, 'MISSING_USAGE_HOLDER');
    });
    test('malformed code arrays fail closed, while unencoded legacy assessment prose is explicit', () => {
        let { filename } = fixture(); edit(filename, db => addUse(db, 'AnalysisGroup', 'analyses', '{broken')); expectRefusal(filename, 'UNREADABLE_USAGE_HOLDER');
        ({ filename } = fixture()); edit(filename, db => addUse(db, 'SampleAmendment', 'impactAssessment', 'Fictional legacy narrative with no parameter link'));
        expect(script.runCatalogueCorrection({ dbPath: filename })).toMatchObject({ ok: true, plainTextAssessmentRows: { 'SampleAmendment.impactAssessment': 1 } });
        edit(filename, db => addUse(db, 'SampleAmendment', 'impactAssessment', 'Fictional carbonTotal reference')); expectRefusal(filename, 'ANALYSIS_IN_USE');
    });
    test('a mid-transaction failure rolls back all target changes and audits', () => {
        const { filename } = fixture(); edit(filename, db => db.exec("CREATE TRIGGER fixture_failure BEFORE UPDATE OF status ON Analysis WHEN OLD.code='carbonTotal' BEGIN SELECT RAISE(ABORT,'fixture refusal'); END"));
        expectRefusal(filename, 'SQLITE_CONSTRAINT_TRIGGER');
    });
    test('WAL-backed dry-run and failed apply preserve both copied database and WAL bytes', () => {
        const { filename } = fixture();
        const writer = new Database(filename); writer.pragma('journal_mode=WAL'); writer.pragma('wal_autocheckpoint=0'); writer.exec("UPDATE Analysis SET status='unexpected' WHERE code='carbonTotal'");
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'issue424-owned-wal-copy-')); roots.push(root); const copy = path.join(root, 'fixture.db');
        for (const suffix of ['', '-wal', '-shm']) fs.copyFileSync(filename + suffix, copy + suffix);
        writer.close();
        const before = [sha(copy), sha(copy + '-wal')];
        expect(script.runCatalogueCorrection({ dbPath: copy }).ok).toBe(false);
        expect(script.runCatalogueCorrection({ dbPath: copy, apply: true }).ok).toBe(false);
        expect([sha(copy), sha(copy + '-wal')]).toEqual(before);
    });
    test('list-only C reports package partners and pSA order identity without writes', async () => {
        const { filename } = fixture(); edit(filename, db => {
            db.prepare('INSERT INTO AnalysisGroup(id,name,labId,analyses) VALUES(?,?,?,?)').run('pack-one', 'Fictional package', null, JSON.stringify(['pH', 'PH_H2O', 'pSA']));
            db.prepare('INSERT INTO SampleOrderRevision(id,sampleId) VALUES(?,?)').run('revision-one', 'sample-one');
            db.prepare('INSERT INTO OrderLine(id,analysis,status,revisionId) VALUES(?,?,?,?)').run('line-one', 'pSA', 'ACTIVE', 'revision-one');
        });
        await addWorkflowUse(filename, 'Sample', 'requiredAnalyses', '[]');
        const before = sha(filename), result = script.runCatalogueCorrection({ dbPath: filename, listOnly: true });
        expect(result).toMatchObject({ ok: true, mode: 'LIST_PACKAGES', totalChanges: 0, auditRowsCreated: 0, sqliteTotalChanges: 0 });
        expect(result.packages[0]).toMatchObject({ name: 'Fictional package', scope: 'GLOBAL', legacy: [{ code: 'pH', partnersAlreadyInPackage: ['PH_H2O'] }, { code: 'pSA', partnersAlreadyInPackage: [] }] });
        expect(result.pSAOrderLines).toEqual([{ id: 'line-one', status: 'ACTIVE', revisionId: 'revision-one', sampleId: 'sample-one', sampleLabNumber: 'FICT-001', assignedLab: 'lab-0' }]);
        expect(sha(filename)).toBe(before);
    });

    test.each([
        ...script.CODE_HOLDERS.filter(([table]) => workflowTables.has(table)).map(([table, column]) => [table, column, 'carbonTotal', 'ANALYSIS_IN_USE']),
        ...script.METHOD_HOLDERS.filter(([table]) => workflowTables.has(table)).map(([table, column]) => [table, column, 'meth-std-4', 'METHOD_IN_USE']),
        ...script.JSON_HOLDERS.filter(([table]) => workflowTables.has(table)).map(([table, column]) => [table, column, JSON.stringify({ nested: [{ carbonTotal: 'retained reference' }] }), 'ANALYSIS_IN_USE'])
    ])('%s.%s use through the central positive fixture authority still blocks changes', async (table, column, target, code) => {
        const { filename } = fixture();
        await addWorkflowUse(filename, table, column, target);
        expectRefusal(filename, code);
    });
    test('all 13 audit rows round-trip through the app Prisma reader with valid dates and before/after JSON', async () => {
        const { filename } = fixture();
        const result = script.runCatalogueCorrection({ dbPath: filename, apply: true });
        expect(result.ok).toBe(true);
        const client = clientFor(filename);
        try {
            const rows = await client.auditLog.findMany({ where: { performedBy: 'system:issue-424' }, select: { timestamp: true, before: true, after: true } });
            expect(rows).toHaveLength(13);
            for (const row of rows) { expect(row.timestamp).toBeInstanceOf(Date); expect(Number.isFinite(row.timestamp.getTime())).toBe(true);
                expect(JSON.parse(row.before)).toBeTruthy(); expect(JSON.parse(row.after)).toBeTruthy(); }
        } finally { await client.$disconnect(); }
    });
    test.each(['DELETE', 'WAL'])('%s journal: read-only dry-run and Step C accept BEGIN IMMEDIATE without writes', mode => {
        const { filename } = fixture();
        edit(filename, db => { expect(db.pragma('journal_mode=' + mode, { simple: true }).toUpperCase()).toBe(mode); });
        const before = sha(filename);
        expect(script.runCatalogueCorrection({ dbPath: filename })).toMatchObject({ ok: true, totalChanges: 0 });
        expect(script.runCatalogueCorrection({ dbPath: filename, listOnly: true })).toMatchObject({ ok: true, totalChanges: 0 });
        expect(sha(filename)).toBe(before);
    });

    test('CLI requires an explicit file and valid flags, ignores database environment defaults', () => {
        const { filename } = fixture(), before = sha(filename), cli = path.resolve(__dirname, '../../scripts/fix_424_legacy_catalogue.js');
        for (const args of [[], ['--apply'], ['--force'], ['--db', filename, '--list-packages', '--apply']]) {
            const child = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', env: { ...process.env, DATABASE_PATH: filename, DATABASE_URL: 'file:' + filename } });
            expect(child.status).toBe(1); expect(JSON.parse(child.stdout)).toMatchObject({ ok: false, totalChanges: 0 }); expect(sha(filename)).toBe(before);
        }
        const child = spawnSync(process.execPath, [cli, '--db', filename], { encoding: 'utf8' });
        expect(child.status).toBe(0); expect(JSON.parse(child.stdout)).toMatchObject({ ok: true, mode: 'DRY_RUN', plannedChanges: 13 }); expect(sha(filename)).toBe(before);
    });
});
