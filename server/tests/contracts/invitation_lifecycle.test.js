'use strict';

const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../config/auth');
const staffLifecycleService = require('../../services/staffLifecycleService');

describe('Staff Invitation Lifecycle Contract Tests (I01-I04, Reissue, Scoping)', () => {
    const SUFFIX = 'INV-' + Date.now();
    let labA, labB, testProject;
    let superAdmin, managerA, managerB;
    let tokenSA, tokenMgrA, tokenMgrB;

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

        tokenSA = jwt.sign({ id: superAdmin.id, username: superAdmin.username, role: superAdmin.role, tokenVersion: 1 }, JWT_SECRET, { expiresIn: '1h' });
        tokenMgrA = jwt.sign({ id: managerA.id, username: managerA.username, role: managerA.role, labId: labA.id, tokenVersion: 1 }, JWT_SECRET, { expiresIn: '1h' });
        tokenMgrB = jwt.sign({ id: managerB.id, username: managerB.username, role: managerB.role, labId: labB.id, tokenVersion: 1 }, JWT_SECRET, { expiresIn: '1h' });
    });

    afterAll(async () => {
        await prisma.$executeRawUnsafe('DELETE FROM "StaffInvitation" WHERE "email" LIKE ?', `%${SUFFIX.toLowerCase()}%`).catch(() => {});
        if (testProject) {
            await prisma.project.deleteMany({
                where: { id: testProject.id }
            }).catch(() => {});
        }
        await prisma.auditLog.deleteMany({
            where: { actorId: { in: [superAdmin?.id, managerA?.id, managerB?.id].filter(Boolean) } }
        }).catch(() => {});
        await prisma.user.deleteMany({
            where: { id: { in: [superAdmin?.id, managerA?.id, managerB?.id].filter(Boolean) } }
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
});
