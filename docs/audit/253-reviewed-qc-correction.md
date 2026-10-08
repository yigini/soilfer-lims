# Reviewed QC transcription correction (#253)

Scope pins: issue comments 6064618293 and 6066668666. Ordinary entry,
correction, reference rebinding, reopen and disposition retain their guards.
Pin 6068086333 additionally permits the one canonical policy description leaf,
`policies.keys.qc_reviewedTranscriptionCorrectionEnabled`, in all ten locale
files. Existing policy catalogue assertions and existing keys remain unchanged.

The existing `POST /api/qc/batches/:id/corrections` accepts a narrow
`mode: "REVIEWED_TRANSCRIPTION"` submission with `analysisCode`, `corrections`,
`reason` and `sourceReference`. Only existing observations may be replaced.
The reviewer requires `CHANGE_STATUS`, `APPROVE_RESULTS` and laboratory scope.
Stored observation authors and the recorded run analyst must differ from the
authenticated reviewer. Missing, system or unknown observation authors refuse;
the run creator is never substituted for a missing recorded analyst.

`qc.reviewedTranscriptionCorrectionEnabled` is laboratory scoped and defaults
to false in all presets. Only an undispositioned `QC_FAIL` analyte with a stored
failed evaluation can use this path. Closed, accepted, rejected, repeat-ordered,
dispositioned and historical snapshot observations remain locked. A request
cannot alter status, policy, membership, instruments, references or limits.

Native re-evaluation uses the frozen criteria snapshot. Compatibility
re-evaluation passes the original stored per-observation limits/modes, rule,
failure actions, QC mode and required counts to the existing evaluator. Missing
criteria produce `409 QC_REVIEWED_CRITERIA_UNAVAILABLE` before mutations;
current policy, profile, rules and presets cannot fill a gap. New observations
use the laboratory's current input format. Existing numeric and censoring facts
are used directly for arithmetic without reparsing original raw text in that
format. Original raw strings remain in views and historical records.

One transaction appends replacement measurements and the new evaluation,
sets each original measurement's existing one-time `supersededById` link,
updates the aggregate through the existing QC contract and records a
`QC_TRANSCRIPTION_CORRECTED` event. The event names the authenticated reviewer,
known run analyst, original observation authors, reason, source reference,
original/replacement reading ids and old/new evaluation ids. Original failed
evaluations and observation values are never rewritten or deleted. A correction
may pass or still fail; it does not create a disposition.

QC API views, inspection/history, native worksheets and subsequently assembled
reports disclose the original failure and reviewed replacement. New PDF output
uses that frozen report disclosure. Existing published report content is not
rewritten. The review form starts with empty replacement fields and requires
both reason and source reference. Client and server strings cover all five
supported locales in the additive `qcReviewedCorrection` namespace.

No database migration or backfill is required: schema changes **0**, migrated
rows **0**, backfilled rows **0**. Existing immutable records and append-only
event/evaluation tables provide the needed evidence. No production operation
is permitted while the #162 production freeze remains active.
