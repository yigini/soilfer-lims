const intake = require('../../services/intakeProfileService');
const identity = require('../../services/profileIdentityService');
const adapter = require('../../services/sisAdapterService');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const jwt = require('jsonwebtoken');
const {getAuthToken} = require('../setup');

describe('Intake identity normalization and context preservation',()=>{
    const sample={projectCode:'P',country:'GTM',status:'EXPECTED'};
    test('new captures rewrite client actor/revision/time and preserve independent site',()=>{
        const field=intake.capture(sample,{site_id:{value:'SITE'},profileReference:{code:0,relation:'SITE_POINT',recordedBy:'forged',revision:999}}, {}, {isNew:true,actor:'verified-user'});
        expect(field.profileReference).toMatchObject({code:'0',namespace:'GTM:P',revision:1,recordedBy:'verified-user',source:'INTAKE'});
        expect(field.site_id).toEqual({value:'SITE'});
    });
    test('omission preserves exact legacy; explicit unknown does not resurrect source aliases',()=>{
        const original={site_id:'SITE',pit_id:'PIT'};
        expect(intake.capture(sample,original,{}, {actor:'user'})).toEqual(original);
        const field=intake.capture(sample,original,{profileReference:{code:null}}, {actor:'user'});
        expect(adapter.extractProfileReference(sample,field,{}).profileCode).toBeNull();
        expect(field.pit_id).toBe('PIT');
    });
    test('a changed project freezes the exact legacy site key without promoting a pit',()=>{
        const original={site_id:{value:'SITE'},pit_id:{value:'PIT'}};
        const field=intake.preserveForContextChange(sample,original,{projectCode:'NEXT'},'actor');
        expect(adapter.extractProfileReference({...sample,projectCode:'NEXT'},field,{})).toMatchObject({profileKey:'GTM:P:SITE',profileRelation:'SITE_POINT'});
    });
    test('untrusted namespace and server-managed compatibility are rejected',()=>{
        expect(()=>intake.capture(sample,{}, {profileReference:{code:'P',namespace:'OTHER'}},{actor:'user',isNew:true})).toThrow(identity.ProfileReferenceConflictError);
        expect(()=>intake.capture(sample,{profileCompatibility:{code:'FORGED'}},{},{actor:'user',isNew:true})).toThrow(identity.ProfileReferenceConflictError);
    });
    test('released records cannot be corrected through intake',()=>{
        expect(()=>intake.capture({...sample,approvedAt:new Date()}, {}, {profileReference:{code:'NEW'}},{actor:'user'})).toThrow(identity.ProfileReferenceConflictError);
    });
});

