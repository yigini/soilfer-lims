### Remediation Update: Reception Geographic Map Mounted, Spectral Multi-Overlay Comparison Observed, and Upload UI State Tracked

Candidate Head Commit: `868e682afcf2fe7c7e7f9166ce9427d713bb3060` (`868e682`)  
Prior Reviewed Head: `1015524384c254383d12c10cd6d67e1bf2755c59` (`1015524`)  
Status: PR #155 OPEN, unmerged, undeployed. Production remains live on `v3.5.31-1265e8a`.

---

#### 1. Concrete Remediation of Codex Independent Review 1015524 Findings

1. **Geographic Map Mounted in Sample Reception (`client/src/pages/Reception.jsx` & Runner)**:
   - *Mode Gate Remediation*: Navigated to `/reception?originalId=SMP-2026-001&mode=PROJECT&projectId=PRJ-2026-01`, bypassing the initial Mode Selection screen directly into the project intake console.
   - *Mounted Leaflet Observation*: Observed `.leaflet-container`, Leaflet marker, circle at `[5.6037, -0.1870]`, coordinates text, popup display (`SMP-2026-001`, `5.603700, -0.187000`, `Uncertainty: ±5m`), and functional layer switcher toggling Satellite/Standard (`mounted: true`, `hasMarker: true`, `mapPreserved: true`).

2. **Multi-Overlay Spectral Comparison & Preserved Exit Gate (`SpectralLibrary.jsx` & Runner)**:
   - *Multi-Overlay Comparison*: Expanded group row in `SpectralLibrary` and clicked "Compare" (`handleCompareGroup`), observing 2 series traces, 500 common grid points, legend items, and `tracesVerified: true`.
   - *Preserved Exit Point Multiplicity*: Single scan Recharts curve validated on exit (`pointCount: 9`, `curvePreserved: true`, `overlaysPreserved: true`), strictly preserving the 9-point invariant for `spectralAfterExit`.

3. **Upload UI State Tracked (Pending & Parsed)**:
   - *Pending Intake State*: Recorded `pendingState: { hasFileInput: true, hasTextarea: true, fileName: 'test_sample_import.csv', fileSize: 44, hasFile: true }`.
   - *Parsed UI State*: Recorded `parsedState: { tableRendered: true, harmonisationBanner: true, headers: ['sampleId', 'pH', 'matrix'] }`.

4. **Camera & Media Device Inspection Reconciled**:
   - Reconciled `mediaDeviceInspection.unmountedReason = null` with active camera stream (`cameraActive: true, cameraStreamPreserved: true, cameraStreamStatus: 'ACTIVE_STREAM'`), eliminating stale unmounted reason description while maintaining genuine fake-device vs physical hardware distinction.

5. **Preserved Accepted Closures (Strictly Preserved, Do Not Reopen)**:
   - Shipped camera startup and synchronization fix in `ScanPage.jsx` (`cameraActive: true, cameraStreamPreserved: true, cameraStreamStatus: 'ACTIVE_STREAM'`).
   - Native scroll on overflowing `TechWorkbench.jsx` container (`scrollHeight: 2106 > clientHeight: 736`, `scrollTop: 48`) with zero `Object.defineProperty` shadow fallback.
   - Exit spectral curve monotonic X-grid spacing (`validX`) strictly rejecting scrambled/reordered X arrays.
   - 5-row scientific report transition gate (pH 6.50, OC 2.15, TN 0.18, P 15.40, K 0.45 at precision 2 across all 14 variants).
   - Worksheet sample/work-item identity `SMP-2026-001` / `wi-01` and filter `SMP-2026` strictly enforced; `wi-99` and empty drawer rejected.
   - Reused 162,633-byte PDF SHA256 `47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a`.
   - 630 CSS pairs, `dist/assets/index-Df7izgw5.css` (213.70 kB raw / 35.05 kB gzip, SHA256 `65e7d0a287cb6557cc05e125cd213b0d09738b6778ab8b2f9b90b4f6a9431c75`) strictly frozen and 100% byte-for-byte identical.

---

#### 2. Verification Results

- **Running-App Browser Evidence Suite** (`server/scripts/verify_issue155_browser_journeys.cjs`): All **12/12 suites PASSED 100% green** with zero uncaught page errors and zero unexpected console errors. Freshly persisted `server/scripts/issue155-browser-journeys-results.json`.
- **In-Checkout Test Suite** (`server/scripts/verify_all_14.cjs`): All **58/58 test cases PASSED 100% green**.

---

#### 3. Preserved Invariants & Boundaries

- **CSS & Asset Freeze**: `dist/assets/index-Df7izgw5.css` remains 100% byte-for-byte identical (SHA-256 `65e7d0a287cb6557cc05e125cd213b0d09738b6778ab8b2f9b90b4f6a9431c75`).
- **Server/Data Tree**: `1a2a84457d02d33707f9845da10f9b97995e1377` (strictly preserved, zero mutation).
- **Reused Assets & PDF**: 630 CSS pairs, 162,633-byte PDF SHA-256 `47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a` strictly preserved.
- **Honest Boundaries**: Disposable app verification complete; manual screen-reader, OS contrast themes, physical mobile, and physical thermal printer remain pending physical hardware testing.
