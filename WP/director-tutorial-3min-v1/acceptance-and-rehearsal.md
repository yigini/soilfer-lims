# Acceptance and meeting rehearsal

Track each item with final commit/build, environment, test/journey, evidence and PASS/FAIL/NOT RUN. The standalone preview's test evidence is not application acceptance.

## Functional and presentation checks

- T01 Canonical login/root tour URLs and supported typo alias open the correct start. Unknown tour/step/locale and unsafe return URLs are refused or safely normalized. Normal login is unchanged.
- T02 Login preserves permitted tour state. No credentials or tokens appear in URL, screenshots, guide, logs or presenter notes. No auto-login to production or hidden impersonation.
- T03 All 12 scenes appear in order with exactly 180 seconds of planned budgets. Manual Next/Back, scene chooser, play/pause/resume, restart, notes, optional details and Exit work. Back never undoes data.
- T04 Every scene's actual route, data context and anchor are ready before spotlight/advancement. Missing target, 403, network loss or wrong sample pauses honestly and does not fabricate successful progress.
- T05 Same five demonstration identities through field, intake, assignments, gates, pH, texture, spectra, submissions, manager review, reports and exchange preview. No global or unrelated samples added to counts.
- T06 One intake form and five independently generated acceptance receipts are demonstrated. Expected records never count as received or drying/prep work. Tutorial does not introduce a fake bulk intake feature.
- T07 Actual valid active order, matrix/method revisions and task groups agree for every sample. Fifteen analytical groups and ten operational tasks remain distinct from five samples and texture components.
- T08 Drying/preparation evidence persists on reopening and agrees across Workbench/Sample/map. The labelled checkpoint compresses presentation time, not actual timestamps or physical work.
- T09 Method worksheet shows all five rows; valid pH/grouped texture recording, draft separation, submission and failed/partial-save handling use canonical commands. No scalar spectra entry or sample-page alternate writer.
- T10 Five actual supported spectral fixtures/imports exist and map correctly. Curve, original file, sample/attempt, axis/units and QC are real rehearsal evidence. An illustrative mock curve is never represented as measured data.
- T11 Reviewer differs from technician. Unsubmitted/fresh/blocked work cannot be accepted via any tour or API route. Review decisions close corresponding submissions and update all five sample/report states.
- T12 Equipment readiness/maintenance and inventory stock/expiry views visibly appear in the main assignment scene. No real stock consumption, reservations, maintenance changes or invented capabilities.
- T13 The real workflow map and report both appear in scene 10. Graph nodes/edges reflect the same sample/evidence. Report is reviewed, versioned and watermarked demonstration; no public share/send.
- T14 SIS preview is redacted, scoped and labelled not sent unless a receiving test system supplies a verified acknowledgement. Test actual payload shape, reviewed-evidence selection, units, methods, sample identity and access policies; no token exposure.
- T15 Kobo input uses a dedicated test form or labelled recorded fixture. No production sync or sync-all, accidental sample imports, live credential edit or background scheduler crossover.
- T16 Normal role permissions remain in force. Production tokens cannot access rehearsal actors/reset/seed, and rehearsal tokens cannot call production. Anonymous guide never obtains laboratory data or keys.
- T17 Main pages, reports, files, notifications and external exports contain no demonstration records outside the isolated environment. Test every connection/worker, not just a frontend filter. Failed rehearsal write never falls back to production.
- T18 English narration matches the visible state and actual implementation. No premature “ready”, “QC passed”, “approved”, “SIS delivered” or “zero issues” claims.

## Language and interface checks

- T19 EN/ES/FR/PT guide strings and captions are complete for every advertised tour locale, reviewed by competent speakers, and use locale-neutral anchors. The current delivery mock is EN only with multilingual feature explanation.
- T20 Language switch retains scene, sample/run, role, dataset and state. Account language is not silently changed. Sample IDs, evidence values, method codes and units do not change meaning.
- T21 Long translations, error messages and missing-key fallback remain readable. No raw translation keys. Locale-specific dates and decimal formatting do not alter stored measurements.
- T22 Light/dark, 1440/1024/736/390/320 widths and meeting browser zoom: no page overflow, clipped controls or guide covering its target. A dock replaces the spotlight when necessary.
- T23 Keyboard navigation, focus visibility, screen-reader labels/announcements and reduced motion work. Masked regions cannot receive accidental clicks; permitted highlighted controls remain operable. Modal guide focus trapping, if used, matches its semantics.
- T24 Notes and optional feature exploration pause playback. Notes are either outside the shared audience view or clearly shown as visible notes. No assumed privacy in a shared browser window.
- T25 Exit/restoration cleans timer, observers, event handlers, masks and transient route state. Dirty real forms are preserved and require the normal leave decision. Relaunch does not duplicate writes.

## Rehearsal and rollout checks

- T26 Fixture generation and resets operate on fresh rehearsal datasets only. All core commands are idempotent and evidence is read back. No fake histories, forged signatures, automatic live approvals or production database replacement.
- T27 Preflight produces current build/deployment IDs, scenario readiness and actual workflow test evidence; previously reported Workbench/order mismatches are checked on the chosen build. A failing route cannot be hidden by a mock overlay.
- T28 Rehearse the full show with actual presenter, intended screen resolution and clicker/browser. Aim at 3:00, allowing questions to pause. Test actual latency separately from the deterministic mock timer.
- T29 Prepare a clearly labelled offline/recorded fallback and practice switching to it. Do not pass recorded content off as live if the network fails.
- T30 After user preview approval, implement through reviewed commits/PR/CI and verified deployment. Tutorial flag rollback removes only the guide/entry. Test ordinary lab use with tour absent and confirm production data unchanged.

## Practical meeting run sheet

### Before the meeting

1. Obtain approval of this preview and final wording. Confirm the director's three-minute slot and English narration.
2. Rehearse the verified build and all five sample checkpoints in the isolated workspace. Verify the available language options, method names, records, receipts, equipment/stock and reports.
3. Ensure no real credentials, private notifications, real locations or personal information will be projected. Use the rehearsal-only session/profile and clean presentation data; do not change real account notification settings for the meeting.
4. Open the login start, keep the script outside the shared audience window, and prewarm permitted routes/files. Test the clicker/keyboard and projector font size.
5. Keep the labelled fallback and approved pilot closing statement ready.

### During the show

Follow the 12 scenes in presenter-script.md. Point to one area per scene. Explicitly call the preparation transition a demonstration checkpoint. Say SIS preview, unless a verified test receipt exists. At the last scene ask to agree the pilot lab/operators and success checks. If questions arise, pause and use More features.

### After the show

Confirm the pilot owner, participating operators, agreed scope, observation period, success criteria and issue-reporting route. Preserve the tested demonstration version for reproducibility. Reset only the isolated rehearsal session if needed. No automatic national data delivery, public report publishing or real sample cleanup follows the presentation.

## Pilot wording gate

Default: **“Our next step is controlled testing in a real laboratory.”**

Only after a recorded readiness sign-off: **“The platform is ready for controlled testing in the agreed laboratory environment.”**

Do not substitute “fully validated”, “production proven”, “all national connections live” or “zero issues.” The meeting is proposing a controlled pilot, not claiming that testing has already happened.
