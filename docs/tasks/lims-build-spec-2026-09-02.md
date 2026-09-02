# SoilFER-LIMS — Build Specification

**Volume X · agent-executable implementation plan**

| | |
|---|---|
| Packages | 37, in 6 stages |
| Baseline | `78ec938`, re-verified 2 September 2026 |
| Estimate | ~9 weeks, single developer |
| Hard rule | Stage 0 before anything else |
| Sources | Audit Volumes I–IX |

---

## How to use this document

Each work package has four fields. `Files` lists the paths to touch. `Do` is the change.
`Accept` is the behaviour that must be demonstrated before the package is complete.
`Depends` is what must be finished first.

Work one package at a time. Commit per package, referencing the WP id. Do not batch.

**Line numbers in this document were read at `78ec938` and they move.** Re-grep for the
construct before editing. If what you find does not match what is described here, report the
difference rather than editing the nearest thing that looks similar.

---

## Read this first

Six times in this codebase, correct code has been written and never called:

1. `checkScope` / `requireLabScope` — zero call sites
2. `validateSampleMatrix` — written, unwired for two audit cycles
3. The "analytical catalogue" — a 166-entry display-name lookup with no units, methods or references
4. `workflowContract`'s validators — called from one endpoint out of eleven
5. `client/src/components/SampleTimeline.jsx` — 129 lines, zero import sites
6. `Result.censoring` / `.basis` / `.replicateNo` — columns no data-entry screen exposes

Each was good work that reached nothing. The last two were found while checking whether this
specification covered the request it was written for — which is the point. Without a test that
exercises a path, nobody notices the path is unreachable.

**Therefore Stage 0 is not optional and not reorderable.** Complete WP-01, WP-02, WP-03, WP-41
and WP-42, and see them pass, before touching any other package. Every later package specifies a
test as part of its acceptance criteria, and those tests are the only thing preventing a seventh
instance of the pattern.

**Priorities.** `P0` produces wrong output or lost work today · `P1` integrity or compliance ·
`P2` correctness and consistency · `P3` productisation and future obligations.

---

## Guardrails — constraints on the executing agent

- **Do not run anything against production.** All work is local. Deployment is a human decision.
  `lims.yigini.net` is live with seven laboratories' data.
- **Do not run `npm test` until WP-01 is complete.** `tests/setup.js` writes through `db.js`,
  which resolves to `prisma/dev.db` unless `DATABASE_PATH` is set. Running the suite today writes
  test users into the development database.
- **Do not seed a catalogue over existing rows.** Laboratories have hand-created analyses with
  free-text units. WP-19 specifies a match-and-confirm migration, not an overwrite.
- **Do not change interpretation band values.** The thresholds in `interpretationService.js` were
  verified correct in Volume VIII. Packages here change unit handling and coverage, never the numbers.
- **Do not delete the `glosis_*` columns until WP-37**, which migrates them to a side table first.
- **Do not add Puppeteer.** The working tree already chose `pdfkit`; that decision stands.
- **Commit per work package**, referencing the WP id.
- **If a package's acceptance criteria cannot be met, stop and report.** Do not substitute a partial
  implementation and mark it complete — that is precisely how the six dead-code instances arose.

---

## Coverage against the workflow audit

Every finding in Volume IX, mapped to the package that closes it.

| Vol IX | Finding | Package |
|---|---|---|
| WF-01 | Dispose and Archive promise a task the server never creates | WP-08 |
| WF-02 | Accepted work has no bucket, so it vanishes from the technician | WP-06 · WP-07 |
| WF-03 | The workflow contract is enforced on one endpoint out of eleven | WP-11 · WP-12 |
| WF-04 | The results-entry gate requires a status the contract forbids | WP-13 |
| WF-05 | `NON_CONFORMING` and `REVERT_TO_EXPECTED` written as statuses | WP-14 |
| WF-06 | Operational gates exist as booleans *and* as work items | WP-26 |
| WF-07 | The analysis DAG is hard-coded, independent of the catalogue | WP-25 |
| WF-08 | `submitForApproval` writes `COMPLETED` and ignores its own diagnostics | WP-13 · WP-15 |
| WF-09 | Inline role arrays in the sample controller | WP-24 |
| WF-10 | Nothing checks that work is finished before disposal | WP-09 |
| WF-11 | Dead controls the user can see | WP-08 |

### Dimensions requested, and where each is answered

| Dimension | Packages | State |
|---|---|---|
| T0 / Kobo intake | — | Assessed sound in Volume IX; nothing to change |
| Workflow operations | WP-11 → WP-14 · WP-25 · WP-26 | Covered |
| RBAC | WP-10 · WP-24 · WP-28 · **WP-42** | Was under-covered — the RBAC suite asserts five endpoints |
| Analysis bench | WP-06 · **WP-40** | Was under-covered — the entry screen was never examined field by field |
| Data entry | WP-15 · WP-16 · WP-31 · **WP-40** | Was under-covered — censoring, replicate and basis are unreachable |
| Lab isolation | WP-28 · **WP-41** | Was under-covered — found sound, but nothing pins it |
| User experience | WP-06 · WP-20 · WP-27 · WP-40 | Covered |
| Reporting | WP-04 · WP-21 · WP-22 | Covered, inherited from Volume VIII |

