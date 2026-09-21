# Candidate Release Decision Package & Production Upgrade Runbook

**Work Package**: `WP/contributor-issues-2026-09`  
**Candidate Release Commit SHA**: `fe02e7589205bb6a8d085b93be573982f13ec45d`  
**Intended Production Baseline**: `762c46e` (`main`)  
**Draft Pull Request**: [#129](https://github.com/yigini/soilfer-lims/pull/129) (`review/wp-contributor-issues-candidate`) — **Unmerged Draft**  
**Clean CI Run**: [GitHub Actions Run 35653053215](https://github.com/yigini/soilfer-lims/actions/runs/35653053215) — **SUCCESS** (131 test suites, 1,177 tests passed in 3m54s, Docker image built)  
**Independent Acceptance Checkpoint**: Codex `candidate-acceptance-2046.md` (R1–R5 passed, 26/26 contract tests in 10.446s)  
**Rehearsal Script**: [`release_rollback_rehearsal.cjs`](release_rollback_rehearsal.cjs)  
**Captured Rehearsal Log**: [`rehearsal_output.log`](rehearsal_output.log)  

---

## 1. Executive Summary & Production Status

- **Status**: Code-complete, independently accepted across R1–R5, clean CI green, dual-artifact rehearsal verified with strict record assertions.
- **Production Safety Guarantee**: Zero writes, migrations, or role reassociations have been applied to live or development databases (`server/prisma/dev.db`).
- **PR Status**: PR [#129](https://github.com/yigini/soilfer-lims/pull/129) remains in **draft** status and will NOT be merged without explicit release authorization.
- **Running Production Runtime Inspection & Access Boundary**:
  - Probed live production host read-only via HTTP (`https://lims.yigini.net/api/health`): Process reports `status: "ok"`, `uptime: ~543352s` (~6.28 days continuous uptime, booted ~2026-09-15 15:10 UTC behind Apache/2 reverse proxy).
  - Client bundle inspection: Built production client script is `index-Y9YXWdSC.js`. String analysis indicates presence of commit `ec0bff1` code (token desync classification `[AUTH] Ignored 401 from stale request with superseded token`) and absence of candidate additions. However, **public asset bundle strings are only an operational clue, not definitive proof of an exact running commit or image digest**.
  - Deployment Access & Exact Blocker: Non-interactive SSH probe to `lims.yigini.net:22` (`46.19.33.37`) establishes TCP connection but fails authentication (`Permission denied (publickey,gssapi-keyex,gssapi-with-mic,password)`). Local Windows host has no active Docker engine (`//./pipe/dockerDesktopLinuxEngine` absent) and no VPS root/container access. Therefore, direct read-only identification of the running container image digest (`docker inspect`) cannot be performed from this workspace.
  - Operational Gate: Identifying and preserving the exact running rollback artifact on the production host is an operational prerequisite to be performed by server administrators during the authorized deployment window, without restarting the live server solely to prove identity.

---

## 2. Populated Upgrade, Dual-Artifact Boot & Rollback Rehearsal Evidence

The full rehearsal script was executed at [`release_rollback_rehearsal.cjs`](release_rollback_rehearsal.cjs). Raw captured output is preserved in [`rehearsal_output.log`](rehearsal_output.log).

### 2.1 Rehearsal Environment & Runtime Prerequisites
- **Node.js Runtime**: v20.x or v24.x (rehearsal verified on Node.js v24.13.0).
- **Prisma Schema Engine**: Uses local `@prisma/engines` schema engine binary from `server/node_modules`.
- **Isolated Baseline Worktree**: Must exist at `../soilfer-lims-baseline` checked out to `762c46e` with generated baseline Prisma client (`server/prisma_client`). Fails closed immediately if missing or if `git rev-parse HEAD` does not match `762c46e`.
- **Environment & Path Isolation**: Executes in a dedicated ephemeral subdirectory (`server/.tmp_rehearsal_*`) using forward-slash SQLite URLs (`file:...`) and isolated environment variables, eliminating root `prisma.config.ts` adapter path collisions.

### 2.2 Pre-Migration Checksums & Genuine Baseline Schema
The synthetic legacy database was initialized using the genuine baseline `762c46e` schema (extracted directly from `git show 762c46e:server/prisma/schema.prisma` in an isolated ephemeral directory, **not** simulated by column deletion). Baseline schema state was verified to contain zero additive Project columns and zero additive indices.

Pre-migration SHA256 hashes of populated table contents across all 9 domains:

```json
{
  "Lab": "a58f4613dbc300fbd8db0bd43d33ebb04e54f8f903208cc04971e09c3b9a8e62",
  "Project": "482e4c9f5cca1ff1e1cd3c1f1e10bb40fbf1ca315c421459e28dd228751c5b8b",
  "User": "179f724dfaf0674cc5aed3d36e9b114349fd10f75cd83d5bb4f8e441c5bd4b7f",
  "Sample": "71e8ccc91258f6861d32cd4a854a7f691621c28f9692b00e0acd5cdee441b935",
  "WorkItem": "289e5a86c4431c5a22aab1f11828299cf1a57fbcae10ee508a3146416c05d591",
  "Result": "8e0a35ce323d8966fb768f8c0015d75d3d50fbce897432453db943d676adccde",
  "Report": "923cdf4792d16d7301f121df973934d70c603a8b7e8276517dc8b3eecef5e3f9",
  "ReportShareLink": "1c29dbcd4242b5f22e9f80eb81bef6d79b22a9e46096375ad6e0dbf27f31f59f",
  "AuditLog": "23a9209a861e9efdc2714f7e1cf3c672048efd1e8d1c7390f0f1478377fa2a6c"
}
```

### 2.3 Baseline Application Artifact HTTP Startup (Pre-Migration)
- Verified baseline worktree HEAD commit strictly matches `762c46e` (fails closed if missing or mismatched).
- Booted baseline Express app (`762c46e`) in an isolated child process using its own baseline Prisma client against the baseline database.
- Executed real authenticated HTTP requests:
  - `GET /api/health` -> HTTP 200 (`{ status: "ok" }`)
  - `GET /api/projects` -> HTTP 200
  - `GET /api/reports/search` -> HTTP 200
- **Record Assertions PASSED**: Verified exactly 1 project returned with code `GTM-ALPHA` (additive `templateId` is null/absent); verified exactly 1 published report returned (`REP-001`).

### 2.4 SQLite Online Backup & WAL Checkpoint
- Checkpointed WAL to base file (`PRAGMA wal_checkpoint(TRUNCATE)`).
- Took SQLite online backup via `db.backup()`.
- Verified backup integrity: `PRAGMA integrity_check` returned `ok`, `PRAGMA foreign_key_check` returned 0 violations. Backup size: 909,312 bytes.

### 2.5 Additive DDL Application & 100% Byte Conservation
- Executed `migrateProjectTemplatesAndPolicy(liveDbPath, { dryRun: false })`.
- Result: `success: true, applied: true, addedColumns: ['templateId', 'templateVersion', 'policyConfig', 'programmeCode', 'parentProjectId'], createdIndex: true, totalProjects: 2`.
- Post-migration SHA256 hashes of all non-Project tables (`Lab`, `User`, `Sample`, `WorkItem`, `Result`, `Report`, `ReportShareLink`, `AuditLog`) matched pre-migration hashes byte-for-byte (100% conservation).
- Legacy SELECT query (`SELECT id, code, name, status, projectType FROM Project`) succeeded with 2 projects returned and zero errors.

### 2.6 Upgraded Application Artifact HTTP Startup (fe02e75)
- Booted upgraded Express app in an isolated child process against the upgraded database.
- Executed real authenticated HTTP requests:
  - `GET /api/health` -> HTTP 200
  - `GET /api/projects` -> HTTP 200
  - `GET /api/reports/search` -> HTTP 200
- **Record Assertions PASSED**: Verified 1 project returned with code `GTM-ALPHA` and migrated `templateId: "GENERIC_OPEN_INTAKE"`; verified 1 published report returned (`REP-001`).

### 2.7 Rollback Restore & WAL Sidecar Cleanup
- Cleanly deleted sidecar files (`soilfer_prod_sim.db-wal` and `soilfer_prod_sim.db-shm`) prior to file replacement to eliminate stale WAL replay corruption.
- Target database file was overwritten with the verified pre-migration backup snapshot.
- Post-restore verification:
  - Additive columns (`templateId`, `templateVersion`, `policyConfig`, `programmeCode`, `parentProjectId`) and index `Project_parentProjectId_idx` were confirmed absent.
  - SHA256 checksums across all 9 tables matched initial pre-migration checksums 100%.

### 2.8 Baseline Application Artifact HTTP Startup (Post-Rollback)
- Booted baseline Express app (`762c46e`) in an isolated child process against the rolled-back database.
- Executed real authenticated HTTP requests:
  - `GET /api/health` -> HTTP 200
  - `GET /api/projects` -> HTTP 200
  - `GET /api/reports/search` -> HTTP 200
- **Record Assertions PASSED**: Verified 1 project returned with code `GTM-ALPHA` (additive `templateId` confirmed absent/null); verified 1 published report returned (`REP-001`).

---

## 3. Production Deployment Runbook (Additive DDL Only)

### 3.1 Pre-Conditions & Write Quiescence
> [!CAUTION]
> **Write Quiescence is Mandatory**: Setting `DISABLE_BACKGROUND_JOBS=true` only stops internal background schedulers. It does **NOT** block incoming user/API write traffic. If write traffic is allowed during deployment, any subsequent database restoration will silently overwrite and destroy newly committed user transactions. Write traffic must be quiesced at the ingress proxy until the rollback decision gate is finalized.

1. **Quiesce Ingress Writes**:
   - Put reverse proxy / API gateway into Maintenance Mode (HTTP 503 / Read-Only).
   - Set `DISABLE_BACKGROUND_JOBS=true` in application environment.
2. **Flush WAL & Take Online Snapshot**:
   - Checkpoint WAL into main database:
     ```sql
     PRAGMA wal_checkpoint(TRUNCATE);
     ```
   - Execute SQLite Online Backup to a timestamped backup directory (e.g., `backups/soilfer_pre_fe02e75_<timestamp>.db`).
   - Verify backup integrity:
     ```sql
     PRAGMA integrity_check;
     PRAGMA foreign_key_check;
     ```
     Ensure output is strictly `ok` and zero foreign key violations.

### 3.2 Additive Schema Migration Runner
1. **Execute Dry-Run**:
   ```bash
   node server/scripts/migrate_project_templates_and_policy.js --dry-run
   ```
   - Verify stdout: `applied: false`, `needsMigration: true`.
   - Verify SHA256 of database file and `sqlite_master` is strictly unmodified (zero writes).
2. **Execute Apply**:
   ```bash
   node server/scripts/migrate_project_templates_and_policy.js
   ```
   - Verify transaction commits atomically: 5 columns added with default values, 1 index created.
   - Internal `PRAGMA foreign_key_check("Project")` passes inside transaction prior to commit.

### 3.3 Deploy Application Artifact
1. Start application service from container/artifact `fe02e7589205bb6a8d085b93be573982f13ec45d`.
2. Keep public write traffic blocked while performing postflight verification.

### 3.4 Rollback Contingency (Before Resuming Public Writes)
If postflight verification fails prior to reopening public writes:
1. Stop application service immediately.
2. Ensure no handles hold database locks.
3. Cleanly delete any existing `.db-wal` and `.db-shm` sidecar files in the database directory.
4. Overwrite database file with the verified pre-upgrade snapshot file (`soilfer_pre_fe02e75_<timestamp>.db`).
5. Run `PRAGMA integrity_check;` on the restored database.
6. Start the baseline application artifact (`762c46e`).
7. Once public writes have resumed, **NEVER blindly restore an old database snapshot**. Any post-release issue after write resumption must be remediated forward via a hotfix.

---

## 4. Proposed Post-Deploy Read-Only Verification Route Protocol (Checklist)

> [!NOTE]
> The endpoints below represent the proposed post-deployment read-only verification checklist. All routes have been validated against actual Express router declarations in `server/routes/*.js` and `server/app.js`. This checklist is **not** executed against the live production environment during rehearsals.

| Role | Validated Endpoint | Router File | Expected Result |
|---|---|---|---|
| **`SUPER_ADMIN`** | `GET /api/users` | `routes/userRoutes.js` | HTTP 200 (system user directory; requires `MANAGE_USERS`) |
| **`SUPER_ADMIN`** | `GET /api/labs` | `routes/labRoutes.js` | HTTP 200 (global lab directory with aggregate stats) |
| **`LAB_MANAGER`** | `GET /api/dashboard/live` | `routes/dashboardRoutes.js` | HTTP 200 (live KPIs and queue badges) |
| **`LAB_MANAGER`** | `GET /api/dashboard/queues/manager.exceptions` | `routes/dashboardRoutes.js` | HTTP 200 (unresolved QC exceptions queue) |
| **`LAB_MANAGER`** | `GET /api/qc/batches` | `routes/qcRoutes.js` | HTTP 200 (QC batch list; requires auth) |
| **`LAB_MANAGER`** | `GET /api/submissions` | `routes/submissionRoutes.js` | HTTP 200 (manager review queue) |
| **`LAB_TECHNICIAN`** | `GET /api/work` | `routes/workRoutes.js` | HTTP 200 (assigned tasks; cross-lab items excluded) |
| **`LAB_TECHNICIAN`** | `GET /api/workbench/queue` | `routes/workbenchRoutes.js` | HTTP 200 (workbench queue; stale assignments excluded) |
| **`LAB_TECHNICIAN`** | `GET /api/reports/search` | `routes/reportRoutes.js` | HTTP 200 (returns only reports for samples in technician's lab) |
| **`SAMPLE_RECEPTION`** | `GET /api/samples` | `routes/sampleRoutes.js` | HTTP 200 (intake samples list; requires `VIEW_SAMPLES`) |
| **`SAMPLE_RECEPTION`** | `GET /api/reception/admin-units` | `routes/receptionRoutes.js` | HTTP 200 (administrative unit hierarchy picker) |
| **`SAMPLE_RECEPTION`** | `GET /api/reception/consignments` | `routes/receptionRoutes.js` | HTTP 200 (consignment delivery records) |
| **`MASTER_USER` (National)** | `GET /api/reports/search` | `routes/reportRoutes.js` | HTTP 200 (scoped strictly to national coordinator's country) |
| **`MASTER_USER` (National)** | `GET /api/reports/:foreignId` | `routes/reportRoutes.js` | HTTP 403 (out-of-scope report detail forbidden) |
| **`PROJECT_MANAGER`** | `GET /api/projects/:id` | `routes/projectRoutes.js` | HTTP 200 (authorized project metadata loads) |
| **`PROJECT_MANAGER`** | `GET /api/reports/search` | `routes/reportRoutes.js` | HTTP 200 (scoped strictly to assigned project) |
| **`PUBLIC` / External** | `GET /api/reports/public/:token` | `routes/reportRoutes.js` | HTTP 200 with valid share token; HTTP 404 otherwise |

---

## 5. Issue Evidence Matrix & Linkage

| Issue | Title / Core Scope | Fix Status | Verification Evidence Link |
|---|---|---|---|
| **WP-2** | Country / Kobo v2 policy & exception binding | Fixed | `project_policy_v2.test.js` (26/26), `soilfer_country_migration.test.js` (3/3), [`EVIDENCE.md`](EVIDENCE.md) Phase 0 |
| **#118** | QC batch inspection & disposition gates | Fixed | `qc_disposition_release_gate.test.js` (20/20), [`EVIDENCE.md`](EVIDENCE.md) Phase 1 |
| **#119** | Sample identity & honest 26-task pagination | Fixed | `sample_assignment_identity.test.js` (8/8), [`EVIDENCE.md`](EVIDENCE.md) Phase 1 |
| **#121** | Dual thermal label printing & offline QR portal | Fixed | `label_print.test.js` (5/5), CDP browser evidence, [`EVIDENCE.md`](EVIDENCE.md) Phase 2 |
| **#122** | Lab method defaults scoping & cross-lab denial | Fixed | `lab_method_defaults.test.js` (6/6), [`EVIDENCE.md`](EVIDENCE.md) Phase 2 |
| **#128** | Workbench deep links & central auth precedence | Fixed | `workbench_deep_link.test.js` (13/13), [`EVIDENCE.md`](EVIDENCE.md) Phase 2 |
| **#123** | Multi-field queue search & empty states | Fixed | `workbench_search.test.js` (8/8), [`EVIDENCE.md`](EVIDENCE.md) Phase 2 |
| **#124** | Result reports search & superseded versions | Fixed | `report_search.test.js` (7/7), `candidate_release_review_fixes.test.js` (R1 tests), [`EVIDENCE.md`](EVIDENCE.md) Phase 2 |
| **#125** | Pure inventory stock aggregation & subtotal badge | Fixed | `inventory_aggregation.test.js` (12/12), [`EVIDENCE.md`](EVIDENCE.md) Phase 3 |
| **#117** | Reception compliance checklist & TDZ fix | Fixed | `reception_compliance.test.js` (18/18), CDP browser journey (6/6), [`EVIDENCE.md`](EVIDENCE.md) Phase 3 |
| **#113** | Upfront compliance evaluation & CoC N/A rules | Fixed | `reception_compliance.test.js` (18/18), [`EVIDENCE.md`](EVIDENCE.md) Phase 3 |
| **#120** | Separation of daily queue vs field registry | Fixed | `dashboard_manager_views.test.js` (7/7), [`EVIDENCE.md`](EVIDENCE.md) Phase 4 |
| **#114** | Sourced lab coordinates & Leaflet fullscreen | Fixed | `map_view.test.js` (16/16), [`EVIDENCE.md`](EVIDENCE.md) Phase 4 |
| **#115** | Canonical laboratory navigation sequence | Fixed | `navigation_order.test.js` (5/5), [`client/src/navigationConfig.js`](../../client/src/navigationConfig.js) |
| **#116** | Full 5-locale UI translation & badge localization | Fixed | `localization_and_user_display.test.js` (13/13), [`EVIDENCE.md`](EVIDENCE.md) Phase 4 |
| **#126** | User display names with username fallback | Fixed | `localization_and_user_display.test.js` (12/12), [`EVIDENCE.md`](EVIDENCE.md) Phase 4 |
| **R1–R5** | Candidate retest remediation suite | Fixed | `candidate_release_review_fixes.test.js` (26/26), `independent-release-retest-fe02e75.json` (13/13) |

---

## 6. Distinction of Remaining Non-Code / Governance Items

The following three tracks remain open governance/field gates and do NOT block code release candidate readiness:

1. **#102 Physical Mobile Device Testing**:
   - **Type**: Field Hardware Gate (iOS Safari / Android Chrome).
   - **Status**: Open.
   - **Artifact**: Mobile execution test sheet ready at [`docs/test-sheets/mobile-device-testing.md`](../../docs/test-sheets/mobile-device-testing.md).
   - **Requirement**: Validation on physical touch devices upon deployment to a target staging environment.
2. **#103 User Membership Reconciliation**:
   - **Type**: Governance Policy Gate.
   - **Status**: Open.
   - **Artifact**: Discrepancy ledger established at [`docs/governance/membership-reconciliation-ledger.md`](../../docs/governance/membership-reconciliation-ledger.md).
   - **Requirement**: Production database remains strictly untouched; manual assignment reconciliation requires Country Coordinator sign-off before unholding.
3. **#104 External Dashboard Reconciliation**:
   - **Type**: External Coordination Gate.
   - **Status**: Open.
   - **Artifact**: Framework established at [`docs/governance/external-dashboard-reconciliation.md`](../../docs/governance/external-dashboard-reconciliation.md).
   - **Requirement**: Clarification from external reporter (Luis) regarding external dashboard ingestion architecture.

---

## 7. Concrete Release Recommendation

> [!IMPORTANT]
> **Production Release Readiness Boundary**: Technical release criteria for candidate code `fe02e7589205bb6a8d085b93be573982f13ec45d` are fully satisfied and rehearsed in an isolated worktree environment (including dual-artifact baseline `762c46e` startup and candidate `fe02e75` startup with strict record assertions). However, **mandatory operational release readiness is NOT complete while baseline application startup on the actual production host environment remains UNVERIFIED**. Direct host container image verification on the production VPS and staging dry-run validation remain external deployment prerequisites.

- **Tested Candidate Code Commit**: `fe02e7589205bb6a8d085b93be573982f13ec45d` (PR #129 code base).
- **Draft PR Status**: PR [#129](https://github.com/yigini/soilfer-lims/pull/129) remains held in **draft** status and must NOT be merged without an approved deployment maintenance window.
- **Production Hold Active**: Zero production database mutations, schema pushes, merges to `main`, or live deployments have been executed.
