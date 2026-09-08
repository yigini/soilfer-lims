# Full-platform localization implementation plan

## 1. Outcome and boundaries

Deliver complete, professionally reviewed localization for the existing five locale options: English (`en`), Spanish (`es`), Latin American Spanish (`es-419`), French (`fr`) and Portuguese (`pt`). Every system-owned message visible to a user must be covered: screen text, instructions, analysis and method labels, validation, charts, reports, notifications, accessibility labels, public screens, and supported help/tutorial content.

Translate presentation, not laboratory meaning. Preserve sample and field identifiers, analysis and method IDs, role codes, workflow transitions, dependencies, result-entry rules, submission/approval, calculations, precision, QC limits, instrument formats, and integration payloads. A translation publication is not an analytical-method revision, a result approval or permission to edit a released report.

Extend the existing LanguageContext, catalogue provider and Admin languages area. Do not replace the application, add another independent translation provider, or perform a wholesale component rewrite. Maintain the recently implemented sitewide appearance tokens and both light/graphite themes.

This package specifies implementation; it has not translated the whole catalogue or certified existing translated text. See the audit for verified counts and the terminology review matrix for remaining work.

## 2. Language policy

### Five locale choices

Keep the stored codes unchanged. Label choices in their own language: English, Español, Español (Latinoamérica), Français, Português. `es` and `es-419` are distinct locale products even where their scientific wording is identical. Do not force artificial differences to make them appear translated. W3C identifies `es-419` as Spanish for Latin America: [Language tags](https://www.w3.org/International/articles/language-tags/index.en.html).

Use international, concise laboratory French and regionally appropriate Spanish. For Portuguese, propose a Mozambique-compatible institutional style for the current laboratory context; confirm that editorial choice with the responsible Portuguese-speaking lab reviewer before publishing. Embrapa is a technical reference, not a mandate to copy Brazilian spelling or change the stored code to `pt-BR`. Preserve approved regional synonyms as search aliases. No sixth locale is required for this pass.

### One preference contract

Implement an explicit, understandable model:

1. A language chosen in the header applies immediately as a current-session override, scoped to the signed-in account and tab, retained on reload in that session.
2. Profile offers **Preferred language** with the five locales and **Use my laboratory default**. Explicit Save sets `User.language` or null for inherited behavior. Saving also applies that choice to the current session and clears a conflicting temporary override.
3. Without an explicit session choice: account preference → lab default → global default → English. For anonymous screens: visitor choice → global default → English. Browser regional matching can suggest a choice; it must not override an explicit choice.
4. Changing the lab/global default must not bulk-overwrite explicit user preferences. Label the action “Default for people who have not chosen a language.”
5. Signing out clears the account-scoped session override. Never transfer one person's language preference to another on a shared reception computer. Public visitor preference is separately namespaced.

This resolves today's competing localStorage, profile and branding behaviors. Document the change clearly; do not treat a theme preference as a language preference or share its storage key. Keep the page mounted during a switch: entered values, selected samples, draft IDs, filters, unsaved edits, upload progress and URL remain intact.

Server requests use a validated explicit locale header for the current UI session. Resolve it before falling back to stored account/lab defaults; authentication must not overwrite the chosen locale afterwards. Reports and outbound notifications use their explicit document/recipient policy rather than the operator's browser header.

Use canonical BCP 47 matching, not `split('-')[0]` alone. Examples: `es-GT` and `es-HN` resolve to `es-419`; `es-ES` to `es`; `pt-MZ` to `pt`; `fr-FR` and `fr-SN` to `fr`. Make the region map explicit and test all supported-country cases. An unsupported or malformed code must not become a filesystem path. Keep only the five supported active choices in the product for this rollout.

## 3. Complete content model

### A. Application messages

Use stable, semantic message keys organized by feature, e.g. `workbench.submission.confirm`, `reception.draft.restore`, `sample.review.blockedByPreparation`. Reuse genuinely identical concepts, but do not reuse a generic “accepted” key where sample receipt and analytical verification mean different things.

Each message definition contains English source text, feature, description/context, location references, risk class, placeholder names/types, and source hash. Keep short/long variants only where the product actually needs both. Do not derive keys from English sentences, localized labels, array position, or mutable laboratory names.

Extract all JSX text, attributes, ternary branches, toast/dialog content, form options, schema validation, empty/error/loading states, chart labels, date phrases, copy/download feedback and accessible text. Also inventory CSS pseudo-content, canvas overlays, image alt text and externally loaded product assets. Each candidate is classified as translated message, intentional invariant, original user data, or non-user-facing code. Record the reason for exclusions.

### B. Scientific and configurable content

Translate by stable entity ID + field. Extend the registry for:

- Analysis display name, short display name when needed, description and allowed search synonyms.
- Methodology name and explanatory description, with exact method/reference/version retained.
- Analysis categories, matrix labels, modules, result component labels and units' written names.
- Operational gates, checklist instructions, evidence labels, reason options, preparation conditions and instrument prompts.
- Grouped texture outputs and computed classification display labels.
- Equipment classes, maintenance/calibration terminology, reagent categories, condition and storage labels.
- Agronomic interpretation labels, scientific advisory templates, QC messages, report notes and legends.
- Controlled field/SIS/KoBo codelist labels and import mapping descriptions, where this application owns the presentation.

Do not copy a translated name into `Analysis.name` or replace source method descriptions. Keep canonical operational definitions and translations separate. Source definitions may need scientific correction, but that uses the existing analysis-governance workflow and is a separate, traceable decision.

The checked-in catalogue contributes 1,296 translatable fields, not just 176 names. Reconcile every live active and historic displayable entity against that matrix; production currently exposes a different set of translation keys. Add locally created analyses, methodologies, gates, components and aliases. Retired methods remain translatable for historical views even if no longer orderable.

### C. Original and machine content

Preserve sample/field IDs, project codes and names, person names, place names, customer text, free-text observations, supplier/manufacturer names, original SOP filenames, raw instrument files, checksums, API codes, enum values and SIS/KoBo identifiers. Localize captions around them. A user-authored note may show its declared original language; never silently rewrite it as a translated official record. A separately requested translated note must retain the original and be clearly identified.

For third-party screens/embedded maps, localize controls through the vendor's supported locale API if available; otherwise inventory the limitation and provide an accessible localized wrapper/alternative. Do not claim ownership of translation of an external website.

## 4. Runtime architecture

### Retain one adapter

Keep `useLanguage().t()` as the migration boundary. Add a production-grade ICU MessageFormat formatter inside it; do not implement plural grammar with English `count === 1` checks. [FormatJS Intl MessageFormat](https://formatjs.github.io/docs/intl-messageformat/) supports messages with number, date, plural and select arguments using browser/Node internationalization APIs.

Maintain compatibility with today's three `t()` signatures during migration. Give each manifest message a format version (`legacyInterpolation` or `icu`) rather than guessing from braces. Convert validated legacy `{{name}}` messages to ICU deliberately; nested plural braces cannot be converted with a blind global replacement. Remove legacy formatting only after the manifest and all consumers have migrated.

Require placeholder parity/types and a valid `other` branch in ICU messages. Preserve React escaping; translators cannot supply executable HTML. Use predefined rich-text slots for links or emphasis. A malformed draft cannot reach a published bundle. Runtime failure retains a safe last-known published bundle and reports a code/translation-key diagnostic without including entered lab values.

### Resolution and provenance

Resolve each key in this order:

1. Published exact-locale lab override, if the field is allowed for that laboratory.
2. Published exact-locale global translation.
3. Published parent-locale translation where explicitly allowed (`es-419` → `es`). This is fallback, not reviewed `es-419` completion.
4. Reviewed English canonical message.
5. A safe localized “Label unavailable” with a support reference for an unexpected key; log it for repair. Do not show a UUID or an invented scientific name.

Every resolution carries internal provenance: actual locale, scope, release/version, source hash and fallback reason. The management UI can expose this detail; routine users should see the appropriate label without a flood of technical badges. During release testing, fallback instrumentation must identify every uncovered system-owned string. A genuine technical invariant can count as complete only with a reviewed invariant record.

Keep published bundles immutable and cache them by locale + scope + release ID + schema version. Cache invalidation must work across server workers and browser tabs; publishing must not reset a user's workbench. Public bootstrap includes only public approved content. Authenticated bundles may include authorized lab overrides. Drafts, reviewer names/comments and private lab wording must not leak to unauthenticated bootstrap.

Load the selected locale plus required fallback first, or cache compact precompiled bundles. Avoid sending five full methodology catalogues on every login or loading every translation on every API call. Measure payload size and load time with the complete registry, not today's 558 keys. Include bundle assets in the production build/deploy contract; do not rely on a source path that may be absent from the server image.

### Catalogue names in every consumer

Update `AnalysisCatalogueContext` to depend on locale/bundle release as well as authorized catalogue scope. Its resolver returns localized name and optional canonical identifier/alias; the actual analysis object, code and assignment are unchanged. Reuse it in admin configuration, intake selection, method selectors, batch sheets, sample rows, workflow nodes, manager queues, spectral library, reports and data views. Method resolution must include method ID/revision, not just analysis code.

Search should match localized names, reviewed aliases, canonical English names and exact codes. Select values, filters, result mappings and React row keys must remain stable IDs. Sorting can use `Intl.Collator` for the current locale where name sorting is intended, but never reorder worksheet positions mid-entry or change persisted user selections because a language changed.

### Backend messages and descriptors

Build on the existing response and notification code/params contracts. Introduce a shared client API-message translator for known `errorCode`/`messageCode` plus typed params; migrate raw responses without changing their HTTP status, data payload or failure semantics. Existing clients may retain English fallback fields during the transition.

For dashboards/readiness/capabilities, return semantic descriptors (`labelKey`, `reasonCode`, `params`) alongside stable queue keys/counts/routes. Translate at the display boundary. Do not change the service's readiness calculation while replacing its labels. Inventory conflict details and per-row bulk failures; the explanatory reason is just as important as the button text.

Notifications must be rendered in the recipient's language, not the sender's. Preserve stored original event codes, parameters and historic text. Audit displays translate known action labels; unstructured historic messages remain original evidence. Never rewrite audit history to simulate past localization.

## 5. Practical translation management

Extend Admin → Languages into **Languages & terminology**, and provide a permission-checked entry for lab managers that does not require global analysis-management authority merely to review wording.

### Main view

Show the five locales, published release/date, and actionable counts: Missing, Draft, Needs review, Source changed, Published. Use **Reviewed coverage**, with a visible denominator for the selected scope/module. A card saying “100%” based on filled fields must be removed. Global and lab-local scope selectors must be clearly labeled and enforced by the server.

Offer module filters matching lab work: Reception, Workbench, Samples, Workflow, Reviews & reports, Analyses & methods, Equipment & inventory, Projects & integrations, Administration, Common/public/help. Default to items needing attention. Search accepts the English phrase, local phrase or method/analysis code.

### Editing one term

Show English meaning and source, target text, a short explanation of where it appears, and an in-context preview. Scientific fields also show matrix, methodology/revision, locked unit/basis/ratio, terminology source and reviewer status. Put code and technical identifiers in a details section rather than asking managers to translate raw JSON keys.

Allow a side-by-side five-locale view for terminology consistency. Make “Use shared translation” an explicit reset that removes the local override; clearing an input is not an ambiguous delete. Flag source changes and invalid placeholders immediately. Warn before closing dirty work; preserve it if a save fails. Distinguish **Draft saved** from **Published**. Do not use text meaning “submitted” for a draft save.

Use a simple three-action flow: **Save draft → Send for review → Publish reviewed changes**. Routine UI text can be reviewed/published in a batch by an authorized administrator. Scientific changes require a technically qualified reviewer for that subject and locale. Review the changed entries, not every unchanged entry in a pack. This does not need a separate project-management system.

### Permissions

| Actor | Shared application wording | Shared scientific terminology | Own-lab wording | Publish scope |
|---|---|---|---|---|
| System administrator | Edit/review/publish | Manage; publish only with required scientific review | Inspect/manage when authorized | Explicit global or selected lab |
| Designated global terminology reviewer | Propose/review within expertise | Review assigned subjects/locales | Review proposals if assigned | None unless separately granted |
| Lab manager | Propose improvements | Propose and review within assigned expertise | Edit/review allowed lab fields | Own lab only; shared methods remain governed |
| Technician/reception/project roles | Use published translations; report a wording issue | Use/search approved names | No administrative edits by default | None |
| Auditor | Read permitted releases/history | Read review evidence | Own authorized scope | None |

Introduce explicit capabilities such as `VIEW_TRANSLATIONS`, `EDIT_TRANSLATION_DRAFTS`, `REVIEW_SCIENTIFIC_TRANSLATIONS`, `PUBLISH_GLOBAL_TRANSLATIONS`, `PUBLISH_LAB_TRANSLATIONS`. Avoid granting scientific-review authority merely because someone is a manager. Use server-derived scope, not a trusted client `labId`. Keep master-user oversight permissions explicit; today `MANAGE_BRANDING` must not imply global translation publication.

Allow lab-local presentation of local storage names, local equipment instructions and lab-owned configurable text. Do not allow a local alias to conceal method identity, change extractant, remove a critical warning, or relabel “not received” as “ready.” Shared approval/status terminology stays globally governed. Publication logs show who, when, scope, before/after, source version and review decision.

### Bulk work without code editing

Export a selected scope/module/locale as structured JSON and a translator-friendly tabular export. Preserve ID, field, source hash, current revision, context, source/target locale, translation, review state and comments. Import first produces a dry-run preview: new changes, invalid placeholders, duplicate/conflicting keys, unknown entities, stale source text, out-of-scope edits and proposed deletions. Never silently apply rows by their English label.

Apply only accepted changed entries with optimistic concurrency and an atomic operation within the selected change set. A conflict does not overwrite someone else's edits. For large imports use bounded chunks with an explicit change-set status and retry key; publishing remains atomic. Do not send arbitrary multi-megabyte bodies through unrelated sample import endpoints. Tabular exports must handle Unicode, delimiters, line breaks and formula-like text safely.

A missed translation can be reported from a small “Report wording issue” entry in help or the manager area. Capture only key/route/locale/scope and optional explanation, never the sample's private measurements by default. These reports appear in the same attention list.

## 6. Persistence and publication

Use a small relational version model compatible with the current Prisma/database provider:

- **Message definition/registry**: stable key or entity/field identity, English source, source hash, risk/format/placeholder metadata, and owning feature. Code-owned keys can be generated into a manifest; configured entities are registered from their authoritative records.
- **Translation entry revisions**: locale, scope type, scope ID, key, value, source hash, status, revision number, editor, timestamps, review metadata. Store only changed values, not a new whole language blob on every keystroke.
- **Translation release**: locale/scope, release ID, compatible manifest/schema version, included reviewed entry revisions, publisher and time; immutable after publication.
- **Active release pointer**: changed transactionally after validation. Keep the prior pointer for rollback. Compiled bundles are derived/cache artifacts.

Use an explicit global scope identifier rather than ambiguous null uniqueness behavior. Ensure unique constraints include locale + scope + key + revision. Shared source updates mark translations stale even when the key is unchanged. A modified draft cannot keep a prior scientific review stamp.

Migration must preserve every existing database override and its raw export. Normalize flat/nested key structures without conflating case-sensitive analysis codes or silently dropping collisions. Classify entries as active known key, alias, retired/historic, unknown, or conflicting. Existing filled values become **Imported—review needed**, not automatically “Reviewed.” Existing runtime behavior can remain the compatibility baseline until a complete reviewed release replaces it.

Do not run catalogue seed/reset scripts to translate the production database. Do not delete legacy work or rename IDs to make translation keys match. Import approved shared translations as versioned resources and keep lab overrides separate. Retain terminology/template releases referenced by reports; prune only unreferenced draft/cache data under a defined retention policy.

## 7. Scientific terminology and source governance

Apply the detailed procedure in SCIENTIFIC_TERMINOLOGY.md to every live analysis, methodology, panel/checklist and output label. Use the canonical concept and exact method as the translation unit. The same number may represent different quantities depending on extraction, particle-size basis, digestion, reporting basis or instrument model; preserve those distinctions. ISRIC describes method-specific coding and the separation of original/standardized soil data in its [WoSIS documentation](https://docs.isric.org/globaldata/wosis/faq-wosis.html).

A translation record needs a terminology source or SOP reference, reviewer, review date, locale/style profile, and source hash. Machine-generated drafts can accelerate the first pass; they are never published automatically as scientifically verified. Group equivalent terms for review while retaining separate IDs for genuinely different methods.

Preserve the distinction between orderable texture panel and calculated texture class; measured reference result and spectral prediction; absorbance and reflectance; total and acid-extractable content; quality-control check and approval. Localized abbreviations may accompany canonical abbreviations but cannot replace method identity.

Do not force a scientific correction through the translation editor. For an ambiguous English source, open a definition issue with the method owner, resolve it using the existing catalogue governance, then translate the resolved presentation. Mark the affected item as awaiting scientific clarification in coverage; it cannot be counted complete by hiding it.

## 8. Numeric entry, dates and units

Use `Intl`/CLDR for presentation and a deliberately strict lab parser for entry. CLDR provides locale-dependent number symbols and plural categories; a formatter is not an input parser. [CLDR number patterns](https://cldr.unicode.org/translation/number-currency-formats/number-and-currency-patterns), [plural rules](https://cldr.unicode.org/index/cldr-spec/plural-rules).

- Preserve raw input text while editing. Never reformat a focused result cell merely because the language changed.
- Normalize a confirmed value exactly once into the existing canonical representation, preserving sign, significant digits, configured precision, qualifier, unit and evidence. Do not change storage precision or calculations during localization.
- Support configured comma/point decimals consistently across individual entry, texture, batch QC, paste and imports. Explicitly reject ambiguous grouped numbers such as `1,234` when the format profile does not resolve their meaning. Do not use `parseFloat` to accept a valid prefix of invalid text.
- Preserve empty, zero, not measured, below detection/quantification and out-of-range as separate states. Translate their labels, not the canonical qualifier code. `<0,005` must retain the `<` and normalize to the same scientific value as `<0.005` under an explicit input convention.
- For instrument and spreadsheet imports, use a visible file profile/delimiter/decimal mapping preview independent of the UI language. Do not change CSV parsing or wavelength order because the screen is French.
- Percentage display must not accidentally multiply or divide by 100; retain the existing scientific scale. Texture closure limits, class algorithm and fraction thresholds are unchanged.
- Date-only collection/receipt fields remain calendar dates, not midnight instants shifted by timezone. Timestamp display uses the laboratory's configured IANA timezone. Display and lab-day dashboard boundaries must agree across locales.
- Unit symbols, chemical formulae and scientific constants remain invariant. Localize written unit names, surrounding labels and decimal presentation as appropriate. BIPM permits a point or comma decimal marker while keeping SI conventions: [decimal marker recommendation](https://www.bipm.org/en/-/committees/ci/cipm/92-2003/resolution-2), [SI Brochure](https://www.bipm.org/utils/common/pdf/si-brochure/SI-Brochure-9.pdf).

The user specifically wants functionality preserved. Fix unsafe locale parsing at the input boundary only with regression tests proving canonical outcomes unchanged; do not silently revise analytical formulas, acceptance thresholds or report rounding heuristics under this workstream.

## 9. Reports, labels and integration output

Reports need an explicit `reportLocale` chosen before generation, with a lab default and a preview. Store it with template version, terminology release references and the approved report version. Render all headings, method names, units' written descriptions, status explanations, interpretation labels, notes and signature captions in that locale. Use the existing interpretation engine; translate its message templates without changing agronomic thresholds or advice logic.

A released PDF and its public view must not change when an administrator publishes a better translation or a viewer changes their language. Serve the frozen artifact/snapshot. A newly requested language version of a released report requires a clearly linked, versioned rendition under the existing release policy; it must not overwrite the original, rerun analyses or pretend a new analytical approval occurred. If a formal new-language rendition is out of scope for the first release, keep it explicitly unavailable and retain access to the original rather than silently regenerating it.

Missing required scientific wording blocks publication of that requested translated report—not sample intake, result saving or scientific approval. Preserve the original report and give a clear localized explanation of the unavailable language version. Never translate a method label by guessing solely to make a PDF export pass.

Labels translate fixed captions only. Sample IDs, QR/barcode payloads, dimensions and scanner behavior stay unchanged. Test accented characters, font embedding, line wraps and printing on the actual label sizes. Keep intentional white paper/report styling in dark mode.

Human-readable exports can use localized headers with canonical field identifiers retained in metadata. Machine/API/SIS/KoBo contracts keep their agreed codes, units, field names, numeric convention and semantics. Offer a clearly labeled machine-compatible export; do not silently localize a partner's import template. Translate connector settings, mapping screens, validation feedback and controlled-label displays inside LIMS. External remote forms/documents remain owned by their source system and require a separate managed translation path when needed.

## 10. Delivery sequence

| Phase | Deliverables | Completion gate |
|---|---|---|
| 0. Baseline and inventory | Reconcile checkout/deployed revision, export current translation overrides, runtime route/role coverage inventory, active and historical catalogue reconciliation. | No unknown content source omitted; current work/data state recorded; reproducible audit. |
| 1. Registry and locale foundation | Single locale resolver; adapter with validated ICU support; document language; shared API-message localization; provenance and release manifest. | All five locale-resolution/preference tests pass; no form remount or value loss. |
| 2. Management and safe storage | Scoped draft/review/publish model; translations permissions; change-only saves; import preview, conflict checks, history and rollback. | Cross-lab negative tests; failed-save retention; stale-source and publication checks. |
| 3. Scientific base | Reconciled analysis/method/checklist inventory; reviewed English meaning; five-locale glossary and complete reviewed target fields. | Every applicable field reviewed; ambiguities resolved through catalogue governance; no method identity changed by translation. |
| 4. Daily lab work | Login/shell; each role dashboard; reception; sample registry/detail; workflow maps; workbench numeric/operational/texture/spectral/QC; manager queue and review. | Full lab journey in each locale with identical canonical outcomes and working keyboard entry. |
| 5. Supporting features | Equipment/inventory, projects/maps, staff/profile, QA, admin methods/analysis configuration, messaging/notifications, data results, imports/integrations, public/help/tutorial. | Every route and conditional state accounted for in the coverage matrix. |
| 6. Documents and final QA | Localized print/PDF/public reports, label captions, exports, scientific review, pseudo-localization and long-text/contrast checks. | All acceptance gates pass; no unreviewed required locale fields or unresolved fallback leaks. |
| 7. Staged release | Backup verification, additive migrations, staging rehearsal, exact commit/bundle manifest, small production smoke check using approved test fixtures, rollout and rollback evidence. | All five locales available and verified; source and deployed revision/bundles match; no change to real analytical records from testing. |

Phases may be delivered as reviewable pull requests, but “complete translation” is claimed only after all phases and the final five-locale coverage gate. Do not ship a partial string pass with a new “100%” badge. Translation work can be grouped by module, but a group is not done until its dialogs, errors, backend messages and documents are included.

## 11. Implementation file map

- Client foundation: `context/LanguageContext.jsx`, `context/AuthContext.jsx`, `components/LanguageSwitcher.jsx`, `pages/Profile.jsx`, `main.jsx`, `utils/i18nHelper.js`, locale resource files and generated manifest.
- Server foundation: `services/TranslationService.js`, `middleware/localeMiddleware.js`, authentication locale synchronization, public bootstrap, response helpers.
- Management: `components/TranslationEditor.jsx`, `pages/AdminPanel.jsx`, branding default handling, `controllers/adminController.js`, `routes/adminRoutes.js`, role/capability declarations and Prisma migrations.
- Scientific display: `context/AnalysisCatalogueContext.jsx`, `utils/analysisNames.js`, shared display metadata, analysis/method configuration components, operational schemas, texture/spectral labels, catalogue registry hooks.
- Production surfaces: every file in `source-text-inventory.json`, with explicit adjudication of non-user-facing candidates; routes and modules in COVERAGE_AND_ACCEPTANCE.md.
- Documents/events: `components/report/ReportContent.jsx`, `services/reportService.js`, `utils/reportUtils.js`, report assembly/controller, interpretation service, `LabelPrintDialog`, notification producers and drawer, messaging components.

Do not mechanically replace every English string in these files: English often appears as a canonical code, regex, filename, method standard or stored original text. Replace only presentation and keep the intended semantics.

## 12. Release and handoff requirements

Antigravity must provide a concise progress update in ordinary language after each meaningful milestone: what users can now do, what was checked, what remains. Avoid reporting a wall of internal filenames as progress. Clearly distinguish “translated draft,” “reviewed,” “tested,” “published,” and “deployed.”

Before any future deployment, confirm that the user has asked to implement/deploy this package. This turn requested a plan only. When implementation is authorized, preserve unrelated working changes, use `codex/` for a new branch unless the user specifies otherwise, commit reviewed changes, push to the existing GitHub repository, and use the project's established deployment process. Do not change infrastructure or run a database reset as a localization shortcut.

The final implementation evidence must include the exact Git commit, migrated translation release IDs, five-locale coverage/review counts, runtime test results, report/label specimens, scoped-permission negative tests, production smoke results and rollback reference. Keep scientific clarification issues open until their evidence is resolved; do not close issues just because a translation field is filled.
