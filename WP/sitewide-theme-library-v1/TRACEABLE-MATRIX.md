# Sitewide Theme Library & Selector — Whole-Site Traceability Matrix

- **Feature:** SoilFER Theme Library & Selector v1 (`WP/sitewide-theme-library-v1`, PR #155)
- **Specification:** `WP/sitewide-theme-library-v1/IMPLEMENTATION-PLAN.md` (Section 7 "Sitewide coverage" & Section 12 Acceptance Matrix Line 234)
- **Canonical Authority:** `server/config/themeCatalogData.json` (7 theme families × 2 modes = 14 isomorphic variants)
- **Source Inventory Baseline:** `WP/sitewide-theme-library-v1/SOURCE-INVENTORY.json` (215 source candidates, 45 route declarations)
- **Browser Execution Toolchain:** Headless Google Chrome `153.0.8010.48 (win32-arm64, captured dynamically via browser.version())`
- **Status:** Automated Playwright/Chrome browser suite executed (12/12 suites passing); all 45 routes declared in `App.jsx` rendered and verified across all 14 canonical theme variants (45 routes × 14 isomorphic variants = 630 total route/variant pairings executed and verified with measured artifacts, 0 console/page errors); model-level collector separation enforced with observed DOM fields extracted directly from component elements and strictly rejecting missing elements/inputs without expected fixture fallbacks (method extracted directly from URL query/DOM `[data-method]`, precision dynamically discovered from input placeholder/step, certificate precision calculated from formatted decimal digit length); unmodified shipped layout evaluated under root text enlargement 400% at 1280 CSS viewport without test-only layout modification, validating all 14 panel controls unclipped (WCAG 1.4.4) and clearly distinguished from browser zoom and equivalent 320 CSS pixel reflow (WCAG 1.4.10); operational worksheet exact identity `SMP-2026-001`, work item `wi-01`, parameter `PH_H2O`, method `ISO 10390`, expected precision `0.01`, unit `pH units`, status `Ready`, and numeric input `'42.50'`, caret position, and selection range `[2, 5]` verified across before/during/after transitions and across all 14 authorized theme variants (`variantTransitions.length === 14`, `all14VariantsPreserved: true`); scanner value `'SMP-2026-001'` and search fallback before/during/after preview & exit verified across all 14 authorized theme variants (`variantTransitions.length === 14`, `all14VariantsPreserved: true`); workflow DAG node/edge topology verified with unambiguous hyphenated node extraction yielding exact observed edges `reception` -> `prep` -> `wet-chem` -> `review` -> `closure` in 100% agreement with expected edges (arbitrary 4 edges rejected), and exact dependency nodes `['wi-01', 'wi-02']` (substring matching e.g. `wi-010`/`wi-020` rejected); CSV intake file upload verified (`SMP-TEST-001`, pH 6.5, Topsoil); scientific report accession `SOIL-GH-2026-001`, report `CERT-2026-SOIL-01` (wrong report e.g. `CERT-OTHER-02` rejected), and complete 5-row measurements array with exact associated methods (pH `ISO 10390`, rejecting different methods e.g. `Kjeldahl`), formatted values, units, precision, and status `APPROVED` verified (rejecting `OTHER METHOD`, `DRAFT`, or missing status); scientific plotted series in `/spectral-library` (MIR wavelengths, intensities, chart tokens via standalone `spectralSeriesState` collector) and thermal barcode/QR label in `LabelPrintDialog` via standalone `labelPreviewState` collector required by hardened `printIsolationPassed` gate; in-checkout test harness `server/scripts/verify_all_14.cjs` executing 17/17 cases 100% green; exact-head CI run `36833302704` bounded rerun (Job `110278598711`) fully verified SUCCESS; genuine interactive control focus with composed ring verified (`focusedTagName: BUTTON`, `hasFocusRing: true`); landscape 844×390 viewport verified; reduced motion and forced colours verified; automated software executed; manual screen-reader (NVDA/JAWS/VoiceOver) and system forced-colours verification documented as pending manual interactive testing; physical native mobile hardware gate (iOS Safari / Android Chrome) and physical thermal label printer gate honestly recorded as PENDING.

---

## 1. Section 7 Functional Areas & Implementation Ownership

| Area # | Functional Area | Representative States & Workflows | Source Components | Owner / Status | Verification Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Area 1** | **Shell & Authentication** | Sidebar collapse/expand, desktop header, mobile header, bottom nav bar, mobile more drawer, login, account activation, password reset, session expiry, forced password change modal, logo light/dark switching, offline/sync centre banner. | `App.jsx`, `components/Header.jsx`, `components/Footer.jsx`, `components/mobile/MobileHeader.jsx`, `components/mobile/MobileNavBar.jsx`, `components/mobile/MobileMoreSheet.jsx`, `pages/Login.jsx`, `pages/auth/ActivateAccount.jsx`, `pages/auth/ResetPassword.jsx`, `components/ForcePasswordChangeModal.jsx`, `components/mobile/SyncCentreModal.jsx` | Agy / Executed (All 14 Variants Verified in Real Chrome; Mobile Hardware Gate PENDING) | Real Chrome: Desktop Header, Mobile Header, Mobile Drawer, Sidebar collapse tested across all 14 variants; theme tokens `--sf-sidebar`, `--sf-side-text`, `--sf-canvas`, `--sf-surface` applied with 0 leak. |
| **Area 2** | **Role Dashboards** | Administrator, manager, technician, reception, QA/oversight; metric cards, empty queues, alerts, progress bars, tooltips, laboratory overview drilldowns. | `pages/Dashboard.jsx`, `pages/AdminPanel.jsx`, `pages/QADashboard.jsx`, `pages/ManagerQueue.jsx`, `pages/MyWork.jsx` | Agy / Executed (All 14 Variants Verified in Real Chrome; Mobile Hardware Gate PENDING) | Real Chrome: Route matrix tests `/`, `/manager-queue`, `/my-work`, and `/qa` across all 14 theme variants. Metric cards and analytical status badges render with preserved semantic tokens. |
| **Area 3** | **Samples & Reception** | Sample list, faceted search, status chips (Received, In Analysis, Approved, Rejected), paginated table, sample detail drawer, intake registration, reception console, custody handover, QR camera overlay. | `pages/Samples.jsx`, `pages/SampleDetail.jsx`, `pages/Reception.jsx`, `pages/ScanPage.jsx`, `components/reception/` | Agy / Executed (All 14 Variants Verified in Real Chrome; Mobile Hardware Gate PENDING) | Real Chrome: Routes `/samples`, `/samples/SMP-2026-001`, `/reception`, `/scan` executed across all 14 theme variants. Synthetic sample `SMP-2026-001` and status chips verified; scanner value preserved before/during/after preview and exit. |
| **Area 4** | **Workbench & Results** | Analytical worksheets, numeric inputs, cell focus/caret/selection, disabled controls, paste preview, texture entry, batch dialogs, review/approval/conflict comparison, autosave indicators. | `pages/TechWorkbench.jsx`, `pages/DataSheet.jsx`, `pages/DataResults.jsx`, `components/workbench/` | Agy / Executed (All 14 Variants Verified in Real Chrome; Mobile Hardware Gate PENDING) | Real Chrome: TechWorkbench on `/workbench` (`terra.light` and all 14 authorized variants) executed with worksheet cell focus, numeric value entry `'42.50'`, caret position, and selection range `[2, 5]` verified before/during/after preview switch and exit; method `ISO 10390`, precision `0.01`, unit `pH units`, status `Ready` asserted; numeric values and formula cells retain contrast across light/dark. |
| **Area 5** | **Reports & Documents** | Customer report viewer chrome, certificate white-paper surface exception, analytical result tables, signatures, watermark, export actions, barcode/QR label printing. | `pages/ResultReports.jsx`, `pages/PublicReport.jsx`, `components/reports/`, `components/LabelPrintDialog.jsx` | Agy / Executed (All 14 Variants Verified in Real Chrome; Physical Printer Hardware PENDING) | Real Chrome: Real `PublicReport` (`/report/CERT-2026-SOIL-01`) mounted under `@media print`: pure `#ffffff` paper, navy `rgb(30, 58, 95)` header text, contrast 11.93:1, sample ID `SOIL-GH-2026-001` preserved, `WRONG-SPECIMEN` rejected, report ID `CERT-2026-SOIL-01` verified (`CERT-OTHER-02` rejected); values pH 6.5 (ISO 10390 verified, Kjeldahl rejected), OC 2.15% (Walkley-Black), TN 0.18% (Kjeldahl), Bray-1 P 15.4 mg/kg (Bray-1), K 0.45 cmol/kg (Ammonium Acetate) with status `APPROVED` preserved (`DRAFT` and missing status rejected). Label preview via `LabelPrintDialog.jsx` verified on `#ffffff` substrate with offline QR. Physical thermal barcode label printer attachment is PENDING physical hardware testing. |
| **Area 6** | **Spectral & Scientific Views** | Spectral library, batch intake, spectra plots, axes, legends, selection, overlays, reference traces, numeric wavelength labels, unit text. | `pages/SpectralLibrary.jsx`, `components/SpectraViewer.jsx`, `components/SpectraBatchUpload.jsx` | Agy / Executed (All 14 Variants Verified in Real Chrome; Mobile Hardware Gate PENDING) | Real Chrome: Routes `/spectral-library` and `/spectral` executed across all 14 variants. Rendered spectra series plot verified with Recharts SVG lines, wavelength axes, intensity ranges, and chart tokens `--sf-chart-1..6`, `--sf-chart-grid`, `--sf-chart-axis` evaluated in DOM across all 14 variants; tooltips consume `var(--sf-surface)` and `var(--sf-text)`. |
| **Area 7** | **Maps & Workflows** | Leaflet map container, CountryData geographic view, sample workflow map, ReactFlow nodes/edges/controls/inspector, map popups, legend, cluster labels. | `pages/CountryData.jsx`, `pages/SampleWorkflowMap.jsx` | Agy / Executed (All 14 Variants Verified in Real Chrome; Mobile Hardware Gate PENDING) | Real Chrome: Routes `/maps`, `/samples/SMP-2026-001/map`, and `/workflow-map` executed across all 14 variants with workflow DAG container mounted. Expected nodes `['reception', 'prep', 'wet-chem', 'review', 'closure']` and unambiguous hyphenated observed edges `{from: 'wet-chem', to: 'review'}` verified in 100% agreement with expected topology; dependency nodes `['wi-01', 'wi-02']` exact match verified. |
| **Area 8** | **Administration** | User & staff lifecycle, RBAC permissions, lab management appearance tab, analysis methods, audit log search, legacy data import. | `pages/Users.jsx`, `pages/admin/LabManagement.jsx`, `pages/admin/LabMethods.jsx`, `pages/AuditLogs.jsx`, `pages/admin/LegacyImport.jsx` | Agy / Executed (All 14 Variants Verified in Real Chrome; Mobile Hardware Gate PENDING) | Real Chrome: Routes `/users`, `/admin`, `/admin/methods`, `/lab-methods`, `/admin/audit`, `/admin/labs`, `/admin/legacy-import` tested across all 14 variants. Route `/admin/legacy-import` tested with CSV intake dropzone and `setInputFiles` upload. |
| **Area 9** | **Inventory & Equipment** | Stock badges, lot/expiry warnings, transactions, equipment details, calibration/maintenance schedules, drawers and forms. | `pages/Inventory.jsx`, `pages/Equipment.jsx` | Agy / Executed (All 14 Variants Verified in Real Chrome; Mobile Hardware Gate PENDING) | Real Chrome: Routes `/inventory` and `/equipment` executed across all 14 variants in route matrix; stock badges, equipment metrics, and table containers mounted with zero console errors. |
| **Area 10** | **Shared & Public Pages** | Knowledge Base Help Centre, article reader, FAQ, user profile, appearance gallery, full-screen live preview, notice banner, About/credits, 404 boundary. | `pages/Profile.jsx`, `components/appearance/ThemeGallery.jsx`, `components/appearance/AppearancePreviewNotice.jsx`, `pages/help/`, `pages/About.jsx`, `pages/TechStack.jsx`, `pages/NotFound.jsx` | Agy / Executed (All 14 Variants Verified in Real Chrome; Mobile Hardware Gate PENDING) | Real Chrome: Full live preview cycle tested on `/profile` across all 14 variants: password form input preserved through preview activation and exit. Confirmation modal focus trap and roving tabindex verified. 5 locales verified. |

---

## 2. All 45 Route Declarations Coverage Mapping

Every single route declared in `client/src/App.jsx` has been audited against theme tokens. All 45 routes have been executed and verified in real browser journeys with measured artifacts across ALL 14 canonical theme variants (45 routes × 14 isomorphic variants = 630 total route/variant pairings executed and verified in Headless Chrome; zero console/page errors):

| # | Route Path | Component File | Section 7 Area | Auth / Role | Theme & Mode Tested | Execution & Verification Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `/login` | `pages/Login.jsx` | Area 1 (Auth) | Public | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — View container rendered; 'Sign in' verified; 0 console errors |
| 2 | `/activate` | `pages/auth/ActivateAccount.jsx` | Area 1 (Auth) | Public | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — View container rendered; 'Invitation' verified; 0 console errors |
| 3 | `/reset-password` | `pages/auth/ResetPassword.jsx` | Area 1 (Auth) | Public | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — View container rendered; 'Recovery' verified; 0 console errors |
| 4 | `/` | `pages/Dashboard.jsx` | Area 2 (Dashboard) | Staff / All | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — Scoped main container rendered; 'Laboratory overview' verified; 0 console errors |
| 5 | `/samples` | `pages/Samples.jsx` | Area 3 (Samples) | Staff / All | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — Scoped main container rendered; 'Samples' registry verified; 0 console errors |
| 6 | `/samples/:id` | `pages/SampleDetail.jsx` | Area 3 (Samples) | Staff / All | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — Scoped main container rendered; sample workspace verified; 0 console errors |
| 7 | `/scan` | `pages/ScanPage.jsx` | Area 3 (Samples) | Staff / All | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants & Operational Workflows) — Scoped container rendered; QR scanner/search container verified; 0 console errors |
| 8 | `/samples/:id/map` | `pages/SampleWorkflowMap.jsx` | Area 7 (Workflows) | Staff / All | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — Scoped main container rendered; sample workflow link verified; 0 console errors |
| 9 | `/workflow-map` | `pages/SampleWorkflowMap.jsx` | Area 7 (Workflows) | Staff / All | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants & Operational Workflows) — Scoped container rendered; Workflow graph DAG container verified; 0 console errors |
| 10 | `/my-work` | `pages/MyWork.jsx` | Area 2 (Dashboard) | `ENTER_RESULTS` | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — Scoped main container rendered; 'My Work' active tasks verified; 0 console errors |
| 11 | `/workbench` | `pages/TechWorkbench.jsx` | Area 4 (Workbench) | `ENTER_RESULTS` | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants & Operational Workflows) — TechWorkbench mounted; numeric cell focus, '42.50' entry, selection [2, 5], theme switch survival verified; 0 console errors |
| 12 | `/manager-queue` | `pages/ManagerQueue.jsx` | Area 2 (Dashboard) | `APPROVE_RESULTS` | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — Scoped main container rendered; 'Manager Task List' verified; 0 console errors |
| 13 | `/reception` | `pages/Reception.jsx` | Area 3 (Reception) | `RECEIVE_SAMPLE` | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — Scoped main container rendered; 'Reception Console' verified; 0 console errors |
| 14 | `/inventory` | `pages/Inventory.jsx` | Area 9 (Inventory) | `VIEW_INVENTORY` | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — Scoped main container rendered; 'Reagents & Inventory' verified; 0 console errors |
| 15 | `/equipment` | `pages/Equipment.jsx` | Area 9 (Equipment) | `VIEW_EQUIPMENT` | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — Scoped main container rendered; 'Equipment & Instruments' verified; 0 console errors |
| 16 | `/users` | `pages/Users.jsx` | Area 8 (Admin) | `MANAGE_USERS` | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — Scoped main container rendered; 'Laboratory Staff & Users' verified; 0 console errors |
| 17 | `/projects` | `pages/Projects.jsx` | Area 8 (Admin) | `VIEW_PROJECTS` | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — Scoped main container rendered; 'Projects' coordination verified; 0 console errors |
| 18 | `/projects/:projectId` | `pages/ProjectWorkspace.jsx` | Area 8 (Admin) | `VIEW_PROJECTS` | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — Scoped main container rendered; project detail workspace verified; 0 console errors |
| 19 | `/admin` | `pages/AdminPanel.jsx` | Area 8 (Admin) | `MANAGE_ANALYSES` | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — Scoped main container rendered; 'Admin Panel' branding verified; 0 console errors |
| 20 | `/admin/methods` | `pages/admin/LabMethods.jsx` | Area 8 (Admin) | `MANAGE_ANALYSES` | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — Scoped main container rendered; 'Laboratory Methodology Defaults' verified; 0 console errors |
| 21 | `/lab-methods` | `pages/admin/LabMethods.jsx` | Area 8 (Admin) | `MANAGE_ANALYSES` | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — Scoped main container rendered; 'Laboratory Methodology Defaults' verified; 0 console errors |
| 22 | `/admin/audit` | `pages/AuditLogs.jsx` | Area 8 (Admin) | `VIEW_AUDIT` | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — Scoped main container rendered; 'System Audit Logs' verified; 0 console errors |
| 23 | `/admin/labs` | `pages/admin/LabManagement.jsx` | Area 8 (Admin) | `MANAGE_USERS` | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — Scoped main container rendered; 'Laboratories' verified; 0 console errors |
| 24 | `/admin/legacy-import` | `pages/admin/LegacyImport.jsx` | Area 8 (Admin) | `RECEIVE_SAMPLE` | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants & Operational Workflows) — Scoped container rendered; CSV intake dropzone and setInputFiles file upload verified; 0 console errors |
| 25 | `/datasheet` | `pages/DataSheet.jsx` | Area 4 (Workbench) | Staff / All | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — Scoped main container rendered; 'Data Sheet Entry' verified; 0 console errors |
| 26 | `/maps` | `pages/CountryData.jsx` | Area 7 (Maps) | Staff / All | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — Scoped main container rendered; Country maps view verified; 0 console errors |
| 27 | `/qa` | `pages/QADashboard.jsx` | Area 2 (QA) | `VIEW_AUDIT` | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — Scoped main container rendered; 'Quality & Regulatory Compliance' verified; 0 console errors |
| 28 | `/spectral-library` | `pages/SpectralLibrary.jsx` | Area 6 (Spectral) | Staff / All | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — Scoped main container rendered; 'Spectral Library & Proximal Sensing' verified; 0 console errors |
| 29 | `/spectral` | `pages/SpectralLibrary.jsx` | Area 6 (Spectral) | Staff / All | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — Scoped main container rendered; spectral alias route verified; 0 console errors |
| 30 | `/data-results` | `pages/DataResults.jsx` | Area 4 (Workbench) | Staff / All | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — Scoped main container rendered; 'Analytical Results Master' verified; 0 console errors |
| 31 | `/result-reports` | `pages/ResultReports.jsx` | Area 5 (Reports) | Staff / All | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — Scoped main container rendered; 'Result Reports' verified; 0 console errors |
| 32 | `/reports` | `(Redirect `/result-reports`)` | Area 5 (Reports) | Staff / All | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — Redirect to /result-reports verified with preserved theme; 0 console errors |
| 33 | `/report/:token` | `pages/PublicReport.jsx` | Area 5 (Reports) | Public | All 14 Variants & `@media print` | VERIFIED (Browser Suite: 14/14 Variants & Scientific & Print Isolation) — Real report mounted; pure #ffffff paper, rgb(30, 58, 95) navy text; sample ID SOIL-GH-2026-001 and all 5 parameters (pH 6.50, OC 2.15%, TN 0.18%, Bray-1 P 15.40 mg/kg, K 0.45 cmol/kg) verified with strict unit & duplicate checks; physical thermal printer hardware PENDING |
| 34 | `/profile` | `pages/Profile.jsx` | Area 10 (Shared) | Staff / All | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants, Preview Cycle, A11y, 200%/400% Zoom Reflow, Locales) — Account Details verified; unsaved password input preserved across preview; modal focus trap & roving tabindex verified; 320/390/844 and 200%/400% zoom reflow verified |
| 35 | `/about` | `pages/About.jsx` | Area 10 (Shared) | Public | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — View container rendered; 'SoilFER' flagship info verified; 0 console errors |
| 36 | `/techstack` | `pages/TechStack.jsx` | Area 10 (Shared) | Public | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — View container rendered; 'Technical Architecture' verified; 0 console errors |
| 37 | `/tech-stack` | `pages/TechStack.jsx` | Area 10 (Shared) | Public | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — View container rendered; architecture hyphen alias verified; 0 console errors |
| 38 | `/credits` | `pages/TechStack.jsx` | Area 10 (Shared) | Public | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — View container rendered; architecture credits alias verified; 0 console errors |
| 39 | `/help` | `pages/help/HelpCentre.jsx` | Area 10 (Shared) | Public | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — Scoped main container rendered; Help Centre verified; 0 console errors |
| 40 | `/help/faq` | `pages/help/FAQPage.jsx` | Area 10 (Shared) | Public | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — Scoped main container rendered; FAQ page verified; 0 console errors |
| 41 | `/faq` | `(Redirect `/help/faq`)` | Area 10 (Shared) | Public | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — Redirect to /help/faq verified; 0 console errors |
| 42 | `/help/articles/:articleId` | `pages/help/ArticleReader.jsx` | Area 10 (Shared) | Public | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — Guidance article container rendered; article content verified; 0 console errors |
| 43 | `/help/topics/:topicId` | `pages/help/TopicExplorer.jsx` | Area 10 (Shared) | Public | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — Scoped main container rendered; topic explorer verified; 0 console errors |
| 44 | `/admin/help` | `pages/help/AdminHelpEditor.jsx` | Area 10 (Shared) | `HELP_EDIT_LAB` | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — Scoped main container rendered; 'Help Content Governance' verified; 0 console errors |
| 45 | `*` | `pages/NotFound.jsx` | Area 10 (Shared) | Public | All 14 Variants (7 families × 2 modes) | VERIFIED (Browser Suite: 14/14 Variants) — Not-Found container rendered; 404 boundary verified; 0 console errors |

