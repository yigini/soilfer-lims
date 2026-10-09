// #192 pin6073057498: request time is not recording time for an OPEN repeat.
// An ambiguous time means no stored r; single-value reporting remains allowed.
function selectionRecordingTime(attempt, events) {
    const owned = events.filter(row => row.entity === 'WORK_ATTEMPT' && row.entityId === attempt.id);
    const recording = [];
    for (const row of owned) {
        if (!['FIRST_FILL', 'CREATED'].includes(row.action)) continue;
        let details;
        try { details = typeof row.details === 'string' ? JSON.parse(row.details) : row.details; }
        catch { return { recordedAt: null, reason: 'RECORDING_EVENT_INVALID' }; }
        if (details?.to === 'RECORDED') recording.push(row);
    }
    if (recording.length !== 1) {
        if (!owned.length && attempt.parentAttemptId == null && attempt.requestedAt == null) {
            const recordedAt = new Date(attempt.createdAt);
            if (attempt.createdAt != null && Number.isFinite(recordedAt.getTime())) return { recordedAt, reason: null, source: 'HISTORICAL_CREATED_AT' };
        }
        return { recordedAt: null, reason: recording.length > 1 ? 'RECORDING_EVENT_AMBIGUOUS' : 'RECORDING_EVENT_MISSING' };
    }
    const recordedAt = new Date(recording[0].timestamp);
    if (recording[0].timestamp == null || !Number.isFinite(recordedAt.getTime())) return { recordedAt: null, reason: 'RECORDING_EVENT_INVALID' };
    return { recordedAt, reason: null, source: 'WORK_ATTEMPT_EVENT', eventId: recording[0].id };
}

module.exports = { selectionRecordingTime };
