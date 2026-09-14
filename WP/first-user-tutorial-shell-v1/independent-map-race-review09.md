# Independent check 09: delayed map lookup after Exit

**Reproduced:** a sample-access response that arrives after the visitor exits the tutorial still changes the ordinary page and recreates tutorial session state.

Tested at 2026-09-14 12:48 UTC against a frozen in-memory copy of the current local `client/dist`. Git HEAD was `2a07e37bc48b10ff393af2a00a38e10b579d86ad`; this built snapshot includes later uncommitted changes and is not asserted to be that commit's deployed build.

- Tutorial asset: `TutorialShell-BQdbTeft.js`; SHA-256 `ee2c15033e412d5887983d9894e880d20c66e9e110421f026489bee9ed4633f3`.
- Index SHA-256: `84d29eef7b8b5fad622ed9908bcee82676fc9be168ea343b61cb8a34db2fbc90`.
- Source `TutorialShell.jsx` SHA-256 at capture: `ed0936f002af3810acb3cf0daf66309bd43f0ada88dce424ca0765d491474f21`.

The browser was a synthetic technician on `/workbench?tutorialmode=true&tour=first-visit`, with lesson 13 selected. All API requests were mocked; external requests and non-read requests were blocked. No backend, database or live system was used.

1. Enter `TEST-SAMPLE` into the guide-owned sample field and click View Map.
2. Hold `GET /api/samples/TEST-SAMPLE/detail` pending.
3. Click the guide's Exit button.
4. Verify URL `/workbench`, no `#soilfer-tutorial-overlay`, and no guide session storage.
5. Release a synthetic 200 response `{sample:{id:'TEST-SAMPLE',sampleId:'TEST-SAMPLE',labId:'MAP-RACE-LAB'}}`.
6. Observe URL `/samples/TEST-SAMPLE/map?tutorialmode=true` and newly created guide session storage. At the 1.1-second observation, `#soilfer-tutorial-overlay` was still absent; this check does not claim the full overlay was visibly reopened.

There were no browser errors or attempted non-read requests. The map itself was not accepted as functional; the assertion concerns late client navigation after Exit, independent of backend results.

Fix this in the tutorial module: abort outstanding sample validation and invalidate its request identity on exit/unmount, pause/disable/expiry, identity or lab changes, and other context changes that make the navigation stale. Immediately before navigation, ensure the guide remains active and the current identity/context still matches the request. A counter that increments only when another lookup begins does not invalidate a request on Exit.

The focused regression should keep the delayed-response sequence above and assert the route and tutorial storage remain unchanged after Exit. Source and machine-readable evidence are in `independent-map-race-review09.cjs` and `.json`. No existing application files were edited by this check.
