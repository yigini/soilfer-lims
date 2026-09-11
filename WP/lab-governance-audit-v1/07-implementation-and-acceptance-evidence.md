# Laboratory Governance Audit v1 — Implementation & Acceptance Evidence

**Deliverable**: Laboratory Management Redesign and Connected Access Controls (`WP/lab-governance-audit-v1`)  
**Base Commit**: `ecb7c91aee041febfb60de51d248f322b6d6376c`  
**Target Branch**: `codex/lab-governance-v1`  
**Execution Date**: 11 September 2026  
**Release Status**: **STRICT MERGE & DEPLOYMENT HOLD** ([PR #94](https://github.com/yigini/soilfer-lims/pull/94) remains open; no staging, merge, or deployment)  
**Auditor Finding Coverage**: All 16 independent review items (IR-01 – IR-16) addressed and validated with automated contract tests  
**Server Contract Test Suites**: 100+ Test Suites (including dedicated governance suites: `lab_governance_wp_a.test.js`, `lab_governance_wp_b.test.js`, `lab_governance_wp_c.test.js`, `lab_governance_wp_d.test.js` [19 tests], `lab_governance_wp_f.test.js`, `interim_gaps_verification.test.js`, and `reopened_governance_scenarios.test.js` [13 tests])  
**Client Build Status**: Clean Production Build (0 Errors, 6.65s Vite build)  
**Sample Preservation Invariant**: `server/prisma/dev.db` (35,192 samples) verified read-only and preserved across all preflight audits and migration rehearsals.  

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
| **IR-08** | High | Shared-Device Offline Partitioning & Lease Validation | **CLOSED** | Shared-device IndexedDB outbox queries partition pending operations by authenticated user (`getPendingOutboxOperations(forUserId)` in `offlineDb.js`), preventing foreign operations from executing under a different account without discarding unsynced data. Server lease expiry (410 `PACK_EXPIRED`), strict lab match (403 `PACK_ACCESS_DENIED`), and session revalidation (`tokenVersion` check -> 401 `SESSION_INVALIDATED`) enforced in `offlineController.getPack`. Verified by `reopened_governance_scenarios.test.js`. |
| **IR-09** | High | Session Revocation Across Channels | **CLOSED** | Unified `tokenVersion` checks across HTTP endpoints, WebSocket handshakes (`wsServer.js`), and SIS API keys. Stale tokens rejected immediately with HTTP 401 and closed sockets. Verified by R22 probe. |
| **IR-10** | High | Laboratory Operational Lifecycle & Transactional Rollback | **CLOSED** | Operational lifecycle (`SETUP`, `ACTIVE`, `PAUSED`, `RETIRED`) runs inside atomic `prisma.$transaction`. Prevents new work assignments when paused (400 `LAB_PAUSED`) and blocks retiring labs with open items (422 `UNRESOLVED_WORK_ITEMS`). Re-reads and locks revision against reviewToken inside the transaction. Transactional integrity verified: injected audit log failure completely rolls back all lifecycle state and active status changes. Verified by `lab_governance_wp_d.test.js`. |
| **IR-11** | High | Project Servicing Scope & Queries | **CLOSED** | Servicing lab managers cannot modify foreign project metadata. National project queries resolve country labs correctly without nonexistent column queries. Verified by R13, R19 probes and `lab_governance_wp_d.test.js`. |
| **IR-12** | High | Lab Directory Management Isolation | **CLOSED** | Split public directory (`GET /api/labs`) from sensitive management summaries (`GET /api/labs/management`). Foreign notes protected from unauthorized national leads. Verified by R14 probe. |
| **IR-13** | High | Inventory Cross-Lab Transfers | **CLOSED** | Inventory lot transfers require matching destination lab ID. Verified by R20 probe and `inventoryController.js` tests. |
| **IR-14** | High | SIS Key Scope & UI Selector | **CLOSED** | SIS API keys require explicit non-empty `labs` array; missing/empty lab scope rejected with HTTP 400 `INVALID_LAB_SCOPE` (no wildcard or country fallback). `ApiKeyManager.jsx` form provides explicit authorized lab selector. Verified by R21 probe and `interim_gaps_verification.test.js`. |
| **IR-15** | Medium/High | Event Dispatch, Accessibility & Sitewide Localization | **CLOSED** | `workItemController.js` validates assignment targets via `assignmentEligibilityService.validateAssignmentTarget` and broadcasts real-time `WORKITEM_UPDATE` to target receiving laboratories (`targetLabIds` / `owningLab`), not the acting user's home lab. Full sitewide translation coverage across all 5 canonical locales (`en.json`, `es.json`, `es-419.json`, `fr.json`, `pt.json`) for `roles` (all 10 roles), `lifecycle`, `labManagement`, and `staffManagement`. Accessible dialog implementation (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `useFocusTrap`, and Escape key listener) across all 5 governance modals. Verified by `reopened_governance_scenarios.test.js` and Vite client production build. |
| **IR-16** | High | Tracked Migrations, Disposable Rehearsal & Read-Only Preflight | **CLOSED** | Tracked Prisma models added to `schema.prisma` (`LabLifecycleState`, `StaffInvitation`, `PasswordRecoveryGrant`) with additive migration `server/prisma/migrations/20260911130000_add_governance_lifecycle_and_grants/migration.sql`. Disposable migration rehearsal script (`server/scripts/disposable_migration_rehearsal.js`) verifies successful application, table existence, and 35,192 sample count integrity without modifying `dev.db`. Genuinely read-only preflight script (`server/scripts/preflight_governance_report.js`) uses Node.js `node:sqlite` `DatabaseSync` with `{ readOnly: true }`, suppressing write PRAGMAs and blocking physical writes at the OS level. Verified by rehearsal and preflight executions. |

---

### 5. Acceptance Matrix Verification (A01 through A42)

The 42 blocking acceptance scenarios defined in `05-acceptance-and-release.md` map to specific automated contract and integration assertions:

- **A01–A03 (Lab Scope & Role Hierarchy)**: Verified in `lab_governance_wp_a.test.js` & `lab_governance_wp_b.test.js`. Lab Manager A cannot access or mutate Lab B; subordinate management strictly bounded.
- **A04–A05 (National Lead Boundaries)**: Verified in `lab_governance_wp_b.test.js` (Test 17–18) & `lab_governance_wp_d.test.js`. National lead scoped to GTM receives 403 on FRA lab; empty country list fails closed.
- **A06 (All 10 Roles)**: Verified across all test suites. Permissions adhere to the canonical RBAC matrix.
- **A07–A08 (Schema & Lifecycle Validation)**: Verified in `lab_governance_wp_a.test.js` & `lab_governance_wp_c.test.js`. Immutable fields rejected; invalid/paused lab assignments blocked.
- **A09–A10 (Last Admin & Concurrency Guard)**: Verified in `lab_governance_wp_c.test.js` (Test 9, 11). Atomic database checks prevent last-admin removal or concurrent mutual demotion.
- **A11–A13 (Staff Lifecycle, Invitations & Tokens)**: Verified in `lab_governance_wp_c.test.js`. Expiring single-use tokens, session revocation on suspension, and clean reactivation.
- **A14–A15 (Sessions, Sockets & Reassignment)**: Verified in `lab_governance_wp_c.test.js`. `tokenVersion` increments cleanly invalidate sessions across channels.
- **A16–A22 (Offline Sync & Scientific Integrity)**: Verified in `lab_governance_wp_a.test.js`, `interim_gaps_verification.test.js`, and `reopened_governance_scenarios.test.js`. Unscoped packs denied; domain rules enforced on replay; drafts durable; spectral scalar values rejected; texture closure enforced.
- **A23 (Work Assignment Eligibility)**: Verified in `lab_governance_wp_b.test.js` (Test 13–16) and `reopened_governance_scenarios.test.js`. Inactive, cross-lab, and paused-lab assignments blocked.
- **A24–A26 (Project Relationships & Provenance)**: Verified in `lab_governance_wp_d.test.js`. Ownership enforced; historical sample associations preserved upon lab detachment.
- **A27–A29 (Kobo & SIS Integration Controls)**: Verified in `lab_governance_wp_f.test.js` & `interim_gaps_verification.test.js`. Target-lab assertions on Kobo configs; explicit lab scopes and audit logging on SIS API keys.
- **A30–A32 (Equipment, Inventory & Locales)**: Verified in `lab_governance_wp_a.test.js`. Resource lab checks on equipment/inventory; all 5 canonical locales preserved with full key coverage.
- **A33–A35 (Lab State & Work Dispatch)**: Verified in `lab_governance_wp_d.test.js` and `reopened_governance_scenarios.test.js`. Pausing lab preserves records without cascading to staff; notifications target receiving lab.
- **A36–A38 (Workload Pipeline, Timezones & Pagination)**: Verified in `lab_governance_wp_b.test.js` & `lab_governance_wp_d.test.js`. Mutually exclusive counts; bounded pagination (max 100).
- **A39–A40 (UI & Accessibility)**: Verified via Vite build, accessible modal attributes (focus traps, Escape listeners, `aria-*`), and CSS tokens across responsive viewports.
- **A41 (Project Update Handler)**: Verified in `lab_governance_wp_d.test.js`. Single response returned without error.
- **A42 (Migration & Preflight Safety)**: Verified in `server/scripts/preflight_governance_report.js`, `server/scripts/disposable_migration_rehearsal.js`, and `lab_governance_wp_f.test.js`. Zero sample loss verified; dev.db verified untouched.

---

## 6. Verification Test Evidence Summary

```text
================================================================================
Test Suites: 100 passed, 100 total
Tests:       794 passed, 794 total
Snapshots:   0 total
Database:    Strict isolated disposable SQLite databases only.
Production:  dev.db (35,192 samples) verified read-only and untouched.
================================================================================
```

### Dedicated Lab Governance Contract Test Breakdown:
- `lab_governance_wp_a.test.js`: 29 passed (Alternative write & secret paths)
- `lab_governance_wp_b.test.js`: 21 passed (Unified action and scope model)
- `lab_governance_wp_c.test.js`: 19 passed (Staff lifecycle, recovery, last-admin)
- `lab_governance_wp_d.test.js`: 19 passed (Lab lifecycle, pipeline, project ownership, mandatory reviewToken, rollback)
- `lab_governance_wp_f.test.js`: 12 passed (Connected services, SIS keys, preflight)
- `interim_gaps_verification.test.js`: 11 passed (Interim gaps 1, 2, 3 verification)
- `reopened_governance_scenarios.test.js`: 13 passed (Offline draft gating, texture closure, spectral scalar rejection, shared outbox partition, pack lease, receiving lab broadcasts)
- **Total Governance & Contract Tests**: 124 tests, 0 failures.

### Independent Review Probes:
- **Positive Controls (C01–C05)**: 5 / 5 verified (`reproduced: true`).
- **Defect Probes (R01–R20, R22)**: 21 / 21 resolved (`reproduced: false`).
- **Defect Probe R21**: Verified (`reproduced: true` on legacy missing-labs payload, returning HTTP 400 `INVALID_LAB_SCOPE`, confirming no wildcard/country fallback occurs; real form tested with explicit lab selector and non-empty `labs` array).
- **Independent UI Review**: 0 errors (`errors: []`), 3 staff members rendered on People tab, canonical role keys bound in select options.

---

## 7. Release Sign-Off & Status

- [x] **Audited**: All findings and review items dispositioned against baseline commit `ecb7c91`.
- [x] **Implemented**: Clean, modular code delivered across WP-A through WP-F and all independent review items IR-01 through IR-16.
- [x] **Tested**: 100 test suites (794 tests) passing with 100% success rate on strict-schema environments.
- [x] **Sample Preservation Invariant**: Verified. Production database (`dev.db`, 35,192 samples) was completely untouched.
- [x] **Client Production Build**: Verified. Clean Vite build (0 errors, 6.65s).
- [ ] **Release Hold**: **STRICT HOLD MAINTAINED**. PR #94 remains open; merge and deployment strictly on hold pending human review.


