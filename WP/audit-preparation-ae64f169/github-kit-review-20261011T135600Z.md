Full fresh-production-copy rehearsal PASSED; exact ae64f169 kit is frozen for Claudio's review.

Head: ae64f169e56e7677a920a3b60a7b1fe0dbfa4ccf (#205 / PR #288 plus Results/Excel PR #290). Actual main independently remains this exact head; both PR exact-head audits/CI and merged-main CI 38133894755 pass, ungated 0. Follow-up PR merges remain held.

Original PASSED proof: /opt/lims/releases/preparation-ae64f169-rehearsal-20261011T134600Z, completed 2026-10-11T13:54:05.208171 UTC. Unit lims-owned-ae64f169-proof-20261011t134600z.service completed/inactive, exit 0; owned candidate stopped. Independent verification passed 13:55:36 UTC. All 24 CLI measurements <=805306368 B, maximum 555188224 B, startup peak 353198080 B, no heap override. All 21 prior-schema DRYs passed with zero changes; retained acceptance checked directly read-only (no reconciliation invocation). Only #205 applied, exactly one additive receipt/no backfill; immediate repeat NO_OP/0 with DB bytes preserved. All 21 ordered READY events, 31/31 checks and six read-only probes passed with zero startup/probe DB changes. All 103 original tables/fields and 37 receipts preserved, PreparationRecord empty/new and WorkItemDraft.records exact nullable addition, no analytical/acceptance changes, integrity ok/FK0. Existing acceptance event, ReviewDecision attemptId NULL and published report remain intact. Every failed proof receipt remains unchanged and contributes nothing.

Frozen root: /opt/lims/releases/preparation-release-ae64f169-20261011T135600Z, prepared 2026-10-11T13:55:37.637518 UTC, PREPARED_ONLY_NOT_EXECUTED. All 25 files independently hashed/mode 0400; original proof receipt unchanged.

- Manifest SHA256: 4f98943cd0a3ac117c235822ad8b27012968d56a518109d3f1b49f76ebd207f6
- Coordinator SHA256: e328c26742c7213508de351486e634aa030c2db50720da250e29230bb6e05c73
- PASSED rehearsal receipt SHA256: 05b6a4a90d15c0b0df62b52a7e3536b34dfad99a7b53b8643e1a98de6e78e6c8
- #205 migration SHA256: e2d59e7b54096d97de5d1443f28516869672b2178cb3da345299d24838a7013c
- YY original scope evidence SHA256: 02311daec1d07150535d557ffc19dc5833bc6e4937aaa9c0394d543cc69b5bd1

Raw tooling source: 2ebf2b3d4a4a3816179d8e86e88577f02dcc1898, WP/audit-preparation-ae64f169. Original valid bc2557a5 build/source archive/2,234 Git blobs retained; no rebuild or failed proof reused. The exact SQL comparison models only the reviewed ALTER on an empty in-memory schema, checking original constraints/literal defaults; all 13 Linux guards pass, log d0d9b44aebd3496e89bb42ded01eeff49d045b250312206f340dcbfe84301008.

The byte-exact prepared-manifest-20261011T135600Z.json, rehearsal-receipt-passed-20261011T134600Z.json, kit-source-index-20261011T135600Z.json and build-origin-20261011T135600Z.json are pushed in WP/audit-preparation-ae64f169 on audit/release-eb6de2e8. All reviewed executable bytes are at tooling source 2ebf2b3d. Fresh PR/main snapshot SHA256 e5b6919992d07e09da2277204404c4da5f243165dddf0ff779a56fe0dfa939b0 is retained there.

Claudio: please post the exact-kit pass here containing exactly `Audit passed: OK to merge and deploy`, the full head, all three kit hashes, migration/YY scope-evidence hashes above, and both workload pins `labAndHubBuildsOwnedByYY=true` / `RELEASE_DAY_DISK_ABORTS_ACCEPTED`. YY's standing Auto after review / my go covers all already authorizes the reviewed scope; no extra go is needed.

No production execution gate, new installer, quiesce or deployment has occurred. Current feac/159057d5 remains live. After exact-kit review, Pip will collect one fresh 10-minute gate and execute this unchanged kit with reserve/drop, stopped-writer backup, preservation and forward-only guards. No restore, older image, completed-installer replay or cleanup.
