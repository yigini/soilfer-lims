# SoilFER-LIMS Deployment Readiness Status & Operator Guide

> **Current Status:** In Progress (Branch: `feat/deployment-readiness`)  
> **Last Updated:** 29 September 2026  
> **Target Reviewed Baseline:** `61e8900f8f5078383cc8585195ca4ec98a734c5d`  
> **Audit References:** `Codex Deployment Readiness Review (2026-09-29)`, `PR154 Independent Review (2026-09-29)`, and `PR154 Follow-up Review (2026-09-29)`

---

## 1. Overview for Laboratory Operators

SoilFER-LIMS is designed to run reliably in two operating modes:
1. **Single Laboratory (`local` mode):** For an individual soil laboratory. Upon installation, it provisions your laboratory record and an initial `LAB_MANAGER` administrator account. The manager can configure the lab, onboard technicians, register samples, and process analytical batches.
2. **Multiple Laboratories (`global` mode):** For national agricultural institutes or laboratory networks coordinating several facilities. It provisions a central `SUPER_ADMIN` account who can create new laboratories, activate them, assign laboratory managers, and oversee cross-facility operations.

### Current System Health Summary
- **What Works:** Basic onboarding, initial login, forced password change, single-lab technician/project management, and multi-lab data isolation operate cleanly (verified by 38 independent audit probe assertions and 30 automated contract tests).
- **What Was Done & Fixed:**
  - `setup.sh` no longer crashes on Prisma 7 flags or swallows database push errors.
  - Docker entrypoint persists auto-generated JWT secrets across container restarts (`prisma/.jwt_secret`).
  - Container first-boot is fully resumable and fail-closed: if seed fails, it retries on restart; once seeded or populated with users, existing accounts are protected from reseeding. Inspection halts safely if SQLite is unreadable or corrupt.
  - Real partial seed recovery: if an interrupted initial setup leaves `LAB01` present without users, `seed.js` detects and reuses `LAB01`, successfully creates the admin account, and avoids duplicate key crashes.
  - `provision_super_admin.js` prevents identity collisions: checks username and email targets strictly before mutation; rejects colliding combinations without touching unrelated inactive accounts; preserves inactive state; and revokes active sessions via `tokenVersion`.
  - Docker Compose cleanly separates NGINX (`docker-compose.nginx.yml`) from deployment mode (`docker-compose.global.yml`).
  - Database restore fails closed if SQL triggers or epoch rotations fail, preserving safety snapshots of database and WAL/SHM sidecars.
  - Upgrading guide (`docs/UPGRADING.md`) reconciles live container mount discovery, immutable image IDs, bound backup artifacts with SHA-256 hashes, non-destructive tarball staging, and bounded postflight gates.
  - Added real isolated Docker default-entrypoint deployment readiness rehearsal (`server/scripts/rehearsal_deployment_readiness.cjs`) executed in GitHub Actions CI across empty-volume boots, restarts, partial-inits, and backup/restore round trips.
  - Production dependency vulnerabilities were reduced to 4 in server (all high, strictly Prisma 7 tooling transitives) and 3 in client (2 moderate in react-router v6, 1 high in xlsx), with zero critical vulnerabilities.
