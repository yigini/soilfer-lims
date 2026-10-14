"""Retain CLOSED corrected-head CI against actual verified59 paths, once; no dispatch/retry.
Supersedes the UNUSED58-path retainer; preserve and NEVER EXECUTE that earlier variant.
"""
import datetime,hashlib,io,json,re,subprocess,sys,zipfile
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
source=json.loads((wp/'issue214-policy-post-probe-source-pr-update/source-head.json').read_bytes())
opening=json.loads((wp/'issue214-policy-post-probe-new-ci-open/index.json').read_bytes())
head=source['head'];base=source['base'];identifier=opening['run']
assert opening['head']==head and opening['number']==296 and opening['attempt']==1 and identifier not in [38467368095,38515104824]
dest=wp/f'issue214-policy-post-probe-ci-{identifier}-closed-terminal'
assert not dest.exists(),'Already retained: never replay.'
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
assert ci['status']=='completed' and ci['conclusion'] is not None,'Still active: do not retain logs.'
assert ci['head_sha']==head and ci['event']=='pull_request' and ci['run_attempt']==1
assert len(jobs)==1 and jobs[0]['status']=='completed' and jobs[0]['conclusion'] is not None
assert pr['state']=='open' and pr['head']['sha']==head and pr['base']['sha']==base
assert pr['body']==(wp/'issue214-policy-post-probe-source-pr-update/pr-body-successor.md').read_text(encoding='utf8')
assert json.loads(raw['main-original.json'])['object']['sha']==base
assert json.loads(raw['issue214-original.json'])['state']=='open'
assert json.loads(raw['closing-refs-original.json'])['closingIssuesReferences']==[]
paths=git('diff','--name-only',base,head).decode().splitlines()
assert len(paths)==59 and not any(p.startswith('WP/') for p in paths)
workflow=git('show',head+':.github/workflows/ci.yml');assert workflow==git('show',base+':.github/workflows/ci.yml')
assert b'local-retention' not in workflow and b'LIMS_VISIBLE_' not in workflow
raw['workflow-original.yml']=workflow
raw['logs-original.zip']=gh(f'repos/yigini/soilfer-lims/actions/runs/{identifier}/logs')
assert len(raw['logs-original.zip'])<64*1024*1024
archive=zipfile.ZipFile(io.BytesIO(raw['logs-original.zip']));entries=archive.infolist()
assert all(not e.is_dir() and e.file_size<64*1024*1024 for e in entries)
fragments={'server-tests-original.log':'Run server test suite',
 'client-build-original.log':'Build client production bundle','candidate-docker-build-original.log':'Build Docker image',
 'baseline-docker-build-original.log':'Build Supported Baseline Docker Image',
 'docker-boundary-original.log':'Run Real Disposable Docker Boundary Rehearsal',
 'docker-readiness-original.log':'Run Real Docker Deployment Readiness Acceptance'}
success=ci['conclusion']=='success'
for name,fragment in fragments.items():
 found=[e for e in entries if fragment in e.filename and '_Post ' not in Path(e.filename).name];assert len(found)<=1
 if success:assert len(found)==1,fragment
 if found:raw[name]=archive.read(found[0])
plain=re.sub(r'\x1b\[[0-9;]*m','',raw.get('server-tests-original.log',b'').decode('utf8','replace'))
suites=re.findall(r'Test Suites: [^\r\n]+',plain);tests=re.findall(r'Tests: +[^\r\n]+',plain)
passed=re.findall(r'\bPASS (tests/[^\r\n]*?\.test\.js)\b',plain)
inventory=json.loads((wp/'issue214-policy-post-probe-focused/inventory-original.json').read_bytes())
expected={p.replace('\\','/').split('/server/',1)[1] for p in inventory};assert len(expected)==366
serverAllPass=(suites==['Test Suites: 366 passed, 366 total'] and tests==['Tests:       5566 passed, 5566 total']
 and len(passed)==len(set(passed))==366 and set(passed)==expected and not re.search(r'\bFAIL tests/',plain))
job=jobs[0];steps={s['name']:s['conclusion'] for s in job['steps']}
required=['Run server test suite','Build client production bundle','Build Docker image',
 'Build Supported Baseline Docker Image (v3.5.30 / 48d0e52)',
 'Run Real Disposable Docker Boundary Rehearsal','Run Real Docker Deployment Readiness Acceptance']
proof=None
readiness=raw.get('docker-readiness-original.log',b'').decode('utf8','replace')
starts=[m.start() for m in re.finditer(re.escape('{"policyChartEntrypointProof":'),readiness)]
if starts:
 assert len(starts)==1
 proof=json.JSONDecoder().raw_decode(readiness[starts[0]:])[0]['policyChartEntrypointProof']
