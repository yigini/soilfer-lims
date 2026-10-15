#!/usr/bin/env node
const fs = require('node:fs'), path = require('node:path'), { createHash } = require('node:crypto'), Database = require('better-sqlite3');
const { loadOrderRevisionMigrationSource } = require('../services/orderRevisionMigrationSource');
const { chooseOrderLine } = require('../services/orderLineResolutionService');
const { isNonMeasurement } = require('../services/workItemKinds');
const { inspectOpenExecutionReservations } = require('../services/workAttemptReservationService');
const { inspectTextureOwners, isFractionOwner } = require('../services/textureOrderContract');
const { normalizedSelection } = require('../services/orderRevisionContract');
const workflow = require('../workflowContract');
const MARKER = '209_order_revision_contract';
const fail = (code, message, differences = []) => Object.assign(new Error(message), { code, statusCode: 409, totalChanges: 0, differences });
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const quote = value => '"' + value.replaceAll('"', '""') + '"';
const normalize = sql => (sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|\s+|[^\s'"]+/g) || [])
    .filter(token => !/^\s+$/.test(token)).join('').replace(/;$/, '');
function fileHashes(target) {
    return Object.fromEntries(['', '-wal', '-shm'].map(suffix => {
        if (!fs.existsSync(target + suffix)) return [suffix, null];
        const stream = createHash('sha256'), buffer = Buffer.allocUnsafe(1024 * 1024), fd = fs.openSync(target + suffix, 'r');
        try { let size; while ((size = fs.readSync(fd, buffer, 0, buffer.length, null))) stream.update(buffer.subarray(0, size)); }
        finally { fs.closeSync(fd); }
        return [suffix, stream.digest('hex')];
    }));
}

function releaseObjects(source) {
    const objects = [
        ...[...source.sql.matchAll(/^CREATE (?:UNIQUE )?INDEX "([^"]+)"[^;]*;/gm)].map(match => ({ name: match[1], type: 'index', sql: match[0] })),
        ...[...source.sql.matchAll(/^CREATE TRIGGER "([^"]+)"[\s\S]*?^END;/gm)].map(match => ({ name: match[1], type: 'trigger', sql: match[0] }))
    ];
    if (objects.length !== 6) throw fail('ORDER_REVISION_SOURCE_MISMATCH', 'The order release object inventory differs.');
    return objects;
}

function classify(db, source) {
    if (db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length) {
        throw fail('ORDER_REVISION_INTEGRITY_REFUSED', 'An intact database is required.');
    }
    for (const [table, column] of [['SampleOrderRevision', 'version'], ['OrderLine', 'revisionId'], ['WorkItem', 'duplicateOf'],
        ['WorkAttempt', 'orderLineId'], ['_schema_migrations', 'details']]) {
        if (!db.prepare('PRAGMA table_xinfo(' + quote(table) + ')').all().some(row => row.name === column)) {
            throw fail('ORDER_REVISION_PREREQUISITE_REQUIRED', 'Install the prior application schema first.');
        }
    }
    const differences = [], column = db.prepare('PRAGMA table_xinfo("OrderLine")').all().find(row => row.name === 'workItemId');
    if (column && (column.type !== 'TEXT' || column.notnull !== 0 || column.pk !== 0 || column.hidden !== 0 || column.dflt_value !== null)) {
        differences.push('OrderLine.workItemId must be nullable TEXT without a default');
    }
    if (db.prepare('PRAGMA foreign_key_list("OrderLine")').all().some(row => row.from === 'workItemId')) {
        differences.push('OrderLine.workItemId must retain its reviewed scalar historical-identifier semantics');
    }
    const objects = releaseObjects(source), present = objects.map(wanted => {
        const row = db.prepare('SELECT type,sql FROM sqlite_master WHERE name=?').get(wanted.name);
        if (row && (row.type !== wanted.type || normalize(row.sql) !== normalize(wanted.sql))) differences.push(wanted.name + ' differs');
        return Boolean(row);
    });
    const marker = db.prepare('SELECT details FROM _schema_migrations WHERE id=?').get(MARKER);
    let receipt;
    if (marker) {
        try { receipt = JSON.parse(marker.details); } catch { /* Refuse unknown provenance. */ }
        if (!receipt || JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(['sourceSha256','originalRowsSha256','originalRowsPreserved','backfilledCount','receiptSha256'].sort())
            || !/^[a-f0-9]{64}$/.test(receipt.originalRowsSha256) || receipt.sourceSha256 !== source.sha256 || receipt.backfilledCount !== 0 || receipt.originalRowsPreserved !== true
            || receipt.receiptSha256 !== hash(Object.fromEntries(Object.entries(receipt).filter(([key]) => key !== 'receiptSha256')))) {
            differences.push('Order installation receipt differs');
        }
    }
    let classification;
    if (!column && present.every(value => !value) && !marker) classification = 'PRE_209';
    else if (column && present.every(Boolean) && marker) classification = 'COMPLETE_209';
    else if (column && present.slice(1).every(value => !value) && !marker) {
        classification = 'FRESH_PRISMA_209';
        if (db.prepare('SELECT count(*) n FROM OrderLine WHERE workItemId IS NOT NULL').get().n) differences.push('Unmarked order links must not be adopted');
    } else differences.push('The order installation is partial or unmarked');
    if (differences.length) throw fail('ORDER_REVISION_SCHEMA_MISMATCH', 'Order storage differs from the reviewed release.', differences);
    return { classification, sourceSha256: source.sha256, ...(receipt && { receipt }) };
}

function impact(db) {
    const revisions = db.prepare('SELECT id,sampleId FROM SampleOrderRevision WHERE status=? ORDER BY sampleId,id').all('ACTIVE');
    const hasLink = db.prepare('PRAGMA table_xinfo("OrderLine")').all().some(row => row.name === 'workItemId');
    const lines = db.prepare('SELECT id,revisionId,analysis,status,' + (hasLink ? 'workItemId' : 'NULL AS workItemId') +
        " FROM OrderLine WHERE status='ACTIVE' ORDER BY id").all();
    const groups = new Map(), linesByRevision = new Map(), openByItem = new Map();
    for (const line of lines) {
        if (!linesByRevision.has(line.revisionId)) linesByRevision.set(line.revisionId, []);
        linesByRevision.get(line.revisionId).push(line);
    }
    for (const attempt of db.prepare("SELECT id,workItemId,orderLineId FROM WorkAttempt WHERE status='OPEN' ORDER BY id").iterate()) {
        if (!openByItem.has(attempt.workItemId)) openByItem.set(attempt.workItemId, []);
        openByItem.get(attempt.workItemId).push(attempt);
    }
    for (const revision of revisions) {
        revision.lines = linesByRevision.get(revision.id) || [];
        if (!groups.has(revision.sampleId)) groups.set(revision.sampleId, []);
        groups.get(revision.sampleId).push(revision);
    }
    const multipleActive = [...groups].filter(([, rows]) => rows.length > 1)
        .map(([sampleId, rows]) => ({ sampleId, revisionIds: rows.map(row => row.id), priorActiveCount: rows.length }));
    const refusalCounts = { NO_LINE: 0, AMBIGUOUS_LINE: 0, MULTIPLE_ACTIVE_REVISIONS: 0, FRACTION_OWNER_LINE_REQUIRED: 0 }, refused = [];
    const continuingReservedOpenWorkItems = [], ambiguousOpenReservations = [];
    const items = db.prepare("SELECT id,sampleId,analysis FROM WorkItem WHERE status IN ('NOT_ASSIGNED','ASSIGNED','IN_PROGRESS','REPEAT_REQUIRED') ORDER BY id").iterate();
    for (const item of items) {
        if (isNonMeasurement(item)) continue;
        const open = openByItem.get(item.id) || [], reservation = inspectOpenExecutionReservations(open);
        if (reservation.mode === 'RESERVED_OPEN') {
            continuingReservedOpenWorkItems.push({ workItemId: item.id, sampleId: item.sampleId, analysis: item.analysis,
                attemptId: reservation.attemptId, retainedOrderLineId: open[0].orderLineId });
            continue;
        }
        if (reservation.mode === 'AMBIGUOUS_OPEN') {
            ambiguousOpenReservations.push({ workItemId: item.id, sampleId: item.sampleId, attemptIds: reservation.attemptIds });
            continue;
        }
        const result = chooseOrderLine(item, groups.get(item.sampleId) || []);
        if (result.cause) {
            const cause = result.cause === 'NO_LINE' && isFractionOwner(item) ? 'FRACTION_OWNER_LINE_REQUIRED' : result.cause;
            refusalCounts[cause]++; refused.push({ workItemId: item.id, sampleId: item.sampleId, analysis: item.analysis,
                cause, orderLineCause: result.cause, ...(result.contextCause && {contextCause:result.contextCause}) });
        }
    }
    const noActiveRevisionWorkItems=refused.filter(item=>item.contextCause==='NO_ACTIVE_REVISION');
    const noMatchingLineWorkItems=refused.filter(item=>item.contextCause==='NO_MATCHING_LINE');
    const prospectiveApprovedAmendmentRefusals=[];
    for(const item of db.prepare("SELECT w.id,w.sampleId,w.analysis,s.status AS sampleStatus FROM WorkItem w JOIN Sample s ON s.id=w.sampleId WHERE w.status='ACCEPTED' AND w.duplicateOf IS NULL ORDER BY w.id").iterate()) {
        if(isNonMeasurement(item) || !(item.sampleStatus==='REPORTED' ||
            ['APPROVED','ARCHIVED','DISPOSED'].includes(workflow.normalizeSampleState(item.sampleStatus)))) continue;
        const result=chooseOrderLine(item,groups.get(item.sampleId)||[]);
        if(result.cause) prospectiveApprovedAmendmentRefusals.push({workItemId:item.id,sampleId:item.sampleId,
            sampleStatus:item.sampleStatus,analysis:item.analysis,cause:result.cause,
            ...(result.contextCause && {contextCause:result.contextCause})});
    }
    const approvedAmendmentSampleIds=[...new Set(prospectiveApprovedAmendmentRefusals.map(item=>item.sampleId))].sort();
    const ownersBySample = new Map(), sampleTargets = new Map();
    // Read fraction owners and their stored selections in one indexed join.
    // Keep owner objects and first-owner ordering identical to the legacy report.
    for (const row of db.prepare("SELECT w.id,w.sampleId,w.analysis,w.status,s.id AS storedSampleId,s.requiredAnalyses FROM WorkItem w LEFT JOIN Sample s ON s.id=w.sampleId WHERE w.analysis IN ('SAND','SILT','CLAY') AND w.status<>'WAIVED' ORDER BY w.id").iterate()) {
        const { storedSampleId, requiredAnalyses, ...item } = row;
        if (!ownersBySample.has(item.sampleId)) {
            ownersBySample.set(item.sampleId, []);
            sampleTargets.set(item.sampleId, storedSampleId === null ? undefined : { requiredAnalyses });
        }
        ownersBySample.get(item.sampleId).push(item);
    }
    const incompleteTextureOwners = [], invalidStoredAnalyses = [];
    for (const [sampleId, owners] of ownersBySample) {
        const raw = sampleTargets.get(sampleId).requiredAnalyses;
        let target;
        try { target = normalizedSelection(typeof raw === 'string' ? JSON.parse(raw) : raw || [], true); }
        catch (error) {
            if (!(error instanceof SyntaxError) && error.code !== 'INVALID_STORED_ANALYSES') throw error;
            invalidStoredAnalyses.push({ sampleId, cause: 'INVALID_STORED_ANALYSES', workItemIds: owners.map(item => item.id) });
            continue;
        }
        const result = inspectTextureOwners(owners, target);
        if (result.missingFractions.length) incompleteTextureOwners.push({ sampleId,
            workItemIds: result.owners.map(item => item.id), missingFractions: result.missingFractions });
    }
    return { multipleActiveSampleCount: multipleActive.length, multipleActive, refusalCounts, refusedOpenWorkItems: refused,
        noActiveRevisionCount:noActiveRevisionWorkItems.length,noActiveRevisionWorkItems,
        noMatchingLineCount:noMatchingLineWorkItems.length,noMatchingLineWorkItems,
        prospectiveApprovedAmendmentRefusalCount:prospectiveApprovedAmendmentRefusals.length,
        prospectiveApprovedAmendmentSampleCount:approvedAmendmentSampleIds.length,approvedAmendmentSampleIds,prospectiveApprovedAmendmentRefusals,
        approvedAmendmentKitGate:approvedAmendmentSampleIds.length?'STOP_APPROVED_AMENDMENT_REMEDIATION_REQUIRED':'NO_APPROVED_AMENDMENT_REFUSALS',
        fractionOwnerRefusalCount: refusalCounts.FRACTION_OWNER_LINE_REQUIRED,
        incompleteTextureOwnerSampleCount: incompleteTextureOwners.length, incompleteTextureOwners,
        invalidStoredAnalysisSampleCount: invalidStoredAnalyses.length, invalidStoredAnalyses,
        continuingReservedOpenCount: continuingReservedOpenWorkItems.length, continuingReservedOpenWorkItems,
        ambiguousOpenReservationCount: ambiguousOpenReservations.length, ambiguousOpenReservations,
        refusalScope: 'Open measurement work requiring a new attempt INSERT; existing OPEN reservations reported separately' };
}

function snapshot(db, prior = null) {
    const result = {};
    const tables = prior ? Object.keys(prior) : db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.name);
    for (const table of tables) {
        const columns = prior ? prior[table].columns : db.prepare('PRAGMA table_xinfo(' + quote(table) + ')').all().filter(row => row.hidden === 0).map(row => row.name);
        const selected = columns.map(quote).join(','), stream = createHash('sha256'); let count = 0;
        const where = table === '_schema_migrations' ? ' WHERE id<>?' : '';
        for (const row of db.prepare('SELECT ' + selected + ' FROM ' + quote(table) + where + ' ORDER BY ' + selected).iterate(...(where ? [MARKER] : []))) {
            stream.update(JSON.stringify(columns.map(column => row[column])) + '\n'); count++;
        }
        result[table] = { columns, count, sha256: stream.digest('hex') };
    }
    return result;
}

function installOrderRevisions({ dbPath, apply = false } = {}) {
    if (typeof dbPath !== 'string' || !dbPath.trim() || !fs.existsSync(dbPath)) throw fail('ORDER_REVISION_DATABASE_REQUIRED', 'Provide an existing explicit database path.');
    const target = path.resolve(dbPath), source = loadOrderRevisionMigrationSource();
    // This prerequisite's retained-copy classification never opens the original target.
    const policy = require('./install_lab_policy_schema').assertLabPolicyStartupReady(target);
    const copy = policy.readonlySnapshot.path;
    require('./install_control_charts').assertControlChartStartupReady(copy);
    const reader = new Database(copy, { readonly: true, fileMustExist: true }); let reviewed, counts;
    try { reader.transaction(() => { reviewed = classify(reader, source); counts = impact(reader); })(); }
    finally { reader.close(); }
    if (JSON.stringify(fileHashes(target)) !== JSON.stringify(policy.readonlySnapshot.originalDbWalShmSha256)) {
        throw fail('ORDER_REVISION_SNAPSHOT_CHANGED', 'Database files changed during order classification.');
    }
    if (!apply || reviewed.classification === 'COMPLETE_209') return { ...reviewed, mode: apply ? 'NO_OP' : 'DRY_RUN', totalChanges: 0,
        backfilledCount: 0, impact: counts, readonlySnapshot: policy.readonlySnapshot };
    const release = loadOrderRevisionMigrationSource(), db = new Database(target, { fileMustExist: true, timeout: 5000 });
    // Keep the immutable DDL binding in the scanner's existing direct-call form.
    const ddl = loadOrderRevisionMigrationSource();
    try {
        db.pragma('foreign_keys=ON');
        return db.transaction(() => {
            const current = classify(db, release);
            if (current.classification === 'COMPLETE_209') return { ...current, mode: 'NO_OP', totalChanges: 0, backfilledCount: 0, impact: impact(db) };
            const before = snapshot(db);
            if (current.classification === 'PRE_209') db.exec(ddl.sql);
            else {
                const index = releaseObjects(release).find(row => row.type === 'index');
                const indexSql = 'CREATE INDEX "OrderLine_workItemId_idx" ON "OrderLine"("workItemId");';
                if (normalize(index.sql) !== normalize(indexSql)) throw fail('ORDER_REVISION_SOURCE_MISMATCH', 'Order index source differs.');
                if (!db.prepare('SELECT 1 FROM sqlite_master WHERE name=?').get(index.name)) db.exec(indexSql);
                db.exec(ddl.guardsSql);
            }
            if (hash(snapshot(db, before)) !== hash(before)) throw fail('ORDER_REVISION_PRESERVATION_REFUSED', 'Order installation changed retained rows.');
            const receipt = { sourceSha256: source.sha256, originalRowsSha256: hash(before), originalRowsPreserved: true, backfilledCount: 0 };
            receipt.receiptSha256 = hash(receipt);
            db.prepare('INSERT INTO _schema_migrations(id,details) VALUES(?,?)').run(MARKER, JSON.stringify(receipt));
            return { ...classify(db, release), previousClassification: current.classification, mode: 'APPLIED', originalRowsPreserved: true,
                backfilledCount: 0, totalChanges: db.prepare('SELECT total_changes() n').get().n, impact: impact(db) };
        }).immediate();
    } finally { db.close(); }
}

function assertOrderRevisionStartupReady(dbPath) {
    const result = installOrderRevisions({ dbPath });
    if (result.classification !== 'COMPLETE_209') throw fail('ORDER_REVISION_STARTUP_REQUIRED', 'Run the reviewed order-revision installer before starting the lab.');
    return result;
}
function parseArguments(args) {
    const options = { apply: false }, seen = new Set();
    for (let i = 0; i < args.length; i++) {
        const arg = args[i]; if (seen.has(arg)) throw fail('ORDER_REVISION_ARGUMENT_INVALID', 'Repeated argument.'); seen.add(arg);
        if (arg === '--apply') options.apply = true;
        else if (arg === '--dry-run') continue;
        else if (arg === '--db' && args[i + 1] && !args[i + 1].startsWith('--')) options.dbPath = args[++i];
        else throw fail('ORDER_REVISION_ARGUMENT_INVALID', 'Unknown or incomplete argument.');
    }
    if (!options.dbPath || seen.has('--apply') && seen.has('--dry-run')) throw fail('ORDER_REVISION_ARGUMENT_INVALID', 'Provide --db and one mode.');
    return options;
}
if (require.main === module) {
    try { process.stdout.write(JSON.stringify(installOrderRevisions(parseArguments(process.argv.slice(2))), null, 2) + '\n'); }
    catch (error) { process.stderr.write(JSON.stringify({ error: error.code || 'ORDER_REVISION_INSTALL_REFUSED', message: error.message, differences: error.differences || [], totalChanges: 0 }) + '\n'); process.exitCode = 1; }
}
module.exports = { installOrderRevisions, assertOrderRevisionStartupReady, parseArguments };
