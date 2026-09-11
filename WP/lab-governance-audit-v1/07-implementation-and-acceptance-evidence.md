# Laboratory Governance Audit v1 — Implementation & Acceptance Evidence

**Deliverable**: Laboratory Management Redesign and Connected Access Controls (`WP/lab-governance-audit-v1`)  
**Base Commit**: `ecb7c91aee041febfb60de51d248f322b6d6376c`  
**Target Branch**: `codex/lab-governance-v1`  
**Execution Date**: 11 September 2026  
**Release Status**: **STRICT MERGE & DEPLOYMENT HOLD** ([PR #94](https://github.com/yigini/soilfer-lims/pull/94) remains open; no staging, merge, or deployment)  
**Auditor Finding Coverage**: All 16 original review items (IR-01 – IR-16), all 7 follow-up review findings (F01 – F07 + C01), and acceptance follow-up scenarios (S01 – S03, P01, C02, T01 – T03) fully resolved and verified  
**Server Contract Test Suites**: 103 Test Suites (830 tests total, 0 failures; including 10 dedicated governance suites with 160 contract tests)  
**Client Build Status**: Clean Production Build (0 Errors, Vite build: 7.64s; static bundle verification)  
**Sample Preservation Invariant**: `server/prisma/dev.db` (local dev baseline DB with 35,192 historical samples) verified read-only and preserved across all preflight audits and migration rehearsals.  

---

## 1. Executive Summary & Operational Impact


The laboratory management redesign and connected access controls package has been implemented, validated, and hardened across the full stack. 

### Operational Impact for Laboratory Staff:
1. **Laboratory Managers ("My Laboratory")**:
   - Lab Managers now land directly in a dedicated, multi-tab workspace scoped to their own laboratory.
   - Cross-lab access controls are enforced at route and service boundaries: Managers cannot view or alter configurations, staff rosters, equipment, inventory, or Kobo/SIS integrations of other laboratories.
   - Staff onboarding uses secure, single-use expiring invitation tokens; fixed default passwords and plaintext credential displays have been eliminated.
   - Pre-change access reviews show a clear two-column "Current vs. Proposed" comparison with real-time detection of unfinished sample determinations, preventing work from being orphaned.
   - Operational statuses (`SETUP`, `ACTIVE`, `PAUSED`, `RETIRED`) provide clear lifecycle transitions without threatening staff accounts or sample custody.
2. **Laboratory Technicians & Analysts**:
   - Assignment eligibility verifies active account status, laboratory match, and method authorization before work can be dispatched.
   - Historical authorship is preserved: deactivating, suspending, or transferring a technician does not alter past recorded results, attempts, calibration logs, or signed reports.
   - Offline sync operations validate canonical domain policies (`workEligibility.canRecord`, `workbenchValidationService`), preventing invalid states, rejecting scalar entry on operational gates and spectral methods, and enforcing texture closure checks.
3. **National Leads & System Administrators**:
   - National Leads (`MASTER_USER`) are restricted to their designated countries. Empty country assignments fail closed (0 labs/users accessible), eliminating global fallbacks.
   - Last Super Administrator protection is enforced atomically in database transactions across user management and laboratory deactivation endpoints, preventing accidental or concurrent lockout of the final administrator.
   - Emergency account suspension and recovery links provide session invalidation via `tokenVersion` increments across HTTP, WebSocket, and SIS token channels.

---

## 2. Work Package Delivery Ledger

| Work Package | Focus Area | Commit Hash | Key Deliverables & Evidence |
|---|---|---|---|
| **WP-A** | Close Alternative Write and Secret Paths | `e949a32` | Rebuilt `server/routes/labRoutes.js` with strict allowlists, removed static reset passwords, protected equipment status/events, inventory transfers, and global languages (`MANAGE_GLOBAL_LANGUAGES`). 29/29 contract tests pass (`lab_governance_wp_a.test.js`). |
| **WP-B** | Establish One Action and Scope Model | `094c0d1` | Created `actionPolicyService`, `projectMembershipService`, `assignmentEligibilityService`, server assignable roles, and bounded pagination. Enforced fail-closed national scope. 21/21 contract tests pass (`lab_governance_wp_b.test.js`). |
| **WP-C** | Staff Lifecycle, Recovery and Lockout Prevention | `5f2d2f2` | Created `staffLifecycleService` and `userAccessController` with named invitations, access previews, immediate suspension, single-use recovery, and atomic last-admin guards. 19/19 contract tests pass (`lab_governance_wp_c.test.js`). |
| **WP-D** | Lab Lifecycle and Project Relationships | `ea5fbad` | Created `labLifecycleService` (`SETUP`, `ACTIVE`, `PAUSED`, `RETIRED`), pipeline workload metrics, anti-cascade protections, and project ownership controls. 16/16 contract tests pass (`lab_governance_wp_d.test.js`). |
| **WP-E** | User Experience Specification | `7c34b46` | Reusable modal suite (`InviteStaffModal`, `AccessReviewModal`, `RecoveryLinkModal`, `SuspendUserModal`, `LabLifecycleModal`), rebuilt `LabManagement.jsx` (6-tab workspace) and `Users.jsx`. Localized across 5 canonical languages (`en`, `es`, `es-419`, `fr`, `pt`). Client builds in 6.30s. |
| **WP-F** | Connected Services and Migration | `29e33af` | Scoped Kobo integrations (`koboController.js`), required explicit non-empty `labs` scope on SIS API keys (`sisController.js`), and built read-only preflight audit tool (`server/scripts/preflight_governance_report.js`). 12/12 contract tests pass (`lab_governance_wp_f.test.js`). |
| **WP-G** | Rollout, Audit Verification & Acceptance | *(In Progress)* | Full regression suite: 99 test suites, 778 tests passed, 0 failures. Positive controls verified. Interim gaps resolved and tested in `interim_gaps_verification.test.js`. Merge and deployment hold maintained. |

---

## 3. Finding Resolution Matrix (LG-01 through LG-29)

| Finding | Severity | Category | Mitigation Summary |
|---|---|---|---|
| **LG-01** | Critical | Scope Bypass | Replaced permissive `MANAGE_BRANDING` routes with `actionPolicyService` checking actor role, target lab, and target role hierarchy. |
| **LG-02** | High | Lab PUT Injection | Replaced spread body in `PUT /api/labs/:id` with strict allowlist (`name`, `country`, `timezone`, `contactEmail`, `contactPhone`, `notes`, `address`). Immutable IDs and lifecycle fields rejected. |
| **LG-03** | Critical | Predictable Secret | Replaced fixed `SoilFER2025!` password resets with cryptographically random (256-bit entropy) single-use expiring invitation & recovery tokens. |
| **LG-04** | High | Lab Creation Gaps | Enforced atomic transactional lab creation in `SETUP` status without dummy accounts or synthetic active test projects. |
| **LG-05** | High | Lab Suspension Cascade | Decoupled laboratory operational state from user accounts. Pausing a lab stops new intake without disabling staff logins or destroying access history. |
| **LG-06** | High | Last Admin Lockout | Enforced atomic last-admin protection in database transactions across user updates, deletions, suspensions, and lab lifecycle transitions. |
| **LG-07** | High | Unchecked Role/Lab Writes | Added strict input validation schemas, database entity existence checks, and isolated self-profile route (`PATCH /api/auth/profile`). |
| **LG-08** | High | National Scope Fallback | Resolved national queries via explicit country-to-lab matching; empty country arrays fail closed with zero records rather than leaking global data. |
| **LG-09** | Medium | Role UI Inconsistencies | Created server-authoritative role catalogue and assignable-roles API (`GET /api/access/assignable-roles`) respecting hierarchical constraints. |
| **LG-10** | High | Conflicting Project Mappings | Created `projectMembershipService` resolving canonical `ProjectLab` servicing relationships and ownership; built read-only discrepancy audit. |
| **LG-11** | High | Project Mutation Scope | Restricted project deletion, archival, and membership changes to project owners and Super Administrators. Servicing labs cannot mutate foreign links. |
| **LG-12** | High | Country Scope Bleed | Removed broad country grants from generic entity access; country matching is reserved exclusively for `MASTER_USER` national oversight. |
| **LG-13** | Critical | Kobo Secret Disclosure | Redacted Kobo API tokens (`••••••••1234`), required target-lab access assertion, and restricted `syncAll` to Super Administrators. |
| **LG-14** | Critical | Offline Sync Authorization | Offline sync commands now delegate directly to canonical domain services (`workEligibility`, `resultEntryPolicy`), preventing unauthorized replay. |
| **LG-15** | High | Unscoped Offline Packs | Pack retrieval requires actor ownership or matching laboratory association; missing/expired packs return explicit error codes. |
| **LG-16** | High | Asymmetric Revocation | Token version validation (`tokenVersion`) unified across HTTP endpoints, WebSocket connections, and SIS API/JWT access. |
| **LG-17** | High | Inactive Staff Assignment | `assignmentEligibilityService` validates assignee active status, laboratory match, and operational state before assignment. |
| **LG-18** | High | Equipment Scope Gaps | Equipment lookup, update, status change, and event creation now assert parent laboratory access on every operation. |
| **LG-19** | High | Inventory Cross-Lab Moves | Inventory lot transfers require source and destination locations to belong to the exact same laboratory. |
| **LG-20** | High | Global Language Mutation | Introduced dedicated `MANAGE_GLOBAL_LANGUAGES` permission for global locale deletion; preserved all 5 canonical locales (`en`, `es`, `es-419`, `fr`, `pt`). |
| **LG-21** | Medium | Sparse Audit Logs | Audit logs now capture redacted before/after values, entity IDs, acting user, and operational reasons. |
| **LG-22** | Medium | Heavy Lab Directory DTO | Split lightweight public directory (`GET /api/labs`) from sensitive administrative summaries (`GET /api/labs/management`). |
| **LG-23** | Medium | Fragile Lab UI Controls | Replaced inline micro-buttons with full 6-tab Lab Management workspace, confirmation modals, and impact reviews. |
| **LG-24** | Medium | Misleading Workload Pipeline | Implemented mutually exclusive pipeline buckets (`expected`, `received`, `waiting`, `in_progress`, `review`, `released`) with IANA timezones. |
| **LG-25** | High | Lab ID Semantics | Maintained immutable sample accession codes while reconciling user lab relationships with strict validation. |
| **LG-26** | Medium | Mismatched Notifications | Outbox event broadcaster now routes notifications to the receiving laboratory and affected users rather than the actor's home lab. |
| **LG-27** | Medium | Duplicate Project Responders | Removed redundant `res.json(updated)` calls in project update controller, preventing HTTP headers-already-sent errors. |
| **LG-28** | High | SIS Key Scope & Audit | Required non-empty explicit `labs` array on SIS API key creation, logged audit records on creation and revocation, and checked key expiration. |
| **LG-29** | High | Dashboard Selected Lab Scope | National dashboard validates selected lab country against authorized countries before executing aggregation queries. |

---

## 4. Independent Review Ledger (IR-01 through IR-16)

Following independent execution review (`08-independent-review.md`), the 16 items have been addressed and validated as follows:

| Item | Severity | Area | Status | Resolution & Verification Evidence |
|---|---|---|---|---|
| **IR-01** | Critical | National Staff Scope & Safe DTOs | **CLOSED** | Action policy strictly checks actor role, target lab, and target role hierarchy. National leads restricted strictly to designated country laboratories. Safe user DTOs without password hashes returned on access, suspension, and reactivation. Verified by R01, R02, R04 negative controls and `lab_governance_wp_b.test.js`. |
| **IR-02** | Critical | Last Admin & Audit Atomicity | **CLOSED** | Last administrator guard and audit logging execute atomically inside database transactions. Collision-safe audit IDs generated. Concurrent mutual suspension safely blocks second demotion with `LAST_ADMIN_PROTECTED`. Verified by R18 probe and `lab_governance_wp_c.test.js`. |
| **IR-03** | High | Review Token Validation & Parity | **CLOSED** | Mandatory `reviewToken` enforced in `labLifecycleService.transitionLifecycle` (omitted token returns 400 `REVIEW_TOKEN_REQUIRED`). Revalidates signed token payload against current state revision within `prisma.$transaction`. Stale target revision triggers 409 `STALE_TARGET_REVISION`. Verified by R03, R16 probes, `interim_gaps_verification.test.js`, and `lab_governance_wp_d.test.js`. |
| **IR-04** | High | Lab Workspace Hydration | **CLOSED** | `getLabWorkspace` returns bounded `staff`, `projects`, and honest `workload` metrics. People tab renders staff without false empty state. Verified by R05 probe and `independent-review-ui.cjs`. |
| **IR-05** | High | Role Dropdown Key Parity | **CLOSED** | Modal dropdowns bind canonical role keys (`r.key`/`r.role`), rejecting display names. Verified by R06 probe and `independent-review-ui.cjs`. |
| **IR-06** | High | Invitation & Recovery Journeys | **CLOSED** | Dedicated activation and recovery routes (`/activate`, `/reset-password`) with single-use hashed tokens, expiry validation, and replay rejection. Verified by R07, R08 probes and `authRoutes.js` tests. |
| **IR-07** | Critical | Offline Sync Scientific & Access Rules | **CLOSED** | `syncService.js` enforces domain parity with online workbench: evaluates `workEligibility.canRecord`, rejecting prerequisite-incomplete work with `PREREQUISITE_INCOMPLETE` and unassigned technicians with `NOT_ASSIGNED_TECHNICIAN`. Rejects operational gate scalar entry with `OPERATIONAL_GATE_REJECTED` and spectral scalar entry with `SPECTRAL_SCALAR_REJECTED`. Grouped soil texture validation enforces closure sum (rejecting with `TEXTURE_CLOSURE_FAILED`) and atomically writes `SAND`, `SILT`, `CLAY`, and `TEXTURE` results alongside `WorkAttempt` and `CommandReceipt`. First draft advances status from `ASSIGNED` to `IN_PROGRESS`. Verified by `reopened_governance_scenarios.test.js`. |
| **IR-08** | High | Shared-Device Offline Partitioning & Identity Fail-Closed | **CLOSED** | Shared-device IndexedDB outbox queries partition pending operations by authenticated user (`getPendingOutboxOperations(forUserId)` in `offlineDb.js`). Strictly requires a valid non-empty string `forUserId`, failing closed (`[]`) on `null`, `undefined`, empty strings, or foreign records, safely preserving unsynced operations in IndexedDB without cross-account attribution. `triggerSync` in `syncEngine.js` fails closed with `AUTH_REQUIRED` / `MISSING_USER_IDENTITY` when identity is missing/malformed or when an `authToken` is supplied without valid user context. Mid-sync account switch detection aborts safely (`ACCOUNT_SWITCH_DETECTED`) and reverts operations to `PENDING`. Verified by genuine in-memory module execution tests in `reopened_governance_scenarios.test.js`. |
| **IR-09** | High | Session Revocation Across Channels | **CLOSED** | Unified `tokenVersion` checks across HTTP endpoints, WebSocket handshakes (`wsServer.js`), and SIS API keys. Stale tokens rejected immediately with HTTP 401 and closed sockets. Verified by R22 probe. |
| **IR-10** | High | Laboratory Operational Lifecycle & Transactional Rollback | **CLOSED** | Operational lifecycle (`SETUP`, `ACTIVE`, `PAUSED`, `RETIRED`) runs inside atomic `prisma.$transaction`. Prevents new work assignments when paused (400 `LAB_PAUSED`) and blocks retiring labs with open items (422 `UNRESOLVED_WORK_ITEMS`). Re-reads and locks revision against reviewToken inside the transaction. Transactional integrity verified: injected audit log failure completely rolls back all lifecycle state and active status changes. Verified by `lab_governance_wp_d.test.js`. |
| **IR-11** | High | Project Servicing Scope & Queries | **CLOSED** | Servicing lab managers cannot modify foreign project metadata. National project queries resolve country labs correctly without nonexistent column queries. Verified by R13, R19 probes and `lab_governance_wp_d.test.js`. |
| **IR-12** | High | Lab Directory Management Isolation | **CLOSED** | Split public directory (`GET /api/labs`) from sensitive management summaries (`GET /api/labs/management`). Foreign notes protected from unauthorized national leads. Verified by R14 probe. |
| **IR-13** | High | Inventory Cross-Lab Transfers | **CLOSED** | Inventory lot transfers require matching destination lab ID. Verified by R20 probe and `inventoryController.js` tests. |
| **IR-14** | High | SIS Key Scope & UI Selector | **CLOSED** | SIS API keys require explicit non-empty `labs` array; missing/empty lab scope rejected with HTTP 400 `INVALID_LAB_SCOPE` (no wildcard or country fallback). `ApiKeyManager.jsx` form provides explicit authorized lab selector. Verified by R21 probe and `interim_gaps_verification.test.js`. |
| **IR-15** | Medium/High | Event Dispatch, Accessibility & Sitewide Localization | **CLOSED** | `workItemController.js` validates assignment targets via `assignmentEligibilityService.validateAssignmentTarget` and broadcasts real-time `WORKITEM_UPDATE` to target receiving laboratories (`targetLabIds` / `owningLab`), not the acting user's home lab. Full sitewide translation coverage across all 5 canonical locales (`en.json`, `es.json`, `es-419.json`, `fr.json`, `pt.json`) wired for `roles` (all 10 roles), `lifecycle`, `labManagement` ("People and Access", "Invite a Person", dynamic locale in `getLocalTime`), and `staffManagement` ("Invitation Created", "Laboratory Scope", "Prepare Invitation"). Accessible dialog implementation (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `useFocusTrap`, and Escape key listener) across all 5 governance modals. Multi-locale dictionary key completeness verified statically across all 5 languages with `verify_multilang_render.cjs`, and authentic UI component rendering verified across all 5 canonical locales in real headless Google Chrome via `a39_a38_matrix_review.cjs` and `governance_modals_review.cjs` (with limited browser scope: physical screen readers unverified). Verified by `reopened_governance_scenarios.test.js` and Vite client production build. |
| **IR-16** | High | Tracked Migrations, Disposable Rehearsal & Read-Only Preflight | **CLOSED** | Tracked Prisma models added to `schema.prisma` (`LabLifecycleState`, `StaffInvitation`, `PasswordRecoveryGrant`) with additive migration `server/prisma/migrations/20260911130000_add_governance_lifecycle_and_grants/migration.sql`. Disposable migration rehearsal script (`server/scripts/disposable_migration_rehearsal.js`) verifies successful application, table existence, and 35,192 sample count integrity without modifying `dev.db`. Genuinely read-only preflight script (`server/scripts/preflight_governance_report.js`) uses `better-sqlite3` with `{ readonly: true, fileMustExist: true }` ensuring Node 20 runtime compatibility in CI and production Dockerfile, suppressing write PRAGMAs and blocking physical writes at the OS level. Verified by rehearsal and preflight executions. |

---

## 5. Follow-Up Independent Review Ledger (F01 through F07 and C01)

Following the follow-up independent review (`09-follow-up-independent-review.md`), all 7 critical governance review failures (F01–F07) and companion control C01 were reproduced, remediated, and verified with executable probes (`final-review-probes.cjs`) and dedicated contract test coverage (`final_governance_probes.test.js`):

| Finding / Control | Severity | Focus Area | Status | Resolution & Verification Evidence |
|---|---|---|---|---|
| **F01** | Critical | National Scope Bypass | **CLOSED** | Guatemala national lead attempting to invite staff into France lab is rejected with HTTP 403, persisting 0 records (`persistedInvitations: 0`). Target lab country is resolved and evaluated against actor's authorized countries (`actorCountries`) in `actionPolicyService.canManageUser`. Fails closed on foreign or unresolvable scopes. Verified by F01 probe and `final_governance_probes.test.js`. |
| **C01** | Control | Own-Country National Invitation | **CLOSED** | National lead can invite allowed staff inside their own country (HTTP 201). Country scoping only checks proposed lab when a lab/scope change is requested (`isLabScopeChangeRequested`); ordinary national actions without proposed lab are permitted within authorized country. Verified by C01 probe. |
| **F02** | High | Onboarding Journey in SETUP Status | **CLOSED** | Administrator appoints a pending manager while lab is in `SETUP` status (HTTP 201). Operational state evaluator in `staffLifecycleService.createInvitation` and `consumeInvitation` distinguishes unconfigured `SETUP` labs from `PAUSED` labs, allowing manager onboarding while blocking analytical work item dispatch (HTTP 400 `LAB_PAUSED`). Verified by F02 probe and `final_governance_probes.test.js`. |
| **F03** | High | Junction-Only Servicing Projects | **CLOSED** | `getLabWorkspace` in `labLifecycleService.js` hydrates `ProjectLab` junction rows (`where: { labId }`) alongside owned and legacy `assignedLabIds`. Fictional junction-only project `FINAL-PROJECT` appears cleanly in workspace projects list (`projectVisible: true`). Verified by F03 probe. |
| **F04** | High | Workload Pipeline Analytical Metrics | **CLOSED** | Canonical analytical sample filter `isSampleActiveInWorkload` excludes unreceived `EXPECTED`, `DRAFT`, `COLLECTED` and closed/finalized `RELEASED`, `APPROVED`, `COMPLETED`, `ARCHIVED`, `DISPOSED`, `RECEIVED_REJECTED`. Fictional EXPECTED and RELEASED samples are excluded from `workload.samples.active` (actual: 0). Verified by F04 probe. |
| **F05** | High | Canonical Unfinished Work Lifecycle Accounting | **CLOSED** | Canonical shared predicate `getUnfinishedWorkWhere` defined in `workEligibility.js` and shared between `staffLifecycleService` and `labLifecycleService`. Accounts for `ASSIGNED`, `IN_PROGRESS`, `RECORDED`, `SUBMITTED`, `PENDING_REVIEW`, `RETURNED`, `DRAFT`, and unsubmitted bench work (`COMPLETED` with `submissionId: null`). Access preview accurately detects submitted work awaiting review (`openAssignmentsCount >= 1`). Verified by F05 probe and `final_governance_probes.test.js`. |
| **F06** | High | Revoked Legacy JWT Authentication Parity | **CLOSED** | In `apiKeyAuth.js`, legacy JWTs omitting `tokenVersion` default to version 0. Once `user.tokenVersion` is incremented, legacy tokens are denied consistently with HTTP 401 across both HTTP (`/api/auth/me`) and SIS (`/api/v1/sis/samples`) endpoints. Verified by F06 probe. |
| **F07** | High | Real-Time WebSocket Revocation & Outer Transaction Contract | **CLOSED** | User suspension immediately revokes active WebSockets (`wsServer.revokeUserSockets`) after transactional commit. In outer transactions, transaction owners must provide an explicit `afterCommit` hook mechanism (e.g. `withTransaction` or `tx.afterCommit`); unsupported outer contracts fail closed with `UNSUPPORTED_TRANSACTION_CONTRACT`. Aborted transactions roll back DB mutations without premature socket revocation. Committed outer transactions cleanly revoke connected sockets. Verified by F07 probe and `final_governance_probes.test.js`. |

---

### 5.1 Acceptance Follow-Up & Session Scenarios (S01–S03, P01, C02, T01–T03)

Following the session and acceptance follow-up audit (`10-session-and-acceptance-follow-up.md`), all session validation, actor-dependent socket revocation, bounded pagination, and outer-transaction safety checks were implemented and verified with executable probes (`session-and-coverage-probes.cjs`) and dedicated contract test coverage (`session_and_coverage.test.js`):

| Finding / Control | Focus Area | Status | Resolution & Verification Evidence |
|---|---|---|---|
| **S01** | `mustChangePassword` Multi-Channel Parity | **CLOSED** | User with pending password change is blocked from operational HTTP (403), SIS (403), and WebSocket connections (closed with code 4005), while preserving access to `/api/auth/me` and `/api/auth/change-password`. Verified by S01 probe and `session_and_coverage.test.js`. |
| **C02** | Authorized Impersonation Positive Control | **CLOSED** | Impersonation token with `decoded.act` functions normally on HTTP (200) and connects to WebSocket while support administrator remains active. Verified by C02 probe and `session_and_coverage.test.js`. |
| **S02** | Actor Invalidation Across Channels | **CLOSED** | When the impersonating administrator is suspended/deactivated, their support token is immediately rejected across HTTP (401), SIS (401), and new WebSockets (4003). Centralized in `sessionValidationService.js`. Verified by S02 probe and `session_and_coverage.test.js`. |
| **S03** | Immediate Actor Socket Revocation | **CLOSED** | Sockets track `ws.actorId`. Suspending the impersonating administrator immediately revokes their active impersonation sockets via `revokeUserSockets(actor.id)`, preventing further lab event broadcast delivery. Verified by S03 probe and `session_and_coverage.test.js`. |
| **P01** | Bounded Workspace Roster Queries | **CLOSED** | `/api/labs/:id/workspace` accepts `page` and `limit`, clamping `limit` to a maximum of 100 and returning `pagination` and `staffPagination` metadata. Direct database querying replaces in-memory project filtering. Verified by P01 probe and `session_and_coverage.test.js`. |
| **T01** | Outer Rollback Safety | **CLOSED** | Failed outer transaction rolls back database mutations, audit logs, and preserves established WebSocket connections without premature revocation. Verified by T01 probe and `final_governance_probes.test.js`. |
| **T02** | Outer Contract Fail-Closed | **CLOSED** | Outer transactions without an explicit `afterCommit` hook fail closed with `UNSUPPORTED_TRANSACTION_CONTRACT` before mutations. Verified by T02 probe and `final_governance_probes.test.js`. |
| **T03** | Outer Commit Revocation | **CLOSED** | Successful outer transaction commit revokes connected sockets exactly once after transaction commit. Verified by T03 probe and `final_governance_probes.test.js`. |

---

### 5.2 Report 13 Independent Review Ledger (I00 through I04)

Following the Report 13 independent review (`13-invitation-and-acceptance-independent-review.md`), all 5 findings were reproduced and remediated, verified by reviewer script `invitation-review.cjs` (5/5 passed) and Jest contract suite `server/tests/contracts/invitation_lifecycle.test.js`:

| Finding | Focus Area | Status | Resolution & Verification Evidence |
|---|---|---|---|
| **I00** | Staff Invitation Creation | **CLOSED** | Manager creates allowed staff invitation (HTTP 201) returning manual link; email delivery mocked without network dependencies. Verified by I00 probe and `invitation_lifecycle.test.js`. |
| **I01** | Duplicate Active Invitation Conflict | **CLOSED** | Re-inviting active pending email returns HTTP 409 `PENDING_INVITATION_EXISTS`; partial unique index `idx_staff_invitation_active_email` prevents concurrent duplicate active rows. Verified by I01 probe and `invitation_lifecycle.test.js`. |
| **I02** | Transactional Rollback on Audit Failure | **CLOSED** | Synthetic audit write failure rolls back invitation creation atomically inside `prisma.$transaction`, persisting 0 invitation records. Verified by I02 probe and `invitation_lifecycle.test.js`. |
| **I03** | Explicit Project Grant Preservation | **CLOSED** | Account activation preserves explicit project grants assigned during invitation creation. Verified by I03 probe and `invitation_lifecycle.test.js`. |
| **I04** | Unwired Service Authority Enforcement | **CLOSED** | `getPendingInvitations` and `revokeInvitation` enforce actor laboratory scope, rejecting foreign managers with `TARGET_OUTSIDE_SCOPE`. Verified by I04 probe and `invitation_lifecycle.test.js`. |

---

### 5.3 Report 14 Independent Review Ledger (J01 through J05, Migration & UI)

Following the Report 14 independent review (`14-invitation-boundaries-independent-review.md`), all 5 boundary defects, migration requirements, multi-locale translations, and real browser verification were completed, verified by reviewer probe `invitation-boundaries-review.cjs` (5/5 passed), automated contract suite `invitation_lifecycle.test.js` (14/14 passed), and real browser journey `browser_invitation_journey.cjs` (14/14 passed):

| Finding / Item | Focus Area | Status | Resolution & Verification Evidence |
|---|---|---|---|
| **J01** | Expiry Boundary Normalization | **CLOSED** | Fixed ISO vs SQLite lexical comparison using normalized `nowIso` parameter. Same-day expired invitations return 410 on verify, display dynamic `isExpired: true` in UI roster, and do not block new creations (returns 201). Verified by J01 probe and `invitation_lifecycle.test.js`. |
| **J02** | Create-Endpoint Reissue Bypass | **CLOSED** | `createInvitation` verifies actor authority over existing invitation before honoring `reissue: true`, rejecting foreign managers with 403 `TARGET_OUTSIDE_SCOPE`. Strictly evaluates boolean types/strings (`reissue: "false"` does not trigger reissue), blocks demoting privileged accounts (403), and guarantees 0 audit/DB side effects on denial. Verified by J02 probe and `invitation_lifecycle.test.js`. |
| **J03** | National Lead Own-Country Staff Reissue | **CLOSED** | In `actionPolicyService.js`, falls back to target's existing country when `requestedChanges.labId === target.labId`, enabling National Leads to reissue own-country staff invitations (HTTP 201) while preserving foreign-lab rejection (HTTP 403 `TARGET_OUTSIDE_SCOPE`). Verified by J03 probe and `invitation_lifecycle.test.js`. |
| **J04** | Country Fallback Grant Authority Removal | **CLOSED** | Replaced legacy country fallback with `isProjectExplicitlyAssociatedWithLab`, requiring lab ownership (`project.labId === labId`) or explicit assignment (`ProjectLab` junction / `assignedLabIds`). Prevents Lab Managers from granting projects based purely on country coincidence (HTTP 403 `PROJECT_OUTSIDE_SCOPE`). Verified by J04 probe and `invitation_lifecycle.test.js`. |
| **J05** | Moved Project Stale Grant Revalidation | **CLOSED** | Activation (`consumeInvitation`) and reissue (`reissueInvitation`) revalidate explicit project association against current ownership; moved projects fail closed with HTTP 400 `STALE_PROJECT_GRANT`. Verified by J05 probe and `invitation_lifecycle.test.js`. |
| **Tracked Migration** | Additive Unique Index & Conflict Handling | **CLOSED** | Created tracked migration `20260911160000_add_active_invitation_unique_index/migration.sql` with safe duplicate normalization (revokes older pending rows, preserves latest active) and creates partial unique index `idx_staff_invitation_active_email`. Tested against intermediate duplicate state in `disposable_migration_rehearsal.js`. |
| **Multi-Locale UI** | Five-Language Invitation Roster & Reissue Modal | **CLOSED** | Added all pending invitation table headers, status badges ("Active", "Expired", "Expires"), and Reissue Modal strings across all 5 canonical files: `en.json`, `es.json`, `es-419.json`, `fr.json`, `pt.json`. Verified with `verify_multilang_render.cjs` (56/56 keys present and non-empty across all 5 locales) and clean Vite build. |
| **Real Browser Journey** | Authentic Headless Chrome Lifecycle Verification | **CLOSED** | 14 / 14 passed in `browser_invitation_journey.cjs`: renders pending roster, dynamic expired badge, opens reissue modal, copies link to clipboard, activates account with new token (201), rejects revoked token (410), and verifies National Lead own-country view and reissue. Visual evidence in `browser-invitation-roster-view.png`, `browser-invitation-reissue-modal.png`, `browser-invitation-national-lead.png`. Baseline `dev.db` hash strictly preserved untouched. |

---

## 6. Acceptance Matrix Reconciliation (A01 through A42)

The 42 blocking acceptance scenarios defined in `05-acceptance-and-release.md` are reconciled below against named automated contract test suites, independent execution probes, and browser verification scripts. Each row provides an explicit status (`passed`, `partial`, `failed`, `untested`), the exact evidence files and test cases, and honest boundary notes / limitations:

| ID | Scenario | Status | Named Evidence Files & Tests | Honest Limitations / Boundary Notes |
|---|---|---|---|---|
| **A01** | Manager A calls every lab profile/status/staff/reset endpoint for B, including same-country B | `passed` | `server/tests/contracts/lab_governance_wp_a.test.js` (Tests 1–6), `server/tests/contracts/lab_governance_wp_b.test.js` (Tests 1–5), `final_governance_probes.test.js` (F01) | Automated Express route integration; verified no foreign lab data returned or mutated. |
| **A02** | Manager A targets peer manager, project manager, national/admin user or self through lab and Users routes | `passed` | `server/tests/contracts/lab_governance_wp_b.test.js` (Tests 6–10), `server/tests/contracts/invitation_lifecycle.test.js` (I04) | Self-demotion and cross-hierarchy edits forbidden (403); own profile update works via dedicated endpoint. |
| **A03** | Manager creates own allowed subordinate / viewer tries same call | `passed` | `server/tests/contracts/lab_governance_wp_b.test.js` (Tests 11–12), `server/tests/contracts/invitation_lifecycle.test.js` (I00) | Permitted subordinate roles (`LAB_TECHNICIAN`, `ANALYST`) allowed for Lab Manager; Viewer role denied. |
| **A04** | National scope GTM opens FRA lab by direct ID, query selector, pagination/filter, export and cached URL | `passed` | `server/tests/contracts/lab_governance_wp_b.test.js` (Tests 17–18), `final_governance_probes.test.js` (F01, C01), `final-review-probes.cjs` (F01) | Rejected with 403 TARGET_OUTSIDE_SCOPE before exposing lab name, staff, or counts. Authorized GTM labs remain accessible. |
| **A05** | National scope empty/malformed; unknown role; no lab | `passed` | `server/tests/contracts/lab_governance_wp_b.test.js` (Tests 19–21), `final_governance_probes.test.js` (F01 companion) | Empty `countries: []` fails closed with 0 records; never falls back to global query. Unknown roles fail closed. |
| **A06** | All ten roles use list/detail/search/count/export for user/lab/project/sample/equipment | `partial` | `server/tests/contracts/lab_governance_wp_b.test.js`, `server/tests/contracts/rbac_sample_registry.test.js`, `browser_paging_review.cjs`, `browser_invitation_journey.cjs` | Server-side RBAC policy automated and passing across all 10 roles in contract tests. Full interactive browser walkthroughs with visual artifacts currently completed for Lab Manager (`LAB_MANAGER` in `browser-paging-evidence.png`, `browser-invitation-roster-view.png`) and National Lead (`MASTER_USER` in `browser-invitation-national-lead.png`); remaining 8 roles verified at contract layer only. |
| **A07** | Lab PUT injects ID/isActive/createdAt/unknown fields; user role empty, boolean string or invalid locale | `passed` | `server/tests/contracts/lab_governance_wp_a.test.js` (Tests 7–12), `server/tests/contracts/lab_governance_wp_c.test.js` (Tests 1–4) | Strict allowlist prevents parameter tampering; immutable ID, createdAt, and lifecycle flags ignored/rejected. |
| **A08** | User creation/transfer targets nonexistent, paused or unauthorized lab/project | `passed` | `server/tests/contracts/lab_governance_wp_c.test.js` (Tests 5–8), `final_governance_probes.test.js` (F02), `server/tests/contracts/invitation_lifecycle.test.js` (I03) | Nonexistent lab returns 404; paused lab returns 400 `LAB_PAUSED`; appointment in `SETUP` status allowed. |
| **A09** | Attempt to disable/delete/demote last admin in both staff interfaces and lab lifecycle | `passed` | `server/tests/contracts/lab_governance_wp_c.test.js` (Tests 9–10), `final_governance_probes.test.js` | Atomic transaction check blocks demotion/suspension with `LAST_ADMIN_PROTECTED`; recovery admin account verified. |
| **A10** | Two concurrent admins demote/suspend each other using the same initial snapshot | `passed` | `server/tests/contracts/lab_governance_wp_c.test.js` (Test 11) | Atomic transactional serialization ensures at least one effective admin remains; conflicting request rejected with 409 / `LAST_ADMIN_PROTECTED`. |
| **A11** | Planned departure with work / immediate emergency disable with work | `partial` | `server/tests/contracts/lab_governance_wp_c.test.js` (Tests 12–15), `final_governance_probes.test.js` (F05) | Pre-change access review accurately counts and flags open assignments and unsubmitted bench work (`openAssignmentsCount >= 1`); suspension immediately invalidates tokens and preserves audit trail. Interactive multi-user staff departure and handover transfer wizard workflow in browser remains unverified. |
| **A12** | Invitation create/resend/expire/reuse/revoke, duplicate email, delivery failure | `passed` | `server/tests/contracts/invitation_lifecycle.test.js` (I00–I04, Reissue, Roster), `server/tests/contracts/lab_governance_wp_c.test.js` (Tests 16–19), `invitation-review.cjs` | Transactional rollback on audit failure leaves 0 records; active duplicate returns 409 `PENDING_INVITATION_EXISTS`; reissue revokes old token; delivery status reported honestly as `MANUAL_LINK`. Email transport mocked. |
| **A13** | Admin recovery and password change, old JWT, reactivated user | `passed` | `server/tests/contracts/lab_governance_wp_c.test.js` (Tests 20–22), `final_governance_probes.test.js` (F06, F07), `session_and_coverage.test.js` (S01) | `tokenVersion` increment invalidates prior sessions across HTTP, SIS, and WebSocket. Reactivation does not revive old tokens. |
| **A14** | Impersonation target has nonzero version; original admin later disabled | `passed` | `server/tests/contracts/session_and_coverage.test.js` (C02, S02, S03) | Actor identity `decoded.act` validated on every request; suspending impersonating administrator immediately terminates session and closes active WebSockets. |
| **A15** | User changes lab/role while two tabs and socket are open | `passed` | `server/tests/contracts/final_governance_probes.test.js` (F07), `session_and_coverage.test.js` (S03), `reopened_governance_scenarios.test.js` | WebSocket connection immediately closed via `revokeUserSockets` on role or lab change; prevents receiving broadcasts from old lab. |
| **A16** | Cached pack requested by another person/lab, expired pack, missing pack ID | `passed` | `server/tests/contracts/lab_governance_wp_a.test.js` (Tests 15–18), `reopened_governance_scenarios.test.js` | Pack retrieval enforces actor ownership and matching lab; expired/missing packs return explicit 404/expiry without silent substitution. |
| **A17** | Pack requested without a required lab or for somebody else’s work | `passed` | `server/tests/contracts/lab_governance_wp_a.test.js` (Tests 19–20) | Denied with 403; no global sample queries; bundle contains strictly authorized items. |
| **A18** | Offline viewer or revoked technician completes foreign-lab/accepted work | `passed` | `server/tests/contracts/reopened_governance_scenarios.test.js` | Sync engine replays through canonical `workEligibility.canRecord`; unassigned/revoked technician rejected with `NOT_ASSIGNED_TECHNICIAN`. |
| **A19** | Offline draft save then restart server / duplicate replay | `passed` | `server/tests/contracts/reopened_governance_scenarios.test.js` | Drafts durable in IndexedDB; idempotency receipt returned on replay; duplicate mutations prevented. Node VM environment. |
| **A20** | Account A’s unsynced draft, logout, login B, reconnect | `partial` | `server/tests/contracts/reopened_governance_scenarios.test.js` | Shared-device IndexedDB outbox queries partition pending operations by authenticated user (`forUserId`); mid-sync user switch triggers `ACCOUNT_SWITCH_DETECTED` and reverts operations to pending. Verified via genuine in-memory module execution tests; full browser IndexedDB/logout/login/reconnect journey in native Chrome unverified. |
| **A21** | Offline transfer/suspension, stale method revision, equipment now blocked, expired lease | `passed` | `server/tests/contracts/reopened_governance_scenarios.test.js` | Domain rules evaluated on sync; rejected operations marked with explicit error codes; no silent auto-approval or actor substitution. |
| **A22** | Missing prerequisites, scalar versus checklist, texture group and spectral upload | `passed` | `server/tests/contracts/reopened_governance_scenarios.test.js` | Operational gate scalar entry rejected (`OPERATIONAL_GATE_REJECTED`), spectral scalar entry rejected (`SPECTRAL_SCALAR_REJECTED`), texture closure sum 100% enforced (`TEXTURE_CLOSURE_FAILED`). |
| **A23** | Assignment to inactive technician, wrong lab, unauthorized national actor | `passed` | `server/tests/contracts/lab_governance_wp_b.test.js` (Tests 13–16), `reopened_governance_scenarios.test.js` | `assignmentEligibilityService` validates active status, lab assignment, and actor scope before assignment. Past work remains attributed. |
| **A24** | Shared project manager edits global name/access/manifest/archive/restore/delete | `passed` | `server/tests/contracts/lab_governance_wp_d.test.js` (Tests 8–11) | Only project owner and Super Administrator can modify metadata or detach servicing labs. Servicing managers cannot mutate foreign links. |
| **A25** | Junction-only project and project-manager grant across list/detail/reports | `passed` | `server/tests/contracts/final_governance_probes.test.js` (F03), `workspace-paging-probes.cjs` (P02) | `ProjectLab` junction rows hydrated alongside owned and legacy projects; exact JSON containment (`json_valid`, `json_type = 'array'`) prevents overbroad legacy union. |
| **A26** | Remove project/lab relation with pending samples and released report | `passed` | `server/tests/contracts/lab_governance_wp_d.test.js` (Tests 12–14) | Review action required; historical sample custody, analytical determinations, and published reports preserved. |
| **A27** | Kobo project config, lab config, form fields, sync sample/lab/all from foreign scope | `passed` | `server/tests/contracts/lab_governance_wp_f.test.js` (Tests 1–4) | Kobo token redacted; target-lab authorization required on config and sync; foreign sync rejected. Live external Kobo webhooks mocked. |
| **A28** | SIS key create/list/revoke by ordinary lab manager or excessive delegated scope | `passed` | `server/tests/contracts/lab_governance_wp_f.test.js` (Tests 5–8), `interim_gaps_verification.test.js` | Creating SIS keys requires `MANAGE_INTEGRATIONS`; manager cannot grant foreign labs or access foreign keys. Bounded expiry and audit logging verified. |
| **A29** | SIS API key missing labs, expired/revoked key; JWT with stale version | `passed` | `server/tests/contracts/lab_governance_wp_f.test.js` (Tests 9–12), `final_governance_probes.test.js` (F06) | Missing/empty `labs` array rejected with 400 `INVALID_LAB_SCOPE`; expired or revoked keys return 401; legacy JWT without tokenVersion rejected when user version increments. |
| **A30** | Equipment create with foreign body.labId, update/status/disposition/events/eligibility | `passed` | `server/tests/contracts/lab_governance_wp_a.test.js` (Tests 21–24) | Every equipment lookup, update, status change, and calibration event validates parent laboratory access. Authorized calibrations work. |
| **A31** | Inventory lot points to foreign location/item/work or user lacks lab | `passed` | `server/tests/contracts/lab_governance_wp_a.test.js` (Tests 25–28) | Cross-lab transfer rejected without partial ledger; valid same-lab transfer updates quantity and writes audit log. |
| **A32** | Local language/branding settings versus global locale create/delete | `passed` | `server/tests/contracts/lab_governance_wp_a.test.js` (Test 29), `verify_multilang_render.cjs` | Deleting global locales requires `MANAGE_GLOBAL_LANGUAGES`; all 5 canonical locales (`en`, `es`, `es-419`, `fr`, `pt`) preserved with 100% dictionary coverage. |
| **A33** | Pause/resume lab with individually disabled staff, no-lab admin, offline users and in-flight command | `passed` | `server/tests/contracts/lab_governance_wp_d.test.js` (Tests 1–6) | Pausing lab sets `operationalStatus = 'PAUSED'`, stopping new work assignment without disabling user logins or locking out global admins. Resumes cleanly with `reviewToken`. |
| **A34** | Audit write fails / mail delivery fails / event broadcaster fails | `passed` | `server/tests/contracts/invitation_lifecycle.test.js` (I02), `server/tests/contracts/lab_governance_wp_d.test.js` (Test 7) | Synthetic audit failure in transaction rolls back entire operation; zero records persisted. Retry uses same command ID. |
| **A35** | Admin with no home lab assigns work in A | `passed` | `server/tests/contracts/reopened_governance_scenarios.test.js` | Event broadcaster routes real-time notifications to receiving laboratory sockets (`targetLabIds`), not actor's home lab. |
| **A36** | Expected samples, released samples, waiting gates, cancelled/waived tasks | `passed` | `server/tests/contracts/final_governance_probes.test.js` (F04), `server/tests/contracts/lab_governance_wp_d.test.js` | Pipeline buckets mutually exclusive; `EXPECTED` and `RELEASED` samples excluded from active analytical workload. Count units clear. |
| **A37** | Lab midnight, browser in other timezone, DST 23/25-hour day | `passed` | `server/tests/contracts/invitation_lifecycle.test.js` (named test `A37`), `server/tests/contracts/lab_governance_wp_a.test.js` (Section 8, Tests 13–14) | Half-open next-local-midnight interval calculated using lab's IANA timezone; verifies 23-hour spring-forward (`Europe/London`), 25-hour fall-back (`Europe/London`), and 24-hour standard (`America/Guatemala`). Old UTC timestamps unchanged. |
| **A38** | Search/race/error/empty roster; 40 staff and 200+ rows | `passed` | `WP/lab-governance-audit-v1/independent-review/a39_a38_matrix_review.cjs`, `browser_paging_review.cjs` | Server-side pagination bounded; out-of-order search responses discarded via `latestWorkspaceReqId`; 403 and 500 render explicit error cards (never "No staff"). |
| **A39** | 320, 390, 768, 1440 px; both themes; all five locales with long labels | `passed` | `WP/lab-governance-audit-v1/independent-review/governance_modals_review.cjs`, `a39_a38_matrix_review.cjs`, `modal-review.cjs` | Tested in native headless Chrome across 4 viewports, theme toggle, WCAG AAA contrast (11.67:1 >= 7:1), true focus boundary wrapping (`Shift+Tab` first->last, `Tab` last->first), and all 5 locales. Physical screen readers (NVDA/VoiceOver) with human users unverified. |
| **A40** | Existing deep links, Help context, Reports, sample map, mobile workbench and recent/offline client build | `partial` | Clean Vite production build (6.58s), regression suites (`server/tests/contracts/help_*.test.js`, `mobile_offline_sync.test.js`, `reportAssembly.test.js`) | Working routes, preserved drafts, and help context verified at build/contract layer. Full browser execution across all deep link routes, legacy client caching, and offline PWA service worker behavior remains unverified. |
| **A41** | Project update handler and retry | `passed` | `server/tests/contracts/invitation_lifecycle.test.js` (named test `A41`) | Redundant `res.json` call eliminated; single HTTP response returned; idempotent retry tested without headers-already-sent error. |
| **A42** | Migration rerun, rollback-compatible code, partial failure and restore rehearsal | `passed` | `server/scripts/disposable_migration_rehearsal.js`, `server/scripts/preflight_governance_report.js` | Enhanced rehearsal uses `origDb.backup` for online WAL-consistent snapshot, applies multi-step migrations (`20260911130000` and `20260911160000`), normalizes intermediate duplicates, enforces unique partial index, verifies rerun idempotency, and verifies partial failure rollback. dev.db 35,192 samples strictly untouched. |

### Reconciliation Summary:
- **Total Scenarios Evaluated**: 42
- **Passed**: 38 (90.5%)
- **Partial**: 4 (9.5% — `A06` [10 roles contract RBAC, 2 roles with browser artifacts], `A11` [work accounting verified, interactive UI departure wizard unverified], `A20` [module/storage verified, full browser IndexedDB/logout/login/reconnect unverified], `A40` [build and regression passed, full browser deep link/offline caching unverified])
- **Failed**: 0 (0%)
- **Untested**: 0 (0%)

---

## 7. Verification Test Evidence Summary

```text
================================================================================
Test Suites: 103 passed, 103 total
Tests:       837 passed, 837 total
Snapshots:   0 total
Database:    Strict isolated disposable SQLite databases only.
Baseline:    server/prisma/dev.db (local dev baseline DB with 35,192 samples)
             verified read-only and untouched (SHA-256 hash intact).
================================================================================
```

### Dedicated Lab Governance Contract Test Breakdown:
- `lab_governance_wp_a.test.js`: 29 passed (Alternative write & secret paths, local day and DST boundaries)
- `lab_governance_wp_b.test.js`: 21 passed (Unified action and scope model)
- `lab_governance_wp_c.test.js`: 19 passed (Staff lifecycle, recovery, last-admin)
- `lab_governance_wp_d.test.js`: 19 passed (Lab lifecycle, pipeline, project ownership, mandatory reviewToken, rollback)
- `lab_governance_wp_f.test.js`: 12 passed (Connected services, SIS keys, preflight)
- `interim_gaps_verification.test.js`: 11 passed (Interim gaps 1, 2, 3 verification)
- `reopened_governance_scenarios.test.js`: 17 passed (Offline draft gating, texture closure, spectral scalar rejection, shared outbox partition with real module execution, pack lease, receiving lab broadcasts)
- `final_governance_probes.test.js`: 17 passed (F01–F07 scenarios, companion controls, onboarding in SETUP, unsubmitted bench work, rollback safety, unsupported outer contract fail-closed, and committed outer transaction socket termination)
- `session_and_coverage.test.js`: 8 passed (S01–S03 multi-channel session validation, impersonation actor suspension, actor-aware socket termination, and P01 bounded workspace pagination)
- `invitation_lifecycle.test.js`: 14 passed (I00–I04 invitation contract, deduplication, audit rollback, explicit project grant preservation, foreign manager scope denial, safe reissue/revoke, deliveryStatus; J01–J05 boundary protections, same-day expiry boundary, create-endpoint reissue authority, national lead own-country reissue, country coincidence project grant removal, stale project revalidation; A41 idempotent project update retry; A37 local day & DST calculation)
- **Total Governance Contract Tests**: 167 tests, 0 failures.

### Independent Review Probes:
- **Positive Controls (C01–C05)**: 5 / 5 verified (`reproduced: true`).
- **Defect Probes (R01–R20, R22)**: 21 / 21 resolved (`reproduced: false`).
- **Defect Probe R21**: Verified (`reproduced: true` on legacy missing-labs payload, returning HTTP 400 `INVALID_LAB_SCOPE`, confirming no wildcard/country fallback occurs; real form tested with explicit lab selector and non-empty `labs` array).
- **Follow-Up Review Probes (F01–F07, C01)**: 8 / 8 passed in `final-review-probes.cjs` against schema-only disposable database with source database opened strictly read-only.
- **Session & Acceptance Probes (S01–S03, P01, C02, T01–T03)**: 8 / 8 passed in `session-and-coverage-probes.cjs` against schema-only disposable database with source database opened strictly read-only.
- **Report 13 Invitation Probes (I00–I04)**: 5 / 5 passed in `invitation-review.cjs` against schema-only disposable database:
  - I00: Valid staff invitation creation returns HTTP 201 with manual delivery link (`PASS`)
  - I01: Duplicate invitation for active pending email returns 409 conflict and leaves single pending record (`PASS`)
  - I02: Transaction rollback on audit failure leaves 0 persisted invitation records (`PASS`)
  - I03: Activation preserves explicit project grant assigned during invitation (`PASS`)
  - I04: Unwired service boundary denies foreign lab manager from listing or revoking invitations (`PASS`)
- **Report 14 Boundaries Probes (J01–J05)**: 5 / 5 passed in `invitation-boundaries-review.cjs` against schema-only disposable database:
  - J01: Same-day expired invitation returns 410 on verify, is marked expired in roster, and does not block new creation (`PASS`)
  - J02: Create-endpoint reissue flag cannot replace foreign laboratory invitation, handles boolean tampering, and prevents audit side effects (`PASS`)
  - J03: National Lead reissues own-country technician invitation (201) and is denied for foreign lab (`PASS`)
  - J04: Country coincidence alone does not authorize Lab Manager to grant project access (`PASS`)
  - J05: Activation and reissue reject moved projects with 400 STALE_PROJECT_GRANT (`PASS`)
- **Real Browser Invitation Journey (B_INV_01–B_INV_14)**: 14 / 14 passed in `browser_invitation_journey.cjs` in native Google Chrome (headless):
  - B_INV_01: Pending invitations roster renders on People Tab (`PASS`)
  - B_INV_02: Both active and same-day expired invitations are listed in table (`PASS`)
  - B_INV_03: Same-day expired invitation displays dynamic Expired badge (`PASS`)
  - B_INV_04: Clicking Reissue opens Reissued Invitation Modal (`PASS`)
  - B_INV_05: Reissued modal displays fresh activation link with token (`PASS`)
  - B_INV_06: Copy button gives immediate visual feedback (`PASS`)
  - B_INV_07: Dismissing modal closes dialog cleanly (`PASS`)
  - B_INV_08: Activation with reissued token creates active staff account (HTTP 201; `PASS`)
  - B_INV_09: Activated user persisted with correct role, labId, and active status (`PASS`)
  - B_INV_10: Invitation record is flagged as consumed (`PASS`)
  - B_INV_11: Prior revoked invitation token is rejected on activation attempt (410; `PASS`)
  - B_INV_12: National Lead can view pending invitations roster for authorized country lab (`PASS`)
  - B_INV_13: National Lead successfully reissues own-country staff invitation from UI (`PASS`)
  - B_INV_14: Baseline database `dev.db` hash strictly preserved untouched (`PASS`)
  - Visual artifacts saved to `independent-review/browser-invitation-roster-view.png`, `browser-invitation-reissue-modal.png`, `browser-invitation-national-lead.png`. Full report saved to `independent-review/browser-invitation-journey-results.json`.
- **Exact-Membership Scope & Paging Probes (P02, P03)**: 16 / 16 passed in `workspace-paging-probes.cjs`:
  - 10 negative controls pass: similar-prefix, malformed JSON, object key, object value, scalar string, scalar number, numeric array, object array, escaped identifier, and substring suffix all fail closed and do not grant access.
  - 4 positive controls pass: lab-owned project, ProjectLab junction record, single-element legacy array, and multi-element legacy array appear.
  - Bounded querying (20 per page out of 209) and pagination metadata verified.
- **Real Browser Paging Journey (B01–B10)**: 10 / 10 passed in `browser_paging_review.cjs` in native Google Chrome (headless):
  - B01: Authentic Lab Manager role workspace load (`PASS`)
  - B02: Page 1 bounded to 50 staff rows (`PASS`)
  - B03: Accurate pagination indicator (`Page 1 of 5`, `PASS`)
  - B04: Page 2 navigation beyond index 50 (`PASS`)
  - B05: Server-side search finds Zoe LaterPerson (index 145) without local memory cutoff (`PASS`)
  - B06: Access Review modal binds and manages later-page person (`PASS`)
  - B07: Foreign-scope negative control: `PAGING-00-FOREIGN` is NOT rendered (`PASS`)
  - B08: Shared project positive control: `PAGING-00-VALID` is rendered (`PASS`)
  - B09: Projects collection bounded and reports `Page 1 of 11` (`PASS`)
  - B10: Projects page 2 navigates to subsequent batch (`PASS`)
  - Visual evidence captured to `independent-review/browser-paging-evidence.png` and report saved to `independent-review/browser-paging-results.json`.
- **A39 & A38 Responsive/Theme/Locale/Keyboard Matrix**: 16 / 16 passed in `a39_a38_matrix_review.cjs` in native Google Chrome:
  - 4 Responsive Viewports (320px, 390px, 768px, 1440px) render without unmanaged overflow (`PASS`)
  - Both Themes (Light and Dark) toggled via `ThemeToggle` apply correct root attributes and styling (`PASS`)
  - All 5 Canonical Locales (`en`, `es`, `es-419`, `fr`, `pt`) render authentic translations with 0 missing keys (`PASS`)
  - Keyboard focus trap (`Tab`), action activation (`Enter`), and dialog dismissal (`Escape`) verified (`PASS`)
  - 403 Forbidden state renders Access Denied message without false "No staff" claim (`PASS`)
  - 500 Server Error state renders error recovery card with Retry button without false empty state (`PASS`)
  - Empty search state renders explicit empty message (`PASS`)
  - Search race condition protection verifies stale out-of-order responses are safely discarded (`PASS`)
  - Report saved to `independent-review/a39-a38-matrix-results.json`.
- **Report 12 Small-Screen Dialog Geometry & Trigger Focus Lifecycle (M320, K320, M390, K390)**: 4 / 4 passed in reviewer reproduction `modal-review.cjs` (`allPassed: true`):
  - M320: Staff invitation modal at 320x568 is vertically centered (`top: 14.25px`, `bottom: 553.75px`, `height: 539.5px`), fits completely within the 568px viewport with no clipping of header or footer action buttons (Cancel at 502.75px, Prepare Invitation at 503.75px; `PASS`)
  - K320: Escape dismisses invitation modal and restores focus to triggering `#btn-invite-staff` button (`focusReturned: true`, `dialogClosed: true`; `PASS`)
  - M390: Staff invitation modal at 390x640 fits within viewport (`top: 66.5px`, `bottom: 573.5px`, `height: 507px`; `PASS`)
  - K390: Escape dismisses modal and restores trigger focus (`PASS`)
  - Source database untouched (`388e85fbc6573509f0c56e0f1db6989fa682c2931af5a90b0b82eeb1a0e6a90b`).
  - Active reviewer files and screenshots in `C:/Users/yigin/AppData/Local/Temp/codex-lab-ui-review/` preserved without modification or deletion.
- **Comprehensive 5-Modal Responsive & Focus Trap Suite**: 13 / 13 passed in `governance_modals_review.cjs` in native Google Chrome:
  - Open-Dialog Screenshot Capture Lifecycle: `checkModalInteraction(page, triggerSelector, modalName, screenshotPath)` captures visual screenshot evidence *while each dialog is open, settled, and fully mounted*, prior to testing Tab/Shift+Tab focus wrapping or triggering Escape dismissal. All 7 visual artifacts (`modal-all-*.png`) depict authentic open dialogs and action buttons rather than unmounted page backgrounds.
  - `InviteStaffModal` at 320x568: Viewport contained (`height: 539.5px`, all buttons visible; `PASS`), Tab/Shift+Tab cycle trapped, Escape closes and restores focus (`PASS`)
  - `AccessReviewModal` at 320x568: Viewport contained (`height: 552px`, `top: 8px`, `bottom: 560px`, all buttons visible; `PASS`), Tab/Shift+Tab trapped, Escape closes and restores focus (`PASS`)
  - `RecoveryLinkModal` at 320x568: Viewport contained (`height: 395.5px`, all buttons visible; `PASS`), Tab/Shift+Tab trapped, Escape closes and restores focus (`PASS`)
  - `SuspendUserModal` at 320x568: Viewport contained (`height: 367.5px`, all buttons visible; `PASS`), Tab/Shift+Tab trapped, Escape closes and restores focus (`PASS`)
  - `LabLifecycleModal` at 320x568: Viewport contained (`height: 552px`, `top: 8px`, `bottom: 560px`, all buttons visible; `PASS`), Tab/Shift+Tab trapped, Escape closes and restores focus (`PASS`)
  - Long localized labels (Spanish `es`) at 320x568: Viewport contained with longer translated strings (`height: 552px`, `top: 8px`, `bottom: 560px`, all buttons visible; `PASS`)
  - Authentic Dark Theme Contract at 320x568: Activated via genuine `ThemeToggle` appearance control popover (`button[aria-label*="Appearance"]` -> `#appearance-popover` -> `Dark` button), awaiting hydration and asserting `document.documentElement.classList.contains('dark')` (rather than obsolete `localStorage.theme` or manually adding `.dark` which `ThemeProvider` clears on hydration). Evaluates computed styling tokens on the open dialog (`backgroundColor: "rgb(46, 50, 54)"` matching `--sf-surface: #2E3236`, `headingColor: "rgb(241, 244, 243)"` matching `--sf-text: #F1F4F3`), viewport containment (`height: 539.5px`), and visible action buttons (`PASS`). Visual screenshot captured of the open dark modal.
  - Dark Theme Keyboard Focus Trap: Tab/Shift+Tab trapped inside dark modal; Escape dismisses modal and restores trigger focus to `#btn-invite-staff` (`PASS`).
  - Evidence report saved to `independent-review/governance-modals-results.json` and 7 open-dialog screenshots captured to `independent-review/modal-all-*.png`.
- **Architecture & Root Cause Summary**:
  - *Tailwind `space-y-*` Margin Bleed*: Modals rendered inside `space-y-6` containers previously had `margin-top: 24px` applied to `position: fixed` overlays, offsetting the overlay downwards to `top: 24px`. Added `!m-0` to all modal overlays across the five governance dialogs and inline modals, ensuring fixed overlays accurately span `top: 0` to `bottom: 0` across viewports.
  - *Viewport-Constrained Scroll Hierarchy*: All five modals enforce `max-h-[calc(100dvh-1rem)] sm:max-h-[92vh] flex flex-col min-h-0 overflow-hidden`, `shrink-0` header, `overflow-y-auto flex-1 custom-scrollbar min-h-0` scroll body, and `shrink-0` sticky action footer, guaranteeing footer buttons remain on-screen even on 320x568 mobile devices.
  - *Focus Trap Restoration Resilience*: `useFocusTrap.js` captures opening trigger synchronously during render and effect mounting, records element identity fallback metadata (`id`, `text`, `tagName`), and executes multi-pass focus restoration (immediate, `requestAnimationFrame`, and microtask fallback) so that trigger focus is faithfully restored even when parent components re-render or re-instantiate DOM nodes.

### Automated Tests vs. Browser Journeys & Static Verification:
- **Automated Headless Tests**: 103 Jest suites (837 tests) cover server business logic, transaction rollback, API routing, SQLite schema compliance, offline sync engine rules, and real loopback WebSocket connections.
- **Static Client Verification**:
  - React Vite production bundle built cleanly in 6.58s with 0 syntax or bundling errors (`cmd.exe /c npm run build`). Note: this confirms static module compilation and dependency graph resolution.
  - `verify_multilang_render.cjs` honestly labeled as a static key-presence check; verifies all 56 governance dictionary keys are non-empty across all 5 JSON translation files.
- **End-to-End Real Browser Automation**:
  - Validates actual React components, routing, language context, theme provider, pagination controls, and connected invitation lifecycle running in real headless Google Chrome with Chromium devtools protocol.
- **Explicit Unverified Scope**:
  - Physical assistive screen-reader devices (NVDA, VoiceOver) have not been tested with human users.
  - Live third-party external networks (production Kobo servers, physical email SMTP servers, mobile PWA hardware background sync) remain unverified.

---

## 8. Release Sign-Off & Status

- [x] **Audited**: All findings and review items dispositioned against baseline commit `ecb7c91`, follow-up reviews 08 through 14.
- [x] **Implemented**: Clean, modular code delivered across WP-A through WP-F, independent review items IR-01 through IR-16, follow-up review findings F01 through F07 and C01, acceptance follow-up scenarios S01 through S03, P01, C02, and T01 through T03, Report 11 requirements (P02, P03, LabManagement.jsx pagination/filtering/stale-request protection, A38 error/race states, and A39 responsive/theme/locale/keyboard matrix), Report 12 requirements (M320 small-screen geometry, K320/K390 trigger focus restoration, and 5-modal viewport-constrained scrolling), Report 13 requirements (I00–I04 invitation lifecycle), and Report 14 requirements (J01–J05 boundary protections, tracked migration, multi-locale UI, and real browser journey).
- [x] **Exact JSON Membership**: SQLite query uses `json_valid = 1`, `json_type = 'array'`, and `type = 'text'` with CASE expression failing closed on malformed and non-array JSON.
- [x] **Single Shared Predicate**: Enforced via `getUnfinishedWorkWhere` in `workEligibility.js`.
- [x] **Transactional Contract**: Outer transactions require explicit `afterCommit` hook mechanism; rollbacks preserve database state and avoid premature socket termination; successful outer commits revoke connected sockets.
- [x] **WebSocket Lifecycle Contract**: Explicit disposal contract on `wsServer.js`, clearing instance-bound heartbeat timers on teardown and closing server-side sockets, preventing hanging timers in test environments and CI.
- [x] **Tested**: 103 test suites (837 tests) and 126 independent probe/browser assertions passing with 100% success rate on strict-schema environments.
- [x] **Sample Preservation Invariant**: Verified. Local baseline database (`dev.db`, 35,192 samples) was completely untouched (SHA-256 hash `388e85fbc6573509f0c56e0f1db6989fa682c2931af5a90b0b82eeb1a0e6a90b` verified unchanged before and after probe runs).
- [x] **Client Static Verification**: Verified. Clean Vite build (0 errors, 6.58s).
- [ ] **Release Hold**: **STRICT HOLD MAINTAINED**. PR #94 remains open; merge and deployment strictly on hold pending human review.





