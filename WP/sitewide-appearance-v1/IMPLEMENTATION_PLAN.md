# SoilFER LIMS: consistent light and graphite appearance

Prepared 8 September 2026 for Antigravity, LIMSI / LIMS Dev. Working folder: `C:\Users\yigin\Documents\soilfer-lims`.

## 1. Product decision

Light is the default for the entire application. A header appearance switch changes the current browsing session only. A user can explicitly save Light or Dark under **Profile → Appearance**; that account preference applies to later sessions and other devices until changed. Dark means a restrained graphite gray with distinct surfaces, readable labels and visible controls, not near-black or blue-black panels.

This work includes the application shell, every routed page, role dashboard, shared component, overlay and error state. Theme changes must not reset unsaved entries, active samples, worksheet selection, uploads, modal state, chart zoom, or scroll position. Analytical workflows, authorization rules, numerical precision and report content are preserved.

This package is a design and implementation handoff. Only package files were created. Code findings come from local source revision `64be170` (the full revision is in `source-inventory.json`); no production appearance audit or production write was performed for this plan. The interactive preview uses fictional local demo state and makes no requests to the LIMS.

## 2. Confirmed causes in the source

| Location | Current behavior | Required correction |
|---|---|---|
| `client/src/context/ThemeContext.jsx:19` | Reads `localStorage.darkMode`, defaults to OS preference, persists each toggle | Explicit light fallback; ephemeral override; saved account preference |
| `ThemeContext.jsx:73` | Watches OS appearance, although the write effect already creates the key | Remove OS-driven switching entirely for this product contract |
| `client/src/index.css:79` onward | Global overrides rewrite blue utilities, links, primary buttons and focus rings | Semantic token classes; remove the global palette rewrites once consumers are migrated |
| `client/tailwind.config.js` | Literal blue primary and gray sidebar differ from branding context's emerald | Map appearance roles to one token system; distinguish brand identity from UI appearance |
| `client/src/main.jsx:58` | Theme provider is outside AuthProvider; 401 interceptor performs separate logout cleanup | Add an auth-aware appearance bridge and one cleanup contract without provider cycles |
| `client/src/pages/Profile.jsx`, `server/prisma/schema.prisma:13`, `server/routes/authRoutes.js` | No stored appearance field or self-service preference endpoint | Add a small server-backed preference and Profile → Appearance |
| `client/src/components/workbench/WorksheetArea.jsx` | Mixed slate surfaces, 10/11px muted labels, inherited footers and controls | Shared table/input/footer roles; inspect entry, blocked, error, saved and selected states |
| `client/src/components/workbench/SpectralIntakeModal.jsx:333` | Near-black graph/panels plus literal SVG line/text colors and 8/9px labels | Graph adapter and readable axes using the same palette |
| `client/src/styles/workflow-map-v2.css:24` | Independent blue-black gradients and translucent nodes | Graphite canvas, opaque nodes, clear edges, consistent inspectors/controls |
| `client/src/components/workflow/WorkflowEdge.jsx` | Literal graph stroke colors | Semantic edge colors, labels/shapes for state and contrast on the canvas |
| `client/src/context/DialogContext.jsx:56` | Separate slate modal palette | Shared overlay, raised surface, text and action roles |
| `client/src/pages/PublicReport.jsx` | Entire viewer deliberately light-only, including toolbar, loading and error states | Theme the viewer chrome; retain the scoped white paper document |
| `client/src/components/report/ReportContent.css` and `client/src/index.css` print block | Intentional white paper; global label page size and visibility rules | Preserve white paper and verify that label rules do not override A4 report printing |

`SOURCE_INVENTORY.md` and `source-inventory.json` list all source candidates and routes. A literal color or a missing `dark:` in a file is not by itself proof of a defect; inheritance, images, print scopes and paired tokens must be inspected.

## 3. Exact preference behavior

### Precedence

For an authenticated, validated user:

`effective appearance = current-tab override ?? saved account preference ?? light`

For an anonymous page: `current anonymous-tab override ?? light`. Never infer appearance from the operating system. Never migrate an old browser `darkMode=true` into an account preference; the user never explicitly saved it in their profile.

