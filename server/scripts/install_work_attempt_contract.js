#!/usr/bin/env node
const path = require('node:path'), Database = require('better-sqlite3');
const { randomUUID, createHash } = require('node:crypto');
const { loadWorkAttemptMigrationSource } = require('../services/workAttemptMigrationSource');
const { planHistoricalAttempts } = require('../services/workAttemptBackfillPlan');
const MARKER = '190_work_attempt_contract';
const COLUMNS = Object.freeze({ batchId: 'TEXT', reason: 'TEXT', requestedBy: 'TEXT', requestedAt: 'DATETIME',
    rawData: 'TEXT', calcVersion: 'TEXT', dilutionFactor: 'REAL', aliquotId: 'TEXT', legacyAttemptNoConflict: 'TEXT' });
const fail = (code, message, details = {}) => Object.assign(new Error(message), { code, ...details });
const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const normalize = sql => (sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|\s+|[^\s'"]+/g) || [])
    .filter(token => !/^\s+$/.test(token)).join('').replace(/;$/, '');
function releaseObjects(source) {
    return [...source.guardsSql.matchAll(/^CREATE (?:UNIQUE INDEX "([^"]+)"[^;]*;|TRIGGER "([^"]+)"[\s\S]*?^END;)/gm)]
        .map(match => ({ name: match[1] || match[2], type: match[1] ? 'index' : 'trigger', sql: match[0] }));
}
function classify(db, source) {
    const columns = db.prepare('PRAGMA table_xinfo("WorkAttempt")').all(), differences = [];
    const reviewColumns = db.prepare('PRAGMA table_xinfo("ReviewDecision")').all();
    if (!['id','workItemId','attemptNo','qcBatchId','evidenceData','instrumentId'].every(name => columns.some(row => row.name === name)) ||
        !db.prepare('PRAGMA table_info("_schema_migrations")').all().some(row => row.name === 'details') ||
        !db.prepare('PRAGMA table_info("Result")').all().some(row => row.name === 'equipmentReadiness')) {
        throw fail('WORK_ATTEMPT_SCHEMA_MISMATCH', 'Install the prior reviewed application schema first.');
    }
    const installedColumns = Object.entries(COLUMNS).map(([name,type]) => {
        const column = columns.find(row => row.name === name);
        if (column && (column.type !== type || column.notnull || column.dflt_value !== null || column.pk || column.hidden)) differences.push(`WorkAttempt.${name} differs`);
        return Boolean(column);
    });
    const reason = reviewColumns.find(row => row.name === 'reasonCode');
    if (reason && (reason.type !== 'TEXT' || reason.notnull || reason.dflt_value !== null || reason.pk || reason.hidden)) differences.push('ReviewDecision.reasonCode differs');
    installedColumns.push(Boolean(reason));
    const objects = releaseObjects(source);
    if (objects.length !== 15) throw fail('WORK_ATTEMPT_SOURCE_MISMATCH', 'The release requires two partial indexes and thirteen guards.');
    const installedObjects = objects.map(expected => {
        const actual = db.prepare('SELECT type,sql FROM sqlite_master WHERE name=?').get(expected.name);
        if (actual && (actual.type !== expected.type || normalize(actual.sql) !== normalize(expected.sql))) differences.push(`${expected.name} differs`);
        return Boolean(actual);
    });
    const sources = { migrationSha256: source.sha256, contractVersion: '190-v1' };
    const marker = db.prepare('SELECT details FROM "_schema_migrations" WHERE id=?').get(MARKER);
    let receipt;
    if (marker) {
        try { receipt = JSON.parse(marker.details); } catch (_) { /* Refuse altered receipts. */ }
        if (JSON.stringify(receipt?.sources) !== JSON.stringify(sources)) differences.push('WorkAttempt receipt source differs');
        const {receiptSha256,...content}=receipt || {};
        if(receiptSha256!==fingerprint(content))differences.push('WorkAttempt receipt integrity differs');
        for(const group of receipt?.flaggedGroups || []) {
            const rows=db.prepare('SELECT id,workItemId,attemptNo,legacyAttemptNoConflict FROM "WorkAttempt" WHERE legacyAttemptNoConflict=? ORDER BY id').all(group.flag);
            if(JSON.stringify(rows.map(row=>row.id).sort())!==JSON.stringify([...group.attemptIds].sort()) ||
                rows.some(row=>row.workItemId!==group.workItemId || row.attemptNo!==group.attemptNo))differences.push('WorkAttempt conflict flag provenance differs');
        }
    }
    let classification;
    if (![...installedColumns,...installedObjects,Boolean(marker)].some(Boolean)) classification = 'PRE_190';
    else if (installedColumns.every(Boolean) && ![...installedObjects,Boolean(marker)].some(Boolean)) classification = 'FRESH_PRISMA';
    else if ([...installedColumns,...installedObjects,Boolean(marker)].every(Boolean)) classification = 'COMPLETE';
    else differences.push('WorkAttempt installation is partial or unmarked');
    if (classification === 'FRESH_PRISMA' && db.prepare('SELECT count(*) n FROM "WorkAttempt" WHERE legacyAttemptNoConflict IS NOT NULL').get().n) {
        differences.push('Unmarked conflict flags cannot be trusted as migration provenance');
    }
    if (classification !== 'PRE_190') {
        const fk = db.prepare('PRAGMA foreign_key_list("WorkAttempt")').all().find(row => row.from === 'batchId');
        if (!fk || fk.table !== 'Batch' || fk.to !== 'id' || fk.on_delete !== 'RESTRICT' || fk.on_update !== 'CASCADE') differences.push('WorkAttempt.batchId foreign key differs');
        for (const [name, expected] of [['WorkAttempt_workItemId_attemptNo_idx',['workItemId','attemptNo']],['WorkAttempt_batchId_idx',['batchId']]]) {
            const fields = db.prepare(`PRAGMA index_info("${name}")`).all().map(row => row.name);
            if (JSON.stringify(fields) !== JSON.stringify(expected)) differences.push(`${name} differs`);
        }
    }
    if (differences.length) throw fail('WORK_ATTEMPT_SCHEMA_MISMATCH', 'WorkAttempt evidence differs from the release.', { differences });
    const plan = planHistoricalAttempts(db);
    if (classification === 'COMPLETE' && (plan.status !== 'READY' || plan.links.length)) {
        throw fail('WORK_ATTEMPT_INTEGRITY_REFUSED', 'Completed WorkAttempt installation has unlinked or conflicting Results.', { plan });
    }
    return { classification, sources, plan, ...(receipt && { receipt }), bootstrapRebuild: [] };
}

function applyBackfill(db, plan) {
    const originalAttempts = db.prepare('SELECT * FROM "WorkAttempt" ORDER BY id').all();
    const originalResults = db.prepare('SELECT * FROM "Result" ORDER BY id').all();
    const originalItems = db.prepare('SELECT * FROM "WorkItem" ORDER BY id').all();
    const allocated = new Map(), createdAttempts = [], flaggedGroups = [];
    for (const group of plan.duplicateAttemptNumberGroups) {
        const flag = '190:' + fingerprint(group);
        for (const id of group.attemptIds) db.prepare('UPDATE "WorkAttempt" SET legacyAttemptNoConflict=? WHERE id=?').run(flag,id);
        flaggedGroups.push({ ...group, flag });
    }
    for (const entry of plan.historicalBatchEvidence.filter(row => row.attemptId && row.outcome === 'COPIED')) {
        db.prepare('UPDATE "WorkAttempt" SET batchId=? WHERE id=? AND batchId IS NULL').run(entry.batchId,entry.attemptId);
    }
    for (const entry of plan.newAttempts) {
        const id = 'att190-' + randomUUID(), now = new Date().toISOString();
        const equipment = plan.historicalEquipmentEvidence.find(row => row.workItemId === entry.workItemId);
        const batch = plan.historicalBatchEvidence.find(row => row.newAttemptForWorkItemId === entry.workItemId);
        // The time is creation of this migration row, never a claimed historical
        // measurement time. Unknown author/raw/calculation/reason stay NULL.
        db.prepare(`INSERT INTO "WorkAttempt" (id,workItemId,attemptNo,status,batchId,evidenceData,instrumentId,createdAt,updatedAt)
            VALUES (?,?,?,?,?,?,?,?,?)`).run(id,entry.workItemId,entry.attemptNo,entry.status,batch.batchId,equipment.evidenceData,equipment.instrumentId,now,now);
        allocated.set(entry.workItemId,id); createdAttempts.push({ ...entry, id, batchId: batch.batchId,
            equipmentOutcome: equipment.outcome, equipmentReason: equipment.reason });
    }
    const links = plan.links.map(entry => ({ ...entry, attemptId: entry.attemptId || allocated.get(entry.newAttemptForWorkItemId) }));
    for (const entry of links) {
        const updated = db.prepare('UPDATE "Result" SET attemptId=? WHERE id=? AND attemptId IS NULL').run(entry.attemptId,entry.resultId);
        if (updated.changes !== 1) throw fail('WORK_ATTEMPT_BACKFILL_CONFLICT', 'A Result link changed before backfill.');
    }
    const resultLinks = new Map(links.map(row => [row.resultId,row.attemptId]));
    const afterResults = db.prepare('SELECT * FROM "Result" ORDER BY id').all();
    if (JSON.stringify(afterResults) !== JSON.stringify(originalResults.map(row => ({ ...row,
        attemptId: resultLinks.get(row.id) || row.attemptId })))) throw fail('WORK_ATTEMPT_PRESERVATION_REFUSED', 'Backfill changed original Result fields.');
    for (const before of originalAttempts) {
        const after = db.prepare('SELECT * FROM "WorkAttempt" WHERE id=?').get(before.id);
        const originalFields = Object.keys(before).filter(name => !['batchId','legacyAttemptNoConflict'].includes(name));
        if (originalFields.some(name => after[name] !== before[name])) throw fail('WORK_ATTEMPT_PRESERVATION_REFUSED', 'Backfill changed original attempt fields.');
    }
    if (JSON.stringify(db.prepare('SELECT * FROM "WorkItem" ORDER BY id').all()) !== JSON.stringify(originalItems)) {
        throw fail('WORK_ATTEMPT_PRESERVATION_REFUSED', 'Backfill changed original WorkItems.');
    }
    return { createdAttempts, links, flaggedGroups, exemptImportCount:plan.exemptImportCount,exemptImports:plan.exemptImports,
        missingOrderedWorkGroups:plan.missingOrderedWorkGroups,missingOrderedWorkCount:plan.missingOrderedWorkCount,
        samplesWithMissingOrderedWorkCount:plan.samplesWithMissingOrderedWorkCount,invalidOrderMetadata:plan.invalidOrderMetadata,
        historicalBatchEvidence: plan.historicalBatchEvidence,
        historicalEquipmentEvidence: plan.historicalEquipmentEvidence, originalRowsAndFieldsPreserved: true };
}

function installWorkAttemptContract({ dbPath, apply = false } = {}) {
    if (typeof dbPath !== 'string' || !dbPath.trim()) throw fail('WORK_ATTEMPT_DATABASE_REQUIRED', 'An explicit database path is required.');
    const target = path.resolve(dbPath), source = loadWorkAttemptMigrationSource();
    const reader = new Database(target, { readonly:true,fileMustExist:true });
    let before;
    try { before = reader.transaction(() => classify(reader,source))(); } finally { reader.close(); }
    if (!apply || before.classification === 'COMPLETE') return { ...before, mode:apply?'NO_OP':'DRY_RUN',totalChanges:0 };
    if (before.plan.status !== 'READY') throw fail('WORK_ATTEMPT_BACKFILL_REFUSED', 'Resolve every backfill blocker before apply.', { plan:before.plan });
    const db = new Database(target, { fileMustExist:true,timeout:5000 });
    try {
        // Existing exchange triggers compile their UDFs even when an
        // attemptId-only backfill does not qualify as an amendment. Register
        // the application functions on this connection; never remove guards.
        require('../services/exchangeDbFunctions').registerDbFunctions(db);
        db.pragma('foreign_keys=ON');
        return db.transaction(() => {
            const current = classify(db,source);
            if (current.classification === 'COMPLETE') return { ...current,mode:'NO_OP',totalChanges:0 };
            if (current.plan.status !== 'READY') throw fail('WORK_ATTEMPT_BACKFILL_REFUSED', 'Resolve every backfill blocker before apply.', { plan:current.plan });
            if (current.classification === 'PRE_190') db.exec(source.schemaSql);
            const backfill = applyBackfill(db,current.plan);
            db.exec(source.guardsSql);
            const receipt = { sources:current.sources, originalPlanSha256:current.plan.planSha256,
                originalAttemptSha256:current.plan.originalAttemptSha256, originalResultSha256:current.plan.originalResultSha256,
                matchedWorkItemSourceSha256:current.plan.matchedWorkItemSourceSha256, ...backfill };
            receipt.receiptSha256=fingerprint(receipt);
            db.prepare('INSERT INTO "_schema_migrations"(id,details) VALUES (?,?)').run(MARKER,JSON.stringify(receipt));
            const after = classify(db,source);
            if (after.classification !== 'COMPLETE' || db.pragma('integrity_check',{simple:true}) !== 'ok' || db.pragma('foreign_key_check').length) {
                throw fail('WORK_ATTEMPT_INTEGRITY_REFUSED', 'WorkAttempt installation failed integrity checks.');
            }
            return { ...after, previousClassification:current.classification, mode:'APPLIED',
                newAttemptCount:backfill.createdAttempts.length, linkedResultCount:backfill.links.length,
                flaggedAttemptCount:backfill.flaggedGroups.reduce((sum,group)=>sum+group.attemptIds.length,0),
                totalChanges:db.prepare('SELECT total_changes() n').get().n };
        }).immediate();
    } finally { db.close(); }
}
function assertWorkAttemptStartupReady(dbPath) {
    const plan = installWorkAttemptContract({dbPath});
    if (plan.classification !== 'COMPLETE') throw fail('WORK_ATTEMPT_NOT_INSTALLED', 'Install reviewed WorkAttempt evidence before startup.');
    return plan;
}
function parseArguments(args) {
    const options = { apply:false }, seen = new Set();
    for (let i=0;i<args.length;i++) {
        const arg=args[i]; if (seen.has(arg)) throw fail('WORK_ATTEMPT_ARGUMENT_INVALID','Repeated argument.'); seen.add(arg);
        if (arg==='--apply') options.apply=true;
        else if (arg==='--dry-run') continue;
        else if (arg==='--db' && args[i+1] && !args[i+1].startsWith('--')) options.dbPath=args[++i];
        else throw fail('WORK_ATTEMPT_ARGUMENT_INVALID','Unknown or incomplete argument.');
    }
    if (!options.dbPath || seen.has('--apply') && seen.has('--dry-run')) throw fail('WORK_ATTEMPT_ARGUMENT_INVALID','Provide --db and one execution mode.');
    return options;
}
if (require.main === module) {
    try { process.stdout.write(JSON.stringify(installWorkAttemptContract(parseArguments(process.argv.slice(2))),null,2)+'\n'); }
    catch (error) { process.stderr.write(JSON.stringify({error:error.code || 'WORK_ATTEMPT_INSTALL_REFUSED',message:error.message,
        differences:error.differences || [], ...(error.plan && {plan:error.plan})})+'\n');process.exitCode=1; }
}
module.exports = { installWorkAttemptContract,assertWorkAttemptStartupReady,parseArguments,MARKER };
