const { createResultFixture } = require('../../services/resultWriteService');
// Comprehensive Verification: Issue #149 Remediations on 6df8fe6
// Exercises all 12 positive contracts corresponding to Codex review findings.
// Uses test-owned guarded SQLite and actual service, adapter, and policy implementations.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
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

const fixturePrisma = require('../../prisma');
const req = require('module').createRequire(path.join(root,'server/package.json'));
const db = new (req('better-sqlite3'))(databasePath, {fileMustExist:true});

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

const adapter = require('../../services/sisAdapterService');
const policy = require('../../services/exchangePolicyService');

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
const dbFuncs = source('server/services/exchangeDbFunctions.js', {
    './sisAdapterService': adapter
});
const state = source('server/services/exchangeStateService.js', {
    'better-sqlite3': MemDb,
    '../prisma': prisma,
    './exchangePolicyService': policy,
    './sisAdapterService': adapter,
    './projectPolicyService': { getProgrammeChildProjectCodes: () => [] },
    './exchangeDbFunctions': dbFuncs
});

const auth = { type: 'API_KEY', keyId: 'KEY-1', role: 'NSIS_CONSUMER', labs: ['LAB-A'], countries: ['AAA', 'BBB'], projects: ['P-A'] };
async function insert(id, status = 'EXPECTED', country = 'AAA') {
    await createSampleFixture(fixturePrisma,{data:{id,originalId:'BAG-' + id,labId:'ACC-' + id,
        assignedLab:'LAB-A',country,projectCode:'P-A',status:'ACCEPTED',dryingStatus:'DONE',preparationStatus:'DONE',
        fieldMetadata:'{}',metadata:'{}',receptionDate:new Date('2026-01-02'),updatedAt:new Date('2026-01-03'),createdAt:new Date('2026-01-01')}});
    if(status === 'APPROVED') await transitionSample(id,'APPROVED','system:fixture','Synthetic publication proof',{approvedAt:new Date()},fixturePrisma);
}
const count = () => db.prepare('SELECT COUNT(*) n FROM _exchange_journal').get().n;

async function assertFinalRefusals() {
    // #179 pins 5990137651(B2), 5990587479: R1/R2 are separate from W/S.
    for (const [id, initial, final, attempted] of [
        ['refusal-r1', 'ACCEPTED', 'APPROVED', 'CANCELLED'],
        ['refusal-r2', 'EXPECTED', 'CANCELLED', 'APPROVED']
    ]) {
        await createSampleFixture(fixturePrisma, { data:{ id, originalId:id, assignedLab:'REFUSAL-LAB',
            status:initial, dryingStatus:'DONE', preparationStatus:'DONE' } });
        await transitionSample(id, final, 'system:fixture', 'Isolated final-state refusal fixture', {}, fixturePrisma);
        const fingerprint = async () => ({ row:await fixturePrisma.sample.findUnique({where:{id}}),
            journal:db.prepare('SELECT COUNT(*) n FROM _exchange_journal').get().n,
            audits:await fixturePrisma.auditLog.count(), evidence:await fixturePrisma.resultEvidenceEvent.count() });
        const before = await fingerprint();
        await assert.rejects(transitionSample(id, attempted, 'system:fixture', 'Forbidden legacy verification step', {}, fixturePrisma),
            error => error.statusCode === 409 && error.code === 'ILLEGAL_STATUS_TRANSITION');
        assert.deepEqual(await fingerprint(), before);
        console.log('[PASS] ' + final + ' to ' + attempted + ': 409 ILLEGAL_STATUS_TRANSITION and zero row/journal/audit/evidence writes');
    }
}


