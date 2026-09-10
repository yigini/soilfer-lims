Please continue the Help Centre task in LIMSI / LIMS Dev, working folder C:\Users\yigin\Documents\soilfer-lims. The user asked me to review readiness and authorize deployment only if ready. I reviewed f9e49f7 and reproduced concrete regressions, so the current all-resolved/certified claim is premature. You already have authorization to fix, push and deploy once the real release gates below pass; do not stop just to ask for deployment permission again. Read this complete review, also saved at WP/help-knowledge-base-v1/READINESS_REVIEW_f9e49f7.md. Preserve improvements and fix the actual remaining issues.

# Help Centre release readiness review — f9e49f7

10 September 2026. Workspace: C:\Users\yigin\Documents\soilfer-lims. Antigravity project LIMSI, chat LIMS Dev.

**Decision: continue corrections; f9e49f7 is not ready for the requested Help Centre launch.** The user authorizes implementation, GitHub updates and production deployment once the actual release checks pass. Do not pause simply to ask for that authorization again. This is a continuation of the existing review, not new scope.

Antigravity reports 647 passing server tests and a successful client build. These are useful but did not catch the client contract failures below. Its chat says production still runs 98b7e38 with no Help tables. That production state is reported by Antigravity, not independently verified by this review.

There is real progress: five translated collections now exist, new seeds no longer automatically publish, publication checks locale approval, full structured article fields can be edited, review endpoints persist transitions, and runtime sources moved into server/data/help. Preserve these improvements.

## 1. Actual reader pages are incompatible with the new shared service — P1

`client/src/services/helpClientService.js` now takes options objects and returns wrappers. Several consumers still use the previous contract:

- `FAQPage.jsx:32–36`: getArticles returns `{articles,isOffline,lastSync}`; Array.isArray(data) is false, so the FAQ always stores an empty list.
- `TopicExplorer.jsx:47–55`: getTopics(locale) should receive an options object; its `{topics,...}` response is treated as an array and `.find` throws. The article response is also treated as an array.
- `ArticleReader.jsx:40–43` and `ContextHelpDrawer.jsx:102–105`: getArticleById(id, locale) sends a string rather than `{locale,user}`; the request silently defaults to English and the component stores the wrapper instead of its article. Titles/steps disappear, and drawer full-article links use undefined IDs.
- `ContextHelpDrawer.jsx:72–75`: sends `blockers: activeBlockers`, but the service expects `blockerCodes`; the actual workbench blockers are discarded.
- `ArticleReader.jsx:57`: recordFeedback is called positionally, but now expects an object including articleId, revisionId, locale and useful. The request fields become undefined. Its catch also reports 'Feedback noted.' on failure.
- These reader components omit the authenticated user, so the offline service cannot consistently select the current scope. HelpCentre itself uses the new response contract correctly; audit every consumer, not only that page.

An isolated execution of the actual service with mocked network/storage, using the current call arguments and handlers, reproduced: FAQ [], topic `.find is not a function`, reader title undefined / requested locale en, context blockers undefined, and feedback fields undefined. This diagnostic touched no database or network. It is not a substitute for real React acceptance checks.

Fix all callers and their loading/error/not-found/offline state, pass the current identity and language, unwrap responses consistently, clear stale article data when routes change, and preserve feedback truthfulness. Verify the actual app journeys, including opening a guide from the drawer and switching language.

## 2. Docker still excludes the runtime Help assets — P1

`.dockerignore:19–23` excludes `server/data/*` and only exempts four existing JSON files. It has no exception for server/data/help. A .gitignore whitelist does not change Docker build context. Dockerfile copies server/; therefore moving data out of WP has not packaged it into the release image.

Correct the Docker ignore rules deliberately, including parent-directory traversal where required. Build a clean production image from the tested commit. Inspect that image for all five content files and route/category/synonym registries, then test draft seeding, approved fixture reading and nonempty contextual resolution inside that image using an isolated disposable database. Do not copy the entire WP folder or patch a running container as the packaging solution.

## 3. Offline fallback crosses scopes and ignores explicit access failures — P1

`client/src/services/offline/offlineDb.js:325–488` writes both scoped IDs and legacy direct IDs. List reads fall back to every direct-ID record if the requested scope is empty; single reads fall back to direct ID without verifying its lab or locale. Metadata falls back to the last `current` pack from any scope. There is no account partition. A different lab/account or a signed-out visitor can therefore be served a previous session's lab-local guidance. The preceding missing-user call sites make this easier to reach.

`helpClientService.js` also catches HTTP 401/403/404 like a transport outage. An isolated check confirmed an explicit 403 returns a cached article. Known access rejection or known withdrawal must not resurrect cached content.

Remove unsafe legacy fallbacks; migrate or invalidate old Help-only cache entries while preserving pending laboratory work. Bind authenticated caches to account, lab and locale; allow public/global fallback only from a separately authorized public collection. Reconcile withdrawals/revision changes, clear or deny access on sign-out/account changes, and treat explicit 401/403/404/410 as authoritative. Handle true network failure separately. Show truthful locale, revision and synchronization age. Do not promise instant revocation while fully disconnected.

