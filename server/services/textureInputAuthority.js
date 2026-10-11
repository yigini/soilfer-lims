const { unitCode } = require('./crossParameterEvaluator');
const FRACTIONS = Object.freeze(['SAND', 'SILT', 'CLAY']);

// #278/#291: the one input authority for every texture derivation and for the
// blocking closure gate. Each fraction needs exactly one finite stored numeric
// value, recorded in '%', with censoring stored explicitly as 'NONE'. A missing
// stored unit or censoring is never inferred (catalogue, defaults or any other
// source): it is reported in `unknown`, which no derivation accepts and the
// gate checks with exact closure only. `candidates` holds the rows of SAND,
// SILT and CLAY in that order as { value, unit, censoring }.
function textureInputs(candidates) {
    if (candidates.length !== FRACTIONS.length || candidates.some(rows => !Array.isArray(rows) || rows.length !== 1)) {
        return { reasonCode: 'MULTIPLE_CANDIDATES' };
    }
    const rows = candidates.map(rows => rows[0]);
    if (rows.some(row => row.censoring != null && row.censoring !== 'NONE')) return { reasonCode: 'INPUT_CENSORED' };
    if (rows.some(row => typeof row.value !== 'number' || !Number.isFinite(row.value))) return { reasonCode: 'INPUT_NON_NUMERIC' };
    if (rows.some(row => present(row.unit) && unitCode(row.unit) !== '%')) return { reasonCode: 'UNIT_MISMATCH' };
    const unknown = [...(rows.some(row => !present(row.unit)) ? ['UNIT_MISSING'] : []),
        ...(rows.some(row => row.censoring == null) ? ['CENSORING_UNKNOWN'] : [])];
    const values = rows.map(row => row.value);
    return unknown.length ? { reasonCode: unknown[0], unknown, values } : { values };
}

// The stored Results behind a selected or averaged fraction value. Selection
// outputs default an absent censoring to 'NONE', so texture derivations also
// check the source rows themselves; returns the first reason code, or null.
function textureSourceReason(rows) {
    for (const row of rows) {
        if (row.censoring == null) return 'CENSORING_UNKNOWN';
        if (row.censoring !== 'NONE') return 'INPUT_CENSORED';
        if (!present(row.unit)) return 'UNIT_MISSING';
        if (unitCode(row.unit) !== '%') return 'UNIT_MISMATCH';
    }
    return null;
}

const present = unit => typeof unit === 'string' && unit.trim() !== '';

// The closure tolerance widens only a valid policy value. Anything else (an
// unresolved or invalid stored value, #281) is exact closure, never wider.
function closureOptions(tolerancePct) {
    return typeof tolerancePct === 'number' && require('../config/policyRegistry').valid('crossCheck.textureClosureTolerancePct', tolerancePct)
        ? { tolerance: tolerancePct } : null;
}

module.exports = { FRACTIONS, textureInputs, textureSourceReason, closureOptions };
