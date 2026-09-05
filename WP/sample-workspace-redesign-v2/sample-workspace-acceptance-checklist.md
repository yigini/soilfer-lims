# Sample workspace — delivery acceptance checklist

Revision 2 · 6 September 2026. Companion to [the implementation specification](sample-page-redesign-plan.md).

**Status: specification only. The cases below have not been run against a redesigned implementation.** The implementation agent must add result, test/recording reference, commit and date to every case. Empty evidence is not a pass. Production records must not be used as disposable test fixtures.

## Test setup and evidence rules

- Isolated database using the actual SQLite/Prisma adapter; database + evidence-file test fixtures. No accidental production DATABASE_URL or file path. Reset fixtures through test setup, not through unsafe product reset controls.
- Two laboratories with overlapping human sample/field labels; reception users, two technicians, an authorized reviewer, an analyst-manager, MASTER_USER, SUPER_ADMIN, scoped project/country viewer, auditor and external viewer. Include inactive/revoked users and people assigned across explicitly authorized scopes.
- Samples: expected; received with complete checklist; received with unknown checklist; condition failure; accepted without generated tasks; mixed analyses; MIR-only; MIR+NIR; numeric/multi-output; partly reviewed; released; archived; disposed with/without retained aliquot; historical evidence anomaly resembling S003; identity anomaly resembling MOZ screenshot.
- Evidence: valid and invalid numeric values, censored values, originals/replicates, multiple spectral attempts, missing file, failed parser, mismatched sample mapping, expired preview, valid/warn/fail/unknown QC, instrument qualification valid at acquisition but expired now, retrospective equipment failure.
- Automated service and HTTP tests prove database/audit/receipt outcomes. Browser tests prove actual caller payloads and user behavior. Printed label scans and real supported vendor-export trials require recorded practical evidence; a screenshot alone does not prove them.
- For every rejected command assert no scientific changes, no success audit, no success notification and no file-reference corruption. For every successful command assert the intended mutation, correct audit actor/reason and exact receipt count.

## A. Identity, reception and existing controls

| ID | Scenario / action | Required outcome |
|---|---|---|
| A01 | Open expected sample with createdAt but no receptionDate | Date received says Not yet received; import/creation date has its own label; Receive sample is primary; no analytical approval action |
| A02 | Legacy accession appears to equal lab code | Separate field/lab/accession identities; ambiguity flagged; no automatic identifier rewrite, final label or report release |
| A03 | Same field label in two labs; direct URL and QR lookup | Correct immutable sample resolved under scope; no cross-lab access or arbitrary first-match selection |
| A04 | Receive from detail and return; refresh/retry after completion | Existing reception checks retained, stable accession, one intake outcome, original route/filter context restored |
| A05 | Intake checklist missing, partial, failed, not applicable | Not assessed/blocked/conditional disposition as configured; never Conforming merely because no failure boolean exists |
| A06 | Acceptance task generation fails | Entire command rolls back, or explicit generation-failed integrity state blocks work/release; idempotent repair does not duplicate tasks |
| A07 | Print label in standard and compact formats, reprint, cancel printer dialog | Verified field/accession/container identity, readable QR, correct dimensions; no workflow mutation or false physical-print success |
| A08 | Accepted-only batch label filter includes expected/quarantined/rejected fixtures | Only canonically eligible samples selected; provisional/quarantine labels require explicit selection and visible distinction |
| A09 | Technician label dialog cannot read admin settings; branding unavailable | Safe minimal branding/fallback works without granting settings permissions |
| A10 | Back, Workflow map, History, View report, full field data and narrow More actions | Every control operates, keeps sample identity/context and keyboard focus; no dead icon or duplicate independent audit state |
| A11 | Date-only collection value across time zones; missing coordinates; field-map outage | Date unchanged; coordinates remain missing; optional map failure does not disable unrelated work |
| A12 | Open after login expires or permission changes | Clear authentication/access state; unauthorized cached data not shown to next user; no silent null/empty scientific record |

## B. Orders, assignment and operational prerequisites

