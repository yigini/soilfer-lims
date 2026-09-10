# SoilFER Help Centre and contextual help

Prepared 10 September 2026 for project LIMSI in `C:\Users\yigin\Documents\soilfer-lims`. This package contains a proposed design, article drafts and implementation instructions. It does not modify application code, publish guidance or send an Antigravity message.

## Outcome and boundaries

Give each user a clear answer to “What should I do here?” without losing their place or changing laboratory records. Add a searchable Help Centre, linked FAQs, article pages, contextual page help, accessible field guidance and a practical content-management area. One approved article revision supplies all these surfaces.

Preserve current desktop appearance and normal workflows. Reuse the signature `sf-*` tokens, current logo, localization, authentication, permissions, routing and mobile components. Add a modest consistent Help entry; do not redesign existing workbench/sample/dashboard layouts. Opening help is read-only and must not submit, acknowledge, approve, refresh, clear a draft or change a result. A bug must be fixed through the application's normal change process, not explained away in an FAQ.

## Verified source baseline

Audit SHA: `55117f23c387add2cb3a032ea8a66da3ab77a572`. Reconcile the current source before implementation; ongoing work may change it.

- App.jsx declares `/about` and operational routes but no `/help` or `/faq` route at this baseline. Current desktop Header and MobileHeader have no consistent Help entry.
- `components/common/InfoTooltip.jsx` opens only on mouse enter/leave, renders a small non-button icon and uses hardcoded dark presentation. Replace this behavior carefully with a shared accessible helper, retaining existing content and call sites.
- `docs/book/src/SUMMARY.md` already organizes a documentation book; `book.toml` sets English and enables search. `.github/workflows/deploy-docs.yml` builds it for GitHub Pages. This is a valuable source to reconcile, not a second content store to copy independently.
- Existing `docs/book/src/usage/sample-workflow.md` still instructs sample-page result entry and describes a simplified reception/status transition. `usage/spectral.md` makes concrete format and processing claims. Verify these against the current application and supported parser profiles before reuse. Do not publish them verbatim as established behavior.
- `workbenchReadinessService.js` exposes machine-readable blocker codes. `sampleWorkspaceService.js` also has human-readable blocker strings and capability information. Use stable codes/capabilities; never classify help by parsing English sentences or DOM labels.
- TranslationEditor and terminologyRegistry already support grouping, language and global/lab scope. Add a Help content group and article-centric review; do not flatten long articles into thousands of unrelated interface keys.
- SyncContext and `services/offline/*` now exist. Their presence is not proof of full offline readiness. Use capability/version evidence when documenting and downloading help; do not advertise planned native/offline features as delivered.

## Experience

### Entry points and routes

- Desktop shared header: visible `? Help` button in one stable location. Existing language/theme/profile controls retain their behavior.
- Phone: a labelled page-help action that fits the current compact header or page action area, plus Help Centre in More. Avoid adding enough icons to reintroduce header clipping. Keep placement consistent within each layout variation.
- Add `/help`, `/help/faq`, `/help/articles/:articleId` and `/help/topics/:topicId`. `/faq` redirects to `/help/faq` while retaining supported query/anchor state. Article identity is language-independent; translated titles can change without breaking links.
- Add a protected `/admin/help` management area. Authorize by explicit new content capabilities mapped server-side to existing roles/scopes. Do not reuse MANAGE_ANALYSES as a blanket article-publishing permission.
- Public login/report/about help receives only a small explicitly public collection. Authenticated operational guidance and lab-local notes must never enter a public bundle or search index. Public report help must not receive its access token in analytics, search or return URLs.

### Help Centre

Use a quiet limestone canvas, strong forest-green identity, readable working surfaces and small terracotta category accents. Header copy: “How can we help at the lab?” Search is the main action; no vanity metrics, giant feature banners or irrelevant charts.

Offer role-relevant quick starts and eight task categories: Getting started; Receiving samples; Working at the bench; Review & reports; Equipment & stock; Mobile & offline; Projects & connections; Managing the laboratory. A role preference changes recommendations only; access remains server-authorized. Keep general cross-role explanations accessible where appropriate so staff understand handoffs.

Below categories show the most useful questions and links to approved task guides. Display actual article counts only. Offer “Ask your lab” using configured contacts and “Report a problem” with review-before-send. Do not invent a support email, response time or live chat service.

### FAQs

A real searchable question list with topic filtering and shareable article/answer anchors. One concise answer first, then optional steps and a full guide link. Prefer one expanded answer on phones; preserve question position when closing. A keyboard-operable native disclosure or correctly labelled button controls expansion. Search results link to the same approved article revisions used by the FAQ; do not maintain separate answer text.

Initial questions reflect reported staff problems: blocked analyses, drying/preparation, saved versus submitted, texture panels, original spectra, returned/approved results, project location, field versus physical receipt, device saves and failed page loads. Search synonyms include everyday terms, supported method names and stable codes, without displaying raw codes as primary titles.

### Article reader

Readable 60–75-character line length, breadcrumb, title, one-sentence answer, audience, estimated reading time, visible content status, prerequisites when needed, numbered steps, what success looks like, relevant precautions and related articles. Show actual owner, verified application/method revision and review date after approval. Do not fabricate “reviewed today” badges.

