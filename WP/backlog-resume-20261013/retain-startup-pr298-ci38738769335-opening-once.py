"""Retain PR298 creation and actual CI metadata, never active logs as terminal proof."""
import datetime, hashlib, json, pathlib, subprocess

R = pathlib.Path(__file__).resolve().parents[2]
D = R / 'WP/startup-order-readiness-20261015'
O = D / 'pr298-ci38738769335-opening-once'
AUDIT = '7bb585c8e465a529455dfb5ba6f1b8d229f37521'
HEAD = 'eba02837eaa2ab797cad0572fecada686f660346'
BASE = 'cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367'
RUN = 38738769335

def run(argv):
    p = subprocess.run(argv, cwd=R, capture_output=True)
    if p.returncode: raise RuntimeError(p.stderr.decode('utf-8', 'replace'))
    return p.stdout

def git(*args):
    return run(['git', '-c', 'core.longpaths=true', *args])

def sha(value): return hashlib.sha256(value).hexdigest()

assert not O.exists() and git('rev-parse', 'HEAD').decode().strip() == AUDIT
assert not git('diff', '--cached', '--name-only').strip()
assert git('branch', '--show-current').decode().strip() == 'audit/release-eb6de2e8'
assert git('ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').decode().split()[0] == AUDIT
review = json.loads((D / 'source-only-pr373-preparation-once/review-ref.json').read_bytes())
created = json.loads((D / 'source-only-pr373-created-once/creation-record.json').read_bytes())
assert review['reviewHead'] == created['head'] == HEAD and review['base'] == created['base'] == BASE
assert created['number'] == 298
frozen = json.loads((D / 'full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes())
assert len(frozen) == 1333 and all(sha((R / p).read_bytes()) == v for p, v in frozen.items())
source_paths = sorted(review['sourceBindings'])
assert len(source_paths) == 36 and set(git('diff', '--name-only', BASE, HEAD).decode().splitlines()) == set(source_paths)
for p, row in review['sourceBindings'].items():
    value = git('show', HEAD + ':' + p)
    assert sha(value) == row['sha256'] and value == (R / p).read_bytes()
raws = {}
for name, endpoint in {
    'ci-run-original.json': f'repos/yigini/soilfer-lims/actions/runs/{RUN}',
    'ci-jobs-original.json': f'repos/yigini/soilfer-lims/actions/runs/{RUN}/jobs?per_page=100',
    'pr-live-original.json': 'repos/yigini/soilfer-lims/pulls/298',
    'pr-comments-original.json': 'repos/yigini/soilfer-lims/issues/298/comments?per_page=100',
    'current-main-original.json': 'repos/yigini/soilfer-lims/git/ref/heads/main',
    'coordination-history-original.json': 'repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-15T12:07:44Z&per_page=100'
}.items(): raws[name] = run(['gh', 'api', endpoint])
raws['closing-refs-original.json'] = run(['gh', 'pr', 'view', '298', '--repo', 'yigini/soilfer-lims', '--json', 'closingIssuesReferences'])
ci = json.loads(raws['ci-run-original.json']); pr = json.loads(raws['pr-live-original.json'])
assert ci['id'] == RUN and ci['run_attempt'] == 1 and ci['head_sha'] == HEAD and ci['event'] == 'pull_request'
assert ci['path'] == '.github/workflows/ci.yml' and any(p['number'] == 298 for p in ci['pull_requests'])
assert pr['state'] == 'open' and pr['head']['sha'] == HEAD and pr['base']['sha'] == BASE
assert pr['body'] == (D / 'source-only-pr373-created-once/pr-body-original.md').read_text(encoding='utf-8')
assert json.loads(raws['closing-refs-original.json'])['closingIssuesReferences'] == []
assert json.loads(raws['current-main-original.json'])['object']['sha'] == BASE
O.mkdir()
for name, value in raws.items(): (O / name).write_bytes(value)
record = {'retainedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'status': 'ACTUAL_PR_AND_CI_METADATA_ONLY',
    'pr': 298, 'url': pr['html_url'], 'head': HEAD, 'tree': review['reviewTree'], 'base': BASE,
    'ciRun': RUN, 'ciStatus': ci['status'], 'ciConclusion': ci['conclusion'], 'ciAttempt': 1,
    'sourcePathCount': 36, 'all1333FrozenInputsUnchanged': True, 'all370StockTestFilesUnchanged': True,
    'localFullSummary': review['fullLocalSummary'], 'ciLogsCaptured': False, 'ciPassNotClaimed': True,
    'readyLabelOrFinalAuditNoticeSent': False, 'nativeHandoffSent': False, 'mergeBuildProofOrProductionOperations': 0,
    'next': 'Observe this same CI run. Retain actual CLOSED originals including all failures with a NEW unique terminal retainer. No rerun/retry or final audit request until independently verified complete actual CI success.'}
(O / 'opening-record.json').write_text(json.dumps(record, indent=2), encoding='utf-8')
readme = R / 'WP/audit-release-eb6de2e8/README.md'
lead = f'''## 2026-10-15 PR298 source-only eba02837 / actual CI38738769335 {ci['status']}

PR298 https://github.com/yigini/soilfer-lims/pull/298 OPEN on exact head{HEAD}/tree{review['reviewTree']}/main base{BASE}. Only36 owned tested server paths; noWP/attribute/CI/Dockerfile/Compose/client changes. Audit checkout stays audit/release-eb6de2e8; temp source index retained/no newcheckout/worktree. All370 preexisting test files unchanged, all1333 frozen inputs reverified. Local complete373suites5679tests PASS at12:52:22.721011UTC retained24raw7bb585c8/full-pinned-copy-retention-bound-closed-pass-once; final focused167PASS and earlier failures preserved. First full retainer counted19 instead of18 and refused before outputs/staging; original helper/transcription unchanged, unique complete-original successor published ALL18 originals. No test replay.

ONE actual PR CI{RUN} attempt1/eventpull_request/head{HEAD}/created{ci['created_at']} status{ci['status']}/conclusion{ci['conclusion']}: https://github.com/yigini/soilfer-lims/actions/runs/{RUN}. Only actual API/job metadata captured; no active logs represented as CLOSED, no overall CI PASS/startup qualification. Observe SAME run at reasonable interval; never retry/dispatch/duplicatePR. Upon actual closure retain original ZIP/API/all step logs/entry hashes/exact Jest summary/inventory/all real Docker outcomes honestly. Green complete realCI then ready label/comment and final exact-head Claudio audit request/native handoff ONCE; exact-headPASS before merge/current-mainCI. ClosingIssuesReferences=[]; deployment issues remain open. No finalaudit notice/readylabel/native/build/proof/gate/deploy/productionSQL/no103. New app build/image-bound tooling review/fresh computed capacity+10GB/new proof root required later; no cde8/B5/100000 retry. Science/refusal/fullhash/copy/race/600/805306368/forward-only/history preserved. Cleanup receipt already independently checked; no duplicate receipt/ACK/native or proof DB removal underR1 pendingYY.

'''
readme.write_bytes(lead.encode() + readme.read_bytes())
paths = sorted(p for p in (D / 'source-only-pr373-preparation-once').iterdir() if p.is_file() and p.name != 'review.index')
paths += sorted(p for p in (D / 'source-only-pr373-created-once').iterdir() if p.is_file())
paths += sorted(p for p in O.iterdir() if p.is_file())
paths += [R / ('WP/backlog-resume-20261013/' + name) for name in [
    'prepare-startup-context-source-only-pr373-once.py', 'create-startup-context-source-only-pr373-once.py', pathlib.Path(__file__).name]]
paths.append(readme)
bindings = []
for p in paths:
    value = p.read_bytes()
    bindings.append({'path': p.relative_to(R).as_posix(), 'length': len(value), 'sha256': sha(value),
        'gitBlobOid': hashlib.sha1(('blob ' + str(len(value)) + '\0').encode() + value).hexdigest()})
index = O / 'publication-index.json'
index.write_text(json.dumps({'baseAudit': AUDIT, 'status': record['status'], 'pr': 298, 'head': HEAD,
    'ciRun': RUN, 'ciStatus': ci['status'], 'files': bindings, 'productionOperations': 0}, indent=2), encoding='utf-8')
paths.append(index)
names = [p.relative_to(R).as_posix() for p in paths]
assert len(names) == len(set(names))
git('-c', 'core.autocrlf=false', 'add', '-f', '--', *names)
assert set(git('diff', '--cached', '--name-only').decode().splitlines()) <= set(names)
tree = git('write-tree').decode().strip()
for p, name in zip(paths, names):
    value = git('show', tree + ':' + name)
    assert value == p.read_bytes()
    assert hashlib.sha1(('blob ' + str(len(value)) + '\0').encode() + value).hexdigest() == git('rev-parse', tree + ':' + name).decode().strip()
assert all(sha((R / p).read_bytes()) == v for p, v in frozen.items())
git('commit', '-m', 'Retain startup performance PR298 and actual CI opening')
head = git('rev-parse', 'HEAD').decode().strip()
git('push', 'origin', 'audit/release-eb6de2e8')
assert git('ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').decode().split()[0] == head
print(json.dumps({'head': head, 'rawVerifiedOwnedBlobs': len(paths), 'pr': 298, 'sourceHead': HEAD, 'ciRun': RUN, 'ciStatus': ci['status']}))
