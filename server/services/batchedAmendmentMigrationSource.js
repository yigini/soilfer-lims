const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const DIRECTORY = '20261111000200_batched_amendment_membership';
const SHA256 = 'ce73754e0808c9f2fa7bc6b651e3785f232041fd475b45fd987653e7523e9dd9';
function loadBatchedAmendmentMigrationSource() {
    const root = path.resolve(__dirname, '..',
        fs.existsSync('/.dockerenv') ? '.migrations-backup/413' : 'prisma/migrations', DIRECTORY);
    const sql = fs.readFileSync(path.join(root, 'migration.sql'), 'utf8');
    if (createHash('sha256').update(sql).digest('hex') !== SHA256) {
        throw Object.assign(new Error('Batched amendment migration digest differs.'),
            { code: 'BATCHED_AMENDMENT_SOURCE_MISMATCH' });
    }
    const guardSql = sql.match(/^CREATE TRIGGER "WorkItem_batch_membership_guard"[\s\S]*?^END;/m)?.[0];
    if (!guardSql) throw Object.assign(new Error('Batched amendment guard is missing.'),
        { code: 'BATCHED_AMENDMENT_SOURCE_MISMATCH' });
    return { sql, guardSql, sha256: SHA256 };
}
module.exports = { loadBatchedAmendmentMigrationSource };
