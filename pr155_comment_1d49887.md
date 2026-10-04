### Coherent Software Stage Remediation Update — Candidate `1d49887`

This update addresses all findings from Codex's independent review of candidate `46a952a` (`issue155-independent-review-46a952a.md` and probe `issue155-focused-review-46a952a.cjs`), completing the original software stage with shipped component rendering in Test 57, standard DOM contract alignment, complete exit work-state verification, and browser tooling evaluation within a supported secure context.

#### 1. Candidate Provenance & Invariants
- **Candidate Head Commit:** `1d4988760dfc6a1f5e9543ccdcf8c525aa7172dd` (`1d49887`)
- **Candidate Full Tree:** `527ce38240896a0ac22f0c2a09b0eb99529993c7`
- **Candidate Client Tree:** `d30e0197f6d0619b8b71fdd5c8fabc5803bf6c1b` (strictly frozen byte-for-byte, zero client mutation)
- **Candidate Server/Data Tree:** `1a2a84457d02d33707f9845da10f9b97995e1377` (strictly frozen byte-for-byte, zero mutation)
- **Base Commit:** `1265e8aa9f71f5f60b61c6fdaf31bc36ba8b2c54` (`v3.5.31-1265e8a`)

#### 2. Key Remediations Implemented
1. **Test 57 Shipped Component Execution, DOM Attribute Alignment & Complete Exit Verification**:
   - **Shipped Component Rendering**: Loaded `client/src/components/workbench/NumericEditor.jsx` via `esbuild` and rendered controlled markup via `React` and `ReactDOMServer.renderToStaticMarkup(React.createElement(NumericEditor, { value: '42.50' }))`, verifying controlled input markup (`value="42.50"`, `inputMode="decimal"`).
   - **Contract Verification**: Verified `client/src/context/ThemeContext.jsx` contract wiring `resolveThemeAppearance`, `setPreviewTheme`, and `clearPreviewTheme`, and executed pure appearance resolver `client/src/lib/appearance.js`.
   - **Shared Data Fixtures Feeding Real DOM Structures**: In standalone mode (`doc === undefined`), replaced self-operating fixture objects with shared data fixtures feeding standard DOM element structures and the shipped `resolveThemeAppearance` pure resolver.
   - **Native DOM Attribute Querying**: Aligned observations with standard DOM element attributes (`data-cell-id`, `data-specimen-id`, `data-drawer-open`, `data-filter`, `data-active-popup`, `data-peak`, etc.) in addition to adapter fields.
   - **Native Controlled Input & IME Preservation**: Controlled input state (`value === '42.50'`, `selectionStart === 2`, `selectionEnd === 5`) is asserted through preview adoption, IME composition simulation, and preview exit without imposing non-existent custom properties (`isComposing`) on production components.
   - **Complete Work States Intact Before, During & After Exit**: Verified all 10 work states (draft input, caret, active cell, review drawer, filter queries, scroll position, dialog, camera stream, workflow map, spectral peaks) before, across all 14 canonical variants, and after preview exit.
   - **External Provider Delegation**: Probe Case 12 delegation preserved: external provider is adopted without wrapper root writes (`positive = recordingDoc()`), and no-op providers strictly fail closed with `/Provider must adopt preview theme/`.
2. **Supported Secure Context Browser Tooling Evaluation in Headless Chrome**:
   - Upgraded `server/scripts/evaluate_browser_tooling.cjs` to launch Headless Google Chrome (`153.0.8010.48`) and navigate to a disposable local HTTP server (`http://127.0.0.1:<port>`), establishing a genuine supported secure context (`isSecureContext: true`).
   - Evaluated `navigator.mediaDevices.enumerateDevices()` in this supported context: enumerates 3 hardware devices including 1 videoinput device (`count: 3`, `videoInputCount: 1`, `status: 'PHYSICAL_CAMERA_AVAILABLE'`).
   - Clarified that prior `MEDIA_DEVICES_NOT_SUPPORTED` in 46a952a resulted from `about:blank` insecure origin in headless Chrome rather than hardware absence. Noted that device labels remain empty until explicit user permission grant per W3C Media Capture specification.
   - Documented that WebGL context loss via `WEBGL_lose_context.loseContext()` (`status: 'CONTEXT_LOST_WEBGL'`) is intentionally induced capability testing of context loss detection, not spontaneous Cesium/app failure.
   - Traced WebSocketServer initialization from `server/index.js` (`const wsServer = require('./wsServer'); wsServer.init(server);`) to `server/wsServer.js` (`const { WebSocketServer } = require('ws');`), confirming HTTP server startup attachment (`wiredInServerIndex: true`, `multiUserReviewDaemonStatus: 'WIRED_IN_SERVER_INDEX_HTTP_INITIALIZATION'`).
3. **Preserved Proofs & Reused Verified Artifacts**:
   - In-checkout test suite `server/scripts/verify_all_14.cjs`: **All 58/58 cases PASS 100% green**.
   - Verified PDF disk artifact: `server/scripts/test_certificate_output.pdf` (**162,633 bytes**, SHA256: `47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a`, magic `%PDF-`) with pure white `#ffffff` margins and 11.50:1 WCAG AAA header contrast, reused without redundant regeneration loops.
   - Main browser journeys workflow artifact: `server/scripts/issue155-browser-journeys-results.json` (timestamp `2026-10-01T13:10:12.464Z`, 12/12 suites, all 14 variants, 630 route/variant CSS pairings) recognized as a reused verified artifact.
   - Reconciled Vite toolchain: `5.4.21` across package.json, measurement, and manifest.

#### 3. Honest Boundaries & Scope Reconciliation
- **Executed Automated Tests**: `server/scripts/verify_all_14.cjs` (58/58 passing), `server/scripts/evaluate_browser_tooling.cjs` (Headless Chrome in supported secure context), `server/scripts/measure_theme_bundle_delta.js`.
- **Reused Artifacts**: Customer certificate PDF `test_certificate_output.pdf`, main browser results `issue155-browser-journeys-results.json`, baseline metrics `1265e8a`.
- **Software Boundary Reconciliation**: Software verification is honest; standalone in-checkout Test 57 exercises shipped components and DOM structures, while browser integration is bound to the reused 13:10:12.464Z artifact.
- **Pending Non-Automated Gates**: Manual screen-reader evaluation (NVDA/JAWS/VoiceOver), OS High Contrast, physical mobile hardware (iOS Safari/Android Chrome), and physical thermal barcode label printer attachment remain honestly recorded as **PENDING** physical hardware testing. Historical Issue #102 is NOT an omnibus waiver.

#### 4. Release Authority
PR #155 remains open, unmerged, and undeployed awaiting independent Codex technical acceptance, exact-main CI, and operator release gates.
