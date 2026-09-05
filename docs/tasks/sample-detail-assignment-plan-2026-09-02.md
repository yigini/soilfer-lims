# SoilFER-LIMS — Sample Detail, Assignment and State Integrity

**Volume XIII · agent-executable implementation plan**

| | |
|---|---|
| Packages | 17, in 5 stages |
| Baseline | `ca0fdde`, traced 2 September 2026 |
| Estimate | ~3 weeks, single developer |
| Hard rule | Stage 0 is live production exposure — do it first |
| Source | Four bugs reported from testing, plus the source trace around them |

---

## The cause underneath

Four separate symptoms, one shape: **the system keeps two records of the same fact and never
reconciles them.**

- The analyses ordered on a sample live in `Sample.requiredAnalyses`. The work to do them lives in
  `WorkItem` rows. Editing the first never touches the second.
- Whether a technician may start lives in the client's `effectiveBlocked`. Whether the server will
  let them lives nowhere — `assignWork` has a comment saying it checks prerequisites and no check.
- Which laboratory owns a sample lives on the sample. Which laboratory an assignment is validated
  against is the *manager's* lab, and only when the actor happens to be a manager.
- Which state a sample is in is decided by `transitionSample` on the server — except the client
  walks it through `APPROVED` first when it wants `ARCHIVED`, with the reason string
  `"Intermediate Step for Archiving"`.

Each fix below closes one of those gaps. Do not paper over any of them in the client.

---

## Guardrails

- **Do not run anything against production.** `lims.yigini.net` holds seven laboratories' live data.
- **One commit per package**, referencing the SD id. The last five stages of spectral work went in as
  five batched commits and three defects rode along inside them — that is what this rule prevents.
- **A default must fail closed.** A column default that asserts a fact nobody supplied
  (`quantity @default("ABSORBANCE")`) is the same defect as a fail-open guard.
- **A client-side check is not a control.** Every rule in this plan is enforced server-side; the
  client may mirror it for feedback, never instead of it.
- **Never silently destroy a record of ordered work.** A laboratory must be able to say what was
  ordered, by whom, and what became of it. Removal is deletion only when nothing has happened yet;
  otherwise it is a waiver with a reason.
- **If a package's acceptance criteria cannot be met, stop and report.** Do not substitute a partial
  implementation and mark it done.

---

# Stage 0 — Live exposure

**Half a day. Do this before anything else.** These are reachable on the deployed system now.

### SD-01 · Close the API-key lab fail-open · `P0`

- **Files** — `server/controllers/sisController.js` (shared scoping helper, ~line 46) ·
  `server/middleware/apiKeyAuth.js`
- **Do** — SL-22 hardened `getSpectra`, which now denies on an empty scope. The *shared* helper the
  other endpoints use still reads:

```js
const keyLabs = sisAuth?.labs || [];
const hasGlobalLab = keyLabs.length === 0 || keyLabs.includes('*');   // empty === global
```

  Meanwhile `apiKeyAuth` now sets `labs: []` whenever the column is absent, with a comment claiming
  that means deny. So every pre-existing API key without a `labs` value has unrestricted laboratory
  access on `/samples`, `/results`, `/geojson`, `/sync` and `/stats`. Make empty mean deny, and make
  `['*']` the only way to express global. Audit every key in production afterwards.
- **Accept** — Test: a key with no `labs` value reads nothing outside its country scope on all five
  endpoints. Reverting the line turns the test red.

### SD-02 · Isolation belongs to the sample, not the actor · `P0`

- **Files** — `server/controllers/workItemController.js` — `assignWork`, `reassignWork`
- **Do** — Both guard the laboratory only inside `if (user.role === 'LAB_MANAGER')`, so SUPER_ADMIN
  and MASTER_USER skip it entirely — a Guatemala sample can be assigned to a Mozambique technician.
  And even for a manager the comparison is `techUser.labId !== user.labId`, the *manager's*
  laboratory rather than the *sample's*.
- **Detail** — One unconditional rule for every role:

```js
const owningLab = sample.assignedLab || sample.labId;
if (!owningLab || techUser.labId !== owningLab) {
  return res.status(403).json({ error: `Technician ${techUser.username} (${techUser.labId}) is not in ${owningLab}` });
}
```

  A super admin may act *across* laboratories; they must not be able to *create* a cross-laboratory
  assignment. Chain of custody is a property of the sample.
- **Accept** — Test: SUPER_ADMIN assigning a LAB-GTM sample to a LAB-MOZ technician gets 403. A
  LAB-GTM manager assigning to a LAB-GTM technician succeeds. Extend WP-41's isolation suite to
  cover both endpoints.

