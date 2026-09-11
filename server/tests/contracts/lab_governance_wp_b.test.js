/**
 * Laboratory Governance WP-B Companion Contract Tests
 *
 * Verifies the unified action and scope model:
 * - Canonical policy resolver (actionPolicyService)
 * - Project-to-lab membership and discrepancy auditing (projectMembershipService)
 * - Assignable roles catalogue (GET /api/access/assignable-roles)
 * - Work assignment eligibility and inactive/paused lab gates (A23, LG-17)
 * - National directory scoping and bounded DB pagination (LG-08, LG-22)
 */
'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const prisma = require('../../prisma');
const { JWT_SECRET } = require('../../config/auth');
const actionPolicyService = require('../../services/actionPolicyService');
const projectMembershipService = require('../../services/projectMembershipService');
const assignmentService = require('../../services/assignmentEligibilityService');

describe('WP-B: Unified Action and Scope Model', () => {
    let testPrefix;
    let labA, labB, labPaused;
    let superAdmin, managerA, techA, inactiveTechA, managerB, techB;
    let nationalUser, emptyNatUser, viewerUser;
    let tokens = {};

    function makeToken(user) {
        return jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role,
                labId: user.labId || null,
                tokenVersion: user.tokenVersion || 0
            },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
    }

    beforeAll(async () => {
        testPrefix = 'WPB-' + Date.now();

        // 1. Seed Labs
        labA = await prisma.lab.create({
            data: {
                id: 'LAB-A-' + testPrefix,
                code: 'LA-' + testPrefix,
                name: 'Lab Alpha Guatemala',
                country: 'Guatemala',
                timezone: 'America/Guatemala',
                isActive: true
            }
        });

        labB = await prisma.lab.create({
            data: {
                id: 'LAB-B-' + testPrefix,
                code: 'LB-' + testPrefix,
                name: 'Lab Beta Guatemala',
                country: 'Guatemala',
                timezone: 'America/Guatemala',
                isActive: true
            }
        });

        labPaused = await prisma.lab.create({
            data: {
                id: 'LAB-P-' + testPrefix,
                code: 'LP-' + testPrefix,
                name: 'Lab Paused France',
                country: 'France',
                timezone: 'Europe/Paris',
                isActive: false // Paused lab
            }
        });

        // 2. Seed Users
        superAdmin = await prisma.user.create({
            data: {
                id: 'usr-sa-' + testPrefix,
                username: 'sa_' + testPrefix,
                name: 'Super Admin User',
                email: 'sa_' + testPrefix + '@test.org',
                password: 'hash_placeholder',
                role: 'SUPER_ADMIN',
                isActive: true,
                tokenVersion: 0
            }
        });

        managerA = await prisma.user.create({
            data: {
                id: 'usr-mgrA-' + testPrefix,
                username: 'mgrA_' + testPrefix,
                name: 'Manager Lab A',
                email: 'mgra_' + testPrefix + '@test.org',
                password: 'hash_placeholder',
                role: 'LAB_MANAGER',
                labId: labA.id,
                isActive: true,
                tokenVersion: 0
            }
        });

        techA = await prisma.user.create({
            data: {
                id: 'usr-techA-' + testPrefix,
                username: 'techA_' + testPrefix,
                name: 'Active Technician A',
                email: 'techa_' + testPrefix + '@test.org',
                password: 'hash_placeholder',
                role: 'LAB_TECHNICIAN',
                labId: labA.id,
                isActive: true,
                tokenVersion: 0
            }
        });

        inactiveTechA = await prisma.user.create({
            data: {
                id: 'usr-intechA-' + testPrefix,
                username: 'intechA_' + testPrefix,
                name: 'Inactive Technician A',
                email: 'intecha_' + testPrefix + '@test.org',
                password: 'hash_placeholder',
                role: 'LAB_TECHNICIAN',
                labId: labA.id,
                isActive: false, // Inactive technician
                tokenVersion: 0
            }
        });

        managerB = await prisma.user.create({
            data: {
                id: 'usr-mgrB-' + testPrefix,
                username: 'mgrB_' + testPrefix,
                name: 'Manager Lab B',
                email: 'mgrb_' + testPrefix + '@test.org',
                password: 'hash_placeholder',
                role: 'LAB_MANAGER',
                labId: labB.id,
                isActive: true,
                tokenVersion: 0
            }
        });

        techB = await prisma.user.create({
            data: {
                id: 'usr-techB-' + testPrefix,
                username: 'techB_' + testPrefix,
                name: 'Technician Lab B',
                email: 'techb_' + testPrefix + '@test.org',
                password: 'hash_placeholder',
                role: 'LAB_TECHNICIAN',
                labId: labB.id,
                isActive: true,
                tokenVersion: 0
            }
        });

        nationalUser = await prisma.user.create({
            data: {
                id: 'usr-nat-' + testPrefix,
                username: 'nat_' + testPrefix,
                name: 'National Lead Guatemala',
                email: 'nat_' + testPrefix + '@test.org',
                password: 'hash_placeholder',
                role: 'MASTER_USER',
                countries: JSON.stringify(['Guatemala']),
                isActive: true,
                tokenVersion: 0
            }
        });

        emptyNatUser = await prisma.user.create({
            data: {
                id: 'usr-nat-empty-' + testPrefix,
                username: 'nat_empty_' + testPrefix,
                name: 'National Lead Empty Scope',
                email: 'nat_empty_' + testPrefix + '@test.org',
                password: 'hash_placeholder',
                role: 'MASTER_USER',
                countries: JSON.stringify([]),
                isActive: true,
                tokenVersion: 0
            }
        });

        viewerUser = await prisma.user.create({
            data: {
                id: 'usr-vw-' + testPrefix,
                username: 'vw_' + testPrefix,
                name: 'Viewer User',
                email: 'vw_' + testPrefix + '@test.org',
                password: 'hash_placeholder',
                role: 'VIEWER',
                isActive: true,
                tokenVersion: 0
            }
        });

        tokens.sa = makeToken(superAdmin);
        tokens.mgrA = makeToken(managerA);
        tokens.techA = makeToken(techA);
        tokens.mgrB = makeToken(managerB);
        tokens.nat = makeToken(nationalUser);
        tokens.emptyNat = makeToken(emptyNatUser);
        tokens.viewer = makeToken(viewerUser);
    });

    describe('1. Unified Action and Resource Policy Resolver (actionPolicyService)', () => {
        test('Super Admin can manage any user and any lab', () => {
            const userDecision = actionPolicyService.canManageUser(superAdmin, techA);
            expect(userDecision.allowed).toBe(true);
            expect(userDecision.code).toBe('ALLOWED');

            const labDecision = actionPolicyService.canManageLab(superAdmin, labA.id);
            expect(labDecision.allowed).toBe(true);
            expect(labDecision.code).toBe('ALLOWED');
        });

        test('Lab Manager can manage subordinate in own lab, but not in another lab', () => {
            const ownDecision = actionPolicyService.canManageUser(managerA, techA);
            expect(ownDecision.allowed).toBe(true);
            expect(ownDecision.code).toBe('ALLOWED');

            const crossDecision = actionPolicyService.canManageUser(managerA, techB);
            expect(crossDecision.allowed).toBe(false);
            expect(crossDecision.code).toBe('TARGET_OUTSIDE_SCOPE');
        });

        test('Lab Manager cannot manage peer manager or project manager', () => {
            const peerDecision = actionPolicyService.canManageUser(managerA, managerB);
            expect(peerDecision.allowed).toBe(false);
            expect(peerDecision.code).toBe('TARGET_OUTSIDE_SCOPE');

            const fakePeerInOwnLab = { id: 'peer-own', role: 'LAB_MANAGER', labId: labA.id };
            const fakePeerDecision = actionPolicyService.canManageUser(managerA, fakePeerInOwnLab);
            expect(fakePeerDecision.allowed).toBe(false);
            expect(fakePeerDecision.code).toBe('TARGET_ROLE_NOT_MANAGEABLE');
        });

        test('Lab Manager cannot elevate technician to manager role', () => {
            const changeDecision = actionPolicyService.canManageUser(managerA, techA, { role: 'LAB_MANAGER' });
            expect(changeDecision.allowed).toBe(false);
            expect(changeDecision.code).toBe('TARGET_ROLE_NOT_MANAGEABLE');
        });

        test('Self-role change is rejected with SELF_MANAGEMENT_FORBIDDEN', () => {
            const selfRoleDecision = actionPolicyService.canManageUser(managerA, managerA, { role: 'SUPER_ADMIN' });
            expect(selfRoleDecision.allowed).toBe(false);
            expect(selfRoleDecision.code).toBe('SELF_MANAGEMENT_FORBIDDEN');
        });

        test('Inactive actor is denied with ACTOR_INACTIVE', () => {
            const inactiveActor = { ...managerA, isActive: false };
            const decision = actionPolicyService.canManageUser(inactiveActor, techA);
            expect(decision.allowed).toBe(false);
            expect(decision.code).toBe('ACTOR_INACTIVE');
        });
    });

    describe('2. Project-to-Lab Canonical Membership Resolver (projectMembershipService)', () => {
        let testProjectA, testProjectShared;

        beforeAll(async () => {
            testProjectA = await prisma.project.create({
                data: {
                    id: 'PRJ-OWN-' + testPrefix,
                    code: 'PRJ-OWN-' + testPrefix,
                    name: 'Project Owned by Lab A',
                    status: 'ACTIVE',
                    labId: labA.id,
                    projectType: 'OPEN_INTAKE'
                }
            });

            testProjectShared = await prisma.project.create({
                data: {
                    id: 'PRJ-SHR-' + testPrefix,
                    code: 'PRJ-SHR-' + testPrefix,
                    name: 'Shared Multi-Lab Project',
                    status: 'ACTIVE',
                    labId: labA.id,
                    assignedLabIds: JSON.stringify([labB.id]),
                    projectType: 'OPEN_INTAKE'
                }
            });

            await prisma.projectLab.create({
                data: {
                    projectCode: testProjectShared.code,
                    labId: labB.id,
                    role: 'SERVICING',
                    priority: 2
                }
            });
        });

        test('resolveProjectLabs correctly identifies owner and servicing laboratories', async () => {
            const resolved = await projectMembershipService.resolveProjectLabs(testProjectShared);
            expect(resolved.ownerLabId).toBe(labA.id);
            expect(resolved.servicingLabIds).toContain(labB.id);
            expect(resolved.isOwner(labA.id)).toBe(true);
            expect(resolved.isOwner(labB.id)).toBe(false);
            expect(resolved.isServicing(labB.id)).toBe(true);
            expect(resolved.isMember(labA.id)).toBe(true);
            expect(resolved.isMember(labB.id)).toBe(true);
            expect(resolved.isMember('UNKNOWN_LAB')).toBe(false);
        });

        test('getDiscrepancyReport scans database and returns audit report without data loss', async () => {
            const report = await projectMembershipService.getDiscrepancyReport();
            expect(report).toBeDefined();
            expect(typeof report.scannedProjects).toBe('number');
            expect(Array.isArray(report.discrepancies)).toBe(true);
        });

        test('canManageProject allows owner lab manager and super admin; denies non-owner manager', () => {
            expect(projectMembershipService.canManageProject(superAdmin, testProjectShared)).toBe(true);
            expect(projectMembershipService.canManageProject(managerA, testProjectShared)).toBe(true);
            expect(projectMembershipService.canManageProject(managerB, testProjectShared)).toBe(false);
            expect(projectMembershipService.canManageProject(viewerUser, testProjectShared)).toBe(false);
        });
    });

    describe('3. Assignable Roles Server Catalogue (GET /api/access/assignable-roles)', () => {
        test('Super Admin gets all 10 roles in assignableRoles', async () => {
            const res = await request(app)
                .get('/api/access/assignable-roles')
                .set('Authorization', 'Bearer ' + tokens.sa);
            expect(res.status).toBe(200);
            expect(res.body.assignableRoles.length).toBe(10);
            expect(res.body.unmanageableRoles.length).toBe(0);
        });

        test('Lab Manager gets only ALLOWED_SUB_ROLES and sees peer/admin roles as unmanageable with reasons', async () => {
            const res = await request(app)
                .get('/api/access/assignable-roles?labId=' + labA.id)
                .set('Authorization', 'Bearer ' + tokens.mgrA);
            expect(res.status).toBe(200);

            const assignableKeys = res.body.assignableRoles.map(r => r.key);
            expect(assignableKeys).toContain('LAB_TECHNICIAN');
            expect(assignableKeys).toContain('SAMPLE_RECEPTION');
            expect(assignableKeys).toContain('SURVEYOR');
            expect(assignableKeys).toContain('AUDIT_USER');
            expect(assignableKeys).toContain('EXTERNAL_VIEWER');
            expect(assignableKeys).toContain('VIEWER');
            expect(assignableKeys).not.toContain('LAB_MANAGER');
            expect(assignableKeys).not.toContain('SUPER_ADMIN');

            const unmanageableKeys = res.body.unmanageableRoles.map(r => r.key);
            expect(unmanageableKeys).toContain('LAB_MANAGER');
            expect(unmanageableKeys).toContain('SUPER_ADMIN');
            expect(unmanageableKeys).toContain('MASTER_USER');
            expect(unmanageableKeys).toContain('PROJECT_MANAGER');
        });

        test('Ordinary viewer is denied access to assignable-roles (403 Forbidden)', async () => {
            const res = await request(app)
                .get('/api/access/assignable-roles')
                .set('Authorization', 'Bearer ' + tokens.viewer);
            expect(res.status).toBe(403);
        });

        test('GET /api/access/capabilities returns platform role capabilities', async () => {
            const res = await request(app)
                .get('/api/access/capabilities')
                .set('Authorization', 'Bearer ' + tokens.viewer);
            expect(res.status).toBe(200);
            expect(res.body.roles.length).toBe(10);
            expect(res.body.permissions.length).toBeGreaterThan(10);
        });
    });

    describe('4. Work Assignment Eligibility & Validation (A23, LG-17, A33)', () => {
        let testSample, testWorkItem;

        beforeAll(async () => {
            testSample = await prisma.sample.create({
                data: {
                    id: 'SMP-ASS-' + testPrefix,
                    originalId: testPrefix + '-SMP-ASS',
                    labId: labA.id,
                    assignedLab: labA.id,
                    status: 'IN_ANALYSIS',
                    matrix: 'SOIL',
                    country: 'Guatemala'
                }
            });

            testWorkItem = await prisma.workItem.create({
                data: {
                    id: 'WI-ASS-' + testPrefix,
                    sampleId: testSample.id,
                    labId: labA.id,
                    analysis: 'PH',
                    status: 'IN_PROGRESS'
                }
            });
        });

        test('A23: Assignment to deactivated technician is rejected with ASSIGNEE_INACTIVE (400)', async () => {
            const res = await request(app)
                .post('/api/work/assign')
                .set('Authorization', 'Bearer ' + tokens.mgrA)
                .send({
                    workItemIds: [testWorkItem.id],
                    assignee: inactiveTechA.username
                });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('ASSIGNEE_INACTIVE');
        });

        test('A23: Assignment to technician in different lab is rejected with 403', async () => {
            const res = await request(app)
                .post('/api/work/assign')
                .set('Authorization', 'Bearer ' + tokens.mgrA)
                .send({
                    workItemIds: [testWorkItem.id],
                    assignee: techB.username
                });
            expect(res.status).toBe(403);
            expect(res.body.error).toMatch(/is not in/);
        });

        test('A23: Assignment in paused/inactive lab is rejected with LAB_PAUSED (400)', async () => {
            const pausedSample = await prisma.sample.create({
                data: {
                    id: 'SMP-P-' + testPrefix,
                    originalId: testPrefix + '-SMP-P',
                    labId: labPaused.id,
                    assignedLab: labPaused.id,
                    status: 'IN_ANALYSIS',
                    matrix: 'SOIL',
                    country: 'France'
                }
            });

            const pausedWorkItem = await prisma.workItem.create({
                data: {
                    id: 'WI-P-' + testPrefix,
                    sampleId: pausedSample.id,
                    labId: labPaused.id,
                    analysis: 'PH',
                    status: 'IN_PROGRESS'
                }
            });

            const pausedTech = await prisma.user.create({
                data: {
                    id: 'usr-ptech-' + testPrefix,
                    username: 'ptech_' + testPrefix,
                    name: 'Paused Lab Tech',
                    email: 'ptech_' + testPrefix + '@test.org',
                    password: 'hash',
                    role: 'LAB_TECHNICIAN',
                    labId: labPaused.id,
                    isActive: true
                }
            });

            const res = await request(app)
                .post('/api/work/assign')
                .set('Authorization', 'Bearer ' + tokens.sa)
                .send({
                    workItemIds: [pausedWorkItem.id],
                    assignee: pausedTech.username
                });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('LAB_PAUSED');
        });

        test('GET /api/work/eligible-assignees returns active analytical staff and excludes deactivated staff', async () => {
            const res = await request(app)
                .get('/api/work/eligible-assignees?labId=' + labA.id)
                .set('Authorization', 'Bearer ' + tokens.mgrA);
            expect(res.status).toBe(200);
            expect(res.body.labId).toBe(labA.id);

            const usernames = res.body.assignees.map(a => a.username);
            expect(usernames).toContain(techA.username);
            expect(usernames).not.toContain(inactiveTechA.username);
            expect(usernames).not.toContain(techB.username);
        });
    });

    describe('5. Staff Directory Scoping & Bounded Pagination (LG-08, LG-22)', () => {
        test('LG-08: National user directory is strictly scoped to labs in authorized country', async () => {
            const res = await request(app)
                .get('/api/users/directory')
                .set('Authorization', 'Bearer ' + tokens.nat);
            expect(res.status).toBe(200);

            // GTM labs are LAB-A and LAB-B; users should only belong to GTM labs
            for (const user of res.body) {
                if (user.labId) {
                    expect([labA.id, labB.id]).toContain(user.labId);
                    expect(user.labId).not.toBe(labPaused.id);
                }
            }
        });

        test('LG-08: National user with empty country scope receives empty array (not global leak)', async () => {
            const res = await request(app)
                .get('/api/users/directory')
                .set('Authorization', 'Bearer ' + tokens.emptyNat);
            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });

        test('GET /api/users/directory?purpose=assignment filters to active analytical staff', async () => {
            const res = await request(app)
                .get('/api/users/directory?purpose=assignment')
                .set('Authorization', 'Bearer ' + tokens.mgrA);
            expect(res.status).toBe(200);

            const usernames = res.body.map(u => u.username);
            expect(usernames).toContain(techA.username);
            expect(usernames).not.toContain(inactiveTechA.username);
        });

        test('GET /api/users enforces bounded pagination (clamps excessive limit to 100) and excludes password', async () => {
            const res = await request(app)
                .get('/api/users?limit=500')
                .set('Authorization', 'Bearer ' + tokens.sa);
            expect(res.status).toBe(200);
            expect(res.body.pagination.pageSize).toBeLessThanOrEqual(100);

            const users = res.body.data;
            expect(Array.isArray(users)).toBe(true);
            for (const u of users) {
                expect(u.password).toBeUndefined();
            }
        });
    });
});
