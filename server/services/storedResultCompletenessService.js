const { TEXTURE_ALIASES, DERIVED_TEXTURE_FRACTIONS, governsResult } = require('./reportResultGovernance');
const { parseJson, configurationIssues } = require('./cataloguePolicy');
const validation = require('./workbenchValidationService');
const { getNumberFormat } = require('./numberFormatService');
const { evaluateExecutionReadiness } = require('./workbenchReadinessService');
const policyService = require('./policyService');

// Reuse workbench validators against existing evidence; never change Result values.
async function checkStoredCompletion(db, sample, item, results, actor) {
    const current = results.filter(result => result.isCurrent && governsResult(item, result));
    if (!current.length || current.some(result => result.isValid === false)) return { ready: false, code: 'CURRENT_RESULT_REQUIRED' };
    const method = await db.analysis.findUnique({ where: { code: item.analysis } });
    if (!method || configurationIssues(method).length) return { ready: false, code: 'ANALYSIS_CONFIGURATION_REQUIRED' };
    const policy = await policyService.snapshot(sample.assignedLab || sample.labId, { db, analysisCode: item.analysis, methodologyId: item.methodologyId });
    const format = await getNumberFormat(sample.assignedLab || sample.labId, { snapshot: policy });
    const methodRules = parseJson(method.validation);
    for (const replicateNo of [...new Set(current.map(result => result.replicateNo))]) {
        const rows = current.filter(result => result.replicateNo === replicateNo);
        if (TEXTURE_ALIASES.has(item.analysis)) {
            const fractions = Object.fromEntries(DERIVED_TEXTURE_FRACTIONS.map(param => [param.toLowerCase(), rows.find(result => result.param === param)?.value]));
            const checked = validation.validateTextureFractions(fractions, typeof methodRules?.tolerance === 'number' ? methodRules.tolerance : null, format);
            if (!checked.isValid) return { ready: false, code: checked.code || 'INCOMPLETE_FRACTIONS' };
        } else {
            if (rows.some(result => !validation.validateNumericMethod(result.value, methodRules, format).isValid)) return { ready: false, code: 'RESULT_NOT_COMPLETE' };
        }
    }
    const mapping = await db.equipmentMethodEligibility.findFirst({ where: { labId: sample.assignedLab || sample.labId, analysisCode: item.analysis } });
    const eligibleIds = mapping ? parseJson(mapping.eligibleEquipmentIds, []) : [];
    if (!Array.isArray(eligibleIds)) return { ready: false, code: 'INSTRUMENT_CONFIGURATION_INVALID' };
    for (const result of current) {
        const selectedEquipmentId = result.equipmentId || item.equipmentId;
        const asset = selectedEquipmentId ? await db.equipmentAsset.findUnique({ where: { id: selectedEquipmentId } }) : null;
        if (selectedEquipmentId && (!asset || asset.status !== 'IN_SERVICE')) return { ready: false, code: 'INSTRUMENT_NOT_AVAILABLE' };
        const readiness = await evaluateExecutionReadiness(db, { ...item, sample }, actor, { selectedEquipmentId, asset,
            equipReq: mapping && { isRequired: mapping.isRequired, eligibleIds } });
        if (!readiness.isReady) return { ready: false, code: readiness.blockers[0], blockers: readiness.blockers };
    }
    return { ready: true, resultIds: current.map(result => result.id), policyVersion: policy.version };
}

module.exports = { checkStoredCompletion };
