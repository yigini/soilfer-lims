"""One new exact-source review request bundling closed180000 failure; never launch."""
import datetime,hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-build-stable-accounting-be837974-20261015'
TOOLING='4de3e334d8e498783a4cf20df4a5f93acfdbeb21';D=S/'exact-source-review-request-4de3e334-once';MARK='startup-stable-accounting-4de3e334-closed180000'
def run(*a):return subprocess.check_output(a,cwd=R)
def git(*a):return run('git','-c','core.longpaths=true',*a)
def oid(v):return hashlib.sha1(('blob '+str(len(v))+'\0').encode()+v).hexdigest()
assert not D.exists() and git('rev-parse','HEAD').decode().strip()==TOOLING and not git('diff','--cached','--name-only').strip()
assert git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8'
sys.path.insert(0,str(S));from batch_build_contract import *
from prepare_batch_build import raw_git,current_evidence
index={'head':TOOLING,'files':{}}
for n in sorted(SOURCE_FILES):
 v,index['files'][n]=raw_git(TOOLING,'WP/batch-build-stable-accounting-be837974-20261015/'+n);require(v==(S/n).read_bytes(),'Working reviewed source changed')
pub=json_exact(git('show',TOOLING+':WP/batch-build-stable-accounting-be837974-20261015/source-publication-index.json'))
for b in pub['files']:
 v=git('show',TOOLING+':'+b['path']);require(len(v)==b['length'] and sha(v)==b['sha256'] and oid(v)==b['gitBlobOid'],'Published source evidence changed')
