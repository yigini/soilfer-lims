const { createExecutionResultFixture } = require('../helpers/workAttemptFixtures');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const Database = require('better-sqlite3');
const PDFDocument = require('pdfkit');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken, ensureTestLab } = require('../setup');
const policy = require('../../services/policyService');
const { allocateReportIdentity, publicationYear } = require('../../services/reportNumberService');
const { freezeReportEvidence, describeReportEvidence } = require('../../services/reportTruthfulnessService');
const { generateReportPdfBuffer } = require('../../services/pdfGenerator');
const id = prefix => `${prefix}-${crypto.randomUUID()}`;
const labId = 'LAB-AUDIT-08';
const snapshot = { sample: { id: 's' }, lab: {}, client: {}, generated: {}, resultGroups: [] };
const { normalizeLegacyQcFixture } = require('../helpers/normalizedQcFixture');

describe('Audit 0.8: issued identity and truthful report evidence', () => {
    let token, lab;
    beforeAll(async () => {
        lab = await ensureTestLab(labId, 'GTM');
        token = await getAuthToken('LAB_MANAGER', labId);
    });
    afterEach(() => jest.restoreAllMocks());
    async function fixture(batchStatus = 'QC_PASS', disposition, { reviewNeeded = false } = {}) {
        const sampleId = id('SMP-08');
        const batch = await prisma.batch.create({ data: { id: id('B-08'), analysis: 'PH_H2O', status: batchStatus,
            disposition: disposition ? JSON.stringify(disposition) : null, labId, createdBy: 'report-test',
            qcResults: JSON.stringify({ blanks: [{ value: batchStatus === 'QC_FAIL' ? 100 : 0.01, status: batchStatus === 'QC_FAIL' ? 'FAIL' : 'PASS' }], controls: [], duplicates: [] }) } });
        await createSampleFixture(prisma, { data: { id: sampleId, originalId: sampleId, labId: sampleId, assignedLab: labId,
            status: reviewNeeded ? 'PROCESSING' : 'APPROVED', receptionDate: new Date(), dryingStatus: 'DONE', preparationStatus: 'DONE' } });
        const item = await createWorkItemFixture(prisma, { data: { id: id('WI-08'), sampleId, analysis: 'PH_H2O',
            status: reviewNeeded ? 'SUBMITTED' : 'ACCEPTED', result: '6.2', batchId: batch.id } });
        await createExecutionResultFixture(prisma, { attemptStatus: item.status,
            data: { id: id('R-08'), sampleId, param: 'PH_H2O', value: '6.2', numericValue: 6.2,
            isCurrent: true, isValid: true, batchId: batch.id } });
        await normalizeLegacyQcFixture(prisma, batch.id);
        return { sampleId, batch, item };
    }
    async function generate(f) {
        const response = await request(app).post(`/api/reports/generate/${f.sampleId}`).set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(200);
        return prisma.report.findUnique({ where: { id: response.body.id } });
    }
    function mockPolicy(key, value) {
        const original = policy.get;
        return jest.spyOn(policy, 'get').mockImplementation((lab, requested, context) => requested === key ? value : original(lab, requested, context));
    }
    async function legacy(f, version, number, status = 'PUBLISHED') {
        return prisma.report.create({ data: { sampleId: f.sampleId, labId, version, status, generatedBy: 'historical-fixture', publishedAt: new Date('2020-03-04T12:00:00Z'),
            content: JSON.stringify({ ...snapshot, reportNumber: number }) } });
    }
    test('two simultaneous real publications have different bases and committed counter values', async () => {
        const fixtures = await Promise.all([fixture(), fixture()]);
        const reports = await Promise.all(fixtures.map(generate));
        expect(new Set(reports.map(r => r.reportNumberBase)).size).toBe(2);
        expect(reports.every(r => r.revision === 0)).toBe(true);
        const sequences = reports.map(r => Number(r.reportNumberBase.split('-').at(-1))).sort((a, b) => a - b);
        expect(sequences[1]).toBe(sequences[0] + 1);
    });
    test('revisions reuse the base without incrementing the counter; policy changes affect new lineages only', async () => {
        const f = await fixture();
        const first = await generate(f);
        const counter = await prisma.reportSequence.findUnique({ where: { labId_year: { labId, year: publicationYear(first.publishedAt, lab.timezone) } } });
        mockPolicy('report.numberFormat', 'NEW-{LAB}-{YYYY}-{SEQ:6}');
        const second = await generate(f), third = await generate(f);
        expect([second.reportNumberBase, third.reportNumberBase]).toEqual([first.reportNumberBase, first.reportNumberBase]);
        expect([second.revision, third.revision]).toEqual([1, 2]);
        expect(JSON.parse(third.content).reportNumber).toBe(`${first.reportNumberBase} rev 2`);
        expect(JSON.parse(third.content).publication.replacesReportNumber).toBe(`${first.reportNumberBase} rev 1`);
        expect(await prisma.reportSequence.findUnique({ where: { labId_year: { labId, year: counter.year } } })).toEqual(counter);
        expect((await generate(await fixture())).reportNumberBase).toMatch(/^NEW-/);
    });
    test('latest issued legacy number anchors rev 1; older content and v1 PDF remain exact', async () => {
        const f = await fixture(), prefix = id('LEGACY');
        const v1 = await legacy(f, 1, `${prefix}-v1`, 'SUPERSEDED');
        const v2 = await legacy(f, 2, `${prefix}-v2`);
        await prisma.report.create({ data: { sampleId: f.sampleId, labId, version: 3, status: 'DRAFT', generatedBy: 'draft-fixture', content: JSON.stringify({ reportNumber: 'DO-NOT-ANCHOR' }) } });
        const next = await generate(f);
        expect(next.reportNumberBase).toBe(`${prefix}-v2`);
        expect(next.revision).toBe(1);
        expect(JSON.parse(next.content).publication.replacesReportId).toBe(v2.id);
        expect((await prisma.report.findUnique({ where: { id: v1.id } })).content).toBe(v1.content);
        const text = jest.spyOn(PDFDocument.prototype, 'text');
        const pdf = await request(app).get(`/api/reports/${v1.id}/pdf`).set('Authorization', `Bearer ${token}`);
        expect(pdf.status).toBe(200);
        const calls = text.mock.calls.map(([value]) => String(value));
        expect(calls).toContain(`${prefix}-v1`);
        expect(calls).toContain('Issue Date: 2020-03-04');
        expect(calls).toContain('Status: SUPERSEDED');
        expect(calls.some(value => value.includes(`SUPERSEDED`) && value.includes(`${prefix}-v2`))).toBe(true);
    });
    test('a historical base shared by another sample fails closed without a substitute or new report', async () => {
        const a = await fixture(), b = await fixture(), number = id('COLLISION');
        await legacy(a, 1, number); await legacy(b, 1, number);
        const response = await request(app).post(`/api/reports/generate/${a.sampleId}`).set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(409); expect(response.body.code).toBe('REPORT_NUMBER_CONFLICT');
        expect(await prisma.report.count({ where: { sampleId: a.sampleId } })).toBe(1);
    });
    test('modern base ownership also rejects another sample', async () => {
        const a = await fixture(), b = await fixture();
        const first = await generate(a);
        await legacy(b, 1, first.reportNumberBase);
        const response = await request(app).post(`/api/reports/generate/${b.sampleId}`).set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(409); expect(response.body.code).toBe('REPORT_NUMBER_CONFLICT');
    });
    test('failure after counter increment rolls it back; the next successful publication issues that value', async () => {
        const f = await fixture(), now = new Date();
        const year = publicationYear(now, lab.timezone);
        const before = await prisma.reportSequence.findUnique({ where: { labId_year: { labId, year } } });
        let reserved;
        await expect(prisma.$transaction(async tx => {
            reserved = await allocateReportIdentity(tx, { sampleId: f.sampleId, lab, publishedAt: now, resolveFormat: () => policy.get(labId, 'report.numberFormat', { db: tx }) });
            throw new Error('synthetic downstream failure');
        })).rejects.toThrow('synthetic downstream failure');
        expect(await prisma.reportSequence.findUnique({ where: { labId_year: { labId, year } } })).toEqual(before);
        expect(await prisma.report.count({ where: { sampleId: f.sampleId } })).toBe(0);
        expect((await generate(f)).reportNumberBase).toBe(reserved.reportNumberBase);
    });
    test('year boundary is determined by lab timezone, with UTC fallback', () => {
        const instant = '2026-12-31T23:30:00Z';
        expect(publicationYear(instant, 'Europe/Rome')).toBe(2027);
        expect(publicationYear(instant, 'America/Guatemala')).toBe(2026);
        expect(publicationYear(instant, null)).toBe(2026);
        expect(publicationYear(instant, 'invalid')).toBe(2026);
    });
    test('additive migration preserves legacy snapshots, nullable identities and enforces revision uniqueness', () => {
        const db = new Database(':memory:');
        try {
            db.exec('CREATE TABLE Report (id TEXT PRIMARY KEY, content TEXT NOT NULL);');
            const content = JSON.stringify({ reportNumber: 'historic', numericValue: 0 });
            db.prepare('INSERT INTO Report VALUES (?, ?)').run('old', content);
            db.exec(fs.readFileSync(path.resolve(__dirname, '../../prisma/migrations/20261004033000_add_report_number_lineage/migration.sql'), 'utf8'));
            expect(db.prepare('SELECT * FROM Report').get()).toEqual({ id: 'old', content, reportNumberBase: null, revision: null });
            db.prepare('INSERT INTO Report VALUES (?, ?, ?, ?)').run('one', '{}', 'base', 0);
            expect(() => db.prepare('INSERT INTO Report VALUES (?, ?, ?, ?)').run('two', '{}', 'base', 0)).toThrow(/UNIQUE/);
            expect(db.prepare('SELECT count(*) AS n FROM ReportSequence').get().n).toBe(0);
        } finally { db.close(); }
    });
    test('QC_FAIL with PROCEED prints analyte, batch and reason; all reported linked batches must pass for a pass claim', async () => {
        const f = await fixture('QC_FAIL', { decision: 'PROCEED_WITH_WARNING', reason: 'Matrix effect reviewed' });
        const report = await generate(f), content = JSON.parse(report.content);
        expect(content.evidence.qc.withinLimits).toBe(false);
        expect(content.qcStatement).toContain('PH_H2O'); expect(content.qcStatement).toContain(f.batch.id);
        expect(content.qcStatement).toContain('Matrix effect reviewed');
        expect(content.qcStatement).not.toBe(require('../../locales/en.json').resultReports.qcWithinLimits);
        const pass = JSON.parse((await generate(await fixture())).content);
        expect(pass.evidence.qc.withinLimits).toBe(true);
        expect(pass.qcStatement).toBe(require('../../locales/en.json').resultReports.qcWithinLimits);
        const result = { sampleId: 's', param: 'PH_H2O', batchId: 'pass' };
        const items = [{ sampleId: 's', analysis: 'PH_H2O', status: 'ACCEPTED', batchId: 'pending' }];
        expect(freezeReportEvidence([result], items, [{ id: 'pass', status: 'QC_PASS' }, { id: 'pending', status: 'RUNNING' }]).qc.withinLimits).toBe(false);
    });
    test('warn-mode unevaluated QC and unlinked historical results never claim QC passed', async () => {
        mockPolicy('qc.mode', 'REQUIRED_WARN');
        const f = await fixture('RUNNING', undefined, { reviewNeeded: true });
        const review = await request(app).post(`/api/work/${f.item.id}/review`).set('Authorization', `Bearer ${token}`)
            .send({ status: 'ACCEPTED', qcAcknowledgement: { reason: 'Unevaluated evidence reviewed under WARN policy' } });
        expect(review.status).toBe(200);
        await require('../../services/sampleStateService').transitionSample(f.sampleId, 'APPROVED',
            JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()), 'Reviewed warning fixture');
        const content = JSON.parse((await generate(f)).content);
        expect(content.qcStatement).toContain('NOT_EVALUATED'); expect(content.evidence.qc.withinLimits).toBe(false);
        expect(content.qcStatement).toContain('Unevaluated evidence reviewed under WARN policy');
        const missing = freezeReportEvidence([{ sampleId: 's', param: 'SOC' }], [], []);
        expect(missing.qc.withinLimits).toBe(false); expect(missing.qc.deviations[0].qcStatus).toBe('NOT_RECORDED');
    });
    test.each(['en', 'es', 'es-419', 'fr', 'pt'])('%s PDF uses actual publication date/status, replacement, frozen deviations and preparation', async locale => {
        const evidence = freezeReportEvidence([{ sampleId: 's', param: 'SOC', batchId: 'failed' }], [],
            [{ id: 'failed', status: 'QC_FAIL', disposition: JSON.stringify({ reason: 'Recorded reason' }) }]);
        const text = describeReportEvidence(evidence, locale), labels = require(`../../locales/${locale}.json`).resultReports;
        expect(text.preparationStatement).toContain(labels.notRecorded);
        const calls = jest.spyOn(PDFDocument.prototype, 'text');
        const pdf = await generateReportPdfBuffer({ ...snapshot, evidence, ...text, meta: { locale }, reportNumber: 'exact-old' },
            { status: 'SUPERSEDED', publishedAt: '2021-02-03T10:00:00Z', replacementNumber: 'exact-old rev 1' });
        expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
        const values = calls.mock.calls.map(([value]) => String(value));
        expect(values).toContain('Issue Date: 2021-02-03'); expect(values).toContain('Status: SUPERSEDED');
        expect(values.some(value => value.includes(labels.superseded) && value.includes('exact-old rev 1'))).toBe(true);
        expect(values).toContain(text.qcStatement); expect(values).toContain(text.preparationStatement);
        expect(values.join('\n')).not.toMatch(/40°C|ISO 11464|All batch Quality Control checks/);
    });
    test('internal PDF marks the issued replacement; public PDF refuses the superseded version', async () => {
        const f = await fixture(), first = await generate(f);
        const share = await request(app).post(`/api/reports/${first.id}/share`).set('Authorization', `Bearer ${token}`).send({ expiresInDays: 7 });
        expect(share.status).toBe(200);
        const second = await generate(f);
        const text = jest.spyOn(PDFDocument.prototype, 'text');
        const response = await request(app).get(`/api/reports/${first.id}/pdf`).set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(200);
        expect(text.mock.calls.some(([value]) => String(value).includes(`SUPERSEDED`) && String(value).includes(`${second.reportNumberBase} rev 1`))).toBe(true);
        text.mockClear();
        const publicPdf = await request(app).get(`/api/reports/public/${share.body.token}/pdf`);
        expect(publicPdf.status).toBe(410);
        expect(publicPdf.body.code).toBe('REPORT_SUPERSEDED');
        expect(text).not.toHaveBeenCalled();
    });
    test('preparation claims come from complete recorded confirmations rather than sample DONE flags', () => {
        const receipt = { checks: [true, true], steps: ['Actual oven temperature recorded: 35 C', 'Actual sieve: 2 mm'], recordedAt: '2026-01-02', recordedBy: 'analyst' };
        const item = { id: 'prep', analysis: 'PREPARATION', status: 'COMPLETED', result: JSON.stringify(receipt) };
        const evidence = freezeReportEvidence([], [item], []);
        expect(evidence.preparation[0].recordedBy).toBe('analyst');
        expect(describeReportEvidence(evidence).preparationStatement).toContain('Actual sieve: 2 mm');
        expect(freezeReportEvidence([], [{ ...item, result: JSON.stringify({ ...receipt, checks: [true, false] }) }], []).preparation).toEqual([]);
        expect(freezeReportEvidence([], [{ ...item, result: JSON.stringify({ ...receipt, steps: [] }) }], []).preparation).toEqual([]);
        expect(describeReportEvidence(freezeReportEvidence([], [], [])).preparationStatement).toMatch(/not recorded/i);
    });
    test('short certificates keep footer on one page and all issue-date fields use publishedAt', async () => {
        const pages = jest.spyOn(PDFDocument.prototype, 'addPage');
        const text = jest.spyOn(PDFDocument.prototype, 'text');
        await generateReportPdfBuffer(snapshot, { status: 'PUBLISHED', publishedAt: '2021-02-03T12:00:00Z' });
        expect(pages).toHaveBeenCalledTimes(1);
        expect(text.mock.calls.filter(([value]) => String(value).includes('2021-02-03'))).toHaveLength(2);
    });
});
