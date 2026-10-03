# Soil profile identity and configurable reception implementation

Prepared 3 October 2026; Opus v2 amended after independent source review and the owner's subsequent authorization to implement, push and deploy safely without waiting for issue replies. Governing requests: [Eloi issue 140](https://github.com/yigini/soilfer-lims/issues/140) and [Marcos issue 156](https://github.com/yigini/soilfer-lims/issues/156). Status: authorized staged implementation package; application implementation is still pending. Product code and live data were not changed while preparing this package. See CHANGES-FROM-V1.md and REVIEW-EVIDENCE.md for the review and authorization boundaries.

## 1 Outcome and boundaries

Finish the remaining LIMS work for reliable soil profile references and OpenNSIS delivery, then allow authorized laboratories to tailor their intake checks and context without introducing conflicting reception paths.

Deliver four small, independently reviewable and releasable PRs, in this order:

| PR | Issue | Scope | Rough size |
|---|---|---|---|
| **A0** | 140 | Exchange eligibility error semantics (typed 503 instead of HTTP200 empty) and single policy resolution per request. | Small |
| **A** | 140 | Canonical profile reference, capture paths, two-layer fixture, measured performance work, documentation examples. | Medium |
| **B1** | 156 | Reception integrity: one canonical intake operation including existing offline synchronization, server-resolved origin, no fabricated defaults, pinned valid draft revisions, seeded templates and simple manager selection/toggling. | Medium |
| **B2** | 156 | Complete manager configuration: custom criteria/context fields, bounded draft/preview/publish/retire lifecycle, finer authorized bindings and explicit draft-upgrade diff. | Larger |

Sizes are relative planning estimates, not commitments. A0 repairs a demonstrated false-empty failure path; correlation with Eloi's exact requests remains to be measured. B1 provides useful basic configuration and closes reception inconsistencies; B2 completes the requested custom criteria/context capability. The owner authorized the full sequence on 3 October: do not wait for Marcos or Eloi to reply before starting or delivering verified LIMS increments. Their feedback can refine future defaults and receiver tests. Technical acceptance, migrations and safe release gates still apply. B1 establishes the storage foundation; inspect the actual B2 schema needs rather than promising that no further additive migration can be necessary.

All PRs use the same canonical context mappings. A small shared helper can land in PR A; PR A must not depend on completing a generalized form builder.

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

**Inventory first.** Before compatibility logic, inspect a production copy plus retained exchange journals/snapshots. Count both current non-null keys and keys previously emitted for each specimen/revision; record missing, conflicting and held candidates separately. A zero-current count is insufficient to prove there are no historical identities. Only if both current and historical evidence contain no such identities can preservation work be reduced. Do not infer missing codes from Eloi's demo observation.

**Four explicit states.** Use own-property presence and validated semantics, not truthiness:

1. Absent canonical reference: compatible legacy parsing applies, preserving any existing published identity.
2. Valid canonical value: it is the sole source for `profile.code/namespace/key/relation`; emit its saved namespace without recalculation.
3. Valid explicit unknown reference: emit null identity; do not resurrect a site/pit alias as a replacement.
4. Present but invalid canonical reference: reject capture/correction with a useful reference conflict. For already stored malformed data, expose an operator-visible conflict and fail the affected export through the established error/hold mechanism; never silently substitute a different legacy identity or broaden access. This is not a general profile-required eligibility filter, and ordinary lab work can continue with an explicit unknown.

**Published legacy stability is an implementation requirement.** Keeping the old formatter alone is insufficient because it derives namespace from mutable project/country context. Before a relevant rename, country change or transfer can alter a previously emitted key, materialize its exact reviewed legacy code/namespace/key/relation unchanged in a retained compatibility reference, or guard that mutation until preservation is completed. Preserve semantic uncertainty; freezing a site reference does not promote it to a confirmed pit. Do not backfill every historical record automatically. The inventory determines the affected rows, concurrency checks and audit; old snapshots stay immutable. Conflicting historical keys or already emitted malformed keys require a row-specific reviewed correction, not silent cleanup. Any scientific identity correction uses the amendment path separately from exact compatibility preservation.

