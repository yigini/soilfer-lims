'use strict';
const crypto=require('crypto');
const prisma=require('../prisma');
const templates=require('./intakeTemplateService');
const schema=require('./intakeSchema');
const facts=require('./intakeFactsService');
const policy=require('./projectPolicyService');
const receipts=require('./commandReceiptService');
const {parseLaboratoryNumber}=require('../utils/messageFormatter');
const FACT_KEYS=['originalId','sampleId','projectId','projectCode','matrix','checklist','contextAnswers','notes','ncReason','labId','analysisGroupIds','analysisAdditions','analysisRemovals','requiredAnalyses','justification','submitterDetails','samplingDetails','receivedMass','massWarningAcknowledged','moistureOnArrival','foreignMaterial','intakePhotos','photos','isResubmission','coc','custodyHandoverAt','custodyCarrierName','custodyTrackingNumber','custodySenderSignature','receivingOfficerSignature','latitude','longitude','coordinates','elevation','depthTopCm','depthBottomCm','positionalUncertaintyM','compositeRadiusM','locationSource','admin1','admin2','village','siteName','collectionDate','profileReference','profileSourceEvidence','fieldMetadata','bulkAttestation','sampleType','ptRound','expectedValues'];
const {error}=schema;
function number(value,key) {
    const parsed=parseLaboratoryNumber(value);
    if(!parsed.valid||!Number.isFinite(parsed.value)||parsed.qualifier&&!['+','-'].includes(parsed.qualifier)) throw error(422,'INVALID_INTAKE_NUMBER',{field:key});
    return parsed.qualifier==='-'?-parsed.value:parsed.value;
}
const nonblank=v=>v!==undefined&&v!==null&&v!=='';
function mergeFacts(sample,input) {
    const stored=templates.parse(sample?.receptionData),saved={...Object.fromEntries(FACT_KEYS.filter(key=>stored[key]!==undefined).map(key=>[key,stored[key]])),...stored.commandFacts};
    const payload={...saved,...input};
    for(const key of ['samplingDetails','submitterDetails','coc','contextAnswers']) if(saved[key]||input[key]) payload[key]={...(saved[key]||{}),...(input[key]||{})};
    if(input.checklist===undefined) payload.checklist=stored.intakeTemplate?.checklist||stored.checklist||saved.checklist;
    for(const key of ['receivedMass','moistureOnArrival','foreignMaterial','depthTopCm','depthBottomCm','latitude','longitude','positionalUncertaintyM','requiredAnalyses','analysisGroupIds']) {
        if(payload[key]===undefined&&sample?.[key]!=null) payload[key]=['foreignMaterial','requiredAnalyses','analysisGroupIds'].includes(key)?JSON.parse(sample[key]):sample[key];
    }
    if(payload.intakePhotos===undefined&&sample?.intakePhotos) payload.intakePhotos=JSON.parse(sample.intakePhotos);
    for(const key of ['custodyHandoverAt','custodyCarrierName','custodyTrackingNumber','custodySenderSignature','receivingOfficerSignature']) if(payload[key]===undefined&&sample?.[key]!=null) payload[key]=sample[key] instanceof Date?sample[key].toISOString():sample[key];
    return payload;
}
function mappedAnswers(payload,effective) {
    const values={...(payload.contextAnswers||{})};
    for(const field of effective.contextFields) {
        const raw=payload[field.mapping]??payload.samplingDetails?.[field.mapping]??(field.mapping==='collectionDate'?payload.samplingDetails?.date:undefined);
        if(values[field.id]===undefined&&nonblank(raw)) values[field.id]=field.type==='number'?number(raw,field.id):raw;
        if(values[field.id]!==undefined&&field.type==='number'&&typeof values[field.id]==='string'&&values[field.id]!=='') values[field.id]=number(values[field.id],field.id);
        if(field.mapping&&values[field.id]!==undefined) payload[field.mapping]=values[field.id];
        if(field.mapping==='collectionDate'&&values[field.id]!==undefined) payload.samplingDetails={...payload.samplingDetails,date:values[field.id]};
    }
    for(const key of ['receivedMass','latitude','longitude','elevation','depthTopCm','depthBottomCm','positionalUncertaintyM','compositeRadiusM']) if(nonblank(payload[key])) payload[key]=number(payload[key],key);
    if(nonblank(payload.depthTopCm)&&nonblank(payload.depthBottomCm)&&payload.depthBottomCm<payload.depthTopCm) throw error(422,'INVALID_DEPTH_INTERVAL');
    if(nonblank(payload.latitude)&&(payload.latitude<-90||payload.latitude>90)||nonblank(payload.longitude)&&(payload.longitude<-180||payload.longitude>180)) throw error(422,'INVALID_COORDINATES');
    return values;
}
async function admission(actor,context,sample,payload,db) {
    const meta=templates.parse(sample?.metadata);
    if(meta.provenanceHold?.status==='AMBIGUOUS_PROVENANCE_HOLD') throw error(409,'AMBIGUOUS_PROVENANCE_HOLD',{preserveInput:true});
    const channel=sample?'PHYSICAL_RECEIPT':context.origin==='DESK_WALKIN'?'WALK_IN':payload._channel||'DESK';
    const exception=await policy.resolveAndVerifyExceptionRecord({rawExceptionRecord:payload.exceptionRecord,rawExceptionReason:payload.exceptionReason,authorizer:payload.authorizer,approvalId:payload.approvalId||payload.approvalToken,actor,project:context.project,labId:context.labId,sampleId:sample?.id||payload.originalId,channel,prismaClient:db});
    const allowed=policy.canAdmitSample({project:context.project,channel,actor,labId:context.labId,...exception});
    if(!allowed.allowed) throw error(422,['PROJECT_PAUSED','PROJECT_CLOSED'].includes(allowed.code)?'PROJECT_ADMISSIONS_PAUSED':allowed.code,{message:allowed.reason,exceptionRequired:!!allowed.exceptionRequired});
    if(payload.projectId&&sample?.projectId&&payload.projectId!==sample.projectId&&payload.projectId!==sample.projectCode) throw error(400,'CROSS_PROJECT_CONFLICT');
}
async function executeIntakeInTransaction(command,db) {
    const {actor,intent,capturedAtLocal}=command;
    if(!['SAVE_DRAFT','RECEIVE','ACCEPT','REJECT'].includes(intent)) throw error(422,'INVALID_INTAKE_INTENT');
    const input=command.payload||{};
    const operationId=command.operationId||crypto.randomUUID();
    if(typeof operationId!=='string'||operationId.length>200||!operationId.trim()) throw error(422,'INVALID_OPERATION_ID');
    const target=String(input.sampleId||input.id||input.originalId||'').trim();
    if(!target||target.length>200) throw error(400,'MISSING_IDENTIFIER');
    const payloadHash=schema.hash({intent,payload:input,capturedAtLocal:capturedAtLocal||null});
    const receipt=await db.commandReceipt.findUnique({where:{idempotencyKey:operationId}});
    const previous=receipt?templates.parse(receipt.outcome):null;
    let sample=await db.sample.findFirst({where:{OR:[{id:target},{originalId:target},{labId:target}]}});
    if(!sample&&previous?.id) sample=await db.sample.findUnique({where:{id:previous.id}});
    // Several intentions may refer to the same temporary device draft. A prior
    // committed command resolves that identity; it must never mint another bag.
    if(!sample&&target.startsWith('EXT-')) {
        const prior=await db.commandReceipt.findFirst({where:{actor:actor.username,commandType:'RECORD_INTAKE',targetResource:target}});
        const created=prior&&templates.parse(prior.outcome);
        if(created?.id) sample=await db.sample.findUnique({where:{id:created.id}});
    }
    const context=await templates.intakeContext({actor,sample,projectId:input.projectId||input.projectCode,origin:input.isWalkIn?'DESK_WALKIN':input.origin,matrix:input.matrix,labId:input.receivingLabId||input.assignedLab},db);
    if(receipt) {
        if(receipt.actor!==context.actor.username||receipt.commandType!=='RECORD_INTAKE'||receipt.targetResource!==target||previous.payloadHash!==payloadHash) throw error(409,'INTAKE_OPERATION_REUSED',{preserveInput:true});
        return {...previous,duplicate:true,receiptId:receipt.id};
    }
    await admission(context.actor,context,sample,{...input,_channel:command.channel||'DESK'},db);
    const effective=await templates.resolve(context,sample,db,{forCapture:true});
    templates.verifyToken(input,effective);
    if(sample&&(sample.approvedAt||facts.LOCKED_INTAKE_STATUSES.includes(sample.status))) throw error(403,'SAMPLE_LOCKED');
    if(input.expectedUpdatedAt&&(!sample||new Date(input.expectedUpdatedAt).getTime()!==sample.updatedAt.getTime())) throw error(409,'CONCURRENT_MODIFICATION',{preserveInput:true});
    if(sample&&templates.parse(sample.receptionData).intakeTemplate&&!input.expectedUpdatedAt) throw error(409,'INTAKE_VERSION_REQUIRED',{preserveInput:true});
    if(command.offline && !input.intent && !input.isDraft && !input.intakeTemplate) throw error(409,'INTAKE_REVIEW_REQUIRED',{preserveInput:true,reason:'Legacy queued intake needs an explicit decision and template review.'});
    if(command.offline && intent==='ACCEPT' && !input.intakeTemplate) throw error(409,'INTAKE_REVIEW_REQUIRED',{preserveInput:true,reason:'Review the effective intake form before synchronizing acceptance.'});
    let payload=mergeFacts(sample,input);
    if(command.requireRecordedIntake && intent==='ACCEPT'&&(!payload.checklist||!Object.keys(payload.checklist.items??payload.checklist).length)) throw error(409,'INTAKE_REVIEW_REQUIRED',{preserveInput:true,receptionPath:'/reception',reason:'Complete the reception record before accepting this sample.'});
    payload.originalId=sample?.originalId||target;
    payload.projectId=context.projectId;
    payload.matrix=context.matrix;
    payload.isWalkIn=context.origin==='DESK_WALKIN';
    payload.isDraft=intent==='SAVE_DRAFT'||intent==='RECEIVE';
    payload.decision=intent==='REJECT'?'REJECTED':'ACCEPTED';
    payload._channel=command.channel||'DESK';
    const answers=mappedAnswers(payload,effective);
    const evaluation=schema.evaluate(effective.schema,payload.checklist,answers,context);
    payload._evaluation=evaluation;
    if(Object.keys(evaluation.fieldErrors).length&&intent==='ACCEPT') throw error(422,'INTAKE_FIELD_VALIDATION',{fields:evaluation.fieldErrors});
    if(evaluation.unknownItems.length&&intent==='ACCEPT') throw error(422,'UNKNOWN_INTAKE_CRITERIA',{criteria:evaluation.unknownItems});
    // Invalid entered values are not silently normalized away when saving an incomplete draft.
    const invalid=Object.fromEntries(Object.entries(evaluation.fieldErrors).filter(([,code])=>code!=='REQUIRED'));
    if(Object.keys(invalid).length) throw error(422,'INTAKE_FIELD_VALIDATION',{fields:invalid});
    const user={...context.actor,labId:context.labId};
    const result=await facts.executeFacts(payload,user,db);
    let current=await db.sample.findUnique({where:{id:result.id}});
    if(intent==='RECEIVE') {
        current=await require('./sampleStateService').transitionSample(current.id,'RECEIVED',user,'Physical arrival recorded; acceptance pending',{receptionDate:current.receptionDate||new Date(),receivedBy:current.receivedBy||user.username,dryingStatus:null,preparationStatus:null},db);
        result.status=current.status;
    }
    const stored=templates.parse(current.receptionData);
    const commandFacts=Object.fromEntries(FACT_KEYS.filter(k=>payload[k]!==undefined).map(k=>[k,payload[k]]));
    const snapshot=templates.snapshot(effective,payload.checklist||{},answers,evaluation,user,capturedAtLocal);
    const metadata=templates.parse(current.metadata);
    if(payload.sampleType) Object.assign(metadata,{sampleType:payload.sampleType,ptRound:payload.ptRound||null,expectedValues:payload.expectedValues||null});
    current=await db.sample.update({where:{id:current.id},data:{matrix:context.matrix,consignmentId:command.consignmentId||undefined,metadata:JSON.stringify(metadata),receptionData:JSON.stringify({...stored,intakeTemplate:snapshot,commandFacts,capturedAtLocal:capturedAtLocal||null,bulkAttestation:payload.bulkAttestation?{...payload.bulkAttestation,actorId:user.id,confirmedAt:new Date().toISOString()}:undefined})}});
    const outcome={...result,receptionData:current.receptionData,updatedAt:current.updatedAt.toISOString(),operationId,intakeTemplate:{templateId:effective.templateId,revisionId:effective.revisionId,schemaHash:effective.schemaHash},sampleId:current.id,persistence:'SERVER_CONFIRMED'};
    const saved=await receipts.recordReceipt(db,{idempotencyKey:operationId,commandType:'RECORD_INTAKE',targetResource:target,actor:user.username,outcome,payloadHash});
    return {...outcome,receiptId:saved.id};
}
async function executeIntake(command,db=prisma) {return db.$transaction(tx=>executeIntakeInTransaction(command,tx),{timeout:30000});}
async function executeConsignment({actor,payload,operationId},db=prisma) {
    const {consignment:rawHeader={},defaults={},samples=[],custody={}}=payload||{};
    // Keep the original consignment transport's custody facts. Actor identity is
    // still supplied by the authenticated command, never by this compatibility map.
    const header={...rawHeader,custodyHandoverAt:rawHeader.custodyHandoverAt??custody.handoverAt,custodyCarrierName:rawHeader.custodyCarrierName??custody.carrierName,custodyTrackingNumber:rawHeader.custodyTrackingNumber??custody.trackingNumber,custodySenderSignature:rawHeader.custodySenderSignature??custody.senderSignature,receivingOfficerSignature:rawHeader.receivingOfficerSignature??custody.officerSignature};
    if(!Array.isArray(samples)||!samples.length||samples.length>200) throw error(400,'INVALID_CONSIGNMENT_SIZE');
    if(defaults.checklist&&!payload.bulkAttestation?.confirmed) throw error(422,'BULK_CONFIRMATION_REQUIRED');
    const id=operationId||crypto.randomUUID(),digest=schema.hash(payload),now=new Date();
    return db.$transaction(async tx=>{
        const contexts=[];
        for(const [index,row] of samples.entries()) {
            const ref=String(row.originalId||row.sampleId||row.id||'').trim();
            if(!ref) throw error(422,'MISSING_IDENTIFIER',{row:index+1});
            const existing=await tx.sample.findFirst({where:{OR:[{originalId:ref},{id:ref}]}});
            const context=await templates.intakeContext({actor,sample:existing,projectId:row.projectId||row.projectCode||header.projectId||header.projectCode,origin:row.isWalkIn?'DESK_WALKIN':row.origin,matrix:row.matrix},tx);
            if(header.projectId&&existing?.projectId&&header.projectId!==existing.projectId&&header.projectId!==existing.projectCode||header.projectCode&&existing?.projectCode&&header.projectCode!==existing.projectCode) throw error(400,'CROSS_PROJECT_CONFLICT',{row:index+1});
            contexts.push({...context,existing});
        }
        const receipt=await tx.commandReceipt.findUnique({where:{idempotencyKey:id}});
        if(receipt) {
            const old=templates.parse(receipt.outcome);
            if(receipt.actor!==contexts[0].actor.username||receipt.commandType!=='RECORD_CONSIGNMENT'||old.payloadHash!==digest) throw error(409,'INTAKE_OPERATION_REUSED');
            return {...old,duplicate:true,receiptId:receipt.id};
        }
        for(const [index,context] of contexts.entries()) {
            await admission(context.actor,context,context.existing,{...payload,...samples[index],_channel:'MANIFEST'},tx);
            await templates.resolve(context,context.existing,tx,{forCapture:true});
        }
        const labId=contexts[0].labId;
        if(contexts.some(c=>c.labId!==labId)) throw error(403,'CONSIGNMENT_LAB_CONFLICT');
        const prefix=`CSG-${now.toISOString().slice(0,10).replace(/-/g,'')}-`;
        const count=await tx.consignment.count({where:{code:{startsWith:prefix}}});
        const code=prefix+String(count+1).padStart(3,'0');
        const rejectedCount=samples.filter(s=>['REJECTED','REJECT'].includes(s.status||s.decision)).length;
        const acceptedCount=samples.length-rejectedCount;
        const consignment=await tx.consignment.create({data:{id:crypto.randomUUID(),code,labId,projectCode:contexts[0].projectCode,submitterName:header.submitterName||header.submitter?.name||null,submitterOrg:header.submitterOrg||header.submitter?.organization||null,submitterPhone:header.submitterPhone||header.submitter?.phone||null,submitterEmail:header.submitterEmail||header.submitter?.email||null,deliveredBy:header.deliveredBy||null,deliveredAt:header.deliveredAt?new Date(header.deliveredAt):null,receivedBy:contexts[0].actor.username,receivedAt:now,deliveryNoteRef:header.deliveryNoteRef||null,expectedCount:header.expectedCount==null?samples.length:Number(header.expectedCount),sampleCount:samples.length,acceptedCount,rejectedCount,status:rejectedCount===samples.length?'REJECTED':rejectedCount?'PARTIAL':'RECEIVED',custodyHandoverAt:header.custodyHandoverAt?new Date(header.custodyHandoverAt):now,custodyCarrierName:header.custodyCarrierName||header.deliveredBy||null,custodyTrackingNumber:header.custodyTrackingNumber||header.deliveryNoteRef||null,custodySenderSignature:header.custodySenderSignature||null,receivingOfficerId:contexts[0].actor.id,receivingOfficerName:contexts[0].actor.name||contexts[0].actor.username,receivingOfficerSignature:header.receivingOfficerSignature||`CONFIRMED:${contexts[0].actor.username}:${now.toISOString()}`,notes:header.notes||null,metadata:header.metadata?JSON.stringify(header.metadata):null}});
        const processed=[];
        for(const [index,row] of samples.entries()) {
            const intent=['REJECTED','REJECT'].includes(row.status||row.decision)?'REJECT':'ACCEPT';
            const merged={...defaults,...row,originalId:row.originalId||row.sampleId||row.id,projectId:contexts[index].projectId,isWalkIn:contexts[index].origin==='DESK_WALKIN',_channel:'MANIFEST',bulkAttestation:payload.bulkAttestation?.confirmed?{confirmed:true,criterionIds:payload.bulkAttestation.criterionIds||Object.keys(defaults.checklist?.items||{}),operationId:id}:undefined,ncReason:row.ncReason||row.rejectionReason,submitterDetails:row.submitterDetails||(header.submitterName||header.submitter?.name?{name:header.submitterName||header.submitter?.name}:undefined),custodyHandoverAt:row.custodyHandoverAt||header.custodyHandoverAt,custodyCarrierName:row.custodyCarrierName||header.custodyCarrierName||header.deliveredBy,custodyTrackingNumber:row.custodyTrackingNumber||header.custodyTrackingNumber||header.deliveryNoteRef,custodySenderSignature:row.custodySenderSignature||header.custodySenderSignature,receivingOfficerSignature:row.receivingOfficerSignature||header.receivingOfficerSignature};
            try {processed.push(await executeIntakeInTransaction({actor,payload:merged,intent,operationId:`${id}:${index}`,consignmentId:consignment.id,channel:'MANIFEST'},tx));}
            catch(err) {err.details={...err.details,row:index+1};throw err;}
        }
        await tx.auditLog.create({data:{id:crypto.randomUUID(),entity:'CONSIGNMENT',entityId:consignment.id,action:'CONSIGNMENT_BATCH_RECEIVED',details:JSON.stringify({code,acceptedCount,rejectedCount}),performedBy:contexts[0].actor.username,timestamp:now}});
        const outcome={success:true,consignment,samples:processed,message:`Batch received ${samples.length} samples under Consignment ${code}.`};
        const saved=await receipts.recordReceipt(tx,{idempotencyKey:id,commandType:'RECORD_CONSIGNMENT',targetResource:consignment.id,actor:contexts[0].actor.username,outcome,payloadHash:digest});
        return {...outcome,receiptId:saved.id};
    },{timeout:60000});
}
function sendError(res,err) {
    const status=err.status||err.statusCode||(err instanceof require('./profileIdentityService').ProfileReferenceConflictError?409:500);
    const code=status===500?'INTAKE_UNAVAILABLE':err.code||'INTAKE_VALIDATION_FAILED';
    if(status===500) console.error('[INTAKE_COMMAND] Unexpected failure:',err);
    return res.status(status).json({success:false,error:code,code,message:status===500?'Intake could not be saved. Your input has been kept.':err.details?.message||err.message,...(status<500?err.details||{}:{})});
}
module.exports={executeIntake,executeIntakeInTransaction,executeConsignment,sendError,mergeFacts,mappedAnswers,FACT_KEYS};
