# Task: Remediate Sample Intake Audit Findings

- Created: 2026-02-18
- Source report: `soilfer-lims/docs/reports/sample-intake-operations-audit-2026-02-18.md`
- Objective: Close high-risk intake vulnerabilities and workflow integrity gaps.

## Priority Plan

1. P0 - Enforce lab scope on intake mutation endpoints
- Endpoints:
  - `POST /api/samples/:id/accept`
  - `POST /api/samples/:id/undo-intake`
- Acceptance criteria:
  - Cross-lab operations return 403 for non-global roles.
  - Add regression tests for both endpoints.

2. P0 - Prevent state regression in reception intake
- Endpoint:
  - `POST /api/reception/intake`
- Acceptance criteria:
  - Intake blocks any transition that violates `workflowContract`.
  - Intake cannot move `SUBMITTED_PARTIAL`, `SUBMITTED_FULL`, `APPROVED`, `ARCHIVED`, `DISPOSED` backwards.
  - Add tests for attempted regression.

3. P1 - Persist canonical reception fields in reception intake
- Fields:
  - `receptionDate`
  - `receivedBy`
- Acceptance criteria:
  - Reception intake writes canonical columns and payload consistently.
  - Dashboard/KPI queries reflect new intake events.
  - Add tests for field persistence.

4. P1 - Make acceptance + work-item generation atomic
- Acceptance criteria:
  - If work-item generation fails, sample status update is rolled back.
  - Failure path returns actionable error without partial state.
  - Add transaction rollback tests.

5. P1 - Resolve walk-in acceptance contract mismatch
- Acceptance criteria:
  - Walk-in samples have a single, consistent acceptance contract.
  - Tests updated to reflect canonical path and required fields.

6. P2 - Harden actor attribution and provenance integrity
- Acceptance criteria:
  - Server-derived actor (`req.user.username`) is the source of truth for intake history fields.
  - Payload actor fields, if accepted, are stored only as supplemental metadata.

7. P2 - Protect audit trail on discard operations
- Acceptance criteria:
  - Avoid destructive deletion of audit records.
  - Convert multi-delete discard operation to transactional unit with clear retention policy.

8. P2 - Reduce ID collision risk under concurrency
- Acceptance criteria:
  - Adopt collision-resistant ID strategy or transactional/locked sequence generation.
  - Add concurrency test coverage for intake ID creation.

## Suggested Validation Checklist
- Unit/integration tests added for each P0 and P1 item.
- Existing intake golden-path tests still pass.
- Security regression tests explicitly include cross-lab negative cases.

## Status
- Current: Open
- Owner: Unassigned
- Target: Next remediation sprint