### Corrections to earlier audit volumes

**WP-07 was wrong in half.** Volume IX said review sends no notification. It does:
`reviewWorkItem` at `workItemController.js:931–990` creates a Message *and* calls
`createNotification`, which broadcasts through `broadcastToUser`. All three outcomes are covered.
The technician is therefore *told* the work was approved and then cannot find it — which is worse
than silence, and makes **WP-06 the entire fix for the vanishing-task bug**. WP-07 is reduced to a test.

**WP-01 was aimed at the wrong problem.** The harness now exists — commit `af8eb51` added
`tests/setup.js` and fourteen suites. But it writes to the development database. WP-01 is now
about isolating it.

**WP-27 was aimed at the wrong problem too.** `SampleTimeline.jsx` already exists and nothing
imports it. WP-27 becomes wiring, not building.

---

# Stage 0 — Safety net

**3–4 days · blocks everything.** Nothing else may start until all five pass.

### WP-01 · Isolate the test harness from the development database · `P0`

- **Files** — `server/tests/setup.js` · `server/jest.config.js` (new) · `server/package.json`
- **Do** — *Revised.* The harness exists (`af8eb51`) and fourteen suites import it. The defect is
  that `setup.js` creates users through `../db`, whose path is
  `process.env.DATABASE_PATH || prisma/dev.db` — unset in test, so `npm test` writes
  `test_lab_manager_labgtm` and friends into the development database. Set `DATABASE_PATH` to a
  temp file in `globalSetup`, migrate and seed it per run, delete it in `globalTeardown`. Add the
  jest config with `--runInBand`.
- **Accept** — `npm test` leaves `prisma/dev.db` byte-identical. All 14 suites run to completion;
  failures are permitted, import errors and dev-database writes are not.
- **Depends** — —

### WP-02 · Continuous integration · `P0`

- **Files** — `.github/workflows/ci.yml` (new)
- **Do** — On push and pull request: install server and client, run `npm test`, build the client,
  build the Docker image. Fail the job on any step. Do not add deployment. Only
  `deploy-docs.yml` exists today.
- **Accept** — A deliberately broken test fails the build.
- **Depends** — WP-01

### WP-03 · Regression tests for the dead-code instances · `P0`

- **Files** — `server/tests/security/wiring.test.js` (new)
- **Do** — Assert that each of these is reachable, not merely defined:
  - `validateSampleMatrix` is called on result save and submission
  - `workflowContract` validators are called by every status write (initially failing — WP-12 makes it pass)
  - every exported function in `utils/scopeGuard.js` has at least one call site
  - every permission key in `config/roles.js` is used by at least one route
  - every component under `client/src/components/` has at least one import site
- **Accept** — Suite runs. Expected failures are documented as the targets of WP-12, WP-24 and WP-27.
- **Depends** — WP-01

### WP-41 · Lab isolation regression suite · `P1`

- **Files** — `server/tests/security/lab_isolation.test.js` (new)
- **Do** — *Added after re-check.* Volume IX found no cross-lab leak and Volume I found `scopeGuard`
  failing open before remediation — and `grep labId server/tests/security/` returns nothing. The
  boundary is correct and completely unpinned. For each of samples, work items, results, reports,
  batches, users and equipment: a `LAB_MANAGER` and a `LAB_TECHNICIAN` in LAB-A must receive 403 or
  404 for a LAB-B row by direct id, and must not see it in any list, search, export or count.
  Include the aggregate endpoints — a dashboard tile that counts across labs leaks as surely as a
  detail page.
- **Accept** — Reverting `scopeGuard.js`'s `{ id: { in: [] } }` to the old `{}` turns this suite red.
  That is the test of the test.
- **Depends** — WP-01

### WP-42 · Generate the RBAC matrix from the registry · `P1`

- **Files** — `server/tests/security/rbac_enforcement.test.js`
- **Do** — *Added after re-check.* The existing suite asserts five things: admin settings, two user
  endpoints, work assignment, and category config. That is five endpoints out of the whole surface,
  and it is the entire RBAC guarantee. Replace the hand-written cases with a matrix generated from
  `config/roles.js` crossed with the mounted route table: for every role and every mutating route,
  assert allow or deny from the registry. Any route with no permission key is a failure, not a skip.
- **Accept** — Adding a route without a permission key fails the suite. The matrix covers every
  mutating route, not a sample of them.
- **Depends** — WP-01 · pairs with WP-24

---

# Stage 1 — Stop wrong output and lost work

**3–4 days.** Small, independent, high-consequence. Each is hours rather than days.

### WP-04 · Make the unit normaliser fail closed · `P0`

- **Files** — `server/services/interpretationService.js`
- **Do** — The final return of `normalizeUnit` (line 121) relabels an unrecognised unit with the
  standard unit and returns the raw number. Replace with a refusal.

