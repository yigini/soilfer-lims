// Audit #199: the browser preview and authoritative Result writer use this
// pure module. A caller supplies the activated immutable template, lab number
// format and server-selected curve; this module never selects a lab variant.
const { parseNumber } = require('./numberParse');
const ENGINE_VERSION = 'soilfer-calculation-1';
const INPUTS = Object.freeze({
    GRAVIMETRIC_MOISTURE: ['tareMass', 'wetWithTare', 'dryWithTare'],
    WALKLEY_BLACK: ['sampleMass', 'blankTitre', 'sampleTitre', 'moistureCorrectionFactor'],
    COLORIMETRIC_PHOSPHORUS: ['absorbance', 'blankConcentration', 'extractVolume', 'dilutionFactor', 'sampleMass', 'moistureCorrectionFactor'],
    EXCHANGEABLE_CATION: ['reading', 'blankConcentration', 'extractVolume', 'dilutionFactor', 'sampleMass'],
    CEC_TITRATION: ['sampleTitre', 'blankTitre', 'sampleMass', 'extractVolume', 'aliquotVolume'],
    KJELDAHL: ['sampleTitre', 'blankTitre', 'sampleMass']
});
const PARAMETERS = Object.freeze({
    GRAVIMETRIC_MOISTURE: [],
    WALKLEY_BLACK: ['ferrousNormality', 'carbonGramsPerMilliEquivalent', 'recoveryFactor'],
    COLORIMETRIC_PHOSPHORUS: [],
    EXCHANGEABLE_CATION: ['equivalentWeight'],
    CEC_TITRATION: ['acidNormality'],
    KJELDAHL: ['acidNormality', 'nitrogenMgPerMilliMole']
});
const error = (code, message, details) => Object.assign(new Error(message), { statusCode: 422, code, details });
function validateTemplate(template) {
    const names = INPUTS[template?.formulaModule], parameters = PARAMETERS[template?.formulaModule];
    if (!names || !Array.isArray(template.inputs) || !Array.isArray(template.parameters) ||
        template.inputs.length !== names.length || template.parameters.length !== parameters.length ||
        (template.outputDecimals !== null && (!Number.isInteger(template.outputDecimals) || template.outputDecimals < 0 || template.outputDecimals > 6)) ||
        typeof template.outputUnit !== 'string' || !template.outputUnit.trim()) {
        throw error('CALC_TEMPLATE_INVALID', 'The calculation template is incomplete.');
    }
    const inputKeys = template.inputs.map(row => row?.key), parameterKeys = template.parameters.map(row => row?.key);
    if (new Set(inputKeys).size !== names.length || names.some(key => !inputKeys.includes(key)) ||
        template.inputs.some(row => row.type !== 'number' || row.required !== true || typeof row.label !== 'string' || !row.label.trim() || typeof row.unit !== 'string') ||
        new Set(parameterKeys).size !== parameters.length || parameters.some(key => !parameterKeys.includes(key))) {
        throw error('CALC_TEMPLATE_INVALID', 'Use the inputs defined for this formula.');
    }
    for (const parameter of template.parameters) {
        if (!Number.isFinite(parameter.value) || parameter.value <= 0 || typeof parameter.unit !== 'string' ||
            (parameter.min != null && (!Number.isFinite(parameter.min) || parameter.value < parameter.min)) ||
            (parameter.max != null && (!Number.isFinite(parameter.max) || parameter.value > parameter.max)) ||
            (parameter.min != null && parameter.max != null && parameter.min > parameter.max)) {
            throw error('CALC_TEMPLATE_INVALID', 'A method parameter is invalid.');
        }
    }
    if (template.formulaModule === 'COLORIMETRIC_PHOSPHORUS') {
        if (template.curve?.xUnit !== 'mg/L' || template.curve?.yUnit !== 'absorbance') {
            throw error('CALC_TEMPLATE_INVALID', 'This phosphorus formula requires a concentration/absorbance curve.');
        }
    } else if (template.curve != null) throw error('CALC_TEMPLATE_INVALID', 'This formula does not use a run curve.');
    return template;
}
function roundOutput(value, decimals) {
    if (!Number.isFinite(value)) throw error('CALC_INPUT_INVALID', 'The calculation must produce a finite number.');
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 6) throw error('CALC_TEMPLATE_PRECISION_REQUIRED', 'Verify the reporting precision against the laboratory SOP.');
    // The template controls precision; no preset or locale changes rounding.
    return Number(value.toFixed(decimals));
}
function positive(value, key) {
    if (!(value > 0)) throw error('CALC_INPUT_INVALID', 'A denominator or scale must be positive.', { input: key });
    return value;
}
function calculate(template, rawInputs, { numberFormat, curve = null, units } = {}) {
    validateTemplate(template);
    if (template.outputDecimals === null) throw error('CALC_TEMPLATE_PRECISION_REQUIRED', 'Verify the reporting precision against the laboratory SOP.');
    const native = units?.native, reporting = units?.reporting;
    if (!native || !reporting || native.code !== template.outputUnit || typeof reporting.code !== 'string' || !reporting.code.trim() ||
        typeof native.quantityKind !== 'string' || !native.quantityKind.trim() || native.quantityKind !== reporting.quantityKind ||
        !Number.isFinite(native.factorToBase) || native.factorToBase <= 0 || !Number.isFinite(reporting.factorToBase) || reporting.factorToBase <= 0) {
        throw error('CALC_TEMPLATE_UNIT_MISMATCH', 'Use compatible controlled native and reporting units.');
    }
    const conversionFactor = native.factorToBase / reporting.factorToBase;
    if (!Number.isFinite(conversionFactor) || conversionFactor <= 0) {
        throw error('CALC_TEMPLATE_UNIT_MISMATCH', 'The controlled-unit conversion must be finite and positive.');
    }
    if (!rawInputs || typeof rawInputs !== 'object' || Array.isArray(rawInputs)) {
        throw error('CALC_INPUT_REQUIRED', 'Enter the required raw measurements.');
    }
    const inputs = {}, numericInputs = {};
    for (const definition of template.inputs) {
        const raw = rawInputs[definition.key];
        if (raw == null || typeof raw === 'string' && !raw.trim()) {
            throw error('CALC_INPUT_REQUIRED', 'Enter the required raw measurement.', { input: definition.key });
        }
        const parsed = parseNumber(raw, numberFormat);
        if (!parsed.valid || parsed.qualifier) throw error('CALC_INPUT_INVALID', 'Enter an uncensored numeric raw measurement.', { input: definition.key, parserCode: parsed.code });
        inputs[definition.key] = raw;
        numericInputs[definition.key] = parsed.value;
    }
    if (Object.keys(rawInputs).some(key => !Object.hasOwn(inputs, key))) {
        throw error('CALC_INPUT_INVALID', 'The raw input is not defined by this template.');
    }
    const p = Object.fromEntries(template.parameters.map(row => [row.key, row.value]));
    const n = numericInputs, intermediate = { numericInputs }, params = JSON.parse(JSON.stringify(template.parameters));
    let output;
    switch (template.formulaModule) {
    case 'GRAVIMETRIC_MOISTURE': {
        const dryMass = positive(n.dryWithTare - n.tareMass, 'dryMass');
        const wetMass = positive(n.wetWithTare - n.tareMass, 'wetMass');
        if (wetMass < dryMass || n.tareMass < 0) throw error('CALC_INPUT_INVALID', 'Check the container and soil masses.');
        Object.assign(intermediate, { wetMass, dryMass, waterMass: wetMass - dryMass,
            ovenDryMassFraction: dryMass / wetMass, moistureCorrectionFactor: wetMass / dryMass });
        output = (wetMass - dryMass) / dryMass * 100;
        break;
    }
    case 'WALKLEY_BLACK': {
        positive(n.sampleMass, 'sampleMass'); positive(n.moistureCorrectionFactor, 'moistureCorrectionFactor');
        const titreDifference = n.blankTitre - n.sampleTitre;
        const carbonMass = titreDifference * p.ferrousNormality * p.carbonGramsPerMilliEquivalent;
        Object.assign(intermediate, { titreDifference, carbonMass });
        output = carbonMass * 100 * p.recoveryFactor * n.moistureCorrectionFactor / n.sampleMass;
        break;
    }
    case 'COLORIMETRIC_PHOSPHORUS': {
        if (!curve || !Number.isFinite(curve.slope) || curve.slope === 0 || !Number.isFinite(curve.intercept)) {
            throw error('CALC_CURVE_INVALID', 'A usable server-selected curve is required.');
        }
        for (const key of ['sampleMass', 'extractVolume', 'dilutionFactor', 'moistureCorrectionFactor']) positive(n[key], key);
        const concentration = (n.absorbance - curve.intercept) / curve.slope;
        const correctedConcentration = concentration - n.blankConcentration;
        Object.assign(intermediate, { concentration, correctedConcentration, curveSlope: curve.slope, curveIntercept: curve.intercept });
        // #199 pin6089156077: compare in the curve's mg/L before any
        // blank, volume, dilution, mass, moisture or reporting-unit conversion.
        if (Object.hasOwn(curve, 'calibrationMax')) {
            if (!Number.isFinite(curve.calibrationMax) || curve.calibrationMax < 0) throw error('CALC_CURVE_INVALID', 'The retained highest standard is invalid.');
            Object.assign(intermediate, { extractConcentration: concentration, calibrationMax: curve.calibrationMax,
                calibrationUnit: template.curve.xUnit, curveId: curve.id ?? null, curveRevision: curve.revision ?? null,
                aboveRange: concentration > curve.calibrationMax });
        }
        output = correctedConcentration * n.extractVolume * n.dilutionFactor * n.moistureCorrectionFactor / n.sampleMass;
        break;
    }
    case 'EXCHANGEABLE_CATION': {
        for (const key of ['sampleMass', 'extractVolume', 'dilutionFactor']) positive(n[key], key);
        const correctedConcentration = n.reading - n.blankConcentration;
        const mgPerKg = correctedConcentration * n.extractVolume * n.dilutionFactor / n.sampleMass;
        Object.assign(intermediate, { correctedConcentration, mgPerKg });
        output = mgPerKg / (p.equivalentWeight * 10);
        break;
    }
    case 'CEC_TITRATION': {
        for (const key of ['sampleMass', 'extractVolume', 'aliquotVolume']) positive(n[key], key);
        const titreDifference = n.sampleTitre - n.blankTitre, aliquotFactor = n.extractVolume / n.aliquotVolume;
        Object.assign(intermediate, { titreDifference, aliquotFactor });
        output = titreDifference * p.acidNormality * 100 / n.sampleMass * aliquotFactor;
        break;
    }
    case 'KJELDAHL': {
        positive(n.sampleMass, 'sampleMass');
        const titreDifference = n.sampleTitre - n.blankTitre;
        const mgPerGram = titreDifference * p.acidNormality * p.nitrogenMgPerMilliMole / n.sampleMass;
        Object.assign(intermediate, { titreDifference, mgPerGram });
        output = mgPerGram / 10;
        break;
    }
    }
    const unroundedOutput = output * conversionFactor;
    const roundedOutput = roundOutput(unroundedOutput, template.outputDecimals);
    // Pin6085050251: retain native precision, convert, then round exactly once
    // in the analysis reporting unit. All conversion evidence is caller-frozen.
    return { inputs, parameters: params, intermediate: { ...intermediate, unroundedOutput },
        nativeValue: output, nativeUnit: native.code, conversionFactor, unroundedOutput,
        unitConversion: { native: { ...native }, reporting: { ...reporting } },
        output: roundedOutput, outputUnit: reporting.code, outputDecimals: template.outputDecimals, engineVersion: ENGINE_VERSION };
}

