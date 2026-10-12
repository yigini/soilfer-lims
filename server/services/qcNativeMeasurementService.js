const { randomUUID } = require('node:crypto');
const { auditRunCommand } = require('./qcRunAuditService');
const { hasPermission } = require('../config/roles');
const scopeGuard = require('../utils/scopeGuard');
const policyService = require('./policyService');
const { actorName, inTransaction } = require('./workflowStateRules');
const { aggregateBatchStatus } = require('../workflowContract');
const { parseNumber } = require('../../shared/numberParse');
const { QC_RUN_INCLUDE, batchApiView, currentAnalyteEvidence } = require('./qcRunViewService');
const { evaluateNativeEvidence } = require('./qcNativeEvaluationService');
const { buildNativeMeasurementCandidate, prepareNativeObservationEntries } = require('./qcNativeCandidateService');
const { preparePositionBindings, applyPositionBindings } = require('./qcRunReferenceService');
const { flagBatchResults } = require('./qcService');
const { getNumberFormat } = require('./numberFormatService');
const { MODE, EVENT, authorizeReviewedCorrection, reviewedCorrectionPayload, nativeCriteria } = require('./qcReviewedCorrectionService');
const failure = (statusCode, code, message, details = {}) => Object.assign(new Error(message), { statusCode, code, details });

