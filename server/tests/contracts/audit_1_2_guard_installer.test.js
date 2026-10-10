const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { spawnSync, spawn } = require('node:child_process');
const net = require('node:net');
const Database = require('better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { installCalculationReleasePrerequisites } = require('../helpers/calculationReleasePrerequisites');
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
function assertRefusal(file, code, entry, preload, args = []) {
    const before = fingerprint(file), child = cli(file, ['--apply', ...args], entry, preload);
    expect(child.status).not.toBe(0);
    const error = JSON.parse(child.stderr);
    expect(error.error).toBe(code);
    expect(fingerprint(file)).toBe(before);
    expect(child.stdout).toBe('');
    return error;
}

function reviewedLegacyFixture(status = 'COLLECTED') {
    const id = `reviewed-${randomUUID()}`, time = Date.now(), lab = `lab-${id}`;
    const rows = {
        samples: [{ id, originalId: id, status, assignedLab: lab, history: '[{"original":true}]', createdAt: time, updatedAt: time },
            { id: `released-${id}`, originalId: `released-${id}`, status: 'RELEASED', assignedLab: lab,
                approvedBy: 'historical-approver', approvedAt: time, history: '[{"released":true}]', createdAt: time, updatedAt: time }],
        workItems: [{ id: `w-${id}`, sampleId: id, analysis: 'SOC', status: 'PENDING', assignedLab: lab,
            result: 'retained scalar', history: '[{"work":true}]', version: 7, createdAt: time, updatedAt: time }],
        relatedRows: { Lab: [{ id: lab, code: lab, name: 'Reviewed upgrade test lab', country: 'TEST', createdAt: time, updatedAt: time }],
            Result: [{ id: `r-${id}`, sampleId: id, param: 'SOC', value: '1.8', numericValue: 1.8, unit: '%', createdAt: time, updatedAt: time }] }
    };
    const origin = beforeGuards({ actor: 'system:fixture', ...rows, preMigrationSnapshot: true }); fixtures.push(origin);
    const immutable = origin.preMigrationSnapshot;
    expect(fs.statSync(immutable.path).mode & 0o222).toBe(0);
    const dry = cli(immutable.path, ['--db', immutable.path], path.join(root, 'scripts/migrate_legacy_statuses.js'));
    expect(dry.status).toBe(0); expect(dry.stderr).toBe('');
    const report = JSON.parse(dry.stdout);
    expect(report).toMatchObject({ mode: 'DRY_RUN', schemaReady: false, blockedCount: 0 });
    expect(fingerprint(immutable.path)).toBe(immutable.sha256);
    for (const suffix of ['-wal', '-shm', '-journal']) expect(fs.existsSync(`${immutable.path}${suffix}`)).toBe(false);
    return { id, rows, report, reviewedStatusPlan: { plan: report.plan, fingerprint: report.fingerprint } };
}

function legacyRows(file) {
    const db = new Database(file, { readonly: true, fileMustExist: true });
    try { return Object.fromEntries(['Sample', 'WorkItem', 'Result', 'ReviewDecision', 'ResultEvidenceEvent', 'AuditLog']
        .map(table => [table, db.prepare(`SELECT * FROM "${table}" ORDER BY rowid`).all()])); }
    finally { db.close(); }
}

async function realStartup(file, expectedPass = false) {
    const listener = net.createServer();
    await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
    const port = listener.address().port;
    await new Promise(resolve => listener.close(resolve));
    const child = spawn(process.execPath, [path.join(root, 'index.js')], { cwd: root,
        env: { ...process.env, DATABASE_PATH: file, DATABASE_URL: `file:${file}`, PORT: String(port),
            DISABLE_BACKGROUND_JOBS: 'true', LAB_JOBS_MODE: 'hold', JWT_SECRET: 'audit-startup-contract-secret' } });
    let stdout = '', stderr = '', accepted = false, timer;
    child.stdout.on('data', data => { stdout += data; }); child.stderr.on('data', data => { stderr += data; });
    const completion = new Promise((resolve, reject) => {
        child.on('error', reject);
        child.on('close', (code, signal) => { clearTimeout(timer); resolve({ code, signal }); });
    });
    const connections = new Set();
    const inspectPort = () => {
        const socket = net.connect({ host: '127.0.0.1', port }); connections.add(socket);
        socket.on('connect', () => { accepted = true; socket.destroy(); });
        socket.on('error', () => socket.destroy()); socket.on('close', () => connections.delete(socket));
    };
    const polling = setInterval(inspectPort, 20);
    timer = setTimeout(() => child.kill(), 10000);
    try {
        if (expectedPass) {
            const startedAt = Date.now();
            while (!stdout.includes('Enterprise Server running on') && Date.now() - startedAt < 9000) {
                if (child.exitCode !== null) throw new Error(`The real app refused startup: ${stderr}`);
                await new Promise(resolve => setTimeout(resolve, 25));
            }
            expect(stdout).toContain('Enterprise Server running on');
            // The health fetch can finish before the interval's first TCP
            // probe runs. Require that independent connection proof before
            // stopping the child, under the existing startup deadline.
            while (!accepted && Date.now() - startedAt < 9000) await new Promise(resolve => setTimeout(resolve, 25));
            expect(accepted).toBe(true);
            const response = await fetch(`http://127.0.0.1:${port}/api/health`);
            expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ status: 'ok' });
            child.kill();
        }
        const outcome = await completion;
        return { ...outcome, stdout, stderr, accepted };
    } finally {
        clearInterval(polling); clearTimeout(timer); for (const socket of connections) socket.destroy();
        if (child.exitCode === null && child.signalCode === null) { child.kill(); await completion; }
    }
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

