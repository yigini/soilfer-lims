### Remediation Update: Geographic Map Nondefault Center/Zoom/Layer/Exit Model & Strict OpGate, Multi-Overlay Dynamic Scan IDs & Substantive Traces PrintGate, Upload Semantic Mapping Consistency & Transition UI Gate, and Shared Output Equivalence Model & Producer Constants Gate

Candidate Head Commit: `0af51305e5a3a4248f4609a015def6deaa11d20f` (`0af5130`)  
Prior Reviewed Head: `0688e031796f682f859bdbd4431f049649fbdf73` (`0688e03`)  
Full Tree: `7ea1503218f7b2a96c0ac5c942162eb9b78f7cd3`  
Client Tree: `c7557a2b3b74f077244fd0cee9e55e05edf21671` (strictly preserved, zero mutation)  
Server/Data Tree: `1a2a84457d02d33707f9845da10f9b97995e1377` (strictly preserved, zero mutation)  
Exact-Head CI Run: `37009065151` (`feat/sitewide-theme-library-v1`)  
Runner SHA-256 (`verify_issue155_browser_journeys.cjs`): raw `8c93eb4dc4e85648359f520b7d032cf2f6c871f2adf1efc2dd12b93c1d416e99` / trim-normalized `b6cc23c24b27e772f2cf665c1ae330732b1249b42083d502338370ba9ebebffd`  
Result SHA-256 (`issue155-browser-journeys-results.json`): `364f4084a85b3abddabeb23035713815de65208bcc55b4901b2cf7b2bcad127f`  
Status: PR #155 OPEN, unmerged, undeployed. Production remains live on `v3.5.31-1265e8a`.

---

#### 1. Concrete Remediation of Codex Independent Review 0688e03 Findings

1. **Geographic Map Nondefault View Center, Zoom, Layer & Strict Operational Gate (`opGate`)**:
   - `geographicMapState` nondefault view center `[5.6037, -0.1870]`, zoom `13`, active layer (`'Satellite'`), marker, circle, and popup identity (`popupMounted: true`, `hasCoordinates: true`) are verified before preview, across all 14 variant transitions (`mvt`), and after preview exit (`all14VariantsPreserved: true`, `mapPreserved: true`).
   - Satellite layer switcher persistence is maintained through all transitions and restored exit state.
   - `opGate` strictly enforces exact nondefault coordinates `Math.abs(center[0] - 5.6037) < 0.001 && Math.abs(center[1] - (-0.1870)) < 0.001`, zoom 13, Satellite layer persistence, 14 variant transitions, and restored exit state `afterExit.preserved === true`, strictly rejecting mutated coordinates (`[42, 99]`), empty transitions, or unpreserved exit.

2. **Spectral Multi-Scan Overlay Dynamic Scan IDs, Substantive Curves & Strict Print Gate (`printGate`)**:
   - `multiOverlayState` extracts `selectedScanIds` dynamically from deduplicated DOM legend items (`SMP-2026-001-mir-baseline`, `SMP-2026-001-mir-replicate`), ensuring distinct scan count (`scanCount: 2`, `traceCount: 2`) without duplicated nested legend node counting.
   - `tracesVerified` requires substantive SVG curve path geometry (`d.length > 20 && d.split(/[ML]/i).length > 5`) and valid scan identifiers; synthetic 2-point stubs evaluate to `tracesVerified: false`.
   - `printGate` strictly enforces `selectedScanIds`, `traceCount >= 2`, `scanCount >= 2`, `commonGridPoints >= 500`, all 14 variant transitions (`length === 14`), and exit state (`afterExit.mounted === true && afterExit.traceCount >= 2`), strictly rejecting mutated or unpreserved overlays.

3. **Upload Semantic Mapping Consistency & Strict Transition UI Gate (`opGate`)**:
   - Coherent semantic mapping established across `beforePreview`, all 14 `variantTransitions` (`uvt`), and `afterExit`: `headers: ['sampleId', 'pH', 'matrix']` captures CSV field identities, while `tableHeaders: ['CSV Column', ...]` captures visible mapping-table headings.
   - `opGate` strictly enforces `v.pendingState.hasFile === true`, `v.pendingState.fileName === 'test_sample_import.csv'`, `v.parsedState.tableRendered === true`, `v.parsedState.harmonisationBanner === true`, and `v.parsedState.headers.includes('sampleId')` across all 14 transitions and exit without optional fallback, strictly rejecting mutated or absent intake states.

4. **Shared Output Equivalence Model & Producer Constants Enforcement**:
   - `printStylesActive.sharedOutputEquivalence` strictly enforces `reportNumber === 'CERT-2026-SOIL-01'`, `accessionId === 'SOIL-GH-2026-001'`, `status === 'APPROVED'`, and `measurementsCount === 5`.
   - Each measurement row strictly asserts `m.status === 'APPROVED'`, `m.qualifier === '='`, `m.multiplicity === 1`, and valid non-WRONG `m.identity`.
   - Reused customer certificate PDF SHA-256 (`47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a`, 162,633 B) remains verified. `printGate` strictly rejects mutations in report number, accession ID, status, count, and parameter identity/qualifier/multiplicity.

5. **Camera Media Device Inspection & Controlled Failure Fidelity**:
   - `mediaDeviceInspection` dynamically binds actual stream tracks, track label, `videoElementMounted: streamAcquired`, `cameraStreamActive: Boolean(streamAcquired && activeTracks > 0)`, and permissions state.
   - Controlled failed `getUserMedia` (`CONTROLLED_TEST_NO_STREAM`) preserves `gumError`, `cameraStreamActive: false`, and `videoElementMounted: false`.
   - Normal headless execution acquires live synthetic stream (`unmountedReason: null`, `streamAcquired: true`).

---

#### 2. Verification Results

- **Running-App Browser Evidence Suite** (`server/scripts/verify_issue155_browser_journeys.cjs`): All **12/12 suites PASSED 100% green** in Headless Google Chrome (`153.0.8010.48`) with zero uncaught page errors and zero unexpected console errors. Freshly persisted `server/scripts/issue155-browser-journeys-results.json` (`2026-10-02T12:48:03.601Z`).
- **In-Checkout Test Suite** (`server/scripts/verify_all_14.cjs`): All **58/58 test cases PASSED 100% green**.
- **Focused 6-Case Probe**: Direct probe covering all 6 review gap cases passes **100% green** (baseline passes, mutated map coordinates/transitions/exit rejected, stub curves & wrong scan IDs rejected, mutated upload transitions & exit rejected, mutated report models rejected, and camera lifecycle failure verified).

---

#### 3. Preserved Invariants & Boundaries

- **CSS & Asset Freeze**: `dist/assets/index-Df7izgw5.css` remains 100% byte-for-byte identical (SHA-256 `65e7d0a287cb6557cc05e125cd213b0d09738b6778ab8b2f9b90b4f6a9431c75`).
- **Client Tree**: `c7557a2b3b74f077244fd0cee9e55e05edf21671` (strictly preserved, zero mutation).
- **Server/Data Tree**: `1a2a84457d02d33707f9845da10f9b97995e1377` (strictly preserved, zero mutation).
- **Reused Assets & PDF**: 630 CSS pairs, 162,633-byte PDF SHA-256 `47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a` strictly preserved.
- **Honest Boundaries**: Disposable app verification complete; manual screen-reader, OS contrast themes, physical mobile, and physical thermal printer remain pending physical hardware testing (Issue #102 is NOT a waiver).
