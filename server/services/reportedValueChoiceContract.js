const { TransitionError } = require('./workflowStateRules');
const { calculateReportedMean } = require('./reportedValueMeanContract');
const { calculateUsdaTexture } = require('../utils/soilCalculations');
const { TEXTURE_ALIASES } = require('./reportResultGovernance');
const MODES = new Set(['ATTEMPT', 'MEAN', 'NOT_REPORTABLE']);
const failure = (code, message, details = {}) => new TransitionError(message, 409, code, details);

function selectionOutputs(item,context) {
    return context?.layout?.outputParams || (TEXTURE_ALIASES.has(item.analysis) ? ['CLAY', 'SAND', 'SILT', 'TEXTURE'] : [item.analysis]);
}

function selectedOutputValues(item, candidates, limits) {
    const params = selectionOutputs(item), all = candidates.flatMap(row => row.results);
    const composite = TEXTURE_ALIASES.has(item.analysis);
    for (const candidate of candidates) {
        const replicas = new Set(candidate.results.map(row => row.replicateNo ?? 1));
        if (!candidate.results.length || candidate.results.some(row => !params.includes(row.param)) ||
            [...replicas].some(replica => params.some(param => candidate.results.filter(row => row.param === param &&
                (row.replicateNo ?? 1) === replica).length !== 1))) {
            throw failure('REPORTED_VALUE_SELECTION_INVALID', 'The chosen attempt does not have a complete output set.');
        }
    }
    const averaging = params.some(param => all.filter(row => row.param === param).length > 1);
    const outputs = params.filter(param => !(composite && averaging && param === 'TEXTURE')).map(param => {
        const rows = all.filter(row => row.param === param);
        if (rows.length === 1) {
            const row = rows[0], numeric = String(row.value).trim() !== '' && Number.isFinite(Number(row.value));
            return { analysisCode: param, value: numeric ? Number(row.value) : null, valueText: row.value,
                unit: row.unit ?? null, censoring: row.censoring ?? 'NONE', methodologyId: row.methodologyId ?? null,
                resultIds: [row.id], derivation: null };
        }
        const used = candidates.map(candidate => ({ ...limits[candidate.attempt.id], attemptId: candidate.attempt.id }));
        const mean = calculateReportedMean(rows, used);
        return { analysisCode: param, ...mean, methodologyId: rows[0].methodologyId ?? null,
            resultIds: rows.map(row => row.id), derivation: null };
    });
    if (composite && averaging) {
        const values = ['SAND', 'SILT', 'CLAY'].map(param => outputs.find(row => row.analysisCode === param).value);
        const derived = calculateUsdaTexture(...values);
        if (!derived.isValid) throw failure('REPORTED_VALUE_TEXTURE_UNRESOLVED', derived.error || 'The selected texture means do not produce a valid class.');
        outputs.push({ analysisCode: 'TEXTURE', value: null, valueText: derived.className, unit: null, censoring: 'NONE',
            methodologyId: outputs[0].methodologyId, resultIds: all.filter(row => row.param !== 'TEXTURE').map(row => row.id),
            derivation: 'calculateUsdaTexture' });
    }
    return { outputs: outputs.sort((a, b) => a.analysisCode < b.analysisCode ? -1 : a.analysisCode > b.analysisCode ? 1 : 0), averaging };
}