closed=json_exact((S/'source-local-host-verification39-once/exit-original.json').read_bytes());require(closed['localGuardTests']==closed['actualHostGuardTests']==39 and closed['sourceUnchanged'],'Final39 proof missing')
current=current_evidence();history=run('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100');comments=[v for p in json_exact(history) for v in p]
require(not any(MARK in v.get('body','') for v in comments),'Request already exists; never duplicate')
prior=raw_git('23e8dad8d6442321586b7d0bf4920c48a8681054','WP/batch-build-startup-be837974-20261015/first-build-180000-closed-originals-once/build-terminal-failure.json')[0]
validate_prior_startup_failure(json_exact(prior));require(sha(prior)==REFERENCE_FILES['startup-180000-build-failure.json']['sha256'],'Prior failure pin differs')
tokens=review_tokens(TOOLING,index)
body='''@claude Please review the COMPLETE NEW five-file prospective build-only graph below. This single handoff also reports the CLOSED failure of the preceding approved180000 build and acknowledges actual build SourcePASS6199128746. That old approval/root/unit is consumed and authorizes no further operation.

**Actual180000 result: FAILED / image UNQUALIFIED.** Exact2c0cebca/PASS6199128746/one31file package/oneunitinvocation8a78764a88a44f1b9c5dc577a2f4b8de launched18:29:57UTC and closed18:36:16.098416UTC. Docker exit0 after303.47692349902354s, but required after-du exited1:
```
du: cannot access '/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/12671': No such file or directory
```
The process causing disappearance is UNKNOWN; background GC is not independently established. Printed partial rows are unaccepted and receive ZERO growth credit. Outer unit exit1/Resultexit-code; peak374972416/MemoryMax805306368/Swap0/Runtime45min. Full original terminal/logs/stdout/stderr/journals/systemctl/package hash verification/all1567extracted raw-Git bytes+modes retained in48raw verified blobs at commit23e8dad8d6442321586b7d0bf4920c48a8681054, directory WP/batch-build-startup-be837974-20261015/first-build-180000-closed-originals-once/publication-index.json. No successful receipt or original image-inspect file exists. Candidate sha256:a61e5c84045e7116c0d1a01627e4d80cbaf76e4990223a37cd4fb009bf296294 is FORENSIC/UNQUALIFIED, not a new release candidate. Original candidate-ID mode0600 and terminal0400 retained. No retry, image adoption, cleanup or R2 prune occurred.

All R4 gates actually passed before that failure: before-root18:29:09.028565UTC required24979478638/free32152936448; before-unit18:29:56.447809UTC required24935798894/free32111202304; before-build18:30:24.982112UTC required24851118190/free32044945408. All3paths same filesystem, never additive. Closed free28620238848 is observation ONLY, not authority for another run.

**NEW concrete source for review:** commit TOOLING_VALUE, directory WP/batch-build-stable-accounting-be837974-20261015. README.md and source-publication-index.json contain64 raw-OID/SHA-verified owned bindings. Final CLOSED39local+39ACTUALhostPython3.9.23 pure guards/all5compile/hashunchanged at18:43:18.864767UTC; earlier closed38both snapshot retained. All1333application inputs unchanged/currentmainbe837974/mainCI38772398721/allFOUR actual app audits/merges/rule pins freshly reverified. No app/client/Dockerfile/Compose/CI changes.

Please explicitly review this prospective correction rather than infer authority from the old PASS: before-du remains one120second attempt. Only FIRST post-build du exit1 with complete stderr consisting solely of exact numeric snapshot-DIRECTORY ENOENT under verified default containerd parent permits ONE additional COMPLETE whole measurement, maximum2postattempts/120seconds each/64KiB each. Fresh parent realpath/nonalias/device/missing-path checks plus unchanged selected full storage topology/mount guards are mandatory. Both raw attempts/intents/results retained0400, partial totals NEVER merged/credited. Timeout, permission, malformed/duplicate/foreign/nested-file paths, replaced/alias paths, topology changes, any second failure or an incomplete/noisy exit0 STOP. Successful exact complete integer inventory alone supplies accepted rows. Bounded2second pause; no operation or measurement of failed180000 is replayed. Full actual allocated function is exercised via closed fake interfaces in the guard suite; actual host tests wrote0sourcefiles and executed0real du/Docker/operators/production connections.

Proposed genuinelyNEW exact root /opt/lims/releases/workflow-batch-build-be837974-20261015T190000Z is UNCREATED by this graph: no operational package/upload/unit/build. Fresh unused-root/unit checks plus computed R4 floor10556150894+4GiBbuildreserve+ADDITIONAL10000000000B before-root/unit/build remain mandatory after a NEW exact all-hash/literal Source review: PASS. New qualification must have its own build invocation/accounting/receipt; it cannot adopt/reclassify180000 or credit old partial measurements. Normal Docker cache possibly yielding the same image ID is not authority to reuse the failed receipt. Build1800/unit2700/controller805306368Swap0/blankheap/500MBunexplainedgrowth STOP and all original rules/science/refusal/report/hash/copy/race/600/forwardonly/no103/history protections stay.

Builder prunes NOTHING. R2 actualmax-used-space5GB/shared+inuse protection remains a separate bounded-source/item-receipt obligation after an actually qualified new build. R1 amendment6198899941 does not authorize this build or old helper replay. No proof/cleanup/kit/gate/deploy/productionDB/settings operation. Please post an actual exact-source PASS or specific findings/conditions for ALL five hashes and ALL literal bindings below. Human native composer draft is preserved; no duplicate native message has been sent for this new request.

Bindings:
```
TOKENS_VALUE
```

<!-- MARK_VALUE -->
'''.replace('TOOLING_VALUE',TOOLING).replace('TOKENS_VALUE','\n'.join(tokens)).replace('MARK_VALUE',MARK)
D.mkdir()
def save(n,v):
 with (D/n).open('xb') as f:f.write(v)
