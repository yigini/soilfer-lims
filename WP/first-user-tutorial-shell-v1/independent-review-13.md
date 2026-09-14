# Tutorial checkpoint 13 — keep fixes accepted; finish narrow mobile layout

14 September 2026, approximately 16:17 Europe/Rome. Candidate `76a63b5af7cff0f202150a1037278de4e95027e5` is pushed to main; CI `34853902776` succeeded. Deployment is running. Do not interrupt container/database cutover for this guide-only feedback.

## Accepted

- The edit-revision correction passes our independent `independent-draft-review12.cjs/.json` rerun at 14:13:44 UTC: a new real Workbench search edit during the held lookup leaves the page/input intact and shows a fresh confirmation. This closes the reproduced guard bypass.
- `independent-draft-confirmed-review13.cjs/.json` at 14:14:40 UTC passes the companion case: with no further edit after confirmation, the lookup navigates once without another confirmation. This closes the confirmation-loop concern. Both tests use the actual controlled Activity Receipts search and mocked APIs; neither is a claim about production laboratory-result persistence. No database or production writes.
- Our independent `independent-pointer-review13.cjs/.json/.md` verifies actual unforced pointer collapse -> User Menu -> Sign Out -> Login submit -> expand. The verified new account is B, old selected sample is cleared, and an old-lab mocked403 stays on Workbench. One document/window marker proves reactive handover. Keep this desktop fix closed.
- Exact tested assets: `TutorialShell-ZKJdI3SM.js` SHA256 `8c9df3c5db2562581aa374fa86facbc463045284629cf62087f73fe3da966eff`; `TutorialShell-BXQUMQ6w.css` SHA256 `641d60ad90ef27a4cebce1e563209601f6aeae949d853e9ff0dce0255e53af36`; index SHA256 `9eda24d610304927821ebe530fdeb2b8096b9e3311b8112225f451189b267a83`; source Shell SHA256 `16a47a7449bec361cb3a92a6d459179143ab2adb0bcf8b8baaadd50caba8a0a1`.

## Remaining responsive regression in the changed controls

The new `.docked.on-login` 24px left/inset rule wins over the existing mobile 10px rule. The collapsed inline minimum width320px and unwrapped action controls also exceed the available width.

Our frozen-build mobile observations:

- At390px, the expanded login coach Exit spans approximately x360–413, partly outside the viewport.
- At320px, expanded Pause/Exit are offscreen. The collapsed coach width320 plus left24 extends to344; its Exit ends around331.
- Playwright may scroll the overflowing coach to click Exit. A successful scrolled click is not evidence that the initial controls fit. See the independent pointer report/JSON and screenshots for exact rectangles and interaction limits.

Please make one guide-local responsive correction: consistent bounded insets on login/mobile, no minimum width larger than available space, and wrapping or a compact action row that keeps Minimize/Expand, Pause and Exit visible. Avoid large fixed height subtraction that can hide the coach on short landscape screens. Preserve the accepted desktop account access and draft behavior; no Login, app header, auth or global appearance changes.

Validate the changed expanded/collapsed controls on login and workbench at320/390px, including the longest labels among all five locales and one short landscape viewport. Assert rectangles fit and controls are operable without horizontal scrolling or forced/programmatic clicks; visually inspect the screenshots. Do not repeat unrelated full suites, removal builds or DB audits. Keep human physical-device review separately pending.

After the current deployment safely completes, fix forward with this small tutorial-only change, focused checks, GitHub/CI and the existing authorized release procedure. Do not describe the current candidate as complete mobile acceptance. Preserve previous rollback artifacts; no whole-app rollback or new approval cycle. Give the user short plain-English updates describing the actual change and remaining check.