### What counts as a session

The temporary override belongs to the current browser tab and authenticated identity. It survives route changes and reloads in that tab. It is cleared on explicit logout, session expiration, account switch and impersonation boundary. Closing an ordinary tab ends its page session; a fresh independently opened tab starts from the account preference, or light. Browser “restore tab/session” can restore sessionStorage: treat a restored tab as a continuation, and still clear overrides on logout/expiry/identity change. Do not promise a browser-close detector or erase state on `beforeunload` because that also runs on refresh.

Opening a link in a new tab must use `noopener` where appropriate: browsers can initially copy sessionStorage from an opener. Test independent, duplicated and restored tabs and document the actual behavior. Temporary overrides are intentionally tab-local and must not be broadcast as permanent preferences. This is a UI preference boundary, not a new authentication scheme.

| Event | Visible appearance | Stored account preference |
|---|---|---|
| First visit, OS dark, no user choice | Light | Unset/light |
| Header → Dark | Dark, “This session” | Unchanged |
| Navigate/reload current tab | Dark | Unchanged |
| Fresh independent tab/new login without a saved dark preference | Light | Unchanged |
| Save Dark in Profile | Dark immediately after success; temporary override cleared | Dark |
| Later login on another device | Dark after authenticated preference loads | Dark |
| Saved Dark; header → Light | Light for this tab/session | Dark |
| End that session and log in again | Dark | Dark |
| Save Light in Profile | Light; temporary override cleared | Light |
| Save fails or network is offline | Existing effective theme stays usable; readable inline error and retry | Previous value |
| Logout/401 expiry/another user logs in | Anonymous light; then next user's preference | Each account unchanged |
| Profile default changes in another tab | Re-fetch preference on focus; apply if no local temporary override | Server authoritative |
| OS appearance changes | No appearance change | Unchanged |

### Header UX

Keep one **Appearance** control in existing site chrome, accessible by keyboard and touch, also available on login and public viewer pages. Its popover shows **Light** and **Dark**, with a visible selected state, then “Changes apply to this session.” For signed-in users add **Save a default in Profile** linking to `/profile?tab=appearance`. If a temporary override is active, offer **Use my saved default** to remove it. Anonymous users see “Sign in to save a default.” The switch never calls the preference API.

### Profile UX

Add Appearance alongside existing profile tabs. Two compact radio cards, **Light** and **Dark · Graphite**, show miniature interface previews. Light is labeled “Default” if there is no saved choice. Helper text: “Use this appearance whenever you sign in, on any device. You can still switch for one session from the header.”

One explicit **Save appearance** button. Selecting a radio does not write to the server or retheme the page; the miniature preview is sufficient. On success, merge only preference fields into the authenticated user, clear the current override, apply the saved theme and show “Appearance saved to your profile.” On failure retain the selection for retry, say “Could not save. Your saved appearance is unchanged,” and do not falsely show success. Keep this preference separate from password, messaging, language and admin branding controls.

## 4. Architecture and API contract

### One resolver and root owner

Add a pure `resolveAppearance({authenticated, savedPreference, sessionOverride})` and storage helpers in `client/src/lib/appearance.js` (or the established utility directory). Values are strictly `light` or `dark`; invalid/legacy values resolve to light. Wrap all storage reads/writes in try/catch; use memory fallback if storage is blocked. Do not add arbitrary CSS values to storage.

ThemeContext continues to own the document root and branding compatibility API. Preserve `useTheme().theme` for logos/title/brand consumers and `darkMode` for existing consumers during migration. Introduce clearly named `appearance`, `savedAppearance`, `appearanceSource`, `setSessionAppearance`, `clearSessionAppearance` and preference hydration. One root attribute `data-appearance="light|dark"` and a synchronized `.dark` compatibility class are updated together; set `color-scheme: light|dark` and browser theme-color consistently.

Keep LanguageProvider → AuthProvider dependency intact. Recommended minimal design: ThemeProvider stays outside auth; a small `AuthenticatedAppearanceBridge` inside AuthProvider passes validated user identity/preference into ThemeContext. Auth must expose hydration status and a safe preference merge method. Avoid two competing theme contexts or effects writing different root classes.

