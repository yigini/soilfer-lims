const fs=require('node:fs'),path=require('node:path');
const {randomUUID}=require('node:crypto');
const Database=require('better-sqlite3');
const {PrismaClient}=require('../../prisma_client');
const {PrismaBetterSqlite3}=require('@prisma/adapter-better-sqlite3');
const {beforeGuards}=require('../helpers/legacyWorkflowDatabase');
const {createSampleFixture,createWorkItemFixture}=require('../helpers/workflowFixtures');
const {createResultFixture}=require('../../services/resultWriteService');
const {installWorkAttemptContract}=require('../../scripts/install_work_attempt_contract');
const {resolveReviewAttempt,createReviewDecision,inReviewTransaction}=require('../../services/reviewAttemptService');
const directory=path.resolve(__dirname,'../.tmp');
const file=path.join(directory,'audit_legacy_190_review-attempt-'+randomUUID()+'.db');
let client;
const manager={username:'audit-reviewer',role:'LAB_MANAGER',labId:'LAB-190-REVIEW'};

beforeAll(async()=>{
    fs.mkdirSync(directory,{recursive:true});beforeGuards({actor:'system:fixture',file,qcBootstrap:'CREATE_PRISMA'});
    const db=new Database(file);db.exec('CREATE TABLE _schema_migrations(id TEXT PRIMARY KEY,details TEXT NOT NULL)');db.close();
    installWorkAttemptContract({dbPath:file,apply:true});
    client=new PrismaClient({adapter:new PrismaBetterSqlite3({url:'file:'+file})});
},60000);
afterAll(async()=>{
    if(client)await client.$disconnect();
    if(path.dirname(file)!==directory || !path.basename(file).startsWith('audit_legacy_190_review-attempt-'))throw Error('Unexpected fixture path');
    for(const suffix of ['','-wal','-shm'])fs.rmSync(file+suffix,{force:true});
});

async function fixture({attempts=1,analysis='PH_H2O',current=true,labId=manager.labId}={}) {
    const sampleId=randomUUID(),workItemId=randomUUID();
    await createSampleFixture(client,{data:{id:sampleId,originalId:sampleId,labId:sampleId,assignedLab:labId,status:'PROCESSING'}});
    const item=await createWorkItemFixture(client,{data:{id:workItemId,sampleId,analysis,assignedLab:labId,status:'SUBMITTED',history:'[]'}});
    const ids=[];
    for(let number=1;number<=attempts;number++) {
        const id=randomUUID();ids.push(id);
        await client.workAttempt.create({data:{id,workItemId,attemptNo:number,status:'RECORDED'}});
        await createResultFixture(client,{data:{id:randomUUID(),sampleId,param:analysis,attemptId:id,replicateNo:1,
            value:String(6+number/10),numericValue:6+number/10,isCurrent:current}});
    }
    return {item,ids};
}
const data=(item,attemptId,decision='ACCEPT')=>({id:randomUUID(),sampleId:item.sampleId,workItemId:item.id,
    attemptId,decision,reviewerId:manager.username,reason:'Reviewed evidence'});
async function counts(items) {
    const ids=items.map(row=>row.id);
    return {decisions:await client.reviewDecision.findMany({where:{workItemId:{in:ids}},orderBy:{id:'asc'}}),
        audits:await client.auditLog.findMany({where:{entityId:{in:ids}},orderBy:{id:'asc'}}),
        items:await client.workItem.findMany({where:{id:{in:ids}},orderBy:{id:'asc'}})};
}

