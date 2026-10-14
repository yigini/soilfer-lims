"""Fast-forward SAME PR296 exactly once after retained full local proof; no CI replay."""
import datetime,hashlib,json,os,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
old='e47b842c2a7f6b4f06fa4c532f7460c01797821b';base='6d750914d8565acdd496767a7dd935811b5a89b2'
ref='refs/heads/codex/issue-214-control-charts';dest=wp/'issue214-policy-owner-source-pr-update';index=wp/'issue214-policy-owner-source-pr.index'
assert not dest.exists() and not index.exists()
def run(args,data=None,env=None):return subprocess.run(args,cwd=root,input=data,env=env,capture_output=True,check=True).stdout
def git(*args,data=None,env=None):return run(['git',*args],data,env)
def api(path):return run(['gh','api',path])
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
summary=json.loads((wp/'issue214-policy-owner-full/summary.json').read_bytes())
assert summary['status']=='PASS' and summary['exitCode']==0 and summary['suites']==summary['passedSuites']==366
assert summary['tests']==summary['passedTests']==5565 and summary['failed']==summary['failedSuites']==summary['pending']==0
report=json.loads((wp/'issue214-policy-owner-full/report-original.json').read_bytes())
assert all(case['status']=='passed' for suite in report['testResults'] for case in suite['assertionResults'])
assert report.get('numTodoTests',0)==0
frozen=json.loads((wp/'issue214-policy-owner-full/source-before.json').read_bytes())
assert frozen==json.loads((wp/'issue214-policy-owner-full/source-after.json').read_bytes())
assert all(hashlib.sha256((root/p).read_bytes()).hexdigest()==h for p,h in frozen.items())
retained=json.loads((wp/'issue214-policy-owner-full-pass/index.json').read_bytes())
audit=git('rev-parse','HEAD').decode().strip()
for p,row in retained.items():assert hashlib.sha256(git('show',audit+':'+p)).hexdigest()==row['sha256'],p
current=json.loads(api('repos/yigini/soilfer-lims/pulls/296'))
original=json.loads((wp/'issue214-policy-owner-answer-6160619940/pr-before-original.json').read_bytes())
assert current['state']=='open' and current['head']['sha']==old and current['base']['sha']==base and current['body']==original['body']
assert json.loads(api('repos/yigini/soilfer-lims/git/ref/heads/main'))['object']['sha']==base
assert git('ls-remote','origin',ref).decode().split()[0]==old and git('rev-parse',ref).decode().strip()==old
answer=json.loads(api('repos/yigini/soilfer-lims/issues/comments/6160619940'))
assert answer['body']==json.loads((wp/'issue214-policy-owner-answer-6160619940/answer-original.json').read_bytes())['body']
assert answer['performed_via_github_app']['slug']=='claude'
app=json.loads((wp/'issue214-policy-owner-draft-checkpoint/open-successor-metadata.json').read_bytes())['applicationPaths']
dest.mkdir();env=dict(os.environ,GIT_INDEX_FILE=str(index));git('read-tree',old,env=env)
pins=['server/prisma/migrations/20261004085500_add_lab_policy_settings/migration.sql text eol=lf','server/services/labPolicyMigrationSource.js text eol=lf']
for p in app:
    data=(root/p).read_bytes().replace(b'\r\n',b'\n')
    if p=='.gitattributes':data=git('show',old+':'+p).rstrip(b'\r\n')+b'\n'+('\n'.join(pins)+'\n').encode()
    blob=git('hash-object','-w','--stdin',data=data).decode().strip()
    git('update-index','--add','--cacheinfo','100644,'+blob+','+p,env=env)
