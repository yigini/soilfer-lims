# Technical integration and content contract

## Source of truth and compatibility

Keep HelpArticle identity, existing links, revisions, locales, publications, feedback and lab-note history. Add richer blocks and metadata through a non-destructive migration. Provide a `legacyStepsToBlocks` adapter so already-published v1 text still renders until replaced. Never overwrite a published revision or infer current content from “latest draft.”

One publication selector supplies home recommendations, lists, article reader, contextual help, search, related links, PDF/print and offline packs. It must enforce publication membership, approved locale, public/authenticated/lab scope, compatibility and withdrawal consistently. An article's generic role category is a relevance attribute, not permission to perform its actions.

## Proposed revision contract

```ts
type GuideRevision = {
  articleId: string; revision: number; schemaVersion: 2;
  kind: 'task'|'problem'|'learning'|'reference'|'explanation';
  topicId: string; title: string; summary: string; quickAnswer: Block[];
  audiences: string[]; capabilityRefs: string[]; featureRefs: string[];
  methodSchemaRefs: string[]; contextBindings: ContextBinding[];
  beforeStart: Block[]; sections: Section[]; success: Block[];
  nextActor?: string; related: {articleId:string; sectionId?:string}[];
  verification: {build:string; sourceRefs:string[]; evidenceRefs:string[];
    checkedAt:string; actor:string; reviewType:'application'|'scientific'|'language'}[];
  locales: LocaleRevision[]; figures: FigureRevision[];
};
type Block =
  | {id:string; type:'paragraph'; text:string}
  | {id:string; type:'step'; uiKey?:string; instruction:string;
      expected:string; when?:string; figureId?:string}
  | {id:string; type:'fieldTable'; rows:FieldRow[]}
  | {id:string; type:'example'; label:string; text:string; synthetic:true}
  | {id:string; type:'notice'; severity:'info'|'attention'; text:string}
  | {id:string; type:'decision'; flowId:string}
  | {id:string; type:'sopLink'; methodId:string; revisionRef:string};
```

Schemas are illustrative; adapt to the repository's conventions. Preserve stable IDs when translating/reordering blocks. Validate maximum lengths, allowed types, references and sanitization. Do not accept executable HTML, arbitrary scripts, unchecked external URLs or raw SQL in content. Control names are resolved through a limited UI-key registry with a reviewed fallback, not arbitrary code execution.

A FigureRevision includes media ID, content hash, dimensions, alt/caption per locale, capture build, synthetic-data assertion, step bindings and accessibility text equivalent. Keep server and downloaded assets scoped with their article. Limit file sizes and validate MIME/signature; do not serve user-supplied executable content inline.

## Context binding

```ts
type ContextBinding = {
  contextId: string; routePattern: string;
  tab?: string; controlId?: string; blockerCode?: string;
  articleId: string; sectionId?: string;
  priority: number; relevanceRoles?: string[];
};
type HelpContextRequest = {
  route: string; tab?: string; contextId?: string; controlId?: string;
  blockerCodes: string[]; locale: string;
};
```

Server derives authenticated scope/capabilities; never trust a role or lab supplied solely by the browser. Normalize known route aliases and permitted tab values. Match a control/blocker first, then tab/task, page and finally a useful permitted generic recovery. Do not use a wildcard generic guide to count a specialized screen as covered. URLs with sample IDs, share tokens, coordinates or free-text parameters are normalized before Help requests and analytics.

Add stable `data-help-id` or component registry bindings at operational UI boundaries. They are explanatory integration only and must not own workflow transitions. `HelpContext` may receive existing readiness/capability outcomes and pass their stable reason codes. Do not derive eligibility from captions or cache an old selection's blocker for a new work item. Clear scoped context on navigation and task switch.

Follow mode never clicks the production UI, checks a physical checklist, sets a value, marks a work item complete, or submits/reviews records. It may highlight a bound control and explain it; highlighting must survive responsive layouts without obstructing touch targets. If a binding is absent on the current build, show the step text with a version mismatch note and file a content issue rather than guessing another control.

## Consistent client response

Return a wrapper with stable properties from every service call and update every caller in one change. For example:

```json
{
  "success": true,
  "availability": "AVAILABLE",
  "articles": [],
  "context": {"contextId":"workbench.worksheet"},
  "contentRelease": "help-2026-09-v2",
  "requestedLocale": "fr",
  "servedLocale": "fr",
  "isOffline": false,
  "lastSynchronizedAt": null
}
```

Use typed runtime validation or shared schemas to prevent the earlier object-versus-array regression. Article payloads include revision, actual locale and publication metadata. Possible availability codes include AVAILABLE, NO_MATCH, NOT_PUBLISHED, TRANSLATION_UNAVAILABLE, OFFLINE_PACK_MISSING and TEMPORARILY_UNAVAILABLE. Permission denial remains a proper HTTP authorization outcome; public responses must not reveal hidden draft counts or titles.