if success:
 assert job['conclusion']=='success' and all(s['status']=='completed' and s['conclusion']=='success' for s in job['steps'])
 assert all(steps.get(name)=='success' for name in required) and serverAllPass
 assert 'jest --maxWorkers=1 --workerIdleMemoryLimit=512MB' in plain
 assert 'LIMS_VISIBLE_' not in plain and 'visible-test-storage' not in plain and 'local-retention-teardown' not in plain
 assert proof and proof['scenario']=='PRE_199-default-entrypoint-COMPLETE_214'
 before=proof['before'];after=proof['after']
 assert before['dbWalShmPreserved'] and before['dry']['classification']=='ABSENT'
 assert before['dry']['mode']=='DRY_RUN' and before['dry']['totalChanges']==0 and before['dry']['plannedSql']
 assert after['dbWalShmPreserved'] and after['secondaryInspectionsOnRetainedSnapshot'] and after['ready']['classification']=='PRESENT'
 assert after['again']['mode']=='NO_OP' and after['again']['totalChanges']==0
 assert after['charts']['classification']=='COMPLETE_214' and after['charts']['totalChanges']==0
 assert all(value==0 for value in after['counts'].values())
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'CLOSED_SUCCESS' if success else 'CLOSED_NON_SUCCESS',
 'run':identifier,'runUrl':ci['html_url'],'attempt':1,'conclusion':ci['conclusion'],'job':job['id'],
 'jobConclusion':job['conclusion'],'completedUtc':job['completed_at'],'number':296,'head':head,'tree':source['tree'],'base':base,
 'sourcePaths':paths,'exactJestSummary':suites+tests,'serverAllPassedIndependently':serverAllPass,
 'uniquePassPathsObserved':len(set(passed)),'exactFullInventoryMatch':set(passed)==expected,
 'passedSuites':366 if serverAllPass else None,'passedTests':5566 if serverAllPass else None,
 'policyChartEntrypointProof':proof,'requiredSteps':steps,'standardWorkflowUnchanged':True,
 'localFixturesUsedInCI':False if success else None,
 'archiveEntries':[{'name':e.filename,'bytes':e.file_size,'sha256':hashlib.sha256(archive.read(e)).hexdigest()} for e in entries],
 'files':{name:{'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()} for name,data in raw.items()},
 'disposableCiImagesAreNotProductionImages':True,'originalFailedRunReplayed':False,'ciDispatches':0,
 'readyNoticeSent':False,'finalNativeAuditRequestSent':False,'actualFinalAuditPass':False,'productionOperations':0}
dest.mkdir()
for name,data in raw.items():(dest/name).write_bytes(data)
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead=f'''## 2026-10-14 #214 corrected-head CI{identifier} CLOSED {ci['conclusion'].upper()}

PR296 exacthead{head}/tree{source['tree']}/base{base}, attempt1 closed{job['completed_at']}. Original Jest summary {' / '.join(suites+tests)}; independently serverAllPass={serverAllPass}, inventoryMatch={set(passed)==expected}. {'Client, both actual candidate+baseline48d Docker builds and real boundary/readiness ALLSUCCESS; actual PRE_199 default entrypoint policy ABSENT/DRY0→PRESENT/NO_OP0→COMPLETE_214 with empty tables and DB/WAL/SHM preservation verified.' if success else 'Overall CI did not pass; inspect actual retained logs, never replay this run or infer Docker execution from stale API.'} Closed original ZIP/API/step logs/every archive-entry hash retained at `WP/backlog-resume-20261013/{dest.name}/index.json`. Both failed38467368095/e47b and38515104824/8d immutable; never retry either. Canonical owner accepted6160619940/no normalization; production kit readonly mustPRESENT/NO_OP0 with retainedsnapshotdiskaccounting orSTOP/noapply. No ready notice/final audit request/PASS/merge/kit/gate/production operation from this retainer. After actual green retain+freshheadchecks send NEW exact-head audit request once, then start209. Human drafts/#103noapply and historicalguards preserved.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for p in readmes:
 f=root/p;f.write_bytes(lead.encode()+f.read_bytes())
owned=[p.relative_to(root).as_posix() for p in dest.iterdir()]+readmes+[Path(__file__).relative_to(root).as_posix()]
pins={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in owned if p not in readmes}
git('add','-f','--',*owned)
assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for p,digest in pins.items():assert hashlib.sha256(git('show',':'+p)).hexdigest()==digest,p
git('commit','-m',f'audit(214): retain corrected-head CI{identifier} {ci["conclusion"]}')
audit=git('rev-parse','HEAD').decode().strip()
for p,digest in pins.items():assert hashlib.sha256(git('show',audit+':'+p)).hexdigest()==digest,p
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==audit
print(json.dumps({'auditHead':audit,'run':identifier,'head':head,'conclusion':ci['conclusion'],
 'exactJestSummary':record['exactJestSummary'],'policyEntrypointProofVerified':success,'verifiedBlobs':len(pins)}))
