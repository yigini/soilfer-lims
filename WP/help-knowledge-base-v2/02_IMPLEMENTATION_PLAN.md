# Complete Help & Lab Guide implementation plan

## 1. Outcome and boundaries

Build a useful operator manual within the existing LIMS. A person should be able to finish their permitted task with the guide alone, understand what the application has saved, and know the next responsible person. The home page should be useful within its first screen. Long articles should remain easy to scan and work through.

This plan covers reader UI, contextual guidance, role training, full content, search, five languages, content administration, offline reading, compatibility and ongoing maintenance. It does not authorize redesigning result entry, changing calculations, weakening approval rules, creating automatic laboratory actions or replacing desktop navigation. Log actual workflow defects separately with reproducible evidence.

Use the existing application components, theme preferences, language preference and authorization mechanisms. Desktop and mobile must display the same approved content and relevant actions. Introduce no second account, separate support login or unrelated content SaaS without a demonstrated need.

## 2. Information architecture

Retain `/help` as the stable entry point. Provide:

- **My tasks**: prioritized how-to guides for the current role; the default page.
- **Solve a problem**: symptoms and decision paths, including status contradictions.
- **Learn the workflow**: role learning paths with safe examples.
- **Browse the guide**: all permitted subjects, a compact contents tree and reference search.
- **Contact support**: configured contacts with a reviewable request draft.

Keep `/help/articles/:id`, `/help/topics/:topicId`, `/help/faq` and `/faq` links working. Add `/help/learn/:pathId`, `/help/troubleshoot/:flowId`, `/help/reference/:id` only where needed; all content still resolves through one publication model. Old article IDs either remain canonical or redirect to an explicitly mapped successor and section. Do not redirect every old URL to home.

Organize the complete library by real work: getting started; intake; sample identity and tracking; preparation; bench and result entry; analytical methods and spectra; review and reporting; equipment and stock; mobile and offline; projects/field/SIS; management and configuration; quality and audit. Role views reuse these subjects rather than duplicating text.

## 3. Screen-by-screen specification

### A. Signed-in home

Use the real LIMS shell. Keep account/lab/language/help/return navigation visible. Replace the large hero with a short title and a search field labeled **Search tasks, questions or messages**. Under it show the current role in plain language, with an optional **Explore another role** reader filter. That filter must never impersonate another user or grant permissions.

Show at most three primary tasks for that role, written as verbs. A technician gets **Record results for a batch**, **Finish drying or preparation**, **Resolve blocked work**. A reception officer gets **Receive project samples**, **Resume an intake draft**, **Resolve an identity or location mismatch**. A manager gets **Assign laboratory work**, **Review submitted results**, **Resolve approval blockers**.

Below this, show a compact “Something went wrong?” list of recognizable symptoms and one learning path. Keep the full subject list in the contents area. No fake popularity, made-up completion counts, generic “live” badges or unreadable grids of tiny cards. Recently viewed guides may be shown from actual local reading history with a clear reset option, but never use sample identities as article labels.

### B. Article reader

Three regions on a wide desktop: library navigation, a readable article column and **On this page**. At narrower desktop widths remove the right rail and place a collapsed contents disclosure above the article. On mobile, show only the article with a contents button and a clear return link.

Article order:

1. Breadcrumb, task title, one-sentence outcome and relevant role/method context.
2. **Quick answer**: the shortest complete answer, including the exact finishing action.
3. **Before you start**: prerequisites, needed records/materials, connection requirements and permission.
4. **Steps**: exact location/control/action, a relevant illustration and what should happen.
5. **Check that it worked**: evidence, resulting state, where the receipt appears and who acts next.
6. **If something is different**: common failures and recoveries with links to the relevant branch.
7. Related reference/SOP, actual version/review information and focused feedback.

For longer procedures, divide into short phases such as Prepare / Enter / Check / Send. Do not hide all instructions behind accordions. Use disclosures for optional detail, not essential steps. Checkboxes in a “Follow along” view track reading progress only and say so; they never complete laboratory checklist items.

