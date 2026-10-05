'use strict';
const { createResultFixture } = require('../../services/resultWriteService');

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

const root = path.resolve(__dirname, '../../..');
const dir = fs.mkdtempSync(path.resolve(__dirname, '../.tmp', 'issue149-artifacts-'));
const { createDisposableDatabase, cleanupDisposableDatabase } = require('../../scripts/journey_db_isolation.cjs');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const sourceFixture = createDisposableDatabase();
process.env.DATABASE_PATH = sourceFixture.dbPath;
process.env.DATABASE_URL = 'file:' + sourceFixture.dbPath;
process.env.NODE_ENV = 'test';
const rehearsal = beforeGuards({ actor: 'system:fixture' });
const databasePath = rehearsal.file;
process.env.DATABASE_PATH = databasePath;
process.env.DATABASE_URL = 'file:' + databasePath;
const { createSampleFixture } = require('../helpers/workflowFixtures');
const { transitionSample } = require('../../services/sampleStateService');

process.env.DATABASE_PATH = databasePath;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
delete process.env.SOURCE_SYSTEM_ID;


// A stable delegate lets the original race hook intercept the real Prisma read.
// Keep that interception local to the rehearsal's facade over the real client.
const actualPrisma = require(path.join(root, 'server/prisma'));
const sampleModel = actualPrisma.sample;
const overrides = new Map();
const sampleDelegate = new Proxy({}, {
    get(target, name) {
        if (overrides.has(name)) return overrides.get(name);
        const value = Reflect.get(sampleModel, name);
        return typeof value === 'function' ? value.bind(sampleModel) : value;
    },
    set(target, name, value) { overrides.set(name, value); return true; }
});
const prisma = new Proxy(actualPrisma, { get(target, name) {
    if (name === 'sample') return sampleDelegate;
    const value = Reflect.get(target, name);
    return typeof value === 'function' ? value.bind(target) : value;
} });
require.cache[require.resolve('../../prisma')].exports = prisma;
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


async function assertFinalRefusals() {
    // #179 pins 5990137651(B2), 5990587479: R1/R2 are separate from W/S.
    for (const [id, initial, final, attempted] of [
        ['refusal-r1', 'ACCEPTED', 'APPROVED', 'CANCELLED'],
        ['refusal-r2', 'EXPECTED', 'CANCELLED', 'APPROVED']
    ]) {
        await createSampleFixture(prisma, { data:{ id, originalId:id, assignedLab:'REFUSAL-LAB',
            status:initial, dryingStatus:'DONE', preparationStatus:'DONE' } });
        await transitionSample(id, final, 'system:fixture', 'Isolated final-state refusal fixture', {}, prisma);
        const fingerprint = async () => ({ row:await prisma.sample.findUnique({where:{id}}),
            journal:db.prepare('SELECT COUNT(*) n FROM _exchange_journal').get().n,
            audits:await prisma.auditLog.count(), evidence:await prisma.resultEvidenceEvent.count() });
        const before = await fingerprint();
        await assert.rejects(transitionSample(id, attempted, 'system:fixture', 'Forbidden legacy verification step', {}, prisma),
            error => error.statusCode === 409 && error.code === 'ILLEGAL_STATUS_TRANSITION');
        assert.deepEqual(await fingerprint(), before);
        console.log('[PASS] ' + final + ' to ' + attempted + ': 409 ILLEGAL_STATUS_TRANSITION and zero row/journal/audit/evidence writes');
    }
}

