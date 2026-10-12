const fs = require('node:fs'), path = require('node:path');
const { createHash } = require('node:crypto');
const Database = require('better-sqlite3');

// Additional closed schema-only predecessor, main51f6798806f630773786a08432290c1b21a841da.
// Unmodified own Prisma7.10 migrate diff --from-empty --to-schema captured51f
// --script --config server/prisma.config.ts; bytes/provenance retained in
// WP/pr284-resume-20261012. Earlier89/92 model literals stay unchanged.
function createPre200After293SchemaFixture() {
    if (arguments.length || process.env.NODE_ENV !== 'test') throw Error('The pre-200 current-main schema factory accepts no arguments and is test-only.');
    const caller = path.relative(path.resolve(__dirname, '../..'), globalThis.expect?.getState?.().testPath || '').replace(/\\/g, '/');
    if (caller !== 'tests/contracts/audit_4_7_instrument_import_install.test.js') throw Error('The pre-200 current-main schema factory refuses an unlisted caller.');
    const bytes = fs.readFileSync(path.join(__dirname, 'fixtures/pre200_after293_full_application_schema.sql'));
    if (bytes.length !== 81090 || createHash('sha256').update(bytes).digest('hex') !== '9a720e1de82b42946c74a18f59458e4b6cc39e8cb814c28384a69f4efd207bc5') throw Error('The pre-200 current-main literal schema differs.');
    const db = new Database(':memory:');
    try { db.pragma('foreign_keys=ON'); db.exec(bytes.toString('utf8')); return db; } catch (error) { db.close(); throw error; }
}
module.exports = { createPre200After293SchemaFixture };
