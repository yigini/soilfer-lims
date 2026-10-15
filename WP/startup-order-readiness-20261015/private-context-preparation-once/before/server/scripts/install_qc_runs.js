#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { loadQcRunMigrationSource } = require('../services/qcRunMigrationSource');
const { classifyQcRunSchema, MARKER, TABLES } = require('../services/qcRunSchemaService');
const { inventoryLegacyQcRuns } = require('../services/qcRunBackfillPlan');
const fail = (code, message, plan = null) => Object.assign(new Error(message), { code, plan });

function planSummary(schema, plan) {
    return { ...schema, backfillFingerprint: plan.fingerprint, backfillCounts: plan.counts,
        backfillCount: Object.values(plan.rows).reduce((total, rows) => total + rows.length, 0),
        diagnostics: plan.diagnostics, refusals: plan.refusals };
}
function importRows(db, plan) {
    // The fixed statements insert only new normalized tables. They never update
    // an old QC value, analytical result, audit row or legacy JSON field.
    const statements = {
        BatchAnalyte: db.prepare('INSERT INTO "BatchAnalyte" (id,batchId,labId,analysisCode,methodologyId,methodResolution,status,provenance,legacyMembershipFrozen,legacySource) VALUES (@id,@batchId,@labId,@analysisCode,@methodologyId,@methodResolution,@status,@provenance,@legacyMembershipFrozen,@legacySource)'),
        BatchPosition: db.prepare('INSERT INTO "BatchPosition" (id,batchId,position,kind,sampleId,duplicateOfPositionId,historicalSnapshotSeq,provenance,legacySource) VALUES (@id,@batchId,@position,@kind,@sampleId,@duplicateOfPositionId,@historicalSnapshotSeq,@provenance,@legacySource)'),
        BatchPositionWorkItem: db.prepare('INSERT INTO "BatchPositionWorkItem" (id,positionId,workItemId,analysisCode) VALUES (@id,@positionId,@workItemId,@analysisCode)'),
        BatchPositionReference: db.prepare('INSERT INTO "BatchPositionReference" (id,positionId,analysisCode,referenceMaterialId,referenceValueId,referenceUse,referenceSnapshot,boundBy,boundAt,supersededById,correctionReason) VALUES (@id,@positionId,@analysisCode,@referenceMaterialId,@referenceValueId,@referenceUse,@referenceSnapshot,@boundBy,@boundAt,@supersededById,@correctionReason)'),
        QcMeasurement: db.prepare('INSERT INTO "QcMeasurement" (id,batchId,positionId,analysisCode,replicateNo,value,rawInput,censoring,censoringLimit,enteredBy,enteredAt,supersededById,correctionReason,legacySource) VALUES (@id,@batchId,@positionId,@analysisCode,@replicateNo,@value,@rawInput,@censoring,@censoringLimit,@enteredBy,@enteredAt,@supersededById,@correctionReason,@legacySource)'),
        QcEvaluation: db.prepare('INSERT INTO "QcEvaluation" (id,batchId,analysisCode,version,ruleId,ruleVersion,policyVersion,verdict,details,evaluatedBy,evaluatedAt,supersedesId,legacySource) VALUES (@id,@batchId,@analysisCode,@version,@ruleId,@ruleVersion,@policyVersion,@verdict,@details,@evaluatedBy,@evaluatedAt,@supersedesId,@legacySource)'),
        BatchDisposition: db.prepare('INSERT INTO "BatchDisposition" (id,batchId,analysisCode,decision,reason,decidedBy,decidedAt,legacySource) VALUES (@id,@batchId,@analysisCode,@decision,@reason,@decidedBy,@decidedAt,@legacySource)'),
        BatchEvent: db.prepare('INSERT INTO "BatchEvent" (id,batchId,type,payload,"by",at) VALUES (@id,@batchId,@type,@payload,@by,@at)')
    };
    for (const table of TABLES) for (const row of plan.rows[table]) statements[table].run(row);
    const metadata = db.prepare('UPDATE "Batch" SET instrumentId=@instrumentId,analystUsername=@analystUsername WHERE id=@batchId AND (instrumentId IS NOT @instrumentId OR analystUsername IS NOT @analystUsername)');
    for (const row of plan.metadata) metadata.run(row);
}
function assertIntegrity(db) {
    if (db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length) throw fail('QC_RUN_INTEGRITY_REFUSED', 'Normalized QC installation requires an intact database.');
}
function bootstrapDeferredTables(db, schemaSource, schema) {
    if (!schema.bootstrapRebuild.length) return [];
    // #186 part 20 permits only these two brand-new, empty Prisma tables.
    // Classification and emptiness are rechecked under the install write lock.
    if (schema.classification !== 'FRESH_PRISMA' || Object.values(schema.counts).some(Boolean)) {
        throw fail('QC_RUN_INTEGRITY_REFUSED', 'Deferred QC bootstrap requires an empty unmarked fresh schema.');
    }
    const source = loadQcRunMigrationSource();
    db.exec(source.bootstrapSql);
    assertIntegrity(db);
    const rebuilt = classifyQcRunSchema(db, schemaSource);
    if (rebuilt.classification !== 'FRESH_PRISMA' || rebuilt.bootstrapRebuild.length) {
        throw fail('QC_RUN_INTEGRITY_REFUSED', 'Deferred QC bootstrap did not reproduce authoritative DDL.');
    }
    return ['QcMeasurement', 'BatchPositionReference'];
}
function installQcRuns({ dbPath, apply = false, planSha256 = null } = {}) {
    if (typeof dbPath !== 'string' || !dbPath.trim()) throw fail('QC_RUN_DATABASE_REQUIRED', 'An explicit database path is required.');
    const source = loadQcRunMigrationSource(), target = path.resolve(dbPath);
    const schemaSource = { sql: source.sql, sha256: source.sha256, oracleSha256: source.oracleSha256, freshTables: source.freshTables };
    const reader = new Database(target, { readonly: true, fileMustExist: true });
    let schema, plan;
    try {
        reader.transaction(() => {
            schema = classifyQcRunSchema(reader, schemaSource); assertIntegrity(reader);
            if (schema.classification !== 'COMPLETE') plan = inventoryLegacyQcRuns(reader);
        })();
    } finally { reader.close(); }
    if (schema.classification === 'COMPLETE') return { ...schema, backfillCount: 0, backfillCounts: schema.receipt.backfillCounts,
        backfillFingerprint: schema.receipt.backfillFingerprint, mode: apply ? 'NO_OP' : 'DRY_RUN', totalChanges: 0 };
    const summary = planSummary(schema, plan);
    if (!apply) return { ...summary, mode: 'DRY_RUN', totalChanges: 0 };
    if (plan.refusals.length) throw fail('QC_RUN_BACKFILL_REFUSED', 'Review every unresolved legacy conflict before applying. No rows changed.', summary);
    if (summary.backfillCount && (!/^[a-f0-9]{64}$/.test(planSha256 || '') || plan.fingerprint !== planSha256)) throw fail('QC_RUN_PLAN_STALE', 'Apply requires the exact reviewed dry-run fingerprint. No rows changed.', summary);
    const db = new Database(target, { fileMustExist: true, timeout: 5000 });
    try {
        db.pragma('foreign_keys = ON');
        return db.transaction(() => {
            const locked = classifyQcRunSchema(db, schemaSource); assertIntegrity(db);
            if (locked.classification !== schema.classification) throw fail('QC_RUN_PLAN_STALE', 'The schema changed after planning. No rows changed.');
            const current = inventoryLegacyQcRuns(db);
            if (current.fingerprint !== plan.fingerprint || current.refusals.length) throw fail('QC_RUN_PLAN_STALE', 'Legacy evidence changed after planning. No rows changed.');
            if (locked.classification === 'PRE_186') db.exec(source.schemaSql);
            const bootstrapRebuild = bootstrapDeferredTables(db, schemaSource, locked);
            importRows(db, current);
            db.exec(source.guardsSql);
            const receipt = { ...locked.sources, backfillFingerprint: current.fingerprint, backfillCounts: current.counts, bootstrapRebuild };
            db.prepare('INSERT INTO "_schema_migrations" (id,details) VALUES (?,?)').run(MARKER, JSON.stringify(receipt));
            const complete = classifyQcRunSchema(db, schemaSource); assertIntegrity(db);
            if (complete.classification !== 'COMPLETE') throw fail('QC_RUN_INTEGRITY_REFUSED', 'Normalized QC installation did not complete.');
            for (const table of TABLES) if (complete.counts[table] !== current.rows[table].length) throw fail('QC_RUN_INTEGRITY_REFUSED', 'Normalized QC backfill counts differ.');
            return { ...planSummary(complete, current), previousClassification: locked.classification, mode: 'APPLIED', totalChanges: db.prepare('SELECT total_changes() n').get().n };
        }).immediate();
    } finally { db.close(); }
}
function assertQcRunStartupReady(dbPath) {
    if (!fs.existsSync(dbPath)) throw fail('DATABASE_NOT_FOUND', 'The lab database does not exist.');
    const outcome = installQcRuns({ dbPath });
    if (outcome.classification !== 'COMPLETE') throw fail('QC_RUN_NOT_INSTALLED', 'Run the reviewed normalized QC installer before starting the lab.');
    return outcome;
}
function parseArguments(args) {
    const options = { dbPath: process.env.DATABASE_PATH || path.resolve(__dirname, '../prisma/dev.db'), apply: false, planSha256: null }, seen = new Set();
    for (let index = 0; index < args.length; index++) {
        const arg = args[index];
        if (seen.has(arg)) throw fail('QC_RUN_ARGUMENT_INVALID', 'Repeated argument.');
        seen.add(arg);
        if (arg === '--apply') options.apply = true;
        else if (arg === '--dry-run') continue;
        else if (['--db', '--plan-sha256'].includes(arg) && args[index + 1] && !args[index + 1].startsWith('--')) options[arg === '--db' ? 'dbPath' : 'planSha256'] = args[++index];
        else throw fail('QC_RUN_ARGUMENT_INVALID', 'Unknown or incomplete argument.');
    }
    if (seen.has('--apply') && seen.has('--dry-run')) throw fail('QC_RUN_ARGUMENT_INVALID', 'Apply and dry-run are mutually exclusive.');
    if (options.planSha256 !== null && !/^[a-f0-9]{64}$/.test(options.planSha256)) throw fail('QC_RUN_ARGUMENT_INVALID', 'Plan SHA256 must be a lowercase digest.');
    return options;
}
if (require.main === module) {
    try { process.stdout.write(`${JSON.stringify(installQcRuns(parseArguments(process.argv.slice(2))), null, 2)}\n`); }
    catch (error) { process.stderr.write(`${JSON.stringify({ error: error.code || 'QC_RUN_INSTALL_REFUSED', message: error.message, differences: error.differences || [], plan: error.plan })}\n`); process.exitCode = 1; }
}
module.exports = { installQcRuns, assertQcRunStartupReady, parseArguments };
