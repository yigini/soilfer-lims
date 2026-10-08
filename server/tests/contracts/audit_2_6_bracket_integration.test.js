const { randomUUID } = require('node:crypto');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { buildNativeRun, startNativeRun } = require('../../services/qcNativeRunService');
const { writeNativeMeasurements } = require('../../services/qcNativeMeasurementService');
const { dispositionBatch } = require('../../services/qcDispositionStateService');
const owned = [];
const wire = value => JSON.parse(JSON.stringify(value));

async function fixture() {
    const f = await qcGateFixture({ count: 30, criteria: { maxBatchSize: 40, blankPerBatch: 0,
        lrmPerBatch: 0, duplicateEvery: 0, ccvEvery: 10 } });
    owned.push(f);
    await f.setPolicy([{ key: 'qc.calibrationVerification', value: true }]);
    const lot = await f.db.referenceMaterial.create({ data: { id: randomUUID(), labId: f.labId,
        code: randomUUID(), name: 'Owned combined audit standard', kind: 'CHECK_STANDARD', matrix: 'SOIL',
        lotNumber: 'owned', status: 'ACTIVE', createdBy: f.actor.username } });
    await f.db.referenceValue.create({ data: { id: randomUUID(), referenceMaterialId: lot.id,
        analysisCode: f.analysisCode, assignedValue: 7, unit: 'fixture-unit', valueType: 'LAB_ASSIGNED', createdBy: f.actor.username } });
    const built = await buildNativeRun(f.db, f.actor, { ...f.input, analyses: [{ analysisCode: f.analysisCode,
        references: ['ICV', 'CCV'].map(positionKind => ({ positionKind, referenceMaterialLotId: lot.id })) }] });
    f.run = await startNativeRun(f.db, built.id, f.actor);
    f.items = await f.db.workItem.findMany({ orderBy: { rackPosition: 'asc' } });
    await writeNativeMeasurements(f.db, f.run.id, f.actor, { measurements: f.run.positions
        .filter(row => row.kind !== 'SAMPLE').map(row => ({ positionId: row.id,
            value: row.position === 25 ? 10 : row.kind === 'CCB' ? 0.01 : 7 })) });
    return f;
}
const decide = f => dispositionBatch(f.run.id, 'REPEAT_BRACKET', 'Reviewed failing calibration bracket',
    f.actor, f.db, { analysisCode: f.analysisCode });
afterAll(async () => { for (const f of owned) await f.close(); });

test('REPEAT_BRACKET freezes scope and changed states in one matching QC audit/event pair', async () => {
    const f = await fixture();
    const sealed = f.items.find(row => row.rackPosition === 20);
    for (const status of ['COMPLETED', 'SUBMITTED', 'ACCEPTED']) await require('../../services/workItemStateService')
        .transitionWorkItem(sealed.id, status, f.actor, 'Owned prior review', {}, f.db);
    const beforeItems = wire(await f.db.workItem.findMany({ orderBy: { id: 'asc' } }));
    const before = await f.db.auditLog.findMany({ where: { entityId: f.run.id } });
    const beforeEvents = await f.db.batchEvent.findMany({ where: { batchId: f.run.id, type: 'QC_EVIDENCE_SNAPSHOT' } });
    const response = await decide(f);
    const added = await f.db.auditLog.findMany({ where: { entityId: f.run.id, id: { notIn: before.map(row => row.id) } } });
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ entity: 'QC_BATCH', action: 'QC_DISPOSITION' });
    const details = JSON.parse(added[0].details), scope = response.scopes[f.analysisCode];
    expect(details).toMatchObject({ kind: 'QC_EVIDENCE_SNAPSHOT', operation: 'QC_DISPOSITION',
        canonicalDecision: 'REPEAT_BRACKET', scopes: response.scopes, amendmentRequired: response.amendmentRequired });
    const matching = await f.db.batchEvent.findMany({ where: { batchId: f.run.id, type: 'QC_EVIDENCE_SNAPSHOT',
        id: { notIn: beforeEvents.map(row => row.id) } } });
    expect(matching).toHaveLength(1);
    expect(JSON.parse(matching[0].payload).historyEntry).toEqual(details);
    const saved = await f.db.batchDisposition.findFirst({ where: { batchId: f.run.id } });
    expect(JSON.parse(saved.scope)).toEqual(scope);
    expect(details.changes.filter(row => row.entity === 'BatchDisposition')).toEqual([
        expect.objectContaining({ id: saved.id, before: null, after: expect.objectContaining({ scope: saved.scope }) })]);
    const mutable = scope.affectedWorkItemIds.filter(id => id !== sealed.id);
    expect(mutable).toHaveLength(9);
    expect(details.changes.filter(row => row.entity === 'WorkItem').map(row => row.id).sort()).toEqual([...mutable].sort());
    for (const id of mutable) expect(details.changes.find(row => row.entity === 'WorkItem' && row.id === id))
        .toMatchObject({ before: { status: 'IN_PROGRESS' }, after: { status: 'REPEAT_REQUIRED' } });
    const afterItems = wire(await f.db.workItem.findMany({ orderBy: { id: 'asc' } }));
    for (const row of beforeItems.filter(item => !mutable.includes(item.id))) expect(afterItems.find(item => item.id === row.id)).toEqual(row);
    expect(await f.db.auditLog.count({ where: { entity: 'WORKITEM', entityId: { in: mutable }, action: 'REANALYZE_BATCH' } })).toBe(mutable.length);
    const snapshot = await f.snapshot();
    expect(await decide(f)).toMatchObject({ idempotent: true });
    expect(await f.snapshot()).toEqual(snapshot);
});

test('late snapshot event failure rolls back scope, bracket states, audit and operation event together', async () => {
    const f = await fixture(), before = await f.snapshot();
    const original = f.db.$transaction.bind(f.db);
    const fault = jest.spyOn(f.db, '$transaction').mockImplementation((execute, ...options) => original(async tx => {
        const create = tx.batchEvent.create.bind(tx.batchEvent);
        tx.batchEvent.create = args => args.data.type === 'QC_EVIDENCE_SNAPSHOT'
            ? Promise.reject(new Error('Owned snapshot event fault')) : create(args);
        return execute(tx);
    }, ...options));
    try { await expect(decide(f)).rejects.toThrow('Owned snapshot event fault'); }
    finally { fault.mockRestore(); }
    expect(await f.snapshot()).toEqual(before);
    expect(await f.db.batchDisposition.count({ where: { batchId: f.run.id } })).toBe(0);
});
