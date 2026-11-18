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
        expect(output).not.toMatch(/Standard Laboratory Method|LAB_MANAGER|internal-reviewer|INTERNAL MANAGER FREE TEXT|INTERNAL DISPOSITION|PROCEED_WITH_WARNING|NO_BATCH/);
        expect(output).toContain(presentation.qcStatement);
    }
    expect(html).toContain(presentation.qcStatement + ' ' + presentation.basisStatement.replace('<', '&lt;').replace('>', '&gt;'));
    expect(html).toContain('SoilFER LIMS v' + require('../../package.json').version);
    expect(html).toContain('Analytical Measurements');
    expect(html).not.toContain('ISO/IEC 17025');
    expect(presentation.qcStatement).not.toMatch(/QC_WARN|PROCEED_WITH_WARNING|NO_BATCH/);
    expect(html).toContain('QC_WARN'); expect(pdf).toContain('QC_WARN');
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

test.each([true, false])('generation returns nonblocking release warnings and preserves every approval pass, names recorded=%s', async namesRecorded => {
    const { qcGateFixture } = require('../helpers/qcGateFixture');
    const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
    const { appendReportedSelection } = require('../../services/reportedValueSelectionService');
    const { withQcRunHttp } = require('../helpers/qcRunHttpHarness');
    const f = await qcGateFixture({ status: 'ACCEPTED', criteria: { blankPerBatch: 0, lrmPerBatch: 0, duplicateEvery: 0, crmEveryNBatches: 0, ccvEvery: 0 } });
    try {
        const at = new Date('2026-11-17T12:00:00Z');
        await f.db.user.update({ where: { username: f.actor.username }, data: { name: namesRecorded ? 'Owned Full Issuer' : null } });
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
            after: JSON.stringify({ approval: { username: f.actor.username, name: namesRecorded ? 'Owned Full Reviewer' : null, role: f.actor.role, approvedAt: at.toISOString() } }) } });
        const priorAt = new Date('2026-11-16T12:00:00Z');
        await f.db.auditLog.create({ data: { id: randomUUID(), entity: 'SAMPLE', entityId: sample.id, sampleId: sample.id,
            action: 'SAMPLE_APPROVED', performedBy: f.actor.username, timestamp: priorAt,
            after: JSON.stringify({ approval: { username: f.actor.username, name: namesRecorded ? 'Owned Earlier Reviewer' : null,
                role: f.actor.role, approvedAt: priorAt.toISOString() } }) } });
        await f.db.auditLog.create({ data: { id: randomUUID(), entity: 'SAMPLE', entityId: sample.id, sampleId: sample.id,
            action: 'UNDO_APPROVAL', performedBy: f.actor.username, timestamp: new Date('2026-11-16T13:00:00Z'), details: 'INTERNAL REOPEN REASON' } });
        const historicalContent = JSON.stringify(reportPresentationFixture('en'));
        const old = await f.db.report.create({ data: { id: randomUUID(), sampleId: sample.id, labId: f.labId, version: 1,
            generatedBy: f.actor.username, status: 'DRAFT', content: historicalContent } });
        const results = await f.db.result.findMany(), attempts = await f.db.workAttempt.findMany();
        await withQcRunHttp(f.db, f.actor, async (app, token) => {
            const issued = await request(app).post('/api/reports/generate/' + sample.id).set('Authorization', 'Bearer ' + token).send({});
            expect({ status: issued.status, body: issued.body }).toMatchObject({ status: 200, body: { version: 2,
                warnings: expect.arrayContaining([{ code: 'REPORT_METHOD_NOT_RECORDED', severity: 'WARNING',
                    parameters: [{ param: f.analysisCode, name: 'QC gate analyte' }], message: expect.any(String) }]) } });
            const stored = await f.db.report.findUnique({ where: { id: issued.body.id } }), content = JSON.parse(stored.content);
            expect(content.presentation).toMatchObject({ version: 1, approvalName: namesRecorded ? 'Owned Full Reviewer' : 'Name not recorded', appVersion: require('../../package.json').version });
            expect(content.presentation.approvalPasses.map(row => row.name)).toEqual(namesRecorded
                ? ['Owned Earlier Reviewer', 'Owned Full Reviewer'] : ['Name not recorded', 'Name not recorded']);
            expect(content.presentation.approvalPasses.map(row => row.date)).toEqual([priorAt.toISOString(), at.toISOString()]);
            const warningCodes = issued.body.warnings.map(row => row.code);
            expect(warningCodes).toEqual(namesRecorded ? ['REPORT_METHOD_NOT_RECORDED']
                : ['REPORT_METHOD_NOT_RECORDED', 'REPORT_SIGNATORY_NAME_NOT_RECORDED', 'REPORT_ISSUER_NAME_NOT_RECORDED']);
            const html = renderReportHtml(content), pdf = (await reportPdfTexts(content)).join('\n');
            for (const output of [html, pdf]) {
                expect(output).toContain('Initial Analytical Pass'); expect(output).toContain('Reopened Pass 1');
                expect(output).not.toContain('INTERNAL REOPEN REASON'); expect(output).not.toContain(f.actor.username);
                if (namesRecorded) { expect(output).toContain('Owned Earlier Reviewer'); expect(output).toContain('Owned Full Reviewer'); }
            }
            expect(content.presentation.warnings).toEqual(issued.body.warnings);
            expect((await f.db.report.findUnique({ where: { id: old.id } })).content).toBe(historicalContent);
            expect(await f.db.result.findMany()).toEqual(results); expect(await f.db.workAttempt.findMany()).toEqual(attempts);
        }, { reports: true });
    } finally { await f.close(); }
});

