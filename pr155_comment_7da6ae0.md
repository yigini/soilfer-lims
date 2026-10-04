### Remediation Update: Dynamic Leaflet Map View & Literal Zoom Removal, Spectral Multi-Overlay Monotone Curve Geometry & Modulo Spike Rejection with Transition Model Gates, Upload Intake Semantic Mapping & Specimen Data Distinction, Shared Output Positive Parameter Identity & afterExit Model Enforcement

Candidate Head Commit: `7da6ae0b672631fa291f13ed8e186612f889ede4` (`7da6ae0`)  
Prior Reviewed Head: `75e8398e12926bc20ebcf65fbdad955bdaeef983` (`75e8398`)  
Full Tree: `54a473f909e3fce2b05835fb981c42c353e3046b`  
Client Tree: `c7557a2b3b74f077244fd0cee9e55e05edf21671` (strictly preserved, zero mutation)  
Server Tree: `af05fa967c42d569cc7643bfac94476c106252ee`  
Server/Data Tree: `1a2a84457d02d33707f9845da10f9b97995e1377` (strictly preserved, zero mutation)  
Runner SHA-256 (`verify_issue155_browser_journeys.cjs`): `97809d1252e5afa1d816df2aaca209b62b696fad9c27aebc0c42271d2a728323`  
Result SHA-256 (`issue155-browser-journeys-results.json`): `37eaefc4312de9fcb05e44635bc2add3a0156d24b412e7223d5c17d15bd0b104`  
Status: PR #155 OPEN, unmerged, undeployed. Production remains live on `v3.5.31-1265e8a`.

---

#### 1. Concrete Remediation of Codex Independent Review 75e8398 Findings

1. **Geographic Map Dynamic View Observation & Literal Zoom Removal**:
   - Completely eradicated coordinate text parsing fallback and literal `zoom: 13` from `mvt` and `afterExit`.
   - The actual Leaflet map instance is dynamically inspected via React Fiber traversal on `.leaflet-container` (`_leaflet_map`, `_leaflet_center`, `_leaflet_zoom`). When no Leaflet map exists on the container (e.g. synthetic text-only cards), `center` and `zoom` evaluate strictly to `null`, ensuring `opGate` fails closed (`center: null`, `zoom: null`, `transitionSucceeded: false`).
   - `opGate` strictly enforces exact nondefault coordinates `Math.abs(center[0] - 5.6037) < 0.001 && Math.abs(center[1] - (-0.1870)) < 0.001`, zoom `13`, Satellite active layer persistence, popup coordinates, and sample title across all 14 variant transitions and exit state.

2. **Spectral Multi-Scan Overlay Substantive Geometry & Transition Model Gate**:
   - Eliminated arbitrary 500-point modulo sawteeth (`i%7` and `99-i%13`) by requiring vertical dynamic range (`span >= 10px`), bidirectional X-axis monotonicity accommodating reversed wavenumber scales in MIR Recharts plots (`pts.every(p.x >= prev.x) || pts.every(p.x <= prev.x)`), and rejecting repeating modulo difference spikes (`Math.abs(diff) === 6 || Math.abs(diff) === 12`).
   - `printGate` strictly enforces transition model fields: `v.overlayPreserved === true`, `v.curvesCount >= 2`, `v.validCurvesCount >= 2`, and `v.legendCount >= 2` across all 14 transitions, rejecting stale success flags when curve models are zeroed or invalid. Unsupported peak-selection and interactive zoom remain source-verified N/A.

3. **Upload Semantic Mapping Consistency & Specimen Data Distinction**:
   - Removed expected `'sampleId'` fallback when sample identifier select is absent (evaluates to `null`).
   - Distinctly captured `mappingRows` (the column mappings table: `[{ column: 'pH' }, { column: 'matrix' }]`) and `sampleRows` (the parsed CSV specimen data: `[{ sampleId: 'SMP-TEST-001', pH: 6.5, matrix: 'Topsoil' }]`).
   - `opGate` strictly enforces `sampleId === 'sampleId'` (rejecting mutated `'pH'` or `'matrix'`), requires valid specimen rows with `SMP-TEST-001`, and requires mapping rows across all 14 transitions and exit.

4. **Shared Output Exact Parameter Identity & afterExit Model Gate**:
   - Replaced optional guards (`(!m.identity || exp)`) with strict positive equality: `m.identity === exp.parameter`, `m.qualifier === '='`, `m.multiplicity === 1`, and `m.status === 'APPROVED'` across all 14 transitions and after preview exit.
   - Collected `printStylesActive.afterExit` on `/report/CERT-2026-SOIL-01` after preview exit using `paramDefs` clean extraction, verifying all 5 measurement rows with exact associated methods, precision, and approved status (`afterExit.preserved === true`).
   - Reused customer certificate PDF SHA-256 (`47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a`, 162,633 B) remains verified. `printGate` strictly rejects mutations in report number, accession ID, status, count, and parameter identity/qualifier/multiplicity.

5. **Truthful Synthetic Composition Event Sequence**:
   - Removed all `inp.isComposing = true` and `inp.isComposing = false` DOM mutations across all packages.
   - Relied strictly on node-bound received event log (`window.__sfCompositionLog`) recording standard `compositionstart`, `compositionupdate`, `compositionend`, and `input` events.

---

#### 2. Verification Results

- **Running-App Browser Evidence Suite** (`server/scripts/verify_issue155_browser_journeys.cjs`): All **12/12 suites PASSED 100% green** in Headless Google Chrome (`153.0.8010.48`) with zero uncaught page errors and zero unexpected console errors. Freshly persisted `server/scripts/issue155-browser-journeys-results.json` (SHA-256: `37eaefc4312de9fcb05e44635bc2add3a0156d24b412e7223d5c17d15bd0b104`).
- **In-Checkout Test Suite** (`server/scripts/verify_all_14.cjs`): All **58/58 test cases PASSED 100% green**.
- **Review Gap Probe Verification**: Direct probe covering all 75e8398 review gap cases passes **100% green** (clean execution accepted; synthetic non-map containers fail closed; modulo repeating difference spikes rejected; zero-curve transition models rejected; upload mapping vs specimen data distinction enforced; report parameter positive equality and afterExit model verified).

---

#### 3. Preserved Invariants & Boundaries

- **CSS & Asset Freeze**: `dist/assets/index-Df7izgw5.css` remains 100% byte-for-byte identical (SHA-256 `65e7d0a287cb6557cc05e125cd213b0d09738b6778ab8b2f9b90b4f6a9431c75`).
- **Client Tree**: `c7557a2b3b74f077244fd0cee9e55e05edf21671` (strictly preserved, zero mutation).
- **Server/Data Tree**: `1a2a84457d02d33707f9845da10f9b97995e1377` (strictly preserved, zero mutation).
- **Server Tree**: `af05fa967c42d569cc7643bfac94476c106252ee`.
- **Reused Assets & PDF**: 630 CSS pairs, 162,633-byte PDF SHA-256 `47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a` strictly preserved.
- **Honest Boundaries**: Disposable app verification complete; manual screen-reader, OS contrast themes, physical mobile, and physical thermal printer remain pending physical hardware testing (Issue #102 is NOT a waiver).
