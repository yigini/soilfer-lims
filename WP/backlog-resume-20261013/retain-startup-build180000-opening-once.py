"""Publish honest active opening and both fresh launcher capacity gates; no host operation."""
import hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-build-startup-be837974-20261015'
D=S/'first-build-180000-opening-publication-once';P=S/'build-package-workflow-batch-build-be837974-20261015T180000Z';L=S/(P.name+'-launch');O=S/'first-build-180000-opening-observation-once'
def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R)
def oid(v):return hashlib.sha1(('blob '+str(len(v))+'\0').encode()+v).hexdigest()
assert not D.exists() and git('rev-parse','HEAD').decode().strip()=='508e36412f64939ade27283d30c6e8ac5d31d93c' and not git('diff','--cached','--name-only').strip()
sys.path.insert(0,str(S));from batch_build_contract import *
load=lambda p:json_exact(p.read_bytes())
launch=load(L/'launch-record.json');observation=load(O/'stdout-original.json');spec=load(P/'build-input.json')
require(launch['sourceReviewId']==6199128746 and launch['toolingCommit']=='2c0cebca0e9e191d2062c2f43756aa1d46e98c85','Actual approved launch differs')
require(observation['closed'] is False and observation['terminalRecords']=={} and observation['properties']['InvocationID']=='8a78764a88a44f1b9c5dc577a2f4b8de','Actual opening differs')
require(observation['properties']['MemoryMax']==str(MEMORY) and observation['properties']['MemorySwapMax']=='0' and observation['properties']['RuntimeMaxUSec']=='45min','Actual active unit limits differ')
gates={}
for phase in ['before-root','before-unit']:
 v=load(L/('capacity-'+phase+'-original.stdout'));validate_capacity_observation(spec['capacityPlan'],phase,v['paths']);require(v['requiredFreeBytes']==capacity_requirement(spec['capacityPlan'],phase),'Gate formula differs');gates[phase]=v
require({n:sha((P/n).read_bytes()) for n in REQUIRED_ARTIFACTS}==launch['packageFileHashes'],'Uploaded package binding differs')
D.mkdir();record={'status':'ACTUAL_STARTUP_BUILD180000_ACTIVE_ACCOUNTING_PREFLIGHT_AT_OPENING','observedUtc':observation['observedUtc'],'actualInvocationId':observation['properties']['InvocationID'],'actualActiveUnitLimits':{k:observation['properties'][k] for k in ['MemoryMax','MemorySwapMax','RuntimeMaxUSec']},'toolingCommit':launch['toolingCommit'],'sourceReviewId':6199128746,'root':launch['root'],'unit':launch['unit'],'freshLauncherCapacityGates':gates,'buildEnteredAtOpening':False,'terminalResultAtOpening':None,'activeResultSuccessAndExit0AreNotClosedSuccess':True,'buildRootUnitLaunchConsumedNeverReplay':True,'proofs':0,'cleanup':0,'productionOperations':0}
with (D/'opening-record.json').open('x',encoding='utf-8') as f:json.dump(record,f,indent=2)
lead=f'''## 2026-10-15 NEW approved build180000 launched ONCE; actual OPEN18:30:17UTC

Source2c0cebca/actualPASS6199128746/one31file raw-Git package published508e3641. ONE exact180000 root/unit launched18:29:57CEST-convertedUTC(20:29:57CEST); actualinvocation8a78764a88a44f1b9c5dc577a2f4b8de ACTIVE/running18:30:17.322327UTC, MemoryMax805306368/Swap0/Runtime45min. Observed33topfiles/accountingpreflight, no build-intent/log/terminal yet; active Resultsuccess/ExecMainStatus0 NOT final success. Fresh R4 before-root required24979478638/free32152936448 at18:29:09.028565UTC; before-unit required{gates['before-unit']['requiredFreeBytes']}/free{min(r['freeBytes'] for r in gates['before-unit']['paths'].values())} at{gates['before-unit']['observedUtc']}; all3nonalias paths sameFS/not additive. Controller still must pass accounting/extraction/before-build R4. Exact launch/opening originals at WP/batch-build-startup-be837974-20261015/first-build-180000-opening-publication-once/publication-index.json. Sameunit ONLY; preparer/launcher/root/unit consumed NEVERretry/replay/cleanup. Source frozen while active. No proof/cleanup/kit/gate/deploy/productionDBoperation; R2 separate source/itemreceipt after success still required. All science/history/human draft669 protected.

'''
readmes=[R/'WP/audit-release-eb6de2e8/README.md',R/'WP/runtime-recovery-kobo/README.md']
for p in readmes:p.write_bytes(lead.encode()+p.read_bytes())
paths=[D/'opening-record.json']+[p for folder in [L,O,S/'reviewed-launch-execution-6199128746-once'] for p in sorted(folder.iterdir()) if p.is_file()]+[R/'WP/backlog-resume-20261013/observe-startup-build180000-first-readonly-once.py',pathlib.Path(__file__),*readmes]
idx=D/'publication-index.json'
with idx.open('x',encoding='utf-8') as f:json.dump({'validation':record,'files':[{'path':p.relative_to(R).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]},f,indent=2)
paths.append(idx);names=[p.relative_to(R).as_posix() for p in paths];require(len(names)==len(set(names)),'Duplicate owned path')
for i in range(0,len(names),15):git('-c','core.autocrlf=false','add','-f','--',*names[i:i+15])
require(set(git('diff','--cached','--name-only').decode().splitlines())==set(names),'Staged owner differs')
tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):require(git('show',tree+':'+n)==p.read_bytes() and git('rev-parse',tree+':'+n).decode().strip()==oid(p.read_bytes()),'Staged raw bytes differ')
git('commit','-m','Retain single startup build180000 launch and honest active opening')
head=git('rev-parse','HEAD').decode().strip()
for p,n in zip(paths,names):require(git('show',head+':'+n)==p.read_bytes(),'Committed bytes differ')
git('push','origin','audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Pushed audit differs')
print(json.dumps({'audit':head,'rawOidShaVerifiedBlobs':len(paths),'openingObservedUtc':observation['observedUtc'],'actualInvocation':record['actualInvocationId'],'terminalResultAtOpening':None,'beforeUnitCapacity':gates['before-unit']}))
