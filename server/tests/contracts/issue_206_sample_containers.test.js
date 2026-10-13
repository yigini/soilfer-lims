const { randomUUID, createHash } = require('node:crypto');
const fs = require('node:fs');
const Database = require('better-sqlite3');
const request = require('supertest');
const express = require('express');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const containers = require('../../services/sampleContainerService');
const codes = require('../../services/sampleCodeService');
const rules = require('../../services/workflowStateRules');
const { writeResultsExecution } = require('../../services/resultWriteService');
const { requestRepeat } = require('../../services/workRepeatService');
const { installSampleContainers, assertSampleContainerStartupReady } = require('../../scripts/install_sample_containers');
const { loadSampleContainerMigrationSource } = require('../../services/sampleContainerMigrationSource');
const owned = [];
afterEach(async () => { for (const f of owned.splice(0)) await f.close(); });
async function fixture(options) { const f = await qcGateFixture(options); owned.push(f); return f; }
const create = (f, input, sampleId = f.items[0].sampleId, actor = f.actor) => containers.create(f.db, sampleId, actor, input);
async function hierarchy(f, sampleId = f.items[0].sampleId) {
    const bulk = await create(f, { kind: 'BULK', massG: 500 }, sampleId);
    const fine = await create(f, { kind: 'FINE_EARTH', parentId: bulk.id, massG: 100 }, sampleId);
    const aliquot = await create(f, { kind: 'ALIQUOT', parentId: fine.id, massG: 10 }, sampleId);
    return { bulk, fine, aliquot };
}
const record = (f, aliquotId, value = '7') => rules.inTransaction(f.db, tx => writeResultsExecution(tx, {
    sampleId: f.items[0].sampleId, workItemId: f.items[0].id, actor: f.actor,
    measurements: [{ param: f.analysisCode, value, equipmentId: f.instrument.id, aliquotId }]
}));
function raw(f, exercise) { const db = new Database(f.file); try { return exercise(db); } finally { db.close(); } }
function oldRows(db) {
    return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('SampleContainer','ContainerSequence') ORDER BY name").all().map(({ name }) => {
        const table = '"' + name.replace(/"/g, '""') + '"';
        const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(row => '"' + row.name.replace(/"/g, '""') + '"').join(',');
        return [name, db.prepare(`SELECT ${cols} FROM ${table}${name === '_schema_migrations' ? " WHERE id<>'206_sample_containers'" : ''} ORDER BY ${cols}`).all()];
    });
}

test('bulk → fine earth → aliquot is queryable, labelled by policy and leaves sample numbers unchanged', async () => {
    const f = await fixture();
    const before = await f.db.labSequence.findMany();
    const tree = await hierarchy(f);
    expect(await containers.list(f.db, f.items[0].sampleId, f.actor)).toEqual([tree.bulk, tree.fine, tree.aliquot]);
    expect(tree.fine.parentId).toBe(tree.bulk.id); expect(tree.aliquot.parentId).toBe(tree.fine.id);
    expect(tree.aliquot.createdBy).toBe(f.actor.username);
    for (const row of Object.values(tree)) expect(codes.verifyCheckCharacter(row.code)).toBe(true);
    expect(await f.db.labSequence.findMany()).toEqual(before);
    expect(raw(f, db => db.prepare('SELECT next FROM ContainerSequence').get().next)).toBe(4);
    expect(await f.db.auditLog.count({ where: { action: 'CONTAINER_CREATED' } })).toBe(3);
});
test.each([{ kind: 'ALIQUOT' }, { kind: 'BULK', massG: 0 }, { kind: 'BULK', massG: '1' },
    { kind: 'BULK', massG: Infinity }, { kind: 'BULK', code: 'invented' }, { kind: 'UNKNOWN' }])('invalid input writes neither containers nor counters: %j', async input => {
    const f = await fixture(), before = await f.snapshot();
    await expect(create(f, input)).rejects.toMatchObject({ statusCode: 400, code: 'SAMPLE_CONTAINER_FIELDS_INVALID' });
    expect(await f.snapshot()).toEqual(before);
    expect(await f.db.sampleContainer.count()).toBe(0);
    expect(raw(f, db => db.prepare('SELECT count(*) n FROM ContainerSequence').get().n)).toBe(0);
});
test('scope, role and parent validation refuse both API reads and writes across samples/labs', async () => {
    const f = await fixture({ count: 2 }), tree = await hierarchy(f);
    await expect(create(f, { kind: 'ALIQUOT', parentId: tree.fine.id }, f.items[1].sampleId)).rejects.toMatchObject({ code: 'SAMPLE_CONTAINER_PARENT_INVALID' });
    const foreign = { ...f.actor, role: 'LAB_TECHNICIAN', labId: randomUUID() };
    await expect(containers.list(f.db, f.items[0].sampleId, foreign)).rejects.toMatchObject({ statusCode: 403 });
    await expect(create(f, { kind: 'BULK' }, undefined, foreign)).rejects.toMatchObject({ statusCode: 403 });
    const viewer = { ...f.actor, role: 'AUDIT_USER' };
    let router;
    jest.isolateModules(() => { jest.doMock('../../prisma', () => f.db); router = require('../../routes/sampleRoutes'); });
    jest.dontMock('../../prisma');
    const app = express(); app.use(express.json()); app.use((req, _res, next) => { req.user = viewer; next(); }); app.use('/samples', router);
    const base = '/samples/' + f.items[0].sampleId + '/containers';
    expect((await request(app).get(base)).status).toBe(200);
    expect((await request(app).post(base).send({ kind: 'BULK' })).status).toBe(403);
});
test('SQL rejects foreign parents, alias collisions, invalid kind/mass and changing or deleting identities', async () => {
    const f = await fixture({ count: 2 }), tree = await hierarchy(f);
    raw(f, db => {
        const insert = db.prepare('INSERT INTO SampleContainer(id,sampleId,parentId,kind,code,massG,createdBy) VALUES(?,?,?,?,?,?,?)');
        for (const row of [[randomUUID(), f.items[1].sampleId, tree.bulk.id, 'ALIQUOT', randomUUID(), 1, 'operator'],
            [randomUUID(), f.items[0].sampleId, null, 'OTHER', randomUUID(), 1, 'operator'],
            [randomUUID(), f.items[0].sampleId, null, 'BULK', randomUUID(), -1, 'operator'],
            [randomUUID(), f.items[0].sampleId, null, 'BULK', f.items[0].sampleId, 1, 'operator']])
            expect(() => insert.run(...row)).toThrow(/SAMPLE_CONTAINER_INVALID/);
        expect(() => db.prepare('UPDATE SampleContainer SET parentId=NULL WHERE id=?').run(tree.fine.id)).toThrow(/SAMPLE_CONTAINER_IMMUTABLE/);
        expect(() => db.prepare('DELETE FROM SampleContainer WHERE id=?').run(tree.aliquot.id)).toThrow(/SAMPLE_CONTAINER_IMMUTABLE/);
    });
});
test('transaction rollback returns the counter and container policy collision checks run both ways', async () => {
    const f = await fixture();
    await f.setPolicy([{ key: 'container.codeFormat', value: 'X-{LAB}-{SEQ:3}{CHK}' }, { key: 'container.sequenceReset', value: 'NEVER' }]);
    const before = raw(f, db => db.prepare('SELECT * FROM ContainerSequence').all());
    await expect(rules.inTransaction(f.db, async tx => {
        await codes.allocateContainerCode(tx, { labReference: f.labId }); throw new Error('Rollback');
    })).rejects.toThrow('Rollback');
    expect(raw(f, db => db.prepare('SELECT * FROM ContainerSequence').all())).toEqual(before);
    const container = await create(f, { kind: 'BULK' });
    expect(container.code.startsWith('X-')).toBe(true); expect(codes.verifyCheckCharacter(container.code)).toBe(true);
    await f.setPolicy([{ key: 'sample.codeFormat', value: 'X-{LAB}-{SEQ:3}{CHK}' }, { key: 'sample.sequenceReset', value: 'NEVER' }]);
    const issued = await rules.inTransaction(f.db, tx => codes.allocateSampleCode(tx, { labReference: f.labId }));
    expect(issued).not.toBe(container.code);
    const future = codes.formatCode('X-{LAB}-{SEQ:3}{CHK}', { labCode: f.labId, year: 2026, sequence: 2 });
    await f.db.sample.update({ where: { id: f.items[0].sampleId }, data: { labSampleCode: future } });
    expect((await create(f, { kind: 'BULK' })).code).not.toBe(future);
});
test('initial execution and reserved repeat link the exact aliquot without changing recorded attempts', async () => {
    const f = await fixture(), { aliquot, fine } = await hierarchy(f);
    const [result] = await record(f, aliquot.id);
    const original = await f.db.workAttempt.findUnique({ where: { id: result.attemptId } });
    expect(original.aliquotId).toBe(aliquot.id);
    const next = await create(f, { kind: 'ALIQUOT', parentId: fine.id, massG: 2 });
    const repeated = await requestRepeat(f.db, f.items[0].id, f.actor, { reason: 'PREP_ERROR', aliquotId: next.id });
    const reserved = repeated.attempt;
    expect(reserved.aliquotId).toBe(next.id);
    const before = await f.db.workAttempt.findUnique({ where: { id: original.id } });
    await expect(record(f, aliquot.id)).rejects.toMatchObject({ code: 'SAMPLE_CONTAINER_ALIQUOT_IMMUTABLE' });
    await record(f, next.id, '7.1');
    const filled = await f.db.workAttempt.findUnique({ where: { id: reserved.id } });
    expect(filled).toMatchObject({ status: 'RECORDED', aliquotId: next.id });
    expect(await f.db.workAttempt.findUnique({ where: { id: original.id } })).toEqual(before);
    expect(original.evidenceHash).toBe(before.evidenceHash);
});
test('the additive attempt insert guard refuses foreign/non-aliquot links; future disposal retains recorded linkage', async () => {
    const f = await fixture({ count: 2 }), { aliquot, bulk } = await hierarchy(f);
    const [result] = await record(f, aliquot.id);
    const before = await f.db.workAttempt.findUnique({ where: { id: result.attemptId } });
    raw(f, db => {
        const insert = db.prepare("INSERT INTO WorkAttempt(id,workItemId,attemptNo,aliquotId,status,updatedAt) VALUES(?,?,?,?, 'RECORDED',?)");
        expect(() => insert.run(randomUUID(), f.items[1].id, 1, aliquot.id, Date.now())).toThrow(/SAMPLE_CONTAINER_ALIQUOT_INVALID/);
        expect(() => insert.run(randomUUID(), f.items[1].id, 1, bulk.id, Date.now())).toThrow(/SAMPLE_CONTAINER_ALIQUOT_INVALID/);
        // Detached test-owned fixture simulates a later audited lifecycle
        // successor. #206 itself exposes no disposal mutation or guard bypass.
        db.exec('DROP TRIGGER SampleContainer_no_update');
        db.prepare("UPDATE SampleContainer SET status='DISPOSED' WHERE id=?").run(aliquot.id);
        expect(() => insert.run(randomUUID(), f.items[0].id, 2, aliquot.id, Date.now())).toThrow(/SAMPLE_CONTAINER_ALIQUOT_INVALID/);
    });
    expect(await f.db.workAttempt.findUnique({ where: { id: result.attemptId } })).toEqual(before);
});
test('installer dry/apply/no-op preserve all old rows and schema guards; tampered provenance fails closed', async () => {
    const f = await fixture({ installSampleContainers: false });
    const before = raw(f, oldRows), digest = createHash('sha256').update(fs.readFileSync(f.file)).digest('hex');
    expect(installSampleContainers({ dbPath: f.file })).toMatchObject({ mode: 'DRY_RUN', classification: 'PRE_206', totalChanges: 0 });
    expect(createHash('sha256').update(fs.readFileSync(f.file)).digest('hex')).toBe(digest);
    const applied = installSampleContainers({ dbPath: f.file, apply: true });
    expect(applied).toMatchObject({ mode: 'APPLIED', totalChanges: 1, backfilledCount: 0, receipt: { originalRowsPreserved: true } });
    expect(raw(f, oldRows)).toEqual(before);
    expect(installSampleContainers({ dbPath: f.file, apply: true })).toMatchObject({ mode: 'NO_OP', totalChanges: 0 });
    expect(assertSampleContainerStartupReady(f.file).classification).toBe('COMPLETE_206');
    raw(f, db => db.prepare("UPDATE _schema_migrations SET details='{}' WHERE id='206_sample_containers'").run());
    expect(() => installSampleContainers({ dbPath: f.file, apply: true })).toThrow(/differs/);
    expect(raw(f, oldRows)).toEqual(before);
});
test('an empty fresh Prisma table gains only its counter and guards; an unmarked populated table is refused', async () => {
    const f = await fixture({ installSampleContainers: false });
    const source = loadSampleContainerMigrationSource();
    raw(f, db => db.exec(source.prismaSql));
    expect(installSampleContainers({ dbPath: f.file })).toMatchObject({ classification: 'FRESH_PRISMA_206', totalChanges: 0 });
    const before = raw(f, oldRows);
    expect(installSampleContainers({ dbPath: f.file, apply: true })).toMatchObject({ mode: 'APPLIED', totalChanges: 1 });
    expect(raw(f, oldRows)).toEqual(before);
    const other = await fixture({ installSampleContainers: false });
    raw(other, db => {
        db.exec(source.prismaSql);
        db.prepare("INSERT INTO SampleContainer(id,sampleId,kind,code,createdBy) VALUES(?,?,'BULK',?,'fixture')").run(randomUUID(), other.items[0].sampleId, randomUUID());
    });
    const digest = createHash('sha256').update(fs.readFileSync(other.file)).digest('hex');
    expect(() => installSampleContainers({ dbPath: other.file, apply: true })).toThrow(/differs/);
    expect(createHash('sha256').update(fs.readFileSync(other.file)).digest('hex')).toBe(digest);
});