---

# Stage 1 — The four reported bugs

**3–4 days.** Everything a user meets on the sample detail page.

### SD-03 · Reconcile work items when the analysis list changes · `P0`

- **Files** — `server/controllers/sampleController.js` — `updateSampleAnalyses` (line 1658) ·
  `server/controllers/workItemController.js` — `generateWorkItemsForSample`
- **Do** — The controller writes the new `requiredAnalyses` correctly, then calls
  `generateWorkItemsForSample`, which is add-only (`if (existing) continue;` then `create`). Nothing
  removes the item for an analysis taken off the list. The field updates; the work does not.
  Replace the one-way generate with a three-way reconcile:

| Removed item's state | Action |
|---|---|
| `NOT_ASSIGNED`, no result | Delete the row, audit the deletion |
| Assigned or in progress, no result | Require a reason; set `WAIVED` with that reason and the actor; audit |
| Any result recorded (current or superseded) | **Refuse** with 409, naming the analysis and the result |

  Return the three sets in the response so the client can report "2 added, 1 waived, 1 refused"
  instead of a silent success.
- **Why it matters beyond the visible symptom** — an orphaned item counts in the sample's
  denominator, sits in a technician's queue indefinitely, and since WP-09 blocks disposal, because a
  terminal transition is refused while any work item is non-terminal.
- **Accept** — Tests: removing an unstarted analysis removes its work item; removing an in-progress
  one waives it with the reason recorded; removing one with a result is refused; the progress
  counter matches the list immediately afterwards.

### SD-04 · A bundle replaces the selection, it does not merge into it · `P0`

- **Files** — `client/src/components/sample/AnalysisUpdateModal.jsx` — `handleApplyBundle` (~line 53)
- **Do** — Currently `Array.from(new Set([...currentAnalyses, ...group.analyses]))`, with a comment
  saying the merge is deliberate. Combined with SD-03 that makes the list monotonically increasing in
  two independent places. Applying a bundle should set the selection to that bundle. If a manual
  addition would be lost, say so and ask — do not silently keep it.
- **Accept** — Applying "Complete Spectroscopy & Radiometry" over a fertility package yields the
  spectroscopy bundle, with any dropped manual additions named in a confirmation.

### SD-05 · Move the prerequisite gate to the server — and let assignment run ahead of it · `P0`

- **Files** — `server/controllers/workItemController.js` — `assignWork` ·
  `client/src/components/sample/WorkItemsTable.jsx`
- **Do** — Both client paths hit the same server code: `assignSingle` (line 456) rewrites the body
  and calls `assignWork`. The difference is entirely in the client — the per-row `<select>` is
  disabled on `effectiveBlocked` (line 455, the drying/preparation lock at 391–411) while the batch
  button is disabled only on `!selectedTech`. `assignWork` carries the comment *"Fetch all work items
  for each sample to check prerequisites"* and then checks none. So the banner
  *"ANALYSIS LOCKED — Drying must be COMPLETED first"* is not a control, and the batch path walks
  past it.
- **Decision, and a recommendation** — **Assignment should be permitted before the gate; starting
  work and entering a result should not.** A manager plans tomorrow's bench while samples are still
  in the oven — blocking assignment is what forced the batch workaround. Implement the check in
  `startWork` and in `saveResults`, returning 409 naming the blocking gate, and remove
  `effectiveBlocked` from the assignment control. If the laboratory wants assignment blocked too,
  that is a per-laboratory setting, not a hard-coded rule.
- **Accept** — Test: assigning a chemical determination before drying succeeds; starting it returns
  409 naming drying. Both client controls behave identically because both call the same endpoint with
  no local gate of their own.

### SD-06 · One permission gate on the analyses endpoint · `P1`

- **Files** — `server/routes/sampleRoutes.js:22` · `server/controllers/sampleController.js`
- **Do** — The route requires `CHANGE_STATUS`; the controller then requires
  `RECEIVE_SAMPLE || APPROVE_RESULTS`. Two different answers to who may edit an analysis list, and
  whichever is stricter wins by accident. Settle it in the registry and use one key
  (`EDIT_ANALYSES`), added to WP-42's generated matrix.
- **Accept** — WP-42's matrix covers the route. Grep finds no inline permission check in the handler.

---

# Stage 2 — State integrity

**1 week.** Every item here puts something untrue into the record.

### SD-07 · Delete the client's forced-approval workaround · `P0`

- **Files** — `client/src/pages/SampleDetail.jsx` (~line 335–347) ·
  `server/controllers/sampleController.js`
- **Do** — The client currently does this:

