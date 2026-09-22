# Real Mobile Device Testing Sheet (#102)

**Work Package**: `WP/contributor-issues-2026-09`  
**Issue**: [#102 Mobile usability, touch interaction, and layout issues](https://github.com/yigini/soilfer-lims/issues/102)  
**Target Environments**: iOS Safari (iPhone 12/13/14/15/SE, iOS 16+) & Android Chrome (Pixel, Samsung Galaxy, Android 12+)  
**Policy**: Emulation and browser devtools provide supplemental regression checks, but real physical hardware evidence is mandatory for closure. No invented passes.

---

## Device & Environment Execution Record

| Tester | Device Model | OS Version | Browser & Version | Release SHA | Roles Tested | Execution Date | Status |
|---|---|---|---|---|---|---|---|
| _[Name / GitHub]_ | iPhone 14 Pro | iOS 17.5 | Safari 17.5 | `Pending Release` | `SAMPLE_RECEPTION`, `LAB_TECHNICIAN` | `YYYY-MM-DD` | `Pending` |
| _[Name / GitHub]_ | Samsung Galaxy S23 | Android 14 | Chrome 128 | `Pending Release` | `LAB_MANAGER`, `SAMPLE_RECEPTION` | `YYYY-MM-DD` | `Pending` |

---

## Verification Test Matrix

### 1. Touch Targets & Virtual Keyboard Interaction
- [ ] **Sticky Headers & Tab Bars**:
  - Top header and bottom mobile navigation bar maintain safe-area insets (`env(safe-area-inset-bottom)`) without obscuring interactive controls.
  - Sticky sub-headers in Reception and Samples Filter Bar do not jump or jitter during rapid scrolling.
- [ ] **Virtual Keyboard & Input Focus**:
  - Tapping input fields (e.g. sample lookup, search, measurement entry) pans the active input into view without zooming the entire viewport (ensuring `font-size: 16px` on mobile inputs).
  - Dismissing the keyboard restores the viewport height without creating orphaned whitespace or hidden bottom bars.
- [ ] **Touch Target Sizing**:
  - All primary and secondary buttons, filter pills, and icon toggles meet WCAG minimum 44×44px touch targets.
  - Close buttons (`X`), back navigation arrows, and layer toggles operate reliably on thumb taps.

### 2. Workspace Tabs & Horizontal Scrolling
- [ ] **Tab Bar Scrolling**:
  - Multi-tab controls in Technician Workbench (`/workbench`) and Manager Task List (`/manager-queue`) scroll smoothly horizontally with momentum and visual edge fading.
  - Active tab indicator remains visible and aligned during scroll.
- [ ] **Table Responsiveness**:
  - Data tables in Samples (`/samples`), Work Items (`/my-work`), and Inventory (`/inventory`) render responsive card projections or provide accessible horizontal scroll indicators.
  - Sticky first column (if enabled) aligns seamlessly with body cells without z-index bleed.

### 3. Modals, Drawers & Portals
- [ ] **Mobile Sheet & Drawer Operation**:
  - Mobile "More" sheet (`MobileMoreSheet`) slides up smoothly from bottom, traps focus, and closes via backdrop tap or downward swipe.
  - Context help drawer and notification drawer animate cleanly without layout shifts.
- [ ] **Dialogs & Label Printing**:
  - Label print modal (`LabelPrintDialog`) fits within mobile screen bounds without horizontal clipping.
  - Format toggles (Standard 101×54mm vs Vial 50×25mm) switch accurately on touch.

### 4. Hardware Camera Permissions & Barcode Scanner
- [ ] **Camera Permission Request**:
  - Scanning route (`/scan`) requests rear camera permission with clear explanatory rationale.
  - Denying and re-prompting permission recovers gracefully with instructions rather than a blank viewfinder.
- [ ] **Live Barcode / QR Recognition**:
  - Scanning sample QR code or Code-128 barcode parses canonical ID and redirects directly to sample detail or intake desk.
  - Camera stream cleanly terminates and releases hardware when navigating away.

### 5. Offline Outbox & Local Storage
- [ ] **Offline Draft Persistence**:
  - In airplane mode, sample intake drafts and offline test entries persist locally in IndexedDB.
  - Reconnecting to network automatically triggers background sync without data collision or prompt loops.

---

## Issue Acceptance Criteria for Closure
1. Minimum two independent real-device verification logs recorded (at least one physical iOS Safari device and one physical Android Chrome device).
2. All 5 test sections confirmed passing on deployed release candidate.
3. Specific findings, screen captures, or limitations documented before issue closure.
