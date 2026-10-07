const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const DIRECTORY = '20261007000300_proficiency_evidence';
const SHA256 = 'bab161fb91e649a33454086aff12eca8ad0b56d16b9f5f47c278a7c20e4fc77a';

function loadProficiencyMigrationSource() {
    const root = path.resolve(__dirname, '..', fs.existsSync('/.dockerenv') ? '.migrations-backup/189' : 'prisma/migrations', DIRECTORY);
    let bytes;
    try { bytes = fs.readFileSync(path.join(root, 'migration.sql')); }
    catch (cause) { throw Object.assign(new Error('PT evidence release DDL is unavailable.', { cause }), { code: 'PT_SOURCE_MISMATCH' }); }
    if (createHash('sha256').update(bytes).digest('hex') !== SHA256) {
        throw Object.assign(new Error('PT evidence release digest differs.'), { code: 'PT_SOURCE_MISMATCH' });
    }
    const sql = bytes.toString('utf8');
    return Object.freeze({ sql, guardsSql: sql.slice(sql.indexOf('CREATE TRIGGER')), sha256: SHA256 });
}

module.exports = { loadProficiencyMigrationSource };
