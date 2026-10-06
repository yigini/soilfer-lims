const { planRunSequence } = require('../../services/batchSequenceService');
const { validateRunSequence } = require('../../services/qcRunSequenceValidation');
function criteria(analysisCode, changes = {}) {
    const values = { maxBatchSize: 30, blankPerBatch: 1, lrmPerBatch: 1, duplicateEvery: 10,
        crmEveryNBatches: 0, ccvEvery: 10, ...changes };
    return { analysisCode, methodologyId: `method-${analysisCode}`, crmOrdinal: 1, qcMode: 'REQUIRED_BLOCKING', calibrationVerification: false,
        qcRule: { resolved: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { value, source: 'FIXTURE' }])) } };
}
function plan(a = criteria('A'), b = criteria('B', { duplicateEvery: 5 })) {
    const analyses = [a, b], samples = Array.from({ length: 25 }, (_, i) => ({ sampleId: `sample-${i}`, analysisCodes: i < 10 ? ['A'] : i < 20 ? ['B'] : ['A', 'B'] }));
    return { ...planRunSequence({ samples, analyses, seed: 'first-start-fixture' }), analyses };
}

test('start accepts mixed sample sets, real duplicate parents and extras without altering the planned sequence', () => {
    const p = plan(), before = JSON.stringify(p);
    const validated = validateRunSequence(p);
    expect(validated.forecasts.map(row => row.sampleCount)).toEqual([15, 15]);
    expect(validated.positions.filter(row => row.kind === 'DUPLICATE')).toHaveLength(3);
    expect(JSON.stringify(p)).toBe(before);
});

test('a policy count increase refuses a stale run while limit-only revisions and lower counts preserve its sequence', () => {
    const p = plan();
    expect(() => validateRunSequence({ ...p, analyses: [criteria('A', { blankPerBatch: 2 }), p.analyses[1]] }))
        .toThrow(expect.objectContaining({ statusCode: 409, code: 'QC_SEQUENCE_STALE', details: expect.objectContaining({ analysisCode: 'A',
            missing: [{ kind: 'BLANK', required: 2, actual: 1 }] }) }));
    expect(validateRunSequence({ ...p, analyses: [criteria('A', { blankAbsLimit: 0.0123456789, duplicateEvery: 20 }), p.analyses[1]] }).forecasts[0].qcRule.resolved.blankAbsLimit.value).toBe(0.0123456789);
});

test('actual allocated CRM ordinal wins over build forecast, and an extra CRM is permitted', () => {
    const p = plan(criteria('A', { crmEveryNBatches: 2 }));
    expect(p.positions.some(row => row.kind === 'CRM')).toBe(true);
    expect(validateRunSequence({ ...p, analyses: [{ ...p.analyses[0], crmOrdinal: 2 }, p.analyses[1]] }).positions.find(row => row.kind === 'CRM').servedAnalytes).toEqual([]);
    const without = plan({ ...criteria('A', { crmEveryNBatches: 2 }), crmOrdinal: 2 });
    expect(() => validateRunSequence({ ...without, analyses: [{ ...without.analyses[0], crmOrdinal: 3 }, without.analyses[1]] }))
        .toThrow(expect.objectContaining({ code: 'QC_SEQUENCE_STALE', details: expect.objectContaining({ analysisCode: 'A', crmOrdinal: 3, crmDue: true }) }));
});

test('lowered capacity refuses only the over-capacity analyte using its own sample count', () => {
    const p = plan();
    expect(() => validateRunSequence({ ...p, analyses: [p.analyses[0], criteria('B', { maxBatchSize: 14 })] }))
        .toThrow(expect.objectContaining({ statusCode: 409, code: 'QC_SEQUENCE_STALE', details: expect.objectContaining({ analysisCode: 'B', requested: 15, maxBatchSize: 14 }) }));
});

test('calibration activation or a shorter interval refuses stale ordering; mixed-analyte boundaries remain valid', () => {
    const uncalibrated = plan(), enabledA = { ...criteria('A'), calibrationVerification: true };
    expect(() => validateRunSequence({ ...uncalibrated, analyses: [enabledA, uncalibrated.analyses[1]] })).toThrow(expect.objectContaining({ code: 'QC_SEQUENCE_STALE' }));
    const p = plan(enabledA, { ...criteria('B', { ccvEvery: 4 }), calibrationVerification: true });
    expect(validateRunSequence(p).positions.filter(row => row.kind === 'CCV').map(row => row.servedAnalytes)).toEqual(Array(5).fill(['A', 'B']));
    expect(() => validateRunSequence({ ...p, analyses: [p.analyses[0], { ...criteria('B', { ccvEvery: 3 }), calibrationVerification: true }] }))
        .toThrow(expect.objectContaining({ code: 'QC_SEQUENCE_STALE', details: expect.objectContaining({ analysisCode: 'B', missing: expect.arrayContaining([expect.objectContaining({ kind: 'CCV_INTERVAL' })]) }) }));
});

test('fabricated duplicate parent, sample duplication and gaps refuse without mutating any input', () => {
    const p = plan(), duplicate = p.positions.find(row => row.kind === 'DUPLICATE');
    const broken = { ...p, positions: p.positions.map(row => row === duplicate ? { ...row, duplicateOfPositionId: 'not-a-real-sample' } : row) }, before = JSON.stringify(broken);
    expect(() => validateRunSequence(broken)).toThrow(expect.objectContaining({ details: { missing: [{ kind: 'DUPLICATE_PARENT', positionId: duplicate.id }] } }));
    expect(JSON.stringify(broken)).toBe(before);
    expect(() => validateRunSequence({ ...p, positions: p.positions.slice(1) })).toThrow(expect.objectContaining({ code: 'QC_SEQUENCE_STALE' }));
});
