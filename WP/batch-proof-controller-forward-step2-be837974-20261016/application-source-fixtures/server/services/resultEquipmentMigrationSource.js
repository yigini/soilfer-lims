const fs = require('node:fs'), path = require('node:path');
const { createHash } = require('node:crypto');
const DIRECTORY = '20261007000400_result_equipment_evidence';
const SHA256 = 'bd409a6e5d4d8aea357991450025601d73c4c4729cb46473d847c17cb66319d4';
function loadResultEquipmentMigrationSource() {
    const root = path.resolve(__dirname, '..', fs.existsSync('/.dockerenv') ? '.migrations-backup/189' : 'prisma/migrations', DIRECTORY);
    let bytes;
    try { bytes = fs.readFileSync(path.join(root, 'migration.sql')); }
    catch (cause) { throw Object.assign(new Error('Result equipment release DDL is unavailable.', { cause }), { code: 'RESULT_EQUIPMENT_SOURCE_MISMATCH' }); }
    if (createHash('sha256').update(bytes).digest('hex') !== SHA256) {
        throw Object.assign(new Error('Result equipment release digest differs.'), { code: 'RESULT_EQUIPMENT_SOURCE_MISMATCH' });
    }
    const sql = bytes.toString('utf8');
    const boundary = sql.indexOf('CREATE TRIGGER');
    return Object.freeze({ sql, schemaSql: sql.slice(0, boundary), guardsSql: sql.slice(boundary), sha256: SHA256 });
}
module.exports = { loadResultEquipmentMigrationSource };
