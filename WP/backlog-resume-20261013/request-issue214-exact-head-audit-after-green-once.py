"""Post one audit-ready boundary only after independently retained CLOSED CI.

Preserve the original PR body and raw responses. Never retry any uncertain
remote mutation; inspect GitHub and retain a unique recovery boundary instead.
"""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
created=wp/'issue214-scanner-call-form-source-pr-created'
creation=json.loads((created/'creation-record.json').read_bytes())
opening=json.loads((wp/'issue214-source-pr-ci-open-boundary/index.json').read_bytes())
number=creation['number'];head=creation['head'];tree=creation['tree'];base=creation['base'];identifier=opening['run']
closed=wp/f'issue214-ci-{identifier}-closed-terminal'
terminal=json.loads((closed/'index.json').read_bytes())
assert terminal['status']=='CLOSED_SUCCESS' and terminal['head']==head and terminal['run']==identifier
assert terminal['passedSuites']==365 and terminal['passedTests']==5547
assert terminal['exactJestSummary']==['Test Suites: 365 passed, 365 total','Tests:       5547 passed, 5547 total']
assert terminal['exactFullInventoryMatch'] and terminal['failedOrSkippedOrPending']==0
dest=wp/'issue214-exact-head-audit-ready-request'
assert not dest.exists(),'Audit-ready attempt already exists; never replay.'
def command(argv):
    result=subprocess.run(argv,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if result.returncode:raise RuntimeError(result.stderr.decode('utf-8','replace'))
    return result.stdout
def git(*args,binary=False):
    value=command(['git',*args]);return value if binary else value.decode('utf-8').strip()
def gh(path):return command(['gh','api',path])
def post(path,method,request,name):
    file=dest/(name+'-request.json');file.write_bytes((json.dumps(request,indent=2)+'\n').encode())
    raw=command(['gh','api',path,'--method',method,'--input',str(file)])
    (dest/(name+'-response-original.json')).write_bytes(raw)
    return json.loads(raw)
assert git('branch','--show-current')=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only')
audit=git('rev-parse','HEAD')
for name,pin in terminal['files'].items():
    path=(closed/name).relative_to(root).as_posix()
    assert hashlib.sha256(git('show',audit+':'+path,binary=True)).hexdigest()==pin['sha256'],path
before={
    'pr-before-original.json':gh(f'repos/yigini/soilfer-lims/pulls/{number}'),
    'main-before-original.json':gh('repos/yigini/soilfer-lims/git/ref/heads/main'),
    'run-before-original.json':gh(f'repos/yigini/soilfer-lims/actions/runs/{identifier}'),
    'comments-before-original.json':gh(f'repos/yigini/soilfer-lims/issues/{number}/comments?per_page=100'),
    'label-definition-original.json':gh('repos/yigini/soilfer-lims/labels/ready-for-audit'),
    'closing-refs-before-original.json':command(['gh','pr','view',str(number),'--repo','yigini/soilfer-lims','--json','closingIssuesReferences']),
}
pr=json.loads(before['pr-before-original.json']);ci=json.loads(before['run-before-original.json']);comments=json.loads(before['comments-before-original.json'])
assert pr['state']=='open' and pr['head']['sha']==head and pr['base']['sha']==base
assert json.loads(before['main-before-original.json'])['object']['sha']==base
assert ci['status']=='completed' and ci['conclusion']=='success' and ci['head_sha']==head and ci['run_attempt']==1
assert json.loads(before['closing-refs-before-original.json'])['closingIssuesReferences']==[]
assert pr['body']==(created/'pr-body-original.md').read_text(encoding='utf-8'),'Inspect actual PR body changes, never overwrite them.'
assert not any(label['name']=='ready-for-audit' for label in pr['labels'])
marker=f'Pip #214 exact-head audit request: {head}'
assert not any(marker in c['body'] or 'Audit passed: OK to merge and deploy' in c['body'] for c in comments)
evidence=f'https://github.com/yigini/soilfer-lims/tree/{audit}/WP/backlog-resume-20261013/{closed.name}'
lead=(f'**Actual complete PR CI [{identifier}]({ci["html_url"]}), attempt1, SUCCESS at {terminal["completedUtc"]}.** '
      f'Exact source-only head `{head}`, tree `{tree}`, base `{base}`. Final original Jest summary: '
      '**Test Suites: 365 passed, 365 total** / **Tests:       5547 passed, 5547 total**. '
      'Every365 unique PASS path equals the frozen full inventory, zero failures/skips/pending. '
      'Client build, candidate and supported baseline48d0e52 actual Docker builds, real disposable boundary '
      f'and readiness acceptance all SUCCESS. [Closed originals and every archive-entry/file hash]({evidence}). '
      'The unchanged standard workflow used ordinary npm test without the local storage fixture. '
      'Disposable CI images are not production images. Final exact-head Claudio audit PASS remains required.\n\n')
body=lead+pr['body'];assert len(body.encode())<60000
notice=(marker+'\n\n'
        f'@claude: ready for final #214 source audit on PR{number}, exact head `{head}`, tree `{tree}`, base `{base}`. '
        'No final audit PASS is inferred from the scientific/fixture scope answers.\n\n'
        f'Actual complete CI{identifier}, attempt1, SUCCESS at{terminal["completedUtc"]}:\n'
        '```\nTest Suites: 365 passed, 365 total\nTests:       5547 passed, 5547 total\n```\n'
        'All365 unique PASS paths match the frozen inventory; zero failures/skips/pending. Client production build, '
        'actual candidate and supported baseline48d0e52 Docker builds, real disposable boundary/readiness all SUCCESS. '
        f'[Closed originals and exact hashes]({evidence}); [local frozen full/browser evidence]'
        f'(https://github.com/yigini/soilfer-lims/tree/{creation["auditSource"]}/WP/backlog-resume-20261013).\n\n'
        'Actual directions6148143929/6152114918/6152507558 are implemented. Strict/chart laboratories must prebind '
        'served LRM lots before new starts, including Provisional; fixed-window and genuinely pre-release started runs '
        'retain their path. The PR lists every changed fixture line, the one owned compatibility helper caller, '
        'unchanged scanner predicates/assertions and the actual read-only context/unstarted-run impact count required '
        'for the later kit audit before any fresh gate. No production impact collection occurred.\n\n'
        'Please post actual "Audit passed: OK to merge and deploy" bound to this exact head, or concrete findings. '
        'No merge, kit, gate or production operation now. #214 and undeployed #206 stay open for actual post-deploy '
        'checks; no closing keyword, historical replay, #103 connection/apply go or human-card answer.\n')
dest.mkdir()
for name,data in before.items():(dest/name).write_bytes(data)
(dest/'actual-audit-request.txt').write_bytes(notice.encode())
(dest/'pr-body-ci-complete.md').write_bytes(body.encode())
updated=post(f'repos/yigini/soilfer-lims/pulls/{number}','PATCH',{'body':body},'body')
assert updated['head']['sha']==head and updated['body']==body
labels=post(f'repos/yigini/soilfer-lims/issues/{number}/labels','POST',{'labels':['ready-for-audit']},'label')
assert any(label['name']=='ready-for-audit' for label in labels)
comment=post(f'repos/yigini/soilfer-lims/issues/{number}/comments','POST',{'body':notice},'notice')
assert comment['body']==notice
fresh=gh(f'repos/yigini/soilfer-lims/pulls/{number}');(dest/'pr-after-original.json').write_bytes(fresh)
assert json.loads(fresh)['head']['sha']==head
record={'postedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'number':number,'head':head,'tree':tree,'base':base,
        'run':identifier,'closedEvidenceAudit':audit,'comment':comment['id'],'commentUrl':comment['html_url'],
        'readyNoticeSentOnce':True,'labelAddedOnce':True,'finalNativeHandoffSent':False,'actualAuditPass':False,
        'productionOperations':0,'ciDispatches':0}
(dest/'delivery-record.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
files=[p for p in dest.iterdir() if p.is_file()]
pins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files}
(dest/'index.json').write_bytes((json.dumps(pins,indent=2)+'\n').encode())
status=(f'## 2026-10-13 #214 PR{number} ready for exact-head audit; actual green CI retained\n\n'
        f'Ready-for-audit label and comment{comment["id"]} posted ONCE on exact head{head}, tree{tree}, base{base}, '
        f'after actual complete CI{identifier} SUCCESS365/5547 and all real Docker steps. Original PR body and '
        'updated complete-CI body/raw responses are retained. Never duplicate this notice/label. Final native '
        'handoff has NOT yet been sent by this helper; use fresh actual target/focus/empty-draft observations. '
        'Actual final exact-head Claudio PASS remains required before merge. No kit/gate/production action, '
        'historical replay or103 production connection/apply go.\n\n')
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for relative in readmes:
    path=root/relative;path.write_bytes(status.encode()+path.read_bytes())
owned=list(pins)+[(dest/'index.json').relative_to(root).as_posix(),Path(__file__).relative_to(root).as_posix()]+readmes
git('add','-f','--',*owned)
assert set(git('diff','--cached','--name-only').splitlines())<=set(owned)
git('commit','-m',f'Retain one exact-head control chart audit request PR{number}')
retained=git('rev-parse','HEAD')
for p,pin in pins.items():assert hashlib.sha256(git('show',retained+':'+p,binary=True)).hexdigest()==pin['sha256'],p
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').split()[0]==retained
print(json.dumps(dict(record,auditCommit=retained,exactBlobsVerified=len(pins))))
