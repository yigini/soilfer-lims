const prisma = require('../prisma');

exports.validateResult = async (paramId, value) => {
    // Optimization: Cache could be added here
    const analysis = await prisma.analysis.findUnique({ where: { code: paramId } });

    // If no analysis or no validation rules, assume valid
    if (!analysis || !analysis.validation) return { valid: true, flags: [] };

    let rules;
    try {
        rules = JSON.parse(analysis.validation);
    } catch (e) {
        return { valid: true, flags: [] };
    }

    const numVal = parseFloat(value);
    const flags = [];

    if (isNaN(numVal)) {
        return { valid: false, flags: ['INVALID_FORMAT'] };
    }

    if (rules.min !== undefined && numVal < rules.min) {
        flags.push('BELOW_MIN');
    }

    if (rules.max !== undefined && numVal > rules.max) {
        flags.push('ABOVE_MAX');
    }

    return {
        valid: flags.length === 0,
        flags
    };
};

// Also export a route handler if needed, but this is mostly a service helper for ResultsController
exports.validateBatch = async (measurements) => {
    return Promise.all(measurements.map(async m => ({
        ...m,
        validation: await exports.validateResult(m.param, m.value)
    })));
};
