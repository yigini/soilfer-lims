# Implementation plan: a first-visit guide over SoilFER LIMS

**Current authorization:** implementation and safe delivery are approved in IMPLEMENT-NOW.md. Its execution instructions supersede the historical conditional draft wording below. The user requires subtle visuals and minimal existing-code changes; monitor reviews are now every 15 minutes.

## 1. Product decision

**Audience clarification:** the visitor may know only the name/concept LIMS. `absolute-beginner-foundation.md` is mandatory and refines the initial opening/timing below. Explain the system's purpose, connected objects, people, navigation and recovery first. The default first-user story is now approximately **16–18 minutes including the foundation**; the existing 12–15-minute workflow path is for visitors who skip the basics. The 3-minute overview must include condensed foundations and is available as an illustrated explanation without authentication. Never expose private pages just to make that overview work.

Use a calm, practical **guided lab visit**, available only through an opt-in URL. Start with the real login screen. Explain the user's role, show the next useful action, then follow sample identity through reception, preparation, analysis, review and reporting. Include the workflow map, field provenance, equipment, inventory, languages and data connections at the point where each matters.

The guide is temporary; the Help Centre remains the long-term reference. Do not add another knowledge base, a chat assistant, a mandatory welcome carousel, badges, scores or a new dashboard. Existing accounts and normal role restrictions remain authoritative.

Offer three paths on the opening card:

| Path | Audience | Shape |
| --- | --- | --- |
| Show me the platform | First impression / director | Approximately 3 minutes, 8 short scenes, no account switching required; inaccessible pages use explicitly illustrated teaching cards |
| Follow a sample | New team member | Approximately 16–18 minutes with the beginner foundation, excluding login and real laboratory work; 5 synthetic samples, reception → technician → reviewer |
| Learn my role | Individual staff member | Reception 4–5 min; technician 6–8 min; manager 4–5 min; coordinator 4–5 min; viewer 2–3 min |

No automatic advancement in learning paths. A completed teaching step is not a completed laboratory task. The wording is “Lesson complete”, “Practice saved in this guide”, or “I understand”; never “Sample received” without both an explicit practice qualifier and the right boundary.

Before release, run the beginner acceptance gate with three people who have never used this LIMS. They must be able to explain the purpose, locate a sample and their next action, distinguish a draft from a submission, and find Help without coaching. This is a usability check, not a competency assessment or evidence that laboratory operations have passed their separate acceptance.

## 2. Separation of live pages, practice and actual lab training

### Recommended temporary release

**Live page orientation:** the user's real, authorized LIMS page remains visible. The guide explains it and spotlights stable controls. Tour-owned actions navigate to approved internal pages or open lesson content. They do not click Save, Receive, Submit, Approve, Delete, Sync or Issue report on the user's behalf.

**Practice panel:** simulated entry takes place in an overlay-owned panel with its own labelled sample IDs `TRAIN-US-001`…`TRAIN-US-005`. It is marked “Practice • example data • no LIMS records changed” throughout. It never changes the underlying page's values, labels, counts or statuses. Synthetic results are never inserted into the real results table, workflow map, report or dashboard. A practice handover changes the story persona, not the signed-in user. Show both separately.

**Actual training environment (optional follow-on):** if trainees must physically use real Save/Submit/Approve controls throughout the full chain, use the same tested application build with isolated database, uploads, queues, notifications and external services. Disable outbound Kobo/SIS/email jobs; use synthetic fixtures, per-cohort assignments and managed reset. An inline frontend tutorial cannot sandbox production writes. A test prefix, hidden URL, shaded screen or request interceptor is not an isolation boundary. This follow-on is not necessary for the first temporary guide.

A live annotation mode is not an application-wide read-only mode. The account can still perform its ordinary actions if the user explicitly returns to normal work. The guide must not advertise broader protection than it provides. While a practice/modal is open, make the page inert; when giving nonmodal guidance, retain normal navigation and permissions and clearly label “Live page”. If the user chooses to act on real records, end/minimize orientation with a clear statement that normal LIMS work changes real data.

