const { nativeCheckPolicy } = require('./qcNativeEvaluationService');
const { evaluateBlank } = require('./qcService');
const LIMIT_FIELDS = ['maxAllowed', 'maxRpd', 'absMax', 'absMaxBelow5LOQ', 'nearLoqMultiplier', 'loq',
    'minRecovery', 'maxRecovery', 'crmAbsWindow', 'lrmWindowPct', 'mode', 'crmMode', 'lrmMode'];

// Display parameters only. No observation, verdict, live policy or status is
// manufactured. Blank bounds use the same resolver as the real server check.
function nativePositionParameters(criteria, position, analysisCode) {
    const policy = nativeCheckPolicy(criteria, position);
    const parameters = { ...policy };
    if (['BLANK', 'CCB'].includes(position.kind)) {
        const resolved = evaluateBlank({ id: position.id }, policy);
        delete parameters.maxAllowed;
        if (resolved.maxAllowed !== undefined) parameters.maxAllowed = resolved.maxAllowed;
    }
    const reference = position.references?.find(row => row.analysisCode === analysisCode && !row.supersededById && row.serviceStatus !== 'NOT_SERVED');
    const snapshot = reference?.referenceSnapshot ? JSON.parse(reference.referenceSnapshot) : null;
    return { positionId: position.id, expected: snapshot?.expected ?? null,
        limits: Object.fromEntries(LIMIT_FIELDS.filter(key => parameters[key] !== undefined).map(key => [key, parameters[key]])),
        criterion: policy.mode ?? null, status: null, referenceSnapshot: snapshot };
}

module.exports = { nativePositionParameters, LIMIT_FIELDS };
