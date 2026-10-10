#!/usr/bin/env node
// #191 release blocker: legacy ACCEPTED work whose acceptance pre-dates attempt
// review keeps a RECORDED owner. YY's decision (LIMS audit thread, 2026-10-10
// 20:00 UTC, "Link recorded accept") links the existing recorded ACCEPT
// decision to that attempt between the #190 and #191 installers. Nothing is
// inferred from free text: the work item's own stored ACCEPT review decision is
// the only evidence, and the operator names every work item it may change.
const path = require('node:path'), Database = require('better-sqlite3');
const { randomUUID, createHash } = require('node:crypto');
const { inventorySubmittedRecordedOwners } = require('../services/workRepeatBackfillPlan');
const { fingerprintRows, fingerprintRetainedTables } = require('../services/retainedRowsFingerprint');

const RECONCILIATION = '191-recorded-acceptance-link-v1';
const ACTOR = 'system:release-191-acceptance-link';
const fail = (code, message, details = {}) => Object.assign(new Error(message), { code, totalChanges: 0, ...details });
const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function instant(value) {
    if (value === null || value === undefined || value === '') return null;
    const text = String(value);
    // SQLite CURRENT_TIMESTAMP text carries no zone and is UTC; never read it as host-local time.
    const time = typeof value === 'number' || /^\d+$/.test(text) ? Number(value)
        : Date.parse(/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d(:\d\d(\.\d+)?)?$/.test(text) ? text.replace(' ', 'T') + 'Z' : text);
    return Number.isFinite(time) ? time : null;
}

function assertPrerequisites(db) {
    const attempt = new Set(db.prepare('PRAGMA table_xinfo("WorkAttempt")').all().map(row => row.name));
    if (!['id', 'workItemId', 'status', 'reason', 'legacyAttemptNoConflict'].every(name => attempt.has(name)) ||
        !db.prepare('SELECT name FROM sqlite_master WHERE type=\'trigger\' AND name=\'WorkAttempt_status_update\'').get()) {
        throw fail('ACCEPTANCE_LINK_PREREQUISITE_NOT_INSTALLED', 'Install the reviewed #190 attempt contract first.');
    }
    // #191 replaces direct RECORDED -> ACCEPTED with reviewed transitions; this
    // reconciliation belongs strictly before it.
    if (db.prepare('SELECT name FROM sqlite_master WHERE type=\'trigger\' AND name=\'WorkAttempt_status_transition_update\'').get()) {
        throw fail('ACCEPTANCE_LINK_AFTER_191_REFUSED', 'Run this reconciliation before the #191 installer.');
    }
}

function linkedEvents(db) {
    return db.prepare('SELECT id, entityId, details FROM "AuditLog" WHERE "entity"=\'WORK_ATTEMPT\' AND "action"=\'ACCEPTED\' AND "performedBy"=? ORDER BY id')
        .all(ACTOR).flatMap(row => {
            let details; try { details = JSON.parse(row.details); } catch (_) { return []; }
            return details?.reconciliation === RECONCILIATION ? [{ eventId: row.id, attemptId: row.entityId, ...details }] : [];
        });
}

function assess(db, blocked) {
    const reasons = [];
    const item = db.prepare('SELECT id, sampleId, analysis, status, reviewedAt, reviewDecision FROM "WorkItem" WHERE id=?').get(blocked.workItemId);
    if (item.status !== 'ACCEPTED') reasons.push('WORK_ITEM_NOT_ACCEPTED');
    if (blocked.owners.length !== 1) reasons.push('MULTIPLE_RECORDED_OWNERS');
    const owner = blocked.owners[0];
    const attempt = db.prepare('SELECT id, status, createdAt FROM "WorkAttempt" WHERE id=?').get(owner.attemptId);
    if (item.reviewDecision !== 'ACCEPT' || instant(item.reviewedAt) === null) reasons.push('WORK_ITEM_REVIEW_NOT_RECORDED');
    const decisions = db.prepare('SELECT id, decision, attemptId, reviewerId, createdAt FROM "ReviewDecision" WHERE "workItemId"=? ORDER BY id').all(item.id)
        .sort((a, b) => (instant(a.createdAt) - instant(b.createdAt)) || (a.id < b.id ? -1 : 1));
    const decision = decisions[decisions.length - 1];
    if (!decision || decision.decision !== 'ACCEPT') reasons.push('LATEST_DECISION_NOT_ACCEPT');
    else {
        if (decision.attemptId !== null) reasons.push('DECISION_ALREADY_NAMES_ATTEMPT');
        if (instant(decision.createdAt) !== instant(item.reviewedAt)) reasons.push('DECISION_TIME_DIFFERS_FROM_REVIEW');
        if (decisions.filter(row => instant(row.createdAt) === instant(decision.createdAt)).length !== 1) reasons.push('DECISION_TIME_AMBIGUOUS');
        if (instant(attempt.createdAt) === null || instant(decision.createdAt) < instant(attempt.createdAt)) reasons.push('DECISION_PRECEDES_ATTEMPT');
        const results = db.prepare('SELECT id, createdAt FROM "Result" WHERE "attemptId"=? AND "isCurrent"=1 ORDER BY id').all(attempt.id);
        if (results.some(row => instant(row.createdAt) === null || instant(decision.createdAt) < instant(row.createdAt))) reasons.push('DECISION_PRECEDES_RESULT');
    }
    return { workItemId: item.id, sampleId: item.sampleId, analysis: item.analysis, attemptId: attempt.id,
        resultIds: [...owner.resultIds], reviewDecisionId: decision?.id || null, reviewedAt: item.reviewedAt,
        decisionCreatedAt: decision?.createdAt ?? null, reasons };
}