test('the real reviewed legacy upgrade preserves science, refuses interrupted startup, then maps and starts without writes', () => {
    const record = reviewedLegacyFixture();
    expect(record.report).toMatchObject({ candidateCount: 3, unmappedCount: 0, blockedCount: 0 });
    const fixture = beforeGuards({ actor: 'system:fixture', ...record.rows, installWorkflowStateGuards: true,
        reviewedStatusPlan: record.reviewedStatusPlan }); fixtures.push(fixture);
    const before = legacyRows(fixture.file);
    expect(before.Sample.find(row => row.id === record.id).status).toBe('COLLECTED');
    expect(before.WorkItem[0]).toMatchObject({ status: 'PENDING', version: 7, legacyStatus: null });
    // An interruption between schema installation and mapping cannot serve.
    const pending = assertRefusal(fixture.file, 'WORKFLOW_STATUS_PLAN_PENDING');
    expect(pending.differences[0]).toMatchObject({ candidateCount: 3, blockedCount: 0, unmappedCount: 0 });
    assertRefusal(fixture.file, 'WORKFLOW_STATUS_PLAN_PENDING', undefined, undefined,
        ['--reviewed-status-sha256', record.report.fingerprint]);
    expect(legacyRows(fixture.file)).toEqual(before);
    const planFile = `${fixture.file}.plan.json`; files.push(planFile);
    fs.writeFileSync(planFile, JSON.stringify(record.report), { flag: 'wx' });
    const mapped = cli(fixture.file, ['--db', fixture.file, '--apply', '--plan', planFile,
        '--reviewed-sha256', record.report.fingerprint], path.join(root, 'scripts/migrate_legacy_statuses.js'));
    expect(mapped.status).toBe(0); expect(mapped.stderr).toBe('');
    expect(JSON.parse(mapped.stdout)).toMatchObject({ mode: 'APPLIED', changedRows: 3, auditsAdded: 3, unmappedCount: 0 });
    const after = legacyRows(fixture.file);
    for (const table of ['Result', 'ReviewDecision', 'ResultEvidenceEvent']) expect(after[table]).toEqual(before[table]);
    for (const table of ['Sample', 'WorkItem']) for (const original of before[table]) {
        const row = after[table].find(item => item.id === original.id), candidate = record.report.plan.rows.find(item => item.id === original.id);
        expect(row.status).toBe(candidate.to); expect(row.legacyStatus).toBe(original.status);
        const retained = { ...row, status: original.status, legacyStatus: original.legacyStatus, updatedAt: original.updatedAt,
            ...(table === 'WorkItem' && { version: original.version }) };
        expect(retained).toEqual(original);
        if (table === 'WorkItem') expect(row.version).toBe(original.version + 1);
    }
    expect(after.AuditLog).toHaveLength(before.AuditLog.length + 3);
    expect(after.AuditLog.slice(0, before.AuditLog.length)).toEqual(before.AuditLog);
    expect(after.AuditLog.slice(before.AuditLog.length).every(row => row.performedBy === 'system:status-migration')).toBe(true);
    const completedSha = fingerprint(fixture.file), startup = cli(fixture.file, ['--apply']);
    expect(startup.status).toBe(0);
    expect(JSON.parse(startup.stdout)).toMatchObject({ classification: 'COMPLETE', mode: 'NO_OP', totalChanges: 0,
        inventory: { candidateCount: 0, unmappedCount: 0, blockedCount: 0 },
        postflight: { integrity: 'ok', foreignKeyViolations: [], marker: { id: MARKER, details } } });
    expect(fingerprint(fixture.file)).toBe(completedSha); expect(legacyRows(fixture.file)).toEqual(after);
});

