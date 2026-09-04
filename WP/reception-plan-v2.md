# SoilFER-LIMS — Sample Reception, Reworked

**Volume XIV (rev. 2) · agent-executable implementation plan**

| | |
|---|---|
| Packages | 19, in 6 stages |
| Baseline | `e7e0118` · traced 3 September 2026 |
| Scope | `Reception.jsx` (1321) · `WalkInForm.jsx` (391) · `LocationPicker.jsx` (339) · `SampleMap.jsx` (66) · `ComplianceChecklist.jsx` · `receptionController.js` |
| Supersedes | Volume XIV rev. 1, which under-read the location stack and got two facts wrong (see Corrections) |

---

## Corrections to rev. 1

Before anything else, two things I stated that were wrong:

- **Composite sampling is already captured.** `sampling.isComposite` and `sampling.subsamples` exist
  in state. Rev. 1 listed them as missing. What is actually missing is the *geometry* of a composite —
  see L-07.
- **The location stack is much better than I described.** `LocationPicker` has capture methods,
  a confidence model, an interactive Leaflet map, reverse geocoding, a remembered map centre, and a
  mandatory reason when confidence is low. Rev. 1 implied location was a pair of text fields. It is
  not. The findings below are consequently narrower and sharper.

---

# Part 1 · How samples actually arrive

Everything in this plan follows from three arrival patterns. The current page serves the second one
well, the first one poorly, and the third not at all.

### Archetype A — The project campaign *(the SoilFER case, most of the volume)*

A field team samples 40 to 500 points over days or weeks, recording each on Kobo on a phone: GPS
taken standing at the point, depth, land use, crop, photograph. The bags travel by road, sometimes
for weeks, and arrive as a consignment with a paper manifest.

**Location is already known and was captured better than reception ever could.** The desk's job here
is *verification*, not capture: does this bag match its expected record, is anything obviously wrong,
did the field team miss GPS on any point. Asking reception to re-enter location here is not just
wasted time — it replaces a field-grade coordinate with a desk guess.

### Archetype B — The walk-in *(what the page is built for)*

A farmer or extension officer arrives with one to five bags. Often no GPS, sometimes a phone photo,
usually a verbal description: *"the plot behind the school at Aldea El Rosario"*. Location must be
reconstructed at the counter, in conversation, in the local language, in about ninety seconds, with
the person standing there waiting.

This is the hard case, and `LocationPicker` is a genuine attempt at it.

### Archetype C — The institutional client *(no path at all today)*

A company, university, NGO or ministry sends 20–200 samples with their own spreadsheet. Coordinates
arrive in whatever the client uses: decimal degrees, degrees-minutes-seconds, **UTM** with a zone, or
a plot code from their own register. Today the only route is typing each one by hand, which nobody
will do — so this data enters the LIMS stripped of its location, or does not enter at all.

---

# Part 2 · What must be captured, and from where

The test for every field: **could anyone record this later?** If yes, it does not belong at the desk.

| | Campaign (A) | Walk-in (B) | Institutional (C) |
|---|---|---|---|
| Identity | Kobo record, verified by barcode | Assigned at desk | Client manifest column |
| **Location** | **From the field — verify, never re-enter** | **Reconstruct at counter** | **Parse from manifest** |
| Received mass | Weigh at desk | Weigh at desk | Weigh at desk |
| Condition on arrival | Observe at desk | Observe at desk | Observe at desk |
| Moisture on arrival | Observe at desk | Observe at desk | Observe at desk |
| Depth | From Kobo | Ask | Manifest |
| Land use / crop | From Kobo | Ask | Manifest |
| Custody | Courier + manifest | Person at counter | Courier + manifest |
| Analyses | Project default | Ask | Manifest / order form |

Three rows are desk-only and unrecoverable: **mass, condition, moisture**. Those are the same three
rev. 1 identified and they stand.

---

# Part 3 · Location — the findings

### L-01 · Two capture methods, where the world needs six · `P0`

`CAPTURE_METHODS` offers `MAP_PIN` and `TEXT_ONLY`. Four are missing, and each maps to a real
person standing at the counter:

| Missing method | Who needs it |
|---|---|
| **Type or paste coordinates** | The officer has them on their phone, in a WhatsApp message, or written on the bag. Today they must find that point on a map by eye — which throws away the precision they arrived with. |
| **Use my current location** | `navigator.geolocation` appears nowhere in the codebase. For a field station, a mobile intake, or a plot near the lab, that is one tap. |
| **Administrative unit picker** | Department → municipality → village. This is how people in these countries actually describe where a field is, and it is what makes the data joinable to national statistics later. |
| **Same as previous sample** | In a campaign or a multi-bag walk-in, consecutive samples are usually from one farm. `localStorage.lastIntakeLocation` already recentres the map — it should be a one-click reuse. |

