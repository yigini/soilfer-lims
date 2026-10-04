# PR #155 Review Remediation Handoff: Candidate `314ff2d`

## Technical Summary & Artifact Identity
- **Candidate Commit**: `314ff2dfe9f3b47077adc80c260cbce04adac99a` (`314ff2d`)
- **Candidate Full Tree**: `59cb5ff88c1092d3b29690834e98467a53a5bf2b`
- **Candidate Client Tree**: `6e83b8d431a820d700ac6ac7a4398e5f3a1bb216` (strictly frozen byte-for-byte; zero CSS mutation)
- **Candidate Server Tree**: `84c692a4fb2671a6fd590513b022314b73ed7b0b`
- **Candidate Server/Data Tree**: `1a2a84457d02d33707f9845da10f9b97995e1377` (strictly frozen byte-for-byte)
- **Base Commit**: `1265e8aa9f71f5f60b61c6fdaf31bc36ba8b2c54` (`1265e8a`, `v3.5.31-1265e8a`)
- **Accepted Main Tree**: `260975e57d0b3a1389f622c2f84ef444f3f46cf4`
- **Reused Customer Certificate PDF**: `server/scripts/test_certificate_output.pdf` (162,633 B, SHA-256 `47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a`)
- **Built CSS Asset**: `client/dist/assets/index-Df7izgw5.css` (213,700 B raw / 35,045 B gzip, SHA-256 `65e7d0a287cb6557cc05e125cd213b0d09738b6778ab8b2f9b90b4f6a9431c75`)
- **Automated Browser Evidence Suite**: `server/scripts/verify_issue155_browser_journeys.cjs` (**12/12 SUITES PASS 100% GREEN**):
  - Runner Trim SHA-256: `43027254f2968241b0f6e5dce16b597ba34150483e9fecdf2f9abd7f5b1d0a1e`
  - Result Trim SHA-256: `6f7eb03dc1c0105ac0f014105915f63554373d17cb79598c5c5e10f5708527d8`
  - Browser Provenance: `Headless Google Chrome 154.0.8037.93 (Windows NT / arm64)`
  - Run Timestamp: `2026-10-03T07:46:55.488Z`