New captures always write a canonical `profileReference`. For newly captured references, the capture-time resolver prefers the explicitly mapped profile/pit field, then an independently labeled site/plot reference (stored as `relation: SITE_POINT`, never `CONFIRMED_PROFILE`). The namespace persisted at capture time comes from authorized survey/project configuration; where no configuration exists, persist the value the legacy formula would produce at that moment so new and old keys remain comparable, and never recompute it afterwards.

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
| Draft save/reopen/offline queue | Preserve reference, evidence, pinned valid template revision and entered values. New defaults do not invalidate existing drafts; revoked/invalid revisions, tampering or concurrent source edits produce recoverable conflicts. |
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

### PR A0: required code changes (ship first)

1. Replace successful-empty eligibility failures with a typed `503 EXCHANGE_ELIGIBILITY_UNAVAILABLE`, request ID and a bounded `Retry-After` hint. Return no protected payload. Genuine no-data cases remain HTTP200 with `data:[]`; invalid/revoked scopes and credentials retain 401/403 behavior. `buildSampleWhere` must propagate the typed failure. Existing v1/v2 controller catches currently emit generic 500 responses: forward this failure to one shared exchange error handler, preserving status, machine code, correlation and retry header. Internal helpers propagate errors; HTTP boundaries format them. Unrelated errors retain the established handler behavior. Test injected failures through actual mounted routes and middleware ordering, not only a helper mock.
2. Resolve authorized base eligibility once per request. Reuse it for count and list; apply seek/cursor predicates only to a copied list predicate. `buildSampleWhere` has roughly ten call sites in `sisV2Controller.js` alone plus v1, spectral, GeoJSON and stats paths: enumerate every caller in the PR description and confirm each one maps the typed error to 503 rather than a 500 or a silent empty result.
3. Add bounded server-generated request correlation and initialize it before API-key authentication on all four mounts: `/api/v1/data-exchange`, `/api/v1/sis`, `/api/v2/data-exchange`, `/api/v2/sis`. The reviewed server has no existing request-ID middleware to reuse. Do not reflect an arbitrary unbounded client header. Add minimal phase timing for authentication, eligibility, count, list and mapping without sensitive payload logging, so A starts from measurements.

**Receiver coordination for A0.** The owner's authorized update to [issue 140](https://github.com/yigini/soilfer-lims/issues/140#issuecomment-5972150911) is the delivery notice: `503 EXCHANGE_ELIGIBILITY_UNAVAILABLE` is retryable, honours `Retry-After`, retains the checkpoint and previously imported data, and must not be interpreted as an empty dataset or withdrawal. Include that notice link plus the final contract in A0's OpenAPI/operator documentation before deployment. A reply or receiver acknowledgement is not a LIMS release gate under the owner's authorization. Record actual receiver behavior separately; never claim their importer is updated or accepted without evidence. Do not send duplicate reminders or private messages.

A0 does not need the fixture, profile reference or a migration. Its acceptance items are E01, E02, E03, E05, E11 and E07's minimum correlation/timing portion.

### PR A: remaining performance work

4. Preserve coherent count/list semantics through an appropriate read transaction/snapshot when concurrent changes matter. Existing frozen snapshots remain the recommended stable bulk-import path. Keep signed cursor/filter/connection isolation and explicit expiry errors.
5. Inspect `EXPLAIN QUERY PLAN` on a read-only production-sized copy. Scope candidate selection to authorized released rows before expensive provenance JSON evaluation. Preserve exactly the conservative malformed-JSON/hold behavior. Avoid a large global ID exclusion list (`notIn: heldIds` today grows with every hold) or stale permission/hold cache.
6. Add only the smallest indexes justified by actual plans, after checking deployed indexes. Candidate combinations include assignedLab/status/updatedAt/id, but choose based on the query; do not add every conceivable index.

