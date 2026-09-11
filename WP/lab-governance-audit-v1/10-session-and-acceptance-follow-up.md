# Remaining original acceptance requirements at 42c5976

Independent check: 2026-09-11 12:34 UTC. PR #94 remains open. Merge and deployment remain on hold. These findings are already required by IR-04, IR-09, IR-15 and IR-16 in `08-independent-review.md` and by A13-A15, A38-A42 in `05-acceptance-and-release.md`; they are not new feature scope.

## Verified progress

The previous F01-F07 defects and C01 companion control passed an independent local rerun on the working tree before this commit. The committed transaction correction now passes three additional tests using actual Prisma transactions, Express authentication and established loopback WebSockets: rollback preserves account/audit/socket state; an unsupported outer transaction fails before mutation; successful outer commit revokes exactly once after the transaction callback. Preserve these fixes and tests.

Reproduction: `node WP/lab-governance-audit-v1/session-and-coverage-probes.cjs`

Evidence: `independent-review/session-and-coverage-results.json`. The runner uses only the prior verified schema-only bootstrap from `final-review-probes.cjs`, creates fictional fixtures in a new disposable database, and opens the source database read-only. Source file SHA-256 stayed `388e85fbc6573509f0c56e0f1db6989fa682c2931af5a90b0b82eeb1a0e6a90b`. This proves that local source file remained unchanged; it does not prove the remote production database state. Exit zero means the runner completed; inspect every `passed` value.

## Remaining reproduced defects

| ID | Original requirement | Actual at 42c5976 | Required behavior |
|---|---|---|---|
| S01 | IR-09; A13 | A manager with `mustChangePassword=true` gets HTTP 403 on normal lab routes, but SIS returns 200 and a new socket receives CONNECTED. | Restrict the same principal consistently to the intended password-change/authentication flow; no SIS operational data or live lab subscription. |
| S02 | IR-09; A14 | After the impersonating administrator is suspended successfully, the support JWT is rejected by HTTP (401), but SIS returns 200 and a new socket receives CONNECTED. | Every user-JWT channel validates the current target and current acting administrator, including existence, active status, administrator authority, password-change restriction and current session version. |
| S03 | IR-09; A14-A15 | An already connected impersonation socket remains open and receives a lab broadcast after its administrator is suspended. | Invalidate subscriptions that depend on the revoked actor, including when that actor is not the socket's target user ID. Recheck on target and actor role/lab/version changes as appropriate. |
| P01 | IR-04; A38 | Workspace request with `page=1&limit=20` returns all 208 staff and no pagination metadata. Staff query has no take/skip; project query loads all projects and filters in memory. | Bounded, scoped database collection queries with stable paging/search and accurate totals; UI exposes navigation and preserves the latest search response. Do not merely slice the response after reading the whole database. |

Companion control C02 confirms that the same support session was valid before actor suspension (HTTP 200 and an established socket). T01-T03 all pass. The S02 failure is therefore not caused by minting an unusable support token.

## Corrective direction

1. Consolidate user-JWT principal validation used by HTTP, SIS and WebSockets while preserving explicit machine API-key scope rules. Keep intended password-change/auth endpoints usable. Support identity includes both target and actor. Deny missing/disabled/demoted/revoked actors; do not rely on stale claims. Track actor dependencies for existing sockets and perform revocation after committed access, suspension, password/recovery and related security changes. Cover fresh and existing sessions, two tabs, valid support sessions, ordinary scoped SIS access and password-change completion. Do not expose tokens in evidence.
2. Finish workspace paging through the actual route/service/UI contracts. Page staff and projects at the database query; scope project owner, junction and supported legacy relationships consistently. Keep aggregate counts independent of the returned page. Include 200-plus rows, allowed/denied labs, empty/error states, stable sorting and out-of-order search responses.
3. Repair the acceptance ledger rather than equating narrow probes with complete feature coverage. `07` still states that all IR and A01-A42 are verified. It calls a Vite build a browser journey, calls the local `dev.db` production, and references `verify_multilang_render.cjs`, which is not present anywhere found in the repository (including ignored files). Provide the actual script/output/screenshots and tested commit, or mark that evidence unverified. Accessibility attributes and locale key existence are useful implementation evidence, not executed keyboard/viewport/translation journeys.
4. Finish the original remaining acceptance work with exact named tests and output links, especially A06 all-role paths, A11 handover, A12 complete invitation/recovery, A20 actual shared-device switching, A38 paging, A39 responsive/theme/locale/focus interaction, A40 connected deep links, and A42 migration rerun/rollback-compatible recovery. Do not invent test execution or silently substitute a different scenario. Record limitations and distinguish tested, partially tested and untested. Reuse existing valid evidence; do not repeatedly run every suite while unchanged.

Continue under the existing implementation authorization. Commit intended repairs and honest evidence to the existing branch and push for fresh CI. Preserve the existing merge/deployment hold until independent review passes. No production staff/sample mutations for testing.
