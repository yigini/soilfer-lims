# PR #155 Review Remediation Handoff: Candidate `cdb0f1f`

## Technical Summary & Artifact Identity
- **Candidate Commit**: `cdb0f1fbbbdc1c8e6725a3417a1fb01d7d463675` (`cdb0f1f`)
- **Candidate Full Tree**: `203881f38969a2aa44f9ca991c8cb4587546757f`
- **Candidate Client Tree**: `6e83b8d431a820d700ac6ac7a4398e5f3a1bb216` (strictly frozen byte-for-byte; zero CSS mutation)
- **Candidate Server Tree**: `b113628e2d652af21f97752bf548164b69ac153e`
- **Candidate Server/Data Tree**: `1a2a84457d02d33707f9845da10f9b97995e1377` (strictly frozen byte-for-byte)
- **Base Commit**: `1265e8aa9f71f5f60b61c6fdaf31bc36ba8b2c54` (`1265e8a`, `v3.5.31-1265e8a`)
- **Accepted Main Tree**: `260975e57d0b3a1389f622c2f84ef444f3f46cf4`
- **Reused Customer Certificate PDF**: `server/scripts/test_certificate_output.pdf` (162,633 B, SHA-256 `47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a`)
- **Built CSS Asset**: `client/dist/assets/index-Df7izgw5.css` (213,700 B raw / 35,045 B gzip, SHA-256 `65e7d0a287cb6557cc05e125cd213b0d09738b6778ab8b2f9b90b4f6a9431c75`)
- **Automated Browser Evidence Suite**: `server/scripts/verify_issue155_browser_journeys.cjs` (**12/12 SUITES PASS 100% GREEN**):
  - Runner Trim SHA-256: `893e7fb91849a41be3653659621d8e62546bfd7a3f4304fdf92606847c105c5d`
  - Result Trim SHA-256: `fa545e9938547d6f30d2f17f2e2b4ff047bf50db08c302441ecc18bf6e8c8dca`
  - Browser Provenance: `Headless Google Chrome 154.0.8037.93 (Windows NT / arm64)`
  - Run Timestamp: `2026-10-03T08:11:31.125Z`
