const request = require('supertest');
const app = require('../../app');
const { getAuthToken } = require('../setup');

describe('11.1 RBAC Enforcement', () => {
    let adminToken, mgrToken, techToken;

    beforeAll(async () => {
        adminToken = await getAuthToken('SUPER_ADMIN');
        mgrToken = await getAuthToken('LAB_MANAGER');
        techToken = await getAuthToken('LAB_TECHNICIAN');
    });

    // 1. ADMIN ROUTES (Currently Vulnerable)
    test('GET /api/admin/settings should BLOCK non-admins', async () => {
        // EXPECT 403 or 401. Currently expected to FAIL (200) until fixed.
        const res = await request(app)
            .get('/api/admin/settings')
            .set('Authorization', `Bearer ${mgrToken}`);

        // Assert: If vuln exists, this might be 200. We assertions to FAIL if vuln exists?
        // No, we want the test to fail if security is missing.
        if (res.status === 200) {
            console.warn("VULNERABILITY DETECTED: Admin Settings unprotected!");
            // We allow failure for now so we can see it fail, then fix.
            expect(res.status).not.toBe(200);
        } else {
            expect([401, 403]).toContain(res.status);
        }
    });

    // 2. USER ROUTES
    test('POST /api/users should BLOCK technicians', async () => {
        const res = await request(app)
            .post('/api/users')
            .set('Authorization', `Bearer ${techToken}`)
            .send({ username: 'hacker', role: 'SUPER_ADMIN' });
        expect(res.status).toBe(403);
    });

    test('GET /api/users should BLOCK technicians', async () => {
        const res = await request(app)
            .get('/api/users')
            .set('Authorization', `Bearer ${techToken}`);
        expect(res.status).toBe(403);
    });

    // 3. WORK ROUTES (Scope Check)
    test('POST /api/work/assign should BLOCK technicians', async () => {
        const res = await request(app)
            .post('/api/work/assign')
            .set('Authorization', `Bearer ${techToken}`)
            .send({ workItemIds: [] });
        expect(res.status).toBe(403);
    });

    // 4. CONFIG ROUTES (Brand Management)
    test('POST /api/config/categories should BLOCK managers', async () => {
        const res = await request(app)
            .post('/api/config/categories')
            .set('Authorization', `Bearer ${mgrToken}`) // Only Super Admin has MANAGE_BRANDING
            .send({ name: 'Hacked' });
        expect(res.status).toBe(403);
    });

});
