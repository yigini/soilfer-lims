### Remediation Update: Worksheet Authentic Identity/Filter/Scroll/IME, Spectral Exit Curve Calibrated Model, and Camera Media Device Inspection

Candidate Head Commit: `140be7e7ef3458e6b9aa40fc51b93dcadfd9eb78` (`140be7e`)  
Prior Reviewed Head: `718cd7944c013cfc0e40754ffd0e1be10dc9292a` (`718cd79`)  
Status: PR #155 OPEN, unmerged, undeployed. Production remains live on `v3.5.31-1265e8a`.

---

#### 1. Concrete Remediation of Codex Independent Review 718cd79 Findings

1. **Worksheet Sample/WorkItem Identity, Filter, Scroll, and IME Composition Lifecycle**:
   - `selectedCellPreserved`: Resolves authentic item identity via `attrItemId || rackPosId` (inspecting child `[data-testid*="rack-pos-"]` or `[data-workitem-id]`), requiring `selectedRowItemId === 'wi-01'`, `selectedRowText.includes('SMP-2026-001')`, and `!selectedRowText.includes('WRONG SAMPLE')`.
   - Strictly rejects arbitrary rows (e.g. `row = { getAttribute: () => 'wi-99', textContent: 'WRONG SAMPLE' }`).
   - `selectedCell`: Reports observed row item ID (`selectedRowItemId || null`), never defaulting to `'wi-01'` when absent.
   - `filterPreserved`: Runner sets nondefault filter `'SMP-2026'`; strictly checks `filterInput.value === 'SMP-2026'`. Rejects changed filters e.g. `'CHANGED FILTER'`.
   - `scrollPreserved`: Runner sets nondefault offset `scrollTop = 48`; strictly checks `container.scrollTop === 48`. Rejects default `0`.
   - `reviewDrawerPreserved`: Uses consistent query and assertions across `wsBefore`, `wsDuring`, `vt`, and `wsAfter` (`reviewDrawerPreserved: true`, `reviewDrawerOpen: true`). Rejects empty drawer instruction `'Select a row'` and requires `'Selected Sample'` and `'SMP-2026-001'`.
   - `isComposingObserved`: Checks `Boolean(inp && inp.nodeType === 1 && inp.isComposing === true)` directly on the input node. Rejects `inp.isComposing === false` even if global marker `__sfActiveComposition === true`. Reports `compositionCompleted: true` post-exit.

2. **Spectral Series Exit Curve 9-Point Calibrated Model Verification**:
   - `spectralAfterExit`: Strictly validates complete 9-point calibrated Recharts curve model against `expectedMockValues = [0.12, 0.35, 0.58, 0.45, 0.82, 1.15, 0.90, 0.40, 0.25]` and specimen identity `SMP-2026-001`.
   - Arbitrary geometric stubs (e.g. `M0,0 L1,1`) evaluate to `curvePreserved: false` and are strictly rejected by the final gate.
   - Removed example-specific banned numbers `999/888` on `selectedPeaks`; preserved supported SpectraViewer peak-selection and interactive-zoom N/A mapping (`peakSelectionSupported: false`, `zoomSupported: false`, `overlaySupported: true`).

3. **Camera Stream & Media Device Inspection**:
   - Honestly reports `cameraActive: false, cameraStreamPreserved: false, cameraStreamStatus: 'IDLE_VIEWFINDER_UNMOUNTED_VIDEO'` in `ScanPage` DOM.
   - Enriched `mediaDeviceInspection` with real `navigator.mediaDevices.getUserMedia` probe, verifying `hasVideoInput: true`, `streamAcquired: true`, `activeTracks: 1`, track label `'fake_device_0'`.
   - Documents exact architectural reason in `ScanPage.jsx`: `ScanPage.jsx` initializes `cameraActive=false` rendering fallback, and `startCamera()` checks `videoRef.current` before `setCameraActive(true)`, leaving `<video>` unmounted in the initial state despite active fake media device.

4. **Preserved Accepted Closures (Do Not Reopen)**:
   - 5-row scientific report transition gate (pH 6.50, OC 2.15, TN 0.18, P 15.40, K 0.45 at precision 2 across all 14 variants).
   - Absent camera no longer credited active; active synthetic stream positive passes.
   - Absent chart exit rejected by final gate.
   - Invented peak/popup fallbacks removed; supplied popup is `null`.
   - Reused 162,633-byte PDF SHA256 `47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a`.
   - 630 CSS pairs, client tree `d30e0197f6d0619b8b71fdd5c8fabc5803bf6c1b`, and server/data tree `1a2a84457d02d33707f9845da10f9b97995e1377` strictly frozen.

---

#### 2. Verification Results

- **Running-App Browser Evidence Suite** (`server/scripts/verify_issue155_browser_journeys.cjs`): All **12/12 suites PASSED 100% green**. Regenerated `server/scripts/issue155-browser-journeys-results.json` (timestamp `2026-10-02T08:01:32.381Z`).
- **In-Checkout Test Suite** (`server/scripts/verify_all_14.cjs`): All **58/58 test cases PASSED 100% green**.
- **Probe Cases**: All 5 probe cases pass with strict rejection of all invalid mock inputs (wrong wi-99 row, changed filter, scroll 0, empty drawer, isComposing: false, arbitrary M0,0 L1,1 curve, and altered 5-row measurements).

---

#### 3. Preserved Invariants & Boundaries

- **Client Tree**: `d30e0197f6d0619b8b71fdd5c8fabc5803bf6c1b` (strictly frozen byte-for-byte, zero mutation).
- **Server/Data Tree**: `1a2a84457d02d33707f9845da10f9b97995e1377` (strictly frozen byte-for-byte, zero mutation).
- **Reused Assets & PDF**: 630 CSS pairs, 162,633-byte PDF SHA-256 `47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a` strictly preserved.
- **Honest Boundaries**: Disposable app verification complete; manual screen-reader, OS contrast themes, physical mobile, and physical thermal printer remain pending physical hardware testing.