- **In-Checkout Verification Suite**: `server/scripts/verify_all_14.cjs` (**58/58 PASS 100% GREEN**)
- **Saved Short Handoff**: `sitewide-themes-ready-for-review.md` updated to candidate `cdb0f1f`.
- **PR Status**: [PR #155](https://github.com/yigini/soilfer-lims/pull/155) remains **OPEN**, unmerged, undeployed. Themes are **NOT LIVE**.

---

## Detailed Remediation of Independent Review Findings

### 1. Finding 1: Executed CDP Session Probe Witness & Truthful Desktop Optical Zoom Classification
- **Review Finding**: In candidate `314ff2d`, prose claimed an unevidenced `'setPageScaleFactor not supported on desktop'` error without an execution artifact, while the runner had zero occurrences of `newCDPSession`, `CDPSession`, `setPageScaleFactor`, or `visualViewport`.
- **Remediation & Execution Witness**:
  - The pinned runner `server/scripts/verify_issue155_browser_journeys.cjs` now explicitly creates a live CDP session on the running Chrome browser instance and executes the probe:
    * **Executed Command**: `CDPSession.send('Emulation.setPageScaleFactor', { pageScaleFactor: 4.0 })`
    * **Command Receipt**: `{}` (success, `commandError: null`)
    * **Initial Metrics**: `{ devicePixelRatio: 1, innerWidth: 1280, innerHeight: 800, visualViewportScale: 1, visualViewportWidth: 1280 }`
    * **Post-Scale Metrics**: `{ devicePixelRatio: 1, innerWidth: 1280, innerHeight: 800, visualViewportScale: 4, visualViewportWidth: 320 }`
    * **Reset Command**: `CDPSession.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1.0 })`
  - **Empirical Observation**:
    * CDP `Emulation.setPageScaleFactor` directly sets mobile touch pinch-to-zoom visual viewport scale, reducing `visualViewport.width` to 320 while leaving desktop window layout un-reflowed (`innerWidth: 1280`, `devicePixelRatio: 1`).
    * This confirms that `setPageScaleFactor` is mobile touch pinch-zoom emulation, not desktop browser window reflow optical zoom.
  - **Scoped W3C SC 1.4.10 Reflow Equivalence**:
    * Desktop browser window chrome optical zoom (Ctrl+/Ctrl- or Zoom 400% in browser application settings) scales CSS pixels proportionally, which is evaluated under W3C Understanding SC 1.4.10 Reflow via the 320 CSS px viewport width (`viewport: { width: 320, height: 568 }`, iPhone SE portrait layout equivalence) with zero horizontal overflow, unclipped active panel controls, and touch target compliance, alongside High-DPI DPR 2.0 at 640 CSS px with root font 200% (`fontSize = '200%'`) and DPR 1.0 at 1280 CSS px with root font 400% (`fontSize = '400%'`).
  - **Truthful Classification**:
    * Direct desktop application window chrome zoom menu automation (Ctrl+/Ctrl-) is classified truthfully as Software Pending with this executed CDP probe witness, while W3C SC 1.4.10 320 CSS px reflow layout equivalence is actively verified in software.

### 2. Finding 2: Truthful Readiness & Whole Stage Scope Reconciliation
- **Review Finding**: Reconcile claims across documents, eliminate blanket 'complete, production-grade' claims, accurately update the saved short handoff (`sitewide-themes-ready-for-review.md`), and enumerate all 14 operating items.
- **Remediation**:
  - Reconciled PR #155 description, `TRACEABLE-MATRIX.md`, and `EVIDENCE.md`: eliminated blanket readiness assertions.
  - Updated `sitewide-themes-ready-for-review.md` with candidate commit `cdb0f1f`, full tree `203881f38969a2aa44f9ca991c8cb4587546757f`, runner trim `893e7fb9...`, result trim `fa545e99...`, timestamp `2026-10-03T08:11:31.125Z`, and truthful status.
  - PR #155 is OPEN, unmerged, and undeployed; themes are **NOT LIVE**.
  - All 14 items enumerated and bound to truthful execution artifacts:
    1. All 14 supported selector/adoption/preview/exit roots and named notice verified in real Chrome (`previewActiveState.variantTransitions.length === 14`).
    2. Unfinished numeric entry and synthetic composition verified in `TechWorkbench.jsx` with `'42.50'`, caret/selection `[2, 5]`, and synthetic `compositionend`. Synthetic events are documented as synthetic, not native/system OS IME candidate windows (manual pending).
    3. Draft/caret/cell/review/filter/native scroll verified with physical offset `container.scrollTop = 48` on overflowing element (`scrollHeight: 2106 px > clientHeight: 736 px`), cell focus, review drawer `'Selected Sample'`, filter `'SMP-2026'`, and confirmation modal focus trap.
    4. Pending upload bytes / full draft / parsed UI verified on `/admin/legacy-import` with `test_sample_import.csv` (44 bytes), textarea draft equality, and unassigned `matrix` row preserved.
    5. ScanPage stream/tracks/node identity/permissions verified in real browser with `<video>` node identity (`tagName: 'VIDEO'`, `readyState: 4`, `srcObjectAssigned: true`), stream details (`trackCount: 1`, kind `video`, readyState `live`), node retention `isSameNode === true`, and `permissionsState: 'granted'`.
    6. Deliberate non-default Leaflet map pan/zoom (`[7.0, -1.0]`, zoom 16), satellite layer toggle, popup coords, and retention verified across all 14 transitions and modal exit, enabled by the authorized `SampleMap.jsx` memoization fix.
    7. Selected spectral/library/full overlays/grid/Y/axes verified in real browser with continuous 500-point calibration models, 1-to-1 model matching, full scientific axis domain coverage ($X \in [400, 4000]$, $Y \in [0.12, 1.18]$), strict MIR axis semantics (`Wavenumber (cm⁻¹)` and `Absorbance`), single common coordinate frame matrix composition for BOTH ticks and curves, observed numeric tick anchors (`st.anchors.x`, `st.anchors.y`) with linear fits $\le 2.5$ px, final-gate physical bound validation, and unconstrained responsive plot geometry (arbitrary `> 0.2` floor removed; 74.85 px to 748.5 px supported).
    8. Complete supported scientific/worksheet/report/certificate/label/shared output verified under `@media print` (`/report/CERT-2026-SOIL-01`, white paper `#ffffff`, navy text `rgb(30, 58, 95)` 11.50:1 contrast, complete 5-row measurements, and genuine reused customer certificate PDF SHA-256 `47fdaa79...`). Label preview on pure white `#ffffff` substrate with sample `SMP-2026-001` and ZXing-decoded QR payload.
    9. Assigned browser/viewport/accessibility verified: reflow down to 320px viewport, landscape 844×390, 200% and 400% zoom reflow (WCAG 1.4.4 / 1.4.10), high contrast WCAG AAA $\ge 7:1$, reduced motion, forced colors, executed CDP session probe `setPageScaleFactor`, and 5 locales (en, es, es-419, fr, pt). Physical screen reader (NVDA/JAWS/VoiceOver), OS contrast theme display, physical mobile hardware (iOS/Android), and physical thermal printer remain honestly manual pending. Historical Issue #102 is NOT a waiver.

---

## Standing Governance & Boundaries
- Sole-Agy deployment authorization stands, strictly held pending independent technical acceptance, protected merge to `main`, exact-main CI success, and safe operator deployment gates.
- Client tree `6e83b8d4...` and production CSS asset `index-Df7izgw5.css` strictly frozen byte-for-byte; zero CSS mutation.
- Standing 5-minute active monitor maintained; no background polling loops.
