### Independent Review Remediation & Candidate Verification: `986a04b`

Antigravity has remediated all findings from Codex independent review `issue155-independent-review-73ea6cf.md` and focused review harness `issue155-focused-review-73ea6cf.cjs`. Candidate commit `986a04bc3e82b0c8a09e776f6b047e4277078f63` is pushed to `feat/sitewide-theme-library-v1` and ready for independent technical review.

#### 1. Technical Remediations

1. **Full Matrix Composition in Common Coordinate System (Finding 1 / Case 3)**:
   - In `multiOverlayState`, `ovt`, and `afterExit` of `server/scripts/verify_issue155_browser_journeys.cjs`:
     * Directly inspects `c.getCTM()` and `c.getScreenCTM()`, extracting all 6 components `{ a, b, c, d, e, f }` unconditionally whenever available (removing the previous condition `mat.e === 0 && mat.f === 0 && (ctm.e !== 0 || ctm.f !== 0)`).
     * Reconciled runner implementation with documentation claims: supports both `getCTM` and `getScreenCTM`, plus parent attribute hierarchy traversal if DOM methods are absent.
     * Composes complete transformation matrices for ticks AND curves into one common coordinate system.
     * Pure scale matrix (`{ a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 }`) and parent-composed matrix (`{ a: 1, b: 0, c: 0, d: 1, e: 130, f: 0 }` with local `translate(10, 0)`) now strictly fail closed across initial, transitions, exit, and final gate.
     * Attached `pts.transform = mat;` to valid curve points.

2. **Actual Named Scan Identity Without Invented IDs (Finding 2 / Case 4)**:
   - Eradicated all manufactured expected IDs across `ovt` and `afterExit`.
   - Extracts observed scan IDs directly from rendered legend labels: `legendItems.map(item => { const m = item.match(/SMP-[\w-]+/); return m ? m[0] : item; })`.
   - Strictly enforces `hasSupportedScanIds`: must contain at least 2 IDs, including `'baseline'` and `'replicate'`.
   - Foreign scan IDs (`SMP-2026-001-mir-foreign-a`, `foreign-b`) strictly fail closed across initial, all 14 transitions, exit, and final print gate.

3. **Save Required Model Observations & Enforce in Final Gate (Finding 3 / Case 5)**:
   - In `multiOverlayState`, `ovt`, and `afterExit`: serialized `calibrationBranch: '2D_AXIS_CALIBRATED'`, `selectedScanIds`, `scales` (`{ x, y }`), and `transforms`.
   - In `printIsolationPassed`: strictly verifies `spectralSeriesState.multiOverlay.calibrationBranch === '2D_AXIS_CALIBRATED'`, `afterExit.calibrationBranch === '2D_AXIS_CALIBRATED'`, `v.calibrationBranch === '2D_AXIS_CALIBRATED'`, and valid `selectedScanIds` on `afterExit` and all 14 transitions. Deleting `calibrationBranch` or `selectedScanIds` strictly fails closed (`printAccept() === false`).
   - Reconciled browser provenance to `Headless Google Chrome 154.0.8037.93 (Windows NT / arm64)`.
   - Updated `opticalZoomScope` in Verification Boundaries to record CDP `Emulation.setPageScaleFactor` (2.0x/4.0x visual viewport zoom) and WCAG 2.1 SC 1.4.10 320 CSS px reflow layout equivalence, distinguishing software evaluations from native desktop optical UI zoom controls.

#### 2. Candidate Provenance & Identity
- **Candidate Commit**: `986a04bc3e82b0c8a09e776f6b047e4277078f63` (`986a04b`)
- **Full Tree**: `e7af3d502d8d908783375c46c30a1df41e27d049`
- **Client Tree**: `6e83b8d431a820d700ac6ac7a4398e5f3a1bb216` (100% frozen byte-for-byte; zero CSS mutation)
- **Server Tree**: `d6a9a64d8085ec211c486ea15d6171564c31d3fc`
- **Server Data Tree**: `1a2a84457d02d33707f9845da10f9b97995e1377` (100% frozen byte-for-byte)
- **Customer Certificate PDF**: `47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a` (162,633 B, 100% frozen byte-for-byte)
- **Frozen CSS**: `client/dist/assets/index-Df7izgw5.css` (213,700 B, SHA256 `65e7d0a287cb6557cc05e125cd213b0d09738b6778ab8b2f9b90b4f6a9431c75`)
- **Runner Trim Hash**: `2f2b4e7d78ee20d14994c9729da3f0f2147e84944ce6c37caa75a5298ed543db`
- **Result Trim Hash**: `90eb5c8d1ff2bbd299bf0d3dab851a08ae71683af80762656802c3555caeac67`

#### 3. Verification Results
- **Running-app Browser Suite**: **All 12/12 suites PASS 100% green** in real native Chrome (`server/scripts/issue155-browser-journeys-results.json`, timestamp: `2026-10-03T06:01:24.737Z`).
- **In-checkout Suite**: **All 58/58 cases PASS 100% green** (`server/scripts/verify_all_14.cjs`).
- **Focused Probe Harness**: **All 6/6 cases PASS 100% green** (`scratch/test_focused_probe.cjs`).

Candidate PR #155 remains open, unmerged, and undeployed awaiting independent Codex technical acceptance, exact-main CI, and operator release gates.
