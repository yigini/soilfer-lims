# Audit4.1 — run-first workbench (#194), WIP

Branch audit/4.1-run-first starts from maind2b69b8 after #186, #190 and
PR260/#191 merged. No runtime/schema change or test claim yet.

Confirmed remaining scope: WorkbenchShell.jsx still defaults to the individual
my_work queue (lines53–61), and BatchModal.jsx still uses an instrument text
field. Batch has no reagent-lot link relation. Existing NativeRunPanel and
WorksheetArea already supply the normalized run worksheet and scanner, so
those authorities and deep links must be preserved.

[Pin6072013517](https://github.com/yigini/soilfer-lims/issues/194#issuecomment-6072013517)
requires an additive BatchReagentLot table (id/batch/lab/inventory lot/optional
role/actor/time), immutable UPDATE/DELETE guards and unique(batch,lot). Only
same-lab AVAILABLE, unexpired inventory lots link. OPEN withdrawal appends an
event; after first start only additional links are permitted. Linking never
consumes inventory. Scope and roles remain central.

Instrument, method, analyst and first start are read-only row context; only
existing per-attempt exceptions remain. No calibration-curve field/value:
that record and gate are deferred to #199. LabMethodDefault supplies the
default method, readiness supplies instruments, and policy supplies capacity;
40 is only the acceptance fixture. Keep existing mismatched-method and
ineligible-instrument refusals, and test every committed Result's instrument.

Further confirmed authorities at this base:

- `qcNativeRunService.instrumentFor` checks registration, IN_SERVICE and lab
  scope. It does not choose instruments or independently evaluate method
  eligibility/calibration. Preserve it and the first-start freeze; the new
  run-start command must evaluate each actual selected work item with
  `workbenchReadinessService` inside the same transaction before starting.
- `eligibleEquipmentForItem` obtains the method/analysis eligibility mapping
  and the policy requirement, then obtains qualification views. It is the
  picker authority; neither an unfiltered equipment list nor a typed name
  supplies a registered instrument identity.
- `batchSequenceService` already resolves and enforces `maxBatchSize` from
  policy. Keep that authority; the legacy Batch.maxCapacity default is not a
  wizard limit.
- Native commands nest into `withQcAudit`'s existing transaction collector.
  A run-first command can build and start through those authorities atomically,
  retaining their source evidence and audit pairs if every step succeeds.
- Reagent links must be included in retained run evidence, not hidden inside
  notes or QC JSON. Append link/withdrawal events in the same command
  transaction; never change inventory quantity or a retained link row.

Implementation and UI verification are still pending. These are source checks
and an implementation boundary, not a completed acceptance or test claim.
Production remains under the #162 demo freeze.
