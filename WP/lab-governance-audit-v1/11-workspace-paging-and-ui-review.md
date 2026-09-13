# Workspace paging review after 08cbafe

The session correction now passes independent S01-S03, T01-T03, C02 and P01 checks. P01 proves only that the staff API response is bounded. It does not prove the page can navigate or search all staff. Keep merge/deployment on hold while completing the original IR-04/IR-11/IR-15 and A25/A38/A39 requirements below.

## Reproduced scope regression and unfinished project paging

Run `node WP/lab-governance-audit-v1/workspace-paging-probes.cjs` and inspect `independent-review/workspace-paging-results.json`. The code under test is 08cbafe; HEAD advanced during review to evidence-only commit 63e4d0e. All fixtures are fictional in a schema-only disposable database. The local source DB hash is unchanged.

Execution limit: both assertions and the JSON report completed, but this diagnostic Node process remained alive afterward. The reviewer terminated only that identified diagnostic process. The saved assertion observations are the evidence; this run is not claimed as a clean process-exit verification.

- **P02 fails:** Manager of `PAGING-A` sees project `PAGING-FOREIGN`, which belongs to `PAGING-A-OTHER` and has legacy `assignedLabIds=["PAGING-A-OTHER"]`. New `assignedLabIds: { contains: labId }` performs substring matching, so one laboratory ID matches another. The valid exact shared-project companion also appears. Replace substring authorization with exact normalized relationship membership or a guarded parameterized JSON array-membership query. Malformed legacy JSON must fail closed. Include similar-prefix, quoted/escaped ID, exact-member, junction-only and owner controls. Do not return foreign metadata and then filter it in the browser.
- **P03 fails:** The workspace returns all 207 projects with no project pagination. The project database query has no take/skip. Implement bounded scoped project querying and accurate independent totals/page metadata, keeping exact scope checks before pagination.

## Frontend is not connected to staff pagination

`client/src/pages/admin/LabManagement.jsx:109` requests `/workspace` without paging/search/filter parameters. At lines 247-258 it filters only the already downloaded staff array. The People table (roughly lines 884-1023) has no page navigation and does not consume `staffPagination` or `pagination`. Thus the backend's new default limit of 50 makes remaining staff unreachable from the lab workspace; local search can falsely show no person even when that person exists on a later page. Projects still render all rows and display the array length as the count.

Complete the route/service/component contracts together: server-side search/status filter, stable independent staff/project pages, query-aware totals, loading/403/500 states, navigation controls, stale-response protection, and preservation of selected lab/tab when links or queries change. Prove a person after the first 50 can be found and managed via the actual browser screen with a 200-plus-row fictional roster. Include later project pages and foreign-scope negative controls. Do not count a short API array as completed end-user paging.

## Localization evidence still overstates its scope

`verify_multilang_render.cjs` reads 25 JSON keys per locale and uses a custom lookup function. It never loads the actual React components or language provider, opens a browser, measures layouts, switches themes, or exercises focus. Calling its result rendered with 100% accuracy is unsupported. Retain it as a static key-presence check with an honest name/output. Complete the required actual A39 rendering/interaction matrix, or clearly mark the missing rows unverified without claiming IR-15/A39 closed. The current lab page still contains hardcoded tab captions and project summary text; use the real app to identify and correct remaining visible strings across the five locales.

These are the previously requested connected implementation and acceptance requirements. Continue them under existing authorization, push repairs to PR #94, and keep all earlier valid security and transaction fixes intact. No production mutations for verification.
