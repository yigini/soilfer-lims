// #214 scientific authority: Claudio6148143929. Pure evaluation of explicitly
// frozen inputs; this module never discovers live history or rewrites evidence.
const { valid } = require('../config/policyRegistry');
const fail = (code, message) => Object.assign(new Error(message), { statusCode: 422, code });
const RULES = ['1-2s', '1-3s', '2-2s', 'R-4s', '4-1s', '10x'];
function ordered(observations) {
    if (!Array.isArray(observations) || new Set(observations.map(row => row?.measurementId)).size !== observations.length) {
        throw fail('QC_CHART_OBSERVATIONS_INVALID', 'Provide distinct identified QC observations.');
    }
    return observations.map(row => {
        const time = typeof row?.executionTime === 'string' || row?.executionTime instanceof Date ? new Date(row.executionTime).getTime() : NaN;
        if (!Number.isFinite(time) || !Number.isSafeInteger(row.sequenceIndex) || row.sequenceIndex < 1 ||
            typeof row.measurementId !== 'string' || !row.measurementId || typeof row.runId !== 'string' || !row.runId) {
            throw fail('QC_CHART_ORDER_AMBIGUOUS', 'An execution time, QC sequence index and measurement id are required.');
        }
        if (!Number.isFinite(row.value)) throw fail('QC_CHART_VALUE_INVALID', 'Control charts require a finite uncensored value.');
        return { ...row, executionTime: new Date(time).toISOString() };
    }).sort((a, b) => a.executionTime.localeCompare(b.executionTime) || a.sequenceIndex - b.sequenceIndex ||
        (a.measurementId < b.measurementId ? -1 : a.measurementId > b.measurementId ? 1 : 0));
}
function statistics(values) {
    if (!Array.isArray(values) || values.length < 2 || !values.every(Number.isFinite)) throw fail('QC_CHART_BASELINE_INVALID', 'A baseline needs finite observations.');
    // Centred summation avoids the cancellation of sum(x²) - n*mean².
    const mean = values[0] + values.reduce((sum, value) => sum + (value - values[0]), 0) / values.length;
    const sd = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1));
    if (!Number.isFinite(mean) || !Number.isFinite(sd) || sd <= 0) throw fail('QC_CHART_SD_INVALID', 'An approved chart needs a positive finite sample SD.');
    return { mean, sd, n: values.length };
}
function evaluateSeries({ basis, history = [], current = [], rules }) {
    if (!valid('qc.westgardRules', rules)) throw fail('QC_CHART_RULES_INVALID', 'Invalid Westgard rule mapping.');
    if (!basis || !['PROVISIONAL', 'FIXED_WINDOW', 'CONTROL_CHART'].includes(basis.mode)) throw fail('QC_CHART_BASIS_INVALID', 'A frozen limit basis is required.');
    const currentIds = new Set(current.map(row => row.measurementId)), observations = ordered([...history, ...current]);
    if (!basis.key || observations.some(row => row.basisKey !== basis.key)) throw fail('QC_CHART_BASIS_MISMATCH', 'History must have the same frozen limit basis.');
    if (basis.mode !== 'CONTROL_CHART') {
        return { basis, observations: observations.map(row => ({ ...row, zScore: null })),
            rules: RULES.map(rule => ({ rule, action: null, status: basis.mode === 'PROVISIONAL' ? 'NOT_EVALUATED_PROVISIONAL' : 'NOT_EVALUATED_FIXED_WINDOW', observationIds: [] })),
            firedRules: [], reject: [], warn: [], review: [] };
    }
    if (!basis.controlLimitSetId || !Number.isFinite(basis.mean) || !Number.isFinite(basis.sd) || basis.sd <= 0) throw fail('QC_CHART_BASIS_INVALID', 'Chart limits require an approved set and positive sample SD.');
    const points = observations.map(row => ({ ...row, zScore: (row.value - basis.mean) / basis.sd }));
    if (points.some(row => !Number.isFinite(row.zScore))) throw fail('QC_CHART_VALUE_INVALID', 'The observation cannot be represented against these limits.');
    const sameSideBeyond = (rows, threshold) => rows.every(row => row.zScore > threshold) || rows.every(row => row.zScore < -threshold);
    const triggered = new Map(RULES.map(rule => [rule, new Set()]));
    for (let index = 0; index < points.length; index++) {
        const point = points[index];
        if (!currentIds.has(point.measurementId)) continue;
        for (const [rule, size, threshold] of [['1-2s', 1, 2], ['1-3s', 1, 3], ['2-2s', 2, 2], ['4-1s', 4, 1], ['10x', 10, 0]]) {
            const window = points.slice(Math.max(0, index - size + 1), index + 1);
            if (window.length === size && sameSideBeyond(window, threshold)) window.forEach(row => triggered.get(rule).add(row.measurementId));
        }
        const run = points.filter(row => row.runId === point.runId);
        if (run.some(row => row.zScore > 2) && run.some(row => row.zScore < -2)) run.forEach(row => triggered.get('R-4s').add(row.measurementId));
    }
    const configured = { reject: rules.reject, warn: rules.warn, review: rules.review || [] };
    const results = RULES.map(rule => {
        const action = Object.keys(configured).find(group => configured[group].includes(rule)) || null;
        const applicable = rule !== 'R-4s' || points.some(row => currentIds.has(row.measurementId) && points.filter(other => other.runId === row.runId).length >= 2);
        return { rule, action, status: !action ? 'DISABLED' : !applicable ? 'NOT_APPLICABLE' : triggered.get(rule).size ? 'FIRED' : 'NOT_FIRED',
            observationIds: [...triggered.get(rule)] };
    });
    const fired = results.filter(row => row.status === 'FIRED');
    return { basis, observations: points, rules: results, firedRules: fired.map(row => row.rule),
        ...Object.fromEntries(Object.keys(configured).map(group => [group, fired.filter(row => row.action === group).map(row => row.rule)])) };
}
module.exports = { RULES, ordered, statistics, evaluateSeries };