test('a single current attempt is derived and stored on the actual ReviewDecision',async()=>{
    const {item,ids}=await fixture();
    const decision=await client.$transaction(tx=>createReviewDecision(tx,data(item),manager));
    expect(decision.attemptId).toBe(ids[0]);
});
test('two current attempts require selection; a valid explicit attempt is used without choosing latest',async()=>{
    const {item,ids}=await fixture({attempts:2}),before=await counts([item]);
    await expect(client.$transaction(tx=>createReviewDecision(tx,data(item),manager))).rejects.toMatchObject({code:'REVIEW_ATTEMPT_REQUIRED',statusCode:409});
    expect(await counts([item])).toEqual(before);
    const decision=await client.$transaction(tx=>createReviewDecision(tx,data(item,ids[0]),manager));
    expect(decision.attemptId).toBe(ids[0]);
});
test('an attempt from another WorkItem or without current Results is refused without writes',async()=>{
    const target=await fixture(),other=await fixture(),historical=await fixture({current:false});
    const before=await counts([target.item,other.item,historical.item]);
    for(const [item,attemptId] of [[target.item,other.ids[0]],[historical.item,historical.ids[0]],[target.item,'']]) {
        await expect(client.$transaction(tx=>createReviewDecision(tx,data(item,attemptId),manager))).rejects.toMatchObject({code:'REVIEW_ATTEMPT_INVALID',statusCode:409});
    }
    expect(await counts([target.item,other.item,historical.item])).toEqual(before);
});
test('only an unexecuted analytical WAIVE may keep its attempt null',async()=>{
    const empty=await fixture({attempts:0}),executed=await fixture({attempts:2});
    const waiver=await client.$transaction(tx=>createReviewDecision(tx,data(empty.item,undefined,'OMIT'),manager));
    expect(waiver.attemptId).toBeNull();
    await expect(client.$transaction(tx=>createReviewDecision(tx,data(empty.item),manager))).rejects.toMatchObject({code:'REVIEW_ATTEMPT_REQUIRED'});
    await expect(client.$transaction(tx=>createReviewDecision(tx,data(executed.item,undefined,'OMIT'),manager))).rejects.toMatchObject({code:'REVIEW_ATTEMPT_REQUIRED'});
});
test('several current Results on one attempt are one review candidate',async()=>{
    const {item,ids}=await fixture();
    await createResultFixture(client,{data:{id:randomUUID(),sampleId:item.sampleId,param:item.analysis,replicateNo:2,attemptId:ids[0],value:'6.4',isCurrent:true}});
    await expect(client.$transaction(tx=>resolveReviewAttempt(tx,item,'ACCEPT'))).resolves.toBe(ids[0]);
});
test('bulk ambiguity lists all affected ids before writes, and any later failure rolls back every decision',async()=>{
    const good=await fixture(),one=await fixture({attempts:2}),two=await fixture({attempts:2});
    const items=[good.item,one.item,two.item],before=await counts(items);
    let executed=false;
    await expect(inReviewTransaction(client,items.map(item=>({workItemId:item.id,decision:'ACCEPT'})),manager,async()=>{executed=true;}))
        .rejects.toMatchObject({code:'REVIEW_ATTEMPT_REQUIRED',details:{workItemIds:[one.item.id,two.item.id]}});
    expect(executed).toBe(false);expect(await counts(items)).toEqual(before);
    const selections=[{workItemId:good.item.id,decision:'ACCEPT'},{workItemId:one.item.id,decision:'ACCEPT',attemptId:one.ids[0]}];
    await expect(inReviewTransaction(client,selections,manager,async tx=>{
        await createReviewDecision(tx,data(good.item),manager);
        await tx.auditLog.create({data:{id:randomUUID(),entity:'WORKITEM',entityId:good.item.id,action:'REVIEW',performedBy:manager.username}});
        await createReviewDecision(tx,data(one.item,'wrong-id'),manager);
    })).rejects.toMatchObject({code:'REVIEW_ATTEMPT_INVALID'});
    expect(await counts(items)).toEqual(before);
});
test('review creation enforces lab scope and review permission before writing',async()=>{
    const outside=await fixture({labId:'LAB-OTHER'}),inside=await fixture();
    await expect(client.$transaction(tx=>createReviewDecision(tx,data(outside.item),manager))).rejects.toMatchObject({statusCode:403});
    await expect(client.$transaction(tx=>createReviewDecision(tx,data(inside.item),{...manager,role:'LAB_TECHNICIAN'}))).rejects.toMatchObject({code:'REVIEW_FORBIDDEN',statusCode:403});
    expect((await counts([outside.item,inside.item])).decisions).toEqual([]);
});
test('non-measurement review keeps its existing separate evidence workflow',async()=>{
    const {item}=await fixture({attempts:0,analysis:'DRYING'});
    const decision=await client.$transaction(tx=>createReviewDecision(tx,data(item),manager));
    expect(decision.attemptId).toBeNull();
});
