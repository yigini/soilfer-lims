const { createExecutionResultFixture } = require('../helpers/workAttemptFixtures');
const { installWorkAttemptContract } = require('../../scripts/install_work_attempt_contract');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const { createLegacyClosureDatabase, useLegacyRouteDatabase } = require('../helpers/legacyWorkflowDatabase');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken, ensureTestLab } = require('../setup');
const { canPublish } = require('../../services/workEligibility');
const { assembleReport } = require('../../services/reportAssembly');
const { governsResult, isReviewedReportResult } = require('../../services/reportResultGovernance');
const { isInvalidOnlyByQcFailure } = require('../../services/qcService');
const policyService = require('../../services/policyService');
const { setFixtureQcRequirement } = require('../helpers/qcPolicyFixture');
const { SPECTRAL_ACQUISITION_CODES } = require('../../config/spectralAcquisition');
const labId = 'LAB-AUDIT-03';
const id = prefix => `${prefix}-${crypto.randomUUID()}`;
const modes = ['REQUIRED_BLOCKING', 'REQUIRED_WARN', 'ADVISORY', 'OFF'];
const manager = { role: 'LAB_MANAGER', username: 'reviewer' };
const wire = value => JSON.parse(JSON.stringify(value));
const originalPolicy = policyService.get;
const mockQcMode = mode => jest.spyOn(policyService, 'get').mockImplementation((lab, key, context) =>
    key === 'qc.mode' ? mode : originalPolicy(lab, key, context));

