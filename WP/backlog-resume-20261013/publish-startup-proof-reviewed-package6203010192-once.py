"""Publish the exact approved startup package; no host calls."""
import datetime,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];REL='WP/batch-proof-startup-be837974-20261015/';S=R/REL
sys.path.insert(0,str(S))
from proof_contract import *
from proof_budget import package_allowance
P=S/('proof-package-'+ROOT_NAME);D=S/'reviewed-package6203010192-publication-once';BASE='405025be0480c7ccabc78593071b1d42fc92f179'
def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R)
def oid(raw):return hashlib.sha1(('blob '+str(len(raw))+'\0').encode()+raw).hexdigest()
require(git('rev-parse','HEAD').decode().strip()==BASE and git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip() and not D.exists(),'Same writer/base/one publication required')
closed=exact_json((S/'execute-reviewed-package6203010192-once/exit-original.json').read_bytes())
require(closed['status']=='APPROVED_STARTUP_PROOF_LOCAL_PACKAGE_PREPARED' and closed['exitCode']==0,'Actual closed preparation required')
files={p.name:p.read_bytes() for p in P.iterdir() if p.is_file()};spec=exact_json(files['proof-input.json']);index=exact_json(files['tooling-source-index.json']);review=exact_json(files['source-review-original.json']);approval(review,index)
require(review['id']==6203010192 and index['head']=='29fa000751f25447f1ff8c129b0dfcc5d2b67445' and spec['sourceReviewId']==review['id'] and spec['toolingCommit']==index['head'] and spec['root']==str(ROOT) and spec['scope']==SCOPE and spec['retryAllowed'] is False,'Exact package authority required')
require(set(spec['packageHashes'])==FILES|set(PRIOR_FILES)|{'tooling-source-index.json','source-review-original.json','build-receipt.json','qualified-image-inspect-original.json','source-index.json','current-evidence.json','compose-source.yml'} and set(files)==set(spec['packageHashes'])|{'proof-input.json'} and len(files)==42,'Exact42-file inventory required')
for n,d in spec['packageHashes'].items():require(sha(files[n])==d,'Package hash differs '+n)
for n,d in graph(index).items():require(sha((S/n).read_bytes())==d and files[n]==(S/n).read_bytes(),'Reviewed source changed '+n)
qualified(exact_json(files['build-receipt.json']),files['build-receipt.json'],exact_json(files['qualified-image-inspect-original.json'])[0])
evidence=exact_json(files['current-evidence.json']);current(evidence['main'],evidence['ci'],evidence['prs'],evidence['verdicts'],evidence['comments']);rule_authorities(evidence['rules'],evidence['r2Accepted']);post_reboot_authorities(evidence['postRebootAuthorities']);no_later_failure(evidence['sourceComments'],review,index)
require(evidence['review']==review,'Bound review differs')
frozen=exact_json((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());require(len(frozen)==1333,'Frozen inventory differs')
for p,d in frozen.items():require(sha((R/p).read_bytes())==d,'Application input changed '+p)
allowance=package_allowance({n:len(b) for n,b in files.items()})
D.mkdir()
def save(n,raw):
    with (D/n).open('xb') as f:f.write(raw)
v={'status':'APPROVED_STARTUP_PACKAGE_RAW_BYTES_VERIFIED_NOT_LAUNCHED','verifiedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'preparedClosedUtc':closed['closedUtc'],'sourceHead':index['head'],'sourceReviewId':review['id'],'packageFileCount':len(files),'packageFileHashes':{n:sha(raw) for n,raw in files.items()},'futurePackageAllocationBytes':allowance,'all1333ApplicationInputsUnchanged':True,'source14HashesUnchanged':True,'remoteOperations':0,'retryAllowed':False}
save('package-publication-validation.json',canonical(v)+b'\n')
lead=f'''LATEST APPROVED PACKAGE — {v['verifiedUtc']}. ONE new42-file startup-proof package for exact29fa/PASS6203010192 prepared{closed['closedUtc']}, independently validated allrawhashes/currentmainCI4audits6rules2postrebootpins/R2accepted/all14+1333unchanged. Exactfuturepackageallocation {allowance}B is to be charged BEFORE ROOT ONLY; BEFORE UNIT/runtime alreadyoccupied. Fullpackage/wrapper/publication at {REL}reviewed-package6203010192-publication-once/publication-index.json. No remoteROOT/unit/defaultstartup yet. NEXT ONE reviewedlauncher withfreshactualauthority/unused230000rootunit/R4+ADDITIONAL10GB beforeROOT/unit/runtime; oneattempt/no retry. JobsOFFstartup-only/notreleasequalified/jobsON+kit+gate+deploylater; mainmergeHOLD/heartbeat2min/sciencehistory/R1-R5/humans held. No duplicateACK/native/request; actualPASSACKbundleonly eventual result.

'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
paths=sorted(P.iterdir())+sorted((S/'execute-reviewed-package6203010192-once').iterdir())+sorted(D.iterdir())+[R/'WP/backlog-resume-20261013/execute-startup-proof-reviewed-package6203010192-once.py',pathlib.Path(__file__),*readmes]
require(all(p.is_file() for p in paths),'Regular owned files required')
save('publication-index.json',canonical({'baseAudit':BASE,'files':[{'path':p.relative_to(R).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]})+b'\n')
paths.append(D/'publication-index.json');names=[p.relative_to(R).as_posix() for p in paths];require(len(names)==len(set(names)),'Duplicate path')
for i in range(0,len(names),15):git('-c','core.autocrlf=false','add','-f','--',*names[i:i+15])
require(set(git('diff','--cached','--name-only').decode().splitlines())==set(names),'Staged ownership differs');tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):require(git('show',tree+':'+n)==p.read_bytes() and git('rev-parse',tree+':'+n).decode().strip()==oid(p.read_bytes()),'Staged raw identity differs')
git('commit','-m','Publish exact approved startup proof package');head=git('rev-parse','HEAD').decode().strip()
for p,n in zip(paths,names):require(git('show',head+':'+n)==p.read_bytes(),'Committed raw identity differs')
git('push','origin','audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Published writer differs')
print(json.dumps({'audit':head,'sourceReviewId':review['id'],'packageFiles':len(files),'futurePackageAllocationBytes':allowance,'rawOidShaVerifiedBlobs':len(paths),'remoteOperations':0}))
