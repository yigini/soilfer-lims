const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const DIRECTORY = '20261007000100_qc_gate_scope';
const SHA256 = 'fac0023cc90f9d5703ec8d722be55727028c7d24398fbfd4a0aa1cd1bd4fe5bf';
const fail = message => Object.assign(new Error(message), { code: 'QC_GATE_SCOPE_SOURCE_MISMATCH' });
function loadScopeMigrationSource() {
    const root = fs.existsSync('/.dockerenv') ? '.migrations-backup/187' : 'prisma/migrations';
    const bytes = fs.readFileSync(path.resolve(__dirname, '..', root, DIRECTORY, 'migration.sql'));
    if (createHash('sha256').update(bytes).digest('hex') !== SHA256) throw fail('QC scope migration digest differs.');
    const sql = bytes.toString('utf8'), guards = [...sql.matchAll(/^CREATE TRIGGER "([^"]+)"[\s\S]*?^END;/gm)]
        .map(match => ({ name: match[1], sql: match[0] }));
    if (guards.length !== 2 || !sql.startsWith('ALTER TABLE "BatchDisposition" ADD COLUMN "scope" TEXT;')) throw fail('QC scope migration is incomplete.');
    return { sql, sha256: SHA256, guards, guardsSql: guards.map(row => row.sql).join('\n') };
}
module.exports = { loadScopeMigrationSource };
