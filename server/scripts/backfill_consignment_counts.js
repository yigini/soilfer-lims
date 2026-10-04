const Database = require('better-sqlite3');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const updateSql = fs.readFileSync(path.join(__dirname, 'sql/backfill_declared_consignment_counts.sql'), 'utf8');
const hasDeclared = db => db.prepare('PRAGMA table_info("Consignment")').all().some(column => column.name === 'declaredExpectedCount');
class BackfillError extends Error {
    constructor(code, message) { super(message); this.code = code; }
}
const fail = (code, message) => { throw new BackfillError(code, message); };
function fingerprint(rows) {
    const hash = crypto.createHash('sha256');
    for (const row of rows) hash.update(JSON.stringify([row.id, row.code, row.expectedCount]) + '\n');
    return hash.digest('hex');
}
function planLegacyRows(db) {
    if (hasDeclared(db)) fail('CONSIGNMENT_LEGACY_PLAN_REQUIRED', 'Create the legacy plan before adding declaredExpectedCount; after migration use that saved plan.');
    const rows = db.prepare('SELECT id, code, expectedCount FROM Consignment ORDER BY id').all();
    if (rows.some(row => !Number.isSafeInteger(row.expectedCount))) fail('CONSIGNMENT_LEGACY_COUNT_INVALID', 'A legacy count is not a safe integer; preserve it and request review.');
    const copiedCount = rows.filter(row => row.expectedCount >= 1).length;
    return { version: 1, mode: 'dry-run', sourceHadDeclaredColumn: false, rowCount: rows.length,
        copiedCount, nullCount: rows.length - copiedCount, fingerprint: fingerprint(rows), rows };
}
function inspectPlan(db, plan) {
    if (plan?.version !== 1 || plan.sourceHadDeclaredColumn !== false || !Array.isArray(plan.rows) || plan.rowCount !== plan.rows.length || fingerprint(plan.rows) !== plan.fingerprint || new Set(plan.rows.map(row => row.id)).size !== plan.rows.length) fail('CONSIGNMENT_BACKFILL_PLAN_INVALID', 'Use the original saved legacy dry-run plan.');
    const marker = hasDeclared(db), read = db.prepare(`SELECT id, code, expectedCount${marker ? ', declaredExpectedCount' : ''} FROM Consignment WHERE id = ?`);
    const current = [], candidates = []; let copiedCount = 0;
    for (const old of plan.rows) {
        if (!Number.isSafeInteger(old.expectedCount)) fail('CONSIGNMENT_BACKFILL_PLAN_INVALID', 'The plan contains an invalid legacy count.');
        const row = read.get(old.id);
        if (!row || row.code !== old.code || row.expectedCount !== old.expectedCount) fail('CONSIGNMENT_BACKFILL_SOURCE_CHANGED', 'A planned legacy consignment changed; no back-fill is permitted.');
        current.push(row);
        const expected = old.expectedCount >= 1 ? old.expectedCount : null;
        if (expected != null) copiedCount++;
        if (marker && row.declaredExpectedCount != null && row.declaredExpectedCount !== expected) fail('CONSIGNMENT_DECLARATION_CHANGED', 'An existing declaration differs; never overwrite it.');
        if (expected != null && (!marker || row.declaredExpectedCount == null)) candidates.push({ id: old.id, value: expected });
    }
    if (fingerprint(current) !== plan.fingerprint) fail('CONSIGNMENT_BACKFILL_SOURCE_CHANGED', 'The legacy tuple fingerprint changed.');
    if (plan.copiedCount !== copiedCount || plan.nullCount !== plan.rowCount - copiedCount) fail('CONSIGNMENT_BACKFILL_PLAN_INVALID', 'The saved plan counts are inconsistent.');
    return { mode: 'dry-run', rowCount: plan.rowCount, copiedCount, nullCount: plan.rowCount - copiedCount,
        candidateCount: candidates.length, fingerprint: plan.fingerprint, candidates };
}
function applyPlan(db, plan, { inTransaction = false } = {}) {
    if (!hasDeclared(db)) fail('CONSIGNMENT_DECLARED_SCHEMA_REQUIRED', 'Apply the additive declared count migration first.');
    const execute = () => {
        const before = inspectPlan(db, plan), update = db.prepare(updateSql);
        for (const candidate of before.candidates) if (update.run(candidate.value, candidate.id, candidate.value).changes !== 1) fail('CONSIGNMENT_BACKFILL_SOURCE_CHANGED', 'A legacy row changed; roll back the whole release.');
        const after = inspectPlan(db, plan);
        if (after.candidateCount !== 0 || after.fingerprint !== before.fingerprint) fail('CONSIGNMENT_BACKFILL_VERIFY_FAILED', 'The back-fill did not preserve the historical tuples.');
        return { mode: 'apply', rowCount: before.rowCount, copiedCount: before.copiedCount, nullCount: before.nullCount,
            changedCount: before.candidateCount, remainingCount: after.candidateCount, beforeFingerprint: before.fingerprint, afterFingerprint: after.fingerprint };
    };
    if (inTransaction) {
        if (!db.inTransaction) fail('CONSIGNMENT_BACKFILL_TRANSACTION_REQUIRED', 'Release back-fill requires the active migration transaction.');
        return execute();
    }
    return db.transaction(execute).immediate();
}
function argumentsFor(argv) {
    const args = {};
    for (let index = 0; index < argv.length; index++) {
        const key = argv[index];
        if (Object.hasOwn(args, key)) fail('CONSIGNMENT_BACKFILL_ARGUMENTS_INVALID', 'Repeated argument.');
        if (key === '--database' || key === '--plan') {
            if (!argv[index + 1] || argv[index + 1].startsWith('--')) fail('CONSIGNMENT_BACKFILL_ARGUMENTS_INVALID', 'Argument value required.');
            args[key] = argv[++index];
        } else if (key === '--apply' || key === '--dry-run') args[key] = true;
        else fail('CONSIGNMENT_BACKFILL_ARGUMENTS_INVALID', 'Unknown argument.');
    }
    if (!args['--database'] || args['--apply'] && (args['--dry-run'] || !args['--plan'])) fail('CONSIGNMENT_BACKFILL_ARGUMENTS_INVALID', 'Use --database <existing file> [--dry-run] [--plan <saved legacy plan>] or --apply --plan <saved legacy plan>.');
    return args;
}
if (require.main === module) {
    let db;
    try {
        const args = argumentsFor(process.argv.slice(2));
        db = new Database(path.resolve(args['--database']), { readonly: !args['--apply'], fileMustExist: true });
        const plan = args['--plan'] ? JSON.parse(fs.readFileSync(path.resolve(args['--plan']), 'utf8')) : planLegacyRows(db);
        console.log(JSON.stringify(args['--apply'] ? applyPlan(db, plan) : args['--plan'] ? inspectPlan(db, plan) : plan, null, 2));
    } catch (error) { console.error(JSON.stringify({ code: error.code || 'CONSIGNMENT_BACKFILL_FAILED', message: error.message })); process.exitCode = 1; }
    finally { db?.close(); }
}
module.exports = { planLegacyRows, inspectPlan, applyPlan, argumentsFor, fingerprint, BackfillError };
