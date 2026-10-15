"""Retain one read-only native audit-progress observation; no message or operator."""
import datetime
import hashlib
import json
import pathlib
import subprocess

R = pathlib.Path(__file__).resolve().parents[2]
D = R / 'WP/startup-order-readiness-20261015'
O = D / 'pr298-native-audit-progress-1352-once'
AUDIT = 'baaebf54f74fc244b3705613768a225a88b5f361'
HEAD = 'eba02837eaa2ab797cad0572fecada686f660346'
BASE = 'cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367'

def run(argv):
    p = subprocess.run(argv, cwd=R, capture_output=True)
    if p.returncode:
        raise RuntimeError(p.stderr.decode('utf-8', 'replace'))
    return p.stdout

def git(*args):
    return run(['git', '-c', 'core.longpaths=true', *args])

def sha(value):
    return hashlib.sha256(value).hexdigest()

assert not O.exists()
assert git('rev-parse', 'HEAD').decode().strip() == AUDIT
assert git('branch', '--show-current').decode().strip() == 'audit/release-eb6de2e8'
assert not git('diff', '--cached', '--name-only').strip()
assert git('ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').decode().split()[0] == AUDIT
raw = {}
for name, endpoint in {
    'pr-original.json': 'repos/yigini/soilfer-lims/pulls/298',
    'pr-comments-original.json': 'repos/yigini/soilfer-lims/issues/298/comments?per_page=100',
    'pr-reviews-original.json': 'repos/yigini/soilfer-lims/pulls/298/reviews?per_page=100',
    'coordination-since-1343-original.json': 'repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-15T13:43:00Z&per_page=100',
    'main-original.json': 'repos/yigini/soilfer-lims/git/ref/heads/main',
    'ci-original.json': 'repos/yigini/soilfer-lims/actions/runs/38738769335',
    'issue191-original.json': 'repos/yigini/soilfer-lims/issues/191',
}.items():
    raw[name] = run(['gh', 'api', endpoint])
pr = json.loads(raw['pr-original.json'])
comments = json.loads(raw['pr-comments-original.json'])
reviews = json.loads(raw['pr-reviews-original.json'])
coordination = json.loads(raw['coordination-since-1343-original.json'])
ci = json.loads(raw['ci-original.json'])
assert pr['state'] == 'open' and pr['head']['sha'] == HEAD and pr['base']['sha'] == BASE
assert pr['body'] == (D / 'source-only-pr373-created-once/pr-body-original.md').read_text(encoding='utf-8')
assert json.loads(raw['main-original.json'])['object']['sha'] == BASE
assert ci['head_sha'] == HEAD and ci['run_attempt'] == 1 and ci['status'] == 'completed' and ci['conclusion'] == 'success'
assert [c['id'] for c in comments] == [6193369476] and not reviews and not coordination
assert json.loads(raw['issue191-original.json'])['state'] == 'closed'
O.mkdir()
for name, value in raw.items():
    (O / name).write_bytes(value)
