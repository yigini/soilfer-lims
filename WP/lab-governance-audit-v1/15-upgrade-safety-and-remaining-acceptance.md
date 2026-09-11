# Independent review 15: preserve invitations during upgrade and finish acceptance

Reviewed `4b2737e0b349f1b8ae2d445d58ea227a8086a8b2`. PR #94 open; CI run 34614873664 successful. Merge and deployment hold remains.

## Accepted evidence

Independent reruns of `invitation-boundaries-review.cjs` and `invitation-review.cjs` at 15:19 UTC on 11 September 2026: all J01–J05 and I00–I04 pass. Source database hash unchanged. The actual invitation roster screenshot shows active/expired states and reissue/revoke actions. New browser journey and translation wiring are useful progress. Preserve these repairs.

## K01 — High: public GET mutates historical invitation state

Runner: `C:/Users/yigin/AppData/Local/Temp/codex-lab-ui-review/migration-read-review.cjs`.

Results: `C:/Users/yigin/AppData/Local/Temp/codex-lab-ui-review/migration-read-results.json`, captured `2026-09-11T15:20:07.564Z`.

Fictional schema-only upgrade fixture contains two unconsumed/unrevoked invitations for the same email, with different lab and role grants. No unique index exists, matching the intermediate version that allowed duplicate invitations.

An unauthenticated `GET /api/auth/invitation/not-a-valid-token` returns 404, but changes the first invitation to `isRevoked:true`; the second remains live. Audit count is zero. `ensureTables()` performs global duplicate revocation before verifying the requested token. The table/index creation catch still logs errors and continues. No source records were copied or mutated: SHA-256 before/after `388e85fbc6573509f0c56e0f1db6989fa682c2931af5a90b0b82eeb1a0e6a90b`.

Required correction:

1. Remove invitation data mutation from runtime schema initialization and every read/auth lookup path. Do not let a rejected or unauthorized read repair/revoke records.
2. Replace `max(rowid)` winner selection in runtime and the new tracked migration. Row insertion order does not establish which conflicting lab/role/project grant is legitimate. Report conflicts without changing them; block affected onboarding writes/migration safely until an authorized, audited resolution. Preserve unrelated reads and existing valid user access.
3. Provide a concrete controlled resolution path and preflight output for conflicts, with normalization of email, expiry handling, intended invitation identities and reviewed outcomes. Do not silently choose an identity or arbitrarily revoke a link. On deployments with no conflicts, the additive index migration should proceed cleanly.
4. Test the intermediate duplicate state, conflicting lab/role grants, invalid-token GET and foreign denied routes with zero data/audit side effects, valid no-conflict upgrade and concurrent duplicate prevention. Test actual migration/forward-repair failure behavior, not just a separate pair of failing inserts after migration.

## Finish the already-requested acceptance work

The ledger now honestly marks A06, A11, A20 and A40 partial. Do not stop at relabeling them: continue their required executable checks and fix any failures.

- Start with A20: real browser, actual IndexedDB, A's unsynced draft, logout, B login, reconnect; no A data visible/replayed as B, A's evidence retained and recoverable. Use the compiled client and fictional local API data; VM/mocked arrays are complementary, not this journey.
- A11: demonstrate usable planned handover and emergency suspension with unfinished work and unchanged historical authorship, through real UI and server behavior.
- A06: named per-role positive/negative journeys for the remaining roles; no manager stand-in. Record relevant list/detail/search/count/export coverage honestly.
- A40: exercise existing scoped deep links and mobile/offline draft continuity after refresh/client update with fictional data. Preserve Help, Reports, sample map and workbench connections.

A42 has improved backup/rerun coverage, but its `partialFailureRollbackPassed` currently comes from inserting the same `LabLifecycleState` row twice in a separate transaction after migrations. It does not yet prove rollback or forward repair after failure inside the actual migration sequence. Update evidence and test that real path.

The browser invitation test also hard-codes the `passed` argument to `true` for B_INV_06 and accepts either `Copy` or `Copied` text. Correct it to assert successful clipboard behavior/feedback and add the failure outcome if supported; do not report this as verified from an unconditional pass.

Continue autonomously within the original implementation scope, retain accepted fixes and reviewer artifacts, push intended changes to PR #94, and await independent review. No merge/deployment and no real staff/sample mutations.
