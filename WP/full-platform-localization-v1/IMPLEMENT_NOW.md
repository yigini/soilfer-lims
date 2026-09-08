# Implementation handoff — full five-locale translation

Please implement the full SoilFER LIMS localization package now, in this existing LIMS Dev conversation under project LIMSI. The working folder is C:\Users\yigin\Documents\soilfer-lims. This is the user's implementation handoff, so the earlier package wording saying “draft for review; wait for handoff” has now been satisfied. Continue through implementation and verification, rather than returning only another plan.

All material is already on this computer at:
C:\Users\yigin\Documents\soilfer-lims\WP\full-platform-localization-v1

Read these documents in full before editing:
1. README.md
2. IMPLEMENTATION_PLAN.md
3. AUDIT_FINDINGS.md
4. SCIENTIFIC_TERMINOLOGY.md
5. COVERAGE_AND_ACCEPTANCE.md
6. API_CONTRACTS.md
7. ANTIGRAVITY_PROMPT.md

Also use the source-text-inventory.json, locale-pack-audit.json, live-bootstrap-audit.json, live-ui-spot-check.json, catalogue-translation-review-matrix.json, scientific-glossary-draft.json and ROUTE_COVERAGE_REGISTER.md. The package includes repeatable audit/validation scripts and HANDOFF_MANIFEST.json. Package validation checks its consistency only; it is not evidence that the application or translations have passed testing.

## What the user needs

Complete translation in all five existing locale options: English (en), Spanish (es), Latin American Spanish (es-419), French (fr), and Portuguese (pt). Include the whole product and all roles, not only navigation or the current translation files. Preserve the existing laboratory workflows and the recent visual/dark-mode fixes.

Start by confirming this project folder and reading the package. Briefly explain the first steps to the user, then begin. Reconcile the current checkout and deployed revision before using the audit numbers; the audit baseline was e06808ca34a2e3a21411e742b33fdc0b6533c8c0. Preserve any newer or unrelated changes. Do not overwrite completed fixes or silently change the scope to a visual redesign.

## Coverage and functional requirements

- Translate every system-owned screen label, instruction, dialog, validation, error, toast, empty/loading state, tooltip, accessible name, chart label, dashboard explanation, backend action/reason and notification.
- Include login, shell and language/profile preferences; reception and restored drafts; projects and sample selection; sample pages and workflow maps; the workbench and batch entry; drying/preparation checklists; texture and spectral work; manager review and approvals; analysis/method configuration; equipment, inventory and QA; data views, reports, labels and exports; administration, help/tutorial and KoBo/SIS integration screens.
- Use one localized display resolver everywhere for analysis, method, category, component and operational labels. Keep stable codes and IDs for storage, selection values and integrations; show human-readable names to staff. Searching should still find exact codes, canonical names and reviewed local aliases.
- Preserve result values, numeric precision, units, qualifiers, scientific formulas, instrument files, task grouping, prerequisites, RBAC, submission/approval rules and report history. A translation is not a method revision or permission to alter a result.
- Handle decimal commas/points through an explicit input convention and strict validation. Prove that language switching, paste/import, texture, QC and reporting retain the same canonical result. Preserve unsaved work and sample order during language changes.
- Keep original free text, IDs, names, filenames, machine payloads and historical audit evidence intact; translate the system-owned captions around them.

## Scientific terminology

Use the researched sources and review procedure in SCIENTIFIC_TERMINOLOGY.md, extending the research to the actual live catalogue. The seed inventory contains 176 analyses, 467 methodologies and 1,296 name/description fields, but live-only and historical definitions also need reconciliation.

The 30-concept glossary is a draft review aid, and the catalogue matrix deliberately has blank, unreviewed target translations. Complete the actual inventory; do not import those blanks or rename operational definitions wholesale. Preserve method-specific ratios, extractants, digestion, basis and reference/version. Keep distinctions such as texture panel versus computed class, organic carbon versus organic matter, total versus acid-extractable content, and measured versus spectrally predicted results.

