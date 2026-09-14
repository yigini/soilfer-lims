# Focused independent follow-up — a21ba17

14 September 2026, 04:24 UTC. CI 34805384029 passed. Independently ran `node WP/project-management-audit-v1/test_lab_access_journey5.cjs`: passed against disposable fixture, dev.db hash unchanged (388e85fbc6573509f0c56e0f1db6989fa682c2931af5a90b0b82eeb1a0e6a90b). This verifies the exercised backend membership contracts, not UI recovery-store cleanup or a technician journey.

Source review confirms meaningful fixes to loading/save gates, preservation of pending selection, inactive member removal, structured blocker details, row-limit error retention and ambiguous-column confirmation. Do not undo these. Finish the current safe cutover if already in progress.

## Remaining concrete wiring defect

ProjectActionsModal.jsx line 1151 links blockers to `/tech-workbench?projectCode=...`; App.jsx registers `/workbench`, not `/tech-workbench`. TechWorkbench.jsx's actual consumed search parameters must be checked before claiming project scoping. Use an existing authorized scoped destination or implement the explicitly supported filter contract; do not silently show unrelated work. Verify a real click for the owner manager and avoid directing a manager into a technician-only route without permission. This is the existing original blocker-resolution journey, not new scope.

## Evidence still does not support all-pass claims

- `test_file_import_intake.cjs` defines its own parseSpreadsheet function and local simulated state. It never mounts ImportPreviewModal or imports its production handler. The file-A/file-B and ambiguity checks therefore cannot prove the React controls behave correctly. Exercise the production component with actual file selection and assertions (or extract one production parser used by component and test it, plus a component state regression).
- `test_actual_app_ui.cjs` lines 343–352 skip the owner control assertion if the tab is absent, and only print visibility rather than assert it. Technician test is also conditional. Assert the correct authenticated actor and expected page/tab/control, fail if absent; don't silently skip.
- Lines 401–415 print translation success but never compare rendered text with the expected localized string. Open the actual lab-access/import views and assert their copy for all five locales, including error/recovery states.
- Keyboard check only asserts `activeTagName !== undefined`, which also passes for BODY. Theme check changes a class directly. These do not establish keyboard operability or readable themes. Test the real controls and meaningful focus/interaction outcomes.
- Lines 420–435 call an `/api/.../lab-access` route mocked earlier via `context.route`; these latency figures are browser/mock turnaround, not database performance. Label accurately. Do not claim original large-data performance requirement passed on this basis; provide representative isolated dataset measurements or a clearly tracked unverified disposition.
- None of the new UI tests exercises delayed failed membership GET, unresolved PATCH close/reopen, late response after actor/project switch, inactive-member checkbox removal, or failed-file replacement through the actual application. These are the six defects being accepted. Add focused actual-component regression evidence for them.

Correct/supersede report 30's unsupported full-journey/performance assertions and report 33's all-six-verified claim with exact executed boundaries. Remaining original journeys require concrete execution records or explicit unverified status; report 33's fixture-transition disclosure is a useful correction. Physical hardware remains honestly tracked in #102.

No requirement to redeploy solely for evidence/docs. Fix the real broken link, batch any real defects exposed by focused tests, then use the already-authorized tested GitHub/deployment workflow. Do not repeat unrelated suites or production database checks unnecessarily. Use plain progress explanations.

## Handoff / release observation

At end of this check production container reported `soilfer-lims:v3.5.7-a21ba17` healthy; public `/api/health` returned status ok (uptime about 82 seconds). This confirms a new container is running, not full release acceptance. Backup/database integrity for the previous 5047673 release is independently documented in 32; this new release's detailed post-cutover evidence remains to be checked.

The updated 34 message was submitted with Enter from the Antigravity composer and confirmed in Queued Messages. The older 31 message is still queued as well; the new message explicitly acknowledges resolved items to avoid rework. Do not send duplicates next heartbeat; confirm consumption and inspect exact remaining corrections. Antigravity was doing post-cutover checks, not idle. No direct application mutations or production writes by this monitor.