// This transaction is the native arm of the shared write path. The compatibility
// arm appends isolated rounds; native observations require explicit corrections.
async function writeNativeMeasurements(db, batchId, actor, input = {}, { correction = false, explicit = false, entryOnly = false, importReceiptId = null } = {}) {
    if (!hasPermission(actor, 'CHANGE_STATUS')) throw failure(403, 'QC_RUN_PERMISSION_REQUIRED', 'QC entry permission is required.');
    const performedBy = actorName(actor), reason = typeof input.reason === 'string' ? input.reason.trim() : '';
    return inTransaction(db, async tx => {
        const batch = await tx.batch.findUnique({ where: { id: batchId }, include: QC_RUN_INCLUDE });
        if (!batch) throw failure(404, 'BATCH_NOT_FOUND', 'Batch not found.');
        const [actorLab, targetLab] = await Promise.all([policyService.resolveLab(actor.labId, tx), policyService.resolveLab(batch.labId, tx)]);
        scopeGuard.ensureScope({ ...actor, labId: actorLab?.id || actor.labId }, { ...batch, labId: targetLab?.id || batch.labId }, { labField: 'labId', altLabField: null });
        if (!batch.analytes.length || batch.analytes.some(row => row.provenance !== 'NATIVE')) throw failure(409, 'QC_NATIVE_RUN_REQUIRED', 'This entry requires a native run.');
        if (!batch.startedAt) throw failure(409, 'QC_RUN_NOT_STARTED', 'Start the run before entering or evaluating QC.');
        if (batch.status === 'CLOSED') throw failure(400, 'QC_BATCH_LOCKED', 'Closed QC evidence is locked.');
        if (entryOnly && (entryOnly !== true || correction !== false || explicit !== false ||
            !input || typeof input !== 'object' || Array.isArray(input) ||
            Object.keys(input).some(key => !['analysisCode', 'measurements'].includes(key)) ||
            !Array.isArray(input.measurements) || !input.measurements.length || typeof importReceiptId !== 'string' || !importReceiptId))
            throw failure(400, 'QC_IMPORT_ENTRY_ONLY_INVALID', 'Import entry accepts new measurements only.');
        if (correction && !reason) throw failure(400, 'QC_CORRECTION_REASON_REQUIRED', 'A correction reason is required.');
        const analysisCode = input.analysisCode || batch.analysis, selected = batch.analytes.find(row => row.analysisCode === analysisCode);
        if (!selected) throw failure(400, 'QC_ANALYSIS_NOT_IN_RUN', 'The analysis is not a member of this run.');
        if (input.mode === MODE && !correction) throw failure(400, 'QC_REVIEWED_ROUTE_REQUIRED', 'Use the explicit corrections route.');
        const reviewed = correction ? await authorizeReviewedCorrection(tx, batch, actor, input) : null;
        const criteriaSource = reviewed ? nativeCriteria(selected, currentAnalyteEvidence(batch, analysisCode)) : null;
        const locked = row => reviewed?.analysisCode !== row.analysisCode && (['QC_FAIL', 'REJECTED', 'REPEAT_ORDERED', 'CLOSED'].includes(row.status) ||
            Boolean(currentAnalyteEvidence(batch, row.analysisCode).disposition));
        if (locked(selected)) throw failure(409, 'QC_BATCH_LOCKED', 'Failed or dispositioned analyte evidence is locked; use batch disposition.');
        // #200 pin6095469488: the importer uses this same owner to record new
        // observations, then a user explicitly evaluates through the old route.
        if (entryOnly) {
            const invalid = () => { throw failure(400, 'QC_IMPORT_ENTRY_ONLY_INVALID', 'Import entry accepts new measurements only.'); };
            const receipt = await tx.instrumentImportReceipt.findUnique({ where: { id: importReceiptId } });
            let snapshot;
            try { snapshot = JSON.parse(receipt?.mappingSnapshot); } catch { /* Refuse an unavailable receipt. */ }
            if (!receipt || receipt.labId !== targetLab?.id || receipt.instrumentId !== batch.instrumentId ||
                receipt.importedBy !== performedBy || snapshot?.batchId !== batch.id) invalid();
            if (!['IN_RUN', 'QC_PENDING'].includes(selected.status) || currentAnalyteEvidence(batch, analysisCode).evaluation)
                throw failure(409, 'QC_IMPORT_ANALYTE_EVALUATED', 'Evaluated or dispositioned QC cannot receive imported observations.');
        }
        const criteria = JSON.parse(selected.criteriaSnapshot), now = new Date();
        if (input.expectedValues !== undefined && (!input.expectedValues || typeof input.expectedValues !== 'object' || Array.isArray(input.expectedValues))) {
            throw failure(400, 'REFERENCE_VALUE_MISMATCH', 'Submit expected values by actual position id.');
        }
        const entries = input[correction ? 'corrections' : 'measurements'] ?? [];
        const numberFormat = reviewed ? await getNumberFormat(batch.labId, { db: tx }) : null;
        const { observations, replacements } = prepareNativeObservationEntries(batch, analysisCode, entries, { correction, performedBy, now, reason, numberFormat });
        const references = input.references ?? [];
        if (!Array.isArray(references) || new Set(references.map(row => row?.positionId)).size !== references.length) throw failure(400, 'REFERENCE_VALUE_MISMATCH', 'Submit distinct reference placements.');
        const plans = [], affected = new Set([analysisCode]);
        if (explicit && input.analysisCode === undefined) batch.analytes.filter(row => !locked(row) && JSON.parse(row.criteriaSnapshot).qcMode === 'OFF').forEach(row => affected.add(row.analysisCode));
        for (const entry of references) {
            const position = batch.positions.find(row => row.id === entry?.positionId && row.historicalSnapshotSeq == null);
            if (!position) throw failure(400, 'REFERENCE_VALUE_MISMATCH', 'Reference position is not in this run.');
            const served = batch.analytes.filter(row => (position.references || []).some(reference => reference.analysisCode === row.analysisCode && !reference.supersededById) ||
                currentAnalyteEvidence(batch, row.analysisCode).positions.some(item => item.id === position.id) ||
                position.kind === 'CRM' && JSON.parse(row.criteriaSnapshot).qcRule.resolved.crmEveryNBatches.value > 0);
            const optionalAnalysisCodes = served.filter(row => !Object.values(JSON.parse(row.criteriaSnapshot).requiredPositions).flat().includes(position.id)).map(row => row.analysisCode);
            const referenceValueIds = entry.referenceValueId ? { [analysisCode]: entry.referenceValueId } : {};
            const plan = await preparePositionBindings(tx, { batch, position, analyses: served, actor,
                referenceMaterialId: entry.referenceMaterialId, referenceValueIds, reason: correction ? reason : null, optionalAnalysisCodes }, now);
            plans.push(plan); plan.bindings.forEach(row => affected.add(row.analysisCode));
        }
        if ([...affected].some(code => locked(batch.analytes.find(row => row.analysisCode === code)))) {
            throw failure(409, 'QC_BATCH_LOCKED', 'A shared reference change would alter locked analyte evidence.');
        }
        if (correction && [...affected].some(code => {
            const row = batch.analytes.find(analyte => analyte.analysisCode === code);
            return ['QC_PASS', 'QC_WARN'].includes(row.status) && JSON.parse(row.criteriaSnapshot).qcMode !== 'ADVISORY';
        })) {
            throw failure(409, 'QC_BATCH_LOCKED', 'Reopen accepted QC with manager authority and a reason before correcting it.');
        }
        // Evaluate an in-memory candidate before the first mutation, including
        // every analyte sharing a rebound physical lot. Any refusal writes zero.
        const candidate = buildNativeMeasurementCandidate(batch, { observations, replacements, plans });
        for (const [positionId, source] of Object.entries(input.expectedValues || {})) {
            const position = candidate.positions.find(row => row.id === positionId), reference = position?.references.find(row => row.analysisCode === analysisCode && !row.supersededById);
            const expected = reference?.referenceSnapshot && JSON.parse(reference.referenceSnapshot).expected, provided = parseNumber(source, criteria.numberFormat);
            if (!provided.valid || provided.qualifier || !Number.isFinite(expected) || Math.abs(provided.value - expected) > Number.EPSILON * Math.max(1, Math.abs(expected), Math.abs(provided.value)) * 4) {
                throw failure(409, 'REFERENCE_VALUE_MISMATCH', 'Expected value must match the immutable reference placement.', { positionId });
            }
        }
        for (const row of observations) if (!currentAnalyteEvidence(candidate, row.analysisCode).positions.some(position => position.id === row.positionId)) {
            throw failure(400, 'QC_POSITION_NOT_IN_ANALYSIS', 'The rebound reference position does not serve this analysis.', { positionId: row.positionId });
        }
        const evaluations = [];
        for (const code of entryOnly ? [] : affected) {
            const analyte = batch.analytes.find(row => row.analysisCode === code), previousEvidence = currentAnalyteEvidence(batch, code), previous = previousEvidence.evaluation;
            const evaluated = evaluateNativeEvidence(candidate, analyte, { recordedObservations: Boolean(reviewed) }), requested = explicit && (code === analysisCode || input.analysisCode === undefined && evaluated.mode === 'OFF');
            if (!previous && !observations.some(row => row.analysisCode === code) && plans.some(plan =>
                plan.bindings.some(row => row.analysisCode === code && row.serviceStatus === 'NOT_SERVED'))) continue;
            const changed = observations.some(row => row.analysisCode === code) || plans.some(plan => plan.replacements.some(row => row.previous.analysisCode === code) ||
                plan.bindings.some(row => row.analysisCode === code && !batch.positions.some(position => (position.references || []).some(old => old.id === row.id))));
            const shouldEvaluate = requested || correction && previous || evaluated.mode !== 'OFF' && evaluated.missingPositions.length === 0;
            if (!shouldEvaluate || previous && !changed && !(requested && previousEvidence.result === null)) continue;
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
        for (const row of batch.analytes.filter(analyte => analyte.status === 'IN_RUN' && observations.some(observation => observation.analysisCode === analyte.analysisCode) &&
            !evaluations.some(evaluation => evaluation.analyte.analysisCode === analyte.analysisCode))) {
            await tx.batchAnalyte.update({ where: { id: row.id }, data: { status: 'QC_PENDING' } }); row.status = 'QC_PENDING';
        }
        let reviewedEvaluationId = null;
        for (const { analyte, previous, evaluated } of evaluations) {
            const id = randomUUID();
            if (reviewed && analyte.analysisCode === analysisCode) reviewedEvaluationId = id;
            const storedEvaluation = await tx.qcEvaluation.create({ data: { id, batchId, analysisCode: analyte.analysisCode, version: (previous?.version || 0) + 1,
                ruleId: analyte.qcRuleId, ruleVersion: analyte.qcRuleVersion, policyVersion: analyte.policyVersion,
                verdict: evaluated.verdict, evaluatedBy: performedBy, evaluatedAt: now, supersedesId: previous?.id || null,
                details: JSON.stringify({ ...evaluated, entryMode: correction ? 'CORRECTION' : 'NATIVE_ENTRY', correctionReason: correction ? reason : null,
                    ...(reviewed && { correctionMode: MODE, sourceReference: reviewed.sourceReference, criteriaSource }) }) } });
            await require('./nonconformityQcService').raiseCrmFailures(tx, actor, storedEvaluation);
            await tx.batchAnalyte.update({ where: { id: analyte.id }, data: { status: evaluated.status } });
            analyte.status = evaluated.status;
            if (['QC_FAIL', 'QC_PASS', 'QC_WARN'].includes(evaluated.status)) {
                await flagBatchResults(tx, batchId, evaluated.status === 'QC_FAIL' ? 'QC_FAIL' : 'QC_PASS', null, analyte.analysisCode);
            }
        }
        if (observations.length || plans.length || evaluations.length) {
            await tx.batch.update({ where: { id: batchId }, data: { status: aggregateBatchStatus(batch.analytes, { startedAt: batch.startedAt }) } });
            await tx.batchEvent.create({ data: { id: randomUUID(), batchId, type: reviewed ? EVENT : correction ? 'QC_CORRECTED' : 'QC_ENTERED', by: performedBy, at: now,
                payload: JSON.stringify(reviewed ? reviewedCorrectionPayload(reviewed, replacements, reviewedEvaluationId, criteriaSource)
                    : { analysisCodes: [...affected], measurementIds: observations.map(row => row.id), reason: correction ? reason : null,
                        evaluations: evaluations.map(row => ({ analysisCode: row.analyte.analysisCode, result: row.evaluated.verdict })),
                        ...(entryOnly && { entryMode: 'INSTRUMENT_IMPORT', importReceiptId }) }) } });
        }
        return batchApiView(await tx.batch.findUnique({ where: { id: batchId }, include: QC_RUN_INCLUDE }));
    });
}

module.exports = { writeNativeMeasurements: auditRunCommand(writeNativeMeasurements, (input = {}, options = {}) =>
    options.correction ? 'MEASUREMENT_CORRECTION' : (input.measurements?.length || input.references?.length) ? 'MEASUREMENT_WRITE' : 'EVALUATION') };
