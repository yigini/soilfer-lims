# Complete mobile laboratory redesign

## 1. Product outcome

Make SoilFER practical on Android phones/tablets, iPhone and iPad in browser and installed use. Preserve desktop efficiency. The mobile application must support a real shift: prepare assigned work, scan specimens, receive material, record drying/preparation, work through method batches, capture measurements/evidence, inspect samples/equipment, review work and synchronize after an outage.

The user explicitly selected full offline work with later synchronization. This requires application and additive server changes, unlike the preceding presentation-only refresh. Keep all existing scientific definitions, role/scope policy, validation, approvals, report history and integration contracts authoritative. Add local provisional state and a validated synchronization boundary; do not weaken the rules to make offline screens appear successful.

Use the approved SoilFER signature colors and current appearance/localization foundations. This turn supplies a plan and prototype only. Implementation and deployment are not performed by this package.

## 2. Recommended delivery architecture

One React product, shared domain contracts and adaptive views:

| Surface | Purpose | Storage/installation |
|---|---|---|
| Responsive web + installable PWA | Immediate access on desktop, phones and tablets; browser and home-screen use. | Versioned local app shell; IndexedDB and device-file storage where supported; storage durability checks and limitations disclosed. |
| Packaged Android and iOS app using a native runtime such as Capacitor | Recommended production option for managed lab devices doing sustained offline capture. | Native SQLite-backed outbox and app-private evidence files, encryption and platform key protection. Bundle assets locally; a wrapper loading the remote website is insufficient. |
| Existing backend | Same operational services, scope and validation for all clients. | Add work-pack, device, synchronization and attachment-resume contracts around existing services. |