test.each(['en', 'es', 'es-419', 'fr', 'pt'])('new %s notes preserve failed versus warning meaning without raw status codes', locale => {
    const c = reportPresentationFixture(locale), labels = require('../../locales/' + locale + '.json').resultReports;
    c.evidence.qc.deviations = [{ analysisCode: 'SAND', qcStatus: 'QC_FAIL' }, { analysisCode: 'CLAY', qcStatus: 'PROCEED_WITH_WARNING' }];
    const p = freezeCertificatePresentation(c);
    expect(p.qcStatement).toBe(labels.qcFailedFor.replace('{{parameters}}', 'Sand fraction') + ' ' + labels.qcWarningsFor.replace('{{parameters}}', 'Clay fraction'));
    expect(p.qcStatement).not.toMatch(/QC_FAIL|PROCEED_WITH_WARNING/);
});

test('structured location labels are frozen as entered, rather than their internal identifiers', () => {
    const c = reportPresentationFixture();
    c.fieldMetadata.district = { value: 'district-id', label: 'A Coruña' };
    c.fieldMetadata.province = { value: 'region-id', label: 'Galicia' };
    const p = freezeCertificatePresentation(c);
    expect(p.location).toMatchObject({ country: 'España', district: 'A Coruña', region: 'Galicia' });
    expect(p.locationText).toBe('A Coruña, Galicia, España');
    expect(p.locationText).not.toMatch(/district-id|region-id/);
});

