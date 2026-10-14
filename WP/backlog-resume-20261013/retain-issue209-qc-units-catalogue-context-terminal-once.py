"""Retain the actual closed QC/unit/catalogue and core/scanner sequential proof, once."""
import datetime, hashlib, json, subprocess, sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root = Path(__file__).resolve().parents[2]
wp = Path(__file__).parent
dest = wp / 'issue209-qc-units-catalogue-context-singles'
review = wp / 'issue209-qc-units-catalogue-context-review'
assert not (dest / 'index.json').exists()
summary = json.loads((dest / 'summary-observed.json').read_bytes())
assert summary['status'] == 'PASS' and summary['closedSuites'] == 9
assert summary['closedTests'] == summary['passedTests'] == 388
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
assert classification['reviewedBeforeChanges'] and len(classification['cases']) == 14
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
source = json.loads((wp / 'issue209-mobile-offline-context-singles/index.json').read_bytes())['sourceDraftPaths']
source = list(dict.fromkeys(source + ['server/tests/contracts/'+n for n in ['qc_controls.test.js','issue_278_texture_closure_policy.test.js','controlled_units_interpretation.test.js','catalogue_result_entry.test.js','catalogue_governance.test.js']]))
assert len(source) == 106
raw = {p.relative_to(root).as_posix(): {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.rglob('*') if p.is_file()}
pins = {p.relative_to(root).as_posix(): {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in review.iterdir() if p.is_file()}
(dest / 'index.json').write_bytes((json.dumps({'retainedUtc': datetime.datetime.now(datetime.UTC).isoformat(), 'summary': summary, 'verificationKind': 'SEQUENTIAL_ORDINARY_SINGLE_SUITE_SUCCESSOR', 'rawFiles': raw, 'reviewFiles': pins, 'sourceDraftPaths': source, 'all14OriginalCasesPassed': True, 'totalOriginalFailedCasesResolved': 580, 'remainingOriginalUnresolved': 70, 'futureFullExpectedTests': 5642, 'changedLegacyExpectations': [{'comment': 6169628053, 'oldKeyedAnalysesReceiptCount': 0, 'newCount': 1}], 'applicationFullyVerified': False, 'productionOperations': 0}, indent=2) + '\n').encode())
lead = '''## 2026-10-14 #209 classified QC/units/catalogue contexts CLOSED sequential PASS9/388

Closed17:00:45.211036UTC: nine ordinary single-suite invocations6+19+8+12+27+139+32+112+33=388/388PASS, zero failed/pending/todo/exact9 inventory/full370 discovery; all frozen inputs incl shared/generatedPrisma/scenarios/held template unchanged/both ordinary setups/worker512MB/blank NODE_OPTIONS/recorded teardown targets held. All14 original cases source-classified before context additions. Only positive fifth QC witness gets context; fourth evidence-free failed-QC refusal unchanged. Fraction triple retains existing three owners/all values/tolerances/pure negative assertions. Controlled units retains11 actual owners and absent EXCH_NA without inventing owner/value; all unit factors/FAO/soil-plant/texture/CN/report semantics unchanged. Catalogue valid measurement and accepted historical witness receive legacy NULL contexts, preserving earlier invalid/scoped/method/unit/duplicate-key refusals and later correction409/snapshot/deletion/unit reinterpretation assertions. Every old source/assertion exactly recovered by removing additions. No runtime/scientific/SQL/scanner changes. All106 draft app paths/raw child reports/logs/commands/exits/hash/held files/review at issue209-qc-units-catalogue-context-singles/index.json. Combined580 original650 verified;70 unresolved. Original occurrence ledger566 remains immutable; future updated ledger must preserve two repeated titles and earlier successful LOQ/policy children of failed aggregate. No runner/full209PASS/PR/ready/finalaudit/merge/kit/gate/production operation. Scope/profile/workspace next17 cases source-read only, not yet edited/classified/tested; preserve first-revision1 scenario with fresh owned runtime-reachable missing-order remedy separately from projection's recorded history, without changing legacy assertion or inventing revision0. Future full370 expected5642/derived help manifest only mutable output before/after raw bytes/hash; freeze source/shared/Prisma/scenarios/template/all others. Native actual unlocked512 checkpoint30049 once complete/Cl nothing needed/no repeated notice/human draft/cards preserved. Four actual scope answers/ONE accepted receipt0to1/runtime orphan refusals/readonly impact lists/approvednonzeroSTOP/no amendmentorderstep/backfill/relink/103noapply/206+214 green undeployed/open/history guards hold.

'''
readmes = ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md']
for p in readmes:
    f = root / p
    f.write_bytes(lead.encode() + f.read_bytes())
owned = list(raw) + list(pins) + source + readmes + [Path(__file__).relative_to(root).as_posix(), (wp / 'prepare-issue209-qc-units-catalogue-context-once.py').relative_to(root).as_posix(), (wp / 'verify-issue209-qc-units-catalogue-context-singles-once.py').relative_to(root).as_posix(), (dest / 'index.json').relative_to(root).as_posix()]
git('add', '-f', '--', *owned)
assert set(git('diff', '--cached', '--name-only').decode().splitlines()) <= set(owned)
for p, pin in {**raw, **pins}.items():
    assert hashlib.sha256(git('show', ':' + p)).hexdigest() == pin['sha256'], p
for p in source:
    assert git('show', ':' + p) == (root / p).read_bytes().replace(b'\r\n', b'\n'), p
git('commit', '-m', 'audit(209): retain QC unit catalogue contexts PASS388')
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
print(json.dumps({'auditHead': head, 'passedTests': 388, 'closedSingleSuites': 9, 'rawGitBlobsVerified': len(raw), 'reviewBlobsVerified': len(pins), 'sourceDraftPaths': 106, 'originalCasesResolved': 580, 'remaining': 70, 'productionOperations': 0}))
