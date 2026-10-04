### PR #155 Candidate Update & Review Handoff — `dcc3aa2`

Remediated all findings from Codex's independent review `issue155-independent-review-f3f2186.md` and focused review harness `issue155-focused-review-f3f2186.cjs` (7 cases):

#### 1. Identity & Exact State
- **Candidate Head Commit**: `dcc3aa20539678ff2e37bbe77fa2b39693517443` (`dcc3aa2`)
- **Candidate Full Tree**: `ab748407028cdeb012ccbb2d91383cfbc9733d9d`
- **Candidate Client Tree**: `6e83b8d431a820d700ac6ac7a4398e5f3a1bb216` (strictly frozen byte-for-byte; zero CSS mutation)
- **Candidate Server Tree**: `41ca1c41de11c88ed2cee4096c8ea6a835dc0c26`
- **Candidate Server/Data Tree**: `1a2a84457d02d33707f9845da10f9b97995e1377` (strictly preserved, zero mutation)
- **Base Commit**: `1265e8aa9f71f5f60b61c6fdaf31bc36ba8b2c54` (`1265e8a`, `v3.5.31-1265e8a`)
- **Accepted Main Tree**: `260975e57d0b3a1389f622c2f84ef444f3f46cf4`
- **Runner File Hash (`server/scripts/verify_issue155_browser_journeys.cjs`)**:
  - Trim SHA-256: `f57cde37d37eccc18324731e5481b5616084b638d60bd4cf0277b8574db8e535`
- **Result File Hash (`server/scripts/issue155-browser-journeys-results.json`)**:
  - Trim SHA-256: `d9ced14416eb9c8e0da741fcac98eaa56499b63662f1023c743e3e4149b974b6`
- **Browser Provenance**: `Headless Google Chrome 154.0.8037.93 (Windows NT / arm64)`
- **Run Timestamp**: `2026-10-03T07:28:08.538Z`
- **Exact CI Run**: `37106826279` (`IN_PROGRESS`)
- **PR Status**: OPEN, unmerged, no linked closing issues (`closingIssuesReferences` empty). Production remains `v3.5.31-1265e8a`. Themes are **NOT LIVE**.

---

#### 2. Concrete Remediation of f3f2186 Review Findings

##### A. Direct Binding of Observed Numeric Tick Anchors in Final Gate (Finding 1 / Case 5)
- In `f3f2186`, `printIsolationPassed` evaluated broad scalar intervals and cross-state consistency without verifying goodness-of-fit against the actual DOM-rendered axis tick coordinates. In Case 5, Codex demonstrated that substituting unobserved scales `{slope: -499/3600, intercept: 4000*499/3600 + 50}` and `{slope: -150, intercept: 300}` across all states passed the gate.
- Remediated:
  1. Serialized actual observed numeric tick anchors directly in `multiOverlayState`, `ovt`, and `multiOverlayState.afterExit` in `server/scripts/verify_issue155_browser_journeys.cjs`:
     `anchors: { x: (xTickGeom.unique || []).map(p => ({ val: p.val, coord: p.coord })), y: (yTickGeom.unique || []).map(p => ({ val: p.val, coord: p.coord })) }`.
     Exposed `unique` from `inspectTickGeometry` in both `ovt` and `afterExit` collectors.
  2. In `printIsolationPassed`, assert that `st.anchors` exists with $\ge 2$ anchors per axis, covers physical domains ($X \in [400, 4000]\ \text{cm}^{-1}$ spanning $\ge 2000\ \text{cm}^{-1}$, $Y \in [0, 3.5]\ \text{AU}$ spanning $\ge 0.50\ \text{AU}$), and that the serialized linear scale fits every observed anchor within $\le 2.5\ \text{px}$:
     `st.anchors.x.every(a => Math.abs(a.coord - (st.scales.x.slope * a.val + st.scales.x.intercept)) <= 2.5)`
     `st.anchors.y.every(a => Math.abs(a.coord - (st.scales.y.slope * a.val + st.scales.y.intercept)) <= 2.5)`.
  3. Substituted unobserved calibrations (Codex Case 5) strictly fail closed (`printGate === false`), while actual observed calibrations pass with residuals $\le 1.3\ \text{px} \le 2.5\ \text{px}$.

