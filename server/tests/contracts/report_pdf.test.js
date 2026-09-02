const request = require('supertest');
const app = require('../../app');
const { getAuthToken } = require('../setup');
const { samplesDb, usersDb } = require('../../db');
const prisma = require('../../prisma');

describe('BLK-3: Report & Certificate PDF Generation Contract', () => {
    let mgrToken, sampleId, reportId, shareToken;

    beforeAll(async () => {
        mgrToken = await getAuthToken('LAB_MANAGER', 'LAB-PDF', ['PDF'], ['PDF-PROJ']);

        // Create an approved sample with results
        const s = samplesDb.create({
            id: `SMP-PDF-${Date.now()}`,
            labId: 'LAB-PDF-001',
            originalId: `FLD-PDF-${Date.now()}`,
            assignedLab: 'LAB-PDF',
            status: 'APPROVED',
            dryingStatus: 'DONE',
            preparationStatus: 'DONE',
            requiredAnalyses: ['PH_H2O', 'SOC', 'SAND', 'SILT', 'CLAY']
        });
        sampleId = s.id;

        // Add verified results to the sample in DB
        const now = new Date();
        await prisma.result.createMany({
            data: [
                { id: `RES-1-${Date.now()}`, sampleId: s.id, param: 'PH_H2O', value: '6.8', unit: 'pH units', isValid: true, createdAt: now, updatedAt: now },
                { id: `RES-2-${Date.now()}`, sampleId: s.id, param: 'SOC', value: '18.5', unit: 'g/kg', isValid: true, createdAt: now, updatedAt: now },
                { id: `RES-3-${Date.now()}`, sampleId: s.id, param: 'SAND', value: '60.0', unit: '%', isValid: true, createdAt: now, updatedAt: now },
                { id: `RES-4-${Date.now()}`, sampleId: s.id, param: 'SILT', value: '25.0', unit: '%', isValid: true, createdAt: now, updatedAt: now },
                { id: `RES-5-${Date.now()}`, sampleId: s.id, param: 'CLAY', value: '15.0', unit: '%', isValid: true, createdAt: now, updatedAt: now }
            ]
        });

        // 1. Generate Report
        const genRes = await request(app)
            .post(`/api/reports/generate/${sampleId}`)
            .set('Authorization', `Bearer ${mgrToken}`);
        expect(genRes.status).toBe(200);
        reportId = genRes.body.id;

        // 2. Create Share Link
        const shareRes = await request(app)
            .post(`/api/reports/${reportId}/share`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({ expiresInDays: 7 });
        expect(shareRes.status).toBe(200);
        shareToken = shareRes.body.token;
    });

    test('1. Public PDF download returns valid binary application/pdf buffer', async () => {
        const res = await request(app)
            .get(`/api/reports/public/${shareToken}/pdf`)
            .buffer(true)
            .parse((res, callback) => {
                res.data = '';
                res.setEncoding('binary');
                res.on('data', (chunk) => { res.data += chunk; });
                res.on('end', () => { callback(null, Buffer.from(res.data, 'binary')); });
            });

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/application\/pdf/);
        expect(res.headers['content-disposition']).toMatch(/SoilFER_Report_/);

        // Check magic bytes for PDF (%PDF-)
        const magicBytes = res.body.slice(0, 5).toString('ascii');
        expect(magicBytes).toBe('%PDF-');
        expect(res.body.length).toBeGreaterThan(1000); // Realistic multi-KB document
    });

    test('2. Authenticated report PDF endpoint returns valid PDF', async () => {
        const res = await request(app)
            .get(`/api/reports/${reportId}/pdf`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .buffer(true)
            .parse((res, callback) => {
                res.data = '';
                res.setEncoding('binary');
                res.on('data', (chunk) => { res.data += chunk; });
                res.on('end', () => { callback(null, Buffer.from(res.data, 'binary')); });
            });

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/application\/pdf/);
        expect(res.body.slice(0, 5).toString('ascii')).toBe('%PDF-');
    });

    test('3. Authenticated sample PDF endpoint generates certificate on-the-fly', async () => {
        const res = await request(app)
            .get(`/api/reports/sample/${sampleId}/pdf`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .buffer(true)
            .parse((res, callback) => {
                res.data = '';
                res.setEncoding('binary');
                res.on('data', (chunk) => { res.data += chunk; });
                res.on('end', () => { callback(null, Buffer.from(res.data, 'binary')); });
            });

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/application\/pdf/);
        expect(res.body.slice(0, 5).toString('ascii')).toBe('%PDF-');
    });

    test('4. Non-existent public token returns 404 JSON (not silent 200 or crash)', async () => {
        const res = await request(app).get('/api/reports/public/invalid-token-12345/pdf');
        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/Report not found or link invalid/);
    });

    test('5. Revoked share link returns 410 Gone', async () => {
        // List and revoke link
        const linksRes = await request(app)
            .get(`/api/reports/${reportId}/links`)
            .set('Authorization', `Bearer ${mgrToken}`);
        const linkId = linksRes.body[0].id;

        const revokeRes = await request(app)
            .post(`/api/reports/links/${linkId}/revoke`)
            .set('Authorization', `Bearer ${mgrToken}`);
        expect(revokeRes.status).toBe(200);

        const pdfRes = await request(app).get(`/api/reports/public/${shareToken}/pdf`);
        expect(pdfRes.status).toBe(410);
        expect(pdfRes.body.error).toMatch(/revoked/);
    });
});
