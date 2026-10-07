const { randomUUID } = require('node:crypto');
const { hasPermission } = require('../config/roles');
const scopeGuard = require('../utils/scopeGuard');
const policyService = require('./policyService');
const { actorName, inTransaction } = require('./workflowStateRules');
const { QC_RUN_INCLUDE, readQcRun, batchApiView } = require('./qcRunViewService');
const { rebuildNativeRun } = require('./qcNativeRunService');
const { resolveBatchRunProfile } = require('./qcRunProfileService');
const { TEXTURE_ALIASES, runAnalyteCode } = require('./analysisCodesService');
const { repeatSource } = require('./qcRunRepeatService');
const failure = (statusCode, code, message, details = {}) => Object.assign(new Error(message), { statusCode, code, details });

async function assertMemberScope(db, actor, batch, item) {
    const [actorLab, assigned, source, target, itemLab] = await Promise.all([policyService.resolveLab(actor.labId, db),
        policyService.resolveLab(item.sample?.assignedLab, db), policyService.resolveLab(item.sample?.labId, db),
        policyService.resolveLab(batch.labId, db), policyService.resolveLab(item.assignedLab || item.labId || item.sample?.assignedLab, db)]);
    scopeGuard.ensureScope({ ...actor, labId: actorLab?.id || actor.labId }, { ...item.sample,
        assignedLab: assigned?.id || item.sample?.assignedLab, labId: source?.id || item.sample?.labId }, { labField: 'assignedLab', altLabField: 'labId' });
    if (target?.id !== itemLab?.id) throw failure(403, 'QC_WORK_ITEM_SCOPE_DENIED', `Item ${item.id} is outside your laboratory scope.`);
}
function assertOpen(batch) {
    if (batch.startedAt || batch.measurements.length || batch.analytes.some(row => row.legacyMembershipFrozen)) {
        throw failure(409, 'BATCH_MEMBERSHIP_FROZEN', 'Started or measured sample membership cannot be changed.');
    }
    if (batch.status !== 'OPEN') throw failure(409, 'QC_BATCH_MEMBERSHIP_LOCKED', 'Batch is not OPEN');
}
function requestedIds(input) {
    if (!Array.isArray(input.workItemIds) || !input.workItemIds.length || input.workItemIds.some(id => typeof id !== 'string' || !id) ||
        new Set(input.workItemIds).size !== input.workItemIds.length) throw failure(400, 'QC_WORK_ITEMS_REQUIRED', 'workItemIds must be a non-empty array of distinct ids');
    return input.workItemIds;
}
function assertBoundRemoval(batch, items) {
    for (const row of batch.analytes.filter(analyte => !items.some(item => runAnalyteCode(batch, item.analysis) === analyte.analysisCode))) {
        const boundPositionIds = batch.positions.filter(position => position.references.some(reference => reference.analysisCode === row.analysisCode)).map(position => position.id);
        if (boundPositionIds.length) throw failure(409, 'QC_ANALYTE_REMOVAL_BLOCKED', 'Abandon this OPEN run before dropping a bound analyte.', { analysisCode: row.analysisCode, boundPositionIds });
    }
}
async function changeRunMembers(db, batchId, actor, input, { remove = false } = {}) {
    if (!hasPermission(actor, 'CHANGE_STATUS')) throw failure(403, 'QC_RUN_PERMISSION_REQUIRED', 'QC membership permission is required.');
    const ids = requestedIds(input), performedBy = actorName(actor);
    return inTransaction(db, async tx => {
        await readQcRun(tx, batchId, actor);
        const batch = await tx.batch.findUnique({ where: { id: batchId }, include: QC_RUN_INCLUDE });
        assertOpen(batch);
        const oldIds = batch.workItems.map(row => row.id), desired = remove ? oldIds.filter(id => !ids.includes(id)) : [...new Set([...oldIds, ...ids])];
        const items = await tx.workItem.findMany({ where: { id: { in: desired } }, include: { sample: true } });
        if (items.length !== desired.length) throw failure(404, 'WORKITEM_NOT_FOUND', 'One or more work items not found');
        const ordered = desired.map(id => items.find(item => item.id === id));
        const repeated = new Map();
        for (const item of ordered) {
            await assertMemberScope(tx, actor, batch, item);
            if (!remove && ids.includes(item.id) && ['SUBMITTED', 'ACCEPTED', 'WAIVED', 'CANCELLED'].includes(item.status)) {
                throw failure(400, 'QC_WORK_ITEM_SEALED', `Item ${item.id} is already sealed (${item.status})`);
            }
            const fromBatchId = await repeatSource(tx, item, batchId);
            if (fromBatchId) repeated.set(item.id, fromBatchId);
            if (!batch.analytes.some(row => row.provenance === 'NATIVE') && item.analysis !== batch.analysis &&
                !(TEXTURE_ALIASES.has(batch.analysis) && TEXTURE_ALIASES.has(item.analysis))) {
                throw failure(400, 'QC_ANALYSIS_MISMATCH', `Item ${item.id} analysis (${item.analysis}) does not match batch analysis (${batch.analysis})`);
            }
        }
        assertBoundRemoval(batch, ordered);
        const groups = [...new Set(ordered.map(item => runAnalyteCode(batch, item.analysis)))].map(code => ordered.filter(item => runAnalyteCode(batch, item.analysis) === code));
        const resolved = groups.length && groups.every(group => group.every(item => item.methodologyId) && new Set(group.map(item => item.methodologyId)).size === 1);
        const migratedTexture = batch.analytes.some(row => row.provenance === 'LEGACY_MIGRATED') && TEXTURE_ALIASES.has(batch.analysis);
        const native = batch.analytes.some(row => row.provenance === 'NATIVE') || !migratedTexture && resolved || input.analyses !== undefined;
        let view;
        if (native && desired.length) view = await rebuildNativeRun(tx, batchId, actor, { ...input, workItemIds: desired, seed: input.seed || randomUUID() });
        else {
            if (batch.positions.some(row => row.references.length)) throw failure(409, 'QC_REFERENCE_BOUND', 'Retain bound reference positions through the Native rebuild path.');
            if (groups.some(group => new Set(group.map(item => item.methodologyId).filter(Boolean)).size > 1)) {
                throw failure(422, 'QC_BATCH_METHOD_AMBIGUOUS', 'Select the method for this run analyte.');
            }
            const profile = await resolveBatchRunProfile(batch, tx), capacity = batch.maxCapacity || profile.capacity;
            if (desired.length > capacity) throw failure(400, 'QC_BATCH_CAPACITY_EXCEEDED', `Adding ${ids.length} items exceeds maximum batch capacity of ${capacity} (current: ${oldIds.length})`,
                { capacity, currentSize: oldIds.length, profile: profile.profileKey });
            const reserved = new Map(profile.qcSlots.map(row => [row.position, row])), occupied = new Map(batch.workItems.filter(row => desired.includes(row.id) && row.rackPosition != null).map(row => [row.rackPosition, row.id]));
            const explicit = input.rackPositions && typeof input.rackPositions === 'object' ? input.rackPositions : {}, assigned = new Map();
            for (const id of remove ? [] : ids) if (explicit[id] !== undefined) {
                const position = Number(explicit[id]);
                if (!Number.isInteger(position)) throw failure(400, 'QC_RACK_POSITION_INVALID', `Rack position for ${id} must be an integer`);
                if (position < 1 || position > capacity) throw failure(400, 'QC_RACK_POSITION_INVALID', `Rack position ${position} for ${id} is out of bounds (1..${capacity})`);
                if (reserved.has(position)) throw failure(400, 'QC_RACK_POSITION_RESERVED', `Rack position ${position} is reserved for QC slot`, { reservedSlot: reserved.get(position) });
                if ([...assigned.values()].includes(position)) throw failure(400, 'QC_RACK_POSITION_DUPLICATE', `Duplicate rack position ${position} requested`);
                if (occupied.has(position) && occupied.get(position) !== id) throw failure(400, 'QC_RACK_POSITION_OCCUPIED', `Rack position ${position} is already occupied in this batch`);
                assigned.set(id, position);
            }
            let candidate = 1;
            for (const item of ordered) if (!assigned.has(item.id)) {
                if (oldIds.includes(item.id) && item.rackPosition != null) { assigned.set(item.id, item.rackPosition); continue; }
                while (candidate <= capacity && (reserved.has(candidate) || occupied.has(candidate) || [...assigned.values()].includes(candidate))) candidate++;
                if (candidate > capacity) throw failure(400, 'QC_RACK_CAPACITY_EXCEEDED', `Cannot add item ${item.id}: No available non-QC rack positions remaining in profile ${profile.profileKey} (capacity: ${capacity})`);
                assigned.set(item.id, candidate++);
            }
            await tx.batchPositionWorkItem.deleteMany({ where: { positionId: { in: batch.positions.map(row => row.id) } } });
            for (const kind of ['DUPLICATE', 'OTHER']) await tx.batchPosition.deleteMany({ where: { id: { in: batch.positions.filter(row =>
                kind === 'DUPLICATE' ? row.kind === 'DUPLICATE' : row.kind !== 'DUPLICATE').map(row => row.id) } } });
            const codes = [...new Set(ordered.map(item => runAnalyteCode(batch, item.analysis)))];
            await tx.batchAnalyte.deleteMany({ where: { batchId, analysisCode: { notIn: codes } } });
            for (const code of codes) if (!batch.analytes.some(row => row.analysisCode === code)) {
                await tx.batchAnalyte.create({ data: { id: randomUUID(), batchId, labId: batch.labId, analysisCode: code,
                    provenance: 'PROFILE_ONLY', methodResolution: 'UNRESOLVED_PROFILE', status: 'OPEN' } });
            }
            const samples = new Map();
            for (const item of ordered) {
                let position = samples.get(item.sampleId);
                if (!position) {
                    position = { id: randomUUID(), batchId, position: assigned.get(item.id), sampleId: item.sampleId, kind: 'SAMPLE', provenance: 'PROFILE_ONLY',
                        ...(migratedTexture && { legacySource: JSON.stringify({ textureAlias: true, batchAnalysis: batch.analysis, workItemAnalysis: item.analysis }) }) };
                    samples.set(item.sampleId, position); await tx.batchPosition.create({ data: position });
                }
                if (ordered.some(other => other.id !== item.id && other.sampleId === item.sampleId && other.analysis === item.analysis)) {
                    throw failure(400, 'QC_SAMPLE_ANALYSIS_DUPLICATE', 'Select one work item for each sample and analysis.');
                }
                await tx.workItem.update({ where: { id: item.id }, data: { batchId, rackPosition: position.position } });
                await tx.batchPositionWorkItem.create({ data: { id: randomUUID(), positionId: position.id, workItemId: item.id, analysisCode: item.analysis } });
            }
            await tx.workItem.updateMany({ where: { id: { in: oldIds.filter(id => !desired.includes(id)) }, batchId }, data: { batchId: null, rackPosition: null } });
            const now = new Date();
            for (const item of ordered.filter(row => repeated.has(row.id))) await tx.batchEvent.create({ data: {
                id: randomUUID(), batchId, type: 'MEMBER_REPEATED', by: performedBy, at: now,
                payload: JSON.stringify({ fromBatchId: repeated.get(item.id), workItemId: item.id, analysisCode: item.analysis }) } });
            await tx.batchEvent.create({ data: { id: randomUUID(), batchId, type: 'RUN_BUILT', by: performedBy, at: now,
                payload: JSON.stringify({ profileOnly: !native, seed: randomUUID(), positions: [...samples.values()], removedAnalyteCodes: batch.analytes.filter(row => !codes.includes(row.analysisCode)).map(row => row.analysisCode), workItemIds: desired }) } });
            view = batchApiView(await tx.batch.findUnique({ where: { id: batchId }, include: QC_RUN_INCLUDE }));
        }
        const profile = await resolveBatchRunProfile(view, tx);
        return remove ? { success: true, removed: ids.filter(id => oldIds.includes(id)).length, remaining: desired.length, batch: view }
            : { success: true, count: ids.length, capacity: view.maxCapacity || profile.capacity, runProfile: profile.profileKey,
                positions: Object.fromEntries(view.workItems.filter(row => ids.includes(row.id)).map(row => [row.id, row.rackPosition])), batch: view };
    });
}
module.exports = { changeRunMembers };
