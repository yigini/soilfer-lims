# SoilFER-LIMS Versioning Policy

This document defines the official versioning, release tagging, and change-management policy for **SoilFER-LIMS**.

---

## 1. Core Principle: Semantic Versioning 2.0.0

SoilFER-LIMS strictly adheres to **Semantic Versioning 2.0.0** ([SemVer](https://semver.org/)):

$$\text{Version Format: } \mathbf{MAJOR}.\mathbf{MINOR}.\mathbf{PATCH}$$

### 1.1 MAJOR Version ($X.0.0$)
Incremented when making incompatible API contract changes, breaking architectural restructurings, or database schema changes that require manual non-additive migrations:
- Breaking changes to external APIs (e.g., `/api/v1/sis/*`, public report endpoints).
- Incompatible changes to authentication, role hierarchies, or security isolation contracts (`scopeGuard.js`).
- Removal or breaking restructuring of public database tables or mandatory configuration files.

### 1.2 MINOR Version ($X.Y.0$)
Incremented when adding functionality in a backwards-compatible manner:
- Adding new analytical determination methods or operational workflow gates.
- New data exchange capabilities (e.g. OpenNSIS / GloSIS profile connector, KoboToolbox multi-project sync).
- Major UI module redesigns (e.g., technician workbench batch spreadsheet view, QA dashboard control charts).
- Additive database schema migrations that do not break existing queries.
- New configuration keys or lab policy presets with safe backwards-compatible defaults.

### 1.3 PATCH Version ($X.Y.Z$)
Incremented for backwards-compatible bug fixes, performance optimizations, and documentation alignments:
- Logic bug fixes in controllers, services, or client components.
- Security patches and dependency vulnerability updates.
- Localization string updates across supported languages (`en`, `es`, `es-419`, `fr`, `pt`).
- Styling, layout, and mobile responsiveness adjustments.

---

## 2. Single Source of Truth & Synchronized Packages

SoilFER-LIMS operates as an integrated full-stack application consisting of:
1. `server/package.json` (Express API server)
2. `client/package.json` (Vite / React frontend)

### 2.1 The Synchronization Rule
- **The version in `server/package.json` and `client/package.json` must always remain strictly identical.**
- No component or package may be bumped independently.
- Version bumps must occur atomically in the same commit.

### 2.2 Client-Side Injection (No Hardcoded Strings)
- The frontend must **never hardcode version numbers** (e.g., `"v1.4.0"`) inside React components or templates.
- The build toolchain (`client/vite.config.js`) extracts `pkg.version` from `client/package.json` and defines global constants at compile time:
  ```javascript
  define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  }
  ```
- All client components (`About.jsx`, `TechStack.jsx`, headers, footers, workflow maps) must reference `__APP_VERSION__` dynamically.

### 2.3 Server-Side Health & Version Endpoints
- The server exposes its package version dynamically via:
  - `GET /api/health` $\to$ `{ status: 'ok', version: '1.5.0', uptime: 1234 }`
  - `GET /api/version` $\to$ `{ name: 'soilfer-lims', version: '1.5.0', status: 'ok', uptime: 1234 }`
- Reverse proxies, container health checks, and remote monitoring tools use these endpoints to verify release parity without parsing files.

---

## 3. Git Tagging & Release Management

1. **Tag Format**: Every production release on `main` must carry an annotated Git tag formatted as:
   $$\mathbf{vMAJOR.MINOR.PATCH} \quad \text{(e.g., } \texttt{v1.5.0}\text{)}$$
2. **Release Branches**: Feature branches follow standard naming:
   - `feat/<issue-number>-<short-description>`
   - `fix/<issue-number>-<short-description>`
   - `audit/<issue-number>-<short-description>`
3. **Pull Request Validation**: Every PR must pass automated CI checks (`npm test` on server, `npm run build` and `npm run lint` on client, plus wiring regression contracts).

---

## 4. Changelog Maintenance

All notable changes must be documented in `CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/):
- Entries are grouped under headings: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
- Each release section references the version and release date: `## [X.Y.Z] - YYYY-MM-DD`.
- User-facing technical summaries must also be kept in sync in `client/src/pages/TechStack.jsx` under the `changelog` dataset.

---

## 5. Current Baseline

As of **October 2026**, the canonical baseline version of SoilFER-LIMS is:
$$\mathbf{v1.5.0}$$

This milestone reconciles the `v1.4.0` sample reception rework with:
- **GloSIS & OpenNSIS Interoperability (PR #158, Issue #140)**: Profile and horizon data models, exchange eligibility guards.
- **Audit Phase 0 Hardening (Issues #163–#177)**: Technician workbench mobile editor unblocking, instrument selector fix, empty QC evaluation, shared locale-aware decimal parsing, duplicate RPD bounds near LOQ, and report PDF truthfulness.
