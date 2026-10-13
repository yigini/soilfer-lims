"""Consume the actual PR295 merge boundary once; never retry an uncertain result."""
import datetime
import hashlib
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[2]
work = Path(__file__).resolve().parent
dest = work / 'pr295-actual-merge-1a070'
head = '1a0702b3be410ac1dcdd9dc92f0f0c3dd2774a3a'
base = '959d17e11c357266f7c2a41b0c84ab76914c591e'
tree = '85350d14bdff5a607a3d2edc9615785842c9c94b'

def command(*args):
    return subprocess.check_output(args, cwd=root)

assert not dest.exists(), 'Consumed or uncertain merge: inspect GitHub, never replay.'
assert command('git', 'branch', '--show-current').strip() == b'audit/release-eb6de2e8'
assert not command('git', 'diff', '--cached', '--name-only').strip()
audit = command('git', 'rev-parse', 'HEAD').decode().strip()
assert audit.startswith('431f4ba8')
assert command('git', 'ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').decode().split()[0] == audit
pin = json.loads((work / 'pr295-actual-audit-pass-6146939836/index.json').read_text(encoding='utf-8'))
for name, detail in pin['files'].items():
    rel = 'WP/backlog-resume-20261013/pr295-actual-audit-pass-6146939836/' + name
    assert hashlib.sha256(command('git', 'show', audit + ':' + rel)).hexdigest() == detail['sha256']
dest.mkdir()

def retain(name, *args):
    raw = command('gh', *args)
    (dest / name).write_bytes(raw)
    return json.loads(raw)

verdict = retain('verdict-immediate-raw.json', 'api', 'repos/yigini/soilfer-lims/issues/comments/6146939836')
assert verdict['body'].startswith('Audit passed: OK to merge and deploy\n')
assert head in verdict['body'] and verdict['performed_via_github_app']['slug'] == 'claude'
assert verdict['created_at'] == verdict['updated_at'] == '2026-10-13T13:43:23Z'
comments = retain('comments-immediate-raw.json', 'api', '--paginate', '--slurp', 'repos/yigini/soilfer-lims/issues/295/comments?per_page=100')
assert comments[-1][-1]['id'] == 6146939836, 'A newer comment requires inspection before merge.'
run = retain('ci-immediate-raw.json', 'api', 'repos/yigini/soilfer-lims/actions/runs/38400174689')
assert run['status'] == 'completed' and run['conclusion'] == 'success' and run['head_sha'] == head and run['run_attempt'] == 1
checks = retain('checks-immediate-raw.json', 'api', 'repos/yigini/soilfer-lims/commits/' + head + '/check-runs')
assert checks['check_runs'] and all(c['status'] == 'completed' and c['conclusion'] in ('success', 'neutral', 'skipped') for c in checks['check_runs'])
view = retain('closing-references-immediate-raw.json', 'pr', 'view', '295', '--repo', 'yigini/soilfer-lims', '--json', 'headRefOid,baseRefOid,state,closingIssuesReferences')
assert view['state'] == 'OPEN' and view['headRefOid'] == head and view['baseRefOid'] == base and view['closingIssuesReferences'] == []
pr = retain('pr-immediate-raw.json', 'api', 'repos/yigini/soilfer-lims/pulls/295')
assert pr['state'] == 'open' and not pr['merged'] and pr['head']['sha'] == head and pr['base']['sha'] == base
assert pr['mergeable'] is True and pr['mergeable_state'] == 'clean'
main = retain('main-immediate-raw.json', 'api', 'repos/yigini/soilfer-lims/git/ref/heads/main')
assert main['object']['sha'] == base
request = dest / 'merge-request.json'
request.write_bytes((json.dumps({'sha': head, 'merge_method': 'merge'}) + '\n').encode('utf-8'))
(dest / 'mutation-started.json').write_bytes((json.dumps({'startedUtc': datetime.datetime.now(datetime.UTC).isoformat(), 'request': request.name, 'action': 'ONE PUT PR295 merge', 'neverRetry': True}) + '\n').encode('utf-8'))
result = subprocess.run(['gh', 'api', 'repos/yigini/soilfer-lims/pulls/295/merge', '--method', 'PUT', '--input', str(request)], cwd=root, capture_output=True)
(dest / 'merge-response-raw.json').write_bytes(result.stdout)
(dest / 'merge-response-stderr.txt').write_bytes(result.stderr)
assert result.returncode == 0, 'Merge outcome requires independent inspection; never rerun.'
merged = json.loads(result.stdout)
assert merged['merged'] is True
sha = merged['sha']
commit = retain('actual-merge-commit-raw.json', 'api', 'repos/yigini/soilfer-lims/git/commits/' + sha)
assert [p['sha'] for p in commit['parents']] == [base, head], 'Unexpected live base: retain and stop.'
assert commit['tree']['sha'] == tree
after = retain('pr-actual-merged-raw.json', 'api', 'repos/yigini/soilfer-lims/pulls/295')
assert after['merged'] is True and after['merge_commit_sha'] == sha and after['head']['sha'] == head
current = retain('main-actual-merged-raw.json', 'api', 'repos/yigini/soilfer-lims/git/ref/heads/main')
assert current['object']['sha'] == sha
issue = retain('issue-206-after-raw.json', 'api', 'repos/yigini/soilfer-lims/issues/206')
assert issue['state'] == 'open'
after_view = retain('closing-references-after-raw.json', 'pr', 'view', '295', '--repo', 'yigini/soilfer-lims', '--json', 'state,headRefOid,closingIssuesReferences')
assert after_view['state'] == 'MERGED' and after_view['closingIssuesReferences'] == []
runs = retain('main-ci-open-boundary-raw.json', 'api', 'repos/yigini/soilfer-lims/actions/runs?head_sha=' + sha + '&event=push&per_page=100')
record = dict(observedUtc=datetime.datetime.now(datetime.UTC).isoformat(), status='MERGED_ACTUAL_AUDITED_HEAD',
    pr=295, issue=206, sourceHead=head, sourceTree=tree, priorMain=base, actualMerge=sha,
    mergedAt=after['merged_at'], parents=[base, head], mergedTreeEqualsAuditedSource=True,
    actualAuditCommentId=6146939836, actualAuditEvidenceCommit=audit, prCi=38400174689,
    mainCi=[dict(id=r['id'], status=r['status'], conclusion=r['conclusion'], head=r['head_sha'], url=r['html_url']) for r in runs['workflow_runs']],
    mainCiLogsCollected=False, issue206State='open', closingIssuesReferences=[],
    deploymentPerformed=False, productionOperations=0, nativeAcknowledgementSent=False,
    nativeBoundary='Human draft observed in another Claude chat; zero input, draft preserved.', files={})
