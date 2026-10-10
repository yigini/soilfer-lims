# Audit 4.8: cross-parameter checks

Scope: issue #201 and pins 6092380877, 6092654261, 6092909004, 6093661225 and 6093810127.

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

The central submission service now calls the evidence writer in its transaction
for every submission entry point. The writer requires actual submission
state, and reads its own scoped inputs. A late insert failure returns
CROSS_CHECK_EVIDENCE_WRITE_FAILED (409) and rolls back the workflow transaction.
The scoped GET /api/results/:sampleId/cross-checks requires APPROVE_RESULTS.
Before selection it reads retained submission evidence; after selection it
recomputes read-only from the reported-value reader, with no observation fallback.
The separate current/frozen panel and all flags/refusal reasons are translated
in all five locales. Requests discard stale sample or permission responses.
The panel is attached to the sample review page for users with APPROVE_RESULTS.
Save and submission responses expose the new outcomes as a separate crossChecks
field alongside the unchanged legacy matrixDiagnostics object. The new evaluator
never uses legacy advisory values, warnings or flags as inputs. Pin6093661225
withdraws the earlier instruction to replace the legacy advisory implementation:
validateSampleMatrix and every existing test remain unchanged. Only the separate
new outcomes supply CrossCheckEvaluation rows and CROSS_CHECK_* flags.
Pin6093810127 preserves the authorized historical workflow when the sample lab
does not resolve through policyService: save, submission and review disclose
crossChecks:[] and crossCheckUnavailableReason:CROSS_CHECK_LAB_REQUIRED, with no
evaluation rows, invented lab or policy substitute. The panel translates the
unavailable message in five locales. Registered inactive labs still use their
own policy; existing workflow guards decide whether their work may continue.
Every other registered-lab evidence failure remains an atomic stable4xx refusal.

Startup integration is additive: Docker invokes the classified installer after
its prerequisites, with the reviewed SQL and fresh-table oracle bundled outside
the mounted prisma directory. Direct startup performs a read-only COMPLETE_201
gate before loading the app, writable adapter or schedulers. The normal test setup
calls the real installer only on its newly owned database copy.

With the lab stopped and its complete SQLite files preserved, use:

```sh
cd server
node scripts/install_cross_check_evaluations.js --db /absolute/path/to/lab.db --dry-run
node scripts/install_cross_check_evaluations.js --db /absolute/path/to/lab.db --apply
```

Retain the dry-run/apply outputs and counts. Refusal of an unknown, partial,
foreign or unmarked populated state requires investigation; do not delete rows,
recreate the database or invent an adoption receipt. No historical evidence is
backfilled. A repeated completed installation reports NO_OP and zero changes.

Validation so far:

- Owned normal setup: 8 suites / 259 tests passed, zero skipped (25.566 s),
  covering policies, evaluator, additive installer and existing security/wiring.
- Evidence/service and component checks: 2 suites / 28 tests passed, zero skipped
  (13.773 s). Includes actual central submission rollback, actual review/selection/HTTP,
  partial selections with no observation fallback, startup/NO_OP after real evidence,
  invalid retained JSON refusal, lab isolation and five-locale panel behaviour.
- Existing repeat, bracket-disposition and selection-acceptance contracts:
  3 suites / 85 tests passed, zero skipped (93.918 s).
- Client build passed (17.86 s); lint passed (0 errors, 14 existing warnings).
- Current compatibility/startup wiring client build passed (17.02 s); lint
  passed (0 errors, the same 14 existing warnings).
- Compatibility correction: 2 suites / 32 tests passed, zero skipped (22.645 s).
  Missing C:N basis returns NOT_EVALUATED/BASIS_MISMATCH; equal explicit bases
  flag C:N 90/2. Actual submission HTTP responses retain the legacy diagnostics
  while returning the separate new outcomes and immutable evidence.
- Missing-lab scope pin: 2 suites / 40 tests passed, zero skipped (26.390 s).
  The real save/submission/review HTTP flow preserves an unregistered historical
  lab's behavior, discloses the reason and writes zero evidence. Missing lab
  metadata is read-only/unavailable; an inactive registered lab records its own
  policy override normally. Five-locale panel tests disclose unavailable checks
  without an empty pass list. Existing registered-lab rollback assertions remain.
  Corrected client build passed (8.29 s); lint passed (0 errors, 14 existing warnings).
- At wiring predecessor22da, normal setup/startup/security/matrix regression
  checks passed10/11 suites and262/265 tests (54.102 s). Three unchanged matrix
  assertions failed because of the unresolved-lab refusal; pin6093810127 resolves
  that authority explicitly. This failed log is retained; the corrected normal
  regression run is still pending.
- Corrected normal setup regression: 11 suites / 273 tests passed, zero skipped
  (50.992 s), including every unchanged matrix assertion, real direct startup,
  new evidence/UI/policy/installer cases and existing security/wiring/scanners.
  The template SHA stayed65d58934d45081f1e5366006be22a88e313f436c3b35bec95395e63ae47c05fe.
- Latest startup/bootstrap/security checks: 3 suites / 136 tests passed,
  zero skipped (29.157 s), with every existing release assertion retained.
- Both submission endpoints expose the separate evidence/unavailable response:
  2 evidence/UI suites / 42 tests passed, zero skipped (30.518 s), including the
  real /api/submissions registered and unregistered lab cases with retained Results.

The Docker readiness script now includes cross-check-installer-pre201 on its
already owned #192-complete copy: classified dry/apply/readiness/repeated NO_OP
checks retain all original rows, objects and receipts, with zero evaluations
and backfills. Both invocations are explicitly direct installer-module calls;
default-entrypoint health is covered separately by the existing scenarios.
This new Docker proof remains pending final CI and is not a production run.

After #199 merged, the branch was rebased onto main. The complete normal server
run at dc3516cd82d1fd295402834a603c374c203ab94b passes all 324 suites and
4,894 tests, zero skipped (2,344.410 s). It used the checkout's own 90-model
client and normal global setup/teardown. The retained Help-only template remains
SHA25665d58934d45081f1e5366006be22a88e313f436c3b35bec95395e63ae47c05fe.
Current client build passes (32.26 s); lint passes (0 errors, 14 existing warnings).
The prior full run passed 323 suites / 4,893 tests and found one retained startup
fixture missing the real #201 installation. Its log is retained; the fixture now
applies the actual installer with zero evaluation/backfill counts before all
original startup assertions. That complete 25-test file also passes separately.
The final documentation-only commit records these results; exact-head Linux CI,
Docker readiness and Claude's audit remain required before merge. No production
changes, analytical/QC flag rewrites or backfills have occurred.

Deferred: EC/soluble-salts specification (#277). The old blocking texture gate
has a stricter implicit tolerance than its message, parses text and ignores
units. Pin6092909004 requires its block to remain byte-for-byte unchanged here;
the advisory tolerance applies only to the new evaluator. Correction is #278
and requires YY's scientific sign-off before implementation.
The unchanged legacy C:N/base-saturation advisory parser, absent basis/unit and
implicit Na=0 behavior are explicitly deferred to #279 under pin6093661225.
