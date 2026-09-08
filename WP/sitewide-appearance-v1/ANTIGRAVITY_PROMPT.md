# Antigravity implementation brief

Work in **LIMSI / LIMS Dev**, folder `C:\Users\yigin\Documents\soilfer-lims`.

Read this complete package before modifying the application:

1. `WP/sitewide-appearance-v1/IMPLEMENTATION_PLAN.md`
2. `WP/sitewide-appearance-v1/ACCEPTANCE_CHECKLIST.md`
3. `WP/sitewide-appearance-v1/SOURCE_INVENTORY.md` and `source-inventory.json`
4. Open `WP/sitewide-appearance-v1/appearance-preview.html` in a browser. Try Appearance → Dark, Profile → Appearance → save Dark, New session, temporary Light, and the worksheet/sample/map/equipment/dialog views.
5. Read `tokens.json` and the mockup-only QA results/screenshots.

The required behavior is explicit: **light everywhere by default; header switching lasts for the current tab/session; an explicit Profile save is permanent for that account until changed.** No OS-theme default, no permanent localStorage toggle, no preference leaking between shared-computer users. Dark must be a sleek graphite gray using the same semantic palette throughout the app.

The mockup is a visual and interaction reference, not a replacement application or production code patch. Preserve existing routes, role restrictions, workflows, data entry, translations and approved branding. It demonstrates theme states using fictional data only. Do not copy its fake save/login behavior into production.

Implement in the plan's phases, starting with the preference resolver/API and semantic tokens, then shared components, laboratory workflows, specialized chart/map/print adapters, and all remaining routes. Resolve the actual CSS causes; do not use inversion, broad palette-selector overrides or blanket `!important` to conceal missing themes. Do not remount pages on a theme toggle or lose unsaved data.

Use the source inventory as a review candidate list, not a proven bug list. Cover every route, role, overlay and state in the acceptance matrix. Keep white paper reports/labels explicitly scoped while theming their surrounding UI. Validate the final rendered contrast, not just color swatches.

Use an isolated feature branch and focused commits. The appearance preference requires an additive schema migration and authenticated self-service API. Never reset/reseed production. Build and test in local/staging fixtures; preserve the existing release process, backup before production migration, and deploy only the verified commit when proceeding with the already-authorized application release. Do not claim deployed until the live revision and read-only smoke tests confirm it.

Keep updates brief and friendly: what you found, what you fixed, what remains. At completion report the PR/commit, test evidence, route/theme/state coverage, migration and rollback result, screenshots, intentional white-content exceptions and any remaining blockers. Do not promise zero defects or call uninspected areas complete.