Session payload keys use a version and identity, e.g. `soilfer.appearance.session.v1`, with `{subjectId, value}`. The identity is the validated account ID or a literal anonymous scope. Purge mismatched values. Explicitly share cleanup behavior across `AuthContext.logout`, login/account switching, the Axios 401 path, and impersonation start/end. Re-read/authenticate identity before applying cached signed-in theme; another user's stale cache must never color the login page.

The current auth middleware can return 403 for an invalid/expired JWT as well as legitimate permission denials. Use an explicit authentication-invalid signal or a `/me` revalidation to identify expired sessions; do not log users out or reset appearance on every ordinary RBAC 403. Test both cases. Cross-tab logout/account changes must clear the corresponding in-memory appearance too, without transmitting auth tokens in theme events.

Prevent flash: set explicit light tokens in the first stylesheet; use a small CSP-compatible bootstrap for a validated same-tab cached override where possible. Authenticated reloads should render a stable theme-aware loading shell until auth/preference hydration is decided. Do not mount a full light worksheet then repaint dark. On slow/offline auth, use only a cache bound to the current identity for appearance, never for authorization; provide a bounded fallback rather than a blank screen. Cold unauthenticated login stays light until the user explicitly switches.

Do not key/remount React trees by theme. Updating tokens must preserve unsaved forms, uploading files, review dialogs, keyboard focus, selected cells and graph state. Repaint canvas/chart adapters without changing domain data.

### Server preference

Recommended field: `User.themePreference String @default("light")`; enforce `light|dark` in the API. Use the repository's additive, idempotent SQLite migration mechanism, update Prisma schema/client, fixtures and seed assumptions. Current startup uses explicit migrations; changing schema alone is insufficient. No reset, `db push --accept-data-loss`, table rebuild or production reseed.

Recommended route: `PATCH /api/auth/preferences` with `{ "themePreference": "dark" }`. If there is an equivalent self-service route in the final branch, extend it rather than create a duplicate. Require authentication, update only `req.user.id`, reject unknown fields/invalid values with the established 400 response format. Return `{themePreference}` in the established response envelope. Do not accept a target user ID, role, permissions, lab, language or password in this appearance request. Update login, `/me` and impersonation user serialization consistently; do not expose secrets.

Every active role can change its own appearance without admin permission. Maintain existing password-change-required and inactive-account gates. During impersonation allow session appearance only; do not silently save the impersonated person's profile. Appearance writes must not update sample/analysis state or append sample workflow events.

Server result is authoritative. Cache only after successful response. Discard late responses if user identity changed; serialise/disable concurrent saves. On authenticated focus, re-fetch saved preference if stale; local session override still wins. No credentials in BroadcastChannel/storage notifications. A small user-preference event is sufficient if the app already uses this infrastructure.

## 5. Visual system

Use semantic CSS custom properties in a dedicated `appearance-tokens.css` and map Tailwind role utilities to them. `tokens.json` supplies the reviewed starting values. Light and dark are complete paired palettes, not an inversion filter. The preview contains the same values.

| Role | Light | Graphite dark |
|---|---|---|
| App canvas | `#F4F6F5` | `#25282B` |
| Main surface / sidebar | `#FFFFFF` | `#2E3236` |
| Raised popover / modal | `#FFFFFF` | `#393E43` |
| Input / inset | `#FAFBFA` | `#222629` |
| Hover / muted surface | `#EAF0EC` | `#3C4247` |
| Primary text | `#20302B` | `#F1F4F3` |
| Secondary text / placeholder | `#53635C` | `#BAC5C8` |
| Decorative divider | `#D6DFDA` | `#515B61` |
| Essential control boundary | `#7A8A82` | `#899599` |
| Primary action background | `#276B51` | `#8ED3B8` |
| Primary action foreground | `#FFFFFF` | `#182B23` |
| Link / focus ring | `#135E9E` | `#9ACCF2` |