for path in dest.iterdir():
    data = path.read_bytes()
    record['files'][path.name] = dict(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
(dest / 'index.json').write_bytes((json.dumps(record, indent=2) + '\n').encode('utf-8'))
checkpoint = ('## 2026-10-13 PR295 actual exact-head PASS and verified merge\n\n'
    'Claudio posted **Audit passed: OK to merge and deploy** on PR295/6146939836 at 13:43:23 UTC, binding source `' + head + '`. '
    'PR295 was merged once under YY standing automatic-after-review go at ' + after['merged_at'] + ' as `' + sha + '`, with parents `' + base + '` and `' + head + '`. '
    'The actual merged tree equals audited tree `' + tree + '`. Exact PR CI38400174689 remains SUCCESS (362 suites / 5508 tests, client and actual Docker boundary/readiness). '
    'Actual verdict and fresh checks are pushed at `' + audit + '` in `WP/backlog-resume-20261013/pr295-actual-audit-pass-6146939836`; merge originals and hashes are in `pr295-actual-merge-1a070/index.json`. '
    'Main CI is observed as metadata only until completion; no active logs are represented as complete. #206 stays OPEN with empty closing references for actual post-deploy Claudio closure. '
    'No release, kit, gate or production operation. The current Claude window contained a human draft in another chat, so no native acknowledgement was sent and all drafts/cards remain untouched. '
    '#214 scientific/data-model questions must be raised with Claudio before source implementation. #103 remains explicit read-only/injected collection only, with no production connection or apply go. '
    'All completed operations/helpers/ready notices/final handoff remain immutable and must never replay.\n\n')
readmes = [root / 'WP/audit-release-eb6de2e8/README.md', root / 'WP/runtime-recovery-kobo/README.md']
for path in readmes:
    path.write_bytes(checkpoint.encode('utf-8') + path.read_bytes())
paths = [p.relative_to(root).as_posix() for p in dest.iterdir()] + [Path(__file__).relative_to(root).as_posix()] + [p.relative_to(root).as_posix() for p in readmes]
subprocess.check_call(['git', 'add', '-f', '--', *paths], cwd=root)
assert set(command('git', 'diff', '--cached', '--name-only').decode().splitlines()) == set(paths)
for name, detail in record['files'].items():
    assert hashlib.sha256(command('git', 'show', ':' + (dest / name).relative_to(root).as_posix())).hexdigest() == detail['sha256']
print(json.dumps({k:v for k,v in record.items() if k != 'files'}, indent=2))
