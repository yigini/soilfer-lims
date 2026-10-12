Claudio: the original #200 first proof has FAILED and stopped. No production action occurred.

Root: `/opt/lims/releases/instrument-import-proof-959d17e1-20261012T134000Z`
Unit: `lims-owned-instrument-import-proof-959d17e1-20261012t134000z.service`, failed/exit 1.
Completed: `2026-10-12T14:24:27.293103Z`.
Original immutable mode0400 FAILED receipt SHA256: `e85e14bbe1fd46f312027443c8911e5eb5807e14787d4641141ef60c310e4fa2`.
Refusal: `Immediate repeat changed original bytes or full installed state`.

The actual native stages all exited 0 under 768MiB with blank NODE_OPTIONS, network none, zero restarts and OOMKilled=false:

- DRY: PRE_200/DRY_RUN/0 changes, 5.880794494s, peak54,718,464B.
- APPLY: COMPLETE_200/APPLIED/1 schema receipt, no templates/import receipts/backfill, 75.018172293s, peak90,869,760B.
- Immediate repeat: COMPLETE_200/NO_OP/0 changes, 5.765934558s, peak55,762,944B.

The independent full preservation seal after APPLY passed: all104 original tables/38 receipts and all original fields/schema retained; exactly106 tables/39 receipts after the empty additive #200 migration, scientificChanges0/historicalDraftLinks0. Original preservation artifact SHA256 `8d50ef98ceefe1ec92305ea46cdc4da60eec4cf27078a13ab937ffb7267b7248`.

Physical read-only diagnosis at14:27:08UTC identifies the refusal precisely:

- Main database remains byte-identical:563,322,880B/SHA256 `441cbb6d7d9d5b8070e3d9b99f86b251f12974f064ce450a130578ba9c30df51`.
- Before repeat, the after-import seal recorded WAL and SHM absent.
- After repeat, a zero-byte WAL exists (SHA256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`) and a32,768B SHM exists (`fd4c9fda9cd3f9ae7c962b0ddf37232294d55580e1aa165aa06129b8549389eb`).
- All three owned CLI containers are exited/retained/exit0; no default-entrypoint/jobs-OFF/jobs-ON container was started.
- Diagnosis made zero SQLite connections and no writes to any original database, WAL, SHM, receipt or proof. Raw diagnostic record SHA256 `2fd03a236975cd453f4677beb231e673b49f2bb645996610f8c6db3b9f7775af`.

The unchanged main and empty WAL support a sidecar-creation explanation; they do not turn this failed proof into a PASS. Default startup, probes, readiness and natural scheduler proof are INCOMPLETE. The original root is permanently burned and cannot feed a kit or be retried/replayed/relabelled. Source630b/SourcePASS6125544861 does not authorize changed measurement policy or another first root. Proposed production63761 has not been submitted for approval and cannot freeze.

Please pin a separately audited forward source policy for the repeat's readonly SQLite sidecars. I propose retaining exact original main bytes/attributes, accepting only absent-to-empty-WAL/32KiB-SHM creation when independently detached full WAL-aware state equals the sealed installed baseline, and refusing nonempty/new WAL frames, any main change, changed/removed existing sidecars or any row/schema/receipt change. This is a proposal requiring a new formal source review, an exact new first root and guards; no new writer has been launched.

Production remains old51f/d4eb healthy/zero restarts/same volumes, unchanged. Application959d remains current audited main with all PR/main CI green. All original failed proofs, valid builds, backups, receipts, consumed kits and stopped containers are retained; no cleanup, quiesce, gate or installer/default-startup attempt on production. Other application merges remain held until#200 is live and Claudio post-checks it. Human cards/drafts untouched.
