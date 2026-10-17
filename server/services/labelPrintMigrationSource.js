const fs = require('node:fs'), path = require('node:path'), { createHash } = require('node:crypto');
const DIRECTORY = '20261016000100_label_print_events';
const SHA256 = 'c7e0cb8c76c5dc08881392e2d2a1e17bc2fed56f6be8e3e779b7099a99054d28';
const mismatch = (message, cause) => Object.assign(new Error(message, cause && { cause }), { code: 'LABEL_PRINT_SOURCE_MISMATCH', statusCode: 409 });
function loadLabelPrintMigrationSource() {
    const root = path.resolve(__dirname, '..', fs.existsSync('/.dockerenv') ? '.migrations-backup/208' : 'prisma/migrations', DIRECTORY);
    let bytes;
    try { bytes = fs.readFileSync(path.join(root, 'migration.sql')); }
    catch (cause) { throw mismatch('Label print DDL is unavailable.', cause); }
    if (createHash('sha256').update(bytes).digest('hex') !== SHA256) throw mismatch('Label print DDL differs.');
    const sql = bytes.toString('utf8'), boundary = sql.indexOf('-- Contract guards');
    if (boundary < 0) throw mismatch('Label print guard boundary differs.');
    return Object.freeze({ sql, schemaSql: sql.slice(0, boundary), guardsSql: sql.slice(boundary), sha256: SHA256 });
}
module.exports = { loadLabelPrintMigrationSource };
