const { randomUUID } = require('node:crypto');
const workflow = require('../workflowContract');
const { hasPermission } = require('../config/roles');
const rules = require('./workflowStateRules');
const { TransitionError } = rules;
const OPERATIONAL = Object.freeze(['DRYING', 'PREPARATION']);
const CONFIRMABLE = Object.freeze(['NOT_ASSIGNED', 'ASSIGNED', 'IN_PROGRESS', 'REPEAT_REQUIRED']);
const QC_REPEATABLE = Object.freeze(['NOT_ASSIGNED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'SUBMITTED', 'REPEAT_REQUIRED']);

function assertActionEdge(item, sample, nextStatus, actor, reason, options) {
    const current = workflow.normalizeWorkItemState(item.status);
    const operational = OPERATIONAL.includes(item.analysis);
    const action = options.action;
    if (nextStatus === 'AWAITING_VERIFICATION' || current === 'AWAITING_VERIFICATION') {
        if (nextStatus === 'AWAITING_VERIFICATION' && operational && action === 'OPERATION_CONFIRMED' && hasPermission(actor, 'ENTER_RESULTS') &&
            options.verificationRequired === true && CONFIRMABLE.includes(current)) return true;
        if (current === 'AWAITING_VERIFICATION' && operational && action === 'OPERATION_VERIFIED' &&
            hasPermission(actor, 'APPROVE_RESULTS') && workflow.REVIEW_DECISION_LIST.includes(options.decision) &&
            nextStatus === (options.decision === 'ACCEPT' ? 'COMPLETED' : 'REPEAT_REQUIRED')) return true;
        throw new TransitionError('Operational verification requires the confirmation/manager verification action.', 409, 'OPERATIONAL_VERIFICATION_REQUIRED');
    }
    if (action === 'OPERATION_VERIFIED') {
        throw new TransitionError('Only work awaiting verification can be verified.', 409, 'WORKITEM_NOT_AWAITING_VERIFICATION');
    }
    if (action === 'OPERATION_CONFIRMED') {
        if (!hasPermission(actor, 'ENTER_RESULTS') || !operational || !CONFIRMABLE.includes(current) || options.verificationRequired === true || nextStatus !== 'COMPLETED') {
            throw new TransitionError('Work item is not eligible for operational confirmation.', 409, 'OPERATIONAL_CONFIRMATION_REFUSED');
        }
        return true;
    }
    if (['REANALYZE_BATCH', 'REJECT_BATCH'].includes(action)) {
        rules.requireReason(reason);
        if (!hasPermission(actor, 'BATCH_APPROVAL') || nextStatus !== 'REPEAT_REQUIRED' || !QC_REPEATABLE.includes(current)) {
            throw new TransitionError('Work item is not eligible for the QC disposition.', 409, 'QC_DISPOSITION_STATE_REFUSED');
        }
        require('./resultEvidenceService').assertAmendable(sample);
        return true;
    }
    if (action === 'GATE_REVERTED') {
        rules.requireReason(reason);
        require('./resultEvidenceService').assertAmendable(sample);
        if (current === 'ACCEPTED') throw new TransitionError('Accepted gate work requires an amendment.', 409, 'AMENDMENT_WORKFLOW_REQUIRED');
        const gateField = item.analysis === 'DRYING' ? 'dryingStatus' : 'preparationStatus';
        if (!hasPermission(actor, 'ENTER_RESULTS') || !operational || sample[gateField] !== 'DONE' ||
            !['COMPLETED', 'SUBMITTED'].includes(current) || nextStatus !== 'NOT_ASSIGNED') {
            throw new TransitionError('The gate revert does not match a completed operational item.', 409, 'GATE_REVERT_REFUSED');
        }
        return true;
    }
    if (action === 'CLOSURE_REVIEW') {
        if (!workflow.CLOSURE_TASK_ANALYSES.includes(item.analysis) || !hasPermission(actor, 'APPROVE_RESULTS')) {
            throw new TransitionError('Closure review is not authorized.', 403, 'CLOSURE_REVIEW_FORBIDDEN');
        }
        if (nextStatus === 'ACCEPTED' && ['NOT_ASSIGNED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'SUBMITTED'].includes(current)) return true;
    }
    if (operational && nextStatus === 'COMPLETED') {
        throw new TransitionError('Operational completion requires its procedural confirmation.', 409, 'OPERATIONAL_CONFIRMATION_REQUIRED');
    }
    return workflow.isValidWorkItemTransition(current, nextStatus);
}

/** The only WorkItem status writer, including action-bound edges and review CAS. */
async function transitionWorkItem(workItemId, requestedStatus, actor, reason = null, extraData = {}, tx = null, options = {}) {
    const performedBy = rules.actorName(actor);
    const migrating = !!options.migrationPlan;
    const nextStatus = !migrating && requestedStatus === 'REANALYSIS_REQUIRED' ? 'REPEAT_REQUIRED' : requestedStatus;
    if (!migrating && workflow.isLegacyWorkItemState(nextStatus)) {
        throw new TransitionError(`Status '${nextStatus}' is a deprecated legacy status.`, 409, 'ILLEGAL_LEGACY_STATUS');
    }
    if (!migrating && (!workflow.isValidWorkItemState(nextStatus) || nextStatus === 'CANCELLED')) {
        throw new TransitionError(`Status '${nextStatus}' cannot be written.`, 409, 'UNKNOWN_WORKITEM_STATUS');
    }
    const data = rules.updateData(extraData, nextStatus, workflow.normalizeWorkItemState);
    return rules.inTransaction(tx, async client => {
        const item = await client.workItem.findUnique({ where: { id: String(workItemId) } });
        if (!item) throw new TransitionError('Work item not found.', 404, 'WORK_ITEM_NOT_FOUND');
        if (('id' in data && data.id !== item.id) || ('sampleId' in data && data.sampleId !== item.sampleId)) {
            throw new TransitionError('Work item identity and parent sample cannot change during a transition.', 400, 'WORKFLOW_ID_IMMUTABLE');
        }
        const sample = await client.sample.findUnique({ where: { id: item.sampleId } });
        if (!sample) throw new TransitionError('Sample not found.', 404, 'SAMPLE_NOT_FOUND');
        rules.assertScope(actor, sample);
        let provenance = {};
        if (migrating) {
            provenance = require('./statusMigrationPlan').assertReviewedRow(options.migrationPlan, 'WorkItem', item, nextStatus, performedBy);
            rules.requireReason(reason);
        } else {
            const current = workflow.normalizeWorkItemState(item.status);
            if ((current !== nextStatus || options.action) && !assertActionEdge(item, sample, nextStatus, actor, reason, options)) {
                throw new TransitionError(`Illegal status transition: ${current} → ${nextStatus}.`, 409, 'ILLEGAL_STATUS_TRANSITION');
            }
            provenance = rules.holdData(item, nextStatus, actor, reason, 'WorkItem');
            if (['SUBMITTED', 'ACCEPTED'].includes(nextStatus) && !workflow.CLOSURE_TASK_ANALYSES.includes(item.analysis)) {
                await require('./resultEvidenceService').assertNoPreparationRevert(client, sample.id);
            }
        }
        if (item.status === nextStatus && !Object.keys(data).length && !migrating && !options.action) return item;
        const expected = options.expected || {};
        const isRepeatHistory = ['REANALYZE_BATCH', 'REJECT_BATCH'].includes(options.action) &&
            workflow.normalizeWorkItemState(item.status) === 'REPEAT_REQUIRED';
        const writeStatus = isRepeatHistory ? item.status : nextStatus;
        const reviewData = !migrating && !isRepeatHistory && ['ACCEPTED', 'REPEAT_REQUIRED', 'WAIVED'].includes(nextStatus)
            ? { reviewedBy: performedBy, reviewedAt: data.reviewedAt || new Date() } : {};
        const changed = await client.workItem.updateMany({
            where: { id: item.id, status: expected.status ?? item.status, version: expected.version === null ? null : (expected.version ?? item.version),
                ...(options.submissionId && { submissionId: options.submissionId }),
                ...(migrating && { legacyStatus: item.legacyStatus }) },
            data: { ...data, ...provenance, ...reviewData, status: writeStatus, updatedAt: new Date(),
                version: data.version ?? (item.version === null ? 1 : { increment: 1 }) }
        });
        if (changed.count !== 1) throw new TransitionError('Work item changed. Reload before retrying.', 409, options.conflictCode || 'WORKITEM_STATE_CHANGED');
        const updated = await client.workItem.findUnique({ where: { id: item.id } });
        await client.auditLog.create({ data: {
            id: randomUUID(), entity: 'WORKITEM', entityId: item.id,
            action: options.audit?.action || (migrating ? 'WORKITEM_STATUS_MIGRATED' : options.action || 'WORKITEM_STATUS_TRANSITION'),
            details: options.audit?.details || JSON.stringify({ from: item.status, to: nextStatus, reason: reason || null }),
            performedBy, sampleId: sample.id, labId: item.assignedLab || sample.assignedLab || null, analysisCode: item.analysis,
            before: JSON.stringify({ status: item.status, version: item.version, holdPriorStatus: item.holdPriorStatus ?? null, legacyStatus: item.legacyStatus ?? null }),
            after: JSON.stringify({ status: updated.status, version: updated.version, holdPriorStatus: updated.holdPriorStatus ?? null, legacyStatus: updated.legacyStatus ?? null }),
            timestamp: new Date()
        } });
        return updated;
    });
}

async function createWorkItem(data, actor, options = {}) {
    const performedBy = rules.actorName(actor);
    const status = data.status || 'NOT_ASSIGNED';
    if (options.context === 'fixture') {
        rules.assertFixtureContext();
        if (performedBy !== 'system:fixture' || !workflow.isValidWorkItemState(status)) {
            throw new TransitionError('Invalid workflow fixture actor or state.', 409, 'WORKFLOW_FIXTURE_REFUSED');
        }
    } else if (status !== 'NOT_ASSIGNED') {
        throw new TransitionError('A new work item must start at NOT_ASSIGNED.', 409, 'INITIAL_STATE_NOT_ALLOWED');
    }
    if (data.holdPriorStatus != null || data.legacyStatus != null) throw new TransitionError('Creation cannot set state provenance.', 400, 'STATE_METADATA_NOT_ALLOWED');
    return rules.inTransaction(options.tx, async client => {
        const sample = await client.sample.findUnique({ where: { id: data.sampleId } });
        if (!sample) throw new TransitionError('Sample not found.', 404, 'SAMPLE_NOT_FOUND');
        rules.assertScope(actor, sample);
        if (options.context !== 'fixture' && !workflow.CLOSURE_TASK_ANALYSES.includes(data.analysis)) {
            require('./resultEvidenceService').assertAmendable(sample);
        }
        const item = await client.workItem.create({ data: { ...data, status } });
        await client.auditLog.create({ data: {
            id: randomUUID(), entity: options.audit?.entity || 'WORKITEM', entityId: options.audit?.entityId || item.id,
            action: options.audit?.action || 'WORKITEM_CREATED', performedBy,
            details: options.audit?.details || JSON.stringify({ status, context: options.context || 'ordinary' }), sampleId: item.sampleId,
            labId: item.assignedLab || sample.assignedLab || null, analysisCode: item.analysis, timestamp: new Date()
        } });
        return item;
    });
}

module.exports = { transitionWorkItem, createWorkItem, assertActionEdge, TransitionError };
