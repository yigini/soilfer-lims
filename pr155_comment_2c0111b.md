### Candidate `2c0111b` Remediation & Review Readiness Update

**Candidate Commit:** `2c0111b581f7dcf7a8ae02435ec612beea5c9cb1` (`2c0111b`)  
**Full Tree:** `8fcaa9792a55e811f01bc1a0fb71347b4a6d243f`  
**Client Tree:** `6e83b8d431a820d700ac6ac7a4398e5f3a1bb216` (strictly frozen byte-for-byte; zero CSS mutation)  
**Server Tree:** `3cdded9111a1fd7dc379f386469f63e5ab5ab9c4`  
**Server Data Tree:** `1a2a84457d02d33707f9845da10f9b97995e1377` (strictly preserved, zero mutation)  
**Base Commit:** `1265e8aa9f71f5f60b61c6fdaf31bc36ba8b2c54` (`1265e8a`, `v3.5.31-1265e8a`)  
**Accepted Main Tree:** `260975e57d0b3a1389f622c2f84ef444f3f46cf4`  
**Customer Certificate PDF:** `server/scripts/test_certificate_output.pdf` (162,633 B, SHA-256 `47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a`)  
**Built CSS Asset:** `client/dist/assets/index-Df7izgw5.css` (213,700 B raw / 35,045 B gzip, SHA-256 `65e7d0a287cb6557cc05e125cd213b0d09738b6778ab8b2f9b90b4f6a9431c75`)  
**Runner Trim SHA-256 (`verify_issue155_browser_journeys.cjs`):** `0f74eebd8d85aab0aa68eb921dc1e9151be044efc6cdad5b8d0a5a9ad4aac712`  
**Result Trim SHA-256 (`issue155-browser-journeys-results.json`):** `e6019090cf40fb7ac041f809d90e158743bc0ee0b88ecbe2eb7e4cf47598c1bf`  
**Execution Timestamp:** `2026-10-03T09:07:47.203Z`  
**Browser Provenance:** `Headless Google Chrome 154.0.8037.93 (Windows NT / arm64)`  
**Exact CI Run:** `37112137847` / job `111171953736` (triggered on candidate `2c0111b`, in progress); prior CI run `37110414056` / job `111167055063` (independently COMPLETED / SUCCESS green on candidate `96a1478` at `08:47:58Z`)  

---

### Concrete Remediation of Codex Independent Review Findings (`issue155-independent-review-96a1478.md`)

1. **Zoomed Theme Preview/Exit Operation & State Preservation Bound (Finding 1)**:
   - In `server/scripts/verify_issue155_browser_journeys.cjs` (lines 4550–4598), under the persistent 400% optical zoom context (`HostZoomMap default_zoom_level 7.603568`, `devicePixelRatio: 4`, `innerWidth: 320`, `scrollWidth: 320`):
     * Navigated to `/profile?tab=security`, populated unfinished password input `pwdInput.fill('ZoomedDraftSecret2026!')`.
     * Navigated to `/profile?tab=appearance` under 400% zoom; measured baseline metrics (`appliedTheme: 'forest'`, `appliedMode: 'light'`, `DPR: 4`, `innerWidth: 320`, `scrollWidth: 320`, `noHorizontalOverflow: true`, `controlsUnclipped: true`).
     * Dispatched `setPreviewTheme({ themeId: 'forest', mode: 'dark' })` on the ThemeProvider; settled on root: `data-theme="forest"`, `data-appearance="dark"`, preview notice banner visible (`[role="region"][aria-label*="preview" i]`).
     * Verified reflow under 400% zoom (`scrollWidth <= innerWidth = 320 CSS px`, `controlsUnclipped: true`).
     * Navigated to Security tab; asserted unfinished input preserved during live preview (`pwdInput.inputValue() === 'ZoomedDraftSecret2026!'`).
     * Returned to Appearance tab, clicked real `Exit preview` button in preview notice banner; settled on root: notice removed, `data-theme="forest"`, `data-appearance="light"`.
     * Verified reflow under 400% zoom (`scrollWidth <= innerWidth = 320 CSS px`, `controlsUnclipped: true`).
     * Navigated to Security tab; asserted unfinished input preserved after preview exit (`pwdInput.inputValue() === 'ZoomedDraftSecret2026!'`).
   - Actively enforced in Package 7 gate (`desktopOpticalZoomPassed === true`, requiring `themeOperationPreserved === true`) and persisted to `issue155-browser-journeys-results.json`.

2. **Accurate Shortcut Attempt Witness & Environment Limitation (Finding 2)**:
   - Pinned `desktopChromeMenuAttempt` is explicitly documented as a static reviewable summary linking the actual inspected native execution attempt trace:
     * **Witness Artifact**: `issue155-native-shortcut-attempt-witness-96a1478.json` (witnessed by Codex at `2026-10-03T08:49:50.418Z`).
     * **Executed Command**: `node scratch/test_headed_zoom.js` calling `scratch/send_zoom.ps1` against Example Domain in headed Chrome (`154.0.8037.93`).
     * **Executed Call**: `[System.Windows.Forms.SendKeys]::SendWait('^{ADD}')` at line 14.
     * **Observed Error**: `MethodInvocationException: Exception calling 'SendWait' with '1' argument(s): 'Access is denied' (Win32Exception) at line 14`.
     * **Observed Metrics**: Unchanged at `DPR: 1, innerWidth: 1280, innerHeight: 720`.
     * **Limitation**: Playwright `page.keyboard` routes to Blink renderer DOM pipeline without activating outer desktop browser accelerators; Windows `SendWait` threw `Win32Exception: Access is denied` in this session environment.
     * **Scope Distinction**: Example Domain external shortcut limitation is distinct from the verified LIMS native profile-zoom layout and theme operation evidence.
     * Claims of SendInput execution or universal UIPI causation removed.

3. **Zero Extra Timers / Standing Monitor Coordination (Finding 3)**:
   - Verified zero background tasks running (`manage_task list` confirmed empty: "No background tasks are currently running.").
   - Prohibited all internal `schedule` tool calls. Standby and review notifications are exclusively driven by Codex's external active 5-minute automation cadence.

---

### Verification Summary
- **Browser Verification Suite (`verify_issue155_browser_journeys.cjs`)**: **12/12 suites PASSED 100% green**.
- **In-checkout Verification Suite (`verify_all_14.cjs`)**: **58/58 test cases PASSED 100% green**.
- **Theme Catalog Data**: 0 drift against canonical schema.
- **PR & Deployment Status**: PR #155 remains **OPEN**, unmerged, and undeployed. Production serving image remains `soilfer-lims:v3.5.31-1265e8a`. Themes are **NOT LIVE**. Awaiting independent Codex technical review.
