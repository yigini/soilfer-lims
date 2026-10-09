const { TransitionError } = require('./workflowStateRules');
const qcGate = require('./qcGateService');
const { isInvalidOnlyByQcFailure } = require('./qcService');

function sourceValidity(result, selection, mode) {
    let flags;
    try { flags = typeof result.flags === 'string' ? JSON.parse(result.flags) : result.flags ?? []; } catch { return false; }
    if (!Array.isArray(flags)) return false;
    const explicit = selection.rule === 'REVIEWER';
    if (!explicit && (!result.isCurrent || flags.includes('REVIEW_RETURNED'))) return false;
    const remaining = explicit ? flags.filter(flag => flag !== 'REVIEW_RETURNED') : flags;
    const reviewOnly = explicit && flags.includes('REVIEW_RETURNED') && remaining.length === 0;
    if (explicit && flags.includes('REVIEW_RETURNED')) return reviewOnly || ['REQUIRED_WARN','ADVISORY','OFF'].includes(mode) &&
        isInvalidOnlyByQcFailure({ ...result, isValid:false, flags:remaining });
    return result.isValid !== false || reviewOnly || ['REQUIRED_WARN','ADVISORY','OFF'].includes(mode) &&
        isInvalidOnlyByQcFailure({ ...result, flags: remaining });
}

// Retained Result rows are never made current or valid. A reviewer selection
// may bypass only their currentness and REVIEW_RETURNED mark (pin6073676241).
async function validateReportedSources(tx,item,context,selection,options = {}) {
    const candidates = context.lineage.eligible.filter(row => selection.attemptIds.includes(row.attempt.id));
    if (!selection.reason && candidates.some(row => row.attempt.status === 'QUESTIONED')) {
        throw new TransitionError('Explain why the retained questioned evidence is being reported.',409,'REPORTED_VALUE_REASON_REQUIRED');
    }
    const sources = candidates.flatMap(row => row.results), workItemsByResult = {};
    for (const candidate of candidates) for (const result of candidate.results) workItemsByResult[result.id] = [{
        ...item, batchId: candidate.attempt.qcBatchId || candidate.attempt.batchId
    }];
    await require('./sampleHoldService').assertNotHeld(tx,context.sample);
    await require('./resultEvidenceService').assertNoPreparationRevert(tx,item.sampleId,sources.map(row => row.id));
    const batchIds = [...new Set(sources.flatMap(row => [row.batchId,workItemsByResult[row.id][0].batchId]).filter(Boolean))];
    const batches = batchIds.length ? await tx.batch.findMany({where:{id:{in:batchIds}},include:require('./qcRunViewService').QC_RUN_INCLUDE}) : [];
    const proof = await qcGate.resolveForSample({ ...context.sample, workItems:[item] },batches,tx,{results:sources,workItemsByResult});
    const rows = [];
    for (const source of sources) {
        const gate = proof.qcGates[source.id];
        if (!gate || !sourceValidity(source,selection,gate.mode)) throw new TransitionError('Selected source evidence is invalid.',409,
            'REPORTED_VALUE_SOURCE_INVALID',{workItemId:item.id,resultId:source.id});
        const check = qcGate.decision(gate,{publication:options.publication !== false,
            acknowledgement:options.publication === false ? options.acknowledgement : proof.qcAcknowledgements[source.id]});
        if (!check.allowed) throw new TransitionError('The selected source is blocked by '+check.code+'.',409,'REPORTED_VALUE_SOURCE_QC_BLOCKED',
            {workItemId:item.id,resultId:source.id,qcCode:check.code,gate});
        rows.push({workItemId:item.id,resultId:source.id,gate});
    }
    return {sources,rows,batches,workItemsByResult,...proof};
}

module.exports = { sourceValidity, validateReportedSources };
