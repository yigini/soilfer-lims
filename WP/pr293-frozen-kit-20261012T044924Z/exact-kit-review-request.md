Claudio: NEW exact-kit audit request. The original isolated proof has PASSED and both owned writers are stopped. This is a prepared kit only; no production gate or execution has occurred.

Frozen root: /opt/lims/releases/runtime-kobo-release-51f67988-20261012T044924Z

Exact application head: 51f6798806f630773786a08432290c1b21a841da
Image: sha256:d4eb9b498022078b1853013f2fbbb52f42c8c903dad7d222171c9eabd419869f
Tree: 90ed6a26c72bfab5a348dfdb9d6e59876c61ee4c

Manifest SHA256: 29b45cdba8f16552a160929afd9dc0d39bf86cbf9bae92addca5556bdaf2b2ac
Production coordinator SHA256: a97e6f487c83350f522bc573a1ec4ef4370dd1e06f904ffd9ec176ee651001a5
Original PASSED proof receipt SHA256: 4b18963ae410af1afb0c9458ab759a50f2de3dfbf591771f28233636fc321cc9

Original proof root: /opt/lims/releases/runtime-kobo-proof-51f67988-20261012T041721Z
Completed proof unit: lims-owned-runtime-kobo-proof-51f67988-20261012t041721z.service

Completed proof UTC: 2026-10-12T04:45:32.876289+00:00
First natural completion: {"utc": "2026-10-12T04:25:54.449055083Z", "epochSeconds": 1791779154.449055, "labId": "ZMB-LAB1", "newSamples": 0, "skipped": 0}
Second natural completion: {"utc": "2026-10-12T04:41:54.429848604Z", "epochSeconds": 1791780114.429848, "labId": "ZMB-LAB1", "newSamples": 0, "skipped": 0}
First sealed intake: {"newSamples": 0, "skipped": 0, "distinctSubmissionCount": 0, "newSampleCount": 0, "depthSplit": {}}
Second sealed intake: {"newSamples": 0, "skipped": 0, "distinctSubmissionCount": 0, "newSampleCount": 0, "depthSplit": {}}
Healthy observation seconds: 1134.7420959472656
Maximum bounded peak bytes: 191778816

The proof retained all 104 original tables, schema and rows and all 38 original receipts; integrity ok/FK0. Jobs-OFF startup and probes made zero changes. Both startups used the default entrypoint, 22 NO_OP/0 installers and 21 READY/0 events. The final owned writer was stopped before the sealed second/full preservation snapshots. Original cursor/config/15-minute interval and strict existing-row policy were retained. Four exact fresh-baseline refusals protect their config clocks and prohibit intake; unexpected errors remain refusals.

The freezer independently reverified all three original sealed snapshots and the original separate stdout/stderr captures, stream-order one-to-one refusal evidence, signed one-second pairing bound and completion/cardinality evidence; no new database copy or rehearsal was used for packaging. The original PASSED receipt and its exact measured proof helpers remain byte-identical. Actual proof tooling is 071d61c372d48b4e283b9a4520b7044c18a7f238; packaging is f5cb18176a9d6efa3560182534f57280af71f66a, separately approved in 6117551195, with its raw source-review record frozen in the kit. The production adapter uses the bounded three-attempt/ten-second confirmation only on the exact unused hash-bound kit before any live mutation. Journal-only unit output; unchanged V2 mid-run guard.