##### B. Supporting Responsive Plot Geometry and Continuous Grid Spacing (Finding 2 / Case 6)
- In `f3f2186`, `printIsolationPassed` required normalized grid step $\Delta x^{(0)} = -3600 \cdot M_x^{(0)} / 499$ to be strictly $\approx 1.0$ or $\approx 2.0$, erroneously rejecting valid responsive plot widths (such as width factor 1.5 yielding plot width 748.5 px and normalized step 1.5 in Codex Case 6).
- Remediated:
  1. Removed the rigid `== 1.0 || == 2.0` integer-step check. `SpectraViewer.jsx` uses `ResponsiveContainer width="100%"`, accommodating continuous responsive plot widths.
  2. Enforced continuous physical step constraint $\Delta x^{(0)} = -3600 \cdot M_x^{(0)} / 499 > 0.2$ alongside negative finite slopes ($M_x^{(0)} < 0, M_y^{(0)} < 0$) and anchor-to-scale consistency, validating all responsive plot layouts while strictly rejecting unscaled, collapsed, or inverted coordinates.
  3. Responsive plots with fractional scale factors (Case 6) pass cleanly (`printGate === true`).

##### C. Whole Stage Scope Reconciliation (Finding 3)
- Unambiguously categorized current observed vs static vs reused vs software-pending vs manual-pending scope across `TRACEABLE-MATRIX.md`, `EVIDENCE.md`, and PR handoffs:
  - **Observed in Live Running Application Context**: 12 browser journeys executed in native Headless Chrome 154 with local Express and SQLite, covering all 14 variants selector/adoption/preview/exit roots and named notification banner settlement/removal, deliberate non-default map pan/zoom (`[7.0, -1.0]`, zoom 16), 1-to-1 continuous spectral models with observed numeric tick anchors and linear fits $\le 2.5$ px, upload intake with pending 44 B and full draft equality, ScanPage live camera stream & video element node identity, worksheet scroll offset (scrollTop 48 on 2106px scrollHeight), and report print preview.
  - **Static Component & Adapter Scope**: In-checkout `verify_all_14.cjs` (58/58 passed) validates static SSR compilation/rendering via `ReactDOMServer` and synthetic IME events.
  - **Reused Accepted Artifacts**: Frozen client tree `6e83b8d4...`, data tree `1a2a8445...`, customer certificate PDF (162,633 B, SHA256 `47fdaa79...`), built CSS `index-Df7izgw5.css` (213,700 B, SHA256 `65e7d0a2...`).
  - **Software-Pending Scope**: Synthetic IME composition events vs native OS/system IME candidate windows; desktop browser native optical zoom UI engine controls (Ctrl+/Ctrl-) vs W3C SC 1.4.10 320 CSS px reflow layout equivalence, High-DPI DPR 2.0 at 640 CSS px with root font 200%, and DPR 1.0 at 1280 CSS px with root font 400%.
  - **Manual-Pending Scope (Physical Hardware & Operator)**: Physical screen reader listening (NVDA/JAWS/VoiceOver/TalkBack), OS contrast theme display, physical mobile hardware (iOS/Android), physical thermal label printer.
  - **Live Fact**: PR #155 is OPEN, unmerged, undeployed; production remains `v3.5.31-1265e8a`; themes are NOT LIVE.

---

#### 3. Verification Summary
- **Running-app Browser Suite (`server/scripts/verify_issue155_browser_journeys.cjs`)**: **12/12 SUITES PASS 100% GREEN**.
- **In-checkout Suite (`server/scripts/verify_all_14.cjs`)**: **58/58 TEST CASES PASS 100% GREEN**.
- **Codex 7-case review logic**: Verified all 7 cases pass without failure on candidate `dcc3aa2` (Case 5 rejects unobserved calibration; Case 6 accepts responsive plot width).
- **Plan Budget Footprint**: 5,333 B gzip (<= 15.0 kB limit, margin +9.79 kB under budget). Complete app overhead: 19,342 B gzip.
- **Standby Cadence**: Operating under standing 5-minute active monitor without background polling loops; standing by for Codex independent review.
