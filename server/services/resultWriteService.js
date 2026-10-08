const { randomUUID } = require('node:crypto');
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
const TEXTURE_ANALYSES = new Set(['TEXTURE', 'SAND', 'SILT', 'CLAY', 'pSA', 'PSA', 'textureSum']);
const FRACTIONS = ['SAND', 'SILT', 'CLAY'];
const ATTEMPT_ERRORS = ['RESULT_ATTEMPT_NOT_FOUND', 'RESULT_ATTEMPT_SAMPLE_MISMATCH', 'RESULT_ATTEMPT_REFERENCED'];

// Request data never supplies Result identity, parser evidence or provenance.
// batchId is retained only to compare with the server-derived batch in context.
function selectMeasurement(measurement) {
    if (!measurement || typeof measurement !== 'object') return measurement;
    return Object.fromEntries(['param', 'value', 'unit', 'methodologyId', 'equipmentId', 'basis', 'overrideReason', 'replicateNo', 'batchId']
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

async function context(tx, { sampleId, workItemId, attemptId = null, actor, measurement, source = 'measurement' }) {
    rules.requireTransaction(tx);
    if (!measurement || typeof measurement.param !== 'string' || !measurement.param) throw new TransitionError('Choose a parameter.', 400, 'RESULT_PARAMETER_REQUIRED');
    if (measurement.flags != null && !Array.isArray(measurement.flags)) throw new TransitionError('Result flags must be an array.', 400, 'RESULT_FLAGS_INVALID');
    if (measurement.overrideReason != null && typeof measurement.overrideReason !== 'string') throw new TransitionError('Override reason must be text.', 400, 'RESULT_OVERRIDE_INVALID');
    const performedBy = rules.actorName(actor);
    const sample = await tx.sample.findUnique({ where: { id: sampleId } });
    if (!sample) throw new TransitionError('Sample not found.', 404, 'SAMPLE_NOT_FOUND');
    rules.assertScope(actor, sample);
    const importing = source === 'legacy-import';
    if (!hasPermission(actor, importing ? 'RECEIVE_SAMPLE' : 'ENTER_RESULTS')) {
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
    if (attempt?.qcBatchId && item?.batchId && attempt.qcBatchId !== item.batchId) {
        throw new TransitionError('Attempt and work item batches disagree.', 409, 'RESULT_BATCH_CONFLICT');
    }
    const batchId = attempt?.qcBatchId ?? item?.batchId ?? null;
    if (Object.hasOwn(measurement, 'batchId') && measurement.batchId !== batchId) {
        throw new TransitionError('Supplied result batch differs from the server batch.', 409, 'RESULT_BATCH_MISMATCH');
    }
    const replicateNo = Number(measurement.replicateNo ?? 1);
    if (!Number.isInteger(replicateNo) || replicateNo < 1) throw new TransitionError('Replicate number must be a positive integer.', 400, 'RESULT_REPLICATE_INVALID');
    const labId = sample.assignedLab || item?.assignedLab || sample.labId;
    const methodId = item?.methodologyId || measurement.methodologyId || null;
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
    // #182 pin 6005018712: historical imports have no work to execute. An
    // existing canonical item must satisfy the same commit rules as every path.
    if (!importing || item) {
        require('./resultEvidenceService').assertAmendable(sample);
        if (item) {
            if (['COMPLETED', 'SUBMITTED', 'ACCEPTED', 'WAIVED', 'CANCELLED', 'AWAITING_VERIFICATION'].includes(item.status) && source !== 'derived') {
                throw new TransitionError('Recorded or sealed work requires its correction workflow.', 409, 'RESULT_WORKITEM_SEALED');
            }
            item = { ...item, sample, equipmentId: measurement.equipmentId || item.equipmentId };
        }
    }
    return { sample, item, attemptId, batchId, replicateNo, performedBy, labId, methodId, analysis, method, source,
        basis: ['AIR_DRY', 'OVEN_DRY', 'FIELD_MOIST'].includes(measurement.basis) ? measurement.basis : 'AIR_DRY',
        equipmentId: measurement.equipmentId || item?.equipmentId || null, equipmentReadiness:null,equipmentReadinessText:null };
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
    await tx.result.updateMany({ where: { sampleId: ctx.sample.id, param: measurement.param, replicateNo: ctx.replicateNo, isCurrent: true,
        ...(ctx.correctionTargetId && { id: ctx.correctionTargetId, attemptId: ctx.attemptId }) },
        data: { isCurrent: false, supersededBy: id } });
    let row;
    try {
        row = await tx.result.create({ data: { id, sampleId: ctx.sample.id, param: measurement.param,
            ...values, basis: ctx.basis, methodologyId: ctx.methodId, replicateNo: ctx.replicateNo,
            isCurrent: true, enteredBy: ctx.performedBy, analysedAt: now, equipmentId: ctx.equipmentId,
            equipmentReadiness: ctx.equipmentReadinessText,
            batchId: ctx.batchId, attemptId: ctx.attemptId, createdAt: now, updatedAt: now } });
    } catch (error) { throw mapResultWriteError(error); }
    await tx.auditLog.create({ data: { id: randomUUID(), entity: 'RESULT', entityId: row.id, action: 'RESULT_RECORDED',
        sampleId: ctx.sample.id, labId: ctx.labId, analysisCode: row.param, performedBy: ctx.performedBy,
        details: JSON.stringify({ attemptId: ctx.attemptId, batchId: ctx.batchId, provenance: row.provenance,
            ...(measurement.overrideReason && { overrideReason: measurement.overrideReason.trim() }) }), timestamp: now } });
    return row;
}

async function cacheResult(tx, item, text) {
    if (!item) return;
    // State/version changes still belong to workItemStateService, in this same transaction.
    await tx.workItem.update({ where: { id: item.id }, data: { result: text } });
}

// #191: a correction appends within the actual recorded attempt. Neither its
// execution/readiness evidence nor another replicate is replaced or refilled.
async function appendAttemptCorrection(tx, { item, sample, attempt, target, actor, value }) {
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
    const ctx = { sample,item,attemptId:attempt.id,correctionTargetId:original.id,actor,performedBy:rules.actorName(actor),labId,
        analysis,method,methodId:original.methodologyId,batchId:original.batchId,replicateNo:original.replicateNo,
        basis:original.basis,equipmentId:original.equipmentId,equipmentReadiness,equipmentReadinessText:original.equipmentReadiness,source:'measurement' };
    const measurement = { param:original.param,value,unit:original.unit,replicateNo:original.replicateNo }, now = new Date();
    const values = await numericValues(tx,ctx,measurement);
    const row = await appendResult(tx,ctx,measurement,{...values,provenance:original.provenance},now);
    if (row.param === item.analysis) await cacheResult(tx,item,row.value);
    return row;
}

async function numericValues(tx, ctx, measurement, parsedValue=null, numberFormat=null) {
    const format = numberFormat || await getNumberFormat(ctx.labId, { db: tx, analysisCode: ctx.analysis.code, methodologyId: ctx.methodId });
    let validationRules = { ...parseJson(ctx.analysis.validation, {}),
        ...(ctx.method?.loq != null && { loq: ctx.method.loq }), ...(ctx.method?.lod != null && { lod: ctx.method.lod }) };
    // Existing pH policies apply to each lab and method; no local limits are invented.
    if (['PH_H2O', 'PH_CACL2', 'PH_KCL', 'pH', 'WATER_PH'].includes(ctx.analysis.code)) {
        const policy = require('./policyService'), scope = { db: tx, analysisCode: ctx.analysis.code, methodologyId: ctx.methodId };
        validationRules.min = await policy.get(ctx.labId, 'results.phMin', scope);
        validationRules.max = await policy.get(ctx.labId, 'results.phMax', scope);
    }
    const validation = validateNumericMethod(measurement.value, validationRules, format,parsedValue);
    const importing = ctx.source === 'legacy-import';
    if (!importing && !validation.isValid && (!validation.normalizedValue && validation.normalizedValue !== 0 || validation.flags.includes('INVALID_FORMAT') || validation.isBlank)) {
        throw new TransitionError('Enter a valid numeric value or censoring qualifier.', 400, validation.code || 'INVALID_NUMBER');
    }
    if (!importing && !validation.isValid && (!measurement.overrideReason?.trim() || !hasPermission(ctx.actor, 'APPROVE_RESULTS'))) {
        throw new TransitionError('Result is outside the configured limits; a manager override reason is required.', 422, 'OUT_OF_RANGE', { flags: validation.flags });
    }
    const fraction = FRACTIONS.includes(measurement.param) && TEXTURE_ANALYSES.has(ctx.analysis.code);
    const unit = fraction ? '%' : measurement.unit || ctx.method?.unit || ctx.analysis.units || ctx.analysis.unitCode || null;
    if (!fraction && measurement.unit && ctx.analysis.units && ![ctx.analysis.units, ctx.analysis.unitCode].includes(measurement.unit)) {
        throw new TransitionError('Use the configured reporting unit.', 409, 'RESULT_UNIT_MISMATCH');
    }
    const overridden = !importing && !validation.isValid && Boolean(measurement.overrideReason?.trim()) && hasPermission(ctx.actor, 'APPROVE_RESULTS');
    const flags = [...new Set([...validation.flags, ...(measurement.flags || []),
        ...(importing && !validation.isValid ? ['IMPORTED_UNVALIDATED'] : []),
        ...(overridden ? ['MANAGER_OVERRIDE'] : [])])];
    return { value: importing && !validation.isValid ? validation.rawInput : validation.raw, rawInput: validation.rawInput,
        numericValue: validation.normalizedValue, unit, flags: JSON.stringify(flags),
        isValid: validation.isValid || overridden,
        censoring: validation.censoring, provenance: importing ? 'IMPORTED' : ctx.source === 'spectral-prediction' ? 'PREDICTED' : 'MEASURED' };
}

async function writeResult(tx, options) {
    return (await writeResultsExecution(tx,{...options,measurements:[options.measurement]}))[0];
}

async function writeResultsExecution(tx, options) {
    const measurements=options.measurements.map(selectMeasurement);
    if (!measurements.length) throw new TransitionError('Choose a parameter.',400,'RESULT_PARAMETER_REQUIRED');
    options = writeOptions({...options,measurement:measurements[0]});
    measurements[0]=options.measurement;
    const ctx = await context(tx, options);
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
        if(measurement.methodologyId && measurement.methodologyId!==ctx.methodId)throw new TransitionError('Use the assigned method.',409,'RESULT_METHOD_MISMATCH');
        if(Object.hasOwn(measurement,'batchId') && measurement.batchId!==ctx.batchId)throw new TransitionError('Supplied result batch differs from the server batch.',409,'RESULT_BATCH_MISMATCH');
        if(measurement.equipmentId && measurement.equipmentId!==ctx.equipmentId || measurement.basis && measurement.basis!==ctx.basis) {
            throw new TransitionError('Replicates must share their execution context.',409,'RESULT_EXECUTION_CONTEXT_MISMATCH');
        }
    }
    const allocation=await allocateExecution(tx,ctx,options);
    await validateExecutionReadiness(tx,ctx);
    const format=await getNumberFormat(ctx.labId,{db:tx,analysisCode:ctx.analysis.code,methodologyId:ctx.methodId});
    const values=[];
    for(const measurement of prepared)values.push(await numericValues(tx,ctx,measurement,null,format));
    const evidence={source:ctx.source,param:prepared[0].param,rawValue:values[0].rawInput,normalizedValue:values[0].numericValue,
        qualifier:values[0].censoring==='NONE'?null:values[0].censoring,recordedAt:now.toISOString(),resultId:prepared[0].id,
        sourceResultIds:prepared.map(row=>row.id),measurements:prepared.map((row,index)=>({resultId:row.id,replicateNo:Number(row.replicateNo ?? 1),
            rawValue:values[index].rawInput,normalizedValue:values[index].numericValue,censoring:values[index].censoring}))};
    await insertExecution(tx,ctx,allocation,evidence,now,options.attemptMetadata);
    const rows=[];
    for(const [index,measurement] of prepared.entries())rows.push(await appendResult(tx,{...ctx,replicateNo:Number(measurement.replicateNo ?? 1)},measurement,values[index],now));
    if (!options.deferCache) await cacheResult(tx, ctx.item, rows.at(-1).value);
    return rows;
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
    const existing = await tx.result.findFirst({ where: { sampleId, replicateNo, param: 'TEXTURE',
        ...(reusing?{attemptId:sharedAttemptId}:{isCurrent:true}) } });
    if (existing && existing.flags === JSON.stringify(flags)) return existing;
    const measurement={id:randomUUID(),param:'TEXTURE'},allocation=await allocateExecution(tx,ctx,reusing?{attemptId:sharedAttemptId}:{});
    if (reusing) {
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
    return appendResult(tx, ctx, measurement, { value: classification.className,
        rawInput: JSON.stringify(Object.fromEntries(fractions.map(row => [row.param.toLowerCase(), row.rawInput]))),
        numericValue: null, unit: 'USDA_12_CLASS', flags: JSON.stringify(flags), isValid: true, censoring: 'NONE', provenance: 'DERIVED' }, now);
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
    writeResultsExecution, appendAttemptCorrection,
    createResultFixture, createResultsFixture, createRawResultFixture, mapResultWriteError };