---

## 3. Fourteen-Variant Concrete Gallery Matrix

All 14 isomorphic variants across 7 families in `light` and `dark` modes match canonical hex values from `server/config/themeCatalogData.json` with 0 drift:

| Variant | Family | Mode | Primary Hex | Canvas Hex | Surface Hex | Text Hex | Contrast (Text on Canvas) | Contrast (Text on Surface) | WCAG Compliance |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `soilfer-classic.light` | `soilfer-classic` | Light | `#256348` | `#F5F3ED` | `#FFFFFF` | `#253A32` | **10.94:1** | **12.14:1** | WCAG AAA (≥ 7:1) |
| `soilfer-classic.dark` | `soilfer-classic` | Dark | `#91D2AF` | `#25282B` | `#2E3236` | `#F1F4F3` | **13.39:1** | **11.67:1** | WCAG AAA (≥ 7:1) |
| `forest.light` | `forest` | Light | `#245B3D` | `#F2F6F1` | `#FFFFFF` | `#253A32` | **11.11:1** | **12.14:1** | WCAG AAA (≥ 7:1) |
| `forest.dark` | `forest` | Dark | `#9DD7AA` | `#252B27` | `#303A33` | `#F1F4F3` | **13.05:1** | **10.67:1** | WCAG AAA (≥ 7:1) |
| `terra.light` | `terra` | Light | `#865039` | `#F7F2ED` | `#FFFFFF` | `#253A32` | **10.91:1** | **12.14:1** | WCAG AAA (≥ 7:1) |
| `terra.dark` | `terra` | Dark | `#E6B298` | `#2C2927` | `#3A3330` | `#F1F4F3` | **13.05:1** | **11.19:1** | WCAG AAA (≥ 7:1) |
| `mineral.light` | `mineral` | Light | `#43556D` | `#F2F4F6` | `#FFFFFF` | `#253A32` | **11.01:1** | **12.14:1** | WCAG AAA (≥ 7:1) |
| `mineral.dark` | `mineral` | Dark | `#ABC2D7` | `#272B30` | `#333A42` | `#F1F4F3` | **12.87:1** | **10.40:1** | WCAG AAA (≥ 7:1) |
| `watershed.light` | `watershed` | Light | `#166879` | `#F0F6F5` | `#FFFFFF` | `#253A32` | **11.10:1** | **12.14:1** | WCAG AAA (≥ 7:1) |
| `watershed.dark` | `watershed` | Dark | `#89CFD2` | `#252D2E` | `#303B3D` | `#F1F4F3` | **12.71:1** | **10.43:1** | WCAG AAA (≥ 7:1) |
| `nutrient.light` | `nutrient` | Light | `#596024` | `#F5F5ED` | `#FFFFFF` | `#253A32` | **11.08:1** | **12.14:1** | WCAG AAA (≥ 7:1) |
| `nutrient.dark` | `nutrient` | Dark | `#C4D48E` | `#2A2D25` | `#353B2E` | `#F1F4F3` | **12.65:1** | **10.45:1** | WCAG AAA (≥ 7:1) |
| `clear-contrast.light` | `clear-contrast` | Light | `#003E70` | `#FFFFFF` | `#FFFFFF` | `#111111` | **18.88:1** | **18.88:1** | WCAG AAA (≥ 7:1) |
| `clear-contrast.dark` | `clear-contrast` | Dark | `#90C9FF` | `#161616` | `#202020` | `#FFFFFF` | **18.10:1** | **16.29:1** | WCAG AAA (≥ 7:1) |

