const prisma = require('../prisma');
const { calculateUsdaTexture } = require('../utils/soilCalculations');
const { strict, valid } = require('../config/policyRegistry');

exports.validateResult = async (paramId, value, methodologyId = null, db = prisma) => {
    if (value === null || value === undefined || String(value).trim() === '') {
        return { valid: true, flags: [] }; // Blank or pending
    }

    const strVal = String(value).trim();
    // Normalize locale decimal comma: "12,5" -> "12.5"
    const normalizedStr = strVal.replace(',', '.');

    // Strict numeric regex: numbers like 12, 12.5, -0.5
    const numericPattern = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?';
    const isStrictNumeric = new RegExp(`^${numericPattern}$`).test(normalizedStr) && Number.isFinite(Number(normalizedStr));

    if (!isStrictNumeric) {
        // Support below LOQ / above range censoring markers like "<0.5", "< 0.01", ">100"
        if (new RegExp(`^[<>]\\s*${numericPattern}$`).test(normalizedStr) && Number.isFinite(Number(normalizedStr.replace(/^[<>]\s*/, '')))) {
            const cleanNum = parseFloat(normalizedStr.replace(/^[<>]\s*/, ''));
            return {
                valid: true,
                flags: ['CENSORED_VALUE'],
                isCensored: true,
                censoring: normalizedStr.startsWith('<') ? 'BELOW_LOQ' : 'ABOVE_RANGE',
                normalizedValue: cleanNum
            };
        }
        return { valid: false, flags: ['INVALID_FORMAT'] };
    }

    const numVal = parseFloat(normalizedStr);
    const flags = [];

    let analysis = null;
    let methodology = null;

    if (paramId) {
        [analysis, methodology] = await Promise.all([
            db.analysis.findUnique({ where: { code: paramId } }),
            methodologyId ? db.methodology.findUnique({ where: { id: methodologyId } }) : null
        ]);
    }

    // Method-specific limits override Analysis generic rules
    let min = methodology?.loq ?? analysis?.loq;
    let max = null;

    if (analysis?.validation) {
        try {
            const rules = JSON.parse(analysis.validation);
            if (rules.min != null && min == null) min = rules.min;
            if (rules.max !== undefined) max = rules.max;
        } catch (e) { }
    }

    if (min !== null && min !== undefined && numVal < min) {
        flags.push('BELOW_MIN');
    }
    if (max !== null && max !== undefined && numVal > max) {
        flags.push('ABOVE_MAX');
    }

    return {
        valid: flags.length === 0,
        flags,
        normalizedValue: numVal,
        precision: methodology?.decimalPlaces ?? analysis?.decimalPlaces ?? 2
    };
};

const TEXTURE_FRACTIONS = Object.freeze(['SAND', 'SILT', 'CLAY']);

// #278/#291: the blocking closure gate reads the stored numeric value, unit and
// censoring of each current fraction through the shared texture input
// authority, never re-parsed text. A replicate with a non-'%' unit, censored,
// non-numeric or ambiguous fractions is disclosed as not evaluated and does not
// block. A fraction with no stored unit or censoring is never given one; it is
// checked with exact closure, never the wider laboratory tolerance.
function textureGate(results, tolerancePct) {
    const { textureInputs, closureOptions } = require('../services/textureInputAuthority');
    const replicates = new Map();
    for (const row of results) {
        const param = String(row.param || '').toUpperCase();
        if (!TEXTURE_FRACTIONS.includes(param)) continue;
        const replicateNo = Number(row.replicateNo ?? 1);
        if (!replicates.has(replicateNo)) replicates.set(replicateNo, new Map());
        const group = replicates.get(replicateNo);
        if (!group.has(param)) group.set(param, []);
        group.get(param).push(row);
    }
    const evaluations = [];
    for (const [replicateNo, group] of [...replicates].sort((a, b) => a[0] - b[0])) {
        if (TEXTURE_FRACTIONS.some(param => !group.has(param))) continue;
        const rows = TEXTURE_FRACTIONS.map(param => group.get(param));
        const inputs = textureInputs(rows.map(candidates => candidates.map(row => ({ value: row.numericValue, unit: row.unit, censoring: row.censoring }))));
        if (inputs.reasonCode && !inputs.unknown) {
            evaluations.push({ replicateNo, outcome: 'NOT_EVALUATED', reasonCode: inputs.reasonCode, tolerancePct }); continue;
        }
        const [sand, silt, clay] = rows.map(candidates => candidates[0]);
        // #281: an invalid stored laboratory tolerance is exact closure, never a wider one.
        // A missing stored unit or censoring is never inferred; it closes exactly, as before #278.
        const applied = inputs.unknown ? null : closureOptions(tolerancePct);
        const texture = calculateUsdaTexture(sand.numericValue, silt.numericValue, clay.numericValue, applied);
        evaluations.push({ replicateNo, outcome: texture.isValid ? 'PASS' : 'BLOCKED',
            reasonCode: inputs.unknown ? inputs.unknown.join('_AND_') + '_EXACT_CLOSURE' : null, tolerancePct: applied ? applied.tolerance : null,
            values: { sand: sand.numericValue, silt: silt.numericValue, clay: clay.numericValue },
            resultIds: [sand, silt, clay].map(row => row.id ?? null), texture });
    }
    return evaluations;
}

