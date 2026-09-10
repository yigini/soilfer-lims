# SoilFER Help & Lab Guide — redesign v2

Prepared 10 September 2026 for Antigravity, project **LIMSI**, chat **LIMS Dev**.

Working folder: `C:\Users\yigin\Documents\soilfer-lims`.

**Implementation authorized on 10 September 2026.** The user has now instructed Antigravity to implement the full v2 replacement and retire the previous Help experience. Read **11_REPLACEMENT_AUTHORIZATION.md** first, then follow this package. At handoff, only this WP directory has changed; the running LIMS and database are untouched. The preview is a design reference, not deployable application code.

## Review first

Open **review-preview.html**. Explore the technician home, a detailed batch-result guide, a drying guide, troubleshooting, page help beside a worksheet, the full library and the content editor. Change the role, language and light/graphite appearance using the prototype controls. These are simulations; no action saves a laboratory result or publishes content.

The prototype is deliberately a reviewable app design, not a screenshot of production. English exemplar articles are substantial; language controls demonstrate translated navigation and a translated drying quick answer. English-only prototype article bodies are explicitly marked. Production acceptance requires the complete five-language collection, not this limited prototype localization.

## Implementation reading order

1. **01_AUDIT_AND_DIRECTION.md** — what is wrong, the observed evidence and the replacement approach.
2. **02_IMPLEMENTATION_PLAN.md** — screens, role journeys, content production, dependencies and work packages.
3. **03_CONTENT_STANDARD.md** — the minimum useful article, editorial rules and authoring templates.
4. **04_CONTENT_INVENTORY.json** and **04_CONTENT_INVENTORY.md** — commissioned articles, meaningful scope, roles, evidence sources and release priority. These are writing briefs, not completed articles.
5. **05_GUIDE_EXAMPLES.md** and **guide-examples.json** — fully written English examples establishing the required quality. Controls marked source-verified still require representative UI verification before publication.
6. **06_TECHNICAL_CONTRACT.md** — one content model, route/control binding, search, translation, permissions, offline, migration and publication.
7. **07_VALIDATION_AND_RELEASE.md** — meaningful user tasks, release gates and safeguards against another empty-content deployment.
8. **08_ANTIGRAVITY_PROMPT.md** — complete implementation instruction, to use after design review.
9. **09_RESEARCH_AND_TERMINOLOGY.md**, **terminology.json**, **traceability.json**, **source-baseline.json** — reference material and evidence.
10. **10_MIGRATION_AND_FAQ.md** and **migration-map.json** — individual migration scopes for all 27 existing articles and 17 worked FAQ answers linked to the detailed guides.
11. **11_REPLACEMENT_AUTHORIZATION.md** — the user's implementation go-ahead, replacement/removal scope, rollback boundaries and completion requirements. This supersedes earlier wording that the package was awaiting implementation authorization.

## What “complete” means

A user can find the relevant task, follow exact actions, recognize the result, recover from common failures and identify who acts next. All active routes, important tabs, all ten configured roles and all enabled result-entry families have explicit coverage. The acceptance denominator comes from the actual feature registry and role/permission matrix. A large number of articles or a green build alone does not demonstrate completion.

The package does not prescribe new laboratory temperatures, analytical formulas, instrument formats or approval authority. It documents the implemented application and links the applicable laboratory SOP. Functional contradictions discovered while writing must be recorded as defects, not explained away with invented workarounds.

## Rebuild and verify this isolated preview

Run `node WP/help-knowledge-base-v2/build-package.cjs`, then `node WP/help-knowledge-base-v2/verify-preview.cjs` from the repository root. The scripts use existing dependencies, do not install packages and never access the LIMS database. Results are written under this package. Prototype verification and actual application verification are distinct.
