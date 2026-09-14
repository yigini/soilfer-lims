# Tutorial checkpoint 12 — focused completion feedback

14 September 2026, approximately 15:54 Europe/Rome. Repository candidate `be9309384050f9f6b940c8e41f6a89258fceb050` is pushed to main; CI `34850367384` succeeded. Deployment is currently running. Do not interrupt a container/database cutover to handle this feedback.

Update 15:56: deployment completed. Independent SSH confirms healthy `soilfer-lims:v3.5.8-be93093`; `independent-release-review12.json` confirms public/local asset and index hashes match. `independent-live-review12.json` passes anonymous ordinary Login, opt-in foundation and clean Exit with no errors or non-read attempts. Continue the two focused forward corrections below; no rollback of the healthy app is requested. Antigravity was observed reading this review and the reproducer, so no duplicate chat prompt was sent.

## Accepted; keep these closed

- The pending sample-selection correction passes `independent-map-selection-review10.cjs/.json`: changing the selected sample while an older lookup waits no longer routes to the old sample.
- The actual same-document account handover independently passes `independent-spa-handover-review11.cjs/.json/.md`. Real Sign Out and Login UI switch synthetic technician A/lab A to B/lab B, verify B, clear the old sample, and handle an old-lab 403 without navigating. One document request and a surviving window marker prove no reload. All authentication/API responses were intercepted locally; this is client behavior, not production/server-RBAC certification.
- These checks used `TutorialShell-Bb5_VIl7.js`, SHA256 `a40a0fbe134896fb700351ba73795969f24a957ee76d9b5aebb6b82c2c65d4b4`, source Shell SHA256 `09e6ef649582d4dcd8e98f3457e559f825e38136300458d49d97bcaecfd45077`, and index SHA256 `63caa88f312186ed3d5a60455bb5e4463c280042b58200228b5492a19931c28d`. They were initially run against uncommitted assets and are now included in be93093.
- Earlier canonical ID, teardown cancellation, default-off configuration, translation fallback, progress/expiry and removal checks remain accepted. Do not rerun broad unchanged suites or the removal build for these two narrow corrections.

## Two remaining interactions in the original scope

### 1. Make account controls reachable by ordinary pointer/touch

At 1440 × 1000, the expanded tutorial dock covers the real Sign Out control. Your own latest acceptance output also showed the dock intercepting the real Login submit button. The harness now uses forced User Menu clicking and `$eval(...el.click())` on Sign Out/Login; those bypass the actual obstruction. Our independent keyboard test proves account-state behavior but explicitly does not certify mouse access.

Make the guide yield space during normal account handover, within the tutorial module. A small accessible collapsed coach during login/account operations or deliberate repositioning is sufficient. Keep Resume/Exit discoverable and preserve lesson position. Do not modify Login/AuthContext/RBAC or use transparent click-through on an opaque guide. Add one real pointer sequence at the observed desktop size and a narrow mobile check; it must use no force or programmatic element click. If using Pause as the intended interaction, explain it next to the handover action and verify the complete visible Pause -> normal sign-out/sign-in -> Resume sequence.

### 2. Do not extend draft confirmation to edits made during lookup

`performNavigation(customUrl, force)` currently carries `force=true` from the initial draft dialog through the asynchronous map lookup. A second live edit made during that wait bypasses the final `!force && hasDirtyDraft()` check.

`independent-draft-review12.cjs/.json/.md` reproduces this with the actual React-controlled Workbench Activity Receipts search: edit -> guide draft dialog -> Discard & Proceed -> held sample-detail GET -> edit the real search again -> release response -> map navigation without a second confirmation. This is a harmless real-page search, not a laboratory-result entry. It proves the shared guard edge; no laboratory data-loss claim is made. All APIs mocked, no database or production access.

Use a guide-local edit revision counter (or equivalent) for outside-guide input/change events. Consent should cover only the revision confirmed; after an awaited lookup, a newer revision requires confirmation again. The unchanged already-confirmed revision should navigate once without a confirmation loop. Preserve existing page inputs, autosave and outboxes; no core form changes. Verify the two focused cases (no further edit / further edit) with held synthetic read responses.

## Finish safely and explain simply

Finish or safely recover the deployment already in progress, preserving the healthy release and rollback artifact. Then apply only the two tutorial corrections above, run their focused checks, push the focused commit, wait for CI, and use the existing authorized deployment procedure. No new approval cycle, unrelated migration, normal page redesign or whole-app rollback for guide-only gaps. Record the actual tested/pushed/deployed revision and matching assets; never combine a live health response with local HEAD as proof of exact delivery.

Give the user short plain-English updates such as “The guide no longer covers Sign In; I am checking the final navigation safeguard.” Avoid long repeated timer messages. Human novice, scientific-language and physical-device reviews remain honestly pending. Keep earlier project-management/operational acceptance separate; this overlay cannot close those issues.
