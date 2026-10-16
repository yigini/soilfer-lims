"""Retain the actual both-precheck acceptance; evidence only, no host calls."""
import sys
sys.dont_write_bytecode=True
from prechecks6210209468_boundary_publication import *
sys.path.insert(0,str(B))
import diagnostic_authority as authority
import proof_contract as contract

BASE='160643e9a9e1d16f1fb142d873e46d2d57ac3292'
D=B/'actual-both-results-accepted6210719791-once'
assert git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists()
publications=[]
for head,path,count in [
 ('a6d8c5d5085bbe07cb649f858ec00acf0e3f8ee1','source94-publication-once/publication-index.json',142),
 ('9899f651bceb542931a9ca3bf3aaa6cab11756d2','both-prechecks080000-closed-complete-result-publication-once/publication-index.json',157),
 ('d9b3be942fcf0a45c87c46565039f43d5150586b','actual-two-check-result6210471146-handoff-once/publication-index.json',49)]:
 publications.append(verify_publication(head,B.relative_to(W).as_posix()+'/'+path,count))
index=json.loads((B/'exact-source-review94-once/source-index.json').read_bytes())
assert len(index['files'])==26
for name,pin in index['files'].items():
 raw=(B/name).read_bytes();assert len(raw)==pin['bytes'] and sha(raw)==pin['sha256']
old=W/'WP/batch-proof-controller-forward-step2-be837974-20261016'
oldindex=json.loads((old/'exact-source-review420-once/source-index.json').read_bytes())
assert len(oldindex['files'])==31
for name,pin in oldindex['files'].items():
 raw=(old/name).read_bytes();assert len(raw)==pin['bytes'] and sha(raw)==pin['sha256']
frozen=json.loads((W/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes())
assert len(frozen)==1333 and all(sha((W/name).read_bytes())==digest for name,digest in frozen.items())
captures=[]
def read(path):
 raw=__import__('subprocess').check_output(['gh','api',path],cwd=W);captures.append((path,raw));return json.loads(raw)
review=read('repos/yigini/soilfer-lims/issues/comments/6210719791')
assert review['id']==6210719791 and review['created_at']==review['updated_at']=='2026-10-16T07:48:56Z'
assert review['performed_via_github_app']['id']==1236702 and review['performed_via_github_app']['slug']=='claude'
assert sha(review['body'].encode())=='3d40ff6bb22aff5dc2d5ea564cf6766fea7106a7bc001e234e25c303eed26536'
projection=contract.authority_projection(review)
assert contract.sha(contract.canonical(projection))=='94c17911c87ec6e9d860001528deab785f24a0c6c83ea69af09b6308c257fe97'
authority.read=read
evidence=authority.current_evidence()
D.mkdir()
save(D,'actual-acceptance-original.json',captures[0][1]);save(D,'actual-acceptance-readable.txt',review['body'].encode())
save(D,'acceptance-semantic-projection.json',contract.canonical(projection)+b'\n')
save(D,'current-authority-evidence.json',canonical(evidence)+b'\n')
for i,(path,raw) in enumerate(captures):save(D,'api-original-'+str(i).zfill(2)+'.json',raw)
save(D,'api-command-index.json',canonical([{'file':'api-original-'+str(i).zfill(2)+'.json','path':path,'bytes':len(raw),'sha256':sha(raw),'gitBlobOid':oid(raw)} for i,(path,raw) in enumerate(captures)])+b'\n')
record={'verifiedUtc':utc(),'actualAcceptanceId':6210719791,'bodySha256':sha(review['body'].encode()),'semanticSha256':contract.sha(contract.canonical(projection)),'publicationsVerified':publications,'all26PrecheckAnd31OldAttemptSourcesUnchanged':True,'all1333AppInputsUnchanged':True,'status':'BOTH_PRECHECKS_ACCEPTED_AS_REPORTED_NOT_RELEASE_QUALIFIED_NEW_ATTEMPT_SCOPE_ONLY','nativeResultFallbackCancelledAnswered':True,'old080000ConsumedNeverReplay':True,'old063000HookCauseUnknown':True,'reviewerOldHookSameCauseIsInferenceOnly':True,'hostOperations':0,'privateBytesFetched':0,'newGraphExists':False,'newSourcePassExists':False,'noNewHostPrecheckRequiredByActualScope':True,'acknowledgementOnlyNextConcreteSourceRequest':True,'externalSeparateCheckoutRequestNotPerformedUnderHumanSameWriterNoCheckoutConstraint':True}
save(D,'independent-acceptance-validation.json',canonical(record)+b'\n')
lead='LATEST ACTUAL BOTH080000 RESULTS ACCEPTED6210719791 - 2026-10-16T07:48:56Z.\nActual unedited Claude app1236702/slugclaude accepts C1PASS and C2CLOSEDREFUSAL as reported, NOT_RELEASE_QUALIFIED. BodySHA3d40ff6bb22aff5dc2d5ea564cf6766fea7106a7bc001e234e25c303eed26536/semantic94c17911c87ec6e9d860001528deab785f24a0c6c83ea69af09b6308c257fe97. All158closed9899+50handoffd9b3+143sourcea6 rawGitOID-SHA-length verified/all26precheck31oldattempt1333app unchanged/currentauthority fresh. Result6210471146 ANSWERED;07:52:50nativefallbackCANCELLED/NEVERrepeat/no duplicateACK/GH/native.\nNEW attempt scope: normalize FULLMountobjects ONCE selected() uniqueDestinations then sortDestination; preserve everyfullkey/change/duplicate/missing/extra/exactidownernameimageStartedAtrunning refusal. Sweep WHOLEattemptgraph map-derived array comparisons and list each site/verdict. Tests realcall+stop_exact with stand-inDocker rotating ALL6x6 realpublicmountorders EACHowner/everyfieldmutation/duplicate/missing/extra/oneinitiallyrunning realcallstop. State honest earlier HOSTdockerstop-through-THIScall evidence. NOnewHOSTcheck beforeattemptgraph: C2realpsinspectpath alreadyran; comparisontests pure. Distinctcompleteattemptgraph bindsTHISactualacceptance and needsownNEWexactallhashSourcePASS/freshR4+10GB/unusedrootunit/ONEattempt. NoNEWgraph/sourcePASS/package/root/attempt yet; NEXT ACTUALLYimplement authorizedNEWgraph/meaningfulguards/publish/newreview. Old080000+063000sourcePASSrootsunitsoperatorshelpersCONSUMEDimmutableNEVERpatchretryreplaycleanup.\nClold063hooklikelysamecause is HISINFERENCE ONLY/oldstreamsabsent/causeUNKNOWN. C1validated186new22holds/skipped22LOGONLY/futuredeploycountsmaydiff. Record controller memory.stat anon/file beforeafter under same805Swap0; futurekit stopgrace/actualexitcode and graceincluded9to10minrestart/exact600failure. Externalrequest separatecheckout208207 notperformed: directhuman SAMEwriter/noagentsnewchatworktreecheckoutconcurrentwriter remains. Allsevenstatusalreadyanswered/no duplicate. MainMERGEHOLD/233000KEEPIT/R2COMPLETE/noprune/nohostgrowrestart/no103/humansheld. SAMEheartbeatACTIVE2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. Preserve ALLolderhistoryverbatimbelow.\n\n'
print(json.dumps(boundary_publish(D,{__import__('pathlib').Path(__file__)},'Retain accepted080000 checks and new attempt scope6210719791',lead)))
