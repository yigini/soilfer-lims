const fs = require('node:fs'), path = require('node:path'), { createHash } = require('node:crypto');
const DIRECTORY = '20261004085500_add_lab_policy_settings';
const SHA256 = 'fa6ef0563f80704dbc4ee08d90ceae91f632c912813ca037221b02aa03ef7b70';
function loadLabPolicyMigrationSource() {
    const root = path.resolve(__dirname, '..', fs.existsSync('/.dockerenv') ? '.migrations-backup/policy' : 'prisma/migrations', DIRECTORY);
    let bytes;
    try { bytes = fs.readFileSync(path.join(root, 'migration.sql')); }
    catch (cause) { throw Object.assign(new Error('Canonical policy DDL unavailable.', { cause }), { code: 'LAB_POLICY_SOURCE_MISMATCH', totalChanges: 0 }); }
    if (createHash('sha256').update(bytes).digest('hex') !== SHA256)
        throw Object.assign(new Error('Canonical policy DDL digest differs.'), { code: 'LAB_POLICY_SOURCE_MISMATCH', totalChanges: 0 });
    const sql = bytes.toString('utf8'), boundary = sql.indexOf('ALTER TABLE "Report" ADD COLUMN "policyVersion" INTEGER;');
    if (boundary < 0) throw Object.assign(new Error('Canonical policy DDL boundary differs.'), { code: 'LAB_POLICY_SOURCE_MISMATCH', totalChanges: 0 });
    return Object.freeze({ sql, schemaSql: sql.slice(0, boundary), guardsSql: sql.slice(boundary), sha256: SHA256 });
}
module.exports = { loadLabPolicyMigrationSource };
