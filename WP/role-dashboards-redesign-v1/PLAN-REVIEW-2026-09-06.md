# Review of Antigravity's dashboard implementation plan

Reviewed 6 September 2026 against the complete dashboard handoff and repository HEAD `cdcc2cb`.

Reviewed artifact: `C:\Users\yigin\.gemini\antigravity\brain\80c11c12-5cb7-4455-a433-01544d488498\implementation_plan.md`, headed **Coordinated All-Role Dashboard Redesign (v1) Implementation Plan**. This is a plan review, not implementation or production verification.

Reviewed plan SHA-256: `93bbe713535de3b3f7e95def5b9eae92aeea25c15deade9a82076d276d43bdae`. Later revisions should incorporate this review; this fingerprint identifies the reviewed version only.

## Decision

**The architecture and sequence are approved with the corrections below incorporated into the plan and execution ledger. Proceed with implementation after recording them; another routine user approval is not required.** The original contracts, role/control matrix and A01–A46 acceptance requirements remain binding; this shorter plan must not replace or reduce them. Deployment remains conditional on the already authorized test, backup, CI and live-verification gates.

The plan correctly includes ten roles, shared scope/eligibility, aggregation before pagination, exact method/run continuation, preservation of reception PR54, restrained role views and issue reconciliation. It has several omissions or assumptions that must be corrected before they turn into implementation defects.

## Required corrections

### R1 — Restrict the actual data endpoints, not just report screens

The proposed changes explicitly restrict EXTERNAL_VIEWER in `ResultReports.jsx`, but do not list the required backend report changes. Current `reportController.searchReports` only restricts lab when user.labId is present and exempts MASTER_USER; the caller can supply arbitrary status. Thus a filtered home or React screen is not sufficient protection.

Add explicit changes/tests for report search, report detail, PDF/sample-PDF, share-link management, sample detail/workspace, data-results and spectral read endpoints used by these journeys. Enforce actor grants and published/current visibility server-side, even for direct IDs, arbitrary status, search and pagination. Queue endpoints must authorize the requested selector for the actor; an authenticated viewer must not request manager/admin queues merely because queueKey is in a global allowlist.

Wire `canPublish` into the actual report generation/publication command. The current GENERATE_REPORT registry includes AUDIT_USER although that role is intended to be read-only. Reconcile publication authority separately from downloading an existing PDF; do not retain a backend publication bypass or disable legitimate read-only downloads.

### R2 — Missing event scope must fail closed

Replace the plan's “missing lab broadcasts only to SUPER_ADMIN sockets” fallback for ordinary laboratory events. A missing scope should produce no private event broadcast and a diagnostic; resolve affected lab/project/authorized recipients from the resource first. Explicit global administrative health events may have a separate allowlisted path with minimal payload. Do not silently send owner-private drafts or sensitive record payloads to a fallback audience. Keep all authorized subscribers refreshed with scoped invalidation keys and polling fallback.

### R3 — Resolve scope against the actual schema and grants

The proposed SURVEYOR ownership predicate mentions `createdBy`, but **Sample has no createdBy field** in `server/prisma/schema.prisma`. Resolve genuine field ownership/provenance using supported facts and grants, not an invented Prisma column or receivedBy/locationCapturedBy as a guessed owner. If ownership/edit permission cannot be proven, use permitted read-only tracking and omit the edit action.

Normalize the actual JSON grants in User.projects/User.countries and lab ID/code references. Project filters narrow authorized scope and applicable country restrictions; absence of grants fails closed. Inventory any legacy COUNTRY_ADMIN users before removing its routing; do not invent a privileged alias. UTC fallback must be explicitly labelled in both scope and metrics; missing/invalid lab timezone must not be presented as a configured local day.

### R4 — Make shared eligibility real across all entry and review paths

Add concrete changes for existing workbench readiness/batch-save/completion/submission, work item/submission review, sample workspace projection, legacy result entry and report publication where they currently implement conflicting rules. `canRecord(item,sample,user)` needs resolved context for active order revision/current attempt, configured gate applicability, method/revision, instrument and evidence/QC requirements; pass it explicitly rather than making missing inputs permissive defaults.

