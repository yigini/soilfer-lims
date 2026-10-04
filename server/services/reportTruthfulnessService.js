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
        const checks = receipt?.checks || receipt?.checklist;
        if (!receipt || !Array.isArray(checks) || !checks.length ||
            !checks.every(check => check === true) || !Array.isArray(receipt.steps) || receipt.steps.length !== checks.length ||
            !receipt.steps.every(step => typeof step === 'string' && step.trim()) ||
            !['COMPLETED', 'SUBMITTED', 'ACCEPTED'].includes(item.status)) return [];
        return [{ workItemId: item.id, analysis: item.analysis, status: item.status, steps: receipt.steps,
            recordedAt: receipt.recordedAt || null, recordedBy: receipt.recordedBy || null, observations: receipt.observations || null }];
    });
    return { qc: { withinLimits: results.length > 0 && deviations.length === 0, deviations }, preparation };
}

function describeReportEvidence(evidence, locale = 'en') {
    const canonical = ['en', 'es', 'es-419', 'fr', 'pt'].includes(locale) ? locale : 'en';
    const labels = require(`../locales/${canonical}.json`).resultReports;
    const qc = evidence?.qc;
    const qcStatement = qc?.withinLimits ? labels.qcWithinLimits
        : qc?.deviations?.length ? `${labels.qcDeviations}\n${qc.deviations.map(row =>
            `${row.analysisCode} · ${row.batchId || labels.noBatch}: ${row.qcStatus}${row.dispositionReason ? ` · ${row.dispositionReason}` : ''}`).join('\n')}`
            : labels.qcNotRecorded;
    const preparationStatement = ['DRYING', 'PREPARATION'].map(analysis => {
        const records = (evidence?.preparation || []).filter(record => record.analysis === analysis);
        const label = analysis === 'DRYING' ? labels.drying : labels.preparation;
        return records.length ? records.map(record => `${label}: ${record.status} · ${record.steps.join('; ')}`).join('\n')
            : `${label}: ${labels.notRecorded}`;
    }).join('\n');
    return { qcStatement, preparationStatement };
}

module.exports = { freezeReportEvidence, describeReportEvidence };
