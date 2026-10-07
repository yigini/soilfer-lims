const { randomUUID } = require('node:crypto');
const request = require('supertest');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { withQcRunHttp } = require('../helpers/qcRunHttpHarness');
const qcGate = require('../../services/qcGateService');
const { freezeReportEvidence, describeReportEvidence } = require('../../services/reportTruthfulnessService');
const owned = [];
async function fixture(options) { const f = await qcGateFixture(options); owned.push(f); return f; }
afterAll(async () => { for (const f of owned) await f.close(); });

test.each(['individual', 'bulk', 'submission'])('%s acceptance requires an acknowledgement before any write and records each result atomically', async route => {
    const count = route === 'individual' ? 1 : 2;
    const f = await fixture({ count, status: 'SUBMITTED', sharedSample: route === 'submission' });
    await f.setPolicy([{ key: 'qc.mode', value: 'REQUIRED_WARN' }, { key: 'qc.requireBatchQc', value: 'REQUIRED' }]);
    const results = await Promise.all(f.items.map(item => f.result(item)));
    let url = `/api/work/${f.items[0].id}/review`, body = { status: 'ACCEPTED' };
    if (route === 'bulk') { url = '/api/work/review/bulk'; body.workItemIds = f.workItemIds; }
    if (route === 'submission') {
        const submission = await f.db.submission.create({ data: { id: randomUUID(), sampleId: f.items[0].sampleId, assignedLab: f.labId,
            type: 'PARTIAL', status: 'PENDING_REVIEW', submittedBy: f.actor.username, workItemCount: count, workItemIds: JSON.stringify(f.workItemIds) } });
        await f.db.workItem.updateMany({ where: { id: { in: f.workItemIds } }, data: { submissionId: submission.id } });
        url = `/api/submissions/${submission.id}/review`;
    }
    const before = await f.snapshot();
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const post = value => request(app).post(url).set('Authorization', `Bearer ${token}`).send(value);
        for (const qcAcknowledgement of [undefined, { reason: '   ' }]) {
            const response = await post({ ...body, qcAcknowledgement });
            expect(response.status).toBe(409); expect(response.body.code).toBe('QC_ACKNOWLEDGEMENT_REQUIRED');
            expect(response.body.items).toHaveLength(count);
            expect(response.body.items.every(row => row.gate.value === 'NO_BATCH')).toBe(true);
            expect(await f.snapshot()).toEqual(before);
        }
        const response = await post({ ...body, qcAcknowledgement: { reason: '  Reviewed missing batch evidence  ' } });
        expect(response.status).toBe(200);
    }, { reviews: true });
    const items = await f.db.workItem.findMany();
    expect(items.every(item => item.status === 'ACCEPTED')).toBe(true);
    const acknowledgements = await f.db.auditLog.findMany({ where: { action: 'QC_GATE_ACKNOWLEDGED' } });
    expect(acknowledgements).toHaveLength(count);
    for (const audit of acknowledgements) {
        const record = JSON.parse(audit.details);
        expect(record).toMatchObject({ resultId: audit.entityId, actor: f.actor.username, reason: 'Reviewed missing batch evidence',
            gate: { value: 'NO_BATCH', mode: 'REQUIRED_WARN', modeSource: 'LIVE', batchIds: [], evaluationId: null, dispositionId: null } });
        const item = items.find(row => row.id === record.workItemId);
        expect(JSON.parse(item.history)).toContainEqual(expect.objectContaining({ action: 'QC_GATE_ACKNOWLEDGED', resultId: audit.entityId,
            reason: record.reason, changedBy: f.actor.username }));
    }
    const sample = await f.db.sample.findUnique({ where: { id: f.items[0].sampleId }, include: { workItems: true, results: true } });
    const gates = await qcGate.resolveForSample(sample, [], f.db);
    expect(Object.keys(gates.qcAcknowledgements)).toHaveLength(sample.results.length);
    const evidence = freezeReportEvidence(sample.results, sample.workItems, [], gates);
    expect(evidence.qc.deviations[0]).toMatchObject({ acknowledgedBy: f.actor.username, acknowledgementReason: 'Reviewed missing batch evidence' });
    const labels = require('../../locales/en.json').resultReports;
    expect(describeReportEvidence(evidence, labels).qcStatement).toContain(f.actor.username);
    expect(describeReportEvidence(evidence, labels).qcStatement).toContain('Reviewed missing batch evidence');
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const approval = await request(app).post(`/api/samples/${sample.id}/approve`).set('Authorization', `Bearer ${token}`);
        expect(approval.status).toBe(200); expect(approval.body.status).toBe('APPROVED');
        const response = await request(app).post(`/api/reports/generate/${sample.id}`).set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(200);
        const report = await f.db.report.findUnique({ where: { id: response.body.id } });
        expect(JSON.parse(report.content).qcStatement).toContain('Reviewed missing batch evidence');
        expect(JSON.parse(report.content).evidence.qc.acknowledgements).toHaveLength(sample.results.length);
    }, { reports: true, samples: true });
    expect(results).toHaveLength(count);
});