Use **Open Workbench** or equivalent as navigation, not as a command that enters values or changes state. Preserve the originating route and unsaved work. If leaving the current view would lose work, reuse the application's existing protection. On mobile, **Return to work** should restore the same task and scroll location where feasible.

### C. Contextual Help beside real work

Retain a consistent shared Help entry. Add small field-level help only when essential terms/rules need explanation; avoid putting a question mark next to every label. On a page, Help opens **About this task**, **Do this next**, and **If you are blocked**, prioritized from current route/tab/control and authoritative blocker codes.

The drawer uses the same article's quick answer and relevant section. Show no more than three immediate recommendations before **Browse related guidance**. If a current blocker exists, explain cause, permitted next action, responsible role and evidence of recovery. Do not recompute readiness in Help or infer backend states from English text.

Desktop: non-modal companion, with the worksheet still operable and its values preserved. Mobile: accessible full-height sheet with focus containment, background handling, close/return action and no unintentional overlay on editing controls. Opening Help must not remount or reset a worksheet, save a result, submit a sample or clear an offline queue.

Distinguish guide unavailable, pending publication, permission-limited guidance, offline pack missing and request failure. An authenticated editor can see a link to the relevant content task. Ordinary readers receive a useful permitted fallback and contact route. Never expose unpublished/private titles to unauthorized users.

### D. Problem solver

Start with familiar symptoms: **My task is missing**, **Preparation still says incomplete**, **I saved a value but the manager cannot see it**, **Some pasted rows were excluded**, **My spectrum does not match a sample**, **The approval button is disabled**, **My phone has not synchronized**.

Each decision path asks one observable question at a time. Answers include “I cannot tell” and return/back. Use real state signals when supplied by the application; distinguish those from the user's manual answers. Show a concise explanation, next action, who can do it and where to verify success. Never give untrusted text executable meaning or implement a free-form autonomous support agent.

A path cannot end only with “contact admin.” It must say which role, why, what exact evidence to provide and how to preserve work. Do not recommend browser-storage deletion, new duplicate tasks, bypassing preparation, or editing an approved result directly.

### E. Learning paths

Provide a first-shift path for technicians, intake officers and managers, and shorter paths for the remaining roles. Each path is a sequence of existing guides plus a small sandbox exercise using synthetic records. Make the training label persist on every screen. Separate “I read this” from training competency; do not issue certification or mark production tasks complete.

The flagship training story follows five synthetic project samples from expected field records through receipt, preparation, measurements, review and report. A second story follows forty same-method determinations in a batch, with two deliberately excluded rows and a repeat. Quantities and values are illustrations, not recommended method limits. Students should practice recognizing full versus partial submission and a queued offline action versus a confirmed server event.

Role switching in the training example changes the explanation, not the signed-in account. A lesson references only functions available in the deployed release or is clearly labeled as a future, unavailable feature and excluded from production task guidance.

### F. FAQ and reference

FAQ is a symptom/title index with a short answer and **Read the steps** into the canonical guide section. Group by the task stage and allow a simple filter. Do not copy whole articles into a second independently editable store.

Reference pages include state definitions, identification fields, laboratory versus field IDs, units and result qualifiers, task/result/report relationships, method-specific input contracts, glossary, data ownership and role capabilities. A reference must explain “what this means” and link to the relevant “how to” without reprinting the whole procedure.

### G. Content studio

Within `/admin/help`, offer clear tabs: **Articles**, **Review**, **Translations**, **Coverage**, **Feedback**, **Local guidance**, **Releases**. Most work is an article list with task title, owning subject, source version, per-language status and a concrete next action. No wall of invented metrics.

The editor has structured blocks, inline preview and side-by-side source/translation. Authors can insert exact UI-label references, a field table, an annotated image, a troubleshooting branch or an example. Retain undo/draft recovery and server concurrency checking. Uploads need validation, permission checks and versioned metadata. Never silently discard existing steps on save.

