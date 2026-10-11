NEW #291 build/proof source review requested. No new build/proof writer has started, and there is no #291 kit, gate or production attempt.

Exact source commit: 4807cc600eb4483fa64172fead304ed1a293197e
Working producers only; the completed #292 frozen kit and all original receipts/backups remain unchanged. New main f830f900 is the independently computed union of current deployed 171dd36c and reviewed PR291 5d3550d7. It intentionally differs from the audited PR branch tree; both immutable parents, audited branch tree and exact merged union are now separately bound.

Explicit bounded workload amendment: naturalIntakePolicy=ORIGINAL_CURSOR_ACTUAL_UPSTREAM. Production's recovered cursor has consumed the old 67-submission backlog. The fresh-copy proof captures its real current upstream IDs and permits an empty first and second natural completion. It never rewinds a cursor, changes interval/timestamps/configuration or fabricates intake. It retains the first/second original full-state seals, original 15-minute schedule, interval+2-minute observation and >=660 healthy seconds, zero restarts/blank heap/768MiB, both default-entrypoint 22NO_OP/21READY zero-write checks, 31+6 probes, strict104tables/38receipts/schema/all-original-row preservation, exact four-config refusal/pairing rules, all disk/reserve/core guards and workload pins. Actual new arrivals must be captured and preserved under the unchanged verifier. This amendment is a proposal requiring your NEW exact source PASS; the previous crash-backlog proof remains historical evidence, never relabeled or reused as this release's proof.

The build preparer now also requires this actual source PASS and exact raw builder/preparer/launcher hashes before any remote root creation. It independently recomputes both parents' union, retains the exact raw Git blob index and permits building while main CI is running. The proof launcher still requires actual SUCCESS of exact merged-main CI. No production database mounts/writes/stop during build or isolated proof.

111/111 scoped build/proof guards passed independently on Windows and exact-source Linux (23:06:45.030883 UTC,1.573275s,0failure/error/skip,no production DBaccess; Linux stderr SHA256 fcf9120f24c9a589de7bea188fbcd645302bd7f27a55802bf335974cdcd6f4c0). The production packaging contract remains deliberately bound to historical proof873/611421 and cannot freeze this new proof; it will be separately rebound and reviewed after your actual new proof-source approval. This is not a claim that its old package-authority tests apply to the new release.

Required NEW formal verdict: Source review: PASS, with these exact full bindings:
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
4807cc600eb4483fa64172fead304ed1a293197e
rehearse_runtime.py SHA256 e3a54b3d0dbc8bb39bad40f32467be41692b85a72e9cf0bb4a3bbb4f4b2b4950
proof_contract.py SHA256 2bafa4094ce5bac6e10abd5e347791ee39c047ba3df6b5f99977d863a76b5648
build_candidate.py SHA256 22e2cdc152253c5b85da8120b4c546e828e26262f6c460bec1330354be74a9e1
prepare_candidate_build.py SHA256 042ba7fb750646cd5edcfa9965b69c26d80a9534f5ce7e2695d82be05562696c
export_launch_runtime_proof.py SHA256 9df26b4a8d6effa75fea09a17dac8bf32efb99b8b07cd781c79ac5e9f613d221
known_core_disk_guard_v2.py SHA256 f88ec6a91093f2ba180f268e03bb21ea67ac6ce19c1ffa5f45abd3402d87b20c
known_core_disk_guard_v3.py SHA256 878fd2ee7fd13c708e896f32724e3967e102e51915a10eb834e587105a40b90f
kobo_copy_preservation.py SHA256 3fc08d025de91f2716b0255027b2f5f1781b7cb920bb0cfaced5c9adb45b6b23
capture_kobo_fetch.py SHA256 1eb67091011895f7ebe7f4431c55732eca0ab529a0f21b33a6303b3c4e977e86
f4712a7cc0f6b2977d0cf547c915fc7c078319b19120acc15f7d800bd857f169
CORE_DEALLOCATION_CONFIRMATION_DEADLINE_SECONDS=10
baselineVanishedProcessPolicy=CONFIRMED_VANISHED_PROC_PID_FRESH_REBASELINE
BASELINE_ATTEMPTS_MAX=3
BASELINE_CONFIRMATION_DEADLINE_SECONDS=10
refusalScopeCommentId=6113601584
EXACT_FRESH_COPY_CONFIG_REFUSALS
SAMPLE_ROWS_NOT_DISTINCT_SUBMISSIONS
refusalPairingScopeCommentId=6114143349
schedulerRefusalPairing=STREAM_ORDER_ONE_TO_ONE
REFUSAL_PAIR_WINDOW_SECONDS=1
labAndHubBuildsOwnedByYY=true
RELEASE_DAY_DISK_ABORTS_ACCEPTED

Only actual source PASS and green main CI authorize ONE fresh isolated proof. Only its stopped/PASSED original receipt can feed a separate new kit, which needs your NEW exact-kit audit and one fresh unused single-use gate before forward deployment. Existing YY standing auto-after-review evidence stays verbatim; no extra deployment go, no human cards answered, no changes to the four refusing configurations, no old-image recovery/restore/prune/cleanup. Other application merges stay held until #291 is live and your postcheck.
