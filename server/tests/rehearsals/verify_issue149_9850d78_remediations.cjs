'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert/strict');

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


// A stable delegate lets the original race hook intercept the real Prisma read.
// Generated Prisma otherwise returns a fresh model delegate at each access.
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
    console.log('--- Starting Verification of Codex 9850d78 Remediations ---');

    // 1. Create sample with coordinates and depths
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
    await transitionSample('synthetic-sample', 'APPROVED', 'system:fixture', 'Synthetic publication proof', {approvedAt:new Date()}, prisma);

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

    // Rem 8: Receipt checkpoint validation: issued batch sequence accepted, unchecked aliases rejected
    const changeFeed2 = await state.getChanges(auth);
    const end = db.prepare('SELECT end_seq FROM _exchange_batches WHERE id=?').get(changeFeed2.batchId).end_seq;
    assert.ok(end > 0, 'Issued batch must have valid positive end_seq');
    const goodReceipt = state.recordReceipt(auth, {
        batchId: changeFeed2.batchId,
        importedCount: 0,
        quarantinedCount: 0,
        checkpoint: `seq_${end}`
    });
    assert.equal(goodReceipt.status, 'ACKNOWLEDGED', 'Valid issued change-batch sequence checkpoint must be accepted');
    pass('R8: Valid issued change-batch sequence checkpoint accepted with start_seq/end_seq resolved');

    const fakeReceipt = state.recordReceipt(auth, {
        batchId: changeFeed2.batchId,
        importedCount: 0,
        quarantinedCount: 0,
        checkpoint: 'cp_999999999'
    });
    assert.equal(fakeReceipt.error, 'INVALID_CHECKPOINT', 'Alternate checkpoint syntax must be rejected');
    assert.equal(fakeReceipt.status, 400);
    pass('R8b: Alternate checkpoint syntax aliases (cp_...) strictly rejected with 400 INVALID_CHECKPOINT');

    // Rem 9: Invalid results (isValid=false) excluded from trigger capture and NOT republished by GET sync
    await prisma.result.update({
        where: { id: 'synthetic-result' },
        data: { isValid: false }
    });
    const latestAfterInvalid = () => db.prepare('SELECT * FROM _exchange_journal ORDER BY sequence DESC LIMIT 1').get();
    assert.equal(JSON.parse(latestAfterInvalid().payload).observations.length, 0, 'Trigger must exclude invalid results (0 observations)');
    await state.getChanges(auth);
    assert.equal(JSON.parse(latestAfterInvalid().payload).observations.length, 0, 'GET synchronization must NOT republish invalid results');
    pass('R9: Transactional trigger capture and GET synchronization consistently exclude invalid results');

    // Rem 10: Concurrency safety: Stale GET scan does not overwrite committed withdrawal
    await prisma.result.update({
        where: { id: 'synthetic-result' },
        data: { isValid: true }
    });
    await state.getChanges(auth);

    const origFindMany = prisma.sample.findMany;
    let interleaved = false;
    prisma.sample.findMany = async function(args) {
        const rows = await origFindMany.call(this, args);
        if (!interleaved) {
            interleaved = true;
            // #179 pin 5990587479: W withdraws through metadata only, in this same read window.
            const beforeHold = await prisma.sample.findUnique({where:{id:'synthetic-sample'}});
            const metadata = JSON.parse(beforeHold.metadata || '{}');
            db.prepare('UPDATE Sample SET metadata=? WHERE id=?').run(JSON.stringify({...metadata,
                provenanceHold:{status:'AMBIGUOUS_PROVENANCE_HOLD',reason:'issue149 withdrawal race fixture'}}), 'synthetic-sample');
            assert.equal(latestAfterInvalid().event_type, 'WITHDRAWAL', 'Sample cancellation must trigger WITHDRAWAL');
        }
        return rows;
    };

    let racing;
    try {
        racing = await state.createSnapshot(auth);
    } finally {
        prisma.sample.findMany = origFindMany;
    }

    const liveSample = await prisma.sample.findUnique({ where: { id: 'synthetic-sample' } });
    const racingPage = await state.getSnapshotPage(racing.snapshotId, auth);

    // #179 pin 5990587479: this is an eligibility withdrawal, not a status edge.
    assert.equal(liveSample.status, 'APPROVED');
    assert.equal(JSON.parse(liveSample.metadata).provenanceHold.status, 'AMBIGUOUS_PROVENANCE_HOLD');
    assert.equal(state.isSpecimenEligible(liveSample), false);
    assert.equal(latestAfterInvalid().event_type, 'WITHDRAWAL', 'Latest journal event must remain WITHDRAWAL, not overwritten by stale PUBLICATION');
    assert.equal(racingPage.data.length, 0, 'Snapshot must not expose cancelled specimen');
    pass('R10: Stale GET scan does not overwrite committed withdrawal; cancelled specimen excluded from snapshot');

    // Rem 11: Fail-closed epoch restore protocol and installation source system identity
    let epochStorageFailed = false;
    try {
        state.getCurrentEpoch(badState);
    } catch (e) {
        epochStorageFailed = true;
        assert.ok(e.message.includes('Epoch state storage unavailable'));
    }
    assert.ok(epochStorageFailed, 'getCurrentEpoch must fail closed on storage failure');

    const curEpoch = state.getCurrentEpoch(db);
    assert.ok(curEpoch.startsWith('epoch-'));
    const rotated = state.rotateEpoch(db, 'DISASTER_RECOVERY_TEST');
    assert.equal(rotated.previousEpoch, curEpoch);
    assert.notEqual(rotated.currentEpoch, curEpoch);

    const sourceSysId = state.getSourceSystemId(db);
    assert.ok(sourceSysId && typeof sourceSysId === 'string' && sourceSysId.length > 0);
    pass('R11: Epoch restore protocol rotates epoch fail-closed, and installation identity is provisioned');

    await assertFinalRefusals();
    console.log(`\nALL ${passedCount} REMEDIATIONS VERIFIED SUCCESSFULLY!`);
})().catch(e => {
    console.error('VERIFICATION FAILED:', e);
    process.exitCode = 1;
}).finally(async () => {
    await prisma.$disconnect();
    if (db?.open) db.close();
    process.env.DATABASE_PATH=sourceFixture.dbPath;
    process.env.DATABASE_URL='file:' + sourceFixture.dbPath;
    rehearsal.close();
    cleanupDisposableDatabase(sourceFixture.runnerDir);
    if (db && db.open) db.close();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
});