```js
// current — relabels, does not convert
return { normalizedValue: num, standardUnit: rule.standard, wasConverted: false, factor: 1 };

// required
return { normalizedValue: null, standardUnit: rule.standard, wasConverted: false,
         factor: 1, unrecognizedUnit: trimmedUnit };
```

  Callers must render the value with no interpretation when `normalizedValue` is null.
- **Accept** — Test: SOC of 10 with unit `g/100g` returns null, not 10 labelled g/kg. Report renders
  the value with no verdict.
- **Depends** — WP-01

### WP-05 · Add mg/kg to cmol(+)/kg conversions · `P0`

- **Files** — `server/services/interpretationService.js`
- **Do** — `EXCH_CA`, `EXCH_MG`, `EXCH_K`, `EXCH_NA` (lines 48–51) list `meq/100g` as a synonym but
  carry no `conversions` block, so a result in mg/kg is read as cmol(+)/kg. Factors are
  atomic mass ÷ charge × 10.

```js
'EXCH_K':  { conversions: { 'mg/kg': 1/391,   'ppm': 1/391 } }
'EXCH_CA': { conversions: { 'mg/kg': 1/200.4, 'ppm': 1/200.4 } }
'EXCH_MG': { conversions: { 'mg/kg': 1/121.6, 'ppm': 1/121.6 } }
'EXCH_NA': { conversions: { 'mg/kg': 1/229.9, 'ppm': 1/229.9 } }
```

- **Accept** — Test: 200 mg/kg K normalises to 0.51 cmol(+)/kg and rates "Adequate", not "High".
  Same for 1600 mg/kg Ca → 7.98 → Optimal.
- **Depends** — WP-01, WP-04

### WP-06 · Give MyWork a bucket for every work-item state · `P0`

- **Files** — `client/src/pages/MyWork.jsx`
- **Do** — Items in `SUBMITTED`, `ACCEPTED` and `WAIVED` set no flag and render nowhere. Replace the
  three-flag grouping with an explicit bucket per state: *Active* (ASSIGNED, IN_PROGRESS),
  *Awaiting review* (COMPLETED, SUBMITTED), *Needs redo* (REANALYSIS_REQUIRED), *Accepted*
  (ACCEPTED), *Waived* (WAIVED). Default the view to the last 30 days rather than to open work only.
  Remove the check for `'PENDING'`, a blacklisted legacy status. Lines 63–77 and 119–121 are
  unchanged at `78ec938`; this bug is still live.
- **Note** — **This package alone closes the vanishing-task bug** (see WP-07). The technician *is*
  notified that the work was approved; the notification links to the sample, and the item is then in
  none of MyWork's three buckets. Leave `workbenchController.js:19` as it is — a work *queue*
  showing only actionable states is correct. MyWork is the complete record and must show everything.
- **Accept** — Test: a work item in each of the eight states appears in exactly one bucket. No state
  renders nowhere.
- **Depends** — WP-01

### WP-07 · Pin the review notification with a test · `P2`

- **Files** — `server/tests/contracts/review_notification.test.js` (new)
- **Do** — *Downgraded — the earlier finding was wrong.* `reviewWorkItem` already notifies on all
  three outcomes: a Message row plus `createNotification`, which pushes via `broadcastToUser`. Two
  real gaps remain, both small. The notification is skipped silently when the username lookup returns
  nothing (`recipient?.id` falsy) — log it. And `reviewWorkItemsBulk` must be confirmed to take the
  identical path rather than a copy that has drifted.
- **Accept** — Test: accept, waive and reject each produce a notification for the assignee, through
  both the single and the bulk endpoint. A missing recipient logs rather than passing silently.
- **Depends** — WP-01

### WP-08 · Resolve the dispose / archive contract mismatch · `P0`

- **Files** — `server/controllers/sampleController.js` (`archiveSample` 1876, `disposeSample` 1931) ·
  `client/src/pages/SampleDetail.jsx` · `client/src/components/sample/SampleSummary.jsx` ·
  `client/src/components/sample/WorkItemsTable.jsx` · `client/src/components/samples/SamplesTable.jsx`
- **DECISION REQUIRED BEFORE IMPLEMENTATION.** Two-step (create a `DISPOSAL` / `ARCHIVING` work item,
  leave the sample `APPROVED` until it is accepted) or one-step (manager disposes immediately).
  Two-step is correct for a laboratory that must account for sample destruction; one-step is a text
  change. **Recommended: two-step**, because `workflowEngine.js` already defines both work-item types
  and the assignment UI already supports them.
- **Do (2-step)** — `disposeSample` and `archiveSample` create the work item and leave sample status
  unchanged. Sample reaches `DISPOSED` / `ARCHIVED` only when that item is `ACCEPTED`.
- **Do (1-step)** — Fix the dialog text in `SampleDetail.jsx:368` and `:345`; delete the
  "Assign Disposal" branch at `SampleSummary.jsx:301` and the dead logic at
  `WorkItemsTable.jsx:457–458` and `SamplesTable.jsx:419–420`.
- **Accept** — Test: the message shown to the user matches what the server did. No unreachable UI
  branch remains.
