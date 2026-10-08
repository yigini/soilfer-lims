const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const DIRECTORY = '20261007000200_qc_bracket_membership';
const SHA256 = '1bc85113a3b6b7da327265bc7005eb4a1c97855943c599b1fe5ed8b126cf8572';
const NAME = 'WorkItem_batch_membership_guard';
const hash = sql => createHash('sha256').update(sql).digest('hex');
function loadBracketMembershipSource() {
    const root = fs.existsSync('/.dockerenv') ? '.migrations-backup/187' : 'prisma/migrations';
    const bytes = fs.readFileSync(path.resolve(__dirname, '..', root, DIRECTORY, 'migration.sql'));
    if (hash(bytes) !== SHA256) throw Object.assign(new Error('QC bracket membership migration digest differs.'), { code: 'QC_GATE_SCOPE_SOURCE_MISMATCH' });
    const sql = bytes.toString('utf8');
    const guardSql = sql.match(/^CREATE TRIGGER "WorkItem_batch_membership_guard"[\s\S]*?^END;/m)?.[0];
    const prior = require('./qcRunMigrationSource').loadQcRunMigrationSource();
    const supersededGuardSql = prior.sql.match(/^CREATE TRIGGER "WorkItem_batch_membership_guard"[\s\S]*?^END;/m)?.[0];
    if (!guardSql || !supersededGuardSql || sql !== `DROP TRIGGER "${NAME}";\n\n${guardSql}\n`) {
        throw Object.assign(new Error('QC bracket membership migration is incomplete.'), { code: 'QC_GATE_SCOPE_SOURCE_MISMATCH' });
    }
    return Object.freeze({ sql, name: NAME, sha256: SHA256, guardSql, supersededGuardSql,
        guardSha256: hash(guardSql), supersededGuardSha256: hash(supersededGuardSql) });
}
module.exports = { loadBracketMembershipSource };
