const fs = require('node:fs'), path = require('node:path');
const { createHash } = require('node:crypto');
const DIRECTORY = '20261008000200_repeat_correction_contract';
const SHA256 = '09fd801c9ad5e28ba0d05a099270846adfe311e1a0c6c00ca3aed121c1f0c4d3';
function loadWorkRepeatMigrationSource() {
    const root = path.resolve(__dirname, '..', fs.existsSync('/.dockerenv') ? '.migrations-backup/191' : 'prisma/migrations', DIRECTORY);
    let bytes;
    try { bytes = fs.readFileSync(path.join(root, 'migration.sql')); }
    catch (cause) { throw Object.assign(new Error('Repeat release DDL is unavailable.', { cause }), { code: 'WORK_REPEAT_SOURCE_MISMATCH' }); }
    if (createHash('sha256').update(bytes).digest('hex') !== SHA256) {
        throw Object.assign(new Error('Repeat release digest differs.'), { code: 'WORK_REPEAT_SOURCE_MISMATCH' });
    }
    const sql = bytes.toString('utf8'), marker = '-- INSTALLER_GUARDS_AFTER_SCHEMA', boundary = sql.indexOf(marker);
    if (boundary < 0 || sql.indexOf(marker, boundary + 1) !== -1) {
        throw Object.assign(new Error('Repeat installer boundary differs.'), { code: 'WORK_REPEAT_SOURCE_MISMATCH' });
    }
    return Object.freeze({ sql, schemaSql: sql.slice(0, boundary), guardsSql: sql.slice(boundary), sha256: SHA256 });
}
module.exports = { loadWorkRepeatMigrationSource };