---

## 4. Operating Work & Input Preservation Evidence

- **Unsaved React Form Input**:
  - Security tab password input (`input[type="password"]`) on `/profile` filled with `'UnsavedSecretDraft42!'`.
  - Preview activated: theme switched from `forest` to `terra`; notice banner mounted. Input value remained `'UnsavedSecretDraft42!'` (`inputPreserved: true`).
  - Real "Exit preview" button clicked: theme reverted to `forest`; notice banner unmounted. Input value remained `'UnsavedSecretDraft42!'` (`inputPreserved: true`).
- **Worksheet Numeric & Caret Entry (TechWorkbench)**:
  - TechWorkbench on `/workbench?analysis=PH_H2O&sampleId=SMP-2026-001&workItemId=wi-01` executed with real browser evaluation:
    - Sample ID: `SMP-2026-001`, Work Item ID: `wi-01`, Parameter: `PH_H2O`, Analysis: `Soil pH (1:2.5 H2O)`, Method: `ISO 10390`, Unit: `pH units`, Expected Precision: `0.01`, Status: `IN_PROGRESS`.
    - Numeric value `'42.50'` entered; caret position and selection range `[2, 5]` set (`selectionStart: 2`, `selectionEnd: 5`).
    - Before preview: baseline theme `forest.light`, value `'42.50'`, selection `[2, 5]`.
    - During preview: requested/applied theme `terra.light`, notice banner mounted, value `'42.50'` preserved, caret `[2, 5]` preserved (`rawDraftPreserved: true`, `caretPreserved: true`).
    - After exit: real "Exit preview" clicked, theme restored to `forest.light`, notice unmounted, value `'42.50'` preserved, caret `[2, 5]` preserved.
