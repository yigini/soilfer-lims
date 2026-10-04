## Summary
Implements comprehensive single-lab and multi-lab deployment readiness hardening across all five assigned work packages and addresses all findings from Codex's independent reviews through commit `c8a718a`.

A tracked status page and user-friendly operator guide is established at [`docs/DEPLOYMENT_READINESS.md`](docs/DEPLOYMENT_READINESS.md), providing plain-language explanations of operating modes, prerequisites, setup procedures, and a live tracking ledger.

## Work Packages Delivered

### 1. Reliable Fresh Installation & Partial Resumption in Both Modes
- **Prisma 7 Compatibility**: Removed unsupported `--skip-generate` flag from `setup.sh` and rehearsal scripts.
- **Fail-Fast Error Handling**: Removed `|| true` and error suppression in `setup.sh`; halts with meaningful guidance if database initialization fails.
- **Fail-Closed Container Database Inspection**: `docker-entrypoint.sh` inspects existing SQLite databases using parameterized queries (`better-sqlite3`), halts startup with non-zero exit code if database is corrupt or unreadable, and preserves WAL mode recovery on uncheckpointed restarts.
- **Empty-Volume Container Bootstrap**: Automatically detects fresh empty SQLite volumes (`[ ! -s prisma/dev.db ]`), pushes baseline schema, and seeds the initial administrator before executing versioned migrations.
- **Resumable Partial Seed Recovery**: If an interrupted first-seed run leaves `LAB01` created without any user records, `seed.js` detects and reuses `LAB01`, attaches the administrator cleanly, touches `.seed_complete`, and eliminates duplicate key crashes.
- **Data Preservation Invariant**: For existing populated installations, unconditional schema push and reseeding are safely skipped, preserving all existing user accounts, samples, and analytical results untouched.

### 2. Consistent Configuration, Modes & Provision CLI Protection
- **Proxy/TLS Decoupling**: Extracted NGINX reverse-proxy configuration into `docker-compose.nginx.yml`, resolving the conflict where `INSTALL.md` previously instructed single-lab users to run `docker-compose.global.yml`.
- **Fail-Closed Secret Generation & Persistence**: `docker-entrypoint.sh` auto-generates a secure 64-byte random hex secret and persists it to `prisma/.jwt_secret`, ensuring tokens remain valid across container restarts.
- **Initial Password Alignment**: Added `"seed": "node seed.js"` script to `server/package.json`. Updated `server/seed.js` to load `.env` CWD-independently before reading `ADMIN_INITIAL_PASSWORD`. Corrected `setup.sh` completion notice to eliminate confusing `admin / password` references.
- **Provision CLI Identity Collision Protection**: `server/scripts/provision_super_admin.js` strictly decouples username and email lookups, verifies non-colliding credentials prior to any mutation, rejects conflicting email assignments with exit code 1 without mutating unrelated accounts, preserves inactive status unless `--activate` is specified, and revokes active JWT sessions via `tokenVersion`.

### 3. Supported Runtime, Dependency Security & Upload Safeguards
- **Node.js 24 LTS Standard**: Upgraded `Dockerfile` (`node:24-alpine`) and GitHub Actions CI workflow to Node.js 24 LTS. Enforced supported Node.js range (v24 LTS, v22.12+, v20.19+) in `setup.sh`.
- **Dependency Updates**: Bumped direct server dependencies (`ws` to `^8.22.0`, `uuid` to `^13.0.1`) and client dependency (`react-router-dom` to `^6.30.6`).
- **File Upload Safeguards**: Added pre-parser file size validation (`MAX_FILE_SIZE = 5 MB`) and MIME/extension verification in `client/src/components/reception/ManifestImportModal.jsx` before invoking `XLSX.read()`.
- **Audit & Mitigation Triage**: Documented defensive application bounds for SheetJS (`xlsx`) with path-specific limits for Manifest import (5 MB, `.xlsx`/`.xls`, MIME guard) vs Project import (5 MB, accept hint, 2000-row cap); documented decompressed memory complexity vs raw upload size; scheduled tracked migration `MAINT-DEP-155` for `exceljs` in next minor cycle.

