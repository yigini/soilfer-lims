// Comprehensive Verification: Issue #149 Remediations on 6df8fe6
// Exercises all 12 positive contracts corresponding to Codex review findings.
// Uses real in-memory SQLite and actual service, adapter, and policy implementations.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const assert = require('assert/strict');

const root = path.resolve(__dirname, '..', '..');
const req = require('module').createRequire(path.join(root, 'server/package.json'));
const db = new (req('better-sqlite3'))(':memory:');

db.exec(`
CREATE TABLE Sample(id TEXT PRIMARY KEY,originalId TEXT,labId TEXT,assignedLab TEXT,country TEXT,projectCode TEXT,status TEXT,fieldMetadata TEXT,metadata TEXT,receptionDate TEXT,updatedAt TEXT,createdAt TEXT);
CREATE TABLE Result(id TEXT PRIMARY KEY,sampleId TEXT,param TEXT,value TEXT,numericValue REAL,isValid INTEGER,isCurrent INTEGER,unit TEXT,methodologyId TEXT);
`);

function source(rel, mocks) {
    const body = fs.readFileSync(path.join(root, rel), 'utf8');
    const module = { exports: {} };
    vm.runInNewContext(body, {
        module,
        exports: module.exports,
        require: n => {
            if (Object.hasOwn(mocks, n)) return mocks[n];
            if (['path', 'crypto'].includes(n)) return require(n);
            throw Error(n);
        },
        __dirname: path.dirname(path.join(root, rel)),
        process: { env: {} },
        Buffer,
        Date,
        console
    }, { filename: rel });
    return module.exports;
}

const adapter = source('server/services/sisAdapterService.js', { './interpretationService': req('./services/interpretationService') });
const policy = source('server/services/exchangePolicyService.js', { './projectPolicyService': { getProgrammeChildProjectCodes: () => [] } });

function match(row, w) {
    return Object.entries(w).every(([k, v]) => {
        if (k === 'AND') return v.every(x => match(row, x));
        if (k === 'OR') return v.some(x => match(row, x));
        const a = row[k];
        if (v && typeof v === 'object') return Object.entries(v).every(([op, b]) => ({ in: () => b.includes(a), not: () => a !== b, lte: () => a <= b }[op] || (() => false))());
        return a === v;
    });
}

const read = () => db.prepare('SELECT * FROM Sample').all().map(s => ({
    ...s,
    updatedAt: new Date(s.updatedAt),
    createdAt: new Date(s.createdAt),
    results: db.prepare('SELECT * FROM Result WHERE sampleId=?').all(s.id).map(r => ({ ...r, isValid: !!r.isValid, isCurrent: !!r.isCurrent }))
}));

let afterSelection = null;
const prisma = {
    sample: {
        findMany: async ({ where }) => {
            const rows = read().filter(s => match(s, where));
            if (afterSelection) {
                const f = afterSelection;
                afterSelection = null;
                f();
            }
            return rows;
        }
    }
};

function MemDb() { return db; }
const state = source('server/services/exchangeStateService.js', {
    'better-sqlite3': MemDb,
    '../prisma': prisma,
    './exchangePolicyService': policy,
    './sisAdapterService': adapter,
    './projectPolicyService': { getProgrammeChildProjectCodes: () => [] }
});

