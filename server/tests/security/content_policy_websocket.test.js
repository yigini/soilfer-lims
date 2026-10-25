const http = require('node:http');
const { randomUUID } = require('node:crypto');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const WS = require('ws');
const app = require('../../app');
const db = require('../../prisma');
const wsServer = require('../../wsServer');
const { JWT_SECRET } = require('../../config/auth');

describe('R5 content policy and WebSocket credentials', () => {
    let server, base, user, token;
    const sockets = new Set();
    beforeAll(async () => {
        const id = randomUUID();
        user = await db.user.create({ data: { id, username: 'csp_' + id,
            email: id + '@example.invalid', password: 'synthetic-unused-hash',
            role: 'SUPER_ADMIN', isActive: true, tokenVersion: 0 } });
        token = jwt.sign({ id: user.id, role: user.role, username: user.username,
            tokenVersion: 0 }, JWT_SECRET, { expiresIn: '5m' });
        server = http.createServer(app);
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        wsServer.init(server);
        base = `ws://127.0.0.1:${server.address().port}/ws`;
    });
    afterEach(() => {
        for (const socket of sockets) socket.terminate();
        sockets.clear();
    });
    afterAll(async () => {
        await wsServer.close();
        await new Promise(resolve => server.close(resolve));
        app.stopBackgroundSchedulers();
    });
    function socket(query = '', protocols) {
        const client = new WS(base + query, protocols);
        sockets.add(client);
        return client;
    }
    function closed(client) {
        return new Promise((resolve, reject) => {
            client.once('close', (code, reason) => resolve({ code, reason: reason.toString() }));
            client.once('error', reject);
        });
    }
    function connected(client) {
        return new Promise((resolve, reject) => {
            client.on('message', bytes => {
                const event = JSON.parse(bytes.toString());
                if (event.type === 'CONNECTED') resolve(event);
            });
            client.once('error', reject);
            client.once('close', code => reject(new Error('Unexpected close ' + code)));
        });
    }

    test('actual HTTP response forbids eval, inline scripts, inline handlers, objects and framing', async () => {
        const response = await request(app).get('/api/health');
        expect(response.status).toBe(200);
        const policy = Object.fromEntries(response.headers['content-security-policy'].split(';')
            .filter(Boolean).map(value => { const [name, ...sources] = value.trim().split(/\s+/); return [name, sources]; }));
        expect(policy['script-src']).toContain("'self'");
        expect(policy['script-src']).not.toContain("'unsafe-eval'");
        expect(policy['script-src']).not.toContain("'unsafe-inline'");
        expect(policy['script-src']).toContain("'wasm-unsafe-eval'");
        expect(policy['script-src-attr']).toEqual(["'none'"]);
        expect(policy['object-src']).toEqual(["'none'"]);
        expect(policy['base-uri']).toEqual(["'self'"]);
        expect(policy['frame-ancestors']).toEqual(["'none'"]);
        expect(policy['form-action']).toEqual(["'self'"]);
        expect(policy['style-src']).toContain("'unsafe-inline'");
    });
    test('a valid query token is refused before principal validation or registration', async () => {
        const validate = jest.spyOn(require('../../services/sessionValidationService'), 'validateUserPrincipal');
        try {
            expect(await closed(socket('?token=' + encodeURIComponent(token))))
                .toEqual({ code: 4001, reason: 'URL credentials are not accepted' });
            expect(validate).not.toHaveBeenCalled();
        } finally { validate.mockRestore(); }
    });
    test.each(['?token=', '?client=?&token=', '?%74oken='])(
        'query credentials are refused even alongside a valid subprotocol (%s)', async query => {
            expect((await closed(socket(query + encodeURIComponent(token), [token]))).code).toBe(4001);
        });
    test('missing header credentials are refused', async () => {
        expect((await closed(socket())).code).toBe(4001);
    });
    test('the subprotocol header authenticates an actual socket without a credential URL', async () => {
        const event = await connected(socket('', [token]));
        expect(event.userId).toBe(user.id);
        expect(event.onlineUsers).toContain(user.id);
    });
    test('ordinary query metadata is allowed when the subprotocol authenticates', async () => {
        expect((await connected(socket('?client=browser', [token]))).userId).toBe(user.id);
    });
    test('subprotocol transport retains the forced-password-change gate', async () => {
        await db.user.update({ where: { id: user.id }, data: { mustChangePassword: true } });
        try { expect((await closed(socket('', [token]))).code).toBe(4005); }
        finally { await db.user.update({ where: { id: user.id }, data: { mustChangePassword: false } }); }
    });
});
