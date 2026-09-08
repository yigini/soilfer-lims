# Antigravity implementation handoff — SoilFER signature visual refresh

Please implement the approved SoilFER signature visual direction now in project LIMSI, in the existing LIMS Dev conversation. Working folder: C:\Users\yigin\Documents\soilfer-lims.

The user has reviewed the proposed direction and asked for implementation. Earlier design notes saying “if later approved” are now satisfied. This is a presentation-only enhancement to the current application. Preserve every existing laboratory function and the recent localization and appearance fixes.

## Design material to read and inspect

The complete mockup package is already here:
C:\Users\yigin\Documents\soilfer-lims\WP\soil-lab-visual-identity-v1

Read DESIGN_NOTES.md in full. Open review-preview.html and inspect the SoilFER signature option across dashboard, workbench and sample scenes in both light and graphite modes. Inspect these reference images as well:
- mockup-signature-light-dashboard.png
- mockup-signature-light-workbench.png
- mockup-signature-light-sample.png
- mockup-signature-dark-dashboard.png
- mockup-signature-dark-workbench.png
- mockup-signature-dark-sample.png
- mockup-signature-light-mobile.png

soil-lab-identity.fragment.html supplies the visual reference; build-preview.cjs, verify-preview.cjs and preview-qa.json document the prototype. Prototype QA verifies only that prototype, not the application. Do not copy its demonstration data, simplified components, navigation shortcuts or simulated event handlers into production.

## Approved visual direction

Use SoilFER signature, not the alternative Quiet soil option. Do not add a new visual-direction selector to the product.

- Forest-green navigation with the existing SoilFER logo and clear selected/hover/focus states.
- Warm limestone page backgrounds, clean readable working surfaces, and a restrained hierarchy of borders and elevations.
- Terracotta accents for laboratory methods, restrained ochre for appropriate notes, and mineral-blue supporting accents. Preserve the established semantic meaning of errors, warnings, readiness and approval states; brand colors must not redefine them.
- Clear sample identity styled like a laboratory record label, readable section headings, aligned data columns and practical input fields.
- Subtle decorative soil-band branding only where the mockup uses it. It must not look like measured soil layers, analytical results or workflow progress. Mark purely decorative elements as inaccessible to assistive technology.
- Graphite dark mode using sleek dark-gray surfaces and readable contrasts, not near-black panels or leftover white dialogs. Keep intentional paper backgrounds for printed reports and labels.

The user likes the current login composition. Focus the refresh on the signed-in application; retain the login layout and existing branding controls. Use current logo/icon/font assets where appropriate. Keep working tables calm and compact enough for laboratory use; do not add ornamental charts, oversized cards or new dashboard metrics.

## Apply it to the current application

First confirm the current code/deployed baseline and preserve all localization work, including language grouping, localized dynamic analysis names and the updated language editor. The old mockups predate those changes, so the current functional components and translated content are authoritative. A published catalogue count is not proof that every translated UI state has been checked.

Extend the existing sf-* theme tokens and component presentation styles. Do not create another theme provider, duplicate preference logic, or a broad override stylesheet that unpredictably changes unrelated elements. Keep light as the default, temporary header dark choice for the session, and explicitly saved profile choice persistent according to the existing implementation.

Start with the shared application shell, then the three illustrated screens: role dashboard, workbench and sample Work & results. Carry the same shared surfaces, typography, borders, controls and accents consistently through reception, sample lists, manager review, workflow maps, spectral library, equipment, inventory, projects, administration, translation management, dialogs and drawers. Adapt to each role's real controls and content; the technician mockup is not a replacement dashboard for every role.

Keep all existing translations. Do not paste the mockup's English strings into the application. Reuse current localization keys for existing wording; any unavoidable new presentation/accessibility text must be covered in all five locales (en, es, es-419, fr, pt). Names, buttons and units must remain legible when translated text is longer.

## Strict functional boundary

Allowed changes: presentation colors/tokens, backgrounds, typography, spacing, borders, focus/hover/selected styling, existing icon appearance, responsive presentation and decorative brand elements.

Preserve event handlers, API calls/payloads, routes, identifiers, sample order, form state, draft persistence, keyboard entry, calculation and validation logic, numeric values/precision/units/qualifiers, backend state, task dependencies, assignment, permissions, review/approval/report release, integration behavior and appearance/language preferences.

Do not move result entry, add/remove workflow steps, rename scientific definitions, hide permitted actions, or replace backend counts with mock data. No database migration, reset/reseed, server-contract change or scientific catalogue change is needed for a visual refresh. If you discover an existing functional issue, record it separately and keep this change focused; do not disguise a behavior change as styling.

Use icons plus text for states; never rely on color alone. Do not truncate critical sample IDs, values, units or errors without accessible access to the full content. Dense worksheets may scroll inside their own table region; do not make the whole page overflow or remove mobile navigation destinations. Keep input focus clearly visible and retain Enter/Tab behavior and unsaved values.

## Implementation and verification

Maintain a short presentation checklist and deliver reviewable changes. Use a dedicated visual commit/PR or branch based on the current tested application, preserving any unmerged localization commits and unrelated work. Do not return only another plan: this message authorizes implementation.

Validate the actual application, not just the mockup:
1. Compare before/after screenshots of the three reference screens in light and graphite with the same fixtures. Check all remaining routes for consistent shared styles and leftover hardcoded light/dark colors.
2. Check all five locales, all relevant roles, long scientific labels, accents, disabled/error/loading/empty states, tooltips, dialogs, dropdowns, toasts and drawers. Preserve the new translation groups and review controls.
3. Check desktop, tablet, narrow mobile and 200% zoom, keyboard focus and dense worksheets. Preserve tabular data alignment and usable target sizes.
4. Verify normal text contrast of at least 4.5:1, large text and required non-text control contrast of at least 3:1, with distinguishable focused/selected/disabled states. Do not reuse mockup contrast results as application evidence.
5. Smoke-test reception draft reopening, navigation, operational checklists, numeric/texture/spectral result editors, manager review, translations, theme preference and language switching on appropriate test fixtures. Confirm unchanged handlers, payloads and canonical outcomes. Use existing tests plus targeted checks where the change creates a real risk; do not create tests that merely repeat CSS declarations.
6. Run the required build/lint/tests, verify React imports and hook ordering, and inspect browser console errors. A successful build alone did not catch earlier missing-hook failures, so open the affected real routes.
7. Confirm report/label printing and barcode/QR payloads remain unchanged and legible.

## Delivery and communication

The user's standing authorization to commit, push to GitHub and deploy through the established project process remains in force. After verification, publish the reviewed visual changes through that process, preserve data and the rollback reference, deploy the exact tested artifact/revision, and verify live pages and asset versions. Do not test by creating results on real laboratory samples. Keep this visual release traceable separately from localization; record any unresolved issue honestly. Update relevant documentation and GitHub issues with evidence, closing only issues actually resolved.

Give friendly, plain-English progress updates during the work. Explain what changed for lab staff, why it helps, what was checked and what comes next in two or three simple sentences. For example: “The navigation and sample headers now use the SoilFER colors. I’m checking the busy workbench tables next so the stronger identity does not make data entry harder.” Avoid walls of technical filenames, unexplained acronyms, invented completion percentages or claiming a deployment before verifying it.

Please acknowledge the selected SoilFER signature direction, confirm the correct folder and current localization baseline, then begin implementation. Finish with before/after visuals, verification results, deployed revision and any concrete remaining limitations.