Separately measure SQLite busy waits, key-lastUsedAt telemetry writes and cold exchange initialization. Also check whether `getHeldSampleIds` ever falls back to opening a fresh `better-sqlite3` connection per request (its `new Database(dbPath, { timeout: 2000 })` branch); if so, that is both a latency and a lock-contention source. Coalesce best-effort last-use writes or initialize schema at normal startup only if the trace establishes a relevant bottleneck. Do not merely increase busy timeouts, disable holds or cache authorization to improve response time.

**If the trace shows lock contention** (busy-wait time dominates), use measurements to reduce the demonstrated competing write or connection cost, such as coalesced/deferred telemetry or normal-startup initialization. `server/prisma.js` already configures WAL and a five-second busy timeout; inspect effective settings on actual deployed handles rather than proposing WAL as a missing feature. Report the measured finding. If the p95 target requires a larger architecture change, present the evidence and bounded options instead of silently expanding scope.

Proposed performance acceptance: the unchanged three-specimen cohort has a warm p95 server response below one second under agreed normal staging load, with client/network and cold-start timings reported separately. Use a bounded repeated-read comparison and one realistic larger-page measurement on the production-sized copy. Document the load, hardware and numbers. A single fast request is insufficient evidence; no unbounded load test is requested.

## 7 Versioned intake templates for Marcos

### What Marcos asked for, and how it is split

Issue 156 asks managers to define/edit/enable checklist criteria, select dynamic context schemas by origin/sample/project, and retain the current SoilFER default with simplified/custom external forms. Basic toggles alone do not complete the custom capability. The owner authorized B1 and B2 without waiting for another reply. Versioning, draft recovery and existing offline synchronization are integrity requirements for the paths being changed; a bounded editor lifecycle and explicit upgrade diff follow in B2. This does not authorize a general form-builder platform, automatic role delegation or new laboratory scientific acceptance policy.

**B1: intake integrity and basic configuration (useful first delivery)**

- Schema: create `IntakeTemplate`, `IntakeTemplateRevision` and `IntakeTemplateBinding` now (below), so B2 adds behaviour without another migration.
- One shared canonical intake operation/resolver/evaluator used by single, batch, manifest, older acceptance and existing offline `RECORD_INTAKE` synchronization (section 8). Remove divergent hardcoded checklists.
- Origin and project resolved on the server from persisted records; the submitted `isWalkIn` flag no longer relaxes rules.
- Remove the batch PASS and 0–20 cm defaults; add explicit bulk confirmation with actor/time and per-row exceptions.
- Seed SoilFER (current five checks, behaviour-compatible), general research and commercial soil templates.
- Simple settings screen for the laboratory manager: choose the template per origin (lab default) and per project (using the existing project-management permission), and switch individual catalogue criteria/fields on or off and required or optional. Every save creates a new immutable revision automatically — no separate draft/preview/publish step yet.
- Store revision ID/hash and answers in `receptionData` with each intake; historical records render under their original revision.
- Drafts keep their valid bound revision through save/reopen/accept/sync. A changed default or binding affects new drafts, not this draft. Retired revisions stop new selection but remain usable by bound drafts; revoked/invalid revisions, token tampering or concurrent edits return recoverable 409 with all input retained. Provide minimum reasoned recovery in B1; the explicit upgrade diff follows in B2. Scope autosave keys and migrate legacy keys without deleting them.
- Existing offline intake preserves complete payload, project/origin, reference, template/revision/hash, answers, source/custody/photos and draft-versus-receipt intent. Sync revalidates current scope and calls the same canonical operation transactionally. Never store the institutional lab ID as a specimen accession. An operation ID yields one durable receipt and no duplicate intake on replay; queued drafts never silently become received/accepted samples.
- New interface strings in the five configured languages.

