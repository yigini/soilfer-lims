const { currentAnalyteEvidence } = require('./qcRunViewService');
const { runAnalyteCode } = require('./analysisCodesService');

// Project an analyte into the retained batch-gate grammar. Aggregate failure
// must not reject another analyte which has its own accepted evaluation.
function analyteGateView(batch, analysisCode) {
    if (!batch || !Array.isArray(batch.analytes)) return batch;
    analysisCode = runAnalyteCode(batch, analysisCode);
    const analyte = batch.analytes.find(row => row.analysisCode === analysisCode);
    if (!analyte) return { ...batch, status: 'ERROR', disposition: null, result: null };
    const evidence = currentAnalyteEvidence(batch, analysisCode);
    const status = evidence.disposition?.decision === 'PROCEED_WITH_WARNING' ? 'QC_FAIL'
        : ['QC_PASS', 'QC_WARN'].includes(analyte.status) ? 'QC_PASS'
            : analyte.status === 'CLOSED' ? 'CLOSED'
                : ['QC_FAIL', 'REJECTED', 'REPEAT_ORDERED'].includes(analyte.status) ? 'QC_FAIL'
                    : analyte.status === 'OPEN' ? 'OPEN' : 'RUNNING';
    return { ...batch, analysis: analysisCode, status, disposition: evidence.disposition, result: evidence.result,
        qcResults: evidence.qcResults, qcItems: evidence.qcItems, analyteStatus: analyte.status };
}

function unresolvedQcWhere(statuses = ['QC_FAIL', 'FAILED']) {
    const normalized = ['QC_FAIL'];
    if (statuses.includes('PENDING')) normalized.push('OPEN', 'IN_RUN', 'QC_PENDING');
    return { OR: [{ analytes: { some: { status: { in: normalized } } } },
        { analytes: { none: {} }, status: { in: statuses }, disposition: null }] };
}
module.exports = { analyteGateView, unresolvedQcWhere };