record = {
    'status': 'NATIVE_AUDIT_PROGRESS_OBSERVED_NO_FINAL_VERDICT',
    'recordedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'observationTimeLabel': '2026-10-15 13:51-13:52 UTC; tool observation, not producer timestamp',
    'head': HEAD, 'baseAndMain': BASE,
    'nativeTarget': {'returnedWindowId': 7867734, 'project': 'LIMS Audit', 'thread': 'Lab workflow audit and plan'},
    'method': 'Read-only @oai/sky list_apps/get_window/get_window_state; screenshot and accessibility agree on current audit checklist. No activation, navigation, click, typing, Return or message.',
    'nativeChecklistVerbatim': [
        {'state': 'done', 'text': "Read Pip's request and the 36-file change"},
        {'state': 'done', 'text': 'Client build and lint passed'},
        {'state': 'done', 'text': 'Reviewed the startup context: refusal rules and reports unchanged'},
        {'state': 'in progress', 'text': 'Running the full server test suite (5,679 tests)'},
        {'state': 'not done', 'text': 'Post the verdict on PR 298'},
    ],
    'qualification': 'This is the displayed checklist, not independent proof of an active process or completed full audit. Accessibility also says Claude finished the response. No actual final audit verdict is present in the observed native thread or fresh GitHub comments/reviews.',
    'nativePixelEvidence': 'Original screenshot exists in conversation tool output. No local pixel-byte artifact or exact producer-time claim.',
    'humanState': 'Both composers visually empty. Existing old-proof-database deletion card remains unanswered; no human input/card changed. Its old 42GB estimate is not a fresh computed capacity requirement.',
    'githubCommentIds': [c['id'] for c in comments], 'reviews': len(reviews),
    'actualFinalAuditPass': False, 'mergeCount': 0, 'nativeMessagesSent': 0, 'productionOperations': 0,
    'nextBoundary': 'Observe actual final exact-head Claudio verdict/findings; exact-head PASS plus fresh source/body/head/base/main/complete-CI guards before one guarded merge. New image/tooling all-hash review/fresh computed requirement plus 10GB/new proof root later. No cde8/B5/100000 retry or proof DB removal pending YY.',
}
(O / 'observation-derived.json').write_text(json.dumps(record, indent=2), encoding='utf-8')
readme = R / 'WP/audit-release-eb6de2e8/README.md'
lead = '''## 2026-10-15 PR298 native final-audit progress observed read-only

Fresh actual Claude7867734/LIMS Audit/Lab workflow audit and plan screenshot and accessibility at13:51-13:52UTC show checklist: request/36-file review done, client build/lint passed, startup-context refusal/report review done, full5679 server suite marked in progress, posting PR298 verdict not done. This is displayed progress, not independent active-process proof or final audit PASS; accessibility also says response finished. Fresh GH still only6193369476/reviews[]/#162since13:43[]/exactebahead+base/maincde8 unchanged/CI38738769335 success. Read-only only/no native input or duplicate request/ACK. Existing human deletion card unanswered/both composers empty; old42GB estimate is not fresh R4 requirement. Evidence WP/startup-order-readiness-20261015/pr298-native-audit-progress-1352-once. Final exact-head PASS/fresh guards before one guarded merge; no merge/build/proof/cleanup/deploy. All prior science/refusal/hash/race/600/805306368/R1-R5/new-image/new-tooling/+10GB/new-proof-root/forward-only/no103/history protections remain.

'''
readme.write_bytes(lead.encode() + readme.read_bytes())
paths = sorted(O.iterdir()) + [pathlib.Path(__file__), readme]
bindings = []
for p in paths:
    value = p.read_bytes()
    bindings.append({'path': p.relative_to(R).as_posix(), 'length': len(value), 'sha256': sha(value), 'gitBlobOid': hashlib.sha1(('blob ' + str(len(value)) + '\0').encode() + value).hexdigest()})
index = O / 'publication-index.json'
index.write_text(json.dumps({'baseAudit': AUDIT, 'status': record['status'], 'files': bindings, 'productionOperations': 0}, indent=2), encoding='utf-8')
paths.append(index)
names = [p.relative_to(R).as_posix() for p in paths]
git('-c', 'core.autocrlf=false', 'add', '-f', '--', *names)
assert set(git('diff', '--cached', '--name-only').decode().splitlines()) <= set(names)
tree = git('write-tree').decode().strip()
for p, name in zip(paths, names):
    value = git('show', tree + ':' + name)
    assert value == p.read_bytes()
    assert hashlib.sha1(('blob ' + str(len(value)) + '\0').encode() + value).hexdigest() == git('rev-parse', tree + ':' + name).decode().strip()
git('commit', '-m', 'Retain read-only PR298 native audit progress')
audit = git('rev-parse', 'HEAD').decode().strip()
git('push', 'origin', 'audit/release-eb6de2e8')
assert git('ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').decode().split()[0] == audit
print(json.dumps({'audit': audit, 'rawVerifiedOwnedBlobs': len(paths), 'status': record['status'], 'actualFinalAuditPass': False}))
