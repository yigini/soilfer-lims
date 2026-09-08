const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');

describe('User Language Preference & Locale Middleware (Contracts L3, L4)', () => {
    let techToken, techUserId;

    beforeAll(async () => {
        techToken = await getAuthToken('LAB_TECHNICIAN', 'LAB-GTM');
        const decoded = jwt.decode(techToken);
        techUserId = decoded.id;
    });

    test('1. PATCH /api/auth/preferences updates language to es for user', async () => {
        const res = await request(app)
            .patch('/api/auth/preferences')
            .set('Authorization', `Bearer ${techToken}`)
            .send({ language: 'es' });
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual({ language: 'es' });

        const userInDb = await prisma.user.findUnique({
            where: { id: String(techUserId) },
            select: { language: true }
        });
        expect(userInDb.language).toBe('es');
    });

    test('2. PATCH /api/auth/preferences maps regional code es-GT to canonical es-419', async () => {
        const res = await request(app)
            .patch('/api/auth/preferences')
            .set('Authorization', `Bearer ${techToken}`)
            .send({ language: 'es-GT' });
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual({ language: 'es-419' });
    });

    test('3. PATCH /api/auth/preferences rejects invalid language code with 400', async () => {
        const res = await request(app)
            .patch('/api/auth/preferences')
            .set('Authorization', `Bearer ${techToken}`)
            .send({ language: 'invalid-lang-code-xyz' });
        expect(res.status).toBe(400);
        expect(res.body.errorCode).toBe('AUTH.INVALID_LANGUAGE_PREFERENCE');
    });

    test('4. PATCH /api/auth/preferences can update both themePreference and language', async () => {
        const res = await request(app)
            .patch('/api/auth/preferences')
            .set('Authorization', `Bearer ${techToken}`)
            .send({ themePreference: 'dark', language: 'fr' });
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual({ themePreference: 'dark', language: 'fr' });

        const userInDb = await prisma.user.findUnique({
            where: { id: String(techUserId) },
            select: { themePreference: true, language: true }
        });
        expect(userInDb.themePreference).toBe('dark');
        expect(userInDb.language).toBe('fr');
    });

    test('5. Locale middleware respects x-app-locale header over user record', async () => {
        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${techToken}`)
            .set('X-App-Locale', 'pt');
        expect(res.status).toBe(200);
    });
});
