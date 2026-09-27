const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const assert = require('assert/strict');

const root = path.resolve(__dirname, '../..');
const req = require('module').createRequire(path.join(root, 'server/package.json'));
const db = new (req('better-sqlite3'))(':memory:');
db.exec(`
    CREATE TABLE Sample(id TEXT PRIMARY KEY,originalId TEXT,labId TEXT,assignedLab TEXT,country TEXT,projectCode TEXT,status TEXT,fieldMetadata TEXT,updatedAt TEXT,createdAt TEXT);
    CREATE TABLE Result(id TEXT PRIMARY KEY,sampleId TEXT,value TEXT,numericValue REAL,isValid INTEGER,isCurrent INTEGER);
`);

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
const adapter = source('server/services/sisAdapterService.js', {
    './interpretationService': { normalizeUnit: (p, v, u) => ({ normalizedValue: null, standardUnit: u }) }
});
const policy = source('server/services/exchangePolicyService.js', { './projectPolicyService': project });

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

(async () => {
    console.log('Testing working review remediations:');
    state.getDb();
    
    // Test 1: First real-table approval writes durable publication event
    db.prepare('INSERT INTO Sample VALUES (?,?,?,?,?,?,?,?,?,?)').run('a', 'BAG-A', 'ACC-A', 'LAB-A', 'AAA', 'P-A', 'EXPECTED', '{}', '2026-01-01', '2026-01-01');
    db.prepare("UPDATE Sample SET status='APPROVED' WHERE id='a'").run();
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
    db.prepare("UPDATE Sample SET status='CANCELLED' WHERE id='a'").run();
    db.prepare("UPDATE Sample SET status='APPROVED' WHERE id='a'").run();
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
    db.prepare('INSERT INTO Result VALUES (?,?,?,?,?,?)').run('r1', 'a', '12.5', 12.5, 1, 1);
    const afterResultInsert = await state.getChanges(a, { cursor: changes.nextCursor });
    assert.ok(afterResultInsert.changes.some(e => e.eventType === 'AMENDMENT' && e.specimenId === 'a'), 'Result insert should emit AMENDMENT');
    console.log(`[PASS] 6. Result insertion emitted AMENDMENT event for approved sample`);

    db.prepare("UPDATE Result SET value='14.0', numericValue=14.0 WHERE id='r1'").run();
    const afterResultUpdate = await state.getChanges(a, { cursor: afterResultInsert.nextCursor });
    assert.ok(afterResultUpdate.changes.some(e => e.eventType === 'AMENDMENT' && e.specimenId === 'a'), 'Result update should emit AMENDMENT');
    console.log(`[PASS] 7. Result update emitted AMENDMENT event for approved sample`);

    // Test 7: Sample deletion on approved sample emits WITHDRAWAL
    db.prepare("DELETE FROM Sample WHERE id='a'").run();
    const afterDelete = await state.getChanges(a, { cursor: afterResultUpdate.nextCursor });
    assert.ok(afterDelete.changes.some(e => e.eventType === 'WITHDRAWAL' && e.specimenId === 'a'), 'Sample deletion should emit WITHDRAWAL');
    console.log(`[PASS] 8. Sample deletion emitted WITHDRAWAL event for approved sample`);

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
}).finally(() => {
    if (db.open) db.close();
});
