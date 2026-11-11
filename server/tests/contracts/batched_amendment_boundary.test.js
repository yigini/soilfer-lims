const { randomUUID } = require('node:crypto');
const request = require('supertest');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const { withQcRunHttp } = require('../helpers/qcRunHttpHarness');
const { registerRootClient } = require('../../utils/prismaClientIdentity');
const { inTransaction } = require('../../services/workflowStateRules');
const commands = require('../../services/sampleAmendmentCommandService');
const owned = [];
afterEach(async () => { for (const f of owned.splice(0)) await f.close(); });

async function acceptedBatchedFixture() {
    const f = await qcGateFixture({ count: 2, sharedSample: true,
        criteria: { blankPerBatch: 1, lrmPerBatch: 0, duplicateEvery: 0, crmEveryNBatches: 0, ccvEvery: 0 } });
    owned.push(f);
    await f.setPolicy([{ key: 'results.replicatesRequired', value: 1 }]);
    const native = require('../../services/qcNativeRunService');
    f.run = await native.buildNativeRun(f.db, f.actor, f.input);
    f.run = await native.startNativeRun(f.db, f.run.id, f.actor);
    for (const item of f.items) {
        await inTransaction(f.db, tx => require('../../services/resultWriteService').writeResultsExecution(tx, {
            sampleId: item.sampleId, workItemId: item.id, actor: f.actor,
            measurements: [{ param: item.analysis, value: '7.1', replicateNo: 1, equipmentId: f.instrument.id }]
        }));
        await require('../../services/qcNativeMeasurementService').writeNativeMeasurements(f.db, f.run.id, f.actor, {
            analysisCode: item.analysis,
            measurements: [{ positionId: f.run.positions.find(row => row.kind === 'BLANK').id, value: 0 }]
        });
        await require('../../services/workItemStateService').transitionWorkItem(item.id, 'COMPLETED', f.actor, 'Owned reading complete', {}, f.db);
    }
    await require('../../services/submissionStateService').createSubmissionForItems({ db: f.db, actor: f.actor,
        sampleId: f.items[0].sampleId, type: 'FULL', workItemIds: f.workItemIds });
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        for (const item of f.items) {
            const response = await request(app).post('/api/work/' + item.id + '/review')
                .set('Authorization', 'Bearer ' + token).send({ decision: 'ACCEPT' });
            expect({ status: response.status, body: response.body }).toMatchObject({ status: 200 });
        }
        const approval = await request(app).post('/api/samples/' + f.items[0].sampleId + '/approve')
            .set('Authorization', 'Bearer ' + token);
        expect({ status: approval.status, body: approval.body }).toMatchObject({ status: 200 });
    }, { reviews: true, samples: true });
    const authoriser = await f.db.user.create({ data: { id: randomUUID(), username: 'boundary-authoriser-' + randomUUID(),
        email: randomUUID() + '@example.test', password: 'owned-http-fixture', role: 'LAB_MANAGER', labId: f.labId } });
    f.authoriser = { id: authoriser.id, username: authoriser.username, role: authoriser.role, labId: f.labId };
    const sample = await createSampleFixture(f.db, { data: { id: randomUUID(), originalId: randomUUID(),
        assignedLab: f.labId, status: 'PROCESSING', dryingStatus: 'DONE', preparationStatus: 'DONE' } });
    const spare = await createWorkItemFixture(f.db, { data: { id: randomUUID(), sampleId: sample.id, labId: f.labId,
        analysis: f.items[0].analysis, methodologyId: f.methods[0].id, status: 'IN_PROGRESS', history: '[]' } });
    await inTransaction(f.db, tx => require('../../services/orderService').createInitialOrder(tx, sample, [spare.analysis], f.actor));
    f.target = await native.buildNativeRun(f.db, f.actor, { ...f.input, workItemIds: [spare.id] });
    expect(f.target).toMatchObject({ status: 'OPEN', startedAt: null });
    const { amendment } = await commands.command(f.db, { sampleId: f.items[0].sampleId, actor: f.actor, input: {
        type: 'SCIENTIFIC', reason: 'Owned client retest', reasonCode: 'CLIENT_RETEST',
        selectedWorkItemIds: [f.items[0].id], idempotencyKey: randomUUID()
    } });
    f.amendment = amendment;
    return f;
}

