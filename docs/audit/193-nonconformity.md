# Audit3.4 — nonconformity reports (#193), WIP

Prepared after PR260/#191 merged, refreshed to maind2b69b8. The requested NCR model is
absent in that base; unsatisfactory PT recorded PENDING and the repeat contract
refused NCR strings. The branch now adds the NCR model/SQL guards, scoped
lifecycle authority and atomic PT classification links. Installer/backfill,
QC/repeat integrations and the QA list are still being implemented.

Authoritative pins:
- [6071242717](https://github.com/yigini/soilfer-lims/issues/193#issuecomment-6071242717): source identity and explicit one-use manager override.
- [6034830001](https://github.com/yigini/soilfer-lims/issues/193#issuecomment-6034830001): retained PT evidence, nullable nonconformityId and idempotent PENDING backfill.
- [6075820954](https://github.com/yigini/soilfer-lims/issues/193#issuecomment-6075820954): exact additive PT successor, no WorkAttempt column, lifecycle commands, retained links and recorded compatibility mode.
- [6076135661](https://github.com/yigini/soilfer-lims/issues/193#issuecomment-6076135661): first UNSATISFACTORY record/correction writes RAISED directly with its NCR in the same transaction. PENDING is historical-only; no NULL-round backfill.
- [6076453701](https://github.com/yigini/soilfer-lims/issues/193#issuecomment-6076453701): exact fresh Prisma bootstrap, both unchanged #189 and new #193 guards/receipts in one transaction; predecessor verifier alone refuses the unguarded successor state. Inconsistent pushed rows refuse with ids and zero writes.

Implementation boundaries:
- SQL unique(source,refType,refId); retries retain the original NCR.
- QC REJECT: actual persisted QcDisposition id, one per analyte, same transaction.
- CRM: BatchPosition id, first failing QcEvaluation id, frozen recorded REQUIRED_BLOCKING/REQUIRED_WARN mode only; later FAIL reuses it, later PASS retains it.
- Ordinary over-limit repeat/RETURN retains ATTEMPT_LIMIT and zero writes for every role.
- Explicit manager override only at the policy limit: a new NCR and one child, atomic, immutable NCR link/request facts/CREATED event; callers cannot reuse an NCR id. Each additional attempt needs a new override. The link is the NCR's unique (REPEAT_LIMIT, WorkAttempt, childId) key plus the immutable CREATED event's NCR id; no WorkAttempt column or #191 column-contract change.
- PT: additive nullable nonconformityId, RAISED only with a link; PENDING dry-run/backfill receipts list counts/ids. Existing z, outcomes and limits are never recalculated.
- QA list is scoped through scopeGuard and roles.js. No inline laboratory limits.

Confirmed runtime integration points: qcDispositionStateService's retained
disposition transaction; qcNativeMeasurementService, qcCompatibilityRunService
and qcCompatibilityCorrectionService's actual evaluation appends;
proficiencyRoundService classification/audit transactions; workRepeatService
capacity/preflight/reservation and workRepeatContract's current NCR refusal.
All original migration sources, receipts and refusals must stay verified.

Additive successor and lifecycle:
- Preserve the original #189 migration bytes/receipt. Only its two PT ncrStatus guards change in the new #193 migration. New rows allow NULL or correctly linked RAISED; new PENDING refuses. Updates allow NULL→RAISED for a first unsatisfactory correction or historical PENDING→RAISED for backfill. Established links remain permanent on later reclassification. This newer6076135661 edge pin supersedes the earlier PENDING-only transition wording.
- #189's verifier recognizes only its original complete state or the exact #193 column/guards/receipt bound to the successor SQL digest; partial, mixed or tampered states refuse.
- NCR DELETE refuses; source identity, lab, description, raisedBy, first evaluation and createdAt stay immutable. CLOSED is fully immutable, and assessment/action cannot be cleared once set.
- APPROVE_RESULTS plus scopeGuard authorizes OPEN→ACTION with a nonblank assessment and ACTION→CLOSED with a nonblank action and closedBy/closedAt. No skipping, reopening or automatic closure. Each accepted change and its old/new values is audited in the same transaction; refusals make zero writes.
- The QA list uses its existing read permission, lab scope and status/source filters, with five locales. No additional workflow UI was pinned.
- New compatibility CRM evaluations retain actual write-time QC mode/criteria. Missing recorded mode raises no NCR. Historical CRM backfill is deferred; only PENDING PT rounds are backfilled.

Required new tests cover original/successor classifications and tampered guard;
PT same-lab link validity and retained reclassification link; all lifecycle
forward moves and zero-write refusals (skip, reopen, CLOSED edit, blank text,
DELETE); and CRM missing-mode refusal to create an NCR. Earlier pinned tests
remain required.

Validation: the additive SQL boundary suite passes25/25. Actual PT/lifecycle
runtime validation is in progress; no claim of full-suite success yet.

Applied by precedent:

| Fixture | Old expectation | Required expectation / pin |
| --- | --- | --- |
| `legacyWorkflowDatabase.js` captured-schema completeness | The pinned historical ProficiencyRound lacks exactly the seven #189 fields, and the generated model has no NCR table. | The unchanged historical DDL also lacks precisely `nonconformityId` and `NonconformityReport`; assert that exact gap without relaxing any other model/field completeness check (6075820954). |

Production remains under the #162 demo freeze.
