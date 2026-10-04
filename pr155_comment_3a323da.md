## PR #155 Remediation of Independent Review 7892196

Candidate commit `3a323da441a3f59c53346635fe25ae5721f8fb8c` (`3a323da4`) has been committed and pushed to `origin feat/sitewide-theme-library-v1`.

### 1. Cryptographic Tree & File Integrity
- **Full Tree:** `a473d594d8a94fa1ee5025e5cfdf74fe93795133`
- **Client Tree:** `c7557a2b3b74f077244fd0cee9e55e05edf21671` (100% frozen, zero mutation)
- **Server Tree:** `f19ecf45e35b557e7db82cb4898d829ca6d72a33` (dynamically queried via `git rev-parse HEAD:server`)
- **Server/Data Tree:** `1a2a84457d02d33707f9845da10f9b97995e1377` (100% frozen, zero mutation)
- **Runner File Hash (`verify_issue155_browser_journeys.cjs`):**
  - Raw SHA-256: `cc562999642eb43f296e9a3bd1c04f0510a40f84d1ed2ce2825a276b87acdd1d`
  - Trim SHA-256: `edbefbcda4d01a649e8038cd875eb72c6cdccb4d3dad06a37956fd4e9d7d3f08`
- **Result File Hash (`issue155-browser-journeys-results.json`):**
  - Raw / Trim SHA-256: `18037317b86acaac77d49428fcba6d91e8fab244d7212d6e03c2673858b313b0`
- **Reused Customer Certificate PDF:**
  - Length: `162,633 B`, SHA-256: `47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a`

---

### 2. Concrete Remediations of Independent Review 7892196 Findings
1. **Spectral Multi-Overlay 1-to-1 Model Matching (Finding 1 / Case 3)**:
   - Replaced loose 0.08 tolerance with strict 1-to-1 model separation:
     `diffA < 0.008 && diffB < 0.008 && crossDiffA > 0.015 && crossDiffB > 0.015`
     across `multiOverlayState`, `ovt`, and `multiOverlayState.afterExit`.
   - A 1-pixel offset copy of the baseline curve ($319 - 100 \cdot \text{baseline}$) yields `crossDiffA = 0.010 <= 0.015` and `diffB = 0.010 >= 0.008`, strictly failing distinct series and curve model verification (`distinctSeriesVerified: false`, `curveModelVerified: false`, `modelVerified: false`).
2. **Strict Numeric-Axis Domain & Range Verification (Finding 2 / Case 4)**:
   - Enforced that all extracted axis tick numbers fall strictly within their valid physical domains across initial, all 14 transitions, and after exit: X-axis ticks require `xTickVals.length >= 2 && xTickVals.every(v => v >= 400 && v <= 4000)` and Y-axis ticks require `yTickVals.length >= 2 && yTickVals.every(v => v >= 0 && v <= 3.5)`.
   - Plausible-tick sets with out-of-range boundaries (such as X ticks `[400, 99999]` or Y ticks `[0, 100]`) are strictly rejected (`axesVerified: false`, `modelVerified: false`).
3. **Upload Full Mapping State Multiplicity Enforcement (Finding 3 / Case 5)**:
   - In `opGate`, strictly enforced complete mapping row multiplicity and column schema:
     `mappingRows.length === 2 && mappingRows.length === rowCount`, `filter(r => r.column === 'pH').length === 1`, and `filter(r => r.column === 'matrix').length === 1`.
   - Duplicated mapping rows (e.g. adding a second `pH` row while `sampleCount` remains 1) are strictly rejected by the operational gate.
4. **Mandatory Complete Draft Observations in Final Gate (Finding 4 / Case 6)**:
   - Replaced optional draft guards with strictly mandatory positive draft verification: `v.draftMatches === true && typeof v.draftText === 'string'` across all 14 preparse transitions and `uploadDetails.preparseAfterExit.draftMatches === true && typeof uploadDetails.preparseAfterExit.draftText === 'string'`.
   - Deleting `draftText` or `draftMatches` from supplied results causes `opGate` to fail closed.
5. **Complete Original Operating Stage Honest Reconciliation (Finding 5)**:
   - Reconciled all evidence across observed, supplied, static, adapter, reused, software-pending, manual-pending, and not-live.
   - Clarified that deliberately non-default map pan/zoom view preservation is software scope (software-pending), not solely physical-mobile pending.

---

### 3. Verification Suite Executions
- **Browser Evidence Suite (`verify_issue155_browser_journeys.cjs`)**: 12/12 suites PASSED (100% green).
- **In-Checkout Test Suite (`verify_all_14.cjs`)**: 58/58 test cases PASSED (100% green).
- **Focused Review Test Probe (Reproducing all 6 Codex cases)**:
  - Case 1: Pinned identity and genuine supplied positives pass (`opAccept() === true`, `printAccept() === true`).
  - Case 2: Prior differently scaled baseline, nonlinear X, and nonnumeric axes strictly reject; shared fixture adapters pass.
  - Case 3: Same baseline with 1-pixel offset ($319 - 100 \cdot \text{baseline}$) **strictly rejects** (`distinctSeriesVerified: false`, `curveModelVerified: false`, `transition.modelVerified: false`, `afterExit.modelVerified: false`).
  - Case 4: Incorrect numeric axis domains containing one plausible tick (`[400, 99999]` and `[0, 100]`) **strictly reject** (`axesVerified: false`, `modelVerified: false`).
  - Case 5: Wrong pH methodology (`different-method`), wrong unit (`%`), and duplicated mapping rows **strictly reject** (`opAccept() === false`).
  - Case 6: Extra specimen insertion in unfinished draft strictly rejects, and missing `draftText` / `draftMatches` observations **strictly reject** (`opAccept() === false`).

---

### 4. Status & Review Handoff
- PR #155 remains OPEN and unmerged. Production remains `v3.5.31-1265e8a`. Themes are NOT LIVE.
- Awaiting independent technical review by Codex. Detailed readiness handoff recorded in `C:/Users/yigin/Documents/Codex/2026-09-21/se/work/sitewide-themes-ready-for-review.md`.
