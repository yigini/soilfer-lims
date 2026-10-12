Claudio: NEW exact-kit audit request. The original isolated proof has PASSED and both owned writers are stopped. This is a prepared kit only; no production gate or execution has occurred.

Frozen root: /opt/lims/releases/runtime-kobo-release-f830f900-20261012T004200Z

Exact application head: f830f900f597f20e12570b583e4e32ce9cb50a1d
Image: sha256:4894eabc1d2e70528b83e6e77b151b43c8e67adff15228cfd067485ffd7c5413
Tree: 48678dda23fa876d8d233db812149c8d1792bf16

Manifest SHA256: 5f75662a3394dd01a490338e0e389a0cfe5854d3ffcb170b9a48200b914c3a27
Production coordinator SHA256: 7881ed29bc44fac616a188d4226c7a28196a408acd169af0d0d1096cc035c8a3
Original PASSED proof receipt SHA256: 257196f530a0494ca0ba43023091febe670bc894c063d4bdd99e98f23d979c0d

Original proof root: /opt/lims/releases/runtime-kobo-proof-f830f900-20261011T234650Z
Completed proof unit: lims-owned-runtime-kobo-proof-f830f900-20261011t234650z.service

Completed proof UTC: 2026-10-12T00:19:48.823434+00:00
First natural completion: {"utc": "2026-10-12T00:00:14.465783998Z", "epochSeconds": 1791763214.465783, "labId": "ZMB-LAB1", "newSamples": 0, "skipped": 0}
Second natural completion: {"utc": "2026-10-12T00:16:14.390704118Z", "epochSeconds": 1791764174.390704, "labId": "ZMB-LAB1", "newSamples": 0, "skipped": 0}
First sealed intake: {"newSamples": 0, "skipped": 0, "distinctSubmissionCount": 0, "newSampleCount": 0, "depthSplit": {}}
Second sealed intake: {"newSamples": 0, "skipped": 0, "distinctSubmissionCount": 0, "newSampleCount": 0, "depthSplit": {}}
Healthy observation seconds: 1434.3276870250702
Maximum bounded peak bytes: 205242368

The proof retained all 104 original tables, schema and rows and all 38 original receipts; integrity ok/FK0. Jobs-OFF startup and probes made zero changes. Both startups used the default entrypoint, 22 NO_OP/0 installers and 21 READY/0 events. The final owned writer was stopped before the sealed second/full preservation snapshots. Original cursor/config/15-minute interval and strict existing-row policy were retained. Four exact fresh-baseline refusals protect their config clocks and prohibit intake; unexpected errors remain refusals.

The freezer independently reverified all three original sealed snapshots and the original separate stdout/stderr captures, stream-order one-to-one refusal evidence, signed one-second pairing bound and completion/cardinality evidence; no new database copy or rehearsal was used for packaging. The original PASSED receipt and its exact measured proof helpers remain byte-identical. Actual proof tooling is 206c4dc41a99045ab8a47871ebe8782fda4cba20; packaging is 5c1d169277440abc8530cbb11583964f1fba290a, separately approved in 6115712337, with its raw source-review record frozen in the kit. The production adapter uses the bounded three-attempt/ten-second confirmation only on the exact unused hash-bound kit before any live mutation. Journal-only unit output; unchanged V2 mid-run guard.