- **Depends** — WP-01 · human decision

### WP-40 · Make the bench capture what the schema already records · `P0`

- **Files** — `client/src/pages/TechWorkbench.jsx` · `server/controllers/resultsController.js` ·
  `server/services/reportAssembly.js`
- **Do** — *Added after re-check — the sixth instance of the pattern.* `Result` carries `censoring`
  (NONE / BELOW_LOQ / ABOVE_RANGE), `basis` (AIR_DRY / OVEN_DRY / FIELD_MOIST) and `replicateNo`.
  `TechWorkbench.jsx` mentions none of the three. The columns were designed and no technician can
  reach them.
  - **Censoring.** A technician typing `<0.01` today gets a rejected number or a silent zero. Accept
    the form, store `censoring: BELOW_LOQ` with the LOQ in `numericValue`, and render "< 0.01" on the
    certificate. A censored value must never enter a mean, a ratio or an interpretation band as if it
    were measured.
  - **Basis.** The certificate states a basis. Nothing captures it, so the default is printed as fact.
    Air-dry and oven-dry differ by the residual moisture — for a clay soil at 5 % that is a 5 % error
    stated as a measurement. Make it a required choice per batch, defaulted per method from the catalogue.
  - **Replicates.** `replicateNo` defaults to 1 and never advances. A second determination either
    overwrites through `supersededBy` or is not entered. Add a replicate row that increments and does
    not supersede, so duplicate RPD in WP-29 has real pairs to work with.
- **Accept** — Tests: `<0.01` stores BELOW_LOQ and prints as "< 0.01" with no interpretation verdict;
  a second replicate stores `replicateNo: 2` with both rows `isCurrent`; the basis on the certificate
  is the basis chosen at entry.
- **Depends** — WP-01

### WP-09 · Block terminal transitions while work is live · `P1`

- **Files** — `server/controllers/sampleController.js`
- **Do** — `disposeSample` and `archiveSample` check only that the sample is `APPROVED`. Add a check
  that every work item is terminal (`ACCEPTED` or `WAIVED`); refuse with 409 and list the offending
  item codes.
- **Accept** — Test: disposal is refused when one work item is `IN_PROGRESS`, and the error names it.
- **Depends** — WP-01

### WP-10 · Close the small security items · `P1`

- **Files** — `server/routes/equipmentRoutes.js` · `server/prisma/schema.prisma` ·
  `server/middleware/authMiddleware.js` · `server/controllers/authController.js` · `server/app.js`
- **Do** —
  - Gate every equipment route with `checkPermission('MANAGE_EQUIPMENT')` — the key exists in the
    registry and is already used by the client; the routes are authenticated-only.
  - Add `tokenVersion Int @default(0)` to User; include it in the JWT; compare in `verifyToken`;
    increment on password change and deactivation.
  - Split the auth limiter: keep 100/15 min for `/api/auth` generally, add 10/15 min keyed on
    IP + username for `/api/auth/login`, and write an audit row on failed login.
- **Accept** — Tests: a VIEWER cannot POST equipment; a token issued before a password change is
  rejected; the eleventh login attempt in a window is refused.
- **Depends** — WP-01

### WP-11a · Operational: rotate the production admin credential · `P1`

- **Files** — none — deployment action, human
- **Do** — The seed sets `mustChangePassword: true` and `verifyToken` enforces it for all roles, so
  the code is correct. If `admin`/`password` currently authenticates on production with full access,
  the flag was cleared or the password reset. Rotate it, confirm the flag, and rotate `JWT_SECRET`
  and any SIS API keys at the same time.
- **Accept** — Default credentials no longer authenticate on production.
- **Depends** — —

---

# Stage 2 — One authority over state

**1 week.** The change that stops this class of bug recurring. Expect existing behaviour to break
here — each break is an illegal transition the system was performing silently.

### WP-11 · Build the sample transition helper · `P0`

- **Files** — `server/services/sampleStateService.js` (new) · `server/workflowContract.js`
- **Do** — Create `transitionSample(sampleId, nextStatus, actor, reason)` that: rejects values in
  `LEGACY_SAMPLE_STATUSES` with 400; rejects values not in `SAMPLE_STATES` with 400; rejects
  transitions not permitted by `SAMPLE_TRANSITIONS` with 409 naming the current and attempted state;
  writes the audit row; performs the update — all in one transaction.
- **Accept** — Unit tests for every edge of the transition map, including all legal paths and a
  representative set of illegal ones.
- **Depends** — WP-01

### WP-12 · Route all status writes through the helper · `P0`

- **Files** — `server/controllers/sampleController.js` · `receptionController.js` ·
  `resultsController.js` · `submissionController.js` · `koboController.js` · `workItemController.js`
- **Do** — Replace every direct `prisma.sample.update({ data: { status } })` with a call to
  `transitionSample`. There are eleven such writes. Where a transition is currently illegal, do not
  widen the map — fix the calling code or raise it as a question.
- **Accept** — WP-03's contract-enforcement assertion passes. Grep finds no direct status write
  outside the service.
- **Depends** — WP-11

