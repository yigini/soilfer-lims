"""Prepare a new source-only R2 interface successor; never invoke its operators."""
import ast,datetime,hashlib,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];OLD=R/'WP/r2-cache-cap-render-acc15844-20261015';S=R/'WP/r2-cache-api-identity-acc15844-20261015';D=S/'source-preparation-once'
BASE='5f0aba81926e9d5e9108eb261498870137ab3bee';PRIOR='be7e104fbd7617f75f11fadd5142bc23a2049aaf463f3d37f51a6235d1b496a1';FAILPATH='WP/r2-cache-cap-render-acc15844-20261015/r2-213000-closed-identity-refusal-publication-once/closed-identity-refusal.json'
assert not S.exists() and subprocess.check_output(['git','rev-parse','HEAD'],cwd=R).decode().strip()==BASE
names=['r2_contract.py','r2_cache.py','prepare_r2.py','launch_r2.py','verify_r2.py'];raws={n:(OLD/n).read_bytes() for n in names}
new={n:v.decode() for n,v in raws.items()}
c=new['r2_contract.py'].replace('T213000Z','T220000Z').replace('t213000z','t220000z').replace("v['id']>6200950139","v['id']>6201434518")
anchor="SOURCE_FILES=frozenset("
assert c.count(anchor)==1;c=c.replace(anchor,"PRIOR_DU_FAILURE_AUDIT="+repr(BASE)+"\nPRIOR_DU_FAILURE_PATH="+repr(FAILPATH)+"\nPRIOR_DU_FAILURE_SHA="+repr(PRIOR)+"\n"+anchor)
old="    r=rows[0];require(r.get('Shared') is False and r.get('Reclaimable') is True,'Buildx protection differs')\n    require(str(r.get('Size'))==str(wanted['Size']) and sorted(r.get('Parents',[]))==wanted['Parents'] and r.get('CreatedAt')==wanted['CreatedAt'] and r.get('LastUsedAt')==wanted['LastUsedAt'],'Buildx/API identity differs')"
replacement="""    r=rows[0];require(r.get('Shared') is False and r.get('Reclaimable') is True,'Buildx protection differs')
    parents=r.get('Parents');require(type(parents) is list and len(parents)==len(set(parents)),'Exact Buildx parent list required')
    for parent in parents:cache_id(parent)
    require(sorted(parents)==wanted['Parents'] and type(r.get('Type')) is str and r['Type']==wanted['Type'] and integer(r.get('UsageCount'))==wanted['UsageCount'],'Buildx exact reference identity differs')
    require(type(r.get('Mutable')) is bool,'Exact Buildx mutable boolean required')
    display={k:r.get(k) for k in ['Size','CreatedAt','LastUsedAt']}
    require(all(type(v) is str and 0<len(v)<=4096 for v in display.values()),'Bounded human display evidence required')
    # Installed v0.30.1 formats these three fields for humans, even in JSON.
    # Never parse/round them into byte counts or timestamps. Exact API identity
    # is checked against the initial plan immediately before AND after this du.
    return {'ID':wanted['ID'],'exactReferenceFields':['ID','Parents','Type','UsageCount','Shared','Reclaimable'],'humanDisplayEvidenceOnly':display,'apiExactBytesAndTimes':{k:wanted[k] for k in ['Size','CreatedAt','LastUsedAt']},'displayValuesUsedAsMutationAuthority':False}
"""
assert c.count(old)==1;c=c.replace(old,replacement.rstrip())
anchor="'unknownOutcomeNeverRetry=true','collisionSafeOnePassRemoteRenderAndCompileBeforeSsh=true'"
assert c.count(anchor)==1;c=c.replace(anchor,"'unknownOutcomeNeverRetry=true','exactApiByteTimeIdentityBeforeAndAfterBuildx=true','buildxHumanDisplayIsEvidenceOnly=true','priorR2DuFailureSha256='+PRIOR_DU_FAILURE_SHA,'collisionSafeOnePassRemoteRenderAndCompileBeforeSsh=true'")
c=c.replace("{'prior-r2-render-refusal.json','qualified-build-receipt.json'","{'prior-r2-du-refusal.json','prior-r2-render-refusal.json','qualified-build-receipt.json'")
anchor="validate_prior_render_failure(files['prior-r2-render-refusal.json'])";assert c.count(anchor)==1;c=c.replace(anchor,anchor+";validate_prior_du_failure(files['prior-r2-du-refusal.json'])")
c+='''\n\ndef validate_prior_du_failure(raw):
    require(sha(raw)==PRIOR_DU_FAILURE_SHA,'Exact published prior R2 identity refusal required')
    v=json_exact(raw)
    require(v.get('status')=='ACTUAL_R2_CLOSED_FAILED_BEFORE_FIRST_PRUNE_NO_RETRY' and v.get('root')=='/opt/lims/cleanup-receipts/r2-cache-acc15844-20261015T213000Z' and v.get('sourceHead')=='4eccae1525af20b4d40c7b1cbfbf6c1b931e1e97' and v.get('sourceReviewId')==6201434518 and v.get('actualPruneInvocations')==v.get('pruneIntentCount')==v.get('itemReceiptCount')==0 and v.get('all32PackageHashesVerified') is True and v.get('all55RootOriginalsRetained') is True and v.get('allOriginalAndFreshPreservationEqual') is True and v.get('qualifiedBuildReceiptSha256')==BUILD_RECEIPT_SHA and v.get('retryAllowed') is False and v.get('oldRootAndHelpersConsumedNeverReplay') is True,'Prior identity refusal cannot be retried or reclassified')
'''
new['r2_contract.py']=c
anchor='        du_guard(backend.du(wanted),wanted)';assert new['r2_cache.py'].count(anchor)==1
new['r2_cache.py']=new['r2_cache.py'].replace(anchor,"        crosscheck=du_guard(backend.du(wanted),wanted)\n        sink.event('buildx-reference-crosscheck',crosscheck)")
p=new['prepare_r2.py'].replace('WP/r2-cache-cap-render-acc15844-20261015/','WP/r2-cache-api-identity-acc15844-20261015/')
anchor="    files['source-index.json']=canonical(index)+b'\\n';files['source-review.json']=review_raw";assert p.count(anchor)==1
p=p.replace(anchor,"    files['prior-r2-du-refusal.json']=raw_git(PRIOR_DU_FAILURE_AUDIT,PRIOR_DU_FAILURE_PATH)[0];validate_prior_du_failure(files['prior-r2-du-refusal.json'])\n"+anchor);new['prepare_r2.py']=p
t=new['verify_r2.py'].replace('6201000000','6202000000').replace("return {**wanted,'Size':str(wanted['Size']),'Reclaimable':not wanted['InUse']}","return {**wanted,'Size':str(wanted['Size']),'Reclaimable':not wanted['InUse'],'Mutable':False}")
t=t.replace("'failed-r2-upload-source.py','prior-r2-render-refusal.json']","'failed-r2-upload-source.py','prior-r2-render-refusal.json','prior-r2-du-refusal.json','actual-r2-du-command-result.json','actual-r2-plan.json']")
t=t.replace('test_25_du_protected_or_size_changed_refuses','test_25_du_protected_or_exact_usage_changed_refuses').replace("('Size','101')","('UsageCount',2)")
t=t.replace("ROOT.endswith('T213000Z')","ROOT.endswith('T220000Z')").replace("self.assertNotIn('T210000Z',ROOT)","self.assertNotIn('T210000Z',ROOT);self.assertNotIn('T213000Z',ROOT)")
extra='''
    def actual_du_pair(self):
        wanted=json_exact(REFERENCE_RAW_FILES['actual-r2-plan.json'])['items'][0]
        result=json_exact(REFERENCE_RAW_FILES['actual-r2-du-command-result.json'])
        self.assertEqual(result['exitCode'],0);self.assertEqual(result['stderr'],'')
        return wanted,json_exact(result['stdout'])
    def test_51_actual_installed_du_human_fields_are_evidence_only(self):
        wanted,actual=self.actual_du_pair();proof=du_guard([actual],wanted)
        self.assertEqual(proof['humanDisplayEvidenceOnly'],{'Size':'33.17MB','CreatedAt':'2026-10-15 18:32:40.205063424 +0000 UTC','LastUsedAt':'2 hours ago'})
        self.assertEqual(proof['apiExactBytesAndTimes']['Size'],33165312);self.assertFalse(proof['displayValuesUsedAsMutationAuthority'])
    def test_52_original_strict_guard_reproduces_actual_refusal_purely(self):
        wanted,actual=self.actual_du_pair()
        self.assertNotEqual(str(actual['Size']),str(wanted['Size']))
        self.assertNotEqual(actual['CreatedAt'],wanted['CreatedAt']);self.assertNotEqual(actual['LastUsedAt'],wanted['LastUsedAt'])
        validate_prior_du_failure(REFERENCE_RAW_FILES['prior-r2-du-refusal.json'])
    def test_53_actual_controller_with_real_du_bytes_closed_fake_only(self):
        wanted,actual=self.actual_du_pair();b=FakeBackend([wanted,row('z',size=6000000000,shared=True)])
        b.du=lambda unused:[copy.deepcopy(actual)]
        result=module.maintain(b,b.sink);self.assertEqual(len(b.calls),1);self.assertIn(wanted['ID'],b.calls[0][b.calls[0].index('--filter')+1])
        self.assertEqual(result['remainingLogicalCacheBytes'],6000000000)
        proofs=[v for label,v in b.sink.events if label=='buildx-reference-crosscheck'];self.assertEqual(len(proofs),1);self.assertFalse(proofs[0]['displayValuesUsedAsMutationAuthority'])
    def test_54_exact_api_changes_during_real_human_du_skip_no_substitute(self):
        wanted,actual=self.actual_du_pair()
        changes={'Size':wanted['Size']+1,'CreatedAt':'2026-10-15T18:32:40.205063425Z','LastUsedAt':'2026-10-15T18:35:28.328436337Z','UsageCount':2,'Parents':[],'Type':'other','InUse':True,'Shared':True}
        for key,value in changes.items():
            with self.subTest(field=key):
                b=FakeBackend([wanted,row('z',size=6000000000,shared=True)])
                def changed_du(unused):
                    b.rows[wanted['ID']][key]=value;return [copy.deepcopy(actual)]
                b.du=changed_du;result=module.maintain(b,b.sink);self.assertEqual(b.calls,[]);self.assertEqual(result['items'][0]['status'],'SKIPPED')
    def test_55_buildx_exact_reference_mismatch_or_protection_refuses(self):
        wanted,actual=self.actual_du_pair()
        for key,value in [('ID','x'*25),('Parents',[]),('UsageCount',2),('UsageCount',True),('Type','other'),('Shared',True),('Reclaimable',False),('Mutable',0)]:
            with self.subTest(field=key,value=value):
                bad=copy.deepcopy(actual);bad[key]=value;self.rejected(du_guard,[bad],wanted)
    def test_56_missing_or_untyped_du_evidence_refuses(self):
        wanted,actual=self.actual_du_pair()
        for key in ['Size','CreatedAt','LastUsedAt','ID','Parents','UsageCount','Type','Shared','Reclaimable','Mutable']:
            bad=copy.deepcopy(actual);bad.pop(key);self.rejected(du_guard,[bad],wanted)
        for value in [None,3,True,'','x'*4097]:
            bad=copy.deepcopy(actual);bad['Size']=value;self.rejected(du_guard,[bad],wanted)
    def test_57_new_identity_failure_root_and_binding_are_mandatory(self):
        self.rejected(validate_prior_du_failure,b'{}');validate_prior_du_failure(REFERENCE_RAW_FILES['prior-r2-du-refusal.json'])
        tokens=review_tokens('a'*40,source_index());self.assertIn('exactApiByteTimeIdentityBeforeAndAfterBuildx=true',tokens);self.assertIn('buildxHumanDisplayIsEvidenceOnly=true',tokens)
        self.assertIn('priorR2DuFailureSha256='+PRIOR_DU_FAILURE_SHA,tokens)
    def test_58_display_numbers_never_replace_exact_api_bytes_or_nanos(self):
        wanted,actual=self.actual_du_pair();actual['Size']='999999999999GB';actual['CreatedAt']='human evidence';actual['LastUsedAt']='just now'
        proof=du_guard([actual],wanted);self.assertEqual(proof['apiExactBytesAndTimes'],{k:wanted[k] for k in ['Size','CreatedAt','LastUsedAt']});self.assertFalse(proof['displayValuesUsedAsMutationAuthority'])
'''
anchor="if __name__=='__main__':unittest.main(verbosity=2)";assert t.count(anchor)==1;t=t.replace(anchor,extra+'\n'+anchor);new['verify_r2.py']=t
assert sum(isinstance(v,ast.FunctionDef) and v.name.startswith('test_') for v in ast.walk(ast.parse(t)))==58
for n,v in new.items():ast.parse(v,filename=n,feature_version=(3,9));compile(v,n,'exec')
D.mkdir(parents=True)
def save(n,b):
 with (D/n).open('xb') as f:f.write(b)
