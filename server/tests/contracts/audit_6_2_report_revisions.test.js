const { createExecutionResultFixture } = require('../helpers/workAttemptFixtures');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const { approvedReportAmendment } = require('../helpers/reportAmendmentFixture');
const crypto = require('crypto');
const request = require('supertest');
const PDFDocument = require('pdfkit');
const app = require('../../app');
const prisma = require('../../prisma');
const policyService = require('../../services/policyService');
const { getAuthToken, ensureTestLab } = require('../setup');
const { setFixtureQcRequirement } = require('../helpers/qcPolicyFixture');
const { applyRevision } = require('../../services/reportRevisionService');
const { generateReportPdfBuffer } = require('../../services/pdfGenerator');

const id = prefix => `${prefix}-${crypto.randomUUID()}`;
const labId = 'LAB-AUDIT-62';
const enStatement = require('../../locales/en.json').resultReports.amendedStatement;

describe('Audit 6.2: report revisions and amendment marking', () => {
    let token, username, actor;
    beforeAll(async () => {
        await ensureTestLab(labId, 'GTM');
        token = await getAuthToken('LAB_MANAGER', labId);
        await setFixtureQcRequirement(prisma, token, labId);
        actor = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
        username = actor.username;
    });
    afterEach(() => jest.restoreAllMocks());

    async function sample() {
        const sampleId = id('SMP-62');
        await createSampleFixture(prisma, { data: { id: sampleId, originalId: sampleId, labId: sampleId,
            assignedLab: labId, status: 'APPROVED', approvedBy: 'retained-approver', approvedAt: new Date() } });
        const item = await createWorkItemFixture(prisma, { data: { id: id('WI-62'), sampleId, analysis: 'PH_H2O', status: 'ACCEPTED' } });
        await createExecutionResultFixture(prisma, { attemptStatus: 'ACCEPTED', data: { id: id('R-62'), sampleId, param: 'PH_H2O', value: '6.2', numericValue: 6.2,
            isCurrent: true, isValid: true } });
        await require('../helpers/reportedSelectionFixture').selectReviewedFixtureItem(prisma, item.id, token);
        return sampleId;
    }
    const generate = (sampleId, body = {}) => request(app).post(`/api/reports/generate/${sampleId}`).set('Authorization', `Bearer ${token}`).send(body);
    async function snapshot(sampleId) {
        const lab = await prisma.lab.findFirst({ where: { OR: [{ id: labId }, { code: labId }] } });
        return {
            reports: await prisma.report.findMany({ where: { sampleId }, orderBy: { version: 'asc' } }),
            links: await prisma.reportShareLink.findMany({ where: { report: { sampleId } }, orderBy: { id: 'asc' } }),
            sequences: await prisma.reportSequence.findMany({ where: { labId: lab.id } }),
            amendments: await prisma.sampleAmendment.findMany({ where: { sampleId }, orderBy: { id: 'asc' } }),
            audits: await prisma.auditLog.findMany({ where: { sampleId }, orderBy: { id: 'asc' } })
        };
    }
    async function expectRefusal(sampleId, body, status, code) {
        const before = await snapshot(sampleId), response = await generate(sampleId, body);
        expect(response.status).toBe(status);
        expect(response.body.code).toBe(code);
        expect(await snapshot(sampleId)).toEqual(before);
    }

    test('revision 2 without an amendment returns 409 with zero writes', async () => {
        const sampleId = await sample();
        expect((await generate(sampleId)).status).toBe(200);
        await expectRefusal(sampleId, {}, 409, 'REPORT_AMENDMENT_REQUIRED');
    });

    test('each amendment refusal code leaves every publication row unchanged', async () => {
        const sampleId = await sample(), otherSampleId = await sample();
        await expectRefusal(sampleId, { amendmentId: (await approvedReportAmendment(prisma, sampleId)).id }, 409, 'REPORT_AMENDMENT_NOT_APPLICABLE');
        expect((await generate(sampleId)).status).toBe(200);
        await expectRefusal(sampleId, { amendmentId: 42 }, 400, 'REPORT_AMENDMENT_INPUT_INVALID');
        await expectRefusal(sampleId, { amendmentId: 'missing-amendment' }, 409, 'REPORT_AMENDMENT_INVALID');
        await expectRefusal(sampleId, { amendmentId: (await approvedReportAmendment(prisma, otherSampleId)).id }, 409, 'REPORT_AMENDMENT_INVALID');
        const pending = await prisma.sampleAmendment.create({ data: { id: id('AMD'), sampleId, type: 'CLERICAL', status: 'PENDING', reason: 'Pending',
            requestPayload: '{"contract":"210-v1"}', selectedWorkItemIds: '[]', version: 1, createdBy: 'requester' } });
        await expectRefusal(sampleId, { amendmentId: pending.id }, 409, 'REPORT_AMENDMENT_INVALID');
        const legacy = await prisma.sampleAmendment.create({ data: { id: id('AMD'), sampleId, type: 'CLERICAL', status: 'APPROVED', reason: 'Legacy self-approved',
            createdBy: 'legacy', authorizedBy: 'legacy', authorizedAt: new Date() } });
        await expectRefusal(sampleId, { amendmentId: legacy.id }, 409, 'REPORT_AMENDMENT_INVALID');
        const used = await approvedReportAmendment(prisma, sampleId);
        expect((await generate(sampleId, { amendmentId: used.id })).status).toBe(200);
        await expectRefusal(sampleId, { amendmentId: used.id }, 409, 'AMENDMENT_ALREADY_CONSUMED');
    });

    test('a CLERICAL revision freezes predecessor, amendment, reason, issuer and approver', async () => {
        const sampleId = await sample();
        const first = await prisma.report.findUnique({ where: { id: (await generate(sampleId)).body.id } });
        expect(first).toMatchObject({ revision: 0, issuedBy: username, approvedBy: 'retained-approver', supersedesReportId: null, amendmentId: null });
        const amendment = await approvedReportAmendment(prisma, sampleId, { type: 'CLERICAL', reason: 'Corrected client address' });
        const response = await generate(sampleId, { amendmentId: amendment.id });
        expect(response.status).toBe(200);
        const revised = await prisma.report.findUnique({ where: { id: response.body.id } });
        expect(revised).toMatchObject({ reportNumberBase: first.reportNumberBase, revision: 1, supersedesReportId: first.id, amendmentId: amendment.id,
            amendmentReason: 'Corrected client address', amendmentAuthorizedBy: 'fixture-authoriser', issuedBy: username, approvedBy: 'retained-approver' });
        expect((await prisma.report.findUnique({ where: { id: first.id } })).status).toBe('SUPERSEDED');
        const content = JSON.parse(revised.content);
        expect(content.amendment).toMatchObject({ amendmentId: amendment.id, type: 'CLERICAL', replacesReportId: first.id, replacesReportNumber: first.reportNumberBase,
            statement: enStatement.replace('{replacedNumber}', first.reportNumberBase).replace('{replacedRevision}', '0').replace('{reason}', 'Corrected client address'),
            removed: [], comparison: { contract: '211-v1', changes: [expect.objectContaining({ analysisId: 'PH_H2O', kind: 'UNCHANGED' })] } });
        const sqlite = new (require('better-sqlite3'))(process.env.DATABASE_PATH);
        try {
            expect(() => sqlite.prepare('UPDATE "Report" SET "amendmentReason"=? WHERE id=?').run('Rewritten', revised.id)).toThrow('REPORT_REVISION_IMMUTABLE');
            expect(() => sqlite.prepare('UPDATE "Report" SET "approvedBy"=? WHERE id=?').run('someone-else', first.id)).toThrow('REPORT_REVISION_IMMUTABLE');
            expect(() => sqlite.prepare('UPDATE "Report" SET "supersedesReportId"=NULL WHERE id=?').run(revised.id)).toThrow('REPORT_REVISION_IMMUTABLE');
        } finally { sqlite.close(); }
        expect(await prisma.report.findUnique({ where: { id: revised.id } })).toEqual(revised);
    });

    test('a statement frozen at generation survives a later laboratory policy change', async () => {
        const sampleId = await sample();
        await generate(sampleId);
        const amendment = await approvedReportAmendment(prisma, sampleId, { reason: 'Frozen reason' });
        const revised = await prisma.report.findUnique({ where: { id: (await generate(sampleId, { amendmentId: amendment.id })).body.id } });
        const lab = await prisma.lab.findFirst({ where: { OR: [{ id: labId }, { code: labId }] } });
        const custom = Object.fromEntries(['en', 'es', 'es-419', 'fr', 'pt'].map(locale => [locale, 'LATER {replacedNumber}/{replacedRevision}: {reason}']));
        await policyService.change(actor, lab.id, { reason: 'Later statement wording', changes: [{ key: 'report.amendedStatement', value: custom }] });
        try {
            const stored = await prisma.report.findUnique({ where: { id: revised.id } });
            expect(stored.content).toBe(revised.content);
            const text = jest.spyOn(PDFDocument.prototype, 'text');
            await generateReportPdfBuffer(JSON.parse(stored.content), { status: 'PUBLISHED' });
            const written = text.mock.calls.map(([value]) => value);
            expect(written).toContain(JSON.parse(revised.content).amendment.statement);
            expect(written.some(value => String(value).startsWith('LATER'))).toBe(false);
        } finally {
            await policyService.change(actor, lab.id, { reason: 'Restore default wording', changes: [{ key: 'report.amendedStatement', value: null }] });
        }
    });

    test('concurrent generation with one amendment creates exactly one new revision', async () => {
        const sampleId = await sample();
        await generate(sampleId);
        const amendment = await approvedReportAmendment(prisma, sampleId);
        const responses = await Promise.all([generate(sampleId, { amendmentId: amendment.id }), generate(sampleId, { amendmentId: amendment.id })]);
        expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
        expect(responses.find(response => response.status === 409).body.code).toMatch(/^(AMENDMENT_ALREADY_CONSUMED|REPORT_NUMBER_CONFLICT|REPORT_AMENDMENT_INVALID)$/);
        expect(await prisma.report.count({ where: { sampleId } })).toBe(2);
        expect(await prisma.report.count({ where: { sampleId, amendmentId: amendment.id } })).toBe(1);
    });

    test('a superseded public link shows a text-only tombstone with the replacing number and no link, values or reason', async () => {
        const sampleId = await sample();
        const first = await prisma.report.findUnique({ where: { id: (await generate(sampleId)).body.id } });
        const rawToken = crypto.randomBytes(32).toString('hex');
        await prisma.reportShareLink.create({ data: { reportId: first.id, createdBy: username, tokenHash: crypto.createHash('sha256').update(rawToken).digest('hex') } });
        const amendment = await approvedReportAmendment(prisma, sampleId, { reason: 'INTERNAL-REASON-TEXT' });
        const revised = await prisma.report.findUnique({ where: { id: (await generate(sampleId, { amendmentId: amendment.id })).body.id } });
        for (const suffix of ['', '/pdf']) {
            const response = await request(app).get(`/api/reports/public/${rawToken}${suffix}`);
            expect(response.status).toBe(410);
            expect(response.body).toEqual({ error: expect.any(String), code: 'REPORT_SUPERSEDED',
                tombstone: { status: 'SUPERSEDED', reportNumber: first.reportNumberBase, replacementNumber: `${revised.reportNumberBase} rev 1` } });
            const body = JSON.stringify(response.body);
            for (const hidden of ['INTERNAL-REASON-TEXT', '6.2', revised.id, 'http', '/api/']) expect(body).not.toContain(hidden);
        }
    });
});

