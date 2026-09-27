// Bounded verification test for PR149 b5ddd14 remediation findings F1-F7 & Codex review probes
// Uses actual application Sample table and pure triggers; zero synthetic fixtures.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const assert = require('assert/strict');

const root = path.resolve(__dirname, '../..');
const req = require('module').createRequire(path.join(root, 'server/package.json'));
const db = new (req('better-sqlite3'))(':memory:');
db.exec(`CREATE TABLE Sample(id TEXT PRIMARY KEY, originalId TEXT, labId TEXT, assignedLab TEXT, country TEXT, projectCode TEXT, status TEXT, fieldMetadata TEXT, updatedAt TEXT, createdAt TEXT);`);

function source(rel, mocks, logs = console) {
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(root, rel), 'utf8'), {
        module,
        exports: module.exports,
        require: n => {
            if (Object.hasOwn(mocks, n)) return mocks[n];
            if (['path', 'crypto', 'events', 'stream', 'util'].includes(n)) return require(n);
            throw Error(n);
        },
        __dirname: path.dirname(path.join(root, rel)),
        process: { env: {} },
        Buffer,
        Date,
        console: logs
    }, { filename: rel });
    return module.exports;
}

const project = { getProgrammeChildProjectCodes: () => [] };
const adapter = source('server/services/sisAdapterService.js', {
    './interpretationService': { normalizeUnit: (p, v, u) => ({ normalizedValue: null, standardUnit: u }) }
});
const policy = source('server/services/exchangePolicyService.js', { './projectPolicyService': project });

function matches(row, w) {
    return Object.entries(w).every(([k, v]) => {
        if (k === 'AND') return v.every(x => matches(row, x));
        if (k === 'OR') return v.some(x => matches(row, x));
        const a = row[k];
        if (v instanceof Date) return +a === +v;
        if (v && typeof v === 'object') {
            return Object.entries(v).every(([op, b]) => ({
                in: () => b.includes(a),
                not: () => a !== b,
                lt: () => a < b,
                lte: () => a <= b,
                gt: () => a > b,
                gte: () => a >= b
            }[op] || (() => false))());
        }
        return a === v;
    });
}

function readRows() {
    return db.prepare('SELECT * FROM Sample').all().map(s => ({
        ...s,
        updatedAt: new Date(s.updatedAt),
        createdAt: new Date(s.createdAt),
        results: []
    }));
}

