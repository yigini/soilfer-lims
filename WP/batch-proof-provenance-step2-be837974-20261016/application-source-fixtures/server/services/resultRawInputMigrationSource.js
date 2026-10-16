const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const DIRECTORY = '20261004064500_add_result_raw_input';
const SHA256 = '850a47806543f1e6587641daa918fe586b6cbb4bfece5a6920132e4b74c593cc';

// #272 pin6087372517: exactly the committed LF bytes, including in Docker.
function loadResultRawInputMigrationSource() {
    const root = path.resolve(__dirname, '..', fs.existsSync('/.dockerenv') ? '.migrations-backup/272' : 'prisma/migrations');
    const file = path.join(root, DIRECTORY, 'migration.sql');
    let bytes;
    try { bytes = fs.readFileSync(file); }
    catch (cause) { throw Object.assign(new Error('Result raw input release DDL is unavailable.', { cause }), { code: 'RESULT_RAW_INPUT_SOURCE_MISMATCH' }); }
    if (createHash('sha256').update(bytes).digest('hex') !== SHA256) {
        throw Object.assign(new Error('Result raw input release DDL digest differs.'), { code: 'RESULT_RAW_INPUT_SOURCE_MISMATCH' });
    }
    return Object.freeze({ sql: bytes.toString('utf8'), sha256: SHA256 });
}

module.exports = { loadResultRawInputMigrationSource };
