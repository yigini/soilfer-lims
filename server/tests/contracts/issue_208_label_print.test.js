const { randomUUID, createHash } = require('node:crypto');
const fs = require('node:fs');
const Database = require('better-sqlite3');
const express = require('express'), request = require('supertest');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { createSampleFixture } = require('../helpers/workflowFixtures');
const { inTransaction } = require('../../services/workflowStateRules');
const codes = require('../../services/sampleCodeService');
const containers = require('../../services/sampleContainerService');
const labels = require('../../services/labelPrintService');
const { installLabelPrintEvents, assertLabelPrintStartupReady } = require('../../scripts/install_label_print_events');
const { loadLabelPrintMigrationSource } = require('../../services/labelPrintMigrationSource');
const owned = [];
afterEach(async () => { for (const f of owned.splice(0)) await f.close(); });
const raw = (f, run) => { const db = new Database(f.file); try { return run(db); } finally { db.close(); } };
async function fixture(install = true) {
    const f = await qcGateFixture(); owned.push(f);
    if (install) installLabelPrintEvents({ dbPath: f.file, apply: true });
    await f.db.lab.update({ where: { id: f.labId }, data: { code: 'LABEL-LAB' } });
    f.sample = await inTransaction(f.db, async tx => {
        const code = await codes.allocateSampleCode(tx, { labReference: f.labId });
        return createSampleFixture(tx, { data: { id: randomUUID(), originalId: randomUUID(), assignedLab: f.labId,
            labSampleCode: code, labId: code, status: 'PROCESSING' } });
    });
    f.item = { entity: 'SAMPLE', entityId: f.sample.id, count: 2 };
    return f;
}

test('sample, bulk container and aliquot print issued checked codes, and reprints require an audited reason', async () => {
    const f = await fixture(), before = await f.snapshot();
    const bulk = await containers.create(f.db, f.sample.id, f.actor, { kind: 'BULK' });
    const aliquot = await containers.create(f.db, f.sample.id, f.actor, { kind: 'ALIQUOT', parentId: bulk.id });
    const items = [f.item, ...[bulk, aliquot].map(row => ({ entity: 'CONTAINER', entityId: row.id, count: 1 }))];
    const preview = await labels.preview(f.db, f.actor, { items });
    expect(preview.map(row => row.code)).toEqual([f.sample.labSampleCode, bulk.code, aliquot.code]);
    expect(preview.every(row => codes.verifyCheckCharacter(row.code))).toBe(true);
    expect(await f.db.labelPrintEvent.count()).toBe(0);
    const first = await labels.print(f.db, f.actor, { items, format: 'STANDARD' });
    expect(first.events.map(row => [row.entity, row.count, row.ordinal, row.reason, row.by])).toEqual([
        ['SAMPLE', 2, 1, null, f.actor.username], ['CONTAINER', 1, 1, null, f.actor.username], ['CONTAINER', 1, 1, null, f.actor.username]
    ]);
    expect(first.events.every(row => row.at instanceof Date)).toBe(true);
    await expect(labels.print(f.db, f.actor, { items, format: 'COMPACT', reason: '   ' }))
        .rejects.toMatchObject({ statusCode: 400, code: 'LABEL_REPRINT_REASON_REQUIRED' });
    expect(await f.db.labelPrintEvent.count()).toBe(3);
    const again = await labels.print(f.db, f.actor, { items, format: 'STANDARD', reason: ' Damaged labels replaced ' });
    expect(again.events.every(row => row.ordinal === 2 && row.reason === 'Damaged labels replaced')).toBe(true);
    expect(await f.db.sample.findUnique({ where: { id: f.sample.id } })).toEqual(f.sample);
    // Printing creates no analytical, QC, workflow or generic audit mutations.
    const after = await f.snapshot();
    expect(after.filter((_, index) => index !== 5)).toEqual(before.filter((_, index) => index !== 5));
});

test('a stale first-print preview cannot bypass reason enforcement, including competing print requests', async () => {
    const f = await fixture();
    const input = { items: [f.item], format: 'STANDARD' };
    expect((await labels.preview(f.db, f.actor, input))[0].reprint).toBe(false);
    const outcomes = await Promise.allSettled([labels.print(f.db, f.actor, input), labels.print(f.db, f.actor, input)]);
    expect(outcomes.filter(row => row.status === 'fulfilled')).toHaveLength(1);
    const refusal = outcomes.find(row => row.status === 'rejected').reason;
    expect([400, 409]).toContain(refusal.statusCode); expect(refusal.code).toBeDefined();
    expect(await f.db.labelPrintEvent.count()).toBe(1);
    await expect(labels.print(f.db, f.actor, input)).rejects.toMatchObject({ code: 'LABEL_REPRINT_REASON_REQUIRED' });
});

