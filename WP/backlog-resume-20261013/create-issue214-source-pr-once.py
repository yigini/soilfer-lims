"""Create one source PR after the retained full PASS and prepared review ref.

No audit-ready notice, CI dispatch, merge, release, kit, gate or production action.
If a remote response is uncertain, inspect GitHub instead of replaying this helper.
"""
import datetime, hashlib, json, subprocess, sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
review=json.loads((wp/'issue214-source-only-review/review-ref.json').read_bytes())
base=review['base'];head=review['reviewHead'];ref=review['reviewRef']

def run(argv,data=None):
    result=subprocess.run(argv,cwd=root,input=data,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if result.returncode:raise RuntimeError(result.stderr.decode('utf-8','replace'))
    return result.stdout
def git(*args,binary=False):
    value=run(['git',*args]);return value if binary else value.decode('utf-8').strip()
def api(path):return json.loads(run(['gh','api',path]))

assert git('branch','--show-current')=='audit/release-eb6de2e8' and not git('diff','--cached','--name-only')
assert git('rev-parse','HEAD')==review['auditSource'] and git('rev-parse',ref)==head
assert api('repos/yigini/soilfer-lims/git/ref/heads/main')['object']['sha']==base
assert not api('repos/yigini/soilfer-lims/pulls?state=all&head=yigini:codex/issue-214-control-charts')
assert not git('ls-remote','origin',ref)
summary=review['fullLocalSummary']
assert summary['status']=='PASS' and summary['suites']==365 and summary['tests']==5547
frozen=json.loads((wp/'issue214-full-fixture-corrected/source-before.json').read_bytes())
assert all(hashlib.sha256((root/path).read_bytes()).hexdigest()==digest for path,digest in frozen.items())
dest=wp/'issue214-source-pr-created'
assert not dest.exists();dest.mkdir()
authority=[]
originalAnswers={6148143929:'issue214-actual-decisions-6148143929/answer-original-raw.json',
                 6152114918:'issue214-late-binding-answer-6152114918/actual-answer-raw.json',
                 6152507558:'issue214-fixture-direction-6152507558/answer-actual-raw.json'}
for identifier in [6148143929,6152114918,6152507558]:
    raw=run(['gh','api',f'repos/yigini/soilfer-lims/issues/comments/{identifier}'])
    comment=json.loads(raw);original=json.loads((wp/originalAnswers[identifier]).read_bytes())
    assert comment['id']==identifier and comment['body']==original['body'] and comment['user']['login']==original['user']['login']
    (dest/f'claudio-direction-{identifier}-original.json').write_bytes(raw)
    authority.append(comment['html_url'])
fixturePaths=[path for path in review['paths'] if path.startswith('server/tests/')
              and path not in ['server/tests/contracts/issue_214_control_chart_rules.test.js',
                               'server/tests/contracts/issue_214_control_chart_integration.test.js',
                               'server/tests/contracts/issue_214_control_chart_ui.test.js',
                               'server/tests/fixtures/pre214-native-run-source.cjs']]
fixtureDiff=git('diff','--no-ext-diff','--unified=3',base,head,'--',*fixturePaths)
audit=review['auditSource'];evidence=f'https://github.com/yigini/soilfer-lims/tree/{audit}/WP/backlog-resume-20261013'
body=f'''Adds #214 control charts with immutable run-time scientific inputs, deliberate limit proposals, second-person approval and separate QC review obligations.

**Operational change:** Strict laboratories, and any context resolving to `CONTROL_CHART`, must bind served LRM lots before starting new runs, including Provisional series. An unbound position returns `422 QC_CHART_LOT_REQUIRED` naming the position; the same run can start once bound. `FIXED_WINDOW` laboratories and genuinely pre-release already-started runs retain their existing path. A started chart run cannot change its frozen lot or reference value.

The implementation follows Claudio's actual [scientific direction]({authority[0]}), [lot-binding direction]({authority[1]}) and [retained-fixture direction]({authority[2]}). Series are scoped by lab, analyte, method and reference lot. New starts freeze approved or provisional basis, policy/rule classification, deterministic observation order and exact measurement/value/reference identities. Corrections replace effective observations for future starts; historical evaluations and proposals retain their original inputs. R-4s evaluates only within one run; sequence rules use the frozen eligible chronology across runs. Provisional evaluations retain the fixed window and record multi-rules as not evaluated.

Baseline proposals use the arithmetic mean and sample SD (n-1), the frozen `qc.controlChartMinPoints` registry/policy value (shipped default 20), eligible passing observations and explicit excluded IDs with reasons. There is no automatic outlier removal. A named eligible approver must differ from the proposer; superseded sets and old evaluations remain readable. Strict adds review actions for 4-1s/10x; other presets use an empty review set. Stored legacy overrides missing `review` are read as [] without rewriting rows. Review obligations are idempotent by immutable evaluation and rule, scoped by laboratory, and resolved through append-only noted outcomes; they do not alter verdicts, block release, or reuse CRM NCR/sample-closure tasks.

The additive installer creates four tables, binds its migration source by digest and refuses partial, populated-unmarked or tampered states. Tests verify DRY 0/APPLY 1/immediate NO_OP 0, unchanged old rows and policies, immutable evidence guards, approved-set supersession, startup readiness before jobs/listen and fresh-Prisma normalization. The historical regression actually starts a run using the byte-pinned released pre214 service, then installs 214 normally; it does not fabricate old criteria.

The read-only impact collector uses an explicit read-only SQLite connection and injected policy/rule evaluation, with no default Prisma connection or pragmas. It has been tested only against owned disposable data. Before any eventual deployment gate, the kit must retain the **actual** lab/analyte/method contexts resolving to CONTROL_CHART and created-but-unstarted runs with unbound served LRM positions, for Claudio's review and YY's impact visibility. No production collection or operation occurred in this PR preparation.

Validation on source-only head `{head}` (tree `{review['reviewTree']}`, base `{base}`):
- Complete closed local server run: **Test Suites: 365 passed, 365 total** / **Tests:       5547 passed, 5547 total**, zero failed/skipped/pending. All 365 unique paths match the full discovery inventory; all 415 frozen source/fixture hashes stayed unchanged. Both ordinary database setups, stock assertions, single worker 512MB and blank local NODE_OPTIONS remained enabled. The retained local filesystem fixture serves byte-identical built assets and disposable uploads outside the hidden Windows checkout. Standard real PR CI must pass ordinary `npm test` without this fixture, then build the candidate and supported baseline 48d0e52 Docker images and run real disposable boundary/readiness acceptance.
- Corrected focused run: 12/12 suites and 175/175 tests pass, including all formerly failing suites and new chart/Strict-default contracts. Earlier failures and configuration refusals remain retained honestly and are never relabelled or replayed.
- Client production build and canonical lint pass: 0 errors and the same 14 baseline warnings. Actual detached Chromium inspections cover desktop 1440×1050 and mobile 390×844, plus keyboard lot selection/start, second-person approval and noted review resolution. These use the production components/CSS with injected owned synthetic API data. The first mobile overflow is retained; the corrected document 375px fits its 390px viewport.

[Closed originals, final summary, exact source/report hashes and browser evidence]({evidence}); `issue214-full-fixture-corrected-pass/index.json` indexes the complete local result. The approved Jest harness, existing CI heap, discovery and ordinary setup files remain enabled. No #214 final audit PASS is claimed; actual complete real CI and a new exact-head Claudio audit PASS are required before merge.

Retained fixture adjustments are explicit. The Native factory uses an ordinary FIXED_WINDOW override for its historical LRM assertions. `qcGateFixture` uses that context only for retained LRM cases; no-LRM cases keep their original policy version, and the new Strict/default test opts out of the override. The compatibility factory installs the normal 190/191/calculation/200/206/214 predecessors only for its Native current-schema case. Removing that conditional fixture context reproduces every original compatibility statement byte-for-byte. Original Native and compatibility assertions are unchanged. The policy editor expectation additionally checks the new empty `review` field; startup tests add 214 readiness/preservation assertions. The exact changed fixture and retained-test lines are below, including global setup, historical schema-gap and scanner-source registration.

<details><summary>Every changed retained fixture/test line</summary>

```diff
{fixtureDiff}
```

</details>

Refs #214. The issue stays open for deployment and Claudio's actual post-deploy check; this PR deliberately has no closing keyword. Existing #206 source merge remains undeployed. A later batch requires each exact-head audit PASS, one exact-kit audit and a fresh single-use gate under the standing go. This PR authorizes no historical production replay and no #103 apply.
'''
assert len(body.encode('utf-8'))<60000
(dest/'pr-body-original.md').write_bytes(body.encode())
request={'title':'feat(qc): freeze control chart limits and QC review evidence','head':ref.removeprefix('refs/heads/'),
         'base':'main','body':body,'draft':False}
(dest/'create-request.json').write_bytes((json.dumps(request,indent=2)+'\n').encode())
git('push','origin',ref+':'+ref)
assert git('ls-remote','origin',ref).split()[0]==head
raw=run(['gh','api','repos/yigini/soilfer-lims/pulls','--method','POST','--input',str(dest/'create-request.json')])
(dest/'create-response-original.json').write_bytes(raw)
pr=json.loads(raw)
assert pr['state']=='open' and pr['head']['sha']==head and pr['base']['sha']==base and pr['body']==body
assert pr['head']['ref']==request['head']
live=run(['gh','api',f"repos/yigini/soilfer-lims/pulls/{pr['number']}"])
(dest/'pr-live-original.json').write_bytes(live)
assert json.loads(live)['head']['sha']==head
closing=run(['gh','pr','view',str(pr['number']),'--repo','yigini/soilfer-lims','--json','closingIssuesReferences'])
(dest/'closing-refs-original.json').write_bytes(closing)
assert json.loads(closing)['closingIssuesReferences']==[]
record={'createdUtc':datetime.datetime.now(datetime.UTC).isoformat(),'url':pr['html_url'],'number':pr['number'],
        'head':head,'tree':review['reviewTree'],'base':base,'auditSource':audit,'readyNoticeSent':False,
        'finalNativeHandoffSent':False,'auditPass':False,'productionOperations':0}
(dest/'creation-record.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
print(json.dumps(record))