function plan(db) {
    assertPrerequisites(db);
    const inventory = inventorySubmittedRecordedOwners(db);
    const assessed = inventory.blockedWorkItems.map(blocked => assess(db, blocked));
    const eligible = assessed.filter(row => !row.reasons.length).map(({ reasons, ...row }) => row);
    const unresolved = assessed.filter(row => row.reasons.length);
    // The digest binds apply to the exact reviewed evidence tuple, not only to the item ids.
    const planSha256 = fingerprint({ reconciliation: RECONCILIATION, blockedWorkItemCount: inventory.blockedWorkItemCount, eligible, unresolved });
    return { reconciliation: RECONCILIATION, blockedWorkItemCount: inventory.blockedWorkItemCount, eligible, unresolved,
        planSha256, alreadyLinked: linkedEvents(db) };
}

function retainedRows(db, { acceptedAttemptIds = [], newEventIds = [] } = {}) {
    const accepted = new Set(acceptedAttemptIds);
    const tables = fingerprintRetainedTables(db, { excludeTables: ['AuditLog'], orderBy: 'rowid',
        transformRow: (table, row) => table === 'WorkAttempt' && accepted.has(row.id) ? { ...row, status: 'ACCEPTED' } : row });
    const auditLog = fingerprintRows(db.prepare('SELECT * FROM "AuditLog" WHERE "id" NOT IN (SELECT value FROM json_each(?)) ORDER BY rowid')
        .iterate(JSON.stringify(newEventIds)));
    return fingerprint({ tables, auditLog });
}

function sameScope(expected, eligible) {
    return JSON.stringify([...new Set(expected)].sort()) === JSON.stringify(eligible.map(row => row.workItemId).sort()) &&
        new Set(expected).size === expected.length;
}

