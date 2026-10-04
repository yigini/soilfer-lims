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
        await prisma.sample.create({ data: { id: sampleId, originalId: sampleId, labId: sampleId, assignedLab: labId,
            status: 'PROCESSING', receptionDate: new Date(), dryingStatus: 'DONE', preparationStatus: 'DONE' } });
        const batch = batchStatus ? await prisma.batch.create({ data: { id: id('B-07'), analysis, status: batchStatus, labId, createdBy: username } }) : null;
        const itemId = id('WI-07'), submissionId = id('SUB-07');
        const submission = await prisma.submission.create({ data: { id: submissionId, sampleId, assignedLab: labId, submittedBy: username,
            status: 'PENDING_REVIEW', type: 'PARTIAL', workItemCount: 1, workItemIds: JSON.stringify([itemId]) } });
        const item = await prisma.workItem.create({ data: { id: itemId, sampleId, analysis, assignedLab: labId, assignedTo: username,
            status: itemStatus, result: '6.2', submissionId, batchId: batch?.id, history: JSON.stringify([{ action: 'SUBMITTED', submissionId }]) } });
        const result = await prisma.result.create({ data: { id: id('R-07'), sampleId, param: analysis, value: '6.2', numericValue: 6.2,
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
        expect(item.status).toBe('REANALYSIS_REQUIRED'); expect(item.submissionId).toBeNull();
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
        const accepted = await prisma.workItem.create({ data: { id: id('WI-07-ACCEPTED'), sampleId: f.sampleId, analysis: f.analysis,
            status: 'ACCEPTED', batchId: f.batch.id, submissionId: f.submission.id, result: '9.1', history: '[{"action":"ACCEPTED"}]' } });
        const response = await post(`/api/qc/batches/${f.batch.id}/disposition`, { decision: 'REANALYZE_BATCH', reason });
        expect(response.status).toBe(200);
        const item = await prisma.workItem.findUnique({ where: { id: f.item.id } });
        expect(item.status).toBe('REANALYSIS_REQUIRED'); expect(item.submissionId).toBeNull();
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
});
