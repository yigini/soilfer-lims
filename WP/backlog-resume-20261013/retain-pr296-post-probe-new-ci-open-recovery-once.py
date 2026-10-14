"""Retain fresh actual outcome after stale PATCH head response; never repeat remote mutations."""
import datetime,hashlib,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
source=wp/'issue214-policy-post-probe-source-pr-update';record=json.loads((source/'source-head.json').read_bytes())
head=record['head'];base=record['base'];dest=wp/'issue214-policy-post-probe-new-ci-open';assert not dest.exists()
def command(args):return subprocess.run(args,cwd=root,capture_output=True,check=True).stdout
def git(*args):return command(['git',*args])
def gh(path):return command(['gh','api',path])
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
raw={'pr-original.json':gh('repos/yigini/soilfer-lims/pulls/296'),
 'main-original.json':gh('repos/yigini/soilfer-lims/git/ref/heads/main'),
 'runs-original.json':gh(f'repos/yigini/soilfer-lims/actions/workflows/ci.yml/runs?head_sha={head}&event=pull_request&per_page=100'),
 'closing-refs-original.json':command(['gh','pr','view','296','--repo','yigini/soilfer-lims','--json','closingIssuesReferences'])}
pr=json.loads(raw['pr-original.json']);runs=json.loads(raw['runs-original.json'])['workflow_runs']
assert pr['state']=='open' and pr['head']['sha']==head and pr['base']['sha']==base
assert pr['body']==(source/'pr-body-successor.md').read_text(encoding='utf8')
assert json.loads(raw['main-original.json'])['object']['sha']==base and json.loads(raw['closing-refs-original.json'])['closingIssuesReferences']==[]
assert len(runs)==1 and runs[0]['head_sha']==head and runs[0]['event']=='pull_request' and runs[0]['run_attempt']==1
ci=runs[0];identifier=ci['id'];assert identifier==38524553288 and any(p['number']==296 for p in ci['pull_requests'])
raw['run-original.json']=gh(f'repos/yigini/soilfer-lims/actions/runs/{identifier}')
raw['jobs-original.json']=gh(f'repos/yigini/soilfer-lims/actions/runs/{identifier}/jobs?per_page=100')
assert git('ls-remote','origin','refs/heads/codex/issue-214-control-charts').decode().split()[0]==head
assert git('rev-parse',head+'^{tree}').decode().strip()==record['tree']
assert len(git('diff','--name-only',base,head).decode().splitlines())==59
patch=json.loads((source/'update-response-original.json').read_bytes())
assert patch['head']['sha']==record['oldHead'] and patch['body']==pr['body']
dest.mkdir()
for name,data in raw.items():(dest/name).write_bytes(data)
index={'observedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'number':296,'head':head,'tree':record['tree'],'base':base,
 'run':identifier,'attempt':1,'runUrl':ci['html_url'],'actualStatus':ci['status'],'actualConclusion':ci['conclusion'],
 'metadataOnlyNoActiveLogsRetained':True,'stalePatchResponseHeadFreshOutcomeConfirmed':True,
 'remotePushesOrBodyPatchesRepeated':0,'requiredCiSuites':366,'requiredCiTests':5566,'sourcePathCount':59,
 'failedPriorRunsNeverReplayed':[38467368095,38515104824],'productionOperations':0,
 'files':{name:{'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()} for name,data in raw.items()}}
(dest/'index.json').write_bytes((json.dumps(index,indent=2)+'\n').encode())
lead=f'''## 2026-10-14 #214 corrected post-probe source pushed; actual newCI{identifier} observed

SAME PR296/refcodex/issue-214-control-charts now exacthead{head}/tree{record['tree']}/base main{base},59source-onlypaths/noWP, exact2path delta from8d (rehearsal snapshotinspection+1 appended actualprogramme regression). Runtimeowner/canonicalDDL/science/stockassertions/scanners unchanged. Focused8/219 PASS/all421unchanged/other419equalpriorfull retainedb2558c6e; owneddiagnostic provessecondaryoriginalreadonlycreatesWAL/SHM, snapshotinspectionpreservesoriginaltriple. Earlier CI38515104824 CLOSEDFAILURE05:45:28UTC butactualfullserver366/5565/client/bothDockerbuilds/boundaryPASS; rawZIP19508384/6steps33verifiedblobs b2558c6e. No independentdiscardedCIvolumeinspection. Original38467368095 failureimmutable too. Neitherfailedrunreplays.

ONE NEW automaticCI{identifier} attempt1 created{ci['created_at']} on current5e0b is{ci['status']}/{ci['conclusion']}; observeSAMErun/no dispatch/rerun. Stock CI requiresactual366/5566+bothDocker/boundary/readiness+policyChartEntrypointProof/snapshotpreservation. OPENmetadataONLY/no activelogsasCLOSED. Sourceupdater'sonePATCH returnedSTALEold8d head afterpush whilebodyupdated; FRESHactualPR/source-ref/newCI independentlyconfirm5e0b+intendedbody+base6d. No push/patch repeated; sourceupdaterCONSUMEDneverreplay. Currentraws/sourcebodyversions at issue214-policy-post-probe-source-pr-update and issue214-policy-post-probe-new-ci-open/index.json.

OLD UNUSED request-pr296-policy-owner-exact-head-audit-after-green-once.py isboundFAILED385 and MUSTNEVEREXECUTE. Consumed59-path retainer alsoNEVERreplay; old58variant NEVERexecute. PrepareNEWterminal/readyrequest successors boundcurrent5e0b/newCI38524553288/exact366/5566; chooseactualbuildlogseparatelyfromPostBuildlog, retainallclosedoriginals+everyentryhash+verifyGitblobs thenrequestONCEafteractualgreen/freshheadbase/main. No finalrequest/PASS/merge/kit/gate/productionoperation or209work; userdirection afteractualrequest START209. Sameauditwriter/humancontentpreserved/#103noapply/owner6160619940no normalization/productionkitreadonlyPRESENTorSTOP/snapshotdisk/historicalguards hold.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for p in readmes:
 f=root/p;f.write_bytes(lead.encode()+f.read_bytes())
owned=[p.relative_to(root).as_posix() for folder in [source,dest] for p in folder.iterdir() if p.is_file()]+readmes+[
 Path(__file__).relative_to(root).as_posix(),'WP/backlog-resume-20261013/update-pr296-post-probe-after-focused-pass-once.py']
pins={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in owned if p not in readmes}
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for p,digest in pins.items():assert hashlib.sha256(git('show',':'+p)).hexdigest()==digest,p
git('commit','-m','audit(214): confirm actual post-probe PR head and bind new automatic CI')
audit=git('rev-parse','HEAD').decode().strip()
for p,digest in pins.items():assert hashlib.sha256(git('show',audit+':'+p)).hexdigest()==digest,p
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==audit
print(json.dumps({'auditHead':audit,'head':head,'run':identifier,'status':ci['status'],'conclusion':ci['conclusion'],'verifiedBlobs':len(pins),'remoteMutationsRepeated':0}))