function explicitReportedChoice(item, lineage, choice, limits) {
    if (!choice || !MODES.has(choice.mode) || Object.keys(choice).some(key => !['mode', 'attemptIds', 'reason'].includes(key))) {
        throw failure('REPORTED_VALUE_SELECTION_INVALID', 'Choose an attempt, a complete mean, or not reportable.');
    }
    if (choice.reason != null && typeof choice.reason !== 'string') throw failure('REPORTED_VALUE_SELECTION_INVALID', 'The selection reason must be text.');
    if (choice.mode === 'NOT_REPORTABLE') {
        if (!choice.reason?.trim() || choice.attemptIds != null && (!Array.isArray(choice.attemptIds) || choice.attemptIds.length)) {
            throw failure('REPORTED_VALUE_SELECTION_INVALID', 'Not reportable requires a reason and no selected attempts.');
        }
        return { mode: choice.mode, attemptIds: [], rule: 'REVIEWER', reason: choice.reason.trim(),
            outputs: selectionOutputs(item).map(analysisCode => ({ analysisCode, value: null, valueText: '', unit: null,
                censoring: 'NONE', methodologyId: null, resultIds: [], derivation: null })) };
    }
    const ids = choice.attemptIds;
    if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length || ids.some(id => typeof id !== 'string') ||
        choice.mode === 'ATTEMPT' && ids.length !== 1) throw failure('REPORTED_VALUE_SELECTION_INVALID', 'Choose complete eligible attempts.');
    const candidates = ids.map(id => lineage.eligible.find(row => row.attempt.id === id));
    if (candidates.some(row => !row)) throw failure('REPORTED_VALUE_SELECTION_INVALID', 'An ineligible attempt cannot supply the reported value.');
    const values = selectedOutputValues(item, candidates, limits);
    if (choice.mode === 'MEAN' && !values.averaging) throw failure('REPORTED_VALUE_SELECTION_INVALID', 'A mean needs more than one final value per output.');
    return { mode: choice.mode, attemptIds: [...ids].sort(), rule: 'REVIEWER', reason: choice.reason?.trim() || null,
        outputs: values.outputs };
}

function automaticReportedChoice(item, lineage, policyRule, limits) {
    if (!['MEAN_IF_WITHIN_R', 'LATEST_VALID', 'REVIEWER_PICKS'].includes(policyRule)) {
        throw failure('RESULT_POLICY_UNRESOLVED', 'The reported-value policy could not be resolved.');
    }
    const reasons = [];
    if (policyRule === 'REVIEWER_PICKS') reasons.push('REVIEWER_PICKS');
    if (lineage.eligible.some(row => row.attempt.status === 'QUESTIONED')) reasons.push('QUESTIONED_ORIGINAL');
    const candidates = lineage.eligible;
    if (!candidates.length) reasons.push('NO_ELIGIBLE_ATTEMPT');
    let selected, rule;
    const original = [...lineage.snapshot.attempts].sort((a, b) => {
        const aa = lineage.attempts.find(row => row.id === a.id), bb = lineage.attempts.find(row => row.id === b.id);
        return aa.attemptNo - bb.attemptNo;
    })[0];
    if (!reasons.length && candidates.length === 1 && original?.status !== 'INVALIDATED') selected = candidates[0];
    else if (!reasons.length && (policyRule === 'LATEST_VALID' || original?.status === 'INVALIDATED')) {
        const times = candidates.map(row => limits[row.attempt.id]?.recordedAt == null ? NaN : new Date(limits[row.attempt.id].recordedAt).getTime());
        if (times.some(time => !Number.isFinite(time)) || new Set(times).size !== times.length) reasons.push('RECORDING_TIME_AMBIGUOUS');
        else {
            selected = candidates[times.indexOf(Math.max(...times))];
            rule = original?.status === 'INVALIDATED' ? 'AUTO_LATEST_AFTER_INVALIDATION' : 'AUTO_LATEST_VALID';
        }
    }
    else if (!reasons.length) reasons.push('MULTIPLE_ELIGIBLE_ATTEMPTS');
    if (selected) {
        try {
            if (selected.results.some(row => row.isCurrent === false || (() => {
                try { return JSON.parse(row.flags || '[]').includes('REVIEW_RETURNED'); } catch { return true; }
            })())) throw failure('REPORTED_VALUE_REVIEW_REQUIRED', 'Retained non-current or returned evidence needs an explicit reviewer selection.');
            const values = selectedOutputValues(item, [selected], limits);
            return { choice: { mode: 'ATTEMPT', attemptIds: [selected.attempt.id], reason: null,
                rule: rule || (values.averaging ? 'AUTO_DUPLICATE_MEAN' : 'AUTO_SINGLE'), outputs: values.outputs }, reasons: [] };
        } catch (error) {
            if (!error.code?.startsWith('REPORTED_VALUE_')) throw error;
            reasons.push(error.code);
        }
    }
    return { choice: null, reasons };
}

module.exports = { selectionOutputs, explicitReportedChoice, automaticReportedChoice };
