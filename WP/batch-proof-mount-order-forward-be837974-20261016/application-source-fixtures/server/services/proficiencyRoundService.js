const { randomUUID } = require('node:crypto');
const policyService = require('./policyService');
const assessment = require('./proficiencyAssessmentService');
const scopeGuard = require('../utils/scopeGuard');
const { hasPermission } = require('../config/roles');
const rules = require('./workflowStateRules');
const nonconformity = require('./nonconformityService');
const fail = (statusCode, code, message) => Object.assign(new Error(message), { statusCode, code });
const owns = (row, key) => Object.hasOwn(row, key);

function authorize(actor, permission, record) {
    if (!hasPermission(actor, permission)) throw fail(403, 'PERMISSION_DENIED', 'PT command authority is required.');
    try { scopeGuard.ensureScope(actor, record, { labField: 'labId', altLabField: null }); }
    catch (_) { throw fail(403, 'ACCESS_DENIED_LAB', 'PT round is outside your laboratory scope.'); }
}
function text(value, required = false) {
    if (value == null && !required) return null;
    if (typeof value !== 'string' || required && !value.trim()) throw fail(400, 'PT_INPUT_INVALID', 'PT text fields must be valid strings.');
    return value.trim() || null;
}
function metadata(input, creating) {
    const data = {};
    for (const key of ['provider', 'roundRef', 'notes']) {
        if (creating || owns(input, key)) data[key] = text(input[key], key !== 'notes');
    }
    if (creating || owns(input, 'date')) {
        if (owns(input, 'date') && !(input.date instanceof Date) && (typeof input.date !== 'string' || !input.date.trim())) {
            throw fail(400, 'PT_INPUT_INVALID', 'PT round date must be a date string.');
        }
        const date = !owns(input, 'date') && creating ? new Date() : new Date(input.date);
        if (!Number.isFinite(date.getTime())) throw fail(400, 'PT_INPUT_INVALID', 'PT round date must be valid.');
        data.date = date;
    }
    return data;
}
async function classify(input, identity, tx) {
    const limits = await policyService.get(identity.labId, 'pt.zScoreLimits', { analysisCode: identity.analysisCode, db: tx });
    const evaluated = assessment.evaluateProficiency(input.assignedValue, input.labResult, input.uncertainty, limits);
    return { assignedValue: Number(input.assignedValue), labResult: Number(input.labResult), uncertainty: Number(input.uncertainty),
        zScore: evaluated.zScore, outcome: evaluated.outcome,
        classificationLimits: JSON.stringify(evaluated.classificationLimits) };
}
async function raiseUnsatisfactory(tx, actor, round) {
    const raised = await nonconformity.raise(tx, actor, { labId: round.labId, source: 'PT',
        refType: 'ProficiencyRound', refId: round.id,
        description: `Unsatisfactory PT round ${round.roundRef} (${round.provider}), analysis ${round.analysisCode}, z=${round.zScore}.` });
    return { ncrStatus: 'RAISED', nonconformityId: raised.report.id };
}
async function audit(tx, actor, action, before, after, reason = null) {
    const row = after || before;
    await tx.auditLog.create({ data: { id: randomUUID(), entity: 'PROFICIENCY_ROUND', entityId: row.id,
        action, performedBy: actor.username, labId: row.labId, analysisCode: row.analysisCode,
        before: before ? JSON.stringify(before) : null, after: after ? JSON.stringify(after) : null,
        details: JSON.stringify({ roundId: row.id, zScore: row.zScore, outcome: row.outcome,
            limits: row.classificationLimits == null ? null : JSON.parse(row.classificationLimits), reason }) } });
}

async function record(actor, input, { db = require('../prisma') } = {}) {
    const identity = { labId: input.labId || actor.labId, analysisCode: text(input.analysisCode, true) };
    if (!identity.labId) throw fail(400, 'PT_LAB_REQUIRED', 'A laboratory is required.');
    if (typeof identity.labId !== 'string') throw fail(400, 'PT_INPUT_INVALID', 'PT laboratory must be an id or code string.');
    authorize(actor, 'ENTER_RESULTS', identity);
    return rules.inTransaction(db, async tx => {
        const lab = await policyService.resolveLab(identity.labId, tx);
        if (!lab) throw fail(400, 'PT_LAB_INVALID', 'PT laboratory was not found.');
        identity.labId = lab.id;
        authorize(actor, 'ENTER_RESULTS', identity);
        const values = await classify(input, identity, tx);
        const data = { id: randomUUID(), ...identity, ...metadata(input, true), ...values };
        if (values.outcome === 'UNSATISFACTORY') Object.assign(data, await raiseUnsatisfactory(tx, actor, data));
        const round = await tx.proficiencyRound.create({ data });
        await audit(tx, actor, 'RECORD_PT', null, round);
        if (round.outcome === 'UNSATISFACTORY') await audit(tx, actor, 'PT_UNSATISFACTORY', null, round);
        return round;
    });
}

