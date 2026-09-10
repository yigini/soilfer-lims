# Content, publication and access contract

All types, endpoint names and capabilities below are proposals to reconcile with current services. The prototype is not a backend or authorization implementation.

## One approved source

One stable `articleId` owns revisions and translated variants. FAQ answers, search snippets, page panels, article pages, printed guidance and the operational documentation export select from the same immutable approved revision. Keep build/deployment manuals in docs/book where they belong; reconcile overlapping operational chapters and export/link them from the canonical help source. GitHub is a review/export channel, not an independent competing live article editor.

Do not expose a raw editing endpoint publicly. Support server-side search and offline prefiltered indexes rather than embedding all drafts, global admin material and every lab's local notes into a frontend bundle.

## Proposed records

| Record | Minimum fields and constraints |
|---|---|
| HelpArticle | Stable id, canonical topic, type, owner, audience metadata, visibility class PUBLIC/AUTHENTICATED/RESTRICTED, feature requirements, tags, createdBy, archivedAt. Audience recommendations are distinct from access constraints. |
| HelpRevision | Article id, immutable revision id/number, base revision, structured body, source locale/hash, applicability to app capability/version, scientific/SOP references, change reason, author, creation time. |
| HelpLocaleRevision | Revision id + locale, translated title/summary/blocks/search synonyms, source hash, translation review state, translator/reviewer, timestamps. Locale states cannot be inferred from nonempty strings. |
| HelpPublication | Scoped pointer to approved revision and approved locale variants, publication sequence, effective time, reviewDue, approvers, superseded/withdrawn state. Update pointer atomically; retain history. |
| HelpLabNote | Separate article/revision reference, lab id, structured local procedure/contact note, approver, current/SOP applicability. Clearly labelled as local; cannot silently replace mandatory global scientific guidance. |
| HelpFeedback | Article/revision/locale, useful yes/no, issue category, optional redacted comment, actor/scope policy, deduplication and retention. No arbitrary result payloads. |
| HelpSupportConfig | Lab-scoped contact method, responsible team, optional verified availability, allowed submission mechanism. No invented institutional address or SLA. |

Body blocks: paragraph, ordered steps, definition list, caution, approved image with alt text, related-article link, controlled SOP reference and read-only app link. Validate a restricted schema. No executable MDX, inline script/style, arbitrary iframe or unsanitized HTML. Sanitize titles, snippets, imported Markdown, pasted content, notes and link destinations server-side and at render boundaries. Store uploaded images/documents with scoped authorization, MIME/size checks, no tokens embedded in links, and explicit retention.

## Capabilities and scopes

Proposed capability names: HELP_READ, HELP_EDIT_GLOBAL, HELP_EDIT_LAB, HELP_REVIEW_TRANSLATION, HELP_REVIEW_SCIENTIFIC, HELP_PUBLISH_GLOBAL, HELP_PUBLISH_LAB. Integrate with existing server-side permission and lab-scope enforcement; names do not exist merely because they are listed here.

- All authenticated users may read the permitted operational collection; general public users receive only explicitly public support/login guides.
- SUPER_ADMIN is eligible for global editorial administration under configured policy. Do not make every administrator a scientific reviewer by assumption.
- LAB_MANAGER may be granted local guidance/contact editing and appropriate review for their lab. Local scope must be enforced in mutation, search, export, history, attachment and offline-pack endpoints.
- Subject specialists and translation reviewers require explicit capability assignments. A role picker in the Help Centre changes recommendations, never authorization or publication authority.
- Technicians/reception/project users can give feedback or prepare support requests within scope; feedback cannot edit authoritative articles.
- Scientific guidance and significant SOP changes require designated method/quality review. A person without the required capability cannot publish by calling the API directly. Apply the lab's actual separation-of-duties policy; do not invent a universal two-person requirement for every spelling fix.

## Publication and translation

Draft → In review → Approved → Published → Superseded/Withdrawn. Rejection returns a revision for correction with a reason. Editing a published article creates a new draft; it does not rewrite the published bytes. Optimistic concurrency prevents two editors silently overwriting changes. Publishing is a distinct reviewed mutation with server validation and an audit record.