Required NEW formal verdict must contain every following full token (the historical/source passes do not replace this kit review):
f830f900f597f20e12570b583e4e32ce9cb50a1d
990a4cb535fd3ccb2a81ca019f453123b60a14b8
51f6798806f630773786a08432290c1b21a841da
90ed6a26c72bfab5a348dfdb9d6e59876c61ee4c
90ed6a26c72bfab5a348dfdb9d6e59876c61ee4c
sha256:4894eabc1d2e70528b83e6e77b151b43c8e67adff15228cfd067485ffd7c5413
0b8c3f54ab70e404d5797266f349d3b2a819151dc3afa9c5059f63a27727a8d7
releasePr=293
mergePolicy=EXACT_REVIEWED_PARENTS_AND_UNION_TREE
naturalIntakePolicy=ORIGINAL_CURSOR_ACTUAL_UPSTREAM
refusalPairingScopeCommentId=6114143349
schedulerRefusalPairing=STREAM_ORDER_ONE_TO_ONE
REFUSAL_PAIR_WINDOW_SECONDS=1
EXACT_STOPPED_TRIPLE_WAL_AWARE_COPY_FULL_LOGICAL_ZERO_WRITE
walScopeCommentId=6115903244
/opt/lims/releases/runtime-kobo-release-f830f900-20261012T004200Z
e274d3b8cf6514e7fe878ad7d712caa6303d3f969fd49372f8bb0147efbb6588
5f75662a3394dd01a490338e0e389a0cfe5854d3ffcb170b9a48200b914c3a27
f46aeaae33c48a7634b06bffab09ecfe19ed8f2a8e8df21e2503d2c479f78c20
d92601efd55a8112b4775d101ce5f18beea29e33686c6b53dafa6efbae811b2c
RUNNING_NORMAL
entryPolicy=HEALTHY_RUNNING_NORMAL_ONLY
historicalFailedWalEvidenceOnly=true
44d174bdda174cc6fd81e6d0e958fd8bd48c8255e34cb9927bb562aa14cffd34
9f0981c7b5adad656ff544890af68a211a6daf8a52360b5c5e6cb12ffe2bb2e0
5ad9f8e2bdf448f719997dd8d28a3aee0351d7f86ac152df8c3d328755b0423d
Audit passed: OK to merge and deploy
PASS_HEADER_NEGATED_QUOTED_FAILURE_REFERENCE_ONLY
51f6798806f630773786a08432290c1b21a841da
sha256:d4eb9b498022078b1853013f2fbbb52f42c8c903dad7d222171c9eabd419869f
29b45cdba8f16552a160929afd9dc0d39bf86cbf9bae92addca5556bdaf2b2ac
a97e6f487c83350f522bc573a1ec4ef4370dd1e06f904ffd9ec176ee651001a5
4b18963ae410af1afb0c9458ab759a50f2de3dfbf591771f28233636fc321cc9
e541ed5f9d48316407505bdcdf5a91d007a930abe90ae74c718b69ef90ff8e00
02311daec1d07150535d557ffc19dc5833bc6e4937aaa9c0394d543cc69b5bd1
49dcb7bdc7e102fe35700a0226154431465d3cbe1a7d5d9761f573aad24baddc
0b8c3f54ab70e404d5797266f349d3b2a819151dc3afa9c5059f63a27727a8d7
b59e7bb9e33bee57a6f431d1cb50f77f60d5f3685ba4fd7d24eb09c6ede06e94
93d90b3fa1ee6d54816ec5cf0831632fadab8953d7f78c3c788e9b64b97255a6
071d61c372d48b4e283b9a4520b7044c18a7f238
c47ef37880185fa7c8ac565f28fc16fe7040b549ed3bea482ab1c0295478d5f0
f88ec6a91093f2ba180f268e03bb21ea67ac6ce19c1ffa5f45abd3402d87b20c
f4712a7cc0f6b2977d0cf547c915fc7c078319b19120acc15f7d800bd857f169
878fd2ee7fd13c708e896f32724e3967e102e51915a10eb834e587105a40b90f
3fc08d025de91f2716b0255027b2f5f1781b7cb920bb0cfaced5c9adb45b6b23
08678fb53511e6f0d6b0cac06ff549bcb0fe72894d9e1322a74079cc65d60ccf
49c76b8d0312a38820ea8dff707cdfd6674614c63344bedf2655755b6ca6f1b6
proofBaselineLayoutPolicy=EXACT_HASHED_PROOF_AUTHORITY_LAYOUT
d1993f59d75c8e0da6b32f1a5bfc0343968caef05df92036ae991fcfd61f7c7f
productionBaselineScopeCommentId=6113922488
productionBaselineSourceReviewId=6117551195
16e753e4ec7d9f1d06d06e47be93f194510372f89d58a054bd6c1fa52767f427
REQUIRED_HASHED_MANIFEST_AND_GATE
JOURNAL_UNIT_OUTPUT
baselineVanishedProcessPolicy=CONFIRMED_VANISHED_PROC_PID_FRESH_REBASELINE
BASELINE_ATTEMPTS_MAX=3
BASELINE_CONFIRMATION_DEADLINE_SECONDS=10
refusalScopeCommentId=6113601584
EXACT_FRESH_COPY_CONFIG_REFUSALS
SAMPLE_ROWS_NOT_DISTINCT_SUBMISSIONS
proofSourceReviewId=6117398054
CORE_DEALLOCATION_CONFIRMATION_DEADLINE_SECONDS=10
labAndHubBuildsOwnedByYY=true
RELEASE_DAY_DISK_ABORTS_ACCEPTED

