"""Export exact committed tooling for review only; never build or start a writer."""
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import sys

repo = Path(__file__).resolve().parents[2]
directory = Path(__file__).resolve().parent
source = '630b2354a1a45df0d88545ac5c63594361615999'
graph = {}
exec(compile(subprocess.check_output(['git', 'show', source + ':WP/pr284-release/import_source_graph.py'], cwd=repo),
    '/owned-review-graph.py', 'exec'), graph)
files, index = graph['git_source'](source, lambda *args: subprocess.check_output(['git', *args], cwd=repo))
export = directory / 'proof-source-export-630b2354'
assert not export.exists(), 'Never overwrite a source export'
export.mkdir()
for name, raw in files.items():
    with (export / name).open('xb') as stream:
        stream.write(raw)
    if name.endswith('.py'):
        compile(raw, str(export / name), 'exec')
with (export / 'source-index.json').open('x', encoding='utf-8', newline='\n') as stream:
    json.dump(index, stream, indent=2)
sys.path.insert(0, str(export))
import import_proof_contract as contract
contract.bound_candidate()
contract.require_first_proof_root(contract.EXPECTED_PROOF_ROOT)
assert contract.AUDIT_REVIEW_ID == 6125341751 and contract.PR_NUMBER == 294
assert contract.CANDIDATE_HEAD == '959d17e11c357266f7c2a41b0c84ab76914c591e'
guards = {}
for platform in ['windows', 'linux']:
    prefix = directory / ('pr294-merged-source-630b2354-' + platform + '-1344')
    raw_record = json.loads(prefix.with_suffix('.json').read_bytes())
    value = raw_record['result']
    assert raw_record['exitCode'] == 0 and value['sourceCommit'] == source and value['tests'] == 175
    assert value['failures'] == value['errors'] == value['skips'] == 0 and value['productionDatabaseAccess'] is False
    assert value['toolingIndex'] == index
    for kind in ['stdout', 'stderr']:
        assert hashlib.sha256(prefix.with_suffix('.' + kind + '.log').read_bytes()).hexdigest() == raw_record[kind + 'Sha256']
    guards[platform] = {key: value[key] for key in ['tests', 'failures', 'errors', 'skips', 'elapsedSeconds', 'completedUtc']}
    guards[platform].update({key: raw_record[key] for key in ['stdoutSha256', 'stderrSha256']})
for name in ['migration.sql', 'fresh-prisma-tables.json', 'pre-prisma-draft-table.sql',
        'upgraded-prisma-draft-table.sql', 'post205-draft-tables.json']:
    assert files[name] == subprocess.check_output(['git', 'show', contract.CANDIDATE_HEAD + ':' + graph['SOURCE_PATHS'][name]], cwd=repo)
mount_raw = (directory / 'import-mount-ad49-103100.json').read_bytes()
mount = json.loads(json.loads(mount_raw)['stdout'])
assert mount['status'] == 'REAL_OWNED_WAL_MOUNT_GUARD_PASS' and mount['installerAttempts'] == 0
assert mount['importInstallationSha256'] == index['files']['import_installation.py']['sha256']
tokens = contract.release_binding_tokens() + [source, 'labAndHubBuildsOwnedByYY=true',
    'RELEASE_DAY_DISK_ABORTS_ACCEPTED', 'CORE_DEALLOCATION_CONFIRMATION_DEADLINE_SECONDS=10',
    'BASELINE_ATTEMPTS_MAX=3', 'BASELINE_CONFIRMATION_DEADLINE_SECONDS=10',
    'proofBaselineLayoutPolicy=EXACT_HASHED_IMPORT_PROOF_AUTHORITY_LAYOUT',
    'refusalScopeCommentId=' + str(contract.REFUSAL_SCOPE_COMMENT_ID), contract.REFUSAL_POLICY,
    contract.CARDINALITY_POLICY, 'refusalPairingScopeCommentId=' + str(contract.REFUSAL_PAIRING_SCOPE_COMMENT_ID),
    'schedulerRefusalPairing=' + contract.REFUSAL_PAIRING_POLICY, 'REFUSAL_PAIR_WINDOW_SECONDS=1']
