"""Fast-forward same PR with ONLY proven probe/test correction; automatic newCI, never retry."""
import datetime,hashlib,json,os,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
old='8d564c24f05a3b069bf027bbb7ba4f92cea597b0';base='6d750914d8565acdd496767a7dd935811b5a89b2';ref='refs/heads/codex/issue-214-control-charts'
dest=wp/'issue214-policy-post-probe-source-pr-update';index=wp/'issue214-policy-post-probe-source-pr.index'
assert not dest.exists() and not index.exists()
def command(args,data=None,env=None):return subprocess.run(args,cwd=root,input=data,env=env,capture_output=True,check=True).stdout
def git(*args,data=None,env=None):return command(['git',*args],data,env)
def gh(path):return command(['gh','api',path])
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
audit=git('rev-parse','HEAD').decode().strip()
closed=wp/'issue214-policy-ci38515104824-closed-step-analysis';analysis=json.loads((closed/'analysis.json').read_bytes())
assert analysis['actualOverallCi']=='FAILURE' and analysis['serverFullPassIndependentlyVerified'] and analysis['uniqueInventory366Exact']
assert git('show',audit+':'+(closed/'analysis.json').relative_to(root).as_posix())==(closed/'analysis.json').read_bytes()
pins=json.loads((closed/'closed-index.json').read_bytes())
for p,row in pins.items():assert hashlib.sha256(git('show',audit+':'+p)).hexdigest()==row['sha256'],p
focus=wp/'issue214-policy-post-probe-focused';summary=json.loads((focus/'summary.json').read_bytes())
assert summary['status']=='PASS' and summary['suites']==summary['passedSuites']==8 and summary['tests']==summary['passedTests']==219
before=json.loads((focus/'source-before.json').read_bytes());assert before==json.loads((focus/'source-after.json').read_bytes())
assert all(hashlib.sha256((root/p).read_bytes()).hexdigest()==h for p,h in before.items())
previous=json.loads((wp/'issue214-policy-owner-full/source-after.json').read_bytes());app=analysis['onlyChangedFrozenPaths']
assert sorted(p for p in before if before[p]!=previous[p])==app and len(app)==2
prraw=gh('repos/yigini/soilfer-lims/pulls/296');pr=json.loads(prraw)
assert pr['state']=='open' and pr['head']['sha']==old and pr['base']['sha']==base
assert pr['body']==(wp/'issue214-policy-owner-source-pr-update/pr-body-successor.md').read_text(encoding='utf8')
assert json.loads(gh('repos/yigini/soilfer-lims/git/ref/heads/main'))['object']['sha']==base
ci=json.loads(gh('repos/yigini/soilfer-lims/actions/runs/38515104824'));assert ci['status']=='completed' and ci['conclusion']=='failure' and ci['head_sha']==old and ci['run_attempt']==1
assert git('ls-remote','origin',ref).decode().split()[0]==old and git('rev-parse',ref).decode().strip()==old
dest.mkdir();(dest/'pr-before-original.json').write_bytes(prraw)
env=dict(os.environ,GIT_INDEX_FILE=str(index));git('read-tree',old,env=env)
for p in app:
 data=(root/p).read_bytes().replace(b'\r\n',b'\n');blob=git('hash-object','-w','--stdin',data=data).decode().strip()
 git('update-index','--add','--cacheinfo','100644,'+blob+','+p,env=env)
