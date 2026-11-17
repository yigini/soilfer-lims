const { createHash, randomUUID } = require('node:crypto');
const request = require('supertest');
const { freezeCertificatePresentation } = require('../../services/certificatePresentation');
const { reportPresentationFixture, renderReportHtml, reportPdfTexts } = require('../helpers/reportPresentationFixture');
const legacy = require('../helpers/fixtures/report_presentation_legacy.json');
const digest = value => createHash('sha256').update(value).digest('hex');

test.each([true, false])('already-issued viewer and PDF text remain byte-identical, missing methods=%s', async missing => {
    const content = reportPresentationFixture('en', missing), before = structuredClone(content);
    const expected = legacy[missing ? 'missing' : 'recorded'];
    expect(digest(renderReportHtml(content))).toBe(expected.htmlSha256);
    const texts = await reportPdfTexts(content);
    expect(texts).toHaveLength(expected.pdfTextCount);
    expect(digest(JSON.stringify(texts))).toBe(expected.pdfTextsSha256);
    expect(content).toEqual(before);
});

test.each(['en', 'es', 'es-419', 'fr', 'pt'])('new %s certificates use frozen client wording in viewer and PDF', async locale => {
    const content = reportPresentationFixture(locale), evidenceBefore = structuredClone(content.evidence);
    const labels = require('../../locales/' + locale + '.json').resultReports;
    const presentation = freezeCertificatePresentation(content);
    expect(presentation.warnings).toEqual([{ code: 'REPORT_METHOD_NOT_RECORDED', severity: 'WARNING',
        parameters: [{ param: 'SAND', name: 'Sand fraction' }, { param: 'SILT', name: 'Silt fraction' }, { param: 'CLAY', name: 'Clay fraction' }],
        message: labels.methodsMissingWarning.replace('{{parameters}}', 'Sand fraction, Silt fraction, Clay fraction') }]);
    expect(presentation.qcStatement).toBe(labels.qcNoBatchFor.replace('{{parameters}}', 'Clay fraction'));
    expect(presentation.appVersion).toBe(require('../../package.json').version);
    const html = renderReportHtml(content), texts = await reportPdfTexts(content), pdf = texts.join('\n');
    for (const output of [html, pdf]) {
        for (const phrase of [labels.methodNotRecorded, labels.certificateParticleSize, 'Marta Example', 'A Coruña', 'España', presentation.approvalRole]) expect(output).toContain(phrase);
        expect(output).not.toMatch(/Standard Laboratory Method|LAB_MANAGER|internal-reviewer|INTERNAL MANAGER FREE TEXT|INTERNAL DISPOSITION|PROCEED_WITH_WARNING|QC_WARN|NO_BATCH/);
        expect(output).toContain(presentation.qcStatement);
    }
    expect(html).toContain(presentation.qcStatement + ' ' + presentation.basisStatement.replace('<', '&lt;').replace('>', '&gt;'));
    expect(html).toContain('SoilFER LIMS v' + require('../../package.json').version);
    expect(html).toContain('Analytical Measurements (ISO/IEC 17025)');
    expect(content.evidence).toEqual(evidenceBefore);
    const frozen = JSON.parse(JSON.stringify(content));
    expect(renderReportHtml(frozen)).toBe(html);
    expect(await reportPdfTexts(frozen)).toEqual(texts);
});

test('known methods need retained name AND version; warnings never choose a current default', () => {
    const content = reportPresentationFixture('en', false);
    expect(freezeCertificatePresentation(content).warnings).toEqual([]);
    content.resultGroups[0].items[0].executedMethods[0].methodVersion = null;
    expect(freezeCertificatePresentation(content).warnings[0].parameters).toEqual([{ param: 'SAND', name: 'Sand fraction' }]);
    expect(content.resultGroups[0].items[0].certificateMethodText).toBe('Method not recorded');
});

