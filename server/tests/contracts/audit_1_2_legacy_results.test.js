const request = require('supertest');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const labId = 'LAB-LEGACY-RESULTS-179', analysis = 'PH_LEGACY_RESULT_179';
let token, actor;
beforeAll(async () => {
    token = await getAuthToken('LAB_TECHNICIAN', labId);
    actor = jwt.decode(token);
    await prisma.analysis.create({ data: { code: analysis, name: 'Legacy result test pH', units: 'pH',
        prerequisites: '[]', validation: '{"min":0,"max":14}' } });
});
afterEach(() => jest.restoreAllMocks());
async function fixture(status = 'PROCESSING', flags = {}, itemStatus = 'IN_PROGRESS', resultData = {}) {
    const sample = await createSampleFixture(prisma, { data: { id: randomUUID(), originalId: randomUUID(), assignedLab: labId,
        status, receptionDate: new Date(), requiredAnalyses: JSON.stringify([analysis]), dryingStatus: 'DONE', preparationStatus: 'DONE', ...flags } });
    const item = await createWorkItemFixture(prisma, { data: { id: randomUUID(), sampleId: sample.id, assignedLab: labId,
        assignedTo: actor.username, analysis, status: itemStatus } });
    const result = await prisma.result.create({ data: { id: randomUUID(), sampleId: sample.id, param: analysis, value: '6.2',
        numericValue: 6.2, unit: 'pH', isCurrent: true, isValid: true, flags: '["ORIGINAL_NOTE"]', ...resultData } });
    return { sample, item, result };
}
const save = row => request(app).post(`/api/results/${row.sample.id}`).set('Authorization', `Bearer ${token}`)
    .send({ measurements: [{ param: analysis, value: '7.2', unit: 'pH' }] });
const submit = row => request(app).post(`/api/results/${row.sample.id}/submit`).set('Authorization', `Bearer ${token}`);
async function snapshot(row) {
    return { sample: await prisma.sample.findUnique({ where: { id: row.sample.id } }),
        items: await prisma.workItem.findMany({ where: { sampleId: row.sample.id }, orderBy: { id: 'asc' } }),
        results: await prisma.result.findMany({ where: { sampleId: row.sample.id }, orderBy: { id: 'asc' } }),
        audits: await prisma.auditLog.findMany({ where: { OR: [{ sampleId: row.sample.id }, { entityId: row.sample.id }] }, orderBy: { id: 'asc' } }),
        submissions: await prisma.submission.findMany({ where: { sampleId: row.sample.id }, orderBy: { id: 'asc' } }) };
}

test.each(['PROCESSING', 'SUBMITTED_PARTIAL'])('saving results keeps %s lifecycle and every WorkItem unchanged', async status => {
    const row = await fixture(status), before = await snapshot(row);
    expect((await save(row)).status).toBe(200);
    const after = await snapshot(row);
    expect(after.sample).toEqual(before.sample);
    expect(after.items).toEqual(before.items);
    expect(after.submissions).toEqual(before.submissions);
    expect(after.results).toHaveLength(2);
    const previous = after.results.find(result => result.id === row.result.id);
    expect(previous).toMatchObject({ value: '6.2', numericValue: 6.2, flags: '["ORIGINAL_NOTE"]', isCurrent: false });
    expect(after.results.find(result => result.isCurrent)).toMatchObject({ value: '7.2', enteredBy: actor.username });
    const audit = after.audits.find(audit => audit.action === 'UPDATE_RESULTS');
    expect(JSON.parse(audit.after)).toEqual({ gateEvidence: 'LEGACY_SAMPLE_FLAG', legacyGates: ['DRYING', 'PREPARATION'] });
});

test.each(['scope', 'gate', 'audit'])('a %s refusal inside the result-save transaction writes nothing', async kind => {
    const row = await fixture(), before = await snapshot(row), transaction = prisma.$transaction.bind(prisma);
    jest.spyOn(prisma, '$transaction').mockImplementationOnce(callback => transaction(async tx => {
        if (kind === 'scope') await tx.sample.update({ where: { id: row.sample.id }, data: { assignedLab: 'OTHER-LAB' } });
        if (kind === 'gate') await tx.sample.update({ where: { id: row.sample.id }, data: { preparationStatus: 'PENDING' } });
        if (kind === 'audit') return callback({ ...tx, auditLog: { ...tx.auditLog, create: async () => { throw new Error('Injected result audit failure'); } } });
        return callback(tx);
    }));
    const response = await save(row);
    expect(response.status).toBe({ scope: 403, gate: 412, audit: 500 }[kind]);
    expect(await snapshot(row)).toEqual(before);
});

test.each([
    [{ preparationStatus: 'PENDING' }, 'Sample preparation has not been completed'],
    [{ dryingStatus: 'PENDING' }, 'Sample drying has not been completed']
])('missing preparation evidence retains HTTP 412 and its existing message', async (flags, message) => {
    const row = await fixture('PROCESSING', flags), before = await snapshot(row);
    const response = await save(row);
    expect(response.status).toBe(412); expect(response.body.error).toBe(message);
    expect(await snapshot(row)).toEqual(before);
});

