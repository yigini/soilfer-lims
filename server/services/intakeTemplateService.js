'use strict';
const crypto=require('crypto');
const prisma=require('../prisma');
const schema=require('./intakeSchema');
const originService=require('./sampleOriginService');
const membership=require('./projectMembershipService');
const policy=require('./projectPolicyService');
const {hasPermission}=require('../config/roles');
const {error}=schema;
function parse(value) {if(value==null||value==='') return {};try{return typeof value==='string'?JSON.parse(value):value;}catch{throw error(409,'INVALID_INTAKE_SNAPSHOT');}}
async function actorFor(actor,db) {
    const current=actor?.id?await db.user.findUnique({where:{id:String(actor.id)}}):null;
    if(!current||!current.isActive) throw error(403,'INTAKE_AUTHORITY_CHANGED');
    return current;
}
async function configureAuthority(actor,labId,db=prisma,projectId=null) {
    const current=await actorFor(actor,db),lab=await db.lab.findUnique({where:{id:labId}});
    if(!lab || !(current.role==='SUPER_ADMIN'||current.role==='LAB_MANAGER'&&current.labId===labId)) throw error(403,'INTAKE_CONFIGURATION_FORBIDDEN');
    if(projectId) {
        const project=await db.project.findUnique({where:{id:projectId}});
        const members=await membership.resolveProjectLabs(project,db);
        if(!hasPermission(current,'MANAGE_PROJECTS')||!project||!members.isMember(labId)||!policy.canEditProjectPlan(current,project)||!policy.canReadProject(current,project,{memberLabIds:members.allMemberLabIds})) throw error(403,'INTAKE_PROJECT_BINDING_FORBIDDEN');
    }
    return current;
}
async function intakeContext({actor,sample,projectId,origin,matrix,labId},db=prisma) {
    const current=await actorFor(actor,db);
    if(!hasPermission(current,'RECEIVE_SAMPLE')) throw error(403,'PERMISSION_DENIED');
    const target=sample?.assignedLab||current.labId||(current.role==='SUPER_ADMIN'?labId:null);
    const lab=target&&await db.lab.findUnique({where:{id:target}});
    if(labId&&labId!==target) throw error(403,'TARGET_OUTSIDE_SCOPE');
    if(!lab?.isActive || (current.role!=='SUPER_ADMIN'&&current.labId!==lab.id)) throw error(403,'MISSING_LAB_SCOPE');
    if(sample) require('../utils/scopeGuard').ensureScope(current,sample,{altLabField:'assignedLab'});
    const resolved=await policy.resolveProject(sample?.projectId||sample?.projectCode||projectId,db);
    const project=resolved?.project||null;
    if(projectId&&!project) throw error(422,'PROJECT_NOT_FOUND');
    if(project) {
        const members=await membership.resolveProjectLabs(project,db);
        if(!members.isMember(lab.id)||!policy.canReadProject(current,project,{memberLabIds:members.allMemberLabIds})) throw error(403,'INTAKE_PROJECT_SCOPE_FORBIDDEN');
    }
    const trustedOrigin=sample?originService.detectSampleOrigin(sample):project?'PROJECT_SAMPLE':origin==='DESK_WALKIN'?'DESK_WALKIN':'AMBIGUOUS';
    const trustedMatrix=String(sample?.matrix||matrix||'SOIL').toUpperCase();
    if(!/^[A-Z][A-Z0-9_]{0,39}$/.test(trustedMatrix)) throw error(422,'INVALID_MATRIX');
    return {actor:current,labId:lab.id,projectId:project?.id||null,projectCode:project?.code||null,project,origin:trustedOrigin,matrix:trustedMatrix};
}
const selectorKey=({labId,projectId=null,matrix='SOIL',origin='*'})=>JSON.stringify([labId,projectId||null,String(matrix).toUpperCase(),origin||'*']);
function envelope(revision,source,saved,context) {
    const form=schema.validateSchema(JSON.parse(revision.schemaJson));
    if(revision.schemaHash!==schema.hash(form)) throw error(409,'INVALID_TEMPLATE_HASH');
    return {name:revision.template?.name||revision.templateId,templateId:revision.templateId,revisionId:revision.id,version:revision.version,schemaVersion:revision.schemaVersion,schemaHash:revision.schemaHash,resolutionSource:source,criteria:form.criteria,contextFields:form.contextFields,schema:form,savedAnswers:saved?.checklist||null,savedContext:saved?.contextAnswers||{},context:{labId:context.labId,projectId:context.projectId,matrix:context.matrix,origin:context.origin},capabilities:{canConfigure:context.actor.role==='SUPER_ADMIN'||context.actor.role==='LAB_MANAGER'&&context.actor.labId===context.labId}};
}
async function resolve(context,sample=null,db=prisma,{forCapture=false}={}) {
    const stored=parse(sample?.receptionData),pin=stored.intakeTemplate;
    if(pin) {
        const rev=await db.intakeTemplateRevision.findUnique({where:{id:pin.revisionId},include:{template:true}});
        const historical=!forCapture&&sample&&['ACCEPTED','LAB_ID_ASSIGNED','PROCESSING','COMPLETED','APPROVED','ARCHIVED','DISPOSED','SUBMITTED_PARTIAL','SUBMITTED_FULL','IN_PROGRESS','RECEIVED_REJECTED'].includes(sample.status);
        if(!rev||!['PUBLISHED','RETIRED',...(historical?['REVOKED']:[])].includes(rev.state)) throw error(409,'INTAKE_TEMPLATE_RECOVERY_REQUIRED',{reason:rev?.state||'MISSING_REVISION',preserveInput:true});
        if(rev.templateId!==pin.templateId||rev.schemaHash!==pin.schemaHash||schema.hash(pin.schema)!==rev.schemaHash||(rev.template.labId&&rev.template.labId!==context.labId)) throw error(409,'INVALID_TEMPLATE_PIN',{preserveInput:true});
        return envelope(rev,'SAVED_REVISION',pin,context);
    }
    for(const projectId of [context.projectId,null].filter((v,i,a)=>a.indexOf(v)===i)) {
        for(const origin of [context.origin,'*']) {
            const binding=await db.intakeTemplateBinding.findUnique({where:{selectorKey:selectorKey({...context,projectId,origin})},include:{revision:{include:{template:true}}}});
            if(binding&&binding.revision.state==='PUBLISHED'&&binding.revision.template.status==='ACTIVE') return envelope(binding.revision,projectId?'PROJECT_BINDING':'LAB_DEFAULT',null,context);
        }
    }
    const seed=context.matrix!=='SOIL'?'INTAKE-SEED-COMPATIBLE':context.origin==='DESK_WALKIN'?'INTAKE-SEED-COMMERCIAL':context.project?.projectType==='RESEARCH'?'INTAKE-SEED-RESEARCH':'INTAKE-SEED-SOILFER';
    const rev=await db.intakeTemplateRevision.findUnique({where:{id:`${seed}-1`},include:{template:true}});
    if(!rev) throw error(503,'INTAKE_TEMPLATE_UNAVAILABLE');
    return envelope(rev,'COMPATIBLE_SEED',null,context);
}
function verifyToken(payload,effective) {
    const pin=payload.intakeTemplate;
    if(Object.prototype.hasOwnProperty.call(payload,'intakeTemplate')&&(!pin||pin.revisionId!==effective.revisionId||pin.schemaHash!==effective.schemaHash||pin.templateId!==effective.templateId)) throw error(409,'INTAKE_TEMPLATE_CHANGED',{effective:{templateId:effective.templateId,revisionId:effective.revisionId,schemaHash:effective.schemaHash},preserveInput:true});
}
function snapshot(effective,checklist,contextAnswers,evaluation,actor,capturedAtLocal) {
    return {name:effective.name,version:effective.version,templateId:effective.templateId,revisionId:effective.revisionId,schemaHash:effective.schemaHash,schemaVersion:effective.schemaVersion,schema:effective.schema,context:effective.context,resolutionSource:effective.resolutionSource,checklist,contextAnswers,evaluation,actorId:actor.id,recordedAt:new Date().toISOString(),capturedAtLocal:capturedAtLocal||null};
}
async function audit(db,actor,labId,action,details) {return db.auditLog.create({data:{id:crypto.randomUUID(),entity:'LAB',entityId:labId,action,details:JSON.stringify(details),performedBy:actor.username,timestamp:new Date()}});}
async function list(actor,labId,db=prisma) {
    await configureAuthority(actor,labId,db);
    const templates=await db.intakeTemplate.findMany({where:{OR:[{labId},{labId:null}]},include:{revisions:{orderBy:{version:'desc'}}},orderBy:{name:'asc'}});
    const bindings=await db.intakeTemplateBinding.findMany({where:{labId}});
    return {templates:templates.map(t=>({...t,revisions:t.revisions.map(r=>({...r,schema:JSON.parse(r.schemaJson)}))})),bindings};
}
async function bindInTx(actor,input,db) {
    const projectId=input.projectId||null;
    const current=await configureAuthority(actor,input.labId,db,projectId);
    const matrix=String(input.matrix||'SOIL').toUpperCase(),origin=input.origin||'*';
    if(!/^[A-Z][A-Z0-9_]{0,39}$/.test(matrix)||!['*',...Object.values(originService.ORIGIN_TYPES)].includes(origin)) throw error(422,'INVALID_INTAKE_SELECTOR');
    const rev=await db.intakeTemplateRevision.findUnique({where:{id:input.revisionId},include:{template:true}});
    if(!rev||rev.state!=='PUBLISHED'||rev.template.status!=='ACTIVE'||rev.template.matrix!==matrix&&rev.template.matrix!=='OTHER'||rev.template.labId&&rev.template.labId!==input.labId) throw error(422,'INVALID_TEMPLATE_BINDING');
    const key=selectorKey({labId:input.labId,projectId,matrix,origin}),previous=await db.intakeTemplateBinding.findUnique({where:{selectorKey:key}});
    if((previous?.editVersion||0)!==input.expectedVersion) throw error(409,'INTAKE_SETTINGS_CHANGED');
    const data={projectId,matrix,origin,revisionId:rev.id,updatedBy:current.id,editVersion:(previous?.editVersion||0)+1};
    const saved=previous?await db.intakeTemplateBinding.update({where:{id:previous.id,editVersion:previous.editVersion},data}):await db.intakeTemplateBinding.create({data:{...data,id:crypto.randomUUID(),selectorKey:key,labId:input.labId}});
    await audit(db,current,input.labId,'INTAKE_BINDING_UPDATED',{selectorKey:key,oldRevisionId:previous?.revisionId||null,revisionId:rev.id});
    return saved;
}
const bind=(actor,input,db=prisma)=>db.$transaction(tx=>bindInTx(actor,input,tx));
async function saveBasic(actor,input,db=prisma) {
    return db.$transaction(async tx=>{
        const current=await configureAuthority(actor,input.labId,tx,input.projectId||null);
        const form=schema.validateSchema(input.schema,{basic:true});
        const source=await tx.intakeTemplateRevision.findUnique({where:{id:input.sourceRevisionId},include:{template:true}});
        if(!source||!['PUBLISHED','RETIRED'].includes(source.state)||source.schemaHash!==input.sourceHash||source.template.labId&&source.template.labId!==input.labId) throw error(409,'INTAKE_SETTINGS_CHANGED');
        const original=schema.validateSchema(JSON.parse(source.schemaJson));
        // Basic controls may only toggle enabled/required. Scientific semantics need the governed editor.
        const stripped=value=>({...value,criteria:value.criteria.map(({enabled,required,...r})=>r),contextFields:value.contextFields.map(({enabled,required,...r})=>r)});
        if(schema.hash(stripped(original))!==schema.hash(stripped(form))) throw error(422,'BASIC_SETTINGS_TOGGLES_ONLY');
        const template=await tx.intakeTemplate.create({data:{id:crypto.randomUUID(),labId:input.labId,name:String(input.name||source.template.name).slice(0,120),matrix:form.matrix,createdBy:current.id}});
        const revision=await tx.intakeTemplateRevision.create({data:{id:crypto.randomUUID(),templateId:template.id,version:1,schemaVersion:schema.SCHEMA_VERSION,schemaJson:JSON.stringify(form),schemaHash:schema.hash(form),state:'PUBLISHED',createdBy:current.id,publishedBy:current.id,publishedAt:new Date()}});
        const binding=await bindInTx(current,{...input,revisionId:revision.id,matrix:form.matrix},tx);
        await audit(tx,current,input.labId,'INTAKE_TEMPLATE_PUBLISHED',{templateId:template.id,revisionId:revision.id,sourceRevisionId:source.id});
        return {template,revision:{...revision,schema:form},binding};
    });
}
module.exports={parse,actorFor,configureAuthority,intakeContext,selectorKey,resolve,verifyToken,snapshot,audit,list,bind,bindInTx,saveBasic,envelope};
