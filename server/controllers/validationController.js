const prisma = require('../prisma');
const { calculateUsdaTexture, evaluateCnRatio, evaluateCecAndBases } = require('../utils/soilCalculations');

exports.validateResult = async (paramId, value, methodologyId = null) => {
    if (value === null || value === undefined || String(value).trim() === '') {
        return { valid: true, flags: [] }; // Blank or pending
    }

    const strVal = String(value).trim();
    // Normalize locale decimal comma: "12,5" -> "12.5"
    const normalizedStr = strVal.replace(',', '.');

    // Strict numeric regex: numbers like 12, 12.5, -0.5
    const isStrictNumeric = /^-?\d+(\.\d+)?$/.test(normalizedStr);

    if (!isStrictNumeric) {
        // Support below LOQ / above range censoring markers like "<0.5", "< 0.01", ">100"
        if (/^[<>]\s*-?\d+(\.\d+)?$/.test(normalizedStr)) {
            const cleanNum = parseFloat(normalizedStr.replace(/^[<>]\s*/, ''));
            return {
                valid: true,
                flags: ['CENSORED_VALUE'],
                isCensored: true,
                censoring: normalizedStr.startsWith('<') ? 'BELOW_LOQ' : 'ABOVE_RANGE',
                normalizedValue: cleanNum
            };
        }
        return { valid: false, flags: ['INVALID_FORMAT'] };
    }

    const numVal = parseFloat(normalizedStr);
    const flags = [];

    let analysis = null;
    let methodology = null;

    if (paramId) {
        [analysis, methodology] = await Promise.all([
            prisma.analysis.findUnique({ where: { code: paramId } }),
            methodologyId ? prisma.methodology.findUnique({ where: { id: methodologyId } }) : null
        ]);
    }

    // Method-specific limits override Analysis generic rules
    let min = methodology?.loq ?? analysis?.loq;
    let max = null;

    if (analysis?.validation) {
        try {
            const rules = JSON.parse(analysis.validation);
            if (rules.min !== undefined && min === undefined) min = rules.min;
            if (rules.max !== undefined) max = rules.max;
        } catch (e) { }
    }

    if (min !== null && min !== undefined && numVal < min) {
        flags.push('BELOW_MIN');
    }
    if (max !== null && max !== undefined && numVal > max) {
        flags.push('ABOVE_MAX');
    }

    return {
        valid: flags.length === 0,
        flags,
        normalizedValue: numVal,
        precision: methodology?.decimalPlaces ?? analysis?.decimalPlaces ?? 2
    };
};

/**
 * Validate full sample results matrix for cross-parameter scientific integrity.
 * @param {Array<{ param: string, value: any, unit?: string }>} results
 */
exports.validateSampleMatrix = (results) => {
    const resMap = {};
    results.forEach(r => {
        const num = parseFloat(String(r.value).replace(',', '.'));
        if (!isNaN(num)) {
            resMap[r.param.toUpperCase()] = { value: num, unit: r.unit };
        }
    });

    const diagnostics = {
        texture: null,
        cnRatio: null,
        basesAndCec: null,
        warnings: [],
        blockingErrors: [],
        isBlocking: false
    };

    // 1. Texture Check (Sand, Silt, Clay) - BLOCKING
    const sand = resMap.SAND?.value;
    const silt = resMap.SILT?.value;
    const clay = resMap.CLAY?.value;
    if (sand !== undefined && silt !== undefined && clay !== undefined) {
        diagnostics.texture = calculateUsdaTexture(sand, silt, clay);
        if (!diagnostics.texture.isValid) {
            const msg = `Texture closure failed: Sand(${sand}%) + Silt(${silt}%) + Clay(${clay}%) = ${(sand + silt + clay).toFixed(1)}% (must sum to 100% ± 2.0%)`;
            diagnostics.warnings.push(msg);
            diagnostics.blockingErrors.push({
                check: 'TEXTURE_CLOSURE',
                severity: 'BLOCKING',
                message: msg
            });
            diagnostics.isBlocking = true;
        }
    }

    // 2. C:N Ratio Check - ADVISORY
    const soc = resMap.SOC?.value ?? resMap.OC?.value ?? resMap.ORGANIC_CARBON?.value;
    const tn = resMap.TN?.value ?? resMap.TOTAL_N?.value ?? resMap.N_TOT?.value;
    const socUnit = resMap.SOC?.unit ?? resMap.OC?.unit ?? 'g/kg';
    const tnUnit = resMap.TN?.unit ?? resMap.TOTAL_N?.unit ?? 'g/kg';
    if (soc !== undefined && tn !== undefined) {
        diagnostics.cnRatio = evaluateCnRatio(soc, tn, socUnit, tnUnit);
        if (diagnostics.cnRatio.warning) {
            diagnostics.warnings.push(diagnostics.cnRatio.warning);
        }
    }

    // 3. Base Saturation & CEC Check - ADVISORY
    const cec = resMap.CEC?.value;
    const ca = resMap.EXCH_CA?.value ?? resMap.CA_EXCH?.value;
    const mg = resMap.EXCH_MG?.value ?? resMap.MG_EXCH?.value;
    const k = resMap.EXCH_K?.value ?? resMap.K_EXCH?.value;
    const na = resMap.EXCH_NA?.value ?? resMap.NA_EXCH?.value ?? 0;
    const ph = resMap.PH_H2O?.value ?? resMap.PH?.value ?? null;
    if (ca !== undefined && mg !== undefined && k !== undefined) {
        diagnostics.basesAndCec = evaluateCecAndBases(cec, ca, mg, k, na, ph);
        if (diagnostics.basesAndCec.warnings.length > 0) {
            diagnostics.warnings.push(...diagnostics.basesAndCec.warnings);
        }
    }

    return diagnostics;
};

// Also export a route handler helper for ResultsController
exports.validateBatch = async (measurements) => {
    return Promise.all(measurements.map(async m => ({
        ...m,
        validation: await exports.validateResult(m.param, m.value, m.methodologyId)
    })));
};

