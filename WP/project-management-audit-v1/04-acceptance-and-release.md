# Acceptance and release evidence

Passing the current defect probes is not the goal: they intentionally describe broken behavior. Convert them into assertions of the corrected behavior. Keep baseline evidence separate. Run all writes against disposable fixtures/staging; production verification is read-only unless the user explicitly approves a named test record/action.

## Required test fixtures

Three active labs A/B/C (A/B same country; C outside it), one inactive lab, one central multi-lab project, one owned project with a servicing lab, one country-only legacy record, one conflicting record, one empty project draft, and one archived project. Users cover administrator, national manager, owner manager, service manager, explicitly granted coordinator, empty-grant coordinator, intake officer, technician, restricted viewer and deactivated principal. Use a project whose id differs from code.

Samples cover expected, draft, physically received, preparation, analysis draft, submitted, returned for correction, released, amended/reopened, rejected before receipt, rejected after receipt, cancelled, stored/archived/disposed and unknown state. Include 15 tasks on one sample, a same-label conflict, leading-zero field IDs, code-only ownership, conflicting id/code ownership and a RESTORE legacy record. Import profiles cover two labs/two Kobo assets and a restricted SIS key. No real credentials or external requests.

## API and integrity cases

| Test | Expected result |
|---|---|
| A01: foreign project detail/stats/labs/samples/import run/Kobo metadata by known ID | Deny consistently; no target, lab names, counts, samples or foreign conflict details leaked |
| A02: shared-project service manager list, detail, counts, samples, export | Identical own-lab sample scope; cannot archive/edit whole project or remove other lab |
| A03: owner manager generic PUT with status/owner/assignedLabIds | Reject or route through exact authorized command; unknown status rejected; no silent junction divergence |
| A04: national manager targets outside-country lab or multi-country governance beyond delegation | Deny; no partial project/config/grant/audit mutation |
| A05: coordinator create/edit/read and empty grant | Consistent defined capability; newly created project has explicit authorized creator grant if creation allowed; empty scope never global |
| A06: remove all explicit service labs, including country-only fallback case | Explicit empty remains empty; no inferred grant resurrection |
| A07: inactive lab, lab transfer, staff deactivation/grant revocation | No new prohibited assignments/imports; pending work explicitly resolved; stale sessions and sync reauthorize |
| A08: archive with expected unaccounted shipment, active work/import/transfer | Blocking reasons; no state change or result approval; user can resolve each blocker |
| A09: eligible archive/restore | Exactly one commit/audit receipt, valid response envelope; project/sample/history/report links remain intact |
| A10: delete active/released project | No sample unlinking; policy denies destructive operation, offers governed archive; only eligible empty draft tombstone succeeds |
| A11: injected audit/database failure during create/update/membership/import chunk | Atomic rollback for the affected unit; no success-looking partial state; retry receipt exact |
| A12: lost response and duplicate same idempotency key; concurrent revision change | Exactly once effect; operation lookup returns result; stale conflict prevents overwrite |
| A13: duplicate sample in create/manifest | Honest row result or atomic rejection; never successful “N registered” if zero were created |
| A14: manifest invalid file/huge file/leading zero/localized header/duplicate/invalid target | Safe mapping preview, bounded server validation, exact rejected rows; no script execution or unintended identifier conversion |
| A15: counts and scope across all known/unknown states | Registered equals stage sum; cumulative received is separate; unknown records visible; same-stage list total matches tile; no task double counting |
| A16: data reconcile dry run/apply/rerun | No grant expansion or sample/result loss; exact before/after references and counts; repeat is a no-op; ambiguity unresolved rather than guessed |
| A17: Kobo missing explicit target, two assets/labs, partial failure/retry, pause queued job | No first-project fallback or duplicate specimens; state rechecked; row and run receipt accurate; secrets absent |
| A18: project source/default plan changes with existing draft/ordered/released samples | Prior origin and effective plan remain; discard/receipt behavior stable; workbench gates/results unchanged |
| A19: archived project through reports/SIS | Authorized released records remain available per release policy; unapproved/draft data inaccessible; project identity remains stable |
| A20: legacy endpoint/deep link/export/direct API and spoofed scope query | Same policy as new routes; no alternate bypass; bookmark opens correct authorized project |

## Realistic lab journeys