### WP-13 · Migrate the illegal statuses in the database · `P0`

- **Files** — `server/prisma/migrations/` (new) · `server/controllers/resultsController.js`
- **Do** — Count the rows first and report before changing anything. Then map:
  `ANALYSIS → PROCESSING`, `PARTIALLY_COMPLETE → SUBMITTED_PARTIAL`, `COMPLETED → SUBMITTED_FULL`,
  `COLLECTED → EXPECTED`. Then change the `saveResults` gate from `'ANALYSIS' / 'PARTIALLY_COMPLETE'`
  to `PROCESSING / SUBMITTED_PARTIAL`. Remove the `'LAB_ID_ASSIGNED'` key from `STATUS_ROLES`
  (`sampleController.js:414`) — it grants permission for a state the contract blacklists.
- **Accept** — No sample row holds a status outside `SAMPLE_STATES`. Results can be saved against a
  sample in `PROCESSING`.
- **Depends** — WP-11, WP-12

### WP-14 · Replace status-as-reason with a reason field · `P1`

- **Files** — `server/prisma/schema.prisma` · `receptionController.js` · `sampleController.js`
- **Do** — `NON_CONFORMING` and `REVERT_TO_EXPECTED` are being written as statuses. The first is
  blacklisted; the second is an action name. Add `rejectionReason String?` to Sample; use the
  contract's `RECEIVED → EXPECTED` transition and record the reason as data.
- **Accept** — Neither string appears as a status value anywhere. Rejection reason survives on the
  sample and shows in the timeline.
- **Depends** — WP-12

### WP-15 · Decide blocking versus advisory diagnostics · `P1`

- **Files** — `server/controllers/resultsController.js` · `server/controllers/validationController.js`
- **Do** — `validateSampleMatrix` now runs but `submitForApproval` completes regardless. Mark each
  diagnostic `BLOCKING` or `ADVISORY`. Texture closure outside tolerance blocks; C:N implausibility
  and base saturation above 100 % warn. Refuse submission on any blocking failure with the failing
  check named.
- **Accept** — Test: submission with sand+silt+clay = 87 % is refused; submission with C:N of 45
  succeeds with a warning.
- **Depends** — WP-01

---

# Stage 3 — Catalogue foundation

**3 weeks.** The largest block, and the one that makes several already-completed fixes start
functioning. Volumes III and VI hold the reference data.

### WP-16 · Unit table and controlled vocabulary · `P1`

- **Files** — `server/prisma/schema.prisma` · `server/seeds/units.js` (new) ·
  `server/services/interpretationService.js`
- **Do** — Create `Unit { code, display, quantityKind, factorToBase, synonyms }`. Seed ~28 rows.
  Move `CONTROLLED_UNITS` out of JavaScript into these rows, including the conversions added in
  WP-05. Add `Analysis.unitCode` as a foreign key. Replace the free-text unit input with a picker.
- **Accept** — Grep finds no `CONTROLLED_UNITS` constant. A unit cannot be typed anywhere in the UI.
- **Depends** — WP-04, WP-05

### WP-17 · Method reference library · `P1`

- **Files** — `server/prisma/schema.prisma` · `server/seeds/references.js` (new)
- **Do** — Create `MethodReference { authority, citation, title, year, url, status }`. Seed the 28
  GLOSOLAN SOPs, 24 ISO standards and the literature methods from Volume III §02. Mark the four
  GLOSOLAN SOPs still under publication with `status: UNDER_PUBLICATION`. Replace
  `Methodology.standard` free text with `referenceId`.
- **Accept** — A standard number cannot be typed. Under-publication references are distinguishable.
- **Depends** — WP-16

### WP-18 · Sample matrix and module fields · `P1`

- **Files** — `server/prisma/schema.prisma`
- **Do** — Add `Analysis.matrix` (SOIL / PLANT / WATER / AMENDMENT / FERTILIZER / LIMING) and
  `Analysis.module` (FERTILITY / HEALTH / ENVIRONMENTAL / QUALITY). Add `Sample.matrix`,
  `Sample.plantPart`, `Sample.growthStage`. Key validation ranges and threshold sets on matrix.
  **This must land before the plant analyses of WP-19** — a tissue result cannot be interpreted
  without plant part and growth stage.
- **Accept** — Test: total N of 30 g/kg rates High in SOIL and Adequate in PLANT.
- **Depends** — WP-16

### WP-19 · Seed the analysis catalogue · `P1`

- **Files** — `server/seeds/catalogue.js` (new) · `server/seeds/data/*.json` (new)
- **Do** — Seed 214 analyses and ~430 methodologies from Volume III §03 and Volume VI, each with
  unit, decimals, plausible range, matrix, module, reference, and the recommended default flagged.
  The environmental module ships disabled. **Do not overwrite existing rows** — match on code,
  present proposed pairings for a human to confirm, leave unmatched local analyses untouched with
  `isGlobal: false`. An unmapped unit must block interpretation rather than guess.
- **Accept** — A clean database seeds 214 analyses. A database with hand-created analyses produces a
  match report and changes nothing without confirmation.
