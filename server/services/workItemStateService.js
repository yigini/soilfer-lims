const { randomUUID } = require('node:crypto');
const workflow = require('../workflowContract');
const { hasPermission } = require('../config/roles');
const rules = require('./workflowStateRules');
const { TransitionError } = rules;
const OPERATIONAL = Object.freeze(['DRYING', 'PREPARATION']);
const CONFIRMABLE = Object.freeze(['NOT_ASSIGNED', 'ASSIGNED', 'IN_PROGRESS', 'REPEAT_REQUIRED']);
const QC_REPEATABLE = Object.freeze(['NOT_ASSIGNED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'SUBMITTED', 'REPEAT_REQUIRED']);
const INTAKE_ACTION = Symbol('authorized intake work action');
const CANCELLABLE = Object.freeze(['NOT_ASSIGNED', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD']);
const CANCELLATION_CODES = Object.freeze({ cancelForIntakeUndo: 'INTAKE_UNDONE', cancelForIntakeRejection: 'INTAKE_REJECTED' });

async function hasIntakeEvidence(tx, item) {
    return Boolean(item.result?.trim() || await tx.result.count({ where: { sampleId: item.sampleId, param: item.analysis } }) ||
        await tx.spectralData.count({ where: { OR: [{ workItemId: item.id }, { sampleId: item.sampleId, workItemId: null }] } }) ||
        await tx.resultEvidenceEvent.count({ where: { sampleId: item.sampleId, result: { param: item.analysis } } }) ||
        await tx.workAttempt.count({ where: { workItemId: item.id } }) ||
        await tx.workItemDraft.count({ where: { workItemId: item.id } }));
}

function assertActionEdge(item, sample, nextStatus, actor, reason, options) {
    const current = workflow.normalizeWorkItemState(item.status);
    const operational = OPERATIONAL.includes(item.analysis);
    const action = options.action;
    if (nextStatus === 'CANCELLED') {
        if (options.intakeAction !== INTAKE_ACTION || !Object.hasOwn(CANCELLATION_CODES, action)) {
            throw new TransitionError('Use the named intake cancellation action.', 409, 'WORKITEM_CANCEL_ACTION_REQUIRED');
        }
        return CANCELLABLE.includes(current);
    }
    if (current === 'CANCELLED') {
        if (options.intakeAction !== INTAKE_ACTION || action !== 'reactivateCancelledIntakeWork' || nextStatus !== 'NOT_ASSIGNED') {
            throw new TransitionError('Cancelled work requires legal intake re-acceptance.', 409, 'WORKITEM_REACTIVATION_ACTION_REQUIRED');
        }
        return true;
    }
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
    if (Object.hasOwn(extraData, 'result')) throw new TransitionError('Result caches are controlled by resultWriteService.', 409, 'RESULT_CACHE_AUTHORITY_REQUIRED');
    const performedBy = rules.actorName(actor);
    const migrating = !!options.migrationPlan;
    const nextStatus = !migrating && requestedStatus === 'REANALYSIS_REQUIRED' ? 'REPEAT_REQUIRED' : requestedStatus;
    if (!migrating && workflow.isLegacyWorkItemState(nextStatus)) {
        throw new TransitionError(`Status '${nextStatus}' is a deprecated legacy status.`, 409, 'ILLEGAL_LEGACY_STATUS');
    }
    if (!migrating && !workflow.isValidWorkItemState(nextStatus)) {
        throw new TransitionError(`Status '${nextStatus}' cannot be written.`, 409, 'UNKNOWN_WORKITEM_STATUS');
    }
    const { result: _excludedResult, ...data } = rules.updateData(extraData, nextStatus, workflow.normalizeWorkItemState);
    if (['cancellationCode', 'cancellationReason', 'cancelledBy', 'cancelledAt'].some(key => Object.hasOwn(data, key))) {
        throw new TransitionError('Cancellation provenance is controlled by the intake action.', 400, 'STATE_METADATA_NOT_ALLOWED');
    }
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
        let gateAudit = {};
        if (migrating) {
            provenance = require('./statusMigrationPlan').assertReviewedRow(options.migrationPlan, 'WorkItem', item, nextStatus, performedBy);
            rules.requireReason(reason);
        } else {
            const current = workflow.normalizeWorkItemState(item.status);
            if (nextStatus === 'ASSIGNED') {
                if (!['ACCEPTED', 'PROCESSING'].includes(workflow.normalizeSampleState(sample.status))) {
                    throw new TransitionError('Accept the sample before assignment.', 409, 'SAMPLE_NOT_ASSIGNABLE');
                }
                await require('./sampleHoldService').assertNotHeld(client, sample);
            }
            if (current === 'COMPLETED' && nextStatus === 'IN_PROGRESS') rules.requireReason(reason);
            if ((current !== nextStatus || options.action) && !assertActionEdge(item, sample, nextStatus, actor, reason, options)) {
                throw new TransitionError(`Illegal status transition: ${current} → ${nextStatus}.`, 409, 'ILLEGAL_STATUS_TRANSITION');
            }
            if (nextStatus === 'CANCELLED') {
                const note = rules.requireReason(reason);
                if (await hasIntakeEvidence(client, item)) throw new TransitionError('Recorded work must be retained.', 409, 'INTAKE_UNDO_HAS_WORK', { blockingItemIds: [item.id] });
                provenance = { cancellationCode: CANCELLATION_CODES[options.action], cancellationReason: note, cancelledBy: performedBy, cancelledAt: new Date() };
            } else if (current === 'CANCELLED') {
                rules.requireReason(reason);
                if (!['INTAKE_UNDONE', 'INTAKE_REJECTED'].includes(item.cancellationCode)) {
                    throw new TransitionError('Legacy cancelled work needs manager review.', 409, 'WORKITEM_LEGACY_CANCELLED_CONFLICT', { workItemId: item.id });
                }
                if (await hasIntakeEvidence(client, item)) throw new TransitionError('Recorded work must be retained.', 409, 'INTAKE_UNDO_HAS_WORK', { blockingItemIds: [item.id] });
                provenance = { assignedTo: null, assignedBy: null, assignedAt: null, completedAt: null, submittedAt: null,
                    reviewedBy: null, reviewedAt: null, reviewDecision: null, holdPriorStatus: null };
            } else provenance = rules.holdData(item, nextStatus, actor, reason, 'WorkItem');
            if (['SUBMITTED', 'ACCEPTED'].includes(nextStatus) && !workflow.CLOSURE_TASK_ANALYSES.includes(item.analysis)) {
                await require('./resultEvidenceService').assertNoPreparationRevert(client, sample.id);
            }
            if (['IN_PROGRESS', 'COMPLETED', 'SUBMITTED', 'ACCEPTED'].includes(nextStatus) &&
                !workflow.CLOSURE_TASK_ANALYSES.includes(item.analysis)) {
                const gates = require('./gateEvidenceService');
                const required = item.analysis === 'DRYING' ? [] : item.analysis === 'PREPARATION' ? ['DRYING'] : ['DRYING', 'PREPARATION'];
                gateAudit = gates.auditEvidence(await gates.assertGateEvidence(client, sample, required));
                const engine = require('../utils/workflowEngine');
                const allItems = await client.workItem.findMany({ where: { sampleId: sample.id } });
                const prerequisite = await engine.withCatalogue(client, () => engine.checkPrerequisites(item, allItems, sample));
                if (!prerequisite.canStart) throw new TransitionError(prerequisite.reason, 409,
                    prerequisite.code || 'ANALYSIS_PREREQUISITE_BLOCKED', { blockedBy: prerequisite.blockedBy });
            }
        }
        if (item.status === nextStatus && !Object.keys(data).length && !migrating && !options.action) return item;
        const expected = options.expected || {};
        const isRepeatHistory = ['REANALYZE_BATCH', 'REJECT_BATCH'].includes(options.action) &&
            workflow.normalizeWorkItemState(item.status) === 'REPEAT_REQUIRED';
        const writeStatus = isRepeatHistory ? item.status : nextStatus;
        const reviewData = !migrating && !isRepeatHistory && ['ACCEPTED', 'REPEAT_REQUIRED', 'WAIVED'].includes(nextStatus)
            ? { reviewedBy: performedBy, reviewedAt: data.reviewedAt || new Date() } : {};
        const { result: _cache, ...changes } = { ...data, ...provenance, ...reviewData, status: writeStatus, updatedAt: new Date(),
            version: data.version ?? (item.version === null ? 1 : { increment: 1 }) };
        const changed = await client.workItem.updateMany({
            where: { id: item.id, status: expected.status ?? item.status, version: expected.version === null ? null : (expected.version ?? item.version),
                ...(options.submissionId && { submissionId: options.submissionId }),
                ...(migrating && { legacyStatus: item.legacyStatus }) },
            data: changes
        });
        if (changed.count !== 1) throw new TransitionError('Work item changed. Reload before retrying.', 409, options.conflictCode || 'WORKITEM_STATE_CHANGED');
        const updated = await client.workItem.findUnique({ where: { id: item.id } });
        await client.auditLog.create({ data: {
            id: randomUUID(), entity: 'WORKITEM', entityId: item.id,
            action: options.audit?.action || (migrating ? 'WORKITEM_STATUS_MIGRATED' : options.action || 'WORKITEM_STATUS_TRANSITION'),
            details: options.audit?.details || JSON.stringify({ from: item.status, to: nextStatus, reason: reason || null,
                ...(item.status === 'CANCELLED' && { cancellation: { code: item.cancellationCode, reason: item.cancellationReason, by: item.cancelledBy, at: item.cancelledAt } }) }),
            performedBy, sampleId: sample.id, labId: item.assignedLab || sample.assignedLab || null, analysisCode: item.analysis,
            before: JSON.stringify({ status: item.status, version: item.version, holdPriorStatus: item.holdPriorStatus ?? null, legacyStatus: item.legacyStatus ?? null }),
            after: JSON.stringify({ status: updated.status, version: updated.version, holdPriorStatus: updated.holdPriorStatus ?? null, legacyStatus: updated.legacyStatus ?? null, ...gateAudit }),
            timestamp: new Date()
        } });
        return updated;
    });
}

async function cancelIntakeWork(tx, { sampleId, actor, reason }, action) {
    rules.requireTransaction(tx);
    rules.requireReason(reason);
    if (!hasPermission(actor, action === 'cancelForIntakeUndo' ? 'APPROVE_RESULTS' : 'RECEIVE_SAMPLE')) {
        throw new TransitionError('Intake cancellation is not authorized.', 403, 'INTAKE_CANCEL_FORBIDDEN');
    }
    const sample = await tx.sample.findUnique({ where: { id: String(sampleId) } });
    if (!sample) throw new TransitionError('Sample not found.', 404, 'SAMPLE_NOT_FOUND');
    rules.assertScope(actor, sample);
    if (action === 'cancelForIntakeUndo' ? workflow.normalizeSampleState(sample.status) !== 'ACCEPTED' :
        !workflow.isValidSampleTransition(workflow.normalizeSampleState(sample.status), 'RECEIVED_REJECTED')) {
        throw new TransitionError('Sample is not eligible for this intake action.', 409, 'INTAKE_CANCEL_STATE_INVALID');
    }
    const items = await tx.workItem.findMany({ where: { sampleId: sample.id } }), blockingItemIds = [];
    for (const item of items) if (!CANCELLABLE.includes(workflow.normalizeWorkItemState(item.status)) || await hasIntakeEvidence(tx, item)) blockingItemIds.push(item.id);
    // Unlinked or historically mis-keyed specimen evidence also blocks the whole action.
    const specimenEvidence = await tx.result.count({ where: { sampleId: sample.id } }) || await tx.spectralData.count({ where: { sampleId: sample.id } }) ||
        await tx.resultEvidenceEvent.count({ where: { sampleId: sample.id } });
    if (blockingItemIds.length || specimenEvidence) throw new TransitionError('Intake has recorded work and cannot be cancelled.', 409, 'INTAKE_UNDO_HAS_WORK',
        { blockingItemIds: blockingItemIds.length ? blockingItemIds : items.map(item => item.id) });
    const cancelled = [];
    for (const item of items) cancelled.push(await transitionWorkItem(item.id, 'CANCELLED', actor, reason, {}, tx,
        { action, intakeAction: INTAKE_ACTION, expected: item }));
    return cancelled;
}

async function cancelForIntakeUndo(tx, options) { return cancelIntakeWork(tx, options, 'cancelForIntakeUndo'); }
async function cancelForIntakeRejection(tx, options) { return cancelIntakeWork(tx, options, 'cancelForIntakeRejection'); }

// Only sampleStateService calls this after its legal re-acceptance edge, inside
// that same transaction. The private capability cannot come from HTTP options.
async function reactivateCancelledIntakeWork(tx, { sampleId, previousSampleStatus, analyses, actor, reason }) {
    rules.requireTransaction(tx);
    if (!['EXPECTED', 'RECEIVED', 'RECEIVED_REJECTED'].includes(previousSampleStatus) || !hasPermission(actor, 'RECEIVE_SAMPLE')) {
        throw new TransitionError('Reactivation requires legal intake re-acceptance.', 409, 'WORKITEM_REACTIVATION_ACTION_REQUIRED');
    }
    const sample = await tx.sample.findUnique({ where: { id: String(sampleId) } });
    if (!sample || sample.status !== 'ACCEPTED') throw new TransitionError('Reactivation requires legal intake re-acceptance.', 409, 'WORKITEM_REACTIVATION_ACTION_REQUIRED');
    rules.assertScope(actor, sample);
    const items = await tx.workItem.findMany({ where: { sampleId: sample.id, status: 'CANCELLED', analysis: { in: analyses } } });
    const reactivated = [];
    for (const item of items) reactivated.push(await transitionWorkItem(item.id, 'NOT_ASSIGNED', actor, reason, {}, tx,
        { action: 'reactivateCancelledIntakeWork', intakeAction: INTAKE_ACTION, expected: item }));
    return reactivated;
}

async function createWorkItem(data, actor, options = {}) {
    rules.assertNoRelationWrites(data);
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
        const { result, ...creationData } = data;
        if (result !== undefined && options.context !== 'fixture') throw new TransitionError('New work requires its result recording workflow.', 409, 'RESULT_CACHE_AUTHORITY_REQUIRED');
        let item = await client.workItem.create({ data: { ...creationData, status } });
        if (result !== undefined) item = await require('./resultWriteService').writeFixtureCache(client, item, result, actor);
        await client.auditLog.create({ data: {
            id: randomUUID(), entity: options.audit?.entity || 'WORKITEM', entityId: options.audit?.entityId || item.id,
            action: options.audit?.action || 'WORKITEM_CREATED', performedBy,
            details: options.audit?.details || JSON.stringify({ status, context: options.context || 'ordinary' }), sampleId: item.sampleId,
            labId: item.assignedLab || sample.assignedLab || null, analysisCode: item.analysis, timestamp: new Date()
        } });
        return item;
    });
}

