const fs = require('node:fs'), path = require('node:path');
const { createHash } = require('node:crypto');
const DIRECTORY = '20261009000100_reported_value_selection';
const SHA256 = '6508b8078dc667ba0306f4176cc552d809479b27c8271ed5d3c81eb26f8bbef7';
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
