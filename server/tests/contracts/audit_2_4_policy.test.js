const { registry, valid } = require('../../config/policyRegistry');

test('batch QC requirement and calibration actions are scoped policies in every preset', () => {
    const requirement = registry['qc.requireBatchQc'], calibration = registry['qc.calibrationFailAction'];
    expect(requirement.scope).toBe('LAB+METHOD');
    expect(calibration.scope).toBe('LAB+METHOD');
    for (const preset of ['ISO17025_STRICT', 'BASIC', 'ADVISORY']) {
        expect(requirement.presets[preset]).toBe('AUTO');
        expect(calibration.presets[preset]).toEqual({ ICV: 'FAIL_BATCH', CCV: 'REPEAT_BRACKET', CCB: 'REPEAT_BRACKET' });
    }
    for (const value of ['AUTO', 'REQUIRED', 'NOT_REQUIRED']) expect(valid('qc.requireBatchQc', value)).toBe(true);
    for (const value of [null, true, false, '', 'REQUIRED_BLOCKING']) expect(valid('qc.requireBatchQc', value)).toBe(false);
});

test('calibration policy rejects illegal or extra actions without changing the retained four-key QC policy', () => {
    const base = { ICV: 'FAIL_BATCH', CCV: 'REPEAT_BRACKET', CCB: 'REPEAT_BRACKET' };
    for (const kind of ['ICV', 'CCV', 'CCB']) {
        for (const action of registry['qc.calibrationFailAction'].allowedActions[kind]) {
            expect(valid('qc.calibrationFailAction', { ...base, [kind]: action })).toBe(true);
        }
    }
    for (const value of [{ ...base, ICV: 'REPEAT_BRACKET' }, { ...base, CCV: 'REJECT' }, { ...base, LRM: 'WARN' }, { CCV: 'WARN', CCB: 'WARN' }, null, []]) {
        expect(valid('qc.calibrationFailAction', value)).toBe(false);
    }
    const retained = { BLANK: 'FAIL_BATCH', DUPLICATE: 'WARN', LRM: 'FAIL_BATCH', CRM: 'WARN' };
    expect(valid('qc.failAction', retained)).toBe(true);
    expect(valid('qc.failAction', { ...retained, CCV: 'WARN' })).toBe(false);
});
