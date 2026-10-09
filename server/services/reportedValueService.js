const { normalizeUnit } = require('./interpretationService');

const CURRENT_VALID_RESULTS = { isCurrent: true, OR: [{ isValid: { not: false } }, { isValid: null }] };

function measuredValue(row, fallbackUnit = '') {
    const unit = row.unit || fallbackUnit;
    const numeric = String(row.value).trim() !== '' && Number.isFinite(Number(row.value));
    const norm = numeric ? normalizeUnit(row.param, row.value, unit) : { normalizedValue: null, standardUnit: '' };
    const asMeasured = numeric ? Number(row.value) : row.value;
    return { value: norm.normalizedValue ?? asMeasured, asMeasured, unit,
        normalizedValue: norm.normalizedValue ?? asMeasured, controlledUnit: norm.standardUnit || unit,
        numeric, normalizedNumeric: numeric && Number.isFinite(norm.normalizedValue) && !norm.unrecognizedUnit };
}

module.exports = { CURRENT_VALID_RESULTS, measuredValue };
