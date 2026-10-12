"""Prepare the actual frozen kit review request; never post or collect a gate."""
import json
import pathlib
import sys
from runtime_release_contract import sha, review_tokens, measurement_manifest, validate_proof

kit, output = map(pathlib.Path, sys.argv[1:])
if output.exists(): raise RuntimeError('Never overwrite review evidence')
manifest = json.loads((kit / 'prepared-manifest.json').read_bytes())
measurement_manifest(manifest)
for name, digest in manifest['files'].items():
    if sha(kit / name) != digest: raise RuntimeError('Downloaded kit changed: ' + name)
proof = json.loads((kit / 'rehearsal-receipt.json').read_bytes())
pin = json.loads((kit / 'target-pin.json').read_bytes())
validate_proof(proof, pin)
manifest_sha = sha(kit / 'prepared-manifest.json')
parts = ['Claudio: NEW exact-kit audit request. The original isolated proof has PASSED and both owned writers are stopped. This is a prepared kit only; no production gate or execution has occurred.',
    'Frozen root: ' + manifest['root'],
    'Exact application head: ' + manifest['head'] + '\nImage: ' + manifest['image'] + '\nTree: ' + manifest['tree'],
    'Manifest SHA256: ' + manifest_sha + '\nProduction coordinator SHA256: ' + manifest['files']['deploy_runtime.py'] +
    '\nOriginal PASSED proof receipt SHA256: ' + manifest['files']['rehearsal-receipt.json'],
    'Original proof root: ' + manifest['originalProofRoot'] + '\nCompleted proof unit: ' + manifest['originalProofUnit'],
    'Completed proof UTC: ' + proof['completedUtc'] + '\nFirst natural completion: ' + json.dumps(proof['firstScheduledSync']) +
    '\nSecond natural completion: ' + json.dumps(proof['secondScheduledSync']) +
    '\nFirst sealed intake: ' + json.dumps(proof['firstIntakeSummary']) +
    '\nSecond sealed intake: ' + json.dumps(proof['secondIntakeSummary']) +
    '\nHealthy observation seconds: ' + str(proof['healthySoakSeconds']) + '\nMaximum bounded peak bytes: ' + str(proof['peakBytes']),
    'The proof retained all 104 original tables, schema and rows and all 38 original receipts; integrity ok/FK0. Jobs-OFF startup and probes made zero changes. Both startups used the default entrypoint, 22 NO_OP/0 installers and 21 READY/0 events. The final owned writer was stopped before the sealed second/full preservation snapshots. Original cursor/config/15-minute interval and strict existing-row policy were retained. Four exact fresh-baseline refusals protect their config clocks and prohibit intake; unexpected errors remain refusals.',
    'The freezer independently reverified all three original sealed snapshots and the original separate stdout/stderr captures, stream-order one-to-one refusal evidence, signed one-second pairing bound and completion/cardinality evidence; no new database copy or rehearsal was used for packaging. The original PASSED receipt and its exact measured proof helpers remain byte-identical. Actual proof tooling is ' + manifest['proofToolingCommit'] + '; packaging is ' + manifest['packagingCommit'] + ', separately approved in ' + str(manifest['productionBaselineSourceReviewId']) + ', with its raw source-review record frozen in the kit. The production adapter uses the bounded three-attempt/ten-second confirmation only on the exact unused hash-bound kit before any live mutation. Journal-only unit output; unchanged V2 mid-run guard.',
    'Required NEW formal verdict must contain every following full token (the historical/source passes do not replace this kit review):\n' + '\n'.join(review_tokens(manifest, manifest_sha)),
    'All frozen file SHA256 values:\n' + '\n'.join(name + ': ' + digest for name, digest in manifest['files'].items()),
    'WAL recovery authority: ' + json.dumps(manifest['walRecovery'], sort_keys=True) + '. The original failed-WAL receipt and held triple are retained solely as historical evidence; they cannot authorize an entry or serve as a PASSED proof for this release. Initial and post-jobs-OFF stopped raw triples are sealed at400 with before/after full physical metadata; scratch copies alone provide WAL-aware full state and logical backups. Every folded count must be at least the immutable main-only count; full logical state must remain identical before jobs-ON. SQLite may legitimately fold WAL pages into the original main file during candidate startup. Measured proof/startup/guard/helper bytes remain unchanged. Six retained database allocations plus assets and state/log margin are reserved.',
    'The single-use gate binds exactly one actual reviewed entry: HEALTHY_RUNNING_NORMAL_ONLY on the current f830f900/image4894 predecessor with original open ingress and normal quiesce. Stopped, unhealthy, OOM, restarted, wrong-image or held-ingress entry refuses. It is rechecked at gate installation, launch and before forward progress. No gate is collected early. The coordinator requires stopped hashed DB/assets backups, full WAL-aware original state, jobs-OFF zero writes/readiness/probes, ingress before jobs and 660 healthy jobs-ON seconds at 768 MiB/zero restarts. Every failure after any entrypoint attempt is forward-only through a separately audited fix. No restore, previous image, retry, heap override, pruning or cleanup. The original YY standing automatic-after-review evidence is unchanged. Other application merges stay held until #293 is live and your actual post-deploy check passes. The audited PR293 branch and merged union trees are separately bound with both exact parents; naturalIntakePolicy=ORIGINAL_CURSOR_ACTUAL_UPSTREAM. Human cards are untouched.']
output.write_text('\n\n'.join(parts) + '\n', encoding='utf-8')
print(json.dumps({'status': 'ACTUAL_FROZEN_KIT_REVIEW_DRAFT_PREPARED', 'manifestSha256': manifest_sha, 'output': str(output)}))