test('a present gate WorkItem overrides a saved DONE flag and refuses inconsistent evidence', async () => {
    const row = await fixture();
    await createWorkItemFixture(prisma, { data: { id: randomUUID(), sampleId: row.sample.id, analysis: 'DRYING',
        assignedLab: labId, status: 'NOT_ASSIGNED' } });
    const before = await snapshot(row), response = await save(row);
    expect(response.status).toBe(409); expect(response.body.code).toBe('GATE_STATE_MISMATCH');
    expect(await snapshot(row)).toEqual(before);
});

test.each(['APPROVED', 'ARCHIVED', 'DISPOSED'])('final %s result edits require an amendment and write nothing', async status => {
    const row = await fixture(status), before = await snapshot(row), response = await save(row);
    expect(response.status).toBe(409); expect(response.body.code).toBe('AMENDMENT_WORKFLOW_REQUIRED');
    expect(await snapshot(row)).toEqual(before);
});

test.each(['COMPLETED', 'IN_PROGRESS', 'ASSIGNED'])('legacy submit completes evidenced %s work and creates a real FULL Submission', async itemStatus => {
    const row = await fixture('PROCESSING', {}, itemStatus), before = await snapshot(row), response = await submit(row);
    expect(response.status).toBe(200); expect(response.body.status).toBe('SUBMITTED_FULL');
    const after = await snapshot(row);
    expect(after.results).toEqual(before.results);
    expect(after.submissions).toHaveLength(1);
    expect(after.submissions[0]).toMatchObject({ type: 'FULL', status: 'PENDING_REVIEW', workItemCount: 1, submittedBy: actor.username });
    expect(JSON.parse(after.submissions[0].workItemIds)).toEqual([row.item.id]);
    expect(response.body.submission.id).toBe(after.submissions[0].id);
    expect(after.items[0]).toMatchObject({ status: 'SUBMITTED', result: row.item.result, submissionId: after.submissions[0].id });
    expect(after.sample).toMatchObject({ status: 'SUBMITTED_FULL', lastSubmissionId: after.submissions[0].id, lastSubmissionType: 'FULL' });
    const completion = after.audits.filter(audit => audit.action === 'STORED_RESULTS_COMPLETED');
    expect(completion).toHaveLength(itemStatus === 'COMPLETED' ? 0 : 1);
    if (completion.length) expect(JSON.parse(completion[0].details)).toMatchObject({ resultIds: [row.result.id], policyVersion: 0 });
    expect(after.audits.filter(audit => audit.action === 'WORKITEM_SUBMITTED')).toHaveLength(1);
    expect(after.audits.filter(audit => audit.action === 'SUBMISSION_CREATED')).toHaveLength(1);
});

test.each(['NOT_ASSIGNED', 'ON_HOLD', 'REPEAT_REQUIRED', 'AWAITING_VERIFICATION', 'COMPLETED'])
    ('a %s blocker prevents FULL submission with zero writes, including an earlier evidenced item', async status => {
        const row = await fixture(), blocking = await createWorkItemFixture(prisma, { data: { id: randomUUID(), sampleId: row.sample.id,
            analysis: `BLOCKER_${status}`, assignedLab: labId, assignedTo: actor.username, status } });
        const before = await snapshot(row), response = await submit(row);
        expect(response.status).toBe(409); expect(response.body.code).toBe('SUBMISSION_NOT_FULL');
        expect(response.body.details.blocking).toEqual([expect.objectContaining({ workItemId: blocking.id, status })]);
        expect(await snapshot(row)).toEqual(before);
    });

test('blocking matrix diagnostics retain 422 before any lifecycle or submission write', async () => {
    const row = await fixture();
    await prisma.result.createMany({ data: [['SAND', '40'], ['SILT', '30'], ['CLAY', '17']].map(([param, value]) => ({
        id: randomUUID(), sampleId: row.sample.id, param, value, numericValue: Number(value), isCurrent: true })) });
    const before = await snapshot(row), response = await submit(row);
    expect(response.status).toBe(422); expect(response.body.error).toBe('BLOCKING_MATRIX_DIAGNOSTICS');
    expect(response.body.blockingErrors.some(error => error.check === 'TEXTURE_CLOSURE')).toBe(true);
    expect(await snapshot(row)).toEqual(before);
});

test('a late Sample audit failure rolls back automatic completion and the entire real submission', async () => {
    const row = await fixture(), before = await snapshot(row), transaction = prisma.$transaction.bind(prisma);
    jest.spyOn(prisma, '$transaction').mockImplementationOnce(callback => transaction(tx => callback({ ...tx,
        auditLog: { ...tx.auditLog, create: args => {
            if (args.data.action === 'SAMPLE_STATUS_TRANSITION') throw new Error('Injected late Sample audit failure');
            return tx.auditLog.create(args);
        } } })));
    expect((await submit(row)).status).toBe(500);
    expect(await snapshot(row)).toEqual(before);
});

