const { TransitionError } = require('./workflowStateRules');
const TEXTURE_ANALYSES = new Set(['TEXTURE', 'SAND', 'SILT', 'CLAY', 'pSA', 'PSA', 'textureSum']);
const FRACTIONS = ['SAND', 'SILT', 'CLAY'];

// Pin6095652486: the typed writer's decision lives here, shared with the
// import preflight. Ordinary calls retain the exact existing writer behavior.
// Import calls require an exact catalogue match and return receipt evidence.
function numericReportingUnit(ctx, measurement, { instrumentImport = false } = {}) {
    const fraction = FRACTIONS.includes(measurement.param) && TEXTURE_ANALYSES.has(ctx.analysis.code);
    if (instrumentImport) {
        const configured = fraction ? [['textureFraction', '%']] :
            [['units', ctx.analysis.units], ['unitCode', ctx.analysis.unitCode]].filter(([, value]) => value != null);
        if (!configured.length) throw new TransitionError('The analysis has no configured reporting unit.', 409, 'IMPORT_UNIT_UNAVAILABLE');
        const match = configured.find(([, value]) => value === measurement.unit);
        if (!match) throw new TransitionError('The imported unit must exactly match the configured reporting unit.', 409, 'IMPORT_UNIT_MISMATCH');
        return { unit: match[1], evidence: { analysisId: ctx.analysis.code, units: ctx.analysis.units ?? null,
            unitCode: ctx.analysis.unitCode ?? null, matchedField: match[0], matchedValue: match[1] } };
    }
    const unit = fraction ? '%' : measurement.unit || ctx.method?.unit || ctx.analysis.units || ctx.analysis.unitCode || null;
    if (!fraction && measurement.unit && ctx.analysis.units && ![ctx.analysis.units, ctx.analysis.unitCode].includes(measurement.unit)) {
        throw new TransitionError('Use the configured reporting unit.', 409, 'RESULT_UNIT_MISMATCH');
    }
    return unit;
}
module.exports = { numericReportingUnit, TEXTURE_ANALYSES, FRACTIONS };
