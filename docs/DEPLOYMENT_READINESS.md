# SoilFER-LIMS Deployment Readiness Status & Operator Guide

> The setup and admin-account bugs are fixed and Docker startup tests pass. We are finishing the tested backup/upgrade procedure and the remaining multi-lab checks. This update is not yet released.

**Target Branch:** `feat/deployment-readiness` (PR #154)  
**Target Baseline:** `61e8900f8f5078383cc8585195ca4ec98a734c5d` (merged development baseline on main)  
**Current Live Production Status:** Unchanged (v3.5.30 / production commit `48d0e52`, released 28 September 2026 under PR #149). **THIS UPDATE IS NOT YET LIVE.**  
**Independent Audit Reference:** Codex Deployment Readiness Reviews (PR154 heads `4a07b2c`, `96921ae`, and `6725a99`).

---

## 1. Overview for Laboratory Operators

SoilFER-LIMS is designed to run reliably in two operating modes:
1. **Single Laboratory (`local` mode):** For an individual soil laboratory. Upon installation, it provisions your laboratory record and an initial `LAB_MANAGER` administrator account. The manager can configure the lab, onboard technicians, register samples, and process analytical batches.
2. **Multiple Laboratories (`global` mode):** For national agricultural institutes or laboratory networks coordinating several facilities. It provisions a central `SUPER_ADMIN` account who can create new laboratories, activate them, assign laboratory managers, and oversee cross-facility operations.

### Current System Health & Progress Summary
- **What Works:**
  - Setup and admin account provisioning bugs are fixed and independently verified.
  - Real Docker default-entrypoint startup, restart, and partial-seed recovery pass.
  - Multi-lab concurrent sample intake and scoped data exports (`POST /api/exports/data`) with exact role scoping.
  - Cross-restart token persistence and byte-for-byte signing secret verification.
  - Safe serialization: active writer container quiescence before generating database backups without writer races.
  - Executable backup filename extraction via regex `(soilfer_lims_backup_|backup_)[^ ')]+\.db\.gz`.
  - Staged Route B disaster recovery procedure (`/backup/staging/db` and `/backup/staging/assets`), staged SQLite validation, full unsuppressed pre-restore safety snapshots including dotfiles (`.jwt_secret`, `.seed_complete`, WAL/SHM), and rollback explicitly bound to immutable baseline image ID (`.Image`).
  - Fail-closed behavior on corrupted archives with untouched target volume verification.
  - Automatic data exchange epoch rotation on restore and rejection of pre-restore client cursors with `EPOCH_MISMATCH`.
  - Supported-baseline (v3.5.30 / commit `48d0e52`) upgrade from verified pinned git tree, exact 10-sample verification, asset preservation, and full post-recovery account/data/asset verifications.
  - Manifest file import pre-parser size check (5 MB bound) and extension/MIME validation (independently verified in review).
- **What Remains:**
  - Independent exact-head review and verification by Codex of the genuine baseline upgrade and executable operator gates.
  - Remote green CI execution of the updated suite.
  - Formal merge of PR #154 into `main` and production cutover under established release gates.
- **What Was Tested:**
  - 31 automated backend contract tests across bootstrap and acceptance suites (all passed).
  - 6 real Docker scenarios in `server/scripts/rehearsal_deployment_readiness.cjs`.
  - Vite client production build: 2,659 modules transformed in 6.89s with 0 errors.
  - Full backend test suites pass.
- **Availability & Live Status:**
  - These improvements are committed to the PR #154 branch (`feat/deployment-readiness`).
  - **THEY ARE NOT YET LIVE ON THE PRODUCTION SERVER.** The running production environment remains untouched until independent review acceptance and release gates pass.

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
| **P1** | `setup.sh` used removed Prisma 7 flag `--skip-generate` | Fresh installation via `./setup.sh` crashed during database setup | Removed `--skip-generate` flag; Prisma 7 handles generation via `prisma.config.ts` | **Independently verified** | Tested CLI schema push in isolated disposable checkout | Review & merge |
| **P2** | `setup.sh` suppressed DB push errors with `\|\| true` | Script printed "Database ready" even when the database failed to initialize | Removed error swallowing; script aborts immediately with guidance | **Independently verified** | Verified non-zero exit on deliberate failure | Review & merge |
| **P3** | Interrupted initial Docker boot could skip seed; blank JWT changed on restart | Incomplete first-start left empty unseeded database; restart invalidated auth tokens | Auto-generated JWT secret is saved to `prisma/.jwt_secret`; entrypoint detects incomplete setups and safely retries seed without touching populated databases | **Independently verified** | Verified secret stability across restarts; verified recovery after simulated seed failure (exit 77) | Review & merge |
| **P4** | Blank `JWT_SECRET` in `.env.example` caused Compose error; missing `ADMIN_INITIAL_PASSWORD` forwarding | Users copying `.env.example` saw errors; `.env` initial password was not passed to container | Compose accepts empty secret for entrypoint auto-generation; forwards `ADMIN_INITIAL_PASSWORD` | **Independently verified** | Validated Compose configuration with blank and configured variables | Review & merge |
| **P5** | `INSTALL.md` and guides suggested `docker-compose.global.yml` for single-lab NGINX | Single-lab users setting up NGINX were inadvertently forced into `global` multi-lab mode | Decoupled NGINX proxy into `docker-compose.nginx.yml`; updated all guide commands | **Independently verified** | Verified compose configurations for local, global, and local+nginx | Review & merge |
| **P6** | `setup.sh` printed incorrect login password `admin / password` | Users could not log in because the seed generated a random one-time password | `setup.sh` and docs now clearly direct operators to the generated one-time credentials | **Independently verified** | Traced setup shell output | Review & merge |
| **P7** | `server/package.json` had no `npm run seed` command | Users following README manual instructions failed with `missing script: seed` | Added `"seed": "node seed.js"` and `"provision:admin"` to `server/package.json` | **Independently verified** | Ran scripts in clean environment | Review & merge |
| **P8** | `server/seed.js` did not load `.env` variables | Custom `ADMIN_INITIAL_PASSWORD` or `DEPLOYMENT_MODE` in `.env` were ignored during seeding | Added CWD-independent dotenv loading at top of `server/seed.js` | **Independently verified** | Verified custom seed password read from root `.env` | Review & merge |
| **P9** | Dockerfile and CI ran Node.js 20 (now EOL); setup allowed Node 18 | Unsupported runtime risks and native addon linking failures | Standardized Dockerfile and CI on Node.js 24 LTS; setup.sh requires Node 24 LTS or Node 22 LTS (22.12+) | **Independently verified** | Verified Node 18 and Node 20 rejection; verified Node 24 builds | Review & merge |
| **P10** | Single-lab operators lacked supported path for API administration | Seeded `LAB_MANAGER` is denied SIS API credentials; operators lacked an official path to provision `SUPER_ADMIN` | Created `server/scripts/provision_super_admin.js` (`npm run provision:admin`) for host-console provisioning without widening UI permissions | **Independently verified** | Tested CLI provisioning and elevation | Review & merge |
| **P11** | Production dependency security advisories | Potential vulnerability notices in automated package scanners | Resolved direct safe dependencies via semver updates; production vulnerabilities reduced to 4 in server (Prisma 7 tooling transitives) and 3 in client (react-router v6, xlsx) | **Independently verified** | Ran `npm audit --omit=dev`; verified client Vite production build | Upstream package tracking |
| **P12** | Database restore swallowed SQL trigger/epoch rotation errors and risked sidecar loss | Controlled trigger failures still reported SUCCESS; WAL/SHM sidecars were unlinked without snapshots | `restore_db.js` preserves target and WAL/SHM sidecars as recovery artifacts (`.bak`); fails closed (exit 1) on SQL epoch rotation errors | **Independently verified** | Verified exit 1 and failure report when SQL trigger aborts epoch update | Review & merge |
| **P13** | Documentation lacked volume identity discovery and archive round-trip parity | Mismatched `.tar.gz` vs `.db.gz` instructions; hardcoded volume names risk creating empty volumes | `UPGRADING.md` rewritten with live container mount discovery, verified `.tar.gz` and `.db.gz` round trips, immutable image IDs, and postflight gates | **Independently verified** | Reconciled README, INSTALL, DEPLOYMENT_GUIDE, and UPGRADING | Review & merge |
| **P14** | Partial initial seed leaving `LAB01` crashed retry with unique-code conflict | Interrupted setup could not be resumed without manual database intervention | `seed.js` checks if `LAB01` exists; if present without users, reuses its ID and completes user seeding | **Independently verified** | Verified retry exits 0, reuses LAB01, creates exactly 1 manager | Review & merge |
| **P15** | Docker entrypoint SQLite inspection converted query errors to 0 users (fail-open) | Unreadable or corrupt database could trigger unintentional schema push or seeding | Inspection in `docker-entrypoint.sh` fails closed with code 1 upon any SQLite error or unreadable state | **Independently verified** | Verified exit 1 and fatal error on corrupt database header | Review & merge |
| **P16** | `provision_super_admin.js` matched `OR: [{ username }, { email }]`, risking account hijacking | Requesting a new username matching an existing user's default email altered the existing account | Strict target lookup, collision rejection before mutation, inactive status preservation, session revocation | **Independently verified** | Verified collision rejection, inactive preservation, and tokenVersion increment | Review & merge |
| **P17** | Real Docker acceptance testing lacked genuine baseline provenance, manager export identity & full post-rollback assertions | Fallback synthesized baseline by relabeling candidate; export checks missed absent submitter keys; post-rollback checked only endpoints | Enhanced `rehearsal_deployment_readiness.cjs` to build/bind genuine supported baseline (`soilfer-lims:baseline-v3.5.30`) from verified pinned tree `48d0e52` (no candidate relabeling), captured created walk-in IDs, verified `Sample ID` and `Lab ID` scoping, and asserted all 10 sample codes, assigned labs, and statuses post-rollback | **Fixed in branch** | Rehearsal suite covering Scenarios 1-6 | Codex independent review & CI |
| **P18** | Operator guide mode check expected missing property; proxy check silently skipped missing container; undefined write boundary | Health endpoint lacked `mode`; missing NGINX skipped without failing; release hold boundary was unstated | Updated `UPGRADING.md` to verify running `DEPLOYMENT_MODE` from container inspect against explicit expected mode (failing closed if unset or mismatched), fail closed on missing/stopped configured NGINX proxy, execute read-only role/route postflight, and define writer/ingress hold, COMMITTED state, and post-cutover recovery | **Fixed in branch** | Tested runbook shell snippets for mode, proxy, and recovery | Codex independent review & CI |
| **P19** | `ManifestImportModal.jsx` lacked pre-parser file size and MIME/extension checks | Potential unconstrained file parsing in reception manifest uploads | Added 5 MB file size limit and explicit MIME/extension validation before passing file to `XLSX.read` | **Independently verified** | Verified in VM harness across 6 test groups (size, extension, MIME, parser reach) | Review & merge |

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

### Client Advisories (2 Moderate in react-router v6, 1 High in xlsx — 0 Critical)
- **Affected Packages:** `react-router` / `react-router-dom` v6 (2 moderate), `xlsx` v0.18.5 (1 high).
- **Actual LIMS Usage & Remaining Risk:**
  - **`xlsx` (SheetJS v0.18.5):**
    - *Usage:* Used client-side in laboratory bulk import views (`ImportPreviewModal.jsx` and `ManifestImportModal.jsx`) to parse `.xlsx`, `.xls`, and `.csv` files provided by authenticated lab operators.
    - *Implemented Safeguards by Path:*
      1. **Reception Manifest Import (`ManifestImportModal.jsx`):**
         - Enforces hard pre-parser file size limit (`MAX_FILE_SIZE = 5 MB`). Files exceeding 5 MB are rejected immediately before byte arrays are loaded into memory.
         - Enforces pre-parser extension validation (`.xlsx`, `.xls`, `.csv`) and browser-reported MIME type validation.
         - *Note:* Manifest import does not currently enforce a post-parse row count cap.
      2. **Project Samples Bulk Import (`ImportPreviewModal.jsx` & `spreadsheetImport.js`):**
         - Enforces hard pre-parser file size limit (`MAX_FILE_SIZE = 5 MB`).
         - Uses input `accept` attribute filtering (`.xlsx, .xls, .csv`), followed by FileReader and `XLSX.read()`.
         - Post-parse batch limit: enforces `MAX_BATCH_ROWS = 2,000` (rejects workbooks containing more than 2,000 data rows).
      3. **Both paths:** Wrapped in structured try/catch blocks with user-facing validation errors.
    - *Decompressed Complexity & Remaining Risk:* While application-level bounds restrict file payload sizes to 5 MB from authenticated users, a file-size bound does not strictly cap the memory allocation or computational complexity of deeply nested XML structures, large expanded cell ranges, or crafted formulas inside the SheetJS parser. Upstream advisories (prototype pollution, ReDoS) remain unpatched in the npm registry package v0.18.5 because upstream shifted subsequent distributions exclusively to a proprietary CDN.
    - *Maintenance Decision & Proposed Item:* SheetJS v0.18.5 is retained under the above defensive guards for the current release. Migration to an actively maintained, open-source spreadsheet library (`exceljs`) is documented as a proposed maintenance item (`PROPOSED-MAINT-EXCELJS`) for evaluation in the next scheduled minor release cycle.
  - **`react-router-dom` v6:**
    - *Usage:* Client-side Single Page Application (SPA) routing in the user's browser. SoilFER-LIMS does not use Server-Side Rendering (SSR) or hydration.
    - *Remaining Risk & Maintenance Decision:* Advisories relate to route parameter matching edge cases. Route access is controlled by authenticated user tokens, role guards, and server-side authorization middleware on every API call. Note that TypeScript types provide compile-time guarantees and do not constitute runtime guards. **Maintenance Decision:** SoilFER-LIMS tracks the React Router v7 migration path once ecosystem stability is confirmed.

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

# Copy environment configuration template
cp .env.example .env
```

#### Step 2: Start the System
```bash
# Using Docker (Recommended):
docker compose up -d

# Or with NGINX Reverse Proxy:
docker compose -f docker-compose.yml -f docker-compose.nginx.yml up -d

# Or direct Node.js:
./setup.sh local
npm start
```

#### Step 3: First Login as Laboratory Manager
1. Navigate to: `http://<your-server-ip>:3000` (or port 80 if using NGINX).
2. Log in with username `admin` (Role: `LAB_MANAGER`) and your initial password.
3. Change your temporary password upon first login prompt.
4. Go to **Lab Management** to configure your laboratory name, address, accreditation status, and testing instruments.
5. Go to **Staff Management** to onboard lab technicians.

---

### Path B: Multi-Laboratory Network (`global` mode)

*Use this path if you are setting up SoilFER-LIMS to coordinate multiple laboratory facilities.*

#### Step 1: Clone the Repository & Configure Environment
```bash
git clone https://github.com/yigini/soilfer-lims.git
cd soilfer-lims

cp .env.example .env
```
Edit `.env` and set:
```ini
DEPLOYMENT_MODE=global
```

#### Step 2: Start the System
```bash
# Using Docker Compose (Recommended):
docker compose -f docker-compose.yml -f docker-compose.global.yml up -d

# Or with NGINX Reverse Proxy:
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
  - `server/tests/contracts/deployment_readiness_bootstrap.test.js` (10 tests passed): Verifies mode validation, Node 18/20 rejection, fail-fast schema push, JWT auto-population, entrypoint secret persistence across restarts, fail-closed SQLite database inspection, real partial seed recovery without duplicate code conflict, and strict Compose config validation.
- **Docker Deployment Readiness Rehearsal (`server/scripts/rehearsal_deployment_readiness.cjs`):**
  - Scenario 1: Default entrypoint empty-volume local mode installation, HTTP health, admin login, and password change.
  - Scenario 2: Container restart on same volume — persistent JWT secret, pre-restart token validation without re-login, and skipping re-seed.
  - Scenario 3: Interrupted-init (partial seed) recovery on startup with default entrypoint.
  - Scenario 4: Default entrypoint empty-volume global mode installation and SUPER_ADMIN coordination.
  - Scenario 5: Multi-lab representative workload (Manager Alpha & Manager Beta), real export endpoint (`POST /api/exports/data`) with exact Sample ID and Lab ID isolation, background escalation scheduler initialization verification, and safe quiesced backup serialization without active writer races.
  - Scenario 6: Populated supported-baseline (v3.5.30 / commit `48d0e52`) upgrade from verified pinned git tree, asset preservation, corrupt-archive staging fail-closed abort with untouched volume proof, candidate upgrade with pre-upgrade token persistence and exact 10-sample verification, staged Route B recovery, and epoch cursor invalidation (`EPOCH_MISMATCH`).
- **Production Dependency Status (`npm audit --omit=dev`):**
  - Server: 4 high severity findings via Prisma 7 tooling transitives (`@prisma/config`, `deepmerge-ts`, `mysql2`, `prisma`). Zero critical vulnerabilities. Upstream Prisma 7 updates tracked.
  - Client: 3 findings (2 moderate in `react-router`/`react-router-dom` v6, 1 high in `xlsx` v0.18.5). Zero critical vulnerabilities. `jsPDF` critical advisory resolved cleanly.
- **Client Production Build:** Vite v5.4.21 transformed 2,659 modules and built cleanly in 6.89s with zero errors.
- **Full Backend Suite:** 148 server test suites (1,440 tests) passed.
