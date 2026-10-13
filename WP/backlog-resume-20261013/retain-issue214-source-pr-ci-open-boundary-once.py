"""Retain one actual source PR / OPEN CI boundary; never dispatch or replay CI.

Execute only after the completed full PASS, source ref and PR creation. If CI
is already closed, preserve this unused helper and retain a closed successor.
"""
import datetime, hashlib, json, subprocess, sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
created=wp/'issue214-scanner-call-form-source-pr-created'
reviewDir=wp/'issue214-scanner-call-form-source-only-review'
creation=json.loads((created/'creation-record.json').read_bytes())
review=json.loads((reviewDir/'review-ref.json').read_bytes())
head=creation['head'];base=creation['base'];number=creation['number']
assert head==review['reviewHead'] and creation['tree']==review['reviewTree']
dest=wp/'issue214-source-pr-ci-open-boundary'
assert not dest.exists(),'Boundary already retained; never replay.'
def command(argv):
    result=subprocess.run(argv,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if result.returncode:raise RuntimeError(result.stderr.decode('utf-8','replace'))
    return result.stdout
def git(*args,binary=False):
    value=command(['git',*args]);return value if binary else value.decode('utf-8').strip()
def gh(path):return command(['gh','api',path])
assert git('branch','--show-current')=='audit/release-eb6de2e8'
assert git('rev-parse','HEAD')==creation['auditSource'] and not git('diff','--cached','--name-only')
assert git('rev-parse',review['reviewRef'])==head
frozen=json.loads((wp/'issue214-scanner-call-form-full/source-before.json').read_bytes())
assert len(frozen)==415 and all(hashlib.sha256((root/p).read_bytes()).hexdigest()==digest for p,digest in frozen.items())
raw={
    'pr-original.json':gh(f'repos/yigini/soilfer-lims/pulls/{number}'),
    'main-original.json':gh('repos/yigini/soilfer-lims/git/ref/heads/main'),
    'issue214-original.json':gh('repos/yigini/soilfer-lims/issues/214'),
    'pr-comments-original.json':gh(f'repos/yigini/soilfer-lims/issues/{number}/comments?per_page=100'),
    'runs-original.json':gh(f'repos/yigini/soilfer-lims/actions/runs?event=pull_request&head_sha={head}&per_page=100'),
}
pr=json.loads(raw['pr-original.json']);runs=json.loads(raw['runs-original.json'])['workflow_runs']
assert pr['state']=='open' and pr['head']['sha']==head and pr['base']['sha']==base
assert json.loads(raw['main-original.json'])['object']['sha']==base
assert json.loads(raw['issue214-original.json'])['state']=='open'
assert not json.loads(raw['pr-comments-original.json']),'Inspect any actual new comment before retaining this open boundary.'
candidates=[r for r in runs if r['head_sha']==head and r['event']=='pull_request' and r['name']=='CI']
assert len(candidates)==1,'Inspect missing or multiple actual runs; never dispatch a substitute.'
ci=candidates[0];identifier=ci['id']
raw['run-original.json']=gh(f'repos/yigini/soilfer-lims/actions/runs/{identifier}')
raw['jobs-original.json']=gh(f'repos/yigini/soilfer-lims/actions/runs/{identifier}/jobs?per_page=100')
ci=json.loads(raw['run-original.json']);jobs=json.loads(raw['jobs-original.json'])['jobs']
assert ci['head_sha']==head and ci['event']=='pull_request' and ci['run_attempt']==1
assert ci['status'] in ['queued','in_progress'] and ci['conclusion'] is None,'Already closed: use a new closed retainer.'
assert len(jobs)<=1 and all(j['status'] in ['queued','in_progress'] and j['conclusion'] is None for j in jobs)
raw['closing-refs-original.json']=command(['gh','pr','view',str(number),'--repo','yigini/soilfer-lims','--json','closingIssuesReferences'])
assert json.loads(raw['closing-refs-original.json'])['closingIssuesReferences']==[]
dest.mkdir()
for name,data in raw.items():(dest/name).write_bytes(data)
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'OPEN_METADATA_ONLY',
        'number':number,'url':pr['html_url'],'head':head,'tree':creation['tree'],'base':base,
        'auditSource':creation['auditSource'],'run':identifier,'runUrl':ci['html_url'],'attempt':1,
        'runStatus':ci['status'],'conclusion':None,'localSuites':365,'localTests':5547,
        'activeLogsCaptured':False,'readyNoticeSent':False,'finalNativeAuditRequestSent':False,
        'actualFinalAuditPass':False,'ciDispatches':0,'productionOperations':0,
        'files':{n:{'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()} for n,data in raw.items()},
        'preparedUnexecutedSuccessors':{name:hashlib.sha256((wp/name).read_bytes()).hexdigest() for name in [
            'retain-issue214-source-pr-ci-terminal-once.py','request-issue214-exact-head-audit-after-green-once.py']}}
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead=(f'## 2026-10-13 #214 source-only PR{number} created; actual CI{identifier} OPEN\n\n'
      f'The actual PR is OPEN at exact source-only head{head}, tree{creation["tree"]}, base{base}. '
      f'The one actual pull-request CI{identifier}, attempt1, is {ci["status"]} with no conclusion. '
      'This is OPEN metadata only; no active logs are captured as a complete result. Observe this same run; '
      'never dispatch/replay a substitute. Closed local regression passed365/365 suites and5547/5547 tests '
      'with all415 frozen inputs unchanged; client build/lint and actual detached browser evidence are retained. '
      'The original PR body lists every changed fixture line and the actual Strict/chart prebinding impact. '
      'Standard CI must run without the local storage fixture and complete real candidate/baseline Docker '
      'boundary/readiness acceptance. Only actual green CI permits one ready notice and a final exact-head '
      'Claudio audit request. No audit PASS/merge/kit/gate/production operation is claimed. '
      '#214 and undeployed #206 remain OPEN for actual post-deploy checks; #103 has no production connection/apply go.\n\n')
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for relative in readmes:
    path=root/relative;path.write_bytes(lead.encode()+path.read_bytes())
folders=[created,reviewDir,dest,wp/'issue214-scanner-call-form-pr-successor-drafts']
paths=[p.relative_to(root).as_posix() for folder in folders for p in folder.iterdir() if p.is_file()]
paths += ['WP/backlog-resume-20261013/'+name for name in [
    'prepare-issue214-scanner-call-form-pr-successor-drafts-once.py',
    'prepare-issue214-scanner-call-form-source-only-review-once.py',
    'create-issue214-scanner-call-form-source-pr-once.py',
    'retain-issue214-source-pr-ci-terminal-once.py','request-issue214-exact-head-audit-after-green-once.py',Path(__file__).name]]
pins={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in paths}
owned=paths+readmes
git('add','-f','--',*owned)
assert set(git('diff','--cached','--name-only').splitlines())<=set(owned)
git('commit','-m',f'Retain control chart PR{number} and actual open CI{identifier} boundary')
audit=git('rev-parse','HEAD')
for p,digest in pins.items():assert hashlib.sha256(git('show',audit+':'+p,binary=True)).hexdigest()==digest,p
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').split()[0]==audit
print(json.dumps({'status':'ACTUAL_PR_OPEN_CI_RETAINED','auditCommit':audit,'number':number,'head':head,
                  'run':identifier,'runStatus':ci['status'],'verifiedBlobs':len(pins),'productionOperations':0}))