Use the real persisted omission states/reasons (e.g. WAIVED/CANCELLED as supported), or an explicit normalized OMITTED read model; do not invent an OMITTED database status. Gate-only, zero-order and entirely omitted work cannot pass a normal analytical approval vacuously. Preserve sealed prior evidence, legitimate returned attempts, formal dispositions and all stricter existing guards. Sample/workbench/home/command outcomes must agree.

Inside approval/publication transactions, reload/check all relevant current order/work/evidence/QC versions and authorization, not only a stale sample object fetched before the transaction. A concurrent change must conflict safely. Shared naming alone does not prove atomicity or parity.

### R5 — Complete the missing destination receivers and default-lane behavior

In addition to the three listed destinations, explicitly implement/verify Reception immutable sample/draft links, Samples named queue/scope filters, SampleDetail review/history/submission selection, and quality/configuration targets. Current Reception initializes originalId query links, while the handoff proposes sampleId; current SampleDetail does not establish the promised tab/submission URL support. Do not emit links before their receivers exist and enforce scope.

Use the original default rule: valid explicit URL > intentional same-actor/scope selection > first nonempty actionable queue > calm empty default. Include final approval as a manager default candidate, reject invalid/forbidden queue keys, support same-route changes/back/forward, and never change a chosen tab on refresh.

The mockup's destination-preview dialogs are design affordances. Real primary actions should open the controlled workspace directly; do not require a redundant modal on every “Continue run” click. Optional Inspect can show actual facts. Do not copy “Implementation preview”, synthetic fixtures or preview-role controls into the product.

### R6 — Complete refresh/error handling and human-readable presentation

Beyond adding dependency keys and request counters, clear old data immediately on role/grant/scope changes, cancel/ignore obsolete requests, and distinguish first-load failure, partial unavailable section, stale previous same-scope data and genuine zero. Do not display Live because the last HTTP request happened to succeed. Use actual last-success time/connection meaning; no swallowed backend errors returning zero queues.

Add event producer/consumer coverage for reception, drafts, acceptance, assignment, gates, submission/review, QC, spectra, amendments/reports, catalogue/equipment and permission changes. Add the missing human sample identity/catalogue names, supported translations, lab-local dates and existing shell controls to the implementation list. Operational checklists are tasks, not analytical determinations; mixed metrics must use clear units. Preserve all controls from role-control-matrix.md.

### R7 — Treat the complete acceptance list as evidence obligations

The proposed test suite says it covers A01–A42 but its outline lists only a subset. Keep an explicit ledger for every A01–A46 requirement with test/evidence location and observed outcome. Include real browser checks for forty-row persisted save/reload/submit/review, texture/spectra/checklists, all ten roles, actual default/deep links, direct API denial, reassign/concurrent sessions, offline/stale scope races, accessible focus, mobile/dark/translated layouts and payload/query budgets. No mock success, screenshot or exit code may stand in for these outcomes. Use existing v3 tests where relevant and link them rather than claiming unexecuted coverage.

### R8 — Preserve the full release sequence and accurate progress language

The concise deployment section must explicitly retain GitHub push of all intended application/assets/tests/docs, focused PR and successful exact-candidate CI, coordinated DB **and asset** backup, restore/start compatibility and rollback, immutable image, authenticated read-only live checks, and issue reconciliation last. Existing release machinery can be reused; no fresh deployment framework or production fixtures are needed. Treat missing gates as unfinished, not implicit green.

The response said “The system now counts all active work” although only a plan exists. Use “will count” until implemented, then distinguish tested from deployed. Continue the clearer, friendly progress messages already adopted.

## Reviewer action

Send this review directly to LIMS Dev, ask Antigravity to incorporate R1–R8 into its plan/ledger first, and then proceed under the user's existing implementation/GitHub/deployment authorization. This is approval to execute the corrected plan, not a statement that the unimplemented system is safe to deploy today.
