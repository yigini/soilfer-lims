# Antigravity handoff — complete SoilFER localization

Work in project LIMSI at `C:\Users\yigin\Documents\soilfer-lims`. Read `WP/full-platform-localization-v1/README.md`, then IMPLEMENTATION_PLAN, AUDIT_FINDINGS, SCIENTIFIC_TERMINOLOGY and COVERAGE_AND_ACCEPTANCE. This package was drafted for review; do not interpret its presence as a new instruction to implement or deploy until the user sends the implementation handoff.

When implementation is authorized, the objective is full, reviewed localization in the existing five locales: `en`, `es`, `es-419`, `fr`, `pt`. Complete the entire platform, not just navigation or the current JSON files. Preserve lab workflow, APIs, scientific definitions, values, validation, dependencies, RBAC, reports and integrations.

Verified starting facts:

- All five checked-out packs have 558 keys, yet 70 statically referenced keys are missing from English.
- The source audit found 2,511 JSX text/attribute occurrences to review, plus other display/backend candidates; 4,164 total candidates across 179 files. These are candidates, not certified error counts.
- The production bootstrap returns 194 analysis names identical to English in each non-English locale. The live key set differs from the seed catalogue; reconcile rather than deleting legacy records.
- The catalogue seed has 176 analyses, 467 methodologies and 10 categories, contributing 1,296 translatable name/description fields. Include live-only definitions and configurable checklist/output labels.
- AnalysisCatalogueContext/analysisNames bypass the language system. TranslationService does not register methodologies and several other dynamic fields.
- The current translation write endpoint replaces global language JSON and is available through a branding permission granted to lab managers. Implement real scoped translation permissions.
- Changing a lab default currently overwrites its users' language choices. Correct this without changing explicit user preferences.

Implement in reviewable phases:

1. Re-run the read-only audit, inventory all rendered content and reconcile deployed/source/catalogue versions. Export existing overrides before any migration.
2. Extend the existing language adapter with a coherent locale/preference resolver, source manifest, ICU formatting, safe fallback provenance and document language. Avoid a provider/component rewrite.
3. Extend Admin Languages into Languages & terminology with scoped drafts, scientific review, changed-entry saves, import dry runs, revision conflicts, atomic publication and rollback. Lab managers may manage permitted own-lab wording and propose shared changes; they may not overwrite other labs/global terms.
4. Translate all application messages and configured analysis/method/component/checklist fields. Research ambiguous scientific wording using the sources and review matrix; never automatically certify machine drafts. Keep method IDs, ratios, extractants, units, qualifiers and scientific basis unchanged.
5. Wire the same localized display resolver through intake selection, workbench, sample, workflow, dashboards, manager review, spectral library, methods/admin, data results and reports. Translate backend reasons/actions and notifications, not just frontend headings.
6. Include equipment, inventory, projects/maps, staff/profile, QA, imports, KoBo/SIS configuration, public/help/tutorial assets, errors, dialogs, charts, accessibility labels, labels and PDFs.
7. Prove canonical numeric/qualified results are unchanged across locales, including decimal commas, QC, texture, paste/import and report rendering. Preserve unsaved work on language switches.
8. Freeze report locale/template/terminology versions. Publishing a translation must not rewrite an existing approved report or audit history.
9. Complete the five-locale acceptance matrix. Do not claim “100%” for filled fields, English fallbacks or a partial set of screens.

Use the 30-concept glossary as a review seed, not a blanket rename file. The 1,296-field catalogue matrix intentionally contains null unreviewed translations. A correct implementation must complete and review the actual inventory. Existing source ambiguities such as texture panel versus class, pH ratios, and total versus aqua-regia extractable elements go through existing scientific catalogue governance; never silently repair analytical definitions with translation overrides.

The user values straightforward progress updates. Say things such as “The reception forms now use the same language as the menu; I’m checking the warnings and saved drafts next.” Clearly distinguish drafted, reviewed, tested and published. Do not bury the user in raw file lists or claim deployment before verifying it.

When separately authorized to deploy, preserve unrelated work, use the established repository/deployment process, commit and push all reviewed implementation changes, deploy the exact revision and translation releases, verify production without creating lab results on real samples, and update GitHub issues with actual evidence. Leave scientific clarification issues open until resolved. Report the deployed commit, five-locale checks, remaining limitations and rollback reference.
