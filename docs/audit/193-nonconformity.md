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
| `audit_3_2_repeat_commands.test.js` two unchecked `ncrId`/`override` inputs | The ordinary repeat route returns409 `ATTEMPT_LIMIT_NCR_UNAVAILABLE`. | The ordinary route now returns400 `REPEAT_FIELDS_INVALID` for both unchecked fields, retaining zero writes. The separate manager-only `/repeats/limit-override` command creates a fresh child/NCR at the actual policy limit, with the same reason rules (6071242717). |
| `rbac_enforcement.test.js` mounted routers | Existing mutating router inventory excludes the new NCR commands. | Add the actual NCR router so all existing negative permission checks also cover its lifecycle command; no exemptions or weakened expectations. |
| `audit_2_3_native_runs.test.js` owned run fixture | Installs QC evidence without the new NCR schema. | Install the exact #189/#193 schemas before exercising REJECT or CRM FAIL; retain all existing analytical/QC assertions (6071242717). |
| `audit_2_3_compatibility_runs.test.js` owned run fixture | Same prior QC schema only. | Install #189/#193 before actual REJECT; preserve failed/dispositioned evidence and result flags (6071242717). |
| `audit_253_reviewed_qc_correction.test.js` retained fixture | Predecessor installs omit #193. | Add #193 after #189; author/mode/criteria refusals and retained historical observations remain unchanged (6075820954). |
| `audit_1_2_guard_installer.test.js` positive startup | Installs all prior gates, then expects the listener. | Also install #193; retain read-only byte checks and actual listening/health checks. No production host is involved (6076453701). |
| `audit_2_6_pt_startup.test.js` missing equipment gate | Complete #189 is the last predecessor before equipment. | Install #193 as well before testing the next missing equipment gate; negative #189 checks remain unchanged (6076453701). |
| `audit_2_6_pt_startup.test.js` generated fresh schema and predecessor setup | An unguarded pushed schema returns PT_NOT_INSTALLED; #189 alone installs the PT guards. | The exact pushed #193 extension without guards/receipts returns PT_SCHEMA_MISMATCH under the strict #189 verifier. Successful fixture setup uses the atomic #189/#193 bootstrap; corrupted #189 receipts and missing #187/#195 gates still refuse with zero writes before application loading (6076453701). |
| `deployment_readiness_bootstrap.test.js` populated startup rehearsal | Uses only predecessor installers and adapts the old PT entrypoint command. | Install #193 and resolve its actual bootstrap command in the owned rehearsal. Keep every existing preservation/readiness assertion (6076453701). |
| `audit_2_6_pt_http.test.js` UNSAT create | Returns PENDING with only PT audit facts. | Return RAISED with a real same-lab PT NCR and source identity; retain exact z, limits and original classification audit assertions (6076135661). |
| `audit_2_6_pt_http.test.js` UNSAT→SAT correction | Retains PENDING and old/new classification audits. | Retain RAISED and the exact original NCR/link while recording both outcomes; no auto-close (6076135661). |
| `audit_2_6_pt_http.test.js` first legacy correction to UNSAT | Writes PENDING and clears only corrected legacy flags. | Link directly to a new valid RAISED NCR, with all original sigma/score/flag/audit assertions (6076135661). |
| `audit_2_6_pt_http.test.js` cleanup and zero-write snapshots | Deletes owned rows from the shared test database. | Use one explicitly owned disposable database and remove it through the existing owned-file helper. Never delete immutable NCRs or their retained source/audit rows; include NCRs in every zero-write snapshot. PT controllers explicitly pass their actual Prisma connection to the same service for writes, matching their read connection. |

Production remains under the #162 demo freeze.

Current implementation includes the dry-default, fingerprinted PT PENDING
backfill, actual persisted QC triggers, manager repeat override with
APPROVE_RESULTS, two scoped lifecycle HTTP commands, and QA read list with
VIEW_AUDIT, status/source filters and all five locales. Foundation suites
passed61/61; repeat/API/old-repeat/wiring group passed79/79 at a75c518.
Client build7.65s and lint0errors/14existingwarnings passed at that head.
The first full run is collecting predecessor fixture/setup failures; these
are being repaired without disabling guards or bypassing source workflows.
No full-suite pass or production migration/backfill is claimed.

The workflow scanner inspects the independently byte-bound NCR DDL/loader,
including schema and guard sections, while retaining all writer restrictions.
No new test-factory caller or writer exemption is added.

The four new SQL probes use fixed byte-bound source variables or parameterized
PT statements, so the existing scanner can inspect their actual SQL. The PT
HTTP fixture holds its owned Prisma injection for the entire request lifetime,
including lazy principal validation; real authentication and permissions stay
enabled.
