const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const DIRECTORY = '20261016000100_sample_custody_retention';
const SHA256 = '6572f75c9663d0aaece1bd6139694fe1ad41142f2723404a811852f8eaede685';
function loadCustodyMigrationSource() {
    const root = path.resolve(__dirname, '..', fs.existsSync('/.dockerenv') ? '.migrations-backup/207' : 'prisma/migrations', DIRECTORY);
    const sql = fs.readFileSync(path.join(root, 'migration.sql'), 'utf8');
    if (createHash('sha256').update(sql).digest('hex') !== SHA256)
        throw Object.assign(new Error('Custody release DDL digest differs.'), { statusCode: 409, code: 'CUSTODY_SOURCE_MISMATCH' });
    const boundary = sql.indexOf('-- Contract guards');
    if (boundary < 0) throw new Error('Custody migration guard boundary is missing.');
    return { sql, schemaSql: sql.slice(0, boundary), guardsSql: sql.slice(boundary), sha256: SHA256 };
}
module.exports = { loadCustodyMigrationSource };