Spanish and Latin American Spanish may legitimately share wording. Follow the Portuguese editorial guidance and record regional decisions. Use authoritative FAO/AGROVOC, ISRIC, Embrapa and method/SOP references. Do not claim that an AI-generated draft received human scientific review. If a specific source definition or reviewer decision is unresolved, record the exact item and continue all independent work; do not invent an answer or block the entire project with a vague request for approval.

## Practical management for administrators and lab managers

Extend the existing Languages area into Languages & terminology. Give people clear module filters and lists of missing, draft, needs-review, source-changed and published wording. Show context and a preview, not raw JSON keys as the main interface.

Implement changed-entry draft saving, failed-save retention, version conflict handling, import preview, scientific review, scoped publication, history and rollback. Make the flow understandable: Save draft, Send for review, Publish reviewed changes. Enforce global versus own-lab rights on the server; branding permission alone must not allow a lab manager to overwrite global translations. Do not bulk-overwrite staff language preferences when a laboratory default changes.

Preserve and back up existing overrides before additive migrations. Do not reset or reseed the database. Keep released reports frozen with their recorded locale and terminology/template versions. Updating wording must not silently change an approved historical report.

## Verification and delivery

Work in reviewable phases and keep a concrete completion checklist against the package. The current five JSON files each have 558 keys yet many rendered messages bypass them; matching file counts is not proof of complete translation. The source audit found 2,511 JSX text/attribute candidates, 70 used keys missing from English, and widespread English dynamic analysis fallbacks. The live Portuguese editor showed 48/469 filled. Investigate the deployed/static resource discrepancy instead of assuming the editor's percentage is trustworthy.

Verify all 35 currently registered routes, all relevant roles, conditional states, both themes, long text, accents, keyboard entry, reports and labels in all five locales. Re-run the required existing checks plus meaningful localization, numeric, preference, scope and publication tests. Record evidence. Never claim “100% translated” by counting English fallbacks, unreviewed filled fields or a small set of screenshots.

The user's standing authorization to commit, push to GitHub and deploy through the established project process remains in force. Carry the completed, validated work through that process when release criteria are met. Protect existing work and data, use additive migrations with verified backup/rollback, deploy the exact tested revision and translation releases, and verify production. Do not use real lab samples to create test results. Update documentation and open/update/close GitHub issues according to the evidence; unresolved scientific or functional issues remain open. Do not call an incomplete translation release complete.

## How to communicate while working — very important

Be friendly, calm and explanatory in plain English. The user wants to understand what is happening without knowing the code. Give short, useful progress updates at each meaningful milestone and during longer stretches of work, rather than disappearing until the final response. A good update says what you are doing, why it helps the laboratory, what you have checked and what comes next, in two or three simple sentences.

Examples:
- “I found why some analysis names stay in English: those screens use a different name list. I’m connecting them to the same language system so reception, the workbench and reports agree.”
- “The reception screens now change language together, including warnings and saved drafts. I’m checking that switching language keeps anything the intake officer has already entered.”
- “I’m checking the scientific terms against soil-method references. Two names need clarification because their method descriptions differ; I’ve recorded those and am continuing with the other translations.”
- “The translated screens are ready for testing. I’m checking decimal entry and approvals in each language so the lab gets the same results and safeguards.”

Avoid walls of filenames, unexplained acronyms, inflated claims, invented percentages, or statements that work is deployed when it is only built locally. Clearly distinguish drafted, reviewed, tested, published and deployed. If a command or check takes time, explain what it is checking and whether useful progress is being made. Give realistic remaining work rather than an unsupported time estimate. Do not repeatedly ask permission for routine steps already covered by this handoff; raise only a concrete decision that truly needs the user.

Please acknowledge the folder and scope, summarize the first steps in this friendly style, and start the implementation.
