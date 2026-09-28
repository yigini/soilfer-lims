'use strict';
// Focused verification of PR #149 head 932cb6a remediations.
// Synthetic disposable DB only.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const crypto = require('crypto');

const root = path.resolve(__dirname, '../..');
const dir = fs.mkdtempSync(path.join(root, 'server', 'issue149-disposable-test-'));
const databasePath = path.join(dir, 'synthetic-test.db');
process.env.DATABASE_PATH = databasePath;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
delete process.env.SOURCE_SYSTEM_ID;

const Database = require('better-sqlite3');
const setup = new Database(databasePath);
const now = new Date().toISOString();

setup.exec(fs.readFileSync(path.join(root, 'server/scripts/schema/full_application_schema.sql'), 'utf8'));

for (const [id, status, approvedAt, metadata] of [
    ['legacy-approved', 'APPROVED', now, null],
    ['legacy-unapproved-archive', 'ARCHIVED', null, null],
    ['legacy-approved-disposed', 'DISPOSED', now, null],
    ['legacy-held-approved', 'APPROVED', now, JSON.stringify({ provenanceHold: { status: 'AMBIGUOUS_PROVENANCE_HOLD' } })],
    ['legacy-processing-prior-approval', 'PROCESSING', now, null],
    ['legacy-resolved-hold', 'APPROVED', now, JSON.stringify({ provenanceHold: { status: 'RESOLVED', history: [{ status: 'AMBIGUOUS_PROVENANCE_HOLD' }] } })]
]) {
    setup.prepare('INSERT INTO Sample (id, originalId, labId, assignedLab, country, projectCode, status, approvedAt, updatedAt, latitude, longitude, metadata) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(id, id + '-field', id + '-accession', 'SYNTHETIC-LAB', 'AAA', 'SYNTHETIC-PROJECT', status, approvedAt, now, 12, 34, metadata);
    setup.prepare('INSERT INTO Result (id, sampleId, param, value, numericValue, unit, isValid, isCurrent, updatedAt) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(id + '-result', id, 'PH_H2O', '6.2', 6.2, 'pH units', 1, 1, now);
}
setup.close();

require('./migrate_exchange_journal_tables.cjs').migrateExchangeTables(databasePath);

const prisma = require('../prisma');
const state = require('../services/exchangeStateService');
const db = state.getDb();
const management = require('../controllers/sisController');
const express = require('express');
const supertest = require('supertest');

const app = express();
app.use(express.json());
app.use('/api/v1/sis', require('../routes/sisRoutes'));
app.use('/api/v2/data-exchange', require('../routes/sisV2Routes'));
const http = supertest(app);

const admin = { id: 'synthetic-admin', role: 'SUPER_ADMIN', username: 'synthetic-review-admin' };
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
    assert.equal(c.statusCode, 200);
    const r = response();
    await management.createApiKey({ user: admin, body: { ...common, connectionId: c.body.data.id } }, r);
    assert.equal(r.statusCode, 200);
    return { connectionId: c.body.data.id, keyId: r.body.keyInfo.id, token: r.body.apiKey };
}

async function get(url, key) { return http.get(url).set('x-api-key', key.token); }
async function post(url, key, body) { return http.post(url).set('x-api-key', key.token).send(body); }
async function rotate(key, operation, controller = management) {
    const r = response();
    await controller.rotateApiKey({ user: admin, headers: { 'idempotency-key': operation }, params: { id: key.keyId }, body: {} }, r);
    return r;
}
async function sibling(key, name) {
    const r = response();
    await management.createApiKey({ user: admin, body: { name, connectionId: key.connectionId, capabilities: ['SPATIAL', 'SNAPSHOT', 'RECEIPT'], countries: ['AAA'], projects: ['SYNTHETIC-PROJECT'], labs: ['SYNTHETIC-LAB'] } }, r);
    assert.equal(r.statusCode, 200);
    return { connectionId: key.connectionId, keyId: r.body.keyInfo.id, token: r.body.apiKey };
}

let injectPageFailure = false;
let injectedPages = 0;
let successfulInjectedPages = 0;
const cliApp = express();
cliApp.use(express.json());
cliApp.use((rq, rs, next) => {
    if (injectPageFailure && rq.path.includes('/snapshots/') && rq.path.endsWith('/pages')) {
        injectedPages++;
        if (rq.query.cursor) return rs.status(400).json({ error: 'SYNTHETIC_PAGE_INTERRUPTION' });
        successfulInjectedPages++;
    }
    next();
});
cliApp.use('/api/v2/data-exchange', require('../routes/sisV2Routes'));

let listener;

(async () => {
    console.log('--- Starting Issue 149 Head 932cb6a Remediation Verification ---');

    // 1. Initial journal backfill
    const included = db.prepare('SELECT specimen_id FROM _exchange_journal ORDER BY specimen_id').all().map(x => x.specimen_id);
    assert.deepEqual(included, ['legacy-approved', 'legacy-approved-disposed', 'legacy-resolved-hold']);
    console.log('✓ Check 1 passed: Backfill excludes canonical held specimen and includes resolved hold specimen.');

    await prisma.lab.create({ data: { id: 'SYNTHETIC-LAB', code: 'SYNTHETIC-LAB', name: 'Synthetic Lab', country: 'AAA' } });
    const reader = await provision('Synthetic reader');

    let r = await get('/api/v2/data-exchange/samples?limit=100', reader);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.data.map(x => x.specimenId).sort(), included);
    console.log('✓ Check 2 passed: Live samples endpoint returns exactly eligible specimens.');

    // 2. Metadata hold triggers WITHDRAWAL event
    const before = db.prepare('SELECT MAX(sequence) n FROM _exchange_journal').get().n;
    await prisma.sample.update({ where: { id: 'legacy-approved' }, data: { metadata: JSON.stringify({ provenanceHold: { status: 'AMBIGUOUS_PROVENANCE_HOLD' } }) } });
    const heldEvent = db.prepare('SELECT event_type, payload FROM _exchange_journal WHERE specimen_id=? AND sequence>? ORDER BY sequence DESC LIMIT 1').get('legacy-approved', before);
    assert.equal(heldEvent.event_type, 'WITHDRAWAL');
    assert.equal(heldEvent.payload, null);
    console.log('✓ Check 3 passed: Metadata update to hold creates WITHDRAWAL event in journal.');

    // 3. Escaped JSON hold (\u0041MBIGUOUS_PROVENANCE_HOLD)
    const escaped = JSON.stringify({ provenanceHold: { status: 'AMBIGUOUS_PROVENANCE_HOLD' } }).replace('AMBIGUOUS', '\\u0041MBIGUOUS');
    assert.equal(JSON.parse(escaped).provenanceHold.status, 'AMBIGUOUS_PROVENANCE_HOLD');
    await prisma.sample.update({ where: { id: 'legacy-held-approved' }, data: { metadata: escaped } });

    // Live HTTP check: MUST NOT return legacy-held-approved!
    r = await get('/api/v2/data-exchange/samples?limit=100', reader);
    assert.equal(r.status, 200);
    assert.equal(r.body.data.some(x => x.specimenId === 'legacy-held-approved'), false, 'Escaped JSON hold must NOT be returned in live samples!');
    assert.equal(state.isSpecimenEligible(await prisma.sample.findUnique({ where: { id: 'legacy-held-approved' } })), false);

    // Stats check: stats must also exclude escaped hold!
    const statsRes = await get('/api/v2/data-exchange/stats', reader);
    assert.equal(statsRes.status, 200);
    // Only legacy-approved-disposed and legacy-resolved-hold are eligible right now
    assert.equal(statsRes.body.metrics.totalEligibleSamples, 2);
    console.log('✓ Check 4 passed: Escaped JSON hold is semantically excluded from live HTTP samples and stats.');

    // Reset legacy-approved to released for client pagination checks
    await prisma.sample.update({ where: { id: 'legacy-approved' }, data: { metadata: null } });

    // 4. Lost rotation response bounded overlap
    const lost = await provision('Lost response bounded overlap');
    const op = 'synthetic-overlap';
    const first = await rotate(lost, op);
    assert.equal(first.statusCode, 200);
    assert.ok(first.body.apiKey);

    delete require.cache[require.resolve('../controllers/sisController')];
    const fresh = require('../controllers/sisController');
    const retry = await rotate(lost, op, fresh);
    assert.equal(retry.statusCode, 200);
    assert.equal(retry.body.apiKey, undefined, 'Replay must not expose plaintext replacement secret');
    assert.equal((await get('/api/v2/data-exchange/samples', lost)).status, 200, 'Old key must remain active during bounded overlap');
    console.log('✓ Check 5 passed: Lost response retry retains old key and suppresses secret on replay.');

    // 5. Sibling key isolation: authenticating an unrelated sibling MUST NOT retire the rotating key!
    const unrelated = await sibling(lost, 'Pre-existing sibling credential');
    assert.equal((await get('/api/v2/data-exchange/samples', unrelated)).status, 200);
    assert.equal((await get('/api/v2/data-exchange/samples', lost)).status, 200, 'Unrelated sibling authentication must NOT retire rotating key!');

    const replayAfterSibling = await rotate(lost, op, fresh);
    assert.equal(replayAfterSibling.body.oldKeyActive, true, 'Replay must truthfully report oldKeyActive=true while rotating key is active');
    console.log('✓ Check 6 passed: Sibling key authentication does NOT retire rotating key; replay is accurate.');

    // Now authenticate replacement key: this MUST retire the old key!
    const replAuthRes = await get('/api/v2/data-exchange/samples', { token: first.body.apiKey });
    assert.equal(replAuthRes.status, 200);
    assert.equal((await get('/api/v2/data-exchange/samples', lost)).status, 401, 'Old rotating key is retired once replacement key authenticates');

    const replayAfterRetire = await rotate(lost, op, fresh);
    assert.equal(replayAfterRetire.body.oldKeyActive, false, 'Replay must reflect retired state');
    console.log('✓ Check 7 passed: Authentic replacement key use retires bound old key and updates replay state.');

    // 6. Abort isolation: aborting one rotation must NOT revoke independent sibling keys!
    const abortOld = await provision('Abort isolation');
    const abortSibling = await sibling(abortOld, 'Independent same-connection credential');
    const abortFirst = await rotate(abortOld, 'synthetic-abort-isolation');
    assert.equal(abortFirst.statusCode, 200);

    const ar = response();
    await management.abortRotation({ user: admin, params: { id: abortOld.keyId } }, ar);
    assert.equal(ar.statusCode, 200);

    const siblingRecord = await prisma.apiKey.findUnique({ where: { id: abortSibling.keyId } });
    assert.equal(siblingRecord.isActive, true, 'Independent sibling key must remain active after abort!');
    const oldRecord = await prisma.apiKey.findUnique({ where: { id: abortOld.keyId } });
    assert.equal(oldRecord.isActive, true, 'Aborted key must be restored to active!');
    const replRecord = await prisma.apiKey.findUnique({ where: { id: abortFirst.body.keyInfo.id } });
    assert.equal(replRecord.isActive, false, 'Replacement key must be revoked on abort!');
    console.log('✓ Check 8 passed: Abort rotation restores old key, revokes replacement, leaves sibling active.');

    // 7. Prune preview and apply agree, preserving fresh receipt
    const snap = await post('/api/v2/data-exchange/snapshots', reader, {});
    assert.equal(snap.status, 201);
    const receipt = await post('/api/v2/data-exchange/receipts', reader, {
        snapshotId: snap.body.snapshotId,
        receiptId: 'synthetic-new-retention-receipt',
        importedCount: 0,
        quarantinedCount: 0
    });
    assert.equal(receipt.status, 200);

    db.prepare('UPDATE _exchange_snapshots SET expires_at=? WHERE id=?').run('2020-01-01T00:00:00.000Z', snap.body.snapshotId);
    const pruner = require('./prune_exchange_storage.cjs');
    const preview = pruner.pruneExchangeStorage(databasePath, { dryRun: true });
    const applied = pruner.pruneExchangeStorage(databasePath);
    assert.equal(preview.prunedReceipts, 0);
    assert.equal(applied.prunedReceipts, 0);
    assert.equal(preview.prunedSnapshots, applied.prunedSnapshots);
    console.log('✓ Check 9 passed: Prune preview and apply agree, preserving fresh receipt after snapshot expiry.');

    // 8. Normal Reference Client execution and second process completed-checkpoint resume
    listener = cliApp.listen(0, '127.0.0.1');
    await new Promise(resolve => listener.once('listening', resolve));
    const clientPath = path.join(root, 'server/scripts/data_exchange_reference_client.cjs');

    const runClient = (checkpoint, label) => new Promise(resolve => {
        require('child_process').execFile(
            process.execPath,
            [clientPath, '--url', `http://127.0.0.1:${listener.address().port}`, '--limit', '1', '--checkpoint', checkpoint],
            { env: { ...process.env, EXCHANGE_API_KEY: reader.token }, encoding: 'utf8', timeout: 30000 },
            (error, stdout, stderr) => {
                fs.writeFileSync(path.join(dir, label + '.log'), stdout + stderr);
                resolve({ exit: error?.code || 0, stdout, stderr });
            }
        );
    });

    const normalCheckpoint = path.join(dir, 'normal-checkpoint.json');
    const normal1 = await runClient(normalCheckpoint, 'normal1');
    assert.equal(normal1.exit, 0, 'Normal client run 1 must succeed');

    const normalFirst = JSON.parse(fs.readFileSync(normalCheckpoint, 'utf8'));
    assert.equal(normalFirst.completed, true);
    assert.equal(normalFirst.digestVerified, true);

    const normal2 = await runClient(normalCheckpoint, 'normal2');
    assert.equal(normal2.exit, 0, 'Normal client run 2 must succeed');
    const normalSecond = JSON.parse(fs.readFileSync(normalCheckpoint, 'utf8'));
    assert.equal(normalFirst.snapshotId, normalSecond.snapshotId, 'Second run must reuse completed snapshot');
    console.log('✓ Check 10 passed: Normal reference client completes and second process resumes completed checkpoint.');

    // 9. Injected Failure and Resumption
    injectPageFailure = true;
    const partialCheckpoint = path.join(dir, 'partial-checkpoint.json');
    const partial1 = await runClient(partialCheckpoint, 'partial1');
    assert.equal(partial1.exit, 1, 'Injected page failure must cause client to exit 1');
    assert.equal(successfulInjectedPages, 1, 'Exactly 1 page should have succeeded before failure');

    const partialState1 = JSON.parse(fs.readFileSync(partialCheckpoint, 'utf8'));
    assert.equal(partialState1.completed, false, 'Incomplete snapshot must NOT be marked completed!');
    assert.notEqual(partialState1.type, 'change_feed', 'Incomplete snapshot must NOT be marked as change_feed!');
    assert.ok(partialState1.pageCursor, 'Incomplete snapshot must retain pageCursor');
    assert.ok(partialState1.snapshotMeta, 'Incomplete snapshot must retain snapshotMeta');
    assert.equal(partialState1.totalHarvested, 1, 'Incomplete snapshot must retain harvested count');
    console.log('✓ Check 11 passed: Partial snapshot failure halts dependent steps without corrupting checkpoint.');

    // Resume with injected failure cleared
    injectPageFailure = false;
    const partial2 = await runClient(partialCheckpoint, 'partial2');
    assert.equal(partial2.exit, 0, 'Second process resuming partial snapshot must exit 0');

    const partialState2 = JSON.parse(fs.readFileSync(partialCheckpoint, 'utf8'));
    assert.equal(partialState2.completed, true, 'Resumed snapshot must now be completed');
    assert.equal(partialState2.digestVerified, true, 'Resumed snapshot must have digest verified');
    assert.equal(partialState2.snapshotId, partialState1.snapshotId, 'Resumed snapshot must finish the same snapshot');

    // Confirm that partial2 did NOT claim "previously verified and completed (0 items)"
    assert.ok(!partial2.stdout.includes('previously verified and completed in checkpoint (0 items)'), 'Must not claim completed before resuming');
    assert.ok(partial2.stdout.includes('Retrieved 3 items') || partial2.stdout.includes('Retrieved 2 items'), 'Must download remaining items and verify digest');
    console.log('✓ Check 12 passed: Second process resumes partial snapshot, downloads remaining data, verifies digest, and completes.');

    console.log('\n================================================================');
    console.log('ALL 12 CHECKS PASSED PERFECTLY!');
    console.log('================================================================\n');
})().catch(e => {
    console.error('VERIFICATION FAILED:', e);
    process.exitCode = 1;
}).finally(async () => {
    if (listener) await new Promise(resolve => listener.close(resolve));
    await prisma.$disconnect();
    if (db.open) db.close();
    try {
        fs.rmSync(dir, { recursive: true, force: true });
    } catch (e) {}
});