**Verified current-code consequence:** Workbench input changes can persist through the offline/server draft machinery before Save/Submit is pressed. Spectral “Stage & Inspect Scans” POSTs to `/api/spectral/preview`. Never instruct a no-write trainee to type into those real inputs or click that staging button. Authenticated SyncProvider can also synchronize a pre-existing outbox on reconnect. Promise “the tutorial sends no laboratory mutations”; do not promise that all background activity in the existing application stops. Do not disable or clear a user's normal outbox for this guide.

## 3. Entry, visibility and lifetime

Canonical opt-in URL:

`/login?tutorialmode=true&tour=first-visit&lang=en`

Also accept `/?tutorialmode=true`. An already signed-in user sees Resume / Restart / Learn my role; do not sign them out merely because the URL names login. Preserve unrelated query strings and hashes such as `tab=work`, sample/project filters and search. Use exact parameter parsing. Do not activate for `tutorialmode=false` or unrelated parameters. Optional legacy spelling `tutirialmode=true` may canonicalize once, only if needed to preserve previously shared links.

- No menu entry, first-login auto-popup, profile setting, site-wide banner or search indexing entry.
- A special URL keeps the feature out of normal navigation; **it is not access control**. Public lesson assets contain no passwords or sensitive records. Ordinary authentication still protects application pages.
- A versioned build enable flag, default off, controls availability. Publish an optional non-secret static availability manifest with `enabled`, `version`, `expiresAt`; fetch only after explicit opt-in. Expired/disabled modules do not mount. This is an operational kill switch, not a security gate.
- Keep only guide progress in `sessionStorage`: version, path, lesson ID, locale choice, timestamps, seen/skipped/practised lesson IDs and a handover intent. Cap lifetime at 8 hours; session close/expiry resets it. No access tokens, passwords, measurements, patient/client details or copied live record contents.
- A refresh with the flag or navigation within an already active tab resumes the guide. A copied deep link starts at a safe compatible lesson. Duplicated tabs can inherit sessionStorage: a fresh document without the flag may offer a small explicit Resume invitation from a valid saved intent, but must not auto-open the guide. App-driven SPA navigation retains the active bridge. A hard 401 redirect that drops the flag gets the same explicit Resume invitation after sign-in. Explicit `tutorialmode=false` overrides and clears any saved intent. Preserve the flag through guide-owned navigation without altering existing router/auth behavior.
- Logout/login handover preserves only harmless teaching position and intended role. Clear user-specific live target IDs immediately on identity/lab changes. A fresh authenticated user must re-resolve permitted records. Never carry an approval target across users.
- Pause minimizes the guide to a small “Resume guide” chip only in the opted-in session. Exit destroys overlay state/listeners and removes its parameters. Remove the chip too on Exit. Exit does not log out, clear real drafts, alter preferences or change route unexpectedly.

## 4. Architecture and existing-file budget

Current checkout: React 18, React Router 6, Vite 5. App routes are in `client/src/App.jsx`; providers are in `client/src/main.jsx`. The existing tutorial packet is not runtime code. The normal login redirects to `/`, and unauthorized/expired sessions can navigate to `/login`, so a route-specific component is insufficient.

Preferred integration:

1. Add `client/src/tutorial/` containing a tiny `TutorialEntry`, lazy `TutorialShell`, route/target registry, scoped styles, content and tests.
2. In **App.jsx only**, import the tiny entry and mount it as a sibling of Routes at an always-present level inside current router/auth/language providers. Check the actual App layout before placement. It must cover login and authorized pages. Do not rearrange providers or route guards.
3. `TutorialEntry` reads the enable flag and explicit opt-in. Only then dynamically imports the shell, locale and lessons. In normal sessions there is no tutorial DOM, CSS, API call, timer, listener or large eagerly loaded bundle.
4. The new module uses existing `useLocation`, `useNavigate`, `useAuth` and language/theme APIs. Read role context, never manufacture it. Do not patch `history`, monkey-patch fetch/axios, intercept result writes or read tokens directly.
5. Render into one dedicated portal host outside app content. Use CSS modules or strict `[data-sf-tutorial]` scoped styles, plus explicit theme tokens; no global `button`, `body`, `input` or `*` overrides. Shadow DOM is an alternative style boundary, but carries additional focus/accessibility and portal complexity; do not introduce it unless verified across target browsers.
6. Wrap the guide in its own error boundary. Missing assets or runtime failure remove the guide and restore the app. It must never trigger the application's global error boundary or a reload loop.
7. Prefer stable semantic identifiers already present. Add a small, enumerated set of `data-tour` attributes only where necessary. These are inert attributes, not business logic. Record every existing file touched in the PR. Do not select by translated text, Tailwind classes, DOM position or `.first()` guesses in production code.