- **What Was Tested:** 30 contract tests across bootstrap, fail-closed SQLite inspection, secret stability, real partial-seed recovery, provision CLI collision rejection, role scoping, fail-closed restore with SQL triggers, and concurrent multi-lab sample intake and queries. Full backend test suites pass (148/148 suites, 1,440 tests). Frontend production build passed cleanly via Vite in 27.11s.
- **What Remains:** Independent Codex review of the updated commit candidate on PR #154, merge to `main`, and production safe-release verification.
- **Availability & Live Status:** These fixes are currently implemented on branch `feat/deployment-readiness` (in PR #154). **THEY ARE NOT YET LIVE ON THE PRODUCTION SERVER.** The running production environment remains untouched.

---

## 2. Progress & Resolution Tracking Ledger

Status lifecycle stages:
- `Planned`: Scoped and documented.
- `In progress`: Active implementation underway.
- `Fixed in branch`: Implemented on branch `feat/deployment-readiness` and verified locally.
- `Independently verified`: Independently reviewed and validated by Codex.
- `Merged`: Merged into canonical `main`.
- `Deployed`: Live on the production server.

| # | Problem | Effect on Users | Change Made | Current Status | Tests | Remaining Work |
|---|---|---|---|---|---|---|
| **P1** | `setup.sh` used removed Prisma 7 flag `--skip-generate` | Fresh installation via `./setup.sh` crashed during database setup | Removed `--skip-generate` flag; Prisma 7 handles generation via `prisma.config.ts` | **Fixed in branch** | Tested CLI schema push in isolated disposable checkout | Review & merge |
| **P2** | `setup.sh` suppressed DB push errors with `\|\| true` | Script printed "Database ready" even when the database failed to initialize | Removed error swallowing; script aborts immediately with guidance | **Fixed in branch** | Verified non-zero exit on deliberate failure | Review & merge |
| **P3** | Interrupted initial Docker boot could skip seed; blank JWT changed on restart | Incomplete first-start left empty unseeded database; restart invalidated auth tokens | Auto-generated JWT secret is saved to `prisma/.jwt_secret`; entrypoint detects incomplete setups and safely retries seed without touching populated databases | **Fixed in branch** | Verified secret stability across restarts; verified recovery after simulated seed failure (exit 77) | Container CI validation |
| **P4** | Blank `JWT_SECRET` in `.env.example` caused Compose error; missing `ADMIN_INITIAL_PASSWORD` forwarding | Users copying `.env.example` saw errors; `.env` initial password was not passed to container | Compose accepts empty secret for entrypoint auto-generation; forwards `ADMIN_INITIAL_PASSWORD` | **Fixed in branch** | Validated Compose configuration with blank and configured variables | Review & merge |
| **P5** | `INSTALL.md` and guides suggested `docker-compose.global.yml` for single-lab NGINX | Single-lab users setting up NGINX were inadvertently forced into `global` multi-lab mode | Decoupled NGINX proxy into `docker-compose.nginx.yml`; updated all guide commands | **Fixed in branch** | Verified compose configurations for local, global, and local+nginx | Review & merge |
| **P6** | `setup.sh` printed incorrect login password `admin / password` | Users could not log in because the seed generated a random one-time password | `setup.sh` and docs now clearly direct operators to the generated one-time credentials | **Fixed in branch** | Traced setup shell output | Review & merge |
| **P7** | `server/package.json` had no `npm run seed` command | Users following README manual instructions failed with `missing script: seed` | Added `"seed": "node seed.js"` and `"provision:admin"` to `server/package.json` | **Fixed in branch** | Ran scripts in clean environment | CI test |
| **P8** | `server/seed.js` did not load `.env` variables | Custom `ADMIN_INITIAL_PASSWORD` or `DEPLOYMENT_MODE` in `.env` were ignored during seeding | Added CWD-independent dotenv loading at top of `server/seed.js` | **Fixed in branch** | Verified custom seed password read from root `.env` | Multi-CWD test |
| **P9** | Dockerfile and CI ran Node.js 20 (now EOL); setup allowed Node 18 | Unsupported runtime risks and native addon linking failures | Standardized Dockerfile and CI on Node.js 24 LTS; setup.sh requires Node 24 LTS or Node 22 LTS (22.12+) | **Fixed in branch** | Verified Node 18 and Node 20 rejection; verified Node 24 builds | CI workflow validation |
| **P10** | Single-lab operators lacked supported path for API administration | Seeded `LAB_MANAGER` is denied SIS API credentials; operators lacked an official path to provision `SUPER_ADMIN` | Created `server/scripts/provision_super_admin.js` (`npm run provision:admin`) for host-console provisioning without widening UI permissions | **Fixed in branch** | Tested CLI provisioning and elevation | Review & merge |
| **P11** | Production dependency security advisories | Potential vulnerability notices in automated package scanners | Resolved direct safe dependencies via semver updates; production vulnerabilities reduced to 4 in server (Prisma 7 tooling transitives) and 3 in client (react-router v6, xlsx) | **Fixed in branch** | Ran `npm audit --omit=dev`; verified client Vite production build in 27.11s | Upstream package tracking |
| **P12** | Database restore swallowed SQL trigger/epoch rotation errors and risked sidecar loss | Controlled trigger failures still reported SUCCESS; WAL/SHM sidecars were unlinked without snapshots | `restore_db.js` preserves target and WAL/SHM sidecars as recovery artifacts (`.bak`); fails closed (exit 1) on SQL epoch rotation errors | **Fixed in branch** | Verified exit 1 and failure report when SQL trigger aborts epoch update | Review & merge |
| **P13** | Documentation lacked volume identity discovery and archive round-trip parity | Mismatched `.tar.gz` vs `.db.gz` instructions; hardcoded volume names risk creating empty volumes | `UPGRADING.md` rewritten with live container mount discovery, verified `.tar.gz` and `.db.gz` round trips, immutable image IDs, and postflight gates | **Fixed in branch** | Reconciled README, INSTALL, DEPLOYMENT_GUIDE, and UPGRADING | Review & merge |
| **P14** | Partial initial seed leaving `LAB01` crashed retry with unique-code conflict | Interrupted setup could not be resumed without manual database intervention | `seed.js` checks if `LAB01` exists; if present without users, reuses its ID and completes user seeding | **Fixed in branch** | Tested exact SQL trigger user-insert abort and subsequent retry | Review & merge |
| **P15** | Docker entrypoint SQLite inspection converted query errors to 0 users (fail-open) | Unreadable or corrupt database could trigger unintentional schema push or seeding | Inspection in `docker-entrypoint.sh` fails closed with code 1 upon any SQLite error or unreadable state | **Fixed in branch** | Verified exit 1 and fatal error on corrupt database header | Review & merge |
| **P16** | `provision_super_admin.js` matched `OR: [{ username }, { email }]`, risking account hijacking | Requesting a new username matching an existing user's default email altered the existing account | Strict target lookup, collision rejection before mutation, inactive status preservation, session revocation | **Fixed in branch** | Verified collision rejection, inactive preservation, and tokenVersion increment | Review & merge |
| **P17** | Lack of default-entrypoint Docker acceptance testing in CI | CI boundary rehearsal overrode entrypoint with synthetic runner; default boot was unverified | Created `server/scripts/rehearsal_deployment_readiness.cjs` testing default entrypoint on empty volumes in CI | **Fixed in branch** | Automated CI suite with real HTTP fetch against local/global/restored containers | Remote CI run |
| **P18** | Route B full-tarball restore deleted target data before checking archive validity | Corrupt archive could wipe out existing database without recovery | Staged and verified archive before extraction; created pre-restore safety snapshot of volume contents | **Fixed in branch** | Runbook validation and procedure verification | Review & merge |

---

## 3. Production Dependency Security Triage & Mitigations

An independent audit using `npm audit --omit=dev` confirms:
- **Server:** 4 high severity advisories (0 critical).
- **Client:** 3 advisories (2 moderate, 1 high, 0 critical).

### Server Advisories (4 High — All Prisma 7 CLI & Tooling Transitives)
- **Affected Packages:** `@prisma/config`, `deepmerge-ts`, `mysql2`, `prisma`.
- **Actual LIMS Usage:**
  - SoilFER-LIMS uses **SQLite** via `better-sqlite3` and the Prisma Client runtime.
  - `mysql2` is pulled transitively by Prisma CLI tooling adapters and is never invoked by LIMS runtime code.
  - `deepmerge-ts` and `@prisma/config` are build-time configuration helpers used during `prisma generate` and `prisma db push`.
- **Mitigation & Risk Assessment:**
  - Prisma CLI tooling is never exposed to untrusted external input or HTTP request endpoints at runtime.
  - No MySQL connections or drivers are configured or accessible.
  - Direct downgrade of Prisma is rejected to avoid breaking Prisma 7 schema-engine contracts. Tracked for upcoming Prisma patch updates.

### Client Advisories (2 Moderate, 1 High — 0 Critical)
- **Affected Packages:** `react-router` / `react-router-dom` v6 (2 moderate), `xlsx` v0.18.5 (1 high).
- **Actual LIMS Usage:**
  - `react-router-dom` v6 provides client-side SPA routing inside the browser. Parameter parsing is guarded by strict TypeScript types and client-side page layout guards. No SSR or server-side hydration is performed.
  - `xlsx` (SheetJS) is used strictly in laboratory bulk import views for reading `.xlsx` spreadsheets client-side.
- **Mitigation & Risk Assessment:**
  - Spreadsheet parsing is bounded by file size upload limits, explicit MIME-type checks, and try/catch boundaries that display validation errors directly to the technician.
  - `jspdf` critical advisory was resolved cleanly via semver update without breaking analytical report generation.

---

## 4. Installation & Getting Started Guides

### Prerequisites
- **Operating System:** Linux (Ubuntu 22.04 / 24.04 recommended), macOS, or Windows (WSL2).
- **Node.js Runtime:** Node.js 24 LTS is recommended (Node.js 22 LTS v22.12+ supported). Node.js 20 and 18 are EOL and rejected.
- **Hardware:** Minimum 2 CPU cores, 2 GB RAM (3 GB recommended for Docker), 10 GB free disk space.
- **Ports:** Port 3000 (direct application port) or Port 80/443 if using NGINX reverse proxy.

---

### Path A: Single-Laboratory Deployment (`local` mode)

*Use this path if you are setting up SoilFER-LIMS for a single laboratory facility.*

#### Step 1: Clone the Repository & Configure Environment
```bash
git clone https://github.com/yigini/soilfer-lims.git
cd soilfer-lims

# Copy sample configuration
cp .env.example .env
```

Open `.env` in a text editor:
```bash
PORT=3000
NODE_ENV=production
DEPLOYMENT_MODE=local

# Security Secret: Leave blank to auto-generate and persist on first boot, or generate now:
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=

# Optional: pre-configure the initial admin password (otherwise randomly generated):
# ADMIN_INITIAL_PASSWORD=
```

#### Step 2A: Direct Node.js Installation
```bash
chmod +x setup.sh
./setup.sh local

# Start the application server:
npm start
# (Or: cd server && NODE_ENV=production node index.js)
```

#### Step 2B: Docker Compose Installation
```bash
# Option 1: With NGINX Reverse Proxy (Ports 80/443 — Recommended):
docker compose -f docker-compose.yml -f docker-compose.nginx.yml up -d

# Option 2: Direct Port 3000 (No NGINX):
docker compose up -d

# View initial administrator credentials:
docker compose logs lims | grep -A 4 "INITIAL ADMIN CREDENTIALS"
```

#### Step 3: First Login & Mandatory Password Change
1. Open your browser to: `http://<your-server-ip>:3000` (or `http://<your-server-ip>` if using NGINX).
2. Log in with:
   - **Username:** `admin`
   - **Password:** `<The initial password printed during Step 2>`
3. **Mandatory Security Step:** The system will prompt you to set a new password on first login.
4. **Next Steps:** As `LAB_MANAGER`, configure your laboratory in **Settings**, set up analytical methods in **Methods**, and invite technicians in **Staff**.

#### Single-Lab API & Integration Administration
In single-lab mode, the seeded `LAB_MANAGER` account manages all lab operations (samples, methods, QC, inventory, reporting), but is restricted from managing system-wide external API keys (`/api/sis-keys`). If external integrations (such as GloSIS or OpenNSIS data exchange) are required:
```bash
# Provision a designated SUPER_ADMIN credential from the host console:
cd /opt/soilfer-lims/server
npm run provision:admin -- --username sysadmin --email sysadmin@soilfer-lims.local
```
Log in as `sysadmin` to configure API connections without broadening normal laboratory managers' permissions.

---

### Path B: Multi-Laboratory Network Deployment (`global` mode)

*Use this path if you are a national agricultural ministry or institute coordinating several laboratories.*

#### Step 1: Configure Environment for Global Mode
In your `.env` file:
```bash
PORT=3000
NODE_ENV=production
DEPLOYMENT_MODE=global
JWT_SECRET=
```

#### Step 2: Launch the System
```bash
# With NGINX (Ports 80/443):
docker compose -f docker-compose.yml -f docker-compose.global.yml -f docker-compose.nginx.yml up -d

# Or direct Node.js:
./setup.sh global
npm start
```

#### Step 3: First Login as System Administrator & Laboratory Activation
1. Navigate to: `http://<your-server-ip>` (or port 3000).
2. Log in with username `admin` (Role: `SUPER_ADMIN`) and your initial password.
3. Change your password upon prompt.
4. **Provision and Activate Participating Laboratories:**
   - Go to **Admin → Laboratories**.
   - Click **Add Laboratory** to configure each facility (name, code, country).
   - **Important Activation Step:** Newly created laboratories must be **Activated** (`Active: Yes`) before laboratory staff can accept samples or register batches.
   - Create a `LAB_MANAGER` account for each laboratory. Each manager logs into their own facility with complete data isolation.

---

## 5. Technical Evidence & Verification Log

- **Automated Contract Tests:**
  - `server/tests/contracts/deployment_readiness_acceptance.test.js` (21 tests passed): Verifies initial password change, role boundaries, cross-lab isolation, fail-closed restore with SQL trigger aborts, concurrent multi-lab sample intake/queries, and `provision_super_admin` identity collision rejection, inactive preservation, and session revocation.
  - `server/tests/contracts/deployment_readiness_bootstrap.test.js` (9 tests passed): Verifies mode validation, Node 18/20 rejection, fail-fast schema push, JWT auto-population, entrypoint secret persistence across restarts, fail-closed SQLite database inspection, real partial seed recovery without duplicate code conflict, and strict Compose config validation.
- **Docker Deployment Readiness Rehearsal (`server/scripts/rehearsal_deployment_readiness.cjs`):**
  - Scenario 1: Default entrypoint empty-volume local mode installation, HTTP health, admin login, and password change.
  - Scenario 2: Container restart on same volume — persistent JWT secret and skipping re-seed.
  - Scenario 3: Interrupted-init (partial seed) recovery on startup with default entrypoint.
  - Scenario 4: Default entrypoint empty-volume global mode installation and SUPER_ADMIN coordination.
  - Scenario 5: Multi-lab representative workload, sample intake, data export, and backup/restore round-trip with epoch rotation.
- **Production Dependency Status (`npm audit --omit=dev`):**
  - Server: 4 high severity findings via Prisma 7 tooling transitives (`@prisma/config`, `deepmerge-ts`, `mysql2`, `prisma`). Zero critical vulnerabilities. Upstream Prisma 7 updates tracked.
  - Client: 3 findings (2 moderate in `react-router`/`react-router-dom` v6, 1 high in `xlsx` v0.18.5). Zero critical vulnerabilities. `jsPDF` critical advisory resolved cleanly.
- **Client Production Build:** Vite v5.4.21 transformed 2,659 modules and built cleanly in 27.11s with zero errors.
- **Full Backend Suite:** 148 server test suites (1,440 tests) passed.
