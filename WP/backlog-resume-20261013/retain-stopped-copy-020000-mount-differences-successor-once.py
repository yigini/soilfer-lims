"""Closed original root/unit retention + read-only mount metadata. Never retry proof."""
import base64,datetime,json,pathlib,subprocess,sys
REPO=pathlib.Path(__file__).resolve().parents[2];SOURCE=REPO/'WP/batch-proof-cde8-20261015';DEST=SOURCE/'first-proof-020000-closed-mount-differences-successor';BASE='44ad17ce542f1bb0e96f4fa94ed2fc10b03febe9'
sys.path.insert(0,str(SOURCE))
from proof_contract import *
from prepare_proof import raw_git
def cmd(*a):return subprocess.check_output(a,cwd=REPO)
require(not DEST.exists() and cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip(),'Boundary consumed/writer changed')
require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE,'Remote audit moved');DEST.mkdir()
script='''import base64,datetime,hashlib,json,pathlib,stat,subprocess
root=pathlib.Path('/opt/lims/releases/workflow-batch-stopped-copy-cde8c889-20261015T020000Z');unit='lims-workflow-batch-stopped-copy-cde8c889-20261015t020000z'
state=subprocess.run(['systemctl','show',unit,'--property=LoadState,ActiveState,SubState,Result,ExecMainStatus,InvocationID,MemoryCurrent,MemoryPeak,MemoryMax,MemorySwapMax,RuntimeMaxUSec,ExecMainStartTimestamp,ExecMainExitTimestamp'],capture_output=True,text=True,timeout=15)
props=dict(l.split('=',1) for l in state.stdout.splitlines() if '=' in l)
assert props['ActiveState']=='failed' and props['ExecMainStatus']=='1' and props['InvocationID']=='565babf8c28d4c15b77a39d38f269dcb'
original=json.loads((root/'proof-terminal-refusal.json').read_bytes());assert original['error']=='RuntimeError: Descendant mount makes accounting incomplete' and original['closedUtc']=='2026-10-15T02:01:30.448385+00:00'
assert not (root/'fresh-production-snapshot').exists() and not (root/'installation-target').exists() and not (root/'fresh-actual-baseline.json').exists()
rows=[];total=0
for p in sorted(root.rglob('*')):
 assert not p.is_symlink()
 if p.is_file():
  a=p.stat();assert stat.S_IMODE(a.st_mode)==0o400 and a.st_size<=33554432
  raw=p.read_bytes();b=p.stat();assert (a.st_size,a.st_mtime_ns,a.st_mode,a.st_ino)==(b.st_size,b.st_mtime_ns,b.st_mode,b.st_ino)
  total+=len(raw);assert total<=67108864
  rows.append({'path':p.relative_to(root).as_posix(),'bytes':len(raw),'mode':stat.S_IMODE(b.st_mode),'sha256':hashlib.sha256(raw).hexdigest(),'data':base64.b64encode(raw).decode()})
assert len(rows)==22
spec=json.loads((root/'proof-input.json').read_bytes());sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert all(sha(root/n)==h for n,h in spec['packageHashes'].items())
journal=subprocess.run(['journalctl','-u',unit,'--no-pager','-o','json','-n','1000'],capture_output=True,text=True,timeout=15);assert journal.returncode==0
mountinfo=pathlib.Path('/proc/self/mountinfo').read_text();assert len(mountinfo.encode())<=2097152
descendants=[]
for line in mountinfo.splitlines():
 fields=line.split();separator=fields.index('-');mount=pathlib.PurePosixPath(fields[4])
 for top in ['/opt/lims/releases','/var/lib/docker','/var/lib/containerd']:
  if pathlib.PurePosixPath(top) in mount.parents:descendants.append({'root':top,'mountId':fields[0],'parentId':fields[1],'device':fields[2],'mountRoot':fields[3],'mountPoint':fields[4],'filesystem':fields[separator+1],'source':fields[separator+2],'options':fields[5],'superOptions':fields[separator+3],'rawLine':line})
# Selected derived normal predecessor metadata only; no full env persisted.
v=json.loads(subprocess.check_output(['docker','inspect','8109d78e228573ead8aa243442192e54b8e1dc09101bc3fa23d03e5a29cbb66b'],timeout=15))[0]
env=dict(s.split('=',1) for s in v['Config']['Env'] if '=' in s)
safe={'status':'SAFE_SELECTED_DERIVED_DOCKER_INSPECTION_NOT_FULL_RAW','id':v['Id'],'image':v['Image'],'revision':v['Config']['Labels'].get('org.opencontainers.image.revision'),'running':v['State']['Running'],'health':v['State']['Health']['Status'],'restarts':v['RestartCount'],'oom':v['State']['OOMKilled'],'memory':v['HostConfig']['Memory'],'swap':v['HostConfig']['MemorySwap'],'shmBytes':v['HostConfig']['ShmSize'],'flags':{k:env.get(k) for k in ['NODE_OPTIONS','ALLOW_PRISMA_DB_PUSH','ALLOW_AUTO_SEED','DISABLE_BACKGROUND_JOBS']},'mounts':v['Mounts']}
ids=subprocess.check_output(['docker','ps','-aq','--no-trunc'],timeout=15).decode().splitlines();before=json.loads((root/'container-inventory-before.json').read_bytes());assert set(before)<=set(ids)
changed=[];new_proof=[]
for id in ids:
 d=json.loads(subprocess.check_output(['docker','inspect',id],timeout=15))[0];labels=d['Config'].get('Labels') or {}
 if labels.get('io.soilfer.release-owned','').startswith(str(root)+':'):new_proof.append(id)
 if id in before:
  p=before[id]
  if p['name']!=d['Name'] or p['image']!=d['Image'] or p['labels']!=labels or p['mounts']!=d['Mounts'] or (not p['running'] and (d['State']['Running'] or p['startedAt']!=d['State']['StartedAt'])):changed.append(id)
assert not new_proof
differences=[]
for id in changed:
 d=json.loads(subprocess.check_output(['docker','inspect',id],timeout=15))[0]
 differences.append({'id':id,'before':before[id],'actual':{'name':d['Name'],'image':d['Image'],'labels':d['Config'].get('Labels') or {},'mounts':d['Mounts'],'running':d['State']['Running'],'startedAt':d['State']['StartedAt']}})
print(json.dumps({'status':'CLOSED_PREFLIGHT_REFUSAL_ALL_ORIGINALS_READONLY_RETAINED_NOT_REPLAYED','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'root':str(root),'unit':unit,'systemctlOriginal':state.stdout,'journalOriginal':journal.stdout,'mountinfoOriginal':mountinfo,'descendantMountMetadata':descendants,'normalPredecessorSelected':safe,'files':rows,'packageUnchanged':True,'productionCopies':0,'productionSqliteConnections':0,'installerAttempts':0,'defaultEntrypointAttempts':0,'newOwnedContainers':new_proof,'allHistoricalStoppedContainersPreserved':not changed,'containerComparisonDifferences':differences,'productionMutations':0,'neverReplay':True}))
'''
with (DEST/'readonly-closed-retainer-source.py').open('x',encoding='utf-8') as f:f.write(script)
r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],cwd=REPO,input=script.encode(),capture_output=True,timeout=55)
with (DEST/'stdout-original.json').open('xb') as f:f.write(r.stdout)
with (DEST/'stderr-original.log').open('xb') as f:f.write(r.stderr)
require(r.returncode==0,'Original closed retainer refused; preserve original output, never replay');record=exact_json(r.stdout)
for row in record['files']:
    rel=pathlib.PurePosixPath(row['path']);require(not rel.is_absolute() and '..' not in rel.parts,'Unsafe remote path');raw=base64.b64decode(row.pop('data'));require(len(raw)==row['bytes'] and sha(raw)==row['sha256'],'Original raw hash differs');p=DEST/'remote-originals'/str(rel);p.parent.mkdir(parents=True,exist_ok=True)
    with p.open('xb') as f:f.write(raw)
