const { calculateUsdaTexture } = require('../utils/soilCalculations');

/**
 * Workbench Validation Service
 * Unified, method-aware validation engine for laboratory determinations, texture fractions,
 * and operational tasks across single entry, batch paste, and workbench queues.
 */

/**
 * Parse raw input string handling:
 * - Blank vs zero distinction: blank is empty/unperformed; 0 is a valid determination.
 * - Locale comma to decimal point: "6,42" -> 6.42.
 * - Censoring qualifiers: "<0.5" -> BELOW_LOQ, ">100" -> ABOVE_RANGE.
 *
 * @param {string|number|null|undefined} rawInput
 * @returns {object}
 */
function parseDeterminationValue(rawInput, numberFormat = require('./policyService').getStrictNumberFormat()) {
    return require('../../shared/resultValueValidation').parseResultValue(rawInput, numberFormat);
}
/**
 * Validate numeric value against analysis method specification rules (min, max, loq, lod).
 *
 * @param {string|number|null|undefined} value
 * @param {object|null} rules
 * @returns {object}
 */
function validateNumericMethod(value, rules = null, numberFormat = require('./policyService').getStrictNumberFormat(), parsedValue = null) {
    // Execution validation can reuse the trusted fraction parser output. No
    // request can supply this internal argument through the result authority.
    return require('../../shared/resultValueValidation').classifyResultValue(value, rules, numberFormat, parsedValue);
}

/**
 * Validate soil texture fractions (Sand, Silt, Clay) with live closure checking.
 * Supports positional arguments (sand, silt, clay, tolerance) or object/array format ({sand, silt, clay}, tolerance).
 *
 * @param {number|string|object|Array} sandOrObj
 * @param {number|string|object} [siltOrTol]
 * @param {number|string} [clay]
 * @param {number|object} [tolerance=2.0]
 * @returns {object}
 */
function validateTextureFractions(sandOrObj, siltOrTol, clay, tolerance = 2.0, numberFormat = require('./policyService').getStrictNumberFormat()) {
    let sand = sandOrObj;
    let silt = siltOrTol;
    let cVal = clay;
    let tol = tolerance;

    if (Array.isArray(sandOrObj)) {
        return {
            isValid: false,
            closureError: null,
            sum: null,
            className: null,
            code: null,
            flags: ['INVALID_FORMAT'],
            error: 'Fractions must be provided as an object with named fields { sand, silt, clay }, not a positional array'
        };
    }

    if (sandOrObj && typeof sandOrObj === 'object') {
        if (clay && typeof clay === 'object') numberFormat = clay;
        sand = sandOrObj.sand ?? sandOrObj.SAND ?? sandOrObj.Sand;
        silt = sandOrObj.silt ?? sandOrObj.SILT ?? sandOrObj.Silt;
        cVal = sandOrObj.clay ?? sandOrObj.CLAY ?? sandOrObj.Clay;
        if (siltOrTol !== undefined) {
            tol = siltOrTol;
        }
    }

    const pSand = parseDeterminationValue(sand, numberFormat);
    const pSilt = parseDeterminationValue(silt, numberFormat);
    const pClay = parseDeterminationValue(cVal, numberFormat);

    if (pSand.isBlank || pSilt.isBlank || pClay.isBlank) {
        return {
            isValid: false,
            closureError: null,
            sum: null,
            className: null,
            code: null,
            flags: ['INCOMPLETE_FRACTIONS'],
            error: 'All three fractions (Sand, Silt, Clay) are required'
        };
    }

    if (!pSand.isValid || !pSilt.isValid || !pClay.isValid || [pSand, pSilt, pClay].some(value => value.isCensored)) {
        return {
            isValid: false,
            closureError: null,
            sum: null,
            className: null,
            code: [pSand, pSilt, pClay].find(value => !value.isValid)?.code || 'INVALID_NUMBER',
            flags: ['INVALID_FORMAT'],
            error: 'Fractions must be valid positive numbers'
        };
    }

    const s = pSand.normalizedValue;
    const si = pSilt.normalizedValue;
    const c = pClay.normalizedValue;

    if (s < 0 || si < 0 || c < 0) {
        return {
            isValid: false,
            closureError: null,
            sum: null,
            className: null,
            code: null,
            flags: ['BELOW_MIN'],
            error: 'Fractions cannot be negative'
        };
    }

    const sum = Number((s + si + c).toFixed(2));
    const textureResult = calculateUsdaTexture(s, si, c, tol);

    const flags = [];
    if (!textureResult.isValid) {
        flags.push('TEXTURE_CLOSURE_FAILED');
    }

    const tolDisplay = (tol && typeof tol === 'object') ? tol.tolerance : tol;

    return {
        isValid: textureResult.isValid,
        sum,
        closureError: textureResult.closureError,
        withinTolerance: textureResult.isValid,
        className: textureResult.className,
        code: textureResult.code,
        fractions: { sand: s, silt: si, clay: c },
        parsedFractions:{SAND:pSand,SILT:pSilt,CLAY:pClay},
        flags,
        error: textureResult.isValid ? null : (textureResult.error || `Soil texture fractions sum to ${sum}%, exceeding closure tolerance of ±${tolDisplay}%`)
    };
}

/**
 * Validate operational task checklists (e.g. Drying SOP, Milling SOP).
 *
 * @param {Array<boolean>|string} checks
 * @param {number} requiredStepCount
 * @returns {object}
 */
function validateOperationalTask(checks, requiredStepCount = 1) {
    let checkList = checks;
    if (typeof checks === 'string') {
        try {
            checkList = JSON.parse(checks);
        } catch {
            checkList = [];
        }
    }

    if (!Array.isArray(checkList)) {
        return {
            isValid: false,
            completedSteps: 0,
            totalSteps: requiredStepCount,
            flags: ['INVALID_CHECKLIST_FORMAT']
        };
    }

    const completedSteps = checkList.filter(c => c === true).length;
    const isValid = completedSteps === requiredStepCount && checkList.length === requiredStepCount;

    return {
        isValid,
        completedSteps,
        totalSteps: requiredStepCount,
        flags: isValid ? [] : ['SOP_STEPS_INCOMPLETE']
    };
}

module.exports = {
    parseDeterminationValue,
    validateNumericMethod,
    validateTextureFractions,
    validateOperationalTask
};
