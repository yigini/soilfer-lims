# Independent responsive coach verification — checkpoint 14

14 September 2026, 14:37 UTC. **PASS: all 40 focused cases.** Tested the frozen local build associated with `e78edf8641832e3cd23f60cd485bcbd08b12ea50`; deployment identity is checked separately by the parent monitor.

## What now works

Expanded and collapsed coach controls fit within the viewport on Login and the synthetic authenticated Workbench at **320 × 700, 390 × 844, 700 × 360, and 1440 × 1000**. Each route/viewport combination was exercised in **English, Spanish, Latin American Spanish, French, and Portuguese**.

Every case verifies the actual selected guide locale and translated expanded Pause/Exit labels. The checks inspect control rectangles, pointer hits, clipping ancestors and zero horizontal coach scroll. They then click the initially visible control centers using ordinary mouse events, without forced clicks, programmatic element clicks or scrolling:

- Expanded Pause → visible Resume.
- Minimize → collapsed Pause → visible Resume.
- Expand → expanded Exit, which removes the guide.
- In a fresh isolated local document, Minimize → collapsed Exit, which also removes the guide.

All 40 cases passed with no page errors or attempted non-read API requests. The previously clipped 320/390 controls are resolved. The French 320px expanded Login screenshot, Portuguese 320px collapsed Workbench screenshot, and French 700 × 360 expanded Workbench screenshot were visually inspected and agree with the geometry checks. The shorter landscape screen uses a vertically scrollable coach while keeping its top controls initially visible.

## Scope and language limits

All APIs were intercepted with read-only synthetic responses; the Workbench identity was synthetic. External resources and non-read requests were blocked. No application source edits, build, backend, database or production interactions were performed. This check repeats only the newly changed responsive controls; previously accepted account handover and draft safeguards were not rerun.

The collapsed Exit button still renders the English fallback `Exit ×` in every locale because `common.exit` is absent from all five dictionaries. Expanded Exit, Pause, Expand and Resume are localized. This is a small separate content gap, not a failure of the responsive correction; this report does not claim every tutorial string is fully translated or scientifically reviewed.

### Separate bounded copy correction for Antigravity

Add the missing short `common.exit` label inside the existing tutorial dictionaries only: **en: Exit; es: Salir; es-419: Salir; fr: Quitter; pt: Sair**. Alternatively, reuse an existing suitable short translated label. Preserve the appended close symbol, handler, current sizing, and all ordinary application translations and files. Confirm the actual collapsed label in each guide locale, with a 320px row-fit spot check after the string change. No full 40-case matrix, auth regression, core-page edits or broad translation audit is requested for this small omission. Keep responsive acceptance closed while recording this copy correction separately before a full-copy completion claim.

This is viewport/pointer acceptance, not physical-device, native touch, on-screen keyboard, screen-reader, human novice or complete platform mobile certification. The existing Workbench's unrelated small-screen layout is outside this bounded tutorial-control review.

## Evidence

- Reproducer: `independent-responsive-review14.cjs`.
- Machine evidence: `independent-responsive-review14.json`, with 40 case results, rendered labels, geometry and actual action sequences.
- Selected screenshots: `independent-responsive-review14-320-login-fr-expanded.png`, `independent-responsive-review14-320-workbench-pt-collapsed.png`, `independent-responsive-review14-700-workbench-fr-expanded.png`; additional selected screenshots accompany the JSON.
- Source Shell SHA256: `9c5564913eefeaadcea5baef3a8c327b739b1a5e5ef89317e5ca0ab4af02bea5`.
- Index SHA256: `b65439e30e00f2bbd385edddb86f451d378769440d51746cc48b9cad89753344`.
- `TutorialShell-Dw7KOo2o.js`: SHA256 `99ba58ee761a7da5d549d96272f8f63a2d6f838d3dd50d2fea31fb9796f32c49`.
- `TutorialShell-BSpGr4x-.css`: SHA256 `d1a6cc7519e7a6cca274e74655bb7e82b6587d52b883d350f8bfb01c56bfa8ee`.

Keep the responsive correction accepted. No further layout change or broad unchanged test rerun is requested by this review.
