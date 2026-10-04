### Contributor Remediation & Review Readiness — PR #155 (`ceecc85`)

This update delivers candidate **`ceecc8547ed22e1690b63cd8d75633d7a4d43043`** (`ceecc85`), completing remediation of Codex independent review findings for candidate `64e448b` (`issue155-independent-review-64e448b.md` / `issue155-focused-review-64e448b.cjs`).

---

### 1. Concrete Remediations

#### A. Horizontal & Vertical Joint 2D Axis-to-Curve Calibration (Finding 1 / Case 3)
- Upgraded `checkAxisCalibrated(pts, expected)` across initial `multiOverlayState`, all 14 variant transitions (`ovt`), and `multiOverlayState.afterExit` in `server/scripts/verify_issue155_browser_journeys.cjs`:
  - Derives both $(M_x, K_x)$ and $(M_y, K_y)$ scale parameters directly from actual tick anchors (`xTickGeom`, `yTickGeom`) in the shared SVG coordinate system.
  - Evaluates every curve against the source 500-point uniform wavelength grid ($W_k = 400 + k \cdot \frac{3600}{499}$):
    $$\text{expX}_k = M_x \cdot W_k + K_x, \quad \text{expY}_k = M_y \cdot \text{expected}[k] + K_y$$
  - Verifies curve points simultaneously against $(\text{expX}, \text{expY})$ in both forward index order ($k$) and reverse index order ($499 - k$), strictly requiring both coordinates to bind to the exact same physical wavenumber within $\le 2.5$ px:
    - Forward check: $\max_k \max(|pts[k].x - \text{expX}_k|, |pts[k].y - \text{expY}_k|) \le 2.5$ px.
    - Reverse check: $\max_k \max(|pts[k].x - \text{expX}_{499-k}|, |pts[k].y - \text{expY}_{499-k}|) \le 2.5$ px.
  - Strictly rejects shifted/compressed paths (like Case 3's $X = 399 - 0.5 \cdot i$) and reversed direction paths with unreversed intensity ($X = i$ with $Y(i)$) across `initial.tracesVerified: false`, `transition.modelVerified: false`, `exit.modelVerified: false`, and `printIsolationPassed: false`.
  - Clarified in `EVIDENCE.md` that layout-less mock axis fallback (`!xTickGeom.hasCoords || !yTickGeom.hasCoords`) is adapter fallback behavior for headless/mock DOM environments without layout geometry, distinct from runtime-axis N/A.

#### B. Strict Camera DOM Node Identity Gate (Finding 2 / Case 4)
- Eliminated loose optional ternaries `(typeof ... === 'boolean' ? ... === true : true)` in `opGate` across `scanState`, `beforePreview`, `duringPreview`, `afterExit`, and all 14 `variantTransitions`.
- Strictly enforces `v.videoNodeIdentity.isSameNode === true` so missing node identity, non-boolean values, or string `'false'` fail closed.
- Preserved full track ID verification, track kind continuity (`'video'`), live ready states, and stream continuity.

#### C. Whole-Stage Reconciliation & Boundary Discipline (Finding 3)
- Maintained distinct boundaries: constructed node-listened composition events remain synthetic, distinct from OS/system IME candidate windows (manual pending).
- High-DPI DPR 2.0, 200% and 400% zoom reflow remain distinct from native desktop optical zoom and physical hardware.
- Preserved frozen closures: customer certificate PDF `test_certificate_output.pdf` (162,633 B, SHA256 `47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a`), 5-row measurements, frozen CSS `index-Df7izgw5.css` (213,700 B raw / 35,045 B gzip, SHA256 `65e7d0a287cb6557cc05e125cd213b0d09738b6778ab8b2f9b90b4f6a9431c75`), client tree `6e83b8d431a820d700ac6ac7a4398e5f3a1bb216`, server data tree `1a2a84457d02d33707f9845da10f9b97995e1377` strictly frozen byte-for-byte.
- Synchronized `COMMUNICATION-LOG.md`, `EVIDENCE.md`, and PR #155 description to candidate `ceecc85`.

---

### 2. Candidate Invariants & Provenance
- **Candidate Commit**: `ceecc8547ed22e1690b63cd8d75633d7a4d43043` (`ceecc85`)
- **Full Tree**: `47601c4b4ddafbff2a9df6698b5151883850cad8`
- **Client Tree**: `6e83b8d431a820d700ac6ac7a4398e5f3a1bb216` (100% frozen byte-for-byte)
- **Server Data Tree**: `1a2a84457d02d33707f9845da10f9b97995e1377` (100% frozen byte-for-byte)
- **Customer PDF**: 162,633 B, SHA256 `47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a` (100% frozen)
- **Frozen CSS**: `index-Df7izgw5.css` (213,700 B raw / 35,045 B gzip, SHA256 `65e7d0a287cb6557cc05e125cd213b0d09738b6778ab8b2f9b90b4f6a9431c75`)

---

### 3. Suite Verification Results
- **Automated Browser Evidence Suite**: `server/scripts/verify_issue155_browser_journeys.cjs` (**12/12 SUITES PASS 100% GREEN**, Headless Chrome `153.0.8010.48`, timestamp `2026-10-03T05:03:20Z`).
- **In-checkout Suite**: `server/scripts/verify_all_14.cjs` (**58/58 CASES PASS 100% GREEN**).
- **Theme Catalog & Tokens Drift**: `npm run check:theme-catalog` (**PASS with 0 drift**).

---

### 4. Release Governance
- PR #155 remains **OPEN and unmerged**.
- Production deployment strictly held awaiting independent Codex technical acceptance, protected merge, exact-main green CI, and safe operator deployment gates.
- Themes are **NOT LIVE**.
