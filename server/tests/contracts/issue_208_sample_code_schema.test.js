const fs = require('node:fs'), path = require('node:path'), { randomUUID, createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { assertOwnedTestDatabase } = require('../helpers/testOwnedDatabase');
const { installSampleCodeSchema, assertSampleCodeStartupReady, parseArguments } = require('../../scripts/install_sample_code_schema');
const { loadSampleCodeMigrationSource } = require('../../services/sampleCodeMigrationSource');
const { assertLabelPrintStartupReady } = require('../../scripts/install_label_print_events');
const files = [], fixtures = [], root = path.resolve(__dirname, '../..');
const quote = name => '"' + name.replaceAll('"', '""') + '"';
const hashes = file => Object.fromEntries(['', '-wal', '-shm'].map(suffix => [suffix, fs.existsSync(file + suffix)
    ? createHash('sha256').update(fs.readFileSync(file + suffix)).digest('hex') : null]));
function ownedFile() {
    const directory = path.resolve(__dirname, '../.tmp'); fs.mkdirSync(directory, { recursive: true });
    const file = assertOwnedTestDatabase(path.join(directory, `audit_legacy_208_atomic_${randomUUID()}.db`), 'system:fixture');
    files.push(file); return file;
}
function historical() {
    const now = Date.UTC(2026, 0, 1), old = beforeGuards({ actor: 'system:fixture', schemaVariant: 'PRE_1_3_SAMPLE_CODES',
        samples: ['issued', 'ambiguous'].map((id, i) => ({ id, originalId: id, labId: i ? ' AAA ' : 'S123',
            assignedLab: 'lab-a', status: 'EXPECTED', metadata: '{"retain":"é精确"}', createdAt: now, updatedAt: now })),
        workItems: [{ id: 'old-work', sampleId: 'issued', labId: 'S123', assignedLab: 'lab-a', analysis: 'PH_H2O',
            status: 'NOT_ASSIGNED', createdAt: now, updatedAt: now }],
        relatedRows: { Lab: [{ id: 'lab-a', code: 'AAA', name: 'Historical lab', country: 'TEST' }],
            AuditLog: [{ id: 'old-audit', entity: 'Sample', entityId: 'issued', action: 'LEGACY_FIXTURE', performedBy: 'system:fixture', details: '  original receipt bytes  ' }] } });
    const file = ownedFile();
    // Retain the populated predecessor before the helper accounts for its own pending migration.
    fs.copyFileSync(old.file, file, fs.constants.COPYFILE_EXCL);
    old.applyPendingMigration(); old.close();
    const receipts = new Database(file);
    try {
        receipts.exec('CREATE TABLE "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL,"appliedAt" DATETIME NOT NULL,"details" TEXT)');
        receipts.prepare('INSERT INTO "_schema_migrations" (id,appliedAt,details) VALUES (?,?,?)')
            .run('historical-receipt', '2026-01-01T00:00:00.000Z', '  original receipt bytes: é精确  ');
    } finally { receipts.close(); }
    return file;
}
function inspect(file, prior) {
    const db = new Database(file, { readonly: true, fileMustExist: true });
    try {
        const names = prior ? Object.keys(prior.tables) : db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.name);
        const tables = Object.fromEntries(names.map(name => {
            const shape = db.prepare('PRAGMA table_xinfo(' + quote(name) + ')').all();
            const columns = prior ? prior.tables[name].columns.map(row => row.name) : shape.map(row => row.name);
            return [name, { columns: shape.filter(row => columns.includes(row.name)), foreignKeys: db.prepare('PRAGMA foreign_key_list(' + quote(name) + ')').all(),
                rows: db.prepare('SELECT ' + columns.map(quote).join(',') + ' FROM ' + quote(name) + ' ORDER BY rowid').all() }];
        }));
        const objects = prior ? prior.objects.map(row => db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name=?').get(row.name))
            : db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND NOT(type='table' AND name IN ('Sample','WorkItem')) ORDER BY type,name").all();
        return { tables, objects };
    } finally { db.close(); }
}
function probe(kind) {
    const file = ownedFile(), db = new Database(file);
    try {
        db.exec('CREATE TABLE "Lab" ("id" TEXT PRIMARY KEY NOT NULL)');
        if (kind.startsWith('partial-') || kind === 'missing-sample') {
            db.exec('CREATE TABLE "WorkItem" ("id" TEXT PRIMARY KEY NOT NULL)');
            if (kind !== 'missing-sample') db.exec('CREATE TABLE "Sample" ("id" TEXT PRIMARY KEY NOT NULL)');
            switch (kind) {
            case 'partial-sample': db.exec('ALTER TABLE "Sample" ADD COLUMN "labSampleCode" TEXT'); break;
            case 'partial-work': db.exec('ALTER TABLE "WorkItem" ADD COLUMN "legacyLabId" TEXT'); break;
            case 'partial-columns': db.exec('ALTER TABLE "Sample" ADD COLUMN "labSampleCode" TEXT; ALTER TABLE "WorkItem" ADD COLUMN "legacyLabId" TEXT'); break;
            case 'partial-index': db.exec('ALTER TABLE "Sample" ADD COLUMN "labSampleCode" TEXT; CREATE UNIQUE INDEX "Sample_labSampleCode_key" ON "Sample"("labSampleCode")'); break;
            case 'partial-counter': db.exec('CREATE TABLE "LabSequence" ("labId" TEXT NOT NULL,"scope" TEXT NOT NULL,"year" INTEGER NOT NULL,"next" INTEGER NOT NULL DEFAULT 1,PRIMARY KEY ("labId","scope","year"))'); break;
            }
            return file;
        }
        switch (kind) {
        case 'type': db.exec('CREATE TABLE "Sample" ("id" TEXT PRIMARY KEY NOT NULL,"labSampleCode" REAL)'); break;
        case 'not-null': db.exec('CREATE TABLE "Sample" ("id" TEXT PRIMARY KEY NOT NULL,"labSampleCode" TEXT NOT NULL)'); break;
        case 'default': db.exec('CREATE TABLE "Sample" ("id" TEXT PRIMARY KEY NOT NULL,"labSampleCode" TEXT DEFAULT NULL)'); break;
        case 'collation': db.exec('CREATE TABLE "Sample" ("id" TEXT PRIMARY KEY NOT NULL,"labSampleCode" TEXT COLLATE NOCASE)'); break;
        case 'check': db.exec('CREATE TABLE "Sample" ("id" TEXT PRIMARY KEY NOT NULL,"labSampleCode" TEXT CHECK(length(labSampleCode)>0))'); break;
        case 'case': db.exec('CREATE TABLE "Sample" ("id" TEXT PRIMARY KEY NOT NULL,"LABSAMPLECODE" TEXT)'); break;
        default: db.exec('CREATE TABLE "Sample" ("id" TEXT PRIMARY KEY NOT NULL,"labSampleCode" TEXT)');
        }
        if (kind === 'work-type') db.exec('CREATE TABLE "WorkItem" ("id" TEXT PRIMARY KEY NOT NULL,"legacyLabId" REAL)');
        else db.exec('CREATE TABLE "WorkItem" ("id" TEXT PRIMARY KEY NOT NULL,"legacyLabId" TEXT)');
        if (kind === 'index') db.exec('CREATE INDEX "Sample_labSampleCode_key" ON "Sample"("labSampleCode")');
        else db.exec('CREATE UNIQUE INDEX "Sample_labSampleCode_key" ON "Sample"("labSampleCode")');
        if (kind === 'sequence') db.exec('CREATE TABLE "LabSequence" ("labId" TEXT NOT NULL,"scope" TEXT NOT NULL,"year" INTEGER NOT NULL,"next" INTEGER NOT NULL DEFAULT 2,PRIMARY KEY ("labId","scope","year"))');
        else if (kind === 'sequence-view') db.exec('CREATE VIEW "LabSequence" AS SELECT "id" FROM "Lab"');
        else db.exec('CREATE TABLE "LabSequence" ("labId" TEXT NOT NULL,"scope" TEXT NOT NULL,"year" INTEGER NOT NULL,"next" INTEGER NOT NULL DEFAULT 1,PRIMARY KEY ("labId","scope","year"))');
        if (kind === 'extra-object') db.exec('CREATE INDEX "LabSequence_unreviewed" ON "LabSequence"("next")');
        return file;
    } finally { db.close(); }
}
afterEach(async () => {
    for (const fixture of fixtures.splice(0)) await fixture.close();
    for (const file of files.splice(0)) {
        assertOwnedTestDatabase(file, 'system:fixture');
        for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(file + suffix)) fs.unlinkSync(file + suffix);
    }
});

