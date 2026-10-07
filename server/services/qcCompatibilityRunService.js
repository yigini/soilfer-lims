const { randomUUID } = require('node:crypto');
const { hasPermission } = require('../config/roles');
const scopeGuard = require('../utils/scopeGuard');
const policyService = require('./policyService');
const { actorName } = require('./workflowStateRules');
const { aggregateBatchStatus } = require('../workflowContract');
const { getNumberFormat } = require('./numberFormatService');
const { normalizeQcNumbers, retainQcRawInput } = require('./qcNumberInputService');
const { parseDuplicateObservation } = require('../../shared/numberParse');
const { resolveQcPolicy } = require('./qcPolicyService');
const { countRequirements } = require('./qcRequirementService');
const { evaluateBatchQc, getMissingQcValueTypes, flagBatchResults } = require('./qcService');
const { linkReferences, retainReferences } = require('./referencePlacementService');
const { resolveBatchRunProfile } = require('./qcRunProfileService');
const { QC_RUN_INCLUDE, batchApiView, currentAnalyteEvidence } = require('./qcRunViewService');
const { snapshotEvidence } = require('./qcRunAuditService');
const failure = (statusCode, code, message, details = {}) => Object.assign(new Error(message), { statusCode, code, details });
const parsed = (value, fallback = null) => typeof value === 'string' ? JSON.parse(value) : value ?? fallback;

async function editableRun(tx, batchId, actor) {
    const batch = await tx.batch.findUnique({ where: { id: batchId }, include: QC_RUN_INCLUDE });
    if (!batch) throw failure(404, 'BATCH_NOT_FOUND', 'Batch not found.');
    const [actorLab, targetLab] = await Promise.all([policyService.resolveLab(actor.labId, tx), policyService.resolveLab(batch.labId, tx)]);
    scopeGuard.ensureScope({ ...actor, labId: actorLab?.id || actor.labId }, { ...batch, labId: targetLab?.id || batch.labId }, { labField: 'labId', altLabField: null });
    if (batch.status === 'CLOSED') throw failure(400, 'QC_BATCH_LOCKED', 'Batch is CLOSED and cannot be modified.');
    if (!batch.analytes.length || batch.analytes.some(row => row.provenance === 'NATIVE')) {
        throw failure(409, 'QC_COMPATIBILITY_RUN_REQUIRED', 'This entry requires a migrated or profile-only run.');
    }
    if (batch.status === 'QC_FAIL' || batch.analytes.some(row => currentAnalyteEvidence(batch, row.analysisCode).disposition)) {
        throw failure(409, 'QC_BATCH_LOCKED', 'Failed or dispositioned QC evidence is locked.');
    }
    // Never silently discard an invalid legacy history when creating its next
    // durable snapshot. The reviewed importer also refuses this condition.
    try { if (!Array.isArray(parsed(batch.history, []))) throw new Error('Not an array'); }
    catch { throw failure(409, 'BATCH_HISTORY_INVALID', 'Batch history needs repair before modification.'); }
    return batch;
}

async function createProfileRun(db, actor, input) {
    if (!hasPermission(actor, 'CHANGE_STATUS')) throw failure(403, 'QC_RUN_PERMISSION_REQUIRED', 'QC batch permission is required.');
    if (typeof input.analysis !== 'string' || !input.analysis.trim()) throw failure(400, 'QC_ANALYSIS_REQUIRED', 'Analysis type required.');
    const performedBy = actorName(actor);
    return db.$transaction(async tx => {
        const lab = await policyService.resolveLab(actor.labId, tx), labId = lab?.id || actor.labId;
        const profile = await resolveBatchRunProfile({ labId, analysis: input.analysis, instrument: input.instrument,
            maxCapacity: input.maxCapacity || input.capacity, profile: input.profile }, tx);
        const id = typeof input.id === 'string' && input.id.trim() ? input.id.trim() : `BATCH-${randomUUID()}`, now = new Date();
        await tx.batch.create({ data: { id, labId, analysis: input.analysis, instrument: input.instrument || 'Manual',
            maxCapacity: profile.capacity, profile: profile.profileKey, status: 'OPEN', createdBy: performedBy,
            createdAt: now, notes: input.notes || '' } });
        await tx.batchAnalyte.create({ data: { id: randomUUID(), batchId: id, labId, analysisCode: input.analysis,
            status: 'OPEN', provenance: 'PROFILE_ONLY', methodResolution: 'UNRESOLVED_PROFILE' } });
        await tx.batchEvent.create({ data: { id: randomUUID(), batchId: id, type: 'CREATED', by: performedBy, at: now,
            payload: JSON.stringify({ historyEntry: { status: 'OPEN', changedBy: performedBy, timestamp: now } }) } });
        await tx.auditLog.create({ data: { id: randomUUID(), entity: 'QC_BATCH', entityId: id, action: 'CREATE',
            details: `Batch created for ${input.analysis} (${profile.name}, max ${profile.capacity})`, performedBy, timestamp: now } });
        return { ...batchApiView(await tx.batch.findUnique({ where: { id }, include: QC_RUN_INCLUDE })), runProfile: profile };
    });
}