/**
 * Blocking texture-closure gate for a sample's current results (#278). The
 * advisory cross-parameter checks live in crossParameterEvaluator (#201, #279).
 * @param {Array<{ param: string, numericValue?: number, unit?: string, censoring?: string, replicateNo?: number }>} results
 * @param {{ textureClosureTolerancePct?: number, texturePolicyInvalid?: boolean }} [context]
 *   The laboratory's policy tolerance (#278).
 */
exports.validateSampleMatrix = (results, context = {}) => {
    // #281: a stored tolerance outside the registry bounds is disclosed and the gate
    // closes exactly (the strictest reading) until a manager saves a valid value.
    const policyInvalid = context.texturePolicyInvalid === true;
    const tolerancePct = policyInvalid ? null : context.textureClosureTolerancePct ?? strict('crossCheck.textureClosureTolerancePct');
    if (!policyInvalid && !valid('crossCheck.textureClosureTolerancePct', tolerancePct)) {
        throw Object.assign(new Error('Texture closure requires a valid laboratory tolerance.'), { statusCode: 409, code: 'CROSS_CHECK_POLICY_REQUIRED' });
    }
    const diagnostics = {
        texture: null,
        textureClosure: [],
        // #279 (YY: "retire"): the legacy C:N and base/CEC advisories, with
        // their text parsing, inferred units and missing-Na = 0 default, are
        // retired. The #201 crossChecks are the only plausibility source.
        retiredAdvisories: ['CN_RATIO', 'BASES_CEC'],
        advisorySuccessor: 'crossChecks',
        warnings: [],
        blockingErrors: [],
        isBlocking: false
    };
    if (policyInvalid) {
        diagnostics.texturePolicyInvalid = true;
        diagnostics.warnings.push('Texture closure tolerance unavailable: CROSS_CHECK_POLICY_INVALID; exact closure applies');
    }

    // 1. Texture Check (Sand, Silt, Clay) - BLOCKING within the lab tolerance
    diagnostics.textureClosure = textureGate(results, tolerancePct);
    for (const evaluation of diagnostics.textureClosure) {
        const replicate = diagnostics.textureClosure.length > 1 ? ` (replicate ${evaluation.replicateNo})` : '';
        if (evaluation.outcome === 'NOT_EVALUATED') {
            diagnostics.warnings.push(`Texture closure not evaluated${replicate}: ${evaluation.reasonCode}`);
            continue;
        }
        diagnostics.texture ??= evaluation.texture;
        if (evaluation.reasonCode) diagnostics.warnings.push(`Texture closure${replicate}: ${evaluation.reasonCode}`);
        if (evaluation.outcome === 'BLOCKED') {
            const { sand, silt, clay } = evaluation.values;
            const msg = `Texture closure failed${replicate}: Sand(${sand}%) + Silt(${silt}%) + Clay(${clay}%) = ${(sand + silt + clay).toFixed(1)}% (must sum to 100% ${evaluation.tolerancePct === null ? 'exactly' : `± ${evaluation.tolerancePct}%`})`;
            diagnostics.warnings.push(msg);
            diagnostics.blockingErrors.push({
                check: 'TEXTURE_CLOSURE',
                severity: 'BLOCKING',
                message: msg,
                replicateNo: evaluation.replicateNo,
                tolerancePct: evaluation.tolerancePct
            });
            diagnostics.isBlocking = true;
        }
    }

    return diagnostics;
};

// #278: the laboratory policy tolerance (policyService; an unresolved historical
// lab gets the profile or registry value) for validateSampleMatrix.
exports.matrixContext = async (db, sample) => {
    const resolved = await require('../services/policyService').resolve(sample.assignedLab || sample.labId,
        'crossCheck.textureClosureTolerancePct', { db });
    return resolved.invalid ? { textureClosureTolerancePct: null, texturePolicyInvalid: true }
        : { textureClosureTolerancePct: resolved.value };
};

// Also export a route handler helper for ResultsController
exports.validateBatch = async (measurements, db = prisma) => {
    return Promise.all(measurements.map(async m => ({
        ...m,
        validation: await exports.validateResult(m.param, m.value, m.methodologyId, db)
    })));
};