describe('Mounted intake draft and manifest paths preserve source identity',()=>{
    const lab='PROFILE-INTAKE-LAB', project='PROFILE-INTAKE-PROJECT', sampleId='PROFILE-INTAKE-DRAFT';
    let token;
    beforeAll(async()=>{
        await prisma.lab.create({data:{id:lab,code:lab,name:lab,country:'GTM'}});
        await prisma.project.create({data:{id:project,code:project,name:project,labId:lab,status:'ACTIVE'}});
        await prisma.sample.create({data:{id:sampleId,originalId:sampleId,assignedLab:lab,projectId:project,projectCode:project,status:'EXPECTED',fieldMetadata:JSON.stringify({site_id:'SOURCE-SITE'})}});
        token=await getAuthToken('SAMPLE_RECEPTION',lab,['GTM'],[project]);
        await prisma.user.update({where:{id:jwt.decode(token).id},data:{mustChangePassword:false}});
    });
    afterAll(async()=>{
        const batchIds = (await prisma.sample.findMany({where:{projectCode:project,id:{not:sampleId}},select:{id:true}})).map(row=>row.id);
        await prisma.workItem.deleteMany({where:{sampleId:{in:batchIds}}});
        await prisma.sample.deleteMany({where:{id:{in:batchIds}}});
        await prisma.auditLog.deleteMany({where:{sampleId}});
        await prisma.sample.delete({where:{id:sampleId}});
        await prisma.project.delete({where:{id:project}});
        await prisma.user.update({where:{id:jwt.decode(token).id},data:{labId:null}});
        await prisma.lab.delete({where:{id:lab}});
    });
    test('draft save, reopen and repeated save retain the reference and explicit unknown',async()=>{
        const payload={originalId:sampleId,projectId:project,decision:'DRAFT',isDraft:true,profileReference:{code:0,relation:'SITE_POINT'}};
        const save=await request(app).post('/api/reception/intake').set('Authorization',`Bearer ${token}`).send(payload);
        expect(save.status).toBe(200);
        const stored=await prisma.sample.findUnique({where:{id:sampleId}});
        expect(stored.status).toBe('DRAFT');
        expect(JSON.parse(stored.fieldMetadata).profileReference).toMatchObject({code:'0',namespace:project,recordedBy:jwt.decode(token).id});
        const reopen=await request(app).get(`/api/reception/sample-context/${sampleId}`).set('Authorization',`Bearer ${token}`);
        expect(reopen.status).toBe(200);
        const omit={...payload};delete omit.profileReference;
        expect((await request(app).post('/api/reception/intake').set('Authorization',`Bearer ${token}`).send(omit)).status).toBe(200);
        expect(JSON.parse((await prisma.sample.findUnique({where:{id:sampleId}})).fieldMetadata).profileReference.code).toBe('0');
        expect((await request(app).post('/api/reception/intake').set('Authorization',`Bearer ${token}`).send({...payload,profileReference:{code:null}})).status).toBe(200);
        const unknown=JSON.parse((await prisma.sample.findUnique({where:{id:sampleId}})).fieldMetadata);
        expect(unknown.profileReference).toMatchObject({code:null,namespace:null,relation:'UNSPECIFIED'});
        expect(unknown.site_id).toBe('SOURCE-SITE');
    });
    test('manifest preview keeps row-specific zero, code and source column rather than inferring from bags',async()=>{
        const response=await request(app).post('/api/reception/parse-manifest').set('Authorization',`Bearer ${token}`).send({mapping:{sampleId:'bag',profileCode:'pit',profileNamespace:'survey',depthTop:'top',depthBottom:'bottom'},rows:[{bag:'BAG-A',pit:0,survey:project,top:0,bottom:20.5},{bag:'BAG-B',pit:'P-2',survey:project,top:20.5,bottom:50}]});
        expect(response.status).toBe(200);
        expect(response.body.parsedRows.map(row=>row.profileReference.code)).toEqual(['0','P-2']);
        expect(response.body.parsedRows.map(row=>row.depthBottomCm)).toEqual([20.5,50]);
        expect(response.body.parsedRows[0].profileSourceEvidence).toEqual({column:'pit',record:'row:1'});
    });
    test('actual batch capture keeps separate source codes, decimal depths and distinct accessions',async()=>{
        const checklist={items:Object.fromEntries(['container','label','quantity','condition','coc'].map(key=>[key,{status:'PASS'}]))};
        const response=await request(app).post('/api/reception/consignments').set('Authorization',`Bearer ${token}`).send({consignment:{projectId:project},defaults:{receivedMass:350,checklist},samples:[{originalId:'PROFILE-BATCH-A',profileReference:{code:0},depthTopCm:0,depthBottomCm:20.5},{originalId:'PROFILE-BATCH-B',profileReference:{code:'PIT-B'},depthTopCm:20.5,depthBottomCm:50}]});
        expect({status:response.status,body:response.body}).toMatchObject({status:201});
        const rows=await prisma.sample.findMany({where:{originalId:{in:['PROFILE-BATCH-A','PROFILE-BATCH-B']}},orderBy:{originalId:'asc'}});
        expect(rows.map(row=>JSON.parse(row.fieldMetadata).profileReference.code)).toEqual(['0','PIT-B']);
        expect(rows.map(row=>row.depthBottomCm)).toEqual([20.5,50]);
        expect(new Set(rows.map(row=>row.labId)).size).toBe(2);
    });
});