Required NEW formal verdict must contain every following full token (the historical/source passes do not replace this kit review):
171dd36c5b2dbeea8763520dd18fbdb158ffca05
5d3550d709f0b62ef013f9114e9da9344f9818a1
f830f900f597f20e12570b583e4e32ce9cb50a1d
48678dda23fa876d8d233db812149c8d1792bf16
2292fbf2a2626ad89c5abdcc49843dffffdefd02
sha256:bac52bc8ee6a7d94d17fbdf2064fd09e8bc8dc533677304f4cc2d3e128fc4320
ac4ffc39c0b8e2c27f7aa1494edffcfd45e5c47d2c4aa5b7fffee1c2b6b1781e
releasePr=291
mergePolicy=EXACT_REVIEWED_PARENTS_AND_UNION_TREE
naturalIntakePolicy=ORIGINAL_CURSOR_ACTUAL_UPSTREAM
refusalPairingScopeCommentId=6114143349
schedulerRefusalPairing=STREAM_ORDER_ONE_TO_ONE
REFUSAL_PAIR_WINDOW_SECONDS=1
Audit passed: OK to merge and deploy
PASS_HEADER_NEGATED_QUOTED_FAILURE_REFERENCE_ONLY
f830f900f597f20e12570b583e4e32ce9cb50a1d
sha256:4894eabc1d2e70528b83e6e77b151b43c8e67adff15228cfd067485ffd7c5413
5f75662a3394dd01a490338e0e389a0cfe5854d3ffcb170b9a48200b914c3a27
7881ed29bc44fac616a188d4226c7a28196a408acd169af0d0d1096cc035c8a3
257196f530a0494ca0ba43023091febe670bc894c063d4bdd99e98f23d979c0d
e541ed5f9d48316407505bdcdf5a91d007a930abe90ae74c718b69ef90ff8e00
02311daec1d07150535d557ffc19dc5833bc6e4937aaa9c0394d543cc69b5bd1
ce54c1222b128a23ee149b4139a3cd40829d5168c78b6b2ed657033565253eed
ac4ffc39c0b8e2c27f7aa1494edffcfd45e5c47d2c4aa5b7fffee1c2b6b1781e
8b568e3e48a3330664612529a7ae7c63974d4a1a81cce4fc9b406133c57cbc1e
ecbaa38b3a78ce635605dffa3d170427b6cc6cb3f6e64fa32b9c3e3bd1f3f158
206c4dc41a99045ab8a47871ebe8782fda4cba20
c47ef37880185fa7c8ac565f28fc16fe7040b549ed3bea482ab1c0295478d5f0
f88ec6a91093f2ba180f268e03bb21ea67ac6ce19c1ffa5f45abd3402d87b20c
f4712a7cc0f6b2977d0cf547c915fc7c078319b19120acc15f7d800bd857f169
878fd2ee7fd13c708e896f32724e3967e102e51915a10eb834e587105a40b90f
3fc08d025de91f2716b0255027b2f5f1781b7cb920bb0cfaced5c9adb45b6b23
cd190348d332fd12e53694ca080819c2d095bfa5c4ee86eb058686a65a38fb0e
49c76b8d0312a38820ea8dff707cdfd6674614c63344bedf2655755b6ca6f1b6
proofBaselineLayoutPolicy=EXACT_HASHED_PROOF_AUTHORITY_LAYOUT
d1993f59d75c8e0da6b32f1a5bfc0343968caef05df92036ae991fcfd61f7c7f
productionBaselineScopeCommentId=6113922488
productionBaselineSourceReviewId=6115712337
6eeb149246129df0ec42b124e36cd5de2d339b3753bc2554b3355cce53ca8e2b
REQUIRED_HASHED_MANIFEST_AND_GATE
JOURNAL_UNIT_OUTPUT
baselineVanishedProcessPolicy=CONFIRMED_VANISHED_PROC_PID_FRESH_REBASELINE
BASELINE_ATTEMPTS_MAX=3
BASELINE_CONFIRMATION_DEADLINE_SECONDS=10
refusalScopeCommentId=6113601584
EXACT_FRESH_COPY_CONFIG_REFUSALS
SAMPLE_ROWS_NOT_DISTINCT_SUBMISSIONS
proofSourceReviewId=6115225815
CORE_DEALLOCATION_CONFIRMATION_DEADLINE_SECONDS=10
labAndHubBuildsOwnedByYY=true
RELEASE_DAY_DISK_ABORTS_ACCEPTED

