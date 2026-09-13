const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');
const { JWT_SECRET } = require('../../config/auth');

describe('User Theme Preference Contract & Security', () => {
    let techToken, adminToken, techUserId;

    beforeAll(async () => {
        techToken = await getAuthToken('LAB_TECHNICIAN', 'LAB-GTM');
        adminToken = await getAuthToken('SUPER_ADMIN');

        // Decode techToken to get the user ID
        const decoded = jwt.decode(techToken);
        techUserId = decoded.id;
    });

    test('1. Unauthenticated request to PATCH /api/auth/preferences is rejected with 401', async () => {
        const res = await request(app)
            .patch('/api/auth/preferences')
            .send({ themePreference: 'dark' });
        expect(res.status).toBe(401);
    });

    test('2. Default themePreference on GET /api/auth/me resolves to light', async () => {
        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${techToken}`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('themePreference');
        expect(['light', 'dark']).toContain(res.body.themePreference);
    });

    test('3. Rejects invalid theme values (e.g. system, neon, numbers) with 400', async () => {
        const invalidValues = ['system', 'neon', 'blue', '', null, 123, true];
        for (const val of invalidValues) {
            const res = await request(app)
                .patch('/api/auth/preferences')
                .set('Authorization', `Bearer ${techToken}`)
                .send({ themePreference: val });
            expect(res.status).toBe(400);
            expect(res.body.errorCode).toBe('AUTH.INVALID_THEME_PREFERENCE');
        }
    });

    test('4. Rejects extra/forbidden fields (role, labId, permissions, id) with 400', async () => {
        const res = await request(app)
            .patch('/api/auth/preferences')
            .set('Authorization', `Bearer ${techToken}`)
            .send({
                themePreference: 'dark',
                role: 'SUPER_ADMIN',
                id: 'attacker-id'
            });
        expect(res.status).toBe(400);
        expect(res.body.errorCode).toBe('AUTH.INVALID_PREFERENCE_FIELDS');
    });

    test('5. Valid PATCH /api/auth/preferences updates preference to dark for req.user.id', async () => {
        const res = await request(app)
            .patch('/api/auth/preferences')
            .set('Authorization', `Bearer ${techToken}`)
            .send({ themePreference: 'dark' });
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual({ themePreference: 'dark' });

        // Confirm database persistence
        const userInDb = await prisma.user.findUnique({
            where: { id: String(techUserId) },
            select: { themePreference: true }
        });
        expect(userInDb.themePreference).toBe('dark');

        // Confirm GET /api/auth/me reflects the update
        const meRes = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${techToken}`);
        expect(meRes.status).toBe(200);
        expect(meRes.body.themePreference).toBe('dark');
    });

    test('6. Valid PATCH /api/auth/preferences updates preference back to light', async () => {
        const res = await request(app)
            .patch('/api/auth/preferences')
            .set('Authorization', `Bearer ${techToken}`)
            .send({ themePreference: 'light' });
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual({ themePreference: 'light' });

        const meRes = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${techToken}`);
        expect(meRes.status).toBe(200);
        expect(meRes.body.themePreference).toBe('light');
    });

    test('7. Impersonated token cannot modify profile preference (403 Forbidden)', async () => {
        // Mint an impersonated token for techUser with admin as actor
        const adminId = jwt.decode(adminToken).id;
        const impersonatedToken = jwt.sign(
            {
                id: techUserId,
                username: 'tech-user',
                role: 'LAB_TECHNICIAN',
                act: { id: adminId, username: 'admin' }
            },
            JWT_SECRET,
            { expiresIn: '30m' }
        );

        const res = await request(app)
            .patch('/api/auth/preferences')
            .set('Authorization', `Bearer ${impersonatedToken}`)
            .send({ themePreference: 'dark' });

        expect(res.status).toBe(403);
        expect(res.body.errorCode).toBe('AUTH.IMPERSONATION_PREFERENCE_BLOCKED');
    });
});
