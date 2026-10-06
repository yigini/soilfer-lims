#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const Database = require('better-sqlite3');
const { assertSampleHoldStartupReady } = require('./install_sample_holds');
const { legacyHoldState, ACTIVE, COMPAT } = require('../services/sampleHoldService');
const { hasPermission } = require('../config/roles');
const scopeGuard = require('../utils/scopeGuard');
const PREFIXES = ['REVISED_FIELD_EVIDENCE:', 'CONFLICTING_FIELD_SUBMISSIONS:', 'INTRA_SUBMISSION_DUPLICATE_DEPTH:'];
// The scope pin permits at most 24 hours of historical clock skew.
const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;
const digest = value => createHash('sha256').update(value).digest('hex');
const fail = (code, message, plan = null) => Object.assign(new Error(message), { code, plan });

function isoTimestamp(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
    const [, year, month, day, hour, minute, second] = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/).map(Number);
    if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || hour > 23 || minute > 59 || second > 59) return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function storedTimestamp(value) {
    if (typeof value === 'number') return Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : null;
    if (typeof value !== 'string') return null;
    const stored = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/.test(value) ? value.replace(' ', 'T') + 'Z' : value;
    return isoTimestamp(stored);
}
function validateTime(value, sample, now) {
    const createdAt = storedTimestamp(sample.createdAt);
    if (!value) return 'HOLD_TIMESTAMP_INVALID';
    if (new Date(value) > now) return 'HOLD_TIMESTAMP_FUTURE';
    if (!createdAt || new Date(value).getTime() < new Date(createdAt).getTime() - MAX_CLOCK_SKEW_MS) return 'HOLD_TIMESTAMP_BEFORE_SAMPLE';
    return null;
}

function readMapping(file, sha256) {
    if (!file && !sha256) return { rows: [], sha256: null };
    if (!file || !/^[a-f0-9]{64}$/.test(sha256 || '')) throw fail('HOLD_MAPPING_SHA_REQUIRED', 'A mapping file requires its reviewed SHA256.');
    const bytes = fs.readFileSync(path.resolve(file));
    if (digest(bytes) !== sha256) throw fail('HOLD_MAPPING_SHA_MISMATCH', 'The reviewed mapping bytes changed.');
    let document;
    try { document = JSON.parse(bytes); } catch { throw fail('HOLD_MAPPING_INVALID', 'The reviewed mapping must be JSON.'); }
    if (!document || !Array.isArray(document.rows) || Object.keys(document).some(key => key !== 'rows')) throw fail('HOLD_MAPPING_INVALID', 'Use a mapping document with only rows.');
    const seen = new Set();
    for (const row of document.rows) {
        if (!row || typeof row.sampleId !== 'string' || !row.sampleId || seen.has(row.sampleId) ||
            !/^[a-f0-9]{64}$/.test(row.fingerprint || '') || Object.keys(row).some(key => !['sampleId', 'fingerprint', 'raisedAt', 'raisedBy', 'holdReason', 'reviewer', 'reviewReason'].includes(key)) ||
            ['raisedBy', 'holdReason', 'reviewer', 'reviewReason'].some(key => typeof row[key] !== 'string' || !row[key].trim()) || !isoTimestamp(row.raisedAt)) throw fail('HOLD_MAPPING_INVALID', 'Every reviewed row requires exact identity, fingerprint, attribution, reviewer and reasons.');
        seen.add(row.sampleId);
    }
    return { rows: document.rows, sha256 };
}

