const rules=require('./workflowStateRules');

async function pendingDerivedResults(tx,item,attemptId) {
    rules.requireTransaction(tx);
    const rows=await tx.result.findMany({where:{attemptId,sampleId:item.sampleId,param:'TEXTURE',provenance:'DERIVED',isCurrent:true,supersededBy:null}});
    const events=await tx.auditLog.findMany({where:{entity:'WORK_ATTEMPT',entityId:attemptId,sampleId:item.sampleId,
        action:{in:['DERIVED_RECALCULATED','ACCEPTED']}}});
    const recalculated=new Set(),accepted=new Set();
    for(const event of events) {
        let details;try{details=JSON.parse(event.details);}catch(_){throw new rules.TransitionError('Derived review evidence is invalid.',409,'WORK_ATTEMPT_EVENT_INVALID');}
        if(!Array.isArray(details.newResultIds))throw new rules.TransitionError('Derived review evidence is invalid.',409,'WORK_ATTEMPT_EVENT_INVALID');
        for(const id of details.newResultIds)(event.action==='ACCEPTED'?accepted:recalculated).add(id);
    }
    return rows.filter(row=>recalculated.has(row.id) && !accepted.has(row.id));
}

async function assertPendingDerivedEvent(tx,item,eventId,resultId) {
    rules.requireTransaction(tx);
    const event=await tx.auditLog.findUnique({where:{id:eventId}});
    const attempt=event && await tx.workAttempt.findUnique({where:{id:event.entityId}});
    if(item.analysis!=='TEXTURE' || !event || event.entity!=='WORK_ATTEMPT' || event.action!=='DERIVED_RECALCULATED' ||
        !require('./workAttemptEventService').attemptEventsInTransaction(tx).some(row=>row.id===event.id) ||
        event.sampleId!==item.sampleId || attempt?.workItemId!==item.id || !['SUBMITTED','ACCEPTED'].includes(attempt.status) ||
        !(await pendingDerivedResults(tx,item,attempt.id)).some(row=>row.id===resultId)) {
        throw new rules.TransitionError('A current derived recalculation requires its review evidence.',409,'WORK_ATTEMPT_TRANSITION_REFUSED');
    }
    return attempt;
}

async function resetDerivedReview(tx,item,attempt,event,result,actor) {
    rules.requireTransaction(tx);
    if(!['SUBMITTED','ACCEPTED'].includes(attempt.status))return item;
    return require('./workItemStateService').transitionWorkItem(item.id,'SUBMITTED',actor,'Review recalculated texture from changed source fractions',
        {reviewedBy:null,reviewedAt:null,reviewDecision:null},tx,{expected:item,action:'DERIVED_RECALCULATED',
            derivedEventId:event.id,derivedResultId:result.id});
}

async function assertDerivedReReview(tx,item,attempt,reviewDecisionId) {
    rules.requireTransaction(tx);
    const decision=reviewDecisionId && await tx.reviewDecision.findUnique({where:{id:reviewDecisionId}});
    const pending=await pendingDerivedResults(tx,item,attempt.id);
    if(item.analysis!=='TEXTURE' || attempt.status!=='ACCEPTED' || !pending.length || !decision ||
        !require('./reviewAttemptService').reviewDecisionCreatedInTransaction(tx,reviewDecisionId) ||
        decision.workItemId!==item.id || decision.sampleId!==item.sampleId || decision.attemptId!==attempt.id || decision.decision!=='ACCEPT' ||
        await tx.auditLog.count({where:{entity:'WORK_ATTEMPT',entityId:attempt.id,action:'ACCEPTED',details:{contains:JSON.stringify(reviewDecisionId)}}})) {
        throw new rules.TransitionError('Re-acceptance requires a pending derived Result and a new review decision.',409,'WORK_ATTEMPT_TRANSITION_REFUSED');
    }
    return pending.map(row=>row.id).sort();
}

module.exports={assertPendingDerivedEvent,resetDerivedReview,assertDerivedReReview};
