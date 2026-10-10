# Sample amendment authorisation (#210, WIP)

Scope: author pins [6091161203](https://github.com/yigini/soilfer-lims/issues/210#issuecomment-6091161203), [6091749343](https://github.com/yigini/soilfer-lims/issues/210#issuecomment-6091749343), and [6094004400](https://github.com/yigini/soilfer-lims/issues/210#issuecomment-6094004400).

Requests persist PENDING evidence. Non-scientific authorisation re-reads the laboratory's second-person policy, applies retained clerical corrections with profile revision CAS, and records ORDER/REPORT proposals without making those changes. Scientific authorisation validates every selected current accepted measurement line and its unambiguous current accepted attempt, the assigned registered laboratory, holds, released batch evidence and the existing attempt-limit policy before writing. The same transaction approves the request, retains the prior approval pair, mints a private transaction-bound capability, reopens only the selected lines, and creates OPEN children linked through SampleAmendmentAttempt. Accepted parent attempts and prior analytical, QC, calculation and reported-selection rows remain unchanged. Ordinary transition and repeat paths do not acquire the new authority.

ReportAmendmentWithdrawal has exactly id, unique reportId, amendmentId and createdAt, with restrictive Report/SampleAmendment foreign keys. The authorisation transaction inserts the immutable binding before changing the current issued Report to WITHDRAWN and writing authorisation evidence. Guards retain every other report field, except updatedAt, and prevent changing a withdrawn status later. Links remain retained. Public JSON/PDF refuse with 409 REPORT_WITHDRAWN before expiry/revocation, without content or a replacement pointer. Internal history/HTML/PDF use the exact binding and full amendment UUID; all five locales have the withdrawal banner. Issued-number queries include WITHDRAWN, preserving the base and incrementing the revision on later issuance without altering the withdrawn row.

The classified installer adds five nullable SampleAmendment columns, the attempt-link and withdrawal tables and their unique indexes, plus fourteen guards. Dry-run and repeat apply perform zero writes. Historical values, schema objects, foreign keys and receipts are retained; no legacy authority is adopted. Counts are zero new amendments, zero attempt links, zero withdrawals and zero backfills at installation. Production counts are unrun under the #190 disk hold.

The new withdrawal table/index is copied exactly from an independent unmodified Prisma7.10.0 fresh-schema emission: 86 models, 70,297 bytes, SHA256 `2b085496a93ce8640e541f512579f3ed7e49bab134969701fa5a92138ee6ea99`. The literal PRE_210 remains the original 84-model schema at 7ea12c66 (68,418 bytes, SHA256 `6ae0cc1d26dc3ba301d435d3f332d432a9765c3d30b7fd0725aa119db6f8f622`). Its exact generation command is retained in the closed helper; no DDL bytes or factory behavior changed. Source/oracle/loader digests remain independently bound in the existing scanner.

Validation at this WIP stage is focused, not a whole-issue pass. At 35e0d81e, five focused suites pass all 220 tests (zero skipped, 105.650s); client build passes in 16.62s and lint passes with zero errors and fourteen existing warnings. Tests cover actual owned SQLite transactions, actual report HTTP routes, five-locale HTML/PDF banners, attempt-limit refusal, registered-lab authority, forged capability refusal, late rollback, and full retained rows. The first 4-suite run passed 206 tests and failed the new guard-count expectation; the next 5-suite run passed 216 tests and caught a helper source digest changed while that run was in progress. Both failed logs are retained, and the final run uses frozen source. The client build's generated workflow-contract mirror is committed. No existing behavioral assertion, test, permission, scientific gate or fixture authority is weakened.

After #199 merged, pin6094281140 confirmed one read-only application checker and no new SQL Result authority. The existing #190/#191 guards and receipt sources remain byte-identical. First fill, partial replica completion and submission completeness read the same immutable amendment link and persisted request. The two focused suites pass all 64 tests in 112.190s, including the unchanged #191 repeat suite. The first run passed 62 tests and found two new test setup errors: the ordinary approved-sample refusal code and a replica beyond the configured limit; both logs are retained. The exact ordinary refusal and all old repeat assertions are retained.

Mounted request/list/authorise routes replace the self-approval controller. Request and authorisation each keep their scoped idempotency receipt inside the same transaction, and historical unversioned receipts are refused. The dialog selects accepted lines, shows the full UUID, keeps failed input and honours the laboratory's second-person policy. A released profile correction now saves a pending request; it does not claim the correction was applied. All five client/server locale catalogues are extended. Client build passes in 20.83s and lint with zero errors and fourteen existing warnings. The old profile and P6 assertions now follow the real request and separate authorisation; their normal-suite validation is pending. The captured historical DDL and helpers' callers are unchanged, with exactly the two #210 tables and five nullable columns accounted for as missing model fields.

The subsequent seven-suite run passed 235 tests and caught one missing inventory entry for the new replica acceptance file. Only that file was added to the existing execution-set factory's permitted callers; no factory behavior, export, guard or canary assertion changed. All 105 security-scan tests then passed in 24.850s. The other six suites (131 tests, including ten new dialog tests and six retained calculation UI tests) passed in the original run. These are separate focused results, not a complete same-head full-suite pass.

At be0e5, the normal owned twelve-suite run passed 322 tests and failed two retained profile-route assertions (324 total, 352.352s). Its template digest remained unchanged. Both manager tokens had resolved to the same persisted user through the role/lab token helper, so the second-person guard correctly refused authorisation and the later revision expectation could not hold. The fixture now creates a distinct persisted approver; all original assertions remain.

The startup gate now checks the exact complete installer classification read-only before loading the app, scheduler or writable adapters. The shipped default entrypoint applies the classified installer and Docker retains both digest-bound migration/oracle files outside the mounted Prisma volume. Readiness code preserves the existing PRE_199/default-entrypoint proof and extends that same actual launch with PRE_210/COMPLETE_210, every original field and receipt, zero adoption/backfill and a byte-preserving direct-module NO_OP. The normal owned run at 81c0e5 passes all fourteen suites and 361 tests in 374.778s, zero skipped, including the entire retained startup file, CLI boundary, both scanners, profile/P6, unchanged repeat and calculation UI suites. Its published Help-only template digest remains unchanged. The actual Docker run is pending CI.

At 5feeeaa, all thirteen tests in the first-fill file pass (25.340s), using a read-only backup of the empty owned normal-harness database. The new integration case runs actual original recording/submission/review/approval/publication, separate scientific request/authorisation, replacement recording/submission/review/reapproval and report generation through actual mounted routes. It verifies the new revision reserves the old base, the new approval and selected source are frozen, and the withdrawn report content/fields, public link, accepted parent, old reported selections and immutable binding remain unchanged. Public JSON/PDF refuse the withdrawn original, while internal history reads retain its full content and amendment UUID. The first run passed twelve tests and caught a new assertion expecting numbering metadata in the compact generation response; the final assertion reads the actual persisted Report row, with the original endpoint behavior unchanged. Logs and owned backups are retained. These focused counts are separate, not a whole-suite aggregate.

The frozen normal full Windows run at 75c91ba completed with 317 passing and
seven failing suites; 4,867 passing and 17 failing tests, 4,884 total, zero skipped
(2,282.374 s). Its Help-only template digest remained unchanged. Four files
omitted the real new installer in retained startup/workspace fixtures. Current
fixtures install it through its actual classified owner, preserving the literal
historical schemas, factory authority and all existing assertions. The candidate
release file passes 26/26 tests (8.999 s). The five-file compatibility run passed
268 tests and caught one bootstrap prerequisite still being installed inside its
unchanged byte-preserving startup check; the actual installation now precedes
beforeSha. The complete corrected bootstrap file passes 10/10 (34.596 s).

The full-run owned checkout also lacked client/dist, so reception and actual
Chromium checks could not load the client. A review test timed out and caused
later nested-isolation failures. The unchanged review file passes all ten tests
separately at ef7a463 (10.259 s). The additional focused run passed 14/17 tests:
the remaining browser and reception 404s came from Express send's default
dotfile-path handling of the source checkout under .codex. Its client build
exists, but send refuses that hidden absolute path. The final owned checkout is
outside .codex and must build its own client before rerunning the unchanged
tests; no production serving behavior or test timeout is altered. Failed logs,
browser artifacts and owned copies are retained. Source client build passes
(19.15 s), and lint passes (zero errors, fourteen existing warnings).

At 63892ca, the owned checkout generated its own 91-model Prisma client and
built its client (9.349 s); lint passed with zero errors and fourteen existing
warnings. The seven previously failing normal files then passed all 181 tests,
zero skipped (144.689 s), including actual Chromium, reception, review and
startup checks. Its Help-only template remained byte-identical.

The subsequent complete normal Windows invocation ended with native process
exit 3221226505 (0xC0000409) after 1,263.808 s. The retained log has 169 PASS
suites and zero FAIL suites, no Jest summary, and reception_stage_d as the last
completed suite. No local full pass or cause for the native failure is claimed.
Logs, the exit receipt and the unchanged template digest are retained.

Claude's verification pin6095236240 requires a complete exact-head normal Linux
CI run and both Docker stages as the primary full-suite evidence, with this
Windows limitation disclosed in the PR. No frozen Windows full run is repeated
without new diagnostics; no test, mock or timeout is weakened. The branch is
rebased onto the merged #201 implementation, retaining both actual installers,
startup gates, migration-source bindings and all predecessor assertions.

At rebased executable head3e9ca5ca, the owned checkout generated its own
92-model client; build passed (8.805 s), and lint passed with zero errors and
fourteen existing warnings. A normal 24-file focused invocation ended with
native exit3221225477 (0xC0000005) after368.374 s: fifteen PASS suites, zero FAIL,
no Jest summary. The last completed suite was deployment_readiness_bootstrap;
completed suites also include all five #201 files, amendment first fill and
installation, separate authorisation, unchanged repeat commands, the startup
installer, actual Chromium and the state-write scanner. The template digest
remained unchanged. The failed invocation and receipt are retained; its counts
are not represented as a completed focused or full pass. No application1000
node event was returned by the diagnostic query, so no crash cause is claimed.

Still unfinished: exact-head Linux CI, actual Docker readiness and audit.
Amendment numbering beyond the full retained UUID remains
deferred; public replacement navigation belongs to #211. Production installation
and counts remain unrun under the #190 disk hold.

Claude's early review6095648270 at1b7389d5 requested seven corrections.
This WIP adds explicit per-line repeat-limit assessments using the existing
REPEAT_LIMIT NCR owner, a five-locale public withdrawal notice, actual unlinked
accepted-parent refusal paths, persisted field-fault/SQL-guard probes,
authorise-time line revalidation, and an additional current-main predecessor
literal. The new literal is unmodified own Prisma7.10 stdout from main
e7259dd8108330155ad29225087abdc17e00aa50:90 models,77186 bytes,
SHA256 b7de680237c07ff2454ed27afcc95481ddb45cc24cd80ade943b88291d9ca397.
Its provenance file records the exact command and schema digest. The old
84-model literal, old factory and their digest boundaries remain unchanged.
The new tests are awaiting validation; this WIP is not an audit-ready head.

Children are created by the capability-bound scientific authorisation
transaction after the existing released-source and repeat-capacity checks;
they do not go through reserveRepeat, which seals an ordinary repeat parent.
The accepted parent remains sealed. Actual unlinked accepted-parent calls
must return409 ATTEMPT_CORRECTION_REQUIRED with no persisted changes. For
field faults the actual writer must return409 AMENDMENT_ATTEMPT_LINK_INVALID;
sample changes at the same authorised version, selected-line changes and
child-reason changes are instead prevented by the retained SQL guards.
