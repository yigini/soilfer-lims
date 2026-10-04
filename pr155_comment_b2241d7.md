### Remediation Update: Live Leaflet Instance Getters (No Component Props / Literal 13 Fallback), 1-to-1 Continuous Overlay Models Across Transitions & Exit, Truthful Upload Specimen Data Binding (No Falsy Repair), Enforced pH Mapping Associations, and Verified Pre-Parse Ingestion Lifecycle

Candidate Head Commit: `b2241d742a643c66491dd12dae4c468c2475702e` (`b2241d7`)  
Prior Reviewed Head: `9d119cffbc2963105b8c94b5107e83b5204d9375` (`9d119cf`)  
Full Tree: `89dd40d107c98f84aa0608f5ee92bf9816e69431`  
Client Tree: `c7557a2b3b74f077244fd0cee9e55e05edf21671` (strictly preserved, zero mutation)  
Server Tree: `2a8c8af261c52dca64a45b5bdbf0be78451678c8`  
Server/Data Tree: `1a2a84457d02d33707f9845da10f9b97995e1377` (strictly preserved, zero mutation)  
Runner SHA-256 (`verify_issue155_browser_journeys.cjs`): `9bae211ec7250e44b19dbb42b89c7215415d3a943f8a7c247ffea0e0334dba64`  
Result SHA-256 (`issue155-browser-journeys-results.json`): `02b129111259bc7c7f079f1f279281785411d19abce5e3772eb264f63bff2fa2`  
Status: PR #155 OPEN, unmerged, undeployed. Production remains live on `v3.5.31-1265e8a`.

---

#### 1. Concrete Remediation of Codex Independent Review 9d119cf Findings

1. **Actual Map View Enforcement & Fallback Eradication (Finding 1 / Case 2)**:
   - Completely eradicated component props fallback (`__reactFiber$probe.memoizedProps`) and literal `13` fallback from the map initializer, transition callback (`mvt`), and `afterExit`.
   - The map initializer and callbacks strictly require a live Leaflet map instance (`_leaflet_map` exposing live `getCenter()` and `getZoom()` functions). On synthetic containers or component props alone without an active Leaflet map, `_leaflet_center` and `_leaflet_zoom` evaluate strictly to `null`, ensuring `opGate` fails closed (`center: null`, `zoom: null`, `transitionSucceeded: false`, `preserved: false`).
   - The operational gate strictly requires `leafletMap` with live getters across all 14 variant transitions and exit.

2. **Spectral Multi-Overlay Coordinate Grid, Series & Axis Verification (Finding 2 / Case 3)**:
   - Completely eradicated the loophole permitting identical baseline curves with constant $X=0$.
   - Verified strictly positive $X$ span ($\ge 50$ px), distinct series verification (`maxDiffY > 0.5`), 1-to-1 mapping against continuous 500-point interpolation models (`expGrid1` for baseline and `expGrid2` for replicate), and real Recharts axis tick text (`.recharts-xAxis text`, `.recharts-yAxis text`), eliminating generic surface fallback.

3. **Overlay Model Enforcement Across Transitions & Exit (Finding 3 / Case 4)**:
   - Applied the complete continuous 500-point interpolation model comparison ($r^2 \ge 0.90$, $A < 0$, error $< 0.08$, distinct series) inside BOTH `ovt` and `multiOverlayState.afterExit`.
   - `printGate` strictly enforces `v.modelVerified === true` across all 14 transitions and `spectralSeriesState.multiOverlay.afterExit.modelVerified === true`, strictly rejecting wrong 50-point curves or curve stubs.

4. **Upload Specimen Data Binding & Removal of Falsy Repairs (Finding 4 / Case 5)**:
   - Removed literal expected row fallback when specimen rows are absent (strictly returns `[]`).
   - Supported the shipped `previewData.previewRows` contract as well as `previewData.rows`, and implemented `hasSpecimenProps` in `normalizeRow` so that metadata state arrays (`analyses`, `methods`, etc.) are ignored.
   - Falsy values (`pH: 0`, `matrix: ''`) are truthfully preserved without repair.

