# SoilFER visual identity mockups

This is an isolated visual study prepared on 8 September 2026. It changes no application source, data, API, permissions, routes, theme preference logic, or deployment. It does not supersede the sitewide appearance work currently being implemented by Antigravity.

## What to compare

**SoilFER signature** is the recommended direction: a forest-green navigation surface, limestone page background, terracotta method accents, restrained ochre notes, mineral-blue accents, and sample identifiers treated like laboratory labels. The existing multicolored SoilFER logo provides the palette. The soil bands at the foot of the navigation and across the sample record are decorative brand elements, not measured soil layers or workflow progress.

**Quiet soil** is a more conservative option with a light sidebar, quieter accent fills, and a thinner brand rule. It uses the same markup and content as the richer version; changing the direction does not change any mockup values or controls.

Both directions include a graphite appearance. Light remains the starting point. This preview's appearance switch is only a local design control: the actual session/profile theme preference contract remains owned by the existing sitewide appearance implementation.

## Current screens used as references

The local checkout was inspected read-only while the appearance work was in progress. These mockups reflect the checked-out structures, not a claim that the deployed site is at the same revision.

| Mockup | Current implementation references | Visual treatment |
|---|---|---|
| Technician dashboard | `client/src/pages/Dashboard.jsx`; `components/dashboard/DashboardShell.jsx`, `QueueSummary.jsx`, `WorkQueue.jsx`; `server/services/dashboardService.js` | Existing role heading, five queue summaries, method queue, bench instructions, and shortcuts. Stronger hierarchy, warmer surfaces, colored method icons. |
| Workbench / pH worksheet | `components/workbench/WorkbenchShell.jsx`, `WorksheetArea.jsx`, `NumericEditor.jsx`, `WorkbenchInspector.jsx` | Existing work sections, work type, paste, batch/QC, sample search, worksheet, and inspector. Clear sample labels, restrained selected rows, readable inputs. |
| Sample / Work & results | `client/src/pages/SampleDetail.jsx` | Existing identity, header actions, material metadata, next action, five tabs, and grouped results. Laboratory-record styling and less visual competition between labels and results. |
| Application shell | `client/src/App.jsx` and existing logo assets | Technician navigation and header controls retained as context. No new role access or proposed route behavior. |

## Limits of the mockup

- All counts, dates, results, and statuses are demonstration data. Familiar IDs are illustration labels, not live queries or findings about those samples.
- Only the dashboard, pH worksheet, and sample Work & results screens are illustrated. Other buttons explicitly identify themselves as preview-only. Production actions are not implemented or tested here.
- The mock navigation opens those three scenes for review. In the real product, Samples must still open the sample list. The preview shortcut is not a proposed routing change.
- Numeric edits, row selection, filtering, and inspector selection exist only in memory to judge the design. They do not demonstrate validation, submission, prerequisites, or persistence.
- Operational states and numbers must continue to come from the existing authoritative backend. Never copy the mock data, conditional rendering, counters, next-action calculation, or permissions into the application.
- Illustrative analysis labels are not replacements for catalogue configuration, SOPs, scientific calculations, or report definitions.
- The small-screen rearrangement is a preview accommodation. An implementation must retain the current mobile navigation and all role-permitted destinations; hidden preview-only links are not a deletion request.

## If this direction is later approved

Apply the visual treatment through the existing `sf-*` theme tokens and component presentation styles. Do not create another appearance provider or a second stylesheet that overrides the app unpredictably. Keep the existing language support and semantic status colors; do not encode category or status using color alone.

Allowed scope: background and surface colors, text hierarchy, borders, accent rules, spacing, selected/hover styles, existing icon presentation, and the use of current logos.

Preserve: event handlers, API calls and payloads, validation, calculations, status derivation, RBAC, assignment, review, approval, report release, data entry location, keyboard behavior, navigation destinations, and session/profile preference persistence. Do not use a mockup's simplified component structure as replacement application code.

Validate the final implementation against the current app in light and graphite modes, with actual server states, every role, localized long labels, zoom, focus, validation errors, disabled states, dense tables, dialogs, and printing. Printed labels and reports must retain their intentional paper styling. This prototype's QA is not production certification.

## Files

- `soil-lab-identity.fragment.html`: editable mockup source; logo placeholders are filled during the build.
- `review-preview.html`: isolated offline browser rendering for QA; the inline review also offers the two visual directions through its design controls.
- `mockup-*.png`: screenshots of the illustrated directions and screens.
- `build-preview.cjs`: embeds existing logo assets and generates offline icon rendering from the installed Lucide package.
- `verify-preview.cjs`, `preview-qa.json`: checks for this mockup only.

No application implementation or deployment was performed for this study.

## Preview verification

The offline preview passed 11 interaction checks, 60 combinations of screen/appearance/direction/viewport for outer overflow, and 68 text/background token contrast checks at a minimum 4.5:1. Checked widths were 1440, 1024, 768, 390, and 320 pixels. There were no JavaScript errors or external network requests in the successful run. Desktop and mobile screenshots were inspected. Dense tables scroll horizontally within their own region on narrow screens. This evidence covers the mockup only.
