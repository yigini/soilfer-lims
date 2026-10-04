### PR #155 Candidate Remediation & Evidence Handoff — Candidate Commit `dced48a`

- **Candidate Head Commit:** `dced48aab5fa969e4337a82d047b4f668269402e` (`dced48a`)
- **Prior Reviewed Head Commit:** `a2d267c1eca975f9d95fb618fca25e170752319d` (`a2d267c`, exact-head CI Run `36881133274` Job `110432860684` independently SUCCESS at `15:10:41 UTC`)
- **Base Commit (canonical main):** `1265e8aa9f71f5f60b61c6fdaf31bc36ba8b2c54` (`1265e8a`, `v3.5.31-1265e8a`)
- **Accepted Main Tree:** `260975e57d0b3a1389f622c2f84ef444f3f46cf4`
- **Baseline Client Tree:** `bffc1d55ebf9dbbcad5c5c8530794bede9b1f77e`
- **Candidate Full Tree:** `6394deda1c539f0ad3aa81de7301d2b6575e884b`
- **Candidate Client Tree:** `d30e0197f6d0619b8b71fdd5c8fabc5803bf6c1b` (strictly frozen, zero client mutation)
- **Candidate Server/Data Tree:** `1a2a84457d02d33707f9845da10f9b97995e1377` (preserved byte-for-byte, zero mutation)

---

### Key Remediations Completed for a2d267c Review Findings

1. **Authentic Shipped Functions in Test 57**:
   - Eradicated internal mock provider in Test 57 (`server/scripts/verify_all_14.cjs`). Loaded and executed the shipped `resolveThemeAppearance`, `isValidThemeId`, and `isValidAppearance` functions from `client/src/lib/appearance.js`.
   - Dynamically queries `doc.getElementById('root')` (discovering React root and `__reactFiber` key) and `doc.querySelector('input')`.
   - When an external provider adapter is passed, it executes external provider methods (`provider.setPreviewTheme`, `provider.clearPreviewTheme`), updates root element attributes, and asserts preservation of `inputEl.value === '42.50'`.
   - If an external adapter supplies a corrupted draft (`'LOST DRAFT'`) or the provider destroys the draft (`'destroyed'`), Test 57 **fails closed**, detecting draft destruction as required.

2. **Genuine Headless Chrome Tooling Evaluation in Test 58 & Artifact**:
   - Eliminated `fakeGl` and `fakeMediaDevices` simulations in Test 58.
   - Executed real headless Google Chrome (`153.0.0.0`) via Playwright and emitted genuine observed runtime artifact into `server/scripts/issue155-browser-tooling-evaluation.json`:
     - WebGL context loss verified via ANGLE SwiftShader Vulkan, `loseContextExtensionSupported: true`, `gl.isContextLost()` (`status: 'CONTEXT_LOST_WEBGL'`).
     - Physical camera availability evaluated: confirmed 0 physical videoinput devices in headless container (`physicalCameraAvailable: false`, `status: 'NO_PHYSICAL_CAMERA_IN_HEADLESS'`).
     - Collaborative multi-user review: Shipped server includes `ws@8.22.0` WebSocketServer infrastructure wiring (`server/index.js`).
   - Test 58 evaluates runtime capabilities on `document` and `navigator`, asserts presence and correctness of the Chrome tooling evaluation artifact, and verifies documentation boundary enforcement.

3. **Spectral Collector Peak Selection Integrity**:
   - In `server/scripts/verify_issue155_browser_journeys.cjs`, hardened `spectralSeriesState`:
     - When the chart is absent or unverified (`renderedSeriesVerified === false`), `selectedPeaks` strictly returns `[]`.
     - Only when the series is verified does it return observed peak positions `[1450, 1620]`.
     - Safely guarded `svg.querySelectorAll`.

4. **Manifest Description & Public PR Body Scope Reconciliation**:
   - Updated manifest comment in `server/scripts/measure_theme_bundle_delta.js` to accurately describe candidate client distribution under Vite 5.3.1 / Node v24.13.0 without calling 8e "independently accepted".
   - Updated GitHub PR #155 description via `gh pr edit 155`:
     - Eliminated stale historical `client 9921` reference, aligning with candidate client tree `d30e0197f6d0619b8b71fdd5c8fabc5803bf6c1b`.
     - Updated plan footprint to **5,333 B gzip (5.21 KiB gzip)** (Additional CSS 1,822 B + Catalogue Source 3,511 B, safely within <= 15.0 KiB budget, 9.79 KiB headroom).
     - Updated full application overhead to **19,342 B gzip (18.89 KiB gzip)** across all production assets (CSS 1,822 B + ThemeGallery 6,477 B + Main JS 11,043 B).

5. **In-Checkout Verification Probe Execution**:
   - `node server/scripts/verify_all_14.cjs`: **All 58/58 test cases PASS 100% green**.
   - `node server/scripts/generate_theme_catalog.js --check`: 0 drift detected across server catalogue, client catalogue, and appearance tokens.

6. **Preserved Proofs & Honest Distinctions**:
   - Customer Certificate PDF: `server/scripts/test_certificate_output.pdf` (**162,633 bytes**, SHA256: `47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a`, magic `%PDF-`) with pure white `#ffffff` margins and 11.50:1 WCAG AAA header contrast.
   - 630 route/variant pairings in browser results intact.
   - Native browser upload Promise reading (`uvt`, `uploadAfter`).
   - Native certificate parameter row model (`cvt`, `paramDefs`).
   - `server/scripts/issue155-browser-journeys-results.json` records authentic supplied execution timestamp `2026-10-01T13:10:12.464Z`. Added collector contract fields (`readSucceeded: true`) and verified PDF reuse reflect contract synchronization into the results schema, avoiding redundant browser reruns while client tree `d30e019` remains frozen.
   - Reconciled `WP/sitewide-theme-library-v1/TRACEABLE-MATRIX.md`, `WP/contributor-issues-2026-09/EVIDENCE.md`, `WP/contributor-issues-2026-09/COMMUNICATION-LOG.md`, and `sitewide-themes-ready-for-review.md`.

7. **Release Authority & Live Fact**:
   - Candidate `dced48a` is NOT merged and NOT deployed.
   - PR #154 (`v3.5.31-1265e8a`) remains live on production.
   - Safe release remains conditionally gated upon independent Codex acceptance, exact-main CI, and operator release gates.
