const path = require('node:path');
const Database = require('better-sqlite3');
const workflow = require('../workflowContract');
const plans = require('./statusMigrationPlan');
const { TransitionError } = require('./workflowStateRules');
const guardSql = require('./workflowMigrationSources').loadWorkflowMigrationSources().guards.sql;
const requiredGuards = [...guardSql.matchAll(/CREATE TRIGGER "([^"]+)"/g)].map(match => match[1]);

function timestamp(value) {
    // SQLite CURRENT_TIMESTAMP has no zone suffix; Prisma reads it as UTC.
    const input = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value)
        ? `${value.replace(' ', 'T')}Z` : value;
    const date = new Date(input);
    if (value == null || !Number.isFinite(date.getTime())) throw new TransitionError('A stored timestamp cannot be reviewed safely.', 409, 'STATUS_MIGRATION_DATE_INVALID');
    return date.toISOString();
}

function mappingCounts(rows) {
    const groups = new Map();
    for (const row of rows) {
        const key = JSON.stringify([row.entity, row.from, row.to]);
        const group = groups.get(key) || { entity: row.entity, from: row.from, to: row.to, count: 0 };
        group.count++;
        groups.set(key, group);
    }
    return [...groups.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, value]) => value);
}

function buildReport(sampleRows, workRows, direction = 'apply') {
    if (!['apply', 'revert'].includes(direction)) throw new TransitionError('Unknown migration direction.', 400, 'STATUS_MIGRATION_DIRECTION_INVALID');
    const rows = [], unmapped = [], blocked = [];
    for (const [entity, records, map, allowed] of [
        ['Sample', sampleRows, workflow.LEGACY_SAMPLE_STATE_MAP, workflow.SAMPLE_STATE_LIST],
        ['WorkItem', workRows, workflow.LEGACY_WORK_ITEM_STATE_MAP, workflow.WORK_ITEM_STATE_LIST]
    ]) for (const row of records) {
        const original = row.legacyStatus ?? null;
        let to = null;
        if (direction === 'revert' && original !== null) {
            if (map[original] === row.status) to = original;
            else blocked.push({ entity, id: row.id, status: row.status, legacyStatus: original, code: 'CURRENT_MAPPED_STATE_REQUIRED' });
        } else if (direction === 'apply' && Object.hasOwn(map, row.status)) {
            if (original === null) to = map[row.status];
            else blocked.push({ entity, id: row.id, status: row.status, legacyStatus: original, code: 'LEGACY_MARKER_PRESENT' });
        }
        if (to !== null) rows.push({ entity, id: row.id, from: row.status, to, legacyStatus: original,
            updatedAt: timestamp(row.updatedAt), ...(entity === 'WorkItem' && { version: row.version }) });
        else if (!allowed.includes(row.status) && !Object.hasOwn(map, row.status)) unmapped.push({ entity, id: row.id, status: row.status });
    }
    const plan = plans.canonicalPlan({ direction, rows });
    return { direction, totals: { Sample: sampleRows.length, WorkItem: workRows.length }, candidateCount: rows.length,
        mappings: mappingCounts(rows), unmappedCount: unmapped.length, unmapped, blockedCount: blocked.length, blocked,
        fingerprint: plans.planFingerprint(plan), plan };
}

