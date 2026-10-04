# Sitewide Theme Library & Selector v1

## Overview & Scope
This PR delivers the SoilFER Theme Library & Selector v1 as specified in `WP/sitewide-theme-library-v1/IMPLEMENTATION-PLAN.md`, implementing sitewide theming capabilities across all functional areas and 45 declared client routes. Physical hardware testing (physical iOS/Android devices, physical barcode/label printers, manual screen-reader listening, and OS contrast theme displays) remains recorded as manual pending. Automation of desktop browser window application chrome zoom menus (Ctrl+/Ctrl-) is classified as software pending with an executed CDP session probe witness and bounded external shortcut injection attempt, while native Chromium desktop optical zoom layout reflow and interactive theme preview/exit operations via shipped gallery controls with unfinished form input preservation, layout restoration enforcement, dynamic control availability tracking, and execution receipt provenance are actively executed and verified in software (HostZoomMap 400% zoom factor, `devicePixelRatio: 4`, `innerWidth: 320`, `visualViewport.scale: 1`, `noHorizontalOverflow: true`, `controlsUnclipped: true`, preview and exit cycle verified, form input preserved) alongside W3C SC 1.4.10 320 CSS px reflow layout equivalence.

**Status: MERGED and INDEPENDENTLY VERIFIED LIVE in production.**
- Accepted PR Head: `6a205db83a7841632a10988006b373f01c596c67` (tree `52335aba0b6741b41f85fe274aa89236fba10601`)
- Merged Main Commit: `25535b6f62b0d29c6b143a45a9c1db02ed2f229a` (guarded `--match-head-commit` merge; same tree)
- Merged-Main CI Run: `37117816283` / job `111187917280` SUCCESS
- Live Production Image: `soilfer-lims:v3.5.32-25535b6` (`sha256:72b6b81a7a335bede9d47b8230f8da05418068d86c195b3fccfbf224813b5b05`), container `soilfer-lims` healthy
- Rollback Baseline: `soilfer-lims:rollback-baseline` (`sha256:5114c6c07b4e5e614e818dea794670cfc23ef1f847aca817d89c551e128d3857`)
- Independent Live Review: Verified live by Codex (2026-10-03T11:35:39Z–11:36Z; `issue155-independent-live-review.md`, `issue155-independent-live.json`)
- Linked closing issue: None (no linked closing issue)

## Key Deliverables & Architectural Implementation
1. **Curated Theme System**: 7 families (SoilFER Classic, Forest, Terra, Mineral, Watershed, Nutrient, Clear Contrast) × 2 modes (Light / Dark) = 14 concrete variants.
2. **Deterministic Token Hierarchy**: CSS custom properties for canvas, surface, text, muted, divider, control, borders, accents, and charts.
3. **Three-Tier Scope Precedence**: Explicit hierarchical inheritance (`Personal > Lab Default > Platform Default > SoilFER Classic Light`).
4. **Non-Destructive Live Preview**: Preview full screen with unsaved input preservation, polite banner announcements, and reversible dismissal.
5. **Universal Route Matrix**: Verified across all functional areas and 45 declared client routes.
6. **Accessible Selector Components**: ThemeToggle popover, Appearance tab in Profile, and Lab Management appearance panel.
7. **WAI-ARIA Accessibility**: Modal focus trapping/Escape dismissal, radiogroup roving tabindex with Arrow/Home/End navigation, high contrast modes, prefers-reduced-motion, and minimum 44×44px touch targets.
8. **Scientific & Print Isolation**: High-contrast chart tokens and print white-paper media isolation.
9. **Desktop Optical Zoom & 320px Reflow**: Native Chromium optical zoom verified at 400% with layout reflow down to 320 CSS px (`visualViewport.scale: 1`, `innerWidth: 320`, `scrollWidth: 320`, zero horizontal overflow), interactive theme preview/exit cycle via shipped gallery controls with state preservation, layout restoration, dynamic control availability tracking, and executed controls receipt provenance verified, alongside W3C SC 1.4.10 320 CSS px reflow layout equivalence and High-DPI DPR 2.0 at 640 CSS px.

