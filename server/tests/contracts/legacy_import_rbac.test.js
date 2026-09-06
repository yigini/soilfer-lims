const request = require('supertest');
const app = require('../../app');
const { getAuthToken } = require('../setup');

describe('Legacy Import RBAC Contract', () => {
    let receptionToken, managerToken, adminToken, techToken, viewerToken;

    beforeAll(async () => {
        receptionToken = await getAuthToken('SAMPLE_RECEPTION', 'LAB-GTM');
        managerToken = await getAuthToken('LAB_MANAGER', 'LAB-GTM');
        adminToken = await getAuthToken('SUPER_ADMIN');
        techToken = await getAuthToken('LAB_TECHNICIAN', 'LAB-GTM');
        viewerToken = await getAuthToken('VIEWER', 'LAB-GTM');
    });

    describe('POST /api/import/preview', () => {
        test('1. Unauthenticated request is rejected with 401', async () => {
            const res = await request(app)
                .post('/api/import/preview')
                .send({ csvContent: 'Sample_ID,pH\nS1,7.0' });
            expect(res.status).toBe(401);
        });

        test('2. Unauthorized roles (LAB_TECHNICIAN, VIEWER) receive 403 Forbidden', async () => {
            const techRes = await request(app)
                .post('/api/import/preview')
                .set('Authorization', `Bearer ${techToken}`)
                .send({ csvContent: 'Sample_ID,pH\nS1,7.0' });
            expect(techRes.status).toBe(403);

            const viewerRes = await request(app)
                .post('/api/import/preview')
                .set('Authorization', `Bearer ${viewerToken}`)
                .send({ csvContent: 'Sample_ID,pH\nS1,7.0' });
            expect(viewerRes.status).toBe(403);
        });

        test('3. Authorized role SAMPLE_RECEPTION can access preview endpoint', async () => {
            const res = await request(app)
                .post('/api/import/preview')
                .set('Authorization', `Bearer ${receptionToken}`)
                .send({ csvText: 'Sample_ID,pH_water\nSMP-001,6.5' });
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('headers');
            expect(res.body.headers).toContain('Sample_ID');
        });

        test('4. Authorized role LAB_MANAGER can access preview endpoint', async () => {
            const res = await request(app)
                .post('/api/import/preview')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({ csvText: 'Sample_ID,pH_water\nSMP-002,7.1' });
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('headers');
        });

        test('5. Authorized role SUPER_ADMIN can access preview endpoint', async () => {
            const res = await request(app)
                .post('/api/import/preview')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ csvText: 'Sample_ID,pH_water\nSMP-003,6.8' });
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('headers');
        });
    });

    describe('POST /api/import/execute', () => {
        test('6. Unauthorized roles receive 403 Forbidden', async () => {
            const res = await request(app)
                .post('/api/import/execute')
                .set('Authorization', `Bearer ${techToken}`)
                .send({ rows: [] });
            expect(res.status).toBe(403);
        });

        test('7. Authorized role reaches validation gate (not 401 or 403)', async () => {
            const res = await request(app)
                .post('/api/import/execute')
                .set('Authorization', `Bearer ${receptionToken}`)
                .send({
                    sampleIdColumn: 'Sample_ID',
                    labId: 'LAB-GTM',
                    columnMappings: [],
                    rows: [{ Sample_ID: 'TEST-1' }]
                });
            // Should pass RBAC gate and be handled by controller validation logic (400 Bad Request)
            expect(res.status).toBe(400);
            expect(res.status).not.toBe(401);
            expect(res.status).not.toBe(403);
        });
    });
});
