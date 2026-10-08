const { randomUUID } = require('node:crypto');
const { parseNumber, parseDuplicateObservation } = require('../../shared/numberParse');
const { currentAnalyteEvidence } = require('./qcRunViewService');
const failure = (statusCode, code, message, details = {}) => Object.assign(new Error(message), { statusCode, code, details });

function observation(entry, position, criteria, enteredBy, enteredAt) {
    if (!entry || typeof entry !== 'object' || (entry.replicateNo ?? 1) !== 1) throw failure(400, 'QC_VALUES_MISSING', 'A native position has one observation.', { positionId: position.id });
    const source = Object.prototype.hasOwnProperty.call(entry, 'rawInput') ? entry.rawInput : entry.value;
    const duplicate = ['SAMPLE', 'DUPLICATE'].includes(position.kind);
    const parsed = duplicate ? parseDuplicateObservation(source, criteria.numberFormat) : parseNumber(source, criteria.numberFormat);
    if (!parsed.valid || !duplicate && parsed.qualifier) throw failure(400, parsed.code === 'AMBIGUOUS_NUMBER' ? parsed.code : 'QC_VALUES_MISSING',
        'A valid QC observation is required.', { positionIds: [position.id] });
    return { id: randomUUID(), positionId: position.id, replicateNo: 1, value: parsed.censored ? null : parsed.value,
        rawInput: parsed.rawInput, censoring: parsed.censored ? parsed.qualifier : null,
        censoringLimit: parsed.censored ? parsed.literalLoq ? criteria.methodContext.loq : parsed.value : null, enteredBy, enteredAt };
}

function prepareNativeObservationEntries(batch, analysisCode, entries, { correction = false, preview = false, performedBy, now = new Date(), reason = '', numberFormat = null } = {}) {
    if (!Array.isArray(entries) || new Set(entries.map(row => row?.positionId)).size !== entries.length) {
        throw failure(400, 'QC_VALUES_MISSING', 'Submit distinct position observations.');
    }
    const analyte = batch.analytes.find(row => row.analysisCode === analysisCode);
    if (!analyte) throw failure(400, 'QC_ANALYSIS_NOT_IN_RUN', 'The analysis is not a member of this run.');
    const criteria = JSON.parse(analyte.criteriaSnapshot), evidence = currentAnalyteEvidence(batch, analysisCode);
    if (numberFormat) criteria.numberFormat = numberFormat;
    const replacements = [], observations = [];
    for (const entry of entries) {
        if (entry?.replicateNo !== undefined && entry.replicateNo !== 1) throw failure(400, 'QC_POSITION_NOT_IN_ANALYSIS', 'A Native physical position uses replicate 1.', { positionId: entry.positionId });
        const position = evidence.positions.find(row => row.id === entry?.positionId);
        if (!position || position.kind === 'CAL_STD') throw failure(400, 'QC_POSITION_NOT_IN_ANALYSIS', 'The position does not serve this analysis.', { positionId: entry?.positionId });
        const previous = evidence.measurements.find(row => row.positionId === position.id && row.replicateNo === 1);
        // A preview substitutes an observation only in memory. Persisted entry
        // still requires the existing explicit, reasoned correction path.
        if (!preview && previous && !correction) throw failure(400, 'QC_CORRECTION_REASON_REQUIRED', 'A measured position can only be changed by a reasoned correction.', { positionId: position.id });
        if (!preview && correction && !previous) throw failure(404, 'QC_MEASUREMENT_NOT_FOUND', 'There is no observation to correct.', { positionId: position.id });
        const next = { ...observation(entry, position, criteria, performedBy, now), batchId: batch.id, analysisCode, correctionReason: correction ? reason : null };
        observations.push(next);
        if (previous) replacements.push({ previous, next });
    }
    return { observations, replacements };
}

// Build the evidence candidate before any persistence. Preview and real entry
// share this construction so frozen reference placements and replaced
// observations have exactly the same meaning in both paths.
function buildNativeMeasurementCandidate(batch, { observations = [], replacements = [], plans = [] } = {}) {
    const candidate = {
        ...batch,
        measurements: [...batch.measurements.filter(row => !replacements.some(change => change.previous.id === row.id)), ...observations],
        positions: batch.positions.map(position => ({ ...position, references: [...(position.references || [])] }))
    };
    for (const plan of plans) for (const binding of plan.bindings) {
        const position = candidate.positions.find(row => row.id === binding.positionId);
        position.references = position.references.filter(row => row.analysisCode !== binding.analysisCode).concat(binding);
    }
    return candidate;
}

module.exports = { buildNativeMeasurementCandidate, prepareNativeObservationEntries };
