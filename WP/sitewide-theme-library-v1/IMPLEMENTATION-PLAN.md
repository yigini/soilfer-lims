# SoilFER theme library and selector implementation plan

Prepared 30 September 2026 for the product owner, implementer and independent reviewer.

**Status: implementation authorised on 30 September 2026 at 12:09 UTC.** The owner instructed: “WE NEED TO IMPLEMENT NOW.. ask agy”. Implement the full plan and its recommended product rules. This authorization does not mark implementation, testing or deployment complete. [IMPLEMENTATION-HANDOFF.md](IMPLEMENTATION-HANDOFF.md) records the assignment to the existing LIMS Dev task.

## 1 What the finished feature should do

An administrator or lab manager should be able to choose a polished theme, see a realistic preview, and clearly decide whether to use it personally or adopt it as a default for a laboratory. A platform administrator can also set the platform default. The choice should work throughout SoilFER, including the mobile interface, without losing a worksheet entry or changing the meaning of a result.

Soils remain the visual and product focus. Forest and earth tones should feel appropriate for scientific laboratory work, with clear white or graphite work surfaces. Water and nutrient themes provide future flexibility without enabling water or fertilizer analyses, changing methods, renaming scientific fields or implying new laboratory accreditation.

The proposed implementation extends the existing appearance system. It separates **colour theme**, **Light or Dark mode**, **lab branding**, and **scientific status colours**. A theme should not rearrange the interface, change numerical values or permissions, alter a report certificate, or overwrite personal accessibility choices.

The deliverable is one integrated library, selector and resolver, with complete coverage and review evidence. “Bug-free” is a quality goal, not a guarantee. Release requires no known critical/high-severity defects, no unresolved theme-blocking defects, and the measurable acceptance gates in this plan.

## 2 Current source and integration gaps

Inspected source is merged main `1265e8aa9f71f5f60b61c6fdaf31bc36ba8b2c54`. This is a source review, not a new audit of production. [SOURCE-INVENTORY.json](SOURCE-INVENTORY.json) records 215 JavaScript/JSX/TypeScript/CSS files and 45 route declarations from `App.jsx`, including aliases and the wildcard. A colour literal is a review candidate, not automatically a defect.

| Existing integration | Verified current behaviour | Required extension |
|---|---|---|
| `client/src/lib/appearance.js` | Strict `light`/`dark`; temporary tab override, then saved preference, then Light; no OS-driven mode | Add an independent allowlisted theme identity and shared defaults while retaining the established mode contract |
| `ThemeContext.jsx` and `AuthenticatedAppearanceBridge.jsx` | One root owner and auth bridge; branding settings fetched once on mount; some branding updates use separate legacy variables | Resolve identity, lab scope and defaults together; abort stale fetches; prevent competing variables or another user's/lab's settings surviving a context change |
| `ThemeToggle.jsx`, `Profile.jsx` | Header changes current tab; profile saves mode through `/api/auth/preferences` | Keep temporary versus saved actions distinct; add the theme library and shared-default selector |
| `appearance-tokens.css` and Tailwind config | Semantic Light/Graphite tokens, paper exception, safe-area helpers; some legacy literal colour aliases | Define complete theme/mode token sets, adapters and deliberate exceptions; remove incompatible competing aliases after migration |
| Auth preference/profile endpoints | Both self-service update paths validate only `light`/`dark`; field allowlists reject extra keys | Extend both paths consistently; preserve old clients and avoid bypasses through a second profile endpoint |
| User schema/migration | `themePreference` defaults to Light, with an additive existing migration | Add theme/default metadata; do not guess which saved Light values were explicitly chosen |
| `Lab.branding`, `Lab.settings`, `SystemSetting.branding` | Existing branding JSON and context-dependent admin settings; branding update reconstructs the object | Store theme defaults separately so branding/language/logo updates cannot erase appearance settings, or vice versa |
| Spectral library, workbench, graphs and other pages | Both semantic tokens and literal white/gray/blue/status utilities exist | Inspect actual rendering, convert UI roles and keep legitimate scientific/print colours explicit |
| `index.html`, public manifest | Theme-colour metadata, mobile viewport and PWA metadata exist | Update browser chrome safely; verify actual installed-app behaviour without promising capabilities the OS does not provide |

The September appearance plan in `WP/sitewide-appearance-v1` is historical background. Its old “current causes” are not current defects. Preserve that package and reuse its established Light/Graphite behaviour and relevant evidence instead of implementing a second appearance provider.

## 3 Proposed theme collection

All seven families have complete Light and Dark versions: fourteen selectable combinations. Keep Light and Dark as modes rather than listing fourteen confusing theme names. There is no Dim, automatic System mode or arbitrary colour picker in version one.

