const { calculateReportedMean } = require('../../services/reportedValueMeanContract');
const { buildSelectionLineage } = require('../../services/reportedValueSelectionLineage');
const fixture = (r = 1) => ({
    attempts: [{ id: 'original', status: 'QUESTIONED', evidenceHash: 'original-hash' },
        { id: 'child', status: 'ACCEPTED', evidenceHash: 'child-hash' }],
    rows: [{ id: 'r1', attemptId: 'original', param: 'PH_H2O', value: '12.0', unit: 'pH_units',
        methodologyId: 'method', censoring: 'NONE', isCurrent: false, supersededBy: 'r2' },
    { id: 'r2', attemptId: 'child', param: 'PH_H2O', value: '12.6', unit: 'pH_units',
        methodologyId: 'method', censoring: 'NONE', isCurrent: true, supersededBy: null }],
    limits: ['original', 'child'].map(attemptId => ({ attemptId, source: 'QC_RULE', qcRuleId: 'stored-rule', qcRuleVersion: 2,
        r, methodologyId: 'method', controlledUnit: 'pH_units' }))
});

test('the retained QUESTIONED12.0 and accepted12.6 give12.3 at r1.0 without changing any evidence', () => {
    const data = fixture(), original = JSON.stringify(data);
    const rows = buildSelectionLineage(data.attempts, data.rows).eligible.flatMap(row => row.results);
    expect(calculateReportedMean(rows, data.limits)).toEqual({ value: 12.3, valueText: '12.3', unit: 'pH_units', censoring: 'NONE' });
    expect(JSON.stringify(data)).toBe(original);
});

test('the same retained evidence refuses r0.5', () => {
    const data = fixture(0.5);
    expect(() => calculateReportedMean(data.rows, data.limits)).toThrow(expect.objectContaining({ statusCode: 409, code: 'REPORTED_VALUE_OUTSIDE_LIMIT' }));
});

test.each(['different limits', 'missing limit', 'missing rule', 'different methods', 'different units', 'different outputs',
    'uncontrolled unit', 'missing execution', 'duplicate rule'])('%s never supplies an inferred mean', kind => {
    const data = fixture();
    if (kind === 'different limits') data.limits[1].r = 2;
    if (kind === 'missing limit') data.limits[1].r = null;
    if (kind === 'missing rule') data.limits[1].qcRuleId = null;
    if (kind === 'different methods') data.rows[1].methodologyId = 'another-method';
    if (kind === 'different units') data.rows[1].unit = '%';
    if (kind === 'different outputs') data.rows[1].param = 'EC';
    if (kind === 'uncontrolled unit') data.limits.forEach(row => { row.controlledUnit = null; });
    if (kind === 'missing execution') data.limits.pop();
    if (kind === 'duplicate rule') data.limits[1].attemptId = 'original';
    const before = JSON.stringify(data);
    expect(() => calculateReportedMean(data.rows, data.limits)).toThrow(expect.objectContaining({ statusCode: 409, code: 'REPORTED_VALUE_LIMIT_MISMATCH' }));
    expect(JSON.stringify(data)).toBe(before);
});

test('one complete duplicate execution also needs r', () => {
    const data = fixture(); data.rows[1].attemptId = 'original'; data.limits = [data.limits[0]]; data.limits[0].r = null;
    expect(() => calculateReportedMean(data.rows, data.limits)).toThrow(expect.objectContaining({ code: 'REPORTED_VALUE_LIMIT_MISSING' }));
});

test.each(['BELOW_LOQ', 'ABOVE_RANGE'])('%s cannot be averaged', censoring => {
    const data = fixture(); data.rows[0].censoring = censoring;
    expect(() => calculateReportedMean(data.rows, data.limits)).toThrow(expect.objectContaining({ code: 'REPORTED_VALUE_CENSORED_MEAN' }));
});

test.each(['', 'Sandy loam', 'NaN', 'Infinity'])('non-numerical %s cannot be averaged', value => {
    const data = fixture(); data.rows[0].value = value;
    expect(() => calculateReportedMean(data.rows, data.limits)).toThrow(expect.objectContaining({ code: 'REPORTED_VALUE_NON_NUMERIC_MEAN' }));
});

test('zero r permits exactly equal duplicates and performs no premature rounding', () => {
    const data = fixture(0); data.rows.forEach(row => { row.value = '1.23456789'; });
    expect(calculateReportedMean(data.rows, data.limits).value).toBe(1.23456789);
});

test('large finite values do not overflow the intermediate sum', () => {
    const data = fixture(0); data.rows.forEach(row => { row.value = '1e308'; });
    expect(calculateReportedMean(data.rows, data.limits).value).toBe(1e308);
});

test('the resolver default is retained with its policy version rather than relabelled as a stored lab rule', () => {
    const data = fixture(); data.limits.forEach(row => { row.source = 'DEFAULT_RULE'; row.qcRuleId = null; row.qcRuleVersion = null; row.policyVersion = 7; });
    expect(calculateReportedMean(data.rows, data.limits).value).toBe(12.3);
});
