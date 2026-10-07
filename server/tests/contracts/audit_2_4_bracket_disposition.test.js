const { randomUUID } = require('node:crypto');
const request = require('supertest');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { withQcRunHttp } = require('../helpers/qcRunHttpHarness');
const { buildNativeRun, startNativeRun } = require('../../services/qcNativeRunService');
const { writeNativeMeasurements } = require('../../services/qcNativeMeasurementService');
const { QC_RUN_INCLUDE } = require('../../services/qcRunViewService');
const qcGate = require('../../services/qcGateService');
const { freezeReportEvidence } = require('../../services/reportTruthfulnessService');
const { repeatSource } = require('../../services/qcRunRepeatService');
const { createProfileRun } = require('../../services/qcCompatibilityRunService');
const { changeRunMembers } = require('../../services/qcRunMembershipService');
const owned = [];

async function fixture() {
    const f = await qcGateFixture({ count: 30, criteria: { maxBatchSize: 40, blankPerBatch: 0, lrmPerBatch: 0, duplicateEvery: 0, ccvEvery: 10 } });
    owned.push(f);
    await f.setPolicy([{ key: 'qc.calibrationVerification', value: true }]);
    const lot = await f.db.referenceMaterial.create({ data: { id: randomUUID(), labId: f.labId, code: randomUUID(), name: 'Calibration fixture',
        kind: 'CHECK_STANDARD', matrix: 'SOIL', lotNumber: 'fixture', status: 'ACTIVE', createdBy: f.actor.username } });
    await f.db.referenceValue.create({ data: { id: randomUUID(), referenceMaterialId: lot.id, analysisCode: f.analysisCode,
        assignedValue: 7, unit: 'fixture-unit', valueType: 'LAB_ASSIGNED', createdBy: f.actor.username } });
    f.run = await startNativeRun(f.db, (await buildNativeRun(f.db, f.actor, { ...f.input, analyses: [{ analysisCode: f.analysisCode,
        references: ['ICV', 'CCV'].map(positionKind => ({ positionKind, referenceMaterialLotId: lot.id })) }] })).id, f.actor);
    f.items = await f.db.workItem.findMany({ orderBy: { rackPosition: 'asc' } });
    f.results = await Promise.all(f.items.map(item => f.result(item)));
    f.readings = failures => f.run.positions.filter(row => row.kind !== 'SAMPLE').map(row => ({ positionId: row.id,
        value: failures.includes(row.position) ? row.kind === 'CCB' ? 5 : 10 : row.kind === 'CCB' ? 0.01 : 7 }));
    return f;
}
afterAll(async () => { for (const f of owned) await f.close(); });

