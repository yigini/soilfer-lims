const { aggregateBatchStatus, normalizeBatchState } = require('../../workflowContract');
const startedAt = new Date('2026-10-06T12:00:00Z');

test('one failed analyte blocks a multi-element run despite other passing analytes', () => {
    expect(aggregateBatchStatus([{ analysisCode: 'CA', status: 'QC_PASS' }, { analysisCode: 'K', status: 'QC_FAIL' }], { startedAt })).toBe('QC_FAIL');
    expect(aggregateBatchStatus(['QC_PASS', 'REPEAT_ORDERED'], { startedAt })).toBe('QC_FAIL');
    expect(aggregateBatchStatus(['QC_WARN', 'REJECTED'], { startedAt })).toBe('QC_FAIL');
});

test('warning and accepted deviation remain accepted while closure requires every analyte closed', () => {
    expect(aggregateBatchStatus(['QC_PASS', 'QC_WARN', 'ACCEPTED_WITH_DEVIATION'], { startedAt })).toBe('QC_PASS');
    expect(aggregateBatchStatus(['CLOSED', 'QC_PENDING'], { startedAt })).toBe('RUNNING');
    expect(aggregateBatchStatus(['CLOSED', 'CLOSED'], { startedAt })).toBe('CLOSED');
});

test('reopen preserves legacy OPEN without clearing the first start time', () => {
    const context = { startedAt, reopened: true };
    expect(aggregateBatchStatus(['QC_PENDING', 'QC_PASS'], context)).toBe('OPEN');
    expect(context.startedAt).toBe(startedAt);
    expect(aggregateBatchStatus(['QC_PENDING', 'QC_FAIL'], context)).toBe('QC_FAIL');
    expect(aggregateBatchStatus(['QC_PENDING'], { startedAt })).toBe('RUNNING');
});

test('an unstarted run remains OPEN and IN_RUN input preserves the stored RUNNING label', () => {
    expect(aggregateBatchStatus(['OPEN'])).toBe('OPEN');
    expect(aggregateBatchStatus([])).toBe('OPEN');
    expect(normalizeBatchState('IN_RUN')).toBe('RUNNING');
    expect(normalizeBatchState('QC_FAIL')).toBe('QC_FAIL');
    expect(() => aggregateBatchStatus(['UNKNOWN'], { startedAt })).toThrow(expect.objectContaining({ statusCode: 400, code: 'BATCH_ANALYTE_STATE_INVALID' }));
});
