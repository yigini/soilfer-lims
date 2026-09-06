# Implementation plan — a director's guided meeting show

## 1. Product and presentation decisions

Build a small guide over the actual LIMS pages, not a parallel redesign of the platform. Use existing branding, controls, readable parameter names and pages. Spotlight one meaningful region, give one short explanation, then move to the next responsibility. The director should understand who does the work, what prevents mistakes, and where the information goes.

The agreed main show is **180 seconds, English, 12 scenes**. `storyboard.json` is the authoritative scene order, timing and narration. It has 358 spoken words, leaving some room for pointing and transitions at a natural meeting pace. No automatic voice is required: the presenter narrates. An optional prerecorded voice can be added later, with the same timing and explicit playback controls, if requested.

Keep captions approximately one or two sentences. Show step count and a quiet 3:00 pace guide. Default to manual Next for the meeting; optional timed replay is for a rehearsed, ready state only. A question pauses the tour; optional feature details and presenter notes never run down the pace timer. Do not race through menus or automatically make lab decisions as the clock runs out.

Visible essentials: multilingual access; role-specific dashboards; Kobo provenance; five intake receipts; assignment; equipment readiness and inventory visibility; drying/preparation; method-based analysis bench; grouped texture; MIR/NIR file evidence and spectral library; quality review; workflow map; reviewed reports; national SIS exchange preview; pilot next step.

The 3-minute story cannot demonstrate every detailed operation. Full feature depth remains behind optional questions/chapters, with no false assertion that each feature was tested in the show.

## 2. Entry and environment

Canonical entry: `/login?tutorialmode=true&tour=director-3m&lang=en`. Support root entry `/?tutorialmode=true` and the misspelled `tutirialmode=true` alias. Normalize permitted keys once and preserve safe tour intent through authentication and routing. Do not put tokens, passwords, sample content or raw API keys in the URL. Validate tour ID, locale and scene key against an allowlist; do not allow an arbitrary return URL.

Use two explicit environments:

1. **Production guide:** optional read-only explanation over the authenticated user's existing pages. It does not change roles, fill data, accept samples, publish reports, call sync or consume inventory. Missing permissions produce an honest alternate explanation rather than granting access.
2. **Meeting rehearsal:** the same reviewed frontend/backend build with a separate database, upload/report storage, auth signing keys, notification transport and integration configuration. Five demo samples are processed only here. The most reliable default is an isolated rehearsal origin opened from the proposed production entry link, with a persistent **Demonstration workspace** badge. Exact hostname is a deployment choice; do not invent a working hostname or claim it is live before provisioning it. Keep production auth cookies/tokens and browser storage separate. Present the environment change plainly while preserving the visual continuity of the same app.

If the owner insists on one visible origin, implement an isolated deployment behind a dedicated reverse-proxy application base with its own strictly routed APIs and credentials. This is a higher-effort alternative and must prove isolation for **every** absolute API/file URL, background task and token. A client `isDemo` flag, row label or query parameter is not sufficient. Do not scatter `if (tutorialmode)` branches into production business logic.

Seed/reset/persona-switch endpoints exist only in the rehearsal deployment, require presenter permission and a scoped session, and are unavailable in production. A reset creates a fresh isolated session/dataset; it never rewinds live records. The production guide must not be able to call these endpoints with a production token.

## 3. Five-sample rehearsal dataset

Use `fixture-manifest.json`: five synthetic soil samples under SOILFER-US demonstration project context. Display IDs DEMO-US-001 through DEMO-US-005, with fresh immutable IDs per rehearsal session. Do not use W001, current technician assignments or five real expected production samples just to populate the show.

If authentic project context is desired later, copy only explicitly authorized, necessary field data into the rehearsal environment; strip personal details, private attachments and precise locations unless approved for the meeting. A copy must have a new identity and retain its demonstration label. The current mockup uses no copied field data.

Each sample has three analytical order groups: pH in water, soil texture and MIR acquisition. That is **5 samples / 15 analytical groups / 10 operational tasks** (drying and preparation). Sand, silt and clay are component results of the texture group. The class is a derived output, not a separately ordered technician task. Five MIR files are separate from numeric results. Do not sum these units into an ambiguous task count.

Resolve actual active catalogue entries, lab-enabled methods, applicable SOP revisions, equipment, material basis and QC in the rehearsal build. The synthetic pH/texture values do not define a scientific method. Compute texture class through the validated application classifier; use method-specific validation tolerance. Validate the three chosen methods actually exist and agree across active order, task generation, Workbench and reports.

For MIR, supply five explicitly synthetic parser fixtures with real supported structure, or authorized anonymized instrument exports. Verify mapping, units, axis, checksums, sample identities and the parser. Label the mock curve as illustrative. Never display “QC passed” because a file was merely attached, or claim predictive models are validated because a spectrum was imported.

Create a rehearsal service/run script that exercises the **existing core commands** under the proper actors to produce checkpoint evidence for all five samples:

