# Complete localization of SoilFER LIMS

Prepared 8 September 2026 for Antigravity in `C:\Users\yigin\Documents\soilfer-lims` (project LIMSI).

This package is a researched implementation plan, not a localization deployment. Application source and production data were not changed.

## Read in this order

1. [Implementation plan](IMPLEMENTATION_PLAN.md) — target behavior, architecture, responsibilities, migration and release sequence.
2. [Audit findings](AUDIT_FINDINGS.md) — observed gaps, production/source discrepancies, and file references.
3. [Scientific terminology](SCIENTIFIC_TERMINOLOGY.md) — terminology research, translation examples, scientific traps and review rules.
4. [Coverage and acceptance](COVERAGE_AND_ACCEPTANCE.md) — whole-platform coverage and release criteria.
5. [Antigravity prompt](ANTIGRAVITY_PROMPT.md) — the implementation handoff prompt.

## Evidence and working assets

- `audit-summary.json`: measured source and public-production findings.
- `source-text-inventory.json`: 4,164 extraction/review candidates across 179 files, including 2,511 JSX text/attribute occurrences. Candidate counts are not a count of distinct messages or a percentage of untranslated screens.
- `locale-pack-audit.json`: all five local files have 558 populated keys, but 70 statically referenced keys are absent from the English reference.
- `live-bootstrap-audit.json`: the public production translation response; 194 analysis-name values in each non-English locale match the corresponding English value.
- `live-ui-spot-check.json`: supplementary read-only admin editor observation (Portuguese: 48/469 filled); no translations or preferences were saved.
- `live-public-analysis-names.json`: 216 English analysis-name keys exposed by the production bootstrap. These are translation keys, not a certified count of active analyses.
- `catalogue-translation-review-matrix.json`: all 176 checked-in seed analyses, 467 methodologies and 10 categories; 1,296 name/description fields to reconcile and review. Blank translations are intentionally unreviewed, not completed work.
- `scientific-glossary-draft.json`: proposed five-locale terminology examples with review status and scientific notes.
- `API_CONTRACTS.md`: proposed additive bundle, scoped editing, review, publishing and conflict contracts.
- `audit-localization.cjs`: repeatable read-only audit. It writes only this package and makes one GET request to the public translation endpoint. It does not initialize Prisma or access the production database.
- `package-validation.json` and `HANDOFF_MANIFEST.json`: package consistency checks and file hashes. These verify the handoff assets, not application behavior or scientific correctness. Re-run `validate-package.cjs` after editing this package.

## Decisions

Support the existing five locale choices: `en`, `es`, `es-419`, `fr`, `pt`. Keep all lab workflows, permissions, codes, calculations and integrations intact. Translate every system-owned user-facing message and every applicable catalogue field, including reports and operational instructions. Preserve original user/field/instrument data.

The practical management model is one **Languages & terminology** area: system administrators maintain shared translations; lab managers review scientific wording and maintain permitted local wording for their own laboratory. Publishing a translation never changes an analysis definition or approves a result.

No language may be called complete simply because it contains an English fallback or because a translation field is nonempty. Completion requires coverage of the actual product and review of meaning.