def js(n,v):save(n,(json.dumps(v,indent=2,ensure_ascii=False)+'\n').encode())
save('request-body-original.md',body.encode());js('request-input-original.json',{'body':body});js('source-index-original.json',index)
save('coordination-history-before-original.json',history)
for n,v in current.items():save(n,v)
js('post-intent-once.json',{'createdUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'toolingCommit':TOOLING,'marker':MARK,'neverReplay':True,'operationsBuildProofCleanupProduction':0})
response=subprocess.run(['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/162/comments','--input',str(D/'request-input-original.json')],cwd=R,capture_output=True)
save('post-response-original.json',response.stdout);save('post-stderr-original.log',response.stderr)
require(response.returncode==0,'Unknown review-request outcome; inspect GitHub, never replay')
posted=json_exact(response.stdout);require(posted['body']==body and type(posted['id']) is int and posted['id']>6199128746,'Actual posted request differs')
live=run('gh','api','repos/yigini/soilfer-lims/issues/comments/'+str(posted['id']));require(json_exact(live)['body']==body,'Fresh actual request differs');save('actual-posted-request-original.json',live)
after=run('gh','api','repos/yigini/soilfer-lims/issues/162/comments?since='+posted['created_at']+'&per_page=100');save('coordination-after-request-original.json',after)
record={'status':'ONE_EXACT_NEW_STABLE_ACCOUNTING_SOURCE_REVIEW_REQUEST_POSTED','toolingCommit':TOOLING,'sourceReviewRequestId':posted['id'],'requestUrl':posted['html_url'],'requestCreatedUtc':posted['created_at'],'allFiveShaAndLiteralBindings':tokens,'all64PublishedSourceBindingsVerified':True,'actualNewSourcePassClaimed':False,'prior180000FailureRemainsFailed':True,'newPackageRootUnitBuildUncreated':True,'nativeNewHandoffSent':False,'humanNativeDraftPreserved':True,'newBuildProofCleanupProductionOperations':0}
js('delivery-record.json',record)
lead=f'''## 2026-10-15 ONE new build accounting source review{posted['id']} requested; PASS pending

NEW complete5file source4de3e334/39local+39ACTUALhost3.9.23/allhashes verified, full request{posted['id']} at{posted['created_at']} {posted['html_url']}. Bundles actual619912PASSack+180000CLOSEDFAILED23e8dad8 evidence ONCE: Dockerexit0/303.4769s but post-du missing snapshot12671/exit1, no after-allocation accepted/no successreceipt/a61imageunqualified; no retry/adoption/cleanup. Request explicitly asks review of ONLY one prospective additional complete postmeasurement after exact first-ENOENT/missing-directory+topology guards; every other/second error STOP; all partial raws retained/never credited. Full5SHA+ALLliteral bindings/new190000root/R4computed+10GB/pins/science/history at WP/batch-build-stable-accounting-be837974-20261015/exact-source-review-request-4de3e334-once/publication-index.json. Newsource PASS NOT inferred; no new operational package/root/unit/build until actualNEWexactPASS+freshcurrentguards/capacity/unusedrootunit. R2after-success separate bounded-source/itemreceipt remains; builderprunesnothing. New nativehandoff UNSENT, human rightdraft669 previously observed/preserved; no duplicateGH/request/ACK. All science/refusal/report/hash/copy/race/600/805/forwardonly/no103/humans/history held.

'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
paths=sorted(p for p in D.iterdir() if p.is_file())+[pathlib.Path(__file__),*readmes]
idx=D/'publication-index.json';js('publication-index.json',{'baseAudit':TOOLING,'sourceReviewRequestId':posted['id'],'toolingCommit':TOOLING,'files':[{'path':p.relative_to(R).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]})
paths.append(idx);names=[p.relative_to(R).as_posix() for p in paths]
for i in range(0,len(names),15):git('-c','core.autocrlf=false','add','-f','--',*names[i:i+15])
require(set(git('diff','--cached','--name-only').decode().splitlines())==set(names),'Staged owner differs')
tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):require(git('show',tree+':'+n)==p.read_bytes() and git('rev-parse',tree+':'+n).decode().strip()==oid(p.read_bytes()),'Staged raw bytes differ')
git('commit','-m','Request exact review of new stable-accounting build source with closed180000 failure')
head=git('rev-parse','HEAD').decode().strip()
for p,n in zip(paths,names):require(git('show',head+':'+n)==p.read_bytes(),'Committed raw bytes differ')
git('push','origin','audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Pushed audit differs')
print(json.dumps({'audit':head,'requestId':posted['id'],'requestUrl':posted['html_url'],'requestCreatedUtc':posted['created_at'],'rawOidShaVerifiedBlobs':len(paths),'actualNewSourcePassClaimed':False,'nativeNewHandoffSent':False,'newBuildsProofsCleanupProductionOperations':0}))
