"""Retain the actual closed workbench request/order parent retention and core/scanner sequential proof, once."""
import datetime, hashlib, json, subprocess, sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root = Path(__file__).resolve().parents[2]
wp = Path(__file__).parent
dest = wp / 'issue209-workbench-request-order-retention-bound-context-singles'
review = wp / 'issue209-workbench-request-order-retention-bound-context-review'
assert not (dest / 'index.json').exists()
summary = json.loads((dest / 'summary-observed.json').read_bytes())
assert summary['status'] == 'PASS' and summary['closedSuites'] == 8
assert summary['closedTests'] == summary['passedTests'] == 343
assert summary['selectedInventoryEqual'] and summary['fullDiscovery'] == 370
before = json.loads((dest / 'source-before.json').read_bytes())
assert before == json.loads((dest / 'source-after.json').read_bytes())
for p, d in before.items():
    assert hashlib.sha256((root / p).read_bytes()).hexdigest() == d, p
reports = []
for child in sorted(p for p in dest.iterdir() if p.is_dir()):
    r = json.loads((child / 'report-original.json').read_bytes())
    s = json.loads((child / 'observed-closed-summary.json').read_bytes())
    assert s['status'] == 'PASS' and int((child / 'exit-original.txt').read_text()) == 0
    assert r['success'] and r['numTotalTestSuites'] == 1
    assert r['numTotalTests'] == r['numPassedTests'] == s['expectedTests']
    assert all(r[k] == 0 for k in ['numFailedTests', 'numPendingTests', 'numTodoTests', 'numFailedTestSuites', 'numPendingTestSuites'])
    reports.append(r)
assert len(reports) == 8
classification = json.loads((review / 'pre-correction-classification.json').read_bytes())
assert classification['reviewedBeforeChanges'] and len(classification['cases']) == 11
passed = {(Path(s['name']).name, c['fullName']) for r in reports for s in r['testResults'] for c in s['assertionResults'] if c['status'] == 'passed'}
assert all((c['suite'], c['test']) in passed for c in classification['cases'])
for row in json.loads((review / 'fixture-additions-original.json').read_bytes()):
    raw = (root / row['path']).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == row['afterSha256']
    recovered = raw.decode().replace('\r\n', '\n')
    for added in reversed(row['additions']):
        assert added in recovered
        recovered = recovered.replace(added, '', 1)
    assert recovered == (review / (Path(row['path']).name + '.before-original')).read_text(encoding='utf8')
