function object(value) {
    try { const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; }
    catch { return {}; }
}
function iso(value) {
    if (value == null || value === '') return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function assertApprovalEvidence(sample) {
    if (typeof sample?.approvedBy !== 'string' || !sample.approvedBy.trim() || !iso(sample.approvedAt)) {
        throw Object.assign(new Error('Recorded sample approval is required before issuing a report.'),
            { statusCode: 409, code: 'REPORT_APPROVAL_EVIDENCE_REQUIRED' });
    }
}
function approvalEvidence(sample, auditLogs) {
    const at = iso(sample.approvedAt), by = sample.approvedBy || null;
    const retained = auditLogs.filter(row => row.action === 'SAMPLE_APPROVED' && row.performedBy === by && iso(row.timestamp) === at)
        .map(row => object(row.after).approval).filter(row => row?.username === by && iso(row.approvedAt) === at);
    const unique = [...new Map(retained.map(row => [JSON.stringify(row), row])).values()];
    return { name: unique.length === 1 ? unique[0].name || by : by, username: by,
        title: unique.length === 1 ? unique[0].role || null : null, date: at };
}
function executedMethods(sources, attempts, batches) {
    const rows = sources.map(source => {
        const attempt = attempts.find(row => row.id === source.attemptId), stored = object(attempt?.executedMethodRevision);
        const revision = Object.keys(stored).length ? stored.version ?? null : attempt?.executedMethodRevision ?? null;
        const batch = batches.find(row => row.id === (attempt?.qcBatchId || attempt?.batchId || source.batchId));
        const native = object(batch?.analytes?.find(row => row.analysisCode === source.param)?.criteriaSnapshot).methodRevision;
        const candidates = [stored, native].filter(row => row && (row.methodologyId || row.id) === source.methodologyId &&
            revision != null && String(row.version) === String(revision));
        const method = candidates[0];
        return { param: source.param, methodologyId: source.methodologyId || null, methodVersion: revision,
            method: method?.name || null, standard: method?.standard || null, reference: method?.reference || null };
    });
    return [...new Map(rows.map(row => [JSON.stringify(row), row])).values()];
}
function expandedUncertainty(value, methodology, policy, { censored = false, methodKnown = true } = {}) {
    if (censored) return { state: 'CENSORED' };
    const amount = methodology?.uncertainty, k = policy.coverageFactor, mode = policy.mode;
    if (!methodKnown || !['EXPANDED_ABSOLUTE', 'EXPANDED_RELATIVE_PCT'].includes(mode) ||
        typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 ||
        typeof k !== 'number' || !Number.isFinite(k) || k < 1 || typeof value !== 'number' || !Number.isFinite(value))
        return { state: 'NOT_STATED' };
    const uncertainty = mode === 'EXPANDED_ABSOLUTE' ? amount : Math.abs(value) * amount / 100;
    return Number.isFinite(uncertainty) ? { state: 'EXPANDED', mode, value: uncertainty, coverageFactor: k,
        relativePct: mode === 'EXPANDED_RELATIVE_PCT' ? amount : null } : { state: 'NOT_STATED' };
}
function sampleContentEvidence(sample, sources, attempts) {
    const reception = object(sample.receptionData), metadata = object(sample.metadata);
    const dates = [...new Set(sources.map(source => {
        const attempt = attempts.find(row => row.id === source.attemptId);
        return iso(object(attempt?.evidenceData).recordedAt || source.analysedAt);
    }).filter(Boolean))].sort();
    const condition = reception.checklist?.items?.condition || null;
    const nonconformities = [metadata.nonConformance?.reason, metadata.complianceException?.reason,
        reception.complianceException?.reason, reception.checklist?.nonConformance ? reception.checklist.reason : null,
        sample.rejectionReason].filter(value => typeof value === 'string' && value.trim());
    return { receiptDate: iso(sample.receptionDate), conditionOnReceipt: { moisture: sample.moistureOnArrival || null,
        status: condition?.status || null, note: condition?.note || null },
        intakeNonconformities: [...new Set(nonconformities)], analysisStart: dates[0] || null,
        analysisEnd: dates.at(-1) || null, sampling: null };
}
module.exports = { object, iso, assertApprovalEvidence, approvalEvidence, executedMethods, expandedUncertainty, sampleContentEvidence };
