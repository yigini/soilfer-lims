# Independent tutorial removal check (T22)

Verified on 14 September 2026 at 12:26 UTC using committed source `2a07e37bc48b10ff393af2a00a38e10b579d86ad`.

**Pass for the focused client removal scenario.** A separate Git-exported copy was built after deleting `src/tutorial` and removing exactly one `TutorialGate` import and mount from that copy's App.jsx. The ordinary page anchor attributes were retained. No original application files, backend, local database or production data were changed.

The static server served the **removed copy's own dist**, not the shared client/dist. Its index SHA-256 is `8f08e32b6faee568a61114850273af799d9bb7b00cb0abda27ae3219e0ba8bec`. No tutorial assets were emitted. Two existing static JSON build dependencies (`analysisDisplayNames.json`, `operationalChecklists.json`) were exported from the same commit. Existing node_modules was linked for compilation without installing dependencies.

Independent browser assertions confirmed:

- `/login?tutorialmode=true&tour=first-visit`: actual sign-in heading, username and password inputs visible; no guide.
- `/help`: actual `At the bench` page heading and a synthetic article supplied through the correctly shaped mocked Help API visible; no guide.
- `/workbench?tutorialmode=true`: actual Technician Workbench heading, Workbench navigation and queue read; visible signed-in `Removal Test Technician` and `LAB_TECHNICIAN · Lab: T22-LAB`; no guide. Screenshot visually inspected.
- No browser page errors and no attempted non-read HTTP writes. All API reads were mocked, external requests blocked, service workers disabled and WebSockets closed in the disposable browser context.

Evidence: `independent-removal-review08.cjs`, `.json` and `-login.png`, `-help.png`, `-workbench.png`. Build log and exported source remain in `C:\Users\yigin\AppData\Local\Temp\soilfer-independent-removal08-nomjas`. Earlier disposable attempts were left in similarly named unique directories; initial extraction/build setup and a missing `success:true` in the Help mock were corrected before this passing run. Those setup failures were not application defects.

This verifies client removal and selected ordinary-page rendering. The authenticated browser uses a synthetic cached session and mocked `/api/auth/me`; it does not establish real credential acceptance, backend operations, all permissions, complete Help quality, or production deployment. The test did not submit the login form or enter laboratory results.
