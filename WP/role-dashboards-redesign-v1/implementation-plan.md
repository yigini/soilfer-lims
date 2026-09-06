# Role dashboards: implementation plan

## Outcome and boundaries

Give every person a calm, useful start to the shift. Home shows the work relevant to their role and permitted scope, then opens the existing workspace at the correct task. No result cells, one-click approvals, implicit intake, automatic QC decisions or bulk laboratory mutations on home. A navigation click is read-only. Preserve notifications, search, language, theme, profile and the established sample/workbench controls.

Implement this as a coordinated dashboard-and-destination contract correction, not another independent workflow engine. Do not redesign every destination: add the missing scoped filters, permission checks, deep links and error handling needed for complete dashboard journeys. Retain the reception integrity correction and existing v3 workflow behavior. Record any unrelated defect separately; a defect affecting a promised journey cannot be deferred while that journey is labelled finished.

## What staff see first

| Role | Home title | First useful content | Primary continuation |
|---|---|---|---|
| Sample reception | Reception | Own unfinished intakes and arrival problems; expected records searchable separately | New intake / resume exact draft |
| Technician | My bench | Returned work, saved runs, then ready work grouped by parameter + method revision + run | Continue run / open method worksheet |
| Lab manager | Laboratory work | Holds/QC exceptions needing a decision, submitted work, final approval, assignment, intake acceptance | Review the next eligible decision |
| National master user | Laboratories | Permitted labs with exceptions, receipt/active/review/released counts, selected-lab detail | Open scoped lab work when authorized |
| Project manager | Project progress | Assigned project requests, delays and released reports | Open matching project records |
| Audit user | Quality review | Evidence gaps, failed/pending QC, amendments, controlled report history | Inspect evidence read-only |
| Surveyor | Field samples | Own/permitted registrations, missing provenance, handed-over samples and lab receipts | Continue field record / inspect receipt |
| External viewer | My results | Current published reports for specifically authorized samples/projects | Open/download a released report |
| Viewer | Sample tracking | Permitted sample progress and reports; restricted details omitted | View sample status |
| Super administrator | System overview | Configuration/access/integration issues and lab navigation | Inspect configuration issue / choose lab |

The role switcher in the prototype is a design-review tool, never a production impersonation control. Account capability and resource scope determine actual actions. National users retain their existing legitimate approval/assignment privileges after selecting an authorized lab; a project manager is not promoted into lab approval. An audit role remains read-only despite the current broad GENERATE_REPORT permission: generation must not masquerade as a read-only PDF download. Reconcile that policy/command before exposing it.

## Design specification

- Existing SoilFER branding, white or dark neutral surfaces, one restrained green accent. Red only for a real blocking exception. No gradient KPI tiles, pulse animations, hero illustrations, decorative donut charts or “command centre” language.
- Header: role-specific title, readable lab/project scope, local date and an honest update time. One main action at the right. Authorized multi-scope users can change scope; single-lab staff see a fixed label.
- At most four compact summary selectors. Labels include units where ambiguous (“40 determinations”, “6 samples”, “2 runs”). Selecting a summary updates the main queue or navigates to an identical server-filtered list.
- The main panel is a table at desktop widths; method groups for bench work, decisions for managers, requests for reception. Default columns: identity/group, context, reason or progress, owner/time, next action. Avoid simultaneous giant sample and analysis lists.
- A secondary panel contains only relevant handoff/continuation information. No employee productivity ranking or made-up capacity percentages. Forty pH determinations do not represent the same effort as forty texture determinations.
- Sample title: established unique lab sample number from canonical identity projection; field ID secondary; project and laboratory context when needed. UUID stays in URLs/technical detail. Never display a lab code such as GTM-LAB1 as if it were the sample's accession number.
- Parameter names from the current scoped catalogue; method name/revision beneath. Stored codes remain stable keys. “Drying” and “Sample preparation” open checklists; “Particle-size distribution” opens the sand/silt/clay group and calculated class; “MIR spectroscopy” opens spectral acquisition/import. Home offers no numerical substitute for these tasks.
- Rows are 52–64px for normal work lists, text 14–16px; action targets 40–44px. Visible focus, real labels, text plus color for state, semantic table headings. Avoid clickable whole rows swallowing child links. Light/dark tokens, zoom and reduced-motion support.
- Search matches human sample IDs, field IDs, parameter/method names. Stable sort: actionable severity based on actual rules, then due date when recorded, oldest pending timestamp, immutable ID. Never fabricate a due date from age. Show “Waiting 2 days”, not “Overdue”, without an agreed deadline.
- On narrow screens stack columns as labelled rows, retain the main action, and put optional metadata in the detail drawer. At 200% zoom no clipped buttons. Large bench worksheets remain in Workbench, not a cramped dashboard table.
- Empty means a successful query with zero eligible rows. Loading and failures never become zero. A failed refresh retains same-scope data marked “Could not refresh — showing 09:32”; first-load failure shows retry. Scope change removes prior data immediately.

