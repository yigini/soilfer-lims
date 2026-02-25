# Workflow Map Comprehensive Implementation Plan (Functional + Visual)
## SoilFER LIMS

## 1. Purpose
This document consolidates the full implementation plan to make the Sample Workflow Map operationally accurate, visually clear, manager-friendly, and technician-actionable.

## 2. Scope
This plan covers workflow state correctness, map rendering logic, UI/UX behavior, visual design standards, role-based actions, accessibility, localization, real-time updates, QA validation, and release governance.

## 3. Primary Objective
The Workflow Map must answer these questions correctly in one screen:
1. Where is this sample right now?
2. What is blocked and why?
3. Who owns the next action?
4. What exact action should happen now?
5. What is the operational risk and SLA exposure?

## 4. Definition of Done
1. No contradictory map semantics for any lifecycle state.
2. Backend workflow contract is the only source of truth for lifecycle interpretation.
3. Parallel active labs are represented correctly.
4. Blocker and dependency reasons are explicit and auditable.
5. Terminal states (Archived, Disposed) are visually and functionally final.
6. The page is readable and usable on desktop and mobile, keyboard-accessible, and localized.

## 5. Current Problem Summary
1. Lifecycle interpretation is partially duplicated in frontend logic, creating drift risk.
2. Single-current-room assumptions hide parallel active work.
3. Some final-state visuals/actions can appear operationally active.
4. Blocked logic is incomplete relative to full dependency graph.
5. Detail drawer excludes important sample/submission context in some cases.
6. Visual hierarchy is crowded in top strip and inconsistent in icon language.
7. Motion density is high and not reduced-motion aware.
8. Canvas framing can clip or waste space on some viewports.

### 5.1 Current Realtime Status (As-Is)
1. The intended target is realtime updates for ongoing/completed/review changes.
2. The current map implementation is mostly fetch-on-load plus manual refresh, not true realtime.
3. Current behavior evidence:
- Data fetch executes on hook mount and explicit refetch only (`client/src/hooks/useSampleWorkflow.js`, `client/src/pages/SampleWorkflowMap.jsx`).
- Top strip provides manual refresh control as a primary update mechanism (`client/src/components/workflow/WorkflowTopStrip.jsx`).
- No websocket event subscription exists in the map page/hook path.
4. Existing realtime patterns already exist in other pages and can be reused for the map path (`client/src/pages/SampleDetail.jsx`).
5. Therefore, this implementation plan treats realtime subscription and stale-state handling as required, not optional.

## 6. Guiding Principles
1. Operational truth over decorative representation.
2. Deterministic rules over heuristic inference.
3. Attention-first UX for lab management.
4. Explainability for every badge, risk, and next action.
5. Progressive disclosure: summary first, detail on demand.

## 7. Functional Implementation Plan

### 7.1 Canonical Workflow Truth
1. Use backend workflow contract and workflow engine outputs as canonical lifecycle and transition truth.
2. Eliminate client-side lifecycle assumptions that can conflict with contract states.
3. Enforce one status dictionary for sample states and work-item states.
4. Normalize all incoming statuses at API boundary before map rendering.

### 7.2 Dedicated Map-State Data Contract
1. Provide a dedicated map payload containing:
- lifecycle state
- operational state
- active stages array
- stage summaries
- blocker graph (with dependency reason)
- owner and assignee metadata
- risk level and SLA metrics
- recommended next actions
- stage-attributed timeline events
2. Keep map UI as renderer of contract data, not lifecycle decision engine.
3. Include explicit flags for terminal states and closure type.

### 7.3 Complete Workflow Coverage
The implementation must support and validate all practical pathways:
1. Expected to received intake flow.
2. Received to accepted transition.
3. Gate handling for drying and preparation.
4. Drying failure and downstream lock.
5. Parallel analysis execution across labs.
6. Partial submission and full submission pathways.
7. Review decisions: accept, reanalysis, waive.
8. Reanalysis loop re-entry to active lab stages.
9. Approved awaiting closure.
10. Archive closure.
11. Disposal closure.
12. QC fail restrictions during review.
13. Reopen from final states when new analyses are added.
14. Undo intake and undo approval rollback visibility.

### 7.4 Role-Aware Action Model
1. LAB_MANAGER: assign/reassign, triage blockers, review submissions, approve/close, override where policy allows.
2. LAB_TECHNICIAN: start/complete assigned items, respond to reanalysis requests.
3. SAMPLE_RECEPTION: receive/accept readiness and intake context.
4. SUPER_ADMIN: full visibility and audited override actions.
5. Every action must be precondition-checked and show failure reasons.

### 7.5 Real-Time and Freshness Behavior
1. Subscribe to work item, submission, and sample status change events.
2. Apply incremental state updates to avoid full redraw churn.
3. Add stale-state indicator with fallback polling mode.
4. Preserve user context (selected node/drawer) on background refresh.