The paste path must accept **decimal degrees, DMS (`14°48'12"N`), and UTM with a zone**. UTM is not
optional: Guatemala is 15N/16N, Zambia 35S, Kenya 36S/37S, and it is what national datasets and most
handheld GPS units use in these countries.

### L-02 · Confidence is declared, not derived · `P1`

Three chips the operator picks, auto-set to `MEDIUM` on a map click and `LOW` on text-only. But a pin
dropped by a receptionist who has never seen the field is not medium-confidence merely because it is
a pin. Confidence should be **computed** from evidence the system already has or could have:
GPS accuracy in metres, whether the fix came from the field device or was reconstructed at the desk
weeks later, whether it was reverse-geocoded or confirmed by the person who sampled.

Store `locationSource` (FIELD_GPS / DESK_PIN / DESK_PASTE / ADMIN_UNIT / CLIENT_MANIFEST),
`capturedAt`, `capturedBy`, and derive the label. Keep the manual override, but make it an override —
recorded as one.

### L-03 · No uncertainty radius, which is the number that actually travels · `P0`

A soil point going into a national SIS, a digital soil mapping model, or the spectral library's
metadata needs positional uncertainty **in metres**. `MEDIUM` is not a number and cannot be used by
anyone downstream.

Add `positionalUncertaintyM`, defaulted from the capture method and editable:

| Capture | Typical uncertainty |
|---|---|
| Survey-grade / RTK | 0.5 m |
| Phone GPS, open sky | 5–15 m |
| Phone GPS, under canopy | 20–50 m |
| Map pin at zoom ≥ 16 | 25 m |
| Map pin at zoom 13 | ~500 m |
| Village centroid | 1–5 km |
| District centroid | 10–50 km |

This is the single most consequential location field for the data's onward scientific life, and it is
the cheapest to add — the map already knows its zoom level, and the browser already reports GPS
accuracy.

### L-04 · Reverse geocoding calls OpenStreetMap from the browser · `P1`

`WalkInForm.jsx:357` — `fetch('https://nominatim.openstreetmap.org/reverse?...')` on every coordinate
change. Three problems, in ascending order of seriousness:

1. Nominatim's usage policy requires an identifying User-Agent and roughly one request per second.
   A batch intake breaches it, and OSM blocks by IP — meaning the whole laboratory loses geocoding.
2. It fails silently when the connection is poor, which describes most of these laboratories most of
   the time. The operator sees nothing and assumes the blank fields are normal.
3. It sends the coordinates of every sample to a third party. For FAO project data that should be a
   decision someone made, not a side effect of a convenience feature.

Proxy it server-side with a cache, and ship an offline administrative-boundary lookup for the seven
deployment countries so the common case needs no network at all.

### L-05 · In the dominant case, reception sees a debug dump · `P0`

For PROJECT samples — Archetype A, the bulk of SoilFER volume — the field record renders as:

```jsx
{Object.entries(sampleData.fieldMetadata).slice(0, 6).map(([k, v]) => ...)}
```

The **first six keys**, in whatever order Kobo sent them, camelCase split by regex, with
`JSON.stringify` as the fallback for objects. Coordinates may not be among the first six. And the map
renders only `{(sampling.coordinates || ...) && ...}` — so when the parse misses, there is no map and
no statement that there is no map.

Replace with a designed field-record card: collected by, collected on, coordinates with accuracy,
depth, land use, crop, photograph if present — and **always** the map, showing
*"No coordinates recorded in the field"* explicitly when absent. That sentence is actionable at
intake: the field team can still be called today. In three weeks it cannot.

### L-06 · No batch geometry check · `P2`

The classic field-campaign error is transposed labels. A cheap check catches most of them: when
receiving a consignment, flag any sample whose expected coordinates sit far outside the cluster of
the rest — *"P-14 is 40 km from the other 39 points in this batch."* One query, one warning, at the
only moment it can still be resolved by a phone call.

### L-07 · A composite is not a point · `P2`

`isComposite` and `subsamples` are captured, but the location is stored as a single coordinate. A
composite is a centroid with a radius, or a polygon. Record `compositeRadiusM` at minimum, and let
`positionalUncertaintyM` inherit from it — a 20-sub-sample composite over a two-hectare field is a
±80 m point, not a ±10 m one, whatever the GPS said.

Related: `depthType: '0-20'` alongside a free-text `depth` is ambiguous — is that the horizon or the
increment? Store `depthTopCm` and `depthBottomCm` as numbers.

