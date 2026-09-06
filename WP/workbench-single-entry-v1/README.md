# One place to record laboratory work

Prepared 6 September 2026 for Antigravity, project **LIMSI**, chat **LIMS Dev**, working directory **C:\Users\yigin\Documents\soilfer-lims**.

The requested outcome: technicians record drying, preparation, analytical results and spectra in **Workbench**. The Sample workspace displays that same evidence and progress. Assignment, authorized review, intake, custody, reporting and history remain available in their appropriate workspaces. Staff must not repeat work to make two screens agree.

## Read in this order

1. [ANTIGRAVITY-HANDOFF.md](ANTIGRAVITY-HANDOFF.md) — execution instructions and release conditions.
2. [source-audit.md](source-audit.md) — confirmed code defects and W001 read-only findings.
3. [implementation-plan.md](implementation-plan.md) — workflow, data, API and UI changes.
4. [acceptance.md](acceptance.md) — required proof before release.
5. [prototype.html](prototype.html) — interactive, synthetic sketches of preparation, a 40-sample worksheet, submission, sample viewing and a legacy evidence gap.
6. [defect-probe-results.json](defect-probe-results.json) — four defects reproduced by calling actual controllers with in-memory dependencies.

This package is a follow-up to the dashboard, laboratory operations v3 and sample workspace v2 packages. It does not replace those packages or restore old application snapshots. It adds **planning documents, isolated audit probes and a standalone sketch only**. It does not fix the application or repair production records.

## Why this is required

- Preparation on W001 is `COMPLETED`, stores the text `Done`, and has no submission or checklist. The manager's scientific-review endpoint therefore rejects approval.
- Completed work disappears from Workbench's execution query. Its review tab does not independently fetch the submission list, so reopening the page can strand recorded work.
- The old Sample table can still complete gates and write scalar results through a separate path.
- W001's active order has **11 plant analyses**, while the tasks are **13 soil analyses plus 2 preparation tasks**. This is an order-integrity mismatch, not merely different counting conventions. The intended order requires verification against the original intake/request.

## Decisions recommended

1. Routine drying/preparation use an **operational confirmation** with a versioned checklist and clear receipt. They do not create scientific result submissions. If the applicable SOP requires a second sign-off, make that an explicit operational verification step with a visible technician handoff and manager queue.
2. Analytical work retains **Save draft → Record results → Send for review → Manager review**. The Ready to submit queue always reloads from the server and remains reachable after logout or completion.
3. Missing evidence or mismatched orders get a clear exception route. Never generate affirmative checks, approve bare `Done`, or change an order just to make counters turn green.

Production was inspected read-only. No laboratory work was started, completed, submitted, approved, reopened or otherwise changed during this audit.
