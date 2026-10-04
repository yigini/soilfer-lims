const { randomUUID } = require('node:crypto');
const workflow = require('../workflowContract');
const { hasPermission } = require('../config/roles');
const rules = require('./workflowStateRules');
const { transitionSample } = require('./sampleStateService');
const { transitionWorkItem } = require('./workItemStateService');
const evidence = require('./resultEvidenceService');
const { TransitionError } = rules;

function objectMetadata(value) {
    try {
        const object = typeof value === 'string' ? JSON.parse(value) : value || {};
        if (object && typeof object === 'object' && !Array.isArray(object)) return object;
    } catch (_) { /* Do not overwrite unreadable historical metadata. */ }
    throw new TransitionError('Stored sample metadata must be reviewed before this gate change.', 409, 'SAMPLE_METADATA_INVALID');
}

function restoreTarget(row, entity, explicit) {
    const target = rules.heldPriorState(row, entity) || explicit;
    if (!target) throw new TransitionError('A manager must choose the legacy hold recovery state.', 409, 'HOLD_RECOVERY_REQUIRED', {
        allowedStates: entity === 'Sample' ? ['ACCEPTED', 'PROCESSING'] : ['NOT_ASSIGNED', 'ASSIGNED']
    });
    return target;
}

async function changeGate({ sampleId, gate, status, reason, actor, resumeSampleStatus, resumeWorkItemStatus, db = require('../prisma') }) {
    const field = evidence.GATE_FIELDS[gate];
    if (!field || !(gate === 'DRYING' ? workflow.isValidDryingStatus(status) : workflow.isValidPreparationStatus(status))) {
        throw new TransitionError('Unknown operational gate or status.', 400, 'INVALID_PREPARATION_GATE');
    }
    if (status === 'DONE') throw new TransitionError('Completing a gate requires its verified checklist.', 422, 'CHECKLIST_REQUIRED');
    if (!hasPermission(actor, 'ENTER_RESULTS')) throw new TransitionError('Operational gate permission required.', 403, 'OPERATIONAL_PERMISSION_DENIED');
    if (status === 'FAILED') rules.requireReason(reason);
    return rules.inTransaction(db, async tx => {
        const sample = await tx.sample.findUnique({ where: { id: String(sampleId) } });
        if (!sample) throw new TransitionError('Sample not found.', 404, 'SAMPLE_NOT_FOUND');
        rules.assertScope(actor, sample);
        evidence.assertAmendable(sample);
        if (workflow.normalizeSampleState(sample.status) === 'CANCELLED') throw new TransitionError('The sample is closed.', 409, 'SAMPLE_CLOSED');
        const items = await tx.workItem.findMany({ where: { sampleId: sample.id, analysis: gate } });
        const item = items.find(row => !row.duplicateOf);
        if (!item) throw new TransitionError('Operational gate work item not found.', 404, 'WORK_ITEM_NOT_FOUND');
        const previous = sample[field] || 'PENDING';
        let eventCount = 0, updatedItem = item;
        const updates = { [field]: status };
        let sampleStatus = workflow.normalizeSampleState(sample.status);
        if (previous === 'DONE' && status === 'PENDING') {
            rules.requireReason(reason);
            // Safety checks include marked historical duplicates as well as the
            // canonical gate; accepted scientific/custody history is final.
            if (items.some(row => workflow.normalizeWorkItemState(row.status) === 'ACCEPTED')) {
                throw new TransitionError('Accepted gate work requires an amendment.', 409, 'AMENDMENT_WORKFLOW_REQUIRED');
            }
            updatedItem = await transitionWorkItem(item.id, 'NOT_ASSIGNED', actor, reason, {}, tx, { action: 'GATE_REVERTED' });
            eventCount = await evidence.recordPreparationRevert(tx, sample, gate, reason, actor);
        } else if (status === 'FAILED') {
            updates.metadata = JSON.stringify({ ...objectMetadata(sample.metadata), dryingFailedReason: reason.trim() });
            sampleStatus = 'ON_HOLD';
            updatedItem = await transitionWorkItem(item.id, 'ON_HOLD', actor, reason,
                { result: `Gate Failed: ${reason.trim()}` }, tx, { audit: { action: 'GATE_FAILED' } });
        } else if (status === 'PENDING' && previous === 'FAILED') {
            rules.requireReason(reason);
            if (workflow.normalizeWorkItemState(item.status) === 'ON_HOLD') {
                updatedItem = await transitionWorkItem(item.id, restoreTarget(item, 'WorkItem', resumeWorkItemStatus), actor, reason, {}, tx);
            }
            if (sampleStatus === 'ON_HOLD') sampleStatus = restoreTarget(sample, 'Sample', resumeSampleStatus);
        }
        const updatedSample = await transitionSample(sample.id, sampleStatus, actor, reason, updates, tx);
        if (previous !== status) await tx.auditLog.create({ data: {
            id: randomUUID(), entity: 'SAMPLE', entityId: sample.id,
            action: gate === 'DRYING' ? 'DRYING_STATUS_CHANGED' : 'PREP_STATUS_CHANGED',
            details: JSON.stringify({ gate, from: previous, to: status, reason: reason || null, resultEvidenceCount: eventCount }),
            performedBy: rules.actorName(actor), sampleId: sample.id, labId: sample.assignedLab || null,
            before: JSON.stringify({ [field]: previous }), after: JSON.stringify({ [field]: status }), timestamp: new Date()
        } });
        return { sample: updatedSample, workItem: updatedItem, resultEvidenceCount: eventCount };
    });
}

module.exports = { changeGate };
