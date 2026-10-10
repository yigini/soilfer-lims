const { UNITS } = require('../seeds/units');
const { valid } = require('../config/policyRegistry');

const POLICY_KEYS = Object.freeze(['crossCheck.basesCecFactor', 'crossCheck.baseSaturationMaxPct',
    'crossCheck.textureClosureTolerancePct', 'crossCheck.cnMin', 'crossCheck.cnMax', 'crossCheck.carbonatePhMin']);
const codes = new Set(UNITS.map(unit => unit.code));
const synonyms = new Map();
for (const unit of UNITS) {
    for (const name of [unit.display, ...JSON.parse(unit.synonyms)]) {
        if (!name) continue;
        if (!synonyms.has(name)) synonyms.set(name, new Set());
        synonyms.get(name).add(unit.code);
    }
}
function unitCode(recorded) {
    if (typeof recorded !== 'string' || !recorded.trim()) return null;
    if (codes.has(recorded)) return recorded;
    const matches = synonyms.get(recorded);
    return matches?.size === 1 ? [...matches][0] : null;
}
const rules = Object.freeze([
    { code: 'TEXTURE_CLOSURE', inputs: ['SAND', 'SILT', 'CLAY'], units: ['%'], keys: ['crossCheck.textureClosureTolerancePct'] },
    { code: 'BASES_CEC', inputs: ['EXCH_CA', 'EXCH_MG', 'EXCH_K', 'EXCH_NA', 'CEC'],
        units: ['cmol(+)/kg'], basis: true, denominator: 'CEC', missingNa: true,
        keys: ['crossCheck.basesCecFactor'], flag: 'CROSS_CHECK_BASES_GT_CEC' },
    { code: 'BASE_SATURATION', inputs: ['EXCH_CA', 'EXCH_MG', 'EXCH_K', 'EXCH_NA', 'CEC'],
        units: ['cmol(+)/kg'], basis: true, denominator: 'CEC', missingNa: true,
        keys: ['crossCheck.baseSaturationMaxPct'], flag: 'CROSS_CHECK_BASE_SAT_GT_MAX' },
    { code: 'CN_RATIO', inputs: ['SOC', 'TN'], units: ['%', 'g/kg', 'mg/g', 'mg/kg'], equalUnits: true,
        basis: true, denominator: 'TN', keys: ['crossCheck.cnMin', 'crossCheck.cnMax'], flag: 'CROSS_CHECK_CN_OUT_OF_RANGE' },
    { code: 'CACO3_PH', inputs: ['CACO3', 'PH_H2O'],
        unitsByInput: { CACO3: ['%', 'g/kg', 'mg/kg'], PH_H2O: ['pH_units'] },
        keys: ['crossCheck.carbonatePhMin'], flag: 'CROSS_CHECK_CACO3_LOW_PH' },
    { code: 'PH_KCL_WATER', inputs: ['PH_KCL', 'PH_H2O'], units: ['pH_units'],
        keys: [], flag: 'CROSS_CHECK_PH_SALT_GE_WATER' },
    { code: 'PH_CACL2_WATER', inputs: ['PH_CACL2', 'PH_H2O'], units: ['pH_units'],
        keys: [], flag: 'CROSS_CHECK_PH_SALT_GE_WATER' }
]);

