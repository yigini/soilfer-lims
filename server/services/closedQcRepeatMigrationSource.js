const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const DIRECTORY = '20261111000100_closed_qc_repeat_membership';
const SHA256 = '6b8dd68f7d7853f9e1a9ec581c2c029e649529b5d24858491df89804c0bf3724';
function loadClosedQcRepeatMigrationSource() {
    const root = path.resolve(__dirname, '..',
        fs.existsSync('/.dockerenv') ? '.migrations-backup/412' : 'prisma/migrations', DIRECTORY);
    const sql = fs.readFileSync(path.join(root, 'migration.sql'), 'utf8');
    if (createHash('sha256').update(sql).digest('hex') !== SHA256) {
        throw Object.assign(new Error('Closed-run repeat migration digest differs.'),
            { code: 'CLOSED_QC_REPEAT_SOURCE_MISMATCH' });
    }
    const guardSql = sql.match(/^CREATE TRIGGER "WorkItem_batch_membership_guard"[\s\S]*?^END;/m)?.[0];
    if (!guardSql) throw Object.assign(new Error('Closed-run repeat guard is missing.'),
        { code: 'CLOSED_QC_REPEAT_SOURCE_MISMATCH' });
    return { sql, guardSql, sha256: SHA256 };
}
module.exports = { loadClosedQcRepeatMigrationSource };
