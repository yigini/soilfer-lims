const { randomUUID } = require('node:crypto');
const { hasPermission } = require('../config/roles');
const scopeGuard = require('../utils/scopeGuard');
const policyService = require('./policyService');
const { actorName } = require('./workflowStateRules');
const { validateTemplate } = require('../../shared/soilCalculation');
const fail = (statusCode, code, message) => Object.assign(new Error(message), { statusCode, code });

function permission(actor, edit = false) {
    if (!hasPermission(actor, edit ? 'MANAGE_CALC_TEMPLATES' : 'VIEW_ANALYTICAL_RESULTS')) {
        throw fail(403, 'CALC_TEMPLATE_PERMISSION_DENIED', 'Calculation template permission is required.');
    }
}
async function laboratory(db, actor, reference, edit = false) {
    permission(actor, edit);
    const lab = await policyService.resolveLab(reference || actor?.labId, db);
    if (!lab) throw fail(404, 'CALC_TEMPLATE_LAB_NOT_FOUND', 'Select a registered laboratory.');
    const actorLab = actor?.labId ? await policyService.resolveLab(actor.labId, db) : null;
    const normalized = { ...actor, labId: actorLab?.id || actor?.labId };
    if (!scopeGuard.canAccessEntity(normalized, { labId: lab.id }, { labField: 'labId', altLabField: null }) ||
        edit && !scopeGuard.canManageLab(normalized, lab.id)) {
        throw fail(403, 'CALC_TEMPLATE_SCOPE_DENIED', 'This laboratory is outside your scope.');
    }
    return lab;
}
function decode(row) {
    try {
        const result = { ...row, inputs: JSON.parse(row.inputs), parameters: JSON.parse(row.parameters),
            curve: row.curve == null ? null : JSON.parse(row.curve), sourceCitation: JSON.parse(row.sourceCitation),
            precisionSource: row.precisionSource == null ? null : JSON.parse(row.precisionSource) };
        validateTemplate(result); return result;
    } catch (cause) {
        throw Object.assign(fail(409, 'CALC_TEMPLATE_STORED_INVALID', 'Stored template evidence needs review.'), { cause });
    }
}
async function definition(db, actor, id, labId, edit = false) {
    permission(actor, edit);
    const row = await db.calcTemplate.findUnique({ where: { id: String(id) } });
    if (!row) throw fail(404, 'CALC_TEMPLATE_NOT_FOUND', 'Calculation template not found.');
    const lab = await laboratory(db, actor, labId || row.labId, edit);
    if (row.labId !== null && row.labId !== lab.id) throw fail(403, 'CALC_TEMPLATE_SCOPE_DENIED', 'This template belongs to another laboratory.');
    return { row, template: decode(row), lab };
}
async function methodScope(db, lab, analysisCode, methodologyId) {
    const analysis = await db.analysis.findUnique({ where: { code: analysisCode } });
    if (!analysis || analysis.labId && (await policyService.resolveLab(analysis.labId, db))?.id !== lab.id) {
        throw fail(422, 'CALC_TEMPLATE_SCOPE_INVALID', 'Choose an analysis available to this laboratory.');
    }
    if (methodologyId !== null) {
        const method = await db.methodology.findUnique({ where: { id: methodologyId } });
        if (!method || method.analysisCode !== analysisCode || method.labId && (await policyService.resolveLab(method.labId, db))?.id !== lab.id) {
            throw fail(422, 'CALC_TEMPLATE_SCOPE_INVALID', 'Choose a method for this analysis and laboratory.');
        }
    }
    return analysis;
}
function requiredText(value, code, message) {
    if (typeof value !== 'string' || !value.trim()) throw fail(422, code, message);
    return value.trim();
}
function changeRequest(body, parent) {
    const allowed = ['labId', 'expectedVersion', 'reason', 'sopCitation', 'variant', 'parameters', 'outputDecimals', 'methodologyId'];
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key))) {
        throw fail(422, 'CALC_TEMPLATE_FIELD_INVALID', 'Only method parameters and reporting precision can be edited.');
    }
    if (body.expectedVersion !== parent.version) throw fail(409, 'CALC_TEMPLATE_VERSION_CHANGED', 'The selected template version changed.');
    const reason = requiredText(body.reason, 'CALC_TEMPLATE_REASON_REQUIRED', 'Explain the template change.');
    const sopCitation = requiredText(body.sopCitation, 'CALC_TEMPLATE_SOP_REQUIRED', 'Cite the laboratory SOP.');
    const methodologyId = Object.hasOwn(body, 'methodologyId') ? body.methodologyId : parent.methodologyId;
    if (methodologyId !== null && (typeof methodologyId !== 'string' || !methodologyId.trim())) {
        throw fail(422, 'CALC_TEMPLATE_SCOPE_INVALID', 'Select a method or an explicit method-less scope.');
    }
    const outputDecimals = Object.hasOwn(body, 'outputDecimals') ? body.outputDecimals : parent.outputDecimals;
    const result = { ...parent, parameters: Object.hasOwn(body, 'parameters') ? body.parameters : parent.parameters,
        variant: Object.hasOwn(body, 'variant') ? requiredText(body.variant, 'CALC_TEMPLATE_FIELD_INVALID', 'Name the method variant.') : parent.variant,
        methodologyId, outputDecimals, precisionSource: outputDecimals === null ? null : { kind: 'LOCAL_SOP', citation: sopCitation },
        sourceCitation: { ...parent.sourceCitation, localSopCitation: sopCitation }, reason };
    validateTemplate(result);
    return result;
}
async function recordDefinition(db, actor, row, parent, now) {
    const username = actorName(actor);
    if (!await db.user.findUnique({ where: { username }, select: { username: true } })) {
        throw fail(403, 'CALC_TEMPLATE_ACTOR_INVALID', 'A registered actor is required.');
    }
    const data = { ...row, inputs: JSON.stringify(row.inputs), parameters: JSON.stringify(row.parameters),
        curve: row.curve == null ? null : JSON.stringify(row.curve), sourceCitation: JSON.stringify(row.sourceCitation),
        precisionSource: row.precisionSource == null ? null : JSON.stringify(row.precisionSource), createdBy: username, createdAt: now };
    const created = await db.calcTemplate.create({ data });
    await db.auditLog.create({ data: { id: randomUUID(), entity: 'CALC_TEMPLATE', entityId: created.id, labId: created.labId,
        action: parent.labId === null || parent.templateKey !== created.templateKey ? 'CALC_TEMPLATE_CLONED' : 'CALC_TEMPLATE_VERSIONED',
        performedBy: username, timestamp: now, before: JSON.stringify(parent), after: JSON.stringify(created),
        details: JSON.stringify({ reason: created.reason, parentTemplateId: parent.id, sopCitation: row.sourceCitation.localSopCitation }) } });
    return decode(created);
}
async function clone(db, actor, id, body, now = new Date()) {
    permission(actor, true);
    return db.$transaction(async tx => {
        const { row, template, lab } = await definition(tx, actor, id, body?.labId, true);
        const changed = changeRequest(body, template);
        await methodScope(tx, lab, row.analysisCode, changed.methodologyId);
        return recordDefinition(tx, actor, { ...changed, id: randomUUID(), templateKey: randomUUID(), labId: lab.id,
            parentTemplateId: row.id, version: 1, status: 'LAB' }, row, now);
    });
}
async function revise(db, actor, id, body, now = new Date()) {
    permission(actor, true);
    return db.$transaction(async tx => {
        const { row, template, lab } = await definition(tx, actor, id, body?.labId, true);
        if (row.status !== 'LAB' || row.labId !== lab.id) throw fail(422, 'CALC_TEMPLATE_CLONE_REQUIRED', 'Clone the reference before editing.');
        const latest = await tx.calcTemplate.findFirst({ where: { templateKey: row.templateKey, labId: lab.id }, orderBy: { version: 'desc' } });
        if (latest?.id !== row.id) throw fail(409, 'CALC_TEMPLATE_VERSION_CHANGED', 'Edit the latest version.');
        const changed = changeRequest(body, template);
        // Versioning retains the exact activation scope; a different method
        // needs a separate clone rather than silently changing a live chain.
        if (changed.methodologyId !== row.methodologyId) throw fail(422, 'CALC_TEMPLATE_SCOPE_INVALID', 'Clone a separate template for a different method.');
        await methodScope(tx, lab, row.analysisCode, changed.methodologyId);
        return recordDefinition(tx, actor, { ...changed, id: randomUUID(), parentTemplateId: row.id, version: row.version + 1 }, row, now);
    });
}
async function list(db, actor, { labId, analysisCode } = {}) {
    const lab = await laboratory(db, actor, labId);
    const rows = await db.calcTemplate.findMany({ where: { OR: [{ labId: null }, { labId: lab.id }],
        ...(analysisCode ? { analysisCode } : {}) }, orderBy: [{ analysisCode: 'asc' }, { templateKey: 'asc' }, { version: 'desc' }] });
    return rows.map(decode);
}
module.exports = { clone, revise, list, definition, laboratory, methodScope, decode, permission, requiredText, fail };
