const { randomUUID } = require('node:crypto');
const request = require('supertest');
const prisma = require('../../prisma');
const app = require('../../app');
const { createSampleFixture, createWorkItemFixture, createAuthTokenFixture } = require('../helpers/workflowFixtures');
const rules = require('../../services/qcRuleService');
const policies = require('../../services/policyService');
const { buildNativeRun, rebuildNativeRun, startNativeRun } = require('../../services/qcNativeRunService');
const { changeRunMembers } = require('../../services/qcRunMembershipService');
const { reorderNativeRun } = require('../../services/qcRunOrderService');
const { writeNativeMeasurements } = require('../../services/qcNativeMeasurementService');
const { reopenNativeRun } = require('../../services/qcNativeLifecycleService');
const { createProfileRun, writeCompatibilityMeasurements, reopenCompatibilityRun } = require('../../services/qcCompatibilityRunService');
const { correctCompatibilityMeasurements } = require('../../services/qcCompatibilityCorrectionService');
const { dispositionBatch } = require('../../services/qcDispositionStateService');
const { mutateQcRun } = require('../../services/qcRunMutationService');
const wire = value => JSON.parse(JSON.stringify(value));

async function fixture({ advisory = false, blankCount = 1 } = {}) {
    const labId = randomUUID(), analysisCode = `qc26-${randomUUID()}`;
    await prisma.lab.create({ data: { id: labId, code: labId, name: 'Owned QC command lab', country: 'TEST' } });
    const actor = await prisma.user.create({ data: { id: randomUUID(), username: `qc26-${labId}`, email: `${labId}@example.test`,
        password: 'fixture', role: 'SUPER_ADMIN', labId, isActive: true, mustChangePassword: false } });
    await prisma.analysis.create({ data: { code: analysisCode, name: 'Owned audit analyte' } });
    const method = await prisma.methodology.create({ data: { analysisCode, name: 'Owned audit method', loq: 0.001 } });
    const f = { labId, analysisCode, actor, method };
    await rules.change(actor, { labId, analysisCode, methodologyId: method.id, expectedVersion: 0,
        reason: 'Reviewed owned QC criteria', criteria: { blankPerBatch: blankCount, duplicateEvery: 0, lrmPerBatch: 0,
            crmEveryNBatches: 0, blankAbsLimit: 0.05 } });
    if (advisory) await policies.change(actor, labId, { reason: 'Owned advisory run', changes: [{ key: 'qc.mode', value: 'ADVISORY' }] });
    f.member = async (recordMethod = true) => {
        const sampleId = randomUUID();
        await createSampleFixture(prisma, { data: { id: sampleId, originalId: sampleId, assignedLab: labId, labId,
            status: 'PROCESSING', dryingStatus: 'DONE', preparationStatus: 'DONE' } });
        return createWorkItemFixture(prisma, { data: { id: randomUUID(), sampleId, labId, assignedLab: labId,
            analysis: analysisCode, methodologyId: recordMethod ? method.id : null, status: 'IN_PROGRESS' } });
    };
    f.item = await f.member();
    f.build = (ids = [f.item.id]) => buildNativeRun(prisma, actor, { workItemIds: ids, seed: 'owned-qc-audit' });
    return f;
}

