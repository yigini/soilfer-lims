const fs=require('node:fs'),path=require('node:path');
const {randomUUID}=require('node:crypto');
const Database=require('better-sqlite3');
const {PrismaClient}=require('../../prisma_client');
const {PrismaBetterSqlite3}=require('@prisma/adapter-better-sqlite3');
const {beforeGuards}=require('../helpers/legacyWorkflowDatabase');
const {installWorkAttemptContract}=require('../../scripts/install_work_attempt_contract');
const writer=require('../../services/resultWriteService');
const {validateResultEntries}=require('../../services/resultEntryPolicy');
const directory=path.resolve(__dirname,'../.tmp'),file=path.join(directory,'audit_legacy_190_execution-'+randomUUID()+'.db');
const labId='LAB-190-EXECUTION',actor={username:'attempt-executor',role:'LAB_MANAGER',labId};
let client;
beforeAll(async()=>{
    fs.mkdirSync(directory,{recursive:true});beforeGuards({actor:'system:fixture',file,qcBootstrap:'CREATE_PRISMA'});
    const db=new Database(file);db.exec('CREATE TABLE _schema_migrations(id TEXT PRIMARY KEY,details TEXT NOT NULL)');db.close();
    installWorkAttemptContract({dbPath:file,apply:true});client=new PrismaClient({adapter:new PrismaBetterSqlite3({url:'file:'+file})});
    await client.lab.create({data:{id:labId,code:labId,name:'Attempt execution laboratory',country:'TEST'}});
    for(const code of ['AT190','TEXTURE','SAND','SILT','CLAY'])await client.analysis.create({data:{code,name:'Controlled '+code+' measurand',
        units:code==='AT190'?'g/kg':'%',validation:code==='TEXTURE'?'{"tolerance":2}':'{"type":"numeric"}',prerequisites:'[]'}});
},60000);
afterAll(async()=>{
    if(client)await client.$disconnect();
    if(path.dirname(file)!==directory || !path.basename(file).startsWith('audit_legacy_190_execution-'))throw Error('Unexpected fixture path');
    for(const suffix of ['','-wal','-shm'])fs.rmSync(file+suffix,{force:true});
});
async function fixture(analyses=['AT190'],{work=true}={}) {
    const sampleId=randomUUID();
    const sample=await client.sample.create({data:{id:sampleId,originalId:sampleId,labId:sampleId,assignedLab:labId,status:'PROCESSING',
        dryingStatus:'DONE',preparationStatus:'DONE',requiredAnalyses:JSON.stringify(analyses)}});
    const items=[];
    if(work)for(const analysis of analyses)items.push(await client.workItem.create({data:{id:randomUUID(),sampleId,analysis,assignedLab:labId,status:'IN_PROGRESS',history:'[]'}}));
    return {sample,items};
}
const options=(f,param='AT190',value='6.42')=>({sampleId:f.sample.id,actor,measurement:{param,value,replicateNo:1}});
async function all(f) {return {attempts:await client.workAttempt.findMany({where:{workItemId:{in:f.items.map(row=>row.id)}},orderBy:{id:'asc'}}),
    results:await client.result.findMany({where:{sampleId:f.sample.id},orderBy:{id:'asc'}}),items:await client.workItem.findMany({where:{sampleId:f.sample.id},orderBy:{id:'asc'}}),
    audits:await client.auditLog.findMany({where:{sampleId:f.sample.id},orderBy:{id:'asc'}})};}

