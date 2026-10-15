const { normalizeAnalysisCodes } = require('./analysisCodesService');
const { TransitionError, requireReason } = require('./workflowStateRules');

function normalizedSelection(value, stored = false) {
    if (!Array.isArray(value) || value.some(code => typeof code !== 'string' || !code.trim())) {
        throw new TransitionError(stored ? 'The stored analysis list requires repair before editing.'
            : 'Analyses must be an array of catalogue selections.', stored ? 409 : 400,
        stored ? 'INVALID_STORED_ANALYSES' : 'INVALID_ANALYSIS_SELECTION');
    }
    return normalizeAnalysisCodes(value);
}

/** The caller supplies fresh transactional facts; no historical revision is selected here. */
function orderRevisionRequest(input, { currentAnalyses, priorActiveCount, requiresLineRevision = false }) {
    const current = normalizedSelection(currentAnalyses, true);
    const explicitTarget = input.analyses !== undefined;
    if (priorActiveCount > 1 && !explicitTarget) {
        throw new TransitionError('State the complete analysis set for this reasoned order revision.',
            409, 'ORDER_TARGET_REQUIRED');
    }
    const analyses = explicitTarget ? normalizedSelection(input.analyses) : current;
    const changed = priorActiveCount !== 1 || requiresLineRevision || analyses.length !== current.length
        || analyses.some(code => !current.includes(code));
    const reason = changed ? requireReason(input.reason)
        : typeof input.reason === 'string' ? input.reason.trim() : null;
    return { analyses, reason, changed, explicitTarget };
}

module.exports = { normalizedSelection, orderRevisionRequest };
