const workflow = require('../workflowContract');
const { TransitionError } = require('./workflowStateRules');
const excluded = ['DRYING', 'PREPARATION', ...workflow.CLOSURE_TASK_ANALYSES];
const submittedStates = ['SUBMITTED', 'ACCEPTED', 'WAIVED', 'CANCELLED'];

/** Derive from the transaction's actual canonical items, without writing rows. */
async function deriveSubmissionLifecycle(db, sampleId, { previewSelection = [] } = {}) {
    const items = await db.workItem.findMany({ where: { sampleId: String(sampleId), duplicateOf: null, analysis: { notIn: excluded } },
        select: { id: true, analysis: true, status: true }, orderBy: { id: 'asc' } });
    return deriveSubmissionFromItems(items, { previewSelection });
}

function deriveSubmissionFromItems(items, { previewSelection = [] } = {}) {
    const selected = new Set(previewSelection);
    const counted = items.filter(item => item.duplicateOf == null && !excluded.includes(item.analysis))
        .map(item => ({ ...item, status: selected.has(item.id) && item.status === 'COMPLETED'
        ? 'SUBMITTED' : workflow.normalizeWorkItemState(item.status) }));
    const blocking = counted.filter(item => !submittedStates.includes(item.status))
        .map(item => ({ workItemId: item.id, analysis: item.analysis, status: item.status }));
    const hasSubmission = counted.some(item => ['SUBMITTED', 'ACCEPTED'].includes(item.status));
    const type = counted.length > 0 && hasSubmission && blocking.length === 0 ? 'FULL' : 'PARTIAL';
    return { type, sampleStatus: type === 'FULL' ? 'SUBMITTED_FULL' : 'SUBMITTED_PARTIAL', blocking,
        counted: counted.length, hasSubmission };
}

function assertRequestedType(requested, derived) {
    if (requested === 'FULL' && derived.type !== 'FULL') {
        throw new TransitionError('Some canonical analytical work has not been submitted.', 409, 'SUBMISSION_NOT_FULL', {
            blocking: derived.blocking, hasSubmission: derived.hasSubmission
        });
    }
}

module.exports = { deriveSubmissionLifecycle, deriveSubmissionFromItems, assertRequestedType };
