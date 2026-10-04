### Coherent Software Stage Remediation Update — Candidate `46a952a`

This update addresses all findings from Codex's independent review of candidate `dced48a` (`issue155-independent-review-dced48a.md` and probe `issue155-focused-review-dced48a.cjs`), completing the original software stage with verified shared fixtures, observed DOM queries, authoritative emitting runner binding, peak selection integrity, and toolchain reconciliation.

#### 1. Candidate Provenance & Invariants
- **Candidate Head Commit:** `46a952a96a1e6339612463a320d146c789c488d8` (`46a952a`)
- **Candidate Full Tree:** `06bb55dc4199c3d72697ba8778eb31fa97c35ff9`
- **Candidate Client Tree:** `d30e0197f6d0619b8b71fdd5c8fabc5803bf6c1b` (strictly frozen, zero client mutation)
- **Candidate Server/Data Tree:** `1a2a84457d02d33707f9845da10f9b97995e1377` (strictly frozen, zero mutation)
- **Base Commit:** `1265e8aa9f71f5f60b61c6fdaf31bc36ba8b2c54` (`v3.5.31-1265e8a`)

#### 2. Key Remediations Implemented
1. **Test 57 Shared Fixture, Real Provider Adoption & Observed Work Queries**:
   - **Root Attribute Wrapper Bypassed**: Eliminated the wrapper's artificial mutation of root attributes (`activeDoc.documentElement.setAttribute`) when an external provider adapter is passed. Test 57 delegates directly to `externalProvider.setPreviewTheme({ themeId, mode })`. If the external provider is a no-op that does not adopt the theme, Test 57 detects `appliedTheme !== v.theme` and strictly **fails closed**.
   - **Coherent Shared Fixture for Standalone Mode**: When running standalone (`doc === undefined`), Test 57 constructs a coherent shared fixture modeling the full LIMS workbench container (`inputEl`, `cellEl`, `drawerEl`, `filterEl`, `scrollEl`, `dialogEl`, `cameraEl`, `mapEl`, `spectralEl`, `noticeEl`), executing shipped `resolveThemeAppearance` from `client/src/lib/appearance.js`.
   - **Active DOM Querying via `activeDoc.querySelector`**: Test 57 actively queries `activeDoc.querySelector` across table cells, review drawer, filter queries, scroll position, confirm dialog, camera stream, workflow map, spectral chart, and preview notice banner.
   - **Strict Fail-Closed Behavior**: Throws fast if draft input is destroyed (`input.value !== '42.50'`), if initial draft is corrupted, if cell selection is lost (`selectedCell === 'LOST'`), if preview notice is missing during preview, or if input is not actively composing (`input.isComposing !== true`). On preview exit (`clearPreviewTheme()`), restores `'forest'` + `'light'`, clears notice, and verifies all 14 work states intact.
2. **Checked-In Emitting Runner for Browser Tooling Capability Evaluation**:
   - Checked in `server/scripts/evaluate_browser_tooling.cjs` as the verified emitting runner for `server/scripts/issue155-browser-tooling-evaluation.json`.
   - Dynamically launches real Headless Google Chrome (`153.0.8010.48`), evaluates WebGL context creation and `WEBGL_lose_context.loseContext()`, queries `navigator.mediaDevices.enumerateDevices()`, and inspects `server/index.js` for `WebSocketServer`.
   - Extension-induced context loss via `WEBGL_lose_context.loseContext()` followed by `gl.isContextLost()` verification (`status: 'CONTEXT_LOST_WEBGL'`) is documented as supplied capability evaluation within its stated scope; zero video devices (`videoInputCount: 0`) provides honest supplied evidence of unavailable physical camera hardware in headless containers; static WebSocketServer wiring is documented as source wiring proof.
3. **Spectral Collector Peak Selection Integrity**:
   - Eliminated synthetic fallback `[1450, 1620]` in `server/scripts/verify_issue155_browser_journeys.cjs` (`spectralSeriesState` and `spectralVariantTransitions`). When SVG contains peak markers (`.recharts-active-dot`, `[data-peak]`, `circle[r]`, `.sf-peak-marker`), observed peak values are extracted dynamically; when no peak markers exist in the chart, `selectedPeaks` strictly returns `[]`.
4. **Reconciled Vite Toolchain Provenance**:
   - Reconciled `VERIFIED_BUILD_MANIFEST.toolchain.vite` in `server/scripts/measure_theme_bundle_delta.js` to `'5.4.21'`, reconciling with installed `node_modules/vite/package.json` and `theme_bundle_budget_measurement.json` under Node `v24.13.0`.
   - Clean build verification confirmed: plan budget 5,333 B gzip (5.21 KiB ≤ 15.0 KiB), complete application overhead 19,342 B gzip (18.89 KiB).

#### 3. Verification & Preserved Proofs
- **In-Checkout Verification**: All 58/58 tests in `server/scripts/verify_all_14.cjs` pass 100% green.
- **Preserved Proofs**:
  - Customer Certificate PDF: `server/scripts/test_certificate_output.pdf` (162,633 bytes, SHA256 `47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a`, magic `%PDF-`) with pure white `#ffffff` margins and 11.50:1 WCAG AAA header contrast.
  - Exactly 630 route/variant pairings in browser results intact.
  - Native browser upload Promise reading (`uvt`, `uploadAfter`).
  - Native certificate parameter row model (`cvt`, `paramDefs`).
  - Axis calibration $A_{\text{axis}}=-100$, raw ZXing QR decoding, and light mode exit restoration.
- **Pending Non-Automated Gates**: Manual screen-reader evaluation (NVDA/JAWS/VoiceOver), OS High Contrast, physical mobile hardware (iOS Safari/Android Chrome), and physical thermal barcode label printer attachment remain honestly recorded as **PENDING** physical hardware testing. Historical Issue #102 is NOT an omnibus waiver.

#### 4. Release Authority
PR #155 remains open, unmerged, and undeployed awaiting independent Codex technical acceptance, exact-main CI, and operator release gates.
