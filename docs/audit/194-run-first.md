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

Notes parked and pushed while #192 CI completes and #193 resumes after its
clarification. Production remains under the #162 demo freeze.
