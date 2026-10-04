## Summary
This PR implements the full sitewide **SoilFER Theme Library & Selector** feature across SoilFER-LIMS, completing the specifications in `WP/sitewide-theme-library-v1/IMPLEMENTATION-PLAN.md` and resolving all findings from Codex's independent reviews through candidate `f255f64`.

### Key Capabilities & Architecture
1. **Canonical Theme Catalog & Tokens**:
   - 7 curated theme families × 2 modes = 14 isomorphic variants:
     - `soilfer-classic` (institutional baseline default)
     - `forest` (recommended soil & agronomic palette)
     - `terra` (warm terracotta/clay tones)
     - `mineral` (slate & cool stone tones)
     - `watershed` (hydrology & water resources)
     - `nutrient` (deep botanical & fertilizer tones)
     - `clear-contrast` (high-contrast accessibility theme with WCAG AAA ≥ 7:1)
   - Canonical single-source authority: `server/config/themeCatalogData.json` (v1.0.0), generated to `client/src/lib/themeCatalog.js`, `server/config/themeCatalog.js`, and verified with 0 drift against `client/src/styles/appearance-tokens.css` via `npm run check:theme-catalog`.
   - Analytical & QA status colors (Emerald=Approved, Amber=In Analysis, Rose=Rejected) are strictly preserved across all variants.
   - Strict `@media print` and `[data-surface="paper"]` isolation ensures official certificates, manifests, and barcode labels always render on pure `#ffffff` paper with crisp dark text (`rgb(30, 58, 95)`, composed contrast 11.93:1).
   - Hardened scientific report collector verifies specific accession header (`Laboratory ID: SOIL-GH-2026-001`, rejecting `SOIL-GH-2026-999` with expected ID in unrelated footer), rejects `WRONG-SPECIMEN`, and extracts all 5 parameters (pH 6.50, OC 2.15%, TN 0.18%, Bray-1 P 15.40 mg/kg, K 0.45 cmol/kg) with exact units (`pH units`, `%`, `mg/kg`, `cmol(+)/kg`), strict tolerance (`< 0.005`), and row multiplicity (`matchingLines.length === 1`), strictly rejecting contradictory duplicate rows, altered values, or incorrect units.

2. **Additive Persistence & Authority Hierarchy**:
   - Additive database schema (`server/prisma/schema.prisma`, migration `20260930140000_add_sitewide_theme_appearance`):
     - `User`: `uiThemeId`, `uiModePreference`, `uiAppearanceRevision`
     - `LabAppearanceSetting`: `labId` (PK), `themeId`, `defaultMode`, `revision`
     - `GlobalAppearanceSetting`: `id` (PK, 'global'), `themeId`, `defaultMode`, `revision`
   - Authority & RBAC rules (`server/services/appearanceService.js`):
     - Regular staff can set mode preference (`light`, `dark`, or `inherit`) and inherit theme or choose Clear Contrast for accessibility.
     - `LAB_MANAGER` can set own-lab default theme and mode (`light`, `dark`, `inherit`).
     - `SUPER_ADMIN` can set platform-wide default (`light`, `dark`) and any lab default.
   - Optimistic concurrency control (`409 Conflict`) with atomic `AuditLog` generation on appearance mutations.
   - Authoritative lost-response reconciliation and pre-flight scope validation prevent state drift.