Link controlled SOPs by document ID/revision with existing access rules. Keep guidance separate from scientific authority: article edits cannot change acceptance limits, mandatory workflow gates, calculations or report semantics. If an SOP or enabled feature is unavailable, explain that state and provide the authorized next step.

Provide print and copy-link actions; printed/exported articles carry locale, revision, review date and scope. Copy links without sample IDs, auth tokens or transient form state unless an explicitly authorized resource link is required. Contextual entity links use current scoped navigation, never unchecked external URLs.

### Help with this page

Desktop opens a non-modal side panel when space allows; on narrow screens use an accessible full-height modal or dedicated help view preserving underlying form state. The shared help provider must sit above route-specific remount boundaries. It does not own or reset the form.

Panel order: current page/task heading; actual blocker explanation if available; three to five useful articles; glossary/SOP links; search-all/help contact. A selected article can open inside the panel. Provide Back and Close, restore focus to the invoking button, and retain the user's scroll and input.

Use the route registry plus a small typed context: feature key, section, work-item category, capability IDs and blocker codes. Do not send result values or patient/person data merely to recommend an article. Unknown states get generic task help and support, not an invented explanation. If only a localized human message is available, render it safely as supplied and avoid inferring a code from its wording. Any additive server help code must preserve existing payload compatibility and not change decision logic.

### Field help and guided practice

Essential instructions—units, required fields, accepted format, constraint failures—remain visible beside the field. Secondary explanations can use a focus/tap/hover popover with a labelled trigger, Escape dismissal and viewport collision handling. Avoid a question mark beside every obvious label.

Practice tours are optional and task-specific. Reuse a current supported tutorial mechanism only after inspecting it; the prior director demo is not operator training. Use a sandbox/demo dataset and persistent “Practice” marking. A tour must never automatically click Receive, Confirm, Submit, Approve, Delete or external delivery on a live sample. Stale or absent targets skip gracefully and leave the page usable.

## Architecture and content integration

Build HelpProvider, HelpButton, ContextHelpPanel, HelpSearch, HelpArticle, FAQList, HelpTopic and HelpEditor around one help service. Names are proposals; reuse equivalent current primitives instead of installing a second UI kit. Scope all styling to existing tokens and help components.

Server service selects an immutable approved article revision for requested locale, audience, lab and enabled release capabilities. It assembles approved global guidance with separately labelled authorized lab notes, not an uncontrolled replacement of mandatory scientific text. Search, panels, exports and download packs use the same selection rule.

Use additive content tables or an existing suitable document service after inspection. Never migrate operational sample/result records for help. See CONTENT_CONTRACT.md for versioning, permissions, endpoint proposals and reconciliation with the existing book.

The seed is deliberately an English editorial draft. Every article must be behavior-verified and translated/reviewed in en, es, es-419, fr and pt before it is included in the full five-language launch collection. `ui-copy.json` supplies proposed interface wording for all five; article translation is a separate content workflow with visible gaps. Do not convert draft status to Published in a seed script or silently claim a fully translated Help Centre.

## Mobile and offline

Bundle a minimal non-sensitive help shell and recovery guide independently of optional lazy page modules, so a route-load error can still offer assistance. Do not auto-refresh a user with unknown/unsaved work. Handle network errors and mixed release assets through the separate deployment reliability work; Help is not a substitute for that fix.

Download approved, scoped, versioned help with selected work packs using the existing offline repository where appropriate. Include required text, glossary, SOP references and essential images; show unavailable external documents explicitly. Local search must work on the downloaded collection. Label Last synchronized and revision; do not show stale instructions as current after an article withdrawal is learned.

Keep account/lab isolation, logout locks, quota and update behavior consistent with the offline contract. Public help can use a public cache; authenticated lab notes must not be blanket-cached by URL. Help downloads never evict unsent laboratory work. An outdated translation or app-incompatible guide must carry a visible status and a safe escalation path.

## Implementation sequence

1. Inventory current routes, embedded controls and role capabilities. Reconcile old documentation against actual behavior and assign editorial/scientific owners. Capture desktop/mobile baselines.
2. Add the content revision service, seeded drafts and Help Centre/article/FAQ routes. Implement server scope filtering and sanitization before exposing editors or search.
3. Add contextual Help buttons/provider, route registry and read-only blocker mappings. Preserve form state and desktop layout. Replace hover-only tooltip behavior with targeted regression checks.
4. Add the article/language editor, review and atomic publication, approved lab notes, search and configured support workflow. Integrate with existing terminology groups and SOP references.
5. Complete every launch article in five languages and verify role-specific instructions against a test lab. Migrate/link approved book chapters from the same canonical export so they cannot drift independently.
6. Verify offline help, phone/tablet, accessibility, light/graphite, errors and old/new release compatibility. Pilot with reception, a technician and a manager using real task questions.
7. Use the user's implementation/release authorization when subsequently handed off. Commit reviewed changes, run CI and staged migration/rollback checks, deploy the exact tested version and verify it. No application implementation or sending is initiated by this planning package.

## Definition of done

Every operational route and important embedded control has a mapped, permission-correct help entry. FAQs and articles agree. Five-language launch content has explicit review evidence. Help never changes laboratory state, loses an edit, hides a required action or leaks local instructions across labs. Admins can maintain guidance without editing application code. Desktop/mobile and content/API regression tests pass, and unresolved limitations remain visible.
