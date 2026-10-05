const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const Database = require('better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { rejectedGuardWrite } = require('../helpers/rejectedGuardWrite');
const { assertOwnedTestDatabase } = require('../helpers/testOwnedDatabase');
const { SOURCES } = require('../../services/workflowMigrationSources');
const { MARKER, installWorkflowStateGuards, parseArguments } = require('../../scripts/install_workflow_state_guards');
const root = path.resolve(__dirname, '../..'), tmp = path.join(root, 'tests/.tmp');
const script = path.join(root, 'scripts/install_workflow_state_guards.js');
const files = [], fixtures = [], sourceDirectories = [];
const fingerprint = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const markerDdl = 'CREATE TABLE _schema_migrations(id TEXT PRIMARY KEY NOT NULL,appliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,details TEXT)';
const details = JSON.stringify({ evidenceSha256: SOURCES.evidence.sha256, guardsSha256: SOURCES.guards.sha256 });
const guardSql = fs.readFileSync(path.resolve(__dirname, '../../prisma/migrations/20261005000100_workflow_state_guards/migration.sql'), 'utf8');

function ownedFile() {
    const file = assertOwnedTestDatabase(path.join(tmp, `installer_${randomUUID()}.db`), 'system:fixture');
    files.push(file); return file;
}
function createFresh(initialize) {
    const file = ownedFile(); fs.closeSync(fs.openSync(file, 'wx'));
    // Always use the real engine on an exclusively created file. The URL
    // override prevents prisma.config.ts from selecting the working database.
    const child = spawnSync(process.execPath, [path.join(root, 'node_modules/prisma/build/index.js'),
        'db', 'push', '--url', `file:${file.replace(/\\/g, '/')}`], { cwd: root, encoding: 'utf8', timeout: 60000 });
    expect(child.error).toBeUndefined();
    if (child.status !== 0) throw new Error(`Actual fresh Prisma initialization failed: ${child.stdout}\n${child.stderr}`);
    const db = new Database(file, { fileMustExist: true });
    try {
        expect(db.prepare("SELECT name FROM sqlite_master WHERE type='trigger'").all()).toEqual([]);
        expect(db.prepare('SELECT COUNT(*) AS n FROM Sample').get().n).toBe(0);
        if (initialize) initialize(db);
    }
    finally { db.close(); }
    return file;
}
function createPartial() {
    const file = ownedFile(); fs.closeSync(fs.openSync(file, 'wx'));
    const db = new Database(file, { fileMustExist: true });
    try {
        db.exec(fs.readFileSync(path.resolve(__dirname, '../../scripts/schema/full_application_schema.sql'), 'utf8'));
        db.exec('ALTER TABLE "Sample" ADD COLUMN "holdPriorStatus" TEXT');
    } finally { db.close(); }
    return file;
}
function cli(file, args = [], entry = script, preload) {
    const child = spawnSync(process.execPath, [...(preload ? ['--require', preload] : []), entry, ...args],
        { env: { ...process.env, DATABASE_PATH: file, DATABASE_URL: `file:${file}` }, encoding: 'utf8' });
    expect(child.error).toBeUndefined(); return child;
}
function assertRefusal(file, code, entry, preload) {
    const before = fingerprint(file), child = cli(file, ['--apply'], entry, preload);
    expect(child.status).not.toBe(0);
    const error = JSON.parse(child.stderr);
    expect(error.error).toBe(code);
    expect(fingerprint(file)).toBe(before);
    expect(child.stdout).toBe('');
    return error;
}

afterAll(async () => {
    for (const fixture of fixtures) await fixture.close();
    for (const file of files) for (const suffix of ['', '-wal', '-shm', '-journal']) fs.rmSync(`${file}${suffix}`, { force: true });
    for (const directory of sourceDirectories) {
        // These directories were exclusively created below and contain only
        // source assets. Verify the resolved boundary before recursive cleanup.
        expect(fs.realpathSync(path.dirname(directory))).toBe(fs.realpathSync(tmp));
        expect(path.basename(directory)).toMatch(/^installer_sources_/);
        fs.rmSync(directory, { recursive: true });
    }
});

test('fresh Prisma schema installs the exact guards and marker; repeat starts write nothing', () => {
    const file = createFresh(db => {
        db.exec(markerDdl);
        db.exec("INSERT INTO _schema_migrations(id,appliedAt,details) VALUES ('v3_lab_operations_20260906','2026-09-06 14:15:52','original marker bytes')");
    });
    const drySha = fingerprint(file), dry = cli(file);
    expect(dry.status).toBe(0);
    expect(JSON.parse(dry.stdout)).toMatchObject({ mode: 'DRY_RUN', classification: 'FRESH_PRISMA',
        inventory: { candidateCount: 0, unmappedCount: 0, blockedCount: 0 } });
    expect(fingerprint(file)).toBe(drySha);
    const child = cli(file, ['--apply']); expect(child.status).toBe(0);
    const outcome = JSON.parse(child.stdout);
    expect(outcome).toMatchObject({ mode: 'APPLIED', classification: 'FRESH_PRISMA', totalChanges: 1,
        postflight: { integrity: 'ok', foreignKeyViolations: [], marker: { id: MARKER, details } } });
    expect(outcome.postflight.guards).toHaveLength(11);
    rejectedGuardWrite({ actor: 'system:fixture', file, expectedGuardCode: 'INVALID_SAMPLE_STATUS',
        statement: 'INSERT INTO Sample (id,originalId,status,updatedAt) VALUES (?,?,?,?)',
        parameters: ['illegal', 'illegal', 'UNKNOWN_STATE', Date.now()] });
    const db = new Database(file, { readonly: true });
    try { expect(db.prepare('SELECT * FROM _schema_migrations WHERE id=?').get('v3_lab_operations_20260906'))
        .toEqual({ id: 'v3_lab_operations_20260906', appliedAt: '2026-09-06 14:15:52', details: 'original marker bytes' }); }
    finally { db.close(); }
    const before = fingerprint(file), counters = [], originalClose = Database.prototype.close;
    const close = jest.spyOn(Database.prototype, 'close').mockImplementation(function () {
        counters.push(this.prepare('SELECT total_changes() AS n').get().n);
        return originalClose.call(this);
    });
    let noop;
    try { noop = installWorkflowStateGuards({ dbPath: file, apply: true }); } finally { close.mockRestore(); }
    expect(noop).toMatchObject({ mode: 'NO_OP', classification: 'COMPLETE', totalChanges: 0, statements: [] });
    expect(counters.length).toBeGreaterThan(0); expect(counters.every(n => n === 0)).toBe(true);
    expect(fingerprint(file)).toBe(before);
    const second = cli(file, ['--apply']); expect(second.status).toBe(0);
    expect(JSON.parse(second.stdout)).toMatchObject({ mode: 'NO_OP', classification: 'COMPLETE', totalChanges: 0 });
    expect(fingerprint(file)).toBe(before);
});

test('actual pre-179 child installer preserves seeded historical science and the old schema', () => {
    const time = Date.now(), id = `installer-sample-${randomUUID()}`;
    const fixture = beforeGuards({ actor: 'system:fixture', installWorkflowStateGuards: true, preMigrationSnapshot: true,
        samples: [{ id, originalId: id, status: 'ACCEPTED', assignedLab: 'INSTALLER-TEST', history: '[{"original":true}]', createdAt: time, updatedAt: time }],
        workItems: [{ id: `w-${id}`, sampleId: id, analysis: 'SOC', status: 'NOT_ASSIGNED', history: '[{"kept":true}]', version: 7, createdAt: time, updatedAt: time }],
        relatedRows: { Result: [{ id: `r-${id}`, sampleId: id, param: 'SOC', value: '1.8', numericValue: 1.8, unit: '%', createdAt: time, updatedAt: time }] } });
    fixtures.push(fixture);
    const snapshot = fixture.preMigrationSnapshot, before = fingerprint(snapshot.path);
    const dry = cli(snapshot.path, ['--dry-run']); expect(dry.status).toBe(0);
    expect(JSON.parse(dry.stdout)).toMatchObject({ classification: 'PRE_179', mode: 'DRY_RUN',
        inventory: { candidateCount: 0, unmappedCount: 0, blockedCount: 0 } });
    expect(fingerprint(snapshot.path)).toBe(snapshot.sha256); expect(before).toBe(snapshot.sha256);
    const db = new Database(fixture.file, { readonly: true });
    try {
        expect(db.prepare('SELECT value,numericValue,unit FROM Result WHERE id=?').get(`r-${id}`)).toEqual({ value: '1.8', numericValue: 1.8, unit: '%' });
        expect(db.prepare('SELECT history,status FROM Sample WHERE id=?').get(id)).toEqual({ history: '[{"original":true}]', status: 'ACCEPTED' });
        expect(db.prepare('SELECT details FROM _schema_migrations WHERE id=?').get(MARKER).details).toBe(details);
    } finally { db.close(); }
});

test.each(['UNMAPPED_SAMPLE', 'COLLECTED'])('unreviewed %s refuses the actual child with unchanged bytes and no returned handle', status => {
    const file = ownedFile(), time = Date.now(); let error;
    try { beforeGuards({ actor: 'system:fixture', file, installWorkflowStateGuards: true,
        samples: [{ id: 'old', originalId: 'old', status, createdAt: time, updatedAt: time }] }); }
    catch (caught) { error = caught; }
    expect(error).toMatchObject({ code: 'WORKFLOW_STATUS_PLAN_REQUIRED', exitStatus: 1 });
    expect(error.afterSha).toBe(error.beforeSha); expect(error.beforeSha).toMatch(/^[a-f0-9]{64}$/);
    expect(fs.existsSync(file)).toBe(false);
});

test.each([
    ['partial schema', createPartial],
    ['tampered trigger', () => createFresh(db => db.exec('CREATE TRIGGER "Sample_status_insert_guard" BEFORE INSERT ON "Sample" BEGIN SELECT RAISE(ABORT, \'WRONG_GUARD\'); END;'))],
    ['marker without guards', () => createFresh(db => { db.exec(markerDdl); db.prepare('INSERT INTO _schema_migrations(id,details) VALUES (?,?)').run(MARKER, details); })],
    ['complete objects without marker', () => createFresh(db => db.exec(guardSql))],
    ['different marker hashes', () => createFresh(db => { db.exec(guardSql); db.exec(markerDdl); db.prepare('INSERT INTO _schema_migrations(id,details) VALUES (?,?)').run(MARKER, '{"evidenceSha256":"wrong","guardsSha256":"wrong"}'); })],
    ['extra marker key', () => createFresh(db => { db.exec(guardSql); db.exec(markerDdl); db.prepare('INSERT INTO _schema_migrations(id,details) VALUES (?,?)').run(MARKER, details.slice(0, -1) + ',"extra":true}'); })],
    ['unparseable marker', () => createFresh(db => { db.exec(guardSql); db.exec(markerDdl); db.prepare('INSERT INTO _schema_migrations(id,details) VALUES (?,?)').run(MARKER, 'not JSON'); })]
])('%s refuses a writable owned database before any write', (name, create) => {
    const error = assertRefusal(create(), 'WORKFLOW_GUARDS_SCHEMA_MISMATCH');
    expect(error.differences.length).toBeGreaterThan(0);
    if (name === 'complete objects without marker') expect(JSON.stringify(error.differences)).toContain('objects match the source but the marker is absent');
});

test('image-copy hashes are checked and the overlaid volume sources are never read', () => {
    const directory = fs.mkdtempSync(path.join(tmp, 'installer_sources_')); sourceDirectories.push(directory);
    for (const target of ['scripts', 'services']) fs.mkdirSync(path.join(directory, target));
    fs.copyFileSync(script, path.join(directory, 'scripts/install_workflow_state_guards.js'));
    fs.copyFileSync(path.join(root, 'services/workflowMigrationSources.js'), path.join(directory, 'services/workflowMigrationSources.js'));
    // Source-digest failures occur before status inventory or a writable DB open.
    for (const definition of Object.values(SOURCES)) {
        const target = path.join(directory, '.migrations-backup/179', definition.directory, 'migration.sql');
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(root, 'prisma/migrations', definition.directory, 'migration.sql'), target);
        expect(fingerprint(target)).toBe(definition.sha256);
        const volume = path.join(directory, 'prisma/migrations', definition.directory, 'migration.sql');
        fs.mkdirSync(path.dirname(volume), { recursive: true }); fs.writeFileSync(volume, 'tampered overlaid volume source');
    }
    const preload = path.join(directory, 'container-detection.cjs');
    fs.writeFileSync(preload, "const fs=require('node:fs');const exists=fs.existsSync;fs.existsSync=file=>file==='/.dockerenv'||exists(file);\n");
    const dockerfile = fs.readFileSync(path.join(root, '../Dockerfile'), 'utf8');
    for (const definition of Object.values(SOURCES)) expect(dockerfile).toContain(
        `COPY server/prisma/migrations/${definition.directory}/migration.sql /app/server/.migrations-backup/179/${definition.directory}/migration.sql`);
    const file = createFresh(db => { db.exec(guardSql); db.exec(markerDdl); db.prepare('INSERT INTO _schema_migrations(id,details) VALUES (?,?)').run(MARKER, 'not JSON'); });
    // A schema refusal proves both real image sources were accepted first,
    // despite both differing volume copies. No status service is mocked.
    assertRefusal(file, 'WORKFLOW_GUARDS_SCHEMA_MISMATCH', path.join(directory, 'scripts/install_workflow_state_guards.js'), preload);
    fs.appendFileSync(path.join(directory, '.migrations-backup/179', SOURCES.guards.directory, 'migration.sql'), '\n-- unexpected image bytes\n');
    assertRefusal(file, 'WORKFLOW_GUARDS_SOURCE_MISMATCH', path.join(directory, 'scripts/install_workflow_state_guards.js'), preload);
});

