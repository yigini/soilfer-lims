# Combined audit release kit

Target application commit: `042c04b54e7b3baa9f8c95e7f8d70b39daed2f91`.
Last deployed application commit: `283a8bb54b66a2167d34d80ad724bdd6460850b1` (#188).

Current release status (October 10, 18:33 UTC): HELD at the required #191
zero-blocked-owner gate. The complete merged-main fresh-copy rehearsal failed
before #191 apply. One ACCEPTED WorkItem has a preexisting RECORDED attempt
and an already published report. Claudio owns the separately reviewed
resolution design; YY's review choice in his native thread remains pending.
The deployed #188 app cannot reopen this item before release. No production
install, backfill, quiesce or review action has occurred.

The failed receipt remains immutable at
`combined-eb6de2e8-main-042c04b5-retry-20261010T180200Z/rehearsal-receipt.json`,
SHA256 `ed18a30dcdabd14ddb2052c4d5c8a12fa0d65ddf9a7495de8c1a4eb7c2f36a01`.
See `191-release-blocker.md` and `191-published-report-triage.md`.
`191-triage-preservation.json` establishes partial preservation only: all 90
original tables/fields and 18 receipts retained, the 17/19 approved #190 changes,
integrity ok/FK0, unchanged pristine copy bytes and original published report
row. It is not a PASSED complete rehearsal and cannot authorize deployment.

All 24 Linux release guard tests pass. The completed standard Windows server
run passes 339/339 suites and 5,079/5,079 tests, zero skips, exit 0 (1,746.911s),
on the byte-identical audited application tree. Client build/lint pass with
0 errors and 14 existing warnings. `pr-gates-042c04b5-pending.json` retains the
read-only snapshot of all 20 included PR audit/CI gates; exact merged-main CI
38073878578 is pending its Docker checks, after passing the server suite.

Claudio requested this kit on #162, comment 6099151121. Pip owns preparation;
Claudio owns review and post-deployment checks. YY selected "Main now" and
"Auto after review" on October 10: deployment remains conditional on Claudio's
exact-kit review and a successful fresh-production-copy rehearsal. The original
YY decision must be verified and bound to the execution gate.

PR #287 passed Claudio's exact-head audit (6100508428) and merged as the
target above at 17:58:07 UTC. Its tree is byte-identical to reviewed head
0685d34d. The only commit after original main eb6de2e8 is this repair.
The original #193 heap failures were reproduced and repaired with identical
streamed fingerprints. The first repaired fresh-copy trial passed #193/#192
and then reproduced #194's identical memory failure; #287 now covers all six
affected production installers. Exact-head Linux CI passed 339 suites /
5,079 tests, build/lint and both Docker checks. All 21 CLI steps/repeats and
20 READY events passed on the copy. Our READY parser then failed on valid
JSON scalar noise; that receipt remains FAILED. The fixed-parser read-only
supplement passed all 31+6 probes, startup peak 319,590,400 bytes, unchanged
rows/schema/database bytes. See repair-review-ready.md for all retained roots
and hashes. The complete fresh-copy rehearsal of the merged target and its
main CI are still required. This document is not deployment authorization.

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
- 21 release guard tests pass. The real Docker read-only CLI proof preserved
  both source/copy bytes and recorded 81,477,632 bytes cgroup peak for #190
  planning. This does not establish #193's repaired peak.
- Claudio pinned one separate PR for #193/#192/#191/#194/#197/#201, identical fingerprint bytes,
  unchanged receipts/refusal codes, and a fresh-copy proof at the original
  768 MiB CLI limit without a Node heap override. #205 and #284 stay out.
- Expanded repair head `0685d34d851ef6f115ae88bc772679929d8eee25`: 154 focused
  tests across 8 suites pass. See `repair-scope-expanded.md` for the additional
  APPLY installer scope and retained first-repair trial.
- The final kit includes 20 PRs, adding merged #287 to the original 19. Both
  source pins now name the merged target. The final main CI gate is pending.

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

Read-only host check at 2026-10-10 17:55 UTC: live container healthy, zero
restarts; 12,715,212,800 bytes available on both paths. Authorized cache-only
prunes and owned proof allocation are retained with the proof. Fresh reserve
and cache state will be recorded in the kit.
