"""Retain the actual PR298 source audit PASS once; no GitHub mutation."""
import datetime
import hashlib
import json
import pathlib
import subprocess

R = pathlib.Path(__file__).resolve().parents[2]
D = R / 'WP/startup-order-readiness-20261015'
O = D / 'pr298-actual-audit-pass-6195167175-once'
AUDIT = '9aa9f2959fd010293fc2fd88ccfdd5b1f0113e63'
HEAD = 'eba02837eaa2ab797cad0572fecada686f660346'
TREE = '676b01e71211786d1aeace50f19a0b2c9f9c482e'
BASE = 'cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367'
CI_AUDIT = '69a3149ffbb1e870e9ff064cb058ee9833bc299b'
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

assert not O.exists(), 'Consumed boundary; never replay.'
assert git('rev-parse', 'HEAD').decode().strip() == AUDIT
assert git('branch', '--show-current').decode().strip() == 'audit/release-eb6de2e8'
assert not git('diff', '--cached', '--name-only').strip()
assert git('ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').decode().split()[0] == AUDIT
raw = {}
def retain(name, endpoint, pages=False):
    argv = ['gh', 'api'] + (['--paginate', '--slurp'] if pages else []) + [endpoint]
    raw[name] = run(argv)
    return json.loads(raw[name])

verdict = retain('actual-verdict-original.json', f'repos/yigini/soilfer-lims/issues/comments/{VERDICT}')
body = verdict['body']
assert verdict['id'] == VERDICT and verdict['performed_via_github_app']['slug'] == 'claude'
assert verdict['performed_via_github_app']['id'] == 1236702
assert verdict['created_at'] == verdict['updated_at'] == '2026-10-15T14:59:59Z'
assert body.startswith('Audit passed: OK to merge and deploy\n')
assert all(x in body for x in [HEAD, TREE, BASE, '6189025975', 'This approves merging the source only.'])
comments = [c for p in retain('comments-original.json', 'repos/yigini/soilfer-lims/issues/298/comments?per_page=100', True) for c in p]
assert [c['id'] for c in comments] == [6193369476, VERDICT], 'Inspect any newer direction first.'
reviews = retain('reviews-original.json', 'repos/yigini/soilfer-lims/pulls/298/reviews?per_page=100', True)
assert not any(reviews)
coord = retain('coordination-since-request-original.json', 'repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-15T13:35:00Z&per_page=100', True)
assert not any(coord), 'Inspect new coordination direction first.'
pr = retain('pr-original.json', 'repos/yigini/soilfer-lims/pulls/298')
assert pr['state'] == 'open' and not pr['merged'] and pr['head']['sha'] == HEAD and pr['base']['sha'] == BASE
assert pr['mergeable'] is True and pr['mergeable_state'] == 'clean'
assert pr['body'] == (D / 'source-only-pr373-created-once/pr-body-original.md').read_text(encoding='utf-8')
assert retain('main-original.json', 'repos/yigini/soilfer-lims/git/ref/heads/main')['object']['sha'] == BASE
assert retain('source-original.json', f'repos/yigini/soilfer-lims/git/commits/{HEAD}')['tree']['sha'] == TREE
assert git('rev-parse', HEAD + '^{tree}').decode().strip() == TREE
assert git('ls-remote', 'origin', 'refs/heads/codex/startup-readiness-shared-context').decode().split()[0] == HEAD
ci = retain('ci-original.json', f'repos/yigini/soilfer-lims/actions/runs/{RUN}')
assert ci['status'] == 'completed' and ci['conclusion'] == 'success' and ci['head_sha'] == HEAD and ci['run_attempt'] == 1
jobs = retain('jobs-original.json', f'repos/yigini/soilfer-lims/actions/runs/{RUN}/jobs?per_page=100')['jobs']
terminal = json.loads((D / 'pr298-ci38738769335-closed-originals-once/closed-record.json').read_bytes())
assert terminal['status'] == 'CLOSED_SUCCESS_VERIFIED' and terminal['verificationProblems'] == []
assert terminal['exactJestSummary'] == ['Test Suites: 373 passed, 373 total', 'Tests:       5679 passed, 5679 total']
assert terminal['exactFullInventoryMatch'] and len(terminal['archiveEntries']) == 22
assert len(jobs) == 1 and jobs[0]['status'] == 'completed' and jobs[0]['conclusion'] == 'success'
assert {s['name']: s['conclusion'] for s in jobs[0]['steps']} == terminal['requiredSteps']
assert all(s['status'] == 'completed' and s['conclusion'] == 'success' for s in jobs[0]['steps'])
checks = retain('checks-original.json', f'repos/yigini/soilfer-lims/commits/{HEAD}/check-runs')['check_runs']
assert checks and all(c['status'] == 'completed' and c['conclusion'] == 'success' for c in checks)
assert any(c['name'] == 'Test & Build' for c in checks)
raw['closing-refs-original.json'] = run(['gh', 'pr', 'view', '298', '--repo', 'yigini/soilfer-lims', '--json', 'closingIssuesReferences'])
assert json.loads(raw['closing-refs-original.json'])['closingIssuesReferences'] == []
scope = retain('scope-original.json', 'repos/yigini/soilfer-lims/issues/comments/6189025975')
assert scope['body'] == json.loads((D / 'pr298-ci38738769335-closed-originals-once/scope-original.json').read_bytes())['body']
assert scope['performed_via_github_app']['slug'] == 'claude'
assert retain('issue191-original.json', 'repos/yigini/soilfer-lims/issues/191')['state'] == 'closed'
for issue in [206, 214, 209]:
    assert retain(f'issue{issue}-original.json', f'repos/yigini/soilfer-lims/issues/{issue}')['state'] == 'open'
