# Walk-in Sampling Location Improvement Plan (Practical Intake Workflow)

Date: 2026-02-19
Owner: Reception + Product + Backend teams

## 1) Objective
Improve how sampling location is captured for walk-in samples so:
- Intake officers can complete intake fast at the counter.
- Customers can confirm location accurately without technical friction.
- Location data is reliable for interpretation, traceability, and mapping.

## 2) Current Gaps (Observed in Code)
- Location is accepted as either GPS or free text, but there is no guided structure for real-world intake quality.
- Walk-in intake stores `samplingDetails.location`, while downstream views also rely on keys like `locationDescription` / `siteName`.
- Location picker defaults to a fixed map center (Guatemala), which is impractical for other labs.
- No explicit "capture method" (customer phone pin, memory-based, map click, etc.) and no confidence level beyond basic accuracy.

Relevant files:
- `soilfer-lims/client/src/components/reception/WalkInForm.jsx`
- `soilfer-lims/client/src/components/reception/LocationPicker.jsx`
- `soilfer-lims/client/src/pages/Reception.jsx`
- `soilfer-lims/server/controllers/receptionController.js`
- `soilfer-lims/client/src/components/sample/MetadataEditorModal.jsx`

## 3) Practical Real-Life Intake Workflow (Counter SOP)
1. Ask one mandatory question first: "Where exactly was this sample taken?"
2. Intake officer chooses one capture mode:
   - `GPS from customer phone` (best)
   - `Pin on map` (good)
   - `Text-only location` (fallback)
3. Officer confirms location verbally with customer using a read-back:
   - village/area + nearest landmark + approximate distance/direction.
4. Officer sets confidence level:
   - `High` (GPS verified)
   - `Medium` (map pin + customer confirmation)
   - `Low` (text-only memory)
5. If confidence is low, system enforces a short reason note.
6. Intake complete only after officer and customer confirm location summary on-screen.

## 4) Product/UI Changes (Front-end)
### 4.1 Walk-in Location Section
In `WalkInForm.jsx` + `LocationPicker.jsx`:
- Add `Capture Method` chips: `GPS Phone`, `Map Pin`, `Text Only`.
- Add `Location Confidence` chips: `High`, `Medium`, `Low`.
- Add structured text fields for practical intake:
  - `Site/Farm Name`
  - `Area/Village`
  - `District/County`
  - `Nearest Landmark`
- Keep current lat/lng entry, but include coordinate validation range and decimal precision hint.
- Replace hardcoded default map center with:
  - lab default center from settings, or
  - last used intake location (localStorage), then
  - country/lab fallback.

### 4.2 Validation Rules
In `Reception.jsx`:
- Keep existing requirement (GPS or location text), but strengthen:
  - Require at least two text anchors when no GPS exists (`Area/Village` + `Landmark`).
  - If confidence is `Low`, require `locationUncertaintyReason`.
- Show clear inline errors directly in location section (not only dialog).

## 5) Data Contract Standardization (Backend)
In `receptionController.js`:
- Canonicalize incoming walk-in location fields into stable metadata keys:
  - `siteName`
  - `locationDescription`
  - `admin1`
  - `admin2`
  - `landmark`
  - `latitude`
  - `longitude`
  - `gpsAccuracy`
  - `locationCaptureMethod`
  - `locationConfidence`
  - `locationUncertaintyReason`
- Continue writing legacy keys (`location`) for compatibility during transition.
- Store normalized `samplingDetails.locationCanonical` object for future reports/API use.

## 6) Reporting & Downstream Consistency
- Ensure sample views and exports prefer canonical keys first (`siteName`/`locationDescription`) and fallback to legacy keys.
- Update map/location endpoints to read canonical fields first, then legacy fields.

## 7) Implementation Phases
### Phase 0 (1 day) - Alignment
- Confirm final field names, confidence definitions, and SOP script with reception lead.

### Phase 1 (2-3 days) - Quick Win UX
- Add capture method + confidence + structured location fields.
- Improve validation and default map behavior.

### Phase 2 (2-3 days) - Backend Canonicalization
- Normalize location fields in intake controller.
- Add compatibility mapping for old data.

### Phase 3 (1-2 days) - QA + Training
- Test walk-in scenarios:
  - GPS available
  - GPS denied/no internet
  - text-only memory-based location
- Run a 30-minute intake officer drill with 5 mock customers.

## 8) Acceptance Criteria (Operational)
- 95% of new walk-ins have either valid GPS coordinates or structured text location (area + landmark).
- Average location capture time remains under 90 seconds.
- <2% of walk-ins require post-intake location clarification calls.
- Intake officers can complete the workflow with no training material after one guided session.

## 9) Test Checklist
- Frontend form validation tests for each capture mode.
- API contract tests ensuring canonical + legacy fields are persisted safely.
- Regression test: existing sample detail pages still show location for old records.

## 10) Rollout Recommendation
- Release behind a feature flag: `walkin_location_v2`.
- Enable for one lab first for 1 week.
- Review KPIs and user feedback, then roll out globally.
