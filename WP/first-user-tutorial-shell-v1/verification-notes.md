# Preview verification

14 September 2026. Ran `node WP/first-user-tutorial-shell-v1/verify-preview.cjs` against the standalone local HTML using an isolated headless Chrome session. The final run passed.

- Exercised intake mass validation, comma decimals, prerequisite checkboxes, grouped texture closure, illustrative spectrum display, reasoned review return, pause/Escape/resume/exit/restart.
- Checked nine scenes for page overflow at 1440, 1280, 768, 390 and 320 CSS pixels.
- No browser runtime errors and no HTTP(S) requests were observed in that run.
- Visually inspected desktop introduction and mobile preparation captures. Mobile guide uses a compact fixed bottom control with expandable instructions. Corrected an inherited positioning offset found during testing, then reran the preview checks successfully.
- Captures and machine-readable results are in `preview-checks/`.

These are design-preview checks only. They do not verify LIMS authentication, actual result persistence, production deployment, all language content, screen-reader conformance or physical mobile devices. The preview is English and uses reconstructed screens/synthetic exercises. Full implementation acceptance is specified separately in `acceptance-checklist.md`.

This task created only the new `WP/first-user-tutorial-shell-v1/` package. No application files, production records, user accounts or credentials were modified or submitted by this task. Antigravity was not instructed to start this new implementation during preparation of the draft.

## Beginner revision

Added three foundation screens, explicit LIMS definition, connected-record explanation, ordinary platform navigation, three comprehension checks with gentle correction, Skip basics and a per-page glossary. Updated timing and no-account/novice acceptance requirements throughout the package. Reran the preview verification on 14 September 2026 at 09:23 UTC: all scripted checks passed, no external requests or browser errors. This does not replace testing the implemented guide with actual first-time users.
