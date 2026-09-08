# Site-wide appearance redesign package

Prepared for LIMSI / LIMS Dev, 8 September 2026. Application source reviewed at `64be170c3a25ab8b0157e209e81146cfc2f51331`.

## Start here

- Open [appearance-preview.html](appearance-preview.html) in a browser.
- Read [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).
- Give Antigravity [ANTIGRAVITY_PROMPT.md](ANTIGRAVITY_PROMPT.md).

## Try the preview

1. It opens in Light. Use **Appearance → Dark** to see the proposed graphite palette.
2. Enter a different value in the demo worksheet, then switch appearance. The entered value remains in place.
3. Select **New session**. A temporary appearance returns to the saved default.
4. Open **Profile · Appearance**, select Dark and press **Save appearance**. Now **New session** returns to Dark.
5. Try a temporary Light choice, sign out and use the demo sign-in to check the distinction between session and saved account preference.
6. Inspect Sample workspace, Workflow map, Equipment, Controls & dialogs, and the paper report preview.

All data and preference saves are simulated in memory. No credentials, API requests, database writes, or real workflow actions occur. Reloading the standalone mockup resets its demo state; production same-tab reload behavior is specified separately in the implementation plan.

The preview uses a simplified text wordmark and route selector for demonstration. Antigravity must preserve the real application branding and existing navigation; it must not replace the product sidebar with these preview-screen links. Optional in-conversation design controls compare graphite with a warmer gray and slightly different corner radii. Graphite is the proposed implementation baseline.

## Included assets

| File | Purpose |
|---|---|
| `IMPLEMENTATION_PLAN.md` | Findings, exact preference rules, API/schema/auth integration, design system, whole-site scope and release sequence |
| `ANTIGRAVITY_PROMPT.md` | Copyable implementation handoff |
| `ACCEPTANCE_CHECKLIST.md` | Required future application tests and visual coverage |
| `tokens.json` | Paired light/graphite semantic colors |
| `SOURCE_INVENTORY.md` / `source-inventory.json` | 140 source files with candidate palette literals/utilities and every current route; not a defect count |
| `appearance-preview.fragment.html` | Editable inline mockup source |
| `appearance-preview.html` | Standalone browser preview |
| `mockup-*.png` | Desktop/mobile light/dark screenshot references |
| `contrast-check.json` | 82 tested opaque foreground/background pairs, no failed target ratios |
| `preview-qa.json` | 11 interaction checks and 60 width/theme/screen overflow checks, no errors or network requests |
| `build-review.py` | Read-only source inventory generator and standalone wrapper exporter |
| `verify-preview.cjs` | Local browser/mockup verification; uses the installed Codex Node dependencies and Chrome path on this machine |

## Validation limits

Mockup checks passed in local headless Chrome at 1280, 1024, 768, 390 and 320px widths. The review includes visual inspection of the generated light workbench, dark workbench/profile/mobile/workflow/dialog screenshots. The automated layout check detects whole-page horizontal overflow; it does not prove every possible interaction is accessible. Contrast checks cover the proposed opaque tokens, not every composited live application state.

This package does not certify or implement the LIMS theme. Future code, migration, real auth/storage lifecycle, translated strings, third-party controls, keyboard/assistive-technology behavior, browser coverage and production deployment must pass `ACCEPTANCE_CHECKLIST.md` before release. Deliberate white paper, scientific images, approved logos and map content exceptions are explicitly scoped in the plan.
