'use strict';

const SCHEMA_VERSION = '2026-10-issue333-v2';
const CENSORING_MARKERS = Object.freeze({ BELOW_LOD: '<LOD', BELOW_LOQ: '<LOQ', ABOVE_RANGE: '>RANGE' });
const finite = value => typeof value === 'number' && Number.isFinite(value);

// The caller supplies its read transaction. Only methodologies explicitly named
// by these results can provide quality values; analysis defaults cannot do so.
async function readMethodContexts(db, results) {
    if (!results.length) return new Map();
    const policies = require('./policyService');
    const { isAvailable } = require('./methodResolution');
    const refs = [...new Set(results.map(row => row.sample.assignedLab).filter(Boolean))];
    const ids = [...new Set(results.map(row => row.methodologyId).filter(Boolean))];
    const [labs, methods] = await Promise.all([
        db.lab.findMany({ where: { OR: [{ id: { in: refs } }, { code: { in: refs } }] }, select: { id: true, code: true } }),
        db.methodology.findMany({ where: { id: { in: ids } } })
    ]);
    const byId = new Map(labs.map(lab => [lab.id, lab]));
    const byCode = new Map(labs.map(lab => [lab.code, lab]));
    const methodById = new Map(methods.map(method => [method.id, method]));
    const policyByScope = new Map();
    const contexts = new Map();
    for (const row of results) {
        const lab = byId.get(row.sample.assignedLab) || byCode.get(row.sample.assignedLab);
        const candidate = methodById.get(row.methodologyId);
        const method = isAvailable(candidate, row.param, lab?.id || null) ? candidate : null;
        const context = { labId: lab?.id || null, method, mode: 'NOT_REPORTED', coverageFactor: null };
        if (method && lab && finite(method.uncertainty)) {
            const scopeKey = JSON.stringify([lab.id, row.param, method.id]);
            if (!policyByScope.has(scopeKey)) {
                const scope = { db, analysisCode: row.param, methodologyId: method.id };
                const [mode, coverageFactor] = await Promise.all([
                    policies.get(lab.id, 'report.uncertaintyMode', scope),
                    policies.get(lab.id, 'report.uncertaintyCoverageFactor', scope)
                ]);
                policyByScope.set(scopeKey, { mode, coverageFactor });
            }
            Object.assign(context, policyByScope.get(scopeKey));
        }
        contexts.set(row.id, context);
    }
    return contexts;
}

function methodQuality(context, controlledUnit) {
    const { method, mode, coverageFactor } = context || {};
    if (!method) return {};
    const unit = typeof controlledUnit === 'string' && controlledUnit.trim() ? controlledUnit : null;
    const quality = {};
    if (unit && finite(method.lod)) quality.limitOfDetection = { value: method.lod, unit };
    if (unit && finite(method.loq)) quality.limitOfQuantification = { value: method.loq, unit };
    if (finite(method.uncertainty) &&
        (mode === 'EXPANDED_RELATIVE_PCT' || mode === 'EXPANDED_ABSOLUTE' && unit)) {
        quality.uncertainty = {
            value: method.uncertainty,
            unit: mode === 'EXPANDED_RELATIVE_PCT' ? '%' : unit,
            ...(mode === 'EXPANDED_RELATIVE_PCT' ? { relative: true } : {}),
            type: 'expanded',
            ...(finite(coverageFactor) ? { coverageFactor } : {})
        };
    }
    return quality;
}

function censoringFields(result, method) {
    if (!result.censoring || result.censoring === 'NONE') return {};
    const censored = Object.hasOwn(CENSORING_MARKERS, result.censoring) ? CENSORING_MARKERS[result.censoring] : null;
    if (!censored) {
        throw Object.assign(new Error('Stored censoring cannot be represented by this exchange schema.'),
            { statusCode: 409, code: 'EXCHANGE_CENSORING_UNSUPPORTED' });
    }
    // value is the canonical stored entry. A substituted numericValue is not
    // evidence of a threshold. Preserve an explicit typed limit when present.
    const typed = typeof result.value === 'string' &&
        /^[<>]=?\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)$/.exec(result.value.trim());
    const typedLimit = typed ? Number(typed[1]) : null;
    const fallback = result.censoring === 'BELOW_LOD' ? method?.lod :
        result.censoring === 'BELOW_LOQ' ? method?.loq : null;
    const limit = finite(typedLimit) ? typedLimit : fallback;
    return { censored, censoringLimit: finite(limit) ? limit : null };
}

module.exports = { SCHEMA_VERSION, CENSORING_MARKERS, readMethodContexts, methodQuality, censoringFields };
