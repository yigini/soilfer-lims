# Review 04 — retain verified fixes; finish the visitor experience

14 September 2026, 12:55 Europe/Rome. Reviewed committed **10c33316c88d9374db40c4753d1d1f27a7a0a9a5**, green CI **34835112940**. This is substantially improved; do not restart or undo the accepted fixes. It is still not the complete approved tutorial.

## Independently verified fixes — closed for this candidate

Reran focused browser checks against TutorialShell-Cg5UzekW.js / TutorialShell-BYrzxXl2.css with all APIs mocked and no database or production writes:

- `/me` failure no longer treats cached identity as verified.
- Runtime password-change requirement yields without React hook errors; underlying login remains usable.
- Exit clears guide flags/state; refresh does not restart it; unrelated query/hash remains.
- Preparation feedback resets correctly when selecting another tube.
- Mobile Pause, Exit and language are visible when collapsed and expanded.
- Existing app French locale initializes the guide in French; checked French finish heading is translated.
- Auth revalidation updates the guide identity; current chunk failure remains isolated.

Evidence is in `independent-auth-review-03.json` (10:54:38 UTC) and `independent-browser-review-02.json` (10:54:51 UTC). The latter has an obsolete hardcoded candidate label 7ddf79b; the actual asset identity above is authoritative. Neither observational script is a blanket PASS for the whole tutorial or all translations.

## Finish these remaining original requirements

1. **Repair the broken F03 beginner exercise.** Shell calls `updateF03('f03Search', value)` and equivalent filter/selection calls, while `useTutorialSession.js:422–426` accepts only a function. All three interactions are ignored. Wire existing setters or make the call contract consistent. Verify typed search remains visible, rows filter correctly and selection opens the intended details through real browser actions.
2. **Deliver the no-account illustrated overview.** Quick path currently only skips chapter indices; all nonzero chapters use the same live dock. A visitor without an account receives permission/missing-page messages instead of the promised three-minute illustrated laboratory story. Add the clearly marked overview renderer over synthetic illustrations, with no private-page dependency. Keep full/role real-page orientation separate and do not ship another fake full application.
3. **Complete promised lesson content and connections.** The receipt text still promises a practice arrival confirmation but its practice renderer is absent; assignment/equipment/inventory remain explanatory-only. This candidate removed their practice types rather than completing the exercises, and no chapter now uses PracticeResources, making its SIS explanation unreachable. The map resolver reads selectedSampleId but Shell never supplies it, so the map action can never work. Wire a user-selected, currently authorized sample (or derive an existing authorized sample page context), and provide a useful selection route/fallback when none exists. Retain the correctly removed error/loading anchors; the honest missing-sample fallback is an improvement, not itself a defect. Complete project/Kobo/SIS, spectra evidence/library and report/history orientation in the approved journey; a generic Projects page alone does not demonstrate those connections.
4. **Fix draft protection rather than testing a synthetic DOM shortcut.** `hasDirtyDraft` still compares value/defaultValue and ignores cleared fields. React controlled inputs generally update defaultValue with value. T10 appends an artificial uncontrolled input, which does not prove a live LIMS draft is protected. Use the application's supported draft signals, or a conservative guide-owned navigation decision when leaving a live form where status is unknown. Exercise a real existing controlled form in isolated data and preserve normal drafts/outbox. Do not alter business rules or clear/save fields automatically.
5. **Finish the accepted content/accessibility/lifecycle coverage.** Full locale support still requires all lesson/glossary/a11y/fallback copy, not Pause/Exit key parity. Distinguish seen/practised/skipped/unavailable. The purported maximum session lifetime still reads lastActivityAt, refreshed by every click; use the documented absolute maximum or report the difference honestly. Screen-reader/physical-device/human review can remain explicitly pending, but broken controls and missing renderers cannot.

## Evidence requirements without broad reruns

Additional browser evidence in `independent-firstvisit-review04.cjs/.json` confirms F03 search text remains empty after typing TRAIN-US-002, Expected filter remains all with three rows, and row selection remains null. On the actual React Login form, entering a synthetic username sets both value and defaultValue to that text; the current heuristic returns false and no draft warning appears. This demonstrates unreliable detection, **not evidence that a laboratory draft was lost**. Tests used the same frozen asset bundle, mocked APIs and no LIMS mutations.

T11 currently asserts only that the session has a numeric step and active=true, then declares all paths verified. T23 checks the first foundation title and calls all three foundations complete. T14 checks a few labels, not complete content. T22 PARTIAL is an improvement, but “Removal Rehearsal Verified” is still inaccurate when only an import/mount is inspected. Test the actual full/quick/role sequences, F03 interactions, a successfully resolved map, a real controlled draft and actual disable/removal on an isolated copy. Mark only demonstrated scenarios PASS. Retain meaningful existing tests; do not rerun the whole unrelated project-management audit.

Deployment is already running according to Antigravity's UI. Hold this candidate before cutover if safely possible. If cutover has already completed, report it honestly and avoid another unnecessary whole-application rollback solely for missing lesson content. Keep the tutorial unaccepted/internal, finish the above in focused commits and verify the completed release before announcing first-visitor readiness. If a concrete normal-LIMS regression appears, disable the tutorial mount in a targeted safe release. Preserve all existing laboratory changes/data and retain the established backup/rollback process. User authorization to finish and safely deliver persists; no new approval cycle is needed.