function inventoryLegacyHolds(db, { now = new Date(), mapping = { rows: [], sha256: null } } = {}) {
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw fail('HOLD_BACKFILL_TIME_INVALID', 'A valid run time is required.');
    const rows = [], usedMappings = new Set();
    const auditQuery = db.prepare(`SELECT id,performedBy,timestamp FROM AuditLog WHERE action='KOBO_CONFLICTING_PROVENANCE'
        AND (sampleId=? OR (entity='SAMPLE' AND entityId=?)) ORDER BY id`);
    const holdQuery = db.prepare('SELECT id,attributionSource,resolvedAt FROM SampleHold WHERE sampleId=? AND compatMarker=? ORDER BY id');
    for (const sample of db.prepare('SELECT id,metadata,fieldMetadata,createdAt FROM Sample ORDER BY id').iterate()) {
        const legacy = legacyHoldState(sample);
        if (!legacy.invalid && !Object.hasOwn(legacy.metadata, 'provenanceHold') && !Object.hasOwn(legacy.fieldMetadata, 'provenanceHold')) continue;
        const audits = auditQuery.all(sample.id, sample.id).map(audit => ({ ...audit, rawTimestamp: audit.timestamp, timestamp: storedTimestamp(audit.timestamp) }));
        const bound = holdQuery.all(sample.id, COMPAT);
        const fingerprint = digest(JSON.stringify({ sample, audits, bound }));
        const row = { sampleId: sample.id, fingerprint, action: 'SKIP_RESOLVED', diagnostics: [], refusals: [], proposed: null,
            metadataRepairNeeded: legacy.metadataRepairNeeded };
        if (!legacy.fieldMetadata && !legacy.marker) {
            row.action = 'METADATA_REPAIR_NEEDED';
            row.diagnostics.push('HOLD_MARKER_INVALID');
            rows.push(row); continue;
        }
        if (!legacy.active) {
            if (bound.some(hold => hold.attributionSource !== 'LIVE')) row.action = 'ALREADY_BACKFILLED';
            rows.push(row); continue;
        }
        if (!bound.some(hold => !hold.resolvedAt)) row.diagnostics.push('HOLD_MARKER_INCONSISTENT');
        if (bound.some(hold => hold.attributionSource !== 'LIVE')) {
            row.action = 'ALREADY_BACKFILLED';
            rows.push(row); continue;
        }
        if (bound.some(hold => !hold.resolvedAt)) { row.action = 'BOUND_LIVE_HOLD'; rows.push(row); continue; }
        row.action = 'BACKFILL';
        if (legacy.invalid) row.refusals.push('HOLD_MARKER_INVALID');
        if (!legacy.marker) row.refusals.push('HOLD_METADATA_MARKER_MISSING');
        if (legacy.marker?.status !== ACTIVE) row.refusals.push('HOLD_STATUS_UNKNOWN');
        if (typeof legacy.marker?.reason !== 'string' || !PREFIXES.some(prefix => legacy.marker.reason.startsWith(prefix))) row.refusals.push('HOLD_REASON_UNKNOWN');
        if (legacy.mirror && (legacy.mirror.value !== ACTIVE || legacy.mirror.source !== 'KOBO')) row.refusals.push('HOLD_MIRROR_UNKNOWN');
        const validAudits = audits.filter(audit => audit.timestamp).sort((left, right) => new Date(left.timestamp) - new Date(right.timestamp) || left.id.localeCompare(right.id));
        if (audits.some(audit => !audit.timestamp)) row.refusals.push('HOLD_AUDIT_TIMESTAMP_INVALID');
        const audit = validAudits[0];
        const raisedAt = audit?.timestamp || isoTimestamp(legacy.marker?.updatedAt);
        const timeRefusal = validateTime(raisedAt, sample, now);
        if (timeRefusal) row.refusals.push(timeRefusal);
        const raisedBy = 'system:kobo-sync';
        row.triggeringUser = audit?.performedBy ?? null;
        if (!row.refusals.length) row.proposed = { sampleId: sample.id, type: 'PROVENANCE', reason: legacy.marker.reason,
            raisedBy, raisedAt, attributionSource: audit ? 'KOBO_CONFLICT_AUDIT' : 'LEGACY_HOLD_UPDATED_AT', compatMarker: COMPAT };
        const review = mapping.rows.find(entry => entry.sampleId === sample.id);
        if (review) {
            if (!row.refusals.length || review.fingerprint !== fingerprint || review.raisedBy !== raisedBy || validateTime(isoTimestamp(review.raisedAt), sample, now)) {
                throw fail('HOLD_MAPPING_STALE', 'A mapping row does not match the refused marker and its permissible attribution.');
            }
            usedMappings.add(sample.id);
            row.reviewedRefusals = row.refusals;
            row.refusals = [];
            row.review = { reviewer: review.reviewer, reason: review.reviewReason, mappingSha256: mapping.sha256 };
            row.proposed = { sampleId: sample.id, type: 'PROVENANCE', reason: review.holdReason, raisedBy: review.raisedBy,
                raisedAt: isoTimestamp(review.raisedAt), attributionSource: 'REVIEWED_MAPPING', compatMarker: COMPAT };
        }
        rows.push(row);
    }
    if (mapping.rows.some(row => !usedMappings.has(row.sampleId) && !rows.some(entry => entry.sampleId === row.sampleId && entry.action === 'ALREADY_BACKFILLED'))) throw fail('HOLD_MAPPING_STALE', 'The mapping includes an absent or no-longer-refused marker.');
    const plan = { rows, mappingSha256: mapping.sha256, markerCount: rows.length,
        proposedCount: rows.filter(row => row.proposed).length, refusedCount: rows.filter(row => row.refusals.length).length,
        upperBoundCount: rows.filter(row => row.proposed?.attributionSource === 'LEGACY_HOLD_UPDATED_AT').length };
    plan.metadataRepairNeededCount = rows.filter(row => row.metadataRepairNeeded).length;
    plan.alreadyBackfilledInconsistentCount = rows.filter(row => row.action === 'ALREADY_BACKFILLED' && row.diagnostics.includes('HOLD_MARKER_INCONSISTENT')).length;
    return { ...plan, fingerprint: digest(JSON.stringify(plan)), asOf: now.toISOString(), mode: 'DRY_RUN', totalChanges: 0 };
}