Distinct tokens are also required for success, caution, danger, information, selected row, disabled surface/text, chart series/grid/axis, graph connectors, overlay scrim and white paper. Pair each tinted status background with a tested text color. Decorative dividers need not look as strong as input boundaries. Do not reduce entire controls with opacity to create disabled styling; keep labels readable and explain why an action is unavailable.

Visual rules:

- Use graphite neutral layers and a restrained SoilFER green for action/selection. Preserve actual brand assets and required donor treatment; do not recolor logos with filters.
- Typical body and worksheet text 14–16px; primary result entry 16px with tabular numerals; important supporting labels at least 12px. No 8–10px scientific axes or essential text.
- Keep dense laboratory tables, column alignment and meaningful hierarchy. Use small 8–12px radii, thin separators, limited shadows; no glow, glass panels or decorative gradients in work areas.
- Selected, focused, saved, submitted, accepted, blocked, error and disabled states must remain distinguishable using text/icons/borders as well as color.
- Apply theme to sticky table headers/footers, dropdown options, file inputs, autofill, date pickers, checkbox accent, scrollbar, tooltips, portal roots, toasts, skeletons and empty states. Native OS popups are styled through `color-scheme` to the browser's extent, not replaced with inaccessible imitation controls.
- Lab branding may supply a logo/accent, but cannot override neutral surfaces, status meanings or accessible foreground pairings. Validate configured accents in both themes; use a known accessible UI fallback when needed while keeping the original logo intact.
- No broad `.dark .bg-white`, `[class*=...]`, blanket `!important`, inversion, or universal SVG fill overrides. Migrate components to semantic roles and remove old utility rewrites after the relevant consumers are converted.

## 6. Site-wide coverage and connection checklist

Antigravity must turn every row below and every route in `SOURCE_INVENTORY.md` into completed evidence. A homepage screenshot is not site-wide verification.

| Area | Surfaces and behaviors to inspect |
|---|---|
| Shared shell | App layout, Header, Sidebar, ThemeToggle, UserMenu, language switch, global loading, unauthorized, error boundary, NotFound |
| Identity | Login, forgotten-password help, ForcePasswordChangeModal, Profile tabs, session expiry, impersonation banner |
| Role dashboards | ReceptionDashboard, TechnicianDashboard, ManagerDashboard, OversightDashboard and Dashboard fallback; scope selectors, queues, empty/error states, counts/filters |
| Reception | Both route modes/redirects, lookup, sample context, draft, manifest, batch exceptions, intake forms, labels, file previews and validation |
| Workbench and MyWork | Queue, WorksheetArea, NumericEditor, OperationalTaskEditor, TextureEditor, SpectralIntakeModal, paste preview, conflict compare, review, receipts, inspector, batch/QC modal, blocked/readonly inputs |
| Samples | List/filters, all SampleDetail tabs, summary, work/status tables, evidence/metadata/analysis/storage dialogs, review controls, audits, report previews |
| Workflow map | Both map routes, nodes, links/arrowheads, labels, controls/minimap, detail panel/drawer, filters, timeline, exporting, zoom/focus, selected/blocked/completed states |
| Spectra and data | SpectralLibrary upload/explorer/detail, overlay curves, chart legend/tooltips, texture chart, DataSheet, DataResults, CountryData/Leaflet maps and layers |
| Assets | Equipment list/detail, register/log-event dialogs, calibration warnings, Inventory tables, stock movements, drawers and overlays |
| Administration | AdminPanel branding/language/catalogue/users/audit/API tabs, LabMethods and aliases, labs/staff, Users/UserDialog, Projects, Kobo configuration, legacy CSV import |
| QA and reporting | QADashboard tabs, manager queue, ResultReports, redirects, report preview/history/share dialog, public report viewer loading/error/expired/revoked states |
| Messaging and help | NotificationDrawer, MessagingCenter and compose/chat views, menus/toasts, About, TechStack/credits aliases, active tutorial overlays if present |

Third-party adapters:

