"""PREPARED ONLY. Create one source PR after retained full PASS and exact review ref; never replay uncertain outcomes."""
import datetime,hashlib,json,re,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent
review=json.loads((wp/'issue209-classified-source-only-review/review-ref.json').read_bytes());base=review['base'];head=review['reviewHead'];ref=review['reviewRef'];audit=review['auditSource']
def run(argv,data=None):return subprocess.run(argv,cwd=root,input=data,capture_output=True,check=True).stdout
def git(*a):return run(['git',*a])
def api(path):return json.loads(run(['gh','api',path]))
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and git('rev-parse','HEAD').strip()==audit.encode() and not git('diff','--cached','--name-only').strip()
assert api('repos/yigini/soilfer-lims/git/ref/heads/main')['object']['sha']==base and git('rev-parse',ref).strip()==head.encode()
assert not api('repos/yigini/soilfer-lims/pulls?state=all&head=yigini:codex/issue-209-order-revisions') and not git('ls-remote','origin',ref)
summary=review['fullLocalSummary'];assert summary['status']=='PASS' and summary['suites']==370 and summary['tests']==5642
frozen=json.loads((wp/'issue209-full-classified-ordinary/source-before.json').read_bytes())
for p,d in frozen.items():assert hashlib.sha256((root/p).read_bytes()).hexdigest()==d,p
dest=wp/'issue209-classified-source-pr-created';assert not dest.exists();dest.mkdir()
authorities={6163271808:'issue209-actual-decisions-6163271808',6166518424:'issue209-fraction-decisions-6166518424',6167740581:'issue209-approved-orphan-decisions-6167740581',6169628053:'issue209-keyed-receipt-decisions-6169628053'}
urls={}
for identifier,directory in authorities.items():
 raw=run(['gh','api',f'repos/yigini/soilfer-lims/issues/comments/{identifier}']);comment=json.loads(raw);original=json.loads((wp/directory/'answer-original.json').read_bytes())
 assert comment['id']==identifier and comment['body']==original['body'] and comment['user']['login']==original['user']['login']
 (dest/f'claudio-direction-{identifier}-original.json').write_bytes(raw);urls[identifier]=comment['html_url']
