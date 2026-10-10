const { randomUUID } = require('node:crypto');
const policy = require('./policyService');
const templates = require('./calculationTemplateService');
const activations = require('./calculationActivationService');
const curves = require('./calibrationCurveService');
const { getNumberFormat } = require('./numberFormatService');
const { calculate, fitCurve, validateTemplate } = require('../../shared/soilCalculation');
const { parseNumber } = require('../../shared/numberParse');
const { fail } = templates;

// The writer supplies the scoped, server-derived execution context. Request
// payloads cannot select another laboratory, analysis, method or run.
async function selection(db, ctx, { metadata = false } = {}) {
    const lab = await policy.resolveLab(ctx.labId, db);
    if (!lab) return null; // No exact laboratory scope can have an active template.
    const analyte = { analysisCode: ctx.analysis.code, methodologyId: ctx.methodId || null };
    const active = await curves.activeTemplate(db, { lab, analyte });
    if (!active) return null;
    let curve = null, curveBlocker = null;
    if (active.template.curve) {
        try {
            if (!ctx.batchId) throw fail(409, 'CALIBRATION_CURVE_REQUIRED', 'A colorimetric result needs its started native run.');
            const execution = await curves.executionContext(db, ctx.batchId, ctx.actor, analyte.analysisCode);
            if (execution.lab.id !== lab.id || execution.analyte.methodologyId !== analyte.methodologyId)
                throw fail(409, 'CALIBRATION_CURVE_CONTEXT_MISMATCH', 'The result differs from the frozen run method.');
            curve = await curves.requireLatestCurve(db, execution, active);
        } catch (error) {
            if (!metadata || !['CALIBRATION_CURVE_REQUIRED','CALIBRATION_CURVE_FAILED','CALIBRATION_CURVE_INCOMPLETE'].includes(error.code)) throw error;
            curveBlocker = { code: error.code, error: error.message };
        }
    }
    return { ...active, curve, curveBlocker, units: await activations.compatibleUnits(db, active.template, ctx.analysis) };
}
async function preview(db, ctx, rawInputs) {
    // Metadata can disclose the selected raw-input form and an explicit curve
    // blocker. Supplying inputs, recording and completion always use strict selection.
    const selected = await selection(db, ctx, { metadata: rawInputs === undefined });
    if (!selected) return { active: null, template: null, calculation: null };
    const numberFormat = await getNumberFormat(ctx.labId, { db, analysisCode: ctx.analysis.code, methodologyId: ctx.methodId });
    const calculated = rawInputs === undefined ? null : calculate(selected.template, rawInputs, { numberFormat, curve: selected.curve, units: selected.units });
    return { active: { activationId: selected.activationId, templateId: selected.templateId, templateVersion: selected.templateVersion },
        template: selected.template, curve: selected.curve, curveBlocker: selected.curveBlocker, numberFormat, units: selected.units, calculation: calculated };
}
async function prepareCalculation(db, ctx, measurement, numberFormat) {
    // Historical imports and spectral predictions retain their authorized input
    // authority. An activated laboratory template governs typed measurements.
    if (ctx.source !== 'measurement') {
        if (measurement.calculation != null) throw fail(409, 'CALC_TEMPLATE_SOURCE_INVALID', 'Use the typed measurement calculation workflow.');
        return null;
    }
    const selected = await selection(db, ctx), supplied = measurement.calculation;
    if (!selected) {
        if (supplied != null) throw fail(409, 'CALC_TEMPLATE_VERSION_CHANGED', 'The selected calculation is no longer active.');
        return null;
    }
    if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied))
        throw fail(422, 'CALC_INPUT_REQUIRED', 'Enter the activated method raw measurements.');
    const allowed = ['activationId', 'templateId', 'templateVersion', 'curveId', 'inputs'];
    if (Object.keys(supplied).some(key => !allowed.includes(key))) throw fail(422, 'CALC_INPUT_INVALID', 'Supply only raw inputs and the selected calculation context.');
    if (supplied.activationId !== selected.activationId || supplied.templateId !== selected.templateId || supplied.templateVersion !== selected.templateVersion)
        throw fail(409, 'CALC_TEMPLATE_VERSION_CHANGED', 'The activated method changed after preview.');
    if ((supplied.curveId ?? null) !== (selected.curve?.id || null))
        throw fail(409, 'CALIBRATION_CURVE_VERSION_CHANGED', 'The latest calibration changed after preview.');
    const calculated = calculate(selected.template, supplied.inputs, { numberFormat, curve: selected.curve, units: selected.units });
    const suppliedValue = parseNumber(measurement.value, numberFormat);
    if (!suppliedValue.valid || suppliedValue.qualifier || suppliedValue.value !== calculated.output)
        throw fail(409, 'CALCULATION_MISMATCH', 'The entered output differs from the server calculation.');
    return { selected, calculated };
}
// Pins6089591961/6089821987: corrections keep the original immutable basis.
// Today's activation governs new attempts only; no historical calculation is
// rewritten or silently rebound to a later template/curve.
async function prepareCorrection(db, ctx, original, measurement, numberFormat) {
    const bound = await db.resultCalculation.findUnique({ where: { resultId: original.id },
        include: { template: true, curve: { include: { points: { orderBy: { ordinal: 'asc' } } } } } });
    const supplied = measurement.calculation;
    if (!bound) {
        if (supplied !== undefined) throw fail(400, 'ATTEMPT_CORRECTION_FIELDS_INVALID', 'This Result has no bound calculation.');
        return null;
    }
    bound.activation = await activations.readBoundActivation(db, bound.activationId);
    if (supplied === undefined) throw fail(422, 'CALC_CORRECTION_INPUTS_REQUIRED', 'Correct the complete raw measurements for this calculated Result.');
    if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied) ||
        Object.keys(supplied).some(key => key !== 'inputs') || !Object.hasOwn(supplied, 'inputs'))
        throw fail(400, 'ATTEMPT_CORRECTION_FIELDS_INVALID', 'Supply only the complete correction raw inputs.');
    if (bound.curveId && await db.calibrationCurve.findFirst({ where: { supersedesId: bound.curveId }, select: { id: true } }))
        throw fail(409, 'CALC_CORRECTION_BASIS_SUPERSEDED', 'The original curve was revised; this needs a separate recalculation decision.');
    let template, units, curve = null, previousInputs;
    try {
        const labId = (await policy.resolveLab(ctx.labId, db))?.id;
        if (!labId) throw Error('Original laboratory is unavailable');
        template = templates.decode(bound.template);
        const parameters = JSON.parse(bound.parameters);
        previousInputs = JSON.parse(bound.inputs); units = JSON.parse(bound.unitConversion);
        if (template.id !== bound.templateId || template.version !== bound.templateVersion || template.analysisCode !== original.param ||
            template.labId !== null && template.labId !== labId || template.methodologyId !== null && template.methodologyId !== original.methodologyId ||
            JSON.stringify(parameters) !== JSON.stringify(template.parameters) || !previousInputs || typeof previousInputs !== 'object' || Array.isArray(previousInputs) ||
            Object.keys(previousInputs).length !== template.inputs.length || template.inputs.some(row =>
                !Object.hasOwn(previousInputs, row.key) || !['string', 'number'].includes(typeof previousInputs[row.key])) ||
            bound.activation?.action !== 'ACTIVATE' || bound.activation.id !== bound.activationId ||
            bound.activation.templateId !== bound.templateId || bound.activation.templateVersion !== bound.templateVersion ||
            bound.activation.labId !== labId || bound.activation.analysisCode !== original.param ||
            bound.activation.methodologyId !== original.methodologyId || units?.native?.code !== bound.nativeUnit ||
            units?.reporting?.code !== bound.outputUnit || bound.outputUnit !== original.unit)
            throw Error('Original calculation basis differs');
        template = { ...template, parameters }; validateTemplate(template);
        if (template.curve) {
            curve = curves.completeCurve(bound.curve);
            const fit = fitCurve(curve.points);
            if (curve.id !== bound.curveId || curve.batchId !== original.batchId || curve.methodologyId !== original.methodologyId ||
                curve.labId !== labId || curve.templateId !== bound.templateId || curve.templateVersion !== bound.templateVersion ||
                curve.status !== 'PASS' || !fit.usable || ['slope', 'intercept', 'r', 'rSquared', 'pointCount', 'levelCount'].some(key => fit[key] !== curve[key]) ||
                curve.levelCount < curve.minPointsApplied || curve.r < curve.minRApplied)
                throw Error('Original calibration basis differs');
            curve = { ...curve, calibrationMax: fit.calibrationMax };
        } else if (bound.curveId !== null) throw Error('Unexpected original curve');
        if (units.native.quantityKind !== units.reporting.quantityKind ||
            ![units.native.factorToBase, units.reporting.factorToBase, units.native.factorToBase / units.reporting.factorToBase].every(value => Number.isFinite(value) && value > 0) ||
            units.native.factorToBase / units.reporting.factorToBase !== bound.conversionFactor)
            throw Error('Original unit conversion differs');
    } catch (cause) {
        throw Object.assign(fail(409, 'ATTEMPT_CORRECTION_EVIDENCE_UNAVAILABLE', 'The original calculation evidence is unavailable.'), { cause });
    }
    const calculated = calculate(template, supplied.inputs, { numberFormat, curve, units });
    const suppliedValue = parseNumber(measurement.value, numberFormat);
    if (!suppliedValue.valid || suppliedValue.qualifier || suppliedValue.value !== calculated.output)
        throw fail(409, 'CALCULATION_MISMATCH', 'The entered output differs from the server calculation.');
    return { selected: { template, units, curve, templateId: bound.templateId, templateVersion: bound.templateVersion, activationId: bound.activationId },
        calculated, correction: { originalResultCalculationId: bound.id, originalResultId: original.id,
            changedInputs: template.inputs.filter(row => !Object.is(previousInputs[row.key], calculated.inputs[row.key]))
                .map(row => ({ key: row.key, oldValue: previousInputs[row.key], newValue: calculated.inputs[row.key] })) } };
}
async function freeze(db, ctx, result, evidence, now) {
    if (!evidence) return null;
    const { selected, calculated } = evidence;
    if (result.sampleId !== ctx.sample.id || result.param !== ctx.analysis.code || result.methodologyId !== ctx.methodId ||
        result.batchId !== ctx.batchId || result.numericValue !== calculated.output || result.unit !== calculated.outputUnit)
        throw fail(409, 'CALCULATION_MISMATCH', 'The result differs from its computed evidence.');
    const row = await db.resultCalculation.create({ data: { id: randomUUID(), resultId: result.id, templateId: selected.templateId,
        templateVersion: selected.templateVersion, activationId: selected.activationId, inputs: JSON.stringify(calculated.inputs),
        parameters: JSON.stringify(selected.template.parameters), intermediate: JSON.stringify(calculated.intermediate),
        nativeValue: calculated.nativeValue, nativeUnit: calculated.nativeUnit, conversionFactor: calculated.conversionFactor,
        unitConversion: JSON.stringify(calculated.unitConversion), unroundedOutput: calculated.unroundedOutput,
        output: calculated.output, outputUnit: calculated.outputUnit, curveId: selected.curve?.id || null,
        engineVersion: calculated.engineVersion, computedBy: ctx.performedBy, computedAt: now } });
    await db.auditLog.create({ data: { id: randomUUID(), entity: 'RESULT_CALCULATION', entityId: row.id, sampleId: result.sampleId,
        labId: ctx.labId, analysisCode: result.param, action: evidence.correction ? 'RESULT_CALCULATION_CORRECTED' : 'RESULT_CALCULATED', performedBy: ctx.performedBy, timestamp: now,
        after: JSON.stringify(row), details: JSON.stringify({ resultId: result.id, templateId: row.templateId, templateVersion: row.templateVersion,
            activationId: row.activationId, curveId: row.curveId, engineVersion: row.engineVersion,
            ...(evidence.correction && { correction: evidence.correction }) }) } });
    return row;
}
// Review reads frozen evidence and its immutable definitions. It never resolves
// the current activation, applies a newer template, or recomputes old Results.
async function retained(db, resultId) {
    return db.resultCalculation.findUnique({ where: { resultId }, include: { template: true, curve: { include: { points: { orderBy: { ordinal: 'asc' } } } } } });
}
module.exports = { selection, preview, prepareCalculation, prepareCorrection, freeze, retained };
