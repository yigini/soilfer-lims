# Full translation coverage and acceptance

## 1. Meaning of complete

All applicable system-owned messages, configured terminology and user-facing generated artifacts are registered, translated/reviewed in the five locales, and rendered correctly in their actual contexts. A translated navigation menu does not certify its page. A populated JSON file, English fallback, copied source text, machine draft, or old screenshot does not certify a locale.

Allowed unchanged text must be explicitly classified: brand/proper name, scientific symbol, stable identifier, method/reference code, intentional original user text, or a reviewed term whose spelling is legitimately identical. Exemptions have an owner/reason; no wildcard exemption for a difficult page or an entire analysis category.

Runtime coverage applies to all routes in ROUTE_COVERAGE_REGISTER.md and their conditional states. Mark a route/role combination N/A only when it is genuinely outside that role's access; verify its localized denial/redirect separately. Never grant extra access merely to complete a translation screenshot.

## 2. Surface checklist

| Surface | Required coverage |
|---|---|
| Login/session/public shell | Language choices, branding defaults, authentication/password-change errors, loading, expired session, denial, not found, header/sidebar/footer, theme/profile language controls, accessible labels. |
| Every role dashboard | Correct role's title/instructions, scope, actionable queue names, counts/plurals, next actions, timestamps, empty/refresh/offline/error states, drill-downs and backend block reasons. |
| Reception/intake | Draft restore, project and field sample pickers, custody/compliance, provenance/location, batch/manifest/scan/paste, specimen checks, requested analyses, preparation requirements, intake confirmations and partial failures. |
| Samples registry/detail | Filters, status labels, columns, human IDs, field/request information, workflow summary, assigned work, evidence links, all five tabs, return/amendment/report states, menus/dialogs/tooltips. |
| Workflow maps | Nodes, labels, prerequisite reasons, legend, timelines, inspector, edge meanings, empty/failed loading, zoom controls and export legends. |
| Workbench | Queue/worksheet/submission/history tabs, method selection, human names, numeric/qualified results, drying/prep checklists, texture panel/components/class, spectral import/evidence, batch/QC, paste preview, review, receipt and conflict recovery. |
| Manager/review | Intake acceptance, assignment, submission review, returned/rework comments, dependency blockers, final approval eligibility, report release, amendment and historical evidence exceptions. |
| Master analysis catalogue/lab methods | Analysis/category/matrix labels, descriptions, methodologies, references, unit labels, grouped outputs, checklists, local defaults, validations, scientific warnings, governed edit restrictions and translation completeness links. |
| Spectral library | Spectrum vs prediction vs reference, supported-file profiles, axis/ordinate labels, plots/legends, matching, QC, replicates, model/version/provenance, exclusions, library status, import errors and exports. |
| Equipment | Asset types, manufacturer-original values, qualification/calibration/maintenance status, schedules, booking/availability if present, logs and dialogs. |
| Inventory | Reagents/consumables, units, expiry/quarantine/stock condition, movements, suppliers, lots, disposal and validation. |
| Projects/maps/field | Project settings, collection fields, controlled codelists, geographic controls, provenance, incoming KoBo/SIS mapping, sync/import/export progress and failures. Original place/person/field notes stay original. |
| QA | QC specimen types, comparison labels, failure reasons, numerical explanations, trend axes, reanalysis requests and inspection history. |
| Staff/profile/admin | Role/permission descriptions, scope selection, account forms, settings, language management, lab management, API/connector settings and configuration/audit history. Secret values are never part of translation extraction. |
| Notifications/messaging | Producer title/body/action codes, unread counts, relative dates, notification preferences and system chat captions. Original human messages stay original. |
| Data results/datasheet | Analysis filters and columns, numeric formatting, qualifiers, summary/interpretation labels, pagination, column selector, download dialogs and export modes. |
| Reports/labels | Browser, PDF, public share, report list, preview/release dialogs, interpretation text, signature captions, terminology snapshot, page breaks, paper-only appearance and QR/barcode-safe captions. |
| About/help/tutorial | All system-owned explanatory text, controls, captions, walkthrough steps, onboarding, support links, current route aliases and any separately deployed overlay bundle. Verify source/deployed asset ownership. |

## 3. Roles

