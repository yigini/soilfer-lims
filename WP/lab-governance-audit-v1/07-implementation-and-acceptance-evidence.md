# Laboratory Governance Audit v1 — Implementation & Acceptance Evidence

**Deliverable**: Laboratory Management Redesign and Connected Access Controls (`WP/lab-governance-audit-v1`)  
**Base Commit**: `ecb7c91aee041febfb60de51d248f322b6d6376c`  
**Target Branch**: `codex/lab-governance-v1`  
**Execution Date**: 11 September 2026  
**Release Status**: **STRICT MERGE & DEPLOYMENT HOLD** ([PR #94](https://github.com/yigini/soilfer-lims/pull/94) remains open; no staging, merge, or deployment)  
**Auditor Finding Coverage**: All 16 original review items (IR-01 – IR-16), all 7 follow-up review findings (F01 – F07 + C01), and acceptance follow-up scenarios (S01 – S03, P01, C02, T01 – T03) fully resolved and verified  
**Server Contract Test Suites**: 102 Test Suites (821 tests total, 0 failures; including 9 dedicated governance suites with 153 contract tests)  
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
| **IR-15** | Medium/High | Event Dispatch, Accessibility & Sitewide Localization | **CLOSED** | `workItemController.js` validates assignment targets via `assignmentEligibilityService.validateAssignmentTarget` and broadcasts real-time `WORKITEM_UPDATE` to target receiving laboratories (`targetLabIds` / `owningLab`), not the acting user's home lab. Full sitewide translation coverage across all 5 canonical locales (`en.json`, `es.json`, `es-419.json`, `fr.json`, `pt.json`) wired for `roles` (all 10 roles), `lifecycle`, `labManagement` ("People and Access", "Invite a Person", dynamic locale in `getLocalTime`), and `staffManagement` ("Invitation Created", "Laboratory Scope", "Prepare Invitation"). Accessible dialog implementation (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `useFocusTrap`, and Escape key listener) across all 5 governance modals. Multi-locale rendering verified across all 5 languages with `verify_multilang_render.cjs`. Verified by `reopened_governance_scenarios.test.js` and Vite client production build. |
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

## 6. Acceptance Matrix Verification (A01 through A42)

The 42 blocking acceptance scenarios defined in `05-acceptance-and-release.md` map to specific automated contract and integration assertions:

- **A01–A03 (Lab Scope & Role Hierarchy)**: Verified in automated contract tests `lab_governance_wp_a.test.js` & `lab_governance_wp_b.test.js`. Lab Manager A cannot access or mutate Lab B; subordinate management strictly bounded.
- **A04–A05 (National Lead Boundaries)**: Verified in automated contract tests `lab_governance_wp_b.test.js` (Test 17–18), `lab_governance_wp_d.test.js`, and `final_governance_probes.test.js` (F01, C01). National lead scoped to GTM receives 403 on FRA lab; empty country list fails closed.
- **A06 (All 10 Roles)**: Verified across automated headless test suites against the canonical RBAC matrix. *Coverage status: Automated matrix logic verified; live end-to-end interactive browser sessions across all 10 roles remain unverified.*
- **A07–A08 (Schema & Lifecycle Validation)**: Verified in automated contract tests `lab_governance_wp_a.test.js`, `lab_governance_wp_c.test.js`, and `final_governance_probes.test.js`. Immutable fields rejected; invalid/paused lab assignments blocked; manager appointment allowed in SETUP.
- **A09–A10 (Last Admin & Concurrency Guard)**: Verified in automated contract tests `lab_governance_wp_c.test.js` (Test 9, 11). Atomic database checks prevent last-admin removal or concurrent mutual demotion.
- **A11–A13 (Staff Lifecycle, Invitations & Tokens)**: Verified in automated contract tests `lab_governance_wp_c.test.js` and `session_and_coverage.test.js` (S01). Expiring single-use tokens, session revocation on suspension, and clean reactivation. *Coverage status: API lifecycle verified; third-party email transmission unverified (outbox tokens returned in response).*
- **A14–A15 (Sessions, Sockets & Reassignment)**: Verified in automated contract tests `lab_governance_wp_c.test.js`, `final_governance_probes.test.js` (F06, F07), and `session_and_coverage.test.js` (S01–S03, T01–T03). `tokenVersion` increments invalidate sessions across channels; post-commit WebSocket termination and actor session revocation verified.
- **A16–A22 (Offline Sync & Scientific Integrity)**: Verified via automated module execution in `lab_governance_wp_a.test.js`, `interim_gaps_verification.test.js`, and `reopened_governance_scenarios.test.js`. Unscoped packs denied; domain rules enforced on replay; drafts durable; spectral scalar values rejected; texture closure enforced. *Coverage status: Logic verified in Node VM environment; physical mobile device PWA hardware background sync unverified.*
- **A23 (Work Assignment Eligibility)**: Verified in automated contract tests `lab_governance_wp_b.test.js` (Test 13–16) and `reopened_governance_scenarios.test.js`. Inactive, cross-lab, and paused-lab assignments blocked.
- **A24–A26 (Project Relationships & Provenance)**: Verified in automated contract tests `lab_governance_wp_d.test.js` and `final_governance_probes.test.js` (F03). Ownership enforced; junction servicing projects hydrated; historical sample associations preserved upon lab detachment.
- **A27–A29 (Kobo & SIS Integration Controls)**: Verified in automated contract tests `lab_governance_wp_f.test.js`, `interim_gaps_verification.test.js`, and `session_and_coverage.test.js`. Target-lab assertions on Kobo configs; explicit lab scopes and audit logging on SIS API keys. *Coverage status: Contract tests pass; live external Kobo webhook delivery unverified.*
- **A30–A32 (Equipment, Inventory & Locales)**: Verified in automated contract tests `lab_governance_wp_a.test.js` and multi-locale verification `verify_multilang_render.cjs`. Resource lab checks on equipment/inventory; all 5 canonical locales preserved with 100% key coverage.
- **A33–A35 (Lab State & Work Dispatch)**: Verified in automated contract tests `lab_governance_wp_d.test.js` and `reopened_governance_scenarios.test.js`. Pausing lab preserves records without cascading to staff; notifications target receiving lab.
- **A36–A38 (Workload Pipeline, Timezones & Pagination)**: Verified in automated contract tests `lab_governance_wp_b.test.js`, `lab_governance_wp_d.test.js`, `final_governance_probes.test.js` (F04), and `session_and_coverage.test.js` (P01). Mutually exclusive counts excluding expected/released; bounded pagination clamped to max 100 with pagination metadata.
- **A39–A40 (UI & Accessibility)**: Verified via automated static Vite bundle compilation, accessible modal attributes (focus traps, Escape listeners, `aria-*`), and CSS tokens across responsive viewports. *Coverage status: Static compilation and DOM attributes verified; end-to-end interactive browser journeys with assistive screen-reader software (NVDA/VoiceOver) unverified.*
- **A41 (Project Update Handler)**: Verified in automated contract tests `lab_governance_wp_d.test.js`. Single response returned without error.
- **A42 (Migration & Preflight Safety)**: Verified in `server/scripts/preflight_governance_report.js`, `server/scripts/disposable_migration_rehearsal.js`, and `lab_governance_wp_f.test.js`. Zero sample loss verified; local dev baseline database verified untouched.

---

## 7. Verification Test Evidence Summary

```text
================================================================================
Test Suites: 102 passed, 102 total
Tests:       823 passed, 823 total
Snapshots:   0 total
Database:    Strict isolated disposable SQLite databases only.
Baseline:    server/prisma/dev.db (local dev baseline DB with 35,192 samples)
             verified read-only and untouched (SHA-256 hash intact).
================================================================================
```

### Dedicated Lab Governance Contract Test Breakdown:
- `lab_governance_wp_a.test.js`: 29 passed (Alternative write & secret paths)
- `lab_governance_wp_b.test.js`: 21 passed (Unified action and scope model)
- `lab_governance_wp_c.test.js`: 19 passed (Staff lifecycle, recovery, last-admin)
- `lab_governance_wp_d.test.js`: 19 passed (Lab lifecycle, pipeline, project ownership, mandatory reviewToken, rollback)
- `lab_governance_wp_f.test.js`: 12 passed (Connected services, SIS keys, preflight)
- `interim_gaps_verification.test.js`: 11 passed (Interim gaps 1, 2, 3 verification)
- `reopened_governance_scenarios.test.js`: 17 passed (Offline draft gating, texture closure, spectral scalar rejection, shared outbox partition with real module execution, pack lease, receiving lab broadcasts)
- `final_governance_probes.test.js`: 17 passed (F01–F07 scenarios, companion controls, onboarding in SETUP, unsubmitted bench work, rollback safety, unsupported outer contract fail-closed, and committed outer transaction socket termination)
- `session_and_coverage.test.js`: 8 passed (S01–S03 multi-channel session validation, impersonation actor suspension, actor-aware socket termination, and P01 bounded workspace pagination)
- **Total Governance Contract Tests**: 153 tests, 0 failures.

### Independent Review Probes:
- **Positive Controls (C01–C05)**: 5 / 5 verified (`reproduced: true`).
- **Defect Probes (R01–R20, R22)**: 21 / 21 resolved (`reproduced: false`).
- **Defect Probe R21**: Verified (`reproduced: true` on legacy missing-labs payload, returning HTTP 400 `INVALID_LAB_SCOPE`, confirming no wildcard/country fallback occurs; real form tested with explicit lab selector and non-empty `labs` array).
- **Follow-Up Review Probes (F01–F07, C01)**: 8 / 8 passed in `final-review-probes.cjs` against schema-only disposable database with source database opened strictly read-only.
- **Session & Acceptance Probes (S01–S03, P01, C02, T01–T03)**: 8 / 8 passed in `session-and-coverage-probes.cjs` against schema-only disposable database with source database opened strictly read-only.

### Automated Tests vs. Browser Journeys & Static Verification:
- **Automated Headless Tests**: 102 Jest suites (823 tests) cover server business logic, transaction rollback, API routing, SQLite schema compliance, offline sync engine rules, and real loopback WebSocket connections.
- **Static Client Verification**:
  - React Vite production bundle built in 7.64s with 0 syntax or bundling errors (`npm run build`). Note: this confirms static module compilation and dependency graph resolution; it is not an interactive browser journey.
- **Headless UI Probes & Localization**:
  - `independent-review-ui.cjs` verifies rendering of the People and Access tab with 3 laboratory staff members and validates that modal dropdowns bind canonical role keys (`r.key`/`r.role`), rejecting display names.
  - Multi-locale rendering verified across all 5 canonical languages (`en`, `es`, `es-419`, `fr`, `pt`) with 0 missing localization keys via committed test script `WP/lab-governance-audit-v1/verify_multilang_render.cjs`.
  - Accessible modal markup verified in code (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus trapping with `useFocusTrap`, and Escape key listeners across all 5 governance modals).
- **Explicit Unverified Scope**:
  - Real end-to-end interactive browser journeys across all 10 roles in physical desktop/mobile browsers have not been fully executed.
  - Physical assistive screen-reader devices (NVDA, VoiceOver) have not been tested with human users.
  - Live third-party external networks (production Kobo servers, physical email SMTP servers, mobile PWA hardware background sync) remain unverified.

---

## 8. Release Sign-Off & Status

- [x] **Audited**: All findings and review items dispositioned against baseline commit `ecb7c91`.
- [x] **Implemented**: Clean, modular code delivered across WP-A through WP-F, independent review items IR-01 through IR-16, follow-up review findings F01 through F07 and C01, and acceptance follow-up scenarios S01 through S03, P01, C02, and T01 through T03.
- [x] **Single Shared Predicate**: Enforced via `getUnfinishedWorkWhere` in `workEligibility.js`.
- [x] **Transactional Contract**: Outer transactions require explicit `afterCommit` hook mechanism; rollbacks preserve database state and avoid premature socket termination; successful outer commits revoke connected sockets.
- [x] **WebSocket Lifecycle Contract**: Explicit disposal contract on `wsServer.js`, clearing instance-bound heartbeat timers on teardown and closing server-side sockets, preventing hanging timers in test environments and CI.
- [x] **Tested**: 102 test suites (823 tests) and 16 probe scenarios passing with 100% success rate on strict-schema environments.
- [x] **Sample Preservation Invariant**: Verified. Local baseline database (`dev.db`, 35,192 samples) was completely untouched (SHA-256 hash `388e85fbc6573509f0c56e0f1db6989fa682c2931af5a90b0b82eeb1a0e6a90b` verified unchanged before and after probe runs).
- [x] **Client Static Verification**: Verified. Clean Vite build (0 errors, 7.64s).
- [ ] **Release Hold**: **STRICT HOLD MAINTAINED**. PR #94 remains open; merge and deployment strictly on hold pending human review.




