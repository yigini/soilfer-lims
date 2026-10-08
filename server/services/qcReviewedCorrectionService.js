const { hasPermission } = require('../config/roles');
const policyService = require('./policyService');
const { currentAnalyteEvidence } = require('./qcRunViewService');
const MODE = 'REVIEWED_TRANSCRIPTION';
const EVENT = 'QC_TRANSCRIPTION_CORRECTED';
const failure = (statusCode, code, message) => Object.assign(new Error(message), { statusCode, code });
const missingCriteria = () => failure(409, 'QC_REVIEWED_CRITERIA_UNAVAILABLE', 'The original evaluation does not store all required correction criteria.');

async function recordedPerson(tx, name) {
    if (typeof name !== 'string' || !name.trim() || /^(?:system(?::|$)|unknown$)/i.test(name)) {
        throw failure(409, 'QC_REVIEWED_AUTHOR_UNKNOWN', 'The original observation author cannot be established.');
    }
    const people = await tx.user.findMany({ where: { OR: [{ id: name }, { username: name }] }, select: { id: true, username: true } });
    if (people.length !== 1) throw failure(409, 'QC_REVIEWED_AUTHOR_UNKNOWN', 'The original observation author cannot be established.');
    return people[0];
}

// Pins6064618293/6066668666: this is the sole narrow exception to a failed
// analyte's lock. Author identities and original evidence come from storage.
async function authorizeReviewedCorrection(tx, batch, actor, input) {
    if (input.mode !== MODE) return null;
    if (!hasPermission(actor, 'APPROVE_RESULTS') || !hasPermission(actor, 'CHANGE_STATUS')) {
        throw failure(403, 'QC_REVIEWED_PERMISSION_REQUIRED', 'A reviewer with QC entry and approval permissions is required.');
    }
    if (Object.keys(input).some(key => !['mode', 'analysisCode', 'corrections', 'reason', 'sourceReference'].includes(key))) {
        throw failure(400, 'QC_REVIEWED_FIELDS_INVALID', 'A reviewed transcription correction can change only observations.');
    }
    const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
    const sourceReference = typeof input.sourceReference === 'string' ? input.sourceReference.trim() : '';
    if (!reason) throw failure(400, 'QC_CORRECTION_REASON_REQUIRED', 'A correction reason is required.');
    if (!sourceReference) throw failure(400, 'QC_REVIEWED_SOURCE_REQUIRED', 'Identify the recorded source of the corrected value.');
    const enabled = await policyService.get(batch.labId, 'qc.reviewedTranscriptionCorrectionEnabled', { db: tx });
    if (enabled !== true) throw failure(409, 'QC_REVIEWED_POLICY_DISABLED', 'Reviewed transcription correction is disabled for this laboratory.');
    const analysisCode = input.analysisCode || batch.analysis;
    const analyte = batch.analytes.find(row => row.analysisCode === analysisCode);
    if (!analyte) throw failure(400, 'QC_ANALYSIS_NOT_IN_RUN', 'The analysis is not a member of this run.');
    const evidence = currentAnalyteEvidence(batch, analysisCode);
    if (batch.status === 'CLOSED' || analyte.status !== 'QC_FAIL' || evidence.disposition || evidence.evaluation?.verdict !== 'FAIL') {
        throw failure(409, 'QC_REVIEWED_STATE_LOCKED', 'Only undispositioned failed QC can receive a reviewed transcription correction.');
    }
    const entries = input.corrections;
    if (!Array.isArray(entries) || !entries.length || new Set(entries.map(row => `${row?.positionId}/${row?.replicateNo ?? 1}`)).size !== entries.length) {
        throw failure(400, 'QC_VALUES_MISSING', 'Submit distinct existing observation corrections.');
    }
    const originals = [];
    for (const entry of entries) {
        if (!entry || typeof entry !== 'object' || Object.keys(entry).some(key => !['positionId', 'replicateNo', 'value', 'rawInput'].includes(key))) {
            throw failure(400, 'QC_REVIEWED_FIELDS_INVALID', 'A reviewed correction cannot change observation identity or criteria.');
        }
        const position = evidence.positions.find(row => row.id === entry.positionId);
        const measurement = evidence.measurements.find(row => row.positionId === entry.positionId && row.replicateNo === (entry.replicateNo ?? 1));
        if (!position || !measurement) throw failure(404, 'QC_MEASUREMENT_NOT_FOUND', 'Select a current observation from this analysis.');
        if (position.historicalSnapshotSeq != null || position.kind === 'CAL_STD') {
            throw failure(409, 'QC_REVIEWED_STATE_LOCKED', 'Historical observations and calibration standards remain locked.');
        }
        originals.push(measurement);
    }
    const authors = await Promise.all(originals.map(row => recordedPerson(tx, row.enteredBy)));
    const runAnalyst = batch.analystUsername ? await recordedPerson(tx, batch.analystUsername) : null;
    const reviewer = { id: actor.id || null, username: actor.username || null };
    const samePerson = person => person && (person.id === reviewer.id || person.username === reviewer.username);
    if (samePerson(runAnalyst) || authors.some(samePerson)) {
        throw failure(403, 'QC_REVIEWED_SECOND_PERSON_REQUIRED', 'The reviewer must differ from the run analyst and every corrected observation author.');
    }
    return { analysisCode, reason, sourceReference, reviewer, runAnalyst,
        authors: [...new Map(authors.map(row => [row.id, row])).values()], originals, previousEvaluation: evidence.evaluation };
}

