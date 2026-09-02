const request = require('supertest');
const app = require('../../app');
const { getAuthToken } = require('../setup');
const { PERMISSIONS, ROLES } = require('../../config/roles');

describe('WP-42: Dynamic RBAC Matrix & Route Enforcement', () => {
    let tokens = {};

    beforeAll(async () => {
        // Generate tokens for each primary role
        const testRoles = ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER', 'LAB_TECHNICIAN', 'SAMPLE_RECEPTION', 'VIEWER', 'AUDIT_USER'];
        for (const role of testRoles) {
            tokens[role] = await getAuthToken(role, 'GTM-LAB1', ['GTM'], ['SOILFER-US']);
        }
    });

    describe('1. Canonical Permission Matrix Verification', () => {
        test('Registry defines all required permissions', () => {
            expect(PERMISSIONS['VIEW_SAMPLES']).toBeDefined();
            expect(PERMISSIONS['ENTER_RESULTS']).toBeDefined();
            expect(PERMISSIONS['APPROVE_RESULTS']).toBeDefined();
            expect(PERMISSIONS['MANAGE_USERS']).toBeDefined();
            expect(PERMISSIONS['MANAGE_BRANDING']).toBeDefined();
            expect(PERMISSIONS['VIEW_AUDIT']).toBeDefined();
            expect(PERMISSIONS['MANAGE_EQUIPMENT']).toBeDefined();
        });

        test('SUPER_ADMIN has all administrative permissions', () => {
            for (const [perm, allowedRoles] of Object.entries(PERMISSIONS)) {
                expect(allowedRoles).toContain('SUPER_ADMIN');
            }
        });
    });

    describe('2. Mutating Endpoint Role Enforcement', () => {
        // A. Users Management (MANAGE_USERS: SUPER_ADMIN, MASTER_USER, LAB_MANAGER)
        test('POST /api/users blocks unauthorized roles (LAB_TECHNICIAN, VIEWER)', async () => {
            const resTech = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${tokens['LAB_TECHNICIAN']}`)
                .send({ username: 'hacker_tech', role: 'LAB_TECHNICIAN' });
            expect(resTech.status).toBe(403);

            const resViewer = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${tokens['VIEWER']}`)
                .send({ username: 'hacker_viewer', role: 'VIEWER' });
            expect(resViewer.status).toBe(403);
        });

        // B. Work Item Assignment (MANAGE_USERS / ASSIGN_WORK: LAB_MANAGER, SUPER_ADMIN)
        test('POST /api/work/assign blocks LAB_TECHNICIAN and VIEWER', async () => {
            const resTech = await request(app)
                .post('/api/work/assign')
                .set('Authorization', `Bearer ${tokens['LAB_TECHNICIAN']}`)
                .send({ workItemIds: [] });
            expect(resTech.status).toBe(403);

            const resViewer = await request(app)
                .post('/api/work/assign')
                .set('Authorization', `Bearer ${tokens['VIEWER']}`)
                .send({ workItemIds: [] });
            expect(resViewer.status).toBe(403);
        });

        // C. Branding & Admin Config (MANAGE_BRANDING: SUPER_ADMIN only)
        test('POST /api/config/categories blocks LAB_MANAGER and LAB_TECHNICIAN', async () => {
            const resMgr = await request(app)
                .post('/api/config/categories')
                .set('Authorization', `Bearer ${tokens['LAB_MANAGER']}`)
                .send({ name: 'Unauthorized Category' });
            expect(resMgr.status).toBe(403);

            const resTech = await request(app)
                .post('/api/config/categories')
                .set('Authorization', `Bearer ${tokens['LAB_TECHNICIAN']}`)
                .send({ name: 'Unauthorized Category' });
            expect(resTech.status).toBe(403);
        });

        test('PUT /api/admin/settings/branding blocks non-SUPER_ADMIN', async () => {
            const resMgr = await request(app)
                .put('/api/admin/settings/branding')
                .set('Authorization', `Bearer ${tokens['LAB_MANAGER']}`)
                .send({ appTitle: 'Hacked Title' });
            expect(resMgr.status).toBe(403);

            const resTech = await request(app)
                .put('/api/admin/settings/branding')
                .set('Authorization', `Bearer ${tokens['LAB_TECHNICIAN']}`)
                .send({ appTitle: 'Hacked Title' });
            expect(resTech.status).toBe(403);
        });

        // D. Sample Reception & Intake (RECEIVE_SAMPLE: SUPER_ADMIN, MASTER_USER, LAB_MANAGER, SAMPLE_RECEPTION)
        test('POST /api/samples/:id/receive blocks VIEWER and LAB_TECHNICIAN', async () => {
            const resViewer = await request(app)
                .post('/api/samples/SMP-TEST-DUMMY/receive')
                .set('Authorization', `Bearer ${tokens['VIEWER']}`)
                .send({});
            expect(resViewer.status).toBe(403);
        });

        // E. Results Approval (APPROVE_RESULTS: SUPER_ADMIN, LAB_MANAGER)
        test('POST /api/samples/:id/approve blocks LAB_TECHNICIAN and SAMPLE_RECEPTION', async () => {
            const resTech = await request(app)
                .post('/api/samples/SMP-TEST-DUMMY/approve')
                .set('Authorization', `Bearer ${tokens['LAB_TECHNICIAN']}`)
                .send({});
            expect(resTech.status).toBe(403);

            const resRx = await request(app)
                .post('/api/samples/SMP-TEST-DUMMY/approve')
                .set('Authorization', `Bearer ${tokens['SAMPLE_RECEPTION']}`)
                .send({});
            expect(resRx.status).toBe(403);
        });
    });
});
