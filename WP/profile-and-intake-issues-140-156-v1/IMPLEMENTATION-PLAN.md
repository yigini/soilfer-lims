# Soil profile identity and configurable reception implementation

Prepared 3 October 2026. Governing requests: [Eloi issue 140](https://github.com/yigini/soilfer-lims/issues/140) and [Marcos issue 156](https://github.com/yigini/soilfer-lims/issues/156). Status: implementation proposal ready for Agy. Product code and live data remain unchanged by this package.

## 1 Outcome and boundaries

Finish the remaining LIMS work for reliable soil profile references and OpenNSIS delivery, then allow authorized laboratories to tailor their intake checks and context without introducing conflicting reception paths.

Deliver two independently reviewable PRs. PR A addresses profile identity, test fixtures and measured exchange reliability for issue 140. PR B addresses versioned intake templates and shared reception validation for issue 156. Both use the same canonical context mappings. A small shared helper can land in PR A; PR A must not depend on completing a generalized form builder.

The existing exchange platform from PR149/154, identifiers, approved laboratory workflow, appearance themes, authorization model and receiver separation remain the foundation. Do not rebuild them. No work is assigned to OpenNSIS code or its national deployment. No real analytical values, barcode scheme, account grants or project memberships are changed implicitly.

Ordinary sample receipt, drying, preparation, analysis, approval and reporting must remain possible with unknown soil-profile information. Intake readiness, analytical readiness and suitability for a national import are distinct decisions. A template is never a shortcut around the existing workflow or admission rules.

## 2 Starting state and issues

Current GitHub main is `cb86b207def4d58c40eb2ef7caa1f34368cb145d`. PR157 documentation is merged with successful exact-main CI. The accepted theme runtime remains `v3.5.32-25535b6`; no documentation redeployment is needed. Re-read current main before implementation and preserve unrelated dirty/untracked work.

Eloi already confirmed an actual scoped staging import on 29 September. Remaining acceptance includes a two-layer profile/crosswalk example, receiver replay/amendment/withdrawal and the reported response variability. Marcos requests configurable conformity and context fields. See REVIEW-EVIDENCE.md for sources, exact code locations and limitations. Do not present repository findings as new production reproductions.

## 3 Identity model and scientific meaning

Keep these concepts separate in UI, storage and documentation:

| Concept | Existing or proposed representation | Rule |
|---|---|---|
| Physical specimen | `Sample.id`, exchange `specimenId` | Stable unique ID for one bag/specimen. |
| Field bag identity | `Sample.originalId`, exchange `fieldSampleId` | Preserve the actual field label; no regeneration for SIS. |
| Laboratory accession | `Sample.labId`, exchange `labSampleId` | Identifies one specimen within the lab. Distinct from institutional laboratory ID. |
| Laboratory institution | `Sample.assignedLab`, exchange `laboratoryId` | Governs institutional scope. |
| Soil profile or pit | Canonical reference code plus namespace | May group depth specimens only when supported by recorded source meaning. |
| Site or plot | Preserved independent source reference | A shared location is not automatic proof of a pedological profile. |
| Intake template | Versioned form and conformity rules | Configuration, not a physical sampling identifier. |
| Personal profile | User preferences/account | Outside this work. |

Unknown code is null. Do not infer it by coordinates, removing depth suffixes from bag codes, arbitrary grouping, default 0–20 cm, or matching collector/project alone. Preserve decimal depths. Field collection date and physical reception date remain different facts. No fabricated date/GPS/depth/code is introduced to satisfy downstream required fields.

### Canonical reference

Recommended additive storage: `Sample.fieldMetadata.profileReference`, a validated object inside the existing JSON provenance. Keep original raw/source fields. No new profile table or national soil registry is needed. A dedicated searchable column is a later option only if measured query needs justify it.

The object contains `schemaVersion`, `code`, `namespace`, `relation`, `source`, `sourcePath`, `sourceRecordId`, `recordedAt`, `recordedBy` and `revision`. Use current transport relation values `SITE_POINT`, `COMPOSITE`, `CONFIRMED_PROFILE`, `UNSPECIFIED`. Only an explicitly validated field mapping or recorded confirmation may establish `CONFIRMED_PROFILE`; depths alone do not.

Namespace comes from authorized survey/project configuration or verified field provenance. Persist its effective value with the reference. Project rename, country-display-name change, laboratory transfer or later template edit must not recalculate an existing published key. Do not trust an arbitrary client namespace to bypass authority. OpenNSIS owns the mapping from source namespace/key to national profile IDs.

The API currently emits `profile.code`, `profile.namespace`, `profile.key`, `profile.relation`. Keep those fields and their compatible semantics. Do not rename `key` to documentation's `resolvedKey`. Examples must use actual `sampling.depths`/`sampling.collectionDate` and other current serializer paths, not older documentation's invented top-level alternatives.

### Parsing and precedence

For newly captured references, resolve the canonical validated reference first, then explicitly mapped profile/pit aliases, then an independently labeled site/plot reference. Keep existing legacy export behavior for already released references until a reviewed correction is applied; changing precedence alone must not silently regroup historical receiver data.

Unwrap provenance values before evaluating them. Accept bounded nonblank strings or permitted finite scalar codes, preserving a valid zero as the string `0`. Reject objects, arrays, booleans and accidental `[object Object]` identifiers. Parse confirmation/composite flags explicitly rather than using JavaScript truthiness. If two explicit profile aliases disagree, preserve both source values and return an actionable reference conflict; do not select one silently.

Reuse the shared adapter across v1, v2, GeoJSON, snapshots and journal formatting. An unknown profile remains eligible under the existing OpenNSIS profile when the genuine laboratory accession and other current publication rules permit it. Changing export eligibility to require a profile code is not part of this plan.

## 4 Capture and corrections across all paths

| Path | Implementation requirement |
|---|---|
| Kobo normal sync | Use explicit form field mappings for code, namespace and relation; preserve exact path and submission identity. Do not use a generic suffix match to choose between conflicting fields. |
| Kobo force sync | Same canonical conversion and released-identity protection as normal sync. Force sync is not permission to overwrite a published identity. |
| Kobo replay/change detection | Version fingerprint semantics. Adding fields to a legacy hash must not create false discrepancies for every replay. Legacy baseline remains comparable; true profile changes become reviewed revisions/conflicts. Preserve duplicate/provenance holds and manual overrides. |
| Project/consignment manifest | Add optional code and namespace mapping, separate from site/farm name; preview imported identity and source evidence. |
| Single/manual intake | Optional “Soil profile or sampling point code”, relation and source; namespace comes from effective configuration. Unknown is explicit. |
| Batch intake | Shared source namespace may be selected intentionally. Codes/depths stay row-specific; never copy one pit code across unrelated bags by default. |
| Draft save/reopen/offline queue | Preserve reference, evidence, template revision and entered values. Treat stale revision/source changes as review conflicts rather than deleting input. |
| Sample page, reports and maps | Read-only provenance presentation with human labels; bag/accession/profile remain visibly different. No second result-entry surface. |
| Exchange outputs | Same canonical reference everywhere, with existing spatial-access controls and no extra personal information. |

Implement one reference-normalization helper/service and use it from these paths. Protect canonical identity keys and equivalent aliases in the generic metadata-edit endpoint. Pre-release corrections require existing scoped rights and audit. Post-release corrections require the existing authorized amendment mechanism, an explicit reason and old/new values. They must produce a current revision/change event while leaving old snapshots immutable. Do not ask technicians to resubmit unaffected analytical results merely to correct verified provenance.

Historical changes require a read-only inventory followed by a specific reviewed row plan. Classify records as: existing canonical reference; uniquely verified source candidate; missing source; conflicting source; currently protected/held. Backfill only uniquely attributable evidence. Report old/new namespace/key and impact on already exported records. Missing/conflicting values remain unresolved; no bulk inference. Use idempotent updates, concurrency checks and per-row audit through supported mutation paths. Never run a broad legacy metadata backfill without this review.

## 5 Two-layer fixture and receiver handoff

Use `examples/two-layer-pit.json` as a scenario definition, not a database seed format. Agy must adapt it to actual model requirements and current contract. Build a guarded fixture loader that refuses the production database, requires the named isolated staging/test environment and has an idempotent cleanup manifest.

Create two released synthetic specimens with distinct specimen, field and laboratory IDs; one explicitly confirmed profile code/namespace; depths 0–20 and 20–50 cm; synthetic provenance; and approved observations created through a valid test workflow. Add a separate 20.5 cm precision case and a second namespace with the same local code. Do not mark real specimens approved to make testing convenient.

Use a designated connection scoped only to the staging lab/project. Verify scope before any data import. Prefer isolated staging. If a production-facing sandbox is later necessary, use an expressly reviewed isolated synthetic cohort with no broad scope, normal-dashboard/report contamination or use of real sample IDs; do not silently repurpose the existing three live records.

Eloi's team runs the actual receiver import. Required proof:

- One correct profile with two depth layers and two distinct specimens/bag/accession identities.
- A same-code/different-namespace case remains separate.
- Decimal depth is preserved and not truncated.
- Replaying the same snapshot/checkpoint does not duplicate specimens or observations.
- A reasoned profile correction reaches the receiver; the original frozen snapshot stays unchanged.
- A withdrawal is reflected correctly, and rebaselining after expiry does not lose data.
- Actual receiver counts/checkpoint/receipt reconcile with LIMS's scoped export.

LIMS fetch success and receiver ingestion are reported separately. Agy must not modify OpenNSIS or activate national production ingestion. Existing successful parameter/method/unit mapping need not be rebuilt; Eloi explicitly reported it is receiver-managed.

## 6 Diagnose and fix slow or empty responses

The source proves a hold-lookup failure can yield HTTP200 with an empty list. It also proves the samples handler builds the policy twice, with a global metadata scan each time. These are defects/opportunities in the inspected paths. Correlation with Eloi's exact production report and the cause of five-second delays still require measurement.

### Evidence to collect

Obtain a useful slow/nonempty and fast/empty pair: UTC time, complete URL/query including cursor/filter, response status, `count`, `total`, `hasMore`, cursor presence, duration and connection identifier. Never ask for or log the API key. User authorization is required before messaging Eloi; prepare the evidence request for the owner or existing authorized communication path. Independent work can proceed without waiting for this pair.

Correlate bounded request IDs with deployed image/instance/database identity and phase timings: authentication, eligibility, count, row/result read, mapping and response. Log only minimized operational metadata, not bag details, GPS, analytical payloads, credentials or raw provenance. Show connection identifiers only in authorized operator diagnostics.

### Required code changes

1. Replace successful-empty eligibility failures with a typed `503 EXCHANGE_ELIGIBILITY_UNAVAILABLE`, request ID and a retry hint. Return no protected payload. Existing genuine no-data cases remain HTTP200 with `data:[]`; invalid/revoked scopes and credentials retain their current 401/403 behavior.
2. Resolve authorized base eligibility once per request. Reuse it for count and list; apply seek/cursor predicates only to a copied list predicate. Audit v1/v2 consumers of the shared policy so typed errors are handled consistently.
3. Preserve coherent count/list semantics through an appropriate read transaction/snapshot when concurrent changes matter. Existing frozen snapshots remain the recommended stable bulk-import path. Keep signed cursor/filter/connection isolation and explicit expiry errors.
4. Inspect `EXPLAIN QUERY PLAN` on a read-only production-sized copy. Scope candidate selection to authorized released rows before expensive provenance JSON evaluation. Preserve exactly the conservative malformed-JSON/hold behavior. Avoid a large global ID exclusion list or stale permission/hold cache.
5. Add only the smallest indexes justified by actual plans, after checking deployed indexes. Candidate combinations include assignedLab/status/updatedAt/id, but choose based on the query; do not add every conceivable index.

Separately measure SQLite busy waits, key-lastUsedAt telemetry writes and cold exchange initialization. Coalesce best-effort last-use writes or initialize schema at normal startup only if the trace establishes a relevant bottleneck. Do not merely increase busy timeouts, disable holds or cache authorization to improve response time.

Proposed performance acceptance: the unchanged three-specimen cohort has a warm p95 server response below one second under agreed normal staging load, with client/network and cold-start timings reported separately. Use a bounded repeated-read comparison and one realistic larger-page measurement on the production-sized copy. Document the load, hardware and numbers. A single fast request is insufficient evidence; no unbounded load test is requested.

## 7 Versioned intake templates for Marcos

### Configuration lifecycle

Add a focused “Intake rules and form” area to laboratory settings and a scoped template binding in project settings. Support copy, draft, preview, publish and retire. Published revisions are immutable; editing creates a new revision. Retire stops new selection without rewriting accepted history. An emergency revoked revision produces an explicit recovery flow with draft input retained.

Suggested additive entities:

- `IntakeTemplate`: stable ID, owning laboratory or global seed, name, matrix and status.
- `IntakeTemplateRevision`: template/revision ID, schema version, validated schema JSON/hash, lifecycle timestamps and actor.
- `IntakeTemplateBinding`: authorized lab/project/origin/matrix selector and published revision pointer. Use a normalized unique selector key so nullable project selectors cannot create duplicate effective bindings.

Use the existing migration approach and explicit startup migration version. No database reset, `db push`, destructive replacement or broad grants. Project admission `templateId` and policy channels remain separate from these reception templates.

### Effective template selection

Authoritative precedence:

1. A saved specimen/draft's bound revision and snapshot.
2. An explicit authorized project + material + origin binding.
3. Laboratory origin + material default.
4. A compatible seeded template.

Resolve laboratory, project and sample origin from persisted records and authorized context before conformity validation. A submitted `isWalkIn` flag cannot downgrade a SoilFER sample. Return effective template ID, revision, hash, reason/source, editable capabilities and saved answers through the existing context resolver. Project binding changes require project/lab authority and do not expand membership.

The current model has string client names, not a canonical Customer entity. Start with commercial-origin defaults and project overrides. Do not create a customer-management subsystem or bind security rules to a free-text customer name.

### Supported field and criterion schema

Keep the editor focused rather than exposing a programming system. Support text, textarea, numeric with unit/bounds, date, boolean, controlled single choice and the existing canonical location/depth controls. Support ordering, visibility/applicability by explicit matrix/origin, requiredness, localized labels/help and a small whitelist of canonical mappings. No custom JavaScript, executable expressions, arbitrary HTML or mappings to status/roles/identifiers outside the dedicated identity service.

A conformity criterion has a stable semantic key, translated label/help, applicability, allowed PASS/FAIL/NA states, note requirements and failure severity. Never derive its meaning from a translated label. PASS is an explicit attestation. NA is available only where the published rule permits it and can require a reason. Failure routes through existing rejection or reasoned exception authority, rather than switching to a simpler template.

Custom context fields use namespaced stable IDs and stay distinct from canonical analytical results. Optional hidden fields are retained in history; they are not deleted just because a new template no longer shows them.

### Seeded defaults

- **SoilFER soil intake:** preserve current five-check compatibility and existing admission protections. Keep observed moisture/foreign material separate from conformity interpretation. Preview a justified revised rule if wet arrival is allowed for prescribed drying; do not silently reinterpret existing accepted decisions.
- **General research soil intake:** configurable custody/context and canonical soil sampling fields; optional profile code unless that study actually requires it.
- **Commercial soil intake:** only relevant client/contact, requested testing, mass/condition and available source facts. Agronomic history, profile code and exact depth are optional unless the service requires them. Use actual analysis mass planning rather than globally hardcoded “500g minimum”.

This pass implements these soil templates and a matrix-aware contract/fallback. Do not blindly apply soil fields to water/plant/fertilizer. Other matrices retain existing supported behavior unless a validated template is explicitly published for them; adding a full specialized intake programme for each is outside these issues.

## 8 One reception decision across every surface

Create a shared server resolver/evaluator, not duplicated controller rules. Use the same revision for single intake, batch/consignment rows, manifest acceptance and older sample acceptance routes. Draft saving allows incomplete answers; acceptance evaluates required criteria/context and admission separately. Receipt-only operations may record physical arrival without implying conformity acceptance or releasing analytical work.

Remove hardcoded checklist arrays from the client/server decision paths after the compatible seed is in place. Frontend validation aids entry; the server remains authoritative. Older acceptance buttons must call the canonical operation or guide users to the reception record, with no API bypass left accessible.

Batch workflow first previews effective templates by row. Bulk “confirm these checks for selected samples” is an explicit human action recorded with actor/time and per-row exceptions. Do not initialize actual checks PASS or observed depth 0–20 without a confirmed observation. The sample already selected from field data should keep its verified individual source values.

Persist the effective revision ID/hash and semantic schema snapshot, answers, applicability and reasoned exceptions in `receptionData` alongside existing facts. Historical accepted records continue rendering their recorded decisions under their original version. Reading a legacy record must not write a new version or retroactively invalidate it.

Publishing revision 2 does not silently migrate revision-1 drafts. A user choosing “Update draft to current template” sees a diff: retained fields, new unanswered requirements and retired criteria. Preserve input/photos/source metadata. Revalidate on save/accept with a revision token and optimistic concurrency. Return 409 for changed bindings/revoked revisions or concurrent edits with a recoverable explanation; do not clear input.

Draft autosave keys include user, laboratory, project/origin, sample or temporary draft ID and template revision. Recover the existing legacy key through an explicit compatible migration; do not delete potentially valuable drafts. Reuse the current offline-outbox/draft approach if present; reconcile revision changes at synchronization and never mark an offline operation accepted until the server confirms it.

## 9 Roles and permissions

Use the actual permission catalogue and existing scope services. Proposed authority must be implemented server-side, not inferred from a role label in the UI.

| Actor | Intended authority |
|---|---|
| Global administrator | Manage global seed definitions and authorized lab configuration; all changes audited. |
| Laboratory manager | Draft/publish/retire own-lab templates; select own-lab defaults within approved governance. No other-lab edits. |
| Authorized project manager | Bind an approved template to projects/labs they can manage, without changing lab membership. |
| Reception officer | Use effective published template, observe facts, save drafts, receive/accept within existing permissions and request existing exception path. Cannot publish rules. |
| Technician | See provenance and intake outcome; existing workbench tasks unchanged. Cannot relax intake rules or edit released identities generically. |
| Viewer or integration consumer | Read only data allowed by current scope and publication rules; no template edits or laboratory mutation rights. |

Extend permission names only when an existing capability is insufficient, and migrate bindings conservatively. Do not assign a new configuration grant to every user because they can receive samples. Test every endpoint and object-level selector with disjoint labs/projects, not just menu visibility.

## 10 Connections and user experience

Wire the resolved template and canonical reference through project settings, lab settings, reception lookup/context, checklist/context controls, draft storage, manifest mapping, batch confirmation, sample provenance, read-only intake history, allowed report/export context and exchange outputs.

Use existing theme tokens, accessible controls, translation infrastructure and responsive components. The reviewed configured locales are `en`, `es`, `es-419`, `fr`, `pt`. New labels/help/errors must cover all five, including separate Latin American Spanish where configured. Administrator-written template labels have language variants, visible fallback and missing-translation markers; canonical IDs remain language-independent. Translation never changes submitted semantics. Reuse the existing laboratory-number parser for locale-sensitive entry and store normalized numeric values with canonical units; do not interpret a decimal comma as a different depth.

New UI copy should explain the action, for example: “Commercial soil intake, version 2, selected from this laboratory's default”; “Profile code not recorded; laboratory testing can continue”; “The eligibility check is temporarily unavailable. No data was exported. Retry this request”; “Three new checks need answers. Your existing draft has been kept.”

Do not clutter technician queues with integration diagnostics. Do not change desktop appearance, mobile navigation, result entry or approvals as a side effect. Context views on the sample page remain read-only for results; intake rule editing belongs in governed settings.

## 11 Delivery packages and review gates

### PR A for issue 140

1. Pin current main/deployment, record current connection/contract behavior and prepare safe staging fixtures.
2. Add canonical parsing/capture/correction and compatibility tests, including Kobo fingerprint versioning.
3. Fix explicit eligibility error semantics and single policy resolution; measure latency before further optimization.
4. Add only measured query/index/telemetry improvements and reconcile actual API examples/OpenAPI/operator instructions.
5. Run focused touched-path contracts and existing relevant source replay/exchange authorization tests. Supply exact head/CI, fixture IDs, before/after response evidence and data-migration dry run if needed.
6. Independently review, merge without bypass, verify merged-main CI and deploy through existing backup/migration/cutover/postflight process.
7. Perform LIMS smoke verification and provide the receiver handoff. Joint receiver acceptance remains a separately evidenced milestone.

### PR B for issue 156

1. Add versioned schema/resolver/evaluator and compatible seeded definitions.
2. Add scoped manager editor/project bindings and five-language content.
3. Wire single/batch/manifest/legacy acceptance and preserve drafts/history.
4. Demonstrate SoilFER, another research project and commercial soil intake with consistent decisions, correct rights and practical bulk operation.
5. Run focused acceptance and relevant existing intake/admission/regression contracts; review and release through the same safe process.

After relevant checks pass, progress to delivery. Do not repeat full suites or add speculative hardening absent new changes/failures. No extra monitor, parallel Agy worker or reopening accepted theme software. The existing monitor remains dedicated to its outstanding manual theme qualifications until the owner changes its scope.

## 12 Migration and release safety

Keep application schema migration and historical source correction separate. Adding template storage does not authorize rewriting legacy facts. Rehearse migrations and any source repair on a backup/copy, show row counts and field-level diff, and prove a second execution is idempotent. Runtime migration failures must be explicit; never fall back to easier intake rules or unscoped exchange.

Use the established stopped-writer backup/cutover safeguards for any schema/data mutation requiring them. Bind deployed source/image/configuration to the accepted commit and test the touched operations with designated accounts/data. Do not print credentials. Preserve current users/labs/projects/results and unrelated queued work.

Before production writers resume, rollback may use the reviewed stopped-writer baseline. After writers resume, do not restore an old database and discard new work; prefer code rollback/feature disable with retained additive data and a reviewed reconciliation if needed. Intake answers/audit must remain recoverable if the new editor is disabled.

## 13 Completion and issue handling

Use ACCEPTANCE-CHECKLIST.md as the finite completion record. Every completed item needs the actual environment/action/result/evidence. A scenario definition, static mockup or successful HTTP fetch is not an executed receiver test.

Issue 140: update with completed LIMS fixes, actual deployed identity, measured timings, fixture scope and any remaining receiver-owned steps. Keep open until its remaining grouping/replay/amendment/withdrawal acceptance is actually recorded or the owner and Eloi explicitly agree a separate tracked receiver issue. Avoid automatic `Closes #140` while that work remains.

Issue 156: close only when published configurable rules/forms, shared validation, draft/history preservation, role scoping and requested operator journeys are verified. Do not close issues 102/103 or unrelated contributor work.

Final owner report should say what staff can now do, what changed in the connection, whether it is live, which original data were preserved, and the exact remaining external dependency if any. Friendly progress messages should name the current concrete task and result without claiming completion early.

## 14 Proposed implementation contracts

These are proposed routes/data contracts for Agy to implement against existing conventions. They are not currently deployed endpoints. Keep the existing scoped reception context resolver as the primary read path rather than making the browser independently resolve rules.

| Operation | Proposed route or extension | Authority and behavior |
|---|---|---|
| Resolve form for an existing sample/draft | Extend `GET /api/reception/sample-context/:id` | Existing RECEIVE_SAMPLE and object scope; returns saved/effective template, revision/hash, schema, answers, source and capabilities. Pure read. |
| Resolve form for new intake | Extend scoped `GET /api/reception/sample-context` with authorized project/origin/matrix | Do not accept a claimed lab/project outside caller scope. Defaults come from the server. |
| List own-lab templates | `GET /api/labs/:labId/intake-templates` | Own-lab settings read capability; reception receives only necessary published definitions through context. |
| Create/copy template draft | `POST /api/labs/:labId/intake-templates` | Own-lab configuration capability; cannot overwrite a global seed. |
| Edit draft revision | `PUT /api/labs/:labId/intake-templates/:id/revisions/:revisionId` | Draft only, schema validation and If-Match/revision concurrency. Published edits return conflict. |
| Publish revision | `POST /api/labs/:labId/intake-templates/:id/revisions/:revisionId/publish` | Preview/validate first; configuration authority and audit. Idempotent for the same already-published revision. |
| Retire template/revision | Explicit scoped lifecycle operation on the same resource | New intakes stop selecting it; history and bound valid drafts remain readable. Never hard-delete used revisions. |
| Change project binding | `PUT /api/projects/:id/intake-template-bindings` | Existing project management plus authorized lab selection; schema/idempotency/concurrency validation. No membership change. |
| Change lab defaults | `PUT /api/labs/:labId/intake-template-defaults` | Own-lab configuration authority; unique selector and published revision required. |
| Preview template changes | Scoped preview endpoint for a draft definition or draft intake | Pure evaluation: no sample acceptance, tasks, grant change or historical migration. |
| Capture/correct soil reference | Existing intake DTO plus dedicated scoped provenance correction/amendment operation | Canonical validated helper; protected against generic metadata bypass; post-release reasoned correction journaled. |

An effective-template envelope should contain `templateId`, `revisionId`, `schemaVersion`, `schemaHash`, `resolutionSource`, `criteria`, `contextFields`, `savedAnswers` and `capabilities`. An acceptance request includes the specimen/draft ID, the bound revision/hash, answers and existing intake facts; the server independently resolves and verifies them. The browser cannot substitute an easier published template by changing these fields.

The stored intake snapshot records stable criterion/field IDs, effective applicability, canonical mapping, rule revision, answers, actor/time and existing exception evidence. Keep labels/help for historical rendering or refer to the retained immutable revision. Never embed credentials or unneeded personal data in configuration/history.

Error contracts should distinguish validation failure (422 with stable field/criterion keys), scope denial (current 403/404 convention), concurrency/template recovery conflict (409), and exchange eligibility storage failure (503). Localized messages are presentation; machine codes remain stable. A draft save must return a persistence receipt/version, and the UI must not say “saved” until that receipt arrives. Offline queued data is labeled “saved on this device, awaiting synchronization.”

Reference helper tests and schema tests can be grouped under new focused contract files. Reuse relevant existing `sis_adapter_service`, `nsis_v2_exchange`, `nsis_policy_and_scoping`, `nsis_exchange`, `kobo_explicit_mapping`, `kobo_duplicate_provenance`, `reception_compliance`, `reception_package_resolution`, `reception_admissions_pm14` and `reception_post_release_correction` contracts according to the actual touched paths. These names are reviewed existing files, not a requirement to rerun every suite twice.