`recordFeedback` currently returns offlineQueued:true without storing anything. Either persist an actual non-laboratory feedback queue with truthful sync state, or say feedback requires connection; never claim it was queued when discarded.

Acceptance: cache lab A including a local note, switch to lab B/account B and signed-out mode, switch locale, reload offline, receive a 403/withdrawal online, and prove no inappropriate content survives or appears. Test real IndexedDB, not merely the server pack's array shape.

## 4. Existing data upgrade and publication history still need correction — P1

`server/scripts/seed_help_content.cjs:138–156` only inserts missing locale rows. A database seeded by the previous implementation already has all five rows containing English, so adding translated JSON files will not upgrade those existing rows. Use a targeted, idempotent migration of identifiable unreviewed seed placeholders, preserving human edits and published revisions; create new revisions where required. Test both fresh setup and upgrade from the previous seed.

Lines 164–167 delete every publication whose publishedBy is system. Replace this broad history deletion with a targeted audited withdrawal/supersession that preserves publication history and affects only identified accidental seed publications.

`adminHelpController.js:566–599` still overwrites an active lab note immediately; the prior requirement for persisted note draft/review/publication is not resolved. Keep the previously agreed governance and audit behavior; do not replace it with an isActive toggle. Check real role/capability access and publication concurrency as requested in the first review.

The new seeder correctly creates zero publications. That is draft containment, not evidence of a usable launched Help Centre. Complete the authorized editorial workflow honestly. Never fabricate a human reviewer, scientific verification or translation approval, or bulk flag drafts approved to make launch checks green. If actual content review remains outstanding, report precisely which collection and languages await it; do not call the full launch complete or silently publish drafts. Technical deployment and approved-content availability are separate statuses.

## 5. Full multilingual administration and interface coverage remain incomplete — P2

Translation files on disk are a useful improvement, but new visible text remains hardcoded: FAQ categories/description/filter, topic/offline labels, drawer step/success/caution headings, support forms, editor controls and feedback messages. Current ArticleReader/TopicExplorer arguments also force English as described above. Key parity checks do not detect hardcoded text.

Complete the five-language UI and content acceptance from the agreed package, including localized search terms and empty/error states. The actual TranslationEditor still needs the planned Help content group/editor/review navigation; an icon import is not integration. Retain honest per-locale source/review status. Avoid unsupported claims such as 'verified scientific terminology' without the review evidence.

## 6. Support and mobile accessibility claims still need honest implementation — P2

The support flow now loads configuration and can open mailto, which is progress. `HelpCentre.jsx:149–150` still includes arbitrary supportText verbatim alongside 'Confidential tokens and passwords were excluded.' Remove that inaccurate assurance. Clearly show the exact recipient and message for review; say an email draft is opened, not that delivery succeeded. Handle unconfigured destinations and no-email-client/failed-open behavior honestly.

The mobile drawer declares aria-modal=true but declaration alone does not implement entry focus, a focus trap, background inertness and focus restoration. Verify those behaviors on the actual React dialog and support modal. Desktop help may remain a non-modal companion without stealing normal bench editing focus. Keep keyboard and screen-reader navigation practical.

## Evidence required before deployment

1. Add focused regressions for the failures above, then use the actual React pages with approved test fixtures in an isolated test environment: Help Centre → topic → article, FAQ filter, real workbench blocker → drawer → full article, language switching across all five languages, admin edit/review/publish, support and keyboard/mobile dialog behavior. Capture browser errors and screenshots of the implemented app, distinct from WP mockup results.
2. Run meaningful offline identity/locale/withdrawal tests and reject false feedback success. Test fresh and upgrade migrations with preservation of operational rows and values. Review query/permission/visibility behavior beyond count-only tests.
3. Build and test the exact production Docker image, including runtime assets. Run the appropriate regression suite and client build against the final corrected commit. Broad test counts cannot replace the failing journeys above.
4. Push the corrected implementation and evidence to GitHub. Update issue #92 to retract the premature 'all resolved/certified' statement; close only completed requirements. State outstanding human content review accurately.
5. Once these gates pass, proceed with the already-authorized established production release: verified recoverable backup, compatible additive migration, immutable image tied to the tested SHA, preserved rollback image, and read-only smoke checks against the live release. Preserve operational records and pending offline work. Do not use destructive reset/reseed or force-push shortcuts. Confirm GitHub SHA, live image/SHA, migration state, approved content/locale revisions, endpoint/reader checks and rollback readiness separately.

If a gate is not satisfied, keep correcting it and give the user a brief plain-English update: what works, what is being fixed and what remains. Ask only for truly missing editorial/domain decisions; do not ask again for deployment authorization already granted. Avoid 'certified', '100% ready' and 'zero issues' without corresponding evidence.


Please acknowledge these findings in simple friendly English and begin the corrections now. In particular, fix every Help service consumer and verify Docker packaging before considering this release ready. Provide actual React/API/image evidence, update issue #92 accurately, and then proceed through the authorized release when ready. Distinguish code deployed from content approved and available. Do not fabricate approval or review evidence.

End of readiness review for f9e49f7.