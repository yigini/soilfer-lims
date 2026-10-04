### Remediation Update: Dynamic Map Initializer Fallback Eradication & React Fiber Parent Tree Traversal, Multi-Overlay Scientific Model Comparison (r² ≥ 0.90, Linear Calibration Regression, Distinct Series Representation, Axis Verification), Upload Application Specimen State Binding, Target Parameter Enforced Mapping, Pre-Parse 14-Variant Theme Cycle

Candidate Head Commit: `9d119cffbc2963105b8c94b5107e83b5204d9375` (`9d119cf`)  
Prior Reviewed Head: `7da6ae0b672631fa291f13ed8e186612f889ede4` (`7da6ae0`)  
Full Tree: `eb015cbb0ec166c75766e175f4e87a28c8e5dab7`  
Client Tree: `c7557a2b3b74f077244fd0cee9e55e05edf21671` (strictly preserved, zero mutation)  
Server Tree: `84f4f7d45f340801bf8a892955f171fc24982a52`  
Server/Data Tree: `1a2a84457d02d33707f9845da10f9b97995e1377` (strictly preserved, zero mutation)  
Runner SHA-256 (`verify_issue155_browser_journeys.cjs`): `7d2ef94d54ca109ff39785014a3b085d920568ae77d8f060fcb5dc1bdbb33bb7`  
Result SHA-256 (`issue155-browser-journeys-results.json`): `79f424ccba14b10117c8687dee66edde1efd82cb27e474f8da1174a7ad94f82c`  
Status: PR #155 OPEN, unmerged, undeployed. Production remains live on `v3.5.31-1265e8a`.

---

#### 1. Concrete Remediation of Codex Independent Review 7da6ae0 Findings

1. **Dynamic Map Initializer Fallback Eradication & React Fiber Parent Tree Traversal**:
   - Completely eradicated synthetic `[5.6037, -0.1870]` coordinates and `zoom: 13` literal fallbacks from the map initializer. On synthetic containers or DOM elements without an active Leaflet map or React Fiber model, `_leaflet_center` and `_leaflet_zoom` evaluate strictly to `null`, ensuring `opGate` fails closed (`center: null`, `zoom: null`, `transitionSucceeded: false`).
   - In live application execution, the initializer, transition callback (`mvt`), and `afterExit` traverse the React Fiber parent hierarchy (`curr.return`) from the `.leaflet-container` element up to `<MapContainer>` and `<SampleMap>`, dynamically inspecting the Leaflet map instance and props (`center: [5.6037, -0.1870]`, `zoom: 13`) directly from the component model.
   - `opGate` strictly enforces exact nondefault coordinates `Math.abs(center[0] - 5.6037) < 0.001 && Math.abs(center[1] - (-0.1870)) < 0.001`, zoom `13`, Satellite active layer persistence, popup coordinates, and sample title across all 14 variant transitions and exit state.

2. **Spectral Multi-Scan Overlay Scientific Model Comparison**:
   - Replaced previous heuristic difference filters with direct comparison against the continuous 500-point uniform grid scientific interpolation models of laboratory fixture `Scan 1` baseline (`SMP-2026-001-mir-baseline`) and `Scan 2` replicate (`SMP-2026-001-mir-replicate`) across 400 to 4000 cm⁻¹.
   - Curves are matched via direct data alignment or linear calibration regression ($y = A \cdot \text{absorbance} + B$, requiring screen-coordinate slope $A < 0$, coefficient of determination $r^2 \ge 0.90$, and maximum calibrated error $< 0.08$), strictly rejecting arbitrary smooth 500-point sine waves ($r^2 \approx 0.0007$, error $> 14$).
   - `distinctSeriesVerified` verifies that both Scan 1 and Scan 2 are represented across the rendered curves, `axesVerified` validates the presence of chart axes and tick labels, and `commonGridPoints === 500` is strictly enforced.
   - `printGate` strictly enforces `curveModelVerified === true`, `distinctSeriesVerified === true`, `axesVerified === true`, `tracesVerified === true`, and `commonGridPoints >= 500` across all transitions and on exit.

