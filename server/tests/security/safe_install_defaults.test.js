jest.mock('dotenv', () => ({ config: () => ({ parsed: {} }) }));

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const express = require('express');
const cors = require('cors');
const request = require('supertest');
const { readHttpSecurityConfig, corsOptions, healthResponse, isLoopback } = require('../../config/httpSecurity');
const pkg = require('../../package.json');

function harness(env, remoteAddress) {
    const app = express();
    const config = readHttpSecurityConfig(env);
    app.set('trust proxy', config.trustProxy);
    if (remoteAddress) app.use((req, res, next) => {
        // Model an untrusted network peer before Express resolves the proxy chain.
        Object.defineProperty(req.socket, 'remoteAddress', { value: remoteAddress, configurable: true });
        next();
    });
    app.use(cors((req, callback) => callback(null, corsOptions(req, config))));
    app.get('/api/health', (req, res) => healthResponse(req, res, config, pkg.version));
    app.get('/api/version', (req, res) => healthResponse(req, res, config, pkg.version, true));
    return app;
}

describe('R3 safe HTTP install defaults', () => {
    const keys = ['NODE_ENV', 'ALLOWED_ORIGINS', 'TRUST_PROXY', 'HEALTH_SHOW_VERSION'];
    const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
    let app;
    beforeAll(() => {
        Object.assign(process.env, { NODE_ENV: 'production',
            ALLOWED_ORIGINS: 'https://preview.example.invalid, https://secondary.example.invalid',
            TRUST_PROXY: 'loopback', HEALTH_SHOW_VERSION: 'false' });
        app = require('../../app');
    });
    afterAll(() => {
        app?.stopBackgroundSchedulers();
        for (const key of keys) {
            if (previous[key] === undefined) delete process.env[key];
            else process.env[key] = previous[key];
        }
    });

    test.each(['https://preview.example.invalid', 'https://secondary.example.invalid'])(
        'actual production app grants configured HTTPS origin %s', async origin => {
            const res = await request(app).get('/api/health').set('Origin', origin);
            expect(res.status).toBe(200);
            expect(res.headers['access-control-allow-origin']).toBe(origin);
            expect(res.headers.vary).toContain('Origin');
        });
    test.each(['https://other.example.invalid', 'http://preview.example.invalid', 'null'])(
        'actual production app grants no CORS access to %s', async origin => {
            const res = await request(app).get('/api/health').set('Origin', origin);
            expect(res.status).toBe(200);
            expect(res.headers['access-control-allow-origin']).toBeUndefined();
        });
    test('missing Origin works without granting a browser origin', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
    test('allowed preflight is accepted with the exact origin', async () => {
        const res = await request(app).options('/api/health').set('Origin', 'https://preview.example.invalid')
            .set('Access-Control-Request-Method', 'GET');
        expect(res.status).toBe(204);
        expect(res.headers['access-control-allow-origin']).toBe('https://preview.example.invalid');
    });
    test('empty production list permits same-origin and no extra origin', async () => {
        const empty = harness({ NODE_ENV: 'production' });
        const same = await request(empty).get('/api/health').set('Host', 'lab.example.invalid')
            .set('X-Forwarded-Proto', 'https').set('Origin', 'https://lab.example.invalid');
        expect(same.headers['access-control-allow-origin']).toBe('https://lab.example.invalid');
        const other = await request(empty).get('/api/health').set('Origin', 'https://other.example.invalid');
        expect(other.headers['access-control-allow-origin']).toBeUndefined();
    });
    test('non-production retains wildcard development CORS', async () => {
        const res = await request(harness({ NODE_ENV: 'development' })).get('/api/health')
            .set('Origin', 'http://localhost:5173');
        expect(res.headers['access-control-allow-origin']).toBe('*');
    });

    test.each(['/api/health', '/api/version'])('%s exposes metadata to direct loopback only by default', async endpoint => {
        const local = await request(app).get(endpoint);
        expect(local.body.version).toBe(pkg.version);
        expect(typeof local.body.uptime).toBe('number');
        expect(local.headers['cache-control']).toBe('no-store');
        const remote = await request(app).get(endpoint).set('X-Forwarded-For', '198.51.100.44');
        expect(remote.body).toEqual({ status: 'ok' });
        const spoof = await request(app).get(endpoint).set('X-Forwarded-For', '127.0.0.1, 198.51.100.44');
        expect(spoof.body).toEqual({ status: 'ok' });
    });
    test.each(['127.0.0.1', '::1', '127.0.0.1, ::1'])(
        'an untrusted peer cannot use spoofed X-Forwarded-For %s to reveal metadata', async spoof => {
            const remote = harness({ NODE_ENV: 'production' }, '198.51.100.44');
            for (const endpoint of ['/api/health', '/api/version']) {
                const res = await request(remote).get(endpoint).set('X-Forwarded-For', spoof);
                expect(res.body).toEqual({ status: 'ok' });
            }
        });
    test('explicit HEALTH_SHOW_VERSION=true permits public metadata', async () => {
        const res = await request(harness({ NODE_ENV: 'production', HEALTH_SHOW_VERSION: 'true' }, '198.51.100.44'))
            .get('/api/version');
        expect(res.body).toEqual({ status: 'ok', name: 'soilfer-lims', version: pkg.version, uptime: expect.any(Number) });
    });
    test.each(['127.0.0.1', '127.12.34.56', '::1', '::ffff:127.0.0.1'])(
        'recognizes loopback address %s', address => expect(isLoopback(address)).toBe(true));
    test.each(['198.51.100.44', '10.0.0.1', '::ffff:198.51.100.44', undefined])(
        'does not classify public/private non-loopback address %s as loopback', address => expect(isLoopback(address)).toBe(false));
    test('default proxy trust is loopback, with explicit operator overrides', () => {
        const trust = app.get('trust proxy fn');
        expect(trust('127.0.0.1')).toBe(true);
        expect(trust('198.51.100.44')).toBe(false);
        const disabled = harness({ NODE_ENV: 'production', TRUST_PROXY: 'false' }).get('trust proxy fn');
        expect(disabled('127.0.0.1')).toBe(false);
        const subnet = harness({ NODE_ENV: 'production', TRUST_PROXY: 'loopback,192.0.2.0/24' }).get('trust proxy fn');
        expect(subnet('192.0.2.25')).toBe(true);
        expect(subnet('198.51.100.44')).toBe(false);
    });

    test.each(['http://preview.example.invalid', '*', 'https://preview.example.invalid/path',
        'https://preview.example.invalid?query=value', 'https://user:synthetic@preview.example.invalid', 'null'])(
        'production rejects invalid origin configuration without echoing it', entry => {
            expect(() => readHttpSecurityConfig({ NODE_ENV: 'production', ALLOWED_ORIGINS: entry }))
                .toThrow('ALLOWED_ORIGINS must contain only HTTPS origins');
        });
    test('real app startup refuses HTTP origins before any database adapter is opened', () => {
        const database = path.resolve(__dirname, '../.tmp', `test_${randomUUID()}.db`);
        expect(fs.existsSync(database)).toBe(false);
        const result = spawnSync(process.execPath, ['-e', "require('dotenv').config=()=>({parsed:{}}); require('./app');"], {
            cwd: path.resolve(__dirname, '../..'), encoding: 'utf8',
            env: { ...process.env, NODE_ENV: 'production', ALLOWED_ORIGINS: 'http://preview.example.invalid', DATABASE_PATH: database }
        });
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain('ALLOWED_ORIGINS must contain only HTTPS origins');
        expect(result.stderr).not.toContain('http://preview.example.invalid');
        expect(fs.existsSync(database)).toBe(false);
    });
});