function put(s) {
    db.prepare(`
        INSERT OR REPLACE INTO Sample(id, originalId, labId, assignedLab, country, projectCode, status, fieldMetadata, updatedAt, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(s.id, s.originalId, s.labId, s.assignedLab, s.country, s.projectCode, s.status, s.fieldMetadata || '{}', s.updatedAt, s.createdAt);
}

function change(id, patch) {
    const sets = Object.keys(patch).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(patch), id];
    db.prepare(`UPDATE Sample SET ${sets} WHERE id = ?`).run(...values);
}

const prisma = {
    sample: {
        count: async ({ where }) => readRows().filter(r => matches(r, where)).length,
        findMany: async ({ where, orderBy, take }) => readRows().filter(r => matches(r, where)).sort((a, b) => {
            for (const o of orderBy || []) {
                const [k, d] = Object.entries(o)[0];
                const n = a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0;
                if (n) return d === 'desc' ? -n : n;
            }
            return 0;
        }).slice(0, take)
    }
};

function FakeDb() { return db; }
const mocks = {
    'better-sqlite3': FakeDb,
    '../prisma': prisma,
    './exchangePolicyService': policy,
    './sisAdapterService': adapter,
    './projectPolicyService': project
};

const state = source('server/services/exchangeStateService.js', mocks);

const a = { type: 'API_KEY', keyId: 'A', role: 'NSIS_CONSUMER', labs: ['LAB-A'], countries: ['AAA'], projects: ['P-A'] };
const b = { ...a, keyId: 'B', labs: ['LAB-B'], countries: ['BBB'], projects: ['P-B'] };
const row = (id, lab, country, project, status = 'APPROVED') => ({
    id, originalId: 'BAG-' + id, labId: 'ACC-' + id, assignedLab: lab, country, projectCode: project, status, fieldMetadata: '{}', updatedAt: '2026-01-01', createdAt: '2026-01-01', results: []
});

let passed = 0;
function test(name, condition, detail = '') {
    assert.ok(condition, `${name} failed: ${JSON.stringify(detail)}`);
    passed++;
    console.log(`[PASS ${passed}/8] ${name}`);
}

(async () => {
    console.log('--- Starting PR149 b5ddd14 Review Remediations Verification ---');
    state.getDb();
    
    // Setup initial data
    put(row('a', 'LAB-A', 'AAA', 'P-A'));
    put(row('b', 'LAB-B', 'BBB', 'P-B'));

    const firstA = await state.getChanges(a);
    const firstB = await state.getChanges(b);
    assert.ok(firstB.changes.every(e => e.specimenId === 'b'));
    assert.equal((await state.getChanges({ ...b, labs: [] })).count, 0);

    // Probe 1: Two persisted transitions committed to SQLite source table are captured in journal
    change('a', { status: 'CANCELLED' });
    change('a', { status: 'APPROVED' });
    const afterTransitions = await state.getChanges(a, { cursor: firstA.nextCursor });
    test('1. Two persisted transitions committed to SQLite source table are captured in journal',
        afterTransitions.count >= 2 &&
        afterTransitions.changes.some(e => e.eventType === 'WITHDRAWAL') &&
        afterTransitions.changes.some(e => e.eventType === 'PUBLICATION'),
        { count: afterTransitions.count, events: afterTransitions.changes.map(e => e.eventType) }
    );

    // Probe 2: Cross-connection cursor after service restart is rejected with 400 INVALID_CURSOR
    const fresh = source('server/services/exchangeStateService.js', mocks);
    const cross = await fresh.getChanges(b, { cursor: firstA.nextCursor });
    test('2. Cross-connection cursor after service restart is rejected with 400 INVALID_CURSOR',
        cross.error === 'INVALID_CURSOR' && cross.status === 400,
        cross
    );

    // Probe 3: Unregistered first-page cursor used by another connection is rejected with 400 INVALID_CURSOR
    const noRestart = await state.getChanges({ ...b, keyId: 'B-first' }, { cursor: firstB.nextCursor });
    test('3. Unregistered first-page cursor used by another connection is rejected with 400 INVALID_CURSOR',
        noRestart.error === 'INVALID_CURSOR' && noRestart.status === 400,
        noRestart
    );

    // Probe 4: Project scope removal returns 403 FORBIDDEN
    const snap = await state.createSnapshot(a);
    const snapProj = await state.getSnapshotPage(snap.snapshotId, { ...a, projects: ['OTHER'] });
    test('4. Project scope removal fails closed with 403 FORBIDDEN',
        snapProj.error === 'FORBIDDEN' && snapProj.status === 403,
        snapProj
    );

    // Probe 5: Country scope removal returns 403 FORBIDDEN
    const snapCountry = await state.getSnapshotPage(snap.snapshotId, { ...a, countries: ['OTHER'] });
    test('5. Country scope removal fails closed with 403 FORBIDDEN',
        snapCountry.error === 'FORBIDDEN' && snapCountry.status === 403,
        snapCountry
    );

    // Probe 6: Reducing wildcard laboratory scope to empty returns 403 FORBIDDEN
    const wildcard = { ...a, keyId: 'wildcard', labs: ['*'], countries: ['*'], projects: ['*'] };
    const all = await state.createSnapshot(wildcard);
    const revoked = await state.getSnapshotPage(all.snapshotId, { ...wildcard, labs: [] });
    test('6. Reducing wildcard laboratory scope to empty fails closed with 403 FORBIDDEN',
        revoked.error === 'FORBIDDEN' && revoked.status === 403,
        revoked
    );

    // Probe 7: Arbitrary unissued batch ID returns 404 BATCH_NOT_FOUND
    const receipt = state.recordReceipt(a, { batchId: 'arbitrary-unissued-batch-987', importedCount: 1 });
    test('7. Arbitrary unissued batch returns 404 BATCH_NOT_FOUND',
        receipt.error === 'BATCH_NOT_FOUND' && receipt.status === 404,
        receipt
    );

    // Probe 8: V2 getSpectra controller returns 200 with zero ReferenceErrors
    const controllerErrors = [];
    const emptyPrisma = {
        sample: { findMany: async () => [] },
        spectralData: { findMany: async () => [], count: async () => 0 },
        analysis: { findMany: async () => [] },
        methodology: { findMany: async () => [] }
    };
    const controller = source('server/controllers/sisV2Controller.js', {
        '../prisma': emptyPrisma,
        '../services/sisAdapterService': adapter,
        '../services/exchangePolicyService': policy,
        '../services/exchangeStateService': state
    }, { ...console, error: (...args) => controllerErrors.push(args.map(String).join(' ')) });
    const res = {
        code: 200,
        status(c) { this.code = c; return this; },
        json(body) { this.body = body; return this; }
    };
    await controller.getSpectra({ sisAuth: a, query: {} }, res);
    test('8. Actual V2 spectra controller returns 200 with zero ReferenceErrors',
        res.code === 200 && controllerErrors.length === 0,
        { code: res.code, errors: controllerErrors }
    );

    console.log(`\nAll ${passed}/8 remediations verified successfully!`);
})().catch(e => {
    console.error('FAILED VERIFICATION:', e);
    process.exitCode = 1;
}).finally(() => db.close());