tokens += [name + '=' + item['sha256'] for name, item in sorted(index['files'].items())]
body = '''Claudio: NEW PR294 / #200 proof-build source review request. This is a review request, not execution authority.

Exact source630b2354a1a45df0d88545ac5c63594361615999 is pushed. Your application PASS6125341751 covers PR294 head5e65fe5b587747efc717f167f9b61469effa9afe. The actual merge959d17e11c357266f7c2a41b0c84ab76914c591e has parents5dd5488d138514351fffd54d0b0232ae19fcb64d+5e65fe5b587747efc717f167f9b61469effa9afe and the identical audited tree336223df0161caeae4eb7db1e40df748d8ba110f. Pip independently verified all exact application/CI/Docker gates before the merge. Main CI38256676268 is still running; the isolated proof requires its actual SUCCESS.

The ONE exact first proof root is /opt/lims/releases/instrument-import-proof-959d17e1-20261012T134000Z, with unit lims-owned-instrument-import-proof-959d17e1-20261012t134000z.service. The suffix is a reserved identifier; no run or copy exists there. A read-only host lexists check confirmed that the path was absent before binding. require_first_proof_root runs before copying or any CLI in both launcher and coordinator and is checked again by proof validation/freezing. No later successful retry can replace this first run; any failure seals the root permanently and requires another separately reviewed forward source. The failed f5e105200 root/receipt511c1951 stays sealed and explicitly excluded even if somebody pins it.

Compared with your read-only4090 pre-review, only import_proof_contract.py changes: actual audit ID, merge/tree and exact timestamped root are now bound. The five application changes are already merged and frozen. Compared with the former f5e source, the closed native historical schema pair is recognized exactly, preserving inline uniqueness/default/foreign-key constraints; all six old variants and migration bytes remain unchanged. No generic schema allowance or analytical backfill. Original full104tables/38receipts/schema/rows are protected; only empty additive import tables plus nullable WorkItemDraft.importReceiptId are permitted, yielding106tables/39receipts.

The new reviewed-first-root and timing amendments from the pre-review remain unchanged. All three native CLI and both readiness elapsed times must be actual, finite, positive and at most540s, leaving60s against each600s timeout. Their sum plus660s production health observation must leave at least600s of the5400s production unit. The report explicitly says MEASURED_STAGES_ONLY_NOT_TOTAL_PRODUCTION_WALL_TIME; quiesce, backup, seals, API probes, ingress and coordination costs remain unmeasured for production-source/exact-kit review. This timing requirement is checked only after a full successful proof; a margin refusal still burns the first root. Prior51f readiness proof102.867705434/103.132669299s and production102.358188913/102.734928024s are historical evidence only, never a candidate measurement or PASS. Original receipt bytes were verified unchanged in the retained7e0dc8de timing record.

The separate owned0400 dry copy, writable sidecar directory, unmounted apply target/backup, physical triple/full-state preservation and single-use intent before each native attempt remain unchanged. The retained real WAL-header mount witness from10:30:32UTC has identical installer bytes at this source and no production DB mount/installer attempt. Do not rerun that witness. CLI containers retain network none/memory=swap805306368/blank heap/exact mount checks/zero restart/OOM. Both default-entrypoint jobs-OFF readinesses require23NO_OP0/22READY0/31+6 probes and full WAL-aware zero-change seals. The distinct same-image jobs-ON proof uses the original cursor/config/15-minute interval, actual pending upstream ids, two natural completions, interval+2min and660healthy seconds; no manufactured intake/config/time changes. Existing-row protection and the four exact refusal policies remain closed.

All175/175Windows and175/175Linux exact-source guards pass with0failures/errors/skips and no production DB access. All31 raw graph files compile, all five schema assets equal the actual application merge, and all14 historical helpers/oldV2V3guards remain byte-identical. THIRTEEN retained DB allocations,10556150894B/scaled reserve plus assets/state/log headroom,500MB unexplained-growth abort and both workload pins remain mandatory. Optional broad failure-substring classifier refactor was left unchanged.

No new build/proof/frozenkit/gate/production operation has occurred. Production stays on51f/d4eb; the completedPR293 and original5dd build92be/image5757 are retained and never replayed/reused. This corrected head needs one new build only after this NEW source pass. Production source binding is deliberately still UNREVIEWED_NATIVE_FORWARD_REFUSE/0 and cannot freeze. Other app merges stay held until#200live/postchecked; human files/drafts/YY cards untouched. No cleanup/prune/restore/older-image/retry/override/heap increase.

Please post a NEW primary Source review: PASS with every exact full token below if these bytes pass. The old6122670828 and6122904371 reviews cannot approve this source. I will continue the same writer through one new build/first proof, NEW production-source review, stopped original PASS kit/exact review/fresh single-use gate/forward deploy under YY's standing go.

'''
body += 'Exact guard evidence: ' + json.dumps(guards, sort_keys=True) + '\n\n' + '\n'.join(tokens) + '\n'
request = directory / 'source-review-630b2354-request.md'
with request.open('x', encoding='utf-8', newline='\n') as stream:
    stream.write(body)
record = {'observedUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'EXACT_PR294_PROOF_SOURCE_REQUEST_PREPARED_NOT_APPROVED',
    'sourceCommit': source, 'sourceIndex': index, 'guards': guards,
    'requestSha256': hashlib.sha256(request.read_bytes()).hexdigest(),
    'mountWitnessSha256': hashlib.sha256(mount_raw).hexdigest(),
    'sourceReviewClaimed': False, 'newBuildsOrProofs': 0, 'productionOperations': 0}
with (directory / 'pr294-source-request-preparation-1342.json').open('x', encoding='utf-8', newline='\n') as stream:
    json.dump(record, stream, indent=2)
print(json.dumps({'source': source, 'files': len(files), 'coordinatorSha256': index['files']['rehearse_import.py']['sha256'],
    'contractSha256': index['files']['import_proof_contract.py']['sha256'], 'guards': guards,
    'request': str(request), 'requestSha256': record['requestSha256']}))
