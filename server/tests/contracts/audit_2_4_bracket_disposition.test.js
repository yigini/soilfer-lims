const { randomUUID } = require('node:crypto');
const request = require('supertest');
const Database = require('better-sqlite3');
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

function expectMembershipRefusal(f, item, data) {
    const raw = new Database(f.file, { fileMustExist: true });
    try {
        expect(() => raw.prepare('UPDATE "WorkItem" SET "batchId"=?, "rackPosition"=? WHERE "id"=?')
            .run(data.batchId === undefined ? item.batchId : data.batchId, data.rackPosition, item.id))
            .toThrow('BATCH_MEMBERSHIP_FROZEN');
    } finally { raw.close(); }
}

async function fixture({ mode, calibrationActions, legacySnapshot = false } = {}) {
    const f = await qcGateFixture({ count: 30, criteria: { maxBatchSize: 40, blankPerBatch: 0, lrmPerBatch: 0, duplicateEvery: 0, ccvEvery: 10 } });
    owned.push(f);
    await f.setPolicy([{ key: 'qc.calibrationVerification', value: true },
        ...(mode ? [{ key: 'qc.mode', value: mode }] : []),
        ...(calibrationActions ? [{ key: 'qc.calibrationFailAction', value: calibrationActions }] : [])]);
    const lot = await f.db.referenceMaterial.create({ data: { id: randomUUID(), labId: f.labId, code: randomUUID(), name: 'Calibration fixture',
        kind: 'CHECK_STANDARD', matrix: 'SOIL', lotNumber: 'fixture', status: 'ACTIVE', createdBy: f.actor.username } });
    await f.db.referenceValue.create({ data: { id: randomUUID(), referenceMaterialId: lot.id, analysisCode: f.analysisCode,
        assignedValue: 7, unit: 'fixture-unit', valueType: 'LAB_ASSIGNED', createdBy: f.actor.username } });
    const built = await buildNativeRun(f.db, f.actor, { ...f.input, analyses: [{ analysisCode: f.analysisCode,
        references: ['ICV', 'CCV'].map(positionKind => ({ positionKind, referenceMaterialLotId: lot.id })) }] });
    // Model the policy provider before this key existed at first start. The
    // actual start freezes it once; no frozen row or guard is edited later.
    const policy = require('../../services/policyService'), originalSnapshot = policy.snapshot;
    const historicalPolicy = legacySnapshot ? jest.spyOn(policy, 'snapshot').mockImplementation(async (...args) => {
        const snapshot = await originalSnapshot(...args);
        delete snapshot.values['qc.calibrationFailAction'];
        return snapshot;
    }) : null;
    try { f.run = await startNativeRun(f.db, built.id, f.actor); }
    finally { historicalPolicy?.mockRestore(); }
    f.items = await f.db.workItem.findMany({ orderBy: { rackPosition: 'asc' } });
    f.results = await Promise.all(f.items.map(item => f.result(item)));
    f.readings = failures => f.run.positions.filter(row => row.kind !== 'SAMPLE').map(row => ({ positionId: row.id,
        value: failures.includes(row.position) ? row.kind === 'CCB' ? 5 : 10 : row.kind === 'CCB' ? 0.01 : 7 }));
    return f;
}
afterAll(async () => { for (const f of owned) await f.close(); });

