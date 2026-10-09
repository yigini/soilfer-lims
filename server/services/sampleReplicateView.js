const { parseDuplicateObservation } = require('../../shared/numberParse');
const { evaluateDuplicate } = require('./qcService');

// A read projection over a caller's complete, explicitly owned execution.
// It cannot allocate an attempt, select a reported value, or alter QC status.
function sampleReplicatePairView(measurements, { requiredCount, source, countSource = source, policy }) {
    const rows = measurements.filter(row => [1, 2, 3].includes(row.replicateNo));
    const view = { requiredCount, source, countSource, status: 'PENDING', reason: null,
        measurements: rows.map(row => ({ id: row.id, attemptId: row.attemptId, replicateNo: row.replicateNo,
            value: row.value, rawInput: row.rawInput ?? null, unit: row.unit, basis: row.basis })),
        mean: null, rpd: null, absoluteDifference: null, range: null };
    if (requiredCount === 1) return { ...view, status: 'NOT_REQUIRED' };
    const one = rows.filter(row => row.replicateNo === 1), two = rows.filter(row => row.replicateNo === 2);
    if (!one.length || !two.length) return view;
    const third = rows.filter(row => row.replicateNo === 3);
    if (one.length !== 1 || two.length !== 1 || third.length > 1 || !one[0].attemptId ||
        ['attemptId', 'param', 'unit', 'basis', 'equipmentId', 'methodologyId'].some(key =>
            rows.some(row => (row[key] ?? null) !== (one[0][key] ?? null)))) {
        return { ...view, status: 'NOT_EVALUABLE', reason: 'CONTEXT_MISMATCH' };
    }
    const input = row => row.rawInput ?? (typeof row.numericValue === 'number' ? row.numericValue : row.value);
    const observed = rows.map(row => parseDuplicateObservation(input(row), policy.numberFormat));
    if (observed.some(row => !row.valid || row.censored)) return { ...view, status: 'NOT_EVALUABLE',
        reason: observed.some(row => row.censored) ? 'CENSORED' : 'NON_NUMERIC' };
    if (third.length) {
        const values = observed.map(row => row.value);
        return { ...view, status: 'REVIEW_REQUIRED', range: Math.max(...values) - Math.min(...values) };
    }
    const evaluated = evaluateDuplicate({ id: one[0].attemptId, rawInput: { value1: input(one[0]), value2: input(two[0]) } }, policy);
    if (!['PASS', 'FAIL'].includes(evaluated.status)) return { ...view, status: 'NOT_EVALUABLE', reason: evaluated.criterion || 'NON_NUMERIC' };
    const values = [one[0], two[0]].map(row => parseDuplicateObservation(input(row), policy.numberFormat).value);
    return { ...view, status: evaluated.status, criterion: evaluated.criterion,
        mean: values[0] / 2 + values[1] / 2, rpd: evaluated.rpd ?? null,
        absoluteDifference: evaluated.absoluteDifference ?? null,
        limit: evaluated.absMax ?? evaluated.maxRpd, loq: evaluated.loq };
}

module.exports = { sampleReplicatePairView };
