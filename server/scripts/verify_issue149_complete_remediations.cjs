'use strict';
/**
 * Complete Verification Probe for PR #149 Remediations
 * Verifies all 15 checks from Codex's focused and follow-through reviews:
 * - Escaped JSON hold exclusion
 * - JSON null unknown metadata policy
 * - Whitespace metadata policy coherence across SQL, JS, list count, observations
 * - Sibling auth and pair-specific abort isolation
 * - Exact replacement retirement and idempotent replay state
 * - Revoked replacement confirm rejection (409) without resurrection
 * - Revoked old key abort rejection (409) without resurrection
 * - Interrupted snapshot page recovery and digest verification
 * - Last-page boundary restart without duplication
 * - Complete change feed backlog drain across pages (limit=1 with 3 events)
 * - Durable checkpoint accounting (retaining harvestedItems, changes, backlog status)
 * - OpenAPI contract alignment (id, batchId, highWaterSequence, nextCursor, GeoJSON traversal)
 * - Observation total with param/basis/censoring filter alignment
 * - Stats query filter binding (country=ZZZ returns 0)
 * - GeoJSON pagination traversal (total, hasMore, nextCursor) and strict bbox validation (400 on malformed)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert/strict');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..', '..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-issue149-all-'));
const databasePath = path.join(dir, 'verify-synthetic.db');

process.env.DATABASE_PATH = databasePath;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
delete process.env.SOURCE_SYSTEM_ID;

const req = require('module').createRequire(path.join(root, 'server', 'package.json'));
const Database = req('better-sqlite3');
const setup = new Database(databasePath);
const now = new Date().toISOString();

setup.exec(fs.readFileSync(path.join(root, 'server/scripts/schema/full_application_schema.sql'), 'utf8'));

for (const [id, status, approvedAt, metadata] of [
    ['legacy-approved', 'APPROVED', now, null],
    ['legacy-unapproved-archive', 'ARCHIVED', null, null],
    ['legacy-approved-disposed', 'DISPOSED', now, null],
    ['legacy-held-approved', 'APPROVED', now, JSON.stringify({ provenanceHold: { status: 'AMBIGUOUS_PROVENANCE_HOLD' } })],
    ['legacy-processing-prior-approval', 'PROCESSING', now, null]
]) {
    setup.prepare('INSERT INTO Sample (id,originalId,labId,assignedLab,country,projectCode,status,approvedAt,updatedAt,latitude,longitude,metadata) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(id, id + '-field', id + '-accession', 'SYNTHETIC-LAB', 'AAA', 'SYNTHETIC-PROJECT', status, approvedAt, now, 12, 34, metadata);
    setup.prepare('INSERT INTO Result (id,sampleId,param,value,numericValue,unit,isValid,isCurrent,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(id + '-result', id, 'PH_H2O', '6.2', 6.2, 'pH units', 1, 1, now);
}
setup.close();

req('./scripts/migrate_exchange_journal_tables.cjs').migrateExchangeTables(databasePath);

const prisma = req('./prisma');
const state = req('./services/exchangeStateService');
const db = state.getDb();
const management = req('./controllers/sisController');
const express = req('express');
const supertest = req('supertest');

const app = express();
app.use(express.json());
app.use('/api/v1/sis', req('./routes/sisRoutes'));
app.use('/api/v2/data-exchange', req('./routes/sisV2Routes'));

const http = supertest(app);
const admin = { id: 'synthetic-admin', role: 'SUPER_ADMIN', username: 'synthetic-review-admin' };
const response = () => ({
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; }
});

let checks = 0;
let listener;
const report = (name, data) => {
    checks++;
    console.log(`[CHECK ${checks}] ${name} ${JSON.stringify(data || {})}`);
};

async function provision(name, scope = {}) {
    const common = {
        name,
        capabilities: ['SPATIAL', 'SNAPSHOT', 'RECEIPT'],
        countries: ['AAA'],
        projects: ['SYNTHETIC-PROJECT'],
        labs: ['SYNTHETIC-LAB'],
        ...scope
    };
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
async function rotate(key, operation) {
    const r = response();
    await management.rotateApiKey({ user: admin, headers: { 'idempotency-key': operation }, params: { id: key.keyId }, body: {} }, r);
    return r;
}
async function sibling(key, name) {
    const r = response();
    await management.createApiKey({
        user: admin,
        body: {
            name,
            connectionId: key.connectionId,
            capabilities: ['SPATIAL', 'SNAPSHOT', 'RECEIPT'],
            countries: ['AAA'],
            projects: ['SYNTHETIC-PROJECT'],
            labs: ['SYNTHETIC-LAB']
        }
    }, r);
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
cliApp.use('/api/v2/data-exchange', req('./routes/sisV2Routes'));

(async () => {
    await prisma.lab.create({ data: { id: 'SYNTHETIC-LAB', code: 'SYNTHETIC-LAB', name: 'Synthetic Lab', country: 'AAA' } });
    const reader = await provision('Synthetic reader');

    // 1. Escaped JSON hold exclusion
    const escaped = JSON.stringify({ provenanceHold: { status: 'AMBIGUOUS_PROVENANCE_HOLD' } }).replace('AMBIGUOUS', '\\u0041MBIGUOUS');
    await prisma.sample.update({ where: { id: 'legacy-held-approved' }, data: { metadata: escaped } });
    let r = await get('/api/v2/data-exchange/samples?limit=100', reader);
    assert.equal(r.status, 200);
    assert.equal(r.body.total, 2);
    assert.equal(r.body.data.length, 2);
    r = await get('/api/v2/data-exchange/observations?limit=100', reader);
    assert.equal(r.status, 200);
    assert.ok(!r.body.data.some(x => x.specimenId === 'legacy-held-approved'));
    report('PASS: Escaped JSON hold excluded from list/count and observations');

    // 2. JSON null policy agrees across list count and observations
    await prisma.sample.update({ where: { id: 'legacy-held-approved' }, data: { metadata: 'null' } });
    assert.equal(state.isSpecimenEligible(await prisma.sample.findUnique({ where: { id: 'legacy-held-approved' } })), false);
    r = await get('/api/v2/data-exchange/samples?limit=100', reader);
    assert.equal(r.status, 200);
    assert.equal(r.body.total, 2);
    assert.equal(r.body.data.length, 2);
    const observations = await get('/api/v2/data-exchange/observations?limit=100', reader);
    assert.equal(observations.status, 200);
    assert.ok(!observations.body.data.some(x => x.specimenId === 'legacy-held-approved'));
    report('PASS: JSON null policy agrees across list count and observations');

    // 3. Whitespace metadata policy coherence
    await prisma.sample.update({ where: { id: 'legacy-held-approved' }, data: { metadata: '   ' } });
    assert.equal(state.isSpecimenEligible(await prisma.sample.findUnique({ where: { id: 'legacy-held-approved' } })), false);
    r = await get('/api/v2/data-exchange/samples?limit=100', reader);
    assert.equal(r.status, 200);
    assert.equal(r.body.total, 2);
    assert.equal(r.body.data.length, 2);
    const whiteObs = await get('/api/v2/data-exchange/observations?limit=100', reader);
    assert.equal(whiteObs.status, 200);
    assert.ok(!whiteObs.body.data.some(x => x.specimenId === 'legacy-held-approved'));
    report('PASS: Whitespace metadata policy agrees across SQL/JS (held/excluded, total 2, no leak)');

    await prisma.sample.update({ where: { id: 'legacy-held-approved' }, data: { metadata: escaped } });

    // 4. Sibling authentication and pair isolation
    const pending = await provision('Pair isolation');
    const other = await sibling(pending, 'Independent sibling');
    const first = await rotate(pending, 'synthetic-pair-isolation');
    assert.equal(first.statusCode, 200);
    assert.equal((await get('/api/v2/data-exchange/samples', other)).status, 200);
    assert.equal((await get('/api/v2/data-exchange/samples', pending)).status, 200);
    let ar = response();
    await management.abortRotation({ user: admin, params: { id: pending.keyId } }, ar);
    assert.equal(ar.statusCode, 200);
    assert.equal((await get('/api/v2/data-exchange/samples', other)).status, 200);
    report('PASS: Sibling authentication and pair-specific abort preserve unrelated credential');

    // 5. Exact replacement retirement & idempotent replay
    const confirmed = await provision('Verified replacement');
    const cr = await rotate(confirmed, 'synthetic-verify-exact');
    assert.equal(cr.statusCode, 200);
    const replacement = { keyId: cr.body.keyInfo.id, token: cr.body.apiKey };
    assert.equal((await get('/api/v2/data-exchange/samples', replacement)).status, 200);
    assert.equal((await get('/api/v2/data-exchange/samples', confirmed)).status, 401);
    const replay = await rotate(confirmed, 'synthetic-verify-exact');
    assert.equal(replay.statusCode, 200);
    assert.equal(replay.body.oldKeyActive, false);
    report('PASS: Exact replacement authentication retires old key; replay reflects current old-key state');

    // 6. Confirm rejects revoked replacement (409) without resurrection
    const revokedReplacementOld = await provision('Revoked replacement');
    const rr = await rotate(revokedReplacementOld, 'synthetic-revoked-replacement');
    assert.equal(rr.statusCode, 200);
    const revokedReplacement = { keyId: rr.body.keyInfo.id, token: rr.body.apiKey };
    let res = response();
    await management.revokeApiKey({ user: admin, params: { id: revokedReplacement.keyId } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal((await get('/api/v2/data-exchange/samples', revokedReplacement)).status, 401);
    res = response();
    await management.confirmRotation({ user: admin, params: { id: revokedReplacementOld.keyId } }, res);
    assert.equal(res.statusCode, 409);
    assert.equal((await get('/api/v2/data-exchange/samples', revokedReplacement)).status, 401);
    report('PASS: Confirm rejects revoked replacement without resurrection');

    // 7. Abort rejects revoked old key (409) without resurrection
    const revokedOld = await provision('Revoked old key');
    assert.equal((await rotate(revokedOld, 'synthetic-revoked-old')).statusCode, 200);
    res = response();
    await management.revokeApiKey({ user: admin, params: { id: revokedOld.keyId } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal((await get('/api/v2/data-exchange/samples', revokedOld)).status, 401);
    res = response();
    await management.abortRotation({ user: admin, params: { id: revokedOld.keyId } }, res);
    assert.equal(res.statusCode, 409);
    assert.equal((await get('/api/v2/data-exchange/samples', revokedOld)).status, 401);
    report('PASS: Abort rejects revoked old credential without resurrection');

    // 8. Snapshot page failure and resume
    listener = cliApp.listen(0, '127.0.0.1');
    await new Promise(resolve => listener.once('listening', resolve));
    const clientPath = path.join(root, 'server/scripts/data_exchange_reference_client.cjs');
    const runClient = (checkpoint, label, preload, extraArgs = []) => new Promise(resolve => {
        require('child_process').execFile(
            process.execPath,
            [...(preload ? ['--require', preload] : []), clientPath, '--url', `http://127.0.0.1:${listener.address().port}`, '--limit', '1', '--checkpoint', checkpoint, ...extraArgs],
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
    assert.equal(partial1.exit, 1);
    assert.equal(successfulInjectedPages, 1);
    const savedPartial = JSON.parse(fs.readFileSync(partialCheckpoint, 'utf8'));
    assert.equal(savedPartial.type, 'snapshot_partial');
    assert.equal(savedPartial.completed, false);
    assert.equal(savedPartial.totalHarvested, 1);

    injectPageFailure = false;
    const partial2 = await runClient(partialCheckpoint, 'partial2');
    assert.equal(partial2.exit, 0, partial2.stdout + '\n' + partial2.stderr);
    const finished = JSON.parse(fs.readFileSync(partialCheckpoint, 'utf8'));
    assert.equal(finished.totalHarvested, 2);
    assert.equal(finished.completed, true);
    assert.equal(finished.digestVerified, true);
    assert.match(partial2.stdout, /Delivered digest: VERIFIED/);
    report('PASS: Failed page stops dependent feed and second process resumes & verifies full snapshot');

    // 9. Last-page boundary restart without duplication
    const preload = path.join(dir, 'stop-after-downloaded.cjs');
    fs.writeFileSync(preload, "const fs=require('fs');const rename=fs.renameSync;fs.renameSync=function(a,b){const out=rename.apply(this,arguments);try{const s=JSON.parse(fs.readFileSync(b,'utf8'));if(s.type==='snapshot_downloaded')process.exit(77);}catch{}return out;};");
    const boundaryCheckpoint = path.join(dir, 'boundary-checkpoint.json');
    const boundary1 = await runClient(boundaryCheckpoint, 'boundary1', preload);
    assert.equal(boundary1.exit, 77);
    const boundary = JSON.parse(fs.readFileSync(boundaryCheckpoint, 'utf8'));
    assert.equal(boundary.type, 'snapshot_downloaded');
    assert.equal(boundary.totalHarvested, 2);
    assert.equal(boundary.completed, false);

    const boundary2 = await runClient(boundaryCheckpoint, 'boundary2');
    assert.equal(boundary2.exit, 0);
    assert.match(boundary2.stdout, /Delivered digest: VERIFIED/);
    const resumed = JSON.parse(fs.readFileSync(boundaryCheckpoint, 'utf8'));
    assert.equal(resumed.totalHarvested, 2);
    report('PASS: Last-page boundary restart verifies persisted download without duplication');

    // 10. Complete change feed backlog drain & durable accounting across pages
    const baseline = JSON.parse(fs.readFileSync(partialCheckpoint, 'utf8'));
    for (const n of [1, 2, 3]) {
        await prisma.result.update({ where: { id: 'legacy-approved-result' }, data: { value: String(6.2 + n / 10), numericValue: 6.2 + n / 10 } });
    }
    const pendingFeed = await get('/api/v2/data-exchange/changes?limit=100&profile=core-lossless-v2&cursor=' + encodeURIComponent(baseline.changeFeedCursor), reader);
    assert.equal(pendingFeed.status, 200);
    assert.equal(pendingFeed.body.count, 3);

    const exportFile = path.join(dir, 'lims-export.json');
    const incremental = await runClient(partialCheckpoint, 'incremental', null, ['--export', exportFile]);
    assert.equal(incremental.exit, 0);
    assert.match(incremental.stdout, /Received 3 events/);

    const afterDrain = JSON.parse(fs.readFileSync(partialCheckpoint, 'utf8'));
    const remaining = await get('/api/v2/data-exchange/changes?limit=100&profile=core-lossless-v2&cursor=' + encodeURIComponent(afterDrain.changeFeedCursor), reader);
    assert.equal(remaining.status, 200);
    assert.equal(remaining.body.count, 0);
    assert.equal(afterDrain.completed, true);
    assert.equal(afterDrain.backlogRemaining, false);
    assert.equal(afterDrain.eventsReceived, 3);
    assert.equal(afterDrain.harvestedItems.length, 2);
    assert.equal(afterDrain.changes.length, 3);

    const exportedData = JSON.parse(fs.readFileSync(exportFile, 'utf8'));
    assert.equal(exportedData.type, 'lims_exchange_export');
    assert.equal(exportedData.harvestedItems.length, 2);
    assert.equal(exportedData.changes.length, 3);
    assert.equal(exportedData.completed, true);
    report('PASS: Reference client completely drains backlog across pages, preserves snapshot items and changes in checkpoint & export sink');

    // 11. OpenAPI specification contract alignment
    const sampleEvent = pendingFeed.body.changes[0];
    assert.ok(sampleEvent.id);
    assert.equal(sampleEvent.eventId, undefined);
    assert.ok(pendingFeed.body.batchId);

    const specification = fs.readFileSync(path.join(root, 'docs/openapi-data-exchange-v2.yaml'), 'utf8');
    const changeSchema = specification.split('    ChangeFeedResponse:')[1].split('    ReceiptSubmissionRequest:')[0];
    assert.ok(changeSchema.includes('id:'));
    assert.ok(changeSchema.includes('batchId:'));

    const snapshotSchema = specification.split('    SnapshotCreateResponse:')[1].split('    ChangeFeedResponse:')[0];
    assert.ok(snapshotSchema.includes('highWaterSequence:'));
    assert.ok(snapshotSchema.includes('nextCursor:'));

    const geoSchema = specification.split('    GeoJsonFeatureCollection:')[1].split('    SnapshotCreateRequest:')[0];
    assert.ok(geoSchema.includes('total:'));
    assert.ok(geoSchema.includes('hasMore:'));
    assert.ok(geoSchema.includes('nextCursor:'));
    report('PASS: OpenAPI contract aligns with actual runtime response fields');

    // 12. Observation count aligns with selected query filters
    const obs = await get('/api/v2/data-exchange/observations?param=NOT_A_SYNTHETIC_PARAMETER&limit=100', reader);
    assert.equal(obs.status, 200);
    assert.equal(obs.body.count, 0);
    assert.equal(obs.body.total, 0);
    report('PASS: Observation total respects param filter');

    // 13. Stats respects request query filters
    const filteredList = await get('/api/v2/data-exchange/samples?country=ZZZ', reader);
    const filteredStats = await get('/api/v2/data-exchange/stats?country=ZZZ', reader);
    assert.equal(filteredList.status, 200);
    assert.equal(filteredStats.status, 200);
    assert.equal(filteredList.body.total, 0);
    assert.equal(filteredStats.body.metrics.totalEligibleSamples, 0);
    assert.equal(filteredStats.body.metrics.standardsCompliant, undefined);
    report('PASS: Stats respects query filters and unsubstantiated standards claim removed');

    // 14. GeoJSON spatial pagination traversal (total, hasMore, nextCursor)
    const geo = await get('/api/v2/data-exchange/geojson?limit=1', reader);
    assert.equal(geo.status, 200);
    assert.equal(geo.body.features.length, 1);
    assert.equal(geo.body.total, 2);
    assert.equal(geo.body.hasMore, true);
    assert.ok(geo.body.nextCursor);

    const geo2 = await get('/api/v2/data-exchange/geojson?limit=1&cursor=' + encodeURIComponent(geo.body.nextCursor), reader);
    assert.equal(geo2.status, 200);
    assert.equal(geo2.body.features.length, 1);
    assert.equal(geo2.body.hasMore, false);
    report('PASS: GeoJSON supports bounded deterministic spatial traversal');

    // 15. GeoJSON bbox strict validation
    const malformed = await get('/api/v2/data-exchange/geojson?bbox=nonsense', reader);
    assert.equal(malformed.status, 400);
    assert.equal(malformed.body.code, 'INVALID_BBOX');

    const validBbox = await get('/api/v2/data-exchange/geojson?bbox=10,10,40,40', reader);
    assert.equal(validBbox.status, 200);
    assert.equal(validBbox.body.features.length, 2);
    report('PASS: GeoJSON validates bbox format & coordinates strictly');

    // 16. Live list cursors fail closed on malformed, cross-connection, cross-endpoint, and old-epoch (P1)
    const malformedGeo = await get('/api/v2/data-exchange/geojson?limit=1&cursor=not-a-cursor', reader);
    assert.equal(malformedGeo.status, 400);
    assert.equal(malformedGeo.body.code, 'INVALID_CURSOR');

    const malformedSamples = await get('/api/v2/data-exchange/samples?limit=1&cursor=not-a-cursor', reader);
    assert.equal(malformedSamples.status, 400);
    assert.equal(malformedSamples.body.code, 'INVALID_CURSOR');

    const otherReader = await provision('Other Connection For Context Test');
    const crossConnGeo = await get('/api/v2/data-exchange/geojson?limit=1&cursor=' + encodeURIComponent(geo.body.nextCursor), otherReader);
    assert.equal(crossConnGeo.status, 400);
    assert.equal(crossConnGeo.body.code, 'CURSOR_CONTEXT_MISMATCH');

    const crossEndpoint = await get('/api/v2/data-exchange/samples?limit=1&cursor=' + encodeURIComponent(geo.body.nextCursor), reader);
    assert.equal(crossEndpoint.status, 400);
    assert.equal(crossEndpoint.body.code, 'CURSOR_ENDPOINT_MISMATCH');

    const oldGeoCursor = geo.body.nextCursor;
    state.rotateEpoch(db, 'VERIFICATION_EPOCH_ROTATION');
    const expiredGeo = await get('/api/v2/data-exchange/geojson?limit=1&cursor=' + encodeURIComponent(oldGeoCursor), reader);
    assert.equal(expiredGeo.status, 410);
    assert.equal(expiredGeo.body.code, 'CURSOR_EXPIRED');
    report('PASS: Live list cursors fail closed on malformed, cross-connection, cross-endpoint, and old-epoch');

    // 17. Strict BBox rejects empty components and out-of-range bounds (P2)
    const emptyComponentBbox = await get('/api/v2/data-exchange/geojson?bbox=,,180,90', reader);
    assert.equal(emptyComponentBbox.status, 400);
    assert.equal(emptyComponentBbox.body.code, 'INVALID_BBOX');

    const outOfRangeBbox = await get('/api/v2/data-exchange/geojson?bbox=200,0,10,10', reader);
    assert.equal(outOfRangeBbox.status, 400);
    assert.equal(outOfRangeBbox.body.code, 'INVALID_BBOX');
    report('PASS: Strict BBox validation rejects empty string components and out-of-range bounds');

    // 18. Shared spatial coordinate resolution: metadata-derived coordinates & truthful totals (P2)
    await prisma.sample.update({
        where: { id: 'legacy-approved' },
        data: { latitude: null, longitude: null, metadata: JSON.stringify({ latitude: 12, longitude: 34 }) }
    });
    const fullGeo = await get('/api/v2/data-exchange/geojson?limit=100', reader);
    const boxedGeo = await get('/api/v2/data-exchange/geojson?bbox=30,10,40,20&limit=100', reader);
    assert.equal(fullGeo.body.features.length, 2);
    assert.equal(boxedGeo.body.features.length, 2);
    assert.ok(boxedGeo.body.features.some(f => f.id === 'legacy-approved' && f.geometry.coordinates[0] === 34 && f.geometry.coordinates[1] === 12));

    await prisma.sample.update({
        where: { id: 'legacy-approved' },
        data: { metadata: null, latitude: null, longitude: null }
    });
    const ungeocodedGeo = await get('/api/v2/data-exchange/geojson?limit=100', reader);
    assert.equal(ungeocodedGeo.body.total, 1);
    assert.equal(ungeocodedGeo.body.count, 1);
    assert.equal(ungeocodedGeo.body.hasMore, false);
    report('PASS: Shared spatial coordinate resolution retains metadata coordinates and truthful total');

    // 19. Canonical OpenAPI YAML parses cleanly and enforces required schema fields (P3)
    const yaml = req('js-yaml');
    const openapiDoc = yaml.load(fs.readFileSync(path.join(root, 'docs/openapi-data-exchange-v2.yaml'), 'utf8'));
    assert.ok(openapiDoc.paths);
    assert.equal(Object.keys(openapiDoc.paths).length, 16);
    assert.ok(openapiDoc.components.schemas.SnapshotCreateResponse.required.includes('snapshotId'));
    assert.ok(openapiDoc.components.schemas.ChangeFeedResponse.required.includes('changes'));
    assert.ok(openapiDoc.components.schemas.ChangeFeedResponse.properties.changes.items.required.includes('eventType'));
    report('PASS: Canonical OpenAPI YAML parses cleanly with 16 paths and strict schema required fields');

    console.log(`\n============================================================`);
    console.log(`ALL ${checks} VERIFICATION CHECKS PASSED.`);
    console.log(`============================================================\n`);
})().catch(err => {
    console.error('VERIFICATION FAILURE:', err);
    process.exitCode = 1;
}).finally(async () => {
    if (listener) await new Promise(resolve => listener.close(resolve));
    await prisma.$disconnect();
    if (db.open) db.close();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
});
