const { randomUUID, createHash } = require('node:crypto');
const rules = require('./workflowStateRules');
const { hasPermission } = require('../config/roles');
const { isNonMeasurement } = require('./resultEntryPolicy');
const { parseJson, configurationIssues } = require('./cataloguePolicy');
const { isAvailable } = require('./methodResolution');
const { evaluateExecutionReadiness } = require('./workbenchReadinessService');
const { getNumberFormat } = require('./numberFormatService');
const { validateNumericMethod, validateTextureFractions } = require('./workbenchValidationService');
const { TransitionError } = rules;
const { canonicalWorkItemWhere } = require('./workAttemptContract');
const { allocateExecution,insertExecution } = require('./workAttemptWriteService');
const calculationService = require('./resultCalculationService');
const TEXTURE_ANALYSES = new Set(['TEXTURE', 'SAND', 'SILT', 'CLAY', 'pSA', 'PSA', 'textureSum']);
const FRACTIONS = ['SAND', 'SILT', 'CLAY'];
const ATTEMPT_ERRORS = ['RESULT_ATTEMPT_NOT_FOUND', 'RESULT_ATTEMPT_SAMPLE_MISMATCH', 'RESULT_ATTEMPT_REFERENCED'];

// Request data never supplies Result identity, parser evidence or provenance.
// batchId is retained only to compare with the server-derived batch in context.
function selectMeasurement(measurement) {
    if (!measurement || typeof measurement !== 'object') return measurement;
    return Object.fromEntries(['param', 'value', 'unit', 'methodologyId', 'equipmentId', 'basis', 'overrideReason', 'overrideRequestId', 'replicateNo', 'batchId', 'calculation']
        .filter(key => Object.hasOwn(measurement, key)).map(key => [key, measurement[key]]));
}

function writeOptions(options) {
    if (!['measurement', 'legacy-import', 'spectral-prediction'].includes(options.source || 'measurement')) {
        throw new TransitionError('Use the authorized result workflow.', 409, 'RESULT_SOURCE_FORBIDDEN');
    }
    const measurement = selectMeasurement(options.measurement);
    if (options.syncResult) {
        if (options.source && options.source !== 'measurement') throw new TransitionError('Sync cannot change result provenance.', 409, 'RESULT_SOURCE_FORBIDDEN');
        measurement.id = options.syncResult.id;
        measurement.flags = options.syncResult.flags;
    }
    return { ...options, measurement };
}

function mapResultWriteError(error) {
    const message = `${error.message || ''} ${JSON.stringify(error.meta || {})}`;
    const code = ATTEMPT_ERRORS.find(value => message.includes(value));
    return code ? new TransitionError('The database refused an invalid result attempt link.', 409, code) : rules.mapStateError(error);
}

async function recordedExecution(db, item, param) {
    const attempts=await db.workAttempt.findMany({where:{workItemId:item.id}});
    const open=attempts.filter(row=>row.status==='OPEN');
    for(const child of open){
        const parent=attempts.find(row=>row.id===child.parentAttemptId);
        if(parent?.status==='ACCEPTED'&&!await require('./amendmentReopenWitness').readAmendmentReopenWitness(db,{item,parent,child}))
            throw new TransitionError('Use the correction route or request a reasoned repeat.',409,'ATTEMPT_CORRECTION_REQUIRED');
    }
    if(open.length)return null;
    const results=await db.result.findMany({where:{sampleId:item.sampleId,param,isCurrent:true,supersededBy:null,
        attemptId:{in:attempts.map(row=>row.id)}}});
    if(!results.length)return null;
    const ids=new Set(results.map(row=>row.attemptId));
    let attempt=ids.size===1 ? attempts.find(row=>row.id===results[0].attemptId) : null;
    if (!attempt && ids.size === 2) {
        // Pin6070797814: a partially filled replacement may finish its
        // parent's replica set. Prove the exact parent/child relationship;
        // do not select a latest attempt or filter review/report candidates.
        const replacements=[];
        for(const child of attempts.filter(row=>ids.has(row.id)&&row.status==='RECORDED'&&row.parentAttemptId&&ids.has(row.parentAttemptId))){
            const parent=attempts.find(row=>row.id===child.parentAttemptId);
            if(parent&&(['QUESTIONED','INVALIDATED'].includes(parent.status)||parent.status==='ACCEPTED'&&
                await require('./amendmentReopenWitness').readAmendmentReopenWitness(db,{item,parent,child})))replacements.push(child);
        }
        if (replacements.length === 1) attempt = replacements[0];
    }
    if(!attempt || attempt.status!=='RECORDED' || ['SUBMITTED','ACCEPTED'].includes(item.status)) {
        throw new TransitionError('Use the correction route or request a reasoned repeat.',409,'ATTEMPT_CORRECTION_REQUIRED');
    }
    return {attempt,results:results.filter(row=>row.attemptId===attempt.id)};
}

// #194 pin6079078551: one read-only resolver for recording, readiness and
// queue context. Retained WorkItem equipment and historical evidence stay put.
async function resolveResultRunContext(db, item, { batchId = item?.batchId ?? null, equipmentId } = {}) {
    const context = { equipmentId: equipmentId || item?.equipmentId || null,
        instrumentSource: 'WORK_ITEM', frozenMethodRevision: null };
    if (!batchId || !item) return context;
    const batch = await db.batch.findUnique({ where: { id: batchId }, select: {
        startedAt: true, instrumentId: true, analytes: { select: { analysisCode: true, provenance: true, criteriaSnapshot: true } }
    } });
    if (!batch?.startedAt || !batch.analytes.length || batch.analytes.some(row => row.provenance !== 'NATIVE')) return context;
    const analyte = batch.analytes.find(row => row.analysisCode === item.analysis);
    context.frozenMethodRevision = parseJson(analyte?.criteriaSnapshot, {}).methodRevision || null;
    if (batch.instrumentId == null) return context;
    if (equipmentId != null && equipmentId !== batch.instrumentId) {
        throw new TransitionError('Use the instrument frozen on this run.', 409, 'RESULT_INSTRUMENT_MISMATCH');
    }
    return { ...context, equipmentId: batch.instrumentId, instrumentSource: 'RUN' };
}

