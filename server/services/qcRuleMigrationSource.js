const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const DIRECTORY = '20261006000300_qc_rules';
const SHA256 = '4ee7f414ae3e6228faf52fe81d32bde2bdaf6ecb975ca62a438494db42e58b06';
const ORACLE_SHA256 = 'fe0dbc7dbb0a35bc62353de715a48b4263d492917225c7be5b6f969ec3f52819';
function loadQcRuleMigrationSource() {
    const root = path.resolve(__dirname, '..', fs.existsSync('/.dockerenv') ? '.migrations-backup/185' : 'prisma/migrations', DIRECTORY);
    function read(name, digest) {
        let bytes;
        try { bytes = fs.readFileSync(path.join(root, name)); }
        catch (cause) { throw Object.assign(new Error('QC rule release DDL is unavailable.', { cause }), { code: 'QC_RULE_SOURCE_MISMATCH' }); }
        if (createHash('sha256').update(bytes).digest('hex') !== digest) throw Object.assign(new Error('QC rule release digest differs.'), { code: 'QC_RULE_SOURCE_MISMATCH' });
        return bytes.toString('utf8');
    }
    const sql = read('migration.sql', SHA256), freshTables = JSON.parse(read('fresh-prisma-tables.json', ORACLE_SHA256));
    return Object.freeze({ sql, guardsSql: sql.slice(sql.indexOf('CREATE UNIQUE INDEX')), sha256: SHA256,
        oracleSha256: ORACLE_SHA256, freshTables: Object.freeze(freshTables) });
}
module.exports = { loadQcRuleMigrationSource };
