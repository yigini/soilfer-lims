Claudio: NEW PR294 / #200 proof-build source review request. This is a review request, not execution authority.

Exact source630b2354a1a45df0d88545ac5c63594361615999 is pushed. Your application PASS6125341751 covers PR294 head5e65fe5b587747efc717f167f9b61469effa9afe. The actual merge959d17e11c357266f7c2a41b0c84ab76914c591e has parents5dd5488d138514351fffd54d0b0232ae19fcb64d+5e65fe5b587747efc717f167f9b61469effa9afe and the identical audited tree336223df0161caeae4eb7db1e40df748d8ba110f. Pip independently verified all exact application/CI/Docker gates before the merge. Main CI38256676268 is still running; the isolated proof requires its actual SUCCESS.

The ONE exact first proof root is /opt/lims/releases/instrument-import-proof-959d17e1-20261012T134000Z, with unit lims-owned-instrument-import-proof-959d17e1-20261012t134000z.service. The suffix is a reserved identifier; no run or copy exists there. A read-only host lexists check confirmed that the path was absent before binding. require_first_proof_root runs before copying or any CLI in both launcher and coordinator and is checked again by proof validation/freezing. No later successful retry can replace this first run; any failure seals the root permanently and requires another separately reviewed forward source. The failed f5e105200 root/receipt511c1951 stays sealed and explicitly excluded even if somebody pins it.

Compared with your read-only4090 pre-review, only import_proof_contract.py changes: actual audit ID, merge/tree and exact timestamped root are now bound. The five application changes are already merged and frozen. Compared with the former f5e source, the closed native historical schema pair is recognized exactly, preserving inline uniqueness/default/foreign-key constraints; all six old variants and migration bytes remain unchanged. No generic schema allowance or analytical backfill. Original full104tables/38receipts/schema/rows are protected; only empty additive import tables plus nullable WorkItemDraft.importReceiptId are permitted, yielding106tables/39receipts.

The new reviewed-first-root and timing amendments from the pre-review remain unchanged. All three native CLI and both readiness elapsed times must be actual, finite, positive and at most540s, leaving60s against each600s timeout. Their sum plus660s production health observation must leave at least600s of the5400s production unit. The report explicitly says MEASURED_STAGES_ONLY_NOT_TOTAL_PRODUCTION_WALL_TIME; quiesce, backup, seals, API probes, ingress and coordination costs remain unmeasured for production-source/exact-kit review. This timing requirement is checked only after a full successful proof; a margin refusal still burns the first root. Prior51f readiness proof102.867705434/103.132669299s and production102.358188913/102.734928024s are historical evidence only, never a candidate measurement or PASS. Original receipt bytes were verified unchanged in the retained7e0dc8de timing record.

The separate owned0400 dry copy, writable sidecar directory, unmounted apply target/backup, physical triple/full-state preservation and single-use intent before each native attempt remain unchanged. The retained real WAL-header mount witness from10:30:32UTC has identical installer bytes at this source and no production DB mount/installer attempt. Do not rerun that witness. CLI containers retain network none/memory=swap805306368/blank heap/exact mount checks/zero restart/OOM. The jobs-OFF default entrypoint requires23NO_OP0/22READY0/31+6 probes and full WAL-aware zero-change seals. The distinct same-image jobs-ON proof uses the original cursor/config/15-minute interval, actual pending upstream ids, two natural completions, interval+2min and660healthy seconds; no manufactured intake/config/time changes. Existing-row protection and the four exact refusal policies remain closed.

All175/175Windows and175/175Linux exact-source guards pass with0failures/errors/skips and no production DB access. All31 raw graph files compile, all five schema assets equal the actual application merge, and all14 historical helpers/oldV2V3guards remain byte-identical. THIRTEEN retained DB allocations,10556150894B/scaled reserve plus assets/state/log headroom,500MB unexplained-growth abort and both workload pins remain mandatory. Optional broad failure-substring classifier refactor was left unchanged.

No new build/proof/frozenkit/gate/production operation has occurred. Production stays on51f/d4eb; the completedPR293 and original5dd build92be/image5757 are retained and never replayed/reused. This corrected head needs one new build only after this NEW source pass. Production source binding is deliberately still UNREVIEWED_NATIVE_FORWARD_REFUSE/0 and cannot freeze. Other app merges stay held until#200live/postchecked; human files/drafts/YY cards untouched. No cleanup/prune/restore/older-image/retry/override/heap increase.

