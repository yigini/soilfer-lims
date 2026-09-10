Please prioritize this code review before any Help Centre deployment. I checked commit 730cd4e against the agreed package and found concrete release blockers. Continue implementation now, but do not deploy the current incomplete Help build or publish the starter drafts. This is a correction of the existing authorized task, not a request to stop all work or seek approval again. Read WP/help-knowledge-base-v1/PROGRESS_REVIEW_2026-09-10.md in C:\Users\yigin\Documents\soilfer-lims, verify every finding, and address them with actual application/API tests.

# Help Centre implementation review — corrections required

Reviewed local commit **730cd4e**, 10 September 2026. Antigravity has implemented and committed the first version. Its chat reports tests and a GitHub push, and is currently checking deployment. This review did not independently verify production release state or rerun its entire test suite. The findings below are from the actual implementation, not the demonstration mockup.

**Decision: continue implementation and correction; do not release this Help implementation as complete yet.** Preserve the user's authorization for GitHub and deployment once the relevant release gates pass. Reopen/update issue #92 to reflect the remaining work. If a Help build is already live, establish the exact deployed commit and contain unreviewed Help publication through a scoped, audited correction; do not delete laboratory records or roll back unrelated fixes.

## 1. Unreviewed drafts are published, and publication has no approval gate — P1

`server/scripts/seed_help_content.cjs` creates English locale records with EDITORIAL_DRAFT, then immediately creates a current HelpPublication with approvedLocales ['en'] and publishedBy 'system'. The root publicationNote in content.en.json explicitly says nothing is approved. Reader/search/pack services select isCurrent publications, so these drafts become normal reader content.

`server/controllers/adminHelpController.js::publishArticleRevision` accepts approvedLocales from the caller (default ['en']) and swaps the publication pointer without checking the locale review status, source hash, required method review, or all five launch translations. `updateLocaleDraft` accepts APPROVED through the ordinary global editing endpoint and can change locale content belonging to an already published revision. That breaks immutable published guidance and permits approval without a dedicated review action.

Correct this at the server. Seed drafts without publications; provide authorized editorial preview separately. Add actual review/approval capabilities and persisted transitions, validate coherent approved locale/source revisions on publication, and reject edits to published bytes. Source changes create new revisions and invalidate dependent translation review. Make publication concurrency-safe. Add negative API tests for unreviewed publication, unapproved/mismatched locales, unauthorized review, editing a published revision and simultaneous publication. Do not fabricate reviewers or bulk mark drafts approved to make tests pass. Existing accidental seed publications need a targeted correction preserving history.

## 2. Admin review and complete editing remain partly simulated — P1

`client/src/pages/help/AdminHelpEditor.jsx::handleRequestReview` only changes React state and displays a submission success message; it sends no request. This is the same kind of misleading submit state the user wanted to eliminate from lab workflows. `handleSaveDraft` sends steps: [] and initially empty success/caution fields, while openEditor only populates summary and lab note. A small summary edit can therefore produce a revision that discards the guide's steps and other content. A saved laboratory note becomes active immediately rather than using an approved note publication flow.

Implement a complete structured article/translation editor with persisted draft and review transitions, current revision refresh after save, preserved unchanged fields, reviewer queues and authorized publication of lab notes. Display success only after the server confirms it. Integrate an actual Help content group in TranslationEditor; do not just reuse a HelpCircle icon. Allow people with the explicit assigned capabilities, rather than hardcoding a narrower role list in the component.

## 3. Five-language completion is still missing — P1 / launch requirement

The seeder copies English text into all five locale rows and labels four TRANSLATION_REQUIRED. No translated article collection is supplied by this implementation. Numerous new visible labels, support messages and editor text are also hardcoded English. Related article summaries and categories are returned in English. Matching translation-key counts is not full translation.

Complete en, es, es-419, fr and pt across articles, FAQs, search synonyms, contextual explanations, admin controls, captions/alt text and exports. Keep honest source-linked editorial/scientific review status. Complete the specialized guide backlog in RESEARCH_AND_AUDIT. English fallback is a recovery state, not acceptance of the requested multilingual Help Centre.

## 4. Claimed live blocker integration is not connected — P1

Repository search finds registerBlockers/clearBlockers only in `client/src/context/HelpContext.jsx`, with no consumer registering the selected work item's actual readiness blockers. ContextHelpDrawer can send activeBlockers, but the real workbench currently never supplies them. A server mapping test does not demonstrate that the technician sees the selected task's blocker.

