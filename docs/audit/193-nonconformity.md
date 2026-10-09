# Audit3.4 — nonconformity reports (#193), WIP

Prepared from main96f9ec4 after PR260/#191 merged. The requested NCR model is
absent; unsatisfactory PT still records PENDING and the repeat contract still
refuses NCR strings. No runtime change, migration, backfill or test claim yet.

Authoritative pins:
- [6071242717](https://github.com/yigini/soilfer-lims/issues/193#issuecomment-6071242717): source identity and explicit one-use manager override.
- [6034830001](https://github.com/yigini/soilfer-lims/issues/193#issuecomment-6034830001): retained PT evidence, nullable nonconformityId and idempotent PENDING backfill.

Implementation boundaries:
- SQL unique(source,refType,refId); retries retain the original NCR.
- QC REJECT: actual persisted QcDisposition id, one per analyte, same transaction.
- CRM: BatchPosition id, first failing QcEvaluation id, frozen recorded REQUIRED_BLOCKING/REQUIRED_WARN mode only; later FAIL reuses it, later PASS retains it.
- Ordinary over-limit repeat/RETURN retains ATTEMPT_LIMIT and zero writes for every role.
- Explicit manager override only at the policy limit: a new NCR and one child, atomic, immutable NCR link/request facts/CREATED event; callers cannot reuse an NCR id. Each additional attempt needs a new override.
- PT: additive nullable nonconformityId, RAISED only with a link; PENDING dry-run/backfill receipts list counts/ids. Existing z, outcomes and limits are never recalculated.
- QA list is scoped through scopeGuard and roles.js. No inline laboratory limits.

Confirmed runtime integration points: qcDispositionStateService's retained
disposition transaction; qcNativeMeasurementService, qcCompatibilityRunService
and qcCompatibilityCorrectionService's actual evaluation appends;
proficiencyRoundService classification/audit transactions; workRepeatService
capacity/preflight/reservation and workRepeatContract's current NCR refusal.
All original migration sources, receipts and refusals must stay verified.

Parked cleanly while #192's lineage clarification is resolved and work resumes
in checklist order. Production remains under the #162 demo freeze.
