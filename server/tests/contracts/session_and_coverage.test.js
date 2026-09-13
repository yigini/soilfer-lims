const request = require('supertest');
const jwt = require('jsonwebtoken');
const WS = require('ws');
const app = require('../../app');
const prisma = require('../../prisma');
const wsServer = require('../../wsServer');
const { JWT_SECRET } = require('../../config/auth');
const labLifecycleService = require('../../services/labLifecycleService');

describe('Session and Coverage Contract Tests (S01-S03, P01, C02)', () => {
    const SUFFIX = 'SC-' + Date.now();
    let testLab;
    let superAdmin;
    let supportActor;
    let targetUser;
    let resetUser;
    let tokenAdmin;
    let tokenTarget;
    let tokenReset;

    beforeAll(async () => {
        testLab = await prisma.lab.create({
            data: {
                id: 'lab-sc-' + SUFFIX,
                code: 'LAB-SC-' + SUFFIX,
                name: 'Session Coverage Test Lab',
                country: 'Guatemala',
                isActive: true,
                timezone: 'UTC'
            }
        });

        superAdmin = await prisma.user.create({
            data: {
                id: 'usr-admin-' + SUFFIX,
                username: 'admin_' + SUFFIX,
                email: 'admin_' + SUFFIX + '@example.org',
                password: 'hash',
                role: 'SUPER_ADMIN',
                isActive: true,
                tokenVersion: 1
            }
        });

        supportActor = await prisma.user.create({
            data: {
                id: 'usr-actor-' + SUFFIX,
                username: 'actor_' + SUFFIX,
                email: 'actor_' + SUFFIX + '@example.org',
                password: 'hash',
                role: 'SUPER_ADMIN',
                isActive: true,
                tokenVersion: 1
            }
        });

        targetUser = await prisma.user.create({
            data: {
                id: 'usr-target-' + SUFFIX,
                username: 'target_' + SUFFIX,
                email: 'target_' + SUFFIX + '@example.org',
                password: 'hash',
                role: 'LAB_TECHNICIAN',
                labId: testLab.id,
                isActive: true,
                tokenVersion: 1
            }
        });

        resetUser = await prisma.user.create({
            data: {
                id: 'usr-reset-' + SUFFIX,
                username: 'reset_' + SUFFIX,
                email: 'reset_' + SUFFIX + '@example.org',
                password: 'hash',
                role: 'LAB_MANAGER',
                labId: testLab.id,
                isActive: true,
                tokenVersion: 1,
                mustChangePassword: true
            }
        });

        tokenAdmin = jwt.sign({ id: superAdmin.id, username: superAdmin.username, role: superAdmin.role, tokenVersion: 1 }, JWT_SECRET, { expiresIn: '1h' });
        tokenTarget = jwt.sign({ id: targetUser.id, username: targetUser.username, role: targetUser.role, tokenVersion: 1 }, JWT_SECRET, { expiresIn: '1h' });
        tokenReset = jwt.sign({ id: resetUser.id, username: resetUser.username, role: resetUser.role, tokenVersion: 1 }, JWT_SECRET, { expiresIn: '1h' });
    });

    afterAll(async () => {
        await wsServer.close();
        try {
            await prisma.auditLog.deleteMany({ where: { labId: testLab.id } });
            await prisma.user.deleteMany({ where: { labId: testLab.id } });
            await prisma.user.deleteMany({ where: { id: { in: [superAdmin.id, supportActor.id] } } });
            await prisma.lab.deleteMany({ where: { id: testLab.id } });
        } catch (e) {}
    });

    afterEach(async () => {
        await wsServer.close();
    });

    describe('S01: mustChangePassword Enforcement Across Channels', () => {
        test('blocks operational HTTP requests with 403 PASSWORD_CHANGE_REQUIRED', async () => {
            const res = await request(app)
                .get('/api/labs')
                .set('Authorization', `Bearer ${tokenReset}`);
            expect(res.status).toBe(403);
            expect(res.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
        });

        test('blocks SIS API access with 403 PASSWORD_CHANGE_REQUIRED', async () => {
            const res = await request(app)
                .get('/api/v1/sis/samples')
                .set('Authorization', `Bearer ${tokenReset}`);
            expect(res.status).toBe(403);
            expect(res.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
        });

        test('allows auth endpoints (/api/auth/me)', async () => {
            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${tokenReset}`);
            expect(res.status).toBe(200);
            expect(res.body.mustChangePassword).toBe(true);
        });

        test('rejects WebSocket connection with close code 4005', async () => {
            const server = app.listen(0, '127.0.0.1');
            await new Promise(resolve => server.once('listening', resolve));
            const port = server.address().port;
            wsServer.init(server);

            const socket = new WS(`ws://127.0.0.1:${port}/ws`, [tokenReset]);
            const closeCode = await new Promise(resolve => {
                socket.once('close', code => resolve(code));
                socket.once('error', () => resolve('error'));
            });

            expect(closeCode).toBe(4005);
            socket.terminate();
            await wsServer.close();
            await new Promise(resolve => server.close(resolve));
        });
    });

    describe('S02, S03 & C02: Impersonation Actor Lifecycle & Revocation', () => {
        test('C02: Impersonation token works on HTTP and WS while support actor is active', async () => {
            const supportToken = jwt.sign(
                {
                    id: targetUser.id,
                    username: targetUser.username,
                    role: targetUser.role,
                    tokenVersion: targetUser.tokenVersion,
                    act: { id: supportActor.id, username: supportActor.username, tokenVersion: supportActor.tokenVersion }
                },
                JWT_SECRET,
                { expiresIn: '30m' }
            );

            // HTTP
            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${supportToken}`);
            expect(res.status).toBe(200);
            expect(res.body.isImpersonated).toBe(true);

            // WS
            const server = app.listen(0, '127.0.0.1');
            await new Promise(resolve => server.once('listening', resolve));
            const port = server.address().port;
            wsServer.init(server);

            const socket = new WS(`ws://127.0.0.1:${port}/ws`, [supportToken]);
            const connected = await new Promise(resolve => {
                const timer = setTimeout(() => resolve(false), 2000);
                socket.on('message', m => {
                    if (JSON.parse(m).type === 'CONNECTED') {
                        clearTimeout(timer);
                        resolve(true);
                    }
                });
                socket.once('close', () => resolve(false));
                socket.once('error', () => resolve(false));
            });

            expect(connected).toBe(true);
            socket.terminate();
            await wsServer.close();
            await new Promise(resolve => server.close(resolve));
        });

        test('S02 & S03: Actor suspension invalidates token on HTTP/SIS and revokes established socket', async () => {
            const supportToken = jwt.sign(
                {
                    id: targetUser.id,
                    username: targetUser.username,
                    role: targetUser.role,
                    tokenVersion: targetUser.tokenVersion,
                    act: { id: supportActor.id, username: supportActor.username, tokenVersion: supportActor.tokenVersion }
                },
                JWT_SECRET,
                { expiresIn: '30m' }
            );

            const server = app.listen(0, '127.0.0.1');
            await new Promise(resolve => server.once('listening', resolve));
            const port = server.address().port;
            wsServer.init(server);

            const socket = new WS(`ws://127.0.0.1:${port}/ws`, [supportToken]);
            await new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('Connection timeout')), 3000);
                socket.on('message', m => {
                    if (JSON.parse(m).type === 'CONNECTED') {
                        clearTimeout(timer);
                        resolve();
                    }
                });
                socket.once('error', reject);
            });

            let receivedAfterActorSuspended = false;
            socket.on('message', m => {
                if (JSON.parse(m).type === 'COVER_ACTOR_PING') receivedAfterActorSuspended = true;
            });

            // Suspend the support administrator actor
            const suspendRes = await request(app)
                .post(`/api/users/${supportActor.id}/suspend`)
                .set('Authorization', `Bearer ${tokenAdmin}`)
                .send({ reason: 'Actor suspended by governance' });
            expect(suspendRes.status).toBe(200);

            // Broadcast to lab
            wsServer.broadcastToLab(testLab.id, 'COVER_ACTOR_PING', { test: true });
            await new Promise(resolve => setTimeout(resolve, 100));

            // S03: Established socket must be closed and receive no messages
            expect(receivedAfterActorSuspended).toBe(false);
            expect(socket.readyState).not.toBe(WS.OPEN);

            // S02: Future requests with supportToken rejected across all channels
            const httpRes = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${supportToken}`);
            expect(httpRes.status).toBe(401);

            const sisRes = await request(app)
                .get('/api/v1/sis/samples')
                .set('Authorization', `Bearer ${supportToken}`);
            expect(sisRes.status).toBe(401);

            // S02: New WebSocket rejected
            const newSocket = new WS(`ws://127.0.0.1:${port}/ws`, [supportToken]);
            const newClosed = await new Promise(resolve => {
                newSocket.once('close', code => resolve(code));
                newSocket.once('error', () => resolve('error'));
            });
            expect(newClosed).toBe(4003);

            socket.terminate();
            newSocket.terminate();
            await wsServer.close();
            await new Promise(resolve => server.close(resolve));
        });
    });

    describe('P01: Workspace Staff Bounding & Pagination', () => {
        const ROSTER_COUNT = 105;

        beforeAll(async () => {
            const rosterData = Array.from({ length: ROSTER_COUNT }, (_, i) => ({
                id: `usr-roster-${SUFFIX}-${i}`,
                username: `roster_${SUFFIX}_${i}`,
                email: `roster_${SUFFIX}_${i}@example.org`,
                password: 'hash',
                role: 'LAB_TECHNICIAN',
                labId: testLab.id,
                isActive: true
            }));
            await prisma.user.createMany({ data: rosterData });
        });

        test('returns bounded page of staff with pagination metadata', async () => {
            const res = await request(app)
                .get(`/api/labs/${testLab.id}/workspace?page=1&limit=25`)
                .set('Authorization', `Bearer ${tokenAdmin}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.staff)).toBe(true);
            expect(res.body.staff.length).toBe(25);
            expect(res.body.pagination).toBeDefined();
            expect(res.body.pagination.page).toBe(1);
            expect(res.body.pagination.limit).toBe(25);
            expect(res.body.pagination.total).toBeGreaterThanOrEqual(ROSTER_COUNT);
            expect(res.body.staffPagination).toEqual(res.body.pagination);
        });

        test('clamps limit to maximum of 100', async () => {
            const res = await request(app)
                .get(`/api/labs/${testLab.id}/workspace?page=1&limit=500`)
                .set('Authorization', `Bearer ${tokenAdmin}`);

            expect(res.status).toBe(200);
            expect(res.body.staff.length).toBeLessThanOrEqual(100);
            expect(res.body.pagination.limit).toBe(100);
        });
    });
});