test.each(['en', 'es', 'es-419', 'fr', 'pt'])('two approval passes retain frozen names and dates in both %s render paths', async locale => {
    const content = reportPresentationFixture(locale, false);
    const firstAt = '2026-11-16T12:00:00.000Z', lastAt = content.signedBy.date;
    content.sample.episodes = [
        { episodeNumber: 1, label: 'Initial Analytical Pass', approvedBy: 'first-user', approvedAt: firstAt },
        { episodeNumber: 2, label: 'Reopened Pass 1', approvedBy: content.signedBy.username, approvedAt: lastAt, reopenReason: 'INTERNAL REOPEN REASON' }
    ];
    const proof = [{ episodeNumber: 1, username: 'first-user', name: 'Earlier Full Reviewer', date: firstAt },
        { episodeNumber: 2, username: content.signedBy.username, name: content.signedBy.name, date: lastAt }];
    const p = freezeCertificatePresentation(content, { approvalPassEvidence: proof });
    expect(p.approvalPasses.map(row => [row.label, row.name, row.date])).toEqual([
        ['Initial Analytical Pass', 'Earlier Full Reviewer', firstAt], ['Reopened Pass 1', 'Marta Example', lastAt]
    ]);
    const html = renderReportHtml(content), pdfTexts = await reportPdfTexts(content), pdf = pdfTexts.join('\n');
    for (const output of [html, pdf]) {
        for (const text of ['Initial Analytical Pass', 'Reopened Pass 1', 'Earlier Full Reviewer', 'Marta Example', '2026-11-16', '2026-11-17']) expect(output).toContain(text);
        expect(output).not.toMatch(/first-user|internal-reviewer|INTERNAL REOPEN REASON/);
    }
    proof[0].name = 'CHANGED DIRECTORY NAME';
    expect(renderReportHtml(content)).toBe(html); expect(await reportPdfTexts(content)).toEqual(pdfTexts);
});

test.each(['en', 'es', 'es-419', 'fr', 'pt'].flatMap(locale => ['approver', 'issuer', 'both'].map(which => [locale, which])))(
    'missing %s/%s profile names produce named nonblocking release warnings', (locale, which) => {
        const content = reportPresentationFixture(locale, false), labels = require('../../locales/' + locale + '.json').resultReports;
        if (which !== 'issuer') content.signedBy.name = content.signedBy.username;
        if (which !== 'approver') content.publication.issuer.name = '  ';
        const p = freezeCertificatePresentation(content);
        const expected = [
            ...(which !== 'issuer' ? [{ code: 'REPORT_SIGNATORY_NAME_NOT_RECORDED', severity: 'WARNING', signature: 'approver', message: labels.signatoryNameMissingWarning }] : []),
            ...(which !== 'approver' ? [{ code: 'REPORT_ISSUER_NAME_NOT_RECORDED', severity: 'WARNING', signature: 'issuer', message: labels.issuerNameMissingWarning }] : [])
        ];
        expect(p.warnings).toEqual(expected);
        for (const row of p.warnings) expect(row.message).toEqual(expect.any(String));
    });

test('new render paths retain client-relevant and unknown result flags, censoring and neutral method standards', async () => {
    const content = reportPresentationFixture('en', false);
    const flags = ['BELOW_LOQ', 'CENSORED_VALUE', 'OUTSIDE_TYPICAL_RANGE', 'OVERRIDE_APPROVED', 'CUSTOM_CLIENT_MARKER'];
    content.resultGroups[0].items.push({ param: 'ZN', name: 'Zinc', value: '<0.5', unit: 'mg/kg', censoring: 'BELOW_LOQ',
        flags: [...flags], method: 'Retained zinc method', methodVersion: 2,
        executedMethods: [{ method: 'Retained zinc method', methodVersion: 2, standard: 'ISO 10390:2021' }],
        qcNotes: ['INTERNAL MANAGER FREE TEXT'] });
    const p = freezeCertificatePresentation(content), html = renderReportHtml(content), pdf = (await reportPdfTexts(content)).join('\n');
    for (const output of [html, pdf]) {
        for (const flag of flags) expect(output).toContain(flag);
        expect(output).toContain('ISO 10390:2021'); expect(output).not.toContain('ISO/IEC 17025');
        expect(output).not.toContain('INTERNAL MANAGER FREE TEXT');
    }
    expect(html).toContain('&lt;0.5'); expect(pdf).toContain('<0.5 (LOQ)');
    expect(content.resultGroups[0].items.at(-1).flags).toEqual(flags);
    expect(p.qcStatement).not.toMatch(/BELOW_LOQ|CENSORED_VALUE|CUSTOM_CLIENT_MARKER/);
});