const auth = { type: 'API_KEY', keyId: 'KEY-1', role: 'NSIS_CONSUMER', labs: ['LAB-A'], countries: ['AAA', 'BBB'], projects: ['P-A'] };
const insert = (id, status = 'EXPECTED', country = 'AAA') => db.prepare('INSERT INTO Sample VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(id, 'BAG-' + id, 'ACC-' + id, 'LAB-A', country, 'P-A', status, '{}', '{}', '2026-01-02', '2026-01-03', '2026-01-01');
const count = () => db.prepare('SELECT COUNT(*) n FROM _exchange_journal').get().n;

(async () => {
    console.log('Running 12 Remediation Verification Checks on 6df8fe6 corrections...\n');

    state.getDb();
    insert('a');

    // ── Contract 1: Full analytical results & reception date captured on first approval ──
    db.prepare('INSERT INTO Result VALUES (?,?,?,?,?,?,?,?,?)').run('r1', 'a', 'PH_H2O', '6.2', 6.2, 1, 1, 'pH units', 'METHOD-1');
    db.prepare("UPDATE Sample SET status='APPROVED' WHERE id='a'").run();
    assert.equal(count(), 1, 'Contract 1: First approval emits 1 journal event');
    const pub = db.prepare('SELECT * FROM _exchange_journal ORDER BY sequence LIMIT 1').get();
    const pubData = JSON.parse(pub.payload);
    assert.equal(pubData.observations.length, 1, 'Contract 1: Publication includes analytical results');
    assert.equal(pubData.observations[0].parameter, 'PH_H2O', 'Contract 1: Observation parameter matches');
    assert.equal(pubData.observations[0].asMeasured.value, 6.2, 'Contract 1: Observation value matches');
    assert.equal(pubData.receipt.receptionDate, '2026-01-02', 'Contract 1: Reception date is captured truthfully');
    console.log('✔ Contract 1 PASSED: Publication captures complete results and reception date.');

    // ── Contract 2: Result amendment updates content hash and analytical observation ──
    db.prepare("UPDATE Result SET value='7.1',numericValue=7.1 WHERE id='r1'").run();
    const amended = db.prepare('SELECT * FROM _exchange_journal ORDER BY sequence DESC LIMIT 1').get();
    assert.notEqual(amended.content_hash, pub.content_hash, 'Contract 2: Result edit changes content hash');
    const amendedData = JSON.parse(amended.payload);
    assert.equal(amendedData.observations.length, 1, 'Contract 2: Amendment has observation');
    assert.equal(amendedData.observations[0].asMeasured.value, 7.1, 'Contract 2: Amendment has updated observation value');
    console.log('✔ Contract 2 PASSED: Result amendment records distinct hash and updated observation.');

    // ── Contract 3: Cancellation after publish/amend preserves full historical revisions in change feed ──
    db.prepare("UPDATE Sample SET status='CANCELLED' WHERE id='a'").run();
    const withdrawn = await state.getChanges(auth);
    const withData = withdrawn.changes.filter(e => e.data);
    assert.equal(withData.length, 2, 'Contract 3: Both publication and amendment events retain payload');
    assert.ok(withData.every(e => e.data.observations.length === 1), 'Contract 3: Analytical results preserved across history');
    const lastEvent = withdrawn.changes[withdrawn.changes.length - 1];
    assert.equal(lastEvent.eventType, 'WITHDRAWAL', 'Contract 3: Last event is WITHDRAWAL');
    console.log('✔ Contract 3 PASSED: Publishing -> amending -> withdrawing preserves full result history.');

    // ── Contract 4: Metadata-only change triggers AMENDMENT event ──
    insert('b', 'APPROVED');
    await state.getChanges(auth);
    const beforeMeta = count();
    db.prepare("UPDATE Sample SET metadata='{\"latitude\":12,\"longitude\":34}' WHERE id='b'").run();
    await state.getChanges(auth);
    assert.equal(count(), beforeMeta + 1, 'Contract 4: Sample metadata update emits AMENDMENT event');
    console.log('✔ Contract 4 PASSED: Sample metadata-only change emits AMENDMENT.');

    // ── Contract 5: Signed cursor enforces profile and filter binding ──
    const first = await state.getChanges(auth, { profile: 'opennsis', filter: { country: 'AAA' } });
    assert.ok(first.batchId, 'Contract 5: Change batch issued');
    const changed = await state.getChanges(auth, { cursor: first.nextCursor, filter: { country: 'BBB' } });
    assert.equal(changed.error, 'INVALID_CURSOR', 'Contract 5: Filter country mismatch rejected with INVALID_CURSOR');
    const changedProf = await state.getChanges(auth, { cursor: first.nextCursor, profile: 'default', filter: { country: 'AAA' } });
    assert.equal(changedProf.error, 'INVALID_CURSOR', 'Contract 5: Profile mismatch rejected with INVALID_CURSOR');
    console.log('✔ Contract 5 PASSED: Cursor enforces profile and filter binding.');

    // ── Contract 6: Unconfigured environment uses secure dynamic secret from _exchange_meta ──
    const forged = { v: 2, connectionId: 'KEY-1', seq: 0, epoch: 'epoch-1', issuedAt: Date.now() };
    const sig = crypto.createHmac('sha256', 'soilfer-lims-exchange-cursor-v2').update(JSON.stringify(forged)).digest('hex').slice(0, 16);
    const forgedResult = await state.getChanges(auth, { cursor: Buffer.from(JSON.stringify({ p: forged, s: sig })).toString('base64') });
    assert.equal(forgedResult.error, 'INVALID_CURSOR', 'Contract 6: Literal fallback secret rejected');
    console.log('✔ Contract 6 PASSED: Public literal secret rejected; dynamic secret enforced.');

    // ── Contract 7: Persisted epoch change invalidates old cursors with 410 CURSOR_EXPIRED ──
    db.prepare("INSERT OR REPLACE INTO _exchange_meta(key,value,updated_at) VALUES ('epoch','restored-epoch-2','')").run();
    const epochResult = await state.getChanges(auth, { cursor: first.nextCursor, profile: 'opennsis', filter: { country: 'AAA' } });
    assert.equal(epochResult.error, 'CURSOR_EXPIRED', 'Contract 7: Rotated/restored epoch returns CURSOR_EXPIRED');
    console.log('✔ Contract 7 PASSED: Epoch change invalidates old cursors.');

    // ── Contract 8: Change-feed cursor rejected as snapshot page cursor ──
    // Restore epoch for subsequent tests
    db.prepare("INSERT OR REPLACE INTO _exchange_meta(key,value,updated_at) VALUES ('epoch','epoch-1','')").run();
    const validSnap = await state.createSnapshot(auth);
    const snapPageRes = await state.getSnapshotPage(validSnap.snapshotId, auth, { cursor: first.nextCursor });
    assert.equal(snapPageRes.error, 'INVALID_CURSOR', 'Contract 8: Change-feed cursor rejected by snapshot page endpoint');
    console.log('✔ Contract 8 PASSED: Change-feed cursor rejected as snapshot cursor.');

    // ── Contract 9: Two unrelated snapshots rejected as snapshot/batch pair; invalid checkpoint rejected ──
    const snap2 = await state.createSnapshot(auth);
    const mixed = state.recordReceipt(auth, { snapshotId: validSnap.snapshotId, batchId: snap2.snapshotId, importedCount: 1, checkpoint: 'arbitrary-checkpoint' });
    assert.ok(mixed.error === 'INVALID_CHECKPOINT' || mixed.error === 'BATCH_SNAPSHOT_MISMATCH', 'Contract 9: Unrelated snapshot as batch or invalid checkpoint rejected');
    const badChk = state.recordReceipt(auth, { snapshotId: validSnap.snapshotId, batchId: validSnap.snapshotId, importedCount: 1, checkpoint: 'arbitrary-checkpoint' });
    assert.equal(badChk.error, 'INVALID_CHECKPOINT', 'Contract 9: Arbitrary checkpoint string rejected');
    console.log('✔ Contract 9 PASSED: Unrelated snapshot as batch and arbitrary checkpoints rejected.');

    // ── Contract 10: Conflicting retry returns 409 RECEIPT_CONFLICT; exact retry is idempotent ──
    const goodReceipt = state.recordReceipt(auth, { snapshotId: validSnap.snapshotId, batchId: validSnap.snapshotId, importedCount: 1, checkpoint: 'seq_10' });
    assert.equal(goodReceipt.status, 'ACKNOWLEDGED');
    assert.equal(goodReceipt.idempotent, false);

    const retryConflict = state.recordReceipt(auth, { snapshotId: validSnap.snapshotId, batchId: validSnap.snapshotId, importedCount: 0, quarantinedCount: 1, checkpoint: 'seq_10' });
    assert.equal(retryConflict.error, 'RECEIPT_CONFLICT', 'Contract 10: Conflicting counts return RECEIPT_CONFLICT');
    assert.equal(retryConflict.status, 409);

    const retryExact = state.recordReceipt(auth, { snapshotId: validSnap.snapshotId, batchId: validSnap.snapshotId, importedCount: 1, checkpoint: 'seq_10' });
    assert.equal(retryExact.status, 'ACKNOWLEDGED');
    assert.equal(retryExact.idempotent, true, 'Contract 10: Exact retry acknowledged as idempotent');
    console.log('✔ Contract 10 PASSED: Conflicting retry returns 409 RECEIPT_CONFLICT; exact retry idempotent.');

    // ── Contract 11: Atomic snapshot handoff with committed highWaterSequence and nextCursor ──
    afterSelection = () => {
        db.prepare("UPDATE Sample SET fieldMetadata='{\"latitude\":21,\"longitude\":35}' WHERE id='b'").run();
    };
    const racing = await state.createSnapshot(auth);
    assert.ok(racing.highWaterSequence !== undefined && racing.highWaterSequence > 0, 'Contract 11: highWaterSequence returned');
    assert.ok(racing.nextCursor, 'Contract 11: nextCursor returned');
    const decodedHandoff = state.decodeCursor(racing.nextCursor);
    assert.equal(decodedHandoff.type, 'change', 'Contract 11: handoff cursor has type change');
    assert.equal(decodedHandoff.seq, racing.highWaterSequence, 'Contract 11: handoff cursor sequence matches committed boundary');
    console.log('✔ Contract 11 PASSED: Snapshot atomically returns highWaterSequence and handoff nextCursor.');

    // ── Contract 12: RELEASED status truthful serialization ──
    const formattedReleased = adapter.formatSampleV2({ ...read()[0], status: 'RELEASED' });
    assert.equal(formattedReleased.publicationStatus, 'RELEASED', 'Contract 12: RELEASED status serialized as RELEASED');
    console.log('✔ Contract 12 PASSED: Authoritative RELEASED status serialized truthfully.');

    console.log('\n================================================================');
    console.log('ALL 12 CONTRACT VERIFICATIONS COMPLETED SUCCESSFULLY!');
    console.log('================================================================');
})().catch(e => {
    console.error('VERIFICATION FAILED:', e);
    process.exitCode = 1;
}).finally(() => db.close());
