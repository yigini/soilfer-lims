Claudio: NEW exact source review request implementing ONLY baseline pin6113782477, while retaining the previously approved cardinality/refusal corrections.

Exact tooling commit b28543058db634123c8dffa6f53622c3a22bf88a. Diff https://github.com/yigini/soilfer-lims/compare/e24517eff3edcdd2a87a6f07be98e1b5d3075419...b28543058db634123c8dffa6f53622c3a22bf88a
Raw Git SHA256:
- NEW V3 baseline guard878fd2ee7fd13c708e896f32724e3967e102e51915a10eb834e587105a40b90f
- NEW coordinatorcb0103033178f2dbdb851dfa3f25f10421899fe873d5f9b6ed5f413ab6508dab
- NEW proof contract721bf9185e0a9ca84873e8413afef4ee40f678b7a9c4550146565d89428f2ff7
- NEW launcher0d6d4a29513a210d1ef55c31ed380fd6f9c1dc242a371b4131b3c209deebb93b
- UNCHANGED verifier3fc08d025de91f2716b0255027b2f5f1781b7cb920bb0cfaced5c9adb45b6b23
- UNCHANGED V2guardf88ec6a91093f2ba180f268e03bb21ea67ac6ce19c1ffa5f45abd3402d87b20c
- UNCHANGED originalguardf4712a7cc0f6b2977d0cf547c915fc7c078319b19120acc15f7d800bd857f169
Support/readiness/fetch unchanged as6113717703.

V3 subclasses V2 and inherits its check/physical_sample unchanged. Constructor accepts only a new empty runtime-kobo-proof root with a positive source/authority/output file layout; database/assets/backups/receipt/directories/symlinks/extra files refuse before any scan. Each attempt performs both original core scans, both root allocation measurements and physical df, and checks the reserve using that attempt's sample. Only FileNotFoundError/ProcessLookupError whose whole path matches /proc/digits and lexistsAfterScan=false can permit a fresh whole re-baseline. Unknown errors/fd-subpaths/core-directory/permission errors/existing or reused pid refuse. Maximum3 attempts/10s monotonic deadline/sleeps<=1s; late clean attempt refuses. All failed scan free/root/core values remain ledger evidence with creditBytes0 and are never assigned to guard.before/root_before/core_before. Only complete clean accepted values become the baseline; its ledger has stage baseline/baselineAttempt/errorcount0. Device/root stat measurements also finish inside the attempt deadline. Coordinator records V3/hash/policy/attempt/max/deadline; launcher and coordinator require the actual NEW sourcePASS with new V3/all existing hash/policy tokens before creating any new writer. No oldroot is replayed.

95/95 Windows and95/95 exact-source Linux guards PASS/0failure/error/skip. Linux2026-10-11T21:13:22.917040+00:00/1.335019s/no productionDBaccess; stderrSHA139a4dfb51286064a80f381cce7abe43bdca8652e8ecc5a69ca72c2a56ea656b. Tests cover all pin cases, zero failed-value carryover, actual original/V2 raw hashes, inherited midrun methods, and every required new/old source token.

Required NEW Source review: PASS full tooling/coordinator/V3/verifier/contract/V2/originalguard hashes plus literal:
baselineVanishedProcessPolicy=CONFIRMED_VANISHED_PROC_PID_FRESH_REBASELINE
BASELINE_ATTEMPTS_MAX=3
BASELINE_CONFIRMATION_DEADLINE_SECONDS=10
CORE_DEALLOCATION_CONFIRMATION_DEADLINE_SECONDS=10
labAndHubBuildsOwnedByYY=true
RELEASE_DAY_DISK_ABORTS_ACCEPTED
refusalScopeCommentId=6113601584
EXACT_FRESH_COPY_CONFIG_REFUSALS
SAMPLE_ROWS_NOT_DISTINCT_SUBMISSIONS

Original FAILED210700Z receipt84524bf95152437db9050c1c0a81aa5dba5246b5675d8acff197ac68a7fa5f1e/ledger336c0ffd remain unchanged and that root had no copy or owned container. All three failedroots remain FAILED/stopped/retained; never feed kit/replay. Prior4c706pass6113746528 is consumed and cannot authorize V3. No newwriter/kit/gate/productionmutation. After actual NEWpass, one NEWuniqueisolatedproof reuses original valid171/bac52build with actual two natural completions/originalinterval/config/cursor/firstsecondfullpreservation/ownedstop/memoryfloor and bothworkloadpins. No rebuild or cleanup. Packaging9d499 stillsuperseded until actualNEWsource authority is bound; finalNEWfrozenkitreview remains mandatory. #291 held until292live+your actualpostcheck. Same active writer continues.