| ID | Scenario / action | Required outcome |
|---|---|---|
| B01 | Add individual method and bundle with overlapping analyses | Deduplicated canonical lines, method revision captured, exact generated work; no unnoticed method substitution |
| B02 | Add bundle vs explicit Replace selection | Merge and replacement are distinguishable; removal impact preview preserves recorded/submitted/accepted evidence |
| B03 | Save unchanged request; empty selection; inactive catalogue entry | No-op has no new revision; cancellation explicit; inactive historical method preserved, new unavailable work blocked |
| B04 | Open editor for sample A then B; background order update while editing | No stale bundle/errors, no cross-sample save, no overwritten form; version conflict retains edits |
| B05 | Add test after release, change scientific result, correct field label | Supplement/amendment/metadata impact classified correctly; original report and evidence retained |
| B06 | Change quantity/preparation requirements after work started | Exact dependencies/affected submissions identified; no deletion or blanket reset of unrelated work |
| B07 | Assign single/bulk to inactive, unqualified or out-of-scope staff | Denied consistently; eligible preview accurate; receipt lists only committed tasks |
| B08 | Reassign active task with draft; user renamed/deactivated | Handover and draft disposition explicit; historic author preserved; new assignee cannot silently overwrite sealed evidence |
| B09 | Complete method-specific preparation shared by several tests | One valid preparation satisfies only applicable methods; no fake result, redundant signatures or universal drying requirement |
| B10 | Instrument valid during acquisition, expires afterward; retrospective failure | Ordinary later expiry does not rewrite history; retrospective failure creates targeted hold/investigation |

## C. Data entry, instrument evidence and workbench parity

| ID | Scenario / action | Required outcome |
|---|---|---|
| C01 | Blank, zero, decimal comma, `<LOQ`, invalid unit/basis | Distinct validated outcomes, no default zero or silent unit conversion; raw entry preserved |
| C02 | Scalar, categorical, checklist, multi-output, computed and spectral methods | Correct shared editor; unknown type blocks with configuration message rather than scalar fallback |
| C03 | Draft on sample page → open workbench → edit → return | Same versioned draft, ownership and method; no copy divergence or loss |
| C04 | Draft autosave/Enter/close modal | No automatic record/submit/approve; failure retains input; navigation save/discard decision explicit |
| C05 | Bulk paste with unmatched/misaligned sample rows and locale values | Mapping preview, row-specific blockers, explicit accepted subset; no data assigned by visual row order alone |
| C06 | Preview completion then evidence/order/QC changes before commit | Stale preview rejected; no reselecting current rows behind user's confirmation |
| C07 | MIR/NIR export preview/commit, multiple replicates and attempts | Original file durable, correct sample/task/modality/axes/profile/attempt; upload does not imply analytical review |
| C08 | Unsupported file, wrong extension/content, missing array, failed parser, disconnected upload | No fabricated values/zero-filled chart, no completed task; recoverable staged state and actionable error |
| C09 | Same sample has an old approved scan and new submitted scan | Inspect/view/download/review use the selected exact evidence, not first/approved search result |
| C10 | Delete/restore/review spectral-library record referenced by an accepted result/report | Protected retention/amendment flow; no silently changed task or released evidence; unrelated MIR/NIR attempts unchanged |
| C11 | Spectral-only request with no model; model prediction out of domain | Acquisition deliverable valid when reviewed; no invented chemistry or unrelated matrix blocker; prediction carries model/provenance and applicable hold |
| C12 | Original spectral object missing after record creation | Evidence reference retained, clear recovery/integrity blocker, no substitution by another scan |

## D. Submission, review and access control

