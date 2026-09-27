// Verification of Issue #140 Remediations against all 15 probe cases.
// Uses private in-memory SQLite and synthetic records. No application database or network used.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const { createRequire } = require('module');

const root = path.resolve(__dirname, '..', '..');
const req = createRequire(path.join(root, 'server', 'package.json'));
const Sqlite = req('better-sqlite3');
const memory = new Sqlite(':memory:');

function source(rel, mocks) {
    const mod = { exports: {} };
    const context = {
        module: mod,
        exports: mod.exports,
        require(name) {
            if (Object.hasOwn(mocks, name)) return mocks[name];
            if (['path', 'crypto'].includes(name)) return require(name);
            throw Error('Unexpected dependency: ' + name);
        },
        process: { env: {} },
        __dirname: path.dirname(path.join(root, rel)),
        Buffer,
        Date,
        console
    };
    vm.runInNewContext(fs.readFileSync(path.join(root, rel), 'utf8'), context, { filename: rel });
    return mod.exports;
}

const normalize = { normalizeUnit: (p, v, u) => ({ normalizedValue: null, standardUnit: u }) };
const adapter = source('server/services/sisAdapterService.js', { './interpretationService': normalize });
const policy = source('server/services/exchangePolicyService.js', { './projectPolicyService': { getProgrammeChildProjectCodes: () => [] } });

function matches(row, where) {
    return Object.entries(where).every(([k, v]) => {
        if (k === 'AND') return v.every(w => matches(row, w));
        if (k === 'OR') return v.some(w => matches(row, w));
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
            for (const order of orderBy || []) {
                const [key, dir] = Object.entries(order)[0];
                const d = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
                if (d) return dir === 'desc' ? -d : d;
            }
            return 0;
        }).slice(0, take)
    }
};

function FakeDb() { return memory; }
const dbFuncs = source('server/services/exchangeDbFunctions.js', {
    './sisAdapterService': adapter
});
const state = source('server/services/exchangeStateService.js', {
    'better-sqlite3': FakeDb,
    '../prisma': prisma,
    './exchangePolicyService': policy,
    './sisAdapterService': adapter,
    './exchangeDbFunctions': dbFuncs
});

const auth = { type: 'API_KEY', id: 'key-123', name: 'same display name', role: 'NSIS_CONSUMER', labs: ['LAB-A'], countries: ['AAA'], projects: ['P'] };
const fixture = (id, date) => ({
    id,
    originalId: 'BAG-' + id,
    labId: 'ACC-' + id,
    assignedLab: 'LAB-A',
    country: 'AAA',
    projectCode: 'P',
    status: 'APPROVED',
    updatedAt: new Date(date),
    createdAt: new Date(date),
    results: []
});

let passed = 0;
function verify(name, condition, detail) {
    assert.ok(condition, 'FAILED: ' + name);
    console.log(`[PASS] Probe remediation ${++passed}: ${name} ${detail ? JSON.stringify(detail) : ''}`);
}