tree=git('write-tree',env=env).decode().strip();assert git('diff','--name-only',old,tree).decode().splitlines()==app
assert len(git('diff','--name-only',base,tree).decode().splitlines())==59 and not git('diff','--name-only',old,tree,'--','WP').strip()
assert git('show',tree+':.gitattributes')==git('show',old+':.gitattributes')
assert git('show',tree+':server/tests/contracts/issue_214_lab_policy_schema.test.js').startswith(git('show',old+':server/tests/contracts/issue_214_lab_policy_schema.test.js'))
head=git('commit-tree',tree,'-p',old,data=b'test(214): inspect post-start charts on retained policy snapshot\n\nPreserve original DB/WAL/SHM while keeping every readiness assertion and executing the shipped probe in regression.\n').decode().strip()
priorBody=pr['body'].replace('New head `'+old+'`','Previous head `'+old+'`',1)
body=f'''Post-start preservation probe correction, exact current head `{head}`, tree `{tree}`, base `{base}`;59 application paths, no WP/audit attribute changes. Only2 paths differ from previous8d564c24: real readiness rehearsal and one appended policy-schema regression. All runtime owner/schema/scientific/prebinding/history/policy/scanner source remains byte-identical.

Original new CI38515104824 attempt1 remains **FAILED** and was never retried: actual closed server366/5565, client, both real Docker builds and boundary passed. PRE_199 shipped entrypoint reachedhealth and policy-before-chart checks; the following new post-start proof failed its composite preservation assertion. [Original ZIP/API/every archive-entry hash and exact step logs](https://github.com/yigini/soilfer-lims/tree/{audit}/WP/backlog-resume-20261013/issue214-policy-ci38515104824-closed-step-analysis). A retained new owned reproduction proves secondary original-file readonly chart/count inspections create WAL/SHM while all P/NO_OP0/COMPLETE_214/empty-row assertions pass. This is an owned reproduction, not independent inspection of the discarded CI volume.

The corrected probe runs secondary chart/count inspections on the exact retained snapshot already returned by the policy owner. It keeps EVERY existing classification, zero-change, empty-row and original DB/WAL/SHM equality predicate, and additionally binds the snapshot's original triple hashes to the initial observation. The actual shipped entrypoint still runs on the genuine PRE_199 volume and must reach health/guard order; no preprocessing or weakened gate. The appended regression extracts and runs the ACTUAL embedded rehearsal programme against a new owned WAL-mode database without sidecars, verifying the complete original triple stays unchanged. Existing18 policy-schema cases and all stock assertions remain unchanged.

Closed focused **8/8 suites219/219 tests PASS**, both scanners and stock bootstrap, exact8path inventory/full366discovery, all421 frozen inputs unchanged; all other419 inputs identical to previous full stock CI. Prior full local366/5565 and actual stockCI366/5565 remain historical evidence for their exact8d source; no fresh local full5566 claim. New automatic real CI must independently pass **366/5566** plus client/bothDockerbuilds/boundary/readiness and fresh exact-head Claudio audit before merge. [Closed owned diagnostic and regression originals/hashes](https://github.com/yigini/soilfer-lims/tree/{audit}/WP/backlog-resume-20261013/issue214-policy-ci38515104824-closed-step-analysis/closed-index.json).

Accepted6160619940 scope is unchanged: canonical policy DDL only, no normalization/data rows/backfill/catch/guard weakening; production kit readonly must PRESENT/NO_OP0 with retainedsnapshotdiskaccounting, otherwiseSTOP/noapply. No production collection or operation. Both failed runs38467368095/e47b and38515104824/8d remain immutable. Final source audit request follows actual newgreenCI, then #209.

Current probe and added regression diff:
```diff
{git('diff',old,tree,'--',*app).decode()}
```

Prior implementation/scientific description and historical evidence follows:

'''+priorBody
assert len(body.encode())<60000
(dest/'pr-body-successor.md').write_bytes(body.encode());(dest/'update-request.json').write_bytes(json.dumps({'body':body}).encode())
record={'preparedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'auditSource':audit,'oldHead':old,'head':head,'tree':tree,'base':base,
 'applicationPaths':app,'sourcePathCount':59,'focusedSummary':summary,'requiredCiSuites':366,'requiredCiTests':5566,
 'runtimeSourceUnchanged':True,'productionOperations':0,'readyNoticeSent':False,'failedPriorRunsNeverReplayed':[38467368095,38515104824]}
(dest/'source-head.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
git('update-ref',ref,head,old);git('push','origin',ref+':'+ref)
assert git('ls-remote','origin',ref).decode().split()[0]==head
raw=command(['gh','api','repos/yigini/soilfer-lims/pulls/296','--method','PATCH','--input',str(dest/'update-request.json')])
(dest/'update-response-original.json').write_bytes(raw);updated=json.loads(raw)
assert updated['head']['sha']==head and updated['base']['sha']==base and updated['body']==body
refs=command(['gh','pr','view','296','--repo','yigini/soilfer-lims','--json','closingIssuesReferences'])
(dest/'closing-refs-original.json').write_bytes(refs);assert json.loads(refs)['closingIssuesReferences']==[]
assert git('rev-parse','HEAD').decode().strip()==audit
print(json.dumps(record))