| ID | Scenario / action | Required outcome |
|---|---|---|
| D01 | Fresh intake, zero tasks, unassigned or evidence-free tasks; call every review/approval endpoint | Rejected regardless of visible buttons; required order lines cannot disappear from eligibility |
| D02 | Valid recorded but unsubmitted result; manager uses row/bulk/status/legacy routes | Acceptance denied; normal explicit submit enables review |
| D03 | Submit through sample page and workbench v2, including manager-as-analyst | Same scope/ownership/version rules, exact frozen membership, canonical status projection and audit |
| D04 | Partial submission by technician A while technician B has completed unsubmitted work | Only explicitly selected owned evidence submitted; no false full-submission declaration |
| D05 | Review one item from a three-item package | Package remains Partly reviewed; remaining two items can be reviewed later; prior decision cannot be overwritten |
| D06 | Return for transcription correction vs request physical reanalysis | New evidence revision vs new acquisition attempt distinguished; reasons/source/history retained |
| D07 | Reviewer is author; inactive authorization; method outside reviewer domain | Denied by configured scientific authority regardless of admin/master role; authorized independent reviewer succeeds |
| D08 | User from another lab calls task, submission, sample, report, PDF, raw-file and share endpoints | Consistent object-level denial; list/search/count and notifications do not leak unauthorized resources |
| D09 | Country/project read scope without analytical authority | Scoped browsing does not imply write/review/release authority; action capability and direct HTTP agree |
| D10 | Bulk IDs include unknown, duplicated, other-sample/lab, stale, invisible or already decided items | Explicit preview/errors, no silent inclusion; default per-sample atomic review has zero partial mutation |
| D11 | QC failed/missing/error/warning, blocked matrix, open nonconformance | Fail closed where required; warning disposition requires actual authority/reason; omission cannot launder a failed result as accepted |
| D12 | Technician draft broadcast reaches an authorized sample observer | Draft remains clearly separate and only visible per draft policy; cannot satisfy result/review eligibility |
| D13 | One or every test waived/canceled | Omission counts explicit; evidence retained; all-omitted order has administrative closure rather than analytical certificate |

## E. Reports, amendments, sharing and material

| ID | Scenario / action | Required outcome |
|---|---|---|
| E01 | Preview report with recorded/unreviewed results | Clearly draft; no publish/signature or automatic supersession; release blocked |
| E02 | Release reviewed full order | Exact accepted versions, actual authorizer/method revisions, valid scope, accurate measured/predicted/derived labels |
| E03 | Two releases race; repeated idempotency key; third later version | Unique monotonic versions 1/2/3; one outcome per key; no duplicated v2 or wrong latest |
| E04 | Rendering/storage/audit fails during release | Old release stays valid, no half-published new version or falsely successful receipt |
| E05 | Result or order changes while report preview open | Commit rejected as stale; user reviews updated exact scope |
| E06 | Open/print/download released report after catalogue/staff/results change | Original immutable snapshot, actual historic signatory and method; never regenerated from live defaults |
| E07 | Add test after release | Explicit supplemental order/report relationship; unaffected original report remains valid |
| E08 | Correct one accepted result; correct identity appearing on report | Targeted amendment, old version retained, affected evidence rereviewed, unrelated results preserved |
| E09 | Partial report policy disabled/enabled | Disabled by default; when enabled, accepted subset, outstanding tests and PARTIAL status explicit |
| E10 | Internal latest report has only draft/superseded/withdrawn records | No silent fallback presented as a current release; separate status and authorized history |
| E11 | Share/revoke from other lab; expired/revoked/withdrawn/superseded public link | Scope denied; revoked/expired/withdrawn content unavailable; superseded version clearly marked; no automatic access to new versions |
| E12 | Archived material requested for retest; retention unknown | Retrieval/custody/quantity checked; unknown retention blocks disposal rather than inventing a date |
| E13 | Disposed container with/without separately retained aliquot | No resurrection; new physical testing blocked unless verified available aliquot/new sample; metadata/transcription amendment remains possible |
| E14 | Archive/dispose interrupted or double-submitted | One authorization/execution event per outcome; physical fact not inferred from clicking a button; scientific record stays available |

## F. Synchronization, failure recovery and transaction integrity

| ID | Scenario / action | Required outcome |
|---|---|---|
| F01 | Navigate A→B while A's detail/report fetch finishes last | B's page never contains A's identity/evidence/report/action context |
| F02 | Numeric completion, spectral upload, order edit, assignment, submission, review, release and custody event | Sample/workbench/map/registry refresh relevant data from the same projection; singular/plural legacy payloads normalized |
| F03 | Duplicate/out-of-order events; reconnect after missing events | Event/version deduplication, bounded refetches, convergence without replacing unsaved input |
| F04 | 404 vs 403 vs network/500 vs no report vs map unavailable | Distinct actionable states; no failure portrayed as empty data or a successful operation |
| F05 | Timeout immediately after database commit | Unknown outcome resolves through same-key receipt lookup/retry; no duplicate submission/report |
| F06 | Two reviewers or analysts commit against same version | One succeeds; stale command conflicts with no overwrite; both user contexts remain understandable |
| F07 | Failure injected between submission creation/task update/audit/outbox | Transaction rolls back together; no orphan package, stale task status or success notification |
| F08 | GET detail/map/history/config | No domain repair writes; maintenance corrections require named audited commands |
| F09 | Logout, role change or scope revocation with cached sample/draft | Write capability refreshed, cache isolated, prohibited data cleared from next session; user draft handled under secure policy |
| F10 | Staged evidence file succeeds but database commit fails | Recoverable staged object; no complete work; retry safe; no deletion of referenced historic file |

