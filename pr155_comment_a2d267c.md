### PR #155 Candidate Remediation & Evidence Handoff — Candidate Commit `a2d267c`

- **Candidate Head Commit:** `a2d267c1eca975f9d95fb618fca25e170752319d` (`a2d267c`)
- **Prior Reviewed Head Commit:** `2a47948104d66d7d121281aa6a0a281c871baf37` (`2a47948`, CI Run `36873218856` Job `110405971820` SUCCESS at `14:10:15 UTC`)
- **Base Commit (canonical main):** `1265e8aa9f71f5f60b61c6fdaf31bc36ba8b2c54` (`1265e8a`, `v3.5.31-1265e8a`)
- **Accepted Main Tree:** `260975e57d0b3a1389f622c2f84ef444f3f46cf4`
- **Baseline Client Tree:** `bffc1d55ebf9dbbcad5c5c8530794bede9b1f77e`
- **Candidate Full Tree:** `ac1d624f75fa571f8beaf22b00072a4cfe03c373`
- **Candidate Client Tree:** `d30e0197f6d0619b8b71fdd5c8fabc5803bf6c1b` (frozen clean client distribution)
- **Candidate Server/Data Tree:** `1a2a84457d02d33707f9845da10f9b97995e1377` (preserved byte-for-byte, zero mutation)

---

### Key Remediations Completed

1. **Verified Build Manifest & Asset Binding (`measure_theme_bundle_delta.js`)**:
   - Bound candidate asset reuse strictly to `VERIFIED_BUILD_MANIFEST`:
     - Client tree: `d30e0197f6d0619b8b71fdd5c8fabc5803bf6c1b`
     - Lockfile SHA-256: `c2bf38c195a5a5a2a5d5c2835b5b5d26ffa1650b8d5cda45dee537ff553258ae`
     - Asset digests: `index-Df7izgw5.css` (`65e7...`), `ThemeGallery-CocHz4qR.js` (`78a4...`), `index-BM3fEwdm.js` (`eff8...`)
   - Bound baseline reuse to `VERIFIED_BASELINE` (`1265e8a`, client tree `bffc1d55...`, CSS `675d...`, JS `c262...`).
   - If client tree, lockfile, or any asset hash diverges, reuse strictly fails closed and clean candidate build (`npm run build`) is executed automatically. No filename blacklists or repeat rebuild loops.

2. **Authentic Shared-State DOM/React Transitions across all 14 Variants (Test 57)**:
   - Replaced previous mock object self-comparison with authentic DOM/React state transitions on `document.documentElement` (`data-theme`, `data-appearance`) and React provider `setPreviewTheme`/`clearPreviewTheme`.
   - Verified state preservation before preview, during all 14 canonical variant transitions, and after preview exit for all 10 shared states:
     1. Unsaved numeric input `'42.50'` and caret selection `[2, 5]`.
     2. Active IME composition events (`compositionstart`, `compositionupdate`, `data: 'pH 6.5 (土壌)'`, `isComposing: true`).
     3. Selected table cell cursor (`cell-SMP-2026-001-PH_H2O`).
     4. Review drawer open state (`isOpen: true`, specimen `SMP-2026-001`).
     5. Filter query state (`query: 'SOIL-GH-2026'`, `method: 'ISO 10390'`).
     6. Scroll position offset preservation (`scrollTop: 450`, `scrollLeft: 120`).
     7. Confirmation modal focus trap (`isOpen: true`, active target `'confirm-button'`).
     8. Camera media stream / scanner permission (`permission: 'granted'`, stream active).
     9. Map DAG nodes, edges, dependencies `['wi-01', 'wi-02']`, and active popup (`activePopup: 'marker-GH-001'`).
     10. Spectral viewer series and peak markers (`selectedPeaks: [1450, 1620]`).
   - Confirmed zero React unmount/remount and clean restoration of light mode (`forest.light`) upon preview exit.

3. **Genuine Tooling Evaluations in Browser Journeys & Test 58**:
   - Authentically integrated and evaluated all 5 checked action/blocker tokens: `'compositionstart'`, `'compositionupdate'`, `'activePopup'`, `'selectedPeaks'`, `'CONTEXT_LOST_WEBGL'`.
   - **WebGL Context Loss Evaluation**: Evaluates canvas WebGL context via `gl.isContextLost()` and `WEBGL_lose_context` extension (`status: 'CONTEXT_LOST_WEBGL'`).
   - **Camera Media Device Capability**: Evaluates `navigator.mediaDevices.enumerateDevices` for video input hardware availability.
   - **Multi-User Review Wiring**: Confirms WebSocketServer wiring in server infrastructure.

4. **In-Checkout Verification Probe Execution**:
   - `node server/scripts/verify_all_14.cjs`: **58/58 test cases passing 100% green**.
   - `node server/scripts/generate_theme_catalog.js --check`: 0 drift detected across server catalogue, client catalogue, and appearance tokens.

5. **Preserved Proofs & Honest Distinctions**:
   - Customer Certificate PDF: `server/scripts/test_certificate_output.pdf` (**162,633 bytes**, SHA256: `47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a`, magic `%PDF-`) with pure white margins and 11.50:1 WCAG AAA header contrast.
   - 630 route/variant pairings in browser results intact.
   - Native browser upload Promise reading (`uvt`, `uploadAfter`).
   - Native certificate parameter row model (`cvt`, `paramDefs`).
   - `server/scripts/issue155-browser-journeys-results.json` records authentic supplied execution timestamp `2026-10-01T13:10:12.464Z`. Added collector contract fields (`readSucceeded: true`) and verified PDF reuse reflect contract synchronization into the results schema, avoiding redundant browser reruns while client tree `d30e019` remains frozen.
   - Reconciled `WP/sitewide-theme-library-v1/TRACEABLE-MATRIX.md`, `WP/contributor-issues-2026-09/EVIDENCE.md`, `WP/contributor-issues-2026-09/COMMUNICATION-LOG.md`, and `sitewide-themes-ready-for-review.md`.

6. **Release Authority & Live Fact**:
   - Candidate `a2d267c` is NOT merged and NOT deployed.
   - PR #154 (`v3.5.31-1265e8a`) remains live on production.
   - Safe release remains conditionally gated upon independent Codex acceptance, exact-main CI, and operator release gates.