3. **Responsive Selector, Operational Workflows & Live Preview**:
   - Responsive `ThemeGallery` component with miniature UI mockups, 7-family cards, mode switches (`light`, `dark`, `inherit`), WAI-ARIA roving tabindex, arrow navigation, and scope-aware adoption controls.
   - Accessible confirmation modal with auto-focus entry, focus trap (`Tab`/`Shift+Tab`), `Escape` key dismissal, and trigger focus restoration.
   - Reversible full-screen live preview across all routes with unsaved form input preservation and top notice banner (`AppearancePreviewNotice`).
   - Integrated into User Profile (`Profile.jsx`), Lab Management (`LabManagement.jsx`), Admin Panel (`AdminPanel.jsx`), and Header Quick-Toggle (`ThemeToggle.jsx`).
   - Executed operational workflows in browser test harness: TechWorkbench (`/workbench`) numeric cell focus, `'42.50'` input, selection range `[2, 5]` with state survival verified across real theme switches (`terra` <-> `forest`); ScanPage (`/scan`) camera container and search fallback; SampleWorkflowMap (`/workflow-map`) DAG container; LegacyImport (`/admin/legacy-import`) CSV file upload via `setInputFiles`; collectors hardened to strictly reject generic main mocks or unrelated global inputs.
   - Whole-site coverage executed and verified across all 45 route declarations in `WP/sitewide-theme-library-v1/TRACEABLE-MATRIX.md`: 45/45 executed routes linked to measured execution artifacts across 14 isomorphic variants; Section 1 Area 9 (Inventory & Equipment) verified.