1. **Coordinator prepares a shipment**: new project draft → lab mapping → 40-sample preview with one duplicate and one invalid row → resolve → import receipt → activate. Reception sees exactly the eligible samples, field IDs and location provenance. Expected is not received.
2. **Intake officer receives a batch**: open project instructions → find/scan sample → save draft → reopen without losing source/location → receive. Project and intake dashboards agree on the new physical-arrival event; received sample reaches the workbench through existing services.
3. **Technician processes 40 soil samples**: project link opens a method-focused workbench filter. Drying/prep use the existing operational checklist; pH stays a numeric method; texture remains grouped; MIR/NIR stays a spectral file workflow. Project and sample pages only display authoritative progress/results.
4. **Manager handles exceptions**: project attention item → submitted work review. Nothing approves unsubmitted analyses. Returned work becomes actionable for its technician; project count changes consistently after commit.
5. **Owner removes a servicing lab**: impact preview shows assigned work, pending imports and affected staff grants. Resolve/transfer through current services; stale preview blocked. After completion, all pages reflect the same membership and restricted user loses access without losing historical provenance.
6. **Coordinator closes the project**: close admissions, finish outstanding lab work, account for never-arriving expected samples with reason, resolve queued jobs, archive. Reports and authorized SIS reads still show project metadata. Restoration does not unexpectedly resume imports.

## UI, language and reliability acceptance

- Desktop 1440 and 1280, tablet 768, mobile 390 and 320 CSS px; 200% zoom and keyboard-only. No page-wide accidental horizontal overflow; wide sample data scrolls inside a named region. Actual iOS Safari/Android Chrome smoke test before declaring mobile support.
- Role selector in the mockup is a demo only. Production gets actor/scope from authenticated server context, never from a query or client switch.
- All five locales en/es/es-419/fr/pt: page labels, errors, empty states, action reasons, import messages, plural counts, dates, help and analysis names; no raw object messages or untranslated identifiers as primary labels. Manual terminology review plus key coverage.
- Light/default and existing dark-gray profile/session behavior. Contrast target WCAG AA for text and controls; visible focus, labelled inputs, semantic tables, dialogs with focus return, announced async outcomes. Color is never the sole status signal.
- Project API fails, optional labs/groups API fails, count request times out, no permission, no records, all healthy, no active membership, very long name and expired preview. Each state has a truthful message and next action; no failure disguised as zero.
- URL/back/refresh preserve selected project/tab/filter. Notification/help links open correct content. Loading code chunks after deployment handle the existing version/cache strategy without erasing pending drafts.
- Logout/user switch/revocation prevents a new user reading cached prior-user project data. Offline draft preparation is visibly unsynced; no governance operation claims completion offline. Reconnect rechecks scope and revision.
- Fixture at least 30,000 samples and 100 projects; verify list query growth is bounded, counts are aggregated, and first page payload is bounded. Proposed target: project overview p95 under 2 seconds on production-like infrastructure, excluding deliberate external integration jobs; record measured environment/results rather than claim a benchmark from this audit.

## Release order and evidence

1. **Baseline**: record repo URL, current accepted branch, commit, open PR relationships and deployed commit/artifact. Preserve unrelated work; do not force-push or reset. Keep security fixes separate from UI if that makes review safer.
2. **Dry run**: reconciliation report with before/after counts, unresolved exceptions and grant-difference summary. No automatic country grants. Review exact migration output before applying to production.
3. **Staging**: encrypted/appropriately protected production-like backup or synthetic equivalent, disabled external integrations, migration apply/rerun/recovery, test matrix above. Verify released sample/result/report content hashes where applicable.
4. **Checks**: existing required server/client tests, build/lint as configured, targeted policy/import/lifecycle contract tests, browser journeys and role/locale/mobile checks. Do not repeatedly run unchanged full suites after they pass; new findings justify additional targeted checks.
5. **Release**: only with current authorization. Push reviewed changes to GitHub, record PR and exact commit, apply compatible additive migrations and deploy that artifact. Keep legacy routes secured even during feature-flag rollout. Coordinate active imports/SQLite writes; do not replace the production DB with a local file.
6. **Verify**: deployed revision matches GitHub commit; fresh browser session shows workspace; read-only live project counts reconcile with the list/statistics; authorized role landing links work; logs show no helper/type or scope errors. Test updates with an old open tab and new tab to catch chunk/cache incompatibility.
7. **Rollback**: retain prior artifact and tested configuration switch; do not restore an old database over new lab work. Additive schema must support the previous safe artifact, or provide a reviewed forward repair. Preserve stable sample/project links and any security fixes when disabling new UI. External sync jobs remain paused if integrity is uncertain.
8. **Closure**: close only issues whose acceptance evidence exists. Create/link issues for unresolved data reconciliation or deferred improvements; never close a production defect based solely on mockup completion. Final message: implemented, tested, migrated, GitHub commit/PR, deployed revision/time, remaining items. No invented completion percentage or deployment ETA.