test('mixed categories stay intact, unknown people stay unnamed, and QC comments stay internal', () => {
    const content = reportPresentationFixture('en');
    content.resultGroups[0].items.push({ param: 'BD', name: 'Bulk density', value: '1.2' });
    content.signedBy = { username: 'only-user-name', name: 'only-user-name', title: 'UNRECOGNIZED_ROLE' };
    content.publication.issuer = { username: 'internal-issuer', name: 'internal-issuer', role: 'UNKNOWN' };
    content.evidence.qc.deviations.push({ analysisCode: 'SAND', qcStatus: 'EVIDENCE_INCOMPLETE', acknowledgementReason: 'KEEP INTERNAL', acknowledgedBy: 'internal-person' });
    const p = freezeCertificatePresentation(content);
    expect(p.groupNames).toEqual(['Physical & Hydraulic Properties']);
    expect(p.approvalName).toBe('Name not recorded'); expect(p.approvalRole).toBe('not recorded');
    expect(p.issuerName).toBe('Name not recorded');
    expect(p.qcStatement).toContain('Sand fraction');
    expect(p.qcStatement).not.toMatch(/KEEP INTERNAL|internal-person|EVIDENCE_INCOMPLETE/);
});

test('generation releases a new immutable version with named missing-method warnings and preserves the old version', async () => {
    const { qcGateFixture } = require('../helpers/qcGateFixture');
    const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
    const { appendReportedSelection } = require('../../services/reportedValueSelectionService');
    const { withQcRunHttp } = require('../helpers/qcRunHttpHarness');
    const f = await qcGateFixture({ status: 'ACCEPTED', criteria: { blankPerBatch: 0, lrmPerBatch: 0, duplicateEvery: 0, crmEveryNBatches: 0, ccvEvery: 0 } });
    try {
        const at = new Date('2026-11-17T12:00:00Z');
        const sample = await createSampleFixture(f.db, { data: { id: randomUUID(), originalId: randomUUID(), assignedLab: f.labId,
            status: 'APPROVED', approvedBy: f.actor.username, approvedAt: at, dryingStatus: 'DONE', preparationStatus: 'DONE', receptionDate: at } });
        const item = await createWorkItemFixture(f.db, { data: { id: randomUUID(), sampleId: sample.id, labId: f.labId, analysis: f.analysisCode,
            methodologyId: f.method.id, status: 'ACCEPTED', result: '7', history: '[]' } });
        await f.db.sampleOrderRevision.create({ data: { id: randomUUID(), sampleId: sample.id, version: 1, status: 'ACTIVE',
            reason: 'Owned report-warning fixture', lines: { create: { id: randomUUID(), analysis: f.analysisCode, workItemId: null, isRequired: true, status: 'ACTIVE' } } } });
        await f.result(item);
        await f.db.$transaction(tx => appendReportedSelection(tx, item, f.actor));
        await f.db.auditLog.create({ data: { id: randomUUID(), entity: 'SAMPLE', entityId: sample.id, sampleId: sample.id,
            action: 'SAMPLE_APPROVED', performedBy: f.actor.username, timestamp: at,
            after: JSON.stringify({ approval: { username: f.actor.username, name: 'Owned Full Reviewer', role: f.actor.role, approvedAt: at.toISOString() } }) } });
        const historicalContent = JSON.stringify(reportPresentationFixture('en'));
        const old = await f.db.report.create({ data: { id: randomUUID(), sampleId: sample.id, labId: f.labId, version: 1,
            generatedBy: f.actor.username, status: 'DRAFT', content: historicalContent } });
        const results = await f.db.result.findMany(), attempts = await f.db.workAttempt.findMany();
        await withQcRunHttp(f.db, f.actor, async (app, token) => {
            const issued = await request(app).post('/api/reports/generate/' + sample.id).set('Authorization', 'Bearer ' + token).send({});
            expect({ status: issued.status, body: issued.body }).toMatchObject({ status: 200, body: { version: 2,
                warnings: [{ code: 'REPORT_METHOD_NOT_RECORDED', severity: 'WARNING', parameters: [{ name: 'QC gate analyte' }] }] } });
            const stored = await f.db.report.findUnique({ where: { id: issued.body.id } }), content = JSON.parse(stored.content);
            expect(content.presentation).toMatchObject({ version: 1, approvalName: 'Owned Full Reviewer', appVersion: require('../../package.json').version });
            expect(content.presentation.warnings).toEqual(issued.body.warnings);
            expect((await f.db.report.findUnique({ where: { id: old.id } })).content).toBe(historicalContent);
            expect(await f.db.result.findMany()).toEqual(results); expect(await f.db.workAttempt.findMany()).toEqual(attempts);
        }, { reports: true });
    } finally { await f.close(); }
});
