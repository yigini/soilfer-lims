Claudio: NEW exact-kit audit request. The original isolated proof has PASSED and both owned writers are stopped. This is a prepared kit only; no production gate or execution has occurred.

Frozen root: /opt/lims/releases/runtime-kobo-release-171dd36c-20261011T222300Z

Exact application head: 171dd36c5b2dbeea8763520dd18fbdb158ffca05
Image: sha256:bac52bc8ee6a7d94d17fbdf2064fd09e8bc8dc533677304f4cc2d3e128fc4320
Tree: 5209112a0c66d8cef8578018b415a7511b4daba7

Manifest SHA256: 1e32562b5d33fc0f2c3341d0bb848d975a5014e6cfd02b2b55cbfa3173b2745d
Production coordinator SHA256: 3203b4ef40883bfdd8358cb09365d38934a24dfb4b3f3a8e5d6c05db5ec27691
Original PASSED proof receipt SHA256: 49b0c09a59234b30c6840223a35c1adc29c9e31d71992f9545a4761650c46f9e

Original proof root: /opt/lims/releases/runtime-kobo-proof-171dd36c-20261011T215600Z
Completed proof unit: lims-owned-runtime-kobo-proof-171dd36c-20261011t215600z.service

Completed proof UTC: 2026-10-11T22:21:59.087206+00:00
First natural completion: {"utc": "2026-10-11T22:02:15.381596976Z", "epochSeconds": 1791756135.381596, "labId": "ZMB-LAB1", "newSamples": 155, "skipped": 1}
Second natural completion: {"utc": "2026-10-11T22:18:00.201944961Z", "epochSeconds": 1791757080.201944, "labId": "ZMB-LAB1", "newSamples": 0, "skipped": 0}
First sealed intake: {"newSamples": 155, "skipped": 1, "distinctSubmissionCount": 78, "newSampleCount": 155, "depthSplit": {"D2": 77, "D1": 78}}
Second sealed intake: {"newSamples": 0, "skipped": 0, "distinctSubmissionCount": 0, "newSampleCount": 0, "depthSplit": {}}
Healthy observation seconds: 1020.7043900489807
Maximum bounded peak bytes: 228794368

The proof retained all 104 original tables, schema and rows and all 38 original receipts; integrity ok/FK0. Jobs-OFF startup and probes made zero changes. Both startups used the default entrypoint, 22 NO_OP/0 installers and 21 READY/0 events. The final owned writer was stopped before the sealed second/full preservation snapshots. Original cursor/config/15-minute interval and strict existing-row policy were retained. Four exact fresh-baseline refusals protect their config clocks and prohibit intake; unexpected errors remain refusals.

The freezer independently reverified all three original sealed snapshots and the original separate stdout/stderr captures, stream-order one-to-one refusal evidence, signed one-second pairing bound and completion/cardinality evidence; no new database copy or rehearsal was used for packaging. The original PASSED receipt and its exact measured proof helpers remain byte-identical. Actual proof tooling is 873a021814fd252a082c46a4f5c25a733fe69f65; packaging is 08c770118621c7c695fa4da369ca0694814536fc, separately approved in 6114289486, with its raw source-review record frozen in the kit. The production adapter uses the bounded three-attempt/ten-second confirmation only on the exact unused hash-bound kit before any live mutation. Journal-only unit output; unchanged V2 mid-run guard.

Required NEW formal verdict must contain every following full token (the historical/source passes do not replace this kit review):
refusalPairingScopeCommentId=6114143349
schedulerRefusalPairing=STREAM_ORDER_ONE_TO_ONE
REFUSAL_PAIR_WINDOW_SECONDS=1
Audit passed: OK to merge and deploy
171dd36c5b2dbeea8763520dd18fbdb158ffca05
sha256:bac52bc8ee6a7d94d17fbdf2064fd09e8bc8dc533677304f4cc2d3e128fc4320
1e32562b5d33fc0f2c3341d0bb848d975a5014e6cfd02b2b55cbfa3173b2745d
3203b4ef40883bfdd8358cb09365d38934a24dfb4b3f3a8e5d6c05db5ec27691
49b0c09a59234b30c6840223a35c1adc29c9e31d71992f9545a4761650c46f9e
e541ed5f9d48316407505bdcdf5a91d007a930abe90ae74c718b69ef90ff8e00
02311daec1d07150535d557ffc19dc5833bc6e4937aaa9c0394d543cc69b5bd1
57e947c1761905132619dc34b2da996fec48f6597afb3f5bfb6aa765e7a6dfa9
35ab0b825a5d52414304d426101863b671ce5d3b92f6d8eb81e8b79f34095462
cb0b4293b3e40354991671fe410087d0b547809bfa062463e84d5ed11aded024
c356a90e8bcc3ac809c2edfb18eaec772b56764a30af54b57a6f7418fbdf1e66
873a021814fd252a082c46a4f5c25a733fe69f65
9d9cea571421c502ed4a5a1c5e2964f2e9470df9a8288a69df35c0770fb5d311
f88ec6a91093f2ba180f268e03bb21ea67ac6ce19c1ffa5f45abd3402d87b20c
f4712a7cc0f6b2977d0cf547c915fc7c078319b19120acc15f7d800bd857f169
878fd2ee7fd13c708e896f32724e3967e102e51915a10eb834e587105a40b90f
3fc08d025de91f2716b0255027b2f5f1781b7cb920bb0cfaced5c9adb45b6b23
4d096b9b7bf3e5d41422f7989869808c06af550480ae39e8d52a99aec0d62a9a
d1993f59d75c8e0da6b32f1a5bfc0343968caef05df92036ae991fcfd61f7c7f
productionBaselineScopeCommentId=6113922488
productionBaselineSourceReviewId=6114289486
298044d52243a219d6e8d37affd1190b86d063b413470e183e98df8721bbae21
REQUIRED_HASHED_MANIFEST_AND_GATE
JOURNAL_UNIT_OUTPUT
baselineVanishedProcessPolicy=CONFIRMED_VANISHED_PROC_PID_FRESH_REBASELINE
BASELINE_ATTEMPTS_MAX=3
BASELINE_CONFIRMATION_DEADLINE_SECONDS=10
refusalScopeCommentId=6113601584
EXACT_FRESH_COPY_CONFIG_REFUSALS
SAMPLE_ROWS_NOT_DISTINCT_SUBMISSIONS
proofSourceReviewId=6114217683
CORE_DEALLOCATION_CONFIRMATION_DEADLINE_SECONDS=10
labAndHubBuildsOwnedByYY=true
RELEASE_DAY_DISK_ABORTS_ACCEPTED