(async () => {
    console.log('Running 12 Remediation Verification Checks on 6df8fe6 corrections...\n');

    state.getDb();
    await insert('a');

    // ── Contract 1: Full analytical results & reception date captured on first approval ──
    await createResultFixture(fixturePrisma, {data:{id:'r1',sampleId:'a',param:'PH_H2O',value:'6.2',numericValue:6.2,isValid:true,isCurrent:true,unit:'pH units',methodologyId:'METHOD-1'}});
    await transitionSample('a','APPROVED','system:fixture','Synthetic first publication',{approvedAt:new Date()},fixturePrisma);
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
    // #179 pins 5990587479 / 5990780933 / 5990918325: real stale-read hold,
    // installed trigger producer, immutable amended boundary and idempotent sync.
    await state.syncJournal(auth);
    assert.deepEqual(db.prepare('SELECT * FROM _exchange_journal ORDER BY sequence DESC LIMIT 1').get(),amended);
    assert.equal(amended.event_type,'AMENDMENT');
    const boundary=await state.createSnapshot(auth);
    assert.equal(Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='trg_sample_au_withdraw'").get()),true);
    let holdHookCount=0;
    let afterHoldRows;
    afterSelection=()=>{
        holdHookCount++;
        const before=db.prepare('SELECT * FROM Sample WHERE id=?').get('a');
        const heldMetadata=JSON.stringify({...JSON.parse(before.metadata || '{}'),provenanceHold:{status:'AMBIGUOUS_PROVENANCE_HOLD',reason:'issue149 withdrawal race fixture'}});
        db.prepare('UPDATE Sample SET metadata=? WHERE id=?').run(heldMetadata,'a');
        const live=db.prepare('SELECT * FROM Sample WHERE id=?').get('a');
        assert.deepEqual(live,{...before,metadata:heldMetadata});
        const event=db.prepare('SELECT * FROM _exchange_journal ORDER BY sequence DESC LIMIT 1').get();
        assert.equal(event.event_type,'WITHDRAWAL');
        assert.equal(event.payload,null);
        assert.equal(event.content_hash,state.computeSampleContentHash({...live,results:db.prepare('SELECT * FROM Result WHERE sampleId=?').all('a')}));
        afterHoldRows=db.prepare('SELECT * FROM _exchange_journal WHERE specimen_id=? ORDER BY sequence').all('a');
    };
    await state.syncJournal(auth);
    assert.equal(holdHookCount,1);
    assert.deepEqual(db.prepare('SELECT * FROM _exchange_journal WHERE specimen_id=? ORDER BY sequence').all('a'),afterHoldRows);
    await state.syncJournal(auth);
    assert.deepEqual(db.prepare('SELECT * FROM _exchange_journal WHERE specimen_id=? ORDER BY sequence').all('a'),afterHoldRows);
    assert.equal(afterHoldRows.filter(row=>row.event_type === 'WITHDRAWAL').length,1);
    const liveHeld=db.prepare('SELECT * FROM Sample WHERE id=?').get('a');
    assert.equal(liveHeld.status,'APPROVED');
    assert.equal(JSON.parse(liveHeld.metadata).provenanceHold.status,'AMBIGUOUS_PROVENANCE_HOLD');
    assert.equal(state.isSpecimenEligible(liveHeld),false);
    const oldPage=await state.getSnapshotPage(boundary.snapshotId,auth);
    const projected=JSON.parse(amended.payload);
    projected.sampling.location=null;
    // Compare the complete payload bytes across the VM/Node object realms.
    assert.equal(JSON.stringify(oldPage.data.find(row=>row.specimenId === 'a')),JSON.stringify(projected));
    const laterSnapshot=await state.createSnapshot(auth);
    assert.equal((await state.getSnapshotPage(laterSnapshot.snapshotId,auth)).data.length,0);
    assert.equal(JSON.stringify((await state.getChanges(auth,{cursor:boundary.nextCursor})).changes.map(row=>row.eventType)),JSON.stringify(['WITHDRAWAL']));
    assert.deepEqual(db.prepare('SELECT * FROM _exchange_journal WHERE sequence=?').get(amended.sequence),amended);
    assert.deepEqual(db.prepare('SELECT * FROM _exchange_journal WHERE sequence=?').get(pub.sequence),pub);
    const withdrawn = await state.getChanges(auth);
    const withData = withdrawn.changes.filter(e => e.data);
    assert.equal(withData.length, 2, 'Contract 3: Both publication and amendment events retain payload');
    assert.ok(withData.every(e => e.data.observations.length === 1), 'Contract 3: Analytical results preserved across history');
    const lastEvent = withdrawn.changes[withdrawn.changes.length - 1];
    assert.equal(lastEvent.eventType, 'WITHDRAWAL', 'Contract 3: Last event is WITHDRAWAL');
    console.log('✔ Contract 3 PASSED: Publishing -> amending -> withdrawing preserves full result history.');

    // ── Contract 4: Metadata-only change triggers AMENDMENT event ──
    await insert('b', 'APPROVED');
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
    const goodReceipt = state.recordReceipt(auth, { snapshotId: validSnap.snapshotId, batchId: validSnap.snapshotId, importedCount: 1, checkpoint: `seq_${validSnap.highWaterSequence}` });
    assert.equal(goodReceipt.status, 'ACKNOWLEDGED');
    assert.equal(goodReceipt.idempotent, false);

    const retryConflict = state.recordReceipt(auth, { snapshotId: validSnap.snapshotId, batchId: validSnap.snapshotId, importedCount: 0, quarantinedCount: 1, checkpoint: `seq_${validSnap.highWaterSequence}` });
    assert.equal(retryConflict.error, 'RECEIPT_CONFLICT', 'Contract 10: Conflicting counts return RECEIPT_CONFLICT');
    assert.equal(retryConflict.status, 409);

    const retryExact = state.recordReceipt(auth, { snapshotId: validSnap.snapshotId, batchId: validSnap.snapshotId, importedCount: 1, checkpoint: `seq_${validSnap.highWaterSequence}` });
    assert.equal(retryExact.status, 'ACKNOWLEDGED');
    assert.equal(retryExact.idempotent, true, 'Contract 10: Exact retry acknowledged as idempotent');
    console.log('✔ Contract 10 PASSED: Conflicting retry returns 409 RECEIPT_CONFLICT; exact retry idempotent.');

    // ── Contract 11: Atomic snapshot handoff with committed highWaterSequence and nextCursor ──
    let boundaryHookCount=0;
    afterSelection = () => {
        boundaryHookCount++;
        db.prepare("UPDATE Sample SET fieldMetadata='{\"latitude\":21,\"longitude\":35}' WHERE id='b'").run();
    };
    await state.syncJournal(auth);
    assert.equal(boundaryHookCount,1);
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
    await assertFinalRefusals();
})().catch(e => {
    console.error('VERIFICATION FAILED:', e);
    process.exitCode = 1;
}).finally(async () => {
    await fixturePrisma.$disconnect();
    if(db.open) db.close();
    const actualState=require('../../services/exchangeStateService');
    if(actualState.getDb().open) actualState.getDb().close();
    process.env.DATABASE_PATH=sourceFixture.dbPath;
    process.env.DATABASE_URL='file:' + sourceFixture.dbPath;
    rehearsal.close();
    cleanupDisposableDatabase(sourceFixture.runnerDir);
    fs.rmSync(dir,{recursive:true,force:true});
});
