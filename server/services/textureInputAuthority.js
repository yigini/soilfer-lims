const { unitCode } = require('./crossParameterEvaluator');
const FRACTIONS = Object.freeze(['SAND', 'SILT', 'CLAY']);

// #278/#291: the one input authority for every texture derivation and for the
// blocking closure gate. Each fraction needs exactly one uncensored, finite,
// stored numeric value recorded in '%'. A missing stored unit is never inferred
// from the catalogue or any other source. `candidates` holds the rows of SAND,
// SILT and CLAY in that order as { value, unit, censoring }.
function textureInputs(candidates) {
    if (candidates.length !== FRACTIONS.length || candidates.some(rows => !Array.isArray(rows) || rows.length !== 1)) {
        return { reasonCode: 'MULTIPLE_CANDIDATES' };
    }
    const rows = candidates.map(rows => rows[0]);
    if (rows.some(row => (row.censoring ?? 'NONE') !== 'NONE')) return { reasonCode: 'INPUT_CENSORED' };
    if (rows.some(row => typeof row.value !== 'number' || !Number.isFinite(row.value))) return { reasonCode: 'INPUT_NON_NUMERIC' };
    if (rows.some(row => typeof row.unit !== 'string' || !row.unit.trim())) return { reasonCode: 'UNIT_MISSING' };
    if (rows.some(row => unitCode(row.unit) !== '%')) return { reasonCode: 'UNIT_MISMATCH' };
    return { values: rows.map(row => row.value) };
}

// The closure tolerance widens only a valid policy value. Anything else (an
// unresolved or invalid stored value, #281) is exact closure, never wider.
function closureOptions(tolerancePct) {
    return typeof tolerancePct === 'number' && require('../config/policyRegistry').valid('crossCheck.textureClosureTolerancePct', tolerancePct)
        ? { tolerance: tolerancePct } : null;
}

module.exports = { FRACTIONS, textureInputs, closureOptions };