| Theme and stable ID | Visual direction | Intended use | Light primary | Dark primary |
|---|---|---|---|---|
| SoilFER Classic `soilfer-classic` | Existing green identity, warm neutral canvas, graphite dark surfaces | Compatibility default and reliable fallback | `#256348` | `#91D2AF` |
| Forest `forest` | Muted vegetation green with calm work surfaces | Recommended additional everyday soil theme | `#245B3D` | `#9DD7AA` |
| Terra `terra` | Clay and earth accents, warm neutrals | Soil-focused identity without decorative textures in data areas | `#865039` | `#E6B298` |
| Mineral `mineral` | Slate and restrained blue-gray | Dense analytical tables and instrument screens | `#43556D` | `#ABC2D7` |
| Watershed `watershed` | Quiet teal, clean neutral panels | Soil laboratories that may later analyse water | `#166879` | `#89CFD2` |
| Nutrient `nutrient` | Olive and fertility-inspired accents | Soil nutrients and future fertilizer work | `#596024` | `#C4D48E` |
| Clear Contrast `clear-contrast` | Strong text/edges, minimal decoration | Users needing stronger visual separation | `#003E70` | `#90C9FF` |

**Recommended adoption:** keep Classic as the initial platform/lab default for continuity. Offer Forest as the recommended new soil theme, without silently applying it to existing users. Managers and administrators make an explicit choice.

[THEME-PREVIEW.html](THEME-PREVIEW.html) compares the proposed families in a fictional laboratory view with Light/Dark and phone-layout controls. It has no connection to application data and is not the production selector. [THEME-CONCEPTS.json](THEME-CONCEPTS.json) defines proposed core colours. [CONTRAST-CHECK.json](CONTRAST-CHECK.json) records 294 passing opaque core-pair calculations. These are preliminary design results; they do not cover all UI states, transparency, charts, logos or rendered accessibility.

Each complete production definition must include canvas, surface, raised/inset surface, hover/selected surface, text/muted/link, primary/on-primary/hover/pressed, sidebar text/active state, control border, decorative divider, focus, disabled control, overlays, success/warning/danger/info pairs, chart axes/grid/tooltip, graph edges/nodes and browser theme colour. No production theme may ship with missing tokens silently borrowed from an unrelated palette.

Keep typefaces, density, spacing, radii, navigation, input dimensions and behaviour consistent between themes. Do not add background photos, soil textures behind text, gradients behind result values, visual effects requiring new downloads, or font changes per theme.

## 4 Who can select or adopt a theme

These are the product rules authorised for implementation with this plan. “Admin” means the persisted `SUPER_ADMIN` role. Do not infer admin authority from a screen label, `MASTER_USER`, `MANAGE_BRANDING` or an unreviewed custom role.

| User | Personal palette | Personal Light/Dark | Adopt lab default | Adopt platform default |
|---|---|---|---|---|
| SUPER_ADMIN | Any published theme | Yes | Explicitly selected, authorised lab | Yes |
| LAB_MANAGER | Any published theme | Yes | Own currently assigned lab only | No |
| Other signed-in roles | Inherit shared palette; Clear Contrast accessibility override | Preserve existing mode controls | No | No |
| Anonymous/public viewer | Platform/public theme only; temporary Clear Contrast option | Temporary mode controls | No | No |

All signed-in users can reset their own appearance to follow the applicable default. Clear Contrast remains available to everyone as an accessibility option; this does not grant branding or operational permissions. Broader personal palette selection for other staff can be approved as a later product change, not silently enabled by this plan.

Shared defaults affect people following that default. They never mass-update `User` rows or force a manager's personal theme onto colleagues. A user's explicitly selected mode or accessibility theme wins. A lab manager with no lab assignment cannot choose another lab via an ID, query parameter or guessed URL. Shared-theme writes for an inactive/archived lab follow the existing lab lifecycle restrictions; reject an invalid operational target instead of enabling the lab.

Theme choice grants no new API-key, user-management, sample, report, country or project access. Implement client visibility **and** server authority checks. Test normal endpoints, direct URLs and tampered requests.

## 5 Theme resolution and identity boundaries

Resolve theme and mode independently. “Follow default” is a real explicit state, distinct from a missing/invalid value.

For an authenticated user, palette precedence is:

1. Current-tab preview or temporary override for this exact identity and scope.
2. Saved personal theme, when set; retain a valid existing saved theme after role downgrade but deny unauthorised future palette edits.
3. Applicable lab default for the user's authorised active lab presentation context.
4. Platform default.
5. Built-in SoilFER Classic.

Mode precedence follows the same layers: tab override, explicit personal Light/Dark, lab default mode if not inherited, platform default mode, Light. OS colour preference does not change it. Follow reduced-motion and forced-colour accessibility settings separately.

