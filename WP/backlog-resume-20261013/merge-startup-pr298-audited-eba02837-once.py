"""ONE audited source merge, retaining intent and outcome; never retry."""
import datetime
import hashlib
import json
import os
import pathlib
import subprocess

R = pathlib.Path(__file__).resolve().parents[2]
D = R / 'WP/startup-order-readiness-20261015'
P = D / 'pr298-actual-audit-pass-6195167175-once'
O = D / 'pr298-actual-merge-eba02837-once'
AUDIT = '7745763154d1ce5003245e884cfcc22ad221f55d'
HEAD = 'eba02837eaa2ab797cad0572fecada686f660346'
TREE = '676b01e71211786d1aeace50f19a0b2c9f9c482e'
BASE = 'cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367'
RUN = 38738769335
VERDICT = 6195167175

def run(argv):
    p = subprocess.run(argv, cwd=R, capture_output=True)
    if p.returncode:
        raise RuntimeError(p.stderr.decode('utf-8', 'replace'))
    return p.stdout

def git(*args):
    return run(['git', '-c', 'core.longpaths=true', *args])

def sha(value):
    return hashlib.sha256(value).hexdigest()

def put(name, value):
    with (O / name).open('xb') as f:
        f.write(value)
        f.flush()
        os.fsync(f.fileno())

def js(name, value):
    put(name, (json.dumps(value, indent=2) + '\n').encode())

assert not O.exists(), 'Consumed or uncertain merge boundary; inspect, NEVER replay.'
assert git('rev-parse', 'HEAD').decode().strip() == AUDIT
assert git('branch', '--show-current').decode().strip() == 'audit/release-eb6de2e8'
assert not git('diff', '--cached', '--name-only').strip()
assert git('ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').decode().split()[0] == AUDIT
pin = json.loads((P / 'pass-record.json').read_bytes())
assert pin['status'] == 'ACTUAL_EXACT_HEAD_SOURCE_AUDIT_PASS' and pin['head'] == HEAD and pin['verdictId'] == VERDICT
for item in json.loads((P / 'publication-index.json').read_bytes())['files']:
    value = git('show', AUDIT + ':' + item['path'])
    assert sha(value) == item['sha256'] and len(value) == item['length']
    assert git('rev-parse', AUDIT + ':' + item['path']).decode().strip() == item['gitBlobOid']
