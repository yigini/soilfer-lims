# Generic project platform with a SoilFER template

21 September 2026. Planning deliverable based on source `762c46e` and the user's confirmed decisions. Read REVIEW.md for evidence, limitations and F01-F15. No application changes or deployment have occurred in this task.

## Product contract

The LIMS is a SoilFER project deliverable and must serve the SoilFER framework reliably, while remaining usable for other projects within the laboratory platform. Do not build a SoilFER-only project manager or make other projects pretend to be SoilFER. Preserve the existing scientific workflow and catalogue; this work does not require a new general-purpose LIMS for unrelated scientific disciplines.

| Project setup | Registration behavior | Shared laboratory behavior |
|---|---|---|
| SoilFER country project | Kobo by default; controlled manual/CSV exceptions | Physical receipt, chain of custody, preparation, workbench, QC, release and reporting |
| Generic Kobo project | Explicit form-to-project-to-lab connections; configurable exception policy | Same workflow and safeguards |
| Generic open-intake project | Authorized staff register samples directly; optional manifest or Kobo channels if enabled | Same workflow and safeguards |
| Generic walk-in work | Staff receive ad hoc samples, with an optional permitted project association; no forced programme or Kobo link | Same workflow and safeguards |
| Existing manifest project | Predefined identifiers remain supported | Same workflow and safeguards |

Kobo connection health, permitted registration channels, project lifecycle and physical sample receipt are distinct facts. A Kobo outage never silently changes the admission policy. Walk-in is a reception/registration path, not a reason to create a fake project for every customer.

## 1. Project and policy model

- Keep stable Project IDs and unique codes. Resolve either input to the canonical record, then persist its ID and code separately.
- Add optional programme/grouping and country associations. Generic projects may have no programme, span several countries or have no country restriction. Do not derive authorization from these descriptive fields.
- Introduce a versioned project-template/policy model. The SoilFER template supplies registration defaults, required field metadata, relevant analysis-plan defaults, controlled exceptions and reporting requirements. Generic templates supply Kobo, open-intake and walk-in defaults without SoilFER-specific requirements.
- A project stores its applied template version and effective configuration. Distinguish protected template rules from defaults an authorized manager can customize. Template updates must not silently change existing projects, sample orders or released data.
- Use existing catalogue, workflow, membership and audit services. Do not invent a parallel approval or result-entry system. Consolidate source/lifecycle/exception decisions into one server policy service used by all writers and exposed as precise UI capabilities.
- Replace hardcoded SoilFER name/country detection with explicit template/programme association. Branding profile selection alone must not force all new projects into the SoilFER template.
- Validate supported mode/policy values on create and update. Provide a controlled policy-change preview for populated projects rather than silently switching modes.

## 2. Project onboarding and management

Build a short onboarding flow: identity and optional programme/country; owner and participating labs; template and registration channels; Kobo/manifest setup where relevant; analysis plan and target; review/activate.

- Offer a neutral generic project choice as well as the SoilFER template. Show the effective policy in plain language before creation.
- Save incomplete setup as draft with explicit missing requirements. Store credentials through supported secure server handling; never persist them in browser drafts or expose them in responses.
- Allow country projects with more than one servicing lab. Explicitly select the destination lab for every connection and import; the coordinating lab is not automatically the sample destination.
- Provide policy-aware actions for edit plan, manage membership, manage own-lab connection, import by permitted channel, approve exception and lifecycle transitions. Never turn a false capability into true using a role fallback.
- Show planned target, registered, expected arrival, physically received, active work, awaiting review and released with consistent definitions. Define overdue using an applicable due date; awaiting arrival alone is not overdue.
- Preserve admission pause as separate from operational work holds, and completion/archive as separate from scientific release.

## 3. Kobo connections

