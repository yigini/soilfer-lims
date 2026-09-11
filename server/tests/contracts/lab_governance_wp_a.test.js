/**
 * Laboratory Governance WP-A Companion Contract Tests
 *
 * Verifies security repairs, role hierarchies, scope boundaries,
 * recovery/session protection, and domain invariants for WP-A.
 * Corresponds to acceptance scenarios A01, A02, A03, A07, A09, A13, A14,
 * A16, A17, A18, A19, A24, A27, A28, A29, A30, A32, A33, A37, A41.
 */
'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const prisma = require('../../prisma');
const { JWT_SECRET } = require('../../config/auth');
const scopeGuard = require('../../utils/scopeGuard');
const { getLocalDayInterval, resolveActorScope } = require('../../services/dashboardScope');
const syncService = require('../../services/syncService');
const workPackService = require('../../services/workPackService');

describe('WP-A: Laboratory Governance Security & Access Repairs', () => {
    let testPrefix;
    let labA, labB, labC;
    let superAdmin1, managerA, managerPeerA, techA, managerB, techB, techC;
    let nationalUser, projectMgr, viewerUser;
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
        testPrefix = 'WPA-' + Date.now();

        // 1. Seed Labs
        labA = await prisma.lab.create({
            data: {
                id: 'LAB-A-' + testPrefix,
                code: 'LA-' + testPrefix,
                name: 'Lab Alpha Guatemala',
                country: 'Guatemala',
                timezone: 'America/Guatemala',
                isActive: true,
                notes: 'CONFIDENTIAL_NOTE_LAB_A'
            }
        });

        labB = await prisma.lab.create({
            data: {
                id: 'LAB-B-' + testPrefix,
                code: 'LB-' + testPrefix,
                name: 'Lab Beta Guatemala',
                country: 'Guatemala',
                timezone: 'America/Guatemala',
                isActive: true,
                notes: 'CONFIDENTIAL_NOTE_LAB_B'
            }
        });

        labC = await prisma.lab.create({
            data: {
                id: 'LAB-C-' + testPrefix,
                code: 'LC-' + testPrefix,
                name: 'Lab Gamma France',
                country: 'France',
                timezone: 'Europe/Paris',
                isActive: false, // Inactive / paused lab
                notes: 'CONFIDENTIAL_NOTE_LAB_C'
            }
        });

        // 2. Seed Users
        superAdmin1 = await prisma.user.create({
            data: {
                id: 'usr-sa1-' + testPrefix,
                username: 'sa1_' + testPrefix,
                name: 'Super Admin One',
                email: 'sa1_' + testPrefix + '@test.org',
                password: 'hashed_password_placeholder',
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
                email: 'mgrA_' + testPrefix + '@test.org',
                password: 'hashed_password_placeholder',
                role: 'LAB_MANAGER',
                labId: labA.id,
                countries: JSON.stringify(['Guatemala']),
                isActive: true,
                tokenVersion: 0
            }
        });

        managerPeerA = await prisma.user.create({
            data: {
                id: 'usr-mgrPeerA-' + testPrefix,
                username: 'mgrPeerA_' + testPrefix,
                name: 'Peer Manager Lab A',
                email: 'mgrPeerA_' + testPrefix + '@test.org',
                password: 'hashed_password_placeholder',
                role: 'LAB_MANAGER',
                labId: labA.id,
                countries: JSON.stringify(['Guatemala']),
                isActive: true,
                tokenVersion: 0
            }
        });

        techA = await prisma.user.create({
            data: {
                id: 'usr-techA-' + testPrefix,
                username: 'techA_' + testPrefix,
                name: 'Technician Lab A',
                email: 'techA_' + testPrefix + '@test.org',
                password: 'hashed_password_placeholder',
                role: 'LAB_TECHNICIAN',
                labId: labA.id,
                countries: JSON.stringify(['Guatemala']),
                isActive: true,
                tokenVersion: 0
            }
        });

        managerB = await prisma.user.create({
            data: {
                id: 'usr-mgrB-' + testPrefix,
                username: 'mgrB_' + testPrefix,
                name: 'Manager Lab B',
                email: 'mgrB_' + testPrefix + '@test.org',
                password: 'hashed_password_placeholder',
                role: 'LAB_MANAGER',
                labId: labB.id,
                countries: JSON.stringify(['Guatemala']),
                isActive: true,
                tokenVersion: 0
            }
        });

        techB = await prisma.user.create({
            data: {
                id: 'usr-techB-' + testPrefix,
                username: 'techB_' + testPrefix,
                name: 'Technician Lab B',
                email: 'techB_' + testPrefix + '@test.org',
                password: 'hashed_password_placeholder',
                role: 'LAB_TECHNICIAN',
                labId: labB.id,
                countries: JSON.stringify(['Guatemala']),
                isActive: true,
                tokenVersion: 0
            }
        });

        techC = await prisma.user.create({
            data: {
                id: 'usr-techC-' + testPrefix,
                username: 'techC_' + testPrefix,
                name: 'Technician Lab C (Inactive Lab)',
                email: 'techC_' + testPrefix + '@test.org',
                password: 'hashed_password_placeholder',
                role: 'LAB_TECHNICIAN',
                labId: labC.id,
                countries: JSON.stringify(['France']),
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
                password: 'hashed_password_placeholder',
                role: 'MASTER_USER',
                countries: JSON.stringify(['Guatemala']),
                isActive: true,
                tokenVersion: 0
            }
        });

        projectMgr = await prisma.user.create({
            data: {
                id: 'usr-pm-' + testPrefix,
                username: 'pm_' + testPrefix,
                name: 'Project Manager',
                email: 'pm_' + testPrefix + '@test.org',
                password: 'hashed_password_placeholder',
                role: 'PROJECT_MANAGER',
                labId: labA.id,
                projects: JSON.stringify(['PRJ-' + testPrefix]),
                isActive: true,
                tokenVersion: 0
            }
        });

        viewerUser = await prisma.user.create({
            data: {
                id: 'usr-view-' + testPrefix,
                username: 'view_' + testPrefix,
                name: 'Viewer',
                email: 'view_' + testPrefix + '@test.org',
                password: 'hashed_password_placeholder',
                role: 'VIEWER',
                labId: labA.id,
                isActive: true,
                tokenVersion: 0
            }
        });

        // 3. Mint tokens
        tokens.sa1 = makeToken(superAdmin1);
        tokens.mgrA = makeToken(managerA);
        tokens.mgrPeerA = makeToken(managerPeerA);
        tokens.techA = makeToken(techA);
        tokens.mgrB = makeToken(managerB);
        tokens.techB = makeToken(techB);
        tokens.techC = makeToken(techC);
        tokens.national = makeToken(nationalUser);
        tokens.pm = makeToken(projectMgr);
        tokens.viewer = makeToken(viewerUser);
    });

    afterAll(async () => {
        // Clean up created entities
        await prisma.workItemDraft.deleteMany({
            where: { workItem: { sample: { originalId: { startsWith: testPrefix } } } }
        }).catch(() => {});
        await prisma.workItem.deleteMany({
            where: { sample: { originalId: { startsWith: testPrefix } } }
        }).catch(() => {});
        await prisma.sample.deleteMany({
            where: { originalId: { startsWith: testPrefix } }
        }).catch(() => {});
        await prisma.equipmentAsset.deleteMany({
            where: { id: { contains: testPrefix } }
        }).catch(() => {});
        await prisma.koboConfig.deleteMany({
            where: { labId: labA.id }
        }).catch(() => {});
        await prisma.project.deleteMany({
            where: { code: { contains: testPrefix } }
        }).catch(() => {});
        await prisma.user.deleteMany({
            where: { id: { contains: testPrefix } }
        }).catch(() => {});
        await prisma.lab.deleteMany({
            where: { id: { contains: testPrefix } }
        }).catch(() => {});
    });

    describe('1. Cross-Lab Staff Actions & Role Hierarchy (A01, A02, A03, LG-01, LG-03)', () => {
        test('A01: Manager A cannot reset password of staff in Lab B (403 Forbidden)', async () => {
            const res = await request(app)
                .patch('/api/labs/' + labB.id + '/staff/' + techB.id + '/reset-password')
                .set('Authorization', 'Bearer ' + tokens.mgrA);
            expect([403, 404]).toContain(res.status);
        });

        test('A01: Manager A cannot toggle staff active state in Lab B (403 Forbidden)', async () => {
            const res = await request(app)
                .patch('/api/labs/' + labB.id + '/staff/' + techB.id + '/toggle')
                .set('Authorization', 'Bearer ' + tokens.mgrA)
                .send({ isActive: false });
            expect([403, 404]).toContain(res.status);
        });

        test('A02: Manager A cannot reset password of another manager in Lab A (403 Forbidden)', async () => {
            const res = await request(app)
                .patch('/api/labs/' + labA.id + '/staff/' + managerPeerA.id + '/reset-password')
                .set('Authorization', 'Bearer ' + tokens.mgrA);
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('TARGET_ROLE_NOT_MANAGEABLE');
        });

        test('A03: Manager A CAN reset password of subordinate technician in Lab A; increments tokenVersion and returns random password', async () => {
            const preUser = await prisma.user.findUnique({ where: { id: techA.id } });
            const initialVersion = preUser.tokenVersion || 0;

            const res = await request(app)
                .patch('/api/labs/' + labA.id + '/staff/' + techA.id + '/reset-password')
                .set('Authorization', 'Bearer ' + tokens.mgrA);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            const pwd = res.body.temporaryPassword || res.body.tempPassword;
            expect(pwd).toBeDefined();
            expect(pwd).not.toBe('password');
            expect(pwd.startsWith('SL-')).toBe(true);

            const postUser = await prisma.user.findUnique({ where: { id: techA.id } });
            expect(postUser.tokenVersion).toBe(initialVersion + 1);
            expect(postUser.mustChangePassword).toBe(true);
        });

        test('A03: Viewer user cannot reset staff password (403 Forbidden)', async () => {
            const res = await request(app)
                .patch('/api/labs/' + labA.id + '/staff/' + techA.id + '/reset-password')
                .set('Authorization', 'Bearer ' + tokens.viewer);
            expect(res.status).toBe(403);
        });
    });

    describe('2. Lab Update Allowlist & Lifecycle Mutation Protection (A07, LG-02, LG-04, LG-05, A33)', () => {
        test('A07: Lab PUT rejects attempts to inject immutable fields (id, isActive, createdAt)', async () => {
            const res = await request(app)
                .put('/api/labs/' + labA.id)
                .set('Authorization', 'Bearer ' + tokens.mgrA)
                .send({
                    id: 'OVERWRITTEN_ID',
                    isActive: false,
                    createdAt: '1970-01-01T00:00:00Z',
                    name: 'Legit Lab Name Update'
                });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('IMMUTABLE_FIELDS_REJECTED');
        });

        test('A07: Lab PUT succeeds with allowlisted fields and does not alter immutable ID', async () => {
            const res = await request(app)
                .put('/api/labs/' + labA.id)
                .set('Authorization', 'Bearer ' + tokens.mgrA)
                .send({
                    name: 'Updated Lab Alpha Name',
                    address: '123 Test Boulevard',
                    capacity: 100
                });
            expect(res.status).toBe(200);
            expect(res.body.id).toBe(labA.id);
            expect(res.body.name).toBe('Updated Lab Alpha Name');
            expect(res.body.address).toBe('123 Test Boulevard');
        });

        test('A01: Manager A cannot update Lab B via PUT (403 Forbidden)', async () => {
            const res = await request(app)
                .put('/api/labs/' + labB.id)
                .set('Authorization', 'Bearer ' + tokens.mgrA)
                .send({ name: 'Hostile Takeover' });
            expect(res.status).toBe(403);
        });

        test('LG-04: Non-admin cannot create a laboratory via POST /api/labs (403 Forbidden)', async () => {
            const res = await request(app)
                .post('/api/labs')
                .set('Authorization', 'Bearer ' + tokens.mgrA)
                .send({
                    id: 'LAB-NEW-' + testPrefix,
                    code: 'LNEW-' + testPrefix,
                    name: 'Unauthorized Lab',
                    country: 'Guatemala'
                });
            expect(res.status).toBe(403);
        });

        test('A33: Inactive lab technician can access /api/auth/me for read/history access with labIsActive=false (IR-10)', async () => {
            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer ' + tokens.techC);
            expect(res.status).toBe(200);
            expect(res.body.labIsActive).toBe(false);
        });
    });

    describe('3. User Administration, Last-Admin Protection & Validation (A08, A09, A10, LG-06, LG-07, LG-08)', () => {
        test('A09: Administrator self-deletion is prevented (SELF_DELETION_FORBIDDEN)', async () => {
            const res = await request(app)
                .delete('/api/users/' + superAdmin1.id)
                .set('Authorization', 'Bearer ' + tokens.sa1);
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('SELF_DELETION_FORBIDDEN');
        });

        test('LG-07: User creation rejects foreign labId for manager (403 Forbidden)', async () => {
            const res = await request(app)
                .post('/api/users')
                .set('Authorization', 'Bearer ' + tokens.mgrA)
                .send({
                    username: 'fakeuser_' + testPrefix,
                    password: 'SecurePassword123!',
                    name: 'Fake User',
                    role: 'LAB_TECHNICIAN',
                    labId: 'NONEXISTENT_LAB_XYZ'
                });
            expect([400, 403]).toContain(res.status);
        });

        test('LG-07: User update rejects empty string role', async () => {
            const res = await request(app)
                .put('/api/users/' + techA.id)
                .set('Authorization', 'Bearer ' + tokens.sa1)
                .send({ role: '' });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('VALIDATION_ERROR');
        });

        test('LG-08: National user getUsers returns only staff in national country labs', async () => {
            const res = await request(app)
                .get('/api/users')
                .set('Authorization', 'Bearer ' + tokens.national);
            expect(res.status).toBe(200);
            const users = res.body.data || res.body.users || [];
            expect(Array.isArray(users)).toBe(true);
            const containsFranceTech = users.some(u => u.id === techC.id);
            expect(containsFranceTech).toBe(false);
        });

        test('LG-08: National user with empty country scope receives empty array (not global leak)', async () => {
            const emptyNat = await prisma.user.create({
                data: {
                    id: 'usr-nat-empty-' + testPrefix,
                    username: 'nat_empty_' + testPrefix,
                    name: 'Empty National Lead',
                    email: 'nat_empty_' + testPrefix + '@test.org',
                    password: 'hashed_password_placeholder',
                    role: 'MASTER_USER',
                    countries: JSON.stringify([]),
                    isActive: true
                }
            });
            const emptyNatToken = makeToken(emptyNat);

            const res = await request(app)
                .get('/api/users')
                .set('Authorization', 'Bearer ' + emptyNatToken);
            expect(res.status).toBe(200);
            const users = res.body.data || res.body.users || [];
            expect(users).toEqual([]);
        });
    });

    describe('4. Project Scoping & Kobo Credential Redaction (A24, A27, LG-11, LG-13, LG-27)', () => {
        let testProject;

        beforeAll(async () => {
            testProject = await prisma.project.create({
                data: {
                    id: 'PRJ-' + testPrefix,
                    code: 'PRJ-' + testPrefix,
                    name: 'Governance Test Project',
                    status: 'ACTIVE',
                    labId: labA.id,
                    projectType: 'KOBO_LINKED'
                }
            });

            await prisma.koboConfig.create({
                data: {
                    id: 'kobo-' + testPrefix,
                    projectCode: testProject.code,
                    labId: labA.id,
                    apiToken: 'SECRET_KOBO_API_TOKEN_XYZ',
                    formId: 'form_123'
                }
            });
        });

        test('A27: Kobo configuration endpoint redacts API token (LG-13)', async () => {
            const res = await request(app)
                .get('/api/projects/' + testProject.code + '/kobo/config')
                .set('Authorization', 'Bearer ' + tokens.mgrA);
            expect(res.status).toBe(200);
            expect(res.body.koboApiToken).toBeUndefined();
            expect(JSON.stringify(res.body)).not.toContain('SECRET_KOBO_API_TOKEN_XYZ');
            expect(res.body.configured).toBe(true);
        });

        test('A24: Manager of another lab cannot delete project (LG-11)', async () => {
            const res = await request(app)
                .delete('/api/projects/' + testProject.code)
                .set('Authorization', 'Bearer ' + tokens.mgrB);
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('PROJECT_DELETE_FORBIDDEN');
        });
    });

    describe('5. Equipment Scoping & Management Isolation (A30, LG-18)', () => {
        let equipB;

        beforeAll(async () => {
            equipB = await prisma.equipmentAsset.create({
                data: {
                    id: 'EQUIP-B-' + testPrefix,
                    labId: labB.id,
                    name: 'Spectrophotometer B',
                    assetType: 'SPECTROMETER',
                    criticality: 'IMPORTANT',
                    status: 'IN_SERVICE'
                }
            });
        });

        test('A30: Manager A cannot change equipment status in Lab B (403 Forbidden)', async () => {
            const res = await request(app)
                .patch('/api/equipment/' + equipB.id + '/status')
                .set('Authorization', 'Bearer ' + tokens.mgrA)
                .send({ status: 'OUT_OF_SERVICE', reason: 'Attempted cross-lab change' });
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('EQUIPMENT_OUTSIDE_SCOPE');
        });
    });

    describe('6. Offline Synchronization & Work Pack Scoping (A16, A17, A18, A19, LG-14, LG-15)', () => {
        let testSampleA, testWorkItemA;

        beforeAll(async () => {
            testSampleA = await prisma.sample.create({
                data: {
                    id: 'SMP-A-' + testPrefix,
                    originalId: testPrefix + '-SMP-01',
                    labId: labA.id,
                    assignedLab: labA.id,
                    status: 'IN_ANALYSIS',
                    matrix: 'SOIL',
                    country: 'Guatemala'
                }
            });

            testWorkItemA = await prisma.workItem.create({
                data: {
                    id: 'WI-A-' + testPrefix,
                    sampleId: testSampleA.id,
                    labId: labA.id,
                    analysis: 'PH',
                    assignedTo: techA.username,
                    status: 'IN_PROGRESS'
                }
            });
        });

        test('A18: Viewer cannot complete work via sync batch (LG-14)', async () => {
            const batch = {
                deviceId: 'dev-' + testPrefix,
                operations: [
                    {
                        operationId: 'op-comp-' + testPrefix,
                        type: 'COMPLETE_WORK',
                        target: { workItemId: testWorkItemA.id },
                        payload: { value: 7.2 }
                    }
                ]
            };
            const result = await syncService.processSyncBatch(viewerUser, batch);
            expect(result.receipts[0].status).toBe('REJECTED');
            expect(result.receipts[0].code).toBe('PERMISSION_DENIED');
        });

        test('A18: Technician B cannot complete Lab A work item via sync batch', async () => {
            const batch = {
                deviceId: 'dev-' + testPrefix,
                operations: [
                    {
                        operationId: 'op-comp-cross-' + testPrefix,
                        type: 'COMPLETE_WORK',
                        target: { workItemId: testWorkItemA.id },
                        payload: { value: 7.2 }
                    }
                ]
            };
            const result = await syncService.processSyncBatch(techB, batch);
            expect(result.receipts[0].status).toBe('REJECTED');
            expect(result.receipts[0].code).toBe('WORK_ITEM_OUTSIDE_LAB_SCOPE');
        });

        test('A19: SAVE_WORK_DRAFT persists to WorkItemDraft table and returns APPLIED', async () => {
            const batch = {
                deviceId: 'dev-' + testPrefix,
                operations: [
                    {
                        operationId: 'op-draft-' + testPrefix,
                        type: 'SAVE_WORK_DRAFT',
                        target: { workItemId: testWorkItemA.id },
                        payload: { draftValue: '6.85', notes: 'Draft pH' }
                    }
                ]
            };
            const result = await syncService.processSyncBatch(techA, batch);
            expect(result.receipts[0].status).toBe('APPLIED');

            const savedDraft = await prisma.workItemDraft.findUnique({
                where: { workItemId: testWorkItemA.id }
            });
            expect(savedDraft).toBeDefined();
            expect(savedDraft.value).toContain('6.85');
        });

        test('A17: Non-admin without labId is denied work pack preparation (LG-15)', async () => {
            const noLabUser = { id: 'no-lab-user', role: 'LAB_TECHNICIAN', labId: null };
            await expect(workPackService.preparePack(noLabUser, 'all')).rejects.toThrow(
                /Laboratory scope is required/
            );
        });
    });

    describe('7. Session Revocation & Impersonation Safety (A13, A14, LG-16, LG-28)', () => {
        test('A13: Stale tokenVersion is rejected by HTTP auth with 401 SESSION_INVALIDATED', async () => {
            const staleToken = jwt.sign(
                { id: techA.id, username: techA.username, role: techA.role, tokenVersion: 0 },
                JWT_SECRET
            );
            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer ' + staleToken);
            expect(res.status).toBe(401);
            expect(res.body.error).toBe('SESSION_INVALIDATED');
        });

        test('A14: Impersonated session is invalidated when actor administrator is deactivated', async () => {
            const impActorAdmin = await prisma.user.create({
                data: {
                    id: 'usr-imp-actor-' + testPrefix,
                    username: 'imp_actor_' + testPrefix,
                    name: 'Imp Actor Admin',
                    email: 'imp_actor_' + testPrefix + '@test.org',
                    password: 'hashed_password_placeholder',
                    role: 'SUPER_ADMIN',
                    isActive: true,
                    tokenVersion: 0
                }
            });

            const impToken = jwt.sign(
                {
                    id: techA.id,
                    username: techA.username,
                    role: techA.role,
                    tokenVersion: 1,
                    act: { id: impActorAdmin.id, username: impActorAdmin.username, tokenVersion: 0 }
                },
                JWT_SECRET
            );

            const resActive = await request(app)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer ' + impToken);
            expect(resActive.status).toBe(200);

            await prisma.user.update({
                where: { id: impActorAdmin.id },
                data: { isActive: false }
            });

            const resDeact = await request(app)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer ' + impToken);
            expect(resDeact.status).toBe(401);
            expect(resDeact.body.error).toBe('ACTOR_DEACTIVATED');
        });
    });

    describe('8. Timezone Intervals & DST Calculation (A37, LG-29)', () => {
        test('A37: Europe/London spring-forward DST (2026-03-29) produces exactly 23 hours', () => {
            const interval = getLocalDayInterval('Europe/London', new Date('2026-03-29T12:00:00Z'));
            expect(interval.dayStart.toISOString()).toBe('2026-03-29T00:00:00.000Z');
            expect(interval.dayEnd.toISOString()).toBe('2026-03-29T23:00:00.000Z');
            const durationHours = (interval.dayEnd.getTime() - interval.dayStart.getTime()) / (1000 * 3600);
            expect(durationHours).toBe(23);
        });

        test('A37: Europe/London fall-back DST (2026-10-25) produces exactly 25 hours', () => {
            const interval = getLocalDayInterval('Europe/London', new Date('2026-10-25T12:00:00Z'));
            expect(interval.dayStart.toISOString()).toBe('2026-10-24T23:00:00.000Z');
            expect(interval.dayEnd.toISOString()).toBe('2026-10-26T00:00:00.000Z');
            const durationHours = (interval.dayEnd.getTime() - interval.dayStart.getTime()) / (1000 * 3600);
            expect(durationHours).toBe(25);
        });

        test('A04: National user cannot switch dashboard scope to an out-of-country lab', async () => {
            const natScope = await resolveActorScope(nationalUser, { selectedLabId: labC.id });
            expect(natScope.activeLabId).not.toBe(labC.id);
        });
    });

    describe('9. Global Locale Management Protection (A32, LG-20)', () => {
        test('A32: Core platform locales (en, es, es-419, fr, pt) cannot be deleted', async () => {
            const res = await request(app)
                .delete('/api/admin/languages/en')
                .set('Authorization', 'Bearer ' + tokens.sa1);
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('CORE_LOCALE_PROTECTED');
        });

        test('A32: Ordinary lab manager cannot delete languages (403 Forbidden)', async () => {
            const res = await request(app)
                .delete('/api/admin/languages/custom_lang')
                .set('Authorization', 'Bearer ' + tokens.mgrA);
            expect(res.status).toBe(403);
        });
    });
});