# A0 exchange reliability release evidence

3 October2026. Codex implemented, tested, independently reviewed, merged and deployed the public diagnostic correction in PR159 after the Agy PR158 increment. A and B1/B2 are still pending; this is not full issue140/156 completion.

- Accepted head: `5a574ef8709cdc7354de4583884dce79bad31095`; PR159 CI37148724783 SUCCESS.
- Guarded merge: `8b0ac597f7ce527dfe13397a379f5f383fdd4cbc`, tree `3d62909a84b373493989f3250596fa06f7a5f717` equals accepted head tree. Exact main [CI37149597786](https://github.com/yigini/soilfer-lims/actions/runs/37149597786) SUCCESS. No bypass/admin merge.
- Focused disposable-copy tests: `exchange_error_semantics` and `exchange_diagnostics_privacy`,21/21 PASS. Existing accepted PR158 contracts retained.
- LF immutable source archive SHA256 `e23c72eeea5af65a084fec7e456a0c97bb3d0c59c61518626f49ed7fe7d2ef96`; target image `sha256:68b6780e170d5f24977e129ecf35621dcc5f1f35dc54557409effc99d5b73b98`, tag `v3.5.33-8b0ac59`, source revision exactly merged main. No schema changes.
- Operator wrapper SHA256 `a3b4ed7b7e90177ac107eb103ca036a63f133b474dec86c49b3106a96fd722e0` uses accepted pinned-image, stopped-writer backup, global lock, ingress hold and phase-aware recovery. Original postflight scripts/deadlines unchanged; independently reviewed authenticated startup probe additionally pinned as `37b96bb2f26f8e2c9d4bd8443f5c3e46364408cc413b07c3f5a4428d91e45192`.
- Successful host ledger `/opt/lims/logs/release_ledger_issue159_20261003_221538.json`, transcript `release_issue159_20261003_221538.log` (host filename timestamps use host local time). Consistent backup SHA256 `cda879c6bc2add576738cbc69845da06f301c0cf0505b104f883fff806882014`; assets SHA256 `7921958ff04086be1b9c2b59490c5aa102123cc8d91d33abbd4600b3cbf9234a`.
- Before exposure counts remained38,566 samples/19 results/49 users/10 labs; integrity OK and foreign-key violations0. Read-only exchange postflight31/31, admin/manager/technician role gates PASS before and after exposure. Background writer hold removed only after COMMITTED; proxy hash restored exactly.
- Independent public checks: health200, appearance200, unauthenticated stats401 on all four v1/v2 exchange aliases with distinct bounded generated request IDs. Actual runtime digest/revision and both touched service file hashes matched exact Git blobs. Do not inject a real database fault into production; routed503 fault semantics are established by exact-code isolated tests.

## Earlier failed attempt retained honestly

Attempt `20261003_220555` stopped before COMMITTED when the first authenticated directory request exceeded the original5-second postflight deadline. Counts/integrity were unchanged; automatic stopped-writer recovery restored the accepted theme image and reopened healthy ingress. Recovery rotated the exchange epoch: clients holding an old checkpoint may need the established fresh-snapshot/rebaseline flow while retaining previously imported data. No claim that receiver ingestion is completed.

Cold initialization/resource pressure is a hypothesis, not a proven root cause. Added startup probe has hard30-second cold and5-second warm deadlines, then both original postflight suites still run unchanged. Actual retry startup readings881/41/18ms; all original checks passed. No runtime timeout was relaxed.

Earlier backup and failed-state files were losslessly archived, with decompressed SHA verified, to `dev_pre_issue159_20261003_220555.db.gz` (SHA of original `53455bc85b2a26f987a9a618a53eee0602419e4233c6594e6caf58a47458f18c`) and `failed_db_20261003_220555.db.gz` (original SHA `ba96a742a312ab9d69528be3ae44c2259fe34c9a0d2080ba7f797a824f3fd912`). Forensic WAL/SHM sidecars retained. Only exact private cache records created by this release and its redundant transferred archive were reclaimed; no old backup, shared image, neighbouring application or global build cache was removed. Disk floors stayed unchanged.
