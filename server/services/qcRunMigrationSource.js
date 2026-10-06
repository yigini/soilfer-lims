const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const DIRECTORY = '20261006000400_normalized_qc_runs';
const SHA256 = '24c081c8ca65b23cbb2da8ea519d28a2806c50a29073148219935c7a9a7809d5';
const ORACLE_SHA256 = '738b46a3ebd65d0ee204ed6f24bf92e9018b0ed3d40c28110194b49a24efde7f';
function loadQcRunMigrationSource() {
    const root = path.resolve(__dirname, '..', fs.existsSync('/.dockerenv') ? '.migrations-backup/186' : 'prisma/migrations', DIRECTORY);
    function read(name, digest) {
        let bytes;
        try { bytes = fs.readFileSync(path.join(root, name)); }
        catch (cause) { throw Object.assign(new Error('Normalized QC release DDL is unavailable.', { cause }), { code: 'QC_RUN_SOURCE_MISMATCH' }); }
        if (createHash('sha256').update(bytes).digest('hex') !== digest) throw Object.assign(new Error('Normalized QC release digest differs.'), { code: 'QC_RUN_SOURCE_MISMATCH' });
        return bytes.toString('utf8');
    }
    const sql = read('migration.sql', SHA256), freshTables = JSON.parse(read('fresh-prisma-tables.json', ORACLE_SHA256));
    const boundary = sql.indexOf('CREATE UNIQUE INDEX "BatchAnalyte_crm_ordinal_unique"');
    return Object.freeze({ sql, schemaSql: sql.slice(0, boundary), guardsSql: sql.slice(boundary), sha256: SHA256,
        oracleSha256: ORACLE_SHA256, freshTables: Object.freeze(freshTables) });
}
module.exports = { loadQcRunMigrationSource };
