const request = require('supertest');
const app = require('../../app');
const { getAuthToken } = require('../setup');
const { buildScopedWhere, hasGlobalAccess, getLabScope, canAccessEntity } = require('../../utils/scopeGuard');
const prisma = require('../../prisma');

describe('WP-41: Multi-Tenancy Lab Isolation Regression Suite', () => {
    let tokenGTMManager, tokenGTMTech, tokenHNDManager, tokenHNDTech, tokenSuperAdmin;
    let sampleGTMId, sampleHNDId;

    beforeAll(async () => {
        tokenSuperAdmin = await getAuthToken('SUPER_ADMIN');
        tokenGTMManager = await getAuthToken('LAB_MANAGER', 'GTM-LAB1', ['GTM'], ['SOILFER-US']);
        tokenGTMTech = await getAuthToken('LAB_TECHNICIAN', 'GTM-LAB1', ['GTM'], ['SOILFER-US']);
        tokenHNDManager = await getAuthToken('LAB_MANAGER', 'HND-LAB1', ['HND'], ['SOILFER-US']);
        tokenHNDTech = await getAuthToken('LAB_TECHNICIAN', 'HND-LAB1', ['HND'], ['SOILFER-US']);

        // Find or create test samples for GTM and HND
        let sampleGTM = await prisma.sample.findFirst({
            where: {
                country: 'GTM',
                OR: [
                    { assignedLab: 'GTM-LAB1' },
                    { labId: 'GTM-LAB1' }
                ]
            }
        });
        if (!sampleGTM) {
            sampleGTM = await prisma.sample.create({
                data: {
                    id: 'SMP-TEST-GTM-001',
                    originalId: 'ORIG-TEST-GTM-001',
                    assignedLab: 'GTM-LAB1',
                    labId: 'GTM-LAB1',
                    country: 'GTM',
                    projectCode: 'SOILFER-US',
                    status: 'PROCESSING'
                }
            });
        }
        sampleGTMId = sampleGTM.id;

        let sampleHND = await prisma.sample.findFirst({
            where: {
                country: 'HND',
                OR: [
                    { assignedLab: 'HND-LAB1' },
                    { labId: 'HND-LAB1' }
                ]
            }
        });
        if (!sampleHND) {
            sampleHND = await prisma.sample.create({
                data: {
                    id: 'SMP-TEST-HND-001',
                    originalId: 'ORIG-TEST-HND-001',
                    assignedLab: 'HND-LAB1',
                    labId: 'HND-LAB1',
                    country: 'HND',
                    projectCode: 'SOILFER-US',
                    status: 'PROCESSING'
                }
            });
        }
        sampleHNDId = sampleHND.id;
    });

    describe('1. Direct Entity Access & Cross-Lab Denial', () => {
        test('GTM Manager requesting HND sample by ID receives 403 or 404', async () => {
            const res = await request(app)
                .get(`/api/samples/${sampleHNDId}/detail`)
                .set('Authorization', `Bearer ${tokenGTMManager}`);
            expect([403, 404]).toContain(res.status);
        });

        test('GTM Technician requesting HND sample by ID receives 403 or 404', async () => {
            const res = await request(app)
                .get(`/api/samples/${sampleHNDId}/detail`)
                .set('Authorization', `Bearer ${tokenGTMTech}`);
            expect([403, 404]).toContain(res.status);
        });

        test('HND Manager requesting GTM sample by ID receives 403 or 404', async () => {
            const res = await request(app)
                .get(`/api/samples/${sampleGTMId}/detail`)
                .set('Authorization', `Bearer ${tokenHNDManager}`);
            expect([403, 404]).toContain(res.status);
        });

        test('Super Admin can access both GTM and HND samples', async () => {
            const resGTM = await request(app)
                .get(`/api/samples/${sampleGTMId}/detail`)
                .set('Authorization', `Bearer ${tokenSuperAdmin}`);
            expect(resGTM.status).toBe(200);

            const resHND = await request(app)
                .get(`/api/samples/${sampleHNDId}/detail`)
                .set('Authorization', `Bearer ${tokenSuperAdmin}`);
            expect(resHND.status).toBe(200);
        });
    });

    describe('2. List & Query Scoping (No Cross-Lab Leaks)', () => {
        test('GET /api/samples for GTM Manager contains ONLY GTM samples', async () => {
            const res = await request(app)
                .get('/api/samples?limit=50')
                .set('Authorization', `Bearer ${tokenGTMManager}`);

            expect(res.status).toBe(200);
            const samples = res.body.data || res.body.samples || [];
            expect(samples.length).toBeGreaterThan(0);
            for (const s of samples) {
                const isGTM = s.country === 'GTM' || s.labId === 'GTM-LAB1' || s.assignedLab === 'GTM-LAB1' || s.labId === 'S001';
                expect(isGTM).toBe(true);
            }
        });

        test('GET /api/users for GTM Manager contains ONLY GTM staff', async () => {
            const res = await request(app)
                .get('/api/users')
                .set('Authorization', `Bearer ${tokenGTMManager}`);

            expect(res.status).toBe(200);
            const users = res.body.data || res.body.users || [];
            for (const u of users) {
                if (u.labId) {
                    expect(u.labId).toBe('GTM-LAB1');
                }
            }
        });
    });

    describe('3. ScopeGuard Unit Verification (Test of the Test)', () => {
        test('buildScopedWhere isolates by labId for non-admin', () => {
            const gtmUser = { username: 'mgr_gtm', role: 'LAB_MANAGER', labId: 'GTM-LAB1' };
            const where = buildScopedWhere(gtmUser, {}, { entityType: 'Generic', labField: 'labId' });
            expect(where.OR).toBeDefined();
            expect(where.OR).toContainEqual({ labId: 'GTM-LAB1' });
        });

        test('buildScopedWhere returns empty object for SUPER_ADMIN', () => {
            const adminUser = { username: 'admin', role: 'SUPER_ADMIN', labId: null };
            const where = buildScopedWhere(adminUser);
            expect(where).toEqual({});
        });

        test('canAccessEntity returns false when lab IDs mismatch', () => {
            const gtmUser = { username: 'tech_gtm_1', role: 'LAB_TECHNICIAN', labId: 'GTM-LAB1' };
            const hndEntity = { id: 'SMP-123', labId: 'HND-LAB1' };
            expect(canAccessEntity(gtmUser, hndEntity)).toBe(false);
        });
    });

    describe('4. SD-02: Work Assignment & Reassignment Sample-Bound Isolation', () => {
        let wiGTMId;
        const testSampleId = 'SMP-TEST-SD02-GTM-' + Date.now();
        const gtmTechUsername = 'test_lab_technician_gtmlab1';
        const hndTechUsername = 'test_lab_technician_hndlab1';

        beforeAll(async () => {
            // Ensure technicians exist in Prisma User table
            await prisma.user.upsert({
                where: { username: gtmTechUsername },
                update: { role: 'LAB_TECHNICIAN', labId: 'GTM-LAB1', isActive: true },
                create: {
                    id: 'usr-gtm-tech-sd02',
                    username: gtmTechUsername,
                    email: 'gtm_tech_sd02@soilfer.org',
                    password: 'hash',
                    role: 'LAB_TECHNICIAN',
                    labId: 'GTM-LAB1',
                    isActive: true
                }
            });
            await prisma.user.upsert({
                where: { username: hndTechUsername },
                update: { role: 'LAB_TECHNICIAN', labId: 'HND-LAB1', isActive: true },
                create: {
                    id: 'usr-hnd-tech-sd02',
                    username: hndTechUsername,
                    email: 'hnd_tech_sd02@soilfer.org',
                    password: 'hash',
                    role: 'LAB_TECHNICIAN',
                    labId: 'HND-LAB1',
                    isActive: true
                }
            });

            // Create a dedicated active sample in GTM
            await prisma.sample.create({
                data: {
                    id: testSampleId,
                    originalId: testSampleId,
                    assignedLab: 'GTM-LAB1',
                    labId: 'GTM-LAB1',
                    country: 'GTM',
                    projectCode: 'SOILFER-US',
                    status: 'PROCESSING',
                    matrix: 'SOIL'
                }
            });

            // Ensure a work item exists on the GTM sample
            const wi = await prisma.workItem.create({
                data: {
                    id: 'WI-TEST-SD02-' + Date.now(),
                    sampleId: testSampleId,
                    assignedLab: 'GTM-LAB1',
                    labId: 'GTM-LAB1',
                    analysis: 'PH_H2O',
                    status: 'NOT_ASSIGNED'
                }
            });
            wiGTMId = wi.id;
        });

        afterAll(async () => {
            await prisma.workItem.deleteMany({
                where: { id: wiGTMId }
            });
            await prisma.sample.deleteMany({
                where: { id: testSampleId }
            });
        });

        test('SUPER_ADMIN cannot assign a GTM sample work item to an HND technician (HTTP 403)', async () => {
            const res = await request(app)
                .post('/api/work/assign')
                .set('Authorization', `Bearer ${tokenSuperAdmin}`)
                .send({
                    workItemIds: [wiGTMId],
                    assignee: hndTechUsername
                });

            expect(res.status).toBe(403);
            expect(res.body.error).toMatch(/is not in GTM-LAB1/);
        });

        test('SUPER_ADMIN cannot reassign a GTM sample work item to an HND technician (HTTP 403)', async () => {
            const res = await request(app)
                .post(`/api/work/${wiGTMId}/reassign`)
                .set('Authorization', `Bearer ${tokenSuperAdmin}`)
                .send({
                    technicianUserId: hndTechUsername,
                    reason: 'Cross-lab assignment attempt by admin'
                });

            expect(res.status).toBe(403);
            expect(res.body.error).toMatch(/is not in GTM-LAB1/);
        });

        test('GTM Manager assigning a GTM sample work item to a GTM technician succeeds (HTTP 200)', async () => {
            const res = await request(app)
                .post('/api/work/assign')
                .set('Authorization', `Bearer ${tokenGTMManager}`)
                .send({
                    workItemIds: [wiGTMId],
                    assignee: gtmTechUsername
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const updated = await prisma.workItem.findUnique({ where: { id: wiGTMId } });
            expect(updated.assignedTo).toBe(gtmTechUsername);
            expect(updated.status).toBe('ASSIGNED');
        });

        test('GTM Manager reassigning a GTM work item to another/same GTM technician succeeds (HTTP 200)', async () => {
            const res = await request(app)
                .post(`/api/work/${wiGTMId}/reassign`)
                .set('Authorization', `Bearer ${tokenGTMManager}`)
                .send({
                    technicianUserId: gtmTechUsername,
                    reason: 'Reassigning within same lab'
                });

            expect(res.status).toBe(200);
            expect(res.body.workItem.assignedTo).toBe(gtmTechUsername);
            expect(res.body.newAssignee).toBe(gtmTechUsername);
        });
    });
});