// The HTTP preflight and the transactional writer use the same ownership
// rule. The transaction rechecks it; this read-only preflight grants no write.
async function assertRecordedResultSave(db,sample,measurements) {
    if(!Array.isArray(measurements))return;
    for(const measurement of measurements) {
        if(!measurement || typeof measurement.param!=='string')continue;
        const items=await db.workItem.findMany({where:canonicalWorkItemWhere(sample.id,measurement.param)});
        for(const item of items) {
            const recorded=await recordedExecution(db,item,measurement.param);
            if(!recorded)continue;
            if(recorded.results.some(row=>row.replicateNo===Number(measurement.replicateNo ?? 1))) {
                throw new TransitionError('Use the correction route or request a reasoned repeat.',409,'ATTEMPT_CORRECTION_REQUIRED');
            }
            const methodId=item.methodologyId || measurement.methodologyId || null;
            const batchId=item.batchId ?? null;
            const { equipmentId }=await resolveResultRunContext(db,item,{batchId,equipmentId:measurement.equipmentId});
            if(recorded.attempt.qcBatchId!==batchId || recorded.results.some(row=>row.batchId!==batchId) ||
                recorded.results.some(row=>row.methodologyId!==methodId || row.equipmentId!==equipmentId) ||
                recorded.attempt.instrumentId!==equipmentId || measurement.methodologyId && measurement.methodologyId!==methodId) {
                throw new TransitionError('Use the frozen method and instrument for an absent replicate.',409,'ATTEMPT_CONTEXT_MISMATCH');
            }
        }
    }
}

async function context(tx, { sampleId, workItemId, attemptId = null, actor, measurement, source = 'measurement', allowRecordedReplicates = false }) {
    rules.requireTransaction(tx);
    if (!measurement || typeof measurement.param !== 'string' || !measurement.param) throw new TransitionError('Choose a parameter.', 400, 'RESULT_PARAMETER_REQUIRED');
    if (measurement.flags != null && !Array.isArray(measurement.flags)) throw new TransitionError('Result flags must be an array.', 400, 'RESULT_FLAGS_INVALID');
    if (measurement.overrideReason != null && typeof measurement.overrideReason !== 'string') throw new TransitionError('Override reason must be text.', 400, 'RESULT_OVERRIDE_INVALID');
    const performedBy = rules.actorName(actor);
    const sample = await tx.sample.findUnique({ where: { id: sampleId } });
    if (!sample) throw new TransitionError('Sample not found.', 404, 'SAMPLE_NOT_FOUND');
    rules.assertScope(actor, sample);
    const importing = source === 'legacy-import';
    if (!hasPermission(actor, importing ? 'RECEIVE_SAMPLE' : 'ENTER_RESULTS') &&
        !(source==='derived' && hasPermission(actor,'APPROVE_RESULTS'))) {
        throw new TransitionError('Result recording is not authorized.', 403, 'RESULT_WRITE_FORBIDDEN');
    }
    const attempt = attemptId ? await tx.workAttempt.findUnique({ where: { id: attemptId }, include: { workItem: true } }) : null;
    if (attemptId && !attempt) throw new TransitionError('Result attempt not found.', 409, 'RESULT_ATTEMPT_NOT_FOUND');
    let item = workItemId ? await tx.workItem.findUnique({ where: { id: workItemId }, include: { sample: true } })
        : attempt?.workItem || await tx.workItem.findFirst({ where: canonicalWorkItemWhere(sampleId,measurement.param), include: { sample: true } });
    if (workItemId && !item) throw new TransitionError('Work item not found.', 404, 'WORK_ITEM_NOT_FOUND');
    if (!item && !importing) throw new TransitionError('Reconcile the order before recording this parameter.',409,'RESULT_WORKITEM_REQUIRED');
    if (item && item.sampleId !== sampleId || attempt && (attempt.workItem.sampleId !== sampleId || item && attempt.workItemId !== item.id)) {
        throw new TransitionError('Result, attempt and work item must share a sample.', 409, 'RESULT_ATTEMPT_SAMPLE_MISMATCH');
    }
    if (item && isNonMeasurement(item) || isNonMeasurement({ analysis: measurement.param })) {
        throw new TransitionError('Use the non-measurement evidence workflow.', 409, 'OPERATIONAL_SCALAR_FORBIDDEN');
    }
    // Pin6069938801: only a single current RECORDED execution may receive
    // an absent replicate. An OPEN reasoned repeat takes its normal first fill.
    let recordedAttempt = null, recordedResults = [];
    if (allowRecordedReplicates && item && source !== 'legacy-import' &&
        source !== 'derived') {
        const recorded=await recordedExecution(tx,item,measurement.param);
        if(recorded) {
            recordedAttempt=recorded.attempt;recordedResults=recorded.results;
            if (attemptId && attemptId !== recordedAttempt.id) throw new TransitionError('Choose the current recorded execution.',409,'ATTEMPT_CONTEXT_MISMATCH');
        }
    }
    if (recordedAttempt && (recordedAttempt.qcBatchId !== (item?.batchId ?? null) ||
        recordedResults.some(row => row.batchId !== recordedAttempt.qcBatchId))) {
        throw new TransitionError('Use the batch frozen on the recorded attempt.',409,'ATTEMPT_CONTEXT_MISMATCH');
    }
    if (attempt?.qcBatchId && item?.batchId && attempt.qcBatchId !== item.batchId) {
        throw new TransitionError('Attempt and work item batches disagree.', 409, 'RESULT_BATCH_CONFLICT');
    }
    const batchId = attempt?.qcBatchId ?? item?.batchId ?? null;
    const runContext = await resolveResultRunContext(tx, item, { batchId, equipmentId: measurement.equipmentId });
    if (Object.hasOwn(measurement, 'batchId') && measurement.batchId !== batchId) {
        throw new TransitionError('Supplied result batch differs from the server batch.', 409, 'RESULT_BATCH_MISMATCH');
    }
    const replicateNo = Number(measurement.replicateNo ?? 1);
    if (!Number.isInteger(replicateNo) || replicateNo < 1) throw new TransitionError('Replicate number must be a positive integer.', 400, 'RESULT_REPLICATE_INVALID');
    const labId = sample.assignedLab || item?.assignedLab || sample.labId;
    const methodId = item?.methodologyId || measurement.methodologyId || null;
    const equipmentId = runContext.equipmentId;
    if (recordedAttempt && (recordedResults.some(row => row.methodologyId !== methodId || row.equipmentId !== equipmentId) ||
        recordedAttempt.instrumentId !== equipmentId || measurement.methodologyId && measurement.methodologyId !== methodId)) {
        throw new TransitionError('Use the instrument and method frozen on the recorded attempt.',409,'ATTEMPT_CONTEXT_MISMATCH');
    }
    if (item?.methodologyId && measurement.methodologyId && measurement.methodologyId !== item.methodologyId) {
        throw new TransitionError('Use the assigned method.', 409, 'RESULT_METHOD_MISMATCH');
    }
    const analysisCode = item?.analysis || measurement.param;
    const analysis = await tx.analysis.findUnique({ where: { code: analysisCode } });
    if (!analysis || analysis.labId && analysis.labId !== labId) throw new TransitionError('Parameter is unavailable in this laboratory.', 409, 'RESULT_ANALYSIS_UNAVAILABLE');
    const issues = configurationIssues(analysis);
    if (issues.length) throw new TransitionError(issues.join(' '), 409, 'RESULT_CONFIGURATION_INVALID');
    const method = methodId ? await tx.methodology.findUnique({ where: { id: methodId } }) : null;
    if (methodId && !isAvailable(method, analysisCode, labId)) throw new TransitionError('Method belongs to another parameter or laboratory.', 409, 'RESULT_METHOD_MISMATCH');
    if (recordedAttempt && recordedAttempt.executedMethodRevision !== (method?.version == null ? null : String(method.version))) {
        throw new TransitionError('The recorded method revision differs; request a repeat.',409,'ATTEMPT_CONTEXT_MISMATCH');
    }
    if (runContext.frozenMethodRevision && method?.version !== runContext.frozenMethodRevision.version) {
        throw new TransitionError('The method revision changed after run start; use a new run.',409,'RESULT_METHOD_REVISION_CHANGED');
    }
    // #182 pin 6005018712: historical imports have no work to execute. An
    // existing canonical item must satisfy the same commit rules as every path.
    if (!importing || item) {
        require('./resultEvidenceService').assertAmendable(sample);
        if (item) {
            if (['COMPLETED', 'SUBMITTED', 'ACCEPTED', 'WAIVED', 'CANCELLED', 'AWAITING_VERIFICATION'].includes(item.status) && source !== 'derived' &&
                !(recordedAttempt && item.status === 'COMPLETED')) {
                throw new TransitionError('Recorded or sealed work requires its correction workflow.', 409, 'RESULT_WORKITEM_SEALED');
            }
            item = { ...item, sample, equipmentId };
        }
    }
    return { sample, item, attemptId, batchId, replicateNo, performedBy, labId, methodId, analysis, method, source,
        basis: ['AIR_DRY', 'OVEN_DRY', 'FIELD_MOIST'].includes(measurement.basis) ? measurement.basis : 'AIR_DRY',
        equipmentId, equipmentReadiness:null,equipmentReadinessText:null, recordedAttempt, recordedResults };
}