This is a recommendation derived from the offline requirement. Capacitor reuses web technology for Android/iOS, but its documentation warns about WebView browser-storage eviction and distinguishes native database storage: [Capacitor storage](https://capacitorjs.com/docs/guides/storage). A native runtime does not automatically provide encrypted storage, secure authentication or safe synchronization; evaluate and implement those adapters explicitly.

Do not rewrite in a second frontend framework or install a large UI kit solely to imitate native controls. Reuse current React/router/icons/theme with small shared mobile primitives. Evaluate native storage plugins for platform support, encryption, migrations, maintenance/license and recovery before adoption; no paid service purchase is implied.

PWA installation is still useful and must work. Browser storage is best-effort unless appropriate persistence is granted, and even persistent data can be removed by users or device loss. WebKit documents quota/eviction behavior: [storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/). Therefore offer a clear “Ready for offline work” check and do not represent a home-screen icon as a durability guarantee. Prove both storage adapters separately.

Native iOS build/distribution needs a macOS/Xcode runner and appropriate signing/provisioning; this Windows workspace alone is not an iOS build environment. Prepare code and test plans here; use the organization's approved Mac/cloud build and distribution route. App Store/Play publication or private managed distribution is a later concrete delivery decision, not something to invent or purchase automatically. [Official environment requirements](https://capacitorjs.com/docs/getting-started/environment-setup).

## 3. Adaptive product structure

Use layout capability and available width, not a user-agent/device-name check. Proposed design ranges: compact below 600 CSS px, medium 600–1023, expanded 1024+. These are starting points; components use container constraints and real long text. A tablet in split view may use the phone pattern. Pointer/keyboard capabilities affect target sizing, not permissions.

- Phone: compact header with lab/sample context, contextual back, one reachable primary action, bottom navigation for daily tasks. Account/settings/appearance/language are in a full-height sheet. Keep every permitted destination available in More.
- Tablet: navigation rail and list/detail where space permits; dense method worksheet with pinned sample identity and a closable inspector. Preserve a useful portrait and split-screen view.
- Desktop: retain the full sidebar and efficient worksheet; share data/state/actions rather than duplicating workflow logic in phone JSX.

Default daily navigation uses Home, role's main work area, Scan, Samples (or an authorized equivalent), More. Render only server-permitted destinations. See the role table in SCREEN_SPECIFICATIONS.md. Scan is a contextual tool: closing returns to the initiating task. Never turn a decoded QR into an automatic mutation or unrestricted browser redirect.

Use URL-addressable sample/work/run/section state and appropriate history entries. Android Back and iOS navigation must close overlays or return one step without discarding work. Preserve scroll/filter/selection and raw input when rotating, resizing, changing language or moving between tasks. Avoid mounting two independent editable views of the same draft.

## 4. Shared mobile components

Introduce small components integrated with current providers: MobileAppShell, RoleNavigation, CompactPageHeader, MobileActionBar, ResponsiveDialog, EntityList/EntityRow, SampleIdentity, MethodRunNavigator, SingleSampleEditor, WorkPackPicker, SyncStatus, SyncCentre, ConflictReview, ScannerSheet and EvidencePicker. Names are proposals, not a second design system.

Use one data/controller hook per feature with presentation adapters for phone/tablet. Business mutations pass through a domain command interface that chooses immediate validated execution or durable queuing. Do not scatter navigator.onLine branches across every button.

Define spacing/target/keyboard/safe-area tokens alongside existing sf-* tokens. Everyday touch controls should have 44–48 CSS px effective targets; important gloved actions use generous separation. This product choice exceeds the basic WCAG 2.2 24px minimum/spacing exceptions: [W3C target sizing](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). Editable text is at least 16px; never disable browser zoom. Preserve visible focus and alternatives to swipe/drag.

Use viewport-fit=cover only with correctly applied safe-area insets. Account for dynamic browser chrome, keyboard and visual viewport. Fixed/sticky action areas must not cover focused fields, validation, the last row, or OS home indicators. Prefer flow/sticky layouts and 100dvh/min-height fallbacks; add a shared tested keyboard adapter where needed. Do not lock the entire body in a way that prevents reflow/zoom. [Visual viewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport).

Forms use visible labels, context-aware inputmode/enterkeyhint, disabled autocorrect for identifiers, explicit units and qualifiers, and focused errors with a summary. Keep entered numeric strings unchanged until validated. Selection controls and sheets remain accessible with VoiceOver/TalkBack and external keyboard. No essential action exists only on hover or a tiny icon.

## 5. Offline workflow as a first-class feature

Before leaving coverage, a staff member downloads a scoped work pack: selected samples/method runs, authoritative versions, prerequisites, SOP/checklist/schema versions, instrument/QC context, translations and optional reference documents. It is an atomic verified snapshot, not a copy of the whole production database.

During offline work, record draft edits, operational evidence, measurements, photos and eligible intentions into durable local storage before acknowledging them. Complete local prerequisite chains only when the downloaded SOP permits them; show local versus server state. Manager-verification prerequisites remain blocking unless that verified event exists in the authorized snapshot.

After reconnection, reauthenticate and synchronize ordered, idempotent domain commands. The server rechecks actor, scope, assignments, definition versions, evidence, current prerequisite state and conflict rules. Keep unsynced and rejected material recoverable. Independent samples can proceed if another sample conflicts; a texture group or single workflow transition stays atomic.

Full offline work means planned laboratory operations can be captured without a network. It cannot mean other disconnected devices instantly see the work, an offline approval is centrally final, or an external SIS receives a delivery without a connection. Final scientific approval/release, global configuration/permission changes and external publication require current server validation and explicit reconfirmation where the decision basis may have changed. Offline review notes and proposed decisions are retained, clearly pending. See OFFLINE_SYNC_CONTRACT.md for the complete operation matrix.

## 6. Installation, device services and app lifecycle

- Add manifest identity, scoped start URL, standalone display, approved icons/maskable assets, theme color and install guidance. Deep links must open the authorized resource after login/unlock and preserve the intended destination.
- Cache a coherent version of the non-sensitive app shell and required lazy chunks; a route first opened while offline must not fail because its chunk was never downloaded. Store scoped data in the authorized offline repository, not in indiscriminate HTTP caches.
- Self-host required fonts/icons and bundle essential decoder/validation code. External maps, help links and SIS/KoBo sites cannot be promised offline unless an explicitly licensed/downloaded local resource exists. Offer textual coordinates and provenance when map tiles are absent.
- Provide native/web adapters for camera, file selection, network hints, secure storage, app resume and download/share. Test Android file providers and iOS Files/photos; a file-picker reference is not a durable copy until bytes are stored and verified.
- Request camera/push permissions only after the relevant user action. Handle denial/no camera/flash unavailable gracefully. Stop tracks on leaving scanner, interruption and backgrounding. Show a persistent manual lookup option.
- Treat keyboard-wedge/Bluetooth HID scanners as keyboard input with explicit field focus; retain suffix settings in advanced scanner options. Web Bluetooth, direct USB/serial instruments and arbitrary printers are not universally supported; use tested native/vendor bridges only where required.
- Push is optional convenience, never the audit record or sync engine. Avoid results/personal data in lock-screen payloads. Home-screen web push on iOS requires the supported installed context and permission; implementation must feature-detect it. [WebKit push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
- Background sync is an optimization. Persist the queue, synchronize on foreground/resume and explicit Sync now, show last confirmed synchronization. Do not promise that iOS will finish uploads after the user closes the app. [Background Sync availability](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API).
- App updates must not force reload during entry or migrate away a pending outbox. Keep versioned compatibility and recovery; show an update prompt at a safe point. Test old clients against new servers and vice versa within a declared compatibility window.

## 7. Security and operational readiness

Offline enrollment is explicit and scoped to user/lab/device. First login and grants require connectivity. Store native secrets in platform secure storage; define PWA unlock/key handling and limitations without claiming browser encryption protects against executing same-origin malicious code. Do not cache passwords or put tokens in URLs, exports or service-worker logs.

Work packs have a bounded offline validity policy set by the lab, signed/scoped metadata and an access lease separate from server access-token expiry. Proposed initial lease is one shift (12 hours) with a configurable upper bound after a security/lab review; this is a design default, not an observed current SOP. Alert before expiry. Once expired, lock protected access/new privileged actions and preserve already captured records for reauthentication; no silent discard. Revocation cannot reach a disconnected device until reconnection or lease expiry; document this residual limitation.

Support device lock and user switch without exposing another operator's pending records. Prefer assigned/managed devices for full offline shifts. A controlled emergency handover uses an encrypted, audited recovery package to a permitted recipient, never an open CSV of unsynced lab data. Explicit logout must lock secrets and preserve encrypted unsynced work unless the user knowingly requests destructive removal under policy. Lost-device revocation prevents later server acceptance; no claim of immediate offline remote wipe.

Lab managers need a simple mobile readiness view: devices eligible for offline work, work-pack age, last confirmed sync and conflicts requiring help. Show only authorized metadata; do not add location tracking. Clear end-of-shift status: work accepted, work queued, work needing attention. Administrative global changes stay online.

## 8. Delivery sequence and gates

| Phase | Deliverable | Required exit gate |
|---|---|---|
| 0. Baseline | Reconcile completed visual/localization changes, all routes/roles, real-device list, offline policy and API/domain map. | Functional baseline issues isolated; no stale branch overwrite. |
| 1. Adaptive shell | Header/navigation, overlays, forms, list/table modes, tokens and phone/tablet reference screens. | Touch/keyboard/zoom and 5-locale/2-theme checks; desktop actions preserved. |
| 2. Offline foundation | Work packs, native/web storage adapters, enrollment/unlock, durable outbox and versioned local schema. | Offline cold start, process-kill and low-storage recovery demonstrated on actual devices. |
| 3. Server sync | Atomic command receipts, dependency ordering, idempotency, delta pulls, attachment resumption and conflict review. | Lost-response/retry/concurrency/revocation tests; no duplicate effects. |
| 4. Daily operations | All intake modes, operational checklists, 40-sample numeric runs, texture, spectra/evidence and review preparation. | Offline receive→prep→measurement journey plus rejection/conflict recovery in a staging lab. |
| 5. Full feature coverage | Supporting/admin/project/report/equipment/QA screens; every authorized control has a mobile pattern and offline disposition. | 35-route register expanded and completed with evidence; no “desktop only” escape used to omit required functionality. |
| 6. Packaged apps | Signed Android/iOS builds using native durable storage, install/onboarding, lifecycle and hardware adapters. | Real iPhone/iPad/Android tests, distribution/keys owned by organization, upgrade compatibility. |
| 7. Pilot and release | Controlled lab pilot, SOP/training, diagnostics, staged backend/web/app releases and rollback. | End-to-end offline shift evidence, five-locale screenshots, no unresolved critical data-loss/approval/scope defects. |

Phases 2–4 and native storage are core to the user's offline requirement, not optional follow-up work to defer after claiming completion. Responsive web may be delivered as an intermediate milestone, explicitly without claiming offline production readiness. Do not give an unsupported calendar estimate before the storage/sync technical spike and device inventory.

## 9. File and service map

Client: App.jsx, Header/UserMenu, existing providers, route pages and shared dialogs; workbench shell/queue/worksheet/editors/review, reception forms/drafts/location/scanner, sample sections/workflow, equipment/inventory, DataResults, reports, admin/TranslationEditor. See source-audit.json for extraction candidates, not a mechanical replacement list.

Server: workbenchRoutes/controller, operationalConfirmationService, workbenchReadinessService, workbenchValidationService, workflowContract, commandReceiptService, receptionController and related scope/authorization helpers, report and inventory/equipment services. Add a thin synchronization service that dispatches validated domain commands into shared transactional services; refactor route-level logic once if necessary, with regression tests.

Additive model proposals: OfflineDevice, OfflineGrant/WorkPackManifest, SyncOperation/receipt binding, pull change sequence, resumable attachment sessions. Retain current Sample/WorkItem/result identity. Do not put the whole server database on devices, replicate raw tables or use last-write-wins for scientific data.

## 10. Handoff and completion evidence

When the user later authorizes implementation, provide Antigravity this whole package plus the completed visual/localization baselines. Maintain explicit subtask status and explain changes in ordinary language. Do not stop at a plan or call an icon/manifest a native-quality app.

The implementation handoff must return tested commit and client build IDs, translation versions, database/sync schema compatibility, signed app artifacts when available, device/browser matrix, before/after screenshots, failed/recovered operation evidence, unresolved issues and rollback instructions. Deployment must preserve active client queues and real lab records. App-store agreements, signing accounts and commercial service decisions need the actual organizational owner; prepare everything else before raising a concrete missing requirement.
