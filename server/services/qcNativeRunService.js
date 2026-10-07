const { randomUUID } = require('node:crypto');
const { hasPermission } = require('../config/roles');
const scopeGuard = require('../utils/scopeGuard');
const policyService = require('./policyService');
const { actorName } = require('./workflowStateRules');
const { aggregateBatchStatus } = require('../workflowContract');
const { QC_RUN_INCLUDE, batchApiView } = require('./qcRunViewService');
const { resolveSequenceCriteria, planRunSequence } = require('./batchSequenceService');
const { validateRunSequence } = require('./qcRunSequenceValidation');
const { prepareBuildBindings, applyPositionBindings } = require('./qcRunReferenceService');
const { retainBoundPositions, replaceUnmeasuredPositions } = require('./qcRunRebuildService');
const error = (statusCode, code, message, details = {}) => Object.assign(new Error(message), { statusCode, code, details });

async function scope(db, actor, entity) {
    const [actorLab, targetLab] = await Promise.all([policyService.resolveLab(actor.labId, db), policyService.resolveLab(entity.labId, db)]);
    scopeGuard.ensureScope({ ...actor, labId: actorLab?.id || actor.labId }, { ...entity, labId: targetLab?.id || entity.labId }, { labField: 'labId', altLabField: null });
}
function permission(actor) {
    if (!hasPermission(actor, 'CHANGE_STATUS')) throw error(403, 'QC_RUN_PERMISSION_REQUIRED', 'QC run permission is required.');
    return actorName(actor);
}
async function instrumentFor(db, batch, id, actor) {
    if (id == null) return null;
    if (typeof id !== 'string' || !id) throw error(422, 'QC_INSTRUMENT_INVALID', 'Select an active instrument in the run laboratory.');
    const instrument = await db.equipmentAsset.findUnique({ where: { id } });
    if (!instrument || instrument.status !== 'IN_SERVICE') throw error(422, 'QC_INSTRUMENT_INVALID', 'Select an active instrument in the run laboratory.');
    try { await scope(db, actor, instrument); }
    catch { throw error(422, 'QC_INSTRUMENT_INVALID', 'Select an active instrument in the run laboratory.'); }
    const [lab, instrumentLab] = await Promise.all([policyService.resolveLab(batch.labId, db), policyService.resolveLab(instrument.labId, db)]);
    if (!lab || lab.id !== instrumentLab?.id) throw error(422, 'QC_INSTRUMENT_INVALID', 'Select an active instrument in the run laboratory.');
    return instrument;
}
async function nextOrdinal(db, labId, analysisCode, methodologyId) {
    const lab = await policyService.resolveLab(labId, db);
    const prior = await db.batchAnalyte.count({ where: { labId: { in: [...new Set([lab?.id, lab?.code, labId].filter(Boolean))] },
        analysisCode, methodologyId, provenance: 'NATIVE', crmOrdinal: { not: null }, batch: { startedAt: { not: null } } } });
    return prior + 1;
}
async function transaction(db, execute) {
    try { return typeof db.$transaction === 'function' ? await db.$transaction(execute) : await execute(db); }
    catch (cause) {
        if (['P2002', 'P2034', 'P1008', 'SQLITE_BUSY', 'SQLITE_LOCKED'].includes(cause.code) || /database is (?:locked|busy)/i.test(cause.message)) {
            throw error(409, 'QC_SEQUENCE_STALE', 'The run or ordinal changed. Reload before retrying.');
        }
        throw cause;
    }
}

