const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const DIRECTORY = '20261006000200_reference_material_catalogue';
const SHA256 = '5da12ca98c6402002ab2701105eb9e2a51539d4421f53d70c60f47ab98bd51e3';
const ORACLE_SHA256 = '7a626b66bd31a7e7305d8c1b091207f3fb26348345a431fb77b63f875d3b99b5';

function loadReferenceMaterialMigrationSource() {
    const root = path.resolve(__dirname, '..', fs.existsSync('/.dockerenv') ? '.migrations-backup/184' : 'prisma/migrations', DIRECTORY);
    function read(name, digest) {
        let bytes;
        try { bytes = fs.readFileSync(path.join(root, name)); }
        catch (cause) { throw Object.assign(new Error('Reference material release DDL is unavailable.', { cause }), { code: 'REFERENCE_SOURCE_MISMATCH' }); }
        if (createHash('sha256').update(bytes).digest('hex') !== digest) throw Object.assign(new Error('Reference material release digest differs.'), { code: 'REFERENCE_SOURCE_MISMATCH' });
        return bytes.toString('utf8');
    }
    const sql = read('migration.sql', SHA256), freshTables = JSON.parse(read('fresh-prisma-tables.json', ORACLE_SHA256));
    return Object.freeze({ sql, guardsSql: sql.slice(sql.indexOf('CREATE UNIQUE INDEX')), sha256: SHA256,
        oracleSha256: ORACLE_SHA256, freshTables: Object.freeze(freshTables) });
}

module.exports = { loadReferenceMaterialMigrationSource };
