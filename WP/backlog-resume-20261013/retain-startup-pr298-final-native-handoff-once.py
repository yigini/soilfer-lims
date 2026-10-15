"""Publish the already sent native final-audit handoff; sends no message."""
import datetime, hashlib, json, pathlib, subprocess
R = pathlib.Path(__file__).resolve().parents[2]
D = R / 'WP/startup-order-readiness-20261015'
O = D / 'pr298-final-native-handoff-once'
AUDIT = '584573491c741e9d79582524d078d180f2ec0408'
HEAD = 'eba02837eaa2ab797cad0572fecada686f660346'
BASE = 'cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367'
def run(argv):
    p = subprocess.run(argv, cwd=R, capture_output=True)
    if p.returncode: raise RuntimeError(p.stderr.decode('utf-8', 'replace'))
    return p.stdout
def git(*args): return run(['git', '-c', 'core.longpaths=true', *args])
def sha(value): return hashlib.sha256(value).hexdigest()
assert O.exists() and not (O / 'publication-index.json').exists()
assert git('rev-parse', 'HEAD').decode().strip() == AUDIT
assert git('branch', '--show-current').decode().strip() == 'audit/release-eb6de2e8'
assert not git('diff', '--cached', '--name-only').strip()
assert git('ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').decode().split()[0] == AUDIT
assert {p.name for p in O.iterdir()} == {'native-handoff-actual-sent.txt','native-delivery-record.json','native-accessibility-tool-output-transcription.txt'}
delivery = json.loads((O / 'native-delivery-record.json').read_bytes())
assert delivery['nativeReturnCount'] == 1 and delivery['head'] == HEAD and not delivery['actualFinalAuditPass']
raw = {}
for name, endpoint in {
    'pr-after-handoff-original.json': 'repos/yigini/soilfer-lims/pulls/298',
    'pr-comments-after-handoff-original.json': 'repos/yigini/soilfer-lims/issues/298/comments?per_page=100',
    'pr-reviews-after-handoff-original.json': 'repos/yigini/soilfer-lims/pulls/298/reviews?per_page=100',
    'coordination-after-handoff-original.json': 'repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-15T13:35:00Z&per_page=100',
    'main-after-handoff-original.json': 'repos/yigini/soilfer-lims/git/ref/heads/main',
}.items(): raw[name] = run(['gh', 'api', endpoint])
pr = json.loads(raw['pr-after-handoff-original.json'])
assert pr['state'] == 'open' and pr['head']['sha'] == HEAD and pr['base']['sha'] == BASE
assert pr['body'] == (D / 'source-only-pr373-created-once/pr-body-original.md').read_text(encoding='utf-8')
assert json.loads(raw['main-after-handoff-original.json'])['object']['sha'] == BASE
comments = json.loads(raw['pr-comments-after-handoff-original.json'])
assert any(c['id'] == 6193369476 and c['body'] == (D / 'pr298-eba02837-final-audit-request-once/actual-audit-request.txt').read_text(encoding='utf-8') for c in comments)
assert any(l['name'] == 'ready-for-audit' for l in pr['labels'])
for name, value in raw.items():
    p = O / name
    assert not p.exists()
    p.write_bytes(value)
frozen = json.loads((D / 'full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes())
assert len(frozen) == 1333 and all(sha((R / p).read_bytes()) == v for p, v in frozen.items())
readme = R / 'WP/audit-release-eb6de2e8/README.md'
lead = '''## 2026-10-15 PR298 final native audit handoff DELIVERED ONCE

ONE final native handoff13:37:25UTC to actual Claude7867734/LIMS Audit/Lab workflow audit and plan after fresh returned target, empty composers/right caret and own HEAD+END inspection/oneReturn. Actual sent PR298/eba02837/6193369476 bubble+empty right composer/ClaudeVibing verified; next fresh screenshot13:37:38UTC actual Claudio acknowledgement: checking out exact version and running tests. This is NOT final audit PASS. Accessibility initially lagged navigation and after-send composer state; screenshots govern, and the stale accessibility tool-output transcription is honestly labelled. Human old-test-copy deletion card unanswered/centre empty/human content preserved. Full actual sent text/delivery record and fresh GH after-handoff metadata at WP/startup-order-readiness-20261015/pr298-final-native-handoff-once. Never duplicate ready label/comment/native/final request. Actual exact-head final Claudio verdict remains pending; merge only after actual PASS and fresh head/base/main/CI checks. Complete realCI373/5679/all22archiveentries/allDocker retained69a3149f; request21raw58457349. No build/proof/kit/gate/deploy/production operation. NEW app image/tooling all-hash review/fresh computed requirement+10GB/new proof root later; never cde8/B5/100000 retry. No proof DB copy removal underR1 pendingYY/science/refusal/fullhash/copy/race/600/805306368/forward-only/no103/history held.

'''
readme.write_bytes(lead.encode() + readme.read_bytes())
paths = sorted(p for p in O.iterdir() if p.is_file()) + [pathlib.Path(__file__), readme]
bindings = []
for p in paths:
    value = p.read_bytes()
    bindings.append({'path': p.relative_to(R).as_posix(), 'length': len(value), 'sha256': sha(value), 'gitBlobOid': hashlib.sha1(('blob ' + str(len(value)) + '\0').encode() + value).hexdigest()})
index = O / 'publication-index.json'
index.write_text(json.dumps({'baseAudit': AUDIT, 'status': delivery['status'], 'publishedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'files': bindings, 'productionOperations': 0}, indent=2), encoding='utf-8')
paths.append(index)
names = [p.relative_to(R).as_posix() for p in paths]
git('-c', 'core.autocrlf=false', 'add', '-f', '--', *names)
assert set(git('diff', '--cached', '--name-only').decode().splitlines()) <= set(names)
tree = git('write-tree').decode().strip()
for p, name in zip(paths, names):
    value = git('show', tree + ':' + name)
    assert value == p.read_bytes() and hashlib.sha1(('blob ' + str(len(value)) + '\0').encode() + value).hexdigest() == git('rev-parse', tree + ':' + name).decode().strip()
assert all(sha((R / p).read_bytes()) == v for p, v in frozen.items())
git('commit', '-m', 'Retain PR298 final native exact-head audit handoff once')
audit = git('rev-parse', 'HEAD').decode().strip()
git('push', 'origin', 'audit/release-eb6de2e8')
assert git('ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').decode().split()[0] == audit
print(json.dumps({'audit': audit, 'rawVerifiedOwnedBlobs': len(paths), 'status': delivery['status'], 'prCommentIds': [c['id'] for c in comments], 'reviews': len(json.loads(raw['pr-reviews-after-handoff-original.json'])), 'coordinationNewComments': len(json.loads(raw['coordination-after-handoff-original.json'])), 'actualFinalAuditPass': False}))
