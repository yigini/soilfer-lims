'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const express = require('express');
const supertest = require('supertest');

describe('Issue #149 Head 932cb6a Remediation Contracts (Codex Independent Review)', () => {
    let dir, databasePath, setupDb, prisma, state, db, management, app, http;
    const admin = { id: 'synthetic-admin', role: 'SUPER_ADMIN', username: 'synthetic-review-admin' };

    const response = () => ({
        statusCode: 200,
        body: null,
        status(c) { this.statusCode = c; return this; },
        json(b) { this.body = b; return this; }
    });

    async function provision(name, scope = {}) {
        const common = { name, capabilities: ['SPATIAL', 'SNAPSHOT', 'RECEIPT'], countries: ['AAA'], projects: ['SYNTHETIC-PROJECT'], labs: ['SYNTHETIC-LAB'], ...scope };
        const c = response();
        await management.createConnection({ user: admin, body: common }, c);
        assert.equal(c.statusCode, 200);
        const r = response();
        await management.createApiKey({ user: admin, body: { ...common, connectionId: c.body.data.id } }, r);
        assert.equal(r.statusCode, 200);
        return { connectionId: c.body.data.id, keyId: r.body.keyInfo.id, token: r.body.apiKey };
    }

    async function get(url, key) { return http.get(url).set('x-api-key', key.token); }
    async function post(url, key, body) { return http.post(url).set('x-api-key', key.token).send(body); }
    async function rotate(key, operation, controller = management) {
        const r = response();
        await controller.rotateApiKey({ user: admin, headers: { 'idempotency-key': operation }, params: { id: key.keyId }, body: {} }, r);
        return r;
    }
    async function sibling(key, name) {
        const r = response();
        await management.createApiKey({ user: admin, body: { name, connectionId: key.connectionId, capabilities: ['SPATIAL', 'SNAPSHOT', 'RECEIPT'], countries: ['AAA'], projects: ['SYNTHETIC-PROJECT'], labs: ['SYNTHETIC-LAB'] } }, r);
        assert.equal(r.statusCode, 200);
        return { connectionId: key.connectionId, keyId: r.body.keyInfo.id, token: r.body.apiKey };
    }

    beforeAll(async () => {
        const root = path.resolve(__dirname, '../../..');
        dir = fs.mkdtempSync(path.join(root, 'server', 'issue149-jest-disposable-'));
        databasePath = path.join(dir, 'synthetic-test.db');
        process.env.DATABASE_PATH = databasePath;
        process.env.NODE_ENV = 'test';
        process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
        delete process.env.SOURCE_SYSTEM_ID;

        setupDb = new Database(databasePath);
        const now = new Date().toISOString();
        setupDb.exec(fs.readFileSync(path.join(root, 'server/scripts/schema/full_application_schema.sql'), 'utf8'));

        for (const [id, status, approvedAt, metadata] of [
            ['legacy-approved', 'APPROVED', now, null],
            ['legacy-unapproved-archive', 'ARCHIVED', null, null],
            ['legacy-approved-disposed', 'DISPOSED', now, null],
            ['legacy-held-approved', 'APPROVED', now, JSON.stringify({ provenanceHold: { status: 'AMBIGUOUS_PROVENANCE_HOLD' } })],
            ['legacy-processing-prior-approval', 'PROCESSING', now, null],
            ['legacy-resolved-hold', 'APPROVED', now, JSON.stringify({ provenanceHold: { status: 'RESOLVED', history: [{ status: 'AMBIGUOUS_PROVENANCE_HOLD' }] } })]
        ]) {
            setupDb.prepare('INSERT INTO Sample (id, originalId, labId, assignedLab, country, projectCode, status, approvedAt, updatedAt, latitude, longitude, metadata) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
                .run(id, id + '-field', id + '-accession', 'SYNTHETIC-LAB', 'AAA', 'SYNTHETIC-PROJECT', status, approvedAt, now, 12, 34, metadata);
            setupDb.prepare('INSERT INTO Result (id, sampleId, param, value, numericValue, unit, isValid, isCurrent, updatedAt) VALUES (?,?,?,?,?,?,?,?,?)')
                .run(id + '-result', id, 'PH_H2O', '6.2', 6.2, 'pH units', 1, 1, now);
        }
        setupDb.close();

        require('../../scripts/migrate_exchange_journal_tables.cjs').migrateExchangeTables(databasePath);

        prisma = require('../../prisma');
        state = require('../../services/exchangeStateService');
        db = state.getDb();
        management = require('../../controllers/sisController');

        app = express();
        app.use(express.json());
        app.use('/api/v1/sis', require('../../routes/sisRoutes'));
        app.use('/api/v2/data-exchange', require('../../routes/sisV2Routes'));
        http = supertest(app);

        await prisma.lab.create({ data: { id: 'SYNTHETIC-LAB', code: 'SYNTHETIC-LAB', name: 'Synthetic Lab', country: 'AAA' } });
    });

    afterAll(async () => {
        await prisma.$disconnect();
        if (db && db.open) db.close();
        try {
            fs.rmSync(dir, { recursive: true, force: true });
        } catch (e) {}
    });

    test('Package 1: Canonical hold and history predicate correctly backfills and publishes', async () => {
        const included = db.prepare('SELECT specimen_id FROM _exchange_journal ORDER BY specimen_id').all().map(x => x.specimen_id);
        expect(included).toEqual(['legacy-approved', 'legacy-approved-disposed', 'legacy-resolved-hold']);

        const reader = await provision('Package 1 reader');
        const r = await get('/api/v2/data-exchange/samples?limit=100', reader);
        expect(r.status).toBe(200);
        expect(r.body.data.map(x => x.specimenId).sort()).toEqual(included);
    });

    test('Package 1: Live hold metadata mutation records journal WITHDRAWAL with null payload', async () => {
        const before = db.prepare('SELECT MAX(sequence) n FROM _exchange_journal').get().n;
        await prisma.sample.update({ where: { id: 'legacy-approved' }, data: { metadata: JSON.stringify({ provenanceHold: { status: 'AMBIGUOUS_PROVENANCE_HOLD' } }) } });
        const heldEvent = db.prepare('SELECT event_type, payload FROM _exchange_journal WHERE specimen_id=? AND sequence>? ORDER BY sequence DESC LIMIT 1').get('legacy-approved', before);
        expect(heldEvent.event_type).toBe('WITHDRAWAL');
        expect(heldEvent.payload).toBeNull();

        // Restore for subsequent tests
        await prisma.sample.update({ where: { id: 'legacy-approved' }, data: { metadata: null } });
    });

    test('Package 1: Escaped JSON provenance hold is semantically excluded from live HTTP queries and stats', async () => {
        const reader = await provision('Escaped hold reader');
        const escaped = JSON.stringify({ provenanceHold: { status: 'AMBIGUOUS_PROVENANCE_HOLD' } }).replace('AMBIGUOUS', '\\u0041MBIGUOUS');
        expect(JSON.parse(escaped).provenanceHold.status).toBe('AMBIGUOUS_PROVENANCE_HOLD');
        await prisma.sample.update({ where: { id: 'legacy-held-approved' }, data: { metadata: escaped } });

        const r = await get('/api/v2/data-exchange/samples?limit=100', reader);
        expect(r.status).toBe(200);
        expect(r.body.data.some(x => x.specimenId === 'legacy-held-approved')).toBe(false);

        const sampleRecord = await prisma.sample.findUnique({ where: { id: 'legacy-held-approved' } });
        expect(state.isSpecimenEligible(sampleRecord)).toBe(false);

        const stats = await get('/api/v2/data-exchange/stats', reader);
        expect(stats.status).toBe(200);
        expect(stats.body.metrics.totalEligibleSamples).toBe(3); // legacy-approved, legacy-approved-disposed, legacy-resolved-hold
    });

    test('Package 2: Lost first rotation response retains old key within bounded overlap', async () => {
        const lost = await provision('Lost response key');
        const op = 'synthetic-lost-response';
        const first = await rotate(lost, op);
        expect(first.statusCode).toBe(200);
        expect(first.body.apiKey).toBeDefined();

        const retry = await rotate(lost, op);
        expect(retry.statusCode).toBe(200);
        expect(retry.body.apiKey).toBeUndefined();
        expect(retry.body.oldKeyActive).toBe(true);

        const httpRes = await get('/api/v2/data-exchange/samples', lost);
        expect(httpRes.status).toBe(200);
    });

    test('Package 2: Sibling key authentication preserves rotating key and updates replay truthfully', async () => {
        const target = await provision('Sibling isolation target');
        const op = 'synthetic-sibling-isolation';
        const first = await rotate(target, op);
        expect(first.statusCode).toBe(200);

        const unrelated = await sibling(target, 'Unrelated same-connection credential');
        const siblingRes = await get('/api/v2/data-exchange/samples', unrelated);
        expect(siblingRes.status).toBe(200);

        // Target rotating key MUST still be active
        const targetRes = await get('/api/v2/data-exchange/samples', target);
        expect(targetRes.status).toBe(200);

        const replay = await rotate(target, op);
        expect(replay.body.oldKeyActive).toBe(true);

        // Once replacement key authenticates, target key is retired
        const replRes = await get('/api/v2/data-exchange/samples', { token: first.body.apiKey });
        expect(replRes.status).toBe(200);

        const retiredRes = await get('/api/v2/data-exchange/samples', target);
        expect(retiredRes.status).toBe(401);

        const replayAfter = await rotate(target, op);
        expect(replayAfter.body.oldKeyActive).toBe(false);
    });

    test('Package 2: Abort operation restores old key, revokes replacement, and preserves sibling keys', async () => {
        const abortOld = await provision('Abort isolation target');
        const abortSibling = await sibling(abortOld, 'Independent same-connection credential');
        const abortFirst = await rotate(abortOld, 'synthetic-abort-target');
        expect(abortFirst.statusCode).toBe(200);

        const ar = response();
        await management.abortRotation({ user: admin, params: { id: abortOld.keyId } }, ar);
        expect(ar.statusCode).toBe(200);

        const siblingKey = await prisma.apiKey.findUnique({ where: { id: abortSibling.keyId } });
        expect(siblingKey.isActive).toBe(true);

        const oldKey = await prisma.apiKey.findUnique({ where: { id: abortOld.keyId } });
        expect(oldKey.isActive).toBe(true);

        const replKey = await prisma.apiKey.findUnique({ where: { id: abortFirst.body.keyInfo.id } });
        expect(replKey.isActive).toBe(false);
    });

    test('Package 2: Confirm operation retires old key, keeps replacement, and preserves sibling keys', async () => {
        const confirmOld = await provision('Confirm isolation target');
        const confirmSibling = await sibling(confirmOld, 'Independent sibling credential');
        const confirmFirst = await rotate(confirmOld, 'synthetic-confirm-target');
        expect(confirmFirst.statusCode).toBe(200);

        const cr = response();
        await management.confirmRotation({ user: admin, params: { id: confirmOld.keyId } }, cr);
        expect(cr.statusCode).toBe(200);

        const siblingKey = await prisma.apiKey.findUnique({ where: { id: confirmSibling.keyId } });
        expect(siblingKey.isActive).toBe(true);

        const oldKey = await prisma.apiKey.findUnique({ where: { id: confirmOld.keyId } });
        expect(oldKey.isActive).toBe(false);

        const replKey = await prisma.apiKey.findUnique({ where: { id: confirmFirst.body.keyInfo.id } });
        expect(replKey.isActive).toBe(true);
    });

    test('Package 2: listApiKeys returns keyStatus and isRotating flags', async () => {
        const lr = response();
        await management.listApiKeys({ user: admin }, lr);
        expect(lr.statusCode).toBe(200);
        expect(Array.isArray(lr.body.data)).toBe(true);
        for (const k of lr.body.data) {
            expect(k.keyStatus).toBeDefined();
            expect(typeof k.isRotating).toBe('boolean');
        }
    });

    test('Retention agreement: Prune preview and apply agree, preserving fresh receipt after snapshot expiry', async () => {
        const reader = await provision('Retention reader');
        const snap = await post('/api/v2/data-exchange/snapshots', reader, {});
        expect(snap.status).toBe(201);
        const receipt = await post('/api/v2/data-exchange/receipts', reader, {
            snapshotId: snap.body.snapshotId,
            receiptId: 'synthetic-retention-test-receipt',
            importedCount: 0,
            quarantinedCount: 0
        });
        expect(receipt.status).toBe(200);

        db.prepare('UPDATE _exchange_snapshots SET expires_at=? WHERE id=?').run('2020-01-01T00:00:00.000Z', snap.body.snapshotId);
        const pruner = require('../../scripts/prune_exchange_storage.cjs');
        const preview = pruner.pruneExchangeStorage(databasePath, { dryRun: true });
        const applied = pruner.pruneExchangeStorage(databasePath);
        expect(preview.prunedReceipts).toBe(0);
        expect(applied.prunedReceipts).toBe(0);
        expect(preview.prunedSnapshots).toBe(applied.prunedSnapshots);
    });
});