async function buildNativeRun(db, actor, input, { existingBatchId = null } = {}) {
    const performedBy = permission(actor);
    if (!Array.isArray(input.workItemIds) || !input.workItemIds.length || input.workItemIds.some(id => typeof id !== 'string' || !id) ||
        new Set(input.workItemIds).size !== input.workItemIds.length) throw error(400, 'QC_WORK_ITEMS_REQUIRED', 'Select distinct work items.');
    return transaction(db, async tx => {
        const previous = existingBatchId && await tx.batch.findUnique({ where: { id: existingBatchId }, include: QC_RUN_INCLUDE });
        if (existingBatchId && !previous) throw error(404, 'BATCH_NOT_FOUND', 'Batch not found.');
        if (previous) {
            await scope(tx, actor, previous);
            if (previous.startedAt || previous.measurements.length || previous.analytes.some(row => row.legacyMembershipFrozen)) {
                throw error(409, 'BATCH_MEMBERSHIP_FROZEN', 'Started or measured membership cannot be rebuilt.');
            }
            if (previous.status !== 'OPEN') throw error(409, 'QC_BATCH_LOCKED', 'Only an OPEN run can be rebuilt.');
        }
        const items = await tx.workItem.findMany({ where: { id: { in: input.workItemIds } }, include: { sample: true } });
        if (items.length !== input.workItemIds.length) throw error(404, 'WORKITEM_NOT_FOUND', 'One or more work items were not found.');
        const lab = await policyService.resolveLab(previous?.labId || input.labId || actor.labId || items[0].assignedLab || items[0].labId || items[0].sample?.assignedLab, tx);
        if (!lab) throw error(400, 'QC_RUN_LAB_REQUIRED', 'Select a registered run laboratory.');
        await scope(tx, actor, { labId: lab.id });
        const batch = { id: previous?.id || (typeof input.id === 'string' && input.id.trim() ? input.id.trim() : `BATCH-${randomUUID()}`), labId: previous?.labId || lab.id };
        const instrument = await instrumentFor(tx, batch, Object.hasOwn(input, 'instrumentId') ? input.instrumentId : previous?.instrumentId, actor);
        const instrumentText = input.instrument ?? previous?.instrument ?? instrument?.name ?? 'Manual';
        if (typeof instrumentText !== 'string') throw error(422, 'QC_INSTRUMENT_INVALID', 'Instrument name must be text.');
        const orderedItems = input.workItemIds.map(id => items.find(item => item.id === id));
        const actorLab = await policyService.resolveLab(actor.labId, tx);
        const memberships = new Set();
        for (const item of orderedItems) {
            const sampleLab = await policyService.resolveLab(item.sample?.assignedLab, tx);
            const sourceLab = await policyService.resolveLab(item.sample?.labId, tx);
            scopeGuard.ensureScope({ ...actor, labId: actorLab?.id || actor.labId }, { ...item.sample,
                assignedLab: sampleLab?.id || item.sample?.assignedLab, labId: sourceLab?.id || item.sample?.labId }, { labField: 'assignedLab', altLabField: 'labId' });
            const itemLab = await policyService.resolveLab(item.assignedLab || item.labId || item.sample?.assignedLab, tx);
            if (itemLab?.id !== lab.id) throw error(403, 'QC_WORK_ITEM_SCOPE_DENIED', 'Work items must belong to the run laboratory.');
            if (item.batchId && item.batchId !== previous?.id) throw error(409, 'QC_WORK_ITEM_ALREADY_BATCHED', 'A work item already belongs to a run.', { workItemId: item.id });
            if (['SUBMITTED', 'ACCEPTED', 'WAIVED', 'CANCELLED'].includes(item.status)) throw error(400, 'QC_WORK_ITEM_SEALED', 'A sealed work item cannot be attached to a run.', { workItemId: item.id, status: item.status });
            const key = JSON.stringify([item.sampleId, item.analysis]);
            if (memberships.has(key)) throw error(422, 'QC_BATCH_DUPLICATE_MEMBERSHIP', 'Select one active work item per sample and analysis.', { sampleId: item.sampleId, analysisCode: item.analysis });
            memberships.add(key);
        }
        const codes = [...new Set(orderedItems.map(item => item.analysis))];
        const removedBound = previous?.analytes.find(row => !codes.includes(row.analysisCode) &&
            previous.positions.some(position => (position.references || []).some(reference => reference.analysisCode === row.analysisCode)));
        if (removedBound) {
            throw error(409, 'QC_ANALYTE_REMOVAL_BLOCKED', 'Abandon this OPEN run and build a new run before dropping a bound analyte.', {
                analysisCode: removedBound.analysisCode, boundPositionIds: previous.positions.filter(position =>
                    (position.references || []).some(reference => reference.analysisCode === removedBound.analysisCode)).map(position => position.id) });
        }
        let selections = input.analyses;
        if (selections === undefined) selections = codes.map(analysisCode => ({ analysisCode,
            ...((input.analysisCode || input.analysis) === analysisCode && input.methodologyId && { methodologyId: input.methodologyId }) }));
        if (!Array.isArray(selections) || selections.length !== codes.length || new Set(selections.map(row => row?.analysisCode)).size !== codes.length ||
            selections.some(row => !codes.includes(row?.analysisCode))) throw error(422, 'QC_SEQUENCE_ANALYSES_INVALID', 'The selected analyses must match the work items.');
        const analyses = [];
        for (const selection of selections) {
            const members = orderedItems.filter(item => item.analysis === selection.analysisCode), methods = new Set(members.map(item => item.methodologyId));
            const methodologyId = selection.methodologyId || (methods.size === 1 && !methods.has(null) && [...methods][0]);
            if (!methodologyId) throw error(422, 'QC_BATCH_METHOD_AMBIGUOUS', 'Select the method for this run analyte.', { analysisCode: selection.analysisCode });
            if (members.some(item => item.methodologyId && item.methodologyId !== methodologyId)) {
                throw error(422, 'QC_BATCH_METHOD_AMBIGUOUS', 'The selected method contradicts a recorded work-item method.', { analysisCode: selection.analysisCode });
            }
            const method = await tx.methodology.findUnique({ where: { id: methodologyId } });
            const methodLab = method?.labId && await policyService.resolveLab(method.labId, tx);
            if (!method || method.analysisCode !== selection.analysisCode || method.labId && methodLab?.id !== lab.id) {
                throw error(422, 'QC_BATCH_METHOD_AMBIGUOUS', 'The selected method must belong to this analysis and laboratory.', { analysisCode: selection.analysisCode });
            }
            analyses.push({ ...await resolveSequenceCriteria(lab.id, selection.analysisCode, methodologyId, tx),
                crmOrdinal: await nextOrdinal(tx, lab.id, selection.analysisCode, methodologyId),
                methodResolution: selection.methodologyId ? 'EXPLICIT_SELECTION' : 'RECORDED_WORK_ITEMS' });
        }
        const samples = [...new Map(orderedItems.map(item => [item.sampleId, { sampleId: item.sampleId,
            analysisCodes: orderedItems.filter(member => member.sampleId === item.sampleId).map(member => member.analysis) }])).values()];
        let sequence = planRunSequence({ samples, analyses, seed: input.seed });
        if (previous) {
            sequence = retainBoundPositions(sequence, previous);
            sequence.rebuild.removedAnalyteCodes = previous.analytes.filter(row => !codes.includes(row.analysisCode)).map(row => row.analysisCode);
        }
        const now = new Date(), referencePlans = await prepareBuildBindings(tx, batch, sequence, selections, actor, now, previous ? 'REBUILD_BEFORE_START' : null);
        if (previous) {
            await replaceUnmeasuredPositions(tx, previous, sequence, input.workItemIds);
            await tx.batchAnalyte.deleteMany({ where: { batchId: batch.id, analysisCode: { notIn: codes } } });
            await tx.batch.update({ where: { id: batch.id }, data: { analysis: selections[0].analysisCode, instrumentId: instrument?.id || null, instrument: instrumentText,
                ...(input.notes !== undefined && { notes: input.notes }) } });
        } else await tx.batch.create({ data: { ...batch, analysis: selections[0].analysisCode, instrumentId: instrument?.id || null, instrument: instrumentText,
            status: 'OPEN', createdBy: performedBy, createdAt: now, notes: input.notes || '', maxCapacity: null,
            qcResults: null, workItemIds: null, history: null, disposition: null } });
        for (const analyte of analyses) {
            const existing = previous?.analytes.find(row => row.analysisCode === analyte.analysisCode);
            const data = { methodologyId: analyte.methodologyId, methodResolution: analyte.methodResolution, status: 'OPEN', provenance: 'NATIVE' };
            if (existing) await tx.batchAnalyte.update({ where: { id: existing.id }, data });
            else await tx.batchAnalyte.create({ data: { id: randomUUID(), batchId: batch.id, labId: batch.labId, analysisCode: analyte.analysisCode, ...data } });
        }
        for (const position of sequence.positions) {
            if (sequence.rebuild?.retainedPositionIds.includes(position.id)) await tx.batchPosition.update({ where: { id: position.id }, data: { position: position.position } });
            else await tx.batchPosition.create({ data: { id: position.id, batchId: batch.id, position: position.position, kind: position.kind,
                sampleId: position.sampleId, duplicateOfPositionId: position.duplicateOfPositionId, provenance: 'NATIVE' } });
            if (position.kind === 'SAMPLE') for (const item of orderedItems.filter(row => row.sampleId === position.sampleId)) {
                const changed = await tx.workItem.updateMany({ where: { id: item.id, batchId: item.batchId }, data: { batchId: batch.id, rackPosition: position.position } });
                if (changed.count !== 1) throw error(409, 'QC_WORK_ITEM_ALREADY_BATCHED', 'A work item changed during the build.', { workItemId: item.id });
                await tx.batchPositionWorkItem.create({ data: { id: randomUUID(), positionId: position.id, workItemId: item.id, analysisCode: item.analysis } });
            }
        }
        for (const plan of referencePlans) await applyPositionBindings(tx, plan);
        await tx.batchEvent.create({ data: { id: randomUUID(), batchId: batch.id, type: 'RUN_BUILT', by: performedBy, at: now,
            payload: JSON.stringify({ positions: sequence.positions, duplicateSelection: sequence.duplicateSelection, forecasts: sequence.forecasts,
                ...(sequence.rebuild && { rebuild: sequence.rebuild }),
                originalWorkItemMethods: orderedItems.map(item => ({ id: item.id, methodologyId: item.methodologyId })) }) } });
        return batchApiView(await tx.batch.findUnique({ where: { id: batch.id }, include: QC_RUN_INCLUDE }));
    });
}

