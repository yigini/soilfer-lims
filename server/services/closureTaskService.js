const { randomUUID } = require('node:crypto');
const workflow = require('../workflowContract');
const { hasPermission } = require('../config/roles');
const rules = require('./workflowStateRules');
const { createWorkItem } = require('./workItemStateService');

/** Closure requests preserve the approved Sample until manager closure review. */
async function requestClosure(sampleId, analysis, input, actor, db = null) {
    const archive = analysis === 'ARCHIVING';
    if (!['ARCHIVING', 'DISPOSAL'].includes(analysis)) throw new rules.TransitionError('Unknown closure task.', 400, 'INVALID_CLOSURE_TASK');
    if (!hasPermission(actor, archive ? 'ARCHIVE_SAMPLE' : 'DISPOSE_SAMPLE')) {
        throw new rules.TransitionError('Closure permission required.', 403, 'CLOSURE_PERMISSION_DENIED');
    }
    return rules.inTransaction(db, async tx => {
        const sample = await tx.sample.findUnique({ where: { id: String(sampleId) } });
        if (!sample) throw new rules.TransitionError('Sample not found.', 404, 'SAMPLE_NOT_FOUND');
        rules.assertScope(actor, sample);
        if (sample.status !== 'APPROVED') throw new rules.TransitionError('Sample must be APPROVED before requesting closure.', 409, 'SAMPLE_NOT_APPROVED');
        const items = await tx.workItem.findMany({ where: { sampleId: sample.id } });
        const unfinished = items.filter(item => !workflow.CLOSURE_TASK_ANALYSES.includes(item.analysis) &&
            !(['DRYING', 'PREPARATION'].includes(item.analysis) ? ['COMPLETED', 'ACCEPTED', 'WAIVED'] : ['ACCEPTED', 'WAIVED']).includes(item.status));
        if (unfinished.length) throw new rules.TransitionError('Active work must finish before requesting closure.', 409,
            'CLOSURE_ACTIVE_WORK', { activeWorkItems: unfinished.map(({ id, analysis, status }) => ({ id, analysis, status })) });
        const target = archive ? 'ARCHIVED' : 'DISPOSED';
        const sameTask = item => workflow.CLOSURE_TASK_SAMPLE_STATES[item.analysis] === target;
        const opposing = items.find(item => workflow.CLOSURE_TASK_ANALYSES.includes(item.analysis) && !sameTask(item) &&
            ['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'ACCEPTED'].includes(item.status));
        if (opposing) throw new rules.TransitionError('An opposing closure task is active or completed.', 409, 'CLOSURE_TASK_CONFLICT');
        let metadata;
        try {
            metadata = typeof sample.metadata === 'string' ? JSON.parse(sample.metadata) : sample.metadata || {};
            if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') throw new Error('Invalid metadata');
        } catch (_) { throw new rules.TransitionError('Stored sample metadata requires correction before closure.', 409, 'SAMPLE_METADATA_INVALID'); }
        const field = archive ? 'archiveLocation' : 'disposalMethod';
        if (input[field]) metadata[field] = input[field];
        if (input.notes) metadata[archive ? 'archiveNotes' : 'disposalNotes'] = input.notes;
        const audit = { entity: 'SAMPLE', entityId: sample.id, action: archive ? 'ARCHIVE_TASK_CREATED' : 'DISPOSAL_TASK_CREATED',
            details: archive ? `Archiving work item created for location ${input.archiveLocation || 'ARCHIVE'}`
                : `Disposal work item created via ${input.disposalMethod || 'STANDARD'}` };
        let item = items.find(item => sameTask(item) && item.duplicateOf == null);
        if (!item) item = await createWorkItem({ id: randomUUID(), sampleId: sample.id, analysis, status: 'NOT_ASSIGNED',
            priority: sample.priority || 'NORMAL', labId: sample.labId || sample.assignedLab || actor.labId || null,
            assignedLab: sample.assignedLab || sample.labId || actor.labId || null }, actor, { tx, audit });
        else await tx.auditLog.create({ data: { id: randomUUID(), ...audit, sampleId: sample.id,
            performedBy: rules.actorName(actor), labId: sample.assignedLab || null, timestamp: new Date() } });
        await tx.sample.update({ where: { id: sample.id }, data: { metadata: JSON.stringify(metadata) } });
        return { status: sample.status, workItem: item, [field]: input[field] || metadata[field] || (archive ? 'ARCHIVE' : 'STANDARD') };
    });
}

module.exports = { requestClosure };