**B2: complete manager editor (authorized following increment)**

- Custom criteria and custom context fields (field types, bounds, localized admin-authored labels with fallback markers).
- Draft → preview → publish → retire lifecycle, emergency revocation recovery.
- Project-manager bindings by project + material + origin; matrix-specific bindings beyond soil.
- "Update draft to current template" explicit diff view; extend B1's existing offline conflict recovery for newly added custom fields. Offline correctness is not postponed to B2.
- Remaining T-items tagged B2 in the checklist.

The detailed design below covers both. Existing-path data preservation, validation, authority and minimum recovery apply in B1; advanced custom editing/lifecycle/diff controls are B2.

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

Create one canonical server intake operation with a shared resolver/evaluator. Single intake, batch/consignment rows, manifest acceptance, older sample acceptance and offline `RECORD_INTAKE` must call it with the same facts, authority and pinned revision. Draft saving allows incomplete answers; acceptance evaluates required criteria/context and admission separately. Receipt-only operations may record physical arrival without implying conformity acceptance or releasing analytical work.

The current offline handler in `server/services/syncService.js:834` creates a received sample directly, retains only notes/capture time in `receptionData` and copies the institutional lab into `Sample.labId`. Replace this separate path in B1. Preserve the full queued command, distinguish existing project specimens from new commercial specimens, use existing accession allocation semantics, validate server scope and retain durable idempotent command receipts. If a legacy queued command lacks revision/context, resolve safely and return a recoverable review requirement when needed; never fill unknown answers PASS or discard payload. Verify queued draft save, queued receipt/accept, repeat replay and stale-authority/revoked-revision recovery with designated synthetic records.

Remove hardcoded checklist arrays from the client/server decision paths after the compatible seed is in place. Frontend validation aids entry; the server remains authoritative. Older acceptance buttons must call the canonical operation or guide users to the reception record, with no API bypass left accessible.

Batch workflow first previews effective templates by row. Bulk “confirm these checks for selected samples” is an explicit human action recorded with actor/time and per-row exceptions. Do not initialize actual checks PASS or observed depth 0–20 without a confirmed observation. The sample already selected from field data should keep its verified individual source values.

Persist the effective revision ID/hash and semantic schema snapshot, answers, applicability and reasoned exceptions in `receptionData` alongside existing facts. Historical accepted records continue rendering their recorded decisions under their original version. Reading a legacy record must not write a new version or retroactively invalidate it.

Publishing revision 2 does not migrate or invalidate valid revision-1 drafts. Binding/default changes apply only to newly created drafts. Revalidate a saved draft against its bound valid revision plus current admission/permission constraints, with optimistic concurrency. Return 409 only for revoked/invalid revision, tampered tokens or concurrent edits; keep answers/photos/source data and provide minimum recovery from B1. In B2, a user choosing “Update draft to current template” previews retained values, new unanswered requirements and retired criteria before explicitly creating the new bound draft version. Retire preserves existing valid drafts and history; emergency revocation requires reason and recovery.

Draft autosave keys include user, laboratory, project/origin, sample or temporary draft ID and template revision. Recover the existing legacy key through an explicit compatible migration; do not delete potentially valuable drafts. Reuse the current offline-outbox/draft approach if present; reconcile revision changes at synchronization and never mark an offline operation accepted until the server confirms it.

## 9 Roles and permissions

Use the actual permission catalogue and existing scope services. Proposed authority must be implemented server-side, not inferred from a role label in the UI.