| Checkpoint | Required evidence for all five samples |
|---|---|
| Expected | Synthetic Kobo-source provenance, correct project/matrix/order, not physically received |
| Received | Container match, receipt, condition/quantity/disposition, valid accepted intake and lab identity |
| Assigned | Compatible methods, explicit assigned operator and run/group links |
| Prepared | Actual applicable drying/preparation evidence and any required verification; no invented real elapsed time |
| Measured | pH and grouped texture results recorded through Workbench, correct attempts/versions; synthetic observations labelled |
| Spectra | Five supported files imported through the real intake command, exact sample links and checked QC state |
| Submitted/reviewed | Explicit technician handoff followed by a different authorized reviewer; linked immutable decisions and closed aggregates |
| Reported | Report version from reviewed evidence; demonstration watermark and no public share/send |
| Exchange preview | Scoped representation for a test SIS consumer; no national production delivery |

The live walkthrough uses verified checkpoints to compress laboratory time. Make the transition explicit: **“View prepared demonstration batch”**, not “dry five samples now.” Rehearse a real intake form for one sample, then show five receipts generated through the same process. Do not imply the current single-sample reception form has a bulk-accept button. If a batch acceptance feature is needed, treat it as separate product scope, not a hidden tutorial shortcut.

Back/Next changes the presentation checkpoint; it never unapproves, deletes or replays the same irreversible command. Prepared checkpoints should be prebuilt immutable session snapshots with consistent histories or distinct isolated checkpoint datasets. Preserve identity mapping so each scene follows the same five demonstration labels. A user action in optional hands-on mode executes a single idempotent core command and advances only after the saved evidence is read back.

## 4. Guide engine and page integration

Suggested frontend files (new names are proposals, inspect repository conventions first):

- `client/src/tutorial/TutorialProvider.jsx`: permitted entry, manifest, actor/environment, current scene and session resume.
- `TutorialOverlay.jsx`: spotlight mask, caption, Next/Back, clock, exit, chapter picker, paused/error state and responsive dock.
- `directorTour.js`: stable scene definitions derived from `storyboard.json` with i18n keys instead of hardcoded prose.
- `tutorialTargets.js` or page hooks: registration of actual stable elements and readiness predicates.
- `TutorialFeatureDetails.jsx`: optional feature explanations and actual authorized destinations.
- `client/src/locales/.../tutorial` (or current LanguageContext resource mechanism): versioned translations.

Do not choose a third-party tour library solely for its animations. First inspect dependencies; no tour library was found in the reviewed package manifests. If using one, verify its official current React/router support, accessibility, licensing and maintenance at implementation time. A small app-specific state machine is acceptable.

Each scene needs `{id, requiredRole, routeBuilder, targetId, prerequisite, readyWhen, captionKey, narrationKey, checkpointId, timeBudget, fallback, optionalDetails}`. Register targets with stable `data-tour` attributes. Never locate primary controls using translated text, DOM child numbers, hardcoded pixel coordinates or fragile XPath. The mock's anchors are proposed; they are not present in the app yet.

Sequence: load authorized scene context → navigate to exact sample/run/queue → await actual page data and anchor → position guide → present → explicitly act or move to checkpoint. A missing element, denied role, data mismatch or network failure pauses with a clear message and Retry/Skip explanation. Never silently show successful completion over an error/empty page.

Do not execute work on route mount or inside an effect responding to tutorial state. Distinguish Next (navigation) from Confirm/Record/Submit (real scoped command, hands-on mode only). Do not use automation that clicks a pixel after a timeout.

Highlight the relevant live element without covering it or its validation messages. Recompute bounds on resize, scroll, sidebar change, language change and async content. Use a docked guide when no safe overlay position exists. Respect `prefers-reduced-motion`; no flashing rings, looping pans or gratuitous zoom. The login presentation may pause the current animated background for legibility, but ordinary login behaviour remains unchanged.

Use the actual roles. The public login explanation grants no authority. Pre-authenticated rehearsal personas can support a clearly labelled **Continue as technician / manager** handoff using scoped rehearsal credentials. They must not sign a manager decision as the technician or impersonate a real staff member. Enforce separate actor identities and log all rehearsal activity. For production guide mode, require legitimate existing access and never silently impersonate.

Resume presentation state by scene ID, tour version, permitted session and locale. Do not store passwords or lab evidence in local storage. Exit cancels all timers/listeners/observers, removes masks/temporary focus changes, and restores route/scroll/language preferences where safe. It never discards unsaved user data. Confirm a real dirty form through the existing unsaved-change mechanism; the tour must not auto-submit it.

## 5. Multilingual behaviour

The director narration is English, as requested. The application and reusable tutorial must support the app's configured working languages, including the currently defined English, Spanish, French and Portuguese options. Inspect which are active on the release build; language option availability does not prove every translation is complete.