Suggested new directory:

```
client/src/tutorial/
  TutorialEntry.jsx       # tiny gate + lazy loading
  TutorialShell.jsx       # UI, focus, error boundary
  useTutorialSession.js   # versioned expiring progress
  routeRegistry.js       # allowed routes + permissions + target resolvers
  targets.js             # stable selectors + missing/duplicate behavior
  content/firstVisit.js   # language-neutral lesson definitions
  locales/{en,es,es-419,fr,pt}.json
  practice/              # tutorial-owned synthetic exercises
  tutorial.module.css
  __tests__/
```

Avoid reverse-proxy HTML injection: it complicates caching, CSP, rollback and provenance while still modifying deployment behavior. Avoid a production same-origin iframe of the app: authentication, focus, nested navigation and click-through do not become safer. A separate static tutorial is a fallback with zero app edits, but must be called a standalone tutorial, not the live overlay.

## 5. Accounts and logical role handovers

Account cards contain role, lab, the reason for switching and (optionally) a facilitator-provided username. Use `intake_gtm`, `tech_gtm_1` / `tech_gtm_2`, `mgr_gtm` as **candidate examples requiring verification**, not hard-coded active credentials. Do not re-use the old email's assertion that all accounts are verified. No need for a super-admin account to learn the routine lab story. Coordinator chapters use only an authorized existing account.

Passwords should be provided through a separate facilitator access sheet or existing approved password-sharing channel. Do not publish them in public JS/JSON/HTML, source control, URL, screenshots, analytics, localStorage or sessionStorage. If a later requirement is an in-product reveal, it needs a protected, expiring server-side credential distribution design; that expands the one-mount temporary scope and is not part of v1.

Guide handover flow:

1. Show “Next: technician work” and why this role takes over. Offer **Continue as current role**, **Show an illustrated explanation**, or **Switch account** as appropriate.
2. Never auto-logout. Tell the user to save current work first. Use the application's existing logout flow or route them to that control; do not clear storage directly. If no reliable unsaved-work guard is exposed, require the user to perform the ordinary logout manually.
3. Keep the guide at the login screen. Explain the supplied account, with no password automation. The user signs in normally.
4. Wait for authentication to settle and for the existing server-validated user context. AuthContext currently initializes from stored user data and has no explicit ready state: do not treat cached `user` as authorization proof. Use an existing completed `/api/auth/me` lifecycle if available; otherwise a new module-local authenticated GET may confirm the session after opt-in. Treat 401 as sign-in needed, 403 as insufficient role and network failure as retryable unknown. Never change AuthContext semantics to serve the tour.
5. Confirm actual role/lab, resolve only allowed route targets, then offer Resume. A mismatched account stays on a handover card; it never bypasses RequireAuth.

Use explicit module-local states `anonymous`, `verifying`, `verified`, `unavailable`. A verification response must match the current actor ID; discard in-flight results on identity change. Existing password-change/activation flows take priority over the guide. Do not expose secrets or bypass a `mustChangePassword` screen. The normal app's language setter persists both session and local preferences; use a tutorial-local locale setter for the guide, rather than assuming the existing setter is transient.

Because authentication currently uses shared browser localStorage, role switching can affect other tabs. Explain “Use a dedicated browser profile for a different account if you are already working elsewhere.” Do not promise tab-isolated authentication or change session behavior for this feature.

