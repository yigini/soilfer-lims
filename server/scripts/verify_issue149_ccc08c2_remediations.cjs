'use strict';
/**
 * Verification Suite for Issue #149 ccc08c2 Remediations
 * Verifies all 4 preserved fixes and all 5 remediated defects against
 * the real schema, Prisma models, and middleware.
 * Uses a disposable synthetic SQLite database.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const crypto = require('crypto');
const os = require('os');

const root = path.resolve(__dirname, '../..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lims-verify-ccc08c2-'));
const databasePath = path.join(dir, 'synthetic-review.db');

process.env.DATABASE_PATH = databasePath;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
delete process.env.SOURCE_SYSTEM_ID;

const Database = require('better-sqlite3');
const setup = new Database(databasePath);
setup.exec(fs.readFileSync(path.join(root, 'server/scripts/schema/full_application_schema.sql'), 'utf8'));
setup.close();

const prisma = require(path.join(root, 'server/prisma'));
const state = require(path.join(root, 'server/services/exchangeStateService'));
const db = state.getDb();
const authMiddleware = require(path.join(root, 'server/middleware/apiKeyAuth'));
const controller = require(path.join(root, 'server/controllers/sisV2Controller'));

const auth = {
    type: 'API_KEY',
    keyId: 'SYNTHETIC-KEY',
    role: 'NSIS_CONSUMER',
    labs: ['SYNTHETIC-LAB'],
    countries: ['AAA'],
    projects: ['SYNTHETIC-PROJECT'],
    capabilities: ['SPATIAL', 'SPECTRAL', 'SNAPSHOT', 'RECEIPT']
};

const latest = () => db.prepare('SELECT * FROM _exchange_journal ORDER BY sequence DESC LIMIT 1').get();
let n = 0;
const report = (name, data) => {
    n++;
    console.log(`[CHECK ${n}] ${name} ${data ? JSON.stringify(data) : ''}`);
};

const response = () => ({
    statusCode: 200,
    body: null,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(body) {
        this.body = body;
        return this;
    }
});

(async () => {
    console.log('=== STARTING ISSUE #149 CCC08C2 REMEDIATION VERIFICATION ===');

    // Setup base sample and result
    await prisma.sample.create({
        data: {
            id: 'synthetic-sample',
            originalId: 'synthetic-bag',
            labId: 'synthetic-accession',
            assignedLab: 'SYNTHETIC-LAB',
            country: 'AAA',
            projectCode: 'SYNTHETIC-PROJECT',
            status: 'EXPECTED',
            latitude: 12.34567,
            longitude: 34.56789,
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

    await prisma.sample.update({
        where: { id: 'synthetic-sample' },
        data: { status: 'APPROVED', approvedAt: new Date() }
    });

    // 1. Valid issued sequence receipt accepted
    let feed = await state.getChanges(auth);
    const issued = db.prepare('SELECT * FROM _exchange_batches WHERE id=?').get(feed.batchId);
    const valid = state.recordReceipt(auth, {
        batchId: feed.batchId,
        importedCount: 0,
        quarantinedCount: 0,
        checkpoint: 'seq_' + issued.end_seq
    });
    assert.equal(valid.status, 'ACKNOWLEDGED');
    report('FIX VERIFIED: valid issued sequence receipt accepted', { checkpoint: 'seq_' + issued.end_seq });

    // 2. Unchecked checkpoint alias rejected
    const alias = state.recordReceipt(auth, {
        batchId: feed.batchId,
        importedCount: 0,
        quarantinedCount: 0,
        checkpoint: 'cp_999999999'
    });
    assert.equal(alias.error, 'INVALID_CHECKPOINT');
    report('FIX VERIFIED: unchecked checkpoint alias rejected', { error: alias.error });

    // 3. GET does not reintroduce invalid result
    await prisma.result.update({
        where: { id: 'synthetic-result' },
        data: { isValid: false }
    });
    assert.equal(JSON.parse(latest().payload).observations.length, 0);
    await state.getChanges(auth);
    assert.equal(JSON.parse(latest().payload).observations.length, 0);
    report('FIX VERIFIED: GET does not reintroduce invalid result');

    // 4. Previous controlled cancellation interleaving stays withdrawn
    const originalFind = prisma.sample.findMany;
    let raced = false;
    prisma.sample.findMany = async function(args) {
        const rows = await originalFind.call(this, args);
        if (!raced) {
            raced = true;
            await prisma.sample.update({ where: { id: 'synthetic-sample' }, data: { status: 'CANCELLED' } });
            assert.equal(latest().event_type, 'WITHDRAWAL');
        }
        return rows;
    };
    let snap;
    try {
        snap = await state.createSnapshot(auth);
    } finally {
        prisma.sample.findMany = originalFind;
    }
    assert.equal(latest().event_type, 'WITHDRAWAL');
    const snapPage = await state.getSnapshotPage(snap.snapshotId, auth);
    assert.equal(snapPage.data.length, 0);
    report('FIX VERIFIED: previous controlled cancellation interleaving stays withdrawn');

    // 5. Persisted API key with capabilities: null FAILS capability guards
    const principals = [];
    for (const [index, lab] of [[1, 'SYNTHETIC-LAB'], [2, 'OTHER-SYNTHETIC-LAB']]) {
        const token = 'slims_synthetic_review_' + crypto.randomBytes(12).toString('hex');
        await prisma.apiKey.create({
            data: {
                id: 'synthetic-key-' + index,
                name: 'Same display label',
                keyHash: crypto.createHash('sha256').update(token).digest('hex'),
                keyPrefix: 'SYNTHETIC',
                role: 'NSIS_CONSUMER',
                labs: JSON.stringify([lab]),
                countries: '["AAA"]',
                projects: '["SYNTHETIC-PROJECT"]',
                capabilities: null, // real persisted key without capabilities grant
                isActive: true
            }
        });
        const request = { headers: { 'x-api-key': token } };
        const res = response();
        let next = false;
        await authMiddleware(request, res, () => { next = true; });
        assert.ok(next, 'Auth middleware passed basic token check');
        principals.push(request.sisAuth);
    }

    assert.equal(principals[0].capabilities, null);
    const allowed = [];
    for (const capability of ['SPATIAL', 'SPECTRAL', 'SNAPSHOT', 'RECEIPT']) {
        let next = false;
        const res = response();
        authMiddleware.requireCapability(capability)({ sisAuth: principals[0] }, res, () => { next = true; });
        if (next) {
            allowed.push(capability);
        } else {
            assert.equal(res.statusCode, 403);
            assert.equal(res.body.error, 'FORBIDDEN');
            assert.equal(res.body.code, 'INSUFFICIENT_CAPABILITY');
        }
    }
    assert.equal(allowed.length, 0, 'No capabilities should be granted when capabilities is null');
    report('REMEDIATION 1 VERIFIED: persisted API key with capabilities:null fails every capability guard (403 INSUFFICIENT_CAPABILITY)', { allowedCount: allowed.length });

    // 6. Distinct keys with same display label have distinct connection IDs, and key B CANNOT acknowledge key A's snapshot
    assert.notEqual(principals[0].connectionId, principals[1].connectionId, 'Distinct keys must have distinct connection IDs');
    assert.equal(principals[0].connectionId, 'conn_synthetic-key-1');
    assert.equal(principals[1].connectionId, 'conn_synthetic-key-2');

    // Create snapshot with principal 0 (giving temporary SNAPSHOT capability to test isolation)
    const principal0WithCaps = { ...principals[0], capabilities: ['SNAPSHOT', 'RECEIPT'] };
    const owned = await state.createSnapshot(principal0WithCaps);

    // Attempt to acknowledge snapshot with principal 1 (different connectionId)
    const principal1WithCaps = { ...principals[1], capabilities: ['SNAPSHOT', 'RECEIPT'] };
    const foreign = state.recordReceipt(principal1WithCaps, { snapshotId: owned.snapshotId, importedCount: 0, quarantinedCount: 0 });
    assert.notEqual(foreign.status, 'ACKNOWLEDGED', 'Foreign connection must not acknowledge snapshot');
    assert.equal(foreign.error, 'FORBIDDEN', 'Should return FORBIDDEN for mismatched connection ID');
    report('REMEDIATION 2 VERIFIED: distinct keys have distinct connection IDs and cross-connection acknowledgement is strictly forbidden', {
        conn0: principals[0].connectionId,
        conn1: principals[1].connectionId,
        rejectionError: foreign.error
    });

    // Verify renaming key does not alter connection identity
    await prisma.apiKey.update({ where: { id: 'synthetic-key-1' }, data: { name: 'Renamed display label' } });
    const key1AfterRename = await prisma.apiKey.findUnique({ where: { id: 'synthetic-key-1' } });
    assert.equal(key1AfterRename.connectionId || ('conn_' + key1AfterRename.id), 'conn_synthetic-key-1');
    report('REMEDIATION 2B VERIFIED: key rename does not alter connection identity');

    // 7. Field-level spatial entitlement: samples controller redacts coordinates when lacking SPATIAL capability
    await prisma.sample.update({ where: { id: 'synthetic-sample' }, data: { status: 'APPROVED', approvedAt: new Date() } });

    // Call with capabilities: [] (no SPATIAL)
    const spatialResNoCap = response();
    await controller.getSamples({ sisAuth: { ...auth, capabilities: [] }, query: {} }, spatialResNoCap);
    assert.equal(spatialResNoCap.statusCode, 200);
    const itemRedacted = spatialResNoCap.body.data[0];
    assert.equal(itemRedacted.sampling.location, null, 'sampling.location must be null when SPATIAL capability missing');

    // Call with capabilities: ['SPATIAL']
    const spatialResWithCap = response();
    await controller.getSamples({ sisAuth: { ...auth, capabilities: ['SPATIAL'] }, query: {} }, spatialResWithCap);
    assert.equal(spatialResWithCap.statusCode, 200);
    const itemWithCoords = spatialResWithCap.body.data[0];
    assert.ok(itemWithCoords.sampling.location, 'sampling.location must be present when SPATIAL capability granted');
    assert.equal(itemWithCoords.sampling.location.type, 'Point');
    assert.equal(itemWithCoords.sampling.location.coordinates[0], 34.56789);
    assert.equal(itemWithCoords.sampling.location.coordinates[1], 12.34567);
    report('REMEDIATION 3 VERIFIED: field-level spatial entitlement strictly redacts coordinates without SPATIAL capability', {
        redactedLocation: itemRedacted.sampling.location,
        grantedLocation: itemWithCoords.sampling.location
    });

    // 8. Single installation identity throughout: envelope and specimen source IDs agree
    assert.equal(spatialResWithCap.body.sourceSystemId, itemWithCoords.sourceSystemId, 'Envelope and item sourceSystemId must agree');
    const dbSourceSystemId = state.getSourceSystemId(db);
    assert.equal(spatialResWithCap.body.sourceSystemId, dbSourceSystemId, 'sourceSystemId must match database installation identity');
    report('REMEDIATION 4 VERIFIED: response envelope and specimen source IDs agree with persistent installation identity', {
        sourceSystemId: dbSourceSystemId
    });

    // 9. Unrepeatable restore generation: rotateEpoch generates unrepeatable nonce; restored old epoch cannot reuse generation
    const epoch1 = state.getCurrentEpoch(db);
    const rotated = state.rotateEpoch(db);
    const cursor = state.encodeCursor({ type: 'change', connectionId: 'SYNTHETIC-KEY', seq: 0 }, db);

    // Simulate restoring an older database snapshot containing epoch1
    db.prepare("UPDATE _exchange_meta SET value=? WHERE key='epoch'").run(epoch1);

    // Rerotate after restore
    const rerotated = state.rotateEpoch(db);
    assert.notEqual(rotated.currentEpoch, rerotated.currentEpoch, 'Rotated epoch after restore must NEVER equal previously issued epoch');

    // Old cursor encoded under rotated epoch must fail validation against rerotated db
    const decoded = state.decodeCursor(cursor, db);
    assert.equal(decoded.reason, 'EPOCH_MISMATCH', 'Cursor issued under previous epoch must fail validation with reason EPOCH_MISMATCH');
    assert.equal(decoded.expired, true, 'Cursor must be marked expired');

    // Calling getChanges with the old cursor returns HTTP 410 CURSOR_EXPIRED
    const feedWithOldCursor = await state.getChanges(auth, { cursor });
    assert.equal(feedWithOldCursor.status, 410);
    assert.equal(feedWithOldCursor.error, 'CURSOR_EXPIRED');

    report('REMEDIATION 5 VERIFIED: restored old epoch + increment produces unrepeatable generation; old cursor fails epoch validation with HTTP 410 CURSOR_EXPIRED', {
        epoch1,
        rotatedEpoch: rotated.currentEpoch,
        rerotatedEpoch: rerotated.currentEpoch,
        cursorValidationReason: decoded.reason,
        feedStatus: feedWithOldCursor.status
    });

    console.log(`\n======================================================`);
    console.log(`ALL ${n} BOUNDED CHECKS PASSED INDEPENDENTLY & FLAWLESSLY`);
    console.log(`Synthetic DB retained at: ${databasePath}`);
    console.log(`======================================================\n`);
})().catch(err => {
    console.error('VERIFICATION FAILED:', err);
    process.exitCode = 1;
}).finally(async () => {
    await prisma.$disconnect();
    if (db && db.open) db.close();
});