Use stable locale-neutral scene/anchor IDs. Translate guide captions, buttons, validation/error/fallback states, feature details, accessibility labels and optional narration. Keep sample IDs, analysis codes, units and stored scientific evidence unchanged. Display parameter and method names using the existing catalogue naming/localization policy; do not translate numeric evidence into a different value or basis.

Support an explicit tour language independent of stored account language. Do not overwrite the user's account preference on tour exit. A language change retains scene, dataset, actor and pending state. Render long French/Portuguese text without covering controls. Date/number presentation follows locale while parser inputs retain the method's data-entry rules. Use safe English fallback for a missing string, log missing keys for QA, and never display raw translation keys in the meeting.

Deliver reviewed EN strings first. Add professionally checked ES/FR/PT translations before advertising a fully multilingual tutorial. Do not claim the current English mockup demonstrates complete translated tours; it demonstrates the language feature and the proposed tour layout.

## 6. Kobo, SIS, equipment and inventory honesty

Kobo is the field-data origin. Show provenance and a last successful sync/checkpoint, not tokens or the integration configuration form. Live sync is a write and may create real samples; the meeting must use a dedicated test form or recorded rehearsal input. Do not call sync-all or edit project settings during the show.

SIS is the destination context. `/api/v1/data-exchange` exposes samples, results, maps/GeoJSON, spectra, incremental sync and stats, with authenticated scoped access. Show a human-readable exchange preview, not curl/JSON/token dashboards. A successful LIMS response proves extraction, not successful ingestion by a national SIS. Claim delivery only if the receiving test system supplies a verified acknowledgement and reconciliation evidence. In the default show, label it **Preview — not sent**.

Do not state that the current SIS API universally exports only approved results without testing/enforcing that contract. The reviewed controller's default sample filter is broader than approved, and the matrix formatter differs from the detailed sample representation. Make the presentation projection's approved sample/attempt selection explicit on the server and test the genuine consumer policy before using that claim. Keep the tutorial out of any API-key creation/revocation flow.

Equipment and inventory must be visible in the main assignment scene. Use real registry/readiness and stock/expiry views as read-only subbeats, with actual supporting records in rehearsal. Avoid inventing automatic stock reservation, consumption or instrument acquisition control. Optional questions can open instrument maintenance, consumable lots and analysis eligibility; these views pause the tour.

The workflow map is a required main scene, not just an optional link. Show the real graph for the selected demonstration sample and its dependencies, then its versioned report. These two subbeats share the 17-second scene. The mock simplifies them into one view; the real build must navigate or open the existing report preview without dropping context.

## 7. Timing and speaker support

The 180-second storyboard includes all essential feature mentions. Preload permitted route chunks and rehearse the exact session/actors/dataset so navigation is quick. The clock is a pace guide; it must pause during an error, question, role authentication or unreadiness rather than forcing a fake success to meet the deadline.

Provide an audience view with captions only and a separate presenter script/notes window or printed one-page run sheet. Notes shown inside a shared browser window are visible to the director; do not describe them as private. The standalone mock exposes notes for review, hidden by default.

Have a labelled offline replay of the verified demonstration available if connectivity fails. Announce that it is a recorded rehearsal, not a live integration. Do not quietly switch to fabricated live data. Full verification needs a wall-clock rehearsal with the presenter on the actual meeting display, not only a 180-second animation test.

## 8. Implementation and release phases

**Phase 0 — user approval:** show the mock and script. No application changes or Antigravity execution until this design is approved.

**Phase 1 — current build and rehearsal:** reconcile HEAD, latest Workbench fixes and deployed image; inspect this package's source map. Stand up isolated rehearsal storage, identities and integrations. Generate five consistent sample histories through the current core services. Record failures honestly; the tutorial cannot paper over the previous preparation/submission or active-order discrepancies.

**Phase 2 — guide:** add route targets and engine, login resume, context binding, exact five-sample selectors, persona handoff, captions/notes and the 12-scene flow. Add read-only equipment/inventory, real workflow-map/report subbeats and a redacted SIS preview.

**Phase 3 — localization and resilience:** translate and validate advertised languages; test theme/viewport/keyboard behaviour, pause/resume/exit, missing targets and timing. No general public auto-run or credential exposure.

**Phase 4 — rehearsal and pilot-readiness decision:** run acceptance-and-rehearsal.md against the final build. Fix blockers, rehearse all five records, check received/submitted/accepted/report parity, and verify the external-integration claims. Keep a sign-off ledger separate from the presentation.

**Phase 5 — approved deployment:** normal reviewed GitHub PR/CI, exact build and deployment verification; isolated rehearsal deploy plus the production entry/guide feature if approved. Back up relevant production assets/config before changing the host. A tutorial rollout should require no mutation or wholesale replacement of the real laboratory database. Feature flag rollback removes the guide/entry without changing laboratory evidence.

Final acceptance is not “the overlay opens.” It is a readable three-minute explanation of the actual demonstrated build, with consistent evidence for five samples, preserved access controls, working language support, an honest SIS boundary and a credible next step for laboratory testing.
