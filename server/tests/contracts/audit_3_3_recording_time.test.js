const { selectionRecordingTime } = require('../../services/reportedValueRecordingTime');
const requestTime = '2026-10-08T09:00:00.000Z', recordTime = '2026-10-08T11:00:00.000Z';
const repeat = () => ({ id: 'repeat', parentAttemptId: 'original', requestedAt: requestTime, createdAt: requestTime });
const event = (action = 'FIRST_FILL', id = 'recording') => ({ id, entity: 'WORK_ATTEMPT', entityId: 'repeat', action,
    timestamp: recordTime, details: JSON.stringify({ from: action === 'FIRST_FILL' ? 'OPEN' : null, to: 'RECORDED' }) });

test('FIRST_FILL time supplies the repeat recording time rather than the earlier request time', () => {
    const attempt = repeat(), events = [event()], before = JSON.stringify({ attempt, events });
    expect(selectionRecordingTime(attempt, events)).toEqual({ recordedAt: new Date(recordTime), reason: null, source: 'WORK_ATTEMPT_EVENT', eventId: 'recording' });
    expect(JSON.stringify({ attempt, events })).toBe(before);
});

test('a new first execution uses its CREATED to RECORDED event', () => {
    expect(selectionRecordingTime({ ...repeat(), parentAttemptId: null, requestedAt: null }, [event('CREATED')]).recordedAt).toEqual(new Date(recordTime));
});

test('an event-free historical first execution may use createdAt', () => {
    expect(selectionRecordingTime({ id: 'historical', createdAt: requestTime, parentAttemptId: null, requestedAt: null }, []))
        .toEqual({ recordedAt: new Date(requestTime), reason: null, source: 'HISTORICAL_CREATED_AT' });
});

test('a repeat with no recording event has no historical fallback', () => {
    expect(selectionRecordingTime(repeat(), [])).toEqual({ recordedAt: null, reason: 'RECORDING_EVENT_MISSING' });
});

test('a first execution with retained events but no recording event has no fallback', () => {
    const row = event(); row.action = 'SUBMITTED'; row.details = JSON.stringify({ from: 'RECORDED', to: 'SUBMITTED' });
    expect(selectionRecordingTime({ ...repeat(), parentAttemptId: null, requestedAt: null }, [row])).toEqual({ recordedAt: null, reason: 'RECORDING_EVENT_MISSING' });
});

test('two recording events refuse a time instead of picking one', () => {
    expect(selectionRecordingTime(repeat(), [event(), event('FIRST_FILL', 'another')])).toEqual({ recordedAt: null, reason: 'RECORDING_EVENT_AMBIGUOUS' });
});

test.each(['invalid details', 'invalid timestamp'])('%s means no r', kind => {
    const row = event(); if (kind === 'invalid details') row.details = '{broken'; else row.timestamp = 'bad-date';
    expect(selectionRecordingTime(repeat(), [row])).toEqual({ recordedAt: null, reason: 'RECORDING_EVENT_INVALID' });
});

test('unrelated work item events do not supply a recording time', () => {
    const row = event(); row.entityId = 'another-attempt';
    expect(selectionRecordingTime(repeat(), [row])).toEqual({ recordedAt: null, reason: 'RECORDING_EVENT_MISSING' });
});

test.each([null, 'invalid'])('invalid historical date %s cannot become an invented time', createdAt => {
    expect(selectionRecordingTime({ id: 'historical', createdAt }, [])).toEqual({ recordedAt: null, reason: 'RECORDING_EVENT_MISSING' });
});