Review compares the changed blocks and affected figures/locales. Product-use verification and scientific SOP review are separate, honestly attributed records. Ordinary application help must not be held indefinitely for a scientist's signature; genuinely scientific claims need a real source and qualified review. Do not invent reviewers or transform a generic owner label into a completed review.

Coverage lists real routes/tabs/controls and their current published guidance, not just whether any article ID was mapped. Editors see missing bodies, stale UI bindings, untranslated blocks, unavailable screenshots and broken links. Releases preview exactly which revisions/locales will become public or authenticated. Publish atomically, preserve history, and show where to verify the reader result.

Lab managers can create appropriately scoped local instructions and contacts under existing permissions. Make local guidance visually distinct from shared instructions, effective-dated, attributable and revisioned. A local note must not overwrite shared method limits or alter calculations.

## 4. All-role coverage

| Application role | Main reader journey | Specific content that must exist |
|---|---|---|
| LAB_TECHNICIAN | Find assigned work → prepare → enter/import → record → submit → resolve returns | Single/batch work, operational receipts, method-specific inputs, quality controls, repeats, online/offline save meanings. |
| SAMPLE_RECEPTION | Match arriving material → assess → select analyses → hand over | Expected versus received, project provenance, location, mass/condition exceptions, drafts, labels and duplicates. |
| LAB_MANAGER | Review intake → assign → supervise → review submissions → release | Dependencies, workload, reviewer decisions, acceptance versus report release, amendments and discrepancy handling. |
| AUDIT_USER | Inspect evidence and history without altering work | Audit filters, result lineage, QC/nonconformance, report revision, read-only export scope. |
| PROJECT_MANAGER | Follow project material and results | KoBo source versus physical receipt, lab progress, project filters, reports and permitted exports. |
| MASTER_USER | Oversee permitted laboratories | Cross-lab scope, comparable status counts, national/project views, configuration boundaries and escalation. |
| SUPER_ADMIN | Configure and maintain the platform | Labs/users/permissions, analysis catalogue and method schema, translations, feature/integration setup, audit and Help publishing. |
| SURVEYOR | Establish and inspect field provenance | Source record identifiers, synchronization state, correcting field information through the proper owner, handover to intake. |
| EXTERNAL_VIEWER | Read authorized shared outputs | Shared report validity, sample/result scope, language, interpretation boundaries and requesting a correction. |
| VIEWER | Navigate permitted read-only records | Search/filter, status understanding, reports/downloads and why editing is unavailable. |

The actual capability response remains authoritative. A user with multiple roles gets useful recommendations without duplicated libraries. No article should say “all managers can…” when a permission, lab scope or feature flag controls it.

## 5. Content production, not just page construction

Use the inventory as commissioned work. Every brief names a distinct job, sources to inspect and the example/failure case that must be written. Merging overlapping briefs is allowed only if their coverage and deep links remain explicit. Splitting a complex guide into smaller task chapters is encouraged. Do not manufacture articles to hit a count.

Write the full English source and validate it against representative application states before translating. For each article collect the exact controls, required fields, backend state outcome, screenshots of synthetic data and an observed recovery case. Write concise blocks first; add optional reference where needed. The full-guide examples define the quality bar, not a fixed word quota.

Commission missing content for all enabled catalogue result families: numerical/qualifier results; multi-output panels such as texture; calculated/derived results; checklist operations; file/spectral acquisition; categorical/text fields; repeat/reference/QC work. Discover the actual catalogue and method overrides; do not infer input behavior from an analysis code alone. A parameter name is a display label, while its stable scientific identifier remains unchanged.

For method articles distinguish software entry requirements from laboratory SOP parameters. Reference the configured method/SOP revision for preparation, measurement, limits, units and QC. Explain the difference between observed, derived and predicted results. Do not substitute a generic internet method for the lab's configured procedure.

