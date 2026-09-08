# Localization audit findings

## Evidence boundary

Read-only audit of local revision `e06808ca34a2e3a21411e742b33fdc0b6533c8c0`, the live unauthenticated `GET https://lims.yigini.net/api/public/i18n/bootstrap` response, and a supplementary existing-admin-session browser spot check on 8 September 2026. Source scanning covered 222 JavaScript/JSX/TypeScript files without parse errors and found 35 explicit route declarations. This is not an all-role browser certification. The acceptance plan requires those runtime checks before release.

### What the counts mean

| Measure | Observed result | Meaning |
|---|---:|---|
| Local keys per locale | 558 in each of five files | Current file parity is good; the English reference is incomplete. |
| Statically referenced translation keys | 330 distinct | Includes keys used with English fallbacks. |
| Referenced keys missing from English | 70 | Existing `t()` calls can still show their English fallback or raw key. |
| JSX text/attribute/expression candidates | 2,511 occurrences | Strong extraction candidates; repeated labels and invariant terms need adjudication. |
| All source candidates | 4,164 in 179 files | Also includes backend/display-property candidates, some of which are codes/internal values. |
| Local seed catalogue | 176 analyses, 467 methodologies, 10 categories | 1,296 name/description fields; additional configuration/checklist fields remain in scope. |
| Live English analysis-name keys | 216 | Do not treat as the active operational catalogue count. |
| Live non-English analysis-name keys | 260 in each target locale | Extra/legacy/override keys require reconciliation. |
| Non-English analysis names identical to English | 194 in each target locale | Strong evidence of fallback leakage; technical invariants still need an allowlist. |

The live bootstrap has 622 total keys for English, 666 for Spanish/French/Portuguese, and 513 for Latin American Spanish. These counts differ from the checked-out static packs and cannot be used as equivalent coverage percentages. Reconcile deployed files, database overrides, dynamic defaults, and retired keys before migrating.

## Findings and required disposition

