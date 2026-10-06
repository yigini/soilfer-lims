const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const DIRECTORY = '20261006000100_sample_holds_cancellation';
const SHA256 = 'e6221516725c3c66001fb15b09db9f81553285486552b0c0b3f810b9b6572227';

function loadSampleHoldMigrationSource() {
    const root = path.resolve(__dirname, '..', fs.existsSync('/.dockerenv') ? '.migrations-backup/183' : 'prisma/migrations');
    let bytes;
    try { bytes = fs.readFileSync(path.join(root, DIRECTORY, 'migration.sql')); }
    catch (cause) { throw Object.assign(new Error('Sample hold release DDL is unavailable.', { cause }), { code: 'SAMPLE_HOLD_SOURCE_MISMATCH' }); }
    if (createHash('sha256').update(bytes).digest('hex') !== SHA256) {
        throw Object.assign(new Error('Sample hold release DDL digest differs.'), { code: 'SAMPLE_HOLD_SOURCE_MISMATCH' });
    }
    const sql = bytes.toString('utf8');
    return Object.freeze({ sql, guardsSql: sql.slice(sql.indexOf('CREATE TRIGGER')),
        indexSql: sql.slice(sql.indexOf('CREATE UNIQUE INDEX'), sql.indexOf('-- Fresh Prisma')), sha256: SHA256 });
}

module.exports = { loadSampleHoldMigrationSource };