async function validateExecutionReadiness(tx,ctx) {
    if (!ctx.item) return;
    const ready=await evaluateExecutionReadiness(tx,ctx.item,ctx.actor);
    if (!ready.isReady) throw new TransitionError(ready.reasons.join('; '),409,
        ready.blockers[0] || 'EXECUTION_BLOCKED',{equipmentBlocked:ready.equipmentBlocked});
    ctx.equipmentReadiness=ctx.source==='derived'?null:ready.equipmentSnapshot;
    ctx.equipmentReadinessText=ctx.equipmentReadiness?JSON.stringify(ctx.equipmentReadiness):null;
}

async function appendResult(tx, ctx, measurement, values, now) {
    const id = measurement.id || randomUUID();
    let targetId = ctx.correctionTargetId, targetUpdatedAt = ctx.correctionOriginalUpdatedAt;
    if (!targetId && ctx.attemptId) {
        const child = await tx.workAttempt.findUnique({ where: { id: ctx.attemptId } });
        if (child?.parentAttemptId) {
            const parent=await tx.workAttempt.findUnique({where:{id:child.parentAttemptId}});
            if(parent?.status==='ACCEPTED'&&!await require('./amendmentReopenWitness').readAmendmentReopenWitness(tx,
                {item:ctx.item,parent,child,replicateNo:ctx.replicateNo}))
                throw new TransitionError('Use the correction route or request a reasoned repeat.',409,'ATTEMPT_CORRECTION_REQUIRED');
            const current = await tx.result.findMany({ where: { sampleId: ctx.sample.id, param: measurement.param,
                replicateNo: ctx.replicateNo, isCurrent: true } });
            if (current.length > 1 || current.some(row => row.attemptId !== child.parentAttemptId)) {
                throw new TransitionError('The replacement replica does not belong to its parent.',409,'ATTEMPT_CONTEXT_MISMATCH');
            }
            if (current.length === 1) { targetId = current[0].id; targetUpdatedAt = current[0].updatedAt; }
        }
    }
    const superseded=await tx.result.updateMany({ where: { sampleId: ctx.sample.id, param: measurement.param, replicateNo: ctx.replicateNo, isCurrent: true,
        ...(targetId && { id: targetId }), ...(ctx.correctionTargetId && { attemptId: ctx.attemptId }) },
        data: { isCurrent: false, supersededBy: id, ...(targetId && {updatedAt:targetUpdatedAt}) } });
    if(targetId && superseded.count!==1)throw new TransitionError('The superseded Result changed; reload before retrying.',409,
        ctx.correctionTargetId?'ATTEMPT_CORRECTION_TARGET_INVALID':'ATTEMPT_CONTEXT_MISMATCH');
    const { approvedRequest, ...storedValues } = values;
    let row;
    try {
        row = await tx.result.create({ data: { id, sampleId: ctx.sample.id, param: measurement.param,
            ...storedValues, basis: ctx.basis, methodologyId: ctx.methodId, replicateNo: ctx.replicateNo,
            isCurrent: true, enteredBy: ctx.performedBy, analysedAt: now, equipmentId: ctx.equipmentId,
            equipmentReadiness: ctx.equipmentReadinessText,
            batchId: ctx.batchId, attemptId: ctx.attemptId, createdAt: now, updatedAt: now } });
    } catch (error) { throw mapResultWriteError(error); }
    const overrideApproval = approvedRequest
        ? await require('./resultOverrideService').consume(tx,ctx.actor,approvedRequest,row,now) : null;
    await tx.auditLog.create({ data: { id: randomUUID(), entity: 'RESULT', entityId: row.id, action: 'RESULT_RECORDED',
        sampleId: ctx.sample.id, labId: ctx.labId, analysisCode: row.param, performedBy: ctx.performedBy,
        details: JSON.stringify({ attemptId: ctx.attemptId, batchId: ctx.batchId, provenance: row.provenance,
            ...(approvedRequest && {overrideRequestId:approvedRequest.id,approverId:approvedRequest.decidedBy}),
            ...(measurement.overrideReason && { overrideReason: measurement.overrideReason.trim() }) }), timestamp: now } });
    return overrideApproval ? {...row,overrideApproval} : row;
}

async function cacheResult(tx, item, text) {
    if (!item) return;
    // State/version changes still belong to workItemStateService, in this same transaction.
    await tx.workItem.update({ where: { id: item.id }, data: { result: text } });
}

