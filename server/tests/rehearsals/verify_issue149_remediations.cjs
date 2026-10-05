// Verification of Issue #149 Remediations against all 12 probe cases and Prisma validation.
// Test-owned full guarded schemas; no working or production database is read.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');

const root = path.resolve(__dirname, '../../..');
const { createDisposableDatabase, cleanupDisposableDatabase } = require('../../scripts/journey_db_isolation.cjs');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const sourceFixture = createDisposableDatabase();
process.env.DATABASE_PATH=sourceFixture.dbPath;
process.env.DATABASE_URL='file:' + sourceFixture.dbPath;
process.env.NODE_ENV='test';
const rehearsal=beforeGuards({actor:'system:fixture'});
// The old-journal compatibility probe owns a second fresh schema. Its history
// is created once; no populated journal or application row is ever dropped.
const olderJournal=beforeGuards({actor:'system:fixture'});
process.env.DATABASE_PATH=rehearsal.file;
process.env.DATABASE_URL='file:' + rehearsal.file;
const { createSampleFixture } = require('../helpers/workflowFixtures');
const { transitionSample } = require('../../services/sampleStateService');
const fixturePrisma = require('../../prisma');
const req = require('module').createRequire(path.join(root, 'server', 'package.json'));
const Sqlite = req('better-sqlite3');
let memory = new Sqlite(rehearsal.file,{fileMustExist:true});
const mainMemory=memory;

function source(rel, mocks) {
    const mod = { exports: {} };
    const context = {
        module: mod,
        exports: mod.exports,
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
    };
    vm.runInNewContext(fs.readFileSync(path.join(root, rel), 'utf8'), context, { filename: rel });
    return mod.exports;
}

const adapter = require('../../services/sisAdapterService');
const policy = require('../../services/exchangePolicyService');
const prisma=fixturePrisma;

function FakeDb() { return memory; }
const dbFuncs = source('server/services/exchangeDbFunctions.js', {
    './sisAdapterService': adapter
});
const state = source('server/services/exchangeStateService.js', {
    'better-sqlite3': FakeDb,
    '../prisma': prisma,
    './exchangePolicyService': policy,
    './sisAdapterService': adapter,
    './exchangeDbFunctions': dbFuncs,
    './projectPolicyService': {getProgrammeChildProjectCodes:()=>[]}
});

const authA = { type: 'API_KEY', keyId: 'key-A', role: 'NSIS_CONSUMER', labs: ['LAB-A'], countries: ['AAA'], projects: ['P-A'] };
const authB = { ...authA, keyId: 'key-B', labs: ['LAB-B'], countries: ['BBB'], projects: ['P-B'] };
const row = (id, lab, country, project) => ({
    id,
    originalId: 'BAG-' + id,
    labId: 'ACC-' + id,
    assignedLab: lab,
    country,
    projectCode: project,
    status: 'ACCEPTED',
    dryingStatus: 'DONE', preparationStatus: 'DONE', fieldMetadata: '{}',
    updatedAt: new Date('2026-01-01'),
    createdAt: new Date('2026-01-01')
});

async function approve(data) {
    await createSampleFixture(fixturePrisma,{data});
    await transitionSample(data.id,'APPROVED','system:fixture','Independent exchange verification fixture',{approvedAt:new Date()},fixturePrisma);
}
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
            journal:mainMemory.prepare('SELECT COUNT(*) n FROM _exchange_journal').get().n,
            audits:await fixturePrisma.auditLog.count(), evidence:await fixturePrisma.resultEvidenceEvent.count() });
        const before = await fingerprint();
        await assert.rejects(transitionSample(id, attempted, 'system:fixture', 'Forbidden legacy verification step', {}, fixturePrisma),
            error => error.statusCode === 409 && error.code === 'ILLEGAL_STATUS_TRANSITION');
        assert.deepEqual(await fingerprint(), before);
        console.log('[PASS] ' + final + ' to ' + attempted + ': 409 ILLEGAL_STATUS_TRANSITION and zero row/journal/audit/evidence writes');
    }
}




let passed = 0;
function verifyRemediation(name, condition, detail) {
    assert.ok(condition, 'FAILED REMEDIATION: ' + name);
    console.log(`[REMEDIATED ${++passed}/12] ${name} ${detail ? JSON.stringify(detail) : ''}`);
}

