### Remediation of cdb0f1f Review Findings — Candidate `96a1478` Review Handoff

- **Timestamp (UTC):** `2026-10-03T08:40:00Z` (`2026-10-03T10:40:00 Europe/Rome`)
- **Candidate Head Commit:** `96a14788160d097daf768800e81cab13349919f6` (`96a1478`)
- **Full Tree:** `d8e333be986a9efbcccd6661fe86fa206c96ff9a`
- **Client Tree:** `6e83b8d431a820d700ac6ac7a4398e5f3a1bb216` (strictly frozen byte-for-byte; zero CSS mutation)
- **Server Tree:** `6d8499a44040596c322038f2e5fd4cfc3969dd15`
- **Server/Data Tree:** `1a2a84457d02d33707f9845da10f9b97995e1377` (strictly preserved, zero mutation)
- **Base Commit:** `1265e8aa9f71f5f60b61c6fdaf31bc36ba8b2c54` (`1265e8a`, `v3.5.31-1265e8a`)
- **Accepted Main Tree:** `260975e57d0b3a1389f622c2f84ef444f3f46cf4`
- **Customer Certificate PDF:** `server/scripts/test_certificate_output.pdf` (162,633 B, SHA256 `47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a`)
- **Built CSS Asset:** `client/dist/assets/index-Df7izgw5.css` (213,700 B raw / 35,045 B gzip, SHA256 `65e7d0a287cb6557cc05e125cd213b0d09738b6778ab8b2f9b90b4f6a9431c75`)
- **Runner File Hash (`server/scripts/verify_issue155_browser_journeys.cjs`):**
  - Trim SHA-256: `5d8b3107f7399bc31b4408962ea4f53bd3f87e469a13efc0b3a0429bf889d17c`
- **Result File Hash (`server/scripts/issue155-browser-journeys-results.json`):**
  - Trim SHA-256: `6d9b95e10de40c26efef3df55777ae03fc292b6931420a7f37cfc732e1cc5501`
- **Browser Provenance:** `Headless Google Chrome 154.0.8037.93 (Windows NT / arm64)`
- **Run Timestamp:** `2026-10-03T08:36:17.803Z`
- **Prior Exact CI Run:** `37108974420` / job `111163005858` (independently COMPLETED / SUCCESS green on candidate `cdb0f1f`); new CI run `37110414056` triggered for candidate `96a1478`

---

### Concrete Remediation of cdb0f1f Independent Review Findings

1. **Desktop Optical Zoom Reflow Execution via Persistent Context Profile (`HostZoomMap`)**:
   - In `server/scripts/verify_issue155_browser_journeys.cjs`, executed real desktop optical zoom via Chromium's persistent browser context configuration (`HostZoomMap`):
     * Configuration: Persistent Chromium context with `Default/Preferences` containing `partition.default_zoom_level: 7.603568` and `per_host_zoom_levels: { [host]: 7.603568 }` (where $1.2^{7.603568} = 4.0$, setting 400% browser optical zoom factor) with a 1280x800 desktop window size.
     * Route & State: Evaluated on `${origin}/profile?tab=appearance` in authenticated user context.
     * Measured Layout Metrics:
       - `appliedZoomFactor`: 4.0
       - `devicePixelRatio`: 4
       - `innerWidth`: 320 CSS px (layout authentically reflowed from 1280px desktop window)
       - `visualViewport.scale`: 1.0 (authentic optical layout reflow, no pinch-to-zoom magnification distortion)
       - `visualViewport.width`: 320 CSS px
       - `scrollWidth`: 320 CSS px
       - `noHorizontalOverflow`: true (`scrollWidth <= innerWidth`)
       - `hasProfileIdentity`: true
       - `controlsCount`: 15
       - `controlsUnclipped`: true (all visible theme buttons and radiogroup controls fit within `[0, innerWidth]`)
     * Gate Enforcement: Actively enforced in Package 7 gate (`desktopOpticalZoomPassed === true`) and recorded in results JSON and verification boundaries.

2. **Desktop Application Window Chrome Shortcut Automation Attempt Witness & Limitation**:
   - Attempted action: External window activation and application chrome keyboard shortcut dispatch (`Control++`, `^{ADD}`) to desktop browser window frame.
   - Execution status: `ATTEMPTED_AND_BOUNDED`.
   - Mechanism limitation:
     * Playwright `page.keyboard` routes to the web-page DOM event pipeline in the Blink renderer, which does not trigger outer browser process application chrome accelerators.
     * External synthetic keystroke injection via Windows `[System.Windows.Forms.SendKeys]::SendWait` or `SendInput` is denied across background execution sessions (`Win32Exception: Access is denied`) under Windows User Interface Privilege Isolation (UIPI).
   - Resolved disposition: Native optical zoom layout reflow is actively executed and verified in software via Chromium's persistent HostZoomMap control, with identical viewport layout reflow behavior confirmed via W3C SC 1.4.10 320 CSS px reflow layout equivalence.
   - Scope: Desktop application chrome window frame controls (window title bar / 3-dot hamburger menu / external OS hotkeys); web contents rendering, layout reflow, and theme token styling remain 100% verified in software.
   - Specific help needed: None required for software verification or merge; physical human operation of desktop window chrome hotkeys remains recorded as honest manual pending alongside physical screen readers and physical hardware devices.

3. **Preserved Accepted CDP Session Probe Witness**:
   - Preserved `cdpPageScaleAttempt`: `CDPSession.send('Emulation.setPageScaleFactor', { pageScaleFactor: 4.0 })` with receipt `{}`, setting `visualViewport.scale: 4` and `visualViewport.width: 320` without layout reflow, proving page-scale magnification controls mobile pinch zoom rather than desktop reflow zoom.

4. **Preserved Accepted Closures (Strictly Preserved, Not Reopened)**:
   - Chart sizing / model separation / tick anchors / ID verification / common coordinate transforms.
   - Camera node identity across preview cycle (`videoNodeIdentity.isSameNode === true`).
   - Leaflet map deliberate non-default pan/zoom (`[7.0, -1.0]`, zoom 16).
   - CSV upload intake with pending 44 B file and full draft equality.
   - 5-row certificate report model under `@media print`.
   - Genuine accepted PDF (162,633 B, SHA256 `47fdaa79...`).
   - Clean client build and frozen CSS asset `index-Df7izgw5.css` (213,700 B, SHA256 `65e7d0a2...`).

---

### Verification Summary
- **Running-app Browser Suite (`verify_issue155_browser_journeys.cjs`)**: 12/12 passed (100% green).
- **In-checkout Suite (`verify_all_14.cjs`)**: 58/58 passed (100% green).
- **Theme Catalog**: 0 drift against canonical schema.

### Status & Handoff
- PR #155 is **OPEN**, unmerged, and undeployed.
- Production serving image remains `soilfer-lims:v3.5.31-1265e8a`. Themes are **NOT LIVE**.
- Awaiting independent technical review by Codex.
