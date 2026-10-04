### Technical Remediation & Verification Report — Candidate `64e448b`

- **Date & UTC Timestamp**: `2026-10-03T04:45:00Z`
- **Candidate Commit**: [`64e448bd7a3a35bc5dab89937b9fc31456a378cc`](https://github.com/yigini/soilfer-lims/commit/64e448bd7a3a35bc5dab89937b9fc31456a378cc) (`64e448b`)
- **Candidate Full Tree**: `5a252825abf6abd03b6b2cb46835aae4c1b979be`
- **Candidate Client Tree**: `6e83b8d431a820d700ac6ac7a4398e5f3a1bb216` (100% frozen byte-for-byte)
- **Candidate Server Tree**: `f073bc37cd3ca0a3eda6ebba6ec8d6283f9bab7c`
- **Candidate Server/Data Tree**: `1a2a84457d02d33707f9845da10f9b97995e1377` (100% frozen byte-for-byte)
- **Base Commit**: `1265e8aa9f71f5f60b61c6fdaf31bc36ba8b2c54` (`1265e8a`, `v3.5.31-1265e8a`)
- **Accepted Main Tree**: `260975e57d0b3a1389f622c2f84ef444f3f46cf4`
- **Runner Trim SHA256**: `9eb33e3e56d5234ba9035db7edc61f0ebc172f811f9c54a6ecb6aa0abf78b93c`
- **Result Trim SHA256**: `d2a5442c23641845877b8089cf36fd336a9e73e3619cecdcde411d84983928f3`
- **Status**: Candidate PR #155 remains **OPEN and unmerged**. Themes are **NOT LIVE**. Production remains `v3.5.31-1265e8a`.

---

### 1. Concrete Remediations Addressing Codex Review `65e16a8`

#### A. Scientific Axis-to-Curve Calibration & Collinearity (Finding 1 / Case 3)
- **Defect in 65e16a8**: Prior logic enforced tick monotonicity but permitted non-linear tick positions ($X \in [499, 450, 200, 0]$, $Y \in [320, 250, 200, 100]$) to pass while evaluating curves against independent affine fits unanchored to axis layout coordinates. Furthermore, deduplication by tick value kept the first element (`<g>` text glyph bounding box) rather than the actual SVG tick anchor attribute (`<text y="248.0">`), shifting regression intercept.
- **Remediation Delivered**:
  1. Enforced SVG tick collinearity ($|\text{residual}| \le 2.0$ px via linear regression) across `multiOverlayState`, `ovt`, and `multiOverlayState.afterExit` in `server/scripts/verify_issue155_browser_journeys.cjs`. Monotonic but non-linear ticks strictly fail closed (`isCollinear: false`).
  2. Prioritized SVG tick anchor attributes (`getAttribute('y')`, `getAttribute('transform')`) over text glyph bounding boxes during deduplication by tagging `isAnchor: true` and preferring anchors during map collision resolution.
  3. Derived $(M_y, K_y)$ scale parameters directly from actual SVG tick anchors in the common SVG coordinate system, projected expected reference curve points ($Y_{\text{proj}} = M_y \cdot Y + K_y$), and verified curve points match the axis projection within $\le 2.5$ px, strictly enforcing axis-to-curve binding.
  4. Preserved source-supported N/A equivalence (`hasCoords: false`) for mock DOM layout-less text adapters (`axisDoc`).
- **Verification**: In `scratch/test_harness_cases.cjs`, Case 3 monotonic non-linear positions strictly fail closed (`axesVerified: false`, `modelVerified: false`, `tracesVerified: false`), while calibrated matching ticks pass and mismatched ticks fail closed.

#### B. Observed Camera Track Kinds, Track IDs & Video Node Identity (Finding 2 / Case 4)
- **Defect in 65e16a8**: `opGate` did not assert that track kinds were strictly `'video'`, did not check track IDs against initial state across all transitions, allowed non-numeric or missing video readyState, and metadata alone did not verify stable DOM node identity.
- **Remediation Delivered**:
  1. Hardened `opGate` in `server/scripts/verify_issue155_browser_journeys.cjs`:
     - Strictly requires `typeof t.id === 'string' && t.id.length > 0` and non-empty stream ID across initial and all 14 transitions.
     - Enforces track kind continuity: `t.kind === 'video'` (strictly rejects video-to-audio mutations).
     - Requires track count and track IDs to strictly match initial state across all 14 transitions and exit.
     - Enforces numeric `typeof v.videoNodeIdentity.readyState === 'number' && v.videoNodeIdentity.readyState >= 2`.
     - Retains initial `<video>` DOM node reference in collector (`window.__initialVideoNode`) and verifies stable node identity (`isSameNode === true`).
- **Verification**: In `scratch/test_harness_cases.cjs`, Case 4 mutations (`changedTrackKind: 'audio'`, `missingTrackIds`, `missingNumericReadiness`) strictly fail closed (`opGate === false`).

#### C. Whole-Stage Scope & Truthful Boundaries (Finding 3)
- Maintained distinct boundaries: constructed node-listened composition events remain synthetic, distinct from OS/system IME candidate windows.
- High-DPI DPR 2.0, 200% and 400% zoom reflow remain distinct from native desktop optical zoom and physical hardware.
- Preserved accepted closures: customer certificate PDF `test_certificate_output.pdf` (162,633 B, SHA256 `47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a`), 5-row measurements, frozen CSS `index-Df7izgw5.css` (213,700 B raw / 35,045 B gzip, SHA256 `65e7d0a287cb6557cc05e125cd213b0d09738b6778ab8b2f9b90b4f6a9431c75`), client tree `6e83b8d431a820d700ac6ac7a4398e5f3a1bb216`, and server data tree `1a2a84457d02d33707f9845da10f9b97995e1377` strictly frozen byte-for-byte.

---

### 2. Verification Suite Results Summary

| Suite / Verification Artifact | Scope | Result | Details |
| :--- | :--- | :--- | :--- |
| `server/scripts/verify_issue155_browser_journeys.cjs` | Real Headless Chrome CDP Journeys (12 suites) | **12/12 PASS (100%)** | 630 route/variant pairings verified, 0 console errors, 0 contrast failures. Results: `issue155-browser-journeys-results.json` (Trim SHA256: `d2a5442c...`). |
| `scratch/test_harness_cases.cjs` | Codex Focused Review Harness (4 cases) | **4/4 PASS (100%)** | Case 1 positive gates pass; Case 2 scrambled axes/streams reject; Case 3 non-linear ticks fail closed; Case 4 camera mutations fail closed; axis-derived curve calibration strictly verified. |
| `server/scripts/verify_all_14.cjs` | In-checkout Verification Harness (58 tests) | **58/58 PASS (100%)** | Test 56 asserts `buildInputCommit: '625eb9babcb2ba7748cffa74623966be5b27449d'`, budget overhead `19342`. |
| `server/tests/contracts/` | Jest Contract Suite (139 suites, 1365 tests) | **139/139 PASS (100%)** | All contract suites pass in 189s. |
| `npm run check:theme-catalog` | Canonical Catalog Drift Guard | **PASS (0 drift)** | 14 isomorphic variants match canonical palette with 0 drift. |
| `measure_theme_bundle_delta.js` | Production Asset Footprint | **PASS** | Plan footprint `5,333 B gzip` (limit `15.0 kB`). Complete app overhead `19,342 B gzip`. |

---

### 3. Preserved Invariant Checksums
- **Client Tree**: `6e83b8d431a820d700ac6ac7a4398e5f3a1bb216` (100% frozen byte-for-byte)
- **Server Data Tree**: `1a2a84457d02d33707f9845da10f9b97995e1377` (100% frozen byte-for-byte)
- **Customer PDF**: `server/scripts/test_certificate_output.pdf` (162,633 B, SHA256 `47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a`)
- **Frozen CSS**: `client/dist/assets/index-Df7izgw5.css` (213,700 B raw / 35,045 B gzip, SHA256 `65e7d0a287cb6557cc05e125cd213b0d09738b6778ab8b2f9b90b4f6a9431c75`)
- **PR State**: PR #155 remains OPEN and unmerged; themes NOT LIVE.
