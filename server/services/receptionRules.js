'use strict';
function deriveLocationConfidence(source, uncertaintyM) {
    if (!source || source === 'TEXT_ONLY') return 'LOW';
    if (source === 'FIELD_GPS' || source === 'DEVICE_GPS') {
        return (uncertaintyM && uncertaintyM <= 20) ? 'HIGH' : 'MEDIUM';
    }
    if (source === 'DESK_PASTE' || source === 'MAP_PIN') {
        if (uncertaintyM && uncertaintyM <= 50) return 'MEDIUM';
        return 'LOW';
    }
    if (source === 'ADMIN_UNIT') return 'LOW';
    return 'MEDIUM';
}

/**
 * Resolves requested package/group ID against available laboratory analysis groups.
 * Multi-tier exact-first resolution strategy:
 * 1. Validates requestedId is a non-empty string.
 * 2. Checks exact case-sensitive ID match.
 * 3. Checks exact case-insensitive match (rejects if multiple candidates exist).
 * 4. Checks normalized punctuation-stripped match (rejects if ambiguous).
 * Returns { group, canonicalId } or { error, code, message }.
 */
function resolveAnalysisGroup(requestedId, analysisGroups) {
    if (typeof requestedId !== 'string' || !requestedId.trim()) {
        return {
            error: 'INVALID_PACKAGE_ID',
            code: 'INVALID_PACKAGE_ID',
            message: 'Package ID must be a non-empty string.'
        };
    }
    const cleanId = requestedId.trim();

    // 1. Exact case-sensitive match
    const exactMatch = analysisGroups.find(g => g.id === cleanId);
    if (exactMatch) {
        return { group: exactMatch, canonicalId: exactMatch.id };
    }

    // 2. Exact case-insensitive match
    const lower = cleanId.toLowerCase();
    const caseInsensitiveMatches = analysisGroups.filter(g => g.id.toLowerCase() === lower);
    if (caseInsensitiveMatches.length === 1) {
        return { group: caseInsensitiveMatches[0], canonicalId: caseInsensitiveMatches[0].id };
    } else if (caseInsensitiveMatches.length > 1) {
        return {
            error: 'AMBIGUOUS_PACKAGE_ID',
            code: 'AMBIGUOUS_PACKAGE_ID',
            message: `Ambiguous package ID '${cleanId}': multiple packages match case-insensitively.`
        };
    }

    // 3. Punctuation-stripped normalized match (e.g. routine-soil vs ROUTINE_SOIL)
    const normalize = s => s.toLowerCase().replace(/[-_\s]/g, '');
    const norm = normalize(cleanId);
    const normMatches = analysisGroups.filter(g => normalize(g.id) === norm);
    if (normMatches.length === 1) {
        return { group: normMatches[0], canonicalId: normMatches[0].id };
    } else if (normMatches.length > 1) {
        return {
            error: 'AMBIGUOUS_PACKAGE_ID',
            code: 'AMBIGUOUS_PACKAGE_ID',
            message: `Ambiguous package ID '${cleanId}': matches multiple distinct packages.`
        };
    }

    return {
        error: 'PACKAGE_NOT_FOUND',
        code: 'PACKAGE_NOT_FOUND',
        message: `An analysis package is unavailable to this laboratory: '${cleanId}'.`
    };
}


function evaluateChecklistCompliance(checklist, options={}) { return require('./intakeSchema').evaluate(require('./intakeSchema').seed('SOILFER'),checklist,{}, {origin:options.isWalkIn?'DESK_WALKIN':'PROJECT_SAMPLE',matrix:'SOIL'}); }
module.exports={deriveLocationConfidence,resolveAnalysisGroup,evaluateChecklistCompliance};
