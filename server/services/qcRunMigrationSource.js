const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const DIRECTORY = '20261006000400_normalized_qc_runs';
const SHA256 = '2f3d7a319d6cbb1fb061092d79e29e03358c28aba9e22190f221df71635e2046';
const ORACLE_SHA256 = '2991b84db149e9005a0dcd3995a63198f8668e532a68b8f7d14068aacd2b7369';
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
    const tables = ['QcMeasurement', 'BatchPositionReference'];
    const bootstrapDefinitions = tables.map(table => sql.match(new RegExp(`CREATE TABLE "${table}" \\([\\s\\S]*?\\n\\);`))?.[0]);
    const bootstrapIndexes = [...sql.slice(0, boundary).matchAll(/^CREATE INDEX "[^"]+" ON "(?:QcMeasurement|BatchPositionReference)"[\s\S]*?;/gm)].map(match => match[0]);
    if (bootstrapDefinitions.some(definition => !definition) || bootstrapIndexes.length !== 3) {
        throw Object.assign(new Error('Deferred QC bootstrap DDL is incomplete.'), { code: 'QC_RUN_SOURCE_MISMATCH' });
    }
    const bootstrapSql = ['DROP TABLE "QcMeasurement"; DROP TABLE "BatchPositionReference";', ...bootstrapDefinitions, ...bootstrapIndexes].join('\n');
    return Object.freeze({ sql, schemaSql: sql.slice(0, boundary), guardsSql: sql.slice(boundary), sha256: SHA256,
        bootstrapSql, oracleSha256: ORACLE_SHA256, freshTables: Object.freeze(freshTables) });
}
module.exports = { loadQcRunMigrationSource };
