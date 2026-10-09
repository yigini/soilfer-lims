const { randomUUID } = require('node:crypto');
const request = require('supertest');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { withQcRunHttp } = require('../helpers/qcRunHttpHarness');
const { buildNativeRun, startNativeRun } = require('../../services/qcNativeRunService');
const { writeNativeMeasurements } = require('../../services/qcNativeMeasurementService');
const { reopenNativeRun } = require('../../services/qcNativeLifecycleService');
const { mutateQcRun } = require('../../services/qcRunMutationService');
const { dispositionBatch } = require('../../services/qcDispositionStateService');
const { linkReagentLot, withdrawReagentLot } = require('../../services/batchReagentLotService');
const { readQcRun } = require('../../services/qcRunViewService');
const owned = [];
async function fixture(options = {}) {
    const f = await qcGateFixture({ criteria: { blankPerBatch: 1, lrmPerBatch: 0, duplicateEvery: 0, crmEveryNBatches: 0 }, ...options });
    owned.push(f);
    f.run = await buildNativeRun(f.db, f.actor, f.input);
    f.lot = await lot(f);
    return f;
}
async function lot(f, data = {}) {
    const inventoryItemId = randomUUID(), labId = data.labId || f.labId;
    await f.db.inventoryItem.create({ data: { id: inventoryItemId, labId, itemType: 'REAGENT', name: 'Owned extractant', unitOfMeasure: 'mL' } });
    return f.db.inventoryLot.create({ data: { id: randomUUID(), inventoryItemId, labId, lotNumber: randomUUID(),
        initialQuantity: 100, currentQuantity: 100, unitOfMeasure: 'mL', expiryDate: new Date('2099-01-01'), ...data } });
}
async function snapshot(f) {
    return JSON.parse(JSON.stringify(await Promise.all([f.snapshot(), f.db.batchReagentLot.findMany({ orderBy: { id: 'asc' } }),
        f.db.inventoryLot.findMany({ orderBy: { id: 'asc' } }), f.db.batch.findMany({ orderBy: { id: 'asc' } }),
        f.db.batchAnalyte.findMany({ orderBy: { id: 'asc' } })])));
}
async function evaluate(f, value = 0.01, analysisCode = f.analysisCode) {
    const batch = await readQcRun(f.db, f.run.id, f.actor);
    return writeNativeMeasurements(f.db, f.run.id, f.actor, { analysisCode,
        measurements: batch.positions.filter(row => row.kind === 'BLANK').map(row => ({ positionId: row.id, value })) });
}
afterEach(async () => { for (const f of owned.splice(0)) await f.close(); });

