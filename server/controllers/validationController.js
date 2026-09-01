const prisma = require('../prisma');

exports.validateResult = async (paramId, value) => {
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
        if (/^[<>]\s*-?\d+(\.\d+)?$/.test(strVal.replace(',', '.'))) {
            return { valid: true, flags: ['CENSORED_VALUE'], isCensored: true };
        }
        return { valid: false, flags: ['INVALID_FORMAT'] };
    }

    const numVal = parseFloat(normalizedStr);
    const flags = [];

    // Optimization: Cache could be added here
    let rules = null;
    if (paramId) {
        const analysis = await prisma.analysis.findUnique({ where: { code: paramId } });
        if (analysis?.validation) {
            try {
                rules = JSON.parse(analysis.validation);
            } catch (e) {
                // ignore
            }
        }
    }

    if (rules) {
        if (rules.min !== undefined && numVal < rules.min) {
            flags.push('BELOW_MIN');
        }
        if (rules.max !== undefined && numVal > rules.max) {
            flags.push('ABOVE_MAX');
        }
    }

    return {
        valid: flags.length === 0,
        flags,
        normalizedValue: numVal
    };
};

// Also export a route handler if needed, but this is mostly a service helper for ResultsController
exports.validateBatch = async (measurements) => {
    return Promise.all(measurements.map(async m => ({
        ...m,
        validation: await exports.validateResult(m.param, m.value)
    })));
};
