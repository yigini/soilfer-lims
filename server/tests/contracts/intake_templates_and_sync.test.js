'use strict';
const request=require('supertest');
const app=require('../../app');
const prisma=require('../../prisma');
const {getAuthToken,ensureTestLab}=require('../setup');
const rules=require('../../services/intakeTemplateService');
const schema=require('../../services/intakeSchema');
const commands=require('../../services/intakeCommandService');
const Sync=require('../../services/syncService');
const crypto=require('crypto');
const lab='INTAKE-B1-LAB',foreign='INTAKE-B1-OTHER',project='INTAKE-B1-PROJECT';
const pass={items:Object.fromEntries(['container','label','quantity','condition','coc'].map(id=>[id,{status:'PASS'}]))};
let reception,manager,foreignManager,token,managerToken,foreignToken;
const clone=v=>JSON.parse(JSON.stringify(v));
const unique=prefix=>`${prefix}-${crypto.randomUUID()}`;
const pin=f=>({templateId:f.templateId,revisionId:f.revisionId,schemaHash:f.schemaHash});
async function context(sample) {return rules.resolve(await rules.intakeContext({actor:reception,sample}),sample);}
async function intake(payload,intent='SAVE_DRAFT',extra={}) {const target=payload.sampleId || payload.originalId;const existing=target && await prisma.sample.findFirst({where:{OR:[{id:target},{originalId:target}]}});if(existing && JSON.parse(existing.receptionData || '{}').intakeTemplate && !payload.expectedUpdatedAt) payload={...payload,expectedUpdatedAt:existing.updatedAt.toISOString()};return commands.executeIntake({actor:reception,payload,intent,...extra});}
async function basic(source,schemaValue,selector={}) {return rules.saveBasic(manager,{labId:lab,sourceRevisionId:source.id,sourceHash:source.schemaHash,schema:schemaValue,origin:selector.origin||'*',projectId:selector.projectId||null,expectedVersion:selector.expectedVersion||0});}
describe('Versioned intake and canonical online/offline operation (#156 B1)',()=>{
    beforeAll(async()=>{
        await ensureTestLab(lab,'GTM');await ensureTestLab(foreign,'GTM');
        token=await getAuthToken('SAMPLE_RECEPTION',lab,['GTM']);managerToken=await getAuthToken('LAB_MANAGER',lab,['GTM']);foreignToken=await getAuthToken('LAB_MANAGER',foreign,['GTM']);
        reception=await prisma.user.findFirst({where:{role:'SAMPLE_RECEPTION',labId:lab}});manager=await prisma.user.findFirst({where:{role:'LAB_MANAGER',labId:lab}});foreignManager=await prisma.user.findFirst({where:{role:'LAB_MANAGER',labId:foreign}});
        await prisma.user.updateMany({where:{labId:{in:[lab,foreign]}},data:{mustChangePassword:false}});
        await prisma.project.create({data:{id:project,code:'INTAKE-B1',name:'Synthetic intake project',status:'ACTIVE',labId:lab,templateId:'GENERIC_OPEN_INTAKE'}});
    });
    test('compatible seed decisions retain five-check semantics; unsupported matrices have no soil context',()=>{
        const s=schema.seed('SOILFER');
        expect(schema.evaluate(s,pass,{}, {origin:'PROJECT_SAMPLE',matrix:'SOIL'}).isPassed).toBe(true);
        expect(schema.evaluate(s,{items:{...pass.items,coc:{status:'NA'}}},{},{origin:'PROJECT_SAMPLE',matrix:'SOIL'}).invalidNAItems).toEqual(['coc']);
        expect(schema.evaluate(s,{items:{...pass.items,bagIntact:false}},{},{origin:'PROJECT_SAMPLE',matrix:'SOIL'}).failedItems[0].key).toBe('container');
        expect(schema.seed('SOILFER','OTHER').contextFields).toEqual([]);
        expect(schema.seed('COMMERCIAL').contextFields.some(f=>f.id==='depthTopCm')).toBe(false);
    });
    test('new-context route resolves authorized templates without creating a fake specimen',async()=>{
        const before=await prisma.sample.count();
        const res=await request(app).get('/api/reception/sample-context').query({projectId:project,matrix:'SOIL'}).set('Authorization',`Bearer ${token}`);
        expect(res.status).toBe(200);expect(res.body.sample).toBeNull();expect(res.body.intakeTemplate.resolutionSource).toBe('COMPATIBLE_SEED');
        expect(await prisma.sample.count()).toBe(before);
    });
    test('persisted project prevents client walk-in downgrade and tampered template selection',async()=>{
        const id=unique('ORIGIN');await prisma.sample.create({data:{id,originalId:id,status:'EXPECTED',assignedLab:lab,projectId:project,projectCode:'INTAKE-B1'}});
        const before=await prisma.sample.findUnique({where:{id}});
        await expect(intake({sampleId:id,isWalkIn:true,checklist:{items:{...pass.items,coc:{status:'NA'}}}},'ACCEPT')).rejects.toMatchObject({code:'INVALID_CHECKLIST_NA'});
        const effective=await context(before);
        await expect(intake({sampleId:id,intakeTemplate:{...pin(effective),revisionId:'INTAKE-SEED-COMMERCIAL-1'}},'SAVE_DRAFT')).rejects.toMatchObject({status:409,code:'INTAKE_TEMPLATE_CHANGED'});
        expect((await prisma.sample.findUnique({where:{id}})).status).toBe('EXPECTED');
    });
    test('draft keeps immutable revision, zero, photos, custody and profile through a default change',async()=>{
        const id=unique('PIN');await prisma.sample.create({data:{id,originalId:id,status:'EXPECTED',assignedLab:lab,projectId:project,projectCode:'INTAKE-B1'}});
        const original=await context(await prisma.sample.findUnique({where:{id}}));
        const draft=await intake({sampleId:id,intakeTemplate:pin(original),checklist:{items:{container:{status:'PASS'}}},depthTopCm:0,depthBottomCm:'20,5',intakePhotos:['/uploads/synthetic.png'],custodyCarrierName:'Synthetic courier',profileReference:{code:0}});
        const source=await prisma.intakeTemplateRevision.findUnique({where:{id:original.revisionId}});
        const form=clone(JSON.parse(source.schemaJson));form.criteria.find(c=>c.id==='coc').required=false;
        const changed=await basic(source,form,{projectId:project});
        const reopened=await request(app).get('/api/reception/sample-context/'+id).set('Authorization',`Bearer ${token}`);
        expect(reopened.body.intakeTemplate.revisionId).toBe(original.revisionId);
        expect(reopened.body.intakeTemplate.resolutionSource).toBe('SAVED_REVISION');
        const saved=await intake({sampleId:id,notes:'More information',expectedUpdatedAt:draft.updatedAt});
        const record=await prisma.sample.findUnique({where:{id}});const rd=JSON.parse(record.receptionData);
        expect(rd.commandFacts).toMatchObject({depthTopCm:0,depthBottomCm:20.5,intakePhotos:['/uploads/synthetic.png'],custodyCarrierName:'Synthetic courier'});
        expect(JSON.parse(record.fieldMetadata).profileReference.code).toBe('0');
        expect(saved.intakeTemplate.revisionId).toBe(original.revisionId);
        const newForm=await rules.resolve(await rules.intakeContext({actor:reception,projectId:project}));expect(newForm.revisionId).toBe(changed.revision.id);
    });
    test('settings require own-lab authority and concurrent saves create no orphan template',async()=>{
        const source=await prisma.intakeTemplateRevision.findUnique({where:{id:'INTAKE-SEED-SOILFER-1'}});
        const before=await prisma.intakeTemplate.count();
        await expect(rules.saveBasic(foreignManager,{labId:lab,sourceRevisionId:source.id,sourceHash:source.schemaHash,schema:JSON.parse(source.schemaJson),expectedVersion:0})).rejects.toMatchObject({status:403});
        expect((await request(app).post('/api/labs/'+lab+'/intake-templates/basic').set('Authorization',`Bearer ${token}`).send({})).status).toBe(403);
        await expect(basic(source,JSON.parse(source.schemaJson),{projectId:project})).rejects.toMatchObject({status:409,code:'INTAKE_SETTINGS_CHANGED'});
        expect(await prisma.intakeTemplate.count()).toBe(before);
    });
    test('published schema cannot be edited in place, even through a direct database client',async()=>{
        await expect(prisma.intakeTemplateRevision.update({where:{id:'INTAKE-SEED-SOILFER-1'},data:{schemaJson:'{}'}})).rejects.toThrow();
    });
    test('retired pinned draft remains usable; revoked version conflicts without changing input',async()=>{
        const source=await prisma.intakeTemplateRevision.findUnique({where:{id:'INTAKE-SEED-SOILFER-1'}});
        const saved=await basic(source,JSON.parse(source.schemaJson),{origin:'AMBIGUOUS'});
        const id=unique('RETIRE');const first=await intake({originalId:id,checklist:{items:{label:{status:'PASS'}}},intakePhotos:['/uploads/retained.jpg']});
        expect(first.intakeTemplate.revisionId).toBe(saved.revision.id);
        await prisma.intakeTemplateRevision.update({where:{id:saved.revision.id},data:{state:'RETIRED',reason:'Synthetic retirement'}});
        const next=await intake({sampleId:first.id,notes:'Retained draft'});expect(next.intakeTemplate.revisionId).toBe(saved.revision.id);
        await prisma.intakeTemplateRevision.update({where:{id:saved.revision.id},data:{state:'REVOKED',reason:'Synthetic emergency'}});
        const before=await prisma.sample.findUnique({where:{id:first.id}});
        await expect(intake({sampleId:first.id,notes:'Must not erase'})).rejects.toMatchObject({status:409,code:'INTAKE_TEMPLATE_RECOVERY_REQUIRED'});
        expect((await prisma.sample.findUnique({where:{id:first.id}})).receptionData).toBe(before.receptionData);
    });
    test('physical receipt creates no accession or work items; legacy acceptance has no checklist bypass',async()=>{
        const id=unique('RECEIPT');await prisma.sample.create({data:{id,originalId:id,status:'EXPECTED',assignedLab:lab}});
        const res=await request(app).post(`/api/samples/${id}/receive`).set('Authorization',`Bearer ${token}`).send({operationId:unique('op')});
        expect(res.status).toBe(200);expect(res.body.status).toBe('RECEIVED');expect(res.body.labId).toBeNull();expect(res.body.dryingStatus).toBeNull();expect(await prisma.workItem.count({where:{sampleId:id}})).toBe(0);
        const acceptance=await request(app).post(`/api/samples/${id}/accept`).set('Authorization',`Bearer ${managerToken}`).send({expectedUpdatedAt:res.body.updatedAt});
        expect(acceptance.status).toBe(409);expect(acceptance.body.code).toBe('INTAKE_REVIEW_REQUIRED');expect((await prisma.sample.findUnique({where:{id}})).status).toBe('RECEIVED');
    });
    test('offline drafts and receipt/accept intents preserve full payload and replay exactly once',async()=>{
        for(const intent of ['SAVE_DRAFT','RECEIVE','ACCEPT']) {
            const operationId=unique('offline'),originalId=unique('QUEUED');
            const payload={originalId,intent,isWalkIn:true,checklist:intent==='ACCEPT'?pass:{items:{container:{status:'PASS'}}},intakePhotos:['/uploads/synthetic-offline.jpg'],custodyCarrierName:'Courier',samplingDetails:{date:'2026-09-25',coordinates:{lat:0,lng:0}},profileReference:{code:0},notes:'Device input'};
            payload.intakeTemplate=pin(await rules.resolve(await rules.intakeContext({actor:reception,origin:'DESK_WALKIN'})));
            const batch={deviceId:'synthetic-intake-device',operations:[{type:'RECORD_INTAKE',operationId,payload,capturedAtLocal:'2026-10-01T10:00:00Z'}]};
            const first=await Sync.processSyncBatch(reception,batch);expect(first.receipts[0].status).toBe('APPLIED');
            const record=await prisma.sample.findUnique({where:{originalId}});expect(record.status).toBe(intent==='SAVE_DRAFT'?'DRAFT':intent==='RECEIVE'?'RECEIVED':'ACCEPTED');
            const rd=JSON.parse(record.receptionData);expect(rd.commandFacts).toMatchObject({intakePhotos:payload.intakePhotos,custodyCarrierName:'Courier',notes:'Device input'});expect(rd.capturedAtLocal).toBe('2026-10-01T10:00:00Z');expect(record.labId).not.toBe(lab);
            const before=await prisma.workItem.count({where:{sampleId:record.id}});const second=await Sync.processSyncBatch(reception,batch);expect(second.receipts[0].status).toBe('DUPLICATE_APPLIED');expect(await prisma.sample.count({where:{originalId}})).toBe(1);expect(await prisma.workItem.count({where:{sampleId:record.id}})).toBe(before);
            const changed=clone(batch);changed.operations[0].payload.checklist.items.label={status:'FAIL'};expect((await Sync.processSyncBatch(reception,changed)).receipts[0].status).toBe('CONFLICT');
        }
    });
    test('queued legacy input and stale saves return recoverable conflict, not silent receipt',async()=>{
        const originalId=unique('LEGACY');const result=await Sync.processSyncBatch(reception,{deviceId:'old-device',operations:[{type:'RECORD_INTAKE',operationId:unique('old'),payload:{originalId,notes:'Do not lose me'}}]});
        expect(result.receipts[0]).toMatchObject({status:'CONFLICT',code:'INTAKE_REVIEW_REQUIRED',recovery:{preserveInput:true}});expect(await prisma.sample.count({where:{originalId}})).toBe(0);
        const first=await intake({originalId:unique('CONCURRENT'),isWalkIn:true});await intake({sampleId:first.id,notes:'Newer'},'SAVE_DRAFT');
        await expect(intake({sampleId:first.id,expectedUpdatedAt:first.updatedAt,notes:'Older'})).rejects.toMatchObject({status:409,code:'CONCURRENT_MODIFICATION'});
    });
    test('current authority is rechecked before duplicate receipt and foreign-lab reads reveal no template',async()=>{
        const op=unique('AUTH');const payload={originalId:unique('AUTHORITY'),isWalkIn:true};await intake(payload,'SAVE_DRAFT',{operationId:op});
        await prisma.user.update({where:{id:reception.id},data:{role:'VIEWER'}});
        try{await expect(intake(payload,'SAVE_DRAFT',{operationId:op})).rejects.toMatchObject({status:403,code:'PERMISSION_DENIED'});}finally{await prisma.user.update({where:{id:reception.id},data:{role:'SAMPLE_RECEPTION'}});}
        const read=await request(app).get('/api/labs/'+lab+'/intake-templates').set('Authorization',`Bearer ${foreignToken}`);expect(read.status).toBe(403);
    });
    test('batch requires explicit bulk confirmation and rolls back every row on one missing check',async()=>{
        const originals=[unique('BATCH'),unique('BATCH')];const payload={consignment:{projectId:project},defaults:{checklist:pass,receivedMass:350},samples:originals.map(originalId=>({originalId}))};
        const before=await prisma.consignment.count();await expect(commands.executeConsignment({actor:reception,payload})).rejects.toMatchObject({code:'BULK_CONFIRMATION_REQUIRED'});
        payload.bulkAttestation={confirmed:true};payload.samples[1].checklist={items:{label:{status:'PASS'}}};
        await expect(commands.executeConsignment({actor:reception,payload})).rejects.toMatchObject({code:'INCOMPLETE_COMPLIANCE_CHECKLIST',details:{row:2}});
        expect(await prisma.sample.count({where:{originalId:{in:originals}}})).toBe(0);expect(await prisma.consignment.count()).toBe(before);
        payload.samples[1].checklist=pass;const result=await commands.executeConsignment({actor:reception,payload});expect(result.samples).toHaveLength(2);expect(new Set(result.samples.map(s=>s.labId)).size).toBe(2);
        const records=await prisma.sample.findMany({where:{originalId:{in:originals}}});for(const record of records){expect(record.depthTopCm).toBeNull();expect(record.depthBottomCm).toBeNull();expect(record.moistureOnArrival).toBeNull();expect(record.positionalUncertaintyM).toBeNull();expect(JSON.parse(record.receptionData).bulkAttestation.actorId).toBe(reception.id);}
    });
    test('malformed recognized alias and omitted persistence version cannot overwrite a valid draft',async()=>{
        expect(schema.evaluate(schema.seed('SOILFER'),{items:{...pass.items,bagIntact:'INVALID'}},{},{origin:'PROJECT_SAMPLE',matrix:'SOIL'}).fieldErrors.container).toBe('INVALID_STATUS');
        const first=await intake({originalId:unique('VERSION'),isWalkIn:true,notes:'Retain'});
        await expect(commands.executeIntake({actor:reception,payload:{sampleId:first.id,notes:'Overwrite'},intent:'SAVE_DRAFT'})).rejects.toMatchObject({code:'INTAKE_VERSION_REQUIRED'});
        expect(JSON.parse((await prisma.sample.findUnique({where:{id:first.id}})).receptionData).commandFacts.notes).toBe('Retain');
    });
    test('published revision cannot be downgraded to editable draft',async()=>{
        await expect(prisma.intakeTemplateRevision.update({where:{id:'INTAKE-SEED-SOILFER-1'},data:{state:'DRAFT'}})).rejects.toThrow();
    });
    test('online committed response lost then same-key sync returns durable receipt, even after retirement',async()=>{
        const operationId=unique('lost-response'),originalId=unique('LOST'),capturedAtLocal='2026-10-01T10:00:00Z';
        const effective=await rules.resolve(await rules.intakeContext({actor:reception,origin:'DESK_WALKIN'}));
        const payload={originalId,intent:'ACCEPT',isWalkIn:true,checklist:pass,intakeTemplate:pin(effective),operationId,capturedAtLocal};
        const first=await request(app).post('/api/reception/intake').set('Authorization','Bearer '+token).send(payload);expect(first.status).toBe(200);
        const replay=await Sync.processSyncBatch(reception,{deviceId:'lost-response-device',operations:[{type:'RECORD_INTAKE',operationId,capturedAtLocal,payload}]});
        expect(replay.receipts[0].status).toBe('DUPLICATE_APPLIED');expect(await prisma.sample.count({where:{originalId}})).toBe(1);
        await prisma.intakeTemplateRevision.update({where:{id:effective.revisionId},data:{state:'REVOKED'}});
        try {const again=await Sync.processSyncBatch(reception,{deviceId:'lost-response-device',operations:[{type:'RECORD_INTAKE',operationId,capturedAtLocal,payload}]});expect(again.receipts[0].status).toBe('DUPLICATE_APPLIED');}
        finally {await prisma.intakeTemplateRevision.update({where:{id:effective.revisionId},data:{state:'PUBLISHED'}});}
    });
    test('offline explicit acceptance without a reviewed pin remains recoverable',async()=>{
        const originalId=unique('NO-PIN');const result=await Sync.processSyncBatch(reception,{deviceId:'no-pin-device',operations:[{type:'RECORD_INTAKE',operationId:unique('no-pin'),payload:{originalId,intent:'ACCEPT',isWalkIn:true,checklist:pass}}]});
        expect(result.receipts[0]).toMatchObject({status:'CONFLICT',code:'INTAKE_REVIEW_REQUIRED'});expect(await prisma.sample.count({where:{originalId}})).toBe(0);
    });
    test('legacy PT identity contains its round and a same-key walk-in retry does not mint another specimen',async()=>{
        const operationId=unique('pt'),payload={submitter:'Synthetic PT operator',sampleType:'PT',ptRound:'2026-3',operationId};
        const post=()=>request(app).post('/api/samples/walkin').set('Authorization','Bearer '+token).send(payload);
        const first=await post();expect(first.status).toBe(201);expect(first.body.sample.originalId).toMatch(/^PT-2026-3-P/);expect(first.body.sample.labId).toBeNull();
        const second=await post();expect(second.status).toBe(201);expect(second.body.sample.id).toBe(first.body.sample.id);expect(second.body.receiptId).toBe(first.body.receiptId);
    });
    test('categorized analysis intake creates its real work items atomically',async()=>{
        const analysis=await prisma.analysis.findFirst({where:{categoryId:{not:null},status:'active'}});
        expect(analysis).not.toBeNull();const originalId=unique('CATEGORY');
        const result=await intake({originalId,isWalkIn:true,checklist:pass,requiredAnalyses:[analysis.code],receivedMass:1000},'ACCEPT');
        const work=await prisma.workItem.findFirst({where:{sampleId:result.id,analysis:analysis.code}});expect(work).not.toBeNull();expect(typeof work.category).toBe('string');expect(work.category.length).toBeGreaterThan(0);
    });
    test('work generation failure leaves no sample, audit, accession or success receipt',async()=>{
        const generator=require('../../services/workGenerationService'),original=generator.generateWorkItemsForSample;
        generator.generateWorkItemsForSample=async()=>{throw new Error('Injected work storage failure');};
        const originalId=unique('FAIL'),operationId=unique('fail-op');
        try{await expect(intake({originalId,isWalkIn:true,checklist:pass},'ACCEPT',{operationId})).rejects.toThrow('Injected work storage failure');}finally{generator.generateWorkItemsForSample=original;}
        expect(await prisma.sample.count({where:{originalId}})).toBe(0);expect(await prisma.commandReceipt.count({where:{idempotencyKey:operationId}})).toBe(0);
        expect((await intake({originalId,isWalkIn:true,checklist:pass},'ACCEPT',{operationId})).status).toBe('ACCEPTED');
    });
    test('a temporary offline identity resolves the same bag across draft and acceptance',async()=>{
        const originalId='EXT-'+unique('device');
        const first=await intake({originalId,isWalkIn:true,notes:'One physical bag'});
        const accepted=await commands.executeIntake({actor:reception,payload:{originalId,isWalkIn:true,checklist:pass,expectedUpdatedAt:first.updatedAt},intent:'ACCEPT'});
        expect(accepted.id).toBe(first.id);expect(accepted.status).toBe('ACCEPTED');
        expect(await prisma.sample.count({where:{id:first.id}})).toBe(1);
        expect(await prisma.commandReceipt.count({where:{targetResource:originalId,actor:reception.username}})).toBe(2);
    });
    test('date-only acceptance preserves recorded source location and custody',async()=>{
        const id=unique('LOCATION'),observedAt=new Date('2026-09-20T10:00:00Z');
        const canonical={siteName:'Synthetic field site',latitude:0,longitude:0,locationCaptureMethod:'FIELD_GPS',locationConfidence:'HIGH'};
        const meta={locationCanonical:{value:canonical,source:'KOBO',lastUpdatedAt:observedAt.toISOString()},siteName:{value:'Synthetic field site',source:'KOBO'}};
        await prisma.sample.create({data:{id,originalId:id,status:'EXPECTED',assignedLab:lab,projectId:project,projectCode:'INTAKE-B1',latitude:0,longitude:0,locationSource:'FIELD_GPS',locationCapturedAt:observedAt,fieldMetadata:JSON.stringify(meta)}});
        const result=await intake({sampleId:id,checklist:pass,samplingDetails:{date:'2026-09-20',captureMethod:'MAP_PIN',coordinates:{lat:'',lng:''}}},'ACCEPT');
        const stored=await prisma.sample.findUnique({where:{id:result.id}});
        expect(JSON.parse(stored.fieldMetadata).locationCanonical).toEqual(meta.locationCanonical);expect(stored.locationSource).toBe('FIELD_GPS');expect(stored.locationCapturedAt).toEqual(observedAt);
        expect(stored.latitude).toBe(0);expect(stored.longitude).toBe(0);
        const batch=await commands.executeConsignment({actor:reception,payload:{consignment:{projectId:project},custody:{carrierName:'Legacy courier',trackingNumber:'SYNTHETIC-TRACK',handoverAt:observedAt.toISOString()},bulkAttestation:{confirmed:true},defaults:{checklist:pass},samples:[{originalId:unique('CUSTODY')}]}});
        expect(batch.consignment.custodyCarrierName).toBe('Legacy courier');expect(batch.consignment.custodyTrackingNumber).toBe('SYNTHETIC-TRACK');expect((await prisma.sample.findUnique({where:{id:batch.samples[0].id}})).custodyCarrierName).toBe('Legacy courier');
    });
    test('a servicing manager may read the project but cannot change its intake binding',async()=>{
        const projectId=unique('OWNER-PROJECT');
        await prisma.project.create({data:{id:projectId,code:projectId,name:'Synthetic owner project',status:'ACTIVE',labId:foreign,assignedLabIds:JSON.stringify([lab]),templateId:'GENERIC_OPEN_INTAKE'}});
        const source=await prisma.intakeTemplateRevision.findUnique({where:{id:'INTAKE-SEED-SOILFER-1'}});
        await expect(rules.saveBasic(manager,{labId:lab,projectId,sourceRevisionId:source.id,sourceHash:source.schemaHash,schema:JSON.parse(source.schemaJson),expectedVersion:0})).rejects.toMatchObject({status:403,code:'INTAKE_PROJECT_BINDING_FORBIDDEN'});
        expect(await prisma.intakeTemplateBinding.count({where:{projectId}})).toBe(0);
    });
    test('receipt storage failure rolls back the entire acceptance',async()=>{
        const receiptService=require('../../services/commandReceiptService'),original=receiptService.recordReceipt;
        const originalId=unique('RECEIPT-FAIL'),operationId=unique('receipt-fail-op');
        receiptService.recordReceipt=async()=>{throw new Error('Injected receipt storage failure');};
        try {await expect(intake({originalId,isWalkIn:true,checklist:pass},'ACCEPT',{operationId})).rejects.toThrow('Injected receipt storage failure');} finally {receiptService.recordReceipt=original;}
        expect(await prisma.sample.count({where:{originalId}})).toBe(0);expect(await prisma.commandReceipt.count({where:{idempotencyKey:operationId}})).toBe(0);
        expect((await intake({originalId,isWalkIn:true,checklist:pass},'ACCEPT',{operationId})).status).toBe('ACCEPTED');
    });
    test('legacy received record keeps physical receipt, custody, submitter, source and foreign-material facts',async()=>{
        const id=unique('LEGACY-RX'),at=new Date('2026-09-21T09:00:00Z');
        const rd={submitterDetails:{name:'Synthetic legacy submitter'},samplingDetails:{date:'2026-09-20'},coc:{carrierName:'Synthetic legacy courier'},checklist:pass};
        const original={receptionDate:at,receivedBy:'Original reception officer',custodyHandoverAt:at,custodyCarrierName:'Original carrier',custodyTrackingNumber:'SYNTHETIC',custodySenderSignature:'Original sender',receivingOfficerName:'Original reception officer',receivingOfficerSignature:'Original countersignature'};
        await prisma.sample.create({data:{id,originalId:id,status:'RECEIVED',assignedLab:lab,projectId:project,projectCode:'INTAKE-B1',...original,receptionData:JSON.stringify(rd),foreignMaterial:'["stones"]'}});
        await intake({sampleId:id,notes:'Review without new handover'},'ACCEPT');
        const stored=await prisma.sample.findUnique({where:{id}});expect(stored).toMatchObject(original);expect(stored.acceptedBy).toBe(reception.username);
        expect(JSON.parse(stored.receptionData).commandFacts).toMatchObject({submitterDetails:rd.submitterDetails,samplingDetails:rd.samplingDetails,coc:rd.coc,foreignMaterial:['stones']});
    });
    test('simultaneous settings saves are compare-and-set atomic',async()=>{
        const source=await prisma.intakeTemplateRevision.findUnique({where:{id:'INTAKE-SEED-SOILFER-1'}}),form=JSON.parse(source.schemaJson),before=await prisma.intakeTemplate.count();
        const outcomes=await Promise.allSettled([basic(source,form,{origin:'DESK_WALKIN'}),basic(source,form,{origin:'DESK_WALKIN'})]);
        expect(outcomes.filter(r=>r.status==='fulfilled')).toHaveLength(1);
        expect(outcomes.find(r=>r.status==='rejected').reason).toMatchObject({code:'INTAKE_SETTINGS_CHANGED'});
        expect(await prisma.intakeTemplate.count()).toBe(before+1);
    });
});
