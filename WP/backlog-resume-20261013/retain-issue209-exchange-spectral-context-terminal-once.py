"""Retain the actual closed final exchange/spectral contexts and core/scanner sequential proof, once."""
import datetime, hashlib, json, subprocess, sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root = Path(__file__).resolve().parents[2]
wp = Path(__file__).parent
dest = wp / 'issue209-exchange-spectral-context-singles'
review = wp / 'issue209-exchange-spectral-context-review'
assert not (dest / 'index.json').exists()
summary = json.loads((dest / 'summary-observed.json').read_bytes())
assert summary['status'] == 'PASS' and summary['closedSuites'] == 9
assert summary['closedTests'] == summary['passedTests'] == 353
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
assert len(reports) == 9
classification = json.loads((review / 'pre-correction-classification.json').read_bytes())
assert classification['reviewedBeforeChanges'] and len(classification['cases']) == 37
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
ledger=dest / 'physical-retention-original.jsonl'
for line in ledger.read_text(encoding='utf8').splitlines() if ledger.exists() else []:
    p = Path(json.loads(line)['path'])
    assert p.exists(), p
    if p.is_file():
        held.append({'path': str(p), 'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()})
(dest / 'physical-retained-terminal-index.json').write_bytes((json.dumps({'closedUtc': summary['closedUtc'], 'retentionLedgerPresent': ledger.exists(), 'allRecordedTeardownTargetsRetained': True, 'allPhysicalFixtureIdentitiesClaimed': False, 'files': held}, indent=2) + '\n').encode())
def git(*a):
    return subprocess.run(['git', *a], cwd=root, capture_output=True, check=True).stdout
assert git('branch', '--show-current').strip() == b'audit/release-eb6de2e8'
assert not git('diff', '--cached', '--name-only').strip()
source = json.loads((wp / 'issue209-governance-reason-sync-context-singles/index.json').read_bytes())['sourceDraftPaths']
source = list(dict.fromkeys(source + ['server/tests/contracts/'+n for n in ['nsis_policy_and_scoping.test.js','exchange_error_semantics.test.js','nsis_v2_exchange.test.js','export_normalization.test.js','spectral_stage_e.test.js']]))
assert len(source) == 122
raw = {p.relative_to(root).as_posix(): {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.rglob('*') if p.is_file()}
pins = {p.relative_to(root).as_posix(): {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in review.iterdir() if p.is_file()}
(dest / 'index.json').write_bytes((json.dumps({'retainedUtc': datetime.datetime.now(datetime.UTC).isoformat(), 'summary': summary, 'verificationKind': 'SEQUENTIAL_ORDINARY_SINGLE_SUITE_SUCCESSOR', 'rawFiles': raw, 'reviewFiles': pins, 'sourceDraftPaths': source, 'all37OriginalCasesPassed': True, 'totalOriginalFailedCasesResolved': 650, 'remainingOriginalUnresolved': 0, 'futureFullExpectedTests': 5642, 'changedLegacyExpectations': [{'comment': 6169628053, 'oldKeyedAnalysesReceiptCount': 0, 'newCount': 1}], 'applicationFullyVerified': False, 'productionOperations': 0}, indent=2) + '\n').encode())
lead = '## 2026-10-14 #209 last37 exchange/spectral contexts CLOSED sequential PASS9/353\n\nClosed'+summary['closedUtc']+':9 ordinary singles353/353PASS0failedpendingtodo/exact9inventory/full370/all frozen incl shared/generatedPrisma/scenarios/template unchanged/both ordinary setups/worker512MB/blank NODE_OPTIONS/recorded teardown targets held where recorded; no claim of every physical fixture identity. EACH37 original setup ORDER_LINE_REQUIRED classified before declared legacy NULL order for NEW accepted PH/SOC reference witness on existing owner; no new owner/replica/value/method/normalizer. Original V1/V2 publication/scoping/empty-denial/status/503/Retry-After/redaction/400/404/401/profile/accession/replicate6.4+6.5/oneattempt/journal/snapshot/receipt/cache and export1.8percent18gkg/headline/spectral18.5Walkley-Black/null executed method/axis/QC/ETag304/bulk assertions byte-exact recovered. Approved runtime orphans still zero-write refused/kit nonzeroSTOP, no amendment-side step/backfill/relink. All122appdraft/raw child report/log/command/exit/hash/physical/review at issue209-exchange-spectral-context-singles/index.json. Combined650original650 occurrences individually verified by focused proofs; independent updated occurrence ledger NEXT, then full370expected5642. This is NOT full209PASS/PR/ready/finalaudit/merge/kit/gate/production operation. Only derivedhelpmanifest mutable output BEFORE+AFTERbyteshash/freezecore/allshared/Prisma/scenarios/template/others. Original650fullfailure/derivedmanifest/OOM/duplicate-column/diagnostic/header/FKteardown/proof failures immutable/no replay. Native512checkpoint30049/Clnothingneeded once complete/humanDraft/cards preserved/no duplicate notice; four settledscopeanswers/ONE accepted receipt0to1 expectation/runtime orphanreadonly cause+YYlists/approvednonzeroSTOP/noamendmentorderstep/103noapply/206+214greenundeployedopen/historyguards hold.\n\n'
readmes = ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md']
for p in readmes:
    f = root / p
    f.write_bytes(lead.encode() + f.read_bytes())
owned = list(raw) + list(pins) + source + readmes + [Path(__file__).relative_to(root).as_posix(), (wp / 'prepare-issue209-exchange-spectral-context-once.py').relative_to(root).as_posix(), (wp / 'verify-issue209-exchange-spectral-context-singles-once.py').relative_to(root).as_posix(), (dest / 'index.json').relative_to(root).as_posix()]
owned.append((wp / 'prepare-issue209-exchange-terminal-retainer-prefix-bound-once.py').relative_to(root).as_posix())
owned.append((wp / 'prepare-issue209-exchange-terminal-retainer-once.py').relative_to(root).as_posix())
assert all((root / p).exists() for p in owned)
git('add', '-f', '--', *owned)
assert set(git('diff', '--cached', '--name-only').decode().splitlines()) <= set(owned)
for p, pin in {**raw, **pins}.items():
    assert hashlib.sha256(git('show', ':' + p)).hexdigest() == pin['sha256'], p
for p in source:
    assert git('show', ':' + p) == (root / p).read_bytes().replace(b'\r\n', b'\n'), p
git('commit', '-m', 'audit(209): retain final exchange spectral contexts PASS353')
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
print(json.dumps({'auditHead': head, 'passedTests': 353, 'closedSingleSuites': 9, 'rawGitBlobsVerified': len(raw), 'reviewBlobsVerified': len(pins), 'sourceDraftPaths': 122, 'originalCasesResolved': 650, 'remaining': 0, 'productionOperations': 0}))
