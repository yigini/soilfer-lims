'use strict';
/**
 * Self-contained verification for issue149 remediations addressing Codex review of head 3643053.
 * Runs on disposable isolated SQLite database outside production.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const crypto = require('crypto');
const os = require('os');

const root = path.resolve(__dirname, '../..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'issue149-verify-3643053-'));
const databasePath = path.join(dir, 'disposable-review.db');

process.env.DATABASE_PATH = databasePath;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
delete process.env.SOURCE_SYSTEM_ID;

const Database = require('better-sqlite3');
const setup = new Database(databasePath);
setup.exec(fs.readFileSync(path.join(root, 'server/scripts/schema/full_application_schema.sql'), 'utf8'));
setup.close();

require('../scripts/migrate_exchange_journal_tables.cjs').migrateExchangeTables(databasePath);

const prisma = require('../prisma');
const state = require('../services/exchangeStateService');
const db = state.getDb();
const middleware = require('../middleware/apiKeyAuth');
const v2 = require('../controllers/sisV2Controller');
const management = require('../controllers/sisController');

const admin = { role: 'SUPER_ADMIN', username: 'synthetic-review-admin' };
const response = () => ({
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; }
});

let checks = 0;
const report = (name, data) => {
    checks++;
    console.log(`[PASS] Check ${checks}: ${name} ${data ? JSON.stringify(data) : ''}`);
};

async function authenticate(token) {
    const r = { headers: { 'x-api-key': token } };
    const s = response();
    let next = false;
    await middleware(r, s, () => { next = true; });
    return { next, auth: r.sisAuth, res: s };
}

(async () => {
    console.log('--- Starting Issue 149 (Head 3643053 Remediations) Verification ---');

    await prisma.lab.create({ data: { id: 'SYNTHETIC-LAB', code: 'SYNTHETIC-LAB', name: 'Synthetic Lab', country: 'AAA' } });
    await prisma.sample.create({
        data: {
            id: 'synthetic-sample',
            originalId: 'synthetic-bag',
            labId: 'synthetic-accession',
            assignedLab: 'SYNTHETIC-LAB',
            country: 'AAA',
            projectCode: 'SYNTHETIC-PROJECT',
            status: 'EXPECTED',
            latitude: 12,
            longitude: 34,
            depthTopCm: 0,
            depthBottomCm: 20
        }
    });
    await prisma.result.create({
        data: {
            id: 'synthetic-result',
            sampleId: 'synthetic-sample',
            param: 'PH_H2O',
            value: '6.2',
            numericValue: 6.2,
            unit: 'pH units',
            isValid: true,
            isCurrent: true
        }
    });
    await prisma.sample.update({ where: { id: 'synthetic-sample' }, data: { status: 'APPROVED', approvedAt: new Date() } });

    // Create 2 keys with identical label
    const keys = [];
    for (let i = 1; i <= 2; i++) {
        const token = 'slims_synthetic_' + crypto.randomBytes(12).toString('hex');
        await prisma.apiKey.create({
            data: {
                id: 'synthetic-key-' + i,
                name: 'Same label',
                keyHash: crypto.createHash('sha256').update(token).digest('hex'),
                keyPrefix: 'SYNTHETIC',
                role: 'NSIS_CONSUMER',
                labs: '["SYNTHETIC-LAB"]',
                countries: '["AAA"]',
                projects: '["SYNTHETIC-PROJECT"]',
                isActive: true
            }
        });
        keys.push({ token, ...await authenticate(token) });
        assert.ok(keys[i - 1].next);
    }

    // 1. Absent capability grants are denied
    let allowed = 0;
    for (const cap of ['SPATIAL', 'SPECTRAL', 'SNAPSHOT', 'RECEIPT']) {
        middleware.requireCapability(cap)({ sisAuth: keys[0].auth }, response(), () => allowed++);
    }
    assert.equal(allowed, 0);
    report('Absent persisted capability grants are denied fail-closed');

    // 2. Identical labels no longer share artifact ownership
    assert.notEqual(keys[0].auth.connectionId, keys[1].auth.connectionId);
    const snap = await state.createSnapshot(keys[0].auth);
    const foreignReceipt = state.recordReceipt(keys[1].auth, { snapshotId: snap.snapshotId, importedCount: 0, quarantinedCount: 0 });
    assert.equal(foreignReceipt.error, 'FORBIDDEN');
    report('Identical key labels do not share artifact ownership; foreign receipt rejected with FORBIDDEN');

    // 3. V2 samples redact location without SPATIAL
    const sampleRes = response();
    await v2.getSamples({ sisAuth: keys[0].auth, query: {} }, sampleRes);
    assert.equal(sampleRes.statusCode, 200);
    assert.equal(sampleRes.body.data[0].sampling.location, null);
    report('V2 samples redact location without SPATIAL capability');

    // 4. Initialized migration identity matches envelope, item and initial publication
    assert.equal(sampleRes.body.sourceSystemId, sampleRes.body.data[0].sourceSystemId);
    const published = db.prepare('SELECT payload FROM _exchange_journal WHERE payload IS NOT NULL ORDER BY sequence LIMIT 1').get();
    assert.equal(JSON.parse(published.payload).sourceSystemId, sampleRes.body.sourceSystemId);
    report('Initialized migration identity matches envelope, item and initial publication');

    // 5. Restored epoch state followed by rotation rejects earlier generation
    const epoch = state.getCurrentEpoch(db);
    const first = state.rotateEpoch(db);
    const cursor = state.encodeCursor({ type: 'change', connectionId: keys[0].auth.connectionId, seq: 0 }, db);
    db.prepare("UPDATE _exchange_meta SET value=? WHERE key='epoch'").run(epoch);
    const second = state.rotateEpoch(db);
    assert.notEqual(first.currentEpoch, second.currentEpoch);
    assert.equal(state.decodeCursor(cursor, db).reason, 'EPOCH_MISMATCH');
    report('Restored epoch state followed by rotation rejects earlier generation');

    // 6. Legacy sync redacts coordinates when caller lacks SPATIAL capability
    const legacy = response();
    await management.syncDelta({ sisAuth: keys[0].auth, query: { updatedSince: '2020-01-01T00:00:00Z' } }, legacy);
    assert.equal(legacy.statusCode, 200);
    assert.equal(legacy.body.samples[0].provenance.coordinates, null);
    report('REMEDIATED: Legacy sync delta strictly redacts coordinates when key lacks SPATIAL');

    // 7. Management capability reduction and auth-version increment immediately invalidates key authority and old cursor
    const created = response();
    await management.createConnection({
        user: admin,
        body: {
            name: 'Controlled synthetic connection',
            capabilities: ['SPATIAL', 'SNAPSHOT', 'RECEIPT'],
            countries: ['AAA'],
            projects: ['SYNTHETIC-PROJECT'],
            labs: ['SYNTHETIC-LAB']
        }
    }, created);
    assert.equal(created.statusCode, 200);
    const connectionId = created.body.data.id;

    const keyRes = response();
    await management.createApiKey({
        user: admin,
        body: {
            name: 'Managed synthetic key',
            connectionId,
            capabilities: ['SPATIAL', 'SNAPSHOT', 'RECEIPT'],
            countries: ['AAA'],
            projects: ['SYNTHETIC-PROJECT'],
            labs: ['SYNTHETIC-LAB']
        }
    }, keyRes);
    assert.ok(keyRes.statusCode < 300);
    const token = keyRes.body.apiKey;
    const keyId = keyRes.body.keyInfo.id;

    const before = await authenticate(token);
    assert.ok(before.next);
    let beforeSpatial = false;
    middleware.requireCapability('SPATIAL')({ sisAuth: before.auth }, response(), () => beforeSpatial = true);
    assert.equal(beforeSpatial, true);

    const issued = await state.getChanges(before.auth);
    assert.ok(issued.nextCursor);

    // Reduce capabilities on connection
    const reduced = response();
    await management.updateConnection({
        user: admin,
        params: { id: connectionId },
        body: { capabilities: [] }
    }, reduced);
    assert.equal(reduced.statusCode, 200);

    const after = await authenticate(token);
    assert.ok(after.next);
    let afterSpatial = false;
    middleware.requireCapability('SPATIAL')({ sisAuth: after.auth }, response(), () => afterSpatial = true);
    assert.equal(afterSpatial, false, 'SPATIAL must be denied after capability reduction on connection');

    const version = db.prepare('SELECT auth_version FROM _exchange_connections WHERE id=?').get(connectionId).auth_version;
    assert.equal(version, 2);
    assert.equal(after.auth.authVersion, 2);

    const oldProgress = await state.getChanges(after.auth, { cursor: issued.nextCursor });
    assert.equal(oldProgress.error, 'CURSOR_EXPIRED', 'Old cursor must be rejected with CURSOR_EXPIRED after auth_version increment');
    report('REMEDIATED: Connection capability reduction immediately restricts key authority and expires old cursor', {
        newAuthVersion: version,
        spatialAllowed: afterSpatial,
        cursorResultError: oldProgress.error
    });

    // 8. Disabling connection immediately stops key authentication
    const disabled = response();
    await management.updateConnection({
        user: admin,
        params: { id: connectionId },
        body: { status: 'DISABLED' }
    }, disabled);
    assert.equal(disabled.statusCode, 200);

    const disabledAuth = await authenticate(token);
    assert.equal(disabledAuth.next, false, 'authenticate must not call next when connection is DISABLED');
    assert.equal(disabledAuth.res.statusCode, 403, 'authenticate must return 403 when connection is DISABLED');
    assert.equal(disabledAuth.res.body.code, 'CONNECTION_DISABLED');

    const stillRead = response();
    await v2.getSamples({ sisAuth: disabledAuth.auth || { connectionStatus: 'DISABLED', connectionId }, query: {} }, stillRead);
    assert.equal(stillRead.statusCode, 403, 'getSamples must return 403 for disabled connection');
    report('REMEDIATED: Disabling connection halts key authentication and all V2 consumer access with 403 CONNECTION_DISABLED');

    // 9. Failed replacement-key insert rolls back atomically leaving old key active
    const reenabled = response();
    await management.updateConnection({
        user: admin,
        params: { id: connectionId },
        body: { status: 'ACTIVE' }
    }, reenabled);
    assert.equal(reenabled.statusCode, 200);

    assert.equal((await prisma.apiKey.findUnique({ where: { id: keyId } })).isActive, true);

    // Injected trigger: replacement key insert MUST fail
    db.exec("CREATE TRIGGER synthetic_rotation_insert_failure BEFORE INSERT ON ApiKey BEGIN SELECT RAISE(ABORT, 'SYNTHETIC_REVIEW_INSERT_FAILURE'); END");

    const rotation = response();
    await management.rotateApiKey({ user: admin, params: { id: keyId } }, rotation);
    assert.equal(rotation.statusCode, 500);

    // Verify old key remains ACTIVE and was not revoked
    const oldKeyAfterFailedRotation = await prisma.apiKey.findUnique({ where: { id: keyId } });
    assert.equal(oldKeyAfterFailedRotation.isActive, true, 'Old key must remain active when rotation transaction aborts');
    report('REMEDIATED: Failed replacement-key insert rolls back atomically leaving old key intact and active', {
        rotationStatusCode: rotation.statusCode,
        oldKeyActive: oldKeyAfterFailedRotation.isActive
    });

    // 10. Clean rotation succeeds when trigger removed
    db.exec("DROP TRIGGER synthetic_rotation_insert_failure");
    const cleanRotation = response();
    await management.rotateApiKey({ user: admin, params: { id: keyId } }, cleanRotation);
    assert.equal(cleanRotation.statusCode, 200);
    assert.ok(cleanRotation.body.apiKey);
    const oldKeyRetired = await prisma.apiKey.findUnique({ where: { id: keyId } });
    assert.equal(oldKeyRetired.isActive, false);
    const newKeyCreated = await prisma.apiKey.findUnique({ where: { id: cleanRotation.body.keyInfo.id } });
    assert.equal(newKeyCreated.isActive, true);
    assert.equal(newKeyCreated.connectionId, connectionId);
    report('REMEDIATED: Clean rotation atomically creates replacement key and retires old key');

    console.log(`\nAll ${checks} verification checks PASSED successfully!`);
})().catch(e => {
    console.error('[FAILED]', e);
    process.exitCode = 1;
}).finally(async () => {
    await prisma.$disconnect();
    if (db.open) db.close();
    try {
        fs.rmSync(dir, { recursive: true, force: true });
    } catch (e) {}
});