4. **Documentation & Bundling Budget**:
   - Comprehensive user, lab manager, and operator guide: `docs/THEME_GUIDE.md`.
   - Whole-site traceability matrix: `WP/sitewide-theme-library-v1/TRACEABLE-MATRIX.md` with 0 mismatches against canonical JSON, dynamic Chrome `153.0.8010.48` binding, and all 45 routes executed with measured artifacts.
   - **Plan Budget (Additional CSS + Catalogue Source Proxy)**: Additional CSS delta (1,822 B gzip = 1.78 KiB gzip) + Canonical Theme Catalogue (3,511 B gzip = 3.43 KiB gzip) = **5,333 B gzip = 5.21 KiB gzip**, safely within the <= 15.0 KiB gzip budget (9.79 KiB headroom, **PASSED**).
   - **Lazy-Loaded Component**: `ThemeGallery.jsx` code-splits into an asynchronous chunk of 25.9 kB (6.33 KiB gzip).
   - **Full Application Footprint**: Total delta across all production assets (CSS + ThemeGallery Chunk + Main JS Bundle) is **19,342 B gzip = 18.89 KiB gzip**.
   - **Hardware Gate**: Layout reflow down to 320px, authenticated 200% zoom text scaling reflow (`fontSize = '200%'` with Profile identity `Account Details` and zero horizontal overflow), and touch targets >= 44px verified across 100% of visible theme controls via automated headless Chrome; native physical iOS Safari and Android Chrome hardware testing and physical barcode label printer hardware remain honestly recorded as **PENDING** under physical hardware constraints (Issue #102 is NOT a waiver).

---

## Test & Gate Verification Evidence

- **Browser Journeys Suite** (`server/scripts/verify_issue155_browser_journeys.cjs`): **12/12 PASS** with real Headless Google Chrome `153.0.8010.48` (`issue155-browser-journeys-results.json`):
  1. Fourteen-variant computed DOM token and contrast verification (14/14 match canonical hex, 0 contrast failures).
  2. Actual route and workflow matrix navigation: All 45 declared routes from `App.jsx` rendered and verified across 14 isomorphic theme variants with view-container-scoped text extraction, populated synthetic records, canonical theme IDs, real provider session dispatch & reload (45/45 passing, 0 failures).
  3. Operational workflows: TechWorkbench (`/workbench`) numeric cell focus, `'42.50'` input, selection range `[2, 5]`, exact sample identity `SMP-2026-001`, work item `wi-01`, parameter `PH_H2O`, unit `pH units`, and full state transition survival verified before preview (`forest.light`), during preview (`terra.light`), and after exit (`forest.light`); ScanPage (`/scan`) camera container and search fallback with barcode value `'SMP-2026-001'` verified before, during, and after; SampleWorkflowMap (`/workflow-map`) stage graph nodes, 4 observed edges, and dependency nodes `['wi-01', 'wi-02']` verified; LegacyImport CSV file upload via `setInputFiles` verified.
  4. Live preview form input state preservation (`'UnsavedSecretDraft42!'` password input preserved across preview activation and exit).
  5. Theme selector entrypoints accessibility and mounting.
  6. Confirmation modal auto-focus entry, focus trap boundary wrapping (`Shift+Tab` / `Tab`), Escape dismissal, trigger restoration.
  7. Mode radiogroup WAI-ARIA roving tabindex and keyboard navigation (`ArrowRight`, `ArrowLeft`, `Home`, `End`).
  8. Responsive layout reflow down to 320px viewport (320×568 and 390×844) without horizontal window overflow, authenticated 200% zoom text scaling reflow via `fontSize = '200%'`, unmodified shipped layout root text enlargement 400% at 1280 CSS viewport (`fontSize = '400%'`, 0 overflow, 14 active panel controls unclipped), visible interactive focus ring (`BUTTON`, `hasFocusRing: true`), and media feature emulation (`prefers-reduced-motion`, `forced-colors`).
  9. Multi-language localization verified across English, Spanish (`es`), Latin American Spanish (`es-419`), French (`fr`), Portuguese (`pt`).
  10. Scientific chart tokens (`--sf-chart-1`..`6`) defined in DOM and real public report (`/report/CERT-2026-SOIL-01`) `@media print` styles isolated with pure white paper, navy header text (contrast 11.93:1), accession header `SOIL-GH-2026-001`, report ID `CERT-2026-SOIL-01`, all 5 parameters validated with exact method, unit, precision, and status `APPROVED` (rejecting `DRAFT` or `OTHER METHOD`, null default for missing status), and truthful label isolation reporting.
  11. Verification boundaries: Real Headless Chrome browser execution verified (`153.0.8010.48`); manual screen-reader (NVDA/JAWS/VoiceOver) and system forced-colours documented as pending manual interactive testing; native physical iOS/Android mobile hardware and physical thermal barcode label printer hardware honestly recorded as pending under physical hardware constraints.
  12. Console & Page Integrity: Verified zero uncaught page errors and zero unexpected console errors across all browser navigation journeys; generic 404s fail closed, with exclusions strictly limited to known identities (`favicon.ico`, React DevTools).
- **Whole-Site Traceability Matrix**: `WP/sitewide-theme-library-v1/TRACEABLE-MATRIX.md` with 0 mismatches against canonical catalog across all 14 variants, runtime Chrome version `153.0.8010.48`, all 45 executed routes linked to measured execution artifacts, Area 9 verified, and physical hardware gates honestly recorded as pending.
- **Contract Tests**: `tests/contracts/theme_appearance_contract.test.js` (**19/19 PASS**).
- **Theme Preference API**: `tests/contracts/theme_preference_api.test.js` (**7/7 PASS**).
- **Security Suites**: `tests/security/` (**80/80 PASS**).
- **Theme Catalog & Tokens Drift**: `npm run check:theme-catalog` (**PASS with 0 drift**, wired into CI workflow).
- **Client Build & Provenance**: `measure_theme_bundle_delta.js` (**PASS**, dynamically discovers `node v24.13.0`, `vite v5.4.21`, lockfile sha256 `c2bf38c1...`, client tree `d30e0197f6d0619b8b71fdd5c8fabc5803bf6c1b`).
- **Database Integrity**: `PRAGMA integrity_check` = `ok`, `foreign_key_check` = 0 errors.

---

## Review & Release Governance
- **OpenNSIS Isolation**: OpenNSIS code, configuration, data, and deployment remain completely untouched.
- **TUF Status**: Planning-only (`WP/tuf-secure-updates-v1/`).
- **Production Gate**: Sole-Agy safe production release is strictly held until independent technical acceptance is confirmed by Codex, protected merge to `main`, exact-main green CI, and safe operator deployment gates.
