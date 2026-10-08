const { randomUUID } = require('node:crypto');
const workflow = require('../workflowContract');
const rules = require('./workflowStateRules');
const { hasPermission } = require('../config/roles');
const evidence = require('./resultEvidenceService');
const { transitionSample, advanceCompletedGates } = require('./sampleStateService');
const { transitionWorkItem } = require('./workItemStateService');
const { deriveSubmissionLifecycle, assertRequestedType } = require('./submissionLifecycleService');
const { getAnalysisName } = require('./analysisService');

async function createSubmissionForItems({ db, actor, sampleId, type, workItemIds, expectedItems = [], note = null,
    prepareItems = null, requireOwnAssignment = actor?.role === 'LAB_TECHNICIAN' }) {
    if (!hasPermission(actor, 'ENTER_RESULTS')) throw new rules.TransitionError('Result submission is not authorized.', 403, 'SUBMISSION_NOT_AUTHORIZED');
    const performedBy = rules.actorName(actor);
    return rules.inTransaction(db, async tx => {
        const sample = await tx.sample.findUnique({ where: { id: String(sampleId) } });
        if (!sample) throw new rules.TransitionError('Sample not found.', 404, 'SAMPLE_NOT_FOUND');
        rules.assertScope(actor, sample);
        evidence.assertAmendable(sample);
        await evidence.assertNoPreparationRevert(tx, sample.id);
        await advanceCompletedGates(sample, actor, tx);
        let items = [];
        for (const itemId of workItemIds) {
            const item = await tx.workItem.findUnique({ where: { id: itemId } });
            const expected = expectedItems.find(row => row.id === itemId);
            if (!item || item.sampleId !== sample.id || (requireOwnAssignment && item.assignedTo !== performedBy) ||
                (expected && (item.status !== expected.status || item.version !== expected.version))) {
                throw new rules.TransitionError('Work item changed. Reload before submitting.', 409, 'WORKITEM_STATE_CHANGED');
            }
            items.push(item);
        }
        if (prepareItems) items = await prepareItems(tx, sample, items);
        if (!items.length) throw new rules.TransitionError('Select completed work items before submitting.', 400, 'EMPTY_SUBMISSION_SELECTION');
        if (items.some(item => item.status !== 'COMPLETED')) throw new rules.TransitionError('Work item changed. Reload before submitting.', 409, 'WORKITEM_STATE_CHANGED');
        const now = new Date(), submissionId = `SUB-${randomUUID()}`;
        const created = await tx.submission.create({ data: { id: submissionId, sampleId: sample.id, labId: sample.assignedLab || actor.labId,
            assignedLab: sample.assignedLab, submittedBy: performedBy, type, status: 'PENDING_REVIEW', submittedAt: now,
            note, workItemIds: JSON.stringify(items.map(item => item.id)), workItemCount: items.length, createdAt: now } });
        for (const item of items) {
            const history = rules.requireHistory(item.history);
            history.push({ status: workflow.WORK_ITEM_STATES.SUBMITTED, submissionId, timestamp: now, action: 'SUBMITTED' });
            await transitionWorkItem(item.id, 'SUBMITTED', actor, 'Submitted for manager review', {
                submissionId, submittedAt: now, history: JSON.stringify(history)
            }, tx, { expected: { status: item.status, version: item.version }, audit: {
                action: 'WORKITEM_SUBMITTED', details: `${performedBy} submitted ${await getAnalysisName(item.analysis, tx)}` } });
            await require('./workAttemptEventService').submitRecordedAttempt(tx,item,actor);
        }
        const derived = await deriveSubmissionLifecycle(tx, sample.id);
        assertRequestedType(type, derived);
        const submission = await tx.submission.update({ where: { id: created.id }, data: { type: derived.type } });
        await tx.auditLog.create({ data: { id: randomUUID(), entity: 'SUBMISSION', entityId: submissionId, action: 'SUBMISSION_CREATED',
            details: `${performedBy} submitted ${items.length} items; requested ${type}, derived ${derived.type}`,
            after: JSON.stringify({ requestedType: type, derivedType: derived.type, sampleStatus: derived.sampleStatus }),
            performedBy, timestamp: now, sampleId: sample.id } });
        const updated = await transitionSample(sample.id, derived.sampleStatus, actor,
            `${performedBy} submitted ${items.length} items for ${derived.type} review`, {
                lastSubmissionId: submissionId, lastSubmissionType: derived.type, lastSubmissionAt: now
            }, tx);
        return { submission, sample: updated };
    });
}

module.exports = { createSubmissionForItems };
