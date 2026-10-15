const fs = require('node:fs'), path = require('node:path');
const { createHash } = require('node:crypto');
const { LEGACY_IMPORT_EXEMPT_SQL, REPEAT_REASON_LIST } = require('./workAttemptContract');
const {NON_MEASUREMENT_CODES}=require('./workItemKinds');
const DIRECTORY = '20261008000100_work_attempt_contract';
const SHA256 = '7e7d5679c9aeeea45ac3c2bac09e4db31dd15b52fe37c743080aa0e3473c8fe2';
function loadWorkAttemptMigrationSource() {
    const root = path.resolve(__dirname, '..', fs.existsSync('/.dockerenv') ? '.migrations-backup/190' : 'prisma/migrations', DIRECTORY);
    let bytes;
    try { bytes = fs.readFileSync(path.join(root, 'migration.sql')); }
    catch (cause) { throw Object.assign(new Error('WorkAttempt release DDL is unavailable.', { cause }), { code: 'WORK_ATTEMPT_SOURCE_MISMATCH' }); }
    if (createHash('sha256').update(bytes).digest('hex') !== SHA256) {
        throw Object.assign(new Error('WorkAttempt release digest differs.'), { code: 'WORK_ATTEMPT_SOURCE_MISMATCH' });
    }
    const sql = bytes.toString('utf8'), marker = '-- INSTALLER_GUARDS_AFTER_BACKFILL';
    if (!sql.includes(LEGACY_IMPORT_EXEMPT_SQL) || !sql.includes(REPEAT_REASON_LIST.map(reason=>`'${reason}'`).join(',')) ||
        !sql.includes(NON_MEASUREMENT_CODES.map(code=>`'${code}'`).join(','))) {
        throw Object.assign(new Error('WorkAttempt SQL differs from the shared execution contract.'), {code:'WORK_ATTEMPT_SOURCE_MISMATCH'});
    }
    const boundary = sql.indexOf(marker);
    if (boundary < 0 || sql.indexOf(marker, boundary + 1) !== -1) {
        throw Object.assign(new Error('WorkAttempt installer boundary differs.'), { code: 'WORK_ATTEMPT_SOURCE_MISMATCH' });
    }
    return Object.freeze({ sql, schemaSql: sql.slice(0, boundary), guardsSql: sql.slice(boundary), sha256: SHA256 });
}
module.exports = { loadWorkAttemptMigrationSource };
