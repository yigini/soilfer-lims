'use strict';

const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../config/auth');
const staffLifecycleService = require('../../services/staffLifecycleService');
const { getLocalDayInterval } = require('../../services/dashboardScope');

describe('Staff Invitation Lifecycle Contract Tests (I01-I04, Reissue, Scoping)', () => {
    const SUFFIX = 'INV-' + Date.now();
    let labA, labB, testProject;
    let superAdmin, managerA, managerB, nationalLeadGTM;
    let tokenSA, tokenMgrA, tokenMgrB, tokenGTM;

    beforeAll(async () => {
        labA = await prisma.lab.create({
            data: {
                id: 'lab-a-' + SUFFIX,
                code: 'LA-' + SUFFIX.slice(-4),
                name: 'Lab Alpha ' + SUFFIX,
                country: 'Guatemala',
                isActive: true,
                timezone: 'America/Guatemala'
            }
        });

        labB = await prisma.lab.create({
            data: {
                id: 'lab-b-' + SUFFIX,
                code: 'LB-' + SUFFIX.slice(-4),
                name: 'Lab Beta ' + SUFFIX,
                country: 'Honduras',
                isActive: true,
                timezone: 'America/Tegucigalpa'
            }
        });

        testProject = await prisma.project.create({
            data: {
                id: 'proj-' + SUFFIX,
                code: 'PRJ-' + SUFFIX.slice(-4),
                name: 'Test Project ' + SUFFIX,
                status: 'ACTIVE',
                labId: labA.id,
                assignedLabIds: '[]'
            }
        });

        superAdmin = await prisma.user.create({
            data: {
                id: 'sa-' + SUFFIX,
                username: 'sa_' + SUFFIX,
                name: 'Super Admin',
                email: `sa_${SUFFIX.toLowerCase()}@example.org`,
                password: 'hash',
                role: 'SUPER_ADMIN',
                isActive: true,
                tokenVersion: 1
            }
        });

        managerA = await prisma.user.create({
            data: {
                id: 'mgr-a-' + SUFFIX,
                username: 'mgra_' + SUFFIX,
                name: 'Manager Lab A',
                email: `mgra_${SUFFIX.toLowerCase()}@example.org`,
                password: 'hash',
                role: 'LAB_MANAGER',
                labId: labA.id,
                countries: JSON.stringify(['Guatemala']),
                isActive: true,
                tokenVersion: 1
            }
        });

        managerB = await prisma.user.create({
            data: {
                id: 'mgr-b-' + SUFFIX,
                username: 'mgrb_' + SUFFIX,
                name: 'Manager Lab B',
                email: `mgrb_${SUFFIX.toLowerCase()}@example.org`,
                password: 'hash',
                role: 'LAB_MANAGER',
                labId: labB.id,
                countries: JSON.stringify(['Honduras']),
                isActive: true,
                tokenVersion: 1
            }
        });

        nationalLeadGTM = await prisma.user.create({
            data: {
                id: 'nl-gtm-' + SUFFIX,
                username: 'nlgtm_' + SUFFIX,
                name: 'National Lead GTM',
                email: `nlgtm_${SUFFIX.toLowerCase()}@example.org`,
                password: 'hash',
                role: 'MASTER_USER',
                countries: JSON.stringify(['Guatemala']),
                isActive: true,
                tokenVersion: 1
            }
        });

        tokenSA = jwt.sign({ id: superAdmin.id, username: superAdmin.username, role: superAdmin.role, tokenVersion: 1 }, JWT_SECRET, { expiresIn: '1h' });
        tokenMgrA = jwt.sign({ id: managerA.id, username: managerA.username, role: managerA.role, labId: labA.id, tokenVersion: 1 }, JWT_SECRET, { expiresIn: '1h' });
        tokenMgrB = jwt.sign({ id: managerB.id, username: managerB.username, role: managerB.role, labId: labB.id, tokenVersion: 1 }, JWT_SECRET, { expiresIn: '1h' });
        tokenGTM = jwt.sign({ id: nationalLeadGTM.id, username: nationalLeadGTM.username, role: nationalLeadGTM.role, countries: ['Guatemala'], tokenVersion: 1 }, JWT_SECRET, { expiresIn: '1h' });
    });

    afterAll(async () => {
        await prisma.$executeRawUnsafe('DELETE FROM "StaffInvitation" WHERE "email" LIKE ?', `%${SUFFIX.toLowerCase()}%`).catch(() => {});
        if (testProject) {
            await prisma.project.deleteMany({
                where: { id: testProject.id }
            }).catch(() => {});
        }
        await prisma.auditLog.deleteMany({
            where: { actorId: { in: [superAdmin?.id, managerA?.id, managerB?.id, nationalLeadGTM?.id].filter(Boolean) } }
        }).catch(() => {});
        await prisma.user.deleteMany({
            where: { id: { in: [superAdmin?.id, managerA?.id, managerB?.id, nationalLeadGTM?.id].filter(Boolean) } }
        }).catch(() => {});
        await prisma.lab.deleteMany({
            where: { id: { in: [labA?.id, labB?.id].filter(Boolean) } }
        }).catch(() => {});
    });

    test('I00: Valid staff invitation creation returns 201 with manual delivery link', async () => {
        const email = `tech1_${SUFFIX.toLowerCase()}@example.org`;
        const res = await request(app)
            .post('/api/users/invitations')
            .set('Authorization', `Bearer ${tokenMgrA}`)
            .send({
                email,
                role: 'LAB_TECHNICIAN',
                name: 'Tech Alpha One',
                labId: labA.id
            });

        expect(res.status).toBe(201);
        expect(res.body.email).toBe(email);
        expect(res.body.token).toBeDefined();
        expect(res.body.activationLink).toContain('/activate?token=');
    });

    test('I01: Duplicate invitation for active pending email returns 409 conflict and leaves single pending record', async () => {
        const email = `tech_dup_${SUFFIX.toLowerCase()}@example.org`;

        // First invite succeeds
        const first = await request(app)
            .post('/api/users/invitations')
            .set('Authorization', `Bearer ${tokenMgrA}`)
            .send({
                email,
                role: 'LAB_TECHNICIAN',
                name: 'Tech Dup',
                labId: labA.id
            });
        expect(first.status).toBe(201);

        // Second identical invite returns 409
        const second = await request(app)
            .post('/api/users/invitations')
            .set('Authorization', `Bearer ${tokenMgrA}`)
            .send({
                email,
                role: 'LAB_TECHNICIAN',
                name: 'Tech Dup',
                labId: labA.id
            });
        expect(second.status).toBe(409);
        expect(second.body.code).toBe('PENDING_INVITATION_EXISTS');

        // Confirm DB has exactly 1 pending record
        const rows = await prisma.$queryRawUnsafe(
            'SELECT COUNT(*) AS count FROM "StaffInvitation" WHERE "email" = ? AND "isConsumed" = 0 AND "isRevoked" = 0',
            email
        );
        expect(Number(rows[0].count)).toBe(1);
    });

    test('I02: Transaction rollback on audit failure leaves 0 persisted invitation records', async () => {
        const email = `tech_fail_${SUFFIX.toLowerCase()}@example.org`;

        // Install temporary trigger that rejects INVITE_CREATED audit logs
        await prisma.$executeRawUnsafe(`
            CREATE TRIGGER trg_fail_invite_audit
            BEFORE INSERT ON "AuditLog"
            WHEN NEW.action = 'INVITE_CREATED'
            BEGIN
                SELECT RAISE(FAIL, 'Synthetic audit failure for rollback verification');
            END;
        `);

        try {
            const res = await request(app)
                .post('/api/users/invitations')
                .set('Authorization', `Bearer ${tokenMgrA}`)
                .send({
                    email,
                    role: 'LAB_TECHNICIAN',
                    name: 'Tech Fail Audit',
                    labId: labA.id
                });

            expect(res.status).toBe(500);

            // Invitation must be rolled back: 0 persisted records
            const rows = await prisma.$queryRawUnsafe(
                'SELECT COUNT(*) AS count FROM "StaffInvitation" WHERE "email" = ?',
                email
            );
            expect(Number(rows[0].count)).toBe(0);
        } finally {
            await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS trg_fail_invite_audit');
        }
    });

    test('I03: Activation preserves explicit project grant assigned during invitation', async () => {
        const email = `pm_${SUFFIX.toLowerCase()}@example.org`;

        // Super Admin invites a PROJECT_MANAGER with explicit project grant
        const inviteRes = await request(app)
            .post('/api/users/invitations')
            .set('Authorization', `Bearer ${tokenSA}`)
            .send({
                email,
                role: 'PROJECT_MANAGER',
                name: 'Project Lead',
                labId: labA.id,
                projects: [testProject.code]
            });
        expect(inviteRes.status).toBe(201);
        const inviteToken = inviteRes.body.token;

        // Verify token returns non-sensitive metadata including projects
        const verifyRes = await staffLifecycleService.verifyInvitationToken(inviteToken);
        expect(verifyRes.email).toBe(email);
        expect(verifyRes.projects).toEqual([testProject.code]);

        // Consume/activate invitation: signature is consumeInvitation(rawToken, { username, password })
        const username = `pm_user_${SUFFIX.toLowerCase().slice(-4)}`;
        const consumeRes = await staffLifecycleService.consumeInvitation(inviteToken, {
            username,
            password: 'StrongPassword123!',
            name: 'Project Lead Activated'
        });
        expect(consumeRes.username).toBe(username);
        expect(consumeRes.projects).toEqual([testProject.code]);

        // Verify user in database has preserved projects
        const dbUser = await prisma.user.findUnique({ where: { username } });
        expect(dbUser).toBeDefined();
        expect(JSON.parse(dbUser.projects)).toEqual([testProject.code]);

        // Clean up created user
        await prisma.user.delete({ where: { username } }).catch(() => {});
    });

    test('I04: Service boundary denies foreign lab manager from listing or revoking invitations', async () => {
        const email = `tech_scope_${SUFFIX.toLowerCase()}@example.org`;

        // Manager A creates invitation in Lab A
        const inviteRes = await staffLifecycleService.createInvitation(managerA, {
            email,
            role: 'LAB_TECHNICIAN',
            name: 'Scope Tech',
            labId: labA.id
        });
        expect(inviteRes.id).toBeDefined();
        const inviteId = inviteRes.id;

        // Manager B attempts to list pending invitations for Lab A -> 403 TARGET_OUTSIDE_SCOPE
        await expect(
            staffLifecycleService.getPendingInvitations(managerB, labA.id)
        ).rejects.toMatchObject({ code: 'TARGET_OUTSIDE_SCOPE', statusCode: 403 });

        // Manager B attempts to revoke Manager A's invitation -> 403 TARGET_OUTSIDE_SCOPE
        await expect(
            staffLifecycleService.revokeInvitation(managerB, inviteId)
        ).rejects.toMatchObject({ code: 'TARGET_OUTSIDE_SCOPE', statusCode: 403 });

        // Confirm invitation is still active in DB
        const rows = await prisma.$queryRawUnsafe(
            'SELECT "isRevoked" FROM "StaffInvitation" WHERE "id" = ?',
            inviteId
        );
        expect(Boolean(rows[0].isRevoked)).toBe(false);

        // Manager A CAN revoke their own lab's invitation
        const revoked = await staffLifecycleService.revokeInvitation(managerA, inviteId);
        expect(revoked.success).toBe(true);

        const rowsAfter = await prisma.$queryRawUnsafe(
            'SELECT "isRevoked" FROM "StaffInvitation" WHERE "id" = ?',
            inviteId
        );
        expect(Boolean(rowsAfter[0].isRevoked)).toBe(true);
    });

    test('Reissue: Reissuing invitation invalidates prior token and issues fresh valid secret', async () => {
        const email = `tech_reissue_${SUFFIX.toLowerCase()}@example.org`;

        const initial = await staffLifecycleService.createInvitation(managerA, {
            email,
            role: 'LAB_TECHNICIAN',
            name: 'Reissue Tech',
            labId: labA.id
        });
        const initialToken = initial.token;
        const initialId = initial.id;

        // Reissue via service
        const reissued = await staffLifecycleService.reissueInvitation(managerA, initialId);
        expect(reissued.token).toBeDefined();
        expect(reissued.token).not.toBe(initialToken);
        expect(reissued.id).toBeDefined();

        // Old token cannot be verified
        await expect(
            staffLifecycleService.verifyInvitationToken(initialToken)
        ).rejects.toThrow();

        // New token can be verified
        const verified = await staffLifecycleService.verifyInvitationToken(reissued.token);
        expect(verified.email).toBe(email);
    });

    test('Pending Roster: getPendingInvitations returns sanitized records with MANUAL_LINK delivery status', async () => {
        const email = `tech_roster_${SUFFIX.toLowerCase()}@example.org`;

        await staffLifecycleService.createInvitation(managerA, {
            email,
            role: 'LAB_TECHNICIAN',
            name: 'Roster Tech',
            labId: labA.id
        });

        // Manager A fetches roster via HTTP
        const res = await request(app)
            .get(`/api/users/invitations?labId=${labA.id}`)
            .set('Authorization', `Bearer ${tokenMgrA}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        const found = res.body.find(inv => inv.email.toLowerCase() === email.toLowerCase());
        expect(found).toBeDefined();
        expect(found.deliveryStatus).toBe('MANUAL_LINK');
        // Must NOT expose raw tokens or hashes
        expect(found.token).toBeUndefined();
        expect(found.tokenHash).toBeUndefined();
    });

    test('J01: Same-day expired invitation returns 410 on verify, is marked expired in roster, and does not block new creation', async () => {
        const email = `tech_sameday_${SUFFIX.toLowerCase()}@example.org`;
        const inv = await staffLifecycleService.createInvitation(managerA, {
            email,
            role: 'LAB_TECHNICIAN',
            name: 'Same Day Tech',
            labId: labA.id
        });
        const rawToken = inv.token;

        // Set expiresAt to 2 hours ago (earlier today)
        const earlierToday = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
        await prisma.$executeRawUnsafe(
            `UPDATE "StaffInvitation" SET "expiresAt" = ? WHERE "id" = ?`,
            earlierToday,
            inv.id
        );

        // 1. Verify token returns 410
        await expect(
            staffLifecycleService.verifyInvitationToken(rawToken)
        ).rejects.toMatchObject({ statusCode: 410 });

        // 2. Pending roster marks isExpired: true
        const pending = await staffLifecycleService.getPendingInvitations(managerA, labA.id);
        const found = pending.find(p => p.id === inv.id);
        expect(found).toBeDefined();
        expect(found.isExpired).toBe(true);

        // 3. Creating a new invitation for same email returns 201 (not blocked by 409)
        const newInvRes = await request(app)
            .post('/api/staff/invitations')
            .set('Authorization', `Bearer ${tokenMgrA}`)
            .send({
                email,
                role: 'LAB_TECHNICIAN',
                name: 'Renewed Tech',
                labId: labA.id
            });
        expect(newInvRes.status).toBe(201);
        expect(newInvRes.body.token).toBeDefined();
    });

    test('J02: Reissue shortcut cannot revoke or replace foreign lab invitation, handles boolean tampering, and prevents audit side effects', async () => {
        const emailB = `tech_b_sc_${SUFFIX.toLowerCase()}@example.org`;
        const bInv = await staffLifecycleService.createInvitation(managerB, {
            email: emailB,
            role: 'LAB_TECHNICIAN',
            name: 'Lab B Tech',
            labId: labB.id
        });

        // 1. Manager A tries to POST to /api/staff/invitations with reissue: true for emailB into Lab A -> 403
        const stealAttempt = await request(app)
            .post('/api/staff/invitations')
            .set('Authorization', `Bearer ${tokenMgrA}`)
            .send({
                email: emailB,
                role: 'LAB_TECHNICIAN',
                name: 'Stolen Tech',
                labId: labA.id,
                reissue: true
            });
        expect(stealAttempt.status).toBe(403);
        expect(stealAttempt.body.code).toBe('TARGET_OUTSIDE_SCOPE');

        // Verify Lab B invitation remains unrevoked
        const bRows = await prisma.$queryRawUnsafe(
            `SELECT "isRevoked" FROM "StaffInvitation" WHERE "id" = ?`,
            bInv.id
        );
        expect(Boolean(bRows[0].isRevoked)).toBe(false);

        // 2. Test /api/users/invitations alias -> also 403
        const stealAliasAttempt = await request(app)
            .post('/api/users/invitations')
            .set('Authorization', `Bearer ${tokenMgrA}`)
            .send({
                email: emailB,
                role: 'LAB_TECHNICIAN',
                name: 'Stolen Tech Alias',
                labId: labA.id,
                reissue: true
            });
        expect(stealAliasAttempt.status).toBe(403);
        expect(stealAliasAttempt.body.code).toBe('TARGET_OUTSIDE_SCOPE');

        // 3. Boolean string tampering: reissue: "false" on existing Lab A invitation must NOT reissue
        const emailA = `tech_a_sc_${SUFFIX.toLowerCase()}@example.org`;
        await staffLifecycleService.createInvitation(managerA, {
            email: emailA,
            role: 'LAB_TECHNICIAN',
            name: 'Lab A Tech',
            labId: labA.id
        });

        const tamperAttempt = await request(app)
            .post('/api/staff/invitations')
            .set('Authorization', `Bearer ${tokenMgrA}`)
            .send({
                email: emailA,
                role: 'LAB_TECHNICIAN',
                name: 'Tamper Tech',
                labId: labA.id,
                reissue: 'false'
            });
        expect(tamperAttempt.status).toBe(409);
        expect(['INVITATION_ALREADY_EXISTS', 'PENDING_INVITATION_EXISTS']).toContain(tamperAttempt.body.code);

        // 4. Privileged same-lab target: pending invitation for SUPER_ADMIN cannot be reissued by LAB_MANAGER
        const emailPriv = `admin_priv_${SUFFIX.toLowerCase()}@example.org`;
        const privInv = await staffLifecycleService.createInvitation(superAdmin, {
            email: emailPriv,
            role: 'SUPER_ADMIN',
            name: 'Privileged Admin',
            labId: labA.id
        });

        const privReissueAttempt = await request(app)
            .post('/api/staff/invitations')
            .set('Authorization', `Bearer ${tokenMgrA}`)
            .send({
                email: emailPriv,
                role: 'LAB_TECHNICIAN',
                name: 'Demote Attempt',
                labId: labA.id,
                reissue: true
            });
        expect([403, 409]).toContain(privReissueAttempt.status);

        // Verify privInv was NOT revoked
        const privRows = await prisma.$queryRawUnsafe(
            `SELECT "isRevoked" FROM "StaffInvitation" WHERE "id" = ?`,
            privInv.id
        );
        expect(Boolean(privRows[0].isRevoked)).toBe(false);
    });

    test('J03: National Lead reissues own-country technician invitation (201) and is denied for foreign lab (403)', async () => {
        const emailGTM = `tech_gtm_${SUFFIX.toLowerCase()}@example.org`;
        // National Lead creates invitation in Lab A (Guatemala)
        const createRes = await request(app)
            .post('/api/staff/invitations')
            .set('Authorization', `Bearer ${tokenGTM}`)
            .send({
                email: emailGTM,
                role: 'LAB_TECHNICIAN',
                name: 'GTM Tech',
                labId: labA.id
            });
        expect(createRes.status).toBe(201);
        const inviteId = createRes.body.id;

        // National Lead reissues own-country invitation -> 201
        const reissueRes = await request(app)
            .post(`/api/staff/invitations/${inviteId}/reissue`)
            .set('Authorization', `Bearer ${tokenGTM}`);
        expect(reissueRes.status).toBe(201);
        expect(reissueRes.body.token).toBeDefined();

        // Foreign lab denial: National Lead attempts to reissue an invitation in Lab B (Honduras) -> 403
        const emailHND = `tech_hnd_${SUFFIX.toLowerCase()}@example.org`;
        const hndInv = await staffLifecycleService.createInvitation(superAdmin, {
            email: emailHND,
            role: 'LAB_TECHNICIAN',
            name: 'HND Tech',
            labId: labB.id
        });

        const foreignReissue = await request(app)
            .post(`/api/staff/invitations/${hndInv.id}/reissue`)
            .set('Authorization', `Bearer ${tokenGTM}`);
        expect(foreignReissue.status).toBe(403);
        expect(foreignReissue.body.code).toBe('TARGET_OUTSIDE_SCOPE');
    });

    test('J04: Country coincidence alone does not authorize Lab Manager to grant project access', async () => {
        const coincProject = await prisma.project.create({
            data: {
                id: 'proj-coinc-' + SUFFIX,
                code: 'COINC-' + SUFFIX.slice(-4),
                name: 'Coincidence Project ' + SUFFIX,
                status: 'ACTIVE',
                labId: labB.id,
                countries: JSON.stringify(['Guatemala', 'Honduras']),
                assignedLabIds: '[]'
            }
        });

        const email = `tech_j04_${SUFFIX.toLowerCase()}@example.org`;
        const res = await request(app)
            .post('/api/staff/invitations')
            .set('Authorization', `Bearer ${tokenMgrA}`)
            .send({
                email,
                role: 'LAB_TECHNICIAN',
                name: 'Coinc Tech',
                labId: labA.id,
                projects: [coincProject.code]
            });

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('PROJECT_OUTSIDE_SCOPE');

        await prisma.project.delete({ where: { id: coincProject.id } }).catch(() => {});
    });

    test('J05: Stale project grant rejected on activation and reissue with 400 STALE_PROJECT_GRANT', async () => {
        const movedProj = await prisma.project.create({
            data: {
                id: 'proj-moved-' + SUFFIX,
                code: 'MVD-' + SUFFIX.slice(-4),
                name: 'Moved Project ' + SUFFIX,
                status: 'ACTIVE',
                labId: labA.id,
                assignedLabIds: '[]'
            }
        });

        const email = `tech_j05_${SUFFIX.toLowerCase()}@example.org`;
        const inv = await staffLifecycleService.createInvitation(managerA, {
            email,
            role: 'LAB_TECHNICIAN',
            name: 'Moved Tech',
            labId: labA.id,
            projects: [movedProj.code]
        });

        // Move project ownership to Lab B with no Lab A link
        await prisma.project.update({
            where: { id: movedProj.id },
            data: { labId: labB.id, assignedLabIds: '[]' }
        });

        // 1. Activation fails closed with 400 STALE_PROJECT_GRANT
        const actRes = await request(app)
            .post('/api/auth/activate')
            .send({
                token: inv.token,
                username: ('moved_tech_' + SUFFIX).toLowerCase().replace(/[^a-z0-9]/g, ''),
                password: 'Password123!Secure',
                name: 'Moved Tech Person'
            });
        expect(actRes.status).toBe(400);
        expect(actRes.body.code).toBe('STALE_PROJECT_GRANT');

        // 2. Reissue also detects moved project and rejects with 400 STALE_PROJECT_GRANT
        const reisRes = await request(app)
            .post(`/api/staff/invitations/${inv.id}/reissue`)
            .set('Authorization', `Bearer ${tokenMgrA}`);
        expect(reisRes.status).toBe(400);
        expect(reisRes.body.code).toBe('STALE_PROJECT_GRANT');

        await prisma.project.delete({ where: { id: movedProj.id } }).catch(() => {});
    });

    test('A41: Project update handler returns single HTTP response and idempotent retry without headers error', async () => {
        const updatePayload = {
            name: 'Updated Project Name ' + SUFFIX,
            description: 'Updated Description'
        };

        // First update call
        const res1 = await request(app)
            .put(`/api/projects/${testProject.id}`)
            .set('Authorization', `Bearer ${tokenSA}`)
            .send(updatePayload);
        expect(res1.status).toBe(200);
        expect(res1.body.name).toBe(updatePayload.name);

        // Immediate retry of identical update
        const res2 = await request(app)
            .put(`/api/projects/${testProject.id}`)
            .set('Authorization', `Bearer ${tokenSA}`)
            .send(updatePayload);
        expect(res2.status).toBe(200);
        expect(res2.body.name).toBe(updatePayload.name);
    });

    test('A37: Lab local day interval and DST 23/25-hour calculation (Europe/London and America/Guatemala)', () => {
        // Spring forward: 23 hours
        const spring = getLocalDayInterval('Europe/London', new Date('2026-03-29T12:00:00Z'));
        const springHours = (spring.dayEnd.getTime() - spring.dayStart.getTime()) / (1000 * 3600);
        expect(springHours).toBe(23);

        // Fall back: 25 hours
        const fall = getLocalDayInterval('Europe/London', new Date('2026-10-25T12:00:00Z'));
        const fallHours = (fall.dayEnd.getTime() - fall.dayStart.getTime()) / (1000 * 3600);
        expect(fallHours).toBe(25);

        // Non-DST Guatemala standard: 24 hours
        const gtm = getLocalDayInterval('America/Guatemala', new Date('2026-06-15T12:00:00Z'));
        const gtmHours = (gtm.dayEnd.getTime() - gtm.dayStart.getTime()) / (1000 * 3600);
        expect(gtmHours).toBe(24);
    });
});
