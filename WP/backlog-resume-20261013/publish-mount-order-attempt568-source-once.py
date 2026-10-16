"""Publish complete new tested source and every closed guard original only."""
import ast,sys
sys.dont_write_bytecode=True
from prechecks6210209468_boundary_publication import *
N=W/'WP/batch-proof-mount-order-forward-be837974-20261016'
D=N/'source568-publication-once';assert not D.exists()
assert git('rev-parse','HEAD').decode().strip()=='48eb2d20692b2e642a3303dc943dd7ba4f71648a' and not git('diff','--cached','--name-only').strip()
sys.path.insert(0,str(N));import proof_contract as c;import prepare_proof as prep
final=json.loads((N/'source-local-host-mount-order-final-once/exit-original.json').read_bytes())
assert final['status']=='PASS' and final['expectedTests']==568 and final['sourceSha256Before']==final['sourceSha256After'] and len(c.FILES)==37
for name in c.FILES:
 raw=(N/name).read_bytes();assert sha(raw)==final['sourceSha256After'][name]
 if name.endswith('.py'):ast.parse(raw,filename=name,feature_version=(3,9));compile(raw,name,'exec')
host=json.loads((N/'source-local-host-mount-order-final-once/host-stdout-original.json').read_bytes())
assert host['status']=='PASS' and host['testsRun']==568 and '3.9.23' in host['pythonVersion'] and host['actualDockerCalls']==host['productionSqliteConnections']==host['proofOperatorsExecuted']==0
frozen=json.loads((W/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());assert len(frozen)==1333
assert all(sha((W/name).read_bytes())==pin for name,pin in frozen.items())
oldgraphs=[]
for rel,idxpath,count in [('WP/controller063000-prechecks-be837974-20261016','exact-source-review94-once/source-index.json',26),('WP/batch-proof-controller-forward-step2-be837974-20261016','exact-source-review420-once/source-index.json',31)]:
 idx=json.loads((W/rel/idxpath).read_bytes());assert len(idx['files'])==count
 for name,pin in idx['files'].items():assert len((W/rel/name).read_bytes())==pin['bytes'] and sha((W/rel/name).read_bytes())==pin['sha256']
 oldgraphs.append({'head':idx['head'],'bindings':count,'unchanged':True})
captures=[];original=prep.command
def capture(*args):
 raw=original(*args)
 if args[:2]==('gh','api'):captures.append((list(args),raw))
 return raw
prep.command=capture;evidence=prep.current_evidence()
assert json.loads(capture('gh','api','repos/yigini/soilfer-lims/issues/191'))['state']=='closed'
c.attempt_authorities(evidence['attemptAuthorities'])
D.mkdir();save(D,'current-authority-evidence.json',canonical(evidence)+b'\n')
for i,(argv,raw) in enumerate(captures):save(D,'api-original-'+str(i).zfill(2)+'.json',raw)
save(D,'api-command-index.json',canonical([{'file':'api-original-'+str(i).zfill(2)+'.json','argv':argv,'bytes':len(raw),'sha256':sha(raw),'gitBlobOid':oid(raw)} for i,(argv,raw) in enumerate(captures)])+b'\n')
old=json.loads((W/'WP/batch-proof-controller-forward-step2-be837974-20261016/exact-source-review420-once/source-index.json').read_bytes())
changes={name:('ADDED' if name not in old['files'] else 'BYTE_IDENTICAL' if old['files'][name]['sha256']==sha((N/name).read_bytes()) else 'CHANGED') for name in sorted(c.FILES)}
save(D,'source-change-inventory.json',canonical(changes)+b'\n')
readers=[
 {'reader':'stop_owned.call/stop_exact/selected','exercise':'All real new functions run unpatched in568 local+host suite; external subprocess only replaced by rotating closed Docker stand-in. Real files/exclusive0400/fsync/hash/metadata/parse/guards execute. All6x6 orders EACH real-public owner; everyfullkey mutation, duplicate/missing/extra, running stop and failure continuation.','limits':'No new REAL Docker call. C2 actual real ps/inspect already accepted6210719791. No verified earlier HOSTdockerstop through THIScall; old emergency stops used distinct proof_docker.Docker.stop.'},
 {'reader':'controller_guard.actual_reader/own_snapshot','exercise':host['unpatchedRealReaderEvidence'],'limits':'Unpatched real numericPID path bytes equal plainopen; actualown_snapshot outsideunit stops at exactmembership, no production memory counters. New memory.stat uses same reader; closed fixtures verify all8raws retained before malformedstat/OOM predicates. Actualunit stat evidence required runtime.'},
 {'reader':'kobo_copy_preservation.verify_copy/provenance_rules','exercise':'Real NEW synthetic full112table42receipt SQLite fixtures run bothversions; exact16actualLOCALNodewriter output throughchecked_cross; sourceunchanged original+same-sync-new strictpairing/orphan/protected/science/refusalnegativeguards.','limits':'No oldinputSQL/productionSQLite/copied private DB bytes; C1 actual063data comparison alreadyaccepted.'},
 {'reader':'stop_owned.verify_retained_graph/post_stop_snapshot/privatekeys','exercise':'Unpatched fixture-file hash reader opens all37actualNEWfiles, actualtamper refusal; entirestop-first verify memory keymain orchestration tests. Realrandom/privatekeywrites onNEWsynthetic roots only.','limits':'Actualstop postunit notrun; rawprivateactualinspect/key bytes neverfetched.'},
 {'reader':'All unchanged fetch/jobs/broadpostflight/command/file/input/disk/health/memory/runtime readers','exercise':'Carried forward from accepted063000/previoussource, prioractualunpatched path identities retained in oldsource420-publication-once/real-host-reader-inventory.json; allold420tests retained with currentauthority/fingerprint/statfixtures.','limits':'Old063000 failed and NOTqualified; no retroPASS. Final568 host source IN MEMORY; allrealprocesses blocked exceptpre-suite exactnumericreader; SQLite confined NEWsynthetic fixtures. No newhostcheck/root/unit/attempt.'}
]
save(D,'real-host-reader-inventory.json',canonical(readers)+b'\n')
record={'verifiedUtc':utc(),'status':'NEW_COMPLETE37_SOURCE_FINAL568_LOCAL_AND568_ACTUAL_HOST_PASS_AWAITING_OWN_EXACT_SOURCE_REVIEW','sourceFiles':37,'localTests':568,'actualHostTests':568,'pythonHost':'3.9.23','sourceUnchanged':True,'all1333FrozenAppInputsUnchanged':True,'oldGraphs':oldgraphs,'all6x6EachOwnerThroughActualCall':True,'realHostDockerCallsInTests':0,'hostSourceFilesWritten':0,'productionSqliteConnections':0,'operatorsExecuted':0,'newHostPrecheck':False,'newPackage':False,'newRoot':False,'sourcePass':False,'old080000ConsumedImmutable':True,'old063000CauseUnknown':True,'first568Local432Pass136FixtureFailuresHostNotStarted':True,'second568LocalPassHost567Pass1AstPrettyPrinterFixtureFailure':True,'final568BothPass':True,'priorFailuresPreserved':True,'mapArrayRuntimeEqualitySites':656,'nodeWriterProducer':'ACTUAL_LOCAL_NODE_UNPATCHED_BOUND_CONTROLLER','hostNodeExecuted':False}
save(D,'complete-source568-verification.json',canonical(record)+b'\n')
extra_names=['prepare-mount-order-attempt6210719791-source-once.py','complete-mount-order-attempt-source-and-sweep-once.py','prepare-mount-order-local-host-harness-once.py','verify-mount-order-attempt-local-host-first-once.py','correct-mount-order-closed-fixtures-once.py','verify-mount-order-attempt-local-host-complete-once.py','correct-mount-order-python-ast-fixture-once.py','verify-mount-order-attempt-local-host-final-once.py','publish-mount-order-attempt568-source-once.py']
paths={p for p in N.rglob('*') if p.is_file()}|{W/'WP/backlog-resume-20261013'/name for name in extra_names}
assert not any(p.suffix=='.pyc' for p in paths)
lead='LATEST COMPLETE NEW MOUNT-ORDER ATTEMPT SOURCE /568LOCAL+568ACTUALHOST PASS - '+final['closedUtc']+'.\nComplete37-file NEWgraph WP/batch-proof-mount-order-forward-be837974-20261016 underactual6210719791acceptance. Final568LOCAL+568actualhostPython3.9.23PASS/all37unchanged/allold31+26+1333app unchanged/currentauthority fresh. Fullmountobjects uniqueDestination sortedONCE selected()/exactidentitystateallkeyguard/realcallrawHOST0400metadataBEFOREpredicates/errorphase/publicfailure/stopfirstverify-memory-key preserved. ALL6x6EACHownerrealpublicmountorders throughactualcall+stop_exact/everysinglefieldmutation/duplicate/missing/extra/unknown/removedfield/runningrealcallstop/oneownerfailurecontinuation. ActualDockerexternalstandinONLY/realDocker0/productionSQL0/hostsourceINMEMORY/NEWsyntheticSQLiteonly.\nWholegraphmap-array-sweep lists10siteverdicts+656runtimeequalityASTs; explicitsemanticorderedOCI/commands/Gitparents/SQLcolumns/provenanceprefixes retained. No verifiedearlierHOSTdockerstopthroughTHIScall/C2psinspectONLY/old063hookcauseUNKNOWN/reviewerexplanationINFERENCE. No newHOSTprecheck peractualscope. Controller memory.stat anonfile+all8rawreads retainedbeforepredicates/beforeafterpoststop/same805Swap0OOM0/numericPIDaliasmembershipdevinodeguards. Exact16lowerhexfingerprint/actualunpatchedLOCALNodewriter345bfa7727c61604 throughfullpairing/hostusesLOCALoutputNOhostNodeclaim.\nEarlier568LOCAL432PASS136fixtureFAIL/HOSTNOTSTARTED(timeoutkeywordshadow+2staleclocks) retained; next568LOCALPASS/HOST567PASS1ASTprettyprinterfixtureFAIL retained; finalstructuralASTcomparison568bothPASS/no runtimeguardrelaxation/operatorreplay. SourcepreparelaunchrunUNEXECUTEDexceptimportcompileclosedFAKEguards; proposedNEW100000rootunit/no package/attempt yet. NEXT actualconcrete37allhashSourceReview with621071ACKONLYthere, actualNEWexactSourcePASS required beforeONEattempt/freshR4+10GBROOTUNITRuntime/unusedrootunit. MainMERGEHOLD/233000KEEPIT/R2COMPLETE/noprune/nohostgrowrestart/no103/noagentsnewchatworktreecheckoutconcurrentwriter/humansheld. Futurekit186new22holdsC1validated/skipped22LOGONLY/countsmaydiff+stopgraceactualexitincluded9to10minrestart/exact600failure. SAMEheartbeatACTIVE2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. PreserveALLolderhistoryverbatim below.\n\n'
print(json.dumps(boundary_publish(D,paths,'Publish complete37-source mount-order attempt with568 local and host guards',lead)))
