const fs = require('node:fs'), path = require('node:path');
const { createHash } = require('node:crypto');
const Database = require('better-sqlite3');

// Additional current-main predecessor under working agreement6089928620.
// Main e0462c85ef67a94297ffcd93f2b29b27141f2c27 has92 models after#210.
// Schema SHA256 a8e2aa335963e709dfc9047166ca775bae948ddaebaf10cb0e07d5cdeb482b33.
// Own Prisma7.10 migrate diff --from-empty --to-schema <captured-schema>
// --script --config <owned-checkout>/server/prisma.config.ts; untouched stdout.
// Exact command/digests: fixtures/pre200_after210_full_application_schema.provenance.json.
// The earlier89-model literal/factory/binding remain unchanged. No row writes.
function createPre200After210SchemaFixture() {
    if (arguments.length || process.env.NODE_ENV !== 'test') throw Error('The pre-200 current-main schema factory accepts no arguments and is test-only.');
    const caller = path.relative(path.resolve(__dirname, '../..'), globalThis.expect?.getState?.().testPath || '').replace(/\\/g, '/');
    if (caller !== 'tests/contracts/audit_4_7_instrument_import_install.test.js') throw Error('The pre-200 current-main schema factory refuses an unlisted caller.');
    const bytes = fs.readFileSync(path.join(__dirname, 'fixtures/pre200_after210_full_application_schema.sql'));
    if (bytes.length !== 79066 || createHash('sha256').update(bytes).digest('hex') !== 'd54b007ef4182ed1a08b340228a52b799308349a5cb632a05f7374cb8d5ebfb6') throw Error('The pre-200 current-main literal schema differs.');
    const db = new Database(':memory:');
    try { db.pragma('foreign_keys=ON'); db.exec(bytes.toString('utf8')); return db; } catch (error) { db.close(); throw error; }
}
module.exports = { createPre200After210SchemaFixture };