// #191: a correction appends within the actual recorded attempt. Neither its
// execution/readiness evidence nor another replicate is replaced or refilled.
async function appendAttemptCorrection(tx, { item, sample, attempt, target, actor, value, calculation }) {
    rules.requireTransaction(tx);
    const original = await tx.result.findFirst({ where: { id: target.id, attemptId: attempt.id, isCurrent: true, supersededBy: null } });
    const owner = await tx.workAttempt.findUnique({ where: { id: attempt.id }, include: { workItem: { include: { sample: true } } } });
    if (!original || !owner || owner.workItemId !== item.id || owner.workItem.sampleId !== sample.id || original.sampleId !== sample.id) {
        throw new TransitionError('Choose a current Result on this attempt.', 409, 'ATTEMPT_CORRECTION_TARGET_INVALID');
    }
    item = owner.workItem; sample = item.sample; attempt = owner;
    rules.assertScope(actor, sample);
    const reviewer = hasPermission(actor, 'APPROVE_RESULTS');
    if (!reviewer && (!hasPermission(actor, 'ENTER_RESULTS') || item.assignedTo !== rules.actorName(actor) || attempt.status !== 'RECORDED') ||
        attempt.status === 'SUBMITTED' && !reviewer) {
        throw new TransitionError('This correction requires a reviewer.', 403, 'ATTEMPT_CORRECTION_FORBIDDEN');
    }
    if (!['RECORDED','SUBMITTED'].includes(attempt.status) || !['IN_PROGRESS','COMPLETED','SUBMITTED'].includes(item.status)) {
        throw new TransitionError('This attempt is no longer eligible for correction.',409,'ATTEMPT_CORRECTION_STATE_REFUSED');
    }
    require('./resultEvidenceService').assertAmendable(sample);
    await require('./sampleHoldService').assertNotHeld(tx,sample);
    await require('./resultEvidenceService').assertNoPreparationRevert(tx,sample.id);
    const labId = sample.assignedLab || item.labId, analysis = await tx.analysis.findUnique({ where: { code: item.analysis } });
    if (!analysis || analysis.labId && analysis.labId !== labId || configurationIssues(analysis).length) {
        throw new TransitionError('The correction parameter configuration is unavailable.',409,'RESULT_CONFIGURATION_INVALID');
    }
    const method = original.methodologyId ? await tx.methodology.findUnique({ where: { id: original.methodologyId } }) : null;
    if (original.methodologyId && !isAvailable(method,item.analysis,labId)) throw new TransitionError('The original method is unavailable in this laboratory.',409,'RESULT_METHOD_MISMATCH');
    let equipmentReadiness;
    try { equipmentReadiness = original.equipmentReadiness == null ? null : JSON.parse(original.equipmentReadiness); }
    catch (_) { throw new TransitionError('The recorded correction evidence is unavailable.',409,'ATTEMPT_CORRECTION_EVIDENCE_UNAVAILABLE'); }
    const ctx = { sample,item,attemptId:attempt.id,correctionTargetId:original.id,correctionOriginalUpdatedAt:original.updatedAt,actor,performedBy:rules.actorName(actor),labId,
        analysis,method,methodId:original.methodologyId,batchId:original.batchId,replicateNo:original.replicateNo,
        basis:original.basis,equipmentId:original.equipmentId,equipmentReadiness,equipmentReadinessText:original.equipmentReadiness,source:'measurement' };
    const measurement = { param:original.param,value,unit:original.unit,replicateNo:original.replicateNo,calculation }, now = new Date();
    const format = await getNumberFormat(ctx.labId, { db: tx, analysisCode: ctx.analysis.code, methodologyId: ctx.methodId });
    const evidence = await calculationService.prepareCorrection(tx,ctx,original,measurement,format);
    const values = await numericValues(tx,ctx,measurement,null,format,evidence);
    if (evidence?.selected.curve && evidence.calculated.intermediate.aboveRange)
        values.flags = JSON.stringify([...new Set([...JSON.parse(values.flags || '[]'),'ABOVE_RANGE'])]);
    const row = await appendResult(tx,ctx,measurement,{...values,provenance:original.provenance},now);
    await calculationService.freeze(tx,ctx,row,evidence,now);
    if (row.param === item.analysis) await cacheResult(tx,item,row.value);
    return row;
}

function numericReportingUnit(ctx, measurement) {
    const fraction = FRACTIONS.includes(measurement.param) && TEXTURE_ANALYSES.has(ctx.analysis.code);
    const unit = fraction ? '%' : measurement.unit || ctx.method?.unit || ctx.analysis.units || ctx.analysis.unitCode || null;
    if (!fraction && measurement.unit && ctx.analysis.units && ![ctx.analysis.units, ctx.analysis.unitCode].includes(measurement.unit)) {
        throw new TransitionError('Use the configured reporting unit.', 409, 'RESULT_UNIT_MISMATCH');
    }
    return unit;
}

async function numericValidationContext(tx, ctx, measurement, parsedValue = null, numberFormat = null, calculationEvidence = null) {
    const unit = numericReportingUnit(ctx, measurement);
    const resolved = await require('./resultValueRulesService').resolveNumericValueRules(tx, {
        labId: ctx.labId, analysis: ctx.analysis, method: ctx.method, unit, calibrationCurve: calculationEvidence?.selected.curve });
    const format = numberFormat || resolved.numberFormat;
    const validation = validateNumericMethod(measurement.value, resolved.rules, format, parsedValue);
    // Fixed rule keys and sorted flags give a stable hash of the actual
    // authoritative criteria. Unrelated policy edits do not invent a mismatch.
    const rulesSha256 = createHash('sha256').update(JSON.stringify({ rules: resolved.rules,
        numberFormat: format, flags: [...validation.flags].sort() })).digest('hex');
    return { ...resolved, numberFormat: format, unit, validation, rulesSha256 };
}

// Requests use the same scoped method/instrument/readiness/ownership context
// as the writer. The transaction performs reads only until a command writes.
async function resolveResultValidationContext(tx, options) {
    const selected = writeOptions(options), ctx = await context(tx, { ...selected, allowRecordedReplicates: true });
    ctx.actor = selected.actor;
    if (ctx.recordedResults.some(row => row.replicateNo === ctx.replicateNo)) {
        throw new TransitionError('Use the correction route for a recorded cell.', 409, 'ATTEMPT_CORRECTION_REQUIRED');
    }
    await validateExecutionReadiness(tx, ctx);
    const calculated = await calculationService.prepareCalculation(tx, ctx, selected.measurement,
        await getNumberFormat(ctx.labId, { db: tx, analysisCode: ctx.analysis.code, methodologyId: ctx.methodId }));
    return { ctx, ...await numericValidationContext(tx, ctx, calculated
        ? {...selected.measurement, unit:calculated.calculated.outputUnit} : selected.measurement, null, null, calculated) };
}

