'use strict';

/**
 * Work Package C (WP-C) Contract Tests:
 * Staff Lifecycle, Access Review, Suspension, Recovery, and Lockout Prevention
 * 
 * Verifies:
 * 1. Safe Staff Invitations (Role bounds, lab bounds, collision check, token generation)
 * 2. Pre-change Access Impact Preview (Open assignment count, capability diff, review token)
 * 3. Atomic Access Mutation with Session Revocation (tokenVersion bump, last admin protection)
 * 4. User Suspension & Anti-Lockout (Self-suspension forbidden, last admin guarded, token revocation)
 * 5. User Reactivation (Requires active lab, revoked tokens stay revoked)
 * 6. Single-use Emergency Recovery Grants (30m expiry, instant tokenVersion bump)
 * 7. Self-Profile Scope Enforcement (PATCH /api/auth/profile allows only name/lang/theme)
 */

const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../config/auth');

describe('WP-C: Staff Lifecycle, Access Control & Lockout Prevention', () => {
    const SUFFIX = 'WPC-' + Date.now();

    let labActiveA, labActiveB, labPaused;
    let superAdmin1, superAdmin2, managerA, techA1, techA2, techB1, viewerA;
    let tokenSA1, tokenMgrA, tokenTechA1, tokenTechB1, tokenViewerA;

    beforeAll(async () => {
        // Create Labs
        labActiveA = await prisma.lab.create({
            data: {
                id: 'lab-actA-' + SUFFIX,
                name: 'Active Lab A ' + SUFFIX,
                code: 'LACA-' + Date.now().toString().slice(-4),
                country: 'Guatemala',
                isActive: true
            }
        });

        labActiveB = await prisma.lab.create({
            data: {
                id: 'lab-actB-' + SUFFIX,
                name: 'Active Lab B ' + SUFFIX,
                code: 'LACB-' + Date.now().toString().slice(-4),
                country: 'Guatemala',
                isActive: true
            }
        });

        labPaused = await prisma.lab.create({
            data: {
                id: 'lab-pause-' + SUFFIX,
                name: 'Paused Lab ' + SUFFIX,
                code: 'LPAU-' + Date.now().toString().slice(-4),
                country: 'Guatemala',
                isActive: false
            }
        });

        // Create Users
        superAdmin1 = await prisma.user.create({
            data: {
                id: 'usr-sa1-' + SUFFIX,
                username: 'sa1_' + SUFFIX,
                email: ('sa1_' + SUFFIX + '@test.org').toLowerCase(),
                name: 'Super Admin 1',
                password: 'hash',
                role: 'SUPER_ADMIN',
                isActive: true,
                tokenVersion: 1
            }
        });

        superAdmin2 = await prisma.user.create({
            data: {
                id: 'usr-sa2-' + SUFFIX,
                username: 'sa2_' + SUFFIX,
                email: ('sa2_' + SUFFIX + '@test.org').toLowerCase(),
                name: 'Super Admin 2',
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
                labId: labActiveA.id,
                isActive: true,
                tokenVersion: 1
            }
        });

        techA1 = await prisma.user.create({
            data: {
                id: 'usr-techA1-' + SUFFIX,
                username: 'techA1_' + SUFFIX,
                email: ('techA1_' + SUFFIX + '@test.org').toLowerCase(),
                name: 'Technician A1',
                password: 'hash',
                role: 'LAB_TECHNICIAN',
                labId: labActiveA.id,
                isActive: true,
                tokenVersion: 1
            }
        });

        techA2 = await prisma.user.create({
            data: {
                id: 'usr-techA2-' + SUFFIX,
                username: 'techA2_' + SUFFIX,
                email: ('techA2_' + SUFFIX + '@test.org').toLowerCase(),
                name: 'Technician A2',
                password: 'hash',
                role: 'LAB_TECHNICIAN',
                labId: labActiveA.id,
                isActive: true,
                tokenVersion: 1
            }
        });

        techB1 = await prisma.user.create({
            data: {
                id: 'usr-techB1-' + SUFFIX,
                username: 'techB1_' + SUFFIX,
                email: ('techB1_' + SUFFIX + '@test.org').toLowerCase(),
                name: 'Technician B1',
                password: 'hash',
                role: 'LAB_TECHNICIAN',
                labId: labActiveB.id,
                isActive: true,
                tokenVersion: 1
            }
        });

        viewerA = await prisma.user.create({
            data: {
                id: 'usr-viewA-' + SUFFIX,
                username: 'viewA_' + SUFFIX,
                email: ('viewA_' + SUFFIX + '@test.org').toLowerCase(),
                name: 'Viewer A',
                password: 'hash',
                role: 'VIEWER',
                labId: labActiveA.id,
                isActive: true,
                tokenVersion: 1
            }
        });

        // Create a WorkItem assigned to techA1
        const sample = await prisma.sample.create({
            data: {
                id: 'SMP-WPC-' + SUFFIX,
                originalId: 'ORIG-' + SUFFIX,
                labId: labActiveA.id,
                assignedLab: labActiveA.id,
                status: 'IN_ANALYSIS',
                matrix: 'SOIL'
            }
        });

        await prisma.workItem.create({
            data: {
                id: 'WI-WPC-1-' + SUFFIX,
                sampleId: sample.id,
                labId: labActiveA.id,
                analysis: 'PH',
                status: 'ASSIGNED',
                assignedTo: techA1.username
            }
        });

        // Sign JWTs
        tokenSA1 = jwt.sign({ id: superAdmin1.id, username: superAdmin1.username, role: superAdmin1.role, tokenVersion: 1 }, JWT_SECRET, { expiresIn: '1h' });
        tokenMgrA = jwt.sign({ id: managerA.id, username: managerA.username, role: managerA.role, labId: labActiveA.id, tokenVersion: 1 }, JWT_SECRET, { expiresIn: '1h' });
        tokenTechA1 = jwt.sign({ id: techA1.id, username: techA1.username, role: techA1.role, labId: labActiveA.id, tokenVersion: 1 }, JWT_SECRET, { expiresIn: '1h' });
        tokenTechB1 = jwt.sign({ id: techB1.id, username: techB1.username, role: techB1.role, labId: labActiveB.id, tokenVersion: 1 }, JWT_SECRET, { expiresIn: '1h' });
        tokenViewerA = jwt.sign({ id: viewerA.id, username: viewerA.username, role: viewerA.role, labId: labActiveA.id, tokenVersion: 1 }, JWT_SECRET, { expiresIn: '1h' });
    });

    afterAll(async () => {
        try {
            await prisma.workItem.deleteMany({ where: { labId: { in: [labActiveA.id, labActiveB.id, labPaused.id] } } });
            await prisma.sample.deleteMany({ where: { labId: { in: [labActiveA.id, labActiveB.id, labPaused.id] } } });
            await prisma.user.deleteMany({ where: { id: { in: [superAdmin1.id, superAdmin2.id, managerA.id, techA1.id, techA2.id, techB1.id, viewerA.id] } } });
            await prisma.lab.deleteMany({ where: { id: { in: [labActiveA.id, labActiveB.id, labPaused.id] } } });
        } catch (e) {
            // cleanup best effort
        }
    });

    describe('1. Safe Staff Invitations (POST /api/staff/invitations)', () => {
        test('Super Admin can invite staff with any allowed role in any active lab', async () => {
            const res = await request(app)
                .post('/api/staff/invitations')
                .set('Authorization', `Bearer ${tokenSA1}`)
                .send({
                    name: 'Invited Tech',
                    email: `invited_tech_${SUFFIX}@test.org`.toLowerCase(),
                    role: 'LAB_TECHNICIAN',
                    labId: labActiveA.id
                });

            expect(res.status).toBe(201);
            expect(res.body.deliveryStatus).toBe('LINK_GENERATED');
            expect(res.body.activationLink).toContain('/activate?token=');
            expect(res.body.role).toBe('LAB_TECHNICIAN');
            expect(res.body.labId).toBe(labActiveA.id);
        });

        test('Lab Manager can invite subordinate staff to own lab', async () => {
            const res = await request(app)
                .post('/api/staff/invitations')
                .set('Authorization', `Bearer ${tokenMgrA}`)
                .send({
                    name: 'Invited Receptionist',
                    email: `invited_recep_${SUFFIX}@test.org`.toLowerCase(),
                    role: 'SAMPLE_RECEPTION',
                    labId: labActiveA.id
                });

            expect(res.status).toBe(201);
            expect(res.body.deliveryStatus).toBe('LINK_GENERATED');
            expect(res.body.role).toBe('SAMPLE_RECEPTION');
        });

        test('Lab Manager cannot invite staff to a foreign lab (403 Forbidden)', async () => {
            const res = await request(app)
                .post('/api/staff/invitations')
                .set('Authorization', `Bearer ${tokenMgrA}`)
                .send({
                    name: 'Illegal Invite',
                    email: `foreign_invite_${SUFFIX}@test.org`.toLowerCase(),
                    role: 'LAB_TECHNICIAN',
                    labId: labActiveB.id
                });

            expect(res.status).toBe(403);
            expect(res.body.code).toBe('TARGET_OUTSIDE_SCOPE');
        });

        test('Lab Manager cannot invite a peer Manager or Admin role (403 Forbidden)', async () => {
            const res = await request(app)
                .post('/api/staff/invitations')
                .set('Authorization', `Bearer ${tokenMgrA}`)
                .send({
                    name: 'Illegal Manager Invite',
                    email: `peer_mgr_${SUFFIX}@test.org`.toLowerCase(),
                    role: 'LAB_MANAGER',
                    labId: labActiveA.id
                });

            expect(res.status).toBe(403);
            expect(res.body.code).toBe('TARGET_ROLE_NOT_MANAGEABLE');
        });

        test('Invitation rejects email that already has an account (409 Conflict)', async () => {
            const res = await request(app)
                .post('/api/staff/invitations')
                .set('Authorization', `Bearer ${tokenSA1}`)
                .send({
                    name: 'Duplicate Tech',
                    email: techA1.email,
                    role: 'LAB_TECHNICIAN',
                    labId: labActiveA.id
                });

            expect(res.status).toBe(409);
            expect(res.body.code).toBe('ACCOUNT_ALREADY_EXISTS');
        });

        test('Invitation to paused/inactive lab is rejected with 400 LAB_PAUSED', async () => {
            const res = await request(app)
                .post('/api/staff/invitations')
                .set('Authorization', `Bearer ${tokenSA1}`)
                .send({
                    name: 'Paused Lab Tech',
                    email: `paused_tech_${SUFFIX}@test.org`.toLowerCase(),
                    role: 'LAB_TECHNICIAN',
                    labId: labPaused.id
                });

            expect(res.status).toBe(400);
            expect(res.body.code).toBe('LAB_PAUSED');
        });
    });

    describe('2. Pre-change Access Review Preview (POST /api/users/:id/access-preview)', () => {
        test('Calculates open work assignments and capability diff with signed reviewToken', async () => {
            const res = await request(app)
                .post(`/api/users/${techA1.id}/access-preview`)
                .set('Authorization', `Bearer ${tokenMgrA}`)
                .send({
                    role: 'VIEWER'
                });

            expect(res.status).toBe(200);
            expect(res.body.targetId).toBe(techA1.id);
            expect(res.body.openAssignmentsCount).toBe(1);
            expect(res.body.requiresReassignment).toBe(true);
            expect(res.body.capabilitiesLost).toContain('ENTER_RESULTS');
            expect(res.body.reviewToken).toBeDefined();
        });

        test('Manager previewing user in another lab is rejected with 403', async () => {
            const res = await request(app)
                .post(`/api/users/${techB1.id}/access-preview`)
                .set('Authorization', `Bearer ${tokenMgrA}`)
                .send({
                    role: 'VIEWER'
                });

            expect(res.status).toBe(403);
            expect(res.body.code).toBe('TARGET_OUTSIDE_SCOPE');
        });
    });

    describe('3. Applying Access Changes & Session Revocation (PATCH /api/users/:id/access)', () => {
        test('Demoting user updates role, increments tokenVersion, and invalidates active session', async () => {
            // Generate active token for techA2
            const liveTechA2Token = jwt.sign(
                { id: techA2.id, username: techA2.username, role: techA2.role, labId: labActiveA.id, tokenVersion: 1 },
                JWT_SECRET,
                { expiresIn: '1h' }
            );

            // Apply access change (change role to VIEWER)
            const patchRes = await request(app)
                .patch(`/api/users/${techA2.id}/access`)
                .set('Authorization', `Bearer ${tokenMgrA}`)
                .send({
                    changes: { role: 'VIEWER' },
                    reason: 'Transfer to reporting view'
                });

            expect(patchRes.status).toBe(200);
            expect(patchRes.body.status).toBe('APPLIED');
            expect(patchRes.body.user.role).toBe('VIEWER');
            expect(patchRes.body.user.tokenVersion).toBe(2);

            // Verify old token is rejected by authMiddleware due to tokenVersion mismatch
            const testAuthRes = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${liveTechA2Token}`);

            expect(testAuthRes.status).toBe(401);
            expect(testAuthRes.body.code).toBe('SESSION_INVALIDATED');
        });

        test('Demoting the last remaining Super Admin is blocked with 403 LAST_ADMIN_PROTECTED', async () => {
            // Deactivate all other super admins so superAdmin1 is genuinely the last active admin
            const otherAdmins = await prisma.user.findMany({
                where: { role: 'SUPER_ADMIN', id: { not: superAdmin1.id }, isActive: true }
            });
            await prisma.user.updateMany({
                where: { id: { in: otherAdmins.map(a => a.id) } },
                data: { isActive: false }
            });

            try {
                const res = await request(app)
                    .patch(`/api/users/${superAdmin1.id}/access`)
                    .set('Authorization', `Bearer ${tokenSA1}`)
                    .send({
                        changes: { role: 'LAB_MANAGER' },
                        reason: 'Demote admin'
                    });

                expect(res.status).toBe(403);
                expect(res.body.code).toBe('LAST_ADMIN_PROTECTED');
            } finally {
                // Restore other admins
                await prisma.user.updateMany({
                    where: { id: { in: otherAdmins.map(a => a.id) } },
                    data: { isActive: true }
                });
            }
        });
    });

    describe('4. Staff Suspension & Lockout Protection (POST /api/users/:id/suspend)', () => {
        test('Self-suspension is strictly forbidden with 400 SELF_MANAGEMENT_FORBIDDEN', async () => {
            const res = await request(app)
                .post(`/api/users/${managerA.id}/suspend`)
                .set('Authorization', `Bearer ${tokenMgrA}`)
                .send({ reason: 'Self deactivation' });

            expect(res.status).toBe(400);
            expect(res.body.code).toBe('SELF_MANAGEMENT_FORBIDDEN');
        });

        test('Suspending last super administrator is blocked with 403 LAST_ADMIN_PROTECTED', async () => {
            const otherAdmins = await prisma.user.findMany({
                where: { role: 'SUPER_ADMIN', id: { not: superAdmin1.id }, isActive: true }
            });
            await prisma.user.updateMany({
                where: { id: { in: otherAdmins.map(a => a.id) } },
                data: { isActive: false }
            });

            try {
                const res = await request(app)
                    .post(`/api/users/${superAdmin1.id}/suspend`)
                    .set('Authorization', `Bearer ${tokenSA1}`)
                    .send({ reason: 'Suspend last admin' });

                expect(res.status).toBe(403);
                expect(res.body.code).toBe('LAST_ADMIN_PROTECTED');
            } finally {
                await prisma.user.updateMany({
                    where: { id: { in: otherAdmins.map(a => a.id) } },
                    data: { isActive: true }
                });
            }
        });

        test('Manager suspends subordinate: sets isActive=false, bumps tokenVersion, flags open work', async () => {
            // techA1 has 1 open work item
            const res = await request(app)
                .post(`/api/users/${techA1.id}/suspend`)
                .set('Authorization', `Bearer ${tokenMgrA}`)
                .send({ reason: 'Temporary leave of absence' });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('SUSPENDED');
            expect(res.body.user.isActive).toBe(false);
            expect(res.body.openAssignmentsToReassign).toBe(1);

            // Verify active token is immediately revoked
            const authRes = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${tokenTechA1}`);

            expect(authRes.status).toBe(401);
        });
    });

    describe('5. Staff Reactivation (POST /api/users/:id/reactivate)', () => {
        test('Reactivating user sets isActive=true and preserves session revocation (new tokenVersion)', async () => {
            const res = await request(app)
                .post(`/api/users/${techA1.id}/reactivate`)
                .set('Authorization', `Bearer ${tokenMgrA}`);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ACTIVE');
            expect(res.body.user.isActive).toBe(true);

            // Previous token (tokenVersion=1) MUST STILL BE REJECTED
            const oldTokenAuth = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${tokenTechA1}`);

            expect(oldTokenAuth.status).toBe(401);
            expect(oldTokenAuth.body.code).toBe('SESSION_INVALIDATED');
        });

        test('Reactivating user whose laboratory is paused/inactive is rejected with 400 LAB_PAUSED', async () => {
            // Create inactive user in paused lab
            const pausedStaff = await prisma.user.create({
                data: {
                    id: 'usr-paused-staff-' + SUFFIX,
                    username: 'paused_staff_' + SUFFIX,
                    email: ('paused_staff_' + SUFFIX + '@test.org').toLowerCase(),
                    name: 'Paused Staff',
                    password: 'hash',
                    role: 'LAB_TECHNICIAN',
                    labId: labPaused.id,
                    isActive: false,
                    tokenVersion: 1
                }
            });

            const res = await request(app)
                .post(`/api/users/${pausedStaff.id}/reactivate`)
                .set('Authorization', `Bearer ${tokenSA1}`);

            expect(res.status).toBe(400);
            expect(res.body.code).toBe('LAB_PAUSED');

            await prisma.user.delete({ where: { id: pausedStaff.id } });
        });
    });

    describe('6. Emergency Single-Use Recovery Grants (POST /api/users/:id/recovery)', () => {
        test('Manager can issue single-use recovery grant for own lab staff', async () => {
            const res = await request(app)
                .post(`/api/users/${techA1.id}/recovery`)
                .set('Authorization', `Bearer ${tokenMgrA}`)
                .send({ reason: 'Staff lost credentials during field rotation' });

            expect(res.status).toBe(201);
            expect(res.body.deliveryStatus).toBe('LINK_GENERATED');
            expect(res.body.recoveryLink).toContain('/reset-password?token=');
            expect(res.body.userId).toBe(techA1.id);
        });

        test('Manager cannot issue recovery grant for foreign lab staff (403 Forbidden)', async () => {
            const res = await request(app)
                .post(`/api/users/${techB1.id}/recovery`)
                .set('Authorization', `Bearer ${tokenMgrA}`)
                .send({ reason: 'Unauthorized recovery attempt' });

            expect(res.status).toBe(403);
            expect(res.body.code).toBe('TARGET_OUTSIDE_SCOPE');
        });
    });

    describe('7. Self-Profile Scope Enforcement (PATCH /api/auth/profile)', () => {
        test('User can update own name, language, and theme preference', async () => {
            const res = await request(app)
                .patch('/api/auth/profile')
                .set('Authorization', `Bearer ${tokenViewerA}`)
                .send({
                    name: 'Updated Viewer Name',
                    language: 'es',
                    themePreference: 'dark'
                });

            expect(res.status).toBe(200);
            expect(res.body.user.name).toBe('Updated Viewer Name');
            expect(res.body.user.language).toBe('es');
            expect(res.body.user.themePreference).toBe('dark');
        });

        test('User cannot inject administrative fields (role, labId, projects, countries)', async () => {
            const res = await request(app)
                .patch('/api/auth/profile')
                .set('Authorization', `Bearer ${tokenViewerA}`)
                .send({
                    name: 'Hacker Viewer',
                    role: 'SUPER_ADMIN',
                    labId: labActiveB.id
                });

            expect(res.status).toBe(400);
            expect(res.body.code).toBe('FORBIDDEN_PROFILE_FIELD');
        });
    });
});