async function removeUnstartedWorkItems(tx, where, { actor, reason, code = 'WORKITEM_DELETED' }) {
    rules.requireTransaction(tx);
    const performedBy = rules.actorName(actor), note = rules.requireReason(reason);
    const items = await tx.workItem.findMany({ where });
    const labs = new Map();
    if (where.sampleId && (await tx.result.count({ where: { sampleId: where.sampleId } }) ||
        await tx.spectralData.count({ where: { sampleId: where.sampleId } }))) {
        throw new TransitionError('Recorded analytical evidence must be retained.', 409, 'CANNOT_DELETE_SAMPLE_WITH_RESULTS');
    }
    for (const item of items) {
        const sample = await tx.sample.findUnique({ where: { id: item.sampleId } });
        rules.assertScope(actor, sample);
        labs.set(item.id, sample?.assignedLab || sample?.labId || item.assignedLab || item.labId || null);
        if (!['NOT_ASSIGNED', 'ASSIGNED'].includes(item.status)) {
            throw new TransitionError('Only unstarted work can be removed.', 409, 'ACTIVE_WORK_IN_PROGRESS');
        }
        const recorded = !!item.result?.trim() || await tx.result.count({ where: { sampleId: item.sampleId, param: item.analysis } }) ||
            await tx.spectralData.count({ where: { workItemId: item.id } }) || await tx.workItemDraft.count({ where: { workItemId: item.id } });
        if (recorded) throw new TransitionError('Recorded analytical evidence must be retained.', 409, 'CANNOT_DELETE_SAMPLE_WITH_RESULTS');
    }
    for (const item of items) await tx.workItem.delete({ where: { id: item.id } });
    if (items.length) await tx.auditLog.create({ data: { id: randomUUID(), entity: 'WORKITEM', entityId: items.length === 1 ? items[0].id : 'BATCH',
        action: code, performedBy, details: note, timestamp: new Date(),
        sampleId: items.every(item => item.sampleId === items[0].sampleId) ? items[0].sampleId : null,
        analysisCode: items.every(item => item.analysis === items[0].analysis) ? items[0].analysis : null,
        labId: items.every(item => labs.get(item.id) === labs.get(items[0].id)) ? labs.get(items[0].id) : null,
        before: JSON.stringify(items.map(item => ({ id: item.id, status: item.status, sampleId: item.sampleId,
            analysisCode: item.analysis, labId: labs.get(item.id) }))) } });
    return { count: items.length };
}

module.exports = { transitionWorkItem, createWorkItem, assertActionEdge, TransitionError, removeUnstartedWorkItems,
    cancelForIntakeUndo, cancelForIntakeRejection, reactivateCancelledIntakeWork };