with (DEST/'closed-retention-record.json').open('xb') as f:f.write(canonical(record)+b'\n')
lead='''## 2026-10-15 ONE approved020000 proof CLOSED PREFLIGHT REFUSAL — no production file copy or installer

Actual6aSourcePASS6182570134/one17filepackage/oneunitlaunch ran02:01:26–02:01:30UTC, invocation565babf8c28d4c15b77a39d38f269dcb. Originalterminal02:01:30.448385UTC FAILED_OR_REFUSED_RETAIN_ALL_FORWARD_FIX_ONLY/RuntimeError Descendant mount makes accounting incomplete, controllerexit1/failed. 22immutable originals/packagehashunchanged/actualjournal/systemctllimits+sentinelpeak/mountinfo/currentSAFESELECTEDnormalprod metadata/historicalcontainerpreservation retained at WP/batch-proof-cde8-20261015/first-proof-020000-closed-preflight-refusal/index.json. Actualfailure BEFOREdu/productionfileopen/copy/SQLite/count/installer/defaultentrypoint/newcontainer. ALLcounts/scientificlistsUNKNOWN. Oldsource87unexecuted;6a operator020000 isCONSUMEDneverreplay/retry/rootcleanup. Original805MemoryMax/Swap0/Runtime90m verified; MemoryPeak18446744073709551615 isUNAVAILABLEsentinel, notmeasuredpeak. Production959d7a8109 stillhealthy0restartsnoOOM/jobsON/flagslimitsvolumesunchanged, containercomparison differences retained for independent inspection, not yet claimed preserved. Firstreadonlyretainer refused that comparison before stdout/commit; originalhelper/output preserved. NeedreadACTUALdescendantmountmetadata and prepare genuinelyNEW completeaccounting correction with explicitmount/filesystem handling/meaningfulguards/actualClSourcePASS/newroot before any collection/proof. No weaken/ignore mounts/no originalrootmutation/remount/prune/cleanup/restore/oldimage/heap/corechanges. JobsON/broaderpostflight/exactkitfreshgate stillrequired. AllstandingSciencepolicycanonical/YYlistsapprovedSTOP/snapalloc/reservefloor500MBmemoryreadinesspins/forwardonly/human103/history hold.

'''
readme=REPO/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
paths=sorted(p for p in DEST.rglob('*') if p.is_file())+sorted(p for p in (SOURCE/'first-proof-020000-closed-preflight-refusal').rglob('*') if p.is_file())+sorted(p for d in ['first-proof-020000-launch-wrapper-once','proof-launch-'+ROOT_NAME,'first-proof-020000-first-observation-once'] for p in (SOURCE/d).rglob('*') if p.is_file())+[REPO/'WP/backlog-resume-20261013/execute-reviewed-stopped-copy-launch-once.py',REPO/'WP/backlog-resume-20261013/observe-stopped-copy-020000-first-boundary-readonly-once.py',pathlib.Path(__file__),REPO/'WP/backlog-resume-20261013/retain-stopped-copy-020000-preflight-refusal-once.py',readme]
out=DEST/'index.json';require(not out.exists(),'Retainer consumed')
with out.open('xb') as f:f.write(canonical({'status':record['status'],'sourceCommit':'6a235c68ecf3a8ef8c405d49ff4d3f41bedabe38','sourcePass':6182570134,'actualProofFailure':True,'terminalUtc':'2026-10-15T02:01:30.448385+00:00','invocationId':'565babf8c28d4c15b77a39d38f269dcb','productionCopies':0,'productionSqliteConnections':0,'installerAttempts':0,'defaultEntrypointAttempts':0,'newOwnedContainers':0,'containerComparisonDifferences':record['containerComparisonDifferences'],'descendantMountMetadata':record['descendantMountMetadata'],'files':[{'path':p.relative_to(REPO).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]})+b'\n')
paths.append(out);rels=[p.relative_to(REPO).as_posix() for p in paths];require(len(rels)==len(set(rels)),'Duplicate owner')
for start in range(0,len(rels),15):cmd('git','-c','core.autocrlf=false','add','-f','--',*rels[start:start+15])
require(set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(rels),'Unowned stage');tree=cmd('git','write-tree').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(tree,rel)[0]==p.read_bytes(),'Staged raw differs')
cmd('git','commit','-m','Retain actual closed stopped-copy proof preflight refusal before any production snapshot');head=cmd('git','rev-parse','HEAD').decode().strip()
for p,rel in zip(paths,rels):require(raw_git(head,rel)[0]==p.read_bytes(),'Committed raw differs')
cmd('git','push','origin','audit/release-eb6de2e8');require(cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Remote differs')
print(json.dumps({'status':'CLOSED_PREFLIGHT_REFUSAL_RAW_EVIDENCE_PUSHED','head':head,'verifiedOwnedBlobs':len(paths),'productionCopies':0,'installerAttempts':0,'newContainers':0,'descendantMountMetadata':record['descendantMountMetadata'],'containerComparisonDifferences':record['containerComparisonDifferences']}))