publication = json.loads((D / 'pr298-ci38738769335-closed-originals-once/publication-index.json').read_bytes())
for pin in publication['files']:
    value = git('show', CI_AUDIT + ':' + pin['path'])
    assert sha(value) == pin['sha256'] and len(value) == pin['length']
    assert git('rev-parse', CI_AUDIT + ':' + pin['path']).decode().strip() == pin['gitBlobOid']
frozen = json.loads((D / 'full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes())
assert len(frozen) == 1333 and all(sha((R / p).read_bytes()) == v for p, v in frozen.items())
source = json.loads((D / 'source-only-pr373-preparation-once/review-ref.json').read_bytes())['sourceBindings']
assert len(source) == 36
assert set(git('diff', '--name-only', BASE, HEAD).decode().splitlines()) == set(source)
for path, pin in source.items():
    value = git('show', HEAD + ':' + path)
    assert value == (R / path).read_bytes() and sha(value) == pin['sha256'] and len(value) == pin['length']
    assert git('rev-parse', HEAD + ':' + path).decode().strip() == pin['gitBlobOid']
O.mkdir()
for name, value in raw.items():
    (O / name).write_bytes(value)
(O / 'verdict-readable.txt').write_bytes(body.encode())
record = {
    'status': 'ACTUAL_EXACT_HEAD_SOURCE_AUDIT_PASS', 'observedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'pr': 298, 'head': HEAD, 'tree': TREE, 'base': BASE, 'verdictId': VERDICT, 'verdictUrl': verdict['html_url'],
    'verdictCreatedUtc': verdict['created_at'], 'approvalScope': 'Source merge only; no production 600s/805306368 qualification.',
    'claudioTestsAsReported': {'firstRunSuites': 373, 'firstRunTests': 5679, 'firstRunPassed': 5678,
        'firstRunFailure': 'Unchanged keyboard Playwright test: pinned headless-shell 1248 absent in reviewer container.',
        'separateReviewerChromiumRerun': '1/1 passed; this is reviewer-reported, not Pip CI or an all-pass original first run.'},
    'prCi': RUN, 'ciEvidenceAudit': CI_AUDIT, 'ciRawBindingsVerified': len(publication['files']),
    'exactJestSummary': terminal['exactJestSummary'], 'all1333FrozenInputsUnchanged': True,
    'all36HeadSourceBindingsVerified': True, 'originalPrBodyUnchanged': True, 'closingIssuesReferences': [],
    'nativeObservation': 'Fresh unique returned Claude7867734 selected; state capture refused because minimized. No activation/input, no new native PASS claimed. Actual full GitHub Claude-app verdict governs.',
    'requirements': ['NEW app image after merge/current-main CI', 'NEW image-bound tooling all-hash Claudio SourcePASS',
        'R4 fresh computed requirement PLUS10GB before EACH build/proof', 'NEW proof root; never cde8/B5/100000 retry',
        'R1 NO proof DB removal pending YY; R2 protected shared/in-use cache; R3 images LISTONLY; R5 backups protected',
        'science/refusal/report/fullhash/copyrace/600/805306368/forward-only/no103/history/humandrafts retained'],
    'mergePerformed': False, 'messagesSent': 0, 'productionOperations': 0,
}
(O / 'pass-record.json').write_text(json.dumps(record, indent=2), encoding='utf-8')
readme = R / 'WP/audit-release-eb6de2e8/README.md'
lead = f'''## 2026-10-15 PR298 actual exact-head source audit PASS6195167175

Actual Claude GitHub app final verdict at14:59:59UTC binds exact{HEAD}/tree{TREE}/base{BASE}: Audit passed: OK to merge and deploy. Explicit scope SOURCE MERGE ONLY; production600s/805306368 still requires NEW image/tooling all-hash review/R4 computed+10GB/new proof. Reviewer's first373/5679 run reported5678 pass and one missing-browser environmental failure in unchanged keyboard test; separate Chromium rerun1/1 passed, never mislabelled original fullPASS. Pip actual stockCI373/5679/allDocker closed originals independently reverified; all1333 frozen inputs and36 source bindings unchanged/originalbody/closingrefs[]/fresh guards checked. Full original verdict and fresh APIs at WP/startup-order-readiness-20261015/{O.name}/pass-record.json. Native fresh state capture minimized/no activation or input/no native PASS claim. No duplicate ready/audit request/ACK; merge not performed by retainer. All science/refusal/report/hash/race/600/805/forward-only/no103/R1-R5/history/human protections remain; no proofDB removal pendingYY, no old retry/build/proof/kit/gate/deploy.

'''
readme.write_bytes(lead.encode() + readme.read_bytes())
paths = sorted(O.iterdir()) + [pathlib.Path(__file__), readme]
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
git('commit', '-m', 'Retain PR298 actual exact-head source audit PASS6195167175')
audit = git('rev-parse', 'HEAD').decode().strip()
git('push', 'origin', 'audit/release-eb6de2e8')
assert git('ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').decode().split()[0] == audit
print(json.dumps({'audit': audit, 'status': record['status'], 'rawVerifiedOwnedBlobs': len(paths), 'mergePerformed': False}))
