# Contracts, roles and connection checklist

These are proposed contracts. Reuse equivalent existing abstractions where present; avoid duplicate services or needless schema changes. Preserve current API consumers with adapters until migrated together.

## 1. Capability matrix

All cells are constrained by current account status, explicit scope, lab operational state and project revision. “Read” never means every sample in a shared project.

| Actor | Project context | Scientific plan / metadata | Lab membership / owner | Imports / receipt | Existing work / release |
|---|---|---|---|---|---|
| Super administrator | Global, explicit scope selector | Yes, audited | Yes, impact review | Configure/import with explicit destination; receipt only through current service | Existing role/workflow checks; no bypass of analytical readiness |
| National manager (MASTER_USER; resolve COUNTRY_ADMIN compatibility) | Authorized countries' lab relationships and explicitly granted context | Within delegated project authority; no implicit control of a multi-country project | Only explicit governance delegation covering affected labs; otherwise request owner action | Eligible authorized destinations only | Existing reviewer permissions and country/lab scope |
| Coordinating lab manager | Owned and serviced projects; own-lab samples unless explicit broader read grant | Owned project; shared/global only if delegated | Owned project within allowed destination policy and impact review; no cross-country privilege escalation | Own-lab receipt/import if allowed | Own-lab assignments/review through existing services |
| Servicing lab manager | Membership context and own-lab sample slice | Own-lab operational notes only; request project-wide change | Cannot edit project-wide membership or lifecycle | Own-lab permitted admissions | Own-lab work/review only |
| Project coordinator (PROJECT_MANAGER) | Explicit project grants | Delegated plan/metadata only; create requires a distinct capability and resulting creator grant | No implicit ownership/user-admin rights | Only explicitly delegated import profile; no automatic receipt authority | Read progress; no result approval from project title alone |
| Intake officer | Projects eligible for their lab's intake | Read instructions/defaults | None | Current reception permissions; admission checks on server | View handoff, not results editing |
| Technician | Relevant lab/task project context | Read effective method/plan | None | No project administration | Canonical workbench for assigned work; prerequisites required |
| Viewer/external viewer/auditor | Explicit read scope only; distinguish restricted result visibility | Read approved/project-appropriate content | None | None | Released/allowed data only; audit content according to existing role |
| Deactivated / missing required scope | Deny, clear reauthentication/access message | Deny | Deny | Deny | Deny |

No automatic grant widening to make failing tests pass. For a capability unsupported by the current role model, default to unavailable and supply a clear path to an authorized owner. Document intentional role-policy changes for review. Backend returns operation-specific capabilities; client and help text use them.

## 2. Read model and truthful counts

Suggested summary shape:

```json
{
  "id": "opaque-project-id",
  "code": "SOILFER-US",
  "name": "SoilFER USA Program",
  "revision": 12,
  "admissionState": "ACTIVE",
  "archivedAt": null,
  "scope": {"kind": "LAB", "labIds": ["GTM-LAB1"], "labelKey": "projects.scope.thisLab"},
  "counts": {
    "registered": 120,
    "awaitingArrival": 40,
    "intakeInProgress": 5,
    "labWork": 35,
    "awaitingReview": 10,
    "released": 25,
    "rejectedOrCancelled": 5,
    "needsReconciliation": 0,
    "everPhysicallyReceived": 75
  },
  "target": {"value": null, "scope": "LAB", "meaning": "SAMPLE_COUNT"},
  "asOf": "2026-09-13T12:00:00Z",
  "capabilities": {"editPlan": false, "receive": true, "manageAccess": false},
  "attention": [{"code": "SHIPMENT_OVERDUE", "count": 8, "destination": "authorized-deep-link"}]
}
```

Numbers above are a synthetic contract example. Registered = sum of the seven mutually exclusive current-state buckets. `everPhysicallyReceived` is a separate cumulative event measure and must not be summed with current stages. In this example some intake drafts are not yet physically received and some cancelled items never arrived; reconcile through real receipt evidence, not status arithmetic.

Define the bucket mapping against existing `sampleStateService`, canonical work-item/result-submission state and receipt events. Use precedence: terminal rejected/cancelled; released (current effective release); awaiting review; lab work; intake in progress; awaiting arrival; unresolved/unknown reconciliation. An explicit accepted rule handles amendments/reopens without erasing prior release history. Do not call EXPECTED “drying pending”. Archived/disposed specimens can retain their completed/released analytical outcome; specimen storage lifecycle is separate from analytical progress.

Report unknown/malformed states instead of dropping them. Stage count and its sample list must share the exact predicate and scope. Distinct sample IDs prevent one sample with 15 analyses being counted 15 times. Separate work-item counts, parameter counts, shipment counts and sample counts in labels. Targets: project-wide target is not a lab target; show “not allocated” for absent lab targets.

Use bounded aggregate/group queries and pagination; do not load 26,603 samples merely to count them. Add only query-plan-justified indexes around project reference, assigned lab and workflow state. Measure cold/warm queries with realistic fixtures.

## 3. Endpoint design

