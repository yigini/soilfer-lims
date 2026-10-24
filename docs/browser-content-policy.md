# Browser content policy

The application forbids JavaScript string evaluation, inline script bodies and
inline HTML event attributes. React event callbacks remain ordinary listeners
installed by the external application bundle. Styles retain the existing policy.

CesiumJS 1.124 uses WebAssembly decoders. The script policy permits
`'wasm-unsafe-eval'` for their compilation, while continuing to omit
`'unsafe-eval'` and `'unsafe-inline'`. These are separate permissions: the
[W3C CSP specification](https://www.w3.org/TR/CSP/#directive-script-src) states
that the WebAssembly permission does not enable JavaScript `eval` or `Function`.
Any future library requiring JavaScript string evaluation needs a separate
review; do not restore the broad permission to address a decoder error.

Cesium's bundled `inquire(moduleName)` helper also makes two optional CommonJS
lookups through `eval`, catches refusal and returns `null`. Browser diagnostics
attribute both blocked probes to the versioned CDN bundle at line 66, column
5688. They remain blocked; the synthetic 3D map renders terrain/imagery and its
sample pin without an uncaught exception. Do not describe this as a run with
zero CSP reports, or allow JavaScript eval to silence those optional probes.

The policy explicitly sets `script-src-attr 'none'`, `object-src 'none'`,
`base-uri 'self'`, `frame-ancestors 'none'` and `form-action 'self'`.

## Inline inventory for 1.12.0

The runtime-source and production-bundle inventory covers 683 tracked source
files and 70 generated JavaScript, HTML and SVG files. HTML fragments in string
literals and template literals are included. No executable inline script body
or inline HTML event attribute was found.

| Location | Script behavior |
| --- | --- |
| `client/index.html` | External module entry at `/src/main.jsx`; no inline body or event attribute. |
| Built `client/dist/index.html` | External hashed module entry and preload links; no inline body or event attribute. |
| Built React vendor bundle | An empty, inert script-element template used by React; no executable body. |
| `CesiumGlobe` and `FieldMap` | Dynamically add an external, versioned Cesium CDN script. Load/error handlers are JavaScript properties, not HTML event attributes. |
| Server response handlers | JSON, files, generated PDFs and CSV/plain-text responses; the SPA fallback serves the same built index. No server-rendered inline script or event attribute. |

No nonce or separate inline-work issue is needed for this inventory. Repeat it
when adding an HTML entry point, a server-rendered page or a third-party widget.
The inventory is a source/build check; browser behavior remains a separate gate.

## WebSocket credentials

Browser clients connect with `new WebSocket(url, [token])`, using the
`Sec-WebSocket-Protocol` upgrade header. The URL has no credential query.
The server refuses a `token` query parameter with close code 4001, including
when a valid subprotocol is also supplied. Missing header credentials are also
refused. Existing signature, current-principal, token-version, lab/actor lifecycle
and forced-password-change checks remain in force after transport selection.

## Release verification

Check the actual response header and a real WebSocket refusal/connection, then
use the production bundle with browser CSP diagnostics for sign-in, samples,
Cesium and 2D maps, charts, workbench, spreadsheet preview, report PDF and help.
Record external-service or fixture qualifications explicitly. A canvas appearing
alone does not prove decoder success; check compilation errors and policy
violations too. Verify that JavaScript eval and inline execution remain blocked
when WebAssembly compilation succeeds.

Use disposable synthetic data for local checks. The combined deployment retains
the installation, stopped-backup, source/integrity guards and proxy/origin checks
required by the preceding maintenance changes.
