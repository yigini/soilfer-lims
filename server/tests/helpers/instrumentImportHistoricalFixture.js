const fs = require('node:fs'), path = require('node:path');
const { createHash } = require('node:crypto');
const Database = require('better-sqlite3');

// Unmodified own-Prisma7.10 emission of schema at main4a49798c2fcba592ba54b44ed11f17522226bcd2.
// node server/node_modules/prisma/build/index.js migrate diff --from-empty --to-schema
// C:/Users/yigin/AppData/Local/Temp/qc200-pre-import-a3ee0400-aa5a-4054-9215-4c52d2e26621.prisma
// --script --config server/prisma.config.ts; cwd server. Schema SHA256
// 55d6bf4eb422798e0bf8b117814efff15c11a7c3e7ebcff2e72a3eedc3dd5d26; 89 models.
function createPre200ImportSchemaFixture() {
    if (arguments.length || process.env.NODE_ENV !== 'test') throw Error('The pre-200 schema factory accepts no arguments and is test-only.');
    const caller = path.relative(path.resolve(__dirname, '../..'), globalThis.expect?.getState?.().testPath || '').replace(/\\/g, '/');
    if (caller !== 'tests/contracts/audit_4_7_instrument_import_install.test.js') throw Error('The pre-200 schema factory refuses an unlisted caller.');
    const bytes = fs.readFileSync(path.join(__dirname, 'fixtures/pre200_full_application_schema.sql'));
    if (bytes.length !== 76218 || createHash('sha256').update(bytes).digest('hex') !== 'c49761af3bab4bc8b822bc94f4f2193c8f3f780b7da6c715fe5a8a424af70aee') throw Error('The pre-200 literal schema differs.');
    const db = new Database(':memory:');
    try { db.pragma('foreign_keys=ON'); db.exec(bytes.toString('utf8')); return db; } catch (error) { db.close(); throw error; }
}
module.exports = { createPre200ImportSchemaFixture };
