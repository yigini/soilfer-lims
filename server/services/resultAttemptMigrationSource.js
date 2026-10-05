const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const DIRECTORY = '20261006000000_result_attempt_link';
const SHA256 = '332edb0ea6491b4c66dd581c34acbb5ba7db757cd48c5b502eac8f00a21d51f1';

function loadResultAttemptMigrationSource() {
    const root = path.resolve(__dirname, '..', fs.existsSync('/.dockerenv') ? '.migrations-backup/182' : 'prisma/migrations');
    const file = path.join(root, DIRECTORY, 'migration.sql');
    let bytes;
    try { bytes = fs.readFileSync(file); }
    catch (cause) { throw Object.assign(new Error('Result attempt release DDL is unavailable.', { cause }), { code: 'RESULT_ATTEMPT_SOURCE_MISMATCH' }); }
    if (createHash('sha256').update(bytes).digest('hex') !== SHA256) {
        throw Object.assign(new Error('Result attempt release DDL digest differs.'), { code: 'RESULT_ATTEMPT_SOURCE_MISMATCH' });
    }
    const sql = bytes.toString('utf8');
    return Object.freeze({ sql, guardsSql: sql.slice(sql.indexOf('CREATE TRIGGER')), sha256: SHA256 });
}

module.exports = { loadResultAttemptMigrationSource };
