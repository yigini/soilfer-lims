const parsed = value => { try { return typeof value === 'string' ? JSON.parse(value) : value; } catch { return null; } };

// A disclosure is a projection of immutable records. Reading QC or building a
// new report never changes an earlier evaluation or published report snapshot.
function reviewedCorrections(batch, analysisCode = null) {
    return (batch?.events || []).filter(event => event.type === 'QC_TRANSCRIPTION_CORRECTED').flatMap(event => {
        const record = parsed(event.payload);
        if (!record || analysisCode && record.analysisCode !== analysisCode) return [];
        const original = (batch.evaluations || []).find(row => row.id === record.previousEvaluationId);
        const replacement = (batch.evaluations || []).find(row => row.id === record.evaluationId);
        return [{ ...record, id: event.id, batchId: batch.id, at: event.at, by: event.by,
            originalEvaluation: original ? { ...original, details: parsed(original.details) } : null,
            replacementEvaluation: replacement ? { ...replacement, details: parsed(replacement.details) } : null }];
    }).sort((a, b) => new Date(a.at) - new Date(b.at));
}
module.exports = { reviewedCorrections };