## Laboratory workflow and scientific boundaries

GLOSOLAN emphasizes standardized procedures, quality control, spectroscopy and equipment practices; those are the relevant basis for method-based work and visible QC dependencies here. The dashboard must use the lab's actual configured SOP and acceptance criteria, not introduce universal drying temperatures, spectral formats, QC tolerances or texture thresholds. [FAO GLOSOLAN](https://www.fao.org/global-soil-partnership/glosolan/en/).

Forty-sample example: a technician sees “pH in water • SOP revision 3 • 40 ready determinations”, can open a worksheet, and continues an existing run if one exists. Run capacity and QC positions come from the instrument/method configuration; forty analytical samples may require more than forty rack positions. Completed preparation unlocks only applicable methods. A pending gate, hold, missing assignment, unsupported method, invalid instrument or unresolved QC cannot be made ready by a dashboard button. A partial draft is not a submitted result. Submitted work is read-only until an authorized return/amendment creates the correct editable attempt.

Texture remains one ordered/reportable group with its component evidence; do not triple task counts because sand, silt and clay are three values. Spectral files/replicates, predicted properties and validated reference measurements remain distinguishable. Derived texture class and model outputs are not new independently assigned work unless the catalogue actually orders such work. Reuse the existing v3 catalogue and spectral rules; do not reimplement scientific calculations in the dashboard.

Keyboard behavior, unobscured focus and accessible status announcements follow WCAG 2.2; this is a design/testing target, not a certification claim. [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/).

## Implementation sequence and exact changes

### 0 — Reconcile the live branch and reception correction

Record starting commit and dirty files, inspect Antigravity's own pending changes, finish/review the bounded reception correction. Recheck D13's overwritten OR and D14's null-drying assumption. Preserve changes rather than restoring snapshots. Create a focused new branch/PR for this package after reception integration where possible. Capture sanitized baseline dashboard responses and known failing tests in an isolated database. Do not seed demonstration data in production.

### 1 — Shared scope, eligibility and definitions

Create `server/services/dashboardScope.js` with a resolved actor scope and validated selected filters. Use existing security primitives, repairing project/country semantics explicitly with tests. All selected filters narrow authorized scope using AND. Distinguish read permission from the authority to act in a lab. No absent lab fallback to global access.

Extract reusable pure eligibility primitives into `server/services/workEligibility.js` (or an existing suitable service), called by dashboard selectors, workbench, sample projection and mutation validators. Compose sample custody/acceptance, active order/attempt, assignment, method applicability, gate evidence, equipment and QC. Pass explicit requirements; absence of data means unknown/blocked, not pass. Do not call the full heavy sample workspace once per row. Inventory existing conflicting rules before replacement and retain their stricter safeguards until resolved by tests.

Add a centralized sample identity projection and catalogue display-name lookup shared with current components. Do not rename database identifiers. Resolve historical status aliases only in a read adapter; do not manufacture completion events for historical data.

### 2 — A small read API and queue selectors

Move dashboard query logic out of `server/app.js` into `server/controllers/dashboardController.js` and `server/services/dashboardService.js`. Add `/api/dashboard/home` and `/api/dashboard/queues/:queueKey`, both authenticated and scope checked. The new route names/contracts are proposed, not currently implemented. Keep `/api/dashboard/live` as a temporary compatibility adapter for ManagerQueue and other consumers until all are migrated. Inventory `/api/dashboard` too and retire only after references are removed.

Define named selectors for reception, bench, review, release, scope oversight, quality and administration. Each selector owns entity unit, eligibility, count and paginated query. Use set-based database aggregates and limited relation projection; no per-sample HTTP/Prisma loops and no full fieldMetadata, spectra arrays, private drafts or report blobs in dashboard responses. Share exact predicates with drilldowns. Add indexes only where measured query plans justify them.

