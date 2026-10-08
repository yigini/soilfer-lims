const { evaluateBlank, evaluateDuplicate, evaluateControl } = require('./qcService');
const { currentAnalyteEvidence } = require('./qcRunViewService');

function nativeCheckPolicy(criteria, position) {
    const values = Object.fromEntries(Object.entries(criteria.qcRule.resolved).map(([key, row]) => [key, row.value]));
    const method = criteria.methodContext;
    if (['BLANK', 'CCB'].includes(position.kind)) return { maxAllowed: values.blankAbsLimit, mode: values.blankLimitMode, ...method };
    if (['SAMPLE', 'DUPLICATE'].includes(position.kind)) return { ...method, numberFormat: criteria.numberFormat,
        maxRpd: values.duplicateRpdMax, mode: values.duplicateMode, absMax: values.duplicateAbsMax,
        absMaxBelow5LOQ: values.duplicateAbsMaxBelow5LOQ, nearLoqMultiplier: criteria.policySnapshot.values['qc.duplicateNearLoqMultiplier'] };
    return ['ICV', 'CCV'].includes(position.kind)
        ? { minRecovery: values.ccvMin, maxRecovery: values.ccvMax, lrmWindowPct: null, lrmMode: 'FIXED_WINDOW' }
        : { minRecovery: values.crmRecoveryMin, maxRecovery: values.crmRecoveryMax, crmMode: values.crmMode,
            crmAbsWindow: values.crmAbsWindow, lrmMode: values.lrmMode, lrmWindowPct: values.lrmWindowPct };
}