test('startup calls the installer after the existing migrations and fails before serving; no override argument exists', () => {
    const entry = fs.readFileSync(path.join(root, '../docker-entrypoint.sh'), 'utf8');
    expect(entry.indexOf('node scripts/install_workflow_state_guards.js --apply')).toBeGreaterThan(entry.indexOf('node scripts/migrate_sitewide_theme_library.js'));
    expect(entry.indexOf('node scripts/install_workflow_state_guards.js --apply')).toBeLessThan(entry.indexOf('exec node index.js'));
    expect(entry).toContain('set -e');
    for (const args of [['--override'], ['--apply', '--dry-run'], ['--apply', '--apply']]) expect(() => parseArguments(args)).toThrow();
    for (const option of [false, undefined, 'true']) expect(() => beforeGuards({ actor: 'system:fixture', installWorkflowStateGuards: option })).toThrow('default schema-only');
    for (const options of [{ installWorkflowStateGuards: true, schemaVariant: 'PRE_1_1_DUPLICATES' },
        { installWorkflowStateGuards: true, applyPendingMigration: true }, { unknown: true }]) {
        const file = ownedFile(); expect(() => beforeGuards({ actor: 'system:fixture', file, ...options })).toThrow();
        expect(fs.existsSync(file)).toBe(false);
    }
});