async function snapshot(tx) {
    const tables = await tx.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    const rows = {};
    for (const { name } of tables) rows[name] = await tx.$queryRawUnsafe('SELECT * FROM "' + name.replaceAll('"', '""') + '" ORDER BY rowid');
    return rows;
}

// Observe the exact authorisation transaction immediately before its real item
// update. All model reads, command capabilities and installed SQL remain active.
function observeAuthorisedUpdate(f, inspect) {
    let observed = 0;
    const adapter = registerRootClient(new Proxy(f.db, { get(root, key) {
        if (key === '$transaction') return execute => root.$transaction(async tx => {
            const workItem = new Proxy(tx.workItem, { get(delegate, method) {
                if (method === 'updateMany') return async args => {
                    if (args.where.id === f.items[0].id && args.data.status === 'REPEAT_REQUIRED') {
                        observed++;
                        await inspect(tx);
                    }
                    return delegate.updateMany(args);
                };
                const value = Reflect.get(delegate, method);
                return typeof value === 'function' ? value.bind(delegate) : value;
            } });
            const observedTx = new Proxy(tx, { get(client, property) {
                if (property === 'workItem') return workItem;
                const value = Reflect.get(client, property);
                return typeof value === 'function' ? value.bind(client) : value;
            } });
            return execute(observedTx);
        });
        const value = Reflect.get(root, key);
        return typeof value === 'function' ? value.bind(root) : value;
    } }));
    return { adapter, observed: () => observed };
}

test.each(['open-batch', 'unreleased-analyte', 'unselected-item', 'retained-rack'])(
    'an APPROVED scientific amendment refuses %s with every row unchanged', async scenario => {
        const f = await acceptedBatchedFixture();
        const observer = observeAuthorisedUpdate(f, async tx => {
            const approved = await tx.sampleAmendment.findUnique({ where: { id: f.amendment.id } });
            expect(approved).toMatchObject({ status: 'APPROVED', version: 2, selectedWorkItemIds: JSON.stringify([f.items[0].id]) });
            expect(await tx.sampleAmendmentAttempt.count({ where: { amendmentId: approved.id } })).toBe(1);
            expect(await tx.workItem.findUnique({ where: { id: f.items[0].id } }))
                .toMatchObject({ status: 'ACCEPTED', batchId: f.run.id });
            // This disposable negative context changes no guard or approval fact.
            if (scenario === 'unreleased-analyte') await tx.$executeRawUnsafe(
                'UPDATE BatchAnalyte SET status=? WHERE batchId=? AND analysisCode=?', 'QC_FAIL', f.run.id, f.items[0].analysis);
            const before = await snapshot(tx);
            const id = scenario === 'unselected-item' ? f.items[1].id : f.items[0].id;
            await expect(tx.$executeRawUnsafe(
                'UPDATE WorkItem SET status=?,batchId=?,rackPosition=? WHERE id=?',
                'REPEAT_REQUIRED', scenario === 'open-batch' ? f.target.id : null,
                scenario === 'retained-rack' ? 1 : null, id)).rejects.toThrow('BATCH_MEMBERSHIP_FROZEN');
            expect(await snapshot(tx)).toEqual(before);
            if (scenario === 'unreleased-analyte') await tx.$executeRawUnsafe(
                'UPDATE BatchAnalyte SET status=? WHERE batchId=? AND analysisCode=?', 'QC_PASS', f.run.id, f.items[0].analysis);
        });
        const outcome = await commands.command(observer.adapter, { sampleId: f.items[0].sampleId,
            amendmentId: f.amendment.id, actor: f.authoriser, authorise: true,
            input: { expectedVersion: 1, idempotencyKey: randomUUID() } });
        expect(observer.observed()).toBe(1);
        expect(outcome.amendment.status).toBe('APPROVED');
        expect(await f.db.workItem.findUnique({ where: { id: f.items[0].id } }))
            .toMatchObject({ status: 'REPEAT_REQUIRED', batchId: null, rackPosition: null });
        expect(await f.db.workItem.findUnique({ where: { id: f.items[1].id } }))
            .toMatchObject({ status: 'ACCEPTED', batchId: f.run.id });
    });