function fitCurve(points) {
    if (!Array.isArray(points) || !points.length || points.some(point =>
        !Number.isFinite(point?.standardConcentration) || !Number.isFinite(point?.response) || point.standardConcentration < 0)) {
        throw error('CALIBRATION_POINT_INVALID', 'Record finite standard concentrations and responses.');
    }
    const count = points.length, levelCount = new Set(points.map(point => point.standardConcentration)).size;
    const meanX = points.reduce((sum, point) => sum + point.standardConcentration, 0) / count;
    const meanY = points.reduce((sum, point) => sum + point.response, 0) / count;
    let xx = 0, yy = 0, xy = 0;
    for (const point of points) {
        const x = point.standardConcentration - meanX, y = point.response - meanY;
        xx += x * x; yy += y * y; xy += x * y;
    }
    const slope = xx > 0 ? xy / xx : null;
    const intercept = slope === null ? null : meanY - slope * meanX;
    const r = xx > 0 && yy > 0 ? Math.max(-1, Math.min(1, xy / Math.sqrt(xx * yy))) : null;
    const usable = [slope, intercept, r].every(Number.isFinite) && slope !== 0;
    return { slope: usable ? slope : null, intercept: usable ? intercept : null,
        r: usable ? r : null, rSquared: usable ? r * r : null, pointCount: count, levelCount,
        calibrationMax: Math.max(...points.map(point => point.standardConcentration)), usable, failReason: usable ? null : 'DEGENERATE_FIT' };
}
module.exports = { ENGINE_VERSION, INPUTS, PARAMETERS, validateTemplate, calculate, roundOutput, fitCurve };
