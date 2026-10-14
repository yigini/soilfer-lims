"""Send ONE corrected-head audit request after CLOSED complete green CI; no replay."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
source=json.loads((wp/'issue214-policy-owner-source-pr-update/source-head.json').read_bytes())
opening=json.loads((wp/'issue214-policy-owner-new-ci-open/index.json').read_bytes())
head=source['head'];tree=source['tree'];base=source['base'];identifier=opening['run']
closed=wp/f'issue214-policy-owner-ci-{identifier}-closed-terminal'
terminal=json.loads((closed/'index.json').read_bytes())
assert identifier!=38467368095 and terminal['status']=='CLOSED_SUCCESS' and terminal['run']==identifier and terminal['head']==head
assert terminal['passedSuites']==366 and terminal['passedTests']==5565 and terminal['serverAllPassedIndependently']
assert terminal['exactJestSummary']==['Test Suites: 366 passed, 366 total','Tests:       5565 passed, 5565 total']
assert terminal['exactFullInventoryMatch'] and terminal['policyChartEntrypointProof']
dest=wp/'issue214-policy-owner-exact-head-audit-request'
assert not dest.exists(),'Attempt already exists: never replay or duplicate uncertain remote outcomes.'
def command(args):return subprocess.run(args,cwd=root,capture_output=True,check=True).stdout
def git(*args):return command(['git',*args])
def gh(path):return command(['gh','api',path])
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
audit=git('rev-parse','HEAD').decode().strip()
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==audit
assert git('show',audit+':'+(closed/'index.json').relative_to(root).as_posix())==(closed/'index.json').read_bytes()
for name,pin in terminal['files'].items():
 assert hashlib.sha256(git('show',audit+':'+(closed/name).relative_to(root).as_posix())).hexdigest()==pin['sha256'],name
before={'pr-before-original.json':gh('repos/yigini/soilfer-lims/pulls/296'),
 'main-before-original.json':gh('repos/yigini/soilfer-lims/git/ref/heads/main'),
 'run-before-original.json':gh(f'repos/yigini/soilfer-lims/actions/runs/{identifier}'),
 'jobs-before-original.json':gh(f'repos/yigini/soilfer-lims/actions/runs/{identifier}/jobs?per_page=100'),
 'comments-before-original.json':command(['gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/296/comments?per_page=100']),
 'accepted-scope-original.json':gh('repos/yigini/soilfer-lims/issues/comments/6160619940'),
 'label-definition-original.json':gh('repos/yigini/soilfer-lims/labels/ready-for-audit'),
 'closing-refs-before-original.json':command(['gh','pr','view','296','--repo','yigini/soilfer-lims','--json','closingIssuesReferences'])}
pr=json.loads(before['pr-before-original.json']);ci=json.loads(before['run-before-original.json']);jobs=json.loads(before['jobs-before-original.json'])['jobs']
comments=[comment for page in json.loads(before['comments-before-original.json']) for comment in page]
assert pr['state']=='open' and pr['head']['sha']==head and pr['base']['sha']==base
assert pr['body']==(wp/'issue214-policy-owner-source-pr-update/pr-body-successor.md').read_text(encoding='utf8')
assert json.loads(before['main-before-original.json'])['object']['sha']==base
assert ci['status']=='completed' and ci['conclusion']=='success' and ci['head_sha']==head and ci['run_attempt']==1 and ci['event']=='pull_request'
assert len(jobs)==1 and jobs[0]['conclusion']=='success'
assert {s['name']:s['conclusion'] for s in jobs[0]['steps']}==terminal['requiredSteps']
assert json.loads(before['closing-refs-before-original.json'])['closingIssuesReferences']==[]
answer=json.loads(before['accepted-scope-original.json'])
assert answer['performed_via_github_app']['slug']=='claude'
assert answer['body']==json.loads((wp/'issue214-policy-owner-answer-6160619940/answer-original.json').read_bytes())['body']
assert git('ls-remote','origin','refs/heads/codex/issue-214-control-charts').decode().split()[0]==head
assert git('rev-parse',head+'^{tree}').decode().strip()==tree
assert not any(label['name']=='ready-for-audit' for label in pr['labels'])
assert not any('Pip #214 exact-head audit request:' in c['body'] or 'Pip #214 policy-owner exact-head audit request:' in c['body'] for c in comments)
marker=f'Pip #214 policy-owner exact-head audit request: {head}'
evidence=f'https://github.com/yigini/soilfer-lims/tree/{audit}/WP/backlog-resume-20261013/{closed.name}'
notice=f'''{marker}

@claude: ready for final #214 source audit inside PR296 on exact head `{head}`, tree `{tree}`, base `{base}`. Your actual policy-schema scope [6160619940]({answer['html_url']}) is implemented. This scope acceptance is not a final audit PASS.

New automatic CI [{identifier}]({ci['html_url']}), attempt1, completed SUCCESS at {terminal['completedUtc']}:
```
Test Suites: 366 passed, 366 total
Tests:       5565 passed, 5565 total
```
All366 unique PASS paths exactly match discovery, zero failures/skips/pending. Client build, both actual candidate and supported baseline48d0e52 Docker builds, real disposable boundary and readiness ALLSUCCESS. [Closed original ZIP/API/step logs and every archive-entry/file hash]({evidence}). Standard CI hooks are unchanged and use neither local storage nor retention teardown fixtures. Disposable CI images are not production builds. Original failed CI38467368095 was never retried; its server365/5547/client/builds/boundary pass and Scenario6 readiness refusal remain retained honestly.

The digest-bound owner reuses unchanged canonical20261004085500 DDL (SHA256 fa6ef0563f80704dbc4ee08d90ceae91f632c912813ca037221b02aa03ef7b70), before214 in entrypoint/readiness. ABSENT adds both EMPTY policy tables/indexes and nullable Report.policyVersion only when missing. PRESENT canonical/Prisma equivalent is NO_OP0; partial/mismatched/tampered states refuse0 with **no normalization**, presets, override rows, backfill, catch or guard weakening. Read-only classification opens only a retained snapshot so original DB/WAL/SHM cannot acquire sidecars. Focused8/218 and full366/5565 local proofs retained exact frozen inputs; stock tests/assertions/scanner predicates unchanged. Actual empty-table policyService defaults and actual PRE_199 shipped entrypoint→PRESENT/NO_OP0→COMPLETE_214 passed with empty tables and original triple preservation.

Scientific directions6148143929/6152114918/6152507558, minimum20, Strict/prebinding, fixed-window/pre-release-start preservation and frozen history remain unchanged. PR lists every changed retained fixture/scanner line. Eventual production kit must show readonly policy PRESENT/NO_OP0 and account for retained snapshot disk allocation, otherwise STOP/report/no apply. Actual readonly chart-context/unstarted-unbound-LRM impact counts remain required for kit review before a fresh gate; no production collection occurred.

Please post actual "Audit passed: OK to merge and deploy" bound to this exact head, or concrete findings. No merge, kit, gate or production operation now. #214 and undeployed #206 remain open for actual post-deploy checks. After this request, Pip starts #209 in the same audit worktree. Historical completed releases, human drafts/cards and #103 no-apply boundary remain preserved.
'''
dest.mkdir()
for name,data in before.items():(dest/name).write_bytes(data)
(dest/'actual-audit-request.txt').write_bytes(notice.encode())
def post(path,method,request,name):
 file=dest/(name+'-request.json');file.write_bytes((json.dumps(request,indent=2)+'\n').encode())
 raw=command(['gh','api',path,'--method',method,'--input',str(file)])
 (dest/(name+'-response-original.json')).write_bytes(raw)
 return json.loads(raw)
labels=post('repos/yigini/soilfer-lims/issues/296/labels','POST',{'labels':['ready-for-audit']},'label')
assert any(label['name']=='ready-for-audit' for label in labels)
comment=post('repos/yigini/soilfer-lims/issues/296/comments','POST',{'body':notice},'notice')
assert comment['body']==notice
fresh=gh('repos/yigini/soilfer-lims/pulls/296');(dest/'pr-after-original.json').write_bytes(fresh)
assert json.loads(fresh)['head']['sha']==head and json.loads(fresh)['base']['sha']==base
record={'postedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'number':296,'head':head,'tree':tree,'base':base,
 'run':identifier,'closedEvidenceAudit':audit,'comment':comment['id'],'commentUrl':comment['html_url'],
 'readyNoticeSentOnce':True,'labelAddedOnce':True,'finalNativeHandoffSent':False,'actualAuditPass':False,
 'productionOperations':0,'ciDispatches':0,'nextAuthorizedWork':'Start #209 in same audit writer after this actual request'}
(dest/'delivery-record.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
pins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.iterdir() if p.is_file()}
(dest/'index.json').write_bytes((json.dumps(pins,indent=2)+'\n').encode())
lead=f'''## 2026-10-14 #214 corrected PR296 exact-head audit requested ONCE

Ready-for-audit label/comment{comment['id']} posted ONCE on exacthead{head}/tree{tree}/base{base} after actual CLOSED new CI{identifier} SUCCESS366/5565/all realDocker steps and exact PRE_199 owner/214 preservation proof. Original failed38467368095 never replays. Actual request/raw responses at `WP/backlog-resume-20261013/{dest.name}/index.json`; never duplicate. Final native handoff is UNSENT by this helper; use fresh target/focus/EMPTYcomposer observations and preserve human draftn. Actual final Claudio exact-head audit PASS remains pending and required before merge. Accepted owner6160619940/no normalization and kitPRESENT/NO_OP0+snapshotdisk/otherwiseSTOP hold. Per actual user direction begin209 now in SAME audit writer, no new chat/worker/worktree. No merge/kit/gate/production operation; #103noapply/historicalreleases/humancontent preserved.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for p in readmes:
 f=root/p;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(pins)+[(dest/'index.json').relative_to(root).as_posix(),Path(__file__).relative_to(root).as_posix()]+readmes
git('add','-f','--',*owned)
assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for p,pin in pins.items():assert hashlib.sha256(git('show',':'+p)).hexdigest()==pin['sha256'],p
git('commit','-m','audit(214): send corrected PR296 exact-head audit request once')
retained=git('rev-parse','HEAD').decode().strip()
for p,pin in pins.items():assert hashlib.sha256(git('show',retained+':'+p)).hexdigest()==pin['sha256'],p
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps(dict(record,auditCommit=retained,exactBlobsVerified=len(pins))))
