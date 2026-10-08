const rules = require('./workflowStateRules');
const { hasPermission } = require('../config/roles');
const { isNonMeasurement } = require('./workItemKinds');

// Pin6055535948: a review identifies measured evidence, never a latest row.
async function resolveReviewAttempt(tx,item,decision,requestedAttemptId) {
    rules.requireTransaction(tx);
    if (isNonMeasurement(item)) return null;
    const attempts=await tx.workAttempt.findMany({where:{workItemId:item.id},select:{id:true}});
    // Result.attemptId is guarded by the existing additive SQL link authority;
    // it is deliberately a scalar in the current Prisma model.
    const results=await tx.result.findMany({where:{attemptId:{in:attempts.map(row=>row.id)},isCurrent:true},select:{attemptId:true}});
    const currentIds=new Set(results.map(row=>row.attemptId));
    const candidates=attempts.filter(row=>currentIds.has(row.id));
    if (requestedAttemptId != null) {
        if (typeof requestedAttemptId!=='string' || !candidates.some(row=>row.id===requestedAttemptId)) {
            throw new rules.TransitionError('Choose a current attempt belonging to this work item.',409,'REVIEW_ATTEMPT_INVALID',{workItemIds:[item.id]});
        }
        return requestedAttemptId;
    }
    if (candidates.length===1) return candidates[0].id;
    if (decision==='OMIT' && attempts.length===0) return null;
    throw new rules.TransitionError('Choose the attempt to review.',409,'REVIEW_ATTEMPT_REQUIRED',{workItemIds:[item.id]});
}

async function scopedItem(tx,workItemId,actor) {
    rules.requireTransaction(tx);
    if (!hasPermission(actor,'APPROVE_RESULTS')) {
        throw new rules.TransitionError('Review is not authorized.',403,'REVIEW_FORBIDDEN');
    }
    const item=await tx.workItem.findUnique({where:{id:workItemId}});
    if (!item) throw new rules.TransitionError('Work item not found.',404,'WORK_ITEM_NOT_FOUND');
    const sample=await tx.sample.findUnique({where:{id:item.sampleId}});
    if (!sample) throw new rules.TransitionError('Sample not found.',404,'SAMPLE_NOT_FOUND');
    rules.assertScope(actor,sample);
    return item;
}

async function preflightReviewAttempts(tx,selections,actor) {
    const resolved=new Map(),failures=[];
    for (const selection of selections) {
        const item=await scopedItem(tx,selection.workItemId,actor);
        try {
            resolved.set(item.id,await resolveReviewAttempt(tx,item,selection.decision,selection.attemptId));
        } catch (error) {
            if (!['REVIEW_ATTEMPT_REQUIRED','REVIEW_ATTEMPT_INVALID'].includes(error.code)) throw error;
            failures.push({workItemId:item.id,code:error.code});
        }
    }
    if (failures.length) throw new rules.TransitionError('Select valid attempts for every review before saving.',409,
        failures.some(row=>row.code==='REVIEW_ATTEMPT_INVALID')?'REVIEW_ATTEMPT_INVALID':'REVIEW_ATTEMPT_REQUIRED',
        {workItemIds:failures.map(row=>row.workItemId),failures});
    return resolved;
}

async function createReviewDecision(tx,data,actor) {
    const item=await scopedItem(tx,data.workItemId,actor);
    if (data.sampleId!==item.sampleId) {
        throw new rules.TransitionError('Review and work item must share a sample.',409,'REVIEW_ATTEMPT_INVALID',{workItemIds:[item.id]});
    }
    const attemptId=await resolveReviewAttempt(tx,item,data.decision,data.attemptId);
    return tx.reviewDecision.create({data:{...data,attemptId}});
}

async function inReviewTransaction(db,selections,actor,execute) {
    return rules.inTransaction(db,async tx=>{
        const attempts=await preflightReviewAttempts(tx,selections,actor);
        return execute(tx,attempts);
    });
}

module.exports={resolveReviewAttempt,preflightReviewAttempts,createReviewDecision,inReviewTransaction};
