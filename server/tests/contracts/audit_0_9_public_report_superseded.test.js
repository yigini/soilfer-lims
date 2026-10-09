const { createExecutionResultFixture } = require('../helpers/workAttemptFixtures');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const crypto = require('crypto');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken, ensureTestLab } = require('../setup');
const { setFixtureQcRequirement } = require('../helpers/qcPolicyFixture');

const id = prefix => `${prefix}-${crypto.randomUUID()}`;
const labId = 'LAB-AUDIT-09';

describe('Audit 0.9: superseded public links', () => {
    let token, username;
    beforeAll(async () => {
        await ensureTestLab(labId, 'GTM');
        token = await getAuthToken('LAB_MANAGER', labId);
        await setFixtureQcRequirement(prisma, token, labId);
        username = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).username;
    });
    afterEach(() => jest.restoreAllMocks());
    async function sample() {
        const sampleId = id('SMP-09');
        await createSampleFixture(prisma, { data: { id: sampleId, originalId: sampleId, labId: sampleId,
            assignedLab: labId, status: 'APPROVED' } });
        const item=await createWorkItemFixture(prisma, { data: { id: id('WI-09'), sampleId, analysis: 'PH_H2O', status: 'ACCEPTED' } });
        await createExecutionResultFixture(prisma, { attemptStatus: 'ACCEPTED', data: { id: id('R-09'), sampleId, param: 'PH_H2O', value: '6.2', numericValue: 6.2,
            isCurrent: true, isValid: true } });
        await require('../helpers/reportedSelectionFixture').selectReviewedFixtureItem(prisma,item.id,token);
        return sampleId;
    }
    async function publish(sampleId) {
        const response = await request(app).post(`/api/reports/generate/${sampleId}`).set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(200);
        return prisma.report.findUnique({ where: { id: response.body.id } });
    }
    async function link(report, data = {}) {
        const rawToken = crypto.randomBytes(32).toString('hex');
        const row = await prisma.reportShareLink.create({ data: { reportId: report.id, createdBy: username,
            tokenHash: crypto.createHash('sha256').update(rawToken).digest('hex'), ...data } });
        return { row, rawToken };
    }
    async function publicGet(shared, pdf = false) {
        return request(app).get(`/api/reports/public/${shared.rawToken}${pdf ? '/pdf' : ''}`).set('User-Agent', 'audit-09-agent');
    }
    async function expectCurrent(shared) {
        const html = await publicGet(shared);
        expect(html.status).toBe(200);
        expect(html.body.status).toBe('PUBLISHED');
        const pdf = await publicGet(shared, true);
        expect(pdf.status).toBe(200);
        expect(pdf.headers['content-type']).toMatch(/application\/pdf/);
        expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');
    }

    test('publication revokes only replaced-version links and leaves current and other-sample links valid', async () => {
        const sampleId = await sample(), first = await publish(sampleId);
        const old = await link(first), extraOld = await link(first);
        const other = await publish(await sample()), unrelated = await link(other);
        const second = await publish(sampleId), current = await link(second);
        for (const shared of [old, extraOld]) {
            expect(await prisma.reportShareLink.findUnique({ where: { id: shared.row.id } })).toMatchObject({
                isRevoked: true, revokedBy: username, revokedAt: second.publishedAt
            });
            for (const pdf of [false, true]) {
                const response = await publicGet(shared, pdf);
                expect(response.status).toBe(410);
                expect(response.body.code).toBe('REPORT_SUPERSEDED');
                expect(response.body).not.toHaveProperty('content');
                expect(response.headers['content-type']).toMatch(/application\/json/);
            }
            const hits = await prisma.reportAccessLog.findMany({ where: { linkId: shared.row.id } });
            expect(hits).toHaveLength(2);
            expect(hits.every(hit => hit.userAgent === 'audit-09-agent' && hit.ipAddress)).toBe(true);
        }
        expect((await prisma.report.findUnique({ where: { id: first.id } })).content).toBe(first.content);
        expect(await prisma.reportShareLink.findUnique({ where: { id: unrelated.row.id } })).toEqual(unrelated.row);
        expect(await prisma.reportShareLink.findUnique({ where: { id: current.row.id } })).toEqual(current.row);
        await expectCurrent(current);
        await expectCurrent(unrelated);
    });

    test.each([false, true])('legacy superseded link refuses content without a back-fill (PDF=%s)', async pdf => {
        const report = await publish(await sample()), shared = await link(report);
        await prisma.report.update({ where: { id: report.id }, data: { status: 'SUPERSEDED' } });
        const response = await publicGet(shared, pdf);
        expect(response.status).toBe(410);
        expect(response.body.code).toBe('REPORT_SUPERSEDED');
        expect(response.body).not.toHaveProperty('content');
        expect(await prisma.reportShareLink.findUnique({ where: { id: shared.row.id } })).toEqual(shared.row);
        expect(await prisma.reportAccessLog.count({ where: { linkId: shared.row.id } })).toBe(1);
        expect((await prisma.report.findUnique({ where: { id: report.id } })).content).toBe(report.content);
    });

    test('pre-existing revocation metadata is preserved when its report is superseded', async () => {
        const sampleId = await sample(), first = await publish(sampleId);
        const shared = await link(first, { isRevoked: true, revokedBy: 'previous-manager', revokedAt: new Date('2021-01-01T12:00:00Z') });
        await publish(sampleId);
        expect(await prisma.reportShareLink.findUnique({ where: { id: shared.row.id } })).toEqual(shared.row);
        expect((await publicGet(shared)).body.code).toBe('REPORT_SUPERSEDED');
        expect(await prisma.reportAccessLog.count({ where: { linkId: shared.row.id } })).toBe(1);
    });

    test.each([false, true])('current manually revoked and expired links stay refused and logged (PDF=%s)', async pdf => {
        const report = await publish(await sample());
        const revoked = await link(report, { isRevoked: true, revokedAt: new Date(), revokedBy: username });
        const expired = await link(report, { expiresAt: new Date('2020-01-01T00:00:00Z') });
        for (const [shared, code] of [[revoked, 'LINK_REVOKED'], [expired, 'LINK_EXPIRED']]) {
            const response = await publicGet(shared, pdf);
            expect(response.status).toBe(410);
            expect(response.body.code).toBe(code);
            expect(response.body).not.toHaveProperty('content');
            expect(await prisma.reportAccessLog.count({ where: { linkId: shared.row.id } })).toBe(1);
        }
    });

    test('a failed publication rolls back link revocation and report supersession together', async () => {
        const sampleId = await sample(), first = await publish(sampleId), shared = await link(first);
        const transaction = prisma.$transaction.bind(prisma);
        jest.spyOn(prisma, '$transaction').mockImplementation(callback => transaction(async tx => callback({ ...tx,
            report: { ...tx.report, create: async () => { throw new Error('synthetic publication failure'); } }
        })));
        const response = await request(app).post(`/api/reports/generate/${sampleId}`).set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(500);
        expect(await prisma.reportShareLink.findUnique({ where: { id: shared.row.id } })).toEqual(shared.row);
        expect(await prisma.report.findUnique({ where: { id: first.id } })).toEqual(first);
        expect(await prisma.report.count({ where: { sampleId } })).toBe(1);
        await expectCurrent(shared);
    });

    test.each([false, true])('unknown token remains 404 without an orphaned access row (PDF=%s)', async pdf => {
        const before = await prisma.reportAccessLog.count();
        expect((await publicGet({ rawToken: id('unknown') }, pdf)).status).toBe(404);
        expect(await prisma.reportAccessLog.count()).toBe(before);
    });
});
