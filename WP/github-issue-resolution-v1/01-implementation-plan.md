# Implementation plan

## Scope and working rules

Work from current code, not an old blanket rollback. Read each GitHub report and the latest yigini review before changing it. Confirm existing fixes before replacing anything. Preserve concurrent files; use focused commits and existing deployment practices. Avoid a broad redesign or new framework.

Separate four kinds of evidence: reproduced defect, source-level diagnosis, recorded historical evidence, and pending external validation. Establish a failing focused test or captured reproduction for each code defect. Tests that simply mirror a helper or manipulate fixture state directly do not prove the user workflow.

The reviewed implementation proposals are now the work direction. Use normal judgment for implementation details. Continue independent work when one issue needs external access or an actual policy decision; ask only for the missing fact that changes the safe outcome.

## Delivery sequence

1. Baseline and short triage; start #109 immediately. Inspect #108 in the same batch, but release #109 separately if calibration needs further evidence.
2. Fix calibration consistency and directly related eligibility/permission regressions identified by its tests.
3. Complete #107's reported routes and nested screens in all five languages; resolve #92 against the current v2 Help implementation, reusing content and tooling.
4. In parallel as a workstream, resolve/document #105's conservative receipt policy and trace #104 in the actual separate Dashboard repository/environment.
5. Finish #103 discrepancy reporting and policy review without guessing access grants; carry out only a reviewed, authorized data correction. Run physical checks for #102 when actual devices are available.
6. Deploy verified batches, report them on GitHub and close each issue only under its own acceptance criteria.

This sequence does not require spawning agents. Do not overlap edits by multiple implementers in shared files.

## #109 — independent time-zone saving (highest immediate priority)

Source evidence at baseline:
- client/src/pages/admin/LabManagement.jsx initializes capacity using value || '', losing zero, and submits the entire settingsForm to PATCH /api/labs/:id/profile.
- The visible settings form has no capacity control although capacity is sent.
- server/services/labLifecycleService.js rejects blank capacity via parseInt; decimals and partially numeric strings can be incorrectly truncated.
- server/prisma/schema.prisma defines capacity as nullable Int, “Max samples per month.”
- The workspace response substitutes UTC for missing time zone, while the client also has a Guatemala fallback. Distinguish an effective display fallback from actual configuration.

Implementation:
- Preserve the original loaded form and submit changed permitted fields only. Do not accidentally overwrite untouched settings after a stale load.
- API contract: omitted = unchanged; explicit null = unset optional capacity; 0 = zero; whole non-negative safe integer = valid; negative, fractional, partially numeric, non-finite and out-of-range values = field-specific error. Normalize an optional blank at the form boundary; document compatibility for existing clients sending blank.
- Keep strict time-zone validation. Represent missing configured time zone honestly with a placeholder. Do not save a guessed region when the user edits contact details.
- Expose an optional, explained “Monthly sample capacity” field if it belongs in this profile. Otherwise omit it from this form's patch. Do not invent throughput limits or treat unknown as zero.
- Translate labels, hints and server error codes in five locales.
- Refresh workspace and attention summary after confirmed save; show refresh failure separately from save failure. Preserve RBAC, lab scope and existing auditing.
- No schema migration should be needed for the nullable capacity.

## #108 — calibration history, qualification and registry consistency

Do not presume that update wiring is absent. Baseline equipmentEventController.logEvent already writes an event and qualification in a transaction; EquipmentDetailDrawer.onSuccess refreshes detail and registry. Manager disposition updates a separate event decision. Reproduce the reporter's actual operation.

Trace:
LogEventModal payload -> POST /api/equipment/events or disposition endpoint -> persisted event/qualification -> GET detail/list -> Maintenance, History and registry -> readiness/eligible-equipment consumer.

Implementation:
- Capture event type, performed date, outcome, approval/disposition state and instrument identifier in an isolated fixture. Identify whether “accepted” means saved, passed or approved.
- Validate explicit event types/outcomes; do not use substring matching as the whole transition policy.
- Preserve one authoritative qualification calculation/projection, reused across list/detail/eligibility. Commit event and applicable state together; refresh consumers on success. Retry must not duplicate an event; use existing command idempotency conventions or a narrowly scoped request identifier if needed.
- Distinguish performed date from recorded/approved timestamp. Prefer existing structured event details if suitable; inspect schema compatibility before proposing an additive migration. Do not silently rewrite historical dates.
- Label “latest calibration” with its outcome and, if required, show the last accepted successful calibration separately. Define which event determines readiness, including later failed/rejected/superseded and backdated events.
- A failed/rejected calibration cannot make the instrument usable. A passing calibration does not clear unrelated maintenance/decommission/out-of-service restrictions. Do not invent universal calibration intervals.
- Preserve due-date semantics, certificate reference, actor, reason and audit history. Model any correction as a traceable correction, not destructive overwrite.
- Make save/pending acceptance/current qualification states understandable. Disable unauthorized controls and enforce permission AND lab scope on relevant read/write endpoints, including direct event/disposition paths.
- If old events and qualifications differ, prepare a read-only mismatch report and deterministic proposed corrections. Do not blanket-rewrite production qualification dates.
- No generic equipment redesign is needed.

