# Source audit and design rationale

Prepared 10 September 2026. This is a read-only local source audit, a proposed content/design package and isolated prototype verification. It is not an authenticated live-platform audit or proof of current production behavior. See source-baseline.json for commit and file hashes. Recheck those files when implementation starts; Antigravity may have changed them meanwhile.

## Findings that affect implementation

| Evidence | Consequence for this work |
|---|---|
| client/src/App.jsx has 36 route declarations including aliases, public pages and the wildcard; no Help Centre routes | Add the proposed routes and shared Help entry points. route-help-map.json explicitly covers this baseline; it must be rechecked whenever routes change. |
| Header.jsx and mobile/MobileHeader.jsx have existing theme, language, account and notification controls | Fit the Help control into the existing shell. Do not replace headers or remove functionality to match the mockup's simplified shell. |
| common/InfoTooltip.jsx uses mouse enter/leave on a non-button wrapper | Add focus/touch/keyboard behavior and readable theme tokens through a shared component. Essential field instructions must remain visible. |
| TranslationEditor.jsx already groups terminology, distinguishes language status and supports global/lab scope | Integrate a Help content group and an article-centric review experience rather than a separate unconnected translation system. |
| workbenchReadinessService.js has 14 distinct blocker codes and one calibration warning | Explain supplied codes; do not duplicate eligibility calculations. Mapping all codes does not authorize an action. |
| sampleWorkspaceService.js also returns capabilities and human-readable blockers | Preserve authoritative decisions. Generic help is safer than interpreting an English sentence as a stable machine code. |
| SyncContext and services/offline/* exist | Verify implemented capability and revision compatibility before documenting offline behavior. A source file's existence is not a successful device/synchronization test. |
| docs/book/src/SUMMARY.md and .github/workflows/deploy-docs.yml provide an existing English documentation book/build | Reconcile and reuse approved material, with a canonical export/linking strategy. Avoid maintaining independent copies of operational answers. |
| docs/book/src/usage/sample-workflow.md describes result entry on the sample page and simplified receipt/status transitions | Verify the current release and correct these instructions before republishing. The target model is workbench entry and sample-page inspection. If the application contradicts that, record and fix the defect separately. |
| docs/book/src/usage/spectral.md contains concrete file-format and processing claims | Confirm enabled instrument import profiles, axes, units, metadata and processing semantics before publishing. An extension alone does not guarantee support. |
| Existing About/institutional contact information is not demonstrated to be the operational help desk | Require configured support destinations; do not invent a contact or send to an institutional address by assumption. |

The repository's operational chapters, administrator manual, methods catalogue and existing redesign packages are review inputs. They are not automatically approved laboratory SOPs or evidence of production release status.

## Primary references

- W3C explains that repeated help mechanisms should occur in a consistent relative order. This supports a stable shared Help position; it does not require a help icon beside every field. [Understanding WCAG 2.2: Consistent Help](https://www.w3.org/WAI/WCAG22/Understanding/consistent-help)
- Use an accessible disclosure for FAQs, including keyboard activation and expanded state. Native details/summary is used in the prototype. [WAI-ARIA Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
- A modal mobile help view needs correct focus containment, background handling and focus return. A non-modal desktop side panel should not be given modal behavior. [WAI-ARIA Dialog Modal Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- Vite documents handling dynamic-import loading errors. A recovery guide should protect unfinished laboratory work; the presence of a retry control is not a replacement for deployment/cache correctness. [Vite: Load Error Handling](https://vite.dev/guide/build#load-error-handling)

These sources support interface and recovery design. They do not establish scientific method rules or certify the LIMS. No new laboratory temperatures, time limits, texture tolerances or spectrum import specifications are invented here.

## Editorial verification required

Each article in content.en.json has a proposed review owner and a feature tag. These are assignments to make, not completed reviews. For every launch article, record the actual tested app release, relevant role/lab, exact controls and any controlled SOP revision. Use screenshots from a demonstration lab with non-sensitive examples. Keep credentials, tokens, real results and deployment secrets out of public guidance.

Check these subjects especially carefully:

1. Drying and preparation: operational evidence, confirmation/submission/acceptance semantics, prerequisites and retry behavior. Do not tell staff to bypass a contradictory state through another page.
2. Saved versus submitted: distinguish local/device draft, server save, validation and review submission. Never promise that a draft already reached the manager.
3. Texture: configured grouped outputs and classification system; no implicit normalization, invented tolerance or automatic release of an inconsistent sum.
4. MIR/NIR: instrument profile, original spectrum retention, QC and distinction between prediction and measured reference value.
5. Corrections: controlled amendment of approved results, retained history and report replacement under current authorization.
6. Offline: downloaded work eligibility, attachment availability, credential expiry, conflict handling and the actual synchronization receipt.
7. KoBo/SIS: distinguish field import, physical receipt, laboratory processing and authorized external delivery. Do not imply automatic exchange when it is not configured and verified.

The 27 drafts cover the high-priority everyday work. Route mapping provides a generic entry for specialized administration and public pages, not a finished guide to every control. Before claiming complete contextual coverage, add behavior-verified guides for dashboard meanings, workflow-map controls, scanner/labels, assignment, users/access, laboratory setup and legacy imports. Create focused articles only where these controls actually exist and are supported. Map nested tabs and controls as well as page routes; do not count an unhelpful generic link as finished task guidance.

## Preview evidence and limits

preview-qa.json records 15 interaction checks and 40 layout combinations (320, 390, 736 and 1024 px; five scenes; light and graphite). Seven screenshots were generated; home, contextual workbench help, editor, phone and graphite views were visually inspected. Search, native FAQ expansion, article consistency, return-to-work preservation, editor demonstration restrictions, explicit English fallback and support preview were exercised. The preview made no HTTP requests and produced no browser JavaScript errors during these checks.

This is evidence for the design prototype only. Application RBAC, database transactions, five-language article accuracy, screen-reader operation, offline synchronization and production deployment remain implementation acceptance work. See ACCEPTANCE_TESTS.md.
