const { randomUUID } = require('node:crypto');
const request = require('supertest');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { withQcRunHttp } = require('../helpers/qcRunHttpHarness');
const { buildNativeRun, startNativeRun } = require('../../services/qcNativeRunService');
const { writeNativeMeasurements } = require('../../services/qcNativeMeasurementService');
const { createStoredProfileRunFixture } = require('../helpers/storedProfileRunFixture');
const { writeCompatibilityMeasurements } = require('../../services/qcCompatibilityRunService');
const { QC_RUN_INCLUDE } = require('../../services/qcRunViewService');
const { MODE } = require('../../services/qcReviewedCorrectionService');
const owned = [];

async function failedFixture(native, { author = 'analyst', enabled = true } = {}) {
    const f = await qcGateFixture({ criteria: { blankPerBatch: 1, lrmPerBatch: 0, duplicateEvery: 0, crmEveryNBatches: 0 } });
    owned.push(f);
    for (const name of ['analyst', 'reviewer', 'other']) {
        const user = await f.db.user.create({ data: { id: randomUUID(), username: `${name}-${randomUUID()}`, email: `${randomUUID()}@example.test`,
            password: 'fixture', role: name === 'other' ? 'LAB_TECHNICIAN' : 'LAB_MANAGER', labId: f.labId } });
        f[name] = { id: user.id, username: user.username, role: user.role, labId: f.labId };
    }
    if (enabled) await f.setPolicy([{ key: 'qc.reviewedTranscriptionCorrectionEnabled', value: true }]);
    if (!native) await require('../../services/qcRuleService').change(f.actor, { labId: f.labId, analysisCode: f.analysisCode,
        criteria: { blankPerBatch: 1, lrmPerBatch: 0, duplicateEvery: 0, crmEveryNBatches: 0 }, expectedVersion: 0,
        reason: 'Analysis-wide criteria for unresolved compatibility method' }, { db: f.db });
    const authorActor = author === 'system' ? f.actor : f[author];
    if (native) {
        f.run = await startNativeRun(f.db, (await buildNativeRun(f.db, f.analyst, f.input)).id, f.analyst);
        f.blank = f.run.positions.find(row => row.kind === 'BLANK');
        f.run = await writeNativeMeasurements(f.db, f.run.id, authorActor, { measurements: [{ positionId: f.blank.id, value: 9.123456789 }] });
    } else {
        f.run = await createStoredProfileRunFixture(f.db, { actor: f.analyst, input: { analysis: f.analysisCode, profile: 'RACK_40' } });
        f.run = (await writeCompatibilityMeasurements(f.db, f.run.id, authorActor, { blanks: [{ value: 9.123456789 }] })).batch;
        f.blank = f.run.positions.find(row => row.kind === 'BLANK');
    }
    expect(f.run.analytes[0].status).toBe('QC_FAIL');
    f.inputCorrection = { mode: MODE, analysisCode: f.analysisCode, reason: 'Transposed digits in worksheet entry',
        sourceReference: 'Recorded worksheet W-17, line 4', corrections: [{ positionId: f.blank.id, replicateNo: 1, rawInput: '0.0123456789' }] };
    f.read = () => f.db.batch.findUnique({ where: { id: f.run.id }, include: QC_RUN_INCLUDE });
    f.allEvidence = async () => JSON.parse(JSON.stringify(await Promise.all([f.snapshot(), f.db.qcMeasurement.findMany({ orderBy: { id: 'asc' } }),
        f.db.qcEvaluation.findMany({ orderBy: { id: 'asc' } }), f.db.batch.findMany({ orderBy: { id: 'asc' } }),
        f.db.batchAnalyte.findMany({ orderBy: { id: 'asc' } }), f.db.batchPosition.findMany({ orderBy: { id: 'asc' } })])));
    f.submit = async (actor, input = f.inputCorrection, route = 'corrections') => {
        let response;
        await withQcRunHttp(f.db, actor, async (app, token) => { response = await request(app)
            .post(`/api/qc/batches/${f.run.id}/${route}`).set('Authorization', `Bearer ${token}`).send(input); });
        return response;
    };
    return f;
}
afterAll(async () => { for (const f of owned) await f.close(); });

