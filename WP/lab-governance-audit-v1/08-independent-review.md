# Independent implementation review — release blocked

Reviewed 11 September 2026. Implementation: `58d39456c44a2c9c4e615097e4cdf340b6daaf94`; repeat probes at `bb989312b505492d169ae82ea1f153ef8c347957` (the later commit changes CI/test fixtures only). [PR #94](https://github.com/yigini/soilfer-lims/pull/94) remains open. Antigravity explicitly acknowledged the merge/deployment hold and reports no staging or production deployment.

**The implementation is substantial, but is not ready for release.** The completion report's “29/29 closed” and “42/42 satisfied” statements are contradicted by executable tests against the actual application. Preserve the useful fixes; repair the incomplete connections and safeguards before merge.

## Evidence and limits

- **22 reproduced failure cases and 5 successful controls** in [probe-results.json](independent-review/probe-results.json). These are related cases, not 22 independent root causes. The runner deliberately records whether the unwanted behavior was reproduced; `reproduced: true` on a `defect` means a problem exists, not that acceptance passed.
- Runner: [independent-review-probes.cjs](independent-review-probes.cjs). Real Express route mounts, real authentication, real Prisma validation and SQLite persistence; concurrency case invokes the same production service directly in parallel. No mocked authorization, persistence or transaction functions.
- A new disposable database receives all writes. Only SQL table/index definitions are read from local `server/prisma/dev.db`, opened read-only; **no existing users, samples or other data rows are copied**. Foreign keys are enabled. This checks actual installed SQL constraints and the current generated Prisma client; it is **not a migration-from-zero or restore rehearsal**. The source database file SHA-256 was unchanged across each completed run. This does not independently certify the remote production database.
- Actual compiled client plus actual local server, with the same fictional database: [UI evidence](independent-review/ui-results.json), [empty People tab screenshot](independent-review/actual-ui-empty-people.png), [invitation screenshot](independent-review/actual-ui-invite.png). The page shows no staff although the server counts three. No page JavaScript exceptions are needed for this failure. This browser review is desktop English only, not full localization/accessibility/mobile sign-off.
- First GitHub run [34584851428](https://github.com/yigini/soilfer-lims/actions/runs/34584851428) failed two translation tests (765/767 passed). Antigravity subsequently added language fixtures in `bb98931`; latest [34585181933](https://github.com/yigini/soilfer-lims/actions/runs/34585181933) is green. A green existing suite does not cover the defects below.
- No application code or production records were changed by this independent review. New review scripts, results, screenshots and this report are under this WP directory. Disposable DBs/logs are ignored locally; do not commit them.

## Useful implementation to retain

- Dedicated six-tab laboratory workspace and reusable staff/lifecycle dialogs have been added, with manager navigation to My Laboratory.
- Several legacy lab/staff write paths now enforce own-lab and subordinate-role constraints; global lab creation/lifecycle is restricted to super administrators. Generic automatically created staff/test projects were removed.
- Shared fixed passwords were replaced in the legacy reset path with random temporary passwords, and new hashed invitation/recovery grant records were added. The new journeys are incomplete, as described below.
- User list pagination is bounded and national user-list queries resolve labs first. Some project detail reads now recognize junction-only membership. Foreign-owned project deletion is denied and the duplicate project update response was removed.
- Several equipment/Kobo routes now enforce scope. SIS key creation requires an explicit lab scope. Core languages cannot be deleted, and global language writes are restricted.
- Local-day calculation now handles the tested 23-hour DST boundary correctly. A preflight audit script and governance contract tests exist.

The five independently passing controls confirm own-lab manager rejection for a foreign staff mutation, rejection of viewer COMPLETE_WORK, rejection of foreign project deletion, rejection of manager global-language creation, and the 23-hour DST interval. These are narrow confirmations, not blanket clearance of their whole feature areas.

## Required corrections

### IR-01 — Critical: national staff authority is still effectively unbounded

**R01/R02/R04.** A national lead limited to Guatemala changed a France technician's role over HTTP 200. The same lead expanded their own countries to Guatemala and France through `PATCH /api/users/:id/access`. A super administrator could also persist a made-up role and nonexistent lab through the new endpoint.

Sources: [actionPolicyService.js:36](../../server/services/actionPolicyService.js#L36), [actionPolicyService.js:72](../../server/services/actionPolicyService.js#L72), [staffLifecycleService.js:229](../../server/services/staffLifecycleService.js#L229), [userController.js:448](../../server/controllers/userController.js#L448).

The national branch checks target role but not target country/lab; the self branch allows project/country changes; apply does not validate the role catalogue, real lab, lifecycle, project grants or JSON schema. Resolve the current target and proposed target under action-specific policy. Only permitted self-profile fields belong on the self route. Block self-granting scope. Validate both old and proposed scopes, role and field types. Use the same rules for invitation, legacy user edits, recovery, suspension and reactivation. Denied writes must leave user, audit, receipts and events unchanged.

The successful access response also serializes the full updated user, including its `password` hash (R01 records only the presence of that field, never the value). Use explicit safe user DTOs for access, suspension and reactivation responses; never serialize authentication secrets/hashes.

### IR-02 — Critical: last-administrator and audit atomicity claims are false

**R18.** Two parallel mutual suspension calls left **zero active administrators**. One returned successfully; the other failed with an audit unique-key collision **after disabling the second administrator**. This reproduces both lockout and a partial write masked by an error.

Sources: [staffLifecycleService.js:301](../../server/services/staffLifecycleService.js#L301), [staffLifecycleService.js:229](../../server/services/staffLifecycleService.js#L229), [labRoutes.js:228](../../server/routes/labRoutes.js#L228).

Parameter name `tx` does not create a transaction: controllers pass the global Prisma client and the new service performs count/update/audit as independent statements. The legacy toggle's count is also outside its update transaction. Put last-effective-admin check and mutation in the same correctly serialized transaction, protect concurrent writes, use collision-safe audit/command IDs, and include audit persistence in atomicity. Cover demotion, suspension, deletion, reactivation and every alternate route. Keep at least one usable administrator and prove stale/concurrent rejection. Add deliberate audit-failure rollback tests.

### IR-03 — High: access/lifecycle review tokens are decorative

**R03/R16.** Missing or invalid review tokens are accepted. Changing a technician to Viewer succeeds even with unfinished assignments. The modal reads `impact.openWorkItems` or `current.openWorkCount`, while the service returns `openAssignmentsCount`; the warning therefore defaults to zero.

Sources: [staffLifecycleService.js:209](../../server/services/staffLifecycleService.js#L209), [staffLifecycleService.js:229](../../server/services/staffLifecycleService.js#L229), [labLifecycleService.js:375](../../server/services/labLifecycleService.js#L375), [AccessReviewModal.jsx:103](../../client/src/components/staff/AccessReviewModal.jsx#L103).

Validate signature, actor, resource, exact proposed changes, expiry and current revisions at commit time. Recompute work impact under current policy. Planned transfers/role removal need a real handover choice and persisted resolution; emergency suspension must remain immediate with explicit stranded-work recovery. Count returned/submitted/drafted work as appropriate, not only ASSIGNED/IN_PROGRESS. Use one DTO and test UI state against real responses; show stale-revision recovery only when it truly exists.

### IR-04 — High: new workspace shows false empty staff/projects and zero workload

**R05 + actual browser screenshot.** `getLabWorkspace` returns `counts` and does not return `staff` or `projects`. The page consumes `workspace.workload`, `workspace.staff` and `workspace.projects`. Three staff in the test database become an empty People tab, leaving its management controls inaccessible. Workload values default to zero; project rows are absent.

Sources: [labLifecycleService.js:152](../../server/services/labLifecycleService.js#L152), [LabManagement.jsx:247](../../client/src/pages/admin/LabManagement.jsx#L247), [LabManagement.jsx:580](../../client/src/pages/admin/LabManagement.jsx#L580), [LabManagement.jsx:1030](../../client/src/pages/admin/LabManagement.jsx#L1030).

Agree a versioned workspace contract or fetch bounded staff/projects separately. Return honest loading/error/empty states. Wire counts, filters and deep links to actual server-authorized rows; do not fabricate zeros. Reuse canonical sample/work eligibility for counts: the new service still counts all non-archived/non-disposed samples as active, including expected/released records. Test mixed real workflow states and 200+ records, not only an empty lab.

### IR-05 — High: role dropdown values disagree with the API

**R06 + actual browser DOM.** API entries have `key`; both modals use `r.role`. The browser's actual option value becomes `Laboratory Technician`, not `LAB_TECHNICIAN`; invitation initialization can set the role to undefined. Selection can therefore omit the required role or send a display label as a persisted role, especially dangerous with IR-01.

Sources: [actionPolicyService.js:125](../../server/services/actionPolicyService.js#L125), [InviteStaffModal.jsx:40](../../client/src/components/staff/InviteStaffModal.jsx#L40), [InviteStaffModal.jsx:232](../../client/src/components/staff/InviteStaffModal.jsx#L232), [AccessReviewModal.jsx:159](../../client/src/components/staff/AccessReviewModal.jsx#L159).

Use stable server role keys for values and translated names for labels. Reject display names server-side. Do not silently replace a failed role catalogue with an independently invented list. Test all ten roles and global/no-lab versus lab-bound onboarding; the global Users invitation currently lacks a populated lab picker but the service requires a lab.

### IR-06 — High: invitation and recovery journeys cannot be completed

**R07/R08.** Server returns `activationLink` and `recoveryLink`; UI reads `activationUrl`/`recoveryUrl` or `token`, producing `token=undefined`. More seriously, no activation/recovery token-consumption handlers or pages exist in the current route inventories. `isConsumed` fields are created but no consumer uses them. Single-use and expiry are therefore not implemented journeys.

Sources: [staffLifecycleService.js:162](../../server/services/staffLifecycleService.js#L162), [staffLifecycleService.js:488](../../server/services/staffLifecycleService.js#L488), [InviteStaffModal.jsx:91](../../client/src/components/staff/InviteStaffModal.jsx#L91), [RecoveryLinkModal.jsx:38](../../client/src/components/staff/RecoveryLinkModal.jsx#L38), [authRoutes.js](../../server/routes/authRoutes.js), [App.jsx](../../client/src/App.jsx).

Implement the complete invitation and password-recovery UI/API, hashed single-use consumption, expiry/revocation/resend, pending roster, delivery failure, duplicate identity handling and current authorization at redemption. Do not put a new person into ACTIVE prematurely. Return one well-defined URL field. Preserve emergency access while replacing the old path: legacy `/:id/staff/:userId/reset-password` still returns a random plaintext temporary password despite the report claiming all such displays removed. Test real sign-in after redemption and replay rejection. Never print tokens in review evidence.

### IR-07 — Critical: offline sync still bypasses the workbench's scientific and access rules

**R09/R10/R11/R12.** A read-only viewer saved another technician's draft. A viewer with no lab saved a foreign lab's draft. A MIR task accepted scalar `1.2` and became COMPLETED while preparation was PENDING. Authorized offline intake fails Prisma validation because it writes nonexistent `Sample.notes`.

Sources: [syncService.js:82](../../server/services/syncService.js#L82), [syncService.js:140](../../server/services/syncService.js#L140), [syncService.js:246](../../server/services/syncService.js#L246), [syncRoutes.js](../../server/routes/syncRoutes.js).

The report says canonical eligibility/result-entry services are used; COMPLETE_WORK still parses a scalar and writes WorkAttempt/WorkItem directly. Route authentication alone is insufficient. Delegate to the actual online domain commands for actor/assignment/lab/prerequisite/method/texture/spectra/equipment/review/amendment rules. Require exact base version including zero; use current persisted state within the atomic write. Do not confuse Sample.labId accession labels with receiving-lab identity. RECORD_INTAKE needs both valid schema and canonical intake authorization/requirements; do not merely delete the invalid field and expose an unauthorized write.

SAVE_WORK_DRAFT has no persisted command receipt, and common success returns a generated `rcpt_...` instead of the stored receipt ID. Fix exact idempotency, payload identity, causality and response receipts. Assert no success receipt or partial data on denial. Preserve recoverable evidence for rejected offline operations.

### IR-08 — High: shared-device offline identity and expiry remain unfinished

Source review (not a separate browser account-switch reproduction in this pass): offline client files are unchanged. Sync still reads the whole pending outbox and uses the current login token. Logout clears Help cache only. Server pack lookup checks owner but not actual expiry/current authorization version; a missing current lab is treated as a match.

Sources: [syncEngine.js:114](../../client/src/services/offline/syncEngine.js#L114), [AuthContext.jsx:116](../../client/src/context/AuthContext.jsx#L116), [offlineController.js:21](../../server/controllers/offlineController.js#L21), [workPackService.js](../../server/services/workPackService.js).

Finish A16–A21 with account/lab/device partitioning, pack/lease enforcement, rights revalidation and nondestructive draft recovery. Explicitly test A offline → logout → B login → reconnect, stale role/lab, expired lease and revoked methods. Never auto-replay A's evidence as B or erase drafts to solve isolation.

### IR-09 — High: session revocation still differs between channels

**R22.** A revoked JWT is rejected with HTTP 401 but opens a WebSocket and receives CONNECTED. `wsServer.js` is unchanged and does not load/check tokenVersion; established connections retain cached role/lab. The SIS middleware skips its new version check if the claim is absent and still omits the password-change restriction.

Sources: [wsServer.js:44](../../server/wsServer.js#L44), [apiKeyAuth.js:81](../../server/middleware/apiKeyAuth.js#L81), [authMiddleware.js:65](../../server/middleware/authMiddleware.js#L65).

Use consistent current principal/session checks for HTTP, SIS and sockets; close affected active subscriptions on suspension/role/lab change. Revalidate impersonating actor existence, authorization and current version rather than allowing a missing actor record. Test existing connections as well as a new handshake; pending password-change sessions must be restricted consistently.

### IR-10 — High: laboratory lifecycle creates lockouts and contradictory state

**R15/R16/R17.** Newly created unconfigured labs start ACTIVE, not SETUP. Pausing sets `Lab.isActive=false`; verifyToken then returns 401 for **all** ordinary staff requests including `/auth/me`, preventing read/history/recovery access. Legacy toggle can set the flag true while the lifecycle record stays PAUSED. The UI can show Operational for that contradiction.

Sources: [labRoutes.js:328](../../server/routes/labRoutes.js#L328), [labRoutes.js:163](../../server/routes/labRoutes.js#L163), [authMiddleware.js:40](../../server/middleware/authMiddleware.js#L40), [labLifecycleService.js:375](../../server/services/labLifecycleService.js#L375).

One lifecycle service and explicit valid transitions must govern creation, pause/resume/retirement and every legacy path. Persist state/revision/audit atomically. Distinguish authenticated read access from ability to start new lab work. Keep staff-specific suspension separate; do not reactivate previously disabled people. Validate lab activation readiness without silently disabling legacy labs with missing optional settings. Retiring must account for samples and all unfinished work, not only two task statuses. Validate reviewed revisions and in-flight commands.

### IR-11 — High: project owner/servicing policy is only partially wired

**R13/R19.** Manager A, a servicing lab for a project owned by B, can still modify the global project name over HTTP 200. The new national project list fails HTTP 500 because it queries `Project.country`, which does not exist (`countries` is JSON text).

Sources: [projectController.js:32](../../server/controllers/projectController.js#L32), [projectController.js:348](../../server/controllers/projectController.js#L348), [projectMembershipService.js:202](../../server/services/projectMembershipService.js#L202), [projectMembershipService.js:278](../../server/services/projectMembershipService.js#L278).

Deletion is improved, but update/archive/restore/manifest/Kobo configuration must use action-specific ownership/delegation, not generic read access. The new lab-access read endpoint has no target read-scope check inside its service. Membership update is not atomic across removal/addition/legacy synchronization/audit and does not review historical access/open samples. The resolver introduces country-based membership fallback instead of fully reconciling the four original sources, and inserts a new SERVICING role without demonstrating compatibility with PRIMARY/BACKUP/OVERFLOW consumers. Do not union conflicting legacy relationships or grant countries implicitly. Preserve explicit project-manager access and sample/report provenance.

### IR-12 — High: lab directory still exposes foreign management information

**R14.** A Guatemala-only national lead received France lab notes from `/api/labs`. That route still loads all labs, samples/user counts and project details and treats every national lead as globally privileged. A lightweight `/directory` was added, but the new workspace itself still fetches the heavy old endpoint. The report's claimed `/management` split is not present.

Sources: [labRoutes.js:11](../../server/routes/labRoutes.js#L11), [labRoutes.js:87](../../server/routes/labRoutes.js#L87), [LabManagement.jsx:94](../../client/src/pages/admin/LabManagement.jsx#L94).

Define minimal picker data separately from scoped management summaries. Apply current authorization before counts/project details/notes are queried and serialized, including national and no-lab cases. Preserve legitimate reception/project pickers while migrating all consumers.

### IR-13 — High: inventory cross-lab location transfer is still allowed

**R20.** Manager A transferred its lot to a cabinet belonging to lab B. The source lot's lab is checked; destination existence is checked but its laboratory is not. The controller is unchanged from baseline despite the completion report explicitly claiming this fixed.

Source: [inventoryController.js:599](../../server/controllers/inventoryController.js#L599).

Validate source/destination/item/work relationships under one resource scope, both on creation and movement. Check active location/lab as appropriate, keep quantity/history/audit atomic, and prove foreign location transfer produces no ledger change. Add a valid same-lab companion test. Revisit remaining no-lab list filters and equipment-location links too.

### IR-14 — High: SIS key creation form cannot satisfy the new API

**R21.** The current UI payload is rejected HTTP 400 `INVALID_LAB_SCOPE`: the backend now requires `labs`, but ApiKeyManager still sends only name, role, countries and expiry. Backend rejection is correct; the UI is not updated.

Sources: [ApiKeyManager.jsx:118](../../client/src/components/admin/ApiKeyManager.jsx#L118), [sisController.js:858](../../server/controllers/sisController.js#L858).

Add the authorized lab selector, validation, scope/expiry summary and a real create → consume permitted released data → revoke journey. Keep empty lab scope denied. Do not “fix” the UI by defaulting all keys to wildcard. Finish correct lab+project Kobo selection: project reads still take `configs[0]`, and project update still selects config by project alone. Verify all integration paths, not only standalone Kobo handlers.

### IR-15 — Medium/High: assignment, refresh and language work is overstated

Source review: eligibility service was added but `validateAssignmentTarget` is not called by existing assignment/reassignment handlers; its picker returns managers while write handlers accept only technicians. Method qualification is not evaluated despite the report claiming it. Work update events still broadcast to `user.labId`, so a global administrator's changes can miss the receiving lab (original LG-26).

Sources: [assignmentEligibilityService.js](../../server/services/assignmentEligibilityService.js), [workItemController.js:713](../../server/controllers/workItemController.js#L713), [workItemController.js:864](../../server/controllers/workItemController.js#L864).

Unify picker and command policy, check receiving lab/current actor grant/assignee/method, and send scoped events for the affected resource. Test a no-home-lab administrator and unrelated lab observer.

Only two new translation keys were added per language. Most new workspace/modal text is hardcoded English; importing `useLanguage` does not translate content. Complete all five locales, role display names, server messages and Help contexts with real supported locale files. Verify long labels, 320/390/768/1440 widths, focus trap/return, Escape, keyboard control and both themes. No build can certify accessibility or localization by itself.

### IR-16 — High: migration and acceptance evidence need to be completed honestly

The new invitation/recovery/lifecycle tables are created with request-time raw DDL, not tracked schema migrations. There is no corresponding Prisma schema/migration change in this PR. Singleton initialization flags can outlive a rolled-back table creation. The preflight uses the normal writable Prisma bootstrap, which sets WAL/synchronous pragmas; do not call that a physically read-only database connection without qualification. It does not itself prove before/after sample/attempt/report/spectra invariants or recovery/rollback.

The acceptance report claims WebSocket revocation, atomic last-admin concurrency, canonical offline services, wired workspace, inventory isolation, all locales and migration sign-off that the checks above refute. Existing WP-C tests even assert successful access changes **without a review token**. They need stronger behavioral requirements rather than more “all green” summaries.

Add tracked additive migrations and a guarded preflight path; rehearse forward/rollback compatibility on a disposable restored snapshot. Keep original audit evidence immutable. Replace the 29/29 and 42/42 claims with per-scenario test names, expected/actual outcome, build/database/role context and output links. Mark untested as untested. A small UI probe with real responses would have caught IR-04–IR-06 immediately.

## Original finding coverage disposition

This is a correction-oriented review, not a second claim of exhaustive release certification.

| Original finding | Review disposition |
|---|---|
| LG-01 | Legacy routes improved; new national staff bypass remains (IR-01). |
| LG-02 | Partial allowlists; legacy/profile routes diverge and validation differs. |
| LG-03 | Fixed shared password removed; complete recovery flow missing (IR-06). |
| LG-04 | Generic accounts/test project removed; SETUP onboarding missing (IR-10). |
| LG-05 | User cascade removed; authentication now locks paused staff out (IR-10). |
| LG-06 | Open: concurrent lockout reproduced (IR-02). |
| LG-07 | Open: new access route persists invalid role/lab (IR-01). |
| LG-08 | User listing improved; new national mutation/project-query failures (IR-01/11). |
| LG-09 | Open: real role DTO/dropdown mismatch (IR-05). |
| LG-10 | Partial: resolver and readers/writers not consistently reconciled (IR-11). |
| LG-11 | Foreign deletion denied; foreign metadata update still succeeds (IR-11). |
| LG-12 | Generic country grants narrowed; alternate new scope bypasses remain. |
| LG-13 | Raw token project read improved; exact config selection/writes need completion. |
| LG-14 | Open: offline draft/scientific bypass and broken intake reproduced (IR-07). |
| LG-15 | Pack ownership improved; expiry and shared-device partitioning incomplete (IR-08). |
| LG-16 | Open: stale WebSocket credential accepted (IR-09). |
| LG-17 | Inactive assignee checks added; canonical picker/command/method wiring incomplete. |
| LG-18 | Several equipment paths improved; complete parent/related resource matrix not revalidated here. |
| LG-19 | Open: foreign inventory destination persisted (IR-13). |
| LG-20 | Manager global locale creation denied; core-locale guards added. |
| LG-21 | Open: partial writes/audit failure and sensitive user DTO (IR-02). |
| LG-22 | Open: foreign management data still returned (IR-12). |
| LG-23 | Open: new workspace empty with real staff; dialogs/UX incomplete. |
| LG-24 | Open: workload contract mismatch and noncanonical counts (IR-04). |
| LG-25 | No accession rewrite observed; tracked migration/reconciliation not completed. |
| LG-26 | Open: broadcasts still use actor lab (IR-15). |
| LG-27 | Duplicate response removed; complete transaction/retry guarantee not established. |
| LG-28 | Explicit SIS lab scope added; UI creation and auth parity unfinished (IR-09/14). |
| LG-29 | Selected-lab guard improved; spring DST control passes. Full national positive/negative journeys still required. |

## Correction and re-review order

1. Keep PR open and production unchanged while fixing blockers. Preserve `bb98931` and all unrelated work; no blanket revert or source reset.
2. Fix principal/scope policy, sensitive DTOs, review validation, atomic last-admin/audit behavior, offline domain delegation and channel revocation first. Add negative and valid companion integration tests in an explicitly disposable DB.
3. Finish migrations/lifecycle, project/inventory/integration wiring and preserve existing approved evidence. Reconcile decisions from the original preflight rather than auto-granting or relabeling records.
4. Connect the actual UI to real DTOs, finish invitations/recovery and correct counts, roles, locales and Help. Verify actual new-user login and account-recovery journeys, then a realistic lab manager/technician workflow.
5. Re-run these independent reproducers. A corrected defect should cease reproducing; convert each into a regression assertion for the intended outcome. The probe runner exits on execution errors, not on product defect count; do not use exit code zero as acceptance.
6. Complete all original A01–A42 with named evidence, full CI, fresh/upgrade migration tests and browser evidence. Re-review the exact resulting commit before lifting the release hold. Earlier deployment authorization remains; the required safety criteria have not yet been met.

Do not close the original findings or mark production verified until those actual gates pass. Use short, friendly progress updates: what now works, what is still being repaired, and what the next test will demonstrate.
