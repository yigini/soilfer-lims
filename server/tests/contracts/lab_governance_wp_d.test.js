'use strict';

/**
 * Work Package D (WP-D) Contract Tests:
 * Laboratory Lifecycle, Workspace Metrics, and Project-to-Lab Relationships
 * 
 * Verifies:
 * 1. Laboratory Workspace Scoping & Workload Breakdown (Counts, attention items, capabilities)
 * 2. Strict Profile Allowlist & IANA Timezone Validation (Rejection of immutable fields)
 * 3. Lifecycle Transition Preview (Impact evaluation, signed review token)
 * 4. Explicit Lifecycle State Transitions (SETUP, ACTIVE, PAUSED, RETIRED)
 * 5. Anti-Cascade Safety Invariant (Lab deactivation preserves User.isActive)
 * 6. Retirement Gate (Unresolved open work blocks retirement)
 * 7. Project-to-Lab Servicing Membership (Owner authority, servicing reconciliation)
 */

const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../config/auth');

describe('WP-D: Laboratory Lifecycle & Project Relationships', () => {
    const SUFFIX = 'WPD-' + Date.now();

    let labA, labB, labRetired;
    let superAdmin, managerA, managerB, techA, techB;
    let tokenSA, tokenMgrA, tokenMgrB, tokenTechA;
    let projectOwnedA, sampleA1, workItemA1;

    beforeAll(async () => {
        // Create Labs
        labA = await prisma.lab.create({
            data: {
                id: 'lab-wpd-A-' + SUFFIX,
                code: 'LWPA-' + Date.now().toString().slice(-4),
                name: 'Main Testing Lab A ' + SUFFIX,
                country: 'Guatemala',
                timezone: 'America/Guatemala',
                capacity: 500,
                isActive: true
            }
        });

        labB = await prisma.lab.create({
            data: {
                id: 'lab-wpd-B-' + SUFFIX,
                code: 'LWPB-' + Date.now().toString().slice(-4),
                name: 'Regional Lab B ' + SUFFIX,
                country: 'Guatemala',
                timezone: 'America/Guatemala',
                capacity: 250,
                isActive: true
            }
        });

        labRetired = await prisma.lab.create({
            data: {
                id: 'lab-wpd-ret-' + SUFFIX,
                code: 'LWPR-' + Date.now().toString().slice(-4),
                name: 'Retired Lab ' + SUFFIX,
                country: 'Guatemala',
                timezone: 'America/Guatemala',
                isActive: false
            }
        });

        // Create Users
        superAdmin = await prisma.user.create({
            data: {
                id: 'usr-sa-' + SUFFIX,
                username: 'sa_' + SUFFIX,
                email: ('sa_' + SUFFIX + '@test.org').toLowerCase(),
                name: 'Super Administrator',
                password: 'hash',
                role: 'SUPER_ADMIN',
                isActive: true,
                tokenVersion: 1
            }
        });

        managerA = await prisma.user.create({
            data: {
                id: 'usr-mgrA-' + SUFFIX,
                username: 'mgrA_' + SUFFIX,
                email: ('mgrA_' + SUFFIX + '@test.org').toLowerCase(),
                name: 'Manager Lab A',
                password: 'hash',
                role: 'LAB_MANAGER',
                labId: labA.id,
                isActive: true,
                tokenVersion: 1
            }
        });

        managerB = await prisma.user.create({
            data: {
                id: 'usr-mgrB-' + SUFFIX,
                username: 'mgrB_' + SUFFIX,
                email: ('mgrB_' + SUFFIX + '@test.org').toLowerCase(),
                name: 'Manager Lab B',
                password: 'hash',
                role: 'LAB_MANAGER',
                labId: labB.id,
                isActive: true,
                tokenVersion: 1
            }
        });

        techA = await prisma.user.create({
            data: {
                id: 'usr-techA-' + SUFFIX,
                username: 'techA_' + SUFFIX,
                email: ('techA_' + SUFFIX + '@test.org').toLowerCase(),
                name: 'Technician Lab A',
                password: 'hash',
                role: 'LAB_TECHNICIAN',
                labId: labA.id,
                isActive: true,
                tokenVersion: 1
            }
        });

        techB = await prisma.user.create({
            data: {
                id: 'usr-techB-' + SUFFIX,
                username: 'techB_' + SUFFIX,
                email: ('techB_' + SUFFIX + '@test.org').toLowerCase(),
                name: 'Technician Lab B',
                password: 'hash',
                role: 'LAB_TECHNICIAN',
                labId: labB.id,
                isActive: true,
                tokenVersion: 1
            }
        });

        // Create Sample & WorkItem in Lab A
        sampleA1 = await prisma.sample.create({
            data: {
                id: 'SMP-WPD-A1-' + SUFFIX,
                originalId: 'ORIG-A1-' + SUFFIX,
                labId: labA.id,
                assignedLab: labA.id,
                status: 'IN_ANALYSIS',
                matrix: 'SOIL'
            }
        });

        workItemA1 = await prisma.workItem.create({
            data: {
                id: 'WI-WPD-A1-' + SUFFIX,
                sampleId: sampleA1.id,
                labId: labA.id,
                analysis: 'PH',
                status: 'ASSIGNED',
                assignedTo: techA.username
            }
        });

        // Create Project owned by Lab A
        projectOwnedA = await prisma.project.create({
            data: {
                id: 'PRJ-WPD-A-' + SUFFIX,
                code: 'PRJA-' + Date.now().toString().slice(-4),
                name: 'National Soil Survey ' + SUFFIX,
                status: 'ACTIVE',
                labId: labA.id,
                assignedLabIds: JSON.stringify([labA.id])
            }
        });

        await prisma.projectLab.create({
            data: {
                id: 'pl-init-' + SUFFIX,
                projectCode: projectOwnedA.code,
                labId: labA.id,
                role: 'PRIMARY'
            }
        });

        // Sign JWT tokens
        tokenSA = jwt.sign({ id: superAdmin.id, username: superAdmin.username, role: superAdmin.role, tokenVersion: 1 }, JWT_SECRET, { expiresIn: '1h' });
        tokenMgrA = jwt.sign({ id: managerA.id, username: managerA.username, role: managerA.role, labId: labA.id, tokenVersion: 1 }, JWT_SECRET, { expiresIn: '1h' });
        tokenMgrB = jwt.sign({ id: managerB.id, username: managerB.username, role: managerB.role, labId: labB.id, tokenVersion: 1 }, JWT_SECRET, { expiresIn: '1h' });
        tokenTechA = jwt.sign({ id: techA.id, username: techA.username, role: techA.role, labId: labA.id, tokenVersion: 1 }, JWT_SECRET, { expiresIn: '1h' });
    });

    afterAll(async () => {
        try {
            await prisma.projectLab.deleteMany({ where: { labId: { in: [labA.id, labB.id, labRetired.id] } } });
            await prisma.workItem.deleteMany({ where: { labId: { in: [labA.id, labB.id, labRetired.id] } } });
            await prisma.sample.deleteMany({ where: { labId: { in: [labA.id, labB.id, labRetired.id] } } });
            await prisma.project.deleteMany({ where: { id: projectOwnedA.id } });
            await prisma.user.deleteMany({ where: { id: { in: [superAdmin.id, managerA.id, managerB.id, techA.id, techB.id] } } });
            await prisma.lab.deleteMany({ where: { id: { in: [labA.id, labB.id, labRetired.id] } } });
        } catch (e) {
            // cleanup best effort
        }
    });

    describe('1. Laboratory Workspace Scoping (GET /api/labs/:id/workspace)', () => {
        test('Super Admin retrieves full workspace with accurate workload counts', async () => {
            const res = await request(app)
                .get(`/api/labs/${labA.id}/workspace`)
                .set('Authorization', `Bearer ${tokenSA}`);

            expect(res.status).toBe(200);
            expect(res.body.lab.id).toBe(labA.id);
            expect(res.body.operationalStatus).toBe('ACTIVE');
            expect(res.body.responsibleManager.username).toBe(managerA.username);
            expect(res.body.counts.samples.total).toBe(1);
            expect(res.body.counts.workItems.open).toBe(1);
            expect(res.body.counts.staff.active).toBe(2); // managerA, techA
            expect(res.body.capabilities.canManageLifecycle).toBe(true);
        });

        test('Lab Manager retrieves workspace for own lab', async () => {
            const res = await request(app)
                .get(`/api/labs/${labA.id}/workspace`)
                .set('Authorization', `Bearer ${tokenMgrA}`);

            expect(res.status).toBe(200);
            expect(res.body.lab.id).toBe(labA.id);
            expect(res.body.capabilities.canManageProfile).toBe(true);
            expect(res.body.capabilities.canManageLifecycle).toBe(false); // Only admin can transition lifecycle
        });

        test('Lab Manager cannot access workspace of another lab (403 Forbidden)', async () => {
            const res = await request(app)
                .get(`/api/labs/${labB.id}/workspace`)
                .set('Authorization', `Bearer ${tokenMgrA}`);

            expect(res.status).toBe(403);
            expect(res.body.code).toBe('TARGET_OUTSIDE_SCOPE');
        });
    });

    describe('2. Strict Profile Allowlist & Validation (PATCH /api/labs/:id/profile)', () => {
        test('Manager updates own lab profile with valid IANA timezone and capacity', async () => {
            const res = await request(app)
                .patch(`/api/labs/${labA.id}/profile`)
                .set('Authorization', `Bearer ${tokenMgrA}`)
                .send({
                    name: 'Updated Lab A Name',
                    city: 'Guatemala City',
                    timezone: 'America/Guatemala',
                    capacity: 600
                });

            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Updated Lab A Name');
            expect(res.body.city).toBe('Guatemala City');
            expect(res.body.capacity).toBe(600);
        });

        test('Rejects invalid IANA time zone identifier with 400 INVALID_TIMEZONE', async () => {
            const res = await request(app)
                .patch(`/api/labs/${labA.id}/profile`)
                .set('Authorization', `Bearer ${tokenMgrA}`)
                .send({
                    timezone: 'Invalid/NonExistent_Zone_123'
                });

            expect(res.status).toBe(400);
            expect(res.body.code).toBe('INVALID_TIMEZONE');
        });

        test('Rejects attempt to alter immutable fields (id, code, isActive) with 400 IMMUTABLE_FIELDS_REJECTED', async () => {
            const res = await request(app)
                .patch(`/api/labs/${labA.id}/profile`)
                .set('Authorization', `Bearer ${tokenMgrA}`)
                .send({
                    id: 'NEW_MALICIOUS_ID',
                    isActive: false
                });

            expect(res.status).toBe(400);
            expect(res.body.code).toBe('IMMUTABLE_FIELDS_REJECTED');
        });

        test('Manager cannot update profile of another lab (403 Forbidden)', async () => {
            const res = await request(app)
                .patch(`/api/labs/${labB.id}/profile`)
                .set('Authorization', `Bearer ${tokenMgrA}`)
                .send({
                    name: 'Hacked Lab B'
                });

            expect(res.status).toBe(403);
            expect(res.body.code).toBe('TARGET_OUTSIDE_SCOPE');
        });
    });

    describe('3. Lifecycle Transition Preview (POST /api/labs/:id/lifecycle-preview)', () => {
        test('Super Admin previews PAUSED impact, returning open counts and signed reviewToken', async () => {
            const res = await request(app)
                .post(`/api/labs/${labA.id}/lifecycle-preview`)
                .set('Authorization', `Bearer ${tokenSA}`)
                .send({
                    targetState: 'PAUSED'
                });

            expect(res.status).toBe(200);
            expect(res.body.labId).toBe(labA.id);
            expect(res.body.currentStatus).toBe('ACTIVE');
            expect(res.body.targetStatus).toBe('PAUSED');
            expect(res.body.openAssignmentsCount).toBe(1);
            expect(res.body.pendingSamplesCount).toBe(1);
            expect(res.body.warnings.length).toBeGreaterThan(0);
            expect(res.body.reviewToken).toBeDefined();
        });

        test('Non-admin cannot preview lifecycle changes (403 Forbidden)', async () => {
            const res = await request(app)
                .post(`/api/labs/${labA.id}/lifecycle-preview`)
                .set('Authorization', `Bearer ${tokenMgrA}`)
                .send({
                    targetState: 'PAUSED'
                });

            expect(res.status).toBe(403);
            expect(res.body.code).toBe('INSUFFICIENT_PERMISSIONS');
        });
    });

    describe('4. Lifecycle State Transitions & Anti-Cascade Safety (POST /api/labs/:id/lifecycle)', () => {
        test('Super Admin pauses laboratory: sets operationalStatus=PAUSED, lab.isActive=false', async () => {
            const res = await request(app)
                .post(`/api/labs/${labA.id}/lifecycle`)
                .set('Authorization', `Bearer ${tokenSA}`)
                .send({
                    targetState: 'PAUSED',
                    reason: 'Facility decontamination and instrumentation audit'
                });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('APPLIED');
            expect(res.body.operationalStatus).toBe('PAUSED');
            expect(res.body.isActive).toBe(false);

            // Invariant Check: Staff accounts MUST NOT be cascaded to inactive
            const staffA = await prisma.user.findUnique({ where: { id: techA.id } });
            expect(staffA.isActive).toBe(true);

            const managerStaffA = await prisma.user.findUnique({ where: { id: managerA.id } });
            expect(managerStaffA.isActive).toBe(true);
        });

        test('When laboratory is paused, new work assignments are blocked with 400 LAB_PAUSED', async () => {
            const res = await request(app)
                .post('/api/work/assign')
                .set('Authorization', `Bearer ${tokenSA}`)
                .send({
                    workItemIds: [workItemA1.id],
                    assignee: techA.username
                });

            expect(res.status).toBe(400);
            expect(res.body.code).toBe('LAB_PAUSED');
        });

        test('Attempting to retire a lab with open work items is blocked with 422 UNRESOLVED_WORK_ITEMS', async () => {
            const res = await request(app)
                .post(`/api/labs/${labA.id}/lifecycle`)
                .set('Authorization', `Bearer ${tokenSA}`)
                .send({
                    targetState: 'RETIRED',
                    reason: 'Permanent decommissioning'
                });

            expect(res.status).toBe(422);
            expect(res.body.code).toBe('UNRESOLVED_WORK_ITEMS');
        });

        test('Super Admin resumes laboratory: sets operationalStatus=ACTIVE, lab.isActive=true', async () => {
            const res = await request(app)
                .post(`/api/labs/${labA.id}/lifecycle`)
                .set('Authorization', `Bearer ${tokenSA}`)
                .send({
                    targetState: 'ACTIVE',
                    reason: 'Audit complete, facility resumed'
                });

            expect(res.status).toBe(200);
            expect(res.body.operationalStatus).toBe('ACTIVE');
            expect(res.body.isActive).toBe(true);
        });
    });

    describe('5. Project-to-Lab Relationships (GET/PATCH /api/projects/:id/lab-access)', () => {
        test('Project owner manager reads project lab access', async () => {
            const res = await request(app)
                .get(`/api/projects/${projectOwnedA.id}/lab-access`)
                .set('Authorization', `Bearer ${tokenMgrA}`);

            expect(res.status).toBe(200);
            expect(res.body.projectId).toBe(projectOwnedA.id);
            expect(res.body.ownerLabId).toBe(labA.id);
            expect(res.body.servicingLabIds).toContain(labA.id);
            expect(res.body.canManage).toBe(true);
        });

        test('Owner Lab Manager adds Lab B as a servicing laboratory', async () => {
            const res = await request(app)
                .patch(`/api/projects/${projectOwnedA.id}/lab-access`)
                .set('Authorization', `Bearer ${tokenMgrA}`)
                .send({
                    servicingLabIds: [labA.id, labB.id],
                    reason: 'Add Lab B for overflow analytical throughput'
                });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('APPLIED');
            expect(res.body.servicingLabIds).toContain(labB.id);

            // Verify ProjectLab junction was created
            const junctions = await prisma.projectLab.findMany({
                where: { projectCode: projectOwnedA.code }
            });
            const jLabIds = junctions.map(j => j.labId);
            expect(jLabIds).toContain(labB.id);
        });

        test('Non-owner manager cannot modify project servicing labs (403 Forbidden)', async () => {
            const res = await request(app)
                .patch(`/api/projects/${projectOwnedA.id}/lab-access`)
                .set('Authorization', `Bearer ${tokenMgrB}`)
                .send({
                    servicingLabIds: [labB.id],
                    reason: 'Hostile takeover attempt'
                });

            expect(res.status).toBe(403);
            expect(res.body.code).toBe('PROJECT_OWNER_REQUIRED');
        });
    });
});