Source edits mark dependent translations as requiring review against the new source hash. Keep the previous coherent approved release available until its replacement is ready, unless it is withdrawn for correctness. Never mix a new English body with an old translated warning while presenting them as one reviewed revision.

Launch requirement: the agreed starter collection is complete and reviewed in en, es, es-419, fr and pt. For later optional articles, publication policy may permit an explicitly labelled English fallback. A missing/stale translation must be visible in the editor and reader; do not count it as translated. Preserve a distinct es-419 review even where text matches es. Search normalizes accents and includes verified locale-specific synonyms without changing scientific identifiers or units.

The existing TranslationEditor should have a Help content group linking into the article editor: topic, article, locale, scope and needs-review status. Interface keys remain in the existing translation catalogue; long content stays in structured article records. Do not duplicate every article block in both stores. Generate interface identifiers from `ui-copy.json` into the project's naming convention during implementation.

## Read/search/context API proposals

- `GET /api/help/topics`: authorized topic summaries and actual eligible article counts.
- `GET /api/help/articles/:id?locale=...`: selected approved revision, locale/fallback status, applicability, permitted local note and related IDs. Do not accept a client lab id as authority.
- `GET /api/help/search?q=...&topic=...&locale=...`: search only authorized approved compatible content. Escape input/output, cap query length, paginate; do not leak restricted titles in counts/autocomplete.
- `GET /api/help/context?pageKey=...&section=...`: static route mapping resolved to permitted articles. The local UI can additionally map existing server blocker codes; no result payload is needed for this request.
- `POST /api/help/feedback`: explicit user feedback with CSRF/auth/rate-limiting as applicable, review-before-send for free text/attachments. Feedback is not automatically a message to an external person.
- `POST /api/admin/help/articles/:id/revisions`, revision update with expected version, submit-review, approve-locale and publish endpoints: scoped, authorized, audited and idempotent where appropriate.
- `GET /api/help/pack`: server-filtered manifest, revision/locale hashes and deletion/withdrawal markers for offline help; apply current account/lab policy.

Names and shape should conform to existing conventions. Do not create separate article state in every page. Public endpoints and browser caches must never vary invisibly on a user's private scope.

## Context mapping and safe links

Route match order uses specific routes before generic `/samples/:id` or wildcard; sanitize enum-like section keys and allowlisted return paths. New entities are read from current scoped application state, not interpolated from untrusted article HTML.

The companion route registry maps page keys to article IDs, and observed blocker codes to explanatory articles. It does not calculate readiness. Do not infer a new rule such as “all methods require drying” from generic copy; the actual method configuration, dependencies and server decision are authoritative. If a capability or unsupported API is absent, give general guidance and keep the live error visible.

Help links to Workbench, sample context or SOPs are navigation only. They must not complete a task, approve a record, download protected data automatically or send email on opening. Handle dirty forms with the application's established preservation/navigation guard.

## Search and support operations

Prioritize exact title/known synonym matches, then article summary/body. Show a result snippet and topic, with a useful zero-results state. Search term logs can contain identifiers or private information: prefer aggregate categories, or redact and cap retention with explicit admin configuration. Do not store full raw query trails by default.

Report a problem starts a draft. Prefill only safe page key/build/error code; omit tokens, URL query strings, form values and record contents. Let the user review destination, message and any attachments before submission. Respect configured contact methods and existing messaging permissions; never automatically send to an institutional address found in old documentation.

## Recovery and offline

Scope downloaded help per account/lab and approved publication sequence. Help must open when a feature chunk fails, using a small independently available recovery surface. A recovery article may suggest a normal refresh only after checking unsaved work; never automatically clear caches/storage or force reload.

On source publication, publish text and index together; on withdrawal remove the article from search/context and mark cached copies as withdrawn once the device learns it. A disconnected device cannot learn changes immediately: show last synchronization/revision and apply the lab's policy for stale controlled instructions. Do not claim instant offline revocation.

Never evict unsynchronized laboratory data to make room for help. Queue content edits offline only if an explicit safe editor-draft mechanism exists; authoritative publication remains online. Preserve old/new app compatibility and reviewed documentation links across deployments.