| ID | Priority | Finding and evidence | Required response |
|---|---|---|---|
| L01 | P0 | `client/scripts/i18n-audit.js` only compares files against the 558-key English pack. It cannot see untranslated JSX, missing source keys, backend labels, scientific correctness or English fallbacks. | Replace parity-only completion claims with the manifest/runtime checks in the acceptance plan. Keep parity as one check. |
| L02 | P0 | `AnalysisCatalogueContext.jsx:18–39` builds names from raw `a.name`; `utils/analysisNames.js` returns raw/fixed English names. `getTranslatedName` is defined in `i18nHelper.js` but the search found no consuming calls. | One locale-aware catalogue display resolver for selections, bench, sample, workflow, review, reports and integrations UI. Keep codes stable. |
| L03 | P0 | `TranslationService.getMergedTranslations()` starts every locale with English dynamic defaults. Public production responses confirm untranslated names including “Electrical Conductivity (EC)” and “Soil Organic Carbon (SOC)”. | Preserve fallback for resilience but mark its provenance. Never count a fallback as reviewed target-language content. |
| L04 | P0 | `getDynamicKeys()` registers analysis names/descriptions, gate names and categories, but no methodology names/definitions, checklist labels, panel component labels or scientific interpretation text. | Expand the registry to every presentation field using stable entity and field IDs. |
| L05 | P0 | Translation edits use global `Language.translations`. `adminRoutes.js:13–17` uses `MANAGE_BRANDING`, granted to lab managers and master users; `updateLanguage()` replaces the whole global JSON object without lab scope. | Separate translation permissions and server-enforced scope; lab managers must not overwrite wording for other labs. |
| L06 | P0 | `adminController.setDefaultLanguage():269–273` and branding updates bulk-write `User.language` for the whole lab. | Lab defaults apply only when there is no explicit preference. Preserve existing explicit user choices. |
| L07 | P1 | `TranslationEditor.jsx:126–155` counts nonempty strings as translated and sends all nonempty merged values. `updateLanguage()` replaces the JSON blob. No per-key concurrency, draft/published distinction, source freshness or scientific-review evidence is visible in this path. | Save only changed entries; optimistic concurrency, real override reset, reviewed/source-current states, versioned publication and rollback. |
| L08 | P1 | `AdminPanel.handleSaveTranslations()` catches a failure and does not rethrow, while the child editor clears `hasChanges` after awaiting it. Successful saves also do not call the existing `reloadLanguages` helper. | Failed saves retain dirty state and edits; publish reloads the current language bundle safely. |
| L09 | P1 | `LanguageContext` accepts only the five hardcoded bundles. Regional normalization turns `es-GT` into generic `es`; extra admin-added languages may silently normalize to English. `publicI18nController` reports `isActive` but does not filter inactive records. | A canonical five-locale registry, explicit regional matching, filtered active choices, no arbitrary enabled unsupported locale. |
| L10 | P1 | `LanguageContext` reads/writes a global localStorage locale; `AuthContext` can overwrite it with `User.language`. Its separate storage effect may also initialize the key before async branding bootstrap checks it. | A single, tested preference-resolution lifecycle; explicit header/session choice, profile preference, lab and global defaults. No language flash or account crossover. |
| L11 | P1 | `localeMiddleware` has lab/global resolution in comments but not implemented; it takes the first Accept-Language segment without robust matching. Authentication can overwrite the selected request locale afterwards. | One shared locale resolver and a validated explicit UI locale header; reuse for authenticated responses and notification/report rendering. |
| L12 | P1 | `LanguageContext.applyParams` is simple `{{name}}` substitution and blanks missing parameters. There is no plural/gender grammar handling. No document `lang` update was found by the source search. | ICU messages behind the existing adapter, typed placeholder validation, CLDR plural rules and document language updates. |
| L13 | P1 | Status labels span `status.*`, `dynamic.status.*`, hardcoded titles and enum-to-English fallback. Equipment types are emitted as `.label` while the generic name helper asks for `.name`. | Domain-specific status keys; consistent dynamic key fields; never use translated text as state identity. |
| L14 | P1 | `Dashboard.jsx` and `dashboardService.js` expose English headings, queue labels, actions and notes. Workbench, sample, reception and workflow components contain extensive literals. | Translate both frontend chrome and backend semantic descriptors without touching queue selection, readiness, counts or routes. |
| L15 | P1 | `ReportContent.jsx` has English headings, ratings and a fixed `en-GB` date formatter. Interpretation text comes from the server. | Explicit report language and immutable terminology/template versions; translate interpretation wording while preserving rules, results and approved report artifacts. |
| L16 | P0 | Numeric handling is inconsistent: `BatchModal.jsx` uses `parseFloat`; texture and paste replace commas; report formatting replaces a comma then uses `parseFloat`. These paths need locale tests before translation expands usage. | Shared, strict laboratory numeric boundary. Preserve raw input and qualifiers, reject ambiguity, normalize once. Do not alter calculations or tolerances. |
| L17 | P1 | Notification schema/controller and `NotificationDrawer` already support message codes and parameters, but messages may also be stored as raw text. | Build on that contract. Add codes at producers; preserve original historic/user messages rather than rewriting evidence. |
| L18 | P1 | Some fallback scientific names are ambiguous: `TEXTURE` is “Soil Texture Class (USDA)” despite panel semantics; `PH_KCL` includes “Reserve Acidity”; aqua-regia names say “Total”. `cataloguePolicy.js` already warns about several distinctions. | Scientific adjudication queue. Do not translate an ambiguous source into an authoritative false statement or silently modify its operational definition. |
| L19 | P1 | Public bootstrap currently includes global dynamic terminology before authentication. Proposed lab-local overrides and reviewer notes must not enter that response. | Public/authenticated bundle boundary; public approved content only, scope-aware authenticated overlays, no private draft metadata in public payloads. |
| L20 | P0 | Live Admin → Languages → Portuguese editor shows **48/469 (10%)**, with 432 dynamic-analysis fields at 5%; the “Soil pH” target input is empty. This total is below the local English pack's 558 keys before dynamic content. | Investigate the deployed English/static resource path, build packaging, server/client revision and catalog composition. Do not presume local JSON parity describes production. |

## Highest-volume frontend areas

Examples from the AST inventory: Projects, Reception, SampleDetail, admin API-key management, Dashboard, lab management, SpectralLibrary, SpectraBatchUpload, Inventory, AnalysisManager, BatchIntake, About and SamplesTable. Volume is not priority: safety-critical warnings, result entry and review are translated and verified first.

The inventory intentionally excludes historical WP mockups, dependencies and tests. A tutorial overlay from earlier work is not wired by name in this checkout's `client/src`, `client/index.html` or `server/app.js` search. If production injects a separate tutorial or help bundle, inventory and translate that deployed asset too; do not claim it was covered by this source scan.

The live browser spot check opened Languages and the Portuguese editor without changing translations, defaults, preferences or lab records. The dedicated audit tab was closed afterwards. It also observed the English data-results page and mixed raw system notification wording; original human chat text was not collected into this package. The Portuguese count indicates filled fields only, not a scientific quality score. The exact server packaging cause remains unverified.

## Audit limitations

The AST inventory is an implementation starting list, not exhaustive detection of concatenation, CSS-generated text, canvas charts, JSON-driven UI or external iframe content. All of those require the manual/runtime coverage checks. Production translation keys are public fallback/override keys and do not certify which catalogue records are enabled or assigned to each laboratory. No existing translation in this audit is linguistically certified by its presence alone.