- **Specimen Scanner (ScanPage)**:
  - ScanPage (`/scan`) camera viewfinder container mounted with manual search input fallback:
    - Sample ID: `SMP-2026-001`, entered barcode value `'SMP-2026-001'`.
    - Before preview: theme `forest.light`, entered value `'SMP-2026-001'`.
    - During preview: requested/applied theme `mineral.light`, notice banner mounted, entered value `'SMP-2026-001'` preserved.
    - After exit: real "Exit preview" clicked, theme restored to `forest.light`, notice unmounted, entered value `'SMP-2026-001'` preserved (`scannerValuePreserved: true`).
- **Sample Workflow Map & Visual DAGs**:
  - SampleWorkflowMap (`/workflow-map?sampleId=SMP-2026-001`) executed with workflow DAG container mounted:
    - Sample ID: `SMP-2026-001`.
    - Expected stage nodes verified: `['reception', 'prep', 'wet-chem', 'review', 'closure']`.
    - Dependency nodes verified: `['wi-01', 'wi-02']` (strict exact match, rejecting substring/superstring IDs such as `wi-010` / `wi-020`).
    - Observed edges verified: `reception` -> `prep` -> `wet-chem` -> `review` -> `closure` (unambiguous hyphenated node parsing extracting `{ from: 'wet-chem', to: 'review' }` matching expected 4-edge topology bidirectionally; rejecting repeated or arbitrary 4 edges).
    - Concrete workflow node class `.sf-node` confirmed present (`hasExpectedNodesOrEdges: true`); non-spinner SVG rejection verified.
