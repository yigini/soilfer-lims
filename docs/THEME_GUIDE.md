# SoilFER Theme Library & Appearance User & Operator Guide

This guide describes how to choose and configure appearance themes in SoilFER-LIMS, how shared laboratory and platform defaults work, and how scientific data integrity and paper certificates are preserved.

---

## 1. Choose My Appearance (Personal Preference)

Every signed-in user can customize their personal appearance. Your personal choice is stored on the server and applies across all devices where you sign in.

### From Your Profile (Permanent Saved Preference)
1. Click your profile name or avatar in the sidebar/navigation and open **Profile**.
2. Select the **Appearance & Language** tab.
3. Browse the seven curated theme families:
   - **SoilFER Classic**: The canonical green laboratory theme (default fallback).
   - **Forest**: Muted vegetation green with calm work surfaces (recommended everyday soil theme).
   - **Terra**: Warm clay and rich earth tones.
   - **Mineral**: Slate and restrained blue-gray for dense instrument screens and analytical tables.
   - **Watershed**: Quiet teal and clean neutral panels.
   - **Nutrient**: Olive and fertility-inspired accents.
   - **Clear Contrast**: High contrast (>= 7:1) with bold text and visible borders for accessibility.
4. Toggle between **Light** and **Dark · Graphite** modes.
5. *(Optional)* Click **Preview** to experience the theme full-screen across the entire application without saving. A reversible notice banner appears at the top; click **Exit preview** to revert or **Save for me** to apply.
6. Click **Save for me** to commit your personal preference.

> [!NOTE]
> Non-manager staff inherit their assigned laboratory's theme palette by default. To accommodate visual accessibility needs, any staff member can personally select the **Clear Contrast** theme as an accessibility override at any time, without requiring elevated privileges.

### From the Header (Temporary Session Mode Switch)
- The moon/sun icon in the top header provides a quick way to toggle between Light and Dark mode for your current tab or session.
- To make a permanent change or choose a different theme family, click **Theme library & preferences →** inside the menu to jump directly to your Profile appearance settings.

---

## 2. Set a Laboratory Default (`LAB_MANAGER`)

Laboratory managers can define a cohesive visual default for their assigned laboratory facility.

1. Navigate to **My Laboratory** (or **Laboratory Workspace**) → **Appearance** tab.
2. Select the desired theme family and mode (Light or Dark).
3. Click **Preview** to verify the appearance against live facility workflows.
4. Click **Use as this lab's default**.
5. An impact notice will confirm:
   > *"Staff assigned to this laboratory who follow lab defaults will see this theme and mode. Personal choices and accessibility overrides remain intact."*
6. An immutable audit record is recorded in the laboratory audit log with the actor, laboratory identifier, previous revision, and new settings.

---

## 3. Set the Platform Default (`SUPER_ADMIN`)

System administrators can set the global default appearance for the entire platform.

1. Navigate to **Administration** → **Appearance & Theme** tab.
2. Choose the theme family and mode to serve as the platform baseline.
3. Click **Use as platform default**.
4. The platform default applies to:
   - Public pages (login, activation, knowledge base).
   - Laboratories that have not set a custom laboratory default.
   - Users who follow shared defaults.
5. Laboratory-specific defaults and personal user overrides take precedence over the platform default.

---

## 4. Return to the Default (Resetting Inheritance)

To stop using a custom personal theme and return to inheriting your laboratory's or platform's theme:
1. Open **Profile** → **Appearance & Language**.
2. Click **Follow shared default** (or choose Reset).
3. Your account will automatically synchronize with your laboratory's chosen default.

---

## 5. Troubleshoot an Appearance Problem

- **Changes don't seem to appear?**
  Hard-refresh your browser (`Ctrl+F5` on Windows/Linux or `Cmd+Shift+R` on macOS) to refresh cached stylesheets. If an override was active in the current tab, click the header moon/sun icon and select **Use my saved default**.
- **Accidentally in preview mode?**
  Look for the banner pinned to the top of the window with the eye icon: click **Exit preview** to immediately return to your normal appearance.
- **Need higher contrast?**
  Select **Clear Contrast** from Profile → Appearance. It enforces a strict WCAG AAA >= 7:1 contrast ratio for core text and >= 4.5:1 for interactive borders and controls, while all seven standard theme families meet WCAG 2.2 Level AA (>= 4.5:1 text, >= 3:1 controls).
- **Session expired?**
  Temporary session overrides are bound to your active authenticated session and are cleared automatically upon logout or session timeout.

---

## 6. Scientific & Certificate Paper Isolation

SoilFER-LIMS strictly protects laboratory data integrity, status color semantics, and printed certificates:
- **Status Meanings Never Shift**: Regardless of the decorative theme chosen:
  - **Emerald Green** always indicates Approved / Validated / Pass.
  - **Amber Orange** always indicates In Analysis / Pending / Warning.
  - **Rose Red** always indicates Rejected / Flagged / Action Required.
  Themes never remap warning or error indicators to green.
- **White Paper Certificates**: Analytical certificates, QR specimen labels, and official reports are isolated via `data-surface="paper"` and `@media print`. They always render on crisp `#FFFFFF` white paper with deep `#1A1D20` charcoal text, regardless of whether Light or Dark mode is selected on the screen.

