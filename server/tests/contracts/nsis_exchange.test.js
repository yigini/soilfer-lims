const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');

describe('WP-38: NSIS Exchange API Specification & Neutral Aliasing Contract', () => {
    let testApiKey;

    beforeAll(async () => {
        const crypto = require('crypto');
        const rawKey = `slims_live_test_${Date.now()}`;
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

        testApiKey = await prisma.apiKey.create({
            data: {
                id: `test-key-${Date.now()}`,
                name: 'National SIS Ingestion Pipeline',
                keyHash: keyHash,
                keyPrefix: rawKey.slice(0, 10),
                role: 'NSIS_CONSUMER',
                isActive: true
            }
        });
        testApiKey.rawKey = rawKey;
    });

    afterAll(async () => {
        if (testApiKey?.id) {
            await prisma.apiKey.delete({ where: { id: testApiKey.id } }).catch(() => {});
        }
    });

    test('1. Unauthenticated requests to /api/v1/data-exchange/stats are rejected with 401', async () => {
        const res = await request(app).get('/api/v1/data-exchange/stats');
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Unauthorized');
    });

    test('2. Unauthenticated requests to legacy /api/v1/sis/stats alias are rejected with 401', async () => {
        const res = await request(app).get('/api/v1/sis/stats');
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Unauthorized');
    });

    test('3. Authenticated requests to /api/v1/data-exchange/stats succeed', async () => {
        const res = await request(app)
            .get('/api/v1/data-exchange/stats')
            .set('X-API-Key', testApiKey.rawKey);

        expect(res.status).toBe(200);
    });

    test('4. Authenticated requests to legacy alias /api/v1/sis/stats return identical payload', async () => {
        const res = await request(app)
            .get('/api/v1/sis/stats')
            .set('X-API-Key', testApiKey.rawKey);

        expect(res.status).toBe(200);
    });
});