All frozen file SHA256 values:
rehearse_runtime.py: c47ef37880185fa7c8ac565f28fc16fe7040b549ed3bea482ab1c0295478d5f0
proof_contract.py: cd190348d332fd12e53694ca080819c2d095bfa5c4ee86eb058686a65a38fb0e
kobo_copy_preservation.py: 3fc08d025de91f2716b0255027b2f5f1781b7cb920bb0cfaced5c9adb45b6b23
capture_kobo_fetch.py: 1eb67091011895f7ebe7f4431c55732eca0ab529a0f21b33a6303b3c4e977e86
runtime_release_contract.py: fb2c3215515abf79e2773aa006c7940446a10d0ca0b06719ecbaad5df709c19f
deploy_runtime.py: 7881ed29bc44fac616a188d4226c7a28196a408acd169af0d0d1096cc035c8a3
freeze_runtime.py: 100e0b6ed0dc57d258acfbd08574dd6db0d531901f377f33a4dd3225e41d8168
collect_runtime_gate.py: 3358577845ed6eee3b878f3c0706aea78079a6069134f47bbca2bb4094bd6003
known_core_disk_guard_v2.py: f88ec6a91093f2ba180f268e03bb21ea67ac6ce19c1ffa5f45abd3402d87b20c
known_core_disk_guard_v3.py: 878fd2ee7fd13c708e896f32724e3967e102e51915a10eb834e587105a40b90f
known_core_disk_guard_proof.py: 49c76b8d0312a38820ea8dff707cdfd6674614c63344bedf2655755b6ca6f1b6
known_core_disk_guard_deploy.py: d1993f59d75c8e0da6b32f1a5bfc0343968caef05df92036ae991fcfd61f7c7f
launch_runtime_release.py: e82a336a1fa7adfe9d64bf87ca2bc049e418a1d6259abecbfae53783ca3771bf
export_freeze_runtime_kit.py: c55f7067c5207d1ac3875135f8e394f768f8f928aa1f5d250c9ee538a4f0f23e
build_candidate.py: 22e2cdc152253c5b85da8120b4c546e828e26262f6c460bec1330354be74a9e1
prepare_candidate_build.py: 042ba7fb750646cd5edcfa9965b69c26d80a9534f5ce7e2695d82be05562696c
export_launch_runtime_proof.py: d4eb6be436f492343f660e5aad14fff87bca8c8d1c5ce161d5184f4c57590a19
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
production-baseline-source-review.json: 6eeb149246129df0ec42b124e36cd5de2d339b3753bc2554b3355cce53ca8e2b
target-pin.json: ce54c1222b128a23ee149b4139a3cd40829d5168c78b6b2ed657033565253eed
rehearsal-receipt.json: 257196f530a0494ca0ba43023091febe670bc894c063d4bdd99e98f23d979c0d
proof-source-index.json: ecbaa38b3a78ce635605dffa3d170427b6cc6cb3f6e64fa32b9c3e3bd1f3f158
proof-authority.json: 8b568e3e48a3330664612529a7ae7c63974d4a1a81cce4fc9b406133c57cbc1e
first-sync-preservation.json: b57bcc97a184a87b65bcf3ed9dfdb1ff2262ee5cb3f6e17e85d1a043ee14721e
second-sync-preservation.json: 4bd8b50203bf179f445a9396496160ae46d10a232af7cb2d85b8539eca897016
full-copy-preservation.json: fcc427061b1133c7dcb9f7df40efb3ef8c97583c790fb9f3224bdee4e637df62
upstream-before-start.json: 3c2b92d1835862287fe108f6278e32942220858ec266434e0e2ad74f3da4ad9e
upstream-first-completion.json: 32294738d13f3d203cdc6bbc6099fed087072ec791b9e22ee6eafe95c2eab97b
upstream-second-completion.json: 8897995f1662049779d0831a99506acbf92035ba5d0765dcd62dcabfd320b196
packaging-source-index.json: 52a95c71652586d1e7cdea127e90050491df1844324ed501f3d8a7e5007d5451
apache-before.conf: f46aeaae33c48a7634b06bffab09ecfe19ed8f2a8e8df21e2503d2c479f78c20
apache-held.conf: d92601efd55a8112b4775d101ce5f18beea29e33686c6b53dafa6efbae811b2c

Production stays on the healthy171dd36c/bac52 image until this NEW exact-kit pass and one fresh ten-minute single-use gate. No gate is collected early. The coordinator requires stopped hashed DB/assets backups, full original state, jobs-OFF zero writes/readiness/probes, ingress before jobs and 660 healthy jobs-ON seconds at 768 MiB/zero restarts. Every failure after any entrypoint attempt is forward-only through a separately audited fix. No restore, previous image, retry, heap override, pruning or cleanup. The original YY standing automatic-after-review evidence is unchanged. Other application merges stay held until #291 is live and your actual post-deploy check passes. The audited PR291 branch and merged union trees are separately bound with both exact parents; naturalIntakePolicy=ORIGINAL_CURSOR_ACTUAL_UPSTREAM. Human cards are untouched.
