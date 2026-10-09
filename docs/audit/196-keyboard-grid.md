# Audit 4.3 — keyboard grid (#196), WIP

Branch `audit/4.3-keyboard-grid` starts from merged main `663c9664`.
Dependency #173 is merged. #194 is independent and remains on its own branch.

The original checkbox/focus defects are partly fixed by #173/#188: row
checkboxes and Inspect controls have tabIndex=-1, and the worksheet calls
advanceWorksheetCell. Remaining defects are confirmed: that helper handles
only linear Enter/Tab movement, without same-column arrows or Escape;
WorksheetArea still requires selectedRows before Review Completion.

[Scope pin6078994041](https://github.com/yigini/soilfer-lims/issues/196#issuecomment-6078994041)
limits navigation to existing editable Result/QC cells in display order.
Enter/Down/NumpadEnter move down the same column; Shift+Enter/Up move up;
Tab/Shift+Tab move through editable row cells and then adjacent rows.
Skip disabled, read-only and tabIndex=-1 cells. After the final cell, focus
Record all ready; never wrap to the top or visit checkbox/Inspect controls.
Escape restores the focus-time value in client state only and stops propagation
when it reverts. Numeric keypad input retains the shared locale number parser.

Ready rows are valid, changed, eligible Result drafts. Invalid/cleared/reverted
drafts leave the count immediately. A mouse checkbox can exclude a ready row
until its draft changes. The primary Record all ready action uses the existing
completion preview/confirmation/commit; no new endpoint or writer. Refusals
retain drafts. QC positions retain their separate explicit save/evaluate path.

Required proof includes a real Playwright keyboard-only 40-value recording
test in CI and component tests for focus, Escape, readiness/counts, exclusion,
preview and refused drafts. New strings need all five client locales.
Pagination, per-keystroke regrouping, new replicate/dilution columns and new
exception fields are deferred by the scope pin. No schema or backfill planned.
Initial runtime implementation now adds row/column navigation for all Result
grids, focus-time Escape for numeric/texture/QC cells, automatic eligible Result
draft readiness and mouse exclusion, plus all five primary-action translations.
Escape uses a client-only restoration callback and cancels pending draft saves
and queued draft replay; completion still calls the existing preview/commit.
New component/real-DOM contracts and retained-refusal assertions are unverified
WIP. The real40-value Playwright test and CI browser setup remain to implement.
Focused navigation/readiness/Escape/regression proof:6 suites84 tests PASS,
zero skips3.794s. Initial real browser failed on an actual decimal integrity
defect: slow45ms/key `6.01` became `601`, with no Results committed.

[Pin6079796711](https://github.com/yigini/soilfer-lims/issues/196#issuecomment-6079796711)
adds that fix here, confined to BarcodeSafeInput: the last emitted string is a
parent acknowledgement and must leave newer text/pending/timer intact; an
external supplied value still resets. Gap30ms, >6-character wedge refusal,
Enter/Tab/Escape/blur flush and deferred blur are unchanged. The existing195
barcode test file is unmodified. New real React slow-ack tests cover6.01,
0.125 and12.5 at45/120ms, an external reset and a zero-write wedge refusal.
Decimal/grid/old barcode proof:3 suites52 tests PASS0skips2.925s.
Real built App/authenticated app.js/owned SQLite Chromium test PASS19.129s:
40 exact decimal inputs, preview and confirmation/commit entirely by keyboard,
40 separate retained Results and attempts, exact stored decimal values and
zero mouse events. Number-pad-specific first input is being strengthened.
Current runtime build PASS7.19s. Full validation and CI remain required; no PR.
Display-code fallback policy, pagination, regrouping and new columns deferred.
No schema/migration/backfill. Production freeze remains absolute. Claude
explicitly forbids deploying195 before this196 fix has merged, even after lift.