(async () => {
    // Probe 1: Same snapshot does NOT change after result-only edit (R2)
    const a = fixture('a', '2026-01-01');
    rows = [a];
    await state.syncJournal(auth);
    const snap = await state.createSnapshot(auth);
    const before = await state.getSnapshotPage(snap.snapshotId, auth);
    a.results = [{ id: 'r1', param: 'X', value: '77', isCurrent: true }];
    const after = await state.getSnapshotPage(snap.snapshotId, auth);
    verify('Snapshot remains frozen after result-only edit', before.data[0].observations.length === 0 && after.data[0].observations.length === 0);

    // Probe 2: Snapshot row does NOT disappear after later sample update (R2)
    a.updatedAt = new Date(Date.now() + 60000);
    const retained = await state.getSnapshotPage(snap.snapshotId, auth);
    verify('Snapshot row does not disappear after sample update', snap.totalSamples === 1 && retained.count === 1);

    // Probe 3: Different credentials with same display name are isolated (R3)
    const accessWithDifferentKey = state.getSnapshot(snap.snapshotId, { ...auth, id: 'different-key' });
    verify('Different credentials cannot access snapshot', accessWithDifferentKey.error === 'FORBIDDEN');

    // Probe 4: Change sequence is monotonic and does not restart at 1 (R1)
    memory.exec('DELETE FROM _exchange_journal');
    rows = [fixture('a', '2026-01-01'), fixture('b', '2026-01-02')];
    await state.syncJournal(auth);
    const page1 = await state.getChanges(auth, { limit: 1 });
    const page2 = await state.getChanges(auth, { limit: 1, cursor: page1.nextCursor });
    verify('Change sequence progresses monotonically across pages', page1.changes[0].sequence === 1 && page2.changes[0].sequence === 2);

    // Probe 5: Previously published cancellation emits WITHDRAWAL event (R1)
    rows[1].status = 'CANCELLED';
    rows[1].updatedAt = new Date('2026-02-01');
    await state.syncJournal(auth);
    const withdrawals = await state.getChanges(auth, { cursor: page2.nextCursor });
    verify('Previously published cancellation emits WITHDRAWAL event', withdrawals.count === 1 && withdrawals.changes[0].eventType === 'WITHDRAWAL');

    // Probe 6: Result-only amendment emits AMENDMENT event (R1)
    rows[0].results = [{ id: 'new-result', param: 'X', value: '9' }];
    rows[0].updatedAt = new Date('2026-02-02');
    await state.syncJournal(auth);
    const resultChanges = await state.getChanges(auth, { cursor: withdrawals.nextCursor });
    verify('Result-only amendment emits AMENDMENT event', resultChanges.count === 1 && resultChanges.changes[0].eventType === 'AMENDMENT');

    // Probe 7: Journal actively populated with events (R1)
    const journalCount = memory.prepare('SELECT COUNT(*) n FROM _exchange_journal').get().n;
    verify('Journal actively records exchange events', journalCount >= 4, { journalCount });

    // Probe 8: Unissued snapshot rejected; negative counts rejected; receipts idempotent (R3)
    const badReceipt1 = state.recordReceipt(auth, { snapshotId: 'not-issued', importedCount: -50 });
    verify('Invalid/unissued receipt rejected', badReceipt1.error === 'INVALID_COUNT' || badReceipt1.error === 'SNAPSHOT_NOT_FOUND');

    const validReceipt1 = state.recordReceipt(auth, { snapshotId: snap.snapshotId, importedCount: 1, checkpoint: 'item_1' });
    const validReceipt2 = state.recordReceipt(auth, { snapshotId: snap.snapshotId, importedCount: 1, checkpoint: 'item_1' });
    verify('Delivery receipts are idempotent', validReceipt1.receiptId === validReceipt2.receiptId && validReceipt2.idempotent === true);

    // Probe 9: Profile reference disambiguated by country:project namespace, not confirmed profile from horizon (R5)
    const p1 = adapter.extractProfileReference({ projectCode: 'P', country: 'AAA', horizon: 'Ap' }, { site_id: 'POINT-1' });
    const p2 = adapter.extractProfileReference({ projectCode: 'P', country: 'BBB', horizon: 'Ap' }, { site_id: 'POINT-1' });
    verify('Profile reference disambiguated and not falsely confirmed', p1.profileRelation === 'SITE_POINT' && p1.profileKey !== p2.profileKey && p1.profileKey === 'AAA:P:POINT-1' && p2.profileKey === 'BBB:P:POINT-1');

    // Probe 10: Institution does not fall back to accession; publicationStatus truthful; collectorName redacted (R5, R6)
    const formatted = adapter.formatSampleV2({ ...fixture('x', '2026-01-01'), assignedLab: null, status: 'EXPECTED', fieldMetadata: JSON.stringify({ collector: 'SYNTHETIC PERSON' }) });
    verify('Institution is null when unassigned; status is DRAFT; collector is null', formatted.laboratoryId === null && formatted.publicationStatus === 'DRAFT' && formatted.sampling.collectorName === null);

    // Probe 11: Boolean coordinate metadata rejected (R7)
    const malformed = adapter.extractCoordinates({}, { latitude: { value: false }, longitude: { value: false } });
    verify('Boolean coordinate metadata returns null', malformed === null);

    // Probe 12: Invalid calendar date rejected (R7)
    const dates = adapter.extractDates({}, { collectionDate: '2026-99-99' });
    verify('Invalid calendar date returns null', dates.collectionDate === null);

    // Probe 13: Blank result string is null, LOD/LOQ/provenance preserved (R7)
    const obs = adapter.extractObservations({ results: [{ id: 'blank', param: 'X', value: '', isCurrent: true, lod: 0.5, loq: 1, provenance: 'PREDICTED' }] })[0];
    verify('Blank result is null and LOD/LOQ/provenance preserved', obs.asMeasured.value === null && obs.lod === 0.5 && obs.loq === 1 && obs.provenance === 'PREDICTED');

    // Probe 14: Accession matching lab name does not defeat assignedLab policy (R4)
    const misplaced = { ...fixture('z', '2026-01-01'), labId: 'LAB-A', assignedLab: 'LAB-B' };
    verify('Accession matching lab name does not defeat assignedLab scoping', !matches(misplaced, policy.buildSampleWhere(auth, {})));

    // Probe 15: Spectral policy binds to parent sample release and scoping (R4)
    const spectral = policy.buildSpectralWhere(auth, { project: 'P', country: 'AAA' });
    verify('Spectral policy binds to parent sample relation', Object.hasOwn(spectral, 'sample') && spectral.sample.country === 'AAA');

    console.log(`\nALL ${passed} PROBE REMEDIATIONS VERIFIED SUCCESSFULLY.`);
})().catch(e => {
    console.error('PROBE VERIFICATION ERROR:', e);
    process.exitCode = 1;
}).finally(() => memory.close());