evidence=f'https://github.com/yigini/soilfer-lims/tree/{audit}/WP/backlog-resume-20261013'
literal=wp/'issue209-review-source-line-inventory-preparation/all-test-fixture-lines-original.diff';inventory=json.loads((literal.parent/'line-inventory.json').read_bytes())
testPaths=[p for p in review['paths'] if p.startswith('server/tests/')];assert len(testPaths)==87
diff=git('diff','--no-ext-diff','--unified=0',base,head,'--',*testPaths);assert diff==literal.read_bytes() and hashlib.sha256(diff).hexdigest()==inventory['completeLiteralDiffSha256']
lineTable='\n'.join('| `'+row['path']+'` | `'+ '; '.join(row['changedLineRanges'])+'` |' for row in inventory['testFixtureLineRanges'])
body=f'''Reasoned analysis revisions now reconcile the actual WorkItems, supersede all prior ACTIVE revisions in one transaction and retain their historical lines. New first, repeat and scientific executions bind a usable order line before INSERT. Existing attempts, lines, OPEN first-fill identities and recorded scientific history remain unchanged.

Both routes and initial intake use one order service under Claudio's [revision scope]({urls[6163271808]}). A changed command supplies a reason and complete normalized target. Multiple retained ACTIVE revisions are accepted for deliberate reconciliation; the installer does not clean them up, normalize rows or add a unique index over duplicates. New ACTIVE uniqueness is enforced by source-bound triggers. New order lines have a nullable immutable `workItemId`, validated at insertion as a scalar historical identifier. There is no WorkItem foreign key, because the released workflow can remove unstarted work while retaining its line identifier. New execution resolves a linked line first, otherwise exactly one legacy NULL-linked match within exactly one ACTIVE revision. Missing/ambiguous/multiple contexts return `409 ORDER_LINE_REQUIRED` without writes; retained historical OPEN first fill keeps its original identity.

The [fraction direction]({urls[6166518424]}) preserves every existing non-WAIVED SAND/SILT/CLAY owner, including completed work, with fixed companion lines alongside logical TEXTURE in the same reasoned transaction. Partial one/two-owner triples refuse `409 TEXTURE_FRACTION_OWNERS_INCOMPLETE` with missing codes and zero writes. No fraction owner, alias mapping, requiredAnalyses expansion, report or derivation change is introduced. Explicit removal of TEXTURE uses ordinary reasoned reconciliation.

Both keyed modes follow the [receipt contract]({urls[6169628053]}): one scoped receipt in the same transaction; identical replay returns the exact original public response without writes; differing reason/payload or cross-mode reuse returns409 without writes; no key creates no receipt. Mode participates in the normalized payload hash; the internal hash is excluded from replay responses without rewriting retained receipts.

**Runtime-reachable group, kept as refusal/impact evidence:** the released48d intake caught initial-order failures after creating WorkItems, so missing revisions or matching lines can persist. Current intake creates the initial revision and lines in the same transaction; injected initial revision and line INSERT failures now prove rollback of all new WorkItems/order rows/lines/audits. Under the [approved-orphan direction]({urls[6167740581]}), #209 keeps the approved-edit409 and scientific preflight before PROCESSING. It adds no amendment-side order step, backfill, relink or wider fallback. Read-only kit reporting distinguishes no ACTIVE revision, ACTIVE with no matching line, ambiguous line, multiple ACTIVE revisions, incomplete fraction owners and continuing/ambiguous OPEN reservations. It separately lists prospective new scientific-attempt refusals on noneditable measurement owners. Approved-amendment impact must be explicitly zero before proceeding; nonzero means STOP, show YY the sample list and a separately reviewed forward remedy. Nonzero ordinary open-work lists also require YY's sample list before a fresh gate. These collectors use explicit read-only connections and injected resolution, and have only been tested against owned data; no production count collection occurred.

**Fixture-only group, individually classified before corrections:** the original full run's650 failed assertion occurrences were matched individually to current/released creation paths. New positive numerical/reference fixtures declare exact legacy NULL order contexts on their existing analytical owners; negative missing-order/draft/scoped/operational/spectral/invalid-closure cases keep their intended refusals. Mandatory reason inputs were supplied at positive revision and injected rollback sites while deliberate missing-reason tests remain unchanged. A direct single-entry mock already had a usable ACTIVE order; an actual diagnostic found absent mock `req.headers` before the order service, while mounted Express supplies that object. Only its mock header context changed. Its original afterAll then hit the retained order-line FK: the two original teardown delete calls now run only when no retained attempt exists, preserving immutable parents and runtime FK guards. The PRE201 fixture explicitly declares only the digest-bound209 schema primitive it lacks; redundant schema additions to current spectral/publication fixtures were removed after their honest duplicate-column failures. Every other retained assertion and original literal fixture statement is recovered by removing the recorded additions. Scientific values, unit factors, raw aliases, methods, ownership, old attempt/line identities and strict scanner predicates remain intact.

**Changed legacy expectations:** exactly one: keyed analyses receipt count0→1, explicitly accepted in6169628053 because callers' keys must not be silently ignored. Eight meaningful added cases cover both modes' exact original response replay/all-table zero writes, different-reason409, cross-mode409 and no-key/no-receipt behavior. Four additional cases cover native initial revision/line rollback, read-only orphan cause breakdown and approved-orphan nonzeroSTOP/noneditable refusal. All other legacy assertions remain unchanged.

The source-bound additive installer and default entrypoint retain DRY0/APPLY1/NO_OP0, original DB/WAL/SHM preservation, missing/partial/tampered refusal, startup before jobs/listen and the policy/control-chart/container predecessor chain. No installer attempt or production operation has occurred for this PR.

Validation on exact source-only head `{head}`, tree `{review['reviewTree']}`, base `{base}`:

- Closed full ordinary local run: **370/370 suites and5,642/5,642 tests passed**, zero failed/pending/todo; all370 paths match discovery. Both ordinary setups, stock assertions, maxWorkers1/workerIdleMemoryLimit512MB and blank local NODE_OPTIONS retained. All1,327 frozen source/shared/generated-Prisma/scenario/template inputs stayed unchanged. Only the stock-generated help manifest is declared a mutable output, with complete original BEFORE and AFTER bytes/hashes retained. Local storage supplies byte-identical built client assets outside the hidden Windows checkout and retains owned DB teardown targets; real CI uses the stock setup without these local fixtures.
- All650 original failure occurrences independently reconciled to59 retained passing report Git blobs, preserving both repeated legacy titles as separate ordinals. The two early LOQ/policy passing children remain distinct from their honest failed aggregate. Earlier full650 failure, OOM/incomplete run, duplicate-column, fixture query typo, header diagnostic, FK teardown and proof/config/transport failures remain honestly retained and are never relabelled or replayed.
- Existing209 client build/lint/desktop/mobile/keyboard evidence remains retained; this correction series changes no client component or locale beyond that already tested source. This local full result is not stock PR CI or Claudio's final audit PASS. Stock CI must run ordinary npm test, client build, both actual candidate and supported baseline48d0e52 Docker builds, and real disposable boundary/readiness acceptance. Actual green CI and Claudio's exact current-head audit PASS are required before merge.

[Full closed original report/logs/summary, source hashes and manifest snapshots]({evidence}/issue209-full-classified-ordinary); [650-occurrence ledger and59 passing report references]({evidence}/issue209-original-case-reconciliation-650).

<details><summary>Every changed retained test/fixture source line range</summary>

The full literal1653-line diff is [retained here]({evidence}/issue209-review-source-line-inventory-preparation/all-test-fixture-lines-original.diff), SHA256 `{inventory['completeLiteralDiffSha256']}`. It exactly equals the87 test/fixture paths in this PR. Each old/new changed line range is listed below; the diff includes every added/removed line, including helpers/global setup, explicit reason inputs and the one accepted receipt expectation.

| Test or fixture | Old/new changed line ranges |
|---|---|
{lineTable}

</details>

Refs #209. Keep the issue OPEN for deployment and Claudio's actual post-deploy check; no closing keyword. #206 and #214 are source-merged/green and still undeployed. A later batch requires each exact-head audit PASS, one exact-kit review with actual read-only impact lists, YY visibility and a fresh single-use gate under the standing go. No #103 apply or historical production operation is authorized here.
'''
assert len(body.encode())<60000
(dest/'pr-body-original.md').write_bytes(body.encode());request={'title':'feat(workflow): bind executions to reasoned order revisions','head':ref.removeprefix('refs/heads/'),'base':'main','body':body,'draft':False}
(dest/'create-request.json').write_bytes((json.dumps(request,indent=2)+'\n').encode());git('push','origin',ref+':'+ref);assert git('ls-remote','origin',ref).decode().split()[0]==head
raw=run(['gh','api','repos/yigini/soilfer-lims/pulls','--method','POST','--input',str(dest/'create-request.json')]);(dest/'create-response-original.json').write_bytes(raw);pr=json.loads(raw)
assert pr['state']=='open' and pr['head']['sha']==head and pr['base']['sha']==base and pr['body']==body
live=run(['gh','api',f"repos/yigini/soilfer-lims/pulls/{pr['number']}"]);(dest/'pr-live-original.json').write_bytes(live);assert json.loads(live)['head']['sha']==head
closing=run(['gh','pr','view',str(pr['number']),'--repo','yigini/soilfer-lims','--json','closingIssuesReferences']);(dest/'closing-refs-original.json').write_bytes(closing);assert json.loads(closing)['closingIssuesReferences']==[]
record={'createdUtc':datetime.datetime.now(datetime.UTC).isoformat(),'url':pr['html_url'],'number':pr['number'],'head':head,'tree':review['reviewTree'],'base':base,'auditSource':audit,'bodyBytes':len(body.encode()),'readyNoticeSent':False,'finalNativeHandoffSent':False,'auditPass':False,'productionOperations':0}
(dest/'creation-record.json').write_bytes((json.dumps(record,indent=2)+'\n').encode());print(json.dumps(record))