test.each(['REQUIRED_WARN', 'ADVISORY'])('failed CCV in frozen %s mode can be reviewed, finally approved and published through authenticated routes', async mode => {
    const f = await fixture({ mode });
    await writeNativeMeasurements(f.db, f.run.id, f.actor, { measurements: f.readings([25]) });
    const item = f.items[0];
    await require('../../services/workItemStateService').transitionWorkItem(item.id,'COMPLETED',f.actor,'Ready for actual review',{},f.db);
    // Pin6061487810: reach the existing acceptance assertions through the
    // actual submission authority, including its #191 attempt transition.
    await require('../../services/submissionStateService').createSubmissionForItems({db:f.db,actor:f.actor,
        sampleId:item.sampleId,type:'FULL',workItemIds:[item.id]});
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const auth = `Bearer ${token}`;
        const review = await request(app).post(`/api/work/${item.id}/review`).set('Authorization', auth)
            .send({ status: 'ACCEPTED', ...(mode === 'REQUIRED_WARN' && { qcAcknowledgement: { reason: 'Reviewed failed CCV under warning policy' } }) });
        expect(review.status).toBe(200);
        const workspace = await request(app).get(`/api/samples/${item.sampleId}/workspace`).set('Authorization', auth);
        expect(workspace.status).toBe(200); expect(workspace.body.capabilities.canFinalApprove.allowed).toBe(true);
        const approval = await request(app).post(`/api/samples/${item.sampleId}/approve`).set('Authorization', auth);
        expect(approval.status).toBe(200); expect(approval.body.status).toBe('APPROVED');
        const publication = await request(app).post(`/api/reports/generate/${item.sampleId}`).set('Authorization', auth);
        expect(publication.status).toBe(200);
        const report = await f.db.report.findUnique({ where: { id: publication.body.id } });
        expect(JSON.parse(report.content).evidence.qc.deviations[0].qcStatus).toBe('FAIL');
        expect(await f.db.auditLog.count({ where: { action: 'QC_GATE_ACKNOWLEDGED' } })).toBe(mode === 'REQUIRED_WARN' ? 1 : 0);
    }, { reviews: true, samples: true, reports: true });
});

test.each([false, true])('opening CCB failure refuses an empty bracket repeat (WARN ICV: %s) with zero writes', async warnIcv => {
    const f = await fixture({ ...(warnIcv && { calibrationActions: { ICV: 'WARN', CCV: 'REPEAT_BRACKET', CCB: 'REPEAT_BRACKET' } }) });
    await writeNativeMeasurements(f.db, f.run.id, f.actor, { measurements: f.readings(warnIcv ? [1, 2] : [2]) });
    const stored = await f.db.qcEvaluation.findFirst({ orderBy: { evaluatedAt: 'desc' } });
    const details = JSON.parse(stored.details);
    expect(details.calibrationBrackets.find(row => row.kind === 'CCB').affectedPositionIds).toEqual([]);
    if (warnIcv) expect(details.evaluation.controls.find(row => row.kind === 'ICV')).toMatchObject({ status: 'WARN', observedStatus: 'FAIL' });
    const before = await f.snapshot();
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const response = await request(app).post(`/api/qc/batches/${f.run.id}/disposition`).set('Authorization', `Bearer ${token}`)
            .send({ decision: 'REPEAT_BRACKET', analysisCode: f.analysisCode, reason: 'Opening calibration blank failed' });
        expect(response.status).toBe(409); expect(response.body.code).toBe('QC_BRACKET_REPEAT_NOT_ALLOWED');
    });
    expect(await f.snapshot()).toEqual(before);
    expect(await qcGate.forResult(f.results[0], { db: f.db })).toMatchObject({ value: 'FAIL' });
});

test('a real Native run frozen before calibrationFailAction uses its old LRM action and refuses bracket disposition', async () => {
    const f = await fixture({ legacySnapshot: true });
    const frozen = (await f.db.batchAnalyte.findFirst()).criteriaSnapshot, criteria = JSON.parse(frozen);
    expect(criteria.policySnapshot.values).not.toHaveProperty('qc.calibrationFailAction');
    await f.setPolicy([{ key: 'qc.calibrationFailAction', value: { ICV: 'WARN', CCV: 'REPEAT_BRACKET', CCB: 'REPEAT_BRACKET' } }]);
    await writeNativeMeasurements(f.db, f.run.id, f.actor, { measurements: f.readings([25]) });
    const details = JSON.parse((await f.db.qcEvaluation.findFirst({ orderBy: { evaluatedAt: 'desc' } })).details);
    expect(details.calibrationFailActionSource).toBe('LEGACY_SNAPSHOT_FALLBACK');
    expect(details.evaluation.controls.find(row => row.position === 25)).toMatchObject({ status: 'FAIL',
        failAction: criteria.qcRule.resolved.failAction.value.LRM });
    expect((await f.db.batchAnalyte.findFirst()).criteriaSnapshot).toBe(frozen);
    const before = await f.snapshot();
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const response = await request(app).post(`/api/qc/batches/${f.run.id}/disposition`).set('Authorization', `Bearer ${token}`)
            .send({ decision: 'REPEAT_BRACKET', analysisCode: f.analysisCode, reason: 'Legacy calibration failure' });
        expect(response.status).toBe(409); expect(response.body.code).toBe('QC_BRACKET_REPEAT_NOT_ALLOWED');
    });
    expect(await f.snapshot()).toEqual(before);
});

