# Checkpoint 06 — b7fd307: preserve the fixes, finish the original acceptance

14 September 2026, approximately 13:42 Europe/Rome. Reviewed commit **b7fd307b1bcd393d72a09aac01a0eae9cbf9eccc**, pushed with CI **34838277001 successful**. This is not a deployment claim. No application, backend or database changes were made by this review.

## Accepted progress

- Receipt/assignment practice labels now stay synthetic; live map selection is excluded from new storage writes and clears on verified actor/lab change. Equipment and Inventory reset their own context. View Map shares the permission-aware navigation handler and no longer defaults an empty selection to TRAIN-US-001.
- New quick-overview paragraphs use the five dictionaries and remove the earlier unsupported ISO/calibration/tare assertions. Immutable session creation time now drives the eight-hour lifetime calculation.
- Independent actual-click anonymous walkthrough in **English and French** completed foundation → path selection → all quick stops without a page error, privileged navigation button or mutation request. It stayed on the login page as intended. F03 and prior auth/Exit/mobile fixes remain accepted from earlier focused checks; do not repeat those suites without a relevant change.
- Frozen snapshot: TutorialShell-chiItfdV.js / TutorialShell-D1vt1_Ss.css; index SHA **f57e18bdd3c834a8c464f2f18f3f05128f81c9eeea4da030a7a7a090f5674bed**. Evidence: `independent-quick-review06.cjs/.json` and EN/FR screenshots. API responses were mocked, external requests blocked, no backend or database access.

## Remaining original requirements, with narrow remedies

### 1. Tell the truth about lesson progress and paths

`useTutorialSession.js:237–253` puts every Next-clicked lesson into `done`; `TutorialShell.jsx:1528/1550` renders that as **Practiced & completed**. Our quick walkthrough never used a practice action, yet ended with seven done lessons. Keep distinct **viewed** and **practised** sets: Next records viewed; successful local exercises record practised; Skip and unavailable stay separate. Migrate old ambiguous done entries conservatively to viewed. No backend competency records are needed.

The quick path counter currently jumps 04/16 → 09/16 → 10/16 → 13/16 → 16/16. Derive displayed progress from `activeStops`, and verify each intended stop by chapter ID. The new quick diagram has a texture case but the quick array skips texture (index10); confirm the short story's intended content instead of using stale numeric comments. Exercise each actual path selector and handover, including technician, manager, coordinator and viewer. Do not claim all paths from one full-path position plus one reception jump.

### 2. Finish tutorial translations beyond dictionary parity

Actual French walkthrough still shows English in the tutorial's path-choice screen: “The full laboratory story is selected,” Username, Password, placeholders, Sign in and “This is a sketch of the login flow.” See Shell917–938; these are tutorial-owned strings, not the independently selected language of the underlying application. Foundation labels/glossary headings/accessibility strings also need the same visible-state sweep (for example Shell660). Translate all tutorial-owned UI across five locales and disclose a language fallback. Check rendered foundation, chooser, role selector, exercises, feedback, finish and errors; key-count parity plus Pause/Exit is insufficient. Human scientific review can stay explicitly pending.

### 3. Finish map identity resolution

Shell397 encodes the ID and chapters208 encodes it again: `SOIL / 001` becomes `SOIL%2520%252F%2520001`. Pass a raw ID and encode once when constructing a route; safely handle malformed URL decoding.

The text box/raw pathname/query still does not establish that a sample has actually loaded under the current account. Old route context can repopulate a prior sample after an identity reset. Use verified accessible record context or a normal read-only lookup, with loading/not-found/forbidden handling; otherwise direct the visitor to choose a sample in the actual sample list. Do not persist live record IDs or add a new backend endpoint/RBAC layer. Existing application RBAC still protects access; this finding is not evidence of an authorization bypass.

Current test1043–1049 types TRAIN-US-001 and checks only the resulting URL. Replace the success claim with a synthetic **accessible record that actually loads** its map, plus missing/forbidden, encoded-ID and account/lab-change checks. Fixture IDs are fine in isolated tests; successful navigation alone is not successful map resolution.

### 4. Provide the agreed temporary disable/removal controls

The approved plan49 requires a default-off build availability flag. `TutorialGate` currently mounts for every exact opt-in; no independent availability/retirement control exists. Add the small module-local availability mechanism, preserve ordinary-page lazy isolation and test disabled availability and graceful retirement of an already-open guide. An optional static manifest may supply retirement; do not choose a production retirement date without the user's policy or alter backend/business rules.

T22 currently replaces two strings in memory, then tests the unchanged build. Perform a real removal rehearsal in a disposable copy/build with mount/module removed; check normal login, Help and relevant ordinary pages there. Preserve the working checkout and every unrelated change. Record exactly which interactions were tested; a closing router tag does not prove laboratory behavior.

## Evidence corrections, not an expanded feature list

The 13:26 log's “100% technical pass” exceeds current assertions. Correct the mapping now and close only with relevant evidence:

| Existing ID | Current evidence limit | Finish or report accurately |
| --- | --- | --- |
| T11 | Initial full position; partial quick traversal; one reception jump | Actual remaining paths, viewed/practised distinction, handover/unavailable states |
| T14 | Dictionary parity and Pause/Exit | Rendered tutorial string/state coverage; human specialist sign-off remains pending |
| T07/T15/T16 | Role attributes/Escape and mobile controls | Focus/modal interaction, viewport overflow/overlap, zoom/reduced motion; physical device/screen-reader review separately pending |
| T17 | Corrupted session JSON only | Disable/retirement; reuse prior independently verified chunk isolation where unchanged |
| T22 | In-memory string replacement | Disposable removed build and ordinary-page checks |
| T23 map portion | URL includes an ID | Loaded authorized fixture map and useful failure paths |
| T21/T24 | Delivery incomplete / human review unavailable | Keep partial/pending until evidence exists |

Keep all fixes in the tutorial module and essential inert anchors. No general redesign, new authentication system, core workflow rewrite or repeated broad audit is requested. The user already authorized safe implementation, push/CI and deployment of a corrected candidate; no new approval cycle is needed. Preserve concurrent work and report the exact deployed revision when delivery occurs. Do not roll back the whole LIMS merely for tutorial lesson gaps. Use brief friendly updates explaining visible progress and remaining work.
