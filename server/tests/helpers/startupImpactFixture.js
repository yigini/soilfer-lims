const path = require('node:path');
const Database = require('better-sqlite3');

// A closed synthetic impact-query fixture. No caller-supplied database, path,
// SQL, connection or callback is accepted; all writes are to this new memory DB.
function createStartupImpactFixture(options) {
    const caller = path.relative(path.resolve(__dirname, '../..'), globalThis.expect?.getState?.().testPath || '').replace(/\\/g, '/');
    if (arguments.length !== 1 || process.env.NODE_ENV !== 'test' ||
        caller !== 'tests/contracts/order_revision_impact_set_query.test.js' ||
        !options || typeof options !== 'object' || Array.isArray(options) ||
        Object.keys(options).some(key => !['samples', 'orphan'].includes(key)) ||
        ![0, 1, 240, 12000].includes(options.samples) ||
        (Object.hasOwn(options, 'orphan') && typeof options.orphan !== 'boolean'))
        throw new Error('The closed startup impact fixture requires its exact test caller and declared synthetic cases.');
    require('../../services/workflowStateRules').assertFixtureContext();
    const { samples, orphan = false } = options;
    const statements = [];
    const db = new Database(':memory:', { verbose: sql => statements.push(sql) });
    try {
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
        db.pragma('query_only = ON');
        statements.length = 0;
        return { db, statements };
    } catch (error) { db.close(); throw error; }
}
module.exports = { createStartupImpactFixture };
