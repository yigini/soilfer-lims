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

The branch now adds the pinned BatchReagentLot model and its additive DDL,
restrictive foreign keys, unique(batch,lot), and unconditional SQL UPDATE/
DELETE refusal. The independently digest-bound source is inspected by the
existing workflow scanner without new writer or fixture exemptions. Native
SQL tests cover immutable context, duplicate identity, retained parents and
unchanged inventory quantity. The SQL/scanner group passes105/105 at4a9e790
(11.706s), including all102 existing scanner tests, with no new exemption.

The only captured-schema expectation change is the exact absence of this
new table. All literal old DDL and every other completeness check stay intact.

[Pin6077632542](https://github.com/yigini/soilfer-lims/issues/194#issuecomment-6077632542)
settles the command boundaries: before start only OPEN; after start no CLOSED
batch, locked analyte or current disposition, and at least one IN_RUN or
QC_PENDING analyte. State checks precede lot validation. Identical active
links and prior withdrawals are no-ops; changed role conflicts, withdrawn
lots never reactivate, and a concurrent unique conflict must reread the
retained link. A dry-default installer now checks exact PRE/fresh/complete
states, columns, restrictive foreign keys, indexes, guards and source-bound
receipts; it refuses populated unmarked tables, mixed objects and tampering.
Its atomic apply retains all pre-existing rows, creates no links/backfill,
and repeated complete applies make no writes. Its owned historical-fixture
tests pass:3 suites114 tests0skips12.348s at498139e. Actual lot-command
contracts also pass, including preserved quantities, OPEN withdrawals,
post-start additions/refusals, mixed-analyte state, every retained retry,
a real SQL P2002 reread, and a late-event rollback. The expanded command,
start/header, native-regression and scanner group passes4 suites184 tests
0skips65.108s at499a1549. Client build8.75s and lint0errors14existing
warnings pass on that candidate.

[Pin6078331476](https://github.com/yigini/soilfer-lims/issues/194#issuecomment-6078331476)
freezes the actual Methodology id/name/standard/version in the existing
criteriaSnapshot and RUN_STARTED event at first start. Reopen retains it.
Historical missing revisions display unknown; no backfill or live inference.
My runs is a server filter for the named analyst plus their own unstarted
OPEN runs. All runs preserves existing scope/visibility for every existing
reader, with no new role authority.

The new atomic workbench start invokes the existing build/start, method
default, policy capacity, eligibility/qualification, operational gate,
assignment and active-SampleHold authorities. Calibration curves remain
deferred to199. The inspector keeps instrument/method/analyst/start read-only;
existing per-attempt fields retain their existing authorities. Picker
membership reuses the actual repeat-source authority; retained prior runs
are never overwritten or reactivated.

Actual UI callbacks pass the40-sample/six-interaction fixture, policy capacity,
scan selection without form submission, method-change clearing, historical
unknown revision, default My runs/All runs and all five client/server locales.
The UI/regression/wiring group passes5 suites65 tests0skips3.387s atdf115caa.

Existing owned fixtures install the actual194 additive schema: globalSetup,
qcGateFixture, normalizedQcFixture, repeatQcPredecessors, native/compatibility
run fixtures, reviewed-correction and preview fixtures, direct startup and
entrypoint readiness fixtures. All original assertions, literal captured
DDL and every workflow writer restriction remain. The only schema-gap
expectation added is the exact new table; no factory or writer exemption.

Merged193/main663c9664 is now integrated, retaining both startup/bootstrap
gates, both schema relations and both digest-bound sources. All ten locale
merges verify every main key and every runFirst key unchanged. Combined
whole-suite/build/lint and CI verification remain required before a PR audit.
Production remains under the #162 demo freeze.
