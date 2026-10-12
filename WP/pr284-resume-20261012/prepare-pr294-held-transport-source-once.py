"""Retain one transport-only proposal. No gate, host creation or deployment."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys

d = Path(__file__).resolve().parent
source = sys.argv[1]
assert len(source) == 40 and all(c in '0123456789abcdef' for c in source)
reference = 'e4d692a0c0eaed34017f4419172dfcf8db563be0'
short = source[:8]
export = d / ('production-source-export-' + short)
assert not export.exists()
graph = {}
exec(compile(subprocess.check_output(['git', 'show', source + ':WP/pr284-release/import_source_graph.py']),
    '/owned-raw-source-graph.py', 'exec'), graph)
raw, index = graph['git_source'](source, lambda *args: subprocess.check_output(['git', *args]))
original, _ = graph['git_source']('201bb5fe8fd30cb2991f7169177a864265e6301b',
    lambda *args: subprocess.check_output(['git', *args]))
assert len(raw) == 31 and raw == original
paths = {name: 'WP/pr284-release/' + name for name in [
    'import_release_contract.py', 'deploy_import.py', 'freeze_import.py',
    'known_core_disk_guard_import_deploy.py', 'collect_import_gate.py',
    'export_freeze_import_kit.py', 'launch_import_release.py', 'production_output_paths.py',
    'yy-maintenance-choice-evidence.json', 'held-entry-scope-review.json', 'held-entry-receipt.json']}
paths['yy-authorization-evidence.md'] = 'WP/forward-ae64f169/yy-authorization-evidence.md'
for name, path in paths.items():
    raw[name] = subprocess.check_output(['git', 'show', source + ':' + path])
    index['files'][name] = {'path': path,
        'blob': subprocess.check_output(['git', 'rev-parse', source + ':' + path]).decode().strip(),
        'sha256': hashlib.sha256(raw[name]).hexdigest(), 'bytes': len(raw[name])}
assert len(raw) == 43
changed = [name for name, item in index['files'].items() if raw[name] !=
    subprocess.check_output(['git', 'show', reference + ':' + item['path']])]
assert set(changed) == {'collect_import_gate.py', 'launch_import_release.py'}, changed
export.mkdir()
for name, value in raw.items():
    if name.endswith('.py'): compile(value, '/owned-compile-only/' + name, 'exec')
    with (export / name).open('xb') as out: out.write(value)
sys.path.insert(0, str(export))
import import_release_contract as c
assert set(raw) == c.PACKAGE_SOURCE_FILES
hashes = {name: hashlib.sha256(value).hexdigest() for name, value in raw.items()}
guards = {}
for platform in ['windows', 'linux']:
    record = json.loads((d / ('production-isolation-guards-' + short + '-' + platform) / 'result.json').read_bytes())
    assert record['sourceCommit'] == source and record['exitCode'] == 0
    row = record['summary']
    assert row['tests'] == 206 and row['failures'] == row['errors'] == row['skips'] == 0
    assert row['productionDatabaseAccess'] is False
    guards[platform] = record
diagnosis = json.loads((d / 'held-preflight-60s-diagnosis/result.json').read_bytes())
assert diagnosis['status'] == 'COMPLETED_READ_ONLY_DIAGNOSIS' and diagnosis['exitCode'] == 0
timings = [json.loads(line) for line in (d / 'held-preflight-60s-diagnosis/stdout.jsonl').read_text().splitlines()]
ready = timings[-1]['readiness']
assert ready['ready'] and ready['productionMutations'] == 0 and ready['outputPreflight']['gatePresent'] is False
assert 180 - diagnosis['elapsedSeconds'] > 60 and 210 - diagnosis['elapsedSeconds'] - 20 > 60
tokens = c.release_binding_tokens() + c.source_policy_tokens() + [source, c.REVIEWED_PROOF_SOURCE,
    'proofSourceReviewId=' + str(c.PROOF_SOURCE_REVIEW_ID),
    'GATE_TRANSPORT_TIMEOUT_SECONDS=180', 'LAUNCH_TRANSPORT_TIMEOUT_SECONDS=210']
tokens += [name + '=' + value for name, value in sorted(hashes.items())]
main_raw = subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/git/ref/heads/main'])
ci_raw = subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/actions/runs/38256676268'])
assert json.loads(main_raw)['object']['sha'] == c.CANDIDATE_HEAD
ci = json.loads(ci_raw)
assert ci['head_sha'] == c.CANDIDATE_HEAD and ci['status'] == 'completed' and ci['conclusion'] == 'success'
namespace = c.namespace_binding(c.FROZEN_FILE_SET)
record = {'preparedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'PROPOSED_TRANSPORT_ONLY_SOURCE_NOT_APPROVED_NOT_EXECUTED',
    'sourceCommit': source, 'sourceIndex': index, 'sourceHashes': hashes, 'sourceFileCount': 43,
    'futureFrozenFiles': 66, 'all31ProofBytesUnchanged': True, 'changedPackageFiles': sorted(changed),
    'entryBinding': c.entry_binding(), 'outputNamespace': namespace, 'guards': guards,
    'requiredReviewTokens': tokens, 'readOnlyDiagnosis': diagnosis, 'productionOperations': 0}
with (d / ('production-source-' + short + '-preparation.json')).open('x', encoding='utf-8', newline='\n') as out:
    json.dump(record, out, indent=2)
for label, value in [('current-main', main_raw), ('main-ci', ci_raw)]:
    with (d / ('production-request-' + short + '-' + label + '.json')).open('xb') as out: out.write(value)
request = f'''NEW Source review request: measured held-entry transport amendment only

Exact proposed source {source}. Prior e4SourcePASS6132295413 and unused202400kitPASS6132501037 are retained; neither authorises changed source. No gate or production attempt has been collected or started for202400. That original kit stays unchanged and unused, excluded from this new execution chain.

Actual independent READ-ONLY preflight first timed out at the local SSH60s limit. A single instrumented diagnostic then ran every unchanged reviewed check and completed with ready=true/productionMutations0: remote58.903106s, total SSH transport{diagnosis['elapsedSeconds']:.9f}s. Frozen checks0.175529s; original proof hashes48.797910s; held-entry checks8.913909s (all-writers0.704566s, raw triple4.044012s). No live SQLite connection, installer, copy, gate or production write. Full original physical triple/backup/hash checks passed. Free71166885888B vs required20152939429B including16DBallocations, above floor10556150894B. Raw diagnostic stdoutSHA{diagnosis['stdoutSha256']}, stderr empty. These timings are measured evidence, not permission to silently change limits.

ONLY TWO of43 package source files differ from e4: collect_import_gate.py changes its local SSH transport budget60->180s (GATE_TRANSPORT_TIMEOUT_SECONDS=180); launch_import_release.py changes its local SSH transport budget90->210s (LAUNCH_TRANSPORT_TIMEOUT_SECONDS=210). The180s budget leaves119.844s over the measured full transport; launcher210 covers the same preflight, unchanged20s systemd dispatch and10s additional transport allowance. The collector still runs complete physical preflight twice, before gathering evidence and before exclusive remote gate creation. Gate verifiedUtc is set only after fresh GitHub evidence/current main re-read, and unchanged600s freshness is rechecked after the second preflight before gate write and again before dispatch and execution. No cache, skipped hash, retry, override or bypass. A timeout/refusal/invalid response still propagates with no retry; an uncertain launch is observed rather than dispatched again.

All other41 package files and ALL31 approved201bb proof bytes are identical to e4. No change to deploy_import.py, contract, freezer, output catalog, held entry, source graph, migration, stage/readiness600s deadlines, systemd20s dispatch, production5400s unit, stage60s/unit600s measured headroom,768MiB/blankheap,16allocations,500MB unexplained growth, exact row/schema preservation, original cursor15min interval, or workload pins. Remote0400 and Windows local0444 rules remain unchanged. ALL206/206 exact-source Windows and206/206 Linux guards PASS,0fail/error/skip/no productionDB. Two added tests exercise actual transport function bodies with owned subprocess mocks: success beyond old60s, propagated timeout/nonzero/invalid JSON without retry; launch verifies preflight-before-dispatch, unchanged20s/5400s bounds, and no redispatch on timeout.

ONE distinct future package /opt/lims/releases/instrument-import-package-959d17e1-20261012T213000Z and kit /opt/lims/releases/instrument-import-release-959d17e1-20261012T213000Z may be frozen ONLY after actual NEW Source review: PASS, from original stopped PASSED144000Z proof f2aff and original valid135400Z build1a983/image7aeb. No new proof/build/rehearsal, no failed root contribution, no retry/replay/refreeze of202400 or161000. Packaging-only900s/SSH960s limits unchanged. After the stopped proof is reverified and the new immutable kit exists, request NEW exact-kit Audit passed: OK to merge and deploy, then only actual approval/current head/all green/unused kit/fresh headroom -> ONE fresh10minute single-use gate -> ONE new forward deployment under original YY Auto-after-review go.

Actual main959d17e1/mainCI38256676268SUCCESS and appaudit6125341751 unchanged. YY original B Stay in maintenance and your scope6131752416 remain bound; production staysSTOPPED_HELD_UNAPPLIED. Failed161000 receipt2a03 is entry evidence ONLY, never proof/replay authority; consumed gate/root/outputs remain burned forever. No restore, previous image start, installer replay, heap raise or cleanup. Other app merges stay held until#200live and your actual postcheck; you own closure/ticks. No further YY decision is requested.

Please post NEW Source review: PASS binding the full source commit, the two transport constants and every43 raw name=sha256/policy/entry token below. Unchanged proof/build/source/YY history remains original.

''' + '\n'.join(tokens) + '\n'
path = d / ('production-source-' + short + '-request.md')
with path.open('x', encoding='utf-8', newline='\n') as out: out.write(request)
print(json.dumps({'sourceCommit': source, 'changedPackageFiles': sorted(changed),
    'sourceFileCount': 43, 'all31ProofBytesUnchanged': True,
    'requestSha256': hashlib.sha256(request.encode()).hexdigest(), 'productionOperations': 0}))