test('a real timestamp race invalidates the review and the actual installer refuses without writes or a returned file', () => {
    const record = reviewedLegacyFixture(), file = ownedFile(); let error;
    try { beforeGuards({ actor: 'system:fixture', file, ...record.rows, installWorkflowStateGuards: true,
        reviewedStatusPlan: record.reviewedStatusPlan,
        installerStatusRace: { sampleId: record.id, updatedAt: new Date(record.rows.samples[0].updatedAt + 1000).toISOString() } }); }
    catch (caught) { error = caught; }
    expect(error).toMatchObject({ code: 'WORKFLOW_STATUS_PLAN_STALE', exitStatus: 1 });
    expect(error.beforeSha).toMatch(/^[a-f0-9]{64}$/); expect(error.afterSha).toBe(error.beforeSha);
    expect(fs.existsSync(file)).toBe(false);
});

test('a reviewed fingerprint cannot approve an unmapped status', () => {
    const record = reviewedLegacyFixture('UNMAPPED_SAMPLE'), file = ownedFile(); let error;
    expect(record.report.unmappedCount).toBe(1);
    try { beforeGuards({ actor: 'system:fixture', file, ...record.rows, installWorkflowStateGuards: true,
        reviewedStatusPlan: record.reviewedStatusPlan }); } catch (caught) { error = caught; }
    expect(error).toMatchObject({ code: 'WORKFLOW_STATUS_PLAN_REQUIRED', exitStatus: 1 });
    expect(error.afterSha).toBe(error.beforeSha); expect(fs.existsSync(file)).toBe(false);
});

test('a blocked legacy marker refuses startup even with a reviewed fingerprint and preserves all bytes', () => {
    const record = reviewedLegacyFixture(), fixture = beforeGuards({ actor: 'system:fixture', ...record.rows }); fixtures.push(fixture);
    const db = new Database(fixture.file, { fileMustExist: true });
    try {
        db.prepare('UPDATE "Sample" SET "legacyStatus" = ? WHERE "id" = ?').run('COLLECTED', record.id);
        if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_schema_migrations'").get()) db.exec(markerDdl);
        db.prepare('INSERT INTO _schema_migrations(id,details) VALUES (?,?)').run(MARKER, details);
    } finally { db.close(); }
    const before = legacyRows(fixture.file);
    const refused = assertRefusal(fixture.file, 'WORKFLOW_STATUS_PLAN_PENDING', undefined, undefined,
        ['--reviewed-status-sha256', record.report.fingerprint]);
    expect(refused.differences[0]).toMatchObject({ blockedCount: 1 });
    expect(legacyRows(fixture.file)).toEqual(before);
});

test('malformed or unsupported reviewed fixture options refuse before creating any file', () => {
    const record = reviewedLegacyFixture(), review = record.reviewedStatusPlan;
    const validRace = { sampleId: record.id, updatedAt: new Date(record.rows.samples[0].updatedAt + 1000).toISOString() };
    const invalid = [
        { reviewedStatusPlan: review }, { installWorkflowStateGuards: true, reviewedStatusPlan: undefined },
        { installWorkflowStateGuards: true, reviewedStatusPlan: { ...review, extra: true } },
        { installWorkflowStateGuards: true, reviewedStatusPlan: { plan: review.plan, fingerprint: '0'.repeat(64) } },
        { installWorkflowStateGuards: true, reviewedStatusPlan: { plan: null, fingerprint: review.fingerprint } },
        { installWorkflowStateGuards: true, reviewedStatusPlan: review, schemaVariant: 'PRE_1_1_DUPLICATES' },
        { installWorkflowStateGuards: true, installerStatusRace: validRace },
        ...[undefined, { ...validRace, extra: true }, { ...validRace, sampleId: 'not-seeded' },
            { ...validRace, sampleId: `w-${record.id}` }, { ...validRace, updatedAt: 'invalid' },
            { ...validRace, updatedAt: new Date(record.rows.samples[0].updatedAt).toISOString() }]
            .map(installerStatusRace => ({ installWorkflowStateGuards: true, reviewedStatusPlan: review, installerStatusRace }))
    ];
    for (const options of invalid) {
        const file = ownedFile();
        expect(() => beforeGuards({ actor: 'system:fixture', ...record.rows, file, ...options })).toThrow();
        expect(fs.existsSync(file)).toBe(false);
    }
});