Relevant files: client/src/pages/Equipment.jsx; components/equipment/LogEventModal.jsx and EquipmentDetailDrawer.jsx; server/controllers/equipmentEventController.js, equipmentController.js, equipmentEligibilityController.js; server/routes/equipmentRoutes.js; associated qualification/readiness services found by references.

## #107 — complete the reported interface translations and correct dashboard identity

Confirmed examples: Dashboard.jsx role configurations bypass translation; Reception.jsx and DataResults.jsx contain visible English; LabManagement.jsx has hard-coded profile copy. Existing language system supports en, es, es-419, fr, pt and administrative overrides. The current i18n audit checks key existence/non-empty values, not actual UI coverage.

Implementation:
- Inventory the reported Samples, Reception Console, Result Reports, QA/Audit, Analytical Results and Administration pages, their dialogs/subtabs, plus role landing dashboards. Produce a route/role/string-source checklist.
- Use existing LanguageContext, catalogue name resolver and message formatting; do not build a second translator.
- Translate navigation, titles, buttons, filters, state labels, validation/error codes, notifications, empty/loading states, tooltips, accessible names and user-facing export labels. Preserve identifiers, stable internal enum values, codes, scientific units and user-authored content.
- Distinguish the dashboard “Laboratory overview” from the separate Manager queue route; localize title, breadcrumb, sidebar and quick action consistently. Do not change which role may perform an action merely to fix its label.
- Review runtime bootstrap overrides so stale English in the database does not silently mask corrected locale files. Preserve intentional administrator edits; produce a reviewed, selective override update if required.
- Reuse translation groups: Interface; Laboratory operations; Analysis catalogue; Reports; Help. Surface missing/stale/review-needed terms and search by key or displayed text. Extend existing translation management only where demonstrably missing.
- Reuse WP/help-knowledge-base-v2/terminology.json and 09_RESEARCH_AND_TERMINOLOGY.md; verify changed scientific terms against appropriate primary laboratory-method sources. Record terminology/source/locale choices. Avoid inventing translations of SOPs or claiming human scientific review.
- Strengthen static checks for newly added hard-coded user-facing text and rendered-path tests. Allow genuine proper names/scientific symbols through a documented exception list. Never translate text by uncontrolled global search-and-replace.
- Check locale decimal input, dates/time zones, long French/Portuguese labels, light/dark, mobile and offline cached translations. Do not alter numerical values or result precision.

## #105 — settle and explain Kobo/LIMS receipt responsibilities

Adopt the conservative reviewed direction: ordinary Kobo field imports create expected samples; physical receipt is confirmed once by authorized LIMS reception staff. Current koboController.js creates EXPECTED with receptionDate null.

Deliver:
- A short user-facing workflow in Help/reception instructions, in five locales: field registration -> expected sample -> physical condition/identity check -> receipt confirmation -> downstream readiness.
- Explain that scanning finds a sample and syncing imports data; neither alone confirms receipt. Keep field collection, submitted-at, imported-at and received-at dates distinct.
- Verify existing counts/gates depend on authoritative physical receipt, not an import timestamp or expected record.
- Document the optional future dedicated Kobo reception adapter as a separate integration choice. Do not implement automatic receipt, a new input path or a new receipt queue just to close this clarification issue.
- If existing configured reception integration is discovered, document its actual behavior and reconcile the decision before changing it.
- Record this workflow decision on #105 and update the appropriate guides. If stakeholders require Kobo to be an authoritative receipt source, request the specific designated form/policy and hold that behavior change; other fixes continue.

## #104 — Guatemala missing in the separate Dashboard

The reporter explicitly says this is not LIMS. Do not change LIMS counts or trigger its sync to make another dashboard appear fixed.