## 6. Visual system

Use the SoilFER logo already in the repository. Choose warm neutral light surfaces, readable near-black text, restrained soil-green navigation accents and ochre for genuine attention states. Graphite uses charcoal surfaces with clear contrast, never near-black everywhere. Role/state meaning is conveyed in text as well as color. Reuse existing theme tokens and user preference behavior.

Article body: approximately 16–18 px on desktop, comfortable line spacing, roughly 65–78 characters per line. Mobile body and inputs at least 16 px; touch targets about 44 px. Avoid small uppercase paragraphs, monospace prose, gratuitous gradients, giant empty hero space and too many bordered tiles. Use white space and headings to organize reading.

Illustrations should show the exact part of the actual app needed for a step, with numbered labels and adjacent accessible text. Keep sample IDs synthetic and stable across the training story. Do not crop away the context needed to identify the right page. A screenshot is versioned evidence and learning material, not a decorative background. Add text transcripts for any short demonstration video, with no automatic playback.

## 7. Implementation work packages and exit criteria

| Work package | Concrete work | Exit evidence |
|---|---|---|
| A — Baseline and content evidence | Inventory routes/tabs/roles/input schemas; inspect v1 content, release and offline pack; identify stale instructions. | Traceability report, keep/replace/merge decisions, working representative task fixtures. |
| B — Content foundation | Rich block schema, legacy adapter, versioned assets, UI bindings, article migration, publication selector and five-locale editor. | Existing published articles still render; no destructive reseed; review/publish/rollback tests pass. |
| C — First complete reader journey | New shell/home/article/contents/search plus technician batch and drying guides. | User can follow both examples; context Help preserves entered values; phone and desktop usable. |
| D — Problems and role paths | Decision trees, learning paths, role recommendations, reference/FAQ indexes. | Each configured role has a useful first page; no action grants permission or mutates lab work. |
| E — Full content collection | Write remaining briefs, figures, field tables and failures; verify enabled method families and integrations. | Content coverage and factual checks completed; no skeleton pages or generic placeholders counted as finished. |
| F — Languages, offline and editorial operations | Translate all blocks/figures/labels, terminology review, accessible reading, scoped offline packs and feedback workflow. | Five-language parity and real offline/account-switch tests; editor can release a reviewed collection. |
| G — Acceptance and content release | Task-based user sessions, final image and migration testing, manifest publication, release/rollback checks. | Actual useful articles available on the tested routes and languages; live smoke evidence and truthful remaining limitations. |

These are dependency-based stages, not a promise of a one-day rewrite. Deliver representative finished journeys early for design review, then expand systematically. A stage with screenshots but unwritten content is not complete.

## 8. Integration ownership

Reader components and `helpClientService` share a documented response contract. `helpContentService` owns authorized content selection. `HelpContext` receives safe page/task context and current blocker codes. Each operational feature registers stable `helpContextId` and `uiKey` bindings without moving workflow logic into Help. The analysis catalogue supplies names/input schema; offline services supply connection/cache/sync information; the editor supplies published revisions.

Use a documented route registry, including tab query parameters and aliases. Do not read arbitrary URL tokens into Help search or support payloads. Dynamic sample/report identifiers must not appear in public links, analytics or search queries. See the technical contract for schemas and defensive behavior.

## 9. Maintenance after launch

Each change to a bound operational component or catalogue schema creates a content impact check. Flag affected steps/images/translations for review; continue serving a known-compatible published revision unless it is unsafe or withdrawn. Give editors an actual action list, not auto-generated “health” scores.

Make unresolved feedback actionable: wrong steps, missing instruction, unclear wording, outdated screenshot, wrong language, cannot find my task. Associate feedback with article/revision/locale and sanitized context. Do not collect result values or raw identifiers by default. A decline in failed searches is useful only when measured from real, privacy-conscious events; do not invent usage statistics in the design.
