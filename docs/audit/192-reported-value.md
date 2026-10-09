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
`6fe61f858a4978774c6a799088d9ceaa5dac20429d9ef9ea7d43e8d5827aad3b`.

## Fixture expectation changes

The new selection persistence tests declare zero-frequency QC criteria only for
their non-QC examples; a separate real required-QC test proves NO_BATCH refuses
with zero writes. Existing workflow, SQL and QC guards are retained. Reader
fixtures that formerly printed raw replicas or unchecked means must now save a
reviewed selection, assert its recorded repeatability rule, and expect one
reported output. Ambiguous evidence refuses rather than emitting a blank or an
unchecked mean. Raw observation and spectral-reference expectations remain.