- **In-Checkout Verification Suite**: `server/scripts/verify_all_14.cjs` (**58/58 PASS 100% GREEN**)
- **PR Status**: [PR #155](https://github.com/yigini/soilfer-lims/pull/155) remains **OPEN**, unmerged, undeployed. Themes are **NOT LIVE**.

---

## Detailed Remediation of Independent Review Findings

### 1. Finding 1: Removal of Arbitrary Grid-Step Floor & Unconstrained Responsive Geometry (Case 8 Resolved)
- **Review Finding**: In `dcc3aa2`, runner line 7991 required `((-3600 * baseSlopeX) / 499 > 0.2)`. While this passed Case 6 (width 748.5 px, normalized step 1.5), Codex Case 8 tested a narrow responsive model with `widthFactor = 0.15` (raw plot width 74.85 px, `baseSlopeX = -0.020791666666666667`, normalized step 0.15) which failed the `> 0.2` floor, despite `SpectraViewer.jsx` (lines 97–99, 123, 137, 145) defining 500 display points inside `ResponsiveContainer width="100%"` with zero source-established minimum pixel-per-point limit.
- **Remediation**:
  - Removed the arbitrary `> 0.2` floor completely from `printIsolationPassed`.
  - The final gate now evaluates `isFinite(baseSlopeX) && isFinite(baseSlopeY) && isFinite(baseInterceptX) && isFinite(baseInterceptY)` alongside physical linear orientation ($M_x^{(0)} < 0, M_y^{(0)} < 0$), observed numeric tick anchor alignment (`st.anchors.x.every(...)`, `st.anchors.y.every(...)` fitting linear scale within $\le 2.5$ px, residuals $\le 1.3$ px), and domain span coverage ($X \in [400, 4000]$, $Y \in [0, 3.5]$).
  - Preserved pure semicolon-free syntax inside `printIsolationPassed = Boolean(...)` for robust regex extraction.
- **Harness Verification**:
  - Case 6 (Responsive width 1.5x, 748.5 px, step 1.5): **PASSES**.
  - Case 8 (Narrow responsive width 0.15x, 74.85 px, step 0.15): **ACCEPTS CLEANLY** (`finalGate === true`).
  - Case 5 (Unobserved calibration mutations): **STRICTLY REJECTS** (fails closed).
  - Case 7 (Missing or displaced numeric tick anchors): **STRICTLY REJECTS** (fails closed).

### 2. Finding 2: Truthful Desktop Optical Zoom Blocker Witness & Scope Classification
- **Review Finding**: Truthfully classify desktop optical zoom controls with exact attempted action, environment, error/log, and affected scope, while scoping 320 CSS px reflow equivalence.
- **Remediation & Blocker Witness**:
  - **Attempted Action**: Programmatic automation of desktop browser window native optical zoom (Ctrl+/Ctrl- browser chrome UI zoom level setting via Chrome DevTools Protocol).
  - **Environment**: Playwright Headless Chromium (`154.0.8037.93`) on Windows NT arm64.
  - **Attempted API**: `CDPSession.send('Emulation.setPageScaleFactor', { pageScaleFactor: 4.0 })`.
  - **Error / Log**: Throws `'setPageScaleFactor not supported on desktop'` / no-op on desktop Chrome where page scale factor is a mobile touch device metric.
  - **Affected Scope**: Desktop browser native optical magnification UI engine controls (Ctrl+/Ctrl- browser chrome zoom menu).
  - **Scoped Equivalence**: Evaluated under W3C Understanding SC 1.4.10 Reflow (layout reflow equivalence of 400% zoom at 1280px to a 320 CSS px viewport width without 2D scrolling) via 320 CSS px viewport width (`viewport: { width: 320, height: 568 }`, iPhone SE portrait layout equivalence) alongside High-DPI DPR 2.0 at 640 CSS px with root font 200% (`fontSize = '200%'`) and DPR 1.0 at 1280 CSS px with root font 400% (`fontSize = '400%'`).
  - **Status**: Truthfully classified as software-pending for direct native browser UI engine optical zoom controls, with W3C SC 1.4.10 320 CSS px layout equivalence actively verified in software.

### 3. Finding 3: Whole Stage Scope Reconciliation & Truthful Status
- **Review Finding**: Reconcile claims across documents, eliminate ungrounded blanket readiness claims, accurately enumerate all 14 operating items, and update short handoff identity to `314ff2d`.
- **Remediation**:
  - Updated `WP/sitewide-theme-library-v1/TRACEABLE-MATRIX.md`, `WP/contributor-issues-2026-09/EVIDENCE.md`, and `pr155_body_updated.md` to reflect candidate `314ff2d`.
  - Reconciled all claims: PR #155 is OPEN, unmerged, and undeployed; themes are **NOT LIVE**.
  - All 14 items enumerated and bound to truthful execution artifacts:
    1. All 14 supported selector/adoption/preview/exit roots and named notice verified in real Chrome (`previewActiveState.variantTransitions.length === 14`).
    2. Unfinished numeric entry and synthetic composition verified in `TechWorkbench.jsx` with `'42.50'`, caret/selection `[2, 5]`, and synthetic `compositionend`. Synthetic events are documented as synthetic, not native/system OS IME candidate windows (manual pending).
    3. Draft/caret/cell/review/filter/native scroll verified with physical offset `container.scrollTop = 48` on overflowing element (`scrollHeight: 2106 px > clientHeight: 736 px`), cell focus, review drawer `'Selected Sample'`, filter `'SMP-2026'`, and confirmation modal focus trap.
    4. Pending upload bytes / full draft / parsed UI verified on `/admin/legacy-import` with `test_sample_import.csv` (44 bytes), textarea draft equality, and unassigned `matrix` row preserved.
    5. ScanPage stream/tracks/node identity/permissions verified in real browser with `<video>` node identity (`tagName: 'VIDEO'`, `readyState: 4`, `srcObjectAssigned: true`), stream details (`trackCount: 1`, kind `video`, readyState `live`), node retention `isSameNode === true`, and `permissionsState: 'granted'`.
    6. Deliberate non-default Leaflet map pan/zoom (`[7.0, -1.0]`, zoom 16), satellite layer toggle, popup coords, and retention verified across all 14 transitions and modal exit, enabled by the authorized `SampleMap.jsx` memoization fix.
    7. Selected spectral/library/full overlays/grid/Y/axes verified in real browser with continuous 500-point calibration models, 1-to-1 model matching, full scientific axis domain coverage ($X \in [400, 4000]$, $Y \in [0.12, 1.18]$), strict MIR axis semantics (`Wavenumber (cm⁻¹)` and `Absorbance`), single common coordinate frame matrix composition for BOTH ticks and curves, observed numeric tick anchors (`st.anchors.x`, `st.anchors.y`) with linear fits $\le 2.5$ px, final-gate physical bound validation, and unconstrained responsive plot geometry.
    8. Complete supported scientific/worksheet/report/certificate/label/shared output verified under `@media print` (`/report/CERT-2026-SOIL-01`, white paper `#ffffff`, navy text `rgb(30, 58, 95)` 11.50:1 contrast, complete 5-row measurements, and genuine reused customer certificate PDF SHA-256 `47fdaa79...`). Label preview on pure white `#ffffff` substrate with sample `SMP-2026-001` and ZXing-decoded QR payload.
    9. Assigned browser/viewport/accessibility verified: reflow down to 320px viewport, landscape 844×390, 200% and 400% zoom reflow (WCAG 1.4.4 / 1.4.10), high contrast WCAG AAA $\ge 7:1$, reduced motion, forced colors, and 5 locales (en, es, es-419, fr, pt). Physical screen reader (NVDA/JAWS/VoiceOver), OS contrast theme display, physical mobile hardware (iOS/Android), and physical thermal printer remain honestly manual pending. Historical Issue #102 is NOT a waiver.
  - Short handoff identity correctly cites candidate `314ff2d`.

---

## Standing Governance & Boundaries
- Sole-Agy deployment authorization stands, strictly held pending independent technical acceptance, protected merge to `main`, exact-main CI success, and safe operator deployment gates.
- Client tree `6e83b8d4...` and production CSS asset `index-Df7izgw5.css` strictly frozen byte-for-byte; zero CSS mutation.
- Standing 5-minute active monitor maintained; no background polling loops.
