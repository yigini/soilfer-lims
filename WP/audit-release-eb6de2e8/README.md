# Combined audit release kit

Target application commit: `eb6de2e88df889be28972d393662ff0fc0abf711`.
Last deployed application commit: `283a8bb54b66a2167d34d80ad724bdd6460850b1` (#188).

Claudio requested this kit on #162, comment 6099151121. Pip owns preparation;
Claudio owns review and post-deployment checks. YY selected "Main now" and
"Auto after review" on October 10: deployment remains conditional on Claudio's
exact-kit review and a successful fresh-production-copy rehearsal. The original
YY decision must be verified and bound to the execution gate.

Preparation awaits PR #287's audit and a newly pinned application commit.
The original #193 heap failures were reproduced and repaired with identical
streamed fingerprints. The first repaired fresh-copy trial passed #193/#192
and then reproduced #194's identical memory failure; #287 now covers all six
affected production installers. Its expanded fresh-copy trial and CI are
running. This document is not deployment authorization.

Verified evidence so far:

- Exact main CI: 338 suites / 5,073 tests passed, run 38064045173.
- Client build passed; lint passed with 0 errors and 14 existing warnings.
- All 19 included PRs have matching-head audit passes and passing CI.
- Candidate image built without a production database mount; identity and
  build reserve are in `build-receipt.json`.
- #190 read-only plan: READY, 17 new attempts, 19 result links, 0 flagged
  groups, 225 missing ordered-work items across 10 samples, 0 changes. Missing
  ordered work is reported evidence, not invented work or a backfill target.
  Plan SHA: `7ffdb375cab35663d188d6087f02ee81161ec950feae7611bbbad6d8706d57f9`.
- #193 failed at 768 MiB/default heap and again at 2 GiB/1536 MiB heap.
  See `193-rehearsal-blocker.md`; both private production copies and full logs
  remain on the production host under their distinct release directories.
- CLI tooling now records cgroup memory.peak, uses explicitly owned container
  names/labels, and stops a timed-out CLI writer only after ownership validation.
  A failed install attempt always keeps production recovery forward-only.
- 15 release guard tests pass. The real Docker read-only CLI proof preserved
  both source/copy bytes and recorded 81,477,632 bytes cgroup peak for #190
  planning. This does not establish #193's repaired peak.
- Claudio pinned one separate PR for #193/#192/#191/#194/#197/#201, identical fingerprint bytes,
  unchanged receipts/refusal codes, and a fresh-copy proof at the original
  768 MiB CLI limit without a Node heap override. #205 and #284 stay out.
- Expanded repair head `0685d34d851ef6f115ae88bc772679929d8eee25`: 154 focused
  tests across 8 suites pass. See `repair-scope-expanded.md` for the additional
  APPLY installer scope and retained first-repair trial.
- The final kit must include 20 PRs, adding #287 to the original 19 after its
  exact-head audit/merge. The source pin and main CI evidence must then change.

Retained failed receipt hashes:

- `combined-eb6de2e8-20261010T154300Z/rehearsal-receipt.json`:
  `c19ee61cd1d307e019ce772bf7eee9746c64059c195a9e4fdde66bdef4824faf`.
- `combined-eb6de2e8-20261010T160100Z/rehearsal-receipt.json`:
  `e5c4756460299e08a240b444f4b97c246ff19a5aa6b15019fd04655a8de99dec`.

All paths above are beneath `/opt/lims/releases/`. No final prepared manifest or
PASSED rehearsal receipt exists yet. Do not execute `release-forward.py`.

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
