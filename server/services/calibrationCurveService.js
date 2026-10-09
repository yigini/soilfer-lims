const { randomUUID } = require('node:crypto');
const { hasPermission } = require('../config/roles');
const { inTransaction, actorName } = require('./workflowStateRules');
const { readQcRun } = require('./qcRunViewService');
const policyService = require('./policyService');
const qcRuleService = require('./qcRuleService');
const templates = require('./calculationTemplateService');
const { getNumberFormat } = require('./numberFormatService');
const { parseNumber } = require('../../shared/numberParse');
const { fitCurve } = require('../../shared/soilCalculation');
const { fail } = templates;

function permission(actor, write = false) {
    if (!hasPermission(actor, write ? 'ENTER_RESULTS' : 'VIEW_ANALYTICAL_RESULTS'))
        throw fail(403, 'CALIBRATION_PERMISSION_DENIED', 'Calibration permission is required.');
}
async function executionContext(db, batchId, actor, analysisCode) {
    const batch = await readQcRun(db, batchId, actor), analyte = batch.analytes.find(row => row.analysisCode === analysisCode);
    let frozen;
    try { frozen = JSON.parse(analyte?.criteriaSnapshot); } catch { /* Missing/legacy context refuses. */ }
    if (!batch.startedAt || !analyte || analyte.provenance !== 'NATIVE' || !analyte.methodologyId ||
        frozen?.methodRevision?.methodologyId !== analyte.methodologyId || !Number.isSafeInteger(frozen.methodRevision.version) || frozen.methodRevision.version < 1)
        throw fail(409, 'CALIBRATION_CURVE_REQUIRED', 'Calibration needs a started native run and its frozen method revision.');
    const lab = await policyService.resolveLab(batch.labId, db);
    if (!lab || lab.id !== analyte.labId) throw fail(409, 'CALIBRATION_CURVE_CONTEXT_MISMATCH', 'The native analyte laboratory differs.');
    return { batch, analyte, lab, methodRevision: frozen.methodRevision };
}
async function activeTemplate(db, context) {
    const { lab, analyte } = context;
    const active = await policyService.calcTemplate(lab.id, { analysisCode: analyte.analysisCode, methodologyId: analyte.methodologyId }, { db });
    if (!active) return null;
    const row = await db.calcTemplate.findUnique({ where: { id: active.templateId } });
    if (!row || row.version !== active.templateVersion || row.analysisCode !== analyte.analysisCode ||
        row.labId !== null && row.labId !== lab.id || row.methodologyId !== null && row.methodologyId !== analyte.methodologyId)
        throw fail(409, 'CALC_TEMPLATE_VERSION_CHANGED', 'The active template evidence differs.');
    return { ...active, row, template: templates.decode(row) };
}
async function curveChain(db, context) {
    const rows = await db.calibrationCurve.findMany({ where: { batchId: context.batch.id, batchAnalyteId: context.analyte.id },
        include: { points: { orderBy: { ordinal: 'asc' } } }, orderBy: { revision: 'asc' } });
    let parent = null;
    for (const row of rows) {
        if (row.revision !== (parent?.revision || 0) + 1 || row.supersedesId !== (parent?.id || null) || row.labId !== context.lab.id ||
            row.methodologyId !== context.analyte.methodologyId || JSON.stringify(JSON.parse(row.executedMethodRevision)) !== JSON.stringify(context.methodRevision))
            throw fail(409, 'CALIBRATION_CURVE_VERSION_CHANGED', 'The retained curve chain needs review.');
        parent = row;
    }
    return { rows, latest: parent };
}
function completeCurve(row) {
    if (!row || row.points.length !== row.pointCount || row.points.some((point, i) => point.ordinal !== i + 1) ||
        new Set(row.points.map(point => point.standardConcentration)).size !== row.levelCount)
        throw fail(409, 'CALIBRATION_CURVE_INCOMPLETE', 'The curve does not retain every declared calibration point.');
    return row;
}
async function requireLatestCurve(db, context, active) {
    const { latest } = await curveChain(db, context);
    if (!latest) throw fail(409, 'CALIBRATION_CURVE_REQUIRED', 'Record this run analyte calibration before results.');
    completeCurve(latest);
    if (latest.templateId !== active.templateId || latest.templateVersion !== active.templateVersion)
        throw fail(409, 'CALIBRATION_CURVE_REQUIRED', 'Record a new curve revision for the active template version.');
    if (latest.status !== 'PASS') throw fail(409, 'CALIBRATION_CURVE_FAILED', 'The latest calibration failed; record a reasoned new revision.');
    const fitted = fitCurve(latest.points);
    if (!fitted.usable || ['slope', 'intercept', 'r', 'rSquared', 'pointCount', 'levelCount'].some(key => fitted[key] !== latest[key]) ||
        latest.levelCount < latest.minPointsApplied || latest.r < latest.minRApplied)
        throw fail(409, 'CALIBRATION_CURVE_FAILED', 'The retained coefficients or verdict differ from all-point evidence.');
    return { ...latest, calibrationMax: fitted.calibrationMax };
}
function pointNumbers(points, format) {
    if (!Array.isArray(points) || !points.length || points.some(point => !point || typeof point !== 'object' || Array.isArray(point) ||
        Object.keys(point).length !== 2 || !Object.hasOwn(point, 'standardConcentration') || !Object.hasOwn(point, 'response')))
        throw fail(422, 'CALIBRATION_POINT_INVALID', 'Supply every standard concentration and response.');
    return points.map(point => Object.fromEntries(['standardConcentration', 'response'].map(key => {
        const value = parseNumber(point[key], format);
        if (!value.valid || value.qualifier || !Number.isFinite(value.value) || key === 'standardConcentration' && value.value < 0)
            throw fail(422, 'CALIBRATION_POINT_INVALID', 'Calibration points must be finite numbers in the lab number format.');
        return [key, value.value];
    })));
}
async function recordCurve(db, batchId, actor, input = {}) {
    permission(actor, true);
    const allowed = ['analysisCode', 'templateId', 'templateVersion', 'activationId', 'expectedCurveId', 'points', 'reason'];
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !allowed.includes(key)) ||
        typeof input.analysisCode !== 'string' || !input.analysisCode || !Object.hasOwn(input, 'expectedCurveId') ||
        input.expectedCurveId !== null && (typeof input.expectedCurveId !== 'string' || !input.expectedCurveId.trim()))
        throw fail(422, 'CALIBRATION_INPUT_INVALID', 'Supply an analysis, expected curve head and template context.');
    return inTransaction(db, async tx => {
        const context = await executionContext(tx, batchId, actor, input.analysisCode), { batch, analyte, lab } = context;
        if (batch.status === 'CLOSED' || ['QC_FAIL', 'REJECTED', 'REPEAT_ORDERED', 'CLOSED'].includes(analyte.status) || analyte.disposition)
            throw fail(409, 'QC_BATCH_LOCKED', 'This run analyte is sealed.');
        const username = actorName(actor), manager = hasPermission(actor, 'MANAGE_CALC_TEMPLATES');
        const reason = input.reason == null ? null : templates.requiredText(input.reason, 'CALIBRATION_REASON_REQUIRED', 'Explain this calibration revision.');
        if (batch.analystUsername !== username && !manager) throw fail(403, 'CALIBRATION_ANALYST_REQUIRED', 'Only the run analyst or scoped lab manager can record calibration.');
        if (batch.analystUsername !== username && !reason) throw fail(422, 'CALIBRATION_REASON_REQUIRED', 'The manager must explain calibration on another analyst run.');
        if (!await tx.user.findUnique({ where: { username }, select: { username: true } })) throw fail(403, 'CALIBRATION_ANALYST_REQUIRED', 'A registered analyst is required.');
        const active = await activeTemplate(tx, context);
        if (!active || active.templateId !== input.templateId || active.templateVersion !== input.templateVersion || active.activationId !== input.activationId)
            throw fail(409, 'CALC_TEMPLATE_VERSION_CHANGED', 'The selected calculation activation changed.');
        if (!active.template.curve) throw fail(422, 'CALIBRATION_NOT_REQUIRED', 'The active method does not declare a calibration curve.');
        const { latest } = await curveChain(tx, context);
        if ((latest?.id || null) !== input.expectedCurveId) throw fail(409, 'CALIBRATION_CURVE_VERSION_CHANGED', 'The curve revision changed.');
        if (latest && !reason) throw fail(422, 'CALIBRATION_REASON_REQUIRED', 'Explain the new calibration revision.');
        const points = pointNumbers(input.points, await getNumberFormat(lab.id, { db: tx })), fit = fitCurve(points), now = new Date();
        const rule = await qcRuleService.resolve(lab.id, analyte.analysisCode, { db: tx, methodologyId: analyte.methodologyId, evaluatedAt: now });
        const minPoints = rule.resolved.curveMinPoints, minR = rule.resolved.curveMinR;
        if (!Number.isSafeInteger(minPoints?.value) || minPoints.value < 1 || !Number.isFinite(minR?.value) || minR.value < 0 || minR.value > 1)
            throw fail(409, 'CALIBRATION_POLICY_INVALID', 'The resolved calibration thresholds need review.');
        const failReason = !fit.usable ? 'DEGENERATE_FIT' : fit.levelCount < minPoints.value ? 'TOO_FEW_LEVELS' : fit.r < minR.value ? 'CORRELATION_BELOW_MINIMUM' : null;
        const created = await tx.calibrationCurve.create({ data: { id: randomUUID(), labId: lab.id, batchId, batchAnalyteId: analyte.id,
            methodologyId: analyte.methodologyId, executedMethodRevision: JSON.stringify(context.methodRevision), templateId: active.templateId,
            templateVersion: active.templateVersion, revision: (latest?.revision || 0) + 1, supersedesId: latest?.id || null,
            slope: fit.slope, intercept: fit.intercept, r: fit.r, rSquared: fit.rSquared, pointCount: fit.pointCount, levelCount: fit.levelCount,
            minPointsApplied: minPoints.value, minRApplied: minR.value,
            thresholdSource: JSON.stringify({ evaluatedAt: rule.evaluatedAt, qcRuleId: rule.id, qcRuleVersion: rule.version,
                curveMinPoints: minPoints, curveMinR: minR }), status: failReason ? 'FAIL' : 'PASS', failReason, recordedBy: username, recordedAt: now, reason } });
        for (const [index, point] of points.entries()) await tx.calibrationPoint.create({ data: { curveId: created.id, ordinal: index + 1, ...point } });
        const retained = completeCurve({ ...created, points: await tx.calibrationPoint.findMany({ where: { curveId: created.id }, orderBy: { ordinal: 'asc' } }) });
        await tx.auditLog.create({ data: { id: randomUUID(), entity: 'CALIBRATION_CURVE', entityId: created.id, labId: lab.id,
            action: latest ? 'CALIBRATION_REVISED' : 'CALIBRATION_RECORDED', performedBy: username, timestamp: now,
            before: JSON.stringify(latest), after: JSON.stringify(retained), details: JSON.stringify({ batchId, analysisCode: analyte.analysisCode,
                reason, activationId: active.activationId, thresholdSource: JSON.parse(created.thresholdSource) }) } });
        await tx.batchEvent.create({ data: { id: randomUUID(), batchId, type: 'CALIBRATION_RECORDED', by: username, at: now,
            payload: JSON.stringify({ analysisCode: analyte.analysisCode, curveId: created.id, revision: created.revision, status: created.status,
                pointCount: created.pointCount, levelCount: created.levelCount, reason }) } });
        return { ...retained, calibrationMax: fit.calibrationMax };
    });
}
async function listCurves(db, batchId, actor, analysisCode) {
    permission(actor);
    return inTransaction(db, async tx => {
        const context = await executionContext(tx, batchId, actor, analysisCode), active = await activeTemplate(tx, context);
        const chain = await curveChain(tx, context);
        return { ...chain, active: active ? { activationId: active.activationId, templateId: active.templateId, templateVersion: active.templateVersion,
            requiresCurve: active.template.curve !== null } : null };
    });
}
module.exports = { recordCurve, listCurves, executionContext, activeTemplate, requireLatestCurve, completeCurve, pointNumbers };
