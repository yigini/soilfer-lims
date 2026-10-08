const fs=require('node:fs'),path=require('node:path');
const {randomUUID}=require('node:crypto');
const Database=require('better-sqlite3');
const {PrismaClient}=require('../../prisma_client');
const {PrismaBetterSqlite3}=require('@prisma/adapter-better-sqlite3');
const {beforeGuards}=require('../helpers/legacyWorkflowDatabase');
const {createSampleFixture,createWorkItemFixture}=require('../helpers/workflowFixtures');
const {installWorkAttemptContract}=require('../../scripts/install_work_attempt_contract');
const {requestRepeat}=require('../../services/workRepeatService');
const writer=require('../../services/resultWriteService');
const {validateResultEntries}=require('../../services/resultEntryPolicy');
const request=require('supertest'),jwt=require('jsonwebtoken'),express=require('express');
const directory=path.resolve(__dirname,'../.tmp'),file=path.join(directory,'audit_legacy_190_execution-'+randomUUID()+'.db');
const labId='LAB-190-EXECUTION',actor={username:'attempt-executor',role:'LAB_MANAGER',labId};
let client;
beforeAll(async()=>{
    fs.mkdirSync(directory,{recursive:true});beforeGuards({actor:'system:fixture',file,qcBootstrap:'CREATE_PRISMA'});
    const db=new Database(file);db.exec('CREATE TABLE _schema_migrations(id TEXT PRIMARY KEY,details TEXT NOT NULL)');db.close();
    installWorkAttemptContract({dbPath:file,apply:true});
    require('../helpers/repeatQcPredecessors').installRepeatQcPredecessors(file);
    require('../../scripts/install_work_repeat_contract').installWorkRepeatContract({dbPath:file,apply:true});
    client=new PrismaClient({adapter:new PrismaBetterSqlite3({url:'file:'+file})});
    await client.lab.create({data:{id:labId,code:labId,name:'Attempt execution laboratory',country:'TEST'}});
    await client.unit.create({data:{code:'%',display:'%',quantityKind:'MASS_FRACTION',factorToBase:1}});
    for(const code of ['AT190','TEXTURE','SAND','SILT','CLAY'])await client.analysis.create({data:{code,name:'Controlled '+code+' measurand',
        units:code==='AT190'?'g/kg':'%',validation:code==='TEXTURE'?'{"tolerance":2}':'{"type":"numeric"}',prerequisites:'[]'}});
},60000);
afterAll(async()=>{
    if(client)await client.$disconnect();
    if(path.dirname(file)!==directory || !path.basename(file).startsWith('audit_legacy_190_execution-'))throw Error('Unexpected fixture path');
    for(const suffix of ['','-wal','-shm'])fs.rmSync(file+suffix,{force:true});
});

