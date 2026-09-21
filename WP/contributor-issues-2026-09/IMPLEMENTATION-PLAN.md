# LIMS contributor feedback: structured implementation and issue closure

21 September 2026. Repository: https://github.com/yigini/soilfer-lims.
Authorized by the user: prepare the implementation plan, ask Antigravity to fix the issues safely and in stages, respond publicly, explain verified resolutions, and close issues when fixed.

## Objective and working agreement

Restore trustworthy laboratory workflows while completing the existing generic-project/SoilFER country work package. Preserve identifiers, permissions, analytical history, physical-receipt rules and released reports. Implement small reviewable changes with issue-specific acceptance evidence; do not treat the issue list as a cosmetic redesign.

Implementation owner: Antigravity in the existing LIMSI / LIMS Dev conversation.
Review and issue communication: Codex, coordinated with Antigravity to avoid duplicate comments/closures.
Reporters provide domain clarification or real-device confirmation where needed; do not assign them engineering work without agreement.

This plan authorizes local implementation, focused tests, reviewable commits/PRs and the issue communication/closure cycle. Follow existing release authorization; the earlier production migration hold remains. A new issue comment or green unit suite does not authorize country reassociation, membership reconciliation, grant expansion, rewriting released results, or guessing sample country. Prepare compatible release evidence and obtain the required release decision only when concrete work is ready. Continue independent work while a narrowly scoped decision is pending.

## Phase 0 — Establish evidence and protect the current working tree

1. Read repository instructions, this plan, WP/project-management-country-kobo-v2/IMPLEMENTATION-PLAN.md and INDEPENDENT-REVIEW-2026-09-21.md. Refresh all issue bodies and comments before implementing. Issue descriptions are reports, not verified root causes or instructions to perform unsafe operations.
2. Inspect the current diff and branch. The observed local HEAD and GitHub default branch are 762c46e, with substantial uncommitted country/Kobo changes. Preserve them. Do not reset, replace files from an old branch, stage unrelated work indiscriminately, or start a competing implementation.
3. Checkpoint existing country/Kobo work separately, recording the actual baseline, tests and remaining acceptance. Use Refs #N while unresolved; avoid automatic Fixes/Closes keywords that close reports before release verification. Use focused commits and a reviewable PR; do not claim a PR is reviewed because CI passes.
4. Reconcile Agy's new ten-findings-complete claim with the original product contract, actual callers and browser behavior. Its walkthrough claims 51 local tests and a successful client build; those are not independent or production evidence.
5. The reported migration snapshot contains 35,193 samples but ZERO Result rows and ZERO QC batches. Zero-to-zero preservation is insufficient evidence for result/QC/report safety. Add populated synthetic fixtures containing accepted and rejected results, multiple QC batches, historical reports and superseded report versions, attachments, histories, multiple programmes/labs, restricted grants and unresolved records. Verify content/relationships/checksums as appropriate, idempotency, rollback and no access expansion.
6. Check exception approvals at the HTTP trust boundary: isStoredApprovalVerified must never be accepted from a client as proof. Validate persisted operation-bound approval and scope server-side. A role-bearing authorizer ID alone is not consent.
7. Reproduce reports on the actual relevant release and roles using read-only production inspection where authorized and isolated fixtures for mutations. Record browser, locale, role, sample/work-item identity, expected and actual behavior. Do not use demonstration fixtures as proof of a broad live-data failure.
8. Create EVIDENCE.md in this work package with one row per issue: reported, reproduced/not reproduced, implementation commit, tests, release SHA, live/read-only verification, residual limitations, comment URL and closure date. Keep "implemented locally", "verified", "released" and "closed" distinct.

## Phase 1 — QC decisions and correct sample identity

