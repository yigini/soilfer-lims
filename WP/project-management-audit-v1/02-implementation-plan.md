# Implementation plan

## Outcome

Replace the current project list/modal combination with a useful project workspace, while keeping the existing reception, workbench, review, reporting and laboratory services responsible for their own work. Correct shared authorization, relationships and lifecycle contracts first. This is one bounded project-management release, not a rewrite of all LIMS modules.

### Non-negotiable invariants

1. A sample's identity, project provenance, results and released report remain intact when a project is paused, closed, archived or restored.
2. Every request authorizes the current principal, operation and resource scope. A button or a lab membership alone is not authorization to administer the whole project.
3. Lists, details, counters, exports and drill-downs use the same predicate. A summary never reveals data outside the actor's scope.
4. Expected field records are not physically received samples; missing dates or unknown states are visible exceptions, not invented receipt events.
5. Changing future analysis defaults does not alter existing orders, gate tasks, results or released reports.
6. Retrying an interrupted write cannot duplicate samples, audit events, project grants or sync jobs. An error cannot masquerade as an uncommitted successful change.
7. Project pages coordinate work. All analytical result entry and drying/preparation completion remain in the canonical workbench workflow.

## A. Practical user experience

### Project overview: `/projects`

- Page title, brief description, visible scope (for example “Guatemala lab projects”), search by project name/code and a clear “New project” action only when allowed.
- Default to active work needing attention, while retaining an obvious All projects tab. Use a deterministic empty state: “No projects need attention. View 3 active projects.” Do not hide healthy projects or jump unexpectedly as counts refresh.
- One row/card per project. Show name first, code second, owner/servicing context, admission state, expected/not-arrived count, physically received total and released total, next deadline and a concise reason for attention.
- Do not label a received count as total volume. Avoid decorative doughnuts and a global total alongside lab-only counts. The user can always see the scope and last refresh time.
- Row opens a full project workspace, not a narrow overloaded drawer. Keep lightweight quick-view optional; it must not contain duplicate business logic.
- Filters: status, lab within authorized scope, source, priority; search and filter state shareable in URL. Server pagination (default 25, validated maximum 100), stable sorting, loading skeleton, accessible empty/denied/error states.
- Move legacy backfill under “Data tools” for authorized administrators. Link the existing validated tool; do not rewrite historic data from the overview.

### Workspace: `/projects/:projectId`

Persistent header: human name, code, admission state, coordinating owner, scope, last update, primary permitted action and “Project actions” menu. Use six practical tabs:

1. **Overview**: attention list with exact next actions; scoped sample stages; next shipment/report deadline; project contacts; instructions. A count leads to its matching sample list, not an unrelated dashboard.
2. **Samples & arrivals**: expected list, shipments/consignments when present, physically received samples, workflow state, latest released report. Select and go to reception/workbench only with existing permissions. No new result editor. List exclusions and scope explicitly.
3. **Analysis plan**: current default package, resolved human parameter names, selected methods and revisions, participating-lab availability, effective date, instructions and plan history. Show “applies to future orders”; dedicated reviewed change request for already ordered work.
4. **Labs & people**: coordinating owner, servicing labs, active/inactive status, workload impact, authorized project contacts and effective access. Explain direct project grant vs lab-derived access. Use existing staff-management journeys for adding/deactivating people; do not introduce a parallel user directory.
5. **Data connections**: manifests and Kobo import runs, explicit lab destination, mapping version, last success and rejected/conflicting rows; SIS delivery/export status only where integration and permission exist. Never display raw stored tokens.
6. **Activity**: actor, operation, reason, before/after summary, timestamp and import/lifecycle receipt. Filter by action; deep-link to existing audit system. No silent editing of audit entries.

At mobile widths, turn project rows into compact cards; header stacks; tabs horizontally scroll with clear active state; sample columns offer a contained horizontal scroll or per-row details. Keep touch actions at least 44 CSS px as a product target. A lifecycle review is a full-height mobile sheet with visible title/cancel/confirm. Desktop functionality and keyboard operation remain intact.

### Creation flow

Use a focused page or stepper, not a long mixed administration modal:

1. **Identity**: name, unique permanent code, client/contact where applicable, coordinating owner within allowed scope. Server validates uniqueness and character/length rules. Keep internal ID distinct from the human code for new projects; do not re-key legacy projects gratuitously.
2. **Laboratories & access**: owner and explicit servicing labs with names/codes/countries; explain what access this gives. Select only operationally eligible labs. National users cannot select outside their authorized countries, and a matching country never silently selects a lab.
3. **Sample sources**: expected manifest, Kobo, permitted unlisted intake. Treat these as admission capabilities rather than a destructive type switch. Show explicit destination lab for each import profile. Save a project draft if the manifest/config is not ready.
4. **Analysis plan & dates**: resolve package definitions and methods by lab; show constituent parameters and non-applicable choices. Distinguish expected shipment deadline from laboratory turnaround/report deadline. Target unknown is null, not zero; target is not the manifest count.
5. **Review**: summary of who gains access, what is created, how many rows are valid and which integrations will remain inactive. Create only after server validation. Activation is explicit and requires a complete eligible configuration.

