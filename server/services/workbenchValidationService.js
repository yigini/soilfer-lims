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
function parseDeterminationValue(rawInput) {
    if (rawInput === null || rawInput === undefined) {
        return {
            isBlank: true,
            isValid: false,
            normalizedValue: null,
            raw: '',
            censoring: 'NONE',
            isCensored: false,
            flags: []
        };
    }

    const str = String(rawInput).trim();
    if (str === '') {
        return {
            isBlank: true,
            isValid: false,
            normalizedValue: null,
            raw: '',
            censoring: 'NONE',
            isCensored: false,
            flags: []
        };
    }

    // Check for censoring prefix (<, <=, >, >=)
    const censorMatch = str.match(/^([<>]=?)\s*(.+)$/);
    if (censorMatch) {
        const symbol = censorMatch[1];
        const numPart = censorMatch[2].replace(',', '.').trim();
        const numVal = Number(numPart);

        if (isNaN(numVal)) {
            return {
                isBlank: false,
                isValid: false,
                normalizedValue: null,
                raw: str,
                censoring: 'NONE',
                isCensored: false,
                flags: ['INVALID_FORMAT']
            };
        }

        const isBelow = symbol.startsWith('<');
        return {
            isBlank: false,
            isValid: true,
            isCensored: true,
            censoring: isBelow ? 'BELOW_LOQ' : 'ABOVE_RANGE',
            limitValue: numVal,
            normalizedValue: numVal,
            raw: `${symbol}${numVal}`,
            flags: isBelow ? ['BELOW_LOQ'] : ['ABOVE_RANGE']
        };
    }

    // Standard numeric value with decimal comma conversion
    const normalizedStr = str.replace(',', '.');
    const numVal = Number(normalizedStr);

    if (isNaN(numVal)) {
        return {
            isBlank: false,
            isValid: false,
            normalizedValue: null,
            raw: str,
            censoring: 'NONE',
            isCensored: false,
            flags: ['INVALID_FORMAT']
        };
    }

    return {
        isBlank: false,
        isValid: true,
        isCensored: false,
        censoring: 'NONE',
        normalizedValue: numVal,
        raw: normalizedStr,
        flags: []
    };
}

/**
 * Validate numeric value against analysis method specification rules (min, max, loq, lod).
 *
 * @param {string|number|null|undefined} value
 * @param {object|null} rules
 * @returns {object}
 */
function validateNumericMethod(value, rules = null) {
    const parsed = parseDeterminationValue(value);
    if (parsed.isBlank) {
        return {
            ...parsed,
            flags: ['VALUE_REQUIRED']
        };
    }

    if (!parsed.isValid) {
        return parsed;
    }

    const flags = [...parsed.flags];
    const num = parsed.normalizedValue;

    if (rules) {
        // Hard limits (block completion without override)
        if (rules.min !== undefined && rules.min !== null && num < rules.min) {
            if (!flags.includes('BELOW_MIN')) flags.push('BELOW_MIN');
        }
        if (rules.max !== undefined && rules.max !== null && num > rules.max) {
            if (!flags.includes('ABOVE_MAX')) flags.push('ABOVE_MAX');
        }

        // Method detection limits (informational warnings)
        if (rules.loq !== undefined && rules.loq !== null && num < rules.loq && !parsed.isCensored) {
            if (!flags.includes('BELOW_LOQ')) flags.push('BELOW_LOQ');
        }
        if (rules.lod !== undefined && rules.lod !== null && num < rules.lod && !parsed.isCensored) {
            if (!flags.includes('BELOW_LOD')) flags.push('BELOW_LOD');
        }
    }

    const hasHardViolation = flags.some(f => ['INVALID_FORMAT', 'BELOW_MIN', 'ABOVE_MAX', 'VALUE_REQUIRED'].includes(f));

    return {
        ...parsed,
        flags,
        isValid: !hasHardViolation
    };
}

/**
 * Validate soil texture fractions (Sand, Silt, Clay) with live closure checking (100% ± 2.0%).
 *
 * @param {number|string} sand
 * @param {number|string} silt
 * @param {number|string} clay
 * @param {number} [tolerance=2.0]
 * @returns {object}
 */
function validateTextureFractions(sand, silt, clay, tolerance = 2.0) {
    const pSand = parseDeterminationValue(sand);
    const pSilt = parseDeterminationValue(silt);
    const pClay = parseDeterminationValue(clay);

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

    if (!pSand.isValid || !pSilt.isValid || !pClay.isValid) {
        return {
            isValid: false,
            closureError: null,
            sum: null,
            className: null,
            code: null,
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
    const textureResult = calculateUsdaTexture(s, si, c, tolerance);

    const flags = [];
    if (!textureResult.isValid) {
        flags.push('TEXTURE_CLOSURE_FAILED');
    }

    return {
        isValid: textureResult.isValid,
        sum,
        closureError: textureResult.closureError,
        withinTolerance: textureResult.isValid,
        className: textureResult.className,
        code: textureResult.code,
        normalized: textureResult.normalized,
        fractions: { sand: s, silt: si, clay: c },
        flags,
        error: textureResult.isValid ? null : `Fractions sum to ${sum}% (closure error ${textureResult.closureError}% exceeds allowed ±${tolerance}%)`
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

    const completedSteps = checkList.filter(Boolean).length;
    const isValid = completedSteps >= requiredStepCount && checkList.length >= requiredStepCount;

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