### 4. Safe Operator Upgrade, Backup & Recovery Procedures (`docs/UPGRADING.md`)
- **Baseline Image Identity Verification**: Bound `BASELINE_IMAGE_ID` to `{{.Image}}` and verified image existence with `docker image inspect` *before* stopping the writer container, preventing container hash confusion and controlled exit 125.
- **Robust Backup Artifact Binding**: Updated extraction regex to `(soilfer_lims_backup_|backup_)[^ ')]+\.db\.gz`, matching real CLI ISO-dated filenames and legacy formats with SHA-256 integrity binding.
- **Staged Route B Disaster Recovery**: Archives unpack to `/backup/staging/db` and `/backup/staging/assets` first; validates SQLite `PRAGMA integrity_check` before modifying target volumes; aborts fail-closed on corrupt archives leaving target volume 100% untouched.
- **Unsuppressed Safety Preservation & Sequential Volume Replacement**: Captures full pre-restore snapshots of `/data/.` (including dotfiles `.jwt_secret`, `.seed_complete`, WAL, SHM) and `/assets/.` with `set -e`. Replaced error-swallowing `rm` with `find /data -mindepth 1 -delete` and `find /assets -mindepth 1 -delete`, failing closed on genuine filesystem removal errors, preventing errors on `.`/`..`, and correctly restoring empty assets snapshots.
- **Rollback Bound to Immutable Baseline Image ID**: Explicitly tags and launches recorded `BASELINE_IMAGE_ID` with Compose context, verifying running container image matches before reopening traffic. Retained invariant against restoring old DB after new writes without reconciliation.
- **Eliminated Guessed Fallbacks & Expanded Postflight**: Removed guessed-volume and `:latest` fallbacks; postflight gates verify image ID, mounts, HTTP 200 health, deployment mode, background escalation scheduler initialization log, database user/lab records, and conditional reverse proxy ingress (`.State.Running === "true"`).

### 5. Acceptance Verification & Evidence
- **Automated Contract Tests (31/31 passed)**:
  - `server/tests/contracts/deployment_readiness_acceptance.test.js` (21 tests): Forced initial password change, single-lab role scoping, multi-lab cross-facility isolation, stopped-writer restore with epoch rotation, concurrent multi-lab request processing, and provision CLI identity collision protection.
  - `server/tests/contracts/deployment_readiness_bootstrap.test.js` (10 tests): `setup.sh` mode validation, Node 18 rejection, fail-fast schema push, `.env` secret auto-population, JWT secret container persistence, container restart resumption, fail-closed SQLite inspection on corrupt DB, valid DB inspection, partial seed recovery ({labs: 1, users: 0}), and Compose overlay validation.
- **Full Server Test Suite**: 148 passed out of 148 total test suites (1,446 tests passed, 0 failed).
- **Client Build**: Built production bundle with Vite in 6.89s with zero errors (2,659 modules transformed).
- **Real Disposable Docker Acceptance Suite (`server/scripts/rehearsal_deployment_readiness.cjs`)**:
  - CI step running across 6 comprehensive scenarios:
    1. Scenario 1: Default entrypoint empty-volume local mode first-start, mandatory initial password change, and clean shutdown.
    2. Scenario 2: Container restart on same volume, pre-restart JWT token validation without re-login, secret byte-for-byte persistence check, and no-reseed check.
    3. Scenario 3: Interrupted-init (partial seed recovery) in Docker resuming `{ labs: 1, users: 0 }` without LAB01 conflict.
    4. Scenario 4: Default entrypoint empty-volume global mode first-start and SUPER_ADMIN coordination.
    5. Scenario 5: Multi-lab workload (concurrent two-lab sample intake across Lab Alpha & Beta via `Promise.all`), real data export `POST /api/exports/data` (`{ type: 'REGISTER' }`) verifying role-based multi-lab isolation via `Sample ID` and `Lab ID` scoping (5 Alpha, 5 Beta, 10 Super Admin, foreign rows rejected), background escalation scheduler initialization check, and safe writer quiescence before offline backup generation with exact table count verification (3 users, 2 labs, 10 samples).
    6. Scenario 6: Genuine supported baseline upgrade (`soilfer-lims:baseline-v3.5.30` built from verified pinned tree `48d0e52`), baseline boot and pre-upgrade operational token validation, asset file preservation, Route B tarballs, corrupt archive fail-closed abort check (verifying target volume is untouched), target upgrade verification (pre-upgrade token persistence, credentials, exact 10 sample codes `BASE-SMP-001`..`010`, assigned labs, statuses, asset preservation), staged Route B recovery, epoch cursor invalidation asserting `EPOCH_MISMATCH`, and rollback container launch explicitly bound to `baselineImageId` with full post-rollback validation (all 3 user logins, 10 samples, assigned labs, statuses, asset bytes).
- **CI Verification**: GitHub Actions CI run `36636364203` passed completely across all 13 steps in 8m29s. Full CI log saved to `work/issue154-ci-36636364203.log`.

## Release & Deployment State
- **Current Status**: Corrected and verified in branch `feat/deployment-readiness` (Commit: `45d345da49fe2d13b66b9c0179485e0c9fa19eac`).
- **Live Status**: **NOT YET LIVE ON PRODUCTION**. Standing by for independent Codex review and established CI release gates.