test.each([null, {}, { items: [] }, { items: [{ entity: 'SAMPLE', entityId: 'x', count: 0 }] },
    { items: [{ entity: 'SAMPLE', entityId: 'x', count: 1.5 }] }, { items: [{ entity: 'ALIQUOT', entityId: 'x', count: 1 }] },
    { items: [{ entity: 'SAMPLE', entityId: 'x', count: 1, code: 'invented' }] }])('invalid print commands are stable 400s: %j', async input => {
    const f = await fixture();
    await expect(labels.print(f.db, f.actor, input)).rejects.toMatchObject({ statusCode: 400, code: 'LABEL_PRINT_FIELDS_INVALID' });
    expect(await f.db.labelPrintEvent.count()).toBe(0);
});

test('the actual routes enforce role/scope, return localized stable refusals, and never trust supplied codes', async () => {
    const f = await fixture(); let router;
    jest.isolateModules(() => { jest.doMock('../../prisma', () => f.db); router = require('../../routes/sampleRoutes'); });
    const app = express(); app.use(express.json());
    app.use((req, res, next) => { req.user = req.headers['x-viewer'] ? { ...f.actor, role: 'AUDIT_USER' } : req.headers['x-foreign'] ? { ...f.actor, role: 'LAB_TECHNICIAN', labId: randomUUID() } : f.actor; next(); });
    app.use('/api/samples', router);
    const input = { items: [f.item], format: 'STANDARD' };
    expect((await request(app).post('/api/samples/labels/print').set('x-viewer', '1').send(input)).status).toBe(403);
    const foreign = await request(app).post('/api/samples/labels/preview').set('x-foreign', '1').send(input);
    expect(foreign.status).toBe(403); expect(foreign.body.code).toBeDefined();
    const first = await request(app).post('/api/samples/labels/print').send(input);
    expect(first.status).toBe(200); expect(first.body.events[0].code).toBe(f.sample.labSampleCode);
    const refused = await request(app).post('/api/samples/labels/print').set('accept-language', 'fr').send(input);
    expect(refused.status).toBe(400); expect(refused.body.code).toBe('LABEL_REPRINT_REASON_REQUIRED');
    expect(refused.body.error).toBe(require('../../locales/fr.json').labelPrint.errors.LABEL_REPRINT_REASON_REQUIRED);
    expect(await f.db.labelPrintEvent.count()).toBe(1);
});

test('missing permanent codes refuse printing; historical issued codes retain their exact bytes', async () => {
    const f = await fixture();
    const missing = { entity: 'SAMPLE', entityId: f.items[0].sampleId, count: 1 };
    await expect(labels.print(f.db, f.actor, { items: [missing], format: 'STANDARD' })).rejects.toMatchObject({ code: 'LABEL_PRINT_CODE_REQUIRED', statusCode: 409 });
    const historical = await createSampleFixture(f.db, { data: { id: randomUUID(), originalId: randomUUID(), assignedLab: f.labId, labId: 'Legacy-0042', status: 'PROCESSING' } });
    const printed = await labels.print(f.db, f.actor, { items: [{ entity: 'SAMPLE', entityId: historical.id, count: 1 }], format: 'STANDARD' });
    expect(printed.events[0].code).toBe('Legacy-0042');
    expect(await f.db.sample.findUnique({ where: { id: historical.id } })).toEqual(historical);
});

test('ambiguous historical lab-like values refuse labels while keeping the scoped workspace available for review', async () => {
    const f = await fixture();
    const ambiguous = await createSampleFixture(f.db, { data: { id: randomUUID(), originalId: randomUUID(), assignedLab: f.labId, labId: ' label-lab ', status: 'PROCESSING' } });
    await expect(labels.print(f.db, f.actor, { items: [{ entity: 'SAMPLE', entityId: ambiguous.id, count: 1 }], format: 'STANDARD' }))
        .rejects.toMatchObject({ statusCode: 409, code: 'AMBIGUOUS_LAB_OR_CODE' });
    let workspace;
    jest.isolateModules(() => { jest.doMock('../../prisma', () => f.db); workspace = require('../../services/sampleWorkspaceService'); });
    const view = await workspace.getSampleWorkspace(ambiguous.id, f.actor);
    expect(view.identity.labSampleCode).toBe('Not assigned');
    expect(view.capabilities.canPrintLabel).toEqual({ allowed: false, code: 'AMBIGUOUS_LAB_OR_CODE' });
    expect(await f.db.sample.findUnique({ where: { id: ambiguous.id } })).toEqual(ambiguous);
    expect(await f.db.labelPrintEvent.count()).toBe(0);
});

