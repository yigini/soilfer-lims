// Immutable locked lifecycle statuses that must never regress via intake or draft save
const LOCKED_INTAKE_STATUSES = [
    'ACCEPTED', 'LAB_ID_ASSIGNED', 'PROCESSING', 'COMPLETED',
    'APPROVED', 'ARCHIVED', 'DISPOSED', 'SUBMITTED_PARTIAL',
    'SUBMITTED_FULL', 'IN_PROGRESS', 'RECEIVED_REJECTED'
];
exports.LOCKED_INTAKE_STATUSES = LOCKED_INTAKE_STATUSES;

/**
 * RC-07 & RC-20: Derive confidence from evidence
 * Resists an unevidenced HIGH (e.g. manual desk pin or paste without device/field GPS)
 */
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
exports.deriveLocationConfidence = deriveLocationConfidence;

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
exports.resolveAnalysisGroup = resolveAnalysisGroup;

/**
 * Evaluates reception compliance checklist criteria (#117, #113).
 * Standard criteria:
 * - container: Container Intact / Sealed (required, N/A not allowed)
 * - label: Label Legible & Matches ID (required, N/A not allowed)
 * - quantity: Sample Quantity Sufficient (required, N/A not allowed)
 * - condition: Sample Condition (required, N/A not allowed)
 * - coc: Chain of Custody Present (allowed N/A for walk-in / ad-hoc dropoff)
 */
function evaluateChecklistCompliance(checklist, options = {}) {
    const isWalkIn = Boolean(options.isWalkIn);
    const standardKeys = ['container', 'label', 'quantity', 'condition', 'coc'];

    if (!checklist || typeof checklist !== 'object') {
        return {
            isProvided: false,
            isComplete: false,
            isPassed: false,
            failedItems: [],
            unansweredItems: [...standardKeys],
            invalidNAItems: [],
            unknownItems: []
        };
    }

    const items = checklist.items !== undefined ? checklist.items : checklist;
    if (!items || typeof items !== 'object') {
        return {
            isProvided: false,
            isComplete: false,
            isPassed: false,
            failedItems: [],
            unansweredItems: [...standardKeys],
            invalidNAItems: [],
            unknownItems: []
        };
    }

    const itemKeys = Object.keys(items);
    const isExplicitNC = Boolean(checklist.nonConformance);

    if (itemKeys.length === 0 && !isExplicitNC) {
        return {
            isProvided: false,
            isComplete: false,
            isPassed: false,
            failedItems: [],
            unansweredItems: [...standardKeys],
            invalidNAItems: [],
            unknownItems: []
        };
    }

    // Recognized aliases per criterion
    const ALIAS_MAP = {
        container: ['container', 'containerIntact', 'bagIntact'],
        label: ['label', 'labelLegible'],
        quantity: ['quantity', 'quantitySufficient', 'massAdequate'],
        condition: ['condition', 'conditionGood', 'noLeakage'],
        coc: ['coc', 'cocPresent']
    };

    const allRecognizedAliases = new Set([
        ...Object.values(ALIAS_MAP).flat(),
        'reason', 'nonConformance', 'notes', 'photos'
    ]);

    const unknownItems = itemKeys.filter(k => !allRecognizedAliases.has(k));

    const resolvedItems = {};
    const failedItems = [];
    const unansweredItems = [];
    const invalidNAItems = [];

    for (const key of standardKeys) {
        const aliases = ALIAS_MAP[key];
        const evaluatedStatuses = [];
        let note = '';

        for (const alias of aliases) {
            const val = items[alias];
            if (val === undefined || val === null) continue;

            if (typeof val === 'boolean') {
                evaluatedStatuses.push(val ? 'PASS' : 'FAIL');
            } else if (typeof val === 'string') {
                const s = val.trim().toUpperCase();
                if (s === 'PASS' || s === 'OK') evaluatedStatuses.push('PASS');
                else if (s === 'FAIL') evaluatedStatuses.push('FAIL');
                else if (s === 'NA' || s === 'N/A') evaluatedStatuses.push('NA');
            } else if (typeof val === 'object') {
                if (val.status) {
                    const s = String(val.status).trim().toUpperCase();
                    if (s === 'PASS' || s === 'OK') evaluatedStatuses.push('PASS');
                    else if (s === 'FAIL') evaluatedStatuses.push('FAIL');
                    else if (s === 'NA' || s === 'N/A') evaluatedStatuses.push('NA');
                }
                if (val.note) note = String(val.note);
            }
        }

        if (evaluatedStatuses.length === 0) {
            unansweredItems.push(key);
            resolvedItems[key] = { status: undefined };
        } else {
            // If any alias failed, fail closed!
            let finalStatus;
            if (evaluatedStatuses.includes('FAIL')) {
                finalStatus = 'FAIL';
            } else if (evaluatedStatuses.includes('NA')) {
                finalStatus = 'NA';
            } else if (evaluatedStatuses.every(s => s === 'PASS')) {
                finalStatus = 'PASS';
            } else {
                finalStatus = 'FAIL';
            }

            resolvedItems[key] = { status: finalStatus, note };

            if (finalStatus === 'FAIL') {
                failedItems.push({ key, note });
            } else if (finalStatus === 'NA') {
                // N/A policy:
                // coc is permitted N/A ONLY if isWalkIn === true
                if (key === 'coc') {
                    if (!isWalkIn) {
                        invalidNAItems.push('coc');
                    }
                } else {
                    invalidNAItems.push(key);
                }
            }
        }
    }

    if (isExplicitNC && failedItems.length === 0) {
        failedItems.push({ key: 'general', note: checklist.reason || 'General non-conformance flagged' });
    }

    const isComplete = unansweredItems.length === 0 && unknownItems.length === 0;
    const isPassed = isComplete && failedItems.length === 0 && invalidNAItems.length === 0;

    return {
        isProvided: true,
        isComplete,
        isPassed,
        failedItems,
        unansweredItems,
        invalidNAItems,
        unknownItems,
        resolvedItems
    };
}
exports.evaluateChecklistCompliance = evaluateChecklistCompliance;

