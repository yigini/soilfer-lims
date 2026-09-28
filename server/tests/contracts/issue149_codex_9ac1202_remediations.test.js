'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const Database = require('better-sqlite3');
const supertest = require('supertest');
const express = require('express');

describe('Issue #149 Head 9ac1202 Remediation Contracts (Codex Independent Review)', () => {
    let dir;
    let databasePath;
    let db;
    let app;
    let http;
    let prisma;
    let management;
    let state;
    let admin;
    let reader;

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
        expect(c.statusCode).toBe(200);
        const r = response();
        await management.createApiKey({ user: admin, body: { ...common, connectionId: c.body.data.id } }, r);
        expect(r.statusCode).toBe(200);
        return { connectionId: c.body.data.id, keyId: r.body.keyInfo.id, token: r.body.apiKey };
    }

    async function get(url, key) { return http.get(url).set('x-api-key', key.token); }
    async function rotate(key, operation) {
        const r = response();
        await management.rotateApiKey({ user: admin, headers: { 'idempotency-key': operation }, params: { id: key.keyId }, body: {} }, r);
        return r;
    }

    beforeAll(async () => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jest-9ac1202-'));
        databasePath = path.join(dir, 'test-remediations.db');
        process.env.DATABASE_PATH = databasePath;
        process.env.NODE_ENV = 'test';
        process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
        delete process.env.SOURCE_SYSTEM_ID;

        const setup = new Database(databasePath);
        const now = new Date().toISOString();
        setup.exec(fs.readFileSync(path.join(__dirname, '../../scripts/schema/full_application_schema.sql'), 'utf8'));

        for (const [id, status, approvedAt, metadata] of [
            ['legacy-approved', 'APPROVED', now, null],
            ['legacy-unapproved-archive', 'ARCHIVED', null, null],
            ['legacy-approved-disposed', 'DISPOSED', now, null],
            ['legacy-held-approved', 'APPROVED', now, JSON.stringify({ provenanceHold: { status: 'AMBIGUOUS_PROVENANCE_HOLD' } })],
            ['legacy-processing-prior-approval', 'PROCESSING', now, null]
        ]) {
            setup.prepare('INSERT INTO Sample (id,originalId,labId,assignedLab,country,projectCode,status,approvedAt,updatedAt,latitude,longitude,metadata) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
                .run(id, id + '-field', id + '-accession', 'SYNTHETIC-LAB', 'AAA', 'SYNTHETIC-PROJECT', status, approvedAt, now, 12, 34, metadata);
            setup.prepare('INSERT INTO Result (id,sampleId,param,value,numericValue,unit,isValid,isCurrent,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)')
                .run(id + '-result', id, 'PH_H2O', '6.2', 6.2, 'pH units', 1, 1, now);
        }
        setup.close();

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

        admin = { id: 'synthetic-admin', role: 'SUPER_ADMIN', username: 'synthetic-review-admin' };

        await prisma.lab.create({ data: { id: 'SYNTHETIC-LAB', code: 'SYNTHETIC-LAB', name: 'Synthetic Lab', country: 'AAA' } });
        reader = await provision('Jest reader');
    });

    afterAll(async () => {
        if (prisma) await prisma.$disconnect();
        if (db && db.open) db.close();
        try { if (dir) fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
    });

    test('Package 1: JSON null metadata consistently excluded across canonical predicate, sample list & count, and observations', async () => {
        await prisma.sample.update({ where: { id: 'legacy-held-approved' }, data: { metadata: 'null' } });

        const sample = await prisma.sample.findUnique({ where: { id: 'legacy-held-approved' } });
        expect(state.isSpecimenEligible(sample)).toBe(false);

        const r = await get('/api/v2/data-exchange/samples?limit=100', reader);
        expect(r.status).toBe(200);
        expect(r.body.total).toBe(2);
        expect(r.body.data.length).toBe(2);

        const obs = await get('/api/v2/data-exchange/observations?limit=100', reader);
        expect(obs.status).toBe(200);
        expect(obs.body.data.some(x => x.specimenId === 'legacy-held-approved')).toBe(false);
    });

    test('Package 2: Confirm rejected with 409 when replacement key is revoked (no resurrection)', async () => {
        const parentKey = await provision('Revoked replacement test parent');
        const rotRes = await rotate(parentKey, 'test-revoked-replacement-op');
        expect(rotRes.statusCode).toBe(200);
        const repl = { keyId: rotRes.body.keyInfo.id, token: rotRes.body.apiKey };

        // Revoke replacement key
        const revRes = response();
        await management.revokeApiKey({ user: admin, params: { id: repl.keyId } }, revRes);
        expect(revRes.statusCode).toBe(200);

        // Verify replacement is 401
        expect((await get('/api/v2/data-exchange/samples', repl)).status).toBe(401);

        // Confirm MUST return 409 and NOT resurrect
        const confRes = response();
        await management.confirmRotation({ user: admin, params: { id: parentKey.keyId } }, confRes);
        expect(confRes.statusCode).toBe(409);
        expect(confRes.body.code).toBe('KEY_REVOKED');

        // Replacement key MUST remain 401
        expect((await get('/api/v2/data-exchange/samples', repl)).status).toBe(401);
    });

    test('Package 2: Abort rejected with 409 when original key is revoked (no resurrection)', async () => {
        const parentKey = await provision('Revoked original test parent');
        const rotRes = await rotate(parentKey, 'test-revoked-original-op');
        expect(rotRes.statusCode).toBe(200);

        // Revoke original key
        const revRes = response();
        await management.revokeApiKey({ user: admin, params: { id: parentKey.keyId } }, revRes);
        expect(revRes.statusCode).toBe(200);

        // Verify original key is 401
        expect((await get('/api/v2/data-exchange/samples', parentKey)).status).toBe(401);

        // Abort MUST return 409 and NOT resurrect
        const abortRes = response();
        await management.abortRotation({ user: admin, params: { id: parentKey.keyId } }, abortRes);
        expect(abortRes.statusCode).toBe(409);
        expect(abortRes.body.code).toBe('KEY_REVOKED');

        // Original key MUST remain 401
        expect((await get('/api/v2/data-exchange/samples', parentKey)).status).toBe(401);
    });

    test('Package 2: Confirm and abort return 404 when no pending rotation operation exists', async () => {
        const randomKey = await provision('Unrotated key');
        const confRes = response();
        await management.confirmRotation({ user: admin, params: { id: randomKey.keyId } }, confRes);
        expect(confRes.statusCode).toBe(404);
        expect(confRes.body.code).toBe('ROTATION_NOT_FOUND');

        const abortRes = response();
        await management.abortRotation({ user: admin, params: { id: randomKey.keyId } }, abortRes);
        expect(abortRes.statusCode).toBe(404);
        expect(abortRes.body.code).toBe('ROTATION_NOT_FOUND');
    });

    test('Package 2: Normal confirm retires old key and activates replacement', async () => {
        const parentKey = await provision('Normal confirm test parent');
        const rotRes = await rotate(parentKey, 'test-normal-confirm-op');
        expect(rotRes.statusCode).toBe(200);
        const repl = { keyId: rotRes.body.keyInfo.id, token: rotRes.body.apiKey };

        const confRes = response();
        await management.confirmRotation({ user: admin, params: { id: parentKey.keyId } }, confRes);
        expect(confRes.statusCode).toBe(200);

        expect((await get('/api/v2/data-exchange/samples', repl)).status).toBe(200);
        expect((await get('/api/v2/data-exchange/samples', parentKey)).status).toBe(401);

        // Idempotent second confirm returns 200
        const confRes2 = response();
        await management.confirmRotation({ user: admin, params: { id: parentKey.keyId } }, confRes2);
        expect(confRes2.statusCode).toBe(200);

        // Abort after confirm returns 409
        const abortAfterConf = response();
        await management.abortRotation({ user: admin, params: { id: parentKey.keyId } }, abortAfterConf);
        expect(abortAfterConf.statusCode).toBe(409);
        expect(abortAfterConf.body.code).toBe('ROTATION_ALREADY_CONFIRMED');
    });

    test('Package 2: Normal abort restores old key and revokes replacement', async () => {
        const parentKey = await provision('Normal abort test parent');
        const rotRes = await rotate(parentKey, 'test-normal-abort-op');
        expect(rotRes.statusCode).toBe(200);
        const repl = { keyId: rotRes.body.keyInfo.id, token: rotRes.body.apiKey };

        const abortRes = response();
        await management.abortRotation({ user: admin, params: { id: parentKey.keyId } }, abortRes);
        expect(abortRes.statusCode).toBe(200);

        expect((await get('/api/v2/data-exchange/samples', parentKey)).status).toBe(200);
        expect((await get('/api/v2/data-exchange/samples', repl)).status).toBe(401);

        // Idempotent second abort returns 200
        const abortRes2 = response();
        await management.abortRotation({ user: admin, params: { id: parentKey.keyId } }, abortRes2);
        expect(abortRes2.statusCode).toBe(200);

        // Confirm after abort returns 409
        const confAfterAbort = response();
        await management.confirmRotation({ user: admin, params: { id: parentKey.keyId } }, confAfterAbort);
        expect(confAfterAbort.statusCode).toBe(409);
        expect(confAfterAbort.body.code).toBe('ROTATION_ALREADY_ABORTED');
    });
});
