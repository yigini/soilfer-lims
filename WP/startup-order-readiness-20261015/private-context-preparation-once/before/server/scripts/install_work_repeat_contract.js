#!/usr/bin/env node
const path = require('node:path'), Database = require('better-sqlite3');
const { loadWorkRepeatMigrationSource } = require('../services/workRepeatMigrationSource');
const { loadWorkAttemptMigrationSource } = require('../services/workAttemptMigrationSource');
const { classifyWorkAttemptContract } = require('./install_work_attempt_contract');
const { MARKER, SUCCESSORS, MEMBERSHIP_SUCCESSOR, repeatReleaseObjects, repeatSources, inspectRepeatColumns,
    assertRepeatInstallationEvidence, normalize, fingerprint } = require('../services/workRepeatInstallationEvidence');
const { planInterimRepeatReasons, inventorySubmittedRecordedOwners } = require('../services/workRepeatBackfillPlan');
const { fingerprintRetainedTables } = require('../services/retainedRowsFingerprint');
const fail = (code, message, details = {}) => Object.assign(new Error(message), { code, totalChanges: 0, ...details });
function classify(db) {
    const qc=require('../services/qcRunSchemaService').classifyQcRunSchema(db,require('../services/qcRunMigrationSource').loadQcRunMigrationSource());
    const scope=require('../services/qcDispositionScopeSchemaService').inspectScopeExtension(db);
    if(qc.classification!=='COMPLETE' || scope.classification!=='COMPLETE')throw fail('WORK_REPEAT_PREREQUISITE_NOT_INSTALLED',
        'Install the complete reviewed #186/#187 QC predecessors first.');
    const predecessorSource = loadWorkAttemptMigrationSource();
    const predecessor = classifyWorkAttemptContract(db, { guardsSql: predecessorSource.guardsSql, sha256: predecessorSource.sha256 });
    if (predecessor.classification !== 'COMPLETE' || predecessor.code) throw fail('WORK_REPEAT_PREREQUISITE_NOT_INSTALLED', 'Install the complete reviewed #190 predecessor first.');
    const { added, differences } = inspectRepeatColumns(db);
    const originals = [...predecessorSource.guardsSql.matchAll(/^CREATE TRIGGER "([^"]+)"[\s\S]*?^END;/gm)]
        .filter(match => SUCCESSORS.includes(match[1]));
    const membership=require('../services/qcBracketMembershipMigrationSource').loadBracketMembershipSource();
    const predecessorGuards = originals.every(match => normalize(db.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(match[1])?.sql || '') === normalize(match[0])) &&
        normalize(db.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(MEMBERSHIP_SUCCESSOR)?.sql || '')===normalize(membership.guardSql);
    const newGuards = repeatReleaseObjects().filter(row => !SUCCESSORS.includes(row.name) && row.name!==MEMBERSHIP_SUCCESSOR)
        .map(row => Boolean(db.prepare('SELECT name FROM sqlite_master WHERE name=?').get(row.name)));
    const marker = Boolean(db.prepare('SELECT id FROM "_schema_migrations" WHERE id=?').get(MARKER));
    let classification, verified;
    if (!added.some(Boolean) && !newGuards.some(Boolean) && !marker && predecessorGuards) classification = 'PRE_191';
    else if (added.every(Boolean) && !newGuards.some(Boolean) && !marker && predecessorGuards) classification = 'FRESH_PRISMA';
    else if (added.every(Boolean) && newGuards.every(Boolean) && marker) {
        verified = assertRepeatInstallationEvidence(db); classification = 'COMPLETE';
    } else differences.push('Repeat installation is partial or unmarked');
    if (differences.length) throw fail('WORK_REPEAT_SCHEMA_MISMATCH', 'Repeat schema differs from the release.', { differences });
    return { classification, sources: verified?.sources || repeatSources(db), ...(verified && { receipt: verified.receipt }),
        predecessor: { classification: predecessor.classification, sources: predecessor.sources,
            receiptSha256: predecessor.receipt.receiptSha256 }, plan: planInterimRepeatReasons(db),
        releaseInventory: inventorySubmittedRecordedOwners(db), bootstrapRebuild: [] };
}
function retainedRows(db, transformRow) {
    return fingerprintRetainedTables(db, { tableNames: ['WorkAttempt', 'WorkItem', 'Result', 'ReviewDecision', 'AuditLog', '_schema_migrations',
        'Batch','BatchAnalyte','BatchPosition','BatchPositionWorkItem','BatchPositionReference','QcMeasurement','QcEvaluation','BatchDisposition','BatchEvent'],
        orderBy: 'id', transformRow });
}
function installWorkRepeatContract({ dbPath, apply = false } = {}) {
    if (typeof dbPath !== 'string' || !dbPath.trim()) throw fail('WORK_REPEAT_DATABASE_REQUIRED', 'An explicit database path is required.');
    const target = path.resolve(dbPath), source = loadWorkRepeatMigrationSource();
    const reader = new Database(target, { readonly: true, fileMustExist: true });
    let before;
    try { before = reader.transaction(() => classify(reader))(); } finally { reader.close(); }
    if (!apply) return { ...before, mode: 'DRY_RUN', totalChanges: 0 };
    if (before.classification === 'COMPLETE') return { ...before, mode: 'NO_OP', totalChanges: 0 };
    const db = new Database(target, { fileMustExist: true, timeout: 5000 });
    try {
        require('../services/exchangeDbFunctions').registerDbFunctions(db);
        db.pragma('foreign_keys=ON');
        return db.transaction(() => {
            const current = classify(db);
            if (current.classification === 'COMPLETE') return { ...current, mode: 'NO_OP', totalChanges: 0 };
            const rows = retainedRows(db);
            const expected = current.classification === 'PRE_191' ? retainedRows(db, (table, row) =>
                table === 'WorkAttempt' ? { ...row, parentAttemptId: null, note: null } : row) : rows;
            if (current.classification === 'PRE_191') db.exec(source.schemaSql);
            db.exec(source.guardsSql);
            const afterRows = retainedRows(db);
            if (afterRows !== expected) throw fail('WORK_REPEAT_PRESERVATION_REFUSED', 'Repeat installation changed retained evidence.');
            const receipt = { sources: current.sources, originalRowsSha256: rows,
                ...current.plan, originalRowsAndFieldsPreserved: true, newAttemptCount: 0, linkedResultCount: 0 };
            receipt.receiptSha256 = fingerprint(receipt);
            db.prepare('INSERT INTO "_schema_migrations"(id,details) VALUES (?,?)').run(MARKER, JSON.stringify(receipt));
            const after = classify(db);
            if (after.classification !== 'COMPLETE' || db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length) {
                throw fail('WORK_REPEAT_INTEGRITY_REFUSED', 'Repeat installation failed integrity checks.');
            }
            return { ...after, previousClassification: current.classification, mode: 'APPLIED', backfilledCount: 0,
                newAttemptCount: 0, linkedResultCount: 0, totalChanges: db.prepare('SELECT total_changes() n').get().n };
        }).immediate();
    } finally { db.close(); }
}
function assertWorkRepeatStartupReady(dbPath) {
    const plan = installWorkRepeatContract({ dbPath });
    if (plan.classification !== 'COMPLETE') throw fail('WORK_REPEAT_NOT_INSTALLED', 'Install reviewed repeat evidence before startup.');
    return plan;
}
function parseArguments(args) {
    const options = { apply: false }, seen = new Set();
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (seen.has(arg)) throw fail('WORK_REPEAT_ARGUMENT_INVALID', 'Repeated argument.');
        seen.add(arg);
        if (arg === '--apply') options.apply = true;
        else if (arg === '--dry-run') continue;
        else if (arg === '--db' && args[i + 1] && !args[i + 1].startsWith('--')) options.dbPath = args[++i];
        else throw fail('WORK_REPEAT_ARGUMENT_INVALID', 'Unknown or incomplete argument.');
    }
    if (!options.dbPath || seen.has('--apply') && seen.has('--dry-run')) throw fail('WORK_REPEAT_ARGUMENT_INVALID', 'Provide --db and one execution mode.');
    return options;
}
if (require.main === module) {
    try { process.stdout.write(JSON.stringify(installWorkRepeatContract(parseArguments(process.argv.slice(2))), null, 2) + '\n'); }
    catch (error) {
        process.stderr.write(JSON.stringify({ error: error.code || 'WORK_REPEAT_INSTALL_REFUSED', message: error.message,
            differences: error.differences || [], totalChanges: error.totalChanges ?? 0 }) + '\n'); process.exitCode = 1;
    }
}
module.exports = { installWorkRepeatContract, assertWorkRepeatStartupReady, parseArguments, MARKER };
