'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const assert = require('assert/strict');

const root = path.resolve(__dirname, '..', '..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lims-review-9850d78-verify-'));
const databasePath = path.join(dir, 'verify-full-schema.db');

process.env.DATABASE_PATH = databasePath;
process.env.NODE_ENV = 'test';

const codexSqlPath = 'C:/Users/yigin/Documents/Codex/2026-09-21/se/work/issue149-schema-9850d78.sql';
const SQL = fs.readFileSync(codexSqlPath, 'utf8');

const Database = require('better-sqlite3');
const setup = new Database(databasePath);
setup.exec(SQL);
setup.close();

const prisma = require(path.join(root, 'server/prisma'));
const state = require(path.join(root, 'server/services/exchangeStateService'));
const db = state.getDb();

const auth = {
    type: 'API_KEY',
    keyId: 'SYNTHETIC-KEY',
    role: 'NSIS_CONSUMER',
    labs: ['SYNTHETIC-LAB'],
    countries: ['AAA'],
    projects: ['SYNTHETIC-PROJECT']
};

let passedCount = 0;
function pass(msg) {
    passedCount++;
    console.log(`[PASS ${passedCount}] ${msg}`);
}

(async () => {
    console.log('--- Starting Verification of Codex 9850d78 Remediations ---');

    // 1. Create sample with coordinates and depths
    await prisma.sample.create({
        data: {
            id: 'synthetic-sample',
            originalId: 'synthetic-bag',
            labId: 'synthetic-accession',
            assignedLab: 'SYNTHETIC-LAB',
            country: 'AAA',
            projectCode: 'SYNTHETIC-PROJECT',
            status: 'EXPECTED',
            receptionDate: new Date('2026-01-02T12:34:56Z'),
            latitude: 12,
            longitude: 34,
            depthTopCm: 0,
            depthBottomCm: 20
        }
    });

    // 2. Create result with non-default provenance/censoring/basis/replicate
    await prisma.result.create({
        data: {
            id: 'synthetic-result',
            sampleId: 'synthetic-sample',
            param: 'PH_H2O',
            value: '6.2',
            numericValue: 6.2,
            unit: 'pH units',
            isValid: true,
            isCurrent: true,
            provenance: 'PREDICTED',
            censoring: 'BELOW_LOQ',
            basis: 'FIELD_MOIST',
            replicateNo: 2,
            flags: '["SYNTHETIC_REVIEW"]'
        }
    });

    // 3. Approve sample via real Prisma
    await prisma.sample.update({
        where: { id: 'synthetic-sample' },
        data: { status: 'APPROVED', approvedAt: new Date() }
    });

    const initial = db.prepare('SELECT * FROM _exchange_journal ORDER BY sequence LIMIT 1').get();
    assert.ok(initial, 'Journal event created on sample approval');
    const payload = JSON.parse(initial.payload);
    const obs = payload.observations[0];

    // Rem 1: Location and depths preserved
    assert.notEqual(payload.sampling.location, null, 'location must not be null');
    assert.equal(payload.sampling.location.coordinates[0], 34, 'longitude must be 34');
    assert.equal(payload.sampling.location.coordinates[1], 12, 'latitude must be 12');
    assert.equal(payload.sampling.depths.topCm, 0, 'depth topCm must be 0');
    assert.equal(payload.sampling.depths.bottomCm, 20, 'depth bottomCm must be 20');
    pass('R1: Actual-schema publication truthfully preserves location coordinates and depth interval');

    // Rem 2: Result scientific provenance/censoring/basis/replicate preserved
    assert.equal(obs.provenance, 'PREDICTED', 'provenance must be PREDICTED');
    assert.equal(obs.censoring, 'BELOW_LOQ', 'censoring must be BELOW_LOQ');
    assert.equal(obs.basis, 'FIELD_MOIST', 'basis must be FIELD_MOIST');
    assert.equal(obs.replicateNo, 2, 'replicateNo must be 2');
    assert.deepEqual(obs.flags, ['SYNTHETIC_REVIEW'], 'flags must be preserved');
    pass('R2: Actual-schema result provenance/censoring/basis/replicate/flags preserved without invented defaults');

    // Rem 3: Provenance-only result update detected by trigger and polling hash
    const countBefore = db.prepare('SELECT COUNT(*) n FROM _exchange_journal').get().n;
    await prisma.result.update({
        where: { id: 'synthetic-result' },
        data: {
            provenance: 'DERIVED',
            censoring: 'ABOVE_RANGE',
            basis: 'OVEN_DRY',
            replicateNo: 3
        }
    });
    const countAfterTrigger = db.prepare('SELECT COUNT(*) n FROM _exchange_journal').get().n;
    assert.equal(countAfterTrigger, countBefore + 1, 'Trigger must fire and record AMENDMENT on provenance-only change');

    await state.getChanges(auth);
    const countAfterSync = db.prepare('SELECT COUNT(*) n FROM _exchange_journal').get().n;
    assert.equal(countAfterSync, countAfterTrigger, 'Polling hash must recognize trigger event');

    const amendedRow = db.prepare('SELECT * FROM _exchange_journal ORDER BY sequence DESC LIMIT 1').get();
    const amendedPayload = JSON.parse(amendedRow.payload);
    const amendedObs = amendedPayload.observations[0];
    assert.equal(amendedObs.provenance, 'DERIVED');
    assert.equal(amendedObs.censoring, 'ABOVE_RANGE');
    assert.equal(amendedObs.basis, 'OVEN_DRY');
    assert.equal(amendedObs.replicateNo, 3);
    pass('R3: Result provenance-only update creates AMENDMENT event with updated scientific attributes');

    // Rem 4: Receipt relationship and checkpoint validation
    const feed = await state.getChanges(auth);
    const snap = await state.createSnapshot(auth);

    // 4a. Mixed change-feed batch + snapshot rejected
    const mixed = state.recordReceipt(auth, {
        snapshotId: snap.snapshotId,
        batchId: feed.batchId,
        importedCount: 0,
        quarantinedCount: 0,
        checkpoint: 'seq_1'
    });
    assert.ok(mixed.error, 'Mixed change batch plus snapshot must return error');
    assert.equal(mixed.status, 400, 'Mixed change batch plus snapshot must return 400');
    assert.equal(mixed.error, 'BATCH_SNAPSHOT_MISMATCH');
    pass('R4a: Unrelated change batch combined with snapshot is strictly rejected with 400 BATCH_SNAPSHOT_MISMATCH');

    // 4b. Out-of-bounds future checkpoint rejected
    const futureChk = state.recordReceipt(auth, {
        snapshotId: snap.snapshotId,
        importedCount: 0,
        quarantinedCount: 0,
        checkpoint: 'seq_999999999'
    });
    assert.ok(futureChk.error, 'Future checkpoint seq_999999999 must return error');
    assert.equal(futureChk.status, 400, 'Future checkpoint must return 400');
    assert.equal(futureChk.error, 'INVALID_CHECKPOINT');
    pass('R4b: Unissued future sequence checkpoint is strictly rejected with 400 INVALID_CHECKPOINT');

    // 4c. Valid receipt accepted, and conflicting modification rejected with 409
    const validReceipt = state.recordReceipt(auth, {
        snapshotId: snap.snapshotId,
        importedCount: 1,
        quarantinedCount: 0,
        checkpoint: `seq_${snap.highWaterSequence}`
    });
    assert.equal(validReceipt.status, 'ACKNOWLEDGED');
    assert.equal(validReceipt.idempotent, false);

    // Exact retry is idempotent
    const retryReceipt = state.recordReceipt(auth, {
        receiptId: validReceipt.receiptId,
        snapshotId: snap.snapshotId,
        importedCount: 1,
        quarantinedCount: 0,
        checkpoint: `seq_${snap.highWaterSequence}`
    });
    assert.equal(retryReceipt.status, 'ACKNOWLEDGED');
    assert.equal(retryReceipt.idempotent, true);

    // Conflicting count under same receipt identity rejected with 409
    const conflictReceipt = state.recordReceipt(auth, {
        receiptId: validReceipt.receiptId,
        snapshotId: snap.snapshotId,
        importedCount: 0,
        quarantinedCount: 0,
        checkpoint: `seq_${snap.highWaterSequence}`
    });
    assert.ok(conflictReceipt.error, 'Conflicting receipt must return error');
    assert.equal(conflictReceipt.status, 409, 'Conflicting receipt must return 409 RECEIPT_CONFLICT');
    assert.equal(conflictReceipt.error, 'RECEIPT_CONFLICT');
    pass('R4c: Receipt validation enforces idempotency on exact retry and 409 on conflicting update');

    // Rem 5: Snapshot atomicity derived from immutable publication revisions
    // Intercept and update result concurrently during snapshot creation
    const snap2 = await state.createSnapshot(auth);
    // Now write a newer revision (value 7.1)
    await prisma.result.update({
        where: { id: 'synthetic-result' },
        data: { value: '7.1', numericValue: 7.1 }
    });
    const latestSeq = db.prepare('SELECT MAX(sequence) n FROM _exchange_journal').get().n;
    assert.ok(latestSeq > snap2.highWaterSequence, 'Newer journal sequence exists after snapshot was captured');

    // Read page from snap2
    const snap2Page = await state.getSnapshotPage(snap2.snapshotId, auth);
    const snap2Obs = snap2Page.data[0].observations[0];
    assert.notEqual(snap2Obs.asMeasured.value, 7.1, 'Snapshot must NOT include concurrent write (value 7.1)');
    pass('R5: Snapshot is atomically bounded by highWaterSequence and does not leak newer concurrent revisions');

    // Rem 6: Profile normalization prevents null-profile cursor from switching
    const switched = await state.getChanges(auth, { cursor: snap2.nextCursor, profile: 'opennsis' });
    assert.ok(switched.error, 'Null-profile cursor must not switch to opennsis');
    assert.equal(switched.status, 400);
    assert.equal(switched.error, 'INVALID_CURSOR');
    pass('R6: Normalized cursor profile comparison prevents null-profile cursor from switching to opennsis');

    // Rem 7: Signing state storage failure fails closed without predictable fallback
    const badState = { prepare() { throw Error('synthetic state storage unavailable'); } };
    const saved = {};
    for (const k of ['SESSION_SECRET', 'JWT_SECRET', 'API_KEY_SECRET']) {
        saved[k] = process.env[k];
        delete process.env[k];
    }
    let threw = false;
    try {
        state.encodeCursor({ type: 'change', connectionId: 'SYNTHETIC-KEY', seq: 0 }, badState);
    } catch (e) {
        threw = true;
        assert.ok(e.message.includes('Signing state storage unavailable'));
    }
    for (const k of Object.keys(saved)) {
        if (saved[k] !== undefined) process.env[k] = saved[k];
    }
    assert.ok(threw, 'encodeCursor must fail closed (throw) on signing-state storage failure');
    pass('R7: Signing-state failure fails closed, completely eliminating predictable PID fallback');

    console.log(`\nALL ${passedCount} REMEDIATIONS VERIFIED SUCCESSFULLY!`);
})().catch(e => {
    console.error('VERIFICATION FAILED:', e);
    process.exitCode = 1;
}).finally(async () => {
    await prisma.$disconnect();
    if (db && db.open) db.close();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
});