/** Always read-only, including databases that predate the additive schema. */
function inspectDatabase(databasePath, direction = 'apply') {
    if (typeof databasePath !== 'string' || !databasePath.trim()) throw new TransitionError('An explicit database path is required.', 400, 'STATUS_MIGRATION_DATABASE_REQUIRED');
    const db = new Database(path.resolve(databasePath), { readonly: true, fileMustExist: true });
    try {
        return db.transaction(() => {
            const columns = table => db.prepare(`PRAGMA table_info("${table}")`).all().map(row => row.name);
            const sampleColumns = columns('Sample'), workColumns = columns('WorkItem');
            const query = (table, names) => db.prepare(`SELECT id, status, updatedAt, ${names.includes('legacyStatus') ? 'legacyStatus' : 'NULL AS legacyStatus'}${table === 'WorkItem' ? ', version' : ''} FROM "${table}" ORDER BY id`).all();
            const report = buildReport(query('Sample', sampleColumns), query('WorkItem', workColumns), direction);
            report.legacyGateInventoryAvailable = ['assignedLab', 'dryingStatus', 'preparationStatus'].every(name => sampleColumns.includes(name)) &&
                ['sampleId', 'analysis'].every(name => workColumns.includes(name));
            report.legacyGateEvidence = report.legacyGateInventoryAvailable ? db.prepare(`
                SELECT s.assignedLab AS labId,
                    COUNT(*) AS sampleCount,
                    SUM(CASE WHEN s.dryingStatus = 'DONE' AND NOT EXISTS
                        (SELECT 1 FROM WorkItem w WHERE w.sampleId = s.id AND w.analysis = 'DRYING') THEN 1 ELSE 0 END) AS dryingCount,
                    SUM(CASE WHEN s.preparationStatus = 'DONE' AND NOT EXISTS
                        (SELECT 1 FROM WorkItem w WHERE w.sampleId = s.id AND w.analysis = 'PREPARATION') THEN 1 ELSE 0 END) AS preparationCount
                FROM Sample s
                WHERE (s.dryingStatus = 'DONE' AND NOT EXISTS
                    (SELECT 1 FROM WorkItem w WHERE w.sampleId = s.id AND w.analysis = 'DRYING'))
                    OR (s.preparationStatus = 'DONE' AND NOT EXISTS
                    (SELECT 1 FROM WorkItem w WHERE w.sampleId = s.id AND w.analysis = 'PREPARATION'))
                GROUP BY s.assignedLab ORDER BY s.assignedLab
            `).all() : [];
            const installed = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='trigger'").all().map(row => row.name));
            report.schemaReady = [sampleColumns, workColumns].every(names => ['legacyStatus', 'holdPriorStatus'].every(name => names.includes(name))) &&
                !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='ResultEvidenceEvent'").get() && requiredGuards.every(name => installed.has(name));
            return report;
        })();
    } finally { db.close(); }
}

async function applyReviewedPlan(db, rawPlan, reviewedFingerprint, options = {}) {
    const plan = plans.reviewPlan(rawPlan, reviewedFingerprint);
    const transactionOptions = options.timeoutMs == null ? undefined : { timeout: options.timeoutMs };
    return db.$transaction(async tx => {
        const installed = await tx.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='trigger'");
        if (!requiredGuards.every(name => installed.some(row => row.name === name))) {
            throw new TransitionError('Install the complete additive state schema and guards before applying the reviewed plan.', 409, 'STATUS_MIGRATION_SCHEMA_REQUIRED');
        }
        const fresh = buildReport(await tx.sample.findMany({ select: { id: true, status: true, legacyStatus: true, updatedAt: true } }),
            await tx.workItem.findMany({ select: { id: true, status: true, legacyStatus: true, updatedAt: true, version: true } }), plan.direction);
        if (fresh.fingerprint !== reviewedFingerprint || fresh.blockedCount) {
            throw new TransitionError('The complete status plan changed after review; run a new dry run.', 409, 'STATUS_MIGRATION_PLAN_STALE', { blocked: fresh.blocked });
        }
        const actor = 'system:status-migration', reason = `Reviewed status migration ${plan.direction} at ${reviewedFingerprint}`;
        const samples = require('./sampleStateService'), work = require('./workItemStateService');
        for (const row of plan.rows) {
            if (row.entity === 'Sample') await samples.transitionSample(row.id, row.to, actor, reason, {}, tx, { migrationPlan: plan });
            else await work.transitionWorkItem(row.id, row.to, actor, reason, {}, tx, { migrationPlan: plan });
        }
        return { direction: plan.direction, fingerprint: reviewedFingerprint, changedRows: plan.rows.length, auditsAdded: plan.rows.length,
            mappings: fresh.mappings, unmappedCount: fresh.unmappedCount, unmapped: fresh.unmapped };
    }, transactionOptions);
}

module.exports = { buildReport, inspectDatabase, applyReviewedPlan };