test('database guards retain print evidence and refuse code substitution, invalid copies and missing reprint reasons', async () => {
    const f = await fixture();
    await labels.print(f.db, f.actor, { items: [f.item], format: 'STANDARD' });
    raw(f, db => {
        expect(() => db.prepare('UPDATE LabelPrintEvent SET reason=?').run('rewritten')).toThrow(/LABEL_PRINT_EVENT_IMMUTABLE/);
        expect(() => db.prepare('DELETE FROM LabelPrintEvent').run()).toThrow(/LABEL_PRINT_EVENT_IMMUTABLE/);
        const insert = db.prepare('INSERT INTO LabelPrintEvent(id,entity,entityId,sampleId,code,count,ordinal,format,reason,by) VALUES(?,?,?,?,?,?,?,?,?,?)');
        for (const [code, count, reason] of [[f.sample.labSampleCode, 1, null], ['forged', 1, 'reason'], [f.sample.labSampleCode, 0, 'reason']]) {
            expect(() => insert.run(randomUUID(), 'SAMPLE', f.sample.id, f.sample.id, code, count, 2, 'STANDARD', reason, f.actor.username)).toThrow(/LABEL_PRINT_EVENT_INVALID/);
        }
    });
    expect(await f.db.labelPrintEvent.count()).toBe(1);
});

test('additive installer dry-run/apply/no-op preserves old evidence and refuses incomplete or unmarked storage', async () => {
    const f = await fixture(false), before = await f.snapshot();
    const digest = () => createHash('sha256').update(fs.readFileSync(f.file)).digest('hex');
    const initial = digest();
    expect(installLabelPrintEvents({ dbPath: f.file })).toMatchObject({ mode: 'DRY_RUN', classification: 'PRE_208', totalChanges: 0 });
    expect(digest()).toBe(initial);
    expect(() => assertLabelPrintStartupReady(f.file)).toThrow(/reviewed/);
    expect(installLabelPrintEvents({ dbPath: f.file, apply: true })).toMatchObject({ mode: 'APPLIED', backfilledCount: 0, receipt: { originalRowsPreserved: true } });
    expect(await f.snapshot()).toEqual(before);
    expect(installLabelPrintEvents({ dbPath: f.file, apply: true })).toMatchObject({ mode: 'NO_OP', totalChanges: 0 });
    expect(assertLabelPrintStartupReady(f.file).classification).toBe('COMPLETE_208');
    raw(f, db => db.prepare("UPDATE _schema_migrations SET details='{}' WHERE id='208_label_print_events'").run());
    expect(() => installLabelPrintEvents({ dbPath: f.file, apply: true })).toThrow(/differs/);
    const release = loadLabelPrintMigrationSource();
    const fresh = await fixture(false);
    raw(fresh, db => db.exec(release.schemaSql));
    expect(installLabelPrintEvents({ dbPath: fresh.file, apply: true })).toMatchObject({ mode: 'APPLIED', previousClassification: 'FRESH_PRISMA_208' });
    const populated = await fixture(false);
    raw(populated, db => {
        db.exec(release.schemaSql);
        db.prepare("INSERT INTO LabelPrintEvent(id,entity,entityId,sampleId,code,count,ordinal,format,by) VALUES('unmarked','SAMPLE',?,?,?,1,1,'STANDARD','fixture')").run(populated.sample.id, populated.sample.id, populated.sample.labSampleCode);
    });
    expect(() => installLabelPrintEvents({ dbPath: populated.file, apply: true })).toThrow(/differs/);
});

test('the workflow scanner inspects pinned label DDL and refuses altered source without granting workflow writes', () => {
    const { scanSource } = require('../helpers/workflowWriteScanner');
    const source = "const {loadLabelPrintMigrationSource}=require('../services/labelPrintMigrationSource'); const release=loadLabelPrintMigrationSource(); db.exec(release.sql);";
    expect(scanSource(source, 'scripts/probe.js')).toEqual([]);
    expect(scanSource(source + 'db.exec("UPDATE Sample SET status=1");', 'scripts/probe.js')).toEqual([expect.objectContaining({ code: 'RAW_WORKFLOW_SQL' })]);
    const read = fs.readFileSync, loader = require('node:path').resolve(__dirname, '../../services/labelPrintMigrationSource.js');
    const spy = jest.spyOn(fs, 'readFileSync').mockImplementation((file, ...args) => {
        const bytes = read(file, ...args);
        return require('node:path').resolve(String(file)) === loader ? Buffer.from(String(bytes) + '\n// changed\n') : bytes;
    });
    try { expect(scanSource(source, 'scripts/probe.js')).toEqual([expect.objectContaining({ code: 'UNRESOLVED_WORKFLOW_SQL' })]); }
    finally { spy.mockRestore(); }
});
