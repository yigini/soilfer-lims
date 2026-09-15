# Separate operational acceptance follow-up

14 September 2026. Bounded source/report review from tutorial monitoring checkpoint 12, persisted after rechecking HEAD `e78edf8641832e3cd23f60cd485bcbd08b12ea50`.

**This is a separate operational workstream, not a tutorial release blocker or an instruction to expand the tutorial patch.** No application changes, test-suite runs, database reads/writes or production access were performed for this review. No message was sent to Antigravity. GitHub issue metadata was read during checkpoint 12.

## What remains accepted

The independently accepted UI/component checks in report 37 and measured HTTP benchmark in report 42 remain accepted within their stated limits. Do not repeat them without a new change or failure. Original findings 01, acceptance 04 and early review 07 provide context; their historical failures must not be reasserted as current defects after subsequent fixes.

The last change to this operational packet remains `bd8f443` (report 45's distinction between user closure and fixture archival). Since that commit, the relevant project/manager components only gained inert tutorial anchors; the server and operational tests have not changed. Earlier `1b74adf` contains the texture-object rendering fix and manager review-card title/routing fix. Report 45's Journey 1–4 completion is reported evidence, not an independent execution in this check.

## Finite technical work and evidence gaps

1. **Complete the original user closure workflow.** `04-acceptance-and-release.md:43` requires accounting for never-arriving samples with a reason before archive. `45-final-browser-acceptance-and-evidence-closeout.md:227` explicitly records that the UI has no non-arrival disposition control. Preserve this as an implementation gap until a governed, scoped, auditable user path and focused synthetic UI acceptance exist. The separate archive component scenario prepares outcomes directly at `execute_browser_journeys_ui.cjs:1061`, `:1075`, `:1080` and `:1089`; it cannot close the user journey. No specifically named closure issue appeared in the open issue list during this check.

2. **Finish the bounded method-batch evidence.** The original practical 40-sample method workflow is at `04-acceptance-and-release.md:40`. The revised test imports a 40-row manifest, but seeds and processes workbench tasks for only sample `000101` at `execute_browser_journeys_ui.cjs:560`. Its checklist, spectrum, numeric/grouped determination and review controls are useful real UI coverage; they do not establish multi-sample batch practicality. Add only the missing representative method-batch interaction, with exact authoritative outcomes.

3. **Tighten existing outcome assertions.** At `execute_browser_journeys_ui.cjs:536` and `:541`, stage counts use substring tests for `37` and `1`; parse and compare each named stage's exact numeric value. At `:690`, any page text containing “Completed” or “Done” passes both-gate persistence; assert the drying and preparation rows individually and confirm their workbench state after navigation. These are evidence weaknesses, not newly reproduced production failures.

4. **Bound the restore claim correctly.** The script creates a standard project at `execute_browser_journeys_ui.cjs:303` and checks an unconfigured Kobo integration plus zero active jobs after restoration at `:1136` and `:1140`. That demonstrates this fixture remains unconfigured; it does not prove that a previously configured, paused integration or queued job stays stopped after archive/restore. Supply the missing isolated configured-job case or label that part unverified. Do not weaken lifecycle guards to make a test pass.

## Correct report 45 without inflating the work

- `45-final-browser-acceptance-and-evidence-closeout.md:288` says all requested acceptance criteria are fulfilled, contradicting its explicit Journey 6 GAP at `:228`. Keep completed, incomplete and externally pending items distinct.
- At `:256`, its four purported production project names are unsupported and conflict with the recorded read-only dry-run: **SOILFER-JPN, SOILFER-US, TEST, SoilFER-USA**, documented at `issue_103_reconciliation_dry_run.md:35`, `:39`, `:43` and `:91`. This review did not reread production or assert a fresh live count.
- At `:261`, it claims four drying checkboxes; the actual test requires three at `execute_browser_journeys_ui.cjs:615`. Report the executed controls rather than invented SOP details.
- At `:266`, it redefines issue #102 as balance/WebUSB integration. The actual open issue is physical iOS Safari/Android Chrome smoke testing, also recorded at `39-original-scope-disposition-and-live-status.md:56`.

## External decisions and newly reported issues

- [#102](https://github.com/yigini/soilfer-lims/issues/102) remains **OPEN**: physical mobile-browser acceptance; viewport emulation is not device evidence.
- [#103](https://github.com/yigini/soilfer-lims/issues/103) remains **OPEN**: central multi-lab junction policy. Preserve the decision register at `issue_103_reconciliation_dry_run.md:104`–`:106`: JPN/US servicing relationships and TEST's missing owner junction. Do not guess an owner, broaden grants, apply production reconciliation, or alter schema merely to remove a dry-run warning.
- [#104](https://github.com/yigini/soilfer-lims/issues/104), created 14 September, reports Guatemala data missing from a Dashboard and identifies its Kobo reception connection as the suspected area. The issue explicitly distinguishes that Dashboard concern from LIMS. **Reported, not independently triaged or reproduced.**
- [#105](https://github.com/yigini/soilfer-lims/issues/105) asks whether Kobo reception should update LIMS or receipt should be confirmed directly in LIMS. **Workflow/policy clarification, not permission to implement automatic physical receipt.**
- [#106](https://github.com/yigini/soilfer-lims/issues/106) reports browser QR scanning failure. **Reported, not independently triaged or reproduced**; establish intended scanner/camera/browser path before assigning a cause.

Keep these separate from the current tutorial release. A later operational handoff should address the finite closure/evidence items above and triage the new issues, preserving existing successful checks and production records. No full re-audit, speculative reconciliation or claim of complete operational acceptance follows from a successful tutorial deployment.
