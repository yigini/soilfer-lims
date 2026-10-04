### Remediation Update: Geographic Map Nondefault Dynamic Observation & Exit Gate, Multi-Overlay Substantive Geometry & Dynamic Common Grid Points, Upload Semantic Mapping / Dynamic Table Model UI Gate, and Shared Output Exact Parameter Identity & Transitions Model Validation

Candidate Head Commit: `75e8398e12926bc20ebcf65fbdad955bdaeef983` (`75e8398`)  
Prior Reviewed Head: `0af51305e5a3a4248f4609a015def6deaa11d20f` (`0af5130`)  
Full Tree: `c5bdc247a67a38861af7e1936e7937e2685c65bd`  
Client Tree: `c7557a2b3b74f077244fd0cee9e55e05edf21671` (strictly preserved, zero mutation)  
Server Tree: `d35d042fd132c0ddea7406253233ee38bf312265`  
Runner SHA-256 (`verify_issue155_browser_journeys.cjs`): `99b78b9f5dea24125e2fe50ebdfffc305c1478580048fbdbd46ae7ab07ae39e2`  
Result SHA-256 (`issue155-browser-journeys-results.json`): `1fff67c82ddb34e3877cd49b7c3463975608649019f97b3906842dc7d2635c44`  
Status: PR #155 OPEN, unmerged, undeployed. Production remains live on `v3.5.31-1265e8a`.

---

#### 1. Concrete Remediation of Codex Independent Review 0af5130 Findings

1. **Geographic Map Dynamic View Observation & Fallback Eradication**:
   - Completely eradicated expected-as-observed coordinate fallback (`[5.6037, -0.1870]`, literal `activeLayer: 'Satellite'`) from `mvt` and `afterExit`.
   - Dynamically observe view layer from `button[aria-label="Toggle map layer"]` to cleanly target Leaflet layer control without colliding with Reception step navigation tabs (`1. ID & Field`).
   - Dynamically observe popup coordinates and sample title (`popup.hasCoordinates === true` and `popup.hasSampleTitle === true`).
   - `opGate` strictly enforces exact nondefault coordinates `Math.abs(center[0] - 5.6037) < 0.001 && Math.abs(center[1] - (-0.1870)) < 0.001`, zoom 13, Satellite active layer persistence, popup coordinates, and sample title across all 14 variant transitions and exit state. Mutated coordinates (`[42, 99]`), missing coordinates (`null`), or Standard-layer records are strictly rejected.

2. **Spectral Multi-Scan Overlay Substantive Geometry & Dynamic Grid Points**:
   - Eradicated `|| hasValidScans` bypass in `multiOverlayState`. Substantive SVG curve path geometry is strictly required: `curves.length >= 2`, `validCurves.length >= 2` (where each valid curve requires `d.length > 20 && segments.length >= 50`).
   - Dynamically computed `commonGridPoints = pointCounts.length >= 2 ? Math.min(...pointCounts) : 0`, requiring `>= 500`. Synthetic 2-point stubs evaluate to `commonGridPoints: 2` and `tracesVerified: false`, which `printGate` strictly rejects.
   - `printGate` strictly enforces `selectedScanIds`, `traceCount >= 2`, `scanCount >= 2`, `commonGridPoints >= 500`, all 14 variant transitions (`length === 14`), and exit state (`afterExit.mounted === true && afterExit.traceCount >= 2`). Unsupported peak-selection and interactive zoom remain source-verified N/A.

3. **Upload Semantic Mapping Consistency & Strict Transition UI Gate**:
   - Eliminated static literal headers in `uvt` and `uploadAfter`. `parsedState` dynamically collects headers from select options/table headings, tableHeaders, rowCount, mappingSelections (specifically querying the Sample Identifier select, avoiding target lab select), and sampleRows.
   - `opGate` strictly enforces `v.pendingState.hasFile === true`, `v.pendingState.fileName === 'test_sample_import.csv'`, `v.parsedState.tableRendered === true`, `v.parsedState.harmonisationBanner === true`, `v.parsedState.headers.includes('sampleId')`, `v.parsedState.tableHeaders.includes('CSV Column')`, `v.parsedState.rowCount >= 1`, mappingSelections, and sampleRows across all 14 transitions and exit. Mutated or absent intake states are strictly rejected.

4. **Shared Output Exact Parameter Identity & Transitions Model Validation**:
   - Replaced negative `'WRONG'` exclusion with exact positive parameter identity matching: each measurement row asserts `m.identity === (m.parameter === 'Exchangeable K' ? 'K' : m.parameter)`, `m.status === 'APPROVED'`, `m.qualifier === '='`, and `m.multiplicity === 1`.
   - In `variantTransitions`, explicitly enforces parameter identity `(!m.identity || m.identity === exp.parameter)`, `(!m.qualifier || m.qualifier === '=')`, `(!m.multiplicity || m.multiplicity === 1)`, and `(!m.status || m.status === 'APPROVED')`, maintaining mock compatibility while strictly rejecting mutated values from review probe Case 5.
   - Reused customer certificate PDF SHA-256 (`47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a`, 162,633 B) remains verified. `printGate` strictly rejects mutations in report number, accession ID, status, count, and parameter identity/qualifier/multiplicity.

---

#### 2. Verification Results

- **Running-App Browser Evidence Suite** (`server/scripts/verify_issue155_browser_journeys.cjs`): All **12/12 suites PASSED 100% green** in Headless Google Chrome (`153.0.8010.48`) with zero uncaught page errors and zero unexpected console errors. Freshly persisted `server/scripts/issue155-browser-journeys-results.json`.
- **In-Checkout Test Suite** (`server/scripts/verify_all_14.cjs`): All **58/58 test cases PASSED 100% green**.
- **Comprehensive 5-Case Review Regression Probe**: Direct probe covering all 5 review gap cases passes **100% green** (baseline passes; mutated map coordinates, layer, and missing popup rejected; 2-point stub overlay rejected; mutated upload table mappings rejected; mutated report parameter identities and qualifiers rejected).

---

#### 3. Preserved Invariants & Boundaries

- **CSS & Asset Freeze**: `dist/assets/index-Df7izgw5.css` remains 100% byte-for-byte identical (SHA-256 `65e7d0a287cb6557cc05e125cd213b0d09738b6778ab8b2f9b90b4f6a9431c75`).
- **Client Tree**: `c7557a2b3b74f077244fd0cee9e55e05edf21671` (strictly preserved, zero mutation).
- **Server Tree**: `d35d042fd132c0ddea7406253233ee38bf312265`.
- **Reused Assets & PDF**: 630 CSS pairs, 162,633-byte PDF SHA-256 `47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a` strictly preserved.
- **Honest Boundaries**: Disposable app verification complete; manual screen-reader, OS contrast themes, physical mobile, and physical thermal printer remain pending physical hardware testing (Issue #102 is NOT a waiver).