test('authenticated link creates retained evidence and old/new audit; identical retry is a 200 zero-write no-op', async () => {
    const f = await fixture(), inventory = await f.db.inventoryLot.findUnique({ where: { id: f.lot.id } });
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const path = `/api/qc/batches/${f.run.id}/reagent-lots`, auth = { Authorization: `Bearer ${token}` };
        const first = await request(app).post(path).set(auth).send({ inventoryLotId: f.lot.id, role: 'extractant' });
        expect(first.status).toBe(201);
        expect(first.body.link).toMatchObject({ batchId: f.run.id, labId: f.labId, inventoryLotId: f.lot.id, role: 'extractant', linkedBy: f.actor.username });
        const events = await f.db.batchEvent.findMany({ where: { batchId: f.run.id, type: 'REAGENT_LOT_LINKED' } });
        expect(events).toHaveLength(1);
        const audit = await f.db.auditLog.findFirst({ where: { entityId: f.run.id, action: 'QC_EVIDENCE_SNAPSHOT' }, orderBy: { timestamp: 'desc' } });
        expect(JSON.parse(audit.details).changes).toEqual(expect.arrayContaining([
            expect.objectContaining({ entity: 'BatchReagentLot', before: null, after: expect.objectContaining({ inventoryLotId: f.lot.id }) })
        ]));
        const before = await snapshot(f);
        const retry = await request(app).post(path).set(auth).send({ inventoryLotId: f.lot.id, role: 'extractant' });
        expect(retry.status).toBe(200); expect(retry.body).toMatchObject({ created: false, link: { id: first.body.link.id } });
        expect(await snapshot(f)).toEqual(before);
        const conflict = await request(app).post(path).set(auth).send({ inventoryLotId: f.lot.id, role: 'different' });
        expect(conflict.status).toBe(409); expect(conflict.body).toMatchObject({ code: 'REAGENT_LOT_LINK_CONFLICT', existingRole: 'extractant' });
        expect(await snapshot(f)).toEqual(before);
    });
    expect(await f.db.inventoryLot.findUnique({ where: { id: f.lot.id } })).toEqual(inventory);
});
test.each(['foreign', 'QUARANTINED', 'EXPIRED', 'expired-date', 'missing'])('%s lot refuses stable 422 and zero writes', async kind => {
    const f = await fixture(); let selected = f.lot.id;
    if (kind === 'foreign') {
        const labId = randomUUID(); await f.db.lab.create({ data: { id: labId, code: labId, name: 'Foreign fixture', country: 'TEST' } });
        selected = (await lot(f, { labId })).id;
    } else if (kind === 'expired-date') selected = (await lot(f, { expiryDate: new Date('2000-01-01') })).id;
    else if (kind === 'missing') selected = 'missing-lot';
    else selected = (await lot(f, { status: kind })).id;
    const before = await snapshot(f);
    await expect(linkReagentLot(f.db, f.run.id, f.actor, { inventoryLotId: selected })).rejects.toMatchObject({ statusCode: 422, code: 'REAGENT_LOT_UNAVAILABLE' });
    expect(await snapshot(f)).toEqual(before);
});
test('OPEN withdrawal retains its row, hides only the header link, and retries/relinks never change evidence', async () => {
    const f = await fixture();
    const first = await linkReagentLot(f.db, f.run.id, f.actor, { inventoryLotId: f.lot.id });
    const withdrawn = await withdrawReagentLot(f.db, f.run.id, f.actor, { inventoryLotId: f.lot.id, reason: 'Wrong bottle selected before start' });
    expect(withdrawn.event).toMatchObject({ type: 'REAGENT_LOT_WITHDRAWN', by: f.actor.username });
    expect(JSON.parse(withdrawn.event.payload)).toMatchObject({ linkId: first.link.id, inventoryLotId: f.lot.id, reason: 'Wrong bottle selected before start' });
    const view = await readQcRun(f.db, f.run.id, f.actor);
    expect(view.reagentLots).toEqual([]); expect(view.retainedReagentLots).toHaveLength(1);
    const before = await snapshot(f);
    expect(await withdrawReagentLot(f.db, f.run.id, f.actor, { inventoryLotId: f.lot.id })).toMatchObject({ created: false, event: { id: withdrawn.event.id } });
    await expect(linkReagentLot(f.db, f.run.id, f.actor, { inventoryLotId: f.lot.id })).rejects.toMatchObject({ code: 'REAGENT_LOT_WITHDRAWN', statusCode: 409 });
    expect(await snapshot(f)).toEqual(before);
    await startNativeRun(f.db, f.run.id, f.actor);
    const started = await snapshot(f);
    await expect(withdrawReagentLot(f.db, f.run.id, f.actor, { inventoryLotId: f.lot.id })).rejects.toMatchObject({ code: 'QC_BATCH_LOCKED', statusCode: 409 });
    expect(await snapshot(f)).toEqual(started);
});
test.each(['IN_RUN', 'reopened', 'mixed'])('a new lot links while %s, without changing frozen run context or inventory', async state => {
    const f = await fixture(state === 'mixed' ? { count: 2, sharedSample: true } : {});
    await startNativeRun(f.db, f.run.id, f.actor);
    if (state !== 'IN_RUN') await evaluate(f);
    if (state === 'reopened') await reopenNativeRun(f.db, f.run.id, f.actor, 'Resume the same analyst session');
    const before = await readQcRun(f.db, f.run.id, f.actor);
    if (state === 'mixed') expect(before.analytes.map(row => row.status).sort()).toEqual(['IN_RUN', 'QC_PASS']);
    if (state === 'reopened') expect(before.analytes[0].status).toBe('QC_PENDING');
    const result = await linkReagentLot(f.db, f.run.id, f.actor, { inventoryLotId: f.lot.id, role: 'replacement bottle' });
    expect(result.created).toBe(true);
    const after = await readQcRun(f.db, f.run.id, f.actor);
    expect(after).toMatchObject({ instrumentId: before.instrumentId, analystUsername: before.analystUsername, startedAt: before.startedAt });
    expect(after.analytes.map(row => row.criteriaSnapshot)).toEqual(before.analytes.map(row => row.criteriaSnapshot));
    expect((await f.db.inventoryLot.findUnique({ where: { id: f.lot.id } })).currentQuantity).toBe(100);
    const frozen = await snapshot(f);
    await expect(withdrawReagentLot(f.db, f.run.id, f.actor, { inventoryLotId: f.lot.id, reason: 'After start' })).rejects.toMatchObject({ statusCode: 409, code: 'QC_BATCH_LOCKED' });
    expect(await snapshot(f)).toEqual(frozen);
});
test.each(['QC_FAIL', 'REJECTED', 'REPEAT_ORDERED', 'CLOSED', 'disposition', 'fully-evaluated'])('%s state takes precedence over invalid lot and refuses with zero writes', async state => {
    const f = await fixture(); await startNativeRun(f.db, f.run.id, f.actor);
    await evaluate(f, ['CLOSED', 'fully-evaluated'].includes(state) ? 0.01 : 10);
    if (['REJECTED', 'REPEAT_ORDERED', 'disposition'].includes(state)) await dispositionBatch(f.run.id,
        state === 'REJECTED' ? 'REJECT' : state === 'REPEAT_ORDERED' ? 'REPEAT_BATCH' : 'ACCEPT_WITH_DEVIATION', 'Reviewed retained failure', f.actor, f.db);
    if (state === 'CLOSED') await mutateQcRun(f.db, f.run.id, f.actor, { status: 'CLOSED' });
    const before = await snapshot(f);
    await expect(linkReagentLot(f.db, f.run.id, f.actor, { inventoryLotId: 'missing-lot' })).rejects.toMatchObject({ statusCode: 409, code: 'QC_BATCH_LOCKED' });
    expect(await snapshot(f)).toEqual(before);
});
test.each(['identical', 'different-role', 'withdrawn'])('an actual unique-index conflict is reread inside the command: %s', async scenario => {
    const f = await fixture();
    await linkReagentLot(f.db, f.run.id, f.actor, { inventoryLotId: f.lot.id, role: 'extractant' });
    if (scenario === 'withdrawn') await withdrawReagentLot(f.db, f.run.id, f.actor, { inventoryLotId: f.lot.id, reason: 'Retain withdrawal' });
    const before = await snapshot(f); let staleRead = true, conflicts = 0;
    const concurrent = { $transaction: execute => f.db.$transaction(tx => execute(new Proxy(tx, { get(target, key) {
        if (key !== 'batchReagentLot') return Reflect.get(target, key);
        return { ...tx.batchReagentLot,
            findUnique: args => staleRead ? (staleRead = false, Promise.resolve(null)) : tx.batchReagentLot.findUnique(args),
            create: async args => { try { return await tx.batchReagentLot.create(args); } catch (error) { if (error.code === 'P2002') conflicts++; throw error; } }
        };
    } }))) };
    const result = linkReagentLot(concurrent, f.run.id, f.actor, { inventoryLotId: f.lot.id, role: scenario === 'different-role' ? 'changed' : 'extractant' });
    if (scenario === 'identical') await expect(result).resolves.toMatchObject({ created: false });
    else await expect(result).rejects.toMatchObject({ statusCode: 409, code: scenario === 'withdrawn' ? 'REAGENT_LOT_WITHDRAWN' : 'REAGENT_LOT_LINK_CONFLICT' });
    expect(conflicts).toBe(1); expect(await snapshot(f)).toEqual(before); expect(await f.db.batchReagentLot.count()).toBe(1);
});
test('a late event fault rolls back the newly inserted link and its audit', async () => {
    const f = await fixture(), before = await snapshot(f);
    const faulty = { $transaction: execute => f.db.$transaction(tx => execute(new Proxy(tx, { get(target, key) {
        if (key !== 'batchEvent') return Reflect.get(target, key);
        return { ...tx.batchEvent, create: args => {
            if (args.data.type === 'REAGENT_LOT_LINKED') throw new Error('OWNED_LATE_EVENT_FAULT');
            return tx.batchEvent.create(args);
        } };
    } }))) };
    await expect(linkReagentLot(faulty, f.run.id, f.actor, { inventoryLotId: f.lot.id })).rejects.toThrow('OWNED_LATE_EVENT_FAULT');
    expect(await snapshot(f)).toEqual(before);
});
test('direct calls retain role and lab checks with zero writes', async () => {
    const f = await fixture(), before = await snapshot(f);
    await expect(linkReagentLot(f.db, f.run.id, { ...f.actor, role: 'UNKNOWN' }, { inventoryLotId: f.lot.id })).rejects.toMatchObject({ statusCode: 403, code: 'QC_RUN_PERMISSION_REQUIRED' });
    await expect(withdrawReagentLot(f.db, f.run.id, { ...f.actor, role: 'UNKNOWN' }, { inventoryLotId: f.lot.id })).rejects.toMatchObject({ statusCode: 403 });
    const foreign = { ...f.actor, role: 'LAB_TECHNICIAN', labId: randomUUID() };
    await expect(linkReagentLot(f.db, f.run.id, foreign, { inventoryLotId: f.lot.id })).rejects.toMatchObject({ statusCode: 403 });
    expect(await snapshot(f)).toEqual(before);
});