## 6. Navigation and step completion

Each lesson has `id`, `chapter`, `mode`, `requiredPermission`, `routeResolver`, `targetKey`, `copyKey`, `expectedObservation`, `fallbackLesson`, `next`, and optional `practiceExercise`. Never allow arbitrary URLs, selectors, expressions, scripts or remote content from query strings.

Suggested modes: `orientation`, `practice`, `handover`, `summary`. Suggested state machine:

`OFF → INTRO → AUTH_WAIT / ROUTE_WAIT → EXPLAIN → PRACTICE → LESSON_COMPLETE`

`EXPLAIN ↔ PAUSED`; `any → EXIT`; missing/forbidden target → `UNAVAILABLE` with retry, relevant role guidance and an explicitly illustrated fallback.

Anchor resolution waits for the route to render, then finds exactly one visible permitted target. Bounded 5-second target wait, cancellable on navigation. No endless spinner. If zero or multiple matches appear, dock the explanation; do not highlight a guessed destructive control. Observe resize/scroll only while enabled and throttle position measurement to animation frames. Reposition around menus, bottom bars, mobile keyboard and current app modal. If an app modal is open, suspend the spotlight until it closes instead of overlaying a conflicting modal.

Use a nonmodal complementary guide for live actions: it must not claim `aria-modal=true` or trap focus while asking the user to interact with the app. Use a real modal dialog for introduction, handover and practice; make background inert, contain keyboard focus, support Escape and restore focus on close. Explain the current task in at most two short sentences, one primary action, and optional “Why this matters”.

Record `seen`, `practised`, `skipped`, `unavailable` separately. Pressing Next or opening a route is not proof of a successful laboratory mutation. For the optional isolated actual-work route, lesson completion must observe the real successful server response and durable state; never force status with Prisma or inject a fake success notification. The pending operational submission issues in the project-management review are release blockers for claiming a verified actual-work tour, not for honest orientation.

## 7. Scientific and operational teaching constraints

- Expected registration is not physical receipt. Location and field ID belong to provenance; a local sample ID must remain prominent.
- Drying/preparation are configured procedural evidence. No placeholder numerical result, universal drying temperature/time or auto-complete timer.
- Teach method-focused batches and stable row identity. Five samples make the tutorial digestible; a chapter explains that the same workbench supports larger batches without promising a specific throughput.
- Texture is a grouped sand/silt/clay result. Practice checks finite 0–100 percentages summing to 100 at displayed precision. Explain that real tolerances, fractions, classification scheme and derived texture class follow the configured validated method. Do not ship an improvised classification algorithm in the tour.
- pH practice uses illustrative data and configured method/unit. No added medical/agronomic interpretation or tutorial-imposed range check applied to real LIMS.
- MIR/NIR records are spectra plus acquisition metadata/QC, not an arbitrary reflectance scalar. Show an illustrative spectral curve, x/y semantics and source file. Raw upload, quality checking, prediction, library approval and report release are separate events; no claims that a uploaded curve automatically yields validated soil properties.
- Review is for submitted work. Acceptance, return with reason, reanalysis and final sample/report release are separate lessons. No fake “all approved” state in the real page.
- Kobo retrieval/import is not new field collection or automatic receipt. SIS preview/download is not delivered/acknowledged transmission. Do not trigger connectors during orientation.
- Equipment lesson explains suitability/calibration state; inventory lesson explains available lots and expiry. Do not reserve equipment, consume stock or edit calibration in the tutorial.

## 8. Visual design

Use SoilFER's soil-and-laboratory palette: warm ivory background, deep green primary, muted clay accent, clean white cards and restrained teal. Follow existing app theme when present; dark guide uses warm dark gray with legible borders. No global restyling.