for n,b in raws.items():save('before-'+n,b)
for n in ['build-receipt.json','image-inspect-original.json','failed-r2-upload-source.py','prior-r2-render-refusal.json']:save(n,(OLD/'source-preparation-once'/n).read_bytes())
raw=subprocess.check_output(['git','show',BASE+':'+FAILPATH],cwd=R);assert hashlib.sha256(raw).hexdigest()==PRIOR;save('prior-r2-du-refusal.json',raw)
C=OLD/'r2-213000-closed-identity-refusal-originals-once'
for n,p in [('actual-r2-du-command-result.json','00021-command-result.json'),('actual-r2-plan.json','00016-closed-plan.json')]:save(n,(C/p).read_bytes())
for n,v in new.items():
 with (S/n).open('x',encoding='utf-8',newline='\n') as f:f.write(v)
save('source-preparation-record.json',(json.dumps({'preparedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'baseAudit':BASE,'sourceBeforeSha256':{n:hashlib.sha256(v).hexdigest() for n,v in raws.items()},'proposedRoot':'/opt/lims/cleanup-receipts/r2-cache-acc15844-20261015T220000Z','priorDuFailureSha256':PRIOR,'realOperatorCalls':0,'notAReplay':True},indent=2)+'\n').encode())
print(json.dumps({'status':'COMPLETE_NEW_R2_INTERFACE_SOURCE_PREPARED_NOT_EXECUTED','sourceFiles':names,'guardCount':58,'oldGraphsUnchanged':all((OLD/n).read_bytes()==v for n,v in raws.items()),'cacheOperations':0}))