- **Depends** — WP-16, WP-17, WP-18

### WP-20 · Per-lab defaults and setup wizard · `P2`

- **Files** — `server/prisma/schema.prisma` · `client/src/pages/admin/LabMethods.jsx` (new) ·
  `client/src/components/setup/SetupWizard.jsx` (new)
- **Do** — Create `LabMethodDefault { labId, analysisCode, methodologyId }` falling back to the
  catalogue recommendation. Build the twelve-question onboarding wizard with GLOSOLAN answers
  pre-selected and skipping allowed. Build the manager's methods screen — one row per analysis,
  current default visible, one click to change, "add our own method" asking only for name, unit,
  precision and optional reference.
- **Accept** — A technician never sees a method dropdown. A manager can change any default in one click.
- **Depends** — WP-19

### WP-21 · Single interpretation engine · `P2`

- **Files** — `client/src/components/report/ReportContent.jsx` · `server/services/reportAssembly.js`
- **Do** — Delete `THRESHOLDS` and `getInterpretation` from the client (lines 23 and 64). Have the
  server return the interpretation alongside each result; render what it sends. Two engines currently
  produce the on-screen report and the PDF.
- **Accept** — Grep finds no threshold table in `client/`. On-screen and PDF verdicts are identical
  by construction.
- **Depends** — WP-04

### WP-22 · Normalise in the export paths · `P2`

- **Files** — `server/controllers/sisController.js` · `exportController.js` · `dataResultsController.js`
- **Do** — None of the three normalises. Emit both the as-measured value with its unit and the
  normalised value with the controlled unit. An auditor needs the first; a consumer needs the second.
- **Accept** — Test: a result stored in mg/kg exports with both representations.
- **Depends** — WP-16

### WP-23 · Extend interpretation coverage · `P2`

- **Files** — `server/services/interpretationService.js`
- **Do** — 14 evaluators cover 54 units. Add bands for `PH_CACL2` (about 0.5 units below the water
  scale), `EC_E` (2 / 4 / 8 dS/m — the saturated-paste scale, currently absent while unqualified EC
  has one), `P_BRAY2` and `P_MEHLICH1`. Encode the extract ratio for pH and EC as WP-19 does for
  phosphorus. **Do not alter existing band values.**
- **Accept** — Every parameter with a threshold set names the method or ratio it was calibrated for.
- **Depends** — WP-19

---

# Stage 4 — Workflow and role consistency

**1 week.** Findings that are not breaking anything today but make the system feel arbitrary to its users.

### WP-24 · Replace inline role arrays with the registry · `P1`

- **Files** — `server/controllers/sampleController.js` · `server/config/roles.js` ·
  `server/routes/sampleRoutes.js`
- **Do** — Fourteen inline role checks at `78ec938` — lines 453, 548, 723, 789, 888, 1197, 1562,
  1621, 1683, 1882, 1937 and the `STATUS_ROLES` map at 412–418. Re-grep before starting; these move.
  Replace each with a permission key. Add `DISPOSE_SAMPLE` and `ARCHIVE_SAMPLE` to the registry.
  Settle whether `MASTER_USER` may approve and dispose — it currently can impersonate and manage
  users but not approve a sample.
- **Also** — `STATUS_ROLES` is keyed on sample status, and one of its keys is `'LAB_ID_ASSIGNED'`
  (line 414) — a value `workflowContract` blacklists. Whoever holds that permission holds it for a
  state the contract forbids. Remove the key as part of WP-13's migration, not by widening the contract.
- **Accept** — WP-03's permission-key assertion passes. Grep finds no `includes(user.role)` in the
  controller, and no legacy status as a key in any role map.
- **Depends** — WP-01

### WP-25 · Drive the workflow graph from the catalogue · `P2`

- **Files** — `server/utils/workflowEngine.js` · `server/prisma/schema.prisma`
- **Do** — Twelve analysis codes with category, order and prerequisites are hard-coded, independent
  of the catalogue. Move those three attributes onto `Analysis`; have the engine read the catalogue;
  validate the graph for cycles on save.
- **Accept** — Adding an analysis through the UI produces a work-item type with correct ordering.
  A cyclic prerequisite is refused.
- **Depends** — WP-19

### WP-26 · Single representation for operational gates · `P2`

- **Files** — `server/prisma/schema.prisma` · `sampleController.js` · `workflowEngine.js`
- **Do** — Drying and preparation exist both as booleans on Sample and as work items in the engine.
  Keep the work items; derive the booleans, or drop them.
- **Accept** — One source of truth for gate completion.
- **Depends** — WP-25

### WP-27 · Wire the sample timeline that already exists · `P2`

- **Files** — `client/src/components/SampleTimeline.jsx` (exists, unimported) ·
  `client/src/pages/SampleDetail.jsx` · `server/controllers/sampleController.js`
