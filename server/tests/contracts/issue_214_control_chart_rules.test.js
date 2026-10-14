const { evaluateSeries, statistics, ordered } = require('../../services/controlChartRules');
const registry = require('../../config/policyRegistry');
const { hasPermission } = require('../../config/roles');
const basis = { mode: 'CONTROL_CHART', key: 'set:a', controlLimitSetId: 'a', mean: 100, sd: 10 };
const point = (z, i, runId = 'run:' + i) => ({ measurementId: 'm:' + i, value: 100 + z * 10, runId,
    executionTime: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(), sequenceIndex: 1, basisKey: basis.key });
const evaluate = (values, rule, runId) => evaluateSeries({ basis, current: values.map((z, i) => point(z, i, runId)),
    rules: { reject: [rule], warn: [], review: [] } });

test.each([
    ['1-2s', [2.0001], [2]], ['1-3s', [-3.0001], [-3]], ['2-2s', [2.1, 2.2], [2.1, -2.2]],
    ['4-1s', [1.1, 1.2, 1.3, 1.4], [1.1, 1.2, 1.3, 1]],
    ['10x', Array(10).fill(-0.1), [...Array(9).fill(-0.1), 0]]
])('%s fires only beyond its strict boundary', (rule, firing, boundary) => {
    expect(evaluate(firing, rule).reject).toEqual([rule]);
    expect(evaluate(boundary, rule).reject).toEqual([]);
});
test('R-4s cannot compare two different runs and records one-point runs as not applicable', () => {
    expect(evaluate([2.1, -2.1], 'R-4s').rules.find(row => row.rule === 'R-4s').status).toBe('NOT_APPLICABLE');
    expect(evaluate([2.1, -2.1], 'R-4s', 'same').reject).toEqual(['R-4s']);
    expect(evaluate([2, -2.1], 'R-4s', 'same').reject).toEqual([]);
});
test('sequence rules span runs, include failed controls, and count multiple positions in one run', () => {
    const history = [point(2.1, 0)]; history[0].runVerdict = 'QC_FAIL';
    const current = [point(2.2, 1), { ...point(2.3, 2), runId: 'run:1', sequenceIndex: 2 }];
    expect(evaluateSeries({ basis, history, current, rules: { reject: ['2-2s'], warn: [], review: [] } }).reject).toEqual(['2-2s']);
});
test('history cannot cross a limit-basis reset', () => {
    expect(() => evaluateSeries({ basis, history: [{ ...point(2.1, 0), basisKey: 'old-lot-or-set' }], current: [point(2.1, 1)],
        rules: { reject: ['2-2s'], warn: [] } })).toThrow(expect.objectContaining({ code: 'QC_CHART_BASIS_MISMATCH', statusCode: 422 }));
    expect(evaluateSeries({ basis, history: [], current: [point(2.1, 1)], rules: { reject: ['2-2s'], warn: [] } }).reject).toEqual([]);
});
test('provisional and fixed windows never report multirules as passed', () => {
    for (const mode of ['PROVISIONAL', 'FIXED_WINDOW']) {
        const result = evaluateSeries({ basis: { ...basis, mode }, current: [point(4, 0)], rules: registry.strict('qc.westgardRules') });
        expect(result.firedRules).toEqual([]); expect(result.rules.every(row => row.status.startsWith('NOT_EVALUATED_'))).toBe(true);
        expect(result.observations[0].zScore).toBeNull();
    }
});
test('explicit review mapping is independent of reject/warn verdicts', () => {
    const result = evaluateSeries({ basis, current: [1.1, 1.2, 1.3, 1.4].map((z,i) => point(z,i)), rules: registry.strict('qc.westgardRules') });
    expect(result.review).toEqual(['4-1s']); expect(result.reject).toEqual([]); expect(result.warn).toEqual([]);
    expect(evaluateSeries({ basis, current: result.observations, rules: { reject: [], warn: ['4-1s'] } }).review).toEqual([]);
});
test('mapping rejects duplicates and preserves old overrides without a review key', () => {
    expect(registry.valid('qc.westgardRules', { reject: ['1-3s'], warn: [] })).toBe(true);
    expect(registry.valid('qc.westgardRules', { reject: ['4-1s'], warn: [], review: ['4-1s'] })).toBe(false);
    expect(registry.strict('qc.controlChartMinPoints')).toBe(20);
    expect(registry.registry['qc.westgardRules'].presets.BASIC.review).toEqual([]);
    for (const role of ['LAB_MANAGER', 'SUPER_ADMIN', 'MASTER_USER']) expect(hasPermission({role},'APPROVE_CONTROL_LIMITS')).toBe(true);
    expect(hasPermission({role:'LAB_TECHNICIAN'},'APPROVE_CONTROL_LIMITS')).toBe(false);
});
test('order is execution time then QC index then deterministic id; unknown metadata refuses', () => {
    const a = point(0, 0), b = { ...a, measurementId: 'b', sequenceIndex: 2 }, c = { ...a, measurementId: 'a' };
    expect(ordered([b,a,c]).map(row => row.measurementId)).toEqual(['a',a.measurementId,'b']);
    for (const missing of [{executionTime:null},{sequenceIndex:null},{measurementId:''}]) {
        expect(() => ordered([{...a,...missing}])).toThrow(expect.objectContaining({code:'QC_CHART_ORDER_AMBIGUOUS',statusCode:422}));
    }
});
test('baseline uses arithmetic mean and sample SD, refuses constant or nonfinite baselines', () => {
    expect(statistics([1,2,3])).toEqual({mean:2,sd:1,n:3});
    expect(() => statistics([1,1,1])).toThrow(expect.objectContaining({code:'QC_CHART_SD_INVALID'}));
    expect(() => statistics([1,Infinity])).toThrow(expect.objectContaining({code:'QC_CHART_BASELINE_INVALID'}));
});
test('a stored evaluation is independent of later changes to input values and limits', () => {
    const frozen = JSON.stringify(evaluate([3.1], '1-3s'));
    const later = evaluateSeries({ basis:{...basis,mean:200}, current:[point(3.1,0)], rules:{reject:['1-3s'],warn:[]} });
    expect(later.observations[0].zScore).not.toBe(JSON.parse(frozen).observations[0].zScore);
    expect(JSON.parse(frozen).observations[0].zScore).toBeCloseTo(3.1);
});
