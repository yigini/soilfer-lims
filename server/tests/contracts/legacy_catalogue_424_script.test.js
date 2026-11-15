const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const Database = require('better-sqlite3');
const script = require('../../scripts/fix_424_legacy_catalogue');
const { resolveDefaultSelections } = require('../../services/methodResolution');

const sha = filename => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const roots = [];
const sqlName = name => '"' + name.replace(/"/g, '""') + '"';
function fixture({ wal = false } = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'issue424-owned-fictional-'));
    roots.push(root);
    const filename = path.join(root, 'fixture.db');
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
        if (t === 'Analysis') db.exec('CREATE TABLE Analysis(id TEXT,code TEXT PRIMARY KEY,name TEXT,units TEXT,status TEXT,labId TEXT,prerequisites TEXT)');
        else if (t === 'Methodology') db.exec('CREATE TABLE Methodology(id TEXT PRIMARY KEY,analysisCode TEXT REFERENCES Analysis(code),name TEXT,standard TEXT,referenceId TEXT,labId TEXT,isDefault INTEGER,createdAt TEXT,updatedAt TEXT)');
        else db.exec(`CREATE TABLE ${sqlName(t)} (${[...cols].map(c => sqlName(c) + ' TEXT').join(',')})`);
    }
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
    const result = script.execute({ dbPath: filename, apply: true });
    expect(result.ok).toBe(false);
    expect([result.error?.code, ...(result.failures || []).map(f => f.code), ...(result.error?.failures || []).map(f => f.code)]).toContain(code);
    expect(result.totalChanges).toBe(0);
    expect(result.auditRowsCreated).toBe(0);
    expect(sha(filename)).toBe(before);
    expect(read(filename, db => db.prepare('SELECT COUNT(*) AS n FROM AuditLog WHERE performedBy=?').get('system:issue-424').n)).toBe(0);
    return result;
}
function addUse(db, table, column, target) {
    if (table === 'Analysis') db.prepare(`UPDATE Analysis SET ${sqlName(column)}=? WHERE code='HOLDER_REFERENCE'`).run(target);
    else if (table === 'AuditLog') db.prepare(`INSERT INTO AuditLog(id,entity,${sqlName(column)}) VALUES('use','ANALYSIS',?)`).run(target);
    else db.prepare(`INSERT INTO ${sqlName(table)} (${sqlName(column)}) VALUES(?)`).run(target);
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
        const result = script.execute({ dbPath: filename });
        expect(result).toMatchObject({ ok: true, mode: 'DRY_RUN', plannedChanges: 13, totalChanges: 0, auditRowsCreated: 0, sqliteTotalChanges: 0 });
        expect(result.records).toHaveLength(13);
        expect(result.records.every(r => r.state === 'planned')).toBe(true);
        expect(result.retainedMethodDefinitions.rows).toBe(8);
        expect(sha(filename)).toBe(before);
    });
    test('apply changes only 13 target fields, creates exactly 13 before/after audits, preserves methods and resolves ten labs', async () => {
        const { filename } = fixture();
        const methodsBefore = read(filename, db => db.prepare('SELECT * FROM Methodology ORDER BY id').all());
        const result = script.execute({ dbPath: filename, apply: true });
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
        expect(script.execute({ dbPath: filename, apply: true }).ok).toBe(true);
        const before = sha(filename), result = script.execute({ dbPath: filename, apply: true });
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
    test.each(script.METHOD_HOLDERS)('%s.%s method reference blocks A without partial B changes', (table, column) => {
        const { filename } = fixture(); edit(filename, db => addUse(db, table, column, 'meth-std-4')); expectRefusal(filename, 'METHOD_IN_USE');
    });
    test.each(script.CODE_HOLDERS.filter(([t, c]) => !(t === 'Methodology' && c === 'analysisCode')))('%s.%s code reference blocks B without partial A changes', (table, column) => {
        const { filename } = fixture(); edit(filename, db => addUse(db, table, column, 'carbonTotal')); expectRefusal(filename, 'ANALYSIS_IN_USE');
    });
    test.each(script.JSON_HOLDERS)('%s.%s nested code reference blocks B', (table, column) => {
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
        expect(script.execute({ dbPath: filename })).toMatchObject({ ok: true, plainTextAssessmentRows: { 'SampleAmendment.impactAssessment': 1 } });
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
        expect(script.execute({ dbPath: copy }).ok).toBe(false);
        expect(script.execute({ dbPath: copy, apply: true }).ok).toBe(false);
        expect([sha(copy), sha(copy + '-wal')]).toEqual(before);
    });
    test('list-only C reports package partners and pSA order identity without writes', () => {
        const { filename } = fixture(); edit(filename, db => {
            db.prepare('INSERT INTO AnalysisGroup(id,name,labId,analyses) VALUES(?,?,?,?)').run('pack-one', 'Fictional package', null, JSON.stringify(['pH', 'PH_H2O', 'pSA']));
            db.prepare('INSERT INTO Sample(id,labId,assignedLab) VALUES(?,?,?)').run('sample-one', 'FICT-001', 'lab-0');
            db.prepare('INSERT INTO SampleOrderRevision(id,sampleId) VALUES(?,?)').run('revision-one', 'sample-one');
            db.prepare('INSERT INTO OrderLine(id,analysis,status,revisionId) VALUES(?,?,?,?)').run('line-one', 'pSA', 'ACTIVE', 'revision-one');
        });
        const before = sha(filename), result = script.execute({ dbPath: filename, listOnly: true });
        expect(result).toMatchObject({ ok: true, mode: 'LIST_PACKAGES', totalChanges: 0, auditRowsCreated: 0, sqliteTotalChanges: 0 });
        expect(result.packages[0]).toMatchObject({ name: 'Fictional package', scope: 'GLOBAL', legacy: [{ code: 'pH', partnersAlreadyInPackage: ['PH_H2O'] }, { code: 'pSA', partnersAlreadyInPackage: [] }] });
        expect(result.pSAOrderLines).toEqual([{ id: 'line-one', status: 'ACTIVE', revisionId: 'revision-one', sampleId: 'sample-one', sampleLabNumber: 'FICT-001', assignedLab: 'lab-0' }]);
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
