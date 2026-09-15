# Independent collapsed Exit translation spot check

**PASS, five of five locales.** Actual test time: **15 September 2026, 02:14:32 UTC / 04:14 Europe/Rome**. Source HEAD at the test was `62b3c1fc1d726efd1831e33e2199133ec4ff6e61`. This report does not imply that this revision is deployed; CI and production identity are checked separately.

The latest frozen local build contains the new short Exit labels. On the actual Login page at320 ×700, the selected guide locale and collapsed button text agree:

| Guide locale | Rendered button |
| --- | --- |
| en | Exit ✕ |
| es | Salir ✕ |
| es-419 | Salir ✕ |
| fr | Quitter ✕ |
| pt | Sair ✕ |

Each case verifies four concrete behaviors: the selected guide locale is correct; the short Exit label matches that locale; Expand/Pause/Exit fit inside the collapsed coach and viewport without clipping or horizontal scrolling; an ordinary pointer click at Exit's visible center removes the guide. All cases passed. No page errors or attempted non-read requests occurred.

The source Shell and CSS hashes are unchanged from the accepted40-case responsive check. This narrowly verifies the five-dictionary copy correction; no full responsive, account handover or draft suite was repeated. All APIs were intercepted locally, with no account credentials, database, application edits/build or production writes. This does not claim complete scientific-language or physical-device acceptance.

Evidence: `independent-exit-copy-review14.cjs` and `independent-exit-copy-review14.json`.

- Index SHA256: `dcb2016f84e9ccb24252405b8fc659d18d8836f031c29d58c4876a7b37185194`.
- `TutorialShell-BUJMBaGd.js`: SHA256 `2f113c0253ee4cd0628d9ef20abb601271b4b84eeb8fcaedc15e9b9e63bcf758`.
- `TutorialShell-BSpGr4x-.css`: SHA256 `d1a6cc7519e7a6cca274e74655bb7e82b6587d52b883d350f8bfb01c56bfa8ee`.
- Source Shell SHA256: `9c5564913eefeaadcea5baef3a8c327b739b1a5e5ef89317e5ca0ab4af02bea5`.

The collapsed Exit copy gap from the prior responsive review is now independently closed on this local candidate.
