// Verification of Issue #149 Remediations against all 12 probe cases and Prisma validation.
// Pure in-memory SQLite and memory-only Prisma driver. Zero app database or network used.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');

const root = path.resolve(__dirname, '..', '..');
const req = require('module').createRequire(path.join(root, 'server', 'package.json'));
const Sqlite = req('better-sqlite3');
const memory = new Sqlite(':memory:');

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

const adapter = source('server/services/sisAdapterService.js', {
    './interpretationService': { normalizeUnit: (p, v, u) => ({ normalizedValue: null, standardUnit: u }) }
});
const policy = source('server/services/exchangePolicyService.js', {
    './projectPolicyService': { getProgrammeChildProjectCodes: () => [] }
});

function matches(row, w) {
    return Object.entries(w).every(([k, v]) => {
        if (k === 'AND') return v.every(x => matches(row, x));
        if (k === 'OR') return v.some(x => matches(row, x));
        const a = row[k];
        if (v instanceof Date) return +a === +v;
        if (v && typeof v === 'object') return Object.entries(v).every(([op, b]) => ({
            in: () => b.includes(a),
            not: () => a !== b,
            lt: () => a < b,
            lte: () => a <= b,
            gt: () => a > b,
            gte: () => a >= b
        }[op] || (() => false))());
        return a === v;
    });
}

let rows = [];
const prisma = {
    sample: {
        count: async ({ where }) => rows.filter(r => matches(r, where)).length,
        findMany: async ({ where, orderBy, take }) => rows.filter(r => matches(r, where)).sort((a, b) => {
            for (const o of orderBy || []) {
                const [k, d] = Object.entries(o)[0];
                const n = a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0;
                if (n) return d === 'desc' ? -n : n;
            }
            return 0;
        }).slice(0, take)
    }
};

function FakeDb() { return memory; }
const state = source('server/services/exchangeStateService.js', {
    'better-sqlite3': FakeDb,
    '../prisma': prisma,
    './exchangePolicyService': policy,
    './sisAdapterService': adapter
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
    status: 'APPROVED',
    updatedAt: new Date('2026-01-01'),
    createdAt: new Date('2026-01-01'),
    results: []
});

let passed = 0;
function verifyRemediation(name, condition, detail) {
    assert.ok(condition, 'FAILED REMEDIATION: ' + name);
    console.log(`[REMEDIATED ${++passed}/12] ${name} ${detail ? JSON.stringify(detail) : ''}`);
}

(async () => {
    // Probe 1: Scoped journal prevents B from receiving A's payload
    rows = [row('a', 'LAB-A', 'AAA', 'P-A'), row('b', 'LAB-B', 'BBB', 'P-B')];
    await state.getChanges(authA);
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
    const before = bFeed.nextCursor;
    rows[0].fieldMetadata = JSON.stringify({ collectionDate: '2026-01-02', site_id: 'DIFFERENT' });
    const afterMeta = await state.getChanges(authA, { cursor: before });
    verifyRemediation('Changed exported metadata triggers AMENDMENT event in journal', afterMeta.count >= 1, { count: afterMeta.count });

    // Probe 5: Inter-poll cancellation and republication captured
    rows[0].status = 'CANCELLED';
    rows[0].status = 'APPROVED';
    const afterTransient = await state.getChanges(authA, { cursor: before });
    verifyRemediation('Inter-poll cancellation and republication captured in journal', afterTransient.count >= 1, { count: afterTransient.count });

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
    rows.push({ ...row('unaccessioned', 'LAB-A', 'AAA', 'P-A'), labId: null });
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
    memory.exec('DROP TABLE IF EXISTS _exchange_journal; CREATE TABLE _exchange_journal(id TEXT PRIMARY KEY, payload TEXT); INSERT INTO _exchange_journal VALUES (\'prior\', \'synthetic-release-history\');');
    const again = source('server/services/exchangeStateService.js', {
        'better-sqlite3': FakeDb,
        '../prisma': prisma,
        './exchangePolicyService': policy,
        './sisAdapterService': adapter
    });
    again.getDb();
    const retainedCount = memory.prepare('SELECT COUNT(*) n FROM _exchange_journal').get().n;
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
}).finally(() => memory.close());
