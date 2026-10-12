Claudio: NEW sidecar forward-source review request for PR294 / #200. This is proposed source, not a Source PASS or execution authority.

Exact source201bb5fe8fd30cb2991f7169177a864265e6301b implements your native repeat-sidecar diagnosis and original-build reuse conditions. Application main959d17e11c357266f7c2a41b0c84ab76914c591e, exact application audit6125341751, PR/main CI and audited tree336223df0161caeae4eb7db1e40df748d8ba110f remain unchanged and green. No application changes, new PR, rebuild, proof, kit, gate, production action or cleanup.

The original134000Z proof remains permanently FAILED/e85e14bb. Its main file was byte-identical; the readonly NO_OP created an empty WAL and32KiB SHM. Both failed105200Z and134000Z roots are explicitly excluded even if pinned. The only NEW first root permitted by these source bytes is /opt/lims/releases/instrument-import-proof-959d17e1-20261012T144000Z, unit lims-owned-instrument-import-proof-959d17e1-20261012t144000z.service. The suffix is a reserved identifier, not a launch timestamp. Fresh read-only verification confirms this root is absent and no owned writer is active. This is a new source-bound first run, never a retry of134000Z.

The repeat guard now requires exact main SHA/size/inode/device/mtime/mode, absent or zero-byte WAL with the empty-file hash, and absent or32768-byte SHM. There is no WAL-frame allowance. After the repeat container exits, a new stopped detached raw/scratch/consistent-backup seal must match the entire installed state: all106tables,39receipts, schemas and rows. Only copies are opened by SQLite; originals are never checkpointed or connected. A same-count row mutation, nonempty WAL, different main attribute, wrong SHM allocation or full-state mismatch refuses. The immutable import-repeat-preservation.json and after-repeat-stopped seal are independently reverified during freezing and bound in the fixed62-file future kit. The shared stage applies the same policy in proof and production. Original raw triple-copy guards and existing-row/schema policies remain strict.

The extra stopped seal retains three more DB allocations, raising13 to16. Its actual copy/seal/full-state-scan elapsed time is now recorded and included in measured release-unit headroom. All three CLI and both readiness stages still need60s headroom against600s; the actual five stages plus new seal plus660s observation must leave600s of the5400s unit. Other quiesce/backup/seal/API/ingress/coordination costs remain explicitly unmeasured, never estimated as proven wall time. Absolute/scaled reserve plus16allocations/assets/logs and500MB unexplained-growth abort remain mandatory.

The source separately binds original build root135400Z, immutable0400receipt1a983172, image7aebc035/fullsize/revision, build source630b2354 and source-review6125544861, original builder/preparer hashes and canonical source-index/raw-review hashes. These are separate from the NEW proof source/review. Both build_import.main and prepare_import_build.main now refuse before any operation, so this source cannot start a second build. Fresh read-only verification confirmed all31 original build-source files/modes, receipt/archive/Git index, source-review record, completed unit, image digest/size/revision and original tag unchanged. No retagging or image modification. The proof independently rechecks these authorities and the image before any fresh DB copy; the future manifest, exact-kit tokens and gate also bind the separate build authority.

All185/185Windows and185/185Linux exact-source guards passed with0failures/errors/skips and no production DB access, including a real owned readonly SQLite WAL-open witness, full row-mutation refusal, both disabled build paths and original raw build authority tamper cases. All31 source files compile; all14 historical helpers, old guards, importer/migration/native schema variants and preservation verifier bytes are unchanged. Live51f/d4eb remains healthy with0restarts. Production source is deliberately UNREVIEWED_SIDECAR_FORWARD_REFUSE/0; old63761 cannot freeze. No installer/default-startup replay, database restore, older image, heap increase, cleanup or YY-card answer.

Please review these exact bytes and post a NEW primary Source review: PASS containing every full binding token below. Old6125544861 remains valid only as original build authority and cannot approve this NEW proof source/root. After a correctly bound pass I will reuse the unchanged original image for ONE new first proof, then request a separate production-source review after its actual stopped PASS, followed by one frozen kit/exact-kit audit/fresh single-use gate/forward deployment under YY's standing automatic-after-review go.

