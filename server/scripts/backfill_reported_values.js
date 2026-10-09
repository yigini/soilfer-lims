#!/usr/bin/env node
const path = require('node:path');
const { createHash } = require('node:crypto');
const { PrismaClient } = require('../prisma_client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const rules = require('../services/workflowStateRules');
const { hasPermission } = require('../config/roles');
const scope = require('../utils/scopeGuard');
const { loadSelectionContext } = require('../services/reportedValueSelectionContext');
const { automaticReportedChoice } = require('../services/reportedValueChoiceContract');
const { readReportedSelection, appendReportedSelection } = require('../services/reportedValueSelectionService');
const digest = value => createHash('sha256').update(JSON.stringify(value, (_,row) => typeof row === 'bigint' ? { integer: String(row) } : row)).digest('hex');
const fail = (code,message) => new rules.TransitionError(message,409,code);
async function retainedRows(tx) {
    const names = await tx.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    const rows = {};
    for (const { name } of names) rows[name] = await tx.$queryRawUnsafe('SELECT * FROM "'+name.replace(/"/g,'""')+'" ORDER BY rowid');
    return rows;
}
function reportHash(rows) {
    return digest((rows.Report || []).filter(row => ['PUBLISHED','SUPERSEDED'].includes(row.status))
        .map(row => ({ id: row.id, status: row.status, content: row.content })).sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
function assertPreserved(before, after) {
    if (JSON.stringify(Object.keys(before)) !== JSON.stringify(Object.keys(after))) throw fail('REPORTED_VALUE_BACKFILL_REFUSED','The database table set changed.');
    for (const name of Object.keys(before)) {
        if (['AuditLog','ReportedValueSelection'].includes(name)) {
            const existing = new Map(after[name].map(row => [row.id,row]));
            if (before[name].some(row => digest(row) !== digest(existing.get(row.id)))) throw fail('REPORTED_VALUE_BACKFILL_REFUSED','Retained '+name+' rows changed.');
        } else if (digest(before[name]) !== digest(after[name])) throw fail('REPORTED_VALUE_BACKFILL_REFUSED','Retained '+name+' rows changed.');
    }
    if (reportHash(before) !== reportHash(after)) throw fail('REPORTED_VALUE_BACKFILL_REFUSED','Published or superseded report content changed.');
}
async function plan(tx, by) {
    const actor = typeof by === 'string' && await tx.user.findUnique({ where: { username: by } });
    if (!actor?.isActive || !scope.hasGlobalAccess(actor) || !hasPermission(actor,'APPROVE_RESULTS')) {
        throw fail('REPORTED_VALUE_BACKFILL_ACTOR_REQUIRED','A named active administrator with global approval authority is required.');
    }
    const retained = await retainedRows(tx), items = (await tx.workItem.findMany({ where: { status:'ACCEPTED' }, orderBy: { id:'asc' } }))
        .filter(item => !require('../services/workItemKinds').isNonMeasurement(item));
    const tests = [], changes = [];
    for (const item of items) {
        const context = await loadSelectionContext(tx,item);
        const evidence = { policy: context.policy, limits: context.limits, lineage: context.lineage.snapshot };
        try {
            const current = await readReportedSelection(tx,item);
            tests.push({ workItemId:item.id, analysisCode:item.analysis, outcome:'ALREADY_SELECTED', selectionGroupId:current.rows[0].selectionGroupId,
                mode:current.rows[0].mode, ...evidence });
            continue;
        } catch (error) {
            if (error.code === 'REPORTED_VALUE_STALE') {
                tests.push({ workItemId:item.id, analysisCode:item.analysis, outcome:'STALE_SELECTION', reasons:[error.code], ...evidence });
                continue;
            }
            if (error.code !== 'REPORTED_VALUE_SELECTION_REQUIRED') throw error;
        }
        const automatic = automaticReportedChoice(item,context.lineage,context.policy.value,context.limits);
        const row = { workItemId:item.id, analysisCode:item.analysis, outcome:automatic.choice?.rule || 'AMBIGUOUS',
            reasons:automatic.reasons, choice:automatic.choice, ...evidence };
        tests.push(row); if (automatic.choice) changes.push(item);
    }
    const counts = Object.fromEntries(['AUTO_SINGLE','AUTO_DUPLICATE_MEAN','AUTO_LATEST_AFTER_INVALIDATION','AUTO_LATEST_VALID',
        'ALREADY_SELECTED','STALE_SELECTION','AMBIGUOUS'].map(outcome => [outcome,tests.filter(row => row.outcome === outcome).length]));
    return { actor, retained, changes, tests, counts, totalMeasuredAccepted:items.length,
        ambiguousWorkItemIds:tests.filter(row => ['AMBIGUOUS','STALE_SELECTION'].includes(row.outcome)).map(row => row.workItemId),
        reportsSha256:reportHash(retained), planSha256:digest({ actor:{ username:actor.username, role:actor.role, isActive:actor.isActive }, retained, tests }) };
}
function receipt(planned,mode,options = {}) {
    return { mode, planSha256:planned.planSha256, totalMeasuredAccepted:planned.totalMeasuredAccepted, counts:planned.counts,
        ambiguousWorkItemIds:planned.ambiguousWorkItemIds, tests:planned.tests,
        newSelectionGroups:0, newSelectionRows:0, newAuditRows:0, totalChanges:0,
        reportsSha256Before:planned.reportsSha256, reportsSha256After:planned.reportsSha256, reportsPreserved:true, ...options };
}
function connection(dbPath,readonly) {
    class BackfillAdapter extends PrismaBetterSqlite3 {
        async connect() { const adapter = await super.connect(); adapter.client.pragma('foreign_keys=ON'); return adapter; }
    }
    return new PrismaClient({ adapter:new BackfillAdapter({ url:'file:'+dbPath, readonly, fileMustExist:true, timeout:5000 }) });
}
async function backfillReportedValues({ dbPath, by, apply = false, planSha256 = null } = {}) {
    if (typeof dbPath !== 'string' || !dbPath.trim()) throw fail('REPORTED_VALUE_DATABASE_REQUIRED','An explicit database path is required.');
    const target = path.resolve(dbPath); require('./install_reported_value_selections').assertReportedValueStartupReady(target);
    const reader = connection(target,true); let reviewed;
    try { reviewed = await reader.$transaction(tx => plan(tx,by),{ timeout:120000 }); }
    finally { await reader.$disconnect(); }
    if (!apply) return receipt(reviewed,'DRY_RUN');
    if (!reviewed.changes.length) return receipt(reviewed,'NO_OP');
    if (planSha256 !== reviewed.planSha256) throw fail('REPORTED_VALUE_BACKFILL_PLAN_STALE','Review the current dry-run fingerprint before applying selections.');
    const writer = connection(target,false);
    try { return await writer.$transaction(async tx => {
        const current = await plan(tx,by);
        if (current.planSha256 !== planSha256) throw fail('REPORTED_VALUE_BACKFILL_PLAN_STALE','Selection evidence changed after the dry-run.');
        const before = await tx.$queryRawUnsafe('SELECT total_changes() AS n'); let rowCount = 0;
        for (const item of current.changes) rowCount += (await appendReportedSelection(tx,item,current.actor,undefined,{ backfill:true, expectedGroupId:null })).length;
        const after = await retainedRows(tx); assertPreserved(current.retained,after);
        const auditCount = after.AuditLog.length-current.retained.AuditLog.length;
        if (auditCount !== current.changes.length || after.ReportedValueSelection.length-current.retained.ReportedValueSelection.length !== rowCount) {
            throw fail('REPORTED_VALUE_BACKFILL_REFUSED','Unexpected append counts.');
        }
        const integrity = await tx.$queryRawUnsafe('PRAGMA integrity_check'), foreignKeys = await tx.$queryRawUnsafe('PRAGMA foreign_key_check');
        if (integrity.length !== 1 || Object.values(integrity[0])[0] !== 'ok' || foreignKeys.length) throw fail('REPORTED_VALUE_BACKFILL_REFUSED','Database integrity checks failed.');
        const changes = await tx.$queryRawUnsafe('SELECT total_changes() AS n');
        return receipt(current,'APPLIED',{ newSelectionGroups:current.changes.length, newSelectionRows:rowCount, newAuditRows:auditCount,
            totalChanges:Number(changes[0].n-before[0].n), reportsSha256After:reportHash(after) });
    },{ timeout:120000 }); } finally { await writer.$disconnect(); }
}
function parseArguments(args) {
    const options = {}, seen = new Set();
    for (let index=0;index<args.length;index++) {
        const arg=args[index]; if (seen.has(arg)) throw fail('REPORTED_VALUE_ARGUMENT_INVALID','Repeated argument.'); seen.add(arg);
        if (arg==='--apply') options.apply=true;
        else if (arg==='--dry-run') continue;
        else if (['--db','--by','--plan-sha256'].includes(arg) && args[index+1] && !args[index+1].startsWith('--')) {
            options[{ '--db':'dbPath', '--by':'by', '--plan-sha256':'planSha256' }[arg]]=args[++index];
        } else throw fail('REPORTED_VALUE_ARGUMENT_INVALID','Unknown or incomplete argument.');
    }
    if (!options.dbPath || !options.by || seen.has('--apply') && seen.has('--dry-run')) throw fail('REPORTED_VALUE_ARGUMENT_INVALID','Provide --db, --by and one execution mode.');
    return options;
}
if (require.main===module) Promise.resolve().then(() => backfillReportedValues(parseArguments(process.argv.slice(2))))
    .then(result => process.stdout.write(JSON.stringify(result,null,2)+'\n'))
    .catch(error => { process.stderr.write(JSON.stringify({ error:error.code || 'REPORTED_VALUE_BACKFILL_REFUSED', message:error.message, totalChanges:0 })+'\n'); process.exitCode=1; });
module.exports = { backfillReportedValues, parseArguments };