// Inspect persisted rows independently of the command's response/collector.
async function stored(batchId) {
    const rows = await Promise.all([
        prisma.qcMeasurement.findMany({ where: { batchId } }), prisma.qcEvaluation.findMany({ where: { batchId } }),
        prisma.batchDisposition.findMany({ where: { batchId } }), prisma.batchAnalyte.findMany({ where: { batchId } }),
        prisma.batchPosition.findMany({ where: { batchId } }),
        prisma.batchPositionWorkItem.findMany({ where: { position: { batchId } } }),
        prisma.batchPositionReference.findMany({ where: { position: { batchId } } })
    ]);
    return wire(Object.fromEntries(['QcMeasurement', 'QcEvaluation', 'BatchDisposition', 'BatchAnalyte', 'BatchPosition',
        'BatchPositionWorkItem', 'BatchPositionReference'].map((name, i) => [name, rows[i]])));
}
async function auditPair(batchId, execute, operation) {
    const before = await stored(batchId), audits = await prisma.auditLog.findMany({ where: { entityId: batchId, entity: { in: ['BATCH', 'QC_BATCH'] } } });
    const events = await prisma.batchEvent.findMany({ where: { batchId, type: 'QC_EVIDENCE_SNAPSHOT' } });
    const result = await execute(), after = await stored(batchId);
    const added = await prisma.auditLog.findMany({ where: { entityId: batchId, entity: { in: ['BATCH', 'QC_BATCH'] }, id: { notIn: audits.map(row => row.id) } } });
    expect(added).toHaveLength(1);
    const details = JSON.parse(added[0].details);
    expect(details).toMatchObject({ kind: 'QC_EVIDENCE_SNAPSHOT', operation });
    const matching = await prisma.batchEvent.findMany({ where: { batchId, type: 'QC_EVIDENCE_SNAPSHOT', id: { notIn: events.map(row => row.id) } } });
    expect(matching).toHaveLength(1); expect(JSON.parse(matching[0].payload).historyEntry).toEqual(details);
    for (const entity of Object.keys(before)) {
        const ids = [...new Set([...before[entity], ...after[entity]].map(row => row.id))];
        for (const id of ids) {
            const old = before[entity].find(row => row.id === id) || null, next = after[entity].find(row => row.id === id) || null;
            if (JSON.stringify(old) === JSON.stringify(next)) continue;
            expect(details.changes.filter(row => row.entity === entity && row.id === id)).toEqual([
                { entity, id, analysisCode: next?.analysisCode ?? old?.analysisCode ?? null, before: old, after: next }
            ]);
        }
    }
    expect(new Set(details.changes.map(row => `${row.entity}:${row.id}`)).size).toBe(details.changes.length);
    expect(details.changes.every(row => JSON.stringify(row.before) !== JSON.stringify(row.after))).toBe(true);
    return { result, audit: added[0], details };
}
const blankReadings = (run, value = 0.01) => run.positions.filter(row => row.kind === 'BLANK').map(row => ({ positionId: row.id, value }));
const compatibilityInput = { blanks: [{ value: 0.01 }], controls: [{ expected: 7, measured: 7 }],
    duplicates: [{ value1: 2, value2: 2.01 }, { value1: 2, value2: 2.01 }] };

test('profile CREATE retains its action and sole audit, with uniform payload and matching snapshot event', async () => {
    const f = await fixture(), id = randomUUID();
    const { result, audit, details } = await auditPair(id, () => createProfileRun(prisma, f.actor,
        { id, analysis: f.analysisCode, profile: 'RACK_40' }), 'CREATE');
    expect(audit).toMatchObject({ entity: 'QC_BATCH', action: 'CREATE' });
    expect(details).toMatchObject({ capacity: 40, snapshot: { status: null }, seq: 1 });
    expect(result.history.find(row => row.kind === 'QC_EVIDENCE_SNAPSHOT')).toEqual(details);
});

test('native build, nested membership rebuild, direct rebuild, reorder and first start each write one complete pair', async () => {
    const f = await fixture(), id = randomUUID();
    let { result: run } = await auditPair(id, () => buildNativeRun(prisma, f.actor, { id, workItemIds: [f.item.id], seed: 'build' }), 'BUILD');
    const next = await f.member();
    const membership = await auditPair(id, () => changeRunMembers(prisma, id, f.actor, { workItemIds: [next.id], seed: 'member' }), 'MEMBERSHIP_CHANGE');
    run = membership.result.batch;
    expect(membership.details.changes).toEqual(expect.arrayContaining([expect.objectContaining({ entity: 'WorkItem', id: next.id,
        before: expect.objectContaining({ batchId: null }), after: expect.objectContaining({ batchId: id }) })]));
    ({ result: run } = await auditPair(id, () => rebuildNativeRun(prisma, id, f.actor, { workItemIds: [f.item.id, next.id], seed: 'rebuild' }), 'REBUILD'));
    const samples = run.positions.filter(row => row.kind === 'SAMPLE');
    const ids = run.positions.map(row => row.id);
    const first = ids.indexOf(samples[0].id), second = ids.indexOf(samples[1].id);
    [ids[first], ids[second]] = [ids[second], ids[first]];
    await auditPair(id, () => reorderNativeRun(prisma, id, f.actor, { positionIds: ids }), 'REORDER');
    const removal = await auditPair(id, () => changeRunMembers(prisma, id, f.actor, { workItemIds: [next.id], seed: 'remove' }, { remove: true }), 'MEMBERSHIP_CHANGE');
    expect(removal.details.changes).toEqual(expect.arrayContaining([expect.objectContaining({ entity: 'WorkItem', id: next.id,
        before: expect.objectContaining({ batchId: id }), after: expect.objectContaining({ batchId: null }) })]));
    const started = await auditPair(id, () => startNativeRun(prisma, id, f.actor), 'START');
    expect(started.details.changes).toEqual(expect.arrayContaining([expect.objectContaining({ entity: 'BatchAnalyte',
        before: expect.objectContaining({ criteriaSnapshot: null }), after: expect.objectContaining({ criteriaSnapshot: expect.any(String) }) })]));
});

