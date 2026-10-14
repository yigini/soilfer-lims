"""Retain the actual closed numerical/provenance and core/scanner sequential proof, once."""
import datetime, hashlib, json, subprocess, sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root = Path(__file__).resolve().parents[2]
wp = Path(__file__).parent
dest = wp / 'issue209-validation-provenance-context-singles'
review = wp / 'issue209-validation-provenance-context-review'
assert not (dest / 'index.json').exists()
summary = json.loads((dest / 'summary-observed.json').read_bytes())
assert summary['status'] == 'PASS' and summary['closedSuites'] == 11
assert summary['closedTests'] == summary['passedTests'] == 354
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
assert len(reports) == 11
classification = json.loads((review / 'pre-correction-classification.json').read_bytes())
assert classification['reviewedBeforeChanges'] and len(classification['cases']) == 21
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
source = json.loads((wp / 'issue209-resubmission-report-revisions-context-singles/index.json').read_bytes())['sourceDraftPaths']
source = list(dict.fromkeys(source + ['server/tests/'+n for n in ['contracts/audit_0_14_number_entry.test.js','contracts/mandatory_reason.test.js','contracts/matrix_blocking_diagnostics.test.js','contracts/matrix_validation.test.js','contracts/prerequisite_gate.test.js','contracts/result_provenance.test.js','scenarios/scientific_validation.test.js']]))
assert len(source) == 99
raw = {p.relative_to(root).as_posix(): {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.rglob('*') if p.is_file()}
pins = {p.relative_to(root).as_posix(): {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in review.iterdir() if p.is_file()}
(dest / 'index.json').write_bytes((json.dumps({'retainedUtc': datetime.datetime.now(datetime.UTC).isoformat(), 'summary': summary, 'verificationKind': 'SEQUENTIAL_ORDINARY_SINGLE_SUITE_SUCCESSOR', 'rawFiles': raw, 'reviewFiles': pins, 'sourceDraftPaths': source, 'all21OriginalCasesPassed': True, 'totalOriginalFailedCasesResolved': 554, 'remainingOriginalUnresolved': 96, 'futureFullExpectedTests': 5642, 'changedLegacyExpectations': [{'comment': 6169628053, 'oldKeyedAnalysesReceiptCount': 0, 'newCount': 1}], 'applicationFullyVerified': False, 'productionOperations': 0}, indent=2) + '\n').encode())
lead = '''## 2026-10-14 #209 classified numerical/matrix/provenance contexts CLOSED sequential PASS11/354

Closed16:46:39.388340UTC: eleven ordinary single-suite invocations13+5+2+3+5+6+4+139+32+112+33=354/354PASS, zero failed/pending/todo/exact11inventory/full370 discovery. Frozen inputs incl shared/generatedPrisma/scenarios/held template unchanged; both ordinary setups/worker512MB/blank NODE_OPTIONS/held recorded DB triples. All21 original cases source-classified before contexts; original HTTP409/null/no-attempt/zero-replicate symptoms retained and downstream explanation labelled source inference, no invented old body code. Only NEW owned legacy NULL orders for existing owners and later assembled PH/TEXTURE lines. Earlier no-attempt, malformed/numeric-range and preparation negatives remain orderless. All old source/assertions byte-identically recovered; numerical raw/censoring/policy, texture values/normalization/closure, QC/provenance, two replicate selection/basis, reason/refusal, SQL/runtime/scanner guards unchanged. All99 appdraft paths/raw child reports/logs/commands/exits/hash/held files/review evidence at issue209-validation-provenance-context-singles/index.json. Combined554 original650 verified;96 unresolved. No runner/full209PASS/PR/ready/finalaudit/merge/kit/gate/production operation. Mobile/offline next12 original cases source-read only, NOT yet changed/classified/verified. Native unlocked512 checkpoint sent once/actual Cl nothing needed from YY/Cl, next full run/PR/audit; evidence30049 immutable/never repeat. Human centre draft/cards/103noapply untouched. Future full370 expected5642; derived help manifest only mutable captured output, freeze source/shared/Prisma/scenarios/template/all others. Four actual scope answers settled; ONE accepted legacy receipt0to1 separately listed. Runtime orphan zero-write refusals/readonly impact lists/approvednonzeroSTOP/no amendmentorderstep/backfill/relink/206+214 green undeployed/open/history guards hold.

'''
readmes = ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md']
for p in readmes:
    f = root / p
    f.write_bytes(lead.encode() + f.read_bytes())
owned = list(raw) + list(pins) + source + readmes + [Path(__file__).relative_to(root).as_posix(), (wp / 'prepare-issue209-validation-provenance-context-once.py').relative_to(root).as_posix(), (wp / 'verify-issue209-validation-provenance-context-singles-once.py').relative_to(root).as_posix(), (dest / 'index.json').relative_to(root).as_posix()]
git('add', '-f', '--', *owned)
assert set(git('diff', '--cached', '--name-only').decode().splitlines()) <= set(owned)
for p, pin in {**raw, **pins}.items():
    assert hashlib.sha256(git('show', ':' + p)).hexdigest() == pin['sha256'], p
for p in source:
    assert git('show', ':' + p) == (root / p).read_bytes().replace(b'\r\n', b'\n'), p
git('commit', '-m', 'audit(209): retain numerical and provenance contexts PASS354')
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
print(json.dumps({'auditHead': head, 'passedTests': 354, 'closedSingleSuites': 11, 'rawGitBlobsVerified': len(raw), 'reviewBlobsVerified': len(pins), 'sourceDraftPaths': 99, 'originalCasesResolved': 554, 'remaining': 96, 'productionOperations': 0}))