### 7.6 Audit Explainability
1. Stage detail must include relevant work-item, submission, and sample events.
2. Surface decision reasons for waiver/reanalysis clearly.
3. Keep event chronology coherent for operator audit review.

## 8. Visual UX Implementation Plan

### 8.1 Visual Objectives
1. Enable 3-5 second triage scanning.
2. Make state semantics unmistakable.
3. Maintain consistent visual language across top strip, nodes, edges, and drawer.

### 8.2 Viewport and Canvas Framing
1. Replace rigid layout assumptions with adaptive fit and safe padding.
2. Prevent bottom/right clipping in common resolutions.
3. Preserve map readability when drawer is open.
4. Keep controls and minimap from occluding actionable nodes.

### 8.3 Top Strip Redesign
1. Prioritize fields: lifecycle status, risk, next action, owner, active stages, age.
2. Reduce visual clutter and separators.
3. Raise text readability for critical values.
4. Move secondary metadata to less prominent presentation.

### 8.4 Node and Edge Visual Semantics
1. Define strict tokens for: future, active, blocked, completed, terminal.
2. Separate terminal visuals from active-progress visuals.
3. Distinguish edge types: active flow, blocked dependency, completed path, closure path.
4. Show overdue and reanalysis counts as first-class node indicators.

### 8.5 Drawer Readability and Consistency
1. Align icon source and naming with node system.
2. Group content as summary, analyses, reasons, and recent activity.
3. Ensure long notes and reasons remain readable and scannable.
4. Keep close and focus behavior predictable.

### 8.6 Color, Type, and Spacing System
1. Introduce map-specific visual tokens for consistency.
2. Standardize typography scale for labels, values, badges, and helper text.
3. Enforce contrast compliance for badges/chips in light and dark themes.
4. Reduce inline style drift in favor of shared style classes/tokens.

### 8.7 Motion and Interaction Quality
1. Keep only meaningful motion (enter, focus, stage emphasis).
2. Remove non-essential decorative loops where they reduce clarity.
3. Add reduced-motion mode for all continuous animations.
4. Ensure hover and keyboard focus states are equally clear.

### 8.8 Responsive UX Model
1. Desktop: full graph + detail drawer + minimap.
2. Tablet: condensed controls and reduced default detail density.
3. Mobile: list-first stage model with optional graph access.
4. Ensure no horizontal chaos in top strip on narrow widths.

## 9. Unified Functional + Visual Acceptance Matrix

| Category | Acceptance Condition |
|---|---|
| State truth | Map state matches backend contract for all tested scenarios |
| Next action | Next action is deterministic and role-appropriate |
| Terminal semantics | Archived/Disposed never appear operationally active |
| Parallel flow | Multiple active labs are represented simultaneously |
| Blockers | Every blocked item has explicit dependency reason |
| Action safety | Role gating and precondition validation enforced |
| Real-time | State updates reflect events without confusing flicker |
| Readability | Critical status/risk/action readable at a glance |
| Drawer quality | Decisions/reasons/history are complete and stage-relevant |
| Accessibility | Keyboard navigation, focus management, and dialog semantics pass |
| Localization | Workflow UI text is fully translation-key based |
| Responsive behavior | Core triage tasks are usable on mobile and desktop |

## 10. QA and Validation Plan
1. Contract tests for map-state payload schema and status normalization.
2. Scenario tests for all lifecycle and branch pathways.
3. UI regression tests for node/edge semantics and top-strip status clarity.
4. Permission tests for action visibility and execution by role.
5. Accessibility tests for keyboard and assistive technology paths.
6. Localization tests to prevent hardcoded workflow strings.
7. Real-time resilience tests for stale/live transitions.

## 11. Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Frontend/backend lifecycle drift | Wrong operational guidance | Map-state contract from backend only |
| Single-room modeling of parallel activity | Hidden active work | Active stages array + multi-active rendering |
| Incomplete blocker model | False readiness | Dependency reasons from workflow engine |
| Terminal-state visual ambiguity | Closure errors | Dedicated terminal tokens and closure semantics |
| UI clutter and low readability | Slow triage | Hierarchy-first redesign and density controls |
| Motion overload | Cognitive load and accessibility issues | Reduced-motion support and motion pruning |

## 12. Governance and Maintenance
1. Assign owner for workflow contract evolution.
2. Require map-state contract updates with any workflow rule change.
3. Require product + QA sign-off using acceptance matrix before release.
4. Maintain changelog of workflow-map semantic and visual updates.

## 13. Operational KPI Set
1. Time to identify highest-priority blocker from map.
2. Volume of overdue blocked items per lab.
3. Reanalysis turnaround duration.
4. Manager triage-to-action latency.
5. Frequency of ambiguous/incorrect next-action reports.
6. Stale-state incident frequency.

## 14. Final Deliverables
1. Canonical map-state contract document.
2. Workflow coverage matrix and scenario checklist.
3. Visual specification for top strip, nodes, edges, and drawer.
4. Unified acceptance matrix.
5. QA validation checklist.
6. Release governance checklist.
