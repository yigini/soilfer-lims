const { randomUUID } = require('node:crypto');
const { hasPermission } = require('../config/roles');
const scopeGuard = require('../utils/scopeGuard');
const policyService = require('./policyService');
const { actorName } = require('./workflowStateRules');
const { aggregateBatchStatus } = require('../workflowContract');
const { parseNumber, parseDuplicateObservation } = require('../../shared/numberParse');
const { QC_RUN_INCLUDE, batchApiView, currentAnalyteEvidence } = require('./qcRunViewService');
const { evaluateNativeEvidence } = require('./qcNativeEvaluationService');
const { preparePositionBindings, applyPositionBindings } = require('./qcRunReferenceService');
const { flagBatchResults } = require('./qcService');
const failure = (statusCode, code, message, details = {}) => Object.assign(new Error(message), { statusCode, code, details });

function observation(entry, position, criteria, enteredBy, enteredAt) {
    if (!entry || typeof entry !== 'object' || (entry.replicateNo ?? 1) !== 1) throw failure(400, 'QC_VALUES_MISSING', 'A native position has one observation.', { positionId: position.id });
    const source = Object.prototype.hasOwnProperty.call(entry, 'rawInput') ? entry.rawInput : entry.value;
    const duplicate = ['SAMPLE', 'DUPLICATE'].includes(position.kind);
    const parsed = duplicate ? parseDuplicateObservation(source, criteria.numberFormat) : parseNumber(source, criteria.numberFormat);
    if (!parsed.valid || !duplicate && parsed.qualifier) throw failure(400, parsed.code === 'AMBIGUOUS_NUMBER' ? parsed.code : 'QC_VALUES_MISSING',
        'A valid QC observation is required.', { positionIds: [position.id] });
    return { id: randomUUID(), positionId: position.id, replicateNo: 1, value: parsed.censored ? null : parsed.value,
        rawInput: parsed.rawInput, censoring: parsed.censored ? parsed.qualifier : null,
        censoringLimit: parsed.censored ? parsed.literalLoq ? criteria.methodContext.loq : parsed.value : null, enteredBy, enteredAt };
}

