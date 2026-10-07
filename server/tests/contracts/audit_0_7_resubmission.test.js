const { createResultFixture } = require('../../services/resultWriteService');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');
const id = prefix => `${prefix}-${crypto.randomUUID()}`;
const labId = 'LAB-AUDIT-07';

describe('Audit 0.7: returned work can be recorded and submitted again', () => {
    let manager, technician, username;
    beforeAll(async () => {
        manager = await getAuthToken('LAB_MANAGER', labId);
        technician = await getAuthToken('LAB_TECHNICIAN', labId);
        username = jwt.decode(technician).username;
    });
    async function fixture({ batchStatus, itemStatus = 'SUBMITTED' } = {}) {
        const sampleId = id('SMP-07'), analysis = id('ANALYSIS-07');
        await prisma.analysis.create({ data: { code: analysis, name: 'Resubmission numeric fixture', units: 'mg/kg', status: 'active' } });
        await createSampleFixture(prisma, { data: { id: sampleId, originalId: sampleId, labId: sampleId, assignedLab: labId,
            status: 'PROCESSING', receptionDate: new Date(), dryingStatus: 'DONE', preparationStatus: 'DONE' } });
        const batch = batchStatus ? await prisma.batch.create({ data: { id: id('B-07'), analysis, status: batchStatus, labId, createdBy: username } }) : null;
        const itemId = id('WI-07'), submissionId = id('SUB-07');
        const submission = await prisma.submission.create({ data: { id: submissionId, sampleId, assignedLab: labId, submittedBy: username,
            status: 'PENDING_REVIEW', type: 'PARTIAL', workItemCount: 1, workItemIds: JSON.stringify([itemId]) } });
        const item = await createWorkItemFixture(prisma, { data: { id: itemId, sampleId, analysis, assignedLab: labId, assignedTo: username,
            status: itemStatus, result: '6.2', submissionId, batchId: batch?.id, history: JSON.stringify([{ action: 'SUBMITTED', submissionId }]) } });
        const result = await createResultFixture(prisma, { data: { id: id('R-07'), sampleId, param: analysis, value: '6.2', numericValue: 6.2,
            isCurrent: true, isValid: true, flags: '[]', batchId: batch?.id } });
        return { sampleId, analysis, item, submission, result, batch };
    }
    const post = (path, body, token = manager) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body);
    const reason = 'Repeat after drift review';
    const returned = (route, f) => route === 'individual'
        ? post(`/api/work/${f.item.id}/review`, { status: 'REANALYSIS_REQUIRED', reason })
        : route === 'bulk' ? post('/api/work/review/bulk', { workItemIds: [f.item.id], status: 'REANALYSIS_REQUIRED', reason })
            : post(`/api/submissions/${f.submission.id}/review`, { decisions: [{ workItemId: f.item.id, decision: 'REJECT_REANALYSIS', reason }] });
    test.each(['individual', 'bulk', 'submission'])('%s RETURN preserves the old link in history and re-recorded work appears in queue and preview', async route => {
        const f = await fixture(), response = await returned(route, f);
        expect(response.status).toBe(200);
        const item = await prisma.workItem.findUnique({ where: { id: f.item.id } });
        expect(item.status).toBe('REPEAT_REQUIRED'); expect(item.submissionId).toBeNull();
        const history = JSON.parse(item.history);
        expect(history[0]).toEqual({ action: 'SUBMITTED', submissionId: f.submission.id });
        expect(history.at(-1).submissionId).toBe(f.submission.id);
        expect(history.at(-1).reason || history.at(-1).note).toBe(reason);
        expect((await prisma.submission.findUnique({ where: { id: f.submission.id } })).workItemIds).toBe(f.submission.workItemIds);
        expect((await prisma.result.findUnique({ where: { id: f.result.id } })).numericValue).toBe(6.2);
        const beforeQueue = await request(app).get('/api/workbench/queue').query({ view: 'ready_to_submit' }).set('Authorization', `Bearer ${technician}`);
        expect(beforeQueue.status).toBe(200);
        const saved = await post('/api/workbench/batch-save', { draft: false, entries: [{ workItemId: f.item.id, value: '6.4' }] }, technician);
        expect(saved.status).toBe(200); expect(saved.body.saved).toBe(1);
        const preview = await post('/api/workbench/v2/submissions/preview', { workItemIds: [f.item.id] }, technician);
        expect(preview.status).toBe(200); expect(preview.body.totalCompletedItems).toBe(1);
        expect(preview.body.eligibleSamples[0].items.map(item => item.workItemId)).toContain(f.item.id);
        const queue = await request(app).get('/api/workbench/queue').query({ view: 'ready_to_submit', workItemId: f.item.id }).set('Authorization', `Bearer ${technician}`);
        expect(queue.status).toBe(200); expect(queue.body.stats.readyToSubmitCount).toBe(beforeQueue.body.stats.readyToSubmitCount + 1);
        expect(queue.body.groups.flatMap(group => group.items).map(item => item.workItemId)).toContain(f.item.id);
        const old = await prisma.result.findUnique({ where: { id: f.result.id } });
        expect(old.value).toBe('6.2'); expect(old.numericValue).toBe(6.2); expect(old.isCurrent).toBe(false);
        expect((await prisma.result.findFirst({ where: { sampleId: f.sampleId, isCurrent: true } })).numericValue).toBe(6.4);
    });
    test('QC REANALYZE detaches only mutable work and keeps the old package/reason in history', async () => {
        const f = await fixture({ batchStatus: 'QC_FAIL' });
        const accepted = await createWorkItemFixture(prisma, { data: { id: id('WI-07-ACCEPTED'), sampleId: f.sampleId, analysis: f.analysis,
            status: 'ACCEPTED', batchId: f.batch.id, submissionId: f.submission.id, result: '9.1', history: '[{"action":"ACCEPTED"}]', duplicateOf: f.item.id } });
        await require('../helpers/normalizedQcFixture').normalizeLegacyQcFixture(prisma, f.batch.id);
        const response = await post(`/api/qc/batches/${f.batch.id}/disposition`, { decision: 'REANALYZE_BATCH', reason });
        expect(response.status).toBe(200);
        const item = await prisma.workItem.findUnique({ where: { id: f.item.id } });
        expect(item.status).toBe('REPEAT_REQUIRED'); expect(item.submissionId).toBeNull();
        expect(JSON.parse(item.history).at(-1)).toMatchObject({ submissionId: f.submission.id, reason, action: 'REANALYZE_BATCH' });
        expect(await prisma.workItem.findUnique({ where: { id: accepted.id } })).toEqual(accepted);
        expect((await prisma.result.findUnique({ where: { id: f.result.id } })).numericValue).toBe(6.2);
        expect((await prisma.submission.findUnique({ where: { id: f.submission.id } })).workItemIds).toBe(f.submission.workItemIds);
    });
    test('RETURN without an old package still records its reason and remains eligible after recording', async () => {
        const f = await fixture();
        await prisma.workItem.update({ where: { id: f.item.id }, data: { submissionId: null } });
        expect((await returned('individual', f)).status).toBe(200);
        const item = await prisma.workItem.findUnique({ where: { id: f.item.id } });
        expect(item.submissionId).toBeNull(); expect(JSON.parse(item.history).at(-1)).toMatchObject({ submissionId: null, reason });
        expect((await post('/api/workbench/batch-save', { draft: false, entries: [{ workItemId: f.item.id, value: '6.5' }] }, technician)).body.saved).toBe(1);
        expect((await post('/api/workbench/v2/submissions/preview', { workItemIds: [f.item.id] }, technician)).body.totalCompletedItems).toBe(1);
    });
    test.each(['individual', 'bulk'])('%s RETURN and real S2 resubmission cannot be reviewed through S1', async route => {
        const f = await fixture();
        const remaining = await createWorkItemFixture(prisma, { data: { id: id('WI-07-REMAINING'), sampleId: f.sampleId,
            analysis: `${f.analysis}-OTHER`, status: 'SUBMITTED', result: '5.4', assignedLab: labId,
            assignedTo: username, submissionId: f.submission.id } });
        await prisma.submission.update({ where: { id: f.submission.id }, data: {
            workItemIds: JSON.stringify([f.item.id, remaining.id]), workItemCount: 2
        } });
        expect((await returned(route, f)).status).toBe(200);
        expect((await post('/api/workbench/batch-save', { draft: false, entries: [{ workItemId: f.item.id, value: '6.4' }] }, technician)).body.saved).toBe(1);
        const submitted = await post('/api/workbench/v2/submissions/commit', { sampleIds: [f.sampleId], workItemIds: [f.item.id] }, technician);
        expect(submitted.status).toBe(200);
        const newSubmissionId = submitted.body.receipt.submissions[0].submissionId;
        const before = await prisma.workItem.findUnique({ where: { id: f.item.id } });
        expect(before).toMatchObject({ status: 'SUBMITTED', submissionId: newSubmissionId });
        const decisionsBefore = await prisma.reviewDecision.count(), auditsBefore = await prisma.auditLog.count();
        const itemDecisionsBefore = await prisma.reviewDecision.findMany({ where: { workItemId: f.item.id } });
        const itemAuditsBefore = await prisma.auditLog.findMany({ where: { entityId: f.item.id } });
        const oldPackage = await prisma.submission.findUnique({ where: { id: f.submission.id } });
        for (const decision of ['ACCEPT', 'REJECT_REANALYSIS', 'WAIVE']) {
            const refused = await post(`/api/submissions/${f.submission.id}/review`, {
                decisions: [{ workItemId: f.item.id, decision, reason }]
            });
            expect(refused.status).toBe(409); expect(refused.body.code).toBe('ITEM_NOT_SUBMITTED');
            expect(refused.body.errors).toEqual([{ workItemId: f.item.id, code: 'ITEM_NOT_IN_SUBMISSION' }]);
            expect(await prisma.workItem.findUnique({ where: { id: f.item.id } })).toEqual(before);
            expect(await prisma.reviewDecision.count()).toBe(decisionsBefore);
            expect(await prisma.auditLog.count()).toBe(auditsBefore);
            expect(await prisma.submission.findUnique({ where: { id: f.submission.id } })).toEqual(oldPackage);
        }
        const foreign = await post(`/api/submissions/${f.submission.id}/review`, {
            decisions: [{ workItemId: id('NEVER-IN-S1'), decision: 'ACCEPT' }]
        });
        expect(foreign.status).toBe(403); expect(await prisma.auditLog.count()).toBe(auditsBefore);
        const shorthand = await post(`/api/submissions/${f.submission.id}/review`, { status: 'ACCEPTED' });
        expect(shorthand.status).toBe(200);
        expect(shorthand.body.results).toEqual([{ workItemId: remaining.id, status: 'ACCEPTED', decision: 'ACCEPT' }]);
        expect(await prisma.workItem.findUnique({ where: { id: f.item.id } })).toEqual(before);
        expect(await prisma.reviewDecision.findMany({ where: { workItemId: f.item.id } })).toEqual(itemDecisionsBefore);
        expect(await prisma.auditLog.findMany({ where: { entityId: f.item.id } })).toEqual(itemAuditsBefore);
        expect((await prisma.submission.findUnique({ where: { id: f.submission.id } })).status).toBe('REVIEWED');
        const currentReview = await post(`/api/submissions/${newSubmissionId}/review`, {
            decisions: [{ workItemId: f.item.id, decision: 'ACCEPT' }]
        });
        expect(currentReview.status).toBe(200);
        expect((await prisma.workItem.findUnique({ where: { id: f.item.id } })).status).toBe('ACCEPTED');
        expect(await prisma.reviewDecision.findFirst({ where: { workItemId: f.item.id, decision: 'ACCEPT' } })).toMatchObject({ submissionItemId: newSubmissionId });
        expect((await prisma.result.findUnique({ where: { id: f.result.id } })).value).toBe('6.2');
    });
    test('empty shorthand reconciles a stale QC-return package with one summary and no phantom item reviews', async () => {
        const f = await fixture({ batchStatus: 'QC_FAIL' });
        await require('../helpers/normalizedQcFixture').normalizeLegacyQcFixture(prisma, f.batch.id);
        expect((await post(`/api/qc/batches/${f.batch.id}/disposition`, { decision: 'REANALYZE_BATCH', reason })).status).toBe(200);
        expect((await post('/api/workbench/batch-save', { draft: false, entries: [{ workItemId: f.item.id, value: '6.4' }] }, technician)).body.saved).toBe(1);
        const submitted = await post('/api/workbench/v2/submissions/commit', { sampleIds: [f.sampleId], workItemIds: [f.item.id] }, technician);
        expect(submitted.status).toBe(200);
        const before = await prisma.workItem.findUnique({ where: { id: f.item.id } });
        const decisionsBefore = await prisma.reviewDecision.count(), auditsBefore = await prisma.auditLog.count();
        const response = await post(`/api/submissions/${f.submission.id}/review`, { decision: 'ACCEPT' });
        expect(response.status).toBe(200); expect(response.body.results).toEqual([]);
        expect(await prisma.workItem.findUnique({ where: { id: f.item.id } })).toEqual(before);
        expect(await prisma.reviewDecision.count()).toBe(decisionsBefore);
        expect(await prisma.auditLog.count()).toBe(auditsBefore + 1);
        expect(await prisma.auditLog.findFirst({ where: { entityId: f.submission.id, action: 'SUBMISSION_REVIEWED' } })).toMatchObject({
            details: '0 items reviewed; 1 moved to later submissions'
        });
        expect((await prisma.submission.findUnique({ where: { id: f.submission.id } })).status).toBe('REVIEWED');
        const alreadyReviewed = await post(`/api/submissions/${f.submission.id}/review`, { decision: 'ACCEPT' });
        expect(alreadyReviewed.status).toBe(409);
        expect(alreadyReviewed.body).toMatchObject({ code: 'SUBMISSION_NOT_REVIEWABLE', status: 'REVIEWED' });
        expect(await prisma.auditLog.count()).toBe(auditsBefore + 1);
    });
});