Read count and page in a consistent short transaction/snapshot. Pagination metadata represents the whole grouped query. The next request may have a new asOf; explain changed records instead of promising permanently frozen totals. Keep current and historical totals separate. Missing timezone is a visible configuration issue; date-dependent metrics are unavailable until resolved, or explicitly labelled UTC if the application intentionally supports that fallback.

### 3 — Shared presentation, with role-specific composition

Replace internals of `Dashboard.jsx` and the four dashboard components using a small `DashboardShell`, `QueueSummary`, `WorkQueue`, `UpdateStatus`, `ScopeSelector`, `EmptyState` and `DashboardLink` set. Add the missing surveyor, audit, external and system views; master/project/viewer can reuse a scoped tracking composition with different columns/capabilities. Do not introduce a generic customizable widget builder or a new UI framework.

Replace `/qa` placeholder with the audited quality view, guarded correctly. Unify sidebar/route visibility with server-granted capabilities, not a fresh copy of role arrays. Retain existing global header and brand assets. Add strings to the existing language system for all supported locales; avoid newly hardcoded English fallbacks disguised as completed translations.

### 4 — Wire every destination and refresh path

Implement the route table in `contracts.md`. Extend WorkbenchShell deep links for method revision/run/queue, ManagerQueue for shared selectors and valid URL back/forward handling, Reception for immutable sample/draft resolution, Samples for scoped named selectors, ResultReports for report/filter deep links. Sample detail should consume a valid review/history/results tab; current controls remain intact. Keep obsolete aliases as tested redirects preserving intent.

Recheck access at each destination and every associated API/PDF/download; a filtered dashboard cannot secure an unfiltered report endpoint. Dashboard navigation does not submit, approve, receive or publish. Command endpoints re-evaluate eligibility, authority and version in one transaction; stale candidates return a conflict and an explanatory refreshed state.

Replace duplicated LiveBadge behavior with real availability. Scope-key cache includes actor, role, grants, selected lab/project and permissions revision. Abort/discard old requests. Register invalidation for receipt/draft/acceptance, assignments, gates, draft/completion/submission/review, QC, spectra, amendments/reports, catalogue/equipment and permission changes. Use existing event names where present, add missing producers after commit; send entity keys only to authorized subscribers. Poll visible dashboards every 30 seconds initially, immediate refresh on focus/action/invalidation, backoff when offline. Tune measured load; do not continuously reload inactive tabs.

### 5 — Acceptance and controlled release

Implement the meaningful tests in `acceptance.md` against synthetic data, not checks that merely mirror UI markup. Run existing workflow/RBAC/catalogue/reception suites and client build. Perform actual browser journeys for every role and state, including 40 samples, second lab, keyboard, narrow layout, interrupted connection and two sessions. Capture sanitized screenshots, failing/passing assertions and exact candidate commit.

Roll out reception/technician/manager first after shared contracts pass, then oversight/audit/external/system/field views. All ten roles must be completed for the package to be marked done. Feature flags may sequence exposure, but must not fall back to a known unsafe dashboard; show a scoped unavailable screen if necessary. No broad data backfill, database shrink, destructive migration or QC reset in this project.

Use existing release practice: push all intended application/asset/test changes to GitHub, PR and successful CI for exact candidate, fresh database plus file backup, rehearsed compatible image, deploy immutable image, verify health and read-only role journeys, record commit/image/backup and rollback procedure. If adding a schema migration, test apply-twice and restore compatibility; prefer additive changes. Perform issue reconciliation last: close only cases with actual evidence, keep/reopen outstanding defects. Never commit credentials, user session tokens, production records, node_modules or backup databases.

## Required implementation evidence

Produce a requirement ledger linking D01–D26 and acceptance scenarios to source changes, tests, UI evidence and deployment receipt. Status options: not started, implemented, verified, blocked; never “verified” based only on a clean build. Measure response/query cost with a realistic synthetic dataset above the old 200/500 limits. Target home response under 500ms p95 in the stated test environment and payload under 100KB; these are engineering budgets to measure, not promised production timings. If an essential policy remains unknown, report that precise decision without claiming the whole package done.
