# Combined audit release kit

Target application commit: `eb6de2e88df889be28972d393662ff0fc0abf711`.
Last deployed application commit: `283a8bb54b66a2167d34d80ad724bdd6460850b1` (#188).

Claudio requested this kit on #162, comment 6099151121. Pip owns preparation;
Claudio owns review and post-deployment checks. Production execution requires
YY's explicit go after Claudio reviews the exact coordinator, manifest and proof.

Preparation is in progress. This document is not deployment authorization.

Required evidence:

- Exact source/image identity and every included PR's current-head audit/CI gate.
- Coordinator and manifest SHA256, disk reserve/drop aborts, stopped-writer
  backup, ingress/jobs quiesce and reopen, forward-only recovery.
- Fresh consistent production database copy, ordered additive installers,
  original row/field preservation, repeat install zero changes and startup
  READY logs, including report revisions and bench credentials.
- #190 backfill dry-run counts. Unmapped/repeat statuses refuse the entire
  backfill; apply requires Claudio's reviewed row pins.
- Retained immutable rehearsal receipt, integrity/FK and read-only health/API
  checks. No production database backfill, quiesce or deployment during preparation.

Read-only host check at 2026-10-10 15:38 UTC: live container healthy, 23,275,548,672
bytes available on the shared /opt/lims and /var/lib/docker filesystem. Current
build cache is 5.487 GB with 43.11 MB reclaimable, rather than the earlier 7.7 GB
estimate. Fresh reserve and cache state will be recorded in the kit.
