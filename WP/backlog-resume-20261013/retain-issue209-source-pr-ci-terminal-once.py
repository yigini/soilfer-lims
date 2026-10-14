"""Retain CLOSED original CI evidence once, preserving any failure honestly.

Never dispatch/retry CI or capture active logs as a terminal result. A success
record requires the exact full inventory, final summary and real Docker steps.
"""
import datetime,hashlib,io,json,re,subprocess,sys,zipfile
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
creation=json.loads((wp/'issue209-classified-source-pr-created/creation-record.json').read_bytes())
opening=json.loads((wp/'issue209-source-pr-ci-open-boundary/index.json').read_bytes())
head=creation['head'];base=creation['base'];number=creation['number'];identifier=opening['run']
assert opening['head']==head and opening['number']==number==297 and opening['attempt']==1
assert identifier==38615738432 and head=='562cab2d24b25a500041a44abf384ffc4dbfad7c'
dest=wp/f'issue209-ci-{identifier}-closed-terminal'
assert not dest.exists(),'Closed originals already retained; never replay.'
def command(argv):
    result=subprocess.run(argv,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if result.returncode:raise RuntimeError(result.stderr.decode('utf-8','replace'))
    return result.stdout
def git(*args,binary=False):
    data=command(['git',*args]);return data if binary else data.decode('utf-8').strip()
def gh(path):return command(['gh','api',path])
assert git('branch','--show-current')=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only')
raw={
    'run-original.json':gh(f'repos/yigini/soilfer-lims/actions/runs/{identifier}'),
    'jobs-original.json':gh(f'repos/yigini/soilfer-lims/actions/runs/{identifier}/jobs?per_page=100'),
    'pr-original.json':gh(f'repos/yigini/soilfer-lims/pulls/{number}'),
    'main-original.json':gh('repos/yigini/soilfer-lims/git/ref/heads/main'),
    'issue209-original.json':gh('repos/yigini/soilfer-lims/issues/209'),
    'closing-refs-original.json':command(['gh','pr','view',str(number),'--repo','yigini/soilfer-lims','--json','closingIssuesReferences']),
}
ci=json.loads(raw['run-original.json']);jobs=json.loads(raw['jobs-original.json'])['jobs'];pr=json.loads(raw['pr-original.json'])
assert ci['status']=='completed' and ci['conclusion'] is not None,'Still active: no log retention.'
assert ci['head_sha']==head and ci['event']=='pull_request' and ci['run_attempt']==1
assert len(jobs)==1 and jobs[0]['status']=='completed' and jobs[0]['conclusion'] is not None
assert pr['state']=='open' and pr['head']['sha']==head and pr['base']['sha']==base
assert json.loads(raw['main-original.json'])['object']['sha']==base
assert json.loads(raw['issue209-original.json'])['state']=='open'
assert json.loads(raw['closing-refs-original.json'])['closingIssuesReferences']==[]
paths=git('diff','--name-only',base,head).splitlines()
assert len(paths)==122 and not any(p.startswith('WP/') for p in paths)
workflow=git('show',head+':.github/workflows/ci.yml',binary=True)
assert workflow==git('show',base+':.github/workflows/ci.yml',binary=True)
raw['workflow-original.yml']=workflow
raw['logs-original.zip']=gh(f'repos/yigini/soilfer-lims/actions/runs/{identifier}/logs')
assert len(raw['logs-original.zip'])<64*1024*1024
archive=zipfile.ZipFile(io.BytesIO(raw['logs-original.zip']));entries=archive.infolist()
assert all(not e.is_dir() and e.file_size<64*1024*1024 for e in entries)
def stepLog(fragment,required=False):
    found=[entry for entry in entries if fragment in entry.filename]
    assert len(found)<=1,[entry.filename for entry in found]
    if required:assert len(found)==1,fragment
    return archive.read(found[0]) if found else None
fragments={
    'server-tests-original.log':'Run server test suite',
    'client-build-original.log':'Build client production bundle',
    'candidate-docker-build-original.log':'Build Docker image',
    'baseline-docker-build-original.log':'Build Supported Baseline Docker Image',
    'docker-boundary-original.log':'Run Real Disposable Docker Boundary Rehearsal',
    'docker-readiness-original.log':'Run Real Docker Deployment Readiness Acceptance',
}
for name,fragment in fragments.items():
    data=stepLog(fragment,required=ci['conclusion']=='success')
    if data is not None:raw[name]=data
plain=re.sub(r'\x1b\[[0-9;]*m','',raw.get('server-tests-original.log',b'').decode('utf-8','replace'))
suites=re.findall(r'Test Suites: [^\r\n]+',plain);tests=re.findall(r'Tests: +[^\r\n]+',plain)
passed=re.findall(r'\bPASS (tests/[^\r\n]*?\.test\.js)\b',plain)
inventory=json.loads((wp/'issue209-full-classified-ordinary/inventory-original.json').read_bytes())
expected={p.replace('\\','/').split('/server/',1)[1] for p in inventory}
assert len(expected)==370
requiredSteps=[
    'Run server test suite','Build client production bundle','Build Docker image',
    'Build Supported Baseline Docker Image (v3.5.30 / 48d0e52)',
    'Run Real Disposable Docker Boundary Rehearsal','Run Real Docker Deployment Readiness Acceptance',
]
job=jobs[0];steps={s['name']:s['conclusion'] for s in job['steps']}
success=ci['conclusion']=='success'
if success:
    assert job['conclusion']=='success' and all(s['status']=='completed' and s['conclusion']=='success' for s in job['steps'])
    assert all(steps.get(name)=='success' for name in requiredSteps)
    assert suites==['Test Suites: 370 passed, 370 total'] and tests==['Tests:       5642 passed, 5642 total']
    assert len(passed)==len(set(passed))==370 and set(passed)==expected
    assert not re.search(r'\bFAIL tests/',plain)
    assert 'jest --maxWorkers=1 --workerIdleMemoryLimit=512MB' in plain
    assert 'visible-test-storage' not in plain and 'LIMS_VISIBLE_' not in plain
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'CLOSED_SUCCESS' if success else 'CLOSED_NON_SUCCESS',
    'run':identifier,'runUrl':ci['html_url'],'attempt':1,'conclusion':ci['conclusion'],
    'job':job['id'],'jobConclusion':job['conclusion'],'completedUtc':job['completed_at'],
    'number':number,'head':head,'tree':creation['tree'],'base':base,'sourcePaths':paths,
    'exactJestSummary':suites+tests,'uniquePassPathsObserved':len(set(passed)),
    'exactFullInventoryMatch':success and set(passed)==expected,
    'passedSuites':370 if success else None,'passedTests':5642 if success else None,
    'failedOrSkippedOrPending':0 if success else 'Inspect retained originals',
    'requiredSteps':steps,'standardWorkflowUnchanged':True,'localStorageFixtureUsedInCI':False if success else None,
    'archiveEntries':[{'name':e.filename,'bytes':e.file_size,'sha256':hashlib.sha256(archive.read(e)).hexdigest()} for e in entries],
    'files':{name:{'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()} for name,data in raw.items()},
    'disposableCiImagesAreNotProductionImages':True,'ciDispatches':0,'readyNoticeSent':False,
    'finalNativeAuditRequestSent':False,'actualFinalAuditPass':False,'productionOperations':0}
dest.mkdir()
for name,data in raw.items():(dest/name).write_bytes(data)
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead=(f'## 2026-10-14 #209 actual CI{identifier} CLOSED {ci["conclusion"].upper()}\n\n'
      f'Original attempt1 on PR{number} exact source-only head{head}, tree{creation["tree"]}, base{base}, '
      f'closed at{job["completed_at"]}. '
      + ('Final original Jest summary: "Test Suites: 370 passed, 370 total" / "Tests:       5642 passed, 5642 total". '
         'All370 unique PASS paths equal the frozen inventory; zero failures/skips/pending. Client build, actual '
         'candidate and supported baseline48d0e52 Docker builds, real disposable Docker boundary/readiness ALLSUCCESS. '
         'The unchanged standard workflow ran ordinary npm test without the local storage fixture. '
         if success else 'This is a closed non-success boundary, never a PASS. Inspect the retained raw failure and '
         'skipped-step evidence before any correction or genuinely new CI; never replay this consumed run. ')
      + f'Closed original ZIP/API/step logs/every archive-entry hash are at `WP/backlog-resume-20261013/{dest.name}/index.json`. '
      'Disposable CI images are not production release images. No ready notice or final native audit request was sent '
      'by this retainer; actual exact-head Claudio PASS remains required before merge. No kit/gate/production action, '
      'historical replay or103 production connection/apply go. #209,#214 and206 stay OPEN for actual post-deploy closure.\n\n')
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for relative in readmes:
    path=root/relative;path.write_bytes(lead.encode()+path.read_bytes())
owned=[p.relative_to(root).as_posix() for p in dest.iterdir()]+[Path(__file__).relative_to(root).as_posix()]+readmes
pins={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in owned if p not in readmes}
git('add','-f','--',*owned)
assert set(git('diff','--cached','--name-only').splitlines())<=set(owned)
git('commit','-m',f'Retain closed original order revision CI{identifier} {ci["conclusion"]}')
audit=git('rev-parse','HEAD')
for p,digest in pins.items():assert hashlib.sha256(git('show',audit+':'+p,binary=True)).hexdigest()==digest,p
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').split()[0]==audit
print(json.dumps({'status':record['status'],'auditCommit':audit,'number':number,'head':head,'run':identifier,
                  'conclusion':ci['conclusion'],'exactJestSummary':record['exactJestSummary'],
                  'verifiedBlobs':len(pins),'productionOperations':0}))