---

# Part 4 · Design

The page works. These are the things that make it feel less finished than it is.

- **D-01 · Amber means four different things.** Manual-entry capture, low confidence, regulatory
  purpose, and warning all use amber; blue marks map-pin, medium confidence, and the bundle selector.
  Colour is decorative here rather than semantic, so nothing tells the operator which amber matters.
  One severity ramp, used only for severity; categories get shape or position, not hue.
- **D-02 · The map appears conditionally and shifts the page.** *Location Preview* renders only once
  coordinates exist, pushing everything below it down mid-entry. Reserve the space and show the empty
  state.
- **D-03 · Section numbering starts at 3.** `WalkInForm` numbers its own sections — *"3. Sampling
  Location"* — but the numbering lives inside a component the surrounding page doesn't participate in,
  so a heading numbered 3 appears with no 1 or 2 above it in the same column.
- **D-04 · `relative z-0` on the location card** (`WalkInForm.jsx:324`) is a stacking-context
  workaround, almost certainly Leaflet's panes fighting the autocomplete dropdown. It will break the
  first time either changes. Fix the layering properly.
- **D-05 · An emoji heading** (`📍 Location Preview`) sits among lucide icons everywhere else.
- **D-06 · No keyboard path.** Chips, selects and map are all mouse-driven. A desk running 40 samples
  an hour needs to complete an intake without leaving the keyboard.
- **D-07 · Errors are reported at the bottom of a long scroll.** `validationErrors` collects into a
  list at the submit button, so a problem in section 1 is announced two screens below it. Anchor each
  error to its field and scroll to the first.

---

# Part 5 · Work packages

### Stage A — Desk-only facts *(4 days)*

**RC-01 · Received mass and sufficiency check** · `P0`
`grep -ci "mass\|weight" Reception.jsx` → **0**. Add `Sample.receivedMass` (g), required at intake, and
`Analysis.sampleMassRequired` in the catalogue. Sum the requirement across ordered analyses plus
configured retention; warn — do not block — naming the deficit and which analyses are at risk.
*A full fertility package with pipette texture and a spectral scan needs ~500 g of air-dry fines; texture alone takes 40–50 g, CEC 2.5–5 g per replicate. Today the shortfall surfaces at the bench three days later, after grinding.*
**Accept** — 150 g against a 500 g package warns, names the deficit, and records the operator's acknowledgement.

**RC-02 · Moisture and foreign material at arrival** · `P1`
Add moisture on arrival (DRY / MOIST / WET / SATURATED) and foreign material (roots, stones, plastic;
present/absent, removed or not). Both change drying regime and fines yield, and neither is recoverable.
*Composite state is already captured — do not re-add it.*
**Accept** — both reach the sample record and the certificate's description block.

**RC-03 · Decide the photo path** · `P1`
`receptionController.js` reads `req.body.photos` at two places; `grep -c "photos" Reception.jsx` → **0**.
Seventh one-sided path in this codebase. Wire capture on the non-conformance path — a rejection with a
photograph is defensible, one without is an argument — or delete the server field.
**Accept** — photographs are retrievable, or the server field is gone.

**RC-04 · Duplicate and re-submission detection** · `P1`
On scan, surface any prior receipt of that field ID with date, lab ID and status, and make the operator
choose: genuine re-submission, or error.
**Accept** — an already-received field ID is flagged before any form is filled.

### Stage B — Location *(1 week — the heart of this revision)*

**RC-05 · Four more capture methods** · `P0` — paste (DD / DMS / **UTM with zone**), device
geolocation, administrative-unit picker, same-as-previous. **Accept** — a UTM 15N pair typed at the
counter lands as the correct point; the officer never hunts for it on a map.

**RC-06 · Positional uncertainty in metres** · `P0` — `positionalUncertaintyM`, defaulted from capture
method and map zoom, editable, exported everywhere the coordinate goes. **Accept** — every sample with
a coordinate has an uncertainty; a zoom-13 pin defaults near 500 m, a device fix to its reported accuracy.

**RC-07 · Derive confidence from evidence** · `P1` — add `locationSource`, `capturedAt`, `capturedBy`;
compute the label; keep manual override but record it as an override. **Accept** — a desk pin on a
sample collected three weeks earlier cannot silently read as high confidence.

**RC-08 · Proxy and cache geocoding; ship offline boundaries** · `P1` — server-side proxy with a
User-Agent and a cache, plus offline admin boundaries for the seven countries. **Accept** — intake
completes with no internet; no sample coordinate leaves the deployment by default.