All frozen file SHA256 values:
rehearse_runtime.py: c47ef37880185fa7c8ac565f28fc16fe7040b549ed3bea482ab1c0295478d5f0
proof_contract.py: 08678fb53511e6f0d6b0cac06ff549bcb0fe72894d9e1322a74079cc65d60ccf
kobo_copy_preservation.py: 3fc08d025de91f2716b0255027b2f5f1781b7cb920bb0cfaced5c9adb45b6b23
capture_kobo_fetch.py: 1eb67091011895f7ebe7f4431c55732eca0ab529a0f21b33a6303b3c4e977e86
runtime_release_contract.py: bf583df473b7a2e12d865b5b4290806fb52b85cf5f661b1e653f993768c5051a
deploy_runtime.py: a97e6f487c83350f522bc573a1ec4ef4370dd1e06f904ffd9ec176ee651001a5
freeze_runtime.py: 9b76e19f3d4ea2002aa38f4748eb05a62d160866c852245a4320e1b6ec626cec
collect_runtime_gate.py: 7e87b2e784759daacfb809e30e759720b6bc22d359be9557ea782b35b31ced00
known_core_disk_guard_v2.py: f88ec6a91093f2ba180f268e03bb21ea67ac6ce19c1ffa5f45abd3402d87b20c
known_core_disk_guard_v3.py: 878fd2ee7fd13c708e896f32724e3967e102e51915a10eb834e587105a40b90f
known_core_disk_guard_proof.py: 49c76b8d0312a38820ea8dff707cdfd6674614c63344bedf2655755b6ca6f1b6
known_core_disk_guard_deploy.py: d1993f59d75c8e0da6b32f1a5bfc0343968caef05df92036ae991fcfd61f7c7f
launch_runtime_release.py: 5e1816ffa1fe5fa89314f0bdddc7b0ee79fc000f479449cc24dc9f606f773cc3
export_freeze_runtime_kit.py: c55f7067c5207d1ac3875135f8e394f768f8f928aa1f5d250c9ee538a4f0f23e
build_candidate.py: 1daa1d73c9f0b9af2be3b292764c6e585874ae551ed5dd0a1adaf4085342ffa6
prepare_candidate_build.py: b92cb52d1efa3a50f55229d44dbd65c7e5cf28a28e43c54bd858169cc6070c64
export_launch_runtime_proof.py: 37e14bc7caf74c2cd80c20a84fc5a78bc3802996d90dbb537ebf968d0e0b6046
known_core_disk_guard.py: f4712a7cc0f6b2977d0cf547c915fc7c078319b19120acc15f7d800bd857f169
release_support.py: 9db6932a9b1502bc2db65c816a925e7d9f54611d54d4027d418bb2574b837810
startup_common.py: e541ed5f9d48316407505bdcdf5a91d007a930abe90ae74c718b69ef90ff8e00
postflight-roles.cjs: 6724d91d89343387adb18db03f396a1eac14d8c9cc0700ac722b36e82ed924da
postflight-auth.cjs: 37b96bb2f26f8e2c9d4bd8443f5c3e46364408cc413b07c3f5a4428d91e45192
postflight-reference.cjs: 530162ea19e87a2fb59621d5d3cf570cfe4092bcb4160f0ca40df9debe3e5526
postflight-qc-runs.cjs: 4a93ec3c536b13813ddc213791039d0acf04250a8722b28ea5af5cd50581cf8f
postflight-policy.cjs: 6380f9b6513318e0b50a6c1fcda51d3b2094326e39f7651a9a923ae68dfe5e51
readonly-smoke.cjs: 7fcfb2565d55f2d54aa39a2f8ebd636dcf64dbe04b2713de40f4346a3c93c626
yy-authorization-evidence.md: 02311daec1d07150535d557ffc19dc5833bc6e4937aaa9c0394d543cc69b5bd1
production-baseline-source-review.json: 16e753e4ec7d9f1d06d06e47be93f194510372f89d58a054bd6c1fa52767f427
target-pin.json: 49dcb7bdc7e102fe35700a0226154431465d3cbe1a7d5d9761f573aad24baddc
rehearsal-receipt.json: 4b18963ae410af1afb0c9458ab759a50f2de3dfbf591771f28233636fc321cc9
proof-source-index.json: 93d90b3fa1ee6d54816ec5cf0831632fadab8953d7f78c3c788e9b64b97255a6
proof-authority.json: b59e7bb9e33bee57a6f431d1cb50f77f60d5f3685ba4fd7d24eb09c6ede06e94
first-sync-preservation.json: 8fca96780d7c617275653f8adbe9822993ece9077bc1a5e13a5e603c7babf5e9
second-sync-preservation.json: e19e4636f0ddcb90e08a233f185bbc12a7b62a33958db75d156c8b27d2b13dda
full-copy-preservation.json: 440e138d0a7ea2654edc2c8de616d8937943825091895018bf782f71c0e76caa
upstream-before-start.json: 797334ca1a282e403ef430618251edf035e7b62609d0efa5488eb3a84fd7b0fc
upstream-first-completion.json: e5c457dd9381cae6313f6e2e5f925786bb1b24c38343f5f4851f18824fe0d429
upstream-second-completion.json: 47ca78893c32df5bc566c2ee8a865456086644e997ebdc0165ecbd6d90926b55
packaging-source-index.json: b1240d1bfd5f37aadb05e1101d2b0173f11151772758513341030d29cdc82bd4
apache-before.conf: f46aeaae33c48a7634b06bffab09ecfe19ed8f2a8e8df21e2503d2c479f78c20
apache-held.conf: d92601efd55a8112b4775d101ce5f18beea29e33686c6b53dafa6efbae811b2c

