const fs = require('node:fs'), path = require('node:path'), { createHash } = require('node:crypto');
const DIRECTORY = '20261004170000_add_atomic_sample_codes';
const SHA256 = 'e52a11bb7fc8dfee678184025dda8e8342cde3896d3b5f1c89b83897702d8ff0';
const mismatch = (message, cause) => Object.assign(new Error(message, cause && { cause }),
    { code: 'SAMPLE_CODE_SCHEMA_SOURCE_MISMATCH', statusCode: 409, totalChanges: 0 });
function loadSampleCodeMigrationSource() {
    const root = path.resolve(__dirname, '..', fs.existsSync('/.dockerenv') ? '.migrations-backup/180' : 'prisma/migrations', DIRECTORY);
    let bytes;
    try { bytes = fs.readFileSync(path.join(root, 'migration.sql')); }
    catch (cause) { throw mismatch('Approved sample-code DDL is unavailable.', cause); }
    if (createHash('sha256').update(bytes).digest('hex') !== SHA256) throw mismatch('Approved sample-code DDL differs.');
    return Object.freeze({ sql: bytes.toString('utf8'), sha256: SHA256 });
}
module.exports = { loadSampleCodeMigrationSource };
