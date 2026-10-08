'use strict';
const request = require('supertest');
const jwt = require('jsonwebtoken');

// #191 pins6070309684 /6070565847 /6070675563: isolated selection cases retain
// their policy version and use actual correction, QC, submission and review.
// This zero-frequency rule is confined to these non-QC cases.
async function correctAndApproveReportedValue(db, { app, token, labId, item, original, value }) {
    const actor = jwt.decode(token);
    await require('../../services/qcRuleService').change(actor, {
        labId, analysisCode: item.analysis, methodologyId: original.methodologyId,
        expectedVersion: 0, reason: 'Owned non-QC reported-value selection fixture',
        criteria: { blankPerBatch: 0, lrmPerBatch: 0, duplicateEvery: 0, crmEveryNBatches: 0, ccvEvery: 0 }
    }, { db });
    const response = await request(app).post(`/api/attempts/${original.attemptId}/corrections`)
        .set('Authorization', `Bearer ${token}`).send({ resultId: original.id, value: String(value),
            reason: 'TRANSCRIPTION_ERROR', note: 'Reviewed against the original report-selection record' });
    expect({ status: response.status, body: response.body }).toMatchObject({ status: 201 });
    const result = await db.result.findUnique({ where: { id: response.body.result.id } });
    expect(result).toMatchObject({ attemptId: original.attemptId, methodologyId: original.methodologyId, unit: original.unit });
    expect(await db.result.findUnique({ where: { id: original.id } }))
        .toEqual({ ...original, isCurrent: false, supersededBy: result.id });
    const gate = await require('../../services/qcGateService').forResult(result, { db });
    expect(gate).toMatchObject({ value: 'NO_BATCH', required: false, batchIds: [] });
    expect(require('../../services/qcGateService').decision(gate).allowed).toBe(true);
    await require('../../services/workItemStateService').transitionWorkItem(item.id, 'COMPLETED', actor,
        'Recorded report-selection determination', {}, db);
    await require('../../services/submissionStateService').createSubmissionForItems({ db, actor,
        sampleId: item.sampleId, type: 'FULL', workItemIds: [item.id] });
    const reviewed = await request(app).post(`/api/work/${item.id}/review`).set('Authorization', `Bearer ${token}`)
        .send({ decision: 'ACCEPT', attemptId: original.attemptId, note: 'Reviewed corrected determination' });
    expect({ status: reviewed.status, body: reviewed.body }).toMatchObject({ status: 200 });
    const approved = await request(app).post(`/api/samples/${item.sampleId}/approve`).set('Authorization', `Bearer ${token}`).send({});
    expect({ status: approved.status, body: approved.body }).toMatchObject({ status: 200 });
    return result;
}
module.exports = { correctAndApproveReportedValue };
