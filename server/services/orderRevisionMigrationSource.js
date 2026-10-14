const fs = require('node:fs'), path = require('node:path'), { createHash } = require('node:crypto');
const DIRECTORY = '20261014000100_order_revision_contract';
const SHA256 = '0628c5e037bef23bb0486f2b4c7b89c797ed34083e97e3d72405c45d7700402d';
const mismatch = message => Object.assign(new Error(message), { code: 'ORDER_REVISION_SOURCE_MISMATCH', statusCode: 409, totalChanges: 0 });
function loadOrderRevisionMigrationSource() {
    const directory = path.resolve(__dirname, '..', fs.existsSync('/.dockerenv') ? '.migrations-backup/209' : 'prisma/migrations', DIRECTORY);
    let bytes;
    try { bytes = fs.readFileSync(path.join(directory, 'migration.sql')); }
    catch { throw mismatch('The order revision DDL is unavailable.'); }
    if (createHash('sha256').update(bytes).digest('hex') !== SHA256) throw mismatch('The order revision DDL digest differs.');
    const sql = bytes.toString('utf8'), boundary = sql.indexOf('-- Contract guards');
    if (boundary < 0) throw mismatch('The order revision guard boundary differs.');
    return Object.freeze({ sql, schemaSql: sql.slice(0, boundary), guardsSql: sql.slice(boundary), sha256: SHA256 });
}
module.exports = { loadOrderRevisionMigrationSource };