test('AUTO uses resolved fallback QC with zero stored QcRule rows; method overrides and non-measurement classification remain live', async () => {
    const f = await fixture({ status: 'SUBMITTED', resolvedRules: false }), item = f.items[0], result = await f.result(item);
    expect(await f.db.qcRule.count()).toBe(0);
    expect(await qcGate.forResult(result, { db: f.db })).toMatchObject({ value: 'NO_BATCH', required: true, mode: 'REQUIRED_BLOCKING' });
    await f.setPolicy([{ key: 'qc.requireBatchQc', value: 'REQUIRED' }, { key: 'qc.requireBatchQc', value: 'NOT_REQUIRED',
        analysisCode: item.analysis, methodologyId: item.methodologyId }]);
    expect(await qcGate.forResult(result, { db: f.db })).toMatchObject({ value: 'NO_BATCH', required: false });
    const gate = await qcGate.forResult({ ...result, param: 'DRYING', methodologyId: null }, {
        workItems: [{ ...item, analysis: 'DRYING', methodologyId: null }], db: f.db });
    expect(gate.required).toBe(false);
});

test.each(['REQUIRED_BLOCKING', 'REQUIRED_WARN', 'ADVISORY', 'OFF'])('actual review follows the live requirement table in %s', async mode => {
    const f = await fixture({ status: 'SUBMITTED' }), item = f.items[0]; await f.result(item);
    await f.setPolicy([{ key: 'qc.mode', value: mode }, { key: 'qc.requireBatchQc', value: 'REQUIRED' }]);
    const before = await f.snapshot();
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const response = await request(app).post(`/api/work/${item.id}/review`).set('Authorization', `Bearer ${token}`)
            .send({ status: 'ACCEPTED', qcAcknowledgement: { reason: 'Reviewed lab warning policy' } });
        expect(response.status).toBe(mode === 'REQUIRED_BLOCKING' ? 409 : 200);
        if (mode === 'REQUIRED_BLOCKING') { expect(response.body.code).toBe('QC_GATE_NO_BATCH'); expect(await f.snapshot()).toEqual(before); }
    }, { reviews: true });
});

test('publication cannot use a request acknowledgement without a matching durable AuditLog record', async () => {
    const f = await fixture({ status: 'ACCEPTED' }), item = f.items[0]; await f.result(item);
    await f.setPolicy([{ key: 'qc.mode', value: 'REQUIRED_WARN' }, { key: 'qc.requireBatchQc', value: 'REQUIRED' }]);
    await require('../../services/sampleStateService').transitionSample(item.sampleId, 'APPROVED', f.actor, 'Approved fixture', {}, f.db);
    const before = await f.snapshot();
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const response = await request(app).post(`/api/reports/generate/${item.sampleId}`).set('Authorization', `Bearer ${token}`)
            .send({ qcAcknowledgement: { reason: 'A request is not durable evidence', auditLogId: 'invented' } });
        expect(response.status).toBe(409); expect(response.body.code).toBe('QC_ACKNOWLEDGEMENT_REQUIRED');
    }, { reports: true });
    expect(await f.snapshot()).toEqual(before);
});

test('final approval and workspace refuse an accepted historical result without a durable QC acknowledgement', async () => {
    const f = await fixture({ status: 'ACCEPTED' }), item = f.items[0]; await f.result(item);
    await f.setPolicy([{ key: 'qc.mode', value: 'REQUIRED_WARN' }, { key: 'qc.requireBatchQc', value: 'REQUIRED' }]);
    const before = await f.snapshot();
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const auth = `Bearer ${token}`;
        const workspace = await request(app).get(`/api/samples/${item.sampleId}/workspace`).set('Authorization', auth);
        expect(workspace.status).toBe(200);
        expect(workspace.body.capabilities.canFinalApprove.allowed).toBe(false);
        expect(workspace.body.capabilities.canFinalApprove.blockers).toContain('QC_ACKNOWLEDGEMENT_REQUIRED');
        const response = await request(app).post(`/api/samples/${item.sampleId}/approve`).set('Authorization', auth)
            .send({ qcAcknowledgement: { reason: 'Request data is not review evidence', auditLogId: 'invented' } });
        expect(response.status).toBe(409); expect(response.body.code).toBe('QC_ACKNOWLEDGEMENT_REQUIRED');
    }, { samples: true });
    expect(await f.snapshot()).toEqual(before);
});