describe('Audit 0.3: reviewed results and policy-aware publication', () => {
    let token;
    const ownedDatabases = [];
    beforeAll(async () => { await ensureTestLab(labId, 'GTM'); token = await getAuthToken('LAB_MANAGER', labId); });
    afterEach(() => jest.restoreAllMocks());
    afterAll(async () => { for (const database of ownedDatabases) await database.close(); });
    const call = (path, body) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body);
    async function fixture({ status = 'APPROVED', itemStatus = 'ACCEPTED', param = 'PH_H2O', batchStatus, flags = [], valid = true, linkItemBatch = true, recordResult = true } = {}) {
        const sampleId = id('SMP-03'), workItemId = id('WI-03'), resultId = id('RES-03');
        const batch = batchStatus ? await prisma.batch.create({ data: { id: id('B-03'), analysis: param, status: batchStatus, labId, createdBy: 'review-test',
            qcResults: batchStatus === 'QC_FAIL' ? JSON.stringify({ blanks: [{ value: 2, maxAllowed: 1, status: 'FAIL' }], duplicates: [], controls: [] }) : null } }) : null;
        const sampleData = { id: sampleId, originalId: sampleId, labId: sampleId, assignedLab: labId, status,
            receptionDate: new Date(), dryingStatus: 'DONE', preparationStatus: 'DONE' };
        const itemData = { id: workItemId, sampleId, analysis: param, status: itemStatus, result: '7.2', assignedLab: labId, batchId: linkItemBatch ? batch?.id : null };
        let item;
        if (status === 'COMPLETED' || itemStatus === 'CANCELLED') {
            const now = Date.now();
            const database = await createLegacyClosureDatabase({ analysis: 'ARCHIVING', labId,
                samples: [{ ...sampleData, createdAt: now, updatedAt: now }],
                workItems: [{ ...itemData, createdAt: now, updatedAt: now }],
                batches: batch ? [{ ...batch, createdAt: batch.createdAt.getTime() }] : [] });
            ownedDatabases.push(database); useLegacyRouteDatabase(prisma, database.client);
            expect(installWorkAttemptContract({ dbPath: database.file, apply: true }).classification).toBe('COMPLETE');
            item = await database.client.workItem.findUnique({ where: { id: workItemId } });
        } else {
            await createSampleFixture(prisma, { data: sampleData });
            item = await createWorkItemFixture(prisma, { data: itemData });
        }
        const resultData = { id: resultId, sampleId, param, value: '7.2', numericValue: 7.2, isCurrent: true,
            isValid: valid, flags: JSON.stringify(flags), batchId: batch?.id };
        const result = recordResult ? await createExecutionResultFixture(prisma, {
            ...(['ACCEPTED','SUBMITTED'].includes(itemStatus) && { attemptStatus: itemStatus }), data: resultData }) : null;
        await setFixtureQcRequirement(prisma, token, labId, batch ? 'REQUIRED' : 'NOT_REQUIRED');
        if (batch) await require('../helpers/normalizedQcFixture').normalizeLegacyQcFixture(prisma, batch.id);
        return { sampleId, item, result, batch, resultData };
    }
    const generate = f => call(`/api/reports/generate/${f.sampleId}`, {});
    async function spectralFixture(analysis = 'SPEC_MIR', scanOverrides = {}) {
        const f = await fixture();
        f.spectralItem = await createWorkItemFixture(prisma, { data: {
            id: id('WI-SCAN'), sampleId: f.sampleId, assignedLab: labId, analysis, status: 'ACCEPTED'
        } });
        f.scan = await prisma.spectralData.create({ data: {
            id: id('SCAN'), filename: 'audit-test-spectrum.csv', sampleId: f.sampleId, labId,
            workItemId: f.spectralItem.id, modality: ['SPEC_MIR', 'SPEC_FTIR'].includes(analysis) ? 'MIR' : 'NIR',
            isCurrent: true, status: 'APPROVED', ...scanOverrides
        } });
        return f;
    }

    test.each(SPECTRAL_ACQUISITION_CODES)('accepted %s publishes with exact approved scan and accepted pH result', async analysis => {
        const f = await spectralFixture(analysis);
        expect((await generate(f)).status).toBe(200);
        expect(await prisma.result.count({ where: { sampleId: f.sampleId, param: analysis } })).toBe(0);
    });
    test.each([
        ['unlinked', { workItemId: null }], ['superseded', { isCurrent: false }],
        ['pending', { status: 'PENDING' }], ['rejected', { status: 'REJECTED' }],
        ['wrong sample', { sampleId: 'unrelated-sample' }]
    ])('%s spectral scan cannot evidence an accepted acquisition', async (_, overrides) => {
        const f = await spectralFixture('SPEC_MIR', overrides);
        const before = await prisma.spectralData.findUnique({ where: { id: f.scan.id } });
        const res = await generate(f);
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('ACCEPTED_ITEM_WITHOUT_EVIDENCE');
        expect(res.body.workItemIds).toEqual([f.spectralItem.id]);
        expect(await prisma.spectralData.findUnique({ where: { id: f.scan.id } })).toEqual(before);
        expect(await prisma.report.count({ where: { sampleId: f.sampleId } })).toBe(0);
    });
    test('no scan or a scan linked to another item fails closed', async () => {
        const f = await spectralFixture();
        await prisma.spectralData.update({ where: { id: f.scan.id }, data: { workItemId: f.item.id } });
        expect((await generate(f)).body.code).toBe('ACCEPTED_ITEM_WITHOUT_EVIDENCE');
        await prisma.spectralData.delete({ where: { id: f.scan.id } }); // Synthetic test fixture only.
        expect((await generate(f)).status).toBe(409);
    });
    test.each(['SPEC_GRS', 'SPEC_XRF'])('%s continues to require and record scalar Results', async analysis => {
        const f = await fixture({ param: analysis });
        expect((await generate(f)).status).toBe(200);
        const techToken = await getAuthToken('LAB_TECHNICIAN', labId);
        const acquisition = await fixture({ status: 'PROCESSING', itemStatus: 'IN_PROGRESS', param: analysis });
        await prisma.workItem.update({ where: { id: acquisition.item.id }, data: { assignedTo: jwt.decode(techToken).username } });
        const saved = await request(app).post('/api/workbench/batch-save').set('Authorization', `Bearer ${techToken}`)
            .send({ draft: false, entries: [{ workItemId: acquisition.item.id, value: '12' }] });
        expect(saved.status).toBe(200);
        expect(saved.body.saved).toBe(1);
        expect((await prisma.result.findFirst({ where: { sampleId: acquisition.sampleId, param: analysis, isCurrent: true } })).numericValue).toBe(12);
        expect((await prisma.result.findUnique({ where: { id: acquisition.result.id } })).isCurrent).toBe(false);
        expect((await prisma.result.findUnique({ where: { id: f.result.id } })).isCurrent).toBe(true);
    });
    async function reportValues(f, language = 'en') {
        const { content } = await assembleReport(f.sampleId, { ...manager, language });
        return { content, values: content.resultGroups.flatMap(group => group.items) };
    }
    async function reviewedState(f) {
        return wire({ sample: await prisma.sample.findUnique({ where: { id: f.sampleId } }),
            item: await prisma.workItem.findUnique({ where: { id: f.item.id } }), result: await prisma.result.findUnique({ where: { id: f.result.id } }),
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
        ? call(`/api/work/${f.item.id}/review`, { status: 'REANALYSIS_REQUIRED', reasonCode:'REVIEW_OUTLIER', reason: 'Recheck drift' })
        : path === 'bulk' ? call('/api/work/review/bulk', { workItemIds: [f.item.id], status: 'REANALYSIS_REQUIRED', reasonCode:'REVIEW_OUTLIER', reason: 'Recheck drift' })
            : call(`/api/submissions/${f.submission.id}/review`, { decisions: [{ workItemId: f.item.id, decision: 'REJECT_REANALYSIS', reasonCode:'REVIEW_OUTLIER', reason: 'Recheck drift' }] });

    test.each(['COMPLETED', 'SUBMITTED_FULL', 'PROCESSING'])('%s sample cannot publish', async status => {
        const res = await generate(await fixture({ status }));
        expect(res.status).toBe(409); expect(res.body.code).toBe('SAMPLE_NOT_APPROVED');
    });
    test.each(['REPEAT_REQUIRED', 'SUBMITTED', 'COMPLETED'])('%s analytical work blocks even an approved sample', async itemStatus => {
        const f = await fixture({ itemStatus });
        const res = await generate(f);
        expect(res.status).toBe(409); expect(res.body.code).toBe('ITEMS_NOT_ACCEPTED'); expect(res.body.workItemIds).toEqual([f.item.id]);
        expect(await prisma.report.count({ where: { sampleId: f.sampleId } })).toBe(0);
    });
    test.each(modes)('%s never bypasses manager review', async mode => {
        mockQcMode(mode);
        const res = await generate(await fixture({ itemStatus: 'REPEAT_REQUIRED' }));
        expect(res.status).toBe(409); expect(res.body.code).toBe('ITEMS_NOT_ACCEPTED');
    });
    test('RUNNING QC blocks with a stable 409', async () => {
        const f = await fixture({ batchStatus: 'RUNNING' });
        const res = await generate(f);
        expect(res.status).toBe(409); expect(res.body.code).toBe('QC_GATE_NOT_EVALUATED');
    });
    test('QC attached only to a result still blocks', async () => {
        const f = await fixture({ batchStatus: 'RUNNING', linkItemBatch: false });
        expect((await generate(f)).body.code).toBe('QC_GATE_NOT_EVALUATED');
    });
    test('a missing linked batch fails closed', () => {
        const result = { id: 'r', sampleId: 's', param: 'PH_H2O', isCurrent: true, isValid: true, batchId: 'missing' };
        expect(canPublish({ status: 'APPROVED', workItems: [{ id: 'w', sampleId: 's', analysis: 'PH_H2O', status: 'ACCEPTED' }], results: [result] }, null, manager).code).toBe('QC_GATE_NOT_EVALUATED');
    });
    test('unresolved policy mode fails closed', async () => {
        mockQcMode('UNKNOWN');
        const res = await generate(await fixture());
        expect(res.status).toBe(409); expect(res.body.code).toBe('QC_POLICY_UNRESOLVED');
    });
    test('legacy accepted no-batch work with an explicit lab waiver can publish', async () => expect((await generate(await fixture())).status).toBe(200));
    test('unfinished drying and preparation gates do not count as analytical publication work', async () => {
        const f = await fixture();
        for (const analysis of ['DRYING', 'PREPARATION']) await createWorkItemFixture(prisma, { data: {
            id: id('GATE-03'), sampleId: f.sampleId, analysis, status: 'ASSIGNED', assignedLab: labId
        } });
        expect((await generate(f)).status).toBe(200);
        expect((await reportValues(f)).values).toHaveLength(1);
    });
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
        const f = await fixture({ itemStatus, valid: true, batchStatus: 'QC_FAIL', flags: ['METHOD_NOTE'] });
        const before = await reviewedState(f);
        const res = await generate(f); expect(res.status).toBe(200);
        const { content, values } = await reportValues(f);
        expect(values).toHaveLength(0);
        expect(content.meta.assembly.omittedByDisposition).toEqual([{ param: 'PH_H2O', itemIds: [f.item.id] }]);
        expect((await reviewedState(f)).result).toEqual(before.result);
    });
    test('a mix of waived and accepted matches prints once and preserves the stored row', async () => {
        const f = await fixture();
        await createWorkItemFixture(prisma, { data: { id: id('WI-OMIT-03'), sampleId: f.sampleId, analysis: f.item.analysis, status: 'WAIVED', duplicateOf: f.item.id } });
        const before = await reviewedState(f);
        expect((await generate(f)).status).toBe(200);
        const { content, values } = await reportValues(f);
        expect(values).toHaveLength(1); expect(content.meta.assembly.omittedByDisposition).toEqual([]);
        expect((await reviewedState(f)).result).toEqual(before.result);
    });
    test('composite texture governs sand, silt, clay and texture without duplicating values', async () => {
        const { createCompositeTextureExecutionFixture } = require('../helpers/workAttemptFixtures');
        const f = await fixture({ param: 'TEXTURE', recordResult: false });
        const results = await createCompositeTextureExecutionFixture(prisma, { attemptStatus: 'ACCEPTED',
            data: [f.resultData, ...['SAND', 'SILT', 'CLAY'].map(param => ({ id: id('TEXT-03'),
                sampleId: f.sampleId, param, value: '25', isCurrent: true }))] });
        f.result = results.find(row => row.param === 'TEXTURE');
        expect(new Set(results.map(row => row.attemptId))).toEqual(new Set([f.result.attemptId]));
        expect(await prisma.workAttempt.findUnique({ where: { id: f.result.attemptId } })).toMatchObject({ workItemId: f.item.id });
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
        const other = await createWorkItemFixture(prisma, { data: { id: id('WI-03'), sampleId: f.sampleId, analysis: f.item.analysis, status: 'ACCEPTED', assignedLab: labId, duplicateOf: f.item.id } });
        expect((await reportValues(f)).values).toHaveLength(1);
        const returned = await fixture({ itemStatus: 'REPEAT_REQUIRED' });
        await createWorkItemFixture(prisma, { data: { id: id('WI-03'), sampleId: returned.sampleId, analysis: returned.item.analysis,
            status: 'ACCEPTED', assignedLab: labId, duplicateOf: returned.item.id } });
        expect((await reportValues(returned)).values).toHaveLength(0);
        expect((await prisma.workItem.findUnique({ where: { id: other.id } })).status).toBe('ACCEPTED');
    });
    test.each(modes)('QC_FAIL in %s retains storage and applies the policy at read time', async mode => {
        const f = await fixture({ batchStatus: 'QC_FAIL', valid: false, flags: ['QC_BATCH_FAILED'],
            ...(mode === 'REQUIRED_WARN' && { status: 'PROCESSING', itemStatus: 'SUBMITTED' }) });
        const policy = mockQcMode(mode);
        if (mode === 'REQUIRED_WARN') {
            const review = await call(`/api/work/${f.item.id}/review`, { status: 'ACCEPTED', qcAcknowledgement: { reason: 'Retained QC warning checked' } });
            expect(review.status).toBe(200);
            await require('../../services/sampleStateService').transitionSample(f.sampleId, 'APPROVED', jwt.decode(token), 'Reviewed warning fixture');
        }
        const before = await reviewedState(f);
        const res = await generate(f);
        expect(policy).toHaveBeenCalledWith(labId, 'qc.mode', { analysisCode: 'PH_H2O', methodologyId: null,
            db: expect.objectContaining({ lab: expect.anything() }) });
        if (mode === 'REQUIRED_BLOCKING') { expect(res.status).toBe(409); expect(res.body.code).toBe('QC_GATE_FAILED'); }
        else {
            expect(res.status).toBe(200);
            const report = await prisma.report.findUnique({ where: { id: res.body.id } });
            const content = JSON.parse(report.content);
            expect(content.resultGroups.flatMap(group => group.items)).toHaveLength(1);
            if (mode === 'OFF') {
                expect(content.qcWarnings).toEqual([]);
                expect(content.qcStatement).toContain(require('../../locales/en.json').resultReports.qcNotRequired);
            } else {
                expect(content.qcWarnings).toEqual([expect.objectContaining({ resultId: f.result.id, batchId: f.batch.id,
                    analysisCode: 'PH_H2O', qcStatus: 'FAIL', dispositionDecision: null, dispositionReason: null })]);
                expect(content.qcWarningStatement).toMatch(/QC warning/);
                if (mode === 'REQUIRED_WARN') {
                    expect(content.qcWarnings[0].acknowledgement).toMatchObject({ actor: jwt.decode(token).username, reason: 'Retained QC warning checked' });
                    expect(content.qcStatement).toContain('Retained QC warning checked');
                }
            }
            await prisma.batch.update({ where: { id: f.batch.id }, data: { status: 'QC_PASS' } });
            expect((await prisma.report.findUnique({ where: { id: res.body.id } })).content).toBe(report.content);
        }
        expect((await reviewedState(f)).result).toEqual(before.result);
    });
    test.each(modes.flatMap(mode => ['ORIGINALLY_INVALID', 'REVIEW_RETURNED', 'QC_BATCH_REJECTED', 'QC_BATCH_REANALYZE_REQUESTED', 'METHOD_INVALID'].map(flag => [mode, flag])))('%s never prints an independently invalid %s result', async (mode, flag) => {
        mockQcMode(mode);
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
        mockQcMode('REQUIRED_WARN');
        const f = await fixture({ batchStatus: 'QC_FAIL', valid: false, flags: ['QC_BATCH_FAILED'] });
        expect((await reportValues(f, language)).content.qcWarningStatement).toBe(require(`../../locales/${language}.json`).resultReports.qcWarningStatement);
    });
    test.each(['individual', 'bulk', 'submission'])('%s RETURN preserves values, merges flags and prevents assembly', async path => {
        const f = await returnFixture(path);
        const res = await returnItem(path, f);
        expect(res.status).toBe(200);
        const after = await reviewedState(f);
        expect(after.item.status).toBe('REPEAT_REQUIRED'); expect(after.result.isValid).toBe(false);
        expect(after.result.value).toBe('7.2'); expect(after.result.numericValue).toBe(7.2);
        expect(JSON.parse(after.result.flags)).toEqual(['METHOD_NOTE', 'REVIEW_RETURNED']);
        const log = after.audit.find(row => row.entity === 'RESULT' && row.action === 'REVIEW_RETURNED');
        expect(JSON.parse(log.details)).toEqual({ workItemId: f.item.id, reason: 'Recheck drift' });
        const { content, values } = await reportValues(f);
        expect(values).toHaveLength(0); expect(content.workItems[0].result).toBeNull();
    });
    test('RETURN of composite texture invalidates all four current parameters', async () => {
        const { createCompositeTextureExecutionFixture } = require('../helpers/workAttemptFixtures');
        const f = await fixture({ status: 'PROCESSING', itemStatus: 'SUBMITTED', param: 'TEXTURE', recordResult: false });
        const recorded = await createCompositeTextureExecutionFixture(prisma, { attemptStatus:'SUBMITTED', data: [f.resultData,
            ...['SAND', 'SILT', 'CLAY'].map(param => ({ id: id('TEXT-RETURN-03'), sampleId: f.sampleId,
                param, value: '25', isCurrent: true, isValid: true, flags: '["METHOD_NOTE"]' }))] });
        f.result = recorded.find(row => row.param === 'TEXTURE');
        expect(new Set(recorded.map(row => row.attemptId))).toEqual(new Set([f.result.attemptId]));
        expect(await prisma.workAttempt.findUnique({ where: { id: f.result.attemptId } })).toMatchObject({ workItemId: f.item.id });
        expect((await returnItem('individual', f)).status).toBe(200);
        const results = await prisma.result.findMany({ where: { sampleId: f.sampleId } });
        expect(results).toHaveLength(4);
        expect(results.every(row => row.isValid === false && JSON.parse(row.flags).includes('REVIEW_RETURNED'))).toBe(true);
        expect(await prisma.auditLog.count({ where: { sampleId: f.sampleId, entity: 'RESULT', action: 'REVIEW_RETURNED' } })).toBe(4);
    });
    test('RETURN with malformed flags fails closed and preserves all records', async () => {
        const f = await returnFixture('individual');
        await prisma.result.update({ where: { id: f.result.id }, data: { flags: '{malformed' } });
        const before = await reviewedState(f);
        const res = await returnItem('individual', f);
        expect(res.status).toBe(409); expect(res.body.code).toBe('RESULT_FLAGS_INVALID');
        expect(await reviewedState(f)).toEqual(before);
    });
    test('RETURN invalidates a shared current result even if another governing item is accepted', async () => {
        const f = await returnFixture('individual');
        await createWorkItemFixture(prisma, { data: { id: id('WI-03'), sampleId: f.sampleId, analysis: f.item.analysis, status: 'ACCEPTED', duplicateOf: f.item.id } });
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
    test.each(['individual', 'bulk', 'submission'])('%s RETURN of accepted work refuses amendments and preserves the published snapshot and all review records', async path => {
        const f = await fixture();
        if (path === 'submission') {
            f.submission = await prisma.submission.create({ data: { id: id('SUB-FINAL-03'), sampleId: f.sampleId, assignedLab: labId,
                submittedBy: jwt.decode(token).username, status: 'PENDING_REVIEW', type: 'FULL', workItemCount: 1,
                workItemIds: JSON.stringify([f.item.id]) } });
            await prisma.workItem.update({ where: { id: f.item.id }, data: { submissionId: f.submission.id } });
        }
        const res = await generate(f); expect(res.status).toBe(200);
        const before = await prisma.report.findUnique({ where: { id: res.body.id } });
        const records = await reviewedState(f);
        const submissionBefore = f.submission && await prisma.submission.findUnique({ where: { id: f.submission.id } });
        const returned = await returnItem(path, f);
        expect(returned.status).toBe(409); expect(returned.body.code).toBe('AMENDMENT_WORKFLOW_REQUIRED');
        expect(await reviewedState(f)).toEqual(records);
        if (f.submission) expect(await prisma.submission.findUnique({ where: { id: f.submission.id } })).toEqual(submissionBefore);
        expect(await prisma.report.findUnique({ where: { id: before.id } })).toEqual(before);
    });
});
