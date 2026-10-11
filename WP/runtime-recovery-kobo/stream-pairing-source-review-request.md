Claudio: NEW proof source-review request implementing actual cross-stream pin6114143349 after FAILED211630Z. Exact tooling commit 873a021814fd252a082c46a4f5c25a733fe69f65. Compare https://github.com/yigini/soilfer-lims/compare/b2854305...873a021814fd252a082c46a4f5c25a733fe69f65

Raw Git SHA256:
- rehearse_runtime.py: 9d9cea571421c502ed4a5a1c5e2964f2e9470df9a8288a69df35c0770fb5d311
- proof_contract.py: 4d096b9b7bf3e5d41422f7989869808c06af550480ae39e8d52a99aec0d62a9a
- export_launch_runtime_proof.py: 265c25f28c7ccfb2bdc6bc45ba844614cea23ba470d3edbe19315654d61e5510
- kobo_copy_preservation.py: 3fc08d025de91f2716b0255027b2f5f1781b7cb920bb0cfaced5c9adb45b6b23
- known_core_disk_guard_v3.py: 878fd2ee7fd13c708e896f32724e3967e102e51915a10eb834e587105a40b90f
- known_core_disk_guard_v2.py: f88ec6a91093f2ba180f268e03bb21ea67ac6ce19c1ffa5f45abd3402d87b20c

Parser receives separate stdout/stderr captures. Triggers in stderr or refusal errors in stdout refuse; FATAL/General/untimestamped/unexpected format/unknown lab/message still refuse in either stream. Each lab pairs its i-th stderr error with its i-th bound stdout trigger in original line order, never sorted Docker stamps. Exact signed nanosecond comparison |delta|<=1 second, missing middle/extra/unmatched errors fail; only a trailing suffix <=1 MOZ or <=3 TUR triggers may remain in flight. TUR per-config counts are derived trigger attribution; per-lab counts authoritative. Each observed pair retains both complete raw lines/stamps/signedDeltaSeconds/1-based stdoutLineIndex+stderrLineIndex. Coordinator seals separate original stdout/stderr mode0400/SHA-bound; receipt records new policy/scope/window/per-lab counts/derived-config flag. Completion parsing uses stdout only. Exporter and coordinator require NEW actual source PASS with all prior source/guard/verifier/baseline pins PLUS three pairing tokens below.

132/132 Windows and132/132 exact-source Linux guards PASS/0fail/error/skip; Linux21:51:47.710004UTC/1.604842s/no productionDBaccess/stderrSHA c4ab061c179089677f9001e909a7ec309061fcf08de9e26a190693cc26d8099a. Real stopped211630 stdout afa9312bf20f3266a9810ddd971d7112ea37b23a5e04229a391dbf696c27a16c and stderr108edb92232ac4cec5eeb659c1a750025ebd0319e95fcb8ae6079ca860f47e1f pass the parser with exactly4 negative deltas/max0.219442ms. This regression is diagnosis only; original FAILED receipt remains FAILED. Synthetic1.5s/+1ns-over-bound/extra/missing-middle/wrong-stream/reordered-stream/excess trailing refusals, valid trailing/interleavedTUR triple cases pass. Fixture runner was corrected to load committed raw logs; final Linux run is green.

Originalguardf4712a7cc0f6b2977d0cf547c915fc7c078319b19120acc15f7d800bd857f169/V2/V3/verifier/support/startup/fetch byte-identical. No data/config/cursor/interval/timestamps/768MiB/blankheap/500MB/physicalreserve/strict original-row policy changes. No new writer, build, kit, gate or production action. Runtime release contract deliberately STILL binds oldb285/611383; pending packaging cannot freeze corrected proof. After actual NEW proof source PASS, explicitly bind actual new source/hash/reviewID, then request separately NEW production source PASS; old611401 cannot cover it.

Required NEW Source review: PASS must bind fulltooling/coordinator/proofcontract/verifier/V3/V2/originalguard hashes and:
refusalPairingScopeCommentId=6114143349
schedulerRefusalPairing=STREAM_ORDER_ONE_TO_ONE
REFUSAL_PAIR_WINDOW_SECONDS=1
refusalScopeCommentId=6113601584
EXACT_FRESH_COPY_CONFIG_REFUSALS
SAMPLE_ROWS_NOT_DISTINCT_SUBMISSIONS
baselineVanishedProcessPolicy=CONFIRMED_VANISHED_PROC_PID_FRESH_REBASELINE
BASELINE_ATTEMPTS_MAX=3
BASELINE_CONFIRMATION_DEADLINE_SECONDS=10
CORE_DEALLOCATION_CONFIRMATION_DEADLINE_SECONDS=10
labAndHubBuildsOwnedByYY=true
RELEASE_DAY_DISK_ABORTS_ACCEPTED

Then ONE new unique isolated proof using original valid171/bac52 build. All four FAILED roots/receipts/containers remain stopped/retained/never replay/never feed kit. #291 held, human cards untouched, same active writer continues.