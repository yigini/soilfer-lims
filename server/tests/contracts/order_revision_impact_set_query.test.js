const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const Database = require('better-sqlite3');

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

function fixture(samples, { orphan = false } = {}) {
    // New disposable in-memory data only. No file or application connection exists.
    const db = new Database(':memory:');
    db.exec(`
        CREATE TABLE Sample(id TEXT PRIMARY KEY,requiredAnalyses TEXT,status TEXT);
        CREATE TABLE WorkItem(id TEXT PRIMARY KEY,sampleId TEXT,analysis TEXT,status TEXT,duplicateOf TEXT);
        CREATE INDEX WorkItem_sampleId_idx ON WorkItem(sampleId);
        CREATE TABLE SampleOrderRevision(id TEXT PRIMARY KEY,sampleId TEXT,status TEXT);
        CREATE TABLE OrderLine(id TEXT PRIMARY KEY,revisionId TEXT,analysis TEXT,status TEXT,workItemId TEXT);
        CREATE TABLE WorkAttempt(id TEXT PRIMARY KEY,workItemId TEXT,orderLineId TEXT,status TEXT);
    `);
    const sample = db.prepare('INSERT INTO Sample VALUES(?,?,?)');
    const item = db.prepare('INSERT INTO WorkItem VALUES(?,?,?,?,?)');
    const revision = db.prepare('INSERT INTO SampleOrderRevision VALUES(?,?,?)');
    const line = db.prepare('INSERT INTO OrderLine VALUES(?,?,?,?,?)');
    const attempt = db.prepare('INSERT INTO WorkAttempt VALUES(?,?,?,?)');
    db.transaction(() => {
        for (let n = 0; n < samples; n++) {
            const id = String(n).padStart(6, '0');
            const selections = ['["TEXTURE"]', '{malformed', 'null', '[null]', '[]', '["SAND"]'][n % 6];
            if (!orphan) sample.run(id, selections, n % 7 === 0 ? 'APPROVED' : 'PROCESSING');
            for (const [i, analysis] of ['SAND', 'SILT', 'CLAY'].entries()) {
                if (n % 5 === 0 && i === 2) continue;
                item.run(`${id}-${i}`, id, analysis, n % 7 === 0 ? 'ACCEPTED' : 'IN_PROGRESS', null);
            }
            item.run(`${id}-waived`, id, 'CLAY', 'WAIVED', null);
            if (n % 4 !== 0) {
                revision.run(`${id}-r1`, id, 'ACTIVE');
                line.run(`${id}-l1`, `${id}-r1`, 'SAND', 'ACTIVE', null);
                if (n % 4 === 2) line.run(`${id}-l2`, `${id}-r1`, 'SAND', 'ACTIVE', null);
                if (n % 4 === 3) revision.run(`${id}-r2`, id, 'ACTIVE');
            }
            if (n % 11 === 0) attempt.run(`${id}-a1`, `${id}-0`, `${id}-retained-line`, 'OPEN');
            if (n % 13 === 0) {
                attempt.run(`${id}-a2`, `${id}-1`, null, 'OPEN');
                attempt.run(`${id}-a3`, `${id}-1`, null, 'OPEN');
            }
        }
    })();
    return db;
}

function readImpact(fn, db) {
    let pointLookups = 0;
    let ownerSetQueries = 0;
    const before = db.prepare('SELECT total_changes() n').get().n;
    const began = performance.now();
    const report = fn({ prepare: sql => {
        expect(/^(SELECT|PRAGMA)\b/.test(sql)).toBe(true);
        if (sql === 'SELECT requiredAnalyses FROM Sample WHERE id=?') {
            const statement = db.prepare(sql);
            return { get: (...args) => { pointLookups++; return statement.get(...args); } };
        }
        if (sql.includes('s.id AS storedSampleId')) ownerSetQueries++;
        return db.prepare(sql);
    } });
    expect(db.prepare('SELECT total_changes() n').get().n).toBe(before);
    return { report: JSON.parse(JSON.stringify(report)), pointLookups, ownerSetQueries, elapsedMs: performance.now() - began };
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
    } finally { db.close(); }
});

test('missing sample keeps the legacy failure rather than silently dropping its fraction owners', () => {
    const db = fixture(1, { orphan: true });
    try {
        const outcomes = [legacyImpact, currentImpact].map(fn => {
            try { fn(db); return { unexpectedSuccess: true }; }
            catch (error) { return { name: error.name, message: error.message, code: error.code }; }
        });
        expect(outcomes[0].name).toBe('TypeError');
        expect(outcomes[1]).toEqual(outcomes[0]);
    } finally { db.close(); }
});

test('empty impact is unchanged and the join adds no fields to reported owner objects', () => {
    const db = fixture(0);
    try { expect(readImpact(currentImpact, db).report).toEqual(readImpact(legacyImpact, db).report); }
    finally { db.close(); }
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
    } finally { db.close(); }
});