Build the test matrix from the current canonical roles registry, not memory or only the two demonstration accounts. Include SUPER_ADMIN, MASTER_USER, PROJECT_MANAGER, LAB_MANAGER, SAMPLE_RECEPTION, LAB_TECHNICIAN, SURVEYOR, AUDIT_USER and every remaining VIEWER/external/client role actually configured in the checked-out registry and production. For each, exercise its real landing queue and authorized routes; preserve current scope and denial behavior.

Full five-locale scenario testing is required for the high-risk lab journey and language-management permissions. For secondary layouts, use component/screenshot parameterization across five locales and representative roles, plus explicit long-label states. Do not claim to have run every possible Cartesian combination if using representative coverage; attach the executed matrix.

## 4. Laboratory regression scenarios

Use isolated staging fixtures; do not submit, approve, discard or manufacture results on real production samples for a translation test.

| ID | Scenario and invariant |
|---|---|
| LAB01 | Receive five expected project samples. Their displayed labels change with locale; receipt facts, IDs, selected analyses and assignments do not. |
| LAB02 | Restore an intake draft in another locale; project/field location, analysis selections, entered values and validation remain intact. |
| LAB03 | An expected/unreceived specimen remains in the expected queue in all locales, never in an actionable drying count because of wording. |
| LAB04 | Complete drying and preparation in their operational editors; switching language does not reset checks, create duplicate events or unlock a downstream task early. |
| LAB05 | Open a 40-sample pH batch with QC, enter a subset, switch locale and continue with Enter. Same sample order, selected method, draft IDs and canonical numbers. |
| LAB06 | Test `6.42`, `6,42`, `0`, empty, negative values where allowed, configured precision, exponent if permitted, and invalid/ambiguous grouped input. No truncation or silent zero. |
| LAB07 | Test `<0.005` / `<0,005`, above-range values and not-measured reasons. Qualifier and value semantics survive draft, submission, review, export and PDF. |
| LAB08 | Paste numeric/texture data with explicit delimiter/decimal profile; preview detects ambiguity and maps sample IDs identically in every locale. |
| LAB09 | Enter sand/silt/clay, check closure and computed USDA class against the existing baseline. All 12 class labels map to the same canonical class IDs. No algorithm/tolerance change. |
| LAB10 | Upload a spectrum using supported profiles; language switching does not alter file bytes/checksum, axis order, units, matching, QC or provenance. Distinguish measured reference from prediction everywhere. |
| LAB11 | Submit work, review it, return for correction, resubmit, accept and release. Each distinct state has the correct translation; canonical transitions, evidence and permissions match baseline. |
| LAB12 | Try final approval before required analyses are submitted/accepted. Every locale shows the localized reason while the same API denies the same action. |
| LAB13 | Review data from another lab/project without permission. Same denial, no scope expansion and no translation metadata leak. |
| LAB14 | Open an approved historical result and released report after a new terminology publication. Original artifact, labels' recorded versions, results and audit remain unchanged. |
| LAB15 | Test equipment calibration due/expired, reagent stock low/quarantined and QC failure. Meaning, due-time boundaries and allowed actions do not change. |
| LAB16 | Exercise offline/error/conflict/partial-batch failure states. Translated retry and conflict explanations preserve unsaved work and the original operation IDs. |

## 5. Translation management scenarios

