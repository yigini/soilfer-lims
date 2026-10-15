const { parseJson, GATE_CODES, configurationIssues } = require('./cataloguePolicy');
const { isAvailable } = require('./methodResolution');
const { evaluateExecutionReadiness } = require('./workbenchReadinessService');

// These are the existing entry classifiers, also used by the result authority.
const {PREP_CODES,SPECTRAL_CODES,isNonMeasurement}=require('./workItemKinds');

// The legacy sample results endpoint must not bypass catalogue, assignment or sealed-work rules.
async function validateResultEntries(db, sample, measurements, user) {
    if (!Array.isArray(measurements) || !measurements.length || measurements.length > 1000) return 'Provide between 1 and 1000 measurements.';
    const keys = new Set();
    const ordered = parseJson(sample.requiredAnalyses, []);
    for (const measurement of measurements) {
        if (!measurement || typeof measurement.param !== 'string') return 'Choose a configured parameter for every measurement.';
        const { param, methodologyId, unit } = measurement;
        const replicate = measurement.replicateNo ?? 1;
        if (!Number.isInteger(Number(replicate)) || Number(replicate) < 1) return 'Replicate number must be a positive integer.';
        const key = `${param}:${Number(replicate)}`;
        if (keys.has(key)) return 'A parameter and replicate may appear only once in each save.';
        keys.add(key);
        if (GATE_CODES.has(param) || PREP_CODES.has(param)) return 'Record operational evidence through the assigned checklist.';
        if (SPECTRAL_CODES.has(param)) return 'Upload or link a spectrum through spectral intake; a numerical value is not a spectrum.';
        const analysis = await db.analysis.findUnique({ where: { code: param } });
        const labId = sample.assignedLab || sample.labId;
        if (!analysis || (analysis.labId && analysis.labId !== labId)) return 'A selected parameter is not available to this laboratory.';
        if (configurationIssues(analysis).length) return `${analysis.name}: the parameter configuration requires correction before recording results.`;
        const items = await db.workItem.findMany({ where: require('./workAttemptContract').canonicalWorkItemWhere(sample.id,param) });
        if (!items.length) throw new (require('./workflowStateRules').TransitionError)('Reconcile the order before recording this parameter.',409,'RESULT_WORKITEM_REQUIRED');
        for(const item of items.filter(row=>['COMPLETED','SUBMITTED','ACCEPTED','APPROVED','VALIDATED'].includes(row.status))) {
            const recorded=await require('./resultWriteService').recordedExecution(db,item,param);
            if(item.status!=='COMPLETED' || !recorded)return `${analysis.name} is already recorded or sealed. Use the correction workflow.`;
        }
        if (user?.role === 'LAB_TECHNICIAN' && !items.some(item => item.assignedTo === user.username)) return `${analysis.name} is not assigned to you.`;
        for (const item of items) {
            const readiness = await evaluateExecutionReadiness(db, { ...item, sample }, user);
            if (!readiness.isReady) return readiness.reasons.join(' ');
            if (item.methodologyId && methodologyId !== item.methodologyId) return `${analysis.name}: use the method assigned to this work item.`;
        }
        if (methodologyId) {
            const method = await db.methodology.findUnique({ where: { id: methodologyId } });
            if (!isAvailable(method, param, labId)) return `${analysis.name}: the selected method belongs to a different parameter or laboratory.`;
        }
        if (unit && analysis.units && unit !== analysis.units && unit !== analysis.unitCode) return `${analysis.name}: use the configured reporting unit (${analysis.units}).`;
        // Retired definitions may finish existing orders; they cannot be newly selected.
    }
    return null;
}

module.exports = { validateResultEntries, isNonMeasurement, SPECTRAL_CODES };