function linkRecordedAcceptance({ dbPath, apply = false, workItemIds = [], planSha256 } = {}) {
    if (typeof dbPath !== 'string' || !dbPath.trim()) throw fail('ACCEPTANCE_LINK_DATABASE_REQUIRED', 'An explicit database path is required.');
    const target = path.resolve(dbPath);
    const reader = new Database(target, { readonly: true, fileMustExist: true });
    let before;
    try { before = reader.transaction(() => plan(reader))(); } finally { reader.close(); }
    if (!apply) return { ...before, mode: 'DRY_RUN', totalChanges: 0 };
    if (!before.eligible.length && !before.unresolved.length) {
        if (!workItemIds.every(id => before.alreadyLinked.some(row => row.workItemId === id))) {
            throw fail('ACCEPTANCE_LINK_SCOPE_MISMATCH', 'The named work items are neither eligible nor already linked.', { plan: before });
        }
        return { ...before, mode: 'NO_OP', totalChanges: 0 };
    }
    if (before.unresolved.length) throw fail('ACCEPTANCE_LINK_UNRESOLVED', 'Some blocked work has no single recorded acceptance to link.', { plan: before });
    if (!sameScope(workItemIds, before.eligible)) throw fail('ACCEPTANCE_LINK_SCOPE_MISMATCH', 'Name exactly the eligible work items with --work-item.', { plan: before });
    if (planSha256 !== before.planSha256) throw fail('ACCEPTANCE_LINK_PLAN_MISMATCH', 'Apply requires the reviewed dry-run planSha256.', { plan: before });
    const db = new Database(target, { fileMustExist: true, timeout: 5000 });
    try {
        db.pragma('foreign_keys=ON');
        return db.transaction(() => {
            const current = plan(db);
            if (current.planSha256 !== planSha256 || current.unresolved.length || !sameScope(workItemIds, current.eligible)) {
                throw fail('ACCEPTANCE_LINK_STATE_CHANGED', 'The database changed since the dry-run; re-run it.', { plan: current });
            }
            const acceptedAttemptIds = current.eligible.map(row => row.attemptId);
            const expected = retainedRows(db, { acceptedAttemptIds });
            const now = new Date().toISOString(), newEventIds = [], links = [];
            for (const row of current.eligible) {
                const item = db.prepare('SELECT labId, assignedLab FROM "WorkItem" WHERE id=?').get(row.workItemId);
                const changed = db.prepare('UPDATE "WorkAttempt" SET "status"=\'ACCEPTED\' WHERE "id"=? AND "workItemId"=? AND "status"=\'RECORDED\'')
                    .run(row.attemptId, row.workItemId);
                if (changed.changes !== 1) throw fail('ACCEPTANCE_LINK_STATE_CHANGED', 'The attempt changed; re-run the dry-run.');
                const eventId = randomUUID();
                const note = `Links recorded ReviewDecision ${row.reviewDecisionId} (reviewedAt ${row.reviewedAt}); acceptance pre-dated attempt review.`;
                db.prepare(`INSERT INTO "AuditLog" (id, entity, entityId, action, details, performedBy, performedByName, timestamp,
                    sampleId, labId, analysisCode, before, after) VALUES (?, 'WORK_ATTEMPT', ?, 'ACCEPTED', ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                    .run(eventId, row.attemptId, JSON.stringify({ from: 'RECORDED', to: 'ACCEPTED', reason: null, note, resultId: null,
                        oldResultIds: [], newResultIds: [], reviewDecisionId: row.reviewDecisionId, reconciliation: RECONCILIATION,
                        workItemId: row.workItemId, linkedResultIds: row.resultIds }),
                    ACTOR, ACTOR, now, row.sampleId, item?.labId || item?.assignedLab || null, row.analysis,
                    JSON.stringify({ status: 'RECORDED', resultIds: [] }), JSON.stringify({ status: 'ACCEPTED', resultIds: [] }));
                newEventIds.push(eventId);
                links.push({ ...row, eventId });
            }
            if (retainedRows(db, { newEventIds }) !== expected) throw fail('ACCEPTANCE_LINK_PRESERVATION_REFUSED', 'The link changed other retained evidence.');
            const after = plan(db);
            const remaining = new Set(after.eligible.concat(after.unresolved).map(row => row.workItemId));
            if (links.some(row => remaining.has(row.workItemId)) || db.pragma('integrity_check', { simple: true }) !== 'ok' ||
                db.pragma('foreign_key_check').length) {
                throw fail('ACCEPTANCE_LINK_INTEGRITY_REFUSED', 'The link failed its post-checks.');
            }
            const receipt = { reconciliation: RECONCILIATION, planSha256, links, originalRowsSha256: expected, originalRowsAndFieldsPreserved: true,
                attemptStatusChanges: links.length, auditEventsAdded: links.length };
            receipt.receiptSha256 = fingerprint(receipt);
            return { ...after, mode: 'APPLIED', receipt, totalChanges: db.prepare('SELECT total_changes() n').get().n };
        }).immediate();
    } finally { db.close(); }
}

function parseArguments(args) {
    const options = { apply: false, workItemIds: [] }, seen = new Set();
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg !== '--work-item' && seen.has(arg)) throw fail('ACCEPTANCE_LINK_ARGUMENT_INVALID', 'Repeated argument.');
        seen.add(arg);
        if (arg === '--apply') options.apply = true;
        else if (arg === '--dry-run') continue;
        else if (arg === '--db' && args[i + 1] && !args[i + 1].startsWith('--')) options.dbPath = args[++i];
        else if (arg === '--work-item' && args[i + 1] && !args[i + 1].startsWith('--')) options.workItemIds.push(args[++i]);
        else if (arg === '--plan-sha256' && /^[0-9a-f]{64}$/.test(args[i + 1] || '')) options.planSha256 = args[++i];
        else throw fail('ACCEPTANCE_LINK_ARGUMENT_INVALID', 'Unknown or incomplete argument.');
    }
    if (!options.dbPath || seen.has('--apply') && seen.has('--dry-run')) throw fail('ACCEPTANCE_LINK_ARGUMENT_INVALID', 'Provide --db and one execution mode.');
    if (options.apply && (!options.workItemIds.length || !options.planSha256)) {
        throw fail('ACCEPTANCE_LINK_ARGUMENT_INVALID', 'Apply requires every --work-item it may change and the reviewed --plan-sha256.');
    }
    return options;
}

if (require.main === module) {
    try { process.stdout.write(JSON.stringify(linkRecordedAcceptance(parseArguments(process.argv.slice(2))), null, 2) + '\n'); }
    catch (error) {
        process.stderr.write(JSON.stringify({ error: error.code || 'ACCEPTANCE_LINK_REFUSED', message: error.message,
            plan: error.plan || null, totalChanges: error.totalChanges ?? 0 }) + '\n'); process.exitCode = 1;
    }
}
module.exports = { linkRecordedAcceptance, parseArguments, RECONCILIATION, ACTOR };
