/**
 * Contract Tests: Laboratory Directory Policy, Scoped Authorization & Auth Profile Resolution (#114)
 *
 * Verifies:
 * 1. Configured laboratory: login and /api/auth/me populate user.lab and user.labLocation from database.
 * 2. Unconfigured laboratory (location null): login and /api/auth/me safely return null without fallback claims.
 * 3. Unassigned user (labId null): login and /api/auth/me return null lab and labLocation.
 * 4. GET /api/labs/:id directory policy: returns public directory fields, excludes sensitive operational data,
 *    and requires authentication (401 on unauthenticated).
 * 5. Scoped authorization distinction: calling GET /api/labs/:id for another lab succeeds (directory lookup),
 *    while accessing its operational workspace (GET /api/labs/:id/workspace) is strictly rejected (403 Forbidden).
 */

'use strict';

const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const bcrypt = require('bcryptjs');

describe('Lab Directory Policy & Auth Profile Contract (#114)', () => {
    const SUFFIX = 'LAB_AUTH_' + Date.now();
    const labConfiguredId = 'LAB-CFG-' + SUFFIX;
    const labUnconfiguredId = 'LAB-UNCFG-' + SUFFIX;
    const labOtherId = 'LAB-OTHER-' + SUFFIX;

    let userConfigured;
    let userUnconfigured;
    let userUnassigned;

    let tokenConfigured;
    let tokenUnconfigured;
    let tokenUnassigned;

    const testPassword = 'Password123!';

    beforeAll(async () => {
        const hashedPassword = await bcrypt.hash(testPassword, 10);

        // 1. Create configured lab with valid location string
        await prisma.lab.create({
            data: {
                id: labConfiguredId,
                code: 'CFG1',
                name: 'Lusaka Central Laboratory',
                country: 'Zambia',
                city: 'Lusaka',
                location: '-15.4167, 28.2833',
                isActive: true
            }
        });

        // 2. Create unconfigured lab (location null)
        await prisma.lab.create({
            data: {
                id: labUnconfiguredId,
                code: 'UNCF',
                name: 'Solwezi Field Station',
                country: 'Zambia',
                city: 'Solwezi',
                location: null,
                isActive: true
            }
        });

        // 3. Create another lab for cross-lab authorization boundary testing
        await prisma.lab.create({
            data: {
                id: labOtherId,
                code: 'OTH1',
                name: 'Ndola Regional Laboratory',
                country: 'Zambia',
                city: 'Ndola',
                location: '-12.9667, 28.6333',
                isActive: true
            }
        });

        const { randomUUID } = require('crypto');

        // Create user with configured lab
        userConfigured = await prisma.user.create({
            data: {
                id: randomUUID(),
                username: 'tech_configured_' + SUFFIX,
                email: 'tech_cfg_' + SUFFIX + '@example.com',
                password: hashedPassword,
                role: 'SAMPLE_RECEPTION',
                labId: labConfiguredId,
                isActive: true
            }
        });

        // Create user with unconfigured lab
        userUnconfigured = await prisma.user.create({
            data: {
                id: randomUUID(),
                username: 'tech_unconfigured_' + SUFFIX,
                email: 'tech_uncfg_' + SUFFIX + '@example.com',
                password: hashedPassword,
                role: 'SAMPLE_RECEPTION',
                labId: labUnconfiguredId,
                isActive: true
            }
        });

        // Create user without lab
        userUnassigned = await prisma.user.create({
            data: {
                id: randomUUID(),
                username: 'analyst_unassigned_' + SUFFIX,
                email: 'analyst_unassigned_' + SUFFIX + '@example.com',
                password: hashedPassword,
                role: 'ANALYST',
                labId: null,
                isActive: true
            }
        });
    });

    afterAll(async () => {
        try {
            await prisma.user.deleteMany({
                where: {
                    id: { in: [userConfigured.id, userUnconfigured.id, userUnassigned.id] }
                }
            });
            await prisma.lab.deleteMany({
                where: {
                    id: { in: [labConfiguredId, labUnconfiguredId, labOtherId] }
                }
            });
            await prisma.$disconnect();
        } catch (_) {}
    });

    test('1. Login and /api/auth/me populate user.lab and user.labLocation for configured lab', async () => {
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ username: userConfigured.username, password: testPassword });

        expect(loginRes.status).toBe(200);
        expect(loginRes.body.token).toBeDefined();
        tokenConfigured = loginRes.body.token;

        const user = loginRes.body.user;
        expect(user).toBeDefined();
        expect(user.labId).toBe(labConfiguredId);
        expect(user.lab).toBeDefined();
        expect(user.lab.id).toBe(labConfiguredId);
        expect(user.lab.location).toBe('-15.4167, 28.2833');
        expect(user.labLocation).toBe('-15.4167, 28.2833');

        // Verify /api/auth/me returns identical verified profile
        const meRes = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${tokenConfigured}`);

        expect(meRes.status).toBe(200);
        expect(meRes.body.lab).toBeDefined();
        expect(meRes.body.lab.id).toBe(labConfiguredId);
        expect(meRes.body.lab.location).toBe('-15.4167, 28.2833');
        expect(meRes.body.labLocation).toBe('-15.4167, 28.2833');
    });

    test('2. Login and /api/auth/me return null lab location for unconfigured lab', async () => {
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ username: userUnconfigured.username, password: testPassword });

        expect(loginRes.status).toBe(200);
        tokenUnconfigured = loginRes.body.token;

        const user = loginRes.body.user;
        expect(user.labId).toBe(labUnconfiguredId);
        expect(user.lab).toBeDefined();
        expect(user.lab.location).toBeNull();
        expect(user.labLocation).toBeNull();

        const meRes = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${tokenUnconfigured}`);

        expect(meRes.status).toBe(200);
        expect(meRes.body.lab).toBeDefined();
        expect(meRes.body.lab.location).toBeNull();
        expect(meRes.body.labLocation).toBeNull();
    });

    test('3. Login and /api/auth/me return null lab and labLocation for unassigned user', async () => {
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ username: userUnassigned.username, password: testPassword });

        expect(loginRes.status).toBe(200);
        tokenUnassigned = loginRes.body.token;

        const user = loginRes.body.user;
        expect(user.labId).toBeNull();
        expect(user.lab).toBeNull();
        expect(user.labLocation).toBeNull();

        const meRes = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${tokenUnassigned}`);

        expect(meRes.status).toBe(200);
        expect(meRes.body.lab).toBeNull();
        expect(meRes.body.labLocation).toBeNull();
    });

    test('4. GET /api/labs/:id enforces directory policy and authentication', async () => {
        // Unauthenticated request must be rejected with 401
        const unauthRes = await request(app).get(`/api/labs/${labConfiguredId}`);
        expect(unauthRes.status).toBe(401);

        // Authenticated directory lookup returns strictly limited public directory fields
        const dirRes = await request(app)
            .get(`/api/labs/${labConfiguredId}`)
            .set('Authorization', `Bearer ${tokenConfigured}`);

        expect(dirRes.status).toBe(200);
        expect(dirRes.body).toEqual({
            id: labConfiguredId,
            code: 'CFG1',
            name: 'Lusaka Central Laboratory',
            location: '-15.4167, 28.2833',
            country: 'Zambia',
            city: 'Lusaka',
            isActive: true
        });

        // Sensitive internal fields must NOT be leaked in directory entry
        expect(dirRes.body.capacity).toBeUndefined();
        expect(dirRes.body.createdAt).toBeUndefined();
        expect(dirRes.body.updatedAt).toBeUndefined();

        // Non-existent lab returns 404
        const missingRes = await request(app)
            .get('/api/labs/LAB-DOES-NOT-EXIST')
            .set('Authorization', `Bearer ${tokenConfigured}`);
        expect(missingRes.status).toBe(404);
    });

    test('5. Scoped authorization: directory lookup succeeds across labs while workspace access fails closed (403)', async () => {
        // User assigned to Lab Configured calls directory lookup for Lab Other:
        // Directory access is permitted to resolve name/code/location for coordination/dispatch
        const crossDirRes = await request(app)
            .get(`/api/labs/${labOtherId}`)
            .set('Authorization', `Bearer ${tokenConfigured}`);

        expect(crossDirRes.status).toBe(200);
        expect(crossDirRes.body.name).toBe('Ndola Regional Laboratory');
        expect(crossDirRes.body.location).toBe('-12.9667, 28.6333');

        // But accessing Lab Other's operational workspace is strictly rejected with 403 Forbidden!
        // Authentication alone is NOT evidence of scoped authorization.
        const crossWorkspaceRes = await request(app)
            .get(`/api/labs/${labOtherId}/workspace`)
            .set('Authorization', `Bearer ${tokenConfigured}`);

        expect(crossWorkspaceRes.status).toBe(403);
        expect(crossWorkspaceRes.body.code).toBe('TARGET_OUTSIDE_SCOPE');
    });
});
