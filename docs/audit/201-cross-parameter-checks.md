# Audit 4.8: cross-parameter checks (work in progress)

Scope: issue #201 and pins 6092380877, 6092654261 and 6092909004.

Six laboratory policy keys supply every configurable threshold. The evaluator
uses stored numeric observations at submission, or the validated current #192
reported selections during review. It does not parse, choose, average, convert
or supply missing analytical values. The seven rule outcomes are advisory.
Missing sodium only permits a flagged lower bound; all other pinned refusals,
unit/basis requirements, precedence and positive denominators are enforced.

CrossCheckEvaluation stores immutable submission evidence and policy versions.
Its additive installer distinguishes PRE_201, exact empty FRESH_PRISMA and
receipt-bound COMPLETE_201, refuses foreign/partial/unmarked populated states,
retains original rows and receipts, and reports zero backfills. Repeated apply
is a read-only NO_OP. UPDATE and DELETE are rejected by SQLite triggers.
The PRE_201 fixture and fresh-table oracle come from the checkout's own schema
using Prisma 7.10; loaders, DDL, oracle and fixture/caller remain source-bound.

The submission writer requires the caller transaction and actual submission
state, and reads its own scoped inputs. A late insert failure returns
CROSS_CHECK_EVIDENCE_WRITE_FAILED (409) and rolls back the workflow transaction.
The scoped GET /api/results/:sampleId/cross-checks requires APPROVE_RESULTS.
Before selection it reads retained submission evidence; after selection it
recomputes read-only from the reported-value reader, with no observation fallback.
The separate current/frozen panel and all flags/refusal reasons are translated
in all five locales. Requests discard stale sample or permission responses.

Validation so far:

- Owned normal setup: 8 suites / 259 tests passed, zero skipped (25.566 s),
  covering policies, evaluator, additive installer and existing security/wiring.
- Evidence/service and component checks: 2 suites / 23 tests passed, zero skipped
  (9.423 s). Includes real submission rollback, actual review/selection/HTTP,
  per-lab changes with immutable prior evidence, and five-locale panel behaviour.
- Client build passed (17.86 s); lint passed (0 errors, 14 existing warnings).

Outstanding: central submission wiring, replacement of the legacy advisory
messages, startup/entrypoint integration and attachment to the #192 review page.
Files shared with #199 wait until that PR is audited and merged, followed by a
rebase. Full server tests and final CI have not yet run for the complete feature.
No #201 PR, production changes, analytical/QC flag rewrites or backfills yet.

Deferred: EC/soluble-salts specification (#277). The old blocking texture gate
has a stricter implicit tolerance than its message, parses text and ignores
units. Pin6092909004 requires its block to remain byte-for-byte unchanged here;
the advisory tolerance applies only to the new evaluator. Correction is #278
and requires YY's scientific sign-off before implementation.
