const { valid } = require('../config/policyRegistry');

const failure = (code, message) => Object.assign(new Error(message), { statusCode: 400, code });
function numeric(value) {
    if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

// The caller supplies the resolved lab/analysis policy. No threshold or sigma
// fallback lives in the assessment, and classification precedes display rounding.
function evaluateProficiency(assignedValue, labResult, uncertainty, limits) {
    const sigma = numeric(uncertainty);
    if (sigma === null || sigma <= 0) throw failure('PT_SIGMA_REQUIRED', 'A finite, positive proficiency-assessment sigma is required.');
    const assigned = numeric(assignedValue), result = numeric(labResult);
    if (assigned === null || result === null) throw failure('PT_VALUES_INVALID', 'Assigned and laboratory values must be finite numbers.');
    if (!valid('pt.zScoreLimits', limits)) throw failure('POLICY_VALUE_INVALID', 'Proficiency limits are invalid.');
    const zScore = (result - assigned) / sigma;
    if (!Number.isFinite(zScore)) throw failure('PT_VALUES_INVALID', 'The proficiency score must be finite.');
    const absolute = Math.abs(zScore);
    const outcome = absolute >= limits.unsatisfactory ? 'UNSATISFACTORY'
        : absolute > limits.questionable ? 'QUESTIONABLE' : 'SATISFACTORY';
    return { zScore, outcome, classificationLimits: { questionable: limits.questionable, unsatisfactory: limits.unsatisfactory },
        ncrStatus: outcome === 'UNSATISFACTORY' ? 'PENDING' : null };
}

function legacySigmaFlag(uncertainty) {
    if (uncertainty === null || uncertainty === undefined) return 'SIGMA_MISSING';
    const sigma = numeric(uncertainty);
    return sigma === null || sigma <= 0 ? 'SIGMA_NONPOSITIVE' : null;
}

module.exports = { evaluateProficiency, legacySigmaFlag };
