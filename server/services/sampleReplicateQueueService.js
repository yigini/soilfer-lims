const { resolveSampleReplicateRules } = require('./sampleReplicatePolicyService');
const { sampleReplicatePairView } = require('./sampleReplicateView');
const { recordedExecution } = require('./resultWriteService');
const { hasPermission } = require('../config/roles');

// Called only for numeric SAMPLE rows after the existing queue scope/assignment
// authority. This is a read projection, never an attempt/Result/QC writer.
async function sampleReplicateQueueView(db, item, actor, readiness) {
    const labId = item.sample?.assignedLab || item.assignedLab || item.sample?.labId;
    const rules = await resolveSampleReplicateRules(db, { labId, analysisCode: item.analysis,
        methodologyId: item.methodologyId, batchId: item.batchId });
    let execution = null, rows = [];
    if (!['SUBMITTED', 'ACCEPTED', 'WAIVED', 'CANCELLED'].includes(item.status)) {
        execution = await recordedExecution(db, item, item.analysis);
        rows = execution?.results || [];
    } else {
        const attempts = await db.workAttempt.findMany({ where: { workItemId: item.id } });
        rows = await db.result.findMany({ where: { sampleId: item.sampleId, param: item.analysis,
            isCurrent: true, supersededBy: null, attemptId: { in: attempts.map(row => row.id) } } });
        const ids = new Set(rows.map(row => row.attemptId));
        if (ids.size === 1) execution = { attempt: attempts.find(row => row.id === rows[0].attemptId), results: rows };
    }
    const view = sampleReplicatePairView(rows, rules);
    const recorded = execution?.attempt?.status === 'RECORDED';
    const writable = recorded && !['SUBMITTED', 'ACCEPTED', 'WAIVED', 'CANCELLED', 'ON_HOLD', 'AWAITING_VERIFICATION'].includes(item.status)
        && readiness.isReady === true && hasPermission(actor, 'ENTER_RESULTS');
    return { ...view, attemptId: execution?.attempt?.id || null, attemptStatus: execution?.attempt?.status || null,
        canAppend: writable && rules.requiredCount === 2 && (!rows.some(row => row.replicateNo === 2) ||
            view.status === 'FAIL' && !rows.some(row => row.replicateNo === 3)),
        canAddThird: writable && rules.requiredCount === 2 && view.status === 'FAIL' && !rows.some(row => row.replicateNo === 3) };
}

module.exports = { sampleReplicateQueueView };