- **Do** — *Revised — the component is already written.* `SampleTimeline.jsx` is 129 lines, takes
  `{ currentStatus, history }`, exports cleanly, and `grep -rn "SampleTimeline" client/src` returns
  only its own definition and export. Nothing imports it. Import it into `SampleDetail` and feed
  `history` from a new endpoint that assembles the audit log: every status change, assignment, result
  entry, review decision and QC event, with actor and timestamp. Check what the component already
  renders before adding to it.
- **Note** — This is the fifth instance of the pattern in the opening list, and it was found while
  checking whether the specification covered the request. Assume there are more; WP-03 is what finds them.
- **Accept** — A manager can see, in one place, everything that happened to a sample and who did it.
  The component has at least one import site.
- **Depends** — WP-12

### WP-28 · Remove the dead security middleware · `P2`

- **Files** — `server/middleware/authMiddleware.js` · `server/utils/scopeGuard.js`
- **Do** — `checkScope` and `requireLabScope` have zero call sites and would fail open if wired
  (their conditions treat an empty array as permission). Delete both, or wire them and invert the
  conditions. Leaving dead security code reads as protection during review.
- **Accept** — WP-03's scope-guard assertion passes.
- **Depends** — WP-01

---

# Stage 5 — Quality system and compliance

**1.5 weeks.** What makes the laboratory defensible to an assessor and satisfies the project's
reportable indicators.

### WP-29 · Land and complete the QC service · `P1`

- **Files** — `server/services/qcService.js` · `server/controllers/qcController.js` ·
  `server/prisma/schema.prisma`
- **Do** — `qcService` already computes blank thresholds, duplicate RPD and control recovery — commit
  it with tests. Then move `Batch.qcResults` from a JSON string to typed rows, and make
  `checkBatchDisposition` actually flag the results of a failed batch through `Result.batchId`.
- **Accept** — Test: a batch dispositioned `QC_FAIL` flags every result carrying its `batchId`.
- **Depends** — WP-01 (RPD pairs need WP-40)

### WP-30 · Proficiency testing model · `P1`

- **Files** — `server/prisma/schema.prisma` · `server/controllers/ptController.js` (new) ·
  `server/routes/ptRoutes.js` (new)
- **Do** — A PT round is a laboratory competence record, not a QC batch. Model
  `ProficiencyRound { provider, roundRef, analysisCode, assignedValue, uncertainty, labResult, zScore, outcome, date }`.
  This is a reportable indicator under the project's Activity 1.1, whose means of verification
  explicitly lists proficiency testing results — and it also covers the two committed FAO/IAEA ring trials.
- **Accept** — A PT round can be recorded and its z-score computed; results are reportable per
  laboratory and per analysis.
- **Depends** — WP-29

### WP-31 · Result provenance · `P1`

- **Files** — `server/prisma/schema.prisma` · `resultsController.js` · `workbenchController.js`
- **Do** — Add `Result.provenance` (MEASURED / PREDICTED / DERIVED / IMPORTED), defaulting to
  MEASURED. Derived values already written by `SYSTEM_CALC` become DERIVED. One field, needed by
  three future features: spectral prediction, legacy import and gamma spectrometry. **Must exist
  before any chemometric prediction is introduced**, or a predicted clay content becomes
  indistinguishable from a pipette determination.
- **Accept** — Every result carries a provenance; the certificate distinguishes measured from derived.
- **Depends** — WP-01

### WP-32 · Legacy data import · `P2`

- **Files** — `server/controllers/importController.js` (new) ·
  `client/src/pages/admin/LegacyImport.jsx` (new)
- **Do** — Import historical results with mandatory per-column method and unit mapping, writing
  `provenance: IMPORTED`. The project commits to five national legacy repositories and to
  harmonising that data — which is entirely a method-metadata problem.
- **Accept** — A CSV cannot be imported without every column mapped to an analysis, a method and a
  controlled unit.
- **Depends** — WP-19, WP-31

### WP-33 · Widen the MIR spectral window · `P3`

- **Files** — `server/services/spectralValidation.js`
- **Do** — `minWavenumber: 600` excludes the 400–600 cm⁻¹ region, which carries Si–O and Al–O–Si
  lattice bands informative for clay mineralogy. Widen to 400, or make the window a per-instrument
  property on the equipment record.
- **Accept** — A full-range KBr scan validates without being flagged.
- **Depends** — —

---

# Stage 6 — Productisation and obligations

**2 weeks.** What turns a deployment into a product, and what the project documents commit to.
Do not start before Stage 3 is stable.

### WP-34 · Resolve the licence conflict · `P1`

- **Files** — `server/config/glosis_catalog.json` · `LICENSE` · `README.md`
- **Do** — The GloSIS ontology and its codelists are CC BY-NC-SA 3.0 IGO — NonCommercial and
  ShareAlike. This repository is MIT, which cannot sublicense NC-SA content, and a 220 KB derived
  catalogue currently sits in it. Either remove the derived file from the MIT tree, or obtain written
  clarification from FAO on redistribution in an openly-licensed tool. **Blocks any public release**,
  and matters independently of the ontology decision.
- **Accept** — No NC-SA-derived content in an MIT-licensed tree without written permission.
- **Depends** — human decision

### WP-35 · Un-bake the deployment constants · `P2`