// This transaction is the native arm of the shared write path. The compatibility
// arm appends isolated rounds; native observations require explicit corrections.
async function writeNativeMeasurements(db, batchId, actor, input = {}, { correction = false, explicit = false } = {}) {
    if (!hasPermission(actor, 'CHANGE_STATUS')) throw failure(403, 'QC_RUN_PERMISSION_REQUIRED', 'QC entry permission is required.');
    const performedBy = actorName(actor), reason = typeof input.reason === 'string' ? input.reason.trim() : '';
    return db.$transaction(async tx => {
        const batch = await tx.batch.findUnique({ where: { id: batchId }, include: QC_RUN_INCLUDE });
        if (!batch) throw failure(404, 'BATCH_NOT_FOUND', 'Batch not found.');
        const [actorLab, targetLab] = await Promise.all([policyService.resolveLab(actor.labId, tx), policyService.resolveLab(batch.labId, tx)]);
        scopeGuard.ensureScope({ ...actor, labId: actorLab?.id || actor.labId }, { ...batch, labId: targetLab?.id || batch.labId }, { labField: 'labId', altLabField: null });
        if (!batch.analytes.length || batch.analytes.some(row => row.provenance !== 'NATIVE')) throw failure(409, 'QC_NATIVE_RUN_REQUIRED', 'This entry requires a native run.');
        if (!batch.startedAt) throw failure(409, 'QC_RUN_NOT_STARTED', 'Start the run before entering or evaluating QC.');
        if (batch.status === 'CLOSED') throw failure(400, 'QC_BATCH_LOCKED', 'Closed QC evidence is locked.');
        if (batch.status === 'QC_FAIL' || batch.analytes.some(row => currentAnalyteEvidence(batch, row.analysisCode).disposition)) {
            throw failure(409, 'QC_BATCH_LOCKED', 'Failed or dispositioned evidence is locked; use batch disposition.');
        }
        if (correction && !reason) throw failure(400, 'QC_CORRECTION_REASON_REQUIRED', 'A correction reason is required.');
        const analysisCode = input.analysisCode || batch.analysis, selected = batch.analytes.find(row => row.analysisCode === analysisCode);
        if (!selected) throw failure(400, 'QC_ANALYSIS_NOT_IN_RUN', 'The analysis is not a member of this run.');
        const criteria = JSON.parse(selected.criteriaSnapshot), now = new Date();
        const entries = input[correction ? 'corrections' : 'measurements'] ?? [];
        if (!Array.isArray(entries) || new Set(entries.map(row => row?.positionId)).size !== entries.length) {
            throw failure(400, 'QC_VALUES_MISSING', 'Submit distinct position observations.');
        }
        const evidence = currentAnalyteEvidence(batch, analysisCode), replacements = [], observations = [];
        for (const entry of entries) {
            const position = evidence.positions.find(row => row.id === entry?.positionId);
            if (!position || position.kind === 'CAL_STD') throw failure(400, 'QC_POSITION_NOT_IN_ANALYSIS', 'The position does not serve this analysis.', { positionId: entry?.positionId });
            const previous = evidence.measurements.find(row => row.positionId === position.id && row.replicateNo === 1);
            if (previous && !correction) throw failure(400, 'QC_CORRECTION_REASON_REQUIRED', 'A measured position can only be changed by a reasoned correction.', { positionId: position.id });
            if (correction && !previous) throw failure(404, 'QC_MEASUREMENT_NOT_FOUND', 'There is no observation to correct.', { positionId: position.id });
            const next = { ...observation(entry, position, criteria, performedBy, now), batchId, analysisCode, correctionReason: correction ? reason : null };
            observations.push(next);
            if (previous) replacements.push({ previous, next });
        }
        const references = input.references ?? [];
        if (!Array.isArray(references) || new Set(references.map(row => row?.positionId)).size !== references.length) throw failure(400, 'REFERENCE_VALUE_MISMATCH', 'Submit distinct reference placements.');
        const plans = [], affected = new Set([analysisCode]);
        for (const entry of references) {
            const position = batch.positions.find(row => row.id === entry?.positionId && row.historicalSnapshotSeq == null);
            if (!position) throw failure(400, 'REFERENCE_VALUE_MISMATCH', 'Reference position is not in this run.');
            const served = batch.analytes.filter(row => currentAnalyteEvidence(batch, row.analysisCode).positions.some(item => item.id === position.id) ||
                position.kind === 'CRM' && JSON.parse(row.criteriaSnapshot).qcRule.resolved.crmEveryNBatches.value > 0);
            const optionalAnalysisCodes = position.kind === 'CRM' ? served.filter(row => !JSON.parse(row.criteriaSnapshot).counts.crm).map(row => row.analysisCode) : [];
            const referenceValueIds = entry.referenceValueId ? { [analysisCode]: entry.referenceValueId } : {};
            const plan = await preparePositionBindings(tx, { batch, position, analyses: served, actor,
                referenceMaterialId: entry.referenceMaterialId, referenceValueIds, reason: correction ? reason : null, optionalAnalysisCodes }, now);
            plans.push(plan); plan.bindings.forEach(row => affected.add(row.analysisCode));
        }
        if (correction && [...affected].some(code => {
            const row = batch.analytes.find(analyte => analyte.analysisCode === code);
            return ['QC_PASS', 'QC_WARN'].includes(row.status) && JSON.parse(row.criteriaSnapshot).qcMode !== 'ADVISORY';
        })) {
            throw failure(409, 'QC_BATCH_LOCKED', 'Reopen accepted QC with manager authority and a reason before correcting it.');
        }
        // Evaluate an in-memory candidate before the first mutation, including
        // every analyte sharing a rebound physical lot. Any refusal writes zero.
        const candidate = { ...batch, measurements: [...batch.measurements.filter(row => !replacements.some(change => change.previous.id === row.id)), ...observations],
            positions: batch.positions.map(position => ({ ...position, references: [...(position.references || [])] })) };
        for (const plan of plans) for (const binding of plan.bindings) {
            const position = candidate.positions.find(row => row.id === binding.positionId);
            position.references = position.references.filter(row => row.analysisCode !== binding.analysisCode).concat(binding);
        }
        const evaluations = [];
        for (const code of affected) {
            const analyte = batch.analytes.find(row => row.analysisCode === code), previous = currentAnalyteEvidence(batch, code).evaluation;
            const evaluated = evaluateNativeEvidence(candidate, analyte), requested = explicit && code === analysisCode;
            if (!previous && !observations.some(row => row.analysisCode === code) && plans.some(plan =>
                plan.bindings.some(row => row.analysisCode === code && row.serviceStatus === 'NOT_SERVED'))) continue;
            const changed = observations.some(row => row.analysisCode === code) || plans.some(plan => plan.replacements.some(row => row.previous.analysisCode === code) ||
                plan.bindings.some(row => row.analysisCode === code && !batch.positions.some(position => (position.references || []).some(old => old.id === row.id))));
            const shouldEvaluate = requested || correction && previous || evaluated.mode !== 'OFF' && evaluated.missingPositions.length === 0;
            if (!shouldEvaluate || previous && !changed) continue;
            if (evaluated.mode !== 'ADVISORY' && evaluated.mode !== 'OFF') {
                if (evaluated.missingPositions.length) throw failure(400, 'QC_VALUES_MISSING', 'Required QC values are missing.', { positionIds: evaluated.missingPositions });
                if (evaluated.unboundPositions.length) throw failure(400, 'QC_REFERENCE_UNBOUND', 'Required references are unbound.', { positionIds: evaluated.unboundPositions });
            }
            evaluations.push({ analyte, previous, evaluated });
        }
        for (const plan of plans) await applyPositionBindings(tx, plan);
        for (const { previous, next } of replacements) {
            const changed = await tx.qcMeasurement.updateMany({ where: { id: previous.id, supersededById: null }, data: { supersededById: next.id } });
            if (changed.count !== 1) throw failure(409, 'QC_MEASUREMENT_CHANGED', 'The observation changed. Reload before retrying.');
        }
        for (const data of observations) await tx.qcMeasurement.create({ data });
        for (const { analyte, previous, evaluated } of evaluations) {
            const id = randomUUID();
            await tx.qcEvaluation.create({ data: { id, batchId, analysisCode: analyte.analysisCode, version: (previous?.version || 0) + 1,
                ruleId: analyte.qcRuleId, ruleVersion: analyte.qcRuleVersion, policyVersion: analyte.policyVersion,
                verdict: evaluated.verdict, evaluatedBy: performedBy, evaluatedAt: now, supersedesId: previous?.id || null,
                details: JSON.stringify({ ...evaluated, entryMode: correction ? 'CORRECTION' : 'NATIVE_ENTRY', correctionReason: correction ? reason : null }) } });
            await tx.batchAnalyte.update({ where: { id: analyte.id }, data: { status: evaluated.status } });
            analyte.status = evaluated.status;
            if (['QC_FAIL', 'QC_PASS', 'QC_WARN'].includes(evaluated.status)) {
                await flagBatchResults(tx, batchId, evaluated.status === 'QC_FAIL' ? 'QC_FAIL' : 'QC_PASS', null, analyte.analysisCode);
            }
        }
        if (observations.length || plans.length || evaluations.length) {
            await tx.batch.update({ where: { id: batchId }, data: { status: aggregateBatchStatus(batch.analytes, { startedAt: batch.startedAt }) } });
            await tx.batchEvent.create({ data: { id: randomUUID(), batchId, type: correction ? 'QC_CORRECTED' : 'QC_ENTERED', by: performedBy, at: now,
                payload: JSON.stringify({ analysisCodes: [...affected], measurementIds: observations.map(row => row.id), reason: correction ? reason : null,
                    evaluations: evaluations.map(row => ({ analysisCode: row.analyte.analysisCode, result: row.evaluated.verdict })) }) } });
        }
        return batchApiView(await tx.batch.findUnique({ where: { id: batchId }, include: QC_RUN_INCLUDE }));
    });
}

module.exports = { writeNativeMeasurements };
