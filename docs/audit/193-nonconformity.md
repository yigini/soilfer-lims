# Audit3.4 — nonconformity reports (#193), WIP

Prepared after PR260/#191 merged, refreshed to maind2b69b8. The requested NCR model is
absent; unsatisfactory PT still records PENDING and the repeat contract still
refuses NCR strings. No runtime change, migration, backfill or test claim yet.

Authoritative pins:
- [6071242717](https://github.com/yigini/soilfer-lims/issues/193#issuecomment-6071242717): source identity and explicit one-use manager override.
- [6034830001](https://github.com/yigini/soilfer-lims/issues/193#issuecomment-6034830001): retained PT evidence, nullable nonconformityId and idempotent PENDING backfill.
- [6075820954](https://github.com/yigini/soilfer-lims/issues/193#issuecomment-6075820954): exact additive PT successor, no WorkAttempt column, lifecycle commands, retained links and recorded compatibility mode.
- [6076135661](https://github.com/yigini/soilfer-lims/issues/193#issuecomment-6076135661): first UNSATISFACTORY record/correction writes RAISED directly with its NCR in the same transaction. PENDING is historical-only; no NULL-round backfill.

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

Notes are parked and pushed while the current #192 audit fixes are validated.
Production remains under the #162 demo freeze.