Handle loading, empty, errors, stale requests and route changes explicitly. Cancel or ignore stale responses. Close/back must restore the relevant reader location. Cached success must not override a known 401/403/404/410 or a learned withdrawal.

## Search

Index only authorized current publication content: title, quick answer, step text, symptom aliases, glossary and UI labels in the served language. Start with the existing server search and a deterministic token/phrase ranking; do not add a vector database or language-model answer engine merely for appearance.

Ranking order: exact symptom/control match; current task/tab/blocker relevance; title/approved synonyms; body; broader reference. Role boosts rank, not authority. Return title, direct answer excerpt, breadcrumb, type, section anchor and actual locale. Avoid huge result cards. Escape highlighted matches and cap query length/rate as appropriate.

Use accent-insensitive search, typos and region-specific aliases without changing scientific meaning. Add an explicit curated search test set: “prep still incomplete”, “drying done”, “marco saved manager cannot see”, “40 pH results”, “sand silt clay total”, “MIR file”, “KoBo location”, “offline not sent”, “approve disabled”, and equivalent local-language phrases. Privacy-aware telemetry records normalized issue categories rather than raw sample IDs or typed result values by default.

## Role and publication governance

Retain existing permission mechanisms and verify all handlers. Article viewing, global editing, language editing, review, publishing, local-note editing and contact management need explicit capabilities. Do not widen scientific approval or lab data permissions through Help. An administrator preview must be visibly marked and excluded from ordinary search/offline readers.

Maintain separate editorial facts: application behavior verified; scientific statement reviewed if required; translation reviewed; selected for publication. Record actual actor/provenance. A released collection must not claim a lab manager approved a document merely because a script ran under an admin account. Routine application help can be released under the authorized product editorial process; unresolved scientific claims are isolated, not used to block every general guide indefinitely.

Publication is an atomic switch to immutable revisions and approved locale membership. Use compare-and-swap on the currently observed publication/version token and a database uniqueness guard for current publication where supported. Concurrent reviewers must receive a conflict, not silently supersede each other. A source edit creates a new revision and marks impacted translation work without mutating the currently published bytes.

Lab notes require scoped revision/audit behavior, applicability and clear authorship. Approved global content remains visible; local notes may supplement but not silently replace result formulas, units or method acceptance rules. Support contacts are configuration, not a guessed institutional email address.

## Offline reading

Version packs by account, lab, authorization scope, locale and content release. Include permitted article blocks, essential figures and a small search index. Existing enrolled-device/session authorization remains authoritative. Do not create a second offline authentication system in Help.

Show downloaded release/locale, synchronization age, missing assets and connection limitations. Reconcile a newer pack by article revision and withdrawal; do not resurrect removed items through legacy direct-ID fallback. Clear/deny private packs on sign-out/account/lab changes according to existing offline-session rules. Public help is a separate safe collection. Do not erase pending laboratory records to reset Help cache.

Read-only article caching is different from whether the related laboratory action works offline. Each task guide's applicability declares the actual supported operation. On a disconnected device, instant knowledge of server withdrawal is impossible; state this in the technical documentation without promising it to operators as a live guarantee.

Feedback sent offline must be durably queued with a truthful state or clearly unavailable. No fake “sent”, “saved”, “copied” or “queued” success. The support flow previews recipient and exact message; exclude sensitive context by design and ask users to inspect their own free text rather than promising universal automatic redaction.

## Migration and release

Create v2 schema/asset support behind a scoped Help renderer flag. Test v1 published content through the adapter. Stage v2 replacements, translations, references and images. Publish a complete content manifest only when its declared coverage is verified. Keep v1 readable until replacement publication; preserve old IDs and redirect maps. Roll back reader code and content release coherently without restoring an old laboratory database over new work.

Docker must include only intentional runtime-owned Help assets, not the entire WP package. Test ignore rules and image contents. Do not seed an empty reader collection and call it a successful user-facing launch. Existing release scripts that require zero publications are draft-containment tests, not final content-rollout gates.

Update the existing documentation book through a canonical export or versioned links. Technical server-operation documentation stays separate from the lab operator manual. Do not reintroduce stale sample-page result-entry instructions through a docs export.

## Observability and performance

Log safe content-release IDs, context IDs, served locale and failure categories. Do not log tokens, raw URLs with report/sample identifiers, credentials, uploaded spectra or result values. Coverage is computed from the actual registry and published manifest. Use real search/task feedback when available, never fake popularity metrics.

Lazy-load the content studio and large media; cache immutable article assets by hash; paginate library/editor lists; load images responsively. Keep the initial Help reading page lightweight enough for laboratory mobile connections. Measure cold/warm load on representative devices and networks; set an agreed performance budget from the existing app baseline rather than claiming an unmeasured “instant” experience.
