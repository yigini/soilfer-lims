const { evaluateProficiency, legacySigmaFlag } = require('../../services/proficiencyAssessmentService');
const { registry, PRESETS, strict, valid } = require('../../config/policyRegistry');

const limits = strict('pt.zScoreLimits');
test('equipment and PT policies expose every pinned preset and scope', () => {
    for (const preset of PRESETS) {
        expect(registry['equipment.requireEquipment'].presets[preset]).toBe('AUTO');
        expect(registry['equipment.unconfiguredReadiness'].presets[preset]).toEqual({ CRITICAL: 'BLOCK', IMPORTANT: 'WARN', NON_CRITICAL: 'ALLOW' });
        expect(registry['pt.zScoreLimits'].presets[preset]).toEqual({ questionable: 2, unsatisfactory: 3 });
    }
    expect(registry['equipment.requireEquipment'].scope).toBe('LAB+METHOD');
    expect(registry['pt.zScoreLimits']).toMatchObject({ scope: 'LAB', analysisOverridesAll: true });
});
test('criticality policy rejects omitted, extra or illegal classifications', () => {
    expect(valid('equipment.unconfiguredReadiness', { CRITICAL: 'BLOCK', IMPORTANT: 'WARN', NON_CRITICAL: 'ALLOW' })).toBe(true);
    for (const value of [null, [], { CRITICAL: 'BLOCK' }, { CRITICAL: 'BLOCK', IMPORTANT: 'WARN', NON_CRITICAL: 'READY' },
        { CRITICAL: 'BLOCK', IMPORTANT: 'WARN', NON_CRITICAL: 'ALLOW', OTHER: 'ALLOW' }]) expect(valid('equipment.unconfiguredReadiness', value)).toBe(false);
});
test('PT limits require finite, positive, strictly ordered thresholds and no extra fields', () => {
    for (const value of [{ questionable: 0, unsatisfactory: 3 }, { questionable: 3, unsatisfactory: 3 },
        { questionable: 4, unsatisfactory: 3 }, { questionable: 2, unsatisfactory: Infinity },
        { questionable: NaN, unsatisfactory: 3 }, { questionable: 2, unsatisfactory: 3, rounding: 2 }]) expect(valid('pt.zScoreLimits', value)).toBe(false);
});
test.each([[2, 'SATISFACTORY'], [2.0001, 'QUESTIONABLE'], [2.9999, 'QUESTIONABLE'], [3, 'UNSATISFACTORY'],
    [-3, 'UNSATISFACTORY']])('z=%s is classified without rounding as %s', (z, outcome) => {
    const assessed = evaluateProficiency(0, z, 1, limits);
    expect(assessed.zScore).toBe(z);
    expect(assessed.outcome).toBe(outcome);
    expect(assessed.ncrStatus).toBe(outcome === 'UNSATISFACTORY' ? 'PENDING' : null);
});
test('custom resolved limits govern the score and are detached for freezing', () => {
    const configured = { questionable: 4, unsatisfactory: 6 };
    const assessed = evaluateProficiency(0, 3, 1, configured);
    expect(assessed.outcome).toBe('SATISFACTORY');
    configured.unsatisfactory = 2;
    expect(assessed.classificationLimits).toEqual({ questionable: 4, unsatisfactory: 6 });
    expect(evaluateProficiency(0, 6, 1, assessed.classificationLimits).outcome).toBe('UNSATISFACTORY');
});
test('z retains full precision and numeric input never invents a missing value', () => {
    expect(evaluateProficiency(20, 23.5, 1.5, limits).zScore).toBe((23.5 - 20) / 1.5);
    expect(evaluateProficiency('0', '2.9999', '1', limits).outcome).toBe('QUESTIONABLE');
    for (const value of [null, undefined, '', false, [], 'not a number', Infinity]) {
        expect(() => evaluateProficiency(value, 1, 1, limits)).toThrow(expect.objectContaining({ code: 'PT_VALUES_INVALID' }));
    }
});
test.each([null, undefined, '', 0, -1, Infinity, NaN, false, [], 'bad'])('invalid sigma %s is refused rather than defaulting to one', sigma => {
    expect(() => evaluateProficiency(0, 3, sigma, limits)).toThrow(expect.objectContaining({ code: 'PT_SIGMA_REQUIRED' }));
});
test('legacy diagnostics distinguish missing/nonpositive sigma and retain valid explicit 1.0', () => {
    expect(legacySigmaFlag(null)).toBe('SIGMA_MISSING');
    expect(legacySigmaFlag(0)).toBe('SIGMA_NONPOSITIVE');
    expect(legacySigmaFlag(-1)).toBe('SIGMA_NONPOSITIVE');
    expect(legacySigmaFlag(Infinity)).toBe('SIGMA_NONPOSITIVE');
    expect(legacySigmaFlag(1)).toBeNull();
});
