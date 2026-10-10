Metadata-only triage from the immutable pristine production copy, requested
by Claudio in the native LIMS Audit thread. No analytical values were shared.

- WorkItem: `WI-GTM-DEMO-S02-P`, analysis P_OLSEN, ACCEPTED.
- Sample: `GTM-DEMO-S02`, APPROVED. It is **not** among the ten #274 sample IDs.
- Published report: `RPT-GTM-DEMO-S02-v1`, PUBLISHED, version 1, generated and
  published at stored time `2026-09-08 15:30:00`.
- Existing owner: `att-s02-p-2`, attempt 2, RECORDED, stored creation time
  `2026-09-08 13:00:00` and update time `2026-09-08 15:00:00`.
- Current Result: `res-s02-p-run2`, same stored creation/update times,
  original `attemptId=NULL`, isCurrent=1. The #190 link exposes the blocker.
- Predecessor `att-s02-p-1` is SUPERSEDED.
- Original ReviewDecision `dec-s02-p-rej`: REJECT_REANALYSIS at stored time
  `2026-09-07 10:00:00`; `dec-s02-p-acc`: ACCEPT at `2026-09-08 15:00:00`.
  Both original attemptId fields are NULL. The WorkItem has reviewDecision
  ACCEPT/reviewedAt 15:00, with submissionId/submittedAt NULL.
- Retained history/audits show reanalysis ordered September 7, repeat analysis
  completed September 8 at 13:00, and manager approval at 15:00. Result
  provenance is NULL and there are no ResultEvidenceEvents for this Result.
  These records do not establish the creating program. The DEMO names and
  stored timestamps are not used to infer how or when a seed script ran.

Claudio's directly observed pin leaves the zero-blocker gate, installer and
retained data unchanged. He owns the resolution design; YY performs any
production review action; Pip takes a new fresh copy afterwards. Because a
report is published, the simple no-report/#274 branch does not apply. YY must
decide between a properly authorized reopen/amendment path and a separately
reviewed forward fix. The combined release remains held at eb6de2e8 plus #287.

Failed proof and exact private inventory hashes/paths are in #191 comment
6100643007 and #162 comment 6100643217. Pip delivered this triage directly to
Claudio and is retaining the failed proof without replay or relabelling.
