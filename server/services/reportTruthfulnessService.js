const { linkedBatchIds } = require('./reportResultGovernance');
const { governingItems } = require('./reportResultGovernance');
const { analyteGateView } = require('./qcRunGateService');
const { reviewedCorrections } = require('./qcReviewedCorrectionHistory');

function parseObject(value) {
    if (typeof value === 'object' && value !== null) return value;
    try { return JSON.parse(value); } catch { return null; }
}

function freezeReportEvidence(results, workItems, batches, options = {}) {
    const deviations = [];
    const acknowledgements = [], calibrationBracketRepeats = [];
    const corrections = new Map();
    for (const result of results) {
        const gate = options.qcGates?.[result.id];
        for (const batchId of new Set([...(gate?.batchIds || []), ...linkedBatchIds(result, workItems)])) {
            const source = batches.find(row => row.id === batchId);
            const analysisCode = governingItems(result, workItems).find(item => item.batchId === batchId)?.analysis || result.param;
            for (const correction of reviewedCorrections(source, analysisCode)) corrections.set(correction.id, correction);
        }
        if (gate) {
            const acknowledgement = options.qcAcknowledgements?.[result.id];
            if (acknowledgement) acknowledgements.push({ resultId: result.id, ...acknowledgement });
            const brackets = (gate.contributions || []).filter(row => row.calibrationBracketRepeat && row.value === 'PASS');
            for (const row of brackets) calibrationBracketRepeats.push({ analysisCode: result.param, ...row.calibrationBracketRepeat });
            const allNotRequired = gate.contributions?.length > 0 && gate.contributions.every(row => row.notRequired);
            if (gate.value === 'PASS' && !allNotRequired && gate.mode !== 'OFF') continue;
            const notRequired = gate.mode === 'OFF' || gate.value === 'PASS' && allNotRequired ||
                !gate.required && ['NO_BATCH', 'NOT_EVALUATED'].includes(gate.value);
            deviations.push({ analysisCode: result.param, batchId: gate.batchIds[0] || null,
                qcStatus: gate.value === 'REPEAT' ? 'REPEAT' : notRequired ? 'NOT_REQUIRED' : gate.value,
                dispositionReason: gate.dispositionReason || null,
                ...(acknowledgement && { acknowledgedBy: acknowledgement.actor, acknowledgedAt: acknowledgement.at,
                    acknowledgementReason: acknowledgement.reason, acknowledgementAuditLogId: acknowledgement.auditLogId }) });
            continue;
        }
        const ids = linkedBatchIds(result, workItems);
        if (!ids.length) deviations.push({ analysisCode: result.param, batchId: null, qcStatus: 'NOT_RECORDED', dispositionReason: null });
        for (const batchId of ids) {
            const source = batches.find(candidate => candidate.id === batchId);
            const analysisCode = governingItems(result, workItems).find(item => item.batchId === batchId)?.analysis || result.param;
            const batch = analyteGateView(source, analysisCode);
            if (batch?.result === 'PASS' && ['QC_PASS', 'CLOSED'].includes(batch.analyteStatus) && !batch.disposition ||
                !Array.isArray(source?.analytes) && batch?.status === 'QC_PASS') continue;
            const incompleteAcceptance = ['QC_PASS', 'CLOSED'].includes(batch?.analyteStatus) &&
                !['PASS', 'WARN', 'FAIL', 'NOT_REQUIRED'].includes(batch?.result) && !batch?.disposition;
            const deviation = { analysisCode: result.param, batchId, qcStatus: incompleteAcceptance ? 'EVIDENCE_INCOMPLETE' : batch?.result === 'NOT_REQUIRED' ? 'NOT_REQUIRED' :
                batch?.analyteStatus === 'IN_RUN' ? 'RUNNING' : batch?.analyteStatus || batch?.status || 'NOT_RECORDED',
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
    return { qc: { withinLimits: results.length > 0 && deviations.length === 0, deviations,
        ...(acknowledgements.length && { acknowledgements }), ...(calibrationBracketRepeats.length && { calibrationBracketRepeats }),
        ...(corrections.size && { reviewedCorrections: [...corrections.values()] }) }, preparation };
}

function describeReportEvidence(evidence, locale = 'en') {
    const canonical = ['en', 'es', 'es-419', 'fr', 'pt'].includes(locale) ? locale : 'en';
    const labels = require(`../locales/${canonical}.json`).resultReports;
    const qc = evidence?.qc;
    const statusLabel = row => row.qcStatus === 'NOT_REQUIRED' ? labels.qcNotRequired :
        row.qcStatus === 'EVIDENCE_INCOMPLETE' ? labels.qcEvidenceIncomplete : row.qcStatus;
    const qcStatement = qc?.withinLimits ? labels.qcWithinLimits
        : qc?.deviations?.length ? `${qc.deviations.every(row => row.qcStatus === 'NOT_REQUIRED') ? labels.qcNotRequired :
            qc.deviations.every(row => row.qcStatus === 'EVIDENCE_INCOMPLETE') ? labels.qcEvidenceIncomplete : labels.qcDeviations}\n${qc.deviations.map(row =>
            `${row.analysisCode} · ${row.batchId || labels.noBatch}: ${statusLabel(row)}${row.dispositionReason ? ` · ${row.dispositionReason}` : ''}${row.acknowledgementReason ? ` · ${labels.qcAcknowledgedBy}: ${row.acknowledgedBy} · ${row.acknowledgementReason}` : ''}`).join('\n')}`
            : labels.qcNotRecorded;
    const preparationStatement = ['DRYING', 'PREPARATION'].map(analysis => {
        const records = (evidence?.preparation || []).filter(record => record.analysis === analysis);
        const label = analysis === 'DRYING' ? labels.drying : labels.preparation;
        return records.length ? records.map(record => `${label}: ${record.status} · ${record.steps.join('; ')}`).join('\n')
            : `${label}: ${labels.notRecorded}`;
    }).join('\n');
    const bracketStatement = (qc?.calibrationBracketRepeats || []).map(row =>
        `${labels.qcCalibrationBracketRepeatInfo}: ${row.analysisCode} · ${row.batchId}`).join('\n');
    const correctionLabels = require(`../locales/${canonical}.json`).qcReviewedCorrection;
    const correctionStatement = (qc?.reviewedCorrections || []).map(row =>
        `${correctionLabels.disclosure}: ${row.analysisCode} · ${row.batchId} · ${correctionLabels.originalFailure}: ${row.previousVerdict} (${row.previousEvaluationId}) · ` +
        `${correctionLabels.replacement}: ${row.replacementEvaluation?.verdict || ''} (${row.evaluationId}) · ${correctionLabels.reviewer}: ${row.reviewer?.username || row.by} · ` +
        `${correctionLabels.reason}: ${row.reason} · ${correctionLabels.sourceReference}: ${row.sourceReference}\n` +
        row.replacements.map(change => `${change.original.positionId}/${change.original.replicateNo}: ` +
            `${change.original.rawInput ?? change.original.value} (${change.original.id}) → ${change.replacement.rawInput ?? change.replacement.value} (${change.replacement.id})`).join('\n')).join('\n');
    return { qcStatement: [qcStatement, bracketStatement, correctionStatement].filter(Boolean).join('\n'), preparationStatement };
}

module.exports = { freezeReportEvidence, describeReportEvidence };
