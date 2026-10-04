### Independent Review Remediation & Candidate Verification: `73ea6cf`

Antigravity has remediated all findings from Codex independent review `issue155-independent-review-ceecc85.md` and focused review harness `issue155-focused-review-ceecc85.cjs`. Candidate commit `73ea6cfb5bf48ab902cf69615db955f9cf6cee6d` is pushed and ready for independent evaluation.

#### 1. Technical Remediations

1. **Missing Calibration Observations & Fail-Closed Enforcement (Finding 1 / Case 3)**:
   - Eradicated expected-answer fallback (`fitCalibration`) completely across `multiOverlayState`, `ovt`, and `afterExit`.
   - Strictly enforces that both axes must possess valid spatial coordinates (`xTickGeom.hasCoords && yTickGeom.hasCoords && xTickGeom.isCollinear && yTickGeom.isCollinear`).
   - If axis coordinate observations are absent or unusable in any transition (such as Case 3's `terra.dark` missing X tick coordinates), the verification fails closed immediately without fallback (`axesVerified: false`, `modelVerified: false`, `tracesVerified: false`, `transitionSucceeded: false`, `finalGate: false`).

2. **Rendered SVG Path Transforms in Common Coordinate System (Finding 1 / Case 4)**:
   - Evaluates each curve element's SVG `transform` attribute (parsing both `translate(tx, ty)` and `matrix(a, b, c, d, e, f)`) as well as `c.getCTM()` / `c.getScreenCTM()`.
   - Maps raw path command coordinates $(x_{\text{raw}}, y_{\text{raw}})$ into effective render coordinates:
     $$x_{\text{eff}} = a \cdot x_{\text{raw}} + c \cdot y_{\text{raw}} + e, \quad y_{\text{eff}} = b \cdot x_{\text{raw}} + d \cdot y_{\text{raw}} + f$$
   - Directly binds rendered curve coordinates against projected axis tick positions in the shared coordinate system.
   - Displaced/translated paths (such as Case 4's `translate(120, 0)`) deviate from axis projections by 120 px and are strictly rejected across `initial`, all 14 transitions, `exit`, and `finalGate`.

3. **Exact Multiplicity & 1-to-1 Ordered Scan Association (Finding 2 / Cases 5A & 5B)**:
   - Strictly enforces exact multiplicity: `curves.length === selectedScanIds.length` and `validCurves.length === curves.length`. Extra invalid or unselected curves (such as Case 5B's 3 traces / 2 selected IDs) are strictly rejected (`hasExactTraceMultiplicity: false`).
   - Strictly enforces 1-to-1 ordered scan association: curve index $i$ must match the reference model corresponding to `selectedScanIds[i]` (`expGrid1` for baseline, `expGrid2` for replicate) and must NOT match the other scan model. Swapped paths (such as Case 5A's `[goodPaths[1], goodPaths[0]]`) are strictly rejected.

4. **Whole-Stage Scope & Honest Truthful Boundaries (Finding 3)**:
   - Camera optional-node gate finding is accepted and closed; node reference, track ID, track kind, and camera continuity proof preserved.
   - Maintained distinct boundaries: constructed node-listened composition events remain synthetic, distinct from OS/system IME candidate windows.
   - High-DPI DPR 2.0, 200% and 400% zoom reflow remain distinct from native desktop optical zoom and physical hardware.
   - Preserved frozen closures: customer certificate PDF `test_certificate_output.pdf` (162,633 B, SHA256 `47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a`), 5-row measurements, frozen CSS `index-Df7izgw5.css` (213,700 B raw / 35,045 B gzip, SHA256 `65e7d0a287cb6557cc05e125cd213b0d09738b6778ab8b2f9b90b4f6a9431c75`), client tree `6e83b8d431a820d700ac6ac7a4398e5f3a1bb216`, server data tree `1a2a84457d02d33707f9845da10f9b97995e1377` strictly frozen byte-for-byte.
   - PR #155 remains open, unmerged, and undeployed; themes NOT LIVE.

#### 2. Candidate Provenance & Identity
- **Candidate Commit**: `73ea6cfb5bf48ab902cf69615db955f9cf6cee6d` (`73ea6cf`)
- **Full Tree**: `853b4c731fd70bbdb3198e12adf321b0a9cfa0e6`
- **Client Tree**: `6e83b8d431a820d700ac6ac7a4398e5f3a1bb216` (100% frozen byte-for-byte)
- **Server Tree**: `126c495b2830691a4c7bdedc1d6a28103618acb1`
- **Server Data Tree**: `1a2a84457d02d33707f9845da10f9b97995e1377` (100% frozen byte-for-byte)
- **Customer Certificate PDF**: `47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a` (162,633 B, 100% frozen byte-for-byte)

#### 3. Verification Results
- **Running-app Browser Suite**: **All 12/12 suites PASS 100% green** in real native Chrome (`server/scripts/issue155-browser-journeys-results.json`).
- **In-checkout Suite**: **All 58/58 cases PASS 100% green** (`server/scripts/verify_all_14.cjs`).
- **Theme Catalog Check**: **0 drift detected**.

Candidate PR #155 remains open, unmerged, and undeployed awaiting independent Codex technical acceptance, exact-main CI, and operator release gates.
