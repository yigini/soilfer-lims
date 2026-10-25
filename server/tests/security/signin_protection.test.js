const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID, createHash } = require('node:crypto');
const { spawn } = require('node:child_process');
const path = require('node:path');
const app = require('../../app');
const db = require('../../prisma');
const { authenticate } = require('../../services/signInService');
const { readSignInPolicy, assertNewPassword } = require('../../services/signInPolicy');
const policyService = require('../../services/policyService');
const lifecycle = require('../../services/staffLifecycleService');
const { JWT_SECRET } = require('../../config/auth');

describe('R4 durable sign-in protection', () => {
    let hash, lab, admin, adminToken;
    const legacyPassword = 'legacy-8';
    const strongPassword = 'Synthetic-new-password-123';
    const key = name => createHash('sha256').update(name).digest('hex');
    async function user(extra = {}) {
        const id = randomUUID();
        return db.user.create({ data: { id, username: 'signin_' + id, email: id + '@example.invalid',
            password: hash, role: 'LAB_TECHNICIAN', labId: lab.id, ...extra } });
    }
    const token = u => jwt.sign({ id: u.id, username: u.username, role: u.role, tokenVersion: u.tokenVersion || 0 }, JWT_SECRET);
    beforeAll(async () => {
        hash = await bcrypt.hash(legacyPassword, 10);
        lab = await db.lab.create({ data: { id: randomUUID(), code: 'SIGNIN-' + randomUUID(), name: 'Synthetic sign-in lab', country: 'TEST' } });
        admin = await user({ role: 'SUPER_ADMIN', labId: null });
        adminToken = token(admin);
    });
    afterEach(() => jest.restoreAllMocks());

    test('unknown and wrong-password responses match, and both perform bcrypt comparison', async () => {
        const known = await user(), compare = jest.spyOn(bcrypt, 'compare');
        const wrong = await request(app).post('/api/auth/login').send({ username: known.username, password: strongPassword });
        const unknown = await request(app).post('/api/auth/login').send({ username: 'missing_' + randomUUID(), password: strongPassword });
        expect(wrong.status).toBe(401);
        expect(unknown.status).toBe(wrong.status);
        expect(unknown.body).toEqual(wrong.body);
        expect(compare).toHaveBeenCalledTimes(2);
        expect(compare.mock.calls.every(([candidate, encoded]) => candidate === strongPassword && /^\$2[ab]\$10\$/.test(encoded))).toBe(true);
    });

    test('HTTP locks at the default threshold with generic body and Retry-After, even for the correct password', async () => {
        const known = await user();
        const first = await request(app).post('/api/auth/login').send({ username: known.username, password: strongPassword });
        for (let i = 1; i < 4; i++) expect((await authenticate(db, known.username, strongPassword, '198.51.100.10')).status).toBe(401);
        const locked = await request(app).post('/api/auth/login').send({ username: known.username, password: strongPassword });
        expect(locked.status).toBe(429);
        expect(locked.headers['retry-after']).toBe('1');
        expect(locked.body).toEqual(first.body);
        const blocked = await request(app).post('/api/auth/login').send({ username: known.username, password: legacyPassword });
        expect(blocked.status).toBe(429);
        expect(blocked.body).toEqual(first.body);
        expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    });

    test('success resets durable counters without forcing an existing short password to change', async () => {
        const known = await user(), now = Date.now();
        for (let i = 0; i < 4; i++) await authenticate(db, known.username, strongPassword, '198.51.100.11', { now });
        expect((await authenticate(db, known.username, legacyPassword, '198.51.100.11', { now })).accepted).toBe(true);
        const [state] = await db.$queryRawUnsafe('SELECT * FROM AuthLoginState WHERE accountKey=?', key(known.username));
        expect(Number(state.failedAttempts)).toBe(0);
        expect(Number(state.lockedUntil)).toBe(0);
        expect((await authenticate(db, known.username, strongPassword, '198.51.100.11', { now })).status).toBe(401);
        expect((await db.user.findUnique({ where: { id: known.id } })).mustChangePassword).toBe(false);
    });

    test('backoff grows, is capped by installation policy, and a new window resets failures', async () => {
        const known = await user();
        jest.spyOn(policyService, 'loadProfile').mockReturnValue({ overrides: {
            'auth.loginFailureThreshold': 2, 'auth.loginMaxDelayMinutes': 1
        } });
        let now = Date.now();
        expect((await authenticate(db, known.username, strongPassword, '198.51.100.12', { now })).status).toBe(401);
        const delays = [];
        for (let i = 0; i < 9; i++) {
            const result = await authenticate(db, known.username, strongPassword, '198.51.100.12', { now });
            expect(result.status).toBe(429);
            delays.push(result.retryAfter);
            now += result.retryAfter * 1000 + 1;
        }
        expect(delays).toEqual([1, 2, 4, 8, 16, 32, 60, 60, 60]);
        expect((await authenticate(db, known.username, strongPassword, '198.51.100.12', { now: now + 16 * 60000 })).status).toBe(401);
    });

    test('failure and lockout audits contain bounded typed username, IP and reason, never the password', async () => {
        const username = 'Unknown-' + 'x'.repeat(300), now = Date.now();
        for (let i = 0; i < 5; i++) await authenticate(db, username, strongPassword, '198.51.100.13', { now });
        await authenticate(db, username, strongPassword, '198.51.100.13', { now });
        const rows = await db.auditLog.findMany({ where: { entity: 'AUTH_LOGIN', entityId: key(username) } });
        expect(rows.filter(r => r.action === 'LOGIN_FAILURE')).toHaveLength(6);
        expect(rows.filter(r => r.action === 'LOGIN_LOCKOUT')).toHaveLength(1);
        expect(JSON.stringify(rows)).not.toContain(strongPassword);
        expect(rows.every(row => {
            const details = JSON.parse(row.details);
            return details.username === username.slice(0, 256) && details.ip === '198.51.100.13' &&
                ['UNKNOWN_ACCOUNT', 'ACCOUNT_LOCKED', 'FAILURE_THRESHOLD'].includes(details.reason);
        })).toBe(true);
    });

    test('separate processes share atomic counters and an independent account is unaffected', async () => {
        const known = await user();
        const file = path.resolve(__dirname, '../.tmp/test_signin_process_' + randomUUID() + '.db');
        require('../helpers/testOwnedDatabase').assertOwnedTestDatabase(file, 'system:fixture');
        const Database = require('better-sqlite3');
        const reader = new Database(process.env.DATABASE_PATH, { readonly: true, fileMustExist: true });
        try { await reader.backup(file); } finally { reader.close(); }
        const { createRootClient } = require('../../utils/prismaClientIdentity');
        const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
        const shared = createRootClient({ adapter: new PrismaBetterSqlite3({ url: 'file:' + file, timeout: 5000 }) });
        function child() {
            return new Promise((resolve, reject) => {
                const p = spawn(process.execPath, [path.resolve(__dirname, '../helpers/signinAttemptChild.js'), file, known.username],
                    { env: { ...process.env, NODE_ENV: 'test' }, stdio: ['ignore', 'pipe', 'pipe'] });
                let output = '';
                p.stdout.on('data', b => { output += b; });
                p.on('error', reject);
                p.on('close', code => code === 0 ? resolve(JSON.parse(output)) : reject(new Error('Synthetic child did not complete')));
            });
        }
        try {
            expect(await Promise.all([child(), child()])).toEqual([{ status: 401 }, { status: 401 }]);
            for (let i = 0; i < 2; i++) expect((await authenticate(shared, known.username, strongPassword, '198.51.100.14')).status).toBe(401);
            expect((await authenticate(shared, known.username, strongPassword, '198.51.100.14')).status).toBe(429);
            const [state] = await shared.$queryRawUnsafe('SELECT failedAttempts FROM AuthLoginState WHERE accountKey=?', key(known.username));
            expect(Number(state.failedAttempts)).toBe(5);
            expect((await authenticate(shared, admin.username, legacyPassword, '198.51.100.14')).accepted).toBe(true);
        } finally { await shared.$disconnect(); }
    });

    test('password policy is configurable, validates new passwords and does not accept bcrypt-truncated inputs', () => {
        expect(readSignInPolicy()).toMatchObject({ failureThreshold: 5, windowMs: 900000, maxDelayMs: 900000, minPasswordLength: 12 });
        expect(() => assertNewPassword('12345678901')).toThrow();
        expect(() => assertNewPassword('123456789012')).not.toThrow();
        expect(() => assertNewPassword('a'.repeat(73))).toThrow();
        expect(() => assertNewPassword(null)).toThrow();
        jest.spyOn(policyService, 'loadProfile').mockReturnValue({ overrides: { 'auth.passwordMinLength': 16 } });
        expect(() => assertNewPassword('123456789012')).toThrow('16');
        expect(() => assertNewPassword(strongPassword)).not.toThrow();
    });

    test('installation policies stay visible but cannot be changed or replaced by a lab preset', async () => {
        await policyService.change(admin, lab.id, { presetCode: 'BASIC', reason: 'Synthetic policy precedence check' });
        const state = await policyService.snapshot(lab.id, { profile: { overrides: { 'auth.passwordMinLength': 16 } } });
        expect(state.resolved['auth.passwordMinLength']).toMatchObject({ value: 16, source: 'PROFILE_OVERRIDE', version: 0, scope: null });
        await expect(policyService.change(admin, lab.id, { reason: 'Synthetic forbidden lab override',
            changes: [{ key: 'auth.passwordMinLength', value: 24 }] })).rejects.toMatchObject({ code: 'POLICY_SCOPE_INVALID' });
        expect(() => policyService.loadProfile({ profile: { overrides: { 'auth.loginFailureThreshold': 0 } } })).toThrow();
        expect(() => policyService.loadProfile({ profile: { overrides: { 'auth.passwordMinLength': 11 } } })).toThrow();
        expect(() => require('../../utils/initialAdminPassword').prepareInitialAdminPassword('too-short')).toThrow();
    });

    test('normal APIs are blocked for must-change sessions while me and a valid password change work', async () => {
        const known = await user({ mustChangePassword: true }), auth = token(known);
        for (const endpoint of ['/api/users', '/api/samples?next=/api/auth/me']) {
            const res = await request(app).get(endpoint).set('Authorization', 'Bearer ' + auth);
            expect(res.status).toBe(403);
            expect(res.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
        }
        expect((await request(app).post('/api/auth/refresh').set('Authorization', 'Bearer ' + auth)).status).toBe(403);
        const me = await request(app).get('/api/auth/me').set('Authorization', 'Bearer ' + auth);
        expect(me.status).toBe(200);
        expect(me.body.passwordPolicy.minLength).toBe(12);
        const short = await request(app).post('/api/auth/change-password').set('Authorization', 'Bearer ' + auth)
            .send({ currentPassword: legacyPassword, newPassword: 'shortpass' });
        expect(short.status).toBe(400);
        const changed = await request(app).post('/api/auth/change-password').set('Authorization', 'Bearer ' + auth)
            .send({ currentPassword: legacyPassword, newPassword: strongPassword });
        expect(changed.status).toBe(200);
        expect((await db.user.findUnique({ where: { id: known.id } })).mustChangePassword).toBe(false);
    });

    test.each(['/api/users/api/auth/me', '/api/auth/me/nested', '/api/auth/change-password-extra', '/api/auth/logout/extra'])(
        'a recovery-path substring cannot bypass the forced change: %s', async currentPath => {
            const known = await user({ mustChangePassword: true });
            const result = await require('../../services/sessionValidationService').validateUserPrincipal({ id: known.id }, { currentPath });
            expect(result.valid).toBe(false);
            expect(result.statusCode).toBe(403);
        });

    test('admin create and password replacement reject short values and accept a compliant new credential', async () => {
        const id = randomUUID(), body = { username: 'create_' + id, email: id + '@example.invalid', role: 'LAB_TECHNICIAN', labId: lab.id, password: 'shortpass' };
        expect((await request(app).post('/api/users').set('Authorization', 'Bearer ' + adminToken).send(body)).status).toBe(400);
        expect(await db.user.findUnique({ where: { username: body.username } })).toBeNull();
        const created = await request(app).post('/api/users').set('Authorization', 'Bearer ' + adminToken).send({ ...body, password: strongPassword });
        expect(created.status).toBe(200);
        const target = await db.user.findUnique({ where: { username: body.username } });
        const changed = await request(app).put('/api/users/' + target.id).set('Authorization', 'Bearer ' + adminToken).send({ password: 'shortpass' });
        expect(changed.status).toBe(400);
        expect((await db.user.findUnique({ where: { id: target.id } })).password).toBe(target.password);
        expect((await request(app).put('/api/users/' + target.id).set('Authorization', 'Bearer ' + adminToken).send({ name: 'Synthetic edited name', password: '' })).status).toBe(200);
    });

    test('invitation activation and recovery enforce the same rule before consuming their grant', async () => {
        const invite = await lifecycle.createInvitation(admin, { name: 'Synthetic invitee', email: randomUUID() + '@example.invalid', role: 'LAB_TECHNICIAN', labId: lab.id, projects: [] });
        await expect(lifecycle.consumeInvitation(invite.token, { username: 'invite_' + randomUUID(), password: 'shortpass' })).rejects.toMatchObject({ code: 'INVALID_PASSWORD' });
        await expect(lifecycle.verifyInvitationToken(invite.token)).resolves.toBeDefined();
        const target = await user();
        const grant = await lifecycle.createRecoveryGrant(admin, target.id, { reason: 'Synthetic password policy check' });
        await expect(lifecycle.consumeRecoveryGrant(grant.token, { newPassword: 'shortpass' })).rejects.toMatchObject({ code: 'INVALID_PASSWORD' });
        await expect(lifecycle.verifyRecoveryToken(grant.token)).resolves.toBeDefined();
        await expect(lifecycle.consumeRecoveryGrant(grant.token, { newPassword: strongPassword })).resolves.toMatchObject({ success: true });
    });
});
