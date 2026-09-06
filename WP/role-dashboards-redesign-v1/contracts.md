# Dashboard data, scope and navigation contracts

Proposed implementation contract. New field/route names below must be implemented at both ends and tested; they are not descriptions of already supported APIs.

## Scope and capability contract

Resolve the user from the authenticated session, never a role/user supplied by the browser. Produce an explicit scope with permitted labs, countries and projects, normalized IDs, a display label, timezone context and permission revision. An optional selected lab/project narrows it. No “All labs” option for ordinary lab staff. Read grants may cover a national/project portfolio; command authority must still be checked for the actual resource and action.

Policy by role:

- SAMPLE_RECEPTION/LAB_MANAGER: operational queues belong to their assigned/authorized lab. Country-level expected field records can be searchable for intake only under the existing approved intake policy; label this broader expected-record scope separately. They must not inflate lab processing queues.
- LAB_TECHNICIAN: own currently authorized assignments in the permitted lab(s); not all country work and not a stale former assignment. Delegated work must be explicitly authorized. Workbench/detail/drilldown use the same rule.
- MASTER_USER: granted national/lab scope, selected lab required for lab commands. Preserve registry authority where controllers can securely enforce it; do not assume global access.
- PROJECT_MANAGER: explicitly assigned projects, with country restrictions if applicable. Project identity/grants must be resolved, not inferred from a text filter. No grants => no records.
- SURVEYOR: own/permitted field registrations and custody tracking in authorized projects. The current application has no proven standalone field editor route: wire the existing sample registration/provenance screen only after checking CREATE_SAMPLE and object ownership; otherwise hide the continuation action and provide read-only tracking plus an access explanation.
- AUDIT_USER: authorized audit scope, read-only current and historical evidence; no implicit review disposition, edit, release or external sharing. Internal details stay inside this scope.
- EXTERNAL_VIEWER: explicit project/sample/report grants and current published output only. No internal drafts, comments, staff workload, raw spectrum, failed QC notes or audit feeds by default. Direct report/PDF/spectral/sample routes must enforce the same restriction.
- VIEWER: scoped progress; current published output only unless an explicit internal read grant already exists. No mutation actions.
- SUPER_ADMIN: global administration; explicitly selected lab for operational view. Global totals are clearly labelled; never silently combine with a single-lab title.

Unknown/legacy roles are not mapped to privileged views. Inventory COUNTRY_ADMIN data and define a reviewed compatibility mapping only if needed. Existing role definitions, client menu lists and endpoint checks disagree; resolve them once rather than introducing another table of independent permissions.

Compose queries as `AND: [authorizedScope, queueCriteria, selectedFilters]`. Do not spread an OR-based scope then overwrite OR. Project/country/lab grant logic must be documented per role and tested including their intersections. Authorization constraints also apply to counts, previews, search suggestions, all pages, exports, audit details and event subscriptions.

## Home response

`GET /api/dashboard/home?labId=...&projectId=...`

```json
{
  "schemaVersion": 1,
  "asOf": "2026-09-06T15:32:00Z",
  "scope": {"key":"opaque-server-key","label":"Demonstration laboratory","timezone":"America/Guatemala","localDate":"2026-09-06"},
  "view": "technician",
  "capabilities": {"openWorkbench":true,"reviewResults":false},
  "recommendedQueue": "bench.continue",
  "metrics": [
    {"key":"bench.ready","value":40,"unit":"determinations","availability":"available","queueKey":"bench.ready"},
    {"key":"bench.continue","value":1,"unit":"runs","availability":"available","queueKey":"bench.continue"}
  ],
  "preview": {"queueKey":"bench.continue","unit":"runs","rows":[{"key":"demo-run-1","runId":"demo-run-1","displayName":"pH in water","determinationCount":40}],"total":1,"page":1,"pageSize":10,"hasMore":false},
  "sections": {"queue":"available","activity":"unavailable"}
}
```

This is synthetic example data. `value:null` + `unavailable` means unknown, not zero. A count and preview from the same selector must reconcile. Each response is a short consistent database read; do not keep a database transaction alive between requests. Metrics may count determinations while preview groups by method; return `totalGroups` and `totalDeterminations` explicitly. Never call the number of visible preview rows the total workload. Continue-run and ready-work counts can describe overlapping work; they are navigation views, not additive pipeline stages.

`GET /api/dashboard/queues/:queueKey?page=1&pageSize=25&...` returns authorized rows, total matching groups/entities, count unit, asOf and validated filter context. Cap pageSize (e.g.100), parameterize queries, reject unknown selectors and unauthorized scope. Search is part of the same selector. Sort/group before pagination. Include an immutable row key and optional version, display identity, parameter/method name/revision, applicability/blockers, relevant dates, action kind and target IDs. No arbitrary server-provided external URL: a client route registry maps allowlisted action kinds to internal destinations.

