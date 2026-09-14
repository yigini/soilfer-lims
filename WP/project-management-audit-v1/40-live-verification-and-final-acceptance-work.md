# Live verification and finite remaining acceptance work

14 September 2026, 05:15 UTC.

## Independently accepted release evidence

37521e5 is serving production, container healthy. CI 34807377036 passed. Subsequent bdab64e and 4ad0fda are documentation/test-artifact commits only; no extra deployment is needed for them.

Production `/app/client/dist/index.html` normalized SHA-256 95e28e88dacebc50686fa1d3a6ff2cccc282709aed274ab18f86423aa70b6892 matches the locally tested build. Controller normalized SHA-256 182adc02e4ccf405004b352a08d43d685b29fd2ea3d87969ece19c42195e3df7 matches the reviewed controller.

Read-only SQLite verification: live database, online backup `dev_predeploy_37521e5_online_20260914_065915.db`, and stopped backup `dev_predeploy_37521e5_stopped_20260914_065915.db` each contain 36,870 samples and return PRAGMA quick_check = ok.

Fresh Chrome live smoke check as existing Carlos Morales (GTM-LAB1 manager), Spanish: `/projects/SoilFER-USA?tab=samples&page=1&q=GTM0382-6-1C-T` loads correctly, retains query, displays one matching sample and 1/1 pagination, explicitly awaiting arrival / not yet received. Stage totals show 9,882 awaiting arrival and zero lab-work/review/released for this scoped view. No fresh-load chunk error observed. No production data changed.

## Finish the original acceptance, not another redesign

The reviewed 31/34 code fixes and focused component tests are accepted within boundaries recorded in 37. Do not reopen or rerun them without a new failure. Report 39 is more honest, but partial/unverified journeys are not completed work, and no issue currently tracks several of them. Please continue with this finite original-scope acceptance task:

1. Execute original journeys 1–4 and 6 from **04-acceptance-and-release.md** using actual application UI plus real isolated backend services and synthetic fixtures, external integrations disabled/mocked. Cover 40-sample shipment with duplicate/invalid row and provenance, intake draft/reopen/physical receipt, method-focused preparation/pH/grouped texture/spectral file, manager rejection of unsubmitted work and correction return, and pause/account-for-missing/archive/report/SIS/restore. Existing backend tests can supply evidence for already-covered substeps; do not describe direct SQL updates or test filenames as executed UI operations. Keep exact commands, assertions and results. Fix only concrete regressions encountered.
2. Correct report 39's Journey 2 attribution: POST `/api/samples/:id/orders` is not by itself proof of physical receipt, location recovery or intake/dashboard consistency. Its actual outcomes must be exercised.
3. Benchmark the real project overview/stats/sample-list HTTP handlers with the existing synthetic >=30,000-sample / 100-project fixture. Record bounded first-page payload, query counts/growth and measured p95/environment. No 36,000-concurrent-user test is requested. Raw SELECT LIMIT 50 alone cannot establish the original application target. Keep production untouched.
4. Run the production reconciliation **read-only dry-run** under issue #103 and record exact discrepancies/ambiguities/grant differences without applying or guessing mappings. If human reconciliation decisions remain, identify the exact records and decisions separately. Do not leave an executable read-only check unfinished merely under a generic administrative-review label.
5. Keep #102 open for physical iOS/Android device checks; emulate where available but never relabel emulation as hardware. Any externally blocked acceptance item needs an explicit issue with actual missing evidence and responsible next action. Record completion or precise blockage of original locale/accessibility/reliability checks instead of silently removing them.

No extra permission or deployment hold: implementation, test fixes, push and safe deploy of any actual discovered defects remain authorized. No deploy needed for evidence-only updates. Do not mutate live specimens/staff or copy production data into a public fixture. Batch work and speak plainly: which workflow is being checked, what passed, what failed, what remains. Stop repeating healthy deployment/DB checks or full unchanged suites while this finite acceptance work is pending.
