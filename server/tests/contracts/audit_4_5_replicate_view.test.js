const { sampleReplicatePairView } = require('../../services/sampleReplicateView');
const registry = require('../../config/policyRegistry');
const policy = { mode: 'RPD', maxRpd: 10, nearLoqMultiplier: 5, absMax: null,
    absMaxBelow5LOQ: null, loq: 0.5, numberFormat: { decimal: '.', thousands: null }, recordedCriteria: true };
const row = (replicateNo, value, extra = {}) => ({ id: `result-${replicateNo}`, attemptId: 'retained-attempt',
    replicateNo, value, rawInput: value, param: 'owned-analysis', unit: 'owned-unit', basis: 'AIR_DRY',
    methodologyId: 'owned-method', equipmentId: 'owned-instrument', ...extra });
const project = (rows, overrides = {}) => sampleReplicatePairView(rows, { requiredCount: 2, source: 'FROZEN', policy, ...overrides });

test('required count defaults to one for all presets, and the registry enforces both integer bounds', () => {
    const definition = registry.definition('results.replicatesRequired');
    expect(Object.values(definition.presets)).toEqual([1, 1, 1]);
    expect(registry.valid('results.replicatesRequired', 1)).toBe(true);
    expect(registry.valid('results.replicatesRequired', 2)).toBe(true);
    for (const value of [null, 0, -1, 3, 1.5, '2']) expect(registry.valid('results.replicatesRequired', value)).toBe(false);
});
test('10.0 and 12.0 at ten percent fail without modifying either retained Result', () => {
    const rows = [row(1, '10.0'), row(2, '12.0')], before = JSON.stringify(rows);
    expect(project(rows)).toMatchObject({ source: 'FROZEN', status: 'FAIL', mean: 11, rpd: 18.18, criterion: 'RPD', limit: 10 });
    expect(JSON.stringify(rows)).toBe(before);
});
test('a passing pair is only a read view, not a reported-value selection', () => {
    const result = project([row(1, '10'), row(2, '10.5')]);
    expect(result).toMatchObject({ status: 'PASS', mean: 10.25, rpd: 4.88 });
    expect(result).not.toHaveProperty('selection');
});
test('missing observations stay pending, and count one leaves the pair unnecessary', () => {
    expect(project([row(1, '10')])).toMatchObject({ status: 'PENDING', mean: null });
    expect(project([row(1, '10'), row(2, '12')], { requiredCount: 1 })).toMatchObject({ status: 'NOT_REQUIRED', mean: null });
});
test.each(['<0.5', '>100', 'not-a-reading'])('%s is not averaged or assigned a guessed verdict', value => {
    expect(project([row(1, value), row(2, '12')])).toMatchObject({ status: 'NOT_EVALUABLE', mean: null, rpd: null });
});
test('near-LOQ pairs reuse the existing absolute-difference criterion', () => {
    expect(project([row(1, '1.1'), row(2, '1.3')])).toMatchObject({ status: 'PASS', criterion: 'ABSOLUTE_DIFFERENCE', rpd: null, limit: 0.5 });
});
test('absolute-mode criteria use the configured limit and never an analysis-name constant', () => {
    expect(project([row(1, '6.4'), row(2, '6.6')], { policy: { ...policy, mode: 'ABS_DIFF', absMax: 0.1 } }))
        .toMatchObject({ status: 'FAIL', criterion: 'ABS_DIFF', limit: 0.1 });
    expect(project([row(1, '6.4'), row(2, '6.6')], { policy: { ...policy, mode: 'ABS_DIFF', absMax: null } }))
        .toMatchObject({ status: 'NOT_EVALUABLE', reason: 'ABS_DIFF_UNSET' });
});
test.each(['attemptId', 'unit', 'basis', 'equipmentId', 'methodologyId'])('different %s refuses a comparable pair', key => {
    expect(project([row(1, '10'), row(2, '12', { [key]: 'different' })]))
        .toMatchObject({ status: 'NOT_EVALUABLE', reason: 'CONTEXT_MISMATCH', mean: null });
});
test('the third retained observation shows its range and leaves the verdict to review', () => {
    expect(project([row(1, '10'), row(2, '12'), row(3, '11')]))
        .toMatchObject({ status: 'REVIEW_REQUIRED', range: 2, mean: null, rpd: null });
});
