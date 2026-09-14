# Connected Workflow Verification & Release Audit (Commit 270a02d Follow-up)

**Reviewed & Deployed**: 14 September 2026, ~02:55 Europe/Rome  
**Git Commit**: 270a02d769ea8436777d6a94e8b9d94104761f4e (Merged PR #100)  
**Target Image**: soilfer-lims:v3.5.4-270a02d  
**Production VPS**: 46.19.33.37 (Container soilfer-lims healthy, port 3000)  
**Database Invariant**: server/prisma/dev.db SHA256 = 388E85FBC6573509F0C56E0F1DB6989FA682C2931AF5A90B0B82EEB1A0E6A90B (100% UNTOUCHED)  
**Live Sample Invariant**: 36,870 records preserved across cutover (0 loss)  

---

## 1. Executive Summary & Verification Scope

This document records the verification evidence for release 270a02d, specifically the resolution of the pagination search defect (PM-19/PM-21) and intake integrity fixes (I01–I04). Following deployment, independent review 15-live-ui-and-kobo-followup.md verified server-side search on production but identified two concrete remaining defects:
1. **U01**: Parameter/fallback argument inversion in `t(...)` calls causing blank numeric counts in Spanish views, and missing search accessible labels.
2. **K01**: Persistence of `configs[0]` and `lab.projectLabs[0]` first-target fallbacks violating explicit mapping requirements.

Broader contracts across A01–A20 and real lab journeys remain actively tracked below; absence of evidence is not treated as a pass.

### Verification Scorecard (Verified vs. In-Progress)

| Suite / Contract Area | Status | Evidence Source | Notes |
|---|---|---|---|
| **Original & Follow-up Probes (R01–R11, H01–H06)** | PASS (17/17) | WP/project-management-audit-v1/monitor-7832afd-probes.cjs | 100% passing across baseline security, intake and boundary probes |
| **Intake Integrity Probes (I01–I04)** | PASS (4/4) | WP/project-management-audit-v1/monitor-intake-270a02d-probes.cjs | Verified on 270a02d (desk drafts, paused project rejection, transition checks) |
| **Project Workspace Search & Pagination (PM-19/PM-21)** | PASS (9/9) | server/tests/contracts/project_workspace_samples.test.js | Independently verified on live VPS (GTM0382-6-1C-T on page 2) |
| **U01 Translation Signatures & Accessible Labels** | CORRECTED | verify_locales_u01.cjs & client build | Fixed dual t() signature, added aria-label, verified 5 locales |
| **K01 Explicit Kobo Mapping & Zero Fallbacks** | CORRECTED | server/tests/contracts/kobo_explicit_mapping.test.js | Eliminated configs[0] and lab.projectLabs[0]; disambiguation tested |
| **A01–A11 Scope, Lifecycle, Manifests & Gate Rules** | PASS | Integrated contract test suites | Verified in R01–R11 and reception_admissions_pm14.test.js |
| **A12 Retry & Concurrent Revision** | NOT YET VERIFIED | Ongoing Lab Journey Verification | Awaiting concurrent multi-actor simulation |
| **A14 Destination & Preview** | PASS | preview endpoints & H02/H03 suites | Verified format validation and masked conflict disclosures |
| **A16 Reconciliation** | NOT YET VERIFIED | Ongoing Lab Journey Verification | Awaiting end-to-end receipt reconciliation journey |
| **A17 Kobo Explicit Mapping** | CORRECTED | kobo_explicit_mapping.test.js | First-target fallback removed; explicit configuration enforced |
| **A18 Prior Order / Origin Stability** | PASS | monitor-intake-270a02d-probes.cjs | I03/I04 verify origin stability and state transition protection |
| **A19–A20 Multi-Locale & Audit Trail** | PASS | 5-locale test & H05 isolation suite | Verified across en, es, es-419, fr, pt with isolated audit query |

---

## 2. Server-Side Filtering & Pagination Beyond Page One (PM-19, PM-21)

### The Problem
Previously, SamplesTab.jsx filtered samples only on the client side from the 50 samples received on the active page. fetchSamples sent only page and limit, meaning a search query could not discover samples located beyond page 1, and stage filters could yield empty pages despite non-zero project counts.

### The Corrective Implementation
1. **Server-Side Predicate (server/controllers/projectController.js:getProjectSamples)**:
   - getProjectSamples receives q (query) and stage parameters.
   - q searches across id, originalId, and labId case-insensitively using SQLite contains.
   - stage accepts numeric indices ('0' through '5'), named stage keys ('awaitingArrival', 'intakeInProgress', 'labWork', 'awaitingReview', 'released', 'rejectedOrCancelled'), or direct status strings.
   - Computes total = await prisma.sample.count({ where: effectiveWhere }) using the combined authorization scope, search text, and stage criteria.
   - Sets the X-Total-Count header to the exact matching count and applies skip and take to the filtered dataset.
2. **Client Workspace Integration (client/src/pages/ProjectWorkspace.jsx & SamplesTab.jsx)**:
   - ProjectWorkspace.fetchSamples passes q and stage to the API.
   - Uses AbortController to abort and discard in-flight requests during rapid typing or filter switches.
   - Synchronizes q, stage, page, limit, and tab with URL query parameters (useSearchParams), allowing deep linking and reload preservation.
   - Filter changes automatically reset page to 1.
   - SamplesTab.jsx renders samples directly without client-side slicing and distinguishes empty filtered states (offering a "Clear all filters" button) from empty projects.
3. **Automated & Live Verification**:
   - Automated tests in project_workspace_samples.test.js verify that in a 60-sample fixture project, SMP-*-SPECIAL-BEYOND-P1 located at index 55 (page 2) is immediately returned on page 1 when searching q=SPECIAL-BEYOND-P1.
   - Production test against SOILFER-US (26,619 samples) verified:
     - Search by exact original ID GTM0399-6-1C-S: HTTP 200, exactly 1 returned, X-Total-Count: 1.
     - Stage 0 numeric filter: HTTP 200, X-Total-Count: 26619.
     - Stage named key awaitingArrival: HTTP 200, X-Total-Count: 26619 (exact match).
     - Non-existent search q=NONEXISTENT_XYZ_999999: HTTP 200, 0 returned, X-Total-Count: 0.

---

## 3. Connected Workflow Contracts Reconciliation

### PM-06: Lifecycle Status and Plan Configuration
- Generic PUT on /api/projects/:id strictly validates project closure readiness atomically inside prisma.\ when transitioning to COMPLETED, ARCHIVED, or CLOSED.
- Direct assignedLabIds mutations are blocked with HTTP 400 (requiring the /lab-access endpoint).
- ProjectActionsModal.jsx provides an integrated edit mode dynamically loading packages from /api/config/groups, supporting explicit draft-to-active activation via checkbox, and persisting metadata atomically.

### PM-13: Manifest Imports & Preview
- Manifest import preview (POST /api/projects/:id/imports/preview) validates sample identifiers against /^[A-Za-z0-9_.-]{1,64}$/, detects intra-file and database duplicates, and masks foreign project codes to prevent confidential information leakage (H03).
- Commit endpoint enforces format validation even on direct submission (H02).

### PM-14: Universal Admissions & Immutable Sample Origin (I01–I04)
- Admissions checks enforced across all entry points: receptionController.processIntake, processBatchConsignmentIntake, sampleController.receiveSample, updateSampleProject, manifest imports, and Kobo sync.
- Resolves existing sample identity first: request project cannot override persisted paused/closed project status (I01). Contradictory reassignments rejected with 400 CROSS_PROJECT_CONFLICT.
- Canonical sampleOriginService.js stamps and preserves origin: DESK_WALKIN across multiple saves (I03), ensuring legitimate walk-in drafts remain discardable with hard delete while pre-registered samples revert to EXPECTED (I02).
- Lifecycle transition checks are enforced inside transactions (sampleStateService.transitionSample) across single delete, batch delete, and reception discard for all roles including SUPER_ADMIN, rejecting reset of RELEASED or in-progress samples outside controlled amendments with 409 ILLEGAL_STATUS_TRANSITION (I04).

### PM-15 / A17: Kobo Sync Resolution & Explicit Destination Protection
- Eliminated legacy fallbacks (`configs[0]` in projectController.js and `lab.projectLabs[0]` in koboController.js).
- If multiple configs exist without unambiguous resolution, `getProjectKoboConfig` returns `{ configured: false, ambiguous: true }` and `syncLab` returns 400 `AMBIGUOUS_CONFIG_TARGET`.
- `config.projectCode` is strictly required; missing destination mapping throws explicit configuration-required error.
- Commit-time transactional verification re-validates project admissions status and servicing lab membership before creating sample records.
- Paused project admissions skip sample creation with truthful skip/failure receipts without advancing lastSyncAt.

### PM-16: Laboratory Membership & WorkItem Protection
- Project-to-lab relationships resolve canonically through the ProjectLab junction table, eliminating country inference fallbacks.
- Laboratory removal blocker (_executeUpdateProjectLabAccess) checks both active samples and outstanding WorkItem tasks atomically, preventing lab removal even if parent sample status is inconsistent.

### PM-18: Analysis Plan Tab & Catalogue Resilience
- AnalysisPlanTab.jsx connects dynamically to /api/config/groups, /api/config/analyses, and /api/config/gates.
- Removed all hardcoded synthetic bundle names and fake revision dates.
- Features explicit failure detection with retry banners for individual catalogue endpoints.
- Displays truthful empty states when no default bundle is configured.

### PM-19 / PM-21: Bounded Queries, Search, and URL State
- Default query bounded to 50 rows (maximum 500 rows).
- Full server-side search (q) and stage filtering integrated before count/pagination.
- Filter and pagination state preserved in URL params with AbortController cancellation for stale requests.

### PM-22: Truthful Activity Trail & 5-Locale Support
- Dedicated GET /api/projects/:id/activity endpoint with exact entity isolation (entity: 'PROJECT', matching id or code), preventing foreign audit event leakage.
- Removed fake fallback audit logs.
- All lifecycle badges, stage labels, action buttons, plan states, and error notices localized across English (en), Spanish (es), Latin American Spanish (es-419), French (fr), and Portuguese (pt).

---

## 4. Production Deployment Record

- **Timestamp**: 14 September 2026, 02:54 Europe/Rome
- **Host**: VPS 46.19.33.37
- **Docker Image**: soilfer-lims:v3.5.4-270a02d
- **Pre-Release Samples**: 36,870
- **Online Backup**: /opt/lims/backups/dev_predeploy_270a02d_online_20260914_024859.db (integrity: ok, 36,870 samples)
- **WAL Checkpoint**: Truncated cleanly (0|0|0)
- **Stopped Snapshot**: /opt/lims/backups/dev_predeploy_270a02d_stopped_20260914_024859.db (integrity: ok, 36,870 samples)
- **Post-Deploy Samples**: 36,870 (100% data preservation)
- **Service Status**: Up and healthy (GET /api/health returned HTTP 200, uptime: 53s)
- **Local Database Hash**: server/prisma/dev.db verified unchanged (388E85FBC6573509F0C56E0F1DB6989FA682C2931AF5A90B0B82EEB1A0E6A90B)