test('partial measurement, automatic evaluation, reopen, correction and explicit evaluation list every changed evidence row once', async () => {
    const f = await fixture({ blankCount: 2 });
    const run = await startNativeRun(prisma, (await f.build()).id, f.actor), readings = blankReadings(run);
    const partial = await auditPair(run.id, () => writeNativeMeasurements(prisma, run.id, f.actor, { measurements: [readings[0]] }), 'MEASUREMENT_WRITE');
    expect(partial.result.evaluations).toHaveLength(0);
    const complete = await auditPair(run.id, () => writeNativeMeasurements(prisma, run.id, f.actor, { measurements: readings.slice(1) }), 'MEASUREMENT_WRITE');
    expect(complete.result.status).toBe('QC_PASS'); expect(complete.result.evaluations).toHaveLength(1);
    await auditPair(run.id, () => reopenNativeRun(prisma, run.id, f.actor, 'Reviewed transcription correction'), 'REOPEN');
    const old = await prisma.qcMeasurement.findFirst({ where: { batchId: run.id, positionId: readings[0].positionId } });
    const correction = await auditPair(run.id, () => writeNativeMeasurements(prisma, run.id, f.actor,
        { reason: 'Reviewed original worksheet', corrections: [{ positionId: old.positionId, value: 0.02 }] }, { correction: true }), 'MEASUREMENT_CORRECTION');
    expect(correction.details.reason).toBe('Reviewed original worksheet');
    const retained = correction.details.changes.find(row => row.entity === 'QcMeasurement' && row.id === old.id);
    expect(retained.before.value).toBe(0.01); expect(retained.after.value).toBe(0.01); expect(retained.after.supersededById).toBeTruthy();
    await auditPair(run.id, () => reopenNativeRun(prisma, run.id, f.actor, 'Reviewed unchanged observations'), 'REOPEN');
    const evaluation = await auditPair(run.id, () => writeNativeMeasurements(prisma, run.id, f.actor, {}, { explicit: true }), 'EVALUATION');
    expect(evaluation.details.changes.some(row => row.entity === 'QcMeasurement')).toBe(false);
    expect(evaluation.details.changes.some(row => row.entity === 'QcEvaluation')).toBe(true);
    const count = await prisma.auditLog.count({ where: { entityId: run.id } });
    await writeNativeMeasurements(prisma, run.id, f.actor, {}, { explicit: true });
    expect(await prisma.auditLog.count({ where: { entityId: run.id } })).toBe(count);
});

test('compatibility submission, correction, reopen and clear preserve old audits and produce one complete pair', async () => {
    const f = await fixture();
    const run = await createProfileRun(prisma, f.actor, { analysis: f.analysisCode, profile: 'RACK_40' });
    const oldAudit = await prisma.auditLog.findMany({ where: { entityId: run.id } });
    const first = await auditPair(run.id, () => writeCompatibilityMeasurements(prisma, run.id, f.actor, compatibilityInput), 'MEASUREMENT_WRITE');
    await auditPair(run.id, () => correctCompatibilityMeasurements(prisma, run.id, f.actor,
        { reason: 'Reviewed compatibility observation', corrections: [{ positionId: first.result.batch.qcResults.blanks[0].id, value: 0.02 }] }), 'MEASUREMENT_CORRECTION');
    await auditPair(run.id, () => reopenCompatibilityRun(prisma, run.id, f.actor, 'Reviewed another compatibility round'), 'REOPEN');
    await auditPair(run.id, () => writeCompatibilityMeasurements(prisma, run.id, f.actor, compatibilityInput), 'MEASUREMENT_WRITE');
    await auditPair(run.id, () => writeCompatibilityMeasurements(prisma, run.id, f.actor, { reason: 'Reviewed explicit clear' }, { clear: true }), 'QC_CLEAR');
    expect(await prisma.auditLog.findMany({ where: { id: { in: oldAudit.map(row => row.id) } } })).toEqual(oldAudit);
});

