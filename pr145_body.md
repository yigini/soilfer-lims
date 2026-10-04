## Overview
Addresses the concrete Issue #113 UI acceptance gap identified in acceptance reassessment:
- Generic "Flag as Non-Conformance" checkbox previously remained enabled even when all quality checks were compliant, missing the disabled routine-choice acceptance criterion.
- Routine compliant outcome is now derived automatically when all checklist criteria are PASS (or 4 PASS + permitted walk-in CoC N/A).
- Routine non-conformance control is disabled and unchecked on compliant checklists, accompanied by a clear "ROUTINE COMPLIANT OUTCOME" badge.
- A clearly separate "Other problem not covered by checklist" path is exposed with a single unified description textarea (`data-testid="unified-nc-description"`), resolving both the routine separation and #117 independent problem survival.
- Failed and unanswered criteria remain explicit; correcting checklist items preserves any independently recorded other-problem history.

Refs #113
Refs #117

## Changes
1. **`client/src/components/reception/ComplianceChecklist.jsx`**:
   - Added `allCompliant` derivation (all items evaluated, zero FAIL, all PASS or permitted walk-in `CoC N/A`).
   - Routine non-conformance checkbox disabled (`disabled={allCompliant || !anyFail}`) and unchecked when routine compliant.
   - Separate "Other problem not covered by checklist" toggle (`data-testid="other-problem-checkbox"`) and unified description textarea (`data-testid="unified-nc-description"`).
   - Correction lifecycle in `setStatus`: preserving `nonConformance: true` and `reason` when an independent uncovered problem is recorded, while clearing routine NC when items pass.
   - Quick actions ("✓ Mark all OK" and "Reset all") updated to preserve independent uncovered problems.
2. **`server/tests/contracts/reception_compliance_component.test.js`**:
   - 21 component contract tests covering all-pass, permitted N/A, single fail, multiple fails, unanswered items, quick actions, legacy draft retention, and correction lifecycle without database dependencies (100% green).
3. **`server/scripts/verify_isolated_controls.cjs` & Artifacts**:
   - Isolated 4-step browser controls check executed against disposable synthetic DB in Headless Chrome CDP.
   - Evidence report (`reception_issue117_113_final_controls.json`, 4/4 passed).
   - Companion sidecar ledger (`reception_issue117_113_final_controls_sidecar.json`) recording measured candidate/source hashes, bundle hashes, metadata corrections, and attribution boundaries.
   - Preserved old-build failure report (`reception_issue117_113_final_controls_old_build.json`) documenting stale-build root cause.

## Verification & Attribution Ledger
- **Candidate Head & Source Provenance**:
  - Application candidate head: `429ee38650ce094861a5c1cec8fcfced8d34343a` (CI `36106785798` green)
  - `ComplianceChecklist.jsx`: SHA256 `749aeb8565af44edbc6c1f7e3d83ba136520474dc1ea802713a6fd30c92c663a`
- **Independent Contract & Mounted Verification**:
  - 21/21 PASS: Node component contracts (`server/tests/contracts/reception_compliance_component.test.js`)
  - 7/7 PASS: Mounted React transitions (`work/pr145-mounted-review-429ee38.cjs`) independently verified by Codex (legacy draft, subsequent FAIL/correction, routine-only UI/state agreement, one combined description, Reset all, Mark all OK, and serialized remount).
- **Client Build & Served Assets** (`npm run build` clean in Vite v5.4.21):
  - `Reception-DcbkS6KK.js`: SHA256 `7f63addebf6a98165a91dc1b0c01db6633633dffd78cefb2eeb9a12abf1b8ef3`
  - `index-DTEVE5HW.js`: SHA256 `5e3e9c94817b8cc093211a15a1999b8ac58e59d0bad55f07013522651a427761`
  - `index-DvT2i1qH.css`: SHA256 `2932e810bde9bc01eb66f53c6ed74ff95437eaae841954d4444334a2ee76d315`
- **Browser Journey (Headless Chrome CDP)**:
  - 4/4 PASS (`server/scripts/verify_isolated_controls.cjs` at `2026-09-25T08:01:17.505Z`)
- **Attribution Limits**:
  - Browser runner interacts via scripted DOM clicks and native property setters with React 18 `_valueTracker` adjustments (`window.setCheck`).
  - No claim of full browser reload or real keyboard/pointer hardware interaction in the 4-step runner.
  - Diagnostic React props extraction reflects initial mount data and is not authoritative submitted state.
  - Correction survival and serialized remount lifecycle are authoritative covered by the 21 component contracts and 7 mounted transitions.
  - Metadata in raw 08:01 report contains legacy inherited constants (`v3.5.25`, working tree vs HEAD cleanliness, filesystem mtime) explicitly annotated in `reception_issue117_113_final_controls_sidecar.json`.
- **Security & Authorization**: Zero changes to server policy, permission gates, or manager exception enforcement (`403 COMPLIANCE_FAILURE_EXCEPTION_REQUIRED`). Isolated disposable DB execution; zero production mutations.