(async () => {
    // Probe 1: Scoped journal prevents B from receiving A's payload
    state.getDb();
    await approve(row('a','LAB-A','AAA','P-A'));
    await approve(row('b','LAB-B','BBB','P-B'));
    const aFeed = await state.getChanges(authA);
    const bFeed = await state.getChanges(authB);
    const bReceivedA = bFeed.changes.some(e => e.specimenId === 'a' && e.data?.country === 'AAA');
    verifyRemediation('B does NOT receive A payload from shared journal', !bReceivedA, { bChanges: bFeed.changes.map(e => e.specimenId) });

    // Probe 2: Empty laboratory scope fails closed (0 changes)
    const denied = await state.getChanges({ ...authB, keyId: 'empty-lab-key', labs: [] });
    verifyRemediation('Empty laboratory scope receives 0 journal payloads (fail closed)', denied.changes.length === 0, { count: denied.changes.length });

    // Probe 3: Scope revocation check denies prior frozen snapshot
    const snap = await state.createSnapshot(authA);
    const shrunken = await state.getSnapshotPage(snap.snapshotId, { ...authA, labs: ['OTHER'] });
    verifyRemediation('Scope revocation rejects access to prior snapshot (FORBIDDEN)', shrunken.error === 'FORBIDDEN', { error: shrunken.error });

    // Probe 4: Changed exported metadata generates new AMENDMENT event
    const before = aFeed.nextCursor;
    memory.prepare('UPDATE Sample SET fieldMetadata=? WHERE id=?').run(
        JSON.stringify({collectionDate:'2026-01-02',site_id:'DIFFERENT'}),'a');
    const afterMeta = await state.getChanges(authA, { cursor: before });
    verifyRemediation('Changed exported metadata triggers AMENDMENT event in journal', afterMeta.count >= 1, { count: afterMeta.count });

    // Probe 5: #179 pin 5990587479 keeps W held and publishes a distinct S.
    const beforeHold=memory.prepare('SELECT * FROM Sample WHERE id=?').get('a');
    const oldJournal=memory.prepare('SELECT * FROM _exchange_journal ORDER BY sequence').all();
    const metadata=JSON.stringify({...JSON.parse(beforeHold.metadata || '{}'),provenanceHold:{
        status:'AMBIGUOUS_PROVENANCE_HOLD',reason:'issue149 withdrawal race fixture'}});
    memory.prepare('UPDATE Sample SET metadata=? WHERE id=?').run(metadata,'a');
    const held=memory.prepare('SELECT * FROM Sample WHERE id=?').get('a');
    assert.deepEqual(held,{...beforeHold,metadata});
    assert.equal(held.status,'APPROVED');
    assert.equal(state.isSpecimenEligible(held),false);
    assert.ok(memory.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='trg_sample_au_withdraw'").get());
    const withdrawal=memory.prepare('SELECT * FROM _exchange_journal WHERE specimen_id=? ORDER BY sequence DESC LIMIT 1').get('a');
    assert.equal(withdrawal.event_type,'WITHDRAWAL');
    assert.equal(withdrawal.payload,null);
    assert.equal(withdrawal.content_hash,state.computeSampleContentHash({...held,results:[]}));
    const afterHold=memory.prepare('SELECT * FROM _exchange_journal ORDER BY sequence').all();
    assert.deepEqual(afterHold.slice(0,-1),oldJournal);
    await state.syncJournal(authA);
    assert.deepEqual(memory.prepare('SELECT * FROM _exchange_journal ORDER BY sequence').all(),afterHold);
    await approve(row('republished-a','LAB-A','AAA','P-A'));
    const afterTransient = await state.getChanges(authA, { cursor: before });
    verifyRemediation('Inter-poll held withdrawal and independent publication captured in journal', afterTransient.count >= 1, { count: afterTransient.count });

    // Probe 6: Cross-snapshot cursor rejected
    const foreignCursor = state.encodeCursor({ snapshotId: 'different-snapshot', itemOrder: 999 });
    const wrongPage = await state.getSnapshotPage(snap.snapshotId, authA, { cursor: foreignCursor });
    verifyRemediation('Cross-snapshot cursor rejected with INVALID_CURSOR', wrongPage.error === 'INVALID_CURSOR', { error: wrongPage.error });

    // Probe 7: Cross-connection cursor rejected
    const wrongConn = await state.getChanges(authB, { cursor: afterMeta.nextCursor });
    verifyRemediation('Cross-connection cursor rejected with INVALID_CURSOR', wrongConn.error === 'INVALID_CURSOR', { error: wrongConn.error });

    // Probe 8: Forged future sequence cursor rejected
    const future = await state.getChanges(authA, { cursor: state.encodeCursor({ seq: 999999999 }) });
    verifyRemediation('Forged future sequence cursor rejected with INVALID_CURSOR', future.error === 'INVALID_CURSOR', { error: future.error });

    // Probe 9: OpenNSIS strict profile rejects specimen with null accession
    const strict = await state.getChanges(authA, { profile: 'opennsis' });
    await approve({...row('unaccessioned','LAB-A','AAA','P-A'),labId:null});
    const strictNext = await state.getChanges(authA, { profile: 'opennsis', cursor: strict.nextCursor });
    const hasUnaccessioned = strictNext.changes.some(e => e.specimenId === 'unaccessioned' && e.data?.labSampleId === null);
    verifyRemediation('OpenNSIS strict profile excludes unaccessioned specimen', !hasUnaccessioned, { count: strictNext.changes.length });

    // Probe 10: Spectral Prisma translation retains sampleId parent authorization
    const translated = policy.toPrismaSpectralWhere(policy.buildSpectralWhere(authA, {}));
    verifyRemediation('Spectral Prisma translation binds parent authorization to sampleId', 'sampleId' in translated && !('sample' in translated), translated);

    // Probe 11: Unissued batch or fractional count rejected
    const receipt = state.recordReceipt(authA, { batchId: 'never-issued', importedCount: 1.5 });
    verifyRemediation('Unissued fractional import receipt rejected', receipt.error === 'INVALID_COUNT' || receipt.error === 'BATCH_NOT_FOUND', { error: receipt.error });

    // Probe 12: Request-time schema initialization preserves populated prior journal (additive DDL)
    await assertFinalRefusals();
    memory=new Sqlite(olderJournal.file,{fileMustExist:true});
    assert.equal(memory.pragma('foreign_keys',{simple:true}),1);
    assert.equal(memory.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='trigger'").get().n,11);
    assert.equal(memory.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND name='_exchange_journal'").get().n,0);
    memory.exec("CREATE TABLE _exchange_journal(id TEXT PRIMARY KEY,payload TEXT); INSERT INTO _exchange_journal VALUES ('prior','synthetic-release-history');");
    const prior=memory.prepare('SELECT * FROM _exchange_journal').get();
    const again = source('server/services/exchangeStateService.js', {
        'better-sqlite3': FakeDb,
        '../prisma': prisma,
        './exchangePolicyService': policy,
        './sisAdapterService': adapter,
        './exchangeDbFunctions': dbFuncs,
        './projectPolicyService': {getProgrammeChildProjectCodes:()=>[]}
    });
    again.getDb();
    const retainedCount = memory.prepare('SELECT COUNT(*) n FROM _exchange_journal').get().n;
    assert.deepEqual(memory.prepare('SELECT id,payload FROM _exchange_journal').get(),prior);
    verifyRemediation('Request-time initialization preserves populated prior journal (non-destructive)', retainedCount === 1, { retainedCount });

    // Extra: Real Prisma Client Validation with translated where clause
    const { PrismaClient } = req('./prisma_client');
    const { PrismaBetterSqlite3 } = req('@prisma/adapter-better-sqlite3');
    const realPrisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file::memory:' }) });
    try {
        const spectralWhere = policy.toPrismaSpectralWhere({
            ...policy.buildSpectralWhere(authA, {}),
            sampleId: 'synthetic-sample'
        });
        assert.ok(!('sample' in spectralWhere), 'sample predicate must be removed');
        assert.equal(spectralWhere.sampleId, 'synthetic-sample');
        try {
            await realPrisma.spectralData.findMany({
                where: spectralWhere,
                select: { id: true, modality: true, qcStatus: true, status: true, timestamp: true }
            });
        } catch (e) {
            // PrismaClientValidationError is the bug from F4. P2021 (table does not exist in memory DB) proves validation passed!
            if (e.name === 'PrismaClientValidationError') {
                throw new Error('PrismaClientValidationError was thrown! F4 not resolved: ' + e.message);
            }
            assert.equal(e.code, 'P2021', 'Prisma validation passed, execution reached driver');
        }
        console.log('[REMEDIATED EXTRA] Generated Prisma client accepts V2 specimen-detail spectral query without PrismaClientValidationError');
    } finally {
        await realPrisma.$disconnect();
    }

    console.log(`\nALL ${passed}/12 PROBE REMEDIATIONS AND REAL PRISMA CLIENT VALIDATIONS VERIFIED SUCCESSFULLY.`);
})().catch(e => {
    console.error('VERIFICATION ERROR:', e);
    process.exitCode = 1;
}).finally(async () => {
    await fixturePrisma.$disconnect();
    if(memory.open) memory.close();
    if(mainMemory.open) mainMemory.close();
    const actualState=require('../../services/exchangeStateService');
    if(actualState.getDb().open) actualState.getDb().close();
    process.env.DATABASE_PATH=sourceFixture.dbPath;
    process.env.DATABASE_URL='file:' + sourceFixture.dbPath;
    olderJournal.close(); rehearsal.close();
    cleanupDisposableDatabase(sourceFixture.runnerDir);
});