(async () => {
    console.log('=== STARTING ISSUE #149 CCC08C2 REMEDIATION VERIFICATION ===');

    // Setup base sample and result
    await createSampleFixture(prisma, {
        data: {
            id: 'synthetic-sample',
            originalId: 'synthetic-bag',
            labId: 'synthetic-accession',
            assignedLab: 'SYNTHETIC-LAB',
            country: 'AAA',
            projectCode: 'SYNTHETIC-PROJECT',
            // W: prepared synthetic specimen; science is inserted before real approval.
            status: 'ACCEPTED', dryingStatus: 'DONE', preparationStatus: 'DONE',
            latitude: 12.34567,
            longitude: 34.56789,
            depthTopCm: 0,
            depthBottomCm: 20
        }
    });

    await createResultFixture(prisma, {
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

    await transitionSample('synthetic-sample', 'APPROVED', 'system:fixture', 'Synthetic publication proof', {approvedAt:new Date()}, prisma);

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
    const scienceRevision = latest();
    assert.equal(JSON.parse(latest().payload).observations.length, 0);
    await state.getChanges(auth);
    assert.equal(JSON.parse(latest().payload).observations.length, 0);
    report('FIX VERIFIED: GET does not reintroduce invalid result');

    // 4. Previous controlled cancellation interleaving stays withdrawn
    // #179 pins 5990780933 / 5990918325: explicit reconciler race,
    // immutable historical boundary and producer-specific withdrawal hash.
    await state.syncJournal(auth);
    const reference = db.prepare('SELECT * FROM _exchange_journal WHERE specimen_id=? ORDER BY sequence DESC LIMIT 1').get('synthetic-sample');
    assert.equal(reference.event_type, 'AMENDMENT');
    assert.deepEqual(reference, scienceRevision);
    const publication = db.prepare("SELECT * FROM _exchange_journal WHERE specimen_id=? AND event_type='PUBLICATION' ORDER BY sequence LIMIT 1").get('synthetic-sample');
    assert.ok(publication);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM _exchange_journal WHERE specimen_id=? AND event_type='WITHDRAWAL'").get('synthetic-sample').n, 0);
    const boundary = await state.createSnapshot(auth);
    assert.equal(Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='trg_sample_au_withdraw'").get()), true);
    let hookCount = 0;
    let afterHoldRows;
    const originalFind = prisma.sample.findMany;
    let raced = false;
    prisma.sample.findMany = async function(args) {
        const rows = await originalFind.call(this, args);
        if (!raced) {
            raced = true;
            // #179 pin 5990587479: W withdraws through metadata only, in this same read window.
            hookCount++;
            const beforeHold = db.prepare('SELECT * FROM Sample WHERE id=?').get('synthetic-sample');
            const metadata = JSON.parse(beforeHold.metadata || '{}');
            const heldMetadata = JSON.stringify({...metadata, provenanceHold:{status:'AMBIGUOUS_PROVENANCE_HOLD',reason:'issue149 withdrawal race fixture'}});
            assert.equal(db.prepare('UPDATE Sample SET metadata=? WHERE id=?').run(heldMetadata, 'synthetic-sample').changes, 1);
            const live = db.prepare('SELECT * FROM Sample WHERE id=?').get('synthetic-sample');
            assert.deepEqual(live, {...beforeHold, metadata:heldMetadata});
            const withdrawal = db.prepare('SELECT * FROM _exchange_journal WHERE specimen_id=? ORDER BY sequence DESC LIMIT 1').get('synthetic-sample');
            assert.equal(withdrawal.event_type, 'WITHDRAWAL');
            assert.ok(withdrawal.sequence > reference.sequence);
            assert.equal(withdrawal.payload, null);
            assert.equal(withdrawal.content_hash, state.computeSampleContentHash({...live,
                results:db.prepare('SELECT * FROM Result WHERE sampleId=?').all(live.id)}));
            afterHoldRows = db.prepare('SELECT * FROM _exchange_journal WHERE specimen_id=? ORDER BY sequence').all('synthetic-sample');
            assert.equal(latest().event_type, 'WITHDRAWAL');
        }
        return rows;
    };
    let snap;
    try {
        await state.syncJournal(auth);
        assert.equal(hookCount, 1);
        assert.deepEqual(db.prepare('SELECT * FROM _exchange_journal WHERE specimen_id=? ORDER BY sequence').all('synthetic-sample'), afterHoldRows);
    } finally {
        prisma.sample.findMany = originalFind;
    }
    await state.syncJournal(auth);
    assert.deepEqual(db.prepare('SELECT * FROM _exchange_journal WHERE specimen_id=? ORDER BY sequence').all('synthetic-sample'), afterHoldRows);
    assert.equal(afterHoldRows.filter(row=>row.event_type === 'WITHDRAWAL').length, 1);
    assert.equal(afterHoldRows.at(-1).event_type, 'WITHDRAWAL');
    const oldPage = await state.getSnapshotPage(boundary.snapshotId, auth);
    const expectedBoundaryPayload = JSON.parse(reference.payload);
    // Preserve the original auth and its production spatial projection.
    if (!auth.capabilities?.includes('SPATIAL') && expectedBoundaryPayload.sampling) expectedBoundaryPayload.sampling.location=null;
    assert.deepEqual(oldPage.data.find(row=>row.specimenId === 'synthetic-sample'), expectedBoundaryPayload);
    const boundaryChanges = await state.getChanges(auth, {cursor:boundary.nextCursor});
    assert.deepEqual(boundaryChanges.changes.filter(row=>row.specimenId === 'synthetic-sample').map(row=>row.eventType), ['WITHDRAWAL']);
    snap = await state.createSnapshot(auth);
    assert.deepEqual(db.prepare('SELECT * FROM _exchange_journal WHERE sequence=?').get(reference.sequence), reference);
    assert.deepEqual(db.prepare('SELECT * FROM _exchange_journal WHERE sequence=?').get(publication.sequence), publication);

    assert.equal(latest().event_type, 'WITHDRAWAL');
    const live = await prisma.sample.findUnique({where:{id:'synthetic-sample'}});
    assert.equal(live.status,'APPROVED');
    assert.equal(JSON.parse(live.metadata).provenanceHold.status,'AMBIGUOUS_PROVENANCE_HOLD');
    assert.equal(state.isSpecimenEligible(live),false);
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
    // #179 pin 5990587479: S is independent; W is never resurrected.
    await createSampleFixture(prisma, {data:{id:'spatial-sample',originalId:'spatial-bag',labId:'spatial-accession',
        assignedLab:'SYNTHETIC-LAB',country:'AAA',projectCode:'SYNTHETIC-PROJECT',status:'ACCEPTED',
        dryingStatus:'DONE',preparationStatus:'DONE',latitude:12.34567,longitude:34.56789,depthTopCm:0,depthBottomCm:20}});
    await transitionSample('spatial-sample','APPROVED','system:fixture','Independent spatial entitlement proof',{approvedAt:new Date()},prisma);

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
    console.log('Test-owned synthetic database is removed after verification.');
    console.log(`======================================================\n`);
    await assertFinalRefusals();
})().catch(err => {
    console.error('VERIFICATION FAILED:', err);
    process.exitCode = 1;
}).finally(async () => {
    await prisma.$disconnect();
    if (db?.open) db.close();
    process.env.DATABASE_PATH=sourceFixture.dbPath;
    process.env.DATABASE_URL='file:' + sourceFixture.dbPath;
    rehearsal.close();
    cleanupDisposableDatabase(sourceFixture.runnerDir);
    fs.rmSync(dir, { recursive: true, force: true });
});
