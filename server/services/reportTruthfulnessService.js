const { linkedBatchIds } = require('./reportResultGovernance');

function parseObject(value) {
    if (typeof value === 'object' && value !== null) return value;
    try { return JSON.parse(value); } catch { return null; }
}

function freezeReportEvidence(results, workItems, batches) {
    const deviations = [];
    for (const result of results) {
        const ids = linkedBatchIds(result, workItems);
        if (!ids.length) deviations.push({ analysisCode: result.param, batchId: null, qcStatus: 'NOT_RECORDED', dispositionReason: null });
        for (const batchId of ids) {
            const batch = batches.find(candidate => candidate.id === batchId);
            if (batch?.status === 'QC_PASS') continue;
            const deviation = { analysisCode: result.param, batchId, qcStatus: batch?.status || 'NOT_RECORDED',
                dispositionReason: parseObject(batch?.disposition)?.reason || null };
            if (!deviations.some(row => row.analysisCode === deviation.analysisCode && row.batchId === batchId)) deviations.push(deviation);
        }
    }
    const preparation = workItems.filter(item => ['DRYING', 'PREPARATION'].includes(item.analysis)).flatMap(item => {
        const receipt = parseObject(item.result);
        if (!receipt || !Array.isArray(receipt.checklist) || !receipt.checklist.length ||
            !receipt.checklist.every(check => check === true) || !Array.isArray(receipt.steps) ||
            !['COMPLETED', 'SUBMITTED', 'ACCEPTED'].includes(item.status)) return [];
        return [{ workItemId: item.id, analysis: item.analysis, status: item.status, steps: receipt.steps,
            recordedAt: receipt.recordedAt || null, recordedBy: receipt.recordedBy || null, observations: receipt.observations || null }];
    });
    return { qc: { withinLimits: results.length > 0 && deviations.length === 0, deviations }, preparation };
}

module.exports = { freezeReportEvidence };