function validateOperator(db, username, rows) {
    if (typeof username !== 'string' || !username.trim() || username !== username.trim() || /^(?:system|service)(?::|_|$)/i.test(username)) {
        throw fail('BACKFILL_OPERATOR_INVALID', 'Apply requires an existing active human operator username.');
    }
    const operator = db.prepare('SELECT * FROM User WHERE username=?').get(username);
    if (!operator || operator.isActive !== 1) throw fail('BACKFILL_OPERATOR_INVALID', 'The operator must be an existing active User.');
    if (!hasPermission(operator, 'APPROVE_RESULTS')) throw fail('BACKFILL_OPERATOR_FORBIDDEN', 'The operator requires APPROVE_RESULTS.');
    // SQLite stores booleans as integers; scopeGuard expects an active User.
    operator.isActive = true;
    for (const row of rows.filter(row => row.proposed)) {
        const sample = db.prepare('SELECT * FROM Sample WHERE id=?').get(row.sampleId);
        try { scopeGuard.ensureScope(operator, sample, { altLabField: 'assignedLab' }); }
        catch { throw fail('BACKFILL_OPERATOR_OUT_OF_SCOPE', 'The operator must be in scope for every proposed sample.'); }
    }
    return operator.username;
}

function backfillSampleHolds({ dbPath, apply = false, mappingPath = null, reviewedMappingSha256 = null, planSha256 = null, operator = null, now = null } = {}) {
    if (typeof dbPath !== 'string' || !dbPath.trim()) throw fail('HOLD_BACKFILL_DATABASE_REQUIRED', 'An explicit database path is required.');
    const target = path.resolve(dbPath), ready = assertSampleHoldStartupReady(target);
    const mapping = readMapping(mappingPath, reviewedMappingSha256);
    const reader = new Database(target, { readonly: true, fileMustExist: true });
    let plan;
    try { plan = reader.transaction(() => inventoryLegacyHolds(reader, { mapping, now: now || new Date() }))(); }
    finally { reader.close(); }
    if (!apply) return plan;
    if (plan.refusedCount) throw fail('HOLD_BACKFILL_MAPPING_REQUIRED', 'Review every refused marker before applying. No rows were changed.', plan);
    if (plan.proposedCount && (!/^[a-f0-9]{64}$/.test(planSha256 || '') || plan.fingerprint !== planSha256)) throw fail('HOLD_BACKFILL_PLAN_STALE', 'Dry-run and review the exact plan before applying. No rows were changed.', plan);
    const db = new Database(target, { fileMustExist: true, timeout: 5000 });
    try {
        db.pragma('foreign_keys = ON');
        return db.transaction(() => {
            const locked = inventoryLegacyHolds(db, { mapping, now: now || new Date() });
            const performedBy = validateOperator(db, operator, locked.rows);
            if (!locked.proposedCount && !locked.refusedCount) return { ...locked, operator: performedBy, mode: 'NO_OP', totalChanges: 0, backfillCount: 0 };
            if (locked.fingerprint !== planSha256 || locked.refusedCount) throw fail('HOLD_BACKFILL_PLAN_STALE', 'The marker inventory changed. No rows were changed.', locked);
            const insert = db.prepare(`INSERT INTO SampleHold (id,sampleId,type,reason,raisedBy,raisedAt,attributionSource,compatMarker) VALUES (?,?,?,?,?,?,?,?)`);
            const audit = db.prepare(`INSERT INTO AuditLog (id,entity,entityId,action,performedBy,sampleId,timestamp,details) VALUES (?,?,?,?,?,?,?,?)`);
            for (const row of locked.rows.filter(row => row.proposed)) {
                const id = randomUUID(), hold = row.proposed;
                insert.run(id, hold.sampleId, hold.type, hold.reason, hold.raisedBy, hold.raisedAt, hold.attributionSource, hold.compatMarker);
                audit.run(randomUUID(), 'SAMPLE_HOLD', id, 'HOLD_BACKFILLED', performedBy, hold.sampleId,
                    (now || new Date()).toISOString(), JSON.stringify({ planSha256, legacyFingerprint: row.fingerprint,
                        attributionSource: hold.attributionSource, triggeringUser: row.triggeringUser,
                        raisedAtIsUpperBound: hold.attributionSource === 'LEGACY_HOLD_UPDATED_AT', review: row.review || null }));
            }
            db.prepare('INSERT INTO "_schema_migrations" (id,details) VALUES (?,?)').run(`183_hold_backfill:${planSha256}`,
                JSON.stringify({ migrationSha256: ready.sources.migrationSha256, planSha256, mappingSha256: mapping.sha256,
                    backfillCount: locked.proposedCount, upperBoundCount: locked.upperBoundCount,
                    metadataRepairNeededCount: locked.metadataRepairNeededCount,
                    alreadyBackfilledInconsistentCount: locked.alreadyBackfilledInconsistentCount, operator: performedBy }));
            if (db.pragma('integrity_check', { simple: true }) !== 'ok' || db.pragma('foreign_key_check').length) throw fail('HOLD_BACKFILL_INTEGRITY_REFUSED', 'The backfill failed integrity checks.');
            return { ...locked, operator: performedBy, mode: 'APPLIED', backfillCount: locked.proposedCount, auditRowsAdded: locked.proposedCount,
                originalMetadataRowsChanged: 0, oldAuditRowsChanged: 0, totalChanges: db.prepare('SELECT total_changes() n').get().n };
        }).immediate();
    } finally { db.close(); }
}