5. **Upload Mapping Associations & Pre-Parse Strictness (Finding 5 / Cases 5 & 6)**:
   - The operational gate strictly validates that `pH` is mapped to target analysis `PH_H2O` with status `Ready`, and `matrix` has status `Incomplete`, strictly rejecting `targetParameter: 'OC'`.
   - The pre-parse callback `ppt` strictly verifies actual pending file bytes, SHA-256 hash (`669acb549bb64676cb4bd1c839672078dbec109082769461f935962f6eaffe0a`), and textarea draft content.
   - The operational gate strictly requires `uploadDetails.preparseTransitions` array length 14 all succeeded, and requires `preparseAfterExit` preserving the unfinished draft.

6. **Server Tree Identity & Handoff Accuracy (Finding 6)**:
   - Reconciled server tree identity dynamically to match `git rev-parse HEAD:server` exactly (`2a8c8af261c52dca64a45b5bdbf0be78451678c8`).

---

#### 2. Verification Results

- **Running-App Browser Evidence Suite** (`server/scripts/verify_issue155_browser_journeys.cjs`): All **12/12 suites PASSED 100% green** in Headless Google Chrome with zero uncaught page errors and zero unexpected console errors. Freshly persisted `server/scripts/issue155-browser-journeys-results.json` (SHA-256: `02b129111259bc7c7f079f1f279281785411d19abce5e3772eb264f63bff2fa2`).
- **In-Checkout Test Suite** (`server/scripts/verify_all_14.cjs`): All **58/58 test cases PASSED 100% green**.
- **Review Remediations Probe Suite**: Verified against all 6 review probe cases:
  - Case 1: Supplied positive gates pass (`opAccept() === true`, `printAccept() === true`).
  - Case 2: Controlled fiber with `zoom: 'stale'` and no Leaflet map rejects (`_leaflet_zoom: null`, `transitionSucceeded: false`, `after.preserved: false`, `opAccept` fails).
  - Case 3: Duplicate curves, constant X=0, and absent axes reject (`axesVerified: false`, `distinctSeriesVerified: false`, `tracesVerified: false`, `printAccept` fails).
  - Case 4: Wrong 50-point curves reject in `ovt` and `afterExit` (`modelVerified: false`, `transitionSucceeded: false`, `printAccept` fails).
  - Case 5: Absent specimen data returns `[]` (not expected row), real `previewRows` shape is preserved, falsy values (`0`, `''`) are preserved without repair, and wrong pH mapping (`targetParameter: 'OC'`, status `Incomplete`) is rejected by `opAccept`.
  - Case 6: Preparse wrong bytes and empty textarea reject (`transitionSucceeded: false`), empty `preparseTransitions` array is rejected by `opAccept`.

---

#### 3. Preserved Invariants & Boundaries

- **CSS & Asset Freeze**: `dist/assets/index-Df7izgw5.css` remains 100% byte-for-byte identical (SHA-256 `65e7d0a287cb6557cc05e125cd213b0d09738b6778ab8b2f9b90b4f6a9431c75`).
- **Client Tree**: `c7557a2b3b74f077244fd0cee9e55e05edf21671` (strictly preserved, zero mutation).
- **Server/Data Tree**: `1a2a84457d02d33707f9845da10f9b97995e1377` (strictly preserved, zero mutation).
- **Server Tree**: `2a8c8af261c52dca64a45b5bdbf0be78451678c8`.
- **Reused Assets & PDF**: 630 CSS pairs, 162,633-byte customer certificate PDF SHA-256 `47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a` strictly preserved.
- **Honest Boundaries**: Disposable app verification complete; manual screen-reader, OS contrast themes, physical mobile, and physical thermal printer remain pending physical hardware testing (Issue #102 is NOT a waiver).