test('actual CCV 25 repeat preserves sealed evidence, repeats only its bracket and permits outside publication', async () => {
    const f = await fixture();
    expect(f.run.positions.filter(row => row.kind === 'CCV').map(row => row.position)).toEqual([13, 25, 37]);
    const affectedPositions = f.run.positions.filter(row => row.kind === 'SAMPLE' && row.position > 13 && row.position < 25);
    const sealed = f.items.find(item => item.rackPosition === 20), outside = f.items.find(item => item.rackPosition === 4);
    for (const item of [sealed, outside]) {
        for (const status of ['COMPLETED', 'SUBMITTED', 'ACCEPTED']) await require('../../services/workItemStateService')
            .transitionWorkItem(item.id, status, f.actor, 'Previously reviewed fixture', {}, f.db);
        if (item.id === sealed.id) await require('../../services/sampleStateService').transitionSample(item.sampleId, 'APPROVED', f.actor, 'Prior approval', {}, f.db);
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
        const outsideApproval = await request(app).post(`/api/samples/${outside.sampleId}/approve`).set('Authorization', `Bearer ${token}`);
        expect(outsideApproval.status).toBe(200); expect(outsideApproval.body.status).toBe('APPROVED');
        const outsidePublish = await request(app).post(`/api/reports/generate/${outside.sampleId}`).set('Authorization', `Bearer ${token}`);
        expect(outsidePublish.status).toBe(200);
        const issued = await f.db.report.findUnique({ where: { id: outsidePublish.body.id } });
        const content = JSON.parse(issued.content);
        expect(content.evidence.qc.deviations).toEqual([]);
        expect(content.evidence.qc.calibrationBracketRepeats).toEqual([{ analysisCode: f.analysisCode, batchId: f.run.id,
            failedPositionIds: [f.run.positions.find(row => row.position === 25).id] }]);
    }, { reports: true, samples: true });
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
        expectMembershipRefusal(f, item, fault === 'rack-only' ? { rackPosition: item.rackPosition + 1 } : { batchId: null, rackPosition: null });
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
    expectMembershipRefusal(f, item, { batchId: target.id, rackPosition: 1 });
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
    expectMembershipRefusal(f, item, { batchId: null, rackPosition: null });
    expect(await f.snapshot()).toEqual(before);
});

test('JS and SQL both allow the pinned bracket branch when the sealed list is absent', async () => {
    const f = await fixture(); await writeNativeMeasurements(f.db, f.run.id, f.actor, { measurements: f.readings([25]) });
    const response = await require('../../services/qcDispositionStateService').dispositionBatch(f.run.id, 'REPEAT_BRACKET',
        'Reviewed bracket repeat', f.actor, f.db);
    const previous = await f.db.batchDisposition.findFirst(), scope = { ...response.scopes[f.analysisCode] };
    delete scope.sealedAffectedWorkItemIds;
    await f.db.batchDisposition.create({ data: { id: randomUUID(), batchId: f.run.id, analysisCode: f.analysisCode,
        decision: 'REPEAT_BRACKET', reason: 'Historical scope without optional sealed list', decidedBy: f.actor.username,
        decidedAt: new Date(previous.decidedAt.getTime() + 1), scope: JSON.stringify(scope) } });
    const item = await f.db.workItem.findUnique({ where: { id: scope.affectedWorkItemIds[0] } });
    expect(await repeatSource(f.db, item, null)).toBe(f.run.id);
    const before = await f.snapshot(), raw = new Database(f.file, { fileMustExist: true });
    try {
        expect(() => raw.transaction(() => {
            expect(raw.prepare('UPDATE "WorkItem" SET "batchId"=NULL,"rackPosition"=NULL WHERE "id"=?').run(item.id).changes).toBe(1);
            throw new Error('ROLLBACK_ALLOWED_PROBE');
        })()).toThrow('ROLLBACK_ALLOWED_PROBE');
    } finally { raw.close(); }
    expect(await f.snapshot()).toEqual(before);
});