Return the authoritative saved ID/revision, exact created/skipped/rejected row counts, audit receipt and pending integration job status. If imports are asynchronous, show a pending import job, not “all samples registered”. No successful project message should hide a failed required manifest.

## B. Authorization and ownership

Implement project-specific `canReadProject`, `canEditProjectPlan`, `canManageProjectAccess`, `canTransitionProject`, `canImportProjectSamples`, and `buildProjectSampleScope` in one policy/service boundary. Reuse current role/session primitives; do not add an independent authentication system or globally replace scopeGuard without auditing callers.

Recommended capability policy is detailed in document 03. Derive frontend capabilities and denial reasons from the backend. Provide read-project permission separately from MANAGE_PROJECTS so technicians/reception can see their relevant project context without acquiring settings access.

Do not automatically expand current PROJECT_MANAGER rights. Establish explicit per-project delegated coordination capability where needed; otherwise creation is unavailable with an explanation. A national manager's read oversight can span authorized countries, but governance edits to a multi-country project require explicit authority over the affected resources. Owner-lab management and service-lab work management are separate powers.

Evaluate permissions again at commit time using the current user and membership revision. Revoked/deactivated staff must not keep access through a cached list, offline replay, existing token or deep link. Existing session invalidation contracts remain authoritative.

## C. Canonical relationship and migration design

Use Project.id as the canonical internal reference. Keep code unique and stable; protect human display names independently. Keep one explicit coordinating owner field (nullable only for centrally coordinated projects) and ProjectLab rows as the canonical service relationship. Preserve existing PRIMARY/BACKUP/OVERFLOW semantics in a separate service function field or explicitly map them; do not reinterpret all old roles as OWNER.

Add relationship provenance/revision as needed. Explicitly configured empty membership must be distinguishable from legacy not-yet-migrated membership. Eliminate country fallback at runtime after reconciliation; countries are geography/oversight context, not permission grants.

Migration must be additive and report-first:

1. Inventory owner, ProjectLab, assignedLabIds, countries, Lab.projectCode and User.projects for every project. Include nulls, malformed arrays, inactive/deleted labs, duplicate IDs/codes, code-only sample links, RESTORE-prefixed samples, stale grants, Kobo configs and SIS-key scope.
2. Generate a reconciliation report: exact match, legacy-only, junction-only, conflicting owner/service data, unknown lab, country-only candidate. **Do not union all sources**, as that could expand access.
3. Auto-backfill only unambiguous explicit relationships and exact unique project references. Quarantine conflicts for authorized resolution with before/after impact. Country-only links need a governance decision, not automatic access.
4. For legacy RESTORE records, reconstruct only when an exact original project exists and audit/history supports the link; preserve project trash/archive visibility. Do not change results, release status or report files.
5. Migrate in resumable, bounded transactions with audit/change receipts and counts. Use an idempotent checkpoint. Re-run must produce no additional grants or sample changes.
6. Temporarily maintain compatibility fields from one writer until every reader is migrated. For reconciled projects, old generic writes to these fields must be rejected, not allowed to diverge. Remove fallback only after caller coverage is demonstrated.

Never treat Sample.labId (documented as the generated accession label) as the owning laboratory ID. Use the validated operational assignment field/service, with explicit handling for transferred samples and historical access. Do not globally rename that column in this release; migrate consumers deliberately.

## D. Lifecycle and safe operations

Separate admissions from archival; avoid inventing one new string and pushing it across every module without compatibility mapping.

| Product state / action | New intake or expected imports | Existing received work | Historical access |
|---|---|---|---|
| Draft / awaiting setup | Blocked, except validated setup preview | No automatic work creation | Scoped read |
| Active | Allowed by source/lab policy | Allowed by workbench readiness | Scoped read |
| Pause admissions | Blocked; explain reason and next review date | Continue; do not block safety-critical completion | Scoped read |
| Close admissions | Blocked permanently until explicit reopen | Continue to review/release | Scoped read |
| Archive | Blocked; require no unresolved active work/import jobs/transfers, with explicit expected-record disposition | No new routine work; corrections follow existing governed amendment process | Preserved, searchable, reports/SIS remain governed by release policy |
| Trash empty project draft | Blocked; only empty, unused draft with no audit-relevant operational history | Not applicable | Tombstone/audit retained |

Archive is **not analytical approval**. Do not use it to mark samples complete, accept results or release reports. Legacy COMPLETED may mean archived in this UI but must be classified from evidence, not blindly mapped to finished analysis. Unknown statuses become “Needs reconciliation” and cannot gain write privileges.

Before changing membership/owner/closing/archiving, show a server-generated impact preview with revision and expiring token: affected labs, users/grants, expected samples, received/open work, queued/offline writes, active imports, released outputs. Require a reason for governance/lifecycle changes. Commit rechecks readiness and permissions; stale preview returns 409 and refreshes the impact.

Removing a lab with outstanding work requires transfer/closure decisions through the existing lab/work-assignment service. It must not make work disappear or silently move samples. Historical audit retains actors and labs even after removal, while current reading permissions are evaluated separately. No one should gain historical access merely from a removed role remaining in an audit log.