| Operation | Suggested contract | Required controls |
|---|---|---|
| Project list | GET `/api/projects?scope=...&status=...&search=...&cursor=...&limit=25` | Authorized scope cannot be enlarged by query; bounded limit, stable cursor, aggregate summary |
| Context/details | GET `/api/projects/:id` | Field projection and read capability; no secrets; revision/capabilities |
| Stage samples | GET `/api/projects/:id/samples?stage=...&cursor=...` | Same authorized predicate as summary; return display ID plus opaque ID |
| Metadata/plan | PATCH `/api/projects/:id` with expectedRevision | Strict allowlist; reject lifecycle/membership fields; validate all referenced active definitions |
| Impact | POST `/api/projects/:id/actions/preview` | Authorized operation, before/after diff, blockers, expiring revision-bound token; no mutation |
| Commit action | POST `/api/projects/:id/actions/commit` | Current authorization, revision, reason, idempotency key, validated preview; atomic domain+audit write |
| Import preview | POST `/api/projects/:id/imports/preview` | Typed upload/mapping, size/row limits, authorized target, immutable parsed snapshot and hash |
| Import commit/status | POST import commit; GET `/imports/:runId` | Idempotent row identity, scope on run/results/errors, progress and exact outcome counts |
| Connections | Scoped profile list/detail/action | Exact project+lab+asset; sanitized metadata; secrets only through existing secure update path |

Existing PUT/archive/delete/restore/manifest/lab-access and alternate Kobo routes must delegate to the same policy/command services or reject unsupported requests. Hiding old controls is insufficient. Old notifications and bookmarks (`/projects?code=...`) must resolve the authorized project and route to the workspace; unknown/denied projects get an intentional error page.

Use consistent success/error envelopes compatible with existing i18n helper signature. Prefer a typed/options-object wrapper rather than further positional calls; do not change the global helper's signature without migrating all its callers. Errors include stable code, localized message, field/row errors and request reference; status 409 for stale revision, 422 for validated but ineligible transition, 403/404 according to a consistent resource-enumeration policy. Network uncertainty uses operation lookup by idempotency key, not blind repeat.

Preview is not authorization. Preview hash/revision expires, commit recomputes permission and blockers in the transaction. Audit records actor and impersonating actor where applicable, scope, operation, before/after, reason and operation ID. Notifications and external jobs use a durable outbox after commit; failure to deliver a notification cannot undo or misreport a committed domain action.

## 4. Connections to update and prove

| Surface / source | Required change or verification | Acceptance evidence |
|---|---|---|
| `projectRoutes.js`, `projectController.js`, `projectMembershipService.js` | One policy/relationship writer/response schema across all current and new paths | API negative matrix and transaction failure cases |
| `scopeGuard.js`, `dashboardScope.js`, role maps and AuthContext | Project-specific policy adapters; compatible caller behavior; explicit grants and scope intersections | Same actor sees identical authorized sample set; empty grant denies |
| `Projects.jsx`, `App.jsx` | Workspace routes/components, capability-driven actions, working query bookmarks, isolated query errors | Desktop/mobile keyboard journeys; no old mutation buttons bypass |
| `labRoutes.js`, labLifecycleService | Show canonical owner/service links; impacts include current/open project work; scoped lab options | Add/remove lab reflected on both pages, preserving historical work |
| staffLifecycleService, users/staff UI, sessionValidationService | Effective project grants agree with explicit lab relations; no grant by matching country; revocation rechecked | Transfer/deactivation and stale session tests; own-lab administration survives |
| Reception.jsx, receptionController | Server admission policy, explicit lab destination, same project names/defaults, per-sample provenance for draft discard | Expected sample → recovered draft → actual receipt; no location/ID loss |
| Analysis catalogue/config and analysisService | Validate default bundle reference, version/effective snapshot, supported method/lab; human labels | Texture panel grouped correctly; MIR/NIR file workflow preserved; gates stay operational tasks |
| Workbench / sample workspace / workflow map | Project filter and notes link to authoritative plan; no project result editor; correct prerequisite counters | Existing drying/prep, grouped texture, spectral import and submit/review journeys unchanged |
| Kobo controller/service/scheduler | Explicit target, state checks, import receipts/provenance, non-guessing selection | Multi-lab multi-asset retry/pause/revoke tests; no real external calls in CI |
| reportAssembly.js and reporting pages | Project metadata remains linked; released snapshots remain immutable; corrections governed | Released report reference preserved before/after archive; no new missing projectName |
| sisController/routes/key management | Scope intersects authorized project/lab grants; stable projectCode and release eligibility | Authorized released data unchanged by archival; unauthorized keys denied |
| dashboardService/scope and role landing pages | Reuse canonical counts/readiness, attention deep links and scope wording | Project/manager/intake tiles reconcile with filtered lists |
| Notifications, audit, Help KB | Canonical deep links, accurate operation receipts, contextual guides per workspace tab | Notification opens expected tab; unauthorized link stays denied; no “no guide” placeholder |
| Locale/theme/PWA draft layer | Five locales, existing theme preferences, user-scoped cache invalidation, no offline governance replay | Shared-device role switch, logout/revoke and reconnect tests |

Project-level analysis plan is an ordering default, not a second catalogue. Keep existing analysis grouping (including texture components and derived class), spectroscopy result type, revision and report rules in their current authoritative services. The plan UI summarizes the resolved package and links to catalogue administration; it must not duplicate formulas or scientific validations.

## 5. Boundaries and controlled exceptions

Do not reconstruct receipt dates from createdAt. Do not infer lab ID from accession-code prefix. Do not migrate code-only sample ownership when it conflicts with an existing projectId. Do not reactivate archived projects because a new import arrives. Do not turn a global project into a local one via a generic form save.

For each unresolved legacy record, store the reason and show an actionable reconciliation queue to an authorized administrator. Keep ordinary read/history available where scope is known; block only the affected unsafe operation. Avoid a platform-wide lock because one project's membership needs review.
