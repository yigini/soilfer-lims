const { createHash } = require('node:crypto');
const workflow = require('../workflowContract');
const { TransitionError } = require('./workflowStateRules');
const reviewedPlans = new WeakSet();

function canonicalPlan(plan) {
    if (!plan || !['apply', 'revert'].includes(plan.direction) || !Array.isArray(plan.rows)) {
        throw new TransitionError('A status migration plan is required.', 409, 'STATUS_MIGRATION_PLAN_REQUIRED');
    }
    return { direction: plan.direction, rows: plan.rows.map(row => ({
        entity: row.entity, id: row.id, from: row.from, to: row.to,
        legacyStatus: row.legacyStatus ?? null, updatedAt: new Date(row.updatedAt).toISOString(),
        ...(row.entity === 'WorkItem' && { version: row.version })
    })).sort((a, b) => a.entity.localeCompare(b.entity) || a.id.localeCompare(b.id)) };
}

function planFingerprint(plan) {
    return createHash('sha256').update(JSON.stringify(canonicalPlan(plan))).digest('hex');
}

function reviewPlan(plan, reviewedFingerprint) {
    const reviewed = canonicalPlan(plan);
    if (!/^[a-f0-9]{64}$/.test(reviewedFingerprint || '') || planFingerprint(reviewed) !== reviewedFingerprint) {
        throw new TransitionError('The reviewed status migration fingerprint does not match.', 409, 'STATUS_MIGRATION_PLAN_STALE');
    }
    const ids = new Set();
    for (const row of reviewed.rows) {
        const map = row.entity === 'Sample' ? workflow.LEGACY_SAMPLE_STATE_MAP
            : row.entity === 'WorkItem' ? workflow.LEGACY_WORK_ITEM_STATE_MAP : null;
        const key = `${row.entity}:${row.id}`;
        const valid = map && (reviewed.direction === 'apply'
            ? map[row.from] === row.to && row.legacyStatus === null
            : row.to === row.legacyStatus && map[row.to] === row.from);
        if (!valid || ids.has(key)) throw new TransitionError('The migration plan contains an unapproved mapping.', 409, 'STATUS_MIGRATION_MAPPING_REFUSED');
        ids.add(key);
        Object.freeze(row);
    }
    Object.freeze(reviewed.rows);
    Object.freeze(reviewed);
    reviewedPlans.add(reviewed);
    return reviewed;
}

function assertReviewedRow(plan, entity, row, nextStatus, actor) {
    if (actor !== 'system:status-migration' || !reviewedPlans.has(plan)) {
        throw new TransitionError('Only the reviewed migration may write legacy provenance.', 409, 'STATUS_MIGRATION_PLAN_REQUIRED');
    }
    const entry = plan.rows.find(item => item.entity === entity && item.id === row.id);
    if (!entry || entry.from !== row.status || entry.to !== nextStatus ||
        entry.legacyStatus !== (row.legacyStatus ?? null) ||
        entry.updatedAt !== new Date(row.updatedAt).toISOString() ||
        (entity === 'WorkItem' && entry.version !== row.version)) {
        throw new TransitionError('The status migration row changed after review.', 409, 'STATUS_MIGRATION_PLAN_STALE');
    }
    return { legacyStatus: plan.direction === 'apply' ? row.status : null };
}

module.exports = { canonicalPlan, planFingerprint, reviewPlan, assertReviewedRow };
