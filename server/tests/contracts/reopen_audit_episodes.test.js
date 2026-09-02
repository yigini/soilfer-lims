const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');
const { assembleReport } = require('../../services/reportAssembly');

describe('SD-17: Reopen Audit Episodes Contract', () => {
    let mgrToken;
    const labId = 'LAB-GTM';
    const sampleId = 'SMP-SD17-EPISODES-01';

    beforeAll(async () => {
        mgrToken = await getAuthToken('LAB_MANAGER', labId, ['GTM'], ['SOILFER-US']);

        // Clean up
        await prisma.result.deleteMany({ where: { sampleId } });
        await prisma.auditLog.deleteMany({ where: { sampleId } });
        await prisma.workItem.deleteMany({ where: { sampleId } });
        await prisma.sample.deleteMany({ where: { id: sampleId } });

        // Create sample in APPROVED state
        const initialApprovalDate = new Date('2026-08-15T10:00:00Z');
        await prisma.sample.create({
            data: {
                id: sampleId,
                originalId: sampleId,
                labId,
                assignedLab: labId,
                country: 'GTM',
                projectCode: 'SOILFER-US',
                status: 'APPROVED',
                matrix: 'SOIL',
                approvedBy: 'initial_manager',
                approvedAt: initialApprovalDate,
                dryingStatus: 'DONE',
                preparationStatus: 'DONE',
                requiredAnalyses: JSON.stringify(['PH_H2O'])
            }
        });

        // Add initial approval audit log
        await prisma.auditLog.create({
            data: {
                id: 'AUDIT-SD17-APPR-1',
                entity: 'SAMPLE',
                entityId: sampleId,
                sampleId,
                action: 'SAMPLE_APPROVED',
                performedBy: 'initial_manager',
                details: 'Sample approved for agronomic certification',
                timestamp: initialApprovalDate
            }
        });
    });

    afterAll(async () => {
        await prisma.result.deleteMany({ where: { sampleId } });
        await prisma.auditLog.deleteMany({ where: { sampleId } });
        await prisma.workItem.deleteMany({ where: { sampleId } });
        await prisma.sample.deleteMany({ where: { id: sampleId } });
    });

    test('1. An approved sample has a single analytical episode with an approval date', async () => {
        const res = await request(app)
            .get(`/api/samples/${sampleId}/detail`)
            .set('Authorization', `Bearer ${mgrToken}`);

        expect(res.status).toBe(200);
        expect(res.body.sample.episodes).toBeDefined();
        expect(res.body.sample.episodes.length).toBe(1);
        expect(res.body.sample.episodes[0].episodeNumber).toBe(1);
        expect(new Date(res.body.sample.episodes[0].approvedAt).toISOString()).toBe('2026-08-15T10:00:00.000Z');
    });

    test('2. Reopening the sample separates analytical episodes in sample detail', async () => {
        const reopenReason = 'Client requested additional micronutrient determinations';
        const res = await request(app)
            .post(`/api/samples/${sampleId}/undo-approve`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({ reason: reopenReason });

        expect(res.status).toBe(200);

        const detailRes = await request(app)
            .get(`/api/samples/${sampleId}/detail`)
            .set('Authorization', `Bearer ${mgrToken}`);

        expect(detailRes.status).toBe(200);
        const episodes = detailRes.body.sample.episodes;
        expect(episodes).toBeDefined();
        expect(episodes.length).toBe(2);

        // Episode 1 (Pass 1)
        expect(episodes[0].episodeNumber).toBe(1);
        expect(episodes[0].approvedBy).toBe('initial_manager');
        expect(new Date(episodes[0].approvedAt).toISOString()).toBe('2026-08-15T10:00:00.000Z');

        // Episode 2 (Pass 2)
        expect(episodes[1].episodeNumber).toBe(2);
        expect(episodes[1].reopenReason).toContain(reopenReason);
        expect(episodes[1].reopenedAt).toBeDefined();
    });

    test('3. Certificate reportAssembly names the approval date and episodes of each pass', async () => {
        const { content } = await assembleReport(sampleId, { username: 'test_manager' });

        expect(content.sample.episodes).toBeDefined();
        expect(content.sample.episodes.length).toBe(2);
        expect(new Date(content.sample.episodes[0].approvedAt).toISOString()).toBe('2026-08-15T10:00:00.000Z');
        expect(content.sample.episodes[1].reopenReason).toContain('micronutrient');
    });
});