function parseArguments(args) {
    const options = { dbPath: process.env.DATABASE_PATH || path.resolve(__dirname, '../prisma/dev.db'), apply: false }, seen = new Set();
    const values = { '--db': 'dbPath', '--mapping': 'mappingPath', '--reviewed-mapping-sha256': 'reviewedMappingSha256', '--plan-sha256': 'planSha256', '--operator': 'operator' };
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (seen.has(arg)) throw fail('HOLD_BACKFILL_ARGUMENT_INVALID', 'Repeated argument.');
        seen.add(arg);
        if (arg === '--apply') options.apply = true;
        else if (arg === '--dry-run') continue;
        else if (values[arg] && args[i + 1] && !args[i + 1].startsWith('--')) options[values[arg]] = args[++i];
        else throw fail('HOLD_BACKFILL_ARGUMENT_INVALID', 'Unknown or incomplete argument.');
    }
    if (seen.has('--apply') && seen.has('--dry-run')) throw fail('HOLD_BACKFILL_ARGUMENT_INVALID', 'Apply and dry-run are mutually exclusive.');
    return options;
}
if (require.main === module) {
    try { process.stdout.write(`${JSON.stringify(backfillSampleHolds(parseArguments(process.argv.slice(2))), null, 2)}\n`); }
    catch (error) { process.stderr.write(`${JSON.stringify({ error: error.code || 'HOLD_BACKFILL_REFUSED', message: error.message, plan: error.plan || null })}\n`); process.exitCode = 1; }
}
module.exports = { backfillSampleHolds, inventoryLegacyHolds, isoTimestamp, parseArguments };