test('actual CCV 25 repeat preserves sealed evidence, repeats only its bracket and permits outside publication', async () => {
    const f = await fixture();
    expect(f.run.positions.filter(row => row.kind === 'CCV').map(row => row.position)).toEqual([13, 25, 37]);
    const affectedPositions = f.run.positions.filter(row => row.kind === 'SAMPLE' && row.position > 13 && row.position < 25);
    const sealed = f.items.find(item => item.rackPosition === 20), outside = f.items.find(item => item.rackPosition === 4);
    for (const item of [sealed, outside]) {
        for (const status of ['COMPLETED', 'SUBMITTED', 'ACCEPTED']) await require('../../services/workItemStateService')
            .transitionWorkItem(item.id, status, f.actor, 'Previously reviewed fixture', {}, f.db);
        await require('../../services/sampleStateService').transitionSample(item.sampleId, 'APPROVED', f.actor, 'Prior approval', {}, f.db);
    }
    const sealedBefore = await f.db.workItem.findUnique({ where: { id: sealed.id } });
    const oldReport = await f.db.report.create({ data: { id: randomUUID(), sampleId: sealed.sampleId, labId: f.labId,
        status: 'PUBLISHED', generatedBy: f.actor.username, publishedAt: new Date(), content: JSON.stringify({ original: true,
            result: f.results.find(row => row.sampleId === sealed.sampleId) }) } });
    const evaluation = await writeNativeMeasurements(f.db, f.run.id, f.actor, { measurements: f.readings([25]) });
    expect(evaluation.analytes[0].result).toBe('FAIL');
    expect(await f.db.workItem.findUnique({ where: { id: sealed.id } })).toEqual(sealedBefore);
    const oldChecks = await f.db.qcEvaluation.findMany(), oldMeasurements = await f.db.qcMeasurement.findMany();
    const before = await f.snapshot();
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const post = (body) => request(app).post(`/api/qc/batches/${f.run.id}/disposition`).set('Authorization', `Bearer ${token}`).send(body);
        const refused = await post({ decision: 'REPEAT_BRACKET', analysisCode: f.analysisCode, reason: 'Repeat failed continuing calibration', scope: { affectedWorkItemIds: [] } });
        expect(refused.status).toBe(422); expect(refused.body.code).toBe('QC_BRACKET_SCOPE_MISMATCH');
        expect(await f.snapshot()).toEqual(before);
        const response = await post({ decision: 'REPEAT_BRACKET', analysisCode: f.analysisCode, reason: 'Repeat failed continuing calibration' });
        expect(response.status).toBe(200);
        expect(response.body.amendmentRequired).toEqual([{ workItemId: sealed.id, sampleId: sealed.sampleId }]);
        expect(response.body.scopes[f.analysisCode].affectedPositionIds.sort()).toEqual(affectedPositions.map(row => row.id).sort());
        const repeat = await post({ decision: 'REPEAT_BRACKET', analysisCode: f.analysisCode, reason: 'Repeat failed continuing calibration' });
        expect(repeat.body.idempotent).toBe(true);
        const failedPublish = await request(app).post(`/api/reports/generate/${sealed.sampleId}`).set('Authorization', `Bearer ${token}`);
        expect(failedPublish.status).toBe(409); expect(failedPublish.body.code).toBe('QC_GATE_REPEAT_ORDERED');
        const outsidePublish = await request(app).post(`/api/reports/generate/${outside.sampleId}`).set('Authorization', `Bearer ${token}`);
        expect(outsidePublish.status).toBe(200);
        const issued = await f.db.report.findUnique({ where: { id: outsidePublish.body.id } });
        const content = JSON.parse(issued.content);
        expect(content.evidence.qc.deviations).toEqual([]);
        expect(content.evidence.qc.calibrationBracketRepeats).toEqual([{ analysisCode: f.analysisCode, batchId: f.run.id,
            failedPositionIds: [f.run.positions.find(row => row.position === 25).id] }]);
    }, { reports: true });
    const updated = await f.db.workItem.findMany();
    const affectedIds = affectedPositions.flatMap(row => row.workItems.map(link => link.workItemId));
    expect(updated.filter(item => item.status === 'REPEAT_REQUIRED').map(item => item.id).sort()).toEqual(affectedIds.filter(id => id !== sealed.id).sort());
    expect(await f.db.workItem.findUnique({ where: { id: sealed.id } })).toEqual(sealedBefore);
    expect(await f.db.report.findUnique({ where: { id: oldReport.id } })).toEqual(oldReport);
    const sealedResult = await f.db.result.findUnique({ where: { id: f.results.find(row => row.sampleId === sealed.sampleId).id } });
    expect(JSON.parse(sealedResult.flags)).toContain('QC_BATCH_REANALYZE_REQUESTED');
    expect(sealedResult.value).toBe('7.123456789'); expect(sealedResult.isValid).toBe(true);
    expect((await qcGate.forResult(sealedResult, { db: f.db })).value).toBe('REPEAT');
    expect(await f.db.qcEvaluation.findMany()).toEqual(oldChecks); expect(await f.db.qcMeasurement.findMany()).toEqual(oldMeasurements);
    const disposition = await f.db.batchDisposition.findFirst();
    expect(JSON.parse(disposition.scope)).toMatchObject({ sealedAffectedWorkItemIds: [sealed.id], sealedAffectedSampleIds: [sealed.sampleId] });
    const batch = await f.db.batch.findUnique({ where: { id: f.run.id }, include: QC_RUN_INCLUDE });
    expect(batch.analytes[0].status).toBe('ACCEPTED_WITH_DEVIATION');
    const sealedSnapshot = await f.snapshot();
    await expect(repeatSource(f.db, sealed, null)).rejects.toMatchObject({ code: 'QC_WORK_ITEM_ALREADY_BATCHED' });
    await expect(f.db.workItem.update({ where: { id: sealed.id }, data: { batchId: null, rackPosition: null } })).rejects.toThrow();
    expect(await f.snapshot()).toEqual(sealedSnapshot);
    const outsideResult = await f.db.result.findUnique({ where: { id: f.results.find(row => row.sampleId === outside.sampleId).id } });
    const gate = await qcGate.forResult(outsideResult, { db: f.db });
    expect(gate.value).toBe('PASS');
    expect(freezeReportEvidence([outsideResult], updated, [batch], { qcGates: { [outsideResult.id]: gate } }).qc.deviations).toEqual([]);
});

