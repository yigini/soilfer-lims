const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { createStartupImpactFixture } = require('../helpers/startupImpactFixture');

const legacySource = fs.readFileSync(path.join(__dirname, '../fixtures/order_revision_impact_before_set_query.txt'), 'utf8');
const currentInstaller = fs.readFileSync(path.join(__dirname, '../../scripts/install_order_revisions.js'), 'utf8');
const currentSource = currentInstaller.slice(currentInstaller.indexOf('function impact(db) {'), currentInstaller.indexOf('\nfunction snapshot(db, prior = null)')).trim();
const dependencies = {
    ...require('../../services/orderLineResolutionService'),
    ...require('../../services/workItemKinds'),
    ...require('../../services/workAttemptReservationService'),
    ...require('../../services/textureOrderContract'),
    ...require('../../services/orderRevisionContract'),
    workflow: require('../../workflowContract')
};
const legacyImpact = vm.runInNewContext(`(${legacySource})`, dependencies);
const currentImpact = vm.runInNewContext(`(${currentSource})`, dependencies);

function fixture(samples, options = {}) {
    const declared = { samples, ...options };
    return createStartupImpactFixture(declared);
}

function readImpact(fn, { db, statements }) {
    const before = db.prepare('SELECT total_changes() n').get().n;
    statements.length = 0;
    const began = performance.now();
    const report = fn(db);
    const elapsedMs = performance.now() - began;
    // SQLite's passive statement trace observes actual execution. No SQL is
    // forwarded, rewritten or hidden; the fixture is query_only after seeding.
    const executed = [...statements];
    expect(executed.every(sql => /^(SELECT|PRAGMA)\b/.test(sql))).toBe(true);
    const pointLookups = executed.filter(sql => sql.startsWith('SELECT requiredAnalyses FROM Sample WHERE id=')).length;
    const ownerSetQueries = executed.filter(sql => sql.includes('s.id AS storedSampleId')).length;
    expect(db.prepare('SELECT total_changes() n').get().n).toBe(before);
    return { report: JSON.parse(JSON.stringify(report)), pointLookups, ownerSetQueries, elapsedMs };
}

test('all nonzero refusal, malformed-selection, reservation and approved-amendment report fields match the legacy query', () => {
    expect(createHash('sha256').update(legacySource).digest('hex'))
        .toBe('d9e3ce2a0c107c8ef61ef3a5d7b43c0dca625b2c639df72236b9e76ce4eaf6a2');
    const db = fixture(240);
    try {
        const old = readImpact(legacyImpact, db);
        const current = readImpact(currentImpact, db);
        expect(current.report).toEqual(old.report);
        expect(current.report.invalidStoredAnalysisSampleCount).toBeGreaterThan(0);
        expect(current.report.continuingReservedOpenCount).toBeGreaterThan(0);
        expect(current.report.ambiguousOpenReservationCount).toBeGreaterThan(0);
        expect(current.report.prospectiveApprovedAmendmentRefusalCount).toBeGreaterThan(0);
        expect(current.report.approvedAmendmentKitGate).toBe('STOP_APPROVED_AMENDMENT_REMEDIATION_REQUIRED');
        expect(current.report.multipleActiveSampleCount).toBeGreaterThan(0);
        expect(current.pointLookups).toBe(0);
        expect(current.ownerSetQueries).toBe(1);
    } finally { db.db.close(); }
});

test('missing sample keeps the legacy failure rather than silently dropping its fraction owners', () => {
    const db = fixture(1, { orphan: true });
    try {
        const outcomes = [legacyImpact, currentImpact].map(fn => {
            try { fn(db.db); return { unexpectedSuccess: true }; }
            catch (error) { return { name: error.name, message: error.message, code: error.code }; }
        });
        expect(outcomes[0].name).toBe('TypeError');
        expect(outcomes[1]).toEqual(outcomes[0]);
    } finally { db.db.close(); }
});

test('empty impact is unchanged and the join adds no fields to reported owner objects', () => {
    const db = fixture(0);
    try { expect(readImpact(currentImpact, db).report).toEqual(readImpact(legacyImpact, db).report); }
    finally { db.db.close(); }
});

test('large seeded impact remains equivalent while replacing all per-sample lookups with one set query', () => {
    const db = fixture(12000);
    try {
        const old = readImpact(legacyImpact, db);
        const current = readImpact(currentImpact, db);
        expect(current.report).toEqual(old.report);
        expect(old.pointLookups).toBe(12000);
        expect(current.pointLookups).toBe(0);
        expect(current.ownerSetQueries).toBe(1);
        console.log(JSON.stringify({ event: 'ORDER_IMPACT_OWNED_SEEDED_QUERY_MEASUREMENT', samples: 12000,
            oldElapsedMs: old.elapsedMs, newElapsedMs: current.elapsedMs, oldPointLookups: old.pointLookups,
            newPointLookups: current.pointLookups, reportsEqual: true, rssBytes: process.memoryUsage().rss,
            notProductionTimingOrStartupQualification: true }));
    } finally { db.db.close(); }
});

test('the synthetic fixture refuses extra capabilities, undeclared cases and another caller', () => {
    for (const options of [{ samples: 2 }, { samples: 1, sql: 'SELECT 1' },
        { samples: 1, db: {} }, { samples: 1, file: ':memory:' }, { samples: 1, orphan: 1 }])
        expect(() => createStartupImpactFixture(options)).toThrow('closed startup impact fixture');
    const getState = jest.spyOn(expect, 'getState');
    const state = getState();
    try {
        getState.mockReturnValue({ ...state, testPath: path.join(__dirname, 'unlisted.test.js') });
        const options = { samples: 0 };
        expect(() => createStartupImpactFixture(options)).toThrow('exact test caller');
    } finally { getState.mockRestore(); }
});

test('the fixture scanner binding refuses changed source, runtime callers and unrelated tests', () => {
    const { scanSource } = require('../helpers/workflowWriteScanner');
    const filename = 'tests/helpers/startupImpactFixture.js';
    const source = fs.readFileSync(path.join(__dirname, '../helpers/startupImpactFixture.js'), 'utf8');
    expect(scanSource(source, filename)).toEqual([]);
    expect(scanSource(source + '\n', filename)).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'HISTORICAL_FIXTURE_SOURCE_MISMATCH' }),
        expect.objectContaining({ code: 'RAW_WORKFLOW_SQL' })]));
    expect(scanSource(source, 'controllers/canary.js')).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'RAW_WORKFLOW_SQL' })]));
    const imported = "const { createStartupImpactFixture } = require('../helpers/startupImpactFixture'); const options={samples:0}; createStartupImpactFixture(options);";
    expect(scanSource(imported, 'tests/contracts/unlisted.test.js')).toEqual([
        expect.objectContaining({ code: 'HISTORICAL_FIXTURE_CALLER_NOT_ALLOWED' })]);
    expect(scanSource(imported.replace('../helpers/', '../tests/helpers/'), 'controllers/canary.js')).toEqual([
        expect.objectContaining({ code: 'TEST_HELPER_IMPORTED_BY_RUNTIME' })]);
});
