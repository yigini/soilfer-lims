const policyService = require('./policyService');
const { getNumberFormat } = require('./numberFormatService');
const { parseJson } = require('./cataloguePolicy');

async function resolveNumericValueRules(db, { labId, analysis, method, unit }) {
    const snapshot = await policyService.snapshot(labId, { db, analysisCode: analysis.code, methodologyId: method?.id || null });
    const configured = parseJson(analysis.validation, {}), values = snapshot.values;
    const ph = ['PH_H2O', 'PH_CACL2', 'PH_KCL', 'pH', 'WATER_PH'].includes(analysis.code);
    const rules = { min: ph ? values['results.phMin'] : configured.min ?? null,
        max: ph ? values['results.phMax'] : configured.max ?? null,
        typicalMin: values['results.typicalMin'], typicalMax: values['results.typicalMax'],
        calibrationMax: values['results.calibrationMax'], loq: method?.loq ?? null, lod: method?.lod ?? null,
        betweenLodLoq: values['results.betweenLodLoq'], unit: unit ?? analysis.units ?? analysis.unitCode ?? null };
    return { rules, numberFormat: await getNumberFormat(labId, { db, snapshot }), policyVersion: snapshot.version };
}

module.exports = { resolveNumericValueRules };