test.each([[[25, 37]], [[26]]])('actual calibration failures %j persist the server-computed union/CCB scope', async failures => {
    const f = await fixture(); await writeNativeMeasurements(f.db, f.run.id, f.actor, { measurements: f.readings(failures) });
    const response = await require('../../services/qcDispositionStateService').dispositionBatch(f.run.id, 'REPEAT_BRACKET',
        'Reviewed calibration repeat', f.actor, f.db, { analysisCode: f.analysisCode });
    const scope = response.scopes[f.analysisCode], items = await f.db.workItem.findMany();
    const expected = f.run.positions.filter(row => row.kind === 'SAMPLE' && row.position > 13 && row.position < (failures.length === 2 ? 37 : 25));
    expect(scope.affectedPositionIds.sort()).toEqual(expected.map(row => row.id).sort());
    expect(items.filter(row => row.status === 'REPEAT_REQUIRED').map(row => row.id).sort()).toEqual(scope.affectedWorkItemIds.sort());
});

test('affected bracket work can join another run while retained positions and evaluations stay unchanged', async () => {
    const f = await fixture(); await writeNativeMeasurements(f.db, f.run.id, f.actor, { measurements: f.readings([25]) });
    const response = await require('../../services/qcDispositionStateService').dispositionBatch(f.run.id, 'REPEAT_BRACKET', 'Repeat continuing calibration bracket', f.actor, f.db);
    const oldJoins = await f.db.batchPositionWorkItem.findMany(), evaluations = await f.db.qcEvaluation.findMany();
    const measurements = await f.db.qcMeasurement.findMany();
    const next = await buildNativeRun(f.db, f.actor, { instrumentId: f.instrument.id, workItemIds: response.scopes[f.analysisCode].affectedWorkItemIds });
    expect(next.id).not.toBe(f.run.id);
    expect(await f.db.batchPositionWorkItem.findMany({ where: { position: { batchId: f.run.id } } })).toEqual(oldJoins);
    expect(await f.db.qcEvaluation.findMany()).toEqual(evaluations);
    expect(await f.db.qcMeasurement.findMany()).toEqual(measurements);
});

test.each(['outside', 'not-repeat-required', 'sealed-in-scope', 'no-scope', 'not-current', 'same-time-later-id', 'rack-only'])
    ('both JS and SQL refuse bracket movement: %s', async fault => {
        const f = await fixture(); await writeNativeMeasurements(f.db, f.run.id, f.actor, { measurements: f.readings([25]) });
        const response = await require('../../services/qcDispositionStateService').dispositionBatch(f.run.id, 'REPEAT_BRACKET', 'Reviewed bracket repeat', f.actor, f.db);
        const scope = response.scopes[f.analysisCode];
        let item = await f.db.workItem.findUnique({ where: { id: scope.affectedWorkItemIds[0] } });
        if (fault === 'outside') {
            item = f.items.find(row => !scope.affectedWorkItemIds.includes(row.id));
            await require('../../services/workItemStateService').transitionWorkItem(item.id, 'REPEAT_REQUIRED', f.actor,
                'Independent repeat fixture', {}, f.db, { action: 'REANALYZE_BATCH' });
        }
        if (fault === 'not-repeat-required') await require('../../services/workItemStateService').transitionWorkItem(item.id,
            'IN_PROGRESS', f.actor, 'Resumed fixture work', {}, f.db);
        if (['sealed-in-scope', 'no-scope', 'not-current', 'same-time-later-id'].includes(fault)) {
            const previous = await f.db.batchDisposition.findFirst();
            await f.db.batchDisposition.create({ data: { id: `zz-${randomUUID()}`, batchId: f.run.id, analysisCode: f.analysisCode,
                decision: fault === 'no-scope' ? 'ACCEPT_WITH_DEVIATION' : 'REPEAT_BRACKET', reason: 'Adversarial current disposition fixture',
                decidedBy: f.actor.username, decidedAt: new Date(previous.decidedAt.getTime() + (fault === 'same-time-later-id' ? 0 : 1)),
                scope: fault === 'no-scope' ? null : JSON.stringify({ ...scope,
                    affectedWorkItemIds: fault === 'sealed-in-scope' ? scope.affectedWorkItemIds : [],
                    sealedAffectedWorkItemIds: fault === 'sealed-in-scope' ? [item.id] : [] }) } });
        }
        item = await f.db.workItem.findUnique({ where: { id: item.id } });
        const before = await f.snapshot();
        if (fault !== 'rack-only') await expect(repeatSource(f.db, item, null)).rejects.toMatchObject({ code: 'QC_WORK_ITEM_ALREADY_BATCHED' });
        await expect(f.db.workItem.update({ where: { id: item.id }, data: fault === 'rack-only'
            ? { rackPosition: item.rackPosition + 1 } : { batchId: null, rackPosition: null } })).rejects.toThrow();
        expect(await f.snapshot()).toEqual(before);
    });