For staff, the assigned lab defines appearance context. Opening a sample/project/country filter from another permitted scope must not silently adopt that entity's lab appearance. For SUPER_ADMIN, the platform shell uses the platform default; an explicitly entered lab workspace can use that lab's default with the current lab clearly named. A generic dashboard filter does not switch branding unless it is explicitly defined as a lab-workspace transition. Resolve canonical lab IDs on the server, not accession codes or client-provided claims.

Anonymous global login/help screens use a public-safe platform theme. A local single-lab deployment may use the trusted configured lab's public-safe theme. Do not infer a lab from the previous user's browser cache or an arbitrary hostname/query parameter. Public report chrome uses only appearance metadata explicitly safe for that authorised report context; otherwise platform fallback. Paper contents remain unchanged. Public appearance responses return IDs/mode/catalogue version, not full admin settings, credentials or a lab directory.

| Event | Required behaviour |
|---|---|
| Upgrade before anyone adopts a new theme | Existing Classic/Light/Dark appearance stays intact |
| Choose a card | Only draft selection/miniature preview changes; no API write |
| Start full-screen preview | Token-only temporary override; visible preview notice and Exit preview action |
| Cancel, Escape or leave preview | Restore the exact effective state before preview, without discarding work |
| Save personal choice succeeds | Merge only returned appearance fields, clear preview and apply authoritative saved choice |
| Save fails or times out | No success claim; previous persisted state retained; draft available for retry; readable error and safe preview exit |
| Manager adopts lab default | Only own lab default changes; personal overrides remain; show who will inherit |
| Another administrator saves first | Revision conflict (409); reload current default and offer retry, not silent overwrite |
| Logout, expiry, account switch or impersonation boundary | Clear previous subject/scope preview, caches and inline variables; resolve new subject safely |
| Permissions change | Revalidate save authority; palette retention does not retain old privileges |
| Another tab/device changes a shared default | Refresh safely on next navigation/focus; apply only to inheritors, with an understandable notice |
| Slow/offline settings fetch | Stable validated local fallback; no blank page, spinners forever, or fallback used as authentication |
| Storage blocked, corrupted or unavailable | Safe in-memory temporary state and built-in fallback; saving requires actual server success |
| Unknown/deprecated theme ID | Safe Classic fallback with diagnostic code; preserve stored value for investigation; never execute supplied CSS |

Do not key/remount the React tree by theme. Theme changes must retain unsaved numeric/text input, selection/caret, pending uploads, scanner permissions, workbench filters, scroll, open dialog, spectral zoom, map position and graph state. Repaint charts/canvas using theme-aware adapters, without changing data or series identity.

## 6 Selector experience

Use a single reusable ThemeGallery and scope-aware settings screen rather than independent implementations in Profile, branding and lab administration.

**Entry points:** Profile → Appearance for personal settings; My Laboratory → Appearance for lab managers; Administration → Appearance for global administrators. Keep the header Appearance control for temporary mode/allowed palette preview, with “Manage appearance” linking to the appropriate screen. Other staff retain their present mode controls and the accessibility option, without seeing unavailable shared-setting actions.

The gallery shows a radio group with seven compact cards, theme name, one-sentence description, consistent miniature screen, selected checkmark and text labels. Swatches alone are insufficient. Light/Dark is a separate labelled radio group. Include “Follow lab default” or “Follow platform default” where applicable and show the effective theme, mode and source in plain language.

Shared changes must name the target: “Default for GHA Lab” or “Platform default”. SUPER_ADMIN explicitly selects an authorised lab before lab adoption; do not default silently to a first lab. Buttons read **Save for me**, **Use as this lab's default**, or **Use as platform default**, never an ambiguous “Apply”. Existing shared changes get an inline impact review: “Staff following the lab default will see this theme. Personal choices stay the same.” Require one deliberate save, not another owner/governance approval flow.

Offer **Preview**, **Exit preview**, **Save**, **Cancel**, and a clear reset-to-inheritance action. Display current/saved/draft states separately. While saving, disable duplicate submissions but retain navigation and cancellation where safe. A request whose outcome is unknown is reconciled by a read before retrying. On success announce the target and result through a polite live region; on error focus or reference the inline error without losing the selected card.

Use translation keys for names/descriptions, inheritance labels, errors, target names and helper copy. Support existing EN/ES/FR/PT and configured locales through the established resolver. Test long translations and RTL layouts where supported; do not hardcode technical English “Session” badges. Accessible names contain the visible labels.

## 7 Sitewide coverage

An implementer must turn the source inventory into a tracked coverage matrix. Every route, shared component, overlay, interactive state and approved colour exception needs an owner and verification evidence. A selector working on the dashboard is not completion.