test('direct startup refuses a pre-179 file before app import, scheduler or listen, with unchanged bytes', async () => {
    const record = reviewedLegacyFixture(), origin = fixtures.at(-1), file = origin.preMigrationSnapshot.path;
    const before = fingerprint(file), child = await realStartup(file);
    expect(child).toMatchObject({ code: 1, accepted: false });
    expect(JSON.parse(child.stderr)).toMatchObject({ error: 'WORKFLOW_GUARDS_NOT_INSTALLED', nextStep: expect.any(String) });
    expect(child.stdout).not.toMatch(/SCHEDULER|Enterprise Server|\[PRISMA\]/);
    expect(fingerprint(file)).toBe(before); expect(record.report.candidateCount).toBe(3);
});

test('direct startup refuses a fresh db push, without writes, serving or scheduler initialization', async () => {
    const file = createFresh(), before = fingerprint(file), child = await realStartup(file);
    expect(child).toMatchObject({ code: 1, accepted: false });
    expect(JSON.parse(child.stderr)).toMatchObject({ error: 'WORKFLOW_GUARDS_NOT_INSTALLED' });
    expect(child.stdout).not.toMatch(/SCHEDULER|Enterprise Server|\[PRISMA\]/); expect(fingerprint(file)).toBe(before);
});

test('direct startup refuses an interrupted reviewed upgrade with unchanged SHA and no listener', async () => {
    const record = reviewedLegacyFixture(), fixture = beforeGuards({ actor: 'system:fixture', ...record.rows,
        installWorkflowStateGuards: true, reviewedStatusPlan: record.reviewedStatusPlan }); fixtures.push(fixture);
    const before = fingerprint(fixture.file), child = await realStartup(fixture.file);
    expect(child).toMatchObject({ code: 1, accepted: false });
    expect(JSON.parse(child.stderr)).toMatchObject({ error: 'WORKFLOW_STATUS_PLAN_PENDING' });
    expect(child.stdout).not.toMatch(/SCHEDULER|Enterprise Server|\[PRISMA\]/); expect(fingerprint(fixture.file)).toBe(before);
});

test('direct startup reports a mismatched trigger before serving and preserves the file', async () => {
    const file = createFresh(db => db.exec('CREATE TRIGGER "Sample_status_insert_guard" BEFORE INSERT ON "Sample" BEGIN SELECT RAISE(ABORT, \'WRONG_GUARD\'); END;'));
    const before = fingerprint(file), child = await realStartup(file);
    expect(child).toMatchObject({ code: 1, accepted: false });
    const refused = JSON.parse(child.stderr);
    expect(refused.error).toBe('WORKFLOW_GUARDS_SCHEMA_MISMATCH');
    expect(refused.differences.some(item => item.object === 'Sample_status_insert_guard')).toBe(true);
    expect(child.stdout).not.toMatch(/SCHEDULER|Enterprise Server|\[PRISMA\]/); expect(fingerprint(file)).toBe(before);
});

test('direct startup refuses a missing file without implicitly creating it', async () => {
    const file = ownedFile(), child = await realStartup(file);
    expect(child).toMatchObject({ code: 1, accepted: false });
    expect(JSON.parse(child.stderr)).toMatchObject({ error: 'DATABASE_NOT_FOUND' });
    expect(child.stdout).not.toMatch(/SCHEDULER|Enterprise Server|\[PRISMA\]/); expect(fs.existsSync(file)).toBe(false);
});

