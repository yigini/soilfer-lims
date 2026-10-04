const policyService = require('./policyService');

async function getNumberFormat(labId, context = {}) {
    const [decimal, thousands] = await Promise.all([
        policyService.get(labId, 'numbers.decimalSeparator', context),
        policyService.get(labId, 'numbers.thousandsSeparator', context)
    ]);
    const format = { decimal, thousands };
    if (!require('../../shared/numberParse').validateNumberFormat(format)) {
        throw Object.assign(new Error('Invalid laboratory number settings.'), { statusCode: 409, code: 'NUMBER_FORMAT_POLICY_INVALID' });
    }
    return format;
}

module.exports = { getNumberFormat };