// The existing full-submission grammar remains usable. Each submission owns new
// PROFILE_ONLY QC positions and a new evaluation; old measurements, evaluations
// and the four deprecated Batch JSON columns are never rewritten.
async function writeCompatibilityMeasurements(db, batchId, actor, input = {}, { clear = false } = {}) {
    if (!hasPermission(actor, 'CHANGE_STATUS')) throw failure(403, 'QC_RUN_PERMISSION_REQUIRED', 'QC entry permission is required.');
    const performedBy = actorName(actor);
    return db.$transaction(async tx => {
        const batch = await editableRun(tx, batchId, actor), analysisCode = input.analysisCode || batch.analysis;
        const analyte = batch.analytes.find(row => row.analysisCode === analysisCode);
        if (!analyte) throw failure(400, 'QC_ANALYSIS_NOT_IN_RUN', 'The analysis is not a member of this run.');
        const contextBatch = { ...batchApiView(batch), analysis: analysisCode, qcResults: currentAnalyteEvidence(batch, analysisCode).qcResults };
        const numberFormat = await getNumberFormat(batch.labId, { db: tx }), runProfile = await resolveBatchRunProfile(contextBatch, tx);
        const source = input.qcResults || input, now = new Date();
        const payload = await linkReferences(tx, contextBatch, actor, normalizeQcNumbers(source, numberFormat), now);
        const policy = await resolveQcPolicy(contextBatch, tx, numberFormat);
        if (clear && ['blanks', 'duplicates', 'controls'].some(key => payload[key] != null && (!Array.isArray(payload[key]) || payload[key].length))) {
            throw failure(400, 'QC_VALUES_MISSING', 'A clear request must contain no observations.');
        }
        const requirements = countRequirements(policy.qcRule, policy.sampleCount, runProfile, payload, policy.qcMode);
        const supplied = ['BLANK', 'DUPLICATE', 'CONTROL'].filter((type, index) =>
            !clear && policy.qcMode === 'REQUIRED_BLOCKING' && (requirements[type].required > 0 || type === 'CONTROL' && requirements.LRM.required > 0) ||
            payload[['blanks', 'duplicates', 'controls'][index]] != null &&
            (!Array.isArray(payload[['blanks', 'duplicates', 'controls'][index]]) || payload[['blanks', 'duplicates', 'controls'][index]].length > 0));
        const missingTypes = getMissingQcValueTypes(payload, { qcSlots: supplied.map(type => ({ type })) }, numberFormat);
        if (missingTypes.length) throw failure(400, 'QC_VALUES_MISSING', 'Required QC values are missing or non-numeric.', { missingTypes });
        if (clear && ['QC_PASS', 'QC_WARN'].includes(analyte.status)) return reopenInTransaction(tx, batch, actor, input.reason, now);
        const evaluated = retainReferences(retainQcRawInput(evaluateBatchQc(payload, { runProfile, policy }), payload), payload);
        evaluated.policyVersion = policy.policyVersion; evaluated.policyValues = policy.policyValues;
        let positionNumber = Math.max(0, ...batch.positions.map(row => row.position));
        const positions = [], measurements = [], bindings = [], replacements = [], parentReadings = new Map(), previous = currentAnalyteEvidence(batch, analysisCode).evaluation;
        const reopen = batch.events.filter(row => row.type === 'REOPENED').sort((a, b) => new Date(b.at) - new Date(a.at))[0];
        const currentSample = batch.positions.filter(row => row.kind === 'SAMPLE' && (row.workItems || []).some(link => link.analysisCode === analysisCode));
        const observation = (positionId, field, entry, replicateNo) => {
            const raw = entry.rawInput[field], duplicate = field === 'value1' || field === 'value2';
            const parsedValue = duplicate ? parseDuplicateObservation(raw, numberFormat) : null;
            return { id: randomUUID(), batchId, positionId, analysisCode, replicateNo,
                value: parsedValue?.censored ? null : duplicate ? parsedValue.value : entry[field], rawInput: raw,
                censoring: parsedValue?.censored ? parsedValue.qualifier : null,
                censoringLimit: parsedValue?.censored ? parsedValue.literalLoq ? policy.duplicate.loq : parsedValue.value : null,
                enteredBy: performedBy, enteredAt: now };
        };
        for (const [collection, kind, fields] of [['blanks', 'BLANK', ['value']], ['duplicates', 'DUPLICATE', ['value1', 'value2']], ['controls', 'CONTROL', ['measured']]]) {
            for (const [index, entry] of (payload[collection] || []).entries()) {
                const id = randomUUID(), linked = collection === 'controls' && entry.referenceMaterialId;
                const parent = kind === 'DUPLICATE' && currentSample.length ? currentSample.find(row => row.id === entry.duplicateOfPositionId) : null;
                if (kind === 'DUPLICATE' && currentSample.length && !parent) throw failure(400, 'QC_DUPLICATE_PARENT_REQUIRED', 'Select the real sample position for the duplicate.');
                const position = { id, batchId, position: ++positionNumber, kind: linked ? entry.referenceUse : kind,
                    sampleId: parent?.sampleId || null, duplicateOfPositionId: parent?.id || null, provenance: 'PROFILE_ONLY',
                    legacySource: JSON.stringify({ collection, arrayIndex: index, entry }) };
                positions.push(position);
                evaluated[collection][index] = { ...evaluated[collection][index], id, positionId: id,
                    ...(parent && { duplicateOfPositionId: parent.id }) };
                if (parent) {
                    const next = observation(parent.id, 'value1', entry, 1), same = row => ['value', 'rawInput', 'censoring', 'censoringLimit'].every(key => row[key] === next[key]);
                    if (parentReadings.has(parent.id) && !same(parentReadings.get(parent.id))) {
                        throw failure(400, 'QC_DUPLICATE_PARENT_VALUE_CONFLICT', 'A physical sample has one parent reading in a submission.');
                    }
                    if (!parentReadings.has(parent.id)) {
                        // A reopened compatibility view hides its preceding round,
                        // but physical parent supersession still resolves all rows.
                        const old = batch.measurements.find(row => row.analysisCode === analysisCode && row.positionId === parent.id && row.replicateNo === 1 && !row.supersededById);
                        if (old && same(old)) parentReadings.set(parent.id, old);
                        else {
                            next.legacySource = JSON.stringify({ entryMode: 'LEGACY_RESUBMISSION', reopenEventId: reopen?.id || null });
                            if (old) { next.correctionReason = 'LEGACY_RESUBMISSION'; replacements.push({ previous: old, next }); }
                            measurements.push(next); parentReadings.set(parent.id, next);
                        }
                    }
                    measurements.push(observation(id, 'value2', entry, 1));
                } else fields.forEach((field, fieldIndex) => measurements.push(observation(id, field, entry, fieldIndex + 1)));
                if (linked) bindings.push({ id: randomUUID(), positionId: id, analysisCode, referenceMaterialId: entry.referenceMaterialId,
                    referenceValueId: entry.referenceValueId, referenceUse: entry.referenceUse,
                    referenceSnapshot: JSON.stringify(entry.referenceSnapshot), boundBy: performedBy, boundAt: now });
            }
        }
        const verdict = evaluated.overallStatus === 'OPEN' ? 'INCOMPLETE' : evaluated.overallStatus === 'QC_FAIL' ? 'FAIL'
            : evaluated.summary.warnings?.length ? 'WARN' : 'PASS';
        const reason = typeof input.reason === 'string' && input.reason.trim() ? input.reason.trim() : 'QC evaluation';
        await snapshotEvidence(tx, batch, actor, reason, now);
        for (const data of positions) await tx.batchPosition.create({ data });
        for (const data of bindings) await tx.batchPositionReference.create({ data });
        for (const { previous: old, next } of replacements) {
            const changed = await tx.qcMeasurement.updateMany({ where: { id: old.id, supersededById: null }, data: { supersededById: next.id } });
            if (changed.count !== 1) throw failure(409, 'QC_MEASUREMENT_CHANGED', 'The parent observation changed. Reload before retrying.');
        }
        for (const data of measurements) await tx.qcMeasurement.create({ data });
        const id = randomUUID(), positionIds = positions.map(row => row.id);
        const measurementIds = [...new Set([...measurements.map(row => row.id), ...[...parentReadings.values()].map(row => row.id)])];
        await tx.qcEvaluation.create({ data: { id, batchId, analysisCode, version: (previous?.version || 0) + 1,
            ruleId: policy.qcRule.id, ruleVersion: policy.qcRule.version, policyVersion: policy.policyVersion,
            verdict, evaluatedBy: performedBy, evaluatedAt: now, supersedesId: previous?.id || null,
            details: JSON.stringify({ entryMode: 'LEGACY_RESUBMISSION', actor: { id: actor.id || null, username: actor.username },
                reopenEventId: reopen?.id || null, evaluation: evaluated, positionIds, measurementIds }) } });
        analyte.status = verdict === 'INCOMPLETE' ? 'QC_PENDING' : verdict === 'WARN' ? 'QC_WARN' : verdict === 'FAIL' ? 'QC_FAIL' : 'QC_PASS';
        await tx.batchAnalyte.update({ where: { id: analyte.id }, data: { status: analyte.status } });
        const status = aggregateBatchStatus(batch.analytes, { startedAt: batch.startedAt });
        await tx.batch.update({ where: { id: batchId }, data: { status } });
        await tx.batchEvent.create({ data: { id: randomUUID(), batchId, type: 'QC_ENTERED', by: performedBy, at: now,
            payload: JSON.stringify({ analysisCode, evaluationId: id, measurementIds, historyEntry: { status, changedBy: performedBy, timestamp: now } }) } });
        await flagBatchResults(tx, batchId, evaluated.overallStatus, null, analysisCode);
        return { batch: batchApiView(await tx.batch.findUnique({ where: { id: batchId }, include: QC_RUN_INCLUDE })), evaluation: evaluated };
    });
}