| ID | Required result |
|---|---|
| T01 | Header session language beats profile only for that session; Profile Save persists explicit preference; inherited user follows lab default. |
| T02 | Lab default changes do not overwrite explicit preferences. Global default changes do not silently change a lab's explicit default. |
| T03 | Shared-device logout/login has no cross-user locale or private-bundle leakage. Anonymous public content stays public. |
| T04 | Language change does not remount forms or clear a draft/upload. `html[lang]` changes; layout remains usable. |
| T05 | Every regional/quality-weighted Accept-Language example resolves deterministically to an allowed locale; unsupported codes are rejected or safely resolved. |
| T06 | Lab manager edits permitted own-lab wording. Attempts to edit/publish another lab or global scope fail server-side, including direct API calls and imports. |
| T07 | Technician cannot publish translations or change method meaning; auditor cannot edit. Qualified reviewer authority is explicit and scoped. |
| T08 | Save draft changes only edited entries. Failed save retains dirty state and gives a translated error. Reloading the editor retrieves the saved draft. |
| T09 | Two editors modify the same revision: the second receives a useful conflict comparison and cannot silently overwrite. Unrelated keys remain intact. |
| T10 | “Use shared translation” removes exactly the chosen override. Empty text is not interpreted as arbitrary deletion or false completeness. |
| T11 | Source changes invalidate prior review. Editing a reviewed draft also invalidates its approval. Stale or unreviewed scientific content cannot publish. |
| T12 | Import detects stale source hashes, unknown/duplicate keys, broken ICU, missing placeholders, wrong scope and invalid entity IDs; no mutations happen during preview. |
| T13 | Publish validates the whole change set and atomically switches the release pointer. Failure leaves the previous release serving. Retried publication is idempotent. |
| T14 | Browser tabs/workers use the new published bundle without losing work; rollback restores the prior release. Referenced report snapshots remain available. |
| T15 | Coverage distinguishes missing, draft, source-changed, reviewed and published. English fallback never counts as reviewed target content. Identical valid terms require explicit invariant/locale review. |
| T16 | All management UI text itself is localized in every locale, including errors, filters, import preview, review and rollback. |

## 6. Automated and visual gates

1. Parse all source assets and dictionary resources: duplicate keys, missing referenced keys, unmanaged JSX/attributes, unresolved dynamic-key registries, blank/non-string messages and obsolete-key handling.
2. Require parity against the complete registry, not only `en.json`. Add every used fallback key to the manifest. Review same-as-English flags with an explicit allowlist.
3. Validate placeholders, types, ICU grammar, plural forms for 0/1/2 and relevant decimals, escaped braces, apostrophes, Unicode accents and known scientific tokens. No blanket regex replacement of formulas or identifiers.
4. Run pseudo-localization with expansion/accented text and targeted long real translations. Check five locales at desktop, tablet/mobile, zoom and keyboard navigation. Inspect ellipsis, accessible names, charts, tooltips, dialogs, error rows and printed line breaks.
5. Verify language-aware display dates/numbers separately from canonical storage/math. Test laboratory timezone boundaries and date-only collection fields.
6. Assert invariant API payloads, status transitions, classifications, identifiers, unit codes, checksums and report results across locale variants. Only presentation and explicit locale metadata may differ.
7. Render PDF/label samples for each locale with accents, superscripts and long method names. Verify embedded fonts and scannable unchanged QR/barcodes.
8. Exercise runtime fallback instrumentation on the route/role scenarios. Record every fallback and resolve it or document a specific legitimate invariant. Never hide a fallback by inserting English into a target pack.
9. Run existing required LIMS build/tests plus targeted new localization tests. Do not rewrite expected values to make accidental scientific changes pass.
10. Reconcile production commit, frontend bundle and published translation release after deployment; test that serving infrastructure actually includes the same locale resources as staging.

## 7. Release checklist

- [ ] All five locale options active and independently verified; scientific/operational English source reviewed too.
- [ ] All 35 currently declared routes and all owned supplemental assets accounted for, including aliases, public reports and error pages.
- [ ] Every current active/historical displayable analysis/method/category/checklist/component has a recorded translation disposition; no seed-only assumption.
- [ ] No required user-facing key is missing, empty, unreviewed, stale or served as an unapproved fallback.
- [ ] Scientific reviewers and locale reviewers recorded; no generated name is falsely marked approved.
- [ ] Full lab/regression and translation-permission checks passed with evidence.
- [ ] No altered core logic, scientific values, result-entry location, approvals, integrations, IDs or report history.
- [ ] Documentation explains header/session versus profile/default language, terminology review, publication, import, conflicts and rollback in ordinary language.
- [ ] Existing overrides backed up and preserved; migration is additive and reversible; no database reset/reseed.
- [ ] GitHub commit/PR and deployment evidence match; only actually resolved issues are closed with evidence.

## 8. Evidence format

For each executed check record ID, route/component, role/scope, locale, theme/viewport where relevant, fixture ID, code revision, translation release, result, screenshot/log reference and unresolved issue. Screenshots alone are insufficient for numeric correctness or RBAC. The release note must distinguish source audit, linguistic review, runtime verification and production smoke checks.
