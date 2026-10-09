const rules = require('./workflowStateRules');
const policyService = require('./policyService');
const qcRuleService = require('./qcRuleService');
const { buildSelectionLineage } = require('./reportedValueSelectionLineage');
const { selectionRecordingTime } = require('./reportedValueRecordingTime');
const { TEXTURE_ALIASES } = require('./reportResultGovernance');

async function recordedLimit(tx, item, sample, candidate, events) {
    const attempt = candidate.attempt, rows = candidate.results;
    const timing = selectionRecordingTime(attempt, events);
    const methods = [...new Set(rows.filter(row => row.param !== 'TEXTURE' || !TEXTURE_ALIASES.has(item.analysis)).map(row => row.methodologyId ?? null))];
    const methodologyId = methods.length === 1 ? methods[0] : item.methodologyId ?? null;
    const units = [...new Set(rows.filter(row => row.param !== 'TEXTURE' || !TEXTURE_ALIASES.has(item.analysis)).map(row => row.unit))];
    const controlled = units.length === 1 && units[0] ? await tx.unit.findUnique({ where: { code: units[0] } }) : null;
    const base = { attemptId: attempt.id, methodologyId, controlledUnit: controlled?.code || null,
        recordedAt: timing.recordedAt?.toISOString() || null, recordingSource: timing.source || null,
        recordingEventId: timing.eventId || null, qcRuleId: null, qcRuleVersion: null, source: null, r: null, reason: null };
    const batchId = attempt.qcBatchId || attempt.batchId;
    if (batchId) {
        const analytes = await tx.batchAnalyte.findMany({ where: { batchId } });
        const matches = analytes.filter(row => row.analysisCode === item.analysis ||
            TEXTURE_ALIASES.has(row.analysisCode) && TEXTURE_ALIASES.has(item.analysis));
        const analyte = matches.length === 1 ? matches[0] : null;
        let snapshot;
        try { snapshot = analyte?.criteriaSnapshot && JSON.parse(analyte.criteriaSnapshot); } catch { /* No live fallback for damaged frozen evidence. */ }
        const frozen = snapshot?.qcRule;
        if (!frozen || frozen.id !== analyte.qcRuleId || frozen.version !== analyte.qcRuleVersion ||
            !['QC_RULE','DEFAULT_RULE'].includes(frozen.source)) return { ...base, batchId, reason: 'FROZEN_RULE_MISSING' };
        return { ...base, batchId, qcRuleId: frozen.id, qcRuleVersion: frozen.version, source: frozen.source,
            policyVersion: analyte.policyVersion, r: frozen.resolved?.repeatabilityLimit?.value ?? null,
            reason: frozen.resolved?.repeatabilityLimit?.value == null ? 'LIMIT_MISSING' : null };
    }
    if (!timing.recordedAt) return { ...base, reason: timing.reason };
    const reference = sample.assignedLab || sample.labId || item.assignedLab || item.labId;
    const resolved = await qcRuleService.resolve(reference, item.analysis, { db: tx, methodologyId, evaluatedAt: timing.recordedAt });
    if (resolved.id) {
        const stored = await tx.qcRule.findUnique({ where: { id: resolved.id } });
        const count = await tx.qcRule.count({ where: { labId: stored.labId, analysisCode: stored.analysisCode,
            methodologyId: stored.methodologyId, version: resolved.version, effectiveFrom: { lte: timing.recordedAt } } });
        if (count !== 1) return { ...base, reason: 'RULE_VERSION_AMBIGUOUS' };
    }
    const policy = await policyService.resolve(reference, 'qc.repeatabilityLimit', { db: tx, analysisCode: item.analysis, methodologyId });
    return { ...base, qcRuleId: resolved.id, qcRuleVersion: resolved.version, source: resolved.source,
        policyVersion: policy.version, r: resolved.resolved.repeatabilityLimit.value,
        reason: resolved.resolved.repeatabilityLimit.value == null ? 'LIMIT_MISSING' : null };
}

async function loadSelectionContext(tx, item) {
    rules.requireTransaction(tx);
    const sample = await tx.sample.findUnique({ where: { id: item.sampleId } });
    if (!sample) throw new rules.TransitionError('Sample not found.', 404, 'SAMPLE_NOT_FOUND');
    const attempts = await tx.workAttempt.findMany({ where: { workItemId: item.id } });
    const ids = attempts.map(row => row.id);
    const results = await tx.result.findMany({ where: { attemptId: { in: ids } } });
    const events = await tx.auditLog.findMany({ where: { entity: 'WORK_ATTEMPT', entityId: { in: ids } } });
    const lineage = buildSelectionLineage(attempts, results), limits = {};
    for (const candidate of lineage.eligible) limits[candidate.attempt.id] = await recordedLimit(tx, item, sample, candidate, events);
    const policy = await policyService.resolve(sample.assignedLab || sample.labId || item.assignedLab || item.labId,
        'results.reportedValueRule', { db: tx, analysisCode: item.analysis, methodologyId: item.methodologyId || null });
    return { sample, attempts, results, lineage, limits, policy };
}

module.exports = { loadSelectionContext };