Connect the workbench and relevant sample/task context to the existing server decision payload, including reset on route/selection change and safe unknown-code handling. Test two tasks with different blockers through the actual UI. Do not duplicate prerequisite calculations in Help.

`helpContentService.js::getContextHelp` assigns matchedArticleIds directly from the cached route registry and then unshifts blocker article IDs into that array. Copy the route array before adding request-specific recommendations. Verify a request with one blocker cannot contaminate a later user's context response without that blocker.

## 5. Offline downloading exists, but the readers are not wired and storage lacks scope — P1

`offlineDb.js` exposes getOfflineHelpArticles/getOfflineHelpArticle/getOfflineHelpMeta, but repository search finds no reader consumers. The Help pages and ContextHelpDrawer use Axios without offline fallback. `saveOfflineHelpPack` keys articles only by id; it has no account/lab/locale/revision partition and only upserts, so it cannot reconcile removed/withdrawn content. Work-pack download does not request the selected Help locale. Lab notes are included in pack content.

Connect actual offline readers and search through a shared Help repository. Partition authorized cache data, enforce session/lab access, reconcile publication sequence and removals, show locale/revision/last synchronization, and preserve pending lab work. Add tests for offline reload, user/lab switch, locale switch and learned withdrawal. Do not claim immediate revocation on a disconnected device.

## 6. Runtime depends on a planning directory absent from the Docker image — P1

`helpContentService.js::getRouteMap` and `seed_help_content.cjs` load WP/help-knowledge-base-v1 files at runtime. The current Dockerfile copies server and built client, but does not copy WP. In a clean image route context silently falls back to empty mappings and seeding cannot find its source. A local build does not validate this deployment.

Move approved runtime-owned registry/content assets into an intentional application location, or explicitly package only the required versioned assets. Preserve draft/publication separation. Build the actual production image and test migration, seed behavior and nonempty contextual results inside it. Do not copy the entire planning directory into production as a shortcut.

## 7. Public eligibility is inferred from a route mapping — P1

The seeder makes every article referenced by a public-or-error route PUBLIC. The route registry explicitly says those routes may receive only separately approved public excerpts, not automatic publication of full operational articles. Use explicit reviewed content visibility and scoped public collections. Ensure the public login/report Help journey works without redirecting a visitor into protected operational pages; the current Help reader routes all require authentication.

## 8. Support action is still a demonstration — P2

HelpCentre's support handler only changes local state; it does not load the configured support destination or produce a working review/send/contact flow. It also claims tokens, passwords and confidential results are excluded automatically, which its free-text form does not enforce. The support-config controller invents a generic IN_APP destination when none is configured.

Implement configured support contact management and an honest reviewed request workflow. Show unavailable/unconfigured state if no destination exists. Do not promise automatic removal of arbitrary confidential free text. Never send externally without the user's explicit send action.

## 9. Modal and test evidence require actual application verification — P2

ContextHelpDrawer declares aria-modal=true and obscures the background at every viewport, but does not implement focus entry/containment or background inertness. Use the established accessible modal primitive for narrow screens and the specified non-modal panel where appropriate on desktop. Verify keyboard, touch and screen reader behavior; preserve dirty input when opening/closing and reading articles.

The reported 15 interaction checks / 40 layouts exercise `WP/.../review-preview.html`, not the new React pages. `help_acceptance_criteria.test.js` asserts seeded publications exist, treats an array response as route coverage, and only compares operational row counts for no-mutation evidence. These do not validate the failed requirements above. Keep useful regression tests, correct assertions that endorse draft publication, and add actual API/browser acceptance coverage. Report mockup and production-implementation evidence separately.

## Release and communication

Continue useful implementation; do not stop merely to request the authorization already given. Keep deployment pending for this Help release until its correctness gates pass. Reconcile the user's production-status question with evidence: a pushed commit is not deployment. Use argument-array process calls or the established deployment scripts instead of fragile nested shell quotes when checking SSH/Docker. Do not bypass host verification or change security settings to solve quoting errors.

Give the user a simple progress table: completed, being corrected, remaining validation. Reopen/update GitHub issues based on these findings, push reviewed corrections, and close only the work actually completed. Confirm the exact live build/content revisions and remaining human review before saying the feature is ready for laboratory use.


Please acknowledge the publication/translation gaps in simple English, reopen or update GitHub issue #92, and continue the corrections. Keep useful implementation already completed. Report real React/API verification separately from the mockup checks, and do not repeat the complete/fully verified claim until the requirements pass.
