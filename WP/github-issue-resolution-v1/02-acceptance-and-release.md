# Acceptance and safe release

## Evidence matrix

Record one row per case with commit, test/script, timestamp, environment, result and artifact. “Planned” is not “passed.”

| Issue | Required acceptance |
|---|---|
| #109 | Real profile timezone-only save with null and zero capacity; field remains unchanged when omitted; clear optional capacity; reject negative/fractional/partial strings; invalid timezone; correct stored-zone display; attention warning refreshed; reload persistence; cross-lab and unauthorized denial. |
| #108 | Actual calibration dialog save -> authoritative event/qualification -> list/Maintenance/History agreement -> reload; failed and rejected transitions; backdated event; due date and unrelated out-of-service restriction preserved; retries; read refresh failure; eligibility consistent; cross-lab read/write denied. |
| #107 | Every reported route and nested form/dialog inventoried; all five locales rendered, not merely keys present; dashboard vs queue distinct; bootstrap overrides tested; translated statuses/errors/exports; names/units/values preserved; mobile/long-copy/offline regression. |
| #105 | Published agreed workflow; expected Kobo import does not receive sample; authorized receipt once changes downstream counts/readiness; repeat import does not duplicate or revert receipt; scan-only does not receive; translated Help aligned. |
| #104 | Identified correct external system; one known GTM record traced end to end; same-scope source/dashboard reconciliation; another country unaffected; repeat sync/backfill idempotence; target Dashboard release/config verified. |
| #103 | Fresh report, including explicit owner with zero junctions; valid central ownerless state not mislabeled; exact permissions/membership diff reviewed; unresolved choices visible; approved corrections only, if any, rehearsed and verified without unintended grants. |
| #102 | Actual physical iOS Safari + Android Chrome log; model/OS/browser/release stated; touch/table/dialog/keyboard/zoom paths; relevant offline/camera behaviors; remaining failures explicit. |
| #92 | Current published v2 release; contextual guide correctness and complete body; search/FAQs/links; five locale content coverage; permissions/publication/lab isolation; real offline storage; return-to-work draft preservation; pending human review stated. |

Use existing relevant suites first:
- server/tests/contracts/lab_governance_wp_d.test.js and other directly affected governance contracts.
- Existing project governance, help publication/content/offline and help lab-isolation tests.
- Add missing focused equipment and actual React workflow coverage where absent.
- client npm run i18n:check, npm run build, and relevant lint checks.
- Required CI checks for every release. Broad server suite once per appropriate release candidate, not repeatedly on unchanged code.
- Verify test DB configuration points to disposable data before running mutation tests. Do not run existing scripts blindly against developer or production databases.
- Mocked APIs are acceptable for targeted client behavior but not evidence of real persistence or server authorization. Include isolated API integration for those claims.

## Batches and stop conditions

Release independent verified fixes without waiting for external Dashboard access, central policy or physical hardware. A batch may reference several issues but only close those entirely covered.

Stop a candidate release for a relevant failed test, unexplained permission change, destructive data correction, unreviewed migration or ambiguous deployment revision. Fix or separate the affected batch; do not reduce assertions until green.

## Deployment

1. Record fresh working tree, reviewed diff and exact commit. Exclude secrets, local DBs, production fixtures and unrelated changes. Preserve the tutorial-removal commit.
2. Push to GitHub under the established branch/PR workflow, run required CI, and record the exact tested head. Use “Refs #109” rather than automatic closing keywords before deployment.
3. Build the production artifact from that head. Follow the existing proven backup/cutover procedure. Avoid introducing a schema change for a UI fix.
4. Where a migration or reviewed data correction is genuinely needed, document its compatibility, isolated rehearsal, backup, preconditions and recovery separately. Do not restore an old database over new laboratory work.
5. Verify the deployed revision/image and matching public assets, health and ordinary login/navigation. Verify changed pages read-only in production; use staging/test data for mutations.
6. Record code release and Help content release independently. For #104, record the separate Dashboard deployment/config release.
7. Confirm old tutorial URLs still show the ordinary app; do not resurrect tutorial code while touching language/help integration.
8. Update GitHub with precise before/after behavior and evidence, then close only qualifying issues.

## Completion states

Allowed statuses: Investigating, Implementing, Ready for review, CI passed, Deployed—verification pending, Verified live, Awaiting specific external input.

No “everything fixed” summary while any scope remains open. A physical-device or policy dependency is not resolved by deploying unrelated code. Finish available work, post the exact dependency and avoid repeating unchanged tests.

Rollback means reverting the defective code/content release with compatible data preservation. Never blanket-roll back the site or erase events/drafts to hide a defect.