frozen = json.loads((D / 'full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes())
assert len(frozen) == 1333 and all(sha((R / p).read_bytes()) == v for p, v in frozen.items())
source = json.loads((D / 'source-only-pr373-preparation-once/review-ref.json').read_bytes())['sourceBindings']
assert len(source) == 36 and set(git('diff', '--name-only', BASE, HEAD).decode().splitlines()) == set(source)
for path, item in source.items():
    value = git('show', HEAD + ':' + path)
    assert value == (R / path).read_bytes() and sha(value) == item['sha256'] and len(value) == item['length']
    assert git('rev-parse', HEAD + ':' + path).decode().strip() == item['gitBlobOid']
O.mkdir()
def retain(name, endpoint, pages=False):
    value = run(['gh', 'api'] + (['--paginate', '--slurp'] if pages else []) + [endpoint])
    put(name, value)
    return json.loads(value)

verdict = retain('verdict-immediate-original.json', f'repos/yigini/soilfer-lims/issues/comments/{VERDICT}')
assert verdict['body'] == json.loads((P / 'actual-verdict-original.json').read_bytes())['body']
assert verdict['performed_via_github_app']['slug'] == 'claude' and verdict['performed_via_github_app']['id'] == 1236702
assert verdict['created_at'] == verdict['updated_at'] == '2026-10-15T14:59:59Z'
comments = [c for page in retain('comments-immediate-original.json', 'repos/yigini/soilfer-lims/issues/298/comments?per_page=100', True) for c in page]
assert [c['id'] for c in comments] == [6193369476, VERDICT], 'Inspect newer findings first.'
assert not any(retain('reviews-immediate-original.json', 'repos/yigini/soilfer-lims/pulls/298/reviews?per_page=100', True))
assert not any(retain('coordination-immediate-original.json', 'repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-15T13:35:00Z&per_page=100', True))
scope = retain('scope-immediate-original.json', 'repos/yigini/soilfer-lims/issues/comments/6189025975')
assert scope['body'] == json.loads((P / 'scope-original.json').read_bytes())['body']
assert scope['performed_via_github_app']['slug'] == 'claude'
ci = retain('ci-immediate-original.json', f'repos/yigini/soilfer-lims/actions/runs/{RUN}')
assert ci['status'] == 'completed' and ci['conclusion'] == 'success' and ci['head_sha'] == HEAD and ci['run_attempt'] == 1
jobs = retain('jobs-immediate-original.json', f'repos/yigini/soilfer-lims/actions/runs/{RUN}/jobs?per_page=100')['jobs']
assert len(jobs) == 1 and jobs[0]['status'] == 'completed' and jobs[0]['conclusion'] == 'success'
assert all(s['status'] == 'completed' and s['conclusion'] == 'success' for s in jobs[0]['steps'])
terminal = json.loads((D / 'pr298-ci38738769335-closed-originals-once/closed-record.json').read_bytes())
assert {s['name']: s['conclusion'] for s in jobs[0]['steps']} == terminal['requiredSteps']
checks = retain('checks-immediate-original.json', f'repos/yigini/soilfer-lims/commits/{HEAD}/check-runs')['check_runs']
assert checks and all(c['status'] == 'completed' and c['conclusion'] == 'success' for c in checks)
assert any(c['name'] == 'Test & Build' for c in checks)
main_ci = retain('prior-main-ci-immediate-original.json', 'repos/yigini/soilfer-lims/actions/runs/38636615469')
assert main_ci['head_sha'] == BASE and main_ci['status'] == 'completed' and main_ci['conclusion'] == 'success'
view = run(['gh', 'pr', 'view', '298', '--repo', 'yigini/soilfer-lims', '--json', 'state,headRefOid,baseRefOid,closingIssuesReferences'])
put('closing-refs-immediate-original.json', view)
view = json.loads(view)
assert view['state'] == 'OPEN' and view['headRefOid'] == HEAD and view['baseRefOid'] == BASE and view['closingIssuesReferences'] == []
assert git('ls-remote', 'origin', 'refs/heads/codex/startup-readiness-shared-context').decode().split()[0] == HEAD
pr = retain('pr-immediate-original.json', 'repos/yigini/soilfer-lims/pulls/298')
assert pr['state'] == 'open' and not pr['merged'] and pr['head']['sha'] == HEAD and pr['base']['sha'] == BASE
assert pr['mergeable'] is True and pr['mergeable_state'] == 'clean'
assert pr['body'] == (D / 'source-only-pr373-created-once/pr-body-original.md').read_text(encoding='utf-8')
assert retain('main-immediate-original.json', 'repos/yigini/soilfer-lims/git/ref/heads/main')['object']['sha'] == BASE
js('merge-request.json', {'sha': HEAD, 'merge_method': 'merge'})
js('mutation-started.json', {'startedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'action': 'ONE SHA-guarded PUT PR298 merge', 'neverRetry': True})
result = subprocess.run(['gh', 'api', 'repos/yigini/soilfer-lims/pulls/298/merge', '--method', 'PUT', '--input', str(O / 'merge-request.json')], cwd=R, capture_output=True)
put('merge-response-original.json', result.stdout)
put('merge-response-stderr.txt', result.stderr)
js('merge-command-exit.json', {'returncode': result.returncode})
assert result.returncode == 0, 'Unknown mutation outcome; inspect independently, NEVER replay.'
merged = json.loads(result.stdout)
assert merged['merged'] is True
merge = merged['sha']
commit = retain('actual-merge-commit-original.json', f'repos/yigini/soilfer-lims/git/commits/{merge}')
assert [p['sha'] for p in commit['parents']] == [BASE, HEAD], 'Unexpected live base; retain and stop.'
assert commit['tree']['sha'] == TREE
after = retain('pr-merged-original.json', 'repos/yigini/soilfer-lims/pulls/298')
assert after['merged'] and after['merge_commit_sha'] == merge and after['head']['sha'] == HEAD
assert after['body'] == pr['body']
assert retain('main-merged-original.json', 'repos/yigini/soilfer-lims/git/ref/heads/main')['object']['sha'] == merge
view = run(['gh', 'pr', 'view', '298', '--repo', 'yigini/soilfer-lims', '--json', 'state,headRefOid,closingIssuesReferences'])
put('closing-refs-after-original.json', view)
assert json.loads(view)['state'] == 'MERGED' and json.loads(view)['closingIssuesReferences'] == []
for issue in [206, 214, 209]:
    assert retain(f'issue{issue}-after-original.json', f'repos/yigini/soilfer-lims/issues/{issue}')['state'] == 'open'
runs = retain('main-ci-opening-original.json', f'repos/yigini/soilfer-lims/actions/runs?head_sha={merge}&event=push&per_page=100')['workflow_runs']
record = {'observedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'status': 'MERGED_ACTUAL_AUDITED_SOURCE_ONCE',
    'pr': 298, 'sourceHead': HEAD, 'sourceTree': TREE, 'priorMain': BASE, 'actualMerge': merge, 'mergedAt': after['merged_at'],
    'parents': [BASE, HEAD], 'mergedTreeEqualsAuditedSource': True, 'actualAuditCommentId': VERDICT,
    'actualAuditEvidenceCommit': AUDIT, 'prCi': RUN, 'closingIssuesReferences': [], 'deploymentIssuesStillOpen': [206, 214, 209],
    'all1333FrozenInputsUnchanged': True, 'all36SourceBindingsVerified': True,
    'mainCi': [{'id': r['id'], 'head': r['head_sha'], 'event': r['event'], 'attempt': r['run_attempt'], 'status': r['status'], 'conclusion': r['conclusion'], 'url': r['html_url']} for r in runs],
    'mainCiLogsCollected': False, 'mainCiPassClaimed': False, 'nativeAcknowledgementSent': False,
    'messagesSent': 0, 'productionOperations': 0, 'deploymentPerformed': False, 'buildOrProofPerformed': False,
    'nextBoundary': 'Observe ONE automatic main push CI, never dispatch/retry. On actual complete green retain full originals. NEW app image/tooling all-hash review/R4 fresh computed requirement PLUS10GB before EACH build/proof/NEW proof root; never cde8/B5/100000 retry. R1 no proofDB removal pendingYY; all science/refusal/report/hash/copyrace/600/805/forward-only/no103/history/human guards remain.'}
js('merge-record.json', record)
lead = f'''## 2026-10-15 PR298 actual source merge ONCE after exact-head PASS

Actual Claude-app final source-only PASS6195167175 at14:59:59UTC retained7745763154d1ce5003245e884cfcc22ad221f55d. ONE fresh SHA-guarded merge at{after['merged_at']} created main{merge}, parents{BASE}+{HEAD}, tree{TREE} EXACT audited source. All1333 frozen inputs/36 source bindings/originalbody/closed PRCI3735679+ALLDocker/fresh main+base+head/verdict/no later findings checked. Full actual merge APIs/intent/request/response at WP/startup-order-readiness-20261015/{O.name}/merge-record.json. Observe ONE automatic main push CI; opening API only/no completed logs/PASS claim/dispatch/retry. Source merge is not production600s/805 qualification. NEW app image, NEW tooling all-hash Claudio review, fresh R4 computed requirement PLUS10GB before EACH build/proof and NEW proof root required. Never cde8/B5/100000 retry/proofDB removal pendingYY/duplicate ready-audit-ACK. Deployment issues206214209 stayOPEN/closingrefs[]; no build/proof/kit/gate/deploy/production operation/no103. All science/refusal/report/hash/race/R1-R5/forward-only/history/human protections remain. Same audit writer/branch; no checkout/worktree change.

'''
readmes = [R / 'WP/audit-release-eb6de2e8/README.md', R / 'WP/runtime-recovery-kobo/README.md']
for p in readmes:
    p.write_bytes(lead.encode() + p.read_bytes())
paths = sorted(O.iterdir()) + [pathlib.Path(__file__)] + readmes
bindings = []
for p in paths:
    value = p.read_bytes()
    bindings.append({'path': p.relative_to(R).as_posix(), 'length': len(value), 'sha256': sha(value),
        'gitBlobOid': hashlib.sha1(('blob ' + str(len(value)) + '\0').encode() + value).hexdigest()})
index = O / 'publication-index.json'
index.write_text(json.dumps({'baseAudit': AUDIT, 'status': record['status'], 'files': bindings}, indent=2), encoding='utf-8')
paths.append(index)
names = [p.relative_to(R).as_posix() for p in paths]
git('-c', 'core.autocrlf=false', 'add', '-f', '--', *names)
assert set(git('diff', '--cached', '--name-only').decode().splitlines()) == set(names)
staged = git('write-tree').decode().strip()
for p, name in zip(paths, names):
    value = git('show', staged + ':' + name)
    assert value == p.read_bytes()
    assert hashlib.sha1(('blob ' + str(len(value)) + '\0').encode() + value).hexdigest() == git('rev-parse', staged + ':' + name).decode().strip()
git('commit', '-m', 'Merge audited PR298 startup readiness head eba02837 once')
audit = git('rev-parse', 'HEAD').decode().strip()
git('push', 'origin', 'audit/release-eb6de2e8')
assert git('ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').decode().split()[0] == audit
print(json.dumps({'audit': audit, 'actualMerge': merge, 'mergedAt': after['merged_at'], 'status': record['status'], 'rawVerifiedOwnedBlobs': len(paths), 'mainCi': record['mainCi'], 'productionOperations': 0}))
