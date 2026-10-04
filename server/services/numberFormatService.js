const policyService = require('./policyService');

async function getNumberFormat(labId, context = {}) {
    const used = context.snapshot || await policyService.snapshot(labId, context);
    const format = { decimal: used.values['numbers.decimalSeparator'], thousands: used.values['numbers.thousandsSeparator'] };
    if (!require('../../shared/numberParse').validateNumberFormat(format)) {
        throw Object.assign(new Error('Invalid laboratory number settings.'), { statusCode: 409, code: 'NUMBER_FORMAT_POLICY_INVALID' });
    }
    return format;
}

module.exports = { getNumberFormat };
