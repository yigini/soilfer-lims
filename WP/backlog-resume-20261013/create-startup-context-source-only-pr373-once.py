"""Create one normal source PR; no ready notice, merge, build or production operation."""
import datetime, hashlib, json, pathlib, subprocess

R = pathlib.Path(__file__).resolve().parents[2]
D = R / 'WP/startup-order-readiness-20261015'
O = D / 'source-only-pr373-created-once'
review = json.loads((D / 'source-only-pr373-preparation-once/review-ref.json').read_bytes())
BASE = review['base']; HEAD = review['reviewHead']; REF = review['reviewRef']; AUDIT = review['auditSource']

def run(argv, data=None):
    p = subprocess.run(argv, cwd=R, input=data, capture_output=True)
    if p.returncode:
        raise RuntimeError(p.stderr.decode('utf-8', 'replace'))
    return p.stdout

def git(*args):
    return run(['git', '-c', 'core.longpaths=true', *args])

def api(path):
    return json.loads(run(['gh', 'api', path]))

assert not O.exists() and git('rev-parse', 'HEAD').decode().strip() == AUDIT
assert git('branch', '--show-current').decode().strip() == 'audit/release-eb6de2e8' and not git('diff', '--cached', '--name-only').strip()
assert git('rev-parse', REF).decode().strip() == HEAD
assert api('repos/yigini/soilfer-lims/git/ref/heads/main')['object']['sha'] == BASE
ci = api('repos/yigini/soilfer-lims/actions/runs?branch=main&event=push&per_page=1')['workflow_runs'][0]
assert ci['head_sha'] == BASE and ci['status'] == 'completed' and ci['conclusion'] == 'success'
assert not api('repos/yigini/soilfer-lims/pulls?state=all&head=yigini:codex/startup-readiness-shared-context')
assert not git('ls-remote', 'origin', REF)
frozen = json.loads((D / 'full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes())
assert all(hashlib.sha256((R / p).read_bytes()).hexdigest() == digest for p, digest in frozen.items())
for p, row in review['sourceBindings'].items():
    assert git('show', HEAD + ':' + p) == (R / p).read_bytes()
    assert hashlib.sha256((R / p).read_bytes()).hexdigest() == row['sha256']
authority = api('repos/yigini/soilfer-lims/issues/comments/6189025975')
original = json.loads((D / 'source-only-pr373-preparation-once/claudio-direction-6189025975-original.json').read_bytes())
assert authority['id'] == original['id'] and authority['body'] == original['body'] and authority['user']['login'] == original['user']['login']
assert authority['performed_via_github_app']['slug'] == 'claude'
history = api('repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-15T12:07:44Z&per_page=100')
assert all(c['id'] == 6191670687 for c in history), 'New coordination response: read before publishing.'
fixture_diff = git('diff', '--no-ext-diff', '--unified=3', BASE, HEAD, '--', 'server/tests/helpers/qcGateFixture.js', 'server/tests/helpers/workflowWriteScanner.js').decode()
evidence = f'https://github.com/yigini/soilfer-lims/tree/{AUDIT}/WP/startup-order-readiness-20261015'
body = f'''Startup currently repeats database integrity/FK checks and policy/chart snapshot work across 26 readiness stages. This performance-only change shares those results within one explicit startup context and uses one set query for order-revision impact, while preserving the existing reports and refusal conditions.

Follows Claudio's [corrected performance-only direction](https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6189025975). All existing integrity/FK checks, full-file hashes, migration-source digests, DB/WAL/SHM copy/race guards, refusal codes and triggers remain. Invalid stored analyses and continuing OPEN reservations remain reported; approved-amendment nonzero remains a separate kit/gate STOP. No schema migration or new startup STOP is introduced.

- One private readonly context is passed through every direct READY check and nested prerequisite. Earlier checks share a read transaction; policy, chart and order use the same owner-created retained copy. Full main/WAL byte hashes bind cached full pragma rows, and the owner's separate full DB/WAL/SHM checks still protect copying and races. Changed original/copy/source bytes invalidate results and use the existing owner refusal path.
- The chart classification is reused. Nested order checks stay on the captured copy and keep the final original-file `ORDER_REVISION_SNAPSHOT_CHANGED` guard, including an original-file change after policy capture but before the nested chart call.
- Every READY event adds `elapsed_ms` and `rss_bytes`. The startup owner closes the context before HTTP and on failure. There is no global Database prototype change. All 26 installers load the context dependency only on explicit opt-in; default CLI/import/install/dry-run paths retain ordinary database construction and existing output/error handling.
- Order impact uses one WorkItem LEFT JOIN Sample query with the original four owner fields and ordering. Full reports and the existing missing-Sample error remain equivalent. Fewer point lookups are verified; no wall-clock query speedup or production readiness improvement is claimed from synthetic timing.

Validation for exact head `{HEAD}` / tree `{review['reviewTree']}`, base `{BASE}`:

- Closed complete local ordinary run at 2026-10-15T12:52:22.721011UTC: **Test Suites: 373 passed, 373 total** / **Tests: 5679 passed, 5679 total**; zero failed/pending/todo. All 373 unique paths match discovery, all 1,333 frozen input hashes and visible assets remain unchanged. Both ordinary setups, stock assertions, one worker, 512000000-byte worker recycling and blank local NODE_OPTIONS remain enabled. Local Windows storage fixtures retain physical owned test files and serve byte-identical built assets/disposable uploads outside the hidden checkout. Standard CI uses none of these local retention/storage/testMatch fixtures and must run ordinary npm test with its unchanged configured heap, then the candidate and supported-baseline real Docker builds, real boundary rehearsal and deployment-readiness acceptance.
- Final focused run: 5 suites / 167 tests pass, including both suites that failed the original full run. New context contracts compare all 26 reports and refusal behavior with the legacy path; verify exactly one integrity check, one FK check, one retained policy snapshot and one chart classification; and cover owned WAL-mode absent/empty/genuinely nonempty WAL with an idle writer, original/copy races, retained-copy byte changes, migration digest changes, simple/full pragma views, readonly behavior, cross-start isolation and closure. All **370 preexisting current-main test files** are byte-identical. A 371-file unchanged manifest additionally includes the new unchanged telemetry test.
- The original full run remains honestly FAILED (371/373 suites, 5670/5672 tests). The isolated CLI-copy missing-dependency regression and scanner findings were corrected in new source; an initially failing earlier-race contract led to the pinned-copy correction. A later full attempt executed zero test bodies because the local retention fixture correctly rejected its stale directory pin; the final run used a new exact-bound fixture. All failures, originals and successors are retained; none is relabelled or replayed.

[Complete raw reports/logs/exit/config/command/inventory/source hashes, focused failures and successes]({evidence}). The final complete result is indexed by `full-pinned-copy-retention-bound-closed-pass-once/publication-index.json`; the application/source evidence by `private-context-closed-guards-pinned-copy-complete-publication-index.json`.

Fixture authority is explicit: `qcGateFixture` adds an opt-in `managedStartup` mode using the real workflow installer and existing guarded empty PT/NCR bootstrap; the default fixture is unchanged. New `startupImpactFixture` is digest-pinned, memory-only, admits one declared test caller and closed sample-count/orphan options, accepts no database path/connection/SQL/callback, and seals query-only after literal fixture construction. Caller/digest/capability negatives and passive SQLite execution tracing replace opaque SQL forwarding. Existing scanner predicates and assertions remain unchanged; only this narrow test-only registry binding is added. Exact changes to the two retained helpers follow.

<details><summary>Changed retained fixture/scanner lines</summary>

```diff
{fixture_diff}
```

</details>

This is a source PR and local-suite result. Actual complete PR CI and Claudio's final exact-head audit PASS are required before merge; current-main CI follows. A future release needs a NEW application image/build, NEW image-bound tooling/all-hash source review, fresh computed capacity plus 10GB before each build/proof, and a NEW proof root. Historical cde8/B5/100000 attempts remain consumed. The 600-second readiness and 805306368-byte runtime limits remain. No production operation, cleanup replay or #103 apply occurred. Refs #162; existing deployment issues stay open for actual post-deploy checks.
'''
assert len(body.encode()) < 60000
O.mkdir()
(O / 'pr-body-original.md').write_text(body, encoding='utf-8')
(O / 'claudio-direction-fresh-original.json').write_text(json.dumps(authority, indent=2), encoding='utf-8')
(O / 'coordination-history-before-create-original.json').write_text(json.dumps(history, indent=2), encoding='utf-8')
(O / 'main-ci-before-create-original.json').write_text(json.dumps(ci, indent=2), encoding='utf-8')
request = {'title': 'fix(server): share guarded readiness checks within startup', 'head': REF.removeprefix('refs/heads/'), 'base': 'main', 'body': body, 'draft': False}
request_file = O / 'create-request.json'
request_file.write_text(json.dumps(request, indent=2), encoding='utf-8')
git('push', 'origin', REF + ':' + REF)
assert git('ls-remote', 'origin', REF).decode().split()[0] == HEAD
raw = run(['gh', 'api', 'repos/yigini/soilfer-lims/pulls', '--method', 'POST', '--input', str(request_file)])
(O / 'create-response-original.json').write_bytes(raw)
pr = json.loads(raw)
assert pr['state'] == 'open' and pr['head']['sha'] == HEAD and pr['base']['sha'] == BASE and pr['body'] == body
live = run(['gh', 'api', f"repos/yigini/soilfer-lims/pulls/{pr['number']}"])
(O / 'pr-live-original.json').write_bytes(live)
assert json.loads(live)['head']['sha'] == HEAD
closing = run(['gh', 'pr', 'view', str(pr['number']), '--repo', 'yigini/soilfer-lims', '--json', 'closingIssuesReferences'])
(O / 'closing-refs-original.json').write_bytes(closing)
assert json.loads(closing)['closingIssuesReferences'] == []
record = {'createdUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'url': pr['html_url'], 'number': pr['number'],
    'head': HEAD, 'tree': review['reviewTree'], 'base': BASE, 'auditSource': AUDIT,
    'sourcePathCount': 36, 'readyNoticeSent': False, 'finalNativeHandoffSent': False,
    'auditPass': False, 'mergeOrProductionOperations': 0}
(O / 'creation-record.json').write_text(json.dumps(record, indent=2), encoding='utf-8')
assert git('rev-parse', 'HEAD').decode().strip() == AUDIT
print(json.dumps(record))