held = []
for line in (dest / 'physical-retention-original.jsonl').read_text(encoding='utf8').splitlines():
    p = Path(json.loads(line)['path'])
    assert p.exists(), p
    if p.is_file():
        held.append({'path': str(p), 'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()})
(dest / 'physical-retained-terminal-index.json').write_bytes((json.dumps({'closedUtc': summary['closedUtc'], 'allRecordedTeardownTargetsRetained': True, 'files': held}, indent=2) + '\n').encode())
def git(*a):
    return subprocess.run(['git', *a], cwd=root, capture_output=True, check=True).stdout
assert git('branch', '--show-current').strip() == b'audit/release-eb6de2e8'
assert not git('diff', '--cached', '--name-only').strip()
source = json.loads((wp / 'issue209-workbench-request-order-context-singles/index.json').read_bytes())['sourceDraftPaths']
source = list(dict.fromkeys(source + ['server/tests/contracts/'+n for n in ['workbench_single_entry.test.js','workbench_draft_integrity.test.js','workbench_pipeline_twostep.test.js','qc_disposition_flagging.test.js']]))
assert len(source) == 113
raw = {p.relative_to(root).as_posix(): {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.rglob('*') if p.is_file()}
pins = {p.relative_to(root).as_posix(): {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in review.iterdir() if p.is_file()}
failedReview = wp / 'issue209-workbench-request-order-retention-corrected-context-review'
pins.update({p.relative_to(root).as_posix(): {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in failedReview.iterdir() if p.is_file()})
(dest / 'index.json').write_bytes((json.dumps({'retainedUtc': datetime.datetime.now(datetime.UTC).isoformat(), 'summary': summary, 'verificationKind': 'SEQUENTIAL_ORDINARY_SINGLE_SUITE_SUCCESSOR', 'rawFiles': raw, 'reviewFiles': pins, 'sourceDraftPaths': source, 'all11OriginalCasesPassed': True, 'totalOriginalFailedCasesResolved': 608, 'remainingOriginalUnresolved': 42, 'futureFullExpectedTests': 5642, 'changedLegacyExpectations': [{'comment': 6169628053, 'oldKeyedAnalysesReceiptCount': 0, 'newCount': 1}], 'applicationFullyVerified': False, 'productionOperations': 0}, indent=2) + '\n').encode())
lead = '''## 2026-10-14 #209 workbench request/order parent retention CLOSED sequential PASS8/343

Closed17:29:46.805600UTC: eight ordinary single-suite invocations13+6+5+3+139+32+112+33=343/343PASS, zero failed/pending/todo/exact8inventory/full370 discovery; all frozen incl shared/generatedPrisma/scenarios/template unchanged/both ordinary setups/worker512MB/blank NODE_OPTIONS/recorded teardown targets held. All11 original cases source-classified BEFORE contexts. Single-entry already had valid order: actual diagnostic500 from absent mock req.headers fixed only by fixture headers={}; all original POTASSIUM/request/reason/version2/three-line/supersession/operational/approval assertions passed. Original teardown then refused FK deletion of retained orderLine parent after13 passing assertions, honestly retained399465; guard only original two teardown delete statements when retained WorkAttempt exists, preserves literal old source/runtime FK/history guards. First guard preparer wrote valid guard but byte proof matched common closing brace; old helper/partial evidence preserved, unique closing marker now proves every old byte/assertion recovered. Draft positive PH/duplicate pair and pipeline PH+EC/QC flag witness legacy NULL order contexts, earlier negative/draft/preview and all values/versions/replicates/receipt/submission/flag/QC math unchanged. All113 appdraft paths/closed child reports/logs/commands/exits/hash/physical/review at issue209-workbench-request-order-retention-bound-context-singles/index.json. Combined608 original650 verified;42 unresolved. Original diagnostic13/11/2 dd51, two pretest prerequisite refusals/failed retainer ledger absence, partial13/13 assertions+failed teardown399465 and marker-proof refusal immutable/no replay. No runner/full209PASS/PR/ready/finalaudit/merge/kit/gate/production operation. Remaining governance5 and exchange/spectral37 cases require per-case source review before changes; some small governance sources read only/partly truncated. Future full370expected5642/ONLY derived help manifest mutable output before/after bytes/hash/freeze all source/shared/Prisma/scenarios/template/others. Native unlocked512 checkpoint30049/Cl nothing needed once complete/no repeated notice/human draft/cards preserved. Four actual scope answers/ONE accepted receipt0to1/runtime orphan refusals/readonly impact lists/approvednonzeroSTOP/no amendmentorderstep/backfill/relink/103noapply/206+214 green undeployed/open/history guards hold.

'''
readmes = ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md']
for p in readmes:
    f = root / p
    f.write_bytes(lead.encode() + f.read_bytes())
owned = list(raw) + list(pins) + source + readmes + [Path(__file__).relative_to(root).as_posix(), (wp / 'prepare-issue209-workbench-order-parent-retention-bound-once.py').relative_to(root).as_posix(), (wp / 'verify-issue209-workbench-request-order-retention-bound-singles-once.py').relative_to(root).as_posix(), (dest / 'index.json').relative_to(root).as_posix()]
owned.append((wp / 'prepare-issue209-workbench-order-parent-retention-context-once.py').relative_to(root).as_posix())
assert all((root / p).exists() for p in owned)
git('add', '-f', '--', *owned)
assert set(git('diff', '--cached', '--name-only').decode().splitlines()) <= set(owned)
for p, pin in {**raw, **pins}.items():
    assert hashlib.sha256(git('show', ':' + p)).hexdigest() == pin['sha256'], p
for p in source:
    assert git('show', ':' + p) == (root / p).read_bytes().replace(b'\r\n', b'\n'), p
git('commit', '-m', 'audit(209): retain workbench request and retained order parents PASS343')
head = git('rev-parse', 'HEAD').decode().strip()
objects = {}
for entry in git('ls-tree', '-r', '-z', head, '--', *list({**raw, **pins})).split(b'\0'):
    if entry:
        meta, p = entry.split(b'\t', 1)
        objects[p.decode()] = meta.decode().split()[2]
assert set(objects) == set({**raw, **pins})
for p, pin in {**raw, **pins}.items():
    assert hashlib.sha256(git('cat-file', 'blob', objects[p])).hexdigest() == pin['sha256'], p
git('push', 'origin', head + ':refs/heads/audit/release-eb6de2e8')
assert git('ls-remote', 'origin', 'refs/heads/audit/release-eb6de2e8').decode().split()[0] == head
print(json.dumps({'auditHead': head, 'passedTests': 343, 'closedSingleSuites': 8, 'rawGitBlobsVerified': len(raw), 'reviewBlobsVerified': len(pins), 'sourceDraftPaths': 113, 'originalCasesResolved': 608, 'remaining': 42, 'productionOperations': 0}))
