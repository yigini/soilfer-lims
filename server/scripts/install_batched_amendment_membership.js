#!/usr/bin/env node
const path = require('node:path');
const Database = require('better-sqlite3');
const { loadBatchedAmendmentMigrationSource } = require('../services/batchedAmendmentMigrationSource');
const { MARKER, GUARD, batchedAmendmentSources, assertBatchedAmendmentInstallationEvidence } =
    require('../services/batchedAmendmentInstallationEvidence');
const { normalize, fingerprint } =
    require('../services/workRepeatInstallationEvidence');
const { fingerprintRetainedTables, fingerprintRows } = require('../services/retainedRowsFingerprint');
const fail = (code, message) => Object.assign(new Error(message), { code, totalChanges: 0 });

function assertIntegrity(db) {
    if (db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length) {
        throw fail('BATCHED_AMENDMENT_INTEGRITY_REFUSED', 'An intact database is required.');
    }
}
function retainedEvidence(db) {
    return { rowsSha256: fingerprintRetainedTables(db, { excludeTables: ['_schema_migrations'] }),
        migrationsSha256: fingerprintRows(db.prepare('SELECT * FROM "_schema_migrations" WHERE id<>? ORDER BY id').iterate(MARKER)) };
}
function classify(db) {
    require('../services/closedQcRepeatInstallationEvidence').assertClosedQcRepeatInstallationEvidence(db);
    const source = loadBatchedAmendmentMigrationSource();
    const actual = db.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(GUARD);
    const marker = db.prepare('SELECT id FROM "_schema_migrations" WHERE id=?').get(MARKER);
    if (marker) return { classification: 'COMPLETE', receipt: assertBatchedAmendmentInstallationEvidence(db) };
    const prior = require('../services/closedQcRepeatMigrationSource').loadClosedQcRepeatMigrationSource();
    if (!actual || normalize(actual.sql) !== normalize(prior.guardSql)) {
        throw fail('BATCHED_AMENDMENT_SCHEMA_MISMATCH', 'The prior membership guard differs.');
    }
    return { classification: 'PRE_413', sources: batchedAmendmentSources(db), migrationSha256: source.sha256 };
}
function openReader(target, startupContext) {
    return startupContext
        ? require('../utils/startupReadinessContext').openReadonlyDatabase(Database, target,
            { readonly: true, fileMustExist: true }, startupContext)
        : new Database(target, { readonly: true, fileMustExist: true });
}
function installBatchedAmendmentMembership({ dbPath, apply = false, startupContext } = {}) {
    if (typeof dbPath !== 'string' || !dbPath.trim()) {
        throw fail('BATCHED_AMENDMENT_DATABASE_REQUIRED', 'An explicit database path is required.');
    }
    const target = path.resolve(dbPath);
    const prior = require('./install_closed_qc_repeat_membership').installClosedQcRepeatMembership({
        dbPath: target, startupContext: apply ? undefined : startupContext });
    if (prior.classification !== 'COMPLETE') throw fail('BATCHED_AMENDMENT_PRIOR_REQUIRED', 'Install the prior repeat contract first.');
    const authorization = require('./install_sample_amendment_authorisation').installSampleAmendmentAuthorisation({
        dbPath: target, startupContext: apply ? undefined : startupContext });
    if (authorization.classification !== 'COMPLETE_210') throw fail('BATCHED_AMENDMENT_PRIOR_REQUIRED', 'Install amendment authorization first.');
    const reader = openReader(target, apply ? undefined : startupContext);
    let plan, evidence;
    try {
        reader.transaction(() => { assertIntegrity(reader); plan = classify(reader); if (plan.classification !== 'COMPLETE') evidence = retainedEvidence(reader); })();
    } finally { reader.close(); }
    const summary = { ...plan, ...evidence, totalChanges: 0 };
    if (plan.classification === 'COMPLETE' || !apply) {
        return { ...summary, mode: apply ? 'NO_OP' : 'DRY_RUN' };
    }
    const source = loadBatchedAmendmentMigrationSource();
    const db = new Database(target, { fileMustExist: true, timeout: 5000 });
    try {
        db.pragma('foreign_keys=ON');
        return db.transaction(() => {
            assertIntegrity(db);
            const current = classify(db);
            if (current.classification === 'COMPLETE') return { ...current, mode: 'NO_OP', totalChanges: 0 };
            if (fingerprint(retainedEvidence(db)) !== fingerprint(evidence)) {
                throw fail('BATCHED_AMENDMENT_PLAN_STALE', 'Retained evidence changed after planning.');
            }
            db.exec(source.sql);
            if (fingerprint(retainedEvidence(db)) !== fingerprint(evidence)) {
                throw fail('BATCHED_AMENDMENT_PRESERVATION_REFUSED', 'Installation changed retained evidence.');
            }
            const receipt = { sources: current.sources, ...evidence, retainedRowsPreserved: true };
            receipt.receiptSha256 = fingerprint(receipt);
            db.prepare('INSERT INTO "_schema_migrations"(id,details) VALUES (?,?)').run(MARKER, JSON.stringify(receipt));
            const after = classify(db);
            assertIntegrity(db);
            return { ...after, mode: 'APPLIED', totalChanges: 1 };
        }).immediate();
    } finally { db.close(); }
}
function assertBatchedAmendmentStartupReady(dbPath, startupContext) {
    const db = openReader(path.resolve(dbPath), startupContext);
    let result;
    try { result = { ...classify(db), totalChanges: 0 }; } finally { db.close(); }
    if (result.classification !== 'COMPLETE') throw fail('BATCHED_AMENDMENT_NOT_INSTALLED', 'Install the reviewed batched amendment contract before startup.');
    return result;
}
function parseArguments(args) {
    const options = { apply: false }, seen = new Set();
    for (let index = 0; index < args.length; index++) {
        const arg = args[index];
        if (seen.has(arg)) throw fail('BATCHED_AMENDMENT_ARGUMENT_INVALID', 'Repeated argument.');
        seen.add(arg);
        if (arg === '--apply') options.apply = true;
        else if (arg === '--dry-run') continue;
        else if (arg === '--db' && args[index + 1] && !args[index + 1].startsWith('--')) options.dbPath = args[++index];
        else throw fail('BATCHED_AMENDMENT_ARGUMENT_INVALID', 'Use --db <path> [--dry-run|--apply].');
    }
    if (!options.dbPath || seen.has('--apply') && seen.has('--dry-run')) {
        throw fail('BATCHED_AMENDMENT_ARGUMENT_INVALID', 'Provide --db and one execution mode.');
    }
    return options;
}
if (require.main === module) {
    try { process.stdout.write(JSON.stringify(installBatchedAmendmentMembership(parseArguments(process.argv.slice(2))), null, 2) + '\n'); }
    catch (error) {
        process.stderr.write(JSON.stringify({ code: error.code, message: error.message, totalChanges: 0 }) + '\n');
        process.exitCode = 1;
    }
}
module.exports = { installBatchedAmendmentMembership, assertBatchedAmendmentStartupReady, parseArguments };