- Recharts: tokenized axis/label/grid/legend/tooltip/content/cursor colors; resolve tokens when canvas requires actual colors; update on theme change without losing selection/zoom.
- React Flow: nodes, handles, control buttons, minimap, background, edge labels, arrows and focus indicators. A completed/blocked connection must remain visible on both canvases.
- Leaflet: theme controls, popups and surrounding panels. Preserve scientific layers/basemaps and attribution. Do not CSS-invert satellite/soil maps. A provider's light basemap is an intentional content exception, recorded and tested; consider an existing licensed dark basemap only if available without changing geographic meaning.
- Spectral SVG: larger readable axes, correct units, semantic line palette and stable curve identity. Do not change data processing or scientific values.

## 7. Deliberate light-content exceptions

The report document, printable barcode labels, exported certificates, images of evidence and approved brand artwork retain their intended colors. They are content, not accidentally unthemed UI. Scope them with a paper/content boundary, e.g. `[data-surface="paper"]`, `color-scheme: light`, explicit dark text and print rules. Theme the surrounding viewer/toolbar/dialog. Ensure white report links, tables, warnings and selection are readable despite global application styles.

Print/PDF output must be identical in content and legibility regardless of UI theme; preserve A4 reports versus the 101 × 54 mm label format. Existing global print visibility/page-size rules need a scoped check. Theme work must not change previously issued report bytes or approval records. Workflow/spectrum exports should default to a publication-friendly light canvas without changing current on-screen state or graph data; document any deliberate on-screen-theme export option.

## 8. Delivery phases and acceptance

1. **Inventory and visual baseline.** Read current branch and package; enumerate routes/nested surfaces; collect reproducible local/staging fixtures for each role and meaningful state. Record intentional content exceptions. Do not copy production credentials or sensitive lab records into fixtures/screenshots.
2. **Preference and tokens.** Implement resolver, migration/API, auth bridge, bootstrap, temporary switch and Profile settings. Introduce paired tokens with tests. Keep old compatibility API until consumers migrate.
3. **Shared foundations.** Migrate shell, controls, tables, dialogs, alerts, loading/errors and notifications first. Replace palette rewrites carefully; inspect side effects in both themes.
4. **Lab workflows.** Migrate reception, workbench, samples, review/QA and all dependent modals. Prove appearance switching preserves drafts and workflow authorization.
5. **Specialized and remaining surfaces.** Maps/charts/spectra, assets, administration, multilingual strings, public pages, reports/labels and tutorial overlay if shipped.
6. **Review and release.** Complete `ACCEPTANCE_CHECKLIST.md`, route/state matrix and evidence, remove unneeded compatibility rules, run checks on final commit, then hand the verified change through the normal release process.

Build in focused commits. The minimal database change is additive and has a non-destructive rollback: deploy the previous app with the extra preference column retained. Back up before migration; do not remove user preferences during rollback. Deploy backend field/API before frontend that uses it, or atomically deploy a compatible bundle. If the API is absent/temporarily unavailable, session switching still works and profile save shows an honest failure.

Do not declare “zero defects.” Acceptance is zero unresolved theme/readability failures in the agreed route/state matrix, plus passing lifecycle and data-preservation tests. Surface gaps explicitly instead of marking a visually uninspected module complete.

## 9. Accessibility and source guidance

Target WCAG 2.2 AA for the appearance work: normal text at least 4.5:1, large text 3:1, and essential non-text controls/graphics 3:1 against adjacent colors. Use a visible focus ring and a minimum 24 × 24 CSS pixel target under AA's applicable exceptions, preferably around 44px for common touch actions. Labels/status meanings cannot rely only on hue. Validate at 200% zoom, 320px width where applicable, with keyboard access and reduced motion. Contrast must be computed on the actual rendered/composited background, including hover/selection/overlays; token checks alone are not complete accessibility certification.

Sources:

- W3C, [WCAG 2.2](https://www.w3.org/TR/WCAG22/), sections 1.4.3, 1.4.11, 2.4.7, 2.5.8.
- W3C, [Understanding non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast).
- MDN, [sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage), including reload, opener and page-session behavior.

These are technical implementation references. The preview is a design proposal; a deployed application still requires the full checks below.