| Actor | B1 authority | B2 authority |
|---|---|---|
| Global administrator | Manage global seeds and authorized lab configuration; audited. | Custom configuration and lifecycle under existing scope. |
| Laboratory manager | Own-lab basic settings and defaults; project binding only with existing project-management authority and authorized target lab. | Own-lab custom criteria/fields and draft/publish/retire lifecycle; same project/lab checks. |
| Authorized project manager | May select an already approved template only if existing project-management and target-lab configuration permissions both allow it; do not grant capability from the role name. | Finer selectors under the same existing authority; no automatic template-editor grant or membership change. |
| Reception officer | Use effective template, observe facts, save drafts and receive/accept under existing scope; existing exception path. | Same authority; cannot publish rules. |
| Technician | Read intake provenance/outcome; existing workbench tasks unchanged. | Cannot relax rules or generically edit released identity. |
| Viewer or integration consumer | Read within existing scope/publication rules. | No template edits or mutation rights. |

Extend permission names only when an existing capability is insufficient, and migrate bindings conservatively. Do not assign a new configuration grant to every user because they can receive samples. Test every endpoint and object-level selector with disjoint labs/projects, not just menu visibility.

## 10 Connections and user experience

Wire the resolved template and canonical reference through project settings, lab settings, reception lookup/context, checklist/context controls, draft storage, manifest mapping, batch confirmation, sample provenance, read-only intake history, allowed report/export context and exchange outputs.

Use existing theme tokens, accessible controls, translation infrastructure and responsive components. The reviewed configured locales are `en`, `es`, `es-419`, `fr`, `pt`. New labels/help/errors must cover all five, including separate Latin American Spanish where configured. Administrator-written template labels have language variants, visible fallback and missing-translation markers; canonical IDs remain language-independent. Translation never changes submitted semantics. Reuse the existing laboratory-number parser for locale-sensitive entry and store normalized numeric values with canonical units; do not interpret a decimal comma as a different depth.

New UI copy should explain the action, for example: “Commercial soil intake, version 2, selected from this laboratory's default”; “Profile code not recorded; laboratory testing can continue”; “The eligibility check is temporarily unavailable. No data was exported. Retry this request”; “Three new checks need answers. Your existing draft has been kept.”

Do not clutter technician queues with integration diagnostics. Do not change desktop appearance, mobile navigation, result entry or approvals as a side effect. Context views on the sample page remain read-only for results; intake rule editing belongs in governed settings.

## 11 Delivery packages and review gates

Each PR is independently reviewed, merged without bypass, verified on merged-main CI and deployed through the existing backup/migration/cutover/postflight process before the next release. Keep one existing Agy implementation conversation and sequential delivery. The owner has authorized safe push/merge/deploy; no new permission or contributor reply is needed for these increments. Use the finite technical gates, not repeated planning reviews.

### PR A0 for issue 140 (exchange error semantics)

1. Pin current main/deployment; record current behavior of a forced hold-lookup failure (expected today: HTTP200 empty).
2. Typed 503 for eligibility failures through one shared handler; single policy resolution per request; minimal phase timings.
3. Enumerate every `buildSampleWhere` caller and show each handles the typed error.
4. Update OpenAPI/operator docs and link the delivered GitHub retry notice; no acknowledgement gate.
5. Acceptance: E01, E02, E03, E05, E11 and E07's minimum correlation/timing portion. No migration, no fixture.

### PR A for issue 140 (profile identity and performance)

1. Run the read-only historical inventory (P13) first and record the count of released records with a non-null profile key; size the legacy-compatibility work from that number.
2. Add the canonical reference helper, parsing fixes, capture paths and protected correction, plus compatibility tests including Kobo fingerprint versioning.
3. Build the guarded two-layer fixture (J01) in isolated staging.
4. Using A0's phase timings, add only measured query/index/telemetry improvements; reconcile API examples/OpenAPI/operator instructions.
5. Run focused touched-path contracts and existing relevant replay/exchange authorization tests. Supply exact head/CI, fixture IDs, before/after response evidence and a data-migration dry run if needed.
6. Perform LIMS smoke verification and hand the receiver test request to the owner.

### PR B1 for issue 156 (intake integrity and basic configuration)