All frozen file SHA256 values:
rehearse_runtime.py: 9d9cea571421c502ed4a5a1c5e2964f2e9470df9a8288a69df35c0770fb5d311
proof_contract.py: 4d096b9b7bf3e5d41422f7989869808c06af550480ae39e8d52a99aec0d62a9a
kobo_copy_preservation.py: 3fc08d025de91f2716b0255027b2f5f1781b7cb920bb0cfaced5c9adb45b6b23
capture_kobo_fetch.py: 1eb67091011895f7ebe7f4431c55732eca0ab529a0f21b33a6303b3c4e977e86
runtime_release_contract.py: 92c77d2ce1d93d008ba31aedb3ce08a1e59a32e990b24f8b57fcbc708bf36f50
deploy_runtime.py: 3203b4ef40883bfdd8358cb09365d38934a24dfb4b3f3a8e5d6c05db5ec27691
freeze_runtime.py: de07e5ef4ba191bdd140c100b3a52dabc801751cf2d87217e6d79857b0c20491
collect_runtime_gate.py: 286331b5f31cfe960cd4c72565f7744f5d9923ceabf5320fef343f2a7291b165
known_core_disk_guard_v2.py: f88ec6a91093f2ba180f268e03bb21ea67ac6ce19c1ffa5f45abd3402d87b20c
known_core_disk_guard_v3.py: 878fd2ee7fd13c708e896f32724e3967e102e51915a10eb834e587105a40b90f
known_core_disk_guard_deploy.py: d1993f59d75c8e0da6b32f1a5bfc0343968caef05df92036ae991fcfd61f7c7f
launch_runtime_release.py: e82a336a1fa7adfe9d64bf87ca2bc049e418a1d6259abecbfae53783ca3771bf
export_freeze_runtime_kit.py: 934fe74b199bf39085a987349dcece309fa0085ef67ea47099cc07bd00c6edb8
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
production-baseline-source-review.json: 298044d52243a219d6e8d37affd1190b86d063b413470e183e98df8721bbae21
target-pin.json: 57e947c1761905132619dc34b2da996fec48f6597afb3f5bfb6aa765e7a6dfa9
rehearsal-receipt.json: 49b0c09a59234b30c6840223a35c1adc29c9e31d71992f9545a4761650c46f9e
proof-source-index.json: c356a90e8bcc3ac809c2edfb18eaec772b56764a30af54b57a6f7418fbdf1e66
proof-authority.json: cb0b4293b3e40354991671fe410087d0b547809bfa062463e84d5ed11aded024
first-sync-preservation.json: 1ddda2b383b0803286936476d70a30f3a84d1b9ea6cb41fb9d32619b52334d0c
second-sync-preservation.json: 010725a12a1afeaa61684c6a8712880048774c3e73397f10fa4cfe99eae12efa
full-copy-preservation.json: 3833aee797f29a088b21946de2d21306a34a8a81c0ff295b6a1ace996b16f619
upstream-before-start.json: 42641201f9569a7103aeb96a43f12ffee59445cec749640ffda46dc04da86610
upstream-first-completion.json: 3ed51aeb1c108b0485bf518e82fdbbce0504d6870714a6232b61d7d324b0857a
upstream-second-completion.json: 5dd4599453354a38996e599ba495af3711d4d052c62dc478c2295f5cce3bf2bd
packaging-source-index.json: b7c0eb3345e582e4144f2d1d0da29838e3bdaf81ea38deda8ee80d19e5fbad34
apache-before.conf: f46aeaae33c48a7634b06bffab09ecfe19ed8f2a8e8df21e2503d2c479f78c20
apache-held.conf: d92601efd55a8112b4775d101ce5f18beea29e33686c6b53dafa6efbae811b2c

Production stays on the old ae64 image until this NEW exact-kit pass and one fresh ten-minute single-use gate. No gate is collected early. The coordinator requires stopped hashed DB/assets backups, full original state, jobs-OFF zero writes/readiness/probes, ingress before jobs and 660 healthy jobs-ON seconds at 768 MiB/zero restarts. Every failure after any entrypoint attempt is forward-only through a separately audited fix. No restore, previous image, retry, heap override, pruning or cleanup. The original YY standing automatic-after-review evidence is unchanged. #291 stays held until #292 is live and your actual post-deploy check passes. Human cards are untouched.