async function update(actor, id, input, { db = require('../prisma') } = {}) {
    return rules.inTransaction(db, async tx => {
        const before = await tx.proficiencyRound.findUnique({ where: { id: String(id) } });
        if (!before) throw fail(404, 'PT_ROUND_NOT_FOUND', 'PT round was not found.');
        authorize(actor, 'ENTER_RESULTS', before);
        if (before.deletedAt) throw fail(409, 'PT_ROUND_DELETED', 'Deleted PT rounds cannot be updated.');
        for (const key of ['labId', 'analysisCode']) if (owns(input, key) && input[key] !== before[key]) {
            throw fail(400, 'PT_IDENTITY_IMMUTABLE', 'A PT round laboratory and analysis identity cannot change.');
        }
        const reclassifying = ['assignedValue', 'labResult', 'uncertainty'].some(key => owns(input, key));
        let data = metadata(input, false);
        if (reclassifying) {
            if (!owns(input, 'uncertainty')) throw fail(400, 'PT_SIGMA_REQUIRED', 'Explicit proficiency-assessment sigma is required for a correction.');
            data = { ...data, ...await classify({ assignedValue: before.assignedValue, labResult: before.labResult, ...input }, before, tx),
                legacyScoreFlag: null, legacyFlaggedAt: null };
            // Classification never clears retained NCR evidence. Only a first
            // unsatisfactory result creates the link, directly to RAISED.
            if (data.outcome === 'UNSATISFACTORY' && before.ncrStatus !== 'RAISED') {
                Object.assign(data, await raiseUnsatisfactory(tx, actor, { ...before, ...data }));
            }
        }
        if (!Object.keys(data).length) throw fail(400, 'PT_INPUT_INVALID', 'A PT update must change a supported field.');
        const after = await tx.proficiencyRound.update({ where: { id: before.id }, data });
        await audit(tx, actor, 'UPDATE_PT', before, after);
        if (reclassifying && after.outcome === 'UNSATISFACTORY') await audit(tx, actor, 'PT_UNSATISFACTORY', before, after);
        return after;
    });
}

async function softDelete(actor, id, reason, { db = require('../prisma') } = {}) {
    const justified = typeof reason === 'string' ? reason.trim() : '';
    if (!justified) throw fail(400, 'PT_DELETE_REASON_REQUIRED', 'A deletion reason is required.');
    return db.$transaction(async tx => {
        const before = await tx.proficiencyRound.findUnique({ where: { id: String(id) } });
        if (!before) throw fail(404, 'PT_ROUND_NOT_FOUND', 'PT round was not found.');
        authorize(actor, 'APPROVE_RESULTS', before);
        if (before.deletedAt) return before;
        const after = await tx.proficiencyRound.update({ where: { id: before.id }, data: {
            deletedAt: new Date(), deletedBy: actor.username, deleteReason: justified } });
        await audit(tx, actor, 'DELETE_PT', before, after, justified);
        return after;
    });
}

function visibleWhere(actor, input = {}) {
    if (input.includeDeleted != null && !['true', 'false', true, false].includes(input.includeDeleted)) {
        throw fail(400, 'PT_INPUT_INVALID', 'includeDeleted must be true or false.');
    }
    const includeDeleted = input.includeDeleted === true || input.includeDeleted === 'true';
    if (includeDeleted && !hasPermission(actor, 'APPROVE_RESULTS')) throw fail(403, 'PERMISSION_DENIED', 'Manager authority is required to include deleted PT rounds.');
    return scopeGuard.buildScopedWhere(actor, { ...(!includeDeleted && { deletedAt: null }),
        ...(input.labId && { labId: input.labId }) }, { entityType: 'ProficiencyRound', labField: 'labId', altLabField: null });
}

module.exports = { record, update, softDelete, visibleWhere };