- **Files** — `server/controllers/koboController.js` · `sampleController.js` · `seed.js`
- **Do** — Move to seeded rows: seven laboratory codes with country and project
  (`koboController.js:12–18`); eleven country-to-laboratory mappings (`sampleController.js:15–32`,
  including four countries in neither project). Remove the `'SOILFER-US'` fallback at
  `koboController.js:267` — fail loudly instead. Replace fixed default credentials with generated
  ones printed once.
- **Accept** — Grep finds no country or project code in `server/controllers/`.
- **Depends** — WP-19

### WP-36 · Deployment profiles · `P2`

- **Files** — `profiles/soilfer/*.json` (new) · `profiles/default/*.json` (new) ·
  `server/seeds/profile.js` (new)
- **Do** — A profile is a folder of JSON seeded at install — labs, projects, branding, enabled
  catalogue and defaults, packages, thresholds, workflow, integrations, i18n overrides. Author two:
  `soilfer` reproducing today's deployment exactly, and `default` (one lab, no countries,
  **no interpretation bands at all**). **A profile must never contain code.**
- **Accept** — A clean database seeded from each profile produces the expected system. The SoilFER
  profile reproduces all seven laboratories.
- **Depends** — WP-35

### WP-37 · External mapping shelf · `P3`

- **Files** — `server/prisma/schema.prisma` · `client/src/components/admin/GlosisExplorer.jsx` (delete)
- **Do** — Create `ExternalMapping { entityType, entityKey, scheme, code, uri }` with no UI. Migrate
  the ten dormant `glosis_*` columns off Analysis and Methodology into it, then drop them. Remove the
  GloSIS explorer screen — it labels procedure groups as "soil properties" and teaches the wrong
  model. Keep the catalogue file as reference data only if WP-34 permits.
- **Accept** — Analysis and Methodology contain only laboratory-meaningful fields. The mapping table
  exists and is empty.
- **Depends** — WP-19, WP-34

### WP-38 · NSIS exchange specification · `P3`

- **Files** — `docs/nsis-exchange-v1.md` (new) · `server/routes/sisRoutes.js`
- **Do** — "At least 5 LIMS connected to NSIS" is a counted project indicator, and NSIS is built
  under a separate Letter of Agreement — so the format is a contract to negotiate, not a feature to
  invent. Publish a versioned specification; rename the API neutrally keeping `/api/v1/sis` as an
  alias so production does not break; validate against one country's real data before anyone reports
  "connected". FAO's OpenNSIS (`sis-database/owl2sql`) is the best available reference for what the
  far side expects.
- **Accept** — A versioned spec exists and someone outside the team has consumed it.
- **Depends** — WP-22 · external party

### WP-39 · Release engineering · `P3`

- **Files** — `Dockerfile` · `.github/workflows/ci.yml` · `CONTRIBUTING.md` (new) ·
  `SECURITY.md` (new) · `docs/UPGRADING.md` (new)
- **Do** — Tagged image built in CI from a commit, deployed by pulling that tag, previous tag
  retained for rollback — replacing the `scp` and `docker cp` runbook. Add PostgreSQL support through
  the same Prisma schema, keeping SQLite as default. Add `prisma migrate deploy` as an explicit step.
  Write the contribution guide, security contact and upgrade path.
- **Accept** — A deployment is one command against a tag; rollback is one command against the
  previous tag.
- **Depends** — WP-02, WP-36

---

# Definition of done

Checkable assertions. If all are true, the system is ready for a pilot laboratory.

| Assertion | How to check |
|---|---|
| All test suites run and pass in CI | `npm test`; CI green on main |
| Running the tests does not touch `prisma/dev.db` | checksum before and after |
| No dead security or validation code | WP-03 wiring suite passes |
| No cross-lab read on any endpoint | WP-41 suite; revert scopeGuard and it goes red |
| Every mutating route has a permission key | WP-42 matrix |
| No sample status outside the contract | `select distinct status from Sample` |
| Every status write goes through the helper | `grep -r "sample.update" \| grep status` |
| No unit or standard is free text | grep for `CONTROLLED_UNITS`; inspect the UI inputs |
| An unrecognised unit produces no verdict | WP-04 test |
| Every work-item state renders somewhere | WP-06 test |
| A technician can record below-LOQ, replicates and basis | WP-40 tests |
| A failed QC batch flags its results | WP-29 test |
| Every result carries method, unit, analyst, date, basis, provenance, batch | inspect the Result row |
| Nothing untrue appears on a certificate | basis, method and precision all match what was done |
| No organisation name in the code | grep for country codes, project codes, "SoilFER" |
| A clean install works unaided in five minutes | default profile, empty database, no source edits |

---

## One instruction to carry through every package

Six times, correct code in this repository has been written and never called. Before marking any
package complete, verify by **behaviour** — a passing test that exercises the path — not by the
presence of the code. **A commit message is not evidence.**

---

*SoilFER-LIMS · Volume X · agent-executable build specification · 2 September 2026 · 37 packages ·
6 stages · re-verified at `78ec938` · Stage 0 blocks all*