```js
// WORKAROUND: Legacy Server Logic requires passing through APPROVED before ARCHIVED
if (['ARCHIVED','DISPOSED'].includes(targetStatus) && sample.status !== 'APPROVED') {
  try { await axios.put(`/api/samples/${id}/status`, { status:'APPROVED', reason:'Intermediate Step for Archiving' }); }
  catch (ignore) { console.warn("Intermediate approval failed or skipped", ignore); }
}
await axios.put(`/api/samples/${id}/status`, { status: targetStatus });
```

  The browser walks the sample through `APPROVED` so the server will accept `ARCHIVED`, and swallows
  the failure. The audit log then shows an approval that no manager made as an approval decision, and
  a sample can reach a terminal state without one. Remove the workaround entirely. If archiving
  genuinely requires prior approval, the server must say so with a 409 the user can read; if it does
  not, widen `SAMPLE_TRANSITIONS` deliberately. Never both.
- **Accept** — Grep finds no `WORKAROUND` in the page and no client-issued status write that the user
  did not ask for. Archiving an unapproved sample either succeeds legitimately or fails with a
  message naming what is missing.

### SD-08 · Stop fabricating preparation records on reopen · `P0`

- **Files** — `server/controllers/sampleController.js` — `updateSampleAnalyses`
- **Do** — Adding an analysis to an `APPROVED`, `ARCHIVED` or `DISPOSED` sample silently sets status
  to `PROCESSING` **and back-fills `dryingStatus` and `preparationStatus` to `'DONE'`** when they are
  null. Nobody dried anything. The certificate then states a basis derived from a preparation record
  the system invented. Reopening is legitimate; asserting the preparation is not. Leave the gates
  null, require them to be completed again or explicitly waived with a reason, and record the reopen
  as its own audited transition.
- **Accept** — Test: reopening a sample with null gates leaves them null and blocks result entry
  until they are completed or waived. No code path writes `'DONE'` to a gate the user did not set.

### SD-09 · Validate work-item status writes against the contract · `P1`

- **Files** — `server/controllers/workItemController.js` — `updateWorkItemStatus`
- **Do** — The handler checks role, checks for a sealed item, and special-cases `IN_PROGRESS` and
  `COMPLETED`, but never validates the move against `WORK_ITEM_TRANSITIONS`. Route it through the
  contract the way WP-11 did for samples, and reject an illegal move with 409 naming both states.
- **Accept** — Unit tests over every edge of the work-item transition map, legal and illegal.

### SD-10 · Capture a reason where one is required · `P1`

- **Files** — `client/src/pages/SampleDetail.jsx` (lines ~234, ~244) ·
  `server/controllers/workItemController.js`
- **Do** — Inline and bulk review post the hardcoded notes `'Inline Manager Review'` and
  `'Bulk Manager Review'`. A rejection that sends work back for reanalysis with no reason gives the
  technician nothing to act on, and `reassignWork` already proves the pattern by requiring one. Make
  a reason mandatory on rejection and on reopening a finished sample; keep it optional on acceptance.
- **Accept** — Rejecting without a reason is refused. The reason reaches the technician's
  notification and the sample timeline.

---

# Stage 3 — Spectroscopy leftovers

**1 week.** Verified outstanding after the SL-01 to SL-26 pass.

### SD-11 · Make the signal defaults fail closed, and backfill · `P0`

- **Files** — `server/prisma/schema.prisma` · `server/scripts/` (new backfill)
- **Do** — `quantity String @default("ABSORBANCE")` and `axisDirection String @default("DESCENDING")`
  assert facts nobody supplied. The approval gate at `spectralController.js:1167` correctly refuses
  to approve an `UNVERIFIED` scan — but a row that never asserted a quantity reads `ABSORBANCE` and
  sails through it, and `DESCENDING` is wrong for every NIR scan in nanometres. Change both defaults
  to `UNVERIFIED`, and write a backfill that sets existing rows to `UNVERIFIED` except where the
  instrument and export are known.
- **Accept** — Test: a scan created without an explicit quantity cannot be approved. No pre-existing
  row claims a quantity that was never recorded.

### SD-12 · Upload the file, not the parsed arrays · `P0`

- **Files** — `client/src/components/SpectraUpload.jsx` · `SpectraBatchUpload.jsx` ·
  `server/routes/spectralRoutes.js` · `server/controllers/spectralController.js`