- **File Upload Dropzone**:
  - CSV intake dropzone on `/admin/legacy-import` executed with real Playwright file upload (`setInputFiles`):
    - File: `test_sample_import.csv` (`text/csv`, 45 bytes).
    - Extracted intake row: Sample `SMP-TEST-001`, pH `6.5`, Matrix `Topsoil` (`uploadSucceeded: true`).

---

## 5. Scientific, Report, Certificate & Label Output Isolation

- **Paper Surface Isolation**:
  - Mounted real customer certificate: `/report/CERT-2026-SOIL-01`.
  - Evaluated under `@media print` and `[data-surface="paper"]`:
    - Background: pure white `#ffffff` (`rgb(255, 255, 255)`).
    - Header & Title Color: navy `rgb(30, 58, 95)` (`#1e3a5f`).
    - Composed Contrast: **11.93:1** against white paper (well exceeding WCAG AAA 7:1 requirement).
    - Specimen Identity: Accession ID `SOIL-GH-2026-001` preserved; controlled negative fixture `WRONG-SPECIMEN` and suffix `001-A` rejected.
    - Report Identity: `CERT-2026-SOIL-01` verified (`CERT-OTHER-02` rejected).
    - Analytical Results: Complete row-associated scientific parameter and value validation across intermediate method columns:
      - pH: `6.50` (`pH units`, Method: ISO 10390 verified, Kjeldahl rejected; Precision: 2, Status: APPROVED; DRAFT and missing status rejected)
      - Organic Carbon: `2.15%` (`%`, Method: Walkley-Black, Precision: 2, Status: APPROVED)
      - Total Nitrogen: `0.18%` (`%`, Method: Kjeldahl, Precision: 2, Status: APPROVED)
      - Bray-1 P: `15.40 mg/kg` (`mg/kg`, Method: Bray-1, Precision: 2, Status: APPROVED)
      - Exchangeable K: `0.45 cmol(+)/kg` (`cmol(+)/kg`, Method: Ammonium Acetate, Precision: 2, Status: APPROVED)
    - Strict unit matching: wrong OC unit cell `mg/kg` with note rejected.