## Metric dictionary

All definitions apply after actor scope and current-order/attempt filtering unless explicitly historical. “Today” is `[startOfLocalDay, startOfNextLocalDay)` converted with the actual IANA timezone, including daylight-saving transitions; not 24 hours added to UTC midnight. For multi-lab views use an explicitly selected reporting timezone or per-lab local days, labelled accordingly; don't silently sum different date windows.

| Queue/metric | Unit and predicate | Exclusions / exact continuation |
|---|---|---|
| reception.expected | Unique field/sample records awaiting physical receipt, authorized for this intake scope | Not a drying/prep workload; no invented scheduled arrival. Show consignment ETA only when recorded. |
| reception.drafts | Unique editable draft samples belonging to current officer or explicitly permitted shared draft scope | Shared/own distinction visible. Advanced/locked sample is not resumable even if a draft object remains. |
| reception.attention | Unique unresolved intake exceptions the actor can inspect/resolve | A completed rejection is history, not forever “needs attention”; derive unresolved state from actual disposition/custody evidence. |
| reception.receivedToday | Unique samples with a real physical receipt in the defined local day | Separate accepted/rejected/pending acceptance breakdown. Draft updates and field registration dates are not receipt. Reversals need factual current/historical semantics. |
| bench.continue | Owned open runs with saved/in-progress work; display run + determination counts | Exclude closed/sealed/superseded attempts; saved result values private. |
| bench.ready | Current assigned work tasks with safe entry allowed by method/gate/sample policy; analytical rows count determinations, operational rows count checklists | When combined, label the summary tasks, never call a drying checklist an analytical determination. Group parameter + methodologyId + immutable revision + lab + input type; separate different existing runs. An eligible instrument may still need selection: label “Select instrument”, not “Ready to submit”. |
| bench.returned | Current assigned attempts returned with review reason | Preserve previous sealed evidence; returned attempt must exist before editing. Count once per active determination. |
| bench.waiting | Assigned open tasks with blockers (reception, gate, hold, instrument, configuration) | Show reason and responsible role; no enabled result-entry action. Operational gates are their own tasks, not numeric results. Label mixed totals tasks and analytical/operational row units separately. |
| bench.toSubmit | Completed/recorded current determinations whose evidence validates for submission | Saved incomplete drafts not included. Explicit selection and review in Workbench. |
| bench.submittedToday | Current submission events made by actor within local day; unit determinations, or submissions if labelled | Deduplicate attempts per chosen definition; retained after manager acceptance. Historical resubmissions shown separately, not inflated throughput. |
| manager.exceptions | Unique actionable exception entities (e.g. QC batch, sample hold, missing evidence) | Count batches once, show affected samples/analyses separately. No duplicate banners for each fraction/result. |
| manager.review | Pending review submission groups with current submitted work and accessible review authority | Queue may contain “QC pending — inspect” but must distinguish from review-ready decisions; no approve control when blocked. Aggregate by sample/request before paging if that's the displayed unit. |
| manager.finalApproval | Unique samples passing shared final-approval eligibility | Require valid current order, required work accepted or formally omitted, evidence, resolved applicable QC and no hold/history gap. Zero-work intake cannot qualify; all-omitted orders require an explicit authorized disposition, not a normal result approval. |
| manager.assign | Unassigned current ordered tasks at the assigned lab (determinations or operational checklists, explicitly labelled per group) | Include count of blocked prerequisites for planning, but assignment does not override execution readiness. No expected-record defaults. |
| manager.intake | Physically received samples awaiting acceptance/disposition | EXPECTED/COLLECTED registration alone is not physical receipt. |
| lab.processing | Unique physically received/accepted samples with active unfinished laboratory work | Exclude expected, drafts, closed/disposed; distinguish submitted and under review instead of guessing from gate flags. |
| lab.released | Unique samples with a current published report, plus report count where needed | Approval != publication; superseded/withdrawn reports do not count as current release. Historical published-today is separate event metric. |
| audit.exceptions | Deduplicated evidence/QC/history exceptions in audit scope | No fabricated audit case “acknowledgement” state; use existing issue records or computed facts with stable keys. |
| admin.configuration | Concrete configuration issues from existing validators and permitted scope | Method unavailable, no active operator assignment, missing timezone etc. Absence of telemetry != healthy. Never display secrets, backup paths or operational credentials. |

## Canonical eligibility result

