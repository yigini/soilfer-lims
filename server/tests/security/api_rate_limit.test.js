const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApiRateLimiter, readApiRateLimitConfig } = require('../../middleware/apiRateLimiter');

const secret = 'synthetic-api-budget-fixture-only';
function app() {
    const mounted = express();
    mounted.set('trust proxy', 'loopback');
    mounted.use('/api', createApiRateLimiter({
        env: { API_RATE_LIMIT_USER_MAX: '3', API_RATE_LIMIT_ANON_MAX: '1' }, jwtSecret: secret
    }));
    mounted.get('/api/projects', (req, res) => res.sendStatus(200));
    return mounted;
}
function read(mounted, token, ip = '198.51.100.1') {
    const req = request(mounted).get('/api/projects').set('X-Forwarded-For', ip);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
}
function token(id, options = {}) { return jwt.sign({ id }, secret, { expiresIn: '5m', ...options }); }

test('defaults and explicit positive-integer request budgets', () => {
    expect(readApiRateLimitConfig({})).toEqual({ userMax: 3000, anonymousMax: 300, windowMs: 900000 });
    expect(readApiRateLimitConfig({ API_RATE_LIMIT_USER_MAX: '12', API_RATE_LIMIT_ANON_MAX: '2' }))
        .toMatchObject({ userMax: 12, anonymousMax: 2 });
});
test.each(['0', '-1', '1.5', '3e3', 'no', '', '9007199254740992'])(
    'invalid budget refuses startup without echoing its value (%s)', value => {
        expect(() => readApiRateLimitConfig({ API_RATE_LIMIT_USER_MAX: value })).toThrow('API_RATE_LIMIT_USER_MAX must');
        expect(() => readApiRateLimitConfig({ API_RATE_LIMIT_ANON_MAX: value })).toThrow('API_RATE_LIMIT_ANON_MAX must');
    });
test('two users on one IP have separate budgets, while renewed sessions share a user budget', async () => {
    const mounted = app(), first = token('one'), second = token('two');
    for (let i = 0; i < 3; i++) expect((await read(mounted, first)).status).toBe(200);
    const refused = await read(mounted, token('one', { jwtid: 'renewed-session' }));
    expect(refused.status).toBe(429);
    expect(refused.headers['ratelimit-limit']).toBe('3');
    expect(refused.headers['retry-after']).toBeDefined();
    expect((await read(mounted, second)).status).toBe(200);
    // The same user moving to a different IP cannot get a fresh user budget.
    expect((await read(mounted, first, '203.0.113.5')).status).toBe(429);
});
test('anonymous clients are limited by IP independently of signed-in users', async () => {
    const mounted = app();
    expect((await read(mounted)).headers['ratelimit-limit']).toBe('1');
    expect((await read(mounted)).status).toBe(429);
    expect((await read(mounted, null, '203.0.113.5')).status).toBe(200);
    expect((await read(mounted, token('one'))).status).toBe(200);
});
test.each([
    ['forged', () => jwt.sign({ id: 'claimed-user' }, 'a-different-synthetic-key')],
    ['expired', () => token('claimed-user', { expiresIn: -1 })],
    ['missing id', () => jwt.sign({ role: 'SUPER_ADMIN' }, secret)],
    ['malformed', () => 'not-a-jwt'],
    ['unsigned', () => jwt.sign({ id: 'claimed-user' }, '', { algorithm: 'none' })]
])('%s token uses the anonymous IP budget, never its claimed identity', async (_name, make) => {
    const mounted = app();
    expect((await read(mounted)).status).toBe(200);
    expect((await read(mounted, make())).status).toBe(429);
    expect((await read(mounted, token('claimed-user'))).status).toBe(200);
});
test('anonymous IPv6 clients cannot evade the default subnet bucket by changing interface bits', async () => {
    const mounted = app();
    expect((await read(mounted, null, '2001:db8:1234:5600::1')).status).toBe(200);
    expect((await read(mounted, null, '2001:db8:1234:5600::2')).status).toBe(429);
    expect((await read(mounted, null, '2001:db8:1234:5700::1')).status).toBe(200);
});