- **Do** — SL-06 writes a file with `fs.writeFileSync(fullFilePath, rawContent, 'utf8')`, but both
  upload components still declare `accept=".csv"` with no `FormData` and no multipart. The browser
  parses and posts text, so the stored "original" is a reconstruction of what the browser sent,
  written as UTF-8. Binary formats cannot survive that write, and SL-06's own acceptance criterion —
  the original downloads back byte-identical — cannot hold. Accept multipart, store the bytes as
  received, and parse server-side.
- **Accept** — A binary file uploads and downloads back byte-identical, hash matching the record.
  This package blocks SD-13.

### SD-13 · The remaining formats · `P2`

- **Files** — `server/services/spectralParser.js`
- **Do** — JCAMP-DX and CSV are in. Add Bruker OPUS, then ASD binary, then SPC — in that order, since
  OPUS is what the FTIR instruments in these laboratories write natively. Read instrument,
  resolution, co-added scans, quantity and background from the file rather than asking the technician.
- **Accept** — An OPUS file uploads with its acquisition fields populated and no manual entry.
- **Depends** — SD-12

---

# Stage 4 — Make the next step real

**4 days.** The fourth reported problem, and the tests that keep all of the above from regressing.

### SD-14 · Escalate unassigned and stalled work · `P1`

- **Files** — `server/services/escalationService.js` (new)
- **Do** — *"Next: Assign Drying task"* is a label, not a gate. Nothing stops a sample sitting
  `ACCEPTED` and unassigned indefinitely, and it surfaces only on a page nobody has open. Rather than
  a blocking modal, run rules on a schedule: unassigned at a station beyond a threshold, in progress
  beyond twice the expected duration, on hold beyond its reason's limit. Each raises the existing
  notification, addressed to a role. This is MAP-19 from the operations map plan — build it once.
- **Accept** — A sample unassigned for two days reaches the manager without anyone opening a page.

### SD-15 · Sample-detail contract tests · `P1`

- **Files** — `server/tests/contracts/sample_detail.test.js` (new)
- **Do** — One suite covering the whole path this plan touches: analysis reconcile (all three
  branches), cross-laboratory assignment refusal for every role, the prerequisite gate on start and
  on result entry, the archive path with no client-issued intermediate approval, gate back-fill
  refusal, and reason-required rejection.
- **Accept** — Every defect in this document has a test that fails against the current code and
  passes after its package.
- **Depends** — SD-03, SD-05, SD-07, SD-08

### SD-16 · Extend the wiring assertion to the sample page · `P2`

- **Files** — `server/tests/security/wiring.test.js`
- **Do** — WP-03 asserts that components have import sites. Add: no client file issues a status write
  the user did not request; no permission check appears inline in a controller that a route already
  gates; every gate the client renders has a server counterpart. These three assertions would have
  caught SD-05, SD-06 and SD-07.
- **Accept** — The three assertions pass, and reintroducing any of those three defects turns the
  suite red.

### SD-17 · Reconcile the audit trail for reopened samples · `P2`

- **Files** — `server/controllers/sampleController.js` · `client/src/components/SampleTimeline.jsx`
- **Do** — A reopened sample now has two analytical episodes on one record. The timeline (WP-27)
  should show them as distinct passes, so a manager reading a certificate knows which results belong
  to which episode and which analyses were added after the first approval.
- **Accept** — A reopened sample's timeline separates the episodes, and the certificate names the
  approval date of each.

---

# Definition of done

| Assertion | How to check |
|---|---|
| No API key reads outside its laboratory scope | SD-01 test on all five endpoints |
| No cross-laboratory assignment is possible, for any role | SD-02 test including SUPER_ADMIN |
| The analysis list and the work items always agree | SD-03 test; progress counter matches the list |
| A result-bearing analysis cannot be silently removed | SD-03 refusal test |
| Applying a bundle sets the selection | SD-04 |
| Both assignment controls behave identically | SD-05 |
| No client-issued status write the user did not ask for | grep for `WORKAROUND`; SD-16 assertion |
| No gate is ever set to DONE by the system | SD-08 test |
| A spectrum cannot claim a quantity nobody recorded | SD-11 test |
| An uploaded instrument file returns byte-identical | SD-12 test |
| A stalled sample reaches a human without a page being open | SD-14 |

---

## One instruction to carry through every package

Every defect in this document passed code review. What none of them survived was being *used* —
the four you found in an afternoon of testing. So before marking any package complete, exercise the
path as the role that meets it: a manager editing an analysis list, a technician opening a queue, an
admin assigning across laboratories. **A commit message is not evidence, and neither is a green
build on a path nobody walked.**

---

*SoilFER-LIMS · Volume XIII · sample detail, assignment and state integrity · 2 September 2026 ·
17 packages · 5 stages · Stage 0 is live exposure*
