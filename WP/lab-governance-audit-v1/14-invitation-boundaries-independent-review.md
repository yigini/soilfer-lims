# Independent review 14: reissue scope, expiry and acceptance claims

Commit `cbbf07538ced05c4ff2fe2c2beeafad5448cb0dc`, 11 September 2026. PR #94 open; CI run 34610886006 passed. Merge/deployment remains on hold.

## Accepted repairs

I independently reran Report 13's original runner at `2026-09-11T14:41:10.806Z`: I00–I04 all pass. Duplicate create returns 409 with one invitation, audit failure rolls back, intended project grant survives activation, and the original foreign list/revoke service calls are denied. Preserve these repairs.

## New connected-boundary reproduction

Runner: `C:/Users/yigin/AppData/Local/Temp/codex-lab-ui-review/invitation-boundaries-review.cjs`.

Results: `C:/Users/yigin/AppData/Local/Temp/codex-lab-ui-review/invitation-boundaries-results.json`, `2026-09-11T14:42:32.335Z`. Real Express API, fictional fixtures, schema-only disposable DB. Local baseline SHA-256 remains `388e85fbc6573509f0c56e0f1db6989fa682c2931af5a90b0b82eeb1a0e6a90b`. No real records copied or modified, no raw tokens printed.

| ID | Actual behavior | Required correction |
|---|---|---|
| J01 | Invite expiry is set to today's UTC midnight. Token verification correctly returns 410, but roster lists it active (`isExpired:false`) and new invitation returns 409. | Stop lexical comparison between ISO `T...Z` values and SQLite `CURRENT_TIMESTAMP` strings. Use one correctly normalized time comparison and consistent expiry boundary across create/list/verify/reissue. Show expired invitations as expired with a controlled reissue path. |
| J02 — High | Manager B creates an invitation for B. Manager A POSTs the same email for A with `reissue:true`; returns 201 and revokes B's invitation. This is a reachable API mutation. | Remove the alternative reissue shortcut or route it through the same target-authority checks as ID-based reissue. Authorize the EXISTING invitation's lab, hierarchy and grants before touching it, as well as any proposed destination. Test both `/api/staff` and `/api/users` aliases, boolean-string tampering, foreign and privileged same-lab targets, and no audit/data side effects on denial. |
| J03 | National GTM lead creates an own-country technician invitation (201), but ID-based reissue returns 403 `TARGET_OUTSIDE_SCOPE`. | Revoke/reissue pass `requestedChanges.labId` to `canManageUser` without the proposed country, so unchanged scope is interpreted as an unresolved transfer. Supply the correctly resolved unchanged/current scope or omit changes that are not actually proposed. Keep foreign country rejection intact. |
| J04 — High | Manager A can invite a technician with project B's grant when B is the sole owning lab and the only shared value is `countries:['Guatemala']`; returns 201. | Invitation authorization calls `resolveProjectLabs().isMember()`, which includes the legacy country fallback. Country coincidence is not a lab/project delegation. Use exact explicit membership and grant authority for this command. Preserve legitimate owner, junction, authorized exact legacy membership and explicit project-lead workflows without broad country grants. |
| J05 — High | Manager A prepares an invitation while A owns a project. Ownership then moves to B, with no A service link. Activation returns 201 and grants the now-foreign project to the new A user. | Activation currently checks only that project codes still exist. Revalidate current authority, recipient scope, role, lab and project relationship before committing activation. Apply the same validation on reissue; do not silently discard or revive changed grants. Require a fresh reviewed invitation for an invalidated grant and retain honest recoverable state. |

## Rollout and UI findings from source review

- New active-email unique index exists only in `ensureTables`, not the tracked migration. Existing duplicate pending rows from the prior implementation cause index creation to fail; the catch logs and proceeds. Add a reviewed migration/preflight for normalization and duplicates with explicit conflict handling, preserve evidence and avoid silent arbitrary revocation. Verify upgrades from the original schema and the intermediate duplicate state, not just a newly empty database.
- Pending invitations are fetched unbounded, shown only while unconsumed/unrevoked, with expiry hard-coded false. New roster/actions/link overlay add English literals despite the five-language requirement. Connect scoped pagination, state/error handling and translation keys; avoid turning every workspace request into an unbounded invitation fetch.
- The new pending-invitation controls still need an actual browser journey, including reissue link capture and successful activation, revoked-link rejection, and the national-manager positive path. Do not equate rendering the previous invitation modal with exercising these new controls.

## Acceptance ledger must describe executed checks

The A01–A42 table is present, but several `passed` rows still exceed their cited evidence. Correct their disposition now, then execute missing required checks. Examples:

- A20 again claims the whole shared-device journey passed based on the VM/mocked-storage module suite. The actual browser IndexedDB/logout/login/reconnect case requested in Report 13 has not been provided.
- A42 again claims rerun, partial failure and restore passed using the unchanged one-time rehearsal. That script still copies only the main DB file with `copyFileSync`; it does not establish a WAL-consistent backup/restore, rerun or injected partial failure.
- A37 cites WP-D tests 15–16 for DST. Their actual titles cover stale lifecycle revision and injected audit failure. A41 cites WP-D test 17, whose title is `Project owner manager reads project lab access`; that is not the update/retry scenario. Replace positional test numbers with actual named tests and artifacts.
- A11 describes counting unfinished work but does not establish the requested usable handover journey. A40's successful build and server regression tests do not establish all real deep links and old/offline client behavior.
- A06 claims four browser role walkthroughs but gives no per-role route/action artifacts. Identify them precisely or mark that browser coverage unverified.

Keep successful evidence. Do not change original acceptance requirements or invent coverage. Complete outstanding authorized work and report actual remaining limitations plainly. Push intended fixes/tests/migrations/docs to PR #94 and wait for independent verification; no merge or deployment.
