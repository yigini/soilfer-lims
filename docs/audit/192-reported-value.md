# Audit 3.3: reported-value selections (#192)

Reported outcomes are saved separately from analytical Result rows. A complete
selection group supersedes the preceding group; SQL rejects any update or
deletion. Reports, SIS v1, WET_CHEM and the reported grid consume these saved
outcomes. Raw SIS v2 observations and spectral references retain their Result
ids and row contract. V2 observations disclose a nullable
`reportedValueSelectionId` for a current, non-stale source membership.

Every mean uses complete chosen attempts and the recorded or frozen rule's
repeatability limit, exact controlled units and method. Missing or incompatible
limits, censoring, incomplete outputs and ambiguous recording times refuse
automatic means. The saved value has full precision; report rendering alone
uses its frozen Methodology.decimalPlaces. Explicit selection of QUESTIONED
evidence requires a reason and preserves the source rows' validity, flags and
currentness. All source QC, disposition, preparation and hold checks remain.

Pins 6074085003, 6074157693 and 6074198390 add the separate TEXTURE layout.
Exactly one canonical SAND, SILT and CLAY owner must each have a fresh saved
selection. The categorical owner either selects its exact matching Result or
derives a class from the saved fractions. DERIVED retains the union of every
fraction Result id, with empty owner attemptIds and exactly three selection
proofs. It writes no analytical Result. A missing/changed fraction selection or
recalculation refuses the saved TEXTURE as stale. Composite four-output groups
keep their original ownership. Mixed, unresolved or incomplete layouts refuse
with zero writes; classes are never averaged or voted on.

## Installation and historical back-fill

Production remains under the #162 demo freeze. These commands describe the
release procedure after its recorded lift and current-head Claude audit pass;
they are first run against an owned quiesced database copy.

1. Preserve the unchanged #178 COMPLETE/NO_OP prerequisite and approved #190,
   then #191 procedures. Resolve the 225 missing ordered-work entries through
   YY; never manufacture work or evidence. #191 blocked Result owner count
   must be zero.
2. From `server`, run
   `node scripts/install_reported_value_selections.js --db <owned-copy>`.
   The default is dry-run. Review PRE_192 (or empty FRESH_PRISMA) and zero writes.
3. Run the same command with `--apply`. Installation is additive and creates
   zero selections. Retained rows, issued report content and predecessor
   receipts remain unchanged. Repeat apply must be COMPLETE/NO_OP, zero writes.
4. Run `node scripts/backfill_reported_values.js --db <owned-copy> --by <active-global-approver>`.
   Review the JSON counts, every ambiguous work-item id and its reasons, and
   the published/superseded report hashes. It defaults to a byte-preserving
   dry-run. Automatic proposals also pass their retained source checks.
5. Apply only that reviewed plan with `--apply --plan-sha256 <dry-run-planSha256>`.
   Changed evidence or policy invalidates the plan. Report new selection-group,
   row and audit counts, unchanged report hashes and integrity checks in the PR.
   Repeating an unchanged plan is NO_OP with zero writes.
6. Ambiguous or stale existing selections need explicit review. Back-fill
   never guesses a reviewer choice, replaces a stale choice or alters a report
   already published or superseded. Missing selections refuse reported reads
   with `REPORTED_VALUE_SELECTION_REQUIRED`; changed lineage refuses with
   `REPORTED_VALUE_STALE`. A fresh NOT_REPORTABLE displays its reason.

The shipped entrypoint installs the pinned additive schema after #191. Direct
startup requires the complete #192 installation through a read-only gate;
startup does not choose or back-fill any reported value. SQL SHA-256:
`52b4df85d07ef6f63b35249e317037b64450ba718fda72c0a9e4df946cb628f7`.

## Fixture expectation changes