- Implement explicit project/lab/config-addressed management. Retire ambiguous first-config and null-project write contracts through a compatibility migration that fails clearly when unresolved.
- Show an authorized collection of connections: destination country/project/lab, form, active/disabled state, setup/health state, last attempt, last successful sync, imported/skipped/conflicted counts and useful recovery action. Do not label denied or failed reads as Not linked.
- Normalize response field names and separate connection identity from the project owner. Respect the current schema's one-config-per-lab/project limit unless actual inventory demonstrates a need for multiple forms; if so, migrate that constraint explicitly.
- Make connection writes and their audit/receipt truthful and retryable. If remote validation cannot be completed, save an explicit unverified setup state without falsely reporting a working connection or starting sync.
- Apply the same explicit mapping and scope rules to manual sync, scheduled sync, form-field inspection, sample workspace indicators, single-sample resync and attachment/media access.
- Single-sample resync must authorize the target sample, bind to its source form/project/lab, preserve provenance and field-level overrides, and use the existing amendment rules for protected/released records. Audit every accepted enrichment.
- Retain existing submission transactions, active-lab/membership rechecks, no first-project fallback and cursor recovery. Model manual-only sync explicitly rather than relying on zero intervals that default to fifteen minutes.

## 4. Admission and exceptions

- Check the effective channel policy on single-sample registration, draft save, batch consignments, manifest preview/commit, generic file/sample imports, historical backfill and Kobo ingestion.
- For SoilFER, unknown IDs route to lookup/sync diagnosis or a controlled exception. They are never silently registered as ordinary open intake.
- Admins can authorize exceptions in their permitted scope; lab managers only within their lab. Reception staff use an approved exception but do not gain approval rights simply by entering it.
- Persist exception reason, source/evidence, actor, authorizer, time, country project, lab and affected sample IDs. Reuse approvals for an explicitly bounded batch where appropriate.
- Avoid client booleans that bypass policy. Recheck policy, authorization, revision, current lab membership and exception validity when committing.
- Define operation-specific allowed lifecycle states. Draft setup may validate or stage a manifest; physical receipt and automatic admission require the appropriate activated policy. CLOSED must block new manifest registration as well as desk/Kobo intake.
- Handle later Kobo submissions that match an exception sample through explicit reconciliation, preserving the existing physical sample and lab ID. Report duplicate/cross-project conflicts without overwriting them.
- Keep projectless walk-ins fully usable in an authorized lab. Project-associated walk-ins obey that project's effective policy. Preserve non-SoilFER open-intake workflows.

## 5. Seven-country SoilFER migration

Confirmed scope: existing and future SoilFER samples, starting with Guatemala, Honduras, Ghana, Kenya, Zambia, Mozambique and Tunisia. Retain the existing USA/Japan relationship as programme provenance and reporting groupings. Do not add other countries in this release.

1. Establish production revision and read-only inventory. Identify project memberships, sample source country, assigned labs, Kobo forms/configs, consignments, user grants, API scopes, historical reports and offline drafts. The local database is not an authoritative deployment source.
2. Produce a dry-run mapping ledger: old project and sample identity, proposed country project, source evidence, lab/config mapping, affected references and conflicts. Use consistent sample/source country evidence, not merely the servicing lab's location. Treat conflicts and missing provenance as unresolved records.
3. Create stable country projects and validated memberships. Preserve programme targets until authoritative country targets exist; do not invent allocations. Countries without usable forms remain visibly unconfigured, with controlled exceptions as allowed.
4. Migrate operational associations with explicit audit events and retained original project/programme provenance. Do not rewrite historical audit events, sample identifiers, analytical results, released snapshots, report bytes/checksums or original submission identifiers. Administrative reassociation of released samples must preserve their immutable released representation.
5. Reconcile user grants and SIS/API scopes without broadening access. Programme grouping is not an access grant. Retain old links as authorized aggregate/history navigation, with explicit mappings where a reader needs country results.
6. Update Kobo destinations and cursors through controlled mapping. Stop or coordinate writers during cutover so an in-flight sync cannot recreate aggregate-project associations. Retain form-specific deduplication and recovery semantics.
7. Version and reconcile offline drafts/queued requests at next connection; surface conflicts rather than silently assigning a different project. Keep enough mapping history to resolve previously saved references.
8. Reconcile counts, results, histories, attachments, reports and scopes before and after. Make reruns idempotent. Preserve unresolved records in a visible legacy/unresolved view until an authorized data steward resolves them; do not claim full migration with unreported exceptions.