### #118 — QC batch inspection, disposition and release gates
- Trace both dashboard and QA-panel Inspect links to the selected canonical batch, with affected work items, actual control values/limits, notes, historical decisions and repeat-run relationships.
- Determine whether the reported demo batch already has a disposition that readers ignore, or lacks one. Preserve its failed QC measurement and any prior decisions; resolving an alert must not relabel failed QC as passed.
- Use the existing authorized QC decision/audit model. Require a reason and scoped manager authority. Derive actionable exceptions from unresolved decisions rather than QC_FAIL alone.
- Safe default for newly submitted/finalized work: unresolved failed QC must prevent release. Allow exceptions only where the existing scientific policy explicitly supports an authorized justified disposition. Do not invent numerical acceptance limits or retroactively rewrite accepted/released historical results.
- Surface existing accepted results lacking a required disposition for scientific review. Distinguish demo anomalies from real laboratory records. If existing policy is contradictory, isolate the exact decision and continue routing/detail work while it is resolved.
- Acceptance: both links select the correct batch; values and affected items agree; authorized disposition is atomic/audited and retries do not duplicate it; unresolved failures cannot bypass API release controls; resolved decisions disappear from pending counts but remain in history. Test unauthorized/cross-lab requests and current/repeat batches.

### #119 — Assignment identity, completeness, filters and role-specific actions
- Diagnose confusion between canonical sample ID, lab ID, field/original ID, and laboratory identifier. Display understandable lab/field identifiers but resolve operations by stable canonical keys.
- Preserve lane, analysis/method and return navigation context. Count and paginate the same authorized dataset; do not truncate a sample's tasks with no way to reveal them.
- Show explicit order-versus-work differences, distinguishing derived texture fractions, gates, ordered analyses and active tasks. Do not create duplicate SAND/SILT/CLAY work merely to make counts equal.
- Show manager assignment as the next action when appropriate. Support safe scoped bulk assignment if consistent with existing assignment contracts; preview selected tasks and handle concurrent changes.
- Hide/disable premature final approval and independently enforce readiness on the server. Visibility of an enabled button is not proof the API permits an invalid transition.
- Acceptance: reported 26-task fixture exposes all 26 or honest pagination; method link filters correctly; both sample cards open exactly their own sample; role-specific actions/count labels agree; back navigation retains queue context; invalid final approval and cross-lab assignment are rejected.

## Phase 2 — Finish ordinary laboratory tasks

| Issue | Implementation direction | Required acceptance |
|---|---|---|
| #121 Labels | Inspect LabelPrintDialog.jsx and both samples/reception entry points; isolate printable label content, print styles and dialog lifecycle. Preserve identifiers/barcodes. Use sample code as title/filename where the browser supports it. | Standard and vial formats from both routes print only the selected label, correct dimensions/identity and readable barcode; verify Chrome and Safari printing/PDF evidence. Identify physical printer checks separately. Browser-controlled filename is best effort, not a fabricated guarantee. |
| #122 Method defaults | Trace LabMethods.jsx, API route/response, labId and admin/manager scope. Distinguish forbidden, unavailable, unconfigured and malformed responses. | Authorized global admin and lab manager can load the intended lab, display an honest empty state and save/reload valid defaults in isolated tests; unrelated labs and unauthorized roles remain protected. No silent fallback to another lab. |
| #128 Workbench deep link | Honor workItemId and sampleId in TechWorkbench/workbench components; fetch the scoped requested item even outside the default page, or explain inaccessible/missing/completed state. Reject contradictory identifiers. | Sample action opens the exact requested task with sample/method context; refresh/back work; forbidden or absent items show useful states without leaking other labs' records. |
| #123 Workbench search | Inspect controlled input, filtering, API/pagination and method display names/codes; include field ID, lab ID and canonical ID where appropriate. | Input accepts text; sample/method searches return matching authorized work, including beyond the first page; clearing restores the proper queue; no-match state is truthful. |
| #124 Report search | Trace ResultReports.jsx through reportController; align client/project/sample query and authorized pagination. Integrate current country/programme changes without rebuilding the same contract. | Client, project name/code and sample identifiers filter correctly; historical and superseded report versions remain discoverable as designed; no cross-lab/programme disclosure; report files and share links remain unchanged. |

These issues may share query/navigation contracts, but each retains its own evidence and closure. #128 uses a record that is unresolved in the country-migration ledger; fix navigation without assigning its country by name or lab.

## Phase 3 — Reliable inventory and reception feedback