1. Add template schema, resolver/evaluator and behaviour-compatible SoilFER seed plus research and commercial soil seeds.
2. Wire single/batch/manifest/legacy/offline intake to the canonical operation; server-resolved origin; remove fabricated defaults; preserve full queued payload and idempotent receipts.
3. Add simple scoped manager settings, immutable revisions and pinned valid drafts; recover revoked/concurrent conflicts without data loss and migrate scoped autosave compatibly.
4. Five-language strings for new UI.
5. Demonstrate SoilFER, another research project and commercial soil intake with consistent decisions across single and batch, correct rights and practical bulk operation.

### PR B2 for issue 156 (governance editor)

Proceed after B1 technical acceptance under the owner's existing authorization, without waiting for Marcos. Implement custom criteria/context fields, bounded draft/preview/publish/retire, finer bindings within existing authority and explicit draft-upgrade diff. Extend the already correct offline path to custom data. Reuse B1 storage; any actual extra additive migration requires the same rehearsal gates. No implicit new project-manager grants.

### External receiver acceptance (not a PR gate)

J02–J05 are performed by Eloi's team and tracked on issue 140, not as blockers for merging or releasing A0/A. LIMS work is complete when its own items pass and the receiver handoff is delivered.

After relevant checks pass, progress to delivery. Do not repeat full suites or add speculative hardening absent new changes/failures. No extra monitor, parallel Agy worker or reopening accepted theme software. The existing monitor remains dedicated to its outstanding manual theme qualifications until the owner changes its scope.

## 12 Migration and release safety

Keep application schema migration and historical source correction separate. Adding template storage does not authorize rewriting legacy facts. Rehearse migrations and any source repair on a backup/copy, show row counts and field-level diff, and prove a second execution is idempotent. Runtime migration failures must be explicit; never fall back to easier intake rules or unscoped exchange.

Use the established stopped-writer backup/cutover safeguards for any schema/data mutation requiring them. Bind deployed source/image/configuration to the accepted commit and test the touched operations with designated accounts/data. Do not print credentials. Preserve current users/labs/projects/results and unrelated queued work.

Before production writers resume, rollback may use the reviewed stopped-writer baseline. After writers resume, do not restore an old database and discard new work; prefer code rollback/feature disable with retained additive data and a reviewed reconciliation if needed. Intake answers/audit must remain recoverable if the new editor is disabled.

## 13 Completion and issue handling

Use ACCEPTANCE-CHECKLIST.md as the finite completion record. Every completed item needs the actual environment/action/result/evidence. A scenario definition, static mockup or successful HTTP fetch is not an executed receiver test.

Issue 140: update with completed LIMS fixes, actual deployed identity, measured timings, fixture scope and any remaining receiver-owned steps. Keep open until its remaining grouping/replay/amendment/withdrawal acceptance is actually recorded or the owner and Eloi explicitly agree a separate tracked receiver issue. Avoid automatic `Closes #140` while that work remains.

Issue 156: after B1 report the useful initial delivery; keep it open for B2 custom criteria/context fields. Close after the authorized B1+B2 scope is verified and live: configurable/custom rules/forms, shared online/offline validation, draft/history preservation, scope and practical operator journeys. Marcos's feedback is welcome but is not an implementation or closure acknowledgement gate. Any genuinely unfinished requirement remains explicitly tracked; do not close issues 102/103 or unrelated contributor work.

Final owner report should say what staff can now do, what changed in the connection, whether it is live, which original data were preserved, and the exact remaining external dependency if any. Friendly progress messages should name the current concrete task and result without claiming completion early.

## 14 Proposed implementation contracts

These are proposed routes/data contracts for Agy to implement against existing conventions. They are not currently deployed endpoints. Keep the existing scoped reception context resolver as the primary read path rather than making the browser independently resolve rules.