async function numericValues(tx, ctx, measurement, parsedValue=null, numberFormat=null, calculationEvidence=null) {
    const resolved = await numericValidationContext(tx, ctx, measurement, parsedValue, numberFormat, calculationEvidence);
    const { validation, unit } = resolved;
    const approvedRequest = measurement.overrideRequestId
        ? await require('./resultOverrideService').matchApproval(tx,ctx,measurement,resolved) : null;
    const importing = ctx.source === 'legacy-import';
    if (!importing && validation.nonOverridable) {
        throw new TransitionError('A censoring limit must not be below the method LOQ.', 422, 'CENSOR_LIMIT_BELOW_LOQ', { flags: validation.flags });
    }
    if (!importing && !validation.isValid && (!validation.normalizedValue && validation.normalizedValue !== 0 || validation.flags.includes('INVALID_FORMAT') || validation.isBlank)) {
        throw new TransitionError('Enter a valid numeric value or censoring qualifier.', 400, validation.code || 'INVALID_NUMBER');
    }
    if (!importing && !validation.isValid && !approvedRequest && (!measurement.overrideReason?.trim() || !hasPermission(ctx.actor, 'APPROVE_RESULTS'))) {
        throw new TransitionError('Result is outside the configured limits; a manager override reason is required.', 422, 'OUT_OF_RANGE', { flags: validation.flags });
    }
    const overridden = !importing && !validation.isValid && !approvedRequest && Boolean(measurement.overrideReason?.trim()) && hasPermission(ctx.actor, 'APPROVE_RESULTS');
    const flags = [...new Set([...validation.flags, ...(measurement.flags || []),
        ...(importing && !validation.isValid ? ['IMPORTED_UNVALIDATED'] : []),
        ...(overridden ? ['MANAGER_OVERRIDE'] : []), ...(approvedRequest ? ['OVERRIDE_APPROVED'] : [])])];
    return { value: importing && !validation.isValid ? validation.rawInput : validation.raw, rawInput: validation.rawInput,
        numericValue: validation.normalizedValue, unit, flags: JSON.stringify(flags),
        isValid: validation.isValid || overridden || Boolean(approvedRequest),
        ...(approvedRequest && {approvedRequest}),
        censoring: validation.censoring, provenance: importing ? 'IMPORTED' : ctx.source === 'spectral-prediction' ? 'PREDICTED' : 'MEASURED' };
}

async function writeResult(tx, options) {
    return (await writeResultsExecution(tx,{...options,measurements:[options.measurement]}))[0];
}

async function writeResultsExecution(tx, options) {
    const approvalMeasurements = options.measurements.filter(row=>row?.overrideRequestId);
    try {
        for(const measurement of approvalMeasurements)await require('./resultOverrideService').available(tx,measurement.overrideRequestId,options.actor);
        return await writeResultsExecutionChecked(tx,options);
    } catch(error) {
        if(approvalMeasurements.length)throw require('./resultOverrideService').mapContextError(error);
        throw error;
    }
}

async function writeResultsExecutionChecked(tx, options) {
    const measurements=options.measurements.map(selectMeasurement);
    if (!measurements.length) throw new TransitionError('Choose a parameter.',400,'RESULT_PARAMETER_REQUIRED');
    options = writeOptions({...options,measurement:measurements[0]});
    measurements[0]=options.measurement;
    const ctx = await context(tx, {...options,allowRecordedReplicates:true});
    ctx.actor = options.actor;
    if (options.measurement.param !== ctx.item?.analysis && ctx.item &&
        !(TEXTURE_ANALYSES.has(ctx.item.analysis) && FRACTIONS.includes(options.measurement.param))) {
        throw new TransitionError('Result parameter differs from its work item.', 409, 'RESULT_PARAMETER_MISMATCH');
    }
    const now=options.now || new Date();
    const prepared=measurements.map(measurement=>({...measurement,id:measurement.id || randomUUID()}));
    const seenReplicates=new Set();
    for(const measurement of prepared) {
        if (measurement.param!==options.measurement.param) throw new TransitionError('One execution must belong to one work item.',409,'RESULT_PARAMETER_MISMATCH');
        const replicateNo=Number(measurement.replicateNo ?? 1);
        if(!Number.isInteger(replicateNo) || replicateNo<1 || seenReplicates.has(replicateNo)) {
            throw new TransitionError('Use a distinct positive replicate number.',400,'RESULT_REPLICATE_INVALID');
        }
        seenReplicates.add(replicateNo);
        if(measurement.methodologyId && measurement.methodologyId!==ctx.methodId)throw new TransitionError('Use the assigned method.',409,ctx.recordedAttempt?'ATTEMPT_CONTEXT_MISMATCH':'RESULT_METHOD_MISMATCH');
        if(Object.hasOwn(measurement,'batchId') && measurement.batchId!==ctx.batchId)throw new TransitionError('Supplied result batch differs from the server batch.',409,'RESULT_BATCH_MISMATCH');
        if(measurement.equipmentId && measurement.equipmentId!==ctx.equipmentId || measurement.basis && measurement.basis!==ctx.basis) {
            throw new TransitionError('Replicates must share their execution context.',409,ctx.recordedAttempt?'ATTEMPT_CONTEXT_MISMATCH':'RESULT_EXECUTION_CONTEXT_MISMATCH');
        }
    }
    if (ctx.recordedAttempt && prepared.some(row=>ctx.recordedResults.some(old=>old.replicateNo===Number(row.replicateNo ?? 1)))) {
        throw new TransitionError('Use the transcription correction route or request a repeat to change a recorded cell.',409,'ATTEMPT_CORRECTION_REQUIRED');
    }
    const allocation=ctx.recordedAttempt ? {id:ctx.recordedAttempt.id,existing:true,status:'RECORDED'} : await allocateExecution(tx,ctx,options);
    await require('./sampleReplicatePolicyService').assertSampleReplicateNumbers(tx,ctx,prepared,allocation);
    await validateExecutionReadiness(tx,ctx);
    if(ctx.recordedAttempt) {
        const snapshot=ctx.recordedResults[0].equipmentReadiness;
        if(ctx.recordedResults.some(row=>row.equipmentReadiness!==snapshot))throw new TransitionError('Recorded execution snapshots differ.',409,'ATTEMPT_CONTEXT_MISMATCH');
        let evidence;
        try { evidence=JSON.parse(ctx.recordedAttempt.evidenceData); }
        catch (_) { throw new TransitionError('Recorded execution evidence is unavailable.',409,'ATTEMPT_CONTEXT_MISMATCH'); }
        if(JSON.stringify(evidence.equipmentReadiness ?? null)!==(snapshot || 'null'))throw new TransitionError('Recorded execution snapshots differ.',409,'ATTEMPT_CONTEXT_MISMATCH');
        ctx.attemptId=ctx.recordedAttempt.id;ctx.equipmentReadiness=evidence.equipmentReadiness ?? null;ctx.equipmentReadinessText=snapshot;
    }
    const format=await getNumberFormat(ctx.labId,{db:tx,analysisCode:ctx.analysis.code,methodologyId:ctx.methodId});
    const values=[], calculations=[];
    for(const measurement of prepared) {
        const calculated = await calculationService.prepareCalculation(tx,ctx,measurement,format);
        calculations.push(calculated);
        const value = await numericValues(tx,ctx,calculated ? {...measurement,unit:calculated.calculated.outputUnit} : measurement,null,format,calculated);
        if (calculated?.selected.curve && calculated.calculated.intermediate.aboveRange)
            value.flags = JSON.stringify([...new Set([...JSON.parse(value.flags),'ABOVE_RANGE'])]);
        values.push(value);
    }
    const evidence={source:ctx.source,param:prepared[0].param,rawValue:values[0].rawInput,normalizedValue:values[0].numericValue,
        qualifier:values[0].censoring==='NONE'?null:values[0].censoring,recordedAt:now.toISOString(),resultId:prepared[0].id,
        sourceResultIds:prepared.map(row=>row.id),measurements:prepared.map((row,index)=>({resultId:row.id,replicateNo:Number(row.replicateNo ?? 1),
            rawValue:values[index].rawInput,normalizedValue:values[index].numericValue,censoring:values[index].censoring}))};
    if(!ctx.recordedAttempt)await insertExecution(tx,ctx,allocation,evidence,now,options.attemptMetadata);
    const rows=[];
    for(const [index,measurement] of prepared.entries()) {
        const row = await appendResult(tx,{...ctx,replicateNo:Number(measurement.replicateNo ?? 1)},measurement,values[index],now);
        await calculationService.freeze(tx,ctx,row,calculations[index],now);
        rows.push(row);
    }
    if(ctx.recordedAttempt)await require('./workAttemptEventService').appendAttemptEvent(tx,ctx.item,ctx.recordedAttempt.id,ctx.actor,
        {action:'REPLICATE_ADDED',from:'RECORDED',to:'RECORDED',newResultIds:rows.map(row=>row.id)});
    if (!options.deferCache) await cacheResult(tx, ctx.item, rows.at(-1).value);
    return rows;
}