test.each([true, false])('default-off, missing evidence and unrelated field submissions refuse with zero writes (native=%s)', async native => {
    const f = await failedFixture(native, { enabled: false });
    let before = await f.allEvidence();
    expect((await f.submit(f.reviewer)).body.code).toBe('QC_REVIEWED_POLICY_DISABLED');
    expect(await f.allEvidence()).toEqual(before);
    await f.setPolicy([{ key: 'qc.reviewedTranscriptionCorrectionEnabled', value: true }]); before = await f.allEvidence();
    for (const [patch, code] of [[{ reason: '' }, 'QC_CORRECTION_REASON_REQUIRED'], [{ sourceReference: ' ' }, 'QC_REVIEWED_SOURCE_REQUIRED'],
        [{ status: 'QC_PASS' }, 'QC_REVIEWED_FIELDS_INVALID'], [{ references: [] }, 'QC_REVIEWED_FIELDS_INVALID'],
        [{ instrumentId: 'another' }, 'QC_REVIEWED_FIELDS_INVALID'], [{ reviewer: f.analyst.username }, 'QC_REVIEWED_FIELDS_INVALID'],
        [{ corrections: [{ ...f.inputCorrection.corrections[0], enteredBy: f.reviewer.username }] }, 'QC_REVIEWED_FIELDS_INVALID']]) {
        const response = await f.submit(f.reviewer, { ...f.inputCorrection, ...patch });
        expect(response.status).toBeGreaterThanOrEqual(400); expect(response.body.code).toBe(code);
        expect(await f.allEvidence()).toEqual(before);
    }
    expect((await f.submit(f.other)).body.code).toBe('QC_REVIEWED_PERMISSION_REQUIRED');
    expect(await f.allEvidence()).toEqual(before);
    expect((await f.submit(f.analyst)).body.code).toBe('QC_REVIEWED_SECOND_PERSON_REQUIRED');
    expect(await f.allEvidence()).toEqual(before);
});

test.each([true, false])('stored observation authors cannot approve their own correction (native=%s)', async native => {
    const f = await failedFixture(native, { author: 'reviewer' }), before = await f.allEvidence();
    expect((await f.submit(f.reviewer)).body.code).toBe('QC_REVIEWED_SECOND_PERSON_REQUIRED');
    expect(await f.allEvidence()).toEqual(before);
});
test.each([true, false])('system observation authors remain locked (native=%s)', async native => {
    const f = await failedFixture(native, { author: 'system' }), before = await f.allEvidence();
    expect((await f.submit(f.reviewer)).body.code).toBe('QC_REVIEWED_AUTHOR_UNKNOWN');
    expect(await f.allEvidence()).toEqual(before);
});

test.each([true, false])('reviewed correction appends exact evidence and replays recorded limits after current limits change (native=%s)', async native => {
    const f = await failedFixture(native), original = await f.read(), failed = original.evaluations[0], reading = original.measurements[0];
    await f.setPolicy([{ key: 'qc.blankMaxAllowed', value: 0.001 }]);
    const response = await f.submit(f.reviewer);
    expect(response.status).toBe(200); expect(response.body.batch.analytes[0].status).toBe('QC_PASS');
    const after = await f.read(), replacement = after.measurements.find(row => row.id !== reading.id);
    expect(after.evaluations).toHaveLength(2); expect(after.evaluations[0]).toEqual(failed);
    expect(after.measurements.find(row => row.id === reading.id)).toEqual({ ...reading, supersededById: replacement.id });
    expect(replacement).toMatchObject({ value: 0.0123456789, rawInput: '0.0123456789', enteredBy: f.reviewer.username, correctionReason: f.inputCorrection.reason });
    expect(after.evaluations[1]).toMatchObject({ supersedesId: failed.id, verdict: 'PASS' });
    const details = JSON.parse(after.evaluations[1].details), event = after.events.find(row => row.type === 'QC_TRANSCRIPTION_CORRECTED');
    expect(details.criteriaSource.type).toBe(native ? 'FROZEN_NATIVE_CRITERIA' : 'RECORDED_COMPATIBILITY_EVALUATION');
    expect(details.evaluation.blanks[0].maxAllowed).toBe(0.05);
    expect(JSON.parse(event.payload)).toMatchObject({ reviewer: { id: f.reviewer.id, username: f.reviewer.username },
        observationAuthors: [{ id: f.analyst.id, username: f.analyst.username }], sourceReference: f.inputCorrection.sourceReference,
        previousEvaluationId: failed.id, previousVerdict: 'FAIL', evaluationId: after.evaluations[1].id,
        replacements: [{ original: { id: reading.id, value: 9.123456789 }, replacement: { id: replacement.id, value: 0.0123456789 } }] });
    if (native) expect(JSON.parse(event.payload).runAnalyst).toMatchObject({ id: f.analyst.id });
    else expect(JSON.parse(event.payload).runAnalyst).toBeNull();
    expect(after.dispositions).toHaveLength(0);
    const before = await f.allEvidence();
    expect((await f.submit(f.reviewer)).body.code).toBe('QC_REVIEWED_STATE_LOCKED');
    expect(await f.allEvidence()).toEqual(before);
});

test.each([true, false])('a reviewed replacement that still fails retains the failed state and both evaluations (native=%s)', async native => {
    const f = await failedFixture(native), original = await f.read();
    const response = await f.submit(f.reviewer, { ...f.inputCorrection, corrections: [{ positionId: f.blank.id, value: 1.123456789 }] });
    expect(response.status).toBe(200); expect(response.body.batch.analytes[0].status).toBe('QC_FAIL');
    const after = await f.read(); expect(after.evaluations.map(row => row.verdict)).toEqual(['FAIL', 'FAIL']);
    expect(after.evaluations[0]).toEqual(original.evaluations[0]); expect(after.dispositions).toHaveLength(0);
});
