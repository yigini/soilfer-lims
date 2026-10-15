"""Publish complete prospective source and closed guard evidence; no build operator."""
import datetime,hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-build-stable-accounting-be837974-20261015'
BASE='23e8dad8d6442321586b7d0bf4920c48a8681054'
def run(*a):return subprocess.check_output(a,cwd=R)
def git(*a):return run('git','-c','core.longpaths=true',*a)
def oid(v):return hashlib.sha1(('blob '+str(len(v))+'\0').encode()+v).hexdigest()
assert git('rev-parse','HEAD').decode().strip()==BASE and not git('diff','--cached','--name-only').strip() and not (S/'source-publication-index.json').exists()
assert git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8'
sys.path.insert(0,str(S));from batch_build_contract import *
from prepare_batch_build import current_evidence
closed=json_exact((S/'source-local-host-verification39-once/exit-original.json').read_bytes())
require(closed['status']=='PASS_NEW_BUILD_SOURCE_GUARDS_NOT_EXECUTION' and closed['localGuardTests']==closed['actualHostGuardTests']==39 and closed['sourceUnchanged'],'Final39 closed proof missing')
for n,d in closed['sourceSha256After'].items():require(sha((S/n).read_bytes())==d,'Source changed after closed39')
current=current_evidence()
E=S/'fresh-source-authorities-publication-once';require(not E.exists(),'Evidence publication already consumed');E.mkdir()
for n,v in current.items():
 with (E/n).open('xb') as f:f.write(v)