async function previewResultCalculation(db, { sampleId, workItemId, actor, inputs, measurement }) {
    return rules.inTransaction(db, async tx => {
        const item = await tx.workItem.findUnique({ where: { id: workItemId } });
        if (!item || item.sampleId !== sampleId) throw new TransitionError('Choose the sample work item.',409,'RESULT_WORKITEM_REQUIRED');
        const ctx = await context(tx,{sampleId,workItemId,actor,measurement:{...selectMeasurement(measurement),param:item.analysis},allowRecordedReplicates:true});
        ctx.actor = actor;
        await validateExecutionReadiness(tx,ctx);
        if (measurement) {
            const numberFormat=await getNumberFormat(ctx.labId,{db:tx,analysisCode:ctx.analysis.code,methodologyId:ctx.methodId});
            const evidence=await calculationService.prepareCalculation(tx,ctx,measurement,numberFormat);
            if(!evidence)return {active:null,template:null,calculation:null};
            const {selected,calculated}=evidence;
            return {active:{activationId:selected.activationId,templateId:selected.templateId,templateVersion:selected.templateVersion},
                template:selected.template,curve:selected.curve,numberFormat,units:selected.units,calculation:calculated,
                calculationEvidence:{...calculated,template:selected.template,templateId:selected.templateId,templateVersion:selected.templateVersion,
                    activationId:selected.activationId,parameters:selected.template.parameters,curveId:selected.curve?.id || null,curve:selected.curve}};
        }
        return calculationService.preview(tx,ctx,inputs);
    });
}

// Internal spectral ingestion uses an explicit option; a typed API measurement
// cannot claim this provenance. Readiness and sealing checks still apply.
async function writeSpectralPrediction(tx, options) {
    return writeResult(tx, { ...options, source: 'spectral-prediction' });
}

async function writeTextureDetermination(tx, options) {
    options = writeOptions(options);
    const measurement = { ...options.measurement, param: 'TEXTURE' };
    const ctx = await context(tx, { ...options, measurement });
    ctx.actor = options.actor;
    if (!TEXTURE_ANALYSES.has(ctx.analysis.code)) throw new TransitionError('Texture fractions require a texture work item.', 409, 'RESULT_PARAMETER_MISMATCH');
    if (ctx.attemptId) {
        const existing = await tx.result.findFirst({ where: { sampleId: ctx.sample.id, attemptId: ctx.attemptId, param: 'TEXTURE', replicateNo: ctx.replicateNo } });
        if (existing) return existing;
    }
    const now=options.now || new Date();
    const classMeasurement={...measurement,id:measurement.id || randomUUID()};
    const fractionMeasurements=FRACTIONS.map(param=>({...measurement,id:randomUUID(),param,
        value:options.fractions[param.toLowerCase()] ?? options.fractions[param]}));
    const allocation=await allocateExecution(tx,ctx,options);
    await validateExecutionReadiness(tx,ctx);
    const format = await getNumberFormat(ctx.labId, { db: tx });
    const tolerance = parseJson(ctx.analysis.validation, {})?.tolerance;
    const classification = validateTextureFractions(options.fractions, tolerance, format);
    if (!classification.isValid && (!classification.fractions || classification.flags.includes('INVALID_FORMAT') || classification.flags.includes('BELOW_MIN'))) {
        throw new TransitionError(classification.error || 'Invalid texture fractions.', 422, classification.code || 'INCOMPLETE_FRACTIONS');
    }
    if (!classification.isValid && (!measurement.overrideReason?.trim() || !hasPermission(options.actor, 'APPROVE_RESULTS'))) {
        throw new TransitionError(classification.error, 422, 'TEXTURE_CLOSURE_FAILED');
    }
    const preparedFractions=[];
    for(const fraction of fractionMeasurements)preparedFractions.push({measurement:fraction,
        values:await numericValues(tx,ctx,fraction,classification.parsedFractions[fraction.param],format)});
    const flags = ['DERIVED_USDA_12_CLASS', ...fractionMeasurements.map(row => `SOURCE_${row.param}_${row.id}`),
        `CLOSURE_ERROR_${classification.closureError ?? 0}`, ...(measurement.flags || []),
        ...(measurement.overrideReason?.trim() ? ['TEXTURE_CLOSURE_OVERRIDE', 'MANAGER_OVERRIDE'] : [])];
    const evidence={source:ctx.source,fractions:classification.fractions,className:classification.className,
        closureError:classification.closureError,sourceResultIds:[...fractionMeasurements.map(row=>row.id),classMeasurement.id],
        ...(options.syncResult && {rawValue:options.syncResult.rawValue ?? String(measurement.value ?? classification.className),
            normalizedValue:null,qualifier:null,recordedAt:now.toISOString(),resultId:classMeasurement.id})};
    await insertExecution(tx,ctx,allocation,evidence,now,options.attemptMetadata);
    for(const fraction of preparedFractions)await appendResult(tx,ctx,fraction.measurement,fraction.values,now);
    const row = await appendResult(tx, ctx, classMeasurement, { value: classification.className,
        rawInput: JSON.stringify(options.fractions), numericValue: null, unit: 'USDA_12_CLASS',
        flags: JSON.stringify(flags), isValid: classification.isValid || Boolean(measurement.overrideReason?.trim()),
        censoring: 'NONE', provenance: 'DERIVED' }, now);
    // Main's offline path stored class labels under PSA/pSA/etc. Preserve those
    // values as superseded evidence while leaving numerical determinations alone.
    if (options.syncResult && ctx.item && ctx.item.analysis !== 'TEXTURE') {
        await tx.result.updateMany({ where: { sampleId: ctx.sample.id, param: ctx.item.analysis,
            replicateNo: ctx.replicateNo, isCurrent: true, numericValue: null },
        data: { isCurrent: false, supersededBy: row.id } });
    }
    await cacheResult(tx, ctx.item, row.value);
    return row;
}

