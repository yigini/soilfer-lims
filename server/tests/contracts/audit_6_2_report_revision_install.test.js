const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { createHash, randomUUID } = require('node:crypto');
const Database = require('better-sqlite3');
const { installReportRevisions, assertReportRevisionStartupReady, parseArguments } = require('../../scripts/install_report_revisions');

const COLUMNS = ['supersedesReportId', 'amendmentId', 'amendmentReason', 'issuedBy', 'approvedBy', 'amendmentAuthorizedBy'];
const GUARDS = ['Report_amendmentId_key', 'Report_revision_evidence_immutable', 'Report_revision_amendment_guard'];
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-211-install-'));
afterAll(() => fs.rmSync(directory, { recursive: true, force: true }));

// Starts from the fully installed test template and removes only #211 objects,
// giving the exact fresh-Prisma and pre-#211 shapes the installer must accept.
async function database(shape) {
    const file = path.join(directory, randomUUID() + '.db'), source = new Database(process.env.DATABASE_PATH, { readonly: true });
    try { await source.backup(file); } finally { source.close(); }
    const db = new Database(file);
    try {
        db.prepare('INSERT INTO "Report"(id,sampleId,version,status,content,generatedBy,reportNumberBase,revision,updatedAt) VALUES(?,?,?,?,?,?,?,?,?)')
            .run('historical-' + randomUUID(), 'historical-sample', 1, 'PUBLISHED', '{"resultGroups":[]}', 'historical-issuer', null, null, Date.now());
        if (shape !== 'COMPLETE') {
            for (const name of GUARDS) db.exec(`DROP ${name.endsWith('_key') ? 'INDEX' : 'TRIGGER'} "${name}"`);
            db.prepare('DELETE FROM _schema_migrations WHERE id=?').run('211_report_revisions');
        }
        if (shape === 'PRE') for (const column of COLUMNS) db.exec(`ALTER TABLE "Report" DROP COLUMN "${column}"`);
    } finally { db.close(); }
    return file;
}
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const rows = file => { const db = new Database(file, { readonly: true }); try { return db.prepare('SELECT id,sampleId,status,content FROM "Report" ORDER BY id').all(); } finally { db.close(); } };

test.each(['PRE', 'FRESH'])('%s databases dry-run without writes, then apply additively with a verified receipt', async shape => {
    const file = await database(shape), before = digest(file), retained = rows(file);
    const dry = installReportRevisions({ dbPath: file });
    expect(dry).toMatchObject({ classification: shape === 'PRE' ? 'PRE_211' : 'FRESH_PRISMA_211', mode: 'DRY_RUN', totalChanges: 0, backfilledCount: 0 });
    expect(digest(file)).toBe(before);
    expect(() => assertReportRevisionStartupReady(file)).toThrow(expect.objectContaining({ code: 'REPORT_REVISION_STARTUP_REQUIRED' }));
    const applied = installReportRevisions({ dbPath: file, apply: true });
    expect(applied).toMatchObject({ classification: 'COMPLETE_211', previousClassification: dry.classification, mode: 'APPLIED', backfilledCount: 0,
        receipt: { originalRowsPreserved: true, backfilledCount: 0 } });
    expect(rows(file)).toEqual(retained);
    const db = new Database(file, { readonly: true });
    try {
        expect(db.prepare('SELECT count(*) n FROM "Report" WHERE ' + COLUMNS.map(name => `"${name}" IS NOT NULL`).join(' OR ')).get().n).toBe(0);
        for (const name of GUARDS) expect(db.prepare('SELECT name FROM sqlite_master WHERE name=?').get(name)).toBeTruthy();
    } finally { db.close(); }
    const settled = digest(file);
    expect(installReportRevisions({ dbPath: file, apply: true })).toMatchObject({ classification: 'COMPLETE_211', mode: 'NO_OP', totalChanges: 0 });
    expect(digest(file)).toBe(settled);
    expect(assertReportRevisionStartupReady(file).classification).toBe('COMPLETE_211');
});

test('unmarked populated evidence, partial installs and altered guards refuse with zero writes', async () => {
    const populated = await database('FRESH');
    let db = new Database(populated);
    try { db.prepare('UPDATE "Report" SET "issuedBy"=? WHERE sampleId=?').run('unreviewed', 'historical-sample'); } finally { db.close(); }
    let before = digest(populated);
    expect(() => installReportRevisions({ dbPath: populated, apply: true })).toThrow(expect.objectContaining({ code: 'REPORT_REVISION_SCHEMA_MISMATCH' }));
    expect(digest(populated)).toBe(before);

    const partial = await database('FRESH');
    db = new Database(partial);
    try { db.exec('CREATE UNIQUE INDEX "Report_amendmentId_key" ON "Report"("amendmentId") WHERE "amendmentId" IS NOT NULL'); } finally { db.close(); }
    before = digest(partial);
    expect(() => installReportRevisions({ dbPath: partial, apply: true })).toThrow(expect.objectContaining({ code: 'REPORT_REVISION_SCHEMA_MISMATCH' }));
    expect(digest(partial)).toBe(before);

    const altered = await database('COMPLETE');
    db = new Database(altered);
    try { db.exec('DROP TRIGGER "Report_revision_evidence_immutable"; CREATE TRIGGER "Report_revision_evidence_immutable" BEFORE UPDATE ON "Report" BEGIN SELECT 1; END;'); } finally { db.close(); }
    before = digest(altered);
    expect(() => installReportRevisions({ dbPath: altered, apply: true })).toThrow(expect.objectContaining({ code: 'REPORT_REVISION_SCHEMA_MISMATCH',
        differences: ['Report_revision_evidence_immutable differs'] }));
    expect(digest(altered)).toBe(before);
});

test('the command line requires an explicit database and one mode', () => {
    expect(parseArguments(['--db', 'lab.db'])).toEqual({ apply: false, dbPath: 'lab.db' });
    expect(parseArguments(['--db', 'lab.db', '--apply'])).toEqual({ apply: true, dbPath: 'lab.db' });
    for (const args of [[], ['--apply'], ['--db', 'lab.db', '--apply', '--dry-run'], ['--db', 'lab.db', '--force']])
        expect(() => parseArguments(args)).toThrow(expect.objectContaining({ code: 'REPORT_REVISION_ARGUMENT_INVALID' }));
});