Return separate facts: `visible`, `canOpen`, `canRecord`, `canSubmit`, `canReview`, `canFinalApprove`, `canPublish`, plus reason codes and readable localized text. “Ready” has an explicit target action. Readiness for entry does not imply readiness for submission or publication.

Inputs: actual receipt/acceptance, current order revision + selected method/revision, current work attempt, assignment, applicable gate evidence, instrument requirements/eligibility, complete scalar/group/spectral evidence, QC policy/disposition, hold/amendment state, actor permissions/resource scope. Missing values cannot become a scientific pass. Use immutable evidence/review versions to invalidate stale projections.

The mutation endpoint runs the same underlying evaluator in its transaction with current state/version. A dashboard asOf is informational, not a command token. If eligibility changed, return 409 (or existing equivalent typed error), explain the blocker and refresh; never silently accept obsolete authorization.

## Destination wiring

| Action | Destination | Current support / work needed |
|---|---|---|
| Open method work | `/workbench?analysis=<code>&methodologyId=<id>&revision=<revision>&queue=<key>` | Currently analysis/method aliases select an analysis only. Implement and validate exact method/revision/queue, state sync on same-route navigation. |
| Continue run | `/workbench?runId=<id>` | Implement run deep link; verify membership/lab, load saved rows and rack/QC context. Existing run id maps to Batch where applicable. |
| Inspect/enter one task | `/workbench?sampleId=<id>&analysis=<code>&workItemId=<id>` | Existing sampleId/analysis supported; add exact workItem context for attempts. |
| Manager decision | `/manager-queue?lane=intake|assign|review|approve` plus validated queue/filter | Existing lanes supported; replace old client-side filtering/pagination and eligibility. Add exception view only with a functioning receiver. |
| Review exact sample | `/samples/<id>?tab=review&submissionId=<id>` | Verify/add tab and submission selection in current sample workspace. Inspect permission, then explicit existing review action. |
| Resume draft / receive | `/reception?sampleId=<id>` | Add or verify immutable-ID lookup against current reception patch. Old originalId links resolve with project/lab context and ambiguity errors; don't take first search hit. |
| View matching records | `/samples?queue=<allowlisted-key>&projectId=<id>&labId=<id>` | Add selector/filter consumers and identical scope server-side; filters are narrowing hints. |
| Current report | `/result-reports?reportId=<id>` | Implement selected report loading; verify current published revision and permissions. Download uses protected report API, not share creation. |
| Browse released reports | `/result-reports?projectId=<id>&status=PUBLISHED` | Implement filters with scoped APIs; prevent arbitrary status query exposing drafts externally. |
| Inspect history | `/samples/<id>?tab=history` or `/admin/audit?...` | Validate supported tabs/entity filters, VIEW_AUDIT and object scope. |
| Equipment/configuration | `/equipment`, `/admin`, `/admin/methods`, `/admin/labs` | Only when permitted. Add exact resource focus or a working filter; fix mismatched route permission. |
| Field continuation | Existing sample registration/provenance destination after audit | No invented `/field` route; do not route surveyors to reception they cannot use. Read-only sample link is safe fallback while scoped editing is unavailable. |

Unknown/expired/foreign IDs show not found/access unavailable and a valid return link. URLs never perform mutations. Preserve filters and scroll when returning; never silently open the first row instead of the requested record.

## Defaults and refresh

Default is selected once after successful data load: valid explicit URL > valid intentional saved session choice for this actor/scope > first nonempty actionable lane > role's calm empty lane. Invalid/forbidden URL does not count as intentional. Keep explicit selection when its count becomes zero. Browser back/forward updates state. Do not jump tabs when a colleague submits new work; offer a count badge.

Priority orders: reception attention→drafts→expected→received; technician returned→continue→ready→toSubmit→waiting→submitted; manager exceptions→review→finalApproval→assign→intake; oversight exceptions→active→released; external released; field incomplete→awaitingReceipt→received; audit exceptions→history; admin configuration→labs. Configure alert severity from actual SOP/hold/QC conditions, never arbitrary “more than 10 samples”.

Event matrix: receipt/draft/intake acceptance affects reception/manager/tracking; assignment/gates affect bench/manager; draft affects owner; completion/submission affects bench/manager; review/QC affects bench/manager/audit/release; spectral review/trash affects related evidence and QC; report publish/supersede/amendment affects tracking/audit/released lists; catalogue/equipment affects readiness; access changes invalidate session scope immediately. Derive affected lab/project from resource, not only actor.labId. Notify with minimal invalidation keys after successful commit and re-authorize subscribers; reconnect performs a full scoped refresh. Missing lab never broadcasts private data to all users.