## E. Reliable imports and external connections

- Manifest preview supports explicit worksheet/column mapping, file size/row limits, text-preserved identifiers including leading zeros, normalized header selection and per-row errors. Never guess latitude/longitude or silently treat IDs as numbers.
- Validate project/lab, source, sample identity, duplicate strategy and column types on the server. New sample IDs are opaque internal IDs; label/field ID is separate. Retain provenance and import-run ID.
- For large imports, stage an immutable parsed snapshot, then a resumable job with chunk transactions and stable per-row idempotency keys. A retry resumes or returns the same receipt. Preview totals must match committed outcomes.
- Same-project duplicate = “already registered”, with a policy for field metadata amendments. Cross-project conflict = blocked row without exposing unauthorized other-project metadata. Never silently reassign.
- Store specimen/source provenance per sample (expected manifest/Kobo/unlisted), independent of later project configuration changes. Draft discard relies on that origin and existing lifecycle rules.
- Kobo config must name project, asset, destination lab, source server and mapping version. Missing/ambiguous target blocks activation. Support multiple explicit connections per project; never use first row/first lab as fallback.
- Project creation does not perform a remote sync inside a database transaction. Save the validated project/config in a transaction, then enqueue a durable job; show queued/running/succeeded/partial/failed and retries. An inactive config or failed test cannot look connected.
- Deduplicate using stable source identity including source server/asset/submission and derived specimen/depth key. Preserve raw field metadata and attachment provenance. Validate updates separately from new arrivals.
- Scheduler and manual/retry imports use the same admission/lab policy at execution time; check again when processing a queued job after pause/revocation.
- Show SIS “Released data available” only from actual delivery/export evidence. Reuse current scoped read/release rules; never export drafts or automatically mint wildcard keys from project membership. Secrets remain in existing secure configuration flows.

## F. Delivery sequence

### 0 — Establish baseline and freeze scope

Read this package and the existing lab-governance release notes. Confirm repository, branch, upstream commit and deployed artifact independently. Current PR #94 was open at audit time; integrate against the actual accepted baseline. Inventory existing tests and exact routes/consumers. Record which findings are still present. Do not reset the user's working tree.

### 1 — Repair integrity and access (small reviewable change)

Fix response contracts and post-commit error handling; stop provenance-destroying deletion; enforce project read/write/sample scope; close generic metadata bypasses; transactions with audit; empty-membership handling. Add negative and failure-injection tests. Keep existing UI usable; feature-flag new project administration if needed, but security fixes must cover legacy routes too.

### 2 — Reconcile data and connected consumers

Dry-run reconciliation first; implement membership/source/lifecycle compatibility and migration reports; update lab/staff/reception/Kobo/dashboard/report/SIS consumers listed in 03. Add paging and shared count predicates. Verify no grant expansion, deleted link loss or changed released result.

### 3 — Build the workspace

Split Projects.jsx into tested query/state hooks and focused components. Use existing routing, theme tokens, translation registry, confirmation primitives and help system. Implement overview, sample drill-downs, analysis plan, labs/people, connection runs and activity. Preserve deep links/back navigation. No parallel result entry.

### 4 — Prove the journeys, then release

Run the acceptance cases, locale/mobile/accessibility checks, migration rehearsal, production-like smoke test and asset-update checks. Ship only after evidence is complete. One concise release report records remaining limitations and the deployed commit, not just “done”. Deployment needs the user's current authorization; this planning task itself does not execute it.

## G. Presentation, translation and reliability

Use the current SoilFER brand: off-white background, restrained deep green actions, warm soil-colored accents and useful status color. Light is the default; existing session/profile dark-mode behavior remains. Use dark-gray surfaces through tokens; no isolated hardcoded light panels.

All copy (including errors, impact reasons, import row messages, plurals and empty states) must support **en, es, es-419, fr, pt**, the current canonical locales. Use localized display names for analysis/package/method, preserve stable IDs/codes in data, and format dates/counts using the platform locale utilities. Do not translate project codes or user-entered names automatically. Keep translation namespaces grouped under projects, memberships, projectImports and lifecycle. Reuse curated analysis terminology; ambiguous duplicate bundles need disambiguation by method/revision/lab rather than a new translation of the same ambiguous label.

Every primary screen needs contextual help: choosing sources, expected vs received, coordinator vs servicing lab, changing defaults, paused admissions, import conflicts and safe closure. Explain what happened, why and the next action in ordinary laboratory language.

Separate required project query failures from optional labs/groups failure. Never render failed counts as 0. Preserve the last verified data with a stale indicator; disable risky writes if the permission/revision snapshot is stale. Give retry and a support reference. Do not expose raw exception stacks to users.

Governance changes, import execution and access grants require online server validation. Offline mobile users may read an authorized cached snapshot with a visible timestamp and prepare recoverable drafts; queued existing workbench operations retain their current contract and must be reauthorized on sync. This does not revoke the earlier full-offline lab-work requirement. It prevents offline admin edits from silently changing security policy.