test('ordinary executions allocate max+1 and preserve every old attempt field and final evidence',async()=>{
    const f=await fixture(),first=await client.$transaction(tx=>writer.writeResult(tx,options(f)));
    const original=await client.workAttempt.findUnique({where:{id:first.attemptId}});
    const second=await client.$transaction(tx=>writer.writeResult(tx,options(f,'AT190','6.43')));
    expect(await client.workAttempt.findUnique({where:{id:first.attemptId}})).toEqual(original);
    expect(await client.workAttempt.findUnique({where:{id:second.attemptId}})).toMatchObject({attemptNo:2,reason:null,status:'RECORDED'});
    expect(JSON.parse(original.evidenceData)).toMatchObject({source:'measurement',rawValue:'6.42',resultId:first.id,sourceResultIds:[first.id],equipmentReadiness:null});
    expect(first.equipmentReadiness).toBeNull();
});
test('all replicates in one submitted execution share one attempt; later execution preserves that evidence',async()=>{
    const f=await fixture();
    const rows=await client.$transaction(tx=>writer.writeResultsExecution(tx,{sampleId:f.sample.id,actor,
        measurements:[{param:'AT190',value:'6.41',replicateNo:1},{param:'AT190',value:'6.42',replicateNo:2}]}));
    expect(new Set(rows.map(row=>row.attemptId)).size).toBe(1);
    const attempt=await client.workAttempt.findUnique({where:{id:rows[0].attemptId}});
    expect(attempt.attemptNo).toBe(1);expect(JSON.parse(attempt.evidenceData).sourceResultIds).toEqual(rows.map(row=>row.id));
    expect(await client.workAttempt.count({where:{workItemId:f.items[0].id}})).toBe(1);
    await client.$transaction(tx=>writer.writeResult(tx,options(f)));
    expect(await client.workAttempt.findUnique({where:{id:attempt.id}})).toEqual(attempt);
});
test('one texture execution records all four Results on its final attempt and a repeat gets number2 with null reason',async()=>{
    const f=await fixture(['TEXTURE']);
    const texture={sampleId:f.sample.id,workItemId:f.items[0].id,actor,measurement:{param:'TEXTURE'},fractions:{sand:'40',silt:'40',clay:'20'}};
    const first=await client.$transaction(tx=>writer.writeTextureDetermination(tx,texture));
    const original=await client.workAttempt.findUnique({where:{id:first.attemptId}});
    const rows=await client.result.findMany({where:{attemptId:first.attemptId}});
    expect(rows.map(row=>row.param).sort()).toEqual(['CLAY','SAND','SILT','TEXTURE']);
    expect(JSON.parse(original.evidenceData)).toMatchObject({fractions:{sand:40,silt:40,clay:20},className:first.value,closureError:0,
        sourceResultIds:expect.arrayContaining(rows.map(row=>row.id)),equipmentReadiness:null});
    const second=await client.$transaction(tx=>writer.writeTextureDetermination(tx,texture));
    expect(await client.workAttempt.findUnique({where:{id:second.attemptId}})).toMatchObject({attemptNo:2,reason:null});
    expect(await client.workAttempt.findUnique({where:{id:first.attemptId}})).toEqual(original);
});
test('invalid texture or noncanonical reason refuses without attempt, result, cache or audit writes',async()=>{
    const f=await fixture(['TEXTURE']),before=await all(f);
    await expect(client.$transaction(tx=>writer.writeTextureDetermination(tx,{...options(f,'TEXTURE'),workItemId:f.items[0].id,
        fractions:{sand:'bad',silt:'40',clay:'20'}}))).rejects.toMatchObject({statusCode:422});
    expect(await all(f)).toEqual(before);
    await expect(client.$transaction(tx=>writer.writeTextureDetermination(tx,{...options(f,'TEXTURE'),workItemId:f.items[0].id,
        repeatReason:'invented reason',fractions:{sand:'40',silt:'40',clay:'20'}}))).rejects.toMatchObject({code:'WORK_ATTEMPT_REASON_INVALID'});
    expect(await all(f)).toEqual(before);
});
test.each(['measurement','spectral-prediction'])('ordered %s without work refuses before any write',async source=>{
    const f=await fixture(['AT190'],{work:false}),before=await all(f);
    await expect(client.$transaction(tx=>writer.writeResult(tx,{...options(f),source}))).rejects.toMatchObject({code:'RESULT_WORKITEM_REQUIRED',statusCode:409});
    await expect(validateResultEntries(client,f.sample,[options(f).measurement],actor)).rejects.toMatchObject({code:'RESULT_WORKITEM_REQUIRED',statusCode:409});
    expect(await all(f)).toEqual(before);
});
test('an orphan historical import stays exempt, while an import with canonical work gets an attempt',async()=>{
    const orphan=await fixture(['AT190'],{work:false}),normal=await fixture();
    const imported=await client.$transaction(tx=>writer.writeResult(tx,{...options(orphan),source:'legacy-import'}));
    expect(imported).toMatchObject({provenance:'IMPORTED',attemptId:null,value:'6.42'});
    const linked=await client.$transaction(tx=>writer.writeResult(tx,{...options(normal),source:'legacy-import'}));
    expect(linked.attemptId).toEqual(expect.any(String));expect(linked.provenance).toBe('IMPORTED');
    expect(JSON.parse((await client.workAttempt.findUnique({where:{id:linked.attemptId}})).evidenceData).source).toBe('legacy-import');
});
test('separate fraction work produces one TEXTURE attempt with source ids and leaves fraction attempts untouched',async()=>{
    const f=await fixture(['SAND','SILT','CLAY','TEXTURE']);
    const fractions=[];
    for(const [index,param] of ['SAND','SILT','CLAY'].entries())fractions.push(await client.$transaction(tx=>writer.writeResult(tx,options(f,param,[40,40,20][index]))));
    const original=await client.workAttempt.findMany({where:{id:{in:fractions.map(row=>row.attemptId)}},orderBy:{id:'asc'}});
    const derived=await client.$transaction(tx=>writer.deriveTextureResult(tx,{sampleId:f.sample.id,actor}));
    const attempt=await client.workAttempt.findUnique({where:{id:derived.attemptId}});
    expect(attempt).toMatchObject({workItemId:f.items[3].id,attemptNo:1,instrumentId:null,status:'RECORDED'});
    expect(JSON.parse(attempt.evidenceData)).toMatchObject({sourceResultIds:fractions.map(row=>row.id),sourceAttemptIds:fractions.map(row=>row.attemptId),equipmentReadiness:null});
    expect(await client.workAttempt.findMany({where:{id:{in:fractions.map(row=>row.attemptId)}},orderBy:{id:'asc'}})).toEqual(original);
});
test('direct derivation without TEXTURE work refuses and leaves recorded fractions unchanged',async()=>{
    const f=await fixture(['SAND','SILT','CLAY']);
    for(const [index,param] of ['SAND','SILT','CLAY'].entries())await client.$transaction(tx=>writer.writeResult(tx,options(f,param,[40,40,20][index])));
    const before=await all(f);
    await expect(client.$transaction(tx=>writer.deriveTextureResult(tx,{sampleId:f.sample.id,actor}))).rejects.toMatchObject({code:'RESULT_WORKITEM_REQUIRED',statusCode:409});
    expect(await all(f)).toEqual(before);
});
