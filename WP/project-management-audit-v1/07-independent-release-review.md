# Independent project-management release review

Reviewed 14 September 2026 (Europe/Rome). Code: `e9e7acf5993a0ce21dc371ad69305c4220667584`.

**Verdict: implemented and visible in production, but NOT accepted as complete. Corrective work is required.** This is a review and corrective handoff, not authorization to discard other work or production records.

## What was independently verified

- GitHub PR 94 is merged; its Test & Build check passed (run 34787296400). A green build does not cover the failures below.
- Production `/projects` and `/projects/SoilFER-USA` show the new project list and six-tab workspace. Read-only inspection used the existing GTM laboratory-manager session; no production sample or project was changed.
- Source inspection found substantive improvements: protection against deleting projects with samples, rejection of unrelated laboratory reads, removal of country-based empty-membership fallback, transactions around several writes, correct manifest response shape, and an import-preview endpoint. These improvements do not close every original finding.
- Antigravity reports production image `soilfer-lims:v3.5.0-280da42`, database backups and health checks. The image digest, backups and server database were not independently inspected in this review; distinguish these reported facts from the independently observed live interface.
- Eleven targeted adverse acceptance checks reproduced eleven remaining failures. These are focused tests of suspected gaps, not a claim that every application test fails. See `independent-release-probes.cjs` and `independent-release-results.json` in this directory. The script creates a separate schema-only SQLite fixture database and exercises the real router and authentication middleware. The source database hash before and after is identical.

## Stop claiming all 22 findings are resolved

The release completion table does not consistently preserve the original PM finding definitions. For example, original PM-11 concerns failed manifest insertion during project creation; PM-14 concerns intake-source provenance and lifecycle rules. Relabelling them as token redaction or responsive layout does not resolve those findings. Reconcile every original row in `01-audit-findings.md` and every A01–A20 acceptance case with actual code, a meaningful test and a truthful status: complete, partial, or open.

## Priority correction queue

### 1. Country-scoped reads fail open — security blocker

`server/services/projectPolicyService.js`, `buildProjectSampleScope`, accepts optional authorized lab IDs for national users but returns the unrestricted project predicate if none are supplied. List/count/sample callers in `projectController.js` do not supply those IDs. R01: a GTM national user reads a sample assigned to a ZZZ-country laboratory in a multi-country project.

Resolve the actor's permitted laboratories on the server for every read, count, export and drilldown. Missing scope must deny or return an explicitly empty scope. Keep an explicit project-manager project grant distinct from national authority. Do not rely on the front end to supply authorized IDs or on project membership to grant all sample access.

### 2. Project closure can bypass unfinished work — integrity blocker

R02: generic PUT accepts `status: COMPLETED` with an expected sample. R03: the archive endpoint accepts `force: true` to bypass that blocker. R04: an unfinished PROCESSING sample does not block archive because only expected states are counted.

Use one server transition service for all entry points. Check the complete agreed readiness contract, including unfinished work, pending review and relevant in-flight operations. Remove the unrestricted force bypass; any genuinely permitted exception needs a separately authorized, explicit and auditable policy. Reject invalid source-to-target transitions. Preserve sample relationships and issued-report provenance.

### 3. Imports ignore pause and destination scope — integrity blocker

R05: a servicing manager imports into a PAUSED project, and the sample is assigned to the owner laboratory rather than the servicing destination. Preview/commit do not share a verified immutable context. R06: conflict preview exposes another project's identifier for a sample outside the actor's scope. R10: an invalid sample ID containing spaces/punctuation is marked valid.

Apply admission-state checks to manifest commit, reception, Kobo manual import and scheduled sync. Resolve and validate an explicit permitted destination lab. Validate identifiers and rows on the server; preserve text IDs and leading zeros. Bind preview to actor, destination, project revision and content, and revalidate on commit. Return a neutral conflict message for inaccessible records. Make retries idempotent and account for every accepted/rejected row.

### 4. Membership mutation uses the wrong permission — security blocker

R07: an explicitly project-scoped PROJECT_MANAGER without lab-access management authority can change servicing membership, including adding an inactive laboratory. The service uses broad `canManageProject` rather than `canManageProjectAccess`. Exposing a stricter UI capability does not enforce it at the API.

Enforce the dedicated governance permission in the write service and validate active laboratories, scope and removal impact. The UI promises that labs with active work cannot be removed, but that promise must be backed by an actual server blocker/transfer workflow. Keep writes and audits atomic. Reconciliation must not automatically union conflicting legacy and junction memberships: report ambiguity and resolve it under the agreed migration policy. Inspect `server/scripts/reconcile_projects.js` before running it again.

### 5. Scientific plan is synthetic data presented as fact — live confirmed

`client/src/components/projects/AnalysisPlanTab.jsx:14` hard-codes pH, texture and MIR methods. Line 51 displays a fixed Revision 3 effective 1 September 2026. Production SoilFER-USA shows these exact methods, revision and spectral details, regardless of the actual project plan. The change-plan button at line 87 displays an alert rather than opening an implemented workflow.