- Identify the exact Dashboard URL, repository, deployed build, source form and configuration from authorized project context. Never guess the repo based on a similarly named folder.
- Trace a known non-sensitive GTM submission through fetch pagination, mapping, country/lab identifiers, validation/date filters, refresh job and displayed aggregation.
- Read configuration and logs without exposing tokens. Redact record-sensitive details in public GitHub comments.
- Fix the demonstrated connector/mapping/filter defect in the correct project. Avoid duplicate country-specific pipelines when the shared one can support the correct mapping.
- Preview any backfill: source identifiers, duplicate policy, date bounds, expected counts and destinations. Do not run an uncontrolled import or broad settings replacement.
- Compare GTM before/after counts under a documented receipt definition; check another country, repeated refresh and refresh-failure visibility.
- If access/form/example is unavailable, comment with the exact missing dependency. Keep #104 open; do not claim a LIMS deployment fixed it.

## #103 — accurate discrepancy review before membership correction

Historical reports are not a fresh authorization or current data baseline. Preserve central multi-lab projects without choosing an arbitrary national owner.

- Refresh the read-only discrepancy report on a safely obtained current snapshot; compare legacy assignments, explicit owner, junction roles and resolved effective permissions.
- Inspect both report implementations: baseline projectMembershipService.getDiscrepancyReport only flags an absent owner junction when some junction rows already exist. Add focused coverage for an explicit owner with ZERO rows and correct the omission if confirmed. Also check malformed legacy JSON and role mismatch, not only lab-ID presence.
- Separate actual inconsistency from valid centrally managed projects with no national owner.
- Present the recommended central servicing-only policy and exact before/after membership/access diff. Do not create a coordination entity or schema solely to clear a warning.
- Existing explicit relationships may be candidates for reconciliation; do not copy them blindly if canonical membership would expand or remove effective access.
- The user authorized solving the issue, but the exact central ownership/access policy remains an unresolved factual choice. Do all diagnostics and prepare the concrete proposed patch first; ask only about genuinely ambiguous mappings/authority. No guessed grants or unattended production --apply.
- For approved data correction: isolated rehearsal, idempotent rerun, no unrelated grant change, transactional apply with current-state preconditions, audit and recovery. Stop if live state no longer matches the reviewed diff.
- Use actual pre-change record/integrity baselines; account for legitimate intake. Historical 36,870 is not a permanent invariant.
- This issue's title is dry-run review: close only when that review and its stated dispositions are actually complete. If an unresolved correction remains in scope, keep it open; do not use a new issue to conceal an unfinished requirement.

## #102 and already-closed #106 — actual mobile acceptance

#106 is closed because the reporter confirmed system camera permission resolved it. Preserve that status unless a new reproduction justifies reopening.

For #102, prepare a short executable device checklist and test accounts/environment. Record actual hardware/OS/browser/release/role, portrait/landscape, touch, sticky tables, dialogs, keyboard/focus/zoom, offline drafts where supported, and camera permission denied/allowed/recovery.

Use physical iOS Safari and Android Chrome. Emulator/viewport screenshots do not satisfy this issue. If devices are unavailable, ask for this specific assistance once, keep the issue open and finish all other work. No production sample edits for device testing.

## #92 — close current Help scope with useful content, not old completion claims

Use WP/help-knowledge-base-v2 and its traceability/content inventory as the current design contract. Inspect current deployed renderer and actual publications first; do not redeploy v1 or republish old seed drafts.

- Map reported role/page tasks to practical published guides and relevant sections; verify contextual blockers, search, FAQs, article bodies, navigation and return-to-work preservation.
- Incorporate new agreed profile/calibration/receipt behavior into guides as those fixes land.
- Verify all five complete locales and source revision coherence. Surface truthful fallback; never mark untranslated or machine-reviewed copy as human-approved.
- Verify admin editing/review/publication controls, public/auth boundaries, lab-note isolation and offline scoped cache/withdrawal on disposable data.
- Reuse working v2 features and correct concrete omissions. Avoid a new Help redesign or new tutorial shell.
- Publish only a reviewed content manifest through established governance; retain old working content until replacement is compatible.
- Report actual content availability and outstanding human usefulness/scientific reviews. Do not claim the standalone preview proves real application acceptance.

## Preserve the separate operational backlog

WP/project-management-audit-v1/46-independent-status-follow-up.md remains separate: non-arrival closure UI, representative 40-sample batch evidence, precise gate/count assertions, configured paused integration restore and report corrections. Do not label these resolved by the GitHub packet or silently fold a new broad workflow redesign into it. Reference them when a tested dependency overlaps, and keep their status honest.