async function historicalRun(f, { observations = false, provenance = 'LEGACY_MIGRATED', member } = {}) {
    const batch = await f.db.batch.create({ data: { id: randomUUID(), labId: f.labId, analysis: f.analysisCode,
        status: 'QC_FAIL', createdBy: f.actor.username,
        ...(observations && { qcResults: JSON.stringify({ blanks: [{ value: 2, status: 'FAIL' }], duplicates: [], controls: [] }) }) } });
    if (member) await f.db.workItem.update({ where: { id: member.id }, data: { batchId: batch.id, rackPosition: 1 } });
    await require('../helpers/normalizedQcFixture').normalizeLegacyQcFixture(f.db, batch.id);
    expect((await f.db.batchAnalyte.findFirst({ where: { batchId: batch.id } })).provenance).toBe(provenance);
    return f.db.batch.findUnique({ where: { id: batch.id }, include: QC_RUN_INCLUDE });
}

test.each(['started', 'frozen', 'observations'])('a bracket repeat cannot join a %s target', async kind => {
    const f = await fixture(); await writeNativeMeasurements(f.db, f.run.id, f.actor, { measurements: f.readings([25]) });
    const response = await require('../../services/qcDispositionStateService').dispositionBatch(f.run.id, 'REPEAT_BRACKET', 'Reviewed target refusal', f.actor, f.db);
    let target;
    if (kind === 'started') {
        target = await createProfileRun(f.db, f.actor, { analysis: f.analysisCode, profile: 'RACK_40' });
        await f.db.batch.update({ where: { id: target.id }, data: { startedAt: new Date() } });
    } else {
        target = await historicalRun(f, { observations: kind === 'observations' });
        await f.db.batch.update({ where: { id: target.id }, data: { status: 'OPEN' } });
        expect(target.analytes.some(row => row.legacyMembershipFrozen)).toBe(true);
        expect(target.measurements.length > 0).toBe(kind === 'observations');
    }
    const item = await f.db.workItem.findUnique({ where: { id: response.scopes[f.analysisCode].affectedWorkItemIds[0] } });
    const before = await f.snapshot();
    await expect(repeatSource(f.db, item, target.id)).rejects.toMatchObject({ code: 'QC_WORK_ITEM_ALREADY_BATCHED' });
    await expect(f.db.workItem.update({ where: { id: item.id }, data: { batchId: target.id, rackPosition: 1 } })).rejects.toThrow();
    expect(await f.snapshot()).toEqual(before);
});

test.each(['LEGACY_MIGRATED', 'PROFILE_ONLY'])('%s scope cannot authorize the Native bracket movement exception', async provenance => {
    const f = await qcGateFixture({ status: 'REPEAT_REQUIRED' }); owned.push(f);
    let source;
    if (provenance === 'LEGACY_MIGRATED') source = await historicalRun(f, { member: f.items[0], observations: true });
    else {
        // Unresolved profile membership must remain PROFILE_ONLY; a resolved
        // method would correctly convert this draft into a Native run.
        await f.db.workItem.update({ where: { id: f.workItemIds[0] }, data: { methodologyId: null } });
        source = await createProfileRun(f.db, f.actor, { analysis: f.analysisCode, profile: 'RACK_40' });
        await changeRunMembers(f.db, source.id, f.actor, { workItemIds: f.workItemIds });
        await f.db.batch.update({ where: { id: source.id }, data: { startedAt: new Date() } });
    }
    expect((await f.db.batchAnalyte.findFirst({ where: { batchId: source.id } })).provenance).toBe(provenance);
    await f.db.batchAnalyte.updateMany({ where: { batchId: source.id }, data: { status: 'ACCEPTED_WITH_DEVIATION' } });
    await f.db.batchDisposition.create({ data: { id: randomUUID(), batchId: source.id, analysisCode: f.analysisCode,
        decision: 'REPEAT_BRACKET', reason: 'Non-Native adversarial fixture', decidedBy: f.actor.username,
        decidedAt: new Date(),
        scope: JSON.stringify({ affectedWorkItemIds: f.workItemIds, sealedAffectedWorkItemIds: [] }) } });
    const item = await f.db.workItem.findUnique({ where: { id: f.workItemIds[0] } }), before = await f.snapshot();
    await expect(repeatSource(f.db, item, null)).rejects.toMatchObject({ code: 'QC_WORK_ITEM_ALREADY_BATCHED' });
    await expect(f.db.workItem.update({ where: { id: item.id }, data: { batchId: null, rackPosition: null } })).rejects.toThrow();
    expect(await f.snapshot()).toEqual(before);
});