## Verification & Identity
- **Branch**: `feat/sitewide-theme-library-v1`
- **Accepted PR Head Commit**: `6a205db83a7841632a10988006b373f01c596c67` (`6a205db`)
- **Merged Main Commit**: `25535b6f62b0d29c6b143a45a9c1db02ed2f229a` (`25535b6`)
- **Accepted Tree**: `52335aba0b6741b41f85fe274aa89236fba10601`
- **Client Tree**: `6e83b8d431a820d700ac6ac7a4398e5f3a1bb216` (strictly frozen byte-for-byte; zero CSS mutation)
- **Server Tree**: `5e4029ea90849f2834304ce10a024b6d828d70fc`
- **Server/Data Tree**: `1a2a84457d02d33707f9845da10f9b97995e1377` (strictly preserved, zero mutation)
- **Base Commit**: `1265e8aa9f71f5f60b61c6fdaf31bc36ba8b2c54` (`1265e8a`, `v3.5.31-1265e8a`)
- **Customer Certificate PDF**: `server/scripts/test_certificate_output.pdf` (162,633 B, SHA256 `47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a`)
- **Built CSS Asset**: `client/dist/assets/index-Df7izgw5.css` (213,700 B raw / 35,045 B gzip, SHA256 `65e7d0a287cb6557cc05e125cd213b0d09738b6778ab8b2f9b90b4f6a9431c75`)
- **Merged-Main CI Run**: `37117816283` / job `111187917280` SUCCESS (completed 2026-10-03T10:59:20Z)
- **Release Execution Run**: `20261003_132428`
  - Wrapper Script SHA-256: `f68d6864d64c16e4cfcdf3572bce7177c969fd8c648f2fc562b07e72b21dca1a`
  - Release Ledger: `/opt/lims/logs/release_ledger_issue155_20261003_132428.json` (SHA-256 `09ad62bdf2606b22533332af39ef55c4ca5e8c91b158a9d1e97c2116b8234287`)
  - Release Transcript: `/opt/lims/logs/release_issue155_20261003_132428.log` (SHA-256 `ba4f75c593d9c9eafec60ac4e24435e515b2f3bff86971d640bdaba51f07e7d8`)
  - Stopped-Writer DB Backup: `/opt/lims/backups/dev_pre_issue155_20261003_132428.db` (563,322,880 B, SHA-256 `61551adf698668f696f93aa0742610316e1943e3309734fa237b1ad94032275e`)
  - Stopped-Writer Assets Backup: `/opt/lims/backups/assets_pre_issue155_20261003_132428.tar.gz` (1,813,849 B, SHA-256 `7921958ff04086be1b9c2b59490c5aa102123cc8d91d33abbd4600b3cbf9234a`)
  - Stopped-Writer Baseline Counts: Samples 38,566 / Results 19 / Users 49 / Labs 10 (integrity OK, 0 FK violations)
  - Additive Schema: 3 UI columns, 2 appearance tables, global default `soilfer-classic|light`, backfill mismatch 0
  - Ingress: Quiescence via Apache 503 rewrite; COMMITTED before writer resumption; Apache restored config SHA-256 matches pre-quiescence `f46aeaae33c48a7634b06bffab09ecfe19ed8f2a8e8df21e2503d2c479f78c20`; write resumption verified via HTTP 401 on unauthorized POST
  - Postflight Suites: Postflight 31/31 passed (`cb88ca593de1e2af3a0052a7ffb958eeb3933028764718eb624bfdfbc5fea4b5`); roles postflight passed pre- and post-exposure (`6724d91d89343387adb18db03f396a1eac14d8c9cc0700ac722b36e82ed924da`)
- **Independent Live Verification (Codex)**:
  - Review: `issue155-independent-live-review.md` / `issue155-independent-live.json` (observed 2026-10-03T11:35:39Z–11:36Z)
  - Running Container: `soilfer-lims`, healthy, image `sha256:72b6b81a7a335bede9d47b8230f8da05418068d86c195b3fccfbf224813b5b05`
  - Public Endpoints: `/api/health` 200, `/api/appearance/public` 200 (`soilfer-classic|light`, rev 1), `/api/appearance/catalog` 200 (all 7 families, 14 swatches), `/api/v2/data-exchange/capabilities` 200; directory/stats/geojson 401
  - Read-Only Role Gates: Super Admin, Lab Manager, Lab Technician verified via public HTTPS (200 / 403 as expected)
  - Public Login UI: Rendered with root `data-theme="soilfer-classic"` and `data-appearance="light"`, background `rgb(245, 243, 237)`, stylesheet `index-Df7izgw5.css`

## Status & Operational Handoff
- PR #155 is **MERGED** into `main` (`25535b6f62b0d29c6b143a45a9c1db02ed2f229a`).
- Release executed once via `/opt/lims/execute_release_issue155.sh` (`SUCCESS`).
- Production serving image is `soilfer-lims:v3.5.32-25535b6` (`sha256:72b6b81a…5b05`).
- Independently verified **LIVE** by Codex.
