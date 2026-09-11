'use strict';

const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../config/auth');
const labLifecycleService = require('../../services/labLifecycleService');
const staffLifecycleService = require('../../services/staffLifecycleService');
const actionPolicyService = require('../../services/actionPolicyService');
const wsServer = require('../../wsServer');
const WS = require('ws');

describe('Final Governance Probes & Companion Scenarios Contract Tests (F01-F07)', () => {
    const SUFFIX = 'FINAL-' + Date.now();
    let labGTM, labFRA, labSetup;
    let superAdmin, nationalGTM, managerGTM, techGTM;
    let tokenSA, tokenNatGTM, tokenMgrGTM, tokenTechGTM;

    beforeAll(async () => {
        // Create laboratories
        labGTM = await prisma.lab.create({
            data: {
                id: 'lab-gtm-' + SUFFIX,
                code: 'LG-' + SUFFIX.slice(-4),
                name: 'Guatemala Central Lab ' + SUFFIX,
                country: 'Guatemala',
                isActive: true,
                timezone: 'America/Guatemala'
            }
        });

        labFRA = await prisma.lab.create({
            data: {
                id: 'lab-fra-' + SUFFIX,
                code: 'LF-' + SUFFIX.slice(-4),
                name: 'France Reference Lab ' + SUFFIX,
                country: 'France',
                isActive: true,
                timezone: 'Europe/Paris'
            }
        });

        labSetup = await prisma.lab.create({
            data: {
                id: 'lab-setup-' + SUFFIX,
                code: 'LS-' + SUFFIX.slice(-4),
                name: 'New Setup Lab ' + SUFFIX,
                country: 'Guatemala',
                isActive: false,
                timezone: 'America/Guatemala'
            }
        });

        await labLifecycleService.getLabOperationalState(labSetup.id);
        await prisma.$executeRawUnsafe(
            'INSERT OR REPLACE INTO "LabLifecycleState" ("labId","operationalStatus","revision") VALUES (?,?,?)',
            labSetup.id, 'SETUP', 1
        );

        // Create users
        superAdmin = await prisma.user.create({
            data: {
                id: 'usr-sa-' + SUFFIX,
                username: 'sa_' + SUFFIX,
                name: 'Super Admin',
                email: 'sa_' + SUFFIX + '@example.org',
                password: 'hash',
                role: 'SUPER_ADMIN',
                isActive: true,
                tokenVersion: 1
            }
        });

        nationalGTM = await prisma.user.create({
            data: {
                id: 'usr-nat-' + SUFFIX,
                username: 'nat_' + SUFFIX,
                name: 'National Lead Guatemala',
                email: 'nat_' + SUFFIX + '@example.org',
                password: 'hash',
                role: 'MASTER_USER',
                countries: JSON.stringify(['Guatemala']),
                isActive: true,
                tokenVersion: 1
            }
        });

        managerGTM = await prisma.user.create({
            data: {
                id: 'usr-mgr-' + SUFFIX,
                username: 'mgr_' + SUFFIX,
                name: 'Lab Manager Guatemala',
                email: 'mgr_' + SUFFIX + '@example.org',
                password: 'hash',
                role: 'LAB_MANAGER',
                labId: labGTM.id,
                isActive: true,
                tokenVersion: 1
            }
        });

        techGTM = await prisma.user.create({
            data: {
                id: 'usr-tech-' + SUFFIX,
                username: 'tech_' + SUFFIX,
                name: 'Technician Guatemala',
                email: 'tech_' + SUFFIX + '@example.org',
                password: 'hash',
                role: 'LAB_TECHNICIAN',
                labId: labGTM.id,
                isActive: true,
                tokenVersion: 1
            }
        });

        tokenSA = jwt.sign({ id: superAdmin.id, username: superAdmin.username, role: superAdmin.role, tokenVersion: 1 }, JWT_SECRET, { expiresIn: '1h' });
        tokenNatGTM = jwt.sign({ id: nationalGTM.id, username: nationalGTM.username, role: nationalGTM.role, tokenVersion: 1 }, JWT_SECRET, { expiresIn: '1h' });
        tokenMgrGTM = jwt.sign({ id: managerGTM.id, username: managerGTM.username, role: managerGTM.role, labId: labGTM.id, tokenVersion: 1 }, JWT_SECRET, { expiresIn: '1h' });
        tokenTechGTM = jwt.sign({ id: techGTM.id, username: techGTM.username, role: techGTM.role, labId: labGTM.id, tokenVersion: 1 }, JWT_SECRET, { expiresIn: '1h' });
    });

    afterAll(async () => {
        try {
            await prisma.$executeRawUnsafe('DELETE FROM "StaffInvitation" WHERE "email" LIKE ?', `%${SUFFIX}%`);
            await prisma.$executeRawUnsafe('DELETE FROM "LabLifecycleState" WHERE "labId" IN (?,?,?)', labGTM.id, labFRA.id, labSetup.id);
            await prisma.projectLab.deleteMany({ where: { labId: { in: [labGTM.id, labFRA.id, labSetup.id] } } });
            await prisma.workItem.deleteMany({ where: { labId: { in: [labGTM.id, labFRA.id, labSetup.id] } } });
            await prisma.sample.deleteMany({ where: { assignedLab: { in: [labGTM.id, labFRA.id, labSetup.id] } } });
            await prisma.project.deleteMany({ where: { code: { contains: SUFFIX } } });
            await prisma.user.deleteMany({ where: { id: { contains: SUFFIX } } });
            await prisma.lab.deleteMany({ where: { id: { in: [labGTM.id, labFRA.id, labSetup.id] } } });
        } catch (e) {
            // best-effort cleanup
        }
    });

    describe('1. F01 & C01: National Invitation Authority & Scope Enforcement', () => {
        test('F01: Guatemala national lead cannot invite staff into France lab (403, 0 persisted)', async () => {
            const res = await request(app)
                .post('/api/staff/invitations')
                .set('Authorization', `Bearer ${tokenNatGTM}`)
                .send({
                    name: 'Foreign Technician',
                    email: `foreign-tech-${SUFFIX}@example.org`,
                    role: 'LAB_TECHNICIAN',
                    labId: labFRA.id
                });

            expect(res.status).toBe(403);
            expect(res.body.code).toBe('TARGET_OUTSIDE_SCOPE');

            const persisted = await prisma.$queryRawUnsafe(
                'SELECT COUNT(*) AS count FROM "StaffInvitation" WHERE "email" = ?',
                `foreign-tech-${SUFFIX}@example.org`
            );
            expect(Number(persisted[0].count)).toBe(0);
        });

        test('C01: Guatemala national lead can invite staff inside their own country (201)', async () => {
            const res = await request(app)
                .post('/api/staff/invitations')
                .set('Authorization', `Bearer ${tokenNatGTM}`)
                .send({
                    name: 'Local Technician',
                    email: `local-tech-${SUFFIX}@example.org`,
                    role: 'LAB_TECHNICIAN',
                    labId: labGTM.id
                });

            expect(res.status).toBe(201);
            expect(res.body.activationUrl).toBeDefined();
        });

        test('National lead can perform actions in own country without proposed-lab field', async () => {
            const decision = actionPolicyService.canManageUser(
                nationalGTM,
                { id: techGTM.id, role: techGTM.role, labId: labGTM.id, labCountry: 'Guatemala' }
            );
            expect(decision.allowed).toBe(true);
            expect(decision.code).toBe('ALLOWED');
        });

        test('National lead fails closed when target country scope is missing', async () => {
            const decision = actionPolicyService.canManageUser(
                nationalGTM,
                { id: 'usr-unknown', role: 'LAB_TECHNICIAN', labId: 'lab-unknown' }
            );
            expect(decision.allowed).toBe(false);
            expect(decision.code).toBe('TARGET_OUTSIDE_SCOPE');
        });
    });

    describe('2. F02 & Onboarding Journey: SETUP Status & Pending Manager', () => {
        let setupInviteToken;

        test('F02: Administrator appoints pending manager while lab is in SETUP (201)', async () => {
            const res = await request(app)
                .post('/api/staff/invitations')
                .set('Authorization', `Bearer ${tokenSA}`)
                .send({
                    name: 'Pending Manager',
                    email: `pending-mgr-${SUFFIX}@example.org`,
                    role: 'LAB_MANAGER',
                    labId: labSetup.id
                });

            expect(res.status).toBe(201);
            expect(res.body.deliveryStatus).toBe('LINK_GENERATED');
            setupInviteToken = res.body.token;
        });

        test('Work item assignment is blocked in SETUP lab (400 LAB_PAUSED)', async () => {
            const techSetup = await prisma.user.create({
                data: {
                    id: 'usr-tech-setup-' + SUFFIX,
                    username: 'tech_setup_' + SUFFIX,
                    name: 'Technician Setup',
                    email: 'tech_setup_' + SUFFIX + '@example.org',
                    password: 'hash',
                    role: 'LAB_TECHNICIAN',
                    labId: labSetup.id,
                    isActive: true
                }
            });

            const sampleInSetup = await prisma.sample.create({
                data: {
                    id: 'smp-setup-' + SUFFIX,
                    originalId: 'smp-setup-' + SUFFIX,
                    labId: labSetup.id,
                    assignedLab: labSetup.id,
                    status: 'EXPECTED'
                }
            });

            const workInSetup = await prisma.workItem.create({
                data: {
                    id: 'wi-setup-' + SUFFIX,
                    sampleId: sampleInSetup.id,
                    labId: labSetup.id,
                    analysis: 'PH_H2O',
                    status: 'ASSIGNED',
                    assignedTo: techSetup.username
                }
            });

            const res = await request(app)
                .post('/api/work/assign')
                .set('Authorization', `Bearer ${tokenSA}`)
                .send({
                    workItemIds: [workInSetup.id],
                    assignee: techSetup.username
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('LAB_PAUSED');

            await prisma.workItem.delete({ where: { id: workInSetup.id } });
            await prisma.sample.delete({ where: { id: sampleInSetup.id } });
            await prisma.user.delete({ where: { id: techSetup.id } });
        });

        test('Pending manager redeems invitation token in SETUP lab to create active account', async () => {
            const consumed = await staffLifecycleService.consumeInvitation(setupInviteToken, {
                username: `setup_mgr_${SUFFIX}`.toLowerCase(),
                password: 'SecurePassword123!'
            });

            expect(consumed.username).toBe(`setup_mgr_${SUFFIX}`.toLowerCase());
            expect(consumed.role).toBe('LAB_MANAGER');
            expect(consumed.labId).toBe(labSetup.id);
            expect(consumed.isActive).toBe(true);

            // Cleanup created user
            await prisma.user.delete({ where: { id: consumed.id } });
        });
    });

    describe('3. F03 & F04: Workspace Scoping & Workload Pipeline Math', () => {
        beforeAll(async () => {
            // Create a junction-only servicing project
            await prisma.project.create({
                data: {
                    id: 'prj-junc-' + SUFFIX,
                    code: 'PRJ-JUNC-' + SUFFIX,
                    name: 'Junction Servicing Project ' + SUFFIX,
                    status: 'ACTIVE',
                    labId: labFRA.id,
                    assignedLabIds: '[]'
                }
            });

            await prisma.projectLab.create({
                data: {
                    id: 'pl-junc-' + SUFFIX,
                    projectCode: 'PRJ-JUNC-' + SUFFIX,
                    labId: labGTM.id,
                    role: 'SERVICING'
                }
            });

            // Create mixed sample states in labGTM
            await prisma.sample.createMany({
                data: [
                    { id: 'smp-exp-' + SUFFIX, originalId: 'exp-' + SUFFIX, labId: labGTM.id, assignedLab: labGTM.id, status: 'EXPECTED' },
                    { id: 'smp-rel-' + SUFFIX, originalId: 'rel-' + SUFFIX, labId: labGTM.id, assignedLab: labGTM.id, status: 'RELEASED' },
                    { id: 'smp-app-' + SUFFIX, originalId: 'app-' + SUFFIX, labId: labGTM.id, assignedLab: labGTM.id, status: 'APPROVED' },
                    { id: 'smp-rec-' + SUFFIX, originalId: 'rec-' + SUFFIX, labId: labGTM.id, assignedLab: labGTM.id, status: 'RECEIVED' },
                    { id: 'smp-ana-' + SUFFIX, originalId: 'ana-' + SUFFIX, labId: labGTM.id, assignedLab: labGTM.id, status: 'IN_ANALYSIS' }
                ]
            });
        });

        test('F03: Junction-only servicing project appears in laboratory workspace', async () => {
            const res = await request(app)
                .get(`/api/labs/${labGTM.id}/workspace`)
                .set('Authorization', `Bearer ${tokenMgrGTM}`);

            expect(res.status).toBe(200);
            const projectCodes = (res.body.projects || []).map(p => p.code);
            expect(projectCodes).toContain('PRJ-JUNC-' + SUFFIX);
        });

        test('F04: Workload excludes EXPECTED, RELEASED, and APPROVED from active analytical work', async () => {
            const res = await request(app)
                .get(`/api/labs/${labGTM.id}/workspace`)
                .set('Authorization', `Bearer ${tokenMgrGTM}`);

            expect(res.status).toBe(200);
            const { samples } = res.body.workload;
            // 2 active samples: RECEIVED and IN_ANALYSIS
            expect(samples.active).toBe(2);
            expect(samples.expected).toBeGreaterThanOrEqual(1);
            expect(samples.released).toBeGreaterThanOrEqual(2); // RELEASED + APPROVED
        });
    });

    describe('4. F05: Unfinished Work Accounting Across Canonical Lifecycle', () => {
        let inworkSample;

        beforeAll(async () => {
            inworkSample = await prisma.sample.create({
                data: {
                    id: 'smp-unfin-' + SUFFIX,
                    originalId: 'unfin-' + SUFFIX,
                    labId: labGTM.id,
                    assignedLab: labGTM.id,
                    status: 'ACCEPTED'
                }
            });
        });

        test('F05: Access preview accounts for SUBMITTED work awaiting review', async () => {
            const wi = await prisma.workItem.create({
                data: {
                    id: 'wi-sub-' + SUFFIX,
                    sampleId: inworkSample.id,
                    analysis: 'PH_H2O',
                    labId: labGTM.id,
                    assignedLab: labGTM.id,
                    assignedTo: techGTM.username,
                    status: 'SUBMITTED'
                }
            });

            const res = await request(app)
                .post(`/api/users/${techGTM.id}/access-preview`)
                .set('Authorization', `Bearer ${tokenMgrGTM}`)
                .send({ role: 'VIEWER' });

            expect(res.status).toBe(200);
            expect(res.body.openAssignmentsCount).toBeGreaterThanOrEqual(1);

            await prisma.workItem.delete({ where: { id: wi.id } });
        });

        test('Access preview accounts for RETURNED work needing rework', async () => {
            const wi = await prisma.workItem.create({
                data: {
                    id: 'wi-ret-' + SUFFIX,
                    sampleId: inworkSample.id,
                    analysis: 'PH_H2O',
                    labId: labGTM.id,
                    assignedLab: labGTM.id,
                    assignedTo: techGTM.username,
                    status: 'RETURNED'
                }
            });

            const res = await request(app)
                .post(`/api/users/${techGTM.id}/access-preview`)
                .set('Authorization', `Bearer ${tokenMgrGTM}`)
                .send({ role: 'VIEWER' });

            expect(res.status).toBe(200);
            expect(res.body.openAssignmentsCount).toBeGreaterThanOrEqual(1);

            await prisma.workItem.delete({ where: { id: wi.id } });
        });

        test('Access preview accounts for COMPLETED results without submission (unsubmitted bench work)', async () => {
            const wi = await prisma.workItem.create({
                data: {
                    id: 'wi-comp-unsub-' + SUFFIX,
                    sampleId: inworkSample.id,
                    analysis: 'PH_H2O',
                    labId: labGTM.id,
                    assignedLab: labGTM.id,
                    assignedTo: techGTM.username,
                    status: 'COMPLETED',
                    submissionId: null
                }
            });

            const res = await request(app)
                .post(`/api/users/${techGTM.id}/access-preview`)
                .set('Authorization', `Bearer ${tokenMgrGTM}`)
                .send({ role: 'VIEWER' });

            expect(res.status).toBe(200);
            expect(res.body.openAssignmentsCount).toBeGreaterThanOrEqual(1);

            await prisma.workItem.delete({ where: { id: wi.id } });
        });
    });

    describe('5. F06 & F07: Legacy Token Version Handling & WebSocket Revocation', () => {
        test('F06: Revoked legacy JWT without tokenVersion claim is rejected by HTTP and SIS', async () => {
            const legacyToken = jwt.sign(
                { id: superAdmin.id, username: superAdmin.username, role: superAdmin.role },
                JWT_SECRET,
                { expiresIn: '1h' }
            );

            // Increment tokenVersion in DB to invalidate older/legacy tokens
            await prisma.user.update({
                where: { id: superAdmin.id },
                data: { tokenVersion: { increment: 1 } }
            });

            const httpRes = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${legacyToken}`);
            expect(httpRes.status).toBe(401);

            const sisRes = await request(app)
                .get('/api/v1/sis/samples')
                .set('Authorization', `Bearer ${legacyToken}`);
            expect(sisRes.status).toBe(401);
        });

        test('F07: Account suspension closes active WebSocket connection and prevents receiving lab broadcasts', async () => {
            // Spin up an actual HTTP server and wsServer
            const server = app.listen(0, '127.0.0.1');
            await new Promise(resolve => server.once('listening', resolve));
            const port = server.address().port;
            wsServer.init(server);

            // Re-fetch tech user and create current valid token
            const curTech = await prisma.user.findUnique({ where: { id: techGTM.id } });
            const techWsToken = jwt.sign(
                { id: curTech.id, username: curTech.username, role: curTech.role, tokenVersion: curTech.tokenVersion },
                JWT_SECRET,
                { expiresIn: '1h' }
            );

            const socket = new WS(`ws://127.0.0.1:${port}/ws`, [techWsToken]);
            await new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('WebSocket connection timeout')), 3000);
                socket.on('message', m => {
                    if (JSON.parse(m).type === 'CONNECTED') {
                        clearTimeout(timer);
                        resolve();
                    }
                });
                socket.once('error', reject);
            });

            let receivedAfterSuspend = false;
            socket.on('message', m => {
                if (JSON.parse(m).type === 'TEST_POST_SUSPEND_PING') {
                    receivedAfterSuspend = true;
                }
            });

            // Suspend user via API
            const suspendRes = await request(app)
                .post(`/api/users/${techGTM.id}/suspend`)
                .set('Authorization', `Bearer ${tokenMgrGTM}`)
                .send({ reason: 'Governance verification' });

            expect(suspendRes.status).toBe(200);

            // Broadcast an event to labGTM
            wsServer.broadcastToLab(labGTM.id, 'TEST_POST_SUSPEND_PING', { test: true });
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(receivedAfterSuspend).toBe(false);
            expect(socket.readyState).not.toBe(WS.OPEN);

            socket.terminate();
            await new Promise(resolve => server.close(resolve));
        });

        test('Outer transaction rollback safety: failed transaction does not revoke sockets prematurely and preserves DB state', async () => {
            const rollbackTarget = await prisma.user.create({
                data: {
                    id: 'usr-rollback-' + SUFFIX,
                    username: 'rollback_' + SUFFIX,
                    name: 'Rollback Target Staff',
                    email: 'rollback_' + SUFFIX + '@example.org',
                    password: 'hash',
                    role: 'LAB_TECHNICIAN',
                    labId: labGTM.id,
                    isActive: true,
                    tokenVersion: 1
                }
            });

            const revokedUids = [];
            const origRevoke = wsServer.revokeUserSockets;
            wsServer.revokeUserSockets = (uid) => {
                revokedUids.push(uid);
                return origRevoke(uid);
            };

            try {
                let txError = null;
                try {
                    await staffLifecycleService.withTransaction(async (tx) => {
                        await staffLifecycleService.suspendUser(superAdmin, rollbackTarget.id, { reason: 'Test rollback' }, tx);
                        throw new Error('Simulated outer transaction rollback');
                    });
                } catch (err) {
                    txError = err;
                }

                expect(txError).toBeDefined();
                expect(txError.message).toBe('Simulated outer transaction rollback');

                // In outer transaction mode, aborted transaction must NOT call revokeUserSockets for real target ID
                expect(revokedUids.includes(rollbackTarget.id)).toBe(false);

                // Target user state in database must be completely unchanged
                const freshTarget = await prisma.user.findUnique({ where: { id: rollbackTarget.id } });
                expect(freshTarget.isActive).toBe(true);
                expect(freshTarget.tokenVersion).toBe(1);
            } finally {
                wsServer.revokeUserSockets = origRevoke;
            }
        });

        test('Outer transaction contract: unsupported outer transaction without afterCommit fails closed', async () => {
            const contractTarget = await prisma.user.create({
                data: {
                    id: 'usr-contract-' + SUFFIX,
                    username: 'contract_' + SUFFIX,
                    name: 'Contract Target Staff',
                    email: 'contract_' + SUFFIX + '@example.org',
                    password: 'hash',
                    role: 'LAB_TECHNICIAN',
                    labId: labGTM.id,
                    isActive: true,
                    tokenVersion: 1
                }
            });

            let errorThrown = null;
            await prisma.$transaction(async (rawTx) => {
                try {
                    await staffLifecycleService.suspendUser(superAdmin, contractTarget.id, { reason: 'Raw tx without afterCommit' }, rawTx);
                } catch (err) {
                    errorThrown = err;
                    throw err;
                }
            }).catch(() => {});

            expect(errorThrown).toBeDefined();
            expect(errorThrown.code).toBe('UNSUPPORTED_TRANSACTION_CONTRACT');

            const freshContractTarget = await prisma.user.findUnique({ where: { id: contractTarget.id } });
            expect(freshContractTarget.isActive).toBe(true);
            expect(freshContractTarget.tokenVersion).toBe(1);
        });

        test('Outer transaction commit: successful outer commit revokes established socket after commit', async () => {
            const commitTarget = await prisma.user.create({
                data: {
                    id: 'usr-commit-' + SUFFIX,
                    username: 'commit_' + SUFFIX,
                    name: 'Commit Target Staff',
                    email: 'commit_' + SUFFIX + '@example.org',
                    password: 'hash',
                    role: 'LAB_TECHNICIAN',
                    labId: labGTM.id,
                    isActive: true,
                    tokenVersion: 1
                }
            });

            const commitWsToken = jwt.sign(
                { id: commitTarget.id, username: commitTarget.username, role: commitTarget.role, tokenVersion: commitTarget.tokenVersion },
                JWT_SECRET,
                { expiresIn: '1h' }
            );

            const server = app.listen(0, '127.0.0.1');
            await new Promise(resolve => server.once('listening', resolve));
            const port = server.address().port;
            wsServer.init(server);

            const socket = new WS(`ws://127.0.0.1:${port}/ws`, [commitWsToken]);
            await new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('WebSocket connection timeout')), 3000);
                socket.on('message', m => {
                    if (JSON.parse(m).type === 'CONNECTED') {
                        clearTimeout(timer);
                        resolve();
                    }
                });
                socket.once('error', reject);
            });
            expect(socket.readyState).toBe(WS.OPEN);

            let revokedDuringTx = false;
            let revokedAfterTx = false;
            const origRevoke = wsServer.revokeUserSockets;
            wsServer.revokeUserSockets = (uid) => {
                if (uid === commitTarget.id) {
                    revokedAfterTx = true;
                }
                return origRevoke(uid);
            };

            try {
                await staffLifecycleService.withTransaction(async (tx) => {
                    await staffLifecycleService.suspendUser(superAdmin, commitTarget.id, { reason: 'Successful outer tx' }, tx);
                    // Inside transaction before commit: revocation must NOT have run yet
                    expect(revokedAfterTx).toBe(false);
                    expect(socket.readyState).toBe(WS.OPEN);
                });

                // After commit, revocation was executed
                expect(revokedAfterTx).toBe(true);

                // Allow async socket close to propagate
                await new Promise(resolve => setTimeout(resolve, 100));
                expect(socket.readyState).not.toBe(WS.OPEN);

                // Database state reflects committed changes
                const freshCommitTarget = await prisma.user.findUnique({ where: { id: commitTarget.id } });
                expect(freshCommitTarget.isActive).toBe(false);
                expect(freshCommitTarget.tokenVersion).toBe(2);
            } finally {
                wsServer.revokeUserSockets = origRevoke;
                socket.terminate();
                await new Promise(resolve => server.close(resolve));
            }
        });
    });
});