test.each([
    [{ preparationStatus: 'PENDING' }, 'Sample preparation has not been completed'],
    [{ dryingStatus: 'PENDING' }, 'Sample drying has not been completed']
])('legacy submit retains existing prerequisite 412 refusals with zero writes', async (flags, message) => {
    const row = await fixture('PROCESSING', flags, 'COMPLETED'), before = await snapshot(row), response = await submit(row);
    expect(response.status).toBe(412); expect(response.body.error).toBe(message);
    expect(await snapshot(row)).toEqual(before);
});

test.each(['APPROVED', 'ARCHIVED', 'DISPOSED'])('legacy submit never reopens a final %s Sample', async status => {
    const row = await fixture(status, {}, 'COMPLETED'), before = await snapshot(row), response = await submit(row);
    expect(response.status).toBe(409); expect(response.body.code).toBe('AMENDMENT_WORKFLOW_REQUIRED');
    expect(await snapshot(row)).toEqual(before);
});

test.each([
    ['', true, 'RESULT_NOT_COMPLETE'], ['not-a-number', true, 'RESULT_NOT_COMPLETE'],
    ['19', true, 'RESULT_NOT_COMPLETE'], ['6.2', false, 'CURRENT_RESULT_REQUIRED']
])('legacy submission refuses incomplete stored value %s without changing evidence', async (value, isValid, reasonCode) => {
    const row = await fixture('PROCESSING', {}, 'IN_PROGRESS', { value, isValid });
    const before = await snapshot(row), response = await submit(row);
    expect(response.status).toBe(409); expect(response.body.code).toBe('SUBMISSION_NOT_FULL');
    expect(response.body.details.blocking).toEqual([expect.objectContaining({ workItemId: row.item.id, reasonCode })]);
    expect(await snapshot(row)).toEqual(before);
});

test.each([
    ['malformed mapping', 'INSTRUMENT_CONFIGURATION_INVALID'], ['missing instrument', 'INSTRUMENT_REQUIRED'],
    ['ineligible instrument', 'INSTRUMENT_NOT_ELIGIBLE'], ['out of service', 'INSTRUMENT_NOT_AVAILABLE'],
    ['different laboratory', 'INSTRUMENT_NOT_AVAILABLE'], ['overdue calibration', 'INSTRUMENT_CALIBRATION_OVERDUE']
])('legacy submission refuses %s with zero lifecycle or evidence writes', async (kind, reasonCode) => {
    const row = await fixture(), equipmentId = randomUUID(), mappingId = randomUUID();
    await prisma.equipmentAsset.create({ data: { id: equipmentId, labId: kind === 'different laboratory' ? 'OTHER-LAB' : labId,
        name: 'Stored result instrument', assetType: 'OTHER', criticality: 'IMPORTANT',
        status: kind === 'out of service' ? 'OUT_OF_SERVICE' : 'IN_SERVICE',
        qualification: { create: { id: randomUUID(), labId, calibrationStatus: kind === 'overdue calibration' ? 'OVERDUE' : 'OK', verificationStatus: 'OK' } } } });
    await prisma.equipmentMethodEligibility.create({ data: { id: mappingId, labId, analysisCode: analysis, isRequired: true,
        eligibleEquipmentIds: kind === 'malformed mapping' ? '{broken' : JSON.stringify([kind === 'ineligible instrument' ? randomUUID() : equipmentId]) } });
    if (kind !== 'missing instrument') await prisma.workItem.update({ where: { id: row.item.id }, data: { equipmentId } });
    try {
        const before = await snapshot(row), response = await submit(row);
        expect(response.status).toBe(409); expect(response.body.code).toBe('SUBMISSION_NOT_FULL');
        expect(response.body.details.blocking).toEqual([expect.objectContaining({ workItemId: row.item.id, reasonCode })]);
        expect(await snapshot(row)).toEqual(before);
    } finally {
        await prisma.equipmentMethodEligibility.delete({ where: { id: mappingId } });
    }
});

test('legacy submit preserves the no-results refusal before lifecycle checks', async () => {
    const row = await fixture('APPROVED', {}, 'COMPLETED', { isCurrent: false }), before = await snapshot(row);
    const response = await submit(row);
    expect(response.status).toBe(400); expect(response.body.error).toBe('No results entered');
    expect(await snapshot(row)).toEqual(before);
});

test('uncleared preparation reversion prevents submission and preserves its append-only evidence', async () => {
    const row = await fixture('PROCESSING', {}, 'COMPLETED');
    const event = await prisma.resultEvidenceEvent.create({ data: { id: randomUUID(), sampleId: row.sample.id, resultId: row.result.id,
        gate: 'PREPARATION', eventType: 'PREP_REVERTED', reason: 'Preparation needs rechecking', actor: actor.username } });
    const before = await snapshot(row), response = await submit(row);
    expect(response.status).toBe(409); expect(response.body.code).toBe('PREP_REVERTED_RESULTS');
    expect(await snapshot(row)).toEqual(before);
    expect(await prisma.resultEvidenceEvent.findUnique({ where: { id: event.id } })).toEqual(event);
});
