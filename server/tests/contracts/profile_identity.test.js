const service = require('../../services/profileIdentityService');
const adapter = require('../../services/sisAdapterService');
const sample = {country:'GTM',projectCode:'SOILFER-US'};
const context = {sample,actor:'test-tech',recordedAt:'2026-10-03T12:00:00.000Z'};

describe('Canonical profile identity and exact legacy compatibility', () => {
    test('pit and site coexist on new capture, but an absent canonical retains the old site key', () => {
        const field = {pit_id:{value:'PIT-17'},site_id:{value:'SITE-2'}};
        expect(adapter.extractProfileReference(sample,field,{})).toMatchObject({profileCode:'SITE-2',state:'ABSENT'});
        const ref = service.captureReference({...field,profileConfirmed:true},context);
        expect(ref).toMatchObject({code:'PIT-17',namespace:'GTM:SOILFER-US',relation:'CONFIRMED_PROFILE'});
        expect(adapter.extractProfileReference(sample,{...field,profileReference:ref},{}).profileCode).toBe('PIT-17');
        expect(field.site_id.value).toBe('SITE-2');
    });
    test('explicit unknown remains unknown; invalid present values do not resurrect aliases', () => {
        const ref = service.captureReference({profileReference:{code:null}},context);
        expect(adapter.extractProfileReference(sample,{profileReference:ref,site_id:'SITE'},{})).toMatchObject({profileCode:null,profileNamespace:null,profileKey:null,state:'UNKNOWN'});
        for (const invalid of [null,{},[],{code:null},{...ref,code:''},{...ref,code:'SITE',namespace:null}]) {
            expect(()=>adapter.extractProfileReference(sample,{profileReference:invalid,site_id:'SITE'},{})).toThrow(service.ProfileReferenceConflictError);
        }
    });
    test.each([0,{value:0},{value:{value:'0'}}])('valid zero is preserved (%j)', code => {
        expect(service.captureReference({pit_id:code},context).code).toBe('0');
    });
    test.each([{},[],true,NaN,Infinity,'x'.repeat(256),'[object Object]'])('invalid code is rejected, never truncated (%j)', code => {
        expect(()=>service.captureReference({pit_id:code},context)).toThrow(service.ProfileReferenceConflictError);
    });
    test('alias conflicts are actionable while independent site is retained', () => {
        expect(()=>service.captureReference({pit_id:'PIT-1',profile_id:'PIT-2'},context)).toThrow(service.ProfileReferenceConflictError);
        expect(service.captureReference({pit_id:'PIT-1',profileId:{value:'PIT-1'},site_id:'SITE-2'},context).code).toBe('PIT-1');
    });
    test.each([false,0,'false','no','0',{value:'false'}])('false composite flags are false (%j)', flag => {
        expect(service.captureReference({pit_id:'PIT',isComposite:flag},context).relation).toBe('SITE_POINT');
    });
    test('depth and coordinates never prove a confirmed profile', () => {
        expect(service.captureReference({pit_id:'PIT',depthTop:0,depthBottom:20,latitude:1,longitude:2},context).relation).toBe('SITE_POINT');
    });
    test('canonical namespace survives country, project and laboratory context changes', () => {
        const ref = service.captureReference({pit_id:'PIT'},context);
        expect(adapter.extractProfileReference({country:'OTHER',projectCode:'NEW',assignedLab:'LAB2'},{profileReference:ref},{}).profileKey).toBe('GTM:SOILFER-US:PIT');
        expect(service.captureReference({pit_id:'PIT'},{...context,sample:{country:'OTHER',projectCode:'NEW'}}).key).not.toBe(ref.key);
        expect(()=>service.captureReference({profileReference:{code:'PIT',namespace:'FOREIGN'}},context)).toThrow(service.ProfileReferenceConflictError);
    });
    test('legacy preservation freezes the exact original key and does not promote a site to a pit', () => {
        const field = {site_id:'SITE',pit_id:'PIT'};
        const preserved = service.preserveLegacyBeforeContextChange(sample,field,{},adapter.extractLegacyProfileReference,context);
        expect(adapter.extractProfileReference({country:'NEW',projectCode:'NEW'},preserved,{})).toMatchObject({profileCode:'SITE',profileKey:'GTM:SOILFER-US:SITE',profileRelation:'SITE_POINT',state:'LEGACY_PRESERVED'});
        expect(service.preserveLegacyBeforeContextChange(sample,preserved,{},adapter.extractLegacyProfileReference,context)).toBe(preserved);
        expect(field).not.toHaveProperty('profileCompatibility');
    });
    test('a canonical read is pure and rejects forged provenance', () => {
        const ref = service.captureReference({pit_id:'PIT'},context);
        const before = JSON.stringify(ref);
        adapter.extractProfileReference(sample,{profileReference:ref},{});
        expect(JSON.stringify(ref)).toBe(before);
        for (const patch of [{schemaVersion:'other'},{revision:0},{recordedAt:'bad'},{code:null},{key:'forged'}]) expect(()=>service.validateReference({...ref,...patch})).toThrow();
    });
});
