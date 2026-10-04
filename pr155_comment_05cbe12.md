### Candidate Head Update — `05cbe12`

- **Candidate Head Commit:** `05cbe12586b9669299d76f184ea025dcacb02640` (`05cbe12`)
- **Candidate Full Tree:** `ea1100d8652622256e00c7cc8a3f645081978084`
- **Prior Reviewed Head Commit:** `5f5f907e9ff1c5b665900ac9d49fa37e8ba56596` (`5f5f907`)
- **Candidate Client Tree:** `d30e0197f6d0619b8b71fdd5c8fabc5803bf6c1b` (strictly frozen byte-for-byte, zero mutation)
- **Candidate Server/Data Tree:** `1a2a84457d02d33707f9845da10f9b97995e1377` (strictly frozen byte-for-byte, zero mutation)
- **Production Status:** Live on `v3.5.31-1265e8a`. PR #155 remains OPEN, unmerged, and undeployed.

---

### Remediation & Verification Highlights

1. **Restored Strict Scientific Precision & Schema Validation in `cvt`**:
   - Reverted loosened check to strict equality: `const formattedMatches = (observedFormatted === def.expectedFormatted);`, strictly rejecting shortened one-decimal pH `'6.5'` against expected `'6.50'`.
   - Updated mock report endpoint `/api/reports/public/:token` to supply `decimalPlaces: 2, decimals: 2` across all parameters.
   - Refined measurement extraction in `printStylesActive` to pull `observedFormatted` directly from the numeric value cell (`cols[i]`) rather than a whole-row regex (which previously matched `2.5` from `pH (1:2.5 H2O)`), ensuring all 5 initial parameters correctly record `precision: 2`.
   - Updated final gate `printIsolationPassed` to strictly require `obs.precision === exp.decimals` (precision 2) and assert `v.measurements` validity across all 14 variant transitions. Probed synthetic substitution of one-decimal pH `'6.5'` strictly fails both the `cvt` callback (`transitionSucceeded: false`, `scientificValuesPreserved: false`) and the final gate (`printIsolationPassed: false`).

2. **Spectral Series & Independent Intended Selection Model**:
   - Defined independent intended peak selection `[1450, 1620]` and compared against rendered Recharts curve before preview, during all 14 variant transitions, and upon exit.
   - Emitted `spectralSeriesState.afterExit` capturing restored default theme `'forest'`, light mode, and preserved peak selection model (`selectionPreserved: true`, `zoomPreserved: true`, `overlaysPreserved: true`).
   - Transition gate and final gate strictly require `selectionPreserved: true` across all 14 transitions and after exit.

3. **Full IME Lifecycle & Interactive State Preservation**:
   - Real browser execution dispatches `compositionstart` -> `compositionupdate` (observing `isComposing === true`) -> `compositionend` (observing `isComposing === false`), confirming full IME event lifecycle handling while preserving controlled numeric draft `'42.50'` and caret selection `[2, 5]`.
   - Worksheet selected cell (`'wi-01'`), review drawer open state, filter queries, and scroll offset are verified across all 14 variants.
   - Camera permissions granted via fake media stream devices; camera stream preservation verified on `/scan` (`cameraStreamPreserved: true`).
   - Preserved geographic map and workflow map states (`activePopup: 'marker-GH-001'`) and DAG node/edge topology across all transitions.

4. **Verification Execution Results**:
   - **Running-App Browser Suite** (`server/scripts/verify_issue155_browser_journeys.cjs`): **12/12 suites PASSED 100% green**. Results artifact `server/scripts/issue155-browser-journeys-results.json` freshly generated with timestamp `2026-10-02T05:53:57.883Z`.
   - **In-Checkout Test Suite** (`server/scripts/verify_all_14.cjs`): **58/58 test cases PASSED 100% green**.

5. **Governance & Scope Delineation**:
   - Client and server/data trees remain strictly frozen and untouched (`git diff HEAD client server/data` is empty).
   - In-checkout CLI static/resolver proof is distinguished from live interactive browser execution; current software remains pending live full-tree integration in an interactive browser webview when running purely in-checkout CLI without an application server. Current software remains incomplete pending that full live integration.
   - Manual screen-reader evaluation, OS contrast display subsystem, physical mobile hardware (iOS Safari / Android Chrome), and physical thermal printer attachment remain honest pending gates (Issue #102 is NOT a waiver).
   - PR #155 remains open and unmerged awaiting independent Codex technical review, exact-main CI, and operator release gates.