const reading = row => ({ id: row.id, positionId: row.positionId, replicateNo: row.replicateNo, value: row.value,
    rawInput: row.rawInput, censoring: row.censoring, censoringLimit: row.censoringLimit, enteredBy: row.enteredBy, enteredAt: row.enteredAt });
function reviewedCorrectionPayload(review, replacements, evaluationId, criteriaSource) {
    return { analysisCode: review.analysisCode, reason: review.reason, sourceReference: review.sourceReference,
        reviewer: review.reviewer, runAnalyst: review.runAnalyst, observationAuthors: review.authors,
        previousEvaluationId: review.previousEvaluation.id, previousVerdict: review.previousEvaluation.verdict,
        evaluationId, criteriaSource, replacements: replacements.map(({ previous, old, next }) => ({ original: reading(previous || old), replacement: reading(next) })) };
}

// An incomplete stored criterion is a refusal, never a request to today's
// policy, profile, QcRule or shipped preset. Arithmetic remains in qcService.
function compatibilityCriteria(review, evidence, numberFormat) {
    let stored;
    try { stored = JSON.parse(review.previousEvaluation.details).evaluation; } catch (_) { throw missingCriteria(); }
    const rule = stored?.qcRule, mode = stored?.policyValues?.['qc.mode'];
    if (!rule?.resolved || !rule.requirements || !['REQUIRED_BLOCKING', 'REQUIRED_WARN', 'ADVISORY', 'OFF'].includes(mode)) throw missingCriteria();
    const value = key => {
        if (!rule.resolved[key] || !Object.hasOwn(rule.resolved[key], 'value')) throw missingCriteria();
        return rule.resolved[key].value;
    };
    const requirements = structuredClone(rule.requirements);
    for (const key of ['BLANK', 'DUPLICATE', 'CONTROL', 'LRM']) {
        const row = requirements[key];
        if (!row || !Number.isInteger(row.required) || row.required < 0 || !Number.isInteger(row.offered) || row.offered < 0 || !row.source) throw missingCriteria();
    }
    const policies = {}, finite = number => typeof number === 'number' && Number.isFinite(number);
    for (const collection of ['blanks', 'duplicates', 'controls']) for (const row of evidence.qcResults?.[collection] || []) {
        const original = stored[collection]?.find(item => (item.positionId || item.id) === (row.positionId || row.id));
        if (!original) throw missingCriteria();
        const id = row.positionId || row.id;
        if (collection === 'blanks') {
            if (!finite(original.maxAllowed) || !['ABSOLUTE', 'LT_LOQ', 'LT_HALF_LOQ'].includes(original.criterion)) throw missingCriteria();
            if (original.criterion !== 'ABSOLUTE' && !finite(original.loq)) throw missingCriteria();
            policies[id] = { maxAllowed: original.maxAllowed, mode: original.criterion,
                loq: original.loq, loqSource: original.loqSource, methodologyId: original.methodologyId };
        } else if (collection === 'duplicates') {
            const nearLoqMultiplier = stored.policyValues?.['qc.duplicateNearLoqMultiplier'];
            if (!finite(original.maxRpd) || !finite(nearLoqMultiplier) || !Object.hasOwn(original, 'loq')) throw missingCriteria();
            policies[id] = { numberFormat, maxRpd: original.maxRpd, nearLoqMultiplier, loq: original.loq,
                loqSource: original.loqSource, methodologyId: original.methodologyId, mode: value('duplicateMode'),
                absMax: value('duplicateAbsMax'), absMaxBelow5LOQ: value('duplicateAbsMaxBelow5LOQ') };
        } else {
            if (!finite(original.minRecovery) || !finite(original.maxRecovery)) throw missingCriteria();
            policies[id] = { minRecovery: original.minRecovery, maxRecovery: original.maxRecovery,
                crmMode: value('crmMode'), crmAbsWindow: value('crmAbsWindow'), lrmMode: value('lrmMode'), lrmWindowPct: value('lrmWindowPct') };
        }
    }
    value('failAction');
    return { policy: { qcRule: structuredClone(rule), qcMode: mode, policyVersion: stored.policyVersion,
        policyValues: structuredClone(stored.policyValues) }, recordedObservationPolicies: policies, recordedRequirements: requirements,
        criteriaSource: { type: 'RECORDED_COMPATIBILITY_EVALUATION', evaluationId: review.previousEvaluation.id } };
}

module.exports = { MODE, EVENT, authorizeReviewedCorrection, reviewedCorrectionPayload, compatibilityCriteria };