test.each(['saveResults','batchSave'].flatMap(route=>[null,'another-analyst'].map(textureOwner=>[route,textureOwner])))
    ('%s retains fraction-only technician saves when canonical TEXTURE is owned by %s',async(route,textureOwner)=>{
        const analyst={id:randomUUID(),username:'fraction-analyst-'+randomUUID(),role:'LAB_TECHNICIAN',labId};
        await client.user.create({data:{...analyst,email:randomUUID()+'@example.test',password:'isolated-fixture',countries:'[]',projects:'[]'}});
        if(textureOwner)await client.user.upsert({where:{username:textureOwner},update:{},
            create:{id:randomUUID(),username:textureOwner,role:'LAB_TECHNICIAN',labId,email:randomUUID()+'@example.test',password:'isolated-fixture'}});
        const f=await fixture(['SAND','SILT','CLAY','TEXTURE']);
        const fractions=f.items.filter(item=>item.analysis!=='TEXTURE'),owner=f.items.find(item=>item.analysis==='TEXTURE');
        for(const item of fractions)await client.workItem.update({where:{id:item.id},data:{assignedTo:analyst.username}});
        await client.workItem.update({where:{id:owner.id},data:{assignedTo:textureOwner}});
        const readiness=await require('../../services/workbenchReadinessService').evaluateExecutionReadiness(client,
            {...owner,assignedTo:textureOwner,sample:f.sample},analyst);
        expect(readiness.blockers).toContain('UNASSIGNED_TO_USER');
        const previousSecret=process.env.JWT_SECRET;process.env.JWT_SECRET='owned-fraction-route-secret';
        try {
            await jest.isolateModulesAsync(async()=>{
                jest.doMock('../../prisma',()=>client);
                const app=express();app.use(express.json());
                app.use('/api/results',require('../../routes/resultsRoutes'));
                app.use('/api/workbench',require('../../routes/workbenchRoutes'));
                const token=jwt.sign({id:analyst.id,tokenVersion:0},process.env.JWT_SECRET,{expiresIn:'10m'});
                const auth={Authorization:`Bearer ${token}`},values=[40,40,20];
                const response=route==='saveResults'?
                    await request(app).post(`/api/results/${f.sample.id}`).set(auth).send({measurements:fractions.map((item,i)=>({param:item.analysis,value:String(values[i]),unit:'%'}))}):
                    await request(app).post('/api/workbench/batch-save').set(auth).send({draft:false,entries:fractions.map((item,i)=>({workItemId:item.id,value:String(values[i]),version:item.version}))});
                expect(response).toMatchObject({status:200});
                if(route==='batchSave')expect(response.body).toMatchObject({saved:3});
                const rows=await client.result.findMany({where:{sampleId:f.sample.id,isCurrent:true}});
                expect(rows.map(row=>row.param).sort()).toEqual(['CLAY','SAND','SILT','TEXTURE']);
                for(const [i,item]of fractions.entries()){
                    const row=rows.find(result=>result.param===item.analysis);
                    expect(row.numericValue).toBe(values[i]);
                    expect(await client.workAttempt.findUnique({where:{id:row.attemptId}})).toMatchObject({workItemId:item.id,status:'RECORDED'});
                }
                const derived=rows.find(row=>row.param==='TEXTURE');
                expect(derived).toMatchObject({provenance:'DERIVED',equipmentId:null,equipmentReadiness:null});
                const attempt=await client.workAttempt.findUnique({where:{id:derived.attemptId}});
                expect(attempt).toMatchObject({workItemId:owner.id,attemptNo:1,status:'RECORDED',instrumentId:null});
                expect(JSON.parse(attempt.evidenceData)).toMatchObject({equipmentReadiness:null,
                    sourceResultIds:expect.arrayContaining(rows.filter(row=>row.param!=='TEXTURE').map(row=>row.id))});
                expect(await client.workItem.findUnique({where:{id:owner.id}})).toMatchObject({assignedTo:textureOwner,status:'IN_PROGRESS'});
            });
        }finally{
            jest.dontMock('../../prisma');
            if(previousSecret===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=previousSecret;
        }
    });
async function fixture(analyses=['AT190'],{work=true}={}) {
    const sampleId=randomUUID();
    const sample=await createSampleFixture(client,{data:{id:sampleId,originalId:sampleId,labId:sampleId,assignedLab:labId,status:'PROCESSING',
        dryingStatus:'DONE',preparationStatus:'DONE',requiredAnalyses:JSON.stringify(analyses)}});
    const items=[];
    if(work)for(const analysis of analyses)items.push(await createWorkItemFixture(client,{data:{id:randomUUID(),sampleId,analysis,assignedLab:labId,status:'IN_PROGRESS',history:'[]'}}));
    return {sample,items};
}
const options=(f,param='AT190',value='6.42')=>({sampleId:f.sample.id,actor,measurement:{param,value,replicateNo:1}});
async function all(f) {return {attempts:await client.workAttempt.findMany({where:{workItemId:{in:f.items.map(row=>row.id)}},orderBy:{id:'asc'}}),
    results:await client.result.findMany({where:{sampleId:f.sample.id},orderBy:{id:'asc'}}),items:await client.workItem.findMany({where:{sampleId:f.sample.id},orderBy:{id:'asc'}}),
    audits:await client.auditLog.findMany({where:{sampleId:f.sample.id},orderBy:{id:'asc'}})};}

test('a reasoned repeat allocates max+1 and preserves every old field except its legitimate QUESTIONED transition',async()=>{
    const f=await fixture(),first=await client.$transaction(tx=>writer.writeResult(tx,options(f)));
    const original=await client.workAttempt.findUnique({where:{id:first.attemptId}});
    await requestRepeat(client,f.items[0].id,actor,{reason:'CONFIRMATION',note:'Explicit confirmation repeat'});
    const second=await client.$transaction(tx=>writer.writeResult(tx,options(f,'AT190','6.43')));
    expect(await client.workAttempt.findUnique({where:{id:first.attemptId}})).toEqual({...original,status:'QUESTIONED'});
    expect(await client.workAttempt.findUnique({where:{id:second.attemptId}})).toMatchObject({attemptNo:2,reason:'CONFIRMATION',status:'RECORDED'});
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
    await requestRepeat(client,f.items[0].id,actor,{reason:'CONFIRMATION',note:'Explicit replicate confirmation repeat'});
    await client.$transaction(tx=>writer.writeResult(tx,options(f)));
    expect(await client.workAttempt.findUnique({where:{id:attempt.id}})).toEqual({...attempt,status:'QUESTIONED'});
});
test('one texture execution records all four Results and an explicitly reasoned repeat gets number2',async()=>{
    const f=await fixture(['TEXTURE']);
    const texture={sampleId:f.sample.id,workItemId:f.items[0].id,actor,measurement:{param:'TEXTURE'},fractions:{sand:'40',silt:'40',clay:'20'}};
    const first=await client.$transaction(tx=>writer.writeTextureDetermination(tx,texture));
    const original=await client.workAttempt.findUnique({where:{id:first.attemptId}});
    const rows=await client.result.findMany({where:{attemptId:first.attemptId}});
    expect(rows.map(row=>row.param).sort()).toEqual(['CLAY','SAND','SILT','TEXTURE']);
    expect(JSON.parse(original.evidenceData)).toMatchObject({fractions:{sand:40,silt:40,clay:20},className:first.value,closureError:0,
        sourceResultIds:expect.arrayContaining(rows.map(row=>row.id)),equipmentReadiness:null});
    await requestRepeat(client,f.items[0].id,actor,{reason:'CONFIRMATION',note:'Explicit texture confirmation repeat'});
    const second=await client.$transaction(tx=>writer.writeTextureDetermination(tx,texture));
    expect(await client.workAttempt.findUnique({where:{id:second.attemptId}})).toMatchObject({attemptNo:2,reason:'CONFIRMATION'});
    expect(await client.workAttempt.findUnique({where:{id:first.attemptId}})).toEqual({...original,status:'QUESTIONED'});
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
// #190 pin6058155230: the import cases run through the real authenticated HTTP
// route in audit_1_5_result_writes.test.js, never this direct writer harness.
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