| Area | Required coverage and representative states |
|---|---|
| Shell and authentication | Sidebar, desktop/mobile navigation, header/footer, login/activation/password reset, session expiry, forced password modal, logo variants, loading shells, errors/offline banners |
| Role dashboards | Administrator, manager, technician, reception, QA/oversight; metric cards, empty queues, alerts, progress bars, tooltips and drilldowns |
| Samples and reception | Lists, scoped filters, chips/statuses, paginated tables, detail drawers, registration/intake, correction/reconciliation notices, timeline/stepper, bulk actions, QR camera overlays |
| Workbench and results | Worksheets, keyboard entry, selected/edited/invalid/blocked cells, disabled controls, paste preview, formulas, texture entry, batch dialogs, review/approval/conflict comparison, autosave/offline indicators |
| Reports and documents | Report lists/viewer chrome, certificate paper exception, result tables, watermark/signatures, loading/errors, exports, A4/Letter output and barcode/QR labels |
| Spectral and scientific views | Spectral library, intake/upload, plots, axes, legends, selection, overlays, charts/tooltips, reference traces, numeric labels and unit text |
| Maps and workflows | Leaflet/ReactFlow/custom graph and globe UI, node/edge/control/inspector styles, map popups/legend, layer toggles, cluster labels, zoom/focus/selected paths |
| Administration | Users/staff lifecycle, permissions, projects/templates, labs, analysis/methods, branding, audit/import, integration/key screens for their authorised roles |
| Inventory and equipment | Stock/status badges, lot/expiry warnings, transactions, equipment details, calibration/maintenance, drawers and forms |
| Shared/public pages | Help centre, article editor/reader, FAQ, profile, messaging/notifications/dialogs, About/credits, 404/error boundaries and lazy routes |

Use existing `--sf-*` roles and Tailwind mappings as the integration boundary. Convert literal UI colours by semantic role, not a global find/replace such as “blue becomes primary”. Audit SVG `fill`/`stroke`, inline `style`, portal content, transparency/opacity, third-party widgets, CSS modules, image backgrounds and chart data as well as JSX classes. Decorative dividers may be subtle; interactive borders/focus cannot rely on the same weak divider token.

For charts, use accessible axes/grid/tooltip/surface tokens plus a reviewed categorical palette with labels, line dashes, marker shapes or patterns. Keep each scientific series consistent across toggles and exports. Classification thresholds, QA outcomes, sample lifecycle meanings, heatmap scales and map layer semantics are independent of the decorative theme. Never remap an error to a theme's green or make concentration values appear to change because a colour scale changed.

## 8 Accessibility and mobile requirements

Target WCAG 2.2 AA for the feature and affected screens. Normal text and meaningful placeholder/help/error text need at least 4.5:1; qualifying large text 3:1. Clear Contrast targets 7:1 for primary/muted/link text on its core surfaces. Check actual composed foreground/background colours without rounding a failing ratio into a pass. [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)

Meaningful control boundaries, graphics and focus visibility require applicable 3:1 contrast against adjacent colours; status and selection also need labels/shapes. Focus must remain visible and not be completely covered by sticky headers or footers. Use a separated focus ring on filled buttons so a primary-coloured ring does not disappear into the button. [W3C non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), [focus visibility](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)

Design ordinary controls for 44–48 CSS-pixel touch targets, with 48px consistent with existing helpers. This is a product target above WCAG's 24px minimum criterion, whose spacing/exceptions still need correct evaluation. Reflow ordinary content at 320 CSS-pixel width; scientific tables/maps can have a contained two-dimensional viewport with an accessible alternative, not page-wide overflow. [W3C target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)

