"""Verify and publish ONE prepared exact mount-order package, without host calls."""
import pathlib,sys
sys.dont_write_bytecode=True
W=pathlib.Path(__file__).resolve().parents[2];H=W/'WP/backlog-resume-20261013';sys.path.insert(0,str(H))
from prechecks6210209468_evidence import git,sha,oid,canonical,utc,save
from prechecks6210209468_boundary_publication import boundary_publish
REL='WP/batch-proof-mount-order-forward-be837974-20261016/';B=W/REL;D=B/'reviewed-package6211327371-publication-once'
BASE='96fe4cd136654aff042bdb720330badcefbe729f';SOURCE='187636984895aec44044635fb63498b0fcb3102e'
sys.path.insert(0,str(B))
from proof_contract import *
from proof_budget import package_allowance
P=B/('proof-package-'+ROOT_NAME);E=B/'execute-reviewed-package6211327371-complete-once'
require(git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists(),'Same writer/empty stage/new publication required')
closed=exact_json((E/'exit-original.json').read_bytes());require(closed['status']=='APPROVED_STEP2_PROOF_LOCAL_PACKAGE_PREPARED' and closed['exitCode']==0,'Actual package closure required')
require(all(p.is_file() and not p.is_symlink() for p in P.iterdir()),'Regular flat package required')
files={p.name:p.read_bytes() for p in P.iterdir()};spec=exact_json(files['proof-input.json']);index=exact_json(files['tooling-source-index.json']);review=exact_json(files['source-review-original.json']);approval(review,index)
require(review['id']==6211327371 and index['head']==SOURCE and spec['sourceReviewId']==review['id'] and spec['toolingCommit']==SOURCE and spec['root']==str(ROOT) and spec['scope']==SCOPE and spec['retryAllowed'] is False,'Exact package authority differs')
require(set(spec['packageHashes'])==FILES|set(PRIOR_FILES)|{'tooling-source-index.json','source-review-original.json','build-receipt.json','qualified-image-inspect-original.json','source-index.json','current-evidence.json','compose-source.yml'} and set(files)==set(spec['packageHashes'])|{'proof-input.json'} and len(files)==65,'Exact65-file package required')
for n,h in spec['packageHashes'].items():require(sha(files[n])==h,'Package hash differs '+n)
for n,h in graph(index).items():require(files[n]==(B/n).read_bytes() and sha(files[n])==h,'Reviewed source changed '+n)
qualified(exact_json(files['build-receipt.json']),files['build-receipt.json'],exact_json(files['qualified-image-inspect-original.json'])[0])
e=exact_json(files['current-evidence.json']);current(e['main'],e['ci'],e['prs'],e['verdicts'],e['comments']);rule_authorities(e['rules'],e['r2Accepted']);post_reboot_authorities(e['postRebootAuthorities']);memory_authority(e['memoryDirection']);jobs_scope_authority(e['jobsScope']);diagnostic_accepted(e['diagnosticAccepted']);step2_authorities(e['step2Authorities']);attempt_authorities(e['attemptAuthorities']);no_later_failure(e['sourceComments'],review,index);require(e['review']==review,'Bound review differs')
frozen=exact_json((W/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());require(len(frozen)==1333,'Application inventory differs')
for n,h in frozen.items():require(sha((W/n).read_bytes())==h,'Application changed '+n)
allowance=package_allowance({n:len(r) for n,r in files.items()});D.mkdir()
record={'status':'APPROVED_MOUNT_ORDER_PACKAGE_RAW_BYTES_VERIFIED_NOT_LAUNCHED','verifiedUtc':utc(),'preparedClosedUtc':closed['closedUtc'],'sourceHead':SOURCE,'sourceReviewId':review['id'],'packageFileCount':65,'packageFileHashes':{n:sha(r) for n,r in files.items()},'futurePackageAllocationBytes':allowance,'all1333ApplicationInputsUnchanged':True,'source37HashesUnchanged':True,'remoteOperations':0,'retryAllowed':False}
save(D,'package-publication-validation.json',canonical(record)+b'\n')
save(D,'first-wrapper-index-schema-refusal-derived.json',canonical({'kind':'TOOL_OUTPUT_TRANSCRIPTION','helper':'WP/backlog-resume-20261013/execute-mount-order-reviewed-package6211327371-once.py','exception':'KeyError: sourceReviewId','site':'line18 publication-index.json lookup','cause':'Wrapper assumed older publication top-level sourceReviewId/files; actual boundary publication uses baseAudit/bindings','beforePreparationDirectoryCreation':True,'beforePrepareProofInvocation':True,'packageCreated':False,'hostOperations':0,'correctedSuccessor':'execute-mount-order-reviewed-package6211327371-complete-once.py','oldHelperUnchangedNeverReplay':True})+b'\n')
lead=f'''LATEST APPROVED NEW MOUNT-ORDER PACKAGE - {record['verifiedUtc']}.
ONE65-file exact18763698/PASS6211327371 local package prepared CLOSED{closed['closedUtc']}; ALLpackagehashes/37source+1333app unchanged/all bound authorities verified. Futurepackageallocation {allowance}B charged BEFORE_ROOT ONLY/alreadyoccupied BEFORE_UNIT/runtime. Evidence at {REL}reviewed-package6211327371-publication-once/publication-index.json. No remote100000root/unit/attempt yet. NEXT ONEunchanged reviewedlauncher/freshR4+10GB beforeROOT/immediatelyUNIT/runtime/unusedrootunit/no retry; unknown inspectSAME neverredispatch. Source621098ANSWERED/08:24:55nativefallbackCANCELLED NEVERrepeat/ACK621132ONLYeventual actualresult. No kitgate deploy/MainMERGEHOLD/233000KEEPIT/R2COMPLETE/noprune/nohostgrowrestart/no103/noagentsnewchatworktreecheckoutconcurrentwriter/humansheld. Own memory.stat first-observe refusal and retriable-skip stalledcursor comparator refusal consume attempt/reporthonestly. ALLactualstop-post/fullpreservation/controllerOOM0/rawprivacy/science600805/budgets guards stay. Futurekit186new22holdsC1validated/countsmaydiff+stopgraceactualexitincluded9to10minrestart/exact600failure. SAMEheartbeatACTIVE2min restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. Preserve ALL older history verbatim below.

'''
extras=[*P.iterdir(),*E.iterdir(),H/'execute-mount-order-reviewed-package6211327371-once.py',H/'execute-mount-order-reviewed-package6211327371-complete-once.py',pathlib.Path(__file__)]
result=boundary_publish(D,extras,'Publish approved mount-order qualification package',lead)
print(json.dumps({**result,'sourceReviewId':review['id'],'packageFiles':65,'futurePackageAllocationBytes':allowance,'remoteOperations':0}))