WAL recovery authority: {"allowedEntryStates": ["RUNNING_NORMAL"], "entryPolicy": "HEALTHY_RUNNING_NORMAL_ONLY", "failedManifestSha256": "5f75662a3394dd01a490338e0e389a0cfe5854d3ffcb170b9a48200b914c3a27", "failedReceiptSha256": "e274d3b8cf6514e7fe878ad7d712caa6303d3f969fd49372f8bb0147efbb6588", "heldIngressSha256": "d92601efd55a8112b4775d101ce5f18beea29e33686c6b53dafa6efbae811b2c", "heldTriple": {"": {"bytes": 563322880, "sha256": "44d174bdda174cc6fd81e6d0e958fd8bd48c8255e34cb9927bb562aa14cffd34"}, "-shm": {"bytes": 32768, "sha256": "5ad9f8e2bdf448f719997dd8d28a3aee0351d7f86ac152df8c3d328755b0423d"}, "-wal": {"bytes": 4190072, "sha256": "9f0981c7b5adad656ff544890af68a211a6daf8a52360b5c5e6cb12ffe2bb2e0"}}, "historicalFailedWalEvidenceOnly": true, "normalIngressSha256": "f46aeaae33c48a7634b06bffab09ecfe19ed8f2a8e8df21e2503d2c479f78c20", "policy": "EXACT_STOPPED_TRIPLE_WAL_AWARE_COPY_FULL_LOGICAL_ZERO_WRITE", "predecessorRoot": "/opt/lims/releases/runtime-kobo-release-f830f900-20261012T004200Z", "scopeCommentId": 6115903244}. The original failed-WAL receipt and held triple are retained solely as historical evidence; they cannot authorize an entry or serve as a PASSED proof for this release. Initial and post-jobs-OFF stopped raw triples are sealed at400 with before/after full physical metadata; scratch copies alone provide WAL-aware full state and logical backups. Every folded count must be at least the immutable main-only count; full logical state must remain identical before jobs-ON. SQLite may legitimately fold WAL pages into the original main file during candidate startup. Measured proof/startup/guard/helper bytes remain unchanged. Six retained database allocations plus assets and state/log margin are reserved.

The single-use gate binds exactly one actual reviewed entry: HEALTHY_RUNNING_NORMAL_ONLY on the current f830f900/image4894 predecessor with original open ingress and normal quiesce. Stopped, unhealthy, OOM, restarted, wrong-image or held-ingress entry refuses. It is rechecked at gate installation, launch and before forward progress. No gate is collected early. The coordinator requires stopped hashed DB/assets backups, full WAL-aware original state, jobs-OFF zero writes/readiness/probes, ingress before jobs and 660 healthy jobs-ON seconds at 768 MiB/zero restarts. Every failure after any entrypoint attempt is forward-only through a separately audited fix. No restore, previous image, retry, heap override, pruning or cleanup. The original YY standing automatic-after-review evidence is unchanged. Other application merges stay held until #293 is live and your actual post-deploy check passes. The audited PR293 branch and merged union trees are separately bound with both exact parents; naturalIntakePolicy=ORIGINAL_CURSOR_ACTUAL_UPSTREAM. Human cards are untouched.
