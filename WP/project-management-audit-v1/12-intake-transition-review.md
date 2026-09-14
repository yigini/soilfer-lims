# Monitor review of PR98: preserve workflow validation and trusted origin

14 September 2026, 02:22 Europe/Rome. Feature `18836f1b58b126f4dc0183478fe81dcc1c984fcd`, PR98 open, CI 34792238821 running at start of check.

**I01 and I02 independently pass.** Two focused regression checks on the changed paths fail. Evidence: `monitor-intake-18836f1-probes.cjs` and `monitor-intake-18836f1-results.json`. All records are disposable fixtures and the source DB hash remains unchanged. The initial test harness omitted the application-level auth middleware for sampleRoutes and returned 401 on I04; this was corrected, and the recorded complete run uses the real verifyToken middleware and validates a genuine policy denial rather than accepting any HTTP error.

## I04 — critical: released sample reset bypasses canonical transition checks

Create a RELEASED project sample with approval fields; authenticate as SUPER_ADMIN; DELETE `/api/samples/:id`. Response 200 says reverted, the persisted sample becomes EXPECTED, and approvedAt is null.

The patch replaced `transitionSample` with a direct `tx.sample.update` in revert/delete paths. That provides transaction grouping but removes workflow transition validation. The admin bypass in outer delete permission/status checks makes the regression observable on released records. Do not treat super-admin capability as an automatic laboratory lifecycle exception or silently clear released approval state through an ordinary delete/discard operation.

Keep cleanup, sample transition and audit atomic AND preserve the canonical state/role invariants. Refactor the transition service to accept an existing transaction (or use one domain command that re-reads, validates and mutates all relevant rows within a transaction). Explicitly deny generic reset of released/approved/submitted/in-progress records according to the established lifecycle; any permitted controlled amendment must use its separate authorized, reasoned, versioned workflow. Cover reception discard, single delete and batch delete, with real positive draft discard and audit-failure rollback tests. Re-check relevant work inside the transaction so a stale parent status cannot erase actual results.

## I03 — positive-path regression: real walk-in origin is lost on second save

Create a genuine new desk draft through `/api/reception/intake` with isWalkIn true. Reopen and save again, then discard. All responses are 200, but discard reverts it to EXPECTED instead of following the legitimate desk-draft deletion contract; a phantom expected record remains.

`isNewlyCreatedDeskSample` is recomputed per request; the second save forcibly writes isWalkIn false. Persist trusted server-created origin at creation and preserve it on subsequent saves. Do not fix this by trusting arbitrary client isWalkIn flags for pre-existing records again. Verify origin semantics across new desk intake, project/pre-registered imports, repeated saves, legacy ambiguity and single/batch discard with one shared implementation. The current duplicated controller heuristics are not an immutable origin record.

## Delivery and next step

Preserve I01/I02 fixes and the existing safe implementation/deployment authorization, but fix this regression before accepting PR98 as complete. If a production cutover has already started, do not interrupt it blindly: preserve service and prioritize the corrective patch. Do not close the original scope on the strength of narrow probes or CI alone. No production mutation tests.

Monitor remains ACTIVE. Next check: inspect PR98/successor for canonical transaction-aware transition enforcement and persisted origin, rerun I01–I04 only after stable relevant changes, then return to original connected-workflow acceptance and live read-only verification. The two older queued broad prompts have not disappeared from the UI; avoid adding duplicates of them.

Delivery: sent I03/I04 regression note immediately in LIMSI / LIMS Dev during CI watch; composer cleared and agent work resumed. Avoid duplicating this message. Older two broad prompts remain queued; the specific critical prompt was sent separately to reach active work.
