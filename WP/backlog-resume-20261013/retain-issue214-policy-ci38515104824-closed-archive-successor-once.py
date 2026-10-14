"""Retain CLOSED original archive before adaptive step selection; no replay/CI dispatch."""
import datetime,hashlib,io,json,subprocess,sys,zipfile
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
dest=wp/'issue214-policy-owner-ci38515104824-closed-archive-successor';assert not dest.exists()
head='8d564c24f05a3b069bf027bbb7ba4f92cea597b0';base='6d750914d8565acdd496767a7dd935811b5a89b2';identifier=38515104824
def command(args):return subprocess.run(args,cwd=root,capture_output=True,check=True).stdout
def git(*args):return command(['git',*args])
def gh(path):return command(['gh','api',path])
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
raw={'run-original.json':gh(f'repos/yigini/soilfer-lims/actions/runs/{identifier}'),
 'jobs-original.json':gh(f'repos/yigini/soilfer-lims/actions/runs/{identifier}/jobs?per_page=100'),
 'pr-original.json':gh('repos/yigini/soilfer-lims/pulls/296'),
 'main-original.json':gh('repos/yigini/soilfer-lims/git/ref/heads/main'),
 'issue214-original.json':gh('repos/yigini/soilfer-lims/issues/214'),
 'closing-refs-original.json':command(['gh','pr','view','296','--repo','yigini/soilfer-lims','--json','closingIssuesReferences'])}
ci=json.loads(raw['run-original.json']);jobs=json.loads(raw['jobs-original.json'])['jobs'];pr=json.loads(raw['pr-original.json'])
assert ci['status']=='completed' and ci['conclusion']=='failure' and ci['head_sha']==head and ci['run_attempt']==1 and ci['event']=='pull_request'
assert len(jobs)==1 and jobs[0]['status']=='completed' and jobs[0]['conclusion']=='failure'
assert pr['state']=='open' and pr['head']['sha']==head and pr['base']['sha']==base
assert json.loads(raw['main-original.json'])['object']['sha']==base and json.loads(raw['closing-refs-original.json'])['closingIssuesReferences']==[]
assert len(git('diff','--name-only',base,head).decode().splitlines())==59
raw['logs-original.zip']=gh(f'repos/yigini/soilfer-lims/actions/runs/{identifier}/logs')
assert len(raw['logs-original.zip'])<64*1024*1024
z=zipfile.ZipFile(io.BytesIO(raw['logs-original.zip']));entries=z.infolist()
assert all(not e.is_dir() and e.file_size<64*1024*1024 for e in entries)
fragments=['Run server test suite','Build client production bundle','Build Docker image','Build Supported Baseline Docker Image',
 'Run Real Disposable Docker Boundary Rehearsal','Run Real Docker Deployment Readiness Acceptance']
matches={fragment:[e.filename for e in entries if fragment in e.filename] for fragment in fragments}
dest.mkdir()
for name,data in raw.items():(dest/name).write_bytes(data)
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'run':identifier,'attempt':1,'status':'CLOSED_FAILURE_ORIGINAL_ARCHIVE',
 'runUrl':ci['html_url'],'head':head,'base':base,'sourcePathCount':59,'completedUtc':jobs[0]['completed_at'],
 'archiveEntries':[{'name':e.filename,'bytes':e.file_size,'sha256':hashlib.sha256(z.read(e)).hexdigest()} for e in entries],
 'stepFilenameMatches':matches,'files':{name:{'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()} for name,data in raw.items()},
 'prior59PathRetainerRefusedBeforeArtifactCreation':'Substring matched multiple archive entries; original helper consumed, never replay',
 'terminalStepAnalysisPending':True,'actualOverallCiPass':False,'ciDispatches':0,'productionOperations':0,'finalAuditRequestSent':False}
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead=f'''## 2026-10-14 #214 new CI38515104824 CLOSED FAILURE; original archive retained

Actual same attempt1/head8d564c24/base6d closedFAILURE at{jobs[0]['completed_at']}; API reports readinessfailure after builds/boundary, original step analysis PENDING. Original ZIP/API/every archive-entryhash at `WP/backlog-resume-20261013/{dest.name}/index.json`; never rerun/replay/dispatch this run. Earlier59-path retainer refused BEFOREartifactcreation because a substring matched multiple archive filenames; this is a retention-helper refusal, not the CI cause. Both earlier unused58variant and consumed59variant preserved; never execute either. New unique archive retainer owns originals and separates actual step extraction next. No overallPASS/readylabel/auditrequest/209work/merge/kit/gate/productionoperation. User task remains fix/getnewgreen/requestexactheadthen209; inspect originals before source correction and use genuinelynewsource/verification/automaticCI successors only. Humancontent/#103noapply/historicalreleaseguards preserved.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for p in readmes:
 f=root/p;f.write_bytes(lead.encode()+f.read_bytes())
owned=[p.relative_to(root).as_posix() for p in dest.iterdir()]+readmes+[Path(__file__).relative_to(root).as_posix()]
pins={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in owned if p not in readmes}
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for p,digest in pins.items():assert hashlib.sha256(git('show',':'+p)).hexdigest()==digest,p
git('commit','-m','audit(214): retain original closed CI38515104824 failure archive')
audit=git('rev-parse','HEAD').decode().strip()
for p,digest in pins.items():assert hashlib.sha256(git('show',audit+':'+p)).hexdigest()==digest,p
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==audit
print(json.dumps({'auditHead':audit,'run':identifier,'conclusion':ci['conclusion'],'completedUtc':jobs[0]['completed_at'],'verifiedBlobs':len(pins),'matches':matches}))
