## PR #155 Remediation of Independent Review 3a323da

Candidate commit `1e30482a74f28f6e4540ed771f68e078fbf2e523` (`1e30482`) has been committed and pushed to `origin feat/sitewide-theme-library-v1`.

### 1. Cryptographic Tree & File Integrity
- **Candidate Commit:** `1e30482a74f28f6e4540ed771f68e078fbf2e523`
- **Full Tree:** `4e746f31b46ebe33e21bb1b02db4c14f91a3347a`
- **Client Tree:** `c7557a2b3b74f077244fd0cee9e55e05edf21671` (100% frozen, zero mutation)
- **Server Tree:** `eda37bc35a218c38f3cd3703dc9763390f5b8f2d` (dynamically queried via `git rev-parse HEAD:server`)
- **Server/Data Tree:** `1a2a84457d02d33707f9845da10f9b97995e1377` (100% frozen, zero mutation)
- **Runner File Hash (`server/scripts/verify_issue155_browser_journeys.cjs`):**
  - Trim SHA-256: `c08107a575ceb4f7817381b86022ae4ec97994e78840540318163bc2b7c4c200`
- **Result File Hash (`server/scripts/issue155-browser-journeys-results.json`):**
  - Trim SHA-256: `4c9e5a21f551af6f0be20b2a0d2178d6aaa422b107cc6762147bee072d00af2e`
- **Reused Customer Certificate PDF:**
  - Length: `162,633 B`, SHA-256: `47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a`

---

### 2. Concrete Remediations of Independent Review 3a323da Findings
1. **Strict Scientific Axis Domain Coverage (Finding 1 / Case 3)**:
   - In `multiOverlayState`, `ovt`, and `multiOverlayState.afterExit`, enforced that observed axis ticks span the actual scientific reference models ($X \in [400, 4000]$, $Y \in [0.12, 1.18]$):
     `minObsX <= 1500 && maxObsX >= 3500 && (maxObsX - minObsX) >= 2000`
     `minObsY <= 0.50 && maxObsY <= 1.50 && (maxObsY - minObsY) >= 0.50`
   - Real Chrome Recharts tick extraction on $[400, 4000]$ and $[0.12, 1.18]$ observes `xTicks: [1300, 2200, 3100, 4000]` and `yTicks: [0, 0.3, 0.6, 0.9, 1.2]`, which satisfy these bounds.
   - Genuine reference adapters (Case 2: `[400, 1000, 2000, 4000]` and `[0, 0.4, 0.8, 1.2]`) pass.
   - Physically plausible but truncated ticks like $X \in [600, 700]$ (span 100) and $Y \in [2, 3]$ (absorbance 2 to 3, detached from baseline) are strictly rejected across initial, all 14 transitions, and exit (`axesVerified: false`, `modelVerified: false`).
2. **Unfinished Matrix Mapping State Preservation (Finding 2 / Case 4)**:
   - In `opGate`, strictly enforced that the `matrix` mapping row retains its genuine unassigned fixture state:
     `r.column === 'matrix' && r.status === 'Incomplete' && (!r.targetParameter || r.targetParameter === '') && (!r.analysisCode || r.analysisCode === '') && (!r.methodologyId || r.methodologyId === '') && (!r.unitCode || r.unitCode === '')`
     and strictly rejects mutations (`r.targetParameter !== '' || r.analysisCode !== '' || r.methodologyId !== ''`).
   - Changing the unassigned matrix selection to `TN / nitrogen-sop / Incomplete` is strictly rejected by the operational gate.
3. **Complete Draft Text Equality in Final Gate (Finding 3 / Case 5)**:
   - In `opGate`, strictly enforced complete draft text equality:
     `v.draftMatches === true && typeof v.draftText === 'string' && v.draftText.trim() === 'sampleId,pH,matrix\nSMP-TEST-001,6.5,Topsoil'`
     across all 14 preparse transitions and `uploadDetails.preparseAfterExit.draftText.trim() === 'sampleId,pH,matrix\nSMP-TEST-001,6.5,Topsoil'`.
   - Mutating draft text to `SMP-OTHER,99,Subsoil` while retaining stale `draftMatches: true` is strictly rejected by the operational gate.
4. **Complete Operating Stage & Software Map Blocker Reconciliation (Finding 4)**:
   - Identified exact source blocker in `client/src/components/reception/SampleMap.jsx`:
     - Line 135: `const position = [lat, lng];`
     - Line 190: `<ChangeView center={position} />`
     - Lines 29–35: `ChangeView` resets `map.setView(center, 13)` inside a `useEffect([center, map])`.
     - Because `position` is re-allocated on each render pass, `ChangeView` forcibly resets the map to default coordinates (`[5.6037, -0.1870]`, zoom 13).
     - Because client tree `c7557a2b3b74f077244fd0cee9e55e05edf21671` is strictly frozen, modifying `SampleMap.jsx` is prohibited. This constitutes an exact, source-supported software blocker for preserving non-default pan/zoom through component re-render.
   - Updated GitHub PR #155 body to align with client tree `c7557a2b3b74f077244fd0cee9e55e05edf21671`, fresh browser execution, full 14 operating items enumeration, and honest scope boundaries.

---

### 3. Verification Suite Executions
- **Browser Journeys Suite (`verify_issue155_browser_journeys.cjs`)**: **12/12 suites PASS (100% green)** with real Headless Google Chrome `153.0.8010.48` (`issue155-browser-journeys-results.json`, timestamp `2026-10-02T22:43:20.691Z`).
- **In-Checkout Test Suite (`verify_all_14.cjs`)**: **58/58 test cases PASS (100% green)**.
- **Focused Review Test Probe (Reproducing all 5 Codex cases)**:
  - Case 1: Pinned identity and genuine supplied positives pass (`opAccept() === true`, `printAccept() === true`).
  - Case 2: Prior offset duplicate and invalid axes reject; genuine reference adapters pass.
  - Case 3: Physically plausible but wrong axes $[600, 700]$ and $[2, 3]$ **strictly reject** (`initialAxesVerified: false`, `transitionModelVerified: false`, `exitModelVerified: false`, `printAccept() === false`).
  - Case 4: Mutated unfinished matrix associations (`TN / nitrogen-sop / Incomplete`) **strictly reject** (`opAccept() === false`).
  - Case 5: Mutated draft text with stale equality flags (`SMP-OTHER,99,Subsoil`) **strictly reject** (`opAccept() === false`).

---

### 4. Status & Review Handoff
- PR #155 remains OPEN and unmerged. Production remains `v3.5.31-1265e8a`. Themes are NOT LIVE.
- Awaiting independent technical review by Codex. Detailed readiness handoff recorded in `C:/Users/yigin/Documents/Codex/2026-09-21/se/work/sitewide-themes-ready-for-review.md`.
