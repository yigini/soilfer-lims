const fs = require('node:fs'), path = require('node:path');
const { createHash } = require('node:crypto');
const DIRECTORY = '20261009000100_reported_value_selection';
const SHA256 = 'f508ba8db3338b4f370ac94b002e193a8e817ea122cddd7c2a20176894dc110a';
function loadReportedValueMigrationSource() {
    const root = path.resolve(__dirname, '..', fs.existsSync('/.dockerenv') ? '.migrations-backup/192' : 'prisma/migrations', DIRECTORY);
    const bytes = fs.readFileSync(path.join(root, 'migration.sql'));
    if (createHash('sha256').update(bytes).digest('hex') !== SHA256) {
        throw Object.assign(new Error('Reported-value release digest differs.'), { code: 'REPORTED_VALUE_SOURCE_MISMATCH' });
    }
    const sql = bytes.toString('utf8'), marker = '-- INSTALLER_GUARDS_AFTER_SCHEMA', boundary = sql.indexOf(marker);
    if (boundary < 0 || sql.indexOf(marker, boundary + 1) !== -1) throw Object.assign(new Error('Reported-value installer boundary differs.'), { code: 'REPORTED_VALUE_SOURCE_MISMATCH' });
    return { sql, schemaSql: sql.slice(0, boundary), guardsSql: sql.slice(boundary), sha256: SHA256 };
}
module.exports = { loadReportedValueMigrationSource };
