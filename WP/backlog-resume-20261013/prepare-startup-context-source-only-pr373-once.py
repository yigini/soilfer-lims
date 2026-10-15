"""Prepare one source-only ref from frozen full PASS; keep audit checkout intact."""
import datetime, hashlib, json, os, pathlib, subprocess

R = pathlib.Path(__file__).resolve().parents[2]
D = R / 'WP/startup-order-readiness-20261015'
O = D / 'source-only-pr373-preparation-once'
BASE = 'cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367'
AUDIT = '7bb585c8e465a529455dfb5ba6f1b8d229f37521'
APP = '7611ae485d1a29818d62fb53c32825abaac409f1'
REF = 'refs/heads/codex/startup-readiness-shared-context'

def run(argv, env=None, data=None):
    p = subprocess.run(argv, cwd=R, env=env, input=data, capture_output=True)
    if p.returncode:
        raise RuntimeError(p.stderr.decode('utf-8', 'replace'))
    return p.stdout

def git(*args, env=None, data=None):
    return run(['git', '-c', 'core.longpaths=true', *args], env, data)

def gh(path):
    return json.loads(run(['gh', 'api', path]))

def sha(value):
    return hashlib.sha256(value).hexdigest()

assert not O.exists() and git('rev-parse', 'HEAD').decode().strip() == AUDIT
assert git('branch', '--show-current').decode().strip() == 'audit/release-eb6de2e8'
assert not git('diff', '--cached', '--name-only').strip()
assert git('ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').decode().split()[0] == AUDIT
f = D / 'full-pinned-copy-retention-bound-ordinary-once'
summary = json.loads((f / 'summary.json').read_bytes())
assert summary['status'] == 'PASS' and summary['exitCode'] == 0
assert summary['suites'] == summary['passedSuites'] == 373 and summary['tests'] == summary['passedTests'] == 5679
assert summary['failed'] == summary['pending'] == 0 and summary['exactInventory'] and summary['sourceUnchanged']
frozen = json.loads((f / 'source-before.json').read_bytes())
assert len(frozen) == 1333 and frozen == json.loads((f / 'source-after.json').read_bytes())
assert all(sha((R / p).read_bytes()) == digest for p, digest in frozen.items())
retained = json.loads((D / 'full-pinned-copy-retention-bound-closed-pass-once/publication-index.json').read_bytes())
for row in retained['files']:
    value = git('show', AUDIT + ':' + row['path'])
    assert sha(value) == row['sha256'] and len(value) == row['length']
    assert git('rev-parse', AUDIT + ':' + row['path']).decode().strip() == row['gitBlobOid']
app = json.loads((D / 'private-context-closed-guards-pinned-copy-complete-publication-index.json').read_bytes())
paths = sorted(app['appPaths'])
assert len(paths) == len(set(paths)) == 36 and all(p.startswith('server/') for p in paths)
delta = git('diff', '--name-only', BASE, AUDIT, '--', '.', ':!WP').decode().splitlines()
assert set(delta) == set(paths) | {'.gitattributes'}
application_lines = lambda b: [l for l in b.decode().splitlines() if l.strip() and not l.startswith(('#', 'WP/'))]
assert application_lines(git('show', BASE + ':.gitattributes')) == application_lines(git('show', AUDIT + ':.gitattributes'))
blobs = {}
for p in paths:
    value = (R / p).read_bytes()
    assert sha(value) == frozen[p] and value == git('show', APP + ':' + p) == git('show', AUDIT + ':' + p)
    meta, name = git('ls-tree', AUDIT, '--', p).decode().strip().split('\t')
    mode, kind, oid = meta.split()
    assert kind == 'blob' and name == p
    blobs[p] = {'mode': mode, 'gitBlobOid': oid, 'sha256': sha(value), 'length': len(value)}
stock = [p for p in git('ls-tree', '-r', '--name-only', BASE, '--', 'server/tests').decode().splitlines() if p.endswith('.test.js')]
assert len(stock) == 370 and not git('diff', '--name-only', BASE, AUDIT, '--', *stock).strip()
main = gh('repos/yigini/soilfer-lims/git/ref/heads/main')
assert main['object']['sha'] == BASE and git('rev-parse', 'origin/main').decode().strip() == BASE
ci = gh('repos/yigini/soilfer-lims/actions/runs?branch=main&event=push&per_page=1')['workflow_runs']
assert len(ci) == 1 and ci[0]['head_sha'] == BASE and ci[0]['status'] == 'completed' and ci[0]['conclusion'] == 'success'
assert not gh('repos/yigini/soilfer-lims/pulls?state=all&head=yigini:codex/startup-readiness-shared-context')
assert subprocess.run(['git', 'show-ref', '--verify', '--quiet', REF], cwd=R).returncode == 1
assert not git('ls-remote', 'origin', REF)
direction_raw = run(['gh', 'api', 'repos/yigini/soilfer-lims/issues/comments/6189025975'])
direction = json.loads(direction_raw)
assert direction['id'] == 6189025975 and direction['body'].strip() == (D / 'actual-semantics-correction-6189025975-once/direction-readable.txt').read_text(encoding='utf-8').strip()
assert direction['performed_via_github_app']['slug'] == 'claude'
O.mkdir()
(O / 'main-original.json').write_text(json.dumps(main, indent=2), encoding='utf-8')
(O / 'current-main-ci-original.json').write_text(json.dumps(ci[0], indent=2), encoding='utf-8')
(O / 'claudio-direction-6189025975-original.json').write_bytes(direction_raw)
env = dict(os.environ, GIT_INDEX_FILE=str(O / 'review.index'))
git('read-tree', BASE, env=env)
for p in paths:
    row = blobs[p]
    git('update-index', '--add', '--cacheinfo', row['mode'] + ',' + row['gitBlobOid'] + ',' + p, env=env)
tree = git('write-tree', env=env).decode().strip()
assert set(git('diff', '--name-only', BASE, tree).decode().splitlines()) == set(paths)
assert not git('diff', '--name-only', APP, tree, '--', 'server', 'client', 'shared', 'Dockerfile', 'docker-entrypoint.sh', '.github').strip()
assert git('show', tree + ':.gitattributes') == git('show', BASE + ':.gitattributes')
head = git('commit-tree', tree, '-p', BASE, data=b'fix(server): share guarded readiness checks within startup\n').decode().strip()
assert git('rev-parse', head + '^').decode().strip() == BASE
git('update-ref', REF, head, '0' * 40)
record = {'preparedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'auditSource': AUDIT, 'appSourceAudit': APP, 'base': BASE, 'reviewHead': head, 'reviewTree': tree, 'reviewRef': REF,
    'sourcePathCount': 36, 'sourceBindings': blobs, 'fullLocalSummary': summary,
    'all1333FrozenInputsUnchanged': True, 'all370StockTestFilesUnchanged': True,
    'baseAttributesByteIdentical': True, 'wpPathsExcluded': True, 'checkoutUnchanged': True,
    'newCheckouts': 0, 'newWorktrees': 0, 'productionOperations': 0}
(O / 'review-ref.json').write_text(json.dumps(record, indent=2), encoding='utf-8')
assert git('rev-parse', 'HEAD').decode().strip() == AUDIT
print(json.dumps({k: v for k, v in record.items() if k not in ['sourceBindings', 'fullLocalSummary']}))
