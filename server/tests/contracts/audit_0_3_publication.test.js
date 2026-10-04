const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');
const { canPublish } = require('../../services/workEligibility');
const { assembleReport } = require('../../services/reportAssembly');
const { governsResult, isReviewedReportResult } = require('../../services/reportResultGovernance');
const { isInvalidOnlyByQcFailure } = require('../../services/qcService');
const policyService = require('../../services/policyService');
const labId = 'LAB-AUDIT-03';
const id = prefix => `${prefix}-${crypto.randomUUID()}`;
const modes = ['REQUIRED_BLOCKING', 'REQUIRED_WARN', 'ADVISORY', 'OFF'];
const manager = { role: 'LAB_MANAGER', username: 'reviewer' };
const wire = value => JSON.parse(JSON.stringify(value));

describe('Audit 0.3: reviewed results and policy-aware publication', () => {
    let token;
    beforeAll(async () => { token = await getAuthToken('LAB_MANAGER', labId); });
    afterEach(() => jest.restoreAllMocks());
    const call = (path, body) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body);
    async function fixture({ status = 'APPROVED', itemStatus = 'ACCEPTED', param = 'PH_H2O', batchStatus, flags = [], valid = true } = {}) {
        const sampleId = id('SMP-03'), workItemId = id('WI-03'), resultId = id('RES-03');
        const batch = batchStatus ? await prisma.batch.create({ data: { id: id('B-03'), analysis: param, status: batchStatus, labId, createdBy: 'review-test' } }) : null;
        await prisma.sample.create({ data: { id: sampleId, originalId: sampleId, labId: sampleId, assignedLab: labId, status } });
        const item = await prisma.workItem.create({ data: { id: workItemId, sampleId, analysis: param, status: itemStatus, result: '7.2', assignedLab: labId, batchId: batch?.id } });
        const result = await prisma.result.create({ data: { id: resultId, sampleId, param, value: '7.2', numericValue: 7.2, isCurrent: true,
            isValid: valid, flags: JSON.stringify(flags), batchId: batch?.id } });
        return { sampleId, item, result, batch };
    }
    const generate = f => call(`/api/reports/generate/${f.sampleId}`, {});
    async function reportValues(f, language = 'en') {
        const { content } = await assembleReport(f.sampleId, { ...manager, language });
        return { content, values: content.resultGroups.flatMap(group => group.items) };
    }
    async function reviewedState(f) {
        return wire({ item: await prisma.workItem.findUnique({ where: { id: f.item.id } }), result: await prisma.result.findUnique({ where: { id: f.result.id } }),
            decisions: await prisma.reviewDecision.findMany({ where: { workItemId: f.item.id } }), audit: await prisma.auditLog.findMany({ where: { sampleId: f.sampleId } }) });
    }
    async function returnFixture(path) {
        const f = await fixture({ status: 'PROCESSING', itemStatus: 'SUBMITTED', flags: ['METHOD_NOTE'] });
        if (path === 'submission') {
            f.submission = await prisma.submission.create({ data: { id: id('SUB-03'), sampleId: f.sampleId, assignedLab: labId,
                submittedBy: jwt.decode(token).username, status: 'PENDING_REVIEW', type: 'PARTIAL', workItemCount: 1, workItemIds: JSON.stringify([f.item.id]) } });
            await prisma.workItem.update({ where: { id: f.item.id }, data: { submissionId: f.submission.id } });
        }
        return f;
    }
    const returnItem = (path, f) => path === 'individual'
        ? call(`/api/work/${f.item.id}/review`, { status: 'REANALYSIS_REQUIRED', reason: 'Recheck drift' })
        : path === 'bulk' ? call('/api/work/review/bulk', { workItemIds: [f.item.id], status: 'REANALYSIS_REQUIRED', reason: 'Recheck drift' })
            : call(`/api/submissions/${f.submission.id}/review`, { decisions: [{ workItemId: f.item.id, decision: 'REJECT_REANALYSIS', reason: 'Recheck drift' }] });

    test.each(['COMPLETED', 'SUBMITTED_FULL', 'PROCESSING'])('%s sample cannot publish', async status => {
        const res = await generate(await fixture({ status }));
        expect(res.status).toBe(409); expect(res.body.code).toBe('SAMPLE_NOT_APPROVED');
    });
    test.each(['REANALYSIS_REQUIRED', 'SUBMITTED', 'COMPLETED'])('%s analytical work blocks even an approved sample', async itemStatus => {
        const f = await fixture({ itemStatus });
        const res = await generate(f);
        expect(res.status).toBe(409); expect(res.body.code).toBe('ITEMS_NOT_ACCEPTED'); expect(res.body.workItemIds).toEqual([f.item.id]);
        expect(await prisma.report.count({ where: { sampleId: f.sampleId } })).toBe(0);
    });
    test('RUNNING QC blocks with a stable 409', async () => {
        const f = await fixture({ batchStatus: 'RUNNING' });
        const res = await generate(f);
        expect(res.status).toBe(409); expect(res.body.code).toBe('QC_BATCH_PENDING');
    });
    test('QC attached only to a result still blocks', async () => {
        const f = await fixture({ batchStatus: 'RUNNING' });
        await prisma.workItem.update({ where: { id: f.item.id }, data: { batchId: null } });
        expect((await generate(f)).body.code).toBe('QC_BATCH_PENDING');
    });
    test('a missing linked batch fails closed', () => {
        const result = { id: 'r', sampleId: 's', param: 'PH_H2O', isCurrent: true, isValid: true, batchId: 'missing' };
        expect(canPublish({ status: 'APPROVED', workItems: [{ id: 'w', sampleId: 's', analysis: 'PH_H2O', status: 'ACCEPTED' }], results: [result] }, null, manager).code).toBe('QC_BATCH_PENDING');
    });
    test('legacy accepted no-batch work can publish', async () => expect((await generate(await fixture())).status).toBe(200));
    test('ungoverned current result blocks and lists params', async () => {
        const f = await fixture();
        await prisma.workItem.update({ where: { id: f.item.id }, data: { analysis: 'EC' } });
        const res = await generate(f);
        expect(res.status).toBe(409); expect(res.body.code).toBe('RESULT_UNGOVERNED'); expect(res.body.params).toEqual(['PH_H2O']);
    });
    test('an accepted item without a current valid result blocks', async () => {
        const f = await fixture({ valid: false, flags: ['REVIEW_RETURNED'] });
        const res = await generate(f);
        expect(res.status).toBe(409); expect(res.body.code).toBe('ACCEPTED_ITEM_WITHOUT_VALID_RESULT'); expect(res.body.workItemIds).toEqual([f.item.id]);
    });
    test.each(['WAIVED', 'CANCELLED'])('%s work neither blocks nor prints a value', async itemStatus => {
        const f = await fixture({ itemStatus, valid: false });
        expect((await generate(f)).status).toBe(200);
        expect((await reportValues(f)).values).toHaveLength(0);
    });
    test('composite texture governs sand, silt, clay and texture without duplicating values', async () => {
        const f = await fixture({ param: 'TEXTURE' });
        for (const param of ['SAND', 'SILT', 'CLAY']) await prisma.result.create({ data: { id: id('TEXT-03'), sampleId: f.sampleId, param, value: '25', isCurrent: true } });
        expect((await reportValues(f)).values.map(row => row.param).sort()).toEqual(['CLAY', 'SAND', 'SILT', 'TEXTURE']);
        expect(governsResult({ ...f.item, analysis: 'SAND' }, { ...f.result, param: 'CLAY' })).toBe(false);
    });
    test('methodology conflicts prevent governance while a null method matches', () => {
        const item = { sampleId: 's', analysis: 'PH_H2O', status: 'ACCEPTED', methodologyId: 'method-1' };
        const result = { sampleId: 's', param: 'PH_H2O', isCurrent: true, methodologyId: 'method-2' };
        expect(isReviewedReportResult(result, [item])).toBe(false);
        expect(isReviewedReportResult({ ...result, methodologyId: null }, [item])).toBe(true);
    });
    test('two governing items print one current result only when both are accepted', async () => {
        const f = await fixture();
        const other = await prisma.workItem.create({ data: { id: id('WI-03'), sampleId: f.sampleId, analysis: f.item.analysis, status: 'ACCEPTED', assignedLab: labId } });
        expect((await reportValues(f)).values).toHaveLength(1);
        await prisma.workItem.update({ where: { id: other.id }, data: { status: 'REANALYSIS_REQUIRED' } });
        expect((await reportValues(f)).values).toHaveLength(0);
    });
    test.each(modes)('QC_FAIL in %s retains storage and applies the policy at read time', async mode => {
        const f = await fixture({ batchStatus: 'QC_FAIL', valid: false, flags: ['QC_BATCH_FAILED'] });
        const policy = jest.spyOn(policyService, 'get').mockReturnValue(mode);
        const before = await reviewedState(f);
        const res = await generate(f);
        expect(policy).toHaveBeenCalledWith(labId, 'qc.mode', { analysisCode: 'PH_H2O', methodologyId: null });
        if (mode === 'REQUIRED_BLOCKING') { expect(res.status).toBe(409); expect(res.body.code).toBe('QC_BATCH_FAILED'); }
        else {
            expect(res.status).toBe(200);
            const report = await prisma.report.findUnique({ where: { id: res.body.id } });
            const content = JSON.parse(report.content);
            expect(content.resultGroups.flatMap(group => group.items)).toHaveLength(1);
            expect(content.qcWarnings).toEqual([{ batchId: f.batch.id, analysisCode: 'PH_H2O', qcStatus: 'QC_FAIL', dispositionDecision: null }]);
            expect(content.qcWarningStatement).toMatch(/QC warning/);
            await prisma.batch.update({ where: { id: f.batch.id }, data: { status: 'QC_PASS' } });
            expect((await prisma.report.findUnique({ where: { id: res.body.id } })).content).toBe(report.content);
        }
        expect((await reviewedState(f)).result).toEqual(before.result);
    });
    test.each(modes.flatMap(mode => ['ORIGINALLY_INVALID', 'REVIEW_RETURNED', 'QC_BATCH_REJECTED', 'QC_BATCH_REANALYZE_REQUESTED', 'METHOD_INVALID'].map(flag => [mode, flag])))('%s never prints an independently invalid %s result', async (mode, flag) => {
        jest.spyOn(policyService, 'get').mockReturnValue(mode);
        const f = await fixture({ batchStatus: 'QC_FAIL', valid: false, flags: ['QC_BATCH_FAILED', flag] });
        const before = await reviewedState(f);
        expect((await reportValues(f)).values).toHaveLength(0);
        expect((await reviewedState(f)).result).toEqual(before.result);
        expect((await generate(f)).status).toBe(409);
    });
    test.each(['{bad', '{}', '["QC_BATCH_FAILED",{}]'])('malformed or unknown flags %s cannot qualify for the QC-only exception', flags => {
        expect(isInvalidOnlyByQcFailure({ isValid: false, flags })).toBe(false);
    });
    test.each(['en', 'es', 'es-419', 'fr', 'pt'])('QC caveat is frozen in %s', async language => {
        jest.spyOn(policyService, 'get').mockReturnValue('REQUIRED_WARN');
        const f = await fixture({ batchStatus: 'QC_FAIL', valid: false, flags: ['QC_BATCH_FAILED'] });
        expect((await reportValues(f, language)).content.qcWarningStatement).toBe(require(`../../locales/${language}.json`).resultReports.qcWarningStatement);
    });
    test.each(['individual', 'bulk', 'submission'])('%s RETURN preserves values, merges flags and prevents assembly', async path => {
        const f = await returnFixture(path);
        const res = await returnItem(path, f);
        expect(res.status).toBe(200);
        const after = await reviewedState(f);
        expect(after.item.status).toBe('REANALYSIS_REQUIRED'); expect(after.result.isValid).toBe(false);
        expect(after.result.value).toBe('7.2'); expect(after.result.numericValue).toBe(7.2);
        expect(JSON.parse(after.result.flags)).toEqual(['METHOD_NOTE', 'REVIEW_RETURNED']);
        const log = after.audit.find(row => row.entity === 'RESULT' && row.action === 'REVIEW_RETURNED');
        expect(JSON.parse(log.details)).toEqual({ workItemId: f.item.id, reason: 'Recheck drift' });
        const { content, values } = await reportValues(f);
        expect(values).toHaveLength(0); expect(content.workItems[0].result).toBeNull();
    });
    test('RETURN invalidates a shared current result even if another governing item is accepted', async () => {
        const f = await returnFixture('individual');
        await prisma.workItem.create({ data: { id: id('WI-03'), sampleId: f.sampleId, analysis: f.item.analysis, status: 'ACCEPTED' } });
        expect((await returnItem('individual', f)).status).toBe(200);
        expect((await prisma.result.findUnique({ where: { id: f.result.id } })).isValid).toBe(false);
    });
    test.each(['individual', 'bulk', 'submission'])('%s audit failure rolls back RETURN and result invalidation together', async path => {
        const f = await returnFixture(path), before = await reviewedState(f);
        const trigger = 'fail_audit_03_return';
        await prisma.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON AuditLog WHEN NEW.entityId = '${f.result.id}' AND NEW.action = 'REVIEW_RETURNED' BEGIN SELECT RAISE(ABORT, 'simulated audit failure'); END`);
        try {
            expect((await returnItem(path, f)).status).toBe(500);
            expect(await reviewedState(f)).toEqual(before);
        } finally { await prisma.$executeRawUnsafe(`DROP TRIGGER ${trigger}`); }
    });
    test('RETURN preserves an existing published report snapshot', async () => {
        const f = await fixture();
        const res = await generate(f); expect(res.status).toBe(200);
        const before = await prisma.report.findUnique({ where: { id: res.body.id } });
        await prisma.workItem.update({ where: { id: f.item.id }, data: { status: 'SUBMITTED' } });
        expect((await returnItem('individual', f)).status).toBe(200);
        expect(await prisma.report.findUnique({ where: { id: before.id } })).toEqual(before);
    });
});
