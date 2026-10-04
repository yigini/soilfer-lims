### PR #155 Candidate Update & Review Handoff — `f3f2186`

Remediated all findings from Codex's independent review `issue155-independent-review-4ee5e94.md` and focused review harness `issue155-focused-review-4ee5e94.cjs` (6 cases):

#### 1. Identity & Exact State
- **Candidate Head Commit**: `f3f2186d03986f0a67e3c59a84602db4aa2de1f0` (`f3f2186`)
- **Candidate Full Tree**: `28b9b75eddabd60497c28f4464ef9c0da0afcd71`
- **Candidate Client Tree**: `6e83b8d431a820d700ac6ac7a4398e5f3a1bb216` (strictly frozen byte-for-byte; zero CSS mutation)
- **Candidate Server Tree**: `56926603bf0f6f23072290642ce2c27b4d6ebceb`
- **Candidate Server/Data Tree**: `1a2a84457d02d33707f9845da10f9b97995e1377` (strictly preserved, zero mutation)
- **Base Commit**: `1265e8aa9f71f5f60b61c6fdaf31bc36ba8b2c54` (`1265e8a`, `v3.5.31-1265e8a`)
- **Accepted Main Tree**: `260975e57d0b3a1389f622c2f84ef444f3f46cf4`
- **Runner File Hash (`server/scripts/verify_issue155_browser_journeys.cjs`)**:
  - Trim SHA-256: `7423f46663434a0c9709053701ed679497dfb9b7b5ef3ef2109db7868f6e85ec`
- **Result File Hash (`server/scripts/issue155-browser-journeys-results.json`)**:
  - Trim SHA-256: `10fd4da661dec1c142ca5809207e0a756eb4686ef40e915770d4d385a55a487d`
- **Browser Provenance**: `Headless Google Chrome 154.0.8037.93 (Windows NT / arm64)`
- **Run Timestamp**: `2026-10-03T06:51:17.714Z`
- **Exact CI Run**: `37104710307` (`IN_PROGRESS`)
- **PR Status**: OPEN, unmerged, no linked closing issues (`closingIssuesReferences` empty). Production remains `v3.5.31-1265e8a`. Themes are **NOT LIVE**.

---

#### 2. Concrete Remediation of 4ee5e94 Review Findings

##### A. Complete 2D Cartesian Physical Model Binding in Final Gate (Finding 1)
- Replaced broad scalar range checks and near-identity constraints ($|a-1| < 0.1, |d-1| < 0.1$) in `printIsolationPassed` in `server/scripts/verify_issue155_browser_journeys.cjs` with sound 2D Cartesian physical model validation:
  1. **Orthogonality**: Cartesian plot axes are orthogonal ($b = 0, c = 0$ with $|b| \le 10^{-4}, |c| \le 10^{-4}$); strictly rejects skewed/sheared displacements like $b=3, c=4$.
  2. **Multi-curve transform consistency**: Transforms across curves in the overlay must match ($t_i \approx t_0$ within $10^{-4}$).
  3. **Base unscaled coordinate mapping**: Evaluated via:
     $$M_x^{(0)} = \frac{M_x}{a}, \quad K_x^{(0)} = \frac{K_x - e}{a}, \quad M_y^{(0)} = \frac{M_y}{d}, \quad K_y^{(0)} = \frac{K_y - f}{d}$$
  4. **Uniform 500-point physical calibration grid step**: Enforced uniform step $\Delta x^{(0)} = -3600 \cdot M_x^{(0)} / 499$: strictly validates step $\approx 1.0$ px/pt (synthetic 499px layout) or $\approx 2.0$ px/pt (real Chrome 998px layout) with $|\Delta x^{(0)} - 1.0| < 0.05$ or $|\Delta x^{(0)} - 2.0| < 0.05$.
  5. **Unscaled origin at $W=4000 \text{ cm}^{-1}$**: $X_0^{(0)} = M_x^{(0)} \cdot 4000 + K_x^{(0)} \in [-1.0, 100]$.
  6. **Unscaled absorbance scale height & baseline**: $|M_y^{(0)}| \in [90, 250]$ and baseline intercept $K_y^{(0)} \in [200, 350]$.
  7. **Cross-state consistency**: All 14 variant transitions and `afterExit` strictly preserve identical scale slopes and intercepts as initial `multiOverlay` ($|\Delta M| < 10^{-4}, |\Delta K| < 10^{-4}$).
  8. **Faithful common scale passes**: Common scaling by 2 on both ticks and curves (Case 5) passes cleanly (`printGate === true`).
  9. **Contradictory models fail closed**: Case 4 contradictory mutation ($M_x = -0.5, K_x = 999, b=3, c=4, e=120, f=700$) strictly fails closed (`printGate === false`).
  10. **Missing observations fail closed**: Deleting scales/transforms or setting degenerate slopes strictly fails closed (`printGate === false`).
  11. **Semicolon-free syntax**: Expression inside `printIsolationPassed = Boolean(...)` contains zero internal semicolons, preventing regex truncation during `verify_all_14.cjs` extraction.

##### B. Whole Stage Scope Reconciliation (Finding 2)
- Unambiguously categorized current observed vs static vs reused vs software-pending vs manual-pending scope across `TRACEABLE-MATRIX.md`, `EVIDENCE.md`, and PR handoffs:
  - **Observed in Live Running Application Context**: 12 browser journeys executed in native Headless Chrome 154 with local Express and SQLite, covering all 14 variants selector/adoption/preview/exit roots and named notification banner settlement/removal, deliberate non-default map pan/zoom (`[7.0, -1.0]`, zoom 16), 1-to-1 continuous spectral models, upload intake, camera stream & video element, worksheet scroll offset (scrollTop 48 on 2106px scrollHeight), and report print preview.
  - **Static Component & Adapter Scope**: In-checkout `verify_all_14.cjs` (58/58 passed) validates static SSR compilation/rendering via `ReactDOMServer` and synthetic IME events.
  - **Reused Accepted Artifacts**: Frozen client tree `6e83b8d4...`, data tree `1a2a8445...`, customer certificate PDF (162,633 B, SHA256 `47fdaa79...`), built CSS `index-Df7izgw5.css` (213,700 B, SHA256 `65e7d0a2...`).
  - **Software-Pending Scope**: Synthetic IME composition events vs native OS/system IME candidate windows; desktop browser native optical zoom UI engine controls (Ctrl+/Ctrl-) vs W3C SC 1.4.10 320 CSS px reflow layout equivalence, High-DPI DPR 2.0 at 640 CSS px with root font 200%, and DPR 1.0 at 1280 CSS px with root font 400%.
  - **Manual-Pending Scope (Physical Hardware & Operator)**: Physical screen reader listening (NVDA/JAWS/VoiceOver/TalkBack), OS contrast theme display, physical mobile hardware (iOS/Android), physical thermal label printer.
  - **Live Fact**: PR #155 is OPEN, unmerged, undeployed; production remains `v3.5.31-1265e8a`; themes are NOT LIVE.

---

#### 3. Verification Summary
- **Running-app Browser Suite (`server/scripts/verify_issue155_browser_journeys.cjs`)**: **12/12 SUITES PASS 100% GREEN**.
- **In-checkout Suite (`server/scripts/verify_all_14.cjs`)**: **58/58 TEST CASES PASS 100% GREEN**.
- **Plan Budget Footprint**: 5,333 B gzip (<= 15.0 kB limit, margin +9.79 kB under budget). Complete app overhead: 19,342 B gzip.
- **Standby Cadence**: Operating under standing 5-minute active monitor without background polling loops; standing by for Codex independent review.
