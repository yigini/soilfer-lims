'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const express = require('express');
const supertest = require('supertest');

describe('Issue #149 Codex Verification: 9 Lifecycle & Authorization Contracts', () => {
    let dir, databasePath, setupDb, prisma, state, db, middleware, management, app, http;
    const admin = { role: 'SUPER_ADMIN', username: 'synthetic-review-admin' };

    const response = () => ({
        statusCode: 200,
        body: null,
        status(c) { this.statusCode = c; return this; },
        json(b) { this.body = b; return this; }
    });

    async function authenticate(token) {
        const r = { headers: { 'x-api-key': token } };
        const s = response();
        let next = false;
        await middleware(r, s, () => { next = true; });
        return { next, auth: r.sisAuth, res: s };
    }

    async function update(id, body) {
        const r = response();
        await management.updateConnection({ user: admin, params: { id }, body }, r);
        assert.equal(r.statusCode, 200);
        return r;
    }

    async function provision(name, scope = {}) {
        const common = {
            name,
            capabilities: ['SPATIAL', 'SNAPSHOT', 'RECEIPT'],
            countries: ['AAA'],
            projects: ['SYNTHETIC-PROJECT'],
            labs: ['SYNTHETIC-LAB'],
            ...scope
        };
        const c = response();
        await management.createConnection({ user: admin, body: common }, c);
        assert.equal(c.statusCode, 200);
        const r = response();
        await management.createApiKey({ user: admin, body: { ...common, connectionId: c.body.data.id } }, r);
        assert.equal(r.statusCode, 200);
        assert.ok(r.body.apiKey);
        return { connectionId: c.body.data.id, keyId: r.body.keyInfo.id, token: r.body.apiKey };
    }

    async function get(url, key) {
        return http.get(url).set('x-api-key', key.token);
    }

    async function post(url, key, body) {
        return http.post(url).set('x-api-key', key.token).send(body);
    }

    beforeAll(async () => {
        dir = fs.mkdtempSync(path.join(path.resolve(__dirname, '../../..'), 'tmp-codex-verify-'));
        databasePath = path.join(dir, 'synthetic-review.db');
        process.env.DATABASE_PATH = databasePath;
        process.env.NODE_ENV = 'test';
        process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
        delete process.env.SOURCE_SYSTEM_ID;

        setupDb = new Database(databasePath);
        setupDb.exec(fs.readFileSync(path.resolve(__dirname, '../../scripts/schema/full_application_schema.sql'), 'utf8'));
        setupDb.close();

        require('../../scripts/migrate_exchange_journal_tables.cjs').migrateExchangeTables(databasePath);

        prisma = require('../../prisma');
        state = require('../../services/exchangeStateService');
        db = state.getDb();
        middleware = require('../../middleware/apiKeyAuth');
        management = require('../../controllers/sisController');

        app = express();
        app.use(express.json());
        app.use('/api/v1/sis', require('../../routes/sisRoutes'));
        app.use('/api/v2/data-exchange', require('../../routes/sisV2Routes'));
        http = supertest(app);

        await prisma.lab.create({ data: { id: 'SYNTHETIC-LAB', code: 'SYNTHETIC-LAB', name: 'Synthetic Lab', country: 'AAA' } });
        for (const [id, country, projectCode] of [['sample-a', 'AAA', 'SYNTHETIC-PROJECT'], ['sample-b', 'BBB', 'OTHER-PROJECT']]) {
            await prisma.sample.create({
                data: {
                    id,
                    originalId: id + '-field',
                    labId: id + '-accession',
                    assignedLab: 'SYNTHETIC-LAB',
                    country,
                    projectCode,
                    status: 'EXPECTED',
                    latitude: 12,
                    longitude: 34,
                    depthTopCm: 0,
                    depthBottomCm: 20
                }
            });
            await prisma.result.create({
                data: {
                    id: id + '-result',
                    sampleId: id,
                    param: 'PH_H2O',
                    value: '6.2',
                    numericValue: 6.2,
                    unit: 'pH units',
                    isValid: true,
                    isCurrent: true
                }
            });
            await prisma.sample.update({ where: { id }, data: { status: 'APPROVED', approvedAt: new Date() } });
        }
    });

    afterAll(async () => {
        try { await prisma.$disconnect(); } catch (e) {}
        if (db && db.open) { try { db.close(); } catch (e) {} }
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
    });

    test('Check 1: Real publication UDF preserves spatial data for authorized snapshot consumers', async () => {
        const key = await provision('Managed synthetic');
        let r = await get('/api/v2/data-exchange/samples', key);
        expect(r.status).toBe(200);
        expect(r.body.data.length).toBe(1);
        expect(r.body.data[0].sampling.location).toBeTruthy();

        const journal = db.prepare("SELECT payload FROM _exchange_journal WHERE specimen_id='sample-a' AND payload IS NOT NULL ORDER BY sequence LIMIT 1").get();
        expect(journal).toBeDefined();
        const payload = JSON.parse(journal.payload);
        expect(payload.sampling.location).not.toBeNull();

        const snapshot = await post('/api/v2/data-exchange/snapshots', key, {});
        expect(snapshot.status).toBe(201);
        const sid = snapshot.body.snapshotId;
        expect(sid).toBeTruthy();

        const page = await get('/api/v2/data-exchange/snapshots/' + sid + '/pages', key);
        expect(page.status).toBe(200);
        expect(page.body.data.length).toBe(1);
        expect(page.body.data[0].sampling.location).not.toBeNull();
    });

    test('Check 2: Live capability reduction redacts legacy sync, denies spatial route, expires old change cursor', async () => {
        const key = await provision('Cap reduction test');
        const feed = await get('/api/v2/data-exchange/changes', key);
        expect(feed.status).toBe(200);
        expect(feed.body.nextCursor).toBeTruthy();

        await update(key.connectionId, { capabilities: ['SNAPSHOT', 'RECEIPT'] });
        let r = await get('/api/v1/sis/sync?updatedSince=2020-01-01T00%3A00%3A00Z', key);
        expect(r.status).toBe(200);
        expect(r.body.samples[0].provenance.coordinates).toBeNull();

        r = await get('/api/v2/data-exchange/geojson', key);
        expect(r.status).toBe(403);

        r = await get('/api/v2/data-exchange/changes?cursor=' + encodeURIComponent(feed.body.nextCursor), key);
        expect(r.status).toBe(410);
    });

    test('Check 3: Live DISABLED connection denies actual consumer HTTP request', async () => {
        const key = await provision('Disabled conn test');
        await update(key.connectionId, { status: 'DISABLED' });
        const r = await get('/api/v2/data-exchange/samples', key);
        expect(r.status).toBe(403);
        expect(r.body.code).toBe('CONNECTION_DISABLED');
    });

    test('Check 4: Explicit replacement INSERT failure rolls back and preserves active old key', async () => {
        const key = await provision('Insert failure test');
        db.exec("CREATE TRIGGER synthetic_rotation_failure BEFORE INSERT ON ApiKey BEGIN SELECT RAISE(ABORT, 'SYNTHETIC_REVIEW_INSERT_FAILURE'); END");
        const failed = response();
        await management.rotateApiKey({ user: admin, params: { id: key.keyId } }, failed);
        expect(failed.statusCode).toBe(500);
        const oldKey = await prisma.apiKey.findUnique({ where: { id: key.keyId } });
        expect(oldKey.isActive).toBe(true);
        db.exec('DROP TRIGGER synthetic_rotation_failure');
    });

    test('Check 5: Disjoint finite scopes evaluate to empty set and deny all data (fail closed)', async () => {
        const key = await provision('Disjoint scope test');
        await update(key.connectionId, { countries: ['BBB'], projects: ['OTHER-PROJECT'] });
        const principal = await authenticate(key.token);
        expect(principal.auth.countries).toEqual([]);
        expect(principal.auth.projects).toEqual([]);

        const r = await get('/api/v2/data-exchange/samples', key);
        expect(r.status).toBe(200);
        expect(r.body.data.length).toBe(0);
    });

    test('Check 6: Wildcard key intersects with finite connection scope to yield finite scope', async () => {
        const wild = await provision('Wildcard synthetic', { countries: ['*'], projects: ['*'] });
        await update(wild.connectionId, { countries: ['AAA'], projects: ['SYNTHETIC-PROJECT'] });
        const wildAuth = await authenticate(wild.token);
        expect(wildAuth.auth.countries).toEqual(['AAA']);
        expect(wildAuth.auth.projects).toEqual(['SYNTHETIC-PROJECT']);

        const r = await get('/api/v2/data-exchange/samples', wild);
        expect(r.status).toBe(200);
        expect(r.body.data.length).toBe(1);
        expect(r.body.data[0].country).toBe('AAA');
    });

    test('Check 7: Missing managed connection fails closed (403) and is not recreated ACTIVE', async () => {
        const missing = await provision('Missing connection test');
        await update(missing.connectionId, { status: 'DISABLED' });
        db.prepare('DELETE FROM _exchange_connections WHERE id=?').run(missing.connectionId);

        const r = await get('/api/v2/data-exchange/samples', missing);
        expect(r.status).toBe(403);
        expect(r.body.code).toBe('CONNECTION_NOT_FOUND');
        const recreated = db.prepare('SELECT status FROM _exchange_connections WHERE id=?').get(missing.connectionId);
        expect(recreated).toBeUndefined();
    });

    test('Check 8: Concurrent rotation of one old key succeeds exactly once (200 + 409) leaving 1 active replacement', async () => {
        const concurrent = await provision('Concurrent rotation test');
        const ra = response();
        const rb = response();

        await Promise.all([
            management.rotateApiKey({ user: admin, params: { id: concurrent.keyId } }, ra),
            management.rotateApiKey({ user: admin, params: { id: concurrent.keyId } }, rb)
        ]);

        const statuses = [ra.statusCode, rb.statusCode].sort();
        expect(statuses).toEqual([200, 409]);

        const activeCount = db.prepare('SELECT COUNT(*) n FROM ApiKey WHERE connectionId=? AND isActive=1').get(concurrent.connectionId).n;
        expect(activeCount).toBe(1);
    });

    test('Check 9: Outdated snapshot receipt is rejected (410) after connection authorization version changes', async () => {
        const key = await provision('Snapshot receipt version test');
        const snapshot = await post('/api/v2/data-exchange/snapshots', key, {});
        expect(snapshot.status).toBe(201);
        const sid = snapshot.body.snapshotId;

        // Change connection permissions (increments auth_version)
        await update(key.connectionId, { capabilities: ['SNAPSHOT', 'RECEIPT'] });

        const stale = await post('/api/v2/data-exchange/receipts', key, {
            snapshotId: sid,
            importedCount: 1,
            quarantinedCount: 0,
            checkpoint: 'item_1'
        });

        expect(stale.status).toBe(410);
        expect(stale.body.code).toBe('AUTH_VERSION_MISMATCH');
    });

    test('Check 10: API key with SUPER_ADMIN role does NOT bypass finite countries/projects or spatial projection', async () => {
        const elevated = await provision('Role-bearing scoped key', { role: 'SUPER_ADMIN', capabilities: ['SNAPSHOT', 'RECEIPT'] });
        const elevatedAuth = await authenticate(elevated.token);
        expect(elevatedAuth.auth.type).toBe('API_KEY');
        expect(elevatedAuth.auth.role).toBe('SUPER_ADMIN');
        expect(elevatedAuth.auth.countries).toEqual(['AAA']);
        expect(elevatedAuth.auth.projects).toEqual(['SYNTHETIC-PROJECT']);
        expect(elevatedAuth.auth.capabilities.includes('SPATIAL')).toBe(false);

        const r = await get('/api/v2/data-exchange/samples', elevated);
        expect(r.status).toBe(200);
        expect(r.body.data.length).toBe(1); // Scoped strictly to AAA & SYNTHETIC-PROJECT (sample-a only, not sample-b)
        expect(r.body.data[0].sampling.location).toBeNull(); // Spatial location redacted

        const guarded = await get('/api/v2/data-exchange/geojson', elevated);
        expect(guarded.status).toBe(403);
    });

    test('Check 11: Idempotency replay with mismatched key returns 409 conflict and preserves second key', async () => {
        const operationKey = 'synthetic-repeat-operation-' + Date.now();
        const rotationA = await provision('Idempotency A');
        const rotationB = await provision('Idempotency B');

        const firstRotate = response();
        await management.rotateApiKey({ user: admin, headers: { 'idempotency-key': operationKey }, params: { id: rotationA.keyId } }, firstRotate);
        expect(firstRotate.statusCode).toBe(200);

        const secondRotate = response();
        await management.rotateApiKey({ user: admin, headers: { 'idempotency-key': operationKey }, params: { id: rotationB.keyId } }, secondRotate);
        expect(secondRotate.statusCode).toBe(409);
        expect(secondRotate.body.code).toBe('IDEMPOTENCY_CONFLICT');

        const bKey = await prisma.apiKey.findUnique({ where: { id: rotationB.keyId } });
        expect(bKey.isActive).toBe(true);
    });

    test('Check 12: Postcommit retry recovers committed rotation from durable storage after in-memory cache reset', async () => {
        const operationKey = 'synthetic-durable-op-' + Date.now();
        const rotationA = await provision('Durable Rotation');

        const firstRotate = response();
        await management.rotateApiKey({ user: admin, headers: { 'idempotency-key': operationKey }, params: { id: rotationA.keyId } }, firstRotate);
        expect(firstRotate.statusCode).toBe(200);
        const originalApiKey = firstRotate.body.apiKey;

        // Reset module-local cache simulating process loss
        delete require.cache[require.resolve('../../controllers/sisController')];
        const freshManagement = require('../../controllers/sisController');
        const retry = response();
        await freshManagement.rotateApiKey({ user: admin, headers: { 'idempotency-key': operationKey }, params: { id: rotationA.keyId } }, retry);

        expect(retry.statusCode).toBe(200);
        expect(retry.body.apiKey).toBe(originalApiKey);
    });

    test('Check 13: Managed key with missing authoritative linkage fails closed (403)', async () => {
        const unlinked = await provision('Removed linkage');
        db.prepare('DELETE FROM _exchange_connection_keys WHERE api_key_id=?').run(unlinked.keyId);

        const r = await get('/api/v2/data-exchange/samples', unlinked);
        expect(r.status).toBe(403);
        expect(r.body.code).toBe('CONNECTION_LINK_MISSING');
    });
});
