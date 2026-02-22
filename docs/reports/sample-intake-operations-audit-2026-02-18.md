# Sample Intake Operations Audit Report

- Date: 2026-02-18
- Scope: sample intake routes, controllers, scope controls, workflow/state transitions, audit logging, and intake-related frontend API calls.
- Review mode: static audit only (no code changes, no runtime test execution in this pass).

## Summary
This audit found multiple high-risk issues in sample intake operations, including cross-lab authorization gaps on intake approval/rollback paths, state-regression risks in reception intake, and reporting integrity gaps from missing canonical reception fields.

## Findings (ordered by severity)

1. Critical: Cross-lab authorization bypass on accept/undo
- Files:
  - `soilfer-lims/server/controllers/sampleController.js:1026`
  - `soilfer-lims/server/controllers/sampleController.js:788`
- Detail:
  - `acceptSample` and `undoIntake` enforce role checks but do not enforce lab scope before mutating sample records.
- Risk:
  - A manager with knowledge of another lab's sample ID can mutate that sample.

2. Critical: Reception intake can regress active samples back to `RECEIVED`
- Files:
  - `soilfer-lims/server/controllers/receptionController.js:98`
  - `soilfer-lims/server/controllers/receptionController.js:286`
- Detail:
  - Locked status list omits active states such as `SUBMITTED_PARTIAL` and `SUBMITTED_FULL`.
  - Endpoint then forces status to `RECEIVED` without workflow transition validation.
- Risk:
  - Workflow integrity break; active/review-stage samples can be moved backwards.

3. High: Primary intake path does not persist canonical reception fields
- Files:
  - `soilfer-lims/server/controllers/receptionController.js:285`
  - `soilfer-lims/server/app.js:319`
  - `soilfer-lims/server/app.js:447`
- Detail:
  - `/api/reception/intake` stores intake payload but does not set top-level `receptionDate` and `receivedBy`.
- Risk:
  - Intake dashboards/KPIs relying on canonical columns can be inaccurate.

4. High: Acceptance update is non-atomic with suppressed downstream failures
- Files:
  - `soilfer-lims/server/controllers/sampleController.js:426`
  - `soilfer-lims/server/controllers/sampleController.js:1075`
- Detail:
  - Sample status is updated first, work-item generation failure is caught and only logged.
- Risk:
  - Sample can remain `ACCEPTED` while required work items are missing.

5. High: Walk-in acceptance contract inconsistency
- Files:
  - `soilfer-lims/server/controllers/sampleController.js:741`
  - `soilfer-lims/server/controllers/sampleController.js:1047`
  - `soilfer-lims/server/tests/contracts/gates_clean.test.js:30`
- Detail:
  - Walk-ins are created with `labId: null`; `acceptSample` requires existing `labId` and fails otherwise.
- Risk:
  - Acceptance path behavior differs by endpoint/flow, creating brittle operations.

6. Medium: Intake actor attribution is client-spoofable
- Files:
  - `soilfer-lims/server/controllers/receptionController.js:12`
  - `soilfer-lims/server/controllers/receptionController.js:111`
  - `soilfer-lims/server/controllers/receptionController.js:330`
- Detail:
  - `receivedBy` comes from request payload and is used in history/metadata.
- Risk:
  - Provenance ambiguity between user-supplied actor and authenticated actor.

7. Medium: Intake can unintentionally overwrite analyses
- Files:
  - `soilfer-lims/server/controllers/receptionController.js:217`
  - `soilfer-lims/server/controllers/receptionController.js:288`
- Detail:
  - `requiredAnalyses` is rebuilt from incoming group/add/remove payload and overwritten.
- Risk:
  - Existing analysis plans can be lost on partial payloads.

8. Medium: Discard flow destroys audit evidence and is non-transactional
- Files:
  - `soilfer-lims/server/controllers/receptionController.js:425`
  - `soilfer-lims/server/controllers/receptionController.js:429`
- Detail:
  - Hard discard deletes related audit logs and executes multi-entity deletes outside a transaction.
- Risk:
  - Compliance traceability loss and partial-failure data integrity risk.

9. Medium: ID generation is race-prone
- Files:
  - `soilfer-lims/server/services/idGenerator.js:45`
  - `soilfer-lims/server/services/idGenerator.js:77`
- Detail:
  - Sequence allocation uses read-max-plus-one without concurrency control.
- Risk:
  - Duplicate ID attempts under concurrent intake load.

10. Medium: Dual acceptance paths produce metadata inconsistency
- Files:
  - `soilfer-lims/client/src/pages/SampleDetail.jsx:208`
  - `soilfer-lims/server/controllers/sampleController.js:415`
  - `soilfer-lims/server/controllers/sampleController.js:1069`
- Detail:
  - UI path uses `/status` to set `ACCEPTED`, but only `/accept` sets `acceptedBy/acceptedAt`.
- Risk:
  - Acceptance metadata differs by endpoint used.

## Test Coverage Gaps
- Missing explicit tests for cross-lab blocking on:
  - `POST /api/samples/:id/accept`
  - `POST /api/samples/:id/undo-intake`
- Missing explicit tests that `POST /api/reception/intake` cannot regress `SUBMITTED_*` samples.
- Missing explicit tests asserting canonical `receptionDate` and `receivedBy` population on reception intake.

## Audit Constraints
- No code changes were made in this audit cycle.
- This report reflects repository state as reviewed on 2026-02-18.