3. **Upload Semantic Mapping & Specimen Data Distinction**:
   - Eradicated runner file-parsing derivation (`parsedMatches ? [{ ... }]`) for specimen rows; `sampleRows` binds directly to application component state / table specimen data.
   - Mapping rows dynamically capture column name, target parameter, methodology ID, unit code, and status. `opGate` strictly enforces `mappingRows.length >= 2`, requires presence of both `pH` and `matrix` target parameters, and strictly rejects unrelated mapping rows (`column === 'unrelated'` or `targetParameter === 'wrong'`).
   - Executed and enforced a separate 14-variant pre-parse theme cycle (`preparseTransitions`) on the pending file before clicking parse (`preparseAll14Preserved === true`), proving theme preservation across the initial ingestion state.

4. **Shared Output Parameter Identity & afterExit Model Gate**:
   - Enforced strict positive equality: `m.identity === exp.parameter`, `m.qualifier === '='`, `m.multiplicity === 1`, and `m.status === 'APPROVED'` across all 14 transitions and after preview exit.
   - Collected `printStylesActive.afterExit` on `/report/CERT-2026-SOIL-01` after preview exit, verifying all 5 measurement rows with exact associated methods, precision, and approved status (`afterExit.preserved === true`).
   - Reused customer certificate PDF SHA-256 (`47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a`, 162,633 B) remains verified. `printGate` strictly rejects mutations in report number, accession ID, status, count, and parameter identity/qualifier/multiplicity.

---

#### 2. Verification Results

- **Running-App Browser Evidence Suite** (`server/scripts/verify_issue155_browser_journeys.cjs`): All **12/12 suites PASSED 100% green** in Headless Google Chrome (`153.0.8010.48`) with zero uncaught page errors and zero unexpected console errors. Freshly persisted `server/scripts/issue155-browser-journeys-results.json` (SHA-256: `79f424ccba14b10117c8687dee66edde1efd82cb27e474f8da1174a7ad94f82c`).
- **In-Checkout Test Suite** (`server/scripts/verify_all_14.cjs`): All **58/58 test cases PASSED 100% green**.
- **Remediation Verification Probe**: Comprehensive test `scratch/verify_review_remediations.cjs` confirms all 7da6ae0 review gaps are resolved:
  - Dynamic Leaflet map view validated; synthetic non-map containers evaluate `_leaflet_center` to `null` and `opGate` strictly rejects.
  - Multi-overlay scientific model comparison rejects arbitrary smooth 500-point sine waves ($r^2 \approx 0.0007$, error $> 14$) while accepting authentic Recharts curves.
  - Upload specimen data bound to application state; mutating column mapping to unrelated / wrong target parameter strictly rejected.
  - Pre-parse 14-variant theme cycle strictly validated and required by `opGate`.
  - Report parameter identity/qualifier/multiplicity/status positive equality enforced; afterExit model verified.

---

#### 3. Preserved Invariants & Boundaries

- **CSS & Asset Freeze**: `dist/assets/index-Df7izgw5.css` remains 100% byte-for-byte identical (SHA-256 `65e7d0a287cb6557cc05e125cd213b0d09738b6778ab8b2f9b90b4f6a9431c75`).
- **Client Tree**: `c7557a2b3b74f077244fd0cee9e55e05edf21671` (strictly preserved, zero mutation).
- **Server/Data Tree**: `1a2a84457d02d33707f9845da10f9b97995e1377` (strictly preserved, zero mutation).
- **Server Tree**: `84f4f7d45f340801bf8a892955f171fc24982a52`.
- **Reused Assets & PDF**: 630 CSS pairs, 162,633-byte PDF SHA-256 `47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a` strictly preserved.
- **Honest Boundaries**: Disposable app verification complete; manual screen-reader, OS contrast themes, physical mobile, and physical thermal printer remain pending physical hardware testing (Issue #102 is NOT a waiver).
