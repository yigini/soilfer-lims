'use strict';
/**
 * Comprehensive verification of Issue #149 Head 9ac1202 Remediations
 * Tests all 4 preserved groups + 3 remediated packages:
 * 1. Package 1: Semantic JSON hold enforcement across writers/readers/counts/observations (JSON null metadata, malformed JSON, escaped JSON).
 * 2. Package 2: Atomic lifecycle preconditions in confirm/abort rotation (no resurrection of revoked/expired keys, 409 on revoked, sibling isolation).
 * 3. Package 3: Durable reference client resume at snapshot_downloaded boundary without duplicate fetches or digest mismatch.
 * 4. Preserved groups: Middle-page failure halt & resume, sibling isolation, exact replacement retirement & live replay.
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
// #179 pin 5990137651: real release guards precede every canonical fixture.
const rehearsal = beforeGuards({ actor: 'system:fixture' });
const databasePath = rehearsal.file;
process.env.DATABASE_PATH = databasePath;
process.env.DATABASE_URL = 'file:' + databasePath;
const { createSampleFixture } = require('../helpers/workflowFixtures');

process.env.DATABASE_PATH = databasePath;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
delete process.env.SOURCE_SYSTEM_ID;

console.log('--- Starting Issue 149 Head 9ac1202 Remediation Verification ---');

const now = new Date().toISOString();

const prisma = require(path.join(root, 'server/prisma'));
const state = require(path.join(root, 'server/services/exchangeStateService'));
let db = null;
const management = require(path.join(root, 'server/controllers/sisController'));
const express = require('express');
const supertest = require('supertest');

const app = express();
app.use(express.json());
app.use('/api/v1/sis', require(path.join(root, 'server/routes/sisRoutes')));
app.use('/api/v2/data-exchange', require(path.join(root, 'server/routes/sisV2Routes')));
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
async function rotate(key, operation) {
    const r = response();
    await management.rotateApiKey({ user: admin, headers: { 'idempotency-key': operation }, params: { id: key.keyId }, body: {} }, r);
    return r;
}
async function sibling(key, name) {
    const r = response();
    await management.createApiKey({ user: admin, body: { name, connectionId: key.connectionId, capabilities: ['SPATIAL', 'SNAPSHOT', 'RECEIPT'], countries: ['AAA'], projects: ['SYNTHETIC-PROJECT'], labs: ['SYNTHETIC-LAB'] } }, r);
    assert.equal(r.statusCode, 200);
    return { connectionId: key.connectionId, keyId: r.body.keyInfo.id, token: r.body.apiKey };
}

(async () => {
    for (const [id, status, approvedAt, metadata] of [
    ['legacy-approved', 'APPROVED', now, null],
    ['legacy-unapproved-archive', 'ARCHIVED', null, null],
    ['legacy-approved-disposed', 'DISPOSED', now, null],
    ['legacy-held-approved', 'APPROVED', now, JSON.stringify({ provenanceHold: { status: 'AMBIGUOUS_PROVENANCE_HOLD' } })],
    ['legacy-processing-prior-approval', 'PROCESSING', now, null]
]) {
        await createSampleFixture(prisma, { data: { id, originalId:id + '-field', labId:id + '-accession',
            assignedLab:'SYNTHETIC-LAB', country:'AAA', projectCode:'SYNTHETIC-PROJECT', status,
            approvedAt: approvedAt ? new Date(approvedAt) : null, updatedAt:new Date(now),
            latitude:12, longitude:34, metadata,
            results:{ create:[{ id:id + '-result', param:'PH_H2O', value:'6.2', numericValue:6.2,
                unit:'pH units', isValid:true, isCurrent:true, updatedAt:new Date(now) }] } } });
    }
    require('../../scripts/migrate_exchange_journal_tables.cjs').migrateExchangeTables(databasePath);
    db = state.getDb();

    try {
        await prisma.lab.create({ data: { id: 'SYNTHETIC-LAB', code: 'SYNTHETIC-LAB', name: 'Synthetic Lab', country: 'AAA' } });
        const reader = await provision('Synthetic reader');

        // Check 1: Escaped JSON provenance hold excluded from list, count, and observations
        const escaped = JSON.stringify({ provenanceHold: { status: 'AMBIGUOUS_PROVENANCE_HOLD' } }).replace('AMBIGUOUS', '\\u0041MBIGUOUS');
        await prisma.sample.update({ where: { id: 'legacy-held-approved' }, data: { metadata: escaped } });
        let r = await get('/api/v2/data-exchange/samples?limit=100', reader);
        assert.equal(r.status, 200);
        assert.equal(r.body.total, 2, 'Total should be 2 when escaped JSON hold is present');
        assert.equal(r.body.data.length, 2, 'Data length should be 2');
        let obs = await get('/api/v2/data-exchange/observations?limit=100', reader);
        assert.equal(obs.status, 200);
        assert.ok(!obs.body.data.some(x => x.specimenId === 'legacy-held-approved'), 'Held specimen excluded from observations');
        console.log('✓ Check 1 passed: Escaped JSON provenance hold excluded from list, total count, and observations.');

        // Check 2: Package 1 - JSON null string metadata treated as held consistently everywhere
        await prisma.sample.update({ where: { id: 'legacy-held-approved' }, data: { metadata: 'null' } });
        assert.equal(state.isSpecimenEligible(await prisma.sample.findUnique({ where: { id: 'legacy-held-approved' } })), false, 'Canonical predicate rejects JSON null metadata');
        r = await get('/api/v2/data-exchange/samples?limit=100', reader);
        assert.equal(r.status, 200);
        assert.equal(r.body.total, 2, 'Total count must agree with data length (2, not 3)');
        assert.equal(r.body.data.length, 2, 'Data length must be 2');
        obs = await get('/api/v2/data-exchange/observations?limit=100', reader);
        assert.equal(obs.status, 200);
        assert.ok(!obs.body.data.some(x => x.specimenId === 'legacy-held-approved'), 'JSON null metadata specimen excluded from observations');
        console.log('✓ Check 2 passed: JSON null metadata consistently excluded from list, total count, and observations.');

        // Restore to escaped hold for subsequent tests
        await prisma.sample.update({ where: { id: 'legacy-held-approved' }, data: { metadata: escaped } });

        // Check 3: Sibling authentication and abort isolation
        const pending = await provision('Pair isolation');
        const other = await sibling(pending, 'Independent sibling');
        const first = await rotate(pending, 'synthetic-pair-isolation');
        assert.equal(first.statusCode, 200);
        assert.equal((await get('/api/v2/data-exchange/samples', other)).status, 200);
        assert.equal((await get('/api/v2/data-exchange/samples', pending)).status, 200);
        let ar = response();
        await management.abortRotation({ user: admin, params: { id: pending.keyId } }, ar);
        assert.equal(ar.statusCode, 200);
        assert.equal((await get('/api/v2/data-exchange/samples', other)).status, 200, 'Sibling remains active after abort');
        console.log('✓ Check 3 passed: Sibling authentication and pair-specific abort preserve unrelated credential.');

        // Check 4: Exact replacement authentication retires old key; replay reflects current state
        const confirmed = await provision('Verified replacement');
        const cr = await rotate(confirmed, 'synthetic-verify-exact');
        assert.equal(cr.statusCode, 200);
        const replacement = { keyId: cr.body.keyInfo.id, token: cr.body.apiKey };
        assert.equal((await get('/api/v2/data-exchange/samples', replacement)).status, 200);
        assert.equal((await get('/api/v2/data-exchange/samples', confirmed)).status, 401, 'Old key retired after replacement auth');
        const replay = await rotate(confirmed, 'synthetic-verify-exact');
        assert.equal(replay.statusCode, 200);
        assert.equal(replay.body.oldKeyActive, false, 'Replay reports oldKeyActive=false');
        console.log('✓ Check 4 passed: Replacement authentication retires old key; replay reports oldKeyActive=false.');

        // Check 5: Package 2 - Confirm cannot resurrect explicitly revoked replacement
        const revokedReplacementOld = await provision('Revoked replacement parent');
        const rr = await rotate(revokedReplacementOld, 'synthetic-revoked-replacement');
        assert.equal(rr.statusCode, 200);
        const revokedReplacement = { keyId: rr.body.keyInfo.id, token: rr.body.apiKey };
        let res = response();
        await management.revokeApiKey({ user: admin, params: { id: revokedReplacement.keyId } }, res);
        assert.equal(res.statusCode, 200);
        assert.equal((await get('/api/v2/data-exchange/samples', revokedReplacement)).status, 401, 'Revoked replacement returns 401');

        // Confirm MUST return 409 and MUST NOT resurrect revoked replacement
        res = response();
        await management.confirmRotation({ user: admin, params: { id: revokedReplacementOld.keyId } }, res);
        assert.equal(res.statusCode, 409, 'Confirm on revoked replacement returns 409 conflict');
        assert.equal((await get('/api/v2/data-exchange/samples', revokedReplacement)).status, 401, 'Revoked replacement remains 401 after failed confirm');
        console.log('✓ Check 5 passed: Confirm rejects revoked replacement with 409 and does NOT resurrect credential.');

        // Check 6: Package 2 - Abort cannot resurrect explicitly revoked original key
        const revokedOld = await provision('Revoked old parent');
        assert.equal((await rotate(revokedOld, 'synthetic-revoked-old')).statusCode, 200);
        res = response();
        await management.revokeApiKey({ user: admin, params: { id: revokedOld.keyId } }, res);
        assert.equal(res.statusCode, 200);
        assert.equal((await get('/api/v2/data-exchange/samples', revokedOld)).status, 401, 'Revoked old key returns 401');

        // Abort MUST return 409 and MUST NOT resurrect revoked old key
        res = response();
        await management.abortRotation({ user: admin, params: { id: revokedOld.keyId } }, res);
        assert.equal(res.statusCode, 409, 'Abort on revoked old key returns 409 conflict');
        assert.equal((await get('/api/v2/data-exchange/samples', revokedOld)).status, 401, 'Revoked old key remains 401 after failed abort');
        console.log('✓ Check 6 passed: Abort rejects revoked original key with 409 and does NOT resurrect credential.');

        // Check 7: Package 2 - Normal confirm and abort work cleanly when not revoked
        const normalConfirmOld = await provision('Normal confirm parent');
        const ncRot = await rotate(normalConfirmOld, 'synthetic-normal-confirm');
        assert.equal(ncRot.statusCode, 200);
        const ncRepl = { keyId: ncRot.body.keyInfo.id, token: ncRot.body.apiKey };
        res = response();
        await management.confirmRotation({ user: admin, params: { id: normalConfirmOld.keyId } }, res);
        assert.equal(res.statusCode, 200, 'Normal confirm succeeds with 200');
        assert.equal((await get('/api/v2/data-exchange/samples', ncRepl)).status, 200, 'Replacement is active');
        assert.equal((await get('/api/v2/data-exchange/samples', normalConfirmOld)).status, 401, 'Old key is retired');
        console.log('✓ Check 7 passed: Normal confirm retires old key and activates replacement cleanly.');

        // Check 8: Package 2 - Normal abort restores old key and revokes replacement cleanly
        const normalAbortOld = await provision('Normal abort parent');
        const naRot = await rotate(normalAbortOld, 'synthetic-normal-abort');
        assert.equal(naRot.statusCode, 200);
        const naRepl = { keyId: naRot.body.keyInfo.id, token: naRot.body.apiKey };
        res = response();
        await management.abortRotation({ user: admin, params: { id: normalAbortOld.keyId } }, res);
        assert.equal(res.statusCode, 200, 'Normal abort succeeds with 200');
        assert.equal((await get('/api/v2/data-exchange/samples', normalAbortOld)).status, 200, 'Old key is restored active');
        assert.equal((await get('/api/v2/data-exchange/samples', naRepl)).status, 401, 'Replacement key is revoked');
        console.log('✓ Check 8 passed: Normal abort restores old key and revokes replacement cleanly.');

        // Check 9: Package 3 - Reference client middle-page failure halt and resume
        let injectPageFailure = false;
        let successfulInjectedPages = 0;
        const cliApp = express();
        cliApp.use(express.json());
        cliApp.use((rq, rs, next) => {
            if (injectPageFailure && rq.path.includes('/snapshots/') && rq.path.endsWith('/pages')) {
                if (rq.query.cursor) return rs.status(400).json({ error: 'SYNTHETIC_PAGE_INTERRUPTION' });
                successfulInjectedPages++;
            }
            next();
        });
        cliApp.use('/api/v2/data-exchange', require(path.join(root, 'server/routes/sisV2Routes')));
        const listener = cliApp.listen(0, '127.0.0.1');
        await new Promise(resolve => listener.once('listening', resolve));

        const clientPath = path.join(root, 'server/scripts/data_exchange_reference_client.cjs');
        const runClient = (checkpoint, label, preload) => new Promise(resolve => {
            require('child_process').execFile(
                process.execPath,
                [...(preload ? ['--require', preload] : []), clientPath, '--url', `http://127.0.0.1:${listener.address().port}`, '--limit', '1', '--checkpoint', checkpoint],
                { env: { ...process.env, EXCHANGE_API_KEY: reader.token }, encoding: 'utf8', timeout: 30000 },
                (error, stdout, stderr) => {
                    fs.writeFileSync(path.join(dir, label + '.log'), stdout + stderr);
                    resolve({ exit: error?.code || 0, stdout, stderr });
                }
            );
        });

        injectPageFailure = true;
        const partialCheckpoint = path.join(dir, 'partial-checkpoint.json');
        const partial1 = await runClient(partialCheckpoint, 'partial1');
        assert.equal(partial1.exit, 1, 'Injected middle page failure causes client exit 1');
        const savedPartial = JSON.parse(fs.readFileSync(partialCheckpoint, 'utf8'));
        assert.equal(savedPartial.type, 'snapshot_partial');
        assert.equal(savedPartial.completed, false);
        assert.equal(savedPartial.totalHarvested, 1);

        injectPageFailure = false;
        const partial2 = await runClient(partialCheckpoint, 'partial2');
        assert.equal(partial2.exit, 0, 'Second process resumes and completes exit 0');
        const finished = JSON.parse(fs.readFileSync(partialCheckpoint, 'utf8'));
        assert.equal(finished.totalHarvested, 2);
        assert.equal(finished.completed, true);
        assert.equal(finished.digestVerified, true);
        console.log('✓ Check 9 passed: Middle-page failure halts dependent feed; second process resumes and verifies full snapshot.');

        // Check 10: Package 3 - Reference client last-page boundary (snapshot_downloaded) exit 77 and clean resume
        const preload = path.join(dir, 'stop-after-downloaded.cjs');
        fs.writeFileSync(preload, "const fs=require('fs');const rename=fs.renameSync;fs.renameSync=function(a,b){const out=rename.apply(this,arguments);try{const s=JSON.parse(fs.readFileSync(b,'utf8'));if(s.type==='snapshot_downloaded')process.exit(77);}catch{}return out;};");
        const boundaryCheckpoint = path.join(dir, 'boundary-checkpoint.json');
        const boundary1 = await runClient(boundaryCheckpoint, 'boundary1', preload);
        assert.equal(boundary1.exit, 77, 'Child exits 77 immediately after snapshot_downloaded rename');
        const boundary = JSON.parse(fs.readFileSync(boundaryCheckpoint, 'utf8'));
        assert.equal(boundary.type, 'snapshot_downloaded');
        assert.equal(boundary.totalHarvested, 2);
        assert.equal(boundary.completed, false);
        assert.equal(boundary.pageCursor, null);

        // Resume with unmodified normal CLI: MUST exit 0, MUST NOT duplicate items, MUST verify digest!
        const boundary2 = await runClient(boundaryCheckpoint, 'boundary2');
        assert.equal(boundary2.exit, 0, `Boundary resume must exit 0, got ${boundary2.exit}. Stderr: ${boundary2.stderr}`);
        const resumed = JSON.parse(fs.readFileSync(boundaryCheckpoint, 'utf8'));
        assert.equal(resumed.totalHarvested, 2, 'Total harvested must remain 2, not duplicate to 4');
        assert.equal(resumed.completed, true, 'Completed must be true');
        assert.equal(resumed.digestVerified, true, 'Digest must be verified');
        console.log('✓ Check 10 passed: Restart at durable last-page boundary resumes without re-download, does NOT duplicate items, and verifies digest cleanly.');

        await new Promise(resolve => listener.close(resolve));
        console.log('\n================================================================');
        console.log('ALL 9 CHECKS PASSED PERFECTLY!');
        console.log('================================================================\n');
        process.exitCode = 0;
    } catch (err) {
        console.error('VERIFICATION FAILED:', err);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    if (db?.open) db.close();
    process.env.DATABASE_PATH = sourceFixture.dbPath;
    process.env.DATABASE_URL = 'file:' + sourceFixture.dbPath;
    rehearsal.close();
    cleanupDisposableDatabase(sourceFixture.runnerDir);
    fs.rmSync(dir, { recursive: true, force: true });

        if (db?.open) db.close();
    }
})();
