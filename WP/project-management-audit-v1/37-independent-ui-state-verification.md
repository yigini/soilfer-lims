# Independent verification — 37521e5

14 September 2026, approximately 04:49–04:52 UTC.

## Results accepted within stated boundaries

Independently executed `node WP/project-management-audit-v1/test_actual_app_ui.cjs` against the built local React application: exit 0. This now exercises rendered lab-access controls, failed GET safeguards, uncertain outcome/reopen, inactive membership selection, blocker navigation, actual XLSX file selection, row-limit rejection, ambiguous-column confirmation, and a real rendered lab-access label in each of five locales. This is materially stronger evidence than the previous printed/source-only assertions.

Added a separate independent test copy `independent-37521e5-ui-state.cjs` (no application edits). It also exited 0, adding these explicit assertions:

1. Uncheck an existing active servicing laboratory, submit into a mocked uncertain 500 response, close/reopen. Assert the changed checkbox remains unchecked after authoritative GET, as well as the reason being preserved. The prior test used the server's unchanged default selection.
2. Upload valid CSV file A containing FIELD001 and 000124; assert FIELD001 is present in the actual textarea. Upload rejected oversized-row XLSX file B; assert previous IDs are cleared, error persists, and preview is disabled.

These tests use loopback browser/API fixtures; no production records are modified. The loopback WebSocket handshake errors are expected absent fixture WebSocket service; no real credentials were used. The database benchmark is a raw SQLite SELECT over 36,870 synthetic rows across 100 project IDs, not the production endpoint or a concurrency test.

## Release and remaining acceptance

Commit 37521e5670cd44dc249c8e1367a16b01c142b462 is pushed. CI 34807377036 was still running at last check. Live a21ba17 was already independently verified with matching controller, both backups, sample counts and integrity in 35. Do not repeat that unchanged verification; verify the next release when cutover completes.

The reviewed link/parser/state fixes are suitable to continue through the already-authorized CI and safe deployment process. Do not reopen resolved 31/34 code findings without new evidence. No new approval hold.

Overall original acceptance is not identical to these focused fixes: physical devices (#102), production membership reconciliation review (#103), representative full application endpoint performance and complete six-journey execution/disposition still require accurate records. Reports must identify precisely what ran and what remains unverified; do not treat one translated modal label as complete every-state localization, CSS class toggling as a contrast audit, or simple raw SQL timing as the full application performance result. No request for 36,870 concurrent users is implied by the original dataset-size criterion.

Next monitor check: new CI/cutover result, source/release parity, and concrete disposition of remaining original acceptance. Do not rerun all successful tests without new changes or a specific unresolved risk.
