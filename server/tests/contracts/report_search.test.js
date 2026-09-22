const request = require('supertest');
const app = require('../../app');
const { getAuthToken } = require('../setup');
const prisma = require('../../prisma');

describe('Issue #124: Result Reports Search & Query Filter Contract', () => {
    let superAdminToken, labAMgrToken, labBMgrToken;
    const labAId = 'LAB-RPT-A';
    const labBId = 'LAB-RPT-B';

    let sampleA1, sampleA2, sampleB;
    let reportA1v1, reportA1v2, reportA2, reportB;

    beforeAll(async () => {
        superAdminToken = await getAuthToken('SUPER_ADMIN', null, ['*'], ['*']);
        labAMgrToken = await getAuthToken('LAB_MANAGER', labAId, ['GTM'], ['*']);
        labBMgrToken = await getAuthToken('LAB_MANAGER', labBId, ['GTM'], ['*']);

        const ts = Date.now();

        // Project Alpha & Beta
        await prisma.project.upsert({
            where: { code: 'GTM-RPT-ALPHA' },
            update: { name: 'Guatemala Highlands Soil Survey', status: 'ACTIVE' },
            create: { id: `PRJ-ALPHA-${ts}`, code: 'GTM-RPT-ALPHA', name: 'Guatemala Highlands Soil Survey', status: 'ACTIVE' }
        });
        await prisma.project.upsert({
            where: { code: 'GTM-RPT-BETA' },
            update: { name: 'Petén Lowlands Fertility', status: 'ACTIVE' },
            create: { id: `PRJ-BETA-${ts}`, code: 'GTM-RPT-BETA', name: 'Petén Lowlands Fertility', status: 'ACTIVE' }
        });

        // Sample A1 (Lab A, Project Alpha)
        sampleA1 = await prisma.sample.create({
            data: {
                id: `SMP-RPT-A1-${ts}`,
                labId: `LAB-RPT-001-${ts}`,
                originalId: `FIELD-RPT-001-${ts}`,
                assignedLab: labAId,
                status: 'APPROVED',
                projectCode: 'GTM-RPT-ALPHA'
            }
        });

        // Sample A2 (Lab A, Project Beta)
        sampleA2 = await prisma.sample.create({
            data: {
                id: `SMP-RPT-A2-${ts}`,
                labId: `LAB-RPT-002-${ts}`,
                originalId: `FIELD-RPT-002-${ts}`,
                assignedLab: labAId,
                status: 'APPROVED',
                projectCode: 'GTM-RPT-BETA'
            }
        });

        // Sample B (Lab B, Project Alpha)
        sampleB = await prisma.sample.create({
            data: {
                id: `SMP-RPT-B-${ts}`,
                labId: `LAB-RPT-B-${ts}`,
                originalId: `FIELD-RPT-B-${ts}`,
                assignedLab: labBId,
                status: 'APPROVED',
                projectCode: 'GTM-RPT-ALPHA'
            }
        });

        // Report A1 version 1 (SUPERSEDED)
        reportA1v1 = await prisma.report.create({
            data: {
                id: `RPT-A1-V1-${ts}`,
                sampleId: sampleA1.id,
                labId: labAId,
                version: 1,
                status: 'SUPERSEDED',
                firstName: 'Mateo',
                surname: 'Morales',
                projectCode: 'GTM-RPT-ALPHA',
                projectName: 'Guatemala Highlands Soil Survey',
                sampleLabId: sampleA1.labId,
                generatedBy: 'test_manager'
            }
        });

        // Report A1 version 2 (PUBLISHED)
        reportA1v2 = await prisma.report.create({
            data: {
                id: `RPT-A1-V2-${ts}`,
                sampleId: sampleA1.id,
                labId: labAId,
                version: 2,
                status: 'PUBLISHED',
                firstName: 'Mateo',
                surname: 'Morales',
                projectCode: 'GTM-RPT-ALPHA',
                projectName: 'Guatemala Highlands Soil Survey',
                sampleLabId: sampleA1.labId,
                generatedBy: 'test_manager'
            }
        });

        // Report A2 (PUBLISHED)
        reportA2 = await prisma.report.create({
            data: {
                id: `RPT-A2-V1-${ts}`,
                sampleId: sampleA2.id,
                labId: labAId,
                version: 1,
                status: 'PUBLISHED',
                firstName: 'Elena',
                surname: 'Gomez',
                projectCode: 'GTM-RPT-BETA',
                projectName: 'Petén Lowlands Fertility',
                sampleLabId: sampleA2.labId,
                generatedBy: 'test_manager'
            }
        });

        // Report B (Lab B, PUBLISHED)
        reportB = await prisma.report.create({
            data: {
                id: `RPT-B-V1-${ts}`,
                sampleId: sampleB.id,
                labId: labBId,
                version: 1,
                status: 'PUBLISHED',
                firstName: 'Mateo',
                surname: 'Alvarez',
                projectCode: 'GTM-RPT-ALPHA',
                projectName: 'Guatemala Highlands Soil Survey',
                sampleLabId: sampleB.labId,
                generatedBy: 'test_manager'
            }
        });
    });

    test('1. Default search returns only PUBLISHED reports in authorized lab', async () => {
        const res = await request(app)
            .get('/api/reports/search')
            .set('Authorization', `Bearer ${labAMgrToken}`);

        expect(res.status).toBe(200);
        const reportIds = res.body.reports.map(r => r.id);
        expect(reportIds).toContain(reportA1v2.id);
        expect(reportIds).toContain(reportA2.id);
        // Superseded version 1 must NOT be in default published list
        expect(reportIds).not.toContain(reportA1v1.id);
        // Lab B's report must NOT be in Lab A's list
        expect(reportIds).not.toContain(reportB.id);
    });

    test('2. Searching with status=SUPERSEDED discovers historical superseded report versions', async () => {
        const res = await request(app)
            .get('/api/reports/search')
            .set('Authorization', `Bearer ${labAMgrToken}`)
            .query({ status: 'SUPERSEDED' });

        expect(res.status).toBe(200);
        const reportIds = res.body.reports.map(r => r.id);
        expect(reportIds).toContain(reportA1v1.id);
        expect(reportIds).not.toContain(reportA1v2.id);
    });

    test('3. Searching with status=ALL discovers all report versions (both published and superseded)', async () => {
        const res = await request(app)
            .get('/api/reports/search')
            .set('Authorization', `Bearer ${labAMgrToken}`)
            .query({ status: 'ALL' });

        expect(res.status).toBe(200);
        const reportIds = res.body.reports.map(r => r.id);
        expect(reportIds).toContain(reportA1v1.id);
        expect(reportIds).toContain(reportA1v2.id);
        expect(reportIds).toContain(reportA2.id);
    });

    test('4. Searching by client name filters accurately across first and surname', async () => {
        const res = await request(app)
            .get('/api/reports/search')
            .set('Authorization', `Bearer ${labAMgrToken}`)
            .query({ q: 'Elena' });

        expect(res.status).toBe(200);
        expect(res.body.reports.length).toBe(1);
        expect(res.body.reports[0].id).toBe(reportA2.id);
        expect(res.body.reports[0].firstName).toBe('Elena');
    });

    test('5. Searching by project code (projectId) filters to that project without relation crashes', async () => {
        const res = await request(app)
            .get('/api/reports/search')
            .set('Authorization', `Bearer ${labAMgrToken}`)
            .query({ projectId: 'GTM-RPT-ALPHA' });

        expect(res.status).toBe(200);
        const reportIds = res.body.reports.map(r => r.id);
        expect(reportIds).toContain(reportA1v2.id);
        expect(reportIds).not.toContain(reportA2.id); // Beta project report excluded
    });

    test('6. Searching by original field ID (originalId) finds the corresponding report', async () => {
        const res = await request(app)
            .get('/api/reports/search')
            .set('Authorization', `Bearer ${labAMgrToken}`)
            .query({ q: sampleA1.originalId });

        expect(res.status).toBe(200);
        const reportIds = res.body.reports.map(r => r.id);
        expect(reportIds).toContain(reportA1v2.id);
    });

    test('7. Cross-lab isolation: Lab A manager searching shared client name "Mateo" does not disclose Lab B reports', async () => {
        const res = await request(app)
            .get('/api/reports/search')
            .set('Authorization', `Bearer ${labAMgrToken}`)
            .query({ q: 'Mateo' });

        expect(res.status).toBe(200);
        const reportIds = res.body.reports.map(r => r.id);
        expect(reportIds).toContain(reportA1v2.id);
        // Must NOT leak Lab B's report for Mateo Alvarez
        expect(reportIds).not.toContain(reportB.id);
    });
});