async function startNativeRun(db, batchId, actor, input = {}) {
    const performedBy = permission(actor);
    return transaction(db, async tx => {
        const batch = await tx.batch.findUnique({ where: { id: batchId }, include: QC_RUN_INCLUDE });
        if (!batch) throw error(404, 'BATCH_NOT_FOUND', 'Batch not found.');
        await scope(tx, actor, batch);
        if (!batch.analytes.length || batch.analytes.some(row => row.provenance !== 'NATIVE')) throw error(409, 'QC_NATIVE_RUN_REQUIRED', 'This start flow requires a native run.');
        if (batch.status !== 'OPEN') throw error(409, 'QC_BATCH_LOCKED', 'The run must be OPEN before it starts.');
        if (batch.startedAt) {
            if (input.instrumentId !== undefined && input.instrumentId !== batch.instrumentId) throw error(409, 'QC_INSTRUMENT_FROZEN', 'Started instrument identity is frozen.');
            if (batch.analytes.some(row => !row.criteriaSnapshot || !row.crmOrdinal)) throw error(409, 'QC_SEQUENCE_STALE', 'The started run lacks its frozen criteria.');
            const statuses = [];
            for (const row of batch.analytes) {
                const status = ['OPEN', 'QC_PENDING'].includes(row.status) ? 'IN_RUN' : row.status;
                statuses.push(status);
                if (status !== row.status) await tx.batchAnalyte.update({ where: { id: row.id }, data: { status } });
            }
            await tx.batch.update({ where: { id: batch.id }, data: { status: aggregateBatchStatus(statuses, { startedAt: batch.startedAt }) } });
            await tx.batchEvent.create({ data: { id: randomUUID(), batchId: batch.id, type: 'RUN_RESUMED', by: performedBy, at: new Date(), payload: JSON.stringify({ firstStartedAt: batch.startedAt }) } });
            return batchApiView(await tx.batch.findUnique({ where: { id: batch.id }, include: QC_RUN_INCLUDE }));
        }
        if (!await tx.user.findUnique({ where: { username: performedBy }, select: { username: true } })) throw error(400, 'QC_ANALYST_REQUIRED', 'The analyst must be a registered user.');
        const analyses = [];
        for (const row of batch.analytes) analyses.push({ ...await resolveSequenceCriteria(batch.labId, row.analysisCode, row.methodologyId, tx),
            crmOrdinal: await nextOrdinal(tx, batch.labId, row.analysisCode, row.methodologyId) });
        const instrument = await instrumentFor(tx, batch, Object.hasOwn(input, 'instrumentId') ? input.instrumentId : batch.instrumentId, actor);
        if (!instrument && analyses.some(row => row.calibrationVerification)) throw error(422, 'QC_INSTRUMENT_REQUIRED', 'Calibration verification requires a registered instrument.');
        const validated = validateRunSequence({ positions: batch.positions, analyses });
        const now = new Date(), changed = await tx.batch.updateMany({ where: { id: batch.id, status: 'OPEN', startedAt: null },
            data: { startedAt: now, analystUsername: performedBy, instrumentId: instrument?.id || null, status: aggregateBatchStatus(['IN_RUN'], { startedAt: now }) } });
        if (changed.count !== 1) throw error(409, 'QC_SEQUENCE_STALE', 'The run changed before first start.');
        for (const row of batch.analytes) {
            const criteria = validated.forecasts.find(forecast => forecast.analysisCode === row.analysisCode);
            await tx.batchAnalyte.update({ where: { id: row.id }, data: { status: 'IN_RUN', crmOrdinal: criteria.crmOrdinal,
                policyVersion: criteria.policyVersion, qcRuleId: criteria.qcRule.id, qcRuleVersion: criteria.qcRule.version,
                criteriaSnapshot: JSON.stringify({ ...criteria, instrumentId: instrument?.id || null, instrumentText: batch.instrument }) } });
        }
        await tx.batchEvent.create({ data: { id: randomUUID(), batchId: batch.id, type: 'RUN_STARTED', by: performedBy, at: now,
            payload: JSON.stringify({ positions: validated.positions, instrumentId: instrument?.id || null, instrumentText: batch.instrument,
                crmOrdinals: analyses.map(row => ({ analysisCode: row.analysisCode, crmOrdinal: row.crmOrdinal })) }) } });
        return batchApiView(await tx.batch.findUnique({ where: { id: batch.id }, include: QC_RUN_INCLUDE }));
    });
}

async function rebuildNativeRun(db, batchId, actor, input) {
    return buildNativeRun(db, actor, input, { existingBatchId: batchId });
}

module.exports = { buildNativeRun, rebuildNativeRun, startNativeRun, instrumentFor, nextOrdinal };