Remove synthetic values from production rendering immediately. Resolve the saved project plan, catalogue names, method versions, units and effective-order policy from authoritative records. If no plan exists, say so and offer only an authorized real configuration action. Do not invent a method, spectral format, range, default plan or effective date. Preserve existing order snapshots when defaults change.

### 6. Activity view invents audit events — live confirmed

`client/src/components/projects/ActivityTab.jsx:20` requests `/api/audit`; the application mounts the audit endpoint at `/api/audit-final`. A failed/empty request falls back at lines 32–49 to invented PROJECT_UPDATED and PROJECT_CREATED events attributed to System. The live page displays the exact invented descriptions under a permanent/immutable audit heading.

Remove fallback events. Connect to the supported audit contract with correct project filters and authorization. Show separate loading, empty, denied and failed states. A failed request must never look like a successful audit history. Verify dates, actor identity, pagination and deep links using real test audit events.

### 7. Counts still confuse status with physical receipt

R08: DRAFT, CANCELLED and UNRECOGNIZED samples with no receipt date all count as received. List and stats duplicate this broad negative-status test. Stage buckets also need reconciliation against real work-item and sample states.

Define a shared receipt/stage projection using authoritative receipt evidence and explicitly documented treatment of legacy records. Expected/draft records must not inflate received work. Unknown states require explicit handling. Lists, workspace, dashboard and filtered drilldowns must use the same scoped definitions. Do not fabricate corrective receipt timestamps.

### 8. Large projects still fetch every sample

R09: `/samples?limit=1` returns the entire two-record fixture. The workspace eagerly fetches all samples, including for tabs that do not need them; list summaries also load sample rows per project. This is unsuitable for projects containing thousands of samples.

Implement bounded server pagination/filtering and efficient scoped aggregates. Fetch each tab's data when needed. Keep selected filters and tab in the URL and ensure result totals and paginated rows agree. Test the real application at realistic volume, not only the small visual mockup.

### 9. Creation and management controls are incomplete

R11: a request for an unconfigured DRAFT open-intake project becomes ACTIVE. The new create form collects a client value that is not persisted by the controller. Kobo creation needs settings not represented by the simplified form. The plan-change action refers to metadata editing without implementing that path.

Complete the agreed draft-to-active configuration and editing flows with validation, real persistence and readiness checks. Expose honest disabled/blocked states with the next useful action. Do not auto-activate incomplete projects. Verify owner, servicing labs, plan, source mapping, client and target/deadline end to end.

### 10. Connections and team tabs overstate their implementation

- Kobo UI reads `formId`, while the controller supplies `koboFormId`; configuration selection still takes the first config. The destination shown may be the project owner rather than the actual configured destination.
- Do not claim credentials are encrypted at rest unless storage actually guarantees it. Never return or render credentials in this review or completion evidence.
- Labs and People renders every laboratory as Active and generic "Authorized staff" rows without proving actual operational/staff state. Secondary access failures can look like no members instead of an error.
- Shared membership consumers in laboratory/staff/dashboard/reception/Kobo/report/SIS paths need the original contract review. A new workspace component alone does not prove those connections were fixed.
- Spanish live UI still exposes raw status codes and English synthetic audit text. Finish real application localization, permissions, empty/error states and accessible mobile/desktop behavior across all five supported locales.

## Implementation and release instructions for Antigravity

1. Read this review, both independent probe files, the original findings and contracts before editing. Reproduce failures locally on isolated fixtures. Do not run adverse mutation tests against production.
2. Work from the current merged baseline, preserving concurrent work. Do not blindly revert the governance release, reset history, delete database records or rerun broad reconciliation as a shortcut.
3. Prioritize the security/integrity checks and removal of invented scientific/audit content. A small urgent corrective release can precede completion of the remaining usability work, but report it as a partial correction.
4. Turn the reproduced failures into durable, meaningful regression coverage. Audit failure tests should inject failure into the transaction client used by the code; avoid adding special production behavior solely to detect test mocks.
5. Complete the originally agreed connected workflows. Validate through the actual application, including an authorized servicing manager and country-scoped user. A successful run of `review-preview.html` or its screenshot script only tests the synthetic design preview.
6. Record real evidence: checks run, failing/passing cases, actual screenshots, remaining exceptions and PM/A acceptance mapping. Do not claim "all resolved" until each item is supported. If a probe assertion is disputed, explain the intended contract and evidence rather than merely changing the assertion.
7. Existing user authorization for safe GitHub push/PR/merge and production deployment remains in place after the relevant checks pass. Back up the production database, assess migrations and rollback compatibility, deploy the tested commit, verify health and role-scoped read-only smoke checks, and record commit/image/backup identifiers. Do not weaken gates just to obtain a green build.
8. Update GitHub issues truthfully, closing only verified fixes and retaining explicit outstanding work. Explain progress to the user in short, friendly, plain-English messages: what was wrong, what you fixed, what is being checked and what remains.

## Review limits

This pass establishes concrete remaining defects. It does not claim every role and integration has been exhaustively retested, that a production data leak was observed, or that a backup restore was tested. Security failures were reproduced only with synthetic accounts and records. Production read-only inspection independently confirmed the new UI and the misleading scientific/audit content.
