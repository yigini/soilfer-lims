const fs = require('node:fs'), path = require('node:path'), { createHash } = require('node:crypto');
const DIRECTORY = '20261010000100_cross_check_evaluation';
const SHA256 = '7579e84f62aa8561b4746a6360e83757d067046ad97fcadace05660fb6bf44a4';
const ORACLE_SHA256 = '97cc1f211adb71056ed3c2d82ea94385d63f812071ba44a57674be24c4905de0';
const fail = () => Object.assign(new Error('Cross-check evidence source differs from the release.'), { statusCode: 409, code: 'CROSS_CHECK_SOURCE_MISMATCH' });
function loadCrossCheckMigrationSource() {
    const root = path.resolve(__dirname, '..', fs.existsSync('/.dockerenv') ? '.migrations-backup/201' : 'prisma/migrations', DIRECTORY);
    let bytes, oracle;
    try { bytes = fs.readFileSync(path.join(root, 'migration.sql')); oracle = fs.readFileSync(path.join(root, 'fresh-prisma-tables.json')); }
    catch { throw fail(); }
    const hash = value => createHash('sha256').update(value).digest('hex');
    if (hash(bytes) !== SHA256 || hash(oracle) !== ORACLE_SHA256) throw fail();
    const sql = bytes.toString('utf8'), marker = '-- Contract guards', boundary = sql.indexOf(marker);
    if (boundary < 0 || sql.indexOf(marker, boundary + 1) !== -1) throw fail();
    const fresh = JSON.parse(oracle.toString('utf8'));
    if (Object.keys(fresh).length !== 1 || fresh.CrossCheckEvaluation !== sql.match(/CREATE TABLE "CrossCheckEvaluation" \([\s\S]*?\n\);/)?.[0]) throw fail();
    return Object.freeze({ sql, schemaSql: sql.slice(0, boundary), guardsSql: sql.slice(boundary), sha256: SHA256, oracleSha256: ORACLE_SHA256 });
}
module.exports = { loadCrossCheckMigrationSource };
