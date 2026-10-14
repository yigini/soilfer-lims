"""Retain the actual closed QC118 and core/scanner sequential proof, once."""
import datetime, hashlib, json, subprocess, sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root = Path(__file__).resolve().parents[2]
wp = Path(__file__).parent
dest = wp / 'issue209-qc-disposition-context-singles'
review = wp / 'issue209-qc-disposition-context-review'
assert not (dest / 'index.json').exists()
summary = json.loads((dest / 'summary-observed.json').read_bytes())
assert summary['status'] == 'PASS' and summary['closedSuites'] == 5
assert summary['closedTests'] == summary['passedTests'] == 336
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
assert len(reports) == 5
classification = json.loads((review / 'pre-correction-classification.json').read_bytes())
assert classification['reviewedBeforeChanges'] and len(classification['cases']) == 20
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
source = json.loads((wp / 'issue209-result-views-legacy-review-context-singles/index.json').read_bytes())['sourceDraftPaths']
source = list(dict.fromkeys(source + ['server/tests/contracts/qc_disposition_release_gate.test.js']))
assert len(source) == 89
raw = {p.relative_to(root).as_posix(): {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.rglob('*') if p.is_file()}
pins = {p.relative_to(root).as_posix(): {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in review.iterdir() if p.is_file()}
(dest / 'index.json').write_bytes((json.dumps({'retainedUtc': datetime.datetime.now(datetime.UTC).isoformat(), 'summary': summary, 'verificationKind': 'SEQUENTIAL_ORDINARY_SINGLE_SUITE_SUCCESSOR', 'rawFiles': raw, 'reviewFiles': pins, 'sourceDraftPaths': source, 'all20OriginalCasesPassed': True, 'totalOriginalFailedCasesResolved': 512, 'remainingOriginalUnresolved': 138, 'futureFullExpectedTests': 5642, 'changedLegacyExpectations': [{'comment': 6169628053, 'oldKeyedAnalysesReceiptCount': 0, 'newCount': 1}], 'applicationFullyVerified': False, 'productionOperations': 0}, indent=2) + '\n').encode())
lead = '''## 2026-10-14 #209 classified QC118 order contexts CLOSED sequential PASS5/336

Closed16:26:30.064290UTC: five ordinary single-suite invocations20+139+32+112+33=336/336PASS, zero failed/pending/todo, exact five-suite inventory/full370 discovery, all frozen inputs unchanged including shared/generatedPrisma/held template, both ordinary setups, worker512MB and blank NODE_OPTIONS. All20 original QC118 cases classified before edits. Seventeen direct execution witnesses and two REANALYZE fixture assemblies declare usable legacy NULL order contexts for actual existing canonical owners in the owned test database. Existing line identities, duplicate-child owners, values/units/QC flags, terminal/published/superseded history, roles/scope/concurrency/queue/membership and all original assertions remain unchanged. Removing additions recovers every byte of the original file. Core keyed-mode139/orphans32/scanners145 also passed; runtime/scientific/schema/scanner guards unchanged. All89 draft application paths and raw closed reports/logs/commands/exits/hash/provenance are retained at issue209-qc-disposition-context-singles/index.json. Combined512 of650 original failed cases independently verified;138 unresolved. These are focused sequential proofs, no full209PASS/PR/ready/final audit/merge/kit/gate/production operation. Future full370 expected5642; derived help manifest alone captured as mutable output before/after bytes/hash, all source/other inputs frozen. User confirmed Windows unlocked; fresh returned Claude7867734 now shows actual LIMS Audit/Lab workflow audit and plan and the prior answered6169628053; right composer empty, centre human draft preserved. No new native message yet. All four Claudio scope answers settled; never duplicate questions/old handoffs. ONE accepted keyed receipt expectation0to1 remains listed explicitly. Same writer/readonly impact lists/approved nonzero STOP/no amendment order step/backfill/relink/103noapply/206+214 source-green undeployed/open/history guards hold.

'''
readmes = ['WP/audit-release-eb6de2e8/README.md', 'WP/runtime-recovery-kobo/README.md']
for p in readmes:
    f = root / p
    f.write_bytes(lead.encode() + f.read_bytes())
owned = list(raw) + list(pins) + source + readmes + [Path(__file__).relative_to(root).as_posix(), (wp / 'prepare-issue209-qc-disposition-context-once.py').relative_to(root).as_posix(), (wp / 'verify-issue209-qc-disposition-context-singles-once.py').relative_to(root).as_posix(), (dest / 'index.json').relative_to(root).as_posix()]
git('add', '-f', '--', *owned)
assert set(git('diff', '--cached', '--name-only').decode().splitlines()) <= set(owned)
for p, pin in {**raw, **pins}.items():
    assert hashlib.sha256(git('show', ':' + p)).hexdigest() == pin['sha256'], p
for p in source:
    assert git('show', ':' + p) == (root / p).read_bytes().replace(b'\r\n', b'\n'), p
git('commit', '-m', 'audit(209): retain QC118 order contexts PASS336')
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
print(json.dumps({'auditHead': head, 'passedTests': 336, 'closedSingleSuites': 5, 'rawGitBlobsVerified': len(raw), 'reviewBlobsVerified': len(pins), 'sourceDraftPaths': 89, 'originalCasesResolved': 512, 'remaining': 138, 'productionOperations': 0}))