Use a consistent SQLite backup or stop all writers for a filesystem snapshot. Rehearse migration and recovery on an isolated copy, and preserve writes made after cutover when planning rollback. No production write is authorized merely by this planning document.

## 6. Platform-wide connections

| Surface | Required change |
|---|---|
| Projects and settings | Generic onboarding, SoilFER template, country/programme navigation, actual connection health and precise capabilities |
| Reception and consignments | Policy-aware unknown-ID handling, existing Kobo receipt, authorized exceptions, ordinary walk-ins and canonical project references |
| Samples and metadata | Accurate source badges, source-specific connection resolution, protected enrichment and retained original provenance |
| Workbench, preparation and QA | Stable sample/work-item references and country project context; no analytical queue entry from field registration alone |
| Analysis planning | Explicit project/template defaults applied prospectively through the canonical catalogue; preserve current sample plans |
| Dashboards and search | Authorized country filters, optional programme totals, consistent ID/code resolution and no double counting |
| Imports and backfill | Explicit target project/lab/source, current admission policy, preview receipts, exception and conflict handling |
| Reports and exports | Country and original programme context where appropriate; preserved released artifacts; compatible authorized historical queries |
| SIS and integrations | Canonical project resolution, migrated scope mappings and unchanged release/access controls |
| Offline/cache | Versioned project reference migration, safe queued draft reconciliation and useful conflict feedback |
| Seeds, help and localization | Idempotent non-destructive setup; generic versus SoilFER behavior documented across en/es/es-419/fr/pt; truthful security/status language |

## 7. Delivery and acceptance

Implement in reviewable stages: shared model/policy and regression fixes; generic onboarding/connections; country migration rehearsal; connected readers/help; full acceptance and release preparation. Keep each stage compatible with the current production schema or gate activation until compatible migrations are complete.

Required acceptance includes:

- Create and use a brand-new generic Kobo project, a generic open-intake project, a project-associated walk-in and a projectless walk-in. None inherits a SoilFER bundle, country, programme or exception restriction unless selected.
- All seven SoilFER country projects retain the intended template, restrict ordinary registration to Kobo, and support audited authorized exceptions.
- A missing/failed connection never changes the project to open intake. A configured project shows the correct form/lab and status; ambiguous/denied connections are not reported as absent.
- Test direct API and UI paths under platform admin, national oversight, lab manager, reception, technician, project manager and viewer roles, including negative cross-lab/country cases.
- Test paused/closed/draft project admissions, exception authorization, concurrent membership changes, failed setup, retry/idempotency, form changes and later Kobo matches to exception samples.
- Verify single-sample resync rejects unauthorized targets and preserves protected provenance/released content.
- On migration rehearsal, prove sample/result/report conservation, exact project/lab mapping, no access expansion, correct aggregate/country counts, stable historical URLs, valid SIS scopes and an idempotent second run.
- Re-run applicable existing project governance, Kobo mapping, reception, deployment-profile and workspace tests; add focused regression coverage for F01-F15 and the generic onboarding journeys. Run the normal client build/server checks and inspect relevant UI in supported roles, mobile layouts and locales.
- Deliver finding-to-fix evidence, remaining exceptions, migration ledger and rehearsal results, reviewed commit/PR and deployment procedure. Report a deployed revision only after authorized deployment and live verification.

No further product questions are outstanding. Technical/data conflicts discovered in production inventory should be reported with concrete affected records and proposed resolution, not silently guessed or escalated as broad repeated permission requests.