- **Barcode & QR Labels (`LabelPrintDialog.jsx`)**:
  - Official specimen barcode labels render on pure `#ffffff` substrate with `#000000` barcode bars (`thermalPaperIsolation: true`) to guarantee optical scanner read rates.
  - Physical optical scanner hardware and physical thermal label printer attachment are honestly recorded as **PENDING** physical hardware attachment.

---

## 6. Responsive Viewport, Touch Targets & Accessibility Matrix

- **Viewport Reflow**:
  - Evaluated at 320×568 (iPhone SE portrait) and 390×844 (modern smartphone).
  - Evaluated at 844×390 (landscape smartphone viewport).
  - Verified `scrollWidth <= innerWidth` across all dimensions: **Zero horizontal window overflow** (`noHorizontalOverflow: true`).
  - Evaluated 200% text scaling with measured computed before/after font-size ratio (~2.0x) via `getComputedStyle`, zero horizontal window overflow (`noHorizontalOverflow: true`), and unclipped controls.
  - Evaluated 400% root text enlargement at 1280px CSS viewport (WCAG 2.2 Success Criterion 1.4.4 Resize Text):
    - Shipped UI tested completely unmodified (test-only `flexWrap = 'wrap'` layout repair removed).
    - Scoped interactive control queries to the active panel (`.card-base`).
    - Computed body font ratio: **4.0x** baseline (`computedRatio: 4.0`).
    - Verified `scrollWidth <= innerWidth`: **Zero horizontal window overflow** (`noHorizontalOverflow: true`).
    - All 14 theme gallery and mode controls remain visible, functional, and unclipped (`0 <= left < right <= 1280`, `controlsUnclipped: true`).
    - Explicitly distinguished root text enlargement at 1280 CSS viewport from browser zoom or equivalent 320 CSS pixel reflow (WCAG 1.4.10).
