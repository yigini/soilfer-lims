'use strict';

const { createSampleFixture } = require('../helpers/workflowFixtures');
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
            await createSampleFixture(prisma, {
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

        // During bounded overlap (Plan Section 9, R3, R11), exactly 1 replacement key is ACTIVE
        const activeReplacementCount = db.prepare("SELECT COUNT(*) n FROM _exchange_connection_keys WHERE connection_id=? AND key_status='ACTIVE'").get(concurrent.connectionId).n;
        expect(activeReplacementCount).toBe(1);

        // After rotation confirmation / replacement verification, prior rotating key is retired
        const confirmRes = response();
        await management.confirmRotation({ user: admin, params: { id: concurrent.keyId } }, confirmRes);
        expect(confirmRes.statusCode).toBe(200);

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

    test('Check 12: Postcommit retry recovers committed rotation from durable storage without plaintext secret, and rejects revoked replacement with 409', async () => {
        const operationKey = 'synthetic-durable-op-' + Date.now();
        const rotationA = await provision('Durable Rotation');

        const firstRotate = response();
        await management.rotateApiKey({ user: admin, headers: { 'idempotency-key': operationKey }, params: { id: rotationA.keyId } }, firstRotate);
        expect(firstRotate.statusCode).toBe(200);
        expect(firstRotate.body.apiKey).toBeTruthy();
        const replacementKeyId = firstRotate.body.keyInfo.id;

        // Durable operation record must NOT persist plaintext secret token (hashed-at-rest / one-time display)
        const op = db.prepare('SELECT response_payload, replacement_key_id FROM _exchange_rotation_operations WHERE idempotency_key = ?').get(operationKey);
        expect(op).toBeDefined();
        expect(op.replacement_key_id).toBe(replacementKeyId);
        const parsedPayload = JSON.parse(op.response_payload);
        expect(parsedPayload.apiKey).toBeUndefined();
        expect(parsedPayload.alreadyRotated).toBe(true);

        // Reset module-local cache simulating process loss
        delete require.cache[require.resolve('../../controllers/sisController')];
        const freshManagement = require('../../controllers/sisController');
        const retry = response();
        await freshManagement.rotateApiKey({ user: admin, headers: { 'idempotency-key': operationKey }, params: { id: rotationA.keyId } }, retry);

        expect(retry.statusCode).toBe(200);
        expect(retry.body.apiKey).toBeUndefined(); // Raw secret is never stored in durable table
        expect(retry.body.alreadyRotated).toBe(true);
        expect(retry.body.keyInfo.id).toBe(replacementKeyId);

        // Replay after replacement key revocation returns HTTP 409 KEY_REVOKED
        const revokeRes = response();
        await freshManagement.revokeApiKey({ user: admin, params: { id: replacementKeyId } }, revokeRes);
        expect(revokeRes.statusCode).toBe(200);

        const afterRevoke = response();
        await freshManagement.rotateApiKey({ user: admin, headers: { 'idempotency-key': operationKey }, params: { id: rotationA.keyId } }, afterRevoke);
        expect(afterRevoke.statusCode).toBe(409);
        expect(afterRevoke.body.code).toBe('KEY_REVOKED');
    });

    test('Check 13: Managed key with missing authoritative linkage fails closed (403)', async () => {
        const unlinked = await provision('Removed linkage');
        db.prepare('DELETE FROM _exchange_connection_keys WHERE api_key_id=?').run(unlinked.keyId);

        const r = await get('/api/v2/data-exchange/samples', unlinked);
        expect(r.status).toBe(403);
        expect(r.body.code).toBe('CONNECTION_LINK_MISSING');
    });

    test('Check 14: Canonical migration backfill queries valid release evidence, includes observations, uses persisted identity, and emits non-null event IDs', async () => {
        const tempDir = fs.mkdtempSync(path.join(path.resolve(__dirname, '../../..'), 'tmp-migration-verify-'));
        const tempDbPath = path.join(tempDir, 'migration-test.db');
        const tempDb = new Database(tempDbPath);
        tempDb.exec(fs.readFileSync(path.resolve(__dirname, '../../scripts/schema/full_application_schema.sql'), 'utf8'));

        const nowIso = new Date().toISOString();
        const testSpecs = [
            ['legacy-approved', 'APPROVED', nowIso],
            ['legacy-unapproved-archive', 'ARCHIVED', null],
            ['legacy-approved-disposed', 'DISPOSED', nowIso]
        ];

        for (const [id, status, approvedAt] of testSpecs) {
            tempDb.prepare('INSERT INTO Sample (id, originalId, labId, assignedLab, country, projectCode, status, approvedAt, updatedAt, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
                .run(id, id + '-field', id + '-accession', 'SYNTHETIC-LAB', 'AAA', 'SYNTHETIC-PROJECT', status, approvedAt, nowIso, 12, 34);
            tempDb.prepare('INSERT INTO Result (id, sampleId, param, value, numericValue, unit, isValid, isCurrent, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
                .run(id + '-result', id, 'PH_H2O', '6.2', 6.2, 'pH units', 1, 1, nowIso);
        }
        tempDb.close();

        const migrateRes = require('../../scripts/migrate_exchange_journal_tables.cjs').migrateExchangeTables(tempDbPath);
        expect(migrateRes.success).toBe(true);

        const verifyDb = new Database(tempDbPath);
        const backfill = verifyDb.prepare("SELECT specimen_id, id, payload FROM _exchange_journal WHERE specimen_id LIKE 'legacy-%' ORDER BY sequence").all();
        const includedIds = backfill.map(x => x.specimen_id);

        // Released specimens included, unapproved archive excluded
        expect(includedIds).toContain('legacy-approved');
        expect(includedIds).toContain('legacy-approved-disposed');
        expect(includedIds).not.toContain('legacy-unapproved-archive');

        // Check observations, identity, and non-null stable event ID
        const approvedRow = backfill.find(x => x.specimen_id === 'legacy-approved');
        expect(approvedRow).toBeDefined();
        expect(approvedRow.id).toBeTruthy();
        expect(approvedRow.id.startsWith('evt_')).toBe(true);

        const payload = JSON.parse(approvedRow.payload);
        expect(payload.observations).toBeDefined();
        expect(payload.observations.length).toBe(1);
        expect(payload.observations[0].parameter).toBe('PH_H2O');
        expect(payload.observations[0].asMeasured.value).toBe(6.2);

        const metaRow = verifyDb.prepare("SELECT value FROM _exchange_meta WHERE key = 'source_system_id'").get();
        expect(payload.sourceSystemId).toBe(metaRow.value);
        expect(payload.sourceSystemId).not.toBe('soilfer-lims-core');

        verifyDb.close();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('Check 15: Reader operations do not mutate journal (snapshot creation is purely reader-driven)', async () => {
        const key = await provision('Reader Snapshot Test');
        const beforeCount = db.prepare('SELECT COUNT(*) n FROM _exchange_journal').get().n;

        const snapRes = await post('/api/v2/data-exchange/snapshots', key, {});
        expect(snapRes.status).toBe(201);

        const afterCount = db.prepare('SELECT COUNT(*) n FROM _exchange_journal').get().n;
        expect(afterCount).toBe(beforeCount); // Pure reader: no journal entries added
    });

    test('Check 16: Delivered content digest hashes permitted projection and matches client received projection byte-for-byte', async () => {
        // 1. Non-SPATIAL principal
        const noSpatialKey = await provision('Digest Non-Spatial', { capabilities: ['SNAPSHOT', 'RECEIPT'] });
        const snapNoSpatial = await post('/api/v2/data-exchange/snapshots', noSpatialKey, {});
        expect(snapNoSpatial.status).toBe(201);
        const sidNoSpatial = snapNoSpatial.body.snapshotId;

        const pageNoSpatial = await get(`/api/v2/data-exchange/snapshots/${sidNoSpatial}/pages`, noSpatialKey);
        expect(pageNoSpatial.status).toBe(200);
        expect(pageNoSpatial.body.data.every(s => !s.sampling?.location)).toBe(true);

        const metaNoSpatial = db.prepare('SELECT * FROM _exchange_snapshots WHERE id=?').get(sidNoSpatial);
        const prefixNoSpatial = `${metaNoSpatial.id}:${metaNoSpatial.connection_id}:${metaNoSpatial.high_water_sequence}:${metaNoSpatial.epoch}:${metaNoSpatial.auth_version}\n`;

        const receivedHasher = crypto.createHash('sha256').update(prefixNoSpatial);
        for (const s of pageNoSpatial.body.data) {
            receivedHasher.update(`${s.specimenId}:${JSON.stringify(s)}\n`);
        }
        const receivedDigest = receivedHasher.digest('hex');

        const storedHasher = crypto.createHash('sha256').update(prefixNoSpatial);
        for (const item of db.prepare('SELECT specimen_id, body_json FROM _exchange_snapshot_items WHERE snapshot_id=? ORDER BY item_order').all(sidNoSpatial)) {
            storedHasher.update(`${item.specimen_id}:${item.body_json}\n`);
        }
        const storedDigest = storedHasher.digest('hex');

        expect(storedDigest).toBe(snapNoSpatial.body.digest);
        expect(receivedDigest).toBe(snapNoSpatial.body.digest);

        // 2. SPATIAL principal
        const spatialKey = await provision('Digest Spatial', { capabilities: ['SPATIAL', 'SNAPSHOT', 'RECEIPT'] });
        const snapSpatial = await post('/api/v2/data-exchange/snapshots', spatialKey, {});
        expect(snapSpatial.status).toBe(201);
        const sidSpatial = snapSpatial.body.snapshotId;

        const pageSpatial = await get(`/api/v2/data-exchange/snapshots/${sidSpatial}/pages`, spatialKey);
        expect(pageSpatial.status).toBe(200);
        expect(pageSpatial.body.data.some(s => s.sampling?.location)).toBe(true);

        const metaSpatial = db.prepare('SELECT * FROM _exchange_snapshots WHERE id=?').get(sidSpatial);
        const prefixSpatial = `${metaSpatial.id}:${metaSpatial.connection_id}:${metaSpatial.high_water_sequence}:${metaSpatial.epoch}:${metaSpatial.auth_version}\n`;

        const receivedSpatialHasher = crypto.createHash('sha256').update(prefixSpatial);
        for (const s of pageSpatial.body.data) {
            receivedSpatialHasher.update(`${s.specimenId}:${JSON.stringify(s)}\n`);
        }
        expect(receivedSpatialHasher.digest('hex')).toBe(snapSpatial.body.digest);
    });

    test('Check 17: Storage pruner accurately previews and deletes aged incremental batches and receipts', async () => {
        const pruner = require('../../scripts/prune_exchange_storage.cjs');

        // Create an aged incremental change batch (snapshot_id IS NULL)
        const agedBatchId = 'batch_aged_incremental_' + Date.now();
        const oldTimestamp = '2020-01-01T00:00:00.000Z';
        db.prepare(`
            INSERT INTO _exchange_batches (id, connection_id, snapshot_id, start_seq, end_seq, item_count, created_at, auth_version, epoch)
            VALUES (?, 'conn-synthetic', NULL, 1, 10, 5, ?, 1, 'epoch-1')
        `).run(agedBatchId, oldTimestamp);

        const agedReceiptId = 'rcpt_aged_incremental_' + Date.now();
        db.prepare(`
            INSERT INTO _exchange_receipts (id, connection_id, snapshot_id, batch_id, imported_count, created_at, auth_version, epoch)
            VALUES (?, 'conn-synthetic', NULL, ?, 5, ?, 1, 'epoch-1')
        `).run(agedReceiptId, agedBatchId, oldTimestamp);

        // Dry run preview
        const preview = pruner.pruneExchangeStorage(databasePath, { dryRun: true });
        expect(preview.prunedBatches).toBeGreaterThanOrEqual(1);
        expect(preview.prunedReceipts).toBeGreaterThanOrEqual(1);

        // Verify still exists during dry run
        const batchCheck = db.prepare('SELECT id FROM _exchange_batches WHERE id = ?').get(agedBatchId);
        expect(batchCheck).toBeDefined();

        // Applied run
        const applied = pruner.pruneExchangeStorage(databasePath, { dryRun: false });
        expect(applied.prunedBatches).toBeGreaterThanOrEqual(1);
        expect(applied.prunedReceipts).toBeGreaterThanOrEqual(1);

        // Verify deleted after applied run
        const batchCheckAfter = db.prepare('SELECT id FROM _exchange_batches WHERE id = ?').get(agedBatchId);
        expect(batchCheckAfter).toBeUndefined();
        const receiptCheckAfter = db.prepare('SELECT id FROM _exchange_receipts WHERE id = ?').get(agedReceiptId);
        expect(receiptCheckAfter).toBeUndefined();
    });
});
