const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { PrismaClient } = require('../../prisma_client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { rejectedGuardWrite } = require('../helpers/rejectedGuardWrite');
const { createWorkItemFixture } = require('../helpers/workflowFixtures');
const { listDuplicates, readGroup, resolveGroup, argumentsFor } = require('../../scripts/workitem_duplicates');

function createRehearsal(options = {}) {
    const now = Date.UTC(2026, 9, 1);
    return beforeGuards({ actor: 'system:fixture', schemaVariant: 'PRE_1_1_DUPLICATES', ...options,
        samples: [{ id: 'sample', originalId: 'sample', status: 'PROCESSING', createdAt: now, updatedAt: now }],
        batches: ['batch', 'otherBatch'].map(id => ({ id, analysis: 'PH', status: 'OPEN', createdBy: 'manager' })),
        workItems: [
            { id: 'keep', sampleId: 'sample', analysis: 'PH', status: 'ACCEPTED', result: '0', submissionId: 'submission', batchId: 'batch', createdAt: '2026-10-01', updatedAt: now, history: '["reviewed"]' },
            { id: 'duplicate', sampleId: 'sample', analysis: 'PH', status: 'COMPLETED', result: '7.2', submissionId: 'otherSubmission', batchId: 'otherBatch', createdAt: '2026-10-02', updatedAt: now, history: '["measured"]' }
        ], relatedRows: {
            User: [{ id: 'manager', username: 'manager', password: 'fixture', email: 'manager@example.test', role: 'MANAGER', updatedAt: now }],
            Submission: ['submission', 'otherSubmission', 'changed', 'manager-did-not-review'].map(id => ({ id, sampleId: 'sample', type: 'FULL', status: 'PENDING', submittedBy: 'manager', updatedAt: now })),
            Result: [{ id: 'result', sampleId: 'sample', param: 'PH', value: '0', updatedAt: now }],
            SpectralData: [{ id: 'scan', workItemId: 'duplicate', modality: 'MIR', filename: 'legacy.scan' }]
        }
    });
}

function discardRehearsal(rehearsal) {
    try {
        if (rehearsal.pendingMigrations.includes('INDEX')) {
            expect(() => rehearsal.applyPendingMigration({ expectedFailure: 'SQLITE_CONSTRAINT_UNIQUE' })).toThrow(/UNIQUE/);
        }
    } finally { rehearsal.close(); }
}

describe('Audit 1.1: additive, audited duplicate resolution', () => {
    let db, rehearsal;
    const request = overrides => ({ sampleId: 'sample', analysis: 'PH', keep: 'keep', reason: 'Manager reviewed both measurements', actor: 'manager', fingerprint: readGroup(db, 'sample', 'PH').fingerprint, ...overrides });
    beforeEach(() => { rehearsal = createRehearsal(); db = new Database(rehearsal.file); db.pragma('foreign_keys = ON'); });
    afterEach(() => { db?.close(); if (rehearsal) discardRehearsal(rehearsal); });
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
        rehearsal.applyPendingMigration({ connection: db });
        rejectedGuardWrite({ actor: 'system:fixture', file: rehearsal.file,
            statement: 'INSERT INTO WorkItem (id,sampleId,analysis,status,updatedAt) VALUES (?,?,?,?,?)',
            parameters: ['third', 'sample', 'PH', 'NOT_ASSIGNED', Date.now()],
            expectedGuardCode: 'SQLITE_CONSTRAINT_UNIQUE', expectedConstraint: 'WorkItem_one_active_per_analysis' });
        rejectedGuardWrite({ actor: 'system:fixture', file: rehearsal.file,
            statement: 'DELETE FROM WorkItem WHERE id = ?', parameters: ['keep'],
            expectedGuardCode: 'SQLITE_CONSTRAINT_TRIGGER', expectedConstraint: 'WorkItem_duplicateOf_restrict' });
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
        if (table === 'Result') db.exec('ALTER TABLE Result ADD COLUMN retainedEvidence TEXT');
        else db.exec('ALTER TABLE SpectralData ADD COLUMN retainedEvidence TEXT');
        const reviewedRequest = request();
        if (table === 'Result') db.prepare('UPDATE Result SET retainedEvidence = ?').run('new measurement evidence');
        else db.prepare('UPDATE SpectralData SET retainedEvidence = ?').run('new measurement evidence');
        expect(() => resolveGroup(db, reviewedRequest)).toThrow(expect.objectContaining({ code: 'WORKITEM_DUPLICATE_GROUP_CHANGED' }));
        expect(db.prepare('SELECT COUNT(*) n FROM AuditLog').get().n).toBe(0);
        expect(listDuplicates(db).groupCount).toBe(1);
    });
    test('index migration fails atomically on unresolved groups, and never removes old rows', () => {
        const old = db.prepare('SELECT * FROM WorkItem ORDER BY id').all();
        expect(() => rehearsal.applyPendingMigration({ connection: db, expectedFailure: 'SQLITE_CONSTRAINT_UNIQUE' })).toThrow(/UNIQUE/);
        expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'WorkItem_one_active_per_analysis'").get()).toBeUndefined();
        expect(db.prepare('SELECT * FROM WorkItem ORDER BY id').all()).toEqual(old);
        expect(() => rehearsal.applyPendingMigration()).toThrow('unusable');
    });
    test('CLI default uses a read-only connection before the marker migration and leaves file bytes unchanged', () => {
        const snapshotRehearsal = createRehearsal({ preMigrationSnapshot: true });
        const file = snapshotRehearsal.preMigrationSnapshot.path;
        try {
            const before = fs.readFileSync(file);
            const stdout = execFileSync(process.execPath, [path.join(__dirname, '../../scripts/workitem_duplicates.js'), '--database', file], { encoding: 'utf8' });
            expect(JSON.parse(stdout)).toMatchObject({ mode: 'dry-run', groupCount: 1 });
            expect(fs.readFileSync(file)).toEqual(before);
        } finally { discardRehearsal(snapshotRehearsal); }
    });

    test.each(['added', 'changed'])('real CLI refuses a group %s after the manager reviewed its dry-run', async change => {
        const cliRehearsal = createRehearsal(), file = cliRehearsal.file;
        const script = path.join(__dirname, '../../scripts/workitem_duplicates.js');
        try {
            const report = JSON.parse(execFileSync(process.execPath, [script, '--database', file], { encoding: 'utf8' }));
            const reviewed = report.groups[0].fingerprint;
            const changed = new Database(file); changed.pragma('foreign_keys = ON');
            if (change === 'added') {
                // Generated Prisma reads the current nullable columns; install
                // the real additive hold DDL before using that current client.
                changed.exec('CREATE TABLE IF NOT EXISTS "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL, "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "details" TEXT)');
                require('../../scripts/install_sample_holds').installSampleHolds({ dbPath: file, apply: true });
                const client = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${file}` }) });
                try { await createWorkItemFixture(client, { data: { id: 'third', sampleId: 'sample', analysis: 'PH', status: 'NOT_ASSIGNED' } }); }
                finally { await client.$disconnect(); }
            }
            else changed.exec("UPDATE WorkItem SET submissionId='manager-did-not-review' WHERE id='duplicate';");
            const before = changed.prepare('SELECT * FROM WorkItem ORDER BY id').all();
            const audits = changed.prepare('SELECT * FROM AuditLog ORDER BY id').all(); changed.close();
            const result = spawnSync(process.execPath, [script, '--database', file, '--resolve', '--sample', 'sample', '--analysis', 'PH', '--keep', 'keep', '--reason', 'Reviewed earlier', '--actor', 'manager', '--fingerprint', reviewed], { encoding: 'utf8' });
            expect(result.status).toBe(1);
            expect(JSON.parse(result.stderr)).toMatchObject({ code: 'WORKITEM_DUPLICATE_GROUP_CHANGED' });
            const after = new Database(file, { readonly: true });
            expect(after.prepare('SELECT * FROM WorkItem ORDER BY id').all()).toEqual(before);
            expect(after.prepare('SELECT * FROM AuditLog ORDER BY id').all()).toEqual(audits);
            expect(after.prepare("SELECT count(*) n FROM AuditLog WHERE action='WORKITEM_DUPLICATE_RESOLVED'").get().n).toBe(0); after.close();
        } finally { discardRehearsal(cliRehearsal); }
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