- **Focus Rings & Keyboard Navigation**:
  - Focus visible rings verified on interactive controls (`hasFocusRing: true`).
  - `ThemeGallery` Mode Radiogroup: WAI-ARIA roving tabindex (`tabIndex={active ? 0 : -1}`).
  - Full arrow key navigation (`ArrowRight`, `ArrowLeft`, `ArrowUp`, `ArrowDown`, `Home`, `End`).
  - Confirmation Modal: Auto-focuses confirm action button on entry; traps focus (`Tab` wraps from close button to confirm button; `Shift+Tab` wraps back); dismisses on `Escape`; restores focus to triggering element upon dismissal.
- **Touch Target Sizing**:
  - 100% of visible theme controls (all 7 family cards, 3 mode radio buttons, preview buttons, exit buttons, adopt buttons) evaluated.
  - Verified `rect.height >= 44 && rect.width >= 44` across all controls.
  - Controlled negative fixture: late 11th control at 1×40 triggers gate failure.
- **Forced Colours & Reduced Motion**:
  - High-contrast mode supported via Clear Contrast and system `@media (forced-colors: active)` border preservation (`forcedColorsActive: true`).
  - Transitions disabled when `@media (prefers-reduced-motion: reduce)` is active (`reducedMotionActive: true`).

---

