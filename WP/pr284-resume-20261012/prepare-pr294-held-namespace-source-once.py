"""Retain one exact source proposal; no host creation or production operation."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys

d = Path(__file__).resolve().parent
w = d.parent.parent
source = sys.argv[1]
assert len(source) == 40 and all(character in '0123456789abcdef' for character in source)
short = source[:8]
export = d / ('production-source-export-' + short)
assert not export.exists(), 'Never overwrite an exported source'
graph = {}
exec(compile(subprocess.check_output(['git', 'show', source + ':WP/pr284-release/import_source_graph.py']),
    '/owned-raw-source-graph.py', 'exec'), graph)
raw, index = graph['git_source'](source, lambda *args: subprocess.check_output(['git', *args]))
original, original_index = graph['git_source']('201bb5fe8fd30cb2991f7169177a864265e6301b',
    lambda *args: subprocess.check_output(['git', *args]))
assert len(raw) == 31 and raw == original, 'Every approved proof byte must remain unchanged'
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
export.mkdir()
for name, value in raw.items():
    if name.endswith('.py'): compile(value, '/owned-compile-only/' + name, 'exec')
    with (export / name).open('xb') as out: out.write(value)
sys.path.insert(0, str(export))
import import_release_contract as c
hashes = {name: hashlib.sha256(value).hexdigest() for name, value in raw.items()}
assert set(raw) == c.PACKAGE_SOURCE_FILES and len(c.FROZEN_FILE_SET) == 66
assert hashes['held-entry-receipt.json'] == c.HELD_FAILURE_RECEIPT_SHA
assert hashes['held-entry-scope-review.json'] == c.HELD_ENTRY_SCOPE_SHA
assert hashes['yy-maintenance-choice-evidence.json'] == c.YY_MAINTENANCE_EVIDENCE_SHA
c.held_entry_authority(*(json.loads(raw[name]) for name in
    ['held-entry-receipt.json', 'yy-maintenance-choice-evidence.json', 'held-entry-scope-review.json']))
guards = {}
for platform in ['windows', 'linux']:
    row = json.loads((d / ('production-isolation-guards-' + short + '-' + platform) / 'result.json').read_bytes())
    assert row['sourceCommit'] == source and row['exitCode'] == 0
    result = row['summary']
    assert result['tests'] == 203 and result['failures'] == result['errors'] == result['skips'] == 0
    assert result['productionDatabaseAccess'] is False
    guards[platform] = row
tokens = c.release_binding_tokens() + c.source_policy_tokens() + [source, c.REVIEWED_PROOF_SOURCE,
    'proofSourceReviewId=' + str(c.PROOF_SOURCE_REVIEW_ID)]
tokens += [name + '=' + digest for name, digest in sorted(hashes.items())]
main_raw = subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/git/ref/heads/main'])
ci_raw = subprocess.check_output(['gh', 'api', 'repos/yigini/soilfer-lims/actions/runs/38256676268'])
assert json.loads(main_raw)['object']['sha'] == c.CANDIDATE_HEAD
ci = json.loads(ci_raw)
assert ci['head_sha'] == c.CANDIDATE_HEAD and ci['status'] == 'completed' and ci['conclusion'] == 'success'
namespace = c.namespace_binding(c.FROZEN_FILE_SET)
preparation = {'preparedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'PROPOSED_HELD_NAMESPACE_SOURCE_NOT_APPROVED_NOT_EXECUTED', 'sourceCommit': source,
    'sourceIndex': index, 'sourceHashes': hashes, 'sourceFileCount': 43, 'futureFrozenFiles': 66,
    'all31ProofBytesUnchanged': True, 'entryBinding': c.entry_binding(),
    'outputNamespace': namespace, 'guards': guards, 'requiredReviewTokens': tokens,
    'productionOperations': 0}
with (d / ('production-source-' + short + '-preparation.json')).open('x', encoding='utf-8', newline='\n') as out:
    json.dump(preparation, out, indent=2)
for label, value in [('current-main', main_raw), ('main-ci', ci_raw)]:
    with (d / ('production-request-' + short + '-' + label + '.json')).open('xb') as out: out.write(value)
request = f'''NEW production-source review request: frozen/output isolation and exact YY maintenance entry

Exact proposed source {source}, 43 raw Git files, 66 future frozen files plus manifest. This implements your #162 scope6131470499 and held-entry pin6131752416. It is a source request only; no new kit, gate or production operation exists.

The original161000Z production failed after DRY and before APPLY because exclusive creation met frozen evidence. Failed receipt2a03, consumed gate14dd, root/unit/container and outputs remain stopped, immutable and burned forever. No retry, replay, move, deletion or cleanup. The unchanged stopped144000Z PASSED proof and original135400Z build remain the sole proof/build authority. All31 proof source files equal201bb5fe byte for byte, including import_stage.py. No application, migration, original row/schema, copy, scheduler, cursor/interval, memory, disk or timing policy changes.

Frozen sources and evidence now live exclusively in frozen/. Generated CLI/probe/readiness/seal/receipt/log outputs remain at the execution root. Every corresponding reader uses explicit hash-bound frozen paths. production_output_paths.py lists finite paths, nested seal/scratch/raw/backup/SQLite sidecars and anchored timestamped log families; its complete catalog is in the manifest and gate. The closed unused-root check refuses ALL existing prospective or unknown outputs, including hidden paths and symlinks. It runs after freeze, before collecting/installing the gate, before execution intent, and again immediately before quiesce (allowing only just-created intent/receipt/ledger). No collision is deferred until after stopping writers.

203/203 exact-source Windows and203/203 exact-source Linux guards PASS,0failure/error/skip/no production DB access. The local end-to-end test executes the real unchanged install_once with production=True, owned synthetic SQLite, all62 retained historical frozen names and stubbed CLI/seals. It reaches completed repeat with zero repeat changes and every frozen byte unchanged. Entry tests reject running, renamed, OOM, other container/image/ingress/physical triple, unauthorised card choice, old scope and changed receipt/backup authority. A freezer regression checks the same full held-entry observation before any destination creation; the obsolete healthy-entry placeholder is removed. Raw logs and source hashes are retained under WP/pr284-resume-20261012/production-isolation-guards-{short}-{{windows,linux}}. The earlier6b0 proposal was prepared locally and NOT posted; a final cross-check found its obsolete freezer call, corrected here. No host operation occurred.

YY's original native card B Stay in maintenance/You chose10:07PM Europe/Rome was directly read, never answered by Pip. The corrected source accepts ONLY STOPPED_HELD_UNAPPLIED: original51f container977334bc stopped/notrenamed, held ingressd926, exact original raw triple3dcf and backup70ee, no APPLY/repeat/startup outputs and no other writer. RUNNING_NORMAL is unreachable. Raw choice, your actual6131752416 API record and exact failed receipt2a03 are hash-bound sources, manifest/gate/review tokens. That failed receipt is held-entry evidence ONLY, never proof or replay authority.

Fresh GitHub main remains959d17e1; mainCI38256676268 is completedSUCCESS, original PR294 audit6125341751 and CI38247731718 remain bound. Original proofSource201bb/6126765238, receiptf2aff, buildreceipt1a983/image7aeb stand. Proposed ONE distinct package /opt/lims/releases/instrument-import-package-959d17e1-20261012T202400Z and kit /opt/lims/releases/instrument-import-release-959d17e1-20261012T202400Z may be created only after actual NEW Source review: PASS, exclusively from original stoppedPASS144000Z. No new proof, build or failed-root reuse. Then NEW exact-kit Audit passed: OK to merge and deploy, all fresh green/currenthead/unusedkit/headroom, ONE single-use10minute gate and ONE separately reviewed forward deployment under existing Autoafterreviewgo. Other app merges remain held until#200live and your actual postchecks.

Production remains maintenance/jobsHOLD. Latest independent full physical observation19:45 proves original DB/WAL/SHM attributes and bytes/backup/all62 old frozen files/original proof unchanged; this is historical evidence, not a fresh SQL claim. All new preflights recheck actual held state. Absolute/scaled reserve,16 allocations,500MB unexplained-growth abort,768MiB/blankheap,600s readiness/5400s unit,60s stage/600s unit headroom and both workload pins unchanged. Packaging-only900s/SSH960s transport remains reviewed and retained. No restore, older image start, installer replay, override or cleanup.

Please post NEW primary Source review: PASS with this full source commit, all43 raw name=sha256 tokens and the policy/entry/release bindings below. Prior source/kit approvals cannot authorise this changed source.

''' + '\n'.join(tokens) + '\n'
with (d / ('production-source-' + short + '-request.md')).open('x', encoding='utf-8', newline='\n') as out:
    out.write(request)
print(json.dumps({'status': preparation['status'], 'sourceCommit': source,
    'sourceFileCount': 43, 'futureFrozenFiles': 66, 'all31ProofBytesUnchanged': True,
    'requestSha256': hashlib.sha256(request.encode()).hexdigest(),
    'outputCatalogSha256': namespace['catalogSha256'], 'productionOperations': 0}))
