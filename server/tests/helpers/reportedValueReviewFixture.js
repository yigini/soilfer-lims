'use strict';
const request = require('supertest');
const jwt = require('jsonwebtoken');

// #191 pins6070309684 /6070565847 /6070675563: isolated selection cases retain
// their policy version and use actual correction, QC, submission and review.
// This zero-frequency rule is confined to these non-QC cases.
async function correctAndApproveReportedValue(db, { app, token, labId, item, original, value }) {
    // This retained positive fixture exercises today's submission path on an
    // explicitly owned historical database. Install its additive #201 evidence
    // prerequisite through the real installer; retain all existing rows/guards.
    require('../../services/workflowStateRules').assertFixtureContext();
    const path = require('node:path'), fs = require('node:fs');
    const file = (await db.$queryRawUnsafe('PRAGMA database_list')).find(row => row.name === 'main')?.file;
    if (!file || path.dirname(path.resolve(file)) !== path.resolve(__dirname, '../.tmp') ||
        !/^[^/\\]+\.db$/.test(path.basename(file)) || !fs.existsSync(file) || fs.realpathSync(file) !== path.resolve(file)) {
        throw Error('Reported-value fixture requires an owned test database.');
    }
    require('../../scripts/install_cross_check_evaluations').installCrossCheckEvaluations({ dbPath: file, apply: true });
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
    if (approved.status !== 200) throw new Error('Owned report-selection approval refused: ' + JSON.stringify(approved.body));
    expect({ status: approved.status, body: approved.body }).toMatchObject({ status: 200 });
    return result;
}
module.exports = { correctAndApproveReportedValue };