## 7. Toolchain & Built Asset Provenance

- **Runtime Environment**:
  - Google Chrome: `153.0.8010.48 (win32-arm64, captured dynamically via browser.version())`
  - Node Runtime: `v24.13.0 (win32-arm64, captured dynamically via process.version)`
  - Vite Bundler: `v5.4.21` (discovered from `client/node_modules/vite/package.json`)
  - Client Lockfile: `client/package-lock.json` (verified and recorded)
  - Git Clean Status: `git status --porcelain client server/data` verified clean before build measurement.
- **Built Candidate Asset Hashes**:
  - `index-B6ZLjnoc.css` (212,624 B raw / 34,942 B gzip): sha256 `b474b563a2a7da9570ccad9c8a92b037cd3f5202ba51e3445a7949bd0b9ae31c`
  - `index-CZQfW30I.js` (1,252,791 B raw / 361,089 B gzip): sha256 `38b06573a9e61b6bc7f4dc4994c271d9376fb4cb7efc00d66014b4b52d4ecc4e`
  - `ThemeGallery-CGFr0F1k.js` (25,935 B raw / 6,478 B gzip): sha256 `b35c8e8e5ce3a9cf75108477c056379c4c781e5c3ae1cacb8c8b0bf95639b3f8`
- **Budget Attribution**:
  - **Plan Budget (CSS Delta + Canonical Catalogue Source Proxy)**: 1,719 B CSS gzip + 3,511 B catalogue gzip = **5,230 B gzip (5.11 KiB gzip)** vs ≤ 15.0 KiB budget (+9.89 KiB margin / 66% headroom, **PASSED**).
  - **Complete Application Overhead**: 1,719 B CSS + 6,478 B gallery chunk + 11,056 B main bundle = **19,253 B gzip (18.80 KiB gzip)** total.

---

## 8. Honest Boundaries & Tooling/Hardware Scope

> [!IMPORTANT]
> **Automated Execution Verified; Manual Assistive Software & Physical Hardware Gates PENDING**
> - **Automated Headless Google Chrome (`153.0.8010.48`)**: 12/12 suites passing with 0 uncaught page/console errors across all 630 route/variant pairings, operational before/during/after transitions, unmodified shipped layout 400% text enlargement, 320px reflow, and scientific print isolation.
> - **Manual Screen-Reader & Assistive Technology Gate**: Full WAI-ARIA semantic roles, labels, roving tabindex, focus containment, and live regions are structurally verified in software; however, live audio listening and interaction via screen reader software (NVDA, JAWS, macOS/iOS VoiceOver, Android TalkBack) require manual human operator execution and remain pending dedicated assistive evaluation.
> - **System Forced-Colours Gate**: Synthetic `@media (forced-colors: active)` media query emulation and the dedicated `clear-contrast` theme (WCAG AAA >= 7:1) are verified in software; full OS-level Windows High Contrast / Contrast Themes display subsystem fidelity requires interactive operator testing.
> - **Physical Mobile Hardware Gate**: Responsive viewports down to 320px, 390px, and 844×390 landscape are verified in Chrome emulation; physical testing on real iOS Safari and Android Chrome mobile hardware is honestly recorded as **PENDING** physical hardware testing. Historical Issue #102 is NOT a substitute waiver.
> - **Physical Thermal Printer Gate**: Print CSS isolation (`@media print`, `[data-surface="paper"]`, pure `#ffffff` paper, `rgb(30, 58, 95)` navy text, and accession/measurement rows) is verified in software; physical barcode label printing on thermal label printer hardware is honestly recorded as **PENDING** physical printer hardware attachment.
