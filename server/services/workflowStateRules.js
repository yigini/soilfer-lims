const fs = require('node:fs');
const path = require('node:path');
const workflow = require('../workflowContract');
const scopeGuard = require('../utils/scopeGuard');
const { hasPermission } = require('../config/roles');

class TransitionError extends Error {
    constructor(message, statusCode, code, details = {}) {
        super(message);
        this.statusCode = statusCode;
        this.status = statusCode;
        this.code = code;
        this.details = details;
    }
}

const TRIGGER_CODES = Object.freeze([
    'INVALID_SAMPLE_STATUS', 'INVALID_WORKITEM_STATUS', 'INVALID_BATCH_STATUS',
    'INVALID_REVIEW_DECISION', 'REVIEW_DECISION_IMMUTABLE',
    'INVALID_RESULT_EVIDENCE', 'RESULT_EVIDENCE_IMMUTABLE'
]);

function mapStateError(error, conflictCode = 'STATE_CHANGED') {
    const text = `${error.message || ''} ${JSON.stringify(error.meta || {})}`;
    const code = TRIGGER_CODES.find(value => text.includes(value));
    if (code) return new TransitionError('The database refused an invalid workflow write.', 409, code);
    if (['P2025', 'P2034'].includes(error.code)) {
        return new TransitionError('The workflow row changed. Reload before retrying.', 409, conflictCode);
    }
    return error;
}

function actorName(actor) {
    const name = typeof actor === 'object' && actor ? actor.username : actor;
    if (typeof name !== 'string' || !name.trim() || ['SYSTEM', 'UNKNOWN'].includes(name.toUpperCase())) {
        throw new TransitionError('A named user or system:<job> actor is required.', 400, 'WORKFLOW_ACTOR_REQUIRED');
    }
    return name.trim();
}

function assertScope(actor, sample) {
    if (actor && typeof actor === 'object') scopeGuard.ensureScope(actor, sample, { altLabField: 'assignedLab' });
}

function requireReason(reason) {
    if (typeof reason !== 'string' || !reason.trim()) {
        throw new TransitionError('A reason is required for this workflow change.', 400, 'TRANSITION_REASON_REQUIRED');
    }
    return reason.trim();
}

function parseHistory(value) {
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) { return []; }
}

function historyPriorStatus(row, normalize, allowed) {
    const history = parseHistory(row.history);
    for (let index = history.length - 1; index >= 0; index--) {
        const event = history[index];
        if (!event || typeof event !== 'object') continue;
        const states = [...new Set([event.status, event.previousStatus, event.fromStatus]
            .filter(value => typeof value === 'string' && value !== 'ON_HOLD').map(normalize))];
        // A prior-state marker on the hold event takes precedence over older events.
        if (event.status === 'ON_HOLD') {
            if (states.length === 1 && allowed.includes(states[0])) return states[0];
            if (states.length > 1) return null;
            continue;
        }
        if (typeof event.status === 'string' && event.status !== 'ON_HOLD') {
            const status = normalize(event.status);
            return allowed.includes(status) ? status : null;
        }
    }
    return null;
}

function holdData(row, nextStatus, actor, reason, entity) {
    const normalize = entity === 'Sample' ? workflow.normalizeSampleState : workflow.normalizeWorkItemState;
    const current = normalize(row.status);
    if (nextStatus === 'ON_HOLD' && current !== 'ON_HOLD') {
        requireReason(reason);
        return { holdPriorStatus: current };
    }
    if (current !== 'ON_HOLD' || nextStatus === 'ON_HOLD') return {};
    requireReason(reason);
    const allowed = entity === 'Sample' ? workflow.SAMPLE_TRANSITIONS.ON_HOLD : workflow.WORK_ITEM_TRANSITIONS.ON_HOLD;
    const prior = row.holdPriorStatus ? normalize(row.holdPriorStatus) : historyPriorStatus(row, normalize, allowed);
    if (prior) {
        if (nextStatus !== prior) throw new TransitionError('A hold can only resume its recorded prior state.', 409, 'HOLD_PRIOR_STATUS_REQUIRED', { priorStatus: prior });
    } else {
        const explicit = entity === 'Sample' ? ['ACCEPTED', 'PROCESSING'] : ['NOT_ASSIGNED', 'ASSIGNED'];
        if (!hasPermission(actor, 'ASSIGN_WORK') || !explicit.includes(nextStatus)) {
            throw new TransitionError('A manager must choose the recovery state for this legacy hold.', 409, 'HOLD_RECOVERY_REQUIRED', { allowedStates: explicit });
        }
    }
    return { holdPriorStatus: null };
}

function updateData(extraData, nextStatus, normalize = value => value) {
    const data = { ...extraData };
    if ('status' in data && normalize(data.status) !== nextStatus) {
        throw new TransitionError('Additional data cannot override the requested status.', 400, 'STATUS_OVERRIDE_REFUSED');
    }
    delete data.status;
    for (const field of ['legacyStatus', 'holdPriorStatus']) {
        if (field in data) throw new TransitionError('State provenance is controlled by the transition service.', 400, 'STATE_METADATA_NOT_ALLOWED');
    }
    return data;
}

function resolvedPath(value) {
    const absolute = path.resolve(value);
    return (fs.existsSync(absolute) ? fs.realpathSync(absolute) : absolute).toLowerCase();
}

function assertFixtureContext(env = process.env) {
    const working = path.resolve(__dirname, '../prisma/dev.db');
    const candidate = env.DATABASE_PATH;
    const production = env.PRODUCTION_DATABASE_PATH;
    const enabled = env.NODE_ENV === 'test' || env.ALLOW_WORKFLOW_FIXTURES === '1';
    // Always refuse the configured production path and the working database,
    // including when a caller accidentally sets NODE_ENV=test in production.
    if (!enabled || !candidate || resolvedPath(candidate) === resolvedPath(working) ||
        (production && resolvedPath(candidate) === resolvedPath(production)) ||
        (env.NODE_ENV !== 'test' && !production)) {
        throw new TransitionError('Workflow fixtures require an explicitly isolated database.', 409, 'WORKFLOW_FIXTURE_REFUSED');
    }
}

async function inTransaction(tx, execute) {
    try {
        const client = tx || require('../prisma');
        return typeof client.$transaction === 'function' ? await client.$transaction(execute) : await execute(client);
    } catch (error) { throw mapStateError(error); }
}

module.exports = { TransitionError, TRIGGER_CODES, mapStateError, actorName, assertScope, requireReason,
    parseHistory, holdData, updateData, assertFixtureContext, inTransaction };