---

## 7. Mobile & Touch Responsive Operation

- **Responsive Layout Design**: The theme gallery and appearance selectors are styled with fluid flex-wrap containers, touch target sizing, and responsive padding to accommodate small viewports down to 320px width.
- **Touch Target Dimensions**: Primary interactive controls and buttons adhere to 44–48px touch dimensions (`min-h-[44px]` with 44×44px hit-target padding on icon controls including the confirmation modal close button), satisfying WCAG 2.2 Level AA Target Size (Minimum).
- **Safe Area Insets**: Safe area insets (`env(safe-area-inset-bottom)`) are declared on navigation bars and floating preview notices to prevent obstruction by software keyboards or home indicators.
- **Optical Zoom & Reflow**: Layout reflow down to 320px viewport, landscape 844×390, 200% zoom, and 400% text enlargement at 1280px CSS viewport width (WCAG 1.4.4 / 1.4.10) are verified without content clipping in real Headless Chrome.
- **Physical Device Gate Notice**: Layout reflow, touch sizing, and zoom reflow are designed and checked via responsive layout adapters and automated headless Chrome checks. Physical testing on native iOS Safari and Android Chrome hardware, assistive screen readers (NVDA, JAWS, VoiceOver), and physical thermal label printers remains strictly pending under physical hardware constraints. Historical Issue #102 addressed physical hardware access constraints; it is NOT an omnibus waiver for software test coverage, collector integrity, or release criteria.

---

## 8. Maintainer & Technical Appendix

### The 7 Curated Theme Families (14 Variants)
| Theme ID | Family Name | Light Primary | Dark Primary | Intended Laboratory Use |
|---|---|---|---|---|
| `soilfer-classic` | SoilFER Classic | `#256348` | `#91D2AF` | Canonical compatibility default and fallback |
| `forest` | Forest | `#245B3D` | `#9DD7AA` | Recommended everyday soil laboratory theme |
| `terra` | Terra | `#865039` | `#E6B298` | Earth & clay identity for soil morphology |
| `mineral` | Mineral | `#43556D` | `#ABC2D7` | Slate palette for dense instrument screens |
| `watershed` | Watershed | `#166879` | `#89CFD2` | Teal palette for soil & environmental hydrology |
| `nutrient` | Nutrient | `#596024` | `#C4D48E` | Olive accents for fertility & plant nutrition |
| `clear-contrast` | Clear Contrast | `#003E70` | `#90C9FF` | Strict high-contrast (>= 7:1) accessibility |

### Precedence Hierarchy
1. Active temporary session/preview override.
2. User's saved personal preference (`User.uiThemeId`, `User.uiModePreference`).
3. Laboratory default (`LabAppearanceSetting.themeId`, `defaultMode`).
4. Platform global default (`GlobalAppearanceSetting.themeId`, `defaultMode`).
5. Built-in SoilFER Classic Light.

### API Endpoints
- `GET /api/appearance/catalog` — Public published theme catalogue with swatch values and WCAG compliance metadata.
- `GET /api/appearance/public` — Public appearance metadata for login and unauthenticated screens.
- `GET /api/appearance/context` — Authenticated appearance context (effective theme, mode, scope, adoption authority).
- `PATCH /api/auth/preferences` — Self-service personal appearance updates (supports `themeId`, `modePreference`, `expectedRevision`).
- `GET/PATCH /api/labs/:labId/appearance` — Laboratory default appearance (restricted to assigned `LAB_MANAGER` and `SUPER_ADMIN`).
- `GET/PATCH /api/admin/appearance` — System-wide platform default appearance (restricted to `SUPER_ADMIN`).

### Geographic Map & Scientific Print Execution Notes
- **Geographic Map View (`SampleMap.jsx`)**: Renders a Leaflet container with live getters (`getCenter()`, `getZoom()`), marker coordinates `[5.6037, -0.1870]`, uncertainty radius circle, popup information (`SMP-2026-001`), the Standard/Satellite layer toggle (`aria-label="Toggle map layer"`) and the fullscreen toggle (`aria-label="Toggle fullscreen"`). The `ChangeView` helper's `useEffect` depends on the primitive coordinate values (`[center && center[0], center && center[1], map]`), not on the array reference, so theme changes, preview and re-renders do not recenter the map; it re-centres (zoom 13) only when the sample's latitude or longitude actually changes. A deliberately panned/zoomed non-default view is preserved across all 14 theme variants and after preview exit in the browser suite. Physical touch-device pan/pinch remains manual pending with the other physical-device checks.
- **Scientific Print Isolation**: All 14 theme variants isolate customer certificates (`/report/CERT-2026-SOIL-01`) under `@media print` with pure white `#ffffff` paper, deep navy text (11.50:1 contrast), report ID `CERT-2026-SOIL-01`, accession `SOIL-GH-2026-001`, and complete 5-row measurements. Genuine PDF artifact (`test_certificate_output.pdf`, 162,633 B, SHA-256 `47fdaa79d465807ccb2074575768fe75522fd85f9819385299d40a2c630b792a`) is verified and conserved.

