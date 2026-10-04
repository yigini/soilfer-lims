const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');
const { listDuplicates, readGroup, resolveGroup, argumentsFor } = require('../../scripts/workitem_duplicates');

const markerSql = fs.readFileSync(path.join(__dirname, '../../prisma/migrations/20261004190000_add_workitem_duplicate_marker/migration.sql'), 'utf8');
const indexSql = fs.readFileSync(path.join(__dirname, '../../prisma/migrations/20261004190100_unique_active_workitem/migration.sql'), 'utf8');
const schema = `CREATE TABLE WorkItem (id TEXT PRIMARY KEY, sampleId TEXT, analysis TEXT, status TEXT, result TEXT, submissionId TEXT, batchId TEXT, createdAt TEXT, history TEXT);
CREATE TABLE Result (id TEXT PRIMARY KEY, sampleId TEXT, param TEXT);
CREATE TABLE SpectralData (id TEXT PRIMARY KEY, workItemId TEXT REFERENCES WorkItem(id));
CREATE TABLE AuditLog (id TEXT PRIMARY KEY, entity TEXT, entityId TEXT, action TEXT, details TEXT, performedBy TEXT, timestamp TEXT, sampleId TEXT, analysisCode TEXT, before TEXT, after TEXT);`;
function seed(db) {
    db.exec(schema);
    db.prepare('INSERT INTO WorkItem VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('keep', 'sample', 'PH', 'ACCEPTED', '0', 'submission', 'batch', '2026-10-01', '["reviewed"]');
    db.prepare('INSERT INTO WorkItem VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('duplicate', 'sample', 'PH', 'COMPLETED', '7.2', 'otherSubmission', 'otherBatch', '2026-10-02', '["measured"]');
    db.exec("INSERT INTO Result VALUES ('result', 'sample', 'PH'); INSERT INTO SpectralData VALUES ('scan', 'duplicate');");
}


describe('Audit 1.1: additive, audited duplicate resolution', () => {
    let db;
    const request = overrides => ({ sampleId: 'sample', analysis: 'PH', keep: 'keep', reason: 'Manager reviewed both measurements', actor: 'manager', fingerprint: readGroup(db, 'sample', 'PH').fingerprint, ...overrides });
    beforeEach(() => { db = new Database(':memory:'); seed(db); db.exec(markerSql); db.pragma('foreign_keys = ON'); });
    afterEach(() => db.close());
    test('lists every active group with result, submission and batch links, and never chooses a kept item', () => {
        const before = db.prepare('SELECT * FROM WorkItem ORDER BY id').all();
        const report = listDuplicates(db);
        expect(report.groupCount).toBe(1);
        expect(report.groups[0].rows).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'keep', status: 'ACCEPTED', submissionId: 'submission', batchId: 'batch', resultIds: ['result'], flags: ['HAS_RESULTS'] }),
            expect.objectContaining({ id: 'duplicate', spectralIds: ['scan'], flags: ['HAS_RESULTS'] })
        ]));
        expect(db.prepare('SELECT * FROM WorkItem ORDER BY id').all()).toEqual(before);
        expect(db.prepare('SELECT COUNT(*) n FROM AuditLog').get().n).toBe(0);
    });
    test('explicitly flags even completed rows, preserves every old byte and link, and audits each changed row', () => {
        const old = db.prepare('SELECT * FROM WorkItem ORDER BY id').all();
        const results = db.prepare('SELECT * FROM Result').all(), scans = db.prepare('SELECT * FROM SpectralData').all();
        expect(resolveGroup(db, request())).toMatchObject({ keptId: 'keep', changedCount: 1, changedIds: ['duplicate'] });
        const rows = db.prepare('SELECT * FROM WorkItem ORDER BY id').all();
        expect(rows.map(row => ({ ...row, duplicateOf: null }))).toEqual(old);
        expect(rows.find(row => row.id === 'duplicate').duplicateOf).toBe('keep');
        expect(db.prepare('SELECT * FROM Result').all()).toEqual(results);
        expect(db.prepare('SELECT * FROM SpectralData').all()).toEqual(scans);
        expect(listDuplicates(db).groupCount).toBe(0);
        const audits = db.prepare('SELECT * FROM AuditLog').all();
        expect(audits).toHaveLength(1);
        expect(audits[0]).toMatchObject({ entityId: 'duplicate', action: 'WORKITEM_DUPLICATE_RESOLVED', performedBy: 'manager', before: '{"duplicateOf":null}', after: '{"duplicateOf":"keep"}' });
        expect(JSON.parse(audits[0].details)).toMatchObject({ reason: request().reason, flags: ['HAS_RESULTS'] });
        db.exec(indexSql);
        expect(() => db.prepare('INSERT INTO WorkItem (id, sampleId, analysis) VALUES (?, ?, ?)').run('third', 'sample', 'PH')).toThrow(/UNIQUE/);
        expect(() => db.prepare('DELETE FROM WorkItem WHERE id = ?').run('keep')).toThrow(/FOREIGN KEY/);
    });
    test.each([
        [{ keep: 'unrelated' }, 'WORKITEM_DUPLICATE_KEEP_INVALID'],
        [{ reason: '   ' }, 'WORKITEM_DUPLICATE_REASON_REQUIRED'],
        [{ actor: '' }, 'WORKITEM_DUPLICATE_ACTOR_REQUIRED'],
        [{ fingerprint: undefined }, 'WORKITEM_DUPLICATE_FINGERPRINT_REQUIRED'],
        [{ fingerprint: 'invented' }, 'WORKITEM_DUPLICATE_FINGERPRINT_REQUIRED']
    ])('refuses unsafe resolution %p without any writes', (overrides, code) => {
        expect(() => resolveGroup(db, request(overrides))).toThrow(expect.objectContaining({ code }));
        expect(listDuplicates(db).groupCount).toBe(1);
        expect(db.prepare('SELECT COUNT(*) n FROM AuditLog').get().n).toBe(0);
    });
    test('a group changed after reading is refused, including result or submission changes', () => {
        const reviewedRequest = request();
        db.exec("UPDATE WorkItem SET submissionId = 'changed' WHERE id = 'duplicate';");
        expect(() => resolveGroup(db, reviewedRequest)).toThrow(expect.objectContaining({ code: 'WORKITEM_DUPLICATE_GROUP_CHANGED' }));
        expect(db.prepare('SELECT COUNT(*) n FROM AuditLog').get().n).toBe(0);
        expect(listDuplicates(db).groupCount).toBe(1);
    });
    test('audit failure rolls back all marker writes', () => {
        db.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON AuditLog BEGIN SELECT RAISE(ABORT, 'synthetic audit failure'); END;");
        expect(() => resolveGroup(db, request())).toThrow('synthetic audit failure');
        expect(listDuplicates(db).groupCount).toBe(1);
        expect(db.prepare('SELECT COUNT(*) n FROM WorkItem WHERE duplicateOf IS NOT NULL').get().n).toBe(0);
    });
    test.each(['Result', 'SpectralData'])('a changed %s value is refused even when its link and id are unchanged', table => {
        db.exec(`ALTER TABLE ${table} ADD COLUMN retainedEvidence TEXT;`);
        const reviewedRequest = request();
        db.prepare(`UPDATE ${table} SET retainedEvidence = ?`).run('new measurement evidence');
        expect(() => resolveGroup(db, reviewedRequest)).toThrow(expect.objectContaining({ code: 'WORKITEM_DUPLICATE_GROUP_CHANGED' }));
        expect(db.prepare('SELECT COUNT(*) n FROM AuditLog').get().n).toBe(0);
        expect(listDuplicates(db).groupCount).toBe(1);
    });
    test('index migration fails atomically on unresolved groups, and never removes old rows', () => {
        const old = db.prepare('SELECT * FROM WorkItem ORDER BY id').all();
        expect(() => db.transaction(() => db.exec(indexSql))()).toThrow(/UNIQUE/);
        expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'WorkItem_one_active_per_analysis'").get()).toBeUndefined();
        expect(db.prepare('SELECT * FROM WorkItem ORDER BY id').all()).toEqual(old);
    });
    test('CLI default uses a read-only connection before the marker migration and leaves file bytes unchanged', () => {
        const file = path.join(os.tmpdir(), `audit11-dupes-${crypto.randomUUID()}.db`);
        const raw = new Database(file); seed(raw); raw.close();
        try {
            const before = fs.readFileSync(file);
            const stdout = execFileSync(process.execPath, [path.join(__dirname, '../../scripts/workitem_duplicates.js'), '--database', file], { encoding: 'utf8' });
            expect(JSON.parse(stdout)).toMatchObject({ mode: 'dry-run', groupCount: 1 });
            expect(fs.readFileSync(file)).toEqual(before);
        } finally { fs.unlinkSync(file); }
    });

    test.each(['added', 'changed'])('real CLI refuses a group %s after the manager reviewed its dry-run', change => {
        const file = path.join(os.tmpdir(), `audit11-reviewed-dupes-${crypto.randomUUID()}.db`);
        const script = path.join(__dirname, '../../scripts/workitem_duplicates.js');
        const raw = new Database(file); seed(raw); raw.exec(markerSql); raw.close();
        try {
            const report = JSON.parse(execFileSync(process.execPath, [script, '--database', file], { encoding: 'utf8' }));
            const reviewed = report.groups[0].fingerprint;
            const changed = new Database(file);
            if (change === 'added') changed.exec("INSERT INTO WorkItem (id,sampleId,analysis,status) VALUES ('third','sample','PH','NOT_ASSIGNED');");
            else changed.exec("UPDATE WorkItem SET submissionId='manager-did-not-review' WHERE id='duplicate';");
            const before = changed.prepare('SELECT * FROM WorkItem ORDER BY id').all(); changed.close();
            const result = spawnSync(process.execPath, [script, '--database', file, '--resolve', '--sample', 'sample', '--analysis', 'PH', '--keep', 'keep', '--reason', 'Reviewed earlier', '--actor', 'manager', '--fingerprint', reviewed], { encoding: 'utf8' });
            expect(result.status).toBe(1);
            expect(JSON.parse(result.stderr)).toMatchObject({ code: 'WORKITEM_DUPLICATE_GROUP_CHANGED' });
            const after = new Database(file, { readonly: true });
            expect(after.prepare('SELECT * FROM WorkItem ORDER BY id').all()).toEqual(before);
            expect(after.prepare('SELECT count(*) n FROM AuditLog').get().n).toBe(0); after.close();
        } finally { fs.unlinkSync(file); }
    });
    test('CLI resolution requires the reviewed fingerprint before opening a database', () => {
        expect(() => argumentsFor(['--database', 'copy.db', '--resolve', '--sample', 'sample', '--analysis', 'PH', '--keep', 'keep', '--reason', 'Reviewed', '--actor', 'manager']))
            .toThrow(expect.objectContaining({ code: 'WORKITEM_DUPLICATE_FINGERPRINT_REQUIRED' }));
    });
    test('argument validation never turns a dry-run into a write or accepts ambiguous flags', () => {
        expect(argumentsFor(['--database', 'copy.db'])).toEqual({ '--database': 'copy.db' });
        expect(() => argumentsFor(['--database', 'copy.db', '--resolve', '--dry-run'])).toThrow();
        expect(() => argumentsFor(['--database', 'copy.db', '--keep', 'arbitrary'])).toThrow();
        expect(() => argumentsFor(['--database', 'copy.db', '--database', 'other.db'])).toThrow();
    });
});