test.each(['REPEAT_BATCH', 'REJECT'])('disposition %s keeps its sole action, mandatory WorkItem state audit and idempotency', async decision => {
    const f = await fixture(), run = await startNativeRun(prisma, (await f.build()).id, f.actor);
    await writeNativeMeasurements(prisma, run.id, f.actor, { measurements: blankReadings(run, 10) });
    const before = await prisma.auditLog.count({ where: { entity: 'WORKITEM', entityId: f.item.id } });
    const receipt = await auditPair(run.id, () => dispositionBatch(run.id, decision, 'Reviewed failed analytical run', f.actor, prisma), 'QC_DISPOSITION');
    expect(receipt.audit).toMatchObject({ entity: 'QC_BATCH', action: 'QC_DISPOSITION' });
    expect(receipt.details.reason).toBe('Reviewed failed analytical run');
    expect(await prisma.auditLog.count({ where: { entity: 'WORKITEM', entityId: f.item.id } })).toBe(before + 1);
    expect(receipt.details.changes).toEqual(expect.arrayContaining([expect.objectContaining({ entity: 'WorkItem', id: f.item.id,
        before: expect.objectContaining({ status: 'IN_PROGRESS' }), after: expect.objectContaining({ status: 'REPEAT_REQUIRED' }) })]));
    const audits = await prisma.auditLog.count({ where: { entityId: run.id } }), events = await prisma.batchEvent.count({ where: { batchId: run.id } });
    expect((await dispositionBatch(run.id, decision, 'Reviewed failed analytical run', f.actor, prisma)).idempotent).toBe(true);
    expect(await prisma.auditLog.count({ where: { entityId: run.id } })).toBe(audits);
    expect(await prisma.batchEvent.count({ where: { batchId: run.id } })).toBe(events);
    const oldEvents = await prisma.batchEvent.findMany({ where: { batchId: run.id }, orderBy: { id: 'asc' } }), targetId = randomUUID();
    await auditPair(run.id, () => auditPair(targetId, () => buildNativeRun(prisma, f.actor,
        { id: targetId, workItemIds: [f.item.id], seed: 'repeat' }), 'BUILD'), 'BUILD');
    expect(await prisma.batchEvent.findMany({ where: { id: { in: oldEvents.map(row => row.id) } }, orderBy: { id: 'asc' } })).toEqual(oldEvents);
});

test('outer mutation aggregates nested evaluation and metadata; a late snapshot insert fault rolls back all rows', async () => {
    const f = await fixture(), run = await startNativeRun(prisma, (await f.build()).id, f.actor);
    const command = () => mutateQcRun(prisma, run.id, f.actor, { measurements: blankReadings(run), notes: 'Reviewed atomic note' }, { explicit: true });
    const before = await stored(run.id), audits = await prisma.auditLog.count({ where: { entityId: run.id } });
    const events = await prisma.batchEvent.findMany({ where: { batchId: run.id } }), trigger = `qc189_${randomUUID().replaceAll('-', '')}`;
    await prisma.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE INSERT ON "BatchEvent" WHEN NEW."batchId" = '${run.id}' AND NEW."type" = 'QC_EVIDENCE_SNAPSHOT' BEGIN SELECT RAISE(ABORT, 'owned audit insert fault'); END`);
    try { await expect(command()).rejects.toMatchObject({ code: 'P2003' }); }
    finally { await prisma.$executeRawUnsafe(`DROP TRIGGER "${trigger}"`); }
    expect(await stored(run.id)).toEqual(before); expect(await prisma.auditLog.count({ where: { entityId: run.id } })).toBe(audits);
    expect(await prisma.batchEvent.findMany({ where: { batchId: run.id } })).toEqual(events);
    expect((await prisma.batch.findUnique({ where: { id: run.id } })).notes).toBe('');
    const passed = await auditPair(run.id, command, 'EVALUATION');
    expect(passed.details.changes.find(row => row.entity === 'Batch')).toMatchObject({
        before: expect.objectContaining({ notes: '' }), after: expect.objectContaining({ notes: 'Reviewed atomic note', status: 'QC_PASS' }) });
});

test.each(['{unparseable', '{"not":"an array"}'])('malformed stored legacy history %s returns stable HTTP 409 on read and mutation with zero writes', async history => {
    const f = await fixture(), id = randomUUID();
    // Negative historical evidence exists only in the disposable test database.
    await prisma.batch.create({ data: { id, labId: f.labId, analysis: f.analysisCode, status: 'OPEN', createdBy: f.actor.username, history } });
    await prisma.batchAnalyte.create({ data: { id: randomUUID(), batchId: id, labId: f.labId, analysisCode: f.analysisCode,
        provenance: 'PROFILE_ONLY', status: 'OPEN' } });
    const auth = `Bearer ${await createAuthTokenFixture(prisma, 'SUPER_ADMIN')}`, before = await stored(id);
    const auditCount = await prisma.auditLog.count(), eventCount = await prisma.batchEvent.count();
    for (const action of ['get', 'put']) {
        const response = await request(app)[action](`/api/qc/batches/${id}`).set('Authorization', auth)
            .send(action === 'put' ? { notes: 'Must never commit' } : undefined);
        expect(response.status).toBe(409); expect(response.body.code).toBe('BATCH_HISTORY_INVALID');
        expect(await stored(id)).toEqual(before);
        expect(await prisma.auditLog.count()).toBe(auditCount); expect(await prisma.batchEvent.count()).toBe(eventCount);
        expect((await prisma.batch.findUnique({ where: { id } })).history).toBe(history);
    }
});
