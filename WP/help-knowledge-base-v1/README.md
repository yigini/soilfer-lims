# SoilFER Help Centre — implementation handoff package

Prepared for **LIMSI / Antigravity**, 10 September 2026.

Working folder: `C:\Users\yigin\Documents\soilfer-lims`.
Package folder: `WP/help-knowledge-base-v1`.

**Status:** handed over to Antigravity in LIMSI / LIMS Dev on 10 September 2026. Delivery and the start of package reading were verified; see HANDOFF_RECEIPT.json and SENT_MESSAGE.md. The preparation work changed only this design package. Implementation and deployment completion have not yet been verified. Article drafts have not been approved or published by this package.

## Review the design

Open [review-preview.html](review-preview.html) in a browser. Use the review controls above the design to switch among Help Centre, FAQs, article reader, workbench help and content editor. Select Technician, Reception, Lab manager or Administrator; try Light/Graphite and the five interface languages.

Try searching for **MIR**, opening a common question, reading the full guide, and going back. In Workbench help, close the panel, change the demonstration pH value, open help, read related guidance and return: the input is retained. Content-editor changes and support requests are simulations and cannot affect LIMS. Core interface labels demonstrate localization; the article bodies and some surrounding preview labels remain English. The language fallback is explicit.

The shell and demonstration worksheet are simplified to show placement. Implement using the real headers, navigation, components and design tokens; do not replace existing laboratory screens with the mockup.

## Read in this order

1. [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — experience, entry points, integration and phases.
2. [CONTENT_CONTRACT.md](CONTENT_CONTRACT.md) — approved revisions, permissions, lab notes, translations, search, APIs and offline content.
3. [RESEARCH_AND_AUDIT.md](RESEARCH_AND_AUDIT.md) — observed source, obsolete documentation, references and remaining verification.
4. [COPY_DECK.md](COPY_DECK.md) — 27 English editorial drafts across eight categories, with practical steps and review owners.
5. [ACCEPTANCE_TESTS.md](ACCEPTANCE_TESTS.md) — implementation release gates and laboratory scenarios.
6. [ANTIGRAVITY_PROMPT.md](ANTIGRAVITY_PROMPT.md) — prepared instruction to send after the user gives the implementation go-ahead.

## Assets and contracts

| File | Purpose |
|---|---|
| content.en.json | Structured source for the 27 article/FAQ drafts. One answer supplies every preview surface. |
| ui-copy.json | Proposed common interface labels in en, es, es-419, fr and pt. Requires language review. |
| translation-review-matrix.json | Source hash and explicit pending verification/translation/approval status for every draft and language. |
| route-help-map.json | All 36 route declarations and 15 readiness codes at the audited baseline, plus public/restricted handling. |
| source-baseline.json | Commit and hashes for selected audited source files. |
| help.template.html | Editable, scoped prototype source. |
| help-centre.fragment.html | Generated conversation preview; uses the host's Lucide/Tweak helpers. |
| review-preview.html | Self-contained browser review, local icons and controls, no server connection. |
| screenshots/ | Seven design views for implementation discussion. |
| preview-qa.json | Prototype checks and responsive matrix; not evidence of production validation. |
| build-preview.cjs | Validates IDs, locale keys and route mappings; regenerates preview and copy assets. |
| verify-preview.cjs | Exercises the isolated browser preview. |

## What the implementation must preserve

Help adds guidance without changing laboratory rules, values or workflow. It must preserve unfinished entry and show the actual server's blocker explanations. One approved content revision supplies FAQs, pages, contextual help and search. Approved local notes are scoped and labelled. Draft text never becomes a published seed by default. Existing desktop functions and appearance remain intact apart from modest Help additions.

The prepared content is a substantial starter collection, not a substitute for method/SOP review or a fully translated operator manual. Antigravity must verify the actual release, complete specialized route guides listed in the audit, translate and review the agreed five-language collection, and meet the application acceptance gates before calling the feature ready for laboratory use.

## Rebuild locally

From the repository root, run with Node:

```powershell
node WP/help-knowledge-base-v1/build-preview.cjs
node WP/help-knowledge-base-v1/verify-preview.cjs
```

Build uses existing client React/Lucide dependencies. Preview QA currently points to the bundled Node/Playwright environment and installed Chrome on this computer; adjust the Playwright require and browser path on other machines. No package installation or database access is required. Generated output stays in this package and the current task's visualization folder.

## Handoff boundary

Share the whole package directory, then use ANTIGRAVITY_PROMPT.md as the chat instruction. Antigravity should first reconcile ongoing source changes, then implement in scoped commits and use the existing GitHub/CI/release process under the user's implementation/deployment authorization. Do not copy the prototype wholesale into the application or seed unreviewed guidance as published.