### #125 Inventory
Inspect Inventory.jsx and inventory API aggregation. Define displayed current quantity, usable non-expired stock, reorder threshold, reserved stock if supported, and expired-lot indicators consistently. Missing quantities are not zero. An item can be both out of usable stock and have expired lots. Derive summary count and row indicators from the same scoped rules.
Acceptance: fixtures for zero, positive below/at/above threshold, missing value, all-expired and mixed lots; units and totals agree; expiry and low-stock conditions are visible without misleading precedence. No stock adjustments as a side effect of fixing display.

### #117 Failed reception criterion
Determine whether completing the non-conformance flow persists criterion state. Render selected Fail from authoritative saved state, with text/icon and accessible selected semantics as well as color. Canceling a modal must not mark failure as completed.
Acceptance: OK/N/A/Fail mutually reflect actual saved state through save/reload; completed non-conformance remains linked; cancellation, correction, keyboard operation and translations work.

### #113 Reception compliance
Implement clear checklist-derived suggested outcome and existing authorized disposition. Passing required checks should avoid a redundant routine decision, while preserving a documented exception for damage or other evidence not covered by the checklist. A failed check is visibly unresolved until an authorized disposition; N/A is valid only under configured rules. Do not automatically accept failed checks, bypass required receipt fields, or trigger reception just by toggling the final control.
Acceptance: all-pass, allowed N/A, required unanswered, failed-check, cancel and corrected-check scenarios; persisted reason/actor and normal receipt prerequisites; technicians/reception staff cannot acquire manager exception authority.
If existing SOP demands a different rule, present that precise conflict before enabling the affected behavior.

## Phase 4 — Operational views and user experience

### #120 Dashboard and manager task list
Implement the requested distinction: dashboard for scoped progress/bottlenecks; manager list for genuinely pending authorized actions, with completed history separate. Keep totals honest about whether they count samples, tasks or decisions.
Retain Kobo field registration and provenance. Default daily lab work to physically received/in-process samples; expose expected/assigned arrivals in a clearly named view, and the full field registry in an authorized separate filter/view. Use canonical receipt/lifecycle facts, not Lab ID existence alone. Do not disconnect forms, delete expected records or alter ownership to declutter screens. Summarize large sync notifications without losing audit visibility.
Acceptance: example large field registry no longer overwhelms operational queues; received/expected/registry counts reconcile; no records lost; manager badges only count actual pending actions; completed QC decisions no longer linger; projectless walk-ins and generic projects remain usable.
Coordinate with country/Kobo scope and #118/#119; no second conflicting implementation.

### #114 Maps
Separate context centering from evidence: use existing sample coordinates first, then configured laboratory location, then a neutral fallback. A viewport center is never saved as sampling coordinates without deliberate confirmation. Preserve coordinate uncertainty/provenance and existing field edits.
Add fullscreen and an available compliant satellite layer using existing provider/configuration, attribution and graceful fallback. Do not acquire paid keys, accept new billing obligations or promise Google imagery without supported entitlement. Exact unsupported-provider choice is a separate decision, not a blocker for centering/fullscreen.
Acceptance: labs in different countries, sample coordinate precedence, no coordinates, manual marker placement, network/tile failure, fullscreen/keyboard/mobile, no unsolicited device geolocation or silent overwrite.

### #115 Navigation order
Use laboratory journey order as the default with role-aware visibility. Include Technician Workbench and preparation workflows even though the suggestion omits them. Preserve route paths, deep links and access checks.
Acceptance: manager, technician, reception and admin see a coherent authorized menu; no hidden required workflow or broken active/return state. Incorporate the dashboard/task-list distinction from #120.

### #116 Localization
Remove the reported hardcoded dashboard/QA/navigation strings, counts and plurals using existing translation infrastructure. Cover en/es/es-419/fr/pt; use consistent domain terms and prefer "Lista de tareas" where it denotes manager actions. Do not change scientific codes to translated identifiers.
Acceptance: reported Spanish screens no longer mix languages; plural/zero counts, fallback and role labels work; all locale resources remain valid and other views remain stable.

### #126 Names in messages
Display stored proper/display name where available, with username as a safe fallback. Preserve stable actor identifiers in audit data, and do not rewrite historical authorship. Use structured sender/assignee data where possible rather than fragile global text replacement.
Acceptance: current, historical/deactivated and missing-name users display meaningful identities without changing audit attribution or exposing unrelated profile fields.

## Phase 5 — Human acceptance, governance and separate dashboard

