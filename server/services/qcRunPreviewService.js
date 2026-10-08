const { hasPermission } = require('../config/roles');
const { actorName } = require('./workflowStateRules');
const { readQcRun, currentAnalyteEvidence } = require('./qcRunViewService');
const { buildNativeMeasurementCandidate, prepareNativeObservationEntries } = require('./qcNativeCandidateService');
const { evaluateNativeEvidence, nativeCheckPolicy } = require('./qcNativeEvaluationService');
const failure = (statusCode, code, message) => Object.assign(new Error(message), { statusCode, code });

function positionView(batch, analyte, evaluated) {
    const criteria = JSON.parse(analyte.criteriaSnapshot), evidence = currentAnalyteEvidence(batch, analyte.analysisCode);
    const checks = [...evaluated.evaluation.blanks, ...evaluated.evaluation.duplicates, ...evaluated.evaluation.controls];
    const parents = new Set(evidence.positions.filter(row => row.kind === 'DUPLICATE').map(row => row.duplicateOfPositionId));
    const limitFields = ['maxAllowed', 'maxRpd', 'absMax', 'absMaxBelow5LOQ', 'nearLoqMultiplier', 'loq',
        'minRecovery', 'maxRecovery', 'crmAbsWindow', 'lrmWindowPct', 'mode', 'crmMode', 'lrmMode'];
    return evidence.positions.filter(row => row.kind !== 'CAL_STD' && (row.kind !== 'SAMPLE' || parents.has(row.id))).map(position => {
        const check = checks.find(row => row.positionId === position.id);
        const observation = evidence.measurements.find(row => row.positionId === position.id && row.replicateNo === 1);
        const binding = position.references?.find(row => row.analysisCode === analyte.analysisCode && !row.supersededById && row.serviceStatus !== 'NOT_SERVED');
        const reference = binding?.referenceSnapshot ? JSON.parse(binding.referenceSnapshot) : null;
        const policy = nativeCheckPolicy(criteria, position);
        // The preview displays the frozen parameters and any more specific
        // limits returned by the same check that performs real evaluation.
        const limits = Object.fromEntries(limitFields.filter(key => (check?.[key] ?? policy[key]) !== undefined)
            .map(key => [key, check?.[key] ?? policy[key]]));
        return { positionId: position.id, position: position.position, kind: position.kind,
            duplicateOfPositionId: position.duplicateOfPositionId, referenceSnapshot: reference,
            expected: reference?.expected ?? check?.expected ?? null, limits,
            measured: observation?.value ?? null, rawInput: observation?.rawInput ?? null,
            status: check?.status ?? null, criterion: check?.criterion ?? policy.mode ?? null,
            failAction: check?.failAction ?? null, details: check ?? null };
    });
}

async function previewQcRun(db, batchId, actor, entries) {
    if (!hasPermission(actor, 'CHANGE_STATUS')) throw failure(403, 'QC_RUN_PERMISSION_REQUIRED', 'QC entry permission is required.');
    if (!Array.isArray(entries) || entries.some(entry => !entry || typeof entry !== 'object' || Array.isArray(entry) ||
        Object.keys(entry).some(key => !['analysisCode', 'positionId', 'rawInput'].includes(key)) ||
        typeof entry.analysisCode !== 'string' || typeof entry.positionId !== 'string' || !Object.hasOwn(entry, 'rawInput'))) {
        throw failure(400, 'QC_PREVIEW_INPUT_INVALID', 'Submit candidate observations only.');
    }
    return db.$transaction(async tx => {
        const batch = await readQcRun(tx, batchId, actor);
        if (!batch.startedAt || !batch.analytes.length || batch.analytes.some(row => row.provenance !== 'NATIVE' || !row.criteriaSnapshot)) {
            throw failure(409, 'QC_PREVIEW_UNAVAILABLE', 'Preview requires a started native run with frozen criteria.');
        }
        for (const analyte of batch.analytes) {
            try {
                const criteria = JSON.parse(analyte.criteriaSnapshot);
                if (!criteria?.qcRule?.resolved || !criteria?.policySnapshot?.values || !criteria?.methodContext || !criteria?.requiredPositions) throw new Error('Frozen criteria incomplete');
            } catch {
                throw failure(409, 'QC_PREVIEW_UNAVAILABLE', 'The frozen criteria are unavailable for preview.');
            }
        }
        const groups = new Map();
        for (const entry of entries) {
            if (!batch.analytes.some(row => row.analysisCode === entry.analysisCode)) {
                throw failure(400, 'QC_ANALYSIS_NOT_IN_RUN', 'The analysis is not a member of this run.');
            }
            const group = groups.get(entry.analysisCode) || [];
            group.push(entry); groups.set(entry.analysisCode, group);
        }
        const observations = [], replacements = [], now = new Date();
        for (const analyte of batch.analytes) {
            const prepared = prepareNativeObservationEntries(batch, analyte.analysisCode, groups.get(analyte.analysisCode) || [],
                { preview: true, performedBy: actorName(actor), now });
            observations.push(...prepared.observations); replacements.push(...prepared.replacements);
        }
        const candidate = buildNativeMeasurementCandidate(batch, { observations, replacements });
        const analytes = batch.analytes.map(analyte => {
            const evaluated = evaluateNativeEvidence(candidate, analyte);
            return { analysisCode: analyte.analysisCode, verdict: evaluated.verdict, qcRule: evaluated.evaluation.qcRule,
                policyVersion: evaluated.evaluation.policyVersion, preview: true,
                positions: positionView(candidate, analyte, evaluated), evaluation: evaluated.evaluation };
        });
        return { batchId, preview: true, analytes };
    });
}

module.exports = { previewQcRun };