async function reopenInTransaction(tx, batch, actor, reason, now) {
    if (!hasPermission(actor, 'APPROVE_RESULTS')) throw failure(403, 'QC_REOPEN_PERMISSION_REQUIRED', 'Reopening accepted QC requires APPROVE_RESULTS.');
    if (typeof reason !== 'string' || !reason.trim()) throw failure(400, 'REASON_REQUIRED', 'A reason is required to reopen accepted QC.');
    if (batch.status !== 'QC_PASS') throw failure(409, 'QC_BATCH_LOCKED', 'Only accepted compatibility QC can be reopened.');
    await snapshotEvidence(tx, batch, actor, reason.trim(), now);
    for (const analyte of batch.analytes) await tx.batchAnalyte.update({ where: { id: analyte.id }, data: { status: 'QC_PENDING' } });
    await tx.batch.update({ where: { id: batch.id }, data: { status: 'OPEN' } });
    await tx.batchEvent.create({ data: { id: randomUUID(), batchId: batch.id, type: 'REOPENED', by: actorName(actor), at: now,
        payload: JSON.stringify({ reason: reason.trim(), discardCurrentEvidence: true,
            previousEvaluationIds: batch.analytes.map(row => currentAnalyteEvidence(batch, row.analysisCode).evaluation?.id).filter(Boolean),
            historyEntry: { status: 'OPEN', changedBy: actorName(actor), timestamp: now } }) } });
    await flagBatchResults(tx, batch.id, 'OPEN');
    return { batch: batchApiView(await tx.batch.findUnique({ where: { id: batch.id }, include: QC_RUN_INCLUDE })), evaluation: null };
}
async function reopenCompatibilityRun(db, batchId, actor, reason) {
    return db.$transaction(async tx => reopenInTransaction(tx, await editableRun(tx, batchId, actor), actor, reason, new Date()));
}
module.exports = { createProfileRun, writeCompatibilityMeasurements, reopenCompatibilityRun };
