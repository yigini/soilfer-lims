const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const DIRECTORY = '20261009000200_batch_reagent_lots';
const SHA256 = '6e409e753d9142381a668352be82ca4981e41847914f868cdacc32b7729cb580';
function loadBatchReagentLotMigrationSource() {
    const root = path.resolve(__dirname, '..', fs.existsSync('/.dockerenv') ? '.migrations-backup/194' : 'prisma/migrations', DIRECTORY);
    let bytes;
    try { bytes = fs.readFileSync(path.join(root, 'migration.sql')); }
    catch (cause) { throw Object.assign(new Error('Run reagent-link release DDL is unavailable.', { cause }), { code: 'REAGENT_LOT_SOURCE_MISMATCH' }); }
    if (createHash('sha256').update(bytes).digest('hex') !== SHA256) {
        throw Object.assign(new Error('Run reagent-link release digest differs.'), { code: 'REAGENT_LOT_SOURCE_MISMATCH' });
    }
    const sql = bytes.toString('utf8'), boundary = sql.indexOf('CREATE TRIGGER');
    return Object.freeze({ sql, schemaSql: sql.slice(0, boundary), guardsSql: sql.slice(boundary), sha256: SHA256 });
}
module.exports = { loadBatchReagentLotMigrationSource };
