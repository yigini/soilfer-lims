"""Publish honest active opening and both fresh launcher capacity gates; no host operation."""
import hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-build-stable-accounting-be837974-20261015'
D=S/'first-build-190000-opening-publication-once';P=S/'build-package-workflow-batch-build-be837974-20261015T190000Z';L=S/(P.name+'-launch');O=S/'first-build-190000-opening-observation-once'
def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R)
def oid(v):return hashlib.sha1(('blob '+str(len(v))+'\0').encode()+v).hexdigest()
assert not D.exists() and git('rev-parse','HEAD').decode().strip()=='c8839c1c4f597a0c145cc06ec26537d7173bb7c7' and not git('diff','--cached','--name-only').strip()
sys.path.insert(0,str(S));from batch_build_contract import *
load=lambda p:json_exact(p.read_bytes())
launch=load(L/'launch-record.json');observation=load(O/'stdout-original.json');spec=load(P/'build-input.json')
require(launch['sourceReviewId']==6200145007 and launch['toolingCommit']=='4de3e334d8e498783a4cf20df4a5f93acfdbeb21','Actual approved launch differs')
require(observation['closed'] is False and observation['terminalRecords']=={} and observation['properties']['InvocationID']=='54ec282a37d34dd3997c3274c5587abf','Actual opening differs')
require(observation['properties']['MemoryMax']==str(MEMORY) and observation['properties']['MemorySwapMax']=='0' and observation['properties']['RuntimeMaxUSec']=='45min','Actual active unit limits differ')
gates={}
for phase in ['before-root','before-unit']:
 v=load(L/('capacity-'+phase+'-original.stdout'));validate_capacity_observation(spec['capacityPlan'],phase,v['paths']);require(v['requiredFreeBytes']==capacity_requirement(spec['capacityPlan'],phase),'Gate formula differs');gates[phase]=v
require({n:sha((P/n).read_bytes()) for n in REQUIRED_ARTIFACTS}==launch['packageFileHashes'],'Uploaded package binding differs')
frozen=json_exact((R/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes());require(len(frozen)==1333,'Frozen inventory differs')
for p,d in frozen.items():require(sha((R/p).read_bytes())==d,'Frozen application changed '+p)
index=load(P/'tooling-source-index.json')
for n,v in index['files'].items():require(sha((S/n).read_bytes())==v['sha256'],'Frozen tooling changed '+n)
D.mkdir();record={'status':'ACTUAL_STARTUP_BUILD190000_ACTIVE_ACCOUNTING_PREFLIGHT_AT_OPENING','observedUtc':observation['observedUtc'],'actualInvocationId':observation['properties']['InvocationID'],'actualActiveUnitLimits':{k:observation['properties'][k] for k in ['MemoryMax','MemorySwapMax','RuntimeMaxUSec']},'toolingCommit':launch['toolingCommit'],'sourceReviewId':6200145007,'root':launch['root'],'unit':launch['unit'],'freshLauncherCapacityGates':gates,'buildEnteredAtOpening':False,'terminalResultAtOpening':None,'activeResultSuccessAndExit0AreNotClosedSuccess':True,'buildRootUnitLaunchConsumedNeverReplay':True,'proofs':0,'cleanup':0,'productionOperations':0}
with (D/'opening-record.json').open('x',encoding='utf-8') as f:json.dump(record,f,indent=2)
lead=f'''## 2026-10-15 NEW approved stable-accounting build190000 launched ONCE; actual OPEN

Source4de3e334/actualPASS6200145007/ONE32file raw-Git package publishedc8839c1c. ONE new190000root/unit launched19:18:30UTC (21:18:30CEST); invocation54ec282a37d34dd3997c3274c5587abf actual ACTIVE/running at{observation['observedUtc']}, MemoryMax805306368/Swap0/Runtime45min. First observation preflight/36topfiles/no build-intent/log/terminal yet; active Resultsuccess/ExecMainStatus0 NOT closed success. Fresh R4 before-root required{gates['before-root']['requiredFreeBytes']}/free{min(r['freeBytes'] for r in gates['before-root']['paths'].values())} at{gates['before-root']['observedUtc']}; immediately before-unit required{gates['before-unit']['requiredFreeBytes']}/free{min(r['freeBytes'] for r in gates['before-unit']['paths'].values())} at{gates['before-unit']['observedUtc']}; all3nonalias paths sameFS/not additive/includes ADDITIONAL10GB. Controller must still pass exact before-du/extraction/before-build R4 and complete postmeasurement qualification. Full launch/opening originals at WP/batch-build-stable-accounting-be837974-20261015/first-build-190000-opening-publication-once/publication-index.json. Sameunit ONLY/sourcefrozen/package/root/unit/helpers consumed NEVERretry/rebuild/retag/replay/cleanup. Failed180000/a61remains excluded/unqualified and unmeasured. No cleanup/proof/kit/gate/deploy/productionDB; R2 separate bounded-source/itemreceipt afterqualified build still required. All science/history/human drafts/cards preserved.

'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
paths=[D/'opening-record.json']+[p for folder in [L,O,S/'reviewed-launch-execution-6200145007-once'] for p in sorted(folder.iterdir()) if p.is_file()]+[R/'WP/backlog-resume-20261013/observe-stable-accounting-build190000-first-readonly-once.py',pathlib.Path(__file__),*readmes]
idx=D/'publication-index.json'
with idx.open('x',encoding='utf-8') as f:json.dump({'validation':record,'files':[{'path':p.relative_to(R).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]},f,indent=2)
paths.append(idx);names=[p.relative_to(R).as_posix() for p in paths];require(len(names)==len(set(names)),'Duplicate owned path')
for i in range(0,len(names),15):git('-c','core.autocrlf=false','add','-f','--',*names[i:i+15])
require(set(git('diff','--cached','--name-only').decode().splitlines())==set(names),'Staged owner differs')
tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):require(git('show',tree+':'+n)==p.read_bytes() and git('rev-parse',tree+':'+n).decode().strip()==oid(p.read_bytes()),'Staged raw bytes differ')
git('commit','-m','Retain single startup build190000 launch and honest active opening')
head=git('rev-parse','HEAD').decode().strip()
for p,n in zip(paths,names):require(git('show',head+':'+n)==p.read_bytes(),'Committed bytes differ')
git('push','origin','audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Pushed audit differs')
print(json.dumps({'audit':head,'rawOidShaVerifiedBlobs':len(paths),'openingObservedUtc':observation['observedUtc'],'actualInvocation':record['actualInvocationId'],'terminalResultAtOpening':None,'beforeUnitCapacity':gates['before-unit']}))
