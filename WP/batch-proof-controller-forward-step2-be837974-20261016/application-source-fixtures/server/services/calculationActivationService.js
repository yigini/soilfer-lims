const { randomUUID } = require('node:crypto');
const templates = require('./calculationTemplateService');
const policyService = require('./policyService');
const { actorName } = require('./workflowStateRules');
const { fail } = templates;

async function state(db, labId, analysisCode, methodologyId) {
    // The sole active-variant resolver stays policyService.calcTemplate. This
    // write authority also reads the head ID to append after a deactivation.
    const active = await policyService.calcTemplate(labId, { analysisCode, methodologyId }, { db });
    const rows = await db.calcTemplateActivation.findMany({ where: { labId, analysisCode, methodologyId },
        select: { id: true, supersedesId: true, action: true, templateId: true, templateVersion: true } });
    const superseded = new Set(rows.map(row => row.supersedesId).filter(Boolean));
    const heads = rows.filter(row => !superseded.has(row.id));
    if (heads.length > 1) throw fail(409, 'CALC_ACTIVATION_CONFLICT', 'The activation chain needs review.');
    return { head: heads[0] || null, active };
}
async function getState(db, actor, { labId, analysisCode, methodologyId } = {}) {
    return db.$transaction(async tx => {
        const lab = await templates.laboratory(tx, actor, labId, true);
        if (typeof analysisCode !== 'string' || !analysisCode || methodologyId === undefined ||
            methodologyId !== null && (typeof methodologyId !== 'string' || !methodologyId.trim())) {
            throw fail(422, 'CALC_TEMPLATE_SCOPE_INVALID', 'Select an exact analysis and method scope.');
        }
        await templates.methodScope(tx, lab, analysisCode, methodologyId);
        const current = await state(tx, lab.id, analysisCode, methodologyId);
        return { activationHeadId: current.head?.id || null, active: current.active };
    });
}
async function compatibleUnits(db, template, analysis) {
    const [native, reporting] = await Promise.all([
        db.unit.findUnique({ where: { code: template.outputUnit } }),
        analysis.unitCode ? db.unit.findUnique({ where: { code: analysis.unitCode } }) : null
    ]);
    if (!native || !reporting || native.quantityKind !== reporting.quantityKind ||
        ![native.factorToBase, reporting.factorToBase, native.factorToBase / reporting.factorToBase].every(value => Number.isFinite(value) && value > 0)) {
        throw fail(422, 'CALC_TEMPLATE_UNIT_MISMATCH', 'Select compatible controlled native and reporting units.');
    }
    return { native, reporting };
}
// Historical correction reads its immutable bound row through this owner;
// selecting today's active variant remains solely policyService.calcTemplate.
async function readBoundActivation(db, id) {
    return db.calcTemplateActivation.findUnique({ where: { id } });
}
async function change(db, actor, id, body, now = new Date()) {
    templates.permission(actor, true);
    return db.$transaction(async tx => {
        const { row, template, lab } = await templates.definition(tx, actor, id, body?.labId, true);
        const allowed = ['labId', 'analysisCode', 'methodologyId', 'expectedVersion', 'expectedActivationId', 'action', 'reason', 'verifiedAgainstSop'];
        if (!body || Object.keys(body).some(key => !allowed.includes(key)) || !['ACTIVATE', 'DEACTIVATE'].includes(body.action) ||
            !Object.hasOwn(body, 'expectedActivationId') || !Object.hasOwn(body, 'methodologyId') || body.analysisCode !== row.analysisCode ||
            body.methodologyId !== null && (typeof body.methodologyId !== 'string' || !body.methodologyId.trim())) {
            throw fail(422, 'CALC_ACTIVATION_INVALID', 'Supply an exact activation scope and expected head.');
        }
        if (body.expectedVersion !== row.version) throw fail(409, 'CALC_TEMPLATE_VERSION_CHANGED', 'The selected template version changed.');
        if (body.verifiedAgainstSop !== true) throw fail(422, 'CALC_SOP_VERIFICATION_REQUIRED', 'Verify this method against the laboratory SOP.');
        const reason = templates.requiredText(body.reason, 'CALC_TEMPLATE_REASON_REQUIRED', 'Explain this activation decision.');
        if (row.methodologyId !== null && row.methodologyId !== body.methodologyId) throw fail(422, 'CALC_TEMPLATE_SCOPE_INVALID', 'The template has a different method scope.');
        const analysis = await templates.methodScope(tx, lab, row.analysisCode, body.methodologyId);
        if (body.action === 'ACTIVATE') {
            if (template.outputDecimals === null) throw fail(422, 'CALC_TEMPLATE_PRECISION_REQUIRED', 'Clone the reference and verify fixed reporting decimals.');
            await compatibleUnits(tx, template, analysis);
            if (template.precisionSource?.unit && template.precisionSource.unit !== analysis.unitCode) {
                throw fail(422, 'CALC_TEMPLATE_PRECISION_REQUIRED', 'Clone the reference and verify decimals for the reporting unit.');
            }
        }
        const current = await state(tx, lab.id, row.analysisCode, body.methodologyId);
        if (body.expectedActivationId !== (current.head?.id || null) || body.action === 'DEACTIVATE' &&
            (!current.active || current.active.templateId !== row.id || current.active.templateVersion !== row.version)) {
            throw fail(409, 'CALC_TEMPLATE_VERSION_CHANGED', 'The activation changed. Refresh before saving.');
        }
        const username = actorName(actor);
        if (!await tx.user.findUnique({ where: { username }, select: { username: true } })) throw fail(403, 'CALC_TEMPLATE_ACTOR_INVALID', 'A registered actor is required.');
        const created = await tx.calcTemplateActivation.create({ data: { id: randomUUID(), labId: lab.id, analysisCode: row.analysisCode,
            methodologyId: body.methodologyId, templateId: row.id, templateVersion: row.version, action: body.action, reason,
            verifiedAgainstSop: true, activatedBy: username, activatedAt: now, supersedesId: current.head?.id || null } });
        await tx.auditLog.create({ data: { id: randomUUID(), entity: 'CALC_TEMPLATE_ACTIVATION', entityId: created.id, labId: lab.id,
            action: `CALC_TEMPLATE_${body.action}`, performedBy: username, timestamp: now,
            before: JSON.stringify(current), after: JSON.stringify(created), details: JSON.stringify({ reason, verifiedAgainstSop: true,
                templateId: row.id, templateVersion: row.version, sourceCitation: template.sourceCitation, precisionSource: template.precisionSource }) } });
        return created;
    });
}
module.exports = { change, getState, compatibleUnits, readBoundActivation };