describe('Audit 6.2: frozen marking and PDF rendering', () => {
    const item = (param, value, extra = {}) => ({ param, analysisId: param, name: param + ' name', value, unit: 'g/kg', basis: null, sourceResultIds: [param + '-r'], ...extra });
    const content = items => ({ meta: { locale: 'en' }, resultGroups: [{ categoryName: 'Chemistry', items }] });
    const predecessor = { id: 'pred-report', reportNumberBase: 'LAB-2026-7', revision: 0, status: 'PUBLISHED',
        content: JSON.stringify(content([item('SAME', '1.00'), item('CHANGED', '2.00'), item('GONE', '3.00'), item('RETEST', '4.00')])) };
    const amendment = { id: 'amd-1', type: 'SCIENTIFIC', reason: 'Client retest', authorizedBy: 'authoriser', authorizedAt: new Date('2026-10-10T00:00:00Z') };

    test('changed and added results are marked, removed ones listed, and a same-display re-measurement is not marked', () => {
        const next = content([item('SAME', '1.00'), item('CHANGED', '2.50'), item('NEW', '5.00'), item('RETEST', '4.00', { sourceResultIds: ['RETEST-new'] })]);
        const frozen = applyRevision(next, { amendment, predecessor, statementPolicy: null, locale: 'en' });
        const marks = Object.fromEntries(next.resultGroups[0].items.map(row => [row.param, row.amendmentChange ?? null]));
        expect(marks).toEqual({ SAME: null, CHANGED: 'CHANGED', NEW: 'ADDED', RETEST: null });
        expect(frozen.removed).toEqual([{ analysisId: 'GONE', basis: null, name: 'GONE name', value: '3.00', unit: 'g/kg' }]);
        expect(frozen.comparison.changes.find(change => change.analysisId === 'RETEST')).toMatchObject({ kind: 'UNCHANGED',
            old: { sourceResultIds: ['RETEST-r'] }, new: { sourceResultIds: ['RETEST-new'] } });
        expect(frozen.statement).toBe(enStatement.replace('{replacedNumber}', 'LAB-2026-7').replace('{replacedRevision}', '0').replace('{reason}', 'Client retest'));
    });

    test('the revision PDF prints the replaces/reason statement, change marks and removed results', async () => {
        const next = content([item('SAME', '1.00'), item('CHANGED', '2.50'), item('NEW', '5.00'), item('RETEST', '4.00')]);
        const frozen = applyRevision(next, { amendment, predecessor, statementPolicy: null, locale: 'en' });
        const labels = require('../../locales/en.json').resultReports;
        const text = jest.spyOn(PDFDocument.prototype, 'text');
        const pdf = await generateReportPdfBuffer(next, { status: 'PUBLISHED', reportNumber: 'LAB-2026-7 rev 1' });
        expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
        const written = text.mock.calls.map(([value]) => String(value));
        expect(written).toContain(frozen.statement);
        expect(frozen.statement).toContain('LAB-2026-7');
        expect(frozen.statement).toContain('Client retest');
        expect(written).toContain(`${labels.amendmentChangedMark} CHANGED name`);
        expect(written).toContain(`${labels.amendmentAddedMark} NEW name`);
        expect(written).toContain('SAME name');
        expect(written.some(value => value.startsWith(labels.amendmentRemoved) && value.includes('GONE name') && value.includes('3.00'))).toBe(true);
    });
});