async function deriveTextureResult(tx, { sampleId, replicateNo = 1, actor, now = new Date(), ...options }) {
    rules.requireTransaction(tx);
    const rows = await tx.result.findMany({ where: { sampleId, replicateNo, isCurrent: true, param: { in: FRACTIONS } }, orderBy: { createdAt: 'desc' } });
    const fractions = FRACTIONS.map(param => rows.find(row => row.param === param));
    if (fractions.some(row => !row || row.censoring !== 'NONE' || row.numericValue == null)) return null;
    const item=await tx.workItem.findFirst({where:canonicalWorkItemWhere(sampleId,'TEXTURE')});
    if (!item) throw new TransitionError('Reconcile the order before recording this parameter.',409,'RESULT_WORKITEM_REQUIRED');
    const classification = require('../utils/soilCalculations').calculateUsdaTexture(...fractions.map(row => row.numericValue));
    if (!classification.isValid) return null;
    const flags = ['DERIVED_USDA_12_CLASS', ...fractions.map(row => `SOURCE_${row.param}_${row.id}`), `CLOSURE_ERROR_${classification.closureError ?? 0}`];
    const ctx = await context(tx, { sampleId, actor, workItemId:item.id,
        source: 'derived', measurement: { param: 'TEXTURE', replicateNo } });
    ctx.actor=actor;
    const sharedAttemptId=fractions.every(row=>row.attemptId && row.attemptId===fractions[0].attemptId)?fractions[0].attemptId:null;
    const sharedAttempt=sharedAttemptId?await tx.workAttempt.findUnique({where:{id:sharedAttemptId}}):null;
    const reusing=sharedAttempt?.workItemId===item.id;
    const existingRows=await tx.result.findMany({where:{sampleId,replicateNo,param:'TEXTURE',isCurrent:true,supersededBy:null}});
    if(existingRows.length>1)throw new TransitionError('Resolve ambiguous current derived evidence.',409,'WORK_ATTEMPT_EVIDENCE_MISMATCH');
    const existing=existingRows[0];
    if (existing && existing.flags === JSON.stringify(flags)) return existing;
    const previousAttempt=existing?.attemptId ? await tx.workAttempt.findUnique({where:{id:existing.attemptId}}) : null;
    if(existing && (!previousAttempt || previousAttempt.workItemId!==item.id || !['RECORDED','SUBMITTED','ACCEPTED'].includes(previousAttempt.status))) {
        throw new TransitionError('The derived Result requires its canonical execution.',409,'WORK_ATTEMPT_EVIDENCE_MISMATCH');
    }
    let oldSources,sourceEventIds;
    if(existing) {
        const previousFlags=parseJson(existing.flags,[]),evidence=parseJson(previousAttempt.evidenceData,{});
        const explicit=evidence.measurements?.find(row=>row.resultId===existing.id)?.sourceResultIds;
        const sourceIds=FRACTIONS.map(param=>previousFlags.find(flag=>typeof flag==='string' && flag.startsWith(`SOURCE_${param}_`))?.slice(`SOURCE_${param}_`.length));
        const oldIds=sourceIds.every(Boolean)?sourceIds:explicit || evidence.sourceResultIds;
        if(!Array.isArray(oldIds))throw new TransitionError('Previous derived source links are unavailable.',409,'WORK_ATTEMPT_EVIDENCE_MISMATCH');
        const oldRows=await tx.result.findMany({where:{id:{in:oldIds},sampleId,param:{in:FRACTIONS},replicateNo}});
        oldSources=FRACTIONS.map(param=>oldRows.find(row=>row.param===param));
        if(oldRows.length!==3 || oldSources.some(row=>!row))throw new TransitionError('Previous derived source links are ambiguous.',409,'WORK_ATTEMPT_EVIDENCE_MISMATCH');
        const changed=fractions.filter((row,index)=>row.id!==oldSources[index].id);
        const events=require('./workAttemptEventService').attemptEventsInTransaction(tx).filter(event=>
            event.sampleId===sampleId && ['CORRECTED','FIRST_FILL','REPLICATE_ADDED'].includes(event.action) &&
            changed.some(row=>row.attemptId===event.entityId && parseJson(event.details,{}).newResultIds?.includes(row.id)));
        const stored=await tx.auditLog.findMany({where:{id:{in:events.map(event=>event.id)},entity:'WORK_ATTEMPT',sampleId}});
        if(!changed.length || !events.length || stored.length!==events.length || events.some(event=>
            !stored.some(row=>row.id===event.id && row.entityId===event.entityId && row.action===event.action && row.details===event.details)) ||
            changed.some(row=>!events.some(event=>event.entityId===row.attemptId && parseJson(event.details,{}).newResultIds?.includes(row.id)))) {
            throw new TransitionError('Changed source fractions require their events in this transaction.',409,'WORK_ATTEMPT_EVENT_INVALID');
        }
        sourceEventIds=events.sort((a,b)=>a.timestamp.getTime()-b.timestamp.getTime() || a.id.localeCompare(b.id)).map(row=>row.id);
    }
    const measurement={id:randomUUID(),param:'TEXTURE'},allocation=existing
        ? {id:previousAttempt.id,existing:true,status:previousAttempt.status}
        : await allocateExecution(tx,ctx,reusing?{attemptId:sharedAttemptId}:{});
    if(existing) {
        ctx.attemptId=previousAttempt.id;ctx.equipmentReadinessText=existing.equipmentReadiness;
        ctx.equipmentReadiness=parseJson(existing.equipmentReadiness,null);ctx.equipmentId=existing.equipmentId;
        ctx.methodId=existing.methodologyId;ctx.batchId=existing.batchId;ctx.basis=existing.basis;
        ctx.correctionTargetId=existing.id;ctx.correctionOriginalUpdatedAt=existing.updatedAt;
    } else if (reusing) {
        const snapshot=fractions[0].equipmentReadiness;
        const recorded=parseJson(sharedAttempt.evidenceData,{})?.equipmentReadiness || null;
        if (fractions.some(row=>row.equipmentReadiness!==snapshot) || JSON.stringify(recorded)!==(snapshot || 'null')) {
            throw new TransitionError('Attempt and Result readiness must match.',409,'WORK_ATTEMPT_EVIDENCE_MISMATCH');
        }
        ctx.attemptId=sharedAttemptId;ctx.equipmentReadiness=recorded;ctx.equipmentReadinessText=snapshot;ctx.equipmentId=sharedAttempt.instrumentId;
    } else {
        // Derived TEXTURE calculates already-validated fraction executions.
        // Its canonical owner need not be assigned to the fraction analyst,
        // and it has no separate instrument or execution-readiness evidence.
        ctx.equipmentReadiness=null;ctx.equipmentReadinessText=null;ctx.equipmentId=null;
    }
    await insertExecution(tx,ctx,allocation,{source:'derived',fractions:Object.fromEntries(fractions.map(row=>[row.param.toLowerCase(),row.numericValue])),
        className:classification.className,closureError:classification.closureError,
        sourceResultIds:fractions.map(row=>row.id),sourceAttemptIds:fractions.map(row=>row.attemptId)},now);
    const result=await appendResult(tx, ctx, measurement, { value: classification.className,
        rawInput: JSON.stringify(Object.fromEntries(fractions.map(row => [row.param.toLowerCase(), row.rawInput]))),
        numericValue: null, unit: 'USDA_12_CLASS', flags: JSON.stringify(flags), isValid: true, censoring: 'NONE', provenance: 'DERIVED' }, now);
    if(existing) {
        const event=await require('./workAttemptEventService').appendAttemptEvent(tx,ctx.item,previousAttempt.id,actor,
            {action:'DERIVED_RECALCULATED',from:previousAttempt.status,to:previousAttempt.status,oldResultIds:[existing.id],newResultIds:[result.id],
                oldSourceResultIds:oldSources.map(row=>row.id),newSourceResultIds:fractions.map(row=>row.id),sourceEventIds});
        await require('./derivedResultReviewService').resetDerivedReview(tx,ctx.item,previousAttempt,event,result,actor);
    }
    await cacheResult(tx,ctx.item,result.value);
    return result;
}