// #201 pins6092380877/6092654261. Pure evaluation of stored numeric evidence:
// no parser, selection, average, conversion, missing-value default or writes.
function evaluateCrossParameters(rows, snapshot) {
    if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object')) {
        throw Object.assign(new Error('Cross-check inputs must be stored rows.'), { statusCode: 400, code: 'CROSS_CHECK_INPUT_INVALID' });
    }
    if (!snapshot || !Number.isSafeInteger(snapshot.version) || snapshot.version < 0 ||
        POLICY_KEYS.some(key => !valid(key, snapshot.values?.[key])) ||
        snapshot.values['crossCheck.cnMin'] >= snapshot.values['crossCheck.cnMax']) {
        throw Object.assign(new Error('Cross-checks require a valid laboratory policy snapshot.'), { statusCode: 409, code: 'CROSS_CHECK_POLICY_REQUIRED' });
    }
    const groups = new Map();
    for (const row of rows) {
        if (!groups.has(row.param)) groups.set(row.param, []);
        groups.get(row.param).push(row);
    }
    return rules.map(rule => {
        const missing = rule.inputs.filter(code => !groups.get(code)?.length);
        const candidates = rule.inputs.flatMap(code => groups.get(code) || []);
        const lowerBound = !!(rule.missingNa && missing.length === 1 && missing[0] === 'EXCH_NA');
        const evidence = candidates.map(row => ({ analysisCode: row.param,
            resultIds: row.sourceResultIds ? [...row.sourceResultIds] : row.id ? [row.id] : [],
            selectionId: row.selectionId ?? null, value: row.numericValue ?? null,
            unit: row.unit ?? null, basis: row.basis ?? null, censoring: row.censoring ?? null,
            mode: row.mode ?? null }));
        const thresholds = { policyVersion: snapshot.version,
            ...Object.fromEntries(rule.keys.map(key => [key, snapshot.values[key]])) };
        const result = (outcome, reasonCode = null) => ({ ruleCode: rule.code, outcome, reasonCode,
            flagCode: outcome === 'FLAGGED' ? rule.flag || 'TEXTURE_CLOSURE' : null,
            severity: 'ADVISORY', inputs: { values: evidence, missing, lowerBound }, thresholds });
        // The order is part of pin6092654261, including all candidates rather
        // than picking a value before detecting a malformed/ambiguous input.
        if (missing.length && !lowerBound) return result('NOT_EVALUATED', 'INPUT_MISSING');
        if (candidates.some(row => row.mode === 'NOT_REPORTABLE' || row.censoring === 'NOT_REPORTABLE'))
            return result('NOT_EVALUATED', 'INPUT_NOT_REPORTABLE');
        if (candidates.some(row => typeof row.numericValue !== 'number' || !Number.isFinite(row.numericValue)))
            return result('NOT_EVALUATED', 'INPUT_NON_NUMERIC');
        if (candidates.some(row => row.censoring !== 'NONE')) return result('NOT_EVALUATED', 'INPUT_CENSORED');
        if (rule.inputs.some(code => (groups.get(code)?.length || 0) > 1)) return result('NOT_EVALUATED', 'MULTIPLE_CANDIDATES');
        const units = candidates.map(row => unitCode(row.unit));
        if (candidates.some((row, index) => !(rule.unitsByInput?.[row.param] || rule.units).includes(units[index])) ||
            rule.equalUnits && new Set(units).size !== 1) return result('NOT_EVALUATED', 'UNIT_MISMATCH');
        if (rule.basis && (candidates.some(row => typeof row.basis !== 'string' || !row.basis.trim()) ||
            new Set(candidates.map(row => row.basis)).size !== 1)) return result('NOT_EVALUATED', 'BASIS_MISMATCH');
        const value = code => groups.get(code)?.[0].numericValue;
        if (rule.denominator && value(rule.denominator) <= 0) return result('NOT_EVALUATED', 'DENOMINATOR_NOT_POSITIVE');
        const p = snapshot.values;
        let flagged;
        if (rule.code === 'TEXTURE_CLOSURE') {
            flagged = Math.abs(value('SAND') + value('SILT') + value('CLAY') - 100) > p['crossCheck.textureClosureTolerancePct'];
        } else if (rule.code === 'BASES_CEC' || rule.code === 'BASE_SATURATION') {
            const usedBases = ['EXCH_CA', 'EXCH_MG', 'EXCH_K', ...(lowerBound ? [] : ['EXCH_NA'])];
            const sum = usedBases.reduce((total, code) => total + value(code), 0);
            // Keep ordinary full-precision arithmetic; only rearrange the
            // same ratio when finite stored values overflow their sum.
            const ratio = Number.isFinite(sum) ? sum / value('CEC')
                : usedBases.reduce((total, code) => total + value(code) / value('CEC'), 0);
            const limit = value('CEC') * p['crossCheck.basesCecFactor'];
            if (Number.isNaN(ratio)) return result('NOT_EVALUATED', 'INPUT_NON_NUMERIC');
            flagged = rule.code === 'BASES_CEC' ? Number.isFinite(sum) && Number.isFinite(limit)
                ? sum > limit : ratio > p['crossCheck.basesCecFactor']
                : ratio * 100 > p['crossCheck.baseSaturationMaxPct'];
        } else if (rule.code === 'CN_RATIO') {
            const ratio = value('SOC') / value('TN');
            flagged = ratio < p['crossCheck.cnMin'] || ratio > p['crossCheck.cnMax'];
        } else if (rule.code === 'CACO3_PH') {
            flagged = value('CACO3') > 0 && value('PH_H2O') < p['crossCheck.carbonatePhMin'];
        } else {
            flagged = value(rule.inputs[0]) >= value('PH_H2O');
        }
        if (lowerBound && !flagged) return result('NOT_EVALUATED', 'INPUT_MISSING');
        return result(flagged ? 'FLAGGED' : 'PASS');
    });
}
module.exports = { evaluateCrossParameters };
