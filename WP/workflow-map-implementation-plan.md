# SoilFER LIMS — Workflow map redesign implementation plan

Prepared 5 September 2026. Scope: recommendation and sketches only.

Reviewed the deployed [S002 workflow map](https://lims.yigini.net/samples/5e2dd71d-1708-482e-a74e-8bfed3a334a1/map), its Spectral Lab and QA drawers, and the local implementation. No application files were edited and no workflow operation was submitted. Sketches are isolated from the application, contain no connection to production, and illustrate the observed snapshot rather than live data. Local code observations are implementation evidence, not proof that every local revision is deployed.

## 1. Recommended outcome

Make this page an operational map that answers five questions immediately: where work is happening, what is ready, what is blocked, who can resolve it, and what happens next.

Use one coherent interface with three synchronized views:

- **Overview:** relevant stages and parallel laboratory branches, aggregated for quick reading.
- **Dependencies:** the selected work item, its actual prerequisites, resource checks and downstream consequences.
- **Analysis list:** every assigned task with sortable state, owner, readiness, result/review state and due date.

Keep the existing SoilFER navigation and recognizable visual identity. Use a quieter surface, readable typography, restrained blue for active work, green for completed work, amber for warnings and red for actual blocks. Status always has text and a symbol. The default view should not require zooming to read operating information.

## 2. Evidence from this sample

| Observed on the deployed page | Practical consequence | Proposed correction |
|---|---|---|
| Preparation is 2/2 complete, yet the header says “Next: Complete Drying” | The recommended action is unreliable | Derive guidance from executable work-item conditions, with its owner and reason |
| Top-level completion is 3/4; spectral is 1/2; QA is 0/2 | Different denominators all look like the same measure | Label preparation completion, tests performed and results approved separately |
| MIR is active; Vis-NIR is done with “Spectrum Uploaded (WARN)” | A completed task can still carry quality information | Preserve the warning beside the execution status and in review context; do not interpret WARN as batch QC_FAIL |
| Empty physical and chemical stations remain on the map | Irrelevant branches consume space and imply work may be expected | Collapse unrequested stages into an optional “Not required” group |
| Fit-to-view makes node labels very small | Operators must zoom before reading | Compact, readable stage summaries; expand analyses deliberately |
| The spectral drawer overlays and darkens the map | The user loses the connection they are investigating | Dock the inspector alongside the graph at wide widths |
| QA shows two queued items but its drawer says the station has no active tests/history | Counts lack an explanation | Show which results are unsubmitted, awaiting review or decided, including linked submissions |

The local code explains the drying contradiction: an ACCEPTED sample takes a branch that recommends drying even when the drying item is complete. A pure in-memory fixture reproduced this. The proper fix is to separate stored sample lifecycle from operational readiness; do not simply rename the badge or rewrite production sample states.

## 3. Page structure and sketches

### Desktop

1. Compact breadcrumb and identity: S002, project, sample type and lifecycle.
2. One operating summary: active work, responsible person, genuine blockers and next eligible action. Keep age separate from SLA risk; show an SLA assessment only when a configured target and clock basis exist.
3. View switch: Overview / Dependencies / Analysis list. All preserve the selected work item.
4. Dominant graph with a docked inspector. At wide application widths, target an inspector around 320–360 px, with a readable remaining canvas. Below that fit threshold, put details below the graph or use a deliberate details view.
5. Quiet freshness label: updated time, reconnecting or stale. Never claim “Live” solely because a refresh button exists.

```text
S002 / Workflow                  Preparation 2/2 · Tests 1/2 · Approved 0/2
MIR in progress · marco          Next eligible action + reason

[Overview] [Dependencies] [Analysis list]

RECEPTION                         SELECTED WORK / STAGE
    ↓                             State · owner · age
PREPARATION → SPECTRAL → REVIEW    Prerequisites and resource checks
                         ↓        Why waiting / what it unlocks
                 ARCHIVE OR       Linked submission, QC, result
                   DISPOSE        Recent relevant activity
```

### Dependency detail

```text
                                      Equipment and method checks
                                                 ↓
Accepted → Drying → Preparation ──┬── MIR ──→ Submission ──→ MIR decision
                                 └── Vis-NIR → Submission → Vis-NIR decision
                                                           ↑
                                                 QC batch acceptance gate

Review request for reanalysis ──→ affected work item, with reason/history
All required decisions satisfied + sample approval ──→ Archive OR Dispose

Report = linked output today; any mandatory release gate is a policy change.
```

A prerequisite arrow and a future submission handoff must have distinct labels/styles. A return path for reanalysis is not an ordinary prerequisite: it records a new iteration of work. Avoid creating a cycle in the prerequisite model simply to draw this path.

### Tablet and phone

Use a list-first experience on small screens. Preserve next action, blocker count and owner. Each task opens an accessible detail screen that includes prerequisites and downstream effects. Do not shrink a desktop graph into a tiny image. Show explicit relationship text in the list; vertical stacking must never imply that parallel tests are sequential.

The accompanying interactive sketch demonstrates the overview, dependency detail and complete task list using S002. It deliberately does not simulate unverified production equipment or submission states.

## 4. Complete dependency coverage

| Relationship | Status in current implementation | Required map behavior |
|---|---|---|
| Accepted intake → drying | Enforced execution condition | Show intake readiness and reason if unmet |
| Drying → preparation | Enforced; milling/sieving is the preparation task | Draw actual prerequisite, with its state |
| Preparation → analyses | Enforced for ordinary analyses, including spectroscopy | Split into independent assigned analyses; show parallel active work |
| Catalogue-specific analysis prerequisites | Engine supports configurable prerequisite codes | Load persisted definitions reliably; resolve actual item IDs and reject invalid references/cycles |
| Instrument → execution | Service/calibration/verification/method eligibility and required selection checks exist | Expose selected instrument, eligibility, blocking reason, evidence timestamp and permitted destination |
| Completed task → submission | Partial and full submission paths exist | Distinguish completed-but-unsubmitted from awaiting-review; show partial review alongside ongoing work |
| QC batch → acceptance | QC_FAIL prevents acceptance | Link the batch and reason; distinguish QC failure from a spectrum-upload warning |
| Review → accept / reanalysis / waive | Implemented; some decisions require a reason | Display decision, reviewer, rationale and affected work |
| Reanalysis → execution | Current work item is updated with history | Show iteration/reason from available evidence; immutable attempt lineage would be an explicit data-model extension |
| Approval → archive OR disposal | Implemented gates and mutual exclusion | Show eligibility, then the created closure task, then actual terminal state |
| Report generation → published report | No equivalent approval/QC gate found in generator | Link reporting as an output; separately decide draft/published/released semantics before adding release restrictions |
| Sample/submission/task → audit event | Evidence exists but current drawer filtering omits events | Join by explicit entity relationships and show chronological, stage-relevant activity |
| Consumables, instrument bookings, capacity, custody or aliquot lineage | Not verified as enforced dependencies in this audit | Include only after modelling and validating their real relationship; never draw invented hard gates |

Do not turn every related entity into a blocking dependency. Model **hard prerequisite**, **resource eligibility**, **handoff**, **review decision**, **reanalysis**, **closure alternative**, and **related evidence/output** separately.

The complete view must retain all configured relationships. The overview may aggregate them, but must display hidden dependency counts and allow expansion. Selecting an edge should explain its requirement and whether it is satisfied. Selecting a blocked item should reveal the root cause and affected downstream work without opening several pages.

## 5. Establish one trustworthy data contract

Extend the existing `/api/samples/:id/map-state` response rather than building another presentation-only workflow engine.

Recommended contract:

- Snapshot metadata: schema version, generated time, revision, completeness, and freshness.
- Sample context: stored lifecycle, operational state, applicable closure route and related report links.
- Stable nodes: stage, work item, submission/review gate and resource requirement where relevant.
- Explicit edges: source, destination, relationship type, requirement, satisfaction state, evidence source and affected work-item IDs.
- Per-item readiness: not required, unassigned, queued, ready, running, blocked, execution complete, submitted, accepted, waived, reanalysis requested or terminal as applicable.
- Separate execution state, review state, readiness and quality flags. A warning need not overwrite a completed execution state.
- Owner and assignee metadata, configured target date and clock basis when available.
- Blockers: stable code, plain-language reason, source record, resolver role, direct/indirect effect and resolution destination.
- Allowed actions: action identifier, permission, eligible/disabled state and reason, destination and revision used for evaluation.
- Reconciled counters: preparation, analytical execution, submissions and review decisions; show waived items explicitly in numerator/denominator rules.
- Relevant audit events with links and pagination.

Compute blockers before stage status. Retain all active rooms. Use the same eligibility functions in map-state and mutation endpoints; the server must revalidate permission and preconditions whenever an action is executed.

A resource readiness failure is not an ordinary data-fetch failure. If a resource service cannot be read, show “Readiness unavailable” rather than clearing its blocker or displaying a healthy state.

## 6. Implementation work packages

Estimates below are planning estimates, not a delivery commitment. Allow approximately 20–28 engineering/QA working days, typically 4–6 calendar weeks for a small team with parallel frontend/backend work and timely lab review. Confirm scope after contract fixtures and policy decisions.

| Package | Scope and concrete exit condition | Estimate |
|---|---|---|
| A. Truth and policy | Agree state/edge dictionary and denominators; reproduce S002; reconcile approval/waiver/closure rules; remove fabricated fallback records; fix blocker ordering | 3–4 days |
| B. Contract and dependencies | Extend map-state with actual item edges, submissions, QC and equipment checks; load persistent catalogue dependencies; add contract/scenario tests | 4–6 days |
| C. Interface | Implement overview, dependency focus, complete list and docked inspector; replace fixed edges and client heuristics; add responsive states | 5–7 days |
| D. Integration | Contextual links into workbench/review; freshness and reconnect behavior; relevant audit trail; print summary; locale coverage | 3–4 days |
| E. Acceptance and rollout | Lab usability sessions, permission/scenario tests, accessibility, visual and performance checks; staged feature-flag rollout and rollback drill | 5–7 days |

Critical sequence: A → B → C integration → D → E. Visual component work can start after the contract draft, but final readiness semantics depend on A/B. An enforced report-release workflow, immutable reanalysis attempts, or new inventory/booking integration would be separately estimated.

### Main implementation touchpoints

- `server/utils/workflowEngine.js`: canonical readiness, blockers, actions, aggregation and graph generation.
- `server/controllers/sampleController.js`: enriched map-state and consistent approval/closure eligibility.
- `server/controllers/workItemController.js`: shared preparation and equipment execution checks.
- `server/controllers/submissionController.js`: shared submission, QC and decision conditions.
- `server/controllers/reportController.js`: only if the report-release policy is explicitly expanded.
- `client/src/hooks/useSampleWorkflow.js`: one coherent payload, no fabricated fallback, background freshness and recovery.
- `client/src/pages/SampleWorkflowMap.jsx`: synchronized views, selection, routing and measured graph layout.
- `client/src/components/workflow/`: readable nodes, typed edges, operational summary, inspector and list.
- `client/src/styles/workflow-map-v2.css`: scoped visual tokens, responsive behavior, focus and reduced motion.

Reuse React, the installed React Flow, existing navigation and icon system. Use deterministic layout for the simple overview. Evaluate ELK only for expanded dependency graphs if its routing/port handling materially reduces crossings. Keep the layout computation off the interaction path for large graphs and do not rearrange every node during a status update. React Flow documents the tradeoffs between [Dagre and ELK](https://reactflow.dev/learn/layouting/layouting) and offers [built-in accessibility configuration](https://reactflow.dev/learn/advanced-use/accessibility).

## 7. Practical interaction rules

- A stage card shows its name, state, meaningful counts, owner summary and most important blocker. Keep full analysis names and evidence in the inspector/list.
- Sort previews by actual operational priority: blockers and failed QC, ready review, active work, then completed work. Never select the first three records merely by array order.
- The dependency view highlights upstream prerequisites and downstream impact. Keep unrelated branches visible but quiet; the complete graph remains accessible.
- Provide fit, zoom and optional minimap for genuinely large graphs. Show a minimap only when it helps navigation. Preserve readable node text instead of aggressive fit-to-view scaling.
- Use a docked desktop inspector with Summary, Dependencies, Work and Activity sections. Retain sample/stage/item context in navigable URLs and destination pages.
- Existing workbench/review screens perform operational changes in the first release. Contextual map actions explain eligibility and navigate there. Avoid creating a second result-entry workflow inside the map.
- Background refresh preserves selection, viewport, expanded branches, list filters and detail scroll. On deleted or inaccessible selections, explain the change and return to a valid context.
- Error states include unavailable, not found, unauthorized, stale, incomplete dependencies and empty workflow. Missing data never becomes a fabricated sample or a green status.
- Render valid zero-valued results, units and long names/notes correctly.
- Print a readable summary with identity, snapshot time, state, prerequisites and unresolved issues; do not merely print a zoomed canvas.

## 8. Release gates: a credible interpretation of “no defects”

Literal zero defects cannot be guaranteed. The release target is no known critical/high-severity defects, complete agreed scenario coverage and signed-off visual/operational acceptance.

### Workflow correctness

- S002 fixture: completed preparation never produces “Complete Drying”; MIR remains active; Vis-NIR warning remains visible; task completion is distinct from review approval.
- Parallel physical/chemical/spectral work shows every active branch, while unrequested branches are not shown as pending.
- Failed drying/preparation and multi-step prerequisites expose the correct root cause and all affected descendants.
- Instrument out of service, overdue calibration/verification, unsuitable method and missing required selection agree with workbench enforcement.
- Partial submission/review proceeds while other work continues; full submission coverage is explained correctly.
- QC_FAIL, waiver, reanalysis, accepted decisions and approval/closure rules are consistent across map, API and workbench.
- Archive/dispose exclusivity, closure task progress, terminal states, reopen/rollback and newly added analyses have explicit fixtures.
- Catalogue changes and server restarts preserve dependencies; cycles, missing references and unsupported conditions are visible errors.
- All counts reconcile with a documented waiver and reanalysis policy.
- Failed map-state or sample requests never produce mock production records.

### Usability and accessibility

- Test at 1440×900, 1366×768, 1024×768 and 390×844, with light/dark appearance, 200% browser zoom and long translated labels.
- Operators can identify active work, the root blocker and the responsible person in a short lab usability exercise; use a proposed five-second triage target and measure it.
- Keyboard users can change views, select an item, inspect dependencies and return to their prior focus. Narrow-screen modal details support Escape, focus entry/trap/restore and correct background behavior.
- Status and connectors do not depend on color alone; essential labels remain readable, focus is visible and touch targets are usable.
- Target [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/), including appropriate contrast and minimum target size; use roughly 44 px touch controls where space allows. Test reduced motion and screen-reader announcements.

### Scale and resilience

- Exercise 1, 20, 100 and 500 assigned items, including deeply connected and high fan-out fixtures.
- On an agreed baseline device, target selection/filter feedback under 200 ms after data is loaded; establish and measure payload and initial-load budgets during package A.
- Avoid unnecessary full graph relayout on status changes. Use list virtualization or a worker only when profiling demonstrates the need.
- Test network failure/reconnect, stale snapshots, revoked permissions, concurrent workflow changes and resource data unavailable.
- Automated contract/scenario checks plus manual visual, keyboard and lab task review are all required. Visual polish alone is insufficient.

## 9. Rollout and decisions to settle

Release behind a feature flag, first to an internal lab cohort. Compare readiness and next-action output against the enforced workbench/review behavior. Fix mismatches before broad release. Keep a quick route to the existing page during the pilot, monitor errors and mismatches, and roll back the new view independently of stored workflow data.

Resolve these in package A rather than silently changing policy:

1. What exactly does sample APPROVED require, and how do waived tasks count? Current endpoints are not fully aligned.
2. Should report generation create a draft, and what conditions authorize release? This is an explicit policy/backend extension.
3. Which SLA target, working calendar and pause conditions determine warnings?
4. Are reanalysis attempts required as immutable records, or is the existing history sufficient for the first release?
5. Which additional resource/custody links are real enforced prerequisites, and which are informational?

## 10. Local evidence index

- [Existing February implementation plan](C:/Users/yigin/Documents/soilfer-lims/docs/reports/workflow-map-comprehensive-implementation-plan-2026-02-25.md) — useful prior scope, but current defects need concrete fixtures.
- [Fabricated request fallback](C:/Users/yigin/Documents/soilfer-lims/client/src/hooks/useSampleWorkflow.js:20).
- [Single-current-room projection](C:/Users/yigin/Documents/soilfer-lims/client/src/pages/SampleWorkflowMap.jsx:48).
- [Fixed graph construction](C:/Users/yigin/Documents/soilfer-lims/client/src/pages/SampleWorkflowMap.jsx:237).
- [Progress calculation](C:/Users/yigin/Documents/soilfer-lims/client/src/components/workflow/WorkflowTopStrip.jsx:47).
- [QA denominator](C:/Users/yigin/Documents/soilfer-lims/client/src/utils/workflowMapper.js:613).
- [Lifecycle short circuit](C:/Users/yigin/Documents/soilfer-lims/server/utils/workflowEngine.js:323) and [next-action branch](C:/Users/yigin/Documents/soilfer-lims/server/utils/workflowEngine.js:415).
- [Stage/blocker ordering](C:/Users/yigin/Documents/soilfer-lims/server/utils/workflowEngine.js:558).
- [Map-state endpoint](C:/Users/yigin/Documents/soilfer-lims/server/controllers/sampleController.js:1157).
- [Equipment and preparation enforcement](C:/Users/yigin/Documents/soilfer-lims/server/controllers/workItemController.js:865).
- [Submission paths](C:/Users/yigin/Documents/soilfer-lims/server/controllers/submissionController.js:31) and [QC/review decisions](C:/Users/yigin/Documents/soilfer-lims/server/controllers/submissionController.js:316).
- [Approval](C:/Users/yigin/Documents/soilfer-lims/server/controllers/sampleController.js:1788), [closure](C:/Users/yigin/Documents/soilfer-lims/server/controllers/sampleController.js:1903) and [report generation](C:/Users/yigin/Documents/soilfer-lims/server/controllers/reportController.js:26).
- [Current drawer event filtering](C:/Users/yigin/Documents/soilfer-lims/client/src/components/workflow/WorkflowDetailDrawer.jsx:30) and [existing sample-page freshness pattern](C:/Users/yigin/Documents/soilfer-lims/client/src/pages/SampleDetail.jsx:127).

These references document the review; none of the linked application files were edited for this proposal.
