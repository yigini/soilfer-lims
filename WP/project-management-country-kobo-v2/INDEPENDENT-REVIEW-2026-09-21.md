# Independent completion check

21 September 2026. Reviewed Antigravity's completion message and walkthrough, current working-tree source on HEAD `762c46e`, and four isolated in-memory policy probes. No production writes, application edits, full-suite reruns or migration execution by this check.

**Conclusion: partially implemented; the full plan is not complete or ready for production acceptance.** Antigravity reports all F01-F15 resolved, 68 passing tests and a successful build, and requests production cutover authorization. Those claims are not equivalent to acceptance of the complete plan. Changes are currently uncommitted in this checkout; no new deployment is established by this check.

## Reproduced policy failures

Direct calls to the actual projectPolicyService with synthetic objects produced:

| Case | Observed result | Required behavior |
|---|---|---|
| SAMPLE_RECEPTION actor, SoilFER project, DESK, hasException=true, client exception reason/claimed authorizer | canAuthorizeException=false, but canAdmitSample returns allowed=true, isException=true | Validate a persisted authorized approval, or require an authorized approving actor. Do not trust request flags or claimed authorizer. |
| Active SoilFER project, MANIFEST, no exception | allowed=true | Manual/CSV registrations need the confirmed controlled-exception policy. |
| Generic OPEN_INTAKE project code SOILFER-COMPARISON | effective template SOILFER_V1 | Explicit project configuration must control template selection; name/code substrings must not impose SoilFER rules. |
| Generic KOBO_LINKED project, DESK, no exception/policy configuration | allowed=true | Enforce a persisted configurable admission policy and make UI/API behavior agree. Reception UI currently rejects the same unknown-ID path. |

These are service probes, not live endpoint exploits. Source tracing confirms processIntake constructs the exception from req.body and calls this policy without an authorization check (`receptionController.js:184-193`). `canAuthorizeException` is used for capability display, not the actual exception admission decision.

## Remaining defects and missing contracts

1. **Exception authorization and channel coverage (blocking).** Address the reproduced cases above. No exception approval workflow was found in the changed reception UI; it displays an error instructing the user to obtain an exception. The centralized policy has no calls from the batch-consignment or Kobo scheduler/sync handlers. Existing-record physical intake ignores PROJECT_INACTIVE while checking only CLOSED/PAUSED errors. Verify every writer and distinguish pre-registration from physical receipt explicitly.

2. **Wrong-form single-sample resync fallback remains (blocking).** `koboController.syncSample` first searches project+lab, then falls back to `findFirst({where:{labId,isActive:true}})` when no project match exists. This retains F09's wrong-form risk. Resync writes metadata before a separate audit operation whose failure is swallowed; commit-time lifecycle/membership checks and preservation of manual field overrides also remain to demonstrate.

3. **Generic/versioned template and programme model is incomplete.** `getEffectiveTemplate` still checks code substrings. Project schema/persistence has no applied template version, configurable allowed channels or persisted programme relation. `programmeCode` exists in migration constants but is not stored by its project inserts. Keeping two ordinary Project rows is not an implemented programme aggregate. Do not count a SOILFER_V1 projectType string alone as completion of the versioned configurable template contract.

4. **Kobo create/update contracts still incomplete.** Create commits the project before Kobo handling, logs a warning for no destination lab and continues, and catches config-creation errors into an outcome that the modal does not present before closing. Destination lab is state in the modal but has no selector/input. The legacy upsert route still accepts missing projectCode and creates null mappings. Existing project update still uses an arbitrary first project configuration. Read-only connection listing is not full tested connection create/edit/disable/sync management scoped to a participating lab manager.

5. **Migration guesses and overwrites operational state (blocking).** Migration hardcodes S002 to Guatemala when country is absent; changes assignedLab for S002 and LAB-GOLD/unassigned records; appends country project grants to every user of each mapped lab; resets existing aggregate project status to ACTIVE when changing template; sets country targets to hardcoded observed sample counts. Require verified mapping evidence and preserve existing lifecycle, actual targets and access boundaries. Special-case sample IDs are not a general conflict-resolution rule.

6. **Migration leaves connected references/readers unresolved.** There are no changes to report filtering, SIS scopes, dashboard project scopes, offline/cache reconciliation or consignment project migration. Project-manager grants without labId are not migrated. Historical reports retain old denormalized projectCode, while their unchanged search path filters that field. Samples move away from old project codes, while existing programme sample/count readers do not aggregate the country projects. Preserve historical report bytes while implementing correct authorized current-project queries and programme rollups.

7. **Migration evidence overstates verification.** The script records totalQCBatches but never compares it after migration; result verification checks counts only. Report checksums cover id/version/status/content, not report files, share links or full report relations. Tests use a copy of local dev.db with special fixture IDs rather than demonstrating all requirements on a production-shaped rehearsal. Walkthrough mixes local and production counts and states production post-flight conservation without establishing that production migration occurred. List exactly which database, revision and artifacts were actually verified. Dry run changes SQLite pragmas and runs a write transaction that is rolled back, so describe it accurately rather than as a read-only inventory.

8. **Translations/help remain unchanged.** F15 changed only a React fallback string. The active en/es/es-419/fr/pt translation keys and translation-population script still say credentials are encrypted server-side, and help still describes the absent settings flow. F15 is not resolved by the fallback change.

9. **Capabilities are not fully wired.** ProjectWorkspace still defaults missing canImport to true and collapses fine-grained capabilities into canManage. New getProjectCapabilities does not replace the existing getProject response construction. Servicing lab managers are denied connection management by the new capability helper despite the user's within-own-lab requirement.

10. **Seed safety is partial.** Existing expectedSampleCount uses `existing.expectedSampleCount || ...`, so intentional zero can be overwritten. Shared seeder fallback was changed from OPEN_INTAKE to SOILFER_V1, imposing SoilFER on unspecified generic profiles. Seed reruns still upsert predefined lab grants; show they cannot re-add an intentionally removed membership.

## Required Antigravity response and continuation

Reconcile these findings against the exact current working tree and report each as fixed with evidence, remaining, or disproven with evidence. Reopen the corresponding original acceptance items; keep work within the authorized implementation scope. Do not present this as only waiting for deployment permission. Correct the walkthrough's completion/conservation claims, add meaningful negative/regression tests for the reproduced failures, and supply the missing generic onboarding, migration, reader/integration and role/UI acceptance evidence. Do not run a production migration through unresolved findings.

Retain working fixes: client organization persistence, added Kobo credential fields, removal of projectType gate on connection reads, improved form/status display, canonical reference resolution work, resync scope/lifecycle checks, and corrected overdue condition. The review is a completion check of the existing plan, not a request to discard those changes or restart unrelated work.

## Delivery of this review

Sent the review path and a summary of the reproduced failures and missing work to the existing Antigravity LIMSI / LIMS Dev session (`80c11c12-5cb7-4455-a433-01544d488498`). Requested a corrected status, evidence for each item and continuation of the unfinished authorized implementation. The message appeared in conversation history, the composer cleared and Antigravity showed Working. No substantive acknowledgement or corrected completion evidence had arrived at the time of this receipt.