Use keyboard-operable radio groups and visible selected states, modal focus containment where appropriate, Escape handling and focus restoration. Respect reduced motion, forced colours and text scaling; no reliance on animation to indicate success. Automated tools complement manual keyboard/screen-reader checks and do not establish conformance alone. [W3C reduced-motion technique](https://www.w3.org/WAI/WCAG22/Techniques/css/C39)

On phones, use a single-column gallery or labelled compact cards; a full-height sheet for the selector if needed, with one clear scroll area. Save/Cancel actions remain visible without covering content, focus or the software keyboard. Use safe-area insets, `dvh` with a tested fallback, and the existing viewport-fit metadata. Body/form text stays comfortably readable; avoid 10px helper labels and use 16px input text where needed to avoid unintended mobile zoom.

Test 320/360/390/430px phone widths, 768/1024px tablet layouts, 1280/1440px desktop, portrait/landscape, 200% text scaling and 400% browser zoom. Test iOS Safari and Android Chrome on real devices for touch, keyboard, safe areas, camera/QR and installed-app shell where available; desktop Chrome/Edge/Firefox/Safari use supported release versions recorded at implementation time. Browser emulation is additional evidence, not physical-device acceptance. If equipment is unavailable, mark the missing gate instead of claiming responsive/mobile completion.

Styles must follow component content, not device-model detection. Theme adoption never changes drawer placement, responsive breakpoints, table columns or density unexpectedly. Cover autofocus, autofill colours, native selects, disabled inputs, scrollbars and date controls. Browser `theme-color` should match the effective header/canvas; manifest/splash colours may require app reinstall or browser-specific behaviour and must be documented honestly.

## 9 Architecture and token delivery

Create one versioned static catalogue with stable IDs and complete Light/Dark definitions. Proposed paths: `client/src/lib/themeCatalog.js` and a shared/server allowlist generated from the same catalogue, `client/src/styles/theme-library.css`, `client/src/components/appearance/ThemeGallery.jsx`, `AppearanceSettings.jsx`, `AppearancePreviewNotice.jsx`, and dedicated chart/graph adapters where required. Names may follow repository conventions; the single-source contract must remain.

Keep one pure resolver returning `{themeId, mode, themeSource, modeSource, scope, revision}` and one root writer. Root attributes are `data-theme` and existing `data-appearance`; `.dark` stays a compatibility class only for Dark. Update `color-scheme`, browser metadata and logo treatment coherently. Catalogue validation rejects incomplete/duplicate definitions. Root and body/portal styling use the same inherited variables.

Do not use theme names as arbitrary dynamic Tailwind class strings that the build cannot discover. Use declared semantic utility mappings or static token CSS. Do not let legacy `.dark` rules override a family after its tokens are applied. Neutralise stale inline brand variables on identity/scope changes and migrate legitimate consumers with explicit compatibility aliases.

ThemeContext currently loads branding once. The extension must key settings requests to the authenticated identity and validated presentation scope, include request-generation/abort guards, and reject late responses for previous users/labs. AuthenticatedAppearanceBridge also passes hydration/context state. Avoid provider cycles and separate independent effects racing to repaint the root.

Initial HTML/CSS supplies Classic Light. A small CSP-compatible startup helper may restore only validated appearance metadata bound to the exact current tab identity; it never authenticates a user. Render a stable theme-aware hydration shell while authenticated settings resolve. No full light worksheet mounted and immediately replaced with dark. After a bounded failure show a usable fallback rather than a blank screen. Invalid/missing catalogue/configuration is diagnosable without printing auth data.

Temporary storage becomes a versioned record with `subjectId`, validated presentation scope, theme/mode overrides and schema version. Migrate valid existing Light/Dark tab records without changing saved accounts; purge mismatches and corrupted values. Browser tab duplication/restoration behaviour must be tested, not promised away. Cross-tab changes invalidate or refresh matching appearance metadata only; do not broadcast auth tokens or another lab's settings.

Keep themes bundled as local CSS/token data, with no per-theme fonts, external scripts or remote image downloads. Switching changes tokens and necessary chart paint only; it does not refetch operational data or rebuild long tables. No theme-specific page reload. Record bundle/CSS budgets in Phase 0; target ≤15 KB gzip additional theme CSS/catalogue initially, with measured review for justified increases. Test switching on a representative lower-powered Android device and ensure it creates no sustained jank, layout shift or lost input; record actual timings and device, not an assumed production performance claim.

## 10 Persistence and API design

Recommended storage separates appearance from branding JSON. Final names are subject to schema review; behaviour is mandatory.

| Proposed storage | Fields and constraints |
|---|---|
| User additive fields | `uiThemeId String?` (`null` follows shared palette); `uiModePreference String` (`inherit/light/dark`); `uiAppearanceRevision Int` default 0; retain legacy `themePreference` |
| `LabAppearanceSetting` new table | `labId` primary key/foreign key to canonical Lab; nullable themeId and `defaultMode` (`inherit/light/dark`); revision; updatedAt/updatedBy metadata |
| `GlobalAppearanceSetting` singleton | `id=global`; published themeId, Light/Dark defaultMode; revision; updatedAt/updatedBy metadata |

Server validation allows published IDs only. It does not accept hex values, CSS, scripts, asset URLs, target user IDs, role/lab/country/project fields or unbounded JSON. Defaults and audit entry save in one transaction. Use the repository's explicit SQLite/additive migration mechanism and generated Prisma client; do not repurpose `Lab.settings`, overwrite branding JSON or grant access through appearance requests.

**Migration contract:** existing users keep their actual legacy `themePreference` value. One transactional migration backfills `uiModePreference` to valid existing Light/Dark values, with a recorded version marker; invalid legacy values resolve to Light with a migration diagnostic. Existing users' palette starts inherited and all shared defaults start Classic Light. The migration cannot know whether old Light was explicitly selected, so it must not silently convert those users to inherited mode. New users are created with `uiModePreference=inherit`; personal mode inheritance for existing users occurs only when they choose it. Repeated migration must not overwrite later user choices. Test empty DB, populated DB, rerun, interruption/recovery, invalid legacy data and old-image startup.

Retain legacy APIs/fields for old clients. A legacy `themePreference` write remains valid and maps to an explicit new mode through the same service. Inherit is exposed only in the new appearance object; old readers receive an effective Light/Dark compatibility value without mutating the underlying preference on GET. Extend both preference and profile update paths consistently. Appearance saves merge only owned fields; an appearance change cannot reset language or a profile update erase theme metadata. Reject mixed conflicting legacy/new mode input with a clear 400 response.

Proposed endpoints are additive and must be documented in the existing API format:

| Endpoint | Purpose and authority |
|---|---|
| `GET /api/appearance/catalog` | Public static-safe published catalogue metadata; no lab/user records or secrets |
| `GET /api/appearance/context` | Authenticated user's effective and editable appearance, validated scope, sources and revisions; scoped correctly for ordinary staff/admin lab workspace |
| `GET /api/appearance/public` | Sanitised platform/trusted local appearance for login/public pages only; does not enumerate labs |
| `PATCH /api/auth/preferences` | Existing self-service route extended with allowlisted `appearance` object; requires current user and expected revision |
| `GET/PATCH /api/labs/:labId/appearance` | Own-lab manager or authorised SUPER_ADMIN; never arbitrary manager lab ID; read permission and lifecycle checked independently |
| `GET/PATCH /api/admin/appearance` | Global management only SUPER_ADMIN; ordinary users get their applicable defaults through context, not privileged endpoint |

Suggested personal payload: `{appearance:{themeId:"forest", modePreference:"dark", expectedRevision:3}}`; `themeId:null` and `modePreference:"inherit"` are explicit reset operations. Other roles may save mode/inheritance and the exact Clear Contrast accessibility ID, not other palette IDs. Shared payload includes allowlisted theme/mode and expectedRevision, with the target supplied through the authorised route. A lab reset restores inheritance, not a guessed hardcoded theme.

Responses identify effective theme/mode, saved/inherited values, sources, scope and new revision. Required failures: 401 invalid session, 403 unauthorised scope/action, 400 malformed/unpublished value or forbidden field, 404 authorised missing target, 409 stale revision or inappropriate lab lifecycle, 5xx genuine lookup/write failure. Determine role/lab/current scope from the persisted validated principal, not JWT claims alone. Enforce object shape/depth/size, normal JSON/CSP protections and existing request limits. Do not turn failed lookups into fabricated users, global defaults or successful empty checks.

Global and lab changes append a clear audit event containing actor, canonical target, before/after IDs/modes and revisions. Do not log temporary previews or auth tokens. Personal-change metadata can remain lightweight; decide audit retention under current practice. Reads are genuinely read-only: avoid reusing the existing lazy admin-settings GET that can initialise settings as a hidden write. Seed default rows only in the explicit migration/bootstrap.

## 11 Branding scientific output and security boundaries

Lab title, organisation, uploaded logo and approved footer remain branding settings. A chosen theme can supply safe default UI accents, not replace the lab's identity or modify saved certificate branding. Existing custom brand colours remain stored; version one renders them only in reviewed non-critical brand decoration, never by overriding readable control/status tokens. Explain that distinction in the branding screen. No deletion/reset of legacy custom values during migration.

Logos need a supported Light/Dark variant or a neutral framed background. Use `currentColor` for ordinary UI icons. Do not recolour scientific imagery, QR/barcodes, signatures, soil photographs, national flags or measurement traces indiscriminately. Approved logos remain recognisable; contrast exceptions for logos are not an excuse for unreadable clickable controls.

Certificates, reports and labels retain white paper, dark text, approved template/logos, dimensions and scientific content. Theme the surrounding viewer/actions, not the paper. Test print CSS, jsPDF/html-to-image/SVG/canvas exports separately, in both modes for every family. Preserve A4/Letter, label page sizing, QR/barcode contrast/scannability and no clipping. Do not repeat closed production printing work; use disposable visual/output checks for this new change.

No appearance setting changes sample type, method, QC thresholds, units, numeric precision, workflow permissions, account grants, credentials or externally maintained OpenNSIS. Theme identifiers are visual preferences, not a surrogate tenant-authorisation mechanism. Water/fertilizer workflow support requires its own future domain plan.

## 12 Quality assurance and acceptance matrix

Add meaningful focused tests to existing suites. Tests must assert observable behaviour and authoritative server state, not merely reproduce a helper's implementation. Synthetic fixtures and real HTTP/DB tests run only in disposable environments. No national/ordinary/production test records or test grants.

| Test group | Required positive and negative proof |
|---|---|
| Catalogue/resolver | All 7 × 2 complete definitions, unknown/missing IDs, independent mode/theme inheritance, exact scope/subject, legacy tab migration, storage failures, cross-tab/restored-tab behaviour |
| Personal API | Current-user save/reset, legacy writes through both endpoints, old/new conflict rejection, no forbidden-field update, each role including Clear Contrast exception, revoked/expired session |
| Shared API/RBAC | Global admin, manager own lab, manager foreign lab/global/null assignment denies, target lifecycle, direct-route attacks, persisted role change, canonical lab/code distinction |
| Save semantics | Revision conflict (409), lost response/read reconciliation, repeated save, request abort, no partial theme/language write, branding/default preservation and atomic audit |
| Migration | Existing Light/Dark retained, new-user inheritance, no reseed/reset, idempotent rerun, partial failure safety, user/lab/sample/result/brand counts/data preserved |
| Real UI | Preview/cancel/save/reset, every role entrypoint, backend failures, slow fetch/late-response account switch, malicious/unsupported IDs, keyboard focus and clear scope copy |
| Work preservation | Unsaved worksheet/raw numeric string/IME input, selected cells, review drawer, uploads, camera and chart/map/graph state survive switching |
| Visual/token coverage | All 14 combinations on shared component/state gallery and critical workflows; each routed screen checked in both modes and every family; approved colour exceptions enumerated |
| Accessibility | Calculated composed contrast, selected/focus/error/disabled states, manual keyboard/screen reader, colour-vision distinction, forced colours, motion, text resize and reflow |
| Mobile/browser | Declared viewport matrix plus actual iOS/Android devices, keyboard/safe areas/rotation, long locale/RTL, touch/QR and installed-app expectations |
| Scientific/print | Actual rendered chart/graph/map tooltips, consistent series identity, paper/PDF/label fixtures, unchanged numeric values, no theme palette leak into reports |
| Performance/caching | Bundle/CSS budget, no extra operational API calls on switch, stale asset/catalogue/new-server/old-client compatibility, identity-safe offline fallback |

Use a shared deterministic component gallery to exercise all fourteen palettes cheaply, then real route and workflow checks. Keep full matrix coverage; optimise fixture reuse rather than skipping themes. Prefer browser screenshot baselines with controlled fonts/data, reviewed image differences and device evidence. Record tool/library versions at implementation time. An automated contrast scan or a single screenshot does not prove sitewide completeness or real mobile operation.

Release blockers include cross-lab/default write authority defects, lost unsaved input, incorrect save/source claims, unreadable controls/results, misleading status/scientific meaning, broken print/labels, wrong-user theme leakage, mobile unreachable actions, unresolved theme-critical console errors or destructive migration. Freeze catalogue and token changes during acceptance; any material change invalidates affected checks only, not every passing unrelated suite.

## 13 Implementation phases and deliverables

| Phase | Work | Exit evidence |
|---|---|---|
| 0 Scope and inventory | Confirm proposed role/default rules, resolve active branding consumers, fill route/component/exception matrix, capture current representative UI and performance | Approved product decisions; complete inventory; existing appearance behaviour retained as regression baseline |
| 1 Catalogue and primitives | Finish all token states for 7 families × 2 modes, component gallery, logos, status/chart/focus roles, generated CSS/allowlist and validation | No missing tokens; contrast/state proof; visual design review for soil work and mobile |
| 2 Persistence and authority | Additive migration, preference/default services, current-principal RBAC, versioned APIs, legacy/profile parity, audit/concurrency | Real disposable HTTP/DB/migration positives and negatives; API contract updated |
| 3 Resolver and selector | Identity/scope hydration, storage/cache guards, mode/theme resolver, personal/shared selectors, previews, translations, a11y interaction | Save/cancel/failure/inheritance/account-switch/work-preservation evidence |
| 4 Whole-site integration | Cover all 45 route declarations and the shared components in the 215-file source inventory; UI token conversion, portals, third-party adapters, scientific and paper exceptions | Coverage matrix complete; every family/mode assessed; no uncovered important literal styles |
| 5 Responsive and accessibility review | Real workflows/browsers/devices, contrast/forced-colour/keyboard/screen-reader checks, print/export and performance | Traceable matrix; no release-blocking defects; missing physical evidence honestly gated |
| 6 Documentation and independent acceptance | Short admin/manager/user guides, exact default/preview/reset explanations, release notes, EVIDENCE/progress and focused review package | Complete friendly docs; accepted exact PR head with successful exact-head CI |
| 7 Controlled release and verification | Protected merge/exact-main CI, clean build/immutable image, stopped-writer backup/assets/migration, held verification and safe cutover | Completed release ledger and independent bounded live verification; no old database restore after new writes without reconciliation |

Agy is the authorised implementer and sole production operator. Codex independently reviews the real candidate and final evidence. Start implementation now in the existing LIMS Dev task, preserve concurrent work and proceed through all phases. Production release remains subject to independent technical acceptance and the established gates; no repeat owner approval is needed. The completed PR154 monitor remains paused unless monitoring is separately requested.

## 14 Deployment compatibility and rollback

Use a versioned feature flag for the new selector/shared defaults, initially disabled; existing appearance works while schema/catalogue compatibility is deployed. New nullable/default fields and tables must allow the old image to start without destructive down-migration. Shared defaults remain Classic until explicit adoption. Exercise populated old-image→new-image upgrade and permitted old-image recovery in disposable local and global topologies, with actual source/image identities and current preferences preserved.

Before release, record accepted source/tree, exact merged-main CI, catalogue/token version, migration and checker hashes, immutable target/baseline images, actual configuration/mounts/proxy and reviewed existing principals. Use the established actual production operator procedure, preserving environment and production/global mode. Hold external client mutation paths and all background/database writers, verify the hold, make consistent DB/WAL/assets backups and integrity/FK proofs, then perform the applicable additive migration and bounded held role/theme checks.

Record COMMITTED before normal writers resume and deliberately restore ingress. This is the established in-process automatic-restore boundary, not an untested power-loss durability guarantee. After normal writes resume, never restore the pre-release database without reconciliation. Prefer disabling the new selector or returning defaults to Classic through authorised non-destructive settings when safe; retain saved data. An image rollback must respect schema/compatibility and newly written preferences; verify it in the disposable rehearsal first.

Independent final checks verify actual version/image/settings/mounts/scheduler flags/proxy, public health, anonymous boundaries and required admin/manager selector/API authority. Production screenshots may be read-only after authorisation and must avoid private specimen content. Do not create production users/samples/grants or change the production mode to demonstrate both lab topologies. Changing a shared production appearance default is a real product change; the initial compatibility release does not silently adopt a new theme everywhere.

## 15 Documentation and progress record

Supply short guides titled “Choose my appearance”, “Set a lab default”, “Set the platform default”, “Return to the default”, and “Troubleshoot an appearance problem”. Use ordinary examples and clear scope labels. Explain temporary preview, personal preference, inherited defaults, Dark, Clear Contrast, unchanged paper reports and mobile controls. Include before/after screenshots with synthetic specimens only.

Keep technical tokens, API payloads and hashes in a maintainer appendix. Document the supported browser/device matrix, cache refresh procedure, deprecated theme-ID fallback and non-destructive recovery. Add accessible selector help through existing help/localisation mechanisms; do not manufacture a separate help platform.

At each completed phase or genuine blocker, maintain a small readiness handoff with actual timestamp, stage, exact commit/PR/CI, what changed/tested, remaining work and whether live. Reuse the owner's cost-conscious reporting approach only if monitoring is subsequently requested; no background watcher or token-heavy supervision is created by this plan.

## 16 Implementation decisions

The owner has authorised implementation of this plan using these recommendations. They define the feature; they do not claim that new code exists:

1. Seven curated families with Light/Dark; Classic remains initial default, Forest is the recommended additional soil choice.
2. SUPER_ADMIN adopts global/authorised lab defaults; LAB_MANAGER adopts only own lab default. Their personal palette choices are separate. Other staff retain mode controls and inheritance plus Clear Contrast accessibility selection.
3. Existing users retain their saved Light/Dark; shared adoption does not forcibly reset users. Existing users explicitly choose inheritance when desired.
4. Preview is reversible and never writes. Saving names the exact target; shared save preserves personal choices and records an audit event.
5. Version one has no automatic OS mode, Dim, free-form CSS or arbitrary-colour editor. Existing branding stays stored and scoped.
6. Water/fertilizer themes are visual options only. Soil methods, scientific semantics, certificates and permissions remain intact.
7. Begin implementation now under the owner's 30 September instruction. Physical mobile and accessibility gates, independent exact-head review and the established safe-release procedure remain required.

## 17 Completion checklist

- [ ] Complete catalogue and all fourteen theme/mode combinations, including interactive and scientific UI states.
- [ ] Exact admin/manager scope authority and other-role accessibility controls verified server-side.
- [ ] Personal/tab/lab/platform precedence, migration and legacy-client compatibility proved.
- [ ] Every route/component has coverage or an explicit reviewed paper/domain exception.
- [ ] No unsaved-work loss, unexpected layout change, stale identity/scope or false save result.
- [ ] Real mobile, keyboard/screen-reader, contrast/reflow/forced-colour/motion and supported-browser checks documented.
- [ ] Charts, maps, workbench, labels, reports and exports preserve meaning/data and readability.
- [ ] Friendly guides, technical contract, EVIDENCE and stage handoff accurately describe the final feature.
- [ ] Accepted exact head, protected merge and successful exact-main CI match immutable deployed source/image.
- [ ] Backups/migration/hold/cutover/recovery ledger and independent bounded live checks complete.

None of these implementation boxes is marked complete by this planning package. Completed planning validation comprises source inspection, the proposed core-colour calculations and local browser review of the fictional preview. [DESIGN-REVIEW.md](DESIGN-REVIEW.md) records the exact checks and their limits.