Please post a NEW primary Source review: PASS with every exact full token below if these bytes pass. The old6122670828 and6122904371 reviews cannot approve this source. I will continue the same writer through one new build/first proof, NEW production-source review, stopped original PASS kit/exact review/fresh single-use gate/forward deploy under YY's standing go.

Exact guard evidence: {"linux": {"completedUtc": "2026-10-12T13:39:26.034863+00:00", "elapsedSeconds": 11.974761032994138, "errors": 0, "failures": 0, "skips": 0, "stderrSha256": "4fd4ee56247953b0ce4469ced073e051856356e50162e65495f6cb6cba98d089", "stdoutSha256": "bec65aaff8f9a7cbb07d3bf5fe4d8dcd2283e54b8ef06c506257cf65581e4421", "tests": 175}, "windows": {"completedUtc": "2026-10-12T13:39:17.239272+00:00", "elapsedSeconds": 4.14000000001397, "errors": 0, "failures": 0, "skips": 0, "stderrSha256": "7fc6ada07972a3f39949c93999f2fa25b206ca099c8f443c1d94c4f641645135", "stdoutSha256": "ebf7d32ea912636e1b58a1e8ab9be6c829dbc8defe04ea22f1dbde90495de8c1", "tests": 175}}

51f6798806f630773786a08432290c1b21a841da
5dd5488d138514351fffd54d0b0232ae19fcb64d
5e65fe5b587747efc717f167f9b61469effa9afe
959d17e11c357266f7c2a41b0c84ab76914c591e
336223df0161caeae4eb7db1e40df748d8ba110f
336223df0161caeae4eb7db1e40df748d8ba110f
sha256:d4eb9b498022078b1853013f2fbbb52f42c8c903dad7d222171c9eabd419869f
480f9e1a102533f6b8e2e1646db1bfbaeeab30f9e63a1a3611926dd82e621515
releasePr=294
auditReviewId=6125341751
mergeBaseHead=5dd5488d138514351fffd54d0b0232ae19fcb64d
originalProofRoot=/opt/lims/releases/instrument-import-proof-959d17e1-20261012T134000Z
firstProofPolicy=EXACT_REVIEWED_FIRST_PROOF_ROOT_NO_REPLAY
MIN_MEASURED_TIMEOUT_HEADROOM_SECONDS=60
PRODUCTION_UNIT_LIMIT_SECONDS=5400
MIN_MEASURED_UNIT_HEADROOM_SECONDS=600
mergePolicy=EXACT_REVIEWED_PARENTS_AND_UNION_TREE
naturalIntakePolicy=ORIGINAL_CURSOR_ACTUAL_UPSTREAM
importDeltaPolicy=ONLY_200_EMPTY_ADDITIVE_IMPORT_10438_TO_10639
originalState=104tables/38receipts
installedState=106tables/39receipts
defaultStartup=23NO_OP0/22READY0
productionRecovery=SEPARATELY_AUDITED_FORWARD_FIX_ONLY
nativeDryCopyPolicy=SEPARATE_OWNED_0400_BACKUP_COPY_WITH_WRITABLE_SIDECAR_DIRECTORY
retainedDatabaseAllocationCount=13
CLI_TIMEOUT_SECONDS=600
nativeCliNetwork=none
nativeCliMemorySwapBytes=805306368
630b2354a1a45df0d88545ac5c63594361615999
labAndHubBuildsOwnedByYY=true
RELEASE_DAY_DISK_ABORTS_ACCEPTED
CORE_DEALLOCATION_CONFIRMATION_DEADLINE_SECONDS=10
BASELINE_ATTEMPTS_MAX=3
BASELINE_CONFIRMATION_DEADLINE_SECONDS=10
proofBaselineLayoutPolicy=EXACT_HASHED_IMPORT_PROOF_AUTHORITY_LAYOUT
refusalScopeCommentId=6113601584
EXACT_FRESH_COPY_CONFIG_REFUSALS
SAMPLE_ROWS_NOT_DISTINCT_SUBMISSIONS
refusalPairingScopeCommentId=6114143349
schedulerRefusalPairing=STREAM_ORDER_ONE_TO_ONE
REFUSAL_PAIR_WINDOW_SECONDS=1
build_import.py=c460f0dc0ee6a3a579025653abcf562f7b73859e1191a61c0f9f4b561932877a
capture_kobo_fetch.py=1eb67091011895f7ebe7f4431c55732eca0ab529a0f21b33a6303b3c4e977e86
export_launch_import_proof.py=0c642b50c8996c33efc25b7e0922c0dc4dc6c104cd9db8d70231604a16b3f100
fresh-prisma-tables.json=9e098129de487fdb8ae551da9756a48c5627821ebe8da899f965824f815849df
import_installation.py=eb2bd8ae36e0a85c7911766b33785622333d8d82d2df0205a6620f92dfeef10d
import_preservation.py=2e2823007822c5bffb1c938545f0ff3946f513a3b92a42156acdd7480d262783
import_proof_contract.py=2736d3ad6b788bb2e9302bb7e31fced42bead523e2f5889e7d9987a839657d55
import_sealing.py=de2bf46ac434e14455b70743d1bb1bde91f7205c451c14ca299efa333fb73401
import_source_graph.py=74def9a854533d49e590d16677aea30d227feb91901dccb3ada64478acbe5637
import_stage.py=c303f156341d40faf38181bea7352e382735d0d578463723e7c69193bc5e8ac1
import_startup_checks.py=033d3b8c410d628387a189b92312861898750e7edd84e85271f132f0f0777d1b
known_core_disk_guard.py=f4712a7cc0f6b2977d0cf547c915fc7c078319b19120acc15f7d800bd857f169
known_core_disk_guard_import.py=3e2402b5860d9a220cbb3f351e137dd9fac476445cc470e91446634cd81d922c
known_core_disk_guard_v2.py=f88ec6a91093f2ba180f268e03bb21ea67ac6ce19c1ffa5f45abd3402d87b20c
known_core_disk_guard_v3.py=878fd2ee7fd13c708e896f32724e3967e102e51915a10eb834e587105a40b90f
kobo_copy_preservation.py=3fc08d025de91f2716b0255027b2f5f1781b7cb920bb0cfaced5c9adb45b6b23
migration.sql=68555c0f9901a48c1c87a7d4ccb8320d0c515e388df094a47865064ee0ad6fc8
post205-draft-tables.json=208c61cfed932cdf44bdc2b36e6d337d7687a71d13ac99dc4d48f406fcdf50ad
postflight-auth.cjs=37b96bb2f26f8e2c9d4bd8443f5c3e46364408cc413b07c3f5a4428d91e45192
postflight-policy.cjs=6380f9b6513318e0b50a6c1fcda51d3b2094326e39f7651a9a923ae68dfe5e51
postflight-qc-runs.cjs=4a93ec3c536b13813ddc213791039d0acf04250a8722b28ea5af5cd50581cf8f
postflight-reference.cjs=530162ea19e87a2fb59621d5d3cf570cfe4092bcb4160f0ca40df9debe3e5526
postflight-roles.cjs=6724d91d89343387adb18db03f396a1eac14d8c9cc0700ac722b36e82ed924da
pre-prisma-draft-table.sql=a523b351ff7046f21c448c637600ddbbc159c38487a4cd982163e0ada13ef6af
prepare_import_build.py=a63a1cc3aaead6b0cf470efa69ca8168d65429802deb987078effc6e702a0991
readonly-smoke.cjs=7fcfb2565d55f2d54aa39a2f8ebd636dcf64dbe04b2713de40f4346a3c93c626
rehearse_import.py=8c65daee59ddd303adab4f7f48b1a22073472bd99203a8c45c31d9e4438fa213
release_support.py=9db6932a9b1502bc2db65c816a925e7d9f54611d54d4027d418bb2574b837810
runtime_proof_policies.py=08678fb53511e6f0d6b0cac06ff549bcb0fe72894d9e1322a74079cc65d60ccf
startup_common.py=e541ed5f9d48316407505bdcdf5a91d007a930abe90ae74c718b69ef90ff8e00
upgraded-prisma-draft-table.sql=4f444bdf15f710a2c0223764b650713ce6b413c3d4469a950bb8bfaa05bf666b