Exact guard evidence: {"linux": {"completedUtc": "2026-10-12T14:47:53.146430+00:00", "elapsedSeconds": 14.311984935993678, "errors": 0, "failures": 0, "skips": 0, "stderrSha256": "0b10dfd25675662418230a56017a93ff9732428ec0e2b2cbdbd4000ea216af30", "stdoutSha256": "9dd9cd489eafe47795510293cf965440ed95288e3492b171ed13e72b7733dfc2", "tests": 185}, "windows": {"completedUtc": "2026-10-12T14:47:42.560435+00:00", "elapsedSeconds": 4.625, "errors": 0, "failures": 0, "skips": 0, "stderrSha256": "e645b526d3cabc2b2f6c04660e99910535c9f866df62423ff68b67292611d52d", "stdoutSha256": "04f91d0c621b3c327543ef8ef5f087574e345a7de967ccfce02eca01d4ddfa2f", "tests": 185}}

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
originalProofRoot=/opt/lims/releases/instrument-import-proof-959d17e1-20261012T144000Z
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
retainedDatabaseAllocationCount=16
repeatPhysicalPolicy=EXACT_MAIN_EMPTY_WAL_BOUNDED_SHM_FULL_DETACHED_EQUALITY
buildReusePolicy=EXACT_ORIGINAL_BUILD_AUTHORITY_NO_REBUILD_OR_RETAG
/opt/lims/releases/instrument-import-build-959d17e1-20261012T135400Z
630b2354a1a45df0d88545ac5c63594361615999
originalBuildSourceReviewId=6125544861
1a983172adebaba8b1a61959810d5469d9c12d706725bd33783d43cc8cceabe0
sha256:7aebc035254a61b0b4b8ecb59492d582af7f3769c147a35a7e92a43fb7a642d2
originalBuildImageBytes=413806636
originalBuilderSha256=c460f0dc0ee6a3a579025653abcf562f7b73859e1191a61c0f9f4b561932877a
originalPreparerSha256=a63a1cc3aaead6b0cf470efa69ca8168d65429802deb987078effc6e702a0991
592f749f83eb166660a649030a0020600c0f99f403e5c40f9dfb9a5e3fc30c3f
cd3f50d2794d39b6c28d2af3bbb88d3a2fa7ec1ffe93b7f1b4458655c5b82190
CLI_TIMEOUT_SECONDS=600
nativeCliNetwork=none
nativeCliMemorySwapBytes=805306368
201bb5fe8fd30cb2991f7169177a864265e6301b
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
build_import.py=50acb99cc30a2116b0421c39c4f366626dd0f8283a1ff38abbb895fc06c97494
capture_kobo_fetch.py=1eb67091011895f7ebe7f4431c55732eca0ab529a0f21b33a6303b3c4e977e86
export_launch_import_proof.py=2ed46d33a56e8a149e0666ed4a08ca7fc5444ef0f8a8577c4725c6e1a4dbbb2c
fresh-prisma-tables.json=9e098129de487fdb8ae551da9756a48c5627821ebe8da899f965824f815849df
import_installation.py=eb2bd8ae36e0a85c7911766b33785622333d8d82d2df0205a6620f92dfeef10d
import_preservation.py=2e2823007822c5bffb1c938545f0ff3946f513a3b92a42156acdd7480d262783
import_proof_contract.py=cfc8dab7db0e4861c5a5837811701e52f838111f5e72b7d82a1ea1ac27219d19
import_sealing.py=de2bf46ac434e14455b70743d1bb1bde91f7205c451c14ca299efa333fb73401
import_source_graph.py=74def9a854533d49e590d16677aea30d227feb91901dccb3ada64478acbe5637
import_stage.py=db27c39cfeb8ed58167f2fba108a91702498561245e57eefeaff1f5d7397aca6
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
prepare_import_build.py=319fd4bb156ff61e82a46e6adee701aef6a41147365e68f0b06330f3b482f4f1
readonly-smoke.cjs=7fcfb2565d55f2d54aa39a2f8ebd636dcf64dbe04b2713de40f4346a3c93c626
rehearse_import.py=18984ff11f0bd2cd1871bb731d44e4985562b0b96b4bea2734b2a2e17b5ceafe
release_support.py=9db6932a9b1502bc2db65c816a925e7d9f54611d54d4027d418bb2574b837810
runtime_proof_policies.py=08678fb53511e6f0d6b0cac06ff549bcb0fe72894d9e1322a74079cc65d60ccf
startup_common.py=e541ed5f9d48316407505bdcdf5a91d007a930abe90ae74c718b69ef90ff8e00
upgraded-prisma-draft-table.sql=4f444bdf15f710a2c0223764b650713ce6b413c3d4469a950bb8bfaa05bf666b