**RC-09 · A real field-record card for project samples** · `P0` — replace the `slice(0, 6)` dump with a
designed card, and render the map always, stating *"No coordinates recorded in the field"* when absent.
**Accept** — reception can see, without scrolling or guessing, where the sample came from and whether
the field team missed GPS.

**RC-10 · Batch geometry outlier check** · `P2` — flag a sample far outside its consignment's cluster.
**Accept** — a transposed label 40 km out is flagged at intake.

**RC-11 · Composite geometry and depth as numbers** · `P2` — `compositeRadiusM` feeding
`positionalUncertaintyM`; `depthTopCm` / `depthBottomCm` replacing the ambiguous `depthType`.
**Accept** — a 2 ha composite reports a radius-derived uncertainty, not its GPS accuracy.

### Stage C — Consignment intake *(1 week)*

**RC-12 · Consignment record** · `P1` — `Consignment { labId, projectCode, submitterId, deliveredBy,
deliveredAt, receivedBy, receivedAt, deliveryNoteRef, sampleCount, notes }`.

**RC-13 · Batch receive** · `P1` — scan all barcodes into a list with a running count against the
delivery note; apply submitter, project, checklist and condition once; submit once.
**Accept** — forty samples received in one pass, each carrying the consignment id.

**RC-14 · Exceptions inside a batch** · `P1` — override per sample without leaving the batch; two
damaged bags rejected with reasons, 38 accepted, one submission.

**RC-15 · Manifest import for institutional clients** · `P2` — Archetype C. Upload the client's
spreadsheet, map columns to fields once per client, parse coordinates in any of the three formats,
review, receive. **Accept** — a 200-row client manifest is received without typing a coordinate.

### Stage D — Desk ergonomics *(3 days)*

**RC-16 · Wedge-scanner mode** · `P2` — the autocomplete debounce (`Reception.jsx:442`) fires at
`length >= 2` and races a wedge that types the code plus Enter in ~50 ms. Add a mode where Enter
submits, the field clears, and focus returns. **Accept** — forty consecutive scans, no mouse, no loss.

**RC-17 · Print the label where the ID is born** · `P2` — `LabelPrintDialog` exists; offer it on the
acceptance result and print-all for a consignment.

**RC-18 · The design set** · `P2` — D-01 through D-07 as one pass: one semantic colour ramp, reserved
map space, coherent section numbering, proper layering instead of `relative z-0`, icon consistency, a
full keyboard path, and errors anchored to their fields.

### Stage E — Custody and rejection *(3 days)*

**RC-19 · Rejected is not awaited; and custody worth the name** · `P1`
Non-conformance reverts to `EXPECTED` (`receptionController.js:118–124`), so a rejected sample is
indistinguishable from one still in transit — wrong counts, no client notice, no history if it returns.
Give it `RECEIVED_REJECTED`. In the same package: custody is a free-text `cocDeliveredBy`; add the
hand-over time as distinct from data-entry time, the receiving officer as a user reference, and a
counter-signature.
**Accept** — rejected samples never counted as awaited; custody answers who handed over, who received,
and when, each separately.

### Stage F — Hold the line

**RC-20 · Reception contract tests** · `P1` — mass sufficiency and its acknowledgement path; the three
coordinate formats; uncertainty defaults per capture method; derived confidence resisting an
unevidenced HIGH; offline intake with geocoding unavailable; a 40-sample consignment with two
exceptions; rejected-state distinctness; the three custody timestamps.
**Accept** — every package above has a test that fails before it and passes after.

---

# Definition of done

| Assertion | Check |
|---|---|
| No sample accepted without a received mass | RC-01 |
| Shortfall surfaces at the desk, not at the bench | RC-01 |
| A coordinate can be typed, pasted or read from the device | RC-05 |
| Every coordinate carries an uncertainty in metres | RC-06 |
| A desk pin cannot read as field-grade confidence | RC-07 |
| Intake completes with no internet | RC-08 |
| Reception always sees where the sample came from | RC-09 |
| Forty samples received in one pass | RC-13 |
| A 200-row client manifest needs no typed coordinates | RC-15 |
| One colour ramp, used only for severity | RC-18 |
| Rejected is never counted as awaited | RC-19 |

---

## One instruction to carry through every package

Reception is measured in samples per hour, and the desk sets the whole laboratory's throughput. Every
package here adds a field or a mode; **none of them may make the existing single-sample walk-in flow
slower by one keystroke.** Where a new field cannot be filled quickly, give it a default that is
honest — an uncertainty of 500 m recorded is worth more than a precision of 10 m invented.

---

*SoilFER-LIMS · Volume XIV rev. 2 · sample reception · 3 September 2026 · 19 packages · 6 stages ·
audit and design only, no changes made*
