const service = require('../../services/koboService');
const source = require('../../services/koboProfileService');
const identity = require('../../services/profileIdentityService');
const controller = require('../../controllers/koboController');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const jwt = require('jsonwebtoken');
const {getAuthToken} = require('../setup');

const mapping = {profileReference: {codePath:'soil/pit', sitePath:'soil/site', namespace:'SURVEY-2026', relation:'CONFIRMED_PROFILE', depthTopD1Path:'soil/top1', depthBottomD1Path:'soil/bottom1', depthTopD2Path:'soil/top2', depthBottomD2Path:'soil/bottom2', collectionDatePath:'soil/date'}};
const submission = {_id:9001, _uuid:'synthetic-survey-9001', barcode_d1:'BAG-9001-D1', barcode_d2:'BAG-9001-D2', 'soil/pit':{value:0}, 'soil/site':'SITE-901', 'soil/top1':0, 'soil/bottom1':20.5, 'soil/top2':20.5, 'soil/bottom2':50, 'soil/date':'2026-09-15', start:'2026-09-16', _submission_time:'2026-09-17', _attachments:[]};

describe('Kobo exact source paths and replay compatibility',()=>{
    test('two bags share a verified pit, preserve independent site and decimal depth without invented GPS',()=>{
        const samples = service.transformSubmission(submission,mapping,'LAB');
        expect(samples).toHaveLength(2);
        const ref = source.capture(samples[0].profileEvidence,{sample:{projectCode:'PROJ'},actor:'operator'});
        expect(ref).toMatchObject({code:'0',namespace:'SURVEY-2026',relation:'CONFIRMED_PROFILE',sourcePath:'soil/pit',sourceRecordId:submission._uuid});
        expect(samples[0]).toMatchObject({lat:null,lng:null,collected_at:'2026-09-15',site_id:'SITE-901'});
        expect(samples.map(s=>[s.profileEvidence.depthTopCm,s.profileEvidence.depthBottomCm])).toEqual([[0,20.5],[20.5,50]]);
    });
    test('missing source stays unknown; interview and upload dates are not collection observations',()=>{
        const sample = service.transformSubmission({barcode_d1:'BAG-UNKNOWN',start:'2026-09-16',_submission_time:'2026-09-17'},null,'LAB')[0];
        expect(sample).toMatchObject({collected_at:null,lat:null,lng:null});
        expect(source.capture(sample.profileEvidence,{sample:{projectCode:'PROJ'}}).code).toBeNull();
    });
    test.each(['2026-02-30','2026-13-01'])('an impossible recorded collection date is rejected (%s)',date=>{
        expect(()=>source.extractEvidence({...submission,'soil/date':date},mapping,null)).toThrow(identity.ProfileReferenceConflictError);
    });
    test('exact nested path works and ambiguous suffixes never pick a pit',()=>{
        const sample = service.transformSubmission({barcode_d1:'BAG-NESTED',soil:{pit:'P-4'},'other/pit':'P-5'}, {profileReference:{codePath:'soil/pit'}},'LAB')[0];
        expect(source.capture(sample.profileEvidence,{sample:{projectCode:'PROJ'}}).code).toBe('P-4');
        const unmapped = source.extractEvidence({'other/pit_id':'P-5'},null,null);
        expect(source.capture(unmapped,{sample:{projectCode:'PROJ'}}).code).toBeNull();
    });
    test.each([true,[],{},Infinity,'[object Object]'])('invalid source identifier %p is an actionable conflict',value=>{
        expect(()=>source.extractEvidence({'soil/pit':value},mapping,null)).toThrow(identity.ProfileReferenceConflictError);
    });
    test('conflicting aliases are not hidden by a configured path',()=>{
        const evidence = source.extractEvidence({...submission,pit_id:'DIFFERENT'},mapping,null);
        expect(()=>source.capture(evidence,{sample:{projectCode:'PROJ'}})).toThrow(identity.ProfileReferenceConflictError);
    });
    test('legacy replay hash remains comparable while new profile changes are detected separately',()=>{
        const sample = service.transformSubmission(submission,mapping,'LAB')[0];
        const fingerprint = controller._profileEvidence.computeEvidenceFingerprint(sample,[],submission);
        const old = {evidenceFingerprint:fingerprint};
        expect(controller._profileEvidence.hasEvidenceChanged(old,{},sample,[],submission)).toBe(false);
        old.profileFingerprint = source.fingerprint(sample);
        const changed = service.transformSubmission({...submission,'soil/pit':'P-CORRECTED'},mapping,'LAB')[0];
        expect(controller._profileEvidence.hasEvidenceChanged(old,{},changed,[],submission)).toBe(true);
    });
    test('invalid paths, namespace/relation ambiguity and inferred booleans are rejected',()=>{
        expect(()=>source.validateMapping({profileReference:{codePath:'constructor/x'}})).toThrow();
        expect(()=>source.validateMapping({profileReference:{namespacePath:'soil/ns',namespace:'OTHER'}})).toThrow();
        expect(()=>source.extractEvidence({profileConfirmed:'perhaps'},null,null)).not.toThrow();
        expect(()=>source.capture(source.extractEvidence({profileConfirmed:'perhaps',pit_id:'P'},null,null),{sample:{projectCode:'PROJ'}})).toThrow();
    });
});

