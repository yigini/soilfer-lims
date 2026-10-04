### PR #155 Remediation Update: Review `a540393` Findings Remediated — Candidate `1ee3b25`

- **Candidate Commit:** `1ee3b2560eaaf51433204dc0adbcb246fb08e069` (`1ee3b25`)
- **Full Tree:** `227580c1d5055961898f84a6352b363597d85e97`
- **Client Tree:** `6e83b8d431a820d700ac6ac7a4398e5f3a1bb216`
- **Server Tree:** `fb17c4826091ec1b3808b426cdcb1f63273e9a5b`
- **Server/Data Tree:** `1a2a84457d02d33707f9845da10f9b97995e1377` (100% frozen byte-for-byte)
- **Status:** PR #155 remains **OPEN and unmerged**. Themes are **NOT LIVE** pending independent Codex review, exact-main CI, and operator release gates.

#### Remediations of Review `a540393` Findings (6 Cases):

1. **SampleMap Conditional Hook Defect Resolved (Finding 6 / Case 6)**:
   - Defect: In `SampleMap.jsx`, `useMemo` was placed after early return (`if (!hasCoords)`). When mounted in `Reception.jsx:1856-1872` without an explicit key, toggling coordinates between absent and present caused hook count mismatches.
   - Fix: Removed redundant `useMemo` from `client/src/components/reception/SampleMap.jsx`; position defined as plain array `const position = [lat, lng];`. Scalar dependencies in `ChangeView` (`[center && center[0], center && center[1], map]`) prevent unnecessary re-render triggers or view resets on unchanged coordinates.
   - Verification: ESLint `react-hooks/rules-of-hooks` passes with 0 errors. Rebuilt client cleanly; frozen CSS `dist/assets/index-Df7izgw5.css` (213,700 B raw / 35,045 B gzip, SHA256 `65e7d0a287cb6557cc05e125cd213b0d09738b6778ab8b2f9b90b4f6a9431c75`) is 100% byte-for-byte preserved.

2. **Deliberate Map Pan/Zoom Model Bound in Operational Gate (Finding 1 / Case 4)**:
   - Defect: `opGate` permitted transient default resets or missing deliberate action flags if `afterExit` retained non-default coordinates.
   - Fix: `opGate` in `verify_issue155_browser_journeys.cjs` strictly enforces the deliberate pan/zoom model (`[7.0, -1.0]`, zoom 16) across initial `geographicMapState`, all 14 variant transitions, and `afterExit` (`deliberatePanZoomExecuted === true`, `deliberatePanZoomPreserved === true`). Transient default resets or missing action flags strictly fail closed.

3. **Axis Calibration & Stacked Tick Geometry Rejection (Finding 2 / Case 3)**:
   - Defect: Stacked ticks with identical non-zero coordinates (`{x: 7, y: 7, w: 10, h: 10}`) bypassed the `allZero` check despite having zero spatial span, proving no value-to-position calibration.
   - Fix: `inspectTickGeometry` in `multiOverlayState`, `ovt`, and `afterExit` checks `isStacked: coords.length >= 2 && Math.max(...coords) === Math.min(...coords)`. If ticks are stacked, `axesVerified: false` and `modelVerified: false`, failing closed. Synthetic mock DOM adapters lacking spatial layout attributes evaluate to `hasCoords: false`, cleanly preserving source-supported N/A equivalence.

4. **Camera Continuity Bound Across Transitions and Exit (Finding 3 / Case 5)**:
   - Defect: Camera stream, tracks, video node identity, and permissions were only captured initially.
   - Fix: Collected `streamDetails` (active, id, tracks), `videoNodeIdentity` (nodeName, className, readyState, srcObjectAssigned), and `permissionsState` across initial `scanState`, `scanBefore`, `scanDuring`, all 14 `scanVariantTransitions`, and `scanAfter`. Bound into `opGate` so omitting or dropping them strictly fails closed.

5. **Accurate UTC Timestamp & Catalog Alignment (Finding 5)**:
   - Corrected handoff timestamps to true UTC (`2026-10-02T23:55:00Z`).
   - Reconciled whole-stage claims across PR body, docs, evidence, and matrix with verified execution scope.

#### Verification Evidence:
- **Browser Journey Evidence Suite:** **12/12 suites PASS 100% green** (`server/scripts/verify_issue155_browser_journeys.cjs`).
  - Fresh results artifact: `server/scripts/issue155-browser-journeys-results.json` (trim SHA-256: `98a7398c310f90a03f043523ce5760984d827fd7c32aedc27131e527bb1f072e`).
- **In-Checkout Test Suite:** **58/58 test cases PASS 100% green** (`server/scripts/verify_all_14.cjs`).
- **Production Asset Budget:** Plan footprint `+5,333 B gzip` (5.21 kB gzip <= 15.0 kB limit; margin `+9.79 kB` under budget). Full app overhead `+19,342 B gzip` (18.89 kB gzip).
- **Reused Customer Certificate PDF:** `server/scripts/test_certificate_output.pdf` (162,633 B, SHA256 `47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a`).
