const { buildSelectionLineage, assertSelectionFresh } = require('../../services/reportedValueSelectionLineage');

const fixture = () => ({ attempts: [
    { id: 'original', status: 'QUESTIONED', evidenceHash: 'recorded-original' },
    { id: 'child', status: 'ACCEPTED', evidenceHash: 'recorded-child' }
], results: [
    { id: 'old-transcription', workAttemptId: 'original', value: '120', isCurrent: false, supersededBy: 'questioned-final' },
    { id: 'questioned-final', workAttemptId: 'original', value: '12.0', isCurrent: false, supersededBy: 'child-final' },
    { id: 'child-final', workAttemptId: 'child', value: '12.6', isCurrent: true, supersededBy: null }
] });

test('retained QUESTIONED12.0 remains final after a cross-attempt repeat, while its earlier same-attempt correction is excluded', () => {
    const data = fixture(), before = JSON.stringify(data), actual = buildSelectionLineage(data.attempts, data.results);
    expect(actual.eligible.find(row => row.attempt.id === 'original').results.map(row => [row.id, row.value, row.isCurrent]))
        .toEqual([['questioned-final', '12.0', false]]);
    expect(actual.eligible.find(row => row.attempt.id === 'child').results.map(row => row.value)).toEqual(['12.6']);
    expect(JSON.stringify(data)).toBe(before);
    expect(assertSelectionFresh(JSON.stringify(actual.snapshot), [...data.attempts].reverse(), [...data.results].reverse()).snapshot).toEqual(actual.snapshot);
});

test.each(['OPEN', 'RECORDED', 'INVALIDATED', 'SUPERSEDED', 'RETURNED'])('%s never supplies a reported-value candidate but remains in the lineage snapshot', status => {
    const data = fixture(); data.attempts[0].status = status;
    const actual = buildSelectionLineage(data.attempts, data.results);
    expect(actual.eligible.map(row => row.attempt.id)).toEqual(['child']);
    expect(actual.snapshot.attempts).toContainEqual({ id: 'original', status });
});

test('a QUESTIONED owner without recorded evidence stays in history and cannot be selected', () => {
    const data = fixture(); data.attempts[0].evidenceHash = null;
    expect(buildSelectionLineage(data.attempts, data.results).eligible.map(row => row.attempt.id)).toEqual(['child']);
});

test.each(['correction', 'repeat', 'RETURN', 'evidence'])('%s makes the prior selection stale without rewriting any saved snapshot', change => {
    const data = fixture(), saved = JSON.stringify(buildSelectionLineage(data.attempts, data.results).snapshot);
    if (change === 'correction') {
        data.results[2].supersededBy = 'corrected-child';
        data.results.push({ id: 'corrected-child', workAttemptId: 'child', value: '12.7', isCurrent: true, supersededBy: null });
    } else if (change === 'repeat') data.attempts.push({ id: 'new-open-child', status: 'OPEN', evidenceHash: null });
    else if (change === 'RETURN') data.attempts[1].status = 'QUESTIONED';
    else data.attempts[1].evidenceHash = 'different-retained-hash';
    expect(() => assertSelectionFresh(saved, data.attempts, data.results)).toThrow(expect.objectContaining({ statusCode: 409, code: 'REPORTED_VALUE_STALE' }));
    expect(JSON.parse(saved).eligible.find(row => row.id === 'child').resultIds).toEqual(['child-final']);
});

test('a fresh snapshot taken after acceptance is current', () => {
    const data = fixture(); data.attempts[1].status = 'SUBMITTED';
    const old = buildSelectionLineage(data.attempts, data.results).snapshot;
    data.attempts[1].status = 'ACCEPTED';
    expect(() => assertSelectionFresh(old, data.attempts, data.results)).toThrow(expect.objectContaining({ code: 'REPORTED_VALUE_STALE' }));
    const accepted = buildSelectionLineage(data.attempts, data.results).snapshot;
    expect(() => assertSelectionFresh(accepted, data.attempts, data.results)).not.toThrow();
});

test.each(['unknown replacement', 'cycle', 'foreign owner', 'duplicate row', 'malformed snapshot'])('%s refuses rather than guessing a canonical execution', problem => {
    const data = fixture();
    if (problem === 'unknown replacement') data.results[2].supersededBy = 'missing-result';
    if (problem === 'cycle') data.results[2].supersededBy = data.results[0].id;
    if (problem === 'foreign owner') data.results[2].workAttemptId = 'outside-work-item';
    if (problem === 'duplicate row') data.results.push({ ...data.results[0] });
    const run = () => problem === 'malformed snapshot' ? assertSelectionFresh('{broken', data.attempts, data.results)
        : buildSelectionLineage(data.attempts, data.results);
    expect(run).toThrow(expect.objectContaining({ statusCode: 409,
        code: problem === 'malformed snapshot' ? 'REPORTED_VALUE_STALE' : 'REPORTED_VALUE_LINEAGE_INVALID' }));
});
