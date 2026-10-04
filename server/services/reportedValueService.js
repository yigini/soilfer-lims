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

function selectReportedValue(rows, rule, { repeatabilityLimit, fallbackUnit = '' } = {}) {
    if (!['MEAN_IF_WITHIN_R', 'LATEST_VALID'].includes(rule)) {
        throw Object.assign(new Error('Reported-value policy could not be resolved.'), { statusCode: 409, code: 'RESULT_POLICY_UNRESOLVED' });
    }
    const current = rows.filter(row => row.isCurrent === true && row.isValid !== false);
    if (!current.length) return null;
    if (current.length === 1) return { ...measuredValue(current[0], fallbackUnit), replicateCount: 1, flag: '' };
    const values = current.map(row => measuredValue(row, fallbackUnit));
    const ambiguous = () => ({ value: '', asMeasured: '', normalizedValue: '', unit: '', controlledUnit: '', replicateCount: 0, flag: 'REPLICATES_AMBIGUOUS' });
    if (new Set(current.map(row => row.methodologyId || null)).size !== 1 ||
        values.some(value => !value.normalizedNumeric) || new Set(values.map(value => value.controlledUnit)).size !== 1) return ambiguous();
    if (rule === 'LATEST_VALID') {
        const newest = [...current].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || String(b.id).localeCompare(String(a.id)))[0];
        return { ...measuredValue(newest, fallbackUnit), replicateCount: 1, flag: '' };
    }
    const numericValues = values.map(value => value.normalizedValue);
    const rAvailable = Number.isFinite(repeatabilityLimit) && repeatabilityLimit >= 0;
    if (rAvailable && Math.max(...numericValues) - Math.min(...numericValues) > repeatabilityLimit) return ambiguous();
    // Phase 0 cannot assert agreement against r; #192 supplies the method limit.
    const mean = numericValues.reduce((sum, value) => sum + value / numericValues.length, 0);
    return { value: mean, asMeasured: '', normalizedValue: mean, unit: values[0].controlledUnit,
        controlledUnit: values[0].controlledUnit, replicateCount: current.length, flag: rAvailable ? '' : 'MEAN_UNCHECKED' };
}

module.exports = { CURRENT_VALID_RESULTS, measuredValue, selectReportedValue };
