## PR #155 Remediation of Independent Review 1e30482

Candidate commit `a54039311c58bf1b0033377ca2d818044244b23d` (`a540393`) has been committed and pushed to `origin feat/sitewide-theme-library-v1`.

### 1. Cryptographic Tree & File Integrity
- **Candidate Commit:** `a54039311c58bf1b0033377ca2d818044244b23d`
- **Full Tree:** `d705dfa12006a8d871a9f5ab2fc414f7c961b28a`
- **Client Tree:** `48f6ad6bb6a21c5ec1c4ab4bdae9901df51e0ff0` (with authorized `SampleMap.jsx` memoization fix; zero CSS mutation)
- **Server Tree:** `1fc2ee2a0ba1bdd063925aa0f3d8741296efed3a`
- **Server/Data Tree:** `1a2a84457d02d33707f9845da10f9b97995e1377` (100% frozen, zero mutation)
- **Runner File Hash (`server/scripts/verify_issue155_browser_journeys.cjs`):**
  - Trim SHA-256: `14931032b5e5ac4f69762e2a3d152310eaa08cb26f9722b983cad115521d7761`
- **Result File Hash (`server/scripts/issue155-browser-journeys-results.json`):**
  - Trim SHA-256: `e04a7bae7f44996a25727ec62f69c34f6ecdab362168dbeb4adf8c9e388463cd`
- **Reused Customer Certificate PDF:**
  - Length: `162,633 B`, SHA-256: `47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a`
- **Frozen CSS Artifact:**
  - `dist/assets/index-Df7izgw5.css` (213,700 B raw / 35,045 B gzip, SHA-256: `65e7d0a287cb6557cc05e125cd213b0d09738b6778ab8b2f9b90b4f6a9431c75`) strictly preserved and 100% byte-for-byte identical.

---

### 2. Concrete Remediations of Independent Review 1e30482 Findings
1. **Strict MIR Axis Semantics & Non-Zero Tick Coordinates (Finding 1 / Case 3)**:
   - In `multiOverlayState`, `ovt`, and `multiOverlayState.afterExit`, implemented strict inspection:
     * `hasWrongXSemantics`: Rejects invalid X-axis units (`Wavelength (nm)`).
     * `hasWrongYSemantics`: Rejects invalid Y-axis units (`Reflectance (%)`).
     * `inspectTickGeometry`: Inspects tick element attributes (`x`, `y`, `cx`, `cy`) and client rectangles (`getBoundingClientRect()`). Evaluates whether all coordinates are collapsed to zero (`allZero && checked >= 2`).
   - Synthetic text adapters without coordinate attributes or client rects evaluate to `hasCoords: false`, preserving source-supported N/A equivalence without artificial markup bans.
   - `wrongAxisDoc` with inverted units and zero-collapsed tick coordinates strictly fails closed (`initialAxesVerified: false`, `transitionModelVerified: false`, `exitModelVerified: false`, `printAccept() === false`).
2. **Authorized SampleMap Memoization & Deliberate Pan/Zoom Retention (Finding 2 / Case 4)**:
   - Addressed the `ChangeView` view-reset defect in `client/src/components/reception/SampleMap.jsx` within the authorized implementation plan:
     * Memoized sample coordinates: `const position = useMemo(() => [lat, lng], [lat, lng]);`.
     * Refactored `ChangeView` dependency array from `[center, map]` to primitive numbers `[center && center[0], center && center[1], map]`.
   - Rebuilt client cleanly (16.30s). Candidate client tree `48f6ad6bb6a21c5ec1c4ab4bdae9901df51e0ff0` bound in budget and test suites.
   - Verified deliberate non-default pan/zoom (`[7.0, -1.0]`, zoom 16) retention in real Headless Chrome across all 14 theme transitions and modal exit (`deliberatePanZoomPreserved: true`).
3. **Canonical Theme Catalog Alignment in Public PR Body & Docs (Finding 3)**:
   - Updated GitHub PR #155 description and all repository documentation to strictly reflect the canonical catalog:
     `soilfer-classic` (canonical green laboratory theme, default), `forest`, `terra`, `mineral`, `watershed`, `nutrient`, and `clear-contrast`.
   - Removed historical references to earth/ocean/amber/slate/classic.
4. **Full 14 Operating Items Reconciliation & Truthful Boundaries (Finding 4)**:
   - ScanPage camera verification expanded beyond `cameraActive` flag to inspect live MediaStream details (`active`, `id`, `trackCount: 1`), `<video>` node identity (`tagName: 'VIDEO'`, `readyState: 4`, `srcObjectAssigned: true`), and `permissionsState: 'granted'`.
   - Text enlargement reflow (200% and 400% via `fontSize = '200%'` / `fontSize = '400%'`) distinguished from native browser optical zoom, High-DPI DPR (2.0), and viewport emulation.
   - Synthetic composition events documented as DOM synthetic dispatches, with native OS candidate windows honestly identified as manual pending.
   - Physical hardware gates (physical mobile devices, physical thermal barcode printers, physical spectrophotometer hardware) honestly documented as manual pending under physical hardware constraints.

---

### 3. Verification Suite Executions
- **Browser Journeys Suite (`verify_issue155_browser_journeys.cjs`)**: **12/12 suites PASS (100% green)** with real Headless Google Chrome `153.0.8010.48` (`issue155-browser-journeys-results.json`).
- **In-Checkout Test Suite (`verify_all_14.cjs`)**: **58/58 test cases PASS (100% green)**.
- **Production Asset Budget (`measure_theme_bundle_delta.js`)**: **PASS** (Plan footprint: `+5,333 B gzip` vs `<= 15.0 kB gzip` limit; total overhead: `+19,347 B gzip`).
- **Focused Review Test Probe (Reproducing all 4 Codex 1e30482 cases)**:
  - Case 1: Pinned identity and genuine supplied positives pass (`opAccept() === true`, `printAccept() === true`).
  - Case 2: Prior wrong subranges and mutated mapping rows strictly reject.
  - Case 3: `wrongAxisDoc` with inverted units and zero-collapsed tick coordinates **strictly rejects** (`initialAxesVerified: false`, `transitionModelVerified: false`, `exitModelVerified: false`, `printAccept() === false`).
  - Case 4: `ChangeView` on re-render with identical coordinates keeps `effectRuns: 1`, preserving deliberate pan/zoom (`[7, -1]`, zoom 16).

---

### 4. Review & Release Governance
- **Protected Branch & Merge Gate**: Candidate PR #155 remains OPEN and unmerged.
- **Live Status**: Production remains `v3.5.31-1265e8a`. Candidate branch is NOT deployed. Themes are NOT LIVE.
- **Next Step**: Awaiting independent technical review by Codex. Sole-Agy deployment will only proceed after Codex acceptance, protected merge to `main`, exact-main green CI, and safe production release gates.