- Opening invitation: “From field to trusted result.” A five-sample tray, three path choices, honest duration, language and visible Exit.
- Compact top ribbon: “First-visit guide”, chapter progress and Pause/Exit. Avoid a full-screen overlay at every step.
- Docked coach: 320–360px on wide screens, anchored near but never covering the explained control. Stage number, role badge, short instruction and one next action. Collapse to a chip when reading a table.
- Sample passport: small persistent context showing synthetic ID, project, current practice stage and next responsible role, only inside the practice guide. It never masquerades as a real record card.
- Handover card: “Reception has recorded arrival. A technician now prepares the material.” Separately show signed-in identity and story role.
- Mobile: bottom sheet with compact header and expandable instructions; no squeezed desktop rail. At 320–430px widths keep primary target and action visible, respect safe areas and keyboard. Landscape/tablets/200% zoom must remain usable.
- Motion 150–220ms only; respect reduced-motion. No auto-audio, confetti, floating assistant character or decorative charts without a teaching purpose.

The supplied preview demonstrates interactions and appearance. It is intentionally a reconstructed design frame, not a live capture and not proof of app behavior. Its English content is the review baseline, not a claim that five-language production content has been delivered.

## 9. Languages and maintainability

Support the actual five locale codes: **en, es, es-419, fr, pt**. Spanish for Spain and Latin America are distinct existing options. Use the current locale resolver. Tutorial-local copy files keep the temporary feature removable; do not add thousands of permanent Help Centre records.

Guide language initially follows the app. An explicit URL `lang` may override the guide for this session; do not save profile preferences automatically. Explain when the underlying application language differs and let the user use its normal language control. If app session override is used, preserve and restore the prior session value, never overwrite a user's later deliberate change. Prefer no app preference change in v1.

All rendered copy, screen-reader messages, errors, buttons, format labels and practice validation must be translated. Complete key parity, interpolation and plural tests for all five. Reuse canonical scientific names/units from the current catalogue where practical; preserve IDs and symbols. Give language reviewers the English source plus context screenshots. Show a clear English fallback if a locale asset fails; do not call fallback content fully translated. No machine-translated scientific terminology published without review.

## 10. Phased implementation

1. **Baseline and boundaries:** record current commit, existing pending edits, build, actual deployment tutorial status, routes and original scope. Do not mix ongoing Workbench/ManagerQueue fixes into tutorial changes. Confirm guide can be delivered with one mount plus bounded anchors.
2. **Isolated prototype:** new module and fixture content, intro/chapter selection/exit, preview against a local build. No backend changes. Show normal pages unchanged with flag absent.
3. **Real-page attachment:** route registry, auth wait, per-role paths, login handover, stable anchors, missing-target fallback, expiry/cleanup.
4. **Practice and language:** add synthetic exercises, state labels, role explanations, complete five locales, keyboard/mobile behavior. Keep production exercise code free of LIMS write calls.
5. **Acceptance:** execute acceptance-checklist.md on exact candidate build. Rehearse one complete role path and the full story. Record unavailable app workflows honestly.
6. **Delivery when authorized:** focused commits/PR, CI, existing deployment procedure, current rollback artifact, verify ordinary pages and entry link on deployed commit. No DB migration/seed is expected. Deployment approval for unrelated corrective work is not a reason to deploy this draft prematurely.
7. **Removal:** disable entry flag/manifest, verify disabled behavior including tabs opened earlier, then remove App mount and tutorial directory/anchors in a focused change. Do not delete Help Centre, normal settings or existing lab drafts. Retain versioned static assets briefly for open-tab compatibility; use agreed cache expiry rather than leaving a permanent service worker.

No estimate is a promise: expected effort is roughly 3–5 developer days for a polished orientation/practice shell plus locale and device review, assuming existing page controls work. A true multi-role isolated training deployment is additional work. Phase acceptance matters more than a timed promise.

## 11. Research basis

The recommendation to teach at the relevant task, offer skip/revisit and avoid lengthy upfront menu explanations follows [Nielsen Norman Group's onboarding research](https://www.nngroup.com/articles/onboarding-tutorials/). Modal focus containment, Escape and focus restoration follow the [W3C ARIA dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). These inform this design; they do not establish that the supplied mockup or the eventual app has passed accessibility testing. [MDN's Shadow DOM guide](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM) supports the CSS-isolation alternative; isolation of styles is not isolation of network access or lab data.