async function writeNonMeasurementSummary(tx, expectedItem, { kind, text, actor }) {
    rules.requireTransaction(tx);
    const item = await tx.workItem.findUnique({ where: { id: expectedItem.id } });
    if (!item) throw new TransitionError('Work item not found.', 404, 'WORK_ITEM_NOT_FOUND');
    if (!isNonMeasurement(item)) throw new TransitionError('Measurement work needs a Result row.', 409, 'RESULT_SUMMARY_NOT_ALLOWED');
    const sample = await tx.sample.findUnique({ where: { id: item.sampleId } });
    if (!sample) throw new TransitionError('Sample not found.', 404, 'SAMPLE_NOT_FOUND');
    rules.assertScope(actor, sample);
    const performedBy = rules.actorName(actor);
    if (!hasPermission(actor, 'ENTER_RESULTS') && !hasPermission(actor, 'APPROVE_RESULTS')) throw new TransitionError('Evidence recording is not authorized.', 403, 'RESULT_WRITE_FORBIDDEN');
    if (text !== null && typeof text !== 'string') throw new TransitionError('Evidence summary must be text.', 400, 'RESULT_SUMMARY_INVALID');
    await cacheResult(tx, item, text);
    await tx.auditLog.create({ data: { id: randomUUID(), entity: 'WORKITEM', entityId: item.id, action: 'NON_MEASUREMENT_SUMMARY',
        sampleId: item.sampleId, labId: item.assignedLab || sample.assignedLab, analysisCode: item.analysis, performedBy,
        before: JSON.stringify({ result: item.result }), after: JSON.stringify({ kind, result: text }), timestamp: new Date() } });
    return tx.workItem.findUnique({ where: { id: item.id } });
}

// Preserve old fixture assertions without making a runtime cache-only route.
async function writeFixtureCache(tx, item, text, actor) {
    rules.assertFixtureContext();
    rules.requireTransaction(tx);
    if (rules.actorName(actor) !== 'system:fixture') throw new TransitionError('Fixture actor required.', 409, 'WORKFLOW_FIXTURE_REFUSED');
    await cacheResult(tx, item, text);
    return tx.workItem.findUnique({ where: { id: item.id } });
}

async function createResultFixture(db, args) {
    rules.assertFixtureContext();
    const columns = await db.$queryRawUnsafe('PRAGMA table_info("Result")');
    // Literal historical rehearsal schemas intentionally predate #182. Select
    // their actual scalar fields so Prisma does not query a future column. The
    // helper never changes that historical schema or invents a link/value.
    const fields = require('../prisma_client').Prisma.dmmf.datamodel.models.find(model => model.name === 'Result').fields.filter(field => field.kind !== 'object').map(field => field.name);
    const missing = fields.filter(field => !columns.some(column => column.name === field));
    if (missing.length && !['["attemptId"]', '["equipmentReadiness"]', '["equipmentReadiness","attemptId"]'].includes(JSON.stringify(missing))) {
        throw new TransitionError('Unknown historical result fixture shape.', 409, 'WORKFLOW_FIXTURE_REFUSED');
    }
    const select = missing.length && !args.select && !args.include ? Object.fromEntries(fields.filter(field => !missing.includes(field)).map(field => [field, true])) : args.select;
    return db.result.create({ ...args, ...(select && { select }) });
}

async function createResultsFixture(db, args) {
    rules.assertFixtureContext();
    return db.result.createMany(args);
}

function createRawResultFixture(db, data) {
    rules.assertFixtureContext();
    const path = require('node:path');
    const relative = path.relative(path.resolve(__dirname, '..'), path.resolve(db.name)).replace(/\\/g, '/');
    if (db.name !== ':memory:' && !/^tests\/\.tmp\/[^/]+\.db$/.test(relative) && !/^\.tmp_journey_runner_[^/]+\/[^/]+\.db$/.test(relative)) {
        throw new TransitionError('Raw fixtures require a test-owned database.', 409, 'WORKFLOW_FIXTURE_REFUSED');
    }
    const fields = Object.keys(data);
    if (!fields.length || fields.some(field => !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(field))) throw new Error('Invalid fixture field.');
    return db.prepare(`INSERT INTO "Result" (${fields.map(field => `"${field}"`).join(',')}) VALUES (${fields.map(() => '?').join(',')})`)
        .run(...fields.map(field => data[field]));
}

module.exports = { writeResult, writeSpectralPrediction, selectMeasurement, writeTextureDetermination, deriveTextureResult, writeNonMeasurementSummary, writeFixtureCache,
    writeResultsExecution, appendAttemptCorrection, recordedExecution, assertRecordedResultSave,
    createResultFixture, createResultsFixture, createRawResultFixture, mapResultWriteError, resolveResultRunContext, previewResultCalculation, resolveResultValidationContext };