## G. Human usability and release evidence

| ID | Scenario / action | Required outcome |
|---|---|---|
| G01 | Reception, technician, manager and auditor perform their normal job | Role-appropriate next action, full authorized sample context, no requirement to learn status codes |
| G02 | Keyboard-only navigation and screen reader for dialogs/errors/review | Labeled controls, focus containment/restoration, announced errors/state changes, no hover-only essential instructions |
| G03 | Light/dark, 360/768/1024/desktop widths, long names, English/Spanish | Readable nonoverlapping controls; no nested accidental scrolling; existing brand preserved; no untranslated critical commands |
| G04 | No assignments / no tests / no submissions / historic anomalies | Distinct honest empty states with next action; never zero results because “My assignments” filter hides others' work |
| G05 | Large realistic order/history and spectral data | Page remains responsive; lazy-load heavy maps/charts/history, bounded API payload, pagination preserves sample/selection; record measured timings and environment |
| G06 | Historical migration dry run and deterministic backfill | No mutation on dry run, uncertain links quarantined, zero fabricated evidence/actors/timestamps, source history and reports preserved |
| G07 | Restore backup with database and evidence objects | Identity/count/checksum verification passes in isolation; recovery instructions address new writes after migration |
| G08 | Deploy new guards with old client, then UI rollback | Legacy route cannot bypass rules; explicit refresh-required behavior if necessary; rollback does not re-enable unsafe writes |
| G09 | Actual lab pilot complete sequence | Reception→two technicians→partial review→correction→release→supplement/amendment→custody completed without hidden manual database fixes |
| G10 | Final delivery review | Exact commits, migration versions, test evidence and known limitations supplied; all required controls work; no open critical/high defect |

## Requirement-to-test traceability

| Findings / requirement | Primary cases |
|---|---|
| S01–S05: approval paths and spectral cascades | D01–D02, D07–D11, C09–C10 |
| S06–S07: report/result bypass and scope | D03, D08–D09, E01–E06 |
| S08–S09: order edits and destructive reopening | B02–B06, E07–E08, E12–E14 |
| S10–S12: submission/bulk UI contracts | D03–D05, D10, F07 |
| S13–S14: versions and inferred report provenance | E03–E06 |
| S15–S18: coverage, reads, roles and presentation | D04–D05, D07, D12–D13, F08, G01–G04 |
| S19–S20: workbench submit and stranded partial review | D03–D06, F05–F07 |
| S21–S23: events, drafts and query races | C03–C04, D12, F01–F04, F09 |
| S24–S25: report access and incorrect spectral selection | D08, E10–E11, C08–C10 |
| S26–S31: printing, intake, order editor and data quality | A05–A09, B02–B04, A11, G06 |
| Screenshot/control preservation and identity/date defects | A01–A03, A07–A11, G02–G03 |

## Release signoff record to complete

| Evidence | Required entry |
|---|---|
| Implementation and deployed commit | Exact hashes and environment |
| Schema/migration versions | Applied migrations; old-client compatibility evidence |
| Automated tests | Command/job references, counts, failure resolution; isolated runtime confirmation |
| Browser/pilot evidence | Role scenarios, utility interactions, accessibility/responsive recordings |
| Labels and instruments | Scan/print result on supported media; fixtures for each claimed import profile |
| Data reconciliation | Dry-run findings, deterministic fixes, unresolved records and release blocks |
| Backup/recovery | Restore verification and rollback/replay procedure |
| Defects/limitations | No unresolved critical/high defects; lower-severity items explicitly dispositioned, not concealed |
| Laboratory acceptance | Named acceptance record for the normal working sequence and configured SOP-dependent policies |

Do not claim that this checklist is complete because tests were added. Its cases must pass against the integrated delivered version, with relevant physical lab checks actually performed.