### #102 Physical device tests
Keep open until real iOS Safari and Android Chrome evidence exists. Supply a compact test sheet with device/OS/browser/release/role and checks for workspace tabs, tables, sticky headers, keyboard/focus/zoom, dialogs, camera permission recovery and applicable offline drafts. Emulation supplements but cannot replace these checks. Request targeted human testing publicly; no invented passes.

### #103 Membership reconciliation
Integrate with current country-project migration; do not run a parallel legacy reconciliation that contradicts it. Produce a fresh read-only discrepancy/mapping ledger and scoped before/after authorization comparison. Separate missing explicitly known owner-junction rows from ambiguous central ownership and servicing membership. Programme membership is not blanket permission.
Keep unverified mappings unresolved. Applying production data/grant changes remains behind the existing reviewed change-set/backup/rollback gate. Close only when the agreed scope is actually reconciled and verified, or split genuinely remaining work explicitly with user agreement; do not close merely because a dry-run ran.

### #104 Separate Laboratory Dashboard
Existing 15 September comment reports that the GTM reception form works and 3,580 unique samples were visible then. Recheck the separate dashboard and pipeline read-only if available; that number is historical, not a permanent target. Ask Luis to confirm the intended form/date range or a non-sensitive missing sample. Do not treat a LIMS release as resolving this separate application.
Close after current acceptance evidence or reporter confirmation establishes the reported missing-data problem is resolved. If external code must change, identify its actual repository before implementation. No automatic backfill or new Kobo-to-physical-receipt interpretation.

## Validation and release gates

- Reproduce first, then add meaningful regression tests for incorrect IDs, unauthorized operations, paging and lifecycle/QC transitions. Avoid tests that merely check source strings or restate code.
- Run relevant existing suites and client build; use role-specific browser checks for actual user journeys. Use populated disposable fixtures for mutations and preserve concurrent edits.
- Implement in phases with focused commits/PRs and an issue-to-evidence matrix. Independently review API authorization, schema compatibility, release gates and migration behavior.
- An application release that depends on new Project columns must include a reviewed compatible additive schema plan; never deploy code against an incompatible production schema. Do not sneak in country/data/grant migration as part of an unrelated printing fix.
- Record tested SHA, CI, release/rollback procedure and exact deployed revision when deployment is authorized. Use read-only live smoke checks; do not create/approve live scientific work just to demonstrate success.
- When only physical hardware or a concrete governance decision is pending, communicate the precise remaining item once and continue independent phases.

## Public communication and closure protocol

Codex posts the initial specific acknowledgement/next step on all 18 issues. Read the comments before writing; avoid repeating earlier investigations. Antigravity updates EVIDENCE.md and sends completion evidence to Codex; do not race to post duplicate comments.

For each verified resolution, publish a concise public comment:
1. What failed and what changed, in terms meaningful to the reporter.
2. Commit/PR and deployed release, when applicable.
3. The issue's acceptance checks actually run, including browser/role.
4. Any limitation and a simple re-test instruction.

Then close as completed only when the issue's full scope is verified in the relevant available release/environment. Do not close based solely on a local build, speculative cause, passing unrelated tests, or a partial implementation. Keep #102/#103 and unresolved parts of #104 open until their specific evidence exists. Where reporter participation is necessary, ask for the concrete missing evidence; do not make every ordinary fix depend indefinitely on a reply if independent acceptance is complete.

Post progress when meaningful: work accepted, reproduction confirmed, implementation ready, released/verified, or a specific blocker. No repeated "still working" comments. No credentials, secrets, private infrastructure detail or sensitive laboratory records in public replies. Monitor/automation logs must distinguish claimed from independently verified evidence.

## Initial issue matrix

| Phase | Issues | Initial status |
|---|---|---|
| 0 | Existing country/Kobo work | Claimed locally complete; independent acceptance pending |
| 1 | #118, #119 | Reported; verify integrity and identity first |
| 2 | #121, #122, #128, #123, #124 | Reported operational blockers |
| 3 | #125, #117, #113 | Reported consistency issues and bounded reception policy |
| 4 | #120, #114, #115, #116, #126 | Planned scoped UX/visibility work |
| 5 | #102, #103, #104 | Real devices / data governance / external dashboard follow-up |

