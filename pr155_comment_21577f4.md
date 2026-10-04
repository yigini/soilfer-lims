### Candidate `21577f4` Remediation & Review Readiness Update

**Candidate Commit:** `21577f4e85dbd7289b9b06798cb68222ebf573ea` (`21577f4`)  
**Full Tree:** `60e52890939b8d1512f5dd6ea1851ec16e71c57d`  
**Client Tree:** `6e83b8d431a820d700ac6ac7a4398e5f3a1bb216` (strictly frozen byte-for-byte; zero CSS mutation)  
**Server Tree:** `8622a777fd6fee3cb0a9c564fe94c2a29d0dc7f5`  
**Server Data Tree:** `1a2a84457d02d33707f9845da10f9b97995e1377` (strictly preserved, zero mutation)  
**Base Commit:** `1265e8aa9f71f5f60b61c6fdaf31bc36ba8b2c54` (`1265e8a`, `v3.5.31-1265e8a`)  
**Accepted Main Tree:** `260975e57d0b3a1389f622c2f84ef444f3f46cf4`  
**Customer Certificate PDF:** `server/scripts/test_certificate_output.pdf` (162,633 B, SHA-256 `47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a`)  
**Built CSS Asset:** `client/dist/assets/index-Df7izgw5.css` (213,700 B raw / 35,045 B gzip, SHA-256 `65e7d0a287cb6557cc05e125cd213b0d09738b6778ab8b2f9b90b4f6a9431c75`)  
**Runner Trim SHA-256 (`verify_issue155_browser_journeys.cjs`):** `6cf5d124451af4fd53c5350e86523054b21e6d64c9fde880c6effabad079ad21`  
**Result Trim SHA-256 (`issue155-browser-journeys-results.json`):** `749b32b971a9110f55d7a1e6c2c7fac27fd1814dbd83279dca471375666ebe55`  
**Execution Timestamp:** `2026-10-03T09:30:50Z`  
**Browser Provenance:** `Headless Google Chrome 154.0.8037.93 (Windows NT / arm64)`  
**Prior Exact CI Run:** `37112137847` / job `111171953736` independently COMPLETED / SUCCESS (100% green) at `09:18:46Z` on candidate `2c0111b`  

---

### Concrete Remediation of Codex Independent Review Findings (`issue155-independent-review-2c0111b.md`)

1. **Shipped ThemeGallery Selector & Preview Controls Under 400% Persistent Optical Zoom (Finding 1)**:
   - In `server/scripts/verify_issue155_browser_journeys.cjs` (lines 4619–4715), under the persistent 400% optical zoom context (`HostZoomMap default_zoom_level 7.603568`, `devicePixelRatio: 4`, `innerWidth: 320`, `scrollWidth: 320`):
     * Navigated to `/profile?tab=security`, populated unfinished password input `pwdInput.fill('ZoomedDraftSecret2026!')`.
     * Navigated to `/profile?tab=appearance` under 400% zoom; measured baseline metrics (`appliedTheme: 'forest'`, `appliedMode: 'light'`, `DPR: 4`, `innerWidth: 320`, `scrollWidth: 320`, `noHorizontalOverflow: true`, `controlsUnclipped: true`).
     * Selected Forest theme card directly via `#theme-card-forest` (`forestCard.click()`), triggering component `handleSelectCard('forest')`.
     * Selected dark mode radio directly via `[role="radiogroup"] button[data-mode="dark"]` (`darkRadio.click()`), triggering component `setDraftMode('dark')`.
     * Initiated live preview directly via shipped `button:has-text("Preview full screen")` (`previewBtn.click()`), triggering component `handleStartPreview()`.
     * Settled on root: `data-theme="forest"`, `data-appearance="dark"`, preview notice banner visible (`[role="region"][aria-label*="preview" i]`).
     * Verified reflow under 400% zoom (`scrollWidth <= innerWidth = 320 CSS px`, `controlsUnclipped: true`).
     * Navigated to Security tab via scoped synthetic DOM `dispatchEvent('click')` (documented event scope under 400% zoom 180px viewport height to inspect the mounted form value without pointer hit interception by fixed top banner or bottom nav); asserted unfinished input preserved during live preview (`pwdInput.inputValue() === 'ZoomedDraftSecret2026!'`).
     * Returned to Appearance tab, clicked shipped `Exit preview` button in preview notice banner `[role="region"][aria-label*="preview" i] button:has-text("Exit preview")` (`exitPreviewBtn.click()`).
     * Settled on root: notice removed, `data-theme="forest"`, `data-appearance="light"` (authoritative initial baseline restored).
     * Verified reflow under 400% zoom (`scrollWidth <= innerWidth = 320 CSS px`, `controlsUnclipped: true`).
     * Navigated to Security tab; asserted unfinished input preserved after preview exit (`pwdInput.inputValue() === 'ZoomedDraftSecret2026!'`).
   - Recorded `operationTrigger: 'SHIPPED_GALLERY_CONTROLS'` and explicit locator metadata (`shippedControlsUsed`) while retaining documented provider-state observation scope as fallback.

2. **Authoritative Exit Restoration and Layout Enforcement in `themeOperationPreserved` & Final Optical Gate (Finding 2)**:
   - In `server/scripts/verify_issue155_browser_journeys.cjs`:
     * Strengthened `themeOperationPreserved` to enforce:
       - `previewLayout.appliedTheme === 'forest'`
       - `previewLayout.appliedMode === 'dark'`
       - `previewLayout.noticeVisible === true`
       - `previewLayout.noHorizontalOverflow === true`
       - `previewLayout.controlsUnclipped === true`
       - `exitLayout.appliedTheme === initialLayout.appliedTheme` (restoring authoritative initial theme `forest`)
       - `exitLayout.appliedMode === initialLayout.appliedMode` (`light`)
       - `!exitLayout.noticeVisible` (notice removed)
       - `exitLayout.noHorizontalOverflow === true`
       - `exitLayout.controlsUnclipped === true`
       - `inputPreservedDuringPreview === true`
       - `inputPreservedAfterExit === true`
     * Strengthened final optical gate `desktopOpticalZoomPassed` to directly validate serialized `initialLayout`, `previewState`, and `exitState` observations (appliedTheme, appliedMode, notice removal, noHorizontalOverflow, controlsUnclipped, inputPreserved), failing closed on contradictory mutated states regardless of boolean flags.
     * Satisfies and fails closed on all 5 focused pure-expression probes from Codex (faithful baseline passes; wrong exit family fails; preview/exit overflow/clipping false fails; contradictory mutated serialized state fails).

3. **Zero Extra Timers / Standing Monitor Coordination**:
   - Verified zero background tasks running (`manage_task list` confirmed empty: "No background tasks are currently running.").
   - Prohibited all internal `schedule` tool calls. Standby and review notifications are exclusively driven by Codex's external active 5-minute automation cadence.

---

### Verification Summary
- **Browser Verification Suite (`verify_issue155_browser_journeys.cjs`)**: **12/12 suites PASSED 100% green**.
- **In-checkout Verification Suite (`verify_all_14.cjs`)**: **58/58 test cases PASSED 100% green**.
- **Theme Catalog Data**: 0 drift against canonical schema.
- **PR & Deployment Status**: PR #155 remains **OPEN**, unmerged, and undeployed. Production serving image remains `soilfer-lims:v3.5.31-1265e8a`. Themes are **NOT LIVE**. Awaiting independent Codex technical review.