describe('Actual mounted Kobo capture, hold and force-refresh paths',()=>{
    const lab='PROFILE-KOBO-LAB', project='PROFILE-KOBO-PROJECT', config='PROFILE-KOBO-CONFIG';
    let token, fetch;
    beforeAll(async()=>{
        await prisma.lab.create({data:{id:lab,code:lab,name:lab,country:'GTM'}});
        await prisma.project.create({data:{id:project,code:project,name:project,labId:lab,status:'ACTIVE',projectType:'KOBO_LINKED'}});
        await prisma.koboConfig.create({data:{id:config,labId:lab,projectCode:project,koboServerUrl:'https://kobo.fixture.test',formId:'profile-form',apiToken:'fixture-only',isActive:true,fieldMapping:JSON.stringify(mapping)}});
        token=await getAuthToken('LAB_MANAGER',lab,['GTM'],[project]);
        await prisma.user.update({where:{id:jwt.decode(token).id},data:{mustChangePassword:false}});
        fetch=jest.spyOn(service,'fetchSubmissions').mockResolvedValue([submission]);
    });
    afterAll(async()=>{
        fetch.mockRestore();
        await prisma.auditLog.deleteMany({where:{entityId:{in:(await prisma.sample.findMany({where:{projectCode:project},select:{id:true}})).map(s=>s.id)}}});
        await prisma.sample.deleteMany({where:{projectCode:project}});
        await prisma.koboConfig.delete({where:{id:config}});
        await prisma.project.delete({where:{id:project}});
        await prisma.user.update({where:{id:jwt.decode(token).id},data:{labId:null}});
        await prisma.lab.delete({where:{id:lab}});
    });
    test('normal sync captures two distinct EXPECTED specimens under one pit; unchanged replay creates no hold',async()=>{
        const response=await request(app).post(`/api/kobo/sync/${lab}?configId=${config}`).set('Authorization',`Bearer ${token}`);
        expect(response.status).toBe(200);
        expect(response.body.newSamples).toBe(2);
        const samples=await prisma.sample.findMany({where:{projectCode:project},orderBy:{originalId:'asc'}});
        expect(samples.map(s=>s.status)).toEqual(['EXPECTED','EXPECTED']);
        expect(samples.map(s=>JSON.parse(s.fieldMetadata).profileReference.code)).toEqual(['0','0']);
        expect(samples.map(s=>[s.depthTopCm,s.depthBottomCm])).toEqual([[0,20.5],[20.5,50]]);
        expect(samples.every(s=>s.labId===null && s.latitude===null)).toBe(true);
        await prisma.koboConfig.update({where:{id:config},data:{lastSubmissionId:null}});
        await request(app).post(`/api/kobo/sync/${lab}?configId=${config}`).set('Authorization',`Bearer ${token}`);
        expect((await prisma.sample.findMany({where:{projectCode:project}})).every(s=>!JSON.parse(s.metadata).provenanceHold)).toBe(true);
    });
    test('force refresh keeps a changed interval pending for normal source review',async()=>{
        const sample=await prisma.sample.findFirst({where:{projectCode:project,originalId:'BAG-9001-D1'}});
        const before=JSON.parse(sample.metadata);
        fetch.mockResolvedValue([{...submission,'soil/bottom1':21}]);
        const response=await request(app).post(`/api/kobo/sync-sample/${sample.id}`).set('Authorization',`Bearer ${token}`);
        expect(response.status).toBe(409);
        const unchanged=await prisma.sample.findUnique({where:{id:sample.id}});
        expect(unchanged.depthBottomCm).toBe(20.5);
        expect(unchanged.metadata).toBe(sample.metadata);
        expect(unchanged.fieldMetadata).toBe(sample.fieldMetadata);
        await prisma.koboConfig.update({where:{id:config},data:{lastSubmissionId:null}});
        expect((await request(app).post(`/api/kobo/sync/${lab}?configId=${config}`).set('Authorization',`Bearer ${token}`)).status).toBe(200);
        const reviewed=JSON.parse((await prisma.sample.findUnique({where:{id:sample.id}})).metadata);
        expect(reviewed.profileFingerprint).toBe(before.profileFingerprint);
        expect(reviewed.provenanceHold.status).toBe('AMBIGUOUS_PROVENANCE_HOLD');
        expect(reviewed.revisions[0].profileEvidence.depthBottomCm).toBe(21);
        // Leave the fixture in its original state for the following independent scenario.
        await prisma.sample.update({where:{id:sample.id},data:{metadata:sample.metadata,fieldMetadata:sample.fieldMetadata}});
        fetch.mockResolvedValue([submission]);
        expect((await request(app).post(`/api/kobo/sync-sample/${sample.id}`).set('Authorization',`Bearer ${token}`)).status).toBe(200);
    });
    test('changed profile creates one durable conflict; replay does not duplicate it or overwrite the primary',async()=>{
        fetch.mockResolvedValue([{...submission,'soil/pit':'CORRECTED'}]);
        for (let i=0;i<2;i++) {
            await prisma.koboConfig.update({where:{id:config},data:{lastSubmissionId:null}});
            await request(app).post(`/api/kobo/sync/${lab}?configId=${config}`).set('Authorization',`Bearer ${token}`);
        }
        const sample=await prisma.sample.findFirst({where:{projectCode:project}});
        expect(JSON.parse(sample.fieldMetadata).profileReference.code).toBe('0');
        const meta=JSON.parse(sample.metadata);
        expect(meta.revisions).toHaveLength(1);
        expect(meta.provenanceHold.status).toBe('AMBIGUOUS_PROVENANCE_HOLD');
    });
    test('force refresh preserves a manual correction and blocks a released specimen before fetching',async()=>{
        fetch.mockResolvedValue([submission]);
        const sample=await prisma.sample.findFirst({where:{projectCode:project}});
        const field=JSON.parse(sample.fieldMetadata);
        field.profileReference=identity.captureReference({profileReference:{code:'MANUAL-PIT',relation:'SITE_POINT'}},{sample,actor:jwt.decode(token).id,source:'MANUAL_EDIT'});
        await prisma.sample.update({where:{id:sample.id},data:{fieldMetadata:JSON.stringify(field)}});
        const response=await request(app).post(`/api/kobo/sync-sample/${sample.id}`).set('Authorization',`Bearer ${token}`);
        expect(response.status).toBe(200);
        expect(JSON.parse((await prisma.sample.findUnique({where:{id:sample.id}})).fieldMetadata).profileReference.code).toBe('MANUAL-PIT');
        await prisma.sample.update({where:{id:sample.id},data:{status:'DISPOSED',approvedAt:new Date()}});
        fetch.mockClear();
        expect((await request(app).post(`/api/kobo/sync-sample/${sample.id}`).set('Authorization',`Bearer ${token}`)).status).toBe(409);
        expect(fetch).not.toHaveBeenCalled();
    });
});
