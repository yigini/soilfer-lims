const { createResultFixture } = require('../../services/resultWriteService');
const { cleanupWorkflowFixtures } = require("../helpers/workflowFixtures");
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const prisma = require('../../prisma');
const state = require('../../services/exchangeStateService');
const {getAuthToken} = require('../setup');
const adapter = require('../../services/sisAdapterService');

describe('Mounted profile correction, scope and immutable export contracts',()=>{
    const lab = 'PROFILE-ROUTES-LAB', foreignLab = 'PROFILE-FOREIGN-LAB';
    const project = 'PROFILE-ROUTES-PROJECT';
    const ids = {draft:'PROFILE-DRAFT-SPECIMEN',released:'PROFILE-RELEASED-SPECIMEN',move:'PROFILE-MOVE-SPECIMEN'};
    let admin,manager,foreign,managerId;
    const amend = {type:'CLERICAL',reason:'Verified against the original field record',expectedProfileRevision:0,profileCorrection:{code:'PIT-NEW',relation:'CONFIRMED_PROFILE'},idempotencyKey:'profile-correction-operation'};
    beforeAll(async()=>{
        state.getDb(); // Install the actual publication triggers before creating released fixtures.
        for (const id of [lab,foreignLab]) await prisma.lab.create({data:{id,code:id,name:id,country:'GTM'}});
        await prisma.project.create({data:{id:project,code:project,name:project,labId:lab,status:'ACTIVE'}});
        await prisma.project.create({data:{id:project+'-NEXT',code:project+'-NEXT',name:'Next project',labId:lab,status:'ACTIVE'}});
        admin = await getAuthToken('SUPER_ADMIN',lab);
        manager = await getAuthToken('LAB_MANAGER',lab,['GTM'],[project,project+'-NEXT']);
        foreign = await getAuthToken('LAB_MANAGER',foreignLab,['GTM'],[]);
        managerId = jwt.decode(manager).id;
        await prisma.user.updateMany({where:{id:{in:[admin,manager,foreign].map(token=>jwt.decode(token).id)}},data:{mustChangePassword:false}});
        for (const [name,id] of Object.entries(ids)) await createSampleFixture(prisma, {data:{id,originalId:`FIELD-${id}`,labId:`ACCESSION-${id}`,assignedLab:lab,projectId:project,projectCode:project,country:'GTM',status:name==='draft'?'RECEIVED':'APPROVED',approvedAt:name==='draft'?null:new Date(),fieldMetadata:JSON.stringify({site_id:{value:'SITE-OLD'},pit_id:{value:'PIT-FIELD'}})}});
        await createWorkItemFixture(prisma, { data: { id: `${ids.released}-PH`, sampleId: ids.released,
            assignedLab: lab, analysis: 'PH_H2O', status: 'ACCEPTED' } });
        await createResultFixture(prisma, {data:{id:'PROFILE-RESULT-UNCHANGED',sampleId:ids.released,param:'PH_H2O',value:'6.4',numericValue:6.4,unit:'pH',isCurrent:true,isValid:true}});
    });
    afterAll(async()=>{
        await prisma.commandReceipt.deleteMany({where:{idempotencyKey:'profile-correction-operation'}});
        await prisma.sampleAmendment.deleteMany({where:{sampleId:{in:Object.values(ids)}}});
        await prisma.auditLog.deleteMany({where:{sampleId:{in:Object.values(ids)}}});
        await prisma.result.deleteMany({where:{sampleId:{in:Object.values(ids)}}});
        await cleanupWorkflowFixtures(prisma, "workItem", (await prisma.workItem.findMany({ ...({where:{sampleId:{in:Object.values(ids)}}}), select: { id: true } })).map(row => row.id), { single: false });
        await cleanupWorkflowFixtures(prisma, "sample", (await prisma.sample.findMany({ ...({where:{id:{in:Object.values(ids)}}}), select: { id: true } })).map(row => row.id), { single: false });
        await prisma.project.deleteMany({where:{id:{in:[project,project+'-NEXT']}}});
        await prisma.user.update({where:{id:managerId},data:{labId:null}});
        await prisma.lab.deleteMany({where:{id:{in:[lab,foreignLab]}}});
    });
    const put = (id,token,metadata)=>request(app).put(`/api/samples/${id}/metadata`).set('Authorization',`Bearer ${token}`).send({metadata});
    test('foreign manager cannot edit; valid receiving capture records server actor and preserves independent site',async()=>{
        expect((await put(ids.draft,foreign,{profileReference:{code:'PIT-X'}})).status).toBe(403);
        const response = await put(ids.draft,manager,{profileReference:{code:0,relation:'SITE_POINT'}});
        expect(response.status).toBe(200);
        const field = JSON.parse(response.body.fieldMetadata);
        expect(field.profileReference).toMatchObject({code:'0',namespace:`GTM:${project}`,source:'MANUAL_EDIT',recordedBy:jwt.decode(manager).username,revision:1});
        expect(field.site_id).toEqual({value:'SITE-OLD'});
        const stale = await request(app).put(`/api/samples/${ids.draft}/metadata`).set('Authorization',`Bearer ${manager}`).send({metadata:{profileReference:{code:'STALE-PIT'}},expectedProfileRevision:0});
        expect(stale.status).toBe(409);
        expect(stale.body.code).toBe('PROFILE_REVISION_CONFLICT');
        expect(JSON.parse((await prisma.sample.findUnique({where:{id:ids.draft}})).fieldMetadata).profileReference.code).toBe('0');
    });
    test('released canonical and equivalent alias edits cannot bypass the amendment',async()=>{
        for(const metadata of [{profileReference:{code:'PIT-X'}},{pit_id:'PIT-X'},{site_id:'SITE-X'},{profileConfirmed:true},{profile_namespace:'other'}]) expect((await put(ids.released,manager,metadata)).status).toBe(409);
        expect((await put(ids.released,manager,{profileCompatibility:{kind:'EXACT_LEGACY_PRESERVATION'}})).status).toBe(400);
        expect(JSON.parse((await prisma.sample.findUnique({where:{id:ids.released}})).fieldMetadata)).not.toHaveProperty('profileReference');
    });
    test('project movement atomically freezes the exact released legacy key',async()=>{
        const response = await request(app).put(`/api/samples/${ids.move}/project`).set('Authorization',`Bearer ${manager}`).send({projectId:project+'-NEXT'});
        expect(response.status).toBe(200);
        expect(response.body.projectCode).toBe(project+'-NEXT');
        const field = JSON.parse(response.body.fieldMetadata);
        expect(adapter.extractProfileReference(response.body,field,{}).profileKey).toBe(`GTM:${project}:SITE-OLD`);
        expect(field.profileCompatibility.relation).toBe('SITE_POINT');
        const audit = await prisma.auditLog.findFirst({where:{sampleId:ids.move,action:'PROJECT_CHANGE'}});
        expect(JSON.parse(audit.details).profilePreservation.key).toBe(`GTM:${project}:SITE-OLD`);
    });
    test('reasoned correction updates current export and journal while frozen snapshot and results stay unchanged',async()=>{
        const auth = {type:'JWT',role:'SUPER_ADMIN',id:jwt.decode(admin).id,username:jwt.decode(admin).username,labs:['*'],countries:['*'],projects:['*'],scopes:['spatial']};
        const snapshot = await state.createSnapshot(auth,{filter:{projectCode:project,labId:lab}});
        const before = await state.getSnapshotPage(snapshot.snapshotId,auth,{limit:100});
        expect(before.data.find(row=>row.specimenId===ids.released).profile.code).toBe('SITE-OLD');
        const response = await request(app).post(`/api/samples/${ids.released}/amendments`).set('Authorization',`Bearer ${manager}`).send(amend);
        expect(response.status).toBe(200);
        expect(response.body.profileReference).toMatchObject({code:'PIT-NEW',revision:1,relation:'CONFIRMED_PROFILE'});
        const sample = await prisma.sample.findUnique({where:{id:ids.released},include:{results:true}});
        expect(adapter.formatSampleV2(sample,{},{}).profile.code).toBe('PIT-NEW');
        expect(sample.results[0]).toMatchObject({value:'6.4',numericValue:6.4,isCurrent:true,isValid:true});
        expect(sample.originalId).toBe(`FIELD-${ids.released}`);
        expect(sample.labId).toBe(`ACCESSION-${ids.released}`);
        const after = await state.getSnapshotPage(snapshot.snapshotId,auth,{limit:100});
        expect(after.data).toEqual(before.data);
        const latest = state.getDb().prepare('SELECT payload FROM _exchange_journal WHERE specimen_id=? ORDER BY sequence DESC LIMIT 1').get(ids.released);
        expect(JSON.parse(latest.payload).profile.code).toBe('PIT-NEW');
        const audit = await prisma.auditLog.findFirst({where:{sampleId:ids.released,action:'SAMPLE_AMENDMENT_CREATED'}});
        expect(JSON.parse(audit.details)).toMatchObject({reason:amend.reason,new:{code:'PIT-NEW'}});
    });
    test('amendment replay is idempotent and a changed payload is a recoverable conflict',async()=>{
        const replay = await request(app).post(`/api/samples/${ids.released}/amendments`).set('Authorization',`Bearer ${manager}`).send(amend);
        expect(replay.status).toBe(200);
        expect(await prisma.sampleAmendment.count({where:{sampleId:ids.released}})).toBe(1);
        const conflict = await request(app).post(`/api/samples/${ids.released}/amendments`).set('Authorization',`Bearer ${manager}`).send({...amend,profileCorrection:{code:'DIFFERENT'}});
        expect(conflict.status).toBe(409);
        expect(conflict.body.code).toBe('IDEMPOTENCY_CONFLICT');
    });
    test('a past receipt does not bypass current laboratory scope',async()=>{
        await prisma.user.update({where:{id:managerId},data:{labId:foreignLab,projects:'[]'}});
        try {
            const replay = await request(app).post(`/api/samples/${ids.released}/amendments`).set('Authorization',`Bearer ${manager}`).send(amend);
            expect(replay.status).toBe(403);
        } finally {await prisma.user.update({where:{id:managerId},data:{labId:lab,projects:JSON.stringify([project])}})}
    });
    test('stale profile revision, missing reason and foreign amendments do not mutate state',async()=>{
        const send = (token,body)=>request(app).post(`/api/samples/${ids.released}/amendments`).set('Authorization',`Bearer ${token}`).send(body);
        expect((await send(manager,{...amend,idempotencyKey:'',reason:''})).status).toBe(400);
        expect((await send(foreign,{...amend,idempotencyKey:''})).status).toBe(403);
        expect((await send(manager,{...amend,idempotencyKey:'',expectedProfileRevision:0})).status).toBe(409);
        expect(await prisma.sampleAmendment.count({where:{sampleId:ids.released}})).toBe(1);
    });
});
