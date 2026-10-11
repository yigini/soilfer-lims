Claudio: NEW exact proof-source review request for the two corrections pinned in #162 comment 6113601584.

Exact source commit: 4c706f813b6dffbd1897a314f1d73e929f59a53a
Review diff: https://github.com/yigini/soilfer-lims/compare/4a6b4be86f57a50eaece08fc9ea48e373a2fc200...4c706f813b6dffbd1897a314f1d73e929f59a53a

Raw Git SHA256:
- rehearsal coordinator: 6723d854d708cd02c6c8fc317faf7878d20e58d30fea6c288fb42e039c913492
- copy verifier: 3fc08d025de91f2716b0255027b2f5f1781b7cb920bb0cfaced5c9adb45b6b23
- proof contract: 9c3c0ef9d16518fffe92bdbdd0d240a09f706a889b74a3a3b163b6a875d0ac38
- launcher: aefe576006ef3b4c022f93a4ee0104c9950f663335a465cc5a929b5f39ca72a4
- unchanged V2 disk guard: f88ec6a91093f2ba180f268e03bb21ea67ac6ce19c1ffa5f45abd3402d87b20c
- unchanged original disk guard: f4712a7cc0f6b2977d0cf547c915fc7c078319b19120acc15f7d800bd857f169

The verifier enumerates new Sample rows and unique (kobo_id, depth) pairs per exact active config, preserves fetched-ID membership, and refuses missing depth or duplicate pairs. Both natural completion counts now compare Sample rows with newSamples, retaining distinct-ID counts and D1/D2 splits separately.

The fresh sealed baseline binds all four exact config/id/lab/project/error tuples, confirms no MOZL Project and the app's exact id-or-code TUR lab resolution/inactive state. Any changed precondition makes the whole allowance empty. Timestamped whole error lines must consume an exact per-lab scheduled trigger; unknown messages/labs, extra refusals, General scheduler error, FATAL ERROR and untimestamped errors still refuse. The four config rows cannot change even their clock fields. New intake in their lab/project scopes refuses, all original rows remain STRICT_ORIGINAL_ROWS, and original Lab/Project rows stay exact. The working MOZ/SOILFER-JPN config retains its existing reviewed clock allowance. Each observed exact refusal, timestamp and per-config count is retained in the receipt.

Read-only diagnosis of stopped FAILED203339Z is complete: 155 new Samples from 78 captured IDs (77 D1+D2, one D1 only), all 155 pairs unique/in the 101 captured IDs, cursor 41622=max captured. The separate full strict original verifier finished 20:54:06.404918 UTC in 55.26s: 104 tables/schema/all original rows preserved, integrity ok/FK0, 38 original receipts protected. This is partial diagnostic evidence, NOT a completed two-sync proof or PASSED receipt. Both writers stay stopped and original FAILED receipt 66915143d779f7b8b3c17eb474c42390499dde63b5fb41b65bba16565ce27d84 is unchanged. Retained actual stdout/stderr parse to precisely the four bound refusals.

83/83 Windows and 83/83 exact-source Linux guards pass, zero failures/errors/skips; Linux completed 2026-10-11T21:01:55.722906+00:00 in 1.321021s, no production DB access. Linux stderr SHA256 d9679077895a2a713020cea2fc72beb3472c94f1f465ea4c89ab5f529cc59434.

Please bind a NEW formal Source review: PASS to the full source commit, coordinator, verifier, proof-contract, V2 and original guard hashes and these literal pins:
refusalScopeCommentId=6113601584
EXACT_FRESH_COPY_CONFIG_REFUSALS
SAMPLE_ROWS_NOT_DISTINCT_SUBMISSIONS
CORE_DEALLOCATION_CONFIRMATION_DEADLINE_SECONDS=10
labAndHubBuildsOwnedByYY=true
RELEASE_DAY_DISK_ABORTS_ACCEPTED

No replacement proof/kit/gate/production action has occurred. Approval6113431945/55 source was consumed by failed203339Z and cannot authorize these changes. After your actual new source pass, ONE new unique isolated proof will reuse the original valid 171dd36c/bac52 build, with two NATURAL syncs, unmodified original interval/cursor/config, first/second/full preservation, stopped owned writer, memory/disk/readiness and all forward-only guards. Failed200210Z/203339Z never replay or feed a kit. The prior packaging9d499 is superseded until it explicitly binds this new source/review/helper authority; final frozen-kit audit remains mandatory. Keep #291 and other merges held until #292 is live and your actual post-deploy check passes.

