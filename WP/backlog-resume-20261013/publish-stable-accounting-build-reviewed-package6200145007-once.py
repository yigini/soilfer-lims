"""Publish the single reviewed local package and byte identities before upload."""
import hashlib,json,pathlib,subprocess,sys
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/batch-build-stable-accounting-be837974-20261015'
P=S/'build-package-workflow-batch-build-be837974-20261015T190000Z';D=S/'reviewed-package-publication-6200145007-once'
def git(*a):return subprocess.check_output(['git','-c','core.longpaths=true',*a],cwd=R)
def sha(v):return hashlib.sha256(v).hexdigest()
def oid(v):return hashlib.sha1(('blob '+str(len(v))+'\0').encode()+v).hexdigest()
assert not D.exists() and git('rev-parse','HEAD').decode().strip()=='ca1abf203a881ef4ce423aa6073899a477cd7bd5' and not git('diff','--cached','--name-only').strip()
sys.path.insert(0,str(S));from batch_build_contract import *
spec,index,review=[json_exact((P/n).read_bytes()) for n in ['build-input.json','tooling-source-index.json','source-review-original.json']]
validate_spec(spec,index,review);require(review['id']==6200145007,'Exact review required')
require({p.name for p in P.iterdir()}==REQUIRED_ARTIFACTS,'Package inventory differs')
validate_capacity_files(spec,json_exact((P/'source-index.json').read_bytes()),{p.name:p.stat().st_size for p in P.iterdir() if p.name!='build-input.json'})
require(json_exact((S/'reviewed-package-preparation-6200145007-once/exit-original.json').read_bytes())['exitCode']==0,'Preparation incomplete')
D.mkdir();paths=sorted(p for f in [P,S/'reviewed-package-preparation-6200145007-once'] for p in f.iterdir() if p.is_file())
paths += [R/'WP/backlog-resume-20261013/execute-stable-accounting-build-reviewed-package6200145007-once.py',R/'WP/backlog-resume-20261013/execute-stable-accounting-build-reviewed-launch6200145007-once.py',pathlib.Path(__file__)]
lead=f'''## 2026-10-15 one approved stable-accounting build package prepared; not launched

ActualSourcePASS6200145007/exact4de3e334 authorizes one build-only qualification. ONE complete{len(REQUIRED_ARTIFACTS)}file raw-Git package prepared{spec['preparedUtc']}; all5source/all47bindings/currentmainCI4audits/rulepins/failed180000 reference verified. Required fresh R4 free before-root{capacity_requirement(spec['capacityPlan'],'before-root')} / before-unit{capacity_requirement(spec['capacityPlan'],'before-unit')} / before-build{capacity_requirement(spec['capacityPlan'],'before-build')}B includes floor10556150894+4GiB+ADDITIONAL10000000000B and only future package/extraction allowances. Fresh current fit not yet established; exact reviewed launcher must pass before-root/unit and unused-root/unit checks. Full package publication at WP/batch-build-stable-accounting-be837974-20261015/reviewed-package-publication-6200145007-once/publication-index.json. New190000root/unit/build unexecuted by this publisher; any uncertain launch inspect SAME never replay. Builder prunesnothing/R2separate after-qualified-build bounded-source/itemreceipt still required. No proof/cleanup/kit/gate/deploy/productionDB. Failed180000/a61andallhistoricalroots remain excluded and protected. Human drafts/cards untouched.

'''
for n in ['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']:
 p=R/n;p.write_bytes(lead.encode()+p.read_bytes());paths.append(p)
idx=D/'publication-index.json'
with idx.open('x',encoding='utf-8') as f:json.dump({'status':'ONE_REVIEWED_LOCAL_BUILD_PACKAGE_PUBLISHED_NOT_LAUNCHED','toolingCommit':index['head'],'sourceReviewId':review['id'],'packageFileCount':len(REQUIRED_ARTIFACTS),'preparedUtc':spec['preparedUtc'],'capacityPlan':spec['capacityPlan'],'files':[{'path':p.relative_to(R).as_posix(),'length':len(p.read_bytes()),'sha256':sha(p.read_bytes()),'gitBlobOid':oid(p.read_bytes())} for p in paths]},f,indent=2)
paths.append(idx);names=[p.relative_to(R).as_posix() for p in paths]
require(len(names)==len(set(names)),'Duplicate owned path')
for i in range(0,len(names),15):git('-c','core.autocrlf=false','add','-f','--',*names[i:i+15])
require(set(git('diff','--cached','--name-only').decode().splitlines())==set(names),'Staged owner differs')
tree=git('write-tree').decode().strip()
for p,n in zip(paths,names):require(git('show',tree+':'+n)==p.read_bytes() and git('rev-parse',tree+':'+n).decode().strip()==oid(p.read_bytes()),'Staged raw bytes differ')
git('commit','-m','Publish exact reviewed startup build package6200145007 before upload')
head=git('rev-parse','HEAD').decode().strip()
for p,n in zip(paths,names):require(git('show',head+':'+n)==p.read_bytes(),'Committed raw bytes differ')
git('push','origin','audit/release-eb6de2e8');require(git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head,'Pushed audit differs')
print(json.dumps({'audit':head,'rawOidShaVerifiedBlobs':len(paths),'packageFiles':len(REQUIRED_ARTIFACTS),'builds':0,'hostConnections':0}))
