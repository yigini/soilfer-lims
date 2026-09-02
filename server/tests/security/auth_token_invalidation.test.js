const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const bcrypt = require('bcryptjs');

describe('WP-10: Token Invalidation on Password Change', () => {
    let testUser;

    beforeAll(async () => {
        const hashedPassword = await bcrypt.hash('initialPassword123', 10);
        testUser = await prisma.user.upsert({
            where: { username: 'test_token_invalidation_user' },
            update: { password: hashedPassword, tokenVersion: 0, isActive: true },
            create: {
                id: 'USR-TEST-TOKEN-INV',
                username: 'test_token_invalidation_user',
                email: 'test_token_inv@soilfer.org',
                password: hashedPassword,
                role: 'LAB_TECHNICIAN',
                labId: 'GTM-LAB1',
                tokenVersion: 0,
                isActive: true
            }
        });
    });

    test('Old token is immediately rejected after changing password', async () => {
        // 1. Log in to get initial token
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({
                username: 'test_token_invalidation_user',
                password: 'initialPassword123'
            });

        expect(loginRes.status).toBe(200);
        const oldToken = loginRes.body.token;
        expect(oldToken).toBeDefined();

        // 2. Token works initially
        const meResBefore = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${oldToken}`);
        expect(meResBefore.status).toBe(200);

        // 3. Change password using old token
        const changeRes = await request(app)
            .post('/api/auth/change-password')
            .set('Authorization', `Bearer ${oldToken}`)
            .send({
                currentPassword: 'initialPassword123',
                newPassword: 'newSecretPassword456'
            });

        expect(changeRes.status).toBe(200);
        const newToken = changeRes.body.token;
        expect(newToken).toBeDefined();

        // 4. Old token MUST now be rejected with 401
        const meResAfterOld = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${oldToken}`);
        expect(meResAfterOld.status).toBe(401);
        expect(meResAfterOld.body.error).toBe('SESSION_INVALIDATED');

        // 5. New token works
        const meResAfterNew = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${newToken}`);
        expect(meResAfterNew.status).toBe(200);
    });
});