history=run('gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/162/comments?per_page=100')
with (E/'coordination-full-history-original.json').open('xb') as f:f.write(history)
frozen=json_exact((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());require(len(frozen)==1333,'Frozen inventory differs')
for p,d in frozen.items():require(sha((R/p).read_bytes())==d,'Frozen application input changed '+p)
def js(p,v):
 with p.open('x',encoding='utf-8') as f:json.dump(v,f,indent=2,ensure_ascii=False)
js(E/'frozen-source-and-preparation-derived.json',{'observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'all1333ApplicationInputsUnchanged':True,'actualLocalAndHost39ClosedUtc':closed['closedUtc'],'actualHostPython':closed['host']['pythonVersion'],'operatorExecutions':0,'hostSourceFilesWritten':0,'initial38BothPassedSnapshotRetained':True,'finalChangesAfterClosed38':'Per-attempt acceptance remains false until rows validate; explicit failed180000-root refusal guard. Final39 local+actualhost source unchanged.','toolPreparationRefusal':'Inline PowerShell/Python quoting produced SyntaxError before final39 helper file creation; attempted nonexistent file exited2 before any tests or host operation. New uniquely named closed-source successor generated successfully and ran39 local+host once. Original tool outputs retained in conversation.','failed180000RemainsExcluded':True,'noR2PruneOnFailedQualification':True})
text='''# Prospective build accounting correction — SOURCE REVIEW REQUIRED

This complete five-file graph is for a NEW build-only qualification of main be8379745bdfae52ce46496ff26514dc7d729640 / tree676b01e71211786d1aeace50f19a0b2c9f9c482e. It is unapproved and unexecuted. Proposed new root `/opt/lims/releases/workflow-batch-build-be837974-20261015T190000Z`; no operational package, remote root, unit or build has been created. Actual unused-root/unit checks and fresh computed R4 gates remain mandatory after an exact-source PASS.

The preceding180000 run is CLOSED FAILED at18:36:16.098416UTC, same invocation8a78764a88a44f1b9c5dc577a2f4b8de. Docker exit0/303.47692349902354s did not qualify it: required after-du exit1 reported missing `/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/12671`. Removing process is UNKNOWN; background GC is not proved. Partial printed totals receive ZERO credit. No after allocation accepted, no successful receipt or original image-inspect file generated. Candidate a61e5c84045e7116c0d1a01627e4d80cbaf76e4990223a37cd4fb009bf296294 remains FORENSIC/UNQUALIFIED; ID file original0600. Unit exit1/Result exit-code/peak374972416/MemoryMax805306368/Swap0/45min. Full48raw original evidence published23e8dad8d6442321586b7d0bf4920c48a8681054. This new graph pins that exact failure SHA and preserves its failed status. Never rerun any old helper, root, unit or measurement or adopt that failed run.

Prospective correction: before-measurement remains ONE attempt. The post-build whole-store measurement has at most TWO complete attempts, each120seconds/64KiB output. An additional attempt is permitted ONLY after first-after exit1 whose entire bounded stderr consists solely of exact ENOENT numeric snapshot-DIRECTORY diagnostics under the verified default containerd snapshot parent. Fresh parent realpath/nonalias/device/missing-path checks, unchanged full selected storage topology and mount guards are mandatory. Unknown paths, nested files, permission/transport/timeout/malformed/duplicate errors, replacement/alias, topology changes or any second failure STOP. A bounded2second pause precedes the additional measurement. BOTH raw outputs/intents/results are retained0400. Partial totals are NEVER merged/credited; only one complete exit0, empty-stderr, exact-integer/full-inventory successful measurement can supply final physical rows. No operator is replayed in180000.

All original floor10556150894+4GiB buildreserve+ADDITIONAL10000000000B R4 phase gates, 500000000 unexplained-growth STOP, disjoint owned-root+Docker+requiredcontainerd accounting, build1800/unit2700/controller805306368Swap0/blankheap, current mainCI38772398721/allFOUR app audits/rule authority pins remain. 120seconds before plus at most240seconds after measurement stays within the2700second unit. Builder prunes NOTHING; R2 separate bounded-source/itemreceipt applies only after an actually qualified new build. No DB connection/mount/volume, proof, cleanup, kit, gate, deployment or production settings change. All scientific/refusal/report/hash/copy/race/600/805/forwardonly/no103/history/human-draft protections hold.

Final CLOSED39/39 local +39/39 ACTUAL host Python3.9.23 pure guards, all5compile/hashunchanged at18:43:18.864767UTC. Earlier38/38 both snapshot remains retained. New guards execute the ACTUAL allocated function against closed fake interfaces: complete first pass; exact missing directory then complete second success with partial999999 totals excluded; two missing attempts STOP; timeout/permission no additional attempt; replacement/topology change STOP; exit0 diagnostics/incomplete rows STOP; old180000 root refusal. Existing28 authority/archive/R4/rule/fallback guards remain. Host execution was in memory with ZERO remote source files, real du/Docker/operator calls or production connections.

Source-publication-index.json carries raw SHA256/length/Git-OID bindings for source, before bytes, both closed guard sets, current authorities and preparer/publisher. No exact-source PASS is inferred from these tests.
'''
with (S/'README.md').open('x',encoding='utf-8') as f:f.write(text)
lead='''## 2026-10-15 build180000 FAILED retained; NEW complete stable-accounting source39 ready for review

Full48raw closed180000 originals published23e8dad8; Dockerexit0/303.476923499s but after-du exit1 missing numeric snapshot12671; process causing disappearance UNKNOWN. Partial totals unaccepted/no successful build receipt/image qualification/R2 prune. Root/unit/imagea61/helpers consumed and excluded; never replay/adopt. NEW complete5file source at WP/batch-build-stable-accounting-be837974-20261015/README.md proposes NEW190000root, no package/root/unit/operator executed. ONLY first-after exact bounded numeric snapshot-directory ENOENT permits one additional whole measurement after fresh metadata/topology/mount checks; BOTH attempts retained, partial totals never credited, every other/second failure STOP. Original R4computed+10GB/floor4GiB500MB/build1800/unit2700/805Swap0 and all app/rule/science/history guards held. Final39local+39actualhost3.9.23 pure guards/all5compile/hashunchanged CLOSED18:43:18.864767UTC; earlier38 snapshot retained. CurrentmainCI/all4audits/rulepins/all1333apphashes reverified. NEW exact allhash/literal ClSourcePASS required BEFORE any operational package/upload/build. Full publication at newfolder/source-publication-index.json. No cleanup/proof/kit/gate/deploy/prodDB; human draft669 preserved.

'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
paths=sorted(p for p in S.rglob('*') if p.is_file())+[R/'WP/backlog-resume-20261013/prepare-startup-stable-accounting-source-only-once.py',R/'WP/backlog-resume-20261013/verify-startup-stable-accounting38-local-host-once.py',R/'WP/backlog-resume-20261013/verify-startup-stable-accounting39-closed-source-successor-once.py',pathlib.Path(__file__),*readmes]
idx=S/'source-publication-index.json';js(idx,{'baseAudit':BASE,'status':'COMPLETE_NEW_PROSPECTIVE_BUILD_SOURCE39_NOT_APPROVED_OR_EXECUTED','currentSourceSha256':closed['sourceSha256After'],'closedLocalAndHostGuards':39,'files':[{'path':p.relative_to(R).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]})
paths.append(idx);names=[p.relative_to(R).as_posix() for p in paths];require(len(names)==len(set(names)),'Duplicate owned path')
for i in range(0,len(names),15):git('-c','core.autocrlf=false','add','-f','--',*names[i:i+15])
require(set(git('diff','--cached','--name-only').decode().splitlines())==set(names),'Staged owner differs')
tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):require(git('show',tree+':'+n)==p.read_bytes() and git('rev-parse',tree+':'+n).decode().strip()==oid(p.read_bytes()),'Raw staged bytes differ')
git('commit','-m','Prepare separately reviewed complete build source with bounded whole post-build accounting')
head=git('rev-parse','HEAD').decode().strip()
for p,n in zip(paths,names):require(git('show',head+':'+n)==p.read_bytes(),'Raw committed bytes differ')
git('push','origin','audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Pushed audit differs')
print(json.dumps({'audit':head,'rawOidShaVerifiedBlobs':len(paths),'currentSourceSha256':closed['sourceSha256After'],'localAndActualHostGuards':39,'newSourceOperatorsExecuted':0,'all1333ApplicationInputsUnchanged':True}))