The new selection persistence tests declare zero-frequency QC criteria only for
their non-QC examples; a separate real required-QC test proves NO_BATCH refuses
with zero writes. Existing workflow, SQL and QC guards are retained. Reader
fixtures that formerly printed raw replicas or unchecked means must now save a
reviewed selection, assert its recorded repeatability rule, and expect one
reported output. Ambiguous evidence refuses rather than emitting a blank or an
unchecked mean. Raw observation and spectral-reference expectations remain.

| Fixture | Old expectation | Required expectation / pin |
| --- | --- | --- |
| `report_pdf.test.js` (five PDF/share cases) | Accepted raw scalar Results suffice for report generation. | Append AUTO_SINGLE through the actual selection authority; retain every PDF/share/revocation assertion (6073676241). |
| `controlled_units_interpretation.test.js` (report assembly) | Interpret accepted raw scalar Results directly. | Save each owner's choice and keep the exact normalization/diagnostic assertions (6073676241). Its named non-QC lab explicitly waives batch QC via policy, rather than bypassing the source guard. |
| `export_normalization.test.js` (WET_CHEM, GeoJSON) | Normalize a raw SOC Result directly. | Save AUTO_SINGLE and preserve exact values and scope checks (6073676241); its unique non-QC lab explicitly waives batch QC through policy. |
| `sis_adapter_service.test.js` (V1 representation) | V1 formatter consumes `sample.results`. | V1 requires a selection DTO; supplying only raw Results yields no reported values. V2/raw extractor assertions remain unchanged (6073676241). |
| `audit_1_2_guard_installer.test.js` (complete startup) | Complete through #191. | Install #192 normally before asserting real read-only startup and health (new required startup gate). |
| `audit_0_3_publication.test.js` (positive measured publication) | Accepted raw Results alone permit publication. | Save a fresh selection through the normal authority; retain the original permission, QC and preparation refusal order (6073676241). |
| `audit_0_3_publication.test.js` (invalid or incomplete accepted evidence) | An empty report can be emitted after excluding the invalid raw value. | Refuse with `REPORTED_VALUE_SELECTION_REQUIRED` and no report writes; the reviewer must explicitly choose NOT_REPORTABLE or eligible evidence (6073676241). |
| `audit_0_3_publication.test.js` (REQUIRED_WARN, all five locales) | Accepted status plus a request acknowledgement permits printing. | Make the real review and durable acknowledgement, then preserve the exact translated QC caveat assertions (6073676241). |
| `audit_0_8_report_truthfulness.test.js`, `audit_0_9_public_report_superseded.test.js` (positive reports) | Raw scalar evidence is sufficient. | Append a normal saved choice; retain number, version, historical content, QC, share and supersession assertions (6073676241). |
| `audit_0_7_resubmission.test.js` (S1/S2 isolation, individual and bulk RETURN) | Accept the new submission implicitly. | Explicitly choose the repeat while its original remains QUESTIONED; preserve all old-submission isolation and retained-data assertions (6072757161, 6073013502). |
| `audit_1_0_lab_policies.test.js` (positive reported outcomes) | Resolve the current reporting policy during export. | Save the choice first and expose its frozen policy source/version and selection rule; later policy changes do not rewrite it (5975240263, 6073676241). |
| `scenarios/golden_path.test.js` (reviewed PH repeat) | Submission acceptance implicitly selects the repeat. | Choose the repeat explicitly through real submission acceptance, with zero review errors; retained original evidence remains QUESTIONED (6072757161, 6073013502). |
| `audit_253_reviewed_qc_correction.test.js` (#253 positive corrected-QC report) | Fixture status alone makes its measurement reportable. | Complete, submit and review normally to append a fresh selection; preserve the original QC/repeat/reporting assertions (6073676241). |
| `api_key_scoping_isolation.test.js`, `nsis_policy_and_scoping.test.js` (positive scoped reads) | Accepted raw Results suffice, including legacy lab aliases. | Ensure the fixtures' declared labs, apply their owned non-QC policy and save choices normally; all foreign-lab/id refusal assertions remain (6073676241). |
| `result_provenance.test.js` | Manually reviewed raw Results and a standalone TEXTURE class can print. | Use real submission/review; declare TOTAL_N repeatability before its Results; provide a real composite texture with 35/35/30 fraction evidence and the unchanged calculated class (6073057498, 6073676241). |
| `audit_2_3_native_runs.test.js` (two reporting cases) | Legacy raw fixtures are ready to print; invalid sources are excluded. | Upgrade the owned fixture through #190, #191 and #192, save its choice normally and preserve every QC mode contribution. Invalid source selection refuses with zero writes, and an absent selection refuses report generation (6073676241). |
| `audit_2_4_bracket_disposition.test.js` (later failed bracket scope) | Build accepted rows before the later QC failure. | Establish actual passing QC and real reviews first, then append the later failed observation through normal run reopening and a reasoned correction; keep all original scope and frozen-report assertions (6073676241). |
| `audit_0_10_current_result_views.test.js` (replicas and units) | Mean raw replicas and normalize unlike units before averaging. | Refuse incomplete evidence and unlike controlled units with no export audit. A complete, declared-r duplicate selection emits one full-precision value and retains every raw id (6072618378, 6073013502, 6073676241). |
| `audit_0_10_current_result_views.test.js` (ambiguous methodology/qualifier) | Export a blank ambiguous value. | First refuse missing selection with zero writes, then allow an explicit NOT_REPORTABLE with the localized saved reason; retain independent good values and every raw row (6073676241). |
| `audit_0_10_current_result_views.test.js` (policy changes and unknown rule) | Re-resolve policy on export or use an unchecked mean. | Freeze the saved rule/version; unknown selection policy refuses preflight. Actual mean contracts require r and test the exact boundary and missing-r refusal (5975240263, 6072618378, 6073676241). |
| `audit_1_4_uuid_transactions.test.js` (accepted texture followed by fraction repeat) | Repeat an accepted fraction and review its recalculated TEXTURE again. | Real fraction/TEXTURE acceptance, then 409 WORK_REPEAT_STATE_REFUSED and identical counts/content for WorkItem/history, WorkAttempt, Result, ReviewDecision, AuditLog/WORKITEM events and selections. Preserve frozen accepted evidence (6074706976). |
| `qc_controls.test.js` (positive manager disposition) | An independently invalid default Result can be accepted after PROCEED_WITH_WARNING. | Seed the intended valid 6.8 measurement before the disposition; keep the original failed-QC refusal, manager override, success and locked-batch assertions. #192 now rejects independently invalid sources; tests prove an override cannot bypass that check in any QC mode (6073676241). |

Pin [6074706976](https://github.com/yigini/soilfer-lims/issues/192#issuecomment-6074706976)
keeps recalculation coverage in `workbench appends the second replica of a repeated
fraction, recalculates from REPLICATE_ADDED and requires a new real review`: the
actual event causes recalculation before acceptance, no review is inherited,
and a new real ReviewDecision binds the recalculated Result. The separate
texture test `a replacement fraction selection makes retained TEXTURE stale
without changing it` compares the accepted attempt, analytical Result and
ReviewDecision unchanged, as well as retaining the old selection row.

PDF explanations retain their full localized saved reason, including across
page boundaries, followed by the next frozen-format numeric result. An
unavailable value has no numeric interpretation. Layout contracts cover short
and multiple-page reasons in all five locales, with rendered PDF inspection.

Dry back-fill reports invalid layouts or incomplete lineage per work item as
AMBIGUOUS, with ids and reason codes. Separate TEXTURE needs persisted fraction
choices, so an owned historical copy can require a second reviewed dry/apply
pass after the fraction choices are appended. No dry-run invents provisional
fraction selections. Duplicate-marker rows have no canonical executions and do
not emit an additional reported value; existing publication checks still inspect
all work items.
