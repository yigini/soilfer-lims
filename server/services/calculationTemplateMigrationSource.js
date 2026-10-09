const fs = require('node:fs'), path = require('node:path');
const { createHash } = require('node:crypto');
const { referenceRows } = require('./calculationReferenceLibrary');
const DIRECTORY = '20261009000400_calculation_templates';
const SHA256 = '33bfe5084a82b9998ba74703c3fdc36d470189ed082620cebcf518405549408d';
const ORACLE_SHA256 = '684eb3e000930bd52a0c3628f020198bc315c7ace8cb284da91430167007f07d';
const REFERENCE_SHA256 = 'c8a9d21fbbac293807d41c66034b14be3773977fd47e1ee8975f9f6a1a226140';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const mismatch = cause => Object.assign(new Error('Calculation release evidence differs from the reviewed source.', { cause }),
    { statusCode: 409, code: 'CALC_SOURCE_MISMATCH' });
function loadCalculationTemplateMigrationSource() {
    const root = path.resolve(__dirname, '..', fs.existsSync('/.dockerenv') ? '.migrations-backup/199' : 'prisma/migrations', DIRECTORY);
    const read = (name, hash) => {
        let bytes;
        try { bytes = fs.readFileSync(path.join(root, name)); } catch (cause) { throw mismatch(cause); }
        if (digest(bytes) !== hash) throw mismatch();
        return bytes.toString('utf8');
    };
    const sql = read('migration.sql', SHA256), freshTables = JSON.parse(read('fresh-prisma-tables.json', ORACLE_SHA256));
    const boundary = sql.indexOf('-- Contract guards');
    if (boundary < 0 || Object.keys(freshTables).length !== 5 || digest(JSON.stringify(referenceRows())) !== REFERENCE_SHA256) throw mismatch();
    return Object.freeze({ sql, schemaSql: sql.slice(0, boundary), guardsSql: sql.slice(boundary),
        sha256: SHA256, oracleSha256: ORACLE_SHA256, referenceSha256: REFERENCE_SHA256, freshTables: Object.freeze(freshTables) });
}
module.exports = { loadCalculationTemplateMigrationSource };