tree=git('write-tree',env=env).decode().strip()
delta=git('diff','--name-only',old,tree).decode().splitlines();assert set(delta)==set(app)
assert not git('diff','--name-only',old,tree,'--','WP').strip()
canonical='server/prisma/migrations/20261004085500_add_lab_policy_settings/migration.sql'
assert hashlib.sha256(git('show',tree+':'+canonical)).hexdigest()=='fa6ef0563f80704dbc4ee08d90ceae91f632c912813ca037221b02aa03ef7b70'
head=git('commit-tree',tree,'-p',old,data=b'fix(214): own canonical policy schema before chart installation\n\nRefuse partial storage without normalization; preserve original DB/WAL/SHM on read-only classification.\n').decode().strip()
assert git('rev-parse',head+'^').decode().strip()==old
oldValidation='Validation on source-only head'
body=original['body'].replace(oldValidation,'Historical validation before the policy-owner correction on source-only head',1)
new=f'''Schema prerequisite correction accepted by Claudio in [6160619940]({answer['html_url']}) is included in this same PR. The original CI38467368095 attempt1 remains FAILED: server365/5547, client and both Docker builds/boundary passed; real readiness Scenario6 on PRE_199 refused `QC_CHART_PREREQUISITE_REQUIRED`. It was never retried.

The owner reuses ONLY unchanged canonical20261004085500 DDL, SHA256 fa6ef0563f80704dbc4ee08d90ceae91f632c912813ca037221b02aa03ef7b70, before214 in the default entrypoint and startup readiness. ABSENT creates empty LabPolicy/Override and canonical indexes, plus nullable Report.policyVersion only if absent. PRESENT exact canonical or Prisma-created equivalent is NO_OP0. Every partial table/index/column, wrong Report type, and source tamper refuses0; **no normalization**, policy data writes, presets, overrides, backfill, or missing-table catches. Read-only classification hashes/copies the original DB/WAL/SHM into a retained snapshot and opens only that copy, because ordinary SQLite readonly opens can create sidecars. Existing policy/override/report/history bytes stay unchanged. Actual policyService with empty tables resolves shipped Strict CONTROL_CHART and minimum20 without inserting rows. Scientific rules, prebinding and frozen history are unchanged.

New head `{head}`, tree `{tree}`, base `{base}`: full local **366/366 suites and5565/5565 tests PASS**, no failures/skips/pending/todo, all366 unique paths exactly match discovery and all421 frozen inputs unchanged. Focused8/8 suites218/218 tests PASS includes actual active-WAL refusal and exact row/sidecar preservation. Both ordinary setups/assertions and approved worker512MB/blank local NODE_OPTIONS remain. Local visible-assets and retention-only teardown fixtures preserve held evidence; standard real CI retains its unchanged hooks and uses neither fixture. The two earlier focused failures are retained honestly. A new automatic PR CI, all real Docker checks, and fresh exact-head Claudio audit PASS remain mandatory before merge.

The real Docker acceptance now asserts PRE_199 policy ABSENT/DRY0, the shipped default entrypoint reaching COMPLETE_214 in policy-before-chart order, empty policy tables and immediate module NO_OP0 with original DB/WAL/SHM equality. The eventual production kit must include a read-only policy dry run showing PRESENT/NO_OP0 (production carries219), account for its retained snapshot allocation, and STOP/report any other classification without apply. No production collection or operation occurred. Existing actual chart-context/prebinding impact counts remain required before the kit gate.

[Closed source-bound local originals and hashes](https://github.com/yigini/soilfer-lims/tree/{audit}/WP/backlog-resume-20261013/issue214-policy-owner-full-pass).

Additional retained fixture/scanner lines are explicit; no scanner predicate or writer exemption was weakened:

```diff
{git('diff',old,tree,'--','server/tests/contracts/deployment_readiness_bootstrap.test.js','server/tests/helpers/workflowWriteScanner.js').decode()}
```

'''
body=new+body
assert len(body.encode())<60000
(dest/'pr-body-successor.md').write_bytes(body.encode())
(dest/'update-request.json').write_bytes(json.dumps({'body':body}).encode())
record={'preparedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'auditSource':audit,'oldHead':old,'head':head,'tree':tree,'base':base,
 'applicationPaths':app,'fullSummary':summary,'productionOperations':0,'readyNoticeSent':False}
(dest/'source-head.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
git('update-ref',ref,head,old)
git('push','origin',ref+':'+ref)
assert git('ls-remote','origin',ref).decode().split()[0]==head
raw=run(['gh','api','repos/yigini/soilfer-lims/pulls/296','--method','PATCH','--input',str(dest/'update-request.json')])
(dest/'update-response-original.json').write_bytes(raw)
pr=json.loads(raw);assert pr['head']['sha']==head and pr['body']==body and pr['base']['sha']==base
closing=run(['gh','pr','view','296','--repo','yigini/soilfer-lims','--json','closingIssuesReferences'])
(dest/'closing-refs-original.json').write_bytes(closing);assert json.loads(closing)['closingIssuesReferences']==[]
assert git('rev-parse','HEAD').decode().strip()==audit
print(json.dumps(record))