// A started run never reads current policy, method limits or catalogue values.
// The result is separate from the aggregate state: NOT_REQUIRED is not a pass.
function evaluateNativeEvidence(batch, analyte, { recordedObservations = false } = {}) {
    const criteria = JSON.parse(analyte.criteriaSnapshot), evidence = currentAnalyteEvidence(batch, analyte.analysisCode);
    const values = Object.fromEntries(Object.entries(criteria.qcRule.resolved).map(([key, row]) => [key, row.value]));
    const calibrationActions = criteria.policySnapshot.values['qc.calibrationFailAction'];
    const calibrationFailActionSource = calibrationActions ? 'SNAPSHOT' : 'LEGACY_SNAPSHOT_FALLBACK';
    const at = positionId => evidence.measurements.find(row => row.positionId === positionId && row.replicateNo === 1);
    const binding = position => (position.references || []).find(row => row.analysisCode === analyte.analysisCode && !row.supersededById);
    const frozenRequired = new Set(Object.values(criteria.requiredPositions).flat());
    const required = position => frozenRequired.has(position.id);
    const positions = evidence.positions.filter(row => row.kind !== 'SAMPLE' && row.kind !== 'CAL_STD');
    const requiredIds = new Set([...frozenRequired, ...positions.filter(row => required(row) && row.kind === 'DUPLICATE').map(row => row.duplicateOfPositionId)]);
    const missingPositions = [...requiredIds].filter(id => !at(id));
    const unboundPositions = positions.filter(row => ['LRM', 'CRM', 'ICV', 'CCV'].includes(row.kind) &&
        (required(row) || at(row.id)) && !binding(row)).map(row => row.id);
    const blanks = [], duplicates = [], controls = [], warnings = [];
    if (criteria.qcMode !== 'OFF') for (const position of positions) {
        const measurement = at(position.id);
        if (!measurement) continue;
        let evaluated;
        if (['BLANK', 'CCB'].includes(position.kind)) {
            evaluated = evaluateBlank({ id: position.id, value: measurement.value },
                nativeCheckPolicy(criteria, position));
            evaluated.value = measurement.value;
            evaluated.rawInput = { value: measurement.rawInput };
            blanks.push(evaluated);
        } else if (position.kind === 'DUPLICATE') {
            const parent = at(position.duplicateOfPositionId);
            if (!parent) continue;
            const observation = row => recordedObservations
                ? require('./qcReviewedCorrectionService').savedDuplicateObservation(row, criteria.numberFormat)
                : row.censoring ? row.rawInput : row.value;
            evaluated = evaluateDuplicate({ id: position.id, value1: parent.value, value2: measurement.value,
                rawInput: { value1: observation(parent), value2: observation(measurement) } },
            { ...nativeCheckPolicy(criteria, position), recordedCriteria: recordedObservations });
            evaluated.value1 = parent.value; evaluated.value2 = measurement.value;
            evaluated.rawInput = { value1: parent.rawInput, value2: measurement.rawInput };
            if (recordedObservations) evaluated.censoringLimits = [parent, measurement].map(row => row.censoring
                ? { qualifier: row.censoring, limit: row.censoringLimit, literalLoq: /^<LOQ$/i.test(row.rawInput || '') } : null);
            evaluated.duplicateOfPositionId = position.duplicateOfPositionId;
            duplicates.push(evaluated);
        } else {
            const reference = binding(position);
            if (!reference) continue;
            const snapshot = JSON.parse(reference.referenceSnapshot), calibration = ['ICV', 'CCV'].includes(position.kind);
            evaluated = evaluateControl({ id: position.id, measured: measurement.value, expected: snapshot.expected,
                referenceUse: position.kind === 'CRM' ? 'CRM' : 'LRM' }, nativeCheckPolicy(criteria, position));
            if (calibration) evaluated.criterion = 'CALIBRATION_RECOVERY';
            Object.assign(evaluated, { expected: snapshot.expected, measured: measurement.value, rawInput: { measured: measurement.rawInput },
                referenceSnapshot: snapshot, referenceMaterialId: reference.referenceMaterialId, referenceValueId: reference.referenceValueId,
                referenceUse: position.kind });
            controls.push(evaluated);
        }
        const calibration = ['ICV', 'CCV', 'CCB'].includes(position.kind);
        Object.assign(evaluated, { positionId: position.id, position: position.position, kind: position.kind,
            qcRule: criteria.qcRule, failAction: calibration && calibrationActions ? calibrationActions[position.kind]
                : values.failAction[position.kind] || values.failAction[position.kind === 'CCB' ? 'BLANK' : 'LRM'] });
        if (['FAIL', 'INVALID'].includes(evaluated.status) && evaluated.failAction === 'WARN') {
            warnings.push({ positionId: position.id, kind: position.kind, status: evaluated.status, criterion: evaluated.criterion });
            if (calibration && calibrationActions) { evaluated.observedStatus = evaluated.status; evaluated.status = 'WARN'; }
        }
    }
    const checks = [...blanks, ...duplicates, ...controls], failed = checks.filter(row => ['FAIL', 'INVALID'].includes(row.status) && row.failAction !== 'WARN').length;
    const incomplete = criteria.qcMode !== 'OFF' && (missingPositions.length > 0 || unboundPositions.length > 0);
    const verdict = criteria.qcMode === 'OFF' ? 'NOT_REQUIRED' : incomplete ? 'INCOMPLETE' : failed ? 'FAIL' : warnings.length ? 'WARN' : 'PASS';
    const status = { NOT_REQUIRED: 'QC_PASS', INCOMPLETE: 'QC_PENDING', FAIL: 'QC_FAIL', WARN: 'QC_WARN', PASS: 'QC_PASS' }[verdict];
    const evaluation = { blanks, duplicates, controls, qcRule: criteria.qcRule, policyVersion: criteria.policyVersion,
        result: verdict, overallStatus: verdict === 'FAIL' ? 'QC_FAIL' : verdict === 'INCOMPLETE' ? 'OPEN' : 'QC_PASS',
        summary: { totalQcSamples: checks.length, passed: checks.filter(row => row.status === 'PASS').length, failed, warnings,
            missingPositions, unboundPositions, mode: criteria.qcMode, notRequired: verdict === 'NOT_REQUIRED' } };
    const calibrationBrackets = criteria.calibrationVerification && criteria.qcMode !== 'OFF'
        ? require('./qcCalibrationBracketService').calibrationBrackets(batch, analyte.analysisCode, evidence.positions, checks) : [];
    return { verdict, status, evaluation, missingPositions, unboundPositions, calibrationBrackets, calibrationFailActionSource,
        positionIds: evidence.positions.map(row => row.id), measurementIds: evidence.measurements.map(row => row.id),
        criteriaSnapshot: analyte.criteriaSnapshot, mode: criteria.qcMode };
}

module.exports = { evaluateNativeEvidence, nativeCheckPolicy };
