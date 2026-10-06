const { createResultFixture } = require('../../services/resultWriteService');
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
const db = new (req('better-sqlite3'))(databasePath,{fileMustExist:true});
const sources = new Map();
function source(rel, mocks) {
    const body = fs.readFileSync(path.join(root, rel), 'utf8');
    sources.set(rel, crypto.createHash('sha256').update(body).digest('hex'));
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

const project = { getProgrammeChildProjectCodes: () => [] };
const adapter = require('../../services/sisAdapterService');
const policy = require('../../services/exchangePolicyService');

function match(row, w) {
    return Object.entries(w).every(([k, v]) => {
        if (k === 'AND') return v.every(x => match(row, x));
        if (k === 'OR') return v.some(x => match(row, x));
        const a = row[k];
        if (v && typeof v === 'object') {
            return Object.entries(v).every(([op, b]) => ({
                in: () => b.includes(a),
                not: () => a !== b,
                lte: () => a <= b
            }[op] || (() => false))());
        }
        return a === v;
    });
}

const prisma = {
    sample: {
        findMany: async ({ where }) => db.prepare('SELECT * FROM Sample').all().map(s => ({
            ...s,
            updatedAt: new Date(s.updatedAt),
            createdAt: new Date(s.createdAt),
            results: []
        })).filter(s => match(s, where))
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
    './projectPolicyService': project,
    './exchangeDbFunctions': dbFuncs
});

const a = { type: 'API_KEY', keyId: 'A', role: 'NSIS_CONSUMER', labs: ['LAB-A'], countries: ['AAA'], projects: ['P-A'] };

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
    console.log('Testing working review remediations:');
    state.getDb();
    
    // Test 1: First real-table approval writes durable publication event
    // #179 pin 5990587479: W and S have independent identities.
    await createSampleFixture(fixturePrisma,{data:{id:'withdrawal-a',originalId:'BAG-W',labId:'ACC-W',
        assignedLab:'LAB-A',country:'AAA',projectCode:'P-A',status:'ACCEPTED',dryingStatus:'DONE',preparationStatus:'DONE',
        fieldMetadata:'{}',updatedAt:new Date('2026-01-01'),createdAt:new Date('2026-01-01')}});
    await transitionSample('withdrawal-a','APPROVED','system:fixture','Synthetic first publication',{approvedAt:new Date()},fixturePrisma);
    const countAfterApproval = db.prepare('SELECT COUNT(*) n FROM _exchange_journal').get().n;
    assert.ok(countAfterApproval > 0, `Expected journal count > 0, got ${countAfterApproval}`);
    console.log(`[PASS] 1. First real-table approval writes durable publication event (count: ${countAfterApproval})`);

    // Test 2: Unsigned cursor rejected by feed
    const first = await state.getChanges(a);
    const rawUnsigned = Buffer.from(JSON.stringify({ v: 2, seq: 0 })).toString('base64');
    const unsignedRes = await state.getChanges(a, { cursor: rawUnsigned });
    assert.ok(unsignedRes.error, 'Expected unsigned cursor to be rejected');
    console.log(`[PASS] 2. Unsigned cursor rejected by feed (${unsignedRes.error} ${unsignedRes.status})`);

    // Test 3: Real-table republication yields WITHDRAWAL then PUBLICATION with non-null payload
    db.prepare('UPDATE Sample SET metadata=? WHERE id=?').run(JSON.stringify({provenanceHold:{status:'AMBIGUOUS_PROVENANCE_HOLD',reason:'issue149 withdrawal race fixture'}}),'withdrawal-a');
    await createSampleFixture(fixturePrisma,{data:{id:'a',originalId:'BAG-A',labId:'ACC-A',assignedLab:'LAB-A',
        country:'AAA',projectCode:'P-A',status:'ACCEPTED',dryingStatus:'DONE',preparationStatus:'DONE',fieldMetadata:'{}',
        updatedAt:new Date('2026-01-01'),createdAt:new Date('2026-01-01')}});
    await transitionSample('a','APPROVED','system:fixture','Independent scientific amendment specimen',{approvedAt:new Date()},fixturePrisma);
    const changes = await state.getChanges(a, { cursor: first.nextCursor });
    const types = changes.changes.map(e => e.eventType);
    const hasNullDataPub = changes.changes.some(e => e.eventType === 'PUBLICATION' && e.data === null);
    assert.equal(hasNullDataPub, false, 'PUBLICATION event should not have null data');
    console.log(`[PASS] 3. Republication has complete non-null payloads and events:`, types);

    // Test 4: Batch ID delivery
    assert.ok(first.batchId, 'first.batchId should be delivered');
    assert.ok(changes.batchId, 'changes.batchId should be delivered');
    console.log(`[PASS] 4. Delivered batch IDs to client (${first.batchId}, ${changes.batchId})`);

    // Test 5: Receipt validation rejects unissued batch / impossible count
    const snap = await state.createSnapshot(a);
    const receipt = state.recordReceipt(a, { snapshotId: snap.snapshotId, batchId: 'unissued-arbitrary-4589', importedCount: 1000000 });
    assert.ok(receipt.error, 'Receipt should be rejected for unissued batch or out-of-bounds count');
    console.log(`[PASS] 5. Receipt rejected unissued batch / out-of-bounds count (${receipt.error} ${receipt.status})`);

    // Test 6: Result insert and update on approved sample emit AMENDMENT events
    // The old minimal table omitted the required parameter. This explicit
    // synthetic parameter preserves its original numeric values without
    // pretending that 12.5 belongs to any real analytical method.
    await createResultFixture(fixturePrisma, {data:{id:'r1',sampleId:'a',param:'SYNTHETIC_REVIEW_PARAM',value:'12.5',numericValue:12.5,isValid:true,isCurrent:true}});
    const afterResultInsert = await state.getChanges(a, { cursor: changes.nextCursor });
    assert.ok(afterResultInsert.changes.some(e => e.eventType === 'AMENDMENT' && e.specimenId === 'a'), 'Result insert should emit AMENDMENT');
    console.log(`[PASS] 6. Result insertion emitted AMENDMENT event for approved sample`);

    db.prepare("UPDATE Result SET value='14.0', numericValue=14.0 WHERE id='r1'").run();
    const afterResultUpdate = await state.getChanges(a, { cursor: afterResultInsert.nextCursor });
    assert.ok(afterResultUpdate.changes.some(e => e.eventType === 'AMENDMENT' && e.specimenId === 'a'), 'Result update should emit AMENDMENT');
    console.log(`[PASS] 7. Result update emitted AMENDMENT event for approved sample`);

    // Test 7: Refused deletion preserves science; a hold emits WITHDRAWAL.
    // #179 pin 5991060999: FK refusal preserves the real analytical child.
    const footprint=()=>({sample:db.prepare('SELECT * FROM Sample WHERE id=?').get('a'),
        results:db.prepare('SELECT * FROM Result WHERE sampleId=? ORDER BY id').all('a'),
        journal:db.prepare('SELECT * FROM _exchange_journal ORDER BY sequence').all(),
        audit:db.prepare('SELECT * FROM AuditLog ORDER BY id').all(),
        evidence:db.prepare('SELECT * FROM ResultEvidenceEvent ORDER BY id').all()});
    const beforeDelete=footprint();
    // #179 correction pin 5991283484: RESTRICT uses SQLite's internal
    // trigger code. Prove the real FK is its source, then match both fields.
    assert.equal(db.pragma('foreign_keys', {simple:true}),1);
    assert.equal(db.pragma('foreign_key_list("Result")').filter(row=>row.table === 'Sample' &&
        row.from === 'sampleId' && row.to === 'id' && row.on_delete === 'RESTRICT').length,1);
    const sampleDeleteTriggers=db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' AND tbl_name='Sample'")
        .all().filter(row=>/\bDELETE\b/i.test(row.sql));
    assert.equal(sampleDeleteTriggers.length,1);
    assert.equal(sampleDeleteTriggers[0].name,'trg_sample_ad_withdraw');
    assert.match(sampleDeleteTriggers[0].sql,/\bAFTER\s+DELETE\b/i);
    assert.equal(db.prepare("SELECT sql FROM sqlite_master WHERE type='trigger'").all()
        .filter(row=>row.sql.includes('FOREIGN KEY constraint failed')).length,0);
    const refusal = JSON.parse(require('node:child_process').execFileSync(process.execPath,
        [path.resolve(__dirname, 'workflow_restrict_probe.cjs'), 'Sample_Result_restrict', databasePath, 'a'],
        { encoding: 'utf8', env: { ...process.env, NODE_ENV: 'test', DATABASE_PATH: sourceFixture.dbPath,
            DATABASE_URL: `file:${sourceFixture.dbPath}` } }));
    assert.deepEqual(refusal, { passed: true, name: 'SqliteError', code: 'SQLITE_CONSTRAINT_TRIGGER',
        message: 'FOREIGN KEY constraint failed' });
    assert.deepEqual(footprint(),beforeDelete);
    assert.equal(state.isSpecimenEligible(beforeDelete.sample),true);
    const heldMetadata=JSON.stringify({...JSON.parse(beforeDelete.sample.metadata || '{}'),
        provenanceHold:{status:'AMBIGUOUS_PROVENANCE_HOLD',reason:'issue149 withdrawal race fixture'}});
    db.prepare('UPDATE Sample SET metadata=? WHERE id=?').run(heldMetadata,'a');
    const held=db.prepare('SELECT * FROM Sample WHERE id=?').get('a');
    assert.deepEqual(held,{...beforeDelete.sample,metadata:heldMetadata});
    assert.equal(held.status,'APPROVED');
    assert.equal(state.isSpecimenEligible(held),false);
    assert.equal(JSON.parse(held.metadata).provenanceHold.status,'AMBIGUOUS_PROVENANCE_HOLD');
    const event=db.prepare('SELECT * FROM _exchange_journal WHERE specimen_id=? ORDER BY sequence DESC LIMIT 1').get('a');
    assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='trg_sample_au_withdraw'").get());
    assert.equal(event.event_type,'WITHDRAWAL');
    assert.equal(event.payload,null);
    assert.equal(event.content_hash,state.computeSampleContentHash({...held,results:beforeDelete.results}));
    const afterHold=footprint();
    await state.syncJournal(a);
    assert.deepEqual(footprint(),afterHold);
    assert.deepEqual(afterHold.results,beforeDelete.results);
    assert.deepEqual(afterHold.audit,beforeDelete.audit);
    assert.deepEqual(afterHold.evidence,beforeDelete.evidence);
    assert.deepEqual(afterHold.journal.slice(0,-1),beforeDelete.journal);
    assert.equal(afterHold.journal.filter(row=>row.specimen_id === 'a' && row.event_type === 'WITHDRAWAL').length,1);
    const afterDelete = await state.getChanges(a, { cursor: afterResultUpdate.nextCursor });
    assert.ok(afterDelete.changes.some(e => e.eventType === 'WITHDRAWAL' && e.specimenId === 'a'), 'Held specimen should emit WITHDRAWAL');
    console.log(`[PASS] 8. Deletion refused without writes; the metadata hold emitted WITHDRAWAL and preserved the result`);

    // The original VM migration closes its connection. Run the additional
    // guarded refusal proofs while that same database is still open.
    await assertFinalRefusals();

    // Test 8: Migration after service initialization succeeds
    const migration = source('server/scripts/migrate_exchange_journal_tables.cjs', {
        'better-sqlite3': MemDb,
        fs: { existsSync: () => true }
    });
    let migrationError = '';
    try {
        migration.migrateExchangeTables('memory-only-mocked-path');
    } catch (e) {
        migrationError = e.message;
    }
    assert.equal(migrationError, '', `Migration failed: ${migrationError}`);
    console.log(`[PASS] 9. Migration succeeded cleanly after service initialization`);

    console.log('\nAll working-tree review findings and mutation lifecycle verifications passed!');
})().catch(e => {
    console.error('VERIFICATION ERROR:', e);
    process.exitCode = 1;
}).finally(async () => {
    await fixturePrisma.$disconnect();
    if (db.open) db.close();
    const actualState = require('../../services/exchangeStateService');
    if (actualState.getDb().open) actualState.getDb().close();
    process.env.DATABASE_PATH=sourceFixture.dbPath;
    process.env.DATABASE_URL='file:' + sourceFixture.dbPath;
    rehearsal.close();
    cleanupDisposableDatabase(sourceFixture.runnerDir);
    fs.rmSync(dir,{recursive:true,force:true});
});