test('the populated historical predecessor gains only approved nullable storage, with every original column, row and receipt retained', () => {
    const file = historical(), before = inspect(file), initial = hashes(file);
    expect(before.tables.Sample.columns.some(row => row.name === 'labSampleCode')).toBe(false);
    expect(before.tables.WorkItem.columns.some(row => row.name === 'legacyLabId')).toBe(false);
    expect(before.tables._schema_migrations.rows.length).toBeGreaterThan(0);
    expect(installSampleCodeSchema({ dbPath: file })).toMatchObject({ classification: 'ABSENT', mode: 'DRY_RUN', totalChanges: 0 });
    expect(hashes(file)).toEqual(initial);
    expect(() => assertSampleCodeStartupReady(file)).toThrow(/reviewed sample-code schema/);
    expect(() => assertLabelPrintStartupReady(file)).toThrow(expect.objectContaining({ code: 'SAMPLE_CODE_SCHEMA_STARTUP_REQUIRED' }));
    expect(hashes(file)).toEqual(initial);
    expect(installSampleCodeSchema({ dbPath: file, apply: true })).toMatchObject({ classification: 'COMPLETE', shape: 'CANONICAL',
        previousClassification: 'ABSENT', mode: 'APPLIED', executedDdlCount: 4, originalRowsPreserved: true,
        originalReceiptsPreserved: true, newSequenceCount: 0, totalChanges: 0, dataWrites: 0, backfilledCount: 0 });
    expect(inspect(file, before)).toEqual(before);
    const db = new Database(file, { readonly: true, fileMustExist: true });
    try {
        expect(db.prepare('SELECT labId,labSampleCode FROM Sample ORDER BY id').all()).toEqual([
            { labId: ' AAA ', labSampleCode: null }, { labId: 'S123', labSampleCode: null }]);
        expect(db.prepare('SELECT labId,legacyLabId FROM WorkItem').get()).toEqual({ labId: 'S123', legacyLabId: null });
        expect(db.prepare('SELECT count(*) n FROM LabSequence').get().n).toBe(0);
        expect(db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='Sample_labSampleCode_key'").get()).toBeDefined();
    } finally { db.close(); }
    const installed = hashes(file);
    expect(installSampleCodeSchema({ dbPath: file, apply: true })).toMatchObject({ classification: 'COMPLETE', mode: 'NO_OP', totalChanges: 0 });
    expect(assertSampleCodeStartupReady(file).classification).toBe('COMPLETE');
    expect(hashes(file)).toEqual(installed);
});

test.each(['partial-sample', 'partial-work', 'partial-columns', 'partial-index', 'partial-counter',
    'type', 'not-null', 'default', 'collation', 'check', 'case', 'work-type', 'index', 'sequence', 'sequence-view', 'extra-object'])('%s is refused before any mutation', kind => {
    const file = probe(kind), before = hashes(file);
    for (const apply of [false, true]) expect(() => installSampleCodeSchema({ dbPath: file, apply }))
        .toThrow(expect.objectContaining({ code: 'SAMPLE_CODE_SCHEMA_MISMATCH', totalChanges: 0 }));
    expect(hashes(file)).toEqual(before);
});

test.each(['ABSENT', 'COMPLETE'])('read-only %s review preserves original database, committed WAL and SHM bytes', classification => {
    const file = historical(); if (classification === 'COMPLETE') installSampleCodeSchema({ dbPath: file, apply: true });
    const holder = new Database(file);
    try {
        holder.pragma('journal_mode=WAL'); holder.exec('CREATE TABLE "ReadonlyEvidence" ("id" INTEGER PRIMARY KEY)');
        const before = hashes(file); expect(before['-wal']).not.toBeNull(); expect(before['-shm']).not.toBeNull();
        const result = installSampleCodeSchema({ dbPath: file, apply: classification === 'COMPLETE' });
        expect(result).toMatchObject({ classification, totalChanges: 0, readonlySnapshot: { originalFilesPreserved: true, originalDbWalShmSha256: before } });
        expect(hashes(file)).toEqual(before);
    } finally { holder.close(); }
});

test('an existing canonical schema retains its issued code and live counter without resetting values', async () => {
    const { qcGateFixture } = require('../helpers/qcGateFixture'), f = await qcGateFixture(); fixtures.push(f);
    const codes = require('../../services/sampleCodeService'), { inTransaction } = require('../../services/workflowStateRules');
    const { createSampleFixture } = require('../helpers/workflowFixtures');
    const sample = await inTransaction(f.db, async tx => {
        const code = await codes.allocateSampleCode(tx, { labReference: f.labId });
        return createSampleFixture(tx, { data: { id: randomUUID(), originalId: randomUUID(), assignedLab: f.labId, labId: code, labSampleCode: code, status: 'PROCESSING' } });
    });
    const before = inspect(f.file), bytes = hashes(f.file);
    expect(before.tables.LabSequence.rows.length).toBeGreaterThan(0);
    expect(installSampleCodeSchema({ dbPath: f.file, apply: true })).toMatchObject({ classification: 'COMPLETE', shape: 'CANONICAL', mode: 'NO_OP', totalChanges: 0 });
    expect(hashes(f.file)).toEqual(bytes); expect(inspect(f.file)).toEqual(before);
    expect(await f.db.sample.findUnique({ where: { id: sample.id } })).toEqual(sample);
});

test('complete Prisma-generated storage is an exact no-op and gains no canonical CHECK constraints', () => {
    const file = probe('complete'), before = inspect(file), bytes = hashes(file);
    expect(installSampleCodeSchema({ dbPath: file, apply: true })).toMatchObject({ classification: 'COMPLETE', shape: 'PRISMA_EQUIVALENT', mode: 'NO_OP', totalChanges: 0 });
    expect(inspect(file)).toEqual(before);
    expect(hashes(file)).toEqual(bytes);
});

test('missing prerequisites and paths never create replacement storage; CLI has no backfill or override option', () => {
    const file = probe('missing-sample'), before = hashes(file), missing = ownedFile();
    expect(() => installSampleCodeSchema({ dbPath: file, apply: true })).toThrow(expect.objectContaining({ code: 'SAMPLE_CODE_SCHEMA_PREREQUISITE_REQUIRED' }));
    expect(hashes(file)).toEqual(before);
    expect(() => installSampleCodeSchema({ dbPath: missing, apply: true })).toThrow(expect.objectContaining({ code: 'SAMPLE_CODE_SCHEMA_DATABASE_REQUIRED' }));
    expect(fs.existsSync(missing)).toBe(false);
    for (const args of [[], ['--db'], ['--db', file, '--backfill'], ['--db', file, '--override'], ['--db', file, '--apply', '--dry-run'], ['--db', file, '--apply', '--apply']])
        expect(() => parseArguments(args)).toThrow(expect.objectContaining({ code: 'SAMPLE_CODE_SCHEMA_ARGUMENT_INVALID' }));
    expect(parseArguments(['--db', file])).toEqual({ dbPath: file, apply: false });
});

test('the unchanged approved DDL is pinned, scanned without writer exceptions, and required before containers and labels', () => {
    const { scanSource } = require('../helpers/workflowWriteScanner'), release = loadSampleCodeMigrationSource();
    expect(release.sha256).toBe('e52a11bb7fc8dfee678184025dda8e8342cde3896d3b5f1c89b83897702d8ff0');
    const entry = fs.readFileSync(path.join(root, '../docker-entrypoint.sh'), 'utf8');
    expect(entry.indexOf('node scripts/install_sample_code_schema.js')).toBeGreaterThan(0);
    expect(entry.indexOf('node scripts/install_sample_code_schema.js')).toBeLessThan(entry.indexOf('node scripts/install_sample_containers.js'));
    expect(entry.indexOf('node scripts/install_sample_code_schema.js')).toBeLessThan(entry.indexOf('node scripts/install_label_print_events.js'));
    expect(fs.readFileSync(path.join(root, '../Dockerfile'), 'utf8')).toContain('COPY server/prisma/migrations/20261004170000_add_atomic_sample_codes/migration.sql /app/server/.migrations-backup/180/20261004170000_add_atomic_sample_codes/migration.sql');
    const source = "const {loadSampleCodeMigrationSource}=require('../services/sampleCodeMigrationSource'); const release=loadSampleCodeMigrationSource(); db.exec(release.sql);";
    expect(scanSource(source, 'scripts/probe.js')).toEqual([]);
    expect(scanSource(source + 'db.exec("UPDATE Sample SET status=1");', 'scripts/probe.js')).toEqual([expect.objectContaining({ code: 'RAW_WORKFLOW_SQL' })]);
    const read = fs.readFileSync, loader = path.join(root, 'services/sampleCodeMigrationSource.js');
    const spy = jest.spyOn(fs, 'readFileSync').mockImplementation((file, ...args) => {
        const bytes = read(file, ...args); return path.resolve(String(file)) === loader ? Buffer.from(String(bytes) + '\n// altered\n') : bytes;
    });
    try { expect(scanSource(source, 'scripts/probe.js')).toEqual([expect.objectContaining({ code: 'UNRESOLVED_WORKFLOW_SQL' })]); }
    finally { spy.mockRestore(); }
    const ddl = path.join(root, 'prisma/migrations/20261004170000_add_atomic_sample_codes/migration.sql');
    const changed = jest.spyOn(fs, 'readFileSync').mockImplementation((file, ...args) => {
        const bytes = read(file, ...args); return path.resolve(String(file)) === ddl ? Buffer.from(String(bytes) + '\n-- altered\n') : bytes;
    });
    try { expect(() => loadSampleCodeMigrationSource()).toThrow(expect.objectContaining({ code: 'SAMPLE_CODE_SCHEMA_SOURCE_MISMATCH' })); }
    finally { changed.mockRestore(); }
});
