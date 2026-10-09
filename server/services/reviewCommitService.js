const { randomUUID } = require('crypto');
const workflow = require('../workflowContract');
const { transitionWorkItem } = require('./workItemStateService');

function itemStateError(item) {
    return Object.assign(new Error(`Work item ${item.id} is no longer eligible for this review. Only submitted work items can be reviewed.`), {
        statusCode: 409, code: 'ITEM_NOT_SUBMITTED', workItemId: item.id
    });
}

function assertReviewable(item, status, sample = item.sample) {
    if (sample && workflow.normalizeWorkItemState(status) === 'REPEAT_REQUIRED'
        && !workflow.CLOSURE_TASK_ANALYSES.includes(item.analysis)) {
        require('./resultEvidenceService').assertAmendable(sample);
    }
    const closure = workflow.CLOSURE_TASK_ANALYSES.includes(item.analysis);
    const allowed = closure
        ? (status === workflow.WORK_ITEM_STATES.ACCEPTED
            ? ['PENDING', 'NOT_ASSIGNED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'SUBMITTED'].includes(item.status)
            : workflow.isValidWorkItemTransition(item.status, status))
        : item.status === workflow.WORK_ITEM_STATES.SUBMITTED && workflow.isValidWorkItemTransition(item.status, status);
    if (!allowed) throw itemStateError(item);
}

// The guarded attempt handoff and WorkItem CAS commit together. A refused
// CAS or later decision/audit rolls back every attempt, event and pointer.
async function commitReview(prisma, item, status, user, data, operations, submissionId, audit = {}) {
    status = workflow.normalizeWorkItemState(status);
    try {
        return await require('./workflowStateRules').inTransaction(prisma,async tx => {
            const current = await tx.workItem.findUnique({ where: { id: item.id } });
            if (submissionId && current?.submissionId !== submissionId) throw Object.assign(itemStateError(item), { code: 'ITEM_NOT_IN_SUBMISSION' });
            if (!current || current.status !== item.status || current.version !== item.version) throw itemStateError(item);
            const sample = await tx.sample.findUnique({ where: { id: current.sampleId } });
            require('./workflowStateRules').assertScope(user, sample);
            assertReviewable(current, status, sample);
            const returned = status === 'REPEAT_REQUIRED' && !workflow.CLOSURE_TASK_ANALYSES.includes(current.analysis);
            if (returned) require('./resultEvidenceService').assertAmendable(sample);
            const measured=!require('./workItemKinds').isNonMeasurement(current);
            let repeatRequest, repeatPlan;
            if(returned && measured) {
                repeatRequest=require('./workRepeatContract').repeatRequest({reason:audit.reasonCode,note:audit.note || audit.reason || data.reanalysisReason});
                repeatPlan=await require('./workRepeatService').preflightRepeat(tx,current,sample,user,repeatRequest,audit.attemptId);
                data={...data,submissionId:null,batchId:null,rackPosition:null,submittedAt:null,completedAt:null};
            }
            const qcGate = require('./qcGateService');
            const qcRows = status === 'ACCEPTED' ? await qcGate.requireAcceptance([{ ...current, sample }], audit.qcAcknowledgement, tx) : [];
            const history = typeof data.history === 'string' ? JSON.parse(data.history) : data.history;
            const reason = audit.reason || data.reanalysisReason || data.waiveReason || history?.at(-1)?.reason || history?.at(-1)?.note || null;
            if (qcRows.some(row => qcGate.decision(row.gate).acknowledgementRequired)) {
                const acknowledgements = qcRows.filter(row => qcGate.decision(row.gate).acknowledgementRequired).map(row => ({
                    action: 'QC_GATE_ACKNOWLEDGED', resultId: row.resultId || null, reason: audit.qcAcknowledgement.reason.trim(),
                    gate: row.gate, changedBy: user.username, timestamp: new Date().toISOString() }));
                data = { ...data, history: JSON.stringify([...require('./workflowStateRules').requireHistory(history), ...acknowledgements]) };
            }
            if(returned && measured) {
                // Pin6069548259: the canonical child and immutable event must
                // already exist before the accepted-QC pointer can move.
                await require('./workRepeatService').reserveRepeat(tx,current,sample,user,repeatRequest,repeatPlan);
            }
            await transitionWorkItem(item.id, status, user, reason, data, tx, {
                expected: item, submissionId, conflictCode: 'ITEM_NOT_SUBMITTED',
                action: workflow.CLOSURE_TASK_ANALYSES.includes(item.analysis) ? 'CLOSURE_REVIEW' : 'REVIEW',
                audit: { action: audit.action || 'REVIEW', details: audit.details || `Work Item ${status} by ${user.username}` }
            });
            await qcGate.recordAcknowledgements(qcRows, audit.qcAcknowledgement, user, tx);
            const decisions = await operations(tx);
            if(status==='ACCEPTED' && measured) {
                const selected=(Array.isArray(decisions)?decisions:[decisions]).find(row=>row?.workItemId===current.id && row.decision==='ACCEPT');
                if(!selected?.attemptId)throw Object.assign(new Error('Acceptance must identify its ReviewDecision attempt.'),{statusCode:409,code:'REVIEW_DECISION_REQUIRED'});
                await require('./workAttemptEventService').transitionAttempt(tx,current,selected.attemptId,'ACCEPTED',user,{reviewDecisionId:selected.id});
            }
            if (returned && sample.status === 'SUBMITTED_FULL') {
                const decision = (Array.isArray(decisions) ? decisions : [decisions]).find(row =>
                    row?.workItemId === current.id && row.decision === 'RETURN');
                if (!decision?.id) throw Object.assign(new Error('The repeat review must include its ReviewDecision.'), {
                    statusCode: 409, code: 'REVIEW_DECISION_REQUIRED' });
                const entry = { status: 'PROCESSING', action: 'REVIEW_RETURNED', workItemId: current.id,
                    reviewDecisionId: decision.id, reason: decision.reason, changedBy: user.username, timestamp: new Date().toISOString() };
                await require('./sampleStateService').transitionSample(sample.id, 'PROCESSING', user, decision.reason, {
                    history: JSON.stringify([...require('./workflowStateRules').requireHistory(sample.history), entry])
                }, tx, { expectedStatus: 'SUBMITTED_FULL', action: 'REVIEW_RETURNED',
                    details: JSON.stringify(entry), after: JSON.stringify({ status: 'PROCESSING', reviewDecisionId: decision.id,
                        workItemId: current.id, reason: decision.reason }) });
            }
            return tx.workItem.findUnique({ where: { id: item.id } });
        });
    } catch (error) {
        if (['P2025', 'P2034', 'STATE_CHANGED'].includes(error.code)) throw itemStateError(item);
        if(status==='REPEAT_REQUIRED')throw require('./workRepeatBatchService').mapRepeatRunError(error);
        throw error;
    }
}

async function reconcileSubmission(prisma, submissionId, user, results, errors = []) {
    return require('./workflowStateRules').inTransaction(prisma,async tx => {
        const submission = await tx.submission.findUnique({ where: { id: submissionId } });
        if (!submission) return;
        const ids = typeof submission.workItemIds === 'string' ? JSON.parse(submission.workItemIds) : (submission.workItemIds || []);
        const committed = results.filter(row => ids.includes(row.workItemId));
        if (!committed.length) return;
        const refused = errors.filter(row => ids.includes(row.workItemId));
        const items = await tx.workItem.findMany({ where: { id: { in: ids }, submissionId }, select: { status: true } });
        const reviewed = items.every(item => ['ACCEPTED', 'REPEAT_REQUIRED', 'WAIVED'].includes(workflow.normalizeWorkItemState(item.status)));
        const now = new Date();
        await tx.submission.update({ where: { id: submissionId }, data: {
            status: reviewed ? 'REVIEWED' : 'PARTIALLY_REVIEWED', reviewedBy: user.username, reviewedAt: now,
            reviewNote: committed.map(row => `${row.workItemId}: ${row.decision}`).join(' | ')
        } });
        await tx.auditLog.create({ data: {
            id: randomUUID(), entity: 'SUBMISSION', entityId: submissionId,
            action: 'SUBMISSION_REVIEWED', performedBy: user.username, timestamp: now, sampleId: String(submission.sampleId),
            details: JSON.stringify({ committedCount: committed.length, refusedCount: refused.length,
                results: committed, errors: refused })
        } });
    });
}

module.exports = { assertReviewable, commitReview, reconcileSubmission };