| Operation | Proposed route or extension | Authority and behavior |
|---|---|---|
| Resolve form for an existing sample/draft | Extend `GET /api/reception/sample-context/:id` | Existing RECEIVE_SAMPLE and object scope; returns saved/effective template, revision/hash, schema, answers, source and capabilities. Pure read. |
| Resolve form for new intake | Extend scoped `GET /api/reception/sample-context` with authorized project/origin/matrix | Do not accept a claimed lab/project outside caller scope. Defaults come from the server. |
| List own-lab templates | `GET /api/labs/:labId/intake-templates` | Own-lab settings read capability; reception receives only necessary published definitions through context. |
| Save basic settings (B1) | Scoped template settings operation following existing route conventions | Own-lab configuration and optimistic concurrency; validates and atomically creates an immutable active revision with audit. No in-place published revision edit. |
| Create/copy template draft | `POST /api/labs/:labId/intake-templates` | Own-lab configuration capability; cannot overwrite a global seed. |
| Edit draft revision | `PUT /api/labs/:labId/intake-templates/:id/revisions/:revisionId` | Draft only, schema validation and If-Match/revision concurrency. Published edits return conflict. |
| Publish revision | `POST /api/labs/:labId/intake-templates/:id/revisions/:revisionId/publish` | Preview/validate first; configuration authority and audit. Idempotent for the same already-published revision. |
| Retire template/revision | Explicit scoped lifecycle operation on the same resource | New intakes stop selecting it; history and bound valid drafts remain readable. Never hard-delete used revisions. |
| Change project binding | `PUT /api/projects/:id/intake-template-bindings` | Existing project management plus authorized lab selection; schema/idempotency/concurrency validation. No membership change. |
| Change lab defaults | `PUT /api/labs/:labId/intake-template-defaults` | Own-lab configuration authority; unique selector and published revision required. |
| Preview template changes | Scoped preview endpoint for a draft definition or draft intake | Pure evaluation: no sample acceptance, tasks, grant change or historical migration. |
| Capture/correct soil reference | Existing intake DTO plus dedicated scoped provenance correction/amendment operation | Canonical validated helper; protected against generic metadata bypass; post-release reasoned correction journaled. |
| Synchronize existing offline intake (B1) | Existing synchronization command `RECORD_INTAKE` | Calls canonical intake operation under current user/object scope, pinned valid revision and full payload; returns durable idempotent receipt or recoverable conflict without losing device input. |

An effective-template envelope should contain `templateId`, `revisionId`, `schemaVersion`, `schemaHash`, `resolutionSource`, `criteria`, `contextFields`, `savedAnswers` and `capabilities`. An acceptance request includes the specimen/draft ID, the bound revision/hash, answers and existing intake facts; the server independently resolves and verifies them. The browser cannot substitute an easier published template by changing these fields.

The stored intake snapshot records stable criterion/field IDs, effective applicability, canonical mapping, rule revision, answers, actor/time and existing exception evidence. Keep labels/help for historical rendering or refer to the retained immutable revision. Never embed credentials or unneeded personal data in configuration/history.

Error contracts should distinguish validation failure (422 with stable field/criterion keys), scope denial (current 403/404 convention), concurrency/template recovery conflict (409), and exchange eligibility storage failure (503). Localized messages are presentation; machine codes remain stable. A draft save must return a persistence receipt/version, and the UI must not say “saved” until that receipt arrives. Offline queued data is labeled “saved on this device, awaiting synchronization.”

Reference helper tests and schema tests can be grouped under new focused contract files. Reuse relevant existing `sis_adapter_service`, `nsis_v2_exchange`, `nsis_policy_and_scoping`, `nsis_exchange`, `kobo_explicit_mapping`, `kobo_duplicate_provenance`, `reception_compliance`, `reception_package_resolution`, `reception_admissions_pm14` and `reception_post_release_correction` contracts according to the actual touched paths. These names are reviewed existing files, not a requirement to rerun every suite twice.