test('direct startup refuses missing normalized QC installation before app import and preserves the file', async () => {
    const fixture = beforeGuards({ actor: 'system:fixture', installWorkflowStateGuards: true }); fixtures.push(fixture);
    require('../../scripts/install_result_attempt_links').installResultAttemptLinks({ dbPath: fixture.file, apply: true });
    require('../../scripts/install_sample_holds').installSampleHolds({ dbPath: fixture.file, apply: true });
    require('../../scripts/install_reference_materials').installReferenceMaterials({ dbPath: fixture.file, apply: true });
    require('../../scripts/install_qc_rules').installQcRules({ dbPath: fixture.file, apply: true });
    const before = fingerprint(fixture.file), child = await realStartup(fixture.file);
    expect(child).toMatchObject({ code: 1, accepted: false });
    expect(JSON.parse(child.stderr)).toMatchObject({ error: 'QC_RUN_NOT_INSTALLED', nextStep: expect.stringContaining('audit-2.3-normalized-qc-migration.md') });
    expect(child.stdout).not.toMatch(/SCHEDULER|Enterprise Server|\[PRISMA\]/);
    expect(fingerprint(fixture.file)).toBe(before);
});

test('a complete guarded database passes the read-only gate, listens and answers a real health request', async () => {
    const fixture = beforeGuards({ actor: 'system:fixture', installWorkflowStateGuards: true }); fixtures.push(fixture);
    require('../../scripts/install_result_attempt_links').installResultAttemptLinks({ dbPath: fixture.file, apply: true });
    require('../../scripts/install_sample_holds').installSampleHolds({ dbPath: fixture.file, apply: true });
    require('../../scripts/install_reference_materials').installReferenceMaterials({ dbPath: fixture.file, apply: true });
    require('../../scripts/install_qc_rules').installQcRules({ dbPath: fixture.file, apply: true });
    require('../../scripts/install_qc_runs').installQcRuns({ dbPath: fixture.file, apply: true });
    require('../../scripts/install_qc_gate_scope').installQcGateScope({ dbPath: fixture.file, apply: true });
    require('../../scripts/bootstrap_pt_nonconformity').bootstrapPtNonconformity({ dbPath: fixture.file, apply: true });
    require('../../scripts/install_result_equipment_evidence').installResultEquipmentEvidence({ dbPath: fixture.file, apply: true });
    require('../../scripts/install_work_attempt_contract').installWorkAttemptContract({ dbPath: fixture.file, apply: true });
    require('../../scripts/install_work_repeat_contract').installWorkRepeatContract({ dbPath: fixture.file, apply: true });
    require('../../scripts/install_reported_value_selections').installReportedValueSelections({ dbPath: fixture.file, apply: true });
    require('../../scripts/install_nonconformity_reports').installNonconformityReports({ dbPath: fixture.file, apply: true });
    require('../../scripts/install_batch_reagent_lots').installBatchReagentLots({ dbPath: fixture.file, apply: true });
    require('../../scripts/install_result_override_requests').installResultOverrideRequests({ dbPath: fixture.file, apply: true });
    const calculationDatabase = fixture.file;
    installCalculationReleasePrerequisites(calculationDatabase);
    const crossChecks=require('../../scripts/install_cross_check_evaluations').installCrossCheckEvaluations({dbPath:fixture.file,apply:true});
    expect(crossChecks).toMatchObject({classification:'COMPLETE_201',newEvaluationCount:0,backfilledCount:0});
    const beforeAmendments=fingerprint(fixture.file);
    const missingAmendments=await realStartup(fixture.file);
    expect(missingAmendments.accepted).toBe(false);
    expect(missingAmendments.stderr).toContain('AMENDMENT_STARTUP_REQUIRED');
    expect(missingAmendments.stdout).not.toContain('Enterprise Server running on');
    expect(fingerprint(fixture.file)).toBe(beforeAmendments);
    expect(require('../../scripts/install_sample_amendment_authorisation').installSampleAmendmentAuthorisation({dbPath:fixture.file,apply:true}))
        .toMatchObject({classification:'COMPLETE_210',newAmendmentCount:0,newAttemptLinkCount:0,newWithdrawalCount:0,backfilledCount:0});
    const beforeRevisions=fingerprint(fixture.file);
    const missingRevisions=await realStartup(fixture.file);
    expect(missingRevisions.accepted).toBe(false);
    expect(missingRevisions.stderr).toContain('REPORT_REVISION_STARTUP_REQUIRED');
    expect(missingRevisions.stdout).not.toContain('Enterprise Server running on');
    expect(fingerprint(fixture.file)).toBe(beforeRevisions);
    expect(require('../../scripts/install_report_revisions').installReportRevisions({dbPath:fixture.file,apply:true}))
        .toMatchObject({classification:'COMPLETE_211',previousClassification:'FRESH_PRISMA_211',backfilledCount:0});
    const child = await realStartup(fixture.file, true);
    expect(child.accepted).toBe(true);
    const revisionsReady=JSON.parse(child.stdout.split('\n').find(line=>line.startsWith('{"event":"REPORT_REVISION_STARTUP_READY"')));
    expect(revisionsReady).toMatchObject({classification:'COMPLETE_211',totalChanges:0});
    expect(child.stdout.indexOf('REPORT_REVISION_STARTUP_READY')).toBeLessThan(child.stdout.indexOf('Enterprise Server running on'));
    const amendmentsReady=JSON.parse(child.stdout.split('\n').find(line=>line.startsWith('{"event":"AMENDMENT_STARTUP_READY"')));
    expect(amendmentsReady).toMatchObject({classification:'COMPLETE_210',totalChanges:0});
    expect(child.stdout.indexOf('AMENDMENT_STARTUP_READY')).toBeLessThan(child.stdout.indexOf('Enterprise Server running on'));
    const ready = JSON.parse(child.stdout.split('\n').find(line => line.startsWith('{"event":"WORKFLOW_STARTUP_READY"')));
    expect(ready).toMatchObject({ classification: 'COMPLETE', totalChanges: 0,
        inventory: { candidateCount: 0, unmappedCount: 0, blockedCount: 0 } });
    // Prisma intentionally suppresses its startup log in NODE_ENV=test. The
    // real listening event is present in every mode and must follow the gate.
    expect(child.stdout.indexOf('WORKFLOW_STARTUP_READY')).toBeLessThan(child.stdout.indexOf('Enterprise Server running on'));
    const holdsReady = JSON.parse(child.stdout.split('\n').find(line => line.startsWith('{"event":"SAMPLE_HOLD_STARTUP_READY"')));
    expect(holdsReady).toMatchObject({ classification: 'COMPLETE', totalChanges: 0 });
    expect(child.stdout.indexOf('SAMPLE_HOLD_STARTUP_READY')).toBeLessThan(child.stdout.indexOf('Enterprise Server running on'));
    const qcReady = JSON.parse(child.stdout.split('\n').find(line => line.startsWith('{"event":"QC_RUN_STARTUP_READY"')));
    expect(qcReady).toMatchObject({ classification: 'COMPLETE', totalChanges: 0 });
    expect(child.stdout.indexOf('QC_RUN_STARTUP_READY')).toBeLessThan(child.stdout.indexOf('Enterprise Server running on'));
    const attemptsReady = JSON.parse(child.stdout.split('\n').find(line => line.startsWith('{"event":"WORK_ATTEMPT_STARTUP_READY"')));
    expect(attemptsReady).toMatchObject({ classification: 'COMPLETE', totalChanges: 0 });
    expect(child.stdout.indexOf('WORK_ATTEMPT_STARTUP_READY')).toBeLessThan(child.stdout.indexOf('Enterprise Server running on'));
    const overridesReady = JSON.parse(child.stdout.split('\n').find(line => line.startsWith('{"event":"RESULT_OVERRIDE_STARTUP_READY"')));
    expect(overridesReady).toMatchObject({ classification: 'COMPLETE_197', totalChanges: 0 });
    expect(child.stdout.indexOf('RESULT_OVERRIDE_STARTUP_READY')).toBeLessThan(child.stdout.indexOf('Enterprise Server running on'));
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
    for (const args of [['--override'], ['--apply', '--dry-run'], ['--apply', '--apply'], ['--apply', '--reviewed-status-sha256'],
        ['--apply', '--reviewed-status-sha256', 'not a fingerprint'], ['--reviewed-status-sha256', 'a'.repeat(64)]]) expect(() => parseArguments(args)).toThrow();
    expect(entry).not.toContain('--reviewed-status-sha256');
    for (const option of [false, undefined, 'true']) expect(() => beforeGuards({ actor: 'system:fixture', installWorkflowStateGuards: option })).toThrow('default schema-only');
    for (const options of [{ installWorkflowStateGuards: true, schemaVariant: 'PRE_1_1_DUPLICATES' },
        { installWorkflowStateGuards: true, applyPendingMigration: true }, { unknown: true }]) {
        const file = ownedFile(); expect(() => beforeGuards({ actor: 'system:fixture', file, ...options })).toThrow();
        expect(fs.existsSync(file)).toBe(false);
    }
});
