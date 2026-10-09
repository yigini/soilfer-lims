const { TransitionError } = require('./workflowStateRules');

function refused(code, message) { return new TransitionError(message, 409, code); }

// The caller supplies each selected attempt's stored QcRule and its controlled
// unit. This contract never consults the current rule or converts unlike units.
function calculateReportedMean(rows, limits) {
    if (!Array.isArray(rows) || rows.length < 2 || !Array.isArray(limits)) {
        throw refused('REPORTED_VALUE_SELECTION_INVALID', 'Choose complete recorded replicate sets.');
    }
    const attemptIds = [...new Set(rows.map(row => row.attemptId))];
    if (attemptIds.some(id => !id) || limits.length !== attemptIds.length ||
        new Set(limits.map(row => row.attemptId)).size !== limits.length ||
        attemptIds.some(id => !limits.some(row => row.attemptId === id))) {
        throw refused('REPORTED_VALUE_LIMIT_MISMATCH', 'Every selected attempt needs its own recorded rule.');
    }
    if (limits.some(row => row.r == null)) {
        throw refused(attemptIds.length === 1 ? 'REPORTED_VALUE_LIMIT_MISSING' : 'REPORTED_VALUE_LIMIT_MISMATCH',
            'Set a repeatability limit for every selected execution before averaging.');
    }
    if (limits.some(row => !['QC_RULE', 'DEFAULT_RULE'].includes(row.source) ||
        row.source === 'QC_RULE' && (!row.qcRuleId || !Number.isInteger(row.qcRuleVersion) || row.qcRuleVersion < 1) ||
        row.source === 'DEFAULT_RULE' && (row.qcRuleId != null || row.qcRuleVersion != null || !Number.isInteger(row.policyVersion) || row.policyVersion < 0) ||
        !Number.isFinite(row.r) || row.r < 0) || new Set(limits.map(row => row.r)).size !== 1) {
        throw refused('REPORTED_VALUE_LIMIT_MISMATCH', 'The recorded repeatability limits do not agree.');
    }
    if (new Set(rows.map(row => row.param)).size !== 1 || new Set(rows.map(row => row.methodologyId ?? null)).size !== 1 ||
        limits.some(row => !row.controlledUnit) || new Set(limits.map(row => row.controlledUnit)).size !== 1 ||
        rows.some(row => row.unit !== limits.find(limit => limit.attemptId === row.attemptId).controlledUnit ||
            (row.methodologyId ?? null) !== (limits.find(limit => limit.attemptId === row.attemptId).methodologyId ?? null))) {
        throw refused('REPORTED_VALUE_LIMIT_MISMATCH', 'A mean requires the same output, method and controlled unit.');
    }
    if (rows.some(row => row.censoring != null && row.censoring !== 'NONE')) {
        throw refused('REPORTED_VALUE_CENSORED_MEAN', 'Censored values cannot be averaged.');
    }
    const values = rows.map(row => String(row.value).trim() === '' ? NaN : Number(row.value));
    if (values.some(value => !Number.isFinite(value))) {
        throw refused('REPORTED_VALUE_NON_NUMERIC_MEAN', 'Only numerical measurements can be averaged.');
    }
    const r = limits[0].r;
    if (Math.max(...values) - Math.min(...values) > r) {
        throw refused('REPORTED_VALUE_OUTSIDE_LIMIT', 'The selected measurements exceed their recorded repeatability limit.');
    }
    // Divide before summing to avoid intermediate overflow. Retain full precision
    // here; Methodology.decimalPlaces applies once at report rendering.
    const value = values.reduce((sum, row) => sum + row / values.length, 0);
    if (!Number.isFinite(value)) throw refused('REPORTED_VALUE_NON_NUMERIC_MEAN', 'The mean is not finite.');
    return { value, valueText: String(value), unit: limits[0].controlledUnit, censoring: 'NONE' };
}

module.exports = { calculateReportedMean };
