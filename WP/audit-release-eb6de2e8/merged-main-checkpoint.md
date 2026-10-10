# Merged-main release preparation checkpoint

PR #287 passed Claudio at exact head 0685d34d851ef6f115ae88bc772679929d8eee25
(PR comment 6100508428), then squash-merged at 17:58:07 UTC on October 10 as
042c04b54e7b3baa9f8c95e7f8d70b39daed2f91. Tree 9e33d466b3d7a4787ce33b54beb82d436e3b1c94
is identical to the audited head. This is the sole commit after eb6de2e8.
Main CI 38073878578 is running; exact PR CI already passed 339 suites / 5,079
tests, client build/lint and Docker acceptance.

Pip directly delivered the audit-ready evidence and merge/build update to
Claudio's native LIMS Audit thread. Claudio confirmed the workload basis:
`labAndHubBuildsOwnedByYY=true` and `RELEASE_DAY_DISK_ABORTS_ACCEPTED`.
Pip challenged an initial between-installer database-restore condition because
it contradicted the mandatory forward-only/no-overwrite rules. Claudio then
explicitly replaced that condition with two distinct paths:

- Before quiesce, a reserve failure refuses the release and leaves the live
  database untouched. Before any installer attempt, reopening the old image
  additionally requires unchanged logical and physical DB/WAL/SHM, the old
  verifier COMPLETE/0, and ingress reopened before jobs.
- After any installer attempt, including NO_OP or a failed one, maintenance
  and jobs remain held. No database restoration, old-image start, retry or
  override is allowed. Recovery requires a separately reviewed forward fix.

Claudio accepted forced-reserve tests for both paths together with the existing
forward-hold guards and the explicit #191 zero-blocked-owner check. He will bind
both workload strings and final head/manifest/coordinator/receipt/#190-plan
hashes in his eventual exact-kit pass. This checkpoint is not that pass.

Frozen tooling is pushed at 3a122ab426bfd08ae7793b6c5b9efcd5eb8b7dd0 on
audit/release-eb6de2e8. All 24 Linux release tests pass (0.227s), including both
forced reserve failures against owned SQLite files and blocked #191 refusal
before apply. The physical installed file is retained exactly on forward hold;
original audit data remains unchanged.

The fresh exact-main proof root is:
/opt/lims/releases/combined-eb6de2e8-main-042c04b5-retry-20261010T180200Z

The real Docker build passed after verifying all 2,223 committed source blobs.
Archive SHA256: 075231e12316cd8e62ca9b338b5b951fecff42882118bc43dc381f1684291310
Git-blob index SHA256: c7cc5db92e7f9ef7f66e53f4c55b48a3bc1620e6a2fcd92bd566651dd5411ffb
Authorized cache-only prune at 18:06:42 UTC raised available bytes from
9,067,941,888 to 11,205,722,112. No volume/image/data prune occurred. The complete
fresh-production-copy rehearsal is running with the corrected parser, all
installers/repeats, 20 READY events, 63 CLI peaks, startup peak and 31+6 probes.

An earlier dispatch began before the upload completed and correctly refused
the incomplete archive hash before extraction/build. Its failed unit and
initial-dispatch-refusal.log remain in the separate original root:
/opt/lims/releases/combined-eb6de2e8-main-042c04b5-20261010T180400Z
No failed proof is relabelled as passed or replayed.

No final manifest or exact-kit audit pass exists yet. No production install,
quiesce, backfill or deployment has occurred. Live remains healthy on #188.
#205 / draft PR #288 and #284 remain excluded; #274 retains the unchanged
225 missing-order entries across ten samples. Windows's additional standard
8 GiB full-suite diagnostic has passed 266 suites with no failed assertions
so far, but is not yet a completed local pass.
