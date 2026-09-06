# Role and control coverage

All ten canonical roles appear in the interactive design. This table complements the exact scope/action rules in contracts.md.

| Role | Retain / prioritize | Keep out of this role's opening view |
|---|---|---|
| SAMPLE_RECEPTION | New intake (project, external and consignment origins inside one flow), own/shared drafts, expected sample lookup, unresolved intake problems, receipts, label/field-data/history links where authorized | Numeric gate/result fields; default false drying backlog; separate quick intake bypass |
| LAB_TECHNICIAN | Returned work reason, current runs, ready method groups, waiting prerequisites, submit continuation, activity receipts; laboratory sample and field identifiers | Global totals, approval actions, productivity ranking, 40 separate sample hero cards |
| LAB_MANAGER | Review/QC/hold decisions, final approval eligible list, unassigned work, intake acceptance, staff workload by method, sample/workflow/audit links | Intake-only default when decisions await; dry+prep-only final approval; one-click mutation from KPI |
| MASTER_USER | Authorized laboratories/projects, exceptions, review and release counts; explicit selected-lab manager continuation if authorized | Automatic global scope; raw technician draft values; implicit super-admin tools |
| PROJECT_MANAGER | Assigned projects, received/awaiting receipt/active/released progress, request exceptions, reports and maps if authorized | Technician workload and approval controls; unrelated project/country counts |
| AUDIT_USER | Failed/pending QC, evidence gaps, amendments, current/historical controlled reports and audit trails | Editing evidence, changing QC disposition, publishing/signing reports |
| SURVEYOR | Own/permitted field records, actual missing provenance, custody/handover, receipt confirmation, authorized field continuation | Reception/acceptance or result entry merely because CREATE_SAMPLE is granted |
| EXTERNAL_VIEWER | Current published reports, permitted sample IDs, report download, scoped search | Internal comments/drafts/QC exceptions, global sample search, audit log, unpublished results |
| VIEWER | Authorized sample progress, expected vs received distinction, published report status | Any mutation, invented internal access, broad lab metrics where sample access is restricted |
| SUPER_ADMIN | Concrete configuration/access/integration issues, lab selection, existing management tools, audit | Global manager view masquerading as one lab; fabricated health/backup green indicators |

## Existing dashboard controls: explicit disposition

| Existing control | Disposition and destination |
|---|---|
| Refresh / Live label | Retain refresh; replace misleading Live with actual last-success/availability. Use shared component. |
| Reception New Sample Intake | Retain as primary New intake; canonical /reception. |
| Quick Walk-in Entry | Remove redundant home/sidebar shortcut; retain external origin inside canonical reception; preserve old deep links. |
| Reception Today / all-time / drying / prep cards and pipeline | Replace top row with expected/drafts/receipts/attention. Processing handoff is subordinate, scoped, gate-aware; never mix day count with cumulative stage funnel. Total registered may remain in secondary tracking with clear definition. |
| Today's Submissions / All submissions | Rename to Today's receipts if reception events. Show officer/whole-lab scope explicitly and open matching receipt list. |
| Manager Pending Intake | Retain queue filter and exact intake-acceptance link. |
| Manager Unassigned | Retain, group method tasks and count before pagination; assignment available at existing workspace. |
| Manager Awaiting Review | Retain as submitted-work queue with consistent sample/submission units; separate QC-blocked from review-ready. |
| Manager In Progress / Completed Today / Total Samples | Keep only useful scoped summaries; rename to factual lifecycle/event. Make actionable with matching list, or render noninteractive text. |
| Manager intake/review cards | Consolidate into main decision queue; individual record links preserved. |
| Manager sample progress bars | Replace with counts of remaining/accepted work and next blocker. No “90% complete” from truncated latest500 work items. Workflow map remains in sample. |
| Technician Assigned/In Progress/Done Today/Reanalysis | Replace with continue/ready/returned/waiting and secondary submitted receipts. Completion does not mean accepted/released. |
| Technician Fix Now / Full View / active queue links | Keep intent; direct to exact workbench run/method/returned attempt instead of generic MyWork or sample page. MyWork remains a compatible detail entry if needed. |
| Technician sample-first list | Method-first work groups; sample list in worksheet and optional detail drawer. No functionality removed for sample-specific tasks. |
| Oversight Total/In Progress/Today's Intake/7-Day Trend | Retain factual tracking and day figures when useful. Demote trend to optional secondary view; remove if no decision it supports. Use real event data/local-day buckets. |
| Recent Activity / audit shortcut | Keep as scoped secondary history link. No unrestricted audit details in external/project views. |
| QA placeholder | Replace with actual read-only quality/evidence view; align /qa and home with permissions. |
| Profile/language/theme/notifications/sidebar | Preserve existing shell controls; harmonize labels/capabilities. Do not create another settings system. |

## Connected sample/workbench controls retained

Sample receipt/acceptance, field provenance/full field data and map, sample label printing, drying and preparation checklists, workflow map, analysis requests/order revisions, assignment, result/group/spectral entry, draft/resume, submission review, QC, final approval, controlled amendment/reanalysis, report history/download/sharing, archive/disposal, and audit history remain in their existing authorized workspaces. Dashboard links must not bypass any of them. Changes to destination filters do not authorize removing a control. For each control record current route, required capability, eligible states, replacement if moved, and a browser test.

No new general task/case tracker is required: first derive attention rows from existing intake, work, QC, order, evidence and configuration facts. If a persistent acknowledgement/resolution model is actually absent, do not paint a fake “resolved” toggle on a computed fact. The owner fixes the source problem through its real workflow.
