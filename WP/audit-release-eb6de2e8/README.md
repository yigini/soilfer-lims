# Combined audit release kit

Target application commit: `feac653495d6b8a21e082cec596f1e14672fb389`.
Last deployed application commit: `283a8bb54b66a2167d34d80ad724bdd6460850b1` (#188).

Current release status (October 10, 21:37 UTC): the NEW complete fresh-copy
rehearsal PASSED, merged-main CI is fully green, and the exact kit is frozen
PREPARED_ONLY_NOT_EXECUTED. See **release-kit-feac6534-ready.md** for the
authoritative current head/hashes/counts and review request. Deployment is
Claudio's exact-kit audit PASSED at 21:42:44 UTC, comment 6102481848.
Deployment remains HELD on YY's pending disk-headroom choice and live reserve.
Production is healthy #188 and untouched. Earlier preparation history follows;
pending/failure statements below describe their original checkpoints.

The previous application target `042c04b5` stopped at the required #191
zero-blocked-owner gate. The complete merged-main fresh-copy rehearsal failed
before #191 apply. One ACCEPTED WorkItem has a preexisting RECORDED attempt
and an already published report. Claudio owns the separately reviewed
resolution design. Pip directly verified YY's "Link recorded accept" selection
in the original native decision card; Claudio implemented audited PR #289.
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
earlier pending snapshot. `pr-gates-042c04b5-passed.json` records all 20 included
PR audit/CI gates passing and exact merged-main CI 38073878578 fully green,
including both real Docker checks, completed at 18:32:54 UTC. Its SHA256 is
`65110eee88267c979938b6d7093e6b4b5caea40426741809ef5d5b3a2b2a2569`.
This read-only snapshot is not deployment authorization.

Claudio pinned the held #191 resolution design and ownership in comment
6100903042, then revised the transition scope explicitly in 6101762952 at
20:17:30 UTC. PR #289 head a9e24600 addresses Pip's scope/plan-binding review.
See `289-review-pending.md`, `191-resolution-pin.md` and
`yy-191-review-choice-evidence.md`. PR #289 passed the exact-head audit in
comment 6102006161, and CI 38083146269 passed 339/339 suites, 5,087/5,087 tests
and both Docker checks. It merged at 20:55:05 UTC as the target above, tree
f06fb5450187212eab2a04bcf3a50b55d03bfdfe identical to audited a9e24600.
Main CI 38085615017 is pending. The failed rehearsal stays FAILED.

Pip independently verified PR #289 at exact head a9e24600: 3/3 focused suites,
301/301 tests, zero skips, exit 0, 116.437 seconds. Both review findings are
addressed by the revised scope pin and reviewed-plan/transaction binding.
See `289-focused-verification.md`. The kit now includes 21 gated PRs and 22
CLI steps, with the new repeat immediately before #191. All 21 existing
installer repeats, 66 bounded CLI measurements and 20 original startup READY
events are required. The final manifest/gate bind the exact acceptance plan,
YY choice transcription and only the pinned one-status/one-event delta.
The expanded 29 Linux helper guards passed at frozen source b0633b6f in
0.253 seconds. All 21 PR gates are green; main CI is pending in the separately
retained `pr-gates-feac6534-pending.json` snapshot. The first preparation export
included an old committed build receipt and was refused before build/copy.
See `289-preparation-packaging-refusal.md`. Corrected frozen tooling b02238df
passed all 30 Linux guards in 0.601 seconds. Its 25-source raw export and all
application archive/index bytes are verified. The real build completed at
21:14:48 UTC as image 159057d5. The post-build reserve guard refused before
any fresh DB copy. After authorized cache-only pruning, a NEW proof is running
under `combined-eb6de2e8-rehearsal-feac6534-20261010211834Z`, reusing only the
valid build/source evidence. By 21:22 UTC the exact acceptance link/immediate
repeat and #191 zero-blocker gate/install passed on the owned copy. Full
preservation, remaining repeats/startup/API checks are still pending.
See `289-build-provenance-reserve.md`. Disk headroom for deployment is with
Claudio/YY; the production gate remains strict. No PASSED complete fresh-copy
proof or final manifest exists yet.

Claudio requested this kit on #162, comment 6099151121. Pip owns preparation;
Claudio owns review and post-deployment checks. YY selected "Main now" and
"Auto after review" on October 10: deployment remains conditional on Claudio's
exact-kit review and a successful fresh-production-copy rehearsal. The original
YY decision must be verified and bound to the execution gate.

PR #287 passed Claudio's exact-head audit (6100508428) and merged as
042c04b5 at 17:58:07 UTC. Its tree is byte-identical to reviewed head
0685d34d. The two commits after original main eb6de2e8 are this repair and
the separately audited #289 reconciliation.
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

- Exact merged-main CI: 339 suites / 5,079 tests passed, run 38073878578.
- Client build passed; lint passed with 0 errors and 14 existing warnings.
- All 20 included PRs have matching-head audit passes and passing CI.
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
  source pins now name the merged target. The final main CI gate passes.

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
