"""Publish the exact approved Step2 package; no host calls."""
import datetime,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];REL='WP/batch-proof-controller-forward-step2-be837974-20261016/';S=R/REL
sys.path.insert(0,str(S))
from proof_contract import *
from proof_budget import package_allowance
P=S/('proof-package-'+ROOT_NAME);D=S/'reviewed-package6208186148-publication-once';BASE='859239963c25393a2619a1d73795f33e020e94dd'
def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R)
def oid(raw):return hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
require(git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists(),'Same writer/base/one publication required')
closed=exact_json((S/'execute-reviewed-package6208186148-once/exit-original.json').read_bytes())
require(closed['status']=='APPROVED_STEP2_PROOF_LOCAL_PACKAGE_PREPARED' and closed['exitCode']==0,'Actual closed preparation required')
files={p.name:p.read_bytes() for p in P.iterdir() if p.is_file()};spec=exact_json(files['proof-input.json']);index=exact_json(files['tooling-source-index.json']);review=exact_json(files['source-review-original.json']);approval(review,index)
require(review['id']==6208186148 and index['head']=='572d8cc94ee5a98c29392f556a57133cedd13128' and spec['sourceReviewId']==review['id'] and spec['toolingCommit']==index['head'] and spec['root']==str(ROOT) and spec['scope']==SCOPE and spec['retryAllowed'] is False,'Exact package authority required')
require(set(spec['packageHashes'])==FILES|set(PRIOR_FILES)|{'tooling-source-index.json','source-review-original.json','build-receipt.json','qualified-image-inspect-original.json','source-index.json','current-evidence.json','compose-source.yml'} and set(files)==set(spec['packageHashes'])|{'proof-input.json'} and len(files)==59,'Exact59-file inventory required')
for n,d in spec['packageHashes'].items():require(sha(files[n])==d,'Package hash differs '+n)
for n,d in graph(index).items():require(sha((S/n).read_bytes())==d and files[n]==(S/n).read_bytes(),'Reviewed source changed '+n)
qualified(exact_json(files['build-receipt.json']),files['build-receipt.json'],exact_json(files['qualified-image-inspect-original.json'])[0])
evidence=exact_json(files['current-evidence.json']);current(evidence['main'],evidence['ci'],evidence['prs'],evidence['verdicts'],evidence['comments']);rule_authorities(evidence['rules'],evidence['r2Accepted']);post_reboot_authorities(evidence['postRebootAuthorities']);memory_authority(evidence['memoryDirection']);jobs_scope_authority(evidence['jobsScope']);diagnostic_accepted(evidence['diagnosticAccepted']);step2_authorities(evidence['step2Authorities']);no_later_failure(evidence['sourceComments'],review,index)
require(evidence['review']==review,'Bound review differs')
frozen=exact_json((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());require(len(frozen)==1333,'Frozen inventory differs')
for p,d in frozen.items():require(sha((R/p).read_bytes())==d,'Application input changed '+p)
allowance=package_allowance({n:len(b) for n,b in files.items()})
D.mkdir()
def save(n,raw):
    with (D/n).open('xb') as f:f.write(raw)
v={'status':'APPROVED_STEP2_PACKAGE_RAW_BYTES_VERIFIED_NOT_LAUNCHED','verifiedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'preparedClosedUtc':closed['closedUtc'],'sourceHead':index['head'],'sourceReviewId':review['id'],'packageFileCount':len(files),'packageFileHashes':{n:sha(raw) for n,raw in files.items()},'futurePackageAllocationBytes':allowance,'all1333ApplicationInputsUnchanged':True,'source31HashesUnchanged':True,'remoteOperations':0,'retryAllowed':False}
save('package-publication-validation.json',canonical(v)+b'\n')
lead=f'''LATEST APPROVED NEW CONTROLLER-FORWARD STEP2 PACKAGE - {v['verifiedUtc']}.
ONE59-file exact572d/PASS6208186148 local package prepared CLOSED{closed['closedUtc']}; all raw package hashes/bound authorities/31source+1333app independently verified. Exact future package allocation {allowance}B charged BEFORE ROOT ONLY; already occupied BEFORE UNIT/runtime. Package + wrapper + validation at {REL}reviewed-package6208186148-publication-once/publication-index.json. No remote063000root/unit/container/proof yet. NEXT ONE unchanged reviewedlauncher with fresh current authority/source/PASS/unusedrootunit/R4+10GB BEFORE ROOT/immediatelyUNIT/runtime. Oneattempt/no retry; unknown inspectSAMErootunit neverredispatch.
ActualSourcePASS6208186148 answered source request6208113071;04:50:39 nativefallback CANCELLED/no duplicates. BundlePASS ACK ONLY eventual actual result. Qualification only/MainMERGEHOLD/no kitgate deploy. Runtime AWAITING_EXEC_STOP_POST is NOTclosedPASS; bothowners stoppedAndRetained NOTVACUOUS/postStopErrorsEMPTY/controllerOOM0/journalhookexit0/beforeafterraws samecgroup/fullfirstsecondpreservation/reconstructedlabels mandatory. Both privateHMACkeys+DBs HOST withheld; ALLjobsONrawlogs inspect before publicGit. Strictpairing/orphans/secondnatural/EVERYcontainer805600/full11242/science/refusals/N25MIN64/floor4GiBlogs10GB/500MB unchanged. Futurekit174newEXPECTED22holds20existingZMB-LAB1/managerimpact/countsmaydiff +9to10minrestart/exact600failure. All050000helpersoperators consumed neverreplay. 233000KEEPIT/R2COMPLETE/noprune/YY320GiBvisible/no growrestart/no103/noagentsnewchatworktreecheckoutconcurrentwriter/humansheld. SAMEheartbeat2min/restore10ONLYactualbeDEPLOYED+ClactualpostdeployPASS. Preserve older history verbatim below.

'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
save('checkpoint-prefix.txt',lead.encode())
paths=sorted(P.iterdir())+sorted((S/'execute-reviewed-package6208186148-once').iterdir())+sorted(D.iterdir())+[R/'WP/backlog-resume-20261013/execute-controller-forward-reviewed-package6208186148-once.py',pathlib.Path(__file__),*readmes]
require(all(p.is_file() for p in paths),'Regular owned files required')
save('publication-index.json',canonical({'baseAudit':BASE,'files':[{'path':p.relative_to(R).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]})+b'\n')
paths.append(D/'publication-index.json');names=[p.relative_to(R).as_posix() for p in paths];require(len(names)==len(set(names)),'Duplicate path')
for i in range(0,len(names),15):git('-c','core.autocrlf=false','add','-f','--',*names[i:i+15])
require(set(git('diff','--cached','--name-only').decode().splitlines())==set(names),'Staged ownership differs');tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):require(git('show',tree+':'+n)==p.read_bytes() and git('rev-parse',tree+':'+n).decode().strip()==oid(p.read_bytes()),'Staged raw identity differs')
git('commit','-m','Publish exact approved Step2 qualification proof package');head=git('rev-parse','HEAD').decode().strip()
for p,n in zip(paths,names):require(git('show',head+':'+n)==p.read_bytes(),'Committed raw identity differs')
git('push','origin','audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Published writer differs')
print(json.dumps({'audit':head,'sourceReviewId':review['id'],'packageFiles':len(files),'futurePackageAllocationBytes':allowance,'rawOidShaVerifiedBlobs':len(paths),'remoteOperations':0}))